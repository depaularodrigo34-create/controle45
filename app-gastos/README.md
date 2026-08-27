# Controle de Gastos — Supabase Auth + Google

App financeiro com sincronização na nuvem. Dados locais continuam funcionando offline e podem ser migrados para a conta Google.

## Stack
- HTML/CSS/JS puro (sem framework) + `supabase-js` via CDN/ESM
- `supabaseClient.js` isolado, `repo.js` para dados, `offlineQueue.js` para fila
- Tabelas: `profiles`, `transactions`, `budgets`, `shopping_items`, `goals` com RLS

## Configuração manual (proprietário)

### 1. Criar projeto Supabase
- https://supabase.com → New Project → anote `Project URL` e `Publishable Key` (ex `sb_publishable_...`)

### 2. Rodar migrations
- Supabase Dashboard → SQL Editor → cole `supabase/migrations/20250827000001_initial.sql` e Run
- Ou via CLI: `supabase db push` (se usa Supabase CLI)

### 3. Variáveis de ambiente
- Copie `.env.example` para `.env` (ou configure no Netlify/Vercel):
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SEU_TOKEN
```
- Para HTML puro sem Vite, adicione no `<head>`:
```html
<script>window.__ENV__={VITE_SUPABASE_URL:'https://SEU-PROJETO.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_...'}</script>
```
- **Nunca** commite `.env` (já está no `.gitignore`). Nunca use `service_role` no frontend.

### 4. Google Cloud OAuth
- https://console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth Client ID → tipo **Web application**
- **Authorized JavaScript origins:** `https://SEU_DOMINIO.netlify.app`, `http://localhost:5173`, `http://localhost:3000`
- **Authorized redirect URIs:** copie de Supabase → Authentication → Providers → Google → `Callback URL (for OAuth)` (ex `https://SEU-PROJETO.supabase.co/auth/v1/callback`)
- Copie **Client ID** e **Client Secret**

### 5. Configurar Supabase Auth
- Supabase → Authentication → Providers → Google → Enable, cole Client ID e Secret (Secret fica só no Supabase, nunca no código)
- Authentication → URL Configuration:
  - **Site URL:** `https://SEU_DOMINIO.netlify.app`
  - **Additional Redirect URLs:** `https://SEU_DOMINIO.netlify.app/*`, `http://localhost:5173/*`, `http://localhost:3000/*`

### 6. Testar
- Abra o app sem sessão → deve mostrar tela "Continuar com Google"
- Clique → `supabase.auth.signInWithOAuth({provider:'google'})` → volta ao app
- Perfil deve mostrar nome, email e avatar; Sair usa `supabase.auth.signOut()`
- Crie dado com conta A, entre com conta B → B não vê dados de A (RLS)
- Feche e abra em outro dispositivo com mesma conta → dados persistem (nuvem)

## Variáveis esperadas
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_ANON_KEY` legado)

## Dados e RLS
- Todas as tabelas com `enable row level security`
- Políticas: `SELECT/INSERT/UPDATE/DELETE` apenas onde `auth.uid() = user_id` (ou `id` para profiles)
- Sem `USING (true)`. Isolamento por usuário garantido no banco, não só no frontend.

## Migração local
- Ao primeiro login, se `localStorage` tem `gastos`, `lista_compras`, `orcamentos`, mostra modal "Encontramos dados salvos neste dispositivo. Deseja migrá-los?"
- Opções: Migrar agora, Manter neste dispositivo, Exportar backup
- Valida cada registro, mostra quantidade, é idempotente (verifica `data+valor+descrição` antes de inserir)
- Marca `migracao_concluida_<userId>` no localStorage; só oferece apagar local após confirmação explícita

## Offline
- `offlineQueue.js` guarda em `localStorage` (`fila_offline_v1`) quando `navigator.onLine===false`
- Ao voltar `online`, tenta `repo.criarTransacao` para cada item; mostra status "Sincronizando.../Salvo na nuvem/Aguardando conexão"

## Comandos
```bash
npm install
npm run dev     # se usa Vite
npm run build
```

## Segurança
- Nenhum segredo no bundle ou repo. `service_role` nunca no frontend.
- `.env*` no `.gitignore`.

## Aceite
- Anônimo não acessa dados de ninguém (sem sessão, não carrega da nuvem)
- A não lê/escreve de B (RLS)
- Login/logout sem vazar sessão anterior (onAuthStateChange limpa)
- Dados persistem entre dispositivos (Supabase)
- Migração sem duplicação (idempotente)
- Nenhum segredo commitado
