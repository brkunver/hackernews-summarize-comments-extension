import { For } from "solid-js"
import { AI_PROVIDER_API_KEY_FIELDS } from "~/util/providers"
import type { AiProvider } from "~/util/models"

type ApiKeysSectionProps = {
  apiKeys: Record<AiProvider, string>
  onApiKeyInput: (provider: AiProvider, value: string) => void
}

export default function ApiKeysSection(props: ApiKeysSectionProps) {
  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 class="text-sm font-semibold text-zinc-100">API Keys</h2>
      <p class="mt-1 text-sm text-zinc-400">Keys are stored locally and sent only to the selected AI provider to generate summaries.</p>

      <div class="mt-4 space-y-4">
        <For each={AI_PROVIDER_API_KEY_FIELDS}>
          {field => (
            <div>
              <label for={field.inputId} class="mb-1.5 block text-sm font-medium text-zinc-200">
                {field.label}
              </label>
              <input
                id={field.inputId}
                type="password"
                value={props.apiKeys[field.provider]}
                onInput={event => props.onApiKeyInput(field.provider, event.currentTarget.value)}
                placeholder={field.placeholder}
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder:text-zinc-500
                focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <p class="mt-1.5 text-xs text-zinc-500">{field.helpText}</p>
            </div>
          )}
        </For>
      </div>
    </section>
  )
}
