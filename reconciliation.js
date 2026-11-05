/* Planejado x realizado — reconciliação idempotente por ocorrência.
 * Não substitui os valores planejados e não apaga dados anteriores. */
(function(scope){
 'use strict';
 const finished={income:'received',expense:'paid',reserve:'set_aside',task:'done'};
 function cents(value){
  const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Valor realizado inválido.');
  return n;
 }
 function isReconciled(x){
  return !!x&&((Object.prototype.hasOwnProperty.call(x,'realized_amount_cents')&&
   Number.isSafeInteger(Number(x.realized_amount_cents)))||x.reconciliation_state==='confirmed'||x.reconciliation_state==='not_done');
 }
 function byMonth(data,goalId,month){
  return (data.entries||[]).find(e=>e.goal_id===goalId&&e.entry_type==='reserve'&&
   e.goal_reconciliation_month===month)||null;
 }
 function goalAlreadyCompleted(data,goalId,month,engine,settings){
  const listed=engine.occurrencesForMonth((data.entries||[]).filter(e=>e.goal_id===goalId&&e.entry_type==='reserve'),
   data.overrides||[],month,settings||{},'cash');
  return listed.find(e=>e.status==='set_aside'||e.status==='skipped'||e.reconciliation_state==='confirmed'||
    e.reconciliation_state==='not_done')||null;
 }
 function reconcileGoal(data,goalId,month,amount,actualDate,expected,id,engine){
  const goal=(data.goals||[]).find(g=>g.id===goalId);
  if(!goal)throw Error('Caixinha não encontrada.');
  const paid=cents(amount);
  if(!engine.dateParts(actualDate)||engine.monthOf(actualDate)!==month)throw Error('Escolha uma data dentro do mês conciliado.');
  const d=new Date(),localToday=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(actualDate>localToday)throw Error('Não é possível confirmar um lançamento futuro.');
  const current=byMonth(data,goalId,month);
  const legacy=goalAlreadyCompleted(data,goalId,month,engine,data.settings);
  if(legacy&&!current&&legacy.frequency!=='none')throw Error('Já existe um aporte recorrente realizado. Revise aquela ocorrência para evitar duplicidade.');
  if(legacy&&!current&&legacy.frequency==='none'){
   const original=(data.entries||[]).find(x=>x.id===legacy.id);
   if(original)return {...data,entries:(data.entries||[]).map(x=>x.id===original.id?{...x,
    planned_amount_cents:x.planned_amount_cents??x.amount_cents,
    amount_cents:paid,realized_amount_cents:paid,realized_date:actualDate,
    reconciliation_state:paid>0?'confirmed':'not_done',
    status:paid>0?'set_aside':'skipped',goal_reconciliation_month:month}:x)};
  }
  if(!current&&!expected)throw Error('Não existe aporte previsto para este objetivo neste mês.');
  const revised={...data,entries:[...(data.entries||[])]};
  const next={...(current||{}),id:current?.id||id(),title:'Reserva conciliada · '+goal.title,
    entry_type:'reserve',goal_id:goalId,entry_date:actualDate,goal_reconciliation_month:month,
    planned_amount_cents:current?.planned_amount_cents??expected?.amount_cents??0,
    amount_cents:paid,realized_amount_cents:paid,realized_date:actualDate,
    reconciliation_state:paid>0?'confirmed':'not_done',
    status:paid>0?'set_aside':'skipped',frequency:'none',payment_method:'pix',
    category:'Precaução',created_by:current?.created_by||goal.created_by,
    responsible_ids:[...(goal.responsible_ids||[])],visibility:goal.visibility||'shared',
    workspace_id:goal.workspace_id};
  if(current)revised.entries=revised.entries.map(e=>e.id===current.id?next:e);
  else revised.entries.push(next);
  return revised;
 }
 function reconcileEntry(data,id,occurrenceDate,actual,status,actualDate,engine){
  const source=(data.entries||[]).find(e=>e.id===id);
  if(!source)throw Error('Lançamento não encontrado.');
  const kind=source.entry_type;
  if(!['expense','income','reserve'].includes(kind))throw Error('Tipo não conciliável.');
  const value=cents(actual),expectedStatus=finished[kind];
  if(!engine.dateParts(occurrenceDate)||!engine.dateParts(actualDate))throw Error('Data inválida.');
  if(actualDate>new Date().toISOString().slice(0,10))throw Error('Não é possível conciliar uma data futura.');
  if(![expectedStatus,'not_done'].includes(status))throw Error('Situação inválida.');
  const done=status===expectedStatus,finalStatus=done?expectedStatus:'skipped';
  const change={status:finalStatus,realized_amount_cents:done?value:0,
    realized_date:actualDate,reconciliation_state:done?'confirmed':'not_done'};
  const recurrent=source.frequency&&source.frequency!=='none';
  if(recurrent){
    const existing=(data.overrides||[]).find(o=>o.entry_id===id&&o.occurrence_date===occurrenceDate);
    const ov={...(existing||{}),entry_id:id,occurrence_date:occurrenceDate,...change};
    return {...data,overrides:existing?(data.overrides||[]).map(o=>o===existing?ov:o):
      [...(data.overrides||[]),ov]};
  }
  return {...data,entries:(data.entries||[]).map(e=>e.id===id?
    {...e,planned_amount_cents:e.planned_amount_cents??e.amount_cents,...change}:e)};
 }
 scope.AlbusReconciliation={cents,isReconciled,byMonth,goalAlreadyCompleted,reconcileGoal,reconcileEntry,finished};
})(typeof globalThis!=='undefined'?globalThis:this);
