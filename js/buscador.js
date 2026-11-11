(function () {
  "use strict";

  var todasLasNoticias = [];
  var categoriaActiva = null;
  var textoBusqueda = "";
  var filtroFechaActivo = "todas";
  var visitaRegistrada = false;

  var contenedorTabs = document.getElementById("contenedor-tabs");
  var inputBusqueda = document.querySelector(".search-box input");
  var formBusqueda = document.querySelector(".search-box");
  var selectFecha = document.getElementById("filtro-fecha");
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

  function urlNoticia(item) {
    if (!item) return "noticia.html";
    if (item.slug) return "noticia.html?slug=" + encodeURIComponent(item.slug);
    if (item.id) return "noticia.html?id=" + encodeURIComponent(item.id);
    return "noticia.html";
  }

  function formatearFecha(isoString) {
    if (!isoString) return "Reciente";
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return "Reciente";
    var meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
  }

  function renderizarSkeletons() {
    if (!gridNoticias) return;
    var skeletonHtml = '';
    for (var i = 0; i < 6; i++) {
      skeletonHtml +=
        '<div class="skeleton-card">' +
          '<div class="skeleton-box skeleton-media"></div>' +
          '<div class="skeleton-box skeleton-tag"></div>' +
          '<div class="skeleton-box skeleton-title"></div>' +
          '<div class="skeleton-box skeleton-text"></div>' +
          '<div class="skeleton-box skeleton-text short"></div>' +
          '<div class="skeleton-box skeleton-byline"></div>' +
        '</div>';
    }
    gridNoticias.innerHTML = skeletonHtml;
  }

  async function cargarCategorias() {
    if (!contenedorTabs) return;

    var navControlsEl = contenedorTabs.querySelector(".nav-controls");
    var mensaje;

    try {
      var { data, error } = await window.supabase
        .from("categorias")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        data.forEach(function (cat) {
          var tab = document.createElement("a");
          tab.href = "#";
          tab.dataset.categoriaId = cat.id;
          tab.textContent = cat.nombre;
          contenedorTabs.insertBefore(tab, navControlsEl);
        });
      } else {
        mensaje = "No hay categorías disponibles.";
      }
    } catch (err) {
      console.error("Error al cargar categorías dinámicas desde Supabase:", err);
      mensaje = "No se pudieron cargar las categorías.";
    }

    if (mensaje) {
      var aviso = document.createElement("span");
      aviso.setAttribute("role", "status");
      aviso.textContent = mensaje;
      contenedorTabs.insertBefore(aviso, navControlsEl);
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

  async function cargarNoticias() {
    if (!window.supabase) return;

    // Mostrar diseño de esqueleto en vez de indicador o texto
    renderizarSkeletons();

    try {
      var { data, error } = await window.supabase
        .from("noticias_publicadas")
        .select("id, slug, titulo, subtitulo, imagen_url, publicado_en, es_destacada, categoria_id, categoria_nombre")
        .order("publicado_en", { ascending: false });

      if (error) throw error;

      todasLasNoticias = (data || []).map(function (item) {
        return {
          id: item.id,
          slug: item.slug,
          titulo: item.titulo || "Sin título",
          subtitulo: item.subtitulo || "",
          imagen: item.imagen_url || IMAGEN_PLACEHOLDER,
          categoriaId: item.categoria_id == null ? null : String(item.categoria_id),
          categoria: item.categoria_nombre ?? "General",
          fecha: formatearFecha(item.publicado_en),
          rawFecha: item.publicado_en ? new Date(item.publicado_en) : null,
          esDestacada: Boolean(item['es_destacada'])
        };
      });

      aplicarFiltros();

    } catch (err) {
      console.error("Error cargando noticias desde Supabase:", err);
      if (gridNoticias) {
        gridNoticias.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0;">No se pudieron cargar las noticias.</p>';
      }
    }
  }

  function aplicarFiltros() {
    if (!gridNoticias) return;

    var now = new Date();

    var noticiasFiltradas = todasLasNoticias.filter(function (noticia) {
      var coincideCategoria = categoriaActiva === null || noticia.categoriaId === categoriaActiva;

      var term = textoBusqueda.toLowerCase();
      var coincideTexto = !term ||
        noticia.titulo.toLowerCase().includes(term) ||
        noticia.subtitulo.toLowerCase().includes(term) ||
        noticia.categoria.toLowerCase().includes(term);

      var coincideFecha = true;
      if (filtroFechaActivo !== "todas" && noticia.rawFecha) {
        var pub = noticia.rawFecha;
        var diffTime = now - pub;
        var diffDays = diffTime / (1000 * 60 * 60 * 24);
        var monthDiff = (now.getFullYear() - pub.getFullYear()) * 12 + (now.getMonth() - pub.getMonth());

        if (filtroFechaActivo === "reciente") {
          coincideFecha = diffDays >= 0 && diffDays <= 7;
        } else if (filtroFechaActivo === "este_mes") {
          coincideFecha = monthDiff === 0;
        } else if (filtroFechaActivo === "mes_pasado") {
          coincideFecha = monthDiff === 1;
        } else if (filtroFechaActivo === "hace_2_meses") {
          coincideFecha = monthDiff === 2;
        } else if (filtroFechaActivo === "mas_2_meses") {
          coincideFecha = monthDiff > 2;
        }
      }

      return coincideCategoria && coincideTexto && coincideFecha;
    });

    renderizarResultados(noticiasFiltradas);
  }

  function renderizarResultados(lista) {
    if (!gridNoticias) return;

    var esFiltroAntiguo = ["mes_pasado", "hace_2_meses", "mas_2_meses"].indexOf(filtroFechaActivo) !== -1;

    var destacada = todasLasNoticias.find(function (n) { return n.esDestacada; }) || todasLasNoticias[0];
    var destacadaEnLista = destacada ? lista.find(function (n) { return n.id === destacada.id; }) : null;

    var mostrarHero = (categoriaActiva === null) &&
                      (textoBusqueda.length === 0) &&
                      !esFiltroAntiguo &&
                      !!destacadaEnLista;

    var mainEl = document.querySelector("main");
    if (mainEl) mainEl.classList.toggle("sin-hero", !mostrarHero);

    if (heroArticulo) {
      if (mostrarHero) {
        heroArticulo.style.display = "";
        heroArticulo.innerHTML =
          '<div class="media">' +
            '<a href="' + urlNoticia(destacada) + '" style="display:block;height:100%">' +
              '<img src="' + escapeHtml(destacada.imagen) + '" alt="' + escapeHtml(destacada.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'" style="transition: transform 0.3s ease;">' +
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

    var noticiasGrid = mostrarHero
      ? lista.filter(function (item) { return item.id !== destacada.id; })
      : lista;

    if (noticiasGrid.length === 0) {
      if (mostrarHero) {
        gridNoticias.innerHTML = "";
        return;
      }

      var mensaje = todasLasNoticias.length === 0
        ? "Aún no hay noticias publicadas."
        : 'No hay noticias que coincidan con los filtros seleccionados.';

      gridNoticias.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 12px; border: 1px solid var(--border-soft); box-shadow: var(--shadow-card);">' +
          '<h3 style="margin: 0 0 8px; font-size: 18px; color: var(--navy);">Sin resultados</h3>' +
          '<p style="margin: 0; font-size: 14px; color: var(--text-muted);">' + mensaje + '</p>' +
        '</div>';
      return;
    }

    // Renderizado con retraso de animación en cascada para suavidad (Requisito 3)
    gridNoticias.innerHTML = noticiasGrid.map(function (item, index) {
      var enlace = urlNoticia(item);
      var delay = (index * 0.05).toFixed(2);
      return (
        '<article class="story" style="animation-delay: ' + delay + 's;">' +
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

    if (selectFecha) {
      selectFecha.addEventListener("change", function (e) {
        filtroFechaActivo = e.target.value;
        aplicarFiltros();
      });
    }

    var tabs = document.querySelectorAll("nav.tabs a");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function (e) {
        e.preventDefault();
        tabs.forEach(function (t) { t.classList.remove("active"); });
        this.classList.add("active");
        categoriaActiva = this.dataset.categoriaId || null;
        aplicarFiltros();
      });
    });
  }

  var anunciosCargados = false;

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

  async function cargarAnuncios() {
    var asideSidebar = document.getElementById("sidebar-anuncios");
    if (!asideSidebar || !window.supabase) return;
    if (anunciosCargados && asideSidebar.children.length > 0) return;

    try {
      var { data, error } = await window.supabase
        .from("anuncios")
        .select("id, titulo, imagen_url, enlace_url, ubicacion, activo")
        .eq("activo", true);

      if (error) throw error;

      anunciosCargados = true;
      var anunciosAleatorios = barajar(data || []);
      var vistos = new Set();
      var anunciosSinDuplicados = anunciosAleatorios.filter(function (ad) {
        if (!ad || vistos.has(ad.id)) return false;
        vistos.add(ad.id);
        return true;
      });

      asideSidebar.innerHTML = anunciosSinDuplicados.map(function (ad) {
        return (
          '<div class="ad-card">' +
            '<div class="media">' +
              '<a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer">' +
                '<img src="' + escapeHtml(ad.imagen_url) + '" alt="' + escapeHtml(ad.titulo) + '" onerror="this.src=\'' + IMAGEN_PLACEHOLDER + '\'">' +
              '</a>' +
            '</div>' +
            '<div class="body">' +
              '<div class="ad-label">PUBLICIDAD</div>' +
              '<h3>' + escapeHtml(ad.titulo) + '</h3>' +
              '<a href="' + escapeHtml(ad.enlace_url) + '" target="_blank" rel="noopener noreferrer" class="btn" style="margin-top:10px;">Ver oferta →</a>' +
            '</div>' +
          '</div>'
        );
      }).join("");

    } catch (e) {
      console.warn("No se pudieron cargar anuncios dinámicos de Supabase:", e);
    }
  }

  function aplicarPreferenciasPortada() {
    cargarAnuncios();

    if (!window.cookiesOpcionales || visitaRegistrada) return;

    try {
      var sid = localStorage.getItem("sid");
      if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("sid", sid);
      }

      visitaRegistrada = true;
      fetch(SUPABASE_URL + "/rest/v1/visitas", {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ ruta: location.pathname, sesion_id: sid }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  async function iniciar() {
    if (typeof actualizarFechaCabecera === "function") {
      actualizarFechaCabecera();
    }
    await cargarCategorias();
    inicializarEventos();
    await Promise.all([cargarNoticias(), cargarAnuncios()]);
    window.addEventListener("preferencias-cookies", aplicarPreferenciasPortada);
    aplicarPreferenciasPortada();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

})();