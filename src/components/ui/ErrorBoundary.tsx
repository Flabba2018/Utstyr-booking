import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100dvh', padding: '24px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Noe gikk galt</h1>
          <p style={{ color: '#64748b', marginBottom: '16px' }}>
            {this.state.error?.message || 'En uventet feil oppstod'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px', background: '#2563eb', color: 'white',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 500,
            }}
          >
            Last inn på nytt
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
