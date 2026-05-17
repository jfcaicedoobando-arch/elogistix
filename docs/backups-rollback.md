# Backups y rollback — Quick reference (Bloque 1)

Resumen ejecutivo para super_admin. Para detalle exhaustivo de cada procedimiento, ver **[docs/operations.md](./operations.md)** (runbook completo) y **[docs/security-checklist.md](./security-checklist.md)**.

Última revisión: 2026-05-17 (v8.178.0).

---

## TL;DR

| Recurso | Backup | Retención | Recuperable en |
|---------|--------|-----------|----------------|
| Postgres `public` | Snapshot diario + WAL/PITR (Lovable Cloud) | 7 días | 15–40 min |
| `auditoria_snapshots` | Cron diario 06:00 MX (`auditoria-snapshot-daily`) | 90 días | Inmediato |
| Storage (documentos) | Replicación interna Cloud | Mientras exista el bucket | Inmediato |
| Código / migraciones | Git | Historial completo | Restore en Lovable |
| Configuración auth + secretos | Estado en Cloud | Mientras estén configurados | Manual |

---

## Cuándo usar cada rollback

| Síntoma | Acción | Sección en operations.md |
|---------|--------|--------------------------|
| Filas borradas por error en una tabla | Restore puntual vía PITR a rama de lectura | §3 Restore puntual |
| DB corrupta / borrado masivo / migración rota | Restore total a snapshot anterior | §4 Restore total |
| Bug en el código, DB sana | Restore de versión en Lovable (sin tocar DB) | §5 Rollback de despliegue |
| Migración SQL aplicada por error | Nueva migración inversa (nunca borrar histórico) | §6 Migración inversa |

---

## Checklist rápido de incidente

```
[ ] 1. Revisar /admin/diagnostico → Alertas y Salud
[ ] 2. Clasificar severidad (puntual / total / sólo deploy)
[ ] 3. Avisar al equipo por canal interno
[ ] 4. Snapshot del estado actual antes de actuar
[ ] 5. Ejecutar procedimiento (ver operations.md)
[ ] 6. Validar con scripts/db/health-check.sql
[ ] 7. Reactivar tráfico (si se desactivó)
[ ] 8. Postmortem en bitacora_actividad + entrada en Changelog si aplica
```

---

## Verificación trimestral

1. Cloud → Database → Backups: confirmar snapshot del día anterior.
2. Ejecutar `scripts/db/health-check.sql` y guardar output con fecha.
3. Confirmar que la alerta `app_logs` no muestra picos sin reconocer en `/admin/diagnostico → Alertas`.
4. Verificar que `APP_VERSION` mostrado en sidebar coincide con la versión esperada del último deploy.

---

## Comunicación

| Severidad | Canal | Tiempo de aviso |
|-----------|-------|-----------------|
| Restore puntual sin impacto | Bitácora interna | Mismo día |
| Downtime <15 min | Canal interno + alerta sidebar | Antes de iniciar |
| Downtime >15 min | Canal interno + email a contactos clave | 30 min antes si planeado, inmediato si reactivo |
| Pérdida confirmada de datos | Email formal con ventana y datos afectados | Dentro de 24 h |

---

## Roles

- **super_admin (global):** ejecuta restores, declara incidentes, autoriza rollbacks.
- **admin de organización:** reporta a super_admin, sin permisos de restore.
- **Desarrollo:** prepara migraciones inversas y rollbacks de código.

Contactos del equipo viven fuera del repo (canal interno).

## Simulacro de restore (Sprint A.3 — go-live)

**Frecuencia mínima:** una vez antes del go-live y luego trimestral.

### Checklist del simulacro

1. **Preparación**
   - [ ] Identificar snapshot a restaurar (idealmente <24h de antigüedad).
   - [ ] Crear proyecto sandbox aislado en Lovable Cloud (NO restaurar sobre producción).
   - [ ] Notificar al equipo: "simulacro en curso, ignorar alertas".

2. **Restore**
   - [ ] Ejecutar restore del snapshot al sandbox. Anotar `T0` (inicio) y `T1` (fin).
   - [ ] Verificar conteo de filas en tablas críticas: `embarques`, `facturas`, `conceptos_venta`,
     `conceptos_costo`, `clientes`, `proveedores`, `user_roles`.

3. **Validación de integridad**
   - [ ] `SELECT count(*) FROM embarques WHERE deleted_at IS NULL` coincide con producción ± margen del lag.
   - [ ] Encender la app contra el sandbox, login admin, abrir 5 embarques al azar — todo carga.
   - [ ] Probar 1 RPC crítico: `crear_embarque_completo` (transacción completa).
   - [ ] Validar que las facturas mantienen `snapshot_emision` consistente con `total`.

4. **Métricas**
   - [ ] **RTO real** (T1 - T0): tiempo total de restore. Objetivo < 30 min.
   - [ ] **RPO efectivo**: minutos de datos perdidos = (T_snapshot - T_failure). Objetivo < 60 min.
   - [ ] Registrar resultados en este documento, sección "Histórico de simulacros".

5. **Limpieza**
   - [ ] Eliminar sandbox para no consumir recursos.
   - [ ] Notificar al equipo: "simulacro finalizado, RTO=X, RPO=Y".

### Histórico de simulacros

| Fecha       | RTO  | RPO  | Notas                        | Responsable |
|-------------|------|------|------------------------------|-------------|
| _Pendiente_ | —    | —    | Primer simulacro pre go-live | —           |

### Plan de comunicación durante incidente real

1. Detección → super_admin declara incidente en canal interno.
2. Decisión rollback código vs restore DB (la mayoría son rollback código).
3. Si restore: avisar 15 min antes a usuarios activos vía banner en `/admin/diagnostico`.
4. Post-mortem dentro de las 48h siguientes.
