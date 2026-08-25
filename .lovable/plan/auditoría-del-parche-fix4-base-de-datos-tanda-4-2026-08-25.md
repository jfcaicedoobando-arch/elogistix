# Auditoría del parche FIX4 — base de datos (tanda 4)

Verifiqué los 6 hallazgos contra la base de datos viva. **Todos son bugs reales.**

## Verificación

| Hallazgo | ¿Real? | Evidencia comprobada |
|---|---|---|
| N-1 · Papelera de embarque con cotización "En operación" | Sí (bloquea al usuario) | El trigger de papelera revierte la cotización a "Aceptada", pero el guard de estados no permite "En operación" → "Aceptada": el borrado suave falla con `LC_COT_TRANSICION_INVALIDA` |
| N-2 · Portal público de proforma da 500 | Sí (crítico) | La RPC del portal lee `moneda/subtotal/iva/total`; esas columnas ya no existen (hoy son `subtotal_mxn/usd`, `iva_mxn/usd`, `total_mxn/usd`) → error 42703 en todo enlace vigente |
| N-2b · Responder desde el portal da 500 | Sí | `bitacora_actividad.usuario_id` es NOT NULL y el actor anónimo inserta nulo |
| P3 · `health-check.sql` roto | Sí (script interno) | `auditoria_snapshots` hoy tiene `total_hallazgos/total_pendientes/criticos/altos/medios/score`, no las columnas que consulta el script |
| P3 · Carrera al crear el primer usuario | Sí (riesgo de privilegios) | El disparador de registro corona super_admin con un conteo sin bloqueo: dos altas simultáneas en sistema vacío quedan ambas como super_admin |
| P3 · Candado CI de funciones service_role-only | Sí (deuda de proceso) | En producción `venta_embarque_mxn_neta` ya está cerrada; el riesgo es de reapertura silenciosa por espejos, que hoy nadie detecta |

Analogía: el portal es como una recepción que sigue pidiendo un formulario que la oficina ya rediseñó; contesta "error" a todos. Y la papelera es una puerta con dos guardias: uno te empuja a salir y el otro no te deja pasar.

## Qué implementar

1. **N-1**: el trigger de papelera marca una bandera transaccional (`app.liberando_papelera`, mismo patrón que `app.bypass_cierre`) y el guard admite *sólo* "En operación" → "Aceptada" con esa bandera puesta. Cualquier otra transición sigue prohibida.
2. **N-2**: la RPC del portal devuelve los totales duales (MXN y USD) y conserva las claves antiguas derivadas (MXN si tiene importes en MXN, si no USD). Se sincroniza el espejo del esquema, el tipo en `portalPublico.ts` y `PortalProformaResumen.tsx` muestra bloques por moneda cuando la proforma mezcla monedas. Se mantiene la regla de que un enlace no vigente no expone montos.
3. **N-2b**: `bitacora_actividad.usuario_id` pasa a admitir nulos; `usuario_email` sigue siendo la pista de auditoría del actor anónimo.
4. **P3 health-check**: alinear la consulta de snapshots a las columnas actuales.
5. **P3 registro**: `pg_advisory_xact_lock` con clave estable alrededor del bootstrap de super_admin.
6. **P3 candado CI**: lista canónica `supabase/tests/rls/_ci_service_role_only.sql` consumida por el re-cierre y por un nuevo chequeo bidireccional que corre después de migraciones y antes del GRANT masivo; re-cierre explícito de `venta_embarque_mxn_neta`; whitelist del linter org-scope de 49 a 42 entradas.
7. Cuatro pruebas nuevas en CI (`fix4_n1_*`, `fix4_n2_*`, `fix4_service_role_only_grants`, `fix4_signup_bootstrap_lock`) agregadas a `rls-tests.yml`.

## Ajustes necesarios al parche

- **Versión**: el parche sube 13.737.1 → 13.738.0, pero el proyecto ya está en **13.739.2**. Se aplicará como **13.739.3** con su entrada de CHANGELOG.
- **Choque de nombre de migración**: `20260901000100` ya existe (`_r4_replay_avanzar_estado_embarque.sql`). Las cuatro migraciones se renumeran a `20260901001000/001100/001200/001300`.
- Tras aplicar: manifiesto de migraciones sincronizado, lint/tipos/pruebas/build en verde.
