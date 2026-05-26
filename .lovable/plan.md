# Auditoría arquitectónica — Libre Carga

Audité los ~960 archivos `.ts/.tsx` bajo `src/`. **El estado general es muy bueno**: cero `any`, cero `console.log`, cero `TODO/FIXME`, sólo 3 archivos rompen el límite Power-of-10 (≤200 líneas), y la jerarquía `Pages → Hooks → Services → Lib` está protegida por ESLint + test (`src/lib/__tests__/architecture.test.ts`). El bundle ya tiene lazy chunks (pdf, sentry, recharts, phone, query-persist).

Aun así, hay **deuda concreta en 3 dominios** (CRM, Auth/Contexts, un par de componentes oversized) y oportunidades de pulido. Abajo el desglose, **sin tocar código**.

---

## 1. Diagnóstico por capa

### 1.1 Capa `services/` — ✅ sana
- Estructura folder-style coherente (`queries`, `mutations`, `subdominios`, barrels).
- 25 subdominios, todos con barrel `index.ts`.
- 18 suites de tests (meta ≥10 cumplida).
- **Gap**: `services/crm/` existe pero está **infrapoblado** (6 archivos) vs. `hooks/crm/` con **40 archivos**, muchos haciendo Supabase directo (ver 1.2).

### 1.2 Capa `hooks/` — ⚠️ violaciones de capa en CRM y dominios menores
**28 hooks importan `@/integrations/supabase/client` directamente** (deberían ir vía `services/`):
- **CRM (mayor ofensor, 17 archivos)**: `useOportunidades`, `useActividades`, `useCliente360`, `useCrmDashboard`, `useEtapasPipeline`, `useForecastReportes`, `useNextBestActions`, `usePlantillasMensaje`, `useComentariosOportunidad`, `useCrmSearch`, `useCrmNotificaciones`, `useProximasActividades`, `useActualizarActividadNotas`, `useAutomatizacionesEtapa`, `automatizacionesEtapaActions`, `leads/{queries,mutations,bulk,convertir,convertirHelpers}`.
- **Otros**: `portal/useNotificacionesCliente`, `auditoria/revisiones/query`, `admin/{useAppLogs, useAppLogsHealth, useAlertasSistema}`, `embarque/{mutations/useUpdateEmbarque, useJsonCargoTracking, useJsonCargoBolLookup}`.
- Impacto: rompe el contrato del `architecture-map.md`, dificulta testear con mocks de `services/`, y bloquea futura migración a otro backend.

### 1.3 Capa `contexts/` — ⚠️ acceso directo a Supabase aceptado pero centralizar
5 archivos en `contexts/` y `contexts/auth/` llaman a `supabase` directamente (`AuthContext`, `OrganizationContext`, `useAuthSession`, `useAuthProfile`, `useLoginAudit`). Es un patrón común en auth, pero conviene moverlo a `services/auth/` (ya existe la carpeta) para mantener la regla "sólo services tocan Supabase".

### 1.4 Capa `components/` — ✅ casi limpia
- **1 sola violación**: `src/components/embarque/TabTracking.tsx` importa `@/integrations/supabase`. Mover lógica a `services/embarque/tracking` (que ya existe).
- 25 instancias de `style={{…}}` inline (bajo, pero auditar si alguno debería ser token Tailwind/semántico).

### 1.5 Capa `pages/` — ✅ limpia
- **Cero** páginas importan Supabase directamente. Excelente.

---

## 2. Archivos sobre límite Power-of-10 (>200 líneas)

| Archivo | Líneas | Acción |
|---|---|---|
| `src/components/ui/sidebar.tsx` | 637 | shadcn base — **exento**, pero documentar excepción. |
| `src/lib/query/index.ts` | 256 | Partir en `queryClient.ts` + `persister.ts` + `keys.ts`. |
| `src/components/crm/ImportarLeadsCsvDialog.tsx` | 201 | Extraer hook `useImportarLeadsCsv` + sub-componente de preview. |

Justo en el borde (180–200) y a vigilar: `BulkImportDialog`, `embarqueWizardSchemas`, `VirtualDataTable`, `HallazgosFiltros`, `Bitacora`, `Oportunidades`, `useToast`, `useClienteDetalleController`, `proformasColumns`, `routes.tsx`.

---

## 3. Acoplamientos y duplicados

- **Nombres duplicados** (no es bug, pero genera fricción en búsquedas): `Configuracion.tsx` aparece en `pages/`, `pages/admin/`, `pages/admin-org/`, `pages/crm/`; `TabFacturacion.tsx` en dos dominios. Considerar prefijo (`AdminConfiguracion`, `CrmConfiguracion`) ya aplicado a algunos — homogeneizar.
- **`hooks/crm/leads/`** tiene 6 archivos (queries, mutations, bulk, convertir, helpers, payload, constants) — la lógica de "convertir lead → cliente/oportunidad" debería vivir en `services/crm/leadsConversiones/`, no en `hooks/`.
- **`routes.tsx`** (188 líneas) acumula todas las rutas. Sigue siendo manejable, pero podría dividirse por dominio (`routes/admin.tsx`, `routes/portal.tsx`, …) con lazy split natural.

---

## 4. Otras observaciones

- ✅ Cero `any`, cero `console.*`, cero `TODO`. Disciplina ejemplar.
- ✅ Cleanup en effects respetado (memoria Core).
- ✅ Bundle splitting agresivo ya implementado.
- ⚠️ Algunos hooks bajo `hooks/crm/` no empiezan con `use…` (`automatizacionesEtapaActions.ts`, `leadEditDirty.ts`, `oportunidadFormHelpers.ts`, `oportunidadPayload.ts`). Si son helpers puros, deben ir a `lib/domain/crm/` para que el nombre no engañe.
- ⚠️ ESLint tiene dos overrides con `"no-restricted-imports": "off"` — revisar que no estén apagando la regla justo en `hooks/crm/` o `contexts/`.

---

## 5. Plan recomendado (de más crítico → opcional)

### Bloque A — Crítico (deuda arquitectónica)
1. **Crear `services/crm/` completo** y migrar las 17 llamadas `supabase.*` de `hooks/crm/*` a ese subdominio (`oportunidades`, `actividades`, `leads`, `pipeline`, `automatizaciones`, `comentarios`, `plantillas`, `notificaciones`, `forecast`, `cliente360`, `search`, `nextBestActions`).
2. **Migrar lógica pura de `hooks/crm/leads/{convertir,convertirHelpers,leadPayload}` y `hooks/crm/oportunidad{FormHelpers,Payload,FormState}`** a `lib/domain/crm/` y dejar sólo el `use*` orquestador en hooks.
3. **Mover `components/embarque/TabTracking.tsx`** a usar `services/embarque/tracking` (eliminar import directo a Supabase).
4. **Centralizar Supabase de `contexts/auth/*` y `OrganizationContext`** en `services/auth/` (sesión, perfil, login audit, org switching).

### Bloque B — Alto (Power-of-10 y barrels)
5. **Romper `src/lib/query/index.ts`** (256 líneas) en `queryClient.ts` + `persister.ts` + `keys.ts` + `gc.ts`.
6. **Refactor `ImportarLeadsCsvDialog.tsx`** (201) → hook `useImportarLeadsCsv` + sub-componentes de preview/errores.
7. **Documentar excepción `components/ui/sidebar.tsx`** en `docs/power10-baseline.md` (es shadcn base).
8. **Verificar y endurecer ESLint**: revisar los dos `no-restricted-imports: "off"` y limitar el override a archivos shadcn/legacy con justificación.

### Bloque C — Medio (consistencia)
9. **Renombrar helpers no-hook** en `hooks/crm/` (`*Actions.ts`, `*Helpers.ts`, `*Payload.ts`) o moverlos a `lib/`.
10. **Auditar 25 `style={{…}}` inline** en `components/` y `pages/` — convertir a clases Tailwind / tokens semánticos cuando aplique.
11. **Homogeneizar prefijos** en archivos duplicados por nombre (`Configuracion.tsx`, `TabFacturacion.tsx`) para mejorar navegación.

### Bloque D — Opcional (calidad de vida)
12. **Dividir `routes.tsx`** en `routes/{admin,portal,crm,public}.tsx` con barrel.
13. **Vigilar archivos 180-200 líneas** (lista arriba) y refactorizar antes de que crucen el umbral.
14. **Agregar test arquitectónico adicional** que falle si `hooks/` o `contexts/` importan `@/integrations/supabase/client` directamente (complemento al test existente).
15. **Generar reporte automático** (script en `scripts/`) que liste violaciones de capa y archivos >200 líneas en CI, para que no se acumule deuda.

---

## Métricas baseline (post-auditoría)

| Métrica | Valor actual | Meta |
|---|---|---|
| Hooks con Supabase directo | 28 | 0 |
| Components con Supabase directo | 1 | 0 |
| Contexts con Supabase directo | 5 | 0 (vía `services/auth`) |
| Archivos >200 líneas (no shadcn) | 2 | 0 |
| `any` en código productivo | 0 | 0 ✅ |
| `console.*` en código productivo | 0 | 0 ✅ |
| Tests de arquitectura | 1 | 2 (añadir guard de hooks) |

Cuando aprobés el plan, lo ejecuto bloque por bloque (recomiendo empezar por A1 + A3, que son los de mayor ROI), con bump de `APP_VERSION` y entrada en `CHANGELOG.md` por bloque.
