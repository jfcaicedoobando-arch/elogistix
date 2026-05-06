# Módulo Auditoría — Arquitectura y flujo de datos

> Última revisión: **v8.118.4** (Sprint 3 del refactor arquitectónico).
> Acompaña a `ARCHITECTURE.md` y a `mem://features/seguridad-y-roles`.

Este documento describe **cómo se compone la página de Auditoría**, qué hace
cada hook/helper y cómo viajan los datos desde la base hasta la UI. El objetivo
es que cualquier persona del equipo pueda ubicar un cambio sin tener que leer
todo el módulo.

---

## 1. Mapa de capas

```text
Supabase (RPC + tablas)
        │
        ▼
services/auditoria/*           ← I/O puro (fetchReporteAuditoria, fetchAuditoriaRevisiones, …)
        │
        ▼
hooks/auditoria/*              ← React Query + derivaciones de dominio
        │
        ▼
components/auditoria/*         ← UI presentacional (tarjetas, tablas, dialogs)
        │
        ▼
pages/Auditoria.tsx            ← Composición de la ruta /auditoria
```

Reglas (heredadas de `ARCHITECTURE.md`):

- **Pages** sólo componen tabs y pasan datos. No tocan Supabase.
- **Hooks** son la única capa autorizada a llamar `services/*` y a usar
  `@tanstack/react-query`.
- **Components** reciben datos por props. No conocen React Query ni Supabase.
- **Services** sólo hacen I/O y mapeos triviales. Ningún cálculo de negocio.

---

## 2. Hooks del dominio

Todos viven en `src/hooks/auditoria/` y se exportan vía el barrel
`hooks/auditoria/index.ts`.

| Hook | Responsabilidad | Cache / notas |
|------|-----------------|---------------|
| `useAuditoria()` | Reporte completo de hallazgos (`fetchReporteAuditoria`). | `staleTime` 5 min. Compartido con el badge del sidebar. |
| `useAuditoriaCount()` | Total de hallazgos **pendientes** para el badge. Reusa el cache de `useAuditoria` + `useAuditoriaRevisiones`. | Sin round-trip extra si la página ya cargó. |
| `useAuditoriaRevisiones()` | Map `embarque_id|regla|detalle_hash → AuditoriaRevision`. | `staleTime` 60 s. |
| `useAuditoriaEjecutivo()` | **Derivaciones** para la vista ejecutiva (score, distribuciones, riesgo financiero MXN, ranking de operadores, MTTR). | Puro `useMemo` sobre los hooks anteriores. |
| `useAuditoriaPageController()` | Estado de la página: tab activo, filtros del drill-down, paginación. | UI-only. |
| `useAuditoriaSnapshots()` / `useAutoCapturarSnapshot()` | Snapshots diarios (gráfica de tendencia). Captura idempotente al cargar. | UNIQUE `org+fecha` en BD. |
| `useHallazgosTablaState()` | Estado de la tabla operativa (filtros + selección). | UI-only. |
| `useOrgMembersAsignables()` | Catálogo de operadores asignables. | `staleTime` largo. |
| `useSnoozeHallazgo()` | Mutación: posponer hallazgo. | Invalida `useAuditoriaRevisiones`. |
| `useAuditoriaComentarios(revisionId)` | Comentarios de una revisión. | Por revisión. |

---

## 3. Vista ejecutiva — desglose de componentes

Antes vivía todo en `AuditoriaEjecutivoTab.tsx` (~420 líneas). Hoy ese archivo
es un **compositor delgado** (~95 líneas). La lógica visual está en
`src/components/auditoria/ejecutivo/`.

```text
AuditoriaEjecutivoTab (compositor)
├── EjecutivoScoreCard            ← Score 0-100 + KPIs por severidad (Críticos/Altos/Medios)
├── EjecutivoAtencionCard         ← % atendidos + edad promedio de pendientes
├── EjecutivoAlertasUrgencia      ← Banners: vencidos por ETA / urgentes ≤3 días
├── AuditoriaRiesgoFinancieroCard ← Suma MXN de reglas financieras (compartida)
├── AuditoriaTendenciaChart       ← Serie temporal (snapshots diarios)
├── AuditoriaOperadoresCard       ← MTTR + ranking de operadores
├── EjecutivoDistribucionRow      ← Barras: por etapa + top clientes
└── EjecutivoPorReglaGrid         ← Grid con frecuencia por regla
```

### Helpers compartidos

`ejecutivo/_helpers.tsx`

- **`DrillKpi`** — KPI clickeable (button) o estático (div). Usado por
  `EjecutivoScoreCard` para los conteos por severidad. Si recibe `onClick`
  funciona como botón de drill-down; si no, es display puro.
- **`DistribucionBarras`** — Componente de barras con dos capas (total +
  destacado, p. ej. críticos). Cada item puede ser clickeable. Usado por
  `EjecutivoDistribucionRow`.
- **`EmptyMsg`** — Mensaje de estado vacío estandarizado.

`ejecutivo/scoreEstadoConfig.ts`

- Mapa `ScoreEstado → { label, text, msg }`. Define el copy y los tokens de
  color por nivel de salud (`excelente | bueno | regular | malo`). Cualquier
  ajuste de wording o color del score se hace **aquí**, no en el card.

### Drill-down

`AuditoriaEjecutivoTab` recibe `onDrillDown(filtro)` desde la página y lo
propaga a las tarjetas. Cada tarjeta sólo decide *qué filtro* emitir
(severidad, etapa, cliente, soloVencidos). La página resuelve el cambio de
tab y la aplicación del filtro en la tabla operativa.

---

## 4. Configuración compartida de reglas

`src/lib/ui/auditoriaConfig.ts` es la **fuente única** para:

- `REGLA_INFO[regla]` → `{ shortLabel, label, description, icon }`.
- `REGLAS_ORDEN` → orden canónico de presentación (mayor severidad operativa
  primero).
- Helpers `reglaShortLabel()` / `reglaLabel()`.

Tanto `pages/Auditoria.tsx` (vista detalle) como `EjecutivoPorReglaGrid`
(vista ejecutiva) consumen este módulo. **No duplicar** labels o iconos en
componentes nuevos: extender este archivo.

---

## 5. Flujo de datos end-to-end

```text
1. Usuario abre /auditoria
   └── pages/Auditoria.tsx monta el controlador
       └── useAuditoriaPageController() → tab activo, filtros

2. Tab "Ejecutivo"
   ├── useAuditoria() ──► services/auditoria/fetchReporteAuditoria()
   │                       └── RPC reporte_auditoria()  (Supabase)
   ├── useAuditoriaRevisiones() ──► fetchAuditoriaRevisiones()
   └── useAuditoriaEjecutivo()  ──► useMemo: score, distribuciones, MTTR…
       └── <AuditoriaEjecutivoTab data={...} onDrillDown={...} />
           └── tarjetas en components/auditoria/ejecutivo/*

3. Drill-down (clic en KPI/barra)
   └── onDrillDown({ severidad | etapa | cliente | soloVencidos })
       └── pages/Auditoria.tsx cambia tab y aplica filtro
           └── HallazgosTablaPaginada lee el filtro vía useHallazgosTablaState()

4. Acciones (revisar, asignar, snooze, comentar)
   └── Hooks de mutación invalidan los queryKeys del módulo
       (["auditoria","embarques"] y AUDITORIA_REVISIONES_KEY)
       → la vista ejecutiva se recalcula automáticamente.
```

---

## 6. Convenciones para nuevas extensiones

- **Nueva regla de auditoría**: añadirla al enum `ReglaAuditoria`
  (`types/auditoria.ts`), registrarla en `REGLA_INFO` + `REGLAS_ORDEN`
  (`lib/ui/auditoriaConfig.ts`) y, si tiene impacto financiero, agregarla a
  `REGLAS_FINANCIERAS` en `useAuditoriaEjecutivo`.
- **Nuevo KPI ejecutivo**: derivar el valor en `useAuditoriaEjecutivo`
  (no en el componente), exponerlo en `AuditoriaEjecutivoData` y consumirlo
  en una tarjeta nueva en `components/auditoria/ejecutivo/`.
- **Nueva acción de drill-down**: ampliar el tipo `filtro` del prop
  `onDrillDown` en `AuditoriaEjecutivoTab` y manejarlo en `pages/Auditoria.tsx`.
- **Cambios visuales del score**: editar `scoreEstadoConfig.ts`. No tocar
  `EjecutivoScoreCard` salvo para layout.
- **Tests de derivaciones**: van en
  `src/lib/domain/__tests__/` o, si son del hook, junto al hook con `vitest`.
  Evitar testear React Query directamente; testear las funciones puras que
  el hook compone.

---

## 7. Archivos clave (referencia rápida)

| Capa | Archivo |
|------|---------|
| Tipos | `src/types/auditoria.ts` |
| Services | `src/services/auditoria/` |
| Hooks | `src/hooks/auditoria/` (barrel en `index.ts`) |
| Config visual de reglas | `src/lib/ui/auditoriaConfig.ts` |
| Compositor ejecutivo | `src/components/auditoria/AuditoriaEjecutivoTab.tsx` |
| Tarjetas ejecutivas | `src/components/auditoria/ejecutivo/` |
| Tabla operativa | `src/components/auditoria/HallazgosTablaPaginada.tsx` |
| Página | `src/pages/Auditoria.tsx` |
