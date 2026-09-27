<script lang="ts">
  import snarkdown from "snarkdown"

  let {
    summary,
    withContext,
    createdByLabel,
  }: {
    summary: string
    withContext: boolean
    createdByLabel: string
  } = $props()
</script>

<div>
  <div class="mb-2 flex items-center justify-between gap-2">
    <h2 class="flex items-center gap-2 text-base font-semibold text-zinc-100">
      Summary
      {#if withContext}
        <span class="rounded bg-teal-900 px-2 py-0.5 text-[11px] font-medium text-teal-200">with context</span>
      {/if}
    </h2>
    {#if createdByLabel}
      <span class="shrink-0 text-[11px] text-zinc-500">Created by {createdByLabel}</span>
    {/if}
  </div>
  <div class="hn-markdown rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200">
    {@html snarkdown(summary)}
  </div>
</div>
