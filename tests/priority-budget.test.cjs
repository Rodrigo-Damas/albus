// node --test tests/priority-budget.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const E=require('../engine.js');
const load=(file,key)=>{const ctx={};vm.runInNewContext(read(file),ctx);return ctx[key];};
const P=load('goal-priorities.js','AlbusPriorities');
const H=load('emergency-planning.js','AlbusEmergency');
const G=load('goals.js','AlbusGoals');
const emergency=(target=1000000)=>({id:'emergency',goal_type:'emergency',title:'Reserva de emergência',target_cents:target,
 initial_cents:0,monthly_cents:500000,contribution_date:'2026-11-10',schedule_enabled:true,priority_index:0});
const car=(target=700000)=>({id:'car',goal_type:'general',title:'Carro',target_cents:target,initial_cents:0,
 monthly_cents:500000,contribution_date:'2026-11-06',schedule_enabled:true,priority_index:1});
const setup=(goals=[emergency(),car()],limit=500000)=>({goals,entries:[],overrides:[],
 settings:{goal_allocation_mode:'priority',goal_budget_limit_cents:limit,provisionPercent:0,provisionFixedCents:0}});
test('reserva de emergência sempre tem primeira prioridade',()=>{
 const data=setup([car(),emergency()]);
 assert.deepEqual(Array.from(P.ordered(data.goals),x=>x.id),['emergency','car']);
});
test('limite de R$ 5 mil não é ultrapassado',()=>{
 const sim=P.simulate(setup(),E,G,H,'2026-11',null,8);
 for(const allocations of sim.results.values()){
  assert.ok(allocations.reduce((sum,x)=>sum+x.amount_cents,0)<=500000);
 }
});
test('carro recebe a sobra do limite mesmo com reserva em andamento',()=>{
 const sim=P.simulate(setup(),E,G,H,'2026-11',null,6);
 assert.equal(sim.results.get('2026-11')[0].goal_id,'emergency');
 assert.equal(sim.results.get('2026-11').length,1);
 assert.equal(sim.results.get('2026-12')[0].goal_id,'emergency');
 assert.equal(sim.results.get('2027-01')[0].goal_id,'car');
});
test('saldo remanescente pode ser aproveitado no mês de conclusão',()=>{
 const sim=P.simulate(setup([emergency(600000),car(700000)]),E,G,H,'2026-11',null,4);
 const december=sim.results.get('2026-12');
 assert.equal(december[0].amount_cents,100000);
 assert.equal(december[1].amount_cents,400000);
 assert.ok(december[1].date>=december[0].date);
});
test('confirmar aporte anterior reduz limite disponível no mesmo mês',()=>{
 const db=setup();
 db.entries.push({id:'confirmed',goal_id:'emergency',entry_type:'reserve',
 entry_date:'2026-11-08',amount_cents:200000,status:'set_aside',frequency:'none'});
 const rows=P.rowsForMonth(P.simulate(db,E,G,H,'2026-11',null,3),'2026-11');
 assert.equal(rows.reduce((sum,x)=>sum+x.amount_cents,0),300000);
});
test('aporte manual ou reserva independente já compromete o limite',()=>{
 const db=setup();
 db.entries.push({id:'other',entry_type:'reserve',entry_date:'2026-11-08',
 amount_cents:100000,status:'planned',frequency:'none'});
 const rows=P.rowsForMonth(P.simulate(db,E,G,H,'2026-11',null,3),'2026-11');
 assert.equal(rows[0].amount_cents,400000);
});
test('fila permanece ativa com configurações antigas',()=>{
 const db=setup();db.settings.goal_allocation_mode='legacy';
 assert.equal(P.active(db.settings),true);
 assert.ok(P.simulate(db,E,G,H,'2026-11').results.size>0);
});
test('reordenar duas metas preserva a reserva em primeiro',()=>{
 const goals=[emergency(),{...car(),priority_index:1},{...car(),id:'trip',title:'Viagem',priority_index:2}];
 const reordered=P.reorder(goals,'trip','car');
 assert.deepEqual(Array.from(P.ordered(reordered),x=>x.id),['emergency','trip','car']);
});
test('não modifica o histórico do usuário ao projetar',()=>{
 const db=setup();
 const original=JSON.stringify(db);
 P.simulate(db,E,G,H,'2026-11',null,12);
 assert.equal(JSON.stringify(db),original);
});
test('interface contém configuração de limite no resumo, formulário e ações de ordem',()=>{
 const app=read('app-v3.js'),html=read('index.html');
 assert.ok(html.includes('/goal-priorities.js'));
 assert.ok(app.includes("'portfolio-settings'"));
 assert.ok(app.includes("'priority-up'"));
 assert.ok(app.includes("'priority-down'"));
 assert.ok(app.includes("reorderPriority(id,hover.dataset.priorityId)"));
 assert.ok(app.includes("Confirmar','confirm-portfolio'"));
});
