## v12.14.2 — Hardening del módulo de auditoría

Mitigar los 3 riesgos menores detectados en la revisión end-to-end (sin cambios de comportamiento para el usuario final).

### 1. Marcar cast de RPC como SAFE-CAST
En `src/hooks/auditoria/useAuditoria.ts` (línea ~59), el cast `as ReporteAuditoria` sobre el resultado de la RPC `auditoria_embarques_org` está sin marcar.

- Validar mínimamente el shape antes del cast (verificar que la respuesta sea un objeto con las llaves esperadas: `hallazgos`, `resumen`, etc.).
- Anotar con `// SAFE-CAST:` + breve justificación apuntando a la firma de la RPC, según `mem://principles/safe-cast`.
- Si hay otros casts equivalentes en `src/hooks/auditoria/*` (p. ej. `useAuditoriaEjecutivo`, `useAuditoriaRevisiones`), aplicar el mismo tratamiento.

### 2. Documentar dependencia de columnas legacy de `embarques`
La RPC de auditoría sigue leyendo columnas legacy (`contenedor`, `peso`, `volumen`, `piezas`) que hoy se mantienen vía triggers de compatibilidad multi-contenedor (v12.13+).

- Añadir nota en `docs/auditoria.md` con sección **"Dependencias legacy"**:
  - Qué columnas se leen.
  - Por qué siguen vivas (trigger sync desde `embarque_contenedores`).
  - Qué pasaría si se eliminan (hallazgos de peso/volumen/contenedor quedarían vacíos).
  - Acción futura: migrar la RPC a leer directamente de `embarque_contenedores` cuando se decida eliminar las columnas.
- Registrar este TODO en `mem://audit/pendings` para no perderlo.

### 3. Regenerar reportes de auditoría
`reports/audit-report.md` y `reports/audit-report.json` siguen en v11.68.0.

- Ejecutar `bun run scripts/audit-report.ts` para regenerar contra el estado actual del repo (v12.14.1).
- Commit del resultado para que el baseline refleje la realidad post Fase 6.
- Si el script detecta nuevas violaciones (componentes > 200 líneas introducidos en Fase 6 — sospechosos: `TabFacturacion.tsx`, `embarqueColumns.tsx`), listarlas en el mensaje final pero **no refactorizar en este hotfix**; queda para un próximo ciclo.

### Entregables
1. `useAuditoria.ts` (y hooks hermanos si aplica) con cast marcado + validación mínima.
2. Sección "Dependencias legacy" en `docs/auditoria.md`.
3. Entrada nueva en `mem://audit/pendings`.
4. `reports/audit-report.md` + `reports/audit-report.json` regenerados.
5. `CHANGELOG.md` `## [12.14.2]` + bump `APP_VERSION`.

### Out of scope
- Migrar la RPC para dejar de leer columnas legacy (requiere coordinar con plan de retiro de triggers).
- Refactor de archivos que excedan 200 líneas detectados por el reporte regenerado.
- Cambios funcionales en la UI de auditoría.
