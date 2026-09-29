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
- RSS summaries, sitemap, robots.txt, static security headers, Alchemy infrastructure.
- CI jobs named `content-validation` and `build`, followed by credential-gated
  deployment; closed PRs clean up their previews.

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

Prefer Effect for TypeScript logic, asynchronous work, typed errors, resource
lifetimes, and schemas where usable. New validation contracts should use Effect
Schema. The existing shared post schema remains the single Zod contract used by
Astro content collections. The publishing service should reuse that boundary.
Effect belongs in tooling and services; ordinary static pages still ship no JS.

Alchemy `2.0.0-beta.79`, Effect `4.0.0-rc.115`, and the Bun/Node platform packages
are pinned development dependencies. The `@effect/*` overrides also pin transitive
packages to rc.115: rc.118 moves APIs such as `effect/unstable/cli/Command`, which
breaks this Alchemy release. Upgrade them together after verifying the CLI and
infrastructure test. Both platform packages are required because the Cloudflare
provider also imports its Node bridge when invoked through Bun.

The initial UI uses ordinary document navigation, which preserves zero site JS.
View transitions can be added after visual comparison shows a benefit. Automatic
theme detection and reduced-motion behavior are CSS-only.

## Connect deployment

`alchemy.run.ts` is the deployment source of truth. `Cloudflare.Website.StaticSite`
runs `bun run build`, then uploads `dist/` as an assets-only Worker with the static
404 page. No Astro server adapter, sessions, or Worker script is deployed for the
site. Builds deliberately use `memo: false` because publication dates can change
the output even without a file change. Local development stays on `bun run dev`.

The stack is named `thiesen-dev`. Stages `prod` and `pr-<number>` have distinct
Workers and state. Alchemy chooses their physical Worker names and prints the
deployed URL. No custom domain is declared during the rebuild.

The scaffold has not created cloud resources or configured GitHub secrets.
To connect deployment:

1. Configure local authentication with
   `bunx --no-install alchemy profile edit --add Cloudflare`, using the intended
   personal account. Alchemy stores the profile outside the repository.
2. Use `bun run deploy:plan --stage pr-1` to inspect the intended preview. Shared
   state uses `Cloudflare.state()`, which can bootstrap a Worker, SQLite Durable
   Object, and Secrets Store credentials on first access. Even the first plan
   can require this state-store setup; it is not an offline validation command.
   `bun test tests/alchemy.test.ts` is the offline infrastructure check.
3. For an authorized first preview, run `bun run deploy --stage pr-1` and verify
   the generated `workers.dev` URL. This validates the repository and lets
   Alchemy run the production build. Keep the shared state backend in place;
   `.alchemy/` is ignored and is not CI's source of state.
4. Add GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   for that same account. Follow Alchemy's CI credential setup and scope the token
   to this deployment's resources, including its shared state backend. Never put
   tokens in committed files, issue bodies, or workflow output.
5. Allow this workflow's `pull_request_target` trigger in the repository's
   [Actions event policy](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target).
   GitHub's default policy for public repositories is scheduled to block it
   starting November 2, 2026. Then set repository variable
   `ALCHEMY_DEPLOY_ENABLED=true`. Until then the deploy
   and cleanup jobs are explicitly skipped; validation and builds still run.
   Pushes to `main` deploy `prod` after both checks pass. Same-repository PRs
   deploy `pr-<number>`; forks only run checks and receive no deployment secrets.
   Same-repository writers are trusted to execute deployment code with the CI
   token; the future publisher must enforce its content-only write boundary.
   Closing or merging a PR destroys its preview using default-branch code.
   Cleanup uses `pull_request_target: closed` so it also runs for conflicted PRs;
   it never checks out or executes the PR branch.
   Each stage serializes the whole workflow, including checks, so a slow build
   cannot recreate a preview after cleanup. Applies are never auto-cancelled.
6. Require PRs and checks `content-validation` and `build` in the GitHub ruleset.
   Once real content and visual QA are accepted, review existing hosting/DNS and
   add `thiesen.dev` only to the production stage for the domain cutover.

Do not connect Workers Builds or deploy this stack with Wrangler alongside
Alchemy. Alchemy must own updates and resource cleanup. The workflow is ready to
connect, but remote-state bootstrap, authenticated deployment, and live preview
cleanup remain unverified until credentials are available.

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
- [Alchemy static sites](https://alchemy.run/cloudflare/frontend/static-site/)
- [Alchemy Cloudflare setup](https://alchemy.run/cloudflare/setup/)
- [Alchemy CI and shared state](https://alchemy.run/cloudflare/tutorial/part-5/)
