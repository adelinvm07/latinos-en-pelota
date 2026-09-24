/**
 * Latinos en Pelota — Lógica del Panel de Administración
 * Autenticación de Administrador, Gestión de Categorías y Noticias con Supabase.
 */

(function () {
  "use strict";

  // Estado global de la vista
  var state = {
    section: "resumen",
    noticiasQuery: "",
    noticiasCategoria: "todas",
    noticiasEstado: "todos",
    noticiasPage: 1,
    noticiasTotal: 0,
    comentariosTab: "pendiente",
    comentariosPendientesTotal: 47,
    editingCatId: null,
    deletingCatId: null,
    isRegisterMode: false
  };

  var PAGE_SIZE = 8;
  var categorias = [];
  var noticias = [];

  // Paleta de colores para las tarjetas de categorías
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

  // Datos mock para secciones estáticas (Autores, Comentarios)
  var autores = [
    { id: 1, nombre: "Yolanda Payano", rol: "Editora de Béisbol", articulos: 74, desde: "ene 2023" },
    { id: 2, nombre: "Rafael Contreras", rol: "Editor de Fútbol", articulos: 58, desde: "mar 2023" },
    { id: 3, nombre: "Manuel Disla", rol: "Boxeo y Baloncesto", articulos: 65, desde: "ago 2023" },
    { id: 4, nombre: "Ana Beatriz Reyes", rol: "Sección Nacional", articulos: 41, desde: "jun 2024" },
    { id: 5, nombre: "Diego Santana", rol: "Internacional y Economía", articulos: 47, desde: "feb 2025" },
    { id: 6, nombre: "Camila Vásquez", rol: "Entretenimiento", articulos: 27, desde: "oct 2025" }
  ];

  var comentarios = [
    { id: 1, autor: "Ramón Féliz", texto: "¡Por fin una temporada donde el Licey juega en serio! Ese noveno inning fue una locura.", articulo: "El Escogido remonta en el noveno", fecha: "2026-09-03", estado: "pendiente" },
    { id: 2, autor: "Carmen Ozuna", texto: "¿Alguien sabe si van a transmitir el partido por streaming también?", articulo: "República Dominicana estrena su roster preliminar", fecha: "2026-09-03", estado: "pendiente" },
    { id: 3, autor: "Luis Almonte", texto: "Excelente análisis, aunque creo que le faltó mencionar el bullpen.", articulo: "Las Águilas Cibaeñas aseguran su boleto", fecha: "2026-09-02", estado: "pendiente" },
    { id: 4, autor: "Yesenia Paulino", texto: "Ojalá el Cibao FC pueda sostener este nivel en la liguilla.", articulo: "Cibao FC se corona campeón", fecha: "2026-09-02", estado: "aprobado" }
  ];

  // =========================================================================
  // SISTEMA DE NOTIFICACIONES TOAST
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

  // =========================================================================
  // HELPERS
  // =========================================================================
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

  // =========================================================================
  // AUTENTICACIÓN Y CONTROL DE ACCESO
  // =========================================================================
  async function verificarSesion() {
    if (!window.supabase) return false;

    try {
      var { data, error } = await window.supabase.auth.getSession();
      if (error) throw error;

      var loginScreen = document.getElementById("adminLoginScreen");
      var session = data ? data.session : null;

      if (!session) {
        // No hay sesión activa: mostrar login exclusivo
        if (loginScreen) loginScreen.style.display = "flex";
        return false;
      } else {
        // Sesión activa: mostrar panel y actualizar info de usuario
        if (loginScreen) loginScreen.style.display = "none";

        var user = session.user;
        var email = user.email || "";
        var userName = email ? (email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1)) : "Usuario";

        var nameEl = document.getElementById("userNameDisplay");
        var emailEl = document.getElementById("userEmailDisplay");
        var avatarEl = document.getElementById("userAvatar");

        if (nameEl) nameEl.textContent = userName;
        if (emailEl) emailEl.textContent = email;
        if (avatarEl) avatarEl.textContent = email ? email.slice(0, 2).toUpperCase() : "--";

        return true;
      }
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

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = emailInput.value.trim();
        var pass = passInput.value.trim();

        if (!email || !pass) return;

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Verificando...";
        errorEl.style.display = "none";

        try {
          var { data: loginData, error: loginError } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: pass
          });

          if (loginError) throw loginError;

          showToast("Acceso Concedido", "Sesión iniciada correctamente.", "success");
          await verificarSesion();
          await cargarCategoriasDesdeSupabase();
          await cargarNoticiasDesdeSupabase();
        } catch (err) {
          console.error("Error de autenticación:", err);
          var msg = "Correo o contraseña incorrectos. Solo el personal autorizado puede acceder.";
          errorEl.textContent = msg;
          errorEl.style.display = "block";
          errorEl.style.color = "var(--danger)";
          errorEl.style.background = "var(--danger-soft)";
        } finally {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Iniciar Sesión";
        }
      });
    }

    // Botón de Cerrar Sesión
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

  // =========================================================================
  // CONEXIÓN CON SUPABASE: CARGA DE CATEGORÍAS Y NOTICIAS
  // =========================================================================
  async function cargarCategoriasDesdeSupabase() {
    if (!window.supabase) return;

    try {
      // 1. Obtener todas las categorías ordenadas por nombre
      var { data: catData, error: catError } = await window.supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (catError) throw catError;

      // 2. Obtener conteo de noticias por categoría
      var { data: notiData, error: notiError } = await window.supabase
        .from("noticias")
        .select("id, categoria_id");

      var countMap = {};
      if (notiData) {
        notiData.forEach(function (n) {
          if (n.categoria_id) {
            countMap[n.categoria_id] = (countMap[n.categoria_id] || 0) + 1;
          }
        });
      }

      categorias = (catData || []).map(function (cat, idx) {
        return {
          id: cat.id,
          nombre: cat.nombre,
          count: countMap[cat.id] || 0,
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
          estado: item.estado ? (item.estado.charAt(0).toUpperCase() + item.estado.slice(1).toLowerCase()) : "Publicado",
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

  // =========================================================================
  // GESTIÓN DE CATEGORÍAS (CRUD CON SUPABASE)
  // =========================================================================
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
        // Modificar categoría existente
        var { error } = await window.supabase
          .from("categorias")
          .update({ nombre: nombre })
          .eq("id", state.editingCatId);

        if (error) throw error;
        showToast("Éxito", 'Categoría "' + nombre + '" actualizada.', "success");
      } else {
        // Crear nueva categoría
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

  // =========================================================================
  // RENDER: RESUMEN
  // =========================================================================
  function renderResumenStats() {
    var statNoticias = document.getElementById("statNoticias");
    var statAutores = document.getElementById("statAutores");
    var statComentarios = document.getElementById("statComentarios");

    if (statNoticias) statNoticias.textContent = fmt(state.noticiasTotal);
    if (statAutores) statAutores.textContent = fmt(autores.length);
    if (statComentarios) statComentarios.textContent = fmt(state.comentariosPendientesTotal);
  }

  // =========================================================================
  // RENDER: CATEGORÍAS
  // =========================================================================
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

  // =========================================================================
  // RENDER: NOTICIAS
  // =========================================================================
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
        '<tr><td colspan="7"><div class="empty-state">' +
        '<div class="empty-state-icon">📰</div>' +
        '<h3>No se encontraron noticias</h3>' +
        '<p>' + (noticias.length === 0 ? "Aún no hay noticias creadas en la base de datos." : "No hay noticias que coincidan con el filtro actual.") + '</p>' +
        (noticias.length === 0 ? '<a href="crear-noticia.html" class="btn btn-primary" style="margin-top:10px;">+ Crear Primera Noticia</a>' : '') +
        '</div></td></tr>';
    } else {
      body.innerHTML = pageItems.map(function (item) {
        var isPub = item.estado.toLowerCase() === "publicado";
        var pillClass = isPub ? "pill--success" : "pill--muted";
        var toggleLabel = isPub ? "Pasar a Borrador" : "Publicar";

        return "<tr>" +
          '<td class="title-cell">' +
          '<div style="font-weight:600;color:#fff;">' + escapeHtml(item.titulo) + '</div>' +
          (item.subtitulo ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(item.subtitulo) + '</div>' : '') +
          '</td>' +
          '<td><span class="pill pill--accent">' + escapeHtml(item.categoria) + '</span></td>' +
          '<td>Redacción</td>' +
          '<td><span class="pill ' + pillClass + '">' + escapeHtml(item.estado) + '</span></td>' +
          '<td class="meta-muted">—</td>' +
          '<td class="meta-muted">' + fechaCorta(item.fecha) + '</td>' +
          '<td>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
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

  // =========================================================================
  // RENDER: AUTORES & COMENTARIOS
  // =========================================================================
  function renderAutores() {
    var grid = document.getElementById("autoresGrid");
    if (!grid) return;
    grid.innerHTML = autores.map(function (a, idx) {
      var color = catPalette[idx % catPalette.length];
      var init = a.nombre.split(" ").map(function (p) { return p[0]; }).join("").toUpperCase().slice(0, 2);
      return (
        '<div class="author-card" style="border-top-color:' + color + '">' +
        '<div class="author-top">' +
        '<div class="avatar" style="background:' + color + ';color:#fff;">' + init + '</div>' +
        '<div><div class="author-name">' + escapeHtml(a.nombre) + '</div><div class="author-role">' + escapeHtml(a.rol) + '</div></div>' +
        '</div>' +
        '<div class="author-stats">' +
        '<div class="author-stat"><b>' + fmt(a.articulos) + '</b><span>Artículos</span></div>' +
        '<div class="author-stat"><b>' + a.desde + '</b><span>En el equipo</span></div>' +
        '</div>' +
        '</div>'
      );
    }).join("");
  }

  function renderComentarios() {
    var list = document.getElementById("comentariosList");
    if (!list) return;

    var filtered = comentarios.filter(function (c) { return c.estado === state.comentariosTab; });

    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === state.comentariosTab);
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>No hay comentarios en esta pestaña.</p></div>';
      return;
    }

    list.innerHTML = filtered.map(function (item) {
      return (
        '<div class="panel" style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
        '<strong>' + escapeHtml(item.autor) + '</strong>' +
        '<span class="meta-muted" style="font-size:12px;">' + fechaCorta(item.fecha) + '</span>' +
        '</div>' +
        '<p style="font-size:14px;color:var(--text);margin-bottom:8px;">' + escapeHtml(item.texto) + '</p>' +
        '<div style="font-size:12px;color:var(--text-muted);">En: <i>' + escapeHtml(item.articulo) + '</i></div>' +
        '</div>'
      );
    }).join("");
  }

  // =========================================================================
  // NAV BADGES & SECCIÓN
  // =========================================================================
  function updateNavBadges() {
    var bNoti = document.getElementById("badgeNoticias");
    var bCat = document.getElementById("badgeCategorias");
    var bAut = document.getElementById("badgeAutores");
    var bCom = document.getElementById("badgeComentarios");

    if (bNoti) bNoti.textContent = fmt(state.noticiasTotal);
    if (bCat) bCat.textContent = fmt(categorias.length);
    if (bAut) bAut.textContent = fmt(autores.length);
    if (bCom) bCom.textContent = fmt(state.comentariosPendientesTotal);
  }

  var sectionMeta = {
    resumen: { title: "Resumen del sitio", subtitle: "Panel de control general", search: "Buscar noticias, autores...", action: "Nueva noticia" },
    noticias: { title: "Gestión de Noticias", subtitle: "Publicaciones", search: "Buscar noticia por título...", action: "Nueva noticia" },
    categorias: { title: "Gestión de Categorías", subtitle: "Organiza las secciones deportivas", search: "Buscar categoría...", action: "Nueva categoría" },
    autores: { title: "Equipo Editorial", subtitle: "Autores y redactores", search: "Buscar autor...", action: null },
    comentarios: { title: "Comentarios", subtitle: "Moderación de comentarios", search: "Buscar comentario...", action: null },
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
        name === "noticias" ? fmt(state.noticiasTotal) + " noticias en base de datos" :
        name === "categorias" ? fmt(categorias.length) + " categorías activas" :
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
      } else if (name === "noticias" || name === "resumen") {
        actionBtn.style.display = "inline-flex";
        actionBtn.textContent = "+ Nueva noticia";
        actionBtn.setAttribute("href", "crear-noticia.html");
        actionBtn.onclick = null;
      } else {
        actionBtn.style.display = "none";
      }
    }

    if (name === "resumen") renderResumenStats();
    if (name === "noticias") { state.noticiasQuery = ""; renderNoticias(); }
    if (name === "categorias") renderCategorias();
    if (name === "autores") renderAutores();
    if (name === "comentarios") renderComentarios();

    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  }

  // =========================================================================
  // INICIALIZACIÓN Y EVENT LISTENERS
  // =========================================================================
  document.addEventListener("DOMContentLoaded", async function () {
    // 1. Configurar y verificar autenticación
    configurarLogin();
    var haySesion = await verificarSesion();

    // 2. Navegación en sidebar
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.addEventListener("click", function () {
        if (item.dataset.section) setSection(item.dataset.section);
      });
    });

    // 3. Menú móvil
    var menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
      menuToggle.addEventListener("click", function () {
        var sb = document.getElementById("sidebar");
        if (sb) sb.classList.toggle("open");
      });
    }

    // 4. Búsqueda
    var searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        var q = e.target.value.toLowerCase().trim();
        if (state.section === "noticias") {
          state.noticiasQuery = q;
          state.noticiasPage = 1;
          renderNoticias();
        } else if (state.section === "categorias") {
          document.querySelectorAll("#categoriasGrid .cat-card").forEach(function (card, i) {
            if (!categorias[i]) return;
            var match = categorias[i].nombre.toLowerCase().indexOf(q) !== -1;
            card.style.display = q && !match ? "none" : "";
          });
        }
      });
    }

    // 5. Filtros de Noticias
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

    // 6. Paginación Noticias
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

    // 7. Acciones en la tabla de noticias
    var notiBody = document.getElementById("noticiasBody");
    if (notiBody) {
      notiBody.addEventListener("click", function (e) {
        var toggleId = e.target.getAttribute("data-toggle-noticia");
        var deleteId = e.target.getAttribute("data-delete-noticia");
        if (toggleId) toggleEstadoNoticia(Number(toggleId));
        if (deleteId) eliminarNoticia(Number(deleteId));
      });
    }

    // 8. Modal Categoría
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

    // Cerrar modales con tecla Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        cerrarModalCategoria();
        cerrarModalEliminarCat();
      }
    });

    // Si hay sesión iniciada, cargar datos
    if (haySesion) {
      cargarCategoriasDesdeSupabase();
      cargarNoticiasDesdeSupabase();
    }

    // Comprobar parámetros de URL
    var params = new URLSearchParams(window.location.search);
    if (params.get("seccion")) {
      setSection(params.get("seccion"));
    }
    if (params.get("creada") === "1") {
      showToast("¡Excelente!", "La noticia ha sido registrada correctamente.", "success");
    }
  });

})();
