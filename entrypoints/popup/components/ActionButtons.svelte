<script lang="ts">
  let {
    buttonText,
    buttonTextWithContext,
    disabled,
    isBusy,
    isCancelling,
    onGenerate,
    onCancel,
    onOpenOptions,
  }: {
    buttonText: string
    buttonTextWithContext: string
    disabled: boolean
    isBusy: boolean
    isCancelling: boolean
    onGenerate: (withContext: boolean) => void
    onCancel: () => void
    onOpenOptions: () => void
  } = $props()
</script>

<div class="space-y-2.5">
  <button
    onclick={() => onGenerate(false)}
    {disabled}
    class="w-full rounded-xl bg-orange-600 py-2.5 font-semibold text-white transition-colors
    hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500"
  >
    {buttonText}
  </button>

  <button
    onclick={() => onGenerate(true)}
    {disabled}
    class="w-full rounded-xl bg-teal-600 py-2.5 font-semibold text-white transition-colors
    hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-500"
  >
    {buttonTextWithContext}
  </button>

  {#if isBusy}
    <button
      onclick={onCancel}
      disabled={isCancelling}
      class="w-full rounded-xl bg-red-600 py-2.5 font-semibold text-white transition-colors
      hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
    >
      {isCancelling ? "Cancelling..." : "Cancel Generation"}
    </button>
  {/if}

  <button
    onclick={onOpenOptions}
    class="w-full rounded-xl bg-zinc-800 py-2 font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
  >
    Options
  </button>
</div>
