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
    // Needed to fetch the linked story article for "Generate Summary with Context".
    // The fetch is best-effort: if the site blocks it, only the story link is sent to the AI.
    host_permissions: ["http://*/*", "https://*/*"],
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
        const devExtensionName = `(DEV) ${manifest.name}`
        manifest.name = devExtensionName

        if (manifest.action) {
          manifest.action.default_title = devExtensionName
        }
      }
    },
  },
  modules: ["@wxt-dev/module-solid"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  webExt: {
    disabled: true,
  },
})
