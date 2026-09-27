import { render } from "solid-js/web"
import Popup from "./Popup"
import "~/assets/tailwind.css"

document.title = browser.runtime.getManifest().name

const root = document.getElementById("app")

if (root) {
  render(() => <Popup />, root)
}

export default root
