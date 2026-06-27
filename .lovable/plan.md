
# Auditoría E2E — Playwright (`/e2e`)

Revisé `playwright.config.ts`, `globalSetup.ts`, `fixtures/auth.ts` y los 8 specs. Resumen analógico: la suite es como una alarma de casa con sensores conectados pero sin batería — el cableado existe, pero varios sensores apuntan a paredes que ya no están ahí (rutas obsoletas) y otros suenan aunque no pase nada (asserts tautológicos).

## Hallazgos

### Bloqueantes (rompen o dan falsos verdes)

1. **`globalSetup` escribe `internal.json`/`portal.json` pero ningún `project` los consume.** No hay `use: { storageState: "e2e/.auth/internal.json" }` en `playwright.config.ts`. El ahorro de "3-5s por spec" prometido en el comentario nunca ocurre — cada spec hace login fresco vía `loginAs`.
2. **Spec 01 "credenciales inválidas" se rompe si `globalSetup` corrió.** Como la sesión queda persistida en el contexto del navegador (cuando lo cableemos según #1), `goto("/")` redirige al dashboard y el formulario nunca se renderiza. Falta `test.use({ storageState: { cookies: [], origins: [] } })` en ese test.
3. **Spec 06 (cross-org) usa ruta inexistente.** `/facturacion/facturas/${id}` no existe (la real es `/facturacion/:id`). El test pasa porque la SPA muestra 404 genérico, no porque RLS bloquee. Además, un UUID dummy no valida cross-org — sólo valida "registro inexistente".
4. **Spec 06 assert tautológico.** `expect(page).not.toHaveURL(new RegExp(\`${id}.*\\?\`))` exige `id` seguido de `?` (query string); tras `goto` nunca hay `?`, así que siempre pasa.
5. **Spec 04 busca tabs obsoletos.** Pide `proformas|pendientes|conciliaci`, pero el rediseño v13.92.0 (que el propio spec 03 documenta) dejó sólo `Por timbrar | Emitidas | Notas de crédito`. El tab "Proformas pendientes" hoy vive en otra ruta.
6. **Spec 08 usa Locator desactualizado tras `timbrar`.** `borrador` se define con `hasText: /Borrador/i`; después de timbrar el badge cambia a "Timbrada" y `borrador.getByRole("button", { name: /registrar pago/i })` resuelve a 0 elementos.

### Altos (afectan robustez)

7. **`playwright.config.ts` no tiene `webServer`.** Si el dev no levantó manualmente Vite en 8080, los specs fallan con `ERR_CONNECTION_REFUSED`. Debe agregarse `webServer: { command: "bun run dev", url: BASE_URL, reuseExistingServer: !process.env.CI }`.
8. **Specs no cargan `.env.e2e`.** El README lo menciona pero ni `globalSetup` ni `playwright.config` hacen `dotenv.config({ path: ".env.e2e" })`. El usuario debe exportar variables manualmente.
9. **Spec 02 race condition.** `Promise.race([firstRow, emptyState])` resuelve al primero visible; si el estado vacío parpadea antes de hidratar datos, el subsiguiente `firstRow.isVisible()` resulta `false` y el `test.skip` se dispara aunque sí haya datos.
10. **`loginAs` regex no anclada.** `/\/$|\/login/i` matchea `/loginhistory`, `/loginabc`, etc. Debe ser `/^\/?$|^\/login(\/|$)/i`.
11. **`globalSetup.saveStorageState`** no espera a que el shell autenticado esté listo (sólo a que la URL cambie). Si Supabase tarda en hidratar la sesión antes del primer `localStorage.setItem`, el `storageState` puede quedar incompleto.

### Medios (mejoras)

12. **Falta `test.describe.configure({ mode: "serial" })`** en specs que mutan (08 fiscal). Aunque `workers: 1` lo cubre globalmente, marcar la intención previene regresiones si se sube a paralelo.
13. **Spec 06 no intercepta network.** La defensa real es RLS; el spec sólo valida UI. Debe añadir `page.on("response")` y assertear que ningún POST a `/rest/v1/embarques?id=eq.<id>` devuelva una fila.
14. **`pwRequest` importado y silenciado con `void`.** Eliminar el import sin uso en lugar del workaround.

## Plan de remediación (3 lotes)

### Lote 1 — Bloqueantes (1 PR)
- Cablear `storageState` en `playwright.config.ts` con dos projects: `chromium-internal` (consume `internal.json`) y `chromium-portal` (consume `portal.json`). Spec 05 corre sólo en el segundo project.
- Spec 01 segundo test: `test.use({ storageState: { cookies: [], origins: [] } })`.
- Spec 06: corregir ruta a `/facturacion/${id}`. Reescribir assert principal a "UI muestra guard copy O la URL ya no contiene el ID". Documentar que `E2E_CROSS_ORG_*_ID` es **requerido** para validación real (con dummy UUID sólo se valida 404, no cross-org).
- Spec 04: buscar tab `por timbrar` y luego navegar a la ruta de proformas pendientes real (validar dónde vive hoy: `/cotizaciones` o `/proformas`). Si ya no existe el concepto, eliminar el spec o moverlo a `/facturacion` tab `por timbrar`.
- Spec 08: re-localizar la fila por número de factura (no por estado "Borrador") después de timbrar.

### Lote 2 — Altos (1 PR)
- Añadir bloque `webServer` en `playwright.config.ts` (no-op cuando `E2E_BASE_URL` es remoto).
- `globalSetup` y `playwright.config` cargan `dotenv` desde `.env.e2e` si existe.
- Spec 02: cambiar `Promise.race` por esperar al `data-loading="false"` del DataTable + lectura síncrona del count.
- `loginAs`: regex anclada `^/?$|^/login(/|$)`.
- `globalSetup`: tras detectar URL post-login, esperar a `getByText(/libre carga/i)` antes de `storageState`.

### Lote 3 — Medios (1 PR)
- Spec 08: `test.describe.configure({ mode: "serial" })` explícito.
- Spec 06: agregar `page.on("response")` interceptando `/rest/v1/embarques`, `/rest/v1/facturas`, `/rest/v1/cotizaciones` filtrados por el ID dummy y asegurar que devuelvan `[]`.
- Limpiar import `pwRequest` no usado.
- Añadir `e2e/.auth/` a `.gitignore` si no está.

## Notas técnicas

- Nada que cambiar en `src/`; toda la cirugía vive en `playwright.config.ts`, `e2e/globalSetup.ts`, `e2e/fixtures/auth.ts` y los 8 specs.
- No bumpeamos `APP_VERSION` por cambios sólo en E2E; sí actualizamos `CHANGELOG.md` como entrada `chore(e2e)`.
- No corro los specs como parte de la remediación: requieren credenciales staging que no están en el sandbox.

## Pregunta antes de implementar

¿Avanzo con los 3 lotes secuenciales en un solo turno (PR único), o prefieres ir lote por lote para revisar entre cada uno?
