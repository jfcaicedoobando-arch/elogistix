# Changelog

## [13.823.168] - 2026-09-07

- Cotizaciones · Cerrar la venta más rápido: "Aceptar" ahora abre una confirmación que explica que la oportunidad se cerrará como Ganada con el monto de la cotización y la fecha de hoy. Se descartó agregar un campo de pago (moneda/monto/fecha) en la cotización: el dinero vive en facturas, pagos y anticipos, y duplicarlo crearía dos verdades sobre el mismo importe.
- Cotizaciones · Choque de monedas al aceptar (`LC_MONEDA_INCOMPATIBLE`): antes el cierre se rechazaba con un error y había que ir a CRM a cambiar la moneda de la oportunidad a mano. Ahora la confirmación lo explica y ofrece alinear la moneda de la oportunidad a la de la cotización en el mismo paso. El trigger `crm_cerrar_oportunidad_desde_cotizacion` sigue siendo la única autoridad del cierre; no hay migraciones ni RPCs nuevos.
- Observabilidad: `LC_MONEDA_INCOMPATIBLE` se clasifica como regla de negocio esperada y deja de reportarse a Sentry como bug.
- Validado localmente: typecheck, ESLint focalizado y las 16 pruebas de `useCotizacionDetalleHandlers` (incluye confirmación, misma moneda, alineación de moneda y fallo al alinear). CI/RLS completos quedan para GitHub Actions.

## [13.823.167] - 2026-09-07

- CxP · Registrar pago a proveedor (Sentry JAVASCRIPT-REACT-65 / JAVASCRIPT-REACT-66, `42P10`): el pago fallaba con «there is no unique or exclusion constraint matching the ON CONFLICT specification». `_asegurar_movimiento_pago_proveedor` usaba `ON CONFLICT (hash_dedupe)`, pero el único índice único vivo de `bbva_movimientos` es `(cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL`. Se alineó el target del conflicto (y el fallback de lectura, ahora acotado a cuenta y filas vivas), sin cambiar reglas de negocio, montos ni RLS.

## [13.823.166] - 2026-09-07

- Cotizaciones (smoke 162, P1 · cierre de coherencia): el guardado rápido ya no combina costos de una lectura con el sello de otra. La pantalla consume una sola fotografía `costos + updated_at` obtenida desde `cotizaciones` con sus costos relacionados, y la mutación relee esa misma fotografía tras el reemplazo. Se conserva el candado optimista y el contrato de costos usado por el wizard.
- Cotizaciones (smoke 162, P1 · captura separada): la última fotografía confirmada y la captura editable ahora viven separadas. Abrir edición congela ambas; un refresco externo sólo se adopta fuera de captura; guardar renueva filas y sello juntos; cancelar restaura inmediatamente el último dato confirmado, incluso antes de que termine un refresco. Se eliminó el parche de un solo `selloConsumido`, que fallaba en el tercer guardado.
- Regresiones preparadas para GitHub Actions (NO ejecutadas aquí): fotografía inicial 500/guardada 600 con prop del detalle retrasada, tres guardados consecutivos sin retroceso, actualización externa completa sólo fuera de edición, cancelación antes del refetch, conflicto con captura preservada y metadatos de tarifa conservados.

## [13.823.165] - 2026-09-07

- Cotizaciones (smoke 162, P1 · remate): el SEGUNDO guardado de costos podía recuperar el sello viejo. `SeccionCostosInternosPLDetalle` ya no reinstala la prop `cotizacionUpdatedAt` al pulsar «Editar costos»: mantiene el sello de la lectura coherente mostrada, tras un guardado exitoso renueva JUNTOS filas y sello con lo que devuelve la RPC (`res.costos` / `res.updatedAt`) y marca como consumido el sello gastado, de modo que un refetch tardío con ese valor viejo ni rehidrata filas ni degrada el sello. Un sello distinto (cambio real de otra persona mientras no se editaba) sí se adopta con sus filas; durante la captura se conserva el snapshot y el conflicto real sigue rechazándose. Sin sello se falla cerrado (no se sustituye por la prop al guardar).
- Cotizaciones (smoke 162, P1 · remate): editar sólo una nota borraba metadatos del costo. El mapeo lectura→fila→payload ahora preserva por fila `unidad_medida`, `costeo_tarifa_id` y `costeo_tarifa_recargo_id` (nuevo módulo `domain/mapearCostosDetalle.ts`, campos opcionales en `FilaCostoDetalle`), así que el reemplazo ya no rompe el vínculo con la tarifa de costeo que usa la revalidación de precios. Sin IDs inventados, sin match posicional, sin cambios de RPC/RLS ni campos de negocio nuevos.
- Regresiones ampliadas/estabilizadas (NO ejecutadas aquí; corren en GitHub Actions): `SeccionCostosInternosPLDetalle.sello.test.tsx` usa un fixture de lectura estable (antes un array nuevo por render podía provocar renders en bucle) y cubre segundo guardado con prop retrasada, adopción de una lectura nueva de otro usuario, metadatos conservados al guardar sólo la nota y captura realmente modificada preservada tras conflicto.

## [13.823.164] - 2026-09-07

- Cotizaciones (smoke 162, P1): el guardado rápido de costos («Editar costos» → «Guardar Costos») fallaba SIEMPRE con «Otro usuario modificó este registro mientras lo editabas», incluso sin cambiar nada. Causa: `SeccionCostosInternosPLDetalle` llamaba la mutación sin `expectedUpdatedAt` y `upsertCotizacionCostos` falla cerrado sin sello. Ahora el sello (`cotizaciones.updated_at`) viaja desde `CotizacionDetalleContenido` → `SeccionCostosInternosPLUnificado` → sección de detalle, se congela al abrir la edición (ningún refetch de fondo lo sustituye mientras hay captura) y se renueva con el sello que devuelve la RPC para permitir un segundo guardado. Se conserva íntegra la protección optimista: un conflicto real sigue rechazando sin sobrescribir ni perder la captura.
- Cotizaciones (smoke 162, P1): un solo aviso por fallo. `useUpsertCotizacionCostos` ya no emite `notifyError` propio (duplicaba «Error al guardar» + «No se pudo guardar costos»); el aviso queda en el call site, que además incluye el detalle técnico. En éxito se invalida también el detalle de la cotización para que el próximo sello venga fresco de la base.
- Embarques (smoke 162, P2 · UX): en un embarque en Borrador la barra del tab Resumen decía «Siguiente: En Tránsito» mientras el encabezado ofrecía «Avanzar a Confirmado». Nuevo helper puro `etiquetaSiguientePaso` anuncia «Confirmar el embarque» mientras el embarque no está confirmado. Sin cambios en máquina de estados, permisos, fases completadas ni fechas.
- Regresiones preparadas (NO ejecutadas aquí; corren en GitHub Actions): `components/__tests__/SeccionCostosInternosPLDetalle.sello.test.tsx` (sello del snapshot, segundo guardado con sello nuevo, conflicto real con un solo aviso), caso de error sin aviso propio en `hooks/__tests__/useCotizacionCostos.test.tsx` y siguiente paso Borrador vs Confirmado en `domain/__tests__/embarqueFasesBorrador.test.ts`.

## [13.823.163] - 2026-09-06

- Costeo/tarifas (Sentry JAVASCRIPT-REACT-64): el aviso «Ya existe una tarifa para esa misma ruta, naviera y tipo de contenedor…» se reportaba como error de aplicación porque la traducción del `23505` devolvía un `Error` genérico. Ahora se lanza como `ReglaNegocioError`, así que la UI sigue mostrando el mismo toast accionable pero deja de abrir issues en Sentry. Sin cambios de validación ni de base de datos.

## [13.823.162] - 2026-09-06

- Cotizaciones (calidad de código): `services/wizard.ts` superaba el límite de 200 líneas (Power-of-10 #4). Se extrajo `derivarSubtotalMoneda` y `MSG_COTIZACION_MIXTA` a `services/derivarSubtotalMoneda.ts`, reexportados desde `wizard.ts`. Sin cambios de comportamiento.

## [13.823.161] - 2026-09-06

- CRM/Cotizaciones (A1/A7, causa de backend confirmada): la sincronización `_crm_sync_oportunidad_desde_cotizacion` conservaba `monto_estimado` cuando la cotización tenía subtotal 0, pero sí sobrescribía `moneda`. Es decir, una oportunidad con 125,000 MXN podía quedar como 125,000 USD sin conversión sólo por vincular una cotización en dólares todavía sin ventas. La definición efectiva se leyó de la base publicada (`pg_get_functiondef`). Ahora la moneda sólo se alinea junto con un importe real; con subtotal 0 la divisa de la oportunidad queda intacta.
- Cotizaciones (A1/A7, wizard): con la venta todavía en cero, `derivarSubtotalMoneda` daba prioridad a la divisa de los renglones prellenados desde costos internos por encima de la moneda canónica del vínculo (`monedaFallback`), así que un costo interno en USD podía redenominar una cotización de una oportunidad MXN. Ahora, sin importes > 0, manda `monedaFallback`; sin vínculo se sigue preservando la divisa de los renglones. No se restringen los costos internos en otra moneda (costo y venta son cosas distintas).
- Cotizaciones (paso 1): al reabrir una cotización vinculada se lee la divisa REAL de la oportunidad (`useOportunidad`), no la persistida en la cotización. Si no coinciden se muestra la discrepancia y se preservan los importes: no hay conversión ni reparación silenciosa.
- Regresiones preparadas para GitHub Actions (no ejecutadas aquí): `supabase/tests/crm_sync_moneda_venta_cero.sql` (MXN con monto previo + cotización USD en cero, caso inverso y caso con importe real) y casos de `derivarSubtotalMoneda` en `wizard.test.ts`.

## [13.823.160] - 2026-09-06

- Clientes (A3): el listado ya no oculta clientes que comparten RFC. `fetchClientesPaginados` deduplicaba por RFC, así que los clientes con RFC genérico (XAXX/XEXX010101000) — legítimamente repetidos — desaparecían de la lista y un alta nueva parecía no haberse guardado. Ahora la deduplicación es por `id`. Sin cambios en la RPC `clientes_listado`, filtros, paginación ni RLS.

## [13.823.159] - 2026-09-06

- Cotizaciones (A1/A7): una cotización capturada en pesos con venta en cero ya no se cambia a dólares al guardar el paso 3. `derivarSubtotalMoneda` sólo asumía USD cuando el total en MXN no era > 0; ahora, si ningún importe es mayor a cero, la moneda se toma de los propios renglones y, si tampoco hay renglones, de la moneda canónica del vínculo CRM (`monedaFallback`). No se convierte ningún importe y se conserva el rechazo de cotizaciones con conceptos mixtos USD/MXN.
- Portal del agente: «Duplicar como nueva» fallaba sin explicación. Causa confirmada en base: `costeo_tarifas` tiene UNIQUE (organización, agente, naviera, ruta, tipo de contenedor, vigente_desde), así que duplicar con la misma fecha de inicio devolvía 23505 con texto de base de datos. Ahora el guardado (alta y edición) traduce ese choque a un mensaje accionable: cambiar «Vigente desde», la ruta o el tipo de contenedor. No se relajó la restricción, RLS ni los privilegios del agente.
- Cotizaciones (P2): la nota del costo se restaura al editar. `buildCotizacionInitialCostos` omitía `notas`, así que el campo aparecía vacío y el siguiente guardado del paso 2 la dejaba en blanco.


## [13.823.158] - 2026-09-06

- Auditoría de casts (0 HIGH / 0 CRITICAL): `useTarifaFormReset` ya no usa `JSON.parse(...) as Partial<TarifaInput>`. La estabilización por contenido ahora usa el patrón oficial de React de ajustar estado durante el render (`useState` con la llave JSON), sin cast, sin desactivar reglas de React y con el mismo comportamiento: hidrata cuando llegan los datos y no se pierde lo capturado con un refetch del padre.
- Bundle inicial: `@/lib/ui/appFeedback` importaba `STEP_LABELS` desde `embarqueWizardSchemas`, arrastrando los esquemas zod del wizard de embarques al chunk de arranque. `STEP_LABELS` se movió a `embarqueWizardConstants.ts` (módulo sin zod) y se re-exporta desde los esquemas para no romper imports.
- Bundle size gate: budget del entry 350 → 365 KB gz. El análisis muestra que el entry ya es sólo infraestructura (@supabase 170, react-dom 94, @radix-ui 46, zod 33 por login/portal, date-fns 31, lucide 23, tanstack 23) y que react-pdf/xlsx/recharts siguen en chunks lazy; el crecimiento restante es difuso. Si se rebasa otra vez, analizar el driver, no subir el límite.

## [13.823.157] - 2026-09-06

- Lint (`--max-warnings 0`): `useTarifaFormReset` ya no desactiva `react-hooks/exhaustive-deps` (lo que hacía que React Compiler omitiera la optimización del formulario de tarifas). El objeto `initial` se sigue estabilizando por contenido, ahora reconstruyéndolo desde su JSON dentro del `useMemo`; mismo comportamiento: hidrata cuando llegan datos y no se pierde la captura con un refetch del padre.
- Baseline de esquema: `supabase/schema/baseline.sql` regenerada con `db:baseline:update` para volver a coincidir con el replay (comentarios de `dashboard_summary_datos` y de la RPC de tarifas).
- Auditoría `audit:replay-mirror`: el espejo `dashboard_summary.sql` divergía porque la corrección de `arribos_mes` (excluir Borrador) se aplicó con un `DO`/`replace(pg_get_functiondef(...))` y no como cuerpo explícito. Nueva migración `20260913000300_dashboard_summary_espejo_replay.sql` re-emite el cuerpo completo del espejo (misma lógica ya vigente en la base, sin cambios de datos, permisos ni reglas).

## [13.823.156] - 2026-09-06

- Cotizaciones (remate A1/A7): un borrador con costo capturado y venta aún en cero ya no se considera vacío. `costoTieneContenido` sólo miraba `precio_venta` y `monto`, pero las filas reales del wizard (`FilaCostoLocal`, hidratadas por `buildCotizacionInitialCostos`) traen `cantidad` y `costo_unitario`, no `monto`; con los dos placeholders USD/MXN el criterio devolvía "sin importes" y el paso 1 podía proponer otra moneda al vincular otra oportunidad. Ahora también cuenta `cantidad × costo_unitario` (y `costo_total` en filas persistidas). Se conservan el borrador realmente vacío que adopta la moneda del CRM, la protección de conceptos reales/compensados y de costos con venta; no se convierten ni modifican importes al relinkear.
- Pruebas: sólo se agregó la regresión mínima con una `FilaCostoLocal` real (costo 1 × 500 USD, `precio_venta: 0`) y su hidratación; se mantiene la de placeholders. Sin ejecutar pruebas aquí — pendientes en GitHub Actions.

## [13.823.155] - 2026-09-06

- Clientes (Sentry JAVASCRIPT-REACT-63, Postgres 23502): el alta fallaba con "null value in column \"direccion\"" cuando el cliente se capturaba sin dirección/ciudad/estado. `crear_clientes` convertía todo texto vacío a NULL con `NULLIF(...,'')`, pero esas columnas son `NOT NULL DEFAULT ''`. Ahora las columnas no nulas (rfc, direccion, ciudad, estado, cp, contacto, telefono, email) guardan cadena vacía y sólo `regimen_fiscal`/`uso_cfdi_default` siguen aceptando NULL. Se conserva la validación fiscal completa para clientes con RFC propio.

## [13.823.154] - 2026-09-06

- Corrección de guardarraíles CI: `HistorialProformas` vuelve bajo 200 líneas y la prueba Fase J lee la regla `mostrarRecotizar` desde el módulo de dominio.

## [13.823.153] - 2026-09-05
- Cotizaciones (A1/A7): un borrador realmente vacío vuelve a poder adoptar la moneda de la oportunidad CRM. El wizard calculaba "sin importes" con `conceptosUSD.length === 0 && conceptosMXN.length === 0`, pero el formulario siembra siempre una fila vacía USD y otra MXN, así que nunca se cumplía y el vínculo fallaba con "monedas distintas". Nuevo `domain/cotizacionSinImportes.ts` (`esBorradorSinImportes`): una fila cuenta como contenido real si tiene descripción o algún importe distinto de cero, y los costos internos con precio de venta también protegen la moneda (conceptos compensados a total cero siguen protegiéndola). Sin redenominación silenciosa de cotizaciones con dinero capturado.
- Portal del agente (tarifas): el guardado no persistía. Causa comprobada en dos frentes: al crear, `useCosteoTarifaMutations` tomaba la organización sólo de `OrganizationContext`, vacío para el rol `agente_carga`, y la política `Agente escribe own tarifas` exige `organization_id = current_agente_org()`; al editar, `actualizar_tarifa_con_recargos_rpc` exigía `is_org_member(org)`, falso para un agente externo. Ahora `TarifaForm` recibe `organizationIdOverride` (lo pasa `AgenteTarifaForm` desde el contexto del agente) con error accionable si falta, y la función de base de datos acepta además al agente dueño de la tarifa mientras siga en borrador/rechazada, fijando su propio `agente_id` (no puede reasignarla). Se conserva la invalidación de `portalAgente.tarifas`.
- Proformas/Facturación (remate B9): el historial lateral de la proforma ya no dice "Facturada" cuando la única factura asociada está en borrador (`TimelineProforma` recibe las facturas y reutiliza `etiquetaProformaConvertida`), el badge del historial de proformas del embarque distingue borrador / "por timbrar" / emitida, y los agregados dicen "sin emitir" en vez de llamar "en borrador" a una factura por timbrar. Sin reescribir el evento histórico de conversión, importes, vínculos ni el candado anti-doble conversión.
- Pruebas: regresión mínima nueva (`cotizacionSinImportesPaso1`) conectada a la inicialización real del formulario. Pruebas no ejecutadas aquí; pendientes en GitHub Actions. Sólo se corrió `tsgo --noEmit`.


## [13.823.152] - 2026-09-05
- Embarques (remate B4): la conservación de cantidades al pasar a FCL ya no depende de que la lista de contenedores esté vacía. `domain/semillaContenedor.ts` agrega `conservarGeneralesEnContenedores` / `requiereConservarGenerales`, y `StepDatosRutaMaritimo` las usa al elegir FCL en cualquier orden (con o sin fila agregada antes), pasando peso/volumen/piezas a la primera fila sin acumular ni pisar cantidades reales. Para borradores reabiertos ya en FCL con filas en cero se muestra un aviso con acción explícita ("Pasar las cantidades al primer contenedor"): no hay efecto automático que reponga un cero puesto a propósito.
- Proformas/Facturación (remate B9): "Por timbrar" cuenta como preparación, no como emisión (`etiquetaCicloProforma.ts` con listas explícitas; un estado desconocido no se asume emitido). El paso 2 del flujo de facturación reporta generadas / facturadas / sin emitir a partir de las facturas reales, en lugar del estado comercial `facturada`, y el stepper del encabezado de la proforma se queda en "Aceptada" con matiz "Convertida a borrador / Convertida, por timbrar" hasta que exista factura emitida. Sin cambios en base de datos, enlaces, cobrado/pendiente ni en el candado anti-doble conversión.
- Pruebas: se agregaron regresiones mínimas de ambos recorridos (`semillaContenedor`, `etiquetaCicloProforma`, `documentoEstados`). Pruebas no ejecutadas aquí; pendientes en GitHub Actions.



## [13.823.151] - 2026-09-05
- Embarques (B4): al cambiar un embarque Marítimo a FCL, el primer contenedor se siembra con el peso/volumen/piezas ya capturados en Datos generales (`domain/semillaContenedor.ts`), en vez de nacer en 0/0/0 y dejar el resumen en cero. Con eso, el mapeo vuelve a respetar la suma de contenedores tal cual (incluido cero), de modo que corregir cantidades a cero sigue siendo posible de forma explícita.
- Cotizaciones (A1/A7): el paso 1 ya no fija siempre USD. Un borrador **sin importes** adopta la moneda de la oportunidad CRM vinculada (`monedaCrm` en el formulario + `monedaPaso1`); si ya hay conceptos capturados, la moneda persistida no se toca y el vínculo sigue guiando la recuperación. Reeditar conserva la moneda guardada y "Desvincular" limpia la moneda del CRM.
- Proformas y embarques (B9): se distingue "Convertida a borrador" de una factura fiscal emitida en el detalle de la proforma, en el historial de proformas del embarque y en el paso 3 del flujo de facturación (`lib/domain/etiquetaCicloProforma.ts`). No cambian estados en base de datos ni el candado anti-doble conversión.
- Portal del agente: crear/editar una tarifa invalida también el listado del portal (`portalAgente.tarifas`), así que la tabla y los contadores se actualizan sin recargar la página.
- Facturación: el encabezado del detalle usa `labelExpediente`, así el enlace "Exp.:" de una factura sin expediente muestra "Borrador xxxxxxxx" en vez de un enlace vacío.
- Verificación focalizada: pruebas nuevas (`semillaContenedor`, `etiquetaCicloProforma`, `monedaPaso1`) más suites de embarques/cotización/proformas/costeo (166 archivos, 1 222 pruebas), ESLint y `tsgo --noEmit` limpios. CI/RLS completos quedan a GitHub Actions.



## [13.823.150] - 2026-09-05
- Power of 10 (candado de 200 líneas, sin cambios de comportamiento): tipos de columnas de tarifas extraídos a `_sections/tarifasColumns.types.ts`, sección "Carta Garantía" del formulario de naviera a `NavieraCartaGarantiaFields.tsx` y tipos de automatizaciones CRM a `services/automatizacionesEtapa.types.ts`. Los diálogos de alta CRM consumen `useNuevoLeadSubmit` / `useNuevaOportunidadSubmit` desde su módulo directo.
- Higiene de candados: `CeldaMontoAnalitica` deja el `TableCell` en `Analitica.tsx` (regla de tablas sin `@/components/ui/table` fuera de allowlist) y `src/lib/date/mxDatetimeLocal.ts` queda declarado como primitiva de fechas en `eslint.config.js`.
- Verificación focalizada: suites de arquitectura/baseline (67 archivos) y CRM (157 archivos, 757 pruebas) en verde, ESLint y `tsgo --noEmit` limpios. CI/RLS completos quedan a GitHub Actions.



## [13.823.149] - 2026-09-05
- Landing pública (reestructura media): hero con un solo mensaje (se retiran la frase social duplicada y la franja de tres cifras que competían con los CTA); nueva sección "Antes y después" (Excel/WhatsApp vs. expediente único, sólo capacidades existentes); nuevo "Recorrido" con pestañas Cotización → Embarque → Cobro y maquetas con tokens del sistema; el bloque de precio sube justo después de "Cómo funciona"; seguridad se replantea como "Garantías" en lenguaje llano; Recursos incluye la guía de puertos de México (antes sólo enlazada desde el sitemap).
- SEO: `<title>`/descripción y `og:*` orientados a "software para agencias de carga en México" / "freight forwarder"; `/ayuda` agregada al sitemap; logo del pie con `loading="lazy"`. Sin testimonios, logotipos de clientes ni cifras inventadas.
- Verificación focalizada: pruebas nuevas de las secciones (`landingSeccionesNuevas.test.tsx`), suite de marketing, ESLint, `tsgo --noEmit` y build. CI/RLS completos quedan a GitHub Actions.



## [13.823.148] - 2026-09-05
- CI (`types-drift`): el normalizador de `types.ts` ignora los paréntesis opcionales de los helpers finales (`Tables`, `TablesInsert`, `Enums`, `CompositeTypes`), que cambian según la versión del generador de Supabase y no son drift de esquema.
- Base de datos: `supabase/schema/baseline.sql` regenerada desde migraciones (34 445 líneas, incluye prorrateo en centavos, `saldo_factura` con Borrador no terminal y `crm_intercambiar_orden_etapas`).
- Verificación focalizada: `local-verify.sh --only-schema` en verde (squash + 78 migraciones, candado service_role-only, verify_rls, integridad) y normalizador sin diferencias. CI/RLS completos quedan a GitHub Actions.



## [13.823.147] - 2026-09-12
- Auditoría física v13.823.143 (bloque YAGNI, 10 hallazgos): 1) y 9) el expediente usa el fallback canónico `labelExpediente` en la lista de embarques, en las columnas de proformas y en el detalle de proforma, con enlace a `/embarques/:id` cuando hay embarque vinculado (`PROFORMA_LISTA_SELECT` ahora trae `embarque_id`). 2) `getEstadoUnificado` considera facturada toda proforma con `factura_id`, así el contador "Por emitir" ya no incluye proformas ya facturadas; además los contadores de la bandeja se calculan sobre la misma base filtrada que la tabla. 3) `TarifaForm` reinicializa el formulario sólo al abrir el modal o cuando cambia el contenido real de `initial` (firma por contenido en lugar de identidad de objeto): un refetch del padre ya no borra la naviera seleccionada en el portal del agente. 4) `NavieraCondicionForm` deshabilita carta garantía, días libres, moneda y notas cuando no hay proveedor tipo "Naviera" vinculado, con nota explicativa (antes se podían capturar datos imposibles de guardar). 5) `arribos_mes` del dashboard se calcula sobre la CTE `activos`, que excluye Borrador (también en utilidad). 6) las tarifas con vigencia vencida ya no ofrecen "Aprobar" ni en los botones rápidos ni en el kebab; el menú indica actualizar la vigencia en Editar. 10) Mi día ya no afirma "Todos los leads nuevos están atendidos" cuando la siguiente mejor acción lista leads sin contactar.
- Sin cambio: 7) y 8) naviera y tipo de servicio se envían en el payload y los actualiza `actualizar_embarque_completo`; no fue reproducible en código, y ahora la edición de ruta marítima exige ambos campos antes de guardar (`validarRutaMaritimaRequerida`, regresa al paso 2).
- Base de datos: migración espejo `20260912000200_dashboard_arribos_excluye_borrador.sql` del cambio ya aplicado en vivo a `dashboard_summary_datos()`.
- Verificación focalizada: pruebas de tarifas/proformas/CRM afectadas, ESLint, `tsgo --noEmit` y build. CI/RLS completos quedan a GitHub Actions.

## [13.823.146] - 2026-09-05
- Sentry (bloque de ruido + 1 bug real): `useSidebarAlerts` exige además un `access_token` vigente (no sólo `user` en memoria) antes de consultar `sidebar_alert_counts` / `embarques_admin_pendientes_count`; con el token expirado PostgREST llamaba como `anon` y devolvía "permission denied for function embarques_admin_pendientes_count" (JAVASCRIPT-REACT-5X). Nueva clase `ReglaNegocioError` (`expected: true`) usada por el guard de vigencia de tarifas (-62) y por el bloqueo de cotización con monedas mezcladas (-61): la UI sigue mostrando el mismo mensaje, pero ya no se crean issues. Los códigos de dominio `LC_*` se reconocen como validación de negocio con cualquier ERRCODE (antes sólo con `P0001`, y `LC_CRM_MONEDA_INCOMPATIBLE` llega con `22023`, -60), en `reportCaughtError`, `queryErrorReporting` y el `beforeSend` de Sentry.
- Pruebas focalizadas: `reglaNegocio.test.ts` (error esperado, LC_* con 22023, error técnico 42501 sí se reporta) y `useSidebarAlerts.test.tsx` (usuario con token expirado no consulta). CI/RLS completos quedan a GitHub Actions.

## [13.823.145] - 2026-09-05
- Auditoría E2E embarque → proforma → factura (bloque YAGNI): 1) `StepDatosRuta` deja de renderizar la tarjeta duplicada "Contenedores (n)": la captura vive sólo en la sección "Contenedores *" del paso marítimo. 4) `totalesDesdeContenedores` ya no borra peso/volumen/piezas generales cuando las filas hijas están en ceros (usa la suma sólo si es > 0). 5) `useUpdateEmbarque` invalida el árbol singular `['embarque', id]`, así el resumen refleja los datos nuevos sin recargar ni volver a guardar. 6) `Borrador` sale de `ESTADOS_SIN_SALDO` (y de `public.saldo_factura`): una factura sin timbrar aparece pendiente por cobrar en lugar de "Cobrado = total". 7) el campo de tipo de cambio avisa que al guardar el sistema fija el TC DOF de la fecha de emisión. 8) un embarque en Borrador ya no puede generar ni aprobar proformas (banner + `canEdit`). 10) el contador de la bandeja de proformas usa el conteo del filtro activo, así "Mostrando 0 de 0" coincide con la tabla.
- Sin cambio: 2) y 3) naviera y BL Master se registran y persisten correctamente en el formulario y la RPC (`actualizar_embarque_completo` los actualiza); no fue reproducible en código. 9) el paso de proforma a "Facturada" al timbrar queda pendiente: hoy `facturada` significa "consumida por una factura viva" en bandejas, conversión y reversión, y cambiarlo requiere revisar esa máquina de estados completa.
- Base de datos: migración de `public.saldo_factura` (quita `Borrador` de los estados terminales), espejo de `supabase/schema/facturacion/saldo_factura.sql`.

## [13.823.144] - 2026-09-05
- Auditoría E2E cotización → embarque (bloque de 10 hallazgos, sin features nuevas): 1) al vincular un prospecto se muestra la moneda registrada en la oportunidad (badge en el chip + nota "captura los importes en esa moneda"), para no topar con "monedas distintas" después de capturar (`prospectoSearch` ahora trae `moneda`). 2) El copy de validación ya no menciona la opción retirada "Crear nuevo prospecto" (ahora indica cambiar el destinatario a "Cliente existente") y `handleDesvincular` limpia el aviso previo (`clearErrors` + `onLimpiarVinculoError`). 3) El alta de cliente ya invalidaba la lista (`queryKeys.clientes.all` es prefijo de `list`/`select`): sin cambio. 4) y 5) `WizardTotalsBar` toma costo, venta y margen de una sola fuente (el P&L de los costos capturados) y etiqueta "Venta (sin IVA)"; `ResumenTotalesCotizacion` rotula "Total USD (c/IVA)" cuando hay IVA en USD y el paso 2 lleva la nota "El IVA no forma parte del profit". 6) `sincronizarConceptosPaso2` escribe los conceptos de forma incondicional: al borrar todos los costos de una moneda ya no queda un concepto de venta huérfano que bloqueaba el paso 3 por monedas mezcladas. 8) y 9) en "Editar costos" la columna Venta es editable y las filas derivan la venta del `precio_venta` persistido (respaldo: match por nombre), y la tabla se re-deriva cuando cambian los datos guardados salvo mientras se edita, así "Sincronizar conceptos de venta" ya se refleja en la tabla y el P&L. 7) y 10) una cotización aceptada sin venta capturada ya no ofrece "Crear embarque": se explica que faltan los conceptos de venta con importe (Aceptar/Enviar ya estaban bloqueados con total 0).
- Pruebas focalizadas: `paso2Helpers.limpieza.test.ts` (limpieza de conceptos por moneda sin costos), `CotizacionDetalleAcciones.test.tsx` (aceptada en cero sin "Crear embarque" + mensaje) y `WizardTotalsBar.test.tsx` (venta MXN desde el P&L y etiqueta sin IVA). CI/RLS completos quedan a GitHub Actions.

## [13.823.143] - 2026-09-12
- Cotizaciones → Embarques (bloque de 4 hallazgos): 1) `CrearEmbarqueConRevalidacion` separa las fases: el `catch` de `revalidarTarifa` ya no abarca `crearEmbarqueBorradorConDecision`, así un fallo al crear el embarque conserva su mensaje real (lo notifica la mutation) y no muestra el aviso falso "No se pudo revalidar la tarifa"; sin toasts duplicados. 2) `RevalidarTarifaModal` pasa `busy={loading}` a `FormDialogShell`: durante la creación o la solicitud de re-aprobación se ignoran ESC, clic fuera y botón X, y el contenido queda `aria-busy`; al terminar cierra normal. 3) `CotizacionDetalleEmbarques` renderiza cada embarque vinculado como `Link` semántico (navegable con teclado, foco visible y `aria-label` "Abrir embarque <expediente> (<estado>)"), conservando ruta y apariencia. 4) `_crear_embarque_replicar_conceptos` reparte el costo entre contenedores por centavos con método del resto mayor (piso a todos + un centavo a los primeros `resto`, `ROUND` a 2 decimales): elimina las partes negativas del ajuste final (0.02 entre 4 daba 0.01/0.01/0.01/-0.01 y ahora da 0.00/0.00/0.01/0.01) y mantiene la suma exacta; casos BL y costos históricos intactos.
- Base de datos: migración `20260912000100_prorrateo_conceptos_costo_sin_negativos.sql` (espejo 1:1 de `supabase/schema/embarques/_crear_embarque_replicar_conceptos.sql`) aplicada; sin cambios de permisos (sigue `service_role` únicamente).
- Pruebas focalizadas: `supabase/tests/prorrateo_conceptos_costo_sin_negativos.sql` (0.02/4, 100.01/4 y BL, verificada en base con rollback), `RevalidarTarifaModal.test.tsx` (aria-busy y cierre bloqueado con operación en curso), `CotizacionDetalleEmbarques.test.tsx` (enlace enfocable, vacío y sin tarjeta) y `CrearEmbarqueConRevalidacion.fases.test.tsx` (fallo de creación sin aviso de revalidación; fallo de revalidación sin intentar crear).

## [13.823.142] - 2026-09-05
- CRM/Cotizaciones (bloque de auditoría, 3 hallazgos): 1) `sincronizarEtapaPorEstadoCotizacion` reescribía `fecha_cierre_real = hoyMx()` en cada resultado terminal; ahora lee la etapa y el cierre vigentes de la oportunidad y sólo fija la fecha cuando hay transición real de tipo, así una oportunidad ganada el 31/08 conserva su cierre al enviar otra alternativa en septiembre (etapa/probabilidad se siguen alineando; sin transición no se toca `valor_real`; 0 filas → no-op). 2) `handleCambiarEstado` ya no traga el fallo de sincronización CRM: el estado de la cotización queda guardado y se muestra la advertencia "Estado guardado; el CRM no se actualizó" con la indicación de revisar la oportunidad y volver a guardar, sin duplicar la mutación exitosa. 3) `PlantillasMensajeEditor` consume `isError`/`error`/`refetch` y muestra `ErrorStateInline` con Reintentar, reservando "Sin plantillas todavía" para consultas exitosas vacías (el servicio ya propagaba errores vía `unwrapOr`). Regresiones: `sincronizarEtapa.test.ts` (cierre preservado, transición real, RLS/inexistente), `useCotizacionDetalleHandlers.test.tsx` (fallo CRM con advertencia y éxito sin avisos) y `PlantillasMensajeEditor.estados.test.tsx` (error/vacío/datos).

## [13.823.141] - 2026-09-05
- Higiene de auditorías (sin cambios de producto): se pone en verde `scripts/run-audits-conditional.sh`. `audit:tests`: aserción explícita dentro de los dos `it` de `UnifiedFiltersBar.limpiarBusqueda.test.tsx` (las verificaciones vivían sólo en el helper), `rejects.toBeTruthy()` → `rejects.toMatchObject({ message: "rls" })` en `automatizacionesEtapa.test.ts`, y 7 títulos duplicados renombrados con su contexto (notas/comentarios/ICP, sheet/dialog de Convertir lead, criterio/lead completo/lead rápido/oportunidad rápida, lead/oportunidad al eliminar, contador de leads, orden de etapas) sin tocar el contenido de las pruebas ni la allowlist. `audit:manifest`: manifiesto de releases regenerado para la versión vigente. `audit:soft-delete`: baseline regenerada quitando `crm/services/etapas.ts` y `crm/services/lineage.ts`, ya corregidos.

## [13.823.140] - 2026-09-05
- CRM automatizaciones de etapa (fallo visible, sin rollback): `fetchEtapa`/`fetchOportunidad` convertían el error del backend en `null` y hacían no-op silencioso de todas las automatizaciones; ahora propagan el error (y `null` sólo significa "no existe"), de modo que `runAutomatizaciones` agrega el fallo. `useMoverEtapaConAutomatizacion` distingue el resultado devolviendo `automatizacionesOk` y avisa "Etapa actualizada; no se pudo completar el seguimiento automático" con "Revisa actividades" en la descripción, conservando `logger.warn`, el movimiento aplicado y las reglas de creación/cancelación. Regresiones: `useAutomatizacionesEtapa.warning.test.tsx` (movimiento exitoso + automatización fallida → warning y `automatizacionesOk:false`; todo exitoso → sin warning) y propagación de error en `fetchEtapa`.

## [13.823.139] - 2026-09-05
- CRM paneles secundarios (error vs vacío): `CrmForecastMesKpis` silenciaba errores de `useForecast` y pintaba la tira de KPIs en cero; ahora consume `isError`/`refetch` y muestra `ErrorStateInline` "No se pudo cargar el forecast del mes." con Reintentar, reservando los ceros para respuestas exitosas sin filas. `LeaderboardVendedores` y `Cliente360Panel` ya distinguían fallo de vacío; se blindan con regresión compartida `panelesSecundariosErrores.test.tsx` (los 3 paneles: error → reintento sin empty/ceros; éxito vacío → empty). Sin cambios de consultas, permisos ni cálculos.

## [13.823.138] - 2026-09-05
- CRM rutas (error vs vacío): regresión que blinda la distinción entre fallo y "sin datos" en pantallas de detalle y del resumen ejecutivo. La corrección ya existía: `EmbudoCard`/`ForecastMesCard` consumen `isError`/`refetch` y muestran `ErrorStateInline` con Reintentar (el empty sólo con éxito), y `OportunidadDetalle`/`LeadDetalle` separan "No se pudo cargar…" (con Reintentar) de "no encontrada/o" (sólo cuando la consulta respondió sin registro). Se agregan `crmDashboardCardsErrores.test.tsx` (embudo/forecast: error → reintento sin empty; éxito vacío → empty) y `detalleErrores.test.tsx` (ambos detalles: error → reintento sin "no encontrada"; éxito sin registro → "no encontrada"). Sin cambios de rutas, permisos ni métricas.

## [13.823.137] - 2026-09-05
- CRM Mi día (NBA/cotizaciones): regresión que blinda la distinción entre "Todo al día" y "no se pudo cargar". La corrección ya existía de punta a punta (`useNextBestActions` agrega `isError` de signals/cotizaciones/vencidas con reintento triple; `useCrmInicioVM` expone `nbaError`/`nbaRefetch` y `cotsError`/`cotsRefetch`; `NextBestActionsCard` y `CotizacionesSinRespuestaCard` muestran `ErrorStateInline` con Reintentar en lugar del empty). Se agrega `useNextBestActions.errores.test.tsx`: fallo de signals, de cotizaciones y de vencidas → `isError` sin items fingidos; refetch reintenta las tres; y ambas tarjetas muestran reintento sin empty cuando hay error (y sí el empty cuando la consulta fue exitosa). Sin cambios de lógica, reglas de prioridad ni umbrales.

## [13.823.136] - 2026-09-05
- CRM detector de duplicados: un fallo de la revisión RPC (RLS/red/timeout) ya no se ve como "sin coincidencias". Alta manual (`AvisoLeadDuplicado`): `useDuplicadoLead` ahora expone `isError`/`error`/`refetch` y el aviso muestra alerta no bloqueante "No pudimos comprobar duplicados" con Reintentar. CSV: la importación ya quedaba bloqueada con alerta y reintento; además el preview marca las filas "Sin revisar" en lugar de "Nuevo" cuando la revisión falló. Se conserva la omisión de duplicados exactos cuando la consulta funciona; no se tocó la RPC ni las reglas de coincidencia. Regresión: `duplicadosErrores.test.tsx` cubre error y éxito en ambos flujos.

## [13.823.135] - 2026-09-05
- CRM linaje (`useLineage` / `LineageCard`): regresión que blinda la distinción entre "sin datos" y "no se pudieron cargar". La corrección ya existía (`useOportunidadLineage` agrega `isError` de cotizaciones/embarques/lead y expone `refetch` de las tres; ambas tarjetas muestran `ErrorStateInline` con Reintentar y el empty sólo con éxito); se agrega prueba del hook que verifica agregación de error desde cualquiera de las 3 consultas y reintento triple, junto a las pruebas existentes de error vs lista vacía. Sin cambios de lógica ni del modelo de linaje.

## [13.823.134] - 2026-09-05
- CRM dashboard: regresión que blinda la propagación de errores en `fetchCrmDashboard`. La corrección ya existía (6 consultas pasan por `assertSinErrores` y la paginada de oportunidades abiertas lanza desde el paginador); se agregan pruebas que verifican que un fallo en una consulta de conteo o en la paginada rechaza la promesa (el tablero puede mostrar estado de error/reintento) y que sin error las métricas se conservan. Sin cambios de lógica.

## [13.823.133] - 2026-09-05
- CRM Next Best Actions (`nextBestActions.ts`): las actividades vencidas dentro de las últimas 24h ya no muestran la etiqueta ambigua "Vencida hace 0 días"; ahora se lee "Vencida hoy". Se conservan "Vencida hace N día(s)" para N>0, la prioridad, el orden y el cálculo de antigüedad. Regresión: etiquetas para 0, 1, varios días y fecha nula.

## [13.823.132] - 2026-09-05
- CRM umbrales "lead sin contactar": se centralizan en `domain/umbralesContacto.ts` (`NBA_LEAD_SIN_CONTACTAR_HORAS=24` para las sugerencias de Mi día y `SEMANA_LEAD_SIN_CONTACTAR_DIAS=7` para la tarjeta semanal). Sin cambio de reglas: la FAQ de ayuda y la tarjeta ahora explican ambos umbrales explícitamente (la FAQ decía incorrectamente "3 días"). Regresión: textos de ayuda verificados contra las constantes.

## [13.823.131] - 2026-09-05
- CRM soft-delete de etapas en KPIs/forecast: `dashboard.ts` filtra `crm_etapas_pipeline.deleted_at IS NULL` en los joins de oportunidades abiertas (pipeline/KPI y tarjeta "Cerrando esta semana") y `fetchEtapaTipos` (`forecast.ts`) ignora etapas eliminadas. Una oportunidad ligada a una etapa borrada ya no suma como abierta ni ganada, y las etapas activas conservan su comportamiento. Regresión: filtros de join, `fetchEtapaTipos` y forecast con etapa archivada.

## [13.823.130] - 2026-09-05
- CRM ranking de vendedores (`leaderboard.ts` / `useLeaderboardVendedores`): el rango mensual ahora convierte el inicio/fin del mes a ISO UTC con `mxLocalToUtcIso` antes de consultar `crm_oportunidades`, y se añade explícito `.not("fecha_cierre_real", "is", null)`. El límite superior exclusivo (`lt`) evita que cierres de meses posteriores se sumen al leaderboard. Las etapas borradas ya se filtran (`is deleted_at null`) al clasificar oportunidades. Regresiones: mes en curso estable en frontera UTC/CDMX, filtro anti-nulo y exclusión de etapas archivadas.

## [13.823.129] - 2026-09-05
- CRM cancelar en modales de alta (`NuevoLeadDialog` e `ImportarLeadsCsvDialog`): el botón Cancelar ahora usa el mismo handler de cierre que Escape/X, por lo que al descartar el diálogo también se ejecuta el `reset` del formulario/importador. En `NuevoLeadDialog` se conserva la confirmación de descarte cuando hay datos capturados; en `ImportarLeadsCsvDialog` se limpian archivo y preview. Regresión: escribir/cargar datos, cancelar, reabrir y verificar estado vacío.

## [13.823.128] - 2026-09-05
- CRM ConvertirLeadDialog / ConvertirLeadSheet: el borrador se reinicializa mediante efecto cuando cambia `lead.id` (incluido al montar), evitando que al navegar entre fichas de lead queden el nombre, monto, moneda o cliente del lead anterior. Se conservan validaciones, guard anti doble envío y flujo de conversión. Regresión: cambiar de lead A a lead B no arrastra valores editados.

## [13.823.127] - 2026-09-05
- CRM ranking de vendedores (`useLeaderboardVendedores`): el mes en curso ya se calculaba con los helpers centrales `ymMx()`/`primerDiaMesMx()` (calendario America/Mexico_City) y se conserva la firma del servicio; se agregó la regresión faltante de borde de mes (31/ago 22:00 CDMX sigue en agosto con inicio 2026-08-01; el día 1 real cambia a septiembre), verificada en TZ UTC y America/Mexico_City.

## [13.823.126] - 2026-09-05
- CRM higiene (`HigieneTabla`): cada fila de oportunidad se volvió accesible reutilizando `useDrilldownRow` (`role="link"`, `tabIndex=0`, Enter/Espacio, anillo de foco y Ctrl/clic medio), conservando el click y el destino actuales sin cambiar columnas ni estilos. Regresión de teclado: Enter, Espacio y click navegan al detalle.

## [13.823.125] - 2026-09-05
- CRM presupuesto (`PresupuestoCrmEditor`): el año inicial del selector se toma del calendario de negocio MX (`ymMx()`) en vez de `new Date().getFullYear()`, evitando que el 31 de diciembre por la noche en CDMX se abra ya el año siguiente. Los cambios manuales del usuario se conservan. Regresión en frontera 31 dic / 1 ene.

## [13.823.124] - 2026-09-05
- CRM consistencia de calendario MX (sin cambios de reglas de negocio, sólo la zona de cálculo):
  - `autoRegistroContacto.fechaSeguimientoContacto` suma los días con `mxAddDaysIso` (calendario CDMX, conservando la hora local) en vez de `setDate()` + `toISOString()`; `DIAS_SEGUIMIENTO_CONTACTO=2` intacto.
  - `cotizacionesSinRespuesta`: el corte se calcula con `mxAddDaysIso` y el contador con `diffDiasMx`, por lo que `diasUmbral`, estado "Enviada", filtro soft-delete y límites se conservan pero ya no dependen del huso del navegador.
  - `routes/Higiene.tsx` obtiene año y mes de negocio con `ymMx()`, así el presupuesto del mes no cambia cerca de medianoche.
  - `domain/oportunidades/vistasGuardadas.ts` genera `cierreDesde`/`cierreHasta` de "Cierra este mes" con `primerDiaMesMx`/`ultimoDiaMesMx`, manteniendo la API y el formato `yyyy-MM-dd`.
  - Regresiones nuevas en frontera de mes y husos UTC vs America/Mexico_City.

## [13.823.123] - 2026-09-05
- CRM oportunidad (`OportunidadCotizacionesList`): la antigüedad de una cotización enviada se calcula ahora con `diffDiasMx` (calendario America/Mexico_City) en vez de `diffDiasCalendario` contra el reloj local, así la etiqueta "Sin respuesta · Nd" es estable cerca de medianoche para usuarios en otras zonas. Se conservan el umbral > 5 días y el formato existente. Regresión: conteo CDMX vs UTC y umbral respetado.

## [13.823.122] - 2026-09-05
- CRM alta express de actividad (`QuickCreateActividadDialog`): la fecha default se recalcula en cada apertura del modal (transición cerrado → abierto) cuando el usuario no ha capturado fecha, evitando que un `QuickAddMenu` montado durante horas o tras un cambio de día muestre un default viejo. Si el usuario editó la fecha durante la apertura, se conserva. Se mantienen el reset al cerrar, el `isDirty` y la validación de fecha. Regresiones: cambio de día simulado antes de abrir y fecha capturada no sobrescrita.

## [13.823.121] - 2026-09-05
- CRM Kanban (`useMoverOportunidadEtapa`): ya no se ofrece "Deshacer" cuando el destino ejecuta una tarea automática — etapa tipo ganada ("Generar cotización en firme") o etapa abierta con `crea_tarea_seguimiento` ("Seguimiento: …") — igual que ya ocurría con las etapas perdidas. Antes, al deshacer volvía la etapa pero la tarea automática quedaba viva contradiciendo la etapa anterior. Se conserva el Deshacer en transiciones sin tareas automáticas y no se borra ninguna actividad existente. Nuevos helpers puros `destinoGeneraTareaAutomatica` y `puedeOfrecerUndo` + regresiones para ganada, abierta con seguimiento y transición ordinaria.

## [13.823.120] - 2026-09-05
- CRM trazabilidad (`src/features/crm/services/lineage.ts`): `fetchLeadResumen` ahora filtra `deleted_at IS NULL`, igual que `getLead` y los listados. Un lead archivado ya no aparece como "Lead de origen" en el detalle de oportunidad; la oportunidad se muestra con su estado actual y sin origen visible, sin borrar historial ni alterar otras relaciones. Regresiones: filtro de vivos aplicado y lead archivado devuelto como sin origen.

## [13.823.119] - 2026-09-05
- CRM automatizaciones de etapa (`src/features/crm/services/automatizacionesEtapa.ts`): `cancelarActividadesPerdida` ahora filtra también `deleted_at IS NULL`, de modo que una actividad archivada ya no puede marcarse como completada al perder la oportunidad; las tareas activas se cierran igual que antes.
- El helper local `isoDaysFromNow` dejó de usar `new Date().setDate()` + `toISOString()` y delega en el helper canónico `mxAddDaysIso` (calendario America/Mexico_City), conservando la misma regla de días y la hora local. Regresiones: actividad archivada intacta y fecha programada estable cerca de medianoche UTC vs CDMX.

## [13.823.118] - 2026-09-05
- CRM zona horaria (cierre del hallazgo): `isoDaysFromNow` (`src/features/crm/domain/dashboardAggregates.ts`) ya no hace `new Date().setDate()` + `isoUtcDay`; delega en el helper canónico `todayLocalISOPlus` (calendario America/Mexico_City) y acepta una fecha base inyectable para pruebas. Así el límite de 7 días de "Cerrando esta semana" es estable cerca de medianoche sin duplicar helpers. Regresiones con el navegador en UTC y en America/Mexico_City, incluido el cruce de fin de mes.

## [13.823.117] - 2026-09-05
- CRM QuickCreateLeadDialog: `empresaTouched` ahora se resetea junto con los campos cuando el modal se cierra de verdad (transición `open` true → false). Antes, al volver a abrir el diálogo seguía mostrándose inmediatamente "Indica la empresa para continuar.", aunque el usuario no hubiera interactuado. Se conservan la validación al blur/submit y el guard anti doble envío. Regresión: blur vacío, cerrar, reabrir y verificar que el error no aparece hasta una nueva interacción.

## [13.823.116] - 2026-09-05
- CRM altas express: "Más campos →" ya no pierde lo capturado. `QuickCreateActividadDialog` entrega un borrador mínimo (`asunto`, `entidadId`, `tipo: "tarea"`, `fecha`) y `QuickCreateLeadDialog` entrega `empresa` + `contacto`; `QuickAddMenu` los conserva mientras el formulario completo está abierto y los limpia al cerrarlo (mismo patrón ya usado para oportunidad). `NuevaActividadDialog` acepta `asuntoInicial` / `fechaInicial` / `entidadIdInicial` y `NuevoLeadDialog` acepta `draftInicial`, mapeando el contacto al campo canónico (`email` o `telefono`) con `esCorreoCapturado`, sin inventar datos. Se conservan el reset al cerrar, el guard anti doble envío y el flujo de creación rápida. Regresiones: capturar valores, pulsar "Más campos" y verificar que se conservan (correo vs teléfono incluidos) y que sin borrador el formulario sigue abriendo vacío.

## [13.823.115] - 2026-09-05
- CRM zona horaria (Mi día / dashboard): las lecturas y etiquetas de "hoy" ya no usan el reloj del navegador. `fetchCrmDashboard` (`src/features/crm/services/dashboard.ts`) acota "Mis actividades de hoy" y "Leads sin contactar" con `limitesDiaMx` y `mxAddDaysIso` en lugar de `setHours`/`setDate` locales; `esVencida`/`esHoy` (`proximasActividades.ts`) y `formatProx` (`proximaActividadLabel.ts`) comparan con `diffDiasMx` (calendario America/Mexico_City); `ActividadesHoyCard` formatea la hora con `timeZone: TZ_MX`. Nuevos helpers puros en `src/lib/date/mx.ts`: `diaMx`, `limitesDiaMx`, `diffDiasMx`. Sin cambios en reglas de negocio ni en nombres de tarjetas; el encabezado de `MiDia` ya usaba `formatFechaLarga` con TZ_MX. Regresiones cerca de medianoche con el navegador en UTC y en America/Mexico_City.

## [13.823.114] - 2026-09-05
- CRM Actividades: `posponerActividad` (`src/features/crm/services/actividadesMutations.ts`) ya no usa `new Date(...).setDate()` + `toISOString()`, que sumaba 24 h del reloj del navegador y desplazaba la hora vista por el usuario fuera de CDMX. La suma se centralizó en `mxAddDaysIso` (`src/lib/date/mx.ts`), que suma días en el calendario America/Mexico_City y conserva la hora local mexicana (más `utcIsoToMxLocal`, inverso de `mxLocalToUtcIso`). No cambia la regla de días del botón de posponer. Regresiones con navegador en UTC, America/Mexico_City y Asia/Tokyo, incluyendo hora cercana a medianoche, sin fecha programada y días negativos.
- Nota: el filtro de soft-delete en `fetchEtapasPipelineActivas` / `fetchEtapasPipelineTodas` ya quedó aplicado en 13.823.113.

## [13.823.113] - 2026-09-05
- CRM Etapas: `fetchEtapasPipelineActivas` y `fetchEtapasPipelineTodas` (`src/features/crm/services/etapas.ts`) ahora aplican el filtro canónico `.is("deleted_at", null)`. Antes una etapa soft-deleted por migración/administración podía seguir apareciendo en selectores, Kanban y configuración, porque la lectura activa sólo miraba `activa = true`. Sin cambios en la RPC de reordenar ni en la visibilidad de etapas inactivas en configuración. Regresiones: ambas lecturas excluyen etapas eliminadas y las inactivas siguen listándose.

## [13.823.112] - 2026-09-05
- CRM Configuración: en `EtapasPipelineEditor` el merge de borradores ahora es por campo para `orden`. Una fila con cambios sin guardar conserva su borrador, pero adopta siempre el `orden` confirmado por el backend (sólo lo cambia la RPC de reordenar, nunca la edición inline). Antes, editar una fila y luego moverla hacía que al guardar se reenviara el orden anterior y se revirtiera el reordenamiento. Sin cambios en la RPC ni pérdida de ediciones. Regresión: editar + mover + refetch + guardar conserva el nombre editado y envía el orden nuevo.

## [13.823.111] - 2026-09-05
- CRM zona horaria: centralizada la conversión hora CDMX → UTC en `mxLocalToUtcIso` (`src/lib/date/mx.ts`), helper puro basado en `Intl` con doble pasada para horario de verano. `NuevaOportunidadDialog`, `NuevoLeadDialog`, `QuickCreateActividadDialog` y `NuevaActividadDialog` ya no usan `new Date(valor).toISOString()`, que interpretaba el texto del `DateTimePickerMx` con la zona del navegador y desplazaba la hora persistida en equipos fuera de CDMX. Se conservan valores vacíos como `null`, el formato visible y la regla de días hábiles (`actividadDefaultFechaMx`). Regresiones con TZ distinta a CDMX (UTC, Asia/Tokyo, America/Los_Angeles, Europe/Madrid).

## [13.823.110] - 2026-09-05
- CRM Lead Detalle: eliminada la redundancia visual en la ficha de prospecto. `LeadLineageCard` ahora se renderiza sólo cuando el lead NO es prospecto; para prospectos se mantiene `OportunidadesDelProspecto` (con su CTA de nueva oportunidad). Así no se duplican las mismas oportunidades en la pantalla. Se conservan la trazabilidad para leads no prospecto, permisos, queries y navegación. Regresión: una sola tarjeta para prospectos y `LeadLineageCard` para los demás estados.
- CRM Lead Linaje: `LeadLineageCard` formatea la fecha estimada de cierre con `formatFechaDia` (canónico dd/MM/yyyy) en lugar de concatenar el ISO crudo; mantiene `—` cuando el valor es nulo. Sin cambios en la query ni en el enlace de la tarjeta. Regresión: rechazo de ISO crudo y fallback nulo.

## [13.823.109] - 2026-09-05
- CRM Configuración: en `EtapasPipelineEditor.tsx` el botón de guardar por fila ahora tiene un `aria-label` dinámico (`Guardar cambios de ${d.nombre}`), ya que antes sólo mostraba el icono `Save` sin nombre accesible. Se conservan los estados `disabled` y `loading`.
- Layout: en `SidebarMenuItemBlock.tsx` el `aria-label` del badge de alertas ahora pluraliza correctamente (`1 alerta`, `2 alertas`), igual que el tooltip, en lugar de usar siempre "alertas". Regresiones de accesibilidad para ambos casos.

## [13.823.108] - 2026-09-05
- CRM: eliminados dos avisos de error duplicados. En `ActividadNotasSheet.tsx` se removió el `crmToast.error` del `catch` porque `useActualizarActividadNotas` ya notifica en `onError`. En `LeadIcpCard.tsx` se removió el `notifyError` local del `catch` porque `useActualizarLead` ya notifica en `onError`. Se conservan los toasts de éxito, el cierre del Sheet, el reset derivado, el estado disabled/loading y el patch ICP. Regresiones: un solo feedback visible al fallar guardar notas de actividad y guardar perfil ICP.

## [13.823.107] - 2026-09-05
- CRM: eliminados los avisos de error duplicados en `useOportunidadDetalleActions.ts`. Se removió el `notifyError` local de `handleEliminar` (useEliminarOportunidad ya notifica en `onError`) y de `crearCotizacion` (useCrearCotizacionDesdeOportunidad ya notifica en `onError` y conserva su reintento idempotente). Se mantienen la navegación tras eliminar/crear, el toast de éxito con folio y el `notifyInfo` cuando existe `avisoEtapa`. Regresiones: un solo feedback visible al fallar eliminar o crear cotización, más los caminos de éxito.

## [13.823.106] - 2026-09-05
- CRM: eliminados dos avisos de error duplicados restantes. En `ComentariosOportunidad.tsx` se removió el `notifyError` local del `catch` porque `useCrearComentarioOportunidad` ya notifica en `onError`. En `useLeadDetalleAcciones.ts` se removieron los `notifyError` de `handleSave`/`handleDelete` porque `useActualizarLead` y `useEliminarLead` ya notifican en `onError`. Se conservan toasts de éxito, navegación tras eliminar, validación de correo, gate Lead→Prospecto y los catches vacíos que evitan promesas rechazadas sin capturar. Regresiones: un solo feedback visible al fallar publicar comentario, guardar lead y eliminar lead.

## [13.823.105] - 2026-09-05
- CRM: la tarea automática de seguimiento al crear una oportunidad (`NuevaOportunidadDialog.crearActividadSeguimiento`) ya no calcula "mañana 9:00" con el reloj local del navegador; ahora usa la regla centralizada `actividadDefaultFechaMx` (calendario CDMX con salto al siguiente día hábil) y la convierte a ISO, igual que el alta de lead. Así la tarea nunca cae en sábado/domingo. Se conserva la mutación silenciosa, el aviso específico cuando la actividad falla y no se alteran fechas de oportunidades existentes. Regresiones: viernes por la tarde, sábado y independencia del reloj local.
- CRM: la etiqueta de la casilla en `OportunidadFormFields.tsx` ahora dice "Crear actividad de seguimiento (tarea, próximo día hábil 9:00)" para no prometer "mañana". Sin cambios en la opción por defecto ni en la accesibilidad (`htmlFor`/`id`).

## [13.823.104] - 2026-09-05
- CRM Configuración: en `EtapasPipelineEditor` un refetch (por ejemplo tras guardar otra fila) ya no borra los cambios sin guardar de las demás filas. El nuevo merge (`etapasPipelineDraft.ts`) conserva el borrador local de cada fila sucia, rehidrata sólo las filas limpias, permite que la fila guardada adopte el valor confirmado y descarta borradores de filas eliminadas. Sin cambios en el RPC ni en el ordenamiento. Regresiones: editar A + refetch de B conserva A; rehidratación de filas limpias y descarte de filas inexistentes.

## [13.823.103] - 2026-09-05
- CRM: en `OportunidadResumenTab.tsx` los campos `fecha_estimada_cierre`, `fecha_meta_cierre` y `monto_meta` ahora se formatean con los formateadores canónicos (`formatFechaDia` y `formatCurrencyCompact` con `op.moneda`) antes de pasarse a `DatosComercialesCard`, evitando que el detalle muestre ISO crudo o números sin moneda/separadores. Se conserva el fallback `—` para valores nulos y no se modifican los valores persistidos enviados al backend. Regresión visual contra renderizado de ISO/número crudo.

## [13.823.102] - 2026-09-05
- CRM: eliminados dos avisos de error duplicados adicionales. En `useQuickCreateOportunidad.ts` se removió el `notifyError` del `catch` de `submit` porque `useCrearOportunidad` ya notifica en `onError`. En `CriteriosEtapaEditor.tsx` se removió el `notifyError` del `catch` de `handleAgregar` porque `useCrearCriterioEtapa` ya notifica en `onError`. Se conservan validaciones locales, guard anti doble submit, limpieza, éxito local "Criterio agregado" y el comportamiento exitoso. Regresiones: un solo feedback visible al fallar la creación en ambos flujos.

## [13.823.101] - 2026-09-05
- CRM Leads: al crear un lead y fallar ya no aparecen dos avisos de error; se eliminó el `notifyError` duplicado en los `catch` de `QuickCreateLeadDialog` y `NuevoLeadDialog` porque `useCrearLead` ya notifica en `onError`. Se conservan el guard anti doble submit, el cierre/reset y el aviso específico cuando el lead sí se crea pero falla la tarea automática (mutación silenciosa). Regresiones: un solo feedback visible al fallar la creación en ambos diálogos, y aviso específico de actividad automática intacto.

## [13.823.100] - 2026-09-05
- CRM Prospectos: cambiar el estado desde la tabla (`EstadoCell` en `leadsColumns.tsx`) ya no muestra dos errores para una sola acción; se eliminó el `notifyError` local porque `useActualizarLead` ya notifica en `onError`. Se conservan `stopPropagation` y el selector deshabilitado mientras procesa. Regresión: mutación fallida = un solo feedback.

## [13.823.99] - 2026-09-05
- CRM/Mi día: `CerrandoSemanaCard` ya no muestra la fecha técnica ISO de `fecha_estimada_cierre`; ahora usa `formatFechaEs` y muestra "Sin fecha" cuando el valor es nulo, evitando el separador suelto. Regresiones: fecha formateada en español y fallback nulo.

## [13.823.98] - 2026-09-05
- CRM Kanban: el CTA "Nueva oportunidad" de una columna vacía ahora pasa el id de SU etapa (`onNuevo(etapaId)`) y `NuevaOportunidadDialog`/`useOportunidadForm` la prefijan como etapa inicial — antes la oportunidad nacía siempre en la primera etapa abierta, no en la columna pulsada. La prefijada sólo se respeta si la etapa existe y es abierta: Ganada/Perdida siguen sin CTA y nunca se prefijan; si las etapas llegan tarde, la hidratación tardía usa la etapa de la columna. Sin cambios en drag & drop. Regresiones: CTA pasa el id de su etapa, etapas terminales sin CTA, y prefijado/ignorado en el formulario.

## [13.823.97] - 2026-09-05
- CRM/configuración: `actualizarCriterioEtapa`, `eliminarCriterioEtapa`, `actualizarPlantilla` y `eliminarPlantilla` ahora exigen la fila afectada (`update(...).select("id").maybeSingle()`); si RLS, un soft-delete o un id inexistente dejan 0 filas, lanzan un error accionable y no registran bitácora ni muestran "Guardado" de un cambio que nunca ocurrió. Las eliminaciones siguen siendo soft-delete. Regresiones: 0 filas sin bitácora y éxito con bitácora única para cada servicio.

## [13.823.96] - 2026-09-05
- CRM/configuración: `actualizarMotivoPerdida` ahora exige la fila afectada (`update(...).select("id").maybeSingle()`); si RLS, un soft-delete o un id inexistente dejan 0 filas, lanza un error accionable y no registra bitácora ni muestra "Motivo actualizado" de un cambio que nunca ocurrió (mismo patrón que `actualizarEtapa`). Regresiones: 0 filas sin bitácora y éxito con bitácora única.

## [13.823.95] - 2026-09-05
- CRM/configuración: `actualizarEtapa` exige la fila afectada (`update(...).select("id").maybeSingle()`); si RLS, un soft-delete o un id inexistente dejan 0 filas actualizadas, ahora lanza un error accionable y no registra bitácora ni muestra "Etapa actualizada" de un cambio que nunca ocurrió (mismo patrón que `actualizarOportunidadFilas`). La RPC de intercambio de orden no cambia. Regresiones: fila inexistente/RLS sin bitácora y éxito con bitácora única.

## [13.823.94] - 2026-09-05
- CRM/Mi día: las mutaciones de leads y oportunidades (crear, actualizar, eliminar, tomar, calificar, convertir, lotes), crear cotización desde oportunidad y mover etapa con automatizaciones ahora invalidan `crm.nba-signals`, para que "Qué hacer ahora" no conserve recomendaciones obsoletas hasta 60s. Sin cambios en el scoring ni polling.

## [Unreleased]

## [13.823.93] - 2026-09-05

### CRM — Cotizaciones sin respuesta: invalidación del límite correcto
- `useCrearCotizacionDesdeOportunidad` invalidaba sólo la key `(5, 10)` de "Cotizaciones sin respuesta", pero el tablero (`useCrmInicioVM`) consulta con `(5, 5)`; la tarjeta quedaba stale hasta 60s. Ahora se invalidan ambas keys `(5, 5)` y `(5, 10)`, que tienen consumidores reales (tablero y "Next best actions").
- Regresión actualizada para verificar específicamente la key con límite 5, además de la de límite 10.

## [13.823.92] - 2026-09-05

### CRM — Borrador de conversión de lead reiniciado por lead
- `ConvertirLeadDialog` y `ConvertirLeadSheet` reinician nombre, monto, moneda, fecha (Dialog) y cliente sólo cuando cambia `lead.id` (patrón de ajuste de estado durante el render), evitando convertir el lead B con datos capturados para el lead A; la edición se conserva mientras el mismo lead sigue abierto y se respeta `cliente_convertido_id`/`SIN_CLIENTE`.
- Regresiones: reinicio al cambiar de lead, conservación con el mismo lead y lead ya convertido (10 pruebas en ambos componentes).

## [13.823.91] - 2026-09-05

### CRM — Orden de etapas del pipeline sin duplicados
- Nueva RPC `crm_intercambiar_orden_etapas` (SECURITY INVOKER, `FOR UPDATE` por id) que intercambia el `orden` entre dos etapas de la misma organización en una sola transacción.
- `EtapasPipelineEditor` ahora intercambia con la etapa vecina en lugar de sumar ±1 al orden propio (lo que creaba órdenes duplicados); las flechas se deshabilitan en el primer/último elemento y durante la mutación (doble clic).
- `useIntercambiarOrdenEtapas` invalida `crm.etapas.all` y `crm.etapas.todas`.
- Regresiones: subir, bajar, límites, bloqueo por concurrencia y RPC única en el servicio.

## [13.823.90] - 2026-09-05

### CRM — Limpieza de feedback duplicado en editor de plantillas
- `PlantillasMensajeEditor.handleCrear` ya no emite `notifySuccess`/`notifyError` tras llamar a `useCrearPlantilla.mutateAsync`; el hook conserva el único aviso de éxito/error. Se mantiene la validación local de campos obligatorios y el reset del formulario sólo tras éxito.

## [13.823.89] - 2026-09-05

### Sentry — triage y corrección de ruido (5Z, 5Y, 5S, 5V, 1D)
- `useCrmHotkeys`: guarda ante keydown sin `key` (autocompletado/IME) — corrige `JAVASCRIPT-REACT-5Z`.
- Filtros nuevos en `shouldReportToSentry`: reglas de negocio esperadas `LC_COT_TRANSICION_INVALIDA` y `LC_CONFLICTO_CONCURRENCIA` (5Y, 5S) y `CfdiUploadError` en fases de red del dispositivo `preflight`/`request` (5V, 1D); la fase `response` sigue reportándose.
- Regresiones: `appFeedback.sentry.filtros.test.ts` y `useCrmHotkeys.test.tsx`.

## [13.823.88] - 2026-09-04

### Higiene Power of 10 — archivos productivos ≤ 200 líneas
- `NuevaActividadDialog` extrae `nuevaActividad/SelectorEntidadActividad.tsx`; `usePermissions` y `NuevaOportunidadDialog` compactados sin cambio de comportamiento.
- `architecture-baseline` vuelve a verde en CI Fast.

## [13.823.87] - 2026-09-04

### CRM — Un solo aviso por acción (completar/posponer, convertir, eliminar lead, etapas)
- `ActividadRowActions`, `ConvertirLeadDialog`, `EtapasPipelineEditor` y `useLeadDetalleAcciones` ya no repiten el toast que emiten sus hooks de mutación; `NuevaOportunidadDialog` deja el error de guardado al hook.
- `ConvertirLeadSheet` conserva su aviso accionable ("Abrir oportunidad") y silencia el del hook vía `silencioso: true`.
- Nueva regresión `feedbackUnicoAcciones.test.ts`.

## [13.823.86] - 2026-09-04

### CRM — Un solo aviso de éxito en altas de lead y oportunidad
- Los modales `NuevoLeadDialog`, `QuickCreateLeadDialog`, `NuevaOportunidadDialog` y el hook `useQuickCreateOportunidad` ya no emiten su propio toast de creación; la capa responsable es el hook de mutación (`useCrearLead` / `useCrearOportunidad`), que conserva el aviso de actividad automática y los mensajes de error.
- Se mantiene el aviso "Oportunidad actualizada" en edición y el comportamiento de actividades sin cambios.
- Nueva regresión `altasToastUnico.test.ts` que garantiza un único aviso por alta (modal completo y rápido).



## [13.823.85] - 2026-09-04

### CRM — Toast único al eliminar oportunidad y cobertura de regresión para acciones de detalle
- `useEliminarOportunidad` ya no emite un toast de éxito propio en `onSuccess`; el feedback queda en `useOportunidadDetalleActions.handleEliminar`, evitando un aviso duplicado. Se conservan la invalidación de listas, higiene, KPIs y dashboard, el soft-delete y el manejo de errores.
- `useOportunidadDetalleActions.toast.test.tsx` ahora cubre tanto la creación de cotización como la eliminación de oportunidad, asegurando un único toast y la navegación correcta en cada flujo.
- `useOportunidades.invalidacion.test.tsx` verifica que `useEliminarOportunidad` no emita `notifySuccess`, cerrando la puerta al doble toast desde el hook.

## [13.823.84] - 2026-09-04

### CRM — Toast único al crear cotización desde oportunidad
- `useCrearCotizacionDesdeOportunidad` ya no emite un toast de éxito propio en `onSuccess`; la notificación queda en `useOportunidadDetalleActions`, con el folio y la navegación, para evitar un aviso duplicado.
- `useOportunidadDetalleActions` muestra un toast informativo cuando la cotización se creó pero la etapa de la oportunidad no pudo actualizarse, conservando el aviso especial sin generar un doble toast.
- Nuevas regresiones: `useOportunidadDetalleActions.toast.test.tsx` garantiza un único toast en el flujo normal y en el caso de etapa no actualizada; `useCrearCotizacionDesdeOportunidad.invalidacion.test.tsx` ahora verifica que el hook no emita toast de éxito.


## [13.823.83] - 2026-09-05

### CRM — Refresco de Prospectos tras mutaciones de leads
- `useActualizarLead`, `useEliminarLead`, `useCalificarProspecto` y `useConvertirLead` ahora invalidan `queryKeys.crm.prospectos.all` tras éxito. Como `/crm/prospectos` consume `crm.prospectos.paged`, y la invalidación por prefijo cubre ese árbol, las filas de Prospectos dejan de quedar obsoletas tras cambiar estado, calificar, convertir o eliminar un lead.
- Actualizadas las regresiones existentes (`leadsMutaciones.invalidacion.test.tsx` y `useConvertirLead.test.tsx`) para exigir la nueva invalidación.

## [13.823.82] - 2026-09-05

### CRM — Pipeline: refresco del editor de etapas tras editar/mover
- `useActualizarEtapa` ahora invalida `queryKeys.crm.etapas.todas` además de `queryKeys.crm.etapas.all`. `useEtapasPipelineAll` (usada por `EtapasPipelineEditor.tsx`) lee `etapas.todas`; antes, tras guardar o reordenar una etapa, el editor conservaba datos viejos hasta recargar y las flechas parecían no-op.
- Nueva regresión `useEtapasPipeline.invalidacion.test.tsx` que verifica ambas invalidaciones.

## [13.823.81] - 2026-09-05

### CRM — Dashboard y "Cotizaciones sin respuesta" actualizados al crear cotización desde oportunidad
- `useCrearCotizacionDesdeOportunidad` ahora invalida `crm.dashboardAll` y `crm.cotizacionesSinRespuesta` tras crear la cotización y mover la oportunidad a la etapa Cotizando. Antes el resumen ejecutivo y la tarjeta "Cotizaciones sin respuesta" podían mostrar la etapa anterior u omitir la nueva cotización hasta vencer el `staleTime` de 60s.
- Nueva regresión `useCrearCotizacionDesdeOportunidad.invalidacion.test.tsx` que verifica la invalidación de ambas query keys y conserva la protección contra duplicados cuando falla el movimiento de etapa.

## [13.823.80] - 2026-09-05

### CRM — Dashboard actualizado al editar, eliminar, tomar o calificar leads
- `useActualizarLead`, `useEliminarLead`, `useTomarLead` y `useCalificarProspecto` ahora invalidan `crm.dashboardAll`, igual que `useCrearLead`. Antes el resumen ejecutivo (leads en cartera, embudo, sin contactar) quedaba stale hasta vencer el `staleTime` de 60s.
- Nueva regresión `leadsMutaciones.invalidacion.test.tsx` con las cuatro mutaciones.

## [13.823.79] - 2026-09-05

### CRM — Dashboard actualizado al editar o eliminar oportunidades
- `useActualizarOportunidad` y `useEliminarOportunidad` ahora invalidan `crm.dashboardAll`; eliminar también invalida `crm.kpis`. Antes el resumen ejecutivo (KPIs, forecast, embudo) quedaba con valores viejos hasta vencer el `staleTime` de 60s.
- Nueva regresión `useOportunidades.invalidacion.test.tsx` para actualizar y eliminar.

## [13.823.78] - 2026-09-05

### CRM — Invalidación del dashboard tras crear actividad
- `useCrearActividad` ahora invalida `crm.dashboardAll` tras una creación exitosa, alineándose con `useCompletarActividad` y `usePosponerActividad`. Antes el resumen ejecutivo/Mi día podía quedar stale hasta vencer el `staleTime` de 60s.
- Agregada regresión en `useCrearActividad.test.tsx` para verificar que se invalidan actividades, higiene, KPIs y dashboard, y que las actividades silenciosas no disparan toast.

## [13.823.77] - 2026-09-05

### Pulido visual del PDF de cotización
- **Glifos**: las flechas y comillas tipográficas se normalizan antes de imprimirse (`sanitizePdfText`). Antes Helvetica dibujaba un glifo equivocado (`'`, `³`) en la ruta y en las notas de cada concepto.
- **Filas completas**: cada concepto y su nota viajan juntos y no se parten entre páginas; los títulos de bloque arrastran el encabezado de su tabla.
- **Importes en un renglón**: dentro de las tablas se imprime sólo el número (el código de moneda ya está en el título del bloque), en lugar de partir "USD / 1,200.00" en dos líneas.
- **Columnas y celdas vacías**: la columna Unidad ya no corta "contenedor" y los datos sin valor muestran "—".

## [13.823.76] - 2026-09-04

### Correcciones de datos financieros del detalle de embarque
- **Detalle de embarque**: la consulta única del detalle (`get_embarque_full`) excluye conceptos de venta/costo, documentos, notas y facturas enviados a la papelera. Antes el tab Costos sumaba renglones borrados y mostraba un margen inexistente (ELEXP00250: 22.2 % de utilidad con venta inflada de 8,805 a 13,930 USD; el real es pérdida de 2,040 USD).
- **Checklist de cierre**: el punto de margen mínimo explica "Aún no hay facturas de venta emitidas: la utilidad real no se puede calcular todavía" en lugar de mostrar sólo "Margen actual —".

## [13.823.75] - 2026-09-04

### Correcciones de UI, permisos y validaciones
- **CRM y dashboard**: estados de error y reintento visibles en tarjetas secundarias de Mi día, KPIs de higiene, forecast, leaderboard, timeline, selector de prospectos, Cliente 360 y detalle de lead/oportunidad.
- **Facturación**: paginación de la bandeja "Por enviar" lista todo el universo candidato con orden estable, reset de página al cambiar filtros y totales aclarados como "de la página visible".
- **Filtros desktop**: `UnifiedFiltersBar` ya no abre un panel vacío de "Filtros" cuando no hay filtros secundarios en escritorio.
- **Navegación**: el layout restaura el scroll superior al cambiar de ruta, sin perder la posición entre cambios de query params.
- **Higiene CRM**: la cobertura de presupuesto muestra la moneda real y "Sin conversión" cuando el pipeline MXN se compara con metas en USD/EUR; el borrador del presupuesto se ancla al año-mes visible.
- **Motivos de pérdida**: se eliminaron los toasts duplicados; el feedback queda exclusivamente en los hooks de mutación.

### Integridad financiera y fiscal
- **Ventas**: EUR queda fuera del selector de moneda en conceptos de venta y el servidor rechaza cualquier intento de guardar un concepto de venta en EUR.
- **Liquidaciones de comisión**: las RPC de cancelación y pago validan el rol financiero por membresía en la organización del usuario (no por rol global); al cancelar una liquidación, cada comisión regresa a su estado previo (`Por recuperar` o `Devengada`).
- **Pagos y crédito**: se endureció `convertir_monto_pago_a_factura` para rechazar tipos de cambio no verificables (TC ≤ 1 en pata extranjera o factura destino); el límite de crédito y las notas de crédito con total ≤ 0 fallan cerrados con mensajes amigables.

## [13.823.74] - 2026-09-04

### Cotizaciones en euros comparadas con el tipo de cambio del dólar
- El orden de la columna "Subtotal" del listado convertía importes en EUR usando el tipo de cambio de USD (comparación de "mayor cotización" corrupta) y el desglose por moneda descartaba el renglón en euros. Ahora cada moneda usa su propio tipo de cambio y, si falta, la fila no se compara numéricamente en vez de mostrar un equivalente inventado.

### Detalle de factura: saldo fail-closed
- Si falla la lectura de pagos o de notas de crédito aplicadas, el detalle ya no muestra "sin pagos"/saldo completo: aparece un aviso con "Reintentar" y se deshabilitan registrar pago y crear nota de crédito hasta que la lectura tenga éxito. El comportamiento con datos correctos no cambia.

### Captura de factura de proveedor desde el buzón
- Si la factura se crea pero falla "marcar como capturado", el diálogo ya no se cierra ni se limpia: conserva la captura y el id creado, explica el error y "Guardar" reintenta sólo ese paso, sin duplicar la factura.

### Reapertura de oportunidades (verificación)
- Se blindó con pruebas la reapertura Ganada→Abierta y Perdida→Abierta: limpieza de fecha de cierre, valor real y motivo de pérdida en un solo UPDATE, con guard de concurrencia y sin tocar el historial de etapas.

## [13.823.73] - 2026-09-04

### Concurrencia: dos personas aceptando cotizaciones de la misma oportunidad
- El guard `scripts/ci/concurrencia-cotizacion-ganadora.sh` fallaba en CI porque comparaba el resultado booleano de psql con `t` cuando `boolean::text` imprime `true`: la barrera nunca se cumplía. Ahora acepta ambas formas y coordina las dos sesiones con un semáforo en vez de esperas fijas.
- Al destaparse la carrera real apareció un bug de producto: `crm_cerrar_oportunidad_desde_cotizacion` tomaba el lock con `SELECT ... JOIN ... FOR UPDATE OF o`, y al despertar tras la otra transacción la re-evaluación del join (EvalPlanQual) devolvía 0 filas. La segunda aceptación mostraba "LC_OPORTUNIDAD_AJENA" en lugar de "LC_COTIZACION_GANADORA_EXISTE". Ahora el lock se toma sobre la tabla sola y la etapa se lee después.
- Se completó el espejo `supabase/schema/crm/crm_cerrar_oportunidad_desde_cotizacion.sql`, que terminaba en un bloque `DO $bf$` truncado y rompía cualquier replay desde cero.

## [13.823.72] - 2026-09-04

### CI: pruebas de moneda del CRM en verde
- Las dos pruebas SQL nuevas (`crm_moneda_incompatible`, `crm_vincular_moneda_vendedor`) fallaban por su propio armado, no por la base: la primera aceptaba una cotización sin cliente (bloqueada por otro candado) y no reproducía el escenario real en el que la oportunidad quedó en otra moneda; la segunda usaba un especificador de formato inválido y dejaba el correo del vendedor en NULL. Ambas verificadas contra una base local con todas las migraciones aplicadas.
- Se regeneró `supabase/schema/baseline.sql` (snapshot de esquema) y se normalizó `src/integrations/supabase/types.ts` para que coincidan con el esquema de migraciones.

## [13.823.71] - 2026-09-04

### CRM: montos por moneda, sin sumas inventadas
- El pipeline (tablero, resumen, columnas y tarjetas) y el KPI "Pipeline ponderado" ahora muestran subtotales separados por moneda; cuando hay más de una se indica "Varias monedas" con el desglose, en lugar de sumar pesos, dólares y euros y etiquetar el total como MXN.
- Cliente 360 muestra la última cotización con su moneda real y avisa cuántas oportunidades quedan fuera de las primeras 10, con acceso a "Ver todas".

### CRM: fechas, forecast y actividades correctas
- "Leaderboard del mes" ya no incluye cierres de meses futuros: el rango se calcula con el calendario local de México y cierra en el primer día del mes siguiente.
- "Forecast del mes" consulta sólo el mes en curso y "Forecast por mes" muestra el mes actual y los cinco siguientes, en vez de los seis meses más antiguos.
- "Oportunidades que cierran hoy" compara la fecha de cierre como día calendario local, no como medianoche UTC.
- "Mis actividades de hoy" vuelve a incluir las actividades históricas asignadas sólo por correo.
- Las actividades rápidas ya no muestran avisos duplicados, su fecha sugerida nunca nace vencida después de las 17:00 y, si falla la tarea automática de seguimiento, se explica que el registro sí se creó.

### CRM: moneda y responsable al vincular o cerrar
- Al vincular una cotización de prospecto y crear una oportunidad nueva, se hereda la moneda de la cotización y el vendedor del prospecto (el usuario actual sólo como respaldo); si la oportunidad ya tiene otra moneda, el vínculo se rechaza con un mensaje que explica cómo corregirlo.
- Al aceptar una cotización, ya no se guarda un monto en otra moneda dentro de la oportunidad: la operación se rechaza si las monedas no coinciden.
- Las ediciones y movimientos de oportunidades usan control de concurrencia: si otra persona guardó antes, se avisa y se refresca en lugar de sobrescribir en silencio.

### CRM: los errores dejan de disfrazarse de "todo al día"
- Las tarjetas secundarias del dashboard, Next Best Actions, embudo, forecast, leaderboard, timeline, selector de prospectos, higiene, paleta de comandos y el detalle de lead/oportunidad ahora muestran "No se pudo cargar…" con botón "Reintentar" cuando la consulta falla.

### Facturación
- Al reintentar un timbrado tras un error temporal, ya no se afirma "CFDI cancelado" cuando la respuesta es incierta: se informa el estado y se recomienda "Verificar estatus" sin repetir la solicitud.
- Cancelar, consultar y descargar acuse rechazan facturas archivadas, igual que las pantallas activas.

### Cotizaciones
- "Revisar después" ya no deja el asistente bloqueado con una versión obsoleta: ahora se puede resincronizar la versión antes de volver a guardar y el estado queda explicado.


### Dashboard /inicio: se repara crash de inicialización
- Se eliminó el ciclo de importación entre `permissionMatrix.ts` y `permissionMatrix.crm.ts` al extraer `TENANT_ADMINS` a un módulo compartido, evitando que el dashboard fallara al leer la matriz de permisos antes de su inicialización.
- Se eliminó el aviso de consola "Incorrect locale information provided": las herramientas de desarrollo de consultas ya no se cargan cuando el navegador expone un idioma no estándar.


### Auditoría de migraciones en verde
- La función interna de totales de embarque quedó con sus permisos declarados explícitamente (sólo el sistema puede ejecutarla; nadie público o anónimo), se documentó el ajuste de la línea base del auditor de migraciones y se sincronizó el listado de migraciones. `bash scripts/run-audits-conditional.sh` corre completo en verde.



### Pruebas de permisos (RLS) al día
- Se actualizaron las pruebas de permisos que aún asumían contratos viejos: la conversión de prospecto a cliente se prueba con un usuario firmado con permiso de alta, las funciones internas del CRM se invocan con el rol interno que hoy las ejecuta y los candados de actividades esperan el mensaje real del guard. Suite completa en verde (89 guards y 34 suites).
- Se registraron en la lista canónica las cinco funciones internas del CRM que quedaron cerradas a `service_role` (conversión de prospecto y sincronía con cotizaciones) y se volvió a cerrar el borrado físico de leads en la base efímera de pruebas, que sólo deben archivarse.

## [13.823.70] - 2026-09-03

### Calidad interna (CI verde)
- Se corrigieron los guardrails que frenaban la integración continua: espejos de permisos SQL en su propia carpeta, la función de totales de embarque re-emitida como migración para que un replay limpio no pise el arreglo de Aéreo/Terrestre, títulos de pruebas CRM sin duplicados y el KPI de higiene sin "Sin datos" pintado a mano.

### Cotizaciones mixtas: ya no se guarda un subtotal engañoso
- Antes, una cotización con 4,000 USD y 10,000 MXN guardaba **10,000 MXN** en el encabezado y descartaba los dólares (comparaba montos de distinta moneda sin tipo de cambio). Ahora el paso 3 avisa que hace falta capturar en una sola moneda y **no guarda nada**: los conceptos en pantalla se conservan.

### CRM: reabrir una oportunidad limpia su cierre
- Cuando una oportunidad ganada o perdida vuelve a una etapa abierta (por una nueva cotización enviada), se limpian en el mismo movimiento la **fecha de cierre real**, el **valor real** y el **motivo de pérdida**. Una oportunidad ganada también deja de arrastrar motivo de pérdida.


### Detalle de documentos: encabezado sin recortes
- En el detalle de **factura, proforma y factura de proveedor**, la fila de estados (Borrador → Por timbrar → Emitida → Pagada) pasó a su propio renglón: ya no se comprime contra los botones ni se corta la última píldora, y las etiquetas ya no se parten en dos líneas.
- La línea de contexto (cliente • fecha • expediente • proforma) se muestra completa en una o dos líneas legibles, sin recorte.



### Alta de proveedor: el RFC de la CSF ya no se pierde
- Al elegir **Agente de Carga** y su país, el RFC/Tax ID cargado desde la CSF se conserva; el campo ahora está siempre visible en el paso 1.

### Facturas: el correo ya no se sugiere al exportador del cliente
- Al enviar/timbrar un CFDI, el destinatario sugerido es el contacto de **facturación/cobranza** y, si no existe, el **correo fiscal del cliente**; los contactos de otro tipo (exportador, shipper) ya no se autoseleccionan por ser los más recientes.

### Proformas PDF: mejor acomodo, menos páginas
- Una proforma corta ahora cabe en **una sola página**: el título de *Conceptos*, la tabla y los totales viajan juntos y ya no se empuja el bloque completo a la página siguiente.
- Se quitaron redundancias que gastaban espacio: la fila *Ruta* (ya está en Origen/Destino, y con ella el símbolo de flecha que salía mal), la *Vigencia* duplicada y el subtítulo *Conceptos en USD* cuando la proforma tiene una sola moneda.
- Cuando no hay datos bancarios configurados, el aviso se muestra en una línea discreta en lugar de una tarjeta grande.
- La caja de totales es un poco más compacta y las celdas de importe son más anchas, así los montos con divisa ("USD 2,115.00") no se parten en dos líneas.


## [13.823.69] - 2026-09-03

### Cotizaciones: dos personas ya no se pisan los cambios
- **Al retomar un borrador se valida la versión real**: si la cotización guardada cambió en otra sesión, se conserva todo lo capturado, se avisa con opción de *Recargar datos* o *Revisar después*, y ningún guardado se aplica encima. Los borradores antiguos sin marca de versión consultan la versión actual antes de escribir.
- **Los costos internos del Paso 2 respetan el mismo candado**: el reemplazo de costos ocurre en una sola operación en el servidor y, si otra persona actualizó la cotización, no se borra ni se inserta ningún costo (nunca queda a medias).
- **Sin marca de versión no se guarda nada**: si la app no tiene la versión actual de la cotización, el servidor rechaza el reemplazo de costos y la app avisa sin llamar al guardado ni avanzar de paso (antes ese caso pasaba sin candado).
- **Mensaje claro en conflicto**: se indica que otra persona actualizó la cotización y que los cambios locales no se guardaron, sin mezclar versiones automáticamente.

## [13.823.68] - 2026-09-03

### Formularios del CRM: nada se pierde y nada se guarda dos veces
- **Un segundo Enter o clic ya no crea dos registros**: las altas express y los formularios completos de lead, oportunidad y actividad ignoran envíos duplicados, deshabilitan *Cancelar* y *Más campos →*, y no permiten cerrar el modal (X, ESC o clic fuera) mientras se guarda.
- **Cerrar un formulario con captura pide confirmación** en *Cancelar*, X, ESC y clic fuera; incluye la oportunidad (nombre, origen, cliente/prospecto, vendedor, montos, notas y la casilla de actividad automática). Tras guardar con éxito ya no aparece esa confirmación.
- **Al reabrir, el formulario aparece limpio**: lo descartado no reaparece, la fecha de la actividad se recalcula y la casilla de actividad automática vuelve a estar marcada.
- **La etapa del embudo ya no borra lo capturado**: si el pipeline carga después de abrir *Nueva oportunidad*, sólo se rellena la etapa inicial abierta y su probabilidad; el resto de los datos se conserva y el formulario no queda marcado como modificado por eso.
- **"Más campos →" conserva lo capturado**: al pasar del alta express al formulario completo de oportunidad se mantienen el nombre y el origen elegido (cliente o prospecto, con su vendedor dueño), sin pedir confirmación de descarte por ese cambio de vista.







## [13.823.67] - 2026-09-03

### Leads CRM: exportación completa, selección segura e importación confiable
- **Exportar CSV baja TODOS los leads que cumplen los filtros**, no sólo la página en pantalla. El botón muestra "Exportando…" y se deshabilita mientras trabaja. Lo que cada usuario puede ver sigue limitado por sus permisos.
- **La selección masiva ya no arrastra registros invisibles**: al cambiar búsqueda, estado, fuente, orden, página o tamaño de página, la selección se limpia; además se descarta cualquier registro que ya no esté en la página, y la barra masiva no opera mientras el listado se está recargando.
- **La importación CSV falla cerrada**: si la revisión de duplicados está en curso o falla, *Importar* queda bloqueado con un aviso y un botón para reintentar la revisión (antes podía importar tratando todo como nuevo). Elegir un archivo limpia el anterior, los errores de lectura se avisan una sola vez y se puede volver a seleccionar el mismo archivo.
- **Las operaciones masivas reportan la cantidad real**: actualizar, reasignar, eliminar e importar cuentan las filas efectivamente afectadas (ya no el número de seleccionados) y ahora sale un solo mensaje por operación.



## [13.823.66] - 2026-09-03

### Oportunidades CRM: respetan al dueño del prospecto
- **La oportunidad nace a nombre del vendedor correcto**: al crear una oportunidad desde la ficha de un prospecto, el vendedor inicial es el dueño del prospecto (no quien la captura). Antes, si un gerente la daba de alta desde la ficha de un agente, la oportunidad quedaba accidentalmente a nombre del gerente. La elección manual en el formulario sigue mandando.
- **La tarea automática va al vendedor elegido**: la actividad "Preparar propuesta" que se crea junto con la oportunidad se asigna al vendedor final del formulario, no necesariamente a quien la captura. Las actividades manuales no cambian.
- **Ya no se ofrecen botones que el sistema iba a rechazar**: los controles de crear/editar oportunidades y actividades (menú *Nuevo*, atajos N/L/O/A, Kanban, columna de completar/posponer y el alta desde una ficha) sólo aparecen para quien realmente puede guardarlas: dirección, administración, gerencia comercial y operador; un vendedor sólo sobre sus propios registros. Antes roles de operaciones y finanzas veían formularios que terminaban en un error de permisos.
- **Arrastrar en el Kanban queda deshabilitado** cuando no se puede cambiar la etapa, en lugar de mover la tarjeta y fallar al guardar.
- **Reasignar vendedor sólo para quien puede**: el selector de vendedor ya no se muestra a un vendedor, que conserva su asignación actual.
- La configuración del CRM usa exclusivamente el permiso de configuración (mismo que el ícono de engrane).
- Si un usuario no puede dar de alta nada en el CRM, el botón *Nuevo* ya no se muestra.
- **Cotizar y editar usan permisos separados**: en el detalle de una oportunidad, *Nueva cotización* aparece para quien puede escribir cotizaciones (incluye operaciones, coordinación logística y pricing), aunque no pueda editar ni eliminar la oportunidad. *Editar* y *Eliminar* siguen reservados a quien gestiona la oportunidad.
- **Administradores de empresa como responsables**: el selector de vendedor ya incluye a los administradores de la empresa (admin_org); antes quedaban fuera por un filtro a mano. La lista se deriva de la misma matriz de permisos, sin añadir a operaciones, finanzas ni pricing.



## [13.823.65] - 2026-09-03
### Convertir prospecto a cliente: una sola operación segura
- **La puerta y la cerradura ya coinciden**: el botón *Convertir a Cliente* (y el alta/importación de clientes) sólo aparece para quien de verdad puede dar de alta clientes: dirección, administración, operación y contabilidad. Antes lo veían roles que después recibían un error de permisos.
- **Sólo se convierte la cotización que ganó**: debe estar Aceptada, ser de prospecto, estar ligada a una oportunidad, ser su cotización ganadora, con la oportunidad en etapa ganada y su prospecto vivo. Si falta la oportunidad, el botón no aparece y queda el aviso que guía a vincularla.
- **Cliente completo desde el primer día**: el formulario pide contacto, correo, teléfono, RFC, código postal, régimen fiscal, uso de CFDI, forma y método de pago (y dirección cuando el RFC es real), con avisos campo por campo. Antes se creaban clientes sin datos fiscales y la primera factura se atoraba.
- **Todo o nada**: cliente, cotización, cotizaciones hermanas del mismo prospecto, oportunidad, prospecto y bitácora quedan actualizados en una sola operación. Antes parte del trabajo ocurría después y podía quedar a medias.
- **Sin duplicados y reintento seguro**: si ya existe un cliente con ese RFC se reutiliza; si la respuesta se pierde y se vuelve a intentar, devuelve el mismo cliente sin duplicar nada ni repetir el registro en bitácora.
- Mientras la conversión está en curso no se puede cerrar el modal por error; si algo falla, el modal se queda abierto con todo lo capturado.
- **Candado en la base**: ya no es posible "convertir" un prospecto editando la cotización por fuera; sólo la operación oficial puede hacerlo. Además, una cotización sólo puede ligarse a un cliente activo de la misma empresa.
- **Historial por identidad, no por nombre**: las cotizaciones hermanas se revinculan por la misma oportunidad, así dos empresas con nombre parecido ya no se mezclan.
- El aviso del CRM "Dar de alta como cliente" ahora obedece exactamente el mismo permiso que el módulo de Clientes.
- **Se cerró otra puerta lateral**: una función antigua del CRM permitía ligar cualquier cliente de la empresa a una oportunidad y marcar el prospecto como convertido sin cotización ganadora ni datos fiscales. Ya no puede ejecutarse desde la aplicación; la única ruta válida es la conversión oficial.

### Cotizaciones de prospecto: ya no nacen huérfanas
- **El cotizador dejó de crear prospectos**: ahora sólo se elige un prospecto calificado o una oportunidad abierta que ya existan en el CRM, con un botón *Abrir CRM* para darlos de alta allá. Se retiró la ficha fiscal duplicada del wizard.
- **Sólo aparecen orígenes válidos**: prospectos en estado Calificado o Prospecto, y oportunidades vivas, en etapa abierta, sin cliente asignado y de tu misma empresa.
- **Si falla el vínculo, no se pierde nada**: la cotización queda guardada como borrador, el wizard se queda en el paso 1 con toda la captura y aparece el botón *Reintentar vínculo y continuar*, que reutiliza la misma cotización sin duplicar nada.
- **Al editar se conserva el vínculo** y ya no se puede sustituir por accidente; tampoco vuelve a aparecer el falso aviso de "otro usuario modificó este registro" después de vincular.
- **Candado en la base**: la operación de vínculo exige siempre un origen real, valida empresa y permisos, y ya no puede crear ni modificar prospectos.
- El aviso de las cotizaciones sin oportunidad ahora dice *Editar y vincular* y abre el wizard: no adivina ni inventa el prospecto. Las 17 cotizaciones históricas sin oportunidad se corrigen manualmente; no se tocó ningún dato.
- **Reeditar una cotización ya vinculada nunca se atora**: si su oportunidad se cerró o el prospecto cambió de estado después, el sistema reconoce el vínculo existente y deja seguir editando. Apuntar a otro prospecto u oportunidad se sigue rechazando, y un vínculo roto avisa en lugar de reasignar en silencio.
- **Candado visible**: una vez confirmado el vínculo, el selector Cliente/Prospecto, el selector de cliente y *Desvincular* quedan bloqueados; el resto del paso 1 (ruta, mercancía, etc.) se sigue editando normalmente.
- En el buscador ya no aparecen oportunidades cuya etapa o prospecto fueron eliminados, para no ofrecer opciones que el servidor rechazaría.



## [13.823.64] - 2026-09-03
### Los pesos de un embarque aéreo ya se guardan
- **Bug corregido**: al editar un embarque aéreo (o terrestre) creado desde una cotización, el peso, el volumen y las piezas volvían a cero al guardar. El embarque arrastraba "contenedores" internos vacíos y el sistema recalculaba los totales sumándolos, borrando lo capturado.
- **Ahora** ese recálculo automático sólo aplica a marítimo y multimodal, donde los contenedores sí son la fuente de la verdad; en aéreo y terrestre se respeta lo que se escribe en el formulario.
- Sin cambios en datos existentes: no se borró ni reasignó ningún contenedor.



## [13.823.63] - 2026-09-02
### Se cierra la puerta lateral "Convertir lead"
- **Una sola puerta**: el botón heredado *Convertir* desaparece de la ficha del lead para todos los roles. El camino válido es completar perfil → calificar → crear oportunidad → cotización aceptada → alta formal del cliente.
- **Ya no se puede marcar "Convertido" sin cliente**: el atajo antiguo podía crear una oportunidad y dar el lead por convertido aunque no existiera cliente; eso ya no es posible.
- **Historia intacta**: un lead histórico *Convertido* muestra la acción **Ver conversión**, de sólo lectura, que lleva a su oportunidad (o al cliente si no hay oportunidad). Si no hay destino, no aparece ningún botón roto y la información sigue visible en la tarjeta de linaje.
- **Candado en la base**: la función interna del atajo ya no es ejecutable por los usuarios de la app; queda sólo para procesos internos privilegiados y con una nota que indica usar el flujo canónico.
- **Publicar pronto**: hasta que se publique esta versión, el botón *Convertir* del sitio publicado anterior fallará (la función ya está revocada).

## [13.823.62] - 2026-09-02
### El estado del lead deja de ser una etiqueta libre
- **Estados manuales vs. estados del ERP**: a mano sólo se pueden usar *Nuevo*, *Contactado* y *Descalificado*. *Calificado*, *Prospecto*, *Pendiente de alta* y *Convertido* los pone el sistema al calificar, cotizar o convertir el lead.
- **Ficha del lead**: si el lead ya está en un estado del ERP, se muestra como etiqueta de sólo lectura con la nota "Este estado lo actualiza el ERP"; el selector de estado sólo ofrece los tres manuales.
- **Alta y cambios masivos**: el formulario de nuevo lead y la barra de selección múltiple ya sólo ofrecen los tres estados manuales.
- **Importación CSV**: una fila con un estado del ERP queda marcada como error y no se importa, con el aviso "Estado administrado por el ERP; usa Nuevo, Contactado o Descalificado". Si la columna va vacía se sigue usando *Nuevo*.
- **Candado real en la base**: un intento directo de poner o quitar a mano un estado del ERP se rechaza con un aviso claro; guardar otros datos de un lead ya calificado o convertido sigue funcionando.

## [13.823.60] - 2026-09-02
### Los leads sólo los gestiona quien de verdad puede
- **Llave de la sucursal correcta**: varias decisiones sobre leads miraban una credencial general del usuario, no su puesto dentro de la empresa que está abierta. Ahora se valida el puesto dentro de la organización del lead: una credencial vieja de otra empresa ya no abre la puerta.
- **Calificar exige que el lead sea tuyo**: un vendedor sólo puede calificar el lead que tiene asignado; administración, dirección y gerencia comercial de esa misma organización pueden gestionar cualquier lead asignado.
- **Lead sin dueño no se califica**: si nadie lo tiene asignado, primero hay que tomarlo o asignarlo (aviso claro en pantalla).
- **Reintento honesto**: al reintentar la calificación de un lead ya calificado con el perfil comercial incompleto, ahora avisa qué falta en vez de decir "listo" sin hacer nada.
- **Botones que sí funcionan**: editar, eliminar, calificar, "Nueva oportunidad", "Nuevo lead", el selector de estado de la tabla y la barra de acciones en lote sólo aparecen para quien realmente puede usarlos; los demás ven el estado como etiqueta.
- **Lectura sí, escritura no**: operación y consulta conservan su lectura dentro de la organización, pero ya no escriben leads. El público anónimo perdió todo acceso a la tabla de leads.



## [13.823.59] - 2026-09-02
### Cierre de pendientes de la aceptación de cotizaciones
- **Fecha y número de la misma fotografía**: en los registros antiguos enlazados por el respaldo histórico, si el número de versión ya era correcto pero la fecha venía de otro lado, quedaba una foto con la fecha de otra foto. Ahora se corrigen los dos datos juntos, tomados siempre de la misma fotografía guardada, y nunca se toca una aceptación hecha por una persona real. Revisión previa de sólo lectura: 0 registros afectados hoy.
- **Prueba de "dos usuarios a la vez" que sí arranca**: la prueba de dos sesiones simultáneas usaba identificadores inválidos y esperaba "un segundo a ciegas". Ahora usa identificadores válidos y espera de forma verificable a que la primera sesión ya tenga el candado antes de lanzar la segunda; la segunda sólo aprueba si recibe el aviso de "ya hay una cotización ganadora". Corre únicamente en GitHub Actions.
- **Pruebas sin falsos verdes**: las verificaciones del índice de respaldo ya no buscan palabras sueltas: comparan la regla completa, así que una regla distinta ya no puede pasar como buena.



## [13.823.58] - 2026-09-02
### Aceptar una cotización dos veces ya no falla
- **Reintento seguro**: si al aceptar una cotización se pierde la respuesta (internet inestable) y vuelves a intentarlo, ahora recibes éxito en lugar de un error. Es como volver a preguntar "¿ya quedó?" en vez de intentar firmar otra vez: no se reescribe la fecha ni el usuario de aceptación, ni el monto, ni la auditoría, ni el aviso al vendedor.
- **Se detiene si algo no cuadra**: si la oportunidad ya tiene otra cotización ganadora, avisa del conflicto; si el enlace quedó incompleto, lo reporta para revisión manual en vez de "arreglarlo" en silencio.
- **Etiqueta correcta en el historial**: la rutina que enlazó oportunidades ganadas antiguas usando su fotografía guardada ahora sella el número y la fecha de esa misma fotografía. Revisión previa: 0 registros afectados hoy.
- **Más pruebas, menos falsos verdes**: la suite de la cotización ganadora ahora usa un vendedor real (exige exactamente un aviso), un embarque real, la llamada doble a la operación de aceptar y verifica el índice de respaldo y el disparador con sus datos exactos. Se agregó además una prueba de dos sesiones simultáneas que corre en GitHub Actions.

## [13.823.57] - 2026-09-02
### Una sola autoridad cierra la oportunidad cuando se acepta la cotización
- **Cierre en un solo paso**: antes tres reglas automáticas competían al aceptar una cotización, como tres personas escribiendo en la misma libreta al mismo tiempo: a veces la oportunidad quedaba ganada pero sin apuntar cuál cotización ganó, sin la nota de auditoría o sin avisar al vendedor. Ahora una única regla hace todo junto y en el mismo movimiento: etapa ganada, probabilidad 100%, fecha de cierre, monto real, cotización ganadora, una sola nota de auditoría y un solo aviso.
- **Sin duplicados**: reintentar la aceptación o pasar la cotización a "En operación" no vuelve a auditar ni a notificar, y no altera el monto ya registrado.
- **Una ganadora por oportunidad**: si ya hay una cotización ganadora viva, otra no puede tomar su lugar; además la ganadora no puede cambiarse de oportunidad ni de empresa, con un índice de respaldo en la base.
- **Oportunidad perdida**: hay que reabrirla explícitamente antes de aceptarle una cotización.
- **Papelera con memoria**: enviar la cotización ganadora a la papelera conserva la historia de la oportunidad (monto, ganadora y auditoría).
- **Historia intacta**: el único caso histórico (folio COT-2026-0123) se enlazó usando su fotografía guardada de la versión aceptada, conservando su monto real de 1,798.48 en lugar del subtotal vivo, sin generar avisos tardíos.
- **Menos manos en el pastel desde la app**: la pantalla de cotizaciones ya sólo sincroniza la etapa al enviar; aceptar, operar o rechazar queda a cargo de la base, y al cambiar el estado se refrescan oportunidades, Higiene y el tablero.
- **Variante cerrada**: revertir una cotización aceptada a borrador seguía prohibido por las reglas de estado; en lugar de habilitar ese atajo se dejó documentado y probado que está bloqueado (la re-cotización se hace con una versión nueva).
- **Pruebas**: nueva suite SQL con dos empresas para primera aceptación, reintento, segunda ganadora, oportunidad perdida, inmutabilidad, papelera, índice y permisos de la función; más invariantes de esquema y pruebas de interfaz.

## [13.823.56] - 2026-09-02
### Actividades sólo sobre registros propios, reloj de seguimiento honesto e Higiene fresca
- **Actividades bien ligadas**: una actividad sólo puede colgarse de un prospecto, oportunidad, cliente o contacto que exista, esté vivo y sea de la misma empresa; también al intentar cambiar la empresa o el registro ligado. El mensaje es el mismo en todos los casos para no revelar si ese registro existe en otra empresa (como un portero que dice "no está en la lista" sin contar de quién es la lista). La regla aplica igual a procesos internos.
- **Reloj de seguimiento**: la oportunidad se "rejuvenece" sólo cuando se agenda una actividad nueva o cuando de verdad se marca como completada. Editar notas, cambiar el resultado o posponerla ya no borra el retraso acumulado.
- **Seguimiento oportuno**: el porcentaje cuenta como cumplidas únicamente las oportunidades con próxima actividad agendada y no vencida.
- **Sin muestra, sin calificación**: cuando no hay oportunidades abiertas, Higiene muestra "Sin datos" y un guion en lugar de un 0% que parecería mal desempeño.
- **Tablero al día**: Higiene se recalcula al crear, completar, posponer o editar actividades y al mover o editar oportunidades, y se refresca solo cada minuto para que los vencimientos por reloj aparezcan con la pantalla abierta.
- **Datos legados reportados, no modificados**: una actividad histórica ligada a un prospecto ya eliminado se conservó intacta; el candado nuevo aplica sólo hacia adelante.
- **Nota de reparación (test-only, misma versión)**: se retiró de la suite una lectura muerta a una variable no declarada (`v_mov_b`) que impedía compilar el archivo completo; la oportunidad ajena ya se verifica por versión de fila. No cambia lógica productiva ni la migración aplicada.
- **Pruebas**: nueva suite SQL con dos empresas para los cuatro tipos de vínculo, el reloj de movimiento, el caso contractual de higiene e invariantes del candado; más pruebas de interfaz y de refresco del tablero.

## [13.823.55] - 2026-09-02
### Microcorrección: sesión real al convertir prospectos y pruebas sin falsos verdes
- **Sesión real**: la conversión de prospectos ahora identifica correctamente quién llama. Antes, la comprobación mirada desde dentro de la función veía siempre al dueño de la función (como revisar tu propia credencial en el espejo), así que no distinguía a un usuario firmado de un proceso interno. Ahora sólo se permite sin usuario firmado cuando la llamada viene del sistema; cualquier otra llamada sin sesión se rechaza antes de leer o tocar datos.
- **Etapa inicial**: la etapa de arranque debe estar abierta, activa, de la misma empresa y no eliminada.
- **Pruebas sin falsos verdes**: los ayudantes de prueba se atrapaban a sí mismos y aprobaban operaciones que en realidad estaban permitidas (un guardia que se aplaudía solo). Ya sólo evalúan la operación probada, y se agregó un canario que falla a propósito si el ayudante vuelve a aprobar algo permitido.
- **Cobertura**: sesión sin usuario, llamada del sistema, cliente de otra empresa/inexistente/eliminado, prospecto eliminado, etapa eliminada y cambios de empresa en cumplimientos y comentarios, verificando en cada rechazo que no queda ningún registro.

## [13.823.54] - 2026-09-02
### Candados de conversión de prospectos y vínculos por empresa en CRM
- **Convertir prospecto**: exige sesión activa, pertenencia a la empresa y rol autorizado; un vendedor sólo puede convertir los prospectos asignados a él. La autorización se evalúa antes de tocar datos y el prospecto queda bloqueado durante la conversión (sigue siendo atómica e idempotente).
- **Rol por empresa**: si la membresía en la empresa tiene menos permisos que el rol histórico global, manda la membresía.
- **Origen de la oportunidad**: el prospecto o cliente ligado debe existir, estar vivo y pertenecer a la misma empresa, incluso al cambiar la empresa de la oportunidad.
- **Criterios de etapa y su cumplimiento**: sólo se pueden ligar criterios vivos y activos de la misma empresa que la etapa y la oportunidad.
- **Comentarios de oportunidad**: sólo sobre oportunidades vivas de la misma empresa, y el aviso al vendedor se genera únicamente si la oportunidad sigue viva en esa empresa.
- **Pruebas**: nueva suite SQL que cubre la autorización de la conversión y los candados por empresa, registrada en los candados de CI.
- **Datos legados reportados, no modificados**: 1 oportunidad borrada ligada a un prospecto borrado de su misma empresa; 0 vínculos cross-org en cliente, criterios, cumplimientos y comentarios.



## [13.823.53] - 2026-09-02
### Etapa inicial de una oportunidad nueva
- **Siempre nace en la primera etapa abierta**: antes, si el embudo tenía "Ganada" o "Perdida" en la primera posición, la oportunidad nueva podía nacer cerrada (tanto en el alta rápida como en el formulario completo).
- **Pipeline sin etapas abiertas**: el botón "Crear" queda apagado y se avisa "Configura al menos una etapa abierta en el pipeline", en lugar de intentar guardar y fallar con un mensaje confuso.

## [13.823.52] - 2026-09-02
### Microcorrección de los candados por empresa en CRM
- **Permisos internos**: las validaciones internas del CRM ya no son ejecutables por cualquier usuario (antes seguían abiertas al público por el permiso que PostgreSQL da por defecto); sólo el sistema las invoca.
- **Etapa y motivo de pérdida por empresa**: una oportunidad sólo puede usar una etapa del embudo viva y activa de su propia empresa, y el motivo de pérdida debe ser un motivo vivo y activo de la misma empresa.
- **Nueva oportunidad**: la etapa se muestra sólo de lectura y siempre es la primera etapa abierta; ya no se puede crear directamente en "Ganada" o "Perdida".
- **Pruebas**: la suite SQL de candados por empresa quedó ejecutable (9 casos: cotización, actividad, etapa y motivo cross-org o inexistente, más probabilidad terminal).
- **Datos legados reportados, no modificados**: queda 1 actividad activa ligada a prospecto borrado; 0 vínculos cross-org/inexistentes en los candados de cotización.

## [13.823.51] - 2026-09-02
### Candados por empresa en CRM y correcciones de la tanda anterior
- **Nueva oportunidad rápida**: la lista de prospectos ya no incluye a los que fueron convertidos en cliente y la oportunidad se queda con el vendedor dueño del prospecto (antes se reasignaba a quien la capturaba).
- **Próximo paso / nueva actividad**: al abrir el diálogo para otra oportunidad se limpia todo el borrador anterior (tipo, asunto, descripción, fecha y casillas), y el buscador ya no muestra el nombre de una selección que se limpió.
- **Mis actividades**: si la sesión aún no identifica al usuario, el listado sale vacío en lugar de mostrar las del equipo; el correo sólo se usa como respaldo en actividades antiguas que no tienen usuario asignado.
- **Oportunidad perdida**: las actividades pendientes se cierran en una sola operación (antes podía quedar media lista abierta) y ahora se avisa si la automatización falla.
- **Aislamiento entre empresas**: una cotización sólo puede ligarse a una oportunidad viva de la misma empresa y una actividad sólo a un prospecto u oportunidad viva de la misma empresa; las automatizaciones también validan la empresa.
- **Probabilidad**: la regla de 100% al ganar y 0% al perder ahora la garantiza la base de datos por cualquier camino; en la edición de una oportunidad la etapa es de sólo lectura (se mueve desde el embudo, que pide el motivo de pérdida).
- **Permisos**: el botón "Calificar como prospecto" sólo aparece a quienes el servidor sí autoriza (ventas, gerencia comercial y administración).

## [13.823.50] - 2026-09-02
### Pulido de CRM: origen de oportunidades y notas que no se perdían
- **Nueva oportunidad rápida**: ahora se elige el origen (cliente o prospecto calificado) y el botón "Crear" está apagado hasta elegirlo; antes se ofrecía "Sin cliente" y el servidor rechazaba el alta.
- **Próximo paso**: al abrir el diálogo para otra oportunidad ya toma la oportunidad correcta (antes mostraba el nombre nuevo pero guardaba la anterior).
- **Notas de actividades**: completar una actividad sin escribir resultado ya no borra el texto que había, y al cerrar una oportunidad como perdida se conservan las notas del usuario.
- **Probabilidad**: mover a "Ganada" deja 100% y a "Perdida" deja 0%, aun si alguien había puesto un valor a mano.
- **Motivo de pérdida**: se retiró el campo "Detalle" que nunca se guardaba en ningún lado.
- **Mis actividades**: se corrigieron actividades antiguas que tenían el correo del responsable pero no su usuario, así el listado "Mías" y el contador de vencidas muestran lo mismo.
- **Nuevo prospecto**: el segundo y siguientes prospectos de la sesión también quedan asignados a quien los captura.

## [13.823.49] - 2026-09-02
### Pulido de CRM y pantallas de 1280x720
- **Filtros de Oportunidades**: en computadora, abrir los filtros ya no abre además el panel de celular (antes salían dos paneles y dos botones "Limpiar").
- **Actividades vencidas**: el atajo "vencidas" ahora filtra en el servidor, así que el contador y las páginas coinciden con lo que se ve.
- **Oportunidades**: etapa, vendedor, rango de cierre y monto mínimo se aplican sobre todas las oportunidades (antes sólo sobre las primeras 500) y la exportación a CSV incluye todas las coincidencias.
- **Guardados que no guardaban**: editar o eliminar leads y completar/posponer/anotar actividades avisan error si el cambio no se aplicó, en lugar de mostrar un éxito falso.
- **Avisos duplicados**: registrar o completar una actividad y mover una oportunidad muestran un solo mensaje.
- **Accesibilidad y detalles**: el botón "+" de actividad se anuncia a lectores de pantalla, la tabla de Leads deja ver el Score en pantallas de 1280 px, el atajo de búsqueda muestra "Ctrl+K" en Windows y los contadores dicen "1 actividad" / "N actividades".

## [13.823.48] - 2026-09-02
### Sincronización de base: correcciones que faltaban aplicar
- **Cierre de embarques**: cerrar y reabrir un embarque ahora valida el rol en la organización dueña del embarque (el arreglo existía en el repositorio pero nunca se había aplicado a la base) y se cierra la carrera que permitía colar conceptos durante el cierre.
- **Notas de crédito y pagos**: se aplicaron a la base el candado de saldo con bloqueo de factura y el guard que protege la historia de cobros frente a REP timbrados vigentes.
- **Cierre de periodo contable**: la función controlada (rol financiero, motivo para reabrir y bitácora) ya está activa en la base.
- **Ayudante interno de cierre**: sólo lo ejecuta el sistema, ya no los usuarios firmados (linter de alcance por organización en verde).

## [13.823.47] - 2026-09-02
### Ronda de integridad: cuentas, notificaciones y correos
- **Cuentas bancarias**: una cuenta con movimientos registrados ya no puede desactivarse ni eliminarse (candado en el servidor) y el borrado exige fila afectada; antes podía "eliminarse" sin efecto real.
- **Notificaciones internas**: los usuarios sólo pueden marcarlas como leídas; ya no es posible alterar título, mensaje, enlace ni tipo, ni crear o borrar notificaciones desde el cliente.
- **Estado de cuenta por correo**: la clave de envío se deriva de cliente + periodo + destinatario (sin reloj), así que reintentar no vuelve a enviar el mismo correo.
- **Rebotes y quejas**: el evento actualiza el envío original correlacionando por identificador del mensaje; el identificador del evento se usa sólo como respaldo, sin filas contradictorias.
- **Documentos de embarque**: si el archivo sube pero el registro no se confirma, el archivo nuevo se limpia y se reporta el error original; tras un reemplazo confirmado se limpia el archivo anterior.

## [13.823.46] - 2026-09-02
### Pruebas RLS: candado y fixture al día
- Se registró `_factura_serie_folio_monotonico()` en la lista canónica de funciones sólo para el motor (`service_role`), que quedó desincronizada al agregar el trigger de folios.
- La prueba `ola4_n41_n44_n45` ahora siembra el tipo de cambio DOF del día antes de emitir facturas en dólares, como ya exige el candado fiscal.

## [13.823.45] - 2026-09-02
### Manifiesto de migraciones: entrada faltante y poda de historial
- Se registró la entrada de la versión vigente en `supabase/releases/migration-manifest.json` (1221 migraciones), con lo que `audit:manifest` vuelve a verde.
- El manifiesto ahora conserva sólo las últimas 3 versiones: cada entrada lista todas las migraciones y el archivo ya rozaba el límite de 10 MB por archivo del repositorio.



## [13.823.44] - 2026-09-02
### Higiene de CI: pruebas y auditorías en verde
- **Mensajes en español**: se agregaron textos amigables para los códigos de folio de serie (`LC_FOLIO_NO_REGRESIVO`, `LC_SERIE_INMUTABLE`).
- **Auditorías**: se resolvieron el título de prueba duplicado, el cast marcado como riesgoso en el portal y el falso positivo del tope de consultas en Tesorería.
- **Pruebas**: se actualizaron las aserciones del webhook de FacturApi y el mock de llaves de consulta tras la refactorización previa.



## [13.823.43] - 2026-09-02
### Pulido operativo: menos clics engañosos y folios protegidos
- **Eliminaciones irreversibles**: mientras la eliminación está en curso el diálogo ya no se puede cerrar con Escape, clic fuera o Cancelar; muestra "Eliminando… no cierres esta ventana".
- **Buzón de facturas**: durante la subida del archivo la ventana permanece abierta y conserva lo capturado hasta tener resultado.
- **Solicitud de cotización del portal**: el botón Enviar ya no queda bloqueado; al enviar se señalan los campos faltantes con mensajes accesibles.
- **Folios de facturación**: la base de datos rechaza bajar el folio actual de una serie y cambiar prefijo/folio inicial de series que ya tienen facturas.
- **Tracking**: los botones "Actualizar ETA" y "Marcar llegada real" ahora muestran foco visible al navegar con teclado.
- **Tableros**: registrar, editar o borrar pagos (cliente y proveedor) refresca también el Dashboard de Dirección y el Ejecutivo.

## [13.823.42] - 2026-09-02
### Totales completos: sin cifras cortadas ni errores disfrazados de cero
- **Dashboard de Dirección**: la venta, el costo y el margen ya se calculan con TODOS los conceptos del periodo (antes se sumaban como si fueran el total sólo los primeros 1,000).
- **Dashboard de CRM**: el pipeline, el embudo y los mejores tratos consideran todas las oportunidades abiertas; si la consulta falla, el tablero avisa y ofrece reintentar en vez de mostrar ceros.
- **Comisiones devengadas**: los indicadores (devengado, pendiente por liquidar y por recuperar) se calculan sobre el total del periodo, no sobre las 500 filas visibles.
- **Pagos programados de Tesorería**: la bandeja lee todas las facturas por pagar y muestra estado de error con reintento cuando la consulta falla.
- **Configuración de empresa**: en organizaciones nuevas los datos ya se guardan de verdad; si no se escribe ningún registro, la app avisa en lugar de decir "guardado".

## [13.823.41] - 2026-09-02
### Higiene de código (sin cambios funcionales)
- **Portal del cliente**: la tarjeta de pagos y notas de crédito se dividió en piezas más pequeñas (pagos, notas de crédito y totales); se ve y calcula exactamente igual.
- **Webhook de facturación**: la lógica de control de duplicados y reintentos se extrajo a funciones dedicadas para simplificar el flujo.

## [13.823.40] - 2026-09-02
### Importaciones masivas y estado de cuenta BBVA sin pérdidas silenciosas
- **Importación de clientes y proveedores**: antes de guardar se revisa qué registros ya existen (por RFC o razón social); las filas repetidas se omiten en lugar de duplicarse al reintentar un archivo que falló a la mitad.
- **Conteo real**: el diálogo ya informa cuántos registros se crearon de verdad y cuántas filas se omitieron por duplicado.
- **Estado de cuenta BBVA**: las filas ilegibles se reportan al usuario y bloquean la importación, en vez de descartarse en silencio.

## [13.823.39] - 2026-09-02
### Higiene posterior a la ronda de seguridad del portal
- **Perfil del portal**: la nueva llave de integridad cliente/organización volvía ambigua la consulta del perfil y rompía la compilación; ahora la consulta indica explícitamente la relación correcta.
- **Bitácora**: se actualizaron las pruebas al nuevo registro por función controlada (ya no se escribe desde el navegador).
- **Cierre de periodo**: la lógica de guardado se movió a un hook, conforme a la regla de arquitectura del proyecto.

## [13.823.38] - 2026-09-02
### Seguridad del portal de cliente, catálogos y exactitud del tipo de cambio
- **Acceso cruzado del portal (crítico)**: un vínculo de portal podía declarar una organización distinta a la del cliente real, abriendo datos de otra empresa. Ahora la base exige que la pareja cliente/organización coincida, la revocación pasa por una función controlada y el personal ya no puede escribir esos vínculos a mano.
- **Catálogos globales**: navieras y puertos sólo los puede modificar el administrador de la plataforma; antes cualquier organización podía editar el catálogo que ven todas.
- **Notificaciones del portal**: ya no se pueden crear avisos para clientes de otra organización, y sólo se aceptan enlaces internos del portal (se bloquean URLs externas de phishing).
- **Tipo de cambio DOF**: en facturas sin timbrar el tipo de cambio se toma siempre del DOF de la fecha de emisión. Antes se podía guardar un valor arbitrario y, al mover la fecha, el tipo de cambio quedaba viejo.
- **Timbrado/cancelación (webhook)**: un aviso que llegaba antes de que existiera la factura o el pago se descartaba y nunca se volvía a procesar. Ahora se libera el candado de duplicados y se pide el reintento, sin perder la protección contra avisos repetidos.
- **Saldos en el portal**: el saldo de una factura se calcula en la base sobre todos los movimientos; antes se sumaba en pantalla con un máximo de 200 registros y podía mostrar saldos falsos. La lista visual avisa cuando está recortada.
- **Descarga de complementos de pago**: los archivos del portal se descargan por el canal seguro de la aplicación en lugar de una dirección protegida directa.

## [13.823.37] - 2026-09-02
### Higiene de código y mensajes de error en español
- **Mensajes claros**: ocho errores de la base (cuentas por pagar, pagos programados, traspasos y conversión de cotizaciones) ya no se muestran con su clave técnica: ahora tienen texto en español que explica qué hacer.
- **Archivos partidos**: seis pantallas/hooks que habían crecido de más (garantías del agente, costeo de navieras, buscar tarifa, alta de factura de proveedor, sidebar y CxP por pagar) se dividieron sin cambiar comportamiento.
- **Detalles de interfaz**: el aviso de tipo de cambio en notas de crédito de proveedor usa el banner estándar, y el botón "Pagar en lote" muestra su explicación con tooltip accesible en lugar del `title` del navegador.

## [13.823.36] - 2026-09-02
### Reconstrucción de base: ya no se saltan migraciones
- **Replay completo**: la reconstrucción limpia de la base decidía qué migraciones aplicar comparando fechas contra el corte del squash. Diez migraciones creadas después del squash traían fecha anterior al corte y se omitían en silencio (entre ellas el registro atómico de pagos a proveedor). Ahora se usa un inventario explícito de lo que sí está consolidado (`supabase/schema/squash/included.txt`), tanto en CI como en la verificación local.

## [13.823.35] - 2026-09-02
### Higiene de auditorías y candado de conversión de cotizaciones restaurado
- **Candado recuperado**: una actualización posterior había borrado sin querer la validación que impide crear dos embarques desde la misma cotización; se re-emitió el cuerpo correcto para que una reconstrucción limpia de la base lo conserve.
- **Auditorías de CI**: se corrigieron dos nombres inexistentes (`release-manifest`, `soft-delete-reads`) que hacían fallar la corrida completa aunque todo estuviera bien, y se quitó una entrada muerta del registro de divergencias.



## [13.823.34] - 2026-09-02
### Ronda de endurecimiento: tesorería, cancelaciones, costos y datos de usuarios
- **Cancelación fiscal con un solo cierre (P1)**: cuando el SAT acepta la cancelación, el estado final (Cancelada o Sustituida), el desvínculo de embarques y la liberación de la proforma se hacen en una sola rutina de servidor, igual desde el aviso automático que desde la app. Repetir el aviso ya no altera nada.
- **Traspasos entre cuentas propias (P1)**: se bloquean las dos cuentas antes de validar el saldo, así dos traspasos al mismo tiempo no pueden sobregirar la cuenta; y se rechaza un traspaso con fecha anterior al corte de saldo inicial, que antes se registraba sin afectar el saldo.
- **Costo de embarque ligado a factura de proveedor (P1)**: el costo y su vínculo con la factura se guardan juntos o no se guardan; reintentar el mismo envío ya no duplica el costo ni deja costos "fantasma" marcados como pagados.
- **Reposición del mismo documento de embarque (P2)**: volver a subir un archivo que ya se había reemplazado vuelve a sincronizarse con la fila real y avisa si el guardado no alcanzó ningún registro, en vez de quedarse con datos viejos.
- **Conciliación de embarques completa (P1)**: se leen todos los conceptos por lotes, con tope explícito; si el resultado se pasa del tope, se avisa en vez de mostrar una cifra parcial como total.
- **Rentabilidad incompleta señalada (P2)**: si algún embarque no pudo convertirse a pesos por falta de tipo de cambio, los reportes lo advierten y la exportación queda marcada, en lugar de presentar la utilidad como exacta.
- **Roles asignables (P2)**: el administrador de la organización ya puede asignar auxiliar contable y ejecutivo de cobranza; antes aparecían en pantalla pero el servidor los rechazaba.
- **Datos de usuarios protegidos (P2)**: el listado completo (correo y último acceso) queda sólo para roles administrativos; los módulos operativos usan un listado mínimo de nombres.

## [13.823.33] - 2026-09-02
### Cancelaciones al día y conceptos de IA sin importes cruzados
- **Sincronización automática de cancelaciones (alta)**: se aplicó a la base publicada el campo de "última revisión" que el proceso automático necesitaba. Antes fallaba en cada corrida (cada ~30 min) y una factura cancelada ante el SAT podía seguir apareciendo como activa en facturación y cobranza.
- **Borrar un concepto extraído por IA (media)**: al eliminar un renglón, los recuadros de cantidad, importe e IVA de los renglones que suben de posición ya muestran sus propios valores; antes conservaban los del renglón borrado y podían guardarse cifras equivocadas.

## [13.823.32] - 2026-09-02
### Pagos a proveedor atómicos, una cotización un embarque y CRM por conjunto
- **Programación de pagos (P1)**: la fecha programada se fija con una operación de servidor mínima que valida la organización de la factura y roles exactos (admin, admin de organización, tesorero, contador, super admin). Antes el guardado directo lo bloqueaba justo para Tesorería y lo permitía a roles que no deberían programar.
- **Registro de pago transaccional e idempotente (P1)**: el pago y su movimiento bancario se graban en una sola transacción. Reintentar el mismo envío devuelve el pago ya creado y le repara el movimiento si faltaba, en lugar de fallar con un error de duplicado o dejar la factura pagada sin salida bancaria.
- **Ejecutar pago programado (P1)**: exige el rol autorizado dentro de la organización de la factura (no en cualquiera), que exista programación previa y que la fecha esté entre la emisión y hoy.
- **Naviera y agente del embarque (P1)**: el alta completa de embarques ya guarda los identificadores de naviera y agente, no sólo sus nombres.
- **Una cotización, un embarque (P1)**: el selector de alta sólo ofrece cotizaciones Aceptadas sin embarque, la creación bloquea la cotización y valida estado/organización, y un índice único impide dos embarques vivos para la misma cotización. La edición sigue mostrando su cotización vinculada.
- **Aceptar cotización (P1)**: requiere rol autorizado dentro de la organización y conserva la separación de funciones (quien la creó no la acepta salvo administración).
- **Etapa de la oportunidad por conjunto (P1)**: la etapa se deriva de todas las cotizaciones vivas con precedencia En operación/Aceptada > Enviada > Perdida (sólo si todas están rechazadas). Rechazar una alternativa ya no marca como perdida una oportunidad ganada.
- **Cotizar desde oportunidad sin duplicados (P1)**: si ya existe un borrador para la oportunidad se reutiliza; si falla el cambio de etapa se avisa sin anunciar fracaso ni crear una segunda cotización.
- **Sin éxitos falsos (P2)**: editar, mover o eliminar una oportunidad detecta cuando no se afectó ninguna fila y avisa en lugar de registrar bitácora falsa; si la actividad automática al crear una oportunidad falla, la oportunidad se conserva con una advertencia accionable.
- **Historial de tarifa intacto (P2)**: repetir la conversión de una cotización ya convertida no sobrescribe la decisión ni el snapshot de tarifa originales.


## [13.823.31] - 2026-09-02
### CxP sin dependencia del SAT y CRM sin fallas silenciosas
- **Factura extranjera/manual aprobable (P1)**: `requiereValidacionSat` es ahora el predicado canónico (origen del proveedor + CFDI real, no se infiere por UUID). En `/compras/por-aprobar` una factura de proveedor extranjero o de captura manual se selecciona y aprueba con el flujo normal (rol, confirmación y auditoría intactos), muestra el chip "SAT: No aplica" con la explicación y no cuenta para "Validar en SAT".
- **Sin checkbox mudo (P1)**: cuando la selección está bloqueada (p. ej. segregación de funciones) se muestra un botón enfocable con el motivo y texto para lectores de pantalla.
- **Calificar como prospecto (P1/P2)**: si faltan campos del Perfil ICP se abre un diálogo accesible con la lista de faltantes y un CTA que lleva al Perfil ICP; con el perfil completo se ejecuta la transición y el doble clic es idempotente. Ya no depende de un toast que podía quedar deduplicado.
- **Correo del lead consistente (P2)**: el formulario de la ficha se deriva del dato persistido (una sola fuente canónica para el mailto y el input) y al guardar sólo viajan los campos editados, así que editar Notas ya no puede borrar el correo.

## [13.823.30] - 2026-09-02
### Tarifas: contenedores duplicados y estados vacíos honestos
- **Contenedores duplicados (P1)**: el selector de tipo de contenedor colapsa los registros equivalentes (mismo tamaño y categoría con IDs distintos) en una sola opción, y la búsqueda Top 3 consulta todos los IDs del grupo. Elegir cualquiera de las variantes ya devuelve la misma tarifa; la vista de administración sigue viendo todos los registros para poder desactivar el duplicado.
- **Top 3 con diagnóstico (P2)**: cuando no hay resultados, la búsqueda distingue "no hay tarifa", "existe pero está pendiente de aprobación" y "está vencida", en `/costeo/buscar` y en el buscador del wizard de cotización. Se conserva el bloqueo: sólo se pueden elegir tarifas vigentes y aprobadas.
- **Embarques vacíos (P2)**: para roles que no crean embarques (p. ej. coordinador logístico) el estado vacío explica que se generan desde una cotización aprobada y ofrece ir a Cotizaciones cuando el rol tiene acceso.

## [13.823.29] - 2026-09-02
### Portal del agente: tarifas usables en celular
- **/agente/tarifas en móvil (<md)**: la lista se presenta como tarjetas (mismo patrón que Garantías) con ruta, naviera, contenedor, flete base, vigencia, estado con la advertencia de vigencia vencida, motivo de rechazo y el menú de acciones. Se elimina la tabla de ~1294 px que provocaba scroll horizontal de toda la página a 390 px.
- **Desktop sin cambios**: se conserva la tabla completa con todas sus columnas y ordenamiento.

## [13.823.28] - 2026-09-02
### Tarifas: KPI honesto y aprobación verificada contra la base
- **KPI Operaciones**: la tarjeta ahora se llama "Tarifas pendientes" con sublabel "Requieren revisión" ("Sin pendientes" en 0), porque el conteo incluye borradores con vigencia vencida que hay que revisar/renovar y no sólo aprobar. Se conserva el conteo y el enlace filtrado.
- **Guard de aprobación**: antes de aprobar, el servicio relee `vigente_hasta` de la tarifa por id y aplica el corte con el día de negocio México; si la lectura falla, no aprueba. Ya no se confía en la fecha que envía la fila de la UI.

## [13.823.27] - 2026-09-02
### Agente → Gerente de Operaciones: descubribilidad, vigencia y navieras
- **Costeo visible para gerente_operaciones**: sección en sidebar (Tarifas, Agentes, Navieras) y destinos en búsqueda global sólo cuando el rol tiene acceso.
- **Dashboard Operaciones**: el KPI ahora cuenta tarifas realmente pendientes de aprobación, es clicable hacia `/costeo/tarifas?aprobacion=borrador` y muestra estado de error en lugar de un falso 0.
- **Vigencia de tarifas**: se deriva "vencida" con el día de negocio México (vence hoy no está vencida), se avisa en la lista de operaciones y del agente, y se bloquea aprobar una tarifa vencida con mensaje visible.
- **Navieras**: búsqueda por nombre, filtro Todos/Configuradas/Sin configurar y estados vacíos contextuales.
- **Configurar naviera**: aviso explícito cuando falta el proveedor tipo Naviera — el agente sabe que Operaciones debe vincularlo; los roles con acceso ven CTA a `/compras/proveedores?tipo=Naviera&nuevo=1`.
- **Móvil (390px)**: garantías del agente en tarjetas, nav con máscara de degradado y modal de nueva tarifa con el resumen de faltantes separado del footer.
- **Embarques del agente**: el estado vacío explica que Operaciones asigna los embarques.

## [13.823.26] - 2026-09-02
### Celular plegable (692×764): cierre de la Ola 2 en clientes, facturas y cobranza
- **Facturación**: facturas emitidas, proformas y proyección se ven como tarjetas en móvil (antes requerían scroll horizontal).
- **Detalle de factura**: pagos, notas de crédito y REPs migrados a tarjetas, conservando acciones por renglón.
- **Cobranza**: el drill-down de antigüedad de CxC y los bloques del reporte de cartera usan tarjetas en móvil.
- **Clientes**: tablas del detalle (embarques/cotizaciones/facturas), contactos, documentos y usuarios del portal migradas a tarjetas.
- Pruebas: se envolvieron los renders afectados en `MemoryRouter` y se completó el mock de `useIsMobile` (las tablas responsivas usan router y breakpoint).



## [13.823.25] - 2026-09-02
### Uso en celular plegable (692×764): shell, tablas y KPIs
- **Shell**: `PageHeader` ya no deja un renglón de acciones vacío por debajo de `md`; el buscador de `UnifiedFiltersBar` ocupa todo el ancho y los filtros pasan al panel lateral; las tiras de tabs (detalle de embarque, bandejas) indican con degradado/apilado que hay más contenido.
- **Tablas**: Cobranza, Antigüedad CxC, CxP Por pagar, Compras Por aprobar y Tesorería Pagos usan tarjetas en móvil (`ResponsiveDataTable`), eliminando el scroll horizontal.
- **Montos**: las tarjetas móviles mostraban "USD 3,48…" por un ancho fijo de la caja de saldo; ahora la caja crece con el monto y trunca el texto largo de la izquierda.
- **KPIs**: dos columnas en móvil en CxP Por pagar y Cobranza; el botón de cerrar de los modales cumple 44×44 px.



## [13.823.24] - 2026-09-02
### Pulido: tira de estados del inicio en tablet
- **Síntoma**: en tablet (≈768 px) las etiquetas de la tira de estados se cortaban ("Por liqui…") y no había señal de que la tira siguiera desplazándose.
- **Fix**: la etiqueta ahora envuelve en dos renglones (`text-balance`, sin `truncate`) y el fade del borde derecho se mantiene hasta `lg`, donde la tira ya entra completa. Los iconos se alinean arriba para que los renglones extra no descuadren la fila.



## [13.823.23] - 2026-09-02
### Pulido: sidebar, saludo de tableros y modales de antigüedad
- **Sidebar**: en modo colapsado se pintaban **dos** puntos rojos por la misma alerta; ahora es uno solo y el tooltip del ítem incluye el desglose (`badgeHint`), que antes sólo existía expandido.
- **Sidebar**: el botón de colapsar tenía dos nombres accesibles distintos (móvil vs escritorio); se unificó a "Mostrar u ocultar la barra lateral".
- **Tableros**: el saludo usaba la hora del navegador (`new Date().getHours()`), así que a las 18:00 CDMX podía decir "Buenas noches" o "Buenos días" según el equipo. Ahora usa `saludoMx()` + `horaMx()` (America/Mexico_City), compartido por el dashboard operativo y el financiero.
- **Modales**: el drill-down de antigüedad de CxC hacía scroll de todo el diálogo (el encabezado se iba con el contenido y no había botón "Cerrar"); ahora usa el mismo patrón que CxP: encabezado y footer fijos, sólo la tabla scrollea.
- **Accesibilidad**: los dos drill-downs de antigüedad ya tienen `DialogDescription` (Radix ya no advierte por descripción faltante).
- **Copy**: el stepper de los modales decía "Paso 1/2" en pantalla y "Paso 1 de 2" al lector de pantalla; se unificó a "Paso 1 de 2".



## [13.823.22] - 2026-09-01
### Fix: Facturación mostraba embarques ya eliminados
- **Síntoma**: en Facturación aparecían expedientes borrados (p. ej. ELIMP00274/ELIMP00275).
- **Causa**: `fetchEmbarquesParaHueco`, `fetchEmbarquesMes` y `fetchReferenciasEmbarque` no filtraban `deleted_at IS NULL`.
- **Fix**: se agregó el filtro de borrado lógico en las tres lecturas (las referencias de un embarque eliminado ya no se propagan al CFDI) + pruebas de regresión.


## [13.823.21] - 2026-09-01
### Mejora: corregir los conceptos que la IA extrae de un PDF antes de guardar
- **Síntoma**: al capturar una factura de proveedor desde un PDF, la IA agregaba renglones de más y la tabla de conceptos era sólo lectura: había que guardar mal y corregir después.
- **Fix**: en el paso 1 del asistente, cuando el origen es "PDF con IA", cada renglón es editable (descripción, cantidad, importe, IVA) y se puede eliminar. El desglose que viene de un XML CFDI sigue siendo sólo lectura (garantía fiscal).
- Nuevos helpers puros `editarConceptoIa` / `eliminarConceptoIa` con pruebas unitarias.

## [13.823.20] - 2026-09-01
### Fix: el badge del sidebar contaba demoras que ya estaban en "Por liquidar"
- **Síntoma**: el tooltip de Embarques decía "39 con demora" mientras el panel de alertas de la pantalla mostraba sólo 2.
- **Causa**: `sidebar_alert_counts()` no incluía `Por liquidar` en la lista de estados reales, así que a esos embarques marítimos de importación les recalculaba el estado efectivo como `Arribo` y los contaba como demora (además de contarlos ya como cierre administrativo). `embarques_alertas_ids()` sí lo excluía.
- **Fix**: se agregó `Por liquidar` a la lista de estados reales en `sidebar_alert_counts()`. Ambos conteos coinciden de nuevo.

## [13.823.19] - 2026-09-01
### Fix: carga de facturas con IA bloqueada por CORS
- **Síntoma**: al procesar un PDF de proveedor con IA aparecía "No pudimos contactar al servidor desde este dispositivo", sin ninguna petición ni llamada a Gemini en los logs de la función.
- **Causa**: la app envía el header `x-organization-id` (ola P2 de seguridad), pero las funciones publicadas `parse-invoice-pdf` y `parse-cfdi-xml` seguían con la versión anterior de `_shared/cors.ts`, que no lo listaba en `Access-Control-Allow-Headers`; el navegador cancelaba el POST en el preflight.
- **Fix**: redespliegue de `parse-invoice-pdf` y `parse-cfdi-xml` con el código actual. Preflight verificado: ambas devuelven ya `x-organization-id` en `Access-Control-Allow-Headers`.
- **Regla operativa**: cualquier cambio en `supabase/functions/_shared/cors.ts` (o en cualquier módulo de `_shared/`) obliga a redesplegar TODAS las funciones que lo importan, no sólo la que se tocó.
- Sin migraciones, SQL remoto, secretos ni cambios de datos.


## [13.823.18] - 2026-09-01
### Optimización de CI y HMR (sólo local)
- **Preview más ágil en Lovable**: `vite.config.ts` ignora ahora `**/*.test.ts(x)`, `__tests__`, `coverage`, `dist`, `.git`, `.lovable`, `reports` y `node_modules` en el watcher de desarrollo. Evita recargas completas al guardar tests y reduce trabajo del dev server.
- **Audits condicionales en CI**: nuevo `scripts/run-audits-conditional.sh`. En PRs que sólo tocan frontend se omiten los audits de backend (`schema`, `migrations`, `rpc-sync`, etc.); en PRs de backend se omiten los de frontend (`arch`, `casts`, `tests`, etc.). `release-manifest` sigue corriendo siempre. En push a `main` se ejecuta el set completo.
- `.github/workflows/ci.yml` aprovecha las salidas del job `changes` para pasar `FRONTEND_CHANGED`/`BACKEND_CHANGED` al script. El aggregator `ci-success` acepta `audits=skipped` cuando el diff no toca ninguna de las dos áreas.
- Sin migraciones, deploy, publish, secretos ni cambios de datos.

## [13.823.17] - 2026-09-01
### Ola 1 de cierre para publicación (sólo local)
- **Build limpio de producción**: `verify-html-bundle` validaba `dist/index.html` leyéndolo del disco en `closeBundle`, así que un build sin `dist` previo fallaba ("dist/index.html no existe") y un `dist` viejo podía aprobarse. Ahora valida el `index.html` emitido por la compilación en `writeBundle` (OutputBundle en memoria): exige `div#root` y un script bajo `/assets/`.
- **CxP mostraba error como "sin datos"**: en `Cxp.tsx` la rama de cero filas sin filtros no excluía `isError`, así que un lote fallido montaba `CxpEmptyState` y el "Reintentar" quedaba inaccesible. Se agregó máquina de estados excluyente (loading/error/empty/data): en error se muestra `ErrorStateInline` con Reintentar y se ocultan KPIs y tabla.
- **Typecheck en Windows**: `VsRealSort.tsx` y `vsRealSort.ts` colisionaban (TS1149/TS1261). El componente se renombró a `VsRealSortableHeader.tsx` y se actualizó su import.
- Pruebas: `verifyHtmlBundle` (output válido, falta index/root/script) y `cxpEstados` (error+retry, loading, empty real, empty con filtros, data).
- Sin migraciones, deploy, publish, secretos ni cambios de datos.

## [13.823.16] - 2026-09-01
### Errores de Sentry: diagnóstico accionable en vez de "unknown error" (sólo local)
- **Causa** (JAVASCRIPT-REACT-5N / -5P): una consulta fallida (`embarques → dependencias-financieras`) devolvió un error sin mensaje y el normalizador lo titulaba `unknown error`, generando dos issues del mismo evento sin pista de la consulta afectada.
- **Corrección**: `queryErrorReporting` clasifica los errores sin mensaje como red/offline (`error_kind`, `http_status`) e incluye la consulta en el título del issue.
- **Causa** (JAVASCRIPT-REACT-5T): en móvil, un `FunctionsFetchError: Failed to fetch` se mostraba como "el servicio de captura por IA no está disponible" aunque la petición nunca salió del dispositivo.
- **Corrección**: `parsePdfInvoice` distingue falla de conexión del dispositivo y lo etiqueta (`network_failure`).
- Triage sin código: -5S y -5R ya corregidos (13.823.15 / 13.823.14), -5Q es timeout externo de FacturApi ya manejado, LIFTGO-1 pertenece a otra aplicación.
- Pruebas: normalización sin mensaje (online/offline), mensaje real preservado y mensajes de falla del PDF IA.
- Sin migraciones, deploy, publish, secretos ni cambios de datos.


## [13.823.15] - 2026-09-01
### Cotización nueva: ya no aparece "otro usuario modificó este registro" (sólo local)
- **Causa**: el wizard arrancaba el bloqueo optimista con sello `null` en cotizaciones nuevas, pero la base firma la fila al insertarla (`updated_at = created_at`). Al segundo guardado del mismo usuario el sello no coincidía y se lanzaba `LC_CONFLICTO_CONCURRENCIA` (reportado en COT-P-2026-0001, /cotizaciones/nueva paso 1).
- **Corrección**: `useCotizacionUpdateGuard` también envuelve `crearCotizacion` y siembra el sello con el `updated_at` de la fila creada; `updateCotizacion` deja de filtrar `.is("updated_at", null)` (rama imposible) y sin sello guarda sin bloqueo optimista. La protección contra ediciones de otra sesión se conserva.
- Pruebas: sello sembrado tras crear y `UPDATE` sin sello sin filtro de `updated_at`.
- Sin migraciones, deploy, publish, secretos ni cambios de datos.

## [13.823.14] - 2026-09-01
### Operaciones vuelve a poder subir facturas al buzón del embarque (sólo local)
- **Causa**: `adjuntar-xml-entrante` autorizaba con `ROLES_CAPTURA_CXP` (administración/contabilidad), mientras la UI (`SUBIR_FACTURA_ENTRANTE_EMBARQUE`) y la RPC `adjuntar_xml_factura_entrante` sí admiten a operaciones. Con rol `coordinador_logistico` el archivo se guardaba y el último paso (verificar el XML server-side) devolvía 403 "Requiere un rol con permiso de captura CxP".
- **Corrección**: nueva lista server-side `ROLES_ADJUNTAR_XML_ENTRANTE` (unión de operaciones + contabilidad + administración) y opción `rolesPermitidos` en `autorizarCxp`, que por omisión sigue siendo `ROLES_CAPTURA_CXP`. Sólo `adjuntar-xml-entrante` la usa; el parseo con IA (`parse-cfdi-xml`, `parse-invoice-pdf`) no cambia, y la autorización sigue corriendo antes de tocar Storage.
- **Mensaje** más claro en el cliente cuando el rol realmente no alcanza.
- Pruebas: Deno para operaciones/contabilidad/portales con cada lista, e invariante que obliga a que la lista del servidor coincida con `ADJUNTAR_XML_FACTURA_ENTRANTE` de la UI.
- Sin publish, migraciones o SQL remoto, secretos ni cambios de datos. Requiere desplegar `adjuntar-xml-entrante` para surtir efecto en producción.



## [13.823.13] - 2026-09-01
### CI verde: higiene de pruebas, manifiesto, baseline de soft-delete y tope de líneas (sólo local)
- **Título duplicado**: la prueba de lotes del portal del agente repetía literalmente el título de la de CxP; ahora dice de qué módulo es.
- **Manifiesto de release** regenerado para `13.823.13` (`db:release-manifest:update`) y **baseline de soft-delete** actualizada: las dos lecturas de CRM (`crm_leads`, `crm_oportunidades`) ya corregidas salieron de la deuda.
- **Tope de 250 líneas (lint)**: `parse-cfdi-xml/index.ts` movió la llamada opcional al AI Gateway a `parse-cfdi-xml/sugerirCategoria.ts`, y las pruebas de la guarda de CxP se separaron en `cxpGuardFixtures.ts` + `cxpGuard_test.ts` (membresía/rol) y `cxpGuardRateLimit_test.ts`. Sólo movimiento de código: la autorización sigue corriendo antes de leer el multipart y los 26 tests Deno pasan.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.12] - 2026-09-01
### Portal: la solicitud ya no se atribuye a la empresa equivocada y el historial del agente no se corta (sólo local)
- **Solicitud multicliente**: `PortalDashboard` y `PortalCotizaciones` pasaban `clienteIds[0]`, así que un usuario ligado a varias empresas mandaba la solicitud a la primera de la lista sin saberlo. Ahora el diálogo recibe todas las empresas autorizadas: con una sola se preselecciona (cero fricción) y con varias hay selector obligatorio con nombre legible, botón de envío deshabilitado hasta elegir y la elección se limpia al cerrar. Sin empresas vinculadas se explica el motivo y no se envía. La validación de pertenencia (`useSolicitarCotizacion` con todos los ids) queda intacta.
- **Nombres**: `fetchPortalClientUsers` trae `clientes(nombre)` por RLS y expone `cliente_nombre`; la UI no muestra UUIDs.
- **Historial del agente**: `fetchAgenteEmbarques` terminaba en `.limit(200)` y desaparecían los embarques 201+. Ahora se leen lotes consecutivos de 1000 hasta uno incompleto, con orden determinista (`etd` desc, nulls last, desempate por `id`); el error de cualquier lote se propaga. Contrato sin cambios.
- Pruebas nuevas: opciones/preselección del solicitante, 1 vs 2 vs 0 empresas, atribución exacta al elegir la segunda, reset al reabrir; y 250 embarques completos, 2100 con ETD igual sin duplicados, error en lote posterior.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.11] - 2026-09-01
### CxP ya no pierde facturas después de la fila 200 (sólo local)
- **Servicio**: `fetchFacturasCxP` eliminaba silenciosamente todo lo posterior a la fila 200 (un solo `.range(0,199)`), y los filtros derivados (estatus/origen) se aplicaban sobre ese recorte: una factura cuya única coincidencia estaba después decía "sin resultados" y los KPIs salían incompletos. Ahora se leen lotes consecutivos de 1000 hasta recibir un lote incompleto, con orden determinista (`fecha_vencimiento` asc, nulls last, desempate por `id`) para no omitir ni duplicar filas entre rangos. El error de cualquier lote se propaga: nunca se devuelve un resultado parcial como completo.
- **Contrato intacto**: sigue siendo `Promise<FacturaCxP[]>`. Se quitaron `page`/`pageSize` de `FetchCxPFiltros` (prometían paginación server-side inexistente) y las llamadas que pasaban `pageSize: 500`.
- **Servidor**: `estado_aprobacion` se filtra en Postgres (columna directa, misma semántica) para transferir menos filas; estatus y origen siguen resolviéndose en memoria sobre el conjunto completo.
- **Pantalla**: una sola paginación real (data completa filtrada → slice de página, `totalPages`/`total` desde `data.length`). Una página fuera de rango (deep link viejo o menos resultados tras filtrar) se acota a la última en vez de mostrar una tabla vacía engañosa. Se conservan búsqueda, inclusión de canceladas al buscar/filtrar, deep links, exportación y permisos.
- Pruebas nuevas: 250 facturas devuelven 250; 2100 con la misma fecha se leen en 3 lotes sin duplicados; filtros de estatus/origen/aprobación con la única coincidencia después de la 200; KPIs sobre el total; canceladas; error en lote posterior; y en la pantalla: factura 201 en la página 3, `total`/`totalPages` completos, página fuera de rango acotada, KPIs sobre el conjunto completo.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.10] - 2026-09-01
### Estados de carga/error mutuamente excluyentes en tableros y reportes (sólo local)
- **Dashboard Ejecutivo**: `useDashboardEjecutivo` compone el error de CxC/CxP como error del tablero. Antes, si una dependencia fallaba, el snapshot quedaba deshabilitado y React Query v5 lo reportaba `pending` sin error ni carga: pantalla en blanco permanente. Ahora `isLoading` suma la carga real de las dependencias (sin confundir "pending deshabilitado" con cargando) y el retry reintenta la fuente fallida además del snapshot. La página renderiza exactamente una rama: loading → error → vacío → data.
- **Dashboard Finanzas**: `useFinanceDashboard` ya no se traga los errores de CxC/CxP/tesorería; los propaga (`error`, `isError`, `refetch`). `FinanceDashboard` muestra `ErrorState` con retry en vez de tarjetas con KPIs en 0, que se leían como cifras reales.
- **Dashboard Dirección**: el cuerpo pasa a máquina de estados excluyente (loading → error → vacío → data). Antes podían coexistir la alerta de error y el skeleton.
- **Reportes**: el error excluye KPIs, gráfica y tabla, y el botón Reintentar recarga la fuente.
- Pruebas nuevas: Ejecutivo (CxC/CxP pending ⇒ loading; error de cada fuente ⇒ error visible sin blank/skeleton; retry sobre la fuente fallida; dependencias listas ⇒ data), Finanzas (cada fuente crítica fallando ⇒ error visible y ninguna tarjeta en 0 + retry), Dirección y Reportes (una sola rama por estado).
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.


## [13.823.9] - 2026-09-01
### Integridad CRM: soft-delete por URL y Undo falso a "Perdida" (sólo local)
- `getLead` y `getOportunidad` ahora exigen `deleted_at IS NULL`. Antes un lead/oportunidad eliminado seguía abriendo su detalle si se conservaba el UUID en la URL (las listas sí filtraban). Con `null` las rutas ya muestran "no encontrado" sin acciones ni datos residuales.
- `useMoverOportunidadEtapa` ya no ofrece Undo cuando la etapa destino es tipo `perdida`: esa transición cancela actividades pendientes y el Undo sólo restauraba etapa/probabilidad/cierre, dejando una oportunidad abierta con sus tareas canceladas. El Undo se conserva en transiciones sin efectos irreversibles.
- Pruebas nuevas: filtro `deleted_at` en ambos getters; destino perdida no llama `showUndoToast` y sólo ejecuta un movimiento tras confirmar el motivo; transición ordinaria sí ofrece Undo.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.8] - 2026-09-01
### Divisas no soportadas fuera de los KPIs de Dirección (sólo local)
- `mxnFactura` y `toMxn` normalizan la moneda y aceptan únicamente MXN/USD/EUR. Antes delegaban en `aMxn`, que acepta cualquier divisa si trae `tipo_cambio` directo válido: `mxnFactura(100, "JPY", 3, …)` sumaba 300 MXN a los KPIs. Ahora una divisa fuera del catálogo del tablero aporta 0 aun con TC directo. `aMxn` (canon global) no cambia.
- Pruebas nuevas: JPY con TC directo válido ⇒ 0 en `mxnFactura` y en `toMxn`.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.7] - 2026-09-01

### Precisión de moneda y fecha de negocio en Dirección (sólo local)
- **Fallback de TC por moneda**: `mxnFactura` recibe ahora `{ usd, eur }` en vez de un único `fallbackUsd`. MXN = 1; USD/EUR usan el TC de la factura y, si falta, el fallback de SU moneda; una divisa desconocida o sin fallback propio aporta 0 en vez de valuarse con el TC del dólar (antes una factura EUR sin TC salía en MXN con el TC USD: cifra creíble pero falsa). `useDireccionKpis` propaga `usdMxn` y `eurMxn` desde `useExchangeRates` y ambos entran en la `queryKey` para invalidar bien; `saldoCartera` convierte el saldo neto con el fallback de su moneda y `facturado_mes_mxn` sigue el mismo contrato.
- **Mes de negocio en America/Mexico_City**: `mxn.ts` sustituye la semántica UTC (`ym`/`inicioMesUtc`) por `mesNegocio` (= `ymMx`) y `mesMasOffset`, aritmética mensual pura sobre `YYYY-MM`. `ventanaDireccionDesdeIso` devuelve el primer día del mes de hace 5 meses, date-only y sin depender de la TZ del runner; `calcularMargen6m`, `fetchDireccionKpis` y el pulso (`arribos_7d`, demoras) usan el día/mes de México. Antes el tablero cambiaba de mes a las 18:00 CDMX.
- **Vencimiento con criterio único**: `calcularHero` deja de usar `T00:00:00Z` y aplica `diasVencidos(fecha_vencimiento, hoy) > 0`, igual que el aging: una factura que vence HOY no cuenta como vencida ni en monto ni en clientes.
- **`src/lib/date/today.ts`**: `todayLocalISO` delega en `hoyMx` y `todayLocalISOPlus` suma días date-only sobre `parseLocalMx`, así que ya no dependen de la zona del navegador.
- Sin deploy, publish, Edge deploy, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.6] - 2026-09-01
### Canon exacto de saldo en cartera de Dirección (sólo local)
- **Nuevo helper puro `saldoCartera.ts`**: el saldo se calcula EN MONEDA DE FACTURA y sólo el neto se valúa a MXN con el TC de la factura (o el fallback vigente).
  - `pagos_factura.monto_aplicado_factura` ya viene convertido a moneda de factura por `tg_pagos_factura_monto_convertido`, así que **ya no se reconvierte** con la moneda/TC del pago (antes había doble conversión cuando pago y factura diferían de moneda).
  - Las NC de cliente se convierten con las reglas exactas de `public.nc_aplicadas_en_moneda_factura`: misma moneda usa el monto nominal; MXN←divisa usa el TC de la NC; divisa←MXN usa el TC de la factura; divisa←divisa exige ambos TC. Si falta un TC requerido la NC aporta 0, sin fallback inventado y sin doble descuento.
- `calcularAntiguedad` y `calcularHero` consumen el helper único; no se agregó una tercera semántica ni se tocó la base de datos.
- **UI**: `SaldosBancosCard` ya no inserta un "Total MXN 0" artificial; el footer lista únicamente las monedas presentes (una organización sólo con EUR muestra sólo Total EUR).
- Sin deploy, publish, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.5] - 2026-09-01
### Exactitud financiera (YAGNI, sólo local)
- **Cartera/aging de Dirección con notas de crédito**: `loadCarteraAbierta` ahora trae también las NC de cliente **aplicadas y vigentes** (`estado = 'Aplicada'`, `deleted_at IS NULL`) y `calcularAntiguedad`/`calcularHero` aplican el canon de Cobranza `saldo = total − pagos − NC aplicadas` (mismo criterio que `cobranza_listado` / `nc_aplicadas_en_moneda_factura`). Las NC en borrador, aprobadas, timbradas, canceladas o eliminadas no restan; una factura cubierta por pagos + NC desaparece del aging y del total/conteo de cartera vencida. Se conserva la cobertura de facturas antiguas (sin ventana de 6 meses) y la conversión a MXN equivalente por moneda.
- **EUR completo en el Dashboard Ejecutivo**: el agregador propaga `tipoCambioEur` y `tipoCambioFecha` junto al USD a `fetchResumenTesoreria` y `fetchFlujoProyectado`; si el TC EUR es estimado (fallback) no se envía, de modo que el dominio marca el saldo/flujo como incompleto y conserva el importe nominal en vez de excluirlo en silencio o valuarlo en cero. `SaldosBancosCard` calcula un total por cada moneda realmente presente (MXN, USD, EUR y cualquier otra), en lugar del footer fijo MXN/USD.
- Sin deploy, publish, migraciones o SQL remoto, secretos ni cambios de datos.

## [13.823.4] - 2026-09-01
- **Autorización CxP antes del cuerpo del request**: la organización objetivo viaja ahora en el header `X-Organization-Id` (agregado a la whitelist CORS) y `parse-cfdi-xml` / `parse-invoice-pdf` ejecutan `autorizarCxp` inmediatamente después de autenticar, ANTES de `req.formData()`, `file.arrayBuffer()`, la conversión base64 y cualquier llamada a IA. Se conservan los cortes por `Content-Length` y los topes reales de tamaño; ya no se confía en el `organization_id` del multipart.
- **UUID tolerado por el sistema**: la validación pasa a `_shared/uuid.ts` (8-4-4-4-12 hex, sin exigir versión ni variante RFC), de modo que la organización principal real `00000000-0000-0000-0000-000000000001` deja de ser rechazada con 400. Cambio probado únicamente en local, sin deploy, publish, migraciones/SQL remoto, secretos ni datos.

## [13.823.3] - 2026-09-01
- **Hotfix local de autorización CxP**: el rate limit sólo autoriza respuestas estrictas `{ ok: true }`; respuestas nulas o malformadas fallan con 503. Los parsers usan la organización activa explícita y `adjuntar-xml-entrante` deriva el tenant desde el documento antes de autorizar o descargar Storage. Cambio probado únicamente en local, sin deploy, publish, migraciones/SQL remoto, secretos ni datos.

## [13.823.2] - 2026-09-01
### Pruebas Deno del CI en verde (sin cambios funcionales)
- **Guardas de correo actualizadas**: `emailSendLog_test.ts` y `redact_test.ts` apuntaban a `send-transactional-email`, `process-email-queue` y `handle-email-unsubscribe`, retiradas al migrar a la entrega administrada de Lovable (v13.818.0). Ahora validan el pipeline vigente (`_shared/enviarEmailPlantilla.ts`, `_shared/emailSendLog.ts`, `handle-email-events`): upsert obligatorio vía RPC `email_send_log_touch`, registro de `sent`/`suppressed`/`failed` y cero correos crudos en `console.*`.
- **`react-dom` anclado a 18.3.1**: el peer de `@react-email/render@0.0.17` no quedaba fijado y Deno lo resolvía a react-dom 19, con el error "Incompatible React versions" al cargar las plantillas de correo (rompía `enviar-factura-email/helpers_test.ts` y el render real). Se agrega el pin explícito en `send-email.ts`.
- **`facturapi-cancelar-rep/index_test.ts`**: las guardas N5 leen también `resultadoCancelacion.ts`, donde vive la ramificación desde v13.823.1.

## [13.823.1] - 2026-09-01
### Higiene de código y CI (sin cambios funcionales)
- **Código muerto eliminado**: se retiran ~45 exports y tipos sin uso detectados por `knip strict` (barrels de servicios de auth, catálogos, configuración, operaciones, reportes y búsqueda; `useCotizaciones` sustituido por paginación server-side; `TRACKING_LINK_DIAS_MAX`; helpers de `tcPar`, `porVencer` y `errors/concurrencia` que ya no se consumían).
- **Power of 10**: `facturapi-cancelar-rep/index.ts` baja de 200 líneas extrayendo `resolverResultadoCancelacion.ts`, y `parse-cfdi-xml` extrae `validarEntrada()` para bajar la complejidad ciclomática de `handle` de 18 a ≤16.
- **Estructura**: `useNuevoUsuarioForm` se mueve a `src/features/admin/hooks/`.
- **Tests**: se corrigen títulos duplicados en `nuevoUsuarioPrivacidad` y `useTimbrarRep`; se registra la suite `buzon_localizar_duplicado_org_scope.sql` en el manifiesto de guards; se evitan falsos positivos de `queryCaps` en comentarios de servicios globales de CxP.
- **Manifiesto de release**: `migration-manifest.json` se sincroniza (1199 migraciones) para la versión vigente.

## [13.823.0] - 2026-09-01
### Ola P2 · Seguridad de Edge Functions (superficie pública y de IA)
- **`parse-cfdi-xml` con guarda de CxP**: exige membresía de organización, rol con permiso de captura CxP y rate limit persistente fail-closed (por usuario y por organización), igual que `parse-invoice-pdf`. Además corta temprano por `Content-Length` (~2.2 MB) y acota el catálogo de categorías a 32 KiB.
- **Guarda compartida `_shared/cxpGuard.ts`**: se extrae la lógica de autorización + rate limit de CxP para no duplicarla en tres funciones; `parse-invoice-pdf/guardas.ts` ahora delega en ella.
- **`facturapi-webhook` con cuerpo acotado**: endpoint público sin JWT por diseño; ahora lee el body en streaming con tope real de 256 KiB (`MAX_WEBHOOK_BYTES`), responde 413 si se excede y calcula el HMAC sobre los bytes exactos aceptados.
- **`facturapi-reconciliar-cancelaciones`**: la comparación de `X-Cron-Secret` usa `timingSafeEqual` y es fail-closed si falta el secreto o el header.
- **`adjuntar-xml-entrante` autoriza antes de tocar Storage**: aplica la guarda de CxP y valida que el documento del buzón exista, pertenezca a la organización del actor, esté `por_capturar` y que el `xml_path` caiga en su prefijo canónico `{org}/{embarque}/` antes de descargar con la llave de servicio. "No existe" y "es de otra organización" devuelven el mismo 404 para no servir de oráculo.

## [13.822.1] - 2026-09-01
### Conciliador de cancelaciones · presupuesto de tiempo (P1-3b)
- **Corte por tiempo real, no sólo por número de documentos**: la corrida del cron `facturapi-reconciliar-cancelaciones` ahora tiene un presupuesto monotónico de 95 s (límite de runtime asumido: 150 s). Antes de iniciar cada documento se comprueba el presupuesto; lo que no alcanza a iniciarse queda intacto para la corrida siguiente en vez de morir a medias con el mutex ocupado.
- **Equidad preservada**: el barrido recorre un plan intercalado (round-robin) entre organizaciones y entre facturas, notas de crédito y REP, así que cortar por tiempo no favorece a una familia ni a una organización.
- **Resumen honesto**: se agrega `diferidos` al resumen; los documentos diferidos por presupuesto no se cuentan como errores.
- **Timeout por consulta**: `invoices.retrieve` baja de 15 s a 12 s en el cron para que una consulta iniciada al filo del presupuesto no rebase el margen de respuesta y liberación del lock.
- **Cursor sólo de documentos iniciados**: `reconciliacion_checked_at` / `rep_reconciliacion_checked_at` se marcan únicamente en documentos que sí se procesaron.

## [13.822.0] - 2026-09-01
### Ola P0/P1 · Seguridad, compilación y multimoneda
- **Envío de facturas por correo (P0-1)**: `facturapi-enviar-email` vuelve a compilar y es deployable; se expone `resolverDestinatarioAutorizado` y se limpian campos muertos de la bitácora.
- **Cancelaciones inciertas de REP y notas de crédito (P1-2)**: si FacturApi no confirma pero el estado quedó persistido como `verifying`, ambas Edge Functions responden 202 `{ ok, pending, uncertain, cancellation_status }` en lugar de un error definitivo. La UI muestra un aviso informativo, refresca y bloquea una segunda cancelación mientras el estado sea `pending`/`verifying`.
- **Conciliador de cancelaciones (P1-3)**: se agregan cursores `..._checked_at` y un presupuesto global con recorrido round-robin entre facturas, REP y notas de crédito, así que ningún tipo de documento vuelve a quedarse sin revisar por falta de tiempo. El cursor se marca incluso cuando un elemento falla.
- **Segregación fiscal por organización (P1-4)**: la resolución de credenciales de FacturApi es fail-closed por organización; el fallback heredado queda restringido a una única organización explícita.
- **CRM multimoneda (P1-5)**: pipeline, forecast, leaderboard y Cliente 360 dejan de sumar monedas distintas y de etiquetar todo como MXN; los totales se presentan separados por moneda y ya no se truncan a los primeros registros visibles.
- **Cartera de Dirección (P1-6)**: la cartera abierta ya no se recorta a 6 meses (eso aplica sólo a la tendencia), así que la antigüedad refleja el total real por cobrar.
- **Tesorería en EUR (P1-7)**: los saldos, flujos y vencidos en EUR se convierten con su propio tipo de cambio; sin TC confiable el monto no se suma y el consolidado se marca como incompleto.

## [13.821.6] - 2026-09-08
- **Cancelación de CFDI con timeout de FacturApi**: si FacturApi tarda en confirmar pero la solicitud ya quedó registrada como `verifying`, la Edge `facturapi-cancelar` responde 202 `{ pending, uncertain }` en lugar de 504. La UI muestra un aviso informativo ("estamos verificando el estado; no vuelvas a cancelarla"), refresca la factura y ya NO ofrece reintentar la cancelación; el reconciliador automático y "Verificar estatus" resuelven el resultado real. Si no se pudo persistir el estado, se sigue devolviendo error 5xx observable.
- **Timeout dedicado**: `invoices.cancel` usa 22 s (`FACTURAPI_CANCEL_TIMEOUT_MS`) para dejar margen a persistir el estado y responder antes del límite de ejecución. Los demás timeouts del SDK no cambian.

## [13.821.5] - 2026-09-08
- **Exportar CSV de cotizaciones (accesibilidad)**: el botón deshabilitado ya no usa el atributo nativo `title` (prohibido por la auditoría de arquitectura); la causa se expone como descripción accesible con `aria-describedby`.
- **Timbrado**: se restaura la llamada literal `facturapi.invoices.create(payload)` en `facturapi-emitir` (estrechando el tipo del SDK antes del `try`), que los guards de Deno verifican para asegurar que el SDK sólo se invoque ahí.

## [13.821.4] - 2026-09-08
- **Timbrado: errores de FacturApi con tipos correctos**: la Edge Function `facturapi-emitir` ya no castea el SDK "a ciegas"; se estrecha al método que usa y reutiliza `extractFacturapiMessage` para el mensaje en español. Antes el CI de Deno fallaba al compilar.
- **Exportar CSV de cotizaciones**: el botón deshabilitado vuelve a explicar por qué (aviso nativo `title`), porque un botón deshabilitado no dispara el tooltip.
- **Mensajes amigables completos**: se agregaron los 7 códigos `LC_*` que faltaban (argumento inválido, tipo de cambio de crédito, cliente/cotización/proveedor de embarque, idempotencia), así que el usuario deja de ver códigos crudos.
- **Estado de resultados devengado**: la consulta de expedientes ahora excluye facturas canceladas o sustituidas, igual que el resto de la reportería.
- **Cierre de embarque (LCL)**: se reemite el cuerpo vigente de `validar_cierre_embarque` como migración nueva para que el orden de replay quede correcto. Sin cambios de comportamiento: la base ya validaba fechas de contenedor sólo en marítimo FCL.
- **Auditorías del CI**: el archivo consolidado del squash queda exento de los auditores de funciones/espejos, el manifiesto se compara contra la versión actual (las entradas históricas son bitácora) y los tests de servicios buscan la escritura por tabla en lugar de asumir que es la última.

## [13.821.3] - 2026-09-01
- **Trigger de alta restaurado en bases limpias**: el squash se generó con `pg_dump --schema=public`, así que el trigger `on_auth_user_created` (que corona al primer usuario y crea su organización) se quedaba fuera y las suites de aprovisionamiento fallaban. Ahora el squash lo recrea y `_ci_post_migrate.sql` siembra un usuario centinela con `super_admin`, para que ninguna suite se corone por accidente.
- **Tablero: el mes se calcula en hora de México**: `dashboard_summary_datos()` usaba `current_date` (UTC), así que a partir de las 18:00 hora de México brincaba al mes siguiente y dejaba de sumar los gastos operativos y los arribos del día. Ahora usa el mismo canon horario (CDMX) que el detalle del tablero y los periodos fiscales.
- **Linter de org-scope**: `idempotency_store` salió de la whitelist — desde la Ola P1 ancla por organización, así que la entrada muerta ya sólo generaba ruido.
- Suite completa (`db:verify --all` y `db:postcheck`) en verde y baseline de esquema regenerada.

## [13.821.2] - 2026-09-01
- **CI `ci:fast` más rápido y estricto**: vitest arranca primero (con `--maxWorkers` acotado a los cores disponibles menos 2 para no pelear con ESLint/TSC), las auditorías ligeras corren fusionadas, los flags `--only/--skip` fallan si nombran una tarea inexistente y se conservan sólo los 5 directorios de log más recientes.
- **Mock compartido de Supabase**: `createSupabaseMock()` ya expone `auth.getUser/getSession` y `storage.remove`. Antes los tests de servicios que sellan `user_id` o limpian archivos morían con "Cannot read properties of undefined (reading 'getUser')" en vez de probar la regla de negocio.
- **Tests del buzón CxP**: los casos de duplicado ahora simulan la RPC canónica `buzon_localizar_duplicado` (fuente de verdad desde v13.819.2) en vez de la consulta directa a la tabla, y esperan los mensajes vigentes. `lint`, `typecheck`, auditorías y las 1233 pruebas quedan en verde.

## [13.821.1] - 2026-09-01
- **Suite de pruebas (limpieza)**: la guard SQL `supabase/tests/ola_p1_guards.sql` quedó registrada en `supabase/tests/_guards_manifest.txt`, así que ahora CI la ejecuta de verdad (8 aserciones P1-1…P1-4 verificadas en verde localmente) en lugar de existir como cobertura ficticia.
- **Guardrail Fase L**: dejó de exigir el error `LC_PAGO_CRUCE_NO_SOPORTADO`, eliminado cuando los cruces con EUR empezaron a pivotear en MXN (M-2, Ola 4 · v14). Ahora valida el contrato vigente (`LC_PAGO_TC_REQUERIDO`, `LC_PAGO_TC_FACTURA_REQUERIDO`, `IMMUTABLE` y privilegios) leyendo `supabase/schema/baseline.sql`, la fuente de verdad del esquema.
- **Guardrail Fase I**: la validación de tipo de cambio ya no vive como `tcFactura === 1` dentro de `facturapi-emitir`, sino en la banda fiscal compartida (`_shared/tcBanda.ts`, 5–40 MXN por divisa). El test ahora prueba el comportamiento de esa banda y que `facturapi-emitir` responda 422 `tipo_cambio_requerido`.

## [13.821.0] - 2026-09-01
- **Squash de migraciones (CI y verificación local)**: el historial hasta `20260908000300` quedó consolidado en `supabase/schema/squash/baseline_squash_v13_821_0.sql`, verificado byte a byte contra `supabase/schema/baseline.sql`. Las bases limpias (CI y `bun run db:verify`) aplican ese archivo y luego sólo las migraciones posteriores al corte de `supabase/schema/squash/cutoff.env` (fuente única compartida). Los 1193 archivos históricos se conservan en `supabase/migrations/` como bitácora auditable —ya están aplicados en producción y no se re-ejecutan—, así que nada cambia en la base productiva.
- **CI más simple**: se eliminaron el paso `_ci_drift.sql`, las exenciones `MIGRACIONES_EXENTAS`/`drift-anclas.txt` y el job "Drift radar" completo: el squash ya representa el estado real, por lo que cualquier migración nueva debe aplicar en limpio sin parches.

## [13.820.7] - 2026-09-01
- **Inicio (tablero)**: los roles operativos (coordinador logístico, operador, vendedor, customer service, agente de carga) veían "No pudimos cargar la información" en `/inicio` por el error `LC_DASHBOARD_SIN_PERMISO`. El resumen del tablero volvió a su cuerpo canónico: responde a todos los roles internos y sólo enmascara costo, utilidad y margen para quien no puede verlos (ese enmascarado ya lo hacía la RPC pública).

## [13.820.6] - 2026-09-08
- **Cierre de embarques LCL**: el checklist de cierre ya no exige "Fechas de descarga y devolución capturadas" en embarques que no son Marítimo FCL (LCL, aéreo, terrestre). En LCL el contenedor es compartido y no hay descarga/devolución que capturar, aunque exista la fila de agrupación en Contenedores; la regla ahora sólo aplica a contenedor completo, igual que "Datos de contenedores completos".


## [13.820.5] - 2026-09-08
- **Factura de proveedor desde el buzón**: si la captura viene de un documento del buzón CxP, la factura hereda el embarque del documento aunque el usuario no marque conceptos de costo. Antes quedaba "sin embarque" (caso FP-000195, ya vinculada a ELIMP00292).



## [13.820.4] - 2026-08-31
- **Checklist de cierre**: el paso "Recibimos la factura de cada proveedor" ya reconoce los costos ligados a una factura de proveedor vigente aunque esa factura se haya capturado directo desde Costos (sin pasar por el buzón). Antes un embarque con todos sus costos facturados seguía marcando "faltan facturas del proveedor" y no podía cerrarse.

## [13.820.3] - 2026-08-31
- **Eliminar embarque**: la pantalla se alineó con la regla real de la base de datos: ahora se puede eliminar un embarque en `Entregado`, `EIR` o `Por liquidar` si no tiene facturas, cuentas por pagar, pagos, comisiones ni proformas ligadas. Sólo `Cerrado` y `Cancelado` siguen bloqueados por estado.

## [13.820.2] - 2026-08-31
- **Eliminar embarque**: el menú "Más acciones" ahora explica por qué la opción no aparece (estado final del embarque, CxC/CxP pendientes o rol sin permiso) en lugar de dejar el hueco sin mensaje.



## [13.820.1] - 2026-08-31
- **Consistencia repositorio ↔ base**: los archivos canónicos de `a_mxn`, `_crear_embarque_replicar_conceptos` y los wrappers de auditoría de embarques se regeneraron 1:1 desde la definición vigente, así que ya reflejan las reglas M-8/M-10/N-1 y no reintroducirían versiones viejas en un replay limpio. Se re-emitió sin cambios de comportamiento la regla interna de costos repetidos (ahora sólo ejecutable por el backend) y se sincronizó su candado en CI. Sin cambios visibles para el usuario.

## [13.820.0] - 2026-08-31
- **Liquidaciones de comisión**: cancelar una liquidación vuelve a exigir el rol financiero **en la organización dueña** de la liquidación (antes bastaba tenerlo registrado en cualquier organización; una migración posterior había revertido el candado). La liquidación se bloquea primero y luego se autoriza, así que dos cancelaciones simultáneas no se cruzan.
- **Crédito del cliente al timbrar**: el crédito en uso ahora convierte cada nota de crédito a la moneda de su factura antes de restarla, así que una NC en dólares sobre una factura en pesos (o al revés) deja de subestimar o inflar la exposición. Si una factura extranjera viva no tiene tipo de cambio válido (vacío, cero, 1 o fuera de la banda 5–40), el timbrado se detiene con "crédito no verificable" en vez de asumir paridad 1:1.
- **Claves de idempotencia**: la identidad de cada clave ahora es clave + organización + usuario, y se valida que el reintento corresponda a la misma operación. Dos organizaciones (o dos usuarios) que reusen la misma clave ya no se pisan respuestas ni se bloquean entre sí; reusarla para otra operación se rechaza con error explícito. `anon` perdió todo acceso directo a la tabla y `authenticated` ya no puede borrar claves.
- **Crear y editar embarque**: cliente, cotización y proveedores de los costos se validan contra la organización del usuario y deben estar vivos antes de escribir nada; la cotización además debe estar aceptada o en operación. Antes un identificador ajeno podía quedar guardado en el embarque.
- En todas las operaciones anteriores la autorización se resuelve **antes** de reclamar la clave de idempotencia, para que un intento sin permiso no consuma la clave del usuario legítimo.
- Cobertura: nueva suite conductual `supabase/tests/ola_p1_guards.sql` (aritmética multimoneda del crédito, fail-closed de tipo de cambio, aislamiento de idempotencia y rechazos entre organizaciones).


## [13.819.3] - 2026-08-31
- **Capturar factura de proveedor (Compras › Facturas)**: "Cancelar" ya no descarta la captura en silencio. Con datos capturados, Cancelar, la X, Escape y el clic fuera pasan por la misma confirmación del resto de los formularios ("Descartar" / "Seguir capturando").
- Al descartar, el asistente se limpia por completo (conceptos, archivos, campos y paso), así que la siguiente apertura empieza en blanco. Antes el borrador sobrevivía y los renglones de concepto vacíos se acumulaban en cada apertura.
- Agregar un renglón de concepto vacío (sin descripción y en $0) ya **no** cuenta como captura: no dispara la confirmación al cerrar y no deja basura para la próxima vez. Un concepto con descripción o importe real sí protege la captura.
- Sin cambios el diálogo cierra directo, y tras guardar con éxito cierra sin preguntar nada.

## [13.819.2] - 2026-08-31
- **Factura de proveedor duplicada desde Costos del embarque**: al subir un XML/PDF ya capturado, el aviso ahora dice **dónde está** el documento en vez de mandar a "Compras › Facturas" (sección que roles como coordinador logístico no ven). Se distingue: ya registrada en este embarque, registrada en otro embarque de la organización (con su expediente), registrada en Compras sin embarque vinculado, pendiente de captura en el buzón, y duplicado de otra organización (mensaje genérico, sin revelar folios ni identificadores ajenos).
- El origen de verdad es la nueva función de base `buzon_localizar_duplicado` (consulta, sin escrituras), que aplica el aislamiento entre organizaciones; el cliente ya no arma búsquedas propias. El conflicto viaja con código estable `BUZON_FACTURA_DUPLICADA` (409) y metadatos seguros.
- El aviso aparece en línea dentro del diálogo del buzón, con el botón **Ver embarque** sólo cuando el rol tiene acceso a embarques y el destino es otro embarque; nunca navega solo. Sin permiso se muestra el expediente y la orientación, sin enlace a una sección prohibida.
- Se conservan sin cambios la subida de facturas nuevas, la deduplicación por hash y la traducción del resto de errores.

## [13.819.1] - 2026-08-31
- **Cotización nueva (P2)**: en el paso 1 del wizard, "Cancelar" ya no descarta la captura en silencio; pide confirmación cuando hay datos escritos (igual que el "Volver" del encabezado) y no advierte si se guardó bien. En los pasos siguientes sigue funcionando como "Anterior", sin diálogo.
- **Portal del agente · Nueva tarifa (P2)**: el botón "Cancelar" del diálogo pasa por la misma confirmación de cambios sin guardar que la X, Escape y el clic exterior; tras guardar deja de advertir.
- **Tarjeta "Por pagar" del inicio (P1)**: el rol Contador ya no cae en "Sin acceso" al usarla. La bandeja `/compras/por-pagar` sigue siendo de tesorería/administración (no se ampliaron permisos): para Contador la tarjeta lleva al listado de facturas de proveedor, que ve en su menú y tiene el mismo significado en modo consulta.
- **Cotizaciones (P3)**: "Exportar CSV" queda deshabilitado cuando los filtros no devuelven resultados, con la causa visible en el tooltip.
- **Sin acceso (P3)**: "Cerrar sesión" ahora sí regresa a la pantalla de inicio de sesión en lugar de quedarse en el mensaje genérico.

## [13.819.0] - 2026-08-31
- **YG-01 · Crédito en facturación (P1)**: al timbrar una factura en moneda distinta de MXN, el límite de crédito ya no se calcula nunca con tipo de cambio 1 implícito. Si el T/C es nulo, 0, 1 o cae fuera de la banda fiscal (5–40 MXN/USD), el timbrado responde 503 `credito_no_verificable` antes de calcular.
- **YG-02 · Liquidaciones de comisiones (P1)**: `registrar_pago_liquidacion` y `cancelar_liquidacion_comision` cargan la liquidación con `FOR UPDATE` y autorizan el rol **dentro de la organización dueña del registro** (antes bastaba tener el rol en cualquier organización). Se conserva la excepción explícita de `super_admin`. Nueva migración (`20260831211719`), espejos canónicos y guard SQL cross-org.
- **YG-03 · Listado de cotizaciones (P1)**: el listado dejó de traer un tope de 1000 filas para filtrar en el navegador. Búsqueda, estado, cliente, segmento, "sin costos", inactivas y "aceptadas sin embarque" se resuelven en el servidor; el total y la paginación vienen de la base y la exportación descarga todo lo filtrado por lotes, sin truncar. El filtro "sin costos" también se resuelve en la base (sin pre-cargar ids topados a 1000 filas).
- **YG-04 · Pérdida de captura (P2)**: los formularios largos (alta de proveedor, nota de crédito de cliente y de proveedor, facturas de proveedor, registro/edición de pagos, movimientos y traspasos bancarios) piden confirmación al cerrar con X, Escape o clic exterior si hay datos capturados, y dejan de avisar al guardar.
- **YG-05 · Mensajes de nota de crédito (P2)**: los errores internos `LC_*` ya no se muestran al usuario; se traduce el mensaje en español y el código crudo queda sólo en la bitácora técnica.
- **YG-06 · Botones deshabilitados (P2)**: el alta de proveedor y la nota de crédito indican en línea qué falta para avanzar, guardar o timbrar, reutilizando el aviso de faltantes existente.
- **YG-07 · Folios (P3)**: la búsqueda de folio de cotización excluye registros eliminados.
- Power-of-10: la validación del paso 1 del alta de proveedor y la detección de cambios sin guardar (pago de proveedor, traspaso) se movieron a helpers puros para respetar los límites de tamaño y complejidad.
- Cierre (revisión de commit): se eliminó la migración YG-02 duplicada con timestamp futuro (`20260908000000`); queda sólo `20260831211719`, con espejos canónicos y baseline de esquema regenerados. El baseline del auditor de migraciones bajó a `20260907000000`.
- Pruebas: 5 guards SQL que insertaban clientes sin correo (requisito NOT NULL) quedaron corregidos; la verificación local de base vuelve a verde.

## [13.818.1] - 2026-08-31
- **Corrección (Sentry JAVASCRIPT-REACT-1G / JAVASCRIPT-REACT-5M)**: el botón "Ver demo" del login fallaba con error 500 porque el sembrado de la cuenta demo creaba los embarques con fecha de hoy y luego insertaba eventos de rastreo de hasta 45 días atrás, rechazados por el guard `LC_EVENTO_ANTERIOR_A_EMBARQUE`. Ahora cada embarque demo se crea con la fecha de su zarpe (ETD), por lo que la historia sembrada es coherente. Verificado en base local: el sembrado corre sin error.

## [13.818.0] - 2026-08-31
- **Correo**: el envío de correos (autenticación, cotizaciones, proformas, facturas, recordatorios y estados de cuenta CxC) pasó a la entrega administrada de la plataforma. Se eliminó la cola interna (`process-email-queue`, `send-transactional-email`, `handle-email-suppression`, `handle-email-unsubscribe`) y la baja de suscripción ahora la hospeda la plataforma (se retiró `/unsubscribe`).
- Se agregó el receptor de eventos de entrega (rebote, queja, baja) que sigue registrando en `email_send_log` y `suppressed_emails` con los mismos estados; las tablas históricas se conservan intactas.
- Base: la migración de infraestructura de cola se reemplazó por `20260604052500_email_data_tables.sql` (sólo las tablas de datos) y las sentencias heredadas sobre las funciones de cola quedaron blindadas con `to_regprocedure`. Baseline regenerado.

## [13.817.3] - 2026-08-31
- Power-of-10: se dividieron 9 archivos productivos que superaban 200 líneas (auditoría, factura manual, reportes de compras, cobro en lote, wizard de cotización, estado de resultados, helpers CxP y `DialogRegistrarPago`) extrayendo lógica pura, constantes y subcomponentes. Sin cambios de comportamiento; `architecture-baseline.test.ts` vuelve a verde.

## [13.817.2] - 2026-08-31
- CI/FIX-H6-23: se re-aplicaron los permisos canónicos REVOKE/GRANT a funciones `SECURITY DEFINER` creadas en migraciones inmutables de Ola 7 v15, Ola 8 v15 y Ola 1 reabrir/cancelar. El baseline del auditor de migraciones se elevó a `20260908000000` para marcar esos archivos como legacy auditado.

## [13.817.1] - 2026-08-31
- CI: se quitó `purge_app_logs_old` de la whitelist del linter org-scope (ya no es ejecutable por `authenticated` desde la Ola 10 YAGNI); la suite `rpc_org_scope_linter` vuelve a verde.

## [13.817.0] - 2026-08-31
- Timbrado: los errores de `facturapi-emitir` muestran mensaje en español (sesión expirada, sin permiso, factura no encontrada) en vez del slug técnico.
- Lint/Power-of-10: se redujo la complejidad de `loadDraft`, `updateCotizacion`, `NuevoEmbarque` (pasos extraídos a `NuevoEmbarquePasos`) y la validación de `useTraspasoForm`, sin cambios de comportamiento.

## [13.816.0] - 2026-08-31

- **Fix · reasignación de pagos concurrente (`reasignar_pago_factura`)**: dos reasignaciones simultáneas del mismo pago (doble clic) leían la fila viva antes de que la otra la diera de baja y duplicaban el importe en la factura destino. Ahora el pago se lee con `SELECT ... FOR UPDATE` y se revalida tras el lock; la segunda recibe `LC_REFACT_PAGO_NO_ENCONTRADO`. Además el saldo destino usa el canon `nc_aplicadas_en_moneda_factura` y la tolerancia de sobrepago se unificó con el trigger (0.005).
- **Fix · saldo de cobranza con notas de crédito en otra moneda**: `cobranza_listado` y `cobranza_agregados` sumaban `monto` crudo de las NC (restando dólares a facturas en pesos). Ahora usan la función canónica `nc_aplicadas_en_moneda_factura`, igual que `saldo_factura` y `cartera_pendiente`.
- **Fix · captura perdida en Cobro en lote**: cualquier refetch de las facturas candidatas reiniciaba el formulario y regeneraba el `request_id`, rompiendo la idempotencia del reintento. El estado se inicializa una sola vez por apertura del diálogo (mismo patrón que `DialogRegistrarPago`).
- **Fix · búsqueda de cobranza con comodines**: `%` y `_` tecleados por el usuario se escapan con `escapeIlike` antes de llamar a `cobranza_listado`.
- **Fix · estado de cuenta con error técnico**: los fallos de la Edge Function se leen con `parseFunctionError` para mostrar el motivo real en lugar de "Edge Function returned a non-2xx status code".


## [13.815.0] - 2026-08-31

- **Fix · A-2 · saldo programable sin notas de crédito (Tesorería)**: `fetchPagosProgramables` calculaba `total - pagos` y proponía pagar más de lo debido cuando la factura tenía notas de crédito aplicadas. Ahora resta las NC con el mismo canon que `saldo_factura_proveedor` y el listado de CxP (helper compartido `sumarNotasCreditoAplicadas`).
- **Fix · A-3 · recordatorios de cobranza con error técnico**: los fallos de la Edge Function (p. ej. destinatario fuera de los contactos del cliente) llegaban como "Edge Function returned a non-2xx status code". Ahora se lee el motivo del body con `parseFunctionError`.
- **Fix · A-4 · búsqueda de embarques con comodines**: `%` y `_` tecleados por el usuario actuaban como comodines de ILIKE. El término se escapa con el helper existente `escapeIlike` antes de llamar a `embarques_listado`.
- **Fix · A-5 · match de conceptos por posición**: cuando el nombre no coincidía, el P&L de la cotización emparejaba costo↔venta por índice y podía asignar el importe al concepto equivocado en silencio. Se eliminó el fallback posicional: sin coincidencia de nombre el costo queda sin venta emparejada.


## [13.814.0] - 2026-08-31

- **Fix · "guardado" falso en embarques y cotizaciones**: los UPDATE directos de embarque (`embarqueDirectMutations`) y el cambio de estado de cotización (`updateEstadoCotizacion`) no revisaban las filas afectadas, así que un update filtrado por RLS o sobre un registro inexistente mostraba éxito y escribía bitácora sin cambiar nada. Ahora ambos usan `.select().maybeSingle()` y lanzan un error legible cuando afectan 0 filas; la bitácora sólo se escribe tras confirmar el cambio.
- **Fix · guardas de llegada real que se saltaban**: en `actualizarFechaLlegadaRealEmbarque`, si el pre-select fallaba o el embarque no existía se ignoraba el error y se ejecutaba el UPDATE sin validar ETD, re-marcado ni estado. Ahora aborta antes de evaluar cualquier regla.


## [13.813.0] - 2026-08-31

- **Fix · edición fantasma de conceptos en el wizard de embarques**: `actualizar_embarque_completo` sólo actualiza ventas en `pendiente`/`en_proforma` y costos que no estén `Pagado`, pero la UI dejaba editar y borrar cualquier renglón y luego mostraba "guardado correctamente" aunque la RPC lo hubiera descartado. Ahora el estado (`estado_facturacion` / `estado_liquidacion`) viaja en la hidratación y las filas ya facturadas o pagadas se muestran en sólo lectura, con el motivo en el tooltip y el botón de borrar deshabilitado (nuevo helper `conceptoBloqueado` con pruebas unitarias).

## [13.812.0] - 2026-08-31

- **Ola 4 · nota de crédito en $0 bloqueada del lado del servidor**: `validateNcContext` sólo exigía cantidad > 0 y precio >= 0, así que una NC con todos los precios en cero llegaba al PAC. Ahora `facturapi-emitir-nota-credito` calcula el total de los conceptos y responde 422 `nc_total_cero` antes del claim y de FacturAPI (espejo de `validarTotalPositivo` en facturas).
- **Mensajes amigables para códigos `LC_*` ya emitidos**: `LC_TC_FUERA_DE_BANDA`, `LC_TRASPASO_SALDO_INSUFICIENTE`, `LC_PAGO_FECHA_PREVIA` y los guards de medidas del embarque (`LC_EMBARQUE_PESO_INVALIDO`, `LC_EMBARQUE_VOLUMEN_INVALIDO`, `LC_EMBARQUE_PIEZAS_INVALIDO`) dejan de mostrarse como error crudo de base de datos. El test de cobertura `lcCodeCoverage` queda en verde.

## [13.811.1] - 2026-08-31

- **Fix crítico · timbrado con límite de crédito**: `credito_en_uso_mxn` sólo está otorgada a `service_role`, pero se llamaba con el cliente que lleva el JWT del usuario (rol `authenticated`), así que devolvía permission denied y todo cliente con límite configurado quedaba bloqueado con 503 `credito_no_verificable`. Ahora la RPC se ejecuta con un cliente admin (mismo patrón que `_shared/facturapiAuth.ts`).
- **Fix · buscador de Compras con comas o paréntesis**: pagos, notas de crédito y el resolver de facturas de proveedor ahora construyen los filtros con `orIlike`/`ilikePattern`, así que términos como "Acme, S.A. de C.V." dejan de romper el árbol lógico de PostgREST (error 400) y comodines `%`/`_` se tratan como literales.

## [13.811.0] - 2026-08-30

- **Ola 3 · crédito fail-closed y boundary de timbrado del lado del servidor**.
- **Límite de crédito fail-closed real** (`facturapi-emitir/credito.ts`): si falla la lectura del cliente ya no se continúa al PAC — se responde 503 `credito_no_verificable`; si el cliente no existe, 404 `cliente_not_found`. Límite NULL/0 sigue significando "sin límite configurado".
- **Boundary de documentos timbrables**: `facturapi-emitir` sólo timbra facturas vivas en `Borrador`/`Por timbrar` (nuevo 409 `estado_no_timbrable`) y `claimFactura` repite el guard de vivo + estado en el UPDATE atómico para cerrar la carrera entre load y claim. `facturapi-emitir-nota-credito` excluye papelera en `loadNc`/`loadFactura`, valida `Borrador`/`Aprobada` en `preloadNcContext` y repite el guard en `claimNotaCredito`: Timbrada/Aplicada/Cancelada y registros borrados nunca llegan a FacturAPI.
- **Tests**: `facturapi-emitir/credito_test.ts`, `facturapi-emitir/emitir_estado_test.ts` y casos nuevos en `facturapi-emitir-nota-credito/data_test.ts` (16 pruebas Deno en verde).

## [13.810.0] - 2026-08-30

- **Ola 2 · EUR fuera de la venta y banda fiscal de tipo de cambio**.
- **EUR ya no se puede capturar en conceptos de VENTA** (YAGNI): la proforma y la factura no tienen rama EUR, así que un concepto en euros se facturaba en $0 en silencio. Se quita EUR del selector de venta, el payload usa un `monedaVentaSchema` (MXN/USD) propio —los costos siguen con EUR— y `conceptos_venta` gana el CHECK `conceptos_venta_moneda_soportada`. `crear_proforma_atomica` y `consolidar_proformas` lanzan `LC_MONEDA_VENTA_NO_SOPORTADA` antes de crear o vincular nada.
- **Tipo de cambio fiscal 5..40 MXN por divisa**: `facturapi-emitir` y `facturapi-emitir-nota-credito` ahora usan el helper compartido `_shared/tcBanda.ts` en lugar del criterio local `> 1`; null/NaN/1/4.99/40.01 bloquean el timbrado ANTES de llamar a FacturAPI y 5..40 pasan. MXN sigue sin requerir TC.
- **Tests**: `supabase/tests/ola2_moneda_venta.sql` (constraint + guards de las RPCs), `_shared/tcBanda_test.ts`, banda en `facturapi-emitir-nota-credito/helpers_test.ts` y suite vitest de moneda de venta.

## [13.809.0] - 2026-08-30

- **Ola 1 · dos bugs confirmados de la auditoría (sólo esas dos funciones)**.
- **Reabrir embarque ya no truena**: `reabrir_embarque` intentaba limpiar `pnl_base` y `calculo_snapshot` en `embarques`, columnas que sólo existen en `comisiones_devengadas` (fallaba con 42703 y la foto del cálculo nunca se borraba). Ahora se limpian ahí, junto con `definitiva = false`.
- **Cancelar liquidación no revive deudas**: `cancelar_liquidacion_comision` devolvía TODAS las comisiones de la liquidación a `Devengada`, incluidas las recuperaciones que esa liquidación había descontado (riesgo de doble pago). Ahora las ordinarias vuelven a `Devengada` y las recuperaciones aplicadas a `Por recuperar`.
- **Guards**: el guard M-1 pasa a ser estructural contra el esquema vivo (detecta cualquier columna inexistente asignada en el UPDATE de `embarques`) y se agrega `supabase/tests/ola1_comisiones_ciclo_recuperacion.sql`, test comportamental del ciclo generar → recuperar → cancelar.

## [13.808.0] - 2026-08-29

- **Ola 10 · YAGNI (simplificación sin tocar candados)**.
- **CI**: los 4 jobs de `rls-tests.yml` que restauraban el snapshot de base repetían los mismos 4 pasos; ahora usan una única acción compartida `restore-rls-snapshot`.
- **Retiro de código muerto**: se elimina la edge function `backfill-cxp-buzon` (backfill de un solo uso, ya ejecutado, sin llamador en la app ni en cron) y la RPC `reconciliar_conceptos_facturados_legacy` (sin consumidores).
- **Retención de bitácoras técnicas**: `purge_app_logs_old()` quedó realmente agendada en cron (01:30 CDMX) y su ejecución se cerró a procesos internos; antes existía la rutina pero nunca se programó y `app_logs` crecía sin límite.
- Baseline de esquema y lista canónica de funciones internas sincronizados.

## [13.807.0] - 2026-08-29

- **Ola 9 · Remediación v15 (cierre)**.
- **N-3 (Filtro de organización)**: las pantallas de Compras (Reportes, Pagos, Notas de crédito, Conciliación) esperan a que el contexto de organización resuelva antes de consultar, evitando un instante de datos sin filtrar.
- **N-2 (Bloqueo optimista)**: sincronizar conceptos de venta desde costos lee el sello `updated_at` justo antes de escribir; si otra sesión guardó en medio, avisa del conflicto en vez de pisar los cambios.
- **B-12 (Medidas negativas)**: candado en base de datos — embarques y contenedores no aceptan peso, volumen ni piezas negativos.
- **M-14 (Tipo de cambio)**: el candado de banda 5–40 se corrigió para funcionar en pagos de clientes y de proveedores, y ya no marca error cuando el pago va en la misma moneda que la factura (factor 1 legítimo).
- **R-2 (Drift de esquema)**: se registraron en migraciones las funciones de las Olas 7 y 8 que sólo existían en la base, se eliminó la sobrecarga ambigua de `crear_embarque_completo` y se regeneró `baseline.sql`. Nuevo guard `ola8_v15_candados`. `db:postcheck` en verde (65/65 guards + suites RLS).

## [13.806.0] - 2026-08-29

- **Ola 8 · Remediación v15 (candados server-side)**.
- **M-15 (Crédito)**: el límite de crédito ahora se valida en el servidor al timbrar (`facturapi-emitir`), no sólo en el diálogo. Si la factura rebasa el límite responde 409 y sólo los roles de dirección/finanzas pueden emitir por encima; si la exposición no se puede calcular, no se timbra (fail-closed).
- **B-11 (Facturas en $0)**: el timbrado rechaza facturas con total 0 desde el servidor.
- **M-3 (Reportes de Compras)**: los reportes y KPIs de Compras pasan a subtotal (costo sin IVA) para cuadrar con Presupuesto vs Real; las tarjetas se etiquetan “Subtotal … (sin IVA)”.
- **M-14 (Tipo de cambio)**: banda de plausibilidad (5–40 MXN por divisa) en los diálogos de pago de factura y de pago a proveedor.
- **A-8 (Tesorería)**: el flujo proyectado ya no incluye liquidaciones de comisión canceladas.
- **M-10 (Auditoría)**: nueva regla `contenedores_totales_descuadrados` (peso/volumen/piezas del embarque vs. suma de contenedores) y etiqueta de `venta_total_descuadrado` unificada.

## [13.805.0] - 2026-08-29

- **Ola 7 · Auditoría v14-2 (cierre de las 5 decisiones de producto)**.
- **B-4 (PUE)**: candado en base de datos + bloqueo en el diálogo de cobro: una factura PUE sólo admite liquidación total (tolerancia 5 centavos); para abonos parciales el flujo correcto es PPD.
- **B-3 (Three-way match)**: documentado en `docs/flujo-cxp-aprobacion.md` — el match de CxP es de 2 vías por diseño (factura vs. costo registrado); no hay módulo de recepciones.
- **M-12 (Cotizaciones)**: el autoguardado estampa un `tabId` por pestaña; si otra pestaña sobrescribe el borrador, se muestra un aviso en vez de perder captura en silencio.
- **M-13 (Embarques)**: el wizard “Nuevo embarque” ahora tiene borrador con autoguardado (debounce 800 ms, TTL 24 h, clave por usuario+organización), banner de restauración, aviso de conflicto entre pestañas y limpieza al crear el embarque y al cerrar sesión. Los adjuntos (MSDS/documentos) nunca se persisten: se avisa que deben resubirse.
- **M-15 (Límite de crédito)**: el exceso de crédito pasa de fail-open a fail-closed — sólo gerencia/finanzas (admin, admin_org, contador, tesorero, gerente_operaciones, gerente_comercial, super_admin) puede autorizar “continuar de todas formas”; el resto de roles queda bloqueado con mensaje orientativo.
- **Fix typecheck**: la regla de auditoría `venta_total_descuadrado` (M-10) se agregó a los mapas del módulo de auditoría (config, tabla, agregados ejecutivos y tests) para cerrar los errores TS2741/TS2322.

## [13.804.0] - 2026-08-29

- **Ola 6 · Auditoría v14 (técnicos de bajo riesgo)**.
- **B-20 (Onboarding)**: el RFC se valida con la estructura oficial del SAT (letras + fecha AAMMDD plausible + homoclave), no sólo por longitud, y es obligatorio cuando la organización captura datos fiscales (puede omitirse marcando “omitir datos fiscales”).
- Verificado: **B-17** (folios únicos parciales que ignoran la papelera) y **B-19** (anti-solape de tramos de demoras revalidado en el servicio, no sólo en la UI) ya quedaron cubiertos en la migración `20260829070153` y en `demorasVenta.ts`.

## [13.803.0] - 2026-08-29

- **Ola 6 · Auditoría v14 (cierre frontend)**.
- **B-8 (Cotizaciones)**: el bloqueo optimista ya distingue `undefined` (sin guard) de `null` (fila nunca modificada); antes una cotización con `updated_at` nulo se guardaba sin protección de concurrencia.
- **M-14 (T/C plausible)**: nueva banda compartida `tcBanda.ts` (5–40 MXN por divisa). La factura manual no se guarda ni timbra y el traspaso no se envía cuando el T/C capturado está fuera de banda (atrapa dedazos tipo 1.84 o 184 pesos por dólar).

## [13.801.0] - 2026-08-29


- **CI verde tras la Ola 4 (auditoría v14)**.
- **B-9 (duplicado)**: se elimina el trigger `trg_pago_fecha_no_previa` y su función; la regla "pago anterior a la emisión" ya la aplica `assert_factura_viva_para_pago` con `LC_PAGO_FECHA_PREVIA_EMISION` (un solo mensaje para el usuario).
- **M-2 (cruce EUR)**: el guard `convertir_monto_pago.sql` fija el nuevo comportamiento (pivote en MXN) y exige T/C de la factura destino; se agrega el mensaje `LC_PAGO_TC_FACTURA_REQUERIDO` al catálogo de errores.
- **H6**: candados `REVOKE`/`GRANT EXECUTE` explícitos para `sugerir_embarques_para_proveedor` y `reabrir_embarque`.
- Manifiesto (1169 migraciones) y `baseline.sql` regenerados; `db:postcheck` en verde (63/63 guards + 6 suites RLS).


## [13.800.0] - 2026-08-29

- **Ola 3 · Auditoría v14 (cierre) + bajos de papelera**.
- **A-4 (Profit devengado)**: el EERR devengado resuelve embarques por expediente filtrando `organization_id` y `deleted_at IS NULL`; dos organizaciones con el mismo expediente ya no se cruzan T/C ni modo de transporte.
- **M-17 (Compras)**: `sugerir_embarques_para_proveedor` excluye embarques en papelera en las 3 ramas del UNION.
- **B-1 (Embarques)**: `reabrir_embarque` sólo opera sobre embarques vivos (`deleted_at IS NULL`).
- **B-13 / B-14 / B-15**: lineage de leads (oportunidades), seguros del embarque y conteo de movimientos bancarios excluyen registros borrados.

## [13.799.0] - 2026-08-29

- **Olas 2 y 3 · Auditoría v14 (altos y medios)**.
- **A-2 / M-5 (multi-tenant e impersonación)**: `cobranza_agregados`, `dashboard_facturacion_kpis`, `direccion_totales`, `eerr_resumen_anual`, `busqueda_global` y `sidebar_alert_counts` usan `public.org_scope()` en vez de `current_user_org_id() OR super_admin`; un super admin impersonando ya no ve la suma de todas las organizaciones. De paso, `sidebar_alert_counts` filtra `deleted_at IS NULL`.
- **A-9 / M-4 (Compras)**: pagos, notas de crédito, reportes y conciliación pasan `organization_id` explícito (defensa en profundidad) y los filtros de proveedor/búsqueda se resuelven server-side antes del `LIMIT` con `assertNotTruncated` (ya no desaparecen resultados en silencio).
- **A-3 / M-16**: Profit (estado de resultados) y embarques del cliente excluyen registros borrados (`deleted_at IS NULL`).
- **A-8**: el comparativo presupuesto vs real ignora liquidaciones canceladas.
- **A-11**: `calcularTotalMxn` reconoce el IVA de frontera (8%) al delegar en el helper canónico de conceptos.
- **M-3**: reportes de Compras soportan EUR (KPI, gráfica y CSV) con conversión a MXN.

## [13.798.0] - 2026-08-29

- **Ola 1 · Auditoría v14 (críticos)**.
- **C-1 doble IVA cotización→embarque**: `_crear_embarque_replicar_conceptos` ya no reescribe `precio_unitario` a partir del `total` con IVA; la base gravable se deriva de `cantidad × precio_unitario` y se replica `tasa_iva_aplicada`. Sin backfill: sólo aplica a embarques nuevos.
- **C-2 cron de snapshots**: `auditoria_capturar_snapshot` acepta `service_role` (el cron ya no falla por autorización).
- **A-10**: el snapshot se calcula siempre con `auditoria_embarques_org(p_organization_id)`, no con la org activa del caller (adiós ceros y score 100 ficticio).
- **M-6**: `total_pendientes` cuenta hallazgos sin revisión (llave `embarque_id|regla|detalle`), `por_regla` se llena y el score usa la misma fórmula de higiene que la pantalla ejecutiva.
- Ola 0 (verificación de los 40 hallazgos) completada: 37 confirmados, 1 ya corregido (A-5, `guard_pago_proveedor` ya usa `FOR UPDATE`), 2 decisiones de producto (B-2, B-21).


## [13.797.1] - 2026-08-29

- **CI en verde (4 jobs)**: arreglados los rojos de `lint`, `knip`, `audits` y `tests` del run 90058425499.
- `facturapi-descargar-zip`: extraídos `validarPeriodo` y `generarZip` del handler (complejidad 24 → bajo el límite de 16) y registrada la función en los candados de cobertura Sentry (`sentry-edge-coverage` + `sentry-edge-wrapping`).
- `COST_VIEWERS` ahora copia `FINANCE_VIEWERS` (`[...]`) en vez de re-exportar el mismo binding: elimina el hallazgo `duplicates` de knip sin cambiar la decisión C9.
- Espejos de esquema `cxp/guard_pago_proveedor.sql` y `facturacion/duplicar_factura_para_refacturacion.sql` sincronizados con la migración vigente `20260829012327` (replay reparado).
- `migration-manifest.json` regenerado con las 1164 migraciones.

## [13.797.0] - 2026-08-29

- **Verificación de base sin Docker**: `scripts/db/local-verify.sh` gana `--backend local` (autodetectado) que levanta Postgres 17 con `initdb`/`pg_ctl`; `db:verify`, `db:verify:all` y `db:baseline:update` ya funcionan en entornos sin Docker. Corregido un `local` fuera de función que dejaba `exentas` sin definir.
- **Nuevo `bun run db:postcheck`**: cierre único para todo cambio de base — migraciones en base limpia, candado `service_role-only`, `_ci_post_migrate`/`_ci_verify_rls`, guardia de integridad, regeneración de `supabase/schema/baseline.sql`, 63 guards conductuales y suite RLS mínima (`--check` para modo CI). Verificado en verde de punta a punta (1164 migraciones, baseline sin drift).
- **Paridad ICU en snapshots**: `schema-snapshot.sh` reinserta `lc_unicode_upper` cuando el servidor local no trae ICU, para que la baseline generada en local sea idéntica a la de CI (antes había que editarla a mano).
- **Decisiones de negocio con fuente única**: nuevo `supabase/tests/_decisiones_negocio.sql` (roles con acceso a costos C9, tolerancia DOF, devolución total de anticipos); `ola_e2_a_guards.sql` lo consume en vez de repetir la lista de roles.
- **Docs**: `supabase/tests/rls/README.md` documenta el checklist "al tocar la base" con los cuatro rojos típicos de CI y su arreglo.

## [13.796.4] - 2026-08-29

- `supabase/schema/baseline.sql` regenerado (replay de las 1164 migraciones en Postgres 17.9 limpio + `_ci_bootstrap`/`_ci_drift`/`_ci_post_migrate`): incorpora las remediaciones F1–F5, N18 y C9 (trigger `_assert_nc_prov_no_excede_saldo`, `ux_clientes_email_org`, CHECK cargo/abono exclusivo, roles con acceso a costos). El job `schema-baseline` vuelve a verde.

## [13.796.3] - 2026-08-29

- Guard `ola_e2_a_guards` (C9) actualizado a la decisión vigente: gerencia, finanzas y ventas ven costos de cotización, por lo que `vendedor` sí debe estar en `puede_ver_costos_cotizacion`. El guard viejo exigía lo contrario y dejaba el job `rls-guards` en rojo (62/63).

## [13.796.2] - 2026-08-29

- Fix CI: se eliminó el generador `scripts/db/gen-service-role-only.sh` y su paso `--check` en `rls-tests`. Derivar la lista `_ci_service_role_only.sql` del esquema era un riesgo de seguridad: una función que pierde su `REVOKE` desaparecía sola de la lista y el candado quedaba verde ocultando la regresión. La lista vuelve a ser curada a mano (con sus comentarios) y el candado bidireccional sigue siendo la única fuente de verdad.
- Suite RLS `soft_delete_reportes`: el fixture aplicaba una NC de proveedor de 700 sobre un saldo de 300 y la nueva guarda F5 la bloqueaba; el monto se ajustó a 300 (el caso mide el reporte, no el tope de saldo).
- Replay local de migraciones: se confirmó que las 22 "migraciones legacy" que fallaban eran un artefacto del runner local (faltaba el paso `_ci_drift.sql`). Con el flujo real del CI las 1164 migraciones aplican en base limpia sin exenciones nuevas y las 34 suites RLS pasan (candados service_role-only, drift, cobertura RLS e integridad en verde).

## [13.796.1] - 2026-08-29

- Fix CI: se agregó `_assert_nc_prov_no_excede_saldo()` (trigger F5) a la lista canónica `_ci_service_role_only.sql`; el candado bidireccional queda en verde (59 funciones).

## [13.796.0] - 2026-08-29
### Finanzas · Ronda v3 (remediación selectiva de auditoría)
- **F1 (crítico)**: la devolución de anticipos a proveedor fallaba siempre — el abono en `bbva_movimientos` se insertaba sin `hash_dedupe` (NOT NULL) y toda la operación hacía rollback. Ya registra correctamente.
- **F2**: la devolución de anticipo ahora es sólo por el saldo completo (decisión de negocio): una parcial hacía desaparecer el remanente sin asiento contable. El monto queda fijo en el diálogo y la RPC lo exige (`LC_ANTICIPO_DEVOLUCION_TOTAL`).
- **F3**: la aplicación de anticipos en EUR y en cruce MXN→factura USD ya no se bloquea: se valúa con la paridad DOF del día de la aplicación (el anticipo MXN no guarda paridad histórica). El guard de pagos respeta la valuación cuando el pago nace de un anticipo.
- **F4**: los candados `guard_pago_proveedor` y `guard_proveedor_factura_total` sumaban notas de crédito en crudo sin convertir moneda; ahora usan la conversión canónica y ya no dejan pasar sobrepagos cuando la NC está en otra moneda.
- **F5**: nuevo candado `trg_nc_prov_tope_saldo`: una nota de crédito de proveedor aplicada ya no puede exceder el saldo real de la factura (`LC_NC_PROV_EXCEDE_SALDO`).
- **N18**: `duplicar_factura_para_refacturacion` bloquea el caso con `FOR UPDATE`: un doble clic ya no genera dos borradores.
- **N22**: el CHECK de `bbva_movimientos` pasa de `<= 1` a `= 1`: un movimiento no puede quedar con cargo y abono en cero (movimiento fantasma).
- **M3**: índice único `ux_clientes_email_org`: ya no pueden existir dos clientes activos con el mismo correo en una organización. Se limpiaron los 2 duplicados históricos de la org demo (el registro más antiguo quedó con marcador `duplicado-…@pendiente.local`).
- **C9**: costos y márgenes de cotizaciones ahora los ven gerencia, finanzas y ventas (todos); se elimina la regla de "sólo cotizaciones propias" del vendedor. Alineados `puede_ver_costos_cotizacion()` (SQL), `COST_VIEWERS` y tests.
- Seguridad: `REVOKE EXECUTE` a `anon`/`authenticated` en el nuevo trigger `_assert_nc_prov_no_excede_saldo` (lint 0028).

## [13.795.0] - 2026-08-29
### Documentación
- Segunda pasada de limpieza documental: borrados `docs/ui-audit/99-resumen.md`, `.lovable/tablet-audit-report.md`, `.lovable/audit-erp-completeness.md`, `reports/coverage-report.md` (congelado en v12.64.1), `reports/strict-mode-baseline.md`, `docs/crm-mapeo-hunter.md` y `remotion/CLAUDE.md`.
- `docs/ola14-replay-mirror-saldo.md` sincronizado con el baseline vivo: 8 entradas (no 14), con la lista de las ya saldadas y el siguiente lote.
- `.lovable/audit-todos.md`, `docs/ops/purga-env-git.md` y `docs/pre-ads-checklist.md` con fecha de última verificación; `docs/cast-audit.md` marcado como artefacto generado.
- `CHANGELOG.md` recortado de 2.2 MB a ~380 KB: las entradas `13.0.0` → `13.499.3` se archivaron en `docs/changelog-archive-v13.md`. Planes archivados agrupados por mes en `.lovable/plan/2026-08/`.

## [13.794.0] - 2026-08-29
### Facturación
- Nuevo "ZIP del mes (PAC)" en Facturas Emitidas → Exportar: descarga un paquete ZIP con el PDF y XML de todas las facturas, notas de crédito y REPs emitidos en el mes, generado del lado de FacturApi (métodos `invoices.*ZipRequest`). Pensado para la entrega mensual al contador. Nueva edge function `facturapi-descargar-zip` (multi-tenant vía `getFacturapiClient`, roles de consulta fiscal, con polling hasta que el PAC termina de ensamblar el paquete).
- SDK FacturApi actualizado de 4.18.0 a 4.20.0 (descarga ZIP + fix de tipado `property_tax_account`).

## [13.793.0] - 2026-08-29
### Documentación
- Limpieza de documentación: eliminados >25 archivos MD obsoletos (fix packs cerrados, auditorías visuales/arquitectura de versiones previas) y sus capturas; `docs/` bajó de 1.9 MB a ~173 KB. También se borró `scripts/ga-gate.sh` (anclado a v12).
- Actualizados con estado vivo: `docs/rls-multitenant-audit.md` (119/119 tablas con RLS, 93 políticas RESTRICTIVE), `docs/security-checklist.md` (48 edge functions, 6 con `verify_jwt = false`, rate limiting propio), `docs/riesgos-aceptados.md` (V-14 → 39 call-sites, RN-3 → 12 constraints NOT VALID) y `docs/strict-mode-roadmap.md` (cerrado: `strict: true` ya activo).
- `CHANGELOG.md` recortado: el histórico previo a `13.0.0` se archivó en `docs/changelog-archive.md`. Índice de documentación ampliado en `README.md`.


## [13.792.2] - 2026-08-29
### CI
- Corregido warning `react-refresh/only-export-components` en `subtotalCell.tsx`: se extrajo `subtotalesDeFila` a su propio archivo y se actualizaron los imports en `cotizacionesColumns.tsx` y `Cotizaciones.tsx`.

## [13.792.1] - 2026-08-29
### UX de errores
- Errores de dominio esperados (marcados `expected: true`, p. ej. `BuzonDuplicadoError` al subir una factura ya registrada al buzón CxP) ahora se muestran como aviso amable (toast warning con el mensaje de negocio) en vez del diálogo de error con "Ver detalles" y reporte. `reportCaughtError` también los omite como defensa en profundidad. Cubierto con tests en `appFeedback.test.ts`.

## [13.792.0] - 2026-08-28
### Cotizaciones
- Listado: la columna Subtotal ahora muestra un renglón por moneda en cotizaciones mixtas (antes sólo se veía el monto de una moneda, p. ej. COT-217/218 ocultaban los USD). El orden sigue usando el equivalente en MXN, ahora sumando ambas monedas.
- PDF: los comentarios capturados en las filas de costos se propagan al concepto de venta (`buildConceptosFromCostos` y la sincronización manual), por lo que aparecen como subrenglón en el PDF de la cotización.
- Eliminado `ordenSubtotalMxn.ts`, reemplazado por `subtotalesPorMoneda.ts` (con pruebas).

## [13.791.3] - 2026-08-28
### CI
- Power of 10: divididos `vsRealDomain.ts` (222 → se extrae `vsRealGastos.ts` con la conversión a MXN de gastos/NCs) y `DevolverAnticipoDialog.tsx` (213 → se extrae el hook `useDevolverAnticipoForm`); el guard de archivos >200 líneas vuelve a verde.
- Cobertura LC_*: mensajes amigables para `LC_ANTICIPO_FECHA_INVALIDA`, `LC_ANTICIPO_FECHA_REQUERIDA`, `LC_ANTICIPO_MONTO_EXCEDE_SALDO`, `LC_ANTICIPO_YA_DEVUELTO` (devolución N13) y `LC_ROL_FORBIDDEN` (seed de categorías de presupuesto).

## [13.791.2] - 2026-08-28
### CI
- Regenerado `supabase/schema/baseline.sql` con Postgres 17.9 sobre base limpia (1162 migraciones): incorpora la devolución de anticipos (N13), el candado `FOR UPDATE` en notas de crédito de proveedor y `_bitacora_cambio_financiero()`.

## [13.791.1] - 2026-08-28

### CI
- Registrado `public._bitacora_cambio_financiero()` en la lista canónica service_role-only: el candado bidireccional de CI ya pasa (58 funciones sin drift).

## [13.791.0] - 2026-09-04
### Anticipos a proveedor · devolución (N13)
- Nueva acción **Registrar devolución** en la bandeja de anticipos: cuando el proveedor regresa el dinero, el anticipo queda en estado `devuelto` con saldo cero y el reembolso entra a tesorería como ingreso por conciliar (no se toca el pago original ni las aplicaciones ya hechas).
- RPC `devolver_anticipo_proveedor` con bloqueo de fila, validación de rol/tenant y tope al saldo disponible; `_recalc_anticipo_saldo` respeta el estado `devuelto`.
- Filtro y etiqueta `Devuelto` en la lista de anticipos.

## [13.790.0] - 2026-09-04
### Seguridad y finanzas (backlog v5 · pendientes reales)
- **M3-res** — `_assert_email_unico_org` ya no bloquea altas cuando el correo viene vacío. Auditado el "duplicado" real (`betoazaver@hotmail.com`): son dos razones sociales del mismo dueño (persona física + su empresa), así que **no** se crea índice único de email; el identificador único por organización sigue siendo el RFC (`clientes_org_rfc_unique`).
- **M6** — `cartera_pendiente()` ya no reimplementa la conversión de notas de crédito: usa el helper canónico `_nc_aplicadas_moneda_factura`.
- **N18** — `aprobar_nota_credito_proveedor` y `cancelar_anticipo_proveedor` toman bloqueo de fila (`FOR UPDATE`), así el doble clic no aplica el movimiento dos veces.
- **N19** — nueva bitácora financiera (`_bitacora_cambio_financiero`) con disparadores en `embarques`, `facturas`, `bbva_movimientos` y `comisiones_devengadas`: quedan registrados los cambios de monto, tipo de cambio y cliente. La función está revocada para `anon` y `authenticated` (FIX-45).
- **C3-res / C9** — cerrados tras auditoría: `proveedor_notas_credito` no tiene `proveedor_id`, el candado por `proveedor_factura_id` es suficiente; y el criterio de "cotización propia" (`created_by`) ya coincide entre SQL y frontend, ahora expuesto como `canViewCostsOfCotizacion`.

### Mejoras
- **L3** — la importación masiva ahora dice exactamente qué filas del archivo no se guardaron ("Faltan las filas 3 a 4"), no sólo el conteo.

## [13.789.0] - 2026-08-28
### Mejoras
- **Captura de factura de proveedor**: el chip del encabezado mostraba el total **con IVA** como cifra grande, pero todo el cuadre de costos del ERP (barra de conceptos y el trigger `_cxp_validar_aprobacion`) corre sobre el subtotal sin impuestos, así que los capturistas comparaban contra la cifra equivocada. Ahora la cifra principal es `Subtotal <moneda>` y el total con IVA queda debajo como referencia secundaria.
- El desglose del popover resalta el subtotal, renombra el último renglón a `Total con IVA <moneda>` y agrega la nota "Las conciliaciones de costo se hacen sobre el subtotal (sin impuestos)".



## [13.788.0] - 2026-09-03
### Seguridad
- **N6 residual**: `seed_presupuesto_categorias` la podía ejecutar cualquier usuario autenticado. Ahora exige rol administrativo (`public.es_admin_catalogo`) y conserva el candado multi-tenant; el mantenimiento (`service_role`, replay de migraciones, suites del CI) sigue permitido.

### Correcciones
- **M1 residual**: `public.profit_por_cliente` no descontaba las notas de crédito de cliente, así que la venta y la utilidad salían infladas. Ahora resta el canon `nc_aplicadas_en_moneda_factura` de las facturas activas ligadas al embarque, convertido a MXN con el T/C del embarque, y excluye facturas canceladas o en papelera.
- **N9**: el comparativo Presupuesto vs Real valuaba gastos y notas de crédito en EUR con el tipo de cambio del dólar (CxP sólo guarda `tipo_cambio_usd`). `convertirAMxn` ahora rechaza esa valuación cruzada: el renglón se excluye del real y se reporta en el contador "sin T/C" para que se vea la advertencia en pantalla.

### Interno
- Migración `20260828195805_...` (N6 + M1), nuevo guard `supabase/tests/backlog_v4_profit_nc_y_seed_rol.sql` en el manifiesto, pruebas de multi-moneda para gastos y NC de CxP, y `baseline.sql` + manifiesto de releases (1159 migraciones) sincronizados.



## [13.787.2] - 2026-08-28
### Correcciones
- **Guard `ola_e2_a_guards` en rojo (N15)**. La migración `20260902000100_qa_r2_etapa1_guards.sql` reescribió `public.embarques_assert_cancelacion_sin_cxc_cxp()` y en el camino borró los dos candados de la Ola E2: no dejar cancelar un embarque con proformas vivas (`LC_CANCEL_CON_PROFORMA`) ni con facturas de cliente en Borrador (`LC_CANCEL_CON_FACTURA_BORRADOR`). Como esa migración es posterior en el orden de replay, ganaba ella.
- Nueva migración `20260903000300_ola_e2_n15_restaurar_candados_cancelacion.sql` (timestamp posterior a la que causó la regresión) que restaura la función completa y re-crea `trg_embarques_cancelacion_cxc_cxp`.
- `supabase/schema/baseline.sql` y el manifiesto de releases sincronizados.

## [13.787.1] - 2026-08-28
### Correcciones
- **CI rls-tests: `pg_dump: server version mismatch`**. El Postgres de pruebas ya corre 17.9, pero el runner `ubuntu-24.04` trae el cliente 16.15 y `pg_dump` se niega a respaldar un servidor más nuevo, así que el paso "Dump prepared database" abortaba y con él toda la suite RLS.
- Nueva acción compuesta `.github/actions/setup-pg-client` que instala `postgresql-client-17` desde el repositorio oficial PGDG (llave verificada), lo antepone en el `PATH` e imprime `psql`/`pg_dump`/`pg_restore --version` como evidencia. Es idempotente: si ya hay un cliente 17, no reinstala.
- Se agregó el paso a los 6 jobs de `rls-tests.yml` que hablan con la base (snapshot, suites, guards, drift de types, baseline y radar de drift). Esto también previene que el error se mudara al `pg_restore` de los jobs consumidores del dump.
- `POSTGRES_IMAGE` quedó documentado: subir la imagen obliga a subir el input `version` de la acción.
- `scripts/db/local-verify.sh` avisa si el `pg_dump` local es menor a 17 antes de usar `--snapshot`.

## [13.787.0] - 2026-08-28
### Infraestructura
- **Auditoría de versiones del CI**: se verificó pin por pin contra upstream. Todas las acciones (`checkout` v7.0.1, `cache` v6.1.0, `upload/download-artifact` v7.0.1/v8.0.1, `github-script` v9.0.0, `setup-bun` v2.2.0, `setup-deno` v2.0.5, `paths-filter` v4.0.3, `dependency-review` v5.0.0, `gitleaks` v3.0.0, `codeql` v4.37.9, `actionlint` 1.7.12), Bun 1.4.0 y Deno 2.6.x están en la última versión. **No queda nada pendiente en workflows.**
- **Bumps de parche/minor (Bloque A)**: `@sentry/react` 10.72.0, `@supabase/supabase-js` 2.112.4, `@tanstack/*` 5.102.8, `react-hook-form` 7.86.0, `terser` 5.51.2, `eslint` 10.9.1, `typescript-eslint` 8.68.0, `eslint-plugin-react-refresh` 0.5.5, `knip` 6.33.0, `@testing-library/react` 16.3.3, `@types/node` 26.4.0, `@react-pdf/types` 2.14.0, `rollup-plugin-visualizer` 7.1.1. Sin cambios de mayor (Vite 5, Tailwind 3, TS 5, router 6, Vitest 3 siguen pinneados).
- **Postgres de pruebas**: se mantiene en 17.9 (producción corre 17.6); subir a 17.11 exigiría regenerar `baseline.sql` sin beneficio real hoy.

### Correcciones
- `CxpFiltrosSheetFields.tsx`: se quitó el `export { ESTATUS }` sin consumidores que rompía `eslint --max-warnings 0` con `react-refresh` 0.5.5.
- Guardrails de la Ola E4 que quedaron a medias: se registraron `ola_e2_{a,b,d}_guards.sql` en `_guards_manifest.txt` (antes eran suites huérfanas que CI no ejecutaba) y se añadieron los mensajes amigables de `LC_MOVIMIENTO_INMUTABLE`, `LC_MOVIMIENTO_TRANSICION_INVALIDA`, `LC_LIQUIDACION_TRANSICION_INVALIDA`, `LC_LIQUIDACION_CANCELADA_INMUTABLE`, `LC_COMISION_DELETE_PROHIBIDO` y `LC_SIN_TC_DOF`.
- Verificación: `lint --max-warnings 0`, `lint:unused` y `build` en verde; suite completa **7789 tests, 0 fallos** tras los tres arreglos.

## [13.786.0] - 2026-08-28
### Infraestructura
- **CI · Bun 1.4.0**: la composite `setup-bun` sube el pin de `1.3.3` a **1.4.0** (última estable) y se refresca la clave de cache de `node_modules` (`bun1.4.0`). Verificado en local con Bun 1.4.0: `bun install --frozen-lockfile` sin cambios de lockfile, `lint` y `build` en verde.

## [13.785.0] - 2026-08-28
### Infraestructura
- **CI · Deno 2**: los jobs `edge-functions` (`ci.yml`) y `user-management-smoke` (`post-deploy-smoke.yml`) pasan de `deno-version: v1.46.x` a `v2.6.x`. Las Edge Functions ya corren sobre Deno 2 en el backend, así que probábamos con un motor distinto al de producción (misma divergencia que Postgres 15 vs 17). Se añadió `--node-modules-dir=none` a los dos `deno test`: con Deno 2 y un `package.json` en la raíz, Deno intentaba resolver los `npm:` de las edges contra el `node_modules` de la app. Validado en local con Deno 2.6.10: **545 tests verdes, 0 fallos**.
- **CI · acciones de GitHub actualizadas** (todas ancladas por SHA):
  - `actions/checkout` v6.1.0 → **v7.0.1**
  - `actions/cache` v5.1.0 (y v5.0.5 en la composite `setup-bun`) → **v6.1.0** unificada en los 11 usos
  - `actions/github-script` v8.0.0 → **v9.0.0** (verificado que ningún script usa `require('@actions/github')` ni redeclara `getOctokit`, los dos cambios incompatibles)
  - `dorny/paths-filter` v3.0.4 → **v4.0.3**
  - `actions/dependency-review-action` v4.9.0 → **v5.0.0** (runtime node24)
  - `rhysd/actionlint` (binario con verificación de checksum) 1.7.7 → **1.7.12**
- **Sin cambios deliberados**: `runs-on: ubuntu-24.04` sigue anclado, Bun se queda en 1.3.3 (no corrige ninguna divergencia con producción) y ya estaban al día `setup-bun` v2.2.0, `setup-deno` v2.0.5, `gitleaks-action` v3.0.0, `upload-artifact` v7.0.1, `download-artifact` v8.0.1 y `codeql-action` v4.37.9.
- Verificación: `actionlint` verde sobre los 8 workflows.

## [13.784.0] - 2026-08-28
### Infraestructura
- **CI · PostgreSQL 17**: el pipeline de base de datos ahora se valida contra Postgres **17.9** (mismo tren mayor que la base real, que corre 17.6) en lugar de 15.8. Se actualizó el digest pinneado en los 7 servicios de `.github/workflows/rls-tests.yml` y en `scripts/db/local-verify.sh`, y se invalidó la cache del snapshot (`rls-snapshot-pg17.9-…`). Antes revisábamos los planos con una regla distinta a la de la obra: ahora CI y producción usan la misma.
- **CI · baseline de esquema**: se regeneró `supabase/schema/baseline.sql` con `pg_dump` 17 tras replicar las 1157 migraciones en base limpia. Los únicos cambios son de formato propio de la versión (vistas con columnas calificadas por alias y espaciado en `ALTER DEFAULT PRIVILEGES`); no hay cambios de esquema.
- **Docs**: `docs/ops/baseline-esquema.md` y `scripts/db/schema-snapshot.sh` documentan ahora 17.9 como versión de referencia para generar la baseline.
### Corregido
- **Test `test_rls_portal_intra_org`**: la limpieza de fixture chocaba con los candados de la Ola E4 (`comisiones_devengadas` con FK RESTRICT y borrado prohibido). Ahora esa limpieza —que no es camino de negocio— se hace con `session_replication_role = replica` acotado y se restaura antes de las aserciones. Suite en verde (12 aserciones).
- **Validación en Postgres 17**: se replicaron las 1157 migraciones en base limpia y corrieron las 34 suites RLS y los 59 guards conductuales bloqueantes; todo en verde.

## [13.783.1] - 2026-08-28
### Corregido
- **CI · baseline de esquema**: se regeneró `supabase/schema/baseline.sql` (Postgres 15) con los candados de la Ola E4 (triggers `_bbva_guard_update`, `_liquidacion_guard_estado`, `_prohibir_delete_comisiones`, helper `_es_rol_interno`, CHECKs de montos y FKs RESTRICT).
- **CI · espejos y manifiesto**: se re-sincronizó el espejo canónico de `_factura_tc_dof_obligatorio` con la migración vigente (recálculo de T/C al cambiar de moneda) y se actualizó `migration-manifest.json` a 1157 migraciones.
- **CI · candado service_role-only**: se sincronizó la lista canónica con las funciones internas de la Ola E4 (`_es_rol_interno`, `_bbva_guard_update`, `_liquidacion_guard_estado`, `_prohibir_delete_comisiones`). El check pasa de nuevo con 57 funciones y sin drift.

## [13.783.0] - 2026-08-28
### Seguridad
- **Ola E4 · Anticipos de proveedor (N3)**: se cerró la puerta trasera de la API. Los anticipos y sus aplicaciones ya sólo se pueden crear, aplicar y cancelar por las RPC oficiales (que sí generan el movimiento bancario y la bitácora); desde la app quedan en modo lectura. El cargo bancario ya no puede quedar huérfano: borrar un anticipo con movimiento ligado está bloqueado (`ON DELETE RESTRICT`).
- **Ola E4 · Movimientos bancarios (N4)**: los importes (cargo/abono/saldo), la fecha y la cuenta de un movimiento son inmutables (`LC_MOVIMIENTO_INMUTABLE`), y se agregó máquina de estados de conciliación: Pendiente → Conciliado/Ignorado y regreso sólo a Pendiente (`LC_MOVIMIENTO_TRANSICION_INVALIDA`). También se valida que la cuenta bancaria sea de la misma organización. Es como un talonario de banco: se anota y ya no se borronea, sólo se cancela y se vuelve a anotar.
- **Ola E4 · Comisiones y liquidaciones (N8)**: sin escritura directa desde la app (sólo generar / registrar pago / cancelar). Una liquidación Pagada sólo puede pasar a Cancelada y una Cancelada queda cerrada (`LC_LIQUIDACION_TRANSICION_INVALIDA`); el borrado físico está prohibido (`LC_COMISION_DELETE_PROHIBIDO`) y se añadieron CHECK de signo en `comision_mxn`, `porcentaje_aplicado` y `total_mxn`.
- **Ola E4 · Cascadas financieras (N20)**: `CASCADE → RESTRICT` en `bbva_movimientos.cuenta_bancaria_id`, `pagos_factura.factura_id`, `factura_notas_credito.factura_id` y `comisiones_devengadas.factura_id / pago_factura_id`. Borrar una cuenta o una factura ya no arrastra el historial de conciliación, pagos ni comisiones.


## [13.782.2] - 2026-08-28
### Cambiado
- **CI · GitHub Actions**: actualizadas a su última versión *dentro de la misma línea mayor* (sin cambios de comportamiento, como cambiar el aceite y no el motor), siempre ancladas por SHA: `actions/checkout` v6.1.0, `actions/cache` v5.1.0, `denoland/setup-deno` v2.0.5, `github/codeql-action` v4.37.9, `dorny/paths-filter` v3.0.4 y `actions/dependency-review-action` v4.9.0. Se dejan pendientes los saltos mayores (checkout v7, cache v6, github-script v9, paths-filter v4, dependency-review v5) porque cambian el runtime a Node 24 / ESM.
### Corregido
- **Baseline de esquema**: la collation `lc_unicode_upper` se colocó en el orden que emite el `pg_dump` de CI (justo después de `CREATE SCHEMA public`).

## [13.782.1] - 2026-08-28
### Corregido
- **CI · Suites RLS**: whitelist de `tc_dof_moneda` y `convertir_monto_dof` en el linter de alcance por organización (son catálogos globales de tipo de cambio, no tienen dueño), y `seed_presupuesto_categorias` vuelve a poder sembrar categorías en CI al aceptar miembros de `service_role`.
- **CI · Guards conductuales**: los fixtures cross-tenant se alinearon con el nuevo candado `_assert_padre_misma_org` (Ola E1): el embarque del agente usa un cliente de su propia organización y el guard de cotizaciones acepta tanto `LC_COTIZACION_OTRA_ORG` como `LC_ORG_CRUZADA`.
- **CI · Papelera**: la suite del portal cancela y limpia pagos antes del borrado lógico, respetando el candado `LC_FACTURA_DELETE_*`.
- **Baseline de esquema**: regenerada con las 1150 migraciones (incluye Sub-olas D y E1).



## [13.782.0] - 2026-08-28
### Corregido
- **Ola E2/E3 · Sub-ola D · Retenciones (N10)**: el prorrateo de retenciones por pago se calcula sobre la base **neta de notas de crédito** y el pago que liquida la factura absorbe el residuo de centavos, así la suma de los pagos cuadra exacto con la factura (como repartir un pastel y dejar la última rebanada del tamaño que sobró, no un pedazo de más).
- **Ola E2/E3 · Sub-ola D · Aviso de revisión**: si entra una NC a una factura cuyos pagos ya declararon retenciones, se genera alerta `retenciones_nc` para que contabilidad revise.
- **Ola E2/E3 · Sub-ola D · Anticipos a proveedor (N14)**: la aplicación de anticipos usa la paridad DOF del **día de la aplicación** (USD y EUR, incluido el cruce USD↔EUR con `convertir_monto_dof`) y guarda el diferencial cambiario en la bitácora; sin T/C oficial se bloquea con `LC_SIN_TC_DOF`.
- **Ola E2/E3 · Sub-ola D · Presupuesto vs Real (N9)**: las notas de crédito de proveedor se valúan con su propio tipo de cambio (EUR/MXN cuando aplica) en lugar de heredar el T/C del dólar de la factura padre.
- **Guards**: nuevo `supabase/tests/ola_e2_d_guards.sql`, pruebas `vsRealDomain.ncEur.test.ts` y sincronización de `_ci_service_role_only.sql` (53 funciones internas).

## [13.781.1] - 2026-08-28
### Corregido
- **Ola E2 · Sub-ola B · Facturación multi-moneda (M2-res)**: si una factura en borrador cambia de moneda, el tipo de cambio se recalcula con el DOF de su fecha (o bloquea con `LC_FACTURA_SIN_TC_DOF`) y vuelve a 1 al regresar a MXN. Antes el T/C viejo se quedaba pegado, como cambiar la etiqueta de una caja sin cambiar lo que trae dentro.
- **Ola E2 · Sub-ola B · Cronología de eventos (M5-res)**: un evento de seguimiento ya no puede quedar antes de la creación del embarque (`LC_EVENTO_ANTERIOR_A_EMBARQUE`, con un día de margen).
- **Ola E2 · Sub-ola B · Tracking público (N26)**: los enlaces de rastreo tienen vigencia obligatoria (30 días por omisión, máximo 90: `LC_TRACKING_VIGENCIA_EXCEDIDA`) e índice de expirados. Ya no existen ligas eternas.
- **Ola E2 · Sub-ola B · Presupuesto (N27)**: `ultimoDia` calcula el fin de mes con aritmética de calendario, sin corrimiento por zona horaria.
- **Ola E2 · Sub-ola B · Importación CSV (L3)**: si un lote falla, el diálogo informa cuántos registros quedaron guardados y pide recargar sólo las filas restantes.
- **Ola E2 · Sub-ola B · Limpieza (L4)**: guard de regresión que fija el IVA de facturas convertidas por línea (`conceptos_factura`) y prohíbe reintroducir un cálculo con tasa global.
- **Guards**: nuevo `supabase/tests/ola_e2_b_guards.sql`.

## [13.781.0] - 2026-08-28
### Corregido
- **Ola E2 · Sub-ola A · Tesorería (N5, N11)**: el guardián de `bbva_movimientos` ahora se dispara con **todas** las columnas de vínculo (anticipos, lotes de cobro/pago, traspasos) y valida que el importe del movimiento coincida con el del pago (tolerancia de 1.00). Antes un depósito de $100 podía "pagar" una factura de $10,000 y el pago desaparecía de pendientes: como poner un recibo de mil pesos en el folder de una deuda de cien mil y dar la cuenta por cerrada.
- **Ola E2 · Sub-ola A · Aislamiento (C3-res)**: `proveedor_facturas_conceptos`, `proveedor_notas_credito` y `anticipos_proveedor` validan por trigger que su documento padre sea de la misma organización.
- **Ola E2 · Sub-ola A · Facturas (N7)**: no se puede borrar lógicamente una factura emitida que tenga pagos o notas de crédito vivas (`LC_FACTURA_DELETE_CON_PAGOS`, `LC_FACTURA_DELETE_CON_NC`, `LC_FACTURA_DELETE_EMITIDA`).
- **Ola E2 · Sub-ola A · Cancelación de embarque (N15)**: se bloquea la cancelación si hay proformas vivas o facturas en borrador (`LC_CANCEL_CON_PROFORMA`, `LC_CANCEL_CON_FACTURA_BORRADOR`) y la relación proforma→embarque pasó a `ON DELETE RESTRICT`.
- **Guards y pruebas**: nuevo `supabase/tests/ola_e2_a_guards.sql` y pruebas unitarias de `conciliacionMonto`.

## [13.780.1] - 2026-08-28
### Corregido
- **CRM · Editar oportunidad ya no borra el cliente vinculado**: al guardar cambios en una oportunidad nacida de un lead convertido se conservan `cliente_id`/`cliente_nombre` (y el `lead_id`). Antes era como actualizar el monto de un expediente y que se cayera la etiqueta con el nombre del cliente.

## [13.780.0] - 2026-08-28
### Corregido
- **Ola E1 · Aislamiento entre organizaciones (C4, C5, N6, N16)**: `embarques` valida por trigger que cliente, cotización, agente y tarifa sean de la misma organización; `crear_proforma_atomica` rechaza conceptos de otro embarque/cliente o ya borrados (`LC_CONCEPTOS_AJENOS`); las funciones de mantenimiento global dejaron de ser ejecutables por la app (sólo `service_role`) y las políticas de edición de `cobranza_seguimiento` y `cotizacion_plantillas` ganaron `WITH CHECK`. Era como tener puertas entre oficinas vecinas que sólo se revisaban al entrar, no al salir.
- **Ola E1 · Integridad financiera (N-F3, C1-res, N22, N24)**: una factura en moneda extranjera sin tipo de cambio DOF ya no se aprueba (antes se valuaba 1:1, como si el dólar costara un peso); la cartera de cliente convierte las notas de crédito a la moneda de la factura; `bbva_movimientos` obliga a que un registro sea cargo **o** abono, nunca ambos ni negativo, y el saldo de anticipos de proveedor nunca puede ser negativo ni mayor al monto original.
- **Ola E1 · Fechas y limpieza (N12, N21, N23, C8-res)**: los días restantes de REP se calculan con hora de Ciudad de México; al eliminar un pago de proveedor se dan de baja correctamente los movimientos bancarios generados; la función de tipos de cambio responde 400 ante fechas imposibles (`2023-02-31`) en lugar de devolver el tipo de cambio de hoy; y tras el timbrado, XML, PDF y fecha de timbrado quedan inmutables desde la app.
- **Guards**: nuevo `supabase/tests/ola_e1_guards.sql` (triggers, permisos, `WITH CHECK`, CHECKs y espejos) y pruebas unitarias de `validarCargoAbono` y de validación de fechas civiles.
- **Higiene de repositorio**: espejos canónicos y manifiesto sincronizados (1150 migraciones), re-emisión con timestamp posterior de `eliminar_pago_proveedor`, `_cxp_validar_aprobacion` (con su REVOKE/GRANT) y `v_proveedor_facturas_saldo`; mensajes amigables para los códigos `LC_*` nuevos; `ncFromCfdi` usa el alias central `Moneda` y las props de `NuevaNotaCreditoFormFields` se agruparon en `origen`/`datos`/`divisa`.

## [13.779.0] - 2026-08-28
### Corregido
- **Días de demora del tablero alineados con la facturación (hallazgo 8-A)**: `dashboard_details_datos` ya no asume ETA + 7 días libres en UTC; usa la fecha real de descarga (evento de tracking o contenedor), los días libres reales (override del contenedor → condiciones de la naviera → fallback 7) y calcula el "hoy" en hora de Ciudad de México. Era como medir la estadía de un coche con el reloj de otro país y una tarifa inventada: por las tardes el tablero cobraba un día extra y no coincidía con lo que factura `calcular_demoras_embarque`. Cada alerta indica si su base es real o estimada.
- **Notas de crédito de proveedor en otra moneda (hallazgo 8-B)**: `proveedor_notas_credito` gana `tipo_cambio` (MXN por 1 USD/EUR) con anclaje automático al DOF de la fecha de la NC (`trg_nc_prov_tc_convertible`), se bloquea el cruce USD↔EUR (`LC_NC_PROV_MONEDA_NO_CONVERTIBLE`) y tanto `v_proveedor_facturas_saldo` como `saldo_factura_proveedor` convierten la NC a la moneda de la factura. Antes una NC de $1,000 MXN borraba 1,000 USD de deuda: como pagar una cuenta en dólares con billetes de pesos y que la caja no notara la diferencia. El modal de captura ya permite elegir moneda y tipo de cambio, y muestra el equivalente contra el saldo.

## [13.778.2] - 2026-08-28
### Corregido
- **Candado CI service_role-only sincronizado**: `public._cxp_validar_aprobacion(uuid, text)` quedó registrada en `supabase/tests/rls/_ci_service_role_only.sql`. Es como avisar al portero que hay un cuarto nuevo con llave: la migración ya la cerró con REVOKE, pero la lista canónica no la conocía y el candado bidireccional la marcaba como faltante.

## [13.778.1] - 2026-08-28
### Corregido
- **CI en verde tras la Ola A (13.778.0)**: los espejos canónicos de `generar_liquidacion_comision` y `_cxp_validar_aprobacion` quedaron alineados byte a byte con las migraciones vigentes (`20260828031423`, `20260828031517`) —el guardrail `audit:replay-mirror` exige que en replay limpio el espejo y la migración digan lo mismo— y el manifiesto de release se sincronizó con las 1142 migraciones en disco.

## [13.778.0] - 2026-08-28
### Corregido
- **Comisiones "Por recuperar" ahora se descuentan (antes se perdían)**: `generar_liquidacion_comision` sólo sumaba `Devengada`, así que una comisión ya pagada cuya factura se canceló o se acreditó quedaba huérfana y la empresa la pagaba dos veces. Ahora se descuentan de la liquidación del periodo (de la más antigua a la más reciente, sólo hasta donde alcance el devengo), quedan marcadas y ligadas a esa liquidación con nota, y el remanente sigue pendiente para la siguiente.
- **Tope de sobrecosto CxP por concepto y en pesos**: `_cxp_validar_aprobacion` comparaba lo facturado contra lo comprometido usando *sólo* la factura en aprobación y sumando monedas distintas. Dos facturas podían cubrir cada una el 100% del mismo costo y ambas aprobarse (doble costo/doble pago), y un costo en USD contra factura en MXN generaba falsos sobrecostos o los ocultaba. Ahora el tope se evalúa concepto por concepto, incluyendo todas las facturas vivas ligadas a ese costo, con ambos lados normalizados a MXN vía `a_mxn_doc` (T/C del documento con fallback DOF). El helper interno dejó de ser ejecutable por `authenticated`.

## [13.777.13] - 2026-08-28
### Corregido
- **`baseline.sql` regenerado desde el replay real (fin del drift de formato)**: el snapshot traía bloques escritos a mano (líneas en blanco dentro de los cuerpos, encabezados `RETURNS ...` en renglón aparte en `cartera_pendiente`, `crear_clientes`, `is_org_member`, `vincular_anticipo_embarque`, `_factura_tc_dof_obligatorio`) y una definición duplicada de `crear_clientes`, cosas que `pg_dump` nunca emite; el guard de esquema fallaba por formato, no por estructura. Ahora el baseline es exactamente el dump normalizado del replay de las 1140 migraciones (510 funciones, 423 políticas, 296 triggers, 119 tablas, 7 vistas, 1438 grants), verificado recargándolo en base limpia sin errores.

## [13.777.12] - 2026-08-28
### Corregido
- **`supabase/schema/baseline.sql` sincronizado con el replay de migraciones**: el snapshot congelado no incluía `_cotizaciones_validar_prospecto` (candados prospecto/cliente en cotizaciones), la nueva firma `_cxp_validar_aprobacion(p_factura_id, p_justificacion)` con el three-way match mínimo (Ola 4 · H2), el fallback DOF de EUR (FIX BL-11) en los tableros, el comentario del rediseño CRM en la promoción de leads ni los helpers de seed demo. Se portaron los 48 bloques semánticos pendientes y se verificó recargando el baseline en una base limpia (sin errores) y comparando el dump contra el replay de las 1140 migraciones.

## [13.777.11] - 2026-08-28
### Corregido
- **CI de pruebas unitarias en verde (4 suites)**: `cierre.test.ts` no simulaba el segundo `.order("id")` del desempate estable (L1) ni en la consulta principal ni en el fallback de bitácora; `facturaManual.test.ts` no mockeaba `supabase.rpc` y seguía esperando un `DELETE` físico en lugar del rollback por `soft_delete_record`; `ComprasPorAprobar.test.tsx` no exportaba `useFiltroUrl`/`useTextoUrl` en el mock de `@/hooks/shared`.
- **Mensajes amigables `LC_*`**: se añadió `lcCodeMessages.clientes.ts` (5 códigos de la importación masiva de clientes) y `LC_FACTURA_SIN_TC_DOF` al catálogo financiero, cerrando el guard `lcCodeCoverage`.

## [13.777.10] - 2026-08-28
### Corregido
- **Suite RLS 34/34 en verde**: `test_rls_roles_no_admin.sql` toleraba sólo el bloqueo por política; ahora también acepta `insufficient_privilege` en los tres intentos de `DELETE` sobre `public.facturas` (viewer, operador cross-tenant y cliente), porque `authenticated` ya no tiene ese `GRANT` (borrado físico prohibido). En `test_rls_rpc_org_scope_linter.sql` se retiró `nc_aplicadas_en_moneda_factura` de la whitelist congelada: al volverse `service_role-only` dejó de ser candidata y la entrada quedó muerta.

## [13.777.9] - 2026-08-28
### Corregido
- **Suite de guards conductuales 58/58**: se cerraron los últimos 3 fallos. `ola3_controles_ciclo.sql` se alineó al esquema vigente (factura con `iva` para el check de totales, `cotizaciones` sin columna `total` y con `modo`/`tipo`, proforma con `expediente`, concepto de venta con `total` y apagado explícito de `app.bypass_cierre` que un helper previo dejaba encendido). `_ci_post_migrate.sql` re-cierra el `DELETE` sobre `public.facturas` para `authenticated`/`anon` (el `GRANT ... ON ALL TABLES` del Postgres bare de CI lo reinstalaba y anulaba el candado C6 de la Ola 1).
- **Replay desde cero: candado de cotización aceptada**: la re-emisión de espejos `20260902003000` regresó `public.cotizaciones_guard_en_operacion()` a la versión previa (sólo `En operación`, `LC_COTIZACION_EN_OPERACION`). Se actualizó el espejo canónico `supabase/schema/cotizaciones/guards_operacion.sql` y se añadió `20260902007000_cotizacion_inmutable_recierre.sql` para volver a emitir el cuerpo vigente (`LC_COTIZACION_INMUTABLE`: una cotización **Aceptada** también es inmutable en importes, moneda y conceptos).

## [13.777.8] - 2026-08-28
### Corregido
- **Candado CI `service_role-only`**: la migración `20260902003000` (fix numeric/integer de RPCs de embarques) reemitió `_crear_embarque_replicar_conceptos` con `GRANT EXECUTE` a `authenticated`, reabriendo una función interna. Nueva migración `20260902005000_ci_service_role_only_recierre_embarques.sql` (ordenada después del fix, para que el replay desde cero termine igual que prod) que revoca a `PUBLIC`/`anon`/`authenticated` y deja sólo `service_role`. Manifiesto: 1133 migraciones.

## [13.777.7] - 2026-08-28
### Corregido
- **CI (tests, coverage y audits) en verde**: `TesoreriaConciliacion.test.tsx` monta `NuqsTestingAdapter` (la página lee el filtro `estado` de la URL); `TesoreriaConciliacion.tsx` baja de 200 líneas extrayendo `useImportarEstadoCuenta`; candado M6 de soft-delete actualizado tras mover `conciliarConPago` a `conciliacionVincular.ts`; tipografía semántica y `EmptyStateInline` en los componentes nuevos de CRM; marcadores `SAFE-CAST` en `cliente/services/{crud,importLote}.ts`; baseline del ratchet de iconos recontado.

## [13.777.6] - 2026-08-28
### Corregido
- **Suite RLS completa en verde (34/34)**: `nc_aplicadas_en_moneda_factura` recupera `EXECUTE` para `authenticated` (la consume `cartera_pendiente()`, que es SECURITY INVOKER) y sale de la lista canónica service_role-only; whitelist documentada del linter org-scope para los helpers de visibilidad por rol y los wrappers de tablero; seeds de prueba de CRM (origen obligatorio en oportunidades) y de clientes (`email` NOT NULL) actualizados.

## [13.777.5] - 2026-08-28
### Corregido
- **CI candado service_role-only (dirección A)**: la re-emisión de espejos había reabierto `EXECUTE` a `authenticated` en `public._crear_embarque_replicar_conceptos` y `public.nc_aplicadas_en_moneda_factura`. Nueva migración de re-cierre (sólo `service_role`), archivos canónicos y `baseline.sql` alineados; manifiesto en 1131 migraciones.

## [13.777.4] - 2026-08-28
### Corregido
- **CI verde en `audit:tests`, `audit:replay-mirror` y `audit:manifest`**: título de prueba duplicado renombrado en `ConvertirLeadDialog.test.tsx`; espejo `_cxp_validar_aprobacion` sincronizado con la firma vigente (con justificación); nueva migración `20260902004000_replay_mirror_reemision_canonica.sql` que re-emite `nc_aplicadas_en_moneda_factura`, `cartera_pendiente`, `dashboard_summary_datos` y `dashboard_details_datos` para que un replay limpio quede igual a producción; manifiesto actualizado a 1130 migraciones.

## [13.777.3] - 2026-08-28
### Corregido
- **CI candado service_role-only**: se sincronizó `supabase/tests/rls/_ci_service_role_only.sql` con las 13 funciones internas nuevas (tableros, cierre de periodo, guardas de organización/periodo/UUID fiscal, demo y réplica de conceptos). La prueba vuelve a pasar sin drift.

## [13.777.2] - 2026-08-28
### Verificado
- **Cierre de la auditoría 3-4**: se revisaron los 26 hallazgos del reporte nuevo contra la base y el código reales. Todos los críticos y altos ya estaban corregidos en las olas anteriores (el reporte se hizo sobre una versión previa): las llaves de organización en las cuatro tablas financieras (H6) ya existen y están validadas, y los filtros de Embarques, Clientes y Cotizaciones ya se guardan en la liga (H8/M8) —verificado en el navegador—.
- **Aceptados sin acción** con justificación en `docs/auditoria/cierre-auditoria-3-4.md`: L4 (código muerto de IVA, resultado correcto), H8 (reset completo de migraciones en CI, ya cubierto por la regla H9) y la variante de índice único de correos de M3 (ya resuelta por trigger).

## [13.777.1] - 2026-08-28
### Agregado
- **Candado contra parches de texto en migraciones (auditoría 3 · M6)**: la auditoría de migraciones ahora rechaza cualquier migración que modifique una función con `replace(pg_get_functiondef(...))` (regla H9, aplica también al histórico). Ese patrón hacía que el código real de una función dependiera del estado previo de la base, así que una base nueva y producción podían quedar distintas sin que nadie lo notara —causa raíz del error de notas de crédito multi-moneda—. Desde ahora toda función se vuelve a escribir completa.

## [13.777.0] - 2026-08-28
### Agregado
- **Ola 9 — Cierre de la auditoría 3 (M2, M4, C1b, L1, L2, H8)**.
- **Tipo de cambio oficial obligatorio (M2)**: toda factura en dólares o euros nace con el tipo de cambio del DOF de su fecha de emisión. Si no hay tipo de cambio publicado para esa fecha, el sistema ya no deja crear la factura (`LC_FACTURA_SIN_TC_DOF`) en lugar de asumir un 1:1 que distorsionaba la utilidad.
- **Alta de clientes controlada (M4)**: el alta pasa por la función canónica `crear_clientes`, que valida rol, organización y completitud fiscal (RFC, régimen y código postal cuando el cliente lleva RFC). Se quitó el permiso de alta directa a la tabla, así que ya no existen atajos que se salten las validaciones. La importación masiva usa el mismo camino.

### Cambiado
- **Un solo saldo de factura (C1b)**: el reporte de antigüedad de cartera dejó de calcular las notas de crédito por su cuenta y ahora usa la misma fuente que el estado de la factura y los cobros, con la conversión de moneda correcta.
- **Paginación estable (L1)**: bitácora del embarque, eventos de tracking y validación de cierre ordenan con un desempate por identificador, para que ninguna fila se repita ni se pierda entre páginas.
- **Errores sin filtraciones (L2)**: al timbrar, los detalles técnicos de la base de datos se quedan en los logs; el usuario recibe un mensaje claro y un código estable.
- **Migraciones sin excepciones (H8)**: las cuatro migraciones que requerían exención se volvieron tolerantes y la lista `drift-anclas.txt` quedó vacía, así una base limpia se reconstruye completa.

## [13.776.1] - 2026-08-28
### Agregado
- **Ola 8 — Deep linking de filtros (auditoría 3 · M8)**: nuevos hooks compartidos `useFiltroUrl` / `useTextoUrl` (`src/hooks/shared/useFiltroUrl.ts`) que guardan los filtros de listados en la URL. Ahora se puede compartir un link con los filtros aplicados, el botón atrás los respeta y un refresh no los pierde.
- Tesorería › Pagos: periodo (desde/hasta), vista, cuenta, moneda, método SAT, conciliación, complemento de pago y búsqueda también viajan en la URL vía `useFiltrosLibroPagosUrl`.
- Migrados a filtros en URL: Compras › Pagos (rango de fechas, moneda, método, búsqueda), Compras › Notas de crédito, Compras › Conciliación, Compras › Por aprobar (pestaña + búsqueda), Proveedores (búsqueda, origen, tipo), Anticipos a proveedor (estado, proveedor) y Tesorería › Conciliación (estado del movimiento).

## [13.775.0] - 2026-08-28
### Agregado
- **Ola 7 — Validaciones de captura (auditoría 3 · M3, M5, M7)**.
- **Correos sin duplicados (M3)**: los correos de clientes y contactos se guardan siempre en minúsculas y sin espacios; al capturar o editar, el sistema avisa si ese correo ya lo tiene otro cliente/contacto activo de la misma organización (`LC_EMAIL_DUPLICADO`). Los duplicados históricos no se tocan.
- **Cronología de eventos de embarque (M5)**: se rechazan eventos ya ocurridos con fecha futura (`LC_EVENTO_FECHA_FUTURA`) y órdenes imposibles —arribo, descarga, despacho, liberación o entrega antes del zarpe, y entrega antes del arribo— (`LC_EVENTO_ORDEN_INVALIDO`).
- **Topes numéricos (M7)**: nuevo módulo `src/lib/validation/limitesNumericos.ts` como fuente única de `MONTO_MAX` (999,999,999.99) y `CANTIDAD_MAX` (1,000,000); aplicado a los inputs de costo unitario y cantidad de cotización.



## [13.774.0] - 2026-08-27
### Corregido
- **Ola 6 — Utilidad por cliente ya no mezcla monedas (auditoría 3 · M1)**. El detalle del cliente sumaba pesos y dólares en la misma bolsa y rotulaba el total como USD (100 USD + 100 MXN = "200 USD"). Ahora Facturado, Por cobrar y Utilidad se muestran **en MXN**, convirtiendo cada factura con su propio tipo de cambio.
- **Sin tipo de cambio no se inventa**: las facturas en moneda extranjera sin T/C confiable se excluyen del total y se avisa cuántas fueron, en lugar de sumarse como si 1 USD = 1 MXN.
- **`profit_por_cliente` reforzada**: antes dividía entre el T/C del embarque sin defensa, así que los conceptos en pesos de embarques sin T/C desaparecían del cálculo. Ahora resuelve el T/C con respaldo del DOF de la fecha del embarque, entrega también los importes en pesos y reporta cuántos embarques quedaron sin T/C.

## [13.773.0] - 2026-08-27
### Seguridad
- **Ola 5 — Los costos y la utilidad ya no salen del servidor para quien no debe verlos (auditoría 3 · C9)**. Antes la UI sólo *ocultaba* las columnas de costo y utilidad a perfiles comerciales, pero la respuesta del tablero seguía trayendo las cifras (visibles en la red). Ahora el propio servidor las devuelve vacías.
- **Regla única de visibilidad**: nueva función `public.puede_ver_costos_dashboard()`, espejo de `COST_VIEWERS` (dirección, gerencias, contabilidad, tesorería y cobranza). `vendedor`, `ejecutivo_pricing` y `viewer` quedan fuera.
- **Enmascarado en el servidor**: `dashboard_details()` y `dashboard_summary()` pasan a ser envolturas; el cálculo vive en `dashboard_details_datos()` / `dashboard_summary_datos()` (sólo internas) y el resultado se filtra con `public.enmascarar_costos_jsonb()`, que anula por prefijo cualquier campo de costo, utilidad, profit, margen o gastos operativos, conservando el shape del JSON.
- **`viewer` deja de leer costos de cotización**: se eliminó la policy `Tenant viewer cotizacion_costos`, que contradecía `puede_ver_costos_cotizacion()`.

## [13.772.1] - 2026-08-27
### Mantenimiento
- **Higiene de código (Power of 10)**: se dividieron los cuatro archivos que superaban 200 líneas — filtros del listado de cotizaciones, filtros secundarios de la página, acciones de la ficha de lead y campos de ruta del formulario de oportunidad. Sin cambios de comportamiento.
- **Pruebas**: corregido el mock de conciliación bancaria para sembrar el movimiento antes de vincular el pago.

## [13.772.0] - 2026-08-27
### Seguridad
- **Ola 3 — Controles del ciclo comercial y fiscal (auditoría 3)**.
- **Cierre de periodo contable**: nueva configuración por empresa en Configuración → Facturación. Al fijar la fecha de cierre, la base rechaza registrar o mover facturas, pagos de cliente, pagos a proveedor, facturas de proveedor y notas de crédito (cliente y proveedor) con fecha igual o anterior (`LC_PERIODO_CERRADO`).
- **Cotización aceptada inmutable**: antes sólo se bloqueaban los importes cuando la cotización ya estaba "En operación"; ahora también en "Aceptada" (`LC_COTIZACION_INMUTABLE`).
- **Conceptos ya proformados**: no se pueden editar (descripción, cantidad, precio, moneda, IVA) ni borrar físicamente mientras pertenezcan a una proforma (`LC_CONCEPTO_PROFORMADO`).
- **Consolidación de proformas**: exige mismo embarque y misma empresa; ya no puede arrastrar conceptos de otro embarque (`LC_PROFORMA_EMBARQUE_AJENO`).
- **Folio fiscal de una sola escritura**: una vez asignado el UUID del CFDI, ningún proceso puede sobrescribirlo (`LC_UUID_FISCAL_INMUTABLE`).

### Pruebas
- Nueva suite `ola3_controles_ciclo.sql` (cierre de periodo, cotización aceptada, concepto proformado y folio fiscal inmutable).

## [13.771.0] - 2026-08-27
### Seguridad
- **Ola 2 — Aislamiento entre organizaciones (hallazgos H de la auditoría 3)**: 28 relaciones críticas quedaron blindadas contra cruces entre empresas (facturas ↔ embarque/cliente/cotización/proforma/sustitución, pagos ↔ factura y embarque, notas de crédito ↔ factura, conceptos de venta y costo ↔ embarque/contenedor/proforma/proveedor, conceptos de factura, costos de cotización, proformas, facturas y pagos de proveedor, contenedores).
- El candado son validaciones automáticas en la base (`_assert_padre_misma_org`), que aplican también a procesos internos que no pasan por las reglas de acceso. Se probó con llaves compuestas y se descartó porque rompía las consultas embebidas de la app.
- No hubo cambios de datos: se verificó que no existía ni un registro cruzado antes de aplicar la migración.

### Pruebas
- Nueva suite `ola2_fk_compuestas_org.sql` (verifica las 28 relaciones y prueba que la base rechaza un cruce real).



## [13.770.0] - 2026-08-27
### Corrección
- **Notas de crédito multi-moneda (C1/C1b)**: el saldo y el estado de la factura ahora convierten la nota de crédito a la moneda de la factura. Una factura MXN saldada con una NC en USD ya queda en **Pagada** y desaparece de cartera (antes mostraba un adeudo fantasma).
- Las tres fuentes de saldo (`saldo_factura_bruto`, `recalcular_estado_factura` y `cartera_pendiente`) usan una sola función canónica `_nc_aplicadas_moneda_factura`.
- El rollback de una factura manual fallida ahora usa baja lógica en lugar de borrado físico.
### Seguridad
- **C7**: `ensure_demo_membership` dejó de ser ejecutable por usuarios autenticados (sólo el servicio interno); cerraba una vía de escalación de privilegios entre organizaciones.
- **C6**: prohibido el borrado físico de facturas (privilegios revocados, policy eliminada y trigger `trg_prohibir_delete_factura`).
- **C8**: `uuid_fiscal` único por organización en facturas vivas.
- **C9**: los indicadores de dirección (`dashboard_summary`, `dashboard_details`) exigen rol autorizado; el cálculo interno quedó reservado al servicio.
- Lectura de costos de cotización separada de la escritura: sólo roles con visibilidad de costo los reciben.
### Pruebas
- Nuevas suites de regresión `ola1_saldo_nc_multimoneda.sql` y `ola1_guards_c6_c7_c8.sql` registradas en el manifiesto de guards.



## [13.767.0] - 2026-08-27
### Nueva funcionalidad
- Rediseño CRM (etapa 2): toda **oportunidad** se crea eligiendo su origen — **Prospecto calificado** o **Cliente actual** — con nuevo selector `SelectorOrigenOportunidad` (pestañas + buscador).
- Ficha del prospecto: botón **"Nueva oportunidad"** y tarjeta **Oportunidades del prospecto** con etapa, monto y fecha estimada de cierre.
- Validación en el formulario antes de enviar (origen obligatorio) y mensajes claros para `LC_OPORTUNIDAD_SIN_ORIGEN`, `LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO` y `LC_CRM_CLIENTE_AJENO`.
- En edición el origen queda de sólo lectura para no romper la trazabilidad del embudo.



## [13.766.0] - 2026-08-27
### Nueva funcionalidad
- Rediseño CRM (etapa 1): embudo explícito **Lead → Prospecto → Oportunidad → alta de cliente (fuera del CRM)**.
- Nueva pestaña **CRM → Prospectos** (`/crm/prospectos`) con los leads ya calificados; `/crm/leads` ahora sólo muestra el primer contacto (Nuevo, Contactado, Descalificado).
- Botón **"Calificar como prospecto"** en la ficha del lead: exige el perfil comercial mínimo (sector, mercancía, rutas, volumen, frecuencia, dolor explícito y proveedor actual) vía RPC `crm_calificar_prospecto` (rol de ventas + candado multi-tenant + bitácora).
### Base de datos
- `_crm_lead_avanzar_por_cotizacion` ya no promueve leads sin calificar; sólo avanza prospectos.
- Nuevo trigger `trg_crm_oportunidad_requiere_origen`: toda oportunidad debe nacer de un prospecto o de un cliente (`LC_OPORTUNIDAD_SIN_ORIGEN`).

## [13.765.1] - 2026-08-27
### Corrección
- CI: `supabase/schema/baseline.sql` sincronizada con el esquema real — incluye los estados `Prospecto` y `Pendiente de alta`, la función/trigger `_crm_lead_avanzar_por_cotizacion`, sus permisos y el candado `LC_LEAD_ALTA_CLIENTE_PROHIBIDA` en `convertir_lead_rpc`.

## [13.765.0] - 2026-08-27
### Nueva funcionalidad
- Cotizaciones: segmentación Clientes / Prospectos / Todas en el listado (tabs con conteos); los KPIs de 30 días se calculan dentro del segmento activo.
- Cotizaciones a prospecto llevan folio propio `COT-P-YYYY-####` (RPC `siguiente_folio_cotizacion_prospecto`, secuencia independiente por org/año) y badge "Prospecto" en tabla y tarjeta móvil.
- CRM: `fetchCotizacionesSinRespuesta` acepta filtro por segmento y muestra la empresa del prospecto cuando aplica.

### Seguridad e integridad
- BD: trigger `trg_cotizaciones_validar_prospecto` — una cotización de prospecto no puede tener cliente ligado y exige `prospecto_empresa`; una cotización de cliente fuera de borrador exige `cliente_id`.
- BD: `convertir_prospecto_a_cliente_rpc` ahora re-vincula TODAS las cotizaciones históricas del prospecto (misma empresa y org) al cliente nuevo, conservando el historial.

## [13.764.0] - 2026-08-27
### Nueva funcionalidad
- CRM: ciclo de vida del prospecto. Nuevos estados de lead `Prospecto` (calificado y en cotización) y `Pendiente de alta` (aceptó cotización pero aún no es cliente).
- BD: trigger `trg_crm_lead_avanzar_por_cotizacion` avanza el lead según el estado de su cotización de prospecto (Enviada/Solicitada → `Prospecto`, Aceptada → `Pendiente de alta`), sin tocar leads Descalificados ni Convertidos.
- UI: `LeadEtapaProspectoAviso` explica en la ficha del lead que aún no es cliente y ofrece el alta manual sólo a roles autorizados.


## [13.763.1] - 2026-08-27
### Corrección de errores
- CRM: `ReferenceError: SIN_CLIENTE is not defined` al abrir el diálogo/sheet de convertir lead. Se extrajo `SIN_CLIENTE` a `src/features/crm/constants/crmConstants.ts` para desacoplarlo del default export de `SelectorClienteExistente` y evitar que Vite/SWC no resuelva el named export en runtime.
- Pruebas: se agregaron tests de renderizado para `ConvertirLeadDialog` y `ConvertirLeadSheet` que cubren la regresión.

## [13.763.0] - 2026-08-27
### Seguridad
- CRM: `convertir_lead_rpc` ya no crea clientes (`LC_LEAD_ALTA_CLIENTE_PROHIBIDA`) y sólo es ejecutable por `authenticated`. El alta de clientes vive únicamente en el módulo de Clientes, con su gate de roles y validaciones fiscales (RFC, CP, régimen).
- Al convertir un prospecto ahora se liga un cliente **existente** (`SelectorClienteExistente`) o se deja la oportunidad sin cliente; se retiró el checkbox de creación en `ConvertirLeadDialog` y `ConvertirLeadSheet`.
- Datos: el cliente `IAASA`, creado incompleto por esta vía, se envió a la papelera y su oportunidad quedó sin cliente para religarla tras el alta oficial.
- Pruebas: `supabase/tests/ola6_convertir_propaga.sql` cubre el candado, la herencia a la oportunidad, el ligado de cliente existente y el rechazo de clientes de otra organización.



## [13.762.9] - 2026-08-27
### Corrección de errores
- CI (drift radar): la migración `20260827020732` revoca permisos de `cotizaciones_guard_en_operacion()`, función creada en una migración posterior, por lo que abortaba en base limpia. Se agregó a `drift-anclas.txt` (estado final garantizado por `20260902003000`).


## [13.762.8] - 2026-08-27
### Corrección de errores
- Crear embarque desde cotización: la migración B-19 (cantidades fraccionadas) reescribía funciones con un reemplazo de texto y dejó el tipo corrupto `numericeger` en `_crear_embarque_replicar_conceptos`, rompiendo la replicación de conceptos. Se reinstalaron las definiciones canónicas de `_crear_embarque_replicar_conceptos`, `actualizar_embarque_completo` y `crear_embarque_completo`.
- Se recreó el CHECK `conceptos_venta_total_calc` sin el casteo heredado de cuando `cantidad` era entero y se revocó el acceso público a `cotizaciones_guard_en_operacion` (H6). `baseline.sql` sincronizado.


## [13.762.7] - 2026-08-27
### Corrección de errores
- Notas de crédito: el arreglo anterior quedó con una marca de tiempo (`20260827015809`) previa a la migración que reintroducía la versión vieja (`20260901002000`), así que en el replay del CI volvía a ganar la validación estricta. Se reordenó como `20260902002000_nc_fecha_tolerante_utc.sql` y los 3 guards de NC quedan en verde.
- Suite RLS/guards ejecutada en base limpia local: 54/54 (las 2 fallas observadas provenían de migraciones abortadas sólo en el sandbox; los triggers existen en la base real).



## [13.762.6] - 2026-08-27
### Corrección de errores
- Notas de crédito de cliente: una migración posterior había reinstalado la validación de fecha vieja (sólo fecha de México), rechazando NC capturadas por la tarde/noche. Se reaplicó la versión tolerante (fecha de México o del servidor).

## [13.762.5] - 2026-08-27
### Fix
- CI (radar de drift): se eximió `20260827010526…` del replay en base limpia — instala un trigger cuya función se crea en una migración posterior; el estado final lo garantizan `20260901001400` y `20260902001000`.

## [13.762.4] - 2026-08-27
### Corrección de errores
- Notas de crédito: se corrigió el rechazo indebido "la fecha debe estar entre la emisión de la factura y hoy" al capturar por la tarde/noche en México (el servidor ya estaba en el día siguiente).
- Suite RLS: se agregó la función faltante al arranque de pruebas para que el replay en base limpia no aborte.

## [13.762.3] - 2026-08-27
### Fix
- Sincronizado `migration-manifest.json` con las 1106 migraciones en disco.

## [13.762.2] - 2026-08-27
### Corrección de errores
- Bitácora: la barra de filtros se separó en su propio componente para cumplir el límite de tamaño de archivo (sin cambios visibles).
- Se agregó el mensaje en español para el candado de sobrecosto de facturas de proveedor (LC_CXP_SOBRECOSTO).

## [13.762.1] - 2026-08-27
### Corrección de errores
- Reparada una diferencia entre la base de datos y el código: volvieron a activarse tres candados que no habían llegado a producción (fecha válida en notas de crédito, conceptos de factura editables sólo en Borrador y bloqueo de cambios en cotizaciones ya operadas).
- Estado de resultados anual: sólo cuenta facturas realmente emitidas (antes sumaba borradores y facturas por timbrar) y agrupa las notas de crédito por su fecha de emisión, no por la última modificación.

## [13.762.0] - 2026-08-27
### Mejoras
- Cuentas por pagar: al aprobar una factura de proveedor ahora se compara lo facturado contra el costo comprometido del embarque. Si el exceso pasa del 5% se bloquea (`LC_CXP_SOBRECOSTO`); si es menor, se aprueba con advertencia.
- Facturas de proveedor: la fecha de vencimiento se calcula sola (emisión + días de crédito) y se recalcula si cambia alguno de los dos. Las facturas de cliente ya no nacen con vencimiento "hoy" por default.
- Facturas de proveedor: candado transaccional contra folios duplicados del mismo proveedor (no afecta registros históricos ni ediciones que no toquen el folio).
- Conceptos de venta: la cantidad ahora admite decimales (por ejemplo 1.5 toneladas).
- Privacidad de costos: los roles comerciales (vendedor, ejecutivo de pricing) ya no ven columnas de costo, utilidad ni margen en el tablero de rentabilidad.
- Bitácora: navegación por cursor (keyset), mucho más rápida en historiales largos.

### Corrección de errores
- Se reintegró la tolerancia de medio centavo por unidad al cuadrar conceptos vs subtotal de facturas de proveedor, que se había perdido con el cambio anterior.

## [13.761.1] - 2026-08-27
### Corrección de errores
- Eventos de tracking (cambio de ETA, arribo): la validación recortaba la hora y guardaba sólo el día, así que un evento de esta tarde aparecía en la línea de tiempo como "ayer a las 6:00 PM". Ahora se conserva la fecha y hora completas y los eventos se ordenan bien dentro del día.

## [13.761.0] - 2026-09-02
### Seguridad
- W-02: el PDF que se envía por correo se resuelve en el servidor a partir de la cotización (ya no se acepta la ruta que manda el navegador), así que nadie puede pedir un enlace firmado de un archivo de otra organización.
- W-04: los datos del ejecutivo que firman el correo se toman de la sesión, no del mensaje del navegador (evita suplantación).
- W-05: sólo los roles con permiso de escritura en cotizaciones pueden enviarlas por correo.
- W-03: el enlace del PDF caduca en 7 días (antes 30).
- N-01: el lector de Constancias de Situación Fiscal exige rol con permiso de alta fiscal y aplica topes de uso (20/hora por usuario, 100/hora por organización) para que nadie agote la cuota de IA.
- N-02: los errores del lector de CSF ya no devuelven detalles internos al navegador; sólo un mensaje claro (el detalle queda en el registro técnico).

### Fix
- W-01: se corrigió el orden de argumentos en las respuestas de `enviar-cotizacion-email`, que rompía el envío de cotizaciones por correo.
- N-01: el llamado a la IA del lector de CSF corta a los 45 segundos y devuelve un mensaje de reintento en vez de quedarse colgado.
- W-11: la cola de correos reclama cada envío antes de llamar al proveedor, para que dos corridas traslapadas del proceso automático no manden el mismo correo dos veces.



## [13.760.0] - 2026-09-02
### Seguridad
- Importación CSV de clientes y proveedores: se neutralizan las celdas que inician con `=`, `+`, `-` o `@` (anteponiendo `'`) para evitar inyección de fórmulas al abrir el archivo exportado en Excel.

### Fix
- N-06: bloqueo optimista (`updated_at`) al editar cotizaciones, cambiar el estado de notas de crédito y actualizar datos de timbrado de facturas. Si otra sesión ya modificó el registro se lanza `LC_CONFLICTO_CONCURRENCIA` en lugar de sobrescribir en silencio.
- W-13: en el alta de cotizaciones el MSDS se sube DESPUÉS de crear el registro; antes, si la creación fallaba, el PDF quedaba huérfano en el almacenamiento.

### Rendimiento
- Importación masiva: `createClientesLote` e `insertProveedoresLote` hacen un solo `insert` por lote de 200 filas en vez de una inserción por fila (5 viajes por cada 1000 registros). Los proveedores reintentan fila a fila sólo si el lote choca con el RFC duplicado.

## [13.759.0] - 2026-08-26
### Fix
- Portal de cliente: las policies `Cliente read own facturas`, `Cliente read own documentos`, `Cliente read own factura_notas_credito` y `Cliente read own embarque_contenedores` ahora exigen `deleted_at IS NULL` (propio y del padre). Antes el portal mostraba registros enviados a la papelera.
- QA-R2 R-04: `recalcular_subtotal_cotizacion` levanta la GUC transaccional `app.cotizacion_sync` y `cotizaciones_guard_en_operacion` la respeta, para que la sincronización interna del subtotal no choque con `LC_COTIZACION_EN_OPERACION`.
- Tests RLS: `test_rls_portal_intra_org` verifica que factura y documento en papelera no son visibles al rol cliente.

## [13.758.5] - 2026-08-26
### Fix
- Baseline de esquema: se normalizó el formato de `LANGUAGE plpgsql SECURITY DEFINER` en `calcular_comision_pago`, `congelar_factura_al_emitir` y `tg_factura_cancelada_comisiones` para que el snapshot del CI coincida byte a byte.

## [13.758.4] - 2026-08-26
### Fix
- CI: la corrección del candado `LC_FACTURA_SIN_CONCEPTOS` vivía en una migración con fecha anterior a la que lo introdujo, así que en un `db reset` limpio se reaplicaba la versión vieja y tumbaba 28 suites RLS. Se corrigió en la migración original `20260902000400_qa_r2_d05_factura_sin_conceptos.sql` y se regeneró el manifiesto (1102 migraciones).


## [13.758.3] - 2026-08-26
### Fix
- `congelar_factura_al_emitir`: el candado `LC_FACTURA_SIN_CONCEPTOS` sólo aplica en la transición `Borrador`/`Por timbrar` → `Emitida`. En `INSERT` era imposible de cumplir (los conceptos requieren que la factura ya exista) y tapaba el mensaje `LC_FAC_REAPERTURA` al reabrir canceladas.
- Suites RLS y conductuales de nuevo en verde (27 suites desbloqueadas).



## [13.758.2] - 2026-08-26
### Fix
- `fetchClientesForSelect` ahora filtra `deleted_at IS NULL` (guardia audit:soft-delete en verde).


## [13.758.1] - 2026-08-26
### CI verde
- Mensajes amigables para `LC_FACTURA_SIN_CONCEPTOS`, `LC_CXP_FOLIO_DUPLICADO`, `LC_DELETED_AT_INMUTABLE` y `LC_RESTORE_DIRECTO`.
- `supabase/tests/qa_remediacion_selectiva.sql` registrada en el manifiesto de guards.
- `tcPar.ts` usa el alias central `Moneda` en lugar de redeclarar la unión de monedas.
- `cliente/services/crud.ts` dividido: los listados viven en `cliente/services/listado.ts` (Power of 10 ≤200 líneas).

## [13.758.0] - 2026-08-26
### D-01b · Guardia automática contra "registros fantasma"
- Nuevo auditor `bun run audit:soft-delete`: revisa todo `src/` y falla si un listado, contador o buscador nuevo lee una tabla con borrado lógico sin `deleted_at IS NULL`. Corre en CI junto a las demás auditorías.
- Excepciones legítimas (Papelera) se declaran con `// SOFT-DELETE-OK: motivo`; la deuda histórica vive en `scripts/audit-soft-delete-baseline.json` y sólo puede bajar.
- Corregidas 28 lecturas reales que aún mostraban registros eliminados: comisiones y liquidaciones, costos de cotización, conciliación bancaria BBVA, contenedores y eventos de embarque, expedientes y BL master, tablero del operador, CRM (Cliente 360, tablero, forecast, leaderboard, buscador de prospectos), clientes fiscales, facturas masivas/sustitutas/cobro en lote, portal del agente, presupuesto vs real, conceptos de proforma y saldos de tesorería.

## [13.757.0] - 2026-08-26
### D-01 · Candado a la papelera (`deleted_at`)
- Un registro eliminado ya sólo se puede restaurar desde la Papelera (RPC con validación de rol y organización); se bloquea la restauración directa por la API de datos (`LC_RESTORE_DIRECTO`).
- La fecha de borrado se normaliza a `now()` y `deleted_by` al usuario de la sesión: ya no se pueden falsificar fechas ni autoría.
- La fecha de borrado de un registro que ya está en papelera es inmutable (`LC_DELETED_AT_INMUTABLE`).
- Trigger `trg_guard_soft_delete` aplicado a las 29 tablas de la allowlist de papelera; prueba de regresión en `supabase/tests/d01_guard_soft_delete.sql`.


## [13.756.0] - 2026-08-26
### Cotizaciones eliminadas ya desaparecen de todas las vistas
- Las cotizaciones eliminadas (borrado lógico) seguían apareciendo en el listado de Cotizaciones; ahora se filtran en la lectura (`deleted_at IS NULL`).
- Mismo filtro aplicado en: buscador de cotizaciones aceptadas para vincular a embarques, apertura por link directo, detalle de cliente, Cliente 360, CRM (oportunidad y "sin respuesta"), contadores de re-aprobación y portal del cliente (listado y detalle).

## [13.755.0] - 2026-08-26


## [13.755.0] - 2026-08-26
### QA ronda 2 · Facturas sin conceptos, comisiones "Por recuperar" y topes de archivos
- D-05: una factura sin conceptos vivos ya deja todos sus totales en cero (antes conservaba subtotal/IVA capturados y el total quedaba inflado); además ya no se puede pasar una factura a "Emitida" si no tiene conceptos (`LC_FACTURA_SIN_CONCEPTOS`).
- N-07: las comisiones ya liquidadas cuyo respaldo desaparece (pago eliminado, factura cancelada o sustituida, embarque excluido) se marcan con el nuevo estado **Por recuperar** para su ajuste en la siguiente liquidación, y el monto de comisión nunca queda negativo. El estado ya aparece con chip propio y en el filtro de Comisiones.
- W-08: los buckets de archivos (documentos, facturas, PDFs de cotizaciones y facturas, buzón CxP, cartas garantía y reportes) ahora rechazan archivos mayores a 25 MB.
- Mantenimiento: espejo canónico de `calcular_comision_pago`, manifiesto de migraciones y `baseline.sql` sincronizados.

## [13.754.1] - 2026-08-26
### CI · Baseline de esquema sincronizado
- Se agregaron al `baseline.sql` los objetos de la etapa QA-R2 (candado de cancelación con CxC/CxP vivas, liberación de cotizaciones al cancelar, folio único de facturas de proveedor, dependencias de baja de clientes y políticas de portal), eliminando el falso positivo del job de baseline.

## [13.754.0] - 2026-08-26
### QA ronda 2 · Etapa A-C: bugs de frontend, importación masiva y bloqueo optimista
- Cotizaciones sólo en pesos ya no se guardan con subtotal 0: `subtotal` y `moneda` se derivan de los conceptos de venta (moneda dominante) y el detalle deja de bloquear el envío por "sin importe" (W-01).
- La barra de totales del wizard muestra el margen por moneda (USD y MXN por separado) en lugar de un consolidado que ignoraba la utilidad en pesos (W-06).
- P&L por contenedor: sin venta el margen se muestra como "n/a" en vez de "0.0%" (W-07).
- Dashboard: los embarques con estado legacy `Llegada` vuelven a contarse dentro de `Arribo` (W-10).
- PDF de cotización: la fecha se formatea en la zona horaria de negocio, ya no se corta el día en UTC (W-12).
- Conceptos de proforma: la columna IVA dice "Sí" sólo si la tasa resuelta de la línea es mayor a cero (respeta conceptos MXN exentos) (R-03).
- Eventos de embarque: se inserta el dato ya normalizado por el esquema de validación (R-06).
- Portal de cliente: se ocultan embarques en papelera y se dejó de exponer el campo interno `notas` de los documentos (N-03/N-04).
- Importación masiva CSV: tope de 2 MB y 1,000 filas por archivo, con inserción en lotes de 200 y concurrencia acotada (N-05).
- Edición de clientes con bloqueo optimista: si otro usuario modificó el registro, se avisa en vez de sobrescribir sus cambios (N-06).
- Mensajes de cancelación de embarque con facturas vivas reescritos para explicar el siguiente paso.

## [13.753.0] - 2026-08-26
### QA ronda 2 · Etapa 1: candados validados de la auditoría
- Cancelar un embarque con facturas de cliente con saldo o facturas de proveedor vivas ahora se bloquea también en escritura directa a tabla (nuevo trigger `trg_embarques_cancelacion_cxc_cxp`), no sólo dentro de la RPC (D-02).
- Al cancelar un embarque se liberan sus cotizaciones ligadas: `embarque_id` a nulo y `En operación` → `Aceptada` (R-02).
- La baja de un cliente ya no cuenta embarques `Cancelado` ni cotizaciones en `Borrador` como dependencias vivas (D-03).
- Folio de proveedor único por organización + proveedor normalizando mayúsculas y espacios, ignorando papelera y canceladas (D-04).
- Storage: la lectura del bucket `documentos` exige que el documento y su embarque no estén en papelera (W-09).
- Portal de cliente: las políticas de lectura de embarques y cotizaciones excluyen registros en papelera (N-03).
- Fuera de alcance por riesgo de regresión (documentado en la auditoría): D-01, D-05, N-07, W-08, R-01, R-04.



## [13.752.2] - 2026-08-26
### Higiene de migraciones: permisos, espejos y manifiesto al día
- Nueva migración `20260901002100`: re-aplica los permisos explícitos (`REVOKE` a público/anónimo + `GRANT EXECUTE` a sesión iniciada y sistema) de `reabrir_embarque` y `avanzar_estado_embarque`, que se habían re-emitido sin ese bloque (H6).
- Espejos canónicos `cartera_pendiente.sql` y `guards_documentos_emitidos.sql` sincronizados con la migración vigente, para que un replay limpio no pise los fixes de 13.752.0.
- `migration-manifest.json` regenerado (1093 migraciones).

## [13.752.1] - 2026-08-26
### Baseline de esquema con el formato de Postgres 15 (el de CI)
- `supabase/schema/baseline.sql`: normalizado al estilo de `pg_dump` 15.8 (vistas con alias calificado y espaciado de `ALTER DEFAULT PRIVILEGES`). El baseline se había regenerado con `pg_dump` 17 local, lo que producía diff falso en el job "Baseline de esquema".

## [13.752.0] - 2026-08-26
### Corridas de RLS: dos reglas corregidas y dos pruebas alineadas
- Cartera: los "días vencido" volvieron a mostrarse con signo. Una factura que vence en 10 días ya no aparece como "vence hoy" (regresión introducida en 13.747.0).
- Notas de crédito: la validación de fecha ya no marca "fecha inválida" cuando la factura ligada fue archivada.
- Pruebas actualizadas al canon vigente: conceptos de factura se siembran en Borrador y el permiso de cotizaciones acepta los roles operativos habilitados en 13.750.0.
- `scripts/db/local-verify.sh` ahora respeta las migraciones ancladas y exentas igual que CI, para que la corrida local no se detenga en un parche histórico.
- `supabase/schema/baseline.sql` regenerado: llevaba tres migraciones de atraso (B-01/B-06 y remediación selectiva) y el job de baseline habría marcado drift.


## [13.751.1] - 2026-08-26
### El tipo de cambio se pide igual en todo el ERP
- Auditoría completa: el cálculo ya era el estándar mexicano (pesos por 1 dólar) en todos los módulos; lo que variaba era la etiqueta.
- Los campos que sólo decían "Tipo de cambio" ahora indican el par ("Tipo de cambio (MXN por 1 USD)"), con placeholder 18.4200 y la ayuda "Pesos que se pagan por 1 USD": pago a proveedor, configuración de timbrado de factura y factura manual.
- El helper de la convención se movió a `src/lib/financial/tcPar.ts` para que Tesorería, Compras y Facturación compartan la misma etiqueta. Sin cambios en la base de datos.


## [13.751.0] - 2026-08-26
### El tipo de cambio del traspaso ya se captura "pesos por dólar"
- En "Traspaso entre cuentas propias" el tipo de cambio se pedía invertido: para pasar de MXN a USD había que teclear 0.0543 en lugar de 18.42. Ahora el campo siempre se captura a la mexicana (unidades de la divisa débil por 1 de la fuerte), sin importar la dirección del traspaso.
- La etiqueta indica el par explícitamente ("Tipo de cambio (MXN por 1 USD)"), la sugerencia del TC DOF se muestra en la misma convención y la ayuda ahora previsualiza el abono real.
- Lo que se guarda en la base no cambió: el multiplicador origen→destino se deriva internamente.



## [13.750.1] - 2026-08-26
### El icono de calendario ya abre el selector de fechas
- En los campos de fecha (por ejemplo el traspaso entre cuentas de Tesorería) el botón del calendario no hacía nada: el tooltip envolvía al disparador y se comía el clic. Ahora abre el calendario en todos los formularios.
- Mismo arreglo en el botón "Explicar con IA" de Auditoría.



## [13.750.0] - 2026-08-26
### Los roles operativos ya pueden cotizar
- El Coordinador Logístico, Gerente de Operaciones, Operador y Customer Service podían abrir el wizard de "Nueva cotización" pero el guardado fallaba con "No tienes permisos" (RLS 42501). Ahora la regla de escritura de la base de datos los incluye, igual que al equipo comercial.
- Se alinea la captura de conceptos de venta para incluir a Customer Service.
- Los roles de sólo consulta (Viewer, Gerente Visor, Cliente) siguen sin poder crear cotizaciones.



## [13.749.0] - 2026-08-26
### Bitácora no falsificable, vínculo cotización↔embarque y cartera móvil
- B-06: al reabrir un embarque, el usuario que queda firmado en notas, eventos y bitácora se toma de la sesión autenticada. Antes se escribía el correo que enviaba el navegador, que podía alterarse; el frontend ya no lo manda y la función lo ignora.
- B-05: si el embarque se crea pero falla el vínculo con la cotización, ahora se reintenta dos veces con espera y, si aún falla, se muestra un error visible con el expediente y la cotización a reconciliar (antes era un aviso discreto que pasaba desapercibido). El flujo sí continúa al embarque creado para no capturarlo dos veces.
- B-11/B-12: al intentar editar una cotización no editable ya no hay rebote mudo al detalle: se explica el motivo. También se bloquea la edición de cotizaciones ya vinculadas a un embarque, aunque sigan en Borrador (evita desincronizar venta contra costos reales).
- B-25: la lista de Cartera en celular mostraba "-5d" en facturas por vencer; ahora usa las mismas etiquetas que la tabla de escritorio (Vencida Nd / Vence hoy / Vence en Nd).
- Dictamen del parche: se descartan B-07 (visibilidad de costos por rol, sin cambios por decisión de negocio), B-26 (reintentos en marcado masivo de hallazgos, ya idempotente) y B-27 (paginación por cursor en la bitácora, sin evidencia de impacto).


## [13.748.0] - 2026-08-26
### Validación financiera: IVA en pesos, T/C por fecha y topes de captura
- B-09: los conceptos en MXN dejan de gravarse "por default". Ahora se respeta el flag de exención de cada fila (había 285 conceptos marcados como exentos que igual llevaban 16%, típico en fletes internacionales).
- B-03: los tipos de cambio se consultan con la fecha del documento (emisión de factura/NC, fecha del pago) en vez del T/C de hoy, para no valuar mal capturas retroactivas.
- B-08: detector de desviación que avisa en consola si el total guardado de una proforma difiere del recalculado por más de medio centavo.
- B-21: la suma de costos multi-moneda usa la primitiva canónica de redondeo, alineada con Postgres en montos negativos.
- B-23: topes de magnitud en cotizaciones (montos ≤ 999,999,999.99 y cantidades ≤ 1,000,000) para frenar dedazos.
- B-24: los eventos de tracking se validan (tipo obligatorio y fecha AAAA-MM-DD), su lectura está acotada, la fecha de nota de crédito no puede ser anterior a la factura ni futura, y los filtros de responsable en CRM escapan el correo.
- Se añaden mensajes en español para LC_CANCEL_CON_CXC, LC_CANCEL_CON_CXP, LC_FACTURA_INMUTABLE, LC_NC_FECHA_INVALIDA, LC_BAJA_CON_DEPENDENCIAS y LC_COTIZACION_EN_OPERACION.



## [13.747.1] - 2026-08-26
### Vinculación multi-moneda sin ajuste fantasma
- Al vincular un costo cotizado en otra moneda (p. ej. 51 USD facturados como 872.57 MXN), la base de comparación se guarda ya convertida a la moneda de la factura: se elimina el ajuste de costo falso de ~821 que inflaba el embarque.

## [13.747.0] - 2026-08-26
### Integridad selectiva de operaciones y finanzas
- Se corrigen B-01, B-02, B-04, B-06, B-11, B-17, B-18, B-20 y B-25: bloqueo de cancelación con CxC/CxP vivas, bajas con dependencias, identidad de auditoría real, documentos operados inmutables, fechas contables de NC y aging en horario de México.
- B-12 se excluye porque bloquear `embarque_id` rompe la liberación legítima de cotizaciones al enviar un embarque a papelera; B-13 queda sin mutación automática porque el folio repetido pertenece a dos expedientes y requiere conciliación funcional.
- No se aplican B-14, B-15, B-16, B-19, B-22 ni B-28 por ser cambios incompletos, cobertura existente o residuos ausentes.

## [13.746.6] - 2026-08-25
### CI: baseline de esquema sincronizado
- `supabase/schema/baseline.sql` se sincroniza con el esquema actual del buzón CxP: `subtotal_detectado` y la firma vigente de 12 argumentos de `adjuntar_xml_entrante_verificado`. Sin cambios funcionales.

## [13.746.5] - 2026-08-25
### Lint: reduce complejidad en `scrollToErrorSection.ts`
- `seccionParaErrorPaso1` se refactoriza a una tabla de búsqueda (`REGLAS_SECCION`) para bajar la complejidad ciclomática por debajo del límite de ESLint (16). Sin cambios de comportamiento.

## [13.746.4] - 2026-08-25
### Suite RLS: sobrecarga duplicada en el buzón CxP
- Nueva migración espejo `20260901000000_ola_espejo_adjuntar_xml_subtotal.sql`: en base limpia `public.adjuntar_xml_entrante_verificado` quedaba con DOS firmas (11 y 12 args), porque `20260826004000` y `20260831000100` reintroducían la variante sin `p_subtotal_detectado` después de `20260825160948`. Cualquier llamada moría con `function ... is not unique` (guard `fix3_bug18_alta_inicial`).
- La migración re-emite el cuerpo vigente (12 args, subtotal sin IVA), dropea la sobrecarga legacy y restaura la postura `service_role`-only (se retira el `EXECUTE` a `authenticated`).
- Espejo canónico `supabase/schema/cxp/adjuntar_xml_entrante_verificado.sql` y catálogo `_ci_service_role_only.sql` actualizados a la firma de 12 args.
- Resultado local (Postgres efímero + 1063 migraciones): 34/34 suites RLS y 51/51 guards bloqueantes en verde; radar 12/13 (`normalizar_razon_social_unicode` sólo falla por locale `C` del sandbox, no en CI).


## [13.746.3] - 2026-08-25
### Cotizaciones: validación clara en Paso 1
- Los campos obligatorios del borrador (modo, tipo de operación, Incoterm, descripción de la mercancía, origen y destino) ahora se validan ANTES de guardar: se marcan inline con scroll+foco a su sección, en lugar del toast técnico "Cotización — Modo: requerido." al fallar el boundary de mutación.
- Nuevo `datosGeneralesSchema` en `domain/schemas/wizardPasos.ts`; mensajes en `COPY_VALIDACION`; `campoParaErrorPaso1` y `seccionParaErrorPaso1` mapean los seis campos nuevos.

## [13.746.2] - 2026-08-25

- `facturasEntrantesBuzon.ts` (216 líneas) se divide en `facturasEntrantesTipos.ts` e `facturasEntrantesImporte.ts` para cumplir el límite de 200 líneas (Power of 10). Sin cambios de comportamiento; el barrel reexporta la API pública.

## [13.746.1] - 2026-08-25
### CI verde: complejidad y catálogos
- `VincularConceptoRow` y `VincularEmbarqueSection` se dividen en `VincularConceptoAvisos` y `VincularEmbarqueHeader`; `extraerCfdiXmlMeta` extrae `mapearComprobante`. Sin cambios de comportamiento.
- Alta de `LC_XML_SUBTOTAL_INVALIDO` en el catálogo de mensajes y fixture Deno del buzón con `subtotal`.

## [13.746.0] - 2026-08-25
### CRM: el botón "Nuevo" ya abre el formulario
- Las altas express (lead, oportunidad, actividad) pasan de Popover anclado al menú a modal estándar (`FormDialogShell`): antes el clic en "Nuevo lead" no mostraba nada porque el Popover perdía la carrera contra el cierre del menú.
- Los atajos L / O / A abren los mismos modales; "Más campos →" sigue abriendo el formulario completo.
- Etiquetas homologadas al es-MX del ERP: "Email" → "Correo" en leads, plantillas, importación CSV y acciones de contacto.

## [13.745.1] - 2026-08-25
- CXP paso 3: el aviso "el monto asignado supera lo cotizado" ya no aparece por la diferencia normal de tipo de cambio (sólo si el T/C implícito se desvía >2% del DOF) y el mensaje explica el siguiente paso.

## [13.745.0] - 2026-08-25
### CxP: conciliar costos en USD contra facturas en MXN
- En el paso 3 de "Capturar factura de proveedor" los importes vinculados se capturan SIEMPRE en la moneda de la factura.
- Un costo cotizado en otra moneda muestra su equivalencia con el T/C DOF de la fecha de emisión (p. ej. 51.00 USD ≈ 872.57 MXN) y se prellena ya convertido al marcarlo.
- Se muestra el T/C implícito de lo capturado y un aviso ámbar si se desvía más de 2% del DOF.
- Sin T/C DOF del día, el concepto en otra moneda queda bloqueado con instrucción de registrar el tipo de cambio, en lugar de mezclar monedas y generar ajustes de costo espurios.

## [13.744.0] - 2026-08-25
### Buzón CxP: importes sin IVA
- El buzón de facturas de proveedor ahora muestra el **subtotal (sin IVA)** del CFDI, alineado con los costos del ERP; el total con impuestos queda en el tooltip.
- Documentos antiguos sin subtotal guardado se marcan como "Total con IVA" en vez de fingir que son netos.
- Al subir un documento, el monto se prellena con el subtotal del XML y la etiqueta pasa a "Monto de la factura sin IVA"; el cotejo contra costos compara contra el subtotal.
- La verificación server-side del XML (`adjuntar-xml-entrante`) guarda `subtotal_detectado` re-parseado del CFDI.



## [13.743.11] - 2026-08-25
### CI: baseline de esquema con pg_dump 17 (`\restrict`)
- `pg_dump` 17 envuelve el dump con las metacomandos `\restrict` / `\unrestrict` (token aleatorio en cada corrida), lo que generaba un diff falso permanente en el job `schema-baseline`.
- `scripts/db/schema-snapshot.sh` ahora filtra esas líneas y se regeneró `supabase/schema/baseline.sql` sin ellas.

## [13.743.10] - 2026-08-25
### CI: anotaciones limpias en suites RLS
- Los artifacts `rls-suite-logs-*` ahora incluyen explícitamente el directorio oculto `.rls-logs`; su ausencia pasa a ser un error real en vez de cinco advertencias engañosas.
- Las migraciones ancladas conocidas siguen documentadas y exentas, pero se registran como salida normal del job en vez de generar `warning`/`notice` permanentes.
- La ausencia de `supabase/schema/baseline.sql` ahora falla de forma explícita; se incorpora la baseline normalizada generada con PostgreSQL 15.8.

## [13.743.9] - 2026-08-25
### CI: candado de notas de crédito ignoraba facturas en papelera
- `public.assert_nc_no_excede_saldo` ahora omite la validación cuando la factura padre está borrada (`deleted_at IS NOT NULL`): al devolver `saldo_factura_bruto = 0` para facturas en papelera, el candado abortaba con `LC_NC_EXCEDE_SALDO`. Corrige `test_rls_soft_delete_reportes`.
- Suite RLS completa verde en base limpia: 36 suites + `_ci_post_migrate` / `_ci_verify_rls` / `_ci_roles` / `service_role_only`.

## [13.743.8] - 2026-08-25

### CI: notas de crédito sobre facturas borradas fallaban con `LC_NC_SIN_TC`
- `public.saldo_factura_bruto` devolvía `NULL` cuando la factura estaba borrada o en estado no cobrable; el guard fail-closed de notas de crédito interpretaba ese `NULL` como "sin tipo de cambio" y abortaba. Ahora devuelve `0` en ese caso, igual que `public.saldo_factura`. Corrige la suite `test_rls_soft_delete_reportes`.
- `migration-manifest.json` regenerado (1084 migraciones).



## [13.743.7] - 2026-08-25
### CI: cierre del fix de saldo fantasma
- `public.saldo_factura_bruto` se reescribió en PL/pgSQL con el mismo candado multi-tenant de `public.saldo_factura` (devuelve 0 si quien consulta no pertenece a la organización de la factura y no es `super_admin`/`service_role`). Corrige el fallo del guard `rpc_org_scope_linter` sin ampliar la whitelist congelada.
- Espejo `supabase/schema/facturacion/saldo_factura.sql` sincronizado con la migración vigente (incluye `'Pagada'` entre los estados terminales) — `audit:replay-mirror` en verde.
- `migration-manifest.json` regenerado (1083 migraciones) y el guard Fase D actualizado a la nueva lista de estados sin saldo.



## [13.743.6] - 2026-08-25
### Saldo fantasma en facturas legacy marcadas como "Pagada"
- Regla única: una factura en estado terminal (`Pagada`, `Cancelada`, `Sustituida`, `Borrador`) reporta saldo 0 en frontend (`calcularSaldoFactura` + `esEstadoSinSaldo`) y en base (`saldo_factura`, `estado_cuenta_agregados`, `facturas_cartera_cliente`). Antes, 31 facturas migradas sin pagos capturados inflaban ~374,631 de adeudo en estado de cuenta y portal.
- Nueva `public.saldo_factura_bruto(uuid)` (total − pagos − NC aplicadas) usada por `tg_pago_factura_no_sobrepago`, para que el candado anti-sobrepago no impida capturar pagos históricos faltantes.
- `facturas_cartera_cliente` dejó de referenciar la columna inexistente `f.folio`.
- Backfill: pago histórico `AJUSTE-LEGACY` (sin REP, sin banco) por el total de cada factura `Pagada` sin pagos; 31 filas.
- Guard nuevo `supabase/tests/cxc_guard_pagada_sin_saldo.sql` (en el manifiesto) congela la invariante: ninguna factura viva `Pagada` con saldo bruto > 0.01.

## [13.743.5] - 2026-08-25
### CI: siete guards conductuales apuntaban a un esquema ya evolucionado
- Expedientes de fixture (`ELCM00001`, `ELCC00001`, `ELIMP0NC01`) violaban `embarques_expediente_formato_valido` (`EL` + 3 letras + dígitos): ahora usan folios válidos.
- `ola4_n24_n27`: `provision_organization` exige `auth.uid()` con `super_admin`, y `user_roles` se sincroniza con la membresía, así que un miembro no puede portarlo. El caso ahora usa un super admin de plataforma sin membresía como caller.
- `ola4_n31_n36_n37`: `facturas` ya no tiene `folio`/`tipo_cambio_usd` (usa `numero`/`tipo_cambio`, TC > 0) y `proformas` exige `cliente_id`, `cliente_nombre`, `expediente` con `estado_proforma IN ('pendiente','facturada')`.
- `ola4_n41_n44_n45`: rol legacy `admin` bloqueado (`admin_org`), `estado_proveedor_factura` sin `Aprobada` (`Vigente`), `facturas.organization_id` obligatorio y `cartera_pendiente()` expone `factura_id`, no `id`.
- `ola4_n48_n52_n53`: `cotizaciones` exige `organization_id` y `reactivar_cotizacion_rpc` requiere `conceptos_venta` con importes (`LC_COTIZACION_SIN_IMPORTES`).
- `nc_cliente_transicion_uuid_fiscal`: el canon vigente es `Borrador → Timbrada`; se retiró el paso legado por `Aprobada`.
- `validar_cierre_cxp_conversion_moneda`: el CASO 2 dejaba un pago sin TC, hoy imposible por `LC_PAGO_TC_REQUERIDO`; ahora congela ese bloqueo de base.

## [13.743.4] - 2026-08-25
### CI: tres guards conductuales congelaban expectativas obsoletas
- `fix_b4_nc_reduce_comision`: el CASO 3 reutilizaba el embarque del CASO 1/2, así que el prorrateo repartía la utilidad entre tres facturas y la comisión plena daba 24.00 en vez de 40.00. Ahora el caso siembra su propio embarque (venta 1000 − costo 600) y mide sólo el tope por nota de crédito.
- `fix3_crm_propagar_cross_vendedor`: esperaba SQLSTATE 42501 en `LC_OPORTUNIDAD_AJENA`, pero esa migración de errcodes nunca existió: la RPC levanta los `LC_` sin errcode (P0001). El guard ahora congela el prefijo del mensaje, que es el contrato que traduce `lcCodeMessages`.
- `fix4_n2_portal_proforma_dual`: el CASO 5 exigía `usuario_id IS NULL` en bitácora, pero `portal_responder_por_token` escribe el usuario sentinel de sistema. Ahora acepta NULL o sentinel y verifica `usuario_email = 'cliente-portal-token'`.

## [13.743.3] - 2026-08-25
### Detalle de embarque: columnas internas se leen por la vista de staff
- `TabResumen` pedía `tarifa_delta_jsonb` a la fila de detalle, pero esa columna ya no es legible en `embarques` para `authenticated`. El valor llegaba siempre `undefined` y la sección "Origen de costos" no mostraba el snapshot cotizado vs vigente. Ahora usa el nuevo hook `useEmbarqueInterno` (vista `embarques_interno_v`).
- Mismo caso en `EmbarqueDetalleTabs`: `creadoPor` de la pestaña Notas leía `embarque.created_by_email` (siempre vacío) y ahora viene de la vista interna.

## [13.743.2] - 2026-08-25
### CI: contador de skips rompía 5 suites RLS
- `supabase/tests/rls/_helpers.sql` creaba el contador con `CREATE UNLOGGED TABLE pg_temp.skips_registrados`, sintaxis que Postgres rechaza («only temporary relations may be created in temporary schemas»). Las suites `isolation`, `org_scope`, `anon_deny_all`, `cross_tenant_mutations` y `super_admin_planos` abortaban al cargar el helper. Ahora usa `CREATE TEMP TABLE IF NOT EXISTS skips_registrados`.

## [13.743.1] - 2026-08-25
### CI: candado service_role-only sincronizado
- `supabase/tests/rls/_ci_service_role_only.sql` no incluía `public.handle_new_user_signup()`, que sí trae su `REVOKE` en migración. El candado bidireccional fallaba con "faltan en _ci_service_role_only.sql". Se añadió a la lista canónica.

## [13.743.0] - 2026-08-25
### Guards SQL: manifiesto, paralelización y suites huérfanas
- **Suites huérfanas detectadas (cobertura ficticia)**: 13 archivos `supabase/tests/*.sql` existían en el repo pero **ningún workflow los ejecutaba** (`ola4_n24_n27`, `validar_cierre_umbral_por_moneda`, `embarques_listado_sin_select_estrella`, etc.). Ahora corren en `supabase/tests/_guards_manifest_radar.txt` en modo aviso (`continue-on-error`) hasta estabilizarse.
- **Manifiesto + runner paralelo**: los ~50 pasos `run: $PSQL -f ...` del job `rls-guards` se reemplazaron por `supabase/tests/_guards_manifest.txt` + `scripts/ci/run-guards.sh`, que los ejecuta con concurrencia 4, resume verdes/rojos y sube los logs como artifact `rls-guards-logs`.
- **Guardrail anti-huérfanos**: `src/__tests__/architecture/guards-sql-en-manifiesto.test.ts` falla si una suite `.sql` no está en un manifiesto ni referenciada en un workflow, y valida que los manifiestos no tengan rutas duplicadas o inexistentes.
- **Contador de skips** en `supabase/tests/rls/_helpers.sql`: `pg_temp.skip(motivo)` + `pg_temp.assert_max_skips(n)` para que una suite no quede verde habiendo saltado sus aserciones.

## [13.742.0] - 2026-08-25
### Limpieza y optimización de la suite RLS
- **Catálogo único de columnas internas de `embarques`** (`supabase/tests/_catalogo_columnas_internas.sql`): la lista `cerrado_snapshot / tarifa_delta_jsonb / reabierto_motivo / created_by_email` estaba copiada en 3 archivos (`fix2_embarques_interno_y_nc.sql`, `embarques_listado_sin_select_estrella.sql`, `_ci_post_migrate.sql`). Si se añadía una columna sensible nueva, un archivo la auditaba y los otros quedaban ciegos. Ahora los tres la leen de `pg_temp.columnas_internas_embarques()`.
- **Catálogo único de tablas exentas** (`supabase/tests/rls/_ci_exempt_tables.sql`): las whitelists manuales de `_ci_verify_rls.sql` (categoría `sin-rls`) y `test_rls_policy_linter.sql` (`sin-filtro-tenant`) se unificaron con motivo obligatorio por entrada, eliminando el riesgo de drift entre linters.
- **Fixture compartido** `pg_temp.seed_org_pair('PREFIJO')` en `_helpers.sql`: siembra 2 organizaciones + 1 admin cada una (con `auth.users` best-effort). Las suites nuevas dejan de reimplementar el seed a mano.
- **README de `supabase/tests/rls`** actualizado: tabla de catálogos únicos, uso del fixture y aclaración de que el inventario vivo de suites es `matrix.include[].suites` del workflow (no una lista manual que se desincroniza).

## [13.741.1] - 2026-08-25
### Limpieza de la suite de pruebas (hallazgos restantes)
- **Tests "acta de nacimiento" eliminados** (tautológicos: sólo comprobaban que existiera una migración histórica e inmutable): `rep-guard-hotfix-migration.test.ts`, `revincular-backfill-solo-1a1.test.ts`, `consolidar-proformas-repunta-conceptos.test.ts`.
- **Ratchets de estructura consolidados**: los 4 archivos de olas cerradas (`fase3-4-reubicaciones`, `fase4-naming-camelcase`, `facturacion-fusion`, `admin-configuracion-cycle`) se fusionaron en un único `src/__tests__/architecture/estructura-legacy-ratchet.test.ts` con una sola lista de paths/imports prohibidos. No se pierde ninguna aserción (incluye las 4 cards de `orgDetalle`, el ciclo admin ↔ configuracion y las query keys unificadas de facturación).
- **Nombres por comportamiento, no por ticket**: `useNuevaFacturaProveedorForm.{dup,fe06,emision}` → `{duplicados,validacionesMontos,validacionesFecha}`; `vsReal.faseJ` → `vsReal.derivados`; `roleHierarchy.extra` → `roleHierarchy.bordes`; `useMutationWithFeedback.{migration-ola1,migration-ola1-batch2}` → `{notificaciones,consumidores}`.
- **Docstring desalineado**: `facturapi-multi-tenant.test.ts` decía "las 4 edge functions" cuando valida 6.
- Verificado: 66 archivos / 417 tests afectados en verde.

## [13.741.0] - 2026-08-25

### Limpieza de la suite de pruebas (auditoría de tests)
- **Guardrail con falso positivo (crítico)**: `eliminar-embarque-bloqueado-fiscal.test.ts` concatenaba TODAS las definiciones históricas de `eliminar_embarque_completo` encontradas en `supabase/migrations`, así que pasaba aunque la versión vigente hubiera perdido una guarda (bastaba con que una migración vieja la tuviera). Ahora extrae sólo la ÚLTIMA definición, respetando la etiqueta de dollar-quoting (`$$` vs `$function$` — el extractor anterior se derramaba hacia funciones vecinas), y los `GRANT` se buscan aparte porque sobreviven al `CREATE OR REPLACE`. Aserciones realineadas con la versión vigente (CxP se cuenta por `deleted_at IS NULL`; el `UPDATE public.cotizaciones` es multilínea).
- **Canary de PDF duplicado**: eliminado `src/pdf/render/__tests__/pdfRenderLeak.test.tsx` — medía exactamente lo mismo que `src/test/canaries/pdfLeak.test.tsx` (200 render+unmount, umbral 50 MB) y gastaba ~9 s de CI. Se conserva el canary con `cleanup()` en `finally`.
- **Test tautológico**: eliminado `src/lib/__tests__/proformas-huerfanas-baseline.test.ts` — sólo verificaba que existiera una migración histórica e inmutable (imposible de romper).
- **Helper huérfano**: eliminado `src/test/helpers/assertOrgScoped.ts` (nunca importado desde su creación).
- Verificado: `audit:tests` y suite completa en verde.

## [13.740.0] - 2026-08-25
### FIX4 — frontend CRM + provisión E2E
- **CRM · alta express de actividad (bug real)**: `QuickCreateActividadPopover` hacía `new Date(fecha).toISOString()` sin validar; al limpiar el `DateTimePickerMx` el valor llega como `""` → *Invalid Date* → `RangeError: Invalid time value`. Ahora fecha vacía se envía como `null` (igual que `NuevaActividadDialog`) y una fecha no parseable muestra "Selecciona una fecha válida".
- **CRM · convertir lead (bug real)**: `useConvertirLead` no invalidaba `crm.oportunidades.all` ni `crm.dashboardAll`, así que la oportunidad recién creada no aparecía en el kanban/dashboard hasta vencer el `staleTime` (`refetchOnWindowFocus` desactivado).
- **P3 · `e2e-provision-multi-tenant`**: el secreto se comparaba con `!==` (no timing-safe) y el payload aceptaba CUALQUIER nombre de org, así que con el secreto filtrado el cleanup borraba (o el provisioning contaminaba) una org real homónima con `service_role`. Nueva allowlist estricta `orgNameAllowlist.ts` (prefijos `E2E …`/`TEST …` con separador; sobreescribible con `E2E_PROVISION_ORG_ALLOWLIST`), doble verificación payload + nombre persistido antes de borrar, `timingSafeEqual` y respuestas sin detalle interno (`400 org_name_not_allowed`).
- Pruebas nuevas: `src/__tests__/security/e2eProvisionOrgAllowlist.test.ts` y `src/features/crm/hooks/__tests__/useConvertirLead.test.tsx`.

## [13.739.3] - 2026-08-25
### FIX4 — tanda 4 de base de datos (N-1, N-2, N-2b + 3xP3)
- **N-1 · papelera vs 'En operación' (bug real)**: mandar a la papelera un embarque cuya cotización ligada estaba 'En operación' abortaba con `LC_COT_TRANSICION_INVALIDA`. `sync_cotizacion_embarque_link` levanta la GUC transaccional `app.liberando_papelera` (patrón `app.bypass_cierre`) y `guard_estado_cotizacion` admite ÚNICAMENTE 'En operación'→'Aceptada' con la GUC puesta.
- **N-2 · portal proforma 500 en link activo (bug real)**: `portal_obtener_proforma_por_token` referenciaba `moneda/subtotal/iva/total`, columnas inexistentes tras la multimoneda (`*_mxn/_usd`) → 42703 en todo link vigente. La RPC devuelve ambos juegos duales + claves legacy derivadas; espejo `supabase/schema/portal/`, `portalPublico.ts` y `PortalProformaResumen.tsx` sincronizados. BL-11 intacto.
- **N-2b · responder desde el portal daba 500**: `bitacora_actividad.usuario_id` era NOT NULL y el actor anónimo inserta NULL → 23502. La columna queda nullable (`usuario_email` sigue siendo la pista de auditoría).
- **P3 · health-check.sql**: sección de snapshots alineada a `total_hallazgos/total_pendientes/criticos/score`.
- **P3 · harness CI service_role-only**: lista canónica `supabase/tests/rls/_ci_service_role_only.sql` consumida por `_ci_post_migrate.sql` y por el candado bidireccional `_ci_check_service_role_only.sql`; re-cierre explícito de `venta_embarque_mxn_neta`; whitelist del linter org-scope de 49 a 42 entradas.
- **P3 · carrera signup**: `handle_new_user_signup` serializa el bootstrap super_admin con `pg_advisory_xact_lock`.
- Split de `appFeedback.ts` en `appFeedback.notices.ts` (Power of 10, 200 líneas) y ACLs explícitas H6 en `avanzar_estado_embarque`, `handle_new_user_signup` y 5 trigger functions service_role-only.
- Pruebas nuevas en CI: `fix4_n1_papelera_cotizacion_en_operacion`, `fix4_n2_portal_proforma_dual`, `fix4_service_role_only_grants`, `fix4_signup_bootstrap_lock`.

## [13.739.2] - 2026-08-25
### CI — `test_sat_semanal_rotacion_lote`
- El CASO 3 estacionaba las orgs preexistentes con un bucle de "drenado" que las mezclaba en el mismo lote que las orgs de prueba (y `now()` está congelado dentro de la transacción, así que el desempate caía en `created_at` y devolvía siempre el mismo lote). Ahora la prueba estaciona las orgs con RFC en `2999-01-01` antes de insertar las tres de prueba, dejando el orden determinista. La RPC `seleccionar_lote_sat_semanal` no cambia.

## [13.739.1] - 2026-08-24
### CI — `rpc_org_scope_linter`
- **`audit:replay-mirror`**: se re-emite `public.avanzar_estado_embarque` como migración nueva (`20260901000100`) para que la migración vigente incluya el marcador `replay: true` del espejo.
- **Lint (complejidad)**: se extraen los estados vacíos de proformas (`proformasEmpty.tsx` / `proformasEmptyCopy.ts`) y la emisión del toast de error (`emitirToastError` en `appFeedback.ts`).
- Se re-cierran en `_ci_post_migrate.sql` las funciones de plataforma `cron_try_lock`, `cron_unlock` y `email_send_log_touch` (sólo `service_role`), que el GRANT masivo del Postgres bare de CI reabría a `authenticated`. En producción ya estaban revocadas.

## [13.739.0] - 2026-08-24
### FIX-R3 — Superficie pública del portal (parche `fix3-portal-tokens`)
- **RLS de eventos/notas**: las policies `Cliente read own eventos`, `Cliente read own notas` y `Agente read own notas` replican ahora el predicado del RPC público (`get_tracking_public`): sólo hitos de negocio / `cambio_estado`, sin marcas `[interno]/harness/e2e/seed/qa-` y sin borrados lógicos. Antes, por API directa con el JWT del portal, cliente y agente podían leer eventos internos y notas de texto libre del staff.
- **`portal_responder_por_token`**: se corrige un fallo real (insertaba `usuario_id = NULL` en `bitacora_actividad`, columna `NOT NULL` → toda respuesta del cliente reventaba tras actualizar la proforma). Además `SELECT ... FOR UPDATE` + `UPDATE` compare-and-set sobre `estado_cliente = 'pendiente'` cierran el TOCTOU (doble liberación de conceptos / doble notificación) y el motivo de rechazo se acota a 1000 caracteres.
- **`portal_solicitar_cotizacion`**: rate limit 10/hora por (cliente, usuario) y topes de longitud (origen/destino 200, descripción/notas 2000). Grants sin cambio (nunca fue `anon`).
- **Grants**: `handle_new_user_signup` deja de ser ejecutable por `anon`/`authenticated` (es función trigger; corre como owner).
- **Ligas de tracking**: "Compartir" reutiliza la liga vigente y las nuevas nacen con 30 días de vigencia (antes cada clic creaba un token eterno; las 12 ligas existentes no tenían `expires_at`). Nueva acción "Revocar liga de tracking" con registro en bitácora.
- **Observabilidad**: `scrubPathTokens` en `piiScrub` y `scrubUrl`/`logClientError` ya no persisten tokens de path (`/tracking/<token>`, `/portal/proformas/<uuid>`) en `app_logs` ni Sentry.
- Tests SQL `fix3_portal_rls_eventos_notas.sql` y `fix3_portal_rpcs.sql` cableados en el workflow de RLS.

## [13.738.1] - 2026-08-24
### FIX-R3-02 — CI: `_ci_verify_rls.sql` fallaba por `cron_locks`
- **Causa**: `public.cron_locks` (mutex de crons, v13.737.0) quedó con RLS habilitada y CERO policies. El verificador de cobertura RLS exige al menos una policy declarada, porque un deny implícito hace que los tests de aislamiento pasen trivialmente con `count = 0`.
- **Fix**: policy explícita `USING (false) WITH CHECK (false)` para `anon`/`authenticated` + `REVOKE ALL`. Los crons corren con `service_role`, que hace bypass de RLS, así que no hay cambio de comportamiento.
- Manifiesto sincronizado (1067 migraciones) y verificador local en verde.

## [13.738.0] - 2026-09-01
### FIX-R3 — Pulido de frontend (parche `fix3-frontend-pulido`)
- **Parseo de dinero unificado**: `parseMonto` ahora aplica la misma heurística que `MoneyInput` (`"1.500"` sin coma = 1,500) y acepta `{ puntoDeMiles: false }` para valores que no son dinero (cantidades, tipos de cambio). Antes el mismo texto pegado valía 1000× menos según el campo.
- **Idempotencia honesta**: `public.avanzar_estado_embarque` marca la respuesta cacheada con `replay: true`; el frontend ya no escribe bitácora ni pinta un avance que la BD no ejecutó, y reintenta con `requestId` nuevo. Los `requestId` de auto-sync caducan a los 30 min.
- **Toasts sin colisión**: el id de error se deriva del contexto (`method`) en vez de un `VALIDATION_FAILED` compartido por todas las mutations; se elimina el doble toast al rechazar documentos.
- **Sesión limpia**: `signOut` purga borradores del wizard y caché persistida de queries.
- **Copy es-MX**: "Profit" → "Utilidad" en breadcrumbs, tarjetas de cliente, proyección y PDF de rentabilidad.
- Espejo `supabase/schema/embarques/avanzar_estado_embarque.sql` sincronizado con la migración `20260901000100`.

## [13.737.1] - 2026-08-24
### Hotfix R3-01 — `/embarques` devolvía 42501 "permission denied for table embarques"
- **Causa**: `public.embarques_listado` es SECURITY INVOKER y su cuerpo hacía `SELECT e.* FROM embarques e`. El endurecimiento FIX2 B-1 (`20260824033552`) revocó el `SELECT` a nivel tabla en `public.embarques` y lo re-otorgó columna por columna (74/78, excluyendo las 4 internas), así que `e.*` dejó de estar permitido y el listado se caía para todo el staff.
- **Fix**: la función ahora nombra columnas explícitas en el CTE `filtered`; se conservan firma, filtros, orden, paginación y permisos, y las 4 columnas internas siguen cerradas a `authenticated`/`anon`.
- **Regresión**: `supabase/tests/embarques_listado_sin_select_estrella.sql` (4 casos: sin `e.*`, sin SELECT de tabla, columnas internas cerradas, sigue SECURITY INVOKER).

## [13.737.0] - 2026-08-24
### R3 — Endurecimiento de Edge Functions (auditoría `fix3-edge-hardening`)
- **email_send_log ya no se atora en `pending`** (P2): nueva RPC `email_send_log_touch` (upsert por `message_id`, sólo `service_role`) + columna `intentos`. `send-transactional-email` y `process-email-queue/*` usan `registrarEstadoEmail` en lugar de un segundo INSERT que reventaba el índice único `uq_email_send_log_message_id` con 23505 silencioso. Limpieza única de las 18 filas zombie (>24 h) a `failed`.
- **Barrido SAT** (P2): `patchVerificacionSat` sólo mueve `uuid_verificado` con veredicto definitivo (`Vigente`/`Cancelado`/`No Encontrado`); los transitorios (`Error`, `No verificable`) ya no borran sellos buenos cuando el SAT se cae.
- **Mutex de crons** (P3): tabla `cron_locks` + `cron_try_lock`/`cron_unlock` (lease con TTL) y helper `_shared/cronLock.ts`; aplicado a `rep-retry-nocturno`, `verificar-sat-semanal` y `facturapi-reconciliar-cancelaciones`.
- **`rep-retry-nocturno`** (P3): las alertas se insertan fila a fila tolerando 23505; antes un choque tumbaba el lote completo.
- **CRON_SECRET** (P3): `timingSafeEqual` en `tc-dof-diario`, `auditoria-snapshot-daily`, `auditoria-weekly-digest` y `rep-retry-nocturno`.
- **`exchange-rates`** (P3): rate limit para el endpoint público y caché histórico con tope FIFO (antes crecía sin límite iterando `?fecha=`).
- **`notificar-respuesta-cotizacion`** (P3): dedupe por (cotización, estado) 10 min + tope por usuario vía `check_ratelimit`; evitaba el reenvío en bucle a todos los operadores.
- **`sentry-tunnel`** (P3): tope de 1 MB en el envelope leído (endpoint público).
- **PII** (P3): `_shared/redact.ts` (`maskEmail`) en los logs de las edges de correo.
- **Descartado del parche**: el bloque `resolveOrgScope`/`scopePorOrganizacion` en `facturapi-*` (los lookups ya corren con el JWT del usuario y RLS filtra por org; el cambio arriesgaba a los usuarios del portal). También se omitió el `deno.lock` propuesto.


## [13.736.3] - 2026-08-24
- CI (FIX2 B-1): `_ci_post_migrate.sql` vuelve a cerrar las columnas internas de `public.embarques` (`cerrado_snapshot`, `tarifa_delta_jsonb`, `reabierto_motivo`, `created_by_email`) tras el `GRANT SELECT ON ALL TABLES` del Postgres bare de CI, que reinstalaba el privilegio a nivel tabla y hacía fallar `fix2_embarques_interno_y_nc.sql`.


## [13.736.2] - 2026-08-24
### CI verde tras FIX3
- **Mensajes LC_***: se añaden `LC_PAGO_FECHA_PREVIA_EMISION` (tesorería) y `LC_COTIZACION_OTRA_ORG` (CRM) al catálogo de mensajes amigables.
- **Replay de espejos**: nueva migración `20260831000100_fix3_m6_espejo_adjuntar_xml_verificado.sql` re-emite `adjuntar_xml_entrante_verificado` con la GUC `app.entrante_xml_verificado`; sin ella, la migración posterior (20260826004000) reintroducía la versión sin sello en un replay limpio. Manifiesto de migraciones sincronizado (1063).
- **Power of 10 / ESLint**: `subirFacturaEntrante` baja de complejidad 19 a límite (helpers `subirArchivosDelBuzon` / `insertarFilaEntrante`) y los helpers del alta se mueven a `facturasEntrantesUploadAlta.ts` (archivos ≤200 líneas).

## [13.736.1] - 2026-08-24
- CI (RLS · rpc_org_scope_linter): `seleccionar_lote_sat_semanal(integer)` se vuelve a cerrar a `service_role` en `_ci_post_migrate.sql`; el GRANT masivo del Postgres bare de CI la exponía a `authenticated` y disparaba el linter.

## [13.736.0] - 2026-08-24
### FIX3 — consistencia y seguridad de base de datos (8 hallazgos validados)
- **M-4 · fecha del cobro**: `assert_factura_viva_para_pago()` valida fecha futura también en `UPDATE` (antes sólo `INSERT`), `fecha_pago` sale de la lista "sólo metadatos" y se añade `LC_PAGO_FECHA_PREVIA_EMISION` (paridad con el lote CxC). La función pasa a `SECURITY DEFINER`.
- **Ronda 2 P2 · privacidad cross-tenant**: `venta_embarque_mxn_neta`, `nc_aplicadas_en_moneda_factura` y `comision_embarques_de_factura` pierden `EXECUTE` para `authenticated` (eran oráculos de lectura sin filtro de organización); sólo `service_role` y llamadas internas `DEFINER`.
- **Ronda 2 drift · portal público**: `portal_obtener_proforma_por_token` recupera `check_ratelimit` (30/min por IP+identidad) y vuelve a `VOLATILE`.
- **Ronda 2 P3 · vínculo cotización↔embarque**: `sync_cotizacion_embarque_link` rechaza cotizaciones de otra organización (`LC_COTIZACION_OTRA_ORG`) y el update de papelera se acota a la org del embarque.
- **Ronda 2 P3 · comisiones y NC**: `trg_nc_cliente_recalcular_comisiones` escucha `deleted_at` y la salida de `Aplicada`; si la comisión ya se liquidó se registra el ajuste pendiente.
- **M-5 / O1.14 · trazabilidad**: columna y trigger `updated_at` en `conceptos_venta`, `conceptos_costo`, `conceptos_factura`, `contactos_cliente`, `documentos_embarque`, `eventos_embarque`, `notas_embarque`, `proforma_conceptos_consolidados`, `proveedor_facturas_conceptos` y `crm_notificaciones`.
- **M-1 · CRM**: `crm_propagar_conversion_cliente` propaga `ERRCODE 42501` en los rechazos de permiso.
- **M-6 / BUG-18 · buzón CxP**: nueva bandera `metadatos_verificados` sellada sólo por `adjuntar_xml_entrante_verificado` (GUC transaccional + trigger `trg_entrante_meta_no_verificada`); el alta inicial ahora también re-verifica el XML en servidor vía la edge y avisa al usuario si no cuadra.
- Split de `appFeedback.ts` en `appFeedback.notices.ts` (Power of 10, 200 líneas) y ACLs explícitas H6 en `avanzar_estado_embarque`, `handle_new_user_signup` y 5 trigger functions service_role-only.
- Pruebas nuevas en CI: 8 archivos `supabase/tests/fix3_*.sql` en el workflow de RLS.




## [13.735.2] - 2026-08-24
### Seguridad — vista con SECURITY DEFINER (linter 0010)
- `public.embarques_interno_v` pasa a `security_invoker = true`: ya no se evalúa con los privilegios de su creador. Las columnas internas (`cerrado_snapshot`, `tarifa_delta_jsonb`, `reabierto_motivo`, `created_by_email`) se leen por la nueva función acotada `public.embarques_internos_src()` (`SECURITY DEFINER`, `search_path` fijo, `EXECUTE` sólo para `authenticated`/`service_role`), que reaplica los mismos candados: membresía de organización y exclusión de los roles de portal `cliente` y `agente_carga`. `anon` sigue sin acceso. `supabase/tests/fix2_embarques_interno_y_nc.sql`: 5/5 casos OK.



## [13.735.1] - 2026-08-24
### Corrección de CI — `deno check` de Edge Functions
- `user-management/reinvitacion.ts`: se retira el `@ts-expect-error` del import de tipo remoto de `@supabase/supabase-js` (TS2578 "Unused '@ts-expect-error' directive"); Deno ya resuelve el tipo sin supresión.



## [13.735.0] - 2026-08-24
### Remediación completa de la auditoría visual del ERP — `docs/auditoria/visual-2026-08-24-erp.md`
- **E-1 (crítico)**: los KPI de Tesorería ya no truncan dinero con elipsis: notación compacta (`MXN 943.4 K`) con el valor exacto en tooltip.
- **E-2 / E-15**: la tarjeta "Arribos este mes" apila a 1 columna en móvil (ya no se corta "Ya llegaron") y el stepper de estados expone el nombre completo con `Hint`.
- **E-3**: scroll horizontal con degradado de borde y colchón derecho en `DataTable`, Kanban de CRM y "Flujo esperado 30 días por moneda".
- **E-4 / E-16**: gráfica de flujo proyectado responsiva en 375 px; chip "TC DOF" con contraste AA (`text-primary` sobre `bg-primary/10`).
- **E-5 / E-6 / E-11 / E-14**: sub-tabs de CRM con scroll y sin encimar "Nuevo"; columnas Kanban vacías acotadas y con `EmptyStateInline` + CTA; textos truncados (tarjetas Kanban, "Top 5 deudores") con tooltip.
- **E-7 / E-12 / E-13**: encabezado móvil sin banda vacía; el contador de embarques dice "Cargando embarques…" mientras la consulta no resuelve (ya no se contradice con el skeleton).
- **E-8 / E-9 / E-10 / E-17**: variantes únicas de `Tabs` (`seccion` y `vista`) documentadas en `docs/design-system.md`; criterio único de botón deshabilitado; anillo de foco visible (`ring-ring` sin opacidad) en botones.



## [13.734.0] - 2026-08-24
### Remediación de la auditoría visual (P1–P4) — `docs/auditoria/visual-2026-08-24.md`
- **P1**: se retira el emoji de bandera (renderizaba "tofu" en Windows/Chrome) del hero, footer y guías de marketing; bullet del hero alineado a la primera línea; `min-h-screen` → `min-h-dvh` en los 20 shells de página.
- **P2**: `CierreDialogs`, `DialogSustituirFactura`, `NavieraQuickCreate` y `CancelarAnticipoDialog` migrados a `FormDialogShell`; `dialogSize` fijo en `UsuariosInternosDialogs`, `AdjuntoRow.dialogs` y `PnlTcAlinearDialog`; `text-xs` → token tipográfico en `carteraColumns` y `clienteColumns`.
- **P3**: nuevo skeleton único de carga de ruta usado por `ProtectedRoute`, `AgenteProtectedRoute` y `PortalProtectedRoute`; skeletons en lugar de spinners en tablas/formularios; `EmptyStateInline`/`ErrorStateInline` con "Reintentar" en CxC Aging, Comisiones, TabPnl, TabNotas, bandejas, Tesorería y Compras.
- **P4**: 50 botones icon-only garantizan 44 px táctiles en móvil conservando densidad en desktop; `aria-label` completado en `SidebarTrigger`; mejor contraste del tab activo/inactivo.


## [13.733.0] - 2026-08-24
### Correcciones — revisión de errores en Sentry
- **JAVASCRIPT-REACT-1G (bug real, bloqueante)**: el botón "Ver demo" fallaba con HTTP 500 (`permission denied for function seed_demo_organization_guarded`, 42501). Causa raíz confirmada en logs de Postgres: `demo-access` hacía `signInWithPassword` **sobre el cliente admin** para verificar la contraseña demo; supabase-js guarda esa sesión en memoria (aun con `persistSession: false`) y a partir de ahí manda el token del usuario demo, así que las RPC siguientes corrían como `authenticated` en vez de `service_role`. Ahora la verificación usa un cliente efímero con la llave pública y `signOut` inmediato; el cliente admin conserva la credencial de servicio.
- **JAVASCRIPT-REACT-5J (no era bug)**: `Password is known to be weak…` es la validación de contraseñas de la plataforma avisando al usuario. Se filtra en `appFeedback.sentry.ts` (`isWeakPasswordNotice`) y en `IGNORE_ERRORS`.
- **JAVASCRIPT-REACT-5F (no era bug)**: `Failed to execute 'insertBefore' on 'Node'` proviene de extensiones/traductores que mutan el DOM bajo React. Agregado a `IGNORE_ERRORS`.

## [13.732.0] - 2026-08-24
### Correcciones — validación del parche `fix2-db.diff`
- **B-1 (bug real, crítico · fuga de PnL al portal)**: RLS filtra *filas*, no *columnas*: un usuario del portal con acceso a su embarque podía leer `cerrado_snapshot`, `tarifa_delta_jsonb`, `reabierto_motivo` y `created_by_email`. Ahora el `SELECT` sobre `public.embarques` se otorga **columna por columna** (el `REVOKE` por columna no basta si existe un grant de tabla) excluyendo esas cuatro. El staff las consulta por la vista `public.embarques_interno_v` (valida membresía y excluye roles `cliente`/`agente_carga`), y `get_embarque_full` fusiona esos datos con lista explícita de columnas. Frontend: nuevo servicio `internoEmbarque.ts`, usado por `tarifaInfo.ts` y `reconciliacion3Columnas.ts`.
- **B-2 (bloqueante)**: la máquina de estados de notas de crédito no admitía `Borrador → Timbrada`, así que timbrar desde la app fallaba. Canon unificado BD + frontend: `Borrador → {Timbrada, Cancelada}`, `Timbrada → {Aplicada, Cancelada}`, `Aplicada → {Cancelada}` (`Aprobada` queda sólo como estado legado de salida).
- **B-3 (drift de permisos)**: `public.puede_escribir_cotizaciones` ahora es espejo exacto de la matriz `SALES`: se agrega `admin_org` (el dueño de la organización no podía cotizar) y se retira `operador`.
- Prueba nueva: `supabase/tests/fix2_embarques_interno_y_nc.sql` (5 casos, cableada en CI).


## [13.731.0] - 2026-08-24
### Correcciones — validación del parche `fix2-misc.diff`
- **B-1 (bug real, UI obsoleta)**: el árbol de caché *singular* `['embarque', id, ...]` no lo cubre el prefijo *plural* `['embarques']`. `useSetSinComisionEmbarque` ahora invalida la key exacta `embarques.sinComision(id)` (el Select de la regla de comisión volvía al valor viejo tras guardar); las mutaciones de documentos invalidan `adminPendientes(id)` (badge de pendientes administrativos) y `useUpdateEmbarque` invalida `pnlFinanciero(id)`. Documentado en `src/features/embarques/queryKeys.ts`.
- **B-2 (bug real, riesgo de doble pago)**: los hooks de pago a proveedor (individual, lote, editar, eliminar) no invalidaban `bandejas.all`, así que la bandeja "CxP por pagar" y su badge seguían listando la factura ya pagada. Se agrega la invalidación (y `proveedores.all` en el pago en lote, por paridad con el individual).
- **B-3 (bug real, latente)**: `verificar-sat-semanal` seleccionaba organizaciones con `ORDER BY created_at ASC LIMIT 5` sin rotación: las orgs 6+ nunca se verificaban y un CFDI de proveedor cancelado ante el SAT no generaba aviso. Nueva columna `organizations.sat_barrido_fecha` y RPC `public.seleccionar_lote_sat_semanal(integer)` (SECURITY DEFINER, sólo `service_role`) que ordena por `sat_barrido_fecha ASC NULLS FIRST` y estampa la fecha atómicamente. `MAX_FACTURAS` baja a 50 y `POR_ORG = MAX_FACTURAS / MAX_ORGS` para que cada org del lote reciba cupo (antes 60/20: las 3 primeras lo agotaban).
- **M-1 (mejora)**: nuevo helper `invalidarTrasTimbrado` (espejo de `invalidarTrasRep`) usado al timbrar/cancelar factura y nota de crédito: refresca bandejas "Por timbrar"/"Por enviar", sus conteos y la cartera/aging CxC, que quedaban mostrando como cobrable un CFDI cancelado o con NC aplicada.
- **N-1 (no aplica)**: el parche re-agendaba el job `verificar_sat_semanal`; se verificó que ya está agendado (lunes 14:00 UTC), así que no se tocó el cron.
- Pruebas nuevas: `src/features/embarques/hooks/__tests__/useSinComisionEmbarque.test.tsx` y `supabase/tests/test_sat_semanal_rotacion_lote.sql` (cableada en CI).

## [13.730.0] - 2026-08-23
### Seguridad — validación del parche `fix2-edge-seguridad.diff` (Edge Functions)
- **B-1 (crítico, bug real)**: `invite_client` / `invite_agente` re-vinculaban cualquier cuenta existente con el correo indicado: en modo `password` reasignaban la contraseña y en ambos modos forzaban `user_roles.role` a `cliente`/`agente_carga`. Un admin de organización podía tomar cuentas de staff u otro tenant (incluido `super_admin`). Nuevo candado `supabase/functions/user-management/reinvitacion.ts`: sólo se re-invita una cuenta de portal cuyos vínculos pertenezcan a la organización objetivo; en otro caso 409 `LC_CUENTA_NO_REINVITABLE` (con mensaje amigable en el catálogo `LC_*`).
- **B-2 (crítico, bug real)**: `backfill-cxp-buzon` autorizaba con rol GLOBAL (`contador`, `admin_org`) y barría `embarque_facturas_entrantes` de TODAS las organizaciones con la service role key, copiando archivos de storage y sembrando conceptos cross-tenant. Ahora exige rol de captura CxP **dentro** de la organización objetivo (`ROLES_CAPTURA_CXP`, espejo de `COMPRAS_POR_CAPTURAR_ROLES`), filtra el barrido por `organization_id` y revalida la org de cada factura.
- **B-3 (riesgo, real)**: `parse-invoice-pdf` sólo validaba el JWT: cualquier sesión (portal cliente, agente, cuenta demo) podía quemar cuota de Gemini con PDFs de 10 MB. Nuevo `parse-invoice-pdf/guardas.ts`: membresía + rol de captura CxP, rate limit fail-CLOSED por usuario (20/h) y por organización (100/h) vía `check_ratelimit`, y corte temprano por `Content-Length`.
- **B-4 (riesgo, real)**: `facturapi-enviar-email` aceptaba un destinatario libre para roles de sólo consulta fiscal. El destinatario manual ajeno al cliente (y al dominio del emisor) ahora exige rol con responsabilidad de envío (`ROLES_ENVIO_A_TERCEROS`), reutilizando la allowlist de contactos del cliente.
- **B-5 (divulgación, real)**: `enviar-factura-email` devolvía en el cuerpo HTTP los enlaces firmados del PDF/XML con TTL de 30 días. Ya no se devuelven (ninguna vista los consumía) y el TTL baja a 7 días.
- **B-6 (latente, real)**: `checkAdminAccess` equiparaba el rol global legacy `admin` con `super_admin` y le daba `isGlobalAdmin` (alta/baja de usuarios en cualquier organización). Ahora sólo `super_admin` es admin de plataforma; el `admin` legacy conserva permisos donde tenga membresía admin/admin_org, igual que `authorizeOrgRole`.

## [13.729.0] - 2026-08-23
### Seguridad — validación del parche `fix-b6-roles.diff`
- **FIX B-6 (bug real)**: el piloto de la Ola 8 autorizaba los 3 movimientos de dinero (`registrar_pago_proveedor_lote`, `registrar_pago_cliente_lote`, `eliminar_pago_proveedor`) con `has_any_role_in_org`, que expande `roles_jerarquia`; como `roles_jerarquia('contador')` incluye `auxiliar_contable`, ese rol ganó acceso a pagar/cobrar en lote y a eliminar pagos sin estar en las listas previas al piloto. Nuevo helper `has_any_role_in_org_exact` (sin expansión, conserva el bypass `super_admin`) y re-emisión de los 3 cuerpos con la lista literal previa; se mantiene el scoping por organización. Impacto vivo verificado: 0 membresías `auxiliar_contable`, nadie pierde acceso.
- **Espejo de replay**: `20260830000100_fix_b6_espejo_pilotos_listas_explicitas.sql`, posterior a `20260827080020`, para que una base limpia no reintroduzca la versión con jerarquía. Espejos canónicos actualizados en `supabase/schema/{cxp,facturacion,tesoreria}/`.
- **Pruebas**: `supabase/tests/ola8_has_role_in_org.sql` (helpers + conducta del piloto CxC) y el linter `supabase/tests/rls/test_rls_rpc_org_scope_linter.sql`, cableados en `rls-tests.yml`.
- **Verificación pre-deploy**: `scripts/db/predeploy_b6_roles_legacy.sql` + riesgo RN-5 en `docs/riesgos-aceptados.md`. Consultado en vivo: la única fila es el `super_admin` de plataforma, que conserva bypass, así que H2 no bloquea a nadie.
- **Descartado del parche**: su bloque de CHANGELOG con versión 13.719.0 (ya consumida) y el timestamp de migración `20260827090060`, sustituido por el espejo posterior.

## [13.728.0] - 2026-08-23
### Comisiones — validación del parche `fix-b2-comisiones.diff`
- **Ajustes de nota de crédito sobre comisiones ya liquidadas**: el reproceso nocturno (`_reprocesar_comisiones_org`) ya no cierra en silencio las entradas `ajuste_nc_liquidada`; quedan abiertas y visibles para descontarlas manualmente en la siguiente liquidación.
- **Espejos canónicos nuevos**: `supabase/schema/comisiones/calcular_comision_pago.sql`, `generar_liquidacion_comision.sql` y `_reprocesar_comisiones_org.sql`, para que `audit:replay-mirror` detecte futuras regresiones de replay en las funciones que ya se rompieron dos veces por orden de migraciones.
- **Pruebas de comportamiento**: `supabase/tests/fix_b4_nc_reduce_comision.sql` (5 casos, incluye el reproceso) y `fix_b5_periodo_cdmx.sql`, cableadas en `rls-tests.yml`.
- **Descartado del parche**: B-2 (consolidadas), B-4 (NC baja la comisión), B-5 (periodo CDMX), el cableado de CI de Fase B/B2 y los `REVOKE` de `_ci_post_migrate.sql` ya estaban corregidos (v13.725.0–v13.726.1) y el espejo vigente `20260828000200` es posterior a las migraciones que los pisaban; aplicar el parche los habría re-emitido con timestamp anterior.



## [13.727.0] - 2026-08-23
### Seguridad y notificaciones
- **rechazar_documento_embarque**: cuando el embarque no tiene `created_by`, el rechazo ahora notifica a los administradores (`admin`/`admin_org`) de la organización en lugar de no avisar a nadie.
- **revertir_proforma_al_cancelar_sustitucion**: además de membresía, exige rol financiero por organización (`has_any_role_in_org`: admin, admin_org, contador, tesorero) → nuevo código `LC_ROL_INSUFICIENTE` con mensaje amigable.
- Migración espejo `20260829000100` para que el replay en base limpia no pise ambos fixes.
- Regresión: `supabase/tests/rev1_org_less_y_rechazo_doc.sql` suma CASO 4 (fallback de notificación) y CASO 5 (rol financiero).
- Del parche `fix-b1-seguridad.diff` se descartó lo ya corregido (B-1, B-1b, B-3, candado de `Validado`) y el cambio de `MIN_MOTIVO` a 5, que habría desalineado el front con la RPC (mínimo real: 10).



## [13.726.2] - 2026-08-22
### Fix CI
- **chore(marketing)**: `useDemoAccessForm.ts` se movió de `components/demoAccess/` a `features/marketing/hooks/` para cumplir el guardrail de arquitectura (hooks fuera de `components/`).


## [13.726.1] - 2026-08-22
### Fix CI
- **CASO 4 de `ola2_faseb2_regresion.sql`**: el `GRANT EXECUTE ON ALL FUNCTIONS` que CI aplica al rol `authenticated` pisaba los `REVOKE` de las migraciones. `_ci_post_migrate.sql` vuelve a cerrar las funciones de plataforma (`_reprocesar_comisiones_org`, `reprocesar_comisiones_job`, `verificar_sat_semanal_job`, `notificar_uuid_cancelado_sat`) a `anon`/`authenticated`, dejando sólo `service_role`. En base viva ya estaban cerradas: era infidelidad del entorno de CI, no un permiso abierto en producción.

## [13.726.0] - 2026-08-22
### Remediación informe 2026-08-22 — Entregas 3 y 4
- **Replay limpio (B-1, B-2, B-3, B-5)**: migraciones espejo `20260828000100/200/300` re-emiten los fixes de las Entregas 1, 2 y 4 con timestamp posterior a los espejos `20260826*`/`20260827*`, que en base limpia volvían a pisar `is_org_member`, `calcular_comision_pago`, `generar_liquidacion_comision` y `rechazar_documento_embarque`.
- **CI (B-3, comisiones)**: `rls-tests.yml` ahora corre `ola2_faseb_regresion.sql`, `ola2_faseb2_regresion.sql` y `rev1_org_less_y_rechazo_doc.sql`; el caso de `pg_cron` se omite (en vez de fallar) cuando el rol de prueba no puede leer `cron.job`.
- **B-6**: verificado en base viva que no existen usuarios con rol financiero (`contador`, `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza`, `admin_org`, `admin`) sin membresía de organización: 0 filas, el endurecimiento de `is_org_member` no bloquea a nadie en operación.
- **M-1 · CRM**: `crm_propagar_conversion_cliente` sólo la ejecuta el vendedor dueño de la oportunidad o un rol gerencial, y ya no pisa una conversión previa hacia otro cliente (`LC_OPORTUNIDAD_AJENA`, `LC_OPORTUNIDAD_YA_CONVERTIDA`).
- **M-2**: en esa misma RPC el permiso se valida antes de la existencia del registro (sin oráculo de existencia).
- Mensajes amigables nuevos: `LC_DOC_VALIDADO`, `LC_DOC_YA_RECHAZADO`, `LC_OPORTUNIDAD_AJENA`, `LC_OPORTUNIDAD_YA_CONVERTIDA`.


## [13.724.1] - 2026-08-21
### CI verde
- `DemoAccessDialog` dividido en `demoAccess/useDemoAccessForm.ts` + `demoAccess/DemoAccessFields.tsx` (Power of 10: archivos ≤200 líneas).
- Prueba de exportación CSV del CRM alineada al formato real `DD/MM/YYYY` y a fecha mediodía UTC (evita corrimiento de zona).

## [13.724.0] - 2026-08-21
### Remediación auditoría visual — Entrega 6 (V-09)
- Encabezado de página homologado: `WizardShell` (Nuevo/Editar embarque y Nueva/Editar cotización) usa `PageHeader` en lugar de su propio `<h1>`; misma escala `text-display` y separación del subtítulo que listados y fichas.
- Auditoría de las 16 páginas de detalle: todas ya usan el canónico `DetailHeader` (directo o vía su componente de header); no había títulos ad-hoc.
- El sidebar de progreso del paso 1 de cotización pasa a `h2` (se elimina el salto `h1 → h3`).
- Nuevo guardrail `src/__tests__/architecture/page-header-canonical.test.ts`: ninguna pantalla interna puede definir su propio `<h1>` (sólo `PageHeader`/`DetailHeader`; login, legal, portal y marketing quedan en allowlist).

## [13.723.0] - 2026-08-21
### Remediación auditoría visual — Entrega 5 (V-04, V-08)
- Sidebar colapsado accesible: cada enlace de navegación lleva `aria-label` con su título, eliminando los 48 controles sin nombre accesible detectados en tableta (768 px), tanto en el sidebar principal como en el de administración.
- Botones de ícono de "Editar plan" (Admin · Planes) y "Guardar porcentaje" (Comisiones) ahora anuncian su acción.
- V-08 cerrado: las tres tablas señaladas (`TabVsReal`, `TabCaptura`, `EstadoResultadosTable`) ya usan `Table`/`DetailTableRow` del sistema con la excepción documentada al guardrail `no-raw-table`; no quedan `<table>` crudos en features.

## [13.722.0] - 2026-08-21
### Remediación auditoría visual — Entrega 4 (V-06, V-11, V-12)
- Dashboard sin scrolls anidados: "Próximos arribos", "Alertas de demora" y los widgets de operación muestran los primeros 5 registros con enlace "Ver N más en embarques" (`DashboardListaVerMas`) en lugar de `max-h` + `overflow-y-auto`.
- Densidad homologada: las celdas de las tablas del dashboard heredan `text-body` (14 px) como el resto de la app; `text-body-sm` queda reservado al modo compacto.
- Íconos de columnas de tabla normalizados a `size-3.5` (antes convivían 12 y 14 px).

## [13.721.0] - 2026-08-21
### Remediación auditoría visual — Entrega 3 (V-07, V-10)
- `CardTitle` acepta `as` y usa `h2` por defecto: se elimina el salto de jerarquía `h1 → h3` en `/inicio`, `/compras` y `/tesoreria`.
- El encabezado "Flujo semanal (MXN)" de Tesorería pasa a `h2` (nivel correcto bajo el `h1` de la página).
- `DemoAccessDialog` migrado a `FormDialogShell` + `FormDialogSection` + `FormDialogFooter`: mismo padding, secciones y footer sticky que los otros 96 modales.



## [13.720.0] - 2026-08-21
### Remediación auditoría visual — Entrega 2 (V-04, V-05, V-13, V-14)
- Áreas táctiles: acciones de fila (`actionsColumn`), paginación, contactos de cliente, hallazgos de auditoría y el trigger/ítems del sidebar colapsado suben a 36 px (40 px en móvil).
- V-04 revalidado: el barrido de `size="icon"` no encontró botones sin `aria-label`/`sr-only`; los 48 casos del reporte eran falsos positivos del heurístico (el sidebar colapsado conserva la etiqueta en el DOM). Sólo quedaba el tamaño táctil, ya corregido.
- `h-screen` → `h-dvh` en los estados de carga de la ruta raíz (recorte por barra del navegador en móvil).
- Estilo inline estático del hero de la landing movido a la utilidad `.bg-grid-hero`.

## [13.719.0] - 2026-08-21
### Remediación auditoría visual (V-01, V-02, V-03)
- `cn()` declara la escala tipográfica propia como grupo `font-size` en `tailwind-merge`: `text-body*`/`text-label`/`text-display` ya no borran el color de la variante (texto invisible 1.24:1 en el chip de filtros de CxP y ~19 badges más).
- `/crm/pipeline` redirige a `/crm/oportunidades` en lugar de mostrar 404.
- Tokens `--destructive`, `--state-arribo`, `--state-eir`, `--state-aduana`, `--state-operacion` y `--kpi-*` oscurecidos en modo claro para cumplir WCAG AA como color de texto en badges/KPIs.

## [13.718.1] - 2026-08-27

### Correcciones de CI
- `crmCsvExport` usa el formateador canónico `formatFechaDia` en lugar de `toLocaleDateString` (UI-04).
- Mensajes amigables para `LC_OPORTUNIDAD_NO_ENCONTRADA`, `LC_PARAMETROS_INVALIDOS` y `LC_SIN_PERMISO`.
- Higiene de tests: aserción específica y título único en `propagarConversion.test.ts`.

## [13.718.0] - 2026-08-27
### Ola 8 — "Estructural y escala" (Entrega 1)
- **Roles por organización**: nuevos helpers `has_role_in_org` / `has_any_role_in_org`; los pagos en lote a proveedor, cobros en lote a cliente y la eliminación de pagos a proveedor ahora exigen el rol financiero en la organización del documento, no de forma global.
- **Kanban CRM paginado**: 50 tarjetas por etapa con botón "Mostrar más" para evitar bloqueos de UI en pipelines grandes.
- **Analítica CRM**: nuevas gráficas de embudo (`CrmEmbudoChart`) y forecast mensual (`CrmForecastMensualChart`) con tokens del design system.
- **Tolerancia unificada**: `cobroLoteValidaciones` importa `TOLERANCIA_SOBREPAGO` del núcleo financiero en lugar de duplicar el valor.

## [13.717.0] - 2026-08-21
### Ola 7 — "Vendedor productivo" (Entrega 1)
- **O7.7 · Conversión transaccional**: la propagación lead→cliente usa la RPC `crm_propagar_conversion_cliente`, así que oportunidad y cliente quedan sincronizados o no cambia nada.
- **O7.4 · Auto-registro de actividad**: al usar una plantilla de email/WhatsApp se crea la actividad en el CRM con seguimiento a 2 días, para que el contacto cuente en métricas.
- **O7.8 · Leaderboard etiquetado**: cuando sólo se ve la propia fila, el título dice "Tu desempeño del mes".
- **O7.6 · Exportar CSV**: botón de exportación en Leads y Oportunidades (respeta filtros y permisos).

## [13.716.2] - 2026-08-21

### Correcciones
- **CI (mensajes LC)**: se agregó el mensaje amigable de `LC_DOC_INEXISTENTE` en `lcCodeMessages.operativo.genericos.ts`; la prueba de cobertura de códigos `LC_*` ya pasa.

## [13.716.1] - 2026-08-21
### Correcciones
- **CI (RLS)**: la prueba `test_rls_ola6_ventas_arranca.sql` sembraba un usuario con el rol legacy `viewer`, que la base ya bloquea (`LC_ROL_LEGACY_BLOQUEADO`). Ahora usa `customer_service` como rol sin permisos de ventas.

## [13.716.0] - 2026-08-21
### Ola 6 — "Ventas arranca" (CRM Fase 1)
- **Bolsa común de prospectos (O6.1)**: los vendedores ya ven los leads de su organización sin vendedor asignado y pueden tomarlos con el botón "Tomar lead". La asignación va por la RPC `crm_tomar_lead` (SECURITY DEFINER, `FOR UPDATE`), así que dos vendedores no pueden tomar el mismo: el segundo recibe `LC_LEAD_YA_ASIGNADO`. La privacidad de leads propios queda intacta.
- **Captura única al convertir (O6.2)**: `convertir_lead_rpc` ahora propaga `rfc`, `direccion`, `ciudad`, `entidad_federativa` y `cp` del lead al cliente nuevo, y la oportunidad hereda `sector`, `origen` y `destino` (columna `sector` agregada a `crm_oportunidades`). Antes el cliente nacía con esos campos vacíos y había recaptura manual.
- **Configuración del CRM (O6.3)**: `/crm/configuracion` queda gateada con `CRM_CONFIGURACION_ROLES` (admins del tenant + `gerente_comercial`) y la policy de `crm_etapas_pipeline` se alineó al mismo set, cerrando el caso "veo la pantalla pero el guardado falla".
- **Tests**: `supabase/tests/ola6_convertir_propaga.sql` y `supabase/tests/rls/test_rls_ola6_ventas_arranca.sql` (grupo `operaciones` del workflow de RLS).

## [13.715.0] - 2026-08-21
### Ola 5 — Entrega 2: verificación fiscal del XML en el servidor (O5.8)
- **Adjuntar XML al buzón CxP**: el navegador ya no decide los datos fiscales. La nueva Edge Function `adjuntar-xml-entrante` descarga el XML real del bucket, valida su hash SHA-256, lo vuelve a parsear (CFDI 4.0, sin DOM) y guarda **sus** valores de UUID, RFC emisor, folio, fecha, total y moneda. Si lo capturado no coincide con el archivo, se rechaza con `LC_XML_METADATA_MISMATCH`.
- **Base de datos**: nueva RPC `adjuntar_xml_entrante_verificado` (sólo `service_role`, valida membresía y rol del actor) y se revocó `adjuntar_xml_factura_entrante` para `authenticated`, cerrando la vía que permitía declarar metadatos falsos.
- **Refactor**: el parser CFDI se movió a `supabase/functions/_shared/cfdiParser.ts` para poder reutilizarlo entre funciones.


## [13.714.0] - 2026-08-21
### Ola 5 — Entrega 1: rechazo de documentos y consultas por lotes
- **Rechazar documento del embarque (O5.3)**: nuevo botón "Rechazar" en el tab Documentos. Pide un motivo (mín. 10 caracteres), quita el archivo adjunto, deja el documento en estado `Rechazado` (vuelve a contar como faltante), guarda el motivo en las notas y envía una notificación interna a quien abrió el embarque. Todo en una sola RPC (`rechazar_documento_embarque`) con validación de organización y bitácora.
- **Consultas por lotes (O5.9)**: nuevo helper `chunkedIn` (lotes de 200 IDs) aplicado a la conciliación de costos y a las dependencias financieras del embarque, para que los filtros `.in(...)` no revienten la longitud de la petición ni degraden el plan de consulta en embarques con muchas facturas.

## [13.713.0] - 2026-08-21
### Ola 4 — Entrega 1: "El dinero avisa solo" (bajo riesgo)
- **Alta de cliente (pre-flight fiscal)**: la captura ahora exige forma de pago y método de pago por defecto (además de régimen y uso de CFDI), con valores sugeridos `99` y `PPD`, para que el timbrado no se detenga después por datos fiscales faltantes.
- **Cotizaciones · bandeja "Aceptadas sin embarque"**: nuevo filtro con contador que muestra las cotizaciones aceptadas a las que nadie les abrió el embarque.

## [13.712.2] - 2026-08-21
### Corrección
- **fix(cxp)**: se extrajo el cuerpo del wizard de captura a `CapturaFacturaPasosBody` para bajar la complejidad del componente (lint) y se actualizó la prueba de `dialogTokens` para incluir el tamaño `5xl`.

## [13.712.1] - 2026-08-21
### Corrección
- El wizard de captura de factura de proveedor ahora abre siempre en el paso 1 ("Documento y conceptos"), también cuando se abre desde el buzón CxP: antes saltaba al paso 2 asumiendo que el documento ya estaba revisado.

## [13.712.0] - 2026-08-21
### Captura de factura de proveedor — wizard de 3 pasos
- El modal se reorganizó en pasos: 1) documento y conceptos, 2) datos de la factura (proveedor, folio, fechas, importes, T/C, categoría, notas) y 3) vinculación al embarque con resumen previo al guardado.
- Cada paso usa todo el ancho (`5xl`): la tabla de conceptos del CFDI ya no se corta ni requiere scroll horizontal y las descripciones se muestran hasta en 3 líneas.
- Footer contextual: Atrás/Continuar en los primeros pasos, Guardar factura sólo en el último, y los pendientes de otros pasos son enlaces que saltan al paso que los resuelve.
- Desde el buzón CxP el modal abre directo en el paso 2 porque el documento ya viene precargado.
- Errores de campo en una sola línea con el detalle en tooltip accesible, en vez de párrafos rojos que desplazaban el formulario.

## [13.711.1] - 2026-08-21
### Corrección
- Captura de facturas por IA (PDF): se refresca la sesión antes de llamar a `parse-invoice-pdf` y se reintenta ante 401, eliminando el error "Token inválido" cuando el token había expirado.
- `_shared/auth.ts`: la verificación remota del JWT es la fuente de verdad y `getClaims` queda como respaldo.

## [13.711.0] - 2026-08-21
### Ola 3 — Un solo equipo de diseño
- Tipografía, encabezados y diálogos unificados con los tokens del sistema (sentence case, escala semántica) en portales, auth, legal y módulos operativos.
- Mensajes de validación centralizados en `COPY_VALIDACION` (español mexicano, con punto final) para auth, cotizaciones y CxP.
- Botones con estado de carga vía la prop `loading`; se retiraron los spinners manuales.
- Listados densos de Facturación, CxP y Tesorería migrados a `ResponsiveDataTable` con tarjeta móvil y `MoneyCell`.
- Paleta cerrada de etapas del CRM, casing único de nombres de cliente/proveedor y "Profit" ahora se muestra como "Utilidad".
- Nuevos candados de CI: KPI sin tamaños literales, avisos sin markup crudo, fechas sin `date-fns/format` en features y spinners fuera de `Button`.


## [13.710.1] - 2026-08-21
### CI — cobertura Sentry para edge function `verificar-sat-semanal`
- Se agregó `supabase/functions/verificar-sat-semanal/index.ts` al listado `CRITICAL` de `sentry-edge-wrapping.test.ts`, ya que la función usa `wrapEdgeHandler` y el test de cobertura de arquitectura la exige.

## [13.710.0] - 2026-08-21
### Ola 2 · Fase B2 — las comisiones se recalculan solas y el SAT se revisa cada semana
- **Reproceso diario (O2.11.1):** una tarea de plataforma corre todas las noches (00:20 CDMX), recorre las organizaciones con comisiones en la cola de recálculo y las reintenta sin necesidad de que alguien entre a la app. Es idempotente y nunca toca comisiones ya liquidadas.
- **Verificación SAT semanal (O2.11.2):** los lunes a las 08:00 CDMX se barre el estatus de los CFDI de proveedores nacionales. Si el SAT reporta uno cancelado, llega aviso interno a administración, contabilidad y tesorería (un aviso por factura cada 30 días). La verificación no cambia estados ni importes de la factura.
- **Diferencia cambiaria en cobranza (O2.7):** se retira formalmente; queda documentada como RN-4 en `docs/riesgos-aceptados.md`.
- El barrido SAT quedó en un módulo compartido (`_shared/satBarrido.ts`) que usan la corrida manual y la semanal, con trabajo acotado por corrida.
- Nueva prueba de regresión `supabase/tests/ola2_faseb2_regresion.sql`.

## [13.709.1] - 2026-08-21
### CI — artifact de logs RLS ya no avisa "No files were found"
- La carpeta `.rls-logs/` y un manifiesto (grupo, suites, run) se siembran antes de descargar y restaurar la base, así que el artifact de cada grupo siempre sube algo aunque la restauración falle antes de correr las suites.
- Nota: el aviso de `supabase/schema/baseline.sql` y las dos advertencias de la migración anclada en `drift-anclas.txt` son intencionales (la baseline se siembra con el artifact `schema-snapshot-actual`; la migración anclada tiene su estado final garantizado por la reaplicación posterior).


## [13.709.0] - 2026-08-21
### Ola 2 · Fase B — comisiones que sí bajan y candados que no se saltan
- **Notas de crédito (O2.3):** al aplicar una nota de crédito de cliente, la comisión de esa factura se recalcula automáticamente. Si ya estaba liquidada, no se toca el histórico: queda el ajuste anotado para descontarlo en la siguiente liquidación.
- **Facturas consolidadas (O2.4):** la comisión ya resuelve los embarques por su vínculo activo, suma utilidad y venta de todos, y si no puede resolverlo lo manda a la cola de recálculo en vez de guardar comisión en cero en silencio.
- **Papelera de embarques (O2.10):** enviar un embarque a la papelera libera la cotización vinculada y la regresa a "Aceptada".
- **Auto-sync de estado (O2.8):** el cambio automático de estado por fechas ya viaja por la RPC oficial, hereda el candado de documentos y usa una llave estable por transición (no duplica notas ni eventos). Los rechazos esperados del candado ya no muestran error al usuario.
- Nueva prueba de regresión `supabase/tests/ola2_faseb_regresion.sql`.


## [13.708.4] - 2026-08-21
### Corrección de CI — prueba de comisiones: falso positivo del caso 2
- La prueba buscaba la palabra `definitiva` en todo el texto de `validar_cierre_embarque`, y fallaba por un comentario y por la etiqueta `no_definitivas`. Ahora detecta sólo el uso real de la bandera como filtro.



## [13.708.3] - 2026-08-21
### Corrección de CI — permisos de comisiones, espejo de cierre y dos pruebas
- `comisiones_sobre_devengadas()` ya declara sus permisos explícitos (H6).
- El espejo canónico de `validar_cierre_embarque` se sincronizó con la regla de cierre de la Ola 2.
- La prueba de captura manual del TC DOF simula al super admin; el guardrail de proformas ahora ancla en la definición de la función, no en sus permisos.

## [13.708.2] - 2026-08-21
### Corrección de CI — prueba de sobrepago con centavos válidos
- La prueba `ola1_candados_regresion.sql` usaba un cobro de 3 decimales, prohibido por la base (escala 2). Ahora prueba la frontera real: saldo exacto pasa, un centavo extra se rechaza con `LC_PAGO_SOBREPAGO`.

## [13.708.1] - 2026-08-21

### Corrección de CI — migraciones ancladas en el snapshot RLS
- El job que reconstruye la base limpia ahora respeta `drift-anclas.txt`, igual que el radar de drift: las migraciones que parchan por texto ya no rompen CI cuando su estado final está garantizado por una reaplicación posterior.

## [13.708.0] - 2026-08-26

### Ola 2 — Comisiones cierran y cierran bien
- La comisión de un embarque con varias facturas ya no se duplica: el reparto se calcula contra la venta neta del embarque (menos notas de crédito) y nunca puede pasar del 100%.
- Cerrar un embarque ahora se bloquea sólo por pendientes reales de comisión (notas por resolver o recálculos en cola), no por una bandera que nadie podía apagar.
- Registrar un anticipo a proveedor es idempotente: un doble clic o un reintento ya no crea dos anticipos ni dos cargos en el banco.
- Liquidaciones de comisión con estado (Generada / Pagada / Cancelada): pagar dos veces se rechaza con mensaje claro y se puede cancelar una liquidación no pagada, devolviendo sus comisiones a devengadas.
- Nuevo reporte de auditoría de comisiones sobre-devengadas y pruebas de regresión en CI.

## [13.707.4] - 2026-08-26
### Corrección de CI — espejo de las funciones de lote
- Se volvieron a emitir, tal cual, las funciones de cobro y pago en lote para que una base nueva quede idéntica a producción (notas de crédito convertidas a la moneda de la factura y bloqueos en orden fijo).
- Manifiesto de migraciones sincronizado (1028).

## [13.707.3] - 2026-08-21
### Corrección de CI — radar de drift
- Se reaplicaron los candados de cobro/pago en lote que migraciones posteriores habían dejado fuera en una base recién creada (notas de crédito en moneda de la factura y bloqueos en orden fijo para evitar trabas simultáneas).
- El radar de migraciones ahora reconoce las migraciones antiguas que "parchan por texto" mediante `supabase/tests/rls/drift-anclas.txt`, en lugar de fallar el build.

## [13.707.2] - 2026-08-21
### Ola 1 — Remate final
- Un solo nombre para el diálogo de borrado con doble confirmación (se retiró el alias duplicado).
- Los encabezados de tabla ya no se parten en dos renglones (p. ej. "Vence en" en Facturación).
- La tarjeta "Aplicado a facturas" en Anticipos deja de pintarse en verde cuando el valor es cero.
- Pruebas de regresión ampliadas: tolerancia de medio centavo en cobros y catálogo de códigos LC_*.
- Nuevo reporte de sólo lectura de restricciones históricas sin validar (`scripts/db/report-not-valid-constraints.sql`).

## [13.707.1] - 2026-08-26
### Ola 1 — Cierre
- Avanzar, reabrir o cancelar un embarque usa una llave estable por intento: si la red falla y vuelves a intentar, no se duplica la transición ni la bitácora.
- Nueva prueba automática de regresión para los candados de cobro con fecha futura y de captura del tipo de cambio DOF.
- Títulos de pestaña en Nueva cotización, Proformas, Comisiones y Dashboard ejecutivo.
- Se retiró un nombre técnico de tabla visible en Conciliación de compras.
- Documentados los riesgos aceptados de límites de archivos y restricciones históricas sin validar.

## [13.707.0] - 2026-08-26
### Ola 1 — Candados de horas
- Las notas de crédito en otra divisa ya no inflan ni desinflan el saldo: se convierten a la moneda de la factura antes de validar un cobro.
- Ya no se puede registrar un cobro con fecha futura (ensuciaba antigüedad de cartera y flujo).
- Los pagos programados llevan una llave por captura: un doble clic ya no genera dos cargos al banco.
- La captura manual del Tipo de Cambio DOF quedó reservada al super administrador (es un catálogo compartido por toda la plataforma) y queda registrada en bitácora.
- Cobros y pagos en lote toman los candados en orden fijo por factura, para evitar bloqueos cuando dos personas guardan al mismo tiempo.
- Las funciones de reversión de proformas, limpieza de cancelaciones y archivado de versiones ahora validan organización y rol.
- Mensajes claros para los nuevos avisos (fecha futura, tipo de cambio sin permiso, doble envío del mismo pago).



## [13.706.1] - 2026-08-20
### Actualización segura de dependencias
- Se actualizaron librerías a sus versiones de mantenimiento (iconos, rutas, PDF, teléfonos, CSV, virtualización de tablas y parámetros de URL) sin cambios de comportamiento visibles.
- No se tocaron versiones mayores restringidas por la plataforma (React, Vite, Tailwind, TypeScript, router 7).

## [13.706.0] - 2026-08-25
### Ola C — Sellar lo visual
- Los componentes compartidos (badges, tarjetas de indicadores, celdas de dinero) ya usan la misma escala de letra que el resto del sistema: antes un badge y su celda vecina se veían con tamaños distintos.
- El Estado de Resultados usa el mismo semáforo de margen que reportes y cotizaciones, en lugar de un color propio.
- Se documentó la regla de color `primary` vs `accent` en el design system y en la guía de contribución.
- Los candados automáticos (tipografía, tablas compartidas, fechas) ahora detectan también los casos escritos en varias líneas y no permiten crecer sin justificación.

## [13.705.0] - 2026-08-25
### Ola B — Las comisiones y la cobranza ya no fallan en silencio
- Cuando faltaban datos (tipo de cambio o costos del embarque), la comisión se guardaba en cero y nadie se enteraba. Ahora queda en una fila de pendientes visible en Comisiones, con un botón "Reintentar recálculo".
- El listado de Cobranza ahora se filtra en la base de datos: antes se traían 2,000 facturas y se filtraba en pantalla, así que con cartera grande el listado no cuadraba con los indicadores.
- Sumar importes en una divisa no soportada (por ejemplo libras) ahora se detiene con un aviso claro, en vez de sumarlos como si ya fueran dólares.

## [13.704.0] - 2026-08-25
### Ola A — El doble clic ya no duplica traspasos entre cuentas
- Registrar un traspaso entre cuentas propias era la única operación de dinero sin protección contra duplicados: si el usuario daba doble clic o se cortaba la red y reintentaba, quedaban dos traspasos iguales.
- Ahora cada intento lleva un folio interno de control; si llega dos veces, el sistema reconoce el traspaso ya guardado, avisa "Este traspaso ya fue registrado" y no crea otro.
- Se agregó una prueba automática que impide volver a abrir este hueco.

## [13.703.1] - 2026-08-20
### Correcciones de integración continua
- Se movió el cálculo de antigüedad al módulo del dashboard financiero (único consumidor) para cumplir la regla de arquitectura.
- Se dividió el diálogo de sustitución de CFDI para respetar el límite de 200 líneas por archivo.
- Se eliminó un archivo de constantes sin uso y se actualizó la prueba de la tarjeta de KPI al tooltip accesible.

## [13.703.0] - 2026-08-20
### KPIs unificados — Un solo criterio de "vencido" y de antigüedad
- "Cartera vencida" se calculaba de cuatro maneras distintas (Cobranza, Estado de cuenta, Tesorería y Bandejas). Ahora todas las pantallas usan el mismo criterio, así que el mismo grupo de facturas da el mismo número en todas.
- El dashboard financiero dejó de usar su propia escala de antigüedad (0-15 días) y adoptó la oficial (1-30 / 31-60 / 61-90 / +90), la misma de Cobranza y Reportes.
- Los saldos en dólares se convierten a pesos con el método autorizado: si falta el tipo de cambio, el saldo no se suma en silencio, se reporta como pendiente de tipo de cambio.
- Corregido: la tarjeta "Por vencer 7 d" de Cuentas por pagar sólo sumaba 5 días; ahora respeta los 7 días que anuncia.



## [13.702.0] - 2026-08-20
### Accesibilidad — Los "globitos" de ayuda ahora sí se ven
- Los 187 avisos que dependían del globito nativo del navegador (que no aparece en celular ni al navegar con teclado) se cambiaron por un tooltip propio, visible al pasar el mouse y al enfocar con Tab.
- Los botones de icono conservan su nombre para lectores de pantalla, y se quitaron los avisos que sólo repetían el texto ya visible en pantalla.
- Queda un candado de arquitectura: cualquier aviso nuevo debe usar el componente compartido `Hint`.



## [13.701.0] - 2026-08-20
### Ola 5 (5.2) — Se retiran las 26 tablas crudas
- Las 26 tablas que aún se dibujaban "a mano" (anticipos aplicados, conciliación de compras, plantillas de cotización, CRM, notas de crédito, conceptos de CFDI, contenedores, costos por proveedor, estado de cuenta, portal de proformas, leads demo, diagnóstico de salud y la guía de puertos) usan ahora las mismas piezas reutilizables del sistema: encabezados, filas, hover, densidad y pies de totales idénticos en toda la app.
- Se migraron además los fragmentos de fila sueltos (pagos a proveedor, cobro en lote, notas de crédito, saldos de bancos, presupuesto vs real y pagos programados) para que no quede ningún renglón con estilo propio.
- El candado de arquitectura queda en cero deuda: la única tabla HTML permitida es la primitiva base del sistema de diseño; cualquier tabla nueva debe usar los componentes compartidos.

## [13.700.0] - 2026-08-20
### Ola 5 (5.6) — Un solo criterio para el margen
- El porcentaje de margen se ve y se colorea igual en Reportes, Dashboard, Cotizaciones, Proyección y P&L de embarque (nuevo badge compartido con tres escalas: comercial, ventas y operativa).
- Márgenes sin venta asociada ya no se pintan en rojo: se muestran en gris porque no son una alarma.
- Se eliminó el helper de color duplicado y se agregó un candado que impide volver a decidir el color a mano.


## [13.699.0] - 2026-08-20
### Ola 4 (cierre) — Validación del wizard con schemas
- Cotizaciones: las reglas de cada paso del wizard (destinatario, ruta terrestre, flete LCL, costos y conceptos de venta) viven ahora en un solo lugar, con pruebas por paso. Los mensajes que ve el usuario no cambian.

### Ola 5 — Pulido fino y deuda congelada
- Candados de calidad con holgura documentada: un cambio pequeño ya no rompe la validación automática por 1 uso de deuda histórica.
- Formato de fecha antiguo marcado como obsoleto y congelado; el código nuevo usa el formato canónico dd/mm/aaaa.
- Listados: la búsqueda espera 300 ms antes de filtrar (menos parpadeo al teclear).
- Barras de filtro: anchos estandarizados en 4 medidas (antes cada pantalla elegía el suyo).
- Nuevo documento de riesgos aceptados (`docs/riesgos-aceptados.md`).

## [13.698.0] - 2026-08-20
### Ola 4 — Robustez de formularios
- Modales de captura: cerrar con ESC o clic fuera con datos capturados pide confirmación antes de descartar (cuentas bancarias y factura manual ya lo usan).
- Campos de dinero: el tope máximo se aplica al teclear (antes sólo al salir del campo) y avisa cuando ajusta el monto.
- Checklist de documentos: sólo acepta PDF, imágenes, XML y ofimática, con tope de 15 MB por archivo.
- Wizards: Enter dentro de un campo ya no salta al siguiente paso.
- Cotizaciones: el botón "Volver" del encabezado del wizard también pide confirmación si hay cambios sin guardar.
- Cuenta demo: ya no se reinicia la contraseña en cada acceso si sigue siendo la correcta.



## [13.697.0] - 2026-08-21
### Ola 3 — Lógica de negocio residual
- Comisiones: nuevas excepciones de porcentaje por cliente o por embarque; el cálculo aplica primero la del embarque, luego la del cliente y, si no hay, el porcentaje de la vendedora.
- Tipo de cambio: el servicio devuelve la fecha solicitada junto al tipo de cambio, para saber cuándo se sustituyó por el del día.
- Cobro en lote: el orden de aplicación usa la regla FIFO única del sistema.
- Facturas: si el recálculo de totales no encuentra la factura, ahora avisa con un error en vez de dejar ceros en silencio.
- Comisiones liquidadas: el resumen mensual avisa si la consulta se truncó en lugar de mostrar un total incompleto.
- Monedas desconocidas ya no se convierten a USD con factor 1: se reportan como no convertibles.

## [13.696.0] - 2026-08-20
### Ola 2.4 — Tipografía semántica homologada
- Portal, CRM, dashboards, CxP, cotizaciones, admin, auditoría, proformas, costeo y proveedores usan la escala semántica (`text-body`, `text-body-sm`, `text-label`): mismo tamaño para el mismo rol de texto en todas las pantallas.
- El candado de tipografía ahora cubre esos 11 módulos (los escalones crudos de Tailwind bajaron de 940 a 326 usos).
- Se dividió el catálogo de estados (`statusDomains.ts`) para respetar el límite de 200 líneas por archivo.

## [13.695.0] - 2026-08-20
### Ola 2 — Candados de consistencia visual
- Gráficas: Rentabilidad y los dos gráficos de Diagnóstico ahora usan el tooltip compartido; nuevo candado impide tooltips a mano.
- Badges: Carta garantía, estado de tarifa, marcador de tarifa y UUID SAT pasan por `StatusBadge` (sin colores sueltos).
- Portal: las 9 rutas comparten el mismo contenedor `PortalPageShell`, los botones de REP recuperan tamaño táctil y las etiquetas usan tipografía semántica.
- Tesorería: el aviso de pago sin conciliar usa el componente de alerta estándar.

## [13.694.2] - 2026-08-20
### CI verde otra vez
- Se agregó el mensaje amigable para el código `LC_NC_SIN_TC` (falta tipo de cambio al validar una nota de crédito contra el saldo de la factura).
- Se renombró un título de test duplicado en los candados de arquitectura para pasar la auditoría de higiene de pruebas.

## [13.694.1] - 2026-08-20
### Embarques — Botón flotante reactivado
- En móvil vuelve el botón flotante "+" en Embarques y ahora sí abre la acción correcta: alta directa si tienes permiso, o el flujo guiado desde cotización si no.
- Se retiró "Nuevo embarque" del menú "Más acciones" para dejar un único punto de entrada en móvil (el menú conserva Exportar CSV).

## [13.694.0] - 2026-08-20
### Ola G — Cierre de la auditoría visual
- Las flechitas de "ver detalle" en Historial de facturas y proformas ahora son legibles (antes casi transparentes) y se realzan al pasar el mouse.
- Etiquetas de KPI sin MAYÚSCULAS y con la escala tipográfica del sistema en Totales del periodo y tooltips de arribos.
- Mejor contraste en avisos ámbar sobre fondo suave (reconciliación de embarques y aviso de timbrado interrumpido), especialmente en modo oscuro.
- El listado de proformas usa el ancho amplio como el resto de listados densos: las tablas ya no "saltan" de ancho al cambiar de módulo.
- Puntos suspensivos tipográficos ("…") unificados en textos de interfaz y se retiró el botón flotante inactivo de Embarques.
- Nuevos candados de CI: prohibido "..." ASCII en textos de UI y tope al uso de `uppercase`.

## [13.693.0] - 2026-08-20
### UI-4 — Un solo guard de carga y error
- El portal ya no "pierde" su encabezado mientras carga: Mis Embarques, Mis Cotizaciones y el Dashboard del cliente pintan título y accesos desde el primer instante, y sólo el cuerpo muestra el esqueleto o el mensaje de reintento.
- Nuevo candado de arquitectura que impide volver al patrón anterior (devolver un esqueleto antes del encabezado), con excepciones justificadas para pantallas de detalle cuyo título depende del dato que se carga.
- Verificado ya resuelto en versiones previas: doble escritura de totales de factura (ahora sólo la base de datos calcula) y eliminación del ayudante de color de estado duplicado.



## [13.692.0] - 2026-08-20
### Ola I — Candados de CI e higiene
- Nuevo candado que congela el uso de la utilidad larga `h-4 w-4` en iconos: el código nuevo debe usar `size-4`, para que un cambio de escala se haga en un solo lugar.
- Nuevo candado que congela el uso de `toFixed` en componentes: los importes y porcentajes que ve el usuario deben salir de los formateadores es-MX (moneda, miles, decimales).
- Los demás candados de la ola ya existían y se verificaron: colores crudos y hex fuera de tokens, emojis decorativos, tipografía semántica, tablas nativas y estados vacíos.
- Pendiente manual (`AUDIT-M16`): `.env` sigue rastreado en git. Se resuelve con `git rm --cached .env` de tu parte; el archivo solo contiene llaves publicables, así que es higiene de repositorio, no fuga.



## [13.691.1] - 2026-08-20
### Cierre de la Ola G1 (verificación y blindaje)
- Verificado en la base: un embarque **Cerrado** ya no se puede cancelar de forma directa (hay que reabrirlo primero). Se agrega la prueba automática `embarque_cerrado_no_cancelable.sql` al CI para que la regla no se pierda.
- Verificado que los conceptos enviados a la papelera no se timbran: nueva prueba `conceptosSoftDelete_test.ts` que revisa el filtro en el timbrado de facturas y de complementos de pago (REP).
- Verificado que al eliminar un pago sí se libera el anticipo aplicado (sólo existen anticipos de proveedor, y ese flujo ya lo revierte).
- Revisado el listado de Cotizaciones: la columna **Cliente** muestra el nombre correctamente (hallazgo VR-2 descartado).



## [13.691.0] - 2026-08-19
### Dinero y seguridad (Ola G1)
- Las notas de crédito en una moneda distinta a la de la factura ya se convierten a la misma moneda antes de compararse contra el saldo pendiente: antes una nota en pesos sobre una factura en dólares (o al revés) se rechazaba de más o se aceptaba de más. Si no hay tipo de cambio disponible, la nota se rechaza con un aviso claro.
- Nueva prueba automática `cxc_guard_nc_multimoneda.sql` en CI.

### Pulido visual (Olas G2 y H)
- Portal de cliente, páginas de acceso y páginas legales ahora comparten un mismo marco visual (encabezado, ancho y espaciado).
- Tarjeta de arribos del tablero deja de desbordarse en pantallas angostas y anchas.
- Chip Tarifario/Transaccional en Cotizaciones usa el mismo estilo de etiqueta que Embarques.
- Fecha en el listado de Cotizaciones ahora se muestra como dd/mm/aaaa, igual que en el resto de la app.
- Botones de exportación de PDF unificados como "Exportar PDF" en Tesorería, CxP y Cotizaciones.
- La tabla de flujo por moneda en Tesorería ya no recorta la columna NETO.

## [13.690.2] - 2026-08-19
### Correcciones desde Sentry
- Los correos de autenticación (confirmación de cuenta y recuperación de contraseña) volvían un error 500 y no se enviaban: la regla de "no registrar dos veces el mismo correo" estaba definida de forma parcial y el registro fallaba. Ahora la regla es total y el envío se encola correctamente (Sentry JAVASCRIPT-REACT-5G).
- El aviso "por seguridad debes esperar unos segundos" al reenviar correos ya no se reporta como error a Sentry: sigue mostrándose al usuario, pero deja de ensuciar el tablero (Sentry JAVASCRIPT-REACT-5H).


## [13.690.1] - 2026-08-19
### Corrección de validación de esquema
- El inventario de validación del esquema esperaba nombres antiguos de tres reglas automáticas de pagos de factura; ya reconoce los nombres vigentes (se renombraron para asegurar que la conversión de moneda ocurra antes de las validaciones de saldo).


## [13.689.0] - 2026-08-19
### Ola E (cierre) — tipografía y badges de estado unificados
- Embarques, Facturación y Tesorería usan la escala tipográfica del sistema (`text-body` / `text-body-sm`) en lugar de los tamaños crudos de Tailwind, así el mismo tipo de texto se ve igual en todas las pantallas.
- Los badges de Tesorería (tipo de pago, conciliación bancaria y estado del complemento de pago) se pintan desde el registro central de estados; ya no llevan colores escritos a mano.
- Nuevo guardarraíl de arquitectura que impide volver a usar `text-sm` / `text-xs` en los módulos ya homologados.
- Corrección: el estado de resultados devengado excluye facturas borradas lógicamente.



## [13.688.0] - 2026-08-19
### Ola E — un solo lenguaje visual (porcentajes, moneda e iconos)
- Los porcentajes de toda la app se muestran igual (un decimal y espacio antes del `%`) usando un único formateador; antes cada pantalla lo escribía a mano.
- Los importes en el badge administrativo de embarques y en el eje de la gráfica de reportes usan el formateador de moneda oficial (miles y decimales en es-MX).
- Se retiraron los emojis y glifos decorativos (🎉 📦 ⚠ ✓ ✗) de la interfaz y se reemplazaron por iconos que sí heredan el color del tema.
- Los badges de rentabilidad usan las variantes semánticas del componente `Badge` en lugar de clases de color escritas a mano.
- Nuevo guardarraíl de arquitectura que impide reintroducir emojis o glifos decorativos en `src`.

## [13.687.0] - 2026-08-19
### Ola D — pulido visual de gráficas y alertas
- Todas las gráficas usan un mismo recuadro de información (tooltip) que respeta el tema claro/oscuro, alinea las cifras y las formatea en es-MX.
- El panel de alertas de embarques usa un fondo ámbar más suave y su contador se muestra como etiqueta de advertencia.

## [13.686.0] - 2026-08-19
### Ola C — robustez de captura y navegación
- El wizard de cotización avisa antes de salir o recargar cuando hay captura sin guardar.
- Al cambiar de organización (super admin) la app regresa al inicio, en vez de quedarse en el detalle de un registro que ya no pertenece al tenant activo.
- Las búsquedas de los listados esperan a que termines de teclear (350 ms) antes de consultar al servidor.
- Los campos de dinero aceptan un tope máximo opcional y lo recortan al salir del campo.

## [13.685.0] - 2026-08-19
### Cierre de Ola B — dinero y fechas residuales
- Los totales de facturas de proveedor se redondean a centavos al capturar y al editar, así que ya no aparecen descuadres de fracciones de centavo contra los pagos.
- Al guardar una factura de proveedor sin cambios reales ya no se pide re-aprobación: campos vacíos y nulos se consideran iguales.
- Al aplicar un anticipo en otra moneda, el sistema ya no afirma que la factura "queda cubierta" (el saldo mostrado es sólo estimado; la base convierte al tipo de cambio oficial).
- El reparto FIFO de pagos y cobros en lote usa un orden único y determinista (vencimiento, luego emisión, luego folio): dos facturas que vencen el mismo día ya no cambian de orden entre corridas.
- El Estado de Resultados calcula el modo de transporte de las notas de crédito con menos consultas a la base.

## [13.684.1] - 2026-08-19
### REP de factura en divisa pagada en pesos
- El complemento de pago ahora envía el tipo de cambio del documento relacionado en la convención del SAT (unidades de la moneda de la factura por una unidad de la moneda del pago). Antes se mandaba 17.06 en lugar de 0.0586 y el PAC rechazaba el REP con `exchange_rate_too_large`.
- Si falta el tipo de cambio en un pago cross-moneda, el aviso previo pide capturarlo en español en vez de dejar que el PAC responda un error técnico.


## [13.684.0] - 2026-08-19
### Pago en otra moneda: tipo de cambio y orden de validaciones
- El pago cross-moneda ahora guarda el tipo de cambio en **pesos por divisa** (17.06 MXN/USD), la misma convención que usa la base de datos; antes se enviaba la razón invertida (0.0586) y el importe aplicado quedaba inflado ~291 veces.
- La conversión del pago corre **antes** de los candados de sobrepago y del cálculo de retenciones (triggers reordenados), así que un pago en pesos de una factura en dólares ya no se rechaza ni deja datos inconsistentes.
- Se bloquean en la UI los cruces USD↔EUR (la base de datos no los convierte) con un mensaje claro.
- Reparado el pago de la factura **F1034**: quedó saldada correctamente.

## [13.683.1] - 2026-08-19
### Sentry (JAVASCRIPT-REACT-5D)
- Timbrado de REP: cuando el pago excede el saldo pendiente de la factura, el mensaje explica los montos y qué corregir en lugar de mostrar "validation_failed: Saldo anterior menor al importe pagado".
- Las validaciones `validation_failed` de las edge functions de timbrado se clasifican como esperadas y dejan de reportarse a Sentry.

## [13.683.0] - 2026-08-19
### Ola B · auditoría externa (BL-4, EC-6/7/8 y cierre de badges legacy)
- BL-4: los totales de factura se recalculan sólo en la base de datos (RPC `recalc_factura_totales`); el cliente ya no puede pisar el total correcto al editar conceptos en paralelo.
- EC-6: el borrador del wizard de cotización se guarda por organización activa, así que cambiar de tenant ya no ofrece restaurar datos de otra empresa.
- EC-7: el buscador de cotizaciones tolera folios y mercancías nulas sin crashear.
- EC-8: subir factura al buzón muestra error visible si falla la red o el storage.
- UI-3: eliminado el helper legacy `getEstadoColor`; los últimos tres headers/tarjetas de cotización usan `StatusBadge` y el guardarraíl queda en cero.

## [13.682.0] - 2026-08-19
### Ola B · auditoría externa (UI-2 · escala única de antigüedad)
- La antigüedad de cartera se pinta con una sola escala (`--aging-1..5`) desde `src/lib/aging/buckets.ts`: Cobranza, Tesorería, CxC/CxP y los dashboards ya no colorean la misma deuda de forma distinta.
- `agingTone.ts` ahora deriva de las cubetas canónicas (1-30 / 31-60 / 61-90 / +90) en vez de sus propios cortes de 15 días.
- Los chips de bandejas (`agingVencidoBucket`, `agingPorCobrarBucket`) y las barras de dashboard consumen `AGING_SOLID_CLASS` / `AGING_SOFT_CLASS` / `AGING_FILL_CLASS`.
- Nuevo guardarraíl `aging-escala-unica.test.ts`: falla el CI si un archivo fuera del catálogo escribe clases `*-aging-N` a mano.

## [13.681.0] - 2026-08-19
### Ola B · auditoría externa (coherencia visual)
- UI-1 · badges unificados: los estados de CFDI, proformas, leads y conciliación bancaria toman color y etiqueta del `statusRegistry` vía `StatusBadge`; ya no hay paletas escritas a mano por pantalla.
- UI-3 · iconografía: se retiraron los emojis (📋🚢⚓🛃🏁 y ⚠️) del stepper del portal y de los diálogos de eliminación; ahora se usan iconos Lucide con tokens semánticos.
- Nuevo guardarraíl `status-badge-domains.test.ts`: falla el CI si un archivo migrado vuelve a inventar clases de color de estado o si reaparece un emoji de modo de transporte.

## [13.680.0] - 2026-08-19
### Ola A · auditoría externa (dinero y seguridad)
- BL-1 · factura manual: la cantidad ya no se redondea a entero (`Math.round`); usa `parseCantidadFiscal`, así 1.5 toneladas se timbran como 1.5 y el subtotal cuadra con el CFDI.
- BL-2 · factura manual: la fecha de vencimiento se calcula con `addDaysIso` (canon `dateOnly`), eliminando el desfase de un día en navegadores fuera de America/Mexico_City.
- BL-3 · cotizaciones: editar una cotización de mercancía peligrosa sin volver a subir el MSDS ya no borra el archivo guardado (`msds_archivo` sólo se escribe si hay archivo nuevo).
- EC-3 · `tracking-public` tiene rate limit fail-closed (30/min por IP, 600/min global) vía el nuevo helper compartido `supabase/functions/_shared/ratelimit.ts`.

## [13.679.0] - 2026-08-19
### Ola 20 · arquitectura (auditoría, pasos 4, 8 y 9)
- Paso 4 · barriles limpios: `catalogos`, `configuracion`, `auth`, `reportes`, `operaciones`, `dashboard`, `notificaciones`, `search` y `portal-agente` extrajeron su lógica a módulos con nombre; los `index.ts` sólo re-exportan (importar un tipo ya no arrastra el cliente de base de datos).
- Guardrail `src/__tests__/architecture/barril-sin-logica.test.ts`: ningún barril de feature puede tocar la base de datos ni declarar funciones.
- Paso 8 · componentes con un solo dueño salen de `components/shared`: `PortalFilterSheet` y `PortalFiltersBar` → `features/portal/components/filtros`, `ProfitBadge` → `features/cotizacion/components`.
- Paso 9 · el despacho de descripciones de bitácora es una tabla (`Record<accion, ...>`) en lugar de escaleras de `if`; se eliminaron los `eslint-disable complexity` de `bitacoraDescripcion.ts` y `bitacoraDescripcionModulos.ts`.

## [13.678.0] - 2026-08-19
### Crítico · un solo cálculo de días
- Los "días vencidos / días de demora" ya no se calculan a mano en cada pantalla: 20 sitios (cartera, CxP, CRM, tracking, expediente, PDF de estado de cuenta, auditoría, tarifas, seguros) usan `diffDiasCalendario` / `diasVencidos` de `src/lib/date/dateOnly.ts`, anclados a medianoche local y con `Math.round` (inmune al cambio de horario).
- Guardrail `src/__tests__/architecture/dias-calendario-central.test.ts`: prohíbe volver a dividir entre un día en milisegundos; sólo quedan excepciones documentadas (semana ISO, serial de Excel, vigencia anclada a CDMX y texto "hace N días").
- Corrección de prueba: `rankingLabels.test.ts` armaba las fechas con `toISOString()` (UTC), lo que corría un día en CDMX por la tarde.

## [13.677.0] - 2026-08-19
- Ola 19 · paso 6: catálogo único de cubetas de antigüedad. Estado de cuenta, CxC, CxP y proveedores usan `src/lib/aging/buckets.ts` (rangos, etiquetas y colores); los encabezados de los CSV se derivan del catálogo.
- Ola 19 · paso 7: los topes de consulta (500/1000/2000/5000) ahora son constantes con nombre en `src/constants/queryCaps.ts`, migrados en 33 servicios, con guardrail que prohíbe `.limit(>=500)` literal.

## [13.676.0] - 2026-08-19
- Ola 19 · paso 2: el Dashboard Ejecutivo se movió a `features/dashboardEjecutivo/routes`, rompiendo el ciclo de dependencias con `profit`.
- Ola 19 · paso 5: el tipo `Moneda` ya no se redeclara por módulo; `financialUtils`, tesorería, seguros, anticipos, aging CxP y pagos usan el alias central de `@/types/db`.

## [13.675.2] - 2026-08-19

### CI verde
- **Accesibilidad de formularios (167 advertencias):** cada `<Input>` de `src/features/**` ya tiene etiqueta: `id` + `<Label htmlFor>` cuando hay etiqueta visible, o `aria-label` descriptivo en buscadores, celdas de tabla y filas repetidas. Analogía: le pusimos nombre a cada casilla del formulario, para que un lector de pantalla sepa qué está llenando.
- **Power of 10:** `CotizacionDetalleContenido.tsx` (204 líneas) volvió a 162 al mover sus tipos de props a `cotizacionDetalleContenido.types.ts`.

## [13.675.1] - 2026-08-18

### Sentry
- **JAVASCRIPT-REACT-5C (`Error: /logo-preview`) resuelto:** la página 404 reportaba cada ruta inexistente como error a Sentry. Ahora se registra como `warn` (breadcrumb), así los enlaces viejos y las rutas sólo-dev (`/logo-preview`) dejan de crear issues. Analogía: dejamos de sonar la alarma de incendio cuando alguien nomás toca el timbre equivocado.


## [13.675.0] - 2026-08-18

### Auditoría de arquitectura — punto 8 (dispersión de lecturas)
- **Query muerta eliminada:** la bandeja de Facturación pedía hasta 2,000 conceptos de costo con `select("*")` (`fetchGastosPendientes`) que ninguna pantalla mostraba; se retiraron esa lectura, `marcarCostoPagado`, sus hooks (`useGastosPendientes`, `useMarcarCostoPagado`) y su query key. Analogía: dejamos de cargar cada día una caja de expedientes que nadie abría.
- **Guardrail nuevo:** `select-star-ratchet.test.ts` congela en 50 los usos de `select("*")` en código de producción, así ningún archivo nuevo agrega lecturas comodín; al migrar uno a columnas explícitas se baja el tope.
- Limpieza: `props-drilling-cap.test.ts` usa `fast-glob` (dependencia ya listada) y se cerró un tipo exportado sin consumidores en `CotizacionDetalleContenido`.


## [13.674.0] - 2026-08-18

### Auditoría de arquitectura — puntos 5 y 6
- **Dueño claro admin / configuración (punto 5):** `configuracion` es el dueño de los ajustes del tenant y ahora publica un barril `src/features/configuracion/index.ts`. La consola de plataforma (`admin`) dejó de entrar a sus carpetas internas (14 deep imports en 4 archivos) y consume sólo esa superficie; `configuracion` sigue sin importar nada de `admin`.
- **`lib/domain` sólo para lo compartido (punto 6):** se movieron 7 módulos que en realidad pertenecían a un único feature: `auth` → `features/auth/domain`, `conceptosPorContenedor` / `montoEntranteCotejo` / `proveedorEntrante` → `embarques/domain`, `facturasEntrantesBuzon` → `bandejas/domain`, `montoDeclarado` → `cxp/domain`, `tiposContenedorDefault` → `cotizacion/domain` (con sus pruebas).
- **Guardrail nuevo:** `lib-domain-es-cross-cutting.test.ts` falla si un módulo de `src/lib/domain` queda con un solo feature consumidor, más `src/lib/domain/README.md` con el criterio. Analogía: `lib/domain` es la bodega común del edificio; lo que sólo usa un departamento se guarda dentro de ese departamento.
- Se corrigieron 2 pruebas cuyos mocks apuntaban a rutas internas de `configuracion`.

## [13.673.0] - 2026-08-18

### Auditoría de arquitectura — punto 1: frontera pública del feature CxP
- **Superficie pública real:** CxP se importaba desde 40 archivos de otros features "por la ventana" (rutas internas como `@/features/cxp/services/facturasEntrantes`). Ahora todo entra por la puerta: barril raíz `@/features/cxp` y sub-barriles `services` / `hooks` / `types` / `queryKeys` / `permissions`.
- **Barriles ampliados:** se expusieron 14 servicios y 11 hooks que ya se consumían de fuera, más `ProveedorCombobox`, `cxpColumns` y las partes de `DialogDetallePagosProveedor` en el barril raíz.
- **Imports unificados:** se fusionaron los imports duplicados resultantes en 5 archivos (sidebar, Compras por aprobar, buzón, entrantes de embarque).
- **Guardrail:** `feature-barrel-surface.test.ts` ahora enforza `cxp` junto a `tesoreria` y `proformas`; cualquier deep import nuevo hacia estos features falla la suite. Analogía: antes cada feature era una casa sin puerta principal y los vecinos entraban por cualquier ventana; ahora solo hay recepción.

## [13.672.0] - 2026-08-18

### Auditoría de arquitectura — punto 3 (duplicados) y mensajes LC_* del CRM
- **Badge de carta garantía compartido:** vivía duplicado en `cotizacion` y `costeo` (uno re-exportando al otro). Se movió a `src/components/shared/CartaGarantiaBadge.tsx` y los 5 call-sites (cotización, costeo, portal-agente) apuntan ahí. Como tener dos llaves de la misma puerta: ahora hay una sola.
- **Nombres que engañaban:** `OrgInfoCard` de admin (editable, datos generales del tenant) → `OrgDatosGeneralesCard`; `TabFacturacion` de embarques → `TabFacturacionEmbarque`; `ActividadTimeline` de embarques (feed read-only) → `ActividadFeedTimeline`. Los de `configuracion` y `crm` conservan su nombre.
- **Guardrail:** nuevo `src/__tests__/architecture/no-duplicate-component-names.test.ts` — dos `.tsx` PascalCase con el mismo nombre en features distintos fallan la suite (única excepción documentada: `Configuracion.tsx` de admin y crm, que son rutas homónimas).
- **Falsos duplicados descartados:** `estadoCuenta.ts` (×4) y `embarque.ts` (×4) sólo comparten nombre: son dominios distintos (bancario, cliente, proveedor / tipos vs mappers). No se tocaron.
- **Mensajes de error:** se agregaron los textos amigables de `LC_CRM_OPORTUNIDAD_AJENA`, `LC_CRM_LEAD_AJENO`, `LC_CRM_SIN_ETAPA_ABIERTA`, `LC_CRM_PROSPECTO_SIN_EMPRESA` y `LC_COTIZACION_SIN_PERMISO_ESCRITURA`, que aparecían al usuario como códigos crudos.

## [13.671.0] - 2026-08-18

### Auditoría de arquitectura — puntos 2, 4 y 9 aplicados
- **Reglas de negocio fuera de la UI (punto 4):** `RegistrarAnticipoDialog` tenía tres `useEffect` con política de negocio (sugerir T/C, autoseleccionar cuenta por moneda) y la conversión a MXN inline. Se extrajeron a funciones puras en `anticipos-proveedor/domain/registrarAnticipoPolicy.ts` (`tcSugeridoParaMoneda`, `debeSugerirTc`, `resolverCuentaBancaria`, `equivalenteMxnAnticipo`) y al hook `useRegistrarAnticipoDefaults`. El diálogo ahora solo captura y renderiza. +12 pruebas.
- **UI desacoplada del esquema (punto 2):** 16 componentes derivaban tipos de `@/integrations/supabase/types` (p. ej. `Tables<"factura_notas_credito">["motivo"]`), así que renombrar una columna rompía la pantalla. Se crearon alias de dominio: `features/facturacion/types`, `features/cxp/types/notasCredito.ts`, `features/embarques/types/tracking.ts`, `features/presupuesto/types.ts` y `Moneda` en `@/types/db`. Nuevo guardrail `src/__tests__/architecture/ui-no-supabase-types.test.ts` con baseline 0.
- **Porcentajes y moneda unificados (punto 9):** el % de cumplimiento se calculaba de tres formas distintas. Se agregaron `porcentajeEntero`, `fraccionAPorcentaje` y `formatCurrencyEntero` a `@/lib/formatters` y se migraron `PipelineResumen`, `OportunidadCard.parts`, `CrmDashboard`, `ResumenTotalesCotizacion` y `AuditoriaRiesgoFinancieroCard`.
- **Higiene:** la allowlist de `no-legacy-color-literals` quedó vacía (`LogoPreview` ya está tokenizado desde v13.669.0), lo que destrabó la suite de arquitectura.

## [13.670.0] - 2026-08-18

### Ola 5 · UX-09 — `<Input>` con etiqueta accesible (28 campos)
- Un `<Input>` sin `id` ligado a su `<Label htmlFor>` (ni `aria-label`) se anuncia como "cuadro de edición" y nada más: como un archivero con cajones sin etiqueta. Se migraron los formularios más visibles a `FormField` (`@/components/shared/FormField`), que genera el `id` con `useId`, liga `htmlFor` y conecta el error con `aria-describedby`.
- Admin: `TabSeguridadGlobal.tsx` (4), `NuevaOrganizacionDialog.tsx` (3, el `Select` de administrador quedó con `Label htmlFor="nueva-org-owner"` + `SelectTrigger id`), `TabPlanesColumns.tsx` (4 inputs de edición en celdas → `aria-label` por columna).
- Configuración: `TabNavieras.tsx` (2), `TabPuertos.tsx` (3), `TabTiposContenedor.tsx` (2), `TabTipoCambioDof.tsx` (2), `TabOperaciones.tsx` (2), `TabEmpresa.tsx` (5) y `wizard/PasoApiKeys.tsx` (1, label compuesto → `aria-label`).
- Sin cambios de comportamiento: mismos textos y layout; las ayudas pasan de `<p>` a la prop `hint`.
- Patrón para el resto: (1) etiqueta visible → `FormField`; (2) control sin etiqueta visible (tablas, toolbars) → `aria-label`; (3) etiqueta compuesta o control que no es el primer hijo → `Label htmlFor` + `id` explícito kebab-case.

### Ola 5b · Tooling a11y — guardrail contra regresiones
- Nuevo bloque `a11y-input-label` en `eslint.config.js`: `no-restricted-syntax` con selector esquery que marca `<Input>` sin `id` ni `aria-label`, exceptuando los que ya están envueltos en `FormField`.
- Nivel **warn** y scoped a `src/features/**` a propósito: hay deuda legacy (167 avisos hoy, 203 antes de la Ola 5) y en "error" el lint fallaría de inmediato. Burn-down documentado en el bloque: al llegar a 0, subir a "error" y ampliar a `src/**`.
- `eslint-plugin-jsx-a11y` no está instalado; cuando se instale, sustituir el guardrail por `jsx-a11y/control-has-associated-label`.

## [13.669.0] - 2026-08-18

### Ola 7 · N-UI-01 — Un solo `CartaGarantiaBadge`
- Existían dos componentes homónimos para el mismo dato (uno sólido de una palabra en Costeo/Portal del agente, otro informativo con iconos en Cotizaciones). Queda la variante informativa como única implementación, aceptando `{tarifa}` o `{tieneCarta, vigenteHasta, navieraNombre?}`; el módulo de costeo sólo re-exporta, así que ningún import cambió. Analogía: eran dos semáforos en el mismo cruce y al cambiar uno el otro quedaba mintiendo.
- Las fechas ahora usan el formateador canónico `formatFechaDia` (DD/MM/YYYY, TZ_MX) en lugar del ISO crudo.
- Cambio visible: en Costeo → Navieras y Portal del agente → Garantías el badge muestra icono, fecha y el aviso "se cobrará depósito".
- `TODO(shared)`: mover el componente a `src/components/shared` cuando el ownership lo permita.
- Test nuevo: `CartaGarantiaBadge.test.tsx` (4 estados × 2 formas de props + formato de fecha).

### Ola 6 · Marca (UI-03/UI-16)
- `src/pdf/theme/tokens.ts`: `primary` `#0F4C81`→`#1B2E4B` y `accent` `#2563EB`→`#2463EB` (equivalentes exactos de `--primary: 216 47% 20%` y `--accent: 221 83% 53%` en `src/index.css`, ahora citada como fuente de verdad). Los PDFs quedan con el mismo azul que la pantalla.
- `package.json`: `name` `vite_react_shadcn_ts` → `libre-carga`.
- `LogoPreview.tsx`: hex y clases crudas reemplazadas por tokens semánticos (`bg-background`/`bg-card`/`bg-muted`, `bg-primary`, `bg-accent`, `text-*-foreground`, `ring-accent`) y el degradado reescrito con `hsl(var(--primary))`/`hsl(var(--accent))`. Mismo propósito de QA, sin hex en etiquetas.

## [13.668.0] - 2026-08-18

### Ola 3 · Copy "Cartera" → "Cobranza"
- `/cobranza` ya titula "Cobranza" (título del navegador y encabezado) y el dashboard ejecutivo dice "Cobranza vencida (>30d)" / "Cobranza vencida" en el drilldown. No se tocaron rutas, archivos ni identificadores de datos (`kpis.cartera_vencida_mxn` sigue igual).

### Ola 3b · Migas "Por aprobar" / "Por pagar"
- `Breadcrumbs.tsx`: los segmentos `por-aprobar` y `por-pagar` ya tienen etiqueta propia; antes se mostraban con guion ("Por-aprobar").

### Ola 4 · N-EC-02 — `await onConfirm()` sin catch en diálogos base
- `ConfirmActionDialog` y `DoubleConfirmDeleteDialog` envuelven `onConfirm()` en `try/catch` con `console.error`; en el de doble confirmación el cierre sólo ocurre en éxito, así que un fallo ya no deja el modal atorado y el usuario puede reintentar. Analogía: el cinturón dejó de depender de que el conductor se acuerde de ponérselo — ahora lo trae el coche.
- Tests nuevos: `ConfirmActionDialog.test.tsx` (2 casos) y un caso de rechazo en `DoubleConfirmDeleteDialog.test.tsx`.
- Fuera de alcance (tienen su propio `await onConfirm` inline): `EliminarFacturaCxpDialog`, `RechazarFacturaEntranteDialog`, `MarcarCapturadaDialog`, `CancelarEmbarqueDialog`, `ReasonDialog`.

## [13.667.0] - 2026-08-18

### Ola 2 · EC-07/EC-08/EC-09 — fechas seguras, promesas con catch y realtime por tenant
- **EC-07** `formatFechaSegura` (nuevo `src/lib/formatters/datesSegura.ts`, separado para respetar Power-of-10 #4): valida con `isValid` antes de formatear y devuelve `—`. Migrados `papelera/columns.tsx` (se elimina el adaptador `dtf` con `toISOString()`), `Idempotencia.tsx`, `AlertasSistemaPanel.tsx` y `AsignacionExistenteInfo.tsx`. Analogía: antes una fecha corrupta era un foco fundido que apagaba toda la casa; ahora sólo ese foco queda apagado.
- **EC-08** promesas sin `catch`: descarga de MSDS (`MercanciaInfoGrid.tsx`) con `try/catch` + `notifyError`, `ResetPassword.tsx` ya no queda en spinner infinito, y `proformas/services/destinatarios.ts` propaga errores de PostgREST con límite defensivo de 200 filas.
- **EC-09** realtime CxP: `subscribeEntrantesBuzon(organizationId, onChange)` usa canal y `filter: organization_id=eq.<org>`; `useEntrantesPorCapturarCount` no se suscribe sin organización activa.

### Ola 8 · Test estructural de respaldo PERMISSIVE (PERF-01)
- Nueva suite `supabase/tests/rls/test_rls_restrictive_perf01_permissive_backup.sql`: toda tabla con RESTRICTIVE del patrón PERF-01 (`rls_tenant_scope_ok` + corto-circuito `has_role('super_admin')`) debe tener al menos una PERMISSIVE con filtro tenant/rol, salvo whitelist documentada. Evita que una tabla quede ilegible para `authenticated`.

### Tests
- Nuevo `dates.segura.test.ts` (6 casos) y `facturasEntrantesRealtime.test.ts` actualizado al canal por organización.
- `useCotizacionDetalleHandlers.test.tsx` estaba rojo: faltaba mockear `fetchDatosFiscalesProspecto`, `tieneCostosCargados` y `notifyWarning`, y `abrirDialogConvertir` ahora es `async`.

## [13.666.2] - 2026-08-18

### FIX-45 · `anon` sin EXECUTE en trigger de cotizaciones
- `public._cotizaciones_bloquear_envio_sin_oportunidad()` se creó sin revocar EXECUTE, rompiendo la whitelist `fix45_anon_execute_whitelist.sql`.
- Migración: `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` (el trigger corre como dueño, no necesita grants de usuario).

### Replay · `validar_cierre_embarque` (R4BD-01)
- `audit:replay-mirror` fallaba: la migración BUG-13 `20260826000200` tiene timestamp posterior a la de N-BL-01 (`20260818214910`), así que en un replay limpio pisaba la conversión de pagos CxP a la moneda de la factura.
- Nueva migración `20260826001000_nbl01_replay_validar_cierre_embarque.sql` re-emite el cuerpo vigente (idéntico al espejo, sin cambio funcional en la BD) + manifiesto actualizado a 1014 migraciones.




## [13.666.1] - 2026-08-18

### Suite RLS · Fixtures idempotentes en `user_roles`
- Los fixtures de las 31 suites `supabase/tests/rls/test_rls_*.sql` insertaban en `public.user_roles` con `INSERT` plano; desde el trigger `_sync_user_roles_desde_membership` (v13.665.0) la fila ya existe al crear la membresía y 27 suites fallaban con `user_roles_user_id_unique`.
- Se añadió `ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role` a los inserts de fixture (sin tocar las aserciones negativas de escalada de privilegios).
- Verificado en Postgres local con las 1012 migraciones aplicadas: bootstrap, drift, post-migrate, verify_rls y las 31 suites RLS en verde.

## [13.666.0] - 2026-08-18

### N-BL-01 · Cierre de embarque con CxP multi-moneda (fail-open)
- `public.validar_cierre_embarque` sumaba `pagos_proveedor.monto` **en crudo** en el bloque `cxp_pagada`: una factura de 500 USD "pagada" con 500 MXN quedaba con saldo 0 y `puede_cerrar=true` con ~473.68 USD realmente pendientes.
- El pagado CxP ahora se convierte con `public.monto_pago_en_moneda_factura(pp.monto, pp.moneda, pp.tipo_cambio_usd, pf.moneda)` en ambas subconsultas (`pagado` y `facturas_pendientes`), mismo patrón que `saldo_factura_proveedor`. Se conserva el umbral 0.01 por moneda (BUG-13) y todos los demás checks.
- **Fail-closed:** un pago en moneda distinta sin `tipo_cambio_usd` se excluye del pagado (nunca 1:1 silencioso) y se reporta en `detalle.por_moneda[].pagos_sin_tipo_cambio`; el cierre queda bloqueado hasta capturar el T/C.
- `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role` (H6/FIX-45). Espejo canónico `supabase/schema/embarques/validar_cierre_embarque.sql` actualizado 1:1.
- Nueva prueba `supabase/tests/validar_cierre_cxp_conversion_moneda.sql`: regresión USD/MXN, fail-closed sin T/C y control positivo (9,500 MXN @19 = 500 USD sí salda).

## [13.665.0] - 2026-08-18

### Roles de organización que no otorgaban permisos (RLS 42501)
- Causa: `public.has_role()` lee sólo `public.user_roles`, pero los roles se administran en `public.organization_members`. 10 de 19 membresías no tenían espejo, así que esos usuarios operaban sin permisos efectivos (p. ej. una KAM `vendedor` no podía guardar el Paso 1 de una cotización: *new row violates row-level security policy for table "cotizaciones"*).
- Nuevo trigger `public._sync_user_roles_desde_membership()` en `organization_members` (INSERT / UPDATE OF role / DELETE): mantiene el espejo en `user_roles` al día. Nunca espeja roles de plataforma (`super_admin`) ni legacy (`admin`, `operador`, `viewer`), y no pisa roles `super_admin`/`cliente` existentes. `REVOKE ALL` a PUBLIC/anon/authenticated (H6/FIX-45).
- Backfill idempotente: las 10 membresías sin espejo quedaron sincronizadas; el conteo de huérfanas es 0.
- Nueva prueba `supabase/tests/roles_membership_mirror.sql` (5 casos, incluida la invariante global de cero huérfanas), registrada en el workflow `rls-tests`.
- Sin cambios de frontend: `has_role`, `puede_escribir_cotizaciones` y las políticas de `cotizaciones` quedan intactas.

## [13.664.0] - 2026-08-18


### Prospectos: captura única y vínculo obligatorio con el CRM
- Paso 1 del wizard incluye "Datos fiscales (opcional)" (RFC, dirección, ciudad, estado, C.P.): se guardan en el lead del CRM y precargan el alta de cliente al convertir el prospecto, evitando la doble captura.
- `vincularOCrearOportunidadParaCotizacion` pasa a una sola llamada transaccional a `crm_vincular_cotizacion` (lead + oportunidad + `cotizaciones.oportunidad_id` en una transacción); ya no quedan cotizaciones huérfanas por fallas a la mitad. Se eliminaron los helpers sueltos de dedupe/etapa/update.
- Nuevo aviso `CotizacionSinOportunidadBanner` con botón "Vincular al CRM" para regularizar cotizaciones de prospecto sin oportunidad; el envío queda bloqueado por la base de datos (`LC_COT_SIN_OPORTUNIDAD`, con mensaje amigable en el catálogo LC).


## [13.663.1] - 2026-08-18

### Auditoría de embarques vacía por "permission denied" (42501)
- Causa raíz: el wrapper `public.auditoria_embarques_org(uuid)` de `costos_repetidos.sql` perdió el marcador `SECURITY DEFINER`, así que corría como invocador y chocaba con el `REVOKE` de los helpers internos (`_audit_embarques_agregar`, `_audit_embarques_umbrales`). El cliente traducía el 42501 a reporte vacío → "0 hallazgos" falsos.
- Restaurado `SECURITY DEFINER` + `SET search_path`, con guard explícito `_assert_internal_reader(p_organization_id)` y `REVOKE`/`GRANT` (sólo `authenticated` y `service_role`).
- Actualizada la fuente canónica `supabase/schema/auditoria/costos_repetidos.sql`.


## [13.663.0] - 2026-08-18

### BUG-12 — El barrido de facturas vencidas por fin marca facturas
- Causa raíz: `public.marcar_facturas_vencidas()` filtraba su `UPDATE` por contexto de usuario (`service_role` / `super_admin` / `current_user_org_id()`). Bajo `pg_cron` no hay sesión (`auth.uid()`, `auth.role()` y `current_user_org_id()` nulos), así que el predicado era falso para toda fila: el job `marcar_facturas_vencidas_diario` corría `succeeded` cada día marcando **cero** facturas y la cartera vencida quedaba subestimada para siempre.
- El barrido pasa a ser una tarea de plataforma sin filtro de tenant (`SECURITY DEFINER`), compara contra la fecha de negocio MX (`now() AT TIME ZONE 'America/Mexico_City'`) en vez de `CURRENT_DATE` (UTC, ver EC-06), y sólo mueve `Emitida → Vencida`: `Parcialmente pagada` conserva su estado para no oscilar contra `recalcular_estado_factura`.
- Cada corrida registra el conteo en `app_logs` (`fn = 'marcar_facturas_vencidas'`) para monitoreo. Cron re-agendado a `5 6 * * *` (00:05 MX) de forma idempotente y backfill ejecutado en la migración.
- `REVOKE ALL` a `PUBLIC`/`anon`/`authenticated` y `GRANT EXECUTE` sólo a `service_role` (H6 / FIX-45).
- Nueva prueba SQL `supabase/tests/bug12_marcar_facturas_vencidas.sql` (6 casos: marcado sin sesión como pg_cron, vigentes y papelera intactas, parcialmente pagada intacta, idempotencia y recálculo a `Pagada` tras el pago) registrada en el workflow `rls-tests`.
- Sin cambios de frontend ni en reportes: cartera y antigüedad ya filtran por `fecha_vencimiento` y aceptan `('Emitida','Vencida','Parcialmente pagada')`; lo que se corrige son las bandejas y badges que filtran `estado = 'Vencida'`.

## [13.662.0] - 2026-08-18


### UI-02 — Estados vacíos inline canónicos (`EmptyStateInline`)
- 22 archivos migraron sus bloques "No hay… / Aún no… / Sin datos" pintados a mano (div/p centrado con paddings py-4/py-6/py-8 inconsistentes) a `<EmptyStateInline>`: cotización (3), costeo (2), CRM (2), admin (2), tesorería (2), catálogos, CxP, reportes, dashboard, operaciones, proveedor, portal, proformas, configuración y el diálogo compartido de previsualización.
- `EmptyStateInline` gana dos props opcionales: `action` (CTA con ruta interna o handler) y `density="compact"` para popovers, tooltips y celdas de tabla. Sin cambios para los 102 usos existentes.
- Los bloques que en realidad eran errores (bitácora de proformas) pasaron a `ErrorStateInline`; los avisos condicionales de "no hay cuentas en {moneda}" dentro de formularios se dejaron como aviso de campo y ahora usan el token `text-warning`.
- Nuevo guardrail `src/__tests__/architecture/empty-state-inline-canonical.test.ts` con deuda declarada de 1 archivo (sparkline de 24px). El guardrail de densidad de tablas ahora distingue la prop `density` de los estados inline.

## [13.661.0] - 2026-08-18


### UI-06 — Encabezados de sección canónicos (`SectionHeading`)
- 26 archivos del ERP migraron sus títulos de bloque (`text-sm/base/lg font-semibold` a mano) a `<SectionHeading>` con la variante correcta (`section`, `subsection`, `overline`), conservando iconos, contadores y acciones: CxP (8), Tesorería (4), embarques (3), proveedor (3), anticipos, cartera, admin/usuarios, refacturación, notificaciones y auditoría.
- Los primitivos `FormDialogSection` y `DocumentoSectionTitle` ahora delegan en `SectionHeading`, así que decenas de pantallas heredan la misma escala sin tocarlas.
- Nuevo guardrail `src/__tests__/architecture/section-heading-canonical.test.ts`: falla si un `<h2>/<h3>/<h4>` vuelve a llevar `font-semibold` por `className`. Excluye el sitio público (`features/marketing`, `features/legal`) y declara 4 encabezados de estado (vacío, error, elección de organización) como deuda que sólo puede decrecer.



## [13.660.0] - 2026-08-18

### PERF — Ejecución del plan de rendimiento (hallazgos #1 a #4)
- **PERF-01 (RLS por fila)**: las 90 políticas `RESTRICTIVE` de tenant ahora evalúan primero `NOT (SELECT has_role(auth.uid(),'super_admin'))` — una expresión no correlacionada que Postgres resuelve como InitPlan una vez por consulta — y sólo llaman a `rls_tenant_scope_ok(organization_id)` cuando el usuario sí es super admin. Mismo aislamiento, sin peaje por fila (`cxp_por_pagar` medía 93 ms sobre 176 filas).
- **PERF-02 (consultas duplicadas)**: `useCxpPorPagarCount` reutiliza la query key `bandejas.cxpPorPagar` y deriva el conteo con `select`; se eliminó el servicio duplicado `cxpPorPagarCount.ts`.
- **PERF-03 (ritmo de refetch)**: badges del sidebar a 30 min y buzón CxP a 15 min (el realtime ya invalida al instante).
- **PERF-04 (reportes)**: `useCxcAging` sube su `staleTime` a 5 min (reporte a fecha de corte, no dato en vivo).
- **Assets**: `favicon-48.png` (3 KB en lugar de 126 KB), logo en WebP (10 KB vs 120 KB) en los 4 componentes que lo usan y carga de Inter reducida de 6 a 4 pesos.


## [13.659.0] - 2026-08-18

### UI-15 — Moneda explícita en importes y pipeline del CRM en pesos reales
- Embarques · Tab Costos: los KPIs Total Venta/Costo/Utilidad pasan `'MXN'` explícito (ya venían convertidos por `totalEnMxn`).
- CRM · Higiene: `crm_higiene_pipeline` convertía sumando MXN con USD/EUR sin mirar `moneda`; ahora convierte cada oportunidad a pesos con el T/C DOF vigente y devuelve `tc_fecha` y `tc_estimado`. La tarjeta avisa "(T/C estimado)" cuando falta T/C publicado.
- CRM · Oportunidades: el pipeline del subencabezado se calcula con `sumarPipelineMxn` (nuevo helper en `crm/domain/pipelineMoneda.ts`) en lugar de sumar montos de monedas distintas; avisa "(T/C estimado)" con T/C de respaldo.
- CRM · Presupuesto: el total anual se muestra por moneda cuando el año tiene monedas mezcladas.
- Nuevo guardrail `formatcurrency-moneda-explicita.test.ts`: falla si un call-site de features financieros omite la moneda. Nuevas pruebas de `sumarPipelineMxn` (5).
- EC-10, EC-06 y UX-12 (documentos re-subidos) ya estaban cerrados en 13.657.0/13.658.0; sin cambios.

## [13.658.0] - 2026-08-18

### EC-10 (cierre) — Aviso de T/C de respaldo en las pantallas pendientes
- Tesorería: el badge deja de decir "TC DOF" cuando el valor es el respaldo; ahora muestra "T/C estimado · no oficial" en tono de advertencia, más `TipoCambioFallbackBanner`.
- Bandejas · Cartera: los equivalentes en MXN se marcan "(T/C estimado)" con tooltip y la pantalla muestra el banner.
- Detalle de proveedor: aviso cuando los totales multi-moneda se convierten con T/C de respaldo.
- Compras · Reportes: banner en la página y nota de que el orden del Top 10 es estimado cuando hay partidas en USD.
- Dashboard Ejecutivo: ya contaba con alerta visible propia (`tcEsFallback`); sin cambios.
- Nueva suite `ec10-tc-respaldo-avisos.test.tsx` (7 pruebas): el aviso aparece con `esFallback` y desaparece con T/C oficial.

## [13.657.0] - 2026-08-18

### EC-10 — El tipo de cambio de respaldo ya no se usa como oficial
- CxP: el auto-llenado de T/C DOF rechaza el valor de respaldo (17.25/18.5) y pide captura manual.
- Facturación · Registrar pago: `derivarEstadoPago` expone `tcRespaldo` y bloquea el envío del REP cuando hay conversión cross-moneda con T/C de respaldo.
- Profit · Estado de Resultados: se agregó `TipoCambioFallbackBanner`.
- Embarques · Costos y Precios: `StepCostosTcAviso` avisa "Tipo de cambio de respaldo".

### EC-06 — Fechas date-only sin desfase de un día en México
- Corregidos 5 casos (tarifa vinculada, `diasHasta` de rutas de costeo, celda de vigencia, `validez_propuesta`, `vigenciaPlus30` de proformas) usando `hoyMx`/`parseLocalMx` o comparación ISO.

### UX-12 — Moneda y T/C canónicos en CxP
- Delta de conciliación con `formatCurrency`; nuevo `formatTipoCambio` (4 decimales, como el DOF) en eliminar factura, banda de contexto y pago a proveedor; la gráfica de antigüedad usa el formateador compartido.

### EC-05 — Límites defensivos en consultas
- `.limit()` + `assertNotTruncated` en eventos de tracking del operador, expedientes por cliente, organizaciones (admin), comentarios de auditoría y costos de cotización.

## [13.656.0] - 2026-08-18

### UI-12 — Botones nativos de acción migrados a `ui/Button`
- 15 `<button>` nativos en 12 archivos (Leads demo, anticipos de proveedor, conciliación de compras, buscador de prospectos, cargas de CFDI/XML/PDF en CxP, notas de crédito, contactos de cliente, tarjeta de operador) ahora usan el componente `Button`: foco por teclado, tap targets y estado deshabilitado consistentes.
- Se añadió `type="button"` y `aria-label` donde faltaban; se conservó cada `onClick` y `stopPropagation`.

## [13.655.0] - 2026-08-18

### Pulido UI/UX (UI-07, UI-08, UX-15, UX-16)
- UI-07: `HomeRoute` y `Onboarding` muestran `PageSkeleton` en vez de un spinner `Loader2` a pantalla completa.
- UI-08: el banner de restaurar borrador en Nueva Cotización usa `PageContainer` en lugar de un `div` ad-hoc (gana padding lateral responsivo en móvil).
- UX-15: título de pestaña con `useDocumentTitle` en Cartera, Reportes y Tesorería · Pagos.
- UX-16: en Configuración > Navieras el botón "Agregar" se deshabilita si falta Código o Nombre (antes el clic no hacía nada y sin aviso).

## [13.654.1] - 2026-08-18

### FE-13 / UX-13 — Doble-submit en CRM
- `ActividadTimeline`: "Marcar completada" se deshabilita mientras corre la mutación (antes un doble clic la disparaba dos veces).
- `CriteriosEtapaEditor`: eliminar un criterio ahora pasa por `ConfirmActionDialog` (destructivo) y el botón se bloquea durante la mutación.

## [13.654.0] - 2026-08-18

### FE-14 / FE-16 — Redondeo canónico de dinero (centavos alineados con la base de datos)
- `ConceptoLineaRow`: el botón "Aplicar IVA 16%" usa `calcularIVA(total, TASA_IVA)` en lugar de `Math.round(n*100)/100`.
- `useConceptosManuales`: `redondear2` ahora es `roundMoney` (half away from zero, igual que `ROUND(numeric, 2)`).
- `pagoDiferenciaCambiaria`: la diferencia cambiaria (que puede ser negativa) se redondea con `roundMoney`.
- `recalcularTotalesFactura`: las retenciones ISR/IVA se redondean por línea, como ya se hacía con el IVA, evitando descuadres de 1 centavo contra el trigger de la BD.

## [13.653.3] - 2026-08-18

### Arranque blindado — el DOM ya no puede quedar en blanco sin explicación
- Nuevo `renderBootstrapFallback` (`src/lib/bootstrap/`): si el montaje raíz de React lanza antes del primer render (p. ej. un proveedor de contexto que falla al inicializar), en lugar de dejar `div#root` vacío se pinta una pantalla de recuperación en es-MX con el detalle del error y botón "Recargar". Usa sólo tokens semánticos del design system.
- `src/main.tsx` envuelve `createRoot(...).render(...)` en `try/catch` conectado a ese fallback.
- Diagnóstico del reporte `preview_dom_blank`: se verificó en navegador real (1280px y 555px) que la app monta (~73.6k caracteres en `#root`) y se mantiene estable a los 3/8/14 s, sin bucles de recarga; el DOM vacío correspondía al iframe del editor, no a un crash de la app. El `RangeError: Incorrect locale information provided` observado proviene de `@tanstack/query-devtools` (sólo dev, navegador sin idioma configurado) y no afecta producción.
- Pruebas nuevas para el fallback de arranque.

## [13.653.2] - 2026-08-18

### Preview estable — sin bucle tardío de recarga
- La guarda de recuperación de chunks ya no se borra inmediatamente en `window.load`; ahora exige 8 segundos de estabilidad. Antes un import dinámico que fallaba 1–3 segundos después podía recargar indefinidamente el iframe: la app aparecía brevemente y luego desaparecía.
- Si el segundo intento también falla, la aplicación conserva el fallback de error en vez de repetir la recarga y dejar el preview en blanco.


## [13.653.1] - 2026-08-18

### Preview estable — el bump de versión ya no reinicia el dev server
- `vite.config.ts` dejó de importar `APP_VERSION`: ahora lee la versión con `readAppVersion()` (`scripts/lib/readAppVersion.ts`, lectura por `fs` + regex). Antes ese import volvía `src/constants/appVersion.ts` dependencia de la configuración de Vite y cada bump disparaba `server restarted`, abortando imports dinámicos (`Failed to fetch dynamically imported module` en Dashboard/Facturación/Cotizaciones y `404 /@vite/client`) y dejando el preview embebido en blanco.
- El release de Sentry en producción mantiene el formato `libre-carga@<versión>`; si no puede leerse el archivo cae a `unknown` sin romper el build.
- Pruebas nuevas para `readAppVersion` (versión vigente y fallback).


## [13.653.0] - 2026-08-18

### FE-15 / BUG-15 — tolerancia de sobrepago unificada
- Nuevo `src/lib/financial/toleranciaPago.ts` con `TOLERANCIA_SOBREPAGO = 0.005` (medio centavo).
- `DialogRegistrarPago.tsx` deja de usar `0.01` y `CobroLoteRenglon.tsx` deja el literal suelto: ambos usan la constante compartida.
- Pruebas nuevas de casos frontera (sobrepago de 1 centavo bloqueado, redondeo de medio centavo tolerado).


## [13.652.6] - 2026-08-18

### Power of 10 — catálogo LC_* operativo dividido
- `src/lib/errors/lcCodeMessages.operativo.ts` (202 → 16 líneas): dividido en 4 subcatálogos por dominio para respetar el límite de 200 líneas:
  - `lcCodeMessages.operativo.auth.ts` — autenticación, tenancy y permisos.
  - `lcCodeMessages.operativo.operaciones.ts` — embarques, cotizaciones y concurrencia.
  - `lcCodeMessages.operativo.garantias.ts` — garantías, demoras y proformas.
  - `lcCodeMessages.operativo.genericos.ts` — genéricos, buzón de facturas entrantes, tipo de cambio DOF y RPCs transaccionales.
- El índice sigue exportando `LC_CODE_MESSAGES_OPERATIVO`, por lo que los consumidores no requieren cambios.

## [13.652.5] - 2026-08-18

### CI verde — cobertura de códigos LC_* y exports limpios
- `src/lib/errors/lcCodeMessages.operativo.ts`: añadidos mensajes amigables para `LC_COTIZACION_MONEDA_NO_SOPORTADA`, `LC_ESTADO_CONCURRENTE`, `LC_XML_UUID_INVALIDO` y `LC_XML_TOTAL_INVALIDO` (Ola D).
- `ClienteDetalleTablasTabs.tsx` y `FacturapiApiKeyRow.tsx`: eliminado `export default` duplicado, dejando sólo el export nombrado que consumen sus padres. `lint:unused:strict` vuelve a pasar.

## [13.652.4] - 2026-08-18

### Power of 10 — archivos productivos ≤200 líneas
- `FacturapiCredencialesForm.tsx` (211 → 105): la fila de captura de API key se movió a `FacturapiApiKeyRow.tsx`.
- `ClienteDetalleTabs.tsx` (201 → 147): las pestañas tabulares (embarques y cotizaciones) se movieron a `ClienteDetalleTablasTabs.tsx`.

## [13.652.3] - 2026-08-18

### H6 — permisos explícitos en las funciones de la Ola D
- Nueva migración `20260826000700`: `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role` para `validar_cierre_embarque`, `_convertir_proformas_insertar_conceptos`, `convertir_proformas_a_factura`, `avanzar_estado_embarque` y `registrar_pago_cliente_lote`, que se re-emitieron en la Ola D sin el bloque canónico.
- `scripts/audit-migrations.ts`: baseline al `20260826000700` con la nota FIX-H6-21 documentando los archivos legacy.
- `migration-manifest.json` regenerado.

## [13.652.2] - 2026-08-18

### Fixtures de prueba alineados con BUG-05 (NC exige folio fiscal)
- `supabase/tests/rls/test_rls_financiero_critico.sql`: la nota de crédito de cliente del TEST 6 nace con `uuid_fiscal`, evitando `LC_NC_UUID_REQUERIDO` al insertarla como `Aplicada`.
- `supabase/tests/ola4_n41_n44_n45.sql`: mismo ajuste en la NC en moneda distinta del caso N44.

## [13.652.1] - 2026-08-18

### CI verde — manifest, espejos y límite de líneas
- `migration-manifest.json` regenerado: incluye las 6 migraciones aplicadas el 2026-08-18 (1,001 migraciones en disco == manifest).
- `audit:replay-mirror` en verde: la entrada muerta de `saldo_factura` ya no está en el baseline (8 divergencias toleradas restantes).
- `facturapi-emitir` dividida para cumplir `max-lines`: la carga del contexto fiscal (cliente, conceptos vigentes, referencias del embarque y el cuadre BUG-01) vive ahora en `contexto.ts`, y los tipos compartidos en `types.ts`; `emitir.ts` bajó de 329 a 191 líneas. Lint estricto sin warnings.
- Nueva cobertura `contexto_test.ts` (BUG-01): asegura el filtro `deleted_at IS NULL` en conceptos, el 422 `sin_conceptos`, el 422 `subtotal_descuadrado` y que el cuadre se evalúe ANTES de llamar al SAT. 28 pruebas Deno de la función en verde.



## [13.652.0] - 2026-08-18

### Ola D · Bloque P2 — bugs de dinero (BUG-10, 11, 13, 15, 17, 18)
- **BUG-10 · Cambio de estado del embarque a prueba de doble clic**: `avanzar_estado_embarque` bloquea la fila (`FOR UPDATE`) y sólo actualiza si el estado no cambió; si dos personas lo intentan a la vez, la segunda recibe `LC_ESTADO_CONCURRENTE` en lugar de duplicar notas y eventos.
- **BUG-11 · Cotizaciones en moneda no soportada**: `cotizacion_totales_conceptos` lanza `LC_COTIZACION_MONEDA_NO_SOPORTADA` (antes un concepto en EUR sumaba 0 en silencio) y valida cantidades/precios negativos y tasas de IVA fuera de [0,1].
- **BUG-13 · Cierre de embarque multi-moneda**: los checks `cxp_pagada` y `cxc_cobrada` evalúan el umbral de 0.01 **por moneda**; ya no se compensa un saldo pendiente en USD con MXN.
- **BUG-15 · Tolerancia de sobrepago unificada a medio centavo (0.005)**: en la RPC `registrar_pago_cliente_lote` y en el frontend (`TOLERANCIA_CENTAVOS`, cobro en lote CxC y pago en lote CxP). Antes 0.009 en RPC/UI vs 0.005 en el trigger: la app aceptaba importes que el servidor rechazaba después.
- **BUG-17 · Cuadre al facturar proformas**: el total de cada renglón se guarda redondeado a 2 decimales y el subtotal/IVA/total de la factura se recalculan desde esos totales (antes desde `cantidad * precio_unitario`, que podía diferir por centavos y romper el timbrado).
- **BUG-18 · Buzón de facturas**: `adjuntar_xml_factura_entrante` valida en el servidor el formato del UUID fiscal (`LC_XML_UUID_INVALIDO`) y que el total detectado sea mayor a cero (`LC_XML_TOTAL_INVALIDO`).
- **BUG-01 (P0) · Cobertura**: pruebas Deno en `facturapi-emitir` que verifican el filtro `deleted_at IS NULL` en conceptos, el 422 `sin_conceptos` y que el cuadre de subtotal se evalúe ANTES de llamar al SAT.
- **SQL-00 · Guardrail `audit:replay-mirror`**: eliminadas del baseline las entradas que ya no divergen (`saldo_factura`, `avanzar_estado_embarque`, `validar_cierre_embarque`, `registrar_pago_cliente_lote`, funciones de proformas) y normalizados los pies de los espejos afectados.

### Ola D · UI-03 / VIS-06 — marca y avatares
- Un solo azul corporativo: `src/pdf/theme/tokens.ts` usa el `#1B3A5D` de `--primary` y un acento de la misma familia (`#33588E`), con guardrail de arquitectura que falla si vuelve a divergir. Contraste AAA verificado.
- Iniciales de usuario centralizadas en `getUserInitials` (`src/lib/formatters/initials.ts`), usada por sidebar y portales de cliente y agente; sin imágenes placeholder.

### Ola D · Pruebas de bordes de dinero (EC-01 a EC-04)
- Nuevas pruebas: filtro de periodo en comisiones devengadas, fail-closed de moneda en movimientos de cobro y pago (no se asume MXN ni se duplica el movimiento), escapado de `_`/`%` en búsquedas ILIKE (CRM, proveedores, CxP) y camino de error de `monedaDeCuenta` en sugerencia de candidatos de conciliación.



## [13.650.0] - 2026-08-18

### Ola C · UI-02 — un solo estado vacío reutilizable en toda la app
- Todas las listas, secciones, tarjetas y gráficas sin datos usan ahora el componente reutilizable `EmptyStateInline` (icono + mensaje + pista opcional), en lugar de párrafos `text-muted-foreground` escritos a mano en cada pantalla.
- Migrados ~65 estados vacíos en CRM (timeline, Cliente 360, comentarios, motivos de pérdida, plantillas, kanban, analítica y dashboard), CxP y Compras (bitácora de tesorería, historial de factura, notas de crédito, tarjetas del dashboard, reportes y top proveedores), Anticipos de proveedor, Auditoría, Comisiones, Dashboards (dirección, finanzas, ejecutivo, operaciones y admin/diagnóstico), Embarques (facturas entrantes, notas, cierre, contenedores, conceptos de venta, proforma y tracking público), Facturación (bitácora, pagos, notas de crédito, refacturación y estado de cuenta), Portal del cliente, Costeo, Cotización, Bitácora de actividad y el popover de notificaciones.
- Se conservaron los textos exactos de cada mensaje (los tests de UI los asertan) y se respetaron los placeholders de campo/celda ("Sin folio", "Sin fecha", "Sin embarque"), que no son estados vacíos de vista.
- `EmptyState` (versión de página completa con acción sugerida) sigue siendo el canon para vistas completas sin datos; `EmptyStateInline` para bloques internos.

## [13.649.0] - 2026-08-18

### Ola C · UI-01 — `StatusBadge` como único badge de estado en embarques y facturas
- Migradas 15 pantallas del wrapper deprecado `getEstadoColor` a `<StatusBadge domain="embarque" | "factura" />`, que toma color, etiqueta e icono del `statusRegistry`: tracking público (vista y tarjeta de estatus), tarjeta móvil de embarques, embarques del BL Master, historial de facturas del embarque, cargas activas por cliente del dashboard, embarques ligados a la cotización y todo el Portal del cliente (listados y detalles de embarques y facturas, tarjeta de embarque, dashboard de recientes y por estado).
- `EmbarqueStatusChip` (chip compuesto del header de embarque) ya consume `getStatusVisual("embarque", estado).badgeClass` en lugar del wrapper legacy.
- Los contadores por estado ("3 En Tránsito") ahora usan la prop `label` del badge, así que conservan el texto pero heredan el color canónico.
- Allowlist `no-legacy-estado-color` de ESLint reducida de 18 a 3 archivos (sólo quedan pantallas del dominio cotización); cualquier import nuevo de `getEstadoColor` en embarques/facturas ahora rompe el lint.


## [13.648.0] - 2026-08-18

### Ola C · UI-04 — un solo formateador de fechas en toda la app
- Nuevo canónico `formatFechaDia(valor, fallback)` en `src/lib/formatters/dates.ts`: acepta ISO date-only (anclado a mediodía UTC), ISO con hora y objetos `Date` de los date pickers; siempre `dd/MM/yyyy` en zona `America/Mexico_City` y con fallback explícito ("—" por defecto). Devuelve el fallback ante fechas no parseables (antes Node mostraba "Invalid Date").
- Eliminados los formateadores locales duplicados: `CosteoRutasTable`, `CosteoTarifas.helpers` (`formatVigencia`), `TrackingPublico`, `lib/date/relativo`, `grupoCostosProveedorHelpers.fmtFecha` (conserva "s/f") y el `formatFechaEs` de `useTcDofPorFecha`, que colisionaba de nombre con el de `@/lib/formatters` y ahora se llama `formatFechaIsoEstricta`.
- Reemplazados los `format(new Date(...), "dd/MM/yyyy")` crudos de `date-fns` en Auditoría (3 archivos), CxP (3) y Cotización (2): ya respetan TZ y fallback comunes.
- Guardrail nuevo `src/__tests__/architecture/fechas-formateador-canonico.test.ts`: falla el CI si un módulo define su propio formateador de fecha o llama `toLocaleDateString` / `format(..., "dd/MM/yyyy")` fuera de `src/lib`.
- Tests nuevos de contrato para `formatFechaDia`.

## [13.647.5] - 2026-08-18

### Fix — suites RLS `financiero_critico` y `soft_delete_reportes`
- Los fixtures creaban notas de crédito de cliente directamente en estado `Aplicada` sin `uuid_fiscal`, así que el trigger `trg_nc_cliente_transicion` (BUG-05) abortaba la suite con `LC_NC_UUID_REQUERIDO`.
- `test_rls_soft_delete_reportes.sql`: la NC nace `Aplicada` con `uuid_fiscal` de prueba.
- `test_rls_financiero_critico.sql`: la aserción de RLS ahora usa estado `Borrador` (el estado es irrelevante para la prueba de aislamiento).

## [13.647.4] - 2026-08-18

### Fix — re-emisión del candado de cancelación de CxP
- `guard_cxp_cancelacion_rol_financiero` se re-emite en una migración posterior (con `DROP`/`CREATE TRIGGER` incluidos) para que ninguna base reconstruida quede con la variante vieja que sólo consultaba `user_roles`. Verificado en BD: la función activa usa `public.rol_efectivo(uid, organization_id)`.

## [13.647.3] - 2026-08-18


### Fix — cancelación de facturas de proveedor (LC_CXP_CANCELAR_FORBIDDEN)
- `guard_cxp_cancelacion_rol_financiero` ahora resuelve el rol con `public.rol_efectivo(uid, organization_id)` y deja `has_role` como fallback de plataforma. Antes sólo miraba `user_roles`, así que un `admin_org` (rol que vive en `organization_members`) recibía "tu rol no puede cancelar facturas de proveedor" y el test `cxp_cancelacion_libera_embarque.sql` fallaba.

## [13.647.2] - 2026-08-18

### Auditoría v1 — cierre de UX-07 y UX-04
- UX-07: quitar una API key de FacturApi (formulario y wizard) ahora pide confirmación destructiva y el botón tiene `aria-label`.
- UX-04: las pestañas de detalle de Cliente, Auditoría operativa y Buzón de facturas se persisten en la URL (`?tab=`), así sobreviven a recargas y permiten deep-links.
- Se restauró `src/constants/appVersion.ts` (quedó vacío y rompía el typecheck).

## [13.647.1] - 2026-08-18

### Validación de Olas A y B
- Suite completa en verde (1092 archivos / 7342 pruebas): se corrigieron los 2 archivos rojos que dejó la Ola B.
- Añadidos los mensajes amigables faltantes de la Ola A: `LC_CONCEPTOS_YA_ASIGNADOS`, `LC_CXP_CANCELAR_FORBIDDEN`, `LC_NC_MONEDA_SIN_TC`, `LC_NC_TRANSICION_INVALIDA`, `LC_NC_UUID_REQUERIDO`.
- El test de tokens de badges de notas de crédito ahora apunta a `NotaCreditoFila.tsx` (archivo extraído).

## [13.647.0] - 2026-08-18

### Auditoría v1 — Ola B (UX)
- UX-02: la ruta canónica de Cobranza es `/cobranza`; `/cartera` redirige conservando filtros y el menú ya no mezcla los nombres "Cartera" y "Cobranza".
- UX-03: migas de pan con nombres de negocio (Cobranza, Por capturar, Notas de crédito, Antigüedad, Buzón de facturas, Refacturación).
- UX-06: cancelar una nota de crédito de proveedor ahora pide confirmación explícita antes de mover el saldo.
- UX-08: los botones de icono de notas de crédito (aprobar, aplicar, cancelar, XML, PDF) llevan `aria-label`.

## [13.646.0] - 2026-08-18

### Auditoría v1 — Etapas 1 a 4 (P0/P1 financieros)
- BUG-01 (P0) timbrado: `facturapi-emitir` ya no manda conceptos en papelera (`deleted_at IS NULL`), rechaza facturas sin conceptos vigentes y valida que la suma de conceptos cuadre (±$1) con el subtotal de la cabecera antes de timbrar.
- BUG-02 CxP: `reemplazar_conceptos_factura_proveedor` recalcula subtotal/IVA/retenciones/total de la cabecera.
- BUG-04 CxC: `saldo_factura` convierte las notas de crédito a la moneda de la factura con la cascada CFDI > DOF > TC del embarque + guard `trg_nc_cliente_moneda_convertible`.
- BUG-05 embarques: un embarque `Cerrado` no puede pasar directo a `Cancelado` (`transicion_embarque_valida`).
- BUG-06 CxP: cancelar una factura de proveedor exige rol financiero (admin, admin_org, contador, auxiliar_contable, tesorero o super_admin). El candado vive en el trigger `trg_cxp_cancelacion_rol_financiero` sobre `proveedor_facturas`, no dentro de la RPC, para ser independiente del orden de migraciones y cubrir cualquier ruta de actualización.
- BUG-07 tesorería: `eliminar_pago_proveedor` revierte también las aplicaciones de anticipo, liberando el saldo del anticipo.
- BUG-08 refacturación: `duplicar_factura_para_refacturacion` toma el TC DOF vigente a la fecha de emisión en vez de heredar el TC original.
- EC-01 comisiones: el filtro de periodo se resuelve en la base (rango CDMX) antes del tope de 500 filas; los meses anteriores ya no aparecían vacíos.
- Espejos de esquema actualizados en `supabase/schema/` (cxp, facturacion, embarques y nuevo `tesoreria/eliminar_pago_proveedor.sql`).

## [13.645.3] - 2026-08-17

### Corrección CI
- Power of 10: `src/lib/access/roleRouteMatrix.ts` (207 líneas) se divide en `roleRouteSets.ts` (conjuntos de roles y listas de rutas libres/plataforma) + la matriz y `hasRouteAccess`; se re-exporta todo para no romper imports existentes.
- knip strict: se elimina código muerto (13 exports y 5 tipos sin uso) en CRM (`AVANCE_VACIO`, hooks/servicios de embudo y avance de actividad, `IcpEstatus`), CxP (`detallesPagoEliminado`, re-exports `validar*`, `EliminarPagoProveedorResult`), facturación (`eliminarMovimientoBancarioCobro`, re-exports de bandejas, `EliminarPagoResult`) y el export `default` duplicado de `AyudaPublicShell` + `Ayuda` en `appRoutes.lazy.ts`.

## [13.645.2] - 2026-08-17

### Corrección (Sentry JAVASCRIPT-REACT-5B)
- Descargar PDF/XML de un CFDI ya no devuelve 403 "forbidden" a roles operativos: nueva lista `ROLES_DESCARGA_CFDI` en `supabase/functions/_shared/auth.ts` (consulta fiscal + operador, coordinador_logistico, gerente_operaciones, gerente_visor), alineada con `FACTURACION_ROLES` de la UI. `facturapi-descargar` redeployada.

## [13.645.1] - 2026-08-17

### Corrección CI
- `PagosProgramadosTablas.tsx` agregado a la allowlist de `@/components/ui/table` (test de arquitectura + `eslint.config.js`): usa `<DataTable />` y sólo compone el pie de totales.

## [13.645.0] - 2026-08-17

### Parche 25 · Decisiones de producto (VT-10, VF-21, VF-20)
- VT-10: el centro de ayuda `/ayuda` ahora es una ruta pública (nuevo `AyudaPublicShell` con cabecera mínima y enlace "Iniciar sesión"); el contenido del FAQ no cambia.
- VF-21: `/crm/forecast` redirige a `/crm/analitica` (vista canónica) sin el query legacy `?tab=forecast`.
- VF-20: el rol `vendedor` accede a `/proformas` y su detalle en SÓLO LECTURA. Nueva migración que añade `vendedor` a la policy de lectura de `proformas`; write/update/delete intactas. Nuevo `PROFORMAS_ESCRITURA` + `canEditarProforma` ocultan "Enviar al cliente" a roles sin escritura.

## [13.644.1] - 2026-08-17
- Oportunidades: el aviso de lista truncada usa el token semántico `text-warning` en lugar del literal `text-amber-600` (corrige la prueba de arquitectura de literales de color en CI).



## [13.644.0] - 2026-08-17

### Parche 22 · Reportes, portal y tesorería
- Bandeja "Por emitir" de proformas: empty state específico ("Ninguna proforma aceptada pendiente de emitir").
- Gráfica top clientes: eje Y más ancho (labels de 30 chars) y empty state cuando toda la utilidad del periodo es $0.
- Margen 0% sin venta se muestra en badge neutral, ya no en rojo.
- Portal: "Embarques activos" excluye Entregado, cotizaciones sin desglose muestran "Total cotizado" y el banner de rechazo incluye mailto de contacto.
- Tesorería: el footer de pagos programados se renderiza en `<tfoot>` (fondo al 100%) y el folio ya no se parte en dos líneas.

### Parche 23 · Datos y sitio público
- Nueva migración `20260825001100_normalizar_razon_social_unicode`: `_normalizar_razon_social()` hace mayúsculas Unicode (collation ICU con fallback a `upper()`), evitando "BAJíO"/"PACíFICO" a futuro. Test SQL + test TS anti-mojibake.
- Landing: KPI "3 minutos", badge de video "1:00" (antes "0:60") y "6 módulos" (antes 11).
- Tesorería: se quita el sufijo "(USD)" redundante tras montos ya formateados con moneda.
- Términos y condiciones: la fecha de última actualización sólo aparece cuando el contenido legal está aprobado.

### Parche 24 · Copy y dedupe de componentes
- `MobileFilterSheet` renombrado a `PortalFilterSheet` (uso exclusivo del portal) junto con su prueba y los tres call-sites.
- Copy en mayúscula tipo oración en CTAs y wizards: "Nuevo embarque", "Nueva cotización", etc.

## [13.643.0] - 2026-08-17

### Parche 20 · Wizard de cotización (VF-09, VF-10, VF-16, VF-18, VF-19, VB-34)
- Validación inline en el Paso 1: los campos que rechaza el esquema del borrador (modo, tipo, incoterm, descripción, origen, destino, cliente) se marcan en rojo al guardar y se limpian al corregir.
- Tokens de campo compartidos: los controles con `aria-invalid` se dibujan con borde/anillo destructivo.
- Checklist lateral del Paso 1 indica qué secciones faltan; "Validez de la propuesta" ahora lleva asterisco (bloquea en marítimo).
- KPI del listado renombrado a "Total cotizaciones (30 días)" con nota de que no depende de los filtros de la tabla.
- El subtexto "Vencida" sólo aparece en estados accionables (enviada/aceptada), ya no en "En operación".
- `campoParaErrorPaso1` queda con una sola implementación (`scrollToErrorSection`), reexportada desde `handlePaso1Crm`.

### Parche 21 · Formato en ventas y finanzas
- Copy en mayúscula tipo oración en el menú lateral (Panel admin, Comparador top 3, Navieras (condiciones)).
- Números alineados (`tabular-nums`) en columnas y gráficas de cotizaciones, compras, facturación y Kanban CRM.
- Etiquetas de meses de proyección de cierre en zona México (`ymMx`).
- KPIs de cotizaciones extraídos a `CotizacionesKpis.tsx` para mantener la regla de 200 líneas.

## [13.642.2] - 2026-08-17
- CI: agregados mensajes amigables para 7 códigos `LC_*` de idempotencia/candados de pagos (BL02–BL15) en `lcCodeMessages.tesoreria.ts`.
- CI: pruebas de `AuthContext` envueltas en `QueryClientProvider` (el provider usa `useQueryClient` para la purga EC-01).
- CI: ajustada la prueba de `useUpdateCotizacion` al comportamiento `silent` introducido en 13.632.0.

## [13.642.1] - 2026-08-17

### CI · suite RLS `soft_delete_reportes`
- **fix(tests):** la fixture sembraba la factura de proveedor ya con `deleted_at` y luego intentaba registrarle un pago, pero el guard `guard_pago_proveedor` (parche 8) rechaza pagos a documentos en papelera (`LC_PAGO_PROV_FACTURA_NO_VIVA`), tumbando el grupo `financiero` completo. Ahora la factura nace viva, se registra el pago y se borra después — el orden real del negocio. Verificado en Postgres local con las 7 suites del grupo en verde.

## [13.642.0] - 2026-08-17

### Formatos, sidebar y navegación (Parches 17, 18 y 19)
- **Parche 17 (formatos):** nuevo formateador compartido `formatFechaHoraCorta` ("DD/MM/YYYY, HH:mm", 24 h, TZ_MX) usado en /auditoria (VB-12); vigencias de costeo con año completo (VB-38); constante compartida `PLACEHOLDER_VACIO` ("—") aplicada en embarques, BL Master, contenedor y dashboard (VB-20, VB-30); buscador de embarques más ancho para no truncar el placeholder (VB-29); icono de la alerta de login centrado verticalmente (VB-17).
- **Parche 18 (sidebar, /usuarios y /configuracion):** el listado de usuarios devuelve `full_name` y lo usa como respaldo cuando el directorio no responde, con estado "Sin datos" (VB-15); contador "N activos" en vez de "N roles" (VB-16); el badge rojo de Embarques explica cuántos requieren atención (VB-19); encabezado "Datos de la Empresa" con icono, igual que "Organización" (VB-22); versión del pie del menú copiable con tooltip (VB-25); nombre del usuario en el menú lateral y portales (VB-42).
- **Parche 19 (navegación y tesorería):** `PaginationControls` con `hideWhenSinglePage` para ocultar controles inútiles en Bitácora (VB-23); breadcrumb con raíz "Inicio" en pantallas de primer nivel (VB-24); banner explicativo al redirigir /embarques/nuevo a Cotizaciones (VB-36, extraído a `CotizacionesBannerOrigen`); columnas del libro de pagos con encabezados y tipo legible (VT-13).
- **Nota:** el fix VT-12 (columna "Neto" con encabezado en "Flujo esperado 30 días") ya estaba aplicado en el código, por lo que se omitió ese trozo del parche 19.

## [13.641.1] - 2026-08-17

### Correcciones
- **Pruebas SQL (CI):** los expedientes sembrados en `comision_cobrado_mxn.sql`, `ola4_n41_n44_n45.sql` y `ola4_n24_n27.sql` no cumplían el check `embarques_expediente_formato_valido` (`EL` + 3 letras + dígitos), lo que abortaba las suites financieras. Se renombraron a expedientes válidos (`ELOBL0101`, `ELOLA4441`, `ELNVA2401`, etc.).

## [13.641.0] - 2026-08-17

### Design system, layout y copy de backoffice (Parches 14, 15 y 16)
- **Parche 14 (adopción del design system):** estados de error con botón "Reintentar" en 36 rutas que antes mostraban un "sin datos" engañoso al fallar la carga; nuevo `Spinner` con escala fija (inline/block/page) y normalización de spinners fuera de escala; KPIs con token `text-kpi`; sombras de marca (`shadow-overlay`/`shadow-raised`); `transition-all` reemplazado por transiciones dirigidas en 14 archivos de features.
- **Parche 15 (layouts):** card "Gastos fijos cubiertos" ya no se corta a <1536px; card "Riesgo financiero pendiente" compacta cuando no hay fugas; "Margen por modo" muestra "—" y "Sin operaciones en el mes" en lugar de 0.0%; "Desempeño por operador" omite la gráfica apilada con un solo operador; scrollbar fino visible en tabs de embarque y menú lateral.
- **Parche 16 (copy es-MX):** "Sentry" → "Monitoreo"; pantalla "Sin acceso" sin ruta cruda y con mensaje correcto para secciones internas de Libre Carga; "cuenta tenant" → "organización" y plan capitalizado; filtros de costeo "Aprobación:"/"Contenedor:"; Papelera sin "(soft delete)"; banner Incoterm sin espacio antes de ":".
- Ajustes de integración: imports de `ErrorState` en 5 rutas, resolución manual de los conflictos de `AppSidebar.tsx` y `SinAccesoContent.tsx`, y prueba de `InvitarAgenteCredencialesView` acotada al botón de cierre del footer.

## [13.640.2] - 2026-08-17

### Corrección de CI (auditorías de migraciones)
- H6: `avanzar_estado_embarque` se recreaba sin permisos explícitos en `20260817160935_*.sql` y `20260825000800_bl16_*.sql`; se agregaron `REVOKE ALL ... FROM PUBLIC/anon` y `GRANT EXECUTE` a `authenticated`/`service_role`.
- Replay: la migración `20260821030800_ola11_lotes_paridad.sql` perdía el orden determinista de locks de `registrar_pago_cliente_lote` (riesgo de deadlock en cobros en lote concurrentes). Se re-emitió el espejo canónico en `20260825001000_bl18_cobro_lote_locks_deterministas.sql` y se borraron 2 entradas muertas del baseline (`cancelar_factura_proveedor`, `portal_obtener_proforma_por_token`).
- Manifest: se regeneró `migration-manifest.json` con las 25 migraciones faltantes.


## [13.640.1] - 2026-08-17

### Corrección de CI (drift radar)
- La migración `20260825000200_bl03_cxp_factura_cancelada_guards.sql` no cerraba con `;` el cuerpo de `cancelar_factura_proveedor`, así que el `REVOKE` siguiente se leía como parte de la función y la migración no aplicaba en una base limpia (`syntax error at or near "REVOKE"`). Se agregó el punto y coma en la migración y en su espejo `supabase/schema/cxp/cancelar_factura_proveedor.sql`.

## [13.640.0] - 2026-08-17

### Formularios, design system y accesibilidad (Patches 11, 12 y 13)
- EC-11: los importes distinguen `0` de vacío; rangos de fecha invertidos en reportes se auto-corrigen; "Por cobrar" incluye facturas sin vencimiento; se descartan borradores de cotización con fecha futura.
- Design system: `getEstadoColor` queda deprecado con guardrail de ESLint, se unifica `.text-overline` y se prohíben tipografías y z-index arbitrarios.
- Accesibilidad: filas clicables responden a Enter/Espacio, `aria-label` en es-MX para inputs y botones sin texto, y estados vacíos responsivos.
- Complejidad: el esquema de factura de proveedor se divide en validadores (`validarObligatorios`, `validarImportes`, `validarFechas`, `validarTipoCambio`) y `TabVsReal` extrae `VsRealCuerpo`.
- Pruebas: `CambiarPasswordDialog` limpia el dedupe de toasts entre casos (`resetToastDedupeState`).

## [13.639.0] - 2026-08-17

### Listados, búsqueda y validaciones (Patches 9 y 10)
- EC-03/EC-04: la bandeja "Por enviar" pagina la consulta de `factura_envios` con `.range()` (helper `fetchIdsConEnvioExitoso`); las facturas ya enviadas dejan de reaparecer y los conteos usan facturas distintas enviadas.
- EC-05: `GlobalSearch` descarta respuestas fuera de orden con un token por request; el término viejo ya no sobrescribe al actual.
- EC-14: la búsqueda de CRM propaga errores de sus sub-consultas para mostrar estado de falla en vez de "sin resultados".
- EC-16: nueva migración que agrega tie-breaker `id DESC` a los `ORDER BY` de `embarques_listado`; el export deduplica por `id` entre páginas.
- EC-17: nuevo helper `warnIfTruncated` avisa cuando un listado se corta por límite (facturas por timbrar/por enviar, catálogos, oportunidades).
- EC-06: `sanitizeMoneyText` trata "50.000" como 50 mil (punto seguido de exactamente 3 dígitos = miles).
- EC-08: anticipos con topes de monto (1e9), máximo 2 decimales, `TC_MAX` compartido y validación de fecha real (2000–2100).
- EC-09: la probabilidad de oportunidad CRM se acota a 0–100 en el formulario y en `buildOportunidadInsertPayload`.
- EC-10: `DialogSeguroForm` rechaza suma asegurada y deducible negativos; en altas exige suma asegurada mayor a 0.
- EC-18: `diasCredito` de factura de proveedor entero 0–365 y aviso si el vencimiento queda a más de 366 días de la emisión.
- EC-20: planes, seguridad global y tabulador de demoras de venta validan rangos con zod antes de guardar.

## [13.638.0] - 2026-08-17

### Precisión en pagos, idempotencia y candados (Patch 8)
- BL-12: los totales de conceptos de venta, cotizaciones (USD y MXN) y la suma de venta del P&L usan el canon `subtotalLinea`/`sumarSubtotales`; se elimina el drift de centavos entre UI y `numeric` de Postgres.
- BL-14: `pagos_factura` y `pagos_proveedor` reciben `client_request_id uuid` con índice UNIQUE parcial; los diálogos de cobro (CxC) y pago (CxP) generan un UUID por apertura, de modo que un doble submit o reintento de red choca con 23505 traducido como pago duplicado.
- BL-15: `guard_pago_proveedor` calcula la diferencia cambiaria también en el cruce pago USD → factura MXN (`monto × (TC_pago − TC_factura)`); `traducirErrorPagoProveedor` explica el cruce EUR no soportado (`LC_PAGO_CRUCE_NO_SOPORTADO`).
- BL-16: `avanzar_estado_embarque` filtra `deleted_at IS NULL`; un embarque en papelera ya no avanza de estado ni consume folio de expediente.
- BL-17(b): la nota "Tipos de cambio del embarque incompletos" de `calcular_comision_pago` se condiciona a las monedas realmente presentes en los conceptos (`v_req_usd`/`v_req_eur`), sin falsos positivos en embarques USD-only.
- EC-12: el prellenado de pago de saldo total (CxC y CxP) redondea hacia arriba al centavo para saldar la factura; un residuo `0 < saldo ≤ 0.01` devuelve un error que dirige a «Cerrar sin pago» en vez de dejar la factura abierta en aging.


## [13.637.0] - 2026-08-17

### Reportes monetarios, EERR y portal público (Patch 7)
- BL-06: el Estado de Resultados devengado suma **subtotales** (sin IVA) de facturas de venta y de proveedor, alineado con la fuente por conceptos.
- BL-07: Presupuesto vs Real usa subtotales, descuenta notas de crédito de proveedor **Aplicadas** y avisa cuando el real alcanzó el límite de filas consultadas (`real_truncado`).
- BL-09: `cerrar_embarque` recalcula las comisiones devengadas con nota de pendiente antes de marcarlas definitivas; un fallo individual deja WARNING y no aborta el cierre (`comisiones_recalculadas` en la respuesta).
- BL-10: las notas de crédito del EERR devengado se ubican por `fecha_emision` (no por `updated_at`), sin reconocimiento retroactivo ni frontera UTC.
- BL-11: `portal_obtener_proforma_por_token` con liga expirada o respondida ya no expone montos, conceptos ni datos del cliente; el portal muestra sólo el estado.
- BL-13: `registrar_pago_cliente_lote` toma los locks `FOR UPDATE` ordenados por `factura_id`, eliminando el deadlock 40P01 entre lotes concurrentes.
- Residual documentado: las notas de crédito (cliente y proveedor) se descuentan con IVA por falta de columna subtotal; el EERR devengado aún no descuenta NCs de proveedor.


## [13.636.0] - 2026-08-17

### Dinero, CxP y comisiones (Patch 6)
- BL-01: `calcular_comision_pago` ahora valúa el monto cobrado en MXN desde la moneda de la **factura** con el tipo de cambio del documento (antes inflaba hasta ~19x en 3 de 4 cruces de moneda).
- BL-02: `registrar_pago_proveedor_lote` acepta `request_id` e idempotencia; un doble envío ya no duplica lote, pagos ni el cargo bancario conciliado.
- BL-03: una factura de proveedor **Cancelada** o en papelera ya no admite pagos (individual y lote) ni anticipos; al cancelar, `estado_aprobacion` vuelve a `pendiente`.
- BL-04: nueva función `saldo_cuenta_bancaria()` con el canon de saldo (ignora movimientos borrados y previos a `fecha_saldo_inicial`); `ejecutar_pago_programado` la usa y acepta `p_request_id`.
- BL-05: índice único `uq_liquidaciones_comision_org_vendedora_periodo` + `p_request_id` en `generar_liquidacion_comision`; la UI de Comisiones muestra un mensaje claro ante duplicado (23505).
- BL-08: `aplicar_anticipo_a_factura` acepta `p_request_id` y devuelve la aplicación original en un reintento.

## [13.635.1] - 2026-08-17

### Correcciones
- CxP: el modal "Editar conceptos" ya no provoca un bucle de re-render ("Maximum update depth exceeded") al abrir la pestaña Conceptos de una factura capturada a mano. `useConceptosManuales` ahora memoiza el objeto que devuelve y `limpiar()` no crea un arreglo nuevo cuando ya está vacío.
- Se corrige un comentario en `src/index.css` que rompía el build de CSS.

## [13.635.0] - 2026-08-17

### Visual y sistema de diseño (Patch 5)
- UX-01: tokens de estado (`--warning`, `--success`, `--state-llegada`, `--state-cerrado`, `--aging-1`, `--aging-2`) oscurecidos en modo claro para cumplir contraste WCAG AA (≥4.5:1) tanto sobre fondo blanco como sobre su fondo suave /15.
- UX-05: scroll horizontal (`overflow-x-auto`) en 10 tablas sin contenedor (Tesorería, Presupuesto, Dashboard ejecutivo, CRM, Comisiones, Diagnóstico, Conciliación de compras).
- VB-05: estado vacío en la gráfica de margen de 6 meses (Dirección) en lugar de ejes sin datos. VB-13 ya estaba cubierto.
- VT-18: `DataTable` ya no muestra el encabezado cuando no hay filas y no está cargando (portal de documentos, embarques de agente, comisiones).
- VB-41: punto indicador de alertas sobre el icono cuando el sidebar está colapsado.
- UX-26 / UX-25: la ruta `/dev/pdf-preview/cotizacion/:id` sólo existe en desarrollo, se elimina `public/placeholder.svg` y `theme-color` ahora responde a `prefers-color-scheme`.

## [13.634.0] - 2026-08-17

### Copy e idioma es-MX (Patch 4)
- VF-06 / VT-21 / VF-24: anglicismos fuera de la interfaz — "Plataforma para agentes de carga" (sidebar), "Mis oportunidades" (CRM), "Costos y utilidad" y "Cotización del cliente" (wizard), "Panel fiscal" (Facturación), "Venta/Utilidad total USD" y "Top por utilidad" (Reportes), "Utilidad total" (PDF de rentabilidad) y pestaña "Utilidad" en el detalle de embarque. Se conservan ids lógicos (`mis-deals`, `value="pnl"`).
- VF-08: se elimina el sufijo condicional que generaba "Usar esta tarifa esta" / "Elegir esta esta" en las tarjetas de tarifa; "Close" → "Cerrar" en diálogos y sheets (sr-only).
- VB-06 / VT-16: `document.title` por ruta en Panel, Configuración, Auditoría operativa, Bitácora, Portal agente y Mi perfil.
- VB-37: descripciones de Costeo sin geografía hardcodeada (rutas y matriz de tarifas).
- VT-29: pluralización correcta con `pluralizar()` en el estado de cuenta del portal y en Presupuesto vs Real.
- VT-15: breadcrumbs con etiquetas para Conciliación, Estado de cuenta, Pagos y Pagos programados.

## [13.633.0] - 2026-08-17

### Formatos de moneda y fecha (Patch 3)
- VB-04 / VF-11 / VB-28: se elimina el código de moneda duplicado en Totales del periodo (Dirección), columna Total del aging CxP y KPI de Operaciones (label "Profit").
- VT-08: el encabezado de Tesorería muestra la fecha de corte con día y mes de 2 dígitos (17/08/2026).
- VT-27: la línea de tiempo del portal ya no muestra "00:00" en hitos de fecha pura.
- UX-12: montos con separador de miles en el resumen de conceptos de auditoría y en la nota de flete LCL manual.
- Se omite el FIX 2 del parche (signo antes del código ISO): el formateador global ya normaliza a "MXN -33,060.00" (decisión B-053) y aplicarlo sólo en Tesorería crearía dos formatos distintos. El FIX 3 (selector de mes) ya estaba corregido.



## [13.632.0] - 2026-08-17

### UX de feedback y errores (Patch 2)
- VB-33: un solo toast al guardar en el wizard de cotización (los hooks de crear/actualizar pasan a `silent`).
- VT-03: la ruta pública "/" ya no manda a `/sin-acceso` cuando el perfil falla por red; se muestra la landing.
- VT-02: `DialogContent` acepta `overlayClassName` y el diálogo "Detalles del error" sube a `z-[70]`, por encima de los toasts encolados.
- VB-35: `offset.top` del Toaster de 72px a 112px para no tapar el indicador de pasos de los wizards.



## [13.631.1] - 2026-08-17

### Seguridad (Patch 1)
- EC-01: `signOut` y el cambio de usuario en la misma pestaña ahora purgan todo el caché de consultas (`purgeSessionCache.ts`), cerrando la fuga cross-tenant.
- EC-07: el exportador CSV neutraliza fórmulas (`= + - @`, tab/CR) sin alterar montos negativos.
- EC-02: paginación estable en leads, actividades y oportunidades del CRM (desempate por `id`).
- Prueba SQL de regresión `test_puede_escribir_cotizaciones_vendedor.sql` (VF-03, ya aplicado en la base).



## [13.631.0] - 2026-08-17

### Oleada 0 (bloqueantes de la auditoría v13.627.1)
- Purga de caché de sesión al cerrar sesión / cambiar de usuario (`purgeSessionCache.ts`), elimina la fuga de datos cross-tenant.
- `public.puede_escribir_cotizaciones()` incluye al rol `vendedor` (fin del error 42501 al cotizar).

### Oleada 1 (pulido visual y UX)
- Contraste WCAG AA en tokens de estado, éxito, advertencia y buckets de aging.
- Copy en español y typos corregidos en 8 componentes clave.
- Formato de fechas y moneda unificado (`formatCurrency`, etiquetas de mes sin desfase de zona horaria).
- Toasts de error con ancho mínimo, rejilla consistente, deduplicación y "Ver detalles" sólo cuando hay detalle.
- Validación inline en el Paso 1 del wizard de cotización con scroll y foco al campo con falla.
- Gráficas con estado vacío y unidad "MXN" una sola vez; columna "Neto" propia en flujo por monedas.
- Sidebar: indicador de alertas en modo colapsado y scroll correcto en pantallas de 1080 px.
- Tarjetas y filas clicables operables con teclado (`activableConTeclado`), más `aria-label` en botones de ícono.

## [13.630.0] - 2026-08-17
- CRM Ola A (higiene): al mover una oportunidad a una etapa de pérdida ahora se pide obligatoriamente el motivo (con detalle opcional); la base de datos también lo exige, así no quedan pérdidas sin explicación.
- Importación de leads desde CSV: detecta duplicados contra la cartera existente y dentro del propio archivo (por correo, teléfono a 10 dígitos y razón social normalizada). Los duplicados seguros se omiten y se avisa de los posibles.
- Alta manual de lead: aviso en vivo si el prospecto ya existe, indicando con qué empresa/contacto coincide.

## [13.629.1] - 2026-08-17
- CI verde: mensajes en español para 7 códigos de error (conceptos fiscales, factura con pagos, cancelada, permisos de margen, oportunidad inexistente), avisos de error en los criterios de salida del CRM y migraciones del CRM endurecidas (índices/políticas idempotentes y permisos de las funciones internas).
- Se simplificaron internamente la tarjeta del Kanban, el detalle de oportunidad y el alta de oportunidad (sin cambios visibles) para respetar los límites de complejidad del proyecto.

## [13.629.0] - 2026-08-17
- Modal "Editar conceptos" de facturas de proveedor rediseñado: tabla con encabezados (Descripción, Cantidad, Precio, IVA, Unidad, Total línea), total por renglón en la misma fila y estado vacío con guía cuando no hay partidas.
- Semáforo de cuadre en el encabezado del modal: "Cuadrado" en verde o "Faltan/Sobran $X" en ámbar, con la suma de líneas y el subtotal siempre visibles.
- Nuevas ayudas de captura: duplicar línea, botón para calcular IVA 16% de la línea, formateo de importes al salir del campo, Enter para agregar otra partida y acción "Ajustar última línea" para cerrar la diferencia contra el subtotal.
- Se resalta el renglón sospechoso (el de mayor importe) cuando la suma no cuadra. Las mismas mejoras aplican al modal de captura de factura de proveedor.

## [13.628.1] - 2026-08-16
- Se pulió el modal "Editar conceptos" de facturas de proveedor: encabezados de columna (Descripción, Cantidad, Precio unitario, IVA, Unidad), campos con ancho legible (ya no se corta "Unidad"), cada partida en su propia tarjeta con su total de línea alineado y el resumen Suma/Subtotal compacto para que los botones no se desacomoden.

## [13.628.0] - 2026-08-16
- Ya se pueden corregir los conceptos de una factura de proveedor **capturada a mano**: botón "Editar conceptos" en la pestaña Conceptos del detalle, con la misma captura del modal de alta y aviso de descuadre contra el subtotal.
- El botón se deshabilita con explicación cuando la factura vino de un CFDI (XML/UUID), está cancelada o ya tiene pagos aplicados.
- Si la factura estaba aprobada, al reemplazar los conceptos regresa a "Por aprobar" y se limpia el sello de aprobación. Todo cambio queda en la bitácora.

## [13.627.1] - 2026-08-16
- Seguridad: se revocó el acceso público a las funciones internas de disparador del CRM (cambio de etapa y toque de oportunidad); ahora sólo el sistema y usuarios autenticados pueden ejecutarlas.


## [13.627.0] - 2026-08-16
- Mapeo del CRM comercial (Excel Hunter) al ERP: los leads ya guardan cargo del contacto, origen y destino dentro del perfil ICP.
- Cada oportunidad admite margen esperado (%) y riesgos u objeciones; el detalle muestra una tarjeta "Margen y riesgo" donde gerencia comercial o administración autorizan el margen, con sello de quién y cuándo.
- Las etapas del pipeline permiten definir sus días de SLA y la Higiene del pipeline los usa para marcar oportunidades estancadas.
- La tabla de oportunidades suma la columna "Siguiente actividad" con el pendiente más próximo, igual que el archivo del equipo comercial.

## [13.626.0] - 2026-08-16
- El embudo de oportunidades ahora tiene criterios de salida por etapa: se configuran en Configuración del CRM y aparecen como checklist en el detalle de cada oportunidad, con avance visible en su tarjeta del Kanban.
- Al mover una oportunidad de etapa con criterios pendientes se muestra un aviso (no bloquea) indicando cuántos faltan y si alguno es obligatorio.
- Cada oportunidad admite meta de monto, fecha meta de cierre y nota de compromiso; el Kanban muestra el avance vs meta, marca las metas vencidas y suma por columna estimado, meta y ponderado.
- Nueva franja de resumen del pipeline con total estimado, meta y ponderado por probabilidad.



## [13.625.0] - 2026-08-16
- CRM Hunter (Etapas 1-3): el perfil ICP del lead ahora se captura desde su ficha con barra de avance, y el módulo suma una pestaña nueva de "Higiene" con semáforo de oportunidades estancadas y cobertura de pipeline vs presupuesto.
- Configuración del CRM incorpora el presupuesto comercial mensual y las metas de actividad por periodo (ICP validados, empresas contactadas, reuniones y cotizaciones).
- Al registrar una actividad ya se puede marcar si fue "contacto efectivo" y si la reunión fue "calificada", para medir calidad y no sólo volumen.

## [13.624.7] - 2026-08-16
- Se eliminó un cast innecesario en las acciones de proforma: el estado de autorización del cliente ya viene tipado desde la base de datos. Sin cambios funcionales.

## [13.624.6] - 2026-08-15
- El servicio de tipo de cambio (DOF) ya no puede responder con error 500: cualquier falla inesperada se reporta a Sentry y devuelve el contrato normal marcado como "fallback", que los flujos fiscales siguen rechazando. Antes, un error fuera del bloque protegido dejaba a facturas, notas de crédito y pagos sin respuesta.

## [13.624.5] - 2026-08-15
- Prueba de guardrail del ciclo de cotización actualizada: ahora reconoce la bandera "Re-cotizar" declarada dentro del objeto de visibilidad tras la modularización. Sin cambios funcionales.


## [13.624.4] - 2026-08-14
- Auditoría de migraciones al día: los permisos de la función que acepta versiones de cotización quedaron re-aplicados por migración correctiva y el baseline de la auditoría se movió a esa migración (FIX-H6-20).

## [13.624.3] - 2026-08-14
- Corregidas las fallas de CI que dejó "Clientes de casa": permisos restrictivos en la función de aceptar versión de cotización, manifiesto de base de datos sincronizado, y separación de archivos grandes (proformas, cotizaciones y Editar cliente) para cumplir los límites de complejidad y tamaño.
- La consulta de la política de autorización del cliente se movió a un servicio dedicado, respetando la arquitectura del proyecto. Sin cambios visibles para el usuario.

## [13.624.2] - 2026-08-14
- Corregidas dos fallas de CI: el aviso de descuadre en conceptos de factura ahora usa el token semántico de advertencia (sin colores fijos) y se renombró un título de prueba duplicado.

## [13.624.1] - 2026-08-14
- Corregido el "parpadeo" al guardar en Editar cliente: los interruptores de autorización ya no se ven regresar a encendidos (el dato siempre se guardó bien; era el formulario que se repintaba con la versión anterior antes de cerrarse).
- La ficha del cliente ahora muestra la etiqueta "Cliente de casa" cuando no requiere autorizar cotizaciones ni proformas, y etiquetas individuales si sólo una de las dos está apagada.

## [13.624.0] - 2026-08-14
- Nuevo interruptor por cliente: "Requiere autorizar cotizaciones" y "Requiere autorizar proformas" (en Editar cliente). Para los clientes de casa se pueden apagar y así agilizar la operación; sólo administración o gerencia comercial puede cambiar esta política.
- Cotizaciones de clientes de casa: se pueden aceptar/rechazar directamente desde Borrador o Solicitada (antes había que enviarlas primero). Se muestra la etiqueta "Cliente de casa" y sigue vigente la regla de que quien la creó no la puede aceptar.
- Proformas de clientes de casa: nuevo botón "Aprobar internamente" que las marca como aceptadas en un clic para poder facturarlas, dejando registro en la bitácora.
- Los clientes nuevos siguen requiriendo autorización por omisión (no cambia nada para el resto de la cartera).

## [13.623.1] - 2026-08-14
- Al intentar pasar un embarque a "Confirmado" sin los datos mínimos (peso, naviera, contenedores, etc.) ya no aparece un toast rojo de error con "Ver detalles"/requestId: ahora es un aviso informativo "Aún falta información para confirmar" con la lista de campos por capturar. El embarque sigue sin avanzar hasta completarlos.

## [13.623.0] - 2026-08-14
- Conceptos de factura de proveedor con formato de invoice: nueva columna "Total" por línea (total línea + IVA + IEPS), pie de tabla que suma todas las columnas y caja de totales a la derecha (Subtotal → IVA → IEPS → Retenciones → TOTAL) en la moneda del documento.
- Si el total de la factura no coincide con la suma de los conceptos (descuentos o conceptos faltantes en el CFDI) se muestra un aviso con la diferencia.
- Las descripciones largas ya no se cortan a una línea (hasta dos líneas, con tooltip) y la tabla conserva scroll horizontal propio.
- Mismo tratamiento en la vista previa de conceptos del CFDI al capturar la factura. Nuevas funciones puras `calcularResumenConceptos` / `totalLineaConImpuestos` con pruebas unitarias.


## [13.622.0] - 2026-08-14
- Modal "Aplicar anticipo a esta factura": ahora muestra el desglose completo de la factura (subtotal, IVA, IEPS, retenciones, total, ya pagado, notas de crédito y saldo por pagar) junto al desglose del anticipo (monto, ya aplicado, disponible, monto a aplicar y saldo estimado después de aplicar). Antes sólo aparecía una cifra suelta en el encabezado, que se confundía con el subtotal sin IVA.
- El saldo restante se recalcula en vivo al teclear el monto y avisa si excede el saldo o si la factura queda cubierta; cuando el anticipo está en otra moneda el resultado se marca como referencial (el servidor convierte al T/C oficial).
- Nueva función pura `calcularSaldoDespuesDeAplicar` con pruebas unitarias.

## [13.621.0] - 2026-08-14
- Cruce anticipo ↔ factura de proveedor por embarque: al capturar la factura (buzón o manual) aparece un aviso no bloqueante cuando el expediente vinculado ya tiene anticipos con saldo a favor del mismo proveedor (`AvisoAnticipoEmbarque` + `useAnticiposDisponiblesPorEmbarque`). Sólo informa; no aplica nada automáticamente.
- Al aplicar un anticipo desde el detalle de la factura, los anticipos del mismo expediente se ofrecen primero y se marcan "Mismo expediente" (`ordenarAnticiposPorEmbarque`, función pura con pruebas).
- La tarjeta "Anticipos a proveedores de este embarque" (pestaña Costos) muestra cuánto de cada anticipo ya se cruzó con facturas del mismo embarque (`fetchAplicadoEnEmbarque`).
- Nuevo filtro "Sólo sin embarque" en /compras/anticipos para detectar anticipos que quedaron sin expediente. El vínculo con embarque sigue siendo opcional.

## [13.620.0] - 2026-08-14
- Bug corregido en captura desde el buzón CxP: la categoría contable no siempre quedaba en "Costo directo de embarque" (COGS). El candado se aplicaba una sola vez y la autocarga del CFDI/PDF reescribía el formulario con la categoría sugerida por la IA (o vacía), pisándolo.
- `useCategoriaCogsBuzon` ahora reconcilia de forma continua: mientras el contador no use "Cambiar categoría", cualquier reescritura del sistema vuelve a fijar COGS y el selector se mantiene bloqueado.


## [13.619.0] - 2026-08-14
- Buzón de facturas de proveedor: cada fila muestra el operador dueño del embarque (`· Op. Valeria Zamora`, derivado del correo con `nombreDesdeEmail`; correo completo en el tooltip) y "Op. sin asignar" cuando el embarque no tiene operador.
- `SELECT_COLS_ENTRANTES` trae `embarques.operador` y la búsqueda del buzón (`coincideBusquedaEntrante`) ya encuentra por operador, tanto por correo como por nombre.

## [13.618.0] - 2026-08-14
- Buzón CxP: las facturas sin XML (debit notes extranjeras) aparecían "sin importe" porque el buzón sólo leía `total_detectado` del CFDI e ignoraba el `monto_declarado` que captura operaciones. `importeEntrante()` ahora resuelve la cascada CFDI > declarado y la fila muestra el origen.
- El importe declarado es obligatorio para enviar al buzón (y al corregir): `useSubirEntranteForm` / `useCorregirEntranteForm` ya no habilitan el envío sin monto > 0.
- Nuevo atajo "Usar la suma de lo marcado" en `VerificacionMontoEntrante` para copiar la suma de los conceptos de costo seleccionados en la moneda elegida.
- Rezago actual: los documentos sin importe muestran chip ámbar con acción "Agregar importe" que abre `CorregirDatosEntranteDialog` directamente desde `/compras/buzon`.

## [13.617.0] - 2026-08-14
- Fix `LC_CXP_DESCUADRE` (caso FP-000140, AGUNSA L&D): con cantidades altas el precio unitario redondeado a 2 decimales (51 × 17.38 = 886.38 vs subtotal 886.34) rompía el cuadre y bloqueaba la aprobación por 4 centavos.
- `public._cxp_validar_aprobacion` ahora usa tolerancia `max(0.01, 0.005 × unidades)` en vez de un centavo fijo, y el mensaje del error incluye la tolerancia aplicada. Espejo en `supabase/schema/cxp/_cxp_validar_aprobacion.sql`.
- `cuadreConceptos.ts` replica la misma tolerancia (`toleranciaCuadre`) para que el semáforo de captura y la base coincidan.
- `parse-invoice-pdf`: cuando `unit_price × cantidad` no reproduce el total de la línea, el unitario se deriva del total (`amount / cantidad`) con 6 decimales, evitando el desfase de origen.
- Mensaje de `LC_CXP_DESCUADRE` más accionable (precio unitario, cantidades, partidas sobrantes).


## [13.616.3] - 2026-08-14
- Fix crítico: `src/constants/appVersion.ts` había quedado vacío, así que `APP_VERSION` era `undefined` y fallaban 3 shards de pruebas (`errorContextStore`, `reportCaughtError`, `exportOrg`) además de la telemetría de Sentry y los manifiestos de exportación. Restaurado.
- Power of 10: dividí `pagosProveedor.ts` (208 líneas) y `facturacion/services/pagos/index.ts` (202) extrayendo las bajas atómicas a `pagoProveedorEliminar.ts` y `pagos/eliminarPago.ts`.

## [13.616.2] - 2026-08-14
- CI verde: ESLint (complejidad 17 > 16) en `src/lib/errors/index.ts` y `facturapiError.ts` — extraje `leerCrudo()` y `armarDetalles()` sin cambiar comportamiento.
- Test `crmToast`: ahora tolera el `id` de dedupe que agregó la Ola 17 a `notifySuccess/notifyInfo`.
- H6: migración correctiva `FIX-H6-19` que re-aplica `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role` a las 6 RPCs de papelera/bitácora re-emitidas en la Ola 16; baseline del auditor movido con la nota correspondiente. Manifest sincronizado (948 migraciones).

## [13.616.1] - 2026-08-14
- CI: verdes las 5 suites RLS (aislamiento, financiero, operaciones, roles, costeo). Los fixtures asumían reglas ya endurecidas: `super_admin` con bypass global (Ola 16 lo acotó al tenant activo vía `set_super_admin_org`), el rol legacy `admin` en `user_roles`, un REP sobre factura sin UUID fiscal y columnas hoy NOT NULL (`app_logs.fn`, `pagos_factura.rep_cancellation_status`).
- `guard_cotizacion_vigencia.sql` ahora se ejecuta en el workflow `rls-tests` (antes existía pero nadie lo corría).

## [13.616.0] - 2026-08-14
- Fix: la vigencia de la cotización (detalle y PDF) ya respeta la fecha capturada en "Validez propuesta". Antes se calculaba sólo al crear (emisión + 15 días) y no se recalculaba al capturar la validez después, por lo que el PDF mostraba una fecha distinta (caso COT-2026-0174: 21/08 capturado vs 29/08 impreso).
- Nuevo trigger `public._cotizaciones_sync_vigencia`: si hay validez propuesta, ella define `fecha_vigencia` y `vigencia_dias` se deriva de la emisión; sin validez se mantiene el default de 15 días. Backfill de las 27 cotizaciones desalineadas.
- `vigenciaDias()` deja de usar `Date.now()` (el resultado cambiaba según la hora de captura) y se calcula contra el día local MX.
- El detalle ya no imprime "Validez propuesta" y "Vigencia" con fechas contradictorias.
- Test: `supabase/tests/guard_cotizacion_vigencia.sql`.



## [13.615.0] - 2026-08-14
- Ola 17 · Errores granulares: los fallos de base de datos ya se traducen a español por constraint y SQLSTATE (`23505` → "Ya existe un registro con este identificador", `23502` nombra el campo faltante, `22001` longitud, `22P02`/`22007` formato, `22003` límite numérico, `40001`/`40P01`/`57014` concurrencia y tiempo de espera).
- Nuevo catálogo `pgConstraintMessages.ts`: folios (FP-XXXXXX), RFC de cliente/proveedor, refacturación abierta y contacto principal duplicado tienen mensaje de negocio propio.
- Rechazos del SAT/FacturApi interpretados con `satErrorCodes.ts` + `facturapiError.ts` (301 XML mal formado, 402 RFC no inscrito en el padrón, etc.). El servicio de facturación ahora antepone el mensaje traducido y adjunta código, campo y `logId` como detalles copiables para soporte.
- Higiene de toasts: `notifySuccess`/`notifyWarning`/`notifyInfo` derivan un `id` estable, así el doble clic rápido ya no apila toasts duplicados.
- Se eliminó el último `console.error` huérfano en `src/features` (portal de proformas y baja de correos ahora reportan a Sentry con `reportCaughtError`), con guardrail `no-orphan-console-error.test.ts`.
- Mensajes amigables para `LC_ORG_FUERA_DE_SCOPE` y `LC_SOLO_SUPER_ADMIN` (cobertura LC_* en verde).
- Tests: `erroresGranulares.test.ts` (23 casos) + dedupe de toasts en `appFeedback.test.ts`.

## [13.614.0] - 2026-08-14
- Captura rápida de fechas con teclado numérico en los tres pickers (`DatePickerMx`, `DateTimePickerMx`, `MonthPickerMx`): salto discreto entre segmentos (## / ## / ####) sin abrir el calendario.
- Aceleradores: `T`/`H` = hoy (o mes en curso), `+`/`-` y flechas ajustan el segmento activo, `←`/`→` cambian de segmento, `Re Pág`/`Av Pág` mueven ±1 mes (con `Shift`, ±1 año), `F4` abre el calendario.
- `DateTimePickerMx` y `MonthPickerMx` dejan de ser sólo botón-popover: ahora se teclean (`DD/MM/AAAA HH:MM` y `MM/AAAA`) con máscara dirigida por dígitos.
- Aviso ámbar de día inhábil (no bloquea el guardado) con `avisarInhabil`: fines de semana y festivos oficiales calculados en código según art. 74 LFT, incluyendo transmisión de poder cada 6 años. Nuevo `src/lib/date/festivosMx.ts` y resaltado de días inhábiles en el calendario.
- Tests: `pickerMxCapturaTeclado.test.ts` (festivos, máscaras y parseo de periodo/fecha-hora).

## [13.613.0] - 2026-08-14
- Ola 16 · Vista previa del asistente de refacturación desacoplada de las cancelaciones pendientes del SAT: `refacturacion_simular_paso` ahora devuelve `pendientes[]` además de `bloqueos[]`.
- Nuevo helper `public._refact_reps_bloqueantes(uuid)`: criterio único (mismo que la UI) para distinguir un REP vivo sin solicitud (bloquea) de uno en verificación `pending`/`verifying` (pendiente).
- Paso 4 considera `facturas.cancellation_status`: `pending`/`verifying` → `LC_REFACT_ORIGINAL_EN_VERIFICACION` (pendiente); `rejected`/`expired` → `LC_REFACT_ORIGINAL_CANCELACION_RECHAZADA` (bloqueo). Paso 5 sigue bloqueando con cualquier REP vivo (evita reportar el depósito dos veces).
- UI: nuevo `RefacturacionPreviewCodigos.tsx` (rojo = bloqueo, ámbar = trámite en manos del SAT); el cliente tolera respuestas sin `pendientes`.
- Tests: 2 casos nuevos en `refacturacionSimulacion.test.ts` y T10-T12 en `supabase/tests/rls/test_rls_refacturaciones_matriz.sql`. Espejos en `supabase/schema/facturacion/` y manifest sincronizado (946 migraciones).

## [13.612.0] - 2026-08-14
- Ola 16 · Separación de planos plataforma / tenant: el Super Admin ya no ve datos mezclados de todas las organizaciones. Nueva política RESTRICTIVE `Scope tenant activo super admin` en las 86 tablas de negocio con `organization_id`, apoyada en `public.rls_tenant_scope_ok()` + `public.org_scope()`.
- Sin tenant seleccionado el Super Admin no ve ni escribe datos de negocio (fail-closed); con tenant seleccionado sólo ve ese tenant, aunque la consulta no filtre por organización.
- Plano PLATAFORMA intacto y explícito: `app_logs`, `nav_events`, `provisioning_log`, `role_change_log`, `super_admin_org_activa`, `organization_members`, `client_users`, `agente_users` y `facturapi_webhook_eventos` siguen siendo globales para la consola `/admin`.
- Papelera, bitácora de idempotencia y `restore_record` / `purge_record` / `soft_delete_record` re-emitidas con `org_scope()`: eluden RLS por ser SECURITY DEFINER, así que se acotaron a mano (`LC_ORG_FUERA_DE_SCOPE`).
- Nuevas RPC de telemetría de plataforma `fn_admin_platform_stats` y `fn_admin_org_counts` (fail-closed a super admin) usadas por `stats.ts`: los KPIs de `/admin` ya no leen las tablas de negocio directo.
- Guardrail de CI `tabla_negocio_sin_scope_tenant` en `scripts/db/integrity-guard.sql` + nueva suite `supabase/tests/rls/test_rls_super_admin_planos.sql` (registrada en el grupo `aislamiento`).

## [13.611.1] - 2026-08-14
- CI · Suites RLS `soft_delete_reportes` y `refacturaciones_matriz` en verde: los fixtures fallaban por reglas de negocio, no por los reportes.
- `soft_delete_reportes`: el proveedor ahora nace con categoría/tipo válidos, el embarque con `modo`/`tipo`, la factura de proveedor con categoría de presupuesto y aprobada, la nota de crédito avanza Borrador → Aprobada → Aplicada y el admin recibe su rol legacy (las políticas de SELECT lo exigen).
- `refacturaciones_matriz`: el caso de prueba del auxiliar contable usa una segunda factura, porque sólo puede haber un caso abierto por factura original.

## [13.611.0] - 2026-08-14
- Ola 15 · Eliminación de pagos atómica: nuevas RPC `public.eliminar_pago_cliente` y `public.eliminar_pago_proveedor` que hacen la baja del pago, la del movimiento bancario, el recálculo de costos y la bitácora en una sola transacción.
- Movimientos importados del estado de cuenta ya no se borran al eliminar un pago: se desvinculan y regresan a "Pendiente" de conciliar.
- Servicios `eliminarPagoFactura` y `eliminarPagoProveedor` migrados a las RPC (adiós a las 3 llamadas sueltas que podían dejar el banco descuadrado).
- Guardrail de integridad `movimiento_vivo_con_pago_eliminado` en `scripts/db/integrity-guard.sql`.

## [13.610.0] - 2026-08-14
- Ola 15 · T/C por fecha oficial: nuevo resolvedor `public.tc_para_documento(fecha, moneda, tc_doc, tc_emb)` y conversor `public.a_mxn_doc(...)` con la cascada CFDI → DOF de la fecha oficial → T/C del expediente.
- `pnl_financiero_embarque`: cada factura de cliente, factura de proveedor, concepto y seguro se valúa con su propio tipo de cambio; se agregan los metadatos `tc_por_documento` y `excluidos_sin_tc` (los renglones sin T/C resoluble ya no se valúan en cero).
- `eerr_resumen_anual`: facturas, facturas de proveedor y notas de crédito usan el T/C del comprobante o el DOF de su fecha; los expedientes sin T/C capturado toman el DOF de su ETA. Se agrega la columna `excluidos_sin_tc`.
- Nuevas RPC de apoyo: `backfill_tc_dof_documentos(_simulacion)` (regularización idempotente de históricos) y `tc_dof_cobertura_faltante()` (huecos del catálogo DOF).


## [13.609.1] - 2026-08-14
- CI: expediente del fixture de borrado lógico renombrado a `ELSDL00001` para cumplir el formato estándar (`rls-fixtures-expediente-format`).
- Refactor `useRefacturacion`: consultas y invalidación de caches extraídas a `useRefacturacionQueries` (complejidad ciclomática 17 → dentro del límite).
- FIX-H6-18: migración correctiva que re-aplica `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated, service_role` en `libro_pagos`, `estado_cuenta_bancario`, `conciliacion_resumen`, `pnl_financiero_embarque`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`, `cxc_aging_clientes` y `cxp_aging_proveedores`; baseline de `audit:migrations` en `20260814164034` y candados agregados al replay `20260824080000`.

## [13.609.0] - 2026-08-14
- Borrado lógico estricto (Fase 2): el Estado de Resultados anual (fuente facturas) ya no resta notas de crédito de clientes ni de proveedores cuya factura fue eliminada.
- Antigüedad de clientes y proveedores: se refuerza el filtro `deleted_at IS NULL` en los cálculos internos de pagos y notas de crédito.
- Nuevo guardrail en `scripts/db/integrity-guard.sql` (`reporte_sin_filtro_soft_delete`) que detecta reportes financieros sin filtro de borrado lógico.
- Suite `test_rls_soft_delete_reportes.sql` ampliada a 8 aserciones (aging CxC + EERR ingresos/costos).

## [13.608.0] - 2026-08-14
- Filtros estrictos de borrado lógico (`deleted_at IS NULL`) en los reportes financieros y de antigüedad: `libro_pagos` (JOIN a `facturas` y `proveedor_facturas`), `cartera_pendiente` y `proveedor_estado_cuenta*` (JOIN a `embarques`), `pnl_financiero_embarque` (embarque borrado ⇒ error), `estado_cuenta_bancario` y `conciliacion_resumen` (JOIN a `cuentas_bancarias`).
- Vistas alineadas con el mismo criterio, conservando `security_invoker = on`: `v_pagos_rep_pendientes`, `v_proforma_factura_link`, `v_saldos_cuentas_bancarias`.
- Espejos sincronizados (`cartera_pendiente`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`) + migración de replay `20260824080000_ola14_soft_delete_reportes_replay.sql` para que una instalación limpia termine con el mismo cuerpo (`audit:replay-mirror` verde).
- Nueva suite `supabase/tests/rls/test_rls_soft_delete_reportes.sql` (5 aserciones + 2 controles) registrada en el grupo `financiero` de CI.

## [13.607.1] - 2026-08-14


## [13.607.1] - 2026-08-14
- Ola 14 · Sprint 05 (cobertura): nueva suite `supabase/tests/rls/test_rls_refacturaciones_matriz.sql` (9 aserciones) que blinda R5BD-04 y R5BD-05: tesorero y ejecutivo_cobranza sin INSERT/UPDATE directo en `refacturaciones`, auxiliar_contable con escritura, SELECT intacto, aislamiento cross-tenant, FK colgante rechazada (23503) y contrato de la FK (`ON DELETE RESTRICT` + `NOT VALID`).
- Suite registrada en el grupo `financiero` de `.github/workflows/rls-tests.yml` (el guardrail de matriz falla si una suite nueva no queda declarada).

## [13.607.0] - 2026-08-14
- Ola 14 · Sprint 05 (BD P3): FK `pagos_factura_refacturacion_fk` (`pagos_factura.refacturacion_id` → `refacturaciones.id`, `ON DELETE RESTRICT`, `NOT VALID` con VALIDATE diferido tras saneo manual) (R5BD-05).
- Policies INSERT/UPDATE de `refacturaciones` alineadas al set de `_assert_refacturador` (admin_org, admin, contador, auxiliar_contable del tenant + super_admin): tesorero y ejecutivo_cobranza ya no pueden escribir directo saltándose las validaciones SAT; SELECT intacto (R5BD-04).
- 13 espejos nuevos en `supabase/schema/facturacion/` (refacturación completa + `cxc_aging_clientes` + `assert_factura_viva_para_pago`): 6 → 19 archivos, `audit:schema-functions` y `audit:replay-mirror` verdes sin entradas nuevas al baseline (R5BD-02).
- Plan de saldo del baseline replay-mirror documentado en `docs/ola14-replay-mirror-saldo.md` + `_doc` del JSON: decisión por cada una de las 14 entradas y fecha compromiso de vaciado (cierre de la Ola 17) (R5BD-03).

## [13.606.0] - 2026-08-14
- Ola 14 · Sprint 04 (Frontend/UX P3): `puedeRefacturarReceptor` ya no se ofrece con cancelación en trámite ante el SAT (`pending`/`verifying`), alineado con `puedeCancelarCfdi` y `puedeRegistrarPago` (R5FE-01) + 2 `it.each` nuevos.
- Query keys del asistente de refacturación migradas al registry `queryKeys.facturacion` (caso, factura, simulación, consistencia, expediente, último caso) y `refrescar()` ahora invalida también consistencia, expediente y último caso (R5FE-02).
- Live regions en la feature de refacturación: bloqueos con `role="alert"`, avisos con `role="status" aria-live="polite"` y banner de cancelación en trámite anunciado como estado informativo (R5UX-01).

## [13.605.0] - 2026-08-14
- Ola 14 · Sprint 03 (Edge P3): `invite-agente` / `invite-cliente` ya no devuelven el mensaje crudo de GoTrue/Postgres; usan el catálogo `mensajeSeguro` con códigos `LC_USUARIO_VINCULO_*` y el detalle queda sólo en `log.finish` (R5EF-01).
- `facturapi-consultar-rep`: rate limit fail-closed por organización (10 consultas/min) vía `check_ratelimit`, con 503 `rate_limit_unavailable` + Sentry si el contador falla y 429 con mensaje al usuario (R5EF-02).
- Mensajes genéricos al cliente en errores de PAC/SAT (`LC_SAT_NO_DISPONIBLE`, `LC_FACTURAPI_NO_DISPONIBLE`, `LC_FACTURAPI_DOC_NO_VERIFICABLE`); el detalle crudo va a `console.error`/Sentry (R5EF-03).
- Nuevas pruebas Deno: `invitePortalesMensajes_test.ts`, `facturapi-consultar-rep/index_test.ts`, `facturapi-consultar/mensajesSeguros_test.ts` (26 casos verdes en el grupo).


## [13.604.0] - 2026-08-14
- Ola 14 · Sprint 02 (toolchain P3): canario de performance sube el 3er umbral 30 → 60 ms (R5TC-01, flake ambiental de 38.29 ms en runner de 2 vCPU; aislado corre en 3-6 ms).
- `eslint.config.js`: justificadas las exclusiones de `ComparativoConsistencia.tsx` y `RefacturacionPreviewSaldos.tsx` (comparativas read-only sobre `DetailTable`, DataTable no aplica) (R5TC-03a).
- `scripts/check-bundle-size.sh`: budget default de `react-pdf` 560 → 600 KB gz con la línea base documentada (554.63 KB medidos) (R5TC-03b).
- Sin cambios funcionales en la app.


## [13.603.0] - 2026-08-14
- Ola 14 · Sprint 01 (higiene de release): nuevo guardrail `audit:no-env` que falla si un `.env` trae secretos server-side (service_role, contraseña de BD, tokens) o si aparece un `.env.*` sombra; registrado en `audit:all` y en el job de guardrails de CI.
- `.env.example`: documentados los alias `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` que leen los scripts de tooling.
- `supabase/schema/README.md`: sección "Regla de oro: las migraciones aplicadas son inmutables" con el runbook de `migration repair` (R5BD-01, `20260818090100`).
- No se elimina el `.env` de la raíz: lo genera la plataforma y es obligatorio para el build de Vite; el guardrail vigila su contenido en lugar de su existencia.

## [13.602.1] - 2026-08-14
### Fix CI — suite RLS de paginación comparaba el folio equivocado
- **Causa.** En `test_rls_proveedor_estado_cuenta_offset.sql` las aserciones leían `movimientos[].folio`, pero esa llave viene de `folio_interno` (lo genera un trigger como `FP-000123`), no del folio capturado del proveedor. Las páginas nunca coincidían con `S08-F4/S08-F5` y el grupo `operaciones` de `rls-tests` fallaba.
- **Corrección.** Las 3 aserciones ahora comparan `movimientos[].referencia`, que sí es el `folio_proveedor` sembrado por la prueba. Sin cambios en la función ni en la app.

## [13.602.0] - 2026-08-14
### Ola 13 · Sprint 08 — Retiro certificado de la sustitución motivo 01 del REP archivado (R4P-01, P2)
- **Rama muerta eliminada.** `facturapi-cancelar-rep` aceptaba la bandera `cancelar_rep_anterior` para "cancelar el REP archivado sustituyéndolo por el vigente", pero ningún punto de la app la enviaba nunca (el hook siempre llamaba con 3 datos). Se retiró la bandera, la variable `cancelarAnterior` y las validaciones que sólo existían para ella: hoy la función rechaza de inmediato un REP ya cancelado y deja un solo camino real y probado (cancelar con motivo 02, timbrar el REP nuevo).
- **Servicio y UI alineados.** `cancelarRep()` en `repFacturapi.ts` quedó con 3 argumentos y el tooltip de `PagoRepCell` ya no promete una cancelación "01" técnica: describe que el REP anterior queda archivado como antecedente.
- **Test de certificación** en `supabase/functions/facturapi-cancelar-rep/index_test.ts`: no quedan rastros de la bandera obsoleta y los flujos vigentes (motivo 02 y motivo 01 con UUID sustituto) siguen intactos.
- **Hueco de cobertura cerrado (R4BD-05).** Nueva suite `supabase/tests/rls/test_rls_proveedor_estado_cuenta_offset.sql`: verifica que `p_offset` avanza hacia atrás en el tiempo (páginas 1/2/3 sin traslape ni movimientos perdidos), que `hay_mas` se apaga al llegar al inicio, el aislamiento cross-tenant y los grants H6. Registrada en el grupo `operaciones` de `rls-tests`.

## [13.601.0] - 2026-08-14
### Ola 13 · Sprint 07 — Org guard en `saldo_factura_proveedor` (R4BD-02, P1)
- **Fuga cross-tenant cerrada.** `public.saldo_factura_proveedor(uuid)` (SECURITY DEFINER) filtraba la factura sólo por `id` y `deleted_at`: cualquier usuario autenticado podía leer `total/pagado/nc_aplicada/saldo` de una factura de **otra organización** conociendo su UUID. Ahora exige `organization_id = current_user_org_id()` y aborta con `42501 LC_ORG_SIN_CONTEXTO` si no hay organización activa (patrón de las RPC hermanas del módulo de proveedores).
- **Facturas canceladas.** Se excluye `estado = 'Cancelada'` (sin saldo exigible), mismo criterio que `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos` y `proveedor_inteligencia`. Devuelve `NULL`, igual que inexistente/eliminada/ajena (no funciona como oráculo de existencia).
- **Lógica numérica intacta:** USD 10,000 + pago MXN 86,000 @ 17.20 → saldo USD 5,000.00. Grants H6 re-afirmados (REVOKE PUBLIC/anon, GRANT authenticated/service_role).
- Migración `20260824070000_ola13_org_guard_saldo.sql` y espejo `supabase/schema/proveedores/saldo_factura_proveedor.sql` actualizado 1:1.
- Nueva suite `supabase/tests/rls/test_rls_saldo_factura_proveedor.sql` (cross-tenant, traza numérica, cancelada, sin contexto, grants y canónicas hermanas), añadida al grupo `operaciones` de `rls-tests`. Verificada rojo→verde contra la definición previa.

## [13.600.1] - 2026-08-14
- **Fix CI (`rls-tests`, grupo `operaciones`).** La suite `test_rls_expediente_cliente` (Sprint 05) sembraba el proveedor con `tipo = 'Nacional'` / `categoria = 'General'`, valores que no existen en los enums `tipo_proveedor` / `categoria_proveedor`; en base limpia fallaba con `invalid input value for enum`. Ahora usa `'Agente Aduanal'` / `'Logistico'`, la única pareja que satisface `proveedores_categoria_check`.
- Verificado localmente contra una base reconstruida desde cero (932 migraciones): las 5 suites del grupo `operaciones` y las 28 suites `test_rls_*` pasan en verde.

## [13.600.0] - 2026-08-14
- **Ola 13 · Sprint 06 (re-aplicación de guards en replay + guardrail de CI).**
- R4BD-01: nueva migración `20260824060000_ola13_replay_lotes.sql` re-emite `registrar_pago_proveedor_lote` con los guards `LC_LOTE_TC_REQUERIDO` y `LC_LOTE_FACTURA_MONEDA`, que se perdían en instalaciones limpias porque `20260821030800_ola11_lotes_paridad` tiene timestamp posterior.
- R4BD-03: nueva migración `20260824060100_ola13_replay_rbd07.sql` re-emite `regenerar_movimiento_pago_proveedor` con el guard `LC_PAGO_TC_REQUERIDO` (evita conversión 1:1 silenciosa cross-moneda) por el mismo motivo de orden de timestamps. Sin cambio de comportamiento en la BD en vivo.
- Nuevo guardrail `bun run audit:replay-mirror` (`scripts/audit-replay-mirror.ts`), cableado en `audit:all` y en el job de auditorías de CI: verifica que cada espejo de `supabase/schema/` coincida con la migración de MAYOR timestamp que lo define. Probado en negativo (rompiendo un mensaje de error a propósito → falla).
- `scripts/audit-replay-mirror-baseline.json`: 14 divergencias preexistentes toleradas como deuda documentada, para que sólo falle el drift NUEVO.
- `supabase/schema/README.md` apunta las dos funciones a sus migraciones canónicas nuevas.



## [13.599.0] - 2026-08-14
- **Ola 13 · Sprint 05 (matriz de roles en expediente de cliente y contactos de proveedor).**
- R4BD-04: las escrituras y borrados de `cliente_documentos`, `proveedor_contactos` y de la carpeta `clientes/` del bucket `documentos` ahora exigen la matriz `admin`/`admin_org`/`operador`/`contador`/`super_admin` (antes bastaba pertenecer a la organización). Lectura sin cambios: org-scoped, bypass `super_admin` y `deleted_at IS NULL` intactos.
- Nueva suite `supabase/tests/rls/test_rls_expediente_cliente.sql` registrada en el grupo `operaciones` de `rls-tests.yml`.
- UI alineada con la BD: nuevo `EXPEDIENTE_ESCRITURA` / `canEditExpediente`; las pestañas de documentos de cliente/proveedor y contactos de proveedor sólo muestran acciones de escritura a los roles que la BD permite (antes se mostraban botones que hubieran fallado con error de permisos).


## [13.598.0] - 2026-08-14

- **Ola 13 · Sprint 04 (cobertura de ramas Ola 12 y menores de BD).**
- R4EF-06: 5 suites Deno nuevas (22 casos) que cubren el marcado `verifying` de la rama 504 en cancelación de facturas, REP y notas de crédito; el dedupe fail-closed y stale-pending de `auth-email-hook` (primer test de la función); y la clasificación `error_timeout`/`error_network` del acuse con `AbortSignal`.
- R4BD-05: `proveedor_estado_cuenta_movimientos` cuenta `p_offset` desde el final de la lista, así ya se pueden ver los movimientos más antiguos (antes cualquier `p_offset > 0` devolvía página vacía). Con `p_offset = 0` el resultado es idéntico al anterior.
- R4BD-06: el README de `supabase/schema/` cita las migraciones finales reales por archivo y marca la divergencia pendiente de `registrar_pago_proveedor_lote` (fix en Sprint 06).

## [13.597.0] - 2026-08-14

- **Ola 13 · Sprint 03 (hardening de edge functions).**
- R4EF-01: nuevo catálogo `user-management/errores.ts` con mensajes seguros `LC_USUARIO_*`; los textos crudos de GoTrue/Postgres ya no llegan al cliente (siguen en el log interno).
- R4EF-02: el 409 por correo duplicado responde `LC_USUARIO_CORREO_NO_DISPONIBLE` sin hacer eco del correo (evita enumeración de cuentas).
- R4EF-03: `invite` (10/hora por organización) y `reset-password` (3/hora por usuario) pasan por `check_ratelimit` fail-closed (503 si la RPC falla, 429 con `Retry-After`).
- R4EF-04: el fetch SOAP de `verificar-uuid-sat` usa `AbortSignal.timeout(12 s)` y responde 504 `sat_timeout` en lugar de colgar la función.
- R4EF-05: nuevo `_shared/timingSafe.ts` como fuente única; `send-transactional-email` compara el service key en tiempo constante y se eliminan las dos copias locales.

## [13.596.0] - 2026-08-14
- **Ola 13 · Sprint 02 (pulido UX/frontend, 5 ítems P3).**
- R4UX-01: «Saldo inicial» del estado de cuenta de proveedor usa `formatDate` (dd/MM/yyyy) en lugar de la fecha ISO cruda, igual que la exportación CSV/PDF.
- R4UX-02: «Moneda mixta» se registra en el dominio `conciliacion_costo` y en `statusExtras` con tono warning (antes caía al fallback muted).
- R4UX-03: el botón de `NuevoUsuarioDialog` usa la prop `loading` del Button del DS (disabled + `aria-busy` + spinner) en vez del spinner manual.
- R4UX-04: `traducirMensajeEdge` ya no muestra el texto en inglés del proveedor de identidad; envuelve el motivo con copy en español y lo registra en consola.
- R4FE-01: una respuesta 2xx con `body.error` también pasa por la traducción es-MX al crear usuarios.

## [13.595.1] - 2026-08-14
- **Revisión de errores de Sentry (4 issues abiertos).**
- JAVASCRIPT-REACT-5A: "La factura tiene una solicitud de cancelación pendiente" se marca como validación esperada de FacturApi (`expected: true`) y deja de reportarse a Sentry; el aviso sigue visible al usuario.
- JAVASCRIPT-REACT-59 (`COALESCE types moneda and text`), 55 (`BuzonDuplicadoError`) y 58 (`Edge Function returned a non-2xx`) ya estaban corregidos en código/base de datos (v13.589.4, v13.583.0): los eventos provienen de las releases publicadas 13.589.1 y 13.562.0. Se cierran en Sentry.

## [13.595.0] - 2026-08-14
- **Ola 13 · Sprint 01 (toolchain).**
- R3TC-01 (re-fix): `poolOptions.forks` se movió a la raíz de `test` en `vitest.config.ts`. Vitest 3.2.4 crea el pool sólo desde la config global, así que `--expose-gc`, `maxForks` y `minForks` por fin aplican (sonda verificada: `typeof globalThis.gc === "function"` dentro del fork; canario `pdfLeak` con drift estable de 2.48 MB).
- R4TC-01: se eliminaron los re-exports muertos (`DIAS_AVISO_VENCIMIENTO`, `MAX_VIGENCIA_ANIOS`, `EstadoVigencia`, `RenglonExpediente`) del shim `documentosProveedor.ts`, más dos exports muertos detectados por knip (`pagosConRepVivo` re-exportado y el tipo `RefacturacionState`). Knip queda sin advertencias.
- R4TC-02: el canario de performance `queryTimeout` sube su budget de 50 a 80 ms (sin regresión de código; evita falsos rojos en runners de 2 vCPU).

## [13.594.7] - 2026-08-14
- **`bun run ci:fast` ya no reporta rojo cuando todo pasa**: el runner esperaba PIDs ya cosechados y `wait -n` abortaba con 127, marcando el resto como "cancelado por fail-fast".
- `ConsultaRepsTable` usa `TABLE_DENSITY.embebida` en lugar del literal `density="compact"` (regla de arquitectura de tablas).
- La Edge Function `facturapi-consultar-rep` queda declarada en la cobertura Sentry (wrapped) que exige la prueba de exhaustividad.

## [13.594.6] - 2026-08-14
- **Se corrige el drift que impedía aplicar las migraciones en una base limpia** (`cannot change return type of existing function` en `cartera_pendiente()`).
- La migración `20260818090100` ya no redefine `cartera_pendiente()` con la firma vieja de 15 columnas: ese bloque queda como no-op documentado y sólo conserva el ajuste de `direccion_totales` (N23). El cuerpo canónico vigente (16 columnas, con `cancellation_status`) lo crea `20260813230758`.

## [13.594.5] - 2026-08-13
- **Se corrigen los fallos de CI de calidad (Power of 10 y complejidad) del asistente de refacturación.**
- `ConsultaRepsTable` ahora usa el componente estándar `DataTable`; se dividieron `useRefacturarWizard`, `refacturacionPasos`, `FacturaDetalleView` y las Edge Functions `facturapi-consultar` y `facturapi-consultar-rep` para respetar los límites de líneas y complejidad.

## [13.594.4] - 2026-08-13
- **Se corrige el falso rojo del check "RLS tests result" en CI.** Cuando el commit no toca la base de datos, las suites RLS se omiten (skipped) y el job agregador las contaba como fallo.
- Ahora `skipped` cuenta como válido y sólo `failure`/`cancelled` rompen el check; el paso de diagnóstico ya no imprime "no se pudo identificar el grupo" cuando en realidad nada falló.

## [13.594.3] - 2026-08-13
- **Auditoría de la refacturación F1026 / F1027: se cierran dos huecos de trazabilidad.**
- La proforma vuelve a apuntar a la factura viva al completar una refacturación (antes seguía ligada a la factura cancelada). Se corrigió PRO-2026-1018 → F1035.
- El aging de clientes ya no suma facturas en trámite de cancelación, sustituidas o con refacturación completada: evitaba duplicar 95,120 MXN en la cartera de INDIMEX TRADING.

## [13.594.2] - 2026-08-13
- **Se corrige la divergencia "REP cancelado en el SAT pero vigente en Libre Carga".** El candado de cancelación bloqueaba también las actualizaciones documentales del pago, por lo que el acuse del SAT nunca se guardaba.
- Ahora un pago puede actualizar sólo sus datos fiscales (estatus del REP, archivos, acuses) aunque la factura esté cancelada o en trámite; sigue prohibido registrar o modificar cobros en facturas no vivas.
- La consulta manual de REP ahora reporta el motivo si el guardado falla, en lugar de responder "sin cambios" en silencio.
- REP P7 (factura F1026) quedó sincronizado como cancelado/aceptado.


## [13.594.1] - 2026-08-13
- **Refacturación paso 5: el ordenante del depósito ya viene precargado.** Se toma la razón social y el RFC del receptor de la factura viva (la nueva) y, si aún no los tiene, del cliente destino elegido.
- Se muestra una nota con el origen del dato y los campos siguen siendo editables si el depósito llegó de otra empresa.


## [13.594.0] - 2026-08-13
- **Refacturación: el paso 4 ya no obliga a esperar al SAT.** Si la cancelación del CFDI original ya está solicitada (pendiente o en verificación), se puede continuar y reasignar el pago a la nueva factura.
- Se muestra el estatus del trámite con distintivo ("Cancelación en verificación" / "Cancelación rechazada") y aviso informativo en los pasos 4 y 5.
- Si el SAT rechaza o deja expirar la solicitud, el paso vuelve a bloquear y pide solicitarla de nuevo.
- Se conservan los candados fiscales duros: REP anterior cancelado, factura destino timbrada, misma moneda y sin sobrepago.


## [13.593.0] - 2026-08-13
- **"Verificar estatus en FacturApi" ahora revisa los XML.** Descarga el XML timbrado de la factura y el de cada REP (incluidos los cancelados) y compara UUID, RFCs, importes y moneda contra la base de datos.
- Cada documento muestra su estatus real consultado al SAT (Vigente / Cancelado / No encontrado).
- Si un REP aparece cancelado en el SAT pero vigente en el sistema, se reconcilia automáticamente.
- Las diferencias encontradas se listan en el mismo diálogo, ahora más amplio.



## [13.592.0] - 2026-08-13
- **Una factura con cancelación en trámite ante el SAT ya no admite cobros.** Mientras la solicitud esté pendiente o en verificación, el sistema rechaza cualquier pago (individual o en lote) con un mensaje claro.
- El detalle de la factura muestra un aviso explicando el bloqueo y el botón "Registrar pago" queda deshabilitado.
- En Cartera, seleccionar una factura en trámite de cancelación impide el cobro en lote e indica el motivo.
- Si el SAT rechaza la cancelación, la factura vuelve a admitir cobros automáticamente.


## [13.591.0] - 2026-08-13
- **Nuevo botón "Actualizar estado" del REP.** En el paso 2 del asistente de refacturación se puede consultar en vivo al SAT/FacturApi el estatus de la cancelación del complemento de pago y sincronizarlo al instante, sin esperar los 30 minutos del proceso automático.

## [13.590.0] - 2026-08-13
- **El asistente de refacturación ya no se detiene esperando la cancelación del REP.** Con la solicitud en verificación ante el SAT se puede emitir la factura del nuevo receptor y cancelar el CFDI original; el paso mostrará un aviso informativo en lugar de un bloqueo.
- **Se refuerza el candado de la reasignación del pago:** mientras el REP anterior siga vigente no se permite mover el depósito ni timbrar el nuevo complemento, para no reportar el mismo pago dos veces al SAT.
- Si el REP vivo no tiene solicitud de cancelación, el asistente sigue exigiendo cancelarlo antes de continuar.

## [13.589.9] - 2026-08-13
- Correcciones internas de calidad: se simplificó el cálculo de acciones disponibles en la pantalla de facturas (sin cambios de comportamiento) y se sincronizó el inventario de cambios de base de datos.

## [13.589.8] - 2026-08-13
- **Corregido el bloqueo al crear el borrador sustituto en el paso 3.** La copia reutilizaba el vínculo directo de la proforma y activaba incorrectamente la protección contra facturas duplicadas (`uq_facturas_proforma_moneda_viva`).
- La factura sustituta conserva la trazabilidad mediante el caso de refacturación, sus conceptos y el embarque; el identificador de la proforma original queda registrado en la bitácora sin competir con la factura vigente.

## [13.589.7] - 2026-08-13
- **Cancelar un REP por segunda vez ya no genera un error.** Si la solicitud ya está pendiente o en verificación ante el SAT, la función responde de forma idempotente, conserva el proceso existente y evita enviar una cancelación duplicada al proveedor fiscal.
- La pantalla refresca el estado y muestra un aviso informativo para que el usuario espere la resolución, en lugar de registrar “No se pudo cancelar el REP”.

## [13.589.6] - 2026-08-13
- **F1026 ya muestra correctamente la cancelación asíncrona de su REP.** El SAT recibió la solicitud pero la dejó en verificación; antes la pantalla decía incorrectamente “REP cancelado” y seguía mostrando el botón como si nada hubiera ocurrido.
- El asistente ahora distingue “solicitud enviada” de “cancelación aceptada”, muestra el estado de verificación, bloquea reintentos duplicados y refresca automáticamente hasta recibir una respuesta fiscal terminal.

## [13.589.5] - 2026-08-13
- **"Refacturar a otro receptor" vuelve a aparecer en facturas ya cobradas.** La opción se ocultaba en cuanto la factura pasaba a "Pagada" (por ejemplo F1026), aunque la base de datos sí permite abrir el caso.
- Ahora la opción se muestra en cualquier CFDI timbrado y vivo (Emitida, Pagada, Parcialmente pagada o Vencida) sin factura sustituta vigente, con los mismos permisos por rol contable/administración.



## [13.589.4] - 2026-08-13
- **Arreglo en el asistente de sustitución de facturas.** La vista previa de los pasos 3 (nueva factura) y 5 (reasignación de pago) fallaba con "No pudimos cargar la información": la simulación mezclaba la moneda de la factura con un texto y la base de datos rechazaba la consulta.
- Ahora la moneda se convierte siempre a texto antes de compararse, así que la vista previa carga y el aviso de moneda inconsistente sigue funcionando.

## [13.589.3] - 2026-08-13
- **Regularización de saldo con HK LS LIMITED.** Se registraron como pagadas 12 facturas históricas del proveedor (102,824.60 USD) que ya no aparecen en su estado de cuenta del 11/08/2026: el pago se hizo en una versión anterior del ERP y nunca se capturó.
- Cada pago se registró con la fecha de emisión de su factura, marcado como ajuste histórico, sin cuenta bancaria, sin movimiento en bancos y sin REP (proveedor extranjero).
- El saldo por pagar a HK LS LIMITED en el ERP baja de 335,089.60 a 232,265.00 USD, que cuadra exactamente con las 19 facturas coincidentes del estado de cuenta; siguen pendientes de captura 17 facturas por 172,303.00 USD.

## [13.589.2] - 2026-08-13
- **Arreglos de CI.** Las tablas comparativas del asistente de refacturación (consistencia y saldos) usan el contrato visual estándar de tablas de detalle.
- El controlador del asistente se movió a `hooks/` y sus módulos puros a `domain/`, como manda la arquitectura del proyecto.
- Se agregaron pruebas de los módulos de avance y derivados del asistente, y se corrigió un título de prueba duplicado.


## [13.589.1] - 2026-08-13
- **Arreglos de CI en el asistente de refacturación.** El asistente ahora lee la organización activa con `useOrgActiva()` (antes usaba `useAuth().organizationId`, que es nulo para el super admin con tenant seleccionado).
- Se dividió la lógica del asistente en dos módulos puros (`refacturarWizardAvance.ts` y `refacturarWizardDerivados.ts`) para cumplir el límite de complejidad.
- Se regeneró `migration-manifest.json` con las 4 migraciones nuevas.

## [13.589.0] - 2026-08-13
- **Vista previa antes de confirmar cada etapa de la refacturación.** El asistente ahora muestra una tarjeta con qué se cancela (REP, factura original), qué se crea (nueva factura, nuevo REP) y cómo se reasigna el pago, con el ordenante del depósito.
- **Tabla de saldos "antes → después"** de la factura original y de la nueva, calculada con los saldos reales del sistema. La simulación es de sólo lectura: no guarda nada hasta que confirmas.
- **Los bloqueos se explican en español** dentro de la vista previa (por ejemplo, REP vivo o nueva factura sin timbrar), con los mensajes `LC_REFACT_*`.

## [13.588.0] - 2026-08-13
- **Permisos de refacturación para todos los roles contables.** Además de los administradores de la organización y el contador, ahora el auxiliar contable puede operar los casos de refacturación (tanto en la base como en la pantalla).
- **La opción "Refacturar a otro receptor" sólo aparece** para quien realmente puede ejecutarla; los demás roles ya no entran al asistente para fallar al final.
- **Cada etapa exige el permiso**: los botones de cancelar REP, crear borrador y cancelar la factura original quedan deshabilitados y el pie del asistente explica en español qué rol se necesita.



## [13.587.0] - 2026-08-13
- **Validaciones fiscales reforzadas en la refacturación.** Antes de abrir el caso, el asistente muestra un semáforo del nuevo receptor: avisa si le falta razón social, RFC válido (ya no acepta RFC genéricos), régimen fiscal o código postal, con acceso directo al expediente del cliente.
- **Comparativo original vs. nueva factura** en el paso 3: moneda, subtotal, IVA, retenciones y total lado a lado, más los hallazgos de inconsistencia detectados por el sistema. Si algo no cuadra, no se puede avanzar.
- **La empresa que depositó ahora es obligatoria** al reasignar el pago, y su RFC se valida en pantalla con el formato del SAT.
- **Mensajes claros** para todos los avisos del proceso de refacturación (moneda, impuestos, sustitución, cierre inconsistente).


## [13.586.0] - 2026-08-13
- **Trazabilidad de la refacturación (Etapa 3).** Nueva sección en el detalle de la factura con el expediente del caso: receptor original y correcto, ruta fiscal, motivo, factura original y nueva, expediente del embarque y pagos involucrados (con la empresa que realmente depositó).
- **Línea de tiempo de movimientos** con quién y cuándo ejecutó cada paso: apertura del caso, cancelación del complemento de pago (REP), borrador y timbrado de la nueva factura, cancelación del CFDI original, reasignación del pago, timbrado del nuevo REP y cierre del caso.
- **Los trámites en curso y los errores se distinguen a simple vista** (solicitado al SAT, aceptado, rechazado o con error).
- **La misma trazabilidad se puede consultar dentro del asistente**, en la sección desplegable al pie del modal.

## [13.585.0] - 2026-08-13
- **Asistente visual "Refacturar a otro receptor" (Etapa 2).** Desde el detalle de la factura, en "Más acciones", ahora hay un asistente de 5 pasos que guía todo el caso cuando el cliente pagó desde la empresa equivocada.
- **Los 5 pasos**: 1) diagnóstico (cliente destino, ruta fiscal 01/02 y motivo), 2) cancelar el complemento de pago (REP), 3) crear y timbrar la factura al receptor correcto, 4) cancelar el CFDI original, 5) reasignar el pago registrando la empresa que realmente depositó.
- **No se puede avanzar con pasos incompletos**: cada etapa avisa en el pie del modal qué falta (REP vivo, factura nueva sin timbrar, original aún vigente, pago sin seleccionar).
- **El avance se guarda**: si sales del asistente para timbrar la factura nueva, al volver retomas en el mismo paso.

## [13.584.0] - 2026-08-13
- **Refacturar a otro receptor (Etapa 1: base de datos).** Cuando un cliente paga desde una empresa equivocada, el ERP ya guarda el caso completo: factura original, cliente destino, ruta fiscal (01 sustitución o 02 factura nueva), motivo, embarque y avance del proceso.
- **Se registra el ordenante real del depósito** (nombre y RFC) cuando el pago viene de una empresa distinta a la que se factura.
- **Duplicado de factura hacia otro cliente**: copia conceptos y vínculos del embarque, pero toma RFC, régimen y uso de CFDI del cliente nuevo.
- **Reasignación de pago sin perder trazabilidad**: el pago se da de baja en la factura vieja, se recrea en la nueva y el movimiento bancario conciliado se traslada solo. Se valida que el complemento de pago (REP) esté cancelado, que la factura destino esté timbrada y vigente, que la moneda coincida y que no haya sobrepago.

## [13.583.2] - 2026-08-13
- **Lectura de facturas en PDF más tolerante.** Si la petición llegaba sin el formato de archivo esperado, la función fallaba con un error interno (500) y se reportaba como falla del sistema; ahora responde con un aviso claro (400) y ya no ensucia el monitoreo. Cierra JAVASCRIPT-REACT-57.
- **Confirmado el cierre de JAVASCRIPT-REACT-56** (`getClaims is not a function`): los eventos provenían de la versión anterior de la función; con el despliegue actual ya procesa PDFs sin error.

## [13.583.1] - 2026-08-13
- **Mensajes claros en pagos en lote.** Se agregaron los avisos amigables para dos validaciones que antes se mostraban con su código técnico: falta de tipo de cambio y facturas en otra moneda dentro del lote.

## [13.583.0] - 2026-08-13
- **Alta de usuarios: ahora se dice el motivo real del error.** Antes cualquier rechazo mostraba "el servicio en la nube rechazó la solicitud, intenta más tarde"; ahora se muestra el motivo (por ejemplo, correo con formato inválido). Aplica también a invitar, eliminar y restablecer contraseña.
- **Validación de correo más estricta en el diálogo de alta**, alineada con lo que acepta el servicio de identidad, y normalización (espacios y minúsculas) antes de validar.

## [13.582.2] - 2026-08-13
- **Menos ruido en el monitoreo de errores.** El aviso "este archivo ya fue capturado como factura de proveedor" es una validación esperada y ya no se reporta como falla. Cuando la base de datos está momentáneamente inaccesible, el registro de errores del cliente ya no envía la página de error del proveedor de red al monitoreo (sólo la deja en la bitácora del servidor).

## [13.582.1] - 2026-08-13
- **Corrección: funciones del servidor devolvían error 500 al validar la sesión.** La verificación del token usaba un método (`getClaims`) que no existe en la versión de la librería instalada, por lo que procesos como la lectura de facturas en PDF fallaban con "authWithClaims.getClaims is not a function". Ahora se valida la sesión con `getUser`, disponible en todas las versiones.

## [13.582.0] - 2026-08-13
- **Ola 12 · Sprint 10 — Multi-moneda y fiscal SAT (P1).**
  - **Saldos que ya no mezclan divisas:** el estado de cuenta del proveedor convierte cada pago a la moneda de la factura con el tipo de cambio del pago. Si el pago fue en otra moneda y no hay tipo de cambio, el movimiento se marca "SIN TC (excluido del saldo)" en lugar de sumarse como si un dólar valiera un peso.
  - **Indicadores de salud del proveedor en pesos:** monto de 12 meses, saldo actual, notas de crédito y la gráfica mensual se valúan a MXN con el tipo de cambio del DOF; si falta el tipo de cambio, la pantalla lo avisa y los importes en divisa quedan fuera.
  - **Nuevas reglas centrales de conversión:** una sola función calcula el saldo de cada factura de proveedor (total − pagos − notas de crédito aplicadas) en su propia moneda, para que todos los reportes den el mismo número.
  - **Complemento de pago (REP) conforme al SAT:** la base del documento relacionado ahora se declara **sin IVA** (antes se enviaba el importe con impuesto) y se incluyen las **retenciones** de la factura relacionada. Si la factura tiene retenciones con más de una tasa por impuesto, el timbrado se detiene con un mensaje claro en vez de emitir un comprobante incorrecto.
  - **Re-timbrado de un REP cancelado:** un complemento cancelado ya no deja el pago sin salida. Se puede volver a timbrar desde el listado de pagos, el REP anterior se archiva y la cancelación por sustitución (motivo 01) lo relaciona correctamente.

## [13.581.0] - 2026-08-13
- **Ola 12 · Sprint 09 — Seguridad y control de pagos en lote (8 correcciones).**
  - **Expediente del proveedor protegido:** subir, editar o borrar documentos (CSF, opinión de cumplimiento, comprobante bancario) ahora exige rol de escritura de compras; los perfiles de sólo consulta ya no pueden modificarlos, aunque siguen viéndolos.
  - **Pago en lote en moneda extranjera:** el servidor rechaza el lote si no hay tipo de cambio, con mensaje en español, en lugar de guardarlo y reportarlo como si fuera 1 a 1.
  - **Cancelaciones que tardan:** si el timbrado tarda demasiado al cancelar una nota de crédito o un complemento de pago, el documento queda marcado "en verificación" y el proceso automático lo concilia después.
  - **Anticipos en el estado de cuenta:** el anticipo entregado aparece con su importe real como abono y su aplicación posterior queda como renglón informativo, sin contar el dinero dos veces.
  - **Notas de crédito:** sólo las **aplicadas** descuentan saldo en el estado de cuenta y en la antigüedad, igual que en el resto de cuentas por pagar.
  - **Alertas del proveedor:** ya consideran las notas de crédito aplicadas y convierten los pagos hechos en otra moneda con su tipo de cambio; sin tipo de cambio el pago no se descuenta (nunca se asume paridad 1 a 1).
  - **Proveedores sin origen capturado:** se tratan como nacionales en toda la app (expediente, salud y encabezado), igual que en el servidor.
  - **Cobro y pago en lote:** un error de la operación muestra un solo aviso y el diálogo permanece abierto para reintentar; se retiró el bloqueo de 10 minutos que rechazaba lotes legítimos idénticos (la protección real contra duplicados vive en el servidor).

## [13.580.0] - 2026-08-13
- **Ola 12 · Sprint 08 — Frontend, datos y tooling (7 correcciones P2/P3).**
  - **Saldo inicial en el estado de cuenta del proveedor:** la consulta ahora devuelve el saldo previo al periodo por moneda y la tabla lo muestra como "Saldo inicial", así el saldo corrido ya no arranca en cero y cuadra con el saldo global.
  - **Fechas por defecto en hora de México:** el rango del estado de cuenta abre con el día local, no con el día UTC (antes, después de las 18:00, filtraba con la fecha corrida).
  - **Agregar documento:** al abrir el modal desde un documento faltante ya llega seleccionado ese tipo, y al reabrirlo en genérico vuelve al tipo por defecto.
  - **Conciliación multi-moneda:** la tabla de operaciones explica la marca "Moneda mixta" y el encabezado "Facturado" aclara que el importe viene convertido con el tipo de cambio de la factura o del DOF.
  - **Actualización inmediata:** registrar, editar o borrar pagos, facturas, notas de crédito y anticipos de proveedor refresca de inmediato el detalle 360 del proveedor.
  - **Errores visibles:** si falla la consulta de conciliación, el detalle muestra un aviso con botón "Reintentar" en lugar de aparentar "proveedor sin operaciones".
  - **Pruebas:** las opciones del pool de Vitest se movieron a `poolOptions.forks` para que `--expose-gc` llegue a los workers y el canario de fugas de PDF mida memoria real.

## [13.579.0] - 2026-08-13
- **Ola 12 · Sprint 07 — Lotes CxP y conciliación (4 correcciones P3 de base de datos).**
  - **Pago en lote a proveedor:** si una factura del lote está en otra moneda y no se capturó tipo de cambio, el lote se rechaza con un mensaje claro (`LC_LOTE_FACTURA_MONEDA`) antes de guardar nada, igual que ya hacía el cobro en lote de clientes.
  - **Antigüedad de saldos:** las facturas antiguas marcadas como "Pagada" sin pagos capturados dejan de mostrar saldo pendiente (sólo cambia el cálculo, no se tocó ningún dato).
  - **Conciliación comprometido vs facturado:** cuando el costo y la factura están en monedas distintas, el importe se convierte con el tipo de cambio del documento o el del DOF; si no hay tipo de cambio confiable, la partida se marca **Moneda mixta** y ese importe se excluye de la comparación (nunca se asume 1:1).
  - **CI:** la migración de contactos de proveedor y expediente de cliente se volvió re-ejecutable (índices con `IF NOT EXISTS` y `DROP POLICY IF EXISTS` previo) y se regeneró `migration-manifest.json`.
  - Se actualizaron los espejos declarativos de `registrar_pago_proveedor_lote`, `proveedor_estado_cuenta` y `proveedor_estado_cuenta_movimientos`, y la tabla de altas del README de esquemas.

## [13.578.0] - 2026-08-13
- **Ola 12 · Sprint 06 — Fiscal y prorrata (3 correcciones P3).**
  - Una partida de costo ya pagada cuya factura de proveedor se cancela o elimina conserva el estado **Pagado**: deja de reaparecer en "Por facturar" y de inflar la tarjeta "Comprometido sin factura".
  - El pago de una factura ahora se reparte entre sus partidas usando la **misma base con IVA** (proporción contra el subtotal), así se distribuye el 100% del pagado y el pendiente ya no queda inflado ~13.8%.
  - En el REP, la tasa de IVA del CFDI relacionado se **ancla a la tasa más cercana del catálogo SAT** (16%, 8%, 0%) en vez de umbrales fijos: los redondeos de centavos ya no timbran con la tasa equivocada.
  - Se agregó el espejo declarativo `supabase/schema/proveedores/proveedor_estado_cuenta.sql`.

## [13.577.0] - 2026-08-13
- **Ola 12 · Sprint 05 — Estado de cuenta del proveedor (4 correcciones P3).**
  - Los saldos por moneda ahora son **globales** (todo el historial, no sólo el periodo filtrado), así cuadran contra la antigüedad de saldos; la tarjeta se llama "Saldos por moneda" y aclara que es saldo global.
  - La antigüedad de saldos (Vigente, 1-30, 31-60, 61-90, 90+) se calcula con la fecha local de la Ciudad de México, ya no con la fecha del servidor: por las tardes los rangos dejan de "adelantar un día".
  - Ya se puede exportar el estado de cuenta (CSV y PDF) cuando el periodo no tiene movimientos pero el proveedor sí tiene saldo vencido; el CSV incluye ahora una sección de "Antigüedad".
  - El promedio de días de facturación deja de contar como 0 las facturas emitidas antes del alta del costo (se excluyen del promedio) y usa la fecha de captura si faltara la de emisión.
  - Se agregaron los espejos declarativos de `proveedor_estado_cuenta_movimientos` y `proveedor_inteligencia` en `supabase/schema/proveedores/`.

## [13.576.0] - 2026-08-13
- **Ola 4 — Cierre de la homologación Cliente ↔ Proveedor: contactos múltiples y expediente documental.**
  - Nueva pestaña **Contactos** en la ficha del proveedor: varias personas por proveedor (tráfico, cobranza, facturación) con un único contacto principal, alta/edición en modal estándar y baja lógica que conserva el histórico.
  - Nueva pestaña **Documentos** en la ficha del cliente: expediente con constancia fiscal, comprobante de domicilio, contrato y soporte de crédito, con el mismo semáforo de completitud, control de vigencia, descarga con liga firmada y borrado con reversa que ya tenía el proveedor.
  - Si el cliente opera a crédito, el expediente exige además la solicitud de crédito.
  - Módulo compartido `features/expediente`: reglas de vigencia, semáforo, tabla y modal de carga ahora son los mismos para cliente y proveedor (el detalle de proveedor pasó a usarlos como envoltorio), de modo que ambas fichas se ven y se comportan idéntico.
  - Pruebas nuevas del dominio compartido, del expediente de cliente y de los contactos de proveedor.

## [13.575.0] - 2026-08-13
- **Ola 12 · Sprint 04 — Estados de error y guardas de captura en Proveedor 360** (R3FE-04..09): la ficha del proveedor deja de "mentir" cuando algo falla.
  - Estado de cuenta paginado en servidor: la RPC acepta `p_limite`/`p_offset`, calcula saldos sobre todo el periodo y avisa en pantalla cuando el rango está truncado (R3FE-04).
  - Un fallo de carga ya no se pinta como "sin datos" ni como "proveedor no encontrado": detalle, operaciones, por facturar y estado de cuenta muestran error con botón de reintentar (R3FE-05, R3FE-06).
  - Vigencia de documentos validada al capturar: obligatoria en opinión de cumplimiento y datos bancarios, nunca vencida, nunca anterior al documento ni a más de 10 años (R3FE-07).
  - Borrar un documento ya no se traga el error de almacenamiento: si falla se revierte el borrado lógico, se deja rastro en bitácora y se avisa al usuario (R3FE-09).

## [13.574.0] - 2026-08-13
- **Ola 12 · Sprint 03 — Edge functions menores y policy de storage** (R3EF-02, R3EF-03, R3P-13): candados de tiempo y de seguridad en tareas de fondo.
  - El cron de reconciliación de cancelaciones ahora corta cada consulta a FacturApi a 15 s y la descarga del acuse a 12 s, distinguiendo `error_timeout` de `error_network`; un lote grande ya no se trunca por una llamada colgada (R3EF-02).
  - El hook de correos de auth es fail-closed: si no puede registrar el envío responde 500 sin encolar, y una fila `pending` de más de 10 min se trata como caída y se reintenta para no perder el correo (R3EF-03).
  - Los documentos de proveedor en papelera ya no son descargables: la política de lectura del bucket excluye registros con borrado lógico (R3P-13).

## [13.573.0] - 2026-08-13
- **Ola 12 · Sprint 02 — Accesibilidad y UX mecánica en Proveedor 360** (R3UX-03..07): pulido de "manijas y letreros" para que todos los usuarios, incluidos los que usan lector de pantalla, operen igual de rápido.
  - El modal de documentos del proveedor usa `DatePickerMx` (DD/MM/YYYY) en lugar de fechas nativas, con rango cruzado min/max (R3UX-03).
  - Notas del modal con etiqueta ligada, error anunciado con `role="alert"` y botón de guardar con spinner estándar (R3UX-04).
  - La gráfica de tendencia toma sus colores de `chartTokens` y suma resumen accesible + detalle por mes para lectores de pantalla (R3UX-05).
  - Las alertas de Salud dejan de anunciarse una por una: ahora hay una sola región `role="status"` con el conteo (R3UX-06).
  - Las filas navegables de Operaciones y Movimientos anuncian a dónde llevan (`Ver embarque…` / `Ver factura…`) (R3UX-07).

## [13.572.0] - 2026-08-13
- **Ola 12 · Sprint 01 — Toolchain y documentación** (R3TC-02/03/04, R3BD-07/08): limpieza de "herramientas del taller", sin cambios visibles para el usuario. Como afilar las sierras y ordenar el manual antes de la siguiente obra.
  - `audit:all` ahora corre 11 guardarraíles: se sumaron `audit:schema-functions` y `audit:manifest`, que sólo estaban cableados en CI (R3TC-02).
  - Los 4 imports de CORS en funciones de correo apuntan al módulo compartido `_shared/cors.ts` (antes usaban un paquete sin versión fijada) (R3TC-03).
  - `audit:rpc-columns` ya no finge éxito: en CI sin base de datos falla con mensaje explícito; en local sigue omitiéndose con aviso `SKIP:`. Se retiró del job `audits` (que corre sin BD) (R3TC-04).
  - `supabase/schema/README.md` actualizado con las altas de la Ola 11 y las migraciones reales de `registrar_pago_cliente_lote` y `regenerar_movimiento_pago_proveedor` (R3BD-07).
  - `validar_cierre_embarque.sql` canónico alineado 1:1 con su migración vigente (sólo comentarios y espacios; cero cambios ejecutables) (R3BD-08).



## [13.571.0] - 2026-08-13
- **Fichas de Cliente y Proveedor homologadas (Olas 1–3)**: ahora las dos pantallas se ven salidas del mismo molde. Como uniformar dos sucursales: mismos mostradores, mismos letreros.
  - Nuevo envoltorio compartido de pestañas (`DetailTabSection`) y contador en pill idéntico en todas las pestañas (`DetailTabLabel`); se eliminó el duplicado `ClienteTabSection` y las cards armadas a mano en proveedor.
  - Mismo estado de carga (esqueleto dentro del contenedor de página) en ambas fichas; estados vacíos con ícono y explicación en Embarques y Cotizaciones del cliente.
  - Franja de KPIs del cliente migrada a `KpiStrip` (carrusel en celular, 3 columnas en escritorio) con textos de apoyo.
  - Encabezado del cliente homologado: botón primario **Editar** + menú "Más acciones" y badges de régimen, días y límite de crédito.
  - **Cliente gana pestaña "Estado de cuenta"** dentro de la ficha (la ruta dedicada sigue disponible desde el menú).
  - Estado de conciliación del proveedor ahora usa el badge canónico (`StatusBadge`, dominio `conciliacion_costo`) como el resto del ERP.
  - `ProveedorDetalle.tsx` se dividió (`_sections/ProveedorDetalleTabs.tsx`) para respetar el límite de 200 líneas.
  - Pendiente por confirmar: pestaña de contactos múltiples para proveedores (requiere tabla nueva) y expediente documental del cliente.

## [13.570.2] - 2026-08-13
- **Orden de la casa (Power of 10)**: se dividieron 4 archivos que rebasaron las 200 líneas — el catálogo de mensajes `LC_*` (nuevo `lcCodeMessages.tesoreria.ts`), el cobro en lote de cliente (nuevo `cobroLoteReparto.ts`), el buzón de CxP (nuevo `facturasEntrantesCaptura.ts`) y el tab de facturas recibidas (nuevo `EntrantesCardHeader.tsx`).
- **Capas respetadas**: `validarFechaPago` se movió de `components/` a `facturacion/domain/`, para que el servicio del cobro en lote ya no importe desde la capa de UI.

## [13.570.1] - 2026-08-13
- **CI en verde otra vez**: se renombró un test de pago en lote de CxP que tenía el mismo título que su gemelo de CxC (dos cajas con la misma etiqueta confunden al almacén), se registró en el manifest la última migración aplicada y se ajustó el presupuesto del paquete de PDF a 560 KB, acorde a la versión fija 4.5.1.

## [13.570.0] - 2026-08-13

- **Actualización de librerías (mantenimiento)**: se subieron a su última versión compatible los parches y menores de 19 dependencias (base de datos, Sentry, iconos, formularios, PDF de tipos, herramientas de lint y pruebas). Como cambiarle el aceite al camión: no se nota al manejar, pero evita fallas.
- **`@react-pdf/renderer` se queda fijo en 4.5.1**: la versión 4.6.0 provoca una fuga de memoria (128 MB tras 200 PDFs contra 12 MB actuales), detectada por la prueba canario. Queda anclada hasta que el proveedor lo corrija.
- Sin vulnerabilidades altas ni críticas en dependencias al momento de la revisión.



## [13.569.0] - 2026-08-13
- **Chequeo de tipos restaurado en las funciones de servidor (Sprint 10 · RTC-01)**: CI vuelve a revisar los tipos de las edge functions (se corrigieron 45 errores históricos y se fijó una sola versión del cliente de base de datos). Como pasar la ortografía de todo el correo antes de enviarlo, en lugar de mandarlo a ciegas.
- **Retiro del React Compiler (RTC-02)**: se quitaron plugins y dependencias que ya nadie usaba; la regla que impide volver a activarlo se queda como guardia.
- **Limpieza de calidad para cerrar la Ola 11**: se simplificaron el hook y las validaciones del pago en lote y el webhook de correos de acceso (menos ramas por función), se movieron a la capa compartida el filtro de eventos visibles al cliente y la validación de datos bancarios (ya no se cruzan módulos) y se eliminó código exportado sin uso.

## [13.568.0] - 2026-08-13
- **Prueba de conexión con FacturApi que sí se corta a tiempo (Sprint 7 · REF-08)**: antes el aviso de "tardó demasiado" salía a los 15 segundos pero la llamada seguía abierta por detrás; ahora la conexión se aborta de verdad. Si guardar el identificador de la organización falla, queda registrado en lugar de perderse en silencio.
- **Nunca más doble timbrado al recuperar una factura atorada (REF-09)**: al reconciliar contra FacturApi, si la búsqueda queda incompleta (demasiadas facturas recientes), el sistema ya no asume "no existe" ni libera el candado; avisa y pide reintentar en unos minutos. Aplica a facturas, notas de crédito y REP.

## [13.567.0] - 2026-08-13
- **Etiquetas de formulario accesibles (Sprint 9 · UX-04)**: en los diálogos de contacto de cliente, datos bancarios de proveedor (alta y edición) y seguro del embarque, al hacer clic en el texto de la etiqueta se enfoca su campo y los lectores de pantalla ya lo anuncian.
- **Tamaños de etiqueta uniformes (UX-08)**: se migraron 100 etiquetas que traían un tamaño "a mano" a la variante oficial del diseño; los formularios se ven consistentes y las filas de conceptos/contenedores conservan su etiqueta chica. Se agregó una prueba que impide reintroducir el atajo.
- **Fecha de corte del estado de cuenta correcta de noche (RFE-11)**: entre 18:00 y 23:59 mostraba la fecha de mañana; ahora usa el día local.
- **Sin alarmas redundantes por el tipo de cambio DOF (RFE-09)**: si el servicio del DOF falla, ya no salta el aviso global; la pantalla sigue avisando y bloqueando como siempre.
- **Retiro del buzón de facturas sin archivos huérfanos silenciosos (RFE-10)**: si el borrado del archivo falla, se reintenta con la limpieza segura (que respeta archivos compartidos por otro documento) y queda registro en bitácora.

## [13.566.0] - 2026-08-13
- **Los "planos" de la base vuelven a coincidir con la obra (Sprint 8 · higiene de esquema)**: dos funciones clave de embarques tenían su copia de referencia desactualizada; se regeneraron 1:1 con la versión que realmente corre (incluye el candado que evita que un nombre vacío borre al proveedor y el reparto exacto de costos entre contenedores).
- **Nuevo guardián de archivos canónicos**: si un archivo de referencia queda truncado o inválido, la compilación falla en lugar de pasar desapercibido.
- **Inventario de migraciones al día**: el listado de versiones de base de datos volvió a cuadrar con lo que hay en disco (905 archivos) y ahora se verifica automáticamente en cada revisión.
- **Guardián de registros borrados más fino**: en oportunidades y leads ya no se exime el archivo completo; sólo la consulta de detalle por enlace directo. Las listas quedan protegidas otra vez contra el bug de mostrar registros eliminados.

## [13.565.0] - 2026-08-13
- **Enlaces de seguimiento vencidos ya dicen la verdad (Sprint 6 · páginas públicas)**: si el enlace no existe o venció, el cliente ve "este enlace ya no es válido o venció" con los pasos a seguir, en lugar del genérico "el servicio no está disponible" que lo invitaba a reintentar en vano.
- **Los enlaces personales ya no se publican en buscadores**: las páginas de seguimiento, proformas y baja de correos piden a Google que no las indexe y la dirección "oficial" que declaran ya no incluye el token del cliente.
- **Fechas del seguimiento en formato mexicano**: el ETD y ETA de la tarjeta "Ruta" se muestran como 21/08/2026, igual que el resto de la app (antes salía la fecha cruda 2026-08-21).
- **Botones de carga consistentes**: "Solicitar cotización" y "Aceptar proforma" usan el spinner estándar, sin ícono duplicado.
- **Formularios que no regañan antes de tiempo**: en "Solicitar cotización", los avisos de campo obligatorio aparecen sólo después de intentar enviar, no al abrir el diálogo.
- **Modo demo con promesa realista**: el aviso de bienvenida ya no dice "se reinician en cada acceso"; los datos de ejemplo se restablecen de forma periódica.
- **Baja de correos accesible y con reintento**: los cambios de estado se anuncian a lectores de pantalla y, si algo falla, hay botón "Reintentar".
- **Proforma sin pantalla en blanco**: si el enlace devuelve un estado inesperado, se muestra un aviso con pasos en vez de una página vacía.

## [13.564.0] - 2026-08-13
- **Ya no ofrecemos botones que la base va a rechazar (Sprint 5 · permisos)**: en Cartera y en CxP "Por pagar", los roles de sólo consulta (gerentes) ya no ven las casillas de selección ni los botones de cobro/pago en lote; antes capturaban todo el lote y el sistema lo rechazaba al final.
- **Contabilidad ya puede adjuntar el XML faltante**: el botón que la app ofrecía ahora sí funciona (antes el archivo se subía y el guardado se rechazaba, dejando basura en el almacén). La autorización se valida en la base con la misma matriz de roles.
- **Aviso al salir del alta de embarques más fiel**: el botón "Atrás" del asistente ahora también pregunta antes de perder la captura, y el aviso se basa en lo que realmente escribiste (no en el paso en que estás).
- **Las sugerencias de conceptos del buzón ya no se pierden en silencio**: si el guardado falla se reintenta y, si no se logra, aparece un aviso explicando que el documento sí quedó subido y cómo repararlo, con registro en bitácora.
- **Pruebas y compilación**: se agregaron pruebas de los permisos nuevos (adjuntar XML, cobro/pago en lote respetando la separación de funciones) y se corrigió un residuo de compilación del refactor.
- **Badge del buzón por organización**: un super admin sin organización seleccionada ya no ve la suma de todas las empresas; el contador respeta la organización activa.

## [13.563.0] - 2026-08-13
- **Movimientos borrados ya no bloquean para siempre (Sprint 4 · tesorería)**: si mandas un movimiento bancario a la papelera, ahora puedes volver a importarlo o regenerarlo; antes el sistema lo consideraba duplicado y quedaba en un callejón sin salida.
- **La moneda de una cuenta con movimientos queda protegida en la base**: aunque se intente desde fuera de la app, no se puede cambiar la moneda de una cuenta que ya tiene movimientos (vigentes o en papelera), para no mezclar divisas en el saldo.
- **Altas y ediciones de cuenta más seguras**: la fecha de corte no puede ser futura y la CLABE se valida a 18 dígitos con dígito verificador, con aviso en rojo en el propio campo.
- **Nunca más conversiones 1 a 1 silenciosas**: al regenerar el movimiento de un pago en moneda distinta a la cuenta, el sistema exige el tipo de cambio del pago y explica qué capturar.

## [13.562.0] - 2026-08-13
- **Cobro y pago en lote con las mismas reglas (Sprint 3 · paridad de lotes)**: ambos módulos ahora validan igual la fecha (nunca futura ni anterior a la emisión de una factura del lote), exigen tipo de cambio cuando el lote es en dólares o euros, y obligan a que el reparto cuadre al centavo con el importe realmente recibido o transferido (ya no se acepta sobrante sin asignar).
- **Sin facturas repetidas en el reparto**: si una factura aparece dos veces en un lote, el sistema lo detecta y lo explica antes de guardar.
- **Cobros en lote a prueba de doble clic**: cada envío lleva una llave única; si se reintenta, se devuelve el resultado original en lugar de duplicar el cobro, y si aún está en proceso avisa con un mensaje claro.
- **Comisiones y reportes en pesos más exactos**: los pagos individuales de un cobro en lote en dólares o euros ya guardan el tipo de cambio del lote (antes se registraba 1, lo que subestimaba los montos convertidos a pesos).


## [13.561.0] - 2026-08-13
- **Cancelaciones fiscales que no se quedan a medias (REF-01)**: si el timbrador tarda demasiado en responder una cancelación, la factura queda marcada como "en verificación" con su bitácora, de modo que el proceso automático la revisa después y refleja el estado real ante el SAT.
- **Los complementos de pago (REP) ya entran al proceso automático de cancelación (REF-02)**: antes sólo se cerraban si llegaba el aviso del timbrador; ahora el barrido periódico también los revisa y los deja como Cancelado (o rechazado/expirado) con su registro en bitácora.
- **Correos de autenticación sin duplicados (REF-03)**: los reintentos del sistema de correo ya no generan dos correos ni registros de envío huérfanos; se reutiliza el mismo registro y se limpiaron los duplicados históricos.

## [13.560.1] - 2026-08-13
- **CI en verde otra vez**: la prueba de aislamiento financiero preparaba su escenario aprobando una factura de proveedor "a mano", algo que el nuevo candado de aprobaciones (13.560.0) ya no permite. Ahora la prueba usa el canal oficial y se agregó una prueba dedicada que verifica que la aprobación o rechazo directo siga bloqueado.

## [13.560.0] - 2026-08-13
- **Pago en lote a proveedor con el tipo de cambio correcto (RFE-01)**: un lote en EUR ya guarda la paridad EUR/MXN del DOF (antes guardaba la del dólar). Si el DOF de la fecha no está disponible, el pago queda bloqueado con un aviso claro en lugar de registrarse sin tipo de cambio.
- **Seguridad de aprobaciones en Cuentas por Pagar (RNF-07)**: aprobar o rechazar una factura de proveedor sólo es posible por el proceso oficial (valida rol, evita que quien capturó apruebe y deja bitácora). Se cerró el atajo que permitía cambiar el estado de aprobación directamente.
- **Rastreo público sin ruido interno (RUX-01)**: el enlace público sólo muestra hitos de la operación; los eventos internos, de semilla o de pruebas ya no se entregan ni se pintan.

## [13.559.3] - 2026-08-13
- Ajustes internos de tamaño de archivo exigidos por la auditoría de calidad: la construcción de alertas del proveedor y la persistencia del REP timbrado se separaron en módulos propios. Sin cambios de comportamiento visible.

## [13.559.2] - 2026-08-13
- **Calidad interna del detalle de proveedor (Olas 1–4)**: las notificaciones del expediente ahora usan el sistema central de avisos, las tablas navegan por fila (sin ligas sueltas en las columnas) y las respuestas del estado de cuenta y sus movimientos se validan con esquemas antes de calcular totales.
- Se agregaron mensajes en español para los errores `LC_ORG_SIN_CONTEXTO` y `LC_PROVEEDOR_INEXISTENTE`.
- Reglas de acceso del expediente de documentos de proveedor recreadas con el patrón idempotente de la auditoría interna (sin cambios de permisos).

## [13.559.1] - 2026-08-13
- **Corrección: el REP fallaba en facturas sin IVA** (`taxes es requerido`). Ahora el complemento de pago siempre envía el desglose de impuestos del documento relacionado y distingue facturas **exentas** (por ejemplo flete marítimo internacional) de las de **tasa 0%**. Los pagos con REP en error pueden reintentarse desde el historial de pagos.

## [13.559.0] - 2026-08-13
- **Ola 4 — Inteligencia del proveedor**: la pestaña "Salud" ahora es un tablero completo con alertas proactivas, desempeño de facturación, tendencia de 12 meses y comparativo contra otros proveedores del mismo tipo.
- **Alertas proactivas** ordenadas por severidad: facturas vencidas, datos bancarios incompletos cuando hay saldo por pagar, partidas de embarques cerrados que el proveedor nunca facturó, documentos vencidos y facturas o documentos por vencer.
- **Desempeño de facturación**: días promedio en facturar, desviación entre lo presupuestado y lo facturado (medida sólo sobre partidas ya facturadas), ticket promedio, % de partidas facturadas y top de conceptos y rutas por gasto.
- **Gráfica comprometido vs facturado vs pagado** por mes, en pesos, para ver el rezago del proveedor al facturar y el nuestro al pagar.
- **Comparativo de precios** por concepto contra otros proveedores del mismo tipo, con etiquetas Más caro / En línea / Más barato; sólo se publica con al menos 3 operaciones de cada lado.
- Aviso cuando falta el tipo de cambio del DOF, porque en ese caso los montos en dólares y euros no entran a los totales en pesos.
- Tests nuevos: dominio de semáforos, desviación, comparativo y alertas; mapeo de la RPC `proveedor_inteligencia` (incluye payload vacío y error); render de la tarjeta de alertas. Suite del módulo: 178 pruebas en verde.



## [13.558.0] - 2026-08-13
- **Corrección de KPIs del proveedor**: "Pagado" y "Pendiente" del detalle ya usan el pago real conciliado por partida (Ola 1) en lugar del estado antiguo todo-o-nada; antes una factura pagada a la mitad se veía como no pagada y, al cerrarse, como pagada al 100%.
- El **expediente documental** ahora distingue "falló la carga" de "no hay documentos": muestra alerta con el motivo y botón Reintentar.
- Las tablas de **operaciones** y de **estado de cuenta** regresan a la primera página al cambiar de filtro o de rango de fechas (antes podía quedarse en una página inexistente).
- La caché del expediente usa la clave central de proveedores, para que las invalidaciones siempre surtan efecto.
- Tests nuevos: pagos parciales en los KPIs, hooks del expediente (invalidación y mensajes de error), borrado de documento, falla de almacenamiento y estado de error de la pestaña. Suite del módulo: 156 pruebas en verde.

## [13.557.0] - 2026-08-13
- **Nueva pestaña "Expediente" en el detalle de proveedor** (Ola 3): resguardo de constancia de situación fiscal, opinión de cumplimiento, comprobante de datos bancarios, contratos y actas, con carga de archivos, fecha del documento y fecha de vencimiento.
- **Semáforo de completitud del expediente**: indica documentos faltantes, por vencer (30 días) y vencidos; los proveedores extranjeros sólo requieren el comprobante bancario.
- Descarga con **ligas firmadas temporales** y eliminación con doble confirmación; los archivos viven en `proveedores/{id}` con acceso restringido a la organización dueña.
- Nueva tabla `public.proveedor_documentos` con RLS por organización y permisos canónicos.
- Pruebas nuevas de vigencia, completitud del expediente y del servicio de carga (limpia el archivo si falla el registro).

## [13.556.0] - 2026-08-13
- **Nueva pestaña "Estado de cuenta" en el detalle de proveedor** (Ola 2): movimientos en orden cronológico con las facturas del proveedor como cargo y los pagos, notas de crédito y anticipos aplicados como abono, con **saldo corrido por moneda** (nunca se suman pesos con dólares).
- **Antigüedad de saldos por pagar** por moneda: Por vencer, 1 a 30, 31 a 60, 61 a 90 y más de 90 días, con conteo de facturas y total vencido.
- **Filtro por periodo** (desde / hasta, por omisión los últimos 12 meses) y **exportación a CSV y PDF** con resumen por moneda, antigüedad y detalle de movimientos, listos para conciliar con el proveedor.
- Nueva función de lectura `public.proveedor_estado_cuenta_movimientos` con permisos canónicos (sólo usuarios autenticados de la organización activa).

## [13.555.0] - 2026-08-13
- **Detalle de proveedor conciliado**: el "Historial de operaciones" ya no muestra sólo lo costeado en el expediente; ahora cada partida trae el monto facturado por el proveedor, el saldo por facturar, el folio de la factura ligada y su estado real (Por facturar / Facturado parcial / Facturado / Pagado / Sobrefacturado).
- Nueva tarjeta **"Comprometido sin factura del proveedor"** con el pendiente agrupado por moneda nativa (nunca se mezclan divisas), conteo de partidas sin respaldo y accesos directos a "Por capturar" y "Facturas".
- Aviso de **facturas con partidas sin vincular** a ningún costo, con liga directa a la factura para corregir la vinculación.
- Nueva pestaña **"Por facturar"** con contador, para dar seguimiento sólo a lo que falta que el proveedor facture.

## [13.554.1] - 2026-08-13
- Corregidos los fallos de CI: permisos canónicos (REVOKE/GRANT) para la función de utilidad por embarque, aviso de tipo de cambio separado en un módulo puro y nota de T/C del P&L dividida en componentes más simples.


## [13.554.0] - 2026-08-13
- El rol **Gerente Comercial** ya tiene escritura real en cotizaciones y en sus costos: antes la interfaz mostraba las acciones (enviar, aceptar, rechazar) pero la base de datos las rechazaba con "Permisos insuficientes".
- Nueva función `public.puede_escribir_cotizaciones()` como única fuente de verdad de los roles con escritura (Administrador, Administrador de organización, Operador y sus herederos, Ejecutivo de Pricing, Gerente Comercial y Super Admin); las políticas de `cotizaciones`, `cotizacion_costos` y la guardia `_assert_writer_cotizacion` ahora la usan.
- Se mantiene intacto el aislamiento por organización, la lectura de consultores/portal de clientes y la segregación de funciones (quien crea una cotización no la acepta).
- Nota en `permissionMatrix.ts` para que el grupo `SALES` y la función de base de datos se actualicen siempre juntos.



## [13.553.0] - 2026-08-13
- Trazabilidad del tipo de cambio en el detalle del embarque: la pestaña P&L ahora indica que el T/C quedó congelado al capturarlo, muestra el DOF de esa fecha y marca con un aviso si el valor fue capturado a mano y se aparta más de 0.5 % del DOF.
- Nueva acción **"Usar el del DOF"** en el P&L: alinea el T/C del embarque al DOF de su fecha, sólo en embarques abiertos y con registro en la bitácora (nunca automática, para no mover utilidades históricas).
- El wizard de embarques avisa en el paso de Costos y Precios cuando el T/C teclado se desvía del DOF sugerido, con un botón para adoptarlo.
- Corregida la nota del desglose de costos, que seguía diciendo que el KPI incluía impuestos.



## [13.552.0] - 2026-08-13
- Corregido el cálculo de utilidad por embarque: el costo real sumaba el **total con IVA** de las facturas de proveedor mientras la venta se comparaba sin IVA, lo que generaba márgenes falsos negativos (el expediente ELIMP00300 mostraba −246.50 en lugar de +10,287.50 MXN).
- El costo real ahora usa la base gravable (subtotal, o total menos IVA más retenciones en registros antiguos) y las notas de crédito de proveedor se descuentan en proporción a esa base.
- El monto pendiente de pago sigue calculándose con IVA, porque el flujo de efectivo se paga completo.
- Efecto: los checklists de cierre dejan de bloquear embarques por márgenes negativos inexistentes.



## [13.551.0] - 2026-08-12
- Modales de Tesorería y CxP con teclado (Ola A): **Movimiento manual**, **Ejecutar pago programado**, **Traspaso entre cuentas propias** y **Programar pago** ya son formularios reales: `Enter` guarda desde cualquier campo, el botón principal muestra su estado de carga y no permite dobles clics.
- Todas las etiquetas de esos modales quedaron ligadas a su control (incluido el campo de fecha) para lectores de pantalla.
- Nuevos componentes compartidos `FormDialogFooter` y soporte de `formId`/`onSubmit` en `FormDialogShell`, para que el resto de los modales adopten el mismo estándar sin repetir código.

## [13.550.0] - 2026-08-12

- Captura de fechas con teclado: el campo de fecha ya acepta `1/3/2026` y lo completa solo a `01/03/2026` (antes se descolocaba a `13/20/26`). También se puede abrir el calendario con `Alt+Flecha abajo` o `F4` y cerrarlo con `Esc`.
- Orden de tabulación del campo de fecha: el primer `Tab` cae directo en el input; los botones de calendario y de limpiar salieron del recorrido de tabulación.
- Modal **Registrar pago**: ahora es un formulario real —el foco inicia en la fecha, `Enter` guarda desde cualquier campo y todas las etiquetas quedaron ligadas a su control para lectores de pantalla.


## [13.549.0] - 2026-08-12
- Facturación · REP: al registrar un pago de una factura PPD, el timbrado automático del REP ya refresca el historial de pagos, la bandeja **REP pendientes** y la factura. Antes la pantalla quedaba con el estado previo y el botón **"Timbrar REP"** seguía visible aunque el REP ya existía (caso F977).
- Si alguien vuelve a presionar **"Timbrar REP"** en un pago que ya tiene REP, ahora se muestra un aviso informativo ("Este pago ya tenía su REP timbrado") y la pantalla se actualiza con el folio real, en lugar del error genérico *"El servicio en la nube rechazó la solicitud"*.
- Los errores de timbrado y cancelación de REP ahora muestran el mensaje real en español que devuelve el servicio (incluidas las validaciones fiscales detalladas) en vez del texto genérico del SDK. (Sentry JAVASCRIPT-REACT-52)

## [13.548.0] - 2026-08-12
- Detalle de factura (y las 23 pantallas de detalle que comparten el encabezado): se corrigió el acomodo entre **1024 y 1280 px** de ancho —el rango del preview y de muchas laptops—, donde la barra de acciones aplastaba la columna del título y el folio quedaba invisible o cortado detrás de los botones.
- La barra de acciones ahora baja a su propio renglón completo debajo de 1280 px y el título conserva un ancho mínimo legible; con esto también desaparece el hueco vertical vacío que se formaba antes de la cinta de totales.
- El riel de **Historial y actividad** se coloca al costado sólo desde 1280 px; debajo se apila al final, para que la tabla de conceptos no se corte en una columna angosta.
- Las pestañas del documento muestran un degradado en el borde derecho cuando hay más secciones a las que desplazarse.
- La tabla de conceptos usa la vista de tarjetas hasta 1024 px, evitando columnas de IVA e importe comprimidas.

## [13.547.0] - 2026-08-12
- Facturación: el botón **"Registrar pago"** ya aparece en facturas **Vencidas** y **Parcialmente pagadas** con saldo. Antes sólo se mostraba en estado "Emitida", así que una factura vencida no se podía cobrar desde su detalle aunque la base de datos sí lo permitía.
- Los estados Cancelada, Sustituida, Borrador, Por timbrar y Pagada siguen sin permitir cobros.


## [13.546.0] - 2026-08-12
- Cotizaciones: se corrigió el PDF que salía con importes en **$0.00**. La causa era que un renglón de costos con precio de venta pero **sin concepto** se descartaba en silencio al generar los conceptos de venta.
- El paso 2 del wizard ahora marca en rojo esos renglones y bloquea avanzar o guardar hasta capturar el concepto.
- El detalle muestra un aviso con el botón **"Sincronizar conceptos de venta desde costos"** cuando la venta guardada quedó en cero.
- Al editar costos desde el detalle ya no se pierde el precio de venta guardado.
- La descarga de PDF avisa y se detiene si la cotización suma $0.00, para no enviar documentos vacíos al cliente.


## [13.545.2] - 2026-08-12
- Embarques (cierre): las facturas al cliente con estado **Pagada** ya se consideran cobradas en el checklist de cierre, aunque el pago no esté capturado en tesorería (facturas históricas). Antes bloqueaban el cierre con "1 factura por cobrar".
- El detalle del check indica cuántas facturas se dan por cobradas sólo por su estado.
- Mismo criterio en el resumen de pendientes administrativos y en las alertas de Cierre operativo / Cierre administrativo.

## [13.545.1] - 2026-08-12
- Tesorería: se corrigió el error "No tienes permisos... folio secuencias" al registrar un traspaso entre cuentas propias; el folio TR- ahora se asigna con una función interna que valida la organización.

## [13.545.0] - 2026-08-12
- Embarques: el panel de alertas ahora separa **Cierre operativo** (embarques Entregado o EIR con documentos, cobros o pagos pendientes) de **Cierre administrativo** (embarques Por liquidar).
- Cada tarjeta sigue filtrando el listado al hacer clic; el total del badge del sidebar no cambia.


## [13.544.2] - 2026-08-12
- CxP: se corrigió el error que tumbaba el modal "Capturar factura de proveedor" al abrirlo desde /compras/facturas (aviso de cambios sin guardar incompatible con el router de la app).
- El aviso "¿Salir sin guardar?" ahora funciona en todos los formularios largos (CxP, conceptos de factura y wizard de embarques) al hacer clic en enlaces internos o cerrar la pestaña.


## [13.544.1] - 2026-08-12
- Arquitectura: se dividieron el listado de embarques y el modal de traspasos en componentes más chicos (tarjeta móvil y selector de cuenta) para respetar el límite de 200 líneas por archivo; sin cambios visibles para el usuario.


## [13.544.0] - 2026-08-12
- Tesorería: nueva edición de cuentas bancarias (botón de lápiz en cada tarjeta) para corregir banco, alias, número, CLABE, saldo inicial y fecha de corte; el cambio queda en la bitácora.
- Tesorería: al modificar el saldo inicial o su fecha de corte se muestra un aviso de que se recalculan saldos y conciliación; la moneda no se puede cambiar si la cuenta ya tiene movimientos.
- Datos: se corrigió el saldo inicial de la cuenta BBVA MXN (467,788.69 → 535,548.69) al corte del 06/08/2026.


## [13.543.3] - 2026-08-12
- Observabilidad: los rechazos de sesión (401 "No autorizado" / "Token inválido") ya no se reportan como error en Sentry; siguen quedando en los logs de la función. Cierra JAVASCRIPT-REACT-50.

## [13.543.2] - 2026-08-12
- Calidad de código: los correos de autenticación, el timbrado de REP y la recuperación de timbrados se dividieron en módulos más chicos (sin cambios funcionales) para que el CI pase el lint estricto.
- Cobros: la validación de la fecha del pago vive en su propio archivo; mismas reglas y mensajes que antes.

## [13.543.1] - 2026-08-12
- Rastreo público: se re-aplicaron los permisos de ejecución de la función del enlace público (auditoría H6-15); sin cambios funcionales.
- Portal de clientes: los datos de cliente, contacto y organización se validan en el boundary (adopción de zod, ratchet en 0).
- Calidad de código: se dividieron los manejadores de `demo-access` y `facturapi-reconciliar-cancelaciones` en funciones auxiliares para bajar la complejidad y pasar ESLint.

## [13.543.0] - 2026-08-12
- Correos de acceso: los correos de autenticación (invitación, confirmación, restablecimiento, enlace mágico, cambio de correo y código de verificación) ya salen por el dominio del proyecto con la identidad visual de Libre Carga y en español mexicano. Antes la invitación se creaba en la plataforma pero el correo nunca se entregaba.
- Usuarios: al dar de alta un usuario el aviso explica que la invitación puede tardar y cómo reenviar el acceso con "Restablecer contraseña".


## [13.542.0] - 2026-08-12
- Tesorería: los traspasos entre cuentas de distinta moneda exigen tipo de cambio; el servicio ya no envía 1 por omisión y se sugiere el TC DOF de la fecha del traspaso (BL-04).
- Facturación: al fallar la descarga de PDF/XML se muestra un mensaje accionable en español; el detalle técnico queda sólo en el log (UIA-13).
- Accesibilidad: `FormField` liga la etiqueta al control con `htmlFor`/`id` y anuncia el error con `aria-describedby` (UX-04).
- Design system: `Label` gana la variante `size="sm"` para formularios densos, documentada en `docs/design-system.md` (UX-08).
- Formularios: el aviso de "cambios sin guardar" se extiende al wizard de embarques y al editor de conceptos de factura (FE-11).


## [13.541.0] - 2026-08-12
- Comisiones: el alta de vendedora valida el porcentaje (0-100) igual que la edición y el campo acepta sólo ese rango (FE-08).
- Facturación manual: el total en MXN que valida el límite de crédito se calcula con el canon de dinero (redondeo por línea), evitando diferencias de centavos contra el total timbrado (FE-12).
- Herramientas: README y `package.json` declaran Node 22+ como requisito real (Node 20 rompe las pruebas por falta de WebSocket nativo) (TC-01).
- Limpieza: se eliminó la directiva muerta `"use memo"` de 9 rutas; ya no genera ruido en el build (TC-03).
- Build: documentada la excepción conocida del chunk `react-pdf.browser` en `vite.config.ts` (TC-04).

## [13.540.0] - 2026-08-12
- Design system: badges y encabezados de tablas de reparto usan los tokens `text-2xs` y `text-table-head`; cifras KPI de Cartera, Dirección, Operaciones y P&L migradas al token `text-kpi` (UX-12, UX-09).
- Accesibilidad: 8 botones solo-icono y 15 interruptores de catálogos/CRM/Admin ahora tienen nombre accesible en español; el botón de la barra lateral se anuncia en es-MX (UX-06, UX-07).
- Botones: 56 formularios dejan de reimplementar el spinner y usan la prop `loading` del botón (spinner + deshabilitado + `aria-busy`) (UX-11).
- Móvil: los diálogos de formulario pasan a una sola columna en pantallas angostas (`grid-cols-1 sm:grid-cols-2`) (UX-13).
- Mensajes: montos visibles en avisos de CxP y alertas ejecutivas usan separador de miles y la fecha de conciliación muestra el año completo (UX-10).
- Arquitectura: nuevo guardrail que congela la deuda de tablas `<table>` crudas y falla si se agrega una nueva (UX-03).
- Nuevo cascarón compartido `LoteRenglonesTable` para las tablas de pago/cobro en lote (UX-12).

## [13.539.0] - 2026-08-12
- P&L del embarque: los tipos de cambio ausentes muestran "—" en lugar de "0.0000" y el margen real dice "n/a" cuando aún no hay venta real (UIA-10).
- P&L del embarque: nota que explica por qué el desglose por concepto (subtotales) puede diferir del KPI "Costo real" (con impuestos y notas de crédito) (UIA-10).
- Tracking: el stepper de fases ya no se anuncia dos veces con lector de pantalla; el canal accesible es la barra de progreso (UIA-17).
- Catálogos (navieras, puertos, tipos de contenedor): el botón de eliminar se deshabilita durante el borrado para evitar dobles envíos (FE-09).



## [13.538.0] - 2026-08-12
- Cobro en lote de cliente: nuevos atajos "Repartir FIFO", "Liquidar todo" y "Limpiar reparto", más un botón para asignar el sobrante automáticamente.
- Cobro en lote de cliente: cada renglón muestra chip de vencimiento, aviso de complemento de pago (REP) y botón para aplicar el saldo de esa factura.
- Cobro en lote de cliente: los excesos de saldo se marcan en el renglón exacto y el resumen compara Recibido / Repartido / Sin asignar. El foco inicia en "Importe recibido".



## [13.537.0] - 2026-08-12
- Cobranza: el rol **tesorero** ya puede registrar cobros de facturas de cliente (individuales y en lote). La base de datos siempre se lo permitía, pero la interfaz le escondía el botón (FE-10).

## [13.536.0] - 2026-08-12
- Embarques: cuando la búsqueda o los filtros no devuelven resultados, la tabla muestra un aviso con el botón "Limpiar filtros" (UIA-15).
- Embarques: se restauró el botón "Nuevo embarque" para todos los roles; si el alta directa no aplica, explica que los expedientes nacen de una cotización aceptada y lleva a Cotizaciones (UIA-16).
- Embarques: el encabezado dice "N embarques" cuando no hay filtro de estado (antes decía "contenedores" con el total de expedientes) (UIA-09).
- Cotizaciones: la vigencia también se muestra en cotizaciones aceptadas y el detalle ya no imprime "7 días (-)" cuando falta la fecha (UIA-14).
- Detalle de embarque y de factura: la pestaña del navegador ahora muestra el folio (UIA-12).

## [13.535.0] - 2026-08-12
- Tracking público: nueva tarjeta "Estatus del embarque" con etapa actual, ETD y ETA (o "Por confirmar" si aún no hay fecha) y barra de avance documental.
- Nueva sección "Documentos del expediente" que separa recibidos y faltantes según la etapa y el modo de transporte, e indica enviar los faltantes al ejecutivo de cuenta.
- `get_tracking_public` ahora devuelve el avance documental (sólo nombre, estado y si ya se recibió): no se exponen archivos ni notas internas.

## [13.534.0] - 2026-08-12
- Portal público: los errores de enlace ahora explican qué falta y cómo corregirlo (abrir el enlace más reciente, pegar la dirección completa, pedir uno nuevo) mediante el nuevo componente `AvisoAccionable`.
- Tracking público: enlace inválido/servicio no disponible y la línea de tiempo sin eventos muestran pasos concretos en vez de un texto seco.
- Portal de proformas: enlace inválido y enlace vencido usan el aviso accionable; si falla la respuesta se listan los pasos de reintento.
- Baja de correos: enlace inválido y falla al procesar incluyen alternativas (reintentar o responder al correo).
- Nuevos textos centralizados `COPY_PASOS` y `COPY_VACIO` en `src/lib/copy/publicoCopy.ts`.

## [13.533.0] - 2026-08-12
- Copy único para superficies públicas en `src/lib/copy/publicoCopy.ts`: enlaces vencidos, validaciones, pie de página, baja de correos y avisos legales usan la misma redacción en español mexicano.
- Tracking público: se elimina "Powered by" (ahora "Con tecnología de") y el título de respaldo es "Seguimiento de embarque".
- Baja de correos (`/unsubscribe`): todos los estados (validando, inválido, ya dado de baja, procesando, éxito, falla) toman el copy centralizado.
- Portal de proformas: al fallar la respuesta ya no se muestra `error.message` crudo y el motivo de rechazo pide "al menos 3 caracteres".
- Solicitar cotización (portal): origen y destino muestran ayuda de campo obligatorio y el formulario indica qué falta para poder enviar.

## [13.532.0] - 2026-08-12
- Portal del cliente (Sub-ola 7): las navieras se muestran con nombre comercial ("Maersk (MAEU)") en tarjetas de embarque, resumen y tracking público; si el código no está mapeado se muestra tal cual.
- El contador del tab "Tracking" ahora cuenta los mismos hitos que se ven en la línea de tiempo (ya no incluye eventos internos).
- Una cotización sin importe todavía muestra "Por cotizar" en vez de "MXN 0.00".
- `/agente/tarifas`: la vigencia se muestra en formato dd/MM/yy en vez de ISO crudo.
- El dashboard del portal saluda a la persona de contacto ("¡Hola, Juan!") y sólo usa la razón social como respaldo.

## [13.531.0] - 2026-08-20
- Portales públicos (Sub-ola 6): Aviso de Privacidad y Términos quedan tras la bandera `LEGAL_CONTENT_APPROVED` mostrando un aviso neutral "en revisión" mientras no haya validación legal.
- Tracking público, demo, login, portal del cliente y baja de correos ya no muestran errores técnicos en inglés: se traducen a copy es-MX y el detalle crudo va sólo a consola/Sentry.
- Login valida email y contraseña antes de llamar al servidor; "Mi perfil" del portal usa el patrón estándar de carga con botón "Reintentar" y un error de red ya no se confunde con "cuenta sin empresa vinculada".
- Interno: se dividieron `catalogos/services`, `tesoreria/domain/resumen` y el diálogo de demo para respetar el límite de 200 líneas.

## [13.530.0] - 2026-08-12
- Auditoría Wave 1 — Sub-ola 5 (robustez fiscal y financiera residual). Los puntos EF-05 a EF-08 (timeouts SAT/cancelaciones, respaldo de XML, dedupe atómico del webhook y guardas de eventos fuera de orden) ya venían aplicados en versiones anteriores; se verificaron y quedan cerrados.
- BL-10 — Las cuentas bancarias eliminadas ya no reaparecen en los selectores de bitácora de tesorería ni en el listado de cuentas: el listado siempre ignora cuentas borradas. Las cuentas sólo inactivas (no borradas) siguen visibles cuando se piden.
- BL-11 — Dashboard ejecutivo: los gastos de proveedor en euros sin embarque ligado (típicos de Venta y Administración) ya se convierten a pesos con el tipo de cambio del DOF vigente a la fecha de la factura, en vez de quedar fuera del indicador de gastos operativos. Los gastos en dólares y los euros con embarque no cambian.

## [13.529.0] - 2026-08-12
- Auditoría Wave 1 — Sub-ola 4 (exposición pública y fugas): EF-10 (las 11 funciones fiscales autenticadas ya responden con la lista blanca de dominios en vez de permitir a cualquier sitio; un sitio ajeno recibe `null`), EF-11 (la prueba de conexión con FacturApi devuelve el código de error real —401/403/504— en vez de un "éxito" con el error escondido en el cuerpo; la pantalla de Configuración sigue mostrando el mensaje amigable).
- EF-12 — El proceso automático que reconcilia cancelaciones ya no se traga los errores: cada fallo queda en consola y en Sentry con el id de la factura o nota de crédito, y si el lote llega al tope de 200 avisa que hay rezago acumulado.
- EF-13 — Sin fugas en registros: el enlace de baja de correos ya sólo registra los primeros 8 caracteres del token, se quitaron los prefijos de llaves en los logs de la cola de correos y los mensajes enviados a Sentry ocultan `?token=`, `?api_key=` y credenciales `Bearer`.
- UIB-07 — La vista interna de QA del logo (`/logo-preview`) sólo existe en desarrollo; en producción muestra la página de "no encontrado".
- TC-02 — Nuevo comando `build:low-mem` para compilar sin sourcemaps en máquinas con poca memoria (~4 GB); el build normal no cambia. Requisito de RAM documentado en el README.

## [13.528.2] - 2026-08-12
- Cobertura RLS: la tabla interna `demo_seed_state` (creada en EF-09) tenía la protección activada pero sin ninguna regla escrita, lo que el verificador de CI marcaba como hueco. Ahora tiene una regla explícita de "nadie puede leer ni escribir" para usuarios de la app; sólo los procesos internos la usan.

## [13.528.1] - 2026-08-12
- CI verde: se actualizaron 10 pruebas que seguían esperando el contrato anterior a las Olas 3 y 4 (filtro `deleted_at` en leads/actividades de CRM, campos nuevos `esFallback`/`fechaAplicada` del tipo de cambio, título fijo de `notifyError` en el backfill legacy y fixture de fecha LOCAL en los KPIs de Dirección tras FE-04).
- ESLint: el canon de "días vencido" de facturas se promovió a `src/lib/domain/facturaDiasVencido.ts` (las bandejas ya no importan `facturacion/domain`) y la captura de factura de proveedor bajó su complejidad extrayendo derivados puros a `_sections/capturaDerivados.ts`.
- Auditoría H6: `siguiente_folio_proveedor` ahora revoca el acceso público antes de otorgar permisos a usuarios autenticados y procesos internos.

## [13.528.0] - 2026-08-12
- Auditoría Wave 1 (P2) — Sub-ola 4/6 (Edge Functions): EF-05 (timeout de 12 s en la consulta al SAT y tope de 50 facturas por corrida en `verificar-sat-lote`, para que el lote quepa en el tiempo máximo de la función; las 3 cancelaciones — factura, REP y nota de crédito — envuelven `invoices.cancel` con timeout y devuelven 504 con bitácora en lugar de colgarse).
- EF-06 — Webhook de facturación a prueba de eventos fuera de orden: un `receipt.status_updated(valid)` tardío ya no resucita un REP cancelado y un `cancellation_status_updated(pending)` retrasado ya no regresa una cancelación aceptada.
- EF-07 — Deduplicación atómica del webhook (INSERT-first sobre el único `organization_id + event_id`): dos entregas simultáneas del mismo evento ya no se procesan doble; si el procesamiento falla se libera la reserva para que el reintento funcione.
- EF-08 — El respaldo del XML timbrado tiene timeout de 12 s: si Facturapi cuelga, la factura/NC/REP sí se persiste (respaldo marcado como error) en vez de dejar un CFDI huérfano.
- EF-09 — `demo-access`: rate limit persistente (5 por minuto por IP, fail-closed) y nueva tabla interna `demo_seed_state` para no re-sembrar los datos demo si ya se sembraron hace menos de 10 minutos.


## [13.527.0] - 2026-08-12
- Auditoría Wave 1 (P2) — Sub-ola 3/6 (fechas y listados): FE-04 (las fechas-calendario se calculan en hora local con `format(d, "yyyy-MM-dd")`: la vigencia de cotización ya no se adelanta un día cuando se cotiza después de las 18:00, el badge "Vence en Nd" de la tabla deja de correrse medio día y los KPIs de arribos/demoras del dashboard de Dirección no cambian de día a las 18:00), FE-05 (`limit(1000)` explícito en los listados de cotizaciones para que el corte silencioso de PostgREST sea visible), UIA-07 (los días vencido de Cartera se recalculan en el cliente desde `fecha_vencimiento`, así una factura que vence en 10 días muestra "Vence en 10d" y no "Vence hoy" aunque la función de base de datos devuelva 0) y UIA-08 (el fallo del servicio de tipo de cambio ya no dispara el aviso global "No pudimos cargar la información": degrada en silencio porque la UI ya indica "TC no disponible").
- FE-11 — Nuevo `useDirtyGuard`: la captura de factura de proveedor avisa "¿Salir sin guardar?" antes de navegar a otra pantalla y muestra el aviso nativo del navegador al cerrar o recargar la pestaña con datos capturados.
- Tests — 3 casos para la vigencia en hora local y 4 para los días vencido de Cartera; actualizadas las pruebas de vigencia que usaban medianoche UTC como fecha base.

## [13.526.0] - 2026-08-12
- Auditoría Wave 1 (P2) — Sub-ola 2/6 (Tesorería / pagos, frontend): FE-02 (el diálogo de cobro CxC ya no borra lo capturado cuando un refetch invalida las queries: inicialización una sola vez por apertura/factura), FE-03 + UIA-06 (validación de fecha del cobro: no futura y no anterior a la emisión, con mensaje inline y guard en el handler; facturas legacy sin `fecha_emision` sólo validan futuro), FE-06 (captura CxP rechaza componentes negativos, vencimiento anterior a la emisión y tipo de cambio mayor a 1000) y FE-07 (traspasos: preview redondeado con `roundMoney` para coincidir centavo a centavo con la RPC, fecha obligatoria y no futura, y aclaración de la dirección del tipo de cambio).
- Tests — 5 casos nuevos para `validarFechaPago` y 5 para las reglas FE-06 del schema de CxP. Corregidas 6 aserciones de pruebas de facturación que seguían leyendo el detalle técnico del error en `title` cuando UX-02 lo movió a `description`.

## [13.525.0] - 2026-08-12
- Auditoría Wave 1 (P2) — Sub-ola 1/6 cerrada: BL-03 (guard de membresía en `siguiente_folio_proveedor` para evitar quema de folios FP- ajenos), BL-05 (`calcular_comision_pago` ya no aborta el pago cuando faltan tipos de cambio del embarque; la comisión queda en 0 y se recalcula después), BL-06 (lecturas de notas de crédito CxC/CxP ahora excluyen soft-borradas, consistente con los guards de saldo), BL-07 (`dependenciasFinancieras` de embarques ya no cuenta facturas/pagos/NCs soft-borradas), BL-08 (re-asegurado `search_path` y grants de funciones `email_infra`) y BL-09 (folio de traspasos bancarios migrado de `MAX()+1` a `folio_secuencias` para evitar carreras). BL-04 ya estaba corregido en Wave 0.

## [13.524.0] - 2026-08-12
- Auditoría Wave 0 (bloqueantes) — validados y corregidos: BL-01 (soft-delete de CRM ahora filtrado en 11 servicios de lectura + guardrail `crm-soft-delete-reads`), BL-02 (`registrar_bitacora` con guard de organización/identidad), BL-04 (tipo de cambio obligatorio en traspasos cross-moneda: `LC_TRASPASO_TC_REQUERIDO`), N1 (eliminada sobrecarga ambigua de `log_client_error_v1`), EF-01 (timbrado de REP idempotente con `facturapi_rep_claim_at` y `liberar_claim_rep_huerfano`), EF-03 (acuse SAT de cancelación en notas de crédito), EF-04 (el fallback EUR 18.5 ya no se presenta como TC real y no se precarga en anticipos) y UX-02 (mensajes de error en es-MX).

## [13.523.2] - 2026-08-12
- Documentación — agregados al repo los 7 fix packs de la auditoría integral v13.523.1 en `docs/audit-fixes/` (`FIXES_LOVABLE_COMPLETO.md`, `fixes_BL.md`, `fixes_FE.md`, `fixes_UIA.md`, `fixes_UIB.md`, `fixes_UX.md`, `fixes_TC_N.md`) y enlazados desde `ARCHITECTURE.md` §21 junto al pack existente de Edge Functions. Sin cambios de código.

## [13.523.1] - 2026-08-12
- Deuda (código muerto) — `knip --strict` quedó rojo tras borrar los tests triviales: esos tests eran los únicos consumidores de varios símbolos. Eliminado el código sin uso real: archivo `src/constants/cache.ts`; `CONCEPTOS_COSTO_USD` y `CONCEPTOS_COSTO_MXN` (`cotizacionConstants.ts`, reemplazados hace tiempo por el selector dinámico de conceptos); `CATEGORIAS_PROVEEDOR` y `labelSubtipoGasto` (`proveedorConstants.ts`); hooks `useTraspasos` y `useCancelarTraspaso` (sólo `useRegistrarTraspaso` está en uso); y re-exports muertos de barrel (`EXTENSIONES_ENTRANTES`, `ParejaArchivosEntrantes` en `facturasEntrantes.ts`, `EstadoProveedorFactura` en `proveedorFacturas.ts`). 0 cambios en lógica de negocio; `lint`, `lint:unused:strict`, `typecheck` y la suite completa (1016 archivos / 6805 tests) en verde.

## [13.523.0] - 2026-08-12
- Tests (limpieza) — borrados 7 tests triviales sin valor: 3 tests de barrel que sólo hacían `expect(fn).toBeDefined()` (`auditoria`, `cxp`, `presupuesto` en `services/__tests__/index.test.ts`) y 4 tests de constantes literales (`useTasaIVA.test.tsx`, `embarqueConstants.test.ts`, `constantsSmoke.test.ts`, `pdf/theme/tokens.test.ts`). Los otros 16 tests de barrels sí ejercitan Supabase/RPCs y se conservan; `estados-embarque-sync.test.ts` se conserva como guardrail de la máquina de estados.
- Config — eliminado el script `test:shards:serial` de `package.json` (sin uso). Removida de `src/test/setup.ts` la instrumentación de debug `[shard-trace]` FILE_START/FILE_END (y el import `beforeAll` que quedó sin uso). Corregido el comentario de thresholds en `vitest.config.ts`: decía `@vitest/coverage-v8 v4.1.9` cuando la versión instalada es `3.2.4`; los valores de los umbrales quedan idénticos.
- Verificación: `lint`, `typecheck` y suite completa en verde (1016 archivos / 6805 tests).


## [13.522.1] - 2026-08-12
- CI (fix) — `deno test` del job `edge-functions` regresa a `--no-check`. Al activar el typecheck completo en v13.521.0 aparecieron 43 falsos positivos propios del checker de Deno (directivas `@ts-expect-error` marcadas como "sin usar" para globals de `Deno`, y desajustes entre los tipos generados de Supabase y `SupabaseClient`), que bloqueaban el CI sin representar bugs reales. El typecheck de la app sigue cubierto por el job `typecheck`.

## [13.522.0] - 2026-08-12
- CI (guard preventivo) — los jobs `typecheck` y `build` de `ci.yml` ahora verifican que `src/constants/appVersion.ts` no esté vacío y que exporte `APP_VERSION` antes de correr. Si falla, aborta con un mensaje claro (`::error::`) en lugar del error críptico de Rollup/tsc en cascada. Previene la recurrencia de la regresión de v13.521.0 donde el archivo quedó vacío.

## [13.521.0] - 2026-08-12
- CI (simplificación) — se eliminaron 4 workflows sin valor real: `deploy-gate` (el deploy es manual vía Lovable), `release-compatibility` (no hacemos releases versionados; también se borraron `scripts/db/release-manifest.ts`, los scripts `db:release-manifest:*` de `package.json` y `docs/ops/release-manifest.md`; `supabase/releases/` queda como histórico), `install-canary` y `deno-typecheck`.
- CI — el job `edge-functions` de `ci.yml` ahora corre `deno test` **con** typecheck completo (se quitó `--no-check`), absorbiendo el workflow eliminado.
- CI — `codeql.yml` queda sólo con `schedule` semanal + `workflow_dispatch` (sin push/PR). `e2e.yml` queda sólo con `schedule` nocturno + `workflow_dispatch` (se eliminaron `workflow_run`, `pull_request` y el job `guard-workflow-run`). `post-deploy-smoke.yml` conserva sus smoke tests pero pasa a `schedule` semanal (lunes) + `workflow_dispatch`, sin `repository_dispatch`.
- Fix — se restauró `src/constants/appVersion.ts`, que había quedado vacío y rompía el build/typecheck en 14 archivos.


## [13.520.1] - 2026-08-11
- CI (`audit:migrations` H6) — la migración de rate-limit de RPCs anónimas ahora declara permisos explícitos (`REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE` a `anon`, `authenticated`, `service_role`) para las 4 funciones `SECURITY DEFINER` que reemplaza. Los permisos re-declarados son idénticos a los ya vigentes en la base de datos; sin cambio funcional.

## [13.520.0] - 2026-08-11
- Fix (facturación) — las facturas borradas lógicamente ya no aparecen como pendientes de pago. La bandeja "Vencidas" mostraba 6 duplicados legacy con `deleted_at` (726-DUP-*, 755-DUP-fe48bee7, 848, 900-DUP-c741c8c7) porque `fetchCobranza` filtraba por estado pero no por borrado lógico. Se agregó `.is("deleted_at", null)` en cobranza, conteos y listados de bandejas (`bandejas.ts`), estado de cuenta, exportaciones de cartera/Aging (`exports.ts`), financieros del cliente, portal del cliente, hueco de facturación y EERR devengado. Sin migración ni cambio de datos.
- Guardrail — nuevo test de arquitectura `facturas-soft-delete-reads` que falla si alguna lectura de `facturas` omite el filtro de borrado lógico (con lista de exentos para lecturas por id intencionales).

## [13.519.1] - 2026-08-11
- Datos (corrección manual) — se marcaron como **Pagada** las 25 facturas legacy (número sin prefijo `F`, emitidas fuera del sistema) que estaban en `Vencida`/`Borrador`: 18 de Elogistix (103,194.10 USD + 86,420 MXN) y 8 de la organización demo. Se agregó la nota `[Legacy] Cobrada en sistema anterior; pago no registrado en la app.` en las 31 facturas legacy sin pago registrado. No se crearon pagos (sin impacto en flujo de caja, conciliación ni REPs) y no se tocaron montos, monedas, fechas ni clientes. Total legacy: 133, todas en Pagada.

## [13.519.0] - 2026-08-11
- Seguridad BD (`rate_limit_anon_rpcs`) — las 4 RPCs ejecutables por `anon` ahora invocan `public.check_ratelimit` al inicio del cuerpo, con clave `rpc:<nombre>:<x-forwarded-for>:<auth.uid()|anon>` y fail-CLOSED (`RAISE EXCEPTION` P0001 con `retry_after`): `log_client_error_v1` 20/60s (cierra la inserción ilimitada de filas ~14 KB en `app_logs`), `get_tracking_public` 60/60s, `portal_obtener_proforma_por_token` 30/60s y `portal_responder_por_token` 10/60s. Lógica, GRANTs, `SECURITY DEFINER` y `search_path` intactos; las dos funciones de lectura pasan de `STABLE` a `VOLATILE` porque `check_ratelimit` escribe en `ratelimit_buckets`. `demo_leads` no tiene RPC de inserción (entra por política), así que queda documentado en la migración sin cambiar políticas.



## [13.518.1] - 2026-08-11
- Seguridad CI — `e2e.yml`: el job `guard-secrets` (y por dependencia toda la suite con el environment `e2e-staging`) ya sólo corre en PRs de ramas internas del repo, evitando que un PR de fork que edite un spec exfiltre los secrets de staging. Gates anti-skip intactos.
- Seguridad CI — `release-compatibility.yml`: el step "Auto-heal manifest" ya no interpola `${{ steps.versions.outputs.current }}` dentro del `run:`; ahora pasa por `env: APP_VERSION_CURRENT` y se usa como `"$APP_VERSION_CURRENT"` (evita inyección de script). `actions/github-script` ya estaba en v8 en todos los workflows, incluido `deploy-gate.yml`.

## [13.518.0] - 2026-08-11
- Infra (sin aplicar) — dos migraciones nuevas creadas tal cual: `20260819120000_rls_auth_uid_initplan_backport.sql` (P3: envuelve `auth.uid()`/`auth.jwt()` crudos en `(SELECT ...)` en todas las políticas RLS vivas de `public` y `storage.objects`, con verificación final que aborta si queda alguna cruda) y `20260819120100_db_limpieza_indices_force_rls.sql` (P4: DROP de índices duplicados, `FORCE ROW LEVEL SECURITY` en tablas de dinero y `DO` de verificación de cobertura de índices).

## [13.517.1] - 2026-08-11
- CI — `release-compatibility` ahora es auto-curativo: en `push` a main regenera `supabase/releases/migration-manifest.json` y lo commitea con `[skip ci]` en vez de fallar; en `pull_request` sigue fallando duro. Se regeneró el manifest faltante para la versión actual.

## [13.517.0] - 2026-08-11
- Infra — nueva migración `20260819110000_storage_buckets_infra_drift.sql`: registra en el historial los buckets privados `cotizaciones-pdf`, `facturas-pdf`, `cxp-inbox` y `agente-cartas-garantia` (creados a mano → drift) forzando `public = false`, más un guardarraíl `DO $$` que aborta si falta alguno de los 7 buckets requeridos. Idempotente y no-op en producción (los 7 ya existen y están privados); cierra el drift para entornos nuevos y para la restauración del snapshot en CI.

## [13.516.1] - 2026-08-11
- Fix CI — `drift-corte.env` contenía comentarios (`#`) que rompían `cat >> $GITHUB_ENV` ("Unable to process file command 'env'"). Reemplazado `cat` por `grep -E '^[A-Za-z_][A-Za-z0-9_]*='` en `rls-tests.yml` y `deploy-gate.yml` para inyectar sólo pares `KEY=VALUE` válidos.

## [13.516.0] - 2026-08-11
- Auditoría — Fase 4 (cobertura de los módulos de dinero). 64 tests nuevos en los módulos que estaban sin red de seguridad:
- `src/features/cobranza/` (antes 0 tests): 18 tests para los servicios de estado de cuenta y recordatorio de cobranza y sus dos hooks (camino feliz, `error` de Supabase, listas vacías y montos en distinta moneda).
- `src/features/cxc/` (antes 1 de 9 archivos): 18 tests para `cxcAging`, `cxcAgingExport` y `useCxcAging` — buckets de antigüedad, días vencidos, etiquetado/conversión de moneda en la exportación y errores de Supabase.
- `src/features/portal-agente/` (antes 0 de 14): 21 tests que verifican el **scoping por agente** (las consultas van por RPC/RLS, sin filtros manipulables desde el cliente), el aislamiento de `queryKey` por organización y las respuestas vacías/nulas.
- `src/features/anticipos-proveedor/__tests__/hooks.test.ts`: se reescribió — hacía aritmética con variables locales sin importar nada; ahora ejercita `useAnticiposProveedor` real (mapeo `aplicado = monto - saldo_disponible`, `disponible`, estabilidad de la queryKey por filtros y estado de error).
- Verificación: 80 tests en verde en los 4 módulos (16 archivos).

## [13.515.0] - 2026-08-11
- Auditoría — Fase 3 (RLS y seguridad). Nueva migración de endurecimiento:
- El rol anónimo ya no tiene `USAGE` sobre el esquema `extensions` (superficie de ataque innecesaria).
- Las 4 funciones de la cola de correo (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`) quedan sólo para `service_role`: `authenticated` ya no puede encolar, leer ni borrar correo desde el cliente.
- Performance RLS: se envolvió `auth.uid()` en `(select auth.uid())` en las 2 políticas de `public` que aún lo llamaban por fila (`nav_events insert own org` y `Super admin maneja su tenant activo`). El resto de las 276 políticas ya estaba envuelto.
- Índices para predicados RLS: `idx_pagos_proveedor_lote_org` e `idx_cotizacion_costos_historico_org`. Las demás tablas señaladas por la guía ya quedaban cubiertas por su PK o por índices únicos que arrancan con `organization_id` (se verificó contra `pg_indexes`).
- Decisiones documentadas en la migración: (a) **no** se revoca `EXECUTE` a `anon` sobre `has_role`, `current_agente_id` y `current_agente_org` — hay políticas vivas con `roles = {public}` que las invocan y revocar produciría `42501` en sesiones anónimas o expiradas (siguen en la whitelist FIX-45 y devuelven NULL/false sin `uid`); (b) **no** se dropean `_backup_merge_*_20260602` por instrucción del dueño; (c) los 4 buckets privados ya existían.

## [13.514.0] - 2026-08-11
- Auditoría CI/tests — Fase 2 (optimización de CI, parte 2/2). Se atacó el desperdicio de runners en los workflows de base de datos:
- `rls-tests.yml`: los **25 jobs "1 suite = 1 job" se agruparon en 5 jobs** (`aislamiento`, `financiero`, `operaciones`, `roles`, `costeo`). Cada job levantaba su propio Postgres y hacía `pg_restore` del snapshot (~40 s) para correr un `.sql` de ~10 s; ahora se restaura una vez por grupo y las suites corren en serie dentro del job, sin cortar en la primera falla (un PR ve todos los fallos del grupo de una vez). Los grupos siguen corriendo en paralelo, así que el reloj de pared casi no cambia y el consumo de runners baja ~5x.
- El guard de "verde vacío prohibido" se adaptó: ahora lee las líneas `suites:` de `matrix.include` y además falla si una suite quedó declarada en dos grupos (correría doble sin cubrir nada nuevo). Sigue siendo imposible agregar un `test_rls_*.sql` y que el CI pase en verde sin ejecutarlo.
- Nuevo `supabase/tests/rls/_ci_roles.sql`: la creación de los 7 roles de Supabase (`anon`, `authenticated`, `service_role`, …) estaba **copiada 6 veces** (5 bloques inline en el workflow + `_ci_bootstrap.sql`). Ahora vive en un solo archivo idempotente que el workflow invoca con `-f` y el bootstrap con `\ir`.
- `deploy-gate.yml`: se eliminó el job `suite-rls`, que hacía polling contra la API de Actions **hasta 25 minutos** con un runner facturado sin hacer nada. Ahora el gate se dispara por `workflow_run` cuando `rls-tests` termina y lee su conclusión del evento; si el commit no toca `supabase/**` (y por lo tanto `rls-tests` no corre), el gate se dispara en el push y marca RLS como "no aplica". Ningún push a `main` queda sin gate.
- El corte del radar de drift dejó de estar duplicado (`DRIFT_BASELINE` en `deploy-gate.yml` vs `DRIFT_CORTE` en `rls-tests.yml`, que podían divergir en silencio): ahora es una fuente única, `supabase/tests/rls/drift-corte.env`, que ambos workflows cargan al `GITHUB_ENV`.
- Se unificó `actions/github-script` a `v8.0.0` en los 7 workflows que lo usaban.


## [13.513.0] - 2026-08-11
- Auditoría CI/tests — Fase 1 (limpieza rápida): se eliminaron `codecov.yml` y `vitest.fast.config.ts` (config muerta/redundante) y el shim deprecado `src/test/utils/_supabaseChainMock.ts`; los ~20 tests que lo importaban ahora apuntan a la fuente única `@/services/__tests__/_supabaseChainMock`.
- `src/test/setup.ts`: `afterEach` adelgazado (se movieron `cleanupPdfFontCache` y el GC al `afterAll` por archivo y se eliminó el `vi.clearAllMocks()` duplicado, que ya corre en `beforeEach`); comentarios obsoletos sobre `maxForks=1`/`fileParallelism=false` corregidos aquí y en `queryWrapper.tsx`.
- `.gitignore`: se ignora todo `reports/` (antes sólo `reports/junit.xml`) para no versionar artefactos de auditoría/cobertura.
- Nota: `vitest.perf.config.ts` se conserva (los `*.perf.*` están excluidos a nivel de proyecto y un `--exclude` por CLI no los rescata) y NO se borraron los 19 "tests de barrel" señalados por la guía: en este repo sí ejercitan lógica real (p.ej. `fetchPlanes`), así que borrarlos habría reducido cobertura.

## [13.512.2] - 2026-08-11
- CI: la migración de traspasos bancarios ahora es idempotente (`IF NOT EXISTS` en índices y columna, `DROP POLICY/TRIGGER IF EXISTS` previo) para cumplir la regla H4 de `audit:migrations`.

## [13.512.1] - 2026-08-11
- CI: se agregaron los mensajes amigables faltantes para los códigos `LC_TRASPASO_*` usados por la RPC de traspasos bancarios; se movieron a un catálogo propio (`lcCodeMessages.traspasos.ts`) para mantener el límite Power-of-10.

## [13.512.0] - 2026-08-11
- Traspasos entre cuentas propias de banco: nuevo modal en Tesorería › Cuentas que permite registrar movimientos entre cuentas del mismo tenant, incluyendo comisión y tipo de cambio para cuentas en distinta moneda; se generan los movimientos bancarios auto-conciliados vía `registrar_traspaso_bancario`.

## [13.511.0] - 2026-08-11

- Correos transaccionales (Sentry JAVASCRIPT-REACT-4X): el estado de cuenta y el recordatorio de cobranza vencida fallaban al renderizar porque usaban tonos (`info`, `warning`) que no existían en el catálogo de colores; se registraron y el chip ahora cae a un tono por omisión ante cualquier tono nuevo.
- Sentry menos ruidoso: los avisos de documento duplicado en el buzón CxP ("ya está en el buzón" / "ya fue capturado") son validaciones esperadas y ya no se reportan como error (se siguen mostrando al usuario).
- Se cerraron en Sentry los issues JAVASCRIPT-REACT-4Z y 4Y (`idempotency_store` con firma incorrecta), ya corregidos en 13.509.5.

## [13.510.1] - 2026-08-11
- CI (Power of 10): se dividieron archivos que rebasaron 200 líneas — el modal de captura (`ColumnaDatosFactura` a `DialogNuevaFacturaProveedor.datos.tsx`), el cableado del modo buzón (`useModoBuzonWiring.ts`) y los modales del buzón (`BuzonEntrantesModales.tsx`); sin cambios funcionales.

## [13.510.0] - 2026-08-11
- Captura desde el buzón: la vinculación muestra primero el expediente del documento (los demás embarques del proveedor quedan colapsados) y avisa cuando ese expediente ya no tiene costos pendientes.
- Categoría contable: si el documento nació de un embarque se fija en costo directo (COGS) y el selector queda bloqueado, con enlace "Cambiar categoría" para casos excepcionales; se avisa si la organización no tiene categoría COGS activa.

## [13.509.5] - 2026-08-11
- Guardar embarque: `actualizar_embarque_completo` llamaba a `idempotency_store` con un argumento extra (42883); ahora usa la firma real `(_key uuid, _response jsonb)`.

## [13.509.4] - 2026-08-11
- Guardar embarque: se corrigió el error `column "proveedor_factura_id" does not exist` (42703) en `actualizar_embarque_completo`; el resguardo de costos ya facturados ahora consulta la tabla puente `proveedor_facturas_conceptos`.

## [13.509.3] - 2026-08-11
- Tests CxP: la limpieza de `cxp_cancelacion_libera_embarque.sql` elimina al final la bitácora generada por la cancelación antes de borrar la organización temporal, evitando la violación de llave foránea en CI.

## [13.509.2] - 2026-08-11
- CI verde: se corrigieron los 4 trabajos que fallaban.
- ESLint: se dividieron `FacturaEntranteItem` (nuevos `MetaEntrante` y `AccionesEntrante`) y la zona de archivos del diálogo del buzón (`SeccionArchivosEntrante`) para bajar la complejidad; `MONEDAS_ENTRANTE` se movió a su propio módulo.
- Hook `useHidratacionEditarEmbarque`: el catálogo de proveedores se memoiza para que el efecto no cambie en cada render.
- Auditorías: las migraciones del buzón de conceptos ahora recrean sus políticas de forma idempotente (H4) y las funciones de embarque revocan permisos a PUBLIC/anon (H6).
- Tests: se renombraron dos títulos duplicados y se actualizaron los tests del webhook de FacturAPI al nuevo orden interno (dedupe registrado después de procesar).

## [13.509.1] - 2026-08-11
- CxP: al cancelar una factura de proveedor, el documento del buzón sí queda como **Rechazado** con su motivo. El orden interno estaba invertido: se cancelaba primero (y el trigger devolvía el documento a "Por capturar" borrando el vínculo) y sólo después se intentaba marcarlo como rechazado, cuando ya no se podía ubicar. Ahora se guardan los documentos antes de cancelar.



## [13.509.0] - 2026-08-11
- **Costos sin proveedor (embarques 336, 338, 340, 350, 353, 357)**: al guardar la edición de un embarque, el wizard mandaba el proveedor en blanco y borraba el nombre que venía de la cotización. Ahora un proveedor vacío ya no sobrescribe el que ya estaba.
- El wizard de edición resuelve el proveedor del catálogo a partir del nombre heredado (coincidencia exacta o única por prefijo) y lo muestra en el campo en vez de dejarlo vacío.
- Al crear un embarque desde cotización, los costos replicados ahora también guardan el `proveedor_id` del catálogo, no sólo el nombre.
- Backfill: se repuso el proveedor en los costos afectados tomándolo de la cotización de origen (sin tocar importes ni costos pagados).
- Pestaña Costos: el grupo "Sin proveedor" muestra un badge "Asignar proveedor".
- Base de datos: `actualizar_embarque_completo`, `_crear_embarque_replicar_conceptos` y nueva función `_resolver_proveedor_por_nombre`.

## [13.508.1] - 2026-08-11
- CxP: al cancelar una factura de proveedor, el documento del buzón vuelve a quedar en "Rechazada" con su motivo (un trigger lo reabría como "Por capturar" y borraba el vínculo antes de que se aplicara el rechazo).

## [13.508.0] - 2026-08-14
- **Corregir datos del documento del buzón**: operaciones ya puede ajustar proveedor, monto declarado, conceptos sugeridos y nota sin retirar el archivo ni volverlo a subir (botón "Corregir datos" en el buzón del embarque).
- **Rescate desde el buzón central**: en la pestaña "Rechazadas" de Compras > Buzón de facturas se puede devolver un documento a "Por capturar" sin entrar al embarque.
- **Aviso al operador**: al rechazar un documento, el sistema crea una notificación interna para quien lo subió con el motivo del rechazo.
- **Trazabilidad**: toda corrección de datos o de conceptos sugeridos queda en la bitácora de actividad.
- Base de datos: RPCs `actualizar_datos_entrante` y `reemplazar_conceptos_entrante` (cambio atómico) e índice único que evita conceptos sugeridos duplicados.

## [13.507.0] - 2026-08-13
- CxP: la captura desde el buzón entra en "modo asistido": se oculta el selector de origen y la zona de carga, y se muestra la tarjeta del documento con enlaces a PDF/XML y expediente.
- CxP: la captura hereda proveedor y nota que declaró operaciones, sin pisar lo que el contador ya escribió.
- CxP: banda de sugerencias de operaciones con "Quitar todos" / "Volver a aplicar"; se descartan conceptos que ya tienen factura vigente.
- CxP: cotejo del importe capturado contra el monto declarado por operaciones (tolerancia ±1% o ±$1) como aviso no bloqueante.

## [13.506.0] - 2026-08-11
- **Subir factura al buzón captura más información desde operaciones**: en el modal de subida el operador ahora marca a qué **conceptos de costo** del embarque corresponde el documento (con el importe de cada uno) o declara "aún sin costo capturado". Sin esa respuesta el botón de envío queda deshabilitado.
- **Contabilidad recibe el trabajo hecho**: al capturar la factura desde el buzón, los conceptos marcados llegan **pre-vinculados** en el formulario; se descartan automáticamente los que ya tengan otra factura viva.
- **Resumen de confirmación**: antes de enviar se muestra una línea con proveedor, monto declarado, conceptos marcados y archivos adjuntos.
- **Buzón más informativo**: cada documento muestra cuántos conceptos sugirió operaciones y el aviso de "sin costo capturado".
- **Pruebas**: nuevos tests de `mapearConceptosSugeridos` y del estado del formulario de subida (conceptos marcados, suma por moneda y limpieza al cambiar de proveedor).

## [13.505.0] - 2026-08-11
- **Cancelar factura de proveedor ahora libera el expediente**: al cancelar una factura (por ejemplo, cancelada ante el SAT) se rompe el vínculo con los conceptos de costo del embarque, se suelta el expediente y el documento del buzón queda libre para recapturarlo o retirarlo. Antes esto sólo pasaba al *rechazar*; al *cancelar* la factura seguía apareciendo vinculada en el tab de Costos (caso FP-000042 del expediente ELIMP00302).
- **Limpieza de datos**: se desvincularon las 6 facturas canceladas que seguían pegadas a expedientes (32 vínculos). No se borró ninguna factura ni concepto de costo original.
- **Vista de costos, doble red de seguridad**: la conciliación cotizado vs real y el marcado de "ya tiene factura" ignoran las facturas Canceladas y borradas, así que un vínculo residual ya no infla el "real facturado"; el renglón vuelve a mostrarse como *Sin factura*.
- **Pruebas**: nuevo `supabase/tests/cxp_cancelacion_libera_embarque.sql` en CI y tests unitarios de `buildFilasReconciliacion` y `fetchCostosConFactura` con facturas canceladas.


## [13.504.2] - 2026-08-11
- **Pruebas**: el test `cxp_pago_embarque_cerrado.sql` ahora simula una sesión de usuario miembro de la organización antes de mover el expediente a *Entregado*, porque el recálculo automático de demoras exige un usuario autorizado y el test fallaba con "No autorizado".

## [13.504.1] - 2026-08-11
- **Arquitectura**: se dividió `proveedorFacturas.ts` (231 líneas) extrayendo los tipos y filtros de CxP a `proveedorFacturas.types.ts`, para volver a cumplir el límite de 200 líneas por archivo. Sin cambios de comportamiento.

## [13.504.0] - 2026-08-11
- **Sidebar · badge del Buzón sincronizado en tiempo real**: el conteo de documentos por capturar ahora escucha los cambios de `embarque_facturas_entrantes` (alta, captura, retiro, reactivación o borrado) y se actualiza al instante para todos los usuarios de la organización, sin esperar a recargar.
- **Respaldos**: se conserva la revalidación cada minuto y se agregó revalidación al volver el foco a la pestaña, por si el canal en tiempo real se cae o el navegador estuvo suspendido.
- **Base de datos**: se habilitó la publicación en tiempo real de `embarque_facturas_entrantes` (con `REPLICA IDENTITY FULL`). La RLS sigue aplicando, así que cada usuario sólo recibe eventos de su organización.



## [13.503.0] - 2026-08-11
- **Buzón CxP · modal de subida rediseñado**: se eliminaron los tres recuadros de carga. Ahora hay **una sola zona** donde se arrastran (o eligen) el PDF y el XML juntos, y el estado de cada archivo se ve como chip (`PDF ✓` / `XML del CFDI · pendiente`), con botón para quitarlo.
- **Verificación del monto facturado**: operaciones captura el monto y la moneda de la factura (se pre-llenan desde el XML cuando existe) y el modal lo compara contra los **costos vivos del proveedor en el embarque**: avisa si coincide, si difiere (con diferencia y porcentaje, tolerancia ±1% o ±$1) o si no hay costos comparables en esa moneda. Es un aviso, nunca un bloqueo.
- **Persistencia y visibilidad**: el monto declarado se guarda en el documento del buzón (`monto_declarado` / `moneda_declarada`) y se muestra en la fila del buzón para que contabilidad lo coteje al capturar.
- **Nota para contabilidad** colapsada por defecto, para acortar el modal.


## [13.502.0] - 2026-08-11
- **Sidebar · badge del Buzón de facturas**: junto a *Compras → Buzón de facturas* aparece el número de documentos pendientes por capturar (estado `por_capturar`, sin eliminados), con tooltip "N documento(s) por capturar en el buzón". Se oculta cuando el buzón está vacío o el sidebar está colapsado, se refresca al subir/capturar/rechazar/retirar documentos y cada minuto como red de seguridad si otro usuario captura.

## [13.501.0] - 2026-08-11
- **CxP · facturas canceladas visibles**: el listado de Cuentas por pagar ocultaba siempre las canceladas, así que buscar `FP-000042` no devolvía nada y el filtro "Cancelada" salía vacío. Ahora se ocultan sólo en la vista por defecto: al buscar texto o filtrar por "Cancelada" sí aparecen.
- **Buzón CxP · aviso claro**: cuando el CFDI del documento corresponde a una factura **cancelada**, la fila muestra "CFDI de factura cancelada · FP-000042" (con explicación en tooltip) en lugar de un genérico "CFDI ya capturado", y el botón dice "Ver factura cancelada".
- **Modal de captura**: la alerta de CFDI duplicado explica que el UUID sigue ocupado aunque la factura previa esté cancelada, y sugiere retirar el documento o pedir un CFDI de reemplazo.

> Entradas de `13.0.0` a `13.499.3` archivadas en [`docs/changelog-archive-v13.md`](./docs/changelog-archive-v13.md).
> Histórico pre-`13.0.0` en [`docs/changelog-archive.md`](./docs/changelog-archive.md).
