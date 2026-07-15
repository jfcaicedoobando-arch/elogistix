# Auditoría Profit — Fase 2 de bugs y duplicados

Tras la exploración detallada del módulo, encontré **12 hallazgos adicionales** a los 4 ya corregidos. Propongo agruparlos en 3 lotes por prioridad. Si prefieres otro orden o omitir alguno, dime antes de aprobar.

## Analogía rápida
Imagina que llevas la contabilidad en dos monedas y tu calculadora suma dólares como si fueran pesos. Ese es el bug #1: el "Saldo bancario" y algunos KPIs están mezclando USD y MXN como si fueran lo mismo.

## Lote A — Divisas mezcladas (CRITICAL/HIGH) 🔴

**A1. Saldo bancario suma USD como si fuera MXN**
- `dashboardEjecutivo/services/alertas.ts:128` y `tesoreria/domain/flujoProyectado.ts:88` hacen `reduce((acc, c) => acc + c.saldo, 0)` sin distinguir moneda, pero luego lo etiquetan como MXN.
- **Fix**: convertir cada `c.saldo` a MXN usando `tipo_cambio` antes de sumar (o exponer `saldo_mxn` ya normalizado desde el servicio, como ya lo hace `SaldosBancosCard`).
- Afecta también `runway_meses` y el saldo inicial del flujo proyectado a 28 días.

**A2. DSO/DPO ignoran cartera en USD**
- `alertas.ts:149-153` solo usa `por_cobrar_mxn` / `por_pagar_mxn` y descarta `por_cobrar_usd` / `por_pagar_usd`.
- **Fix**: convertir USD → MXN con TC vigente antes de calcular DSO/DPO.

**A3. Test de regresión multi-moneda**
- Agregar test en `tesoreria/domain/__tests__/resumen.test.ts` con una cuenta MXN + una USD para asegurar comportamiento correcto.

## Lote B — Truncamiento Top-5 contamina KPIs (HIGH) 🟠

**B1. "Cartera vencida" se calcula sobre Top-5 ya truncado**
- `tesoreria/domain/resumen.ts:106-113` hace `.slice(0, 5)` en `agruparTop`. Luego `alertas.ts:132-135` filtra ese arreglo truncado para calcular el KPI "Cartera vencida" del Dashboard.
- Si hay 12 clientes vencidos, el KPI sólo suma 5.
- **Fix**: calcular `carteraVencida` y conteo sobre el dataset completo de cobranza (antes del truncamiento). Reservar `top_deudores` sólo para la tabla visual.

**B2. Alertas "N clientes con cartera vencida" también topan en 5**
- Mismo origen que B1 (`alertas.ts:41-52, 55-66`).
- **Fix**: contar sobre datos crudos, no sobre el Top-5.

## Lote C — Criterios e inconsistencias lógicas (MEDIUM) 🟡

**C1. Criterio "vencido" distinto entre Top Deudores y Top Acreedores**
- Deudores: sólo `Vencida` (`resumen.ts:108`). Acreedores: `Por vencer || Vencida` (`resumen.ts:117`).
- **Fix**: unificar criterio (recomiendo "sólo vencidas" en ambos para consistencia con la etiqueta "vencidos").

**C2. Triple recálculo de "categorías excedidas de presupuesto"**
- Misma fórmula en `presupuesto/services/vsReal.ts:175-180`, `dashboardEjecutivo/services/alertas.ts:72-89` y `alertas.ts:144-146`.
- **Fix**: `alertas.ts` debe consumir `snapshot.presupuesto.categorias_en_exceso` / `top_exceso` en vez de recalcular.

**C3. EERR "Embarques" no resta notas de crédito, "Facturas" sí**
- `estadoResultados.ts` (embarques/pagado) no consulta `factura_notas_credito`; `estadoResultadosDevengado.ts:81-91` sí.
- **Fix (mínimo invasivo)**: ampliar el tooltip del toggle Embarques/Facturas para advertir que sólo la vista "Facturas" descuenta NC. (Restarlas en Embarques requiere decisión de negocio; lo dejo fuera del lote a menos que confirmes.)

**C4. `runway_meses` engañoso cuando saldo ya es negativo**
- `alertas.ts:154-156`: si `saldoBancos <= 0` muestra "Utilidad ≥ 0 en el mes" en `BandaKPIsEficiencia.tsx:70` en lugar de alertar.
- **Fix**: mensaje explícito "Saldo bancario negativo" cuando corresponda.

## Fuera de lote (LOW, sin evidencia dura)
- **Fallback modo "Marítimo"** en EERR devengado (líneas 113-118): reasignar a columna "Otros" cuando la factura no vincula embarque, para no sesgar el modo. Menor prioridad.
- **Mezcla EUR en `vsReal.ts:56-65`**: sólo relevante si existen facturas de proveedor en EUR (no confirmado en datos actuales).

## Detalles técnicos

Archivos que se tocarían:
- `src/features/dashboardEjecutivo/services/alertas.ts` (A1, A2, B1, B2, C2, C4)
- `src/features/tesoreria/domain/resumen.ts` (B1, B2, C1 — exponer datasets pre-truncamiento)
- `src/features/tesoreria/domain/flujoProyectado.ts` (A1)
- `src/features/profit/components/FuenteEerrToggle.tsx` (C3 — solo texto)
- `src/components/profit/BandaKPIsEficiencia.tsx` (C4 — mensaje)
- Tests: `tesoreria/domain/__tests__/resumen.test.ts`, `dashboardEjecutivo/services/__tests__/alertas.test.ts`

Al terminar: `bun run test` completo, `APP_VERSION` → `13.300.49`, entrada en `CHANGELOG.md`.

## Preguntas antes de implementar
1. ¿Ejecuto los **3 lotes (A, B, C)** en este turno, o prefieres empezar sólo por el **Lote A** (divisas, el más crítico) y ver resultados?
2. Para **C3** (NC en EERR Embarques): ¿ampliamos sólo el tooltip, o quieres que también reste NC en la fuente Embarques (cambio de lógica de negocio)?
