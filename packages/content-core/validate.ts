import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { JSON_SCHEMA, load } from "js-yaml";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { detailsIssue, remarkDetails } from "./details";
import { isSafeSlug, postSchema, type PostMeta } from "./schema";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export interface ContentIssue {
  file: string;
  line?: number;
  message: string;
}

export interface ValidatedPost {
  slug: string;
  meta: PostMeta;
  body: string;
  file: string;
}

export interface ContentValidation {
  posts: ValidatedPost[];
  issues: ContentIssue[];
}

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkDetails);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Decode and normalize a post-local image path, preserving filename case. */
export function normalizeImagePath(source: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(source);
  } catch {
    throw new Error("Image path has invalid percent encoding");
  }
  if (
    !decoded ||
    /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    decoded.startsWith("/") ||
    // oxlint-disable-next-line no-control-regex -- Filesystem paths must exclude control characters.
    /[\\?#\u0000-\u001f\u007f]/.test(decoded) ||
    decoded.split("/").includes("..")
  ) {
    throw new Error(
      "Images must use local paths inside this post directory, without traversal, queries, or fragments",
    );
  }
  const relative = path.posix.normalize(decoded);
  if (!IMAGE_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
    throw new Error("Unsupported image extension; use PNG, JPEG, or WebP");
  }
  return relative;
}

function safeLink(url: string): boolean {
  // oxlint-disable-next-line no-control-regex -- Controls can disguise an executable URL scheme.
  if (/^[\s]*\/\//.test(url) || /[\\\u0000-\u0020\u007f]/.test(url)) return false;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  return !scheme || ["https", "http", "mailto", "tel"].includes(scheme);
}

async function scanAssets(
  directory: string,
  issues: ContentIssue[],
  prefix = "",
): Promise<Set<string>> {
  const assets = new Set<string>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isSymbolicLink()) {
      issues.push({ file, message: "Symlinks are not allowed in post directories" });
    } else if (entry.isDirectory()) {
      for (const asset of await scanAssets(file, issues, relative)) assets.add(asset);
    } else if (!entry.isFile()) {
      issues.push({ file, message: "Only regular content files are allowed" });
    } else if (relative !== "index.md") {
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        issues.push({
          file,
          message: /\.mdx$/i.test(entry.name)
            ? "MDX is not supported for normal posts; use index.md with plain Markdown"
            : "Unsupported post asset; this scaffold accepts index.md and PNG, JPEG, or WebP images",
        });
      } else {
        const stat = await lstat(file);
        if (stat.size > MAX_IMAGE_BYTES) {
          issues.push({
            file,
            message: `Image exceeds the ${MAX_IMAGE_BYTES / 1024 / 1024} MiB source limit`,
          });
        } else if (stat.size === 0) {
          issues.push({ file, message: "Image is empty" });
        }
        assets.add(relative);
      }
    }
  }
  return assets;
}

function validateMarkdown(
  body: string,
  file: string,
  lineOffset: number,
  assets: Set<string>,
  issues: ContentIssue[],
): void {
  const tree: Root = markdown.parse(body);
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    const identifier = node.identifier.toUpperCase();
    if (!definitions.has(identifier)) definitions.set(identifier, node.url);
  });

  const issue = (message: string, line?: number) => {
    issues.push({
      file,
      ...(line === undefined ? {} : { line: line + lineOffset }),
      message,
    });
  };
  const image = (url: string, alt: string | null | undefined, line?: number) => {
    if (!alt?.trim())
      issue("Images need meaningful alt text describing their content", line);
    try {
      const relative = normalizeImagePath(url);
      if (!assets.has(relative)) issue(`Missing local image: ${url}`, line);
    } catch (error) {
      issue(errorMessage(error), line);
    }
  };

  visit(tree, (node, _index, parent) => {
    const line = node.position?.start.line;
    const directiveIssue = detailsIssue(node, parent, body);
    if (directiveIssue) issue(directiveIssue, line);
    switch (node.type) {
      case "html":
        issue(
          "Raw HTML and JSX are not supported in normal posts; use plain Markdown or show code in a fenced block",
          line,
        );
        break;
      case "image":
        image(node.url, node.alt, line);
        break;
      case "imageReference": {
        const url = definitions.get(node.identifier.toUpperCase());
        if (url) image(url, node.alt, line);
        else issue(`Missing image reference definition: ${node.identifier}`, line);
        break;
      }
      case "definition":
      case "link":
        if (!safeLink(node.url))
          issue(
            "Unsafe link URL; use http, https, mailto, tel, or a relative site link",
            line,
          );
        break;
      case "code":
        if (/^(vega|vega-lite|vegalite)$/i.test(node.lang ?? "")) {
          issue(
            "Vega charts are not implemented yet; use a static image with alt text until the chart pipeline is added",
            line,
          );
        }
        break;
      case "text":
        if (
          /(?:^|\n)\s*(?:import\s+(?:[\w*{].*\s+from\s+|["'])|export\s+(?:default|const|let|var|function|class|\{)\b)/.test(
            node.value,
          )
        ) {
          issue(
            "MDX imports and exports are not supported; show source code in a fenced code block",
            line,
          );
        }
        break;
    }
  });
}

/** Validate every post, including drafts, before Astro receives the content. */
export async function validatePosts(postsRoot: string): Promise<ContentValidation> {
  const posts: ValidatedPost[] = [];
  const issues: ContentIssue[] = [];
  const root = path.resolve(postsRoot);
  try {
    const stat = await lstat(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return {
        posts,
        issues: [
          {
            file: root,
            message: "Posts root must be a regular directory, not a symlink",
          },
        ],
      };
    }
    const entries = (await readdir(root, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const directory = path.join(root, entry.name);
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        issues.push({
          file: directory,
          message:
            "Each post must be a regular directory containing index.md; symlinks and MDX are not allowed",
        });
        continue;
      }
      if (!isSafeSlug(entry.name)) {
        issues.push({
          file: directory,
          message: "Post slugs must use lowercase letters, numbers, and single hyphens",
        });
      }
      const startIssues = issues.length;
      const file = path.join(directory, "index.md");
      try {
        const assets = await scanAssets(directory, issues);
        const indexStat = await lstat(file);
        if (!indexStat.isFile() || indexStat.isSymbolicLink()) {
          issues.push({
            file,
            message: "index.md must be a regular file, not a symlink",
          });
          continue;
        }
        const source = await readFile(file, "utf8");
        if (!/^\uFEFF?---\r?\n/.test(source)) {
          issues.push({
            file,
            message:
              "Start posts with YAML frontmatter using a plain --- delimiter; executable frontmatter languages are not supported",
          });
          continue;
        }
        const closingDelimiter = source
          .slice(source.indexOf("\n") + 1)
          .match(/^---.*$/m)?.[0];
        if (!closingDelimiter || !/^---\r?$/.test(closingDelimiter)) {
          issues.push({
            file,
            message: "End YAML frontmatter with a plain --- delimiter on its own line",
          });
          continue;
        }
        // JSON_SCHEMA preserves YAML date scalars so impossible dates cannot roll over.
        const parsed = matter(source, {
          engines: {
            yaml: (yaml) =>
              load(yaml, { schema: JSON_SCHEMA }) as Record<string, unknown>,
          },
        });
        const meta = postSchema.safeParse(parsed.data);
        if (!meta.success) {
          for (const error of meta.error.issues) {
            issues.push({
              file,
              message: `Frontmatter ${error.path.join(".") || "metadata"}: ${error.message}`,
            });
          }
        }
        const lineOffset =
          source.slice(0, source.length - parsed.content.length).split("\n").length - 1;
        validateMarkdown(parsed.content, file, lineOffset, assets, issues);
        if (meta.success && meta.data.hero) {
          try {
            const relative = normalizeImagePath(meta.data.hero.src);
            if (!assets.has(relative))
              issues.push({
                file,
                message: `Missing hero image: ${meta.data.hero.src}`,
              });
          } catch (error) {
            issues.push({ file, message: `Hero: ${errorMessage(error)}` });
          }
        }
        if (meta.success && isSafeSlug(entry.name) && issues.length === startIssues) {
          posts.push({ slug: entry.name, meta: meta.data, body: parsed.content, file });
        }
      } catch (error) {
        issues.push({ file, message: errorMessage(error) });
      }
    }
  } catch (error) {
    issues.push({ file: root, message: errorMessage(error) });
  }
  return { posts, issues };
}
