import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (root) {
  import("react-dom/client").then(({ createRoot }) => {
    createRoot(root).render(<App />);
  });
}
