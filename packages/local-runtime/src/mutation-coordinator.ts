import { AsyncLocalStorage } from 'node:async_hooks';

export class RuntimeMutationCoordinator {
  private readonly context = new AsyncLocalStorage<boolean>();
  private tail: Promise<void> = Promise.resolve();

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) throw new Error('Runtime mutation coordinator is non-reentrant.');
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await this.context.run(true, work);
    } finally {
      release();
    }
  }

  ownsLock(): boolean {
    return this.context.getStore() === true;
  }
}
