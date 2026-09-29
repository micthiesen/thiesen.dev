import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import { remarkDetails } from "./packages/content-core/details";

export default defineConfig({
  site: "https://thiesen.dev",
  output: "static",
  trailingSlash: "always",
  integrations: [solid(), sitemap()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkDetails] }),
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
  devToolbar: { enabled: false },
});
