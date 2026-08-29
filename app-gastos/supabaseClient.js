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
  } catch { }
  // window fallback para HTML puro
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[name]) return window.__ENV__[name];
  // meta tags <meta name="supabase-url" content="...">
  const meta = document.querySelector(`meta[name="${name.toLowerCase()}"]`);
  if (meta) return meta.getAttribute('content') || fallback;
  return fallback;
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', '').trim();
const SUPABASE_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '').trim() || getEnv('VITE_SUPABASE_ANON_KEY', '').trim();

// Flag: true se as variaveis estao presentes (mesmo que o projeto nao responda)
const TEM_CREDENCIA = Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('https://'));

if (!TEM_CREDENCIA) {
  console.warn('[Supabase] Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY não configuradas. Rodando em modo offline local. Veja .env.example');
}

function createMockClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }),
      signInWithOAuth: async () => ({ error: { message: 'Supabase não configurado' } }),
      signOut: async () => ({ error: null })
    },
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'offline' } }) }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }), upsert: () => Promise.resolve({ error: null }) })
  };
}

export const supabase = (TEM_CREDENCIA)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  })
  : createMockClient();

// Helper para verificar se está configurado (credenciais presentes)
export function isSupabaseConfigured() {
  return TEM_CREDENCIA;
}

// Verificação REAL de conectividade: faz um HEAD/GET leve no projeto Supabase
// Se o projeto não existir (404/erro), retorna false -> app usa login demo (mock)
let _supabaseOnlineCache = null;
export async function supabaseResponde() {
  if (!TEM_CREDENCIA) return false;
  if (_supabaseOnlineCache !== null) return _supabaseOnlineCache;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(SUPABASE_URL + '/rest/v1/', {
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      signal: ctrl.signal
    });
    clearTimeout(t);
    // 200/401/4xx = projeto existe (mesmo que não autenticado). 404/erro de DNS = projeto morto
    _supabaseOnlineCache = r.status !== 404 && r.status >= 200;
    return _supabaseOnlineCache;
  } catch {
    _supabaseOnlineCache = false;
    return false;
  }
}
