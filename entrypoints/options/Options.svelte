<script lang="ts">
  import { apiKeyStore, modelStore, systemPromptStore, savedSummariesStore } from "~/util/storage"
  import { onMount } from "svelte"

  let apiKey = $state("")
  let selectedModel = $state("gemini-2.5-flash")
  let systemPrompt = $state("")
  let isLoading = $state(false)
  let saveMessage = $state("")
  let isEditingPrompt = $state(false)
  let cachedSummaries = $state<{ id: string; summary: string }[]>([])

  const availableModels = [
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemma-3-27b-it",
  ]

  // Load values from storage on component mount
  onMount(async () => {
    try {
      apiKey = await apiKeyStore.getValue()
      selectedModel = await modelStore.getValue()
      systemPrompt = await systemPromptStore.getValue()
      cachedSummaries = await savedSummariesStore.getValue()
    } catch (error) {
      console.error("Error loading settings:", error)
    }
  })

  // Save settings to storage
  async function saveSettings() {
    isLoading = true
    saveMessage = ""

    try {
      await apiKeyStore.setValue(apiKey)
      await modelStore.setValue(selectedModel)
      await systemPromptStore.setValue(systemPrompt)
      saveMessage = "Settings saved successfully!"

      // Clear message after 3 seconds
      setTimeout(() => {
        saveMessage = ""
      }, 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
      saveMessage = "Error saving settings"
    } finally {
      isLoading = false
    }
  }

  function togglePromptEdit() {
    isEditingPrompt = !isEditingPrompt
  }

  async function deleteCachedSummary(id: string) {
    try {
      const updatedSummaries = cachedSummaries.filter(summary => summary.id !== id)
      cachedSummaries = updatedSummaries
      await savedSummariesStore.setValue(updatedSummaries)
    } catch (error) {
      console.error("Error deleting cached summary:", error)
    }
  }

  async function deleteAllCachedSummaries() {
    if (confirm("Are you sure you want to delete all cached summaries? This action cannot be undone.")) {
      try {
        cachedSummaries = []
        await savedSummariesStore.setValue([])
      } catch (error) {
        console.error("Error deleting all cached summaries:", error)
      }
    }
  }

  function truncateUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search
    } catch {
      return url
    }
  }

  function truncateSummary(summary: string, maxLength: number = 50): string {
    return summary.length > maxLength ? summary.substring(0, maxLength) + "..." : summary
  }
</script>

<main class="min-h-screen bg-gray-900 text-white p-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Settings</h1>

    <div class="space-y-6">
      <!-- API Key Input -->
      <div>
        <label for="apiKey" class="block text-sm font-medium mb-2"> Google AI API Key </label>
        <input
          id="apiKey"
          type="password"
          bind:value={apiKey}
          placeholder="Enter your Google AI API key"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-2 text-sm text-gray-400">Your API key is stored locally and never shared</p>
      </div>

      <!-- Model Selection -->
      <div>
        <label for="model" class="block text-sm font-medium mb-2"> AI Model </label>
        <select
          id="model"
          bind:value={selectedModel}
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {#each availableModels as model}
            <option value={model}>{model}</option>
          {/each}
        </select>
        <p class="mt-2 text-sm text-gray-400">Choose the AI model for comment summarization</p>
      </div>

      <!-- System Prompt -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label for="systemPrompt" class="text-sm font-medium"> System Prompt </label>
          <button
            type="button"
            onclick={togglePromptEdit}
            class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {isEditingPrompt ? "Cancel" : "Edit"}
          </button>
        </div>

        {#if !isEditingPrompt}
          <div class="relative">
            <textarea
              id="systemPrompt"
              bind:value={systemPrompt}
              readonly
              class="w-full h-64 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm
              text-gray-300 resize-none focus:outline-none"
              placeholder="System prompt will appear here..."
            ></textarea>
            <div class="absolute top-2 right-2 px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded">
              ⚠️ Be careful editing prompt
            </div>
          </div>
          <p class="mt-2 text-sm text-gray-400">
            This prompt guides the AI in summarizing comments. Click "Edit" to modify.
          </p>
        {:else}
          <textarea
            id="systemPrompt"
            bind:value={systemPrompt}
            class="w-full h-64 px-4 py-2 bg-gray-800 border border-blue-500 rounded-lg text-sm text-white
            resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your custom system prompt..."
          ></textarea>
          <p class="mt-2 text-sm text-yellow-400">
            ⚠️ Editing mode active. Changes will be saved when you click "Save Settings".
          </p>
        {/if}
      </div>

      <!-- Save Button -->
      <div class="pt-4">
        <button
          onclick={saveSettings}
          disabled={isLoading}
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-6
          rounded-lg transition-colors"
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>

        {#if saveMessage}
          <div
            class="mt-4 p-3 rounded-lg {saveMessage.includes('Error')
              ? 'bg-red-900 text-red-200'
              : 'bg-green-900 text-green-200'}"
          >
            {saveMessage}
          </div>
        {/if}
      </div>
    </div>

    <!-- Cached Summaries -->
    {#if cachedSummaries.length > 0}
      <div class="mt-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold">Cached Summaries ({cachedSummaries.length})</h2>
          <button
            onclick={deleteAllCachedSummaries}
            class="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Delete All
          </button>
        </div>
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div class="space-y-2">
            {#each cachedSummaries as summary (summary.id)}
              <div
                class="flex items-center justify-between p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <div class="flex-1 min-w-0">
                  <a
                    href={summary.id}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-blue-300 hover:text-blue-200 truncate underline cursor-pointer"
                  >
                    {truncateUrl(summary.id)}
                  </a>
                  <div class="text-xs text-gray-400 truncate">{truncateSummary(summary.summary)}</div>
                </div>
                <button
                  onclick={() => deleteCachedSummary(summary.id)}
                  class="ml-2 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="mt-8">
        <h2 class="text-xl font-semibold mb-4">Cached Summaries</h2>
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p class="text-sm text-gray-400">No cached summaries found</p>
        </div>
      </div>
    {/if}
  </div>
</main>
