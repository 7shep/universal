// Local-only Preview -> trusted runtime bootstrap.
//
// `pnpm dev` alone never sets `window.__UNIVERSAL_RUNTIME__`, so Preview always falls
// back to its local fixture client and shows "Choose a generated project" instead of a
// real build. To connect a real local runtime for manual testing:
//
//   1. pnpm --filter @universal/local-runtime start
//   2. Copy the printed `runtimeOrigin` into the object below.
//   3. Uncomment the assignment.
//   4. Reload Preview in the browser (Studio's "Open isolated preview" link already
//      appends the correct ?projectId=... once a real generation completes).
//
// This file loads before Preview's app code so the global is set in time. Do not commit
// real runtime origins tied to a live local process -- restore this file to its
// commented-out default before committing unrelated changes.

// window.__UNIVERSAL_RUNTIME__ = {
//   origin: 'http://127.0.0.1:PORT'
// };
