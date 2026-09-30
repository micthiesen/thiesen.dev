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
import { runInNewContext } from "node:vm";

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
  slug: string,
  marker: string,
): Promise<Set<string>> {
  const html = await readFile(path.join(dist, "posts", slug, "index.html"), "utf8");
  expect(html).toContain(marker);
  expect(html).toContain("Real static content");
  expect(html).toContain("astro-code");
  expect(html).toContain("useful");
  expect(html).toContain(`${marker}_FULL_ENDING`);
  expect(html).toContain(`https://example.com/${slug}-ending/`);
  const details = html.match(/<details>[\s\S]*?<\/details>/)?.[0];
  expect(details).toBeDefined();
  expect(details).toMatch(
    /<summary>Further details &(?:amp|#x26); evidence<\/summary>/,
  );
  expect(details).toContain("<strong>Expandable Markdown</strong>");
  expect(details).toContain('alt="A local image inside details"');
  expect(details).toContain('href="https://example.com/details/"');
  expect(html).not.toContain(":::details");
  assertFooterNavigation(html);
  const canonical = `${origin}/posts/${slug}/`;
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((match) =>
    attributes(match[0]),
  );
  expect(links.find((link) => link["rel"] === "canonical")?.["href"]).toBe(canonical);
  assertAnalytics(html);
  const allScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  expect(allScripts).toHaveLength(2);
  const scripts = allScripts.filter(
    (match) => attributes(match[1] ?? "")["type"] === "application/ld+json",
  );
  expect(scripts).toHaveLength(1);
  expect(attributes(scripts[0]![1] ?? "")["type"]).toBe("application/ld+json");
  expect(JSON.parse(scripts[0]![2]!)).toMatchObject({
    "@type": "BlogPosting",
    headline: marker,
    url: canonical,
  });
  return assertRenderedImages(dist, html);
}

function assertAnalytics(html: string): void {
  const bootstraps = [
    ...html.matchAll(
      /<script\b[^>]*data-cloudflare-analytics[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  expect(bootstraps).toHaveLength(1);
  for (const hostname of [
    "thiesen.dev",
    "localhost",
    "127.0.0.1",
    "thiesen-dev-pr-1.workers.dev",
    "thiesen.dev.example.com",
  ]) {
    const appended: { type?: string; src?: string; dataset: Record<string, string> }[] =
      [];
    runInNewContext(bootstraps[0]![1]!, {
      window: { location: { hostname } },
      document: {
        createElement: (tag: string) => {
          expect(tag).toBe("script");
          return { dataset: {} };
        },
        body: {
          appendChild: (script: (typeof appended)[number]) => appended.push(script),
        },
      },
    });
    expect(appended).toHaveLength(hostname === "thiesen.dev" ? 1 : 0);
    if (appended[0]) {
      expect(appended[0].type).toBe("module");
      expect(appended[0].src).toBe(
        "https://static.cloudflareinsights.com/beacon.min.js",
      );
      expect(JSON.parse(appended[0].dataset["cfBeacon"]!)).toEqual({
        token: "5935ea3b388e4b37b4d5ac330b675e50",
      });
    }
  }
}

function assertFooterNavigation(html: string): void {
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
  expect(footer).toBeDefined();
  expect(footer).toContain("<nav");
  expect(html.replace(footer!, "")).not.toMatch(/<nav\b/);
}

async function assertRenderedImages(dist: string, html: string): Promise<Set<string>> {
  expect(html).not.toContain("__ASTRO_IMAGE_");
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

test("production builds a latest-post excerpt, archive, and complete posts without private or stale media", async () => {
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
        slug: "older-post",
        status: "published",
        date: "2020-02-29",
        marker: "OLDER_POST_FIXTURE",
      },
      {
        slug: "latest-post",
        status: "published",
        date: "2020-03-01",
        marker: "LATEST_POST_FIXTURE",
      },
      {
        slug: "private-draft",
        status: "draft",
        date: undefined,
        marker: "PRIVATE_DRAFT_FIXTURE",
      },
      {
        slug: "future-post",
        status: "published",
        date: "2099-01-01",
        marker: "FUTURE_POST_FIXTURE",
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
          "",
          Array.from({ length: 340 }, (_, word) => `word${word}`).join(" "),
          "",
          `${fixture.marker}_FULL_ENDING`,
          "",
          `[Hidden ending link](https://example.com/${fixture.slug}-ending/)`,
          "",
          ":::details[Further details & evidence]",
          "",
          "**Expandable Markdown** and [a source](https://example.com/details/).",
          "",
          `![A local image inside details](./${body})`,
          "",
          ":::",
        ].join("\n"),
      );
    }

    await build(scratch);
    const dist = path.join(scratch, "dist");
    expect(await readFile(path.join(dist, "404.html"), "utf8")).not.toContain(
      "data-cloudflare-analytics",
    );
    const olderAssets = await assertPublishedPage(
      dist,
      "older-post",
      "OLDER_POST_FIXTURE",
    );
    await assertPublishedPage(dist, "latest-post", "LATEST_POST_FIXTURE");
    const home = await readFile(path.join(dist, "index.html"), "utf8");
    assertAnalytics(home);
    expect(home).toContain("LATEST_POST_FIXTURE");
    expect(home).toContain("Real static content");
    expect(home).toContain("astro-code");
    expect(home).toContain("useful");
    expect(home).toContain("word339");
    expect(home).not.toContain("OLDER_POST_FIXTURE");
    expect(home).not.toContain("older-post");
    expect(home).not.toContain("LATEST_POST_FIXTURE_FULL_ENDING");
    expect(home).not.toContain("https://example.com/latest-post-ending/");
    expect(home).not.toContain("Hidden ending link");
    expect(home).not.toContain("<details>");
    const readMore = [...home.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter(
      (match) => /Read more/.test(match[2]!),
    );
    expect(readMore).toHaveLength(1);
    expect(attributes(readMore[0]![1]!)["href"]).toBe("/posts/latest-post/");
    assertFooterNavigation(home);
    await assertRenderedImages(dist, home);
    const archive = await readFile(path.join(dist, "archive/index.html"), "utf8");
    assertAnalytics(archive);
    assertAnalytics(await readFile(path.join(dist, "about/index.html"), "utf8"));
    assertFooterNavigation(archive);
    const feed = await readFile(path.join(dist, "feed.xml"), "utf8");
    const sitemap = await readFile(path.join(dist, "sitemap-0.xml"), "utf8");
    for (const [slug, marker] of [
      ["older-post", "OLDER_POST_FIXTURE"],
      ["latest-post", "LATEST_POST_FIXTURE"],
    ]) {
      expect(archive).toContain(marker!);
      expect(archive).toContain(`href="/posts/${slug}/"`);
      expect(feed).toContain(marker!);
      expect(feed).toContain(`${origin}/posts/${slug}/`);
      expect(sitemap).toContain(`${origin}/posts/${slug}/`);
    }
    const unpublished = [
      "private-draft",
      "future-post",
      "PRIVATE_DRAFT_FIXTURE",
      "FUTURE_POST_FIXTURE",
    ];
    await assertAbsent(dist, unpublished);

    const olderFile = path.join(posts, "older-post/index.md");
    await writeFile(
      olderFile,
      (await readFile(olderFile, "utf8")).replace("status: published", "status: draft"),
    );
    await build(scratch);
    await assertPublishedPage(dist, "latest-post", "LATEST_POST_FIXTURE");
    await assertAbsent(dist, [...unpublished, "older-post", "OLDER_POST_FIXTURE"]);
    const remaining = new Set(await files(dist));
    for (const asset of olderAssets) expect(remaining.has(asset)).toBe(false);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}, 30_000);
