import { Show } from "solid-js"

type ActionButtonsProps = {
  buttonText: string
  buttonTextWithContext: string
  disabled: boolean
  isBusy: boolean
  isCancelling: boolean
  onGetComments: () => void
  onGenerate: (withContext: boolean) => void
  onCancel: () => void
  onOpenOptions: () => void
}

export default function ActionButtons(props: ActionButtonsProps) {
  return (
    <div class="space-y-2.5">
      <button
        onclick={props.onGetComments}
        disabled={props.disabled}
        class="w-full rounded-xl bg-zinc-800 py-2 font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:text-zinc-500"
      >
        Get comments
      </button>
      <button
        onclick={() => props.onGenerate(false)}
        disabled={props.disabled}
        class="w-full rounded-xl bg-orange-600 py-2.5 font-semibold text-white transition-colors
        hover:bg-orange-500 disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {props.buttonText}
      </button>

      <button
        onclick={() => props.onGenerate(true)}
        disabled={props.disabled}
        class="w-full rounded-xl bg-teal-600 py-2.5 font-semibold text-white transition-colors
        hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {props.buttonTextWithContext}
      </button>

      <Show when={props.isBusy}>
        <button
          onclick={props.onCancel}
          disabled={props.isCancelling}
          class="w-full rounded-xl bg-red-600 py-2.5 font-semibold text-white transition-colors
          hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {props.isCancelling ? "Cancelling..." : "Cancel Generation"}
        </button>
      </Show>

      <button
        onclick={props.onOpenOptions}
        class="w-full rounded-xl bg-zinc-800 py-2 font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        Options
      </button>
    </div>
  )
}
