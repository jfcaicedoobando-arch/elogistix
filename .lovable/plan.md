## Errores Sentry (últimos 7 días)

5 issues abiertos. 4 ya están arreglados en código pero siguen abiertos en Sentry. 1 es un bug real vigente en producción.

---

### 🐛 Bug real: `JAVASCRIPT-REACT-1M` — check constraint `proveedores_categoria_check` (57 eventos, 8 usuarios)

**Causa raíz**: incoherencia entre la validación del formulario y el CHECK de la BD.

- BD (`proveedores_categoria_check`) exige: `categoria='Logistico' → tipo IS NOT NULL`.
- Formulario (`useNuevoProveedorController.ts`, línea 71-72): sólo requiere `tipo` cuando el proveedor es **extranjero**. Para proveedores **nacionales** con categoría Logístico, `tipo` queda `null` → INSERT explota con `23514`.

**Fix (código)**: en `useNuevoProveedorController.ts`, exigir `tipo` para todo Logístico (nacional y extranjero) y marcar el campo como obligatorio en la UI de `NuevoProveedor` cuando `categoria === "Logistico"`. Es la corrección menos invasiva y respeta la intención del constraint (todo logístico tiene un tipo operativo).

Alternativa descartada: relajar el CHECK de la BD — introduciría proveedores logísticos "sin tipo" que rompen filtros y catálogos aguas abajo.

---

### ✅ Ya arreglados en código — sólo cerrar en Sentry

Todos son regresiones fiscales resueltas en releases previos (`13.300.56`–`13.300.60`); siguen `unresolved` porque nunca se marcaron:

| Issue | Título | Fix aplicado en |
|---|---|---|
| `JAVASCRIPT-REACT-2J` | `"serie" is not allowed` | 13.300.56 (renombrado a `series`) |
| `JAVASCRIPT-REACT-2K` | `"related" is not allowed` | 13.300.57 (`related_documents[]`) |
| `JAVASCRIPT-REACT-2M` | `La factura sustituta aún no está timbrada` | 13.301.3 (guard UI + refetch) |
| `JAVASCRIPT-REACT-2N` | `CancelacionSAT no está disponible` | 13.300.60 (reintentar + mensaje) |

Acción: `update_issue` → `status: resolved` para los 4, referenciando el `APP_VERSION` correspondiente.

---

### Entregables

1. **Fix bug proveedores nacionales logísticos**
   - `src/features/proveedor/hooks/useNuevoProveedorController.ts`: quitar el `esExtranjero &&` de la validación de `tipo`; asegurar que `isValid` sea `false` si Logistico sin tipo.
   - `src/features/proveedor/routes/NuevoProveedor.tsx` (o el componente que renderiza el Select de tipo): mostrar el campo `tipo` también para nacionales y marcarlo como requerido cuando `categoria === "Logistico"`.
   - Test unitario en `src/features/proveedor/services/__tests__/proveedor.test.ts` (o hook test nuevo) cubriendo el caso nacional + Logistico.

2. **Cerrar Sentry**: `update_issue` sobre los 4 issues fiscales con nota apuntando al release y al CHANGELOG.

3. **Housekeeping**: bump `APP_VERSION` → `13.301.8` y entrada en `CHANGELOG.md` referenciando `JAVASCRIPT-REACT-1M`.
