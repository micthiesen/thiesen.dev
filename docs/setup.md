# Setup decisions

This is the runnable foundation for the rebuild specification. Local agent
authoring uses the global `$post` skill; a remote content-scoped publishing
service remains optional future work. Alchemy manages production deployment.

## Included

- Astro 7 static output; Solid integration ready for justified islands.
- Shared `content-core` Zod schema, publication rules, safe URLs, Markdown and
  local media validation. Frontmatter dates accept quoted or unquoted ISO dates.
- Draft authoring examples and a reading sample, shown only by `bun run dev`. Production
  builds, feeds, and sitemap omit drafts and future publication dates. The loader
  excludes them before Astro renders assets, so unpublished images are omitted
  too. The build script pins production mode even in a development environment.
- Latest-post home, a single archive, about, post, and 404 layouts; serif typography,
  automatic light/dark CSS, self-hosted Source Serif 4, reserved image dimensions,
  build-time code highlighting, canonical/OG text metadata, article JSON-LD.
- RSS summaries, sitemap, robots.txt, static security headers, Alchemy infrastructure.
- CI jobs named `content-validation` and `build`, followed by credential-gated
  deployment; closed PRs clean up their previews.

The current [design direction](design.md) removes categories, tags, featured
flags, and project-specific metadata. Every post uses `/posts/<slug>/`. Navigation
is confined to the footer. The homepage shows the newest post's actual rendered
body, ending longer excerpts at a complete block near 320 words. It does not ship
the omitted content or its links. `parse5` finds safe HTML boundaries without
reserializing Astro's image placeholders; it is used only during rendering.

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

## Deployment

### Live deployment

Deployed on September 29, 2026, with Alchemy:

- Production: [thiesen.dev](https://thiesen.dev).
- Production diagnostics:
  [prod Worker](https://thiesen-dev-website-prod-ibmyf2haocy3zxqj.syas.workers.dev).

The personal Cloudflare account hosts both stages and the shared
`alchemy-state-store` backend. The production stage owns the apex and `www`
custom domains and the `www` redirect. The old Vercel website DNS records were
replaced; all 14 mail and unrelated DNS records were preserved.

Live HTTP checks passed for pages, assets, RSS, sitemap, draft exclusion, and the
404 response. Desktop/mobile browser checks passed on the production Worker.
Preview destruction and recreation were exercised without changing production.

Local Alchemy authentication is stored in its private profile. GitHub Actions has
the scoped Cloudflare token and account ID, and `ALCHEMY_DEPLOY_ENABLED=true`.
The repository's Actions event policy permits this workflow's preview cleanup
trigger. Cloudflare's official `cf` CLI also has its own OAuth authentication.

### Configuration

`alchemy.run.ts` is the deployment source of truth. `Cloudflare.Website.StaticSite`
runs `bun run build`, then uploads `dist/` as an assets-only Worker with the static
404 page. No Astro server adapter, sessions, or Worker script is deployed for the
site. Builds deliberately use `memo: false` because publication dates can change
the output even without a file change. Local development stays on `bun run dev`.

The stack is named `thiesen-dev`. Stages `prod` and `pr-<number>` have distinct
Workers and state. Alchemy chooses their physical Worker names and prints the
deployed URL. Only `prod` attaches `thiesen.dev` and `www.thiesen.dev`; the latter
redirects to the apex with HTTP 301 while preserving the path and query string.
The `workers.dev` endpoint remains available for diagnostics.

Authentication and CI configuration:

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
6. Posts use local draft review followed by an approved direct push to `main`.
   Do not add a ruleset requiring post PRs. CI still runs `content-validation`
   and `build` before deployment; the authoring agent does not wait for CI.

Do not connect Workers Builds or deploy this stack with Wrangler alongside
Alchemy. Alchemy must own updates and resource cleanup.
Use Cloudflare's official `cf` CLI for account inspection and one-time DNS
migration operations. Its local authentication is managed with `cf auth login`;
Alchemy and GitHub Actions also need their own deployment credentials. The
Cloudflare MCP integration is no longer part of this workflow.

### Web Analytics

Cloudflare Web Analytics uses manual installation for `thiesen.dev`; automatic
injection is disabled to avoid duplicate beacons. `src/components/WebAnalytics.astro`
contains the public beacon token, which is a site identifier rather than an API
credential. It requires no GitHub secret or deployment environment variable.
The existing CI build and Alchemy deploy include the component automatically.

The shared layout includes analytics only in production builds on indexable
pages. The bootstrap loads Cloudflare's beacon only when the browser hostname is
exactly `thiesen.dev`, so local previews, PR deployments, and the production
`workers.dev` diagnostic URL do not report traffic. Draft previews and the 404
page omit the bootstrap. The site remains static with no analytics backend.

View reports in the Cloudflare account's **Web Analytics** dashboard for
`thiesen.dev`. Reports include visits, page views, referrers, geographic and
device breakdowns, and page performance. Visits are not unique people. The
service uses no analytics cookies, localStorage, or visitor fingerprinting;
ad blockers can prevent reporting. Cloudflare currently retains six months of
reports and does not support custom events or UTM campaign parameters.

If the site is recreated in Cloudflare, replace the component's public beacon
token and the build test's expected token together. Keep manual installation
selected; the Alchemy stack continues to own hosting, domains, and deployment.

### Domain cutover and rollback

Before attaching production, deploy and verify a preview, back up DNS, and check
for existing Worker domains, Worker routes, and redirect rules. Remove conflicting
website records only after the new deployment is ready. Leave mail and unrelated
subdomain records intact. The deployment token needs Workers Scripts Edit,
Secrets Store Edit, and Account Settings Read for the personal account, plus
Zone Read, Workers Routes Edit, DNS Edit, and Single Redirect Edit for
`thiesen.dev`.

The previous website used Vercel with these DNS-only records (TTL automatic):

- `thiesen.dev`: A `76.76.21.21`.
- `www.thiesen.dev`: CNAME `cname.vercel-dns.com`.

To roll back hosting, commit the production Worker's `domain: null` configuration
and deploy `prod` so Alchemy removes its custom domains and owned redirect rule.
Then restore those two DNS records and verify Vercel over HTTPS. Omitting the
property does not detach domains. Keep `domain: null` in the deployment source
until a deliberate new cutover so CI cannot reattach the hostnames. The old
website has no availability requirement; restoring Vercel is optional.

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
4. If remote chat publishing is needed, build a content-scoped publisher using
   this same `content-core` module. Use a GitHub App installed only on this
   repository: Contents write and Metadata read; no Workflows or Administration
   permission. Validate asset bytes/MIME, enforce writes under
   `src/content/posts/**`, use idempotency
   keys and expected commit SHAs. Preserve explicit approval of the concrete
   draft before a write to `main`, without requiring a post PR. Never give chat
   agents a generic file-write or merge tool.
5. Connect that optional publisher to Executor, then verify draft, preview,
   approval, and publication. This direct-push workflow supersedes the original
   specification's PR-based publishing proposal.

Scheduled publication depends on a new static build after the date arrives;
there is no runtime scheduler. Add a timed build only if scheduling is wanted.

Until the first post is published, Astro reports an empty collection during the
production build. This is expected with only draft samples checked in. Production
shows a simple empty state; the reading sample is never published just to fill it.

## Source references

- [Astro 7 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro Solid integration](https://docs.astro.build/en/guides/integrations-guide/solid-js/)
- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Alchemy static sites](https://alchemy.run/cloudflare/frontend/static-site/)
- [Alchemy Cloudflare setup](https://alchemy.run/cloudflare/setup/)
- [Alchemy CI and shared state](https://alchemy.run/cloudflare/tutorial/part-5/)
