import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept all fetch requests globally to inject x-user-id header if it exists in localStorage.
// This provides a robust fallback for iframe environments where third-party session cookies are blocked.
const originalFetch = window.fetch;
try {
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: async (input: RequestInfo | URL, init?: RequestInit) => {
      const storedUserId = localStorage.getItem('userId');
      
      // Initialize init options if undefined
      const options = init || {};
      const headers = {
        ...(options.headers || {}),
      } as Record<string, string>;
      
      if (storedUserId && !headers['x-user-id']) {
        headers['x-user-id'] = storedUserId;
      }
      options.headers = headers;
      
      const response = await originalFetch(input, options);
      
      // Parse response to capture newly generated or validated userId during login or registration
      try {
        const urlString = typeof input === 'string' ? input : (input as Request).url || '';
        if (urlString.includes('/api/auth/register') || 
            urlString.includes('/api/auth/login') || 
            urlString.includes('/api/auth/login-otp-verify') || 
            urlString.includes('/api/auth/login-biometric')) {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          if (data && data.success && data.userId) {
            localStorage.setItem('userId', String(data.userId));
          }
        }
      } catch (err) {
        // Fail silently, response was not JSON or failed to read
      }
      
      return response;
    }
  });
} catch (e) {
  console.error('Failed to redefine window.fetch, falling back:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
