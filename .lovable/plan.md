# Ajuste tarjeta "hallazgos en embarques con ETA vencida"

## Problema
La tarjeta roja del dashboard de auditoría cuenta **todos** los hallazgos pendientes cuya `eta < hoy`, sin filtrar por tipo de regla. Cuando entran ahí hallazgos de **cuentas por pagar a proveedor** (`cxp_por_capturar_estancada`, `cxp_vencida`), se dispara una falsa urgencia: los proveedores dan crédito y esos pagos se hacen mucho después del ETA — la fecha de arribo del embarque no es la fecha límite del pago.

La tarjeta debería enfocarse en pendientes **operativos** del embarque (documentos, fechas, contenedores, tipo de cambio, márgenes) — cosas que sí deberían estar resueltas para cuando el barco llega. Las CXP/CXC/proformas tienen su propio calendario y ya se muestran en otras tarjetas.

## Cambio

En `src/features/auditoria/domain/ejecutivoAgregados.ts`, dentro de `calcularVencimientos`, filtrar los hallazgos por regla antes de contarlos contra el ETA.

**Reglas EXCLUIDAS** del bucket "ETA vencida" (tienen su propia fecha de vencimiento, no dependen del ETA del embarque):
- `cxp_por_capturar_estancada` — ventana de captura del proveedor
- `cxp_vencida` — fecha de pago pactada
- `cxc_vencida` — vencimiento de la factura al cliente
- `proforma_vencida` — expiración de la proforma
- `proforma_borrador_abandonada` — antigüedad del borrador

**Reglas INCLUIDAS** (siguen sumando cuando `eta < hoy`): docs_faltantes, docs_pendientes_avanzado, fechas, ventas_sin_facturar, margen_negativo, margen_bajo, venta_sin_costo, costo_sin_venta, proforma_inconsistente, embarque_huerfano, factura_sin_timbrar, rep_pendiente, factura_cancelada_sin_sustitucion, contenedor_datos_incompletos, contenedor_fechas_incompletas, tipo_cambio_faltante.

Mismo filtro se aplica a `pendientesUrgentesPorEta` (tarjeta ámbar "ETA en ≤ 3 días") por consistencia.

## Detalles técnicos
- Nueva constante `REGLAS_CON_VENCIMIENTO_PROPIO: ReglaAuditoria[]` exportada desde `ejecutivoAgregados.ts` para reutilizar.
- Actualizar tests en `src/features/auditoria/domain/__tests__/ejecutivoAgregados.test.ts` para cubrir el filtrado (caso: hallazgo `cxp_vencida` con `eta` pasada NO cuenta).
- `edadPromediaPendientesDias` también se recalcula sólo con las reglas incluidas, para que la métrica de antigüedad promedio no la distorsionen las CXP.
- La regla `cxp_por_capturar_estancada` y `cxp_vencida` siguen apareciendo íntegras en el dashboard (Compras / CXP), sólo dejan de agruparse en la tarjeta de urgencia por ETA.

## Versionado
- Bump `APP_VERSION` → `13.299.19`.
- Entrada en `CHANGELOG.md` explicando el filtro y por qué CXP no debería alarmar por ETA.

## Analogía
Es como la lista de "vuelos que ya despegaron y tienen pendientes" en un aeropuerto: tiene sentido incluir el equipaje sin escanear o el manifiesto pendiente, pero **no** la factura del combustible que pagas 30 días después. Cada pendiente tiene su reloj — el reloj del embarque no aplica a todos.
