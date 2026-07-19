import { Maximize2, Minus, X } from "lucide-react";
import { BrandMark } from "./BrandMark";

export function WindowChrome({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <header className="window-chrome">
      <div className="window-title">
        <span className="mini-mark">
          <BrandMark size={17} />
        </span>
        <span>{title}</span>
        {eyebrow ? <span className="chrome-eyebrow">{eyebrow}</span> : null}
      </div>
      <div className="window-actions">
        <button
          aria-label="Minimize"
          onClick={() => window.showme.app.windowAction("minimize")}
          type="button"
        >
          <Minus size={15} />
        </button>
        <button
          aria-label="Maximize"
          onClick={() => window.showme.app.windowAction("maximize")}
          type="button"
        >
          <Maximize2 size={13} />
        </button>
        <button
          className="window-close"
          aria-label="Close"
          onClick={() => window.showme.app.windowAction("close")}
          type="button"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
