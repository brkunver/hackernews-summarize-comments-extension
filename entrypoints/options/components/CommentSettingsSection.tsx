import {
  DEFAULT_MAX_COMMENTS,
  DEFAULT_MAX_COMMENT_DEPTH,
  DEFAULT_RANDOM_COMMENT_SELECTION,
  DEFAULT_SUMMARY_TIMEOUT_SECONDS,
  MAX_COMMENT_DEPTH_LIMIT,
} from "~/util/storage"

type CommentSettingsSectionProps = {
  maxComments: number
  onMaxCommentsInput: (value: number) => void
  randomSelection: boolean
  onRandomSelectionInput: (value: boolean) => void
  maxDepth: number
  onMaxDepthInput: (value: number) => void
  timeout: number
  onTimeoutInput: (value: number) => void
}

export default function CommentSettingsSection(props: CommentSettingsSectionProps) {
  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 class="text-sm font-semibold text-zinc-100">Comment Selection</h2>
      <p class="mt-1 text-sm text-zinc-400">Control which comments are sent to the AI.</p>

      <div class="mt-4 space-y-5">
        <div>
          <label for="maxComments" class="mb-1.5 block text-sm font-medium text-zinc-200">
            Max Comments
          </label>
          <input
            id="maxComments"
            type="number"
            value={props.maxComments}
            onInput={event => props.onMaxCommentsInput(event.currentTarget.valueAsNumber)}
            min="-1"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100
            focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <p class="mt-1.5 text-xs text-zinc-500">
            Maximum number of comments to process. Enter 0 or -1 for no limit. Default: {DEFAULT_MAX_COMMENTS}
          </p>

          <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={props.randomSelection}
              onInput={event => props.onRandomSelectionInput(event.currentTarget.checked)}
              class="h-4 w-4 accent-orange-500"
            />
            Select comments randomly when the total exceeds the maximum
          </label>
          <p class="mt-1.5 text-xs text-zinc-500">
            When enabled (default: {DEFAULT_RANDOM_COMMENT_SELECTION ? "on" : "off"}), exceeding comments are randomly
            sampled. When disabled, the first comments in page order are used.
          </p>
        </div>

        <div>
          <label for="maxDepth" class="mb-1.5 block text-sm font-medium text-zinc-200">
            Max Comment Depth
          </label>
          <input
            id="maxDepth"
            type="number"
            value={props.maxDepth}
            onInput={event => props.onMaxDepthInput(event.currentTarget.valueAsNumber)}
            min="-1"
            max={MAX_COMMENT_DEPTH_LIMIT}
            class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100
            focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <p class="mt-1.5 text-xs text-zinc-500">
            Depth 1 means top-level comments only, depth 2 includes direct replies. Enter 0 or -1 for no depth limit
            (max {MAX_COMMENT_DEPTH_LIMIT}). Default: {DEFAULT_MAX_COMMENT_DEPTH}
          </p>
        </div>

        <div>
          <label for="timeout" class="mb-1.5 block text-sm font-medium text-zinc-200">
            Model Timeout
          </label>
          <input
            id="timeout"
            type="number"
            value={props.timeout}
            onInput={event => props.onTimeoutInput(event.currentTarget.valueAsNumber)}
            min="1"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100
            focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          />
          <p class="mt-1.5 text-xs text-zinc-500">
            Seconds to wait for each model before trying the next configured model. Default:
            {DEFAULT_SUMMARY_TIMEOUT_SECONDS}
          </p>
        </div>
      </div>
    </section>
  )
}
