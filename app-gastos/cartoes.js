// cartoes.js — Controle inteligente de gastos por categoria (estilo Nubank/Inter, mas para app de controle de gastos)
// Sem DOM/localStorage/window. Recebe dados, retorna análises de CONTROLE.

function normaliza(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function reais(v) { return 'R$ ' + normaliza(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Categorias que costumam dar mais "retorno" quando você controla bem (equivalente a cashback, mas aqui é ECONOMIA)
const ECONOMIA_POTENCIAL = {
  'Alimentação': 0.02,   // 2% de economia possível negociando
  'Transporte': 0.015,   // 1,5%
  'Lazer': 0.03,         // 3% (maior folga)
  'Assinaturas': 0.05,   // 5% (cancelar unused)
  'Saúde': 0.01,         // 1%
  'Vestuário': 0.02,     // 2%
  'Educação': 0.01,      // 1%
  'Outros': 0.005        // 0,5%
};

// ---------- CARTÕES DE CONTROLE (estilo Nubank "cartão virtual" p/ limitar gastos) ----------
// Sugere "cartões de controle" = envelopes por categoria com limite sugerido
export function criarCartoesSugeridos(lancamentos) {
  const porCat = {};
  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    porCat[l.categoria] = (porCat[l.categoria] || 0) + normaliza(l.valor);
  });
  // sugere envelopes para categorias com gasto recorrente > R$ 100/mês
  return Object.entries(porCat)
    .filter(([, v]) => v >= 100)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => ({
      categoria: cat,
      gastoMedio: reais(total),
      limiteSugerido: Math.ceil(total * 1.2),
      economiaPossivel: reais(total * (ECONOMIA_POTENCIAL[cat] || 0.005)),
      cor: corCartao(cat)
    }));
}

// ---------- ECONOMIA ESTIMADA (estilo Nubank Ultravioleta "cashback" -> aqui é economia) ----------
export function calcularEconomia(lancamentos) {
  let total = 0;
  const porCat = {};
  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    const pct = ECONOMIA_POTENCIAL[l.categoria] || 0.005;
    const ec = normaliza(l.valor) * pct;
    total += ec;
    porCat[l.categoria] = (porCat[l.categoria] || 0) + ec;
  });
  return {
    total: reais(total),
    totalNum: normaliza(total),
    porCategoria: Object.entries(porCat).map(([c, v]) => ({ categoria: c, valor: reais(v) })).sort((a, b) => b.valor - a.valor)
  };
}

// ---------- SUGESTÃO DE PERFIL DE CONTROLE (estilo Inter "Comparador") ----------
export function sugerirPerfilControle(lancamentos) {
  const ec = calcularEconomia(lancamentos);
  const gastoTotal = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + normaliza(l.valor), 0);
  if (gastoTotal < 50) return null;
  // regra simples: se gasta muito em assinaturas/lazer, foco em "cortar"; senão "negociar"
  const assinaturas = lancamentos.filter(l => l.categoria === 'Assinaturas').reduce((s, l) => s + normaliza(l.valor), 0);
  const lazer = lancamentos.filter(l => l.categoria === 'Lazer').reduce((s, l) => s + normaliza(l.valor), 0);
  const foco = (assinaturas + lazer) > gastoTotal * 0.3 ? 'CORTAR' : 'NEGOCIAR';
  return {
    foco,
    economiaMensalEstimada: reais(ec.totalNum),
    economiaAnualEstimada: reais(ec.totalNum * 12),
    gastoMensal: reais(gastoTotal),
    dica: foco === 'CORTAR'
      ? 'Você gasta muito em Assinaturas/Lazer — revisar assinaturas não usadas pode liberar grana todo mês.'
      : 'Seu perfil é de gastos dispersos — negociar contas recorrentes (energia, internet) costuma dar desconto.'
  };
}

function corCartao(cat) {
  const cores = { 'Alimentação': '#f59e0b', 'Moradia': '#8b5cf6', 'Transporte': '#06b6d4', 'Saúde': '#ef4444', 'Educação': '#3b82f6', 'Lazer': '#ec4899', 'Vestuário': '#d946ef', 'Assinaturas': '#14b8a6', 'Outros': '#64748b' };
  return cores[cat] || '#7c3aed';
}

export { reais, normaliza, ECONOMIA_POTENCIAL };
