<script lang="ts">
  import {
    DEFAULT_RANDOM_COMMENT_SELECTION,
    DEFAULT_MAX_COMMENT_DEPTH,
    DEFAULT_SUMMARY_TIMEOUT_SECONDS,
    contextSystemPromptStore,
    customGoogleModelsStore,
    hiddenGoogleModelsStore,
    maxCommentDepthStore,
    maxCommentsStore,
    modelChainStore,
    modelStore,
    randomCommentSelectionStore,
    savedSummariesStore,
    systemPromptStore,
    timeoutStore,
    type SavedSummaryV2,
  } from "~/util/storage"
  import { getErrorMessage } from "~/util/errors"
  import {
    MODEL_CHAIN_LENGTH,
    getAvailableModelRefs,
    getConfiguredModelChain,
    getModelProvider,
    normalizeCustomGoogleModels,
    normalizeHiddenGoogleModels,
    normalizeModelChain,
  } from "~/util/models"
  import type { AiProvider } from "~/util/models"
  import { createEmptyProviderApiKeys, getProviderApiKeys, setProviderApiKeys } from "~/util/providers"
  import { onMount } from "svelte"
  import ApiKeysSection from "./components/ApiKeysSection.svelte"
  import ModelChainSection from "./components/ModelChainSection.svelte"
  import GoogleModelsSection from "./components/GoogleModelsSection.svelte"
  import CommentSettingsSection from "./components/CommentSettingsSection.svelte"
  import PromptEditor from "./components/PromptEditor.svelte"
  import CachedSummariesSection from "./components/CachedSummariesSection.svelte"
  import { normalizeMaxComments, normalizeMaxDepth, normalizeTimeout, padModelChain } from "./helpers"
  import { getExtensionVersion } from "~/util/format"

  let apiKeys = $state<Record<AiProvider, string>>(createEmptyProviderApiKeys())
  let selectedModelChain = $state<string[]>(Array(MODEL_CHAIN_LENGTH).fill(""))
  let systemPrompt = $state("")
  let contextSystemPrompt = $state("")
  let maxComments = $state(100)
  let randomSelection = $state(DEFAULT_RANDOM_COMMENT_SELECTION)
  let maxDepth = $state(DEFAULT_MAX_COMMENT_DEPTH)
  let customGoogleModels = $state<string[]>([])
  let hiddenGoogleModels = $state<string[]>([])
  let newCustomModel = $state("")
  let timeout = $state(DEFAULT_SUMMARY_TIMEOUT_SECONDS)
  let isLoading = $state(false)
  let saveMessage = $state("")
  let cachedSummaries = $state<SavedSummaryV2[]>([])

  const availableModels = $derived(getAvailableModelRefs(customGoogleModels, hiddenGoogleModels))

  onMount(async () => {
    try {
      apiKeys = await getProviderApiKeys()
      const [configuredModelChain, legacyModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])
      const storedCustomModels = normalizeCustomGoogleModels(await customGoogleModelsStore.getValue())
      const storedHiddenModels = normalizeHiddenGoogleModels(await hiddenGoogleModelsStore.getValue())
      customGoogleModels = storedCustomModels
      hiddenGoogleModels = storedHiddenModels
      const allowedModelRefs = new Set(getAvailableModelRefs(storedCustomModels, storedHiddenModels))
      selectedModelChain = padModelChain(
        getConfiguredModelChain(configuredModelChain, legacyModel, storedCustomModels, storedHiddenModels).filter(
          model => allowedModelRefs.has(model),
        ),
      )
      systemPrompt = await systemPromptStore.getValue()
      contextSystemPrompt = await contextSystemPromptStore.getValue()
      maxComments = normalizeMaxComments(await maxCommentsStore.getValue())
      randomSelection = (await randomCommentSelectionStore.getValue()) ?? DEFAULT_RANDOM_COMMENT_SELECTION
      maxDepth = normalizeMaxDepth(await maxCommentDepthStore.getValue())
      timeout = await timeoutStore.getValue()
      cachedSummaries = await savedSummariesStore.getValue()
    } catch (error) {
      saveMessage = `Error loading settings: ${getErrorMessage(error)}`
      console.error("Error loading settings:", error)
    }
  })

  function isModelSelectable(model: string): boolean {
    const provider = getModelProvider(model)

    return provider !== null && apiKeys[provider].trim() !== ""
  }

  async function saveSettings() {
    isLoading = true
    saveMessage = ""

    try {
      const normalizedCustomModels = normalizeCustomGoogleModels(customGoogleModels)
      const normalizedHiddenModels = normalizeHiddenGoogleModels(hiddenGoogleModels)
      customGoogleModels = normalizedCustomModels
      hiddenGoogleModels = normalizedHiddenModels
      const allowedModelRefs = new Set(getAvailableModelRefs(normalizedCustomModels, normalizedHiddenModels))
      const selectableModels = getAvailableModelRefs(normalizedCustomModels, normalizedHiddenModels).filter(
        isModelSelectable,
      )
      const modelChainToSave = normalizeModelChain(
        selectedModelChain.filter(model => allowedModelRefs.has(model) && isModelSelectable(model)),
        normalizedCustomModels,
        normalizedHiddenModels,
      )
      const fallbackModel = selectableModels[0]
      const savedModelChain = modelChainToSave.length > 0 ? modelChainToSave : fallbackModel ? [fallbackModel] : []

      await setProviderApiKeys(apiKeys)
      await systemPromptStore.setValue(systemPrompt)
      await contextSystemPromptStore.setValue(contextSystemPrompt)
      await maxCommentsStore.setValue(normalizeMaxComments(maxComments))
      await randomCommentSelectionStore.setValue(randomSelection)
      await maxCommentDepthStore.setValue(normalizeMaxDepth(maxDepth))
      await customGoogleModelsStore.setValue(normalizedCustomModels)
      await hiddenGoogleModelsStore.setValue(normalizedHiddenModels)
      await timeoutStore.setValue(normalizeTimeout(timeout))
      await modelChainStore.setValue(savedModelChain)
      selectedModelChain = padModelChain(savedModelChain)
      maxComments = normalizeMaxComments(maxComments)
      maxDepth = normalizeMaxDepth(maxDepth)
      newCustomModel = ""

      const firstModel = savedModelChain[0]

      if (firstModel) {
        await modelStore.setValue(firstModel)
        saveMessage = "Settings saved successfully!"
      } else {
        saveMessage = "Settings saved. Add an API key and choose at least one model to enable generation."
      }

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
</script>

<main class="min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
  <div class="mx-auto max-w-3xl">
    <header class="mb-6 flex items-center gap-3">
      <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-lg font-bold text-white"
        >Y</span
      >
      <div>
        <h1 class="text-xl font-bold">Settings</h1>
        <p class="text-xs text-zinc-500">Hackernews Summarize Comments</p>
      </div>
    </header>

    <div class="space-y-4">
      <ApiKeysSection bind:apiKeys />

      <ModelChainSection bind:selectedModelChain {availableModels} {apiKeys} />

      <GoogleModelsSection bind:customGoogleModels bind:newCustomModel bind:hiddenGoogleModels />

      <CommentSettingsSection bind:maxComments bind:randomSelection bind:maxDepth bind:timeout />

      <PromptEditor
        title="System Prompt"
        description="This prompt guides the AI in summarizing comments."
        inputId="systemPrompt"
        bind:value={systemPrompt}
      />

      <PromptEditor
        title="Context System Prompt"
        description="This prompt is used for Generate Summary with Context. It tells the AI to also read the linked story."
        inputId="contextSystemPrompt"
        bind:value={contextSystemPrompt}
      />

      <div class="pt-2">
        <button
          onclick={saveSettings}
          disabled={isLoading}
          class="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors
          hover:bg-orange-500 disabled:bg-orange-900 disabled:text-zinc-400"
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>

        {#if saveMessage}
          <div
            class="mt-4 rounded-xl p-3 text-sm {saveMessage.includes('Error')
              ? 'bg-red-950 text-red-200'
              : 'bg-emerald-950 text-emerald-200'}"
          >
            {saveMessage}
          </div>
        {/if}
      </div>
    </div>

    <div class="mt-4">
      <CachedSummariesSection bind:summaries={cachedSummaries} />
    </div>

    <p class="mt-8 text-center text-xs text-zinc-600">v{getExtensionVersion()}</p>
  </div>
</main>
