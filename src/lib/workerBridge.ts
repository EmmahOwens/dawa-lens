/**
 * Worker communication bridge — adapted from lichobile's tellWorker/askWorker pattern.
 * Provides type-safe fire-and-forget and request/response patterns for Web Workers.
 */

export interface WorkerMessage<T = unknown> {
  topic: string;
  id?: string;
  payload?: T;
}

/**
 * Send a message to a worker without waiting for a response.
 * Use for fire-and-forget operations like preloading or notifications.
 */
export function tellWorker<T>(worker: Worker, topic: string, payload?: T): void {
  worker.postMessage(payload !== undefined ? { topic, payload } : { topic });
}

/**
 * Send a message to a worker and wait for a matched response via `id`.
 * Rejects if the worker responds with topic 'error'.
 */
export function askWorker<TPayload, TResponse>(
  worker: Worker,
  topic: string,
  payload?: TPayload
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    const handler = (evt: MessageEvent<WorkerMessage>) => {
      if (evt.data.id !== id) return;
      worker.removeEventListener('message', handler);
      if (evt.data.topic === 'error') {
        reject(new Error((evt.data as any).error ?? 'Worker error'));
      } else {
        resolve(evt.data as TResponse);
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage(payload !== undefined ? { topic, id, payload } : { topic, id });
  });
}
