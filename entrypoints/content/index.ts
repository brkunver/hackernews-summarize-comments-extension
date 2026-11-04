import { collectHNComments } from "@@/util/collect-comments"
import { isHackerNewsSubmissionUrl } from "@@/util/get-comments"
import "~/assets/tailwind.css"
import { mountSummarizerUi } from "./ui"

export default defineContentScript({
  matches: ["https://news.ycombinator.com/*"],
  cssInjectionMode: "ui",
  main(ctx) {
    console.log("HackerNews Summarize Comments loaded")

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action !== "getComments") {
        return false
      }

      async function readComments() {
        try {
          const collected = await collectHNComments({
            withContext: message?.withContext === true,
            previewOnly: message?.previewOnly === true,
          })

          sendResponse({ success: true, ...collected })
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      void readComments()

      return true
    })

    if (isHackerNewsSubmissionUrl(location.href)) {
      void mountSummarizerUi(ctx).catch(error => {
        console.warn("Failed to mount the in-page summary panel.", error)
      })
    }
  },
})
