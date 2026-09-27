# HackerNews Comment Summarizer

This extension helps you efficiently navigate HackerNews submission pages by summarizing comment threads. It uses AI to condense lengthy discussions into key insights.

Key features:

- Summarize comments on any HackerNews submission page
- Works directly on submission pages
- Requires your own Google API key for AI processing (no external services or data collection)
- Free to use. No user data is collected or stored. Ensure you have a valid Google API key configured.
- No server required. All processing happens locally in your browser.

## Tech Stack

- Built with [WXT](https://wxt.dev/) (Manifest V3)
- UI in [SolidJS](https://www.solidjs.com/) + TypeScript
- Styled with Tailwind CSS v4
- AI via the Vercel AI SDK (Google, Groq, Cerebras)
- Package manager: Bun
