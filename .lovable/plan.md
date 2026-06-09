# Republicar frontend

## Objetivo
Desplegar el bundle actual del frontend a `librecarga.com` / `elogistix.lovable.app` para que el módulo de **Gestión de Usuarios** muestre emails en lugar de UIDs en producción.

## Contexto
- El edge function `user-management` ya está en producción y responde `200` con los emails resueltos.
- El frontend publicado es de hace varios días y no invoca el edge function nuevo, por eso renderiza `user_id` crudo.
- Backend desplegado automáticamente; solo falta el "Update" del frontend.

## Pasos
1. Confirmar preflight de metadatos: `index.html` ya tiene title, description, OG, Twitter, JSON-LD, favicon, locale `es_MX` — **already_relevant**.
2. Ejecutar `preview_ui--publish` con `website_info_status=already_relevant`.
3. Confirmar al usuario que la publicación está en curso (~1 min) y pedirle que verifique `/usuarios` en `librecarga.com` una vez termine.

## Notas
- El finding `MISSING_REALTIME_AUTHORIZATION` (RLS en `realtime.messages` para `notificaciones_internas`) es preexistente, ya confirmaste posponerlo. Se atenderá en un cambio aparte.
- No hay cambios de código en este turno — solo redeploy.
