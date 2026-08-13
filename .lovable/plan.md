# Corregir "Error al crear usuario" (mensaje genérico que oculta la causa real)

## Qué pasó realmente

La bitácora del backend del intento de las 13:17 (hora CDMX) muestra la causa exacta:

```text
user-management · auth_create_failed · status 400
error: "Unable to validate email address: invalid format"
```

Es decir: el servicio de identidad rechazó el **formato del correo** capturado. No fue una
caída del servicio en la nube ni un problema de permisos.

El problema de producto es doble:

1. El backend sí devuelve el motivo, pero el frontend lo pierde: al invocar una función
   de nube que responde con error, la librería entrega el texto genérico
   "Edge Function returned a non-2xx status code", y eso se muestra como
   "El servicio en la nube rechazó la solicitud. Intenta de nuevo en unos minutos".
   El usuario reintenta en vano porque nunca se le dice que el correo es inválido.
2. La validación del formulario es más laxa que la del servicio de identidad: acepta
   correos que el proveedor luego rechaza (por ejemplo con acentos/caracteres no ASCII,
   dominio sin extensión válida, punto final, o espacios internos). El error se descubre
   tarde, después del alta.

## Qué se va a corregir

### 1. Mostrar el motivo real de cualquier error de las funciones de nube

En la capa que invoca `user-management` (alta e invitación de usuarios), leer el cuerpo de
la respuesta de error y usar ese texto como mensaje. Si el motivo es de correo inválido,
traducirlo a un mensaje en español mexicano y accionable:

- "El correo electrónico no tiene un formato válido. Revísalo y vuelve a intentarlo."

Se conserva el mensaje genérico sólo cuando realmente no hay cuerpo legible (caída de red).

### 2. Endurecer la validación del correo en el diálogo de alta

Alinear la validación del formulario con lo que acepta el servicio de identidad
(sólo ASCII, dominio con extensión de 2+ letras, sin puntos consecutivos ni al final) y
normalizar el correo (recortar espacios, minúsculas) antes de validar, no sólo antes de
enviar. Así el error aparece bajo el campo, al instante, en lugar de fallar al guardar.

### 3. Mismo mensaje claro en el resto de acciones de usuarios

Aplicar la misma extracción de motivo a las demás acciones del módulo de usuarios
(invitar, eliminar, restablecer contraseña), que hoy comparten el mismo texto genérico.

## Verificación

- Intento con un correo inválido: el diálogo marca el campo antes de enviar; si el
  servicio lo rechaza, el aviso dice el motivo real, no "intenta de nuevo en unos minutos".
- Intento con un correo válido: el alta sigue funcionando (membresía y rol asignados).
- Correo duplicado: sigue mostrando el mensaje específico de cuenta ya existente.

## Detalle técnico

- `src/features/admin/services/usuario/mutaciones.alta.ts`: al recibir `res.error`,
  extraer el cuerpo con `error.context` (`FunctionsHttpError`) y usar `body.error`;
  mapear el patrón `Unable to validate email address` a mensaje en español.
- Extraer ese lector a un helper compartido (p. ej. `mutaciones.errores.ts`) reutilizado
  por `mutaciones.ts` y `mutaciones.auth.ts`, respetando el límite de 200 líneas.
- `src/features/admin/components/usuario/NuevoUsuarioDialog.tsx`: regex de correo más
  estricta y normalización previa; sin cambios de diseño visual.
- Pruebas nuevas en `src/features/admin/services/usuario/__tests__/`: motivo real
  propagado, mapeo del error de correo inválido y fallback cuando no hay cuerpo.
- `supabase/functions/user-management/createHandler.ts` ya devuelve el motivo; no requiere
  cambios de lógica.
- Actualizar `APP_VERSION` y `CHANGELOG.md`.
