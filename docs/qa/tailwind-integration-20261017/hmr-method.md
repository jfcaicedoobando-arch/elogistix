# CSS HMR experiment harness

This document describes the harness; execution results belong in `series.json`.
Its output is a descriptive experiment, not a production configuration change.

## Reproduce

Use the installed lockfile packages, Node 24.22.0, and Playwright's own installed
Chromium revision 1248. No package or browser installation is performed by this
script. If the execution environment redirects Playwright's cache, set
`PLAYWRIGHT_BROWSERS_PATH` to the existing managed Playwright cache; do not point
at a user's Chrome installation.

```powershell
../.tools/node.exe docs/qa/tailwind-integration-20261017/run-hmr.mjs --output reports/tailwind-integration/hmr-series
```

The output must be a new, empty, gitignored directory under `reports/`. A failed
run is retained and requires a new directory for a retry. `series.json` contains
raw updates, warmups, configurations, versions, source fingerprints, logs, errors,
and descriptive statistics. Each attempted session also has `session.json` and
Node stdout/stderr logs. Files are persisted after the Vite server stops.

Run without other builds, test suites, browsers doing heavy work, or measurements
on the same machine. Unique Vite caches and Node processes do not clear the OS
file cache, reset machine load, thermal conditions, antivirus, or disk state.

## Experiment

There are four paired blocks, ordered PostCSS/Vite, Vite/PostCSS, Vite/PostCSS,
PostCSS/Vite. Each of eight sessions creates a new Node process, Vite server,
unique empty Vite cache path, managed headless Chromium instance, and empty browser
context. Each has two discarded but recorded warmup edits and five measured edits:
20 measured edits per integration, nested within four independent sessions.

`integrationOverrides()` selects either implicit discovery of the existing root
PostCSS config, or the experimental Vite plugin plus inline empty PostCSS plugins.
`isolatedEnvironment('development')` prevents real credentials, `.env` files, and
backend configuration from entering the child. Vite uses the repository root,
`configFile:false`, `envDir:false`, `css.devSourcemap:false`, and a loopback server
with ephemeral port and `strictPort:true`. The application config is not changed
or loaded. Dependency optimization uses `noDiscovery:true`, `include:[]`, and
`entries:[]` equally in both arms, avoiding background scans of the real app.

The ignored HTML fixture loads `probe.css` as a stylesheet and a small module
that records the official HMR events. `probe.css` imports the real `src/index.css`
using a generated relative path. It appends one unlayered `#hmr-probe` rule with
explicit dimensions, color, and an edit marker. Only that ignored CSS file is
rewritten during the session. No product CSS, token, compatibility rule, TSX,
class, or config is edited. This does not introduce a new utility or change the
Tailwind content corpus. The fixture is outside Vite's cache directory, and the
root config's `reports/` watcher exclusion is not copied. Watcher observations of
the specific probe file are required for every successful update.

The custom `import.meta.hot.send()` readiness echo and actual WS `connected`
message establish readiness before warmups, even if the initial `vite:ws:connect`
event occurred before the fixture listener loaded. Each edit arms an expected
unique marker before timing. The fixture requires a matching probe update,
`vite:beforeUpdate` and `vite:afterUpdate`, then verifies computed width/height,
color, marker, and rectangle after two animation frames. It sends a Playwright
binding acknowledgement to the child, which returns an IPC message to the parent.
Successful 200 CSS responses with body hashes for every initial/update marker are
also required. Reloads, errors, disconnects, reconnections, unexpected navigation,
missing responses, or failed shutdown invalidate the run; failures are not retried
or removed from the series.

The primary timer uses **one parent Node monotonic clock**, starting immediately
before `writeFile(probe.css)` and ending at IPC acknowledgement receipt. It includes
write, watcher, processing, intercepted HTTP/WS, browser layout/two RAF, Playwright,
and IPC overhead. Child/browser timestamps are diagnostic only; no clocks are
subtracted across processes. This is CSS edit-to-confirmed-DOM latency, not pure
compilation time or a measurement of physical paint.

HTTP is permitted only for GET/HEAD to that session's exact Vite loopback origin.
Playwright `route.fetch({maxRedirects:0})` rejects redirects and then fulfills the
response; this instrumentation and its overhead apply to both arms. Routing disables
browser HTTP caching. Only the exact loopback Vite `vite-hmr` WebSocket is connected;
other HTTP/WS requests are blocked before connection and fail the session. Service
workers are blocked. The empty context grants only `local-network-access`, scoped
to the exact ephemeral HTTP fixture origin using `context.grantPermissions()`;
all other permissions remain ungranted. This does not relax the HTTP/WS allowlists,
and unsupported installed permission mappings fail the session. The fixture has no application JS, auth,
remote fonts, resource hints, or backend requests. Evidence records origins/paths
without network URL queries; known token query parameters are redacted in errors
and logs. No user browser/profile is used.

The parent records source fingerprints before/after every session and the series,
covering all `src/` files plus package/lockfile and Vite/PostCSS/Tailwind configs.
Harness hashes are also checked. The probe is restored to its initial bytes only
after process shutdown is confirmed. Product files are never written. Failed
shutdown stops the series; its error and any deferred fixture restoration remain
visible in the evidence.

Statistics include all measured raw latencies and per-session median/range,
quartiles/IQR, mean, sample deviation, and coefficient of variation. The principal
comparison is four paired differences/ratios of session medians. The 20 clustered
updates are not treated as 20 independent replications. There is no significance,
stable tail-latency, whole-app HMR, new-utility generation, or production-performance
claim from this small experiment.

## Retained pre-measurement failure

The first attempted series failed before measured edits: managed Chromium 156
reported `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS` for the intended loopback
WebSocket, and the harness correctly rejected Vite's subsequent `127.0.0.1:0`
fallback. Its failed series/session evidence is retained; a complete retry uses
a new output directory. The cause of Chromium's classification has not been
established; interaction with fulfilled HTTP responses is a hypothesis.

The correction grants Playwright's documented local-network permission only to
the fixture origin before navigation. The installed Playwright mapping was
checked in `playwright-core/lib/coreBundle.js`: it recognizes
`local-network-access` and Chromium local/loopback permission types. No global
browser security flag or network guard is changed. A stop from the parent now
interrupts a pending initial navigation/readiness/style observation immediately,
so its original fatal cause is retained without an extra 30-second readiness wait
and misleading final-report timeout. This correction still requires a complete
new run; syntax review does not establish HMR success.

## Official API references checked

- [Vite JavaScript API: createServer, InlineConfig and close](https://vite.dev/guide/api-javascript#createserver).
- [Vite HMR events](https://vite.dev/guide/api-hmr#hot-on-event-cb): beforeUpdate,
  afterUpdate, beforeFullReload, error, ws:disconnect and ws:connect.
- [Vite hot.send buffering](https://vite.dev/guide/api-hmr#hot-send-event-data)
  and [client/server custom events](https://vite.dev/guide/api-plugin#client-server-communication).
- [Vite dependency optimizer isolation](https://vite.dev/config/dep-optimization-options#optimizedeps-nodiscovery)
  and [server options](https://vite.dev/config/server-options).
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
  and [disabling automatic source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files#disabling-automatic-detection).
- [Playwright HTTP routing and cache behavior](https://playwright.dev/docs/api/class-browsercontext#browser-context-route),
  [redirect limits](https://playwright.dev/docs/api/class-route#route-fetch), and
  [explicit WebSocket connection](https://playwright.dev/docs/api/class-websocketroute#web-socket-route-connect-to-server).
- [Playwright origin-scoped permissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions),
  which lists `local-network-access`, and [Chrome's local network access permission](https://developer.chrome.com/blog/local-network-access).

The installed Vite 8.3.4 client was also inspected: its CSS link update waits for
either `load` or `error` before `afterUpdate`, which is why the harness independently
requires CSS response success and verified DOM state. No private Vite API is used.
