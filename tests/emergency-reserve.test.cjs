// node --test tests/emergency-reserve.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'..');
const src=name=>fs.readFileSync(path.join(base,name),'utf8');
const engine=require('../engine.js');
const ctx={};vm.runInNewContext(src('emergency-planning.js'),ctx);
const H=ctx.AlbusEmergency;
const data=()=>({entries:[],overrides:[],goals:[],events:[],settings:{variationPercent:0,provisionPercent:0,provisionFixedCents:0}});
const goal=()=>({id:'emergency',title:'Reserva de emergência',goal_type:'emergency',
 target_cents:2400000,initial_cents:0,monthly_cents:100000,
 contribution_date:'2026-11-10',schedule_enabled:true,visibility:'shared',
 responsible_ids:['rodrigo','daniele'],created_by:'rodrigo',workspace_id:'familia-local'});
test('reserva inicial sugerida cobre 6, 12, 18 e 24 meses',()=>{
 for(const months of [6,12,18,24])assert.equal(H.emergencyTarget(400000,months),400000*months);
 assert.throws(()=>H.emergencyTarget(400000,5));
});
test('sugestão de custo ignora lazer em modalidade essencial',()=>{
 const d=data();d.entries=[
 {id:'a',entry_type:'expense',entry_date:'2026-10-04',amount_cents:100000,category:'Alimentação',payment_method:'pix'},
 {id:'b',entry_type:'expense',entry_date:'2026-10-05',amount_cents:50000,category:'Lazer',payment_method:'pix'}
 ];
 assert.equal(H.recommendedCost(engine,d.entries,[], '2026-11','essential').cents,100000);
 assert.equal(H.recommendedCost(engine,d.entries,[], '2026-11','all').cents,150000);
});
test('após receita sugere o dia seguinte',()=>{
 const entries=[{id:'salario',entry_type:'income',entry_date:'2026-11-05',amount_cents:400000,frequency:'monthly'}];
 assert.equal(H.suggestedContributionDate(engine,entries,[],'2026-11'),'2026-11-06');
});
test('ao salvar objetivo, apenas um aporte entra nas reservas do mês',()=>{
 const g=goal(),d=H.syncSchedule(data(),g,engine,'2026-11-05',()=>'rec');
 assert.equal(d.entries.length,1);
 assert.equal(d.entries[0].goal_id,g.id);
 assert.equal(d.entries[0].frequency,'monthly');
 assert.equal(d.entries[0].status,'planned');
 assert.equal(engine.monthSummary(d.entries,d.overrides,'2026-11',d.settings).reserve,100000);
});
test('salvar mesma meta duas vezes não cria aportes duplicados',()=>{
 const g=goal(),old=H.syncSchedule(data(),g,engine,'2026-11-05',()=>'first');
 const again=H.syncSchedule(old,g,engine,'2026-11-05',()=>'second');
 assert.equal(again.entries.length,1);
});
test('mudança de aporte preserva mês anterior e altera apenas próximos meses',()=>{
 const g=goal(),old=H.syncSchedule(data(),g,engine,'2026-11-05',()=>'first');
 const changed=H.syncSchedule(old,{...g,monthly_cents:200000,contribution_date:'2026-11-20'},engine,'2026-11-05',()=>'second');
 assert.equal(engine.monthSummary(changed.entries,changed.overrides,'2026-11',changed.settings).reserve,100000);
 assert.equal(engine.monthSummary(changed.entries,changed.overrides,'2026-12',changed.settings).reserve,200000);
 assert.equal(changed.entries.length,2);
});
test('caixinha antiga com aporte mensal não recebe outra série',()=>{
 const g=goal(),d=data();d.entries.push({
 id:'legacy',goal_id:g.id,entry_type:'reserve',entry_date:'2026-10-10',
 amount_cents:100000,frequency:'monthly',status:'planned'
 });
 const out=H.syncSchedule(d,g,engine,'2026-11-05',()=>'new');
 assert.equal(out.entries.length,1);
});
test('meta de emergência já completa não gera novo plano automático',()=>{
 const g={...goal(),initial_cents:2400000};
 assert.equal(H.syncSchedule(data(),g,engine,'2026-11-05',()=>'id').entries.length,0);
});
test('reconhece reserva antiga pelo nome',()=>{
 assert.equal(H.isEmergency({title:'Reserva de emergência'}),true);
});
test('marco de conquista prevista aparece na data de aporte',()=>{
 const g=goal(),d=H.milestone(g,{progress:90,estimatedMonth:'2028-01'},engine);
 assert.equal(d,'2028-01-10');
 assert.equal(H.milestone(g,{progress:100,estimatedMonth:'2028-01'},engine),null);
});
test('código da interface mantém resumo e alvo no calendário',()=>{
 const app=src('app-v3.js');
 assert.ok(app.includes('Reservas, objetivos e imprevistos'));
 assert.ok(app.includes('albus-goal-milestone'));
 assert.ok(app.includes("H.syncSchedule(next,goal,E,today(),id)"));
 assert.ok(app.includes("B.save(localStorage,planned)"));
 const html=src('index.html');
 assert.ok(html.includes('/emergency-planning.js'));
 assert.ok(html.indexOf('/emergency-planning.js')<html.indexOf('/app-v3.js'));
});
