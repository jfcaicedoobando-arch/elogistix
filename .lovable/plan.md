## Anchos dinámicos en la tabla de Gestión de Usuarios

### Diagnóstico
Hoy todas las columnas usan **anchos fijos en píxeles** (`w-[220px]`, `w-[240px]`, etc.). Consecuencia:
- En pantallas grandes (≥1600 px) sobra espacio en blanco a la derecha de la tabla.
- En laptops chicas (≤1366 px) el select de "Cambiar rol" queda apretado y empuja el botón de eliminar.
- No se adapta a si el sidebar está colapsado o expandido.

### Estrategia: anchos fluidos con mínimos y máximos

En vez de ancho exacto, cada columna declara **mín / máx / cómo crece**. La columna "Usuario" se queda con el sobrante; las demás son intrínsecas a su contenido.

| Columna       | Antes        | Propuesta                                            | Por qué                                                     |
| ------------- | ------------ | ---------------------------------------------------- | ----------------------------------------------------------- |
| Usuario       | `min-w-[260px]` | `w-auto min-w-[240px] max-w-[480px]`              | Es la columna larga (email) → absorbe el sobrante.          |
| Rol           | `w-[220px]`     | `w-[1%] whitespace-nowrap`                        | Que mida sólo lo que mide el badge más largo.               |
| Fecha registro| `w-[170px]`     | `w-[1%] whitespace-nowrap`                        | Las fechas DD/MM/YYYY son fijas; no necesita extra.         |
| Cambiar rol   | `w-[240px]`     | `w-[1%]` + trigger `w-full min-w-[180px] max-w-[260px]` | El select crece con el viewport pero respeta un mínimo. |
| Acciones      | `w-[50px]`      | igual                                              | Icono.                                                       |

**Cómo funciona `w-[1%] + whitespace-nowrap`:** truco clásico de HTML tables — la columna se encoge a su contenido natural y deja todo el sobrante para las columnas `w-auto`. Es la forma estándar de hacer columnas "shrink-to-fit" en un `<table>`.

### Breakpoints responsivos para densidad

Adicional al fluido, se aplican utilidades de Tailwind para variar tamaños por breakpoint:

- **Avatar**: `h-8 w-8` (default) → `md:h-9 md:w-9` (más visible en monitores grandes).
- **Padding de filas**: la DataTable ya soporta `density="comfortable"`; se mantiene.
- **Select trigger**: `min-w-[160px] sm:min-w-[180px] lg:min-w-[220px]`.

### Cambios concretos

**`usuariosColumns.tsx`** — Reemplazar los `meta.width` fijos por las clases fluidas descritas arriba. El sistema `defineColumns` ya pasa `meta.width` al `<th>`/`<td>` vía className, así que se aceptan utilidades de Tailwind tal cual.

**`Usuarios.tsx`** — La barra superior (buscador + filtro + contador) ya es `flex-col sm:flex-row`, no se toca.

**`appVersion.ts`** — Bump a `13.118.3`.
**`CHANGELOG.md`** — Entrada describiendo el cambio.

### Lo que NO cambia
- Hooks/servicios/RLS.
- Orden jerárquico, tooltips, búsqueda, filtros — todo lo del 13.118.2 sigue igual.
- No se toca la clase `DataTable` compartida; sólo el `meta.width` por columna (es un patrón ya soportado).

### Resultado esperado
- En tu monitor de 1954 px: la columna Usuario se estira ocupando el espacio libre; las demás se quedan compactas pegadas a la derecha.
- En laptop de 1366 px: no aparece scroll horizontal, el select muestra "Coordinador Logístico" completo.
- En tablet (≥768 px): la tabla sigue legible porque cada columna respeta su `min-w`.

### Notas técnicas
- Se asume `meta.width` ya se aplica como `className` al `<th>`/`<td>` (verificado en cambios previos donde funcionaba con `w-[160px]`).
- No se introduce JS para medir viewport — todo es CSS puro, sin reflows extra.
- Se conserva el header `Fecha de registro` con `whitespace-nowrap` para que no parta en dos líneas.
