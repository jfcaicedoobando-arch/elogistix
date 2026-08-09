# Verificación de la auditoría externa y plan de corrección

Revisé una muestra de los hallazgos contra el código real. **Sí, la mayoría son bugs reales** — con un par de matices donde el auditor se quedó con una versión vieja del archivo.

## Lo que confirmé bug real

| # | Hallazgo | Evidencia verificada |
|---|---|---|
| C1 | Superadmin sin tenant ve datos de todas las orgs | `cxcAging.ts` llama `cxc_aging_clientes` **sin** `p_org`; el tenant del switcher vive sólo en el navegador |
| C2 | Helpers SQL fail-open con org NULL | `_assert_writer` / `_assert_internal_reader`: `p_org = current_user_org_id()` da NULL → `IF NOT NULL` no lanza excepción → pasa |
| C3 | Saldo CxP suma pagos en otra moneda | `proveedorFacturas.helpers.ts` suma `p.monto`; `monto_en_moneda_factura` tiene **0 usos** en `src/` |
| C5 | Cron de cotizaciones aborta | el guard sólo permite entrar a `Vencida`; no existe transición a `Archivada`, y el job hace `SET estado='Archivada'` |
| A1 | `ProtectedRoute` fail-open | `sinAcceso` exige `Boolean(effectiveRole)`: con rol `null` deja pasar |
| A6 | Soft-delete ignorado | `listarPagosFactura` no filtra `deleted_at` |
| A8 | Edge functions de cobranza rotas | ambas piden `facturas.saldo`; esa columna **no existe** en el esquema |
| A11 | Fechas contables en UTC | `facturasCrud.ts:105`, `sincronizarEtapa.ts:38,42`, `cotizacion/mutations/crear.ts:36` |
| A12 | Badges del sidebar congelados | `invalidateSidebarAlerts` sólo se usa en su propio test |
| M10 | Ruta legacy sin guard | `/proveedores/:id` sin `guarded(...)`, a diferencia de `/compras/proveedores/:id` |
| M12 | Filtro de fecha no resetea página | `setDateFrom/To` no toca `page` |

## Lo que está desactualizado o matizado

- **C4 (parcial):** `DialogRegistrarPago` ya usa el canon `factorEntreMonedas` (no el ratio pago/factura), así que la parte del "TC con semántica equivocada" ya está corregida. **Sí sigue vivo** lo demás: `PagoFormFields` lista todas las cuentas sin filtrar por moneda, y el abono depende de `tipoCambioUsd` sin validar la moneda de la cuenta.
- **M16 (.env):** la clave es publishable (pública por diseño); el riesgo real es higiene de repo, no fuga de credencial.

Analogía: el auditor entró a la bodega con una lista de inventario de la semana pasada. Casi todo lo que apuntó sigue en el piso; sólo dos cajas ya las habíamos movido.

## Orden de corrección propuesto

**Ola 1 — seguridad y fuga de datos (bloqueante)**
1. C2: en `_assert_writer`, `_assert_internal_reader`, `_assert_writer_cotizacion` y los 4 guards inline, rechazar primero `current_user_org_id() IS NULL AND NOT super_admin`.
2. C1: `p_org` obligatorio desde el frontend (org activa del `OrganizationContext`); en servidor, si es super admin y `p_org IS NULL` → error "selecciona una organización"; bloquear módulos operativos cuando `requiereSeleccionOrg`.
3. A1: `ProtectedRoute` fail-closed. A13/M1: rol efectivo org→global sin fallback permisivo. M10/M11: guard en rutas legacy y matriz fail-closed. A9: allowlist de dominios en `e2e-provision-users`.

**Ola 2 — dinero (saldos que mienten sin error visible)**
4. C3: usar `COALESCE(monto_en_moneda_factura, monto)` en el saldo CxP.
5. C4 residual: filtrar cuentas por moneda + validar moneda cuenta↔pago.
6. A6: barrido de `deleted_at IS NULL` en las 4 instancias (pagos, guard CxP, badge de pendientes, trigger de NC).
7. A7/A10/M5/M6: eliminar los fallbacks `?? 1` y el TC hardcodeado 17.25/18.5; marcar `sin_tc`.
8. A5: rechazar totales ≤ 0 al facturar proforma y verificar filas afectadas.

**Ola 3 — flujos rotos**
9. C5 + A3: permitir `Vencida→Archivada` y la reactivación en el guard; envolver el paso 4c del cron en su propio `EXCEPTION`.
10. A4: unificar reapertura de embarque en una sola RPC con bypass y destino/roles consistentes.
11. A8: calcular saldo por RPC en las dos edge functions de cobranza.
12. A2: una sola fuente de verdad de organización activa.

**Ola 4 — medios/bajos**
13. Transaccionalidad en conversiones (M3, M4, M7, M15), conciliación multimoneda (M8), invalidaciones stale (M13), race de PDF (M14), M17, A11, A12, M12 y los 9 bajos.

## Notas técnicas

- Cada ola cierra con migración + test guardrail (patrón `src/lib/__tests__/*.test.ts` que lee el SQL) y respeta H6 (`REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE` explícito) y los GRANT por tabla.
- `CHANGELOG.md` + bump de `APP_VERSION` por ola.
- Ninguna corrección toca datos de producción sin confirmarlo contigo primero.

¿Arranco por la Ola 1 completa, o prefieres que primero te entregue sólo C1+C2 para validar el modo superadmin?
