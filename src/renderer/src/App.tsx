import { Component, type ErrorInfo, type ReactNode } from "react";
import type { WindowRole } from "../../shared/types";
import { BrandMark } from "./components/BrandMark";
import { Launcher } from "./views/Launcher";
import { LessonWindow } from "./views/LessonWindow";
import { MainWindow } from "./views/MainWindow";
import { SelectionOverlay } from "./views/SelectionOverlay";

export function App(): ReactNode {
  const role = new URLSearchParams(window.location.search).get("role") as WindowRole | null;
  return (
    <ErrorBoundary>
      {role === "launcher" ? (
        <Launcher />
      ) : role === "selection" ? (
        <SelectionOverlay />
      ) : role === "lesson" ? (
        <LessonWindow />
      ) : (
        <MainWindow />
      )}
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-shell">
        <div className="fatal-card">
          <div className="brand-orb small">
            <BrandMark size={22} />
          </div>
          <h1>ShowME hit an unexpected edge.</h1>
          <p>{this.state.error.message}</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            Reload this window
          </button>
        </div>
      </main>
    );
  }
}
