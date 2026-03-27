

## Plan: Rebranding de Elogistix a Libre Carga

Renombrar toda la plataforma de "Elogistix" / "Elogistix Shipping" a **"Libre Carga"** en todos los archivos afectados, generar un nuevo logo SVG y actualizar favicon.

---

### 1. Generar logo SVG nuevo

Crear `src/assets/librecarga-logo.svg` — un logo limpio con un ícono de carga/logística estilizado y el texto "Libre Carga". Colores basados en la paleta actual (azul marino #1B2B4B, azul eléctrico #2563EB). También copiar al directorio `public/` para favicon.

### 2. Actualizar referencias en archivos

| Archivo | Cambio |
|---------|--------|
| `index.html` | Title, meta tags, OG tags, favicon → librecarga-logo.svg |
| `src/components/AppSidebar.tsx` | Import del logo, texto "Libre Carga" |
| `src/components/admin/AdminSidebar.tsx` | Texto "Libre Carga — Super Admin" |
| `src/pages/Login.tsx` | Import del logo, texto "Libre Carga" |
| `src/lib/cotizacionPdf.ts` | Footer "Libre Carga" |
| `src/components/cliente/NuevoClienteDialog.tsx` | "Contrato de servicios con Libre Carga" |
| `src/components/admin/TabPlataforma.tsx` | Placeholder y default "Libre Carga" |
| `src/pages/Changelog.tsx` | Actualizar menciones históricas + nueva entrada v6.4.0 |

### 3. Eliminar assets antiguos

- Eliminar `src/assets/elogistix-logo.jpg`
- Eliminar `public/elogistix-logo.jpg` (si existe, referenciado en index.html)

### 4. Changelog

Agregar entrada v6.4.0: "Rebranding completo de la plataforma a Libre Carga"

---

### Detalles del logo SVG

Logo minimalista: ícono de contenedor/carga estilizado + tipografía "Libre Carga" en Inter/sans-serif. Funciona en fondo oscuro (sidebar) y claro (login). Formato SVG para escalabilidad perfecta.

