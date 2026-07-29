# Shared UI

`@universal/ui` contains small React primitives shared by more than one Universal application. It
currently exports `Button` and its `ButtonProps` type.

## Button

```tsx
import { Button } from '@universal/ui';

export function Actions() {
  return (
    <>
      <Button onClick={() => console.log('continue')}>Continue</Button>
      <Button tone="quiet">Cancel</Button>
      <Button className="project-action" aria-label="Create project">
        Create
      </Button>
      <Button disabled>Building…</Button>
    </>
  );
}
```

Supported package-specific behavior:

| Prop        | Values                      | Default                   | Purpose                                                              |
| ----------- | --------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `tone`      | `primary`, `quiet`          | `primary`                 | Adds `ds-button--primary` or `ds-button--quiet`.                     |
| `children`  | React content               | required for visible text | Supplies the button content.                                         |
| `className` | string                      | none                      | Appends an application-owned class without removing package classes. |
| `type`      | `button`, `submit`, `reset` | `button`                  | Uses the native button behavior requested by the caller.             |

All standard `button` attributes, including `onClick`, `disabled`, `name`, `value`, `aria-*`, and
`data-*`, are forwarded. The component supplies class hooks but no shared stylesheet; each
application currently owns the visual definitions for those classes.

`type` deliberately defaults to `button`. Native HTML buttons default to submission inside a form,
so the explicit default prevents a shared action from accidentally submitting or resetting its
nearest form. Use `type="submit"` only when submission is intended:

```tsx
<form onSubmit={saveProject}>
  <Button type="submit">Save project</Button>
</form>
```

## Accessibility contract

- Give every button an accessible name through visible text or `aria-label`.
- Use the native `disabled` attribute when the action is unavailable.
- Do not remove the browser focus indicator unless the application replaces it with an equally
  visible `:focus-visible` treatment.
- Native buttons already support keyboard activation with Enter and Space; preserve that behavior.
- Do not use `Button` as a link. Navigation belongs in an anchor or router link with link semantics.
- Keep loading labels understandable and expose longer asynchronous state through the owning
  application's status messaging.

## Package ownership

Add a component to `packages/ui` when it is used by multiple applications and has a stable,
application-neutral behavior contract. Keep product-specific workflows, data fetching, layout,
and one-off visuals inside the owning application. Shared status, accessibility, or runtime
contracts belong in their domain package rather than in this React package.

## Validate changes

From the repository root:

```bash
pnpm --filter @universal/ui test
pnpm --filter @universal/ui lint
pnpm --filter @universal/ui typecheck
pnpm --filter @universal/ui build
```

The focused component tests are in [`src/button.test.tsx`](src/button.test.tsx).
