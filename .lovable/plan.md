# Revisión del parche `fix4-frontend-e2e.diff`

Verifiqué cada hallazgo contra el código actual. **Los 3 son reales**, con severidades distintas.

## 1. Crash al limpiar la fecha en "Nueva actividad" express (bug real, usuario visible)

`QuickCreateActividadPopover.tsx` hace `new Date(fecha).toISOString()` sin validar. El `DateTimePickerMx` emite cadena vacía cuando el usuario limpia el campo (`emitirFecha` → `limpiar()`), y `new Date("")` es *Invalid Date*: `toISOString()` lanza `RangeError: Invalid time value` y el popover truena sin toast útil. El diálogo hermano `NuevaActividadDialog` ya lo hace bien (`fecha ? ... : null`), así que la corrección solo homologa el comportamiento: fecha vacía → `null`, fecha no parseable → aviso "Selecciona una fecha válida".

Analogía: es como una calculadora que al dejar la casilla en blanco se apaga, en vez de decir "falta el dato".

## 2. El kanban de CRM no muestra la oportunidad recién convertida (bug real, moderado)

`useConvertirLead` solo invalida `crm.leads`, `crm.kpis` y `clientes`. La conversión crea una oportunidad nueva, pero no se invalida `crm.oportunidades.all` ni `crm.dashboardAll` (ambas llaves ya existen y sí se invalidan en `leads/mutations.ts` y `leads/bulk.ts`). Con `refetchOnWindowFocus` apagado, el usuario no ve la oportunidad hasta que vence el `staleTime` o recarga. Fix: agregar las dos invalidaciones.

## 3. Endurecimiento de la Edge Function de provisión E2E (riesgo real, no lo ve el usuario)

`e2e-provision-multi-tenant` hoy: compara el secreto con `!==` (no timing-safe) y acepta **cualquier** nombre de organización en el payload. Confirmado en el código: `cleanupOrgsByName` borra por nombre exacto con `service_role` (embarques, facturas y objetos de storage) y `provisionOne` hace upsert sobre la org encontrada. Si el secreto se filtrara, un nombre como "ACME SA" borraría o contaminaría una org real. La función solo se usa en el pipeline E2E, así que no hay incidente en producción, pero el radio de daño justifica el candado.

## Qué se implementará

- `orgNameAllowlist.ts` (módulo puro): solo nombres con prefijo de prueba (`E2E …` / `TEST …`, exigiendo separador para que "Testers Unidos" o "E2Ecommerce" no pasen), sobreescribible con `E2E_PROVISION_ORG_ALLOWLIST`.
- `index.ts`: comparación del secreto con `timingSafeEqual` (`_shared/timingSafe.ts` ya existe), rechazo `400 org_name_not_allowed` y sin fuga de detalle interno en el 500.
- `provisioning.ts`: validación antes de provisionar y doble verificación (payload + nombre persistido) antes de borrar.
- `scripts/e2e/provision-multi-tenant.ts`: nota sobre conservar el prefijo al personalizar nombres.

## Detalles técnicos

- Pruebas nuevas: `src/__tests__/security/e2eProvisionOrgAllowlist.test.ts` (allowlist) y `src/features/crm/hooks/__tests__/useConvertirLead.test.tsx` (invalidaciones + propagación de error).
- No hay cambios de base de datos ni migraciones.
- Cierre estándar: bump de `APP_VERSION` a `13.740.0` + entrada en `CHANGELOG.md`, y corrida de lint, tipos y suite de pruebas.
