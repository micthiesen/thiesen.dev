import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "thiesen-dev",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const site = yield* Cloudflare.Website.StaticSite("Website", {
      command: "bun run build",
      outdir: "dist",
      // Publication dates can change the output even when no files changed.
      memo: false,
      compatibility: { date: "2026-09-29" },
      assets: { notFoundHandling: "404-page" },
      workersDev: true,
      ...(stage === "prod"
        ? { domain: { name: "thiesen.dev", redirects: ["www.thiesen.dev"] } }
        : {}),
    });

    return { url: site.url };
  }),
);
