import { getHNCommentsForLLM, getHNStoryContext, type CommentStatistics } from "./get-comments"
import { fetchStoryExcerpt } from "./story-excerpt"

export interface CollectedComments {
  comments: string
  statistics: CommentStatistics
  storyTitle: string
  storyUrl: string
  storyExcerpt: string
  storyExcerptSkipped: boolean
}

export interface CollectCommentsOptions {
  withContext?: boolean
  previewOnly?: boolean
}

export async function collectHNComments(options: CollectCommentsOptions = {}): Promise<CollectedComments> {
  const { comments, statistics } = await getHNCommentsForLLM(options.previewOnly === true)
  const story = getHNStoryContext()
  let storyExcerpt = ""
  let storyExcerptSkipped = true

  if (options.withContext === true && story.url !== "") {
    const result = await fetchStoryExcerpt(story.url)
    storyExcerpt = result.excerpt
    storyExcerptSkipped = result.skipped
  }

  return {
    comments,
    statistics,
    storyTitle: story.title,
    storyUrl: story.url,
    storyExcerpt,
    storyExcerptSkipped,
  }
}
