# Remediación v15 — 16 pendientes (post v13.805.0)

Verifiqué en el código los hallazgos principales y son reales: `reabrir_embarque` hoy solo cambia estado y `definitiva=false` (no limpia snapshots), `a_mxn` solo exige `tc > 0`, `flujoProyectado` no excluye canceladas, `tcBanda` no se usa en los diálogos de pago, `GREATEST(cantidad,1)` sí infla cantidades fraccionarias, y el baseline no contiene `venta_total_descuadrado`.

Decisiones tomadas: C-1 solo corrige el código (sin backfill de históricos), M-15 se cierra en pantalla **y** con candado en base de datos, y Compras pasa a reportar subtotal (sin IVA).

## Ola 7 — P0 (re-fix de regresiones)

1. **M-1 · Reabrir embarque no borra el profit del cierre.** Analogía: al reabrir el expediente se queda pegada la "foto" de la utilidad anterior. Redefino `reabrir_embarque` completa: limpia `cerrado_snapshot`, y en comisiones pone `pnl_base = NULL`, `calculo_snapshot = NULL` junto al `definitiva = false`. Agrego guard conductual en `supabase/tests/` para que una futura redefinición lo detecte.
2. **M-8 · Tipo de cambio no confiable en auditoría.** Endurezco la conversión a `tc > 1` (espejo de `tcConfiable` del frontend) para USD y EUR, en la ruta que usan las reglas de auditoría, sin romper otros consumidores. Test de regresión con TC = 1 y TC = -5.

## Ola 8 — P1 (cerrar alcance)

3. **C-1 residual (solo código).** Fallback de IVA: `CASE WHEN aplica_iva THEN COALESCE(tasa_iva_aplicada, 0.16) ELSE 0 END`, y no desinflar cuando `aplica_iva = false`. Sin tocar datos históricos.
4. **A-8 · Liquidaciones canceladas en flujo de caja.** Añado `.neq("estado","Cancelada")` en `fetchLiquidacionesPendientes` y corrijo los comentarios engañosos en `flujoProyectado.ts` y `vsReal.ts`.
5. **M-14 · Banda de TC en pagos.** Aplico `tcBanda` (5–40 MXN por dólar) en el pago de factura de cliente y en el de proveedor cuando la moneda no es MXN, más CHECK de rango en `pagos_factura.tipo_cambio` y `pagos_proveedor.tipo_cambio`.
6. **M-15 · Crédito en timbrado masivo de REP.** Validación en la bandeja REP + candado server-side que bloquea el timbrado cuando el cliente excede su límite y el actor no tiene rol de override.
7. **M-10 · Cuadre de contenedores.** Nueva regla de auditoría `contenedores_totales_descuadrados` (peso/volumen/piezas del embarque vs suma de contenedores) y su registro en los mapas del frontend, igual que `venta_total_descuadrado`.
8. **B-11 · Factura en $0 timbrable.** Exijo `total > 0` en `validarDatosTimbrado` y en la edge `facturapi-emitir`.

## Ola 9 — P2 (menores)

9. **N-1** `GREATEST(cantidad,1)` → `COALESCE(cantidad,1)` (0.5 deja de convertirse en 1).
10. **R-2** Regenerar `supabase/schema/baseline.sql` y dejar `db:postcheck` verde con guard de drift.
11. **R-3** Unificar la llave de dedupe de revisiones a `detalle_hash` en snapshot y upsert.
12. **N-2** `AvisoSincronizarConceptosVenta` escribe con `expectedUpdatedAt` (bloqueo optimista).
13. **N-3** `enabled: !!organizationId` en las 4 queries de Compras.
14. **B-6** Guard de traspasos: saldo NULL se trata como insuficiente (fail-closed).
15. **B-12** `crear_embarque_completo` valida peso/piezas negativos con código `LC_*` mapeado.
16. **M-3** Reportes de Compras suman `subtotal` (sin IVA), conciliable con Presupuesto; nota en la UI.

## Detalles técnicos

- SQL en migraciones que **redefinen la función completa** (no `pg_get_functiondef` + `replace`), cada una con guard conductual en `supabase/tests/` + entrada en `_guards_manifest.txt`.
- Archivos frontend: `flujoProyectado.ts`, `vsReal.ts`, `registrarPagoDerivados.ts`, `usePagoProveedorForm.tcDof.ts`, `useTimbrarRepsLote.ts`, `BandejaRepPendientes.tsx`, `validarDatosTimbrado.ts`, `auditoriaConfig.ts` + `hallazgosTablaConfig.ts` + `ejecutivoAgregados.ts`, `revisiones.ts`, `AvisoSincronizarConceptosVenta.tsx`, `pagosGlobal.ts`, `notasCreditoGlobal.ts`, `reportesFetch.ts`, `conciliacionEmbarques.ts`, `ComprasReportes.tsx`.
- Cierre por ola: `bunx vitest run` verde, `bun run db:postcheck` verde con baseline regenerada, `APP_VERSION` + `CHANGELOG.md` + `roadmap.md`.
- Fuera de alcance: B-2, B-3, B-21 y A-5 (ya documentados / falso positivo).
