import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { postPath } from "../../packages/content-core/index";
import { getPosts } from "../lib/posts";

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPosts(false);
  return rss({
    title: "Michael Thiesen",
    description: "Software, tools, and things worth investigating.",
    site: site!,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: new Date(post.data.publishedAt!),
      link: postPath(post.data.kind, post.id),
    })),
    customData: "<language>en-ca</language>",
  });
};
