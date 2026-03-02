import { defineConfig } from "wxt"
import tailwindcss from "@tailwindcss/vite"

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Hackernews Summarize Comments",
    description: "Summarize comments on Hackernews submission page using AI",
    permissions: ["storage", "tabs"],
    browser_specific_settings: {
      gecko: {
        id: "hackernews-summarize-comments@kunver.com",
        // @ts-ignore - WXT doesn't support this field yet
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
  modules: ["@wxt-dev/module-svelte"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: {
    disabled: true,
  },
})
