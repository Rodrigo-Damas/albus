// Executar com: node --test tests/engine.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const settings = {closingDay:25,dueDay:5,variationPercent:10,provisionPercent:10,provisionFixedCents:0};
const expense = (id,date,amount,method='credit') => ({id,title:id,entry_type:'expense',entry_date:date,amount_cents:amount,payment_method:method,status:'planned',frequency:'none',variable:true});

test('compra antes do fechamento vence no próximo mês',()=>{
  assert.equal(E.billingDueDate('2026-11-14',settings),'2026-12-05');
});
test('compra após fechamento só vence dois meses depois',()=>{
  assert.equal(E.billingDueDate('2026-11-28',settings),'2027-01-05');
});
test('vencimento posterior ao fechamento no mesmo mês',()=>{
  assert.equal(E.billingDueDate('2026-11-03',{closingDay:8,dueDay:20}),'2026-11-20');
});
test('último dia do mês é ajustado em fevereiro',()=>{
  assert.equal(E.billingDueDate('2026-01-31',{closingDay:31,dueDay:5}),'2026-02-05');
  assert.equal(E.expandMonth([{id:'fixa',title:'Internet',entry_type:'expense',entry_date:'2026-01-31',frequency:'monthly',amount_cents:10000}],[],'2026-02')[0].occurrence_date,'2026-02-28');
});
test('novembro paga despesas de outubro sem duplicar novembro',()=>{
  const entries=[
    expense('out','2026-10-14',420000),
    expense('nov','2026-11-14',300000),
    expense('pix','2026-11-20',8000,'pix'),
    {id:'salario',title:'Salário',entry_type:'income',entry_date:'2026-11-03',amount_cents:800000,frequency:'none',status:'received'}
  ];
  const summary=E.monthSummary(entries,[],'2026-11',settings);
  assert.equal(summary.income,800000);
  assert.equal(summary.expense,428000);
  assert.equal(summary.previousCard,420000);
  assert.equal(summary.newPurchases,308000);
  assert.equal(summary.futureCard,300000);
  assert.equal(summary.provision,800);
  assert.equal(summary.valueToAssign,371200);
});
test('evento move todas despesas vinculadas com deslocamento igual',()=>{
  const data={events:[{id:'evt',date:'2026-11-14'}],entries:[
    {id:'a',entry_date:'2026-11-10',event_id:'evt'},
    {id:'b',entry_date:'2026-11-14',event_id:'evt'},
    {id:'c',entry_date:'2026-11-13'}
  ]};
  const next=E.moveItem(data,'event','evt','2026-11-21');
  assert.equal(next.events[0].date,'2026-11-21');
  assert.deepEqual(next.entries.map(x=>x.entry_date),['2026-11-17','2026-11-21','2026-11-13']);
});
test('despesa avulsa move individualmente',()=>{
  const moved=E.moveItem({entries:[{id:'p',entry_date:'2026-11-10'},{id:'q',entry_date:'2026-11-10'}]},'entry','p','2026-11-15');
  assert.deepEqual(moved.entries.map(x=>x.entry_date),['2026-11-15','2026-11-10']);
});
test('compra avulsa em débito sai no mês da compra',()=>{
  assert.equal(E.paymentDate(expense('deb','2026-11-25',12000,'debit'),settings),'2026-11-25');
});
test('valor de dinheiro real não soma a fatura duas vezes',()=>{
  const entries=[expense('a','2026-11-14',30000),{id:'rec',title:'Receita',entry_type:'income',entry_date:'2026-12-01',amount_cents:50000,frequency:'none'}];
  const s=E.monthSummary(entries,[],'2026-12',settings);
  assert.equal(s.expense,30000);
  assert.equal(s.newPurchases,0);
  assert.equal(s.income,50000);
});
test('fatura de compras de meses anteriores não infla provisão de imprevistos',()=>{
  const entries=[expense('oct','2026-10-14',420000),expense('pix','2026-11-20',8000,'pix')];
  const s=E.monthSummary(entries,[],'2026-11',settings);
  assert.equal(s.variable,8000);
  assert.equal(s.variation,800);
  assert.equal(s.provision,800);
});
test('despesas pagas são fixas para a faixa de variação',()=>{
  const entries=[{...expense('pago','2026-11-11',10000,'pix'),status:'paid'},expense('aberto','2026-11-12',20000,'pix')];
  const s=E.monthSummary(entries,[],'2026-11',settings);
  assert.equal(s.variable,20000);
  assert.equal(s.variation,2000);
  assert.equal(s.provision,2000);
});
test('aceita 1.234,56 e rejeita valores negativos',()=>{
  assert.equal(E.parseMoney('1.234,56'),123456);
  assert.throws(()=>E.parseMoney('-42,00'));
});
