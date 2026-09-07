# Roadmap — bloque auditoría YAGNI (sobre 13.823.70)

## P0
- [x] 1. Migración org-scope cerrar/reabrir embarque verificada (única, rol validado en org del embarque, prueba negativa cross-tenant en `_guards_manifest.txt`).

## P1
- [ ] 2. Facturapi: reintento de cancelación no debe decir "CFDI cancelado" en pending/verifying/uncertain.
- [ ] 3. Leaderboard: límite superior exclusivo del mes (calendario local MX) + test.
- [ ] 4. "Mis actividades de hoy": mismo filtro de responsable que `listActividades`.
- [ ] 5. CRM multi-moneda: subtotales por moneda en Kanban/PipelineResumen/ColumnaEtapa/tarjetas/KPIs.
- [ ] 6. Vincular cotización: heredar moneda de la cotización y vendedor del lead; rechazar si la oportunidad tiene otra moneda.
- [ ] 7. `crm_cerrar_oportunidad_desde_cotizacion`: rechazar moneda distinta antes de escribir `valor_real`.

## P2
- [ ] 8. Forecast del mes = mes actual; por mes = actual + 5 siguientes (fechas locales).
- [ ] 9. NBA: comparar `fecha_estimada_cierre` como fecha calendario local.
- [ ] 10. Estados de error + reintento en tarjetas CRM secundarias.
- [ ] 11. Cliente 360: moneda en última cotización + "Ver todas" con conteo restante.
- [ ] 12. Borrador cotización: "Revisar después" debe permitir resincronizar/recargar.
- [ ] 13. Actividades rápidas: sin toasts duplicados, fecha default no vencida, aviso de tarea automática fallida.
- [ ] 14. Oportunidades: control optimista con `updated_at`.
- [ ] 15. Facturapi/archivados: rechazar facturas con `deleted_at` no nulo.

## Entrega
- [ ] CHANGELOG + APP_VERSION 13.823.71

- [ ] R170: corregir errores de typecheck del preview (build-errors.log) antes de cerrar el bloque
