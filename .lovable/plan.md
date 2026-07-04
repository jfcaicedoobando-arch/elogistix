# Paso 1 — Limpieza de Facturación y Cobranza (Elogistix)

**Organización:** Elogistix (`00000000-0000-0000-0000-000000000001`)
**Criterio:** `created_at < 2026-05-01`
**Tipo de borrado:** definitivo (hard delete, incluye timbradas)

## Alcance detectado (preview real de la BD)

| Tabla | Total org | A borrar |
|---|---:|---:|
| `facturas` | 141 | **13** |
| `pagos_factura` (ligados a esas 13) | 3 | **1** |
| `factura_notas_credito` | 0 | 0 |
| `factura_envios` | 0 | 0 |
| `factura_recordatorios` | 0 | 0 |
| `cobranza_seguimiento` | 0 | 0 |

Las 13 facturas están en USD/MXN, ninguna timbrada (`uuid_fiscal` nulo), estados `Emitida` (12) y `Pagada` (1). Todas ligadas a un embarque + proforma; los embarques/proformas **no** se tocan en este paso.

## Facturas que se eliminarán

```text
# 846, 852, 839, 822, 832, 831, 833, 844, 793 (Pagada), 838, 821 (USD), 821 (MXN), 843
Rango fecha_emision: 2026-03-17 → 2026-04-29
Rango created_at:   2026-04-24 → 2026-04-30
```

## Ejecución

Una sola migración con `DELETE` en orden inverso de dependencia, envuelta en transacción implícita:

```text
1. DELETE pagos_factura        WHERE factura_id IN (<13 ids>)
2. DELETE factura_notas_credito WHERE factura_id IN (<13 ids>)   -- 0 filas
3. DELETE factura_envios       WHERE factura_id IN (<13 ids>)   -- 0 filas
4. DELETE factura_recordatorios WHERE factura_id IN (<13 ids>)  -- 0 filas
5. DELETE cobranza_seguimiento WHERE factura_id IN (<13 ids>)   -- 0 filas
6. DELETE facturas             WHERE organization_id = <elogistix>
                                 AND created_at < '2026-05-01'
```

Filtro doble por `organization_id` + `created_at` en el DELETE final para blindar contra borrado accidental de otras orgs.

## Validación post-borrado

- `SELECT count(*) FROM facturas WHERE organization_id=elogistix` → esperado **128** (141 − 13).
- `SELECT count(*) FROM pagos_factura WHERE organization_id=elogistix` → esperado **2** (3 − 1).
- Verificar en UI `/facturacion` que la lista carga sin errores.

## Fuera de alcance de este paso

- Embarques, proformas, cotizaciones ligados a esas facturas (siguiente paso si lo decides).
- Series de folios (`factura_series`), credenciales Facturapi, configuración fiscal — se conservan.
- No hay cancelación ante SAT porque ninguna está timbrada.
- Bitácora y logs (`app_logs`, `bitacora_actividad`, `email_send_log`) — se conservan como rastro de auditoría.

## Registro

- Bump `APP_VERSION` a `13.171.2` (parche).
- Entrada en `CHANGELOG.md` describiendo la limpieza puntual de Elogistix.

Al aprobar el plan, emito la migración de `DELETE`.
