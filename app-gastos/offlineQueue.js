// offlineQueue.js — fila simples em localStorage para sincronizar ao reconectar
const KEY = 'fila_offline_v1';

export function getFila(){
  try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ return []; }
}
export function salvarFila(fila){
  localStorage.setItem(KEY, JSON.stringify(fila));
}
export function adicionarNaFila(operacao){
  // operacao = { tipo: 'transacao'|'budget'|'shopping', dado: {...}, ts: Date.now() }
  const fila = getFila();
  fila.push({ ...operacao, ts: Date.now() });
  salvarFila(fila);
}
export function limparFila(){
  localStorage.removeItem(KEY);
}
export function removerDaFila(index){
  const fila = getFila();
  fila.splice(index,1);
  salvarFila(fila);
}
