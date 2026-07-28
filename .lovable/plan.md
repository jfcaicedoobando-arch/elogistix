## Auditoría visual — Detalle de Proveedor (`/proveedores/:id`)

Capturé la página del proveedor "CTL Logistics Mexico" en 4 anchos: 1920, 1440, 768 y 390 px. Lo que encontré, de más grave a cosmético.

### 1. Bug real: el encabezado se rompe en móvil y tablet

A 390 px el título ocupa 3 renglones, el badge se comprime a 3 líneas y los botones **se salen de la pantalla** — "Editar" queda cortado y "Actualizar con CSF" y el menú "…" son inalcanzables. A 768 px la página entera hace scroll horizontal.

Causa: el encabezado es un `flex items-center justify-between` hecho a mano en `ProveedorDetalle.tsx:65-106`, sin `flex-wrap`, sin `min-w-0` y sin apilado en móvil. Analogía: una repisa de ancho fijo a la que le seguimos poniendo libros; los de la orilla se caen.

Ya existe en el repo el componente canónico `DetailHeader` (`src/components/shared/DetailHeader.tsx`) que resuelve exactamente esto (columna en móvil, fila en `md+`, `truncate`, `min-w-0`, acciones que envuelven) — y hoy **no lo usa ninguna página**. Esta es la oportunidad de estrenarlo.

### 2. Bug real: la fila de KPIs se desborda a 768 px

`grid-cols-1 md:grid-cols-3` con una sub-rejilla de 2 columnas dentro de la tercera celda = 4 tarjetas reales apretadas en 3 columnas justo cuando entra el breakpoint `md`. Resultado a 768 px: "Pagado" y "Pendiente" quedan cortados a media cifra. En móvil el monto "USD 80,768.13" también se desborda de su tarjeta.

### 3. Tarjetas con enorme espacio muerto (1440/1920)

Las tarjetas del renglón se estiran a la altura de la más alta ("Datos Generales"), dejando ~140 px vacíos debajo de "USD 306.59" y "USD 80,768.13". La página se ve hueca y obliga a hacer scroll para llegar a la tabla, que es lo que la gente viene a ver.

### 4. Campos vacíos sin placeholder

"Contacto:" y "Email:" se muestran literalmente vacíos, como si la interfaz estuviera rota. Debe ir "—". Existe `DescriptionList` (con `emptyPlaceholder="—"`) para esto.

### 5. Falta información de contexto y jerarquía

- No hay indicador visual de **Nacional / Extranjero** (dato que cambia todo el bloque bancario) ni del **estado** del proveedor.
- Facturado / Pagado / Pendiente son tres cifras sueltas: no se ve de un vistazo **qué proporción se debe**.
- La tarjeta "Datos bancarios" ocupa el ancho completo para mostrar dos "No capturado" — mucho espacio para poca información, y sin invitación a capturarlos.
- El email y el teléfono no son accionables (`mailto:` / `tel:`).

---

## Plan de rediseño

**Sólo capa de presentación.** Cero cambios en hooks, servicios, consultas ni lógica de negocio.

### A — Encabezado responsive (arregla el bug #1)
Sustituir el bloque manual por `<DetailHeader>` con `backTo="/compras/proveedores"`, icono `Truck`, título, badges y `trailing` con las acciones. Agregar como subtítulo el RFC + categoría para que el título deje de cargar todo el peso.

### B — Banda de KPIs (arregla el bug #2 y el #3)
Reemplazar la rejilla ad-hoc por `KpiStrip` + `KpiCard` (los componentes canónicos ya usados en el resto de la app): carrusel con scroll-snap en móvil, grid de 3 en desktop. Las tres KPIs: **Total Facturado** (sublabel: "37 operaciones"), **Pagado** (variante `success`), **Pendiente** (variante `warning`). Altura uniforme y compacta → desaparece el espacio muerto.

Debajo de las KPIs, una barra fina de proporción pagado/pendiente con su porcentaje, para leer la salud de la cuenta en un vistazo.

### C — Tarjeta "Datos Generales" + bancarios en dos columnas
Convertir "Datos Generales" a `DescriptionList` (con "—" en vacíos, RFC en `mono`, email como `mailto:` y teléfono como `tel:`) y ponerla lado a lado con "Datos bancarios" en `lg:grid-cols-2`. Así se aprovecha el ancho y se acorta el scroll hasta la tabla.

En la tarjeta bancaria: badge **Nacional / Extranjero** en el encabezado y, cuando no hay datos capturados, un micro-estado vacío con botón "Capturar datos bancarios" que abre el diálogo de edición ya existente.

### D — Detalles finos
- Badge de categoría con tono semántico en vez de `secondary` plano.
- Contador de operaciones junto al título de la tabla ("Historial de Operaciones · 37").
- Verificar contraste de `text-success` / `text-warning` en modo oscuro.

### Notas técnicas
- Archivos tocados: `src/features/proveedor/routes/ProveedorDetalle.tsx` (principal), `ProveedorDatosBancariosCard.tsx` (badge de origen + estado vacío) y probablemente un `ProveedorResumenCards.tsx` nuevo para no rebasar el límite de 200 líneas por archivo.
- Sólo tokens semánticos (`success`, `warning`, `muted-foreground`); nada de colores literales.
- Se conserva `useProveedorDetalleController` tal cual (incluida la corrección del doble toast de v13.320.63).

### Verificación
- Re-captura con Playwright en 1920 / 1440 / 768 / 390 px, comprobando además que `document.documentElement.scrollWidth === clientWidth` (sin scroll horizontal) en cada ancho.
- `tsgo`, `eslint --max-warnings 0` y los tests de `features/proveedor`.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
