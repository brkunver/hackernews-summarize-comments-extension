import {
  DEFAULT_MAX_COMMENTS,
  DEFAULT_MAX_COMMENT_DEPTH,
  DEFAULT_RANDOM_COMMENT_SELECTION,
  MAX_COMMENT_DEPTH_LIMIT,
  maxCommentDepthStore,
  maxCommentsStore,
  randomCommentSelectionStore,
} from "./storage"

interface ParsedComment {
  index: number
  text: string
  depth: number
}

function normalizeMaxComments(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_COMMENTS
  }

  return Math.floor(value)
}

function normalizeMaxDepth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_COMMENT_DEPTH
  }

  const floored = Math.floor(value)

  if (floored <= 0) {
    return floored === 0 ? 0 : -1
  }

  return Math.min(floored, MAX_COMMENT_DEPTH_LIMIT)
}

function getIndentLevel(indentEl: HTMLElement | null): number {
  const indent = Number.parseInt(indentEl?.getAttribute("indent") || "0", 10)

  if (!Number.isFinite(indent) || indent < 0) {
    return 0
  }

  return Math.min(indent, 20)
}

function sampleRandomIndices(total: number, count: number): Set<number> {
  const indices = Array.from({ length: total }, (_, index) => index)

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = indices[i]
    const other = indices[j]

    if (current !== undefined && other !== undefined) {
      indices[i] = other
      indices[j] = current
    }
  }

  return new Set(indices.slice(0, count))
}

export async function getHNCommentsForLLM(): Promise<string> {
  const commentRows = Array.from(document.querySelectorAll<HTMLElement>(".comtr"))

  if (commentRows.length === 0) {
    throw new Error("No Hacker News comments were found on this submission page.")
  }

  const [configuredMaxComments, configuredMaxDepth, randomSelection] = await Promise.all([
    maxCommentsStore.getValue(),
    maxCommentDepthStore.getValue(),
    randomCommentSelectionStore.getValue(),
  ])
  const maxComments = normalizeMaxComments(configuredMaxComments)
  const maxDepth = normalizeMaxDepth(configuredMaxDepth)
  const useRandomSelection = randomSelection ?? DEFAULT_RANDOM_COMMENT_SELECTION
  const hasDepthLimit = maxDepth > 0

  const parsedComments: ParsedComment[] = []

  commentRows.forEach((row, index) => {
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
      const depth = indentLevel + 1

      if (hasDepthLimit && depth > maxDepth) {
        return
      }

      const indentPrefix = "  ".repeat(indentLevel)

      parsedComments.push({
        index,
        text: `${indentPrefix}[${author}]: ${text}`,
        depth,
      })
    }
  })

  if (parsedComments.length === 0) {
    if (hasDepthLimit) {
      throw new Error("Comments were found, but none matched the configured maximum depth.")
    }

    throw new Error("Comments were found, but none contained readable text.")
  }

  const hasLimit = maxComments > 0
  let selectedComments = parsedComments
  let selectionNote = ""

  if (hasLimit && parsedComments.length > maxComments) {
    if (useRandomSelection) {
      const selectedIndices = sampleRandomIndices(parsedComments.length, maxComments)
      selectedComments = parsedComments
        .filter((_, position) => selectedIndices.has(position))
        .sort((a, b) => a.index - b.index)
      selectionNote = `[Note: Showing ${selectedComments.length} randomly selected comments out of ${parsedComments.length} depth-filtered comments (${commentRows.length} total on page) for processing]`
    } else {
      selectedComments = parsedComments.slice(0, maxComments)
      selectionNote = `[Note: Showing first ${selectedComments.length} comments out of ${parsedComments.length} depth-filtered comments (${commentRows.length} total on page) for processing]`
    }
  } else if (hasDepthLimit && parsedComments.length < commentRows.length) {
    selectionNote = `[Note: Showing ${parsedComments.length} comments within depth ${maxDepth} out of ${commentRows.length} total comments on page]`
  }

  let combinedString = `Comments :\n\n${selectedComments.map(comment => comment.text).join("\n\n")}`

  if (selectionNote !== "") {
    combinedString += `\n\n${selectionNote}`
  }

  return combinedString
}
