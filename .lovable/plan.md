

Auditoría de arquitectura — solo análisis, sin cambios. Voy a explorar las áreas más densas del código para dar un diagnóstico fundamentado.
<lov-tool-use id="toolu_vrtx_01Ny7SRh1LZqJvkyVXQirSJE" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && find src -type f \\\\( -name \\\"*.ts\\\" -o -name \\\"*.tsx\\\" \\\\) | xargs wc -l 2>/dev/null | sort -rn | head -40\", \"user_facing_description\": \"Listar archivos más grandes del proyecto\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01X3ybV84pGVdheaKU8bJYQj" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/hooks\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01VN8XLt1vYXv11z8SyZZkpH" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/cotizacion\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KvYAZm7PvcCZSFnVHsg54e" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/embarque\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011k5BbXQMkppGkGdFsU5FAf" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && find src -type f \\\\( -name \\\"*.ts\\\" -o -name \\\"*.tsx\\\" \\\\) -not -path \\\"*/__tests__/*\\\" | xargs wc -l 2>/dev/null | sort -rn | head -40\", \"user_facing_description\": \"Listar archivos más grandes del proyecto\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Mh2xDY2UqJ3e43WnsHM86L" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Po57a2j8G86SDS237nvQQb" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/lib\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JRZHAJ7fyxTQhzi3UBjqMV" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && ls src/hooks | head -80 && echo \\\"---\\\" && ls src/services && echo \\\"---\\\" && ls src/components\", \"user_facing_description\": \"Inventario de hooks/services/components\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TATrg9cDVHitzSSHheuJyW" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && grep -rn \\\"supabase\\\\.\\\" src/pages src/components --include=\\\"*.tsx\\\" -l 2>/dev/null | head -30\", \"user_facing_description\": \"Buscar llamadas directas a supabase desde UI\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Lc4hF7esNRHf9gYeGYmrnJ" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && grep -n \\\"supabase\\\\.\\\" src/pages/Cotizaciones.tsx src/pages/Embarques.tsx src/pages/TrackingPublico.tsx 2>/dev/null | head -30 && echo \\\"---data dir---\\\" && ls src/data && echo \\\"---\\\" && wc -l src/components/cotizacion/*.tsx src/components/embarque/*.tsx 2>/dev/null | sort -rn | head -25\", \"user_facing_description\": \"Inspeccionar acoplamientos y tamaños\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018nbUt6K3Lb9xPvQX2F4JoM" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useEmbarques.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014PkwnAWmHN9Wam2YwuGaAx" name="code--exec" integration-id="code" data="{\"command\": \"cd /dev-server && grep -rln \\\"from '@/integrations/supabase/client'\\\" src/components | head -30 && echo \\\"---services---\\\" && wc -l src/services/*.ts\", \"user_facing_description\": \"Buscar más acoplamiento Supabase en components\"}">
</lov-tool-use>
Tengo suficiente contexto. Presento el plan.

<lov-plan>

# Auditoría de arquitectura — Libre Carga

## Lo bueno (ya está bien)
- Capas claras: `pages/` `components/` `hooks/` `services/` `lib/` `data/` `contexts/` `integrations/`
- Lógica de dominio separada (`lib/domain/`, `lib/mappers/`, `lib/parsers/`)
- Hooks fragmentados por responsabilidad (queries / mutations / state / form)
- Barrel re-exports (`useEmbarques.ts`, `useCotizaciones.ts`)
- Lazy loading + chunks vendor + `select()` explícitos
- Tests unitarios sobre `lib/` y hooks críticos

## Hallazgos por severidad

### 🔴 Crítico — fugas de capa (UI tocando DB)
1. **`src/pages/Cotizaciones.tsx:46`** y **`src/pages/Embarques.tsx:41`** llaman `supabase.from(...)` directo. Toda lectura debe pasar por un hook (`useCotizacion(id)`, `useEmbarque(id)` ya existen).
2. **`src/pages/TrackingPublico.tsx:41`** construye URL de edge function a mano. Debería usar `supabase.functions.invoke('tracking-public', { ... })` o un wrapper en `services/`.

### 🔴 Crítico — archivos monstruo
3. **`src/data/changelogData.ts` (1,909 líneas)**. Es un dataset, no código. Partir por año (`changelog/2024.ts`, `changelog/2025.ts`, `changelog/2026.ts`) e importar dinámicamente solo el año visible. Beneficio: HMR más rápido y bundle Changelog -70%.
4. **`src/components/ui/sidebar.tsx` (637 líneas)** y **`chart.tsx` (303)** son shadcn intactos — ok dejarlos, pero documentarlos como "no editar".

### 🟡 Importante — separación de responsabilidades
5. **`src/services/` infrautilizado** (4 archivos, 255 líneas) mientras `hooks/use*Mutations.ts` contienen SQL inline. Patrón inconsistente: a veces el hook llama a Supabase, a veces a un service. Estándar a definir: **service = acceso a datos puro (sin React Query); hook = React Query + cache + toast**.
6. **`src/data/` mezcla constantes + tipos + dataset enorme**. Recomendación:
   - `src/data/` → solo seeds/datasets (changelog, ports si fuera estático)
   - `src/types/` → todos los `*Types.ts` (`cotizacionFormTypes`, `conceptoTypes`, `types.ts`)
   - `src/constants/` → `cotizacionConstants`, `embarqueConstants`, `proveedorConstants`, `wizardConstants`
7. **Contextos**: solo hay `AuthContext` y `OrganizationContext`. ✅ ok. Pero `OrganizationContext` consume del Auth — verificar que no duplique estado.

### 🟡 Importante — explosión de hooks de cotización
8. Hay **12 hooks `useCotizacion*`** + barrel. Algunos están bien partidos (queries/mutations), pero `useCotizacionDetalleHandlers` + `useCotizacionDetalleState` + `useCotizacionDetalleHandlers` huelen a god-hook partido artificialmente. Auditar si `Detalle*` se puede unificar en uno solo de ~150 líneas o si los handlers deberían vivir como funciones puras en `lib/cotizacion/`.
9. Mismo patrón en **embarque**: 13 hooks `useEmbarque*`. Revisar `useEmbarqueDetalleActions` vs `useEmbarqueEstadoActions` vs `useEmbarqueDocumentosActions` — posible consolidación.

### 🟢 Menor — convenciones
10. **Mezcla idiomática**: nombres de archivos en español (`useNavieras`, `usePuertos`, `Cotizaciones.tsx`) y inglés (`useDebounce`, `useFacturas`). Consistencia: dado que el dominio es es-MX, **dominio en español, utilidades técnicas en inglés** ya es la regla — solo documentarla.
11. **`src/generators/`** (cotizacionPdf, exportCsv) ✅ ubicación correcta. Considerar mover `csfService` allí si solo genera/parsea.
12. **Tests dispersos**: `__tests__/` dentro de cada carpeta. ✅ ok. Falta cobertura en `services/` y `pages/` (actualmente solo `lib/` y `hooks/`).
13. **`useEmbarques.ts` y `useCotizaciones.ts`** son barrels limpios ✅. Asegurar que TODA importación use el barrel, no los módulos internos (grep para validar).

## Plan de remediación ordenado

| # | Acción | Riesgo | Esfuerzo | Impacto |
|---|--------|--------|----------|---------|
| 1 | Mover `supabase.from(...)` de `Cotizaciones.tsx`, `Embarques.tsx`, `TrackingPublico.tsx` a hooks/services existentes | Bajo | XS | Capa limpia |
| 2 | Partir `changelogData.ts` por año + import dinámico | Bajo | S | -70% chunk Changelog, HMR rápido |
| 3 | Definir y documentar contrato **service vs hook** en `README` o `ARCHITECTURE.md` | Nulo | XS | Onboarding |
| 4 | Reorganizar `src/data/` → `src/types/` + `src/constants/` + `src/data/` (solo datasets) | Medio (muchos imports) | M | Claridad estructural |
| 5 | Auditar imports internos vs barrel en `useEmbarque*` / `useCotizacion*` (script grep) y forzar barrel | Bajo | XS | Encapsulación |
| 6 | Consolidar hooks `useCotizacionDetalle*` (3→1 o extraer a `lib/cotizacion/handlers.ts`) | Medio | M | Menos fragmentación |
| 7 | Consolidar hooks `useEmbarque*Actions` (3 archivos → 1 con secciones) | Medio | M | Menos fragmentación |
| 8 | Añadir tests a `services/` (cotizacion, embarque, csf, storage) | Bajo | M | Robustez |
| 9 | Marcar `components/ui/*` shadcn como read-only (comentario header + lint rule opcional) | Nulo | XS | Evitar drift |
| 10 | (Opcional) Renombrar `useNavieras`/`usePuertos` → mantener español; documentar regla en memoria de proyecto | Nulo | XS | Consistencia |

## Recomendación
Empezar por **#1, #2, #3, #5** — todos bajo riesgo y XS/S. Aportan limpieza inmediata sin tocar lógica. Dejar **#4, #6, #7** para una segunda iteración (requieren refactor amplio con tests). **#8** en paralelo cuando se toquen los services.

