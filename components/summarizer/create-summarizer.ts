import { onCleanup, onMount } from "solid-js"
import { isHackerNewsSubmissionUrl } from "~/util/get-comments"
import { showCommentStatisticsStore } from "~/util/storage"
import { loadCachedSummary, loadLastSummaryError } from "./summarizer-cache"
import { setSummarizerError, setSummarizerErrorFromUnknown } from "./summarizer-errors"
import {
  cancelSummaryGeneration,
  checkOngoingGeneration,
  getComments,
  openSummarizerOptions,
} from "./summarizer-generation"
import { handleRuntimeSummaryMessage } from "./summarizer-messages"
import { readConfiguredModel } from "./summarizer-model"
import { createGenerationTracker, createSummarizerState } from "./summarizer-state"
import type { RuntimeSummaryMessage, SummarizerSource } from "./types"

export function createSummarizer(source: SummarizerSource) {
  const state = createSummarizerState()
  const tracker = createGenerationTracker()

  async function initialize(isMounted: () => boolean) {
    try {
      state.setShowCommentStatistics(await showCommentStatisticsStore.getValue())
      const url = await source.getUrl()

      if (!isMounted()) {
        return
      }

      if (!url) {
        setSummarizerError(state, "No URL found for the current page.")
        return
      }

      state.setCurrentUrl(url)
      const model = await readConfiguredModel()
      state.setCurrentModelName(model.name)
      state.setCurrentModelProvider(model.provider)

      if (!isMounted()) {
        return
      }

      state.setIsValidHackerNewsUrl(isHackerNewsSubmissionUrl(url))

      if (state.isValidHackerNewsUrl()) {
        await loadCachedSummary(state, tracker, url)
        const hasActiveGeneration = await checkOngoingGeneration(state, tracker)

        if (!hasActiveGeneration) {
          await loadLastSummaryError(state, url)
        }
      }
    } catch (err) {
      setSummarizerErrorFromUnknown(state, err, "Failed to load summarizer state.")
      console.error("Error loading summarizer state:", err)
    }
  }

  onMount(() => {
    let isMounted = true

    const handleRuntimeMessage = (message: RuntimeSummaryMessage) =>
      handleRuntimeSummaryMessage(state, tracker, message)
    const unwatchStatistics = showCommentStatisticsStore.watch(value => state.setShowCommentStatistics(value))

    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    void initialize(() => isMounted)

    onCleanup(() => {
      unwatchStatistics()
      isMounted = false
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
    })
  })

  return {
    ...state,
    getComments: (withContext = false, previewOnly = false) =>
      getComments(state, tracker, source, withContext, previewOnly),
    cancelSummaryGeneration: () => cancelSummaryGeneration(state, tracker),
    openOptions: () => openSummarizerOptions(state),
  }
}

export type SummarizerController = ReturnType<typeof createSummarizer>
