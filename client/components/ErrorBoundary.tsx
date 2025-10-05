import React from 'react';

export default class ErrorBoundary extends React.Component<any, {error: Error | null, errorInfo: any | null}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Catch errors in any components below and re-render with error message
    console.error('ErrorBoundary caught', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <h2 className="text-xl font-bold text-red-600">An error occurred</h2>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap">{this.state.error && this.state.error.toString()}</pre>
            <pre className="whitespace-pre-wrap text-sm mt-2">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
