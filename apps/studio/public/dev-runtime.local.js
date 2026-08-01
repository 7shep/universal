// Local-only Studio -> trusted runtime bootstrap.
//
// `pnpm dev` alone never sets `window.__UNIVERSAL_RUNTIME__`, so Studio always falls
// back to its deterministic fixture client (no network calls, no real generation).
// To connect a real local runtime for manual testing:
//
//   1. pnpm --filter @universal/local-runtime start
//   2. Copy the printed `runtimeOrigin` and `bootstrapToken` into the object below.
//   3. Uncomment the assignment.
//   4. Reload Studio in the browser.
//
// This file loads before Studio's app code so the global is set in time. Do not commit
// real bootstrap tokens -- restore this file to its commented-out default before
// committing unrelated changes. The token is single-use and stops working the moment
// the runtime process that issued it exits, so an accidental commit is low-risk, but
// keep the default no-op state in version control for every other contributor.

// window.__UNIVERSAL_RUNTIME__ = {
//   origin: 'http://127.0.0.1:PORT',
//   bootstrapToken: 'TOKEN'
// };
