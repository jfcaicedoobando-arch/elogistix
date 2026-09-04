# Roadmap · Ronda YAGNI posterior a v13.823.34

## En curso (ronda actual)
- [ ] 0. Crash TypeError en /inicio: Cannot read properties of undefined (reading 'default')
- [ ] 1. P0 cerrar_embarque cross-tenant (rol exacto en org del embarque) + pruebas SQL
- [ ] 2. P1 carrera cierre vs conceptos (lock compatible en triggers de hijos)
- [ ] 3. P1 periodo cerrado protege importes/soft-delete, no sólo fechas
- [ ] 4. P1 RPC de cierre/reapertura de periodo con motivo y bitácora
- [x] 5. P1 NC concurrentes: FOR UPDATE sobre facturas
- [x] 6. P1 guard BD contra pagos retroactivos/borrados con REP vivo posterior
- [ ] 7. P1 estado de resultados sin truncar y estados contables definidos
- [ ] 8. P1 bitácora no falsificable (revocar INSERT directo + RPC allowlisted)
- [x] 9. P1 cobranza externa por rol exacto en edge functions
- [x] 10. P1 crons de auditoría devuelven 5xx ante fallos reales

## Cierre de ronda (yo)
- [ ] Replay local, baseline, manifiesto de migraciones y guards
- [ ] Typecheck, lint, tests, bump de versión y CHANGELOG

## Fuera de alcance (no implementar aún)
Doble email de estado de cuenta, edición de notificaciones, tracking de bounce,
badge 50, retry de reapertura, lista de REP truncada.
- [x] Corregir errores de typecheck del preview (estadoResultados.ts)
