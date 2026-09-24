/**
 * Latinos en Pelota — Lógica para Crear y Editar Noticias
 * Conexión completa con Supabase, Quill Editor, previsualización en vivo y carga de imágenes.
 */

(function () {
  "use strict";

  // =========================================================================
  // ELEMENTOS DEL DOM
  // =========================================================================
  var inputTitulo = document.getElementById("titulo");
  var inputSubtitulo = document.getElementById("subtitulo");
  var selectCategoria = document.getElementById("categoria");
  var slugText = document.getElementById("slug-text");
  var tituloCounter = document.getElementById("titulo-counter");
  var subtituloCounter = document.getElementById("subtitulo-counter");
  var wordCountEl = document.getElementById("word-count");
  var readTimeEl = document.getElementById("read-time");
  var mensajeEstado = document.getElementById("mensaje-estado");

  // Imagen elements
  var tabUpload = document.getElementById("tab-upload");
  var tabUrl = document.getElementById("tab-url");
  var modeUpload = document.getElementById("media-mode-upload");
  var modeUrl = document.getElementById("media-mode-url");
  var dropzone = document.getElementById("dropzone");
  var inputImagenFile = document.getElementById("imagen-file");
  var inputImagenUrl = document.getElementById("imagen-url-input");
  var previewWrapper = document.getElementById("preview-wrapper");
  var previewImgElement = document.getElementById("preview-img-element");
  var btnQuitarImagen = document.getElementById("btn-quitar-imagen");

  // Estado selector
  var optPublicado = document.getElementById("opt-publicado");
  var optBorrador = document.getElementById("opt-borrador");
  var estadoActual = "publicado";

  // Archivo y URL en memoria
  var archivoImagenSeleccionado = null;
  var urlImagenIngresada = "";

  // =========================================================================
  // INICIALIZACIÓN DE QUILL EDITOR
  // =========================================================================
  var editor = new Quill("#editor-contenido", {
    theme: "snow",
    placeholder: "Escribe aquí la crónica, detalles del partido, declaraciones o análisis deportivo...",
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "clean"]
      ]
    }
  });

  // Conteo de palabras y tiempo de lectura
  editor.on("text-change", function () {
    var text = editor.getText().trim();
    var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    var minutes = Math.max(1, Math.ceil(words / 200));

    if (wordCountEl) wordCountEl.textContent = words + (words === 1 ? " palabra" : " palabras");
    if (readTimeEl) readTimeEl.textContent = minutes + " min de lectura estimada";
  });

  // =========================================================================
  // SISTEMA DE TOASTS
  // =========================================================================
  function showToast(title, message, type) {
    type = type || "info";
    var container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;
    toast.innerHTML =
      '<div class="toast-content">' +
      '<div class="toast-title">' + escapeHtml(title) + '</div>' +
      '<div class="toast-msg">' + escapeHtml(message) + '</div>' +
      '</div>' +
      '<button class="modal-close" style="font-size:16px;">&times;</button>';

    var closeBtn = toast.querySelector(".modal-close");
    closeBtn.addEventListener("click", function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(function () { toast.remove(); }, 200);
    });

    container.appendChild(toast);

    setTimeout(function () {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(function () { toast.remove(); }, 200);
      }
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // =========================================================================
  // GENERADOR DE SLUG LIMPIO (SEF)
  // =========================================================================
  function generarSlug(texto) {
    if (!texto) return "";
    var base = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quitar acentos
      .replace(/[^a-z0-9\s-]/g, "")     // solo letras, números y espacios
      .trim()
      .replace(/\s+/g, "-")           // espacios a guiones
      .replace(/-+/g, "-");           // evitar dobles guiones

    var rand = Math.floor(1000 + Math.random() * 9000);
    return (base.slice(0, 70) || "noticia") + "-" + rand;
  }

  function actualizarSlug() {
    var titulo = inputTitulo.value.trim();
    if (!titulo) {
      slugText.textContent = "...";
      return;
    }
    var slugGenerado = generarSlug(titulo);
    slugText.textContent = slugGenerado;
  }

  // Contadores de caracteres
  inputTitulo.addEventListener("input", function () {
    var len = inputTitulo.value.length;
    tituloCounter.textContent = len + " / 120";
    actualizarSlug();
  });

  inputSubtitulo.addEventListener("input", function () {
    var len = inputSubtitulo.value.length;
    subtituloCounter.textContent = len + " / 220";
  });

  // =========================================================================
  // GESTIÓN DE ESTADO (PUBLICADO / BORRADOR)
  // =========================================================================
  function setEstado(nuevoEstado) {
    estadoActual = nuevoEstado;
    if (nuevoEstado === "publicado") {
      optPublicado.classList.add("active");
      optBorrador.classList.remove("active");
    } else {
      optBorrador.classList.add("active");
      optPublicado.classList.remove("active");
    }
  }

  optPublicado.addEventListener("click", function () { setEstado("publicado"); });
  optBorrador.addEventListener("click", function () { setEstado("borrador"); });

  // =========================================================================
  // CARGAR CATEGORÍAS DESDE SUPABASE
  // =========================================================================
  async function cargarCategorias(selectIdToSelect) {
    if (!window.supabase) {
      console.warn("Cliente Supabase no disponible");
      return;
    }

    try {
      var { data, error } = await window.supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) throw error;

      selectCategoria.innerHTML = '<option value="" disabled selected>Selecciona una categoría deportiva</option>';

      if (!data || data.length === 0) {
        selectCategoria.innerHTML = '<option value="" disabled selected>⚠️ No hay categorías en Supabase (usa + Nueva)</option>';
        return;
      }

      data.forEach(function (cat) {
        var opt = document.createElement("option");
        opt.value = cat.id; // ¡ID numérico de la categoría!
        opt.textContent = cat.nombre;
        if (selectIdToSelect && Number(selectIdToSelect) === Number(cat.id)) {
          opt.selected = true;
        }
        selectCategoria.appendChild(opt);
      });
    } catch (err) {
      console.error("Error al cargar categorías:", err);
      selectCategoria.innerHTML = '<option value="" disabled selected>Error al cargar categorías</option>';
      showToast("Error de Conexión", "No se pudieron cargar las categorías de Supabase. Revisa permisos RLS.", "error");
    }
  }

  // =========================================================================
  // MODAL: NUEVA CATEGORÍA RÁPIDA
  // =========================================================================
  var modalCatRapida = document.getElementById("modalNuevaCatRapida");
  var btnNuevaCatRapida = document.getElementById("btn-nueva-cat-rapida");
  var btnCerrarCatRapida = document.getElementById("btn-cerrar-cat-rapida");
  var btnCancelarCatRapida = document.getElementById("btn-cancelar-cat-rapida");
  var formCatRapida = document.getElementById("formCatRapida");
  var inputNuevaCat = document.getElementById("nuevaCatRapidaInput");
  var errorCatRapida = document.getElementById("catRapidaError");
  var btnGuardarCatRapida = document.getElementById("btn-guardar-cat-rapida");

  function abrirModalCatRapida() {
    inputNuevaCat.value = "";
    errorCatRapida.style.display = "none";
    modalCatRapida.classList.add("open");
    setTimeout(function () { inputNuevaCat.focus(); }, 100);
  }

  function cerrarModalCatRapida() {
    modalCatRapida.classList.remove("open");
  }

  if (btnNuevaCatRapida) btnNuevaCatRapida.addEventListener("click", abrirModalCatRapida);
  if (btnCerrarCatRapida) btnCerrarCatRapida.addEventListener("click", cerrarModalCatRapida);
  if (btnCancelarCatRapida) btnCancelarCatRapida.addEventListener("click", cerrarModalCatRapida);

  if (formCatRapida) {
    formCatRapida.addEventListener("submit", async function (e) {
      e.preventDefault();
      var nombre = inputNuevaCat.value.trim();
      if (!nombre) return;

      btnGuardarCatRapida.disabled = true;
      btnGuardarCatRapida.textContent = "Creando...";

      try {
        var { data, error } = await window.supabase
          .from("categorias")
          .insert([{ nombre: nombre }])
          .select();

        if (error) throw error;

        var nuevaCatId = data && data[0] ? data[0].id : null;
        showToast("Categoría Creada", 'Se agregó "' + nombre + '" a Supabase.', "success");
        cerrarModalCatRapida();
        await cargarCategorias(nuevaCatId);
      } catch (err) {
        console.error("Error al crear categoría rápida:", err);
        var msg = err.message || "Error al crear categoría.";
        if (err.code === "42501") {
          msg = "Permiso denegado por políticas RLS en Supabase. Ejecuta supabase-setup.sql.";
        }
        errorCatRapida.textContent = msg;
        errorCatRapida.style.display = "block";
      } finally {
        btnGuardarCatRapida.disabled = false;
        btnGuardarCatRapida.textContent = "Crear y Seleccionar";
      }
    });
  }

  // =========================================================================
  // GESTIÓN DE IMAGEN DE PORTADA
  // =========================================================================
  tabUpload.addEventListener("click", function () {
    tabUpload.classList.add("active");
    tabUrl.classList.remove("active");
    modeUpload.style.display = "block";
    modeUrl.style.display = "none";
  });

  tabUrl.addEventListener("click", function () {
    tabUrl.classList.add("active");
    tabUpload.classList.remove("active");
    modeUpload.style.display = "none";
    modeUrl.style.display = "block";
  });

  dropzone.addEventListener("click", function () {
    inputImagenFile.click();
  });

  dropzone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropzone.style.borderColor = "var(--accent)";
    dropzone.style.background = "var(--accent-soft)";
  });

  dropzone.addEventListener("dragleave", function () {
    dropzone.style.borderColor = "";
    dropzone.style.background = "";
  });

  dropzone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropzone.style.borderColor = "";
    dropzone.style.background = "";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      procesarArchivoImagen(e.dataTransfer.files[0]);
    }
  });

  inputImagenFile.addEventListener("change", function () {
    if (inputImagenFile.files && inputImagenFile.files[0]) {
      procesarArchivoImagen(inputImagenFile.files[0]);
    }
  });

  inputImagenUrl.addEventListener("input", function () {
    var url = inputImagenUrl.value.trim();
    if (url) {
      archivoImagenSeleccionado = null;
      urlImagenIngresada = url;
      previewImgElement.src = url;
      previewWrapper.style.display = "block";
    } else {
      urlImagenIngresada = "";
      previewWrapper.style.display = "none";
    }
  });

  function procesarArchivoImagen(file) {
    if (!file.type.startsWith("image/")) {
      showToast("Archivo no válido", "Por favor selecciona un archivo de imagen.", "error");
      return;
    }
    archivoImagenSeleccionado = file;
    urlImagenIngresada = "";
    inputImagenUrl.value = "";
    previewImgElement.src = URL.createObjectURL(file);
    previewWrapper.style.display = "block";
  }

  btnQuitarImagen.addEventListener("click", function (e) {
    e.stopPropagation();
    archivoImagenSeleccionado = null;
    urlImagenIngresada = "";
    inputImagenFile.value = "";
    inputImagenUrl.value = "";
    previewWrapper.style.display = "none";
    previewImgElement.src = "";
  });

  // Convertir File a Base64 como fallback si el storage bucket no está listo
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function obtenerUrlImagenFinal() {
    // 1. Si el usuario ingresó una URL directa, usarla
    if (urlImagenIngresada) {
      return urlImagenIngresada;
    }

    // 2. Si seleccionó un archivo, intentar subir a Supabase Storage
    if (archivoImagenSeleccionado) {
      try {
        var ext = archivoImagenSeleccionado.name.split(".").pop();
        var nombreLimpio = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;

        var { error: uploadError } = await window.supabase.storage
          .from("imagenes")
          .upload(nombreLimpio, archivoImagenSeleccionado, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) throw uploadError;

        var { data } = window.supabase.storage
          .from("imagenes")
          .getPublicUrl(nombreLimpio);

        return data.publicUrl;
      } catch (err) {
        console.warn("No se pudo subir la imagen al bucket 'imagenes':", err.message);
        // Fallback robusto a Base64 para que el usuario NUNCA pierda su trabajo
        showToast(
          "Aviso sobre Imagen",
          "El bucket 'imagenes' no está configurado en Supabase. Se guardará la imagen en formato base64.",
          "info"
        );
        return await fileToBase64(archivoImagenSeleccionado);
      }
    }

    return "";
  }

  // =========================================================================
  // VISTA PREVIA DEL LECTOR (MODAL INTERACTIVO)
  // =========================================================================
  var modalPreview = document.getElementById("modalPreview");
  var btnVistaPrevia = document.getElementById("btn-vista-previa");
  var btnCerrarPreview = document.getElementById("btn-cerrar-preview");
  var btnCerrarPreview2 = document.getElementById("btn-cerrar-preview-2");
  var btnPublicarDesdePreview = document.getElementById("btn-publicar-desde-preview");

  function abrirVistaPrevia() {
    var titulo = inputTitulo.value.trim() || "Título de la noticia";
    var subtitulo = inputSubtitulo.value.trim() || "Bajada de la noticia";
    var catTexto = selectCategoria.options[selectCategoria.selectedIndex] ? selectCategoria.options[selectCategoria.selectedIndex].text : "DEPORTE";
    var contenido = editor.root.innerHTML;

    document.getElementById("pv-titulo").textContent = titulo;
    document.getElementById("pv-subtitulo").textContent = subtitulo;
    document.getElementById("pv-categoria").textContent = catTexto;

    var hoy = new Date();
    var opciones = { day: "numeric", month: "long", year: "numeric" };
    document.getElementById("pv-fecha").textContent = hoy.toLocaleDateString("es-DO", opciones);

    var imgPv = document.getElementById("pv-imagen");
    if (previewImgElement.src && previewWrapper.style.display !== "none") {
      imgPv.src = previewImgElement.src;
      imgPv.style.display = "block";
    } else {
      imgPv.style.display = "none";
    }

    document.getElementById("pv-contenido").innerHTML =
      editor.getText().trim().length === 0
        ? "<p><i>(Aún no has redactado el cuerpo de la noticia)</i></p>"
        : contenido;

    modalPreview.classList.add("open");
  }

  function cerrarVistaPrevia() {
    modalPreview.classList.remove("open");
  }

  if (btnVistaPrevia) btnVistaPrevia.addEventListener("click", abrirVistaPrevia);
  if (btnCerrarPreview) btnCerrarPreview.addEventListener("click", cerrarVistaPrevia);
  if (btnCerrarPreview2) btnCerrarPreview2.addEventListener("click", cerrarVistaPrevia);
  if (btnPublicarDesdePreview) {
    btnPublicarDesdePreview.addEventListener("click", function () {
      cerrarVistaPrevia();
      guardarNoticia("publicado");
    });
  }

  // =========================================================================
  // GUARDAR NOTICIA EN SUPABASE
  // =========================================================================
  async function guardarNoticia(estado) {
    var titulo = inputTitulo.value.trim();
    var subtitulo = inputSubtitulo.value.trim();
    var categoriaId = selectCategoria.value;
    var contenidoHtml = editor.root.innerHTML.trim();
    var contenidoVacio = editor.getText().trim().length === 0;

    // Validación de campos obligatorios
    if (!titulo) {
      showToast("Campo requerido", "Por favor ingresa un título para la noticia.", "error");
      inputTitulo.focus();
      return;
    }

    if (!subtitulo) {
      showToast("Campo requerido", "Por favor ingresa un subtítulo o bajada.", "error");
      inputSubtitulo.focus();
      return;
    }

    if (!categoriaId) {
      showToast("Campo requerido", "Por favor selecciona una categoría deportiva.", "error");
      selectCategoria.focus();
      return;
    }

    if (contenidoVacio) {
      showToast("Campo requerido", "El cuerpo de la noticia no puede estar vacío.", "error");
      editor.focus();
      return;
    }

    // Actualizar botones a estado de carga
    var btnPub = document.getElementById("btn-publicar");
    var btnPubMobile = document.getElementById("btn-publicar-mobile");
    var btnPubSide = document.getElementById("btn-sidebar-publicar");
    var btnBorr = document.getElementById("btn-borrador");
    var btnBorrSide = document.getElementById("btn-sidebar-borrador");

    [btnPub, btnPubMobile, btnPubSide, btnBorr, btnBorrSide].forEach(function (b) {
      if (b) b.disabled = true;
    });

    if (mensajeEstado) {
      mensajeEstado.textContent = "Guardando en Supabase...";
      mensajeEstado.style.color = "var(--text)";
    }

    try {
      // 1. Obtener URL de imagen
      var imagenFinalUrl = await obtenerUrlImagenFinal();

      // 2. Generar slug único
      var slug = slugText.textContent !== "..." ? slugText.textContent : generarSlug(titulo);

      // 3. Preparar payload respetando exactamente el esquema de la tabla 'noticias'
      var payload = {
        titulo: titulo,
        subtitulo: subtitulo,
        categoria_id: parseInt(categoriaId, 10), // ¡Columna categoria_id en Supabase!
        contenido: contenidoHtml,
        imagen_url: imagenFinalUrl || "",
        slug: slug,
        estado: estado, // 'publicado' o 'borrador'
        publicado_en: estado === "publicado" ? new Date().toISOString() : null
      };

      var { data, error } = await window.supabase
        .from("noticias")
        .insert([payload])
        .select();

      if (error) throw error;

      var mensajeExito = estado === "publicado"
        ? "¡Noticia publicada con éxito!"
        : "Borrador guardado correctamente.";

      showToast("Éxito", mensajeExito, "success");

      if (mensajeEstado) {
        mensajeEstado.textContent = mensajeExito + " Redirigiendo...";
        mensajeEstado.style.color = "var(--success)";
      }

      setTimeout(function () {
        window.location.href = "Panel-de-admin.html?seccion=noticias&creada=1";
      }, 1200);

    } catch (err) {
      console.error("Error al guardar noticia:", err);
      var msg = err.message || "Error al comunicarse con Supabase.";

      if (err.code === "42501") {
        msg = "Bloqueado por políticas RLS en Supabase. Ejecuta el script supabase-setup.sql en Supabase SQL Editor.";
      } else if (err.code === "23505") {
        msg = "Ya existe una noticia con un slug similar. Intenta cambiar el título.";
      }

      showToast("Error al guardar", msg, "error");

      if (mensajeEstado) {
        mensajeEstado.textContent = "Error: " + msg;
        mensajeEstado.style.color = "var(--danger)";
      }

      [btnPub, btnPubMobile, btnPubSide, btnBorr, btnBorrSide].forEach(function (b) {
        if (b) b.disabled = false;
      });
    }
  }

  // Event listeners para los botones de guardar
  document.getElementById("btn-publicar").addEventListener("click", function () { guardarNoticia("publicado"); });
  document.getElementById("btn-sidebar-publicar").addEventListener("click", function () { guardarNoticia("publicado"); });
  var btnPubMob = document.getElementById("btn-publicar-mobile");
  if (btnPubMob) btnPubMob.addEventListener("click", function () { guardarNoticia("publicado"); });

  document.getElementById("btn-borrador").addEventListener("click", function () { guardarNoticia("borrador"); });
  document.getElementById("btn-sidebar-borrador").addEventListener("click", function () { guardarNoticia("borrador"); });

  // Escape para cerrar modales
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      cerrarVistaPrevia();
      cerrarModalCatRapida();
    }
  });

  // Verificar que el usuario tenga sesión de administrador activa
  async function verificarAccesoAdmin() {
    if (!window.supabase) return;
    try {
      var { data, error } = await window.supabase.auth.getSession();
      if (error || !data || !data.session) {
        showToast("Acceso Restringido", "Debes iniciar sesión en el panel para crear noticias.", "error");
        setTimeout(function () {
          window.location.href = "Panel-de-admin.html";
        }, 1200);
        return;
      }

      var user = data.session.user;
      var email = user.email || "";
      var userName = email ? (email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1)) : "Usuario";

      var nameEl = document.getElementById("cn-userNameDisplay");
      var emailEl = document.getElementById("cn-userEmailDisplay");
      var avatarEl = document.getElementById("cn-userAvatar");

      if (nameEl) nameEl.textContent = userName;
      if (emailEl) emailEl.textContent = email;
      if (avatarEl) avatarEl.textContent = email ? email.slice(0, 2).toUpperCase() : "--";

    } catch (e) {
      console.warn("No se pudo validar sesión:", e);
    }
  }

  // Logout en crear-noticia
  var cnBtnLogout = document.getElementById("cn-btnLogout");
  if (cnBtnLogout) {
    cnBtnLogout.addEventListener("click", async function () {
      if (confirm("¿Deseas cerrar tu sesión de administrador?")) {
        await window.supabase.auth.signOut();
        window.location.href = "Panel-de-admin.html";
      }
    });
  }

  // Inicializar
  verificarAccesoAdmin();
  cargarCategorias();

})();