import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { PreviewApp } from './preview-app';
import { LocalPreviewClient, RuntimePreviewClient } from './preview-client';
declare global {
  interface Window {
    __UNIVERSAL_RUNTIME__?: { origin: string };
  }
}
const projectId = new URLSearchParams(window.location.search).get('projectId') ?? undefined,
  runtime = window.__UNIVERSAL_RUNTIME__,
  client = runtime ? new RuntimePreviewClient(runtime.origin) : new LocalPreviewClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp client={client} {...(projectId ? { projectId } : {})} />
  </StrictMode>
);
