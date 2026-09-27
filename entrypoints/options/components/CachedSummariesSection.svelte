<script lang="ts">
  import { getErrorMessage } from "~/util/errors"
  import { savedSummariesStore, type SavedSummaryV2 } from "~/util/storage"
  import { truncateSummary, truncateUrl } from "~/util/format"

  let { summaries = $bindable() }: { summaries: SavedSummaryV2[] } = $props()

  let error = $state("")

  async function deleteCachedSummary(id: string) {
    try {
      const updatedSummaries = summaries.filter(summary => summary.id !== id)
      summaries = updatedSummaries
      await savedSummariesStore.setValue(updatedSummaries)
    } catch (err) {
      error = `Error deleting cached summary: ${getErrorMessage(err)}`
      console.error("Error deleting cached summary:", err)
    }
  }

  async function deleteAllCachedSummaries() {
    if (!confirm("Are you sure you want to delete all cached summaries? This action cannot be undone.")) {
      return
    }

    try {
      summaries = []
      await savedSummariesStore.setValue([])
    } catch (err) {
      error = `Error deleting cached summaries: ${getErrorMessage(err)}`
      console.error("Error deleting all cached summaries:", err)
    }
  }
</script>

<section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-sm font-semibold text-zinc-100">
      Cached Summaries{#if summaries.length > 0}
        ({summaries.length}){/if}
    </h2>
    {#if summaries.length > 0}
      <button
        onclick={deleteAllCachedSummaries}
        class="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
      >
        Delete All
      </button>
    {/if}
  </div>

  {#if error}
    <p class="mb-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>
  {/if}

  {#if summaries.length > 0}
    <div class="max-h-64 space-y-2 overflow-y-auto">
      {#each summaries as summary (summary.id)}
        <div
          class="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 p-2.5 transition-colors hover:bg-zinc-700/60"
        >
          <div class="min-w-0 flex-1">
            <a
              href={summary.id}
              target="_blank"
              rel="noopener noreferrer"
              class="block truncate text-sm text-orange-300 underline hover:text-orange-200"
            >
              {truncateUrl(summary.id)}
            </a>
            <div class="truncate text-xs text-zinc-400">{truncateSummary(summary.summary)}</div>
            <div class="text-xs text-zinc-500">
              Created by: {summary.createdBy}{#if summary.withContext}
                · with context{/if}
            </div>
          </div>
          <button
            onclick={() => deleteCachedSummary(summary.id)}
            class="ml-2 shrink-0 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
          >
            Delete
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-sm text-zinc-500">No cached summaries found</p>
  {/if}
</section>
