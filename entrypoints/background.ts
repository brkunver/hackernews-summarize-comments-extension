import { GenerateText, SummaryGenerationCancelledError } from "@@/util/generate-ai"
import { getConfiguredModelChain } from "@@/util/models"
import { savedSummariesStore, modelChainStore, modelStore, ongoingGenerationStore } from "@@/util/storage"

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id })

  const activeGenerationControllers = new Map<string, AbortController>()

  function isActiveGeneration(url: string, generationController: AbortController) {
    return activeGenerationControllers.get(url) === generationController
  }

  async function clearOngoingGenerationIfActive(url: string, generationController: AbortController) {
    if (isActiveGeneration(url, generationController)) {
      await ongoingGenerationStore.setValue(null)
    }
  }

  // Handle messages from popup
  browser.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (message.action === "generateSummary") {
      let generationController: AbortController | null = null
      let generationUrl = ""

      try {
        const { comments, url } = message
        generationUrl = url
        const previousController = activeGenerationControllers.get(url)
        previousController?.abort()

        generationController = new AbortController()
        activeGenerationControllers.set(url, generationController)

        // Get current model and start tracking ongoing generation
        const [configuredModelChain, legacyModel] = await Promise.all([
          modelChainStore.getValue(),
          modelStore.getValue(),
        ])
        const currentModel = getConfiguredModelChain(configuredModelChain, legacyModel)[0] ?? legacyModel
        await ongoingGenerationStore.setValue({
          url,
          model: currentModel,
          timestamp: Date.now(),
        })

        // Generate summary in background
        const summary = await GenerateText(comments, generationController.signal)

        if (summary.text.trim() !== "") {
          // Save to cache
          const savedSummaries = await savedSummariesStore.getValue()
          const filteredSummaries = savedSummaries.filter(item => item.id !== url)
          const updatedSummaries = [
            ...filteredSummaries,
            {
              id: url,
              summary: summary.text,
              createdBy: summary.model,
              provider: summary.provider,
            },
          ]
          await savedSummariesStore.setValue(updatedSummaries)

          // Clear ongoing generation
          await clearOngoingGenerationIfActive(url, generationController)

          // Notify popup that summary is ready
          browser.runtime.sendMessage({
            action: "summaryComplete",
            url,
            summary: summary.text,
            model: summary.model,
            provider: summary.provider,
            attemptedModels: summary.attemptedModels,
          })

          sendResponse({ success: true, summary: summary.text, model: summary.model, provider: summary.provider })
        } else {
          // Clear ongoing generation on error
          await clearOngoingGenerationIfActive(url, generationController)
          sendResponse({ success: false, error: "AI returned empty summary" })
        }
      } catch (err) {
        if (err instanceof SummaryGenerationCancelledError) {
          if (generationController && generationUrl) {
            await clearOngoingGenerationIfActive(generationUrl, generationController)
          }
          sendResponse({ success: false, cancelled: true, error: err.message })
          return true
        }

        console.error("Error generating summary in background:", err)
        // Clear ongoing generation on error
        if (generationController && generationUrl) {
          await clearOngoingGenerationIfActive(generationUrl, generationController)
        }
        sendResponse({
          success: false,
          error: "Failed to generate summary: " + (err instanceof Error ? err.message : String(err)),
        })
      } finally {
        if (generationController && generationUrl && isActiveGeneration(generationUrl, generationController)) {
          activeGenerationControllers.delete(generationUrl)
        }
      }
      return true // Keep message channel open for async response
    }

    if (message.action === "cancelSummaryGeneration") {
      const { url } = message
      const generationController = typeof url === "string" ? activeGenerationControllers.get(url) : null

      generationController?.abort()
      await ongoingGenerationStore.setValue(null)

      if (typeof url === "string") {
        browser.runtime.sendMessage({
          action: "summaryCancelled",
          url,
        })
      }

      sendResponse({ success: Boolean(generationController) })
      return true
    }
  })
})
