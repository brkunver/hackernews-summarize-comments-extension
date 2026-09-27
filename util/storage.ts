import { storage } from "#imports"
import { GOOGLE_AI_MODEL_FALLBACKS } from "./models"

export const apiKeyStore = storage.defineItem<string>("sync:apiKey", {
  fallback: "",
  version: 2,
  migrations: {
    // Migration from v1 (local) to v2 (sync): move API key to sync storage
    2: (localValue: string): string => {
      return localValue
    },
  },
})

export const groqApiKeyStore = storage.defineItem<string>("sync:groqApiKey", {
  fallback: "",
  version: 1,
})

export const cerebrasApiKeyStore = storage.defineItem<string>("sync:cerebrasApiKey", {
  fallback: "",
  version: 1,
})

export const modelStore = storage.defineItem<string>("local:model", {
  fallback: GOOGLE_AI_MODEL_FALLBACKS[0],
  version: 1,
})

export const modelChainStore = storage.defineItem<string[]>("local:modelChain", {
  fallback: [],
  version: 1,
})

export const DEFAULT_MAX_COMMENTS = 100

export const maxCommentsStore = storage.defineItem<number>("local:maxComments", {
  fallback: DEFAULT_MAX_COMMENTS,
  version: 1,
})

export const DEFAULT_RANDOM_COMMENT_SELECTION = true

export const randomCommentSelectionStore = storage.defineItem<boolean>("local:randomCommentSelection", {
  fallback: DEFAULT_RANDOM_COMMENT_SELECTION,
  version: 1,
})

export const DEFAULT_MAX_COMMENT_DEPTH = 2
export const MAX_COMMENT_DEPTH_LIMIT = 20

export const maxCommentDepthStore = storage.defineItem<number>("local:maxCommentDepth", {
  fallback: DEFAULT_MAX_COMMENT_DEPTH,
  version: 1,
})

export const customGoogleModelsStore = storage.defineItem<string[]>("local:customGoogleModels", {
  fallback: [],
  version: 1,
})

export const DEFAULT_SUMMARY_TIMEOUT_SECONDS = 10

export const timeoutStore = storage.defineItem<number>("sync:timeout", {
  fallback: DEFAULT_SUMMARY_TIMEOUT_SECONDS,
  version: 1,
})

interface SavedSummaryV1 {
  id: string
  summary: string
}

export interface SavedSummaryV2 {
  id: string
  summary: string
  createdBy: string
  provider?: string
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

export interface OngoingGeneration {
  url: string
  model: string
  timestamp: number
  errorHistory?: GenerationErrorHistoryItem[]
}

export interface GenerationErrorHistoryItem {
  model: string
  message: string
  details?: string
  reason: string
  timestamp: number
}

export const ongoingGenerationStore = storage.defineItem<OngoingGeneration | null>("local:ongoingGeneration", {
  fallback: null,
  version: 1,
})

export interface LastSummaryError {
  url: string
  message: string
  details?: string
  action: "getComments" | "generateSummary" | "generationStatus" | "cancelSummaryGeneration"
  timestamp: number
}

export const lastSummaryErrorStore = storage.defineItem<LastSummaryError | null>("local:lastSummaryError", {
  fallback: null,
  version: 1,
})

export const systemPromptStore = storage.defineItem<string>("sync:systemPrompt", {
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
  version: 2,
  migrations: {
    // Migration from v1 (local) to v2 (sync): move system prompt to sync storage
    2: (localValue: string): string => {
      return localValue
    },
  },
})
