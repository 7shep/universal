import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { PreviewApp } from './preview-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>
);
