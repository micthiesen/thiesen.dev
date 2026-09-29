import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Effect } from "effect";
import sharp from "sharp";
import { validatePosts } from "../packages/content-core";
import { createPost, importImage, runPost } from "../tools/post";

let root: string;
const slug = "a-useful-post";
const run = Effect.runPromise;
const draft = () => run(createPost(root, slug, "A useful post", "A concrete summary."));
const imageSource = async (width = 120, height = 80) => {
  const source = path.join(root, "original.png");
  await sharp({ create: { width, height, channels: 3, background: "#689fa2" } })
    .png()
    .toFile(source);
  return source;
};

beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), "thiesen-post-test-")));
  await mkdir(path.join(root, "src/content/posts"), { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("post new", () => {
  test("writes only valid draft metadata and safely quotes user text", async () => {
    const title = 'A title: "quoted"\nstatus: published';
    const filename = await run(
      createPost(root, slug, title, "A summary # with YAML punctuation."),
    );
    const checked = await validatePosts(path.join(root, "src/content/posts"));
    expect(checked.issues).toEqual([]);
    expect(checked.posts[0]?.meta).toEqual({
      title,
      summary: "A summary # with YAML punctuation.",
      status: "draft",
    });
    expect(checked.posts[0]?.body.trim()).toBe("");
    expect(filename).toBe(path.join(root, "src/content/posts", slug, "index.md"));
  });

  test("refuses existing posts without changing them", async () => {
    const filename = await draft();
    const original = await readFile(filename, "utf8");
    await expect(
      run(createPost(root, slug, "Replacement", "Replacement")),
    ).rejects.toThrow("EEXIST");
    expect(await readFile(filename, "utf8")).toBe(original);
  });

  test("rejects invalid metadata and traversal before creating files", async () => {
    await expect(run(createPost(root, slug, " ", "summary"))).rejects.toThrow(
      "Must not be empty",
    );
    await expect(lstat(path.join(root, "src/content/posts", slug))).rejects.toThrow(
      "ENOENT",
    );
    for (const invalid of [
      "../outside",
      "/absolute",
      "two--hyphens",
      "Uppercase",
      "a/b",
      "a\\b",
    ]) {
      await expect(run(createPost(root, invalid, "Title", "Summary"))).rejects.toThrow(
        "Post slugs",
      );
    }
  });

  test("rejects an existing post symlink and symlinked content parent", async () => {
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(root, "src/content/posts", slug));
    await expect(draft()).rejects.toThrow("EEXIST");
    await rm(path.join(root, "src/content"), { recursive: true });
    await mkdir(path.join(outside, "posts"));
    await symlink(outside, path.join(root, "src/content"));
    await expect(draft()).rejects.toThrow("not a symlink");
    await expect(lstat(path.join(outside, "posts", slug))).rejects.toThrow("ENOENT");
  });

  test("accepts a checkout reached through a directory alias", async () => {
    const alias = path.join(root, "checkout-link");
    await symlink(root, alias);
    expect(await run(createPost(alias, slug, "Title", "Summary"))).toBe(
      path.join(root, "src/content/posts", slug, "index.md"),
    );
  });
});

describe("post image", () => {
  beforeEach(draft);

  test("orients and downsizes a photo, strips metadata, and preserves the source", async () => {
    const source = path.join(root, "Camera Photo.jpg");
    await sharp({
      create: { width: 4000, height: 1000, channels: 3, background: "#74583d" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toFile(source);
    const original = await readFile(source);
    const result = await run(importImage(root, slug, source));
    expect(path.basename(result.filename)).toBe("camera-photo.webp");
    expect(result.width).toBe(480);
    expect(result.height).toBe(1920);
    const metadata = await sharp(result.filename).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(await readFile(source)).toEqual(original);
  });

  test("does not upscale small photos", async () => {
    const result = await run(importImage(root, slug, await imageSource()));
    expect([result.width, result.height]).toEqual([120, 80]);
  });

  test("PNG preserves screenshot pixels and dimensions without palette conversion", async () => {
    const source = path.join(root, "screenshot.png");
    const pixels = Buffer.from(
      Array.from({ length: 2100 * 3 * 4 }, (_, i) => (i * 37) % 256),
    );
    await sharp(pixels, { raw: { width: 2100, height: 3, channels: 4 } })
      .png()
      .toFile(source);
    const result = await run(
      importImage(root, slug, source, { name: "diagram.png", format: "png" }),
    );
    expect([result.width, result.height]).toEqual([2100, 3]);
    expect(await sharp(result.filename).raw().toBuffer()).toEqual(pixels);
    const checked = await validatePosts(path.join(root, "src/content/posts"));
    expect(checked.issues).toEqual([]);
  });

  test("refuses overwrites and never replaces an image source in the post", async () => {
    const source = await imageSource();
    const first = await run(importImage(root, slug, source));
    const original = await readFile(first.filename);
    await expect(run(importImage(root, slug, source))).rejects.toThrow("EEXIST");
    await expect(run(importImage(root, slug, first.filename))).rejects.toThrow(
      "EEXIST",
    );
    expect(await readFile(first.filename)).toEqual(original);
  });

  test("refuses traversal, unsupported output extensions, and mismatched formats", async () => {
    const source = await imageSource();
    for (const name of [
      "../outside",
      "sub/image",
      "a\\b",
      "%2e%2e",
      ".hidden",
      "x.jpg",
      "x.png",
    ]) {
      await expect(run(importImage(root, slug, source, { name }))).rejects.toThrow(
        "kebab filename",
      );
    }
    await expect(run(importImage(root, "../outside", source))).rejects.toThrow(
      "Post slugs",
    );
  });

  test("rejects source file symlinks while accepting real files through directory aliases", async () => {
    const source = await imageSource();
    const link = path.join(root, "link.png");
    await symlink(source, link);
    await expect(run(importImage(root, slug, link))).rejects.toThrow("not a symlink");
    await mkdir(path.join(root, "sources"));
    await writeFile(path.join(root, "sources/photo.png"), await readFile(source));
    await symlink(path.join(root, "sources"), path.join(root, "linked-sources"));
    const imported = await run(
      importImage(root, slug, path.join(root, "linked-sources/photo.png")),
    );
    expect(path.basename(imported.filename)).toBe("photo.webp");
    expect(await readFile(path.join(root, "sources/photo.png"))).toEqual(
      await readFile(source),
    );
  });

  test("rejects symlinked destination files and missing posts", async () => {
    const source = await imageSource();
    const original = await readFile(source);
    await symlink(source, path.join(root, "src/content/posts", slug, "original.webp"));
    await expect(run(importImage(root, slug, source))).rejects.toThrow("EEXIST");
    expect(await readFile(source)).toEqual(original);
    await expect(run(importImage(root, "missing-post", source))).rejects.toThrow(
      "ENOENT",
    );
  });

  test("rejects invalid or vector images before creating output", async () => {
    const source = path.join(root, "bad.png");
    await writeFile(source, "");
    const empty = await run(
      importImage(root, slug, source).pipe(
        Effect.match({
          onSuccess: () => "unexpected success",
          onFailure: (error) => error.message,
        }),
      ),
    );
    expect(empty).toContain("Cannot decode image");
    await writeFile(source, "not an image");
    await expect(run(importImage(root, slug, source))).rejects.toThrow(
      "Cannot decode image",
    );
    const svg = path.join(root, "vector.svg");
    await writeFile(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" /></svg>',
    );
    await expect(run(importImage(root, slug, svg))).rejects.toThrow(
      "single-frame raster",
    );
    await expect(
      lstat(path.join(root, "src/content/posts", slug, "bad.webp")),
    ).rejects.toThrow("ENOENT");
  });

  test("rejects excessive source and output sizes without creating an asset", async () => {
    const source = path.join(root, "large.png");
    await writeFile(source, "");
    await truncate(source, 100 * 1024 * 1024 + 1);
    await expect(run(importImage(root, slug, source))).rejects.toThrow("100 MiB");
    await sharp(randomBytes(2048 * 2048 * 3), {
      raw: { width: 2048, height: 2048, channels: 3 },
    })
      .png()
      .toFile(source);
    await expect(
      run(importImage(root, slug, source, { format: "png" })),
    ).rejects.toThrow("exceeds 10 MiB");
    await expect(
      lstat(path.join(root, "src/content/posts", slug, "large.png")),
    ).rejects.toThrow("ENOENT");
  });
});

describe("post CLI arguments", () => {
  test("shows help and enforces required flags and known commands", async () => {
    expect(await run(runPost(["--help"], root))).toContain("bun run post new");
    await expect(run(runPost(["publish", slug], root))).rejects.toThrow("Usage");
    await expect(run(runPost(["new", slug, "--title", "Title"], root))).rejects.toThrow(
      "--summary",
    );
    await expect(
      run(runPost(["new", slug, "--status", "published"], root)),
    ).rejects.toThrow("Unknown option");
    await expect(
      run(runPost(["image", slug, "photo.jpg", "--format", "jpeg"], root)),
    ).rejects.toThrow("webp or png");
  });

  test("runs the documented new and image commands", async () => {
    const created = await run(
      runPost(["new", slug, "--title", "Title", "--summary", "Summary"], root),
    );
    expect(created).toContain("Created draft:");
    const added = await run(
      runPost(["image", slug, await imageSource(), "--name", "cover.webp"], root),
    );
    expect(added).toContain("Markdown: ![Describe the image](./cover.webp)");
    expect((await validatePosts(path.join(root, "src/content/posts"))).issues).toEqual(
      [],
    );
  });
});
