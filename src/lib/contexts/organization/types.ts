/** Tipos compartidos del contexto de organización. */
export interface Organization {
  id: string;
  nombre: string;
  rfc: string;
  logo_url: string | null;
  plan: string;
  activo: boolean;
}
