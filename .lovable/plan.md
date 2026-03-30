

# Plan: Mostrar nombre de organización en el sidebar para todos los usuarios

## Problema
Los usuarios regulares no tienen ninguna indicación visual de a qué organización pertenecen. El `OrgSwitcher` solo se renderiza para super admins con múltiples organizaciones.

## Solución

### 1. Modificar `AppSidebar.tsx`
Importar `useOrganization` y mostrar el nombre de la organización debajo del logo en el header del sidebar, visible para todos los usuarios (no solo super admins).

Cuando el sidebar está expandido, mostrar el nombre de la organización en lugar del texto estático "Agente de Carga" (línea 139). Usar `organization?.nombre` del contexto.

### 2. Ajustar `OrgSwitcher` (opcional)
Mantener el `OrgSwitcher` como está para super admins. La información de org para usuarios regulares será estática (solo lectura) en el header.

## Resultado
- Todos los usuarios ven el nombre de su organización en el sidebar header
- Super admins siguen viendo el dropdown para cambiar entre organizaciones
- No se requieren cambios de base de datos

## Archivos a modificar
- `src/components/AppSidebar.tsx` — reemplazar "Agente de Carga" con el nombre dinámico de la organización
- `src/pages/Changelog.tsx` — entrada v7.4.2

