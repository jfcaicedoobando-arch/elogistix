## Diagnóstico

Audité la base y encontré **proformas con IVA desincronizado**: el flag `aplica_iva` y `tasa_iva_aplicada` de los conceptos están correctos, pero los totales (`iva_usd`, `total_usd`) almacenados en la proforma son `0`.

Ejemplos reales (`PRO-2026-0319/0321/0322`):

| Proforma   | iva_usd guardado | IVA recalculado desde conceptos |
|------------|------------------|---------------------------------|
| PRO-2026-0319 | 0   | 20 USD |
| PRO-2026-0321 | 0   | 40 USD |
| PRO-2026-0322 | 0   | 20 USD |

### Causa raíz

`useDialogGenerarProformaController` envía dos cosas separadas a la RPC `crear_proforma_atomica`:
1. **`totales`** calculados en cliente (memo sobre `ivaPorConcepto`).
2. **`ivaOverrides`** por concepto (también desde `ivaPorConcepto`).

La RPC **confía ciegamente** en `totales` y solo persiste overrides en `conceptos_venta`. Cualquier desfase entre los dos cálculos en cliente (re-render por refetch de React Query mientras el diálogo está abierto, `useEffect` que reinicializa `ivaPorConcepto` al cambiar referencia de `conceptosPendientes`, race entre `setState` y memo) produce el bug: los conceptos quedan marcados con IVA pero el total de la proforma queda en cero.

Bug secundario: en `PasoSeleccionConceptos.tsx:84`, `ivaPorConcepto[c.id] ?? false` muestra el switch en OFF antes de que el `useEffect` de inicialización corra, dando una ventana donde el usuario puede submitir sin que el estado refleje los defaults reales.

## Plan de remediación

### 1. Mover la fuente de verdad al servidor (fix definitivo)

Modificar `crear_proforma_atomica` para **recalcular** los totales dentro de la RPC desde los conceptos seleccionados y los overrides, ignorando los `p_*_usd`/`p_*_mxn` del cliente (o usarlos solo como validación con tolerancia).

Pseudo-SQL:
```sql
-- después de aplicar overrides:
SELECT
  SUM(CASE WHEN moneda='USD' THEN cantidad*precio_unitario END) AS sub_usd,
  SUM(CASE WHEN moneda='USD' AND aplica_iva
           THEN cantidad*precio_unitario*tasa_iva_aplicada END) AS iva_usd,
  ... -- MXN siempre con IVA
INTO v_sub_usd, v_iva_usd, ...
FROM conceptos_venta
WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;
```
Si los totales del cliente difieren de los recalculados en > $0.01, **levantar excepción** y log en `bitacora_actividad` para detectar regresiones futuras. Insertar siempre los valores recalculados.

### 2. Reparar proformas existentes

Migración one-shot que recalcula `iva_usd`, `total_usd`, `iva_mxn`, `total_mxn` para todas las proformas con `estado_revision != 'facturada'` cuyos totales no cuadren con sus conceptos. Las facturadas no se tocan (impacto fiscal); se listan en bitácora para revisión manual del usuario.

### 3. Endurecer el cliente

- `useDialogGenerarProformaController`: cambiar el `useEffect` de inicialización para que **solo** se ejecute en transición `open: false → true` (usar `useRef` para detectar primer abrir) y no en cada cambio de referencia de `conceptosPendientes`. Esto preserva los toggles del usuario ante refetches.
- `PasoSeleccionConceptos.tsx:84`: cambiar `?? false` por `?? !!c.aplica_iva` para evitar la ventana de UI inconsistente.

### 4. Tests

- Unit test en `lib/domain/proforma.test.ts` cubriendo el caso "concepto con `aplica_iva=true` y `ivaOverrides` ausente debe sumar IVA".
- Test de regresión en `services/proforma/crud.test.ts` que valida la RPC con totales recalculados.
- E2E (Playwright `03-factura.spec.ts`): crear proforma con mezcla USD con/sin IVA y verificar `total_usd = subtotal + iva` post-creación.

### 5. Bitácora / Changelog

- Actualizar `CHANGELOG.md` y bump `APP_VERSION` a `12.94.2`.
- Registrar incidencia en `mem://features/proforma-iva-fix` documentando que la RPC es ahora source of truth.

## Detalles técnicos

- **Archivos afectados**:
  - Nueva migración SQL: redefinir `crear_proforma_atomica` + script de reparación.
  - `src/features/embarques/hooks/useDialogGenerarProformaController.ts`
  - `src/features/embarques/components/proforma/PasoSeleccionConceptos.tsx`
  - `src/lib/domain/__tests__/proforma.test.ts`
  - `src/services/proforma/__tests__/crud.test.ts`
  - `e2e/specs/03-factura.spec.ts`
  - `CHANGELOG.md`, `src/constants/appVersion.ts`

- **Riesgo**: la migración de reparación afecta proformas no facturadas; se ejecuta en transacción con `RAISE NOTICE` por proforma corregida.
- **No se tocan**: proformas ya facturadas (mantener auditoría fiscal), facturas, ni notas de crédito.

## Pregunta antes de implementar

¿Quieres que repare automáticamente las proformas no facturadas existentes (paso 2), o prefieres que solo arregle el flujo a futuro y te entregue un reporte de las afectadas para que las corrijas manualmente?