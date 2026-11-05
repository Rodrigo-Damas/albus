/* Metas com saldo real separado da projeção. */
(function(scope){
  const money=n=>Math.max(0,Math.round(Number(n)||0));
  function projectedRate(annualPercent,percentOfCDI=100){
    const annual=Math.max(0,Number(annualPercent)||0)/100;
    const multiplier=Math.max(0,Number(percentOfCDI)||0)/100;
    // É uma aproximação para simulação, não rendimento real creditado.
    return Math.pow(1+annual, multiplier/12)-1;
  }
  function realBalance(goal,entries,overrides=[]){
    const start=money(goal.initial_cents);
    const postings=(entries||[]).filter(e=>e.entry_type==='reserve'&&e.goal_id===goal.id&&e.status==='set_aside');
    const valid=new Map((entries||[]).filter(e=>e.entry_type==='reserve'&&e.goal_id===goal.id&&e.frequency!=='none').map(e=>[e.id,e]));
    const recurring=(overrides||[]).filter(o=>!o.deleted&&o.status==='set_aside'&&valid.has(o.entry_id));
    const confirmed=postings.filter(e=>e.frequency==='none').reduce((acc,e)=>acc+money(e.amount_cents),0);
    const adjustment=Number.isSafeInteger(Number(goal.balance_adjustment_cents))?Number(goal.balance_adjustment_cents):0;
    return Math.max(0,start+adjustment+confirmed+recurring.reduce((acc,o)=>acc+money(o.amount_cents??valid.get(o.entry_id).amount_cents),0));
  }
  // Ajustar o saldo informado sem somar novamente aportes que já faziam parte dele.
  // O ajuste assinado é mantido à parte do saldo inicial legado e das contribuições.
  function withCurrentBalance(goal,desired,entries,overrides=[]){
    const requested=money(desired);
    if(!Number.isSafeInteger(requested))throw Error('Saldo atual inválido.');
    if(!goal.id)return {...goal,initial_cents:requested,balance_adjustment_cents:0};
    const before=realBalance(goal,entries,overrides);
    const previous=Number.isSafeInteger(Number(goal.balance_adjustment_cents))?Number(goal.balance_adjustment_cents):0;
    return {...goal,balance_adjustment_cents:previous+(requested-before)};
  }
  function forecast(goal,entries,rate,asOfMonth,overrides=[]){
    const actual=realBalance(goal,entries,overrides),target=money(goal.target_cents),monthly=money(goal.monthly_cents);
    const annual=Number(rate?.annualPercent ?? goal.manual_cdi_annual ?? 0);
    const factor=projectedRate(annual,goal.cdi_percent??100);
    let months=0,balance=actual;
    const forecastMonth=n=>{
      const [y,m]=String(asOfMonth||'2026-11').split('-').map(Number);
      const d=new Date(Date.UTC(y,m-1+n,1));
      return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    };
    while(balance<target&&months<600){
      months++;
      balance=Math.round(balance*(1+factor))+monthly;
      if(monthly===0&&factor===0)break;
    }
    return {actual,target,monthly,progress:target>0?Math.min(100,100*actual/target):0,
      annual,monthsToGoal:balance>=target?months:null,estimatedMonth:balance>=target?forecastMonth(months):null,
      futureBalance:balance,monthlyRate:factor};
  }
  function ensureGoal(raw){
    return {...raw,initial_cents:money(raw.initial_cents),
      balance_adjustment_cents:Number.isSafeInteger(Number(raw.balance_adjustment_cents))?Number(raw.balance_adjustment_cents):0,
      target_cents:money(raw.target_cents),
      monthly_cents:money(raw.monthly_cents),cdi_percent:Number(raw.cdi_percent??100)||100,
      created_by:raw.created_by||'legacy',visibility:raw.visibility==='private'?'private':'shared',
      responsible_ids:Array.isArray(raw.responsible_ids)?raw.responsible_ids:[]};
  }
  function cdiAnnualFromDaily(dailyPercent){return (Math.pow(1+(Number(dailyPercent)||0)/100,252)-1)*100;}
  const CACHE_KEY='albus-cdi-cache-v1';
  async function getDailyCDI(){
    let cache=null;
    try{cache=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');}catch{}
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    if(cache?.checkedOn===today&&Number.isFinite(cache.annualPercent))return cache;
    try{
      const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json',{signal:AbortSignal.timeout(7000),headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('Banco Central indisponível');
      const values=await response.json();
      const latest=Array.isArray(values)?values[0]:null;
      const value=Number(String(latest?.valor||'').replace(',','.'));
      if(!Number.isFinite(value)||value<=0||value>1)throw Error('Taxa diária inválida');
      const result={annualPercent:cdiAnnualFromDaily(value),dailyPercent:value,rateDate:String(latest.data||''),checkedOn:today,source:'BCB SGS 12'};
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(result));}catch{}
      return result;
    }catch(error){
      return cache&&Number.isFinite(cache.annualPercent)?{...cache,stale:true,error:String(error)}:null;
    }
  }
  scope.AlbusGoals={money,projectedRate,realBalance,withCurrentBalance,forecast,ensureGoal,cdiAnnualFromDaily,getDailyCDI};
})(typeof globalThis!=='undefined'?globalThis:this);
