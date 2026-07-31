# Estado R4 y cierre de pruebas

## Lo que ya está ejecutado (verificado en código y base de datos)

- **P0-1 Guard de cotizaciones**: `guard_estado_cotizacion` ya permite transiciones desde `Solicitada` (verificado en la función viva). No quedan cotizaciones atoradas en ese estado (0 filas).
- **P0-2 Pricing sin escritura en embarques**: `has_role` ya NO incluye `ejecutivo_pricing` en el array de `operador`; sigue heredando `viewer` (lectura). Existe suite RLS `test_rls_reg_r4_pricing.sql` con los casos leer-sí / escribir-no.
- **P1-1 Conceptos CxP**: hay `ConceptosManualesSection.tsx` + `useConceptosManuales.ts` y validación de cuadre antes de aprobar.
- **P1-2 Folio duplicado**: el índice único ya es `(organization_id, proveedor_id, folio_proveedor, fecha_emision)` con `WHERE deleted_at IS NULL AND estado <> 'Cancelada'`.
- **P1-3/P1-4/P1-5** (timbrado defensivo con `uuidCorto`, autosave del wizard, hidratación del editor de embarque) ya tienen implementación y pruebas unitarias base.

## Lo que falta (todo es cobertura de pruebas, no funcionalidad)

1. **Regresión SQL del guard de cotizaciones** (P0-1): nueva suite `supabase/tests/rls/test_rls_reg_r4_cotizacion_guard.sql` que afirme:
   - `Solicitada→Enviada`, `Solicitada→Aceptada`, `Solicitada→Rechazada` y `Solicitada→Vencida` pasan.
   - `Solicitada→En operación` sigue rechazándose con `LC_COT_TRANSICION_INVALIDA`.
   - Al salir de `Solicitada` se congela una versión en `cotizacion_versiones` (paridad con `Borrador`).
2. **Impacto colateral de P0-2**: prueba SQL que confirme que `ejecutivo_pricing` sí escribe en `cotizaciones`, `cotizacion_costos`, `costeo_tarifas`, `costeo_rutas` y `costeo_agentes` (para que el cambio de `has_role` no le haya quitado su trabajo diario).
3. **E2E P1-3 · crear y timbrar**: spec nuevo que crea factura manual, timbra con PAC mockeado y valida (a) toast de éxito con UUID corto, (b) respuesta del PAC sin UUID → toast con la causa real y sin `TypeError`, (c) el detalle del borrador renderiza (o muestra error con reintento) en lugar de skeleton infinito.
4. **E2E P1-4 · autosave del wizard**: escribir en el paso 2, esperar el debounce y verificar que el campo conserva foco y valor (repetición ×4 en el mismo spec).
5. **E2E P1-5 · editor de embarque**: abrir "Editar embarque" de un embarque con naviera/agente/BL/ETD/ETA, confirmar que el paso 2 llega poblado tras cargar catálogos y que guardar no borra esos campos.
6. **Unitarios de apoyo**: caso de `existeFacturaDuplicada` con `fecha_emision` vacía (debe devolver `false`) y traducción del constraint `proveedor_facturas_org_prov_folio_uq` en el catálogo de errores.

## Notas técnicas

- Las suites SQL siguen el patrón de `_helpers.sql` (usuarios sembrados por rol, `pg_temp.assert`) y entran al gate de CI de RLS existente.
- Los specs E2E se numeran a continuación de `29-wizard-restaurar-borrador.spec.ts` y reutilizan los Page Objects actuales.
- Al terminar: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
