

# Plan: Crear usuario demo con rol Operador para Demo Logistics MX

## Objetivo
Crear una cuenta de usuario demo que se pueda compartir con clientes potenciales para que prueben la app con rol Operador (puede ver, crear y editar pero no acceder a configuración ni gestión de usuarios).

## Pasos

### 1. Crear el usuario vía Edge Function `create-user`
- Email: `demo@demologistica.mx`
- Contraseña: `Demo2026!`
- Rol global: `operador`

La Edge Function ya maneja: creación del usuario en auth, asignación de rol en `user_roles`, y confirmación automática del email.

### 2. Agregar al usuario como miembro de "Demo Logistics MX"
Insertar en `organization_members` con:
- `user_id`: el ID retornado por la Edge Function
- `organization_id`: `05ac6723-1b76-47ba-8f64-2f70a82e77a3`
- `role`: `operador`

### 3. Verificar acceso
Iniciar sesión con las credenciales demo en el preview para confirmar que:
- Se puede acceder al Dashboard, Embarques, Clientes, Cotizaciones
- Se pueden crear y editar registros
- No se puede acceder a Configuración ni Usuarios (restringido para Operador)

## Credenciales resultantes
| Campo | Valor |
|-------|-------|
| URL | https://elogistix.lovable.app |
| Email | demo@demologistica.mx |
| Contraseña | Demo2026! |
| Rol | Operador |
| Organización | Demo Logistics MX |

