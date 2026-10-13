/** Experimental worker protocol. A fresh worker owns exactly one request. */
export function runWorker(worker: Worker, data: Record<string, unknown>, signal: AbortSignal, transfer: Transferable[] = [], lifecycle: (event: string) => void = () => {}): Promise<any> {
  // Observer failures must never orphan a worker or leave its Promise pending.
  const notify = (event: string) => { try { lifecycle(event); } catch { /* instrumentation only */ } };
  notify('started');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      worker.terminate(); notify('terminated');
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data: message }) => {
      if (!message || message.id !== 1 || typeof message.ok !== 'boolean') { finish(new Error('Invalid worker response')); return; }
      if (!message.ok) { finish(new Error(String(message.error))); return; }
      if (!(message.bytes instanceof Uint8Array)) { finish(new Error('Invalid worker PDF bytes')); return; }
      finish(undefined, message);
    };
    worker.onerror = (event) => finish(new Error(event.message || 'Worker failed'));
    worker.onmessageerror = () => finish(new Error('Worker message could not be decoded'));
    try { worker.postMessage({ id: 1, ...data }, transfer); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}
