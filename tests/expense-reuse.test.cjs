// node --test tests/expense-reuse.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const ctx={};vm.runInNewContext(read('expense-reuse.js'),ctx);
const R=ctx.AlbusExpenseReuse;
const source={
 events:[
 {id:'a',title:'Evento A',date:'2026-11-05',visibility:'shared',responsible_ids:['rodrigo','daniele']},
 {id:'b',title:'Evento B',date:'2026-11-17',visibility:'shared',responsible_ids:['daniele']}],
 entries:[{id:'x',entry_type:'expense',title:'Restaurante',entry_date:'2026-11-05',event_id:'a',amount_cents:15000,
 payment_method:'credit',status:'paid',frequency:'none',payment_date_override:'2026-12-15',visibility:'shared'}]
};
test('despesa vinculada arrastada para dia vira cópia independente',()=>{
 const data=R.copy(source,'x',{date:'2026-11-11',newId:'copy1',currentUser:'rodrigo'});
 assert.equal(data.entries.length,2);assert.equal(data.entries[0].event_id,'a');
 assert.equal(data.entries[1].event_id,null);assert.equal(data.entries[1].entry_date,'2026-11-11');
 assert.equal(data.entries[1].amount_cents,15000);assert.equal(data.entries[1].status,'planned');
 assert.equal(data.entries[1].payment_date_override,undefined);
});
test('cópia pode ser vinculada ao segundo evento sem alterar original',()=>{
 const data=R.copy(source,'x',{eventId:'b',newId:'copy2',currentUser:'rodrigo'});
 assert.equal(data.entries[1].event_id,'b');assert.equal(data.entries[1].entry_date,'2026-11-17');
 assert.equal(data.entries[0].event_id,'a');assert.deepEqual(Array.from(data.entries[1].responsible_ids),['daniele']);
});
test('permite reutilizar diversas vezes',()=>{
 const first=R.copy(source,'x',{eventId:'b',newId:'c1'});
 const second=R.copy(first,'x',{eventId:'b',newId:'c2'});
 assert.equal(second.entries.length,3);assert.equal(source.entries.length,1);
});
test('desvincular remove só o vínculo e mantém valor e pagamento',()=>{
 const updated=R.detach(source,'x');
 assert.equal(updated.entries[0].event_id,null);assert.equal(updated.entries[0].amount_cents,15000);
 assert.equal(updated.entries[0].status,'paid');assert.equal(source.entries[0].event_id,'a');
});
test('cópia de recorrência vira lançamento único e planejado',()=>{
 const monthly={...source,entries:[{...source.entries[0],frequency:'monthly'}]};
 const result=R.copy(monthly,'x',{newId:'copy3',date:'2026-12-12',occurrenceDate:'2026-12-05'});
 assert.equal(result.entries[1].frequency,'none');assert.equal(result.entries[1].status,'planned');
});
test('não permite ID duplicado ou evento inexistente',()=>{
 assert.throws(()=>R.copy(source,'x',{newId:'x',date:'2026-11-09'}));
 assert.throws(()=>R.copy(source,'x',{newId:'new',eventId:'does-not-exist'}));
});
test('menu Criar segue a ordem solicitada',()=>{
 const app=read('app-v3.js');
 const menu=app.slice(app.indexOf('function createMenu()'),app.indexOf('function showGoalCard('));
 const kinds=['expense','income','event','goal','task'];
 const positions=kinds.map(k=>menu.indexOf("['"+k+"',"));
 assert.ok(positions.every(x=>x>=0));
 assert.deepEqual([...positions].sort((a,b)=>a-b),positions);
 assert.ok(app.includes('data-drop-event'));
 assert.ok(app.includes('reuseExpense(current.id'));
});
