DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'agente.demo@librecarga.com';
  v_password text := 'AgenteDemo2026!';
  v_agente_id uuid := 'b0e474db-bd7e-4232-bbf2-f72fd1fa2049';
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      jsonb_build_object('full_name','Agente Demo LONGSAIL'),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text,
      now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_user_id;
  END IF;

  -- user_roles tiene UNIQUE(user_id): un solo rol por usuario
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id) THEN
    UPDATE public.user_roles SET role = 'agente_carga' WHERE user_id = v_user_id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'agente_carga');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.agente_users WHERE user_id = v_user_id AND agente_id = v_agente_id) THEN
    INSERT INTO public.agente_users (user_id, agente_id, organization_id)
    VALUES (v_user_id, v_agente_id, v_org_id);
  END IF;
END $$;