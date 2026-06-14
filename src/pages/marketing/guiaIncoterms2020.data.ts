/**
 * Datos estáticos de la guía Incoterms 2020 (separados del componente
 * para mantener la página productiva ≤200 líneas — Power of 10).
 */
export const PUBLISHED_AT = "2026-06-10";
export const URL = "https://librecarga.com/recursos/guia-incoterms-2020";

export const INCOTERMS = [
  { code: "EXW", name: "Ex Works (En Fábrica)", modo: "Cualquier modo", riesgo: "Comprador asume desde la fábrica del vendedor.", uso: "Mínima responsabilidad del vendedor. Útil cuando el comprador controla la logística." },
  { code: "FCA", name: "Free Carrier (Franco Transportista)", modo: "Cualquier modo", riesgo: "Transfiere al entregar la mercancía al transportista nominado por el comprador.", uso: "Reemplaza a FOB para contenedores. Es el incoterm recomendado por ICC para multimodal." },
  { code: "CPT", name: "Carriage Paid To (Transporte Pagado Hasta)", modo: "Cualquier modo", riesgo: "Vendedor paga el flete principal; el riesgo se transfiere al entregar al primer transportista.", uso: "Útil cuando el vendedor mexicano coordina exportación pero no asume riesgo en tránsito." },
  { code: "CIP", name: "Carriage and Insurance Paid To (Transporte y Seguro Pagados Hasta)", modo: "Cualquier modo", riesgo: "Igual que CPT pero con seguro 'todo riesgo' (cláusula A) obligatorio.", uso: "Recomendado cuando se requiere cobertura amplia desde origen." },
  { code: "DAP", name: "Delivered at Place (Entregado en Lugar)", modo: "Cualquier modo", riesgo: "Vendedor entrega en el lugar acordado, listo para descargar; el comprador despacha la importación.", uso: "Común para entregas a planta del cliente en México sin asumir impuestos." },
  { code: "DPU", name: "Delivered at Place Unloaded (Entregado en Lugar Descargado)", modo: "Cualquier modo", riesgo: "Vendedor entrega y descarga en el lugar acordado.", uso: "Nuevo en 2020 (reemplaza a DAT). Útil para terminales y patios." },
  { code: "DDP", name: "Delivered Duty Paid (Entregado con Derechos Pagados)", modo: "Cualquier modo", riesgo: "Vendedor asume todo, incluido IVA e IGI en destino.", uso: "Máxima responsabilidad del vendedor. Riesgoso en México si no se tiene RFC o agente aduanal." },
  { code: "FAS", name: "Free Alongside Ship (Franco al Costado del Buque)", modo: "Marítimo / vías navegables", riesgo: "Transfiere al colocar la mercancía al costado del buque en el puerto de embarque.", uso: "Para carga a granel o proyectos. Poco usado en contenedores." },
  { code: "FOB", name: "Free on Board (Franco a Bordo)", modo: "Marítimo / vías navegables", riesgo: "Transfiere al cargar la mercancía a bordo del buque.", uso: "El más usado históricamente en México. ICC recomienda migrar a FCA para contenedores." },
  { code: "CFR", name: "Cost and Freight (Costo y Flete)", modo: "Marítimo / vías navegables", riesgo: "Vendedor paga flete marítimo; riesgo transfiere al cargar a bordo.", uso: "Sin seguro. Común en importaciones desde Asia a Manzanillo o Veracruz." },
  { code: "CIF", name: "Cost, Insurance and Freight (Costo, Seguro y Flete)", modo: "Marítimo / vías navegables", riesgo: "Igual que CFR pero con seguro mínimo (cláusula C) obligatorio.", uso: "Muy usado en importación marítima a México. El seguro mínimo a veces no cubre todos los riesgos." },
];

export const FAQ = [
  {
    q: "¿Qué son los Incoterms 2020?",
    a: "Son las reglas de la Cámara de Comercio Internacional (ICC) publicadas en septiembre de 2019 y vigentes desde el 1 de enero de 2020. Definen las obligaciones del vendedor y del comprador en una compraventa internacional: quién paga el transporte, quién asume el riesgo, quién contrata el seguro y quién despacha aduanas. Reemplazan a Incoterms 2010.",
  },
  {
    q: "¿Cuántos Incoterms hay en la versión 2020?",
    a: "Hay 11 reglas: 7 multimodales (EXW, FCA, CPT, CIP, DAP, DPU, DDP) y 4 exclusivas marítimas (FAS, FOB, CFR, CIF).",
  },
  {
    q: "¿Cuál es la diferencia principal entre Incoterms 2010 y 2020?",
    a: "Los cambios más relevantes: (1) DAT se renombró a DPU (incluye descarga); (2) CIP ahora exige seguro cláusula A (todo riesgo) en vez de cláusula C; (3) FCA permite emitir un BL 'a bordo' aunque la entrega ocurra antes del buque; (4) se reconoce explícitamente el transporte con medios propios.",
  },
  {
    q: "¿Cuál Incoterm conviene para importar contenedores desde China a México?",
    a: "Para contenedores la ICC recomienda FCA en vez de FOB, porque la mercancía suele entregarse en la terminal del puerto antes de cargarse a bordo, y FOB transfiere riesgo sólo al cargar al buque. FCA + seguro propio suele dar más control. CIF y CFR siguen siendo los más usados en la práctica mexicana por costumbre.",
  },
  {
    q: "¿Qué Incoterm aplica para exportar bajo el T-MEC a Estados Unidos por carretera?",
    a: "Lo más común es DAP o FCA. DAP entrega en el lugar del cliente sin pagar aduana de importación EE.UU.; FCA entrega al transportista nominado en cruce fronterizo (Laredo, Nuevo Laredo). Evitar DDP si no se cuenta con representante fiscal en EE.UU.",
  },
  {
    q: "¿Quién paga el flete y quién asume el riesgo en CIF?",
    a: "El vendedor paga el flete marítimo y contrata seguro mínimo (cláusula C ICC). El riesgo, sin embargo, se transfiere al comprador en el momento en que la mercancía se carga a bordo del buque en el puerto de origen — no al llegar a destino. Es la confusión más frecuente.",
  },
  {
    q: "¿Es obligatorio usar Incoterms en una factura?",
    a: "No es una obligación legal, pero la ICC y el SAT recomiendan declararlo explícitamente en la factura comercial y en el contrato. Es un dato requerido en el pedimento aduanal mexicano (campo 'INCOTERM') y en el complemento Carta Porte cuando aplique.",
  },
  {
    q: "¿DDP me obliga a pagar el IVA en México?",
    a: "Sí. En DDP el vendedor asume todos los costos y trámites de importación, incluidos IGI (Impuesto General de Importación), DTA, IVA y honorarios del agente aduanal. Si el vendedor no es residente fiscal en México, necesita representante legal o un esquema de importador de registro.",
  },
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
  headline: "Guía Incoterms 2020 México: las 11 reglas explicadas",
  description:
    "Guía práctica de los 11 Incoterms 2020 aplicados al comercio exterior mexicano: cuándo usar cada uno, riesgos y diferencias vs Incoterms 2010.",
  datePublished: PUBLISHED_AT,
  dateModified: PUBLISHED_AT,
  inLanguage: "es-MX",
  author: { "@type": "Organization", name: "Libre Carga" },
  publisher: {
    "@type": "Organization",
    name: "Libre Carga",
    logo: { "@type": "ImageObject", url: "https://librecarga.com/librecarga-logo.svg" },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": URL },
};

export const BREADCRUMB_JSONLD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://librecarga.com/" },
    { "@type": "ListItem", position: 2, name: "Recursos", item: "https://librecarga.com/recursos" },
    { "@type": "ListItem", position: 3, name: "Guía Incoterms 2020", item: URL },
  ],
};
