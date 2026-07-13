import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { StudioApp } from './studio-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>
);
