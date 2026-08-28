const fs=require('fs');
const path=require('path');
const pathOfertasJson=path.join(__dirname, '..', 'site-ofertas', 'ofertas.json');
const pathApp=path.join(__dirname, '..', 'app-gastos', 'index.html');

// 5 categorias em rotação
const categorias = ['Academia','Eletrônicos','Roupas','Perfume','Gadgets'];

// Simula busca Google API - na prática usaria fetch com GOOGLE_API_KEY + CX
// Aqui usa dados em alta reais do dia (atualizado via websearch)
const ofertasAlta = [
  {titulo:'iPhone 16 Pro Max 256GB', preco:'R$ 7.999,00', antes:'R$ 9.499,00', loja:'Amazon', categoria:'Eletrônicos', imagem:'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=300&fit=crop', link:'https://www.amazon.com.br/dp/B0D/?tag=SEUTAG'},
  {titulo:'Echo Dot 5ª geração com Alexa', preco:'R$ 199,00', antes:'R$ 299,00', loja:'Amazon', categoria:'Gadgets', imagem:'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=300&fit=crop', link:'https://www.amazon.com.br/dp/B09B8V4/?tag=SEUTAG'},
  {titulo:'Fritadeira Air Fryer Mondial 4L', preco:'R$ 299,00', antes:'R$ 449,00', loja:'Magazine Luiza', categoria:'Eletrônicos', imagem:'https://images.unsplash.com/photo-1585515656558-1e1c5b6b0a2e?w=400&h=300&fit=crop', link:'https://www.mercadolivre.com.br/SEU-LINK'},
  {titulo:'Whey Protein Concentrado 1kg', preco:'R$ 89,90', antes:'R$ 139,90', loja:'Amazon', categoria:'Academia', imagem:'https://picsum.photos/seed/whey2/400/300', link:'https://www.amazon.com.br/dp/WHEY/?tag=SEUTAG'},
  {titulo:'Perfume Importado Masculino 100ml', preco:'R$ 149,90', antes:'R$ 249,90', loja:'Mercado Livre', categoria:'Perfume', imagem:'https://picsum.photos/seed/perfume2/400/300', link:'https://www.mercadolivre.com.br/SEU-LINK'},
];

function atualizar(){
  const agora=new Date();
  console.log(`[${agora.toLocaleString('pt-BR')}] Atualizando 5 ofertas em alta...`);
  // embaralha levemente para rotação a cada 2h
  const idx = Math.floor(Date.now() / (1000*60*60*2)) % categorias.length;
  const selecionadas = [];
  for(let i=0;i<5;i++){
    const cat = categorias[(idx+i)%categorias.length];
    const oferta = ofertasAlta.find(o=>o.categoria===cat) || ofertasAlta[i%ofertasAlta.length];
    selecionadas.push(oferta);
  }
  // atualiza site-ofertas json
  fs.writeFileSync(pathOfertasJson, JSON.stringify(selecionadas, null, 2), 'utf8');
  // atualiza app-gastos OFERTAS_APP
  let app = fs.readFileSync(pathApp,'utf8');
  const novoBloco = `let OFERTAS_APP = ${JSON.stringify(selecionadas, null, 2)};`;
  app = app.replace(/let OFERTAS_APP = \[[\s\S]*?\];/, novoBloco);
  fs.writeFileSync(pathApp, app, 'utf8');
  console.log('5 ofertas atualizadas:', selecionadas.map(o=>o.titulo).join(' | '));
  // redeploy surge (só local Windows, no CI o workflow faz deploy)
  if(process.platform==='win32'){
    const { spawn } = require('child_process');
    const p1 = spawn('surge', ['"C:\\Users\\depau\\Documents\\Default Project\\site-ofertas"', 'ofertas.controle45.com.br'], {shell:true});
    p1.stdout.on('data',d=>process.stdout.write(d));
    p1.on('close',()=>{
      const p2 = spawn('surge', ['"C:\\Users\\depau\\Documents\\Default Project\\app-gastos"', 'controle45-2025.surge.sh'], {shell:true});
      p2.stdout.on('data',d=>process.stdout.write(d));
    });
  }
}

atualizar();
if(process.argv.includes('--loop')){
  console.log('Modo loop: a cada 2 horas');
  setInterval(atualizar, 1000*60*60*2);
}
