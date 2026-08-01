# Fixes Ronda 5 — plan de ejecución (base actual v13.388.1)

La auditoría se hizo sobre v13.386.0. Verifiqué cada hallazgo contra el código y la base de datos de hoy: varios ya están corregidos por cambios posteriores, así que el plan sólo ejecuta lo que sigue vivo y verifica el resto en vez de repetir trabajo.

## Estado verificado

Confirmados (siguen rotos):
- P0-1: `EditarCotizacion.tsx` sigue redirigiendo si `estado !== "Borrador"`, y el detalle sí manda a `/editar` con el botón "Completar cotización" → callejón sin salida.
- P0-2: `buildPayload` envía `categoria_presupuesto_id` tal cual (puede ir vacío), `runSubmit` no valida antes del INSERT y el mapeo de errores usa un match laxo `/folio/` → toast de "folio duplicado" falso. No existe rama para `23502`.
- P2-1: el modal de edición de proveedor no valida CLABE (la validación de 18 dígitos sólo existe en el alta) y avisa éxito sin confirmar el UPDATE.

Ya corregidos antes de esta ronda (no se toca nada, sólo se confirma):
- P1-1 dashboard: `embarquesPendientesAdmin.ts` ya cuenta `Por liquidar` en su propio bucket, no como Cerrado.
- P1-1 vacío silencioso en embarques: `Embarques.tsx` ya distingue `isError` de lista vacía.
- P1-2 error crudo de PostgREST: la FK `facturas_proforma_id_fkey` **sí existe** en la base; el embed ya no puede romper el detalle.
- P2-2: "Registrar pago" ya depende de `saldo > 0` (`computeFacturaFlags`).
- P2-6: los pagos a proveedor ya escriben en bitácora (`pagosProveedor.ts`).

## Qué haré

1. **P0-1 · Cotización `Solicitada` costeable**: permitir `Borrador` y `Solicitada` en el guard de la ruta del wizard; al guardar una `Solicitada`, transicionarla a `Borrador` (transición ya permitida por el guard SQL). Test unitario del guard de estados.
2. **P0-2 · Captura CxP manual**: validación bloqueante de categoría contable antes del INSERT (error de campo, no toast), rama explícita para `23502 categoria_presupuesto_id`, match del duplicado de folio sólo por el índice único real, y fallback genérico que muestre el mensaje real. Tests de `handleSubmitError` para los 3 casos.
3. **P2-1 · Datos bancarios del proveedor**: reutilizar la validación CLABE (18 dígitos + dígito verificador) en el modal de edición, mostrar error de campo, y mostrar éxito sólo si el UPDATE confirma filas afectadas.
4. **P2-3 · Edición de embarque**: precargar la naviera actual en el formulario (evita borrarla al guardar) y ocultar "Editar"/wizard para roles sin permiso de escritura.
5. **P2-4 · IVA 16% en concepto MXN de cotización**: reproducir COT-2026-0001, corregir el cálculo/persistencia de `tasa_iva` en la fila de concepto.
6. **P2-5 · P&L**: unificar la fuente del ingreso presupuestado del encabezado con el desglose por concepto.
7. **Verificación de los ítems ya corregidos y de los residuales** (perfil de proveedor en 0.00, `proveedor_nombre` vacío, búsqueda global de embarques, coherencia de KPIs CxP): reviso con datos reales y reporto qué queda; si aparece algo roto, lo incluyo en el mismo entregable o lo dejo listado para la ronda 6.

## Detalles técnicos

- Archivos principales: `src/features/cotizacion/routes/EditarCotizacion.tsx`, `hooks/useCotizacionWizardForm.ts`, `src/features/cxp/hooks/useNuevaFacturaProveedorForm.{submit,helpers}.ts`, `src/features/proveedor/hooks/useEditarProveedorController*.ts`, formulario de edición de embarque, componentes de concepto de cotización, servicios de P&L.
- Sin migraciones nuevas salvo que P2-4/P2-5 revelen un problema de datos; en ese caso será una migración con GRANTs y RLS explícitos.
- Cada cambio con tests y respetando los límites de líneas/complejidad de CI (archivos ≤200 líneas).
- Al final: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Orden

P0-1 → P0-2 → P2-1 → P2-3 → P2-4 → P2-5 → verificación de residuales.
