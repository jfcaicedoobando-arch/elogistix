/** Estado explícito de esta release; no depende del navegador ni de un 503. */
export const DEMO_ACCESS_AVAILABILITY = Object.freeze({
  status: "unavailable" as const,
  label: "Demo no disponible",
  message: "El acceso a la demo no está disponible. Para conocer Libre Carga, escríbenos a contacto@librecarga.com.",
});
