## Diagnóstico del CI (run 79480216680)

Fallan **quality** y **tests** por 3 causas ligadas al mismo archivo `src/components/shared/ErrorBoundary.tsx`:

1. **Power of 10 (>200 líneas):** `ErrorBoundary.tsx` tiene **257 líneas** → rompen `audit-report.test.ts` y `architecture-baseline.test.ts` (fuera de allowlist).
2. **Regla de toasts:** `ErrorBoundary.tsx` llama `toast.error(...)` directo en 3 puntos → rompe `error-toasts-use-notifyError.test.ts` (debe usar `notifyError`).
3. **Test de ErrorBoundary:** `screen.getByText(/ui-explota/)` matchea **dos** nodos (el `<span>` del mensaje y el `<pre>` del stack, que ahora incluye `Error: ui-explota`) → `TestingLibraryElementError: Found multiple elements`.

Coverage y edge-functions pasaron. El resto de shards fallan por los mismos 2 tests de arquitectura.

## Cambios

### 1. Partir `ErrorBoundary.tsx` (≤ 200 líneas)

Extraer:

- `src/components/shared/errorBoundary/ErrorBoundaryFallback.tsx` — la Card/Details/Botones (bloque JSX del `render()`).
- `src/components/shared/errorBoundary/reportFeedback.ts` — funciones `ensureEventId`, `handleReportFeedback`, `buildDetailsText`, `handleCopyDetails` como helpers puros (reciben `state`/`setState` o retornan strings).

`ErrorBoundary.tsx` queda solo con: constructor, `getDerivedStateFromError`, `componentDidCatch`, `handleReset`, y `render()` que delega a `<ErrorBoundaryFallback ...>`. Objetivo: ~120–140 líneas.

### 2. Reemplazar `toast.error` por `notifyError`

En los helpers extraídos (los 3 sitios del archivo actual): usar `notifyError({ title, description, method: "ErrorBoundary.<accion>" })` desde `@/lib/notifications/notifyError` (o la ruta que use el proyecto — verificar `error-toasts-use-notifyError.test.ts` para el import canónico). `toast.success` se conserva.

### 3. Arreglar `ErrorBoundary.test.tsx`

Cambiar el selector ambiguo `getByText(/ui-explota/)` por uno específico al `<span>` del mensaje:

```
expect(screen.getByText("ui-explota", { selector: "span" })).toBeInTheDocument();
```

(o `getAllByText(/ui-explota/).length` ≥ 1 si preferimos ser laxos — voy por la variante estricta).

### 4. Versionado

- `APP_VERSION` → `13.300.15` en `src/constants/appVersion.ts`.
- `CHANGELOG.md`: entrada `[13.300.15] - 2026-07-14` con bullets: split ErrorBoundary, migración a `notifyError`, fix selector del test.

## Validación

- Typecheck (`tsgo`).
- Tests locales de arquitectura: `bunx vitest run src/__tests__/audit-report.test.ts src/lib/__tests__/architecture-baseline.test.ts src/__tests__/architecture/error-toasts-use-notifyError.test.ts src/components/shared/__tests__/ErrorBoundary.test.tsx`.

## Fuera de alcance

- No tocar umbrales de coverage (memoria `coverage-threshold`).
- No modificar los tests de arquitectura ni la allowlist.
- No refactorizar otros archivos oversized que no rompan este CI.
