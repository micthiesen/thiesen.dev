import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  comparePosts,
  isPublished,
  isSafeSlug,
  MAX_IMAGE_BYTES,
  normalizeImagePath,
  postPath,
  postSchema,
  validatePosts,
} from "../packages/content-core";

const base = { title: "A useful post", summary: "A concrete summary." };
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4uoAAAAASUVORK5CYII=",
  "base64",
);

describe("image path contract", () => {
  test("decodes filenames and removes redundant dot and separator segments", () => {
    expect(normalizeImagePath("././images//./My%20Screen.png")).toBe(
      "images/My Screen.png",
    );
    expect(normalizeImagePath("./%69mages/diagram.png")).toBe("images/diagram.png");
  });

  test("accepts supported extensions in any case and preserves filename case", () => {
    for (const filename of ["Hero.PNG", "Hero.JpG", "Hero.JPEG", "Hero.WeBp"]) {
      expect(normalizeImagePath(`./${filename}`)).toBe(filename);
    }
    expect(() => normalizeImagePath("./Hero.SVG")).toThrow(
      "Unsupported image extension",
    );
  });

  test("rejects encoded traversal before normalizing the path", () => {
    for (const source of [
      "%2e%2e/outside.png",
      "images/.%2e/outside.png",
      "images/%2E%2E%2Foutside.PNG",
    ]) {
      expect(() => normalizeImagePath(source)).toThrow("Images must use local paths");
    }
  });
});

describe("post metadata and publication", () => {
  test("defaults to a draft even when a date exists", () => {
    const meta = postSchema.parse({ ...base, publishedAt: "2026-09-29" });
    expect(meta.status).toBe("draft");
    expect(isPublished(meta, new Date("2026-09-30T12:00:00Z"))).toBe(false);
  });

  test("published posts require a date and exclude future dates", () => {
    expect(postSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
    const meta = postSchema.parse({
      ...base,
      status: "published",
      publishedAt: "2026-09-29",
    });
    expect(isPublished(meta, new Date("2026-09-28T23:59:59Z"))).toBe(false);
    expect(isPublished(meta, new Date("2026-09-29T00:00:00Z"))).toBe(true);
  });

  test("normalizes YAML Date values and validates all calendar dates", () => {
    expect(
      postSchema.parse({ ...base, publishedAt: new Date("2024-02-29T00:00:00Z") })
        .publishedAt,
    ).toBe("2024-02-29");
    for (const date of [
      "2026-02-29",
      "2026-02-31",
      "2026-13-01",
      "2026-9-1",
      "yesterday",
    ]) {
      expect(postSchema.safeParse({ ...base, publishedAt: date }).success).toBe(false);
      expect(postSchema.safeParse({ ...base, updatedAt: date }).success).toBe(false);
    }
    expect(
      postSchema.safeParse({ ...base, publishedAt: new Date("invalid") }).success,
    ).toBe(false);
  });

  test("rejects misspelled metadata and obsolete taxonomy fields", () => {
    expect(postSchema.safeParse({ ...base, publishAt: "2026-09-29" }).success).toBe(
      false,
    );
    for (const legacy of [
      { kind: "note" },
      { kind: "project" },
      { tags: ["Writing"] },
      { featured: true },
      { project: { github: "https://github.com/micthiesen/thiesen.dev" } },
    ]) {
      expect(postSchema.safeParse({ ...base, ...legacy }).success).toBe(false);
    }
  });

  test("rejects unsafe canonical URLs and empty hero alt text", () => {
    for (const canonical of [
      "javascript:alert(1)",
      "data:text/html,test",
      "https://user:secret@example.com/",
      "/relative-path/",
    ]) {
      expect(postSchema.safeParse({ ...base, canonical }).success).toBe(false);
    }
    expect(
      postSchema.safeParse({ ...base, canonical: "https://example.com/post/" }).success,
    ).toBe(true);
    expect(
      postSchema.safeParse({ ...base, hero: { src: "./hero.png", alt: "  " } }).success,
    ).toBe(false);
  });

  test("builds permanent paths only from safe slugs", () => {
    expect(postPath("agent-runner")).toBe("/posts/agent-runner/");
    expect(postPath("one-2-three")).toBe("/posts/one-2-three/");
    for (const slug of ["../escape", "UPPER", "a/b", "a--b", "a%2fb", "", "-start"]) {
      expect(isSafeSlug(slug)).toBe(false);
      expect(() => postPath(slug)).toThrow();
    }
  });

  test("sorts by publication date then title", () => {
    const older = postSchema.parse({ ...base, publishedAt: "2026-01-01" });
    const newer = postSchema.parse({ ...base, publishedAt: "2026-09-29" });
    const sameDate = postSchema.parse({
      ...base,
      title: "Zebra",
      publishedAt: "2026-09-29",
    });
    expect([older, sameDate, newer].sort(comparePosts)).toEqual([
      newer,
      sameDate,
      older,
    ]);
  });
});

describe("normal Markdown boundary", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "thiesen-content-test-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function post(
    body = "A plain Markdown post.",
    metadata = "",
    slug = "example-post",
  ) {
    const directory = path.join(root, slug);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "index.md"),
      `---\ntitle: A useful post\nsummary: A concrete summary.\n${metadata}---\n\n${body}\n`,
    );
    return directory;
  }

  async function errors() {
    return (await validatePosts(root)).issues.map((issue) => issue.message).join("\n");
  }

  test("accepts ordinary Markdown, local images, GFM, and code examples", async () => {
    const directory = await post(
      [
        "![A single white pixel used to exercise the image pipeline](./pixel.png)",
        "![The same pixel through a reference][pixel]",
        "[pixel]: ./pixel.png",
        "",
        "[A safe link](https://example.com) and [contact](mailto:hello@example.com).",
        "",
        "| Item | Value |\n| --- | --- |\n| One | Two |",
        "",
        "```html\n<script>alert('quoted code')</script>\n```",
        "",
        '```md\n::figure{src="./example.png"}\n```',
        "",
        "Inline `<script>` and escaped &lt;script&gt; remain text.",
      ].join("\n"),
    );
    await writeFile(path.join(directory, "pixel.png"), png);
    const result = await validatePosts(root);
    expect(result.issues).toEqual([]);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.meta.status).toBe("draft");
  });

  test("rejects impossible unquoted YAML dates before they can normalize", async () => {
    await post("Text.", "publishedAt: 2026-02-31\n");
    expect(await errors()).toContain("valid calendar date");
  });

  test("normalizes the same encoded image path in Markdown and hero metadata", async () => {
    const directory = await post(
      "![A publishing flow diagram](././images//My%20Screen.PnG)",
      'hero:\n  src: "./images/./My%20Screen.PnG"\n  alt: Publishing flow diagram\n',
    );
    await mkdir(path.join(directory, "images"));
    await writeFile(path.join(directory, "images", "My Screen.PnG"), png);
    const result = await validatePosts(root);
    expect(result.issues).toEqual([]);
    expect(result.posts).toHaveLength(1);
  });

  test("rejects raw HTML and JSX, including inside a draft", async () => {
    await post("A paragraph.\n\n<script>alert('no')</script>\n\n<Component />");
    expect(await errors()).toContain("Raw HTML and JSX");
  });

  test("rejects MDX files and import statements", async () => {
    const directory = await post('import Widget from "./widget";');
    await writeFile(path.join(directory, "extra.mdx"), "<Widget />");
    const messages = await errors();
    expect(messages).toContain("MDX is not supported");
    expect(messages).toContain("MDX imports and exports");
  });

  test("rejects executable frontmatter engines without evaluating them", async () => {
    const directory = await post();
    await writeFile(
      path.join(directory, "index.md"),
      '---javascript\n(() => { throw new Error("EVALUATED"); })()\n---\nText',
    );
    const messages = await errors();
    expect(messages).toContain("executable frontmatter languages are not supported");
    expect(messages).not.toContain("EVALUATED");
  });

  test("requires a closing frontmatter delimiter instead of silently discarding the body", async () => {
    const directory = await post();
    await writeFile(
      path.join(directory, "index.md"),
      "---\ntitle: A post\nsummary: A summary\n",
    );
    expect(await errors()).toContain("End YAML frontmatter");
  });

  test("gives actionable errors for deferred rich content", async () => {
    await post('::figure{src="./pixel.png" alt="A pixel"}\n\n```vega-lite\n{}\n```');
    const messages = await errors();
    expect(messages).toContain('Unsupported directive "figure"');
    expect(messages).toContain("Vega charts are not implemented yet");
  });

  test("accepts Markdown, code, references, and local images inside details", async () => {
    const directory = await post(
      [
        ":::details[Technical details]",
        "",
        "A **formatted** paragraph with [a reference][source].",
        "",
        "- One item",
        "- Another item",
        "",
        "![An image inside the expandable section][pixel]",
        "",
        "| Item | Value |\n| --- | --- |\n| One | Two |",
        "",
        "```rust\nlet on = true;\n```",
        "",
        "[pixel]: ./pixel.png",
        "[source]: https://example.com",
        ":::",
        "",
        ":::details[Another section]",
        "",
        "Its own content.",
        ":::",
      ].join("\n"),
    );
    await writeFile(path.join(directory, "pixel.png"), png);
    expect((await validatePosts(root)).issues).toEqual([]);
  });

  test.each([
    [":::unknown[Title]\nBody\n:::", 'Unsupported directive "unknown"'],
    [":details[Title]", "use :::details[Summary]"],
    ["::details[Title]", "use :::details[Summary]"],
    [":::details\nBody\n:::", "plain-text summary"],
    [":::details[ ]\nBody\n:::", "plain-text summary"],
    [":::details[**Title**]\nBody\n:::", "plain-text summary"],
    [":::details[[Link](https://example.com)]\nBody\n:::", "plain-text summary"],
    [":::details[Title]{open}\nBody\n:::", "do not accept attributes"],
    [":::details[Title]{onclick=alert}\nBody\n:::", "do not accept attributes"],
    [":::details[Title]{}\nBody\n:::", "without attributes"],
    [":::details[Title]\nBody", "Close each details section"],
    [":::details[Title]\n:::", "need Markdown content"],
    [":::details[Title]\n[ref]: https://example.com\n:::", "need Markdown content"],
    [":::details[Title]\n:::details[Inner]\nBody\n:::\n:::", "nested directives"],
    ["> :::details[Title]\n> Body\n> :::", "top-level blocks"],
  ])("rejects unsupported details syntax: %s", async (body, expected) => {
    await post(body);
    expect(await errors()).toContain(expected);
  });

  test("keeps the content safety boundary inside details and reports source lines", async () => {
    await post(
      [
        ":::details[Technical details]",
        "",
        "<script>alert('no')</script>",
        "",
        "[Unsafe](javascript:alert%281%29)",
        "",
        "![](./missing.png)",
        "",
        "![Remote](https://example.com/remote.png)",
        "",
        "![Reference][remote]",
        "",
        "[remote]: ../outside.png",
        ":::",
      ].join("\n"),
    );
    const result = await validatePosts(root);
    expect(result.posts).toEqual([]);
    expect(result.issues).toContainEqual({
      file: path.join(root, "example-post/index.md"),
      line: 8,
      message:
        "Raw HTML and JSX are not supported in normal posts; use plain Markdown or show code in a fenced block",
    });
    const messages = result.issues.map((issue) => issue.message).join("\n");
    expect(messages).toContain("Unsafe link URL");
    expect(messages).toContain("meaningful alt text");
    expect(messages).toContain("Missing local image");
    expect(
      result.issues.filter((issue) =>
        issue.message.includes("Images must use local paths"),
      ),
    ).toHaveLength(2);
  });

  test("rejects unsafe protocols in links and reference definitions", async () => {
    await post(
      "[Bad](javascript:alert%281%29)\n\n[Reference][bad]\n\n[bad]: data:text/html,test",
    );
    expect(await errors()).toContain("Unsafe link URL");
  });

  test("rejects remote images, escapes, encoded traversal, and Windows paths", async () => {
    for (const [slug, source] of [
      ["escape", "../outside.png"],
      ["encoded", "%2e%2e/outside.png"],
      ["absolute", "/outside.png"],
      ["remote", "https://example.com/image.png"],
      ["windows", "C:%5Cimage.png"],
    ]) {
      await post(`![An explanatory caption](${source})`, "", slug);
    }
    const result = await validatePosts(root);
    expect(result.posts).toHaveLength(0);
    expect(
      result.issues.filter((issue) =>
        issue.message.includes("Images must use local paths"),
      ),
    ).toHaveLength(5);
  });

  test("rejects missing images, unsupported images, and empty alt text", async () => {
    const directory = await post(
      "![](./missing.png)\n\n![Vector graphic](./unsafe.svg)",
    );
    await writeFile(path.join(directory, "unsafe.svg"), "<svg></svg>");
    const messages = await errors();
    expect(messages).toContain("meaningful alt text");
    expect(messages).toContain("Missing local image");
    expect(messages).toContain("Unsupported image extension");
    expect(messages).toContain("Unsupported post asset");
  });

  test("validates hero image paths", async () => {
    await post(
      "Text.",
      "hero:\n  src: ../outside.png\n  alt: Diagram of the publishing flow\n",
    );
    expect(await errors()).toContain("Hero: Images must use local paths");
  });

  test("rejects oversized and empty source images even when unreferenced", async () => {
    const directory = await post();
    await writeFile(
      path.join(directory, "large.png"),
      Buffer.alloc(MAX_IMAGE_BYTES + 1),
    );
    await writeFile(path.join(directory, "empty.webp"), "");
    const messages = await errors();
    expect(messages).toContain("exceeds the 10 MiB source limit");
    expect(messages).toContain("Image is empty");
  });

  test("rejects symlinked images and post directories", async () => {
    const directory = await post("![A pixel](./linked.png)");
    await writeFile(path.join(directory, "real.png"), png);
    await symlink(path.join(directory, "real.png"), path.join(directory, "linked.png"));
    await symlink(directory, path.join(root, "linked-post"));
    const result = await validatePosts(root);
    expect(result.posts).toHaveLength(0);
    expect(
      result.issues.some((issue) => issue.message.includes("Symlinks are not allowed")),
    ).toBe(true);
    expect(
      result.issues.some((issue) =>
        issue.message.includes("symlinks and MDX are not allowed"),
      ),
    ).toBe(true);
  });

  test("requires one index.md in each post directory and a safe slug", async () => {
    await post("Text.", "", "Bad_Slug");
    await mkdir(path.join(root, "missing-index"));
    const result = await validatePosts(root);
    expect(result.posts).toHaveLength(0);
    expect(result.issues.some((issue) => issue.message.includes("Post slugs"))).toBe(
      true,
    );
    expect(
      result.issues.some((issue) => issue.file.endsWith("missing-index/index.md")),
    ).toBe(true);
  });
});
