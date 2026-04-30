import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Simple error fallback
const ErrorFallback = () => (
  <div style={{ 
    minHeight: '100vh', display: 'flex', flexDirection: 'column', 
    alignItems: 'center', justifyContent: 'center', background: '#1e2e1e', color: '#e8f5e8',
    padding: '2rem', textAlign: 'center'
  }}>
    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
    <p style={{ color: '#9ab39a', marginBottom: '2rem' }}>The classroom encountered an unexpected error.</p>
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
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('App Crash:', error, info); }
  render() {
    if (this.state.hasError) return <ErrorFallback />;
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
