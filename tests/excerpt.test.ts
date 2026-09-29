import { expect, test } from "bun:test";
import { excerptHtml } from "../src/lib/excerpt";

test("excerpts end at a complete block and leave the remaining article out", () => {
  const html =
    "<p>One <em>complete</em> paragraph.</p>\n<h2>Next section</h2><p>Hidden ending.</p>";
  expect(excerptHtml(html, "/posts/example/", 3)).toEqual({
    html: "<p>One <em>complete</em> paragraph.</p>",
    truncated: true,
  });
});

test("short posts remain complete and a heading is never orphaned at the cutoff", () => {
  const html = "<p>One two.</p><h2>Three four</h2><p>Five six.</p>";
  expect(excerptHtml(html, "/posts/example/", 3)).toEqual({ html, truncated: false });
  expect(excerptHtml("<p>A short post.</p>\n", "/posts/example/").truncated).toBe(
    false,
  );
});

test("excerpt links reach omitted footnotes and preserve rendered image attributes", () => {
  const image =
    '<img __ASTRO_IMAGE_="{&quot;src&quot;:&quot;./image.png&quot;}" alt="An image">';
  const html = `<p>${image} See <a href="#footnote">the footnote</a>.</p><p id="footnote">More.</p>`;
  const excerpt = excerptHtml(html, "/posts/example/", 2);
  expect(excerpt.html).toContain(image);
  expect(excerpt.html).toContain('href="/posts/example/#footnote"');
  expect(excerpt.html).not.toContain('id="footnote"');
});

test("only real anchors are rebased; code examples keep their original text", () => {
  const html =
    '<p><code>&lt;a href="#section"&gt;Jump&lt;/a&gt;</code> <a href="#section">Jump</a></p><pre><code>&lt;a href="../older/"&gt;Example&lt;/a&gt;</code></pre>';
  const excerpt = excerptHtml(html, "/posts/example/");
  expect(excerpt.html).toContain(
    '<code>&lt;a href="#section"&gt;Jump&lt;/a&gt;</code>',
  );
  expect(excerpt.html).toContain('<a href="/posts/example/#section">Jump</a>');
  expect(excerpt.html).toContain(
    '<pre><code>&lt;a href="../older/"&gt;Example&lt;/a&gt;</code></pre>',
  );
});

test("relative links keep article destinations and escaped query values", () => {
  const html =
    '<p><a href="../older/">Previous</a><a href="./#later">Later</a><a href="?a=1&amp;b=2">Query</a><a href="/about/">About</a><a href="https://example.com/">External</a><a href="mailto:hi@example.com">Email</a></p>';
  const excerpt = excerptHtml(html, "/posts/example/");
  expect(excerpt.html).toContain('href="/posts/older/"');
  expect(excerpt.html).toContain('href="/posts/example/#later"');
  expect(excerpt.html).toContain('href="/posts/example/?a=1&amp;b=2"');
  expect(excerpt.html).toContain('href="/about/"');
  expect(excerpt.html).toContain('href="https://example.com/"');
  expect(excerpt.html).toContain('href="mailto:hi@example.com"');
});
