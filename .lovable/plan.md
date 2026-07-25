# Quick Wins Compras/CxP (Ola 0) — v13.312.27 base

Aplicación ordenada de los 8 quick wins del documento subido. Dos PRs: uno para los chicos (QW1–QW5), otro para los medianos (QW6–QW8). Cada QW respeta las reglas globales: no tocar guards SQL de dinero, usar `src/lib/formatters`, `queryKeys.ts` del feature, catálogo `LC_*` para errores, y patrones UI ya existentes.

## PR 1 — QW1 a QW5 (chicos)

### QW1 · Fecha programada de pago en flujo proyectado
- Editar `src/features/tesoreria/domain/flujoProyectado.ts` para que las salidas CxP usen `COALESCE(fecha_programada_pago, fecha_vencimiento)`.
- Añadir `fecha_programada_pago` al select del hook/query que alimenta ese domain si falta.
- Test unitario del domain con ambos casos.

### QW2 · `dias_credito` en proveedores + prellenado de vencimiento
- Migración: `ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0 CHECK (dias_credito >= 0)` + `COMMENT ON COLUMN`.
- Regenerar types.
- UI ficha proveedor (`src/features/proveedor` crear/editar): campo "Días de crédito" (number ≥0).
- Captura de factura manual y parseo XML/PDF: si `fecha_vencimiento` vacío y `dias_credito > 0`, prellenar `fecha_emision + dias_credito`. Editable.
- Test del prellenado.

### QW3 · Aging CxP por moneda (bug real: mezcla monedas etiquetadas MXN)
- Migración `DROP` + recrear `public.cxp_aging_proveedores` añadiendo `moneda public.moneda` al retorno y al `GROUP BY (s.proveedor_id, s.moneda)`. Preservar `deleted_at IS NULL` del CTE `nc` y el resto intacto. GRANTs y `SECURITY DEFINER` idénticos al original.
- Regenerar types.
- `CxpAging.tsx`: secciones/cards separadas por moneda ("Saldos por proveedor — MXN", "— USD", "— EUR") con su formatter; filtro moneda en drill-down.
- Actualizar hook y consumers del RPC al nuevo campo.
- Test de agrupación por moneda en adapter/hook.

### QW4 · CSV en lista CxP + eliminar TC ×20 en reportes
- Botón "Exportar CSV" en bandeja Por-Pagar/Todas replicando el patrón ya presente en `CxpAging.tsx` (mismas columnas visibles + saldo + moneda).
- `/compras/reportes`: quitar TC ×20 literal. Usar `tipo_cambio_usd` de cada factura; si falta, TC DOF vía servicio Banxico existente (patrón del diálogo de pago). Cuando no haya TC confiable, mostrar totales por moneda sin convertir.
- Tests: fila CSV correcta; grep-test que impida TCs literales fuera de tests.

### QW5 · "Conciliar exactos" en conciliación
- En pantalla de conciliación (`src/features/tesoreria/…conciliacion…`) botón "Conciliar exactos": por cada movimiento sin vincular, buscar pagos con `|Δmonto| ≤ $1` y `|Δfecha| ≤ 5 días` **y candidato único**; aplicar la mutación de vincular existente.
- Reporte final: "N conciliados, M requieren revisión".
- Respetar guard `assert_movimiento_pago_consistente`; capturar fallos por ítem sin romper el lote.
- Test del selector (exacto único, ambiguo, fuera de tolerancia).

## PR 2 — QW6 a QW8 (medianos)

### QW6 · UI de Anticipos a Proveedores (backend ya existe)
- Nueva bandeja `/compras/anticipos`: tabla con proveedor, monto, aplicado, disponible, moneda, estado; filtros estado/proveedor; badge de estado.
- Dialog "Registrar anticipo" llamando a RPC `registrar_anticipo_proveedor` (no INSERT directo). Icono correcto (reemplazar `FileText`).
- Dialog "Aplicar a factura" con selector de facturas abiertas del mismo proveedor (reusar el del diálogo de pago), tope `≤ saldo` y `≤ saldo factura`, conversión visible cuando las monedas difieren (la RPC ya hace `convertir_monto_pago_a_factura`).
- Acción "Cancelar" con confirmación (RPC `cancelar_anticipo_proveedor`).
- En detalle de factura de proveedor: sección "Anticipos aplicados" (lectura tabla de aplicaciones).
- Empty states con CTA; skeletons; errores traducidos con `translateLcCode`.
- Tests del adapter/hook de aplicar (saldo, tope, mensaje cross-moneda).

### QW7 · Bandeja semanal de tesorería + programación en lote
- Vista `/tesoreria/pagos-programados` (o tab dentro de bandeja CxP): facturas agrupadas por semana usando `COALESCE(fecha_programada_pago, fecha_vencimiento)`; columnas proveedor/factura/monto/saldo/moneda/fecha; totales por semana y moneda.
- Selección múltiple en bandeja Por-Pagar → "Programar pago" → fecha única aplicada por ítem invocando `programarPagoProveedor` con el patrón de progreso+reporte de la aprobación masiva.
- Badge "Prog." en facturas con fecha programada.
- Tests: agrupación semanal del domain; mutación en lote con reporte de fallos.

### QW8 · Menú ⋮ por fila en compras (replicar patrón CxC)
- Reutilizar el componente/patrón de menú ⋮ de bandejas CxC/facturación en:
  - Por-Aprobar: "Aprobar" (disabled con tooltip si no pasa gates, llama RPC de aprobación; muestra `LC_CXP_UUID_NO_VERIFICADO` traducido cuando aplique).
  - Por-Pagar: "Registrar pago", "Programar".
  - Todas: "Ver detalle", "Descargar XML/PDF" si existen URLs, "Registrar NC".
- Acciones destructivas (eliminar/cancelar) siguen SOLO en detalle.
- Test: el menú muestra acciones según estado.

## Detalles técnicos y guardarraíles

- **Migraciones** (2): agregar `dias_credito` a `proveedores` (QW2) y recrear `cxp_aging_proveedores` con `moneda` (QW3). Cada archivo con header comentado explicando qué y por qué. Regenerar types tras cada migración.
- **Formatters/TC**: nada de `Intl.*`, `toLocaleString`, `0.16` ni TCs literales — todo vía `src/lib/formatters`, `useTasaIVA`, `financialUtils.ts` y el servicio Banxico existente.
- **queryKeys**: nuevos keys de anticipos y pagos programados en `queryKeys.ts` del feature correspondiente (no inline).
- **Errores**: `translateLcCode` para toda salida de RPC; nunca error crudo.
- **Tests obligatorios por QW**: los listados en cada sección (domain + hook + grep-test QW4).
- **Guards SQL**: no tocar `assert_movimiento_pago_consistente`, triggers de anticipos, `tg_facturas_link_proforma`, ni el whitelist de FIX-45.
- **`APP_VERSION`**: bump menor por PR y entrada en `CHANGELOG.md` root (formato existente).

## Verificación final (al cerrar ambos PRs)

- `bun run lint -- --max-warnings 0`, `bun run typecheck`, `bun run test:fast` verdes.
- `audit:migrations`, `audit:tests`, `audit:arch` verdes.
- Recorrido manual E2E: capturar factura → aprobar desde fila → programar a viernes → aparece en bandeja semanal y flujo proyectado → registrar anticipo y aplicarlo → aging por moneda correcto.
- Guards de pago/anticipo siguen rechazando sobrepagos (tests SQL existentes intactos).

## Orden de ejecución sugerido

1. QW1 → QW2 → QW3 → QW4 → QW5 (merge PR 1, bump versión).
2. QW6 → QW7 → QW8 (merge PR 2, bump versión).

¿Arranco con el PR 1 (QW1–QW5)?
