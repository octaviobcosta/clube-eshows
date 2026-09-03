/* Banco de perguntas e ramificação (funções puras). Roda no navegador e em Node (testes). */
(function (root) {
  var Q = [
    { id: 'p1_nome', part: 1, kind: 'text', label: 'Como chamamos o seu projeto?', help: 'Nome da banda ou seu nome artístico.', required: true, maxlength: 80, single: true },
    { id: 'p1_gestao', part: 1, kind: 'single', label: 'Quem cuida da parte comercial dos seus shows hoje?', options: [
      { id: 'eu', label: 'Eu mesmo(a)' }, { id: 'equipe', label: 'Alguém da banda ou da família' }, { id: 'escritorio', label: 'Um empresário ou escritório' }, { id: 'misto', label: 'Um pouco de cada' } ] },
    { id: 'p1_origem', part: 1, kind: 'multi', max: 3, label: 'De onde vêm os seus shows hoje?', help: 'Marca até três.', options: [
      { id: 'indicacao', label: 'Indicação e boca a boca' }, { id: 'casas', label: 'Casas que já me conhecem' }, { id: 'redes', label: 'Instagram e redes' }, { id: 'eshows', label: 'eshows' }, { id: 'empresario', label: 'Empresário ou produtora' }, { id: 'cerimonial', label: 'Cerimonialistas e agências de evento' }, { id: 'outro', label: 'Outro' } ] },
    { id: 'p1_volume_tipo', part: 1, kind: 'dual', label: 'Num mês normal, quantos shows você faz? E qual tipo você mais fecha?', fields: [
      { id: 'p1_volume', label: 'Quantos shows por mês', options: [ { id: '0_2', label: '0 a 2' }, { id: '3_5', label: '3 a 5' }, { id: '6_10', label: '6 a 10' }, { id: '11', label: '11 ou mais' } ] },
      { id: 'p1_tipo', label: 'O tipo que mais fecha', options: [ { id: 'bar', label: 'Bar e restaurante' }, { id: 'casamento', label: 'Casamento' }, { id: 'corporativo', label: 'Corporativo' }, { id: 'particular', label: 'Festa particular' }, { id: 'festival', label: 'Festival ou evento público' } ] } ] },
    { id: 'p1_ads', part: 1, kind: 'single', label: 'Você paga pra divulgar seu trabalho? (anúncio no Instagram, YouTube, Google)', options: [
      { id: 'nao', label: 'Não' }, { id: 'as_vezes', label: 'Às vezes' }, { id: 'todo_mes', label: 'Todo mês' } ],
      followup: { when: ['as_vezes', 'todo_mes'], id: 'p1_ads_valor', label: 'Quanto por mês, mais ou menos?', options: [
        { id: 'ate50', label: 'até R$ 50' }, { id: '50_150', label: 'R$ 50 a 150' }, { id: '150_300', label: 'R$ 150 a 300' }, { id: '300_600', label: 'R$ 300 a 600' }, { id: '600', label: 'mais de R$ 600' } ] } },
    { id: 'p1_ferramentas', part: 1, kind: 'multi', label: 'Que ferramentas você usa pra tocar a carreira no dia a dia?', exclusive: 'nenhuma', options: [
      { id: 'whatsapp', label: 'WhatsApp' }, { id: 'instagram', label: 'Instagram' }, { id: 'agenda', label: 'Agenda do celular ou Google Agenda' }, { id: 'planilha', label: 'Planilha' }, { id: 'canva', label: 'Canva ou PDF de apresentação' }, { id: 'site', label: 'Site ou Linktree' }, { id: 'crm', label: 'Sistema de clientes (CRM)' }, { id: 'contrato', label: 'Contrato online' }, { id: 'cobranca', label: 'Cobrança ou pagamento online' }, { id: 'nenhuma', label: 'Nenhuma' } ] },
    { id: 'p1_gasto_tools', part: 1, kind: 'single', label: 'E quanto sai por mês com ferramentas e apps pagos?', options: [
      { id: '0', label: 'R$ 0, não pago nada' }, { id: 'ate50', label: 'até R$ 50' }, { id: '50_150', label: 'R$ 50 a 150' }, { id: '150_300', label: 'R$ 150 a 300' }, { id: '300', label: 'mais de R$ 300' }, { id: 'nao_sei', label: 'Não sei' } ] },
    { id: 'p1_sentimento', part: 1, kind: 'single', label: 'Hoje, como você se sente com a parte comercial dos seus shows?', options: [
      { id: 'tranquilo', label: 'Tranquilo, tá funcionando' }, { id: 'cansa', label: 'Dou conta, mas cansa' }, { id: 'ajuda', label: 'Preciso de ajuda' } ] },

    { id: 'p2_sentido', part: 2, kind: 'gate', label: 'Isso faz sentido pro seu momento?', options: [
      { id: 'nao', label: 'Não faz sentido pra mim' }, { id: 'nao_agora', label: 'Faz sentido, mas não agora' }, { id: 'sim', label: 'Faz sentido, quero saber mais' } ] },
    { id: 'p2_esperado', part: 2, kind: 'number2', label: 'Antes de ver o preço: quanto você imagina que custaria por mês?', fields: [
      { id: 'p2_esperado_solo', label: 'Solo' }, { id: 'p2_esperado_assist', label: 'Assistido' } ], skipLabel: 'Não sei' },
    { id: 'p2_int_solo', part: 2, kind: 'likert5', label: 'Por R$ 59,90 ao mês, você assinaria o Solo?' },
    { id: 'p2_int_assist', part: 2, kind: 'likert5', label: 'E o Assistido, por R$ 299 ao mês, com a eshows gerindo as campanhas pra você?' },
    { id: 'p2_vs_esperado', part: 2, kind: 'single', label: 'Comparando com o que você imaginou, os preços ficaram…', options: [
      { id: 'mais_caros', label: 'Mais caros' }, { id: 'como_esperava', label: 'Como eu esperava' }, { id: 'mais_baratos', label: 'Mais baratos' } ] },
    { id: 'p2_escolha', part: 2, kind: 'single', label: 'Qual dos dois faz mais sentido pra você agora? E por quê?', noAuto: true, options: [
      { id: 'solo', label: 'Solo' }, { id: 'assistido', label: 'Assistido' }, { id: 'nenhum', label: 'Nenhum' } ],
      note: { id: 'p2_porque', placeholder: 'Se quiser, conta em uma frase', maxlength: 300 } },
    { id: 'p2_pesou', part: 2, kind: 'single', label: 'O que pesou?', options: [
      { id: 'preco', label: 'Preço' }, { id: 'nao_preciso', label: 'Não preciso disso' }, { id: 'confianca', label: 'Ainda não confio' }, { id: 'outro', label: 'Outro' } ] },
    { id: 'p2_falta', part: 2, kind: 'text', label: 'Você sentiu falta de alguma funcionalidade que não contemplamos no produto?', optional: true, maxlength: 300, placeholder: 'Opcional. Uma frase já ajuda.' }
  ];

  var LIKERT = [ { id: '1', label: 'Com certeza não' }, { id: '2', label: 'Provavelmente não' }, { id: '3', label: 'Talvez' }, { id: '4', label: 'Provavelmente sim' }, { id: '5', label: 'Com certeza sim' } ];
  Q.forEach(function (q) { if (q.kind === 'likert5') q.options = LIKERT; });

  var byId = {};
  Q.forEach(function (q) { byId[q.id] = q; });

  var parts = [
    { n: 1, title: 'Como funciona hoje', ids: Q.filter(function (q) { return q.part === 1; }).map(function (q) { return q.id; }) },
    { n: 2, title: 'Sua percepção', ids: ['p2_sentido', 'p2_esperado', '__reveal', 'p2_int_solo', 'p2_int_assist', 'p2_vs_esperado', 'p2_escolha', 'p2_pesou', 'p2_falta'] }
  ];

  var EXIT_QUESTION = { gate_a: 'p1_porque_nao', gate_b: 'p2_porque_nao', gate_c: 'p2_porque_nao' };

  function next(id, a) {
    a = a || {};
    if (id === 'p2_sentido') return a.p2_sentido === 'nao' ? { phase: 'bis', exit: 'gate_b' } : 'p2_esperado';
    if (id === 'p2_esperado') return { phase: 'reveal', exit: null };
    if (id === '__reveal') return 'p2_int_solo';
    if (id === 'p2_escolha') return a.p2_escolha === 'nenhum' ? 'p2_pesou' : 'p2_falta';
    if (id === 'p2_pesou') return { phase: 'bis', exit: 'gate_c' };
    if (id === 'p2_falta') return { phase: 'bis', exit: null };
    var part = parts[byId[id].part - 1], i = part.ids.indexOf(id), nid = part.ids[i + 1];
    /* fim da parte 1: vai direto pro conceito (o portão A foi retirado em 02/09) */
    if (nid === undefined && part.n === 1) return { phase: 'conceito', exit: null };
    return nid;
  }

  function visibleIds(part, a) {
    a = a || {};
    return parts[part - 1].ids.filter(function (id) {
      if (id === '__reveal') return false;
      if (id === 'p2_pesou') return a.p2_escolha === 'nenhum';
      if (id === 'p2_falta') return a.p2_escolha !== 'nenhum';
      return true;
    });
  }

  function progress(id, a) {
    var part = byId[id].part, ids = visibleIds(part, a);
    return { part: part, index: ids.indexOf(id) + 1, total: ids.length };
  }

  /* Onde retomar quando a página reabre com respostas salvas. */
  function answered(id, a) {
    var q = byId[id];
    if (q.kind === 'dual') return a.p1_volume !== undefined && a.p1_tipo !== undefined;
    if (q.kind === 'number2') return a.p2_esperado_solo !== undefined || a.p2_esperado_assist !== undefined || a.p2_esperado === 'skip';
    return a[id] !== undefined;
  }

  function resumePoint(a) {
    a = a || {};
    var ids1 = parts[0].ids;
    for (var j = 0; j < ids1.length; j++) {
      if (!answered(ids1[j], a)) return { phase: 'parte', id: ids1[j] };
    }
    if (a.p2_sentido === 'nao') return { phase: 'bis', exit: 'gate_b' };
    if (a.p2_falta !== undefined || a.p2_pesou !== undefined) return { phase: 'bis', exit: a.p2_pesou !== undefined ? 'gate_c' : null };
    if (a.p2_sentido === undefined) return { phase: 'conceito' };
    var ids2 = visibleIds(2, a);
    for (var i = 0; i < ids2.length; i++) {
      if (!answered(ids2[i], a)) return { phase: 'parte', id: ids2[i] };
    }
    return { phase: 'bis', exit: null };
  }

  root.ED = root.ED || {};
  root.ED.questions = { list: Q, byId: byId, parts: parts, LIKERT: LIKERT, EXIT_QUESTION: EXIT_QUESTION };
  root.ED.flow = { next: next, progress: progress, visibleIds: visibleIds, resumePoint: resumePoint };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ED;
})(typeof window !== 'undefined' ? window : globalThis);
