
(function () {
  "use strict";

  var todasLasNoticias = [];
  var categoriaActiva = "Todas";
  var textoBusqueda = "";

  // Elementos del DOM
  var contenedorTabs = document.getElementById("contenedor-tabs");
  var inputBusqueda = document.querySelector(".search-box input");
  var formBusqueda = document.querySelector(".search-box");
  var gridNoticias = document.querySelector(".grid");
  var heroArticulo = document.querySelector("article.hero");

  var IMAGEN_PLACEHOLDER = "https://commons.wikimedia.org/wiki/Special:FilePath/Etihad%20Stadium.jpg";

  function obtenerClaseTag(categoria) {
    if (!categoria) return "futbol-red";
    var catLower = categoria.toLowerCase();
    if (catLower.includes("fútbol") || catLower.includes("futbol")) return "futbol";
    if (catLower.includes("baloncesto") || catLower.includes("basket")) return "baloncesto";
    if (catLower.includes("atletismo")) return "atletismo";
    return "futbol-red";
  }

  function formatearFecha(isoString) {
    if (!isoString) return "Reciente";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "Reciente";
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
  }

  // =========================================================================
  // CARGAR CATEGORÍAS REALES DESDE SUPABASE
  // =========================================================================
  async function cargarCategorias() {
    if (!window.supabase || !contenedorTabs) return;

    try {
      var { data, error } = await window.supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) throw error;

      var searchBoxHtml = contenedorTabs.querySelector(".search-box").outerHTML;

      // Construir las pestañas dinámicamente
      var htmlTabs = '<a href="#" class="active">Todas</a>';

      if (data && data.length > 0) {
        data.forEach(function (cat) {
          htmlTabs += '<a href="#">' + escapeHtml(cat.nombre) + '</a>';
        });
      }

      contenedorTabs.innerHTML = htmlTabs + searchBoxHtml;

      // Re-vincular los elementos del buscador y eventos de las nuevas pestañas
      inputBusqueda = document.querySelector(".search-box input");
      formBusqueda = document.querySelector(".search-box");
      inicializarEventos();

    } catch (err) {
      console.error("Error al cargar categorías dinámicas desde Supabase:", err);
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // =========================================================================
  // CARGAR NOTICIAS DESDE SUPABASE
  // =========================================================================
  async function cargarNoticias() {
    if (!window.supabase) return;

    if (gridNoticias) {
      gridNoticias.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px 0;">Cargando noticias desde Supabase...</p>';
    }

    try {
      var { data, error } = await window.supabase
        .from("noticias")
        .select("id, titulo, subtitulo, imagen_url, estado, publicado_en, categorias(id, nombre)")
        .eq("estado", "publicado")
        .order("publicado_en", { ascending: false });

      if (error) throw error;

      todasLasNoticias = (data || []).map(function (item) {
        return {
          id: item.id,
          titulo: item.titulo || "Sin título",
          subtitulo: item.subtitulo || "",
          imagen: item.imagen_url || IMAGEN_PLACEHOLDER,
          categoria: item.categorias ? item.categorias.nombre : "General",
          fecha: formatearFecha(item.publicado_en)
        };
      });

      aplicarFiltros();

    } catch (err) {
      console.error("Error cargando noticias desde Supabase:", err);
      if (gridNoticias) {
        gridNoticias.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0;">Error al conectar con la base de datos.</p>';
      }
    }
  }

  // =========================================================================
  // FILTRADO Y RENDERIZADO
  // =========================================================================
  function aplicarFiltros() {
    if (!gridNoticias) return;

    var noticiasFiltradas = todasLasNoticias.filter(function (noticia) {
      var coincideCategoria = (categoriaActiva === "Todas") ||
        (noticia.categoria.toLowerCase() === categoriaActiva.toLowerCase());

      var term = textoBusqueda.toLowerCase();
      var coincideTexto = !term ||
        noticia.titulo.toLowerCase().includes(term) ||
        noticia.subtitulo.toLowerCase().includes(term) ||
        noticia.categoria.toLowerCase().includes(term);

      return coincideCategoria && coincideTexto;
    });

    renderizarResultados(noticiasFiltradas);
  }

  function renderizarResultados(lista) {
    if (!gridNoticias) return;

    if (heroArticulo) {
      if (categoriaActiva !== "Todas" || textoBusqueda.length > 0) {
        heroArticulo.style.display = "none";
      } else {
        heroArticulo.style.display = "block";
      }
    }

    if (lista.length === 0) {
      var mensaje = todasLasNoticias.length === 0
        ? "Aún no hay noticias publicadas en la base de datos."
        : 'No hay noticias que coincidan con la búsqueda "' + (textoBusqueda || categoriaActiva) + '".';

      gridNoticias.innerHTML = 
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 6px; border: 1px solid var(--line);">' +
          '<h3 style="margin: 0 0 8px; font-size: 18px; color: var(--navy);">Sin resultados</h3>' +
          '<p style="margin: 0; font-size: 14px; color: var(--muted);">' + mensaje + '</p>' +
        '</div>';
      return;
    }

    gridNoticias.innerHTML = lista.map(function (item) {
      var claseTag = obtenerClaseTag(item.categoria);
      return (
        '<article class="story">' +
          '<div class="media">' +
            '<img src="' + item.imagen + '" alt="' + item.titulo + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
          '</div>' +
          '<span class="tag ' + claseTag + '">' + item.categoria.toUpperCase() + '</span>' +
          '<h3><a href="#">' + item.titulo + '</a></h3>' +
          '<p>' + item.subtitulo + '</p>' +
          '<div class="byline">Redacción · ' + item.fecha + '</div>' +
        '</article>'
      );
    }).join("");
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function inicializarEventos() {
    if (formBusqueda) {
      formBusqueda.addEventListener("submit", function (e) {
        e.preventDefault();
      });
    }

    if (inputBusqueda) {
      inputBusqueda.addEventListener("input", function (e) {
        textoBusqueda = e.target.value.trim();
        aplicarFiltros();
      });
    }

    var tabs = document.querySelectorAll("nav.tabs a");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        tabs.forEach(function (t) { t.classList.remove("active"); });
        this.classList.add("active");
        categoriaActiva = this.textContent.trim();
        aplicarFiltros();
      });
    });
  }

  function actualizarFechaHoy() {
    var fechaElemento = document.getElementById("fecha-hoy");
    if (!fechaElemento) return;
    var hoy = new Date();
    var opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var fechaFormateada = hoy.toLocaleDateString('es-ES', opciones);
    fechaElemento.textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
  }

  document.addEventListener("DOMContentLoaded", async function () {
    actualizarFechaHoy();
    await cargarCategorias();
    await cargarNoticias();
  });

})();

