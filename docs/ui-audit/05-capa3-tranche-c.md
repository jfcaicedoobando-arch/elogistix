# Capa 3 · Tranche C — Directorios (Clientes / Proveedores / Agentes)

Viewport: **1920×1080**  ·  Capturas: `docs/ui-audit/screenshots/{clientes,proveedores,costeo-agentes}.png`

> Alcance: los tres directorios "tabulares" de la app. `/agentes` no existe como CRM; el equivalente auditado es `/costeo/agentes` (forwarders CN).

---

## Resumen ejecutivo

Los tres directorios comparten propósito (listar entidades con acciones básicas) pero **cada uno resuelve el mismo problema con un patrón visual distinto**: distinto header, distinto contenedor de filtros, distinta columna de acciones, distinta capitalización y distinta densidad de filas. El "sentirse parche" en este tranche viene 100% de esa divergencia.

| Ruta | PageHeader | Contenedor filtros | Buscador | Acciones fila | Densidad |
|---|---|---|---|---|---|
| `/clientes` | H1 inline con icon chico + subtítulo | ninguno | input suelto | row-click | estándar |
| `/proveedores` | `PageHeader` canónico (icon-tile) | selects sueltos | dentro de card de filtros | row-click | estándar |
| `/costeo/agentes` | H1 propio sin `PageContainer` | ninguno | ninguno | 3 icon-buttons inline | ~30% más alta |

---

## Hallazgos

### 🔴 HIGH — Los 3 directorios usan 3 headers distintos
- `/clientes` renderiza `<Clientes />` sin `PageHeader`: título con icono `Users` inline y "20 clientes registrados" como línea debajo.
- `/proveedores` usa `PageHeader` canónico (icon-tile `bg-accent/10`, título + descripción + `actions`).
- `/costeo/agentes` usa un H1 propio sin `PageContainer` ni `PageHeader`, y el título "Agentes de costeo" queda pegado al borde superior sin la respiración del resto de páginas.

**Fix:** los tres deben usar `PageContainer` + `PageHeader` con la misma composición (`icon` como `LucideIcon` en `text-accent`, `title`, `description`, `actions`). El contador ("20 clientes registrados", "4 agentes") va como sufijo en `description` — no en un renglón aparte.

**Archivos:** `src/features/cliente/routes/Clientes.tsx`, `src/features/costeo/routes/CosteoAgentes.tsx` (aparente).

---

### 🔴 HIGH — Nombres en MAYÚSCULAS en `/costeo/agentes`
`AGENTEPRUEBA`, `LONGSAIL`, `CTL LOGISTICS MEXICO S.A. DE C.V.`, `SHENZHEN GOLDEN SHIPPING CO.,LTD` violan el estándar de Title Case aplicado en Clientes ("Bueno Alimentos", "Fastcold Tech") y Proveedores ("Administracion Gong"). Ver `src/lib/formatters/toTitleCase`.

**Fix:** aplicar `toTitleCase(agente.nombre)` en el column cell.

---

### 🟠 MED — Columna Acciones inline en `/costeo/agentes`
Cada fila tiene 3 icon-buttons visibles (agregar-contacto, editar, eliminar rojo directo). Contradice:
- `/clientes` y `/proveedores` navegan por `onRowClick` sin columna de acciones.
- Regla `mem://features/data-safety-confirmations`: el trash directo, sin ELIMINAR typable, es una violación de safety.

**Fix:** consolidar en un `DropdownMenu` con trigger `MoreHorizontal`, mover eliminar a `AlertDialog` con confirmación tipada, y hacer la fila clicable (`onRowClick` → detalle o modal de edición).

---

### 🟠 MED — Filtros y buscador inconsistentes
- `/clientes` tiene input suelto entre el header y la tabla, sin card ni radio.
- `/proveedores` tiene input + 2 selects dentro de una card con `rounded-lg border`, y el pattern de "Filtros avanzados en Sheet" del Lote 4 no aplica aquí (queda como cascada mixta).
- `/costeo/agentes` no tiene buscador ni filtros, pese a que ya tiene 4 filas hoy y crecerá.

**Fix corto (sin cambiar filtros existentes):**
1. Envolver el input de `/clientes` en el mismo contenedor `rounded-lg border p-3` que usa `/proveedores` para nivelar el look.
2. Añadir buscador básico en `/costeo/agentes` con el mismo componente.

**Fix largo (fuera de este lote):** migrar los tres a `UnifiedFiltersBar` cuando se refactorice.

---

### 🟠 MED — Breadcrumb en minúsculas
- `/proveedores` → "compras › Proveedores"
- `/costeo/agentes` → "Costeo › agentes"

El primer o segundo segmento aparece en lowercase mientras que en `/inicio`, `/embarques`, `/cotizaciones` está capitalizado. Roto por segmentos derivados directamente de la URL.

**Fix:** normalizar segmentos con `toTitleCase` en `src/components/layout/Breadcrumbs.tsx` (o mapear labels por ruta en el registro central).

---

### 🟡 LOW — Densidad de fila divergente en `/costeo/agentes`
Las filas ocupan ~30% más alto que en Clientes/Proveedores porque la tabla no usa `DataTable` compartido (usa una tabla artesanal con `py-4`). Además el badge "Activo" verde aparece en el 100% de filas hoy → ruido visual sin señal.

**Fix:**
- Migrar a `DataTable` con `density="compact"` como el resto.
- Ocultar la columna "Activo" cuando el filtro implícito ya la restringe (mismo patrón aplicado en `CxpPorCapturar` en Lote 4c).

---

### 🟡 LOW — Columnas Contacto/Teléfono con >40% de huecos en `/clientes`
Muchas filas tienen contacto o teléfono vacío. Las dos columnas ocupan ~28% del ancho a 1920px pero >40% de filas están vacías. Genera la sensación de tabla "coladera".

**Fix cosmético:** cuando la celda está vacía, renderizar `<span class="text-muted-foreground">—</span>` en lugar de string vacío, y considerar mover Contacto a la fila "hover / detalle" en un lote futuro.

---

## Propuesta de Lote 5

| Bloque | Severidad | Archivos aprox. | Cambio |
|---|---|---|---|
| **5a** | HIGH | 2 | Migrar `/clientes` y `/costeo/agentes` a `PageContainer` + `PageHeader` canónico (icon-tile), contador en `description`. |
| **5b** | HIGH | 1 | `toTitleCase` en la celda "Nombre" de `/costeo/agentes`. |
| **5c** | MED | 2 | Consolidar acciones inline de `/costeo/agentes` en `DropdownMenu` + `AlertDialog` con confirmación tipada; row-click a edición. |
| **5d** | MED | 1 | Normalizar segmentos del breadcrumb con `toTitleCase` en `Breadcrumbs.tsx`. |
| **5e** | LOW | 2 | Envolver buscador de `/clientes` en la misma card que `/proveedores` y añadir buscador en `/costeo/agentes`. Renderizar `—` en celdas vacías de Clientes. |

Total estimado: **8 archivos**, sin tocar lógica de negocio.

---

## Opciones para el siguiente turno

1. **"aplica Lote 5a"** — sólo los headers (2 archivos, HIGH, sin regresión).
2. **"aplica Lote 5 completo"** — 5a + 5b + 5c + 5d + 5e (8 archivos).
3. **"sigue con Tranche D"** — auditar `/portal/*` (portal cliente y portal agente).
