# Writing for thiesen.dev

Use `posts/<lowercase-kebab-slug>/index.md`; keep assets beside the post.
Use plain Markdown. Required metadata is `title` and `summary`.
`status` defaults to `draft`. To publish, set
`status: published` and a valid `publishedAt: YYYY-MM-DD`. Future dates stay
hidden until a later build. Drafts appear only in local development.

Optional fields: `publishedAt`, `updatedAt`, `canonical`, and `hero: {src, alt}`.
All writing belongs to one post stream, with URLs at `/posts/<slug>/`; slugs come
from directory names. There are no categories, tags, featured posts, or separate
project metadata. Put repository and demo links in the Markdown body. Do not invent
fields.

Use normal headings, links, lists, quotes, tables, and fenced code. Local images
must be PNG, JPEG, or WebP, at most 10 MiB, with meaningful alt text. Use a relative
path such as `./screenshot.png`. Never use symlinks or references outside the post.
Astro supplies optimized output and intrinsic dimensions.

For optional technical detail, use a top-level expandable section:

```markdown
:::details[How the controller works]

Normal Markdown goes here, including lists, code, links, and local images.

:::
```

Use a nonempty plain-text summary and close each section. Sections start closed
and work without JavaScript. Attributes, formatted summaries, empty sections,
and nested directives are rejected. Keep the main story outside these sections.

Raw HTML, MDX, remote images, unsafe URLs, and inline executable content are
rejected, including inside expandable sections. All other directives are rejected.
`figure`, `gallery`, `callout`, and `vega-lite` remain unimplemented.

Use first person for Michael's supported actions, decisions, and opinions; explain
researched material directly without inventing a personal experience. Ground
technical claims in the project. No invented accomplishments, marketing language,
or generic AI enthusiasm. The checked-in samples are drafts, not published work.

Run `bun run verify` before publishing. Preview locally and wait for Michael to
approve the current revision, then commit the approved post and its assets
directly to `main` and push, without a PR or waiting for CI. A request to draft
does not authorize publication. Preserve permanent URLs; a slug change needs an
explicit permanent redirect. A future remote publisher must use scoped GitHub
App tools with expected commit SHAs and idempotency keys.
