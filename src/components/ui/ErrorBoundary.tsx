import { Component, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  hasError: boolean;
  error: Error | null;
  isChunkLoadError: boolean;
}

function isChunkLoadError(error: Error): boolean {
  return error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('Loading chunk');
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, isChunkLoadError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isChunkLoadError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error)) {
      const retryKey = 'editok-chunk-retry';
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, '1');
        window.location.reload();
        return;
      }
      console.warn('Chunk load failed after one automatic refresh:', error.message);
    } else {
      console.error('Page render error:', error);
    }
  }

  handleRetry = () => {
    if (this.state.isChunkLoadError) {
      sessionStorage.removeItem('editok-chunk-retry');
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, isChunkLoadError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 px-4">
          <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-primary-500" />
          </div>
          <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 text-center">
            This section couldn't load
          </p>
          <p className="text-xs text-ink-400 dark:text-ink-500 text-center max-w-xs">
            A slow or interrupted connection prevented the page from loading. Tap below to try again.
          </p>
          {this.state.error && !this.state.isChunkLoadError && (
            <p className="max-w-md rounded-lg bg-error-50 px-3 py-2 text-center text-[11px] text-error-700 dark:bg-error-500/10 dark:text-error-300">
              {this.state.error.message || 'Unexpected page error'}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 active:scale-95 transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
