

# Mostrar nombre del Agente Forwarder en el Portal

## Contexto
El cliente del portal necesita ver el nombre de la empresa que le brinda el servicio de agente aduanal/forwarder (la organización dueña del software). Actualmente solo se muestra el nombre del cliente y su email.

## Plan

### 1. Nuevo hook `usePortalOrgName` en `usePortalData.ts`
Consultar la cadena: `client_users` → `organization_id` → `organizations(nombre)` para obtener el nombre de la organización (forwarder) asociada al cliente logueado.

```typescript
export function usePortalOrgName() {
  return useQuery({
    queryKey: ["portal", "org_name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("client_users")
        .select("organizations(nombre)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.organizations as any)?.nombre ?? null;
    },
  });
}
```

### 2. Actualizar `PortalLayout.tsx`
- Importar `usePortalOrgName`.
- Mostrar el nombre de la organización en el header junto al logo, reemplazando "Portal de Cliente" por el nombre del forwarder (ej: "eLogistiX" o "LibreCarga") seguido de un subtítulo "Portal de Cliente".

### 3. Actualizar `PortalDashboard.tsx`
- Mostrar el nombre del forwarder en el mensaje de bienvenida, ej: "Bienvenido al portal de **eLogistiX**, INDIMEX TRADING".

### 4. Changelog
Nueva entrada con la mejora.

## RLS
No se requieren cambios. La tabla `client_users` ya tiene policy de lectura para el propio usuario, y `organizations` permite lectura a miembros. La relación FK `client_users.organization_id` → `organizations.id` ya existe implícitamente en el schema.

## Archivos a modificar
| Archivo | Cambio |
|---|---|
| `src/hooks/usePortalData.ts` | Nuevo hook `usePortalOrgName` |
| `src/components/portal/PortalLayout.tsx` | Mostrar nombre del forwarder en header |
| `src/pages/portal/PortalDashboard.tsx` | Incluir nombre del forwarder en bienvenida |
| `src/pages/Changelog.tsx` | Nueva entrada |

