import { describe, it, expect } from 'vitest';
import * as auditoria from '../index';

describe('auditoria/index', () => {
  it('exporta todas las funciones necesarias', () => {
    expect(auditoria.fetchReporteAuditoria).toBeDefined();
    expect(auditoria.fetchAuditoriaRevisiones).toBeDefined();
    expect(auditoria.createComentarioAuditoria).toBeDefined();
    expect(auditoria.snoozeRevision).toBeDefined();
    expect(auditoria.fetchAuditoriaSnapshots).toBeDefined();
  });
});
