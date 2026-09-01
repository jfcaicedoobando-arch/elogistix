# Roadmap — Ola crítica P0/P1 (HEAD d8f7c8be / v13.821.7)

- [ ] P0-1 `facturapi-enviar-email` no compila (export `resolverDestinatarioAutorizado`, identificadores muertos en bitácora)
- [ ] P1-2 Timeouts inciertos en `facturapi-cancelar-rep` y `facturapi-cancelar-nota-credito` (contrato 202 uncertain como en `facturapi-cancelar`)
- [ ] P1-3 Conciliador `facturapi-reconciliar-cancelaciones`: presupuesto global, orden por `last_checked_at`, sin starvation
- [ ] P1-4 Segregación fiscal: `_shared/facturapiAuth.ts` fail-closed por organización (legacy sólo org explícita)
- [ ] P1-5 CRM multimoneda: KPIs por moneda server-side (Cliente360, Forecast, leaderboard)
- [ ] P1-6 Cartera Dirección: aging/cartera abierta sin ventana de 6 meses
- [ ] P1-7 Tesorería EUR: TC canónico MXN/USD/EUR en saldos, runway y footer
- [ ] Cierre: tests dirigidos, typecheck, lint, audit:arch, build, CHANGELOG + APP_VERSION
- [ ] Cierre typecheck preview: errores CRM (tipos por moneda no propagados a UI/tests) y `direccion/services/loaders.ts` (array de estados sin `as const`) — se resuelven al terminar P1-5/P1-6.
