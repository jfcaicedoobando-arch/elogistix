## Bug

Al revalidar tarifa en `/cotizaciones/...`, la RPC `crear_embarque_borrador_core` explota con:

> record "v_cot" has no field "tipo_contenedor_id"

## Causa raíz (verificada contra la BD)

Hay **drift** entre el archivo canónico y la función viva en la base:

- **Archivo canónico** `supabase/schema/embarques/crear_embarque_borrador_core.sql` — usa `v_cot.tipo_contenedor` (correcto).
- **Función viva en BD** — usa `v_cot.tipo_contenedor_id` (columna inexistente).

Comprobado con `information_schema.columns`: en `public.cotizaciones` solo existe `tipo_contenedor text` y `num_contenedores int`. No existe `tipo_contenedor_id`.

Alguna migración anterior desplegó una versión de la función distinta al canónico y se quedó ahí. El audit `audit:rpc-columns` no lo detectó porque solo lee los archivos SQL del repo, no el estado real de la BD.

Analogía: el manual (repo) dice "conectar el cable rojo", pero el técnico en el sitio (BD) conectó el azul. Cada quien está seguro de tener razón, y el foco no prende.

## Alcance del cambio

Solo backend/DB (una migración). Sin cambios de UI ni lógica de negocio.

## Pasos

1. **Migración `resync_crear_embarque_borrador_core`**: `CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(...)` con exactamente el cuerpo del archivo canónico (que ya usa `v_cot.tipo_contenedor` + cast a uuid como fallback). Mantener `SECURITY DEFINER`, `search_path=public`, y el bloque `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role` para no reintroducir H6.
2. **Test de regresión** — Extender `src/__tests__/architecture/revalidar-tarifa-puertos-lookup.test.ts` (o crear archivo hermano) para prohibir la cadena literal `tipo_contenedor_id` en el archivo canónico. Barato y suficiente contra reintroducciones desde el repo.
3. **Extender el audit de drift live↔canónico** (opcional pero recomendado): agregar un modo en `scripts/audit-rpc-columns.ts` (o script hermano `audit:rpc-drift`) que compare `pg_get_functiondef()` de las RPCs listadas contra el archivo canónico en `supabase/schema/**` y falle si difieren en identifiers de columnas. Esto habría atrapado este bug antes de producción. Si prefieres dejarlo para otra tanda, lo omito.
4. **Bump `APP_VERSION`** a `13.320.4` + entrada breve en `CHANGELOG.md`.

## Detalles técnicos

- El canónico ya maneja el fallback correcto:
  ```sql
  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_cot.tipo_contenedor ~* '^[0-9a-f-]{36}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;
  ```
  Con eso, cotizaciones que guardaron el código (`"40HC"`) y las que guardaron un UUID en `tipo_contenedor` funcionan igual.
- No se toca la tabla `cotizaciones` — la columna `tipo_contenedor_id` nunca existió; era una referencia fantasma en la RPC viva.
- La migración es puramente `CREATE OR REPLACE`, sin `DROP` ni cambios de firma, así que es idempotente y no impacta triggers/policies.

## Preguntas para ti

¿Incluyo el paso 3 (extender el audit para detectar drift live↔canónico) en esta misma tanda, o lo dejo para después y solo aplico 1+2+4?
