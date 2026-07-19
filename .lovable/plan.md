
## Verificación Fase L (v13.301.83) — todo verde

- Columna `pagos_proveedor.monto_en_moneda_factura numeric(18,4)` viva con CHECK `pagos_proveedor_monto_convertido_no_null` VALIDATE.
- Backfill 22/22 pagos con la columna poblada; vista `v_proveedor_facturas_saldo` devuelve saldos coherentes en muestra (`total = pagado + saldo`).
- Trigger BEFORE `trg_pagos_proveedor_monto_convertido` + trigger `trg_check_no_sobrepago` recreado con nueva comparación.
- Guardrail `cxp-multimoneda-fase-l.test.ts`: **6/6 pass**.
- Changelog + `APP_VERSION 13.301.83` actualizados.

Sin bugs detectados. Nota menor (no bloquea Fase L): `pagosProveedor.ts` sigue llamando `recalcularEstadoFactura` cliente-side — se resolverá en Fase N (Bug 22).

---

## Fase M (v13.301.84) — Bug 20: gate de rol en `cerrar_factura_proveedor_sin_pago`

### Diagnóstico verificado

`public.cerrar_factura_proveedor_sin_pago(uuid, text, text)` es `SECURITY DEFINER`, `GRANT EXECUTE TO authenticated`, y sólo valida:

```sql
IF NOT (v_org = current_user_org_id() OR has_role(v_uid,'super_admin')) THEN
  RAISE '42501';
END IF;
```

**Falta**: exigir un rol autorizado. Hoy cualquier miembro de la organización (viewer, operador, vendedor, customer_service…) puede cerrar contablemente una factura de proveedor con saldo pendiente — operación equivalente a "cancelar deuda" que sólo debería estar en manos de contabilidad/tesorería/admin.

### Cambio

Migración `20260719_fase_m_cerrar_factura_proveedor_rol.sql`:

1. `CREATE OR REPLACE FUNCTION public.cerrar_factura_proveedor_sin_pago(...)` sustituyendo el bloque de permiso por:

   ```sql
   IF NOT (
     public.has_role(v_uid, 'super_admin')
     OR (
       v_org = public.current_user_org_id()
       AND (
         public.has_role(v_uid, 'admin')
         OR public.has_role(v_uid, 'admin_org')
         OR public.has_role(v_uid, 'contador')
         OR public.has_role(v_uid, 'tesorero')
       )
     )
   ) THEN
     RAISE EXCEPTION 'LC_CERRAR_FACTURA_SIN_ROL: sólo admin, admin_org, contador o tesorero pueden cerrar una factura sin pago.'
       USING ERRCODE = '42501',
             HINT = json_build_object(
               'rol_requerido', array['admin','admin_org','contador','tesorero'],
               'factura_id', p_factura_id
             )::text;
   END IF;
   ```

   Se aprovecha `has_role()` (mismo agrupador que RLS) — un `super_admin` sigue bypasseando; `auxiliar_contable` NO cierra (sólo captura).

2. `REVOKE EXECUTE ... FROM PUBLIC, anon` (defensa en profundidad, aunque el default de authenticated ya limita).
3. Bitácora: agregar `rol_ejecutor` al `INSERT INTO bitacora_actividad` que la RPC ya hace, para auditar quién cerró.

### Cliente

`useCerrarFacturaProveedor.onError` (o el mutation hook equivalente) mapea `LC_CERRAR_FACTURA_SIN_ROL` a un toast dedicado: "Sólo Contabilidad, Tesorería o un administrador pueden cerrar facturas sin pago." — evita el 42501 crudo.

### Guardrail

`src/lib/__tests__/cerrar-factura-proveedor-rol-fase-m.test.ts`:

- La última migración de `cerrar_factura_proveedor_sin_pago` levanta `LC_CERRAR_FACTURA_SIN_ROL`.
- El bloque `IF NOT (...)` lista `admin`, `admin_org`, `contador`, `tesorero` (y `super_admin` como bypass).
- **No** lista `operador`, `vendedor`, `viewer`, `customer_service`, `auxiliar_contable`.
- Conserva `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated`.

### Entregables

- 1 migración BD.
- 1 archivo TS del hook (mapeo de error).
- 1 guardrail test nuevo.
- Changelog `[13.301.84]` + bump `APP_VERSION`.

Sin cambios de esquema, sin backfill de datos. Bajo riesgo.
