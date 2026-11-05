/* Núcleo determinístico do planejamento Albus, sem dependências externas. */
const AlbusEngine = (function albusEngineFactory() {
  const MS_DAY = 86400000;
  const whole = (n, fallback=0) => Number.isFinite(Number(n)) ? Math.trunc(Number(n)) : fallback;
  const clamp = (n,min,max) => Math.max(min,Math.min(max,whole(n,min)));
  const pad = n => String(n).padStart(2,'0');
  function dateParts(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));
    if (!m) return null;
    const y=+m[1], mo=+m[2], d=+m[3];
    if(mo<1||mo>12||d<1||d>new Date(Date.UTC(y,mo,0)).getUTCDate()) return null;
    return {y,mo,d};
  }
  function daysInMonth(month) {
    const m=/^(\d{4})-(\d{2})$/.exec(month||'');
    if(!m||+m[2]<1||+m[2]>12)throw Error('Mês inválido.');
    return new Date(Date.UTC(+m[1],+m[2],0)).getUTCDate();
  }
  function addMonths(month, delta) {
    const m=/^(\d{4})-(\d{2})$/.exec(month||'');
    if(!m)throw Error('Mês inválido.');
    const d=new Date(Date.UTC(+m[1],+m[2]-1+whole(delta),1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`;
  }
  function shiftDate(date,delta) {
    const p=dateParts(date);
    if(!p)throw Error('Data inválida.');
    const d=new Date(Date.UTC(p.y,p.mo-1,p.d+whole(delta)));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  }
  function dayDistance(a,b) {
    const x=dateParts(a),y=dateParts(b);
    if(!x||!y)throw Error('Data inválida.');
    return Math.round((Date.UTC(y.y,y.mo-1,y.d)-Date.UTC(x.y,x.mo-1,x.d))/MS_DAY);
  }
  const monthOf = date=>String(date||'').slice(0,7);
  function dateInMonth(month,day){return `${month}-${pad(Math.min(daysInMonth(month),Math.max(1,whole(day,1))))}`;}
  function billingDueDate(purchase, settings={}) {
    if(!dateParts(purchase))throw Error('Data da compra inválida.');
    const close=clamp(settings.closingDay??25,1,31), due=clamp(settings.dueDay??5,1,31);
    const m=monthOf(purchase);
    const closingMonth=+purchase.slice(8,10)>Math.min(close,daysInMonth(m))?addMonths(m,1):m;
    // A fatura vence depois de seu fechamento, não no próprio dia.
    const dueMonth=due<=close?addMonths(closingMonth,1):closingMonth;
    return dateInMonth(dueMonth,due);
  }
  function paymentDate(entry,settings={}) {
    if(entry.entry_type!=='expense')return entry.occurrence_date||entry.entry_date;
    const purchase=entry.occurrence_date||entry.entry_date;
    if(entry.payment_date_override&&dateParts(entry.payment_date_override))return entry.payment_date_override;
    if(entry.payment_method==='credit')return billingDueDate(purchase,settings);
    return entry.payment_date&&dateParts(entry.payment_date)?entry.payment_date:purchase;
  }
  function isBrazilFixedHoliday(iso) {
    const mmdd=String(iso).slice(5);
    return new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25']).has(mmdd);
  }
  // Estimativa para datas de pagamento; feriados estaduais e municipais exigem ajuste manual.
  function businessDate(month,ordinal=5,includeSaturday=true,extraHolidays=[]) {
    const end=daysInMonth(month),wanted=Math.max(1,Math.min(25,whole(ordinal,5)));
    let count=0;
    const blocked=new Set(extraHolidays||[]);
    for(let day=1;day<=end;day++){
      const iso=dateInMonth(month,day);
      const dow=new Date(iso+'T12:00:00Z').getUTCDay();
      if(dow===0||(!includeSaturday&&dow===6)||isBrazilFixedHoliday(iso)||blocked.has(iso))continue;
      count++;
      if(count===wanted)return iso;
    }
    return dateInMonth(month,end);
  }
  function occurrenceInMonth(entry,month) {
    if(!dateParts(entry.entry_date))return null;
    if(month<monthOf(entry.entry_date))return null;
    if(entry.recurrence_end_month&&month>entry.recurrence_end_month)return null;
    if(entry.frequency==='monthly')return dateInMonth(month,+entry.entry_date.slice(8,10));
    if(entry.frequency==='business_day_monthly')return businessDate(month,entry.business_day_number||5,entry.include_saturday!==false,entry.extra_holidays);
    return monthOf(entry.entry_date)===month?entry.entry_date:null;
  }
  function expandMonth(entries,overrides,month) {
    const changes=new Map((overrides||[]).map(x=>[`${x.entry_id}|${x.occurrence_date}`,x]));
    return (entries||[]).flatMap(entry=>{
      const date=occurrenceInMonth(entry,month);
      if(!date)return [];
      const o=changes.get(`${entry.id}|${date}`);
      if(o?.deleted)return [];
      const realized=o?.realized_amount_cents??entry.realized_amount_cents;
      const planned=entry.planned_amount_cents??entry.amount_cents;
      return [{...entry,...(o||{}),id:entry.id,entry_date:entry.entry_date,occurrence_date:date,
        planned_amount_cents:planned,
        amount_cents:realized!==undefined?realized:(o?.amount_cents??entry.amount_cents),
        occurrence_id:`${entry.id}|${date}`,is_recurring:['monthly','business_day_monthly'].includes(entry.frequency)}];
    }).sort((a,b)=>a.occurrence_date.localeCompare(b.occurrence_date));
  }
  function occurrencesForMonth(entries,overrides,month,settings={},view='cash') {
    const out=[];
    // Uma ocorrência reagendada pode atravessar meses; manter busca de datas próximas.
    for(let offset=-12;offset<=12;offset++){
      const base=addMonths(month,offset);
      for(const entry of expandMonth(entries,overrides,base)){
        const effectiveOccurrence=entry.moved_to_date&&dateParts(entry.moved_to_date)?entry.moved_to_date:entry.occurrence_date;
        const paidOn=paymentDate({...entry,occurrence_date:effectiveOccurrence},settings);
        const plannedDate=(entry.entry_type==='expense'&&view==='cash')?paidOn:effectiveOccurrence;
        const displayDate=entry.reconciliation_state==='confirmed'&&dateParts(entry.realized_date)
          ?(view==='cash'?entry.realized_date:effectiveOccurrence):plannedDate;
        if(monthOf(displayDate)===month)out.push({...entry,payment_date_effective:paidOn,display_date:displayDate});
      }
    }
    return out.sort((a,b)=>a.display_date.localeCompare(b.display_date)||String(a.title).localeCompare(String(b.title)));
  }
  function monthSummary(entries,overrides,month,settings={}) {
    const cash=occurrencesForMonth(entries,overrides,month,settings,'cash');
    const purchase=occurrencesForMonth(entries,overrides,month,settings,'purchase');
    const expenses=cash.filter(x=>x.entry_type==='expense');
    const income=cash.filter(x=>x.entry_type==='income').reduce((a,x)=>a+whole(x.amount_cents),0);
    const expense=expenses.reduce((a,x)=>a+whole(x.amount_cents),0);
    const reserve=cash.filter(x=>x.entry_type==='reserve').reduce((a,x)=>a+whole(x.amount_cents),0);
    const variable=expenses.filter(x=>x.variable!==false&&x.status!=='paid'&&monthOf(x.occurrence_date)===month).reduce((a,x)=>a+whole(x.amount_cents),0);
    const variation= Math.round(variable*clamp(settings.variationPercent??10,0,100)/100);
    const provision=Math.round(variable*clamp(settings.provisionPercent??10,0,100)/100)+Math.max(0,whole(settings.provisionFixedCents));
    const received=cash.filter(x=>x.entry_type==='income'&&x.status==='received').reduce((a,x)=>a+whole(x.amount_cents),0);
    const paid=expenses.filter(x=>x.status==='paid').reduce((a,x)=>a+whole(x.amount_cents),0);
    const setAside=cash.filter(x=>x.entry_type==='reserve'&&x.status==='set_aside').reduce((a,x)=>a+whole(x.amount_cents),0);
    const cardDue=expenses.filter(x=>x.payment_method==='credit').reduce((a,x)=>a+whole(x.amount_cents),0);
    const previousCard=expenses.filter(x=>x.payment_method==='credit'&&monthOf(x.occurrence_date)<month).reduce((a,x)=>a+whole(x.amount_cents),0);
    const newPurchases=purchase.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+whole(x.amount_cents),0);
    const futureCard=purchase.filter(x=>x.entry_type==='expense'&&x.payment_method==='credit'&&monthOf(x.payment_date_effective)>month).reduce((a,x)=>a+whole(x.amount_cents),0);
    const valueToAssign=income-expense-reserve-provision;
    return {income,expense,reserve,variable,variation,provision,received,paid,setAside,cardDue,previousCard,newPurchases,futureCard,valueToAssign,cash,purchase};
  }
  function moveOccurrence(data,id,sourceDate,toDate,view='purchase') {
    if(!dateParts(sourceDate)||!dateParts(toDate))throw Error('Data inválida.');
    const entry=(data.entries||[]).find(x=>x.id===id);
    if(!entry)throw Error('Lançamento não encontrado.');
    const originals=expandMonth([entry],data.overrides||[],monthOf(sourceDate));
    if(!originals.some(x=>x.occurrence_date===sourceDate))throw Error('Ocorrência recorrente não encontrada.');
    const key=x=>x.entry_id===id&&x.occurrence_date===sourceDate;
    const other=(data.overrides||[]).filter(x=>!key(x));
    const existing=(data.overrides||[]).find(key)||{};
    const override={...existing,entry_id:id,occurrence_date:sourceDate};
    if(view==='cash'&&entry.entry_type==='expense'&&entry.payment_method==='credit'){
      override.payment_date_override=toDate;
      delete override.moved_to_date;
    }else{
      override.moved_to_date=toDate;
      delete override.payment_date_override;
    }
    return {...data,overrides:[...other,override]};
  }
  function moveItem(data,kind,id,toDate) {
    if(!dateParts(toDate))throw Error('Data de destino inválida.');
    const events=[...(data.events||[])],entries=[...(data.entries||[])];
    if(kind==='event'){
      const e=events.find(x=>x.id===id); if(!e)throw Error('Evento não encontrado.');
      const delta=dayDistance(e.date,toDate);
      const linkedIds=new Set(entries.filter(x=>x.event_id===id).map(x=>x.id));
      return {...data,events:events.map(x=>x.id===id?{...x,date:toDate}:x),
        entries:entries.map(x=>x.event_id===id?{...x,entry_date:shiftDate(x.entry_date,delta),
          payment_date:x.payment_date&&dateParts(x.payment_date)?shiftDate(x.payment_date,delta):x.payment_date,
          payment_date_override:x.payment_date_override&&dateParts(x.payment_date_override)?shiftDate(x.payment_date_override,delta):x.payment_date_override}:x),
        overrides:(data.overrides||[]).map(x=>linkedIds.has(x.entry_id)?{...x,
          occurrence_date:x.occurrence_date&&dateParts(x.occurrence_date)?shiftDate(x.occurrence_date,delta):x.occurrence_date,
          moved_to_date:x.moved_to_date&&dateParts(x.moved_to_date)?shiftDate(x.moved_to_date,delta):x.moved_to_date,
          payment_date_override:x.payment_date_override&&dateParts(x.payment_date_override)?shiftDate(x.payment_date_override,delta):x.payment_date_override}:x)};
    }
    if(kind==='entry'){
      if(!entries.some(x=>x.id===id))throw Error('Lançamento não encontrado.');
      return {...data,events,entries:entries.map(x=>x.id===id?{...x,entry_date:toDate}:x)};
    }
    throw Error('Tipo de movimentação inválido.');
  }
  function money(cents) { return (whole(cents)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function parseMoney(raw) {
    let s=String(raw??'').trim().replace(/\s|R\$/g,'');
    if(!s)return 0;
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
    if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Use um valor positivo com até duas casas decimais.');
    const [integer,decimal='']=s.split('.');
    const n=Number(integer)*100+Number((decimal+'00').slice(0,2));
    if(!Number.isSafeInteger(n)||n>99999999999)throw Error('Valor acima do limite.');
    return n;
  }
  return {dateParts,addMonths,shiftDate,dayDistance,monthOf,daysInMonth,dateInMonth,businessDate,isBrazilFixedHoliday,billingDueDate,paymentDate,expandMonth,occurrencesForMonth,monthSummary,moveItem,moveOccurrence,money,parseMoney,clamp};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = AlbusEngine;
