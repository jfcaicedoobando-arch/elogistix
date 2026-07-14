# Auditoría del Lote 1+3+5 + arranque de Lote 2

## Qué se hizo el turno pasado (recordatorio)

`v13.300.0` unificó KPI Cards (`AuditoriaKpis`, `GarantiasKpiCards`), homogeneizó tipografía en KpiCards locales de P&L/CxP, migró 6 usos de `text-green-600`/`text-red-600` a tokens semánticos y alineó grids KPI a `gap-4`.

**Cobertura de tests actual**: el `KpiCard` canónico ya tiene 5 tests que cubren `variant`, `delta`, `onClick` y `sublabel` (`src/components/shared/__tests__/KpiCard.test.tsx`). Los consumidores migrados (`AuditoriaKpis`, `GarantiasKpiCards`) no tienen tests — riesgo bajo (son wrappers presentacionales), pero conviene un smoke test para blindarlos ante refactors.

**Riesgo real detectado**: no hay guardrail que impida regresiones de color literal. Un futuro cambio podría volver a introducir `text-red-600` sin que CI se queje. El plan lo lista en el "Contrato de tokens" pero no hay red de respaldo.

---

## Fase A — Auditoría + tests (este turno, ~10 archivos)

### A1. Smoke tests para consumidores migrados

- `src/features/auditoria/components/__tests__/AuditoriaKpis.test.tsx` — renderiza los 3 KPIs (Críticos/Altos/Medios), verifica que usa las variantes `destructive`/`warning`/`info` (buscando las clases `border-destructive/30`, `border-warning/30`, `border-info/30` que emite `KpiCard`) y que los sublabels se muestran.
- `src/features/embarques/components/garantias/__tests__/GarantiasKpiCards.test.tsx` — renderiza los 4 KPIs, formatea moneda en USD y muestra "—" cuando `diasPromRecuperacion === null`.

Ambos tests son de <30 líneas cada uno, siguiendo el patrón de `KpiCard.test.tsx`.

### A2. Guardrail de arquitectura: prohibir literales de color legacy

Nuevo test `src/__tests__/architecture/no-legacy-color-literals.test.ts` que camina `src/**` (excluyendo `__tests__`, `.test.*`, `test/`, `constants/tailwind*` si existe) y falla si aparece cualquiera de:

```
text-(green|red|yellow|orange|blue|slate|gray|zinc)-(500|600|700|800|900)
bg-(green|red|yellow|orange)-(50|100|200|300)
```

Salvo en una **ALLOWLIST** documentada con comentarios (por ejemplo: `CobranzaBlock` que aún usa la escalera aging pendiente de tokenizar en Lote 3B, y `estadoConfig.ts` pendiente de migrar). Sigue el patrón exacto de `no-raw-table.test.ts` (uso de `walk`, `relPath`, comentario "cómo pedir excepción").

**Por qué**: es la única salvaguarda real contra que la cohesión visual se degrade turno a turno. Coste: 1 archivo, ~50 líneas.

### A3. Ejecutar `vitest run` de los 3 tests nuevos para confirmar verde.

---

## Fase B — Lote 2A: Tipografía canónica (mismo turno si A pasa limpio)

El Lote 2 completo del plan original toca 25+ archivos. Lo parto en **2A (quirúrgico, 3 archivos)** ahora y **2B (limpieza masiva de overrides en `CardTitle`)** para un turno futuro, porque 2B necesita revisión visual página por página.

### B1. Migrar `<h1>` de página a `text-display` (C3)

- `src/components/shared/DetailHeader.tsx:63` — cambiar `text-2xl font-bold` → `text-display font-bold`.
- `src/features/cotizacion/components/wizard/WizardShell.tsx:120` — mismo cambio.

Ambos ya tienen tests (`DetailHeader.test.tsx`, `WizardShell.test.tsx`). Revisar si algún test snapshotea la clase `text-2xl`; si sí, actualizar el aserto.

### B2. Limpiar comentario desactualizado (L3)

- `src/components/shared/PageHeader.tsx:25` — comentario menciona `text-2xl` pero el código real usa `text-display`. Actualizar el comentario.

### B3. Bump de versión + changelog

- `APP_VERSION` → `13.300.1` (patch: solo tipografía + tests, sin cambios funcionales).
- Entrada en `CHANGELOG.md` (root) explicando: 3 tests nuevos (2 smoke + 1 guardrail), migración de 2 `<h1>` a `text-display`, comentario corregido.

---

## Fase C — Verificación final

- `vitest run` del suite completo debe pasar (>= mismo umbral que antes; nunca bajar coverage según `mem://principles/coverage-threshold`).
- Confirmar visualmente en `/clientes/:id` (`DetailHeader`) y `/cotizaciones/nueva` (`WizardShell`) que el `<h1>` sigue siendo legible a 1920×1080 con `text-display`.

---

## Fuera de alcance (siguientes turnos)

- **Lote 2B**: barrido de `CardTitle` con overrides `text-lg`/`text-base`/`text-sm` en 25+ archivos — requiere pase visual módulo por módulo.
- **Lote 4**: 10 tablas HTML nativas → shadcn.
- **Lote 6**: `DemoAccessDialog` → `FormDialogShell`, chips con `Button variant="ghost"`.

Estos quedan documentados en `.lovable/plan.md` sin cambios.

---

## Sección técnica

**Archivos a crear**:
```text
src/features/auditoria/components/__tests__/AuditoriaKpis.test.tsx
src/features/embarques/components/garantias/__tests__/GarantiasKpiCards.test.tsx
src/__tests__/architecture/no-legacy-color-literals.test.ts
```

**Archivos a editar**:
```text
src/components/shared/DetailHeader.tsx           (línea 63)
src/features/cotizacion/components/wizard/WizardShell.tsx  (línea 120)
src/components/shared/PageHeader.tsx             (línea 25 — comentario)
src/constants/appVersion.ts                      (13.300.0 → 13.300.1)
CHANGELOG.md                                     (nueva entrada)
```

**Riesgos**:
- El guardrail A2 puede fallar de entrada si detecta literales aún no tokenizados (`CobranzaBlock`, `estadoConfig`, mapeos de aging). Mitigación: usar la ALLOWLIST desde el arranque para no bloquear CI. Cualquier literal fuera de la lista fuerza al autor a agregarlo explícitamente, lo que documenta la deuda.
- El cambio de `text-2xl` → `text-display` en `DetailHeader`/`WizardShell` puede cambiar visualmente la escala del título. `text-display` es un token fluido; revisar en `index.css` que la escala en desktop sea comparable (~28-32px) para evitar sorpresas.
