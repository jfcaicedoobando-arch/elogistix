# Rediseño UI/UX — Buzón de facturas de proveedor (1366 × 768)

Auditoría visual hecha con la página real en 1366 × 768 (`/compras/buzon`, 1 documento pendiente).

## Qué está mal hoy

1. **La tarjeta se rompe a 1366 px.** Las 5 acciones (Ver archivo, XML, Ir al embarque, Marcar como capturada, Rechazar) ocupan la mitad del ancho y empujan los datos del documento a 3 renglones; los chips PDF/XML se van a una segunda línea. A esta resolución la fila se ve desordenada y con solo 1 registro ya llena 100 px de alto.
2. **No hay jerarquía de información.** El nombre del archivo (`FA2026063024.pdf`) es lo más grande, cuando lo que contabilidad necesita leer primero es proveedor, expediente, folio y antigüedad. Todo lo demás va en un párrafo gris de 12 px separado por puntos.
3. **Sin búsqueda, filtros ni orden.** Solo existe el botón "Ver sólo sin XML" y aparece únicamente cuando hay documentos sin XML. Con 30–50 documentos no hay forma de buscar por proveedor, expediente o folio, ni de ordenar por antigüedad.
4. **KPIs mudos y con iconografía confusa.** "Con 3 días o más" usa un icono de tache (XCircle, que en el resto de la app significa rechazar/error) y ninguna tarjeta es clickeable para filtrar. Además ese KPI se calcula sobre la lista ya filtrada, así que cambia de valor al activar "sólo sin XML" mientras los otros dos no.
5. **Copy y detalles.** "0 día(s)" en badge ámbar cuando el documento se subió hoy (debería ser neutro: "Hoy"); el estado vacío usa un emoji 🎉; la miga de pan dice "Buzon" sin acento.
6. **Falta contexto del trabajo hecho.** No se ve nada de lo ya capturado o rechazado: no hay pestaña/historial, así que el buzón se siente como una lista que solo se vacía, sin traza.
7. **Sin acciones masivas ni vista previa.** Para cada documento hay que abrir el archivo en otra pestaña, volver, e ir al embarque. No hay panel de vista previa lateral ni selección múltiple para rechazar/capturar en bloque.

## Qué haremos

**A. Fila compacta y legible (prioridad alta)**
- Reordenar la fila en 3 zonas fijas: (1) antigüedad + tipo de archivo, (2) proveedor en negritas con expediente/folio/fecha debajo y el nombre del archivo como texto secundario, (3) acciones.
- Colapsar las acciones secundarias: quedan visibles "Ver" y "Marcar como capturada"; XML, "Ir al embarque" y "Rechazar" pasan a un menú de tres puntos. La fila baja a una sola línea a 1366 px.
- Semáforo de antigüedad: "Hoy" neutro, 1–2 días informativo, 3–6 días ámbar, 7+ días rojo, con barra de color a la izquierda de la fila.

**B. Barra de trabajo (toolbar)**
- Búsqueda con debounce por proveedor, expediente, folio y nombre de archivo.
- Chips de filtro: "Todos", "Sin XML", "3+ días", "Con nota".
- Orden por antigüedad (más viejo primero, por defecto) o proveedor.
- Contador "N de M documentos" a la derecha.

**C. KPIs accionables y consistentes**
- Las 3 tarjetas se calculan siempre sobre el total (no sobre lo filtrado) y al hacer clic aplican su filtro correspondiente.
- Iconos corregidos: Inbox, Clock (antigüedad), FileCode2 (sin XML).

**D. Vista previa lateral**
- Al hacer clic en la fila se abre un panel lateral con el PDF embebido (vía `blob:`, ya soportado) más los datos y las mismas acciones, para capturar sin abrir pestañas nuevas.

**E. Pestañas Pendientes / Capturadas / Rechazadas**
- Tres pestañas con carga diferida; las de historial son solo lectura con fecha, usuario y motivo de rechazo.

**F. Detalles de pulido**
- Estado vacío con ilustración de icono, título "Buzón al día" y texto de apoyo, sin emoji.
- Miga de pan y título con acento correcto ("Buzón").
- Skeletons con la forma de las filas reales en lugar de un bloque de 160 px.

## Detalles técnicos

- Extraer la fila a `src/features/bandejas/components/FacturaEntranteRow.tsx` y la toolbar a `FacturasEntrantesToolbar.tsx`; la ruta `CxpBuzonEntrantes.tsx` queda como orquestador (regla ≤200 líneas).
- Filtros/orden/semáforo de antigüedad como funciones puras en `src/lib/domain/facturasEntrantes.ts` (o un módulo hermano) con pruebas unitarias; la página no calcula reglas.
- Reutilizar `DetailSheet`/`Sheet` existente para la vista previa y `abrirFacturaEntrante` para el blob.
- Las pestañas de historial requieren consultas por `estado` (`capturada`, `rechazada`) en el servicio de facturas entrantes; sin cambios de esquema ni de RLS.
- Solo cambios de presentación y consulta: la lógica de capturar/rechazar (RPCs y hooks) no se toca.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` (minor).

## Alcance sugerido

Si prefieres algo más corto, A + B + C + F ya arreglan el problema visible a 1366 px; D y E son mejoras de flujo que puedo dejar para una segunda vuelta.
