# Estado Wave 0 y arranque de Wave 1

## Resumen
Wave 0 de la auditoría integral **ya está cerrada** en la versión actual (`13.524.0`). El `CHANGELOG.md` registra los 8 hallazgos bloqueantes aplicados y validados con typecheck, lint y suite de tests.

## Hallazgos de Wave 0 cerrados (v13.524.0)
- BL-01: Filtro `deleted_at` en lecturas de CRM + guardrail `crm-soft-delete-reads`
- BL-02: Guard de organización/identidad en `registrar_bitacora`
- BL-04: Tipo de cambio obligatorio en traspasos cross-moneda
- N1: Eliminada sobrecarga ambigua de `log_client_error_v1`
- EF-01: Timbrado de REP idempotente con claim atómico
- EF-03: Acuse SAT de cancelación en notas de crédito
- EF-04: Fallback EUR marcado como `es_fallback`, sin precargar en anticipos
- UX-02: Mensajes de error en es-MX

## Propuesta
1. Validar rápidamente que `APP_VERSION` y `CHANGELOG.md` reflejen el cierre y que no haya migraciones pendientes de aplicar en el backend.
2. Si la validación es limpia, iniciar **Wave 1** (P2 / siguiente sprint) con los ~30 hallazgos listados en `FIXES_LOVABLE_COMPLETO.md`.
3. Ejecutar Wave 1 en sub-olas de 5-7 fixes, con verificación de typecheck/lint/tests tras cada sub-ola.

## Pregunta de decisión
¿Arranco la validación del cierre y luego la planificación detallada de Wave 1, o prefieres que primero revise un hallazgo específico de Wave 0 que sospeches que quedó incompleto?
