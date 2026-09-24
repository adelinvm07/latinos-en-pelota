// Configuración y conexión con Supabase para Latinos en Pelota
const SUPABASE_URL = 'https://uoxtbzfmznnvhjdwdlrr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ro3jxG0zgAYjJeaj97h02A_DcSYKCgh';

// Inicializar cliente Supabase de manera segura
if (typeof window !== 'undefined') {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = window.supabaseClient;
  }
}

var supabase = (typeof window !== 'undefined') ? (window.supabaseClient || window.supabase) : null;