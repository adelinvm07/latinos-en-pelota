
(function () {
  "use strict";

  var state = {
    section: "resumen",
    noticiasQuery: "",
    noticiasCategoria: "todas",
    noticiasEstado: "todos",
    noticiasPage: 1,
    noticiasTotal: 0,
    comentariosTab: "pendiente",
    comentariosQuery: "",
    comentariosPendientesTotal: 47,
    editingCatId: null,
    deletingCatId: null,
    editingAnuncioId: null,
    isRegisterMode: false
  };

  var PAGE_SIZE = 8;
  var categorias = [];
  var noticias = [];
  var anuncios = [];
  var adminId = null;
  var usuariosOcupado = false;

  var catPalette = [
    "var(--accent)",
    "var(--blue)",
    "var(--gold)",
    "var(--purple)",
    "var(--teal)",
    "var(--pink)",
    "#e67e22",
    "#2ecc71"
  ];

  var comentarios = [
    { id: 1, autor: "Ramón Féliz", texto: "¡Por fin una temporada donde el Licey juega en serio! Ese noveno inning fue una locura.", articulo: "El Escogido remonta en el noveno", fecha: "2026-09-03", estado: "pendiente" },
    { id: 2, autor: "Carmen Ozuna", texto: "¿Alguien sabe si van a transmitir el partido por streaming también?", articulo: "República Dominicana estrena su roster preliminar", fecha: "2026-09-03", estado: "pendiente" },
    { id: 3, autor: "Luis Almonte", texto: "Excelente análisis, aunque creo que le faltó mencionar el bullpen.", articulo: "Las Águilas Cibaeñas aseguran su boleto", fecha: "2026-09-02", estado: "pendiente" },
    { id: 4, autor: "Yesenia Paulino", texto: "Ojalá el Cibao FC pueda sostener este nivel en la liguilla.", articulo: "Cibao FC se corona campeón", fecha: "2026-09-02", estado: "aprobado" }
  ];

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

  function fmt(num) {
    return Number(num || 0).toLocaleString("es-DO");
  }

  function fechaCorta(iso) {
    if (!iso) return "—";
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
  }

  async function verificarSesion() {
    if (!window.supabase) return false;

    try {
      var { data, error } = await window.supabase.auth.getSession();
      if (error) throw error;

      var loginScreen = document.getElementById("adminLoginScreen");
      var appContainer = document.getElementById("adminAppContainer");
      var btnAdminPublico = document.getElementById("btnPanelAdmin");
      var session = data ? data.session : null;

      if (!session) {
        if (btnAdminPublico) btnAdminPublico.style.display = "none";
        if (appContainer) appContainer.style.display = "none";
        if (loginScreen) loginScreen.style.display = "flex";
        return false;
      }

      var user = session.user;
      var esAdmin = user && user.app_metadata && user.app_metadata.role === "admin";

      if (!esAdmin) {
        if (btnAdminPublico) btnAdminPublico.style.display = "none";
        window.location.replace("latinos-en-pelota.html");
        return false;
      }

      if (btnAdminPublico) btnAdminPublico.style.display = "inline-block";
      if (loginScreen) loginScreen.style.display = "none";
      if (appContainer) appContainer.style.display = "";

      adminId = user.id;
      var email = user.email || "";
      var userName = email ? (email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1)) : "Administrador";

      var nameEl = document.getElementById("userNameDisplay");
      var emailEl = document.getElementById("userEmailDisplay");
      var avatarEl = document.getElementById("userAvatar");

      if (nameEl) nameEl.textContent = userName;
      if (emailEl) emailEl.textContent = email;
      if (avatarEl) avatarEl.textContent = email ? email.slice(0, 2).toUpperCase() : "AD";

      return true;
    } catch (err) {
      console.warn("Error al verificar sesión:", err);
      return false;
    }
  }

  function configurarLogin() {
    var form = document.getElementById("adminLoginForm");
    var emailInput = document.getElementById("loginEmail");
    var passInput = document.getElementById("loginPassword");
    var errorEl = document.getElementById("loginErrorMsg");
    var btnSubmit = document.getElementById("btnLoginSubmit");

    var btnRegistro = document.getElementById("btnRegistro");
    var aviso = document.getElementById("registroAviso");

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var registrar = e.submitter === btnRegistro;
        var email = emailInput.value.trim();
        var pass = passInput.value;

        errorEl.style.display = "none";
        aviso.hidden = true;

        if (!email || !pass) return;

        if (registrar && pass.length < 6) {
          errorEl.textContent = "Usa una contraseña de al menos 6 caracteres.";
          errorEl.style.display = "block";
          return;
        }

        var botonActivo = registrar ? btnRegistro : btnSubmit;
        var textoOriginal = botonActivo.textContent;
        btnSubmit.disabled = true;
        btnRegistro.disabled = true;
        botonActivo.textContent = registrar ? "Creando cuenta..." : "Verificando...";

        try {
          var auth = window.supabase.auth;
          var credenciales = { email: email, password: pass };
          var { data, error } = registrar
            ? await auth.signUp(credenciales)
            : await auth.signInWithPassword(credenciales);

          if (error) throw error;

          if (registrar && !data.session) {
            aviso.textContent = "Revisa tu correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.";
            aviso.hidden = false;
            return;
          }

          if (data.session.user.app_metadata?.role === "admin") {
            window.location.reload();
          } else {
            window.location.replace("latinos-en-pelota.html");
          }
        } catch (err) {
          console.error("Error de autenticación:", err);
          var mensajes = {
            invalid_credentials: "El correo o la contraseña son incorrectos.",
            user_already_exists: "Este correo ya está registrado. Inicia sesión.",
            email_exists: "Este correo ya está registrado. Inicia sesión.",
            email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
            weak_password: "La contraseña es demasiado corta o no cumple los requisitos de seguridad."
          };
          errorEl.textContent = mensajes[err.code] || (registrar
            ? "No se pudo crear la cuenta. Inténtalo de nuevo."
            : "No se pudo iniciar sesión. Inténtalo de nuevo.");
          errorEl.style.display = "block";
        } finally {
          btnSubmit.disabled = false;
          btnRegistro.disabled = false;
          botonActivo.textContent = textoOriginal;
        }
      });
    }

    var btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async function () {
        if (confirm("¿Deseas cerrar tu sesión de administrador?")) {
          await window.supabase.auth.signOut();
          window.location.reload();
        }
      });
    }
  }

  async function cargarCategoriasDesdeSupabase() {
    if (!window.supabase) return;

    try {
      var { data, error } = await window.supabase
        .from("categorias_con_conteo_noticias")
        .select("id, nombre, total_noticias")
        .order("nombre", { ascending: true });

      if (error) throw error;

      categorias = (data || []).map(function (cat, idx) {
        return {
          id: cat.id,
          nombre: cat.nombre,
          count: Number(cat.total_noticias),
          color: catPalette[idx % catPalette.length]
        };
      });

      renderCategorias();
      populateCategoriaFilter();
      updateNavBadges();
      renderResumenStats();
    } catch (err) {
      console.error("Error al cargar categorías:", err);
      showToast("Error ", err.message || "No se pudieron cargar las categorías.", "error");
    }
  }

  async function cargarNoticiasDesdeSupabase() {
    if (!window.supabase) return;

    try {
      var { data, error } = await window.supabase
        .from("noticias")
        .select("id, slug, titulo, subtitulo, estado, publicado_en, categoria_id, categorias(id, nombre)")
        .order("id", { ascending: false });

      if (error) throw error;

      noticias = (data || []).map(function (item) {
        var catNombre = item.categorias && item.categorias.nombre
          ? item.categorias.nombre
          : (categorias.find(function (c) { return c.id === item.categoria_id; }) || {}).nombre || "Sin categoría";

        return {
          id: item.id,
          titulo: item.titulo,
          subtitulo: item.subtitulo || "",
          categoria: catNombre,
          categoria_id: item.categoria_id,
          estado: item.estado === "publicado" ? "Publicado" : "Borrador",
          fecha: item.publicado_en ? item.publicado_en.split("T")[0] : "",
          slug: item.slug
        };
      });

      state.noticiasTotal = noticias.length;
      renderNoticias();
      updateNavBadges();
      renderResumenStats();
    } catch (err) {
      console.error("Error al cargar noticias:", err);
    }
  }

  window.abrirModalNuevaCategoria = function () {
    state.editingCatId = null;
    document.getElementById("modalCatTitulo").textContent = "Nueva Categoría";
    document.getElementById("catNombreInput").value = "";
    document.getElementById("catErrorMsg").style.display = "none";
    document.getElementById("modalCategoria").classList.add("open");
    setTimeout(function () {
      document.getElementById("catNombreInput").focus();
    }, 100);
  };

  window.abrirModalEditarCategoria = function (id) {
    var cat = categorias.find(function (c) { return c.id === id; });
    if (!cat) return;

    state.editingCatId = id;
    document.getElementById("modalCatTitulo").textContent = "Editar Categoría";
    document.getElementById("catNombreInput").value = cat.nombre;
    document.getElementById("catErrorMsg").style.display = "none";
    document.getElementById("modalCategoria").classList.add("open");
    setTimeout(function () {
      document.getElementById("catNombreInput").focus();
    }, 100);
  };

  window.cerrarModalCategoria = function () {
    document.getElementById("modalCategoria").classList.remove("open");
    state.editingCatId = null;
  };

  async function guardarCategoria() {
    var input = document.getElementById("catNombreInput");
    var nombre = input.value.trim();
    var errorEl = document.getElementById("catErrorMsg");
    var btn = document.getElementById("btnGuardarCat");

    if (!nombre) {
      errorEl.textContent = "El nombre de la categoría es obligatorio.";
      errorEl.style.display = "block";
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      if (state.editingCatId) {
        var { error } = await window.supabase
          .from("categorias")
          .update({ nombre: nombre })
          .eq("id", state.editingCatId);

        if (error) throw error;
        showToast("Éxito", 'Categoría "' + nombre + '" actualizada.', "success");
      } else {
        var { error: insertError } = await window.supabase
          .from("categorias")
          .insert([{ nombre: nombre }]);

        if (insertError) throw insertError;
        showToast("Éxito", 'Categoría "' + nombre + '" creada.', "success");
      }

      cerrarModalCategoria();
      await cargarCategoriasDesdeSupabase();
      await cargarNoticiasDesdeSupabase();
    } catch (err) {
      console.error("Error al guardar categoría:", err);
      var msg = err.message || "Error al comunicarse con la base de datos.";
      if (err.code === "42501") {
        msg = "Solo usuarios administradores autenticados pueden modificar categorías.";
      } else if (err.code === "23505") {
        msg = "Ya existe una categoría con ese nombre.";
      }
      errorEl.textContent = msg;
      errorEl.style.display = "block";
      showToast("Error al guardar", msg, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar Categoría";
    }
  }

  window.solicitarEliminarCategoria = function (id) {
    var cat = categorias.find(function (c) { return c.id === id; });
    if (!cat) return;

    state.deletingCatId = id;
    document.getElementById("delCatNombre").textContent = cat.nombre;
    document.getElementById("delCatCountWarning").textContent =
      cat.count > 0
        ? "Atención: Esta categoría tiene " + cat.count + " noticia(s) vinculada(s). Quedarán sin categoría asignada."
        : "No hay noticias vinculadas a esta categoría.";

    document.getElementById("modalEliminarCat").classList.add("open");
  };

  window.cerrarModalEliminarCat = function () {
    document.getElementById("modalEliminarCat").classList.remove("open");
    state.deletingCatId = null;
  };

  async function confirmarEliminarCategoria() {
    if (!state.deletingCatId) return;

    var btn = document.getElementById("btnConfirmDelCat");
    btn.disabled = true;
    btn.textContent = "Eliminando...";

    try {
      var { error } = await window.supabase
        .from("categorias")
        .delete()
        .eq("id", state.deletingCatId);

      if (error) throw error;

      showToast("Éxito", "Categoría eliminada de la base de datos.", "success");
      cerrarModalEliminarCat();
      await cargarCategoriasDesdeSupabase();
      await cargarNoticiasDesdeSupabase();
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      var msg = err.message || "Error al eliminar la categoría.";
      showToast("Error al eliminar", msg, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Sí, Eliminar";
    }
  }

  function renderResumenStats() {
    var statNoticias = document.getElementById("statNoticias");
    var statComentarios = document.getElementById("statComentarios");

    if (statNoticias) statNoticias.textContent = fmt(state.noticiasTotal);
    if (statComentarios) statComentarios.textContent = fmt(state.comentariosPendientesTotal);
  }

  var MAX_COBERTURA = 5; // se muestran las 4 categorías con más noticias y el resto como "Otras"

  // Método del mayor resto: los porcentajes enteros suman exactamente 100
  function repartirPorcentajes(conteos, total) {
    var base = conteos.map(function (c) { return Math.floor((c / total) * 100); });
    var resto = 100 - base.reduce(function (s, x) { return s + x; }, 0);
    conteos
      .map(function (c, i) { return { i: i, frac: (c / total) * 100 - base[i] }; })
      .sort(function (x, y) { return y.frac - x.frac; })
      .slice(0, resto)
      .forEach(function (x) { base[x.i] += 1; });
    return base;
  }

  function colorDeCategoria(nombre, posicion) {
    var cat = categorias.find(function (c) { return c.nombre === nombre; });
    return cat ? cat.color : catPalette[posicion % catPalette.length];
  }

  function renderCobertura() {
    var legend = document.getElementById("coberturaLegend");
    var bar = document.getElementById("coberturaBar");
    var sub = document.getElementById("coberturaSub");
    if (!legend) return;

    var publicadas = noticias.filter(function (n) {
      return String(n.estado).toLowerCase() === "publicado";
    });

    if (publicadas.length === 0) {
      if (bar) bar.innerHTML = "";
      if (sub) sub.textContent = "Distribución temática";
      legend.innerHTML = '<div class="meta-muted" style="font-size:13px;">Aún no hay noticias publicadas.</div>';
      return;
    }

    var mapa = {};
    publicadas.forEach(function (n) {
      var nombre = n.categoria || "Sin categoría";
      mapa[nombre] = (mapa[nombre] || 0) + 1;
    });

    var filas = Object.keys(mapa)
      .map(function (nombre) { return { nombre: nombre, count: mapa[nombre] }; })
      .sort(function (x, y) { return y.count - x.count || x.nombre.localeCompare(y.nombre, "es"); });

    if (filas.length > MAX_COBERTURA) {
      var otras = filas.slice(MAX_COBERTURA - 1).reduce(function (s, f) { return s + f.count; }, 0);
      filas = filas.slice(0, MAX_COBERTURA - 1);
      filas.push({ nombre: "Otras", count: otras, color: "var(--text-muted)" });
    }

    var total = publicadas.length;
    var porcentajes = repartirPorcentajes(filas.map(function (f) { return f.count; }), total);

    filas.forEach(function (f, i) {
      f.color = f.color || colorDeCategoria(f.nombre, i);
      f.pct = porcentajes[i];
      f.etiqueta = f.count + (f.count === 1 ? " noticia" : " noticias");
    });

    if (sub) sub.textContent = "Distribución temática · " + total + (total === 1 ? " noticia publicada" : " noticias publicadas");

    if (bar) {
      bar.innerHTML = filas.map(function (f) {
        return '<span title="' + escapeHtml(f.nombre) + ': ' + f.etiqueta + '" style="width:' +
          ((f.count / total) * 100) + '%;background:' + f.color + ';"></span>';
      }).join("");
    }

    legend.innerHTML = filas.map(function (f) {
      return '<div class="donut-legend-row" title="' + f.etiqueta + '">' +
        '<div class="donut-legend-left"><span class="dot" style="background:' + f.color + '"></span>' +
        escapeHtml(f.nombre) + '</div><b>' + f.pct + '%</b></div>';
    }).join("");
  }


  function renderCategorias() {
    var grid = document.getElementById("categoriasGrid");
    if (!grid) return;

    var totalNoticias = state.noticiasTotal || 1;

    if (categorias.length === 0) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column: 1 / -1;">' +
        '<div class="empty-state-icon">🏷️</div>' +
        '<h3>No hay categorías creadas aún</h3>' +
        '<p>Crea tu primera categoría para organizar las noticias del portal deportivo.</p>' +
        '<div style="display:flex;gap:10px;margin-top:8px;">' +
        '<button class="btn btn-primary" onclick="abrirModalNuevaCategoria()">+ Nueva Categoría</button>' +
        '</div>' +
        '</div>';
      return;
    }

    grid.innerHTML = categorias.map(function (cat) {
      var pct = Math.round((cat.count / totalNoticias) * 100);
      return (
        '<div class="cat-card" style="border-top-color:' + cat.color + '">' +
        '<div class="cat-card-top">' +
        '<h4>' + escapeHtml(cat.nombre) + '</h4>' +
        '<span class="pill pill--muted" style="font-size:11px;">ID: ' + cat.id + '</span>' +
        '</div>' +
        '<div class="cat-count"><b>' + fmt(cat.count) + '</b> noticias asignadas</div>' +
        '<div class="cat-share">' + pct + '% del total de noticias</div>' +
        '<div class="cat-progress"><div class="cat-progress-fill" style="width:' + Math.min(100, Math.max(4, pct)) + '%; background:' + cat.color + '"></div></div>' +
        '<div class="cat-card-actions">' +
        '<button class="btn-text" onclick="abrirModalEditarCategoria(' + cat.id + ')">Editar</button>' +
        '<button class="btn-text danger" onclick="solicitarEliminarCategoria(' + cat.id + ')">Eliminar</button>' +
        '</div>' +
        '</div>'
      );
    }).join("");
  }

  function populateCategoriaFilter() {
    var sel = document.getElementById("filtroCategoria");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="todas">Todas las categorías</option>' +
      categorias.map(function (cat) {
        return '<option value="' + escapeHtml(cat.nombre) + '">' + escapeHtml(cat.nombre) + '</option>';
      }).join("");
    sel.value = current || "todas";
  }

  function filteredNoticias() {
    var q = state.noticiasQuery.trim().toLowerCase();
    return noticias.filter(function (item) {
      if (state.noticiasCategoria !== "todas" && item.categoria !== state.noticiasCategoria) return false;
      if (state.noticiasEstado !== "todos" && item.estado.toLowerCase() !== state.noticiasEstado.toLowerCase()) return false;
      if (q && item.titulo.toLowerCase().indexOf(q) === -1 && item.categoria.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function renderNoticias() {
    var list = filteredNoticias();
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.noticiasPage > totalPages) state.noticiasPage = totalPages;
    var start = (state.noticiasPage - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);

    var body = document.getElementById("noticiasBody");
    if (!body) return;

    if (pageItems.length === 0) {
      body.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">' +
        '<div class="empty-state-icon">📰</div>' +
        '<h3>No se encontraron noticias</h3>' +
        '<p>' + (noticias.length === 0 ? "Aún no hay noticias." : "No hay noticias que coincidan con el filtro actual.") + '</p>' +
        (noticias.length === 0 ? '<a href="crear-noticia.html" class="btn btn-primary" style="margin-top:10px;">+ Crear Primera Noticia</a>' : '') +
        '</div></td></tr>';
    } else {
      body.innerHTML = pageItems.map(function (item) {
        var isPub = item.estado.toLowerCase() === "publicado";
        var pillClass = isPub ? "pill--success" : "pill--muted";
        var toggleLabel = isPub ? "Pasar a Borrador" : "Publicar";

        return "<tr>" +
          '<td class="title-cell">' +
  '<div style="font-weight:700;color:var(--text);font-size:14px;">' + escapeHtml(item.titulo) + '</div>' +
  (item.subtitulo ? '<div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;line-height:1.3;">' + escapeHtml(item.subtitulo) + '</div>' : '') +
          '</td>' +
          '<td><span class="pill pill--accent">' + escapeHtml(item.categoria) + '</span></td>' +
          '<td><span class="pill ' + pillClass + '">' + escapeHtml(item.estado) + '</span></td>' +
          '<td class="meta-muted">—</td>' +
          '<td class="meta-muted">' + fechaCorta(item.fecha) + '</td>' +
          '<td>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;">' +
          '<a href="crear-noticia.html?id=' + item.id + '" class="btn-text">Editar</a>' +
          '<button class="btn-text" data-toggle-noticia="' + item.id + '">' + toggleLabel + '</button>' +
          '<button class="btn-text danger" data-delete-noticia="' + item.id + '">Eliminar</button>' +
          '</div>' +
          '</td>' +
          "</tr>";
      }).join("");
    }

    var countEl = document.getElementById("noticiasCount");
    if (countEl) {
      countEl.textContent =
        list.length === 0
          ? "0 resultados"
          : "Mostrando " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, list.length) + " de " + list.length;
    }

    var prevBtn = document.getElementById("noticiasPrev");
    var nextBtn = document.getElementById("noticiasNext");
    if (prevBtn) prevBtn.disabled = state.noticiasPage <= 1;
    if (nextBtn) nextBtn.disabled = state.noticiasPage >= totalPages;
  }

  async function toggleEstadoNoticia(id) {
    var item = noticias.find(function (n) { return n.id === id; });
    if (!item) return;

    var nuevoEstado = item.estado.toLowerCase() === "publicado" ? "borrador" : "publicado";
    try {
      var { error } = await window.supabase
        .from("noticias")
        .update({
          estado: nuevoEstado,
          publicado_en: nuevoEstado === "publicado" ? new Date().toISOString() : null
        })
        .eq("id", id);

      if (error) throw error;

      showToast("Actualizado", 'Estado de la noticia cambiado a "' + nuevoEstado + '".', "success");
      await cargarNoticiasDesdeSupabase();
    } catch (err) {
      console.error("Error al actualizar noticia:", err);
      showToast("Error", err.message, "error");
    }
  }

  async function eliminarNoticia(id) {
    var item = noticias.find(function (n) { return n.id === id; });
    if (!item) return;

    if (!confirm('¿Estás seguro de eliminar la noticia "' + item.titulo + '"? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      var { error } = await window.supabase
        .from("noticias")
        .delete()
        .eq("id", id);

      if (error) throw error;

      showToast("Eliminado", "Noticia eliminada correctamente.", "success");
      await cargarNoticiasDesdeSupabase();
      await cargarCategoriasDesdeSupabase();
    } catch (err) {
      console.error("Error al eliminar noticia:", err);
      showToast("Error", err.message, "error");
    }
  }

  async function cargarComentariosDesdeSupabase() {
    if (!window.supabase) return;
    try {
      var { data, error } = await window.supabase
        .from("comentarios")
        .select("*, noticias(titulo)");
      if (error) throw error;

      comentarios = (data || []).map(function (c) {
        return {
          id: c.id,
          autor: c.autor,
          texto: c.contenido,
          articulo: (c.noticias && c.noticias.titulo) ? c.noticias.titulo : "Noticia #" + c.noticia_id,
          fecha: c.created_at || c.creado_en || "",
          estado: c.estado || "aprobado"
        };
      });
      comentarios.sort(function (a, b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
      state.comentariosPendientesTotal = comentarios.filter(function (c) { return c.estado === "pendiente"; }).length;
      updateNavBadges();
      renderResumenStats();
      renderComentarios();
    } catch (err) {
      console.warn("Error al cargar comentarios en panel:", err);
    }
  }

  async function aprobarComentario(id) {
    try {
      var { error } = await window.supabase.from("comentarios").update({ estado: "aprobado" }).eq("id", id);
      if (error) throw error;
      showToast("Aprobado", "El comentario ya es visible en el portal.", "success");
      await cargarComentariosDesdeSupabase();
    } catch (err) {
      showToast("Error", err.message || "No se pudo aprobar el comentario.", "error");
    }
  }

  window.eliminarComentarioAdmin = async function (id) {
    if (!confirm("¿Deseas eliminar este comentario?")) return;
    try {
      var { error } = await window.supabase
        .from("comentarios")
        .delete()
        .eq("id", id);

      if (error) throw error;

      showToast("Eliminado", "Comentario eliminado correctamente.", "success");
      await cargarComentariosDesdeSupabase();
    } catch (e) {
      showToast("Error", e.message || "No se pudo eliminar el comentario.", "error");
    }
  };

  function renderComentarios() {
    var list = document.getElementById("comentariosList");
    if (!list) return;
    var query = state.comentariosQuery.trim().toLowerCase();
    var pendientes = comentarios.filter(function (c) { return c.estado === "pendiente"; }).length;
    var aprobados = comentarios.length - pendientes;
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      var tab = btn.dataset.tab;
      btn.classList.toggle("active", tab === state.comentariosTab);
      btn.textContent = (tab === "pendiente" ? "Pendientes" : "Aprobados") + " (" + (tab === "pendiente" ? pendientes : aprobados) + ")";
    });
    var filtrados = comentarios.filter(function (c) {
      if (c.estado !== state.comentariosTab) return false;
      return !query || [c.autor, c.texto, c.articulo].some(function (v) { return (v || "").toLowerCase().indexOf(query) !== -1; });
    });
    if (!filtrados.length) {
      var mensaje = query ? "Ningún comentario coincide con la búsqueda." : comentarios.length ? "Todavía no hay comentarios " + (state.comentariosTab === "pendiente" ? "pendientes." : "aprobados.") : "Aún no hay comentarios.";
      list.innerHTML = '<div class="empty-state"><p>' + mensaje + '</p></div>';
      return;
    }
    list.innerHTML = filtrados.map(function (item) {
      var acciones = item.estado === "pendiente"
        ? '<button class="btn btn-primary btn-sm" onclick="aprobarComentarioAdmin(' + item.id + ')">Aprobar</button> <button class="btn btn-danger btn-sm" onclick="eliminarComentarioAdmin(' + item.id + ')">Rechazar</button>'
        : '<button class="btn btn-danger btn-sm" onclick="eliminarComentarioAdmin(' + item.id + ')">Eliminar</button>';
      return '<div class="panel" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><strong>' + escapeHtml(item.autor) + '</strong><span class="meta-muted" style="font-size:12px;">' + fechaCorta(item.fecha) + '</span></div><p style="font-size:14px;color:var(--text);margin-bottom:8px;overflow-wrap:anywhere;">' + escapeHtml(item.texto).replace(/\n/g, "<br>") + '</p><div style="font-size:12px;color:var(--text-muted);">En: <i>' + escapeHtml(item.articulo) + '</i></div><div style="display:flex;gap:8px;margin-top:12px;">' + acciones + '</div></div>';
    }).join("");
  }

  window.aprobarComentarioAdmin = aprobarComentario;

  function updateNavBadges() {
    var bNoti = document.getElementById("badgeNoticias");
    var bCat = document.getElementById("badgeCategorias");
    var bCom = document.getElementById("badgeComentarios");
    var bAnun = document.getElementById("badgeAnuncios");

    if (bNoti) bNoti.textContent = fmt(state.noticiasTotal);
    if (bCat) bCat.textContent = fmt(categorias.length);
    if (bCom) bCom.textContent = fmt(state.comentariosPendientesTotal);
    if (bAnun) bAnun.textContent = fmt(anuncios.length);
  }

  var sectionMeta = {
    resumen: { title: "Resumen del sitio", subtitle: "Panel de control general", search: "Buscar noticias...", action: "Nueva noticia" },
    noticias: { title: "Gestión de Noticias", subtitle: "Publicaciones", search: "Buscar noticia por título...", action: "Nueva noticia" },
    categorias: { title: "Gestión de Categorías", subtitle: "Organiza las secciones deportivas", search: "Buscar categoría...", action: "Nueva categoría" },
    comentarios: { title: "Comentarios", subtitle: "Moderación de comentarios", search: "Buscar comentario...", action: null },
    anuncios: { title: "Gestión de Publicidad", subtitle: "Banners y espacios patrocinados", search: "Buscar anuncio...", action: "Nuevo anuncio" },
    usuarios: { title: "Usuarios", subtitle: "Administra los permisos de las cuentas", search: "Buscar por correo...", action: null },
    trafico: { title: "Tráfico del sitio", subtitle: "Estadísticas y analítica", search: "Buscar...", action: null }
  };

  function setSection(name) {
    state.section = name;
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.dataset.section === name);
    });
    document.querySelectorAll(".section").forEach(function (sec) {
      sec.classList.toggle("active", sec.dataset.view === name);
    });

    var meta = sectionMeta[name] || { title: name, subtitle: "", search: "Buscar...", action: null };
    var pageTitle = document.getElementById("pageTitle");
    var pageSub = document.getElementById("pageSubtitle");
    var searchInput = document.getElementById("searchInput");
    var actionBtn = document.getElementById("primaryAction");

    if (pageTitle) pageTitle.textContent = meta.title;
    if (pageSub) {
      pageSub.textContent =
        name === "noticias" ? fmt(state.noticiasTotal) + " noticias en total" :
        name === "categorias" ? fmt(categorias.length) + " categorías activas" :
        name === "anuncios" ? fmt(anuncios.length) + " anuncios configurados" :
        meta.subtitle;
    }
    if (searchInput) {
      searchInput.placeholder = meta.search;
      searchInput.value = "";
    }

    if (actionBtn) {
      if (name === "categorias") {
        actionBtn.style.display = "inline-flex";
        actionBtn.textContent = "+ Nueva categoría";
        actionBtn.removeAttribute("href");
        actionBtn.onclick = function (e) {
          e.preventDefault();
          window.abrirModalNuevaCategoria();
        };
      } else if (name === "anuncios") {
        actionBtn.style.display = "inline-flex";
        actionBtn.textContent = "+ Nuevo anuncio";
        actionBtn.removeAttribute("href");
        actionBtn.onclick = function (e) {
          e.preventDefault();
          window.abrirModalNuevoAnuncio();
        };
      } else if (name === "noticias" || name === "resumen") {
        actionBtn.style.display = "inline-flex";
        actionBtn.textContent = "+ Nueva noticia";
        actionBtn.setAttribute("href", "crear-noticia.html");
        actionBtn.onclick = null;
      } else {
        actionBtn.style.display = "none";
      }
    }

    if (name === "resumen") { renderResumenStats(); renderCobertura(); }
    if (name === "noticias") { state.noticiasQuery = ""; renderNoticias(); }
    if (name === "categorias") renderCategorias();
    if (name === "comentarios") { state.comentariosQuery = ""; renderComentarios(); }
    if (name === "anuncios") renderAnuncios();
    if (name === "usuarios") cargarUsuarios();

    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  }

  function filtrarUsuarios(query) {
    document.querySelectorAll("#usuariosBody tr").forEach(function (fila) {
      fila.hidden = !fila.cells[0].textContent.toLowerCase().includes(query);
    });
  }

  async function cargarUsuarios() {
    if (!adminId || usuariosOcupado) return;

    var body = document.getElementById("usuariosBody");
    var aviso = document.getElementById("usuariosAviso");
    usuariosOcupado = true;
    body.textContent = "";
    aviso.textContent = "Cargando usuarios...";

    try {
      var { data, error } = await window.supabase.rpc("listar_usuarios");
      if (error) throw error;

      data.forEach(function (usuario) {
        var fila = body.insertRow();
        fila.insertCell().textContent = usuario.email || usuario.id;
        fila.insertCell().textContent = usuario.rol === "admin" ? "Administrador" : "Usuario";

        var boton = document.createElement("button");
        var esAdmin = usuario.rol === "admin";
        boton.type = "button";
        boton.className = esAdmin ? "btn-text danger" : "btn-text";
        boton.textContent = esAdmin ? "Quitar admin" : "Dar admin";
        boton.addEventListener("click", function () {
          cambiarRolUsuario(usuario, boton);
        });
        fila.insertCell().appendChild(boton);
      });

      var busqueda = document.getElementById("searchInput");
      if (state.section === "usuarios" && busqueda) {
        filtrarUsuarios(busqueda.value.toLowerCase().trim());
      }
      aviso.textContent = data.length ? "" : "No hay usuarios registrados.";
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      aviso.textContent = "No se pudieron cargar los usuarios.";
    } finally {
      usuariosOcupado = false;
    }
  }

  async function cambiarRolUsuario(usuario, boton) {
    if (usuariosOcupado) return;

    var rol = usuario.rol === "admin" ? "user" : "admin";
    var accion = rol === "admin" ? "dar permisos de administrador a " : "quitar los permisos de administrador a ";
    if (!confirm("¿Quieres " + accion + (usuario.email || usuario.id) + "?")) return;

    usuariosOcupado = true;
    boton.disabled = true;

    try {
      var { error } = await window.supabase.rpc("cambiar_rol_usuario", {
        p_usuario_id: usuario.id,
        p_rol: rol
      });
      if (error) throw error;

      if (usuario.id === adminId && rol === "user") {
        adminId = null;
        document.getElementById("adminAppContainer").style.display = "none";
        try {
          var salida = await window.supabase.auth.signOut({ scope: "local" });
          if (salida.error) throw salida.error;
        } catch (err) {
          console.error("Error al cerrar la sesión:", err);
          alert("Tu rol cambió. Cierra sesión y vuelve a entrar para actualizar tus permisos.");
        }
        window.location.replace("latinos-en-pelota.html");
        return;
      }

      showToast("Rol actualizado", "La cuenta debe cerrar sesión y volver a entrar para actualizar sus permisos.", "success");
    } catch (err) {
      console.error("Error al cambiar el rol:", err);
      showToast("Error", err.message || "No se pudo cambiar el rol.", "error");
      return;
    } finally {
      usuariosOcupado = false;
      boton.disabled = false;
    }

    await cargarUsuarios();
  }

  async function cargarAnunciosDesdeSupabase() {
    if (!window.supabase) return;
    try {
      var { data, error } = await window.supabase
        .from("anuncios")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      anuncios = data || [];
      updateNavBadges();
      renderAnuncios();
    } catch (err) {
      console.error("Error al cargar anuncios:", err);
    }
  }

  function renderAnuncios() {
    var body = document.getElementById("anunciosBody");
    if (!body) return;

    if (anuncios.length === 0) {
      body.innerHTML =
        '<tr><td colspan="6"><div class="empty-state">' +
        '<div class="empty-state-icon">📢</div>' +
        '<h3>No hay anuncios registrados</h3>' +
        '<p>Crea tu primer anuncio para monetizar el portal de noticias.</p>' +
        '<button class="btn btn-primary" onclick="abrirModalNuevoAnuncio()" style="margin-top:10px;">+ Nuevo Anuncio</button>' +
        '</div></td></tr>';
      return;
    }

    body.innerHTML = anuncios.map(function (ad) {
      var estadoBadge = ad.activo
        ? '<span class="pill pill--success">Activo</span>'
        : '<span class="pill pill--muted">Inactivo</span>';
      var toggleLabel = ad.activo ? "Pausar" : "Activar";

      return "<tr>" +
        '<td style="width:70px;">' + (window.cookiesOpcionales
          ? '<img src="' + escapeHtml(ad.imagen_url) + '" alt="' + escapeHtml(ad.titulo) + '" style="width:60px;height:40px;object-fit:cover;border-radius:4px;background:#000;" onerror="this.src=\'assets/Logo latinos .png\'">'
          : "—") + '</td>' +
        '<td style="font-weight:700;">' + escapeHtml(ad.titulo) + '</td>' +
        '<td><span class="pill pill--accent">' + escapeHtml(ad.ubicacion || "sidebar") + '</span></td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-size:12.5px;">' + escapeHtml(ad.enlace_url) + '</a></td>' +
        '<td>' + estadoBadge + '</td>' +
        '<td>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button class="btn-text" onclick="toggleEstadoAnuncio(' + ad.id + ')">' + toggleLabel + '</button>' +
        '<button class="btn-text" onclick="abrirModalEditarAnuncio(' + ad.id + ')">Editar</button>' +
        '<button class="btn-text danger" onclick="eliminarAnuncio(' + ad.id + ')">Eliminar</button>' +
        '</div>' +
        '</td>' +
        "</tr>";
    }).join("");
  }

  window.abrirModalNuevoAnuncio = function () {
    state.editingAnuncioId = null;
    document.getElementById("modalAnuncioTitulo").textContent = "Nuevo Anuncio";
    document.getElementById("anuncioTituloInput").value = "";
    document.getElementById("anuncioImagenInput").value = "";
    document.getElementById("anuncioEnlaceInput").value = "";
    document.getElementById("anuncioUbicacionInput").value = "sidebar";
    document.getElementById("anuncioActivoInput").checked = true;
    document.getElementById("anuncioErrorMsg").style.display = "none";
    document.getElementById("modalAnuncio").classList.add("open");
    setTimeout(function () { document.getElementById("anuncioTituloInput").focus(); }, 100);
  };

  window.abrirModalEditarAnuncio = function (id) {
    var ad = anuncios.find(function (a) { return a.id === id; });
    if (!ad) return;

    state.editingAnuncioId = id;
    document.getElementById("modalAnuncioTitulo").textContent = "Editar Anuncio";
    document.getElementById("anuncioTituloInput").value = ad.titulo || "";
    document.getElementById("anuncioImagenInput").value = ad.imagen_url || "";
    document.getElementById("anuncioEnlaceInput").value = ad.enlace_url || "";
    document.getElementById("anuncioUbicacionInput").value = ad.ubicacion || "sidebar";
    document.getElementById("anuncioActivoInput").checked = !!ad.activo;
    document.getElementById("anuncioErrorMsg").style.display = "none";
    document.getElementById("modalAnuncio").classList.add("open");
  };

  window.cerrarModalAnuncio = function () {
    document.getElementById("modalAnuncio").classList.remove("open");
    state.editingAnuncioId = null;
  };

  async function guardarAnuncio() {
    var titulo = document.getElementById("anuncioTituloInput").value.trim();
    var imagen = document.getElementById("anuncioImagenInput").value.trim();
    var enlace = document.getElementById("anuncioEnlaceInput").value.trim();
    var ubicacion = document.getElementById("anuncioUbicacionInput").value;
    var activo = document.getElementById("anuncioActivoInput").checked;
    var errorEl = document.getElementById("anuncioErrorMsg");
    var btn = document.getElementById("btnGuardarAnuncio");

    if (!titulo || !imagen || !enlace) {
      errorEl.textContent = "Todos los campos son obligatorios.";
      errorEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      var payload = {
        titulo: titulo,
        imagen_url: imagen,
        enlace_url: enlace,
        ubicacion: ubicacion,
        activo: activo
      };

      if (state.editingAnuncioId) {
        var { error } = await window.supabase
          .from("anuncios")
          .update(payload)
          .eq("id", state.editingAnuncioId);
        if (error) throw error;
        showToast("Éxito", "Anuncio actualizado correctamente.", "success");
      } else {
        var { error: insErr } = await window.supabase
          .from("anuncios")
          .insert([payload]);
        if (insErr) throw insErr;
        showToast("Éxito", "Anuncio creado correctamente.", "success");
      }

      cerrarModalAnuncio();
      await cargarAnunciosDesdeSupabase();
    } catch (err) {
      console.error("Error al guardar anuncio:", err);
      errorEl.textContent = err.message || "Error al comunicarse con la base de datos.";
      errorEl.style.display = "block";
      showToast("Error", err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar Anuncio";
    }
  }

  window.toggleEstadoAnuncio = async function (id) {
    var ad = anuncios.find(function (a) { return a.id === id; });
    if (!ad) return;

    try {
      var { error } = await window.supabase
        .from("anuncios")
        .update({ activo: !ad.activo })
        .eq("id", id);

      if (error) throw error;
      showToast("Actualizado", "Estado del anuncio modificado.", "success");
      await cargarAnunciosDesdeSupabase();
    } catch (e) {
      showToast("Error", e.message, "error");
    }
  };

  window.eliminarAnuncio = async function (id) {
    var ad = anuncios.find(function (a) { return a.id === id; });
    if (!ad) return;
    if (!confirm('¿Deseas eliminar el anuncio "' + ad.titulo + '"?')) return;

    try {
      var { error } = await window.supabase
        .from("anuncios")
        .delete()
        .eq("id", id);

      if (error) throw error;
      showToast("Eliminado", "Anuncio eliminado correctamente.", "success");
      await cargarAnunciosDesdeSupabase();
    } catch (e) {
      showToast("Error", e.message, "error");
    }
  };

  document.addEventListener("DOMContentLoaded", async function () {
    configurarLogin();
    window.addEventListener("preferencias-cookies", renderAnuncios);
    var haySesion = await verificarSesion();

    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.addEventListener("click", function () {
        if (item.dataset.section) setSection(item.dataset.section);
      });
    });

    var menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
      menuToggle.addEventListener("click", function () {
        var sb = document.getElementById("sidebar");
        if (sb) sb.classList.toggle("open");
      });
    }

    var searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        var q = e.target.value.toLowerCase().trim();
        if (state.section === "noticias") {
          state.noticiasQuery = q;
          state.noticiasPage = 1;
          renderNoticias();
        } else if (state.section === "comentarios") {
          state.comentariosQuery = q;
          renderComentarios();
        } else if (state.section === "usuarios") {
          filtrarUsuarios(q);
        } else if (state.section === "categorias") {
          document.querySelectorAll("#categoriasGrid .cat-card").forEach(function (card, i) {
            if (!categorias[i]) return;
            var match = categorias[i].nombre.toLowerCase().indexOf(q) !== -1;
            card.style.display = q && !match ? "none" : "";
          });
        }
      });
    }

    var filtroCat = document.getElementById("filtroCategoria");
    if (filtroCat) {
      filtroCat.addEventListener("change", function (e) {
        state.noticiasCategoria = e.target.value;
        state.noticiasPage = 1;
        renderNoticias();
      });
    }

    var filtroEst = document.getElementById("filtroEstado");
    if (filtroEst) {
      filtroEst.addEventListener("change", function (e) {
        state.noticiasEstado = e.target.value;
        state.noticiasPage = 1;
        renderNoticias();
      });
    }

    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.comentariosTab = btn.dataset.tab;
        renderComentarios();
      });
    });

    var prevBtn = document.getElementById("noticiasPrev");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (state.noticiasPage > 1) { state.noticiasPage--; renderNoticias(); }
      });
    }

    var nextBtn = document.getElementById("noticiasNext");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        state.noticiasPage++;
        renderNoticias();
      });
    }

    var notiBody = document.getElementById("noticiasBody");
    if (notiBody) {
      notiBody.addEventListener("click", function (e) {
        var toggleId = e.target.getAttribute("data-toggle-noticia");
        var deleteId = e.target.getAttribute("data-delete-noticia");
        if (toggleId) toggleEstadoNoticia(Number(toggleId));
        if (deleteId) eliminarNoticia(Number(deleteId));
      });
    }

    var formCat = document.getElementById("formCategoria");
    if (formCat) {
      formCat.addEventListener("submit", function (e) {
        e.preventDefault();
        guardarCategoria();
      });
    }

    var btnConfirmDel = document.getElementById("btnConfirmDelCat");
    if (btnConfirmDel) {
      btnConfirmDel.addEventListener("click", confirmarEliminarCategoria);
    }

    var formAnun = document.getElementById("formAnuncio");
    if (formAnun) {
      formAnun.addEventListener("submit", function (e) {
        e.preventDefault();
        guardarAnuncio();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        cerrarModalCategoria();
        cerrarModalEliminarCat();
        cerrarModalAnuncio();
      }
    });

    if (haySesion) {
      cargarCategoriasDesdeSupabase();
      cargarNoticiasDesdeSupabase();
      cargarComentariosDesdeSupabase();
      cargarAnunciosDesdeSupabase();
    }

    var params = new URLSearchParams(window.location.search);
    if (haySesion && params.get("seccion")) {
      setSection(params.get("seccion"));
    }
    if (params.get("creada") === "1") {
      showToast("¡Excelente!", "La noticia ha sido registrada correctamente.", "success");
    }
  });

})();
