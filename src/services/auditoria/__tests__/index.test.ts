import { describe, it, expect } from 'vitest';
import * as auditoria from '../index';

describe('auditoria/index', () => {
  it('exporta funciones de reporte y revisiones', () => {
    expect(auditoria.fetchReporteAuditoria).toBeDefined();
    expect(auditoria.fetchAuditoriaRevisiones).toBeDefined();
  });

  it('exporta funciones de comentarios, snooze y snapshots', () => {
    expect(auditoria.insertComentario).toBeDefined();
    expect(auditoria.snoozeRevision).toBeDefined();
    expect(auditoria.fetchAuditoriaSnapshots).toBeDefined();
  });
});
