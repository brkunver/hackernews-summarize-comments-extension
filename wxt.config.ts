import { defineConfig } from "wxt"
import tailwindcss from "@tailwindcss/vite"

function usesDevBranding(command: "build" | "serve", mode: string) {
  return command === "serve" || mode === "development"
}

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
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (usesDevBranding(wxt.config.command, wxt.config.mode) && manifest.name) {
        manifest.name = `${manifest.name} (DEV)`
      }
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
