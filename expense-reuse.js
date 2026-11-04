/* Ações não destrutivas para reutilizar despesas do Albus.
 * Uma cópia tem novo ID e corresponde a uma nova saída financeira.
 * A despesa de origem não sofre alteração. */
(function(scope){
  'use strict';
  const validISO=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
  function getExpense(data,entryId){
    const entry=(data.entries||[]).find(x=>x.id===entryId);
    if(!entry||entry.entry_type!=='expense')throw Error('Despesa não encontrada.');
    return entry;
  }
  function findOccurrence(data,entry,occurrenceDate){
    if(!occurrenceDate||entry.frequency==='none'||!entry.frequency)return entry;
    const overridden=(data.overrides||[]).find(x=>x.entry_id===entry.id&&x.occurrence_date===occurrenceDate&&!x.deleted);
    if(!overridden)return entry;
    return {...entry,...overridden};
  }
  function copy(data,entryId,opts){
    const source=getExpense(data,entryId);
    const selected=findOccurrence(data,source,opts.occurrenceDate);
    const targetEvent=opts.eventId?(data.events||[]).find(x=>x.id===opts.eventId):null;
    if(opts.eventId&&!targetEvent)throw Error('Evento de destino não encontrado.');
    const targetDate=targetEvent?targetEvent.date:opts.date;
    if(!validISO(targetDate))throw Error('Escolha uma data válida para a cópia.');
    if(!opts.newId|| (data.entries||[]).some(x=>x.id===opts.newId))throw Error('Identificador da cópia inválido ou duplicado.');
    // Remova datas auxiliares do pagamento anterior: o cartão da nova compra
    // precisa ser recalculado a partir da nova data.
    const copied={...selected,
      id:opts.newId,entry_date:targetDate,event_id:targetEvent?.id||null,
      frequency:'none',status:'planned',
      copied_from_id:source.id,copied_from_occurrence:opts.occurrenceDate||source.entry_date,
      created_by:opts.currentUser||source.created_by,
      responsible_ids:targetEvent?[...(targetEvent.responsible_ids||[])]:[...(source.responsible_ids||[])],
      visibility:targetEvent?.visibility||source.visibility||'shared'
    };
    for(const key of ['payment_date','payment_date_override','payment_date_effective','occurrence_date',
      'occurrence_id','display_date','moved_to_date','is_recurring','entry_id','deleted',
      'business_day_number','include_saturday','extra_holidays'])delete copied[key];
    return {...data,entries:[...(data.entries||[]),copied]};
  }
  function detach(data,entryId){
    const source=getExpense(data,entryId);
    if(!source.event_id)return data;
    return {...data,entries:(data.entries||[]).map(x=>x.id===entryId?{...x,event_id:null}:x)};
  }
  scope.AlbusExpenseReuse={copy,detach,getExpense};
})(typeof globalThis!=='undefined'?globalThis:this);
