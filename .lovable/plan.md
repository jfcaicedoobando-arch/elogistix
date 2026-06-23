## Hallazgo en Sentry

**Issue JAVASCRIPT-REACT-16** (`/cxp`, release 13.114.13, 6 eventos, 2 usuarios, regresión)

```
code: 42804
message: structure of query does not match function result type
details: Returned type estado_embarque does not match expected type text in column 4.
queryKey: ["cxp", "sugerir_embarques", ...]
```

### Analogía
Es como un molde de galletas: la receta promete entregar "texto" en la cuarta casilla, pero el horno está sacando una "etiqueta de estado" (un tipo enumerado de Postgres). Postgres rechaza la entrega porque las formas no coinciden.

### Causa raíz
La función `public.sugerir_embarques_para_proveedor` declara la columna 4 como `text`, pero las tres ramas del `UNION ALL` devuelven `e.estado`, que es del tipo enum `estado_embarque`. Postgres exige coincidencia exacta y aborta la consulta.

Archivo afectado: `supabase/migrations/20260622030653_…sugerir_embarques….sql` (definición vigente del RPC).

## Plan

1. **Nueva migración SQL** que reemplaza el RPC con `CREATE OR REPLACE FUNCTION` cambiando los tres `e.estado` por `e.estado::text` (sin tocar firma ni GRANT). Es un fix puro de casteo, no cambia lógica ni resultados visibles.
2. **CHANGELOG.md + APP_VERSION** → bump a `13.114.16` con nota: "Fix RPC `sugerir_embarques_para_proveedor`: cast `estado::text` para resolver error 42804 en módulo CxP."
3. Verificación: la función ya tiene cobertura de uso en `useSugerirEmbarques`; el error desaparece al recargar `/cxp`. No requiere cambios de frontend ni de tipos generados (la firma `RETURNS TABLE` no cambia).

## Detalles técnicos

- Tres lugares a castear dentro del CTE `candidatos`: rama "match directo", "tarifa vinculada (agente)" y "tarifa vinculada (naviera)".
- Mantener `SECURITY DEFINER`, `STABLE`, `SET search_path = public` y el `GRANT EXECUTE … TO authenticated` existentes.
- No se tocan políticas RLS ni grants de tablas.
