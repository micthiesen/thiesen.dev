# thiesen.dev

A Git-backed publication for Michael Thiesen's writing. Astro 7 builds
plain Markdown into static pages, with Solid available for interactive islands.
Alchemy deploys the site to Cloudflare Workers Static Assets at
[thiesen.dev](https://thiesen.dev).

```sh
bun install
bun run dev
```

Open `http://localhost:4321`. The reading sample and authoring examples are drafts,
visible only in development. Production builds exclude drafts and future-dated posts.
No environment variables or secrets are needed to develop or build.

```sh
bun run verify   # formatting, lint, content, types, tests, production build
bun run start    # serve dist/ locally after a build
```

Use Bun 1.3.11 and Node 24.18.0 (version files are included). Bun manages packages
and tests; Astro's CLI runs under Node. Read [AGENTS.md](AGENTS.md) for the exact
editing gate and [the content contract](src/content/AGENTS.md) before writing.

Use the global `$post` skill from any project directory to draft or revise a
post in this checkout. It opens a local preview for approval, then publishes the
approved revision with a direct push to `main`. No post PR or CI wait is needed.
The repository also includes two authoring helpers:

```sh
bun run post new my-post --title 'A specific title' --summary 'One factual sentence.'
bun run post image my-post /path/to/photo.jpg --name photo
bun run post image my-post /path/to/diagram.png --name diagram --format png
```

The image helper preserves its source, auto-orients, strips metadata, and refuses
overwrites. WebP output fits within 1920px without upscaling; lossless PNG keeps
the original resolution. Both must fit the content contract's 10 MiB limit.
Use `bun run dev --background` for an Astro-managed draft preview and
`bunx --no-install astro dev status` to inspect its URL. Keep the preview running
while reviewing. Open the full `/posts/<slug>/` URL, not just its homepage excerpt.

The scaffold includes typed content, a latest-post homepage, one archive, static
post routes, footer-only navigation, automatic CSS
themes, a self-hosted serif font, Shiki code highlighting, RSS, sitemap, metadata,
Alchemy infrastructure, and GitHub Actions. Effect is the default for TypeScript
logic and tooling. Normal pages ship no site JavaScript. Solid is configured but
no island is hydrated without a use case.

See [the reading-first design](docs/design.md) and
[setup decisions and next phases](docs/setup.md) for what is implemented and
deployment details. The full [KaraKeep rebuild specification](docs/rebuild-specification.md)
is preserved as the design brief. Rich content directives, Vega charts, and the
content-scoped MCP publisher are subsequent implementation work.
