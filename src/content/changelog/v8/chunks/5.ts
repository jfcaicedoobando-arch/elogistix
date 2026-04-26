import type { ChangelogEntry } from "../../changelogData";

export const chunk5: ChangelogEntry[] = [
  {
    version: "8.0.9",
    date: "2026-04-10",
    type: "patch",
    title: "Rediseño de tarjetas de embarque en portal del cliente",
    description: "Tarjetas de embarque con más información visual: borde de color según estado, icono circular por modo de transporte, ruta con icono, naviera/aerolínea, tipo de servicio y fechas con mejor formato. Hover con sombra y escala sutil.",
  },
  {
    version: "8.0.8",
    date: "2026-04-10",
    type: "patch",
    title: "Grupos colapsables y mejoras UX en Mis Embarques",
    description: "Los grupos de embarques por expediente en el portal del cliente ahora se pueden colapsar/expandir con animación suave. El encabezado muestra un resumen de estados y la ruta, mejorando la legibilidad de fechas ETD/ETA.",
  },
  {
    version: "8.0.7",
    date: "2026-04-10",
    type: "patch",
    title: "Agrupación visual de embarques por expediente en portal",
    description: "Los embarques que comparten el mismo expediente ahora se muestran agrupados visualmente en una tarjeta contenedora con borde punteado, indicando el número de contenedores del grupo.",
  },
  {
    version: "8.0.6",
    date: "2026-04-10",
    type: "patch",
    title: "Distribución visual de estados en portal",
    description: "La carta 'Estado de Embarques' del portal de clientes ahora muestra una barra apilada de colores con la distribución de estados, reemplazando las barras de progreso individuales que eran confusas.",
  },
  {
    version: "8.0.5",
    date: "2026-04-10",
    type: "patch",
    title: "Expediente y contenedor en una sola línea",
    description: "El título de cada tarjeta de embarque en el portal ahora muestra el expediente y el contenedor juntos (ej. ELIMP00149 - WHSU6049365), facilitando la lectura.",
  },
  {
    version: "8.0.4",
    date: "2026-04-10",
    type: "patch",
    title: "Mostrar contenedor en tarjetas de embarque del portal",
    description: "Las tarjetas de embarques en el portal de clientes ahora muestran el número de contenedor, permitiendo diferenciar fácilmente embarques con el mismo expediente. También se puede buscar por número de contenedor.",
  },
  {
    version: "8.0.3",
    date: "2026-04-10",
    type: "patch",
    title: "Comentarios del cliente al aceptar o rechazar cotización",
    description: "Los clientes pueden agregar un comentario opcional al aceptar o rechazar una cotización desde el portal. El comentario se muestra en los banners de estado del portal y en una sección dedicada en el detalle interno de la cotización.",
  },
  {
    version: "8.0.2",
    date: "2026-04-10",
    type: "minor",
    title: "Aceptar o rechazar cotizaciones desde el portal de clientes",
    description: "Los clientes ahora pueden aceptar o rechazar cotizaciones en estado 'Enviada' directamente desde el detalle de cotización en su portal, con confirmación visual y banners informativos según el estado.",
  },
  {
    version: "8.0.1",
    date: "2026-04-10",
    type: "patch",
    title: "Orden correcto de estados en el dashboard del portal",
    description: "Los estados de embarque en la gráfica de distribución del dashboard del portal ahora se muestran en el orden lógico del ciclo de vida (Confirmado → En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado) en lugar de ordenarse por cantidad.",
  },
  {
    version: "8.0.0",
    date: "2026-04-10",
    type: "major",
    title: "Rediseño completo del Portal de Clientes",
    description: "Mejora integral de UX: nuevo layout con navegación integrada en header, menú móvil desplegable, breadcrumbs, avatar de usuario. Dashboard enriquecido con KPIs clickeables, gráfica de distribución por estado, próximos arribos y resumen de facturación pendiente. Listas de embarques, cotizaciones y facturas con búsqueda y filtros por estado/modo. Detalle de embarque con tracker visual de progreso, countdown de ETA, tarjetas rápidas de ruta e indicadores en pestañas.",
  },
];
