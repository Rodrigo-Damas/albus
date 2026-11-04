// Executar com: node --test tests/event-nested-payments.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const rootPath=path.join(__dirname,'..');
const read=filename=>fs.readFileSync(path.join(rootPath,filename),'utf8');
const Engine=require('../engine.js');
const evaluate=(filename,key)=>new Function(read(filename)+';return globalThis.'+key)();
const Access=evaluate('access-model.js','AlbusAccess');
const Goals=evaluate('goals.js','AlbusGoals');
const Money=evaluate('currency-mask.js','AlbusMoneyMask');
const Backup=evaluate('backup.js','AlbusBackup');
const app=read('app-v3.js');
const marker='G.getDailyCDI().then(data=>{if(data){state.cdi=data;if(!state.modal)render()}}).catch(()=>{});';
assert.ok(app.includes(marker),'Bloco de inicialização mudou');
const injected=app.replace(marker,marker+'\nreturn {state,db,render,open,submitEvent,submitEventExpense,cashSources,openHelp,closeHelp};');
class FormDataStub {
 constructor(form){this.fields=form.fields;}
 get(key){return this.fields[key]??null;}
 getAll(key){return Array.isArray(this.fields[key])?this.fields[key]:[];}
 has(key){return Object.hasOwn(this.fields,key);}
}
function setup({failSaving=false,fixture=null}={}){
 const source=fixture||{events:[],entries:[],goals:[],overrides:[],settings:{cardConfigured:true,closingDay:25,dueDay:5}};
 const map=new Map([[Backup.KEY,JSON.stringify(source)]]);
 const storage={getItem:key=>map.get(key)??null,
  setItem(key,value){if(failSaving&&key===Backup.KEY)throw Error('storage quota');map.set(key,String(value));}};
 const container={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
 const handlers={};
 const popup={
  style:{},dataset:{},setAttribute(){},remove(){this.removed=true},
  contains(){return false},getBoundingClientRect:()=>({width:320,height:80})};
 const document={getElementById:()=>container,addEventListener:(name,fn)=>{handlers[name]=fn},
  createElement:()=>popup,body:{appendChild(){}}};
 const api=new Function('document','localStorage','setTimeout','crypto','AlbusEngine','AlbusAccess',
  'AlbusGoals','AlbusMoneyMask','AlbusBackup','location','window','fetch','FormData',
  'return '+injected.trim())(document,storage,()=>{},{randomUUID},Engine,Access,
  {...Goals,getDailyCDI:async()=>null},Money,Backup,{origin:'https://preview.example'},
  {innerWidth:390,innerHeight:680},()=>Promise.reject(Error('offline')),FormDataStub);
 return {api,container,map,popup,handlers};
}
const expense={id:'ex1',entry_type:'expense',title:'Jantar',entry_date:'2026-11-15',
 amount_cents:15500,payment_method:'credit',status:'planned',category:'Lazer',frequency:'none'};
function saveEvent(context){
 context.api.submitEvent({preventDefault(){},currentTarget:{fields:{
  title:'Aniversário',date:'2026-11-15',notes:'',visibility:'shared',
  responsible_ids:['rodrigo','daniele']
 }}});
}
test('editor permite despesas vinculadas em rascunho e exibe dois diálogos',()=>{
 const ctx=setup();ctx.api.open('event',{date:'2026-11-15'});
 ctx.api.state.eventSession.draft={title:'Aniversário',date:'2026-11-15',responsible_ids:['rodrigo','daniele'],visibility:'shared'};
 ctx.api.state.modal={type:'event-expense'};ctx.api.render();
 assert.equal((ctx.container.innerHTML.match(/albus-modal-backdrop/g)||[]).length,2);
 assert.match(ctx.container.innerHTML,/event-return/);
 assert.equal(JSON.parse(ctx.map.get(Backup.KEY)).events.length,0);
});
test('salvar evento cria evento e várias despesas com vínculo em uma gravação',()=>{
 const ctx=setup();ctx.api.open('event',{date:'2026-11-15'});
 ctx.api.state.eventSession.staged=[expense,{...expense,id:'ex2',title:'Uber',amount_cents:2800,payment_method:'pix'}];
 saveEvent(ctx);
 const db=JSON.parse(ctx.map.get(Backup.KEY));
 assert.equal(db.events.length,1);assert.equal(db.entries.length,2);
 assert.ok(db.entries.every(x=>x.event_id===db.events[0].id));
 assert.equal(db.entries.reduce((total,x)=>total+x.amount_cents,0),18300);
});
test('se falhar gravação, rascunho segue aberto e nenhum dado anterior é sobrescrito',()=>{
 const ctx=setup({failSaving:true});const before=ctx.map.get(Backup.KEY);
 ctx.api.open('event',{date:'2026-11-15'});ctx.api.state.eventSession.staged=[expense];
 saveEvent(ctx);
 assert.equal(ctx.map.get(Backup.KEY),before);
 assert.equal(ctx.api.db.events.length,0);
 assert.equal(ctx.api.state.eventSession.staged.length,1);
});
test('fatura de compra anterior aparece separadamente no mês do pagamento',()=>{
 const db={...{events:[],entries:[],goals:[],overrides:[]},settings:{closingDay:25,dueDay:5,cardConfigured:true}};
 db.entries.push({...expense,id:'prev',entry_date:'2026-11-15',amount_cents:15000});
 db.entries.push({...expense,id:'curr',entry_date:'2026-12-02',amount_cents:3000,payment_method:'pix'});
 const ctx=setup({fixture:db});
 const cash=Engine.occurrencesForMonth(db.entries,[],'2026-12',db.settings,'cash');
 const parts=ctx.api.cashSources(cash,'2026-12');
 assert.equal(parts.oldCard,15000);
 assert.equal(parts.immediate,3000);
 assert.equal(parts.currentCard,0);
 assert.equal(parts.total,18000);
 assert.equal(Engine.monthSummary(db.entries,[],'2026-12',db.settings).expense,18000);
});
test('janela de ajuda permanece dentro da largura visível',()=>{
 const ctx=setup();const attributes={};
 const trigger={dataset:{help:'Explicação'},setAttribute:(key,value)=>{attributes[key]=value},
  getBoundingClientRect:()=>({left:310,right:330,top:200}),contains:()=>false};
 ctx.api.openHelp(trigger);
 assert.ok(Number.parseFloat(ctx.popup.style.left)>=12);
 assert.ok(Number.parseFloat(ctx.popup.style.left)+Number.parseFloat(ctx.popup.style.width)<=390-12);
 ctx.handlers.pointerdown({target:{}});
 assert.equal(ctx.popup.removed,true);
 assert.equal(attributes['aria-expanded'],'false');
});
