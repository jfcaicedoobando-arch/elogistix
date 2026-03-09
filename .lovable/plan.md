

## Diagnóstico completo de la Bitácora de Actividad

### Problemas encontrados

**1. Inundación de logins**: De 2,120 registros totales, 2,003 son logins (94%). Los movimientos reales quedan enterrados.

**2. Nombres de acción inconsistentes**: El código registra acciones con nombres que no coinciden con el mapa de íconos/colores del componente visual:

| Acción registrada | Ícono esperado | Resultado |
|---|---|---|
| `cambiar_estado` | `cambio_estado` | Sin ícono |
| `Crear cotización` | `crear` | Sin ícono |
| `editar_cliente` | `editar` | Sin ícono |
| `agregar_nota` | — | Sin ícono |
| `eliminar_documento` | — | Sin ícono |
| `subir_documento` | OK | OK |

**3. Módulos sin tracking**: Varias operaciones no registran actividad:
- **Facturas**: crear, editar, cambiar estado, eliminar — 0 registros
- **Proveedores**: editar, eliminar — 0 registros
- **Cotizaciones**: editar, eliminar, cambiar estado — 0 registros
- **Clientes**: eliminar — 0 registros

**4. Módulo "cotizaciones" mal configurado**:
- Se registra como `"Cotizaciones"` (mayúscula) pero la convención es minúsculas
- No aparece en la lista de filtros de la página Bitácora
- No tiene ruta en `RUTAS_MODULO` para generar links

### Plan de corrección (v4.33.0)

**Archivo 1 — `src/components/BitacoraActividad.tsx`**
- Ampliar `ICONOS_ACCION` con: `cambiar_estado`, `subir_documento`, `eliminar_documento`, `agregar_nota`, `editar_cliente`
- Ampliar `COLORES_ACCION` con los mismos
- Agregar `cotizaciones: "/cotizaciones"` a `RUTAS_MODULO`

**Archivo 2 — `src/pages/Bitacora.tsx`**
- Agregar módulo `cotizaciones` a la lista de filtros
- Filtrar logins por defecto: agregar toggle o excluir `accion: 'login'` del query cuando el filtro es "todos"
- Agregar filtro para excluir/incluir logins

**Archivo 3 — `src/hooks/useBitacora.ts`**
- Agregar parámetro `excluirLogin?: boolean` al filtro
- Cuando está activo, aplicar `.neq('accion', 'login')` al query

**Archivo 4 — `src/hooks/useCotizacionWizardForm.ts`**
- Cambiar `"Crear cotización"` → `"crear"` y `"Cotizaciones"` → `"cotizaciones"`

**Archivo 5 — `src/pages/ClienteDetalle.tsx`**
- Cambiar `'editar_cliente'` → `'editar'`

**Archivo 6 — `src/pages/Facturacion.tsx`**
- Agregar `useRegistrarActividad` para crear/editar/eliminar facturas

**Archivo 7 — `src/pages/Proveedores.tsx`** (y `ProveedorDetalle.tsx` si existe edición)
- Agregar tracking para editar y eliminar proveedores

**Archivo 8 — `src/pages/Changelog.tsx`** — entrada v4.33.0

### Archivos a modificar (8)

1. `src/components/BitacoraActividad.tsx`
2. `src/pages/Bitacora.tsx`
3. `src/hooks/useBitacora.ts`
4. `src/hooks/useCotizacionWizardForm.ts`
5. `src/pages/ClienteDetalle.tsx`
6. `src/pages/Facturacion.tsx`
7. `src/pages/Proveedores.tsx`
8. `src/pages/Changelog.tsx`

