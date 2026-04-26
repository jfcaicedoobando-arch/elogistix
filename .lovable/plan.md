# Mejorar ARCHITECTURE.md (v8.88.0)

Reescribir `ARCHITECTURE.md` aplicando los 3 bloques propuestos: estructura/navegación, reglas faltantes y pulido. El archivo pasa de 125 a ~250 líneas, sigue formato Markdown plano sin emojis.

## Cambios concretos

### Bloque 1 — Estructura
- Añadir cabecera con versión y fecha (`Última revisión: v8.88.0 — 2026-04-26`) y referencia espejo a `mem://technical/architecture-and-standards`.
- Insertar **tabla de contenidos** con 14 secciones numeradas.
- Renombrar "Capas" → **"Estructura de carpetas"**; añadir `content/` como carpeta separada de `data/`.
- Nueva sección **"Flujo de datos canónico"** con diagrama ASCII Page → Hook → Service → Supabase → Mapper → Component.
- Mover la nota sobre barrels de hooks de dominio (línea 29) a una sección numerada propia.

### Bloque 2 — Reglas que faltan
- **§7 Naming**: consolida regla #4 + patrones es/en + convenciones para hooks, controllers, tipos, componentes, services y archivos de tipos.
- **§8 React Query**: query keys centralizados en `lib/queryKeys.ts`, `staleTime` por tipo (catálogos 5min, operativos 30s, reportes 1min), invalidación desde el hook que escribe, selección explícita de columnas, paginación server-side.
- **§9 Performance / Lazy-loading**: páginas lazy en router, dynamic import para generadores PDF (jsPDF), patrón changelog para datasets grandes, recuperación de chunks, regla >50KB, criterio de memoización.
- **§10 RLS y multi-tenant**: `organization_id` obligatorio, roles en `user_roles` (nunca `profiles`), `security definer`, edge functions con service-role, patrón portal cliente.
- **§11 Testing**: Vitest + Testing Library (201 tests), qué se testea (`lib/`, services puros, hooks complejos), qué NO (shadcn, pages, mappers triviales), ubicación `__tests__/` colocalizada, comandos.
- **§3.5 Controllers de página**: pages densas (>5 hooks) extraen lógica a `use<Page>PageController`, patrón canónico desde v8.85.0.

### Bloque 3 — Pulido
- Consolidar "Excepciones autorizadas" + "Convención de barrels" + "Auditoría de useEffect" + decisiones nuevas (lazy-load PDF, tipos en `src/types/`) bajo **§12 "Decisiones explícitas (con fecha)"** — una sola zona histórica.
- Renombrar "Deuda técnica aceptada" → **§13 "Decisiones de no hacer"** (comunica intencionalidad). Añade entrada de `costosPLTypes.ts`.
- Corregir referencia obsoleta en §6 (transacciones RPC): `services/<dominio>Services.ts` → `services/<dominio>/index.ts` (alineado a convención v8.86.0).
- **§14 Glosario**: 12 términos del proyecto (embarque, expediente, cotización, proforma, concepto, P&L, CSF, incoterm, organización, cliente, operador, portal de clientes).

## Detalles técnicos

- Formato: Markdown plano, sin frontmatter, sin emojis. Diagramas ASCII en bloques ` ```text `.
- Sólo se modifica `ARCHITECTURE.md`. No hay cambios de código fuente.
- Tras la edición:
  - Actualizar entrada en `src/content/changelogData.ts` con versión 8.88.0, tipo `patch`, describiendo la reorganización del documento.
  - Verificar build (`bunx tsc --noEmit`) y tests (`bunx vitest run`) — esperado verde y 201/201 ya que es solo doc + changelog.

## Resultado esperado

`ARCHITECTURE.md` queda con TOC navegable, secciones que cubren los gaps reales (testing, performance, RLS, naming, React Query), y una sola zona histórica con fechas en lugar de 4 bloques sueltos.
