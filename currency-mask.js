/* Mascara monetaria pt-BR: formata centavos durante digitacao.
   Nenhuma dependencia externa, utilizada nos formularios de valores do Albus. */
(function(scope){
  'use strict';
  const MAX_DIGITS=11; // limite coerente com AlbusEngine.parseMoney
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  function digits(raw){
    return String(raw??'').replace(/\D/g,'').slice(0,MAX_DIGITS);
  }
  function formatDigits(rawDigits){
    const d=digits(rawDigits);
    const cents=d?Number(d):0;
    return money.format(cents/100);
  }
  function fromCents(cents){
    const n=Math.max(0,Math.min(99999999999,Math.trunc(Number(cents)||0)));
    return money.format(n/100);
  }
  function initialValue(raw){
    const value=String(raw??'').trim();
    if(!value)return formatDigits('');
    // Inicializacao preserva o valor que ja veio do armazenamento em formato pt-BR.
    const normalized=value.replace(/\s|R\$/g,'');
    const parts=normalized.split(',');
    if(parts.length===2){
      const amount=Number(parts[0].replace(/\./g,''))*100+Number((parts[1]+'00').slice(0,2));
      if(Number.isFinite(amount)&&amount>=0)return fromCents(amount);
    }
    return formatDigits(digits(value));
  }
  function bind(input){
    if(!input||input.dataset.moneyBound==='yes')return;
    input.dataset.moneyBound='yes';
    input.value=initialValue(input.value);
    input.addEventListener('input',()=>{
      input.value=formatDigits(digits(input.value));
      try{input.setSelectionRange(input.value.length,input.value.length);}catch{}
    });
    input.addEventListener('focus',()=>{
      // Selecionar o valor agiliza a substituicao por digitacao.
      try{input.select();}catch{}
    });
  }
  scope.AlbusMoneyMask={digits,formatDigits,fromCents,initialValue,bind};
})(typeof globalThis!=='undefined'?globalThis:this);
