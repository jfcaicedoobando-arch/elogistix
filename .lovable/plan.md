
## Errores encontrados en Sentry (release `libre-carga@13.197.0`)

### 1. `JAVASCRIPT-REACT-22` — HTTP 500 en `POST /~api/analytics`
- Culpable: `flock.js` (script de tracking del hosting `librecarga.com`, no es código nuestro).
- Ruta: `/`, 2 eventos, 2 usuarios. No rompe la app (queda como error no manejado del pixel de analítica del host).
- **Acción propuesta:** ignorar en Sentry (crear inbound filter / `ignoreErrors` para peticiones a `/~api/analytics` y para stack frames de `flock.js`). No hay fix de código.

### 2. `JAVASCRIPT-REACT-23` — "Objects are not valid as a React child (found: object with keys {$$typeof, render, displayName})"
- Ruta: `/embarques/:id` (tab del detalle de embarque).
- Component stack (minificado): `EmbarqueDetalle → Tabs → TabsContent → …contenido de un tab… → DataTable → tbody → tr → td → div`.
- La forma del objeto (`$$typeof`, `render`, `displayName`) es **la firma exacta de un componente `React.forwardRef`** (Lucide icon, Radix primitive, etc.). Alguien está renderizando la **referencia del componente** en lugar de instanciarlo — típicamente `{Icon}` en vez de `<Icon />`, o `cell: () => Icon` en columnas.
- Sólo ocurre para un usuario/embarque (`a006c055-…`), lo que sugiere que depende de un dato del embarque (una columna que recibe un componente como `value`).

### Plan de acción

1. **Confirmar la línea exacta con Seer.** Correr `analyze_issue_with_seer` sobre `JAVASCRIPT-REACT-23`. Con release y sourcemaps subidos (`SENTRY_AUTH_TOKEN`), Seer desmangleará las frames `Uo`, `Qn`, `On`, `k`, `N` y apuntará al `.tsx` real.
2. **Con el archivo identificado, arreglar el render.** Cambios esperados (uno de estos patrones):
   - `{icon}` → `<Icon />` (o `React.createElement(icon)`) en la celda/badge afectada.
   - `cell: ({ row }) => row.original.icon` → envolver en JSX con `<Icon />`.
   - Coerción defensiva: si la columna recibe un `ReactNode | ComponentType`, normalizar a `ReactNode` antes de renderizar.
3. **Prevención (test de arquitectura).** Añadir un test en `src/__tests__/architecture/` que detecte `cell:` que retornen identificadores `PascalCase` de un `import` de `lucide-react` sin JSX (regex + AST simple). Evita repetición del mismo bug en futuras columnas.
4. **Filtrar en Sentry el ruido del pixel de analítica** (`JAVASCRIPT-REACT-22`):
   - Añadir en `src/lib/observability/sentry/core.ts` un `beforeSend` que descarte eventos con `mechanism === "auto.http.client.xhr"` cuya `request.url` termine en `/~api/analytics` o cuyo stack contenga `flock.js`.
5. **Cerrar issues.** `update_issue` a `resolved` para ambos en el mismo turno del fix, referenciando los IDs en el `CHANGELOG.md` (siguiendo la memoria `mem://preferences/sentry-resolve`).
6. **Versionado.** Bump `APP_VERSION` a `13.198.1` (o `13.199.0` si el filtro Sentry lo consideras feature) + entrada nueva en `CHANGELOG.md`.

### Detalles técnicos

- No tocar `src/integrations/supabase/client.ts` ni tipos auto-generados.
- El filtro Sentry va sólo en cliente (`beforeSend`); no afecta captura de errores reales.
- El test de arquitectura debe usar el mismo estilo que `no-raw-table.test.ts` / `sentry-imports-guardrail.test.ts`.
- Si Seer no logra desmangle (falta sourcemap para ese release), pediremos al usuario abrir la ruta `/embarques/a006c055-e574-4e98-8738-b4f280c3c908` en preview para reproducir con dev-map y capturar la columna exacta.

### Analogía

Es como si un contenedor traía la **etiqueta del modelo de contenedor** pegada en el lugar donde debería ir el **contenedor mismo**: React esperaba "el ícono ya pintado" y le entregaron "el plano de cómo pintarlo". Hay que decirle a la celda que primero lo instancie (`<Icon />`) antes de meterlo a la tabla.
