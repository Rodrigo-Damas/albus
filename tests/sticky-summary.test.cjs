// node --test tests/sticky-summary.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const load=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=load('app-v3.js'),css=load('app-v2.css'),html=load('index.html');
test('resumo financeiro aparece antes de objetivos e calendário',()=>{
 const s=app.slice(app.indexOf('function render(){'),app.indexOf('function error('));
 assert.match(s,/albus-financial-sticky/);
 assert.match(s,/albus-sticky-sentinel/);
 assert.ok(s.indexOf('dashboardCards()')<s.indexOf('goalCards()'));
 assert.ok(s.indexOf('goalCards()')<s.indexOf('filters()+calendar()+details()'));
});
test('sticky fixa apenas resumo financeiro e origem dos pagamentos',()=>{
 assert.ok(css.includes('.albus-financial-sticky{'));
 assert.match(css,/position:sticky;top:0;z-index:22/);
 assert.ok(app.includes("return '<section class=\"albus-summary albus-compact-summary\"'"));
 assert.ok(app.includes('<section class="albus-month-origin">'));
});
test('cores nos números de receitas, despesas, reservas e saldo',()=>{
 const colors={income:'#169c72',expense:'#df5e62',reserve:'#5964d8',balance:'#df5e62'};
 for(const [kind,color] of Object.entries(colors)){
  const selector='.summary-card.'+kind+' .summary-value{color:'+color+';}';
  assert.ok(css.includes(selector),selector);
 }
});
test('quando fixado o resumo reduz de altura',()=>{
 assert.ok(css.includes('.albus-financial-sticky.is-stuck .albus-compact-summary .summary-card'));
 assert.ok(css.includes('.albus-financial-sticky.is-stuck .albus-compact-summary .summary-meta{display:none;}'));
});
test('layout compacto funciona em largura de telefone',()=>{
 assert.match(css,/@media\(max-width:690px\)/);
 assert.ok(css.includes('.albus-financial-sticky .albus-payment-origin{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'));
});
test('o armazenamento legado não foi substituído por nova chave',()=>{
 assert.ok(app.includes("const KEY='albus-calendar-local-v1'"));
 assert.ok(app.includes('B.save(localStorage,db)'));
 assert.ok(html.includes('src="/backup.js"'));
});
