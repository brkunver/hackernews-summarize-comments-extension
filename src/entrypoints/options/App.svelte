<script lang="ts">
  import { apiKeyStore, modelStore, systemPromptStore } from "~/util/storage"
  import { onMount } from "svelte"

  let apiKey = $state("")
  let selectedModel = $state("gemini-2.5-flash")
  let systemPrompt = $state("")
  let isLoading = $state(false)
  let saveMessage = $state("")
  let isEditingPrompt = $state(false)

  const availableModels = ["gemini-2.5-flash", "gemini-3.0-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"]

  // Load values from storage on component mount
  onMount(async () => {
    try {
      apiKey = await apiKeyStore.getValue()
      selectedModel = await modelStore.getValue()
      systemPrompt = await systemPromptStore.getValue()
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
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-2 text-sm text-gray-400">Your API key is stored locally and never shared</p>
      </div>

      <!-- Model Selection -->
      <div>
        <label for="model" class="block text-sm font-medium mb-2"> AI Model </label>
        <select
          id="model"
          bind:value={selectedModel}
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              class="w-full h-64 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 resize-none focus:outline-none"
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
            class="w-full h-64 px-4 py-2 bg-gray-800 border border-blue-500 rounded-lg text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
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
  </div>
</main>
