# Validación del parche fix-b6-roles.diff

## Veredicto: 1 bug real (latente), el resto es andamiaje útil

### H1 — Bug REAL: el piloto de la Ola 8 amplió permisos sin querer

Las 3 RPCs del piloto autorizan hoy con `has_any_role_in_org(...)`, y ese helper
expande cada rol con `roles_jerarquia`. Verificado en la base viva:
`roles_jerarquia('contador') = {contador, auxiliar_contable, admin_org, super_admin}`.

Antes del piloto la autorización era una lista literal sobre `user_roles`
(confirmado en la migración `20260826002000`), sin `auxiliar_contable`:

```text
registrar_pago_proveedor_lote / registrar_pago_cliente_lote
  antes: {admin, admin_org, super_admin, contador, tesorero}
  hoy:   + auxiliar_contable (por jerarquía)

eliminar_pago_proveedor
  antes: es_escritor_financiero = {super_admin, admin, admin_org, contador, tesorero, ejecutivo_cobranza}
  hoy:   + auxiliar_contable
```

Analogía: se cambió la lista de la caseta por "el jefe de contabilidad y su
gente", y con eso entró también el auxiliar, que antes no tenía llave de la
chequera.

Impacto hoy: **cero usuarios afectados** — no existe ninguna membresía
`auxiliar_contable` en la base (roles vivos: admin_org 6, coordinador_logistico 4,
contador 3, vendedor 2, gerente_comercial 2, gerente_operaciones 2,
ejecutivo_pricing 1, gerente_visor 1). Es una puerta abierta latente, no un
incidente en curso. Vale corregirla: pagar y borrar pagos es dinero.

### H2 — Riesgo NO introducido por este parche

El parche trae `scripts/db/predeploy_b6_roles_legacy.sql` para detectar usuarios
con rol financiero sólo en `user_roles` y sin membresía. Ese riesgo ya existe
desde la Ola 8 (el piloto ya lee membresías), no lo agrega este fix. Consulta
ejecutada en la base viva: **1 registro, y es el `super_admin` de plataforma**,
que conserva su bypass. Nadie queda bloqueado. El script se conserva como
herramienta de verificación, no como bloqueante.

### Lo demás del parche

- `has_any_role_in_org_exact`: no existe en la base (`0` en `pg_proc`). Es
  necesario para el fix.
- `supabase/tests/ola8_has_role_in_org.sql` y
  `supabase/tests/rls/test_rls_rpc_org_scope_linter.sql`: útiles, cierran la
  regresión y congelan la deuda de RPCs `SECURITY DEFINER` sin ancla de tenant.
- Espejos canónicos de las 3 RPCs: necesarios para que el fix sobreviva un
  replay en base limpia.

## Qué implementar

1. Migración con `has_any_role_in_org_exact` (mismo bypass `super_admin`, sin
   expansión de jerarquía) + re-emisión de los 3 cuerpos con la lista literal
   previa al piloto, conservando el scoping por organización de la Ola 8.
2. `auxiliar_contable` queda fuera, por decisión explícita. Si el negocio lo
   quiere dentro, se agrega aparte con su test y changelog.
3. Espejos canónicos en `supabase/schema/{cxp,facturacion,tesoreria}/` para las
   3 RPCs.
4. Suites nuevas de pruebas + cableado en `rls-tests.yml` (grupo `aislamiento`
   gana `rpc_org_scope_linter`).
5. `predeploy_b6_roles_legacy.sql` + riesgo `RN-5` documentado en
   `docs/riesgos-aceptados.md`.
6. Cierre: `migration-manifest.json`, `CHANGELOG.md` y `APP_VERSION` → 13.729.0
   (el parche traía 13.719.0, versión ya consumida).

## Detalles técnicos

- Se descarta el número de versión del diff y su bloque de CHANGELOG tal cual;
  se reescribe sobre la versión vigente.
- La migración se numera después de `20260827080020` (replay del piloto) para
  ganar el orden de replay; se revisa que no choque con los espejos posteriores
  (`20260828000100/200/300`, `20260829000100`) y, si hace falta, se emite con
  timestamp posterior a todos.
- `REVOKE ALL ... FROM PUBLIC, anon` en el helper nuevo (regla H6 / FIX-45),
  `GRANT EXECUTE` sólo a `authenticated` y `service_role`.
- Sin cambios de frontend: la matriz de permisos de UI ya excluye
  `auxiliar_contable` de `PAGAR_PROVEEDOR` / `REGISTRAR_COBRO`; el fix realinea
  la base de datos con la UI.
