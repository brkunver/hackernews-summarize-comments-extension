<script lang="ts">
  import {
    customGoogleModelsStore,
    hiddenGoogleModelsStore,
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
  import ActionButtons from "./components/ActionButtons.svelte"
  import ErrorPanel from "./components/ErrorPanel.svelte"
  import StatusPanels from "./components/StatusPanels.svelte"
  import SummaryCard from "./components/SummaryCard.svelte"
  import { getExtensionVersion } from "~/util/format"

  interface GetCommentsResponse {
    success?: boolean
    comments?: string
    storyTitle?: string
    storyUrl?: string
    storyExcerpt?: string
    storyExcerptSkipped?: boolean
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
    withContext?: boolean
    error?: string
    details?: string
    warning?: string
    errorHistory?: GenerationErrorHistoryItem[]
  }

  const LAST_ERROR_DISPLAY_MS = 24 * 60 * 60 * 1000

  let isLoading = $state(false)
  let buttonText = $state("Get Comments")
  let buttonTextWithContext = $state("Generate Summary with Context")
  let comments = $state("")
  let summary = $state("")
  let summaryWithContext = $state(false)
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

  const isBusy = $derived(isLoading || isGeneratingSummary || isProcessingInBackground)
  const currentModelLabel = $derived(
    currentModelName ? formatModelWithProvider(currentModelName, currentModelProvider) : "Loading...",
  )
  const summaryCreatedByLabel = $derived(
    summaryCreatedBy ? formatModelWithProvider(summaryCreatedBy, summaryCreatedByProvider) : "",
  )

  function checkIfHackerNewsUrl(url: string): boolean {
    return url.includes("news.ycombinator.com/item?id=")
  }

  async function loadCurrentModel() {
    const [configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels] = await Promise.all([
      modelChainStore.getValue(),
      modelStore.getValue(),
      customGoogleModelsStore.getValue(),
      hiddenGoogleModelsStore.getValue(),
    ])
    const currentModel =
      getConfiguredModelChain(configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels)[0] ?? ""

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

  async function getActiveTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })

    return tabs[0]
  }

  async function initializePopup(isMounted: () => boolean) {
    try {
      const tab = await getActiveTab()

      if (!isMounted()) {
        return
      }

      if (tab?.url) {
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
        summaryWithContext = cachedSummary.withContext === true
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
      buttonTextWithContext = "Not a Hacker News Page"
    } else if (isLoading) {
      buttonText = "Loading..."
      buttonTextWithContext = "Loading..."
    } else if (isGeneratingSummary || isProcessingInBackground) {
      buttonText = "Generating..."
      buttonTextWithContext = "Generating..."
    } else if (summary?.trim()) {
      buttonText = "Regenerate Summary"
      buttonTextWithContext = "Regenerate with Context"
    } else {
      buttonText = "Generate Summary"
      buttonTextWithContext = "Generate Summary with Context"
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

  async function getComments(withContext = false) {
    isLoading = true
    updateButtonText()
    clearMessages()

    try {
      const tab = await getActiveTab()

      if (!tab) {
        setErrorMessage("No active tab found.")
        return
      }

      if (tab.id === undefined) {
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
        browser.tabs.sendMessage(tab.id, { action: "getComments", withContext }) as Promise<GetCommentsResponse>,
        withContext ? 25000 : 8000,
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

  function handleSummaryComplete(message: RuntimeSummaryMessage) {
    if (!message.summary?.trim()) {
      resetGenerationState()
      setErrorMessage("Summary generation completed, but the response was empty.")
      updateButtonText()
      return
    }

    summary = message.summary
    summaryWithContext = message.withContext === true
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

<main class="min-w-107.5 max-w-155 bg-zinc-950 p-4 text-zinc-100">
  <header class="mb-3 flex items-center gap-2.5">
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-base font-bold text-white"
      >Y</span
    >
    <div class="min-w-0 flex-1">
      <h1 class="text-base leading-tight font-bold">HN Comments Summarizer</h1>
      <p class="text-[11px] text-zinc-500">v{getExtensionVersion()}</p>
    </div>
  </header>

  <div class="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
    <p class="text-xs text-zinc-400">
      Current model: <span class="font-medium text-zinc-100">{currentModelLabel}</span>
    </p>
  </div>

  {#if !isValidHackerNewsUrl && currentUrl}
    <div class="mb-3 rounded-xl border border-amber-800 bg-amber-950/60 p-3 text-amber-200">
      <p class="text-sm font-semibold">⚠️ Not a Hacker News Submission</p>
      <p class="mt-1 text-xs">
        This extension only works on Hacker News submission pages (news.ycombinator.com/item?id=)
      </p>
    </div>
  {/if}

  <div class="mb-3">
    <ActionButtons
      {buttonText}
      {buttonTextWithContext}
      disabled={isBusy || !isValidHackerNewsUrl}
      isBusy={isGeneratingSummary || isProcessingInBackground}
      isCancelling={isCancellingSummary}
      onGenerate={getComments}
      onCancel={cancelSummaryGeneration}
      onOpenOptions={openOptions}
    />
  </div>

  <div class="space-y-3">
    {#if error}
      <ErrorPanel {error} {errorDetails} />
    {/if}

    <StatusPanels
      {warning}
      {isProcessingInBackground}
      {isGeneratingSummary}
      {currentModelName}
      {currentModelLabel}
      {generationErrorHistory}
    />

    {#if summary}
      <SummaryCard {summary} withContext={summaryWithContext} createdByLabel={summaryCreatedByLabel} />
    {/if}

    {#if comments && !summary}
      <div>
        <h2 class="mb-2 text-sm font-semibold text-zinc-300">Comments ({comments.length} chars)</h2>
        <div class="max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          {comments.slice(0, 200)}{comments.length > 200 ? "..." : ""}
        </div>
      </div>
    {/if}
  </div>
</main>
