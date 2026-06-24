DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'agente.demo@librecarga.com';
  v_password text := 'AgenteDemo2026!';
  v_agente_id uuid := 'b0e474db-bd7e-4232-bbf2-f72fd1fa2049';
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_cols text := '';
  v_vals text := '';
  v_candidates text[][] := ARRAY[
    -- [columna, expresión SQL ya formateada]
    ['id',                    quote_literal('__PLACEHOLDER__')],  -- se reemplaza abajo
    ['aud',                   quote_literal('authenticated')],
    ['role',                  quote_literal('authenticated')],
    ['email',                 quote_literal(v_email)],
    ['encrypted_password',    format('crypt(%L, gen_salt(%L))', v_password, 'bf')],
    ['email_confirmed_at',    'now()'],
    ['created_at',            'now()'],
    ['updated_at',            'now()'],
    ['raw_app_meta_data',     format('%L::jsonb', jsonb_build_object('provider','email','providers',ARRAY['email'])::text)],
    ['raw_user_meta_data',    format('%L::jsonb', jsonb_build_object('full_name','Agente Demo LONGSAIL')::text)],
    ['instance_id',           quote_literal('00000000-0000-0000-0000-000000000000')],
    ['confirmation_token',    ''''''],
    ['recovery_token',        ''''''],
    ['email_change_token_new',''''''],
    ['email_change',          '''''']
  ];
  v_i int;
  v_col text;
  v_val text;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users no existe; se omite seed del agente demo.';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    -- Construir INSERT dinámico: sólo columnas que realmente existen en
    -- auth.users (CI usa stub mínimo; prod tiene el esquema completo de GoTrue).
    FOR v_i IN 1 .. array_length(v_candidates, 1) LOOP
      v_col := v_candidates[v_i][1];
      v_val := v_candidates[v_i][2];
      IF v_col = 'id' THEN
        v_val := quote_literal(v_user_id::text);
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='auth' AND table_name='users' AND column_name=v_col
      ) THEN
        IF v_cols <> '' THEN v_cols := v_cols || ', '; v_vals := v_vals || ', '; END IF;
        v_cols := v_cols || quote_ident(v_col);
        v_vals := v_vals || v_val;
      END IF;
    END LOOP;

    EXECUTE format('INSERT INTO auth.users (%s) VALUES (%s)', v_cols, v_vals);

    -- auth.identities sólo existe con el esquema GoTrue completo.
    IF to_regclass('auth.identities') IS NOT NULL THEN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email', v_user_id::text,
        now(), now(), now()
      );
    END IF;
  ELSE
    -- En CI el stub no tiene encrypted_password; actualizamos solo lo que exista.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='auth' AND table_name='users' AND column_name='encrypted_password') THEN
      EXECUTE format(
        'UPDATE auth.users SET encrypted_password = crypt(%L, gen_salt(%L)), '
        'email_confirmed_at = COALESCE(email_confirmed_at, now()), updated_at = now() '
        'WHERE id = %L', v_password, 'bf', v_user_id
      );
    END IF;
  END IF;

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
