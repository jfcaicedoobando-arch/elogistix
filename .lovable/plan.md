## Diagnóstico

El checklist no funciona por **dos bugs** que se combinan:

### Bug 1 — RPC `validar_cierre_embarque` referencia columnas que no existen

La función SQL consulta `documentos_embarque.requerido` y `documentos_embarque.archivo_url`, pero la tabla real tiene columnas distintas:

- columnas reales: `id, embarque_id, nombre, estado, archivo, notas, organization_id, created_at, deleted_at, deleted_by`
- **no existen** `requerido` ni `archivo_url`

Resultado en red (confirmado en network log de este embarque):
```
POST /rpc/validar_cierre_embarque  →  400
{"code":"42703","message":"column de.requerido does not exist"}
```

Como `useValidacionCierre` es un `useQuery` (sin `notifyError`), el error se traga en silencio → `data` queda `undefined` → `checks = []` → la tarjeta muestra *"Sin datos."* y el botón **Cerrar embarque** queda permanentemente deshabilitado.

**Analogía:** es como pedir la lista de invitados (RPC) usando un campo "VIP" que nadie agregó al formulario; el sistema devuelve error, pero la pantalla solo dice "lista vacía".

### Bug 2 — Prop `estatus` mal mapeado en `EmbarqueDetalleTabs.tsx`

```tsx
<TabCierre estatus={(embarque as { estatus?: string }).estatus ?? ""} ... />
```

`embarques` no tiene columna `estatus`; la columna real es `estado`. El cast siempre regresa `undefined → ""`, por lo que `listoParaCierre` es **siempre `false`**, incluso cuando el embarque está en EIR o Entregado. Por eso siempre se muestra la alerta *"Aún no se puede cerrar"*.

## Cambios

### 1. Migración SQL — corregir `validar_cierre_embarque`

Reemplazar el bloque de "Documentos requeridos" para que use columnas reales. Como la tabla no tiene marcador de "requerido", la regla pasa a ser: **"todos los documentos cargados tienen archivo subido"** (un documento sin `archivo` es uno incompleto).

```sql
SELECT COUNT(*) INTO v_docs_faltantes
FROM documentos_embarque de
WHERE de.embarque_id = p_embarque_id
  AND de.deleted_at IS NULL
  AND (de.archivo IS NULL OR de.archivo = '');
```

Todo lo demás de la función queda igual (CXC, CXP, PnL, comisión, contenedores FCL, conceptos venta/costo, liquidación).

### 2. `src/features/embarques/components/EmbarqueDetalleTabs.tsx`

Cambiar el prop:
```tsx
<TabCierre embarqueId={embarqueId} estatus={embarque.estado ?? ""} modo={embarque.modo} />
```

### 3. Robustecer feedback de error

En `useCierreEmbarque.ts → useValidacionCierre`, agregar `meta: { errorMessage: ... }` o un `useEffect` que dispare `notifyError` cuando la query falle, para que el siguiente bug de RPC no vuelva a quedar invisible.

### 4. Bump de versión + CHANGELOG

- `APP_VERSION` → `13.87.6`
- Entrada en `CHANGELOG.md` describiendo los dos fixes.

## Validación esperada después del fix

Al volver a `/embarques/c182b3f9-…?tab=cierre`:

- la llamada a `validar_cierre_embarque` regresa 200 con un array de `checks`
- la tarjeta muestra cada regla con ✅ / ❌
- como el estado del embarque es `EIR`, la alerta *"Aún no se puede cerrar"* desaparece y el botón **Cerrar embarque** se habilita cuando todas las reglas son OK
