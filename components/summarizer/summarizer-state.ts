import { createSignal } from "solid-js"
import type { CommentStatistics } from "~/util/get-comments"
import { formatModelWithProvider, type AiProvider } from "~/util/models"
import type { GenerationErrorHistoryItem } from "~/util/storage"

export interface GenerationTracker {
  id: number
  revision: number
  finishedId: number
}

export function createGenerationTracker(): GenerationTracker {
  return {
    id: 0,
    revision: -1,
    finishedId: 0,
  }
}

export function createSummarizerState() {
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [isLoading, setIsLoading] = createSignal(false)
  const [commentStatistics, setCommentStatistics] = createSignal<CommentStatistics | null>(null)
  const [showCommentStatistics, setShowCommentStatistics] = createSignal(true)
  const [comments, setComments] = createSignal("")
  const [summary, setSummary] = createSignal("")
  const [summaryWithContext, setSummaryWithContext] = createSignal(false)
  const [error, setError] = createSignal("")
  const [errorDetails, setErrorDetails] = createSignal("")
  const [warning, setWarning] = createSignal("")
  const [isGeneratingSummary, setIsGeneratingSummary] = createSignal(false)
  const [isCancellingSummary, setIsCancellingSummary] = createSignal(false)
  const [currentUrl, setCurrentUrl] = createSignal("")
  const [isProcessingInBackground, setIsProcessingInBackground] = createSignal(false)
  const [currentModelName, setCurrentModelName] = createSignal("")
  const [currentModelProvider, setCurrentModelProvider] = createSignal<AiProvider | null>(null)
  const [summaryCreatedBy, setSummaryCreatedBy] = createSignal("")
  const [summaryCreatedByProvider, setSummaryCreatedByProvider] = createSignal<AiProvider | null>(null)
  const [isValidHackerNewsUrl, setIsValidHackerNewsUrl] = createSignal(false)
  const [generationErrorHistory, setGenerationErrorHistory] = createSignal<GenerationErrorHistoryItem[]>([])

  const isBusy = () => isLoading() || isGeneratingSummary() || isProcessingInBackground()
  const currentModelLabel = () =>
    currentModelName() ? formatModelWithProvider(currentModelName(), currentModelProvider()) : "Loading..."
  const summaryCreatedByLabel = () =>
    summaryCreatedBy() ? formatModelWithProvider(summaryCreatedBy(), summaryCreatedByProvider()) : ""

  function buttonText() {
    if (!isValidHackerNewsUrl()) {
      return "Not a Hacker News Page"
    }

    if (isLoading()) {
      return "Loading..."
    }

    if (isGeneratingSummary() || isProcessingInBackground()) {
      return "Generating..."
    }

    if (summary().trim()) {
      return "Regenerate Summary"
    }

    return "Generate Summary"
  }

  function buttonTextWithContext() {
    if (!isValidHackerNewsUrl()) {
      return "Not a Hacker News Page"
    }

    if (isLoading()) {
      return "Loading..."
    }

    if (isGeneratingSummary() || isProcessingInBackground()) {
      return "Generating..."
    }

    if (summary().trim()) {
      return "Regenerate with Context"
    }

    return "Generate Summary with Context"
  }

  return {
    isStreaming,
    setIsStreaming,
    isLoading,
    setIsLoading,
    commentStatistics,
    setCommentStatistics,
    showCommentStatistics,
    setShowCommentStatistics,
    comments,
    setComments,
    summary,
    setSummary,
    summaryWithContext,
    setSummaryWithContext,
    error,
    setError,
    errorDetails,
    setErrorDetails,
    warning,
    setWarning,
    isGeneratingSummary,
    setIsGeneratingSummary,
    isCancellingSummary,
    setIsCancellingSummary,
    currentUrl,
    setCurrentUrl,
    isProcessingInBackground,
    setIsProcessingInBackground,
    currentModelName,
    setCurrentModelName,
    currentModelProvider,
    setCurrentModelProvider,
    summaryCreatedBy,
    setSummaryCreatedBy,
    summaryCreatedByProvider,
    setSummaryCreatedByProvider,
    isValidHackerNewsUrl,
    setIsValidHackerNewsUrl,
    generationErrorHistory,
    setGenerationErrorHistory,
    isBusy,
    currentModelLabel,
    summaryCreatedByLabel,
    buttonText,
    buttonTextWithContext,
  }
}

export type SummarizerState = ReturnType<typeof createSummarizerState>
