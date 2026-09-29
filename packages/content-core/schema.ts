import { z } from "zod";

/** Calendar dates are stored in UTC and serialized as YYYY-MM-DD. */
const calendarDate = z
  .union([z.string(), z.date()])
  .transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value,
  )
  .refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date in YYYY-MM-DD format");

const text = z.string().trim().min(1, "Must not be empty");

const webUrl = text.refine((value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an absolute http or https URL without credentials");

export const postSchema = z
  .strictObject({
    title: text,
    summary: text,
    status: z.enum(["draft", "published"]).default("draft"),
    publishedAt: calendarDate.optional(),
    updatedAt: calendarDate.optional(),
    hero: z.strictObject({ src: text, alt: text }).optional(),
    canonical: webUrl.optional(),
  })
  .superRefine((post, context) => {
    if (post.status === "published" && !post.publishedAt) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Published posts require publishedAt",
      });
    }
  });

export type PostMeta = z.infer<typeof postSchema>;

export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function postPath(slug: string): string {
  if (!isSafeSlug(slug)) throw new Error(`Invalid post slug: ${slug}`);
  return `/posts/${slug}/`;
}

/** A scheduled post becomes eligible at midnight UTC on its publication date. */
export function isPublished(meta: PostMeta, now: Date): boolean {
  if (Number.isNaN(now.valueOf()))
    throw new Error("Publication time must be a valid Date");
  return (
    meta.status === "published" &&
    meta.publishedAt !== undefined &&
    meta.publishedAt <= now.toISOString().slice(0, 10)
  );
}

/** Sort newest first, with a deterministic title tie-breaker. */
export function comparePosts(a: PostMeta, b: PostMeta): number {
  const dateOrder = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  return dateOrder || a.title.localeCompare(b.title, "en");
}
