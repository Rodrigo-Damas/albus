
(function(){
'use strict';
const E=AlbusEngine,A=AlbusAccess,G=AlbusGoals,M=AlbusMoneyMask,B=AlbusBackup,R=AlbusExpenseReuse,H=AlbusEmergency,P=AlbusPriorities;
const KEY='albus-calendar-local-v1',root=document.getElementById('app');
const TYPES={event:'Evento',expense:'Despesa',income:'Receita',goal:'Objetivo',task:'Tarefa',reserve:'Reserva ou investimento'};
const CATEGORIES=['Salário','Alimentação','Transporte','Saúde','Moradia','Lazer','Educação','Casa','Pessoal','Outros','Precaução'];
const SUGGESTIONS={'Salário':['Salário Rodrigo','Salário Danielle','Salário de'],'Transporte':['Transporte para','Transporte de','Uber para'],'Saúde':['Consulta de','Exame de','Medicamento de'],'Moradia':['Aluguel','Condomínio','Energia','Internet'],'Alimentação':['Supermercado','Restaurante'],'Lazer':['Viagem para','Passeio de']};
const MEMBER=A.DEFAULT_MEMBERS,defaults={profile:'same',view:'cash',closingDay:25,dueDay:5,cardConfigured:false,variationPercent:10,provisionPercent:10,provisionFixedCents:0};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const id=()=>crypto?.randomUUID?.()||('albus-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const today=()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const options=(items,v)=>items.map(([id,text])=>'<option value="'+esc(id)+'" '+(String(id)===String(v)?'selected':'')+'>'+esc(text)+'</option>').join('');
const mny=n=>E.money(n||0);
const moneyInput=(name,cents,more='')=>'<input name="'+name+'" data-money="true" inputmode="numeric" autocomplete="off" '+more+' value="'+esc(M.fromCents(cents||0))+'"/>';
const fmt=d=>E.dateParts(d)?d.split('-').reverse().join('/'):'';
const monthTitle=m=>{const [y,mo]=m.split('-').map(Number);let text=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,mo-1,1));return text[0].toUpperCase()+text.slice(1)};
function load(){
 let v={};try{v=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 return {...v,entries:(Array.isArray(v.entries)?v.entries:[]).filter(x=>E.dateParts(x.entry_date)).map(x=>A.normalizeItem(x)),
 events:(Array.isArray(v.events)?v.events:[]).filter(x=>E.dateParts(x.date)).map(x=>A.normalizeItem(x)),
 goals:(Array.isArray(v.goals)?v.goals:[]).filter(x=>x.id).map(x=>A.normalizeItem(G.ensureGoal(x))),
 overrides:Array.isArray(v.overrides)?v.overrides:[],settings:{...defaults,...v.settings}};
}
B.ensureSnapshot(localStorage);
const db=load(),state={user:'rodrigo',filter:'all',month:E.monthOf(today()),day:today(),modal:null,eventSession:null,createOpen:false,cdi:null,message:'',error:''};
const safe=()=>{try{B.save(localStorage,db);return true}catch(e){state.error='Não foi possível salvar no armazenamento local. Exporte um backup e verifique o espaço disponível.';return false}};
const visible=items=>A.visibleItems(items,state.user,state.filter);
const entries=()=>visible(db.entries), events=()=>visible(db.events),goals=()=>visible(db.goals);
let planCache=null;
function plan(){
 if(!P.active(db.settings))return null;
 return planCache||(planCache=P.simulate(db,E,G,H,E.monthOf(today()),state.cdi));
}
function cashRows(month=state.month,view=db.settings.view){
 if(!P.active(db.settings))return E.occurrencesForMonth(entries(),db.overrides,month,db.settings,view);
 const kept=entries().filter(x=>!x.auto_scheduled);
 const confirmed=P.confirmedLegacy(db,month,E,db.settings)
  .filter(x=>A.visibleItems([x],state.user,state.filter).length);
 const virtual=month>=E.monthOf(today())?P.rowsForMonth(plan(),month)
  .filter(x=>goals().some(g=>g.id===x.goal_id)):[];
 return [...E.occurrencesForMonth(kept,db.overrides,month,db.settings,view),...confirmed,...virtual]
 .sort((a,b)=>a.display_date.localeCompare(b.display_date));
}
const monthlyRows=(month=state.month,view=db.settings.view)=>cashRows(month,view);
function summary(){
 if(!P.active(db.settings))return E.monthSummary(entries(),db.overrides,state.month,db.settings);
 const regular=E.monthSummary(entries().filter(x=>!x.auto_scheduled),db.overrides,state.month,db.settings);
 const bonus=cashRows(state.month,'cash').filter(x=>x.virtual_portfolio||x.auto_scheduled&&x.status==='set_aside');
 const extra=bonus.reduce((sum,x)=>sum+Number(x.amount_cents||0),0);
 return {...regular,reserve:regular.reserve+extra,valueToAssign:regular.valueToAssign-extra,
  cash:[...regular.cash,...bonus],setAside:regular.setAside+bonus.filter(x=>x.status==='set_aside').reduce((sum,x)=>sum+x.amount_cents,0)};
}
function button(label,action,more='',klass='outline-button'){return '<button type="button" class="'+klass+'" data-action="'+action+'" '+more+'>'+label+'</button>'}
function modal(title,content){return '<div class="albus-modal-backdrop"><section class="albus-modal" role="dialog" aria-modal="true"><div class="modal-header"><h2>'+esc(title)+'</h2>'+button('×','close','aria-label="Fechar"','close-btn')+'</div>'+content+'</section></div>'}
function ownerInputs(item){
 const selected=A.normalizedIds(item?.responsible_ids||MEMBER.map(x=>x.id));
 const visibility=item?.visibility||'shared';
 return '<div class="albus-owner-fields"><label>Quem participa?</label><div class="albus-member-options">'+
 MEMBER.map(x=>'<label class="albus-member-choice"><input type="checkbox" name="responsible_ids" value="'+x.id+'" '+(selected.includes(x.id)?'checked':'')+'/> '+esc(x.name)+'</label>').join('')+
 '</div><label class="albus-select-all"><input type="checkbox" id="all-members" '+(selected.length===MEMBER.length?'checked':'')+'/> Selecionar todos</label><div class="field"><label>Quem pode visualizar?</label><select id="visibility" name="visibility">'+options([['shared','Todos no espaço familiar'],['private','Somente quem criou']],visibility)+'</select></div></div>';
}
function owners(form,old){
 const user=old?.created_by&&old.created_by!=='legacy'?old.created_by:state.user;
 return {...A.validateOwnership({creatorId:user,responsibleIds:form.getAll('responsible_ids').map(String),visibility:String(form.get('visibility')||'shared')}),created_by:user,workspace_id:A.WORKSPACE_ID};
}
function createMenu(){
 return '<div class="albus-create-anchor">'+button('+ Criar ▾','toggle-create','aria-expanded="'+state.createOpen+'"','primary-button albus-create-button')+
 (state.createOpen?'<div class="albus-create-menu">'+
 [['expense','Despesa','Compra, Pix ou cartão'],['income','Receita','Salário ou outra entrada'],['event','Evento','Uma ocasião e seus gastos'],['goal','Objetivo','Caixinha de investimentos'],['task','Tarefa','Um compromisso sem valor financeiro']]
 .map(([type,label,desc])=>'<button data-action="create" data-kind="'+type+'"><strong>'+label+'</strong><small>'+desc+'</small></button>').join('')+'</div>':'')+'</div>';
}
function project(g){
 // Data-base fixa para a previsão; navegar para outro mês não altera o prazo.
 if(P.active(db.settings)){
   const f=G.forecast(g,db.entries,state.cdi,E.monthOf(today()),db.overrides);
   const estimate=plan().estimates.get(g.id);
   return {...f,estimatedMonth:estimate?.month||null,monthsToGoal:estimate?P.monthIndex(E,E.monthOf(today()),estimate.month):null};
 }
 return G.forecast(g,db.entries,state.cdi,E.monthOf(today()),db.overrides);
}
function showGoalCard(g){
 const f=project(g),percent=Math.min(100,Math.max(0,f.progress)),priority=H.isEmergency(g);
 const waiting=P.active(db.settings)&&!plan().results.get(E.monthOf(today()))?.some(x=>x.goal_id===g.id)&&!reachedTarget(g);
 function reachedTarget(goal){return G.realBalance(goal,db.entries,db.overrides)>=goal.target_cents;}
 const reached=percent>=100;
 return '<button class="albus-goal-card'+(priority?' albus-emergency-goal':'')+'" data-action="goal-details" data-id="'+esc(g.id)+'">'+
 '<span class="albus-goal-label">'+(priority?'♧ Reserva de emergência':'◈ '+esc(g.title))+'</span>'+
 '<strong>'+mny(f.actual)+'</strong><span class="albus-goal-hint">de '+mny(f.target)+' · '+Math.round(percent)+'%</span>'+
 '<span class="albus-progress"><span style="width:'+percent+'%"></span></span>'+
 '<small>'+(reached?'Meta alcançada · crie novos objetivos':waiting?'Aguardando objetivo anterior':'Aporte desejado: '+mny(f.monthly)+'/mês')+'</small>'+
 (f.estimatedMonth&&!reached?'<small>Previsão: '+esc(monthTitle(f.estimatedMonth))+'</small>':'')+'</button>';
}
function goalCards(){
 const listed=P.ordered(goals());
 const hasEmergency=db.goals.some(H.isEmergency);
 return '<section class="albus-goals"><div class="albus-goals-head"><div><strong>Objetivos e reservas</strong><span>Arraste para priorizar · Reserva de emergência sempre primeiro</span></div>'+
 button('⚙ Limite mensal','portfolio-settings','','albus-tiny-button')+
 button('+ Nova caixinha','create','data-kind="goal"','albus-tiny-button')+'</div><div class="albus-goals-grid">'+
 (!hasEmergency?'<button type="button" class="albus-goal-placeholder albus-emergency-suggestion" data-action="new-emergency">♧ Comece pela Reserva de emergência · 6, 12, 18 ou 24 meses de despesas</button>':'')+
 listed.map(g=>'<div class="albus-priority-item" data-priority-id="'+esc(g.id)+'">'+showGoalCard(g)+
 (listed.length>1?'<div class="albus-priority-controls">'+
 (H.isEmergency(g)?'<small>Prioridade fixa</small>':
 button('↑','priority-up','data-id="'+esc(g.id)+'" aria-label="Subir objetivo"','albus-tiny-button')+
 button('↓','priority-down','data-id="'+esc(g.id)+'" aria-label="Descer objetivo"','albus-tiny-button')+
 '<span class="albus-goal-handle" title="Arraste para mudar prioridade">⠿</span>')+
 '</div>':'')+'</div>').join('')+
 (!listed.length&&hasEmergency?'<span class="albus-small">Objetivos ocultos pelo filtro de participantes.</span>':'')+
 '</div><div class="albus-cdi-meta">'+(state.cdi?'CDI de referência: '+state.cdi.annualPercent.toFixed(2).replace('.',',')+'% a.a. (estimado), dado '+esc(state.cdi.rateDate||'em cache')+(state.cdi.stale?' · atualização indisponível':''):'CDI automático: aguardando consulta. Você pode informar uma taxa manual.')+
 ' <span>Atualize o saldo com os rendimentos reais do seu banco ou investimento.</span></div>'+
 (listed.some(g=>project(g).progress>=100)?'<div class="albus-success-goal">Meta atingida. Considere criar outro objetivo, como casa própria, carro ou viagem, e revise o valor da reserva periodicamente.</div>':'')+'</section>';
}
function cashSources(rows,month){
 const expenses=rows.filter(x=>x.entry_type==='expense');
 const sum=list=>list.reduce((total,x)=>total+Number(x.amount_cents||0),0);
 return {
  oldCard:sum(expenses.filter(x=>x.payment_method==='credit'&&E.monthOf(x.occurrence_date)<month)),
  currentCard:sum(expenses.filter(x=>x.payment_method==='credit'&&E.monthOf(x.occurrence_date)>=month)),
  immediate:sum(expenses.filter(x=>x.payment_method!=='credit')),
  total:sum(expenses)
 };
}
function cashBreakdown(parts,scope){
 return '<div class="albus-payment-origin" aria-label="Origem dos pagamentos '+esc(scope)+'">'+
 '<div><span>Cartão · compras anteriores</span><strong>'+mny(parts.oldCard)+'</strong></div>'+
 '<div><span>Cartão · compras do mês</span><strong>'+mny(parts.currentCard)+'</strong></div>'+
 '<div><span>Pix, débito e dinheiro</span><strong>'+mny(parts.immediate)+'</strong></div></div>';
}
function dashboardCards(){
 const s=summary(),balance=s.valueToAssign,m=monthTitle(state.month);
 const data=[
 ['Receitas de '+m,s.income,'Entradas previstas','income'],
 ['Pagamentos previstos',s.expense,'Pagos: '+mny(s.paid),'expense'],
 ['Reservas, objetivos e imprevistos',s.reserve+s.provision,'Objetivos: '+mny(s.reserve)+' · Imprevistos: '+mny(s.provision),'reserve'],
 [balance<0?'Déficit a cobrir':balance===0?'Orçamento distribuído':'Valor a destinar',balance,
  balance<0?'Receitas insuficientes para cobrir as saídas previstas':balance===0?'Planejamento equilibrado':'Disponível para distribuir','balance']
 ];
 const paid=cashSources(cashRows(state.month,'cash'),state.month);
 return '<section class="albus-summary albus-compact-summary">'+data.map(x=>'<article class="summary-card '+x[3]+(x[3]==='balance'&&x[1]===0?' zero':'')+(x[3]==='balance'&&x[1]<0?' negative':'')+'"><div class="summary-kicker">'+esc(x[0])+'</div><div class="summary-value">'+mny(x[1])+'</div><div class="summary-meta">'+esc(x[2])+'</div>'+
 (x[3]==='balance'&&x[1]<0?'<div class="albus-deficit-message" role="status">As despesas, reservas e imprevistos previstos superaram as receitas do mês.</div>':'')+'</article>').join('')+'</section>'+
 '<section class="albus-month-origin"><div class="albus-origin-heading"><strong>Origem dos pagamentos em '+esc(m)+'</strong><span>Faturas de compras anteriores vencem agora, sem duplicar o gasto.</span></div>'+
 cashBreakdown(paid,'do mês')+'</section>';
}
let activeHelp=null;
function closeHelp(){
 if(!activeHelp)return;
 activeHelp.button?.setAttribute('aria-expanded','false');
 activeHelp.popup?.remove();
 activeHelp=null;
}
function openHelp(trigger){
 if(activeHelp?.button===trigger){closeHelp();return;}
 closeHelp();
 const popup=document.createElement('div');
 popup.className='albus-help-popover';
 popup.setAttribute('role','tooltip');
 popup.id='albus-filter-info-active';
 popup.textContent=trigger.dataset.help||'';
 document.body.appendChild(popup);
 trigger.setAttribute('aria-expanded','true');
 const bounds=trigger.getBoundingClientRect();
 const vw=window.innerWidth,vh=window.innerHeight;
 const width=Math.min(320,vw-24);
 popup.style.width=width+'px';
 let left=bounds.right+12;
 if(left+width>vw-12)left=bounds.left-width-12;
 popup.style.left=Math.max(12,Math.min(left,vw-width-12))+'px';
 const height=popup.getBoundingClientRect().height;
 popup.style.top=Math.max(12,Math.min(bounds.top,vh-height-12))+'px';
 activeHelp={button:trigger,popup};
}
document.addEventListener?.('pointerdown',ev=>{
 if(activeHelp&&!activeHelp.popup.contains(ev.target)&&!activeHelp.button.contains(ev.target))closeHelp();
});
document.addEventListener?.('keydown',ev=>{if(ev.key==='Escape')closeHelp();});
function filterLabel(id,label,help){
 return '<div class="albus-filter-label"><label for="'+id+'">'+label+'</label>'+
 '<button type="button" class="albus-info-trigger" data-help="'+esc(help)+'" aria-expanded="false" aria-label="Explicação de '+esc(label)+'">i</button></div>';
}
function filters(){
 const s=db.settings;
 return '<aside class="surface albus-filter-panel"><strong>Filtros</strong><div class="albus-filter-field">'+
 filterLabel('owner-filter','Exibir lançamentos','Escolha visualizar todos os lançamentos acessíveis, somente os compartilhados ou aqueles em que Rodrigo ou Danielle participam. Os valores do resumo também acompanham o filtro.')+
 '<select id="owner-filter">'+
 options([['all','Todos acessíveis'],['shared','Compartilhados'],...MEMBER.map(x=>[x.id,'Participa: '+x.name])],state.filter)+
 '</select></div><div class="albus-filter-field">'+
 filterLabel('payment-profile','Como costuma pagar?','Essa opção define apenas a forma de pagamento sugerida em novas despesas. À vista, o pagamento ocorre no mês da compra; no cartão, pode vencer em outro mês conforme fechamento e vencimento configurados. Não altera lançamentos já salvos.')+
 '<select id="payment-profile">'+
 options([['same','No próprio mês'],['credit','Cartão posteriormente']],s.profile)+
 '</select></div><div class="albus-filter-field">'+
 filterLabel('calendar-view','Mostrar despesas por','Por pagamento mostra quando o dinheiro precisa sair, inclusive faturas de compras de meses anteriores. Por compra mostra quando o gasto foi assumido. O resumo financeiro permanece organizado por vencimento.')+
 '<select id="calendar-view">'+
 options([['cash','Pagamento'],['purchase','Compra']],s.view)+
 '</select></div>'+button('⚙ Cartão e imprevistos','settings','','outline-button wide')+
 '<div class="albus-side-tip">Selecione uma data no calendário. No detalhamento à direita, use <b>Criar</b> para registrar seus itens.</div></aside>';
}
function calendar(){
 const [year,month]=state.month.split('-').map(Number),first=new Date(year,month-1,1).getDay(),n=E.daysInMonth(state.month);
 const count=Math.ceil((first+n)/7)*7,rows=monthlyRows(),out=[];
 for(let i=0;i<count;i++){
   const d=i-first+1;if(d<1||d>n){out.push('<div class="albus-day outside"></div>');continue;}
   const date=state.month+'-'+String(d).padStart(2,'0'),dayRows=rows.filter(x=>x.display_date===date);
   const ev=events().filter(x=>x.date===date),inc=dayRows.filter(x=>x.entry_type==='income').reduce((v,x)=>v+Number(x.amount_cents||0),0);
   const exp=dayRows.filter(x=>x.entry_type==='expense').reduce((v,x)=>v+Number(x.amount_cents||0),0);
   const chips=[...ev.map(x=>({kind:'event',id:x.id,title:x.title})),...dayRows.filter(x=>x.entry_type!=='income'&&!x.virtual_portfolio&&(!x.event_id||!ev.some(y=>y.id===x.event_id))).map(x=>({kind:'entry',id:x.id,title:x.title,occurrence:x.occurrence_date}))];
   out.push('<div role="button" tabindex="0" class="albus-day '+(date===state.day?'selected ':'')+(date===today()?'today':'')+'" data-action="day" data-date="'+date+'" data-drop-date="'+date+'"><span class="albus-day-number">'+d+'</span>'+
    (inc?'<span class="albus-money in">+ '+mny(inc)+'</span>':'')+(exp?'<span class="albus-money out">− '+mny(exp)+'</span>':'')+
    chips.slice(0,2).map(x=>'<span class="albus-chip '+x.kind+'" data-drag-kind="'+x.kind+'" data-drag-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence||'')+'" title="Arraste para reagendar">'+esc(x.title)+'</span>').join('')+
    (chips.length>2?'<span class="albus-overflow">+'+(chips.length-2)+' itens</span>':'')+
    dayRows.filter(x=>x.virtual_portfolio).slice(0,1).map(x=>'<span class="albus-chip reserve">◈ '+esc(x.title)+' · '+mny(x.amount_cents)+'</span>').join('')+
 goalMilestones(date)+'</div>');
 }
 return '<article class="surface calendar"><div class="albus-month"><div><h2>'+esc(monthTitle(state.month))+'</h2><div class="albus-small">Selecione o dia. Arraste itens para outra data.</div></div>'+
 '<div class="albus-month-actions">'+button('Hoje','today','','outline-button albus-calendar-today')+button('‹','previous','','icon-button')+button('›','next','','icon-button')+'</div></div>'+
 '<div class="albus-date-grid">'+['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(x=>'<div class="albus-weekday">'+x+'</div>').join('')+out.join('')+
 '</div><div class="albus-calendar-foot"><span>Verde: entradas · Vermelho: pagamentos</span><span>Arraste para reagendar</span></div></article>';
}
function goalMilestones(day){
 const list=goals().filter(g=>{
  const f=project(g);
  const when=f.progress>=100
    ?E.dateInMonth(E.monthOf(today()),Number(g.contribution_date?.slice(-2)||1))
    :H.milestone(g,f,E);
  return when===day;
 });
 return list.map(g=>{
   const achieved=project(g).progress>=100;
   return '<button type="button" class="albus-goal-milestone" data-action="goal-details" data-id="'+esc(g.id)+'" title="'+esc(g.title)+'">'+
   (achieved?'✓ Meta concluída':'✦ Conquista prevista')+'</button>';
 }).join('');
}
function row(x,child=false){
 const due=x.entry_type==='expense'?E.paymentDate(x,db.settings):'',linked=db.events.find(e=>e.id===x.event_id);
 const earlier=x.entry_type==='expense'&&x.payment_method==='credit'&&E.monthOf(x.occurrence_date)<E.monthOf(x.display_date||due);
 const desc=[TYPES[x.entry_type]||'Lançamento',A.responsibleLabel(x),x.visibility==='private'?'Individual':'Família',
 linked?'Evento: '+linked.title:'',x.payment_method==='credit'&&x.entry_type==='expense'?'Compra '+fmt(x.occurrence_date):'',
 earlier?'Compra anterior · paga neste mês':'',
 due&&x.payment_method==='credit'?'Vence '+fmt(due):''].filter(Boolean).join(' · ');
 if(x.virtual_portfolio)return '<div class="albus-row albus-virtual-row"><span class="albus-grip">◈</span>'+
 '<span class="text"><b>'+esc(x.title)+'</b><div class="caption">Aporte previsto · prioridade '+x.priority+' · confirme para registrar no saldo real</div></span>'+
 '<span class="albus-entry-price">'+mny(x.amount_cents)+'</span>'+
 button('Confirmar','confirm-portfolio','data-id="'+esc(x.goal_id)+'" data-date="'+esc(x.entry_date)+'" data-amount="'+x.amount_cents+'"','albus-tiny-button')+'</div>';
 return '<div class="albus-row" data-drag-kind="entry" data-drag-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence_date||x.entry_date)+'"><span class="albus-grip albus-drag-handle" title="Segure e arraste">⠿</span>'+
 '<span class="text"><b>'+esc(x.title)+'</b><div class="caption">'+esc(desc)+'</div></span>'+
 (x.entry_type==='task'?'':'<span class="albus-entry-price '+(x.entry_type==='income'?'in':'')+'">'+mny(x.amount_cents)+'</span>')+
 button('✎','edit-entry','data-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence_date||x.entry_date)+'"','albus-tiny-button ghost')+
 button('↔','move-entry','data-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence_date||x.entry_date)+'"','albus-tiny-button ghost')+
 (x.entry_type==='expense'?button('⧉','reuse-entry','data-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence_date||x.entry_date)+'" title="Reutilizar despesa" aria-label="Reutilizar despesa"','albus-tiny-button ghost'):'')+
 (x.entry_type==='expense'&&x.event_id?button('↗','detach-entry','data-id="'+esc(x.id)+'" title="Desvincular despesa do evento" aria-label="Desvincular despesa"','albus-tiny-button ghost'):'')+'</div>';
}
function details(){
 const day=state.day,ev=events().filter(x=>x.date===day),entriesAt=monthlyRows().filter(x=>x.display_date===day),linked=new Set(ev.map(x=>x.id));
 const daySources=cashSources(cashRows(state.month,'cash').filter(x=>x.display_date===day),state.month);
 const others=entriesAt.filter(x=>!linked.has(x.event_id));
 let eventHTML=ev.map(x=>{
   const children=entries().filter(y=>y.event_id===x.id);
   return '<div class="albus-event" data-drop-event="'+esc(x.id)+'" data-drag-kind="event" data-drag-id="'+esc(x.id)+'"><div class="albus-event-header"><span class="albus-grip albus-drag-handle" title="Segure e arraste">⠿</span><strong class="albus-event-title">'+esc(x.title)+'</strong>'+
   button('✎','edit-event','data-id="'+esc(x.id)+'"','albus-tiny-button ghost')+
   button('↔','move-event','data-id="'+esc(x.id)+'"','albus-tiny-button ghost')+'</div><div class="albus-small">Participantes: '+esc(A.responsibleLabel(x))+'</div>'+
   children.map(y=>row(y,true)).join('')+button('+ Despesa vinculada','add-child','data-id="'+esc(x.id)+'"','albus-tiny-button')+'</div>';
 }).join('');
 return '<aside class="surface details"><div class="albus-detail-heading"><div><div class="details-label">DETALHAMENTO DO DIA</div><h2>'+fmt(day)+'</h2></div></div>'+
 '<div class="day-overview"><div class="overview-card"><span class="small-label">Entradas</span><strong class="positive">'+mny(entriesAt.filter(x=>x.entry_type==='income').reduce((a,x)=>a+Number(x.amount_cents||0),0))+'</strong></div>'+
 '<div class="overview-card"><span class="small-label">Saídas</span><strong class="negative">'+mny(entriesAt.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount_cents||0),0))+'</strong></div></div>'+
 '<div class="albus-day-origin"><strong>Composição dos pagamentos do dia</strong>'+cashBreakdown(daySources,'do dia')+'</div>'+
 '<div class="albus-details-create">'+createMenu()+'</div>'+
 '<div class="albus-detail-section"><h3>Eventos · '+ev.length+'</h3>'+(eventHTML||'<div class="albus-details-empty">Nenhum evento neste dia.</div>')+'</div>'+
 '<div class="albus-detail-section"><h3>Lançamentos · '+others.length+'</h3>'+(others.map(x=>row(x)).join('')||'<div class="albus-details-empty">Nenhum lançamento neste dia.</div>')+'</div>'+
 '<p class="albus-help">Arraste uma despesa vinculada para um dia para copiar como independente, ou solte sobre outro evento para criar uma cópia vinculada. Original preservado. Use ⧉ para reutilizar e ↗ para desvincular.</p></aside>';
}
function entryForm(m){
 const old=db.entries.find(x=>x.id===m.id),kind=old?.entry_type||m.kind||'expense',date=old?.entry_date||m.date||state.day;
 const pm=old?.payment_method||(db.settings.profile==='credit'?'credit':'pix');
 return modal(old?'Editar lançamento':'Criar '+(TYPES[kind]||'lançamento'),
 '<form id="entry-form"><div class="field"><label>Título</label><input name="title" id="entry-title" required maxlength="100" value="'+esc(old?.title||'')+'" placeholder="Ex.: salário, consulta, mercado"/><div id="title-suggestions" class="albus-suggestions"></div></div>'+
 '<div class="field-row"><div class="field"><label>Tipo</label><select name="entry_type" id="entry-type">'+options(Object.entries(TYPES).filter(x=>!['event','goal'].includes(x[0])),kind)+'</select></div>'+
 '<div class="field"><label id="entry-date-label">Data</label><input type="date" name="entry_date" id="entry-date" value="'+date+'" required/></div></div>'+
 '<div class="field-row" id="amount-row"><div class="field"><label>Valor (R$)</label>'+moneyInput('amount',old?.amount_cents||0)+'</div>'+
 '<div class="field"><label>Categoria</label><select id="entry-category" name="category">'+options(CATEGORIES.map(c=>[c,c]),old?.category||(kind==='income'?'Salário':'Outros'))+'</select></div></div>'+
 '<div class="field"><label>Situação</label><select id="entry-status" name="status" data-initial="'+esc(old?.status||'')+'"></select></div>'+
 '<div id="expense-extra"><div class="field"><label>Forma de pagamento</label><select name="payment_method" id="payment-method">'+options([['pix','Pix'],['debit','Débito'],['cash','Dinheiro'],['credit','Cartão de crédito']],pm)+'</select></div>'+
 '<div class="field"><label>Associar a evento (opcional)</label><select name="event_id">'+options([['','Nenhum'],...events().map(x=>[x.id,x.title])],old?.event_id||m.eventId||'')+'</select></div>'+
 '<label class="field-checkbox"><input name="variable" type="checkbox" '+(old?.variable!==false?'checked':'')+'/> Despesa variável para cálculo de imprevistos</label><div id="credit-preview" class="hint-inline"></div></div>'+
 '<div id="reserve-extra"><div class="field"><label>Caixinha associada (opcional)</label><select name="goal_id">'+options([['','Reserva sem caixinha'],...goals().map(x=>[x.id,x.title])],old?.goal_id||m.goalId||'')+'</select></div>'+
 '<div class="albus-small">Somente aportes marcados como realizados entram no saldo real da caixinha.</div></div>'+
 '<div class="field"><label>Recorrência</label><select id="entry-frequency" name="frequency">'+options([['none','Não repetir'],['monthly','Mensal em dia fixo'],['business_day_monthly','Dia útil do mês']],old?.frequency||'none')+'</select></div>'+
 '<div id="business-extra" class="field-row"><div class="field"><label>Qual dia útil?</label><input name="business_day_number" type="number" min="1" max="25" value="'+(old?.business_day_number||5)+'"/></div>'+
 '<div class="field"><label>Sábado conta?</label><select name="include_saturday">'+options([['yes','Sim (salário CLT)'],['no','Não']],old?.include_saturday===false?'no':'yes')+'</select></div></div>'+
 '<p class="albus-small">O cálculo de dias úteis é estimado: feriados estaduais, municipais e móveis podem exigir correção.</p>'+ (old?.frequency&&old.frequency!=='none'?'<div class="field"><label>Aplicar edição</label><select name="scope"><option value="occurrence">Somente a ocorrência '+fmt(m.occurrence||state.day)+'</option><option value="series">Toda a série recorrente</option></select></div>':'')+
 ownerInputs(old)+
 '<div class="field"><label>Observações</label><textarea name="notes" maxlength="1000">'+esc(old?.notes||'')+'</textarea></div>'+
 '<div class="form-footer">'+(old?button('Excluir','delete-entry','data-id="'+esc(old.id)+'"','text-button danger'):'<span></span>')+
 '<div>'+button('Cancelar','close','','secondary-button')+' <button class="primary-button" type="submit">Salvar</button></div></div></form>');
}
function eventForm(m){
 const old=db.events.find(x=>x.id===m.id);
 const session=state.eventSession;
 const draft=session?.draft||null;
 const date=draft?.date||old?.date||m.date||state.day;
 const existing=old?db.entries.filter(x=>x.event_id===old.id):[];
 const staged=session?.staged||[];
 const total=[...existing,...staged].filter(x=>x.entry_type==='expense').reduce((n,x)=>n+Number(x.amount_cents||0),0);
 const ownersItem=draft?{responsible_ids:draft.responsible_ids,visibility:draft.visibility}:old;
 const linked='<section class="albus-event-linked"><div class="albus-event-linked-head"><div><strong>Despesas vinculadas</strong><span>'+[...existing,...staged].length+' despesa(s) · '+mny(total)+'</span></div>'+
 button('+ Adicionar despesa','event-add-expense','','outline-button albus-child-add')+'</div>'+
 '<p class="albus-small">Crie quantas despesas precisar antes de salvar o evento. A janela de despesa retorna para este cadastro.</p>'+
 '<div class="albus-event-linked-list">'+(
  [...existing.map(x=>({data:x,pending:false})),...staged.map((x,index)=>({data:x,pending:true,index}))].map(({data,pending,index})=>
   '<div class="albus-event-linked-row"><span><b>'+esc(data.title)+'</b><small>'+esc(data.payment_method==='credit'?'Cartão de crédito':data.payment_method==='debit'?'Débito':data.payment_method==='cash'?'Dinheiro':'Pix')+' · '+fmt(data.entry_date)+(pending?' · Rascunho':' · Salva')+'</small></span>'+
   '<strong>'+mny(data.amount_cents)+'</strong>'+
   (pending?button('×','event-remove-expense','data-index="'+index+'" aria-label="Remover despesa não salva"','albus-tiny-button ghost'):
 button('↗','event-detach-expense','data-id="'+esc(data.id)+'" title="Desvincular despesa existente" aria-label="Desvincular despesa"','albus-tiny-button ghost'))+'</div>').join('')
  ||'<div class="albus-details-empty">Nenhuma despesa vinculada.</div>')+'</div></section>';
 return modal(old?'Editar evento':'Criar evento','<form id="event-form"><div class="field"><label>Nome</label><input name="title" required maxlength="100" value="'+esc(draft?.title??old?.title??'')+'"/></div>'+
 '<div class="field"><label>Data do evento</label><input name="date" type="date" required value="'+date+'"/></div>'+
 ownerInputs(ownersItem)+linked+
 '<div class="field"><label>Observações</label><textarea name="notes">'+esc(draft?.notes??old?.notes??'')+'</textarea></div>'+
 '<div class="form-footer">'+(old?button('Excluir','delete-event','data-id="'+esc(old.id)+'"','text-button danger'):'<span></span>')+'<div>'+button('Cancelar','close','','secondary-button')+
 ' <button type="submit" class="primary-button">Salvar evento</button></div></div></form>');
}
function captureEventDraft(){
 const node=root.querySelector('#event-form');
 if(!node)return;
 const f=new FormData(node);
 if(!state.eventSession)state.eventSession={id:state.modal?.id||null,draft:null,staged:[]};
 state.eventSession.draft={
   title:String(f.get('title')||''),
   date:String(f.get('date')||state.day),
   notes:String(f.get('notes')||''),
   responsible_ids:f.getAll('responsible_ids').map(String),
   visibility:String(f.get('visibility')||'shared')
 };
}
function eventExpenseForm(){
 const session=state.eventSession;
 const existing=state.modal?.editIndex!==undefined?session?.staged[state.modal.editIndex]:null;
 const eventDate=session?.draft?.date||state.day;
 return modal(existing?'Editar despesa vinculada':'Adicionar despesa ao evento',
 '<form id="event-expense-form">'+
 '<div class="field"><label>Título da despesa</label><input name="title" required maxlength="100" placeholder="Ex.: Restaurante, presentes, transporte" value="'+esc(existing?.title||'')+'"/></div>'+
 '<div class="field-row"><div class="field"><label>Valor (R$)</label>'+moneyInput('amount',existing?.amount_cents||0,'required')+'</div>'+
 '<div class="field"><label>Data da compra</label><input name="entry_date" type="date" required value="'+(existing?.entry_date||eventDate)+'"/></div></div>'+
 '<div class="field-row"><div class="field"><label>Forma de pagamento</label><select name="payment_method">'+
 options([['pix','Pix'],['debit','Débito'],['cash','Dinheiro'],['credit','Cartão de crédito']],existing?.payment_method||(db.settings.profile==='credit'?'credit':'pix'))+'</select></div>'+
 '<div class="field"><label>Categoria</label><select name="category">'+options(CATEGORIES.map(x=>[x,x]),existing?.category||'Outros')+'</select></div></div>'+
 '<div class="field"><label>Situação</label><select name="status">'+options([['planned','Planejada'],['paid','Paga']],existing?.status||'planned')+'</select></div>'+
 '<label class="field-checkbox"><input name="variable" type="checkbox" '+(existing?.variable!==false?'checked':'')+'/> Despesa variável</label>'+
 '<div class="albus-warning">Esta despesa será salva junto com o evento. Se for no cartão, o pagamento será contabilizado conforme a fatura, mesmo que ocorra no mês seguinte.</div>'+
 '<div class="form-footer">'+button('Voltar ao evento','event-return','','secondary-button')+' <button type="submit" class="primary-button">Adicionar despesa</button></div></form>');
}
function submitEventExpense(ev){
 ev.preventDefault();
 try{
  const f=new FormData(ev.currentTarget),title=String(f.get('title')||'').trim(),date=String(f.get('entry_date')||''),amount=E.parseMoney(f.get('amount'));
  const method=String(f.get('payment_method')||'pix');
  if(!title||title.length>100||!E.dateParts(date)||amount<=0)throw Error('Informe título, valor positivo e data da compra.');
  if(method==='credit'&&!db.settings.cardConfigured)throw Error('Configure o fechamento e vencimento do cartão antes de vincular despesas no crédito.');
  const session=state.eventSession;
  if(!session)throw Error('O formulário do evento não está disponível.');
  const ownerIds=session.draft?.responsible_ids?.length?session.draft.responsible_ids:MEMBER.map(x=>x.id);
  const record={id:id(),entry_type:'expense',title,entry_date:date,amount_cents:amount,
   payment_method:method,status:String(f.get('status')||'planned'),category:String(f.get('category')||'Outros'),
   variable:f.has('variable'),frequency:'none',notes:'',created_by:state.user,
   responsible_ids:ownerIds,visibility:session.draft?.visibility||'shared',workspace_id:A.WORKSPACE_ID};
  const index=state.modal?.editIndex;
  if(Number.isInteger(index)&&index>=0&&index<session.staged.length)session.staged[index]={...record,id:session.staged[index].id};
  else session.staged.push(record);
  state.modal={type:'event',id:session.id,date:session.draft?.date||state.day};state.error='';render();
 }catch(err){error(err)}
}
function goalForm(m){
 const existing=db.goals.find(x=>x.id===m.id),old=existing||{};
 const cap=P.budget(db,E,H,E.monthOf(today()));
 const suggestedContribution=P.active(db.settings)?cap.cents:P.suggestedLimit(db,E,H,E.monthOf(today()),db.settings).cents;
 const isEmergency=H.isEmergency(old)||(!existing&&m.kind==='emergency');
 const suggested=H.recommendedCost(E,entries(),db.overrides,E.monthOf(today()),'essential');
 const suggestedIncome=H.recommendedIncome(E,entries(),db.overrides,E.monthOf(today()));
 const revision=m.review===true;
 const cost=revision&&suggested.months?suggested.cents:(old.monthly_cost_cents??suggested.cents);
 const income=revision&&suggestedIncome.months?suggestedIncome.cents:(old.income_reference_cents??suggestedIncome.cents);
 const months=old.coverage_months||6;
 const suggestedDate=H.suggestedContributionDate(E,entries(),db.overrides,E.monthOf(state.day));
 const goalDate=old.contribution_date||suggestedDate||state.day;
 const emergencyExists=db.goals.some(g=>H.isEmergency(g)&&g.id!==m.id);
 return modal(existing?'Editar objetivo':'Criar caixinha',
 '<form id="goal-form"><div class="field"><label>Tipo de objetivo</label><select name="goal_type" id="goal-type">'+
 options([['general','Objetivo de investimento'],['emergency','Reserva de emergência']],isEmergency?'emergency':'general')+
 '</select></div>'+
 '<div class="field"><label>Nome do objetivo</label><input name="title" id="goal-title" maxlength="100" required value="'+esc(old.title||(isEmergency?'Reserva de emergência':''))+'" placeholder="Casa própria, viagem, reserva de emergência"/></div>'+
 (emergencyExists?'<div class="albus-small">Já existe uma reserva de emergência. Você pode editar a atual ou criar outro objetivo.</div>':'')+
 '<section id="emergency-fields" class="albus-emergency-fields">'+
 '<div class="albus-warning">Primeiro objetivo sugerido: construa uma reserva para cobrir suas despesas essenciais em caso de imprevistos ou perda de renda.</div>'+
 '<div class="field-row"><div class="field"><label>Receita mensal da família (referência)</label>'+moneyInput('income_reference',income)+'</div>'+
 '<div class="field"><label>Custo mensal usado na reserva</label>'+moneyInput('monthly_cost',cost)+'</div></div>'+
 '<div class="field"><label>Período de cobertura</label><select name="coverage_months" id="coverage-months">'+
 options([[6,'6 meses'],[12,'12 meses'],[18,'18 meses'],[24,'24 meses']],months)+'</select></div>'+
 '<div class="albus-small"><b>Receita sugerida:</b> '+mny(suggestedIncome.cents)+' · '+esc(suggestedIncome.source)+
 '. <b>Custo essencial sugerido:</b> '+mny(suggested.cents)+' · '+esc(suggested.source)+'. '+
 (suggested.months>1?'Estimativa conservadora: 70% da média + 30% do mês mais caro. ':'')+
 'Os meses com lançamentos podem estar incompletos. Confirme os valores antes de salvar. O mês atual só serve como referência provisória quando não há histórico anterior.</div>'+
 '</section>'+
 '<div class="field-row"><div class="field"><label>Meta total (R$)</label>'+moneyInput('target',old.target_cents||(isEmergency?cost*months:0),'required')+'</div>'+
 '<div class="field"><label>Saldo inicial real (R$)</label>'+moneyInput('initial',old.initial_cents||0)+'</div></div>'+
 '<div class="field-row"><div class="field"><label>Aporte mensal pretendido (R$)</label>'+moneyInput('monthly',old.monthly_cents??(suggestedContribution??0))+
 '<div class="albus-small">Sugestão de aporte: '+(suggestedContribution===null?'sem dados suficientes':mny(suggestedContribution))+
 '. Calculado após gastos, reservas existentes e imprevistos. '+(P.active(db.settings)?'Limite mensal global configurado: '+mny(cap.cents)+'.':'Você pode definir seu limite no quadro financeiro.')+
 ' Confirme se o valor cabe no seu orçamento.</div></div>'+
 '<div class="field"><label>% do CDI (projeção)</label><input name="cdi_percent" type="number" min="0" max="300" step=".1" required value="'+(old.cdi_percent??100)+'"/></div></div>'+
 '<div class="albus-schedule-fields"><label class="field-checkbox"><input name="schedule_enabled" id="goal-schedule" type="checkbox" '+
 (existing?old.schedule_enabled===true?'checked':'': 'checked')+'/> '+(P.active(db.settings)?'Participar da fila de aportes mensais por prioridade':'Criar automaticamente um aporte mensal recorrente no calendário')+'</label>'+
 '<div class="field"><label>Em qual dia deseja reservar?</label><input type="date" name="contribution_date" id="goal-contribution-date" value="'+esc(goalDate)+'" required/></div>'+
 '<div class="albus-small">'+(suggestedDate?'Sugestão: '+fmt(suggestedDate)+' (após a principal receita do mês). ':'')+'A data escolhida define o dia de cada mês, com ajuste para meses curtos. O aporte fica previsto no orçamento e só entra no saldo real quando confirmado.</div></div>'+
 '<div class="field"><label>CDI anual manual (%) para contingência</label><input name="manual_cdi_annual" type="number" min="0" max="100" step=".01" value="'+(old.manual_cdi_annual??'')+'" placeholder="Opcional, se a consulta falhar"/></div>'+
 ownerInputs(existing||null)+
 '<div class="albus-warning">Saldo real e projeção são separados. Rendimentos estimados não entram automaticamente no patrimônio. Atualize o saldo conforme o extrato do banco ou fundo de investimentos.</div>'+
 '<div class="form-footer">'+(existing?button('Excluir caixinha','delete-goal','data-id="'+esc(m.id)+'"','text-button danger'):'<span></span>')+'<div>'+button('Cancelar','close','','secondary-button')+
 ' <button type="submit" class="primary-button">Salvar objetivo</button></div></div></form>');
}
function updateGoalUI(){
 const form=root.querySelector('#goal-form');if(!form)return;
 const type=String(form.elements.goal_type.value),fields=root.querySelector('#emergency-fields'),title=root.querySelector('#goal-title');
 if(fields)fields.style.display=type==='emergency'?'block':'none';
 if(type==='emergency'&&title&&!title.value.trim())title.value='Reserva de emergência';
 const target=form.elements.target,cost=form.elements.monthly_cost,months=form.elements.coverage_months;
 if(type==='emergency'&&target&&cost&&months){
  const amount=E.parseMoney(cost.value);
  target.value=M.fromCents(Math.min(99999999999,amount*Number(months.value||6)));
  target.readOnly=true;
 }else if(target)target.readOnly=false;
}
function goalDetails(m){
 const goal=db.goals.find(x=>x.id===m.id);if(!goal)return '';
 const f=project(goal),reached=f.progress>=100;
 return modal(goal.title,'<div class="albus-goal-modal-total"><span>Saldo real</span><strong>'+mny(f.actual)+'</strong><small>Meta: '+mny(f.target)+' · '+Math.round(f.progress)+'% concluído</small></div>'+
 '<div class="albus-progress"><span style="width:'+f.progress+'%"></span></div>'+
 '<div class="albus-goal-stats">'+(H.isEmergency(goal)?'<p>Proteção: <b>'+goal.coverage_months+' meses</b> de gastos · custo base '+mny(goal.monthly_cost_cents)+'/mês</p>':'')+
 '<p>Aporte mensal planejado: <b>'+mny(f.monthly)+'</b></p>'+
 '<p>Dia do aporte: <b>'+(goal.contribution_date?fmt(goal.contribution_date):'Não programado')+'</b></p>'+
 '<p>Rentabilidade de referência: <b>'+goal.cdi_percent+'% do CDI</b></p>'+
 '<p>'+ (reached?'Meta concluída':'Conclusão projetada')+': <b>'+(reached?'100% alcançados':f.estimatedMonth?monthTitle(f.estimatedMonth):'Indefinida')+'</b></p></div>'+
 (reached?'<div class="albus-success-goal">Reserva concluída. Considere começar outro objetivo e continue revisando suas despesas e o saldo da reserva.</div>':'')+
 '<p class="albus-small">A projeção não acrescenta rendimentos ao saldo real. Atualize periodicamente o saldo segundo os rendimentos reais do banco ou fundo. Impostos e taxas não são considerados.</p>'+
 '<div class="form-footer">'+(H.isEmergency(goal)?button('Atualizar reserva de emergência','review-emergency','data-id="'+esc(goal.id)+'"','secondary-button'):'')+
 button('Editar','edit-goal','data-id="'+esc(goal.id)+'"','secondary-button')+button('+ Registrar aporte','add-contribution','data-id="'+esc(goal.id)+'"','primary-button')+'</div>');
}
function emergencyReview(m){
 const goal=db.goals.find(x=>x.id===m.id);
 if(!goal||!H.isEmergency(goal))return '';
 const month=E.monthOf(today());
 const cost=H.recommendedCost(E,entries(),db.overrides,month,'essential');
 const revenue=H.recommendedIncome(E,entries(),db.overrides,month);
 const capacity=H.contributionCapacity(E,entries(),db.overrides,month,goal.id,db.settings);
 const suggestedGoal=cost.months?H.emergencyTarget(cost.cents,goal.coverage_months||6):null;
 const showSamples=(data,label)=>'<div class="albus-review-basis"><strong>'+label+'</strong><span>'+esc(data.source)+'</span>'+
 (data.samples.length?data.samples.map(x=>'<span>'+esc(monthTitle(x.month))+': '+mny(x.cents)+'</span>').join(''):'<span>Sem dados suficientes: preencha manualmente.</span>')+'</div>';
 return modal('Atualizar reserva de emergência',
 '<div class="albus-warning">Esta revisão utiliza até três meses anteriores com lançamentos. Isso não garante que todos os gastos ou recebimentos tenham sido cadastrados. Nenhuma alteração será salva sem sua confirmação.</div>'+
 '<div class="albus-review-columns"><div><small>Custo essencial atual</small><strong>'+mny(goal.monthly_cost_cents||0)+'</strong></div>'+
 '<div><small>Nova sugestão de custo</small><strong>'+ (cost.months?mny(cost.cents):'Sem histórico')+'</strong></div>'+
 '<div><small>Receita cadastrada como referência</small><strong>'+mny(goal.income_reference_cents||0)+'</strong></div>'+
 '<div><small>Nova sugestão de receita</small><strong>'+(revenue.months?mny(revenue.cents):'Sem histórico')+'</strong></div>'+
 '<div><small>Meta atual</small><strong>'+mny(goal.target_cents||0)+'</strong></div>'+
 '<div><small>Nova meta sugerida</small><strong>'+(suggestedGoal!==null?mny(suggestedGoal):'Sem histórico')+'</strong></div></div>'+
 showSamples(cost,'Despesas essenciais consideradas')+showSamples(revenue,'Receitas consideradas')+
 '<p class="albus-small">Custo: com dois ou três meses, 70% da média + 30% do maior mês. Receita: média simples. Com um mês, usa-se esse mês; sem histórico, os valores precisam ser preenchidos manualmente.</p>'+
 '<div class="albus-review-capacity"><b>Margem mensal estimada para aportes: '+(capacity.cents===null?'Não disponível':mny(capacity.cents))+'</b>'+
 '<span>Margem calculada com receitas, despesas totais, outras reservas e imprevistos. É uma referência, não uma promessa de disponibilidade nem uma alteração automática no aporte.</span></div>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+
 button('Revisar meta e aporte','apply-emergency-review','data-id="'+esc(goal.id)+'"','primary-button')+'</div>');
}
function contributionForm(m){
 const goal=db.goals.find(x=>x.id===m.id);if(!goal)return '';
 return modal('Aporte · '+goal.title,'<form id="contribution-form">'+
 '<div class="field"><label>Valor (R$)</label>'+moneyInput('amount',goal.monthly_cents||0,'required')+'</div>'+
 '<div class="field"><label>Data do aporte</label><input name="entry_date" type="date" required value="'+state.day+'"/></div>'+
 '<div class="field"><label>Status</label><select name="status"><option value="planned">Planejado</option><option value="set_aside">Aportado (saldo real)</option></select></div>'+
 '<label class="field-checkbox"><input name="monthly" type="checkbox"/> Repetir mensalmente</label>'+
 '<div class="albus-warning">Uma previsão recorrente não é saldo realizado. Confirme cada aporte realizado para atualizar o saldo real.</div>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button class="primary-button" type="submit">Registrar</button></div></form>');
}

function reuseForm(m){
 const source=db.entries.find(x=>x.id===m.id);
 if(!source||source.entry_type!=='expense')return '';
 const ref=source.event_id?db.events.find(x=>x.id===source.event_id)?.title:null;
 const targetEvents=events().filter(x=>x.visibility==='shared'||x.created_by===state.user);
 return modal('Reutilizar despesa','<div class="albus-warning">Uma <b>nova despesa</b> será contabilizada separadamente. A original'+
 (ref?' permanecerá no evento '+esc(ref):' permanecerá como está')+'.</div>'+
 '<form id="reuse-form"><div class="field"><label>Despesa de origem</label><div class="albus-small">'+esc(source.title)+' · '+mny(source.amount_cents)+'</div></div>'+
 '<div class="field"><label>Destino</label><select name="event_id" id="reuse-event">'+
 options([['','Despesa independente'],...targetEvents.map(x=>[x.id,'Evento: '+x.title+' · '+fmt(x.date)])],'')+
 '</select></div><div class="field"><label>Data da nova despesa</label><input type="date" name="date" value="'+esc(state.day)+'" required/></div>'+
 '<div class="albus-small">Ao escolher um evento, a data dele será usada. A cópia será planejada, mesmo que a original esteja paga.</div>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button type="submit" class="primary-button">Criar cópia</button></div></form>');
}
function persistExpenseChange(next,message,date){
 B.save(localStorage,next);
 Object.assign(db,next);
 if(date&&E.dateParts(date)){state.day=date;state.month=E.monthOf(date);}
 state.modal=null;state.error='';state.message=message;render();
}
function detachExpense(itemId,keepEditor=false){
 const item=R.getExpense(db,itemId);
 if(!item.event_id)return;
 if(!events().some(x=>x.id===item.event_id))throw Error('Evento de origem indisponível.');
 const next=R.detach(db,itemId);
 B.save(localStorage,next);
 Object.assign(db,next);
 state.message='Despesa desvinculada sem duplicar valores.';
 if(!keepEditor)state.modal=null;
 render();
}
function reuseExpense(itemId,date,eventId,occurrence){
 const item=R.getExpense(db,itemId);
 if(item.event_id&&!events().some(x=>x.id===item.event_id))throw Error('Evento de origem indisponível.');
 const target=eventId?events().find(x=>x.id===eventId):null;
 if(eventId&&!target)throw Error('Evento de destino indisponível.');
 const targetDate=target?.date||date;
 const next=R.copy(db,itemId,{date:targetDate,eventId:eventId||null,newId:id(),occurrenceDate:occurrence,currentUser:state.user});
 persistExpenseChange(next,target?'Cópia vinculada ao evento '+target.title+'. Original preservado.':'Cópia independente criada. Original preservado.',targetDate);
}
function submitReuse(e){
 e.preventDefault();
 try{const f=new FormData(e.currentTarget);reuseExpense(state.modal.id,String(f.get('date')||state.day),String(f.get('event_id')||''),state.modal.occurrence);}
 catch(err){error(err);}
}
function portfolioSettings(){
 const suggestion=P.suggestedLimit(db,E,H,E.monthOf(today()),db.settings);
 const current=P.budget(db,E,H,E.monthOf(today()));
 const proposed=suggestion.cents??0;
 const preview=H.recommendedIncome(E,P.baseEntries(db),db.overrides,E.monthOf(today()));
 return modal('Limite mensal de investimentos e prioridades',
 '<form id="portfolio-settings-form">'+
 '<div class="albus-warning">A reserva de emergência tem prioridade fixa. Os outros objetivos recebem aportes em sequência, conforme a ordem das caixinhas e o limite mensal. Não serão criados novos lançamentos recorrentes permanentes: as parcelas futuras são projeções até confirmação.</div>'+
 '<div class="field"><label>Limite total de aportes por mês (R$)</label>'+moneyInput('budget_limit',current.cents,'required')+'</div>'+
 '<p class="albus-small">Sugestão baseada no histórico: '+(suggestion.available?mny(proposed):'ainda não disponível')+
 '. Considera receitas e despesas anteriores, outras reservas e provisões de imprevistos. Estimativa, não disponibilidade garantida. Você pode definir seu limite manualmente.</p>'+
 '<div class="albus-review-columns"><div><small>Receita estimada</small><strong>'+mny(preview.cents)+'</strong></div>'+
 '<div><small>Despesas totais estimadas</small><strong>'+mny(suggestion.outflow.cents)+'</strong></div></div>'+
 '<label class="field-checkbox"><input type="checkbox" name="priority_mode" '+(P.active(db.settings)?'checked':'')+'/> Ativar fila de prioridades e distribuir automaticamente as previsões de aportes</label>'+
 '<p class="albus-small">Ao ativar, previsões automáticas antigas deixam de ser somadas. Aportes já realizados permanecem intactos. Ao desativar, voltam a ser exibidas as recorrências que já existiam.</p>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button type="submit" class="primary-button">Salvar limite e prioridades</button></div>'+
 '</form>');
}
function savePortfolioSettings(ev){
 ev.preventDefault();
 try{
  const f=new FormData(ev.currentTarget),limit=E.parseMoney(f.get('budget_limit'));
  const next={...db,settings:{...db.settings,goal_budget_limit_cents:limit,
   goal_allocation_mode:f.has('priority_mode')?'priority':'legacy'}};
  B.save(localStorage,next);
  Object.assign(db,next);
  state.modal=null;state.message=P.active(db.settings)?'Fila ativada. A reserva de emergência recebe aportes primeiro, respeitando o limite definido.':'Limite salvo. A fila de prioridades está desativada.';
  render();
 }catch(e){error(e)}
}
function reorderPriority(sourceId,targetId){
 const next={...db,goals:P.reorder(db.goals,sourceId,targetId)};
 if(JSON.stringify(next.goals)===JSON.stringify(db.goals))return;
 try{B.save(localStorage,next);Object.assign(db,next);state.message='Prioridades atualizadas.';render();}
 catch(e){state.error='Erro ao salvar a ordem: '+e.message;render()}
}
function confirmPortfolio(itemId,date,amount){
 const goal=goals().find(g=>g.id===itemId);
 if(!P.active(db.settings)||!goal||!E.dateParts(date))throw Error('Objetivo ou data indisponível.');
 const candidate=cashRows(E.monthOf(date),'cash').find(x=>x.virtual_portfolio&&x.goal_id===itemId&&x.entry_date===date);
 if(!candidate||candidate.amount_cents!==amount)throw Error('O planejamento foi alterado. Reabra a data e confira o aporte.');
 const contribution=A.normalizeItem({id:id(),entry_type:'reserve',goal_id:itemId,
   title:'Aporte confirmado · '+goal.title,entry_date:date,amount_cents:amount,
   status:'set_aside',frequency:'none',payment_method:'pix',category:'Precaução',
   created_by:state.user,responsible_ids:goal.responsible_ids,
   visibility:goal.visibility,workspace_id:A.WORKSPACE_ID});
 const next={...db,entries:[...db.entries,contribution]};
 B.save(localStorage,next);Object.assign(db,next);
 state.message='Aporte confirmado no saldo real. A fila foi recalculada.';
 render();
}
function settingsForm(){
 const s=db.settings;
 return modal('Cartão e imprevistos','<form id="settings-form"><div class="field-row"><div class="field"><label>Fechamento</label><input type="number" min="1" max="31" required name="closingDay" value="'+s.closingDay+'"/></div>'+
 '<div class="field"><label>Vencimento</label><input type="number" min="1" max="31" required name="dueDay" value="'+s.dueDay+'"/></div></div>'+
 '<div class="field-row"><div class="field"><label>Variação estimada (%)</label><input type="number" min="0" max="100" required name="variationPercent" value="'+s.variationPercent+'"/></div>'+
 '<div class="field"><label>Imprevistos (%)</label><input type="number" min="0" max="100" required name="provisionPercent" value="'+s.provisionPercent+'"/></div></div>'+
 '<div class="field"><label>Provisão fixa de imprevistos (R$)</label>'+moneyInput('provisionFixed',s.provisionFixedCents||0)+'</div>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button type="submit" class="primary-button">Salvar</button></div></form>');
}
function moveForm(m){
 const x=m.kind==='event'?db.events.find(x=>x.id===m.id):db.entries.find(x=>x.id===m.id);
 return modal('Mover '+(m.kind==='event'?'evento':'lançamento'),'<form id="move-form"><div class="field"><label>Nova data</label><input name="date" type="date" required value="'+(x?.date||x?.entry_date||state.day)+'"/></div>'+
 '<p class="albus-small">Mover um evento desloca suas despesas vinculadas. Mover um lançamento recorrente altera somente a ocorrência selecionada. Arrastar um pagamento do cartão altera o vencimento previsto, sem mudar a data da compra.</p>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button type="submit" class="primary-button">Mover</button></div></form>');
}
function render(){
 closeHelp();
 planCache=null;
 const s=summary();
 root.innerHTML='<div class="albus-shell"><header class="albus-top"><div class="albus-brand"><span class="brand-icon">♥</span>albus<span class="brand-dot">.</span></div>'+
 '<div class="albus-top-center">Calendário e planejamento da família</div><div class="albus-top-right"><button type="button" class="albus-backup-button" data-action="export-backup" title="Baixar cópia dos cadastros deste navegador">↓ Backup</button><button type="button" class="albus-backup-button" data-action="import-backup" title="Importar sem sobrescrever lançamentos">↑ Importar</button><input id="backup-file" type="file" accept="application/json,.json" hidden/> Perfil de teste <select id="demo-user">'+
 options(MEMBER.map(x=>[x.id,x.name]),state.user)+'</select><span class="albus-family-pill">Família</span></div></header>'+
 '<main class="albus-main"><div class="albus-title-row albus-compact-head"><div><div class="albus-eyebrow">CALENDÁRIO · '+esc(monthTitle(state.month))+'</div>'+
 '<h1>Seu calendário.</h1></div></div>'+
 '<div class="albus-note">Ambiente de testes: Rodrigo e Danielle são perfis simulados. Os dados ficam neste navegador e neste endereço. <b>Para protegê-los, use ↓ Backup antes de testar mudanças importantes.</b> Não há sincronização entre links diferentes.</div>'+
 (state.error?'<div class="error">'+esc(state.error)+'</div>':'')+(state.message?'<div class="success">'+esc(state.message)+'</div>':'')+
 '<div class="albus-sticky-sentinel" aria-hidden="true"></div>'+
 '<div class="albus-financial-sticky" id="financial-sticky" role="region" aria-label="Resumo financeiro e origem dos pagamentos">'+dashboardCards()+'</div>'+
 goalCards()+
 '<section class="albus-dashboard albus-dashboard-three">'+filters()+calendar()+details()+'</section>'+
 '<div class="albus-footer"><b>Entenda o mês:</b> receitas previstas financiam pagamentos com vencimento neste mês, inclusive faturas de compras anteriores. Compras no cartão para meses futuros: '+mny(s.futureCard)+'. Sem duplicidade.</div>'+
 '</main>'+(
 state.modal?.type==='entry'?entryForm(state.modal):
 state.modal?.type==='event'?eventForm(state.modal):
 state.modal?.type==='event-expense'?eventForm({id:state.eventSession?.id,date:state.eventSession?.draft?.date})+eventExpenseForm():
 state.modal?.type==='goal'?goalForm(state.modal):
 state.modal?.type==='goal-details'?goalDetails(state.modal):
 state.modal?.type==='emergency-review'?emergencyReview(state.modal):
 state.modal?.type==='contribution'?contributionForm(state.modal):
 state.modal?.type==='settings'?settingsForm():
 state.modal?.type==='portfolio-settings'?portfolioSettings():
 state.modal?.type==='move'?moveForm(state.modal):
 state.modal?.type==='reuse'?reuseForm(state.modal):''
 )+'</div>';
 bind();
}
function error(e){
 const header=root.querySelector('.albus-modal .modal-header');
 if(!header){state.error=String(e.message||e);render();return;}
 let msg=root.querySelector('#form-error');
 if(!msg){msg=document.createElement('div');msg.id='form-error';msg.className='error';header.after(msg);}
 msg.textContent=String(e.message||e);
}
function open(type,extra={}){
 if(type==='event')state.eventSession={id:extra.id||null,draft:null,staged:[]};
 else if(type!=='event-expense')state.eventSession=null;
 state.modal={type,...extra};state.createOpen=false;state.error='';render();
}
function submitEntry(ev){
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),old=db.entries.find(x=>x.id===state.modal.id),type=String(f.get('entry_type')||'expense'),date=String(f.get('entry_date')||''),title=String(f.get('title')||'').trim();
 if(!title||!E.dateParts(date)||!['expense','income','reserve','task'].includes(type))throw Error('Informe título e data válidos.');
 const amount=type==='task'?0:E.parseMoney(f.get('amount')),frequency=String(f.get('frequency')||'none');
 if(!['none','monthly','business_day_monthly'].includes(frequency))throw Error('Recorrência inválida.');
 const status=String(f.get('status')||'planned'),methods={income:['planned','received'],expense:['planned','paid'],reserve:['planned','set_aside'],task:['pending','done']};
 if(!methods[type].includes(status))throw Error('Status inválido.');
 const method=String(f.get('payment_method')||'pix');
 if(type==='expense'&&method==='credit'&&!db.settings.cardConfigured)throw Error('Configure o cartão antes de salvar compras no crédito.');
 const ownership=owners(f,old),eventId=type==='expense'?String(f.get('event_id')||''):'',goalId=type==='reserve'?String(f.get('goal_id')||''):'';
 if(eventId&&!events().some(x=>x.id===eventId))throw Error('Evento indisponível.');
 if(goalId&&!goals().some(x=>x.id===goalId))throw Error('Caixinha indisponível.');
 if(eventId){const parent=db.events.find(x=>x.id===eventId);if(parent?.visibility==='private'&&ownership.visibility!=='private')throw Error('Despesa compartilhada não pode pertencer a evento privado.');}
 if(goalId){const parent=db.goals.find(x=>x.id===goalId);if(parent?.visibility==='private'&&ownership.visibility!=='private')throw Error('Aporte compartilhado não pode pertencer a caixinha privada.');}
 const n=Number(f.get('business_day_number')||5);if(!Number.isInteger(n)||n<1||n>25)throw Error('Dia útil deve estar entre 1 e 25.');
 const value={...ownership,title,entry_date:date,entry_type:type,amount_cents:amount,frequency,business_day_number:n,include_saturday:f.get('include_saturday')!=='no',
 status,category:String(f.get('category')||'Outros'),payment_method:method,event_id:eventId||null,goal_id:goalId||null,
 variable:type==='expense'&&f.has('variable'),notes:String(f.get('notes')||'').slice(0,1000)};
 if(old&&old.frequency!=='none'&&f.get('scope')==='occurrence'){
   const occurrence=state.modal.occurrence||state.day;
   const override={entry_id:old.id,occurrence_date:occurrence,title,amount_cents:amount,status,category:value.category,notes:value.notes,deleted:false};
   const index=db.overrides.findIndex(x=>x.entry_id===old.id&&x.occurrence_date===occurrence);
   if(index===-1)db.overrides.push(override);else db.overrides[index]={...db.overrides[index],...override};
 }else if(old)Object.assign(old,value);else db.entries.push({id:id(),...value});
 const selectedDate=old&&old.frequency!=='none'&&f.get('scope')==='occurrence'?(state.modal.occurrence||state.day):date;
 state.month=E.monthOf(selectedDate);state.day=selectedDate;state.modal=null;state.message='Lançamento salvo.';safe();render();
 }catch(e){error(e)}
}
function submitEvent(ev){
 ev.preventDefault();
 try{
  const f=new FormData(ev.currentTarget),old=db.events.find(x=>x.id===state.modal.id),
   date=String(f.get('date')||''),title=String(f.get('title')||'').trim();
  if(!title||title.length>100||!E.dateParts(date))throw Error('Informe título e data válidos.');
  const ownership=owners(f,old),eventId=old?.id||id();
  let next={...db,events:[...db.events],entries:[...db.entries],overrides:[...db.overrides]};
  if(old){
   if(old.date!==date){
    const linked=next.entries.filter(x=>x.event_id===eventId);
    if(linked.some(x=>['paid','received','set_aside'].includes(x.status))&&!confirm('O evento tem despesas efetivadas. Alterar as datas históricas e continuar?'))return;
    next=E.moveItem(next,'event',eventId,date);
   }
   next.events=next.events.map(x=>x.id===eventId?{...x,title,date,notes:String(f.get('notes')||''),...ownership}:x);
  }else next.events.push({id:eventId,title,date,notes:String(f.get('notes')||''),...ownership});
  const staged=state.eventSession?.staged||[];
  for(const item of staged){
   const record={...item,event_id:eventId,created_by:ownership.created_by,
    visibility:ownership.visibility,responsible_ids:ownership.responsible_ids,workspace_id:A.WORKSPACE_ID};
   if(record.payment_method==='credit'&&!db.settings.cardConfigured)throw Error('Configure o cartão antes de salvar as despesas vinculadas.');
   next.entries.push(record);
  }
  // Grava o evento e todas as despesas novas na mesma operação.
  B.save(localStorage,next);
  Object.assign(db,next);
  state.day=date;state.month=E.monthOf(date);state.modal=null;state.eventSession=null;state.error='';
  state.message=staged.length?'Evento e '+staged.length+' despesa(s) vinculada(s) salvos.':'Evento salvo.';
  render();
 }catch(err){error(err)}
}
function submitGoal(ev){
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),old=db.goals.find(x=>x.id===state.modal.id);
 const type=String(f.get('goal_type')||'general'),emergency=type==='emergency';
 let title=String(f.get('title')||'').trim();
 if(emergency&&!title)title='Reserva de emergência';
 if(!title)throw Error('Informe um nome para o objetivo.');
 if(emergency&&db.goals.some(g=>H.isEmergency(g)&&g.id!==old?.id))
    throw Error('Já existe uma reserva de emergência. Edite a caixinha existente.');
 const cost=emergency?E.parseMoney(f.get('monthly_cost')):0;
 const coverage=Number(f.get('coverage_months')||6);
 if(emergency&&cost<=0)throw Error('Informe um custo mensal estimado para definir a reserva.');
 const target=emergency?H.emergencyTarget(cost,coverage):E.parseMoney(f.get('target'));
 const monthly=E.parseMoney(f.get('monthly')),initial=E.parseMoney(f.get('initial'));
 const date=String(f.get('contribution_date')||state.day);
 const schedule=f.has('schedule_enabled')&&monthly>0;
 if(!target)throw Error('A meta precisa ser maior que zero.');
 if(!E.dateParts(date))throw Error('Escolha uma data válida para os aportes.');
 if(schedule&&monthly<=0)throw Error('Informe o valor do aporte mensal.');
 const percent=Number(f.get('cdi_percent')),manual=String(f.get('manual_cdi_annual')||'').trim();
 if(!Number.isFinite(percent)||percent<0||percent>300)throw Error('Percentual do CDI inválido.');
 if(manual!==''&&(!Number.isFinite(Number(manual))||Number(manual)<0||Number(manual)>100))throw Error('Taxa manual inválida.');
 const ownership=owners(f,old);
 const value={...ownership,title,goal_type:type,target_cents:target,initial_cents:initial,
  monthly_cents:monthly,monthly_cost_cents:cost,
  income_reference_cents:emergency?E.parseMoney(f.get('income_reference')):0,
  coverage_months:emergency?coverage:null,contribution_date:date,schedule_enabled:schedule,
  cdi_percent:percent,manual_cdi_annual:manual===''?null:Number(manual)};
 const goal={...(old||{}),id:old?.id||id(),...value,
  priority_index:old?.priority_index??db.goals.length};
 const next={...db,goals:old?db.goals.map(g=>g.id===goal.id?goal:g):[...db.goals,goal]};
 const planned=P.active(db.settings)?next:H.syncSchedule(next,goal,E,today(),id);
 // A meta, o calendário recorrente e os dados anteriores são salvos juntos.
 B.save(localStorage,planned);
 Object.assign(db,planned);
 state.modal=null;
 state.message=goal.schedule_enabled?(P.active(db.settings)?'Objetivo salvo na fila de prioridades. O calendário mostra aportes até o limite mensal configurado.':'Objetivo salvo e aporte mensal previsto no calendário. Confirme cada depósito para atualizar o saldo real.'):'Objetivo salvo. Os aportes podem ser registrados a qualquer momento.';
 render();
 }catch(e){error(e)}
}
function submitContribution(ev){
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),g=db.goals.find(x=>x.id===state.modal.id);
 if(!g)throw Error('Caixinha não encontrada.');
 const amount=E.parseMoney(f.get('amount')),date=String(f.get('entry_date')||'');
 if(!amount||!E.dateParts(date))throw Error('Informe valor e data válidos.');
 if(f.has('monthly')&&f.get('status')==='set_aside')throw Error('Um aporte recorrente precisa ficar como planejado. Confirme cada mês individualmente antes de somar ao saldo real.');
 db.entries.push(A.normalizeItem({id:id(),entry_type:'reserve',goal_id:g.id,title:'Aporte · '+g.title,entry_date:date,amount_cents:amount,status:String(f.get('status')),frequency:f.has('monthly')?'monthly':'none',created_by:state.user,visibility:g.visibility,responsible_ids:g.responsible_ids,category:'Precaução',payment_method:'pix'}));
 state.day=date;state.month=E.monthOf(date);state.modal=null;state.message='Aporte registrado. Somente aportes realizados somam ao saldo real.';safe();render();
 }catch(e){error(e)}
}
function submitSettings(ev){
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),next={...db.settings};
 for(const key of ['closingDay','dueDay']){const n=Number(f.get(key));if(!Number.isInteger(n)||n<1||n>31)throw Error('Dias entre 1 e 31.');next[key]=n;}
 for(const key of ['variationPercent','provisionPercent']){const n=Number(f.get(key));if(!Number.isInteger(n)||n<0||n>100)throw Error('Percentuais entre 0 e 100.');next[key]=n;}
 next.provisionFixedCents=E.parseMoney(f.get('provisionFixed'));next.cardConfigured=true;Object.assign(db.settings,next);state.modal=null;safe();render();
 }catch(e){error(e)}
}
function move(kind,itemId,to,silent=false,occurrence=null){
 if(!E.dateParts(to))throw Error('Data inválida.');
 const target=kind==='event'?db.events.find(x=>x.id===itemId):db.entries.find(x=>x.id===itemId);
 if(!target)return false;
 if(kind==='event'&&db.entries.some(x=>x.event_id===itemId&&['paid','received','set_aside'].includes(x.status))&&!confirm('O evento possui despesas já efetivadas. Alterar datas históricas?'))return false;
 if(kind==='entry'&&['paid','received','set_aside'].includes(target.status)&&!confirm('Este lançamento foi efetivado. Alterar sua data histórica?'))return false;
 let next;
 if(kind==='entry'&&target.frequency&&target.frequency!=='none'){
   const source=occurrence||state.day;
   next=E.moveOccurrence(db,itemId,source,to,db.settings.view);
 }else if(kind==='entry'&&target.entry_type==='expense'&&target.payment_method==='credit'&&db.settings.view==='cash'){
   next={...db,entries:db.entries.map(x=>x.id===itemId?{...x,payment_date_override:to}:x)};
 }else next=E.moveItem(db,kind,itemId,to);
 // Persistir antes de substituir os objetos visíveis em memória; se falhar, nada muda.
 const previous={entries:db.entries,events:db.events,overrides:db.overrides};
 db.entries=next.entries;db.events=next.events;db.overrides=next.overrides||db.overrides;
 if(!safe()){Object.assign(db,previous);if(!silent)render();return false;}
 state.day=to;state.month=E.monthOf(to);
 if(!silent){state.modal=null;state.message='Item movido para '+fmt(to)+'.';render();}
 return true;
}
function statusOptions(type){
 return {expense:[['planned','Planejada'],['paid','Paga']],income:[['planned','Prevista'],['received','Recebida']],reserve:[['planned','Planejado'],['set_aside','Aportado']],task:[['pending','Pendente'],['done','Concluída']]}[type]||[];
}
function updateEntryUI(){
 const form=root.querySelector('#entry-form');if(!form)return;
 const type=form.elements.entry_type.value,dateLabel=root.querySelector('#entry-date-label'),status=root.querySelector('#entry-status'),current=status.dataset.initial||status.value;delete status.dataset.initial;
 if(dateLabel)dateLabel.textContent={expense:'Data da compra',income:'Data do recebimento',reserve:'Data do aporte',task:'Data da tarefa'}[type];
 status.innerHTML=options(statusOptions(type),statusOptions(type).some(x=>x[0]===current)?current:statusOptions(type)[0][0]);
 root.querySelector('#amount-row').style.display=type==='task'?'none':'grid';
 root.querySelector('#expense-extra').style.display=type==='expense'?'block':'none';
 root.querySelector('#reserve-extra').style.display=type==='reserve'?'block':'none';
 root.querySelector('#business-extra').style.display=form.elements.frequency.value==='business_day_monthly'?'grid':'none';
 const category=root.querySelector('#entry-category').value,box=root.querySelector('#title-suggestions'),title=root.querySelector('#entry-title');
 const ideas=type==='income'&&category==='Salário'?SUGGESTIONS.Salário:(SUGGESTIONS[category]||[]);
 box.innerHTML=ideas.length?'<span class="albus-small">Sugestões opcionais: </span>'+ideas.map(x=>'<button type="button" data-suggestion="'+esc(x)+'">'+esc(x)+'</button>').join(''):'';
 box.querySelectorAll('[data-suggestion]').forEach(el=>el.addEventListener('click',()=>{title.value=el.dataset.suggestion;title.focus()}));
 const payment=form.elements.payment_method.value,preview=root.querySelector('#credit-preview');
 preview.style.display=type==='expense'&&payment==='credit'?'block':'none';
 if(type==='expense'&&payment==='credit'){
  preview.textContent=db.settings.cardConfigured&&E.dateParts(form.elements.entry_date.value)?'Pagamento previsto: '+fmt(E.billingDueDate(form.elements.entry_date.value,db.settings)):'Configure o cartão em Cartão e imprevistos.';
 }
}
function updateStickySummary(){
 const summary=root.querySelector('#financial-sticky'),marker=root.querySelector('.albus-sticky-sentinel');
 if(!summary||!marker)return;
 // O cabeçalho do aplicativo rola normalmente; só o resumo permanece visível.
 if(!marker.getBoundingClientRect||!summary.classList)return;
 const pinned=marker.getBoundingClientRect().bottom<=1;
 summary.classList.toggle('is-stuck',pinned);
}
if(typeof window!=='undefined'&&window.addEventListener){
 window.addEventListener('scroll',updateStickySummary,{passive:true});
 window.addEventListener('resize',updateStickySummary);
}
function bind(){
 updateStickySummary();
 root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',event=>{
  const action=el.dataset.action,item=el.dataset.id,kind=el.dataset.kind;
  if(action==='day'){state.day=el.dataset.date;state.message='';return render()}
  if(action==='previous'||action==='next'){state.month=E.addMonths(state.month,action==='previous'?-1:1);state.day=E.dateInMonth(state.month,Number(state.day.slice(-2)));return render()}
  if(action==='today'){state.month=E.monthOf(today());state.day=today();return render()}
  if(action==='toggle-create'){state.createOpen=!state.createOpen;return render()}
  if(action==='create'){return open(kind==='goal'?'goal':kind==='event'?'event':'entry',{kind,date:state.day})}
  if(action==='new-emergency')return open('goal',{kind:'emergency'});
  if(action==='close'){
   if(state.modal?.type==='event-expense'){
     state.modal={type:'event',id:state.eventSession?.id,date:state.eventSession?.draft?.date||state.day};state.error='';return render();
   }
   state.modal=null;state.eventSession=null;state.error='';return render();
  }
  if(action==='event-add-expense'){
   captureEventDraft();
   state.modal={type:'event-expense'};state.error='';return render();
  }
  if(action==='event-return'){
   state.modal={type:'event',id:state.eventSession?.id,date:state.eventSession?.draft?.date||state.day};
   state.error='';return render();
  }
  if(action==='event-remove-expense'){
   captureEventDraft();
   const index=Number(el.dataset.index);
   if(Number.isInteger(index)&&index>=0&&index<(state.eventSession?.staged.length||0))state.eventSession.staged.splice(index,1);
   return render();
  }
  if(action==='settings')return open('settings');
  if(action==='portfolio-settings')return open('portfolio-settings');
  if(action==='confirm-portfolio'){
   try{confirmPortfolio(item,el.dataset.date,Number(el.dataset.amount));}catch(e){state.error=e.message;render();}
   return;
  }
  if(action==='priority-up'||action==='priority-down'){
   const sorted=P.ordered(db.goals),index=sorted.findIndex(g=>g.id===item),other=index+(action==='priority-up'?-1:1);
   if(other>=0&&other<sorted.length)reorderPriority(item,sorted[other].id);
   return;
  }
  if(action==='goal-details')return open('goal-details',{id:item});
  if(action==='review-emergency')return open('emergency-review',{id:item});
  if(action==='apply-emergency-review')return open('goal',{id:item,review:true});
  if(action==='edit-goal')return open('goal',{id:item});
  if(action==='add-contribution')return open('contribution',{id:item});
  if(action==='edit-entry')return open('entry',{id:item,occurrence:el.dataset.occurrence||state.day});
  if(action==='reuse-entry')return open('reuse',{id:item,occurrence:el.dataset.occurrence||state.day});
  if(action==='detach-entry'){
   try{detachExpense(item);}catch(err){state.error=err.message;render();}
   return;
  }
  if(action==='event-detach-expense'){
   try{captureEventDraft();detachExpense(item,true);}catch(err){error(err);}
   return;
  }
  if(action==='edit-event')return open('event',{id:item});
  if(action==='add-child'){const e=db.events.find(x=>x.id===item);return open('entry',{kind:'expense',eventId:item,date:e?.date||state.day})}
  if(action==='move-entry')return open('move',{kind:'entry',id:item,occurrence:el.dataset.occurrence||null});
  if(action==='move-event')return open('move',{kind:'event',id:item});
  if(action==='delete-entry'||action==='delete-event'){
    const table=action==='delete-event'?'events':'entries';if(!confirm('Excluir este item?'))return;
    if(table==='events'){db.entries=db.entries.filter(x=>x.event_id!==item);db.overrides=db.overrides.filter(x=>db.entries.some(e=>e.id===x.entry_id));}
    db[table]=db[table].filter(x=>x.id!==item);state.modal=null;safe();return render();
  }
  if(action==='delete-goal'){
    if(db.entries.some(x=>x.goal_id===item)){state.error='Exclua ou desvincule os aportes antes de excluir a caixinha.';return render();}
    if(!confirm('Excluir caixinha?'))return;db.goals=db.goals.filter(x=>x.id!==item);state.modal=null;safe();return render();
  }
 }));
 root.querySelectorAll('[data-help]').forEach(btn=>btn.addEventListener('click',ev=>{ev.stopPropagation();openHelp(btn);}));
 root.querySelectorAll('input[data-money="true"]').forEach(M.bind);
 const listen=(id,fn)=>root.querySelector(id)?.addEventListener('change',fn);
 root.querySelector('[data-action="export-backup"]')?.addEventListener('click',()=>{
   try{B.download(localStorage,location.origin);}catch(err){state.error='Falha ao exportar: '+err.message;render();}
 });
 root.querySelector('[data-action="import-backup"]')?.addEventListener('click',()=>root.querySelector('#backup-file')?.click());
 root.querySelector('#backup-file')?.addEventListener('change',async ev=>{
   const file=ev.target.files?.[0];
   if(!file)return;
   try{
     if(file.size>20*1024*1024)throw Error('Backup muito grande (limite 20 MB).');
     const source=await file.text();
     const current=B.parseStored(localStorage.getItem(KEY));
     const merged=B.merge(current,source);
     const added=Object.values(merged.counts).reduce((sum,v)=>sum+v.added,0);
     if(!added){state.message='Todos os itens desse backup já estavam cadastrados.';render();return;}
     if(!confirm('Importar '+added+' itens adicionais? Nenhum item existente será sobrescrito.'))return;
     B.save(localStorage,merged.data);
     location.reload();
   }catch(err){state.error='Não foi possível importar: '+err.message;render();}
 });
 listen('#demo-user',e=>{state.user=e.target.value;state.filter='all';render()});
 listen('#owner-filter',e=>{state.filter=e.target.value;render()});
 listen('#payment-profile',e=>{db.settings.profile=e.target.value;safe();if(db.settings.profile==='credit'&&!db.settings.cardConfigured)return open('settings');render()});
 listen('#calendar-view',e=>{db.settings.view=e.target.value;safe();render()});
 listen('#goal-type',updateGoalUI);
 listen('#coverage-months',updateGoalUI);
 root.querySelector('input[name="monthly_cost"]')?.addEventListener('input',updateGoalUI);
 listen('#entry-type',updateEntryUI);listen('#entry-category',updateEntryUI);listen('#payment-method',updateEntryUI);listen('#entry-frequency',updateEntryUI);listen('#entry-date',updateEntryUI);
 listen('#visibility',e=>{const inputs=root.querySelectorAll('input[name="responsible_ids"]');inputs.forEach(i=>{if(e.target.value==='private'){i.checked=i.value===state.user;i.disabled=i.value!==state.user}else i.disabled=false;});const all=root.querySelector('#all-members');if(all)all.disabled=e.target.value==='private';});
 listen('#all-members',e=>{root.querySelectorAll('input[name="responsible_ids"]').forEach(i=>{if(!i.disabled)i.checked=e.target.checked})});
 for(const field of root.querySelectorAll('input[name="responsible_ids"]'))field.addEventListener('change',()=>{const all=root.querySelector('#all-members');if(all)all.checked=[...root.querySelectorAll('input[name="responsible_ids"]')].every(x=>x.checked)});
 const formBind=(name,fn)=>root.querySelector(name)?.addEventListener('submit',fn);
 formBind('#portfolio-settings-form',savePortfolioSettings);
 formBind('#reuse-form',submitReuse);formBind('#entry-form',submitEntry);formBind('#event-form',submitEvent);formBind('#event-expense-form',submitEventExpense);formBind('#goal-form',submitGoal);formBind('#contribution-form',submitContribution);formBind('#settings-form',submitSettings);
 formBind('#move-form',e=>{e.preventDefault();try{move(state.modal.kind,state.modal.id,new FormData(e.currentTarget).get('date'),false,state.modal.occurrence)}catch(err){error(err)}});
 updateEntryUI();
 updateGoalUI();
 for(const c of root.querySelectorAll('.albus-day[role="button"]'))c.addEventListener('keydown',e=>{if(e.target===c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();state.day=c.dataset.date;render()}});
 // Delegação por Pointer Events: funciona com mouse, toque e caneta.
 // Não depende do drag-and-drop HTML nativo, que falha em navegadores móveis.
 let gesture=null;
 const isInteractive=el=>!!el.closest('button,input,select,textarea,a');
 root.querySelectorAll('[data-drag-kind]').forEach(source=>{
   source.addEventListener('pointerdown',ev=>{
     if(ev.button!==0||isInteractive(ev.target))return;
     if(ev.pointerType==='touch'&&!ev.target.closest('.albus-drag-handle,.albus-chip'))return;
     const target=ev.target.closest('[data-drag-kind]');if(target!==source)return;
     gesture={pointerId:ev.pointerId,kind:source.dataset.dragKind,id:source.dataset.dragId,
       occurrence:source.dataset.occurrence||null,startX:ev.clientX,startY:ev.clientY,active:false,source,hover:null};
     try{source.setPointerCapture(ev.pointerId)}catch{}
   });
   source.addEventListener('pointermove',ev=>{
     if(!gesture||gesture.pointerId!==ev.pointerId||gesture.source!==source)return;
     const distance=Math.hypot(ev.clientX-gesture.startX,ev.clientY-gesture.startY);
     if(!gesture.active&&distance<7)return;
     gesture.active=true;source.classList.add('albus-dragging');
     if(ev.cancelable)ev.preventDefault();
     const hit=document.elementFromPoint(ev.clientX,ev.clientY);
     const cell=hit?.closest?.('[data-drop-event],[data-drop-date]')||null;
     if(gesture.hover!==cell){
       gesture.hover?.classList.remove('drop-on');
       cell?.classList.add('drop-on');
       gesture.hover=cell;
     }
   });
   source.addEventListener('pointerup',ev=>{
     if(!gesture||gesture.pointerId!==ev.pointerId||gesture.source!==source)return;
     const current=gesture;gesture=null;
     source.classList.remove('albus-dragging');current.hover?.classList.remove('drop-on');
     const cell=document.elementFromPoint(ev.clientX,ev.clientY)?.closest?.('[data-drop-event],[data-drop-date]');
     if(!current.active||!cell)return;
     ev.stopPropagation();
     try{
       if(cell.dataset.dropEvent){
         if(current.kind!=='entry')return;
         if(db.entries.find(x=>x.id===current.id)?.entry_type!=='expense')return;
         reuseExpense(current.id,cell.dataset.dropDate||state.day,cell.dataset.dropEvent,current.occurrence);
       }else if(cell.dataset.dropDate){
         const source=db.entries.find(x=>x.id===current.id);
         if(current.kind==='entry'&&source?.entry_type==='expense'&&source.event_id)
           reuseExpense(current.id,cell.dataset.dropDate,null,current.occurrence);
         else move(current.kind,current.id,cell.dataset.dropDate,false,current.occurrence);
       }
     }catch(err){state.error=err.message;render();}
   });
   source.addEventListener('pointercancel',()=>{
     if(gesture?.source===source){gesture.hover?.classList.remove('drop-on');source.classList.remove('albus-dragging');gesture=null;}
   });
 });
 // Clicking outside a form does not dismiss it.
}
let dayBefore=today();
function nextDay(){
 const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
 setTimeout(()=>{const current=today();if(current!==dayBefore){const wasSelected=state.day===dayBefore;dayBefore=current;if(!state.modal){if(wasSelected&&state.month===E.monthOf(state.day)){state.day=current;state.month=E.monthOf(current)}render();}}nextDay()},Math.max(1000,next-now));
}
render();nextDay();
G.getDailyCDI().then(data=>{if(data){state.cdi=data;if(!state.modal)render()}}).catch(()=>{});
})();
