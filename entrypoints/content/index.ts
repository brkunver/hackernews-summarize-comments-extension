import { getHNCommentsForLLM, getHNStoryContext } from "@@/util/get-comments"
import { fetchStoryExcerpt } from "@@/util/story-excerpt"

export default defineContentScript({
  matches: ["https://news.ycombinator.com/*"],
  main() {
    console.log("HackerNews Summarize Comments loaded")

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action !== "getComments") {
        return false
      }

      const withContext = message?.withContext === true

      async function readComments() {
        try {
          const { comments, statistics } = await getHNCommentsForLLM(message.previewOnly === true)
          const story = getHNStoryContext()
          let storyExcerpt = ""
          let storyExcerptSkipped = true

          if (withContext && story.url !== "") {
            const result = await fetchStoryExcerpt(story.url)
            storyExcerpt = result.excerpt
            storyExcerptSkipped = result.skipped
          }

          sendResponse({
            success: true,
            comments,
            statistics,
            storyTitle: story.title,
            storyUrl: story.url,
            storyExcerpt,
            storyExcerptSkipped,
          })
        } catch (error) {
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
        }
      }
      void readComments()

      return true
    })
  },
})
