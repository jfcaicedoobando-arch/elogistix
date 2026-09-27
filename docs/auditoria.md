# Módulo Auditoría — Arquitectura y flujo de datos

> Revisión documental: 2026-09-26. Acompaña a `ARCHITECTURE.md`.
> Describe componentes/servicios versionados, no una nueva auditoría de Live.

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
features/auditoria/services/           ← I/O puro (fetchReporteAuditoria, fetchAuditoriaRevisiones, …)
        │
        ▼
features/auditoria/hooks/              ← React Query + derivaciones de dominio
        │
        ▼
features/auditoria/components/         ← UI presentacional (tarjetas, tablas, dialogs)
        │
        ▼
features/auditoria/routes/AuditoriaPage.tsx            ← Composición de la ruta /auditoria
```

Reglas (heredadas de `ARCHITECTURE.md`):

- **Pages** sólo componen tabs y pasan datos. No tocan Supabase.
- **Hooks** son la única capa autorizada a llamar `services/*` y a usar
  `@tanstack/react-query`.
- **Presentacionales** reciben props. Contenedores del feature coordinan hooks;
  no importan Supabase ni hacen I/O directo en la UI.
- **Services** sólo hacen I/O y mapeos triviales. Ningún cálculo de negocio.

---

## 2. Hooks del dominio

Todos viven en `src/features/auditoria/hooks/` y se exportan vía el barrel
`features/auditoria/hooks/index.ts`.

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

`AuditoriaEjecutivoTab.tsx` es un compositor de tarjetas; no mantener conteos
de líneas o versiones antiguas como contrato. La lógica visual está en
`src/features/auditoria/components/ejecutivo/`.

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

`src/features/auditoria/constants/auditoriaConfig.ts` es la **fuente única** para:

- `REGLA_INFO[regla]` → `{ shortLabel, label, description, icon }`.
- `REGLAS_ORDEN` → orden canónico de presentación (mayor severidad operativa
  primero).
- Helpers `reglaShortLabel()` / `reglaLabel()`.

Tanto `features/auditoria/routes/AuditoriaPage.tsx` (vista detalle) como `EjecutivoPorReglaGrid`
(vista ejecutiva) consumen este módulo. **No duplicar** labels o iconos en
componentes nuevos: extender este archivo.

---

## 5. Flujo de datos end-to-end

```text
1. Usuario abre /auditoria
   └── features/auditoria/routes/AuditoriaPage.tsx monta el controlador
       └── useAuditoriaPageController() → tab activo, filtros

2. Tab "Ejecutivo"
   ├── useAuditoria() ──► features/auditoria/services/fetchReporteAuditoria()
   │                       └── RPC reporte_auditoria()  (Supabase)
   ├── useAuditoriaRevisiones() ──► fetchAuditoriaRevisiones()
   └── useAuditoriaEjecutivo()  ──► useMemo: score, distribuciones, MTTR…
       └── <AuditoriaEjecutivoTab data={...} onDrillDown={...} />
           └── tarjetas en features/auditoria/components/ejecutivo/*

3. Drill-down (clic en KPI/barra)
   └── onDrillDown({ severidad | etapa | cliente | soloVencidos })
       └── features/auditoria/routes/AuditoriaPage.tsx cambia tab y aplica filtro
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
  (la configuración de reglas del feature) y, si tiene impacto financiero, agregarla a
  `REGLAS_FINANCIERAS` en `useAuditoriaEjecutivo`.
- **Nuevo KPI ejecutivo**: derivar el valor en `useAuditoriaEjecutivo`
  (no en el componente), exponerlo en `AuditoriaEjecutivoData` y consumirlo
  en una tarjeta nueva en `features/auditoria/components/ejecutivo/`.
- **Nueva acción de drill-down**: ampliar el tipo `filtro` del prop
  `onDrillDown` en `AuditoriaEjecutivoTab` y manejarlo en `features/auditoria/routes/AuditoriaPage.tsx`.
- **Cambios visuales del score**: editar `scoreEstadoConfig.ts`. No tocar
  `EjecutivoScoreCard` salvo para layout.
- **Tests de derivaciones**: van en
  `src/lib/domain/__tests__/` o, si son del hook, junto al hook con `vitest`.
  Evitar testear React Query directamente; testear las funciones puras que
  el hook compone.

---

## 7. Dependencias legacy

La RPC `auditoria_embarques_org` (y por extensión todo el motor de hallazgos
operativos) sigue leyendo columnas **legacy** de `public.embarques`:

- `contenedor` (número del primer contenedor),
- `tipo_contenedor`,
- `peso_kg`, `volumen_m3`, `piezas`.

Desde la Fase A multi-contenedor (v12.13+) estas columnas se mantienen
sincronizadas automáticamente vía triggers desde `embarque_contenedores`
(ver `docs/embarques-contenedores.md`). Mientras el trigger esté activo,
la auditoría sigue funcionando sin cambios.

**Riesgo a futuro**: si en algún momento se eliminan estas columnas (o se
apaga el trigger de sync), los hallazgos relacionados con peso / volumen /
contenedor / tipo dejarán de detectar correctamente. Antes de retirarlos hay
que migrar la RPC para leer directamente de `embarque_contenedores`
(agregando por `embarque_id`).

Verificar consumidores y RPC efectiva antes de retirar columnas; esta
limpieza no cambia el modelo ni declara esa migración necesaria.

---

## 8. Archivos clave (referencia rápida)

| Capa | Archivo |
|------|---------|
| Tipos | `src/features/auditoria/types/index.ts` |
| Services | `src/features/auditoria/services/` |
| Hooks | `src/features/auditoria/hooks/` (barrel en `index.ts`) |
| Config visual de reglas | `src/features/auditoria/constants/auditoriaConfig.ts` |
| Compositor ejecutivo | `src/features/auditoria/components/AuditoriaEjecutivoTab.tsx` |
| Tarjetas ejecutivas | `src/features/auditoria/components/ejecutivo/` |
| Tabla operativa | `src/features/auditoria/components/HallazgosTablaPaginada.tsx` |
| Página | `src/features/auditoria/routes/AuditoriaPage.tsx` |
