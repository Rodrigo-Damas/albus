// node --test tests/sticky-summary.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=load('app-v3.js'),css=load('app-v2.css'),html=load('index.html');
test('indicadores financeiros aparecem antes dos objetivos e calendário',()=>{
 const start=app.indexOf('function render(){'),end=app.indexOf('\nfunction ',start+12);
 const segment=app.slice(start,end>start?end:undefined);
 assert.match(segment,/albus-financial-sticky/);
 assert.match(segment,/albus-sticky-sentinel/);
 assert.ok(segment.indexOf('dashboardCards()')<segment.indexOf('goalCards()'));
 assert.ok(segment.indexOf('goalCards()')<segment.indexOf('calendar()+'));
});
test('faixa de indicadores é fixa; origem dos pagamentos abre em modal',()=>{
 assert.match(css,/\.albus-financial-sticky\{/);
 assert.match(css,/position:sticky;top:0;z-index:22/);
 assert.ok(app.includes("data-action=\"summary\""));
 assert.ok(app.includes("function monthlySummaryModal(m)"));
 assert.ok(!app.includes("'<section class=\"albus-month-origin\""));
});
test('cores de receita, pagamento, reserva e saldo',()=>{
 const colors={income:'#169c72',expense:'#df5e62',reserve:'#5964d8'};
 for(const [kind,color] of Object.entries(colors)){
   assert.ok(css.includes('.summary-card.'+kind+' .summary-value{color:'+color+';}'));
 }
 assert.ok(css.includes('.summary-card.balance .summary-value {color:#169c72;}'));
 assert.ok(css.includes('.summary-card.balance.negative .summary-value {color:#c23a46;}'));
});
test('ao fixar reduz conteúdo auxiliar',()=>{
 assert.ok(css.includes('.albus-financial-sticky.is-stuck .albus-compact-summary .summary-card'));
 assert.ok(css.includes('.albus-financial-sticky.is-stuck .albus-compact-summary .summary-meta{display:none;}'));
});
test('layout móvel e painel diário alinhado no topo',()=>{
 assert.match(css,/@media\(max-width:690px\)/);
 assert.ok(css.includes('.albus-calendar-workspace.has-details'));
 assert.ok(css.includes('position:static!important;top:auto!important'));
});
test('chave de armazenamento antiga e exportação permanecem',()=>{
 assert.ok(app.includes("const KEY='albus-calendar-local-v1'"));
 assert.ok(app.includes('B.save(localStorage,db)'));
 assert.ok(html.includes('src="/backup.js"'));
});
