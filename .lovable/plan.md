

## Unificar el cálculo de alertas entre sidebar y dashboard

### Problema
El badge rojo del sidebar y la tarjeta "Alertas de Demora" del dashboard muestran números diferentes porque usan criterios distintos:

- **Sidebar** (`sidebar_alert_counts`): Filtra por `estado = 'Arribo'` (valor crudo en la columna) + facturas vencidas
- **Dashboard** (`dashboard_stats`): Calcula un `estado_real` dinámico basado en fechas (ETD/ETA), lo que atrapa más embarques que ya pasaron su ETA pero cuyo estado no fue actualizado manualmente

Además, el sidebar suma facturas vencidas al total, pero el dashboard no las muestra visualmente en ningún lado.

### Solución

1. **Actualizar `sidebar_alert_counts`** para usar la misma lógica de `estado_real` que el dashboard. Reemplazar `e.estado = 'Arribo'` por el CASE que calcula el estado dinámico basado en fechas, de modo que ambos conteos sean consistentes.

2. **Mostrar facturas vencidas en el dashboard** (opcional pero recomendado): Dado que el sidebar las cuenta, agregar una indicación visual en el dashboard para que el desglose sea claro. Esto puede ser una segunda tarjeta o un segundo bloque dentro de AlertasDemoraCard.

### Detalles técnicos

**Migración SQL** — actualizar la función `sidebar_alert_counts`:
```sql
CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
         WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
              AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
           CASE
             WHEN current_date < e.etd THEN 'Confirmado'
             WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
             WHEN current_date >= e.eta THEN 'Arribo'
             ELSE e.estado::text
           END
         ELSE e.estado::text
       END = 'Arribo'
       AND (e.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND (f.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS facturas_vencidas;
$$;
```

**`src/pages/Changelog.tsx`** — entrada v8.1.0

### Archivos a modificar
- Migración SQL (función `sidebar_alert_counts`)
- `src/pages/Changelog.tsx`

