<script lang="ts">
  import {
    GOOGLE_AI_MODELS,
    normalizeCustomGoogleModels,
    normalizeHiddenGoogleModels,
    sanitizeCustomGoogleModel,
  } from "~/util/models"

  let {
    customGoogleModels = $bindable(),
    newCustomModel = $bindable(),
    hiddenGoogleModels = $bindable(),
  }: {
    customGoogleModels: string[]
    newCustomModel: string
    hiddenGoogleModels: string[]
  } = $props()

  let customModelError = $state("")

  const hiddenSet = $derived(new Set(hiddenGoogleModels))

  function addCustomModel() {
    const sanitized = sanitizeCustomGoogleModel(newCustomModel)

    if (sanitized === null) {
      customModelError = "Enter a valid Google model id (letters, numbers, ., _, -)."
      return
    }

    if (customGoogleModels.includes(sanitized)) {
      customModelError = "This model is already in the list."
      return
    }

    customGoogleModels = normalizeCustomGoogleModels([...customGoogleModels, sanitized])
    newCustomModel = ""
    customModelError = ""
  }

  function removeCustomModel(model: string) {
    customGoogleModels = customGoogleModels.filter(item => item !== model)
  }

  function hideBuiltinModel(model: string) {
    hiddenGoogleModels = normalizeHiddenGoogleModels([...hiddenGoogleModels, model])
  }

  function unhideBuiltinModel(model: string) {
    hiddenGoogleModels = hiddenGoogleModels.filter(item => item !== model)
  }

  function handleAddKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault()
      addCustomModel()
    }
  }
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
  <h2 class="text-sm font-semibold text-zinc-100">Google Models</h2>
  <p class="mt-1 text-sm text-zinc-400">
    Hide built-in models you never use, or add extra model ids as plain strings (for example: gemini-flash-lite-3.5).
  </p>

  <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Built-in models</h3>
  <ul class="space-y-2">
    {#each GOOGLE_AI_MODELS as model}
      {@const hidden = hiddenSet.has(model)}
      <li
        class="flex items-center justify-between rounded-lg border px-3 py-2 {hidden
          ? 'border-zinc-800 bg-zinc-900 opacity-60'
          : 'border-zinc-700 bg-zinc-900'}"
      >
        <span class="font-mono text-sm {hidden ? 'text-zinc-500 line-through' : 'text-zinc-200'}">{model}</span>
        {#if hidden}
          <button
            type="button"
            onclick={() => unhideBuiltinModel(model)}
            class="rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
          >
            Unhide
          </button>
        {:else}
          <button
            type="button"
            onclick={() => hideBuiltinModel(model)}
            class="rounded bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-600"
          >
            Hide
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <h3 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-zinc-400 uppercase">Custom models</h3>
  <div class="flex gap-2">
    <input
      id="newCustomGoogleModel"
      type="text"
      bind:value={newCustomModel}
      onkeydown={handleAddKeydown}
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

  {#if customModelError}
    <p class="mt-2 text-sm text-red-400">{customModelError}</p>
  {/if}

  {#if customGoogleModels.length > 0}
    <ul class="mt-3 space-y-2">
      {#each customGoogleModels as model}
        <li class="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
          <span class="font-mono text-sm text-zinc-200">{model}</span>
          <button
            type="button"
            onclick={() => removeCustomModel(model)}
            class="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
          >
            Delete
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="mt-3 text-sm text-zinc-500">No custom Google models added yet.</p>
  {/if}
</section>
