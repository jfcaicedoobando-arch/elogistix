# Comunicado de Release — Libre Carga 12.0.0

> Plantilla en español (es-MX). Reemplazar `<…>` antes de enviar.
> Canales sugeridos: correo a usuarios activos + post en el espacio interno + banner en el sidebar (24h).

---

**Asunto:** Libre Carga 12.0.0 — Nueva versión estable disponible

**Fecha de corte:** `<DD/MM/AAAA>`
**Versión anterior:** 11.71.0
**Versión nueva:** 12.0.0

---

## Resumen ejecutivo

Hoy liberamos **Libre Carga 12.0.0**, la nueva versión estable de la plataforma. Es el resultado de varias semanas de auditoría arquitectónica, refuerzo de seguridad y limpieza de deuda técnica. No requiere ninguna acción de tu parte: los cambios se aplican automáticamente al refrescar la aplicación.

## Lo nuevo desde la 11.x

- **Seguridad reforzada**: los accesos a auditoría, bitácora y tracking ahora respetan estrictamente el perfil y la organización del usuario.
- **Rendimiento y estabilidad**: paginación auditada en todas las listas críticas (0 hallazgos de riesgo), límites defensivos en reportes pesados.
- **Calidad del código**: 770 pruebas automáticas en verde, componentes acotados (≤200 líneas), cleanup obligatorio en suscripciones realtime.
- **Documentación operativa**: nueva política de Release Candidate, checklist de QA y procedimiento de rollback documentado en `docs/operations.md §9`.

## Cambios de seguridad relevantes

- Endurecimiento de permisos en módulos administrativos. Si tu rol es **viewer** o **cliente del portal** y antes veías datos de auditoría/tracking, ahora dejarán de aparecer — esto es intencional.
- Cambios sin impacto para roles **admin**, **operador** y **super_admin**.

## ¿Qué necesitas hacer?

**Nada.** Refresca la pestaña (Ctrl+R / Cmd+R) la próxima vez que abras la app. Si ves la versión `12.0.0` en el sidebar, ya estás al día.

## Ventana de hipercuidado (48h)

Durante las próximas **48 horas** monitoreamos errores y telemetría con prioridad alta. Si detectas cualquier comportamiento extraño:

- Reporta a: `<correo / canal de soporte>`
- Incluye: captura de pantalla, ruta (`/embarques`, `/portal`, …), hora aproximada y rol del usuario.

Gracias por usar Libre Carga.

— Equipo Libre Carga
