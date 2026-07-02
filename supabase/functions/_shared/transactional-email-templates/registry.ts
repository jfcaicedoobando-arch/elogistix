// Registro central de plantillas transaccionales.
// Cada plantilla registrada queda disponible para `send-transactional-email`
// mediante su `templateName`.
import type * as React from 'npm:react@18.3.1';

export interface TemplateEntry {
  // Cada plantilla define su propio shape de props; aquí lo dejamos abierto
  // para que el registry pueda alojar componentes heterogéneos.
  component: React.ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  to?: string; // Si se fija, ignora recipientEmail del caller
}

import { template as cotizacionRespuesta } from './cotizacion-respuesta.tsx';
import { template as cotizacionEnviada } from './cotizacion-enviada.tsx';
import { template as proformaEnviada } from './proforma-enviada.tsx';

export const TEMPLATES: Record<string, TemplateEntry> = {
  'cotizacion-respuesta': cotizacionRespuesta,
  'cotizacion-enviada': cotizacionEnviada,
  'proforma-enviada': proformaEnviada,
};
