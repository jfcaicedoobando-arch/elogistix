# Roadmap ronda YAGNI post v13.823.32

- [x] 1 Cierre idempotente de cancelación/sustitución FacturApi (RPC compartida + webhook + camino síncrono)
- [x] 2 Traspasos: FOR UPDATE en cuentas origen/destino
- [x] 3 Traspasos: rechazo de fecha anterior al corte
- [ ] 4 Reposición A→B→A de documento de embarque
- [ ] 5 Costo + vínculo de factura atómicos (RPC)
- [x] 6 Conciliación de embarques sin truncar a 5000
- [x] 7 Cartera de Dirección con todas las facturas abiertas (ya estaba corregido)
- [ ] 8 Rentabilidad sin TC: advertencia + exportación marcada (pruebas pendientes)
- [ ] 9 Roles asignables por admin_org: paridad UI/backend
- [ ] 10 action=list sólo administrativo + list-nombres mínimo
- [ ] Cierre: aplicar migraciones, manifiesto, typecheck/lint/tests, versión y changelog
- [ ] Errores de typecheck del preview en verde antes de terminar
