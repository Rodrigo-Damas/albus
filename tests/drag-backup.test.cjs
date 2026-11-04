// node --test tests/drag-backup.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const E=require('../engine.js');
function loadApi(pathName,key){
 const context={};vm.runInNewContext(read(pathName),context);return context[key];
}
const A=loadApi('access-model.js','AlbusAccess');
const M=loadApi('currency-mask.js','AlbusMoneyMask');
const B=loadApi('backup.js','AlbusBackup');
const G=loadApi('goals.js','AlbusGoals');
const app=read('app-v3.js');
function simulation(fixture,{kind='event',itemId='event',occurrence='',target='2026-11-07',failSave=false}={}){
 const listeners={},hover={dataset:{dropDate:target},classList:{add(){},remove(){}},closest(selector){return selector==='[data-drop-date]'?this:null}};
 const source={dataset:{dragKind:kind,dragId:itemId,occurrence},classList:{add(){},remove(){}},
  addEventListener(name,fn){listeners[name]=fn},setPointerCapture(){}};
 const node={closest(selector){return selector==='[data-drag-kind]'?source:null}};
 const container={innerHTML:'',querySelectorAll(selector){return selector==='[data-drag-kind]'?[source]:[]},querySelector(){return null}};
 const storage=new Map([[B.KEY,JSON.stringify(fixture)]]);
 const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem(k,v){if(failSave&&k===B.KEY)throw Error('quota exceeded');storage.set(k,String(v))}};
 const document={getElementById:()=>container,elementFromPoint:()=>hover};
 const ctx={document,localStorage,setTimeout(){},crypto:{randomUUID:()=> 'uuid-test'},AlbusEngine:E,AlbusAccess:A,
  AlbusGoals:{...G,getDailyCDI:async()=>null},AlbusMoneyMask:M,AlbusBackup:B,
  location:{origin:'https://preview.example',reload(){}},confirm:()=>true};
 const before=storage.get(B.KEY);
 vm.runInNewContext(app,ctx);
 const e=(x,y)=>({pointerId:1,button:0,pointerType:'mouse',target:node,clientX:x,clientY:y,
   cancelable:true,preventDefault(){},stopPropagation(){}});
 listeners.pointerdown(e(10,10));listeners.pointermove(e(30,45));listeners.pointerup(e(30,45));
 return {data:JSON.parse(storage.get(B.KEY)),before,after:storage.get(B.KEY),snapshot:storage.get(B.SNAPSHOT_KEY)};
}
test('arrastar evento move despesas vinculadas sem eliminar dados',()=>{
 const old={events:[{id:'event',date:'2026-11-04',title:'Aniversário'}],entries:[{id:'expense',entry_date:'2026-11-04',
  event_id:'event',entry_type:'expense',payment_method:'pix',amount_cents:30000}],goals:[],settings:{}};
 const after=simulation(old);
 assert.equal(after.data.events[0].date,'2026-11-07');
 assert.equal(after.data.entries[0].entry_date,'2026-11-07');
 assert.equal(after.data.entries[0].amount_cents,30000);
 assert.equal(after.snapshot,after.before);
});
test('arrastar parcela mensal modifica somente ocorrência',()=>{
 const old={events:[],entries:[{id:'salary',entry_date:'2026-10-05',frequency:'monthly',entry_type:'income',
  amount_cents:400000,title:'Salário'}],overrides:[],goals:[],settings:{view:'purchase'}};
 const after=simulation(old,{kind:'entry',itemId:'salary',occurrence:'2026-11-05',target:'2026-11-08'});
 assert.equal(after.data.entries[0].entry_date,'2026-10-05');
 assert.equal(after.data.overrides[0].occurrence_date,'2026-11-05');
 assert.equal(after.data.overrides[0].moved_to_date,'2026-11-08');
 assert.equal(E.expandMonth(after.data.entries,after.data.overrides,'2026-12')[0].occurrence_date,'2026-12-05');
});
test('falha de persistência mantém dados originais',()=>{
 const old={events:[{id:'event',date:'2026-11-04'}],entries:[],goals:[],settings:{}};
 const after=simulation(old,{failSave:true});
 assert.equal(after.after,after.before);
 assert.equal(after.data.events[0].date,'2026-11-04');
});
test('importação adiciona registros sem substituir históricos',()=>{
 const existing={events:[],entries:[{id:'1',title:'Atual'}],goals:[],settings:{profile:'credit'}};
 const loaded=B.merge(existing,{format:B.FORMAT,data:{entries:[{id:'1',title:'Antigo'},{id:'2',title:'Extra'}],events:[],goals:[]}});
 assert.equal(loaded.data.entries.length,2);
 assert.equal(loaded.data.entries[0].title,'Atual');
 assert.equal(loaded.data.settings.profile,'credit');
});
test('backup não altera a chave do usuário',()=>{
 assert.equal(B.KEY,'albus-calendar-local-v1');
 assert.equal(B.SNAPSHOT_KEY,'albus-calendar-local-v1-snapshot');
});
