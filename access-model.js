/* Modelo de workspace e visibilidade para a demonstração local do Albus.
   ATENÇÃO: estes filtros não substituem autenticação, RLS ou isolamento no servidor. */
(function (scope) {
  const DEFAULT_MEMBERS = Object.freeze([
    {id:'rodrigo',name:'Rodrigo',role:'owner'},
    {id:'daniele',name:'Daniele',role:'member'},
  ]);
  const WORKSPACE_ID = 'familia-local';
  const memberIds = new Set(DEFAULT_MEMBERS.map(m=>m.id));
  function normalizedIds(ids) {
    return [...new Set(Array.isArray(ids)?ids.filter(id=>memberIds.has(id)):[])];
  }
  function normalizeItem(item) {
    const created_by=memberIds.has(item.created_by)?item.created_by:'legacy';
    const isLegacy=!Array.isArray(item.responsible_ids);
    const responsible_ids=normalizedIds(item.responsible_ids);
    return {...item,
      workspace_id:item.workspace_id||WORKSPACE_ID,
      created_by,
      responsible_ids:responsible_ids.length?responsible_ids:(isLegacy?['rodrigo','daniele']:[created_by].filter(x=>memberIds.has(x))),
      visibility:item.visibility==='private'?'private':'shared'
    };
  }
  function canView(item,userId) {
    return item.visibility!=='private'||item.created_by===userId;
  }
  function belongsToFilter(item,filter) {
    if(filter==='all')return true;
    if(filter==='shared')return item.visibility!=='private';
    return normalizedIds(item.responsible_ids).includes(filter);
  }
  function visibleItems(items, userId, filter='all') {
    return (items||[]).filter(item=>canView(item,userId)&&belongsToFilter(item,filter));
  }
  function memberName(id) {
    return DEFAULT_MEMBERS.find(x=>x.id===id)?.name||(id==='legacy'?'MVP anterior':'Desconhecido');
  }
  function responsibleLabel(item) {
    const ids=normalizedIds(item.responsible_ids);
    return ids.length===2?'Rodrigo e Daniele':ids.length===1?memberName(ids[0]):'Não definido';
  }
  function validateOwnership({creatorId,responsibleIds,visibility}) {
    const ids=normalizedIds(responsibleIds);
    if(!memberIds.has(creatorId))throw Error('Selecione um usuário válido.');
    if(!ids.length)throw Error('Selecione ao menos um responsável.');
    if(visibility==='private'&&(ids.length!==1||ids[0]!==creatorId))
      throw Error('Um item individual deve ter apenas seu criador como responsável.');
    return {responsible_ids:ids,visibility:visibility==='private'?'private':'shared'};
  }
  scope.AlbusAccess={WORKSPACE_ID,DEFAULT_MEMBERS,normalizedIds,normalizeItem,canView,belongsToFilter,visibleItems,memberName,responsibleLabel,validateOwnership};
})(typeof globalThis!=='undefined'?globalThis:this);
