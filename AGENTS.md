# thiesen.dev

Michael Thiesen's Git-backed static publication: one chronological post stream, built with
Astro 7, plain Markdown, and optional Solid islands. The design brief is
`docs/rebuild-specification.md`; implemented scope and remaining phases are in
`docs/setup.md`. The current reading-first design is in `docs/design.md` and
supersedes the original brief's categories and navigation.

## Architecture

- `src/content/posts/<slug>/index.md`: posts and co-located image assets.
- `packages/content-core/`: shared Zod schema, URLs, publication rules, validation.
- `src/content.config.ts`: Astro collection using that same schema.
- `src/pages/`, `src/layouts/`, `src/components/`: static rendering and navigation.
- `src/styles/global.css`: typography, layout, automatic light/dark themes.
- `tools/content-check.ts`: authoring validation CLI; `tests/`: Bun tests.
- `alchemy.run.ts`: Alchemy-managed Cloudflare Workers Static Assets and shared state.

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
dependency. Effect is used by deployment tooling; the generated publication is
still static. Test preload strips provider credentials. Infrastructure tests
compile real Alchemy plans against in-memory state with network access blocked.

Alchemy is pinned to `2.0.0-beta.79` and Effect to `4.0.0-rc.115`. Keep the
`@effect/*` dependency overrides aligned: rc.118 moved modules that this Alchemy
release still imports. Upgrade this set together and run the infrastructure test
and `bunx --no-install alchemy --help` after upgrades.

## Boundaries

- Keep modules small and strongly typed. No debug leftovers or speculative layers.
- Prefer Effect wherever usable in TypeScript: composition, asynchronous work,
  resource lifetimes, typed failures, configuration, and schemas. Use Effect Schema
  for new validation contracts. Keep framework-required adapters small: the
  existing shared Zod post schema feeds Astro's content collection. Do not add
  a competing schema for those posts. Keep Effect out of browser bundles unless
  a concrete client feature needs it.
- Content rules live in `src/content/AGENTS.md`. Reuse `content-core` in any future
  publisher; never introduce another schema or a generic repository-write MCP tool.
- Draft and future-dated posts must be absent from production routes, lists, RSS,
  and sitemap. Dev previews must be noindex; do not add a visible preview label.
- Astro renders normal pages. Solid requires actual client-side interaction and a
  useful static fallback. See `src/components/interactive/AGENTS.md`.
- Preserve stable media dimensions, serif reading typography, automatic CSS themes,
  keyboard navigation, and reduced-motion preferences. No scroll-entry animation.
- No MDX, CMS, database, React, Tailwind, or runtime article API. Add dependencies
  only for implemented behavior. The only Markdown directive is a top-level
  `:::details[Summary]` section; `content-core` shares its validation and native
  HTML rendering contract. Other rich directives remain a later phase.
- One post type at `/posts/<slug>/`; no categories, tags, featured flags, or
  project metadata. The homepage renders the latest post's body, with a complete
  block excerpt for longer articles. Site navigation belongs only in the footer.
  No promotional hero, eyebrows, or introductory copy outside About.
- Keep excerpt generation on the server. Preserve rendered HTML and Astro image
  references; remove omitted content instead of leaving hidden keyboard targets.
  The HTML parser is a build dependency and never enters the browser bundle.

## Delivery and conventions

For posts, create or revise a local draft and open its preview for Michael.
Publish only after he approves the current revision, then commit the approved
post and its required assets directly to `main` and push. No PR is required for
posts. Do not wait for or poll CI after pushing; report deployment as pending
unless verified live. Keep other drafts and concurrent edits out of the commit.
The global `$post` skill in dotfiles owns this authoring workflow and uses this
repository's helpers and content contract.

For other site work, work on `main`. Completed, reviewed, and locally verified
changes are authorized to be committed and pushed directly to `main`, without
a PR or another approval request. Preserve concurrent edits and commit only the
scoped result. On a clean checkout, pull with `git pull --ff-only` before starting;
if the remote moves, integrate safely without discarding edits or force-pushing.
Inspect outgoing commits so unapproved posts and unrelated work are not published.
Pushes to `main` deploy production after CI validation. Use a branch or PR only
when Michael explicitly requests one. Alchemy CI credentials are configured and
`ALCHEMY_DEPLOY_ENABLED=true`; same-repository PRs deploy their preview stage.
Do not switch an existing PR's draft state or change hosted deployment settings without the
applicable authorization. The `prod` stage owns `thiesen.dev` and redirects
`www.thiesen.dev` to it; other stages must never attach those hostnames.
The `prod` stage and `pr-<number>` previews have separate resources and shared
remote state. Never use local state for CI or cancel an Alchemy apply midway.
Keep `memo: false` so publication dates are reevaluated on every deployment.
Domain rollback requires explicit detachment (`domain: null`) and restoring the
previous DNS records; simply omitting `domain` leaves its attachments unmanaged.
Use the official `cf` CLI for Cloudflare inspection, authentication, and one-time
DNS migration operations. Discover commands with `cf cli search` and inspect their
schemas before mutations. Alchemy remains the source of truth for this site's
Worker, domains, redirects, and state; do not add a second `cloudflare.config.ts`
or deploy the same resources through `cf deploy`.

Use maintained siblings `../condo`, `../omni-notify`, and `../mitools` for evolving
tooling conventions, while keeping this site's static architecture. Their current
Oxlint/Oxfmt conventions supersede the setup skill's older Biome default.
Update these living instructions when a durable project convention changes.
