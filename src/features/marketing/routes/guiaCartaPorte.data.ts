/**
 * Datos estáticos de la guía Carta Porte 3.0 (separados del componente
 * para mantener la página productiva ≤200 líneas — Power of 10).
 */
export const PUBLISHED_AT = "2026-06-10";
export const URL = "https://librecarga.com/recursos/guia-carta-porte-3";

export const FAQ = [
  {
    q: "¿Qué es el complemento Carta Porte 3.0?",
    a: "Es el complemento del CFDI que el SAT exige para amparar el traslado legal de mercancías en territorio nacional por vía terrestre (autotransporte federal), marítima, aérea o ferroviaria. La versión 3.0 (vigente desde el 17 de julio de 2024) sustituye a la 2.0 y agrega validaciones más estrictas sobre claves de producto, ubicaciones, peso y datos del transportista.",
  },
  {
    q: "¿Quién está obligado a emitir Carta Porte en México?",
    a: "Cualquier persona física o moral que traslade mercancías por territorio nacional: transportistas (CFDI tipo Ingreso + complemento) y propietarios/intermediarios que mueven bienes propios (CFDI tipo Traslado + complemento). Aplica a autotransporte federal, marítimo, aéreo y ferroviario.",
  },
  {
    q: "¿Cuándo entró en vigor la versión 3.0?",
    a: "El SAT publicó la versión 3.0 el 17 de julio de 2024. El periodo de convivencia con la 2.0 terminó y desde entonces todos los CFDI con complemento Carta Porte deben emitirse en versión 3.0.",
  },
  {
    q: "¿Qué multas hay por no emitir Carta Porte o emitirla con errores?",
    a: "El CFF prevé multas de $760 a $14,710 MXN por cada CFDI emitido con errores u omisiones en el complemento, además de la posible inmovilización de la mercancía en revisiones de la Guardia Nacional o el SAT. Reincidencia y dolo agravan la sanción.",
  },
  {
    q: "¿Necesito Carta Porte para tramos internacionales (importación/exportación)?",
    a: "Sí, para el tramo nacional. En importaciones marítimas o aéreas, el complemento ampara el traslado desde el puerto/aeropuerto de entrada hasta el destino final en México. En exportaciones, ampara desde el origen hasta el punto de salida del país. El tramo internacional puro se ampara con el BL, AWB o documento equivalente.",
  },
  {
    q: "¿Cómo se llenan los campos de ubicación origen y destino?",
    a: "Cada ubicación requiere RFC del remitente/destinatario, código postal (de la matriz del SAT), fecha y hora estimada de salida o llegada, y distancia recorrida (en el caso de autotransporte). Para extranjero se usa el RFC genérico XEXX010101000 o XAXX010101000 según corresponda.",
  },
  {
    q: "¿Qué claves del catálogo del SAT son críticas?",
    a: "ClaveProdServCP (catálogo c_ClaveProdServCP), ClaveUnidad (c_ClaveUnidad), TipoEmbalaje (c_TipoEmbalaje), Material Peligroso y clave SCT cuando aplique. Una clave equivocada es la causa #1 de rechazo del CFDI por el PAC.",
  },
  {
    q: "¿Libre Carga genera Carta Porte 3.0?",
    a: "Libre Carga centraliza tus embarques, contenedores, bultos, rutas y datos de clientes para que tu PAC o ERP contable timbre el CFDI con complemento Carta Porte 3.0 sin re-capturar información. El timbrado se realiza con tu PAC autorizado (Libre Carga no es PAC).",
  },
];

export const SECCIONES = [
  { id: "que-es", titulo: "¿Qué es el complemento Carta Porte 3.0?" },
  { id: "obligados", titulo: "¿Quién está obligado a emitirlo?" },
  { id: "tipos", titulo: "Tipos de CFDI: Ingreso vs Traslado" },
  { id: "modos", titulo: "Carta Porte por modo de transporte" },
  { id: "campos", titulo: "Campos obligatorios y catálogos del SAT" },
  { id: "errores", titulo: "Errores más comunes y cómo evitarlos" },
  { id: "multas", titulo: "Multas y sanciones" },
  { id: "checklist", titulo: "Checklist antes de timbrar" },
  { id: "faq", titulo: "Preguntas frecuentes" },
];

export const CHECKLIST_ITEMS = [
  "RFC válido de remitente y destinatario (o genérico extranjero).",
  "Códigos postales validados contra la matriz del SAT.",
  "Claves c_ClaveProdServCP y c_ClaveUnidad correctas por mercancía.",
  "Peso bruto vehicular y peso de la carga en kilogramos / toneladas.",
  "Distancia recorrida declarada en cada ubicación (autotransporte).",
  "Datos del operador, placa y configuración vehicular completos.",
  "Material peligroso marcado y con número ONU cuando aplique.",
  "Fecha y hora estimadas de salida y llegada coherentes.",
];

export const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const ARTICLE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Guía Carta Porte 3.0 México: complemento CFDI 2026",
  description:
    "Guía completa del complemento Carta Porte 3.0 del SAT: obligados, tipos de CFDI, modos de transporte, campos, multas y checklist.",
  datePublished: PUBLISHED_AT,
  dateModified: PUBLISHED_AT,
  inLanguage: "es-MX",
  author: { "@type": "Organization", name: "Libre Carga" },
  publisher: {
    "@type": "Organization",
    name: "Libre Carga",
    logo: {
      "@type": "ImageObject",
      url: "https://librecarga.com/librecarga-logo.svg",
    },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": URL },
};

export const BREADCRUMB_JSONLD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://librecarga.com/" },
    { "@type": "ListItem", position: 2, name: "Recursos", item: "https://librecarga.com/recursos" },
    { "@type": "ListItem", position: 3, name: "Guía Carta Porte 3.0", item: URL },
  ],
};
