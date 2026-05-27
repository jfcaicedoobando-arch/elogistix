# Procedimiento de corte GA — 12.0.0

Checklist para el operador humano que ejecuta el corte de `12.0.0-rc.1` → `12.0.0`
una vez que la ventana de validación cierra **sin show-stoppers**.

> Tiempo estimado: 15-20 min · Requiere: acceso a Lovable (Publish) y permisos de edición.

---

## Precondiciones

- [ ] Han transcurrido ≥5 días desde el corte de `12.0.0-rc.1` (ver `CHANGELOG.md`).
- [ ] `docs/rc-qa-checklist.md` §A-§N todas marcadas ✅.
- [ ] `docs/rc-perf.md` con números reales (sin `TODO` / `<pendiente>`).
- [ ] Rollback dry-run ejecutado y documentado en `docs/rc-perf.md §M`.
- [ ] Cero issues críticos abiertos en Sentry de las últimas 72h.

## Paso a paso

### 1. Validar que el gate bloquea correctamente (smoke negativo)

```bash
bash scripts/ga-gate.sh
```

Debe **fallar** en el check #3 (`APP_VERSION` aún es `12.0.0-rc.1`). Si pasa
todos los checks aquí significa que alguien ya bumpeó la versión — investigar
antes de continuar.

### 2. Bump de versión

Editar `src/constants/appVersion.ts`:

```ts
export const APP_VERSION = "12.0.0";
```

### 3. Actualizar CHANGELOG.md

Insertar **arriba** de `## [12.0.0-rc.1]`:

```md
## [12.0.0] - <DD-MM-AAAA del corte>
- **General Availability.** Corte estable tras ventana RC sin show-stoppers.
  Sin cambios funcionales vs `12.0.0-rc.1` (solo bump de versión).
  Resumen de la línea 12.x: ver `docs/release-notes-12.0.md`.
```

> Importante: NO copiar los bullets de rc.1; la GA es solo el sello.
> Quien quiera ver el detalle de qué cambió va a la entrada `[12.0.0-rc.1]`.

### 4. Limpiar release notes

En `docs/release-notes-12.0.md`:
- Quitar `rc.1` del encabezado y de la fecha.
- Cambiar "ventana de 5-7 días" por "liberado el `<DD/MM/AAAA>`".

### 5. Re-ejecutar el gate (smoke positivo)

```bash
bash scripts/ga-gate.sh
```

Ahora **debe pasar todos los checks**. Si algún check falla, NO publicar:
resolver primero y volver a ejecutar.

### 6. Publish

- Click en **Publish → Update** desde el editor de Lovable.
- Confirmar que `https://elogistix.lovable.app` muestra `12.0.0` en el sidebar.

### 7. Comunicado interno

- Copiar `docs/templates/ga-announcement.md`, rellenar `<…>`, enviar al canal correspondiente.
- Activar banner de "Nueva versión disponible" en el sidebar (si aplica).

### 8. Ventana de hipercuidado — 48h

Monitorear durante 48h, con revisión cada 4-6h:

- **Sentry**: filtrar por release `12.0.0`, alertar si aparece cualquier issue nuevo de severidad ≥ error.
- **Bitácora**: `select count(*) from bitacora_actividad where severidad='error' and created_at > now() - interval '4 hours'`.
- **Realtime channels**: ver `supabase.removeChannel` cleanups en consola del browser (no debe haber leaks).
- **Soporte**: tickets nuevos con etiqueta `12.0.0`.

Si aparece un show-stopper en estas 48h → ejecutar rollback documentado en
`docs/operations.md §9.4`.

## Cierre

Pasadas las 48h sin incidencias críticas:

- [ ] Marcar GA como exitosa en `docs/release-notes-12.0.md`.
- [ ] Abrir milestone `12.1.0` y mover backlog diferido (CC 13-15, casts MEDIUM).
- [ ] Archivar `docs/rc-qa-checklist.md` como `docs/archive/rc-qa-12.0.0.md`.
