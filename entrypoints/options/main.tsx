import { render } from "solid-js/web"
import Options from "./Options"
import "~/assets/tailwind.css"

const root = document.getElementById("app")

if (root) {
  render(() => <Options />, root)
}

export default root
