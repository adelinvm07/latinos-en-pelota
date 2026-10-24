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

  // Enlace a la página de lectura de la noticia
  function urlNoticia(item) {
    return "noticia.html?slug=" + encodeURIComponent(item.slug);
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
        .select("id, slug, titulo, subtitulo, imagen_url, estado, publicado_en, es_destacada, categorias(id, nombre)")
        .eq("estado", "publicado")
        .order("publicado_en", { ascending: false });

      if (error) throw error;

      todasLasNoticias = (data || []).map(function (item) {
        return {
          id: item.id,
          slug: item.slug,
          titulo: item.titulo || "Sin título",
          subtitulo: item.subtitulo || "",
          imagen: item.imagen_url || IMAGEN_PLACEHOLDER,
          categoria: item.categorias ? item.categorias.nombre : "General",
          fecha: formatearFecha(item.publicado_en),
         esDestacada: Boolean(item['es_destacada'])
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

    var sinFiltros = categoriaActiva === "Todas" && textoBusqueda.length === 0;

    // Noticia destacada: la marcada como destacada o, si no hay, la más reciente
    var destacada = todasLasNoticias.find(function (n) { return n.esDestacada; }) || todasLasNoticias[0];
    var mostrarHero = sinFiltros && !!destacada;

    // Sin banner, las noticias suben a la primera fila (ver CSS main.sin-hero)
    var mainEl = document.querySelector("main");
    if (mainEl) mainEl.classList.toggle("sin-hero", !mostrarHero);

    // 1. Banner principal (solo sin búsqueda ni filtro de categoría)
    if (heroArticulo) {
      if (mostrarHero) {
        heroArticulo.style.display = ""; // lo decide el CSS de .hero (flex)
        heroArticulo.innerHTML =
          '<div class="media">' +
            '<a href="' + urlNoticia(destacada) + '" style="display:block;height:100%">' +
              '<img src="' + escapeHtml(destacada.imagen) + '" alt="' + escapeHtml(destacada.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
            '</a>' +
          '</div>' +
          '<div class="body">' +
            '<span class="tag ' + obtenerClaseTag(destacada.categoria) + '">' + escapeHtml(destacada.categoria.toUpperCase()) + '</span>' +
            '<h2><a href="' + urlNoticia(destacada) + '">' + escapeHtml(destacada.titulo) + '</a></h2>' +
            (destacada.subtitulo ? '<p>' + escapeHtml(destacada.subtitulo) + '</p>' : '') +
            '<div class="byline">Redacción · ' + destacada.fecha + '</div>' +
          '</div>';
      } else {
        heroArticulo.style.display = "none";
      }
    }

    // 2. La destacada no se repite abajo, pero solo si el banner está a la vista
    var noticiasGrid = mostrarHero
      ? lista.filter(function (item) { return item.id !== destacada.id; })
      : lista;

    if (noticiasGrid.length === 0) {
      // Solo hay una noticia y ya está en el banner: la cuadrícula queda vacía
      if (mostrarHero) {
        gridNoticias.innerHTML = "";
        return;
      }

      var mensaje = todasLasNoticias.length === 0
        ? "Aún no hay noticias publicadas en la base de datos."
        : 'No hay noticias que coincidan con la búsqueda "' + escapeHtml(textoBusqueda || categoriaActiva) + '".';

      gridNoticias.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 6px; border: 1px solid var(--line);">' +
          '<h3 style="margin: 0 0 8px; font-size: 18px; color: var(--navy);">Sin resultados</h3>' +
          '<p style="margin: 0; font-size: 14px; color: var(--muted);">' + mensaje + '</p>' +
        '</div>';
      return;
    }

    // 3. Cuadrícula de noticias
    gridNoticias.innerHTML = noticiasGrid.map(function (item) {
      var enlace = urlNoticia(item);
      return (
        '<article class="story">' +
          '<div class="media">' +
            '<a href="' + enlace + '" style="display:block;height:100%">' +
              '<img src="' + escapeHtml(item.imagen) + '" alt="' + escapeHtml(item.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
            '</a>' +
          '</div>' +
          '<span class="tag ' + obtenerClaseTag(item.categoria) + '">' + escapeHtml(item.categoria.toUpperCase()) + '</span>' +
          '<h3><a href="' + enlace + '">' + escapeHtml(item.titulo) + '</a></h3>' +
          '<p>' + escapeHtml(item.subtitulo) + '</p>' +
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