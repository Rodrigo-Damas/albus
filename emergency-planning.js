/* Planejamento de objetivos: recomendação da reserva de emergência e aportes mensais
   no fluxo de caixa. Não considera projeções como saldo efetivo. */
(function(scope){
  'use strict';
  const essential=new Set(['Alimentação','Casa','Educação','Moradia','Saúde','Transporte']);
  const VALID_MONTHS=new Set([6,12,18,24]);
  const cents=v=>Math.max(0,Math.round(Number(v)||0));
  const monthOf=x=>String(x||'').slice(0,7);
  function recommendedCost(engine,entries,overrides,month,basis='essential'){
    const completed=[1,2,3].map(n=>engine.addMonths(month,-n));
    const read=m=>engine.occurrencesForMonth(entries,overrides,m,{},'purchase')
      .filter(e=>e.entry_type==='expense'&&(basis!=='essential'||essential.has(e.category)))
      .reduce((s,e)=>s+cents(e.amount_cents),0);
    const previous=completed.map(read);
    const positive=previous.filter(x=>x>0);
    if(positive.length)return {cents:Math.round(positive.reduce((a,b)=>a+b,0)/positive.length),months:positive.length,source:'meses completos'};
    const current=read(month);
    return {cents:current,months:current>0?1:0,source:current>0?'mês atual (parcial)':'sem histórico'};
  }
  function emergencyTarget(cost,months){
    if(!VALID_MONTHS.has(Number(months)))throw Error('Escolha 6, 12, 18 ou 24 meses.');
    const amount=cents(cost)*Number(months);
    if(!Number.isSafeInteger(amount)||amount>99999999999)throw Error('Meta acima do limite permitido.');
    return amount;
  }
  function isEmergency(goal){return goal?.goal_type==='emergency';}
  function scheduledItems(db,goalId){return (db.entries||[]).filter(e=>e.goal_id===goalId&&e.auto_scheduled===true&&e.frequency==='monthly');}
  function monthBefore(engine,month){return engine.addMonths(month,-1);}
  function scheduledForMonth(engine,entry,month){
    if(entry.frequency!=='monthly'||!entry.entry_date||monthOf(entry.entry_date)>month)return false;
    if(entry.recurrence_end_month&&month>entry.recurrence_end_month)return false;
    return true;
  }
  function syncSchedule(db,goal,engine,now,createId){
    const all=scheduledItems(db,goal.id);
    const nowMonth=monthOf(now),date=goal.contribution_date,monthly=cents(goal.monthly_cents);
    const scheduled=goal.schedule_enabled!==false&&monthly>0&&engine.dateParts(date);
    const active=all.find(x=>!x.recurrence_end_month||x.recurrence_end_month>=nowMonth);
    // Objetivos do MVP anterior podem já conter um aporte mensal cadastrado.
    // Não iniciar outra série automaticamente nesse caso.
    const legacyRecurring=(db.entries||[]).find(x=>x.goal_id===goal.id&&x.entry_type==='reserve'&&x.frequency==='monthly'&&!x.auto_scheduled&&(!x.recurrence_end_month||x.recurrence_end_month>=nowMonth));
    if(legacyRecurring&&scheduled&&!active)return db;
    if(scheduled&&active&&active.amount_cents===monthly&&active.entry_date.slice(-2)===date.slice(-2)&&
       active.title==='Reserva ou investimento · '+goal.title&&active.visibility===goal.visibility&&
       JSON.stringify(active.responsible_ids||[])===JSON.stringify(goal.responsible_ids||[]))
      return db;
    const changed={...db,entries:(db.entries||[]).map(x=>{
      if(!all.some(e=>e.id===x.id))return x;
      if(x.recurrence_end_month&&x.recurrence_end_month<nowMonth)return x;
      // Preserve a ocorrência deste mês e qualquer confirmação já feita.
      return {...x,recurrence_end_month:nowMonth};
    })};
    if(!scheduled)return changed;
    // Na edição de um plano existente, começa no mês seguinte; lançamentos deste
    // mês e as confirmações anteriores nunca são substituídos.
    const startMonth=active?engine.addMonths(nowMonth,1):monthOf(date);
    const first=engine.dateInMonth(startMonth,Number(date.slice(-2)));
    if(goal.target_cents>0&&cents(goal.initial_cents)>=goal.target_cents)return changed;
    const entry={id:createId(),entry_type:'reserve',title:'Reserva ou investimento · '+goal.title,
      goal_id:goal.id,auto_scheduled:true,entry_date:first,amount_cents:monthly,
      frequency:'monthly',status:'planned',category:'Precaução',payment_method:'pix',
      visibility:goal.visibility||'shared',responsible_ids:[...(goal.responsible_ids||[])],
      created_by:goal.created_by,workspace_id:goal.workspace_id};
    changed.entries.push(entry);
    return changed;
  }
  function milestone(goal,forecast,engine){
    if(!forecast||forecast.progress>=100||!forecast.estimatedMonth)return null;
    const day=engine.dateParts(goal.contribution_date)?Number(goal.contribution_date.slice(-2)):1;
    return engine.dateInMonth(forecast.estimatedMonth,day);
  }
  scope.AlbusEmergency={essential,VALID_MONTHS,recommendedCost,emergencyTarget,isEmergency,scheduledItems,scheduledForMonth,syncSchedule,milestone};
})(typeof globalThis!=='undefined'?globalThis:this);
