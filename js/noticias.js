// Página de lectura de una noticia: noticia.html?slug=titulo-noticia  (o ?id=123)
(function () {
  "use strict";

  var contenedor = document.getElementById("articulo");

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function obtenerClaseTag(categoria) {
    if (!categoria) return "futbol-red";
    var cat = categoria.toLowerCase();
    if (cat.includes("fútbol") || cat.includes("futbol")) return "futbol";
    if (cat.includes("baloncesto") || cat.includes("basket")) return "baloncesto";
    if (cat.includes("atletismo")) return "atletismo";
    return "futbol-red";
  }

  // Ej: 22 de octubre de 2026
  function formatearFecha(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  function actualizarFechaHoy() {
    var el = document.getElementById("fecha-hoy");
    if (!el) return;
    var f = new Date().toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    el.textContent = f.charAt(0).toUpperCase() + f.slice(1);
  }

  // Si el contenido guardado es HTML se muestra tal cual;
  // si es texto plano, cada bloque separado por línea en blanco pasa a ser un párrafo.
  function prepararContenido(contenido) {
    var txt = contenido || "";
    if (/<\/?[a-z][\s\S]*>/i.test(txt)) return txt;
    return txt.split(/\n{2,}/).map(function (p) {
      return "<p>" + escapeHtml(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function mostrarMensaje(titulo, detalle) {
    document.title = titulo + " | Latinos en Pelota";
    contenedor.innerHTML =
      '<div class="estado">' +
        "<h1>" + titulo + "</h1>" +
        "<p>" + detalle + "</p>" +
        '<a class="volver" href="index.html">Volver a las noticias</a>' +
      "</div>";
  }

  function pintarNoticia(n) {
    var categoria = n.categorias ? n.categorias.nombre : "General";
    var fecha = formatearFecha(n.publicado_en);

    document.title = n.titulo + " | Latinos en Pelota";

    contenedor.innerHTML =
      '<article class="noticia">' +
        '<span class="tag ' + obtenerClaseTag(categoria) + '">' + escapeHtml(categoria.toUpperCase()) + "</span>" +
        "<h1>" + escapeHtml(n.titulo) + "</h1>" +
        (n.subtitulo ? '<p class="subtitulo">' + escapeHtml(n.subtitulo) + "</p>" : "") +
        '<div class="byline">Redacción' + (fecha ? " · " + fecha : "") + "</div>" +
        (n.imagen_url
          ? '<figure class="portada"><img src="' + escapeHtml(n.imagen_url) + '" alt="' + escapeHtml(n.titulo) + '" onerror="this.parentNode.style.display=\'none\'"></figure>'
          : "") +
        '<div class="contenido">' + prepararContenido(n.contenido) + "</div>" +
      "</article>";
  }

  async function cargarNoticia() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("slug");
    var id = params.get("id");

    if (!slug && !id) {
      mostrarMensaje("Falta la noticia", "El enlace no indica qué noticia abrir.");
      return;
    }

    var cliente = window.supabase;
    if (!cliente || typeof cliente.from !== "function") {
      mostrarMensaje("No pudimos conectar", "Recarga la página para intentarlo de nuevo.");
      return;
    }

    try {
      var consulta = cliente
        .from("noticias")
        .select("id, slug, titulo, subtitulo, contenido, imagen_url, publicado_en, categorias(nombre)")
        .eq("estado", "publicado");

      consulta = slug ? consulta.eq("slug", slug) : consulta.eq("id", id);

      var respuesta = await consulta.maybeSingle();
      if (respuesta.error) throw respuesta.error;

      if (!respuesta.data) {
        mostrarMensaje("Noticia no encontrada", "Puede que se haya despublicado o que el enlace esté incompleto.");
        return;
      }

      pintarNoticia(respuesta.data);
    } catch (err) {
      console.error("Error cargando la noticia desde Supabase:", err);
      mostrarMensaje("No pudimos cargar la noticia", "Revisa tu conexión e inténtalo de nuevo.");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    actualizarFechaHoy();
    cargarNoticia();
  });
})();