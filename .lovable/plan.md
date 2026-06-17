# Roadmap: cerrar el ciclo completo del embarque

Después de auditar el ERP, **las etapas 1–7 (cotización → CFDI 4.0) están sólidas**. Los huecos reales están en: (a) la trazabilidad entre módulos (FKs faltantes), (b) la falta de un **P&L por embarque** en pantalla, (c) la ausencia de un **cierre/liquidación financiera**, y (d) el módulo de **seguros**, hoy reducido a dos columnas booleanas.

Propongo entregarlo en **5 bloques** incrementales, cada uno con su propio CHANGELOG/bump de versión.

---

## Bloque O — Integridad de datos (base para todo lo demás)

Migración única, sin UI. Habilita los joins que los siguientes bloques necesitan.

- `proveedor_facturas.embarque_id` → agregar **FK real** a `embarques(id) ON DELETE SET NULL` (hoy es `uuid` sin constraint, sólo índice).
- `facturas.cotizacion_id` → nueva columna + FK a `cotizaciones`; backfill desde `embarques.cotizacion_id`.
- `pagos_factura.embarque_id` → nueva columna denormalizada + índice + backfill desde `facturas.embarque_id` + trigger de mantenimiento.
- `comisiones_devengadas` → índice `idx_com_dev_embarque` (FK ya existe).
- `pagos_proveedor.cuenta_bancaria_id` → FK faltante a `cuentas_bancarias`.
- `embarque_garantias_contenedor.proveedor_factura_id` → nueva FK opcional para amarrar depósito ↔ factura del proveedor.
- Verificar/forzar `conceptos_factura.clave_sat` con default `'78101800'` (freight forwarding).

Resultado: cualquier consulta "todo lo financiero de este embarque" se resuelve con joins directos.

## Bloque P — P&L por embarque (devengado real, no presupuestado)

Hoy `profit_por_embarque()` existe en BD pero **no tiene pantalla**, y se calcula sobre `conceptos_*` (presupuestado), no sobre `facturas/proveedor_facturas` (real).

- Nueva RPC `pnl_financiero_embarque(p_embarque_id)` que devuelve: ingresos facturados, ingresos cobrados, costos facturados por proveedor, costos pagados, utilidad presupuestada vs. realizada, margen %.
- Nuevo `TabPnl` en `EmbarqueDetalleTabs` con dos columnas comparativas (Presupuestado | Real) + alertas de desviación >10%.
- Reutiliza componentes de `src/features/profit/`.

## Bloque Q — Cobranza inline + liquidación de costos automática

- En `TabFacturacion` del embarque: mostrar **por factura** saldo pendiente, días vencidos, último recordatorio (sin salir a `/facturacion`).
- En `TabCostos`: acción masiva "marcar como pagado" y trigger que actualice `conceptos_costo.estado_liquidacion = 'Pagado'` cuando los `pagos_proveedor` cubran el total de la línea ligada.
- En `TabConciliacion`: alertas cuando lo facturado por proveedor supere lo presupuestado.

## Bloque R — Módulo de Seguros (reemplaza columnas booleanas)

Hoy `embarques.seguro` y `valor_seguro_usd` son sueltos; no hay póliza, aseguradora, ni cargo automático.

- Nueva tabla `embarque_seguros` (aseguradora, no. póliza, valor mercancía, % prima, prima USD calculada, vigencia, estado, PDF).
- Tabla opcional `costeo_seguros_tarifa` con primas default por tipo de carga/incoterm.
- Trigger: al crear seguro vigente → auto-inyectar `conceptos_venta` con `origen = 'seguro_auto'` (mismo patrón que demoras).
- Nuevo `TabSeguros` en embarque + servicio + hook.
- Las columnas viejas quedan como vista legacy hasta que se complete migración de datos.

## Bloque S — Cierre / Liquidación financiera del embarque

Cierra formalmente el ciclo de negocio.

- Nuevo valor `'Liquidado'` en enum `estado_embarque` (después de `Cerrado`).
- Nueva tabla `embarque_cierres` (totales facturados/cobrados/pagados, utilidad realizada, margen %, cerrado_por/en, notas).
- RPC `cerrar_embarque_financiero(p_embarque_id)` con guard rails: todas las facturas en `Emitida|Cobrada`, todas las `proveedor_facturas` en `Pagada`, garantías sin estado pendiente. Si pasa, escribe el cierre y avanza el embarque a `Liquidado`.
- Botón "Cerrar financieramente" en `TabPnl` (sólo Admin/Finanzas) con confirmación tipo ELIMINAR.
- Reporte "Embarques cerrados del periodo" para el dashboard ejecutivo.

---

## Detalles técnicos (resumen)

```text
Bloque O  → 1 migración (SQL puro, backfills)         · sin riesgo de UI
Bloque P  → 1 migración (RPC) + TabPnl                · lectura
Bloque Q  → 1 migración (trigger) + 3 componentes UI  · escritura ligera
Bloque R  → 2 migraciones (tabla+trigger) + módulo    · feature nuevo
Bloque S  → 2 migraciones (enum+tabla+RPC) + UI cierre · feature nuevo
```

Cada bloque:

- Respeta multi-tenant (`organization_id` + RLS + GRANTs).
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md` (raíz).
- Tests de regresión donde aplique (mock Supabase con cadena thenable).
- Sin tocar `auth/storage/realtime` ni archivos auto-generados.

## Preguntas antes de empezar

1. **¿Por dónde arrancamos?** Sugiero **Bloque O primero** (es prerrequisito de P, Q y S, y no rompe nada visualmente).
2. **¿Seguros (Bloque R) es prioridad real ahora**, o lo dejamos al final? Si nadie está vendiendo seguro hoy, conviene posponerlo.
3. **¿El cierre financiero (Bloque S) debe ser irreversible**, o admite "reabrir" por Admin? Esto cambia el diseño del RPC.

Si confirmas el orden O → P → Q → S → R (seguros al final), abro build mode y empiezo por el Bloque O.

Empezamos solo por O. 