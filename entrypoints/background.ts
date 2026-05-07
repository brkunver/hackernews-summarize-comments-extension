import { GenerateText, SummaryGenerationCancelledError } from "@@/util/generate-ai"
import { getConfiguredModelChain } from "@@/util/models"
import { getErrorMessage, serializeError } from "@@/util/errors"
import {
  lastSummaryErrorStore,
  modelChainStore,
  modelStore,
  ongoingGenerationStore,
  savedSummariesStore,
  type GenerationErrorHistoryItem,
  type LastSummaryError,
  type OngoingGeneration,
} from "@@/util/storage"

type SendResponse = (response?: unknown) => void

interface RuntimeMessage {
  action?: string
  comments?: unknown
  url?: unknown
}

const ONGOING_GENERATION_TTL_MS = 5 * 60 * 1000

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id })

  const activeGenerationControllers = new Map<string, AbortController>()

  function isActiveGeneration(url: string, generationController: AbortController) {
    return activeGenerationControllers.get(url) === generationController
  }

  function sendRuntimeMessage(message: Record<string, unknown>) {
    void browser.runtime.sendMessage(message).catch(error => {
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
    const [configuredModelChain, legacyModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])

    return getConfiguredModelChain(configuredModelChain, legacyModel)[0] ?? legacyModel
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
    updates: Partial<Pick<OngoingGeneration, "model" | "errorHistory">>,
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
        ...updates,
        timestamp: Date.now(),
      })

      sendRuntimeMessage({
        action: "generationUpdated",
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

  async function saveSummary(url: string, summaryText: string, model: string, provider: string) {
    const savedSummaries = await savedSummariesStore.getValue()
    const filteredSummaries = savedSummaries.filter(item => item.id !== url)
    const updatedSummaries = [
      ...filteredSummaries,
      {
        id: url,
        summary: summaryText,
        createdBy: model,
        provider,
      },
    ]

    await savedSummariesStore.setValue(updatedSummaries)
  }

  async function runSummaryGeneration(url: string, comments: string, generationController: AbortController) {
    try {
      const summary = await GenerateText(comments, {
        abortSignal: generationController.signal,
        onModelStart: async modelRef => {
          await updateOngoingGeneration(url, generationController, { model: modelRef })
        },
        onModelError: async error => {
          await rememberGenerationAttemptError(url, generationController, {
            model: error.modelRef,
            message: error.message,
            details: error.details,
            reason: error.reason,
            timestamp: Date.now(),
          })
        },
      })

      if (!isActiveGeneration(url, generationController)) {
        return
      }

      let warning: string | undefined

      try {
        await saveSummary(url, summary.text, summary.model, summary.provider)
      } catch (error) {
        warning = `Summary was generated, but could not be saved to cache: ${getErrorMessage(error)}`
        console.warn(warning, error)
      }

      await clearOngoingGenerationIfActive(url, generationController)
      await clearLastSummaryErrorForUrl(url)

      sendRuntimeMessage({
        action: "summaryComplete",
        url,
        summary: summary.text,
        model: summary.model,
        provider: summary.provider,
        attemptedModels: summary.attemptedModels,
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

      if (url.trim() === "") {
        throw new Error("No Hacker News URL was provided for summary generation.")
      }

      if (comments.trim() === "") {
        throw new Error("No readable Hacker News comments were provided for summary generation.")
      }

      const previousController = activeGenerationControllers.get(url)
      previousController?.abort()

      generationController = new AbortController()
      activeGenerationControllers.set(url, generationController)

      const currentModel = await getCurrentModel()
      await ongoingGenerationStore.setValue({
        url,
        model: currentModel,
        timestamp: Date.now(),
      })

      sendSafeResponse(sendResponse, { success: true, started: true, model: currentModel })
      void runSummaryGeneration(url, comments, generationController)
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
      await ongoingGenerationStore.setValue(null)

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
