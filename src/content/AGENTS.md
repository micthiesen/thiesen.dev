# Writing for thiesen.dev

Use `posts/<lowercase-kebab-slug>/index.md`; keep assets beside the post.
Use plain Markdown. Required metadata is `title`, `summary`, and `kind`
(`project` or `note`). `status` defaults to `draft`. To publish, set
`status: published` and a valid `publishedAt: YYYY-MM-DD`. Future dates stay
hidden until a later build. Drafts appear only in local development.

Optional fields: `updatedAt`, `tags`, `featured`, `canonical`, `hero: {src, alt}`,
and `project: {github, demo, status, startedAt, endedAt}`. Slugs come from directory
names. Include `project.github` when a repository exists. Do not invent fields.

Use normal headings, links, lists, quotes, tables, and fenced code. Local images
must be PNG, JPEG, or WebP, at most 10 MiB, with meaningful alt text. Use a relative
path such as `./screenshot.png`. Never use symlinks or references outside the post.
Astro supplies optimized output and intrinsic dimensions.

Raw HTML, MDX, remote images, unsafe URLs, and inline executable content are
rejected. `figure`, `gallery`, `callout`, and `vega-lite` are planned in the design
brief but not implemented by this scaffold; validation rejects them for now.

Write in first person, explain decisions directly, and ground technical claims
in the project. No invented accomplishments, marketing language, or generic AI
enthusiasm. The two example posts are drafts, not published work.

Run `bun run verify` before opening a content PR. Never merge or publish solely
because a draft was requested. Preserve permanent URLs; a slug change needs an
explicit permanent redirect. Chat publishing must eventually use scoped GitHub
App tools with expected commit SHAs and idempotency keys.
