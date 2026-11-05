// node --test tests/calendar-first-mvp.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(base,n),'utf8');
const E=require('../engine.js');
const load=(n,key)=>{const ctx={};vm.runInNewContext(read(n),ctx);return ctx[key]};
const A=load('access-model.js','AlbusAccess');
const G=load('goals.js','AlbusGoals');
const H=load('emergency-planning.js','AlbusEmergency');
const P=load('goal-priorities.js','AlbusPriorities');
const B=load('backup.js','AlbusBackup');
const M=load('currency-mask.js','AlbusMoneyMask');
const R=load('expense-reuse.js','AlbusExpenseReuse');
const source=read('app-v3.js');
const marker='G.getDailyCDI().then(data=>{if(data){state.cdi=data;if(!state.modal)render()}}).catch(()=>{});';
assert.ok(source.includes(marker),'Inicialização mudou');
const injected=source.replace(marker,marker+'\nreturn {state,db,render,open,confirmPortfolio,cashRows};');
const goal={id:'g',goal_type:'emergency',title:'Reserva de emergência',target_cents:1000000,initial_cents:0,
 monthly_cents:50000,contribution_date:'2026-11-05',schedule_enabled:true,visibility:'shared',
 responsible_ids:['rodrigo','daniele']};
function setup(){
 const db={entries:[],events:[],goals:[goal],overrides:[],settings:{
 goal_budget_limit_cents:50000,provisionPercent:0,provisionFixedCents:0}};
 const saved=new Map([[B.KEY,JSON.stringify(db)]]);
 const root={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
 const doc={getElementById:()=>root,addEventListener(){}};
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))};
 const api=new Function('document','localStorage','setTimeout','crypto','AlbusEngine','AlbusAccess',
 'AlbusGoals','AlbusMoneyMask','AlbusBackup','AlbusExpenseReuse','AlbusEmergency',
 'AlbusPriorities','window','location','fetch','return '+injected.trim())(doc,storage,
 ()=>{},{randomUUID:()=> 'test-uuid'},E,A,{...G,getDailyCDI:async()=>null},M,B,R,H,P,
 {addEventListener(){},innerWidth:1200,innerHeight:800},{origin:'https://preview.example'},
 ()=>Promise.reject(Error('offline')));
 return {api,root,saved};
}
test('o calendário abre em largura total, sem filtros ou painel do dia',()=>{
 const {root}=setup();
 assert.match(root.innerHTML,/albus-calendar-workspace/);
 assert.doesNotMatch(root.innerHTML,/albus-filter-panel/);
 assert.doesNotMatch(root.innerHTML,/surface details/);
});
test('quatro indicadores clicáveis e objetivos recolhidos por padrão',()=>{
 const {root}=setup();
 assert.equal((root.innerHTML.match(/data-action="summary"/g)||[]).length,4);
 assert.match(root.innerHTML,/albus-goals-toggle/);
 assert.doesNotMatch(root.innerHTML,/albus-priority-item/);
});
test('origens de cartão aparecem no resumo de pagamentos, não no cabeçalho',()=>{
 const {api,root}=setup();
 assert.doesNotMatch(root.innerHTML,/class="albus-month-origin"/);
 api.open('monthly-summary',{kind:'expense'});
 assert.match(root.innerHTML,/Cartão · compras anteriores/);
 assert.match(root.innerHTML,/Pix, débito e dinheiro/);
});
test('a confirmação dos aportes aparece apenas no resumo de reservas',()=>{
 const {api,root}=setup();
 api.state.detailsOpen=true;api.render();
 assert.doesNotMatch(root.innerHTML,/data-action="confirm-portfolio"/);
 api.open('monthly-summary',{kind:'reserve'});
 assert.match(root.innerHTML,/Aportes a confirmar/);
 assert.match(root.innerHTML,/data-action="confirm-portfolio"/);
});
test('detalhamento do dia pode ser aberto e fechado sem apagar o calendário',()=>{
 const {api,root}=setup();
 api.state.detailsOpen=true;api.render();
 assert.match(root.innerHTML,/data-action="close-details"/);
 assert.match(root.innerHTML,/has-details/);
 api.state.detailsOpen=false;api.render();
 assert.doesNotMatch(root.innerHTML,/data-action="close-details"/);
});
test('todas as configurações estão em um único modal',()=>{
 const {api,root}=setup();
 api.open('settings');
 assert.match(root.innerHTML,/Como costuma pagar suas contas/);
 assert.match(root.innerHTML,/Data da compra/);
 assert.match(root.innerHTML,/Dia de fechamento/);
 assert.match(root.innerHTML,/Provisão de imprevistos/);
});
test('navegação não substitui os dados existentes',()=>{
 const {api,saved}=setup();
 const original=saved.get(B.KEY);
 api.open('monthly-summary',{kind:'income'});
 api.open('settings');
 api.state.detailsOpen=true;api.render();
 assert.equal(saved.get(B.KEY),original);
});
