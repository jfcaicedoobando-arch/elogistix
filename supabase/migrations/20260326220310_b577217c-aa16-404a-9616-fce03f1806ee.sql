-- Update user_roles to super_admin
UPDATE public.user_roles 
SET role = 'super_admin' 
WHERE user_id = '38f502b3-2261-4c0a-ba54-28d90d3ce7a1';

-- Update organization_members to super_admin
UPDATE public.organization_members 
SET role = 'super_admin' 
WHERE user_id = '38f502b3-2261-4c0a-ba54-28d90d3ce7a1';