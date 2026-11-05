// node --test tests/goals-flow.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=require('../engine.js');
const ctx={localStorage:{getItem:()=>null,setItem:()=>{}},fetch:async()=>{throw Error('offline')},AbortSignal:{timeout:()=>null}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../goals.js'),'utf8'),ctx);
const G=ctx.AlbusGoals;
test('salário no quinto dia útil com sábado incluído',()=>{
 assert.equal(engine.businessDate('2026-11',5,true),'2026-11-07');
});
test('salário no quinto dia útil sem sábado',()=>{
 assert.equal(engine.businessDate('2026-11',5,false),'2026-11-09');
});
test('receita recorrente segue dia útil em dois meses consecutivos',()=>{
 const x={id:'salary',entry_date:'2026-10-08',entry_type:'income',frequency:'business_day_monthly',business_day_number:5,include_saturday:true};
 assert.equal(engine.expandMonth([x],[],'2026-11')[0].occurrence_date,'2026-11-07');
 assert.equal(engine.expandMonth([x],[],'2026-12')[0].occurrence_date,'2026-12-05');
});
test('aporte previsto não entra no saldo real',()=>{
 const goal={id:'home',initial_cents:100000,target_cents:800000,monthly_cents:10000};
 const planned={id:'p',goal_id:'home',entry_type:'reserve',status:'planned',entry_date:'2026-11-05',amount_cents:12000};
 assert.equal(G.realBalance(goal,[planned]),100000);
});
test('aporte confirmado entra uma vez no saldo',()=>{
 const goal={id:'home',initial_cents:100000};
 const done={id:'p',goal_id:'home',entry_type:'reserve',status:'set_aside',frequency:'none',entry_date:'2026-11-05',amount_cents:12000};
 assert.equal(G.realBalance(goal,[done]),112000);
});
test('recorrente só altera saldo quando ocorrência for confirmada',()=>{
 const goal={id:'home',initial_cents:100000};
 const month={id:'r',goal_id:'home',entry_type:'reserve',status:'planned',frequency:'monthly',amount_cents:15000,entry_date:'2026-10-05'};
 const override={entry_id:'r',occurrence_date:'2026-11-05',status:'set_aside',amount_cents:15000};
 assert.equal(G.realBalance(goal,[month]),100000);
 assert.equal(G.realBalance(goal,[month],[override]),115000);
 assert.equal(engine.expandMonth([month],[override],'2026-11')[0].status,'set_aside');
});
test('projeção não cria saldo real fictício',()=>{
 const g={id:'goal',initial_cents:100000,target_cents:500000,monthly_cents:50000,cdi_percent:100};
 const projection=G.forecast(g,[],{annualPercent:12},'2026-11');
 assert.equal(projection.actual,100000);
 assert.ok(projection.monthsToGoal>=1);
 assert.ok(projection.estimatedMonth);
});
test('taxa CDI diária anualizada com 252 dias úteis',()=>{
 const annual=G.cdiAnnualFromDaily(0.05);
 assert.ok(annual>12&&annual<14);
});
