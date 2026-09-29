# thiesen.dev

Michael Thiesen's Git-backed static publication: projects and notes, built with
Astro 7, plain Markdown, and optional Solid islands. The design brief is
`docs/rebuild-specification.md`; implemented scope and remaining phases are in
`docs/setup.md`.

## Architecture

- `src/content/posts/<slug>/index.md`: posts and co-located image assets.
- `packages/content-core/`: shared Zod schema, URLs, publication rules, validation.
- `src/content.config.ts`: Astro collection using that same schema.
- `src/pages/`, `src/layouts/`, `src/components/`: static rendering and navigation.
- `src/styles/global.css`: typography, layout, automatic light/dark themes.
- `tools/content-check.ts`: authoring validation CLI; `tests/`: Bun tests.
- `wrangler.jsonc`: Cloudflare Workers Static Assets, no server adapter.

## Development and verification

Use Bun 1.3.11 as package manager and test runner; Node 24 runs Astro's CLI.
There is an Astro build step because the output is static HTML and optimized
assets. `bun run dev` serves local drafts on localhost; `bun run start` serves
the production build. No secrets are required locally.

Astro 7 auto-backgrounds servers in agent sessions. Check/stop your own server
with `bunx astro dev status` / `bunx astro dev stop` (or `astro preview` for
production previews). For a supervised smoke test with no existing server, use
`--ignore-lock` to keep it in the foreground and verify SIGTERM shutdown.

After changes, run the complete gate:

```sh
bun run check:write
bun run typecheck
bun test
bun run build
```

`bun run verify` is the read-only-formatting CI equivalent. Astro checks templates
and content types; Oxlint checks TypeScript; Oxfmt formats supported source files;
Prettier's Astro plugin formats `.astro` files. TypeScript 6 is intentional while
`@astrojs/check` supports only versions 5 and 6. The shared mitools TypeScript
config is extended with Astro's strictest config; mitools is a development-only
dependency. No service, scheduler, notification hook, or Effect runtime is needed
for a static site. Test preload strips provider credentials.

## Boundaries

- Keep modules small and strongly typed. No debug leftovers or speculative layers.
- Content rules live in `src/content/AGENTS.md`. Reuse `content-core` in any future
  publisher; never introduce another schema or a generic repository-write MCP tool.
- Draft and future-dated posts must be absent from production routes, lists, RSS,
  and sitemap. Dev previews must be labeled and noindex.
- Astro renders normal pages. Solid requires actual client-side interaction and a
  useful static fallback. See `src/components/interactive/AGENTS.md`.
- Preserve stable media dimensions, serif reading typography, automatic CSS themes,
  keyboard navigation, and reduced-motion preferences. No scroll-entry animation.
- No MDX, CMS, database, React, Tailwind, or runtime article API. Add dependencies
  only for implemented behavior. Rich Markdown directives are a later phase.

## Delivery and conventions

Completed work is authorized to be committed and pushed. Preserve concurrent
edits, use a feature branch, and open a draft PR. Michael merges to `main`; merging
will publish once Cloudflare Workers Builds is connected. Do not switch an
existing PR's draft state or change hosted deployment settings without the
applicable authorization. The initial setup does not deploy or move the domain.

Use maintained siblings `../condo`, `../omni-notify`, and `../mitools` for evolving
tooling conventions, while keeping this site's static architecture. Their current
Oxlint/Oxfmt conventions supersede the setup skill's older Biome default.
Update these living instructions when a durable project convention changes.
