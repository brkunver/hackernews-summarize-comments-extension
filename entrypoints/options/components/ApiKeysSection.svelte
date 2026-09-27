<script lang="ts">
  import { AI_PROVIDER_API_KEY_FIELDS } from "~/util/providers"
  import type { AiProvider } from "~/util/models"

  let { apiKeys = $bindable() }: { apiKeys: Record<AiProvider, string> } = $props()

  function handleApiKeyInput(provider: AiProvider, event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      apiKeys = {
        ...apiKeys,
        [provider]: event.currentTarget.value,
      }
    }
  }
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
  <h2 class="text-sm font-semibold text-zinc-100">API Keys</h2>
  <p class="mt-1 text-sm text-zinc-400">Keys are stored locally in the browser and never shared.</p>

  <div class="mt-4 space-y-4">
    {#each AI_PROVIDER_API_KEY_FIELDS as field}
      <div>
        <label for={field.inputId} class="mb-1.5 block text-sm font-medium text-zinc-200">{field.label}</label>
        <input
          id={field.inputId}
          type="password"
          value={apiKeys[field.provider]}
          oninput={event => handleApiKeyInput(field.provider, event)}
          placeholder={field.placeholder}
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder:text-zinc-500
          focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        />
        <p class="mt-1.5 text-xs text-zinc-500">{field.helpText}</p>
      </div>
    {/each}
  </div>
</section>
