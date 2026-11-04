import { getModelProvider } from "~/util/models"
import { setSummarizerError } from "./summarizer-errors"
import type { GenerationTracker, SummarizerState } from "./summarizer-state"
import type { GenerationStatusResponse, RuntimeSummaryMessage } from "./types"

export function applyStreamState(state: SummarizerState, tracker: GenerationTracker, status: GenerationStatusResponse) {
  if (!status.generationId || status.generationId <= tracker.finishedId || status.generationId < tracker.id) {
    return
  }

  if (status.generationId > tracker.id) {
    tracker.id = status.generationId
    tracker.revision = -1
  }

  if ((status.revision ?? 0) < tracker.revision) {
    return
  }

  tracker.revision = status.revision ?? 0
  state.setIsStreaming(status.streaming === true)

  if (status.streaming) {
    state.setSummary(status.summary ?? "")
    state.setSummaryWithContext(status.withContext === true)
    state.setSummaryCreatedBy("")
  }
}

export function discardPartialSummary(state: SummarizerState) {
  if (state.isStreaming()) {
    state.setSummary("")
    state.setSummaryCreatedBy("")
  }
}

export function resetGenerationState(state: SummarizerState, tracker: GenerationTracker) {
  tracker.finishedId = Math.max(tracker.finishedId, tracker.id)
  state.setIsStreaming(false)
  state.setIsProcessingInBackground(false)
  state.setIsGeneratingSummary(false)
  state.setIsCancellingSummary(false)
  state.setGenerationErrorHistory([])
}

export function clearSummarizerMessages(state: SummarizerState) {
  state.setError("")
  state.setErrorDetails("")
  state.setWarning("")
  state.setGenerationErrorHistory([])
}

export function handleRuntimeSummaryMessage(
  state: SummarizerState,
  tracker: GenerationTracker,
  message: RuntimeSummaryMessage,
) {
  if (message.url !== state.currentUrl()) {
    return
  }

  if (message.generationId && (message.generationId < tracker.id || message.generationId <= tracker.finishedId)) {
    return
  }

  if (message.generationId && message.generationId > tracker.id) {
    tracker.id = message.generationId
    tracker.revision = -1
  }

  if (message.action === "summaryComplete") {
    if (!message.summary?.trim()) {
      resetGenerationState(state, tracker)
      setSummarizerError(state, "Summary generation completed, but the response was empty.")
      return
    }

    state.setSummary(message.summary)
    state.setSummaryWithContext(message.withContext === true)
    state.setSummaryCreatedBy(message.model || state.currentModelName())
    state.setSummaryCreatedByProvider(message.provider || getModelProvider(state.summaryCreatedBy()))
    state.setCurrentModelName(message.model || state.currentModelName())
    state.setCurrentModelProvider(message.provider || getModelProvider(state.currentModelName()))
    state.setWarning(message.warning || "")
    state.setError("")
    state.setErrorDetails("")
    resetGenerationState(state, tracker)
    console.log("Summary completed in background:", message.summary)
  }

  if (message.action === "generationUpdated") {
    if (message.revision !== undefined && message.revision < tracker.revision) {
      return
    }

    state.setIsGeneratingSummary(true)
    state.setIsProcessingInBackground(true)

    if (message.revision !== undefined) {
      applyStreamState(state, tracker, message)
    }

    if (message.model) {
      state.setCurrentModelName(message.model)
      state.setCurrentModelProvider(getModelProvider(message.model))
    }

    state.setGenerationErrorHistory(message.errorHistory ?? [])
  }

  if (message.action === "summaryFailed") {
    discardPartialSummary(state)
    resetGenerationState(state, tracker)
    setSummarizerError(state, message.error || "Summary generation failed.", message.details)
  }

  if (message.action === "summaryCancelled") {
    discardPartialSummary(state)
    resetGenerationState(state, tracker)
    state.setWarning("Summary generation was cancelled.")
  }
}
