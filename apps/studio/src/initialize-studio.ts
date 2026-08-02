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
  } catch {
    // An unreachable runtime must still render Studio in fixture mode rather than
    // leaving a blank page.
  }
  render();
}
