import { Component, type ErrorInfo, type ReactNode } from "react";
import type { PageId } from "@/lib/widgets/types";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Page id (e.g. "analytics") - if provided, shows a button to clear saved layout/controls and reload */
  clearPageId?: PageId;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleClearAndReload = () => {
    const { clearPageId } = this.props;
    if (clearPageId) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("widget-layout-") && k.endsWith(`-${clearPageId}`))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(`widget-global-controls-${clearPageId}`);
      Object.keys(localStorage)
        .filter((k) => k.startsWith(`widget-controls-${clearPageId}-`))
        .forEach((k) => localStorage.removeItem(k));
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <div className="font-semibold text-destructive">Something went wrong</div>
          <pre className="mt-2 overflow-auto text-xs">{this.state.error.message}</pre>
          {this.props.clearPageId && (
            <button
              type="button"
              className="mt-3 rounded border border-border px-2 py-1 text-xs hover:bg-muted"
              onClick={this.handleClearAndReload}
            >
              Clear saved layout and reload
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
