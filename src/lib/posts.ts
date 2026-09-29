import { getCollection, type CollectionEntry } from "astro:content";
import { comparePosts, isPublished } from "../../packages/content-core/index";

export type Post = CollectionEntry<"posts">;

export async function getPosts(includeDrafts = import.meta.env.DEV): Promise<Post[]> {
  const now = new Date();
  const posts = await getCollection("posts");
  return posts
    .filter((post) => includeDrafts || isPublished(post.data, now))
    .sort((a, b) => comparePosts(a.data, b.data));
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
