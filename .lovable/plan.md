# Estado real del paquete de portales y costeo

## Lo que sí está al 100%
Los 49 puntos (46 bugs + 3 regresiones) están aplicados en código y base de datos. Comprobaciones hechas ahora:
- `get_top_tarifas` ya filtra por organización y por membresía, y ordena con desempate determinista (`total_comparable`, `vigente_desde`, `dias_credito`, `dias_libres_demoras`, `id`).
- Los IDs B-064…B-106 y las 3 regresiones aparecen referenciados en `src/` y `supabase/`. Los tres que no traen la etiqueta del ID (B-088 KPI "por vencer", B-091 badge de demoras, B-095 listado de tarifas) sí tienen el comportamiento implementado (`TarifasKpis.tsx`, `TarifaCardBadges.tsx`, `TarifasGroupedView.tsx`).

## Lo que falta: pruebas y verificación
1. **La suite SQL nueva nunca se ha ejecutado.** `supabase/tests/rls/test_rls_reg_portales.sql` se escribió y se registró en la matriz de CI, pero no se corrió; puede tener fallos de seed (nombres de columna, restricciones NOT NULL, triggers de rol).
2. **~30 IDs sin test propio.** Con test: B-064, B-065, B-066, B-069, B-070, B-075, B-080, B-082, B-084, B-085, B-089, B-090, B-096, B-098, B-106. Sin red de seguridad: el resto, en especial la lógica de dinero del wizard y los portales.

# Plan

## Paso 1 — Ejecutar y estabilizar la suite SQL (bloqueante)
Correr `test_rls_reg_portales.sql` contra la base y corregir lo que falle (columnas, valores obligatorios, roles modernos por el trigger de bloqueo de roles legacy) hasta que los 11 bloques pasen. Sin esto, la Ola 1 de pruebas no cuenta.

## Paso 2 — Ola 2b: lógica de dinero del pipeline tarifario (vitest)
Tests unitarios de las funciones puras que hoy no tienen red:
- B-073 / B-074: construcción del payload del wizard — se persiste el vínculo a la tarifa y la cotización nunca queda con conceptos de venta vacíos.
- B-075: LCL no se vende a costo (margen por defecto aplicado).
- B-092: `lcl_tarifa_wm` y `lcl_minimo_flete` viajan en el insert.
- B-077: saldo a favor no se mezcla entre monedas.
- B-105 / B-088: "por vencer" = 7 días o menos, y el filtro del KPI devuelve exactamente ese subconjunto.
- B-079 / B-097: estado derivado `vencida` y copy del banner de reaprobación.

## Paso 3 — Ola 3: portales y UI (React Testing Library)
Smoke tests de render, con datos mínimos, para las vistas donde el bug era visual o de datos mostrados:
- Detalle de cotización del portal: IVA por moneda, conceptos legacy sin romper el render (B-081/B-093/B-101).
- Lista y detalle de facturas del portal: un solo estado visible y "Exp." con fallback (B-083/B-106).
- Detalle de embarque del portal: peso, volumen, piezas, tipo de contenedor (B-102).
- Fechas date-only sin hora falsa 00:00 (B-103) y "Consulta el PDF" solo si hay PDF (B-104).
- Menú "+ Nuevo" del CRM con sus items (REG B-004).

## Paso 4 — Cierre
Correr lint, typecheck y la suite completa; registrar en `CHANGELOG.md` y subir la versión.

## Detalles técnicos
- Los tests SQL usan los helpers existentes (`_helpers.sql`, `as_user`, `assert`) y siempre terminan en `ROLLBACK`.
- Los usuarios de prueba deben usar roles modernos (`admin_org`, `agente_carga`); los legacy están bloqueados por trigger.
- Los tests de UI se limitan a render y aserciones de texto, sin llamadas reales a la base (mock del cliente).
- No se toca lógica de producción salvo que un test descubra un fallo real; en ese caso se reporta antes de corregir.
