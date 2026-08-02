import { HostArtDirectorTransport, hostBridgeAvailable } from './host-transport';
import { ensureRuntimeSession } from './runtime-client';
import { createMcpArtDirectorClient } from './studio-client';
import type { StudioAppProps } from './studio-app';

export interface RuntimeGlobal {
  origin: string;
  bootstrapToken?: string;
  previewShellUrl?: string;
}

/**
 * Establishes the runtime session, then probes for the art director bridge, then
 * renders. The order matters: the probe endpoint is authenticated, so probing first
 * returns 401 and latches Studio to the fixture art director for the whole page load.
 */
export async function initializeStudio(
  runtime: RuntimeGlobal,
  props: StudioAppProps,
  render: () => void
): Promise<void> {
  try {
    await ensureRuntimeSession({
      origin: runtime.origin,
      ...(runtime.bootstrapToken ? { bootstrapToken: runtime.bootstrapToken } : {})
    });
    if (await hostBridgeAvailable(runtime.origin))
      props.client = createMcpArtDirectorClient(
        new HostArtDirectorTransport({ origin: runtime.origin })
      );
  } catch (error) {
    // Studio must still render in fixture mode, but a swallowed failure here is
    // invisible in devtools — the exact problem this ordering fix exists to solve.
    console.error('Studio runtime initialization failed; falling back to fixture mode:', error);
  }
  render();
}
