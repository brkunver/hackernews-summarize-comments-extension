import { For, Show } from "solid-js"
import type { CommentStatistics } from "~/util/get-comments"

type SummarizerDetailsProps = {
  showCommentStatistics: boolean
  commentStatistics: CommentStatistics | null
  comments: string
}

export default function SummarizerDetails(props: SummarizerDetailsProps) {
  return (
    <>
      <Show when={props.showCommentStatistics && props.commentStatistics}>
        <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          <h2 class="mb-2 text-sm font-semibold text-zinc-300">Selected comments</h2>
          <p>
            {props.commentStatistics?.total} comments · {props.commentStatistics?.characters.toLocaleString()}{" "}
            characters · {props.commentStatistics?.words.toLocaleString()} words
          </p>
          <For each={props.commentStatistics?.byDepth}>
            {item => (
              <p class="mt-1">
                {item.count} {item.depth === 0 ? "top level comments" : `depth-${item.depth} comments`}
              </p>
            )}
          </For>
        </section>
      </Show>

      <Show when={props.comments}>
        <div>
          <h2 class="mb-2 text-sm font-semibold text-zinc-300">Comments</h2>
          <div class="max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
            {props.comments}
          </div>
        </div>
      </Show>
    </>
  )
}
