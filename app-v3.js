
(function(){
'use strict';
const E=AlbusEngine,A=AlbusAccess,G=AlbusGoals,M=AlbusMoneyMask;
const KEY='albus-calendar-local-v1',root=document.getElementById('app');
const TYPES={event:'Evento',expense:'Despesa',income:'Receita',goal:'Objetivo',task:'Tarefa',reserve:'Aporte / reserva'};
const CATEGORIES=['Salário','Alimentação','Transporte','Saúde','Moradia','Lazer','Educação','Casa','Pessoal','Outros','Precaução'];
const SUGGESTIONS={'Salário':['Salário Rodrigo','Salário Danelle','Salário de'],'Transporte':['Transporte para','Transporte de','Uber para'],'Saúde':['Consulta de','Exame de','Medicamento de'],'Moradia':['Aluguel','Condomínio','Energia','Internet'],'Alimentação':['Supermercado','Restaurante'],'Lazer':['Viagem para','Passeio de']};
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
 return {entries:(Array.isArray(v.entries)?v.entries:[]).filter(x=>E.dateParts(x.entry_date)).map(x=>A.normalizeItem(x)),
 events:(Array.isArray(v.events)?v.events:[]).filter(x=>E.dateParts(x.date)).map(x=>A.normalizeItem(x)),
 goals:(Array.isArray(v.goals)?v.goals:[]).filter(x=>x.id).map(x=>A.normalizeItem(G.ensureGoal(x))),
 overrides:Array.isArray(v.overrides)?v.overrides:[],settings:{...defaults,...v.settings}};
}
const db=load(),state={user:'rodrigo',filter:'all',month:E.monthOf(today()),day:today(),modal:null,createOpen:false,cdi:null,message:'',error:''};
const safe=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch(e){state.error='Não foi possível salvar no armazenamento local.';return false}};
const visible=items=>A.visibleItems(items,state.user,state.filter);
const entries=()=>visible(db.entries), events=()=>visible(db.events),goals=()=>visible(db.goals);
const monthlyRows=(month=state.month,view=db.settings.view)=>E.occurrencesForMonth(entries(),db.overrides,month,db.settings,view);
const summary=()=>E.monthSummary(entries(),db.overrides,state.month,db.settings);
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
 [['event','Evento','Uma ocasião e seus gastos'],['expense','Despesa','Compra, Pix ou cartão'],['income','Receita','Salário ou outra entrada'],['goal','Objetivo','Caixinha de investimentos'],['task','Tarefa','Um compromisso sem valor financeiro']]
 .map(([type,label,desc])=>'<button data-action="create" data-kind="'+type+'"><strong>'+label+'</strong><small>'+desc+'</small></button>').join('')+'</div>':'')+'</div>';
}
function showGoalCard(g){
 const f=G.forecast(g,db.entries,state.cdi,state.month,db.overrides),percent=Math.min(100,Math.max(0,f.progress));
 return '<button class="albus-goal-card" data-action="goal-details" data-id="'+esc(g.id)+'"><span class="albus-goal-label">◈ '+esc(g.title)+'</span>'+
 '<strong>'+mny(f.actual)+'</strong><span class="albus-goal-hint">de '+mny(f.target)+' · '+Math.round(percent)+'%</span>'+
 '<span class="albus-progress"><span style="width:'+percent+'%"></span></span><small>Aporte: '+mny(f.monthly)+'/mês</small></button>';
}
function goalCards(){
 return '<section class="albus-goals"><div class="albus-goals-head"><div><strong>Objetivos</strong><span>Caixinhas com saldo real e projeções separadas</span></div>'+
 button('+ Nova caixinha','create','data-kind="goal"','albus-tiny-button')+'</div><div class="albus-goals-grid">'+
 (goals().map(showGoalCard).join('')||'<button class="albus-goal-placeholder" data-action="create" data-kind="goal">+ Crie um objetivo: casa própria, emergência, viagem...</button>')+
 '</div><div class="albus-cdi-meta">'+(state.cdi?'CDI de referência: '+state.cdi.annualPercent.toFixed(2).replace('.',',')+'% a.a. (estimado), dado '+esc(state.cdi.rateDate||'em cache')+(state.cdi.stale?' · atualização indisponível':''):'CDI automático: aguardando consulta. Você pode informar uma taxa manual.')+'</div></section>';
}
function dashboardCards(){
 const s=summary(),balance=s.valueToAssign,m=monthTitle(state.month);
 const data=[
 ['Receitas de '+m,s.income,'Entradas previstas','income'],
 ['Pagamentos previstos',s.expense,'Pagos: '+mny(s.paid),'expense'],
 ['Reservas e imprevistos',s.reserve+s.provision,'Provisão: '+mny(s.provision),'reserve'],
 [balance<0?'Déficit a cobrir':balance===0?'Orçamento distribuído':'Valor a destinar',Math.abs(balance),'Caixa do mês','balance']
 ];
 return '<section class="albus-summary albus-compact-summary">'+data.map(x=>'<article class="summary-card '+x[3]+'"><div class="summary-kicker">'+esc(x[0])+'</div><div class="summary-value">'+mny(x[1])+'</div><div class="summary-meta">'+esc(x[2])+'</div></article>').join('')+'</section>';
}
function filterLabel(id,label,help){
 return '<div class="albus-filter-label"><label for="'+id+'">'+label+'</label>'+
 '<details class="albus-filter-help"><summary title="Entenda: '+esc(label)+'" aria-label="Explicação de '+esc(label)+'">i</summary>'+
 '<p>'+esc(help)+'</p></details></div>';
}
function filters(){
 const s=db.settings;
 return '<aside class="surface albus-filter-panel"><strong>Filtros</strong><div class="albus-filter-field">'+
 filterLabel('owner-filter','Exibir lançamentos','Escolha visualizar todos os lançamentos acessíveis, somente os compartilhados ou aqueles em que Rodrigo ou Danelle participam. Os valores do resumo também acompanham o filtro.')+
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
   const chips=[...ev.map(x=>({kind:'event',id:x.id,title:x.title})),...dayRows.filter(x=>x.entry_type!=='income'&&(!x.event_id||!ev.some(y=>y.id===x.event_id))).map(x=>({kind:'entry',id:x.id,title:x.title}))];
   out.push('<div role="button" tabindex="0" class="albus-day '+(date===state.day?'selected ':'')+(date===today()?'today':'')+'" data-action="day" data-date="'+date+'" data-drop-date="'+date+'"><span class="albus-day-number">'+d+'</span>'+
    (inc?'<span class="albus-money in">+ '+mny(inc)+'</span>':'')+(exp?'<span class="albus-money out">− '+mny(exp)+'</span>':'')+
    chips.slice(0,2).map(x=>'<span class="albus-chip '+x.kind+'" draggable="true" data-drag-kind="'+x.kind+'" data-drag-id="'+esc(x.id)+'">'+esc(x.title)+'</span>').join('')+
    (chips.length>2?'<span class="albus-overflow">+'+(chips.length-2)+' itens</span>':'')+'</div>');
 }
 return '<article class="surface calendar"><div class="albus-month"><div><h2>'+esc(monthTitle(state.month))+'</h2><div class="albus-small">Selecione o dia. Arraste itens para outra data.</div></div>'+
 '<div class="albus-month-actions">'+button('Hoje','today','','outline-button albus-calendar-today')+button('‹','previous','','icon-button')+button('›','next','','icon-button')+'</div></div>'+
 '<div class="albus-date-grid">'+['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(x=>'<div class="albus-weekday">'+x+'</div>').join('')+out.join('')+
 '</div><div class="albus-calendar-foot"><span>Verde: entradas · Vermelho: pagamentos</span><span>Arraste para reagendar</span></div></article>';
}
function row(x,child=false){
 const due=x.entry_type==='expense'?E.paymentDate(x,db.settings):'',desc=[TYPES[x.entry_type]||'Lançamento',A.responsibleLabel(x),x.visibility==='private'?'Individual':'Família',due&&x.payment_method==='credit'?'Vence '+fmt(due):''].filter(Boolean).join(' · ');
 return '<div class="albus-row" draggable="true" data-drag-kind="entry" data-drag-id="'+esc(x.id)+'"><span class="albus-grip">⠿</span>'+
 '<span class="text"><b>'+esc(x.title)+'</b><div class="caption">'+esc(desc)+'</div></span>'+
 (x.entry_type==='task'?'':'<span class="albus-entry-price '+(x.entry_type==='income'?'in':'')+'">'+mny(x.amount_cents)+'</span>')+
 button('✎','edit-entry','data-id="'+esc(x.id)+'" data-occurrence="'+esc(x.occurrence_date||x.entry_date)+'"','albus-tiny-button ghost')+
 button('↔','move-entry','data-id="'+esc(x.id)+'"','albus-tiny-button ghost')+'</div>';
}
function details(){
 const day=state.day,ev=events().filter(x=>x.date===day),entriesAt=monthlyRows().filter(x=>x.display_date===day),linked=new Set(ev.map(x=>x.id));
 const others=entriesAt.filter(x=>!linked.has(x.event_id));
 let eventHTML=ev.map(x=>{
   const children=entries().filter(y=>y.event_id===x.id);
   return '<div class="albus-event" draggable="true" data-drag-kind="event" data-drag-id="'+esc(x.id)+'"><div class="albus-event-header"><span class="albus-grip">⠿</span><strong class="albus-event-title">'+esc(x.title)+'</strong>'+
   button('✎','edit-event','data-id="'+esc(x.id)+'"','albus-tiny-button ghost')+
   button('↔','move-event','data-id="'+esc(x.id)+'"','albus-tiny-button ghost')+'</div><div class="albus-small">Participantes: '+esc(A.responsibleLabel(x))+'</div>'+
   children.map(y=>row(y,true)).join('')+button('+ Despesa vinculada','add-child','data-id="'+esc(x.id)+'"','albus-tiny-button')+'</div>';
 }).join('');
 return '<aside class="surface details"><div class="albus-detail-heading"><div><div class="details-label">DETALHAMENTO DO DIA</div><h2>'+fmt(day)+'</h2></div></div>'+
 '<div class="day-overview"><div class="overview-card"><span class="small-label">Entradas</span><strong class="positive">'+mny(entriesAt.filter(x=>x.entry_type==='income').reduce((a,x)=>a+Number(x.amount_cents||0),0))+'</strong></div>'+
 '<div class="overview-card"><span class="small-label">Saídas</span><strong class="negative">'+mny(entriesAt.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+Number(x.amount_cents||0),0))+'</strong></div></div>'+
 '<div class="albus-details-create">'+createMenu()+'</div>'+
 '<div class="albus-detail-section"><h3>Eventos · '+ev.length+'</h3>'+(eventHTML||'<div class="albus-details-empty">Nenhum evento neste dia.</div>')+'</div>'+
 '<div class="albus-detail-section"><h3>Lançamentos · '+others.length+'</h3>'+(others.map(x=>row(x)).join('')||'<div class="albus-details-empty">Nenhum lançamento neste dia.</div>')+'</div>'+
 '<p class="albus-help">Crie itens para a data selecionada ou arraste eventos e despesas para reorganizar o mês.</p></aside>';
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
 return modal(old?'Editar evento':'Criar evento','<form id="event-form"><div class="field"><label>Nome</label><input name="title" required maxlength="100" value="'+esc(old?.title||'')+'"/></div>'+
 '<div class="field"><label>Data do evento</label><input name="date" type="date" required value="'+(old?.date||m.date||state.day)+'"/></div>'+
 ownerInputs(old)+'<div class="field"><label>Observações</label><textarea name="notes">'+esc(old?.notes||'')+'</textarea></div>'+
 '<div class="form-footer">'+(old?button('Excluir','delete-event','data-id="'+esc(old.id)+'"','text-button danger'):'<span></span>')+'<div>'+button('Cancelar','close','','secondary-button')+
 ' <button type="submit" class="primary-button">Salvar evento</button></div></div></form>');
}
function goalForm(m){
 const old=db.goals.find(x=>x.id===m.id)||{};
 return modal(m.id?'Editar objetivo':'Criar caixinha',
 '<form id="goal-form"><div class="field"><label>Nome do objetivo</label><input name="title" maxlength="100" required value="'+esc(old.title||'')+'" placeholder="Casa própria, viagem, reserva de emergência"/></div>'+
 '<div class="field-row"><div class="field"><label>Meta total (R$)</label>'+moneyInput('target',old.target_cents||0,'required')+'</div>'+
 '<div class="field"><label>Saldo inicial real (R$)</label>'+moneyInput('initial',old.initial_cents||0)+'</div></div>'+
 '<div class="field-row"><div class="field"><label>Aporte mensal pretendido (R$)</label>'+moneyInput('monthly',old.monthly_cents||0)+'</div>'+
 '<div class="field"><label>% do CDI</label><input name="cdi_percent" type="number" min="0" max="300" step=".1" required value="'+(old.cdi_percent??100)+'"/></div></div>'+
 '<div class="field"><label>CDI anual manual (%) para contingência</label><input name="manual_cdi_annual" type="number" min="0" max="100" step=".01" value="'+(old.manual_cdi_annual??'')+'" placeholder="Opcional, se a consulta falhar"/></div>'+
 ownerInputs(m.id?old:null)+
 '<div class="albus-warning">Saldo real é dinheiro cadastrado como disponível ou aportado. Rendimento pelo CDI é apenas projeção, não retorno garantido. Não considera impostos, taxas nem oscilações futuras.</div>'+
 '<div class="form-footer">'+(m.id?button('Excluir caixinha','delete-goal','data-id="'+esc(m.id)+'"','text-button danger'):'<span></span>')+'<div>'+button('Cancelar','close','','secondary-button')+
 ' <button type="submit" class="primary-button">Salvar</button></div></div></form>');
}
function goalDetails(m){
 const goal=db.goals.find(x=>x.id===m.id);if(!goal)return '';
 const f=G.forecast(goal,db.entries,state.cdi,state.month);
 return modal(goal.title,'<div class="albus-goal-modal-total"><span>Saldo real</span><strong>'+mny(f.actual)+'</strong><small>Meta: '+mny(f.target)+' · '+Math.round(f.progress)+'% concluído</small></div>'+
 '<div class="albus-progress"><span style="width:'+f.progress+'%"></span></div>'+
 '<div class="albus-goal-stats"><p>Aporte mensal planejado: <b>'+mny(f.monthly)+'</b></p><p>Remuneração de referência: <b>'+goal.cdi_percent+'% do CDI</b></p>'+
 '<p>Conclusão estimada: <b>'+(f.estimatedMonth?monthTitle(f.estimatedMonth):'Indefinida')+'</b></p></div>'+
 '<p class="albus-small">A projeção não acrescenta rendimentos estimados ao saldo real. Valores não incluem tributação ou custos.</p>'+
 '<div class="form-footer">'+button('Editar','edit-goal','data-id="'+esc(goal.id)+'"','secondary-button')+button('+ Registrar aporte','add-contribution','data-id="'+esc(goal.id)+'"','primary-button')+'</div>');
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
 '<p class="albus-small">Mover evento desloca todas as suas despesas vinculadas. Mover lançamento altera somente esse lançamento.</p>'+
 '<div class="form-footer">'+button('Cancelar','close','','secondary-button')+' <button type="submit" class="primary-button">Mover</button></div></form>');
}
function render(){
 const s=summary();
 root.innerHTML='<div class="albus-shell"><header class="albus-top"><div class="albus-brand"><span class="brand-icon">♥</span>albus<span class="brand-dot">.</span></div>'+
 '<div class="albus-top-center">Calendário e planejamento da família</div><div class="albus-top-right">Perfil de teste <select id="demo-user">'+
 options(MEMBER.map(x=>[x.id,x.name]),state.user)+'</select><span class="albus-family-pill">Família</span></div></header>'+
 '<main class="albus-main"><div class="albus-title-row albus-compact-head"><div><div class="albus-eyebrow">CALENDÁRIO · '+esc(monthTitle(state.month))+'</div>'+
 '<h1>Seu calendário.</h1></div></div>'+
 '<div class="albus-note">Ambiente de testes: Rodrigo e Danelle são perfis simulados. Os dados ainda ficam neste navegador, sem login real ou sincronização.</div>'+
 (state.error?'<div class="error">'+esc(state.error)+'</div>':'')+(state.message?'<div class="success">'+esc(state.message)+'</div>':'')+
 dashboardCards()+goalCards()+
 '<section class="albus-dashboard albus-dashboard-three">'+filters()+calendar()+details()+'</section>'+
 '<div class="albus-footer"><b>Entenda o mês:</b> receitas previstas financiam pagamentos com vencimento neste mês, inclusive faturas de compras anteriores. Compras no cartão para meses futuros: '+mny(s.futureCard)+'. Sem duplicidade.</div>'+
 '</main>'+(
 state.modal?.type==='entry'?entryForm(state.modal):
 state.modal?.type==='event'?eventForm(state.modal):
 state.modal?.type==='goal'?goalForm(state.modal):
 state.modal?.type==='goal-details'?goalDetails(state.modal):
 state.modal?.type==='contribution'?contributionForm(state.modal):
 state.modal?.type==='settings'?settingsForm():
 state.modal?.type==='move'?moveForm(state.modal):''
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
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),old=db.events.find(x=>x.id===state.modal.id),date=String(f.get('date')||''),title=String(f.get('title')||'').trim();
 if(!title||!E.dateParts(date))throw Error('Informe título e data válidos.');
 const ownership=owners(f,old);
 if(old){if(old.date!==date&&!move('event',old.id,date,true))return;Object.assign(old,{title,date,notes:String(f.get('notes')||''),...ownership});}
 else db.events.push({id:id(),title,date,notes:String(f.get('notes')||''),...ownership});
 state.day=date;state.month=E.monthOf(date);state.modal=null;state.message='Evento salvo.';safe();render();
 }catch(e){error(e)}
}
function submitGoal(ev){
 ev.preventDefault();try{
 const f=new FormData(ev.currentTarget),old=db.goals.find(x=>x.id===state.modal.id),title=String(f.get('title')||'').trim(),target=E.parseMoney(f.get('target'));
 if(!title||!target)throw Error('Informe nome e meta maior que zero.');
 const percent=Number(f.get('cdi_percent')),manual=String(f.get('manual_cdi_annual')||'');
 if(!Number.isFinite(percent)||percent<0||percent>300)throw Error('Percentual do CDI inválido.');
 if(manual!==''&&(!Number.isFinite(Number(manual))||Number(manual)<0||Number(manual)>100))throw Error('Taxa manual inválida.');
 const value={...owners(f,old),title,target_cents:target,initial_cents:E.parseMoney(f.get('initial')),monthly_cents:E.parseMoney(f.get('monthly')),cdi_percent:percent,manual_cdi_annual:manual===''?null:Number(manual)};
 if(old)Object.assign(old,value);else db.goals.push({id:id(),...value});
 state.modal=null;state.message='Caixinha salva. Registre um aporte para incrementar o saldo real.';safe();render();
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
function move(kind,itemId,to,silent=false){
 if(!E.dateParts(to))throw Error('Data inválida.');
 const target=kind==='event'?db.events.find(x=>x.id===itemId):db.entries.find(x=>x.id===itemId);
 if(!target)return false;
 if(kind==='event'&&db.entries.some(x=>x.event_id===itemId&&['paid','received','set_aside'].includes(x.status))&&!confirm('O evento possui despesas já efetivadas. Alterar datas históricas?'))return false;
 if(kind==='entry'&&['paid','received','set_aside'].includes(target.status)&&!confirm('Este lançamento foi efetivado. Alterar sua data histórica?'))return false;
 const next=E.moveItem(db,kind,itemId,to);db.entries=next.entries;db.events=next.events;state.day=to;state.month=E.monthOf(to);
 if(!silent){state.modal=null;state.message='Data atualizada.';safe();render();}
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
function bind(){
 root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',event=>{
  const action=el.dataset.action,item=el.dataset.id,kind=el.dataset.kind;
  if(action==='day'){state.day=el.dataset.date;state.message='';return render()}
  if(action==='previous'||action==='next'){state.month=E.addMonths(state.month,action==='previous'?-1:1);state.day=E.dateInMonth(state.month,Number(state.day.slice(-2)));return render()}
  if(action==='today'){state.month=E.monthOf(today());state.day=today();return render()}
  if(action==='toggle-create'){state.createOpen=!state.createOpen;return render()}
  if(action==='create'){return open(kind==='goal'?'goal':kind==='event'?'event':'entry',{kind,date:state.day})}
  if(action==='close'){state.modal=null;state.error='';return render()}
  if(action==='settings')return open('settings');
  if(action==='goal-details')return open('goal-details',{id:item});
  if(action==='edit-goal')return open('goal',{id:item});
  if(action==='add-contribution')return open('contribution',{id:item});
  if(action==='edit-entry')return open('entry',{id:item,occurrence:el.dataset.occurrence||state.day});
  if(action==='edit-event')return open('event',{id:item});
  if(action==='add-child'){const e=db.events.find(x=>x.id===item);return open('entry',{kind:'expense',eventId:item,date:e?.date||state.day})}
  if(action==='move-entry')return open('move',{kind:'entry',id:item});
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
 root.querySelectorAll('input[data-money="true"]').forEach(M.bind);
 const listen=(id,fn)=>root.querySelector(id)?.addEventListener('change',fn);
 listen('#demo-user',e=>{state.user=e.target.value;state.filter='all';render()});
 listen('#owner-filter',e=>{state.filter=e.target.value;render()});
 listen('#payment-profile',e=>{db.settings.profile=e.target.value;safe();if(db.settings.profile==='credit'&&!db.settings.cardConfigured)return open('settings');render()});
 listen('#calendar-view',e=>{db.settings.view=e.target.value;safe();render()});
 listen('#entry-type',updateEntryUI);listen('#entry-category',updateEntryUI);listen('#payment-method',updateEntryUI);listen('#entry-frequency',updateEntryUI);listen('#entry-date',updateEntryUI);
 listen('#visibility',e=>{const inputs=root.querySelectorAll('input[name="responsible_ids"]');inputs.forEach(i=>{if(e.target.value==='private'){i.checked=i.value===state.user;i.disabled=i.value!==state.user}else i.disabled=false;});const all=root.querySelector('#all-members');if(all)all.disabled=e.target.value==='private';});
 listen('#all-members',e=>{root.querySelectorAll('input[name="responsible_ids"]').forEach(i=>{if(!i.disabled)i.checked=e.target.checked})});
 for(const field of root.querySelectorAll('input[name="responsible_ids"]'))field.addEventListener('change',()=>{const all=root.querySelector('#all-members');if(all)all.checked=[...root.querySelectorAll('input[name="responsible_ids"]')].every(x=>x.checked)});
 const formBind=(name,fn)=>root.querySelector(name)?.addEventListener('submit',fn);
 formBind('#entry-form',submitEntry);formBind('#event-form',submitEvent);formBind('#goal-form',submitGoal);formBind('#contribution-form',submitContribution);formBind('#settings-form',submitSettings);
 formBind('#move-form',e=>{e.preventDefault();try{move(state.modal.kind,state.modal.id,new FormData(e.currentTarget).get('date'))}catch(err){error(err)}});
 updateEntryUI();
 for(const c of root.querySelectorAll('.albus-day[role="button"]'))c.addEventListener('keydown',e=>{if(e.target===c&&(e.key==='Enter'||e.key===' ')){e.preventDefault();state.day=c.dataset.date;render()}});
 root.querySelectorAll('[data-drag-kind]').forEach(el=>el.addEventListener('dragstart',e=>{e.stopPropagation();e.dataTransfer.setData('text/plain',JSON.stringify({kind:el.dataset.dragKind,id:el.dataset.dragId}));e.dataTransfer.effectAllowed='move'}));
 root.querySelectorAll('[data-drop-date]').forEach(el=>{el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drop-on')});el.addEventListener('dragleave',()=>el.classList.remove('drop-on'));el.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();el.classList.remove('drop-on');try{let x=JSON.parse(e.dataTransfer.getData('text/plain'));if(['entry','event'].includes(x.kind))move(x.kind,x.id,el.dataset.dropDate)}catch(err){error(err)}})});
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
