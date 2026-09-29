# thiesen.dev

A Git-backed publication for Michael Thiesen's projects and notes. Astro 7 builds
plain Markdown into static pages, with Solid available for interactive islands.
Alchemy deploys the site to Cloudflare Workers Static Assets at
[thiesen.dev](https://thiesen.dev).

```sh
bun install
bun run dev
```

Open `http://localhost:4321`. The example project and note are drafts, visible
only in development. Production builds exclude drafts and future-dated posts.
No environment variables or secrets are needed to develop or build.

```sh
bun run verify   # formatting, lint, content, types, tests, production build
bun run start    # serve dist/ locally after a build
```

Use Bun 1.3.11 and Node 24.18.0 (version files are included). Bun manages packages
and tests; Astro's CLI runs under Node. Read [AGENTS.md](AGENTS.md) for the exact
editing gate and [the content contract](src/content/AGENTS.md) before writing.

The scaffold includes typed content, static project/note routes, automatic CSS
themes, a self-hosted serif font, Shiki code highlighting, RSS, sitemap, metadata,
Alchemy infrastructure, and GitHub Actions. Effect is the default for TypeScript
logic and tooling. Normal pages ship no site JavaScript. Solid is configured but
no island is hydrated without a use case.

See [setup decisions and next phases](docs/setup.md) for what is implemented and
deployment details. The full [KaraKeep rebuild specification](docs/rebuild-specification.md)
is preserved as the design brief. Rich content directives, Vega charts, and the
content-scoped MCP publisher are subsequent implementation work.
