<script lang="ts">
  import {
    customGoogleModelsStore,
    lastSummaryErrorStore,
    savedSummariesStore,
    modelChainStore,
    modelStore,
    ongoingGenerationStore,
    type GenerationErrorHistoryItem,
    type LastSummaryError,
  } from "~/util/storage"
  import { formatModelWithProvider, getConfiguredModelChain, getModelProvider, type AiProvider } from "~/util/models"
  import { getErrorMessage } from "~/util/errors"
  import { onMount } from "svelte"
  import snarkdown from "snarkdown"

  interface GetCommentsResponse {
    success?: boolean
    comments?: string
    error?: string
    details?: string
  }

  interface GenerateSummaryResponse {
    success?: boolean
    started?: boolean
    model?: string
    error?: string
    details?: string
    cancelled?: boolean
  }

  interface GenerationStatusResponse {
    success?: boolean
    active?: boolean
    model?: string
    timestamp?: number
    error?: string
    details?: string
    errorHistory?: GenerationErrorHistoryItem[]
  }

  interface RuntimeSummaryMessage {
    action?: string
    url?: string
    summary?: string
    model?: string
    provider?: AiProvider
    error?: string
    details?: string
    warning?: string
    errorHistory?: GenerationErrorHistoryItem[]
  }

  interface FormattedErrorItem {
    model: string
    message: string
  }

  const LAST_ERROR_DISPLAY_MS = 24 * 60 * 60 * 1000
  const ALL_MODELS_FAILED_PREFIX = "All configured AI models failed: "

  let isLoading = $state(false)
  let buttonText = $state("Get Comments")
  let comments = $state("")
  let summary = $state("")
  let error = $state("")
  let errorDetails = $state("")
  let warning = $state("")
  let isGeneratingSummary = $state(false)
  let isCancellingSummary = $state(false)
  let currentUrl = $state("")
  let isProcessingInBackground = $state(false)
  let currentModelName = $state("")
  let currentModelProvider = $state<AiProvider | null>(null)
  let summaryCreatedBy = $state("")
  let summaryCreatedByProvider = $state<AiProvider | null>(null)
  let isValidHackerNewsUrl = $state(false)
  let generationErrorHistory = $state<GenerationErrorHistoryItem[]>([])

  function checkIfHackerNewsUrl(url: string): boolean {
    return url.includes("news.ycombinator.com/item?id=")
  }

  async function loadCurrentModel() {
    const [configuredModelChain, legacyModel, customGoogleModels] = await Promise.all([
      modelChainStore.getValue(),
      modelStore.getValue(),
      customGoogleModelsStore.getValue(),
    ])
    const currentModel = getConfiguredModelChain(configuredModelChain, legacyModel, customGoogleModels)[0] ?? ""

    currentModelName = currentModel
    currentModelProvider = getModelProvider(currentModel)
  }

  onMount(() => {
    let isMounted = true

    const handleRuntimeMessage = (message: RuntimeSummaryMessage) => {
      if (message.url !== currentUrl) {
        return
      }

      if (message.action === "summaryComplete") {
        handleSummaryComplete(message)
      }

      if (message.action === "generationUpdated") {
        if (message.model) {
          currentModelName = message.model
          currentModelProvider = getModelProvider(message.model)
        }

        generationErrorHistory = message.errorHistory ?? []
        updateButtonText()
      }

      if (message.action === "summaryFailed") {
        resetGenerationState()
        setErrorMessage(message.error || "Summary generation failed.", message.details)
        updateButtonText()
      }

      if (message.action === "summaryCancelled") {
        resetGenerationState()
        warning = "Summary generation was cancelled."
        updateButtonText()
      }
    }

    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    void initializePopup(() => isMounted)

    return () => {
      isMounted = false
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  })

  async function initializePopup(isMounted: () => boolean) {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

      if (!isMounted()) {
        return
      }

      if (tab.url) {
        currentUrl = tab.url
        await loadCurrentModel()

        if (!isMounted()) {
          return
        }

        isValidHackerNewsUrl = checkIfHackerNewsUrl(tab.url)
        if (isValidHackerNewsUrl) {
          await loadCachedSummary(tab.url)
          const hasActiveGeneration = await checkOngoingGeneration()

          if (!hasActiveGeneration) {
            await loadLastSummaryError(tab.url)
          }
        }
        updateButtonText()
      } else {
        setErrorMessage("No URL found for the current tab.")
      }
    } catch (err) {
      setErrorFromUnknown(err, "Failed to load popup state.")
      console.error("Error loading popup state:", err)
    }
  }

  async function loadCachedSummary(url: string): Promise<boolean> {
    try {
      const savedSummaries = await savedSummariesStore.getValue()
      const cachedSummary = savedSummaries.find(item => item.id === url)

      if (cachedSummary?.summary?.trim()) {
        summary = cachedSummary.summary
        summaryCreatedBy = cachedSummary.createdBy
        summaryCreatedByProvider =
          (cachedSummary.provider as AiProvider | undefined) || getModelProvider(cachedSummary.createdBy)
        console.log("Loaded cached summary for:", url)
        return true
      }
    } catch (err) {
      warning = `Cached summary could not be loaded: ${getErrorMessage(err)}`
      console.error("Error loading cached summary:", err)
    }

    return false
  }

  async function loadLastSummaryError(url: string) {
    try {
      const lastError = await lastSummaryErrorStore.getValue()

      if (lastError?.url === url && lastError.timestamp > Date.now() - LAST_ERROR_DISPLAY_MS) {
        setErrorMessage(lastError.message, lastError.details)
      }
    } catch (err) {
      console.error("Error loading last summary error:", err)
    }
  }

  function updateButtonText() {
    if (!isValidHackerNewsUrl) {
      buttonText = "Not a Hacker News Page"
    } else if (isLoading) {
      buttonText = "Loading..."
    } else if (isGeneratingSummary || isProcessingInBackground) {
      buttonText = "Generating..."
    } else if (summary?.trim()) {
      buttonText = "Regenerate Summary"
    } else {
      buttonText = "Generate Summary"
    }
  }

  async function checkOngoingGeneration(): Promise<boolean> {
    try {
      const status = await withTimeout(
        browser.runtime.sendMessage({
          action: "getGenerationStatus",
          url: currentUrl,
        }) as Promise<GenerationStatusResponse>,
        5000,
        "Timed out while checking summary generation status.",
      )

      if (!status?.success) {
        setErrorMessage(status?.error || "Failed to check summary generation status.", status?.details)
        resetGenerationState()
        return false
      }

      if (status.active && status.model) {
        isProcessingInBackground = true
        isGeneratingSummary = true
        currentModelName = status.model
        currentModelProvider = getModelProvider(status.model)
        generationErrorHistory = status.errorHistory ?? []
        updateButtonText()
        return true
      }

      resetGenerationState()

      if (status.error) {
        setErrorMessage(status.error, status.details)
      }

      return false
    } catch (err) {
      const ongoing = await ongoingGenerationStore.getValue()

      if (ongoing && ongoing.url === currentUrl && ongoing.timestamp > Date.now() - 300000) {
        isProcessingInBackground = true
        isGeneratingSummary = true
        currentModelName = ongoing.model
        currentModelProvider = getModelProvider(ongoing.model)
        generationErrorHistory = ongoing.errorHistory ?? []
        warning = "Could not confirm the background job status. If this stays stuck, cancel and try again."
        updateButtonText()
        return true
      }

      setErrorFromUnknown(err, "Failed to check summary generation status.")
      console.error("Error checking ongoing generation:", err)
      return false
    }
  }

  async function getComments() {
    isLoading = true
    updateButtonText()
    clearMessages()

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        setErrorMessage("No active tab found.")
        return
      }

      if (!tab.url) {
        setErrorMessage("No URL found for the current tab.")
        return
      }

      currentUrl = tab.url
      isValidHackerNewsUrl = checkIfHackerNewsUrl(tab.url)

      if (!isValidHackerNewsUrl) {
        setErrorMessage("Open a Hacker News submission page before generating a summary.", "", "getComments")
        return
      }

      await loadCachedSummary(tab.url)

      const contentResponse = await withTimeout(
        browser.tabs.sendMessage(tab.id, { action: "getComments" }) as Promise<GetCommentsResponse>,
        8000,
        "Timed out while reading comments from the page. Reload the Hacker News tab and try again.",
      )

      if (contentResponse?.success && typeof contentResponse.comments === "string" && contentResponse.comments.trim()) {
        comments = contentResponse.comments
        console.log("Comments received:", contentResponse.comments)

        isProcessingInBackground = true
        isGeneratingSummary = true
        await loadCurrentModel()

        const backgroundResponse = await withTimeout(
          browser.runtime.sendMessage({
            action: "generateSummary",
            comments: contentResponse.comments,
            url: tab.url,
          }) as Promise<GenerateSummaryResponse>,
          10000,
          "Timed out while starting summary generation. Please try again.",
        )

        if (!backgroundResponse?.success) {
          resetGenerationState()
          if (!backgroundResponse?.cancelled) {
            setErrorMessage(
              backgroundResponse?.error || "Failed to generate summary.",
              backgroundResponse?.details,
              "generateSummary",
            )
          }
          return
        }

        if (backgroundResponse.model) {
          currentModelName = backgroundResponse.model
          currentModelProvider = getModelProvider(backgroundResponse.model)
        }

        console.log("Summary generation started in background")
      } else {
        setErrorMessage(contentResponse?.error || "Failed to get comments.", contentResponse?.details, "getComments")
        console.error("Error getting comments:", contentResponse?.error)
      }
    } catch (err) {
      resetGenerationState()
      setErrorFromUnknown(err, "Failed to read comments or start summary generation.", "getComments")
      console.error("Error:", err)
    } finally {
      isLoading = false
      updateButtonText()
    }
  }

  async function cancelSummaryGeneration() {
    if (!currentUrl || isCancellingSummary) {
      return
    }

    isCancellingSummary = true
    clearMessages()

    try {
      const response = await withTimeout(
        browser.runtime.sendMessage({
          action: "cancelSummaryGeneration",
          url: currentUrl,
        }) as Promise<GenerateSummaryResponse>,
        5000,
        "Timed out while cancelling summary generation.",
      )

      await ongoingGenerationStore.setValue(null)
      isProcessingInBackground = false
      isGeneratingSummary = false

      if (!response?.success && response?.error) {
        warning = response.error
      }
    } catch (err) {
      setErrorFromUnknown(err, "Failed to cancel summary generation.", "cancelSummaryGeneration")
      console.error("Error cancelling summary generation:", err)
    } finally {
      isCancellingSummary = false
      updateButtonText()
    }
  }

  function openOptions() {
    void browser.runtime.openOptionsPage().catch(err => {
      setErrorFromUnknown(err, "Failed to open options page.")
    })
  }

  function getCurrentModelLabel(): string {
    return currentModelName ? formatModelWithProvider(currentModelName, currentModelProvider) : "Loading..."
  }

  function getSummaryCreatedByLabel(): string {
    return summaryCreatedBy ? formatModelWithProvider(summaryCreatedBy, summaryCreatedByProvider) : ""
  }

  function getExtensionVersion(): string {
    return browser.runtime.getManifest().version
  }

  function getErrorHeading(): string {
    if (error.startsWith(ALL_MODELS_FAILED_PREFIX)) {
      return "All configured AI models failed"
    }

    return "Error"
  }

  function getFormattedErrorItems(): FormattedErrorItem[] {
    if (!error.startsWith(ALL_MODELS_FAILED_PREFIX)) {
      return []
    }

    return error
      .slice(ALL_MODELS_FAILED_PREFIX.length)
      .split(" | ")
      .map(item => {
        const separatorIndex = item.indexOf(": ")

        if (separatorIndex === -1) {
          return {
            model: "Unknown model",
            message: item.trim(),
          }
        }

        return {
          model: item.slice(0, separatorIndex).trim(),
          message: item.slice(separatorIndex + 2).trim(),
        }
      })
      .filter(item => item.message !== "")
  }

  function handleSummaryComplete(message: RuntimeSummaryMessage) {
    if (!message.summary?.trim()) {
      resetGenerationState()
      setErrorMessage("Summary generation completed, but the response was empty.")
      updateButtonText()
      return
    }

    summary = message.summary
    summaryCreatedBy = message.model || currentModelName
    summaryCreatedByProvider = message.provider || getModelProvider(summaryCreatedBy)
    currentModelName = message.model || currentModelName
    currentModelProvider = message.provider || getModelProvider(currentModelName)
    warning = message.warning || ""
    error = ""
    errorDetails = ""
    resetGenerationState()
    updateButtonText()
    console.log("Summary completed in background:", message.summary)
  }

  function resetGenerationState() {
    isProcessingInBackground = false
    isGeneratingSummary = false
    isCancellingSummary = false
    generationErrorHistory = []
  }

  function clearMessages() {
    error = ""
    errorDetails = ""
    warning = ""
    generationErrorHistory = []
  }

  function setErrorMessage(message: string, details = "", action?: LastSummaryError["action"]) {
    error = message
    errorDetails = details

    if (action && currentUrl) {
      void rememberLastSummaryError(action, message, details)
    }
  }

  function setErrorFromUnknown(err: unknown, fallback: string, action?: LastSummaryError["action"]) {
    error = getErrorMessage(err, fallback)
    errorDetails = err instanceof Error ? err.stack || err.message : ""

    if (action && currentUrl) {
      void rememberLastSummaryError(action, error, errorDetails)
    }
  }

  async function rememberLastSummaryError(action: LastSummaryError["action"], message: string, details = "") {
    try {
      await lastSummaryErrorStore.setValue({
        url: currentUrl,
        action,
        message,
        details,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.warn("Failed to store popup error details:", err)
    }
  }

  async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        }),
      ])
    } finally {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }
</script>

<main class="p-4 min-w-107.5 max-w-155">
  <h1 class="text-2xl font-bold mb-4">HN Comments Summarizer</h1>

  <!-- Current Model Info -->
  <div class="mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg">
    <p class="text-xs text-gray-600">
      Current model: <span class="font-medium text-gray-800">{getCurrentModelLabel()}</span>
    </p>
  </div>

  <!-- URL Validation Warning -->
  {#if !isValidHackerNewsUrl && currentUrl}
    <div class="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
      <p class="font-semibold text-sm">⚠️ Not a Hacker News Submission</p>
      <p class="text-xs mt-1">
        This extension only works on Hacker News submission pages (news.ycombinator.com/item?id=)
      </p>
    </div>
  {/if}

  <div class="space-y-3 mb-4">
    <button
      onclick={getComments}
      disabled={isLoading || isGeneratingSummary || isProcessingInBackground || !isValidHackerNewsUrl}
      class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300
      text-white font-semibold py-2 px-4 rounded transition-colors"
    >
      {buttonText}
    </button>

    {#if isGeneratingSummary || isProcessingInBackground}
      <button
        onclick={cancelSummaryGeneration}
        disabled={isCancellingSummary}
        class="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-2 px-4 rounded transition-colors"
      >
        {isCancellingSummary ? "Cancelling..." : "Cancel Generation"}
      </button>
    {/if}

    <button
      onclick={openOptions}
      class="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors"
    >
      Options
    </button>

    <p class="text-center text-[11px] text-gray-400">v{getExtensionVersion()}</p>
  </div>

  <!-- Error Display -->
  {#if error}
    {@const formattedErrorItems = getFormattedErrorItems()}
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
      <p class="font-semibold">{getErrorHeading()}</p>
      {#if formattedErrorItems.length > 0}
        <ul class="mt-2 space-y-2 text-sm">
          {#each formattedErrorItems as item}
            <li class="flex gap-2">
              <span class="mt-1.75 h-1.5 w-1.5 shrink-0 rounded bg-red-600"></span>
              <span class="min-w-0">
                <strong class="font-semibold text-red-900">{item.model}</strong>
                <span class="block wrap-break-word">{item.message}</span>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-1 text-sm wrap-break-word">{error}</p>
      {/if}
      {#if errorDetails}
        <details class="mt-2 text-xs">
          <summary class="cursor-pointer font-medium">Details</summary>
          <pre
            class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-red-50 p-2 text-[11px]">{errorDetails}</pre>
        </details>
      {/if}
    </div>
  {/if}

  {#if warning}
    <div class="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg">
      <p class="font-semibold">Notice:</p>
      <p class="text-sm">{warning}</p>
    </div>
  {/if}

  <!-- Loading States -->
  {#if isProcessingInBackground}
    <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
      <p class="text-sm font-medium">Generating using {currentModelName ? getCurrentModelLabel() : "AI"}...</p>
      <p class="text-xs mt-1 opacity-80">Processing in background. You can close this window.</p>
    </div>
  {/if}

  {#if isGeneratingSummary && !isProcessingInBackground}
    <div class="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
      <p class="text-sm font-medium">Generating summary using {currentModelName ? getCurrentModelLabel() : "AI"}...</p>
    </div>
  {/if}

  {#if (isGeneratingSummary || isProcessingInBackground) && generationErrorHistory.length > 0}
    <div class="mb-4 p-3 bg-red-50 border border-red-400 text-red-700 rounded-lg">
      <p class="font-semibold text-sm">Recent model errors</p>
      <div class="mt-2 space-y-2">
        {#each generationErrorHistory as item}
          <div class="rounded border border-red-200 bg-white p-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-red-900"
                >{formatModelWithProvider(item.model, getModelProvider(item.model))}</span
              >
              <span class="shrink-0 rounded bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700"
                >{item.reason}</span
              >
            </div>
            <p class="mt-1 wrap-break-word">{item.message}</p>
            {#if item.details}
              <details class="mt-1">
                <summary class="cursor-pointer font-medium">Details</summary>
                <pre
                  class="mt-1 max-h-24 overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-red-50 p-2 text-[11px]">{item.details}</pre>
              </details>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Summary Display -->
  {#if summary}
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-semibold">Summary</h2>
        {#if summaryCreatedBy}
          <span class="text-xs text-gray-500">Created by {getSummaryCreatedByLabel()}</span>
        {/if}
      </div>
      <div class="p-3 bg-gray-100 rounded-lg text-sm text-gray-800 prose prose-sm max-w-none">
        {@html snarkdown(summary)}
      </div>
    </div>
  {/if}

  <!-- Comments Display (for debugging) -->
  {#if comments && !summary}
    <div class="mb-4">
      <h2 class="text-lg font-semibold mb-2">Comments ({comments.length} chars)</h2>
      <div class="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 max-h-40 overflow-y-auto">
        {comments.slice(0, 200)}{comments.length > 200 ? "..." : ""}
      </div>
    </div>
  {/if}
</main>
