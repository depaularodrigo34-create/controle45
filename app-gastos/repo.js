// repo.js — camada única de acesso a dados (Supabase)
import { supabase } from './supabaseClient.js';

// Helpers para converter entre formato local (valor em reais) e nuvem (cents)
function toCents(v){ return Math.round((Number(v)||0)*100); }
function fromCents(c){ return (Number(c)||0)/100; }

export const repo = {
  async carregarTudo(userId){
    if(!userId) throw new Error('Sem usuário');
    const [trans, budgets, shopping, goals, profile] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).order('transaction_date', {ascending:false}),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('shopping_items').select('*').eq('user_id', userId),
      supabase.from('goals').select('*').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('id', userId).single()
    ]);
    if(trans.error) throw trans.error;
    // budgets etc. podem não existir ainda, ignora erro de tabela vazia
    return {
      transactions: trans.data||[],
      budgets: budgets.data||[],
      shopping_items: shopping.data||[],
      goals: goals.data||[],
      profile: profile.data||null
    };
  },

  async existeTransacao(userId, local){
    // Idempotência: verifica por data + valor + descrição aproximada
    const cents = toCents(local.valor);
    const { data } = await supabase.from('transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('transaction_date', local.data)
      .eq('amount_cents', cents)
      .ilike('description', local.descricao||'')
      .limit(1);
    return data && data.length>0;
  },

  async criarTransacao(userId, local){
    const payload = {
      user_id: userId,
      type: local.tipo==='receita' ? 'receita' : 'despesa',
      amount_cents: toCents(local.valor),
      category: local.categoria||'Outros',
      description: local.descricao||'',
      transaction_date: local.data,
      person_name: local.pessoa||null,
      payment_method: local.pagamento||null,
      notes: local.obs||null
    };
    const { data, error } = await supabase.from('transactions').insert(payload).select().single();
    if(error) throw error;
    return data;
  },

  async atualizarTransacao(id, patch){
    const upd = {};
    if(patch.valor!==undefined) upd.amount_cents = toCents(patch.valor);
    if(patch.categoria) upd.category = patch.categoria;
    if(patch.descricao) upd.description = patch.descricao;
    if(patch.data) upd.transaction_date = patch.data;
    upd.updated_at = new Date().toISOString();
    const { error } = await supabase.from('transactions').update(upd).eq('id', id);
    if(error) throw error;
  },

  async removerTransacao(id){
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if(error) throw error;
  },

  // Budgets
  async salvarBudget(userId, categoria, limiteReais, mesRef){
    const payload = {
      user_id: userId,
      category: categoria,
      limit_cents: toCents(limiteReais),
      reference_month: mesRef+'-01' // date truncado para dia 1
    };
    const { error } = await supabase.from('budgets').upsert(payload, {onConflict:'user_id,category,reference_month'});
    if(error) throw error;
  },

  // Shopping
  async salvarItem(userId, item){
    const payload = {
      user_id: userId,
      name: item.nome,
      estimated_amount_cents: toCents(item.preco||0),
      purchased: !!item.feito
    };
    const { error } = await supabase.from('shopping_items').insert(payload);
    if(error) throw error;
  },

  // Goals
  async criarMeta(userId, meta){
    const payload = {
      user_id: userId,
      name: meta.nome,
      target_amount_cents: toCents(meta.alvo),
      current_amount_cents: toCents(meta.atual||0)
    };
    const { error } = await supabase.from('goals').insert(payload);
    if(error) throw error;
  }
};
