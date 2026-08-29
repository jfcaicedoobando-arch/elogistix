# Plan de saldo del baseline `audit:replay-mirror`

> Verificado contra `scripts/audit-replay-mirror-baseline.json` el 2026-08-29
> (v13.795.0). Origen: Ola 14 · Sprint 05 · R5BD-03, cuando el baseline tenía
> 14 entradas. Hoy quedan **8**.

El baseline tolera 8 divergencias espejo↔migración vigente preexistentes. El
guardrail es **anti-crecimiento** (entrada nueva → exit 1) y
**anti-entradas-muertas** (entrada que deja de divergir → exit 1, hay que
borrarla), así que el baseline sólo puede decrecer.

Regla de decisión: **alinear ESPEJO** cuando la divergencia es cosmética o el
espejo está atrasado (en replay limpio gana la migración). **Re-emitir
migración** sólo si el espejo tuviera lógica más correcta que la migración
vigente (no detectado en ningún spot-check hasta hoy).

## Entradas vivas (8)

| # | Espejo | Función | Migración vigente | Decisión | Nota |
|---|---|---|---|---|---|
| 1 | `auditoria/auditoria_embarques_org.sql` | `auditoria_embarques_org` | `20260808204754` | Alinear espejo | Diff funcional previo (módulo sensible) |
| 2 | `auditoria/auditoria_embarques_org.sql` | `_audit_embarques_umbrales` | `20260723160534` | Alinear espejo | Mismo archivo que #1 |
| 3 | `auditoria/auditoria_embarques_org.sql` | `_audit_embarques_agregar` | `20260808204754` | Alinear espejo | Mismo archivo que #1 |
| 4 | `embarques/crear_embarque_borrador_core.sql` | `crear_embarque_borrador_core` | `20260727175258` | Alinear espejo | Diff funcional previo |
| 5 | `embarques/crear_embarque_borrador_desde_cotizacion.sql` | idem | `20260722125515` | Alinear espejo | Diff funcional previo |
| 6 | `embarques/crear_embarque_completo.sql` | `crear_embarque_completo` | `20260729185310` | Alinear espejo | Diff funcional previo |
| 7 | `facturacion/recalcular_estado_factura.sql` | `recalcular_estado_factura` | `20260725184833` | Alinear espejo | Financiera crítica: revisión por par |
| 8 | `operaciones/operaciones_stats.sql` | `operaciones_stats` | `20260811090000` | Alinear espejo | Espejo atrasado (ola posterior) |

## Ya saldadas

`cancelar_factura_proveedor`, `avanzar_estado_embarque`, `saldo_factura`,
`portal_obtener_proforma_por_token`,
`_convertir_proformas_insertar_conceptos` y `convertir_proformas_a_factura`
salieron del baseline en las olas posteriores.

## Ritmo y criterio de saldo

- 3-4 entradas por ola. Siguiente lote: #8 (espejo atrasado, sin riesgo) y
  #1-#3 (mismo archivo, un solo diff).
- Último lote: #4-#7 (creación de embarque y estado de factura: diff funcional
  revisado por par antes de tocar el espejo).
- Cada lote debe dejar `jq '.entradas | length'` estrictamente decreciente
  (8 → 0) y `bun run audit:replay-mirror` en verde.
- Al llegar a `"entradas": []` se puede borrar este documento y la clave
  `_doc` del baseline.
