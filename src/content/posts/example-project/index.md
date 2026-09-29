---
title: "A place for projects and notes"
summary: "A draft example showing the structure of a project write-up."
status: draft
---

This is an authoring example, visible only during local development. Replace it
with a verified project write-up before publishing.

## What it does

The site turns Markdown files into static HTML. Each post lives in its own
directory, next to the screenshots and data it needs.

## How it works

The content schema validates metadata before Astro builds the site:

```ts
const post = postSchema.parse(frontmatter);
```

Production pages, RSS, and the sitemap include only published posts whose
publication date has arrived. Drafts stay out of the generated site.

## Next steps

Add the motivation, implementation details, screenshots, and results for the
project being described. Keep technical claims tied to evidence.
