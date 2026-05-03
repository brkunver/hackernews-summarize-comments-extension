import { mount } from "svelte"
import Popup from "./Popup.svelte"
import "~/assets/tailwind.css"

document.title = browser.runtime.getManifest().name

const app = mount(Popup, {
  target: document.getElementById("app")!,
})

export default app
