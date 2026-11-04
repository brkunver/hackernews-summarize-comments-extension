import type { CommentStatistics } from "~/util/get-comments"
import type { AiProvider } from "~/util/models"
import type { GenerationErrorHistoryItem } from "~/util/storage"

export interface GetCommentsResponse {
  statistics?: CommentStatistics
  success?: boolean
  comments?: string
  storyTitle?: string
  storyUrl?: string
  storyExcerpt?: string
  storyExcerptSkipped?: boolean
  error?: string
  details?: string
}

export interface ReadCommentsOptions {
  withContext: boolean
  previewOnly: boolean
}

export interface SummarizerSource {
  getUrl: () => Promise<string | null>
  readComments: (options: ReadCommentsOptions) => Promise<GetCommentsResponse>
}

export interface GenerateSummaryResponse {
  generationId?: number
  streaming?: boolean
  success?: boolean
  started?: boolean
  model?: string
  error?: string
  details?: string
  cancelled?: boolean
}

export interface GenerationStatusResponse {
  generationId?: number
  revision?: number
  streaming?: boolean
  summary?: string
  withContext?: boolean
  success?: boolean
  active?: boolean
  model?: string
  timestamp?: number
  error?: string
  details?: string
  errorHistory?: GenerationErrorHistoryItem[]
}

export interface RuntimeSummaryMessage {
  generationId?: number
  revision?: number
  streaming?: boolean
  action?: string
  url?: string
  summary?: string
  model?: string
  provider?: AiProvider
  withContext?: boolean
  error?: string
  details?: string
  warning?: string
  errorHistory?: GenerationErrorHistoryItem[]
}
