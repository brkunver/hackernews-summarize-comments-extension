function getHNCommentsForLLM(): string {
  const commentRows = document.querySelectorAll(".comtr")
  let combinedString = "Hacker News Yorumları:\n\n"

  commentRows.forEach(row => {
    const authorEl = row.querySelector(".hnuser") as HTMLElement | null
    const textEl = row.querySelector(".commtext") as HTMLElement | null
    const indentEl = row.querySelector(".ind") as HTMLElement | null

    if (authorEl && textEl) {
      const author = authorEl.innerText.trim()
      const text = textEl.innerText.trim()

      const indentLevel = indentEl ? parseInt(indentEl.getAttribute("indent") || "0", 10) : 0
      const indentPrefix = "  ".repeat(indentLevel)

      combinedString += `${indentPrefix}[${author}]: ${text}\n\n`
    }
  })

  return combinedString
}

const llmInput = getHNCommentsForLLM()
console.log(llmInput)
