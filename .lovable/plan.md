## Diagnóstico

El linter reporta 2 vistas en `public` sin `security_invoker=on`, por lo que Postgres las trata como `SECURITY DEFINER` (corren con permisos del owner `postgres` en vez de los del usuario que consulta, saltándose RLS):

- `public.v_pagos_rep_pendientes` — join `pagos_factura ⋈ facturas`
- `public.v_proforma_factura_link` — join `proformas ⋈ facturas`

Las otras 2 vistas del proyecto (`costeo_tarifas_vigentes_v`, `v_proveedor_facturas_saldo`) ya tienen `security_invoker` activado, por eso no aparecen en el linter.

**Analogía:** una vista `SECURITY DEFINER` es como un vale firmado por el dueño de la tienda: quien lo presenta se lleva el producto sin importar su propio permiso. Al cambiar a `INVOKER` el vale se valida contra la credencial de quien pregunta y la RLS vuelve a aplicar.

## Cambios

1. **Migración** que ejecuta:
   ```sql
   ALTER VIEW public.v_pagos_rep_pendientes SET (security_invoker = on);
   ALTER VIEW public.v_proforma_factura_link SET (security_invoker = on);
   ```
   `ALTER VIEW ... SET (security_invoker)` no toca la definición ni los permisos, sólo el modo de evaluación de RLS.

2. **`src/constants/appVersion.ts`** → `13.170.10`.

3. **`CHANGELOG.md`** → entrada `[13.170.10]` explicando que se activa `security_invoker` en las 2 vistas para cerrar los 2 ERROR del linter de BD.

## Verificación

- Volver a correr el linter de Supabase: los 2 ERROR de `Security Definer View` deben desaparecer (los ~226 WARN/INFO restantes quedan como estaban, según lo acordado).
- Revisar en preview que las pantallas que consumen esas vistas (Pagos → REP pendientes, y el mapeo Proforma ↔ Factura) sigan mostrando datos para usuarios no admin — la RLS de `pagos_factura`, `facturas` y `proformas` ya está bien configurada, así que no debe haber regresión.

## Fuera de alcance

Los ~225 WARN (`Function Search Path Mutable`, `Public Can Execute SECURITY DEFINER Function`, `Extension in Public`) y el INFO de `RLS Enabled No Policy` no se tocan en este cambio, tal como pediste.
