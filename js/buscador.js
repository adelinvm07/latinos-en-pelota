

(function () {
  "use strict";

  // Cache de noticias obtenidas de Supabase
  var todasLasNoticias = [];
  var categoriaActiva = "Todas";
  var textoBusqueda = "";

  // Elementos del DOM
  var inputBusqueda = document.querySelector(".search-box input");
  var formBusqueda = document.querySelector(".search-box");
  var tabsNavegacion = document.querySelectorAll("nav.tabs a");
  var gridNoticias = document.querySelector(".grid");
  var heroArticulo = document.querySelector("article.hero");

  // Imagen por defecto si la noticia no trae portada
  var IMAGEN_PLACEHOLDER = "https://commons.wikimedia.org/wiki/Special:FilePath/Etihad%20Stadium.jpg";

  // Mapeo de clases CSS para las etiquetas según la categoría
  function obtenerClaseTag(categoria) {
    if (!categoria) return "futbol-red";
    var catLower = categoria.toLowerCase();
    if (catLower.includes("fútbol") || catLower.includes("futbol")) return "futbol";
    if (catLower.includes("baloncesto") || catLower.includes("basket")) return "baloncesto";
    if (catLower.includes("atletismo")) return "atletismo";
    return "futbol-red";
  }

  // Formateador de fechas cortas
  function formatearFecha(isoString) {
    if (!isoString) return "Reciente";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "Reciente";
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
  }

  // ===============================
  // CARGAR NOTICIAS DESDE SUPABASE
  // ===============================
  async function cargarNoticias() {
    if (!window.supabase) {
      console.warn("Cliente Supabase no inicializado.");
      return;
    }

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

      // Renderizar vista
      aplicarFiltros();

    } catch (err) {
      console.error("Error cargando noticias desde Supabase:", err);
      if (gridNoticias) {
        gridNoticias.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0;">Error al conectar con la base de datos.</p>';
      }
    }
  }

  // ===================================
  // LÓGICA DE FILTRADO Y RENDERIZADO
  // ===================================
  function aplicarFiltros() {
    if (!gridNoticias) return;

    var noticiasFiltradas = todasLasNoticias.filter(function (noticia) {
      // 1. Filtro de Categoría
      var coincideCategoria = (categoriaActiva === "Todas") ||
        (noticia.categoria.toLowerCase() === categoriaActiva.toLowerCase());

      // 2. Filtro de Búsqueda (Texto)
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

    // Control del Banner Principal (Hero)
    if (heroArticulo) {
      if (categoriaActiva !== "Todas" || textoBusqueda.length > 0) {
        heroArticulo.style.display = "none";
      } else {
        heroArticulo.style.display = "block";
      }
    }

    if (lista.length === 0) {
      var mensaje = todasLasNoticias.length === 0
        ? "Aún no hay noticias publicadas en la base de datos. Ve al Panel Admin para publicar la primera."
        : 'No hay noticias que coincidan con la búsqueda "' + (textoBusqueda || categoriaActiva) + '".';

      gridNoticias.innerHTML = 
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 6px; border: 1px solid var(--line);">' +
          '<h3 style="margin: 0 0 8px; font-size: 18px; color: var(--navy);">Sin resultados</h3>' +
          '<p style="margin: 0; font-size: 14px; color: var(--muted);">' + mensaje + '</p>' +
        '</div>';
      return;
    }

    // Dibujar las noticias encontradas
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

  // ========================================
  // EVENT LISTENERS DE PESTAÑAS Y BUSCADOR
  // ========================================
  function inicializarEventos() {
    // Evitar que el formulario recargue la página al pulsar Enter
    if (formBusqueda) {
      formBusqueda.addEventListener("submit", function (e) {
        e.preventDefault();
      });
    }

    // Escuchar la escritura en el input
    if (inputBusqueda) {
      inputBusqueda.addEventListener("input", function (e) {
        textoBusqueda = e.target.value.trim();
        aplicarFiltros();
      });
    }

    // Escuchar el clic en las pestañas de categorías
    tabsNavegacion.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        // Evitar que el enlace navegue a '#'
        e.preventDefault();

        // Cambiar la pestaña activa visualmente (cambia el borde rojo)
        tabsNavegacion.forEach(function (t) { t.classList.remove("active"); });
        this.classList.add("active");

        // Actualizar la categoría seleccionada
        categoriaActiva = this.textContent.trim();
        aplicarFiltros();
      });
    });
  }

  // Inicializar todo cuando el DOM esté listo
  document.addEventListener("DOMContentLoaded", function () {
    inicializarEventos();
    cargarNoticias();
  });

})();

function actualizarFechaHoy() {
  var fechaElemento = document.getElementById("fecha-hoy");
  if (!fechaElemento) return;

  var hoy = new Date();

  // Formatear la fecha en español (Ejemplo: "jueves, 24 de septiembre de 2026")
  var opciones = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  var fechaFormateada = hoy.toLocaleDateString('es-ES', opciones);

  // Colocar en mayúscula la primera letra del día de la semana
  fechaElemento.textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
}

// Llamar a la función cuando el documento esté listo
document.addEventListener("DOMContentLoaded", function () {
  actualizarFechaHoy();
});