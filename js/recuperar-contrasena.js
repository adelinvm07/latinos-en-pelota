(function () {
  "use strict";

  var url = new URL(window.location.href);
  var fragmento = new URLSearchParams(url.hash.slice(1));
  var tokenRecuperacion = fragmento.get("type") === "recovery" ? fragmento.get("access_token") : null;
  var esRetorno = url.searchParams.get("modo") === "restablecer" || fragmento.get("type") === "recovery";
  var errorRetorno = url.searchParams.has("error") || fragmento.has("error");

  document.addEventListener("DOMContentLoaded", async function () {
    var solicitud = document.getElementById("solicitarRecuperacion");
    var cambio = document.getElementById("cambiarContrasena");
    var estado = document.getElementById("estadoRecuperacion");
    var auth = window.supabase?.auth;

    if (!auth) {
      solicitud.hidden = true;
      estado.textContent = "No pudimos conectar con el servicio. Recarga la página para intentarlo de nuevo.";
      return;
    }

    solicitud.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var boton = solicitud.querySelector("button");
      boton.disabled = true;
      estado.textContent = "Solicitando enlace…";

      try {
        var { error } = await auth.resetPasswordForEmail(document.getElementById("correoRecuperacion").value.trim(), {
          redirectTo: new URL("recuperar-contrasena.html?modo=restablecer", url).href
        });
        if (error) throw error;
        estado.textContent = "Si el correo está asociado a una cuenta, recibirás un enlace para cambiar tu contraseña.";
      } catch (err) {
        estado.textContent = err.status === 429
          ? "Espera un momento antes de pedir otro enlace."
          : "No pudimos solicitar el enlace. Inténtalo de nuevo.";
      } finally {
        boton.disabled = false;
      }
    });

    if (!esRetorno) return;
    solicitud.hidden = true;
    estado.textContent = "Comprobando el enlace…";

    // El cliente usa el flujo implícito. La sesión debe venir de este enlace de recuperación.
    var { data, error } = await auth.getSession();
    window.history.replaceState(null, "", url.pathname);
    if (errorRetorno || error || !tokenRecuperacion || data.session?.access_token !== tokenRecuperacion) {
      estado.textContent = "El enlace no es válido o ya venció. Solicita uno nuevo.";
      solicitud.hidden = false;
      return;
    }

    document.getElementById("recuperacionTitulo").textContent = "Elige una contraseña nueva";
    document.getElementById("recuperacionIntro").textContent = "Escribe y confirma la contraseña que usarás para entrar.";
    estado.textContent = "";
    cambio.hidden = false;
    var nueva = document.getElementById("nuevaContrasena");
    var confirmacion = document.getElementById("confirmarContrasena");

    cambio.addEventListener("submit", async function (evento) {
      evento.preventDefault();
      if (nueva.value !== confirmacion.value) {
        estado.textContent = "Las contraseñas no coinciden.";
        confirmacion.focus();
        return;
      }

      var boton = cambio.querySelector("button");
      boton.disabled = true;
      estado.textContent = "Guardando contraseña…";

      try {
        var { error } = await auth.updateUser({ password: nueva.value });
        if (error) throw error;
        cambio.reset();
        cambio.hidden = true;
        estado.textContent = "Tu contraseña se actualizó. Ya puedes volver al acceso.";
      } catch (err) {
        estado.textContent = err.code === "same_password"
          ? "Elige una contraseña diferente de la anterior."
          : "No pudimos cambiar tu contraseña. Inténtalo de nuevo.";
      } finally {
        boton.disabled = false;
      }
    });
  });
})();
