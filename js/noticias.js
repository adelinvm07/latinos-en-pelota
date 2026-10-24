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

    iniciarComentarios(n.id);
  }

  // ---------------------------------------------------------------- Comentarios
  var MIN_AUTOR = 2, MAX_AUTOR = 50, MIN_TEXTO = 2, MAX_TEXTO = 1000;
  var ESPERA_SEGUNDOS = 30; // tiempo mínimo entre comentarios del mismo visitante

  function guardado(clave, valor) {
    try {
      if (valor === undefined) return localStorage.getItem(clave);
      localStorage.setItem(clave, valor);
    } catch (e) { /* almacenamiento no disponible */ }
    return null;
  }

  function fechaComentario(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) +
      ", " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  function iniciarComentarios(noticiaId) {
    var cliente = window.supabase;

    var seccion = document.createElement("section");
    seccion.className = "comentarios";
    seccion.id = "comentarios";
    seccion.innerHTML =
      '<h2>Comentarios<span id="total-comentarios"></span></h2>' +
      '<form id="form-comentario" novalidate>' +
        '<label for="c-autor">Nombre</label>' +
        '<input type="text" id="c-autor" maxlength="' + MAX_AUTOR + '" autocomplete="nickname">' +
        '<label for="c-texto">Tu comentario</label>' +
        '<textarea id="c-texto" maxlength="' + MAX_TEXTO + '"></textarea>' +
        '<div class="c-pie">' +
          '<span id="c-contador">0 / ' + MAX_TEXTO + '</span>' +
          '<button type="submit" id="c-enviar">Publicar comentario</button>' +
        '</div>' +
        '<input type="text" id="c-web" class="c-trampa" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<p id="c-mensaje" role="status" aria-live="polite"></p>' +
      '</form>' +
      '<div id="lista-comentarios"></div>';
    contenedor.appendChild(seccion);

    var form = document.getElementById("form-comentario");
    var inputAutor = document.getElementById("c-autor");
    var inputTexto = document.getElementById("c-texto");
    var contador = document.getElementById("c-contador");
    var boton = document.getElementById("c-enviar");
    var mensaje = document.getElementById("c-mensaje");
    var lista = document.getElementById("lista-comentarios");
    var total = document.getElementById("total-comentarios");

    inputAutor.value = guardado("comentarista") || "";
    avisar("Los comentarios se revisan antes de publicarse.");

    function avisar(texto, tipo) {
      mensaje.textContent = texto;
      mensaje.className = tipo || "";
    }

    inputTexto.addEventListener("input", function () {
      contador.textContent = inputTexto.value.length + " / " + MAX_TEXTO;
    });

    async function cargarLista() {
      var r = await cliente
        .from("comentarios")
        .select("id, autor, contenido, creado_en")
        .eq("noticia_id", noticiaId)
        .eq("estado", "aprobado")
        .order("creado_en", { ascending: false });

      if (r.error) {
        console.error("Error cargando comentarios:", r.error);
        total.textContent = "";
        lista.innerHTML = '<p class="c-vacio">Los comentarios no están disponibles en este momento.</p>';
        form.style.display = "none";
        return;
      }

      var datos = r.data || [];
      total.textContent = datos.length === 1 ? "1 comentario" : datos.length + " comentarios";

      if (datos.length === 0) {
        lista.innerHTML = '<p class="c-vacio">Todavía no hay comentarios. Sé el primero en opinar.</p>';
        return;
      }

      lista.innerHTML = datos.map(function (c) {
        var inicial = escapeHtml((c.autor || "?").trim().charAt(0).toUpperCase());
        return (
          '<article class="comentario">' +
            '<div class="c-avatar" aria-hidden="true">' + inicial + '</div>' +
            '<div class="c-cuerpo">' +
              '<div class="c-cabecera"><strong>' + escapeHtml(c.autor) + '</strong>' +
                '<time datetime="' + escapeHtml(c.creado_en) + '">' + fechaComentario(c.creado_en) + '</time></div>' +
              '<p class="c-texto">' + escapeHtml(c.contenido).replace(/\n/g, "<br>") + '</p>' +
            '</div>' +
          '</article>'
        );
      }).join("");
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Campo trampa: solo los robots lo llenan
      if (document.getElementById("c-web").value) return;

      var autor = inputAutor.value.trim();
      var texto = inputTexto.value.trim();

      if (autor.length < MIN_AUTOR) { avisar("Escribe tu nombre (mínimo " + MIN_AUTOR + " letras).", "error"); inputAutor.focus(); return; }
      if (texto.length < MIN_TEXTO) { avisar("Escribe tu comentario antes de publicarlo.", "error"); inputTexto.focus(); return; }

      var ultimo = Number(guardado("ultimo-comentario")) || 0;
      var faltan = Math.ceil(ESPERA_SEGUNDOS - (Date.now() - ultimo) / 1000);
      if (faltan > 0) { avisar("Espera " + faltan + " segundos para publicar otro comentario.", "error"); return; }

      boton.disabled = true;
      avisar("Publicando...");

      var r = await cliente.from("comentarios").insert({
        noticia_id: noticiaId,
        autor: autor,
        contenido: texto,
        estado: "pendiente"
      });

      boton.disabled = false;

      if (r.error) {
        console.error("Error publicando comentario:", r.error);
        avisar("No pudimos publicar tu comentario. Inténtalo de nuevo.", "error");
        return;
      }

      guardado("comentarista", autor);
      guardado("ultimo-comentario", String(Date.now()));
      inputTexto.value = "";
      contador.textContent = "0 / " + MAX_TEXTO;
      avisar("Gracias. Tu comentario fue enviado y aparecerá cuando un administrador lo apruebe.", "ok");
    });

    cargarLista();
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