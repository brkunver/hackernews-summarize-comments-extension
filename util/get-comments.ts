import { maxCommentsStore } from "./storage"

export async function getHNCommentsForLLM(): Promise<string> {
  const commentRows = document.querySelectorAll(".comtr")
  let combinedString = "Comments :\n\n"

  // Get max comments from storage
  const maxComments = await maxCommentsStore.getValue()

  // Determine if there's a limit (0 or -1 means no limit)
  const hasLimit = maxComments > 0
  const limitedCommentRows = hasLimit ? Array.from(commentRows).slice(0, maxComments) : Array.from(commentRows)

  limitedCommentRows.forEach(row => {
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

  // Add note if comments were truncated
  if (hasLimit && commentRows.length > maxComments) {
    combinedString += `\n\n[Note: Showing first ${maxComments} comments out of ${commentRows.length} total comments for processing]`
  }

  return combinedString
}
