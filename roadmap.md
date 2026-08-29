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
