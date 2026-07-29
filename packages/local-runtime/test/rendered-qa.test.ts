import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runRenderedQaLifecycle,
  type CaptureObservation,
  type RenderedQaLifecycleAdapter
} from '../src/index.ts';

const cleanObservation = (): CaptureObservation => ({
  screenshot: Buffer.from('screenshot'),
  screenshotPath: 'evidence/route.png',
  metrics: {
    documentWidth: 390,
    viewportWidth: 390,
    clippedElements: [],
    unreadableText: [],
    emptyRegionRatio: 0.2,
    missingMedia: [],
    focusVisible: true,
    reducedMotionStable: true
  }
});

test('captures every approved route and viewport and reliably closes loopback preview', async () => {
  let closed = 0;
  const captures: string[] = [];
  const adapter: RenderedQaLifecycleAdapter = {
    async build() {},
    async launch() {
      return {
        url: 'http://127.0.0.1:43210/',
        async close() {
          closed += 1;
        }
      };
    },
    capture: {
      async capture(input) {
        captures.push(`${input.route}:${input.viewport.id}:${input.reducedMotion}`);
        return cleanObservation();
      }
    }
  };
  const result = await runRenderedQaLifecycle({
    revisionId: 'revision:1',
    routes: ['/', '/archive'],
    adapter
  });
  assert.equal(result.decision, 'accepted-initial');
  assert.equal(result.initial.captures.length, 4);
  assert.equal(captures.length, 4);
  assert.equal(closed, 1);
});

test('applies one bounded child revision, compares evidence, and accepts improvement', async () => {
  let current = 'revision:1';
  let closed = 0;
  const adapter: RenderedQaLifecycleAdapter = {
    async build(revisionId) {
      current = revisionId;
    },
    async launch() {
      return {
        url: 'http://localhost:4100/',
        async close() {
          closed += 1;
        }
      };
    },
    capture: {
      async capture() {
        const observation = cleanObservation();
        return current === 'revision:1'
          ? {
              ...observation,
              metrics: { ...observation.metrics, documentWidth: 440, viewportWidth: 390 }
            }
          : observation;
      }
    },
    async proposeRevision() {
      return {
        revisionId: 'revision:2',
        parentRevisionId: 'revision:1',
        changedPaths: ['src/styles.css']
      };
    }
  };
  const result = await runRenderedQaLifecycle({
    revisionId: 'revision:1',
    routes: ['/'],
    adapter
  });
  assert.equal(result.decision, 'accepted-candidate');
  assert.equal(result.candidate?.parentRevisionId, 'revision:1');
  assert.equal(closed, 2);
});

test('rejects regressions, non-loopback previews, and unbounded revisions with cleanup', async () => {
  let closed = 0;
  const nonLoopback: RenderedQaLifecycleAdapter = {
    async build() {},
    async launch() {
      return {
        url: 'http://example.com/',
        async close() {
          closed += 1;
        }
      };
    },
    capture: {
      async capture() {
        return cleanObservation();
      }
    }
  };
  const failed = await runRenderedQaLifecycle({
    revisionId: 'revision:1',
    routes: ['/'],
    adapter: nonLoopback
  });
  assert.equal(failed.initial.status, 'failed');
  assert.equal(closed, 1);

  const unbounded: RenderedQaLifecycleAdapter = {
    async build() {},
    async launch() {
      return {
        url: 'http://127.0.0.1:4100/',
        async close() {
          closed += 1;
        }
      };
    },
    capture: {
      async capture() {
        const observation = cleanObservation();
        return {
          ...observation,
          metrics: { ...observation.metrics, focusVisible: false }
        };
      }
    },
    async proposeRevision() {
      return {
        revisionId: 'revision:2',
        parentRevisionId: 'wrong-parent',
        changedPaths: ['package.json']
      };
    }
  };
  await assert.rejects(
    () =>
      runRenderedQaLifecycle({
        revisionId: 'revision:1',
        routes: ['/'],
        adapter: unbounded
      }),
    /not bounded/
  );
});

test('records capture failures and still closes the preview', async () => {
  let closed = false;
  const adapter: RenderedQaLifecycleAdapter = {
    async build() {},
    async launch() {
      return {
        url: 'http://127.0.0.1:4100/',
        async close() {
          closed = true;
        }
      };
    },
    capture: {
      async capture() {
        throw new Error('capture failed');
      }
    }
  };
  const result = await runRenderedQaLifecycle({
    revisionId: 'revision:1',
    routes: ['/'],
    adapter
  });
  assert.equal(result.initial.status, 'failed');
  assert.equal(closed, true);
});

test('records a cooperative timeout and closes the preview', async () => {
  let closed = false;
  const adapter: RenderedQaLifecycleAdapter = {
    async build() {},
    async launch() {
      return {
        url: 'http://127.0.0.1:4100/',
        async close() {
          closed = true;
        }
      };
    },
    capture: {
      async capture({ signal }) {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Rendered QA timed out.')), {
            once: true
          });
        });
        return cleanObservation();
      }
    }
  };
  const result = await runRenderedQaLifecycle({
    revisionId: 'revision:1',
    routes: ['/'],
    adapter,
    timeoutMs: 20
  });
  assert.equal(result.initial.status, 'timed-out');
  assert.equal(closed, true);
});
