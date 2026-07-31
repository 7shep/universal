# Studio

Studio is Universal's Phase 2 design-direction interface. It turns an initial prompt into a
reviewable Design Plan v2 through discovery, explicit approval, and concept selection. It does not
generate React code, start a project runtime, or load Preview.

## Run Studio

Install dependencies from the repository root, then start only Studio:

```bash
pnpm install
pnpm --filter @universal/studio dev
```

Run `pnpm dev` instead to start Studio and Preview together. Preview remains an independent static
application; Studio does not send a generated URL to it.

## Workflow

Studio presents four stages:

1. **Discovery** — capture product strategy, route responsibilities, content, visual material, and
   constraints. Page-map fields define what each route must accomplish before visual treatment.
2. **Brief review** — inspect the creative brief as a provenance ledger. The interface separates
   user decisions, Universal recommendations, delegated decisions, and unresolved choices.
   Approval is an explicit checkbox and action; reaching this screen does not approve the brief.
3. **Direction** — review the recommended concept spine, visual decisions, risks, and viable
   alternatives. Approving the direction authorizes plan compilation; it does not generate code.
4. **Design Plan v2** — inspect the direction, tokens, page specifications, protected constraints,
   and accessibility requirements. The current final action prints the plan.

The progress indicator is a presentation control, not a replacement for server-side phase checks.
An MCP-backed client still has to obey the Art Director session transitions.

## Answer modes and provenance

Each discovery question records how its answer should be treated:

| Studio label | Engine mode    | Meaning                                                                |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| Exact        | `exact`        | Treat the entered value as an explicit user decision.                  |
| Preference   | `preference`   | Preserve the entered direction while allowing implementation judgment. |
| I don't know | `unknown`      | Record the gap; high-impact gaps may block approval.                   |
| Use judgment | `use-judgment` | Delegate the decision to Universal and require an explained result.    |
| Draft for me | `draft`        | Ask Universal to prepare editable material rather than infer approval. |

Studio's `judgment` UI value is translated to the engine's `use-judgment` mode by the MCP client
adapter. The brief ledger then derives its display labels from the authoritative decision
provenance returned by the engine. Provenance is not encoded by color alone.

## Default demo client

`StudioApp` uses `createLocalArtDirectorClient()` when no client prop is supplied. This client:

- starts from the Field Notes Society fixture;
- simulates asynchronous stage transitions in the browser;
- constructs fixture brief, direction, and plan views locally;
- does not call `@universal/design-engine`, an MCP server, a model provider, or a runtime.

This makes `pnpm --filter @universal/studio dev` a deterministic UI demonstration. The visible
result must not be treated as proof that stdio MCP or project generation is connected.

## Inject a client

`StudioApp` accepts any implementation of the four-operation `ArtDirectorClient` boundary:

```tsx
import { StudioApp } from './studio-app';
import type { ArtDirectorClient } from './studio-client';

const client: ArtDirectorClient = {
  startProject: (prompt) => hostApi.startProject(prompt),
  compileBrief: (project) => hostApi.compileBrief(project),
  approveBrief: (project) => hostApi.approveBrief(project),
  approveDirection: (project) => hostApi.approveDirection(project)
};

export function HostedStudio() {
  return <StudioApp client={client} />;
}
```

The host owns persistence, authentication, transport errors, and reconnect behavior. Keep the
returned `StudioProject.session` string current after every operation.

## Adapt an MCP transport

`createMcpArtDirectorClient()` converts an `ArtDirectorMcpTransport` into the smaller client used by
Studio. The transport must implement the eight Phase 2 operations Studio needs; it may call a desktop
host, local HTTP bridge, or another trusted process that owns the MCP connection.

The maintained bridge is `HostArtDirectorTransport` in `apps/studio/src/host-transport.ts`, backed by
the trusted local runtime. Read [the host bridge guide](STUDIO_HOST_BRIDGE.md) for its trust boundary
and exact setup before writing a transport of your own.

```tsx
import { StudioApp } from './studio-app';
import { createMcpArtDirectorClient, type ArtDirectorMcpTransport } from './studio-client';

const transport: ArtDirectorMcpTransport = {
  startArtDirection: (input) => host.invoke('start_art_direction', input),
  getDiscoveryQuestions: (session) => host.invoke('get_discovery_questions', { session }),
  submitDiscoveryAnswers: (session, input) =>
    host.invoke('submit_discovery_answers', { session, ...input }),
  getCreativeBrief: (session, input) => host.invoke('get_creative_brief', { session, ...input }),
  approveCreativeBrief: (session, input) =>
    host.invoke('approve_creative_brief', { session, ...input }),
  developArtDirection: (session, input) =>
    host.invoke('develop_art_direction', { session, ...input }),
  getSelectedDirection: (session, input) =>
    host.invoke('get_selected_direction', { session, ...input }),
  createDesignPlanV2: (session, input) =>
    host.invoke('create_design_plan_v2', { session, ...input })
};

const client = createMcpArtDirectorClient(transport);

export function HostedStudio() {
  return <StudioApp client={client} />;
}
```

The example `host.invoke` is an application-defined trusted bridge, not a Universal browser API.
Browsers cannot connect directly to the server's stdin/stdout transport. A production host should
also expose revision and session-inspection operations if its wider UI needs them, even though the
current four-stage Studio client does not.

For MCP request shapes, session handoff, retries, and phase errors, see
[MCP_REFERENCE.md](MCP_REFERENCE.md). For package ownership and unimplemented runtime boundaries,
see [ARCHITECTURE.md](ARCHITECTURE.md).
