// Executar com node --test tests/access-model.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../access-model.js'),'utf8');
const context={};
vm.runInNewContext(source,context);
const A=context.AlbusAccess;
test('dois integrantes no workspace familiar',()=>{
  assert.equal(A.DEFAULT_MEMBERS.length,2);
  assert.equal(A.DEFAULT_MEMBERS[0].name,'Rodrigo');
  assert.equal(A.DEFAULT_MEMBERS[1].name,'Danelle');
  assert.equal(A.WORKSPACE_ID,'familia-local');
});
test('lançamentos antigos permanecem visíveis sem descarte',()=>{
  const item=A.normalizeItem({id:'legado',entry_type:'income',title:'Salário',entry_date:'2026-11-05'});
  assert.equal(item.id,'legado');
  assert.equal(item.visibility,'shared');
  assert.equal(item.responsible_ids.length,2);
  assert.equal(A.canView(item,'rodrigo'),true);
  assert.equal(A.canView(item,'daniele'),true);
});
test('despesa compartilhada aceita dois responsáveis',()=>{
  const d=A.normalizeItem({id:'compra',created_by:'rodrigo',visibility:'shared',responsible_ids:['rodrigo','daniele']});
  assert.equal(A.responsibleLabel(d),'Rodrigo e Danelle');
  assert.equal(A.visibleItems([d],'daniele','all').length,1);
  assert.equal(A.visibleItems([d],'daniele','rodrigo').length,1);
  assert.equal(A.visibleItems([d],'daniele','daniele').length,1);
});
test('item individual não aparece para o outro membro',()=>{
  const d=A.normalizeItem({id:'pessoal',created_by:'rodrigo',visibility:'private',responsible_ids:['rodrigo']});
  assert.equal(A.canView(d,'daniele'),false);
  assert.equal(A.canView(d,'rodrigo'),true);
  assert.equal(A.visibleItems([d],'daniele','all').length,0);
  assert.equal(A.visibleItems([d],'rodrigo','shared').length,0);
});
test('responsáveis privados só podem ser o criador',()=>{
  assert.throws(()=>A.validateOwnership({creatorId:'rodrigo',responsibleIds:['rodrigo','daniele'],visibility:'private'}));
  assert.throws(()=>A.validateOwnership({creatorId:'rodrigo',responsibleIds:['daniele'],visibility:'private'}));
  const actual=A.validateOwnership({creatorId:'rodrigo',responsibleIds:['rodrigo'],visibility:'private'});
  assert.equal(actual.visibility,'private');
  assert.equal(actual.responsible_ids.length,1);
});
test('usuário conectado não é inferido a partir do nome de uma despesa',()=>{
  const item=A.normalizeItem({id:'x',title:'Salário Danelle',created_by:'rodrigo',visibility:'shared',responsible_ids:['rodrigo']});
  assert.equal(A.responsibleLabel(item),'Rodrigo');
});
