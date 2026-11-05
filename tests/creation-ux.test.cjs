// Execute com: node --test tests/creation-ux.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const ctx={};
vm.runInNewContext(read('currency-mask.js'),ctx);
const M=ctx.AlbusMoneyMask;
const E=require('../engine.js');
const app=read('app-v3.js');
const html=read('index.html');
test('valores digitados viram moeda brasileira enquanto digita',()=>{
 assert.equal(M.formatDigits('1'),'R$\u00a00,01');
 assert.equal(M.formatDigits('1234'),'R$\u00a012,34');
 assert.equal(M.formatDigits('123456789'),'R$\u00a01.234.567,89');
});
test('valores monetarios permanecem identicos ao salvar',()=>{
 for(const cents of [0,1,10,100,2399,12345678,99999999999]){
  assert.equal(E.parseMoney(M.fromCents(cents)),cents);
 }
});
test('campos existentes em reais sao inicializados corretamente',()=>{
 assert.equal(E.parseMoney(M.initialValue('1.234,56')),123456);
 assert.equal(E.parseMoney(M.initialValue('0,00')),0);
});
test('Hoje substitui Criar no cabecalho do calendario',()=>{
 const calendar=app.slice(app.indexOf('function calendar(){'),app.indexOf('function row('));
 assert.ok(calendar.includes("button('Hoje','today'"));
 assert.ok(!calendar.includes('createMenu()'));
});
test('Criar fica logo abaixo do resumo do dia',()=>{
 const detail=app.slice(app.indexOf('function details(){'),app.indexOf('function entryForm('));
 assert.match(detail,/albus-details-create/);
 assert.ok(detail.indexOf('albus-details-create')>detail.indexOf('day-overview'));
});
test('filtros exibem explicacoes acessiveis',()=>{
 assert.ok(app.includes('albus-filter-help'));
 assert.ok(app.includes('Explicação de '));
 assert.ok(app.includes('Não altera lançamentos já salvos.'));
});
test('mascara e ativada em todos os formularios financeiros',()=>{
 for(const field of ['amount','target','initial','monthly','provisionFixed']){
  assert.ok(app.includes("moneyInput('"+field+"'"),field);
 }
 assert.ok(html.includes('src="/currency-mask.js"'));
 assert.ok(html.indexOf('currency-mask.js')<html.indexOf('app-v3.js'));
});
