# Desbloquear la aprobación de facturas de gasto (caso FP-000221)

## Qué está pasando

La factura FP-000221 (proveedor 10283, servicios profesionales, 176,789.54 MXN) está
pendiente de aprobación, no está ligada a ningún embarque ni a costos, y su categoría
es "Gastos de administración".

La regla actual del sistema permite aprobar sin respaldo de embarque sólo hasta
50,000 MXN. Arriba de ese monto exige vincularla a un embarque o a sus costos, sin
importar si el gasto es operativo o administrativo. Además el aviso dice que el límite
se ajusta en Configuración → Compras, pero esa pantalla no existe hoy.

## Qué se va a cambiar

1. **Los gastos que no son de embarque ya no piden vínculo.**
   Si la factura tiene una categoría de gasto que no es costo directo de embarque
   (administración o ventas), se omite la exigencia de vincularla y sólo se pide la
   justificación del gasto (mínimo 10 caracteres), como hoy.
   Las facturas con categoría de costo directo de embarque, o sin categoría, siguen
   sujetas al límite: nada se relaja para el costeo operativo.

2. **El límite se vuelve configurable.**
   Nueva sección "Compras" dentro de Configuración con un campo para el monto máximo
   que puede aprobarse sin respaldo de embarque (valor actual por defecto: 50,000 MXN).
   Sólo la puede editar quien ya administra la configuración de la empresa.

3. **Los avisos se vuelven honestos.**
   El mensaje de bloqueo dirá el monto, el límite vigente y dónde ajustarlo, y ya no
   mencionará una pantalla inexistente.

## Detalle técnico

- Migración sobre `public._cxp_validar_aprobacion`: en el bloque "sin embarque ni
  conceptos vinculados", leer `tipo_contable` de `presupuesto_categorias` vía
  `proveedor_facturas.categoria_presupuesto_id`. Si es `Venta` o `Administracion`,
  saltar la comparación contra `cxp_umbral_sin_vinculo` y mantener el requisito de
  justificación (`LC_CXP_SIN_RESPALDO`). Si es `CostoDirectoEmbarque` o `NULL`,
  comportamiento actual intacto (incluido `LC_CXP_TC_REQUERIDO` para moneda extranjera).
  Sin cambios de tablas, RLS, permisos, triggers ni datos históricos. Espejo canónico
  en `supabase/schema/cxp/_cxp_validar_aprobacion.sql` sincronizado 1:1.
- Configuración: nuevo `TabCompras` en `src/features/configuracion/components/`,
  reutilizando `useConfigValue` / `useUpdateConfiguracion` con
  `categoria: "compras"`, `clave: "umbral_aprobacion_sin_vinculo"`; alta de la pestaña
  en `src/features/admin/routes/admin-org/Configuracion.tsx` (oculta para `contador`,
  igual que Operaciones). No se toca `configuracion` como tabla.
- Mensajes en `src/features/cxp/services/aprobacionFactura.ts`
  (`LC_CXP_SIN_RESPALDO_MONTO`) redactados con el límite vigente.
- Regresiones focalizadas preparadas: dominio del tab de Compras y mapeo de mensajes.
  No se ejecutan suites completas, RLS ni CI localmente (quedan para GitHub Actions).
- Bump de patch en `src/constants/appVersion.ts` + entrada en `CHANGELOG.md`.

## Fuera de alcance

Sin backfills, sin aprobar ni modificar FP-000221 ni ninguna factura, sin cambios de
permisos/RLS, sin publicar.
