# Universal MCP Tool Reference

Universal exposes four tools over the local stdio MCP server. Tool results use the MCP text-content
envelope; its text is pretty-printed JSON. Build and connect the server with
[CODEX_MCP_SETUP.md](CODEX_MCP_SETUP.md). These requests match the Zod schemas in
`packages/design-mcp/src/index.ts`.

## `create_design_plan`

Creates a deterministic structured direction before implementation. Only `prompt` is required;
`compositionSeed` must be a non-negative integer.

### Request

```json
{
  "prompt": "Create an editorial site for an independent architecture journal.",
  "websiteType": "Editorial archive",
  "preferences": ["warm monochrome", "large typography"],
  "avoid": ["dashboard cards", "decorative gradients"],
  "compositionSeed": 17,
  "recentSignatures": [
    {
      "heroArchetype": "poster",
      "navigationMode": "perimeter",
      "sectionSequence": ["poster opener", "project index"],
      "preset": "editorial"
    }
  ]
}
```

Navigation modes are `standard-horizontal`, `corner-controls`, `perimeter`, `overlay-minimal`,
`vertical-rail`, `masthead`, `embedded-index`, and `utility-dock`. Presets are `editorial`,
`industrial`, `minimal`, `playful`, `technical`, and `luxury`.

### Response shape

```ts
interface DesignPlan {
  preset: 'editorial' | 'industrial' | 'minimal' | 'playful' | 'technical' | 'luxury';
  concept: string;
  artDirection: string;
  layoutFamily: string;
  brandAttributes: readonly string[];
  pageStructure: readonly { id: string; pattern: string; description: string }[];
  heroComposition: HeroArchetype;
  navigation: NavigationDefinition;
  composition: {
    hero: HeroArchetype;
    navigation: NavigationDefinition;
    signature: CompositionSignature;
  };
  compositionSeed: number;
  compositionSignature: CompositionSignature;
  noveltyScore: number;
  implementationPrompt: string;
  prohibitedPatterns: readonly string[];
  designTokens: {
    colors: Record<'background' | 'surface' | 'text' | 'muted' | 'accent', string>;
    typography: { displayStyle: string; bodyStyle: string; displayScale: readonly string[] };
    spacing: { sectionPadding: string; contentGap: string };
    shape: { smallRadius: string; largeRadius: string };
  };
  preferredVisualTreatments: readonly string[];
  tasteDirection: TasteDirection;
  motionDirection?: {
    signature: string;
    trigger: 'scroll-driven';
    technique: string;
    layers: readonly string[];
    behavior: readonly string[];
    performance: readonly string[];
    reducedMotion: string;
  };
  implementationNotes: readonly string[];
  avoid: readonly string[];
}
```

`CompositionSignature` contains `heroArchetype`, `navigationMode`, `sectionSequence`, and `preset`.
`TasteDirection` identifies the profile, states a thesis, records three to five rationale-bearing
decisions, explains typography, color, imagery, navigation, and motion, defines reduced-motion
behavior, and records rejected defaults and exceptions.

## `get_design_rules`

Returns implementation constraints plus guidance for one category. `category` defaults to `general`.

### Request

```json
{
  "category": "website"
}
```

Categories are `general`, `website`, `typography`, `composition`, `imagery`, and `motion`.

### Response shape

```ts
interface DesignRules {
  category: 'general' | 'website' | 'typography' | 'composition' | 'imagery' | 'motion';
  tasteProfile: { id: string; version: string };
  categoryPrinciples: readonly string[];
  compositionPrinciples: readonly string[];
  typographyPrinciples: readonly string[];
  spacingPrinciples: readonly string[];
  imagePrinciples: readonly string[];
  motionPrinciples: readonly string[];
  antiPatterns: readonly string[];
  implementationConstraints: readonly string[];
}
```

The current `website` response identifies `anti-slop-craft-v1` version `1.0.0` and includes
first-viewport, varied-composition, typography, spacing, imagery, motion, anti-pattern, and static
implementation guidance.

## `get_taste_profile`

Returns the active versioned taste policy used by planning and deterministic review.

### Request

```json
{}
```

### Response shape

```ts
interface DesignTasteProfile {
  id: string;
  name: string;
  version: string;
  principles: readonly {
    id: string;
    statement: string;
    rationale: string;
    appliesTo:
      | 'typography'
      | 'color'
      | 'composition'
      | 'navigation'
      | 'imagery'
      | 'copy'
      | 'motion'
      | 'controls';
    priority: 'required' | 'preferred';
  }[];
  antiPatterns: readonly {
    id: string;
    description: string;
    detectionHints: readonly string[];
    recommendation: string;
    severityDefault: 'info' | 'warning' | 'error';
    allowWhen: readonly string[];
  }[];
  positiveReferenceNotes: readonly string[];
  selectionCriteria: readonly string[];
}
```

The current profile is `anti-slop-craft-v1`, named `Anti-slop craft`, at version `1.0.0`. Consumers
should use returned identity fields rather than hard-coding them.

## `review_implementation`

Runs deterministic source review against taste and composition guardrails. It does not inspect image
pixels; `visualEvidence` records screenshots and human observations supplied by the client.

### Request

This valid example includes desktop and mobile visual evidence.

```json
{
  "files": [
    {
      "path": "src/page.tsx",
      "content": "<main><header className=\"masthead\"><h1>Field notes from the northern watershed</h1></header><article>Observed species and seasonal changes.</article></main>"
    },
    {
      "path": "src/styles.css",
      "content": ".masthead{display:grid;grid-template-columns:2fr 1fr}.masthead h1{font-family:Georgia,serif;font-size:clamp(4rem,9vw,9rem)}article{font-family:Arial,sans-serif;max-width:62ch}"
    }
  ],
  "visualEvidence": {
    "screenshots": [
      {
        "viewport": "desktop",
        "location": "artifacts/home-desktop.png",
        "notes": "No empty media region."
      },
      {
        "viewport": "mobile",
        "location": "artifacts/home-mobile.png",
        "notes": "No horizontal clipping."
      }
    ],
    "checkedForEmptySpace": true,
    "checkedForMissingMedia": true,
    "visualObservations": [
      {
        "viewport": "desktop",
        "observation": "Primary headings and controls remain optically balanced."
      },
      {
        "viewport": "mobile",
        "observation": "Primary headings and controls remain legible and centered."
      }
    ]
  },
  "compositionContext": {
    "expectedSignature": {
      "heroArchetype": "editorial-masthead",
      "navigationMode": "masthead",
      "sectionSequence": ["offset typographic opener", "captioned index"],
      "preset": "editorial"
    },
    "recentSignatures": []
  }
}
```

Paths are descriptive evidence; the MCP server does not read those files from disk.

### Response shape

```ts
interface ImplementationReview {
  status: 'pass' | 'revision_recommended';
  score: number;
  findings: readonly {
    rule: string;
    severity: 'info' | 'warning' | 'error';
    rationale: string;
    actionableFix: string;
    message: string;
    suggestion: string;
  }[];
  passedRules: readonly string[];
  passedPrinciples: readonly string[];
  unresolvedDecisions: readonly string[];
  policy: { profileId: string; profileVersion: string };
}
```

`message` and `suggestion` are compatibility aliases for `rationale` and `actionableFix`.

## Errors and compatibility

The MCP SDK validates requests before invoking a tool. Invalid enum values, missing or empty required
strings, and an empty `files` array fail at that boundary. Provider-specific message formatting stays
outside this package.
