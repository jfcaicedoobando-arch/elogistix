## Contexto

La factura `cc5fd47d…` es de un **proveedor extranjero** (sin CFDI mexicano). Aun así el validador `_cxp_validar_aprobacion` exige `uuid_verificado = true` cuando `uuid_fiscal` no es nulo, y lanza `LC_CXP_UUID_NO_VERIFICADO`. Los proveedores extranjeros no emiten CFDI, por lo que el SAT nunca podrá "verificar" ese folio — el bloqueo es incorrecto para esa clase de proveedor.

**Cómo reconoce el sistema a un extranjero**: `public.proveedores.origen_proveedor` es un enum `{Nacional, Extranjero}` (verificado en BD).

## Cambios

### 1) Backend — exentar extranjeros de la verificación SAT
Nueva migración que hace `CREATE OR REPLACE` de `public._cxp_validar_aprobacion(uuid)` (misma firma, mismas validaciones de conceptos/cuadre/embarque, mismo `SECURITY DEFINER + search_path = public`, mismos `REVOKE/GRANT`, y se conserva el `_cxp_anchor_fase_o` para no romper el guardrail Fase O). Único cambio en la lógica:

```text
-- Antes:
IF v_row.uuid_fiscal IS NOT NULL AND COALESCE(v_row.uuid_verificado,false)=false THEN
  RAISE 'LC_CXP_UUID_NO_VERIFICADO...';

-- Después: solo aplica a proveedores Nacionales
SELECT origen_proveedor INTO v_origen FROM public.proveedores WHERE id = v_row.proveedor_id;
IF v_origen = 'Nacional'
   AND v_row.uuid_fiscal IS NOT NULL
   AND COALESCE(v_row.uuid_verificado,false) = false THEN
  RAISE 'LC_CXP_UUID_NO_VERIFICADO...';
END IF;
```

Efecto: para proveedores `Extranjero` se omite el paso SAT aunque por accidente el campo `uuid_fiscal` traiga texto (p. ej. capturado desde el PDF por IA).

### 2) UI — ocultar "Verificar en SAT" cuando el proveedor es extranjero
En el detalle de factura de proveedor (sección "Información de la factura"), el botón "Verificar en SAT" y el badge de estatus SAT sólo se muestran cuando `proveedor.origen_proveedor === 'Nacional'`. Para extranjeros se muestra en su lugar una etiqueta discreta *"No aplica (proveedor internacional)"*.

Archivo objetivo: componente donde vive `Verificar en SAT` dentro de `src/features/cxp/**` (se identificará durante la implementación; se ajusta solo la condición de renderizado, sin tocar la edge `verificar-uuid-sat`).

### 3) Mensaje de error mejorado (defensa en profundidad)
En `src/features/cxp/services/aprobacionFactura.ts`, si por alguna razón `LC_CXP_UUID_NO_VERIFICADO` llega para un flujo extranjero, el copy sugiere "Si es un proveedor internacional, quita el UUID fiscal del detalle" (no bloqueante — solo mejora el toast).

### 4) Changelog + versión
- `APP_VERSION` bump patch → `13.309.33`.
- Entrada en `CHANGELOG.md` describiendo el fix con analogía.

## Fuera de alcance
- No se modifica la edge `verificar-uuid-sat`.
- No se re-abre backfill de facturas ya aprobadas.
- No se cambian conceptos, cuadre, ni validaciones de embarque.

## Riesgos
- Guardrail `cxp-aprobacion-consistencia-fase-o` sigue exigiendo que la validación de `uuid_verificado` exista en la migración más reciente — se conserva textualmente el `RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO...'`, sólo se envuelve con la condición `v_origen = 'Nacional'`. Si el regex del test es demasiado estricto, se ajusta el test para aceptar el gating por origen.

## Validación
- `bash scripts/ci-fast.sh` (lint + typecheck + migraciones + tests).
- Prueba manual: aprobar la factura extranjera `cc5fd47d…` sin pasar por "Verificar en SAT".
