import { createMemo, createSignal, Show } from "solid-js"
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
  streamingStore,
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
import { AI_PROVIDER_API_KEY_FIELDS, createEmptyProviderApiKeys, getProviderApiKeys } from "~/util/providers"
import { onMount } from "solid-js"
import ApiKeysSection from "./components/ApiKeysSection"
import ModelChainSection from "./components/ModelChainSection"
import GoogleModelsSection from "./components/GoogleModelsSection"
import CommentSettingsSection from "./components/CommentSettingsSection"
import PromptEditor from "./components/PromptEditor"
import CachedSummariesSection from "./components/CachedSummariesSection"
import { normalizeMaxComments, normalizeMaxDepth, normalizeTimeout, padModelChain } from "./helpers"
import { getExtensionVersion } from "~/util/format"
import { createSettingsAutoSave } from "./auto-save"

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
  const [streaming, setStreaming] = createSignal(false)
  const [isReady, setIsReady] = createSignal(false)
  const [saveMessage, setSaveMessage] = createSignal("")
  const [cachedSummaries, setCachedSummaries] = createSignal<SavedSummaryV2[]>([])

  const availableModels = () => getAvailableModelRefs(customGoogleModels(), hiddenGoogleModels())
  const autoSave = createSettingsAutoSave(isReady)
  const savedModelChain = createMemo(() => {
    const allowedModels = new Set(availableModels())
    const chain = normalizeModelChain(
      selectedModelChain().filter(model => allowedModels.has(model) && isModelSelectable(model)),
      customGoogleModels(),
      hiddenGoogleModels(),
    )
    const fallbackModel = availableModels().find(isModelSelectable)
    return chain.length > 0 ? chain : fallbackModel ? [fallbackModel] : []
  })

  for (const field of AI_PROVIDER_API_KEY_FIELDS) {
    autoSave.bind(
      field.label,
      () => apiKeys()[field.provider],
      value => field.store.setValue(value),
      600,
    )
  }
  autoSave.bind("System prompt", systemPrompt, value => systemPromptStore.setValue(value), 600)
  autoSave.bind("Context prompt", contextSystemPrompt, value => contextSystemPromptStore.setValue(value), 600)
  autoSave.bind(
    "Max comments",
    () => normalizeMaxComments(maxComments()),
    value => maxCommentsStore.setValue(value),
    600,
  )
  autoSave.bind("Streaming", streaming, value => streamingStore.setValue(value))
  autoSave.bind("Random selection", randomSelection, value => randomCommentSelectionStore.setValue(value))
  autoSave.bind(
    "Max depth",
    () => normalizeMaxDepth(maxDepth()),
    value => maxCommentDepthStore.setValue(value),
    600,
  )
  autoSave.bind(
    "Timeout",
    () => normalizeTimeout(timeout()),
    value => timeoutStore.setValue(value),
    600,
  )
  autoSave.bind("Custom models", customGoogleModels, value => customGoogleModelsStore.setValue(value))
  autoSave.bind("Hidden models", hiddenGoogleModels, value => hiddenGoogleModelsStore.setValue(value))
  autoSave.bind("Model order", savedModelChain, async chain => {
    await modelChainStore.setValue(chain)
    if (chain[0]) {
      await modelStore.setValue(chain[0])
    }
  })

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
      setStreaming(await streamingStore.getValue())
      setCachedSummaries(await savedSummariesStore.getValue())
      setIsReady(true)
    } catch (error) {
      setSaveMessage(`Error loading settings: ${getErrorMessage(error)}`)
      console.error("Error loading settings:", error)
    }
  })

  function isModelSelectable(model: string): boolean {
    const provider = getModelProvider(model)

    return provider !== null && apiKeys()[provider].trim() !== ""
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
            <p class="mt-1 text-xs text-zinc-400" role="status" aria-live="polite">
              <Show when={isReady()} fallback="Loading settings...">
                {autoSave.pendingCount() > 0 ? "Saving changes..." : "Changes save automatically."}
              </Show>
            </p>
          </div>
        </header>

        <fieldset disabled={!isReady()} onFocusOut={autoSave.flush} class="min-w-0 space-y-4">
          <ApiKeysSection
            apiKeys={apiKeys()}
            onApiKeyInput={(provider, value) => setApiKeys(prev => ({ ...prev, [provider]: value }))}
          />

          <ModelChainSection
            selectedModelChain={padModelChain(savedModelChain())}
            onSelectModel={(slotIndex, model) =>
              setSelectedModelChain(
                padModelChain(savedModelChain()).map((selectedModel, index) =>
                  index === slotIndex ? model : selectedModel,
                ),
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

          <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-100">
              <input
                type="checkbox"
                checked={streaming()}
                onChange={event => setStreaming(event.currentTarget.checked)}
                class="h-4 w-4 accent-orange-500"
              />
              Stream summary
            </label>
            <p class="mt-2 text-xs text-zinc-400">
              Show words as the AI writes. When off, show the complete summary. Changes apply to the next summary.
            </p>
          </section>

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

          <Show when={saveMessage() || autoSave.error()}>
            <div class="rounded-xl bg-red-950 p-3 text-sm text-red-200" role="alert">
              <Show when={autoSave.error()} fallback={saveMessage()}>
                {error => (
                  <>
                    Could not save {error()[0]}: {error()[1]}
                    <button type="button" onclick={autoSave.flush} class="ml-3 underline">
                      Retry
                    </button>
                  </>
                )}
              </Show>
            </div>
          </Show>
        </fieldset>

        <div class="mt-4">
          <CachedSummariesSection summaries={cachedSummaries()} onChangeSummaries={setCachedSummaries} />
        </div>

        <p class="mt-8 text-center text-xs text-zinc-600">v{getExtensionVersion()}</p>
      </div>
    </main>
  )
}
