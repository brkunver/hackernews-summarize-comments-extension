export default defineContentScript({
  matches: ["https://news.ycombinator.com/*"],
  main() {
    console.log("HackerNews Summarize Comments loaded")
  },
})
