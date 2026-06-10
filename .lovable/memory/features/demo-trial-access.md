---
name: Demo Trial Access
description: Cuenta demo compartida (demo@librecarga.com) que entra como admin de la organización demo con datos sembrados y reset por acceso
type: feature
---
- Botón "Probar demo" (landing Hero, Nav, CTA final) invoca edge function `demo-access`.
- Edge function: provisiona/reutiliza `demo@librecarga.com` (password `demo-libre-carga-2026`, pública por diseño), llama `ensure_demo_membership` y `seed_demo_organization`, devuelve credenciales para signIn automático.
- `ensure_demo_membership(_user_id)` fuerza rol `admin` en `user_roles` (UNIQUE user_id) y en `organization_members` para la org `de100000-0000-0000-0000-000000000001`. **Es admin, no operador**, para que el prospecto vea todos los módulos (finanzas, configuración, usuarios, reportes).
- `seed_demo_organization()` borra y re-siembra clientes, proveedores, contactos, embarques, eventos de tracking y cotizaciones de la org demo. Usa enums con acentos correctos (`Marítimo`, `Aéreo`, `Importación`, `Agente Aduanal`, `Agente de Carga`, `Transportista`, estados `En Tránsito`/`Llegada`/`Entregado`, eventos `Zarpe`/`Arribo a Puerto`/`Entrega`/`Otro`).
- `is_demo_user(_user_id)` → `DemoModeBanner` global muestra banner sticky cuando la sesión pertenece a la org demo.
- Cambios del prospecto son efímeros: la próxima entrada limpia y resiembra.
