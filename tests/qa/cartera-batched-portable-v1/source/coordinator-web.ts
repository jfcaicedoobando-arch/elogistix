import { planBatches } from './plan-batches';
import { runWorker } from './worker-client';
const fontUrl = new URL('./src/pdf/assets/Inter-Regular.ttf', import.meta.url);
// Bundled for a local browser harness; runtime browser verification remains pending.
// Caller owns a frozen company/filter snapshot and must recheck it before download.
export async function renderCarteraBatched(props: any, { signal, onProgress = () => {}, batchSize = 500 }: { signal: AbortSignal; onProgress?: (value: any) => void; batchSize?: number }) {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const observerErrors: string[] = [];
  const emit = (value: any) => { try { onProgress(value); } catch (error) { observerErrors.push(String(error)); } };
  const fixed = { ...props, generatedAt: props.generatedAt ?? new Date().toISOString() };
  const jobs = planBatches(fixed, batchSize), batches: Uint8Array[] = [];
  let activeWorkers = 0, peakActiveWorkers = 0;
  const lifecycle = (event: string) => {
    activeWorkers += event === 'started' ? 1 : -1;
    peakActiveWorkers = Math.max(peakActiveWorkers, activeWorkers);
    emit({ phase: 'worker', event, activeWorkers, peakActiveWorkers });
  };
  for (let index = 0; index < jobs.length; index++) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const result = await runWorker(new Worker(new URL('./render-worker-web.ts', import.meta.url), { type: 'module' }), { props: jobs[index] }, signal, [], lifecycle);
    batches.push(result.bytes);
    emit({ phase: 'render', completed: index + 1, total: jobs.length, bytes: result.bytes.length });
  }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const response = await fetch(fontUrl, { signal });
  if (!response.ok) throw new Error('Unable to load local font');
  const font = new Uint8Array(await response.arrayBuffer());
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  emit({ phase: 'merge' });
  const result = await runWorker(new Worker(new URL('./merge-worker-web.ts', import.meta.url), { type: 'module' }), { batches, font }, signal, [...batches.map(b => b.buffer), font.buffer], lifecycle);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  return { ...result, activeWorkers, peakActiveWorkers, batches: jobs.length, observerErrors };
}
