// node --test tests/always-on-goal-queue.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const E=require('../engine.js');
function moduleOf(file,exportName){
 const context={};vm.runInNewContext(read(file),context);return context[exportName];
}
const P=moduleOf('goal-priorities.js','AlbusPriorities');
const H=moduleOf('emergency-planning.js','AlbusEmergency');
const G=moduleOf('goals.js','AlbusGoals');
const make=(id,target,monthly,type='general')=>({
 id,title:id,goal_type:type,target_cents:target,monthly_cents:monthly,
 initial_cents:0,contribution_date:'2026-11-10',schedule_enabled:true,
 priority_index:type==='emergency'?0:1,visibility:'shared',responsible_ids:['rodrigo','daniele']
});
function data(){
 return {goals:[make('reserva',10000000,400000,'emergency'),make('casa',20000000,200000)],
 entries:[],events:[],overrides:[],settings:{goal_budget_limit_cents:500000,provisionPercent:0,provisionFixedCents:0}};
}
test('fila é obrigatória mesmo em configurações legadas',()=>{
 assert.equal(P.active({goal_allocation_mode:'legacy'}),true);
 assert.equal(P.active({}),true);
});
test('R$ 5 mil de limite, R$ 4 mil para reserva, R$ 1 mil para casa',()=>{
 const nov=P.simulate(data(),E,G,H,'2026-11',null,2).results.get('2026-11');
 assert.deepEqual(Array.from(nov,x=>[x.goal_id,x.amount_cents]),[['reserva',400000],['casa',100000]]);
});
test('R$ 5 mil pretendidos na reserva deixam a casa com zero',()=>{
 const db=data();db.goals[0].monthly_cents=500000;
 const nov=P.simulate(db,E,G,H,'2026-11',null,2).results.get('2026-11');
 assert.equal(nov.length,1);assert.equal(nov[0].goal_id,'reserva');
});
test('reserva concluída libera o valor pretendido da casa, sem aporte forçado',()=>{
 const db=data();db.goals[0].initial_cents=db.goals[0].target_cents;
 const nov=P.simulate(db,E,G,H,'2026-11',null,2).results.get('2026-11');
 assert.equal(nov.length,1);assert.equal(nov[0].goal_id,'casa');
 assert.equal(nov[0].amount_cents,200000);
});
test('referência educativa: 20% da receita estimada, independente das despesas',()=>{
 const db=data();delete db.settings.goal_budget_limit_cents;
 db.entries=[{id:'i',entry_type:'income',entry_date:'2026-10-01',amount_cents:1000000},
 {id:'e',entry_type:'expense',entry_date:'2026-10-01',amount_cents:990000,category:'Moradia'}];
 assert.equal(P.budget(db,E,H,'2026-11').cents,200000);
});
test('exclusão mantém os pagamentos realizados e cancela previsões futuras',()=>{
 const db=data();db.entries=[{id:'old',entry_type:'reserve',goal_id:'reserva',
 entry_date:'2026-09-10',frequency:'monthly',status:'planned',amount_cents:10000,
 auto_scheduled:true}];
 db.overrides=[{entry_id:'old',occurrence_date:'2026-10-10',status:'set_aside',amount_cents:10000}];
 const result=P.removeGoal(db,'reserva',()=>'archive-1');
 assert.equal(result.data.goals.length,1);
 assert.equal(result.data.entries.length,1);
 assert.equal(result.data.entries[0].status,'set_aside');
 assert.equal(result.data.entries[0].goal_id,null);
 assert.equal(result.data.overrides.length,0);
});
test('interface não oferece ativar ou desativar a fila',()=>{
 const app=read('app-v3.js');
 assert.ok(!app.includes('name="priority_mode"'));
 assert.ok(app.includes('goal_budget_limit_cents:limit'));
 assert.ok(app.includes('P.removeGoal(db,item,id)'));
});
