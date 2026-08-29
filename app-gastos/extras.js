// extras.js — Funções extras para app de controle de gastos ficar COMPLETO
// Estilo Nubank/Monarch/YNAB: categorização automática, split, lembretes, busca.
// Sem DOM/localStorage/window. Funções PURAS.

function normaliza(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function reais(v) { return 'R$ ' + normaliza(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ---------- 1. CATEGORIZAÇÃO AUTOMÁTICA (estilo Nubank Auto) ----------
// Aprende com lançamentos passados: palavras-chave em descrição -> categoria
const PALAVRAS_CHAVE = {
  'Alimentação': ['mercado', 'supermercado', 'padaria', 'restaurante', 'ifood', 'lanchonete', 'mercado', 'hortifruti', 'burger', 'pizza', 'food', 'almoco', 'jantar', 'cafe'],
  'Moradia': ['aluguel', 'condominio', 'iptu', 'luz', 'energia', 'agua', 'gas', 'internet', 'telefone', 'aluguel', 'casa'],
  'Transporte': ['uber', '99', 'combustivel', 'gasolina', 'posto', 'transporte', 'onibus', 'metro', 'trens', 'estacionamento', 'pedagio', 'carro'],
  'Saúde': ['farmacia', 'medico', 'hospital', 'clinica', 'dentista', 'exame', 'consulta', 'plano de saude', 'remedio', 'health'],
  'Educação': ['escola', 'faculdade', 'curso', 'livro', 'educacao', 'mensalidade', 'udemy', 'alura', 'estudo'],
  'Lazer': ['cinema', 'netflix', 'spotify', 'youtube', 'jogo', 'game', 'show', 'teatro', 'viagem', 'bar', 'balada', 'lazer', 'steam', 'playstation'],
  'Vestuário': ['roupa', 'tenis', 'sapato', 'loja', 'magazine', 'renner', 'riachuelo', 'vestuario', 'camisa', 'calca'],
  'Assinaturas': ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'max', 'youtube premium', 'assinatura', 'subscription', 'plan'],
  'Investimentos': ['tesouro', 'cdb', 'acao', 'fundo', 'corretora', 'investimento', 'selic', 'cripto', 'bitcoin'],
  'Outros': []
};

// Recebe lancamentos (para aprender padrões do usuário) e retorna sugestao
export function sugerirCategoria(descricao, lancamentos = []) {
  const desc = (descricao || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // 1. Aprendizado do usuário: se já categorizou algo parecido, usa a mesma
  const mapaUsuario = {};
  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    const palavras = (l.descricao || '').toLowerCase().split(/\s+/);
    palavras.forEach(p => { if (p.length > 3) (mapaUsuario[p] = mapaUsuario[p] || {}), mapaUsuario[p][l.categoria] = (mapaUsuario[p][l.categoria] || 0) + 1; });
  });
  for (const palavra of desc.split(/\s+/)) {
    if (mapaUsuario[palavra]) {
      const top = Object.entries(mapaUsuario[palavra]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2) return top[0];
    }
  }
  // 2. Palavras-chave conhecidas
  for (const [cat, keys] of Object.entries(PALAVRAS_CHAVE)) {
    if (keys.some(k => desc.includes(k))) return cat;
  }
  return 'Outros';
}

// ---------- 2. SPLIT DE LANÇAMENTO (estilo YNAB) ----------
// Divide um lançamento em N partes com categorias diferentes
export function splitLancamento(lancamento, partes) {
  // partes = [{categoria, valor, descricao?}]
  const total = partes.reduce((s, p) => s + normaliza(p.valor), 0);
  if (Math.abs(total - normaliza(lancamento.valor)) > 0.01) {
    return { erro: `Soma dos splits (${reais(total)}) difere do total (${reais(lancamento.valor)})` };
  }
  return partes.map((p, i) => ({
    id: lancamento.id + '-split' + i,
    data: lancamento.data,
    tipo: lancamento.tipo,
    pessoa: lancamento.pessoa,
    descricao: (p.descricao || lancamento.descricao) + (partes.length > 1 ? ` (parte ${i + 1})` : ''),
    categoria: p.categoria,
    pagamento: lancamento.pagamento,
    valor: normaliza(p.valor),
    obs: lancamento.obs || '',
    splitDe: lancamento.id
  }));
}

// ---------- 3. LEMRETES DE CONTAS (estilo Nubank "conta vence") ----------
// Baseado em recorrentes, avisa dias antes do vencimento
export function lembretesVencimento(RECORRENTES = [], diasAntecedencia = 3) {
  const hoje = new Date();
  const lembretes = [];
  RECORRENTES.filter(r => r.ativo && r.tipo === 'despesa').forEach(r => {
    const prox = new Date(hoje.getFullYear(), hoje.getMonth(), r.dia);
    if (prox < hoje) prox.setMonth(prox.getMonth() + 1);
    const diffDias = Math.ceil((prox - hoje) / 86400000);
    if (diffDias <= diasAntecedencia && diffDias >= 0) {
      lembretes.push({
        descricao: r.descricao,
        valor: reais(r.valor),
        dias: diffDias,
        quando: prox.toLocaleDateString('pt-BR'),
        urgency: diffDias === 0 ? 'hoje' : diffDias <= 1 ? 'amanha' : 'breve'
      });
    }
  });
  return lembretes.sort((a, b) => a.dias - b.dias);
}

// ---------- 4. BUSCA GLOBAL (estilo Monarch) ----------
export function buscarLancamentos(lancamentos, termo) {
  if (!termo || !termo.trim()) return [];
  const q = termo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return lancamentos.filter(l => {
    const hay = ((l.descricao || '') + ' ' + (l.categoria || '') + ' ' + (l.pessoa || '') + ' ' + (l.obs || '') + ' ' + fmtData(l.data)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return hay.includes(q);
  }).sort((a, b) => b.data.localeCompare(a.data));
}

// ---------- 5. COMPARATIVO ENTRE PESSOAS (estilo casal YNAB) ----------
export function compararPessoas(lancamentos, PESSOAS = []) {
  return PESSOAS.map(p => {
    const desps = lancamentos.filter(l => l.pessoa === p && l.tipo === 'despesa').reduce((s, l) => s + normaliza(l.valor), 0);
    const recs = lancamentos.filter(l => l.pessoa === p && l.tipo === 'receita').reduce((s, l) => s + normaliza(l.valor), 0);
    return { pessoa: p, despesas: desps, receitas: recs, saldo: normaliza(recs - desps), participacao: 0 };
  }).map((x, i, arr) => {
    const totalDesp = arr.reduce((s, a) => s + a.despesas, 0) || 1;
    return { ...x, participacao: Math.round(x.despesas / totalDesp * 100) };
  });
}

function fmtData(d) {
  try { return new Date(d + 'T00:00').toLocaleDateString('pt-BR'); } catch { return d; }
}

// ---------- 6. RESUMO POR PERÍODO (estilo Simplifi) ----------
export function resumoPeriodo(lancamentos, dataInicio, dataFim) {
  const filt = lancamentos.filter(l => l.data >= dataInicio && l.data <= dataFim);
  const rec = filt.filter(l => l.tipo === 'receita').reduce((s, l) => s + normaliza(l.valor), 0);
  const des = filt.filter(l => l.tipo === 'despesa').reduce((s, l) => s + normaliza(l.valor), 0);
  const porCat = {};
  filt.filter(l => l.tipo === 'despesa').forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + normaliza(l.valor); });
  return {
    periodo: `${fmtData(dataInicio)} a ${fmtData(dataFim)}`,
    receitas: reais(rec),
    despesas: reais(des),
    saldo: reais(normaliza(rec - des)),
    topCategorias: Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
  };
}

export { reais, normaliza };
