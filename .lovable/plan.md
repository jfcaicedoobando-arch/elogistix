
## Diagnóstico

**Embarque ELIMP00195** (`879fcbb0-…ccbef8`) tiene 17 conceptos_venta con estado `pendiente`, sin `proforma_id`, todos insertados el mismo instante (3-jul 17:45) con `origen='manual'`.

Existen 10 proformas del embarque, **todas `facturada`**:
- PRO-2026-0261..0268 → consolidadas en **PRO-2026-0269** (factura externa folio **897**, `factura_id` presente).
- **PRO-2026-0956** (2-jul, folio externo **897**, sin `factura_id`) — es la proforma "vigente" con la que quedan alineados los 17 conceptos.

### Causa raíz (bug real en el código)

El RPC `public.actualizar_embarque_completo` ejecuta:

```text
DELETE FROM conceptos_venta WHERE embarque_id = p_embarque_id;
FOR cv IN jsonb_array_elements(p_conceptos_venta) LOOP
  INSERT INTO conceptos_venta (…) VALUES (…);  -- sin proforma_id ni estado_facturacion
END LOOP;
```

Cada vez que se guarda el embarque desde el wizard/editor, **borra todos los conceptos y los re-inserta como nuevos "pendientes" y `origen='manual'`**, aunque ya estén facturados. Eso rompe el vínculo con la proforma/factura y produce exactamente el síntoma reportado. Además, el `origen='manual'` uniforme y la coincidencia de `created_at` al segundo confirma que este RPC fue el que insertó los 17 el 3-jul.

## Plan

### Paso 1 — Reparación de datos (solo ELIMP00195)

Migración de datos: vincular los 17 conceptos a `PRO-2026-0956` y marcarlos facturados.

```sql
UPDATE conceptos_venta
   SET proforma_id = '<id PRO-2026-0956>',
       estado_facturacion = 'facturado'
 WHERE embarque_id = '879fcbb0-…ccbef8'
   AND deleted_at IS NULL
   AND proforma_id IS NULL;
```

Verificación posterior: `SELECT COUNT(*) FROM conceptos_venta WHERE embarque_id=… AND estado_facturacion='pendiente'` debe ser 0, y `SUM(total)` de los 17 (28,415 USD) debe cuadrar contra `PRO-2026-0956.total_usd` (26,400 USD) — hay una diferencia de 2,015 USD (1 flete de 3,175 + 1 concepto que no cuadra); si al revisar contigo resulta que 1-2 conceptos son duplicados sobrantes, se hará `deleted_at = now()` sobre esos antes del `UPDATE`. Confirmaré el desglose línea por línea antes de ejecutar.

### Paso 2 — Fix de causa raíz (RPC)

Reemplazar la estrategia "delete-all + insert" del RPC `actualizar_embarque_completo` por un **merge por id** que:

1. Actualice en sitio los conceptos existentes cuyo `id` viene en el payload (respetando `proforma_id` y `estado_facturacion`).
2. Inserte solo los conceptos nuevos (los que llegan sin `id`).
3. **Bloquee eliminación de conceptos que ya tengan `proforma_id IS NOT NULL` o `estado_facturacion='facturado'`.** Si la UI intenta quitarlos, el RPC ignora la baja o hace `deleted_at = now()` sin destruir el registro; nunca borra físicamente algo facturado.
4. Solo elimine (soft-delete) los conceptos "pendientes" que hayan sido removidos del payload.

Con esto, guardar el embarque después de facturar deja de romper la trazabilidad.

### Paso 3 — Frontend (ajuste mínimo)

En el hook `useUpdateEmbarque` y el submit del wizard: enviar el `id` de cada `concepto_venta` existente (hoy se manda un `Omit<…, 'embarque_id'>` que probablemente no incluye `id`, forzando al RPC a re-crear). Verificar `src/features/embarques/services/mutations.ts` y ajustar el tipo/carga.

Ningún cambio de UI visible.

### Paso 4 — Regla arquitectónica + test

Agregar test en `src/__tests__/architecture/` que falle si algún RPC en `supabase/migrations` contiene el patrón `DELETE FROM conceptos_venta` seguido de `INSERT INTO conceptos_venta` en la misma función (excepto migraciones ya publicadas anteriores a la del fix). Evita reintroducir el bug.

### Paso 5 — Changelog + versión

- Bump `APP_VERSION` a `13.207.0`.
- Entrada en `CHANGELOG.md` describiendo:
  - Fix: RPC de actualización de embarque ya no borra conceptos facturados.
  - Data-fix: reconciliación puntual de ELIMP00195.

## Detalles técnicos

- **Archivos tocados:**
  - `supabase/migrations/<new>.sql` — nueva versión de `actualizar_embarque_completo` + `UPDATE` puntual de reparación.
  - `src/features/embarques/services/mutations.ts` — payload incluye `id` opcional por concepto.
  - `src/features/embarques/hooks/mutations/useUpdateEmbarque.ts` — tipos.
  - `src/__tests__/architecture/rpc-no-destructive-conceptos.test.ts` — nuevo.
  - `src/constants/appVersion.ts`, `CHANGELOG.md`.
- **Riesgos:**
  - El merge del RPC debe preservar el orden y no romper otros flujos (crear/duplicar). Mantendré la firma del RPC.
  - La reparación de datos se ejecuta solo si validamos línea a línea el desglose vs. la proforma 0956.
- **Rollback:** la migración incluye backup previo en tabla `_backup_conceptos_venta_ELIMP00195_<fecha>`.

## Confirmación requerida antes de ejecutar el UPDATE de reparación

Necesito validar contigo el desglose exacto: los 17 conceptos suman **28,415 USD** pero PRO-2026-0956 dice **26,400 USD**. Antes de correr el UPDATE te muestro la comparación línea por línea contra los conceptos consolidados de la proforma (16 líneas en `proforma_conceptos_consolidados`) para decidir cuáles ligar y cuáles borrar (posible 1 flete duplicado + concepto de Demoras que quizá va en otra proforma).
