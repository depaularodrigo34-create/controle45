// insights.js — Módulo de inteligência financeira estilo Nubank/Inter
// Funções PURAS: recebem dados, retornam análises. Nada de DOM/localStorage/window.
// Convenções do app:
//   lancamento = { id, data:"YYYY-MM-DD", tipo:"receita"|"despesa", pessoa, descricao, categoria, pagamento, valor:Number, obs }

const reais = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function normaliza(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function mesDe(data) { return data.slice(0, 7); }
function mesAnteriorISO(m) { const [y, mm] = m.split('-').map(Number); const prev = mm === 1 ? 12 : mm - 1; const py = mm === 1 ? y - 1 : y; return `${py}-${String(prev).padStart(2, '0')}`; }
function diasNoMes(m) { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate(); }

// ---------- 1. INSIGHTS INTELIGENTES (estilo Nubank "Resumo do mês" / Inter "Inteligência") ----------
export function gerarInsights(lancamentos, PESSOAS = ['Eu'], ORCAMENTOS = {}, SALARIOS = {}) {
  const insights = [];
  if (!lancamentos.length) return [{ tipo: 'vazio', titulo: 'Sem dados ainda', texto: 'Adicione lançamentos para receber insights inteligentes como o Nubank.', icone: '💡', prioridade: 0 }];

  const mesAtual = new Date().toISOString().slice(0, 7);
  const mesAnt = mesAnteriorISO(mesAtual);

  const despesasMes = lancamentos.filter(l => l.tipo === 'despesa' && mesDe(l.data) === mesAtual);
  const despesasAnt = lancamentos.filter(l => l.tipo === 'despesa' && mesDe(l.data) === mesAnt);
  const recMes = lancamentos.filter(l => l.tipo === 'receita' && mesDe(l.data) === mesAtual);

  const totalDespMes = despesasMes.reduce((s, l) => s + normaliza(l.valor), 0);
  const totalDespAnt = despesasAnt.reduce((s, l) => s + normaliza(l.valor), 0);
  const totalRecMes = recMes.reduce((s, l) => s + normaliza(l.valor), 0);
  const salarioMes = Object.entries(SALARIOS).filter(([k]) => k.startsWith(mesAtual + '|')).reduce((s, [, v]) => s + normaliza(v), 0);
  const entradasMes = totalRecMes + salarioMes;
  const economia = entradasMes - totalDespMes;

  // 1a. Maior categoria do mês + variação
  const porCat = {};
  despesasMes.forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + normaliza(l.valor); });
  const porCatAnt = {};
  despesasAnt.forEach(l => { porCatAnt[l.categoria] = (porCatAnt[l.categoria] || 0) + normaliza(l.valor); });
  const catsOrd = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (catsOrd.length) {
    const [cat, val] = catsOrd[0];
    const antVal = porCatAnt[cat] || 0;
    const varPct = antVal > 0 ? Math.round((val - antVal) / antVal * 100) : null;
    let txt = `Sua maior categoria em ${mesAtual} foi ${cat} com ${reais(val)}`;
    if (varPct !== null) {
      if (varPct > 5) txt += `, ${varPct}% acima do mês passado. 📈`;
      else if (varPct < -5) txt += `, ${Math.abs(varPct)}% abaixo do mês passado. 👏`;
      else txt += ` (estável vs mês passado).`;
    }
    insights.push({ tipo: 'maior_cat', titulo: 'Onde foi seu dinheiro', texto: txt, icone: '📊', prioridade: 3 });
  }

  // 1b. Alerta de orçamento estourado (estilo Nubank "limite")
  const estouros = Object.entries(ORCAMENTOS).filter(([cat, lim]) => {
    const gasto = (porCat[cat] || 0);
    return gasto > lim;
  });
  estouros.forEach(([cat, lim]) => {
    const gasto = porCat[cat] || 0;
    insights.push({ tipo: 'orcamento', titulo: `Orçamento de ${cat} estourado`, texto: `Você gastou ${reais(gasto)} em ${cat}, acima do limite de ${reais(lim)} (${Math.round(gasto / lim * 100)}%).`, icone: '⚠️', prioridade: 5 });
  });

  // 1c. Economia / saúde financeira (estilo Inter "Saúde financeira")
  if (entradasMes > 0) {
    const taxaPoup = Math.round(economia / entradasMes * 100);
    if (economia < 0) {
      insights.push({ tipo: 'saude', titulo: 'Saldo negativo no mês', texto: `Você está ${reais(Math.abs(economia))} no vermelho em ${mesAtual}. Reveja gastos variáveis (Lazer, Alimentação) para fechar no azul.`, icone: '🔴', prioridade: 6 });
    } else if (taxaPoup >= 20) {
      insights.push({ tipo: 'saude', titulo: 'Mandando bem! 💚', texto: `Você guardou ${reais(economia)} (${taxaPoup}% das entradas). Que tal investir parte no CDI 100%? Use a aba Ferramentas.`, icone: '🌟', prioridade: 2 });
    } else if (taxaPoup < 10) {
      insights.push({ tipo: 'saude', titulo: 'Poupança baixa', texto: `Você guardou só ${reais(economia)} (${taxaPoup}%) em ${mesAtual}. Tente chegar a 10-20% das entradas.`, icone: '💡', prioridade: 4 });
    }
  }

  // 1d. Gasto recorrente que subiu (estilo Nubank "você paga todo mês")
  // detecta despesas com mesma descrição aparecendo nos 2 meses e valor maior
  const mapAnt = {};
  despesasAnt.forEach(l => { mapAnt[l.descricao] = l.valor; });
  despesasMes.forEach(l => {
    if (mapAnt[l.descricao] && normaliza(l.valor) > normaliza(mapAnt[l.descricao]) * 1.1) {
      insights.push({ tipo: 'recorrente_subiu', titulo: `"${l.descricao}" ficou mais caro`, texto: `De ${reais(mapAnt[l.descricao])} para ${reais(l.valor)} neste mês — ${Math.round((l.valor / mapAnt[l.descricao] - 1) * 100)}% de aumento.`, icone: '📈', prioridade: 4 });
    }
  });

  return insights.sort((a, b) => b.prioridade - a.prioridade);
}

// ---------- 2. PREVISÃO DE SALDO FUTURO (estilo Inter "Planejamento") ----------
export function preverSaldoFuturo(lancamentos, RECORRENTES = [], dias = 30) {
  const hoje = new Date();
  const saldoInicial = lancamentos.filter(l => l.data <= hoje.toISOString().slice(0, 10))
    .reduce((s, l) => s + (l.tipo === 'receita' ? normaliza(l.valor) : -normaliza(l.valor)), 0);

  const projecao = [];
  const saldoPorDia = {};
  // Lançamentos já registrados futuros
  lancamentos.filter(l => l.data > hoje.toISOString().slice(0, 10)).forEach(l => {
    saldoPorDia[l.data] = (saldoPorDia[l.data] || 0) + (l.tipo === 'receita' ? normaliza(l.valor) : -normaliza(l.valor));
  });
  // Recorrentes pendentes nos próximos `dias`
  const limite = new Date(hoje.getTime() + dias * 86400000).toISOString().slice(0, 10);
  RECORRENTES.filter(r => r.ativo).forEach(r => {
    // gera datas nos próximos `dias` no dia `r.dia`
    for (let d = 0; d <= dias; d++) {
      const dt = new Date(hoje.getTime() + d * 86400000);
      if (dt.getDate() === r.dia) {
        const iso = dt.toISOString().slice(0, 10);
        saldoPorDia[iso] = (saldoPorDia[iso] || 0) + (r.tipo === 'receita' ? normaliza(r.valor) : -normaliza(r.valor));
      }
    }
  });

  let saldo = saldoInicial;
  const datas = Object.keys(saldoPorDia).filter(d => d <= limite).sort();
  for (const dt of datas) {
    saldo += saldoPorDia[dt];
    projecao.push({ data: dt, saldo: normaliza(saldo) });
  }
  return { saldoInicial: normaliza(saldoInicial), projecao, saldoFinal: normaliza(saldo) };
}

// ---------- 3. DETECÇÃO DE COBRANÇAS ESTRANHAS (estilo Nubank antifraude) ----------
export function detectarCobrancasEstranhas(lancamentos) {
  const anomalias = [];
  // mediana por categoria
  const porCat = {};
  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    (porCat[l.categoria] = porCat[l.categoria] || []).push(normaliza(l.valor));
  });
  const mediana = arr => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const medCat = {};
  Object.entries(porCat).forEach(([c, vals]) => { medCat[c] = mediana(vals); });

  lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
    const med = medCat[l.categoria] || 0;
    // valor > 3x a mediana da categoria E pelo menos R$ 200
    if (med > 0 && normaliza(l.valor) > med * 3 && normaliza(l.valor) >= 200) {
      anomalias.push({ ...l, motivo: `Valor ${reais(l.valor)} é ${Math.round(l.valor / med)}x acima do comum em ${l.categoria} (mediana ${reais(med)}).`, severidade: 'alta' });
    }
    // categoria com 1 só lançamento e valor alto (> R$ 500)
    else if ((porCat[l.categoria] || []).length === 1 && normaliza(l.valor) >= 500) {
      anomalias.push({ ...l, motivo: `Lançamento único e alto (${reais(l.valor)}) em ${l.categoria} — confirme se está correto.`, severidade: 'media' });
    }
  });
  return anomalias.sort((a, b) => b.valor - a.valor);
}

// ---------- 4. RESUMO MENSAL INTELIGENTE (estilo Nubank "Resumo do mês") ----------
export function resumoMensalInteligente(lancamentos, mes) {
  const despesas = lancamentos.filter(l => l.tipo === 'despesa' && mesDe(l.data) === mes);
  const receitas = lancamentos.filter(l => l.tipo === 'receita' && mesDe(l.data) === mes);
  const totalDesp = despesas.reduce((s, l) => s + normaliza(l.valor), 0);
  const totalRec = receitas.reduce((s, l) => s + normaliza(l.valor), 0);
  const mesAnt = mesAnteriorISO(mes);
  const despAnt = lancamentos.filter(l => l.tipo === 'despesa' && mesDe(l.data) === mesAnt).reduce((s, l) => s + normaliza(l.valor), 0);
  const diff = totalDesp - despAnt;
  const varPct = despAnt > 0 ? Math.round(diff / despAnt * 100) : null;

  const [y, mm] = mes.split('-').map(Number);
  const nomeMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mm - 1];

  let texto = `Em ${nomeMes}/${y} você teve ${reais(totalRec)} de entradas e gastou ${reais(totalDesp)}. `;
  if (varPct !== null) {
    if (varPct > 0) texto += `Seus gastos subiram ${varPct}% vs ${nomeMes === 'Jan' ? 'dez' : 'mês passado'} (${reais(Math.abs(diff))} a mais). `;
    else if (varPct < 0) texto += `Seus gastos caíram ${Math.abs(varPct)}% vs mês passado (${reais(Math.abs(diff))} a menos). 👏 `;
    else texto += `Seus gastos ficaram estáveis vs mês passado. `;
  }
  const porCat = {};
  despesas.forEach(l => { porCat[l.categoria] = (porCat[l.categoria] || 0) + normaliza(l.valor); });
  const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
  if (top) texto += `Seu maior gasto foi ${top[0]} (${reais(top[1])}).`;
  return texto;
}

// Exporta também helpers para reuso
export { reais, normaliza, mesDe, mesAnteriorISO };
