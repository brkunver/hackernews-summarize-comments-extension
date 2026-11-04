import { getErrorMessage } from "~/util/errors"
import { getModelProvider, type AiProvider } from "~/util/models"
import { lastSummaryErrorStore, savedSummariesStore } from "~/util/storage"
import { setSummarizerError } from "./summarizer-errors"
import type { GenerationTracker, SummarizerState } from "./summarizer-state"

const LAST_ERROR_DISPLAY_MS = 24 * 60 * 60 * 1000

export async function loadCachedSummary(
  state: SummarizerState,
  tracker: GenerationTracker,
  url: string,
): Promise<boolean> {
  try {
    const observedGenerationId = tracker.id
    const observedFinishedId = tracker.finishedId
    const savedSummaries = await savedSummariesStore.getValue()

    if (tracker.id !== observedGenerationId || tracker.finishedId !== observedFinishedId) {
      return false
    }

    const cachedSummary = savedSummaries.find(item => item.id === url)

    if (cachedSummary?.summary?.trim()) {
      state.setSummary(cachedSummary.summary)
      state.setSummaryWithContext(cachedSummary.withContext === true)
      state.setSummaryCreatedBy(cachedSummary.createdBy)
      state.setSummaryCreatedByProvider(
        (cachedSummary.provider as AiProvider | undefined) || getModelProvider(cachedSummary.createdBy),
      )
      console.log("Loaded cached summary for:", url)
      return true
    }
  } catch (err) {
    state.setWarning(`Cached summary could not be loaded: ${getErrorMessage(err)}`)
    console.error("Error loading cached summary:", err)
  }

  return false
}

export async function loadLastSummaryError(state: SummarizerState, url: string) {
  try {
    const lastError = await lastSummaryErrorStore.getValue()

    if (lastError?.url === url && lastError.timestamp > Date.now() - LAST_ERROR_DISPLAY_MS) {
      setSummarizerError(state, lastError.message, lastError.details)
    }
  } catch (err) {
    console.error("Error loading last summary error:", err)
  }
}
