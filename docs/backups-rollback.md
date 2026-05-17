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
