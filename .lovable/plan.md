# Bloque C (P2) — Auditoría R2

Aplicar 15 fixes (R2-18 → R2-32). R2-16 sigue diferido (riesgo de onboarding). Cada cambio va como migración nueva o refactor TS, sin editar migraciones ya aplicadas.

---

## Parte 1 · Migración SQL única `fix_r2_bloque_c_v13_306_1.sql`

Consolida todos los fixes DB del bloque en una sola migración transaccional para facilitar rollback.

### Integridad / máquinas de estado
- **R2-18** Trigger `trg_nc_no_delete` en `factura_notas_credito` BEFORE DELETE → `RAISE 'LC_NC_INMUTABLE'`.
- **R2-21** Trigger `trg_guard_estado_cotizacion`: valida transiciones Borrador→Enviada→Aceptada/Rechazada→En operación; bloquea regresar a Borrador desde Aceptada/En operación.
- **R2-25** Ajustar `trg_facturas_set_fecha_vencimiento` para respetar `fecha_vencimiento` explícita (solo autocalcular si `NULL`).
- **R2-27** `UNIQUE(sustituye_a) WHERE sustituye_a IS NOT NULL` + CHECK anti-autosustitución + trigger anti-ciclo.
- **R2-32** Extender `_recalc_estado_proveedor_factura` para sincronizar `estado_captura='pagada'` cuando `estado='Pagada'` (y revertir a `'capturada'` al salir de Pagada).

### Constraints / catálogos
- **R2-22** CHECK ISO-6346 en `embarque_contenedores.numero_contenedor` + índices únicos parciales por org (soft-delete) y por `(embarque_id, bl_house)`. **Precaución:** validar primero con SELECT y saltar filas históricas inválidas (usar `NOT VALID` + backfill si es necesario).
- **R2-24** CHECK regex RFC en `clientes` + trigger BEFORE INSERT/UPDATE que hace `btrim` en `nombre`/`email` y rechaza vacío. Sanear filas existentes primero.
- **R2-26** CHECK `cancelacion_motivo IN ('01','02','03','04')`.

### Motor financiero
- **R2-30** Reescribir `convertir_a_mxn(p_monto, p_moneda, p_tc)`:
  - MXN → devuelve `ROUND(p_monto,2)`.
  - Moneda no soportada → `LC_MONEDA_NO_SOPORTADA`.
  - TC NULL o ≤ 0 (para USD/EUR) → `LC_TC_REQUERIDO`.

### Reportería / alertas
- **R2-19** Función `marcar_facturas_vencidas()`: `UPDATE facturas SET estado='Vencida' WHERE estado IN ('Emitida','Parcialmente pagada') AND fecha_vencimiento < CURRENT_DATE`. Programar con `pg_cron` diario a las 06:00 UTC (si la extensión existe; si no, dejar la función y documentar cron externo).
- **R2-20** Vista `cxp_alertas_vencimiento` (org, proveedor, folio, saldo, días_a_vencer) filtrada por RLS vía `is_org_member(organization_id)`; función helper `cxp_alertas_vencimiento(dias int)` que envuelve la vista.

### Formalización de objetos huérfanos (nota 3 del brief)
- Crear con `IF NOT EXISTS`: `tracking_externo`, `tracking_intentos`, columnas `proformas.es_consolidada` / `proformas.estado_aprobacion`, secuencia `embarque_consecutivo_seq`. Solo formaliza lo que ya existe en Cloud para que un build desde cero lo reproduzca.

---

## Parte 2 · Refactors TypeScript

### R2-23 · Erradicar `toISOString().slice(0,10)`
Reemplazar por `formatIsoDateMx` de `src/lib/date/mx.ts` en:
- `features/proformas/services/facturar.ts`
- `features/tesoreria/domain/flujoProyectado.ts`
- `features/tesoreria/services/tolerancia.ts`
- `features/tesoreria/domain/import/bbva.ts`
- `features/presupuesto/services/vsReal.ts`
- `features/embarques/domain/embarqueWizardRuta.ts`
- `features/dashboard/direccion/services/kpiDireccion.ts`
- `features/crm/domain/dashboardAggregates.ts`
- Cualquier ocurrencia residual en `auditoria/*` y `costeo/*`.

Añadir regla ESLint `no-restricted-syntax` que prohíba `toISOString().slice(0,10)` con mensaje claro.

### R2-28 · Parsers robustos
- `features/tesoreria/domain/import/bbva.ts`:
  - Quitar `Math.abs()` en `parseMonto` (conservar signo).
  - NaN empuja a `errores[]` en lugar de `0`.
  - Contabilizar y devolver `filas_descartadas` (cargo=abono=0 o fecha inválida).
- `supabase/functions/parse-cfdi-xml/index.ts`: `num()` lanza error explícito ante valor no numérico; documentar migración futura a parser DOM.

### R2-29 · `configuracion_global.tasa_iva`
Decisión: **leer el IVA desde `configuracion_global` con fallback 0.16 y validación numérica**. Actualizar `useTasaIVA` para hidratar desde la fila; mantener `TASA_IVA = 0.16` como constante de fallback exportada, marcada `@deprecated`. No romper cálculos existentes.

### R2-31 · Utilidad sin CxP
En `pnl_financiero_embarque` (SQL) y en el componente que la renderiza:
- Si `conceptos_costo` está vacío o `proveedor_facturas` no cubre al menos el presupuesto planeado, devolver `utilidad_mxn = NULL` y marca `estado_costos = 'incompleto'`.
- UI muestra badge amarillo "Costos pendientes" en `ResumenCards.tsx` cuando `estado_costos != 'completo'`; oculta el valor de utilidad hasta capturar CxP.

---

## Parte 3 · Verificación

1. `bunx vitest run` (incluye `saldo-factura-fase-d`, aging CxP, financialUtils).
2. `bun run lint -- --max-warnings 0` (incluye nueva regla `toISOString().slice`).
3. `supabase--linter` para revisar warnings post-migración (fixes de `search_path` donde aplique).
4. Consulta manual: contar filas que violarían R2-22/R2-24 antes de aplicar CHECK; reportar antes de romperlas.

---

## Detalles técnicos

- **Diferido:** R2-16 (asignación de rol admin en signup) queda fuera; requiere rediseño del flujo de onboarding y comunicación al usuario.
- **CHECKs con datos históricos:** para R2-22 y R2-24 se agregan como `NOT VALID` y se corren `VALIDATE CONSTRAINT` sólo si el sondeo previo confirma 0 filas violatorias. Si hay violaciones, el plan pausa y reporta antes de forzar.
- **Versión / changelog:** `APP_VERSION → 13.306.1`, entrada en `CHANGELOG.md` referenciando cada FIX aplicado y R2-16 como diferido.
- **Estimado:** 1 migración SQL + ~12 archivos TS editados + 2 tests nuevos (`convertir_a_mxn.test.ts`, `bbva-parser-errores.test.ts`).
