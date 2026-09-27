import { createMemo, createSignal, For, Show } from "solid-js"
import { GOOGLE_AI_MODELS, sanitizeCustomGoogleModel } from "~/util/models"

type GoogleModelsSectionProps = {
  customGoogleModels: string[]
  onAddCustomModel: (sanitizedModel: string) => void
  onRemoveCustomModel: (model: string) => void
  newCustomModel: string
  onNewCustomModelInput: (value: string) => void
  hiddenGoogleModels: string[]
  onHideBuiltinModel: (model: string) => void
  onUnhideBuiltinModel: (model: string) => void
}

export default function GoogleModelsSection(props: GoogleModelsSectionProps) {
  const [customModelError, setCustomModelError] = createSignal("")

  const hiddenSet = createMemo(() => new Set(props.hiddenGoogleModels))

  function addCustomModel() {
    const sanitized = sanitizeCustomGoogleModel(props.newCustomModel)

    if (sanitized === null) {
      setCustomModelError("Enter a valid Google model id (letters, numbers, ., _, -).")
      return
    }

    if (props.customGoogleModels.includes(sanitized)) {
      setCustomModelError("This model is already in the list.")
      return
    }

    props.onAddCustomModel(sanitized)
    props.onNewCustomModelInput("")
    setCustomModelError("")
  }

  function handleAddKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault()
      addCustomModel()
    }
  }

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 class="text-sm font-semibold text-zinc-100">Google Models</h2>
      <p class="mt-1 text-sm text-zinc-400">
        Hide built-in models you never use, or add extra model ids as plain strings (for example:
        gemini-flash-lite-3.5).
      </p>

      <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Built-in models</h3>
      <ul class="space-y-2">
        <For each={[...GOOGLE_AI_MODELS]}>
          {model => (
            <li
              class={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                hiddenSet().has(model) ? "border-zinc-800 bg-zinc-900 opacity-60" : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <span
                class={`font-mono text-sm ${hiddenSet().has(model) ? "text-zinc-500 line-through" : "text-zinc-200"}`}
              >
                {model}
              </span>
              <Show
                when={hiddenSet().has(model)}
                fallback={
                  <button
                    type="button"
                    onclick={() => props.onHideBuiltinModel(model)}
                    class="rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
                  >
                    Hide
                  </button>
                }
              >
                <button
                  type="button"
                  onclick={() => props.onUnhideBuiltinModel(model)}
                  class="rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
                >
                  Unhide
                </button>
              </Show>
            </li>
          )}
        </For>
      </ul>

      <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Custom models</h3>
      <div class="flex gap-2">
        <input
          id="newCustomGoogleModel"
          type="text"
          value={props.newCustomModel}
          onInput={event => props.onNewCustomModelInput(event.currentTarget.value)}
          onKeyDown={handleAddKeydown}
          placeholder="gemini-flash-lite-3.5"
          class="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-sm text-zinc-100
          placeholder:text-zinc-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <button
          type="button"
          onclick={addCustomModel}
          class="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
        >
          Add
        </button>
      </div>

      <Show when={customModelError()}>
        <p class="mt-2 text-sm text-red-400">{customModelError()}</p>
      </Show>

      <Show
        when={props.customGoogleModels.length > 0}
        fallback={<p class="mt-3 text-sm text-zinc-500">No custom Google models added yet.</p>}
      >
        <ul class="mt-3 space-y-2">
          <For each={props.customGoogleModels}>
            {model => (
              <li class="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                <span class="font-mono text-sm text-zinc-200">{model}</span>
                <button
                  type="button"
                  onclick={() => props.onRemoveCustomModel(model)}
                  class="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
                >
                  Delete
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
