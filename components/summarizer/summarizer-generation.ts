import { isHackerNewsSubmissionUrl } from "~/util/get-comments"
import { getModelProvider } from "~/util/models"
import { ongoingGenerationStore } from "~/util/storage"
import { withTimeout } from "~/util/with-timeout"
import { loadCachedSummary } from "./summarizer-cache"
import { setSummarizerError, setSummarizerErrorFromUnknown } from "./summarizer-errors"
import {
  applyStreamState,
  clearSummarizerMessages,
  discardPartialSummary,
  resetGenerationState,
} from "./summarizer-messages"
import { readConfiguredModel } from "./summarizer-model"
import type { GenerationTracker, SummarizerState } from "./summarizer-state"
import type { GenerateSummaryResponse, GenerationStatusResponse, SummarizerSource } from "./types"

export async function checkOngoingGeneration(state: SummarizerState, tracker: GenerationTracker): Promise<boolean> {
  const requestedGenerationId = tracker.id
  const requestedRevision = tracker.revision

  try {
    const status = await withTimeout(
      browser.runtime.sendMessage({
        action: "getGenerationStatus",
        url: state.currentUrl(),
      }) as Promise<GenerationStatusResponse>,
      5000,
      "Timed out while checking summary generation status.",
    )

    if (tracker.id !== requestedGenerationId || tracker.revision !== requestedRevision) {
      return state.isGeneratingSummary() || state.isProcessingInBackground()
    }

    if (!status?.success) {
      setSummarizerError(state, status?.error || "Failed to check summary generation status.", status?.details)
      resetGenerationState(state, tracker)
      return false
    }

    if (status.generationId && status.generationId <= tracker.finishedId) {
      return false
    }

    if (status.active && status.model) {
      state.setIsProcessingInBackground(true)
      state.setIsGeneratingSummary(true)
      state.setCurrentModelName(status.model)
      state.setCurrentModelProvider(getModelProvider(status.model))
      applyStreamState(state, tracker, status)
      state.setGenerationErrorHistory(status.errorHistory ?? [])
      return true
    }

    discardPartialSummary(state)
    resetGenerationState(state, tracker)
    await loadCachedSummary(state, tracker, state.currentUrl())

    if (status.error) {
      setSummarizerError(state, status.error, status.details)
    }

    return false
  } catch (err) {
    const ongoing = await ongoingGenerationStore.getValue()

    if (ongoing && ongoing.url === state.currentUrl() && ongoing.timestamp > Date.now() - 300000) {
      state.setIsProcessingInBackground(true)
      state.setIsGeneratingSummary(true)
      state.setCurrentModelName(ongoing.model)
      state.setCurrentModelProvider(getModelProvider(ongoing.model))
      applyStreamState(state, tracker, ongoing)
      state.setGenerationErrorHistory(ongoing.errorHistory ?? [])
      state.setWarning("Could not confirm the background job status. If this stays stuck, cancel and try again.")
      return true
    }

    setSummarizerErrorFromUnknown(state, err, "Failed to check summary generation status.")
    console.error("Error checking ongoing generation:", err)
    return false
  }
}

export async function getComments(
  state: SummarizerState,
  tracker: GenerationTracker,
  source: SummarizerSource,
  withContext = false,
  previewOnly = false,
) {
  state.setIsLoading(true)
  clearSummarizerMessages(state)
  state.setCommentStatistics(null)

  try {
    const url = await source.getUrl()

    if (!url) {
      setSummarizerError(state, "No URL found for the current page.")
      return
    }

    state.setCurrentUrl(url)
    state.setIsValidHackerNewsUrl(isHackerNewsSubmissionUrl(url))

    if (!state.isValidHackerNewsUrl()) {
      setSummarizerError(state, "Open a Hacker News submission page before generating a summary.", "", "getComments")
      return
    }

    await loadCachedSummary(state, tracker, url)

    const contentResponse = await withTimeout(
      source.readComments({ withContext, previewOnly }),
      withContext ? 25000 : 8000,
      "Timed out while reading comments from the page. Reload the Hacker News tab and try again.",
    )

    if (contentResponse?.success && typeof contentResponse.comments === "string" && contentResponse.comments.trim()) {
      state.setComments(contentResponse.comments)
      state.setCommentStatistics(contentResponse.statistics ?? null)

      if (previewOnly) {
        return
      }

      console.log("Comments received:", contentResponse.comments)

      state.setIsProcessingInBackground(true)
      state.setIsGeneratingSummary(true)
      const model = await readConfiguredModel()
      state.setCurrentModelName(model.name)
      state.setCurrentModelProvider(model.provider)

      const backgroundResponse = await withTimeout(
        browser.runtime.sendMessage({
          action: "generateSummary",
          comments: contentResponse.comments,
          url,
          withContext,
          storyTitle: contentResponse.storyTitle ?? "",
          storyUrl: contentResponse.storyUrl ?? "",
          storyExcerpt: contentResponse.storyExcerpt ?? "",
          storyExcerptSkipped: contentResponse.storyExcerptSkipped ?? true,
        }) as Promise<GenerateSummaryResponse>,
        10000,
        "Timed out while starting summary generation. Please try again.",
      )

      if (!backgroundResponse?.success) {
        resetGenerationState(state, tracker)
        if (!backgroundResponse?.cancelled) {
          setSummarizerError(
            state,
            backgroundResponse?.error || "Failed to generate summary.",
            backgroundResponse?.details,
            "generateSummary",
          )
        }
        return
      }

      if (backgroundResponse.generationId && backgroundResponse.generationId > tracker.id) {
        tracker.id = backgroundResponse.generationId
        tracker.revision = -1
        state.setIsStreaming(backgroundResponse.streaming === true)
        if (backgroundResponse.streaming) {
          state.setSummary("")
        }
      }

      if (backgroundResponse.model) {
        state.setCurrentModelName(backgroundResponse.model)
        state.setCurrentModelProvider(getModelProvider(backgroundResponse.model))
      }

      console.log("Summary generation started in background")
    } else {
      setSummarizerError(
        state,
        contentResponse?.error || "Failed to get comments.",
        contentResponse?.details,
        "getComments",
      )
      console.error("Error getting comments:", contentResponse?.error)
    }
  } catch (err) {
    resetGenerationState(state, tracker)
    setSummarizerErrorFromUnknown(state, err, "Failed to read comments or start summary generation.", "getComments")
    console.error("Error:", err)
  } finally {
    state.setIsLoading(false)
  }
}

export async function cancelSummaryGeneration(state: SummarizerState, tracker: GenerationTracker) {
  if (!state.currentUrl() || state.isCancellingSummary()) {
    return
  }

  state.setIsCancellingSummary(true)
  clearSummarizerMessages(state)

  try {
    const response = await withTimeout(
      browser.runtime.sendMessage({
        action: "cancelSummaryGeneration",
        url: state.currentUrl(),
      }) as Promise<GenerateSummaryResponse>,
      5000,
      "Timed out while cancelling summary generation.",
    )

    discardPartialSummary(state)
    resetGenerationState(state, tracker)

    if (!response?.success && response?.error) {
      state.setWarning(response.error)
    }
  } catch (err) {
    setSummarizerErrorFromUnknown(state, err, "Failed to cancel summary generation.", "cancelSummaryGeneration")
    console.error("Error cancelling summary generation:", err)
  } finally {
    state.setIsCancellingSummary(false)
  }
}

export function openSummarizerOptions(state: SummarizerState) {
  void browser.runtime.openOptionsPage().catch(err => {
    setSummarizerErrorFromUnknown(state, err, "Failed to open options page.")
  })
}
