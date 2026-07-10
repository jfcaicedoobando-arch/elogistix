## Lote 8a.2d — Barrido masivo de services restantes

**Objetivo**: reducir los 222 sitios con `if (error) throw error` distribuidos en 130 archivos, migrándolos al helper `unwrap`/`unwrapOr`/`run` ya existente en `src/lib/supabase/response.ts`.

### Alcance de este lote

Migrar los **20 archivos con mayor densidad** de boilerplate (aprox. 65-75 sitios, ~65-75 líneas netas eliminadas):

| # | Archivo | Sitios |
|---|---------|--------|
| 1 | `src/features/cliente/services/crud.ts` | 6 |
| 2 | `src/features/configuracion/components/CatalogoClavesSATCard.tsx` | 4 |
| 3 | `src/features/reportes/services/index.ts` | 3 |
| 4 | `src/features/portal/services/perfil.ts` | 3 |
| 5 | `src/features/portal/services/notificaciones.ts` | 3 |
| 6 | `src/features/notificaciones/services/index.ts` | 3 |
| 7 | `src/features/facturacion/services/pagos/index.ts` | 3 |
| 8 | `src/features/facturacion/services/facturasCrud.ts` | 3 |
| 9 | `src/features/embarques/services/documentos.ts` | 3 |
| 10 | `src/features/embarques/services/contenedores/crud.ts` | 3 |
| 11 | `src/features/dashboard/direccion/services/loaders.ts` | 3 |
| 12 | `src/features/cxp/services/proveedorFacturas.crud.ts` | 3 |
| 13 | `src/features/cxp/services/pagosProveedor.ts` | 3 |
| 14 | `src/features/crm/services/leads/mutations.ts` | 3 |
| 15 | `src/features/crm/services/leads/convertir.ts` | 3 |
| 16 | `src/features/crm/services/leads/bulk.ts` | 3 |
| 17 | `src/features/cotizacion/services/conversiones/embarques.ts` | 3 |
| 18 | `src/features/costeo/services/demorasVenta.ts` | 3 |
| 19 | `src/features/costeo/services/aprobacion.ts` | 3 |
| 20 | `src/features/comisiones/services/liquidaciones.ts` | 3 |

Los archivos restantes (110 archivos con 1-2 sitios cada uno) quedan para un **8a.2e** posterior si decides continuar; el ROI baja porque el ahorro por archivo es menor.

### Regla de migración

- `.select().single()` con throw → `unwrap(await supabase.from(...)...)`
- `.select()` con throw (múltiples filas) → `unwrap(await supabase.from(...)...)` (retorna arreglo)
- `.insert/.update/.delete` con throw sin retorno → `run(await supabase.from(...)...)`
- Si el llamador ya maneja `null` como caso válido → `unwrapOr(response, fallback)`
- **No cambiar firmas públicas** de las funciones migradas (mismo retorno, mismo shape). Cambio invisible para consumidores.

### Verificación

1. `bun run lint` sin nuevos warnings.
2. `bunx tsgo --noEmit` limpio.
3. Correr tests existentes que tocan los archivos migrados: `bunx vitest run src/features/cliente src/features/crm src/features/cxp src/features/facturacion` (los que tengan tests).
4. Muestra de humo en preview: abrir Cartera, CxP, un lead CRM y un embarque para confirmar que las queries siguen respondiendo.

### Detalles técnicos

- Helper canónico ya existe: `src/lib/supabase/response.ts` (exports `unwrap`, `unwrapOr`, `run`).
- Ahorro esperado: **~65 líneas netas** en este lote (se elimina la línea `if (error) throw error;` y en muchos casos también la desestructuración `const { data, error } = ...` se colapsa a una sola línea).
- Impacto acumulado DRY tras 8a.2d: **~1,397 líneas** desde el inicio de la auditoría.
- Version bump: `APP_VERSION` → `13.249.0`. CHANGELOG con lista de archivos tocados.

### Fuera de alcance

- No se tocan los 110 archivos con 1-2 sitios cada uno (candidatos para 8a.2e).
- No se refactorizan firmas ni se cambia el shape de respuesta.
- No se toca lógica de negocio ni RLS.
- Los warnings de seguridad del panel actual (backup tables, catálogos globales) siguen fuera del scope de la auditoría DRY.
