import { GenerateText, SummaryGenerationCancelledError } from "@@/util/generate-ai"
import { getConfiguredModelChain } from "@@/util/models"
import { getErrorMessage, serializeError } from "@@/util/errors"
import {
  contextSystemPromptStore,
  customGoogleModelsStore,
  hiddenGoogleModelsStore,
  lastSummaryErrorStore,
  modelChainStore,
  modelStore,
  ongoingGenerationStore,
  savedSummariesStore,
  streamingStore,
  type GenerationErrorHistoryItem,
  type LastSummaryError,
  type OngoingGeneration,
} from "@@/util/storage"

type SendResponse = (response?: unknown) => void

interface RuntimeMessage {
  action?: string
  comments?: unknown
  url?: unknown
  withContext?: unknown
  storyTitle?: unknown
  storyUrl?: unknown
  storyExcerpt?: unknown
  storyExcerptSkipped?: unknown
}

interface SummaryJob {
  prompt: string
  systemPrompt?: string
  withContext: boolean
  warning?: string
}

const ONGOING_GENERATION_TTL_MS = 5 * 60 * 1000

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id })

  const activeGenerationControllers = new Map<string, AbortController>()

  let lastGenerationId = 0
  const generationIds = new WeakMap<AbortController, number>()

  function isActiveGeneration(url: string, generationController: AbortController) {
    return activeGenerationControllers.get(url) === generationController
  }

  function sendRuntimeMessage(message: Record<string, unknown>) {
    const controller = activeGenerationControllers.get(String(message.url))
    const generationId = controller ? generationIds.get(controller) : undefined
    void browser.runtime.sendMessage({ generationId, ...message }).catch(error => {
      console.debug("Runtime message had no active receiver.", error)
    })
  }

  function sendSafeResponse(sendResponse: SendResponse, response: unknown) {
    try {
      sendResponse(response)
    } catch (error) {
      console.debug("Message response channel was already closed.", error)
    }
  }

  async function getCurrentModel(): Promise<string> {
    const [configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels] = await Promise.all([
      modelChainStore.getValue(),
      modelStore.getValue(),
      customGoogleModelsStore.getValue(),
      hiddenGoogleModelsStore.getValue(),
    ])

    return (
      getConfiguredModelChain(configuredModelChain, legacyModel, customGoogleModels, hiddenGoogleModels)[0] ??
      legacyModel
    )
  }

  async function clearOngoingGenerationIfActive(url: string, generationController: AbortController) {
    if (!isActiveGeneration(url, generationController)) {
      return
    }

    try {
      await ongoingGenerationStore.setValue(null)
    } catch (error) {
      console.warn("Failed to clear ongoing generation state.", error)
    }
  }

  async function rememberSummaryError(
    url: string,
    action: LastSummaryError["action"],
    error: unknown,
    fallback = "Summary generation failed.",
  ) {
    const errorInfo = serializeError(error, fallback)

    try {
      await lastSummaryErrorStore.setValue({
        url,
        action,
        message: errorInfo.message,
        details: errorInfo.details,
        timestamp: Date.now(),
      })
    } catch (storageError) {
      console.warn("Failed to store summary error details.", storageError)
    }

    return errorInfo
  }

  async function clearLastSummaryErrorForUrl(url: string) {
    try {
      const lastError = await lastSummaryErrorStore.getValue()

      if (lastError?.url === url) {
        await lastSummaryErrorStore.setValue(null)
      }
    } catch (error) {
      console.warn("Failed to clear summary error details.", error)
    }
  }

  async function updateOngoingGeneration(
    url: string,
    generationController: AbortController,
    updates: Partial<Pick<OngoingGeneration, "model" | "errorHistory" | "summary" | "withContext">>,
  ) {
    if (!isActiveGeneration(url, generationController)) {
      return
    }

    try {
      const ongoing = await ongoingGenerationStore.getValue()

      if (
        !ongoing ||
        ongoing.url !== url ||
        !isActiveGeneration(url, generationController) ||
        generationController.signal.aborted
      ) {
        return
      }

      await ongoingGenerationStore.setValue({
        ...ongoing,
        ...updates,
        revision: (ongoing.revision ?? 0) + 1,
        timestamp: Date.now(),
      })

      if (generationController.signal.aborted) {
        return
      }
      sendRuntimeMessage({
        action: "generationUpdated",
        ...ongoing,
        ...updates,
        revision: (ongoing.revision ?? 0) + 1,
        url,
        model: updates.model ?? ongoing.model,
        errorHistory: updates.errorHistory ?? ongoing.errorHistory ?? [],
      })
    } catch (error) {
      console.warn("Failed to update ongoing generation state.", error)
    }
  }

  async function rememberGenerationAttemptError(
    url: string,
    generationController: AbortController,
    errorItem: GenerationErrorHistoryItem,
  ) {
    if (!isActiveGeneration(url, generationController)) {
      return
    }

    try {
      const ongoing = await ongoingGenerationStore.getValue()

      if (!ongoing || ongoing.url !== url) {
        return
      }

      await ongoingGenerationStore.setValue({
        ...ongoing,
        errorHistory: [errorItem, ...(ongoing.errorHistory ?? [])].slice(0, 3),
        timestamp: Date.now(),
      })

      sendRuntimeMessage({
        action: "generationUpdated",
        url,
        model: ongoing.model,
        errorHistory: [errorItem, ...(ongoing.errorHistory ?? [])].slice(0, 3),
      })
    } catch (error) {
      console.warn("Failed to store generation attempt error.", error)
    }
  }

  async function saveSummary(url: string, summaryText: string, model: string, provider: string, withContext: boolean) {
    const savedSummaries = await savedSummariesStore.getValue()
    const filteredSummaries = savedSummaries.filter(item => item.id !== url)
    const updatedSummaries = [
      ...filteredSummaries,
      {
        id: url,
        summary: summaryText,
        createdBy: model,
        provider,
        withContext,
      },
    ]

    await savedSummariesStore.setValue(updatedSummaries)
  }

  function buildSummaryJob(
    comments: string,
    withContext: boolean,
    storyTitle: string,
    storyUrl: string,
    storyExcerpt: string,
    storyExcerptSkipped: boolean,
    contextSystemPrompt: string,
  ): SummaryJob {
    const title = storyTitle.trim()
    const link = storyUrl.trim()
    const excerpt = storyExcerpt.trim()

    if (!withContext || (title === "" && link === "")) {
      return {
        prompt: comments,
        withContext: false,
        warning:
          withContext && title === "" && link === ""
            ? "Story link could not be found on the page, generated without story context."
            : undefined,
      }
    }

    let excerptBlock: string
    let warning: string | undefined

    if (excerpt !== "") {
      excerptBlock = `\n\nStory article excerpt (fetched from the URL, may be incomplete):\n${excerpt}`
    } else {
      excerptBlock = `\n\n[Note: Only the story title is available locally. If you can access the URL above, briefly summarize what it is about. If you cannot access it, say so in one short sentence and use only the title plus the comments below.]`

      if (!storyExcerptSkipped) {
        warning =
          "Story article could not be fetched locally (likely paywall or bot protection); the AI received only the title and link."
      }
    }

    const prompt = `Story context:
Title: ${title || "(unknown title)"}
URL: ${link || "(unknown URL)"}${excerptBlock}

${comments}`

    return {
      prompt,
      systemPrompt: contextSystemPrompt,
      withContext: true,
      warning,
    }
  }

  async function runSummaryGeneration(
    url: string,
    comments: string,
    generationController: AbortController,
    jobOptions: {
      withContext: boolean
      storyTitle: string
      storyUrl: string
      storyExcerpt: string
      storyExcerptSkipped: boolean
    },
  ) {
    try {
      const contextSystemPrompt = jobOptions.withContext ? await contextSystemPromptStore.getValue() : ""
      const job = buildSummaryJob(
        comments,
        jobOptions.withContext,
        jobOptions.storyTitle,
        jobOptions.storyUrl,
        jobOptions.storyExcerpt,
        jobOptions.storyExcerptSkipped,
        contextSystemPrompt,
      )
      const state = await ongoingGenerationStore.getValue()
      const summary = await GenerateText(job.prompt, {
        streaming: state?.streaming === true,
        onText: async text => {
          await updateOngoingGeneration(url, generationController, { summary: text, withContext: job.withContext })
        },
        abortSignal: generationController.signal,
        systemPrompt: job.systemPrompt,
        onModelStart: async modelRef => {
          await updateOngoingGeneration(url, generationController, {
            model: modelRef,
            summary: "",
            withContext: job.withContext,
          })
        },
        onModelError: async error => {
          await updateOngoingGeneration(url, generationController, { summary: "" })
          await rememberGenerationAttemptError(url, generationController, {
            model: error.modelRef,
            message: error.message,
            details: error.details,
            reason: error.reason,
            timestamp: Date.now(),
          })
        },
      })

      if (!isActiveGeneration(url, generationController) || generationController.signal.aborted) {
        throw new SummaryGenerationCancelledError()
      }

      let warning: string | undefined = job.warning

      try {
        await saveSummary(url, summary.text, summary.model, summary.provider, job.withContext)
      } catch (error) {
        warning = `Summary was generated, but could not be saved to cache: ${getErrorMessage(error)}`
        console.warn(warning, error)
      }

      if (generationController.signal.aborted) {
        throw new SummaryGenerationCancelledError()
      }
      await clearOngoingGenerationIfActive(url, generationController)
      await clearLastSummaryErrorForUrl(url)

      sendRuntimeMessage({
        action: "summaryComplete",
        generationId: state?.generationId,
        revision: Number.MAX_SAFE_INTEGER,
        url,
        summary: summary.text,
        model: summary.model,
        provider: summary.provider,
        attemptedModels: summary.attemptedModels,
        withContext: job.withContext,
        warning,
      })
    } catch (error) {
      if (error instanceof SummaryGenerationCancelledError || generationController.signal.aborted) {
        if (isActiveGeneration(url, generationController)) {
          await clearOngoingGenerationIfActive(url, generationController)
          sendRuntimeMessage({
            action: "summaryCancelled",
            url,
          })
        }

        return
      }

      console.error("Error generating summary in background:", error)

      if (isActiveGeneration(url, generationController)) {
        await clearOngoingGenerationIfActive(url, generationController)
        const errorInfo = await rememberSummaryError(url, "generateSummary", error, "Failed to generate summary.")

        sendRuntimeMessage({
          action: "summaryFailed",
          url,
          error: errorInfo.message,
          details: errorInfo.details,
        })
      }
    } finally {
      if (isActiveGeneration(url, generationController)) {
        activeGenerationControllers.delete(url)
      }
    }
  }

  async function startSummaryGeneration(message: RuntimeMessage, sendResponse: SendResponse) {
    const url = typeof message.url === "string" ? message.url : ""
    let generationController: AbortController | null = null

    try {
      const comments = typeof message.comments === "string" ? message.comments : ""
      const withContext = message.withContext === true
      const storyTitle = typeof message.storyTitle === "string" ? message.storyTitle : ""
      const storyUrl = typeof message.storyUrl === "string" ? message.storyUrl : ""
      const storyExcerpt = typeof message.storyExcerpt === "string" ? message.storyExcerpt : ""
      const storyExcerptSkipped = message.storyExcerptSkipped !== false

      if (url.trim() === "") {
        throw new Error("No Hacker News URL was provided for summary generation.")
      }

      if (comments.trim() === "") {
        throw new Error("No readable Hacker News comments were provided for summary generation.")
      }

      if (activeGenerationControllers.size > 0) {
        throw new Error("A summary is already being generated. Cancel it before starting another.")
      }

      generationController = new AbortController()
      activeGenerationControllers.set(url, generationController)

      const currentModel = await getCurrentModel()
      const streaming = await streamingStore.getValue()
      const generationId = Math.max(Date.now(), lastGenerationId + 1)
      lastGenerationId = generationId
      generationIds.set(generationController, generationId)
      await ongoingGenerationStore.setValue({
        url,
        model: currentModel,
        generationId,
        revision: 0,
        streaming,
        summary: "",
        withContext,
        timestamp: Date.now(),
      })

      sendSafeResponse(sendResponse, { success: true, started: true, model: currentModel, generationId, streaming })
      void runSummaryGeneration(url, comments, generationController, {
        withContext,
        storyTitle,
        storyUrl,
        storyExcerpt,
        storyExcerptSkipped,
      })
    } catch (error) {
      if (generationController && url.trim() !== "" && isActiveGeneration(url, generationController)) {
        generationController.abort()
        activeGenerationControllers.delete(url)

        try {
          await ongoingGenerationStore.setValue(null)
        } catch (storageError) {
          console.warn("Failed to clear ongoing generation after startup failure.", storageError)
        }
      }

      const errorInfo =
        url.trim() === ""
          ? serializeError(error, "Failed to start summary generation.")
          : await rememberSummaryError(url, "generateSummary", error, "Failed to start summary generation.")

      sendSafeResponse(sendResponse, {
        success: false,
        error: errorInfo.message,
        details: errorInfo.details,
      })
    }
  }

  async function sendGenerationStatus(message: RuntimeMessage, sendResponse: SendResponse) {
    const url = typeof message.url === "string" ? message.url : ""

    try {
      if (url.trim() === "") {
        throw new Error("No URL was provided for generation status.")
      }

      const ongoing = await ongoingGenerationStore.getValue()

      if (!ongoing || ongoing.url !== url) {
        sendSafeResponse(sendResponse, { success: true, active: false })
        return
      }

      if (ongoing.timestamp < Date.now() - ONGOING_GENERATION_TTL_MS) {
        const staleController = activeGenerationControllers.get(url)
        staleController?.abort()
        activeGenerationControllers.delete(url)
        await ongoingGenerationStore.setValue(null)
        const errorInfo = await rememberSummaryError(
          url,
          "generationStatus",
          new Error("Previous summary generation timed out before it could finish. Please try again."),
        )

        sendSafeResponse(sendResponse, {
          success: true,
          active: false,
          error: errorInfo.message,
          details: errorInfo.details,
        })
        return
      }

      if (!activeGenerationControllers.has(url)) {
        await ongoingGenerationStore.setValue(null)
        const errorInfo = await rememberSummaryError(
          url,
          "generationStatus",
          new Error("Previous summary generation was interrupted before it could finish. Please try again."),
        )

        sendSafeResponse(sendResponse, {
          success: true,
          active: false,
          error: errorInfo.message,
          details: errorInfo.details,
        })
        return
      }

      sendSafeResponse(sendResponse, {
        success: true,
        active: true,
        generationId: ongoing.generationId,
        revision: ongoing.revision,
        streaming: ongoing.streaming,
        summary: ongoing.summary,
        withContext: ongoing.withContext,
        model: ongoing.model,
        timestamp: ongoing.timestamp,
        errorHistory: ongoing.errorHistory ?? [],
      })
    } catch (error) {
      const errorInfo =
        url.trim() === ""
          ? serializeError(error, "Failed to check summary generation status.")
          : await rememberSummaryError(url, "generationStatus", error, "Failed to check summary generation status.")

      sendSafeResponse(sendResponse, {
        success: false,
        error: errorInfo.message,
        details: errorInfo.details,
      })
    }
  }

  async function cancelSummaryGeneration(message: RuntimeMessage, sendResponse: SendResponse) {
    const url = typeof message.url === "string" ? message.url : ""

    try {
      if (url.trim() === "") {
        throw new Error("No URL was provided for cancellation.")
      }

      const generationController = activeGenerationControllers.get(url)
      generationController?.abort()
      const ongoing = await ongoingGenerationStore.getValue()
      if (ongoing?.url === url) {
        await ongoingGenerationStore.setValue(null)
      }

      if (generationController) {
        sendRuntimeMessage({
          action: "summaryCancelled",
          url,
        })
      }

      sendSafeResponse(sendResponse, {
        success: Boolean(generationController),
        error: generationController ? undefined : "No active summary generation was found. The local state was reset.",
      })
    } catch (error) {
      const errorInfo =
        url.trim() === ""
          ? serializeError(error, "Failed to cancel summary generation.")
          : await rememberSummaryError(url, "cancelSummaryGeneration", error, "Failed to cancel summary generation.")

      sendSafeResponse(sendResponse, {
        success: false,
        error: errorInfo.message,
        details: errorInfo.details,
      })
    }
  }

  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message?.action === "generateSummary") {
      void startSummaryGeneration(message, sendResponse)
      return true
    }

    if (message?.action === "getGenerationStatus") {
      void sendGenerationStatus(message, sendResponse)
      return true
    }

    if (message?.action === "cancelSummaryGeneration") {
      void cancelSummaryGeneration(message, sendResponse)
      return true
    }

    return false
  })
})
