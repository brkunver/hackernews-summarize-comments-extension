import { createMemo, Show } from "solid-js"
import snarkdown from "snarkdown"

type SummaryCardProps = {
  streaming?: boolean
  summary: string
  withContext: boolean
  createdByLabel: string
}

export default function SummaryCard(props: SummaryCardProps) {
  const renderedSummary = createMemo(() => snarkdown(props.summary))

  return (
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 text-base font-semibold text-zinc-100">
          Summary
          <Show when={props.withContext}>
            <span class="rounded bg-teal-900 px-2 py-0.5 text-[11px] font-medium text-teal-200">with context</span>
          </Show>
        </h2>
        <Show when={props.createdByLabel}>
          <span class="shrink-0 text-[11px] text-zinc-500">Created by {props.createdByLabel}</span>
        </Show>
      </div>
      <Show
        when={props.streaming}
        fallback={
          <div
            class="hn-markdown rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200"
            innerHTML={renderedSummary()}
          />
        }
      >
        <div
          class="whitespace-pre-wrap break-words rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-200"
          aria-busy="true"
        >
          {props.summary}
        </div>
      </Show>
    </div>
  )
}
