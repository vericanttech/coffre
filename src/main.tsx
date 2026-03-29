import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(registration);
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }).catch(() => {});
  });
}

function showUpdateToast(registration: ServiceWorkerRegistration) {
  const root = document.getElementById('root');
  if (!root) return;
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = [
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
    'z-index:9999;padding:12px 20px;border-radius:12px;',
    'background:#1a1d28;color:#e8e6e3;font-size:14px;font-weight:500;',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;',
  ].join('');
  toast.innerHTML = '<span>Update available</span><button type="button" style="padding:6px 14px;border-radius:8px;background:#4a7c59;color:#fff;border:none;font-weight:600;cursor:pointer;font-size:13px;">Refresh</button>';
  const btn = toast.querySelector('button');
  btn?.addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    toast.remove();
  });
  root.appendChild(toast);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
