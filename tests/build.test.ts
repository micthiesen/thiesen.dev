import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const repository = fileURLToPath(new URL("../", import.meta.url));
const origin = "https://thiesen.dev";

function crc32(bytes: Buffer): number {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

/** Small valid images with distinct pixels prevent optimizer deduplication. */
function png(red: number, green: number): Buffer {
  function chunk(name: string, data: Buffer): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(data.length);
    header.write(name, 4, "ascii");
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name), data])));
    return Buffer.concat([header, data, checksum]);
  }
  const dimensions = Buffer.alloc(13);
  dimensions.writeUInt32BE(2, 0);
  dimensions.writeUInt32BE(1, 4);
  dimensions[8] = 8;
  dimensions[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", dimensions),
    chunk("IDAT", deflateSync(Buffer.from([0, red, green, 0, red, green, 0]))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function build(directory: string): Promise<void> {
  const child = spawn("bun", ["run", "build"], {
    cwd: directory,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      PATH: process.env["PATH"],
      HOME: process.env["HOME"],
      TMPDIR: os.tmpdir(),
      // The public build must remain public even when called from a dev environment.
      NODE_ENV: "development",
      ASTRO_TELEMETRY_DISABLED: "1",
      DO_NOT_TRACK: "1",
      CI: "1",
    },
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid) process.kill(-child.pid, "SIGKILL");
  }, 12_000);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0 && !timedOut) resolve();
        else
          reject(
            new Error(
              `Scratch build ${timedOut ? "timed out" : `exited ${code}`}\n${output}`,
            ),
          );
      });
    });
  } finally {
    clearTimeout(timer);
  }
}

async function files(directory: string, prefix = ""): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory())
      result.push(...(await files(path.join(directory, entry.name), relative)));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1]!, match[2]!]),
  );
}

async function assertPublishedPage(
  dist: string,
  section: string,
  slug: string,
  marker: string,
): Promise<Set<string>> {
  const html = await readFile(path.join(dist, section, slug, "index.html"), "utf8");
  expect(html).toContain(marker);
  expect(html).toContain("Real static content");
  expect(html).toContain("astro-code");
  expect(html).toContain("useful");
  const canonical = `${origin}/${section}/${slug}/`;
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) =>
    attributes(match[0]),
  );
  expect(links.find((link) => link["rel"] === "canonical")?.["href"]).toBe(canonical);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  expect(attributes(scripts[0]![1] ?? "")["type"]).toBe("application/ld+json");
  expect(JSON.parse(scripts[0]![2]!)).toMatchObject({
    "@type": "BlogPosting",
    headline: marker,
    url: canonical,
  });
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) =>
    attributes(match[0]),
  );
  expect(images.length).toBeGreaterThanOrEqual(2);
  const assets = new Set<string>();
  for (const image of images) {
    expect(Number(image["width"])).toBeGreaterThan(0);
    expect(Number(image["height"])).toBeGreaterThan(0);
    expect(image["alt"]?.trim()).toBeTruthy();
    const urls = [
      image["src"]!,
      ...(image["srcset"]?.split(",").map((part) => part.trim().split(/\s+/)[0]!) ??
        []),
    ];
    for (const url of urls) {
      const asset = decodeURIComponent(new URL(url, origin).pathname).slice(1);
      expect(asset).toStartWith("_astro/");
      expect((await readFile(path.join(dist, asset))).length).toBeGreaterThan(0);
      assets.add(asset);
    }
  }
  return assets;
}

async function assertAbsent(dist: string, forbidden: string[]): Promise<void> {
  for (const file of await files(dist)) {
    for (const marker of forbidden) expect(file).not.toContain(marker);
    if (/\.(?:html|xml|js|json|css|txt)$/.test(file)) {
      const content = await readFile(path.join(dist, file), "utf8");
      for (const marker of forbidden) expect(content).not.toContain(marker);
    }
  }
}

test("production builds publish complete posts without draft, future, or stale media", async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "thiesen-build-test-"));
  try {
    // Explicit inputs keep repository history, tests, documentation, and .env files out.
    for (const entry of [
      "src",
      "public",
      "packages",
      "tools",
      "package.json",
      "astro.config.ts",
      "tsconfig.json",
    ]) {
      await cp(path.join(repository, entry), path.join(scratch, entry), {
        recursive: true,
        filter: (source) =>
          !path
            .relative(repository, source)
            .split(path.sep)
            .some(
              (part) =>
                part.startsWith(".env") ||
                [".git", "secrets", "tests", "docs"].includes(part),
            ),
      });
    }
    await symlink(
      path.join(repository, "node_modules"),
      path.join(scratch, "node_modules"),
      "dir",
    );
    const posts = path.join(scratch, "src/content/posts");
    await rm(posts, { recursive: true, force: true });
    await mkdir(posts, { recursive: true });
    const fixtures = [
      {
        slug: "public-project",
        kind: "project",
        status: "published",
        date: "2020-02-29",
        marker: "PUBLIC_PROJECT_FIXTURE",
      },
      {
        slug: "public-note",
        kind: "note",
        status: "published",
        date: "2020-03-01",
        marker: "PUBLIC_NOTE_FIXTURE",
      },
      {
        slug: "private-draft",
        kind: "note",
        status: "draft",
        date: undefined,
        marker: "PRIVATE_DRAFT_FIXTURE",
      },
      {
        slug: "future-note",
        kind: "note",
        status: "published",
        date: "2099-01-01",
        marker: "FUTURE_NOTE_FIXTURE",
      },
    ];
    for (const [index, fixture] of fixtures.entries()) {
      const directory = path.join(posts, fixture.slug);
      await mkdir(directory);
      const hero = `${fixture.slug} hero.PnG`;
      const body = `${fixture.slug}-body.png`;
      await writeFile(path.join(directory, hero), png(30 + index * 40, 40));
      await writeFile(path.join(directory, body), png(30 + index * 40, 180));
      await writeFile(
        path.join(directory, "index.md"),
        [
          "---",
          `title: ${fixture.marker}`,
          "summary: Fixture rendering verification",
          `kind: ${fixture.kind}`,
          `status: ${fixture.status}`,
          ...(fixture.date ? [`publishedAt: ${fixture.date}`] : []),
          "hero:",
          `  src: ././${encodeURIComponent(hero)}`,
          "  alt: Two pixels used to verify hero rendering",
          "---",
          "",
          "## Real static content",
          "",
          fixture.marker,
          "",
          `![Two pixels used to verify Markdown rendering](./${body})`,
          "",
          "```ts",
          "const useful = true;",
          "```",
        ].join("\n"),
      );
    }

    await build(scratch);
    const dist = path.join(scratch, "dist");
    const projectAssets = await assertPublishedPage(
      dist,
      "projects",
      "public-project",
      "PUBLIC_PROJECT_FIXTURE",
    );
    await assertPublishedPage(dist, "notes", "public-note", "PUBLIC_NOTE_FIXTURE");
    const feed = await readFile(path.join(dist, "feed.xml"), "utf8");
    const sitemap = await readFile(path.join(dist, "sitemap-0.xml"), "utf8");
    for (const [section, slug, marker] of [
      ["projects", "public-project", "PUBLIC_PROJECT_FIXTURE"],
      ["notes", "public-note", "PUBLIC_NOTE_FIXTURE"],
    ]) {
      expect(feed).toContain(marker!);
      expect(feed).toContain(`${origin}/${section}/${slug}/`);
      expect(sitemap).toContain(`${origin}/${section}/${slug}/`);
    }
    const unpublished = [
      "private-draft",
      "future-note",
      "PRIVATE_DRAFT_FIXTURE",
      "FUTURE_NOTE_FIXTURE",
    ];
    await assertAbsent(dist, unpublished);

    const projectFile = path.join(posts, "public-project/index.md");
    await writeFile(
      projectFile,
      (await readFile(projectFile, "utf8")).replace(
        "status: published",
        "status: draft",
      ),
    );
    await build(scratch);
    await assertPublishedPage(dist, "notes", "public-note", "PUBLIC_NOTE_FIXTURE");
    await assertAbsent(dist, [
      ...unpublished,
      "public-project",
      "PUBLIC_PROJECT_FIXTURE",
    ]);
    const remaining = new Set(await files(dist));
    for (const asset of projectAssets) expect(remaining.has(asset)).toBe(false);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}, 30_000);
