## Problema

El dashboard cuenta **contenedores** (una fila por contenedor en `embarques`), mientras que la lista `/embarques` deduplica por expediente. Resultado: el dashboard dice "4 en Arribo" pero la lista muestra "1 embarques encontrados".

## Solución

Unificar la comunicación mostrando ambas unidades en la lista, sin cambiar la lógica del dashboard ni del RPC.

### Cambios

**1. `src/hooks/embarques/useEmbarquesPageState.ts`**
- Exponer dos contadores derivados:
  - `expedientesCount`: número de expedientes únicos visibles (= `filtered.length` actual)
  - `contenedoresCount`: suma de `contenedoresPorExpediente[exp]` para los expedientes filtrados; si no hay filtros activos, usar `totalCount` del servidor

**2. `src/pages/Embarques.tsx`**
- Cambiar la descripción del `PageHeader` a:
  `"{contenedoresCount} contenedor(es) en {expedientesCount} expediente(s)"`
- Usar el helper de pluralización existente

**3. Versionado**
- `APP_VERSION` → **8.153.1**
- Nueva entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` explicando la corrección de consistencia dashboard ↔ lista

### Archivos a tocar
- `src/hooks/embarques/useEmbarquesPageState.ts`
- `src/pages/Embarques.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

Sin cambios en RPC, esquema ni en el dashboard.