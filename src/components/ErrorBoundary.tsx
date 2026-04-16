import React from 'react';

class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-8 text-center">
          <div className="max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white mb-4">Oops!</h2>
            <p className="text-zinc-400 mb-6">Something went wrong. Please try again later.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#ff4e00] text-white rounded-full font-bold hover:bg-[#ff6a2a] transition-all"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
