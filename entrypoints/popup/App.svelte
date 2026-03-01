<script lang="ts">
  import { savedSummariesStore } from "~/util/storage"
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

  // Load cached summary on component mount and listen for background messages
  onMount(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab.url) {
        currentUrl = tab.url
        await loadCachedSummary(tab.url)
      }
    } catch (err) {
      console.error("Error loading cached summary:", err)
    }

    browser.runtime.onMessage.addListener(message => {
      if (message.action === "summaryComplete" && message.url === currentUrl) {
        summary = message.summary
        isProcessingInBackground = false
        isGeneratingSummary = false
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
        console.log("Loaded cached summary for:", url)
      }
    } catch (err) {
      console.error("Error loading cached summary:", err)
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

        const backgroundResponse = await browser.runtime.sendMessage({
          action: "generateSummary",
          comments: contentResponse.comments,
          url: tab.url,
        })

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
      buttonText = "Get Comments"
    }
  }

  function openOptions() {
    browser.runtime.openOptionsPage()
  }
</script>

<main class="p-4 min-w-[350px] max-w-[500px]">
  <h1 class="text-2xl font-bold mb-4">HN Comments Summarizer</h1>

  <div class="space-y-3 mb-4">
    <button
      onclick={getComments}
      disabled={isLoading || isGeneratingSummary || isProcessingInBackground}
      class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-2 px-4 rounded transition-colors"
    >
      {buttonText}
    </button>

    <button
      onclick={openOptions}
      class="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors"
    >
      Options
    </button>
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
      <p class="text-sm">Processing in background... You can close this window.</p>
    </div>
  {/if}

  {#if isGeneratingSummary && !isProcessingInBackground}
    <div class="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
      <p class="text-sm">Generating summary with AI...</p>
    </div>
  {/if}

  <!-- Summary Display -->
  {#if summary}
    <div class="mb-4">
      <h2 class="text-lg font-semibold mb-2">Summary</h2>
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
