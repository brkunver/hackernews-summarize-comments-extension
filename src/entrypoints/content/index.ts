import { getHNCommentsForLLM } from "~/util/get-comments"

export default defineContentScript({
  matches: ["https://news.ycombinator.com/*"],
  main() {
    console.log("HackerNews Summarize Comments loaded")

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "getComments") {
        try {
          const comments = getHNCommentsForLLM()
          sendResponse({ success: true, comments })
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      return true // Keep the message channel open for async response
    })
  },
})
