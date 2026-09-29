# Setup decisions

This is the runnable foundation for the rebuild specification, not completion of
its agent publishing workflow. The existing production site and domain are unchanged.

## Included

- Astro 7 static output; Solid integration ready for justified islands.
- Shared `content-core` Zod schema, publication rules, safe URLs, Markdown and
  local media validation. Frontmatter dates accept quoted or unquoted ISO dates.
- Draft project and note examples, shown only by `bun run dev`. Production
  builds, feeds, and sitemap omit drafts and future publication dates. The loader
  excludes them before Astro renders assets, so unpublished images are omitted
  too. The build script pins production mode even in a development environment.
- Home, projects, notes, about, post, and 404 layouts; serif typography,
  automatic light/dark CSS, self-hosted Source Serif 4, reserved image dimensions,
  build-time code highlighting, canonical/OG text metadata, article JSON-LD.
- RSS summaries, sitemap, robots.txt, static security headers, Workers asset config.
- CI jobs named `content-validation` and `build`.

## Tooling choices

The setup skill's Bun baseline is retained for package management and tests.
Astro supplies the static build and local server; a Bun application server would
add no value here. Current sibling conventions (`condo`, `omni-notify`, `mitools`)
use Oxlint/Oxfmt, so this project follows those instead of introducing Biome.
Astro files additionally use its official Prettier plugin.

`@micthiesen/mitools` is used only for the shared TypeScript base configuration,
with Astro's strictest config layered on top. Runtime service helpers do not
belong in the static publication. TypeScript is pinned to 6.0.3 because
`@astrojs/check` 0.9.10 declares support for versions 5 and 6. Check compatibility
before adopting the siblings' TypeScript 7.

The initial UI uses ordinary document navigation, which preserves zero site JS.
View transitions can be added after visual comparison shows a benefit. Automatic
theme detection and reduced-motion behavior are CSS-only.

## Connect deployment

The scaffold does not create a Worker, change DNS, or configure GitHub settings.

1. Connect `micthiesen/thiesen.dev` in Cloudflare Workers Builds, Worker name
   `thiesen-dev`, production branch `main`.
2. Install with `bun install --frozen-lockfile`, build with `bun run verify`,
   and deploy with `bunx wrangler deploy`. Match `.bun-version` and `.node-version`
   in the build environment. Use `bunx wrangler versions upload` for preview
   branches and review their generated URLs before merging.
3. Configure a GitHub ruleset requiring PRs and checks `content-validation` and
   `build`. Run the first PR so GitHub can discover those check names.
4. Once the static site has real content and is accepted, attach `thiesen.dev`
   as a custom domain and review its current hosting/DNS before cutover.

No deployment secrets belong in the repository. Workers Builds manages its
deployment token; local deployment can use Wrangler login. `bun run deploy`
validates before invoking Wrangler but must only be run for an authorized deploy.

## Next phases

1. Implement and test the owned `figure`, `gallery`, and `callout` transformations.
   Add code titles/highlighted lines and an optional copy interaction. Validation
   currently rejects those unsupported directives instead of rendering them badly.
2. Compile validated Vega-Lite JSON into static SVG with bounded data, disabled
   remote fetching, accessible text, and explicit dimensions. Add Solid only for
   deliberate interactive enhancements. Charts are not a current dependency.
3. Add real project writing/screenshots, a raster social preview image, polished
   wide figures, and visual QA at desktop/mobile widths in both themes and with
   JavaScript disabled. Measure CLS/LCP on a deployed preview.
4. Build a content-scoped publisher using this same `content-core` module. Use a
   GitHub App installed only on this repository: Contents write, Pull requests
   write, Metadata read; no Workflows or Administration permission. Validate
   asset bytes/MIME, enforce writes under `src/content/posts/**`, use idempotency
   keys and expected commit SHAs, and open draft PRs. Never give chat agents a
   generic file-write or merge tool.
5. Connect the publisher to Executor, then verify the complete draft, preview,
   review, and merge workflow in the specification.

Scheduled publication depends on a new static build after the date arrives;
there is no runtime scheduler. Add a timed build only if scheduling is wanted.

Until the first post is published, Astro reports an empty collection during the
production build. This is expected with only the two draft examples checked in.

## Source references

- [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro Solid integration](https://docs.astro.build/en/guides/integrations-guide/solid-js/)
- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
