# Ola 8 — Qué vale la pena implementar

Revisé el diff contra el código actual. `has_role_in_org` / `has_any_role_in_org` **no existen** hoy en la base (sólo `roles_jerarquia`), y las tres RPCs financieras del piloto siguen validando el rol de forma global. El kanban tampoco pagina (`ops.map` sin límite) y Analítica CRM no tiene gráficas. Es decir: lo estructural del diff es trabajo real y pendiente.

## Vale la pena (Entrega 1)

1. **Roles por organización (la cura de raíz).** Crear `has_role_in_org` / `has_any_role_in_org` leyendo la membresía en `organization_members`, con jerarquía canónica y bypass de `super_admin` (que es rol de plataforma). Migrar como piloto las 3 RPCs financieras: `registrar_pago_proveedor_lote`, `registrar_pago_cliente_lote`, `eliminar_pago_proveedor`. Hoy un contador de la organización A puede autorizar escrituras en la B: es exactamente la clase de bug que ya apareció dos veces (`reabrir_embarque_con_motivo`, `revertir_proforma…`).
   - Actualizar los espejos canónicos en `supabase/schema/` (cxp, facturacion, tesoreria, auditoria) en el mismo PR.
   - Test de regresión `supabase/tests/ola8_has_role_in_org.sql` + lint `test_rls_rpc_org_scope_linter.sql` (congela la deuda de RPCs que aún usan rol global) y registrarlos en el workflow de RLS.
   - Sincronizar `migration-manifest.json`.

2. **Paginación por columna del kanban CRM.** Límite de 50 tarjetas por etapa + aviso "Mostrando X de Y" + "Mostrar más". Barato y evita que una etapa con cientos de oportunidades congele el tablero. Incluye su prueba unitaria.

3. **Gráficas de Analítica CRM (embudo + forecast mensual).** Sustituyen las listas de texto por barras con tokens de color, esqueleto de carga y estado vacío. Es la parte de "CRM Fase 3" que no arrastra dependencias nuevas.

4. **Limpieza de tolerancia duplicada.** `cobroLoteValidaciones.ts` re-exporta `TOLERANCIA_SOBREPAGO` en lugar de redeclarar `0.005`. Una sola fuente de verdad.

## Aplazo (y por qué)

- **Web-to-lead desde la landing**: necesita edge function + captcha antes de publicar un formulario abierto; es un módulo nuevo, no un bug. Merece su propia entrega.
- **Sincronización de buzón/calendario y round-robin automático**: integraciones externas de alcance grande, sin bug detrás.
- **Valuación canónica de utilidad (un solo margen)**: vale mucho, pero toca comisiones, P&L y EERR a la vez; lo trato como entrega independiente con pruebas de paridad numérica, no dentro de este PR.
- **Bajar el ratchet de `toFixed` de 99 a 92**: sólo se puede bajar después de migrar realmente los call-sites; si no, rompe CI. Lo dejo para la limpieza continua.

## Detalles técnicos

- Migraciones nuevas: helper (`ola8_has_role_in_org`) y pilotos (`ola8_pilotos_rpcs_rol_por_org`), con `SECURITY DEFINER SET search_path = public`, `REVOKE` a `anon`/`PUBLIC` y `GRANT EXECUTE` a `authenticated`/`service_role` (respeta el guardrail FIX-45).
- Los cuerpos de las 3 RPCs se re-emiten completos y deben quedar 1:1 con `supabase/schema/` (guardrail `audit:replay-mirror`); se conservan los guards vigentes (idempotencia, T/C requerido, fecha futura, guard de vida por renglón).
- Errores nuevos con prefijo `LC_` y su mensaje en español en `lcCodeMessages.ts`.
- Componentes de gráficas nuevos en `src/features/crm/components/analitica/`, cada uno < 200 líneas (Power of 10) y usando `ChartTooltip`, `ChartSkeleton`, `EmptyStateInline`.
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md`.
