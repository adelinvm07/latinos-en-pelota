(function () {
  "use strict";

  var claveRetorno = "noticia-acceso-social";
  var proveedores = [
    { id: "google", nombre: "Google", icono: '<svg viewBox="0 0 24 24"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34a853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#fbbc05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>' },
    { id: "facebook", nombre: "Facebook", icono: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14 22v-9h3l.5-3H14V8c0-.9.3-1.5 1.7-1.5h1.9V3.8c-.3 0-1.4-.2-2.7-.2-2.7 0-4.5 1.6-4.5 4.5V10H7.5v3h2.9v9z"/></svg>' },
    { id: "apple", nombre: "Apple", icono: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 12.3c0-2 1.7-3.1 1.8-3.2a4.1 4.1 0 0 0-3.2-1.8c-1.4-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8a4.5 4.5 0 0 0-3.8 2.3c-1.6 2.8-.4 7 1.2 9.2.7 1.1 1.5 2.2 2.6 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7 1.9-1 2.6-2.1c.8-1.2 1.1-2.4 1.2-2.5-.1 0-1.9-.8-1.9-4.1zM14.7 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.6-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z"/></svg>' }
  ];

  function guardarRetorno(destino) {
    try {
      if (destino) sessionStorage.setItem(claveRetorno, destino);
      else sessionStorage.removeItem(claveRetorno);
    } catch (err) {}
  }

  function volverANoticia() {
    var destino;
    try {
      destino = sessionStorage.getItem(claveRetorno);
    } catch (err) {
      return false;
    }
    if (!destino) return false;

    guardarRetorno(null);
    var url = new URL(destino, window.location.href);
    var noticia = new URL("noticia.html", window.location.href);
    if (url.origin !== noticia.origin || url.pathname !== noticia.pathname) return false;
    window.location.replace(url.href);
    return true;
  }

  function mostrarErrorDeRetorno(aviso) {
    var url = new URL(window.location.href);
    var error = url.searchParams.get("error") || new URLSearchParams(url.hash.slice(1)).get("error");
    if (!error) return;

    guardarRetorno(null);
    aviso.textContent = error === "access_denied"
      ? "Cancelaste el inicio de sesión. Puedes intentarlo de nuevo."
      : "No se pudo iniciar sesión. Inténtalo de nuevo o usa tu correo.";
    aviso.style.display = "block";
    ["error", "error_code", "error_description"].forEach(function (parametro) {
      url.searchParams.delete(parametro);
    });
    url.hash = "";
    window.history.replaceState(null, "", url);
  }

  function montar(contenedor, botonesFormulario, desdeNoticia) {
    if (!contenedor) return;

    contenedor.classList.add("social-acceso");
    contenedor.innerHTML = '<p class="social-etiqueta">Iniciar sesión con</p>' +
      '<div class="social-iconos" role="group" aria-label="Proveedores de inicio de sesión"></div>' +
      '<p class="social-aviso" role="alert" hidden></p>';

    var fila = contenedor.querySelector(".social-iconos");
    var aviso = contenedor.querySelector(".social-aviso");
    var botones = proveedores.map(function (proveedor) {
      var boton = document.createElement("button");
      var etiqueta = "Continuar con " + proveedor.nombre;
      boton.type = "button";
      boton.className = "social-icono social-" + proveedor.id;
      boton.setAttribute("aria-label", etiqueta);
      boton.title = etiqueta;
      boton.innerHTML = proveedor.icono;
      boton.firstElementChild.setAttribute("aria-hidden", "true");
      fila.appendChild(boton);

      boton.addEventListener("click", async function () {
        if (botonesFormulario.some(function (control) { return control.disabled; })) return;

        aviso.hidden = true;
        var controles = botones.concat(botonesFormulario);
        controles.forEach(function (control) { control.disabled = true; });
        guardarRetorno(desdeNoticia ? window.location.pathname + window.location.search : null);
        try {
          var { error } = await window.supabase.auth.signInWithOAuth({
            provider: proveedor.id,
            options: { redirectTo: new URL("Panel-de-admin.html", window.location.href).href }
          });
          if (error) throw error;
        } catch (err) {
          guardarRetorno(null);
          console.error("Error de autenticación con proveedor:", err);
          aviso.textContent = "No se pudo iniciar sesión. Inténtalo de nuevo o usa tu correo.";
          aviso.hidden = false;
        } finally {
          controles.forEach(function (control) { control.disabled = false; });
        }
      });
      return boton;
    });
  }

  window.accesoSocial = { montar: montar, volverANoticia: volverANoticia, mostrarErrorDeRetorno: mostrarErrorDeRetorno };
})();
