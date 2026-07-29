import { randomUUID } from 'node:crypto';
import { link, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { RuntimeFailure } from './errors.ts';
import {
  runRenderedQaLifecycle,
  type CaptureObservation,
  type RenderedQaCaptureAdapter,
  type RenderedQaLifecycleAdapter,
  type RenderedQaLifecycleResult,
  type QaViewport
} from './rendered-qa.ts';

const safeSegment = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'root';

function loopback(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ['http:', 'ws:'].includes(url.protocol) &&
      ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function atomicEvidenceWrite(target: string, content: Uint8Array): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await link(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

export class PlaywrightRenderedQaCapture implements RenderedQaCaptureAdapter {
  readonly #evidenceRoot: string;
  #browser: Browser | undefined;

  constructor(evidenceRoot: string) {
    this.#evidenceRoot = path.resolve(evidenceRoot);
  }

  async #getBrowser(): Promise<Browser> {
    try {
      return (this.#browser ??= await chromium.launch({ headless: true }));
    } catch (error) {
      throw new RuntimeFailure(
        'PREVIEW_UNAVAILABLE',
        `Trusted browser capture could not start. Install the pinned Chromium runtime with "pnpm --filter @universal/local-runtime exec playwright install chromium". ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async capture(input: {
    revisionId: string;
    url: string;
    route: string;
    viewport: QaViewport;
    reducedMotion: boolean;
    signal: AbortSignal;
  }): Promise<CaptureObservation> {
    if (!loopback(input.url))
      throw new RuntimeFailure(
        'PREVIEW_UNAVAILABLE',
        'Trusted browser capture accepts loopback preview URLs only.'
      );
    input.signal.throwIfAborted();
    const browser = await this.#getBrowser();
    const allowedOrigin = new URL(input.url).origin;
    const context = await browser.newContext({
      viewport: { width: input.viewport.width, height: input.viewport.height },
      deviceScaleFactor: input.viewport.deviceScaleFactor,
      reducedMotion: input.reducedMotion ? 'reduce' : 'no-preference',
      serviceWorkers: 'block'
    });
    const blockedNetworkRequests: string[] = [];
    try {
      await context.route('**/*', async (route) => {
        const requestUrl = route.request().url();
        let samePreviewOrigin = false;
        try {
          samePreviewOrigin = new URL(requestUrl).origin === allowedOrigin;
        } catch {
          // The request is rejected below.
        }
        if (samePreviewOrigin || requestUrl.startsWith('data:') || requestUrl.startsWith('blob:'))
          await route.continue();
        else {
          blockedNetworkRequests.push(requestUrl);
          await route.abort('blockedbyclient');
        }
      });
      const page = await context.newPage();
      await page.goto(input.url, { waitUntil: 'networkidle', timeout: 15_000 });
      input.signal.throwIfAborted();
      const metrics = await page.evaluate(() => {
        const selector = (element: Element): string => {
          if (element.id) return `#${CSS.escape(element.id)}`;
          const name = element.tagName.toLowerCase();
          const classes = [...element.classList].slice(0, 2).map((item) => `.${CSS.escape(item)}`);
          return `${name}${classes.join('')}`;
        };
        const visible = [...document.body.querySelectorAll<HTMLElement>('*')].filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        });
        const clippedElements = visible
          .filter((element) => {
            const style = getComputedStyle(element);
            return (
              (['hidden', 'clip'].includes(style.overflowX) &&
                element.scrollWidth > element.clientWidth + 1) ||
              (['hidden', 'clip'].includes(style.overflowY) &&
                element.scrollHeight > element.clientHeight + 1)
            );
          })
          .slice(0, 20)
          .map(selector);
        const unreadableText = visible
          .filter((element) => {
            const text =
              element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE
                ? element.textContent?.trim()
                : '';
            return Boolean(text) && Number.parseFloat(getComputedStyle(element).fontSize) < 12;
          })
          .slice(0, 20)
          .map(selector);
        const missingMedia = [...document.querySelectorAll<HTMLImageElement>('img')]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map(selector);
        const responsiveIssues = visible
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.right > innerWidth + 1 || rect.left < -1;
          })
          .slice(0, 20)
          .map(selector);
        const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
        const hierarchyIssues: string[] = [];
        if (document.querySelectorAll('h1').length !== 1)
          hierarchyIssues.push('A route should expose exactly one h1.');
        for (let index = 1; index < headings.length; index += 1) {
          const previous = Number(headings[index - 1]!.tagName.slice(1));
          const current = Number(headings[index]!.tagName.slice(1));
          if (current > previous + 1) {
            hierarchyIssues.push(`Heading level jumps from h${previous} to h${current}.`);
            break;
          }
        }
        const blocks = visible
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.width > innerWidth * 0.2)
          .sort((left, right) => left.top - right.top);
        let largestGap = 0;
        let boundary = 0;
        for (const rect of blocks) {
          if (rect.top > boundary) largestGap = Math.max(largestGap, rect.top - boundary);
          boundary = Math.max(boundary, rect.bottom);
        }
        const active = document.activeElement as HTMLElement | null;
        const activeStyle = active ? getComputedStyle(active) : null;
        return {
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          viewportWidth: innerWidth,
          clippedElements,
          unreadableText,
          emptyRegionRatio: Math.min(1, largestGap / innerHeight),
          missingMedia,
          responsiveIssues,
          hierarchyIssues,
          focusVisible: Boolean(
            active &&
            active !== document.body &&
            activeStyle &&
            (activeStyle.outlineStyle !== 'none' || activeStyle.boxShadow !== 'none')
          ),
          reducedMotionStable: document
            .getAnimations()
            .every((animation) => animation.playState !== 'running')
        };
      });
      await page.keyboard.press('Tab');
      metrics.focusVisible = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return false;
        const style = getComputedStyle(active);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      });
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        animations: 'disabled'
      });
      const target = path.join(
        this.#evidenceRoot,
        safeSegment(input.revisionId),
        `${safeSegment(input.route)}-${safeSegment(input.viewport.id)}.png`
      );
      await atomicEvidenceWrite(target, screenshot);
      return {
        screenshot,
        screenshotPath: path.relative(this.#evidenceRoot, target).replaceAll('\\', '/'),
        metrics: { ...metrics, blockedNetworkRequests }
      };
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    const browser = this.#browser;
    this.#browser = undefined;
    await browser?.close();
  }
}

export async function runRenderedQaWithPlaywright(input: {
  revisionId: string;
  routes: readonly string[];
  evidenceRoot: string;
  adapter: Omit<RenderedQaLifecycleAdapter, 'capture'>;
  viewports?: readonly QaViewport[];
  timeoutMs?: number;
  maxChangedPaths?: number;
}): Promise<RenderedQaLifecycleResult> {
  const capture = new PlaywrightRenderedQaCapture(input.evidenceRoot);
  try {
    return await runRenderedQaLifecycle({
      revisionId: input.revisionId,
      routes: input.routes,
      adapter: { ...input.adapter, capture },
      ...(input.viewports ? { viewports: input.viewports } : {}),
      ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      ...(input.maxChangedPaths ? { maxChangedPaths: input.maxChangedPaths } : {})
    });
  } finally {
    await capture.close();
  }
}
