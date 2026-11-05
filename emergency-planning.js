/* Planejamento de objetivos: recomendação da reserva de emergência e aportes mensais
   no fluxo de caixa. Não considera projeções como saldo efetivo. */
(function(scope){
  'use strict';
  const essential=new Set(['Alimentação','Casa','Educação','Moradia','Saúde','Transporte']);
  const VALID_MONTHS=new Set([6,12,18,24]);
  const cents=v=>Math.max(0,Math.round(Number(v)||0));
  const monthOf=x=>String(x||'').slice(0,7);
  // Só sabemos quais meses têm lançamentos, não se a pessoa registrou tudo.
  // Evita chamar um mês de "completo" sem confirmação humana.
  function sampledMonths(engine,entries,overrides,month,kind,basis='all'){
    const result=[];
    const read=m=>engine.occurrencesForMonth(entries,overrides,m,{},kind==='income'?'cash':'purchase')
      .filter(e=>e.entry_type===kind&&(kind!=='expense'||basis!=='essential'||essential.has(e.category)))
      .reduce((sum,e)=>sum+cents(e.amount_cents),0);
    for(let n=1;n<=6&&result.length<3;n++){
      const m=engine.addMonths(month,-n),value=read(m);
      if(value>0)result.push({month:m,cents:value});
    }
    if(result.length)return {items:result,partial:false};
    const now=read(month);
    return {items:now>0?[{month,cents:now}]:[],partial:now>0};
  }
  function estimate(engine,entries,overrides,month,kind,basis='all',conservative=false){
    const sample=sampledMonths(engine,entries,overrides,month,kind,basis);
    const values=sample.items.map(x=>x.cents),n=values.length;
    if(!n)return {cents:0,months:0,samples:[],partial:false,source:'sem histórico',method:'manual'};
    const mean=values.reduce((a,b)=>a+b,0)/n;
    // Com 2–3 meses, 70% da média e 30% do maior mês.
    // Com apenas 1 mês, usamos exatamente esse mês; nunca o inflamos.
    const weighted=conservative&&n>1?Math.round(mean*.7+Math.max(...values)*.3):Math.round(mean);
    const source=sample.partial?'mês atual com lançamentos (pode estar incompleto)':
      n===1?'1 mês com lançamentos':n+' meses com lançamentos';
    const method=conservative&&n>1?'70% da média + 30% do maior mês':'média simples';
    return {cents:weighted,months:n,samples:sample.items,partial:sample.partial,source,method};
  }
  function recommendedCost(engine,entries,overrides,month,basis='essential'){
    return estimate(engine,entries,overrides,month,'expense',basis,true);
  }
  function recommendedIncome(engine,entries,overrides,month){
    return estimate(engine,entries,overrides,month,'income','all',false);
  }
  function contributionCapacity(engine,entries,overrides,month,goalId=null,settings={}){
    const income=recommendedIncome(engine,entries,overrides,month);
    const outflow=recommendedCost(engine,entries,overrides,month,'all');
    const current=engine.monthSummary(entries,overrides,month,settings);
    const goalReserve=current.cash.filter(x=>x.entry_type==='reserve'&&x.goal_id===goalId)
      .reduce((sum,x)=>sum+cents(x.amount_cents),0);
    const otherReserves=Math.max(0,current.reserve-goalReserve);
    if(!income.months||!outflow.months)return {
      cents:null,income,outflow,otherReserves,provision:current.provision,
      source:'Histórico insuficiente para sugerir um aporte mensal'
    };
    return {cents:Math.max(0,income.cents-outflow.cents-otherReserves-current.provision),
      income,outflow,otherReserves,provision:current.provision,
      source:'Margem estimada antes do aporte desta reserva; não é saldo garantido'};
  }
  function suggestedContributionDate(engine,entries,overrides,month){
    const income=engine.occurrencesForMonth(entries,overrides,month,{},'cash')
      .filter(x=>x.entry_type==='income'&&x.amount_cents>0)
      .sort((a,b)=>b.amount_cents-a.amount_cents||a.display_date.localeCompare(b.display_date))[0];
    // Um dia após a principal entrada prevista. O usuário pode alterar livremente.
    return income?engine.shiftDate(income.display_date,1):null;
  }
  function emergencyTarget(cost,months){
    if(!VALID_MONTHS.has(Number(months)))throw Error('Escolha 6, 12, 18 ou 24 meses.');
    const amount=cents(cost)*Number(months);
    if(!Number.isSafeInteger(amount)||amount>99999999999)throw Error('Meta acima do limite permitido.');
    return amount;
  }
  function isEmergency(goal){return goal?.goal_type==='emergency'||(!goal?.goal_type&&String(goal?.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()==='reserva de emergencia');}
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
  scope.AlbusEmergency={essential,VALID_MONTHS,recommendedCost,recommendedIncome,contributionCapacity,sampledMonths,suggestedContributionDate,emergencyTarget,isEmergency,scheduledItems,scheduledForMonth,syncSchedule,milestone};
})(typeof globalThis!=='undefined'?globalThis:this);
