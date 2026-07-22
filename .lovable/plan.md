ns
# Verificación R2 — comprobar que los 32 bugs ya no existen

Los 32 fixes (Bloques A/B/C) se aplicaron en `v13.305.13`, `v13.306.0` y `v13.306.1`. Este plan **verifica en vivo** contra la BD y el código que cada bug ya no reproduce, sin modificar nada.

## Método

Para cada FIX ejecuto una comprobación específica y produzco una tabla con estado `✅ resuelto` / `⚠️ parcial` / `❌ regresión` + evidencia.

### Bloque A (P0)
- **R2-01** `\df+ validar_cierre_embarque` — buscar `pp.proveedor_factura_id`, `pnl_financiero_embarque`, `pnl_margen_minimo_cierre`.
- **R2-02** `\df convertir_proformas_a_factura` — confirmar gate unificado `admin_org|contador|super_admin` sin `_assert_writer` contradictorio.
- **R2-03** `\df+ check_no_sobrepago_proveedor` — buscar `FOR UPDATE`, cálculo interno de TC, rechazo de monto ≤ 0.
- **R2-04** `\df is_org_member` + `\d+ proveedor_facturas` (buscar trigger `trg_guard_estado_proveedor_factura`).

### Bloque B (P1)
- **R2-05** `\df+ recalcular_estado_factura` — buscar suma de NCs aplicadas.
- **R2-06** `\df+ calc_pago_retenciones` — base neta.
- **R2-07** trigger `trg_guard_estado_factura` presente.
- **R2-09** `\d pagos_factura`, `\d pagos_proveedor` — CHECKs monto > 0 y TC > 0.
- **R2-10** `\d+ cxp_por_pagar`, `cxp_aging_proveedores` — `COALESCE(monto_en_moneda_factura,…)`.
- **R2-11** `\df enforce_cotizacion_vigente` + llamadas en `aceptar_cotizacion_version` y `crear_embarque_borrador_desde_cotizacion`.
- **R2-12** `\df assert_proformas_moneda_soportada`.
- **R2-13** `\df+ embarques_list_extras`, `cxp_aging_proveedores` — filtro `current_user_org_id()`.
- **R2-14** policy `Tenant read clientes` excluye rol `cliente`.
- **R2-15** índice `facturas_numero_org_unico` existe.
- **R2-16** documentado como diferido (no verificar).
- **R2-17** `\d+ cartera_pendiente`, `embarque_estado_financiero`, `facturacion_por_emitir`.

### Bloque C (P2)
- **R2-18** trigger `trg_nc_no_delete`.
- **R2-19** función `marcar_facturas_vencidas` + job `cron.job` `marcar_facturas_vencidas_diario`.
- **R2-20** vista `cxp_alertas_vencimiento` + función homónima.
- **R2-21** trigger `trg_guard_estado_cotizacion`.
- **R2-22** CHECK `contenedor_iso6346`.
- **R2-23** `rg "toISOString\(\)\.slice\(0,\s*10\)" src` debe devolver 0 hits en producción.
- **R2-24** CHECK `clientes_rfc_formato` + trigger `trg_clientes_normaliza_campos`.
- **R2-25** `\df+ facturas_set_fecha_vencimiento` — respeta valor explícito.
- **R2-26** CHECK `facturas_cancelacion_motivo_sat`.
- **R2-27** CHECK `facturas_no_autosustitucion` + trigger `trg_guard_sustitucion_ciclo`.
- **R2-28** `parseMonto` BBVA y `num()` en `parse-cfdi-xml/parser.ts` con nueva semántica.
- **R2-29** confirmar que `configuracion_global` no tiene `tasa_iva` (N/A).
- **R2-30** `\df+ convertir_a_mxn` — lanza `LC_TC_REQUERIDO` / `LC_MONEDA_NO_SOPORTADA`.
- **R2-31** `\df+ pnl_financiero_embarque` — devuelve `estado_costos='incompleto'` cuando falta CxP.
- **R2-32** `\df+ _recalc_estado_proveedor_factura` — sincroniza `estado_captura`.

## Entregable

Tabla resumen con:
- FIX-ID
- Bloque
- Estado
- Evidencia corta (nombre de constraint/trigger/función encontrada, o hit de regex)

Si alguna verificación falla, la marco como `❌ regresión` y sugiero (sin aplicar) el parche correctivo.

**No se modifica ningún archivo ni migración**; sólo consultas `psql` de sólo lectura y `rg`/`grep` sobre el código.
