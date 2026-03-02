

## Plan: Autocompletado de puertos para carga marítima y multimodal — v3.11.0

### Alcance

Reemplazar los campos de texto libre de Origen y Destino en la sección Ruta por un componente con autocompletado basado en el catálogo de ~150 puertos, pero solo cuando el modo es Marítimo (FCL/LCL) o Multimodal. Los flujos Aéreo y Terrestre conservan sus campos actuales sin cambios.

### Cambios

#### 1. `src/components/PortSelect.tsx` — Permitir texto libre

Actualmente el componente solo permite seleccionar un puerto del catálogo (guarda el código UN/LOCODE). Se necesita que también permita escribir manualmente si el puerto no está en la lista:

- Cambiar el `value` para guardar el texto completo (ej. "Manzanillo — Manzanillo, México") en vez del código
- Agregar un mensaje en `CommandEmpty` que permita usar el texto escrito tal cual
- Cuando el usuario selecciona un puerto de la lista, se escribe "NombrePuerto — Ciudad, País"
- Cuando escribe texto libre y confirma, se usa ese texto directamente

#### 2. `src/pages/NuevaCotizacion.tsx` — Sección Ruta

Renderizado condicional en la sección Ruta:

- Si `modo` es `Marítimo` o `Multimodal`: usar `PortSelect` para Origen y Destino
- Si `modo` es `Aéreo` o `Terrestre`: mantener los `Input` actuales

Los estados `origen` y `destino` siguen siendo strings, sin cambios en la base de datos.

#### 3. `src/pages/Changelog.tsx` — Entrada v3.11.0

### Archivos modificados
- `src/components/PortSelect.tsx` — soporte texto libre
- `src/pages/NuevaCotizacion.tsx` — renderizado condicional en Ruta
- `src/pages/Changelog.tsx`

