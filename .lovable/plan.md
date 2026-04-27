
# Auditoría UI/UX — Libre Carga

He recorrido visualmente las pantallas principales (Dashboard, Operaciones, Embarques lista y detalle, Cotizaciones, Clientes y detalle, Pre-Facturación, Login) en modo claro y oscuro a 1366×768. Estas son las observaciones y el plan de mejora.

## Hallazgos principales

### 1. Header y navegación
- **Título redundante**: el header siempre muestra "PLATAFORMA DE OPERACIONES" en mayúsculas. No agrega valor, ocupa espacio y compite visualmente con el título de la página (`Embarques`, `Cotizaciones`).
- **Sidebar siempre oscuro**: en modo claro el sidebar permanece azul-marino, rompiendo la armonía cromática. Dos áreas con tono opuesto = sensación de "tema sin terminar".
- **Footer del sidebar**: muestra `v6.4.0 · Libre Carga` cuando el changelog ya está en `v8.99.25`. La versión está hardcodeada y desactualizada.
- **Atajo `⌘K`** en la búsqueda — bien, pero el chip del kbd se ve grande respecto al input.

### 2. Header de detalle (Embarque, Cliente, Cotización)
- **Botón destructivo "Eliminar" rojo sólido** se coloca al mismo nivel jerárquico que la acción principal "Avanzar a En Aduana" y otros 5 botones. Riesgo alto de error humano.
- **Demasiadas acciones primarias visibles**: Avanzar / Editar / Duplicar / Compartir / Imprimir / Eliminar — todas con misma prominencia visual. No hay jerarquía 1·2·3.
- **Texto truncado sin tooltip**: "Rollos y Etiquetas Rollet SA de…" se corta sin posibilidad de ver el texto completo.
- **Mayúsculas crudas en datos**: "INDIMEX TRADING", "AVENIDA VASCONCELOS 310", "WANHAI" — `toTitleCase` no se está aplicando consistentemente en algunos headers de detalle ni en valores de catálogo.

### 3. KPIs y tarjetas de métricas
- **Desbordamiento numérico**: en el detalle de cliente, "Profit USD 92,789.85" se trunca a `USD 92,789.8…`. El valor usa `text-2xl` rígido y no escala según ancho.
- **Código de color contraintuitivo**: en pestaña Costos del embarque, "TOTAL VENTA" tiene barra **roja** (semánticamente sería ingreso/positivo). El orden de colores no respeta semántica financiera.
- **6 KPIs en una sola fila** en cliente: Embarques · Cotizaciones · Contactos · Facturado · Pendiente · Profit — son demasiados a 1366px y todos al mismo peso visual; algunos son contadores y otros importes.

### 4. Tablas
- **Columnas críticas cortadas**: en lista de Embarques, el badge "Estado" se corta porque la columna es estrecha y no hay scroll horizontal con sticky en columnas clave (Expediente / Acciones).
- **Iconos de modo como emoji** (⚓ ✈️) en lugar de iconos lucide consistentes con el resto de la UI.
- **Densidad inconsistente**: la tabla de Clientes tiene filas altas (con teléfono y ciudad multi-línea) mientras Embarques tiene filas compactas. No hay control unificado.
- **Falta zebra/hover sutil** que ayude al recorrido visual en tablas largas.

### 5. Empty states y loading
- Empty states ya unificados en muchas vistas (fases anteriores), pero el **estado de carga** aún usa `Cargando…` plano centrado en el viewport entero, sin skeletons en algunos detalles. La lista de Embarques sí tiene skeleton — bien — pero el detalle muestra solo un spinner.

### 6. Login
- Pantalla muy genérica: solo logo + 2 inputs + botón. Falta:
  - Mensaje de propuesta de valor / contexto de marca
  - Acceso a "¿Olvidaste tu contraseña?"
  - Link a portal de cliente vs operadores (si aplica)
  - Lado izquierdo con visual de marca (split layout estándar en SaaS B2B)

## Plan de mejora (6 fases)

### Fase A · Sistema de cabecera y navegación global
- Eliminar el rótulo `PLATAFORMA DE OPERACIONES` del header y reemplazar por **breadcrumb** dinámico (`Embarques › ELIMP00185`).
- Hacer el sidebar **respetuoso del tema**: en modo claro fondo `bg-card` con borde derecho, item activo con `bg-primary/10` y texto `text-primary` (mantener sidebar oscuro solo como variante opcional, no por defecto).
- Sustituir `v6.4.0` hardcodeado en el footer del sidebar por la versión más reciente del changelog (lectura desde `chunk0[0].version`).
- Reducir el chip `⌘K` a `text-[10px]` y darle un fondo más sutil.

### Fase B · Header de detalle con jerarquía clara
- Aplicar patrón **"1 acción primaria + acciones secundarias en menú"**:
  - Primaria sólida (`Avanzar a En Aduana`)
  - Editar / Duplicar quedan como botones outline a la derecha
  - Compartir / Imprimir / Eliminar van dentro de un menú `…` (DropdownMenu) con "Eliminar" separado por divider y en rojo
- Mover el badge de estado (`Arribo`) y el de proforma (`SIN PROFORMA`) a una **fila secundaria** debajo del título, con jerarquía menor.
- Aplicar `toTitleCase` consistentemente en headers de detalle de Cliente y valores de catálogo (Naviera, Mercancía cuando aplique).
- Añadir tooltip nativo a títulos largos truncados.

### Fase C · KPIs responsivos y semánticamente correctos
- Crear componente `StatCard` único con:
  - Tamaño de número adaptativo: `text-xl md:text-2xl` + `truncate` con tooltip al pasar el ratón
  - Soporte de `tabular-nums` por defecto
  - Variantes semánticas: `info` (ventas), `success` (utilidad/profit), `warning` (pendiente), `destructive` (alertas/críticos)
- Reorganizar KPIs del **detalle de cliente** en 2 grupos: contadores (Embarques, Cotizaciones, Contactos) en fila densa y financieros (Facturado, Pendiente, Profit) en cards más prominentes — orden lógico de izq→der.
- Corregir el color de la barra lateral en pestaña Costos del embarque: Venta → `info` (azul), Costo → `warning` (ámbar), Utilidad → `success` (verde), Margen → `accent` (azul brillante).

### Fase D · Tablas profesionales
- Estandarizar filas a una sola línea con `truncate + tooltip` en columnas largas (Cliente, Concepto).
- Añadir **sticky** en columna Expediente (izq) y Acciones/Estado (der) para tablas con scroll horizontal.
- Reemplazar emoji de modo (⚓ ✈️) por iconos `lucide-react` (`Ship`, `Plane`, `Truck`) tintados con `text-muted-foreground`.
- Aplicar `hover:bg-muted/40` consistentemente en filas cliqueables.

### Fase E · Loading states con skeletons
- Reemplazar el spinner `Cargando…` del detalle de embarque/cliente por un **skeleton** que respete la estructura real (header rectángulo, fila de KPIs, dos cards grandes) — reduce sensación de espera percibida.
- Crear un helper `<DetailPageSkeleton variant="embarque|cliente" />` reutilizable.

### Fase F · Login con identidad de marca
- Layout **split** 60/40:
  - **Izquierda** (oculta en mobile): fondo `bg-primary` con patrón sutil, logo grande, tagline ("Tu operación de carga, simplificada.") y mini-features (3 bullets con iconos).
  - **Derecha**: formulario actual, ahora con link "¿Olvidaste tu contraseña?", separador "o", botón Google (si está habilitado), y enlace al portal del cliente.
- Footer pequeño con "© 2026 Libre Carga · Términos · Privacidad".

## Ejecución sugerida

Cada fase es independiente y puedo entregarse como una versión patch del changelog (`v8.99.26` a `v8.99.31`). Recomiendo empezar por **Fase A + B** (las que más impactan la percepción de profesionalismo en cada pantalla) y luego Fase C (KPIs visibles en todas las vistas).

## Detalles técnicos

- **Stack**: React 18 + Tailwind v3 + shadcn/ui + design tokens HSL en `index.css`.
- **Tokens nuevos a considerar** en Fase A: variante `sidebar-light-*` para el sidebar en modo claro (o simplemente bind a `--card`/`--border` y eliminar la duplicación).
- **DropdownMenu** de shadcn ya disponible — no se requiere dependencia nueva para Fase B.
- **Skeleton** ya disponible en `@/components/ui/skeleton` — se usa en `Embarques.tsx` como referencia.
- Cambios contenidos a CSS y componentes; **no requieren migraciones de base de datos** ni cambios de RLS.
- Cada fase finaliza con `tsc --noEmit` limpio + entrada en changelog (`src/content/changelog/v8/chunks/0.ts`) según la regla del proyecto.
