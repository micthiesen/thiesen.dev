> Source: KaraKeep bookmark `qhdk1cm3fk1gpi68ssqa9cwh`, retrieved 2026-09-29.
> This is the original design brief. Its embedded citation markers refer to the
> source conversation; verify version-sensitive claims against current docs.

# thiesen.dev Rebuild Specification

## Executive recommendation

Build **thiesen.dev as a Git-backed static publication system**, not as a CMS-backed application.

My recommended architecture is:

> **Astro v7 static site + plain Markdown content + Astro content collections + selectively hydrated Solid components + GitHub as the source of truth + Cloudflare Workers Static Assets + Cloudflare Workers Builds + a narrow site-specific MCP façade for normal ChatGPT/Executor editing.**

This is a strong recommendation, roughly **95% confidence** given your requirements.

Astro is unusually well matched to this site because it is explicitly optimized for content-driven sites, has typed content collections, build-time image optimization, static generation, and an official Solid integration that can server-render and selectively hydrate Solid components. That lets you get the part you like about Solid without turning a mostly textual site into an application framework project. citeturn12search3turn22view3turn14view3

I would **not use SolidStart as the primary framework right now**. Solid itself is an excellent fit for interactive islands, but as of September 29, 2026, Cloudflare still labels its Solid framework support Beta, while the current SolidStart v2 line has been undergoing its v2 transition rather than presenting the same boring, content-first foundation you want for something intended to sit online for years. That is an unnecessary dependency on framework churn for a site whose difficult problem is publishing, not application state. citeturn21view1turn0search15

I would also **not introduce a traditional CMS**. Your Git repository should be the database, revision history, publishing queue, rollback mechanism, and agent interface. GitHub's APIs let an installation-scoped GitHub App modify repository content and create pull requests with narrowly granted permissions; GitHub explicitly recommends granting an App only its minimum necessary permissions. citeturn16view0turn17view0

The resulting architecture is deliberately boring:

```text
                         ┌───────────────────────┐
                         │ You / Codex           │
                         │ direct repo access    │
                         └──────────┬────────────┘
                                    │
                                    ▼
┌──────────────────┐      ┌────────────────────────────┐
│ ChatGPT / other  │      │       GitHub repo          │
│ agent via MCP    │─────▶│ content + code + assets    │
└────────┬─────────┘      │ main protected by PRs      │
         │                └────────────┬───────────────┘
         ▼                             │
┌──────────────────┐                   │ PR / push
│ site MCP service │                   ▼
│ TypeScript       │       ┌───────────────────────────┐
│ validate → PR    │       │ CI + Cloudflare preview   │
└──────────────────┘       └────────────┬──────────────┘
                                        │ merge
                                        ▼
                           ┌───────────────────────────┐
                           │ Astro static build        │
                           │ HTML/CSS/images/SVG       │
                           └────────────┬──────────────┘
                                        │
                                        ▼
                           ┌───────────────────────────┐
                           │ Cloudflare Workers        │
                           │ Static Assets             │
                           │ thiesen.dev               │
                           └───────────────────────────┘
```

For a new Cloudflare project I would specifically use **Workers Static Assets, not Pages**. Cloudflare now positions Workers as its primary platform for new projects and says Workers covers most Pages use cases while offering the broader feature set. Static assets are globally cached by Cloudflare, and requests that match static files can be served without invoking Worker code. citeturn0search9turn5view0turn22view2

### Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro v7, static output** | Content-first, minimal browser JS, typed content |
| Interactive UI | **SolidJS islands** | Use Solid where interaction actually adds value |
| Content | **Markdown + YAML frontmatter** | Extremely agent-friendly, portable, diffable |
| Rich content | **Small owned Markdown directive layer** | Figures, galleries, charts, callouts without arbitrary JSX |
| Code | **Astro/Shiki build-time highlighting** | No runtime highlighter; first-class light/dark themes |
| Charts | **Vega-Lite specs → static SVG by default** | Declarative JSON is ideal for agents |
| Images | **Astro assets pipeline** | Dimensions and optimization generated at build |
| Source of truth | **GitHub repository** | Versioning, PRs, audit trail, rollback |
| Agent bridge | **Your TypeScript MCP/Executor → GitHub App** | Narrow tools instead of generic write access |
| CI | **GitHub Actions validation + CF preview build** | Deterministic gate plus visual preview |
| Hosting | **Cloudflare Workers Static Assets** | Near-zero operational surface and traffic cost |
| Domain | **thiesen.dev on existing CF account** | Native deployment/domain path |
| Database | **None** | There is no runtime publishing state |
| CMS | **None** | Git + agents already solve the actual problem |

The key principle is: **the published site should have essentially no backend at all**. Editing is an authoring concern and happens upstream in Git. A viral post therefore increases CDN traffic, not database connections, CMS CPU, SSR invocations, or application-server load. Cloudflare currently states that Workers static-asset requests are free and unlimited; Workers Builds gives the Free plan 3,000 build minutes per month. citeturn22view2turn21view1


## Product and experience specification

The aesthetic should be closer to **a very well-typeset technical notebook** than a portfolio template. The impressive part should not be visual spectacle. It should be the feeling that absolutely nothing is fighting the reader.

### Information architecture

Keep the permanent top-level surface tiny:

```text
/
├── projects/
├── notes/
├── about/
├── projects/[slug]/
├── notes/[slug]/
├── feed.xml
└── sitemap-index.xml
```

I would distinguish **Projects** and **Notes** at the presentation level but use one common content model internally. A project is fundamentally a post with a few additional fields: repository, demo URL, project state, dates, and possibly technologies.

The homepage should be:

```text
Michael Thiesen                             GitHub   About

Software engineer building things around AI, tools,
and whatever seems interesting enough to investigate.

Selected work

Project title                                   2026
One precise sentence explaining what it is.
[large restrained screenshot]

Another project                                 2025
...

Recent notes

Title of note                              Sep 2026
A one-line summary.

Title of note                              Aug 2026

                                         All notes →

© Michael Thiesen             RSS          thiesen.dev
```

No giant name treatment, skills cloud, animated canvas, oversized gradients, testimonial cards, "currently exploring" widget, or dashboard chrome.

A project page gets somewhat more visual latitude:

```text
Project Name

Short, concrete description of what this actually does.

2026 · TypeScript · AI tooling
GitHub ↗   Live ↗

┌───────────────────────────────────────────────┐
│               hero screenshot                │
└───────────────────────────────────────────────┘

Why I built it

Long-form body...

[full-width figure]

Implementation

[code]

[chart]

What I learned
```

A note is even quieter: title, dek, date, body.

### Typography

Use a serif as the principal reading face. My first choice would be **Source Serif 4**, self-hosted in WOFF2 form, with a system sans stack for tiny interface labels and the built-in/code font stack for code.

A reasonable initial type system:

```css
--font-text: "Source Serif 4", ui-serif, Georgia, serif;
--font-ui: ui-sans-serif, system-ui, sans-serif;
--font-code: ui-monospace, "SFMono-Regular", Consolas, monospace;

--text-body: clamp(1.075rem, 1rem + 0.2vw, 1.2rem);
--text-small: 0.875rem;
--text-title: clamp(2.25rem, 6vw, 4.5rem);

--measure: 42rem;
--measure-wide: 68rem;
```

Use the serif for title, headings and prose. The contrast between literary typography and technical subject matter will give the site more character than layering on decorative UI.

Self-host the font rather than fetching it from a third-party font CDN. Preload only the primary Roman font required above the fold. Avoid loading six weights; variable fonts or a restrained regular/semibold pair are preferable. This is primarily a performance/design decision: fewer late font substitutions means fewer opportunities for visible movement.

### Colour and theme

**Automatic theme should require zero JavaScript.**

Start with:

```css
:root {
  color-scheme: light dark;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f7f6f2;
    --fg: #171715;
    --muted: #706f69;
    --hairline: #d9d7d0;
    --surface: #efeee9;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151514;
    --fg: #ecebe5;
    --muted: #a09f98;
    --hairline: #343431;
    --surface: #1d1d1b;
  }
}
```

Those are starting tokens, not sacred colours. Tune them visually.

I would **not ship a theme switcher in v1**. Your requirement is automatic light/dark; `prefers-color-scheme` accomplishes that without a flash-of-wrong-theme script, persistence state, or another piece of UI. A manual override is easy to add later.

### Motion and the "no jitter" requirement

This is where a lot of supposedly polished sites go wrong. The target should be **continuity**, not "animation."

Use Astro's optional client router/View Transitions support for page navigation and constrain the motion vocabulary to:

- crossfade: ~140–180 ms;
- media or page-title continuity: ~180–240 ms;
- hover state: ~100–140 ms;
- transforms and opacity only wherever practical;
- no scroll-triggered fade-in parade;
- no parallax;
- no animated page-height changes;
- no initial content reveal.

Astro provides opt-in view transitions/client-side navigation and handles reduced-motion preferences, so this can enhance navigation without making your content architecture dependent on a client application. citeturn3view3

The more important half is **eliminating layout movement**. All imagery must have dimensions/aspect ratio known before it arrives. Astro's image tooling can infer image dimensions and generate optimized assets specifically so layout space can be reserved ahead of load. citeturn3view4 Google likewise identifies images without reserved dimensions and dynamically inserted content as common contributors to cumulative layout shift. citeturn21view3

For the same reason:

- code blocks get stable padding and line height;
- charts receive an explicit aspect ratio before rendering;
- fonts are self-hosted and minimally loaded;
- there are no client-hydrated components above the fold unless there is a concrete reason;
- interactive islands should render useful server/static markup before hydration.

That last point is why **Astro + Solid is better here than "make everything Solid."** Astro's official Solid integration can render components server-side and hydrate selected components on the client. citeturn13view0turn14view3

### Responsive behaviour

The layout should mostly respond through available width rather than breakpoint-specific redesigns.

For prose:

```css
.post-body {
  width: min(100% - 2rem, 42rem);
  margin-inline: auto;
}

.post-body .wide {
  width: min(68rem, calc(100vw - 2rem));
  margin-inline: 50%;
  transform: translateX(-50%);
}
```

Normal prose remains around 65–75 characters per line. Screenshots, diagrams, tables and charts can break into the wider measure.

On mobile, project images simply move under their summary. Avoid clever carousels for screenshots; a vertically scrollable set of excellent images is easier to navigate, index, link to, and render reliably.


## Content model and authoring contract

This is arguably the most important technical decision for agent usability.

Use **plain Markdown as the default and only normal authoring format**.

Do **not** make MDX the normal content format.

Astro's MDX integration explicitly allows JSX expressions and components inside content. That is powerful, but for agent-written articles it combines prose with executable/component-level semantics. My inference is that this is precisely the wrong default boundary for an automated publishing pipeline: normal posts should be capable of expressing rich articles without being able to import or execute arbitrary site code. citeturn3view0

Astro content collections are a good fit because they support locally stored Markdown and schemas with validation, and their build-time collection model is designed for statically generated content. citeturn22view3turn2view0

### Repository content layout

I would use one directory per post so screenshots and data travel with the document:

```text
src/
  content/
    posts/
      building-my-agent-runner/
        index.md
        hero.png
        architecture.png
        latency.csv

      experimenting-with-gpt-whatever/
        index.md
        result-1.webp

  components/
    content/
      Figure.astro
      Gallery.astro
      CodeBlock.astro
      VegaChart.astro
      Callout.astro

    interactive/
      InteractiveChart.tsx
      ImageCompare.tsx

  layouts/
    Base.astro
    Post.astro

  pages/
    index.astro
    projects/
    notes/
    [... etc ...]

  styles/
    global.css
```

Co-location is valuable for both people and agents: a post and everything required to render it form one directory that can be copied, renamed, deleted, or reviewed as a unit.

### Frontmatter schema

Keep required metadata intentionally small:

```yaml
---
title: "Building an agent-native publishing workflow"
summary: "How I ended up using Git itself as the CMS."
kind: project
publishedAt: 2026-09-29
tags:
  - ai
  - agents

project:
  github: "https://github.com/..."
  status: active
---
```

A fuller TypeScript model should be approximately:

```ts
type Post = {
  title: string;
  summary: string;

  kind: "project" | "note";
  status?: "draft" | "published";

  publishedAt?: string;
  updatedAt?: string;

  tags?: string[];

  hero?: {
    src: string;
    alt: string;
  };

  project?: {
    github?: string;
    demo?: string;
    status?: "active" | "complete" | "archived" | "experiment";
    startedAt?: string;
    endedAt?: string;
  };

  canonical?: string;
  featured?: boolean;
};
```

There should **not** be frontmatter for things that can be derived:

- slug → directory name;
- reading time → computed at build;
- `og:image` → generated or derived from hero;
- headings → body AST;
- modification date → explicit only when editorially meaningful;
- Git commit details → repository history.

For drafts, I would use `status: draft` and omit `publishedAt`. The publish operation writes the date. This keeps an agent from accidentally giving a draft a publication timestamp and thereby causing it to appear.

### Markdown surface

An ordinary post should look completely unsurprising:

````md
---
title: "..."
summary: "..."
kind: project
project:
  github: "https://github.com/example/example"
---

I wanted a way to...

## Architecture

The core loop ended up being very small:

```ts
const result = await agent.run(task);
await publish(result);
```

::figure{src="./architecture.png" alt="Architecture diagram showing..." caption="The final architecture."}

The latency changed considerably after batching:

```vega-lite
{
  "data": {
    "values": [
      {"batch": 1, "latency": 830},
      {"batch": 4, "latency": 310}
    ]
  },
  "mark": "line",
  "encoding": {
    "x": {"field": "batch", "type": "quantitative"},
    "y": {"field": "latency", "type": "quantitative"}
  }
}
```
````

That is the authoring API.

An agent needs to understand Markdown plus perhaps **four extra concepts**:

```text
::figure
:::gallery
:::callout
```vega-lite
```

I would implement those extensions in a small, owned Markdown transformation layer rather than adopt a page-builder content model. The AST transformer converts them to your own Astro content components. That layer is tiny enough that replacing the underlying parser later is realistic.

### Figures and screenshots

For a normal image:

```md
![A screenshot of the agent run detail view](./run-detail.png)
```

For anything needing a caption or wide layout:

```md
::figure{
  src="./run-detail.png"
  alt="Run detail interface showing individual model steps"
  caption="The run trace after adding sub-agent nesting."
  wide=true
}
```

Build validation should reject:

- missing local asset;
- missing alt text unless explicitly marked decorative;
- unsupported image extension;
- an image over your chosen source-size limit;
- references escaping the post directory.

Astro can transform local images and infer dimensions at build time, which directly supports your "no jumping around" requirement. citeturn3view4

### Code

Use Astro's built-in **Shiki-based highlighting**, configured with paired light and dark themes. Astro officially supports different Shiki themes for each colour scheme, so this requires no runtime syntax-highlighter payload. citeturn14view0

Code blocks should support a tiny amount of optional metadata:

````md
```ts title="src/publish.ts" {4-8}
...
```
````

Features worth implementing:

- language;
- optional filename/title;
- optional highlighted lines;
- copy button;
- horizontal overflow;
- line numbers only when explicitly requested.

Avoid a heavyweight "code window" design. Code should look like part of the article, not a fake VS Code screenshot.

### Graphs and visualizations

**Vega-Lite is the best default agent-authored visualization format.**

Its specification is declarative JSON, supports transforms, compositions and interactions, and is intentionally a high-level grammar rather than an arbitrary JavaScript API. citeturn21view0 That makes it much more appropriate for agent generation than asking an agent to write an Observable Plot or D3 component every time.

The pipeline should be:

```text
```vega-lite JSON
        │
        ▼
JSON/schema validation
        │
        ▼
Vega-Lite compile
        │
        ▼
Vega
        │
        ├── default ──▶ static SVG embedded in generated HTML
        │
        └── interactive=true ──▶ SVG/static fallback + Solid island
```

Vega's View API explicitly supports server-side static SVG/PNG export, including `toSVG()`, so normal charts can become ordinary static page markup during the build. citeturn22view0

That has several benefits:

- charts work without JavaScript;
- they are visible immediately;
- there is no hydration movement;
- they can be indexed/accessed as markup;
- an unusually popular article doesn't result in visualization computation on your server;
- the agent only writes structured data/specification.

For the minority of visualizations that really need hover, zoom, filtering, sliders, animation, or a custom simulation, use a Solid component. Do not force every visualization through one abstraction.

### Escape hatch

There should still be an escape hatch for an exceptional article.

My preference:

```text
Normal agent content       .md        always allowed
Vega/spec visualizations   in .md     always allowed
Hand-built interactive     .tsx       code review required
MDX                         none       don't enable initially
```

Codex can create a new Solid component and wire it into a special post when you explicitly ask it to. That is fundamentally a **code change**, so treating it as code rather than pretending it is ordinary article content is cleaner.


## Agent and publishing architecture

The repository should support **two authoring planes with different privilege levels**.

### Codex: repository-native author

Codex gets normal repository access and is allowed to modify both the site and the content.

This is the right route for requests such as:

> "Write up the little image indexing project I just finished. Look at the repository, use these screenshots, explain the architecture, and make it a featured project."

or:

> "I don't like how figures look on mobile. Improve it."

The repository should contain:

```text
AGENTS.md
src/content/AGENTS.md
src/components/interactive/AGENTS.md
```

Codex reads repository `AGENTS.md` files before working and supports progressively more specific instructions deeper in the directory tree, making this a first-class way to encode your site's authoring contract. citeturn19view1

The root file should contain engineering rules:

```md
# thiesen.dev

## Commands

- `pnpm check` validates types and content.
- `pnpm test` runs unit tests.
- `pnpm build` must succeed before a PR is ready.

## Architecture

- Astro owns pages and static rendering.
- Solid is only for genuinely interactive components.
- Do not add client JavaScript to normal prose pages.
- Do not introduce a database or external CMS.

## Content

See `src/content/AGENTS.md`.

## UI

- Preserve layout stability.
- Never add scroll-entry animation.
- Respect prefers-reduced-motion.
- All media must have known dimensions.
- Prefer CSS over client JS.
```

Then `src/content/AGENTS.md` becomes your actual editorial API:

```md
# Writing for thiesen.dev

Posts are Markdown in:
`src/content/posts/<slug>/index.md`

Assets live beside the post.

Required frontmatter:
- title
- summary
- kind

Projects must include `project.github` when a repository exists.

Use normal Markdown whenever possible.

Supported extensions:
- figure
- gallery
- callout
- vega-lite

Never:
- add inline JavaScript
- add raw script tags
- use remote images without explicit reason
- invent technical claims about one of Michael's projects
- omit alt text from meaningful images

Writing style:
- first person
- direct
- technical
- explain why decisions were made
- avoid marketing language
- avoid generic AI enthusiasm
```

This is exactly the kind of persistent project guidance `AGENTS.md` is intended to provide. citeturn19view1

Codex's normal workspace-write sandbox can modify files while keeping network and out-of-workspace actions behind separate approval boundaries; the dangerous fully unrestricted mode exists but is explicitly called out as elevated risk. citeturn19view4

### ChatGPT / Executor: content-scoped author

For normal chat, **do not expose a generic `git_write_file(path, content)` MCP tool**.

You can, but that gives the model a much larger capability than the task requires.

Expose a site-shaped API instead:

```ts
site.search_posts
site.get_post
site.create_post
site.update_post
site.add_asset
site.validate_post
site.open_preview_pr
site.archive_post
```

Potentially later:

```ts
site.publish_pr
```

MCP is explicitly designed to connect ChatGPT/Codex to external tools; current OpenAI documentation supports remote MCP-backed tools for ChatGPT plugins and direct MCP connections from Codex clients. citeturn19view2

The TypeScript MCP implementation should have a domain layer independent of MCP:

```text
packages/
  content-core/
    schema.ts
    parse.ts
    validate.ts
    serialize.ts
    assets.ts

  github-publisher/
    github-app.ts
    branches.ts
    commits.ts
    pull-requests.ts

apps/
  mcp/
    tools/
      create-post.ts
      update-post.ts
      add-asset.ts
      ...
```

Then the Astro build and MCP service both import `content-core`.

That is important: **there should be one schema, not an Astro schema and a subtly different MCP schema.**

### Recommended MCP write semantics

`site.create_post` should look conceptually like:

```ts
type CreatePostInput = {
  title: string;
  summary: string;
  kind: "project" | "note";
  markdown: string;

  tags?: string[];

  project?: {
    github?: string;
    demo?: string;
    status?: "active" | "complete" | "archived" | "experiment";
  };

  slug?: string;

  mode?: "draft-pr" | "ready-pr";

  idempotencyKey: string;
};
```

Response:

```ts
type CreatePostResult = {
  slug: string;
  branch: string;
  commitSha: string;
  pullRequest: {
    number: number;
    url: string;
  };
};
```

For updates:

```ts
type UpdatePostInput = {
  slug: string;

  // Prevent silently overwriting a newer edit.
  expectedCommitSha: string;

  patch:
    | { type: "replace-body"; markdown: string }
    | { type: "replace-document"; document: PostDocument }
    | { type: "frontmatter"; values: Partial<PostMeta> };

  idempotencyKey: string;
};
```

I would **not expose arbitrary search-and-replace as the primary API**. Agents are quite capable of returning an internally coherent complete Markdown body, while line-oriented patches become fragile once another writer changes the article.

`expectedCommitSha` provides optimistic concurrency:

```text
agent read SHA A
      │
      ├─ still SHA A ──▶ update
      │
      └─ now SHA B ────▶ CONFLICT; reread before changing
```

That protects you from two chat sessions editing the same article based on stale text.

### Asset upload semantics

`site.add_asset` should accept:

```ts
{
  slug: "my-project",
  filename: "dashboard.png",
  file: ...,
  alt: "..."
}
```

The service should:

1. sanitize the filename;
2. inspect actual MIME type rather than trusting the extension;
3. enforce a size limit;
4. optionally optimize the image before committing;
5. save only under that post's directory;
6. return the Markdown reference.

Example response:

```json
{
  "path": "./dashboard.webp",
  "markdown": "![Dashboard showing model run history](./dashboard.webp)"
}
```

That dramatically reduces authoring mistakes.

### GitHub authentication

Back your publisher with a **single-repository GitHub App**, not a long-lived personal access token.

GitHub Apps start with no permissions, can be granted only the minimum necessary repository permissions, and installation tokens can be further restricted to specified repositories/permissions; installation access tokens currently expire after one hour. GitHub's Octokit SDK can handle generating and renewing those tokens. citeturn16view0turn16view1

The content publisher needs approximately:

| GitHub App permission | Level |
|---|---:|
| Contents | write |
| Pull requests | write |
| Metadata | read |
| Workflows | **none** |
| Administration | **none** |

The App should have access only to the thiesen.dev repository.

GitHub explicitly separates workflow-file access from ordinary Contents permission, so there is no reason for a content-writing MCP service to hold the additional Workflows permission. citeturn16view0

GitHub's REST API supports creating a PR using GitHub App installation tokens and requires Pull Requests write permission for that action. citeturn17view0

### Privilege boundary

This is the security boundary I would enforce:

```text
                    CAN EDIT CONTENT    CAN EDIT CODE    CAN MERGE MAIN
Codex                     yes               yes             you*
Chat / MCP                yes               no              no
CI                        no                no               no
Cloudflare build          no                no               no
Direct editor later       yes               no              no
```

`*` You can later allow narrowly defined auto-merge flows if you decide the review overhead is annoying.

At the application level, your MCP publisher should reject writes outside:

```text
src/content/posts/**
```

and perhaps one generated manifest if needed.

It should not matter that the GitHub credential technically has broader `Contents: write`: **the tool API itself implements a second, stricter path-level policy.**

### PR-first publishing

Every chat-generated edit should produce a pull request.

That gives you:

```text
prompt
  ↓
agent-generated article
  ↓
schema validation
  ↓
branch
  ↓
PR
  ├─ automated validation
  ├─ static build
  ├─ Cloudflare preview
  ├─ visual inspection
  └─ optional Codex review
  ↓
merge
  ↓
production
```

GitHub can require status checks to pass before merging protected branches, making CI an actual invariant rather than a suggestion. citeturn17view3 Repository rulesets can also constrain interaction with target branches and layer alongside branch protections. citeturn16view2

Codex itself can review GitHub PRs, follow repository-specific guidance, and later fix findings back onto a branch when granted permission. OpenAI explicitly notes that this review does not replace CI or branch protections—which is exactly the separation you want. citeturn19view5

### Direct editing later

Do **not** build an admin UI in v1.

If you eventually miss one, build it as another client of the same publishing library:

```text
/admin
  └── editor
       └── content-core
            └── github-publisher
                 └── PR
```

The editor should never become a second database.

A reasonable future `/admin` gives you:

- post list;
- textarea/Markdown editor;
- image drop;
- rendered preview;
- save to branch;
- open/update PR.

Protect it with your preferred authenticated edge mechanism. The public site remains static even if the editor exists.


## Technical implementation specification

### Framework configuration

Astro should be configured for static output with the site's canonical URL:

```ts
// astro.config.ts

import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://thiesen.dev",

  integrations: [
    solid(),
    sitemap(),
  ],

  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },

    // Your small deterministic content extensions.
    remarkPlugins: [
      // remarkDirective,
      // contentDirectivePlugin,
    ],
  },

  prefetch: true,
});
```

Astro's official Solid integration provides rendering and client-side hydration for Solid components, while the sitemap integration generates its sitemap from built routes. citeturn13view0turn14view2

The exact theme names can change after visual tuning; the important requirement is **dual build-time Shiki themes**, which Astro supports directly. citeturn14view0

### Package surface

Keep dependencies aggressively small.

Core runtime/build dependencies:

```text
astro
@astrojs/solid-js
solid-js
@astrojs/sitemap
@astrojs/rss

vega
vega-lite
```

Authoring/build utilities:

```text
remark-directive             # or equivalent tiny owned parser
```

Agent publisher:

```text
@octokit/app
@octokit/rest
```

Tests:

```text
vitest
playwright                   # only for a small browser acceptance suite
```

I would specifically **not** begin with:

```text
Tailwind
React
Framer Motion / Motion
a component library
a CMS SDK
a database client
an auth library
an icon package with hundreds of icons
a client-side syntax highlighter
a client-side Markdown renderer
```

This site is small enough that hand-written CSS is an asset, not a liability. A component kit would tend to push the design toward somebody else's visual language.

### Solid usage rules

A `.tsx` component should require an affirmative answer to:

> "Does this element need persistent client-side state or event-driven behaviour after page load?"

Good Solid islands:

- interactive data visualization;
- before/after image comparison;
- executable little technical demo;
- a filter on `/projects/`;
- animation driven by actual user interaction.

Bad Solid islands:

- navbar;
- project card;
- dark-mode detection;
- heading;
- image;
- code block;
- article body;
- footer;
- link hover.

When hydration is appropriate, prefer the least eager Astro directive that still gives correct UX:

```astro
<InteractiveChart client:visible {...props} />
```

rather than eagerly hydrating everything.

### Site components

Keep the component hierarchy similarly narrow:

```text
layouts/
  BaseLayout
  PostLayout

components/
  Header
  Footer
  PostMeta
  ProjectRow
  Figure
  Gallery
  CodeBlock
  Chart
  ExternalLink
```

The absence of a design-system dependency does **not** mean absence of a design system. Your CSS custom properties are the design system:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;

  --duration-fast: 120ms;
  --duration-nav: 180ms;

  --ease-out: cubic-bezier(.2, .8, .2, 1);
}
```

Keep the shadows close to zero. Hairlines, spacing and typography should provide hierarchy.

### Image processing

Source files can be PNG/JPEG/WebP according to what is convenient to author. The public output should be optimized during the Astro build.

For photographic images, generate modern compressed variants.

For screenshots, inspect compression visually; a crisp UI screenshot can look worse after overly aggressive lossy conversion than the bytes saved are worth.

Astro's image service can transform imported local images and provide their final dimensions during build. citeturn3view4

Do not commit giant original camera files to the publication repo indefinitely. If you eventually start publishing large photography or video, put **originals** in R2 and keep web-ready derivatives in the site build. There is no need to add R2 for the current screenshot-heavy use case.

### RSS

Ship `/feed.xml` on day one.

Astro's official `@astrojs/rss` package can generate RSS directly from content collections in static builds. citeturn14view1

I would make it a full-text feed if your custom blocks can be reduced safely to RSS-compatible markup; otherwise summaries plus canonical links are fine. Don't spend a week creating a perfect representation of interactive graphs in RSS.

### Tests that are actually worth having

Keep testing structural.

`pnpm check`:

```text
Astro type/content validation
frontmatter schema
duplicate slug detection
broken local media refs
illegal path traversal
required alt text
Vega-Lite schema/compile validation
forbidden raw <script>
forbidden normal-post MDX
```

`pnpm test`:

```text
content parser
directive transforms
URL generation
feed generation
GitHub publisher domain logic
optimistic concurrency logic
```

Browser smoke test:

```text
/
one project page
one note
light mode
dark mode
narrow viewport
navigation transitions
JS disabled
```

The important acceptance test is:

> **Every normal article must remain useful with JavaScript completely disabled.**

Interactive enhancements can disappear or become static, but the article itself should not.


## Deployment, SEO and operational specification

### Cloudflare deployment

Use:

**GitHub → Cloudflare Workers Builds → Workers Static Assets → thiesen.dev**

Cloudflare's current Git integration can build from GitHub pushes, use different production/preview branches, and create preview deployments for pull requests. citeturn7view0

For the Astro static output, the deployment can remain conceptually as simple as:

```jsonc
// wrangler.jsonc
{
  "name": "thiesen-dev",
  "compatibility_date": "2026-09-29",

  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

Cloudflare documents Astro as a supported Workers framework, while Workers Static Assets can serve an SSG directly. citeturn22view1turn21view1

You do **not** need the Astro Cloudflare server adapter for the normal site if it is a pure static build. The point is to upload Astro's generated files, not make Astro run on every request.

### Production build flow

Use `main` as production:

```text
feature/agent-post-foo
          │
          ▼
        PR
          │
          ├──────────────▶ GitHub validation
          │
          └──────────────▶ Cloudflare preview
                                   │
                              preview URL
                                   │
                 review / screenshot / inspect
                                   │
                                   ▼
                                 merge
                                   │
                                   ▼
                               main push
                                   │
                                   ▼
                            production build
                                   │
                                   ▼
                             thiesen.dev
```

Cloudflare Workers Builds currently provides **3,000 build minutes per month on the Free plan**, one concurrent free build and a 20-minute build timeout, which is vastly more build capacity than a personal static site should normally consume. citeturn21view1

Static assets are the significant architectural win: Cloudflare serves matching assets through the static-asset layer, caches them across its network, and currently bills static asset requests as free/unlimited rather than Worker invocations. citeturn5view0turn6view0turn22view2

So a post becoming unexpectedly popular should look like:

```text
1 visitor       ┐
10 visitors      │
10,000 visitors  ├──▶ same prebuilt HTML/image files at Cloudflare edge
1,000,000        │
                ┘
```

rather than:

```text
request → SSR → DB → renderer → HTML
```

That is exactly the failure mode you said you want to avoid.

Current static-asset limits still need to be respected: the Free plan has a finite number of files per Worker version and a per-file maximum; Cloudflare's documented limits are ample for this sort of personal site but are another reason not to treat the deployment as storage for enormous originals. citeturn6view2

### CI policy

Protect `main` and require:

```text
content-validation
build
```

before merge.

I would make screenshot/browser testing advisory at first rather than mandatory, because flaky visual CI is worse than no visual CI for a solo site.

Agent-authored PRs should carry a predictable title:

```text
content: add "Building X"
content: update "Building X"
site: improve figure layout
```

And labels:

```text
agent-authored
content-only
site-code
```

This makes it trivial later to define an automatic merge policy such as:

```text
IF
  PR label = content-only
  AND changed files ⊆ src/content/posts/**
  AND validation = pass
  AND build = pass
  AND preview = pass

THEN
  optionally allow one-click or automatic squash merge
```

I would start with manual merge and remove friction only when you notice it, rather than designing for unattended publishing on day one.

### SEO

The SEO strategy should be mostly **semantic HTML + genuine writing + stable URLs**, not SEO machinery.

Every post needs:

```html
<title>Post title — Michael Thiesen</title>
<meta name="description" content="...">
<link rel="canonical" href="https://thiesen.dev/...">
```

plus Open Graph/Twitter metadata and a consistent social preview image.

Generate:

```text
/sitemap-index.xml
/feed.xml
/robots.txt
```

Astro's official sitemap integration generates entries from statically produced routes, and Google says sitemaps help search engines discover and crawl important URLs more efficiently. citeturn14view2turn12search2

For article/project pages, add JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "...",
  "description": "...",
  "datePublished": "...",
  "dateModified": "...",
  "author": {
    "@type": "Person",
    "name": "Michael Thiesen"
  },
  "url": "..."
}
```

Google supports Article/BlogPosting structured data as a way to provide explicit article metadata, though structured data is not a guarantee of a particular search presentation. citeturn21view2

For projects, I would **not obsess over exotic schema types**. A good project title, explanatory text, GitHub link, screenshots, `<figure>` captions, headings and canonical URL are much more valuable.

Google's current search guidance continues to emphasize helpful, reliable, people-first content rather than writing content primarily to manipulate rankings. That fits the site naturally: your strongest SEO asset will be detailed first-person accounts of projects and engineering decisions that exist nowhere else. citeturn0search24

### URL rules

URLs must remain permanent:

```text
/projects/agent-runner/
/notes/what-i-learned-from-x/
```

Do not encode years into URLs unless a year is intrinsically part of the piece. Publication dates can change; conceptual slugs usually do not.

If you rename a slug, generate a permanent redirect from the old URL.

### Performance budget

Treat these as acceptance criteria, not aspirational scores:

| Metric | Target |
|---|---:|
| Initial JS on ordinary post | **0 KB site JS or as close as Astro navigation requires** |
| Interactive JS | Loaded only on pages containing an island |
| CLS | **≤ 0.05 target** |
| LCP | **< 2.0 s target on reasonable mobile connection** |
| Body font requests | 1–2 |
| Third-party scripts | 0 initially |
| Runtime API requests for article | 0 |
| Runtime DB queries | 0 |
| Images missing dimensions | 0 |
| Client-rendered article content | 0 |

The reason I would target CLS more aggressively than Google's broad "good" threshold is your stated goal: the site should feel exceptionally still and intentional. Image dimension inference, static rendering, and pre-sized visualizations make that practical. citeturn3view4turn21view3

### Headers and security

Because normal production pages are static, the attack surface is already small.

Set sensible static headers, approximately:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Once the final asset/content strategy is settled, add a Content Security Policy that permits:

```text
default-src 'self'
img-src 'self' data:
font-src 'self'
style-src 'self' 'unsafe-inline'   // tighten if practical
script-src 'self'
```

The content renderer must not emit arbitrary `<script>` from Markdown. That rule matters much more once automated authors can write posts.

### Backup and portability

The architecture has unusually good exit properties:

```text
content     = Markdown + images
history     = Git
visuals     = JSON specs
frontend    = Astro / ordinary TS + CSS
deployment  = generated files
domain      = yours
```

Cloudflare could be replaced with another static host without migrating content. Astro could eventually be replaced without extracting posts from a proprietary CMS. The custom directives are your only meaningful content-level extension, so keep those deliberately small.

That is the right interpretation of "own the whole stack": **own the content format and the publishing contract, while allowing replaceable tools to implement each layer.**

### Recommended initial repository

The finished v1 should roughly be:

```text
thiesen.dev/
├── AGENTS.md
├── README.md
├── astro.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── wrangler.jsonc
│
├── .github/
│   ├── workflows/
│   │   └── check.yml
│   └── pull_request_template.md
│
├── packages/
│   └── content-core/
│       ├── schema.ts
│       ├── directives.ts
│       ├── validate.ts
│       └── index.ts
│
├── src/
│   ├── content.config.ts
│   │
│   ├── content/
│   │   ├── AGENTS.md
│   │   └── posts/
│   │       └── example-project/
│   │           ├── index.md
│   │           └── screenshot.png
│   │
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Figure.astro
│   │   ├── Gallery.astro
│   │   ├── VegaChart.astro
│   │   └── interactive/
│   │       └── InteractiveChart.tsx
│   │
│   ├── layouts/
│   │   ├── Base.astro
│   │   └── Post.astro
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── feed.xml.ts
│   │   ├── projects/
│   │   └── notes/
│   │
│   └── styles/
│       └── global.css
│
└── tools/
    └── content-check.ts
```

Your existing Executor/MCP implementation can remain a separate repository if that is already how you operate. I would import the same `content-core` package there or publish it privately/workspace-link it rather than duplicate schemas.

### Definition of done

The rebuild is done when this exact workflow feels trivial:

> In ChatGPT: "Turn the project I just described into a draft for thiesen.dev. Here are three screenshots and the GitHub repo."

The agent calls your site MCP, uploads the screenshots, writes one ordinary Markdown file, validates it, and opens a PR. GitHub runs deterministic checks. Cloudflare produces a preview. You review a page that is visually indistinguishable from production and merge it.

For a more complex post you can instead tell Codex:

> "Write up this project from the repo. There is latency data in `results.csv`; make a useful graph, use these two screenshots, and publish it as a project post."

Codex follows `AGENTS.md`, writes Markdown plus a declarative Vega-Lite block, runs the build, opens a PR, and the chart reaches production as pre-rendered SVG. Codex can also change the site's actual components when the article genuinely needs a new interactive experience. OpenAI's current Codex tooling explicitly supports repository-level `AGENTS.md`, GitHub PR workflows, and MCP extension points, so this architecture aligns with the agent interfaces rather than building a parallel publishing system around them. citeturn19view1turn19view2turn19view5

The final result is therefore **not really a blog with AI editing bolted onto it**. It is a small, typed publication repository whose native interface happens to be exceptionally good for both humans and agents: Markdown for ordinary ideas, Git for state and history, Solid for the rare thing that should move, Astro for turning it into stable HTML, and Cloudflare for making that HTML effectively boring to operate.
