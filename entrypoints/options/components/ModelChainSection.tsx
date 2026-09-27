import { MODEL_CHAIN_LENGTH, formatModelWithProvider, getModelProvider } from "~/util/models"
import type { AiProvider } from "~/util/models"
import { For } from "solid-js"

type ModelChainSectionProps = {
  selectedModelChain: string[]
  onSelectModel: (slotIndex: number, model: string) => void
  availableModels: string[]
  apiKeys: Record<AiProvider, string>
}

const modelSlots = Array.from({ length: MODEL_CHAIN_LENGTH }, (_, index) => index)

export default function ModelChainSection(props: ModelChainSectionProps) {
  function isModelSelectable(model: string): boolean {
    const provider = getModelProvider(model)

    return provider !== null && props.apiKeys[provider].trim() !== ""
  }

  function isModelSelectedInAnotherSlot(model: string, slotIndex: number): boolean {
    return props.selectedModelChain.some((selectedModel, index) => index !== slotIndex && selectedModel === model)
  }

  function isModelOptionEnabled(model: string, slotIndex: number): boolean {
    return isModelSelectable(model) && !isModelSelectedInAnotherSlot(model, slotIndex)
  }

  function handleModelChange(slotIndex: number, event: Event) {
    if (event.currentTarget instanceof HTMLSelectElement) {
      props.onSelectModel(slotIndex, event.currentTarget.value)
    }
  }

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 class="text-sm font-semibold text-zinc-100">AI Model Fallback Order</h2>
      <p class="mt-1 text-sm text-zinc-400">
        Choose up to {MODEL_CHAIN_LENGTH} models. Generation tries them from top to bottom and stops after the last
        selected model.
      </p>

      <div class="mt-4 space-y-3">
        <For each={modelSlots}>
          {slot => (
            <div>
              <label for={`model-${slot}`} class="mb-1 block text-xs font-medium text-zinc-300">
                Model {slot + 1}
              </label>
              <select
                id={`model-${slot}`}
                value={props.selectedModelChain[slot] ?? ""}
                onchange={event => handleModelChange(slot, event)}
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100
                focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                <option value="">No model</option>
                <For each={props.availableModels}>
                  {model => (
                    <option value={model} disabled={!isModelOptionEnabled(model, slot)}>
                      {formatModelWithProvider(model)}
                    </option>
                  )}
                </For>
              </select>
            </div>
          )}
        </For>
      </div>

      <p class="mt-3 text-xs text-zinc-500">
        Models are selectable only when their provider API key is set. Duplicate provider/model pairs are skipped.
      </p>
    </section>
  )
}
