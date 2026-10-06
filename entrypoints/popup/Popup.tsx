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
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import ActionButtons from "./components/ActionButtons"
import ErrorPanel from "./components/ErrorPanel"
import StatusPanels from "./components/StatusPanels"
import SummaryCard from "./components/SummaryCard"
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
  generationId?: number
  streaming?: boolean
  success?: boolean
  started?: boolean
  model?: string
  error?: string
  details?: string
  cancelled?: boolean
}

interface GenerationStatusResponse {
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

interface RuntimeSummaryMessage {
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

const LAST_ERROR_DISPLAY_MS = 24 * 60 * 60 * 1000

function checkIfHackerNewsUrl(url: string): boolean {
  return url.includes("news.ycombinator.com/item?id=")
}

export default function Popup() {
  const [isStreaming, setIsStreaming] = createSignal(false)
  let generationId = 0
  let revision = -1
  let finishedGenerationId = 0
  const [isLoading, setIsLoading] = createSignal(false)
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
  const buttonText = () => {
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
  const buttonTextWithContext = () => {
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

  async function loadCurrentModel() {
    const [configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels] = await Promise.all([
      modelChainStore.getValue(),
      modelStore.getValue(),
      customGoogleModelsStore.getValue(),
      hiddenGoogleModelsStore.getValue(),
    ])
    const currentModel =
      getConfiguredModelChain(configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels)[0] ?? ""

    setCurrentModelName(currentModel)
    setCurrentModelProvider(getModelProvider(currentModel))
  }

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
        setCurrentUrl(tab.url)
        await loadCurrentModel()

        if (!isMounted()) {
          return
        }

        setIsValidHackerNewsUrl(checkIfHackerNewsUrl(tab.url))
        if (isValidHackerNewsUrl()) {
          await loadCachedSummary(tab.url)
          const hasActiveGeneration = await checkOngoingGeneration()

          if (!hasActiveGeneration) {
            await loadLastSummaryError(tab.url)
          }
        }
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
      const observedGenerationId = generationId
      const observedFinishedId = finishedGenerationId
      const savedSummaries = await savedSummariesStore.getValue()
      if (generationId !== observedGenerationId || finishedGenerationId !== observedFinishedId) {
        return false
      }
      const cachedSummary = savedSummaries.find(item => item.id === url)

      if (cachedSummary?.summary?.trim()) {
        setSummary(cachedSummary.summary)
        setSummaryWithContext(cachedSummary.withContext === true)
        setSummaryCreatedBy(cachedSummary.createdBy)
        setSummaryCreatedByProvider(
          (cachedSummary.provider as AiProvider | undefined) || getModelProvider(cachedSummary.createdBy),
        )
        console.log("Loaded cached summary for:", url)
        return true
      }
    } catch (err) {
      setWarning(`Cached summary could not be loaded: ${getErrorMessage(err)}`)
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

  async function checkOngoingGeneration(): Promise<boolean> {
    const requestedGenerationId = generationId
    const requestedRevision = revision
    try {
      const status = await withTimeout(
        browser.runtime.sendMessage({
          action: "getGenerationStatus",
          url: currentUrl(),
        }) as Promise<GenerationStatusResponse>,
        5000,
        "Timed out while checking summary generation status.",
      )

      if (generationId !== requestedGenerationId || revision !== requestedRevision) {
        return isGeneratingSummary() || isProcessingInBackground()
      }

      if (!status?.success) {
        setErrorMessage(status?.error || "Failed to check summary generation status.", status?.details)
        resetGenerationState()
        return false
      }

      if (status.generationId && status.generationId <= finishedGenerationId) {
        return false
      }
      if (status.active && status.model) {
        setIsProcessingInBackground(true)
        setIsGeneratingSummary(true)
        setCurrentModelName(status.model)
        setCurrentModelProvider(getModelProvider(status.model))
        applyStreamState(status)
        setGenerationErrorHistory(status.errorHistory ?? [])
        return true
      }

      discardPartialSummary()
      resetGenerationState()
      await loadCachedSummary(currentUrl())

      if (status.error) {
        setErrorMessage(status.error, status.details)
      }

      return false
    } catch (err) {
      const ongoing = await ongoingGenerationStore.getValue()

      if (ongoing && ongoing.url === currentUrl() && ongoing.timestamp > Date.now() - 300000) {
        setIsProcessingInBackground(true)
        setIsGeneratingSummary(true)
        setCurrentModelName(ongoing.model)
        setCurrentModelProvider(getModelProvider(ongoing.model))
        applyStreamState(ongoing)
        setGenerationErrorHistory(ongoing.errorHistory ?? [])
        setWarning("Could not confirm the background job status. If this stays stuck, cancel and try again.")
        return true
      }

      setErrorFromUnknown(err, "Failed to check summary generation status.")
      console.error("Error checking ongoing generation:", err)
      return false
    }
  }

  async function getComments(withContext = false) {
    setIsLoading(true)
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

      setCurrentUrl(tab.url)
      setIsValidHackerNewsUrl(checkIfHackerNewsUrl(tab.url))

      if (!isValidHackerNewsUrl()) {
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
        setComments(contentResponse.comments)
        console.log("Comments received:", contentResponse.comments)

        setIsProcessingInBackground(true)
        setIsGeneratingSummary(true)
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

        if (backgroundResponse.generationId && backgroundResponse.generationId > generationId) {
          generationId = backgroundResponse.generationId
          revision = -1
          setIsStreaming(backgroundResponse.streaming === true)
          if (backgroundResponse.streaming) {
            setSummary("")
          }
        }

        if (backgroundResponse.model) {
          setCurrentModelName(backgroundResponse.model)
          setCurrentModelProvider(getModelProvider(backgroundResponse.model))
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
      setIsLoading(false)
    }
  }

  async function cancelSummaryGeneration() {
    if (!currentUrl() || isCancellingSummary()) {
      return
    }

    setIsCancellingSummary(true)
    clearMessages()

    try {
      const response = await withTimeout(
        browser.runtime.sendMessage({
          action: "cancelSummaryGeneration",
          url: currentUrl(),
        }) as Promise<GenerateSummaryResponse>,
        5000,
        "Timed out while cancelling summary generation.",
      )

      discardPartialSummary()
      resetGenerationState()

      if (!response?.success && response?.error) {
        setWarning(response.error)
      }
    } catch (err) {
      setErrorFromUnknown(err, "Failed to cancel summary generation.", "cancelSummaryGeneration")
      console.error("Error cancelling summary generation:", err)
    } finally {
      setIsCancellingSummary(false)
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
      return
    }

    setSummary(message.summary)
    setSummaryWithContext(message.withContext === true)
    setSummaryCreatedBy(message.model || currentModelName())
    setSummaryCreatedByProvider(message.provider || getModelProvider(summaryCreatedBy()))
    setCurrentModelName(message.model || currentModelName())
    setCurrentModelProvider(message.provider || getModelProvider(currentModelName()))
    setWarning(message.warning || "")
    setError("")
    setErrorDetails("")
    resetGenerationState()
    console.log("Summary completed in background:", message.summary)
  }

  function discardPartialSummary() {
    if (isStreaming()) {
      setSummary("")
      setSummaryCreatedBy("")
    }
  }

  function applyStreamState(state: GenerationStatusResponse) {
    if (!state.generationId || state.generationId <= finishedGenerationId || state.generationId < generationId) {
      return
    }
    if (state.generationId > generationId) {
      generationId = state.generationId
      revision = -1
    }
    if ((state.revision ?? 0) < revision) {
      return
    }
    revision = state.revision ?? 0
    setIsStreaming(state.streaming === true)
    if (state.streaming) {
      setSummary(state.summary ?? "")
      setSummaryWithContext(state.withContext === true)
      setSummaryCreatedBy("")
    }
  }

  function resetGenerationState() {
    finishedGenerationId = Math.max(finishedGenerationId, generationId)
    setIsStreaming(false)
    setIsProcessingInBackground(false)
    setIsGeneratingSummary(false)
    setIsCancellingSummary(false)
    setGenerationErrorHistory([])
  }

  function clearMessages() {
    setError("")
    setErrorDetails("")
    setWarning("")
    setGenerationErrorHistory([])
  }

  function setErrorMessage(message: string, details = "", action?: LastSummaryError["action"]) {
    setError(message)
    setErrorDetails(details)

    if (action && currentUrl()) {
      void rememberLastSummaryError(action, message, details)
    }
  }

  function setErrorFromUnknown(err: unknown, fallback: string, action?: LastSummaryError["action"]) {
    setError(getErrorMessage(err, fallback))
    setErrorDetails(err instanceof Error ? err.stack || err.message : "")

    if (action && currentUrl()) {
      void rememberLastSummaryError(action, error(), errorDetails())
    }
  }

  async function rememberLastSummaryError(action: LastSummaryError["action"], message: string, details = "") {
    try {
      await lastSummaryErrorStore.setValue({
        url: currentUrl(),
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

  onMount(() => {
    let isMounted = true

    const handleRuntimeMessage = (message: RuntimeSummaryMessage) => {
      if (message.url !== currentUrl()) {
        return
      }

      if (
        message.generationId &&
        (message.generationId < generationId || message.generationId <= finishedGenerationId)
      ) {
        return
      }
      if (message.generationId && message.generationId > generationId) {
        generationId = message.generationId
        revision = -1
      }

      if (message.action === "summaryComplete") {
        handleSummaryComplete(message)
      }

      if (message.action === "generationUpdated") {
        if (message.revision !== undefined && message.revision < revision) {
          return
        }
        setIsGeneratingSummary(true)
        setIsProcessingInBackground(true)
        if (message.revision !== undefined) {
          applyStreamState(message)
        }
        if (message.model) {
          setCurrentModelName(message.model)
          setCurrentModelProvider(getModelProvider(message.model))
        }

        setGenerationErrorHistory(message.errorHistory ?? [])
      }

      if (message.action === "summaryFailed") {
        discardPartialSummary()
        resetGenerationState()
        setErrorMessage(message.error || "Summary generation failed.", message.details)
      }

      if (message.action === "summaryCancelled") {
        discardPartialSummary()
        resetGenerationState()
        setWarning("Summary generation was cancelled.")
      }
    }

    browser.runtime.onMessage.addListener(handleRuntimeMessage)
    void initializePopup(() => isMounted)

    onCleanup(() => {
      isMounted = false
      browser.runtime.onMessage.removeListener(handleRuntimeMessage)
    })
  })

  return (
    <main class="min-w-107.5 max-w-155 bg-zinc-950 p-4 text-zinc-100">
      <header class="mb-3 flex items-center gap-2.5">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-600 text-base font-bold text-white">
          Y
        </span>
        <div class="min-w-0 flex-1">
          <h1 class="text-base leading-tight font-bold">HN Comments Summarizer</h1>
          <p class="text-[11px] text-zinc-500">v{getExtensionVersion()}</p>
        </div>
      </header>

      <div class="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <p class="text-xs text-zinc-400">
          Current model: <span class="font-medium text-zinc-100">{currentModelLabel()}</span>
        </p>
      </div>

      <Show when={!isValidHackerNewsUrl() && currentUrl()}>
        <div class="mb-3 rounded-xl border border-amber-800 bg-amber-950/60 p-3 text-amber-200">
          <p class="text-sm font-semibold">⚠️ Not a Hacker News Submission</p>
          <p class="mt-1 text-xs">
            This extension only works on Hacker News submission pages (news.ycombinator.com/item?id=)
          </p>
        </div>
      </Show>

      <div class="mb-3">
        <ActionButtons
          buttonText={buttonText()}
          buttonTextWithContext={buttonTextWithContext()}
          disabled={isBusy() || !isValidHackerNewsUrl()}
          isBusy={isGeneratingSummary() || isProcessingInBackground()}
          isCancelling={isCancellingSummary()}
          onGenerate={getComments}
          onCancel={cancelSummaryGeneration}
          onOpenOptions={openOptions}
        />
      </div>

      <div class="space-y-3">
        <Show when={error()}>
          <ErrorPanel error={error()} errorDetails={errorDetails()} />
        </Show>

        <StatusPanels
          warning={warning()}
          isProcessingInBackground={isProcessingInBackground()}
          isGeneratingSummary={isGeneratingSummary()}
          currentModelName={currentModelName()}
          currentModelLabel={currentModelLabel()}
          generationErrorHistory={generationErrorHistory()}
        />

        <Show when={summary()}>
          <SummaryCard
            summary={summary()}
            streaming={isStreaming()}
            withContext={summaryWithContext()}
            createdByLabel={summaryCreatedByLabel()}
          />
        </Show>

        <Show when={comments() && !summary()}>
          <div>
            <h2 class="mb-2 text-sm font-semibold text-zinc-300">Comments ({comments().length} chars)</h2>
            <div class="max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
              {comments().slice(0, 200)}
              {comments().length > 200 ? "..." : ""}
            </div>
          </div>
        </Show>
      </div>
    </main>
  )
}
