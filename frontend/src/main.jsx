import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Override global fetch to automatically prepend backend host URL in production
const originalFetch = window.fetch;
window.fetch = (url, options) => {
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  if (typeof url === 'string' && url.startsWith('/api')) {
    // Only prepend if url starts with /api and doesn't contain a protocol
    url = `${backendUrl}${url}`;
  }
  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
