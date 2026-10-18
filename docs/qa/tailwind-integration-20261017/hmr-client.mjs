/* global window, document, requestAnimationFrame */
// This module is copied to an ignored fixture. It imports no application JS.
const hot = import.meta.hot;
if (!hot) throw new Error('Vite HMR API unavailable');
const state = window.__hmrProbe = { events: [], target: null, ready: false, acknowledgements: [] };
const record = (name, payload) => {
  state.events.push({ name, browserPerformanceMs: performance.now(), payload });
};
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const measured = () => {
  const element = document.querySelector('#hmr-probe');
  const computed = getComputedStyle(element);
  const rectangle = element.getBoundingClientRect();
  return {
    width: computed.width, height: computed.height, color: computed.color,
    step: computed.getPropertyValue('--hmr-step').trim(),
    rectangle: { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height },
  };
};
const matches = (actual, expected) => actual.width === `${expected.width}px` && actual.height === `${expected.height}px`
  && actual.color === expected.color && actual.step === String(expected.step)
  && actual.rectangle.width === expected.width && actual.rectangle.height === expected.height;

window.__armHmrProbe = expected => {
  if (state.target) throw new Error('Previous update has not settled');
  state.target = { expected, firstEvent: state.events.length, running: false };
  return { armed: true, eventIndex: state.events.length, before: measured() };
};

async function verifyUpdate(payload) {
  const pending = state.target;
  if (!pending || pending.running) return;
  const probeUrl = new URL('./probe.css', location.href).pathname;
  if (!payload.updates?.some(update => update.path.split('?')[0] === probeUrl)) return;
  pending.running = true;
  const deadline = performance.now() + 15_000;
  while (performance.now() < deadline && state.target === pending) {
    // Verify both computed style and geometry AFTER two animation frames.
    // This is a DOM/layout observation, not an assertion about physical paint.
    await frame();
    await frame();
    const actual = measured();
    if (matches(actual, pending.expected)) {
      const result = { expected: pending.expected, actual, browserVerifiedPerformanceMs: performance.now(), events: state.events.slice(pending.firstEvent) };
      state.target = null;
      state.acknowledgements.push(result);
      await window.__hmrVerified(result);
      return;
    }
  }
  await window.__hmrFailure('Expected CSS did not apply after HMR and two-frame checks');
}

for (const name of ['vite:beforeUpdate', 'vite:afterUpdate', 'vite:beforeFullReload', 'vite:error', 'vite:ws:connect', 'vite:ws:disconnect']) {
  hot.on(name, payload => {
    const serialized = name.startsWith('vite:ws:') ? { connectionEvent: true }
      : name === 'vite:error' ? { message: payload.err?.message, plugin: payload.err?.plugin }
        : payload;
    record(name, serialized);
    if (name === 'vite:afterUpdate') void verifyUpdate(payload).catch(error => window.__hmrFailure(error.message));
    if (['vite:beforeFullReload', 'vite:error', 'vite:ws:disconnect'].includes(name)) void window.__hmrFailure(`Unexpected ${name}`);
  });
}

// Custom readiness echo is outside the measured interval. hot.send buffers
// until WS is connected, so a connect event preceding this module is harmless.
hot.on('hmr-bench:ready', payload => {
  state.ready = true;
  record('hmr-bench:ready', payload);
});
hot.send('hmr-bench:ready', { fixture: location.pathname });
