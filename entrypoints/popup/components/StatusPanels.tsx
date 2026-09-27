import { createMemo, For, Show } from "solid-js"
import { formatModelWithProvider, getModelProvider } from "~/util/models"
import type { GenerationErrorHistoryItem } from "~/util/storage"

type StatusPanelsProps = {
  warning: string
  isProcessingInBackground: boolean
  isGeneratingSummary: boolean
  currentModelName: string
  currentModelLabel: string
  generationErrorHistory: GenerationErrorHistoryItem[]
}

export default function StatusPanels(props: StatusPanelsProps) {
  const hasGenerationErrorHistory = createMemo(
    () => (props.isGeneratingSummary || props.isProcessingInBackground) && props.generationErrorHistory.length > 0,
  )

  return (
    <>
      <Show when={props.warning}>
        <div class="rounded-xl border border-amber-800 bg-amber-950/60 p-3 text-amber-200">
          <p class="font-semibold">Notice:</p>
          <p class="text-sm">{props.warning}</p>
        </div>
      </Show>

      <Show when={props.isProcessingInBackground}>
        <div class="rounded-xl border border-emerald-800 bg-emerald-950/60 p-3 text-emerald-200">
          <p class="text-sm font-medium">
            Generating using {props.currentModelName ? props.currentModelLabel : "AI"}...
          </p>
          <p class="mt-1 text-xs opacity-80">Processing in background. You can close this window.</p>
        </div>
      </Show>

      <Show when={props.isGeneratingSummary && !props.isProcessingInBackground}>
        <div class="rounded-xl border border-orange-800 bg-orange-950/60 p-3 text-orange-200">
          <p class="text-sm font-medium">
            Generating summary using {props.currentModelName ? props.currentModelLabel : "AI"}...
          </p>
        </div>
      </Show>

      <Show when={hasGenerationErrorHistory()}>
        <div class="rounded-xl border border-red-800 bg-red-950/60 p-3 text-red-200">
          <p class="text-sm font-semibold">Recent model errors</p>
          <div class="mt-2 space-y-2">
            <For each={props.generationErrorHistory}>
              {item => (
                <div class="rounded-lg border border-red-800 bg-zinc-900 p-2 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium text-red-100">
                      {formatModelWithProvider(item.model, getModelProvider(item.model))}
                    </span>
                    <span class="shrink-0 rounded bg-red-900 px-2 py-1 text-[11px] font-medium text-red-200">
                      {item.reason}
                    </span>
                  </div>
                  <p class="mt-1 wrap-break-word">{item.message}</p>
                  <Show when={item.details}>
                    <details class="mt-1">
                      <summary class="cursor-pointer font-medium">Details</summary>
                      <pre class="mt-1 max-h-24 overflow-auto rounded bg-red-950 p-2 text-[11px] whitespace-pre-wrap wrap-break-word">
                        {item.details}
                      </pre>
                    </details>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </>
  )
}
