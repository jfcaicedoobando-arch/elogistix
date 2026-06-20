/**
 * Datos estáticos de la guía "Principales puertos marítimos de México".
 * Separados del componente para mantener la página productiva ≤200 líneas
 * (Power of 10).
 */
export const PUBLISHED_AT = "2026-06-18";
export const URL = "https://librecarga.com/recursos/guia-puertos-mexico";

export interface PuertoData {
  id: string;
  nombre: string;
  unlocode: string;
  ubicacion: string;
  costa: "Pacífico" | "Golfo de México";
  rutasPrincipales: string;
  carga: string;
  navieras: string;
  destacado: string;
}

export const PUERTOS: PuertoData[] = [
  {
    id: "manzanillo",
    nombre: "Manzanillo",
    unlocode: "MXZLO",
    ubicacion: "Colima",
    costa: "Pacífico",
    rutasPrincipales: "Asia (Shanghái, Ningbo, Busan), Costa Oeste EE.UU., Sudamérica.",
    carga: "Contenedores FCL/LCL, granel, vehículos y carga proyecto.",
    navieras: "Maersk, MSC, CMA CGM, Hapag-Lloyd, ONE, COSCO, Evergreen.",
    destacado:
      "Es el puerto #1 de México por volumen contenerizado: maneja más del 45% de los TEUs del país y concentra los servicios troncales Asia–Norteamérica.",
  },
  {
    id: "veracruz",
    nombre: "Veracruz",
    unlocode: "MXVER",
    ubicacion: "Veracruz",
    costa: "Golfo de México",
    rutasPrincipales: "Europa (Amberes, Hamburgo, Algeciras), Mediterráneo, Costa Este EE.UU.",
    carga: "Contenedores, granel agrícola, vehículos, acero, carga refrigerada.",
    navieras: "Maersk, MSC, Hapag-Lloyd, CMA CGM, ZIM.",
    destacado:
      "El puerto histórico más antiguo del continente americano y la principal puerta de entrada de comercio con Europa para el centro de México.",
  },
  {
    id: "lazaro-cardenas",
    nombre: "Lázaro Cárdenas",
    unlocode: "MXLZC",
    ubicacion: "Michoacán",
    costa: "Pacífico",
    rutasPrincipales: "Asia, Sudamérica (Manzanillo–Callao), Costa Oeste EE.UU.",
    carga: "Contenedores, granel mineral (acero, mineral de hierro), vehículos, hidrocarburos.",
    navieras: "APL, Maersk, MSC, CMA CGM, Hapag-Lloyd.",
    destacado:
      "Puerto de aguas profundas (calado >16 m): único en México capaz de recibir buques portacontenedores Post-Panamax y New-Panamax sin restricción.",
  },
  {
    id: "altamira",
    nombre: "Altamira",
    unlocode: "MXATM",
    ubicacion: "Tamaulipas",
    costa: "Golfo de México",
    rutasPrincipales: "Costa Este EE.UU. (Houston, Nueva Orleans), Europa, Norte de Asia.",
    carga: "Contenedores, granel petroquímico, fluidos, automotriz.",
    navieras: "Maersk, MSC, Hapag-Lloyd, CMA CGM, ONE.",
    destacado:
      "Hub petroquímico y automotriz del Golfo: complementa a Veracruz y atiende la industria del noreste y Bajío.",
  },
  {
    id: "ensenada",
    nombre: "Ensenada",
    unlocode: "MXESE",
    ubicacion: "Baja California",
    costa: "Pacífico",
    rutasPrincipales: "Costa Oeste EE.UU. (Los Ángeles, Long Beach, Oakland), Asia.",
    carga: "Contenedores, vehículos, productos agrícolas, cruceros.",
    navieras: "Maersk, MSC, CMA CGM, Hapag-Lloyd.",
    destacado:
      "Alternativa estratégica a Los Ángeles/Long Beach para carga del noroeste mexicano y Baja California; conecta a Tijuana vía corredor terrestre.",
  },
];

export const SECCIONES = [
  { id: "resumen", titulo: "Resumen: los 5 puertos top de México" },
  { id: "manzanillo", titulo: "Puerto de Manzanillo (MXZLO)" },
  { id: "veracruz", titulo: "Puerto de Veracruz (MXVER)" },
  { id: "lazaro-cardenas", titulo: "Puerto de Lázaro Cárdenas (MXLZC)" },
  { id: "altamira", titulo: "Puerto de Altamira (MXATM)" },
  { id: "ensenada", titulo: "Puerto de Ensenada (MXESE)" },
  { id: "comparativo", titulo: "Tabla comparativa" },
  { id: "faq", titulo: "Preguntas frecuentes" },
];

export const FAQ = [
  {
    q: "¿Cuáles son los principales puertos de México?",
    a: "Los cinco puertos más importantes por volumen de carga son Manzanillo (Colima), Lázaro Cárdenas (Michoacán) y Ensenada (Baja California) en el Pacífico; y Veracruz (Veracruz) y Altamira (Tamaulipas) en el Golfo de México. Entre ellos manejan más del 90% del comercio marítimo contenerizado del país.",
  },
  {
    q: "¿Cuál es el puerto más importante de México?",
    a: "Manzanillo (UN/LOCODE MXZLO) es el puerto #1 de México por volumen de contenedores: mueve más del 45% de los TEUs del país y concentra los servicios troncales Asia–Norteamérica.",
  },
  {
    q: "¿Qué puerto mexicano recibe buques más grandes?",
    a: "Lázaro Cárdenas (MXLZC) es el único puerto mexicano con calado natural superior a 16 metros, capaz de recibir buques portacontenedores Post-Panamax y New-Panamax sin restricciones de marea.",
  },
  {
    q: "¿Qué puerto usar para importar desde Asia?",
    a: "Para carga proveniente de China, Corea o Japón, los puertos del Pacífico (Manzanillo, Lázaro Cárdenas y Ensenada) ofrecen los tiempos de tránsito más cortos. Manzanillo concentra la mayoría de los servicios directos.",
  },
  {
    q: "¿Qué puerto usar para importar desde Europa?",
    a: "Para carga europea, los puertos del Golfo (Veracruz y Altamira) son la opción natural por proximidad a las rutas trasatlánticas. Veracruz lidera el comercio México–Europa.",
  },
  {
    q: "¿Qué es un código UN/LOCODE?",
    a: "Es el código estándar de Naciones Unidas para identificar puertos y nodos logísticos. Los principales puertos mexicanos son: Manzanillo MXZLO, Veracruz MXVER, Lázaro Cárdenas MXLZC, Altamira MXATM y Ensenada MXESE. Se usa en BL, manifiestos y sistemas como Libre Carga.",
  },
  {
    q: "¿Libre Carga maneja embarques desde estos puertos?",
    a: "Sí. Libre Carga incluye en su catálogo UN/LOCODE los principales puertos mexicanos y mundiales, y permite trazar embarques marítimos FCL y LCL con sus rutas, contenedores, BL Master y documentación operativa.",
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
  headline: "Principales puertos marítimos de México: guía 2026",
  description:
    "Guía de los cinco puertos más importantes de México: Manzanillo, Veracruz, Lázaro Cárdenas, Altamira y Ensenada. Códigos UN/LOCODE, rutas, navieras y tipo de carga.",
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
    { "@type": "ListItem", position: 3, name: "Puertos de México", item: URL },
  ],
};
