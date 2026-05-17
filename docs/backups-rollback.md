# Backups y plan de rollback

Documento operativo del Bloque 1 (estabilidad). Audiencia: super_admin de Libre Carga. Última revisión: 2026-05-17 (v8.178.0).

---

## 1. Qué se respalda

| Capa | Mecanismo | Retención | Responsable |
|------|-----------|-----------|-------------|
| Base de datos Postgres (esquema `public`) | Snapshots automáticos diarios de Lovable Cloud (PITR) | 7 días point-in-time + snapshots diarios | Lovable Cloud (automático) |
| Storage (documentos clientes, CSF, comprobantes) | Replicación interna de Lovable Cloud | Indefinida mientras el bucket exista | Lovable Cloud (automático) |
| Código y migraciones | Git en el repositorio del proyecto | Historial completo | Equipo dev |
| Configuración de auth (HIBP, providers, plantillas) | Estado en Cloud, exportable manualmente | N/A | super_admin |
| Secretos (`LOVABLE_API_KEY`, `JSONCARGO_TOKEN`, etc.) | Bóveda de secretos de Lovable Cloud | Mientras estén configurados | super_admin |

**Lo que NO se respalda automáticamente:**

- Variables de entorno locales del equipo.
- Exportaciones contables ya descargadas por el contador (es problema del receptor).
- Logs de `app_logs` con más de 30 días (purga programada).

---

## 2. Cadencia y verificación

- **Snapshots de DB:** Lovable Cloud ejecuta diariamente. No requieren acción manual.
- **Verificación trimestral (super_admin):**
  1. Entrar a Cloud → Database → Backups.
  2. Confirmar que existe snapshot del día anterior.
  3. Ejecutar `scripts/db/health-check.sql` contra producción y guardar el output con fecha en `/docs/backups-verificacion/`.
- **Verificación post-migración mayor:** después de cualquier cambio en el esquema marcado como `major`, repetir health-check inmediatamente y a las 24 h.

---

## 3. Procedimiento de restore

### 3.1. Restore puntual de una tabla (sin downtime)

Útil cuando alguien borró por error filas concretas (ej. un cliente, un embarque).

1. super_admin abre Cloud → Database → SQL editor.
2. Identifica el rango temporal del incidente con `app_logs` o `bitacora_actividad`.
3. Pide a Lovable Cloud un PITR de lectura (read-only branch) en `T - 5 min` del incidente.
4. Copia las filas afectadas con `INSERT INTO ... SELECT FROM cloud_branch.public.tabla WHERE ...`.
5. Registra el evento en `bitacora_actividad` con `accion='restore_puntual'`.

### 3.2. Restore total (rollback de base de datos completo)

Sólo si una migración corrupta o un borrado masivo dejó la DB inutilizable.

1. **Detener tráfico:** desactivar logins en Cloud → Auth → Settings → `disable_signup=true` y avisar al equipo por canal interno.
2. **Snapshot del estado actual** antes de tocar nada (por si se necesita forense).
3. Cloud → Database → Backups → seleccionar snapshot anterior al incidente → "Restore".
4. Esperar a que `supabase--cloud_status` reporte `ACTIVE_HEALTHY`.
5. Correr health-check y comparar contra el output de la última verificación trimestral.
6. Reactivar logins.
7. Anunciar restablecimiento + ventana de datos perdidos.

**Tiempo estimado de un restore total:** 15–40 minutos según tamaño.

### 3.3. Rollback de despliegue (sin tocar DB)

Cuando el código nuevo causa errores pero la DB está sana.

1. Lovable → historial de versiones → seleccionar el commit estable previo → "Restore to this version".
2. Verificar `APP_VERSION` esperado en `/admin/diagnostico → Salud`.
3. Si el rollback de UI requirió revertir una migración, ejecutarlo manualmente con una migración inversa nueva (nunca borrar migraciones del histórico).

### 3.4. Rollback de migración SQL

Las migraciones son inmutables. Para revertir:

1. Crear una **nueva** migración que deshaga el cambio (ej. `DROP COLUMN` si la anterior hizo `ADD COLUMN`).
2. Probar contra ambiente de prueba antes de aplicar a producción.
3. Registrar en changelog (`type: patch`) con referencia al incidente.

---

## 4. Plan de comunicación

| Severidad | Canal | Tiempo de aviso |
|-----------|-------|-----------------|
| Restore puntual sin impacto a usuarios | Bitácora interna | Mismo día |
| Restore total / downtime <15 min | Canal interno + alerta en sidebar | Antes de iniciar |
| Restore total / downtime >15 min | Canal interno + email a contactos clave de clientes | 30 min antes si es planeado, inmediato si es reactivo |
| Pérdida confirmada de datos | Email formal con ventana exacta y datos afectados | Dentro de 24 h |

---

## 5. Roles y responsables

- **super_admin (rol global):** ejecuta restores, declara incidentes, autoriza rollbacks.
- **admin de organización:** reporta incidentes a super_admin, no tiene permisos de restore.
- **Desarrollo:** prepara migraciones inversas y rollbacks de código.

Lista de contactos vive fuera de este documento (canal interno del equipo) para no acoplar info sensible al repo.

---

## 6. Checklist rápido de incidente

```
[ ] 1. Confirmar incidente (revisar /admin/diagnostico → Alertas y Salud)
[ ] 2. Clasificar severidad (puntual / total / sólo deploy)
[ ] 3. Avisar al equipo por canal interno
[ ] 4. Snapshot del estado actual antes de actuar
[ ] 5. Ejecutar procedimiento de la sección 3 correspondiente
[ ] 6. Validar con health-check y revisar /admin/diagnostico
[ ] 7. Reactivar tráfico
[ ] 8. Postmortem breve en bitacora_actividad + entrada en Changelog si aplica
```

---

## 7. Pendientes (futuro)

- Automatizar export semanal de snapshot a almacenamiento externo (S3 frío) — fuera de alcance del Bloque 1.
- Runbook ejecutable por línea de comandos para restores puntuales frecuentes.
- Simulacro de restore total trimestral en ambiente de staging.
