const editor = new Quill("#editor-contenido", {
  theme: "snow",
  modules: {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic"],
      ["link"],
      [{ list: "ordered" }, { list: "bullet" }],
    ],
  },
});

const selectCategoria = document.getElementById("categoria");
const inputImagen = document.getElementById("imagen");
const previewImagen = document.getElementById("preview-imagen");
const mensaje = document.getElementById("mensaje");

// Función para transformar el título en un slug limpio
function generarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-") + "-" + Date.now().toString().slice(-4);
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from("categorias")
    .select("nombre")
    .order("nombre");

  if (error) {
    mostrarMensaje("No se pudieron cargar las categorías.", "error");
    return;
  }

  selectCategoria.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
  
  data.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.nombre;       // Se guarda el nombre en texto plano
    opt.textContent = cat.nombre; // Lo que ve el usuario
    selectCategoria.appendChild(opt);
  });
}

inputImagen.addEventListener("change", () => {
  const archivo = inputImagen.files[0];
  if (!archivo) return;
  previewImagen.src = URL.createObjectURL(archivo);
  previewImagen.style.display = "block";
});

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.style.color = tipo === "error" ? "var(--red, #d32e2e)" : "var(--green, #3f7d4f)";
}

async function subirImagen(archivo) {
  const nombreArchivo = `${Date.now()}-${archivo.name}`;
  const { error } = await supabase.storage
    .from("imagenes")
    .upload(nombreArchivo, archivo);

  if (error) throw error;

  const { data } = supabase.storage.from("imagenes").getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

async function guardarNoticia(estado) {
  const titulo = document.getElementById("titulo").value.trim();
  const subtitulo = document.getElementById("subtitulo").value.trim();
  const categoriaSeleccionada = selectCategoria.value;
  const contenidoHtml = editor.root.innerHTML.trim();
  const contenidoVacio = editor.getText().trim().length === 0;
  const archivoImagen = inputImagen.files[0];

  if (!titulo || !subtitulo || !categoriaSeleccionada || contenidoVacio) {
    mostrarMensaje("Completa todos los campos obligatorios.", "error");
    return;
  }

  mostrarMensaje("Guardando en la base de datos...", "");

  try {
    let imagenUrl = null;
    if (archivoImagen) {
      imagenUrl = await subirImagen(archivoImagen);
    }

    const slug = generarSlug(titulo);

    // Ojo: guardamos 'categoria' como texto, asegurate de que en Supabase tu tabla noticias tenga una columna 'categoria' de tipo text
    const { error } = await supabase.from("noticias").insert({
      titulo,
      subtitulo,
      categoria: categoriaSeleccionada, 
      contenido: contenidoHtml,
      imagen_url: imagenUrl || "",
      slug,
      estado,
      publicado_en: estado === "publicado" ? new Date().toISOString() : null,
    });

    if (error) throw error;

    mostrarMensaje(
      estado === "publicado" ? "Noticia publicada con éxito." : "Borrador guardado correctamente.",
      "exito"
    );

    setTimeout(() => {
      window.location.href = "Panel-de-admin.html";
    }, 1000);
  } catch (err) {
    mostrarMensaje("Error al guardar: " + err.message, "error");
  }
}

document.getElementById("btn-borrador").addEventListener("click", () => guardarNoticia("borrador"));
document.getElementById("btn-publicar").addEventListener("click", () => guardarNoticia("publicado"));
document.getElementById("btn-cancelar").addEventListener("click", () => {
  window.location.href = "Panel-de-admin.html";
});

cargarCategorias();