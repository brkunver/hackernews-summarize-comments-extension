<script lang="ts">
  import {
    DEFAULT_MAX_COMMENTS,
    DEFAULT_SUMMARY_TIMEOUT_SECONDS,
    modelChainStore,
    modelStore,
    systemPromptStore,
    timeoutStore,
    savedSummariesStore,
    maxCommentsStore,
    type SavedSummaryV2,
  } from "~/util/storage"
  import { getErrorMessage } from "~/util/errors"
  import {
    MODEL_CHAIN_LENGTH,
    formatModelWithProvider,
    getAvailableModelRefs,
    getConfiguredModelChain,
    getModelProvider,
    normalizeModelChain,
    type AiProvider,
  } from "~/util/models"
  import {
    AI_PROVIDER_API_KEY_FIELDS,
    createEmptyProviderApiKeys,
    getProviderApiKeys,
    setProviderApiKeys,
  } from "~/util/providers"
  import { onMount } from "svelte"

  let apiKeys = $state<Record<AiProvider, string>>(createEmptyProviderApiKeys())
  let selectedModelChain = $state<string[]>(Array(MODEL_CHAIN_LENGTH).fill(""))
  let systemPrompt = $state("")
  let maxComments = $state(100)
  let timeout = $state(DEFAULT_SUMMARY_TIMEOUT_SECONDS)
  let isLoading = $state(false)
  let saveMessage = $state("")
  let isEditingPrompt = $state(false)
  let cachedSummaries = $state<SavedSummaryV2[]>([])

  const availableModels = getAvailableModelRefs()
  const modelSlots = Array.from({ length: MODEL_CHAIN_LENGTH }, (_, index) => index)

  // Load values from storage on component mount
  onMount(async () => {
    try {
      apiKeys = await getProviderApiKeys()
      const [configuredModelChain, legacyModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])
      selectedModelChain = padModelChain(getConfiguredModelChain(configuredModelChain, legacyModel))
      systemPrompt = await systemPromptStore.getValue()
      maxComments = normalizeMaxComments(await maxCommentsStore.getValue())
      timeout = await timeoutStore.getValue()
      cachedSummaries = await savedSummariesStore.getValue()
    } catch (error) {
      saveMessage = `Error loading settings: ${getErrorMessage(error)}`
      console.error("Error loading settings:", error)
    }
  })

  // Save settings to storage
  async function saveSettings() {
    isLoading = true
    saveMessage = ""

    try {
      const selectableModels = availableModels.filter(isModelSelectable)
      const modelChainToSave = normalizeModelChain(selectedModelChain.filter(isModelSelectable))
      const fallbackModel = selectableModels[0]
      const savedModelChain = modelChainToSave.length > 0 ? modelChainToSave : fallbackModel ? [fallbackModel] : []

      await setProviderApiKeys(apiKeys)
      await systemPromptStore.setValue(systemPrompt)
      await maxCommentsStore.setValue(normalizeMaxComments(maxComments))
      await timeoutStore.setValue(normalizeTimeout(timeout))
      await modelChainStore.setValue(savedModelChain)
      selectedModelChain = padModelChain(savedModelChain)
      maxComments = normalizeMaxComments(maxComments)
      timeout = normalizeTimeout(timeout)

      if (savedModelChain[0]) {
        await modelStore.setValue(savedModelChain[0])
        saveMessage = "Settings saved successfully!"
      } else {
        saveMessage = "Settings saved. Add an API key and choose at least one model to enable generation."
      }

      // Clear message after 3 seconds
      setTimeout(() => {
        saveMessage = ""
      }, 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
      saveMessage = `Error saving settings: ${getErrorMessage(error)}`
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
      saveMessage = `Error deleting cached summary: ${getErrorMessage(error)}`
      console.error("Error deleting cached summary:", error)
    }
  }

  async function deleteAllCachedSummaries() {
    if (confirm("Are you sure you want to delete all cached summaries? This action cannot be undone.")) {
      try {
        cachedSummaries = []
        await savedSummariesStore.setValue([])
      } catch (error) {
        saveMessage = `Error deleting cached summaries: ${getErrorMessage(error)}`
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

  function normalizeTimeout(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_SUMMARY_TIMEOUT_SECONDS
  }

  function normalizeMaxComments(value: number): number {
    if (!Number.isFinite(value)) {
      return DEFAULT_MAX_COMMENTS
    }

    if (value <= 0) {
      return value === 0 ? 0 : -1
    }

    return Math.floor(value)
  }

  function isModelSelectable(model: string): boolean {
    const provider = getModelProvider(model)

    return provider !== null && apiKeys[provider].trim() !== ""
  }

  function isModelSelectedInAnotherSlot(model: string, slotIndex: number): boolean {
    return selectedModelChain.some((selectedModel, index) => index !== slotIndex && selectedModel === model)
  }

  function isModelOptionEnabled(model: string, slotIndex: number): boolean {
    return isModelSelectable(model) && !isModelSelectedInAnotherSlot(model, slotIndex)
  }

  function updateSelectedModel(slotIndex: number, model: string) {
    if (model !== "" && !isModelOptionEnabled(model, slotIndex)) {
      return
    }

    selectedModelChain = selectedModelChain.map((selectedModel, index) => (index === slotIndex ? model : selectedModel))
  }

  function handleModelChange(slotIndex: number, event: Event) {
    if (event.currentTarget instanceof HTMLSelectElement) {
      updateSelectedModel(slotIndex, event.currentTarget.value)
    }
  }

  function handleApiKeyInput(provider: AiProvider, event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      apiKeys = {
        ...apiKeys,
        [provider]: event.currentTarget.value,
      }
    }
  }

  function padModelChain(modelChain: readonly string[]): string[] {
    return [
      ...modelChain.slice(0, MODEL_CHAIN_LENGTH),
      ...Array(Math.max(0, MODEL_CHAIN_LENGTH - modelChain.length)).fill(""),
    ]
  }

  function getModelLabel(model: string): string {
    return formatModelWithProvider(model)
  }

  function getExtensionVersion(): string {
    return browser.runtime.getManifest().version
  }
</script>

<main class="min-h-screen bg-gray-900 text-white p-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Settings</h1>

    <div class="space-y-6">
      <!-- API Key Inputs -->
      {#each AI_PROVIDER_API_KEY_FIELDS as field}
        <div>
          <label for={field.inputId} class="block text-sm font-medium mb-2"> {field.label} </label>
          <input
            id={field.inputId}
            type="password"
            value={apiKeys[field.provider]}
            oninput={event => handleApiKeyInput(field.provider, event)}
            placeholder={field.placeholder}
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p class="mt-2 text-sm text-gray-400">{field.helpText}</p>
        </div>
      {/each}

      <!-- Model Selection -->
      <div>
        <div class="mb-3">
          <h2 class="text-sm font-medium">AI Model Fallback Order</h2>
          <p class="mt-2 text-sm text-gray-400">
            Choose up to 5 models. Generation tries them from top to bottom and stops after the last selected model.
          </p>
        </div>

        <div class="space-y-3">
          {#each modelSlots as slot}
            <div>
              <label for={`model-${slot}`} class="block text-xs font-medium text-gray-300 mb-1">
                Model {slot + 1}
              </label>
              <select
                id={`model-${slot}`}
                value={selectedModelChain[slot] ?? ""}
                onchange={event => handleModelChange(slot, event)}
                class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">No model</option>
                {#each availableModels as model}
                  <option value={model} disabled={!isModelOptionEnabled(model, slot)}>{getModelLabel(model)}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>

        <p class="mt-2 text-sm text-gray-400">
          Models are selectable only when their provider API key is set. Duplicate provider/model pairs are skipped.
        </p>
      </div>

      <!-- Max Comments -->
      <div>
        <label for="maxComments" class="block text-sm font-medium mb-2"> Max Comments </label>
        <input
          id="maxComments"
          type="number"
          bind:value={maxComments}
          min="-1"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-2 text-sm text-gray-400">
          Maximum number of comments to process. Enter 0 or -1 for no limit. Default: {DEFAULT_MAX_COMMENTS}
        </p>
      </div>

      <!-- Timeout -->
      <div>
        <label for="timeout" class="block text-sm font-medium mb-2"> Model Timeout </label>
        <input
          id="timeout"
          type="number"
          bind:value={timeout}
          min="1"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-2 text-sm text-gray-400">
          Seconds to wait for each model before trying the next configured model. Default:
          {DEFAULT_SUMMARY_TIMEOUT_SECONDS}
        </p>
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
                  <div class="text-xs text-gray-500">Created by: {summary.createdBy}</div>
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

    <p class="mt-8 text-center text-xs text-gray-500">v{getExtensionVersion()}</p>
  </div>
</main>
