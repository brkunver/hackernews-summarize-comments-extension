<script lang="ts">
  import { savedSummariesStore, modelChainStore, modelStore, ongoingGenerationStore } from "~/util/storage"
  import { formatModelWithProvider, getConfiguredModelChain, getModelProvider, type AiProvider } from "~/util/models"
  import { onMount } from "svelte"
  import snarkdown from "snarkdown"

  let isLoading = $state(false)
  let buttonText = $state("Get Comments")
  let comments = $state("")
  let summary = $state("")
  let error = $state("")
  let isGeneratingSummary = $state(false)
  let currentUrl = $state("")
  let isProcessingInBackground = $state(false)
  let currentModelName = $state("")
  let currentModelProvider = $state<AiProvider | null>(null)
  let summaryCreatedBy = $state("")
  let summaryCreatedByProvider = $state<AiProvider | null>(null)
  let isValidHackerNewsUrl = $state(false)

  function checkIfHackerNewsUrl(url: string): boolean {
    return url.includes("news.ycombinator.com/item?id=")
  }

  async function loadCurrentModel() {
    const [configuredModelChain, legacyModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])
    const currentModel = getConfiguredModelChain(configuredModelChain, legacyModel)[0] ?? ""

    currentModelName = currentModel
    currentModelProvider = getModelProvider(currentModel)
  }

  // Load cached summary on component mount and listen for background messages
  onMount(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab.url) {
        currentUrl = tab.url
        await loadCurrentModel()
        isValidHackerNewsUrl = checkIfHackerNewsUrl(tab.url)
        if (isValidHackerNewsUrl) {
          await loadCachedSummary(tab.url)
          await checkOngoingGeneration()
        }
        updateButtonText()
      }
    } catch (err) {
      console.error("Error loading cached summary:", err)
    }

    browser.runtime.onMessage.addListener(message => {
      if (message.action === "summaryComplete" && message.url === currentUrl) {
        summary = message.summary
        summaryCreatedBy = message.model || currentModelName
        summaryCreatedByProvider = message.provider || getModelProvider(summaryCreatedBy)
        currentModelName = message.model || currentModelName
        currentModelProvider = message.provider || getModelProvider(currentModelName)
        isProcessingInBackground = false
        isGeneratingSummary = false
        updateButtonText()
        console.log("Summary completed in background:", message.summary)
      }
    })
  })

  async function loadCachedSummary(url: string) {
    try {
      const savedSummaries = await savedSummariesStore.getValue()
      const cachedSummary = savedSummaries.find(item => item.id === url)

      if (cachedSummary?.summary?.trim()) {
        summary = cachedSummary.summary
        summaryCreatedBy = cachedSummary.createdBy
        summaryCreatedByProvider =
          (cachedSummary.provider as AiProvider | undefined) || getModelProvider(cachedSummary.createdBy)
        console.log("Loaded cached summary for:", url)
      }
    } catch (err) {
      console.error("Error loading cached summary:", err)
    }
  }

  function updateButtonText() {
    if (!isValidHackerNewsUrl) {
      buttonText = "Not a Hacker News Page"
    } else if (summary?.trim()) {
      buttonText = "Regenerate Summary"
    } else {
      buttonText = "Generate Summary"
    }
  }

  async function checkOngoingGeneration() {
    try {
      const ongoing = await ongoingGenerationStore.getValue()
      if (ongoing && ongoing.url === currentUrl && ongoing.timestamp > Date.now() - 300000) {
        // 5 minutes timeout
        isProcessingInBackground = true
        isGeneratingSummary = true
        currentModelName = ongoing.model
        currentModelProvider = getModelProvider(ongoing.model)
        updateButtonText()
      }
    } catch (err) {
      console.error("Error checking ongoing generation:", err)
    }
  }

  async function getComments() {
    isLoading = true
    buttonText = "Loading..."
    error = ""

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

      if (!tab.id) {
        error = "No active tab found"
        return
      }

      if (!tab.url) {
        error = "No URL found for current tab"
        return
      }

      currentUrl = tab.url

      // Always load cached summary for display, but don't return early
      await loadCachedSummary(tab.url)

      const contentResponse = await browser.tabs.sendMessage(tab.id, { action: "getComments" })

      if (contentResponse?.success && contentResponse.comments) {
        comments = contentResponse.comments
        console.log("Comments received:", contentResponse.comments)

        isProcessingInBackground = true
        isGeneratingSummary = true
        await loadCurrentModel()

        const backgroundResponse = await browser.runtime.sendMessage({
          action: "generateSummary",
          comments: contentResponse.comments,
          url: tab.url,
        })

        if (!backgroundResponse?.success) {
          error = backgroundResponse?.error || "Failed to generate summary"
          isProcessingInBackground = false
          isGeneratingSummary = false
          return
        }

        // Background script handles response via message listener, so we don't need to check here
        // The summary will be updated through the 'summaryComplete' message
        console.log("Summary generation started in background")
        // Don't reset loading states here - they will be reset when summaryComplete message arrives
      } else {
        error = contentResponse?.error || "Failed to get comments"
        console.error("Error getting comments:", contentResponse?.error)
      }
    } catch (err) {
      error = "Failed to communicate with content script"
      console.error("Error:", err)
    } finally {
      isLoading = false
      updateButtonText()
    }
  }

  function openOptions() {
    browser.runtime.openOptionsPage()
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
</script>

<main class="p-4 min-w-[350px] max-w-[500px]">
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
    <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
      <p class="font-semibold">Error:</p>
      <p class="text-sm">{error}</p>
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
