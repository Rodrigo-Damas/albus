// node --test tests/reconciliation-monthly.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const E=require('../engine.js');
const component=(file,name)=>{const env={};vm.runInNewContext(read(file),env);return env[name]};
const Z=component('reconciliation.js','AlbusReconciliation');
const G=component('goals.js','AlbusGoals');
const P=component('goal-priorities.js','AlbusPriorities');
const H=component('emergency-planning.js','AlbusEmergency');
const today=(()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')})();
const month=E.monthOf(today);
const goal={id:'goal',title:'Reserva de emergência',goal_type:'emergency',target_cents:2000000,initial_cents:0,
 monthly_cents:50000,contribution_date:E.dateInMonth(month,1),schedule_enabled:true,
 responsible_ids:['rodrigo','daniele'],visibility:'shared'};
const db=()=>({entries:[],events:[],overrides:[],goals:[goal],
 settings:{goal_budget_limit_cents:50000,provisionPercent:0,provisionFixedCents:0}});
test('receita 100 planejada e 90 realizada atualiza o caixa sem perder o plano',()=>{
 const first={...db(),entries:[{id:'inc',entry_type:'income',entry_date:today,amount_cents:10000,status:'planned'}]};
 const next=Z.reconcileEntry(first,'inc',today,9000,'received',today,E);
 assert.equal(E.monthSummary(next.entries,next.overrides,month,{}).income,9000);
 assert.equal(next.entries[0].planned_amount_cents,10000);
 assert.equal(first.entries[0].amount_cents,10000);
});
test('despesa mensal 100 alterada para 120 afeta somente a ocorrência',()=>{
 const first={...db(),entries:[{id:'exp',entry_type:'expense',entry_date:E.dateInMonth(month,1),
  amount_cents:10000,frequency:'monthly',payment_method:'pix',status:'planned'}]};
 const firstDate=first.entries[0].entry_date;
 const next=Z.reconcileEntry(first,'exp',firstDate,12000,'paid',today,E);
 assert.equal(E.monthSummary(next.entries,next.overrides,month,{}).expense,12000);
 assert.equal(E.monthSummary(next.entries,next.overrides,E.addMonths(month,1),{}).expense,10000);
});
test('nova edição da ocorrência altera o registro anterior, não cria outro',()=>{
 const first={...db(),entries:[{id:'inc',entry_type:'income',entry_date:E.dateInMonth(month,1),amount_cents:10000,frequency:'monthly'}]};
 const date=first.entries[0].entry_date;
 const one=Z.reconcileEntry(first,'inc',date,9000,'received',today,E);
 const two=Z.reconcileEntry(one,'inc',date,9500,'received',today,E);
 assert.equal(two.overrides.length,1);
 assert.equal(E.monthSummary(two.entries,two.overrides,month,{}).income,9500);
});
test('aporte mensal realizado de 400 substitui previsão de 500 sem outro aporte',()=>{
 const first=db(),expected=P.rowsForMonth(P.simulate(first,E,G,H,month,null,4),month)[0];
 assert.equal(expected.amount_cents,50000);
 let next=Z.reconcileGoal(first,'goal',month,40000,today,expected,()=>'one',E);
 assert.equal(next.entries.length,1);
 assert.equal(G.realBalance(goal,next.entries,next.overrides),40000);
 assert.equal(P.rowsForMonth(P.simulate(next,E,G,H,month,null,4),month).length,0);
 next=Z.reconcileGoal(next,'goal',month,45000,today,expected,()=>'two',E);
 assert.equal(next.entries.length,1);
 assert.equal(G.realBalance(goal,next.entries,next.overrides),45000);
});
test('aporte não realizado marca mês como conferido sem reaparecer',()=>{
 const first=db(),expected=P.rowsForMonth(P.simulate(first,E,G,H,month,null,4),month)[0];
 const next=Z.reconcileGoal(first,'goal',month,0,today,expected,()=>'skipped',E);
 assert.equal(next.entries[0].status,'skipped');
 assert.equal(P.rowsForMonth(P.simulate(next,E,G,H,month,null,4),month).length,0);
});
test('dados legados realizados não geram nova reserva no mesmo mês',()=>{
 const first=db();first.entries.push({id:'old',goal_id:'goal',entry_type:'reserve',
  entry_date:E.dateInMonth(month,1),amount_cents:50000,status:'set_aside',frequency:'none'});
 assert.equal(P.rowsForMonth(P.simulate(first,E,G,H,month,null,4),month).length,0);
 const updated=Z.reconcileGoal(first,'goal',month,45000,today,null,()=>'new',E);
 assert.equal(updated.entries.length,1);
 assert.equal(updated.entries[0].id,'old');
});
test('interface exibe atualizado mensal e não confirmar aporte por dia',()=>{
 const app=read('app-v3.js'),css=read('app-v2.css'),html=read('index.html');
 assert.ok(app.includes("function monthlyGoalReviewForm()"));
 assert.ok(app.includes("function reconciliationEntryForm("));
 assert.ok(!app.includes("button('+ Registrar aporte'"));
 assert.ok(!app.includes("button('Confirmar aporte'"));
 assert.ok(css.includes('position:static!important;top:auto!important'));
 assert.ok(html.indexOf('src="/reconciliation.js"')<html.indexOf('src="/app-v3.js"'));
});
