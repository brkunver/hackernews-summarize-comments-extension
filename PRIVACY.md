# Privacy Policy for Hackernews Summarize Comments

Last updated: September 30, 2026

## 1. What this extension does

Hackernews Summarize Comments summarizes public Hacker News comment threads on `news.ycombinator.com` using an AI provider you choose (Google Gemini, Groq, or Cerebras) with your own API key.

## 2. Data we process

- **Website content:** Hacker News story title and URL, comments including public usernames and comment text, and, only if you select "Generate Summary with Context", an excerpt (up to ~6,000 characters) fetched from the linked story article.
- **Authentication information:** the Google AI / Groq / Cerebras API key(s) you enter in Options, stored in browser storage (`chrome.storage` sync/local).

We do not collect personally identifiable information, health, financial, location, web history, or user activity data separately from the above.

## 3. How data is used and shared

When you click summarize, the extension sends the page content described above directly from your browser to the AI provider you selected, to generate the summary:

- Google: `generativelanguage.googleapis.com`
- Groq: `api.groq.com`
- Cerebras: `api.cerebras.ai`

Your API key is sent only to that provider for authentication.

We operate no servers, store no page content ourselves, do not sell data, do not use data for advertising, credit, or unrelated purposes. Each provider's handling of API data is governed by that provider's own privacy policy and terms.

## 4. Storage and control

API keys and settings stay in your browser storage. Page content is transmitted only on your explicit action and is not retained by us. Remove keys in Options or uninstall the extension to delete local data.

## 5. Contact

Publisher: Burak Unver

Contact via the Chrome Web Store support link.
