import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suprimir erro do MetaMask (comum em extensões de navegador)
const handleError = (event: ErrorEvent) => {
  if (event.message?.includes('MetaMask') || event.message?.includes('ethereum')) {
    event.preventDefault();
    console.warn('🛡️ Suprimido erro externo de MetaMask:', event.message);
  }
};

const handleRejection = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const message = typeof reason === 'string' ? reason : (reason?.message || '');
  if (message.includes('MetaMask') || message.includes('ethereum') || message.includes('provider')) {
    event.preventDefault();
    console.warn('🛡️ Suprimido erro de promessa externa (MetaMask/Web3):', message);
  }
};

window.addEventListener('error', handleError);
window.addEventListener('unhandledrejection', handleRejection);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
