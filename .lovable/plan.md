## Estado actual de Sentry

Sólo queda **1 issue abierto** en `elogistix/javascript-react`:

- **JAVASCRIPT-REACT-W** — `UnhandledRejection: Object captured as promise rejection with keys: code, details, hint, message`
  - **Mensaje real (PostgrestError)**: `new row violates row-level security policy "Hide soft deleted pagos_proveedor" for table "pagos_proveedor"` (`code: 42501`)
  - 5 eventos · 3 usuarios · regresión · último visto hoy · release `13.136.11`
  - URL: `https://librecarga.com/cxp`, rol efectivo: `contador`, org `00000000-0000-0000-0000-000000000001`

## Hallazgos de la investigación

1. **El usuario sí tiene el rol `contador`** en `user_roles` y la policy `Tenant CRUD pagos_proveedor` ya lo permite (revisado con `pg_policy`).
2. **La policy restrictiva `Hide soft deleted pagos_proveedor` tiene `WITH CHECK (true)`** — no puede bloquear un INSERT por sí sola; Postgres la nombra cuando *cualquiera* de las dos checks falla.
3. **La causa más probable**: el INSERT en `registrarPagoProveedor` no envía `organization_id`, así que toma el default `current_user_org_id()`. Si el usuario está actuando bajo impersonación o cambió de org sin refrescar JWT, `current_user_org_id()` devuelve un valor distinto al de la factura padre y *aun así* el INSERT cuela hasta el chequeo RLS final.
4. **Bug colateral encontrado**: `proveedorFacturas.update.ts:123` consulta `pagos_proveedor` filtrando por `factura_id`, pero la columna real es `proveedor_factura_id`. Esa query lanza error silencioso al editar facturas (no es la causa del Sentry, pero hay que arreglarlo).
5. **Manejo de errores faltante**: `registrarPagoProveedor` y `eliminarPagoProveedor` hacen `throw error` directo. El dialog que los llama no envuelve la promesa en try/catch con toast → escapa a `window.onunhandledrejection` y llega a Sentry como `UnhandledRejection`. Por eso el mensaje aparece sin stacktrace.

## Plan de implementación

### 1) Frontend — Traducción y captura de error RLS
- Crear `src/features/cxp/services/pagosProveedorErrors.ts` con `traducirErrorPagoProveedor(err)` que mapee:
  - `42501` (RLS) → `"No tienes permiso para registrar pagos a proveedor en esta organización. Verifica tu rol o la organización activa."`
  - `23xxx` (FK/unique) → mensajes genéricos en español.
  - `check_violation` con mensaje "La factura debe estar aprobada…" → respetar el texto del trigger.
  - Cualquier otro → `"No se pudo registrar el pago. Inténtalo de nuevo."`
- Envolver el `mutate`/`onSubmit` en `DialogRegistrarPagoProveedor.tsx` con try/catch que muestre `toast.error(traducirErrorPagoProveedor(e))` y **nunca** re-lance al unhandled rejection.

### 2) Backend — Forzar coherencia org en el INSERT
- En `registrarPagoProveedor` (servicio), añadir `organization_id` explícito tomado del padre `proveedor_facturas.organization_id` (consultarlo antes del INSERT). Así eliminamos la dependencia del default `current_user_org_id()` que pudo divergir bajo impersonación.
- Si la consulta del padre devuelve org distinta al `current_user_org_id()` actual → lanzar error en español controlado *antes* de pegarle al INSERT.

### 3) Bug colateral en update de facturas
- `proveedorFacturas.update.ts:121-123`: cambiar `.eq("factura_id", id)` → `.eq("proveedor_factura_id", id)`.
- Añadir test `proveedorFacturas.update.test.ts` que falle si vuelve a usar `factura_id`.

### 4) Tests
- `pagosProveedor.test.ts`: cubrir el nuevo path "org del padre != current_user_org_id → error controlado".
- `pagosProveedorErrors.test.ts`: 4 casos (RLS, FK, check_violation, genérico).

### 5) Sentry + versionado
- Marcar `JAVASCRIPT-REACT-W` como `resolved` con comentario que referencie la versión.
- Bump `APP_VERSION` a `13.137.12` y agregar bullet en `CHANGELOG.md`.

## Detalle técnico

```text
src/features/cxp/
├── services/
│   ├── pagosProveedor.ts                 (modificar: organization_id explícito + guard de coherencia)
│   ├── pagosProveedorErrors.ts           (nuevo)
│   ├── proveedorFacturas.update.ts       (fix factura_id → proveedor_factura_id)
│   └── __tests__/
│       ├── pagosProveedor.test.ts        (ampliar)
│       ├── pagosProveedorErrors.test.ts  (nuevo)
│       └── proveedorFacturas.update.test.ts (nuevo)
└── components/
    └── DialogRegistrarPagoProveedor.tsx  (try/catch + toast en español)
```

No se tocan migraciones SQL (las policies ya están correctas); el fix es defensivo en aplicación.
