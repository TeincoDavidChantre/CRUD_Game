import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '3rem auto',
          background: '#1a1f2c',
          border: '1px solid #ef4444',
          borderRadius: '12px',
          color: '#f8fafc',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h2 style={{ color: '#f87171', marginBottom: '0.75rem' }}>Ups, algo no salió bien</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
            Hubo un detalle al procesar esta vista o ficha. No te preocupes, tus datos están a salvo.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
              else window.location.reload();
            }}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
