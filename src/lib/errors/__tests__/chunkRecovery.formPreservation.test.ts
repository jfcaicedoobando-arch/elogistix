// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const load = () => import('../dynamicImportError');
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(10_000);
  sessionStorage.clear();
  document.body.innerHTML = '<div id="root"><form><input value="captura pendiente"></form></div>';
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('recovery must preserve live form DOM', () => {
  it('keeps the same editable input after two canceled reloads and a third error', async () => {
    const { tryReloadForChunkError } = await load();
    const input = document.querySelector('input')!;
    const guard = (event: Event) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    const reload = vi.fn(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
    try {
      for (let i = 0; i < 2; i++) {
        expect(tryReloadForChunkError(reload)).toBe(true);
        vi.runAllTimers();
      }
      expect(tryReloadForChunkError(reload)).toBe(false);
      expect(document.querySelector('input')).toBe(input);
      expect(input.value).toBe('captura pendiente');
      expect(reload).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
      expect(document.getElementById('chunk-reload-overlay')).toBeNull();
    } finally { window.removeEventListener('beforeunload', guard); }
  });
  it('keeps the form when session storage is inaccessible on the first error', async () => {
    const input = document.querySelector('input')!;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect((await load()).tryReloadForChunkError(vi.fn())).toBe(false);
    expect(document.querySelector('input')).toBe(input);
  });
  it('deduplicates recovery notices and lets the user dismiss without losing the form', async () => {
    const input = document.querySelector('input')!;
    sessionStorage.setItem('chunk-error-auto-reload', JSON.stringify({count: 2, first: 10_000}));
    const { tryReloadForChunkError } = await load();
    tryReloadForChunkError(vi.fn());
    tryReloadForChunkError(vi.fn());
    expect(document.querySelectorAll('#chunk-recovery-notice')).toHaveLength(1);
    const dismiss = [...document.querySelectorAll('button')].find(b => b.textContent === 'Seguir trabajando');
    expect(dismiss).toBeDefined();
    dismiss!.click();
    expect(document.getElementById('chunk-recovery-notice')).toBeNull();
    expect(document.querySelector('input')).toBe(input);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('still renders bootstrap recovery when the root is empty', async () => {
    document.getElementById('root')!.replaceChildren();
    sessionStorage.setItem('chunk-error-auto-reload', JSON.stringify({count: 2, first: 10_000}));
    expect((await load()).tryReloadForChunkError(vi.fn())).toBe(false);
    expect(document.getElementById('root')!.textContent).toContain('Recargar');
  });
});
