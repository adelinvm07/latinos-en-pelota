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
        '<a class="volver" href="latinos-en-pelota.html">Volver a las noticias</a>' +
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

    inicializarComentarios(n.id);
  }

  // =========================================================================
  // GESTIÓN DE COMENTARIOS REALES (SUPABASE)
  // =========================================================================
  async function inicializarComentarios(noticiaId) {
    var sesionUsuario = null;
    if (window.supabase && window.supabase.auth) {
      try {
        var { data } = await window.supabase.auth.getSession();
        sesionUsuario = data ? data.session : null;
      } catch (e) {
        console.warn("No se pudo obtener sesión para comentarios:", e);
      }
    }

    var wrap = document.createElement("section");
    wrap.className = "comentarios-wrap";
    wrap.id = "seccion-comentarios";

    var tituloH2 = document.createElement("h2");
    tituloH2.id = "comentarios-titulo";
    tituloH2.textContent = "Comentarios";
    wrap.appendChild(tituloH2);

    var formBox = document.createElement("div");
    formBox.id = "contenedor-form-comentario";
    wrap.appendChild(formBox);

    var listaBox = document.createElement("div");
    listaBox.id = "lista-comentarios";
    wrap.appendChild(listaBox);

    contenedor.appendChild(wrap);

    renderizarFormularioComentario(noticiaId, sesionUsuario, formBox);
    await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);

    if (window.supabase && window.supabase.auth && window.supabase.auth.onAuthStateChange) {
      window.supabase.auth.onAuthStateChange(async function (_evento, nuevaSesion) {
        sesionUsuario = nuevaSesion;
        renderizarFormularioComentario(noticiaId, sesionUsuario, formBox);
        await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);
      });
    }
  }

  function renderizarFormularioComentario(noticiaId, sesionUsuario, formBox) {
    if (!formBox) formBox = document.getElementById("contenedor-form-comentario");
    if (!formBox) return;

    formBox.innerHTML = "";

    if (!sesionUsuario || !sesionUsuario.user) {
      var promptEl = document.createElement("div");
      promptEl.className = "comentarios-login-prompt";
      promptEl.innerHTML = 'Para dejar un comentario, debes <a href="Panel-de-admin.html">iniciar sesión</a>.';
      formBox.appendChild(promptEl);
      return;
    }

    var form = document.createElement("form");
    form.className = "comentario-form";
    form.id = "form-nuevo-comentario";

    var textarea = document.createElement("textarea");
    textarea.placeholder = "Escribe tu comentario sobre esta noticia (máx. 500 caracteres)...";
    textarea.maxLength = 500;
    textarea.required = true;

    var footer = document.createElement("div");
    footer.className = "comentario-form-footer";

    var contador = document.createElement("span");
    contador.className = "comentario-contador";
    contador.textContent = "0 / 500 caracteres";

    textarea.addEventListener("input", function () {
      contador.textContent = textarea.value.length + " / 500 caracteres";
    });

    var btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "btn-comentar";
    btn.textContent = "Publicar Comentario";

    footer.appendChild(contador);
    footer.appendChild(btn);
    form.appendChild(textarea);
    form.appendChild(footer);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var texto = textarea.value.trim();

      if (!texto) {
        alert("El comentario no puede estar vacío.");
        textarea.focus();
        return;
      }
      if (texto.length > 500) {
        alert("El comentario supera los 500 caracteres permitidos.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Publicando...";

      try {
        var user = sesionUsuario.user;
        var autor = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.nombre))
          || (user.email ? user.email.split("@")[0] : "Lector");

        var { error } = await window.supabase
          .from("comentarios")
          .insert([{
            noticia_id: noticiaId,
            user_id: user.id,
            autor: autor,
            contenido: texto
          }]);

        if (error) throw error;

        textarea.value = "";
        contador.textContent = "0 / 500 caracteres";
        var listaBox = document.getElementById("lista-comentarios");
        var tituloH2 = document.getElementById("comentarios-titulo");
        await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);
      } catch (err) {
        console.error("Error al publicar comentario:", err);
        alert("Error al publicar comentario: " + (err.message || "Inténtalo más tarde"));
      } finally {
        btn.disabled = false;
        btn.textContent = "Publicar Comentario";
      }
    });

    formBox.appendChild(form);
  }

  async function cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2) {
    if (!listaBox) listaBox = document.getElementById("lista-comentarios");
    if (!tituloH2) tituloH2 = document.getElementById("comentarios-titulo");
    if (!listaBox) return;

    try {
      var { data: comentarios, error } = await window.supabase
        .from("comentarios")
        .select("id, noticia_id, user_id, autor, contenido, created_at")
        .eq("noticia_id", noticiaId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      var total = comentarios ? comentarios.length : 0;
      if (tituloH2) {
        tituloH2.textContent = "Comentarios (" + total + ")";
      }

      listaBox.innerHTML = "";

      if (!comentarios || comentarios.length === 0) {
        var empty = document.createElement("div");
        empty.className = "sin-comentarios";
        empty.textContent = "Aún no hay comentarios en esta noticia. ¡Sé el primero en opinar!";
        listaBox.appendChild(empty);
        return;
      }

      var currentUser = sesionUsuario ? sesionUsuario.user : null;
      var esAdmin = currentUser && currentUser.app_metadata && currentUser.app_metadata.role === "admin";

      comentarios.forEach(function (c) {
        var itemEl = document.createElement("div");
        itemEl.className = "comentario-item";

        var headerEl = document.createElement("div");
        headerEl.className = "comentario-header";

        var autorEl = document.createElement("span");
        autorEl.className = "comentario-autor";
        autorEl.textContent = c.autor || "Anónimo"; // textContent seguro

        var fechaEl = document.createElement("span");
        fechaEl.className = "comentario-fecha";
        fechaEl.textContent = formatearFecha(c.created_at); // textContent seguro

        headerEl.appendChild(autorEl);
        headerEl.appendChild(fechaEl);
        itemEl.appendChild(headerEl);

        var textoEl = document.createElement("p");
        textoEl.className = "comentario-texto";
        textoEl.textContent = c.contenido; // textContent seguro (evita XSS)
        itemEl.appendChild(textoEl);

        if (currentUser && (currentUser.id === c.user_id || esAdmin)) {
          var accionesEl = document.createElement("div");
          accionesEl.className = "comentario-acciones";

          var btnBorrar = document.createElement("button");
          btnBorrar.className = "btn-borrar-comentario";
          btnBorrar.textContent = "Eliminar";
          btnBorrar.onclick = async function () {
            if (!confirm("¿Deseas eliminar este comentario?")) return;
            btnBorrar.disabled = true;
            try {
              var { error: delError } = await window.supabase
                .from("comentarios")
                .delete()
                .eq("id", c.id);

              if (delError) throw delError;

              await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);
            } catch (err) {
              console.error("Error al eliminar comentario:", err);
              alert("Error al eliminar comentario: " + err.message);
              btnBorrar.disabled = false;
            }
          };

          accionesEl.appendChild(btnBorrar);
          itemEl.appendChild(accionesEl);
        }

        listaBox.appendChild(itemEl);
      });

    } catch (err) {
      console.error("Error al cargar comentarios:", err);
      listaBox.innerHTML = "";
      var errorMsg = document.createElement("div");
      errorMsg.className = "sin-comentarios";
      errorMsg.textContent = "No se pudieron cargar los comentarios en este momento.";
      listaBox.appendChild(errorMsg);
    }
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

  function iniciar() {
    if (typeof actualizarFechaCabecera === "function") {
      actualizarFechaCabecera();
    }
    cargarNoticia();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();