## Objetivo

Impedir que se vuelva a importar `@/components/ui/table` fuera de la allowlist, obligando a usar `<DataTable />` y los builders (`columnBuilders`, `defineColumns`, `StatusBadge`).

## Diagnóstico

- `eslint.config.js` **ya** tiene un `no-restricted-imports` sobre `@/components/ui/table` (líneas 71-77), **pero queda anulado** por el override de la línea 168-172 que apaga `no-restricted-imports` completo para `src/hooks/**`, `src/services/**` y **`src/features/**`** — donde vive el 95% de las tablas.
- La allowlist explícita (línea 260-288) apunta a rutas viejas (`src/components/cotizacion/...`, `src/pages/bandejas/...`) que ya no existen tras las Fases 1-5. Los archivos legítimos hoy viven en `src/features/…`.
- Resultado: la regla nunca dispara. Correr `eslint` sobre `TablaCostosDetalle.tsx` no reporta nada.

## Cambios

### 1. `eslint.config.js` — regla dedicada `no-raw-table`

Extraer la restricción de `@/components/ui/table` a un **bloque propio** al final del archivo, con su propio `files: ["**/*.{ts,tsx}"]` y su propio `ignores` (allowlist). Así queda inmune al override que apaga `no-restricted-imports` en `features/**`.

```text
{
  name: "no-raw-table",
  files: ["src/**/*.{ts,tsx}"],
  ignores: [ …allowlist actualizada… ],
  rules: {
    "no-restricted-imports": ["error", { paths: [{
      name: "@/components/ui/table",
      message: "Usa <DataTable /> de '@/components/shared/DataTable' + columnBuilders. Excepciones: agrega el archivo a la allowlist en eslint.config.js y documenta el motivo."
    }]}]
  }
}
```

Quitar el `paths:` del bloque global (líneas 71-77) para evitar duplicación.

### 2. Allowlist actualizada (rutas reales post Fase 5)

```text
src/components/shared/DataTable.tsx
src/components/shared/dataTable/**
src/features/cotizacion/components/SeccionMercanciaAerea.tsx
src/features/cotizacion/components/SeccionMercanciaMaritimaLCL.tsx
src/features/cotizacion/components/TablaConceptosGenerico.tsx
src/features/cotizacion/components/TablaCostosDetalle.tsx
src/features/cotizacion/components/seccionMercancia/DimensionesLCLTable.tsx
src/features/cotizacion/components/seccionMercancia/DimensionesAereasTable.tsx
src/features/facturacion/components/detalle/FacturaConceptosTable.tsx
src/features/portal/components/factura/PortalFacturaConceptosTable.tsx
src/features/embarques/components/tabResumen/EmbarquesRelacionadosCard.tsx
src/features/embarques/components/pnl/PnlProveedoresTable.tsx
src/features/embarques/components/pnl/PnlComparativaTable.tsx
src/features/costeo/components/DemorasTarifaEditor.tsx
src/features/configuracion/components/CatalogoClavesSATCard.tsx
src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx
```

Cada entrada lleva un comentario `//` explicando por qué no migra (form-table editable, sub-tabla read-only estática, catálogo con toggles, etc.).

### 3. Test de arquitectura de respaldo

Nuevo archivo `src/__tests__/architecture/no-raw-table.test.ts`:

- Walkea `src/` con `scripts/lib/walk.ts`.
- Colecta todos los archivos que hacen `from "@/components/ui/table"`.
- Falla si el set difiere de una allowlist constante en el propio test (misma lista que ESLint).

Sirve como red de respaldo si alguien edita `eslint.config.js` para relajar la regla sin actualizar la lista.

### 4. Documentación

- `CONTRIBUTING.md`: sección corta "Tablas — regla del design system" apuntando a `DataTable` + `columnBuilders` y explicando cómo pedir excepción.
- `mem://principles/no-raw-table` (nueva memoria tipo `constraint`): "Prohibido importar `@/components/ui/table` fuera de la allowlist. Usar `DataTable` + `defineColumns` + builders. **Why:** unificar design language."
- Actualizar `mem://index.md` (sección Core, one-liner).

### 5. Verificación

1. `bunx eslint src/features/cotizacion/routes/Cotizaciones.tsx` (no debe fallar — no usa Table crudo).
2. Simular violación: `bunx eslint` sobre un archivo temporal con `import { Table } from "@/components/ui/table"` fuera de la allowlist → debe fallar con el mensaje.
3. `bunx vitest run src/__tests__/architecture/no-raw-table.test.ts` → pasa.
4. `bun run lint` completo sin warnings.

### 6. Changelog + versión

- `src/constants/appVersion.ts` → `13.172.19`.
- `CHANGELOG.md` → entrada `## [13.172.19] - 2026-07-05` con bullet "Guardrail ESLint + test de arquitectura para prohibir `@/components/ui/table` fuera de la allowlist del design system."

## Fuera de alcance

- No se migra ninguna tabla adicional. La allowlist congela el estado actual; cualquier migración futura se hace en otro plan.
- No se toca el override de `features/**` en el bloque genérico de `no-restricted-imports` (afecta barrels de hooks/services, distinto propósito).
