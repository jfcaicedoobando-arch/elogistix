# Auditoría visual UI/UX — Libre Carga

Revisé las pantallas principales en escritorio (1440×900) y móvil (390×844), en modo claro y oscuro: Inicio, Cotizaciones, Embarques, Clientes y Detalle de Cliente. Abajo está el diagnóstico priorizado con propuesta de fixes.

---

## 🔴 Bloqueantes (corregir ya)

### 1. El sidebar NO respeta el modo claro
Al cambiar al tema claro, todo el contenido se aclara correctamente, pero la **barra lateral sigue oscura** (azul-marino). Rompe la jerarquía visual y el contraste del logo (que tiene fondo blanco) queda forzado. Debería ser blanco con texto oscuro en light mode, según tokens ya definidos en `index.css`.

**Causa probable:** algún wrapper aplica `dark` localmente al `<Sidebar>` o el `SidebarProvider` se monta dentro de un nodo con clase forzada. Confirmar inspeccionando `Layout.tsx` / `sidebar.tsx`.

**Fix:** asegurar que `Sidebar` use solo tokens (`bg-sidebar`, `text-sidebar-foreground`) sin overrides; eliminar cualquier `dark:` o `bg-[hsl(...)]` hardcodeado.

### 2. Breadcrumb muestra UUID crudo en detalle de cliente
La ruta `/clientes/:id` muestra `Clientes › 87bdcbf1-4476-…` en vez de `Clientes › Indimex Trading`. Igual ocurriría en embarques/cotizaciones si el componente Breadcrumbs no resuelve el segmento dinámico.

**Fix:** en `Breadcrumbs.tsx`, mapear segmentos UUID a un nombre real (consultando el record cargado o vía contexto), y como fallback, ocultar el segmento dinámico en lugar de mostrar el UUID.

### 3. KPIs de moneda truncados en tarjetas de detalle de cliente
"Facturado: USD …", "Pendiente: USD …", "Profit: USD …" — el monto se trunca con elipsis aún en escritorio 1440. La cifra principal del KPI es justo lo que el usuario necesita ver.

**Fix:** abreviar (`USD 1.2M`, `USD 845K`) con `Intl.NumberFormat` + `notation: 'compact'`, y mostrar el valor completo en tooltip. Reducir `text-2xl` → `text-xl` cuando el valor sea grande, o aumentar `min-w` de la card.

---

## 🟠 Importantes (mejoran percepción de calidad)

### 4. Móvil: filtros ocupan 7 filas verticales y el buscador se corta
En `/embarques` a 390px: 6 selects + buscador apilados full-width (ocupan ~600px de scroll antes de ver datos). El placeholder se corta a "…o m...".

**Fix:** colapsar filtros en un único botón `Filtros (3)` que abre un `Sheet`/`Drawer` lateral en mobile. Mantener solo el buscador visible. Ya hay patrón con `Sheet` instalado.

### 5. Botones primarios en mobile son full-width y compiten visualmente
"Exportar CSV" y "Nuevo Embarque" apilados full-width con el botón primario en azul oscuro grande. Distrae del contenido.

**Fix:** en mobile colocar "Nuevo Embarque" como **FAB flotante** (bottom-right) y mover "Exportar CSV" al menú overflow `⋮` del header de página.

### 6. Densidad de texto en encabezado de página
Título `Cotizaciones` (text-4xl bold) + subtítulo "46 cotizaciones encontradas" — funciona, pero el subtítulo en `text-muted-foreground` es muy ligero y casi se pierde en dark. El conteo es información útil que debería leerse al instante.

**Fix:** convertir el conteo en un Badge sutil al lado del título (`Cotizaciones · 46`) o subirlo a `text-foreground/70`.

### 7. Tabla: nombre de cliente "INDIMEX TRADING" en mayúsculas
El detalle muestra el nombre en `uppercase`, pero en la tabla y en otras vistas aparece en `Title Case` ("Indimex Trading"). Inconsistente.

**Fix:** usar siempre el casing de la base. Quitar `uppercase` del título del detalle.

---

## 🟡 Mejoras de pulido

### 8. Header de página vacío entre carga y datos
Mientras carga (`Cargando…`) el área central muestra solo un spinner pequeño. Falta skeleton de la tabla → percepción de lentitud.

**Fix:** usar `<DataTableSkeleton rows={8}>` (ya existente en `ui/skeleton`) en el `Suspense` fallback de cada lista.

### 9. Avatar/iniciales del usuario en el footer
El footer del sidebar muestra solo `hector@lopezbenavides.com` + badge "Admin". Falta avatar circular con iniciales — patrón estándar para SaaS y refuerza identidad.

**Fix:** componente `Avatar` con iniciales `HL` derivadas del email, y menú dropdown al hacer click (perfil, cerrar sesión, tema).

### 10. Theme toggle no etiquetado
El icono sol/luna en el topbar no tiene tooltip en escritorio (solo aria-label). Usuarios nuevos pueden no entender qué hace al estar tan cerca del search bar.

**Fix:** envolver en `<Tooltip>` con texto "Cambiar tema · ⌘J".

### 11. Indicador de página activa en sidebar
La fila activa (`Cotizaciones`) usa `bg-sidebar-accent` (azul oscuro) + barrita izquierda — funciona en dark, pero en light (cuando se arregle #1) podría perder contraste contra el fondo blanco. Validar.

### 12. Etiquetas de grupo del sidebar (`DASHBOARDS`, `GESTIÓN`, …)
Texto en uppercase tracking-wide en color muy tenue (`/40`) — apenas legibles en dark. Subir a `/55` o `/60`.

### 13. Vigencia "Vencida · 25/04/2026" en rojo sobre fondo rojo
Badge rojo sobre fondo rojo claro tiene contraste OK, pero el badge "2d · 30/04/2026" (warning) se confunde con el badge de estado adyacente "Enviada". Demasiados badges en la misma fila.

**Fix:** agrupar vigencia + estado en una columna combinada con jerarquía clara (badge primario = estado, texto secundario = vigencia).

### 14. Breadcrumb separator (`›`) vs título de página redundante
El topbar muestra `Cotizaciones` (breadcrumb) y la página repite `Cotizaciones` (h1) — duplicación. Considerar quitar el breadcrumb cuando solo hay un nivel.

### 15. Logo container con doble fondo en sidebar oscuro
El logo está envuelto en `bg-white p-1 rounded-xl shadow-card` — se ve como un "post-it" pegado en el sidebar oscuro. Limpio pero estilo retro. Alternativa: usar versión SVG monocromática del logo en dark mode (sin contenedor blanco).

---

## 📐 Notas de arquitectura visual

- **Tipografía:** Inter está bien aplicada, pero se nota mucha repetición de `text-sm` con `text-muted-foreground` — a veces ilegible en dark. Definir un token `text-secondary` con contraste >= 4.5:1.
- **Sombras:** los tokens `shadow-card` se aplican uniformemente; está bien, pero en dark las cards se ven planas porque `shadow-card` con opacidad 0.20 se pierde sobre fondo oscuro. Probar `border-white/5` adicional.
- **Espaciado:** el `p-6` general del main funciona en desktop pero se siente apretado en cards (KPIs con `p-6`); reducir a `p-4` en cards densas.

---

## 🎯 Plan de ejecución sugerido (3 oleadas)

**Oleada 1 — Bloqueantes (1 sesión)**
- Fix sidebar light mode (#1)
- Fix breadcrumb UUID (#2)
- Fix KPI truncado con compact notation (#3)

**Oleada 2 — Mobile (1 sesión)**
- Filtros en `Sheet` colapsable (#4)
- FAB para acción primaria + overflow menu (#5)
- Skeleton states (#8)

**Oleada 3 — Pulido (1 sesión)**
- Avatar + dropdown en footer (#9)
- Tooltips faltantes (#10)
- Casing consistente (#7)
- Badges agrupados (#13)
- Tipografía secundaria + sombras dark (notas de arquitectura)

¿Empezamos por la **Oleada 1** o prefieres priorizar diferente?
