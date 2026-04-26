/**
 * Tipo del formulario "Convertir Prospecto a Cliente".
 * Movido desde src/components/cotizacion/DialogConvertirProspecto.tsx para evitar que hooks
 * importen tipos desde components.
 */
export interface ClienteFormData {
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
}
