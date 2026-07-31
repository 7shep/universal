import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { StudioApp } from './studio-app';
import { createRuntimeGenerationLifecycleClient } from './runtime-client';
import { HostArtDirectorTransport, hostBridgeAvailable } from './host-transport';
import { createMcpArtDirectorClient } from './studio-client';
import type { StudioAppProps } from './studio-app';

declare global {
  interface Window {
    __UNIVERSAL_RUNTIME__?: { origin: string; bootstrapToken?: string; previewShellUrl?: string };
  }
}

const runtime = window.__UNIVERSAL_RUNTIME__;
const props: StudioAppProps = runtime
  ? {
      generationClient: createRuntimeGenerationLifecycleClient({
        origin: runtime.origin,
        ...(runtime.bootstrapToken ? { bootstrapToken: runtime.bootstrapToken } : {})
      }),
      ...(runtime.previewShellUrl ? { previewShellUrl: runtime.previewShellUrl } : {})
    }
  : {};

const root = createRoot(document.getElementById('root')!);
const render = () =>
  root.render(
    <StrictMode>
      <StudioApp {...props} />
    </StrictMode>
  );

// The real MCP session is only used when the trusted host advertises a bridge.
// Otherwise Studio keeps the deterministic fixture client, so `pnpm dev` still
// needs no runtime, no stdio session, and no model credentials.
if (runtime) {
  void hostBridgeAvailable(runtime.origin).then((available) => {
    if (available)
      props.client = createMcpArtDirectorClient(
        new HostArtDirectorTransport({ origin: runtime.origin })
      );
    render();
  });
} else {
  render();
}
