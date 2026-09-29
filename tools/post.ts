import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Data, Effect } from "effect";
import sharp from "sharp";
import { isSafeSlug, MAX_IMAGE_BYTES, postSchema } from "../packages/content-core";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

class PostError extends Data.TaggedError("PostError")<{ message: string }> {}

const failure = (message: string) => Effect.fail(new PostError({ message }));
const attempt = <A>(message: string, action: () => PromiseLike<A>) =>
  Effect.tryPromise({
    try: () => Promise.resolve(action()),
    catch: (error) =>
      new PostError({
        message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
      }),
  });

/** Check every component, so a directory symlink cannot escape the chosen path. */
function regularPath(filename: string, kind: "file" | "directory") {
  return Effect.gen(function* () {
    const absolute = path.resolve(filename);
    const { root } = path.parse(absolute);
    let current = root;
    const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const stat = yield* attempt(`Cannot inspect ${current}`, () => lstat(current));
      const expected = index === parts.length - 1 ? kind : "directory";
      if (
        stat.isSymbolicLink() ||
        (expected === "directory" ? !stat.isDirectory() : !stat.isFile())
      ) {
        return yield* failure(
          `${current} must be a regular ${expected}, not a symlink`,
        );
      }
    }
    return absolute;
  });
}

function postDirectory(root: string, slug: string) {
  return Effect.gen(function* () {
    if (!isSafeSlug(slug)) {
      return yield* failure(
        "Post slugs must use lowercase letters, numbers, and single hyphens",
      );
    }
    const checkout = yield* attempt(`Cannot locate checkout ${root}`, () =>
      realpath(root),
    );
    const posts = yield* regularPath(
      path.join(checkout, "src/content/posts"),
      "directory",
    );
    return path.join(posts, slug);
  });
}

export function createPost(root: string, slug: string, title: string, summary: string) {
  return Effect.gen(function* () {
    const meta = postSchema.safeParse({ title, summary, status: "draft" });
    if (!meta.success) return yield* failure(meta.error.message);
    const directory = yield* postDirectory(root, slug);
    // mkdir without recursive and wx both refuse existing paths, including symlinks.
    yield* attempt(`Cannot create post ${slug}`, () => mkdir(directory));
    const filename = path.join(directory, "index.md");
    const markdown = `---\ntitle: ${JSON.stringify(meta.data.title)}\nsummary: ${JSON.stringify(meta.data.summary)}\nstatus: draft\n---\n\n`;
    yield* attempt(`Cannot write ${filename}`, () =>
      writeFile(filename, markdown, { flag: "wx" }),
    );
    return filename;
  });
}

type ImageFormat = "webp" | "png";

function imageName(source: string, name: string | undefined, format: ImageFormat) {
  const candidate =
    name ??
    path
      .parse(source)
      .name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const extension = path.extname(candidate);
  const stem = extension ? candidate.slice(0, -extension.length) : candidate;
  if (!isSafeSlug(stem) || (extension && extension !== `.${format}`)) {
    return failure(`Use a lowercase kebab filename, optionally ending in .${format}`);
  }
  return Effect.succeed(`${stem}.${format}`);
}

function readSource(source: string) {
  return Effect.gen(function* () {
    // Resolve the chosen source's parent, including macOS /tmp and /var aliases.
    // The file itself must still be regular, and is opened with O_NOFOLLOW.
    const absolute = path.resolve(source);
    const parent = yield* attempt(`Cannot locate source ${source}`, () =>
      realpath(path.dirname(absolute)),
    );
    const filename = yield* regularPath(
      path.join(parent, path.basename(absolute)),
      "file",
    );
    return yield* Effect.acquireUseRelease(
      attempt(`Cannot open ${source}`, () =>
        open(filename, constants.O_RDONLY | constants.O_NOFOLLOW),
      ),
      (file) =>
        Effect.gen(function* () {
          const stat = yield* attempt(`Cannot inspect ${source}`, () => file.stat());
          if (!stat.isFile() || stat.size > 100 * 1024 * 1024) {
            return yield* failure(
              "Source must be a regular image file no larger than 100 MiB",
            );
          }
          return yield* attempt(`Cannot read ${source}`, () => file.readFile());
        }),
      (file) => Effect.promise(() => file.close()),
    );
  });
}

export function importImage(
  root: string,
  slug: string,
  source: string,
  options: { name?: string; format?: ImageFormat } = {},
) {
  return Effect.gen(function* () {
    const directory = yield* postDirectory(root, slug);
    yield* regularPath(path.join(directory, "index.md"), "file");
    const format = options.format ?? "webp";
    const name = yield* imageName(source, options.name, format);
    const input = yield* readSource(source);
    const image = yield* Effect.try({
      try: () => sharp(input, { limitInputPixels: 100_000_000, failOn: "warning" }),
      catch: (error) =>
        new PostError({
          message: `Cannot decode image: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
    const metadata = yield* attempt("Cannot decode image", () => image.metadata());
    if (
      !metadata.format ||
      !["jpeg", "png", "webp", "tiff", "heif", "avif"].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    ) {
      return yield* failure(
        "Use a single-frame raster image (JPEG, PNG, WebP, TIFF, or AVIF)",
      );
    }
    // Sharp strips EXIF, GPS and other metadata unless explicitly retained.
    const oriented = image.autoOrient();
    const output =
      format === "png"
        ? oriented.png({ compressionLevel: 9, palette: false })
        : oriented
            .resize({
              width: 1920,
              height: 1920,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 });
    const { data, info } = yield* attempt("Cannot optimize image", () =>
      output.toBuffer({ resolveWithObject: true }),
    );
    if (data.length > MAX_IMAGE_BYTES) {
      return yield* failure(
        "Optimized image exceeds 10 MiB; use WebP or a smaller source",
      );
    }
    // Recheck after encoding in case the post directory was moved while decoding.
    yield* regularPath(directory, "directory");
    const filename = path.join(directory, name);
    yield* attempt(`Cannot create ${filename}`, () =>
      writeFile(filename, data, { flag: "wx" }),
    );
    return { filename, width: info.width, height: info.height, bytes: data.length };
  });
}

const usage = `Usage:
  bun run post new <slug> --title <title> --summary <summary>
  bun run post image <slug> <source> [--name <filename>] [--format webp|png]

Creates drafts only. Existing output paths and symlinks inside posts are refused.
The source image must be a regular file, not a symlink.
WebP: oriented, metadata-free, quality 85, at most 1920 px per side, no upscaling.
PNG: oriented, metadata-free, lossless encoding at the original resolution.
Image sources are preserved; output must fit the site's 10 MiB limit.`;

export function runPost(args: string[], root = repositoryRoot) {
  return Effect.gen(function* () {
    if (
      args.length === 0 ||
      (args.length === 1 && ["--help", "-h"].includes(args[0]!))
    ) {
      return usage;
    }
    const command = args[0];
    if (command !== "new" && command !== "image") return yield* failure(usage);
    const parsed = yield* Effect.try({
      try: () =>
        parseArgs({
          args: args.slice(1),
          allowPositionals: true,
          strict: true,
          options:
            command === "new"
              ? { title: { type: "string" }, summary: { type: "string" } }
              : { name: { type: "string" }, format: { type: "string" } },
        }),
      catch: (error) =>
        new PostError({ message: error instanceof Error ? error.message : usage }),
    });
    const [slug, source] = parsed.positionals;
    if (!slug || parsed.positionals.length !== (command === "new" ? 1 : 2)) {
      return yield* failure(usage);
    }
    if (command === "new") {
      const { title, summary } = parsed.values;
      if (typeof title !== "string" || typeof summary !== "string") {
        return yield* failure("Both --title and --summary are required");
      }
      const filename = yield* createPost(root, slug, title, summary);
      return `Created draft: ${filename}`;
    }
    const { name, format = "webp" } = parsed.values;
    if (format !== "webp" && format !== "png")
      return yield* failure("Use --format webp or png");
    const result = yield* importImage(root, slug, source!, {
      ...(typeof name === "string" ? { name } : {}),
      format,
    });
    return `Created: ${result.filename}\n${result.width} × ${result.height}, ${result.bytes} bytes\nMarkdown: ![Describe the image](./${path.basename(result.filename)})`;
  });
}

if (import.meta.main) {
  await Effect.runPromise(
    runPost(process.argv.slice(2)).pipe(
      Effect.match({
        onSuccess: (message) => console.log(message),
        onFailure: (error) => {
          console.error(error.message);
          process.exitCode = 1;
        },
      }),
    ),
  );
}
