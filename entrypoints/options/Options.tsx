import { createSignal, Show } from "solid-js"
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
import { onMount } from "solid-js"
import ApiKeysSection from "./components/ApiKeysSection"
import ModelChainSection from "./components/ModelChainSection"
import GoogleModelsSection from "./components/GoogleModelsSection"
import CommentSettingsSection from "./components/CommentSettingsSection"
import PromptEditor from "./components/PromptEditor"
import CachedSummariesSection from "./components/CachedSummariesSection"
import { normalizeMaxComments, normalizeMaxDepth, normalizeTimeout, padModelChain } from "./helpers"
import { getExtensionVersion } from "~/util/format"

export default function Options() {
  const [apiKeys, setApiKeys] = createSignal<Record<AiProvider, string>>(createEmptyProviderApiKeys())
  const [selectedModelChain, setSelectedModelChain] = createSignal<string[]>(Array(MODEL_CHAIN_LENGTH).fill(""))
  const [systemPrompt, setSystemPrompt] = createSignal("")
  const [contextSystemPrompt, setContextSystemPrompt] = createSignal("")
  const [maxComments, setMaxComments] = createSignal(100)
  const [randomSelection, setRandomSelection] = createSignal(DEFAULT_RANDOM_COMMENT_SELECTION)
  const [maxDepth, setMaxDepth] = createSignal(DEFAULT_MAX_COMMENT_DEPTH)
  const [customGoogleModels, setCustomGoogleModels] = createSignal<string[]>([])
  const [hiddenGoogleModels, setHiddenGoogleModels] = createSignal<string[]>([])
  const [newCustomModel, setNewCustomModel] = createSignal("")
  const [timeout, setTimeout] = createSignal(DEFAULT_SUMMARY_TIMEOUT_SECONDS)
  const [isLoading, setIsLoading] = createSignal(false)
  const [saveMessage, setSaveMessage] = createSignal("")
  const [cachedSummaries, setCachedSummaries] = createSignal<SavedSummaryV2[]>([])

  const availableModels = () => getAvailableModelRefs(customGoogleModels(), hiddenGoogleModels())
  const isSaveError = () => saveMessage().includes("Error")

  onMount(async () => {
    try {
      setApiKeys(await getProviderApiKeys())
      const [configuredModelChain, legacyModel] = await Promise.all([modelChainStore.getValue(), modelStore.getValue()])
      const storedCustomModels = normalizeCustomGoogleModels(await customGoogleModelsStore.getValue())
      const storedHiddenModels = normalizeHiddenGoogleModels(await hiddenGoogleModelsStore.getValue())
      setCustomGoogleModels(storedCustomModels)
      setHiddenGoogleModels(storedHiddenModels)
      const allowedModelRefs = new Set(getAvailableModelRefs(storedCustomModels, storedHiddenModels))
      setSelectedModelChain(
        padModelChain(
          getConfiguredModelChain(configuredModelChain, legacyModel, storedCustomModels, storedHiddenModels).filter(
            model => allowedModelRefs.has(model),
          ),
        ),
      )
      setSystemPrompt(await systemPromptStore.getValue())
      setContextSystemPrompt(await contextSystemPromptStore.getValue())
      setMaxComments(normalizeMaxComments(await maxCommentsStore.getValue()))
      setRandomSelection((await randomCommentSelectionStore.getValue()) ?? DEFAULT_RANDOM_COMMENT_SELECTION)
      setMaxDepth(normalizeMaxDepth(await maxCommentDepthStore.getValue()))
      setTimeout(await timeoutStore.getValue())
      setCachedSummaries(await savedSummariesStore.getValue())
    } catch (error) {
      setSaveMessage(`Error loading settings: ${getErrorMessage(error)}`)
      console.error("Error loading settings:", error)
    }
  })

  function isModelSelectable(model: string): boolean {
    const provider = getModelProvider(model)

    return provider !== null && apiKeys()[provider].trim() !== ""
  }

  async function saveSettings() {
    setIsLoading(true)
    setSaveMessage("")

    try {
      const normalizedCustomModels = normalizeCustomGoogleModels(customGoogleModels())
      const normalizedHiddenModels = normalizeHiddenGoogleModels(hiddenGoogleModels())
      setCustomGoogleModels(normalizedCustomModels)
      setHiddenGoogleModels(normalizedHiddenModels)
      const allowedModelRefs = new Set(getAvailableModelRefs(normalizedCustomModels, normalizedHiddenModels))
      const selectableModels = getAvailableModelRefs(normalizedCustomModels, normalizedHiddenModels).filter(
        isModelSelectable,
      )
      const modelChainToSave = normalizeModelChain(
        selectedModelChain().filter(model => allowedModelRefs.has(model) && isModelSelectable(model)),
        normalizedCustomModels,
        normalizedHiddenModels,
      )
      const fallbackModel = selectableModels[0]
      const savedModelChain = modelChainToSave.length > 0 ? modelChainToSave : fallbackModel ? [fallbackModel] : []

      await setProviderApiKeys(apiKeys())
      await systemPromptStore.setValue(systemPrompt())
      await contextSystemPromptStore.setValue(contextSystemPrompt())
      await maxCommentsStore.setValue(normalizeMaxComments(maxComments()))
      await randomCommentSelectionStore.setValue(randomSelection())
      await maxCommentDepthStore.setValue(normalizeMaxDepth(maxDepth()))
      await customGoogleModelsStore.setValue(normalizedCustomModels)
      await hiddenGoogleModelsStore.setValue(normalizedHiddenModels)
      await timeoutStore.setValue(normalizeTimeout(timeout()))
      await modelChainStore.setValue(savedModelChain)
      setSelectedModelChain(padModelChain(savedModelChain))
      setMaxComments(normalizeMaxComments(maxComments()))
      setMaxDepth(normalizeMaxDepth(maxDepth()))
      setNewCustomModel("")

      const firstModel = savedModelChain[0]

      if (firstModel) {
        await modelStore.setValue(firstModel)
        setSaveMessage("Settings saved successfully!")
      } else {
        setSaveMessage("Settings saved. Add an API key and choose at least one model to enable generation.")
      }

      window.setTimeout(() => {
        setSaveMessage("")
      }, 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
      setSaveMessage(`Error saving settings: ${getErrorMessage(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main class="min-h-screen bg-zinc-950 p-4 text-zinc-100 sm:p-8">
      <div class="mx-auto max-w-3xl">
        <header class="mb-6 flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-lg font-bold text-white">
            Y
          </span>
          <div>
            <h1 class="text-xl font-bold">Settings</h1>
            <p class="text-xs text-zinc-500">Hackernews Summarize Comments</p>
          </div>
        </header>

        <div class="space-y-4">
          <ApiKeysSection
            apiKeys={apiKeys()}
            onApiKeyInput={(provider, value) => setApiKeys(prev => ({ ...prev, [provider]: value }))}
          />

          <ModelChainSection
            selectedModelChain={selectedModelChain()}
            onSelectModel={(slotIndex, model) =>
              setSelectedModelChain(prev =>
                prev.map((selectedModel, index) => (index === slotIndex ? model : selectedModel)),
              )
            }
            availableModels={availableModels()}
            apiKeys={apiKeys()}
          />

          <GoogleModelsSection
            customGoogleModels={customGoogleModels()}
            onAddCustomModel={sanitized =>
              setCustomGoogleModels(prev => normalizeCustomGoogleModels([...prev, sanitized]))
            }
            onRemoveCustomModel={model => setCustomGoogleModels(prev => prev.filter(item => item !== model))}
            newCustomModel={newCustomModel()}
            onNewCustomModelInput={setNewCustomModel}
            hiddenGoogleModels={hiddenGoogleModels()}
            onHideBuiltinModel={model => setHiddenGoogleModels(prev => normalizeHiddenGoogleModels([...prev, model]))}
            onUnhideBuiltinModel={model => setHiddenGoogleModels(prev => prev.filter(item => item !== model))}
          />

          <CommentSettingsSection
            maxComments={maxComments()}
            onMaxCommentsInput={setMaxComments}
            randomSelection={randomSelection()}
            onRandomSelectionInput={setRandomSelection}
            maxDepth={maxDepth()}
            onMaxDepthInput={setMaxDepth}
            timeout={timeout()}
            onTimeoutInput={setTimeout}
          />

          <PromptEditor
            title="System Prompt"
            description="This prompt guides the AI in summarizing comments."
            inputId="systemPrompt"
            value={systemPrompt()}
            onInput={setSystemPrompt}
          />

          <PromptEditor
            title="Context System Prompt"
            description="This prompt is used for Generate Summary with Context. It tells the AI to also read the linked story."
            inputId="contextSystemPrompt"
            value={contextSystemPrompt()}
            onInput={setContextSystemPrompt}
          />

          <div class="pt-2">
            <button
              onclick={saveSettings}
              disabled={isLoading()}
              class="w-full rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors
              hover:bg-orange-500 disabled:bg-orange-900 disabled:text-zinc-400"
            >
              {isLoading() ? "Saving..." : "Save Settings"}
            </button>

            <Show when={saveMessage()}>
              <div
                class={`mt-4 rounded-xl p-3 text-sm ${isSaveError() ? "bg-red-950 text-red-200" : "bg-emerald-950 text-emerald-200"}`}
              >
                {saveMessage()}
              </div>
            </Show>
          </div>
        </div>

        <div class="mt-4">
          <CachedSummariesSection summaries={cachedSummaries()} onChangeSummaries={setCachedSummaries} />
        </div>

        <p class="mt-8 text-center text-xs text-zinc-600">v{getExtensionVersion()}</p>
      </div>
    </main>
  )
}
