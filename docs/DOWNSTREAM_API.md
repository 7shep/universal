# Downstream orchestration API

`@universal/design-engine` is the single domain boundary for plan development and validation. The
generator, local runtime, Studio, and Preview should import contracts from this package and must not
import `@universal/design-mcp` internals.

## Develop a plan

Plan history is caller-owned and JSON-safe. Pass the latest returned session into the next request;
persist it with the runtime session when continuity across process restarts is required.

```ts
import { createDesignOrchestrator, emptyDesignPlanSession } from '@universal/design-engine';

const design = createDesignOrchestrator();
const first = await design.developPlan({
  brief: { prompt: 'An editorial archive', compositionSeed: 17 },
  session: emptyDesignPlanSession()
});

const second = await design.developPlan({
  brief: { prompt: 'A second editorial direction', compositionSeed: 18 },
  session: first.session
});
```

No process-global history is consulted. Reusing the same input session produces the same
deterministic result. A model-backed provider can be injected through `createDesignOrchestrator`
without changing callers.

Phase 1A callers should migrate from `createDesignEngine().develop(brief)` to the request/result
shape above. `createDesignEngine` remains an alias for the canonical orchestrator factory, but plan
development now uses `developPlan` so session history cannot be implicit.

## Validate untrusted data

Use `design.validatePlan(value)` or `validateDesignPlan(value)` before accepting provider, disk, or
transport data. Additional validators cover the stable downstream DTOs:

- `validateDesignPlanBrief`
- `validateDesignDirection`
- `validateProjectGenerationRequest`
- `validateDesignReviewContext`

Each validator returns a discriminated `Result` with an actionable `path` on failure.

## Serialized fixtures

Import stable JSON strings from `@universal/design-engine/fixtures`:

```ts
import { parseContract } from '@universal/design-engine';
import { serializedContractFixtures } from '@universal/design-engine/fixtures';

const parsed = parseContract('project-request', serializedContractFixtures['project-request']);
if (!parsed.ok) throw new Error(`${parsed.error.path}: ${parsed.error.message}`);
```

Fixtures are provided for `brief`, `plan`, `direction`, `project-request`, and `review-context`.
Contract tests validate every fixture and require byte-for-byte serialization round trips.

## Consumer map

| Consumer       | Public contracts and functions                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Generator      | `ProjectGenerationRequest`, `DesignPlan`, prompt builders, `GeneratedProject`                    |
| Local runtime  | `DesignOrchestrator`, `DevelopDesignPlanRequest`, `DevelopDesignPlanResult`, `DesignPlanSession` |
| Studio         | `DesignPlanBrief`, `DesignDirection`, `DesignPlan`, validation functions                         |
| Preview/review | `DesignReviewContext`, `ProjectFile`, `VisualEvidence`, review result types                      |

MCP preserves its existing tool names, schemas, and plan response shape. Its handlers translate the
legacy flat `recentSignatures` field into the explicit orchestration session and return the plan.
