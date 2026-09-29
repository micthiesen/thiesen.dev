import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://thiesen.dev",
  output: "static",
  trailingSlash: "always",
  integrations: [solid(), sitemap()],
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
  devToolbar: { enabled: false },
});
