import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/roboto/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import './styles/app.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// versão web (iPhone/iPad "Adicionar à Tela de Início" e navegadores): funciona offline
if (import.meta.env.PROD && !('__TAURI_INTERNALS__' in window) && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => void navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => undefined));
  // pede ao navegador para não apagar as notas nem os modelos baixados quando faltar espaço
  void navigator.storage?.persist?.().catch(() => undefined);
}
