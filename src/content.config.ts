import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { fileURLToPath } from "node:url";
import {
  isPublished,
  normalizeImagePath,
  postSchema,
  validatePosts,
} from "../packages/content-core/index";

const posts = defineCollection({
  loader: {
    name: "publication-posts",
    async load(context) {
      const result = await validatePosts(
        fileURLToPath(new URL("./src/content/posts/", context.config.root)),
      );
      if (result.issues.length) {
        throw new Error(
          result.issues.map((issue) => `${issue.file}: ${issue.message}`).join("\n"),
        );
      }
      const now = new Date();
      // Filter before rendering; getCollection() filtering alone still emits draft images.
      const exclusions = import.meta.env.DEV
        ? []
        : result.posts
            .filter((post) => !isPublished(post.meta, now))
            .map((post) => `!${post.slug}/index.md`);
      await glob({
        base: "./src/content/posts",
        pattern: ["*/index.md", ...exclusions],
        generateId: ({ entry }) => entry.split("/")[0]!,
      }).load(context);
    },
  },
  schema: ({ image }) => {
    const imageSchema = image();
    return postSchema.transform(async (post) => ({
      ...post,
      heroImage: post.hero
        ? await imageSchema.parseAsync(`./${normalizeImagePath(post.hero.src)}`)
        : undefined,
    }));
  },
});

export const collections = { posts };
