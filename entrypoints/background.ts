import { GenerateText } from "@@/util/generate-ai"
import { getConfiguredModelChain } from "@@/util/models"
import { savedSummariesStore, modelChainStore, modelStore, ongoingGenerationStore } from "@@/util/storage"

export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id })

  // Handle messages from popup
  browser.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (message.action === "generateSummary") {
      try {
        const { comments, url } = message

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
        const summary = await GenerateText(comments)

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
          await ongoingGenerationStore.setValue(null)

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
          await ongoingGenerationStore.setValue(null)
          sendResponse({ success: false, error: "AI returned empty summary" })
        }
      } catch (err) {
        console.error("Error generating summary in background:", err)
        // Clear ongoing generation on error
        await ongoingGenerationStore.setValue(null)
        sendResponse({
          success: false,
          error: "Failed to generate summary: " + (err instanceof Error ? err.message : String(err)),
        })
      }
      return true // Keep message channel open for async response
    }
  })
})
