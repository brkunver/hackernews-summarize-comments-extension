<script lang="ts">
  let {
    title,
    description,
    inputId,
    value = $bindable(),
  }: {
    title: string
    description: string
    inputId: string
    value: string
  } = $props()

  let isEditing = $state(false)

  function toggleEdit() {
    isEditing = !isEditing
  }
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
  <div class="mb-3 flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold text-zinc-100">{title}</h2>
      <p class="mt-1 text-sm text-zinc-400">{description}</p>
    </div>
    <button
      type="button"
      onclick={toggleEdit}
      class="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
    >
      {isEditing ? "Cancel" : "Edit"}
    </button>
  </div>

  {#if !isEditing}
    <div class="relative">
      <textarea
        id={inputId}
        bind:value
        readonly
        rows={10}
        class="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm
        text-zinc-400 focus:outline-none"
        placeholder="Prompt will appear here..."
      ></textarea>
      <div class="absolute top-2 right-2 rounded bg-amber-950 px-2 py-1 text-xs text-amber-200">
        ⚠️ Be careful editing prompt
      </div>
    </div>
  {:else}
    <textarea
      id={inputId}
      bind:value
      rows={10}
      class="w-full resize-none rounded-lg border border-orange-500 bg-zinc-900 px-4 py-2 text-sm text-zinc-100
      focus:outline-none focus:ring-2 focus:ring-orange-500/40"
      placeholder="Enter your custom prompt..."
    ></textarea>
    <p class="mt-2 text-sm text-amber-400">
      ⚠️ Editing mode active. Changes will be saved when you click "Save Settings".
    </p>
  {/if}
</section>
