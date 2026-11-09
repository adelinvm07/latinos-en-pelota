(function () {
  "use strict";

  var clave = "preferencias-cookies";
  var preferencia = null;
  var origen = null;

  var banner = document.createElement("section");
  banner.className = "ck-banner";
  banner.setAttribute("aria-labelledby", "ck-titulo");
  banner.innerHTML =
    '<h2 id="ck-titulo">Preferencias de cookies</h2>' +
    '<p>La sesión y tu elección se guardan en este navegador. Con tu permiso, medimos visitas y mostramos anuncios externos. ' +
    '<a href="politica-de-privacidad.html#cookies">Más información</a>.</p>' +
    '<div class="ck-acciones">' +
      '<button class="ck-boton ck-aceptar" type="button">Aceptar</button>' +
      '<button class="ck-boton ck-rechazar" type="button">Rechazar</button>' +
    '</div>';
  document.body.appendChild(banner);

  var aceptar = banner.querySelector(".ck-aceptar");
  var rechazar = banner.querySelector(".ck-rechazar");

  function aplicarPreferencia(valor) {
    preferencia = valor === "aceptado" || valor === "rechazado" ? valor : null;
    window.cookiesOpcionales = preferencia === "aceptado";
    banner.hidden = preferencia !== null;

    if (!window.cookiesOpcionales) {
      try { localStorage.removeItem("sid"); } catch (e) {}
    }
  }

  function guardarPreferencia(valor) {
    try { localStorage.setItem(clave, valor); } catch (e) {}
    aplicarPreferencia(valor);
    window.dispatchEvent(new Event(clave));
    if (origen) {
      origen.focus();
      origen = null;
    }
  }

  aceptar.addEventListener("click", function () { guardarPreferencia("aceptado"); });
  rechazar.addEventListener("click", function () { guardarPreferencia("rechazado"); });

  document.querySelectorAll("[data-ck-configurar]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      origen = boton;
      banner.hidden = false;
      aceptar.focus();
    });
  });

  var guardada;
  try { guardada = localStorage.getItem(clave); } catch (e) {}
  aplicarPreferencia(guardada);

  window.addEventListener("storage", function (evento) {
    if (evento.storageArea !== localStorage || (evento.key !== clave && evento.key !== null)) return;
    aplicarPreferencia(evento.newValue);
    window.dispatchEvent(new Event(clave));
  });
})();
