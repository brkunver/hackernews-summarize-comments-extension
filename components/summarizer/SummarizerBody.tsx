import { Show } from "solid-js"
import ActionButtons from "~/entrypoints/popup/components/ActionButtons"
import ErrorPanel from "~/entrypoints/popup/components/ErrorPanel"
import StatusPanels from "~/entrypoints/popup/components/StatusPanels"
import SummaryCard from "~/entrypoints/popup/components/SummaryCard"
import type { SummarizerController } from "./create-summarizer"
import SummarizerDetails from "./SummarizerDetails"

type SummarizerBodyProps = {
  state: SummarizerController
  showOptions: boolean
  scrollable: boolean
}

export default function SummarizerBody(props: SummarizerBodyProps) {
  return (
    <div class={props.scrollable ? "min-h-0 flex-1 overflow-y-auto p-3" : undefined}>
      <div class="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <p class="text-xs text-zinc-400">
          Current model: <span class="font-medium text-zinc-100">{props.state.currentModelLabel()}</span>
        </p>
      </div>

      <Show when={!props.state.isValidHackerNewsUrl() && props.state.currentUrl()}>
        <div class="mb-3 rounded-xl border border-amber-800 bg-amber-950/60 p-3 text-amber-200">
          <p class="text-sm font-semibold">⚠️ Not a Hacker News Submission</p>
          <p class="mt-1 text-xs">
            This extension only works on Hacker News submission pages (news.ycombinator.com/item?id=)
          </p>
        </div>
      </Show>

      <div class="mb-3">
        <ActionButtons
          buttonText={props.state.buttonText()}
          buttonTextWithContext={props.state.buttonTextWithContext()}
          disabled={props.state.isBusy() || !props.state.isValidHackerNewsUrl()}
          isBusy={props.state.isGeneratingSummary() || props.state.isProcessingInBackground()}
          isCancelling={props.state.isCancellingSummary()}
          showOptions={props.showOptions}
          onGenerate={props.state.getComments}
          onGetComments={() => void props.state.getComments(false, true)}
          onCancel={props.state.cancelSummaryGeneration}
          onOpenOptions={props.state.openOptions}
        />
      </div>

      <div class="space-y-3">
        <Show when={props.state.error()}>
          <ErrorPanel error={props.state.error()} errorDetails={props.state.errorDetails()} />
        </Show>

        <StatusPanels
          warning={props.state.warning()}
          isProcessingInBackground={props.state.isProcessingInBackground()}
          isGeneratingSummary={props.state.isGeneratingSummary()}
          currentModelName={props.state.currentModelName()}
          currentModelLabel={props.state.currentModelLabel()}
          generationErrorHistory={props.state.generationErrorHistory()}
        />

        <Show when={props.state.summary()}>
          <SummaryCard
            summary={props.state.summary()}
            streaming={props.state.isStreaming()}
            withContext={props.state.summaryWithContext()}
            createdByLabel={props.state.summaryCreatedByLabel()}
          />
        </Show>

        <SummarizerDetails
          showCommentStatistics={props.state.showCommentStatistics()}
          commentStatistics={props.state.commentStatistics()}
          comments={props.state.comments()}
        />
      </div>
    </div>
  )
}
