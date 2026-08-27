// supabaseClient.js — cliente isolado, usa apenas chaves públicas
// Nunca coloque service_role, secret ou senha aqui
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Lê de variáveis injetadas no build (Vite) ou de window.__ENV__ para HTML puro
// Para dev local sem build, defina em <script> window.__ENV__ = { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY }
function getEnv(name, fallback = '') {
  // Vite / import.meta
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name];
  } catch {}
  // window fallback para HTML puro
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[name]) return window.__ENV__[name];
  // meta tags <meta name="supabase-url" content="...">
  const meta = document.querySelector(`meta[name="${name.toLowerCase()}"]`);
  if (meta) return meta.getAttribute('content') || fallback;
  return fallback;
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', '').trim();
const SUPABASE_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '').trim() || getEnv('VITE_SUPABASE_ANON_KEY', '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Supabase] Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não configuradas. Rodando em modo offline local. Veja .env.example');
}

function createMockClient(){
  return {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
      signInWithOAuth: async () => ({ error: { message: 'Supabase não configurado' } }),
      signOut: async () => ({ error: null })
    },
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'offline' } }) }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }), upsert: () => Promise.resolve({ error: null }) })
  };
}

export const supabase = (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('https://'))
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
    })
  : createMockClient();

// Helper para verificar se está configurado
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('https://'));
}
