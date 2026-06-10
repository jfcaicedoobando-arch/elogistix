-- Desactivar todos los tipos no canónicos (preservamos histórico)
UPDATE public.tipos_contenedor
SET activo = false
WHERE name NOT IN (
  '20'' Dry (Standard)',
  '40'' Dry (Standard)',
  '45'' High Cube',
  '53'' High Cube (Doméstico)'
);

-- Asegurar que los 4 canónicos estén activos
UPDATE public.tipos_contenedor
SET activo = true
WHERE name IN (
  '20'' Dry (Standard)',
  '40'' Dry (Standard)',
  '45'' High Cube',
  '53'' High Cube (Doméstico)'
);