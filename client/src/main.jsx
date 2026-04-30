import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Simple error fallback
// Enhanced error fallback to help debug
const ErrorFallback = ({ error }) => (
  <div style={{ 
    minHeight: '100vh', display: 'flex', flexDirection: 'column', 
    alignItems: 'center', justifyContent: 'center', background: '#1e2e1e', color: '#e8f5e8',
    padding: '2rem', textAlign: 'center'
  }}>
    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
    <p style={{ color: '#e05555', marginBottom: '1rem', fontWeight: 'bold' }}>{error?.message || 'Unknown Error'}</p>
    <pre style={{ 
      background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', 
      fontSize: '0.8rem', textAlign: 'left', maxWidth: '80%', overflow: 'auto',
      marginBottom: '2rem', color: '#9ab39a'
    }}>
      {error?.stack}
    </pre>
    <button 
      onClick={() => window.location.reload()}
      style={{ padding: '0.8rem 1.5rem', background: '#e8f5e8', color: '#1e2e1e', borderRadius: '8px', fontWeight: 'bold' }}
    >
      Reload Application
    </button>
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('App Crash:', error, info); }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
