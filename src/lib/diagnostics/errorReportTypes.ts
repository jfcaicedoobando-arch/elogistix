/**
 * Tipos canónicos de reportes de error.
 * Vive en `lib/` para que componentes y módulos de UI puedan importarlos
 * sin romper la jerarquía de capas (lib → no depende de components).
 */
import type { AppErrorCode } from "@/lib/domain/errorCatalog";

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export interface ErrorReportInput {
  title?: string;
  description?: string;
  phase?: string;
  step?: number;
  error?: unknown;
  context?: Record<string, unknown>;
  errorCode?: AppErrorCode | string;
  method?: string;
  requestId?: string;
}

export interface ErrorReport {
  requestId: string;
  errorCode: AppErrorCode | string;
  method?: string;
  title: string;
  description?: string;
  phase?: string;
  step?: number;
  version: string;
  timestampIso: string;
  timezone: string;
  route: string;
  user: {
    id: string | null;
    email: string | null;
    organizationId: string | null;
    organizationName: string | null;
    effectiveRole: string | null;
  };
  client: {
    userAgent: string;
    viewport: string;
    devicePixelRatio: number;
  };
  errorDetails: {
    message?: string;
    name?: string;
    code?: string | number;
    status?: number;
    details?: string;
    hint?: string;
    stack?: string;
    validationErrors?: ValidationIssue[];
    cause?: {
      name?: string;
      message?: string;
      code?: string | number;
      status?: number;
    };
  };
  context?: Record<string, unknown>;
}
