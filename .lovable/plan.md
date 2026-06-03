## Cambio

En `src/components/auditoria/HallazgosTabla.tsx` hay **dos botones** "Abrir embarque" que aún usan `navigate(...)` (líneas 52 y 153) — abren en la misma pestaña.

Replicar el patrón que ya usa `HallazgoTabla.tsx` (singular): reemplazar `navigate(...)` por `window.open(URL_absoluta, "_blank", "noopener,noreferrer")` con `e.preventDefault()` + `e.stopPropagation()`.

### Pasos
1. En ambos `onClick` (líneas 52 y 153), cambiar a:
   ```ts
   (e) => {
     e.preventDefault();
     e.stopPropagation();
     window.open(`${window.location.origin}/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`, "_blank", "noopener,noreferrer");
   }
   ```
2. Eliminar el import/uso de `useNavigate` si ya no se usa en otra parte del archivo.
3. Bump `APP_VERSION` → `12.51.7` y entrada en `CHANGELOG.md`.

### Resultado
Los dos botones de abrir embarque en la tabla de hallazgos abren el embarque en una pestaña nueva del navegador, preservando el contexto de auditoría.
