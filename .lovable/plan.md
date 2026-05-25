# Diagnóstico de fallos en /crm

## Síntoma
En la red del preview aparecen dos requests con **HTTP 400** repetidos en el Dashboard del CRM:

```
GET /rest/v1/crm_oportunidades?select=...,crm_etapas_pipeline!inner(id,nombre,color,tipo)
GET /rest/v1/crm_oportunidades?select=...,crm_etapas_pipeline!inner(tipo)&fecha_estimada_cierre=gte...
```

Respuesta:
```
PGRST200: Could not find a relationship between 'crm_oportunidades' and 'crm_etapas_pipeline'
```

Esto rompe los widgets "Pipeline por etapa" y "Cierres próximos" del `CrmDashboard`.

## Causa raíz
- La columna `crm_oportunidades.etapa_id` (uuid) existe, pero **no tiene foreign key** hacia `crm_etapas_pipeline.id` (verificado: `pg_constraint` no devuelve filas para `crm_oportunidades`).
- PostgREST necesita una FK declarada para resolver el embed `crm_etapas_pipeline!inner(...)`. Sin ella → 400.
- Los hooks afectados son `src/hooks/crm/useCrmDashboard.ts` líneas 79 y 96.

Otros hooks (`useLeads`, `useForecastReportes`, etc.) hacen joins manuales y no se ven impactados.

## Plan de corrección

### 1. Migración SQL
Agregar la FK faltante (y otras relaciones del CRM que probablemente tampoco existan, para prevenir más 400s):

```sql
ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_etapa_id_fkey
  FOREIGN KEY (etapa_id) REFERENCES public.crm_etapas_pipeline(id)
  ON DELETE RESTRICT;

-- Índice para acelerar joins/filtros
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_etapa_id
  ON public.crm_oportunidades(etapa_id);
```

Revisaré también si faltan FKs en `crm_oportunidades.cliente_id → clientes.id`, `lead_id → crm_leads.id`, `motivo_perdida_id → crm_motivos_perdida.id`, y las agregaré sólo si están ausentes (sin romper datos existentes — la tabla está vacía hoy, 0 filas).

### 2. Verificación
- Recargar `/crm`, confirmar que ambos endpoints regresan 200.
- Confirmar que el Dashboard ya no muestra widgets en error.

### 3. Changelog
Entrada patch `v11.7.1` en `src/content/changelog/v8/chunks/0.ts` + `appVersion.ts`: "Corrige errores 400 del dashboard CRM agregando llaves foráneas faltantes en crm_oportunidades".

## Fuera de alcance
- Reescritura de hooks (no necesaria — el embed es válido una vez que existe la FK).
- Cambios visuales o nuevas features.
