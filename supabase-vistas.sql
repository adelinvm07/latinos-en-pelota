BEGIN;

DROP VIEW IF EXISTS public.noticias_publicadas;
DROP VIEW IF EXISTS public.categorias_con_conteo_noticias;

CREATE OR REPLACE VIEW public.noticias_publicadas
WITH (security_invoker = true) AS
SELECT n.id, n.slug, n.titulo, n.subtitulo, n.imagen_url,
       n.publicado_en, n.es_destacada, n.categoria_id,
       c.nombre AS categoria_nombre
FROM public.noticias AS n
LEFT JOIN public.categorias AS c ON c.id = n.categoria_id
WHERE n.estado = 'publicado';

CREATE OR REPLACE VIEW public.categorias_con_conteo_noticias
WITH (security_invoker = true) AS
SELECT c.id, c.nombre, count(n.id) AS total_noticias
FROM public.categorias AS c
LEFT JOIN public.noticias AS n ON n.categoria_id = c.id
GROUP BY c.id, c.nombre;

REVOKE ALL ON public.noticias_publicadas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.noticias_publicadas TO anon, authenticated;

REVOKE ALL ON public.categorias_con_conteo_noticias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.categorias_con_conteo_noticias TO authenticated;

CREATE OR REPLACE FUNCTION public.resumen_panel()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Se requieren permisos de administrador.' USING ERRCODE = '42501';
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'publicadas', count(*) FILTER (WHERE estado = 'publicado'),
            'borradores', count(*) FILTER (WHERE estado = 'borrador'),
            'categorias', (SELECT count(*) FROM public.categorias),
            'comentarios', (SELECT count(*) FROM public.comentarios),
            'anuncios_activos', (SELECT count(*) FROM public.anuncios WHERE activo = true)
        )
        FROM public.noticias
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resumen_panel() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resumen_panel() TO authenticated;

COMMIT;
