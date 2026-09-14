# Falso "la cotización no tiene costos cargados" al crear embarque

## Qué está pasando

La cotización COT-2026-0249 **sí tiene** su desglose de costos capturado (2 renglones vivos, 2 conceptos de venta, estado Aceptada, documento transaccional).

El aviso es un falso negativo: antes de crear el embarque, la pantalla cuenta los renglones de costos **con los permisos del usuario**. Valeria es Coordinador Logístico, y ese rol no tiene permiso para ver importes de costos de cotizaciones (sólo gerencias, ventas, pricing, contabilidad y administración). Para ella la consulta devuelve "cero renglones" sin error, y la pantalla concluye que no hay desglose.

Analogía: el guardia le pide a Valeria que confirme que la caja fuerte tiene dinero, pero ella no tiene llave para abrirla; al no ver nada, el guardia asume que está vacía y no la deja pasar.

El servidor sí lo evalúa bien (con permisos elevados), así que el problema es sólo el chequeo previo de la pantalla.

## Corrección propuesta (mínima)

1. Nueva función de base `public.cotizacion_tiene_costos(uuid)`: devuelve únicamente verdadero/falso sobre la existencia de renglones vivos, validando que la cotización sea de la empresa activa del usuario. No expone ningún importe. Permisos mínimos canónicos (nadie público ni anónimo; ejecución para usuarios autenticados y el sistema).
2. El chequeo previo de la pantalla deja de contar filas directamente y pregunta a esa función. Sigue siendo "a prueba de fallos": si la verificación no se puede hacer, no se procede.
3. No se cambia quién puede ver importes de costos, ni las reglas de conversión, ni la validación del servidor.

## Detalles técnicos

- Causa raíz: `tieneCostosCargados` (`src/features/cotizacion/services/candadoCostos.ts`) hace `select count` sobre `cotizacion_costos`; la política `Tenant read cotizacion_costos` exige `puede_ver_costos_cotizacion(uid)` (lista de roles que excluye `coordinador_logistico`) o `puede_ver_costos_cotizacion_propia` (sólo `vendedor` dueño). RLS filtra sin error ⇒ `count = 0` ⇒ falso negativo en `verificarCostosOAvisar`, usado por `useCrearEmbarqueConRevalidacion` y `useCrearEmbarqueBorradorHandlers`.
- Migración: `CREATE OR REPLACE FUNCTION public.cotizacion_tiene_costos(p_cotizacion_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog`, con `EXISTS` sobre `cotizacion_costos cc JOIN cotizaciones c` filtrando `c.organization_id = public.current_user_org_id()` y `cc.deleted_at IS NULL`. Cierre H6: `REVOKE ALL ... FROM PUBLIC, anon;` + `GRANT EXECUTE ... TO authenticated, service_role;`.
- Espejo canónico en `supabase/schema/cotizaciones/cotizacion_tiene_costos.sql` en el mismo cambio.
- `candadoCostos.ts`: `supabase.rpc("cotizacion_tiene_costos", { p_cotizacion_id })`; error ⇒ `CandadoCostosNoVerificableError` (sin cambios de contrato aguas arriba).
- Prueba SQL `supabase/tests/candado_costos_coordinador.sql` registrada en `_guards_manifest.txt`: con JWT de un `coordinador_logistico` de la org, la función devuelve `true` para una cotización con costos y `false` para una sin ellos; una cotización de otra organización devuelve `false`.
- Test focal de `candadoCostos.test.ts` actualizado al mock de `rpc`.
- Versionado: bump `APP_VERSION` + `CHANGELOG.md` + `bun run db:release-manifest:update`.
- Validación local: typecheck y vitest focal. CI/RLS completos quedan a GitHub Actions.
