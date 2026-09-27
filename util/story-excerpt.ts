const STORY_FETCH_TIMEOUT_MS = 9000
const MAX_EXCERPT_CHARS = 6000
const MAX_HTML_CHARS = 500_000

export interface StoryExcerptResult {
  excerpt: string
  truncated: boolean
  /** True when fetching was skipped on purpose (empty or HN-internal URL), as opposed to failed. */
  skipped: boolean
}

const EMPTY_RESULT: StoryExcerptResult = { excerpt: "", truncated: false, skipped: false }

function isSkippableStoryUrl(storyUrl: string): boolean {
  try {
    const parsed = new URL(storyUrl)

    return parsed.hostname === "news.ycombinator.com" || parsed.hostname.endsWith(".ycombinator.com")
  } catch {
    return true
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function extractArticleText(doc: Document): string {
  doc
    .querySelectorAll(
      "script, style, noscript, template, nav, header, footer, aside, form, button, svg, canvas, video, audio, iframe",
    )
    .forEach(element => element.remove())

  const root = doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body

  if (!root) {
    return ""
  }

  const parts: string[] = []

  root.querySelectorAll("h1, h2, h3, p").forEach(element => {
    const text = collapseWhitespace(element.textContent ?? "")

    if (text === "") {
      return
    }

    if (element.tagName === "P" && text.length < 40) {
      return
    }

    parts.push(text)
  })

  return parts.join("\n\n")
}

export async function fetchStoryExcerpt(
  storyUrl: string,
  timeoutMs = STORY_FETCH_TIMEOUT_MS,
): Promise<StoryExcerptResult> {
  const url = storyUrl.trim()

  if (url === "" || isSkippableStoryUrl(url)) {
    return { ...EMPTY_RESULT, skipped: true }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      credentials: "omit",
      headers: { Accept: "text/html" },
    })

    if (!response.ok) {
      return EMPTY_RESULT
    }

    const contentType = response.headers.get("content-type") ?? ""

    if (contentType !== "" && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return EMPTY_RESULT
    }

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html.slice(0, MAX_HTML_CHARS), "text/html")
    const text = extractArticleText(doc).trim()

    if (text === "") {
      return EMPTY_RESULT
    }

    if (text.length > MAX_EXCERPT_CHARS) {
      return { excerpt: `${text.slice(0, MAX_EXCERPT_CHARS).trimEnd()}…`, truncated: true, skipped: false }
    }

    return { excerpt: text, truncated: false, skipped: false }
  } catch {
    return EMPTY_RESULT
  } finally {
    clearTimeout(timer)
  }
}
