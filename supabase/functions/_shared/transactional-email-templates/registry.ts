// Registro central de plantillas transaccionales.
// Cada plantilla registrada queda disponible para `send-transactional-email`
// mediante su `templateName`.
import type * as React from 'npm:react@18.3.1';

export interface TemplateEntry {
  component: React.ComponentType<any>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  to?: string; // Si se fija, ignora recipientEmail del caller
}

import { template as cotizacionRespuesta } from './cotizacion-respuesta.tsx';
import { template as cotizacionEnviada } from './cotizacion-enviada.tsx';

export const TEMPLATES: Record<string, TemplateEntry> = {
  'cotizacion-respuesta': cotizacionRespuesta,
  'cotizacion-enviada': cotizacionEnviada,
};
