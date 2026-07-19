import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { BrandMark } from "./components/BrandMark";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("ShowME renderer root is missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {typeof window.showme === "undefined" ? <ElectronRequired /> : <App />}
  </React.StrictMode>,
);

function ElectronRequired() {
  return (
    <main className="electron-required">
      <span className="brand-orb">
        <BrandMark size={28} />
      </span>
      <h1>Open ShowME as a desktop app</h1>
      <p>
        The browser preview does not fabricate captures, providers, permissions, or lessons. Run
        <code>npm run dev</code> to use the secure Electron runtime.
      </p>
    </main>
  );
}
