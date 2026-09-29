import { expect, test, spyOn } from "bun:test";
import * as BunServices from "@effect/platform-bun/BunServices";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { provideFreshArtifactStore } from "alchemy/Artifacts";
import { layerNonInteractive } from "alchemy/Interaction";
import * as Plan from "alchemy/Plan";
import { evalStack } from "alchemy/Stack";
import * as State from "alchemy/State";
import * as Effect from "effect/Effect";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import stack from "../alchemy.run";

test("Alchemy can plan the static deployment without cloud access", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "thiesen-alchemy-"));
  const environment = {
    CI: "true",
    CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
    CLOUDFLARE_API_TOKEN: "offline-placeholder",
    NO_TRACK: "true",
  };
  const previous = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, environment);
  const rejectNetwork = () => {
    throw new Error("Infrastructure planning must not make network requests");
  };
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(rejectNetwork, { preconnect: rejectNetwork }),
  );

  try {
    for (const stage of ["prod", "pr-1", "development"]) {
      const plan = await Effect.runPromise(
        evalStack(
          stack,
          (compiled) => Plan.make(compiled).pipe(Effect.provide(State.inMemoryState())),
          { stage },
        ).pipe(
          provideFreshArtifactStore,
          Effect.provide(State.inMemoryState()),
          Effect.provide(layerNonInteractive()),
          Effect.provideService(AlchemyContext, {
            dotAlchemy: temporary,
            dev: false,
            adopt: false,
          }),
          Effect.provide(BunServices.layer),
        ),
      );

      // Exercise the real provider graph, including optional runtime peers.
      const resources = Object.values(plan.resources);
      expect(resources.map((resource) => resource.resource.Type).sort()).toEqual([
        "Cloudflare.Worker",
        "Command.Build",
      ]);
      const website = plan.resources["Website"]!;
      const build = plan.resources["Website/Build"]!;
      if (website.action !== "create" || build.action !== "create") {
        throw new Error("An empty state must plan a new build and static Worker");
      }
      expect(website.props["main"]).toBeUndefined();
      expect(website.props["script"]).toBeUndefined();
      expect(website.props["domain"]).toEqual(
        stage === "prod"
          ? { name: "thiesen.dev", redirects: ["www.thiesen.dev"] }
          : undefined,
      );
      expect(website.props["assets"]).toMatchObject({
        notFoundHandling: "404-page",
      });
      expect(build.props).toMatchObject({
        command: "bun run build",
        outdir: "dist",
        memo: false,
      });
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temporary, { recursive: true, force: true });
  }
});
