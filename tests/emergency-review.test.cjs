// node --test tests/emergency-review.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(base,n),'utf8');
const E=require('../engine.js'),ctx={};vm.runInNewContext(read('emergency-planning.js'),ctx);
const H=ctx.AlbusEmergency;
const entry=(id,month,type,amount,category='Moradia')=>({
 id,entry_date:month+'-05',entry_type:type,amount_cents:amount,category,
 payment_method:'pix',frequency:'none',status:'planned'
});
test('sem lançamentos, estimativas zeradas para entrada manual',()=>{
 assert.equal(H.recommendedCost(E,[],[],'2026-11').cents,0);
 assert.equal(H.recommendedIncome(E,[],[],'2026-11').cents,0);
});
test('um mês cadastrado: usa o próprio valor sem margem fictícia',()=>{
 const items=[entry('one','2026-10','expense',430000)];
 const estimate=H.recommendedCost(E,items,[],'2026-11');
 assert.equal(estimate.months,1);
 assert.equal(estimate.cents,430000);
});
test('dois meses de despesas: pondera média para valor maior',()=>{
 const items=[entry('one','2026-10','expense',400000),entry('two','2026-09','expense',600000)];
 const estimate=H.recommendedCost(E,items,[],'2026-11');
 assert.equal(estimate.cents,530000);
 assert.equal(estimate.months,2);
 assert.equal(estimate.method,'70% da média + 30% do maior mês');
});
test('três meses de despesas: peso cauteloso no maior mês',()=>{
 const values=[400000,500000,600000];
 const items=values.map((v,i)=>entry('expense-'+i,['2026-10','2026-09','2026-08'][i],'expense',v));
 assert.equal(H.recommendedCost(E,items,[],'2026-11').cents,530000);
});
test('receitas: média simples de meses com lançamentos',()=>{
 const items=[entry('one','2026-10','income',450000),entry('two','2026-09','income',550000)];
 assert.equal(H.recommendedIncome(E,items,[],'2026-11').cents,500000);
});
test('mês atual sem histórico anterior fica sinalizado como parcial',()=>{
 const items=[entry('current','2026-11','expense',100000)];
 const value=H.recommendedCost(E,items,[],'2026-11');
 assert.equal(value.partial,true);
 assert.match(value.source,/pode estar incompleto/);
});
test('cálculo da margem não desconta aporte da própria reserva duas vezes',()=>{
 const items=[
  entry('inc','2026-10','income',600000),entry('cost','2026-10','expense',400000),
  {...entry('goal-reserve','2026-11','reserve',50000),goal_id:'goal'}
 ];
 const margin=H.contributionCapacity(E,items,[],'2026-11','goal',{
  variationPercent:0,provisionPercent:0,provisionFixedCents:0
 });
 assert.equal(margin.cents,200000);
});
test('formulário de revisão não grava mudanças automaticamente',()=>{
 const app=read('app-v3.js');
 assert.match(app,/Atualizar reserva de emergência/);
 assert.match(app,/Revisar meta e aporte/);
 assert.ok(app.includes("open('goal',{id:item,review:true})"));
 assert.ok(app.includes("B.save(localStorage,planned)"));
});
