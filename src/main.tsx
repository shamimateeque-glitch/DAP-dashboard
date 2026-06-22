import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/nativeInit";

createRoot(document.getElementById("root")!).render(<App />);

// Native-only startup (status bar, splash screen). No-op on web.
void initNative();
