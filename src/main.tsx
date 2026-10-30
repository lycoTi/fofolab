import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Fonte pixel empacotada com o app: o relógio da janela do Fofo funciona offline, sem buscar fonte na rede
import '@fontsource/pixelify-sans/700.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
