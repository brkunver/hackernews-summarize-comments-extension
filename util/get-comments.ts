import { DEFAULT_MAX_COMMENTS, maxCommentsStore } from "./storage"

function normalizeMaxComments(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_COMMENTS
  }

  return Math.floor(value)
}

function getIndentLevel(indentEl: HTMLElement | null): number {
  const indent = Number.parseInt(indentEl?.getAttribute("indent") || "0", 10)

  if (!Number.isFinite(indent) || indent < 0) {
    return 0
  }

  return Math.min(indent, 20)
}

export async function getHNCommentsForLLM(): Promise<string> {
  const commentRows = Array.from(document.querySelectorAll<HTMLElement>(".comtr"))

  if (commentRows.length === 0) {
    throw new Error("No Hacker News comments were found on this submission page.")
  }

  const maxComments = normalizeMaxComments(await maxCommentsStore.getValue())
  const hasLimit = maxComments > 0
  const limitedCommentRows = hasLimit ? commentRows.slice(0, maxComments) : commentRows
  const parsedComments: string[] = []

  limitedCommentRows.forEach(row => {
    const authorEl = row.querySelector(".hnuser") as HTMLElement | null
    const textEl = row.querySelector(".commtext") as HTMLElement | null
    const indentEl = row.querySelector(".ind") as HTMLElement | null

    if (authorEl && textEl) {
      const author = authorEl.innerText.trim()
      const text = textEl.innerText.trim()

      if (author === "" || text === "") {
        return
      }

      const indentLevel = getIndentLevel(indentEl)
      const indentPrefix = "  ".repeat(indentLevel)

      parsedComments.push(`${indentPrefix}[${author}]: ${text}`)
    }
  })

  if (parsedComments.length === 0) {
    throw new Error("Comments were found, but none contained readable text.")
  }

  let combinedString = `Comments :\n\n${parsedComments.join("\n\n")}`

  if (hasLimit && commentRows.length > maxComments) {
    combinedString += `\n\n[Note: Showing first ${maxComments} comments out of ${commentRows.length} total comments for processing]`
  }

  return combinedString
}
