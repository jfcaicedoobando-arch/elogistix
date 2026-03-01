

## Plan: Suite de tests para validar la funcionalidad de la aplicación — v3.3.1

Crearé tests unitarios y de integración ligera para cubrir las capas más importantes: funciones utilitarias, datos/constantes, y componentes clave. Los hooks que dependen de la base de datos se testearán con mocks de Supabase.

---

### Tests a crear

| Archivo de test | Qué valida |
|---|---|
| `src/lib/__tests__/helpers.test.ts` | `formatDate`, `getEstadoColor`, `getModoIcon` — todos los casos y edge cases |
| `src/lib/__tests__/formatters.test.ts` | `formatCurrency` — MXN, USD, EUR, decimales |
| `src/lib/__tests__/utils.test.ts` | `cn()` — merge de clases Tailwind |
| `src/data/__tests__/embarqueConstants.test.ts` | `getDocsForMode` — documentos por modo, `ESTADO_TIMELINE`, `CONCEPTOS_MARITIMOS` |
| `src/data/__tests__/proveedorConstants.test.ts` | Arrays no vacíos, tipos correctos |
| `src/data/__tests__/containerTypes.test.ts` | Códigos únicos, estructura válida |
| `src/data/__tests__/ports.test.ts` | Códigos únicos, puertos mexicanos presentes |
| `src/data/__tests__/shippingLines.test.ts` | Códigos únicos, estructura válida |
| `src/components/__tests__/BitacoraActividad.test.tsx` | Renderiza actividades, muestra estado vacío, links correctos, `tiempoRelativo` |
| `src/hooks/__tests__/usePermissions.test.tsx` | Retorna `canEdit`/`isAdmin` según rol |

### Qué se valida en cada test

**helpers.ts:**
- `formatDate('')` → `'-'`, fecha normal → `dd/mm/aaaa`, formato incompleto → devuelve tal cual
- `getEstadoColor` → cada estado retorna clase CSS correcta, estado desconocido → default
- `getModoIcon` → cada modo retorna emoji correcto, modo desconocido → 📦

**formatters.ts:**
- MXN formatea con `$`, USD con `US$`, EUR con `€`
- Negativos, cero, decimales

**embarqueConstants.ts:**
- `getDocsForMode('Marítimo')` incluye BL Master
- `getDocsForMode('Aéreo')` incluye AWB
- `getDocsForMode('Terrestre')` incluye Carta Porte
- `getDocsForMode('')` → marítimo por default

**BitacoraActividad.tsx:**
- Sin actividades → muestra "Sin actividad registrada"
- Con actividades → renderiza cada entrada con acción y módulo
- Con `mostrarUsuario=false` → no muestra email
- Link a entidad cuando hay `entidad_id` y módulo con ruta

**usePermissions:**
- admin → `canEdit: true, isAdmin: true`
- operador → `canEdit: true, isAdmin: false`
- viewer → `canEdit: false, isAdmin: false`

---

### Archivos nuevos (10)

```text
src/lib/__tests__/helpers.test.ts
src/lib/__tests__/formatters.test.ts
src/lib/__tests__/utils.test.ts
src/data/__tests__/embarqueConstants.test.ts
src/data/__tests__/proveedorConstants.test.ts
src/data/__tests__/containerTypes.test.ts
src/data/__tests__/ports.test.ts
src/data/__tests__/shippingLines.test.ts
src/components/__tests__/BitacoraActividad.test.tsx
src/hooks/__tests__/usePermissions.test.tsx
```

### Modificados
- `src/pages/Changelog.tsx` — nueva entrada v3.3.1

Después de crear los tests, los ejecutaré automáticamente para verificar que todos pasen.

