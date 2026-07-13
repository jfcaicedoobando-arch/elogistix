# Búsqueda global por BL (Master / House)

Hoy el Ctrl+K sólo matchea embarques por `expediente`. Los usuarios necesitan pegar un número de BL y llegar al embarque.

## Alcance
- Extender la rama `embarques` de la RPC `busqueda_global` para incluir `bl_master` y `bl_house` en el `WHERE`.
- Mostrar el BL matcheado en el `sublabel` para que el usuario confirme visualmente el resultado.
- Actualizar el placeholder del input de `GlobalSearch.tsx` para mencionar "BL".
- Añadir un caso de prueba en `src/features/search/services` (o el test existente de la RPC) que valide match por BL Master y BL House.

## Cambios técnicos

1. **Migración SQL** (`supabase/migrations/…_busqueda_global_bl.sql`)
   - `CREATE OR REPLACE FUNCTION public.busqueda_global(...)` con la rama de embarques ampliada:
     ```sql
     WHERE (
       e.expediente ILIKE '%'||termino||'%'
       OR e.bl_master ILIKE '%'||termino||'%'
       OR e.bl_house  ILIKE '%'||termino||'%'
     )
     ```
   - `sublabel` ampliado: cliente + indicador de match, ej.
     `cliente_nombre || ' · BL/M ' || bl_master` cuando el término coincide con Master (misma lógica para House). Si sólo matchea expediente, se mantiene el sublabel actual (cliente + contenedores).
   - Resto de ramas (clientes, proveedores, facturas, cotizaciones, proformas, factura_proveedor) sin cambios.
   - Mantener `SECURITY DEFINER`, `search_path=public`, y el filtro `organization_id = current_user_org_id() OR has_role(...,'super_admin')`.

2. **Frontend**
   - `src/components/shared/GlobalSearch.tsx`: cambiar placeholder a algo como `"Buscar por expediente, BL, cliente, factura…"` y el texto del botón se mantiene.
   - No hace falta tocar `useGlobalSearch` / `services/index.ts` — la forma de la fila (id/label/sublabel/tipo/url) no cambia.

3. **Tests**
   - Añadir test en `src/features/search/services/__tests__/` (crear si no existe) que mockee `supabase.rpc` para verificar que se pasa el término tal cual y se mapea la fila. No re-testeamos SQL, pero sí el contrato.
   - Opcional: smoke test manual — buscar por un BL conocido y verificar que aparece el embarque.

4. **Housekeeping**
   - Bump `APP_VERSION` a `13.297.3`.
   - Entrada en `CHANGELOG.md`: "Búsqueda global (Ctrl+K) ahora encuentra embarques por BL Master y BL House."

## Consideraciones
- `bl_master` / `bl_house` en `embarques` pueden compartirse entre múltiples filas (contenedores del mismo embarque). El `DISTINCT ON (e.expediente)` actual ya deduplica correctamente.
- Sin cambios de índices por ahora — los BL suelen ser < 20 chars y el volumen por org es bajo; si aparece latencia, se puede añadir un índice trigram (`pg_trgm`) en una fase posterior.
- No afecta permisos ni RLS: los mismos filtros existentes siguen aplicando.
