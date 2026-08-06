# Universal agent workflow

These instructions apply to every agent working in this repository. Inspect the existing implementation before editing, preserve unrelated user changes, and never use destructive Git commands to discard work.

## Choose the workflow

Use the smallest workflow that fully covers the request:

- **Substantial website or interface creation/redesign:** use the full art-direction workflow below.
- **Narrow visual change:** inspect the current design, call `get_design_rules`, and use `create_design_plan` when the change affects composition or visual direction.
- **Non-visual frontend change:** preserve the established design system and behavior; do not redesign adjacent UI.
- **Backend, tooling, documentation, or tests:** follow the repository's existing patterns and run the relevant checks. Universal design tools are not required unless the work changes visible UI.

## Full art-direction workflow

For a new or substantially redesigned website, landing page, dashboard, portfolio, or React interface:

1. **Audit before proposing.** Read the relevant React, styling, routing, state, and test files. Identify existing functionality, constraints, reusable components, and unrelated local changes that must be preserved.
2. **Gather design context.** Inspect any user-provided references. Call `get_design_rules` for the relevant category and `get_taste_profile` when available. Treat explicit user requirements as higher priority than inferred preferences.
3. **Run discovery when direction is not already settled.** Use the Phase 2 sequence: `start_art_direction` -> `get_discovery_questions` -> `submit_discovery_answers` -> `get_creative_brief`. If the user has already supplied equivalent answers, derive them from the request instead of asking duplicate questions.
4. **Confirm the brief and direction.** Use `revise_creative_brief` when needed, then `approve_creative_brief`, `develop_art_direction`, and `get_selected_direction`. Do not begin implementation until a direction is selected. When an interactive approval step is unavailable, state the assumption and choose the direction best supported by the request.
5. **Create the implementation plan.** Prefer `create_design_plan_v2` for the full Phase 2 flow. Use `create_design_plan` only for compatibility or a narrowly scoped visual task. Treat the returned plan as the visual source of truth.
6. **Prepare generation deliberately.** Use `prepare_react_generation` when the session supports it. Use `build_react_project` only when project generation is actually requested; otherwise implement within the existing application.
7. **Implement without regressions.** Preserve existing business logic, state, routes, accessibility, responsive behavior, and public APIs unless the user requests changes. Build functional interactions when the request or existing interface requires them; do not replace working behavior with static mockups.
8. **Verify in proportion to risk.** Run formatting, type checks, targeted tests, and the production build where available. Start the app and inspect the affected UI at representative desktop and mobile widths. Fix compilation errors and material runtime regressions.
9. **Run the design-quality loop.** Submit the relevant final React and CSS sources, plus desktop/mobile evidence when supported, to `review_implementation`. Fix high-severity findings and practical medium-severity findings, then re-run the review for materially changed files.
10. **Report evidence.** Summarize what changed, checks run, remaining limitations, and any review findings intentionally left unresolved. Never claim a tool, test, screenshot, or visual check was completed when it was not.

## Visual quality principles

- Design before code; composition before components; taste before decoration.
- Follow the selected design plan consistently across typography, spacing, color, imagery, motion, and component vocabulary.
- Avoid generic AI patterns unless the brief explicitly calls for them: interchangeable gradient heroes, excessive rounded cards, cards nested inside cards, repetitive three-column feature grids, decorative pills, and unearned glassmorphism.
- Prefer a clear hierarchy, intentional whitespace, accessible contrast, responsive composition, visible interaction states, and restrained motion that respects reduced-motion preferences.
- Reuse the project's tokens and primitives when they support the chosen direction. Introduce new primitives only when they improve consistency or are required by the plan.
- Use image-generation or reference-image workflows only when original visual assets materially improve the result. Preserve provenance and do not imitate a named brand's protected visual identity.

## Phase 5 skill commands

The following planned agent-facing commands are **IN PROGRESS** and must not be invoked or described as shipped until their implementations and documentation land:

- `/audit` — **IN PROGRESS:** gather source and visual evidence, then return prioritized design-quality findings.
- `/polish` — **IN PROGRESS:** apply bounded, traceable visual refinements and verify them with before/after evidence.
- `/cleanup` — **IN PROGRESS:** remove inconsistent, redundant, or generic UI patterns without changing intended behavior.
- `/art-direct` — **IN PROGRESS:** orchestrate discovery, creative direction, design planning, implementation, and verification.
- `/review-ui` — **IN PROGRESS:** run multi-dimensional UI review across hierarchy, composition, typography, accessibility, brand, motion, and implementation craft.
- `/consistency` — **IN PROGRESS:** detect design-system drift across components and routes; repair only explicitly selected inconsistencies.

Until those commands ship, perform their underlying steps explicitly with the currently available Universal MCP tools and normal repository checks. Do not invent command output or silently substitute an unfinished command.

## Completion gate

Frontend work is complete only when the requested behavior is preserved, relevant checks pass, the affected UI has been reviewed against the selected plan, and high-severity implementation-review findings have been addressed when practical. If a required tool is unavailable, continue with the best local equivalent and disclose that limitation in the handoff.
