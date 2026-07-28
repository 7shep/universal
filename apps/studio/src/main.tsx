import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { StudioApp } from './studio-app';
import { createRuntimeGenerationLifecycleClient } from './runtime-client';

declare global {
  interface Window {
    __UNIVERSAL_RUNTIME__?: { origin: string; bootstrapToken?: string; previewShellUrl?: string };
  }
}
const runtime = window.__UNIVERSAL_RUNTIME__;
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudioApp
      {...(runtime
        ? {
            generationClient: createRuntimeGenerationLifecycleClient({
              origin: runtime.origin,
              ...(runtime.bootstrapToken ? { bootstrapToken: runtime.bootstrapToken } : {})
            }),
            ...(runtime.previewShellUrl ? { previewShellUrl: runtime.previewShellUrl } : {})
          }
        : {})}
    />
  </StrictMode>
);
