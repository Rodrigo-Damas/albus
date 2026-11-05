/* Albus — orçamento único e fila de objetivos com prioridade.
   Não altera os lançamentos originais: as previsões são virtuais até confirmação.
   Os dados existentes e a chave localStorage permanecem inalterados. */
(function(scope){
 'use strict';
 const money=v=>Math.max(0,Math.round(Number(v)||0));
 const active=()=>true; // Ordem e limite são sempre aplicados, sem ativação do usuário.
 const isEmergency=g=>g?.goal_type==='emergency'||(!g?.goal_type&&String(g?.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='reserva de emergencia');
 function ordered(goals){
  return (goals||[]).map((goal,index)=>({goal,index})).sort((a,b)=>{
   if(isEmergency(a.goal)!==isEmergency(b.goal))return isEmergency(a.goal)?-1:1;
   const aa=Number.isFinite(Number(a.goal.priority_index))?Number(a.goal.priority_index):a.index;
   const bb=Number.isFinite(Number(b.goal.priority_index))?Number(b.goal.priority_index):b.index;
   return aa-bb||a.index-b.index;
  }).map(item=>item.goal);
 }
 function baseEntries(db){return (db.entries||[]).filter(x=>!x.auto_scheduled);}
 function confirmedLegacy(db,month,engine,settings){
  const prior=(db.entries||[]).filter(x=>x.auto_scheduled);
  return engine.occurrencesForMonth(prior,db.overrides||[],month,settings||{},'cash')
   .filter(x=>x.status==='set_aside'&&x.entry_type==='reserve');
 }
 function suggestedLimit(db,engine,emergency,month,settings){
  const income=emergency.recommendedIncome(engine,baseEntries(db),db.overrides||[],month);
  const fallback=(db.goals||[]).find(isEmergency)?.income_reference_cents||0;
  const usedIncome=income.cents>0?income.cents:money(fallback);
  const suggested=usedIncome>0?Math.round(usedIncome*.20):null;
  return {cents:suggested,available:suggested!==null,
   income:{...income,cents:usedIncome},
   outflow:null,otherReserves:0,provision:0,percent:20,
   source:income.cents>0?'20% da receita mensal estimada por lançamentos':
     fallback>0?'20% da receita de referência informada na reserva de emergência':'Sem receita cadastrada'};
 }
 function budget(db,engine,emergency,month){
  const s=db.settings||{},suggestion=suggestedLimit(db,engine,emergency,month,s);
  const manual=Number.isSafeInteger(s.goal_budget_limit_cents)&&s.goal_budget_limit_cents>=0;
  return {cents:manual?s.goal_budget_limit_cents:(suggestion.cents??0),
   manual,configured:manual||suggestion.available,suggestion};
 }
 function monthlyCommitted(db,engine,month){
  const s=db.settings||{};
  const actual=engine.occurrencesForMonth(baseEntries(db),db.overrides||[],month,s,'cash')
    .filter(x=>x.entry_type==='reserve');
  const confirmed=confirmedLegacy(db,month,engine,s);
  const byGoal=new Map();
  for(const entry of [...actual,...confirmed]){
    if(entry.goal_id)byGoal.set(entry.goal_id,(byGoal.get(entry.goal_id)||0)+money(entry.amount_cents));
  }
  return {total:[...actual,...confirmed].reduce((total,x)=>total+money(x.amount_cents),0),byGoal};
 }
 function fixedContributions(db,engine,month){
  return monthlyCommitted(db,engine,month).total;
 }
 function monthIndex(engine,start,other){
  // No máximo 360 meses, suficiente para o horizonte de projeção.
  for(let i=0;i<=360;i++)if(engine.addMonths(start,i)===other)return i;
  return -1;
 }
 function simulate(db,engine,goalsApi,emergency,month,rate=null,horizon=240){
  const now=month;
  const queue=ordered(db.goals||[]);
  const cap=budget(db,engine,emergency,now);
  const balances=new Map(queue.map(g=>[g.id,goalsApi.realBalance(g,db.entries||[],db.overrides||[])]));
  const results=new Map(),estimates=new Map();
  for(const goal of queue){
   if((balances.get(goal.id)||0)>=money(goal.target_cents))estimates.set(goal.id,{month:now,completed:true,actual:balances.get(goal.id)});
  }
  let stopped=false;
  for(let step=0;step<Math.min(horizon,360);step++){
   const m=engine.addMonths(now,step);
   if(step>0){for(const goal of queue){
    const current=balances.get(goal.id)||0;
    if(current<money(goal.target_cents)){
     const yearly=Number(rate?.annualPercent??goal.manual_cdi_annual??0);
     const factor=goalsApi.projectedRate(yearly,goal.cdi_percent??100);
     balances.set(goal.id,Math.round(current*(1+factor)));
    }
   }}
   const committed=monthlyCommitted(db,engine,m);
   let remaining=Math.max(0,cap.cents-committed.total);
   let amountAllocated=0;
   let lastAllocatedDay=1;
   const monthAlloc=[];
   for(const goal of queue){
    const current=balances.get(goal.id)||0,desired=money(goal.target_cents),gap=Math.max(0,desired-current);
    if(!gap){if(!estimates.has(goal.id))estimates.set(goal.id,{month:m,completed:step===0,actual:current});continue;}
    const eligible=goal.schedule_enabled!==false,monthly=money(goal.monthly_cents);
    // Prioridade define quem recebe primeiro; o teto individual libera o restante.
    if(!eligible||monthly<=0||remaining<=0)continue;
    const desiredRemaining=Math.max(0,monthly-(committed.byGoal.get(goal.id)||0));
    const amount=Math.min(remaining,gap,desiredRemaining);
    if(amount>0){
     const dueDay=Number(String(goal.contribution_date||now+'-01').slice(-2))||1;
     const date=engine.dateInMonth(m,Math.max(dueDay,lastAllocatedDay));
     monthAlloc.push({goal_id:goal.id,goal_title:goal.title,date,month:m,amount_cents:amount,
      priority:queue.findIndex(x=>x.id===goal.id)+1});
     balances.set(goal.id,current+amount);
     lastAllocatedDay=Number(date.slice(-2));
     remaining-=amount;amountAllocated+=amount;
    }
    if((balances.get(goal.id)||0)>=desired){
     if(!estimates.has(goal.id))estimates.set(goal.id,{month:m,completed:false,actual:balances.get(goal.id)});
    }
    // Mesmo sem conclusão, o próximo objetivo utiliza a parte do limite não solicitada.
   }
   results.set(m,monthAlloc);
   if(estimates.size===queue.length){stopped=true;break;}
  }
  return {queue,cap,results,estimates,balances,allCompleted:stopped};
 }
 function rowsForMonth(sim,month){
  return (sim.results.get(month)||[]).map(a=>({
    id:'portfolio:'+a.month+':'+a.goal_id,
    entry_type:'reserve',title:'Reserva ou investimento · '+a.goal_title,
    amount_cents:a.amount_cents,entry_date:a.date,occurrence_date:a.date,
    display_date:a.date,payment_date_effective:a.date,status:'planned',
    category:'Precaução',frequency:'none',payment_method:'pix',
    goal_id:a.goal_id,virtual_portfolio:true,priority:a.priority
  }));
 }
 function removeGoal(db,goalId,makeId){
  const goal=(db.goals||[]).find(g=>g.id===goalId);
  if(!goal)throw Error('Objetivo não encontrado.');
  const associated=(db.entries||[]).filter(e=>e.goal_id===goalId);
  const recurrent=associated.filter(e=>e.frequency==='monthly'||e.frequency==='business_day_monthly');
  const recurrentIds=new Set(recurrent.map(e=>e.id));
  const preserved=(db.overrides||[]).filter(o=>recurrentIds.has(o.entry_id)&&o.status==='set_aside'&&!o.deleted)
    .map(o=>{
      const original=recurrent.find(e=>e.id===o.entry_id);
      const newId=makeId();
      const amount=money(o.amount_cents??original.amount_cents);
      return {...original,id:newId,entry_type:'reserve',entry_date:o.moved_to_date||o.occurrence_date,
        status:'set_aside',frequency:'none',auto_scheduled:false,goal_id:null,amount_cents:amount,
        title:'Aporte histórico · '+goal.title};
    });
  const retained=(db.entries||[]).filter(e=>!recurrentIds.has(e.id))
    .map(e=>e.goal_id===goalId?{...e,goal_id:null,auto_scheduled:false}:e);
  const overrides=(db.overrides||[]).filter(o=>!recurrentIds.has(o.entry_id));
  return {data:{...db,entries:[...retained,...preserved],overrides,
    goals:(db.goals||[]).filter(g=>g.id!==goalId)},
    archived:preserved.length,cancelled:recurrent.length,unlinked:associated.length-recurrent.length};
 }
 function reorder(goals,moved,target){
  const sorted=ordered(goals);
  const emergencyGoal=sorted.find(isEmergency);
  if(emergencyGoal?.id===moved)return goals;
  const from=sorted.findIndex(g=>g.id===moved),to=sorted.findIndex(g=>g.id===target);
  if(from<0||to<0||from===to)return goals;
  const copy=sorted.slice(),[item]=copy.splice(from,1);
  copy.splice(to,0,item);
  if(emergencyGoal&&copy[0].id!==emergencyGoal.id){
   const idx=copy.findIndex(g=>g.id===emergencyGoal.id);copy.splice(idx,1);copy.unshift(emergencyGoal);
  }
  const priorities=new Map(copy.map((g,i)=>[g.id,i]));
  return goals.map(g=>({...g,priority_index:priorities.get(g.id)}));
 }
 scope.AlbusPriorities={active,ordered,baseEntries,confirmedLegacy,suggestedLimit,budget,fixedContributions,
   simulate,rowsForMonth,reorder,removeGoal,monthlyCommitted,isEmergency,monthIndex};
})(typeof globalThis!=='undefined'?globalThis:this);
