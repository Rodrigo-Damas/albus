(function albusApplication() {
  'use strict';
  const E = AlbusEngine;
  const A = AlbusAccess;
  const KEY = 'albus-calendar-local-v1';
  const root = document.getElementById('app');
  const defaults = {profile:'same',view:'cash',closingDay:25,dueDay:5,cardConfigured:false,variationPercent:10,provisionPercent:10,provisionFixedCents:0};
  const types = {expense:'Despesa',income:'Receita',reserve:'Reserva',task:'Tarefa'};
  const statusOptions = {expense:[['planned','Planejada'],['paid','Paga']],income:[['planned','Prevista'],['received','Recebida']],reserve:[['planned','Planejada'],['set_aside','Separada']],task:[['pending','Pendente'],['done','Concluída']]};
  const categories=['Alimentação','Casa','Educação','Lazer','Moradia','Outros','Pessoal','Precaução','Presente','Salário','Saúde','Transporte'];
  const suggestions={
    'Salário':['Salário Rodrigo','Salário Danielle','Salário de'],
    'Transporte':['Transporte para','Transporte de','Uber para','Passagem para'],
    'Saúde':['Consulta de','Exame de','Medicamento de'],
    'Moradia':['Aluguel','Condomínio','Conta de energia','Conta de água','Internet'],
    'Alimentação':['Supermercado','Restaurante','Almoço de'],
    'Educação':['Curso de','Mensalidade de'],
    'Lazer':['Passeio para','Viagem para']
  };
  const paymentMethods=[['pix','Pix / transferência'],['debit','Débito'],['cash','Dinheiro'],['credit','Cartão de crédito']];
  const icons={
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    left:'<path d="m15 18-6-6 6-6"/>',
    right:'<path d="m9 18 6-6-6-6"/>',
    close:'<path d="M18 6 6 18M6 6l12 12"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
    credit:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
    gift:'<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18M12 9s-7 0-7-4c0-3 5-3 7 4Zm0 0s7 0 7-4c0-3-5-3-7 4Z"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
    edit:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    move:'<path d="M8 3 4 7l4 4M4 7h15M16 21l4-4-4-4m0 4H5"/>',
    trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>'
  };
  const icon = name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg>`;
  const esc = value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const id =()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`a-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function monthLabel(month){const [y,m]=month.split('-').map(Number);const text=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));return text[0].toUpperCase()+text.slice(1);}
  function friendlyDate(date){const [y,m,d]=date.split('-').map(Number);const x=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(y,m-1,d));return x[0].toUpperCase()+x.slice(1);}
  function shortMoney(cents){const n=Math.round(cents/100);return Math.abs(n)>=10000?`R$ ${(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`:`R$ ${n.toLocaleString('pt-BR')}`;}
  const options=(pairs,selected)=>pairs.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');
  function readLocal(){
    let parsed={};
    try {parsed=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{parsed={};}
    const entries=Array.isArray(parsed.entries)?parsed.entries.filter(x=>x&&x.id&&E.dateParts(x.entry_date)).map(x=>A.normalizeItem({...x,payment_method:x.payment_method||'pix',variable:x.variable!==false})):[]; 
    const events=Array.isArray(parsed.events)?parsed.events.filter(x=>x&&x.id&&E.dateParts(x.date)).map(A.normalizeItem):[];
    const overrides=Array.isArray(parsed.overrides)?parsed.overrides:[];
    const settings={...defaults,...(parsed.settings||{})};
    return {entries,events,overrides,settings};
  }
  const store=readLocal();
  const state={month:E.monthOf(todayISO()),selected:todayISO(),modal:null,notice:'',error:'',user:'rodrigo',ownerFilter:'all'};
  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(store));return true;}
    catch(error){state.error='Não foi possível salvar neste navegador. Verifique armazenamento disponível e modo privado.';return false;}
  }
  const visibleEntries=()=>A.visibleItems(store.entries,state.user,state.ownerFilter);
  const visibleEvents=()=>A.visibleItems(store.events,state.user,state.ownerFilter);
  const entriesInMonth=(view=store.settings.view)=>E.occurrencesForMonth(visibleEntries(),store.overrides,state.month,store.settings,view);
  const selectedRows=()=>entriesInMonth().filter(x=>x.display_date===state.selected);
  const sumMonth=()=>E.monthSummary(visibleEntries(),store.overrides,state.month,store.settings);
  function ownerFields(item) {
    const user=state.user;
    const responsible=A.normalizedIds(item?.responsible_ids||[user]);
    const visibility=item?.visibility||'shared';
    return `<div class="albus-owner-fields">
      <div class="field"><label>Responsáveis</label>
      <div class="albus-member-options">${A.DEFAULT_MEMBERS.map(m=>`<label class="albus-member-choice"><input type="checkbox" name="responsible_ids" value="${m.id}" ${responsible.includes(m.id)?'checked':''}/> ${esc(m.name)}</label>`).join('')}</div>
      </div>
      <div class="field"><label>Quem pode visualizar?</label><select name="visibility" id="item-visibility">${options([['shared','Compartilhado com a família'],['private','Individual (somente o criador)']],visibility)}</select>
      <small>Itens individuais não aparecem para o outro membro neste teste. No aplicativo definitivo, isso dependerá de autenticação e regras de acesso ao banco.</small></div>
    </div>`;
  }
  function ownerCaption(item) {
    return `Responsável: ${A.responsibleLabel(item)} · ${item.visibility==='private'?'Individual':'Família'}`;
  }
  function ownershipFromForm(form,old) {
    const visibility=String(form.get('visibility')||'shared');
    const creator=old?.created_by&&old.created_by!=='legacy'?old.created_by:state.user;
    const selected=form.getAll('responsible_ids').map(String);
    const values=A.validateOwnership({creatorId:creator,responsibleIds:selected,visibility});
    return {...values,created_by:creator,workspace_id:A.WORKSPACE_ID};
  }
  function card(kind,label,value,caption,extra=''){
    return `<article class="summary-card ${kind} ${extra}"><div class="summary-kicker">${esc(label)}</div><div class="summary-value">${E.money(value)}</div><div class="summary-meta">${esc(caption)}</div></article>`;
  }
  function render(){
    const monthData=sumMonth(),s=store.settings, month=monthLabel(state.month);
    const today=todayISO(),budget=monthData.valueToAssign,profileIsCredit=s.profile==='credit';
    root.innerHTML=`<div class="albus-shell">
      <header class="albus-top">
        <div class="albus-brand"><span class="brand-icon">♥</span>albus<span class="brand-dot">.</span></div>
        <div class="albus-top-center">Calendário e planejamento financeiro</div>
        <div class="albus-top-right">${icon('users')} <label for="demo-user">Usuário em teste</label><select id="demo-user" aria-label="Usuário em teste">${options(A.DEFAULT_MEMBERS.map(m=>[m.id,m.name]),state.user)}</select><span class="albus-family-pill">Família</span></div>
      </header>
      <main class="albus-main">
        <div class="albus-title-row"><div><div class="albus-eyebrow">CALENDÁRIO · ${esc(month)}</div>
          <h1>Seu mês, mais leve.</h1><p class="albus-subtitle">Organize compromissos, compras e pagamentos no mesmo lugar.</p></div>
          <div class="albus-actions">
            <button class="outline-button" data-action="today">${icon('calendar')} Hoje</button>
            <button class="outline-button" data-action="settings">${icon('settings')} Configurar</button>
            <button class="primary-button" data-action="new-event">${icon('plus')} Evento</button>
            <button class="primary-button" data-action="new-entry" data-type="expense">${icon('plus')} Despesa</button>
            <button class="outline-button" data-action="new-entry" data-type="income">${icon('plus')} Receita</button>
          </div>
        </div>
        <div class="albus-note">${icon('info')} <span><b>Ambiente de teste familiar:</b> alterne entre Rodrigo e Danielle para simular os dois perfis. Os dados e os filtros são locais a este navegador. <b>Não há login, isolamento de dados real, sincronização nem backup em nuvem.</b></span></div>
        ${state.error?`<div class="error">${esc(state.error)}</div>`:''}
        ${state.notice?`<div class="success">${esc(state.notice)}</div>`:''}
        <section class="albus-settings-row" aria-label="Preferências financeiras">
          <div class="setting albus-owner-filter">
            <label for="owner-filter">Exibir lançamentos</label>
            <select id="owner-filter">${options([['all','Tudo que posso visualizar'],['shared','Compartilhados com a família'],...A.DEFAULT_MEMBERS.map(m=>[m.id,`Responsável: ${m.name}`])],state.ownerFilter)}</select>
            <small>Os indicadores refletem o filtro selecionado.</small>
          </div>
          <div class="setting">
            <label for="payment-profile">Como você costuma pagar suas compras?</label>
            <select id="payment-profile">${options([['same','No próprio mês (Pix, débito, dinheiro)'],['credit','No cartão, com pagamento posterior']],s.profile)}</select>
            <small>Define o padrão de novos gastos, sem alterar os já cadastrados.</small>
          </div>
          <div class="setting">
            <label for="calendar-view">No calendário, mostrar despesas por</label>
            <select id="calendar-view">${options([['cash','Data do pagamento'],['purchase','Data da compra']],s.view)}</select>
            <small>O orçamento mensal sempre considera os pagamentos que vencem no mês.</small>
          </div>
          <button class="secondary-button setting-button" data-action="settings">${icon('credit')} ${profileIsCredit&&s.cardConfigured?`Fecha ${s.closingDay} · Vence ${s.dueDay}`:'Configurar cartão e imprevistos'}</button>
        </section>
        <section class="albus-summary" aria-label="Resumo do mês">
          ${card('income',`Receitas previstas em ${month}`,monthData.income,'Entradas destinadas aos pagamentos do mês')}
          ${card('expense','Pagamentos previstos',monthData.expense,`${E.money(monthData.paid)} pagos · faixa ± ${E.money(monthData.variation)}`)}
          ${card('reserve','Reservas e imprevistos',monthData.reserve+monthData.provision,`Provisão automática ${E.money(monthData.provision)}`)}
          ${card('balance',budget<0?'Déficit a cobrir':budget===0?'Orçamento distribuído':'Valor a destinar',Math.abs(budget),budget<0?'Faltam recursos para compromissos':budget===0?'Toda receita já recebeu uma finalidade':'Ainda precisa de uma finalidade',budget<0?'negative':budget===0?'zero':'')}
        </section>
        <section class="albus-education" aria-live="polite">
          <p><strong>Como ler ${esc(month)}:</strong> as receitas previstas neste mês financiam os pagamentos que vencem neste mês, inclusive faturas de compras anteriores. 
          ${monthData.previousCard?`<strong>${E.money(monthData.previousCard)}</strong> em compras de meses anteriores vencem agora.`:'Não há compras anteriores registradas vencendo agora.'}
          Compras feitas neste mês: <strong>${E.money(monthData.newPurchases)}</strong>;
          em cartão para faturas futuras: <strong>${E.money(monthData.futureCard)}</strong>. A fatura não é somada duas vezes.</p>
          <span class="pill">Visão de caixa</span>
        </section>
        <section class="albus-dashboard">
          ${renderCalendar(today)}
          ${renderDetails()}
        </section>
        <p class="albus-footer">Cenário de variação: ${s.variationPercent}% das despesas variáveis ainda não pagas. A provisão de imprevistos (${s.provisionPercent}% + valor fixo, quando definido) é separada das reservas manuais. Pontos e cashback não são receita até se tornarem dinheiro disponível.</p>
      </main>
      ${renderModal()}
    </div>`;
    bindActions();
  }
  function renderCalendar(today){
    const [year,month]=state.month.split('-').map(Number);
    const first=new Date(year,month-1,1).getDay(),count=E.daysInMonth(state.month);
    const cells=Math.ceil((first+count)/7)*7, rows=entriesInMonth();
    let result='';
    for(let i=0;i<cells;i++){
      const d=i-first+1;
      if(d<1||d>count){result+='<div class="albus-day outside" aria-hidden="true"></div>';continue;}
      const date=`${state.month}-${String(d).padStart(2,'0')}`;
      const todayRows=rows.filter(x=>x.display_date===date),todaysEvents=visibleEvents().filter(x=>x.date===date);
      const income=todayRows.filter(x=>x.entry_type==='income').reduce((a,x)=>a+(Number(x.amount_cents)||0),0);
      const expense=todayRows.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+(Number(x.amount_cents)||0),0);
      const chips=[
        ...todaysEvents.map(x=>({kind:'event',id:x.id,title:x.title})),
        ...todayRows.filter(x=>x.entry_type==='expense'&&!todaysEvents.some(e=>e.id===x.event_id)).map(x=>({kind:'entry',id:x.id,title:x.title}))
      ];
      result+=`<div role="button" tabindex="0" class="albus-day ${date===state.selected?'selected':''} ${date===today?'today':''}" data-action="select-day" data-date="${date}" data-drop-date="${date}" aria-label="${d} de ${monthLabel(state.month)}, ${chips.length} itens">
        <span class="albus-day-number">${d}</span>
        ${income?`<span class="albus-money in">+ ${shortMoney(income)}</span>`:''}
        ${expense?`<span class="albus-money out">− ${shortMoney(expense)}</span>`:''}
        ${chips.slice(0,2).map(x=>`<span draggable="true" data-drag-kind="${x.kind}" data-drag-id="${esc(x.id)}" class="albus-chip ${x.kind}" title="Arraste para mudar de dia: ${esc(x.title)}">${x.kind==='event'?'◆ ':''}${esc(x.title)}</span>`).join('')}
        ${chips.length>2?`<span class="albus-overflow">+${chips.length-2} itens</span>`:''}
      </div>`;
    }
    return `<article class="surface calendar">
      <div class="albus-month"><div><h2>${esc(monthLabel(state.month))}</h2><div class="albus-small">Clique no dia para selecionar; arraste eventos ou despesas para reagendar.</div></div>
        <div class="month-navigation"><button class="icon-button" data-action="previous" aria-label="Mês anterior">${icon('left')}</button><button class="icon-button" data-action="next" aria-label="Próximo mês">${icon('right')}</button></div></div>
      <div class="albus-date-grid">${['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(x=>`<span class="albus-weekday">${x}</span>`).join('')}${result}</div>
      <div class="albus-calendar-foot"><span>Verde: receita · Vermelho: despesa · ◆: evento</span><span>Arraste para outro dia</span></div>
    </article>`;
  }
  function renderEvent(event){
    const child=visibleEntries().filter(x=>x.event_id===event.id);
    const total=child.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+(Number(x.amount_cents)||0),0);
    return `<div class="albus-event" data-drag-kind="event" data-drag-id="${esc(event.id)}" draggable="true">
      <div class="albus-event-header"><span class="albus-grip">${icon('grip')}</span><span class="albus-event-title">${icon('gift')} ${esc(event.title)}</span>
        <span class="albus-entry-price">${E.money(total)}</span>
        <button type="button" class="albus-tiny-button ghost" data-action="edit-event" data-id="${esc(event.id)}" title="Editar evento">${icon('edit')}</button>
        <button type="button" class="albus-tiny-button ghost" data-action="move-event" data-id="${esc(event.id)}" title="Mover evento">${icon('move')}</button>
      </div>
      <div class="albus-small">${esc(ownerCaption(event))}</div>
      ${event.notes?`<div class="albus-small">${esc(event.notes)}</div>`:''}
      ${child.map(x=>renderEntryRow(x,true)).join('')}
      <div style="margin-top:8px"><button class="albus-tiny-button" data-action="add-child" data-id="${esc(event.id)}">${icon('plus')} Adicionar despesa ao evento</button></div>
    </div>`;
  }
  function renderEntryRow(entry,child=false,occurrence=null){
    const isExpense=entry.entry_type==='expense';
    const d=occurrence||entry;
    const credit=isExpense&&entry.payment_method==='credit';
    const paidOn=isExpense?E.paymentDate({...entry,occurrence_date:d.occurrence_date||entry.entry_date},store.settings):'';
    const link=store.events.find(x=>x.id===entry.event_id);
    const caption=[types[entry.entry_type]||'Lançamento',entry.category,ownerCaption(entry),credit?`Cartão · paga em ${paidOn.split('-').reverse().join('/')}`:'',child?`Compra ${entry.entry_date.split('-').reverse().join('/')}`:link?`Evento: ${link.title}`:''].filter(Boolean).join(' · ');
    return `<div class="albus-row" draggable="true" data-drag-kind="entry" data-drag-id="${esc(entry.id)}">
      <span class="albus-grip" title="Arrastar lançamento">${icon('grip')}</span>
      <span class="text"><b>${esc(entry.title)}</b><div class="caption">${esc(caption)}</div></span>
      ${entry.entry_type==='task'?'':`<span class="albus-entry-price ${entry.entry_type==='income'?'in':''}">${E.money(entry.amount_cents)}</span>`}
      <button type="button" class="albus-tiny-button ghost" data-action="edit-entry" data-id="${esc(entry.id)}" aria-label="Editar ${esc(entry.title)}">${icon('edit')}</button>
      <button type="button" class="albus-tiny-button ghost" data-action="move-entry" data-id="${esc(entry.id)}" aria-label="Mover ${esc(entry.title)}">${icon('move')}</button>
    </div>`;
  }
  function renderDetails(){
    const events=visibleEvents().filter(x=>x.date===state.selected);
    const rows=selectedRows(),linked=new Set(events.map(x=>x.id));
    const entryRows=rows.filter(x=>!x.event_id||!linked.has(x.event_id));
    const dayCash=rows.filter(x=>x.entry_type==='expense').reduce((a,x)=>a+(Number(x.amount_cents)||0),0);
    const dayIncome=rows.filter(x=>x.entry_type==='income').reduce((a,x)=>a+(Number(x.amount_cents)||0),0);
    return `<aside class="surface details">
      <div class="albus-detail-heading"><div><div class="details-label">DETALHAMENTO DO DIA</div><h2>${esc(friendlyDate(state.selected))}</h2>
        <div class="albus-small">${store.settings.view==='cash'?'Despesas por pagamento':'Despesas por compra'}</div></div>
        <button type="button" class="circle-plus" data-action="new-entry" data-type="income" title="Adicionar receita, reserva ou tarefa">${icon('plus')}</button>
      </div>
      <div class="day-overview"><div class="overview-card"><span class="small-label">Entradas</span><strong class="positive">${E.money(dayIncome)}</strong></div>
        <div class="overview-card"><span class="small-label">Saídas</span><strong class="negative">${E.money(dayCash)}</strong></div></div>
      <div class="albus-day-actions">
        <div><button class="outline-button wide" data-action="new-event">${icon('calendar')} Adicionar evento</button><small>Reúne várias despesas.</small></div>
        <div><button class="primary-button wide" data-action="new-entry" data-type="expense">${icon('credit')} Adicionar despesa</button><small>Gasto independente ou vinculado.</small></div>
        <div><button class="outline-button wide" data-action="new-entry" data-type="income">${icon('plus')} Adicionar receita</button><small>Entradas pessoais ou familiares.</small></div>
      </div>
      <div class="albus-detail-section"><h3>Eventos do dia · ${events.length}</h3>
        ${events.map(renderEvent).join('')||'<div class="albus-details-empty">Nenhum evento para esta data.</div>'}</div>
      <div class="albus-detail-section"><h3>Lançamentos do dia · ${entryRows.length}</h3>
        ${entryRows.map(x=>renderEntryRow(x.entry_type==='expense'&&x.is_recurring?{...x,entry_date:x.occurrence_date}:x,false,x)).join('')||'<div class="albus-details-empty">Nenhum lançamento nesta data.</div>'}</div>
      <button class="outline-button wide" data-action="new-entry" data-type="income" style="margin-top:17px">${icon('plus')} Receita, reserva ou tarefa</button>
      <p class="albus-help">Arraste a alça de um evento ou despesa para qualquer dia do calendário. Arrastar o evento move também todas as despesas vinculadas. Para telas sensíveis ao toque, use o botão de mover.</p>
    </aside>`;
  }
  function renderModal(){
    const m=state.modal;if(!m)return '';
    if(m.kind==='settings')return renderSettingsModal(m);
    if(m.kind==='move')return `<div class="albus-modal-backdrop"><section class="albus-modal" role="dialog" aria-modal="true" aria-label="Mover lançamento">
      <div class="modal-header"><h2>Alterar a data</h2><button class="close-btn" data-action="close">${icon('close')}</button></div>
      <form id="move-form"><div class="field"><label>Nova data</label><input name="date" type="date" required value="${esc(m.date)}"/></div>
        <div class="notice">${m.itemKind==='event'?'O evento e todas as suas despesas vinculadas mudarão juntos.':'Somente este lançamento será movido. O vínculo com um evento, se existir, será mantido.'}</div>
        <div class="form-footer"><span></span><div><button type="button" class="secondary-button" data-action="close">Cancelar</button> <button class="primary-button" type="submit">Mover</button></div></div></form></section></div>`;
    if(m.kind==='event'){
      const e=store.events.find(x=>x.id===m.id);
      return `<div class="albus-modal-backdrop"><section class="albus-modal" role="dialog" aria-modal="true" aria-label="Cadastro de evento">
        <div class="modal-header"><h2>${e?'Editar evento':'Adicionar evento'}</h2><button class="close-btn" data-action="close" aria-label="Fechar">${icon('close')}</button></div>
        <div class="notice">Um evento organiza um compromisso e pode conter várias despesas. Seu custo será a soma delas, sem contagem duplicada.</div>
        <form id="event-form">
          <div class="field"><label>Nome do evento</label><input name="title" maxlength="100" required placeholder="Ex.: Aniversário de família" value="${esc(e?.title||'')}"/></div>
          <div class="field"><label>Data do evento</label><input name="date" type="date" required value="${esc(e?.date||m.date||state.selected)}"/></div>
          <div class="field"><label>Observações</label><textarea name="notes" maxlength="1000">${esc(e?.notes||'')}</textarea></div>
          ${ownerFields(e)}
          <div class="form-footer">${e?`<button class="text-button danger" type="button" data-action="delete-event" data-id="${esc(e.id)}">Excluir</button>`:'<span></span>'}
          <div><button class="secondary-button" type="button" data-action="close">Cancelar</button> <button class="primary-button" type="submit">Salvar evento</button></div></div>
        </form></section></div>`;
    }
    if(m.kind==='entry')return renderEntryForm(m);
    return '';
  }
  function renderEntryForm(m){
    const e=store.entries.find(x=>x.id===m.id);
    const kind=e?.entry_type||m.type||'expense';
    const val=e?.amount_cents??0;
    const method=e?.payment_method||(store.settings.profile==='credit'?'credit':'pix');
    const eventsPairs=[['','Sem vínculo com evento'],...visibleEvents().map(x=>[x.id,`${x.title} (${x.date.split('-').reverse().join('/')})`])];
    return `<div class="albus-modal-backdrop"><section class="albus-modal" role="dialog" aria-modal="true" aria-label="Cadastro financeiro">
      <div class="modal-header"><h2>${e?'Editar lançamento':'Novo lançamento'}</h2><button class="close-btn" data-action="close" aria-label="Fechar">${icon('close')}</button></div>
      <form id="entry-form">
        <div class="field"><label>Título</label><input id="entry-title" name="title" required maxlength="100" placeholder="Ex.: Presente, conta de luz, salário" value="${esc(e?.title||'')}"/>
        <div id="title-suggestions" class="albus-suggestions" aria-label="Sugestões opcionais de título"></div></div>
        <div class="field-row">
          <div class="field"><label>Tipo</label><select name="entry_type" id="entry-type">${options(Object.entries(types).map(([k,v])=>[k,v]),kind)}</select></div>
          <div class="field"><label>Data ${kind==='expense'?'da compra':''}</label><input name="entry_date" id="entry-date" type="date" required value="${esc(e?.entry_date||m.date||state.selected)}"/></div>
        </div>
        <div class="field-row" id="entry-amount-row">
          <div class="field"><label>Valor (R$)</label><input name="amount" inputmode="decimal" placeholder="0,00" value="${esc((val/100).toFixed(2).replace('.',','))}"/></div>
          <div class="field"><label>Categoria</label><select id="entry-category" name="category">${options(categories.map(x=>[x,x]),e?.category||(kind==='income'?'Salário':'Outros'))}</select></div>
        </div>
        <div class="field"><label>Status</label><select name="status" id="entry-status">${options(statusOptions[kind],e?.status||statusOptions[kind][0][0])}</select></div>
        <div id="expense-fields">
          <div class="field"><label>Forma de pagamento</label><select name="payment_method" id="payment-method">${options(paymentMethods,method)}</select></div>
          <div class="field"><label>Vincular a um evento (opcional)</label><select name="event_id">${options(eventsPairs,e?.event_id||m.eventId||'')}</select></div>
          <label class="field-checkbox"><input type="checkbox" name="variable" ${e?.variable!==false?'checked':''}/> Despesa variável (considerar na margem de variação e imprevistos)</label>
          <div id="credit-preview" class="hint-inline"></div>
        </div>
        <div class="field"><label>Observações</label><textarea name="notes" maxlength="1000" placeholder="Informações adicionais">${esc(e?.notes||'')}</textarea></div>
        ${ownerFields(e)}
        <label class="field-checkbox"><input type="checkbox" name="monthly" ${e?.frequency==='monthly'?'checked':''}/> Repetir mensalmente</label>
        ${e?.frequency==='monthly'?'<div class="notice">Ao editar esta série, as mudanças serão aplicadas nas próximas ocorrências. Exceções anteriores já cadastradas serão mantidas.</div>':''}
        <div class="form-footer">${e?`<button type="button" class="text-button danger" data-action="delete-entry" data-id="${esc(e.id)}">Excluir</button>`:'<span></span>'}
          <div><button type="button" class="secondary-button" data-action="close">Cancelar</button> <button type="submit" class="primary-button">Salvar</button></div></div>
      </form></section></div>`;
  }
  function renderSettingsModal(){
    const s=store.settings;
    return `<div class="albus-modal-backdrop"><section class="albus-modal" role="dialog" aria-modal="true" aria-label="Configurar finanças">
      <div class="modal-header"><h2>Configuração financeira</h2><button class="close-btn" data-action="close">${icon('close')}</button></div>
      <form id="settings-form">
        <div class="notice">O cartão só adia a data de pagamento. Compras anteriores podem vencer neste mês e compras deste mês podem vencer nos próximos.</div>
        <div class="field-row"><div class="field"><label>Dia de fechamento do cartão</label><input type="number" min="1" max="31" step="1" name="closingDay" value="${s.closingDay}" required/></div>
          <div class="field"><label>Dia de vencimento da fatura</label><input type="number" min="1" max="31" step="1" name="dueDay" value="${s.dueDay}" required/></div></div>
        <div class="albus-small" style="margin:-5px 0 14px">Confira os dias reais na administradora. Em meses curtos, datas 29–31 são ajustadas ao último dia.</div>
        <div class="field-row"><div class="field"><label>Variação prevista (%)</label><input name="variationPercent" type="number" min="0" max="100" step="1" value="${s.variationPercent}" required/></div>
          <div class="field"><label>Imprevistos sobre variáveis (%)</label><input name="provisionPercent" type="number" min="0" max="100" step="1" value="${s.provisionPercent}" required/></div></div>
        <div class="field"><label>Provisão fixa adicional para imprevistos (R$)</label><input name="provisionFixed" inputmode="decimal" value="${esc((s.provisionFixedCents/100).toFixed(2).replace('.',','))}"/></div>
        <div class="albus-small">A variação é uma simulação, não um débito. A provisão de imprevistos reduz o valor a destinar; reservas cadastradas são contabilizadas separadamente.</div>
        <div class="form-footer"><span></span><div><button class="secondary-button" type="button" data-action="close">Cancelar</button> <button class="primary-button" type="submit">Salvar preferências</button></div></div>
      </form></section></div>`;
  }
  function drawTitleSuggestions(){
    const title=root.querySelector('#entry-title'),category=root.querySelector('#entry-category'),box=root.querySelector('#title-suggestions');
    if(!title||!category||!box)return;
    const kind=root.querySelector('#entry-type')?.value;
    const list=category.value==='Salário'&&kind==='income'?suggestions['Salário']:(suggestions[category.value]||[]);
    box.innerHTML=list.length?'<span class="albus-small">Sugestões opcionais: </span>'+list.map(x=>`<button type="button" data-title-suggestion="${esc(x)}">${esc(x)}</button>`).join(''):'';
    box.querySelectorAll('[data-title-suggestion]').forEach(btn=>btn.addEventListener('click',()=>{title.value=btn.dataset.titleSuggestion;title.focus();}));
  }
  function updateFormFields(){
    const form=root.querySelector('#entry-form');if(!form)return;
    const kind=form.elements.entry_type.value,expense=kind==='expense';
    const amountRow=root.querySelector('#entry-amount-row'), expenseFields=root.querySelector('#expense-fields');
    if(amountRow)amountRow.style.display=kind==='task'?'none':'grid';
    if(expenseFields)expenseFields.style.display=expense?'block':'none';
    const status=form.elements.status,old=status.value;
    status.innerHTML=options(statusOptions[kind],statusOptions[kind].some(x=>x[0]===old)?old:statusOptions[kind][0][0]);
    const preview=root.querySelector('#credit-preview');
    if(preview){
      const date=form.elements.entry_date.value,method=form.elements.payment_method?.value;
      if(!expense||method!=='credit'){preview.style.display='none';return;}
      preview.style.display='block';
      if(!store.settings.cardConfigured){preview.innerHTML=`<b>Cartão ainda não configurado.</b> Abra Configurar para informar o dia real de fechamento e vencimento antes de salvar compras no crédito.`;return;}
      const due=E.dateParts(date)?E.billingDueDate(date,store.settings):null;
      preview.innerHTML=due?`Compra em <b>${esc(date.split('-').reverse().join('/'))}</b> · pagamento previsto para <b>${esc(due.split('-').reverse().join('/'))}</b>. Esta despesa será contada na fatura do mês de pagamento, sem duplicidade.`:'Selecione uma data válida.';
    }
  }
  function move(kind,itemId,date){
    if(!E.dateParts(date))throw Error('Informe uma data válida.');
    if(kind==='event'){
      const linked=store.entries.filter(x=>x.event_id===itemId);
      if(linked.some(x=>x.status==='paid'||x.status==='received')&&!window.confirm('Este evento contém lançamentos já realizados. Mover tudo também altera as datas históricas dessas despesas. Continuar?'))return false;
    }else{
      const item=store.entries.find(x=>x.id===itemId);
      if((item?.status==='paid'||item?.status==='received')&&!window.confirm('Este lançamento já foi efetivado. Alterar sua data modificará o histórico. Continuar?'))return false;
    }
    const changed=E.moveItem(store,kind,itemId,date);
    store.entries=changed.entries;store.events=changed.events;
    state.selected=date;state.month=E.monthOf(date);
    state.notice=kind==='event'?'Evento e despesas vinculadas movidos.':'Lançamento movido para a nova data.';
    if(!persist())return false;
    state.modal=null;render();return true;
  }
  function changeMonth(delta){
    state.month=E.addMonths(state.month,delta);
    const day=Number(state.selected.slice(8,10));
    state.selected=E.dateInMonth(state.month,day);
    state.notice='';render();
  }
  function bindActions(){
    root.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',event=>{
      const action=button.dataset.action;
      if(action==='previous')return changeMonth(-1);
      if(action==='next')return changeMonth(1);
      if(action==='today'){state.selected=todayISO();state.month=E.monthOf(state.selected);state.notice='';return render();}
      if(action==='select-day'){state.selected=button.dataset.date;state.notice='';return render();}
      if(action==='new-event'){state.modal={kind:'event',date:state.selected};return render();}
      if(action==='edit-event'){state.modal={kind:'event',id:button.dataset.id};return render();}
      if(action==='new-entry'){state.modal={kind:'entry',type:button.dataset.type||'expense',date:state.selected};return render();}
      if(action==='add-child'){const e=store.events.find(x=>x.id===button.dataset.id);state.modal={kind:'entry',type:'expense',eventId:e.id,date:e.date};return render();}
      if(action==='edit-entry'){state.modal={kind:'entry',id:button.dataset.id};return render();}
      if(action==='move-event'){const e=store.events.find(x=>x.id===button.dataset.id);state.modal={kind:'move',itemKind:'event',id:e.id,date:e.date};return render();}
      if(action==='move-entry'){const e=store.entries.find(x=>x.id===button.dataset.id);state.modal={kind:'move',itemKind:'entry',id:e.id,date:e.entry_date};return render();}
      if(action==='close'){state.modal=null;state.error='';return render();}
      if(action==='settings'){state.modal={kind:'settings'};return render();}
      if(action==='delete-event'){const e=store.events.find(x=>x.id===button.dataset.id);if(!e)return;
        const n=store.entries.filter(x=>x.event_id===e.id).length;
        if(!window.confirm(`Excluir "${e.title}" e suas ${n} despesas/itens vinculados? Esta ação não pode ser desfeita.`))return;
        store.events=store.events.filter(x=>x.id!==e.id);store.entries=store.entries.filter(x=>x.event_id!==e.id);
        store.overrides=store.overrides.filter(o=>store.entries.some(x=>x.id===o.entry_id));
        state.modal=null;state.notice='Evento e itens vinculados excluídos.';persist();return render();
      }
      if(action==='delete-entry'){const e=store.entries.find(x=>x.id===button.dataset.id);if(!e||!window.confirm(`Excluir "${e.title}"${e.frequency==='monthly'?' e toda a série mensal':''}?`))return;
        store.entries=store.entries.filter(x=>x.id!==e.id);store.overrides=store.overrides.filter(o=>o.entry_id!==e.id);
        state.modal=null;state.notice='Lançamento excluído.';persist();return render();
      }
    }));
    root.querySelectorAll('.albus-day[data-action="select-day"]').forEach(cell=>cell.addEventListener('keydown',event=>{if(event.target===cell&&(event.key==='Enter'||event.key===' ')){event.preventDefault();state.selected=cell.dataset.date;render();}}));
    root.querySelector('#demo-user')?.addEventListener('change',e=>{state.user=e.target.value;state.ownerFilter='all';state.notice='Perfil de demonstração alterado. Cada membro vê apenas os próprios itens individuais.';render();});
    root.querySelector('#owner-filter')?.addEventListener('change',e=>{state.ownerFilter=e.target.value;render();});
    root.querySelector('#item-visibility')?.addEventListener('change',e=>{
      const fields=root.querySelectorAll('input[name="responsible_ids"]');
      if(e.target.value==='private')fields.forEach(cb=>{cb.checked=cb.value===state.user;cb.disabled=cb.value!==state.user;});
      else fields.forEach(cb=>cb.disabled=false);
    });
    root.querySelector('#entry-category')?.addEventListener('change',()=>drawTitleSuggestions());
    root.querySelector('#entry-type')?.addEventListener('change',()=>drawTitleSuggestions());
    root.querySelector('#payment-profile')?.addEventListener('change',e=>{
      store.settings.profile=e.target.value;persist();
      if(store.settings.profile==='credit'&&!store.settings.cardConfigured){state.modal={kind:'settings'};}
      render();
    });
    root.querySelector('#calendar-view')?.addEventListener('change',e=>{store.settings.view=e.target.value;persist();render();});
    root.querySelector('#event-form')?.addEventListener('submit',onEventSave);
    root.querySelector('#entry-form')?.addEventListener('submit',onEntrySave);
    root.querySelector('#settings-form')?.addEventListener('submit',onSettingsSave);
    root.querySelector('#move-form')?.addEventListener('submit',event=>{
      event.preventDefault();
      const d=new FormData(event.currentTarget).get('date');
      try{move(state.modal.itemKind,state.modal.id,String(d));}catch(err){state.error=err.message;render();}
    });
    for(const name of ['entry-type','entry-date','payment-method']){
      const input=root.querySelector('#'+name);
      input?.addEventListener('change',updateFormFields);
      if(name==='entry-date')input?.addEventListener('input',updateFormFields);
    }
    updateFormFields();
    drawTitleSuggestions();
    const priv=root.querySelector('#item-visibility');
    if(priv&&priv.value==='private')priv.dispatchEvent(new Event('change'));
    root.querySelectorAll('[data-drag-kind]').forEach(el=>el.addEventListener('dragstart',event=>{
      const payload={kind:el.dataset.dragKind,id:el.dataset.dragId};
      event.dataTransfer?.setData('text/plain',JSON.stringify(payload));
      if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
    }));
    root.querySelectorAll('[data-drop-date]').forEach(cell=>{
      cell.addEventListener('dragover',e=>{e.preventDefault();cell.classList.add('drop-on');if(e.dataTransfer)e.dataTransfer.dropEffect='move';});
      cell.addEventListener('dragleave',()=>cell.classList.remove('drop-on'));
      cell.addEventListener('drop',event=>{
        event.preventDefault();event.stopPropagation();cell.classList.remove('drop-on');
        try{
          const payload=JSON.parse(event.dataTransfer.getData('text/plain'));
          if(!['event','entry'].includes(payload.kind)||typeof payload.id!=='string')return;
          move(payload.kind,payload.id,cell.dataset.dropDate);
        }catch(err){state.error=err.message||'Não foi possível mover o item.';render();}
      });
    });
    // O modal não fecha pelo clique no fundo: somente X ou Cancelar.
  }
  function onEventSave(event){
    event.preventDefault();
    const form=new FormData(event.currentTarget),title=String(form.get('title')||'').trim(),date=String(form.get('date')||''),notes=String(form.get('notes')||'');
    if(!title||title.length>100||!E.dateParts(date)){state.error='Informe título e data válidos.';render();return;}
    const old=store.events.find(x=>x.id===state.modal.id);
    const owners=ownershipFromForm(form,old);
    if(old){
      // Alterar a data no formulário possui o mesmo efeito de arrastar o evento.
      if(old.date!==date&&!move('event',old.id,date))return;
      const found=store.events.find(x=>x.id===old.id);Object.assign(found,{title,notes,...owners});
    }else store.events.push({id:id(),title,date,notes,...owners});
    state.selected=date;state.month=E.monthOf(date);state.modal=null;state.error='';state.notice='Evento salvo. Você pode associar várias despesas a ele.';persist();render();
  }
  function onEntrySave(event){
    event.preventDefault();
    const form=new FormData(event.currentTarget),type=String(form.get('entry_type')||'expense');
    const title=String(form.get('title')||'').trim(),date=String(form.get('entry_date')||'');
    try{
      if(!types[type]||!title||title.length>100||!E.dateParts(date))throw Error('Preencha tipo, título e data válidos.');
      const amount=type==='task'?0:E.parseMoney(form.get('amount'));
      const method=type==='expense'?String(form.get('payment_method')||'pix'):'pix';
      if(type==='expense'&&method==='credit'&&!store.settings.cardConfigured)throw Error('Configure os dias de fechamento e vencimento do cartão antes de cadastrar esta compra.');
      const status=String(form.get('status')||'planned');
      if(!statusOptions[type].some(x=>x[0]===status))throw Error('Status incompatível com o tipo.');
      const eventId=type==='expense'?String(form.get('event_id')||''):''; 
      if(eventId&&!visibleEvents().some(x=>x.id===eventId))throw Error('Evento associado não encontrado ou indisponível neste perfil.');
      const old=store.entries.find(x=>x.id===state.modal.id);
      const owners=ownershipFromForm(form,old);
      const value={...owners,title,entry_type:type,entry_date:date,amount_cents:amount,status,category:String(form.get('category')||'Outros'),
        notes:String(form.get('notes')||'').slice(0,1000),payment_method:method,event_id:eventId||null,variable:type==='expense'?form.has('variable'):false,frequency:form.has('monthly')?'monthly':'none'};
      if(eventId){
        const parent=store.events.find(x=>x.id===eventId);
        if(parent.visibility==='private'&&value.visibility!=='private')throw Error('Uma despesa compartilhada não pode ser vinculada a um evento individual.');
        if(parent.visibility==='private'&&parent.created_by!==value.created_by)throw Error('Somente o criador pode vincular despesas ao evento individual.');
      }
      if(old){Object.assign(old,value);}else store.entries.push({id:id(),...value});
      state.selected=date;state.month=E.monthOf(date);
      state.modal=null;state.error='';state.notice='Lançamento salvo. Compras no crédito seguem a data da fatura, não são duplicadas.';persist();render();
    }catch(err){state.error=err.message;const node=root.querySelector('.albus-modal .modal-header');if(node){let message=root.querySelector('#form-error');if(!message){message=document.createElement('div');message.id='form-error';message.className='error';node.after(message);}message.textContent=err.message;}}
  }
  function onSettingsSave(event){
    event.preventDefault();const f=new FormData(event.currentTarget);
    try{
      const days=['closingDay','dueDay'],percentage=['variationPercent','provisionPercent'];
      const next={...store.settings};
      for(const key of days){const n=Number(f.get(key));if(!Number.isInteger(n)||n<1||n>31)throw Error('Os dias precisam estar entre 1 e 31.');next[key]=n;}
      for(const key of percentage){const n=Number(f.get(key));if(!Number.isInteger(n)||n<0||n>100)throw Error('Percentuais precisam estar entre 0 e 100.');next[key]=n;}
      next.provisionFixedCents=E.parseMoney(f.get('provisionFixed'));
      next.cardConfigured=true;Object.assign(store.settings,next);
      state.modal=null;state.error='';state.notice='Configurações financeiras atualizadas.';persist();render();
    }catch(err){const node=root.querySelector('.albus-modal .modal-header');if(node){let msg=root.querySelector('#form-error');if(!msg){msg=document.createElement('div');msg.id='form-error';msg.className='error';node.after(msg);}msg.textContent=err.message;}}
  }
  let lastToday=todayISO();
  function scheduleTomorrow(){
    const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
    setTimeout(()=>{
      const nextToday=todayISO(),previousToday=lastToday;
      lastToday=nextToday;
      if(!state.modal){
        // Atualiza a data destacada sem recarregar a página e sem mudar o mês em consulta.
        // Se o usuário estava no dia de ontem, apenas a seleção acompanha a nova data.
        if(state.selected===previousToday && state.month===E.monthOf(previousToday)){
          state.selected=nextToday;state.month=E.monthOf(nextToday);
        }
        render();
      }
      scheduleTomorrow();
    },Math.max(1000,next.getTime()-now.getTime()));
  }
  // Persistência local compatível com os lançamentos já criados no MVP.
  render();scheduleTomorrow();
})();
