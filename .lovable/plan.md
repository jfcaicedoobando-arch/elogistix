# Buscador global no encuentra proformas

## Causa raíz

La RPC `public.busqueda_global(termino, limite)` sólo consulta 5 entidades: `embarques`, `clientes`, `proveedores`, `facturas` y `cotizaciones`. **No incluye `proformas`**, por eso aunque escribas el número (ej. `P-001`) o el cliente, no aparece nada en Ctrl+K.

Además, el frontend (`GlobalSearch.tsx` + `types/search.ts`) sólo conoce los 5 tipos existentes y no tiene icono/label/ruta para `proforma`.

## Cambios propuestos

### 1. Migración SQL — extender `busqueda_global`
Agregar un `UNION ALL` extra que devuelva proformas filtradas por org (mismo patrón que las demás):

```sql
UNION ALL
(SELECT pr.id, pr.numero AS label,
        (pr.cliente_nombre || ' · ' || pr.expediente) AS sublabel,
        'proforma'::text AS tipo,
        '/embarques/' || pr.embarque_id || '?tab=proformas' AS url
 FROM proformas pr
 WHERE (pr.numero ILIKE '%'||termino||'%'
        OR pr.cliente_nombre ILIKE '%'||termino||'%'
        OR pr.expediente ILIKE '%'||termino||'%')
   AND (pr.organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin'))
 LIMIT limite)
```

Se hace `CREATE OR REPLACE FUNCTION` conservando `SECURITY DEFINER`, `STABLE` y `search_path=public`.

### 2. Frontend — soportar el tipo `proforma`
- `src/types/search.ts`: agregar `"proforma"` al union `type`.
- `src/components/shared/GlobalSearch.tsx`: agregar entrada en `typeIcons` (icono `FileSpreadsheet` o `Receipt` de lucide) y en `typeLabels` (`"Proformas"`).

La URL ya apunta al detalle del embarque con el tab de proformas, ruta que ya existe.

### 3. Verificación
- Probar Ctrl+K con un número de proforma conocido y con el nombre de un cliente que tenga proformas.
- Confirmar que el grupo "Proformas" aparece con icono y al hacer clic navega al embarque correspondiente.

### 4. Metadata
- Bump `APP_VERSION` (patch → `13.22.5`).
- Entrada en `CHANGELOG.md` (root) bajo nueva versión: *"Buscador global (Ctrl+K) ahora incluye proformas por número, cliente o expediente."*

## Fuera de alcance
- No se modifica el buscador del CRM (`useCrmSearch`).
- No se cambia el límite por tipo (sigue en 5).
- No se rediseña el popover de resultados.
