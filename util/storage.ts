import { storage } from "#imports"

export const apiKeyStore = storage.defineItem<string>("local:apiKey", {
  fallback: "",
})

export const modelStore = storage.defineItem<string>("local:model", {
  fallback: "gemini-2.5-flash",
})

interface SavedSummaryV1 {
  id: string
  summary: string
}

export interface SavedSummaryV2 {
  id: string
  summary: string
  createdBy: string
}

export const savedSummariesStore = storage.defineItem<SavedSummaryV2[]>("local:savedSummaries", {
  fallback: [],
  version: 2,
  migrations: {
    // Migration from v1 to v2: add createdBy field with default value
    2: (summaries: SavedSummaryV1[]): SavedSummaryV2[] => {
      return summaries.map(summary => ({
        ...summary,
        createdBy: "unknown", // Default value for existing summaries
      }))
    },
  },
})

export const systemPromptStore = storage.defineItem<string>("local:systemPrompt", {
  fallback: `You are an assistant that summarizes Hacker News comment threads.

Your task:
- Read a list of Hacker News comments.
- Identify the main ideas, recurring arguments, disagreements, and overall sentiment.
- Ignore low-effort, off-topic, or purely emotional comments unless they represent a common pattern.
- Do not quote usernames or comment scores.
- Do not restate the original post unless necessary for context.

Output rules:
- Produce a concise summary in 3 to 6 bullet points.
- Output in English.
- Use Markdown
- Add empty lines between bullet points.
- Each bullet should represent a distinct viewpoint or theme.
- Focus on reasoning, trade-offs, and implicit assumptions.
- Be neutral, analytical, and opinion-agnostic.
- Avoid generic phrasing like "people think" or "some users say".
- Prefer concrete insights over surface-level summaries.

Style:
- Clear, compact, and factual.
- No emojis.
- No filler.
  `,
})
