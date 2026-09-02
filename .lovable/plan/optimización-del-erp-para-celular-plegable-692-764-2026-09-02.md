# Optimización del ERP para celular plegable (692 × 764)

Auditoría hecha con sesión real en 692 × 764 (tu fold desplegado) sobre Inicio, Embarques, Facturación, CxP, Cobranza, Antigüedad, Clientes, Cotizaciones, detalle de embarque, sidebar y el modal de captura de factura.

Lo bueno: no hay desbordamiento horizontal de página en ninguna ruta revisada (`scrollWidth` = 692 en todas), no hay errores de consola, el sidebar se convierte en panel deslizable y los modales caben. El problema no es que "se rompa", es que **692 px cae en una zona muerta**: es más angosto que un escritorio pero la app lo trata como pantalla grande en varios lugares.

## Hallazgos, por impacto

### 1. Tablas de escritorio en pantalla de celular (ALTO)
Existe `ResponsiveDataTable`, que abajo de 768 px cambia la tabla por tarjetas táctiles. Embarques ya lo usa y se ve bien. Pero Cobranza, Antigüedad de saldos (CxC y CxP), Tesorería, Comisiones, Compras (pagos, por aprobar, notas de crédito), Papelera y otras ~80 tablas usan `DataTable` directo: en el fold quedan con scroll horizontal, sin columna fija, así que al desplazarte pierdes de vista de qué cliente o factura es cada renglón (analogía: leer un periódico doblado en cuatro, moviéndolo de lado para cada línea).

### 2. Barra de acciones de página se desarma (ALTO)
En Embarques el encabezado colapsa a un botón "…" solo, en un renglón vacío. En CxP y Antigüedad los botones ("Exportar CSV", "Cartera y antigüedad", "Capturar factura") se apilan en un renglón que empuja el contenido útil fuera de la primera pantalla.

### 3. El buscador se vuelve inservible (ALTO)
En Embarques el campo de búsqueda queda en ~94 px y sólo muestra "Bus"; el resto del renglón lo ocupan dos selectores y "Filtros". En el fold conviene: buscador de ancho completo arriba y los filtros dentro del panel de filtros que ya existe (`MobileFiltersSheet`).

### 4. Demasiado desperdicio vertical antes del contenido (MEDIO)
En Cobranza, tres tarjetas de KPI a ancho completo consumen la pantalla entera; la tabla arranca abajo del pliegue. En 692 px caben dos por renglón (como sí hace CxP y Facturación), y en Antigüedad los cinco KPI dejan un hueco grande.

### 5. Tiras que se cortan sin señal clara (MEDIO)
- Tabs del detalle de embarque: se corta "F…" en el borde derecho sin degradado ni flecha, así que no se ve que hay más pestañas (Facturación, P&L, etc.).
- Tabs de Facturación: los rótulos de sección ("PREPARAR", "COBRAR", "HISTÓRICO") se parten entre renglones y quedan sueltos.
- Tira de estados del inicio: ya tiene degradado (arreglado hoy), sirve de patrón para las otras dos.

### 6. Blancos de accesibilidad táctil (MEDIO)
La "X" de cerrar de los modales mide 16 × 16 px (mínimo recomendado 44 × 44). Los avisos del pie del wizard ("Falta el proveedor (paso 2)") son botones de 20 px de alto.

### 7. FAB encima del contenido (BAJO)
El botón flotante "+" de Embarques tapa el último renglón de la lista; falta espacio inferior de respiro cuando el FAB está visible.

## Qué propongo hacer (por olas, sin features nuevas)

**Ola 1 — Cimientos del shell (lo que se nota en toda la app)**
- Encabezado de página: patrón único que en <768 px pone título, luego acciones a ancho completo (la acción primaria visible, las secundarias en el menú "…") y elimina el renglón vacío del "…" solo.
- Barra de filtros: buscador a ancho completo y filtros secundarios movidos al panel de filtros existente en <768 px.
- Tiras deslizables (tabs de detalle y de Facturación): mismo degradado de borde + los rótulos de sección dejan de partirse.
- Tap targets: "X" de modal a 44 × 44 y avisos del wizard con altura mínima táctil.
- Espacio inferior cuando hay FAB.

**Ola 2 — Tablas de las 6 pantallas que más usas en celular**
Migrar a `ResponsiveDataTable` (tarjetas en <768 px) las que revisé y quedaron mal: Cobranza, Antigüedad de saldos CxC, Antigüedad CxP, Compras › Por pagar, Compras › Por aprobar, Tesorería › Pagos. Cada tarjeta muestra folio, cliente/proveedor, vencimiento y saldo, y abre el detalle al tocarla; en escritorio no cambia nada.

**Ola 3 — Densidad de KPIs**
Rejilla uniforme de 2 columnas en Cobranza y Antigüedad, con las tarjetas más compactas en <768 px para que la tabla quede visible sin bajar.

**Ola 4 — Resto de tablas**
Barrido por lotes del resto (detalle de embarque, configuración, presupuesto, comisiones, portales) reusando lo definido en la Ola 2.

Sugiero aprobar Olas 1 a 3 en este paso: son las que vuelven el ERP usable en el fold. La Ola 4 es un barrido largo y conviene medirla después de ver el resultado.

## Detalles técnicos

- Punto de corte: `useIsMobile()` = `max-width: 767px`, así que 692 px sí entra en modo móvil. No hay que tocar breakpoints ni agregar hooks nuevos; lo que falta es *usar* el camino móvil que ya existe.
- `ResponsiveDataTable` ya replica error, reintento, paginación y footer en móvil; sólo hay que definir `mobileCard(row)` por pantalla.
- Corregir el comentario de `ResponsiveDataTable` (dice `<sm`, el código usa `<md`).
- Cero cambios de base de datos, RPCs, consultas o reglas de negocio: sólo capa de presentación. Se conservan tokens del design system (nada de colores fijos) y `docs/design-system.md` como referencia.
- Pruebas: caso de render móvil (matchMedia en 692 px) para las pantallas migradas, verificando que sale la lista de tarjetas y no la tabla; más verificación visual en 692 × 764 antes de cerrar cada ola.
- Cierre con `APP_VERSION` + entrada en `CHANGELOG.md` por ola.
