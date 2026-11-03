import "@fontsource/rye";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/buttons.css";
import "./styles/table.css";
import "./styles/cards.css";
import "./styles/sprites.css";
import "./styles/overlays.css";
import "./styles/motion.css";
import "./styles/shell.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AssetsPage } from "./ui/screens/AssetsPage";

// The one non-game path: /assets lists every asset (ui/screens/AssetsPage.tsx).
const isAssetsPage = location.pathname.replace(/\/+$/, "") === "/assets";

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isAssetsPage ? <AssetsPage /> : <App />}</StrictMode>,
);
