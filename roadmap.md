# Roadmap

## En curso — Ronda v3 · Remediación selectiva (bugs F1–F5, N18, N22, M3, C9)
- [ ] Migración SQL: F1/F2 (devolución anticipo), F3 (cruce multi-moneda), F4 (guards NC), F5 (tope NC proveedor), N18 (lock refacturación), N22 (CHECK =1), M3 (índice único email), C9 (roles costos)
- [ ] Front F2: monto de devolución fijo (sólo total) en DevolverAnticipoDialog
- [ ] Front C9: alinear permissionMatrix (COST_VIEWERS = gerencia + finanzas + ventas) + actualizar costViewers.test.ts
- [ ] Mensajes LC_ANTICIPO_DEVOLUCION_TOTAL y LC_NC_PROV_EXCEDE_SALDO
- [ ] Test guards SQL (supabase/tests) + registro en manifiesto
- [ ] Responder al usuario: resumen de bugs corregidos (pregunta en chat)
- [ ] Bump APP_VERSION + CHANGELOG

## Pendiente (decidido NO hacer en esta ronda)
N9/F6/F7, M6, N-F4, N13-res, M7-res, L4-res, N-F2.
# Roadmap
- [ ] Correr suite RLS completa localmente (Postgres efímero)
- [ ] Generador automático de `_ci_service_role_only.sql` desde esquema real (script + integración CI)
- [x] Ola 1 v14 (C-1 doble IVA, C-2/A-10/M-6 snapshots)
- [x] Ola 2 v14: org_scope en KPIs (A-2/M-5), org explícita en Compras (A-9), filtros server-side (M-4)
- [x] Ola 3 v14 completa: A-3, A-4, A-8, A-11, M-3, M-16, M-17, B-1 + bajos B-13/B-14/B-15
- [x] Typecheck del preview en verde (fixtures TopProveedorRow con eur)
