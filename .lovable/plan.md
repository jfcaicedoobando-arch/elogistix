# Fixes Auditoría E2E Ronda 4 (post v13.354.4)

Objetivo: cerrar los hallazgos del reporte R4 en tres fases, empezando por los dos bloqueantes de negocio. Cada fase termina con tests de regresión y verificación en verde.

## Lo que ya verifiqué contra el proyecto real

- **P0-1 confirmado.** `guard_estado_cotizacion` en la base no contempla ninguna transición desde `Solicitada` (sólo Borrador / Enviada / Aceptada), pero `portal_solicitar_cotizacion` sí crea cotizaciones en `Solicitada` y la UI ya ofrece "Enviar" desde ese estado (`cotizacion.acciones.ts`). Toda cotización nacida en el portal quedaría muerta con `LC_COT_TRANSICION_INVALIDA`. Hoy hay 0 cotizaciones en `Solicitada`, así que no hay registros atorados que reparar — es un bloqueo a futuro.
- **P0-2 confirmado.** `has_role(uid,'operador')` incluye `ejecutivo_pricing` en su arreglo, por lo que Ventas/Pricing pasa todas las policies y RPCs de embarques que validan rol operador.
- **P1-2 confirmado.** El índice único es `(organization_id, proveedor_id, folio_proveedor) WHERE deleted_at IS NULL` (sin fecha, sin excluir Canceladas), mientras la app valida proveedor + folio + **fecha** y excluye Canceladas. Además `emision` es `string` en el schema del formulario, sin mínimo obligatorio.
- **P1-1 ya está resuelto.** La captura manual de conceptos existe desde v13.339.0 (`ConceptosManualesSection`, `useConceptosManuales`, barra de cuadre). Sólo queda validar ≥1 concepto **antes** de enviar a aprobación para que el usuario no reciba `LC_CXP_SIN_CONCEPTOS` desde la base.
- **P2-3 confirmado a medias.** `ProtectedRoute` ya guarda `state={{ from: location }}` al redirigir a `/login`, pero la pantalla de Login no consume ese state: falta sólo el regreso al deep-link.
- **P2-4 parcialmente resuelto.** `appFeedback` ya deduplica errores por código con `toast.id`; queda revisar los avisos de éxito.
- **P1-3 / P1-4 / P1-5** son comportamientos observados en E2E que no puedo confirmar leyendo código: la primera tarea de cada uno es reproducirlos y dejar que la reproducción nombre la causa antes de tocar nada.

## Fase 1 — Bloqueantes (P0)

1. **Cotizaciones del portal operables.** Nueva migración que reescribe `guard_estado_cotizacion` permitiendo `Solicitada → Borrador / Enviada / Aceptada / Rechazada` y `Solicitada → Vencida`, y extiende `snapshot_cotizacion_al_enviar` para congelar snapshot también cuando se acepta desde `Solicitada`.
2. **Pricing sin escritura en embarques.** Nueva migración que saca `ejecutivo_pricing` del arreglo de `operador` en `has_role` (sigue entrando por `viewer`, o sea lectura). En la misma entrega audito toda policy/RPC de cotizaciones, costeo (`costeo_tarifas`, `costeo_rutas`, `costeo_agentes`) y `cotizacion_costos` que dependa de `has_role(...,'operador')` y le agrego `OR has_role(auth.uid(),'ejecutivo_pricing')` donde Pricing sí debe escribir, para no romperle su trabajo.

Supuesto que estoy tomando: Pricing queda **sólo lectura** en embarques. La sugerencia extra del reporte (exigir rol admin para retroceder estados de embarque) queda **fuera** de esta entrega porque es una decisión de negocio, no un bug.

## Fase 2 — Altos (P1)

3. **Folio duplicado en facturas de proveedor.** Migración que alinea el índice único con la semántica de la app (`proveedor + folio + fecha_emision`, excluyendo Canceladas y borradas), `emision` obligatoria en el schema del formulario, y mensaje claro si la base rechaza por ese constraint.
4. **Aprobación CxP sin callejón sin salida.** Validación en la UI: no se puede enviar a aprobación una factura sin conceptos, con aviso accionable en lugar del error crudo de base de datos.
5. **Crear-y-timbrar CxC.** Reproducir el `TypeError` de `.slice`, blindar todo acceso a la respuesta del PAC con acceso opcional y validación de forma, y hacer que el detalle del borrador resuelva siempre: datos, o error con botón "Reintentar" en vez de esqueleto infinito.
6. **Wizard de cotización: autoguardado sin remontar el paso 2.** Reproducir la pérdida de foco, y asegurar que el guardado del borrador no dispare estado de React ni invalide queries, con props estables hacia el paso.
7. **Editar embarque: paso 2 con datos.** Reproducir el vaciado de naviera / agente / BL / ETD / ETA y, si se confirma la hipótesis de carrera con los catálogos, no dar el formulario por inicializado hasta que embarque y catálogos estén resueltos, con selects tolerantes a valores que aún no existen en las opciones. Este es el hallazgo con riesgo real de pérdida de datos, así que lleva prueba de ida y vuelta.

## Fase 3 — Medios y menores (P2)

8. Prorrateo por número de contenedores y consistencia del P&L (encabezado vs desglose): primero un test que reproduzca los números del reporte; si pasa, el hallazgo se cierra como artefacto de datos.
9. Deep-link tras login: consumir el `from` que ya guarda `ProtectedRoute`.
10. Avisos de éxito duplicados; exportar sin movimientos con explicación en lugar de botón muerto.
11. Lote de detalles: pluralización, título "Editar embarque" sin `null`, no mostrar la nota de IVA cuando ningún concepto lo aplica, ocultar eventos internos en el timeline del portal, tooltip cuando el estado calculado por fechas difiere del operativo, botón "Recargar datos" en el aviso de cambio en otra sesión, no preseleccionar "Importación" en la solicitud del portal, y revisar el límite del KPI "Por pagar 30 d".

## Detalles técnicos

- Toda la parte de base de datos va en **migraciones nuevas** (nunca editar migraciones aplicadas), idempotentes (H4) y con `REVOKE ALL` + `GRANT EXECUTE` explícito en funciones `SECURITY DEFINER` (H6).
- Tests de regresión por hallazgo: RLS/pgTAP para el guard de cotizaciones y para Pricing sin escritura en embarques; unitarios para duplicado de folio, prorrateo y P&L; E2E para crear-y-timbrar, autoguardado del wizard y edición de embarque.
- Se corren los tests de los archivos tocados (`embarqueRoundtrip.test.ts`, `useNuevaFacturaProveedorForm.dup.test.ts`, `accionesCotizacionPermitidas.test.ts`) más `audit:migrations` y la suite rápida.
- Al cierre de cada fase: entrada en `CHANGELOG.md` y bump de `APP_VERSION` (Fase 1 → 13.373.0).
