## Auditoría arquitectónica — estado actual

Tras los refactors v8.95–v8.98 (notificaciones unificadas, reorganización de hooks/componentes, descomposición del wizard), la arquitectura está **mayormente sana**:

- ✅ **Separación de capas correcta**: 0 llamadas directas a `supabase.from/rpc` desde `components/` o `pages/`. Solo 5 imports legítimos de UI a `services/` (tipos + helpers de auth/storage en Login y TrackingPublico).
- ✅ **Hooks organizados por dominio** (`admin/`, `cliente/`, `cotizacion/`, `embarque/`, `portal/`, `shared/`, etc.).
- ✅ **Componentes organizados** en `layout/`, `auth/`, `selects/`, `shared/` + carpetas por dominio.
- ✅ **`services/` por dominio** con barrels (`embarque/`, `cotizacion/`, `portal/`, etc.).
- ✅ **205/205 tests pasando**, TypeScript limpio.

### Hallazgos menores restantes

1. **Inconsistencia en barrels de hooks**: `cotizacion/`, `embarque/`, `cliente/`, `proveedor/`, `usuario/`, `admin/`, `dashboard/`, `operaciones/`, `reportes/`, `facturacion/` **no tienen `index.ts`**, mientras que `portal/`, `catalogos/`, `configuracion/`, `shared/` **sí lo tienen**. Esto provoca imports verbosos y poco uniformes.
2. **Páginas planas en `src/pages/`**: 23 archivos en raíz, sin agrupación por dominio (a diferencia de `pages/admin/` y `pages/portal/` que sí están agrupadas).
3. **`useEmbarqueMutations.ts` (185 LOC)** mezcla mutaciones de creación, actualización, eliminación y cambio de estado — candidato a split por responsabilidad.
4. **`services/cotizacion/conversiones.ts` (225 LOC)** agrupa 4 conversiones heterogéneas (duplicar / prospecto→cliente / cotización→embarques / portal-respuesta). Candidato a split.
5. **`useTabProformasController.tsx` (214 LOC)** mezcla estado UI + orquestación de mutaciones — candidato a split entre estado y handlers.

Ninguno es crítico. Son mejoras incrementales de mantenibilidad.

---

## 5 mejoras propuestas (ejecutables en 1 solo paso, v8.99.0)

Ordenadas de mayor a menor impacto:

### 1. Unificar barrels de hooks por dominio (CRÍTICO para DX)
Crear `index.ts` en los 10 dominios de hooks que faltan (`cotizacion`, `embarque`, `cliente`, `proveedor`, `usuario`, `admin`, `dashboard`, `operaciones`, `reportes`, `facturacion`) re-exportando todos los hooks. Permite imports limpios:
```ts
// Antes
import { useEmbarques } from "@/hooks/embarque/useEmbarques";
import { useEmbarqueForm } from "@/hooks/embarque/useEmbarqueForm";
// Después
import { useEmbarques, useEmbarqueForm } from "@/hooks/embarque";
```
Sin tocar imports existentes (siguen funcionando), pero habilitan adopción gradual.

### 2. Agrupar páginas por dominio en `src/pages/`
Mover las 23 páginas raíz a sub-carpetas semánticas, alineado con el patrón ya existente de `admin/` y `portal/`:
```text
pages/
  auth/        → Login, TrackingPublico, NotFound
  dashboard/   → Dashboard, Operaciones, Reportes, Bitacora, Changelog
  embarques/   → Embarques, EmbarqueDetalle, NuevoEmbarque, EditarEmbarque
  cotizaciones/→ Cotizaciones, CotizacionDetalle, NuevaCotizacion, EditarCotizacion
  clientes/    → Clientes, ClienteDetalle
  proveedores/ → Proveedores, ProveedorDetalle
  facturacion/ → Facturacion
  admin-org/   → Configuracion, Usuarios   (admin de organización)
```
Actualizar imports lazy en `src/App.tsx`.

### 3. Split de `services/cotizacion/conversiones.ts`
Dividir en 4 archivos cohesivos bajo `services/cotizacion/conversiones/`:
- `duplicar.ts` — `duplicarCotizacion`
- `prospecto.ts` — `convertirProspectoACliente`
- `embarques.ts` — `convertirCotizacionAEmbarques`
- `portal.ts` — `portalResponderCotizacion`

Mantener `conversiones/index.ts` re-exportando todo para no romper consumidores.

### 4. Split de `useEmbarqueMutations.ts`
Separar en 3 hooks por responsabilidad bajo `hooks/embarque/mutations/`:
- `useCreateEmbarque.ts`
- `useUpdateEmbarque.ts`
- `useDeleteEmbarque.ts`

Mantener `useEmbarqueMutations.ts` como barrel re-export.

### 5. Split de `useTabProformasController.tsx`
Extraer la lógica de estado UI (filtros, paginación, selección) a `useTabProformasState.ts` y dejar el controller original como orquestador delgado de mutaciones + estado compuesto.

---

## Detalles técnicos

- **Cero cambios funcionales**: solo reorganización + nuevos barrels.
- **Compatibilidad backward**: todos los splits mantienen archivos/exports originales como re-exports para no romper consumidores ni tests.
- **Verificación**: `bunx tsc --noEmit` + `bunx vitest run` deben pasar 205/205.
- **Changelog**: agregar entrada **v8.99.0 — Refinamiento arquitectónico final** en `src/content/changelog/v8/chunks/0.ts`.
- **Memoria**: actualizar `mem://technical/architecture-and-standards` si procede.

## Si prefieres no aplicar todas

Si solo quieres lo de mayor impacto, las mejoras **#1 (barrels)** y **#2 (agrupar pages)** son las que más impacto tienen en DX y descubribilidad. #3, #4, #5 son refinamientos de cohesión que pueden dejarse para más adelante sin riesgo.
