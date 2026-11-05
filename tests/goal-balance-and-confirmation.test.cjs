// node --test tests/goal-balance-and-confirmation.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
function load(file,name){const ctx={};vm.runInNewContext(read(file),ctx);return ctx[name];}
const G=load('goals.js','AlbusGoals');
const A=load('access-model.js','AlbusAccess');
const E=require('../engine.js');
const H=load('emergency-planning.js','AlbusEmergency');
const P=load('goal-priorities.js','AlbusPriorities');
const B=load('backup.js','AlbusBackup');
const M=load('currency-mask.js','AlbusMoneyMask');
const R=load('expense-reuse.js','AlbusExpenseReuse');
const app=read('app-v3.js');
const goal={id:'goal',title:'Reserva de emergência',goal_type:'emergency',
 monthly_cost_cents:2600000,income_reference_cents:10000000,
 coverage_months:6,target_cents:15600000,initial_cents:10000000,
 monthly_cents:500000,cdi_percent:120,contribution_date:'2026-11-10',
 schedule_enabled:true,responsible_ids:['rodrigo','daniele'],visibility:'shared'};
const entry={id:'prior',entry_type:'reserve',goal_id:'goal',entry_date:'2026-10-10',
 amount_cents:1900000,status:'set_aside',frequency:'none'};
test('saldo atual não soma novamente aportes do passado',()=>{
 assert.equal(G.realBalance(goal,[entry]),11900000);
 const same=G.withCurrentBalance(goal,11900000,[entry]);
 assert.equal(G.realBalance(same,[entry]),11900000);
 const updated=G.withCurrentBalance(goal,12100000,[entry]);
 assert.equal(G.realBalance(updated,[entry]),12100000);
 assert.equal(G.realBalance(updated,[entry,{...entry,id:'next',amount_cents:500000}]),12600000);
 assert.equal(goal.initial_cents,10000000);
});
test('formulário utiliza saldo atual e mantém custo/meta informados',()=>{
 assert.match(app,/moneyInput\('current_balance'/);
 assert.match(app,/const cost=old\.monthly_cost_cents\?\?suggested\.cents/);
 assert.match(app,/const target=E\.parseMoney\(f\.get\('target'\)\)/);
 assert.ok(!app.includes("Saldo inicial real (R$)"));
});
test('revisão abre editor, não comparação de histórico',()=>{
 assert.match(app,/if\(action==='review-emergency'\)return open\('goal',\{id:item,review:true\}\)/);
 assert.ok(app.includes("goalForm({...m,review:true})"));
});
test('confirmação de exclusão pertence ao Albus, sem alerta nativo',()=>{
 assert.ok(app.includes("function confirmGoalDeletion(m)"));
 assert.ok(app.includes("state.modal?.type==='confirm-goal-delete'"));
 assert.ok(app.includes("action==='approve-goal-delete'"));
 assert.ok(!app.includes("if(!confirm('Excluir o objetivo"));
});
test('caixinhas mostram aporte desejado, possível e prioridade',()=>{
 assert.match(app,/Aporte desejado:/);
 assert.match(app,/Aporte possível em /);
 assert.ok(app.includes("Prioridade '+position"));
});
test('formulário de reserva mantém percentual de CDI editável',()=>{
 assert.ok(app.includes("name=\"cdi_percent\""));
 assert.ok(app.includes("old.cdi_percent??100"));
});
