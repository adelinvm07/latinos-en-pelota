BEGIN;

CREATE OR REPLACE FUNCTION public.listar_usuarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Se requieren permisos de administrador.' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth.users AS u
        WHERE u.id = auth.uid() AND u.raw_app_meta_data ->> 'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'Se requieren permisos de administrador.' USING ERRCODE = '42501';
    END IF;

    RETURN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'rol', CASE WHEN u.raw_app_meta_data ->> 'role' = 'admin' THEN 'admin' ELSE 'user' END
        ) ORDER BY u.email, u.id), '[]'::jsonb)
        FROM auth.users AS u
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_rol_usuario(p_usuario_id uuid, p_rol text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Se requieren permisos de administrador.' USING ERRCODE = '42501';
    END IF;

    -- Serializa los cambios de rol para impedir dos bajas del último administrador.
    PERFORM pg_catalog.pg_advisory_xact_lock(901726, 1);

    IF NOT EXISTS (
        SELECT 1 FROM auth.users AS u
        WHERE u.id = auth.uid() AND u.raw_app_meta_data ->> 'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'Se requieren permisos de administrador.' USING ERRCODE = '42501';
    END IF;

    IF p_rol IS NULL OR p_rol NOT IN ('admin', 'user') THEN
        RAISE EXCEPTION 'El rol debe ser admin o user.' USING ERRCODE = '22023';
    END IF;

    IF p_rol = 'user' AND p_usuario_id = auth.uid() AND NOT EXISTS (
        SELECT 1 FROM auth.users AS u
        WHERE u.id <> p_usuario_id AND u.raw_app_meta_data ->> 'role' = 'admin'
    ) THEN
        RAISE EXCEPTION 'No puedes quitar el rol al último administrador.';
    END IF;

    UPDATE auth.users AS u
    SET raw_app_meta_data = CASE
        WHEN p_rol = 'admin' THEN COALESCE(u.raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
        ELSE COALESCE(u.raw_app_meta_data, '{}'::jsonb) - 'role'
    END
    WHERE u.id = p_usuario_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la cuenta indicada.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios() FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.cambiar_rol_usuario(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.listar_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cambiar_rol_usuario(uuid, text) TO authenticated;

COMMIT;
