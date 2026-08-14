# Plan de saldo del baseline `audit:replay-mirror` (Ola 14 · Sprint 05 · R5BD-03)

El baseline `scripts/audit-replay-mirror-baseline.json` tolera 14 divergencias
espejo↔migración vigente preexistentes. El guardrail ya es **anti-crecimiento**
(entrada nueva → exit 1) y **anti-entradas-muertas** (entrada que deja de
divergir → exit 1, hay que borrarla), así que el baseline sólo puede decrecer.

Regla de decisión: **alinear ESPEJO** cuando la divergencia es cosmética o el
espejo está atrasado (en replay limpio gana la migración). **Re-emitir
migración** sólo si el espejo tuviera lógica más correcta que la migración
vigente (no detectado en el spot-check).

| # | Espejo | Función | Migración vigente | Decisión | Nota |
|---|---|---|---|---|---|
| 1 | `auditoria/auditoria_embarques_org.sql` | `auditoria_embarques_org` | `20260808204754` | Alinear espejo | Diff funcional previo (módulo sensible) |
| 2 | `auditoria/auditoria_embarques_org.sql` | `_audit_embarques_umbrales` | `20260723160534` | Alinear espejo | Mismo archivo que #1 |
| 3 | `auditoria/auditoria_embarques_org.sql` | `_audit_embarques_agregar` | `20260808204754` | Alinear espejo | Mismo archivo que #1 |
| 4 | `cxp/cancelar_factura_proveedor.sql` | `cancelar_factura_proveedor` | `20260811180602` | Alinear espejo | Cosmética confirmada (`$$` vs `$function$`) |
| 5 | `embarques/avanzar_estado_embarque.sql` | `avanzar_estado_embarque` | `20260803214601` | Alinear espejo | Diff funcional previo (máquina de estados) |
| 6 | `embarques/crear_embarque_borrador_core.sql` | `crear_embarque_borrador_core` | `20260727175258` | Alinear espejo | Diff funcional previo |
| 7 | `embarques/crear_embarque_borrador_desde_cotizacion.sql` | idem | `20260722125515` | Alinear espejo | Diff funcional previo |
| 8 | `embarques/crear_embarque_completo.sql` | `crear_embarque_completo` | `20260729185310` | Alinear espejo | Diff funcional previo |
| 9 | `facturacion/recalcular_estado_factura.sql` | `recalcular_estado_factura` | `20260725184833` | Alinear espejo | Financiera crítica: revisión por par |
| 10 | `facturacion/saldo_factura.sql` | `saldo_factura` | `20260729212159` | Alinear espejo | Cosmética confirmada |
| 11 | `operaciones/operaciones_stats.sql` | `operaciones_stats` | `20260811090000` | Alinear espejo | Espejo atrasado (ola posterior) |
| 12 | `portal/portal_obtener_proforma_por_token.sql` | idem | `20260811231247` | Alinear espejo | Superficie externa: diff obligatorio |
| 13 | `proformas/_convertir_proformas_insertar_conceptos.sql` | idem | `20260723162453` | Alinear espejo | Helper interno |
| 14 | `proformas/convertir_proformas_a_factura.sql` | idem | `20260729164301` | Alinear espejo | Conversión financiera: revisión por par |

## Ritmo y criterio de saldo

- 3-4 entradas por ola. Primer lote: #4, #10, #11 (cosméticas / espejo atrasado).
- Segundo lote: #1-#3 y #13. Tercer lote: #5-#8. Último lote: #9, #12, #14
  (financieras/externas, con diff funcional revisado por par).
- Cada lote debe dejar `jq '.entradas | length'` estrictamente decreciente
  (14 → 0) y `bun run audit:replay-mirror` en verde.
- **Fecha compromiso de vaciado completo (`"entradas": []`): cierre de la Ola 17.**
