# Estandarizar razón social en MAYÚSCULAS (clientes y proveedores)

Igual que el SAT en la Constancia de Situación Fiscal, la razón social de clientes y proveedores quedará siempre en MAYÚSCULAS. Los nombres de personas de contacto no se tocan.

## Qué cambia para el usuario

- Al capturar o editar un cliente o proveedor, el nombre de la empresa se muestra y se guarda en mayúsculas, sin importar cómo se escriba.
- Los registros ya existentes (11 clientes y 15 proveedores con minúsculas) se convierten de una vez.
- Documentos, PDFs, listados, buscador y correos mostrarán el nombre en mayúsculas automáticamente, porque leen el mismo dato.
- Los acentos se conservan (ACEROS DEL PACÍFICO SA), tal como lo hace el SAT.

## Cómo se garantiza

Tres capas para que nada se cuele:

1. **Base de datos (candado final):** trigger `BEFORE INSERT OR UPDATE` en `public.clientes` y `public.proveedores` que normaliza `nombre` a mayúsculas y colapsa espacios. Aplica también a altas automáticas (conversión de prospecto, conversión de lead CRM, alta desde CSF o desde PDF con IA).
2. **Backfill:** una actualización única de los registros existentes en ambas tablas.
3. **Frontend (que se vea igual que se guarda):** un helper compartido `normalizarRazonSocial` usado en los formularios de alta/edición de cliente y proveedor, y en los datos extraídos de la CSF y del PDF con IA.

## Detalle técnico

- Migración:
  - Función `public._normalizar_razon_social()` (`SECURITY INVOKER`, `search_path = public`): `NEW.nombre := upper(regexp_replace(trim(NEW.nombre), '\s+', ' ', 'g'))`.
  - Triggers `trg_clientes_nombre_mayusculas` y `trg_proveedores_nombre_mayusculas`.
  - Backfill con `UPDATE ... SET nombre = upper(...)` donde difiera.
- Helper nuevo `src/lib/text/razonSocial.ts` con `normalizarRazonSocial(valor: string): string`, más test unitario (espacios, acentos, cadena vacía).
- Aplicarlo en: formulario de alta/edición de proveedor (`useNuevoProveedorController` + patch de CSF), formulario/wizard de cliente (`src/features/cliente`), y en el patch de CSF de cliente.
- Ajustar `normalizarNombreProveedor` no es necesario (ya trabaja en mayúsculas), pero se verifica que el emparejamiento por nombre y los alias sigan funcionando con el test existente.
- `CHANGELOG.md` + `APP_VERSION` (13.416.0).

## Fuera de alcance

- Campos `contacto` de clientes/proveedores y la tabla de contactos del cliente: se quedan con su capitalización actual.
