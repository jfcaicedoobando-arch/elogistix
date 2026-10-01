# Venta del embarque = factura timbrada menos notas de crédito

## Regla de negocio (decidida)

- Venta de un embarque = suma de sus facturas timbradas vigentes (Emitida, Pagada, Parcialmente pagada, Vencida), sin IVA, menos sus notas de crédito timbradas (Timbrada/Aplicada), también sin IVA.
- Embarque sin factura timbrada: venta = 0 (no se usa la venta proyectada).
- Facturas canceladas o sustituidas y notas canceladas o en borrador no cuentan.
- Conversión a MXN: con el tipo de cambio de cada factura y de cada nota.
- Costo: sin cambios (sigue como hoy).
- Mes de la nota de crédito:
  - Reportes por embarque (P&L del embarque, Utilidad/Profit, Rentabilidad, Tablero, Cierre mensual, márgenes): la nota resta en el embarque y en el mes del embarque.
  - Estado de resultados contable/anual: la nota resta en el mes en que se emitió.

## Paso 1 — Verificar la situación actual (solo lectura)

Antes de cambiar nada se arma una matriz de cada pantalla con: de dónde toma hoy la venta (conceptos del embarque o factura), si resta notas de crédito y con qué mes. Se cubren:
- P&L del embarque (detalle del embarque).
- Utilidad / Profit (operativo y devengado).
- Rentabilidad por cliente y por embarque.
- Tablero de inicio y tablero de dirección (venta, utilidad y margen del mes).
- Cierre mensual / proyección de facturación.
- Estado de resultados anual.
- Comisiones (utilidad base).

Se valida con datos reales de Elogistix (septiembre 2026): para cada embarque, la venta factura − NC contra lo que muestra cada pantalla. Te reporto qué pantallas ya cumplen y cuáles no, con su diferencia en pesos, antes de corregir.

## Paso 2 — Corregir

- Una sola regla compartida de "venta facturada neta del embarque" en la base. Todos los reportes por embarque la usan, en lugar de que cada uno sume por su cuenta.
- Las pantallas que hoy usan la venta proyectada pasan a usar esa regla. La venta proyectada solo queda donde la pantalla es explícitamente una proyección (por ejemplo, "Por facturar" en Cierre mensual), etiquetada como tal.
- El margen se recalcula con la venta neta.
- Comisiones: se revisa que ya usen la venta neta de notas. Si se necesita recalcular comisiones ya generadas, se te pide autorización aparte, porque toca datos financieros reales.

## Paso 3 — Validar

- Comparación SQL contra cada pantalla en Elogistix, septiembre: las cifras deben coincidir entre pantallas.
- Pruebas focalizadas de las carpetas tocadas, revisión de tipos y estilo, y db:postcheck con la copia de referencia regenerada.
- CI/RLS completos quedan para GitHub Actions. Sin publicar ni cambiar versión.

## Impacto esperado para el usuario

- La utilidad del mes bajará mientras haya embarques sin facturar (ya no se cuenta la venta proyectada).
- Todas las pantallas de venta, utilidad y margen darán la misma cifra para el mismo embarque.

## Detalles técnicos

- Candidatos ya identificados que leen `conceptos_venta`: `dashboard/direccion/services/loaders.ts`, `facturacion/services/proyeccion/fetchSources.ts`, `profit/services/estadoResultados.ts`, `profit/services/estadoResultadosFetch.ts`. Funciones de base: `eerr_resumen_anual`, `profit_por_cliente`, `profit_por_embarque`, `pnl_financiero_embarque`. El paso 1 confirma la lista completa (incluido el RPC del tablero).
- Una función SQL canónica (por ejemplo, `venta_neta_embarque_mxn`) con versión por lote para los reportes. Se respetan multiempresa (organization_id) y soft-delete, con permisos solo para authenticated y service_role.
- Archivos ≤200 líneas, sin `any`, con errores de Supabase manejados.
