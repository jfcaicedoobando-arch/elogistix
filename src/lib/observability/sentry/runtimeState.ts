let ready = false;
const listeners = new Set<() => void>();

export const getSentryReady = () => ready;
export function subscribeSentryReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function markSentryReady(): void {
  if (ready) return;
  ready = true;
  for (const listener of listeners) listener();
}
