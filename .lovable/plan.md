# Evaluación RC — Libre Carga 11.70.0

## ¿Estamos en estándar RC?

**Casi.** Técnicamente la baseline está en muy buen estado, pero un RC verdadero exige *code freeze* + validación externa + plan de rollback documentado, y eso aún no lo tenemos formalizado. Resumen:

| Criterio RC | Estado | Comentario |
|---|---|---|
| Tests automatizados verdes | ✅ | 770/770, 119 suites |
| 0 `any`, 0 casts HIGH/CRITICAL | ✅ | Power of 10 baseline |
| Arquitectura sin imports prohibidos / archivos >200 líneas | ✅ | Guardrails activos |
| Paginación acotada | ✅ | 0 RISK tras 11.70.0 |
| Complejidad ≤ 15 | ✅ | Umbral 16, deuda opcional |
| Seguridad (RLS, roles, storage) | ⚠️ | No corrimos `security_scan` ni `supabase linter` en esta versión |
| QA manual end-to-end por humano | ❌ | No hay registro de pase manual de los flujos críticos |
| Performance bajo carga realista | ⚠️ | Solo benchmarks de tabla virtual; falta perfil con datos de prod-like |
| Plan de rollback / backup documentado | ⚠️ | Existe `docs/backups-rollback.md`, pero no validado este ciclo |
| Code freeze declarado | ❌ | Sin política escrita (rama RC, criterio de aceptación de PR) |
| Versionado RC (`12.0.0-rc.1`) | ❌ | Seguimos en `11.70.0` semver normal |
| Changelog/release notes para usuarios | ⚠️ | CHANGELOG técnico existe; falta nota de release orientada a usuario |

## Recomendación

Promover a RC en **dos pasos**: primero cerrar los 4 gaps rojos/ámbar, luego cortar `12.0.0-rc.1`.

### Paso 1 — Cierre pre-RC (1 iteración)

1. **Seguridad backend**
   - Correr `supabase--linter` y `security--run_security_scan`.
   - Triagear hallazgos: arreglar HIGH/CRITICAL, documentar ignorados en `@security-memory`.
   - Verificar RLS de tablas nuevas desde 11.60.x (clientes, embarques, CRM, portal).
2. **QA manual estructurado**
   - Crear `docs/rc-qa-checklist.md` con los flujos críticos: login (admin/portal/demo), alta de cliente con CSF, wizard de embarque (FCL+LCL), cotización → embarque → factura, portal cliente, bitácora, configuración global, exportaciones CSV/PDF.
   - Marcar pase/falla por flujo; cualquier falla = bug bloqueante.
3. **Smoke de performance**
   - Cargar dataset realista (≥500 embarques, ≥200 cotizaciones) en Test.
   - Medir tiempos de listado paginado, dashboard dinámico, búsqueda global (Ctrl+K). Documentar en `docs/rc-perf.md`.
4. **Rollback verificado**
   - Releer `docs/backups-rollback.md`, ejecutar un dry-run de restore en Test, anotar resultado.
5. **Política de code freeze**
   - Sección nueva en `docs/operations.md`: durante RC sólo entran fixes de bugs marcados bloqueantes; features nuevas → 12.1.x.
6. **Notas de release usuario-final**
   - Generar `docs/release-notes-12.0.md` (en español MX) destacando: módulos disponibles, limitaciones conocidas, requisitos, contacto soporte.

### Paso 2 — Corte RC

7. Bump `APP_VERSION` → `12.0.0-rc.1`, agregar entrada en `CHANGELOG.md` y `src/pages/Changelog.tsx`.
8. Anunciar ventana de testing (sugerido 5-7 días hábiles).
9. Si en la ventana no hay show-stoppers → `12.0.0` (GA). Si hay fix → `12.0.0-rc.2`, recontar ventana.

## Criterio de aceptación para llamar GA

- 0 bugs abiertos en categoría **bloqueante** o **alta** del checklist QA.
- 0 hallazgos HIGH/CRITICAL del scanner sin ignorar justificado.
- 770/770 tests verdes en el commit congelado.
- Rollback dry-run exitoso documentado.

## Deuda aceptable que NO bloquea RC

- 38 funciones con CC 13-15 (umbral lo permite).
- 421 casts MEDIUM en `lib/mappers/*` (política D16).
- Caps `.limit()` en 6 agregaciones: migrar a RPC cuando se rebasen, no antes.

## Salida de este paso

Si apruebas, en build mode ejecuto el **Paso 1** (seguridad + checklist + perf smoke + freeze policy + release notes) y dejo todo listo para que tú decidas el corte RC.
