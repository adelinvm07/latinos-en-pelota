(function () {
  "use strict";

  async function actualizarBotonAdmin() {
    var btnVolver = document.querySelector(".priv-inicio");
    if (!btnVolver || !window.supabase || !window.supabase.auth) return;

    function aplicarRol(session) {
      var esAdmin = Boolean(
        session &&
        session.user &&
        session.user.app_metadata &&
        session.user.app_metadata.role === "admin"
      );

      if (esAdmin) {
        btnVolver.textContent = "Volver al panel de admin";
        btnVolver.href = "Panel-de-admin.html";
      } else {
        btnVolver.textContent = "Volver al inicio";
        btnVolver.href = "latinos-en-pelota.html";
      }
    }

    try {
      var { data: { session } } = await window.supabase.auth.getSession();
      aplicarRol(session);

      if (window.supabase.auth.onAuthStateChange) {
        window.supabase.auth.onAuthStateChange(function (_event, sesionActual) {
          aplicarRol(sesionActual);
        });
      }
    } catch (e) {
      console.warn("No se pudo verificar la sesión en política de privacidad:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", actualizarBotonAdmin);
  } else {
    actualizarBotonAdmin();
  }
})();
