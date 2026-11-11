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

  var IMAGEN_PLACEHOLDER = "assets/Logo latinos .png";

  function barajar(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }

  function crearMarkupBannerHorizontal(ad) {
    return (
      '<div class="ad-top-horizontal">' +
        '<div class="ad-top-badge">PUBLICIDAD</div>' +
        '<a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer" class="ad-top-content">' +
          '<div class="ad-top-thumb">' +
            '<img src="' + escapeHtml(ad.imagen_url) + '" alt="' + escapeHtml(ad.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
          '</div>' +
          '<div class="ad-top-info">' +
            '<span class="ad-top-title">' + escapeHtml(ad.titulo) + '</span>' +
          '</div>' +
          '<span class="ad-top-cta">Ver oferta →</span>' +
        '</a>' +
      '</div>'
    );
  }

  function crearMarkupAnuncioLateral(ad) {
    return (
      '<div class="ad-card-lateral">' +
        '<div class="ad-card-lateral-header">' +
          '<span class="ad-label">PUBLICIDAD</span>' +
        '</div>' +
        '<div class="ad-card-lateral-media">' +
          '<a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer">' +
            '<img src="' + escapeHtml(ad.imagen_url) + '" alt="' + escapeHtml(ad.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
          '</a>' +
        '</div>' +
        '<div class="ad-card-lateral-body">' +
          '<h4>' + escapeHtml(ad.titulo) + '</h4>' +
          '<a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer" class="btn-ad">Ver oferta →</a>' +
        '</div>' +
      '</div>'
    );
  }

  var anunciosNoticia = [];
  var pantallaEstrecha = window.matchMedia("(max-width: 980px)");

  function colocarAnuncioNoticia() {
    var topSlot = document.getElementById("noticia-top-ad");
    var sidebarSlot = document.getElementById("noticia-sidebar-ad");
    if (!topSlot || !sidebarSlot) return;

    topSlot.textContent = "";
    sidebarSlot.textContent = "";
    if (anunciosNoticia.length === 0) return;

    topSlot.innerHTML = crearMarkupBannerHorizontal(anunciosNoticia[0]);
    sidebarSlot.innerHTML = anunciosNoticia.slice(1).map(function (anuncio) {
      return pantallaEstrecha.matches
        ? crearMarkupBannerHorizontal(anuncio)
        : crearMarkupAnuncioLateral(anuncio);
    }).join("");
  }

  pantallaEstrecha.addEventListener("change", colocarAnuncioNoticia);

  async function insertarAnunciosNoticia() {
    if (!window.supabase) return;

    try {
      var { data, error } = await window.supabase
        .from("anuncios")
        .select("id, titulo, imagen_url, enlace_url, ubicacion, activo")
        .eq("activo", true);
      if (error) throw error;

      var vistos = new Set();
      anunciosNoticia = barajar(data || []).filter(function (anuncio) {
        var clave = JSON.stringify([anuncio.titulo, anuncio.imagen_url, anuncio.enlace_url]);
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });
      colocarAnuncioNoticia();
    } catch (e) {
      console.warn("No se pudieron cargar anuncios para la noticia:", e);
    }
  }

  async function pintarNoticia(n) {
    var categoria = n.categorias ? n.categorias.nombre : "General";
    var fecha = formatearFecha(n.publicado_en);

    document.title = n.titulo + " | Latinos en Pelota";

    contenedor.innerHTML =
      '<div id="noticia-top-ad" class="noticia-top-ad-slot"></div>' +
      '<div class="noticia-grid-layout lateral-derecho" id="noticia-layout">' +
        '<div class="noticia-main-col">' +
          '<article class="noticia">' +
            '<span class="tag ' + obtenerClaseTag(categoria) + '">' + escapeHtml(categoria.toUpperCase()) + "</span>" +
            "<h1>" + escapeHtml(n.titulo) + "</h1>" +
            (n.subtitulo ? '<p class="subtitulo">' + escapeHtml(n.subtitulo) + "</p>" : "") +
            '<div class="byline">Redacción' + (fecha ? " · " + fecha : "") + "</div>" +
            (n.imagen_url
              ? '<figure class="portada"><img src="' + escapeHtml(n.imagen_url) + '" alt="' + escapeHtml(n.titulo) + '" onerror="this.parentNode.style.display=\'none\'"></figure>'
              : "") +
            '<div class="contenido">' + prepararContenido(n.contenido) + "</div>" +
          "</article>" +
          '<div id="contenedor-comentarios-wrap"></div>' +
        '</div>' +
        '<aside class="noticia-sidebar-ad" id="noticia-sidebar-ad"></aside>' +
      '</div>';

    await inicializarComentarios(n.id);
    await insertarAnunciosNoticia();
  }

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

    var destinoComentarios = document.getElementById("contenedor-comentarios-wrap") || contenedor;
    destinoComentarios.appendChild(wrap);

    renderizarFormularioComentario(noticiaId, sesionUsuario, formBox);
    await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);

    if (window.supabase && window.supabase.auth && window.supabase.auth.onAuthStateChange) {
      window.supabase.auth.onAuthStateChange(function (evento, nuevaSesion) {
        sesionUsuario = nuevaSesion;
        if (evento === "USER_UPDATED") return;
        renderizarFormularioComentario(noticiaId, sesionUsuario, formBox);
        setTimeout(function () { cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2); }, 0);
      });
    }
  }

  function renderizarFormularioComentario(noticiaId, sesionUsuario, formBox, respuestaA) {
    if (!formBox) formBox = document.getElementById("contenedor-form-comentario");
    if (!formBox) return;

    formBox.innerHTML = "";

    if (!sesionUsuario || !sesionUsuario.user) {
      var promptEl = document.createElement("div");
      promptEl.className = "comentarios-login-prompt";
      promptEl.innerHTML = 'Para comentar, responder o dar me gusta, debes <a href="Panel-de-admin.html">iniciar sesión</a>.';
      formBox.appendChild(promptEl);
      return;
    }

    var form = document.createElement("form");
    form.className = "comentario-form";
    if (!respuestaA) form.id = "form-nuevo-comentario";

    var textarea = document.createElement("textarea");
    textarea.placeholder = "Escribe tu comentario sobre esta noticia (máx. 500 caracteres)...";
    if (respuestaA) textarea.placeholder = "Responde a " + (respuestaA.autor || "Lector") + " (máx. 500 caracteres)...";
    textarea.setAttribute("aria-label", respuestaA ? "Tu respuesta" : "Tu comentario");
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
    btn.textContent = respuestaA ? "Publicar respuesta" : "Publicar Comentario";

    footer.appendChild(contador);
    footer.appendChild(btn);
    if (respuestaA) {
      var cancelar = document.createElement("button");
      cancelar.type = "button";
      cancelar.className = "comentario-cancelar";
      cancelar.textContent = "Cancelar";
      cancelar.onclick = function () {
        formBox.hidden = true;
        var abrir = formBox.parentNode.querySelector(".comentario-responder");
        abrir.setAttribute("aria-expanded", "false");
        abrir.focus();
        formBox.textContent = "";
      };
      footer.appendChild(cancelar);
    }

    var userBar = document.createElement("div");
    userBar.className = "comentario-usuario-bar";

    var userInfo = document.createElement("div");
    userInfo.className = "comentario-usuario-info";

    var userActual = (sesionUsuario.user.user_metadata && (sesionUsuario.user.user_metadata.nombre || sesionUsuario.user.user_metadata.full_name))
      || (sesionUsuario.user.email ? sesionUsuario.user.email.split("@")[0] : "Lector");

    var userLabel = document.createElement("span");
    userLabel.className = "comentario-usuario-label";
    userLabel.innerHTML = 'Comentando como: <strong class="comentario-usuario-nombre">' + escapeHtml(userActual) + '</strong>';

    var btnCambiar = document.createElement("button");
    btnCambiar.type = "button";
    btnCambiar.className = "btn-cambiar-nombre";
    btnCambiar.title = "Cambiar el nombre que se mostrará en tus comentarios";
    btnCambiar.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>Cambiar nombre';

    btnCambiar.addEventListener("click", async function () {
      var actual = (sesionUsuario.user.user_metadata && (sesionUsuario.user.user_metadata.nombre || sesionUsuario.user.user_metadata.full_name))
        || (sesionUsuario.user.email ? sesionUsuario.user.email.split("@")[0] : "");
      var nombre = window.prompt("Elige el nombre que se mostrará en tus comentarios.", actual);
      if (nombre === null) return;
      nombre = nombre.trim();
      if (nombre.length < 2 || nombre.length > 40) {
        alert("El nombre debe tener de 2 a 40 caracteres.");
        return;
      }

      btnCambiar.disabled = true;
      try {
        var { data, error } = await window.supabase.auth.updateUser({ data: { nombre: nombre } });
        if (error) throw error;
        sesionUsuario.user = data.user;
        var nombreEl = userLabel.querySelector(".comentario-usuario-nombre");
        if (nombreEl) nombreEl.textContent = nombre;
      } catch (err) {
        console.error("Error al guardar el nombre:", err);
        alert("No pudimos guardar tu nombre. Inténtalo de nuevo.");
      } finally {
        btnCambiar.disabled = false;
      }
    });

    userInfo.appendChild(userLabel);
    userInfo.appendChild(btnCambiar);
    userBar.appendChild(userInfo);

    form.appendChild(userBar);
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
        var autor = (user.user_metadata && (user.user_metadata.nombre || user.user_metadata.full_name))
          || (user.email ? user.email.split("@")[0] : "Lector");

        var { error } = await window.supabase
          .from("comentarios")
          .insert([{
            noticia_id: noticiaId,
            user_id: user.id,
            autor: autor,
            contenido: texto,
            ...(respuestaA ? { parent_id: respuestaA.id } : {})
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
        btn.textContent = respuestaA ? "Publicar respuesta" : "Publicar Comentario";
      }
    });

    formBox.appendChild(form);
  }

  var versionComentarios = 0;

  async function cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2) {
    if (!listaBox) listaBox = document.getElementById("lista-comentarios");
    if (!tituloH2) tituloH2 = document.getElementById("comentarios-titulo");
    if (!listaBox) return;
    var version = ++versionComentarios;
    try {
      var resultado = await window.supabase.from("comentarios")
        .select("id, noticia_id, user_id, autor, contenido, created_at, parent_id")
        .eq("noticia_id", noticiaId).order("created_at", { ascending: false });
      var interacciones = true;
      if (resultado.error && (resultado.error.code === "42703" || resultado.error.code === "PGRST204")) {
        // Los comentarios existentes siguen disponibles antes de aplicar la migración.
        interacciones = false;
        resultado = await window.supabase.from("comentarios")
          .select("id, noticia_id, user_id, autor, contenido, created_at")
          .eq("noticia_id", noticiaId).order("created_at", { ascending: false });
      }
      if (resultado.error) throw resultado.error;
      var comentarios = resultado.data || [];
      var resumen = new Map();
      if (interacciones && comentarios.length) {
        var likes = await window.supabase.rpc("resumen_likes_comentarios", { p_noticia_id: noticiaId });
        if (likes.error) {
          console.warn("No se pudieron cargar los likes:", likes.error);
          interacciones = false;
        } else {
          (likes.data || []).forEach(function (r) { resumen.set(String(r.comentario_id), r); });
        }
      }
      if (version !== versionComentarios) return;
      tituloH2.textContent = "Comentarios (" + comentarios.length + ")";
      listaBox.textContent = "";
      if (!interacciones) {
        var aviso = document.createElement("p");
        aviso.className = "comentarios-aviso";
        aviso.textContent = "Los likes y las respuestas no están disponibles en este momento.";
        listaBox.appendChild(aviso);
      }
      if (!comentarios.length) {
        var empty = document.createElement("div");
        empty.className = "sin-comentarios";
        empty.textContent = "Aún no hay comentarios en esta noticia. ¡Sé el primero en opinar!";
        listaBox.appendChild(empty);
        return;
      }
      var currentUser = sesionUsuario ? sesionUsuario.user : null;
      var esAdmin = currentUser && currentUser.app_metadata && currentUser.app_metadata.role === "admin";
      var porId = new Map(comentarios.map(function (c) { return [String(c.id), c]; }));
      var hijos = new Map();
      comentarios.slice().reverse().forEach(function (c) {
        if (c.parent_id == null || !porId.has(String(c.parent_id))) return;
        var clave = String(c.parent_id);
        if (!hijos.has(clave)) hijos.set(clave, []);
        hijos.get(clave).push(c);
      });
      var vistos = new Set();
      var pendientes = comentarios.filter(function (c) {
        return c.parent_id == null || !porId.has(String(c.parent_id));
      }).reverse();
      // Una pila mantiene el orden del hilo sin anidar indefinidamente el diseño móvil.
      function agregarComentario(c) {
        var itemEl = document.createElement("article");
        itemEl.className = "comentario-item" + (c.parent_id != null ? " comentario-respuesta" : "");
        var headerEl = document.createElement("div");
        headerEl.className = "comentario-header";
        var autorEl = document.createElement("span");
        autorEl.className = "comentario-autor";
        autorEl.textContent = c.autor || "Lector";
        var fechaEl = document.createElement("span");
        fechaEl.className = "comentario-fecha";
        fechaEl.textContent = formatearFecha(c.created_at);
        headerEl.append(autorEl, fechaEl);
        itemEl.appendChild(headerEl);
        var padre = porId.get(String(c.parent_id));
        if (padre) {
          var contexto = document.createElement("p");
          contexto.className = "comentario-contexto";
          contexto.textContent = "En respuesta a " + (padre.autor || "Lector");
          itemEl.appendChild(contexto);
        }
        var textoEl = document.createElement("p");
        textoEl.className = "comentario-texto";
        textoEl.textContent = c.contenido;
        itemEl.appendChild(textoEl);
        var accionesEl = document.createElement("div");
        accionesEl.className = "comentario-acciones comentario-interacciones";
        if (interacciones) {
          var datosLike = resumen.get(String(c.id)) || { total: 0, propio: false };
          var btnLike = document.createElement("button");
          btnLike.type = "button";
          btnLike.className = "comentario-like";
          function pintarLike() {
            btnLike.textContent = "♥ Me gusta · " + datosLike.total;
            btnLike.setAttribute("aria-pressed", String(datosLike.propio));
            btnLike.setAttribute("aria-label", (datosLike.propio ? "Quitar me gusta" : "Me gusta") + ": " + datosLike.total);
          }
          pintarLike();
          btnLike.disabled = !!currentUser && currentUser.id === c.user_id;
          if (btnLike.disabled) btnLike.title = "Este es tu comentario";
          btnLike.onclick = async function () {
            if (!currentUser) { window.location.href = "Panel-de-admin.html"; return; }
            btnLike.disabled = true;
            try {
              var cambio = datosLike.propio
                ? await window.supabase.from("comentario_likes").delete().eq("comentario_id", c.id).eq("user_id", currentUser.id)
                : await window.supabase.from("comentario_likes").insert({ comentario_id: c.id, user_id: currentUser.id });
              if (cambio.error && cambio.error.code !== "23505") throw cambio.error;
              var actualizado = await window.supabase.rpc("resumen_likes_comentarios", { p_noticia_id: noticiaId });
              if (actualizado.error) throw actualizado.error;
              datosLike = (actualizado.data || []).find(function (r) { return String(r.comentario_id) === String(c.id); }) || { total: 0, propio: false };
              pintarLike();
            } catch (err) {
              console.error("Error al guardar like:", err);
              alert("No pudimos actualizar tu me gusta. Inténtalo de nuevo.");
            } finally { btnLike.disabled = false; }
          };
          var btnResponder = document.createElement("button");
          btnResponder.type = "button";
          btnResponder.className = "comentario-responder";
          btnResponder.textContent = "Responder";
          btnResponder.setAttribute("aria-expanded", "false");
          var respuestaBox = document.createElement("div");
          respuestaBox.className = "comentario-respuesta-form";
          respuestaBox.hidden = true;
          btnResponder.onclick = function () {
            if (!currentUser) { window.location.href = "Panel-de-admin.html"; return; }
            var abrir = respuestaBox.hidden;
            respuestaBox.hidden = !abrir;
            btnResponder.setAttribute("aria-expanded", String(abrir));
            if (abrir) {
              renderizarFormularioComentario(noticiaId, sesionUsuario, respuestaBox, c);
              respuestaBox.querySelector("textarea").focus();
            } else { respuestaBox.textContent = ""; }
          };
          accionesEl.append(btnLike, btnResponder);
          itemEl.appendChild(respuestaBox);
        }
        if (currentUser && (currentUser.id === c.user_id || esAdmin)) {
          var btnBorrar = document.createElement("button");
          btnBorrar.type = "button";
          btnBorrar.className = "btn-borrar-comentario";
          btnBorrar.textContent = "Eliminar";
          btnBorrar.onclick = async function () {
            if (!confirm("¿Deseas eliminar este comentario? Las respuestas de otras personas se conservarán.")) return;
            btnBorrar.disabled = true;
            try {
              var borrado = await window.supabase.from("comentarios").delete().eq("id", c.id).select("id");
              if (borrado.error) throw borrado.error;
              if (!borrado.data || !borrado.data.length) throw new Error("No tienes permiso para eliminar este comentario.");
              await cargarListaComentarios(noticiaId, sesionUsuario, listaBox, tituloH2);
            } catch (err) {
              alert("No se pudo eliminar el comentario: " + err.message);
              btnBorrar.disabled = false;
            }
          };
          accionesEl.appendChild(btnBorrar);
        }
        itemEl.insertBefore(accionesEl, itemEl.querySelector(".comentario-respuesta-form"));
        listaBox.appendChild(itemEl);
      }
      function recorrer() {
        while (pendientes.length) {
          var c = pendientes.pop();
          if (vistos.has(String(c.id))) continue;
          vistos.add(String(c.id));
          agregarComentario(c);
          (hijos.get(String(c.id)) || []).slice().reverse().forEach(function (hijo) { pendientes.push(hijo); });
        }
      }
      recorrer();
      // Conserva visibles registros huérfanos o antiguos con relaciones inconsistentes.
      comentarios.forEach(function (c) { if (!vistos.has(String(c.id))) { pendientes.push(c); recorrer(); } });
    } catch (err) {
      if (version !== versionComentarios) return;
      console.error("Error al cargar comentarios:", err);
      listaBox.textContent = "";
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

      await pintarNoticia(respuesta.data);
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