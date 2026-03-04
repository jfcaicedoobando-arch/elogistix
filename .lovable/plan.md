

## Plan: Convertir catálogo de puertos en opción configurable

### Problema
Los puertos están hardcodeados en `src/data/ports.ts` (~150 registros). El usuario quiere poder agregar y quitar puertos desde el módulo de Configuración.

### Enfoque
Crear una tabla `puertos` en la base de datos, migrar los puertos existentes como seed, y agregar una pestaña "Puertos" en Configuración con CRUD inline.

### Cambios

**1. Migración SQL** — Crear tabla `puertos`
- Columnas: `id uuid PK`, `code text UNIQUE`, `name text`, `country text`, `activo boolean DEFAULT true`, `created_at timestamptz`
- RLS: lectura para autenticados, CRUD para admins
- INSERT de los ~150 puertos existentes de `ports.ts` como datos iniciales

**2. `src/hooks/usePuertos.ts`** (nuevo)
- Hook `usePuertos()` que hace SELECT de puertos activos ordenados por país, nombre
- Hook `useAdminPuertos()` con mutations para agregar, eliminar y toggle activo

**3. `src/components/PortSelect.tsx`** (modificar)
- Reemplazar import de `ports` hardcodeado por `usePuertos()`
- Misma interfaz visual, solo cambia la fuente de datos

**4. `src/pages/Configuracion.tsx`** (modificar)
- Agregar pestaña "Puertos" con icono `Anchor`
- Tabla con columnas: Código, Nombre, País, Activo (switch)
- Buscador para filtrar la lista
- Formulario inline para agregar nuevo puerto (code, name, country)
- Botón para eliminar puertos

**5. `src/data/ports.ts`** — Se mantiene solo como referencia para el seed SQL, ya no se importa en componentes

**6. `src/pages/Changelog.tsx`** — Entrada v4.9.0 (minor: nueva funcionalidad)

### Notas técnicas
- La tabla usa `activo boolean` en lugar de borrado físico, para no perder historial en cotizaciones que ya referencian un puerto
- El PortSelect solo muestra puertos con `activo = true`
- El seed SQL se genera a partir del array existente en `ports.ts`

