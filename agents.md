- This is a Web Extension Project
- Goal : Summarize comments on a hackernews submission page

- This project uses wxt framework for development. wxt is a extension development framework.
- website to framework is : https://wxt.dev/
- you can find docs on these websites :

1. https://wxt.dev//knowledge/docs.txt
2. https://wxt.dev//knowledge/api-reference.txt

- use browser super global whenever you want to use chrome global. wxt uses browser global for development
  for example:
  browser.runtime.getURL() instead of chrome.runtime.getURL()

## Manifest :

In WXT, there is no manifest.json file in your source code. Instead, WXT generates the manifest from multiple sources:

Global options defined in wxt.config.ts file
Entrypoint-specific options defined in your entrypoints
Your extension's manifest.json will be output to .output/{target}/manifest.json when running wxt build.

- this extension should work on hackernews submission page
- this project uses solid-js for frontend
- this extension aims manifest v3
- this project uses tailwindcss v4 for styling.
- this project uses typescript for development.
- this project uses prettier for code formatting.
- this project uses vite.
- this project uses BUN package manager,
- when using solid, use solid signals: createSignal/createStore for state, createMemo for derived values, and <For>/<Show> instead of .map/ternaries in JSX.
- I should have a .prettierrc.json file in the root directory. please also follow rules on that.
