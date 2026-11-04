/* Proteção dos cadastros locais do Albus: cópia anterior e exportação/importação sem sobrescrever.
   A chave de dados original é preservada. O projeto ainda não possui backup em nuvem. */
(function(scope){
  'use strict';
  const KEY='albus-calendar-local-v1';
  const SNAPSHOT_KEY='albus-calendar-local-v1-snapshot';
  const FORMAT='albus-backup-v1';
  function plainObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function parseStored(raw){
    if(!raw)return {};
    const data=JSON.parse(raw);
    if(!plainObject(data))throw Error('Estrutura de dados inválida.');
    return data;
  }
  function ensureSnapshot(storage){
    const old=storage.getItem(KEY);
    if(old===null||storage.getItem(SNAPSHOT_KEY)!==null)return;
    // Falha na cópia não modifica os dados principais.
    try{storage.setItem(SNAPSHOT_KEY,old);}catch{}
  }
  function save(storage,data){
    if(!plainObject(data))throw Error('Não foi possível salvar: dados inválidos.');
    const next=JSON.stringify(data);
    const old=storage.getItem(KEY);
    if(old===next)return true;
    if(old!==null)storage.setItem(SNAPSHOT_KEY,old);
    storage.setItem(KEY,next);
    return true;
  }
  function exportBackup(storage,source=''){
    const original=parseStored(storage.getItem(KEY));
    return {format:FORMAT,exported_at:new Date().toISOString(),source_origin:source,data:original};
  }
  function isValidItem(item){
    return plainObject(item)&&typeof item.id==='string'&&item.id.length>0&&item.id.length<=200;
  }
  function mergeList(existing,incoming,keyFn){
    const output=Array.isArray(existing)?[...existing]:[];
    const known=new Set(output.filter(x=>plainObject(x)).map(keyFn));
    let added=0,duplicates=0;
    for(const item of incoming){
      if(!isValidItem(item)&&keyFn!==overrideKey)throw Error('Há itens inválidos na cópia selecionada.');
      if(!plainObject(item))throw Error('Há itens inválidos na cópia selecionada.');
      const key=keyFn(item);
      if(!key||key==='undefined|undefined')throw Error('Identificador inválido no backup.');
      if(known.has(key)){duplicates++;continue;}
      output.push(item);known.add(key);added++;
    }
    return {items:output,added,duplicates};
  }
  function overrideKey(x){return String(x.entry_id||'')+'|'+String(x.occurrence_date||'');}
  function validateBackup(input){
    const raw=typeof input==='string'?JSON.parse(input):input;
    if(!plainObject(raw))throw Error('Backup inválido.');
    const value=raw.format===FORMAT?raw.data:raw;
    if(!plainObject(value))throw Error('Backup inválido.');
    if(!['entries','events','goals','overrides'].some(k=>Array.isArray(value[k])))
      throw Error('Arquivo sem lançamentos, eventos, objetivos ou ocorrências.');
    for(const field of ['entries','events','goals','overrides']){
      if(value[field]!==undefined&&!Array.isArray(value[field]))throw Error('O campo '+field+' do backup é inválido.');
    }
    return value;
  }
  function merge(current,backup){
    const incoming=validateBackup(backup);
    const output={...incoming,...current};
    const counts={};
    for(const key of ['entries','events','goals','overrides']){
      const currentList=Array.isArray(current?.[key])?current[key]:[];
      const incomingList=Array.isArray(incoming[key])?incoming[key]:[];
      const result=mergeList(currentList,incomingList,key==='overrides'?overrideKey:x=>x.id);
      output[key]=result.items;
      counts[key]={added:result.added,duplicates:result.duplicates};
    }
    // Preserva as configurações do navegador atual e quaisquer registros desconhecidos.
    output.settings=plainObject(current?.settings)?current.settings:
      plainObject(incoming.settings)?incoming.settings:{};
    return {data:output,counts};
  }
  function download(storage,origin=''){
    const backup=exportBackup(storage,origin);
    const body=JSON.stringify(backup,null,2);
    const blob=new Blob([body],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    const date=new Date().toISOString().slice(0,10);
    anchor.href=url;anchor.download='albus-backup-'+date+'.json';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return backup;
  }
  scope.AlbusBackup={KEY,SNAPSHOT_KEY,FORMAT,parseStored,ensureSnapshot,save,exportBackup,validateBackup,merge,download};
})(typeof globalThis!=='undefined'?globalThis:this);
