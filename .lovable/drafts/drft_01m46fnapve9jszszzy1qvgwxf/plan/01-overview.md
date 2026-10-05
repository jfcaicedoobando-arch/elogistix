# Pasar la información de Leads y Prospectos a Empresas y Contactos

## Lo que encontré
- **Leads y Prospectos son la misma lista**: Prospectos es solo un filtro de Leads según su etapa. Así que basta con fusionar los Leads.
- Hay **24 leads activos y todos ya tienen su Empresa** creada (25 empresas, 20 contactos). Lo que falta es que la ficha de la empresa y del contacto tenga **todos** los datos que tenía el lead; hoy casi no tienen valores capturados (solo 4).

## Paso 1 — Datos que ya existen en ambos lados (se complementan)
Solo se llena lo que esté **vacío** en la empresa o el contacto; nunca se reescribe un dato que ya se capturó.

| Dato del lead | Dónde queda |
|---|---|
| Empresa | Empresa → Nombre (ya existe) |
| Contacto, Correo, Teléfono | Contacto → Nombre, Correo, Teléfono |
| Cargo del contacto | Contacto → Puesto |
| Fuente | Empresa → Fuente |
| Interés (modo de transporte) | Empresa → Tipo de transporte |
| Rutas | Empresa → Rutas principales |

Si el lead tiene contacto pero la empresa no tiene ninguno ligado, se crea el contacto y se liga a su empresa.
