# Plan: Refactor arquitectónico integral

Basado en la auditoría previa. 13 hallazgos agrupados en 3 fases ejecutables. Cada fase termina con tests verdes (201/201) y entrada en changelog.

---

## Fase 1 — Críticos (alto impacto, riesgo bajo)

### Paso 1 · Lazy-load del Changelog
- Convertir `Changelog.tsx` a `React.lazy` en `App.tsx`.
- Cambiar `src/data/changelogData.ts` para hacer dynamic `import()` de cada `changelog/v*.ts` sólo cuando la página los pida.
- **Resultado**: ~700 LOC fuera del bundle inicial.

### Paso 2 · Documentar excepciones de capa
- Añadir sección "Excepciones autorizadas" en `ARCHITECTURE.md`:
  - Mappers en `lib/mappers/` pueden importar `type Tables` de Supabase (es su razón de ser).
  - `import type` desde Supabase no cuenta como violación de capa.
- Aclarar que `data/` es para datasets de dominio; el contenido editorial (changelog) vive en `src/content/`.

### Paso 3 · Extraer controllers de pages densas
Crear hooks-controller siguiendo el patrón ya usado en `useTabProformasController`:
- `src/hooks/reportes/useReportesPageController.ts` ← absorbe los 9 hooks de `Reportes.tsx`.
- `src/hooks/cliente/useClienteDetalleController.ts` ← absorbe los 6 hooks de `ClienteDetalle.tsx`.
- Aplicar `useListPageState` en `Clientes.tsx` y `Proveedores.tsx` (ya existe el hook, falta consumirlo).

**Cierre Fase 1**: changelog v8.85.0, tests verdes.

---

## Fase 2 — Importantes (consistencia)

### Paso 4 · Estandarizar barrels
Convención única: **barrel-folder** con `index.ts`, naming en plural consistente.
- Renombrar:
  - `services/clienteService.ts` → `services/cliente/index.ts`
  - `services/embarqueServices.ts` → `services/embarque/index.ts`
  - `services/adminServices.ts` → `services/admin/index.ts`
  - `services/proformaServices.ts` → `services/proforma/index.ts`
  - `services/cotizacionServices.ts` → `services/cotizacion/index.ts`
- Actualizar imports en todo `src/` (aliases `@/services/cliente`, etc., siguen funcionando).

### Paso 5 · Reorganizar contenido editorial
- Mover `src/data/changelog/` y `src/data/changelogData.ts` a `src/content/changelog/`.
- Dejar en `src/data/`: sólo `ports.ts` (dataset de dominio).
- Actualizar imports.

### Paso 6 · Split de `AuthContext`
Dividir `src/contexts/AuthContext.tsx` (212 LOC) en:
- `useAuthSession` — sesión Supabase (login/logout/listener).
- `useAuthProfile` — perfil + roles efectivos.
- `AuthContext` queda como compositor delgado (~60 LOC).

### Paso 7 · Auditoría de `useEffect`
Pase de revisión sobre los 29 `useEffect` activos. Para cada uno:
- ¿Puede ser `useQuery` con `enabled`? → migrar.
- ¿Puede ser `useMemo` derivado? → reemplazar.
- ¿Tiene deps incorrectas? → corregir.
- Documentar los que deben quedarse como están.

**Cierre Fase 2**: changelog v8.86.0, tests verdes.

---

## Fase 3 — Opcionales (refinamiento)

### Paso 8 · Lazy-load generadores PDF
- En los callsites de "Descargar PDF", reemplazar import estático por `const { generar } = await import('@/generators/cotizacionPdf')`.
- Mismo tratamiento para `proformaPdf.ts`.
- **Resultado**: jsPDF fuera del bundle inicial (~200KB+).

### Paso 9 · Consolidar tipos sueltos
- Mover `src/components/cotizacion/costosPLTypes.ts` a `src/types/cotizacionPL.ts` (consolidar con el existente).

### Paso 10 · Marcar `use-toast.ts` como read-only shadcn
- Añadir comentario de cabecera `// shadcn read-only — no editar` en `src/hooks/use-toast.ts`, alineado con la regla #3 de ARCHITECTURE.md.

**Cierre Fase 3**: changelog v8.87.0, tests verdes.

---

## Detalles técnicos

### Patrón de extracción de controller (Paso 3)
```ts
// src/hooks/reportes/useReportesPageController.ts
export function useReportesPageController() {
  const filtros = useReportesFiltros();
  const kpis = useReportesKpis(filtros.value);
  const tabla = useReportesTabla(filtros.value);
  // ... resto de hooks
  return { filtros, kpis, tabla, /* handlers */ };
}

// src/pages/Reportes.tsx queda como composición pura de UI
const { filtros, kpis, tabla } = useReportesPageController();
```

### Patrón lazy-load PDF (Paso 8)
```ts
const handleDescargar = async () => {
  const { generarCotizacionPdf } = await import("@/generators/cotizacionPdf");
  await generarCotizacionPdf(cotizacion);
};
```

### Patrón split AuthContext (Paso 6)
```ts
// useAuthSession.ts → session, signIn, signOut
// useAuthProfile.ts → profile, roles, organization
// AuthContext.tsx → const session = useAuthSession(); const profile = useAuthProfile(session);
```

---

## Criterios de éxito

- 201/201 tests verdes al cierre de cada fase.
- Build TypeScript limpio.
- Bundle inicial reducido (Paso 1 + 8).
- Pages densas reducidas a < 100 LOC con composición pura.
- Una sola convención de barrels en todo `src/services/`.
- ARCHITECTURE.md actualizado con excepciones documentadas.

## Fuera de alcance

- Mejoras de performance ya planificadas (índices DB, memoización, `staleTime`) — viven en su propio plan.
- Migración de `ports.ts` restante a BD (ya parcial según memoria).
- Reescritura de `components/ui/` (read-only shadcn).

---

## Ejecución sugerida

¿Ejecuto **Fase 1 completa** (Pasos 1-3) en una sola iteración, luego confirmo antes de seguir? Es el bloque de mayor valor con menor riesgo.
