## Detalles técnicos
- Nuevo valor `broker` en `app_role`; membresía broker↔organización con `% comision` por org (tabla propia con GRANT + RLS por `auth.uid()`).
- Vínculo broker en empresa/oportunidad; RLS del broker limita a sus empresas. La búsqueda va por RPC SECURITY DEFINER que devuelve sólo `nombre` y tipo (sin ids sensibles), con límite de resultados y mínimo de caracteres.
- Peticiones: tabla de solicitudes con estados pendiente/autorizada/rechazada; resolución por RPC sólo admin/KAM/gerente_comercial; notificación interna (no correos a clientes).
- Alta de prospecto externo en un solo RPC atómico (empresa + contactos + oportunidad + asignación KAM rotativa con bloqueo para concurrencia).
- Invitación por Edge Function con service role, sólo admin.
- Comisiones: extender el cálculo existente para repartir el % entre broker y KAM sin duplicar la base.
- Rutas `/broker/*` separadas con guard por rol; componentes ≤200 líneas; pruebas focalizadas por regla (búsqueda sin datos, reparto de %, rotación). CHANGELOG/versión sólo con tu autorización.
