/* Experiência Escritório Digital — LP estática (GitHub Pages).
   Backend: Supabase Edge Function ed-api (token HMAC do convite via ?t=).
   Fases: ato1 (convite) → runner (pesquisa) → retrato → ato3 (revelação) | thanks.
   Protocolo: 2026-08-27_whatsapp_validacao_clube-artistas_v1.md §6/§9/§12. */
(function () {
  'use strict';

  var API = 'https://osahwimcceppufdcaovv.supabase.co/functions/v1/ed-api';
  var TOKEN = new URLSearchParams(location.search).get('t') || '';
  var SKIP = '__skipped__';

  // ───────────────────────── helpers ─────────────────────────
  function uid() {
    var s = '';
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'c_' + s;
  }
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function shuffleArr(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ───────────────────────── API + telemetria ─────────────────────────
  function call(action, payload) {
    var body = Object.assign({ action: action, token: TOKEN }, payload || {});
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (d) {
        throw new Error(d.error || ('Falha (' + res.status + ')'));
      });
      return res.json();
    });
  }

  var evQueue = [];
  var flushTimer = null;
  function track(name, extra) {
    evQueue.push({
      event_id: uid(),
      name: name,
      question_id: extra && extra.question_id,
      payload: extra && extra.payload,
      client_ts: new Date().toISOString(),
    });
    if (evQueue.length >= 10) flushEvents();
    else if (!flushTimer) flushTimer = setTimeout(flushEvents, 3000);
  }
  function flushEvents() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!evQueue.length || !TOKEN) return;
    var batch = evQueue.splice(0, evQueue.length);
    call('events', { events: batch }).catch(function () {
      evQueue = batch.concat(evQueue); // retry no próximo flush (idempotente)
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && evQueue.length && TOKEN) {
      var batch = evQueue.splice(0, evQueue.length);
      // text/plain = simple request: beacon cross-origin sem preflight
      // (a Edge Function parseia o JSON independente do content-type)
      navigator.sendBeacon(API, new Blob(
        [JSON.stringify({ action: 'events', token: TOKEN, events: batch })],
        { type: 'text/plain' }
      ));
    }
  });

  // ───────────────────────── questionário (protocolo §6) ─────────────────────────
  function hadOwnShow(a) { return a.q1 != null && a.q1 !== 'none'; }
  function hadOwnContact(a) { return hadOwnShow(a) || (a.q2a != null && a.q2a !== 'none'); }
  function q10Positive(a) { return a.q10 === 'would_join' || a.q10 === 'would_request'; }

  var CORE = [
    { id: 'q1', chapter: 1, kind: 'single',
      label: 'Nos últimos 3 meses, quantos shows o seu projeto conseguiu pelos próprios contatos, divulgação, indicação ou parceiros?',
      help: 'Não conte propostas prontas enviadas pela eshows.',
      options: [
        { id: 'none', label: 'Nenhum', pinned: true },
        { id: '1', label: '1', pinned: true },
        { id: '2_3', label: '2 a 3', pinned: true },
        { id: '4_6', label: '4 a 6', pinned: true },
        { id: '7_10', label: '7 a 10', pinned: true },
        { id: '11_plus', label: '11 ou mais', pinned: true }] },
    { id: 'q2a', chapter: 1, kind: 'single',
      label: 'Nesse mesmo período, quantas pessoas, casas ou empresas novas pediram preço ou informação pelos seus próprios canais?',
      options: [
        { id: 'none', label: 'Nenhuma', pinned: true },
        { id: '1', label: '1', pinned: true },
        { id: '2_3', label: '2 a 3', pinned: true },
        { id: '4_plus', label: '4 ou mais', pinned: true },
        { id: 'dont_remember', label: 'Não lembro', pinned: true }] },
    { id: 'q2b', chapter: 1, kind: 'single', showIf: hadOwnShow, shuffle: true,
      label: 'Qual foi o tipo do show mais recente que você conseguiu por conta própria?',
      options: [
        { id: 'bar', label: 'Bar ou restaurante fora de uma proposta pronta da eshows' },
        { id: 'social', label: 'Evento social, como casamento, aniversário ou formatura' },
        { id: 'corporate', label: 'Evento de empresa' },
        { id: 'community', label: 'Evento de condomínio, clube ou associação' },
        { id: 'public', label: 'Evento público, festival ou show com ingresso' },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q4', chapter: 1, kind: 'single', showIf: hadOwnShow, shuffle: true,
      label: 'De onde veio o primeiro contato desse cliente?',
      options: [
        { id: 'referral', label: 'Indicação de cliente, amigo ou outro artista' },
        { id: 'repeat_client', label: 'Cliente que já tinha me contratado' },
        { id: 'social_media', label: 'Instagram, TikTok ou outra rede social' },
        { id: 'own_outreach', label: 'Meu próprio contato com o cliente' },
        { id: 'agent', label: 'Assessor, produtor, empresário ou escritório' },
        { id: 'platform', label: 'Plataforma ou site' },
        { id: 'eshows', label: 'eshows' },
        { id: 'other', label: 'Outro', pinned: true },
        { id: 'dont_remember', label: 'Não lembro', pinned: true }] },
    { id: 'q5a', chapter: 1, kind: 'multi', shuffle: true,
      label: 'O que o projeto usa hoje para organizar e vender shows?',
      options: [
        { id: 'whatsapp', label: 'WhatsApp ou mensagens' },
        { id: 'social', label: 'Instagram, TikTok ou outras redes' },
        { id: 'calendar', label: 'Agenda do celular ou Google Calendar' },
        { id: 'spreadsheet', label: 'Planilha' },
        { id: 'canva', label: 'Canva ou arquivos de apresentação' },
        { id: 'site', label: 'Site, página de links ou formulário' },
        { id: 'crm', label: 'Sistema de clientes ou CRM' },
        { id: 'proposal_tool', label: 'Ferramenta de proposta ou contrato' },
        { id: 'billing_tool', label: 'Ferramenta de cobrança ou pagamento' },
        { id: 'dashboard', label: 'Painel de números ou financeiro' },
        { id: 'none', label: 'Nenhuma estrutura definida', exclusive: true, pinned: true },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q6', chapter: 1, kind: 'single', showIf: hadOwnContact,
      label: 'Até qual etapa chegou o contato mais recente que veio pelos seus próprios canais?',
      options: [
        { id: 'responding', label: 'Ainda estamos respondendo ou entendendo o pedido', pinned: true },
        { id: 'confirmed_need', label: 'Confirmamos necessidade, data ou faixa de preço', pinned: true },
        { id: 'sent_proposal', label: 'Enviamos preço ou proposta', pinned: true },
        { id: 'negotiating', label: 'Entrou em negociação', pinned: true },
        { id: 'closed', label: 'Fechou o show', pinned: true },
        { id: 'client_left', label: 'O cliente desistiu ou escolheu outra opção', pinned: true },
        { id: 'we_declined', label: 'O projeto decidiu não seguir', pinned: true },
        { id: 'lost_track', label: 'Perdemos o contato ou não sabemos como terminou', pinned: true }] },
    { id: 'q6a', chapter: 1, kind: 'single', shuffle: true,
      label: function (a) {
        return hadOwnContact(a)
          ? 'Onde ficou registrado o próximo passo desse contato?'
          : 'Se alguém pedisse preço hoje, onde o projeto registraria o próximo passo?';
      },
      options: [
        { id: 'crm', label: 'Em um sistema ou CRM acessível ao projeto' },
        { id: 'spreadsheet', label: 'Em uma planilha' },
        { id: 'agenda', label: 'Em uma agenda ou lista de tarefas' },
        { id: 'chat', label: 'Na conversa do WhatsApp ou da rede social' },
        { id: 'memory', label: 'Na memória de uma pessoa' },
        { id: 'not_recorded', label: 'Não registramos', pinned: true },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q8', chapter: 2, kind: 'single', shuffle: true,
      label: 'Qual frase descreve melhor o plano que você acabou de ver?',
      options: [
        { id: 'structure_project_operates', tier: 'estrutura', label: 'O projeto musical montaria seu escritório digital e usaria a estrutura para gerar e administrar os próprios clientes' },
        { id: 'structure_page_only', tier: 'estrutura', label: 'O plano serviria somente como página de divulgação, sem organizar a atividade comercial' },
        { id: 'structure_eshows_operates', tier: 'estrutura', label: 'A eshows assumiria a rotina comercial no lugar da equipe do projeto' },
        { id: 'structure_replaces_free', tier: 'estrutura', label: 'A operação gratuita atual seria substituída por este plano' },
        { id: 'premium_assisted_then_project_operates', tier: 'premium', label: 'A eshows ajudaria a implantar a operação e os primeiros ciclos de campanha; depois o projeto continuaria usando a estrutura' },
        { id: 'premium_no_transition', tier: 'premium', label: 'A eshows assumiria a rotina comercial sem prazo de transição para o projeto' },
        { id: 'premium_software_only', tier: 'premium', label: 'O Premium seria somente acesso ao software, sem implantação assistida' },
        { id: 'premium_replaces_free', tier: 'premium', label: 'A operação gratuita atual seria substituída por este plano' }] },
    { id: 'q8b', chapter: 2, kind: 'single', shuffle: true,
      label: 'Qual destas afirmações também é verdadeira?',
      options: [
        { id: 'fixed_monthly_no_percentage_no_guarantee', label: 'A mensalidade é fixa, a eshows não recebe percentual do cachê e não há garantia de shows' },
        { id: 'monthly_plus_percentage', label: 'A mensalidade fixa viria acompanhada de percentual sobre cada cachê' },
        { id: 'pay_per_opportunity', label: 'A mensalidade compra o direito de desbloquear cada oportunidade individual' },
        { id: 'free_becomes_paid', label: 'A operação gratuita atual passaria a exigir esta assinatura' }] },
    { id: 'q10', chapter: 3, kind: 'single',
      label: 'Considerando exatamente este plano e este preço, qual seria sua decisão hoje?',
      options: [
        { id: 'would_join', tier: 'estrutura', label: 'Entraria e aceitaria a cobrança descrita', pinned: true },
        { id: 'would_request', tier: 'premium', label: 'Solicitaria a entrada e, se o projeto atendesse aos critérios operacionais e houvesse capacidade de implantação, aceitaria a cobrança descrita', pinned: true },
        { id: 'only_with_trial', label: 'Entraria somente se pudesse testar antes', pinned: true },
        { id: 'wait_others', label: 'Esperaria outros artistas usarem primeiro', pinned: true },
        { id: 'would_not', label: 'Não entraria nesse formato', pinned: true }] },
    { id: 'q20', chapter: 4, kind: 'single',
      label: 'Qual próximo passo você topa dar hoje?',
      options: [
        { id: 'meeting', label: 'Marcar uma conversa de 15 minutos sobre o piloto', pinned: true },
        { id: 'updates', label: 'Receber novidades pelo WhatsApp, sem aderir agora', pinned: true },
        { id: 'not_now', label: 'Não quero participar agora', pinned: true }] },
  ];

  var COMP = [
    { id: 'q11', chapter: 5, kind: 'single', shuffle: true,
      label: function (a) { return q10Positive(a) ? 'O que mais pesou a favor?' : 'O que mais pesou contra?'; },
      options: [
        { id: 'fav_fixed_price', label: 'Valor mensal fixo sem percentual sobre o cachê' },
        { id: 'fav_all_in_one', label: 'Ter materiais, contatos, vendas, agenda e números no mesmo escritório' },
        { id: 'fav_autonomy', label: 'Autonomia do projeto musical' },
        { id: 'fav_trust', label: 'Confiança na eshows' },
        { id: 'fav_setup_help', tier: 'premium', label: 'Ajuda para configurar a operação' },
        { id: 'fav_learn_campaigns', tier: 'premium', label: 'Aprender a colocar campanhas próprias em funcionamento' },
        { id: 'against_price', label: 'O valor mensal é alto' },
        { id: 'against_pay_before_result', label: 'Não quero pagar antes de observar resultado' },
        { id: 'against_unclear', label: 'Ainda não entendi o que está incluído' },
        { id: 'against_too_much_work', tier: 'estrutura', label: 'Fazer tudo sozinho exigiria trabalho demais' },
        { id: 'against_assist_short', tier: 'premium', label: 'O período assistido parece curto ou pouco claro' },
        { id: 'against_no_autonomy_belief', tier: 'premium', label: 'Não acredito que o apoio me deixará capaz de operar sozinho' },
        { id: 'against_no_commercial_routine', label: 'Não quero assumir a rotina comercial do projeto' },
        { id: 'against_no_need', label: 'Não preciso da estrutura' },
        { id: 'against_status_quo', label: 'Prefiro continuar como hoje' },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q11b', chapter: 5, kind: 'single', shuffle: true,
      label: 'Antes de pagar, o que você mais precisaria ver para confiar nessa proposta?',
      options: [
        { id: 'exact_list', label: 'Lista exata do que estará disponível no lançamento' },
        { id: 'demo', label: 'Demonstração da estrutura' },
        { id: 'real_result', label: 'Resultado real de outro projeto musical' },
        { id: 'full_flow', label: 'Ver um contato percorrer o fluxo completo, da chegada ao fechamento' },
        { id: 'trial', label: 'Período de teste' },
        { id: 'clear_rules', label: 'Regra clara de cancelamento, troca de nível e reembolso' },
        { id: 'implementation_plan', tier: 'premium', label: 'Plano de implantação, duração e entregas do apoio' },
        { id: 'autonomy_case', tier: 'premium', label: 'Caso de projeto que passou a operar campanhas sozinho' },
        { id: 'talk_to_someone', label: 'Conversar com alguém da eshows' },
        { id: 'nothing', label: 'Nada me faria pagar por isso hoje', pinned: true },
        { id: 'other', label: 'Outra coisa', pinned: true }] },
    { id: 'q12', chapter: 5, kind: 'single',
      label: 'Se estes fossem os dois planos disponíveis hoje, qual você escolheria para seu projeto musical?',
      options: [
        { id: 'estrutura', label: 'Plano Estrutura', pinned: true },
        { id: 'premium', label: 'Plano Premium', pinned: true },
        { id: 'none', label: 'Não escolheria nenhum; continuaria como hoje', pinned: true }] },
    { id: 'q13', chapter: 5, kind: 'text', optional: true, maxLen: 300,
      label: function (a) {
        return a.q12 === 'none'
          ? 'O que precisaria mudar para alguma opção fazer sentido?'
          : 'Por que esse plano faz mais sentido para seu projeto musical?';
      } },
    { id: 'q15', chapter: 5, kind: 'text', optional: true, maxLen: 300,
      label: 'Depois de ver a lista, qual trabalho importante do escritório do projeto ficou de fora? Descreva o que você precisa conseguir fazer, não o nome de uma ferramenta.' },
    { id: 'q15a', chapter: 5, kind: 'multi', optional: true,
      label: 'O que você preferiria continuar resolvendo do jeito que resolve hoje, em vez de levar para esse escritório?',
      options: [
        { id: 'presence', label: 'Perfil, catálogo e página profissional', pinned: true },
        { id: 'campaigns', label: 'Campanhas e captação de contatos', pinned: true },
        { id: 'clients', label: 'Lista de clientes, histórico e retornos', pinned: true },
        { id: 'pricing', label: 'Preço, proposta e contrato', pinned: true },
        { id: 'agenda', label: 'Agenda, equipe e produção', pinned: true },
        { id: 'billing', label: 'Cobrança, recebimentos e financeiro', pinned: true },
        { id: 'tracking', label: 'Acompanhamento de contatos, propostas, shows e faturamento', pinned: true },
        { id: 'none', label: 'Nenhuma dessas; tentaria centralizar todas', exclusive: true, pinned: true },
        { id: 'dont_know', label: 'Não sei ainda', exclusive: true, pinned: true }] },
    { id: 'q14', chapter: 5, kind: 'single',
      label: 'Se a pessoa que organiza o projeto parasse hoje, o restante da equipe conseguiria encontrar os contatos, conversas, preços, propostas e próximos retornos?',
      options: [
        { id: 'centralized', label: 'Sim, está tudo centralizado e acessível', pinned: true },
        { id: 'mostly', label: 'Conseguiria encontrar a maior parte, com algum trabalho', pinned: true },
        { id: 'in_whatsapp', label: 'Uma parte importante está no WhatsApp ou nos arquivos de uma pessoa', pinned: true },
        { id: 'not_organized', label: 'Quase nada está organizado para outra pessoa continuar', pinned: true },
        { id: 'solo_hard', label: 'Sou projeto solo, mas também teria dificuldade de recuperar o histórico', pinned: true },
        { id: 'dont_know', label: 'Não sei', pinned: true }] },
    { id: 'q16', chapter: 5, kind: 'single', shuffle: true,
      label: 'Depois de 3 meses, qual resultado mais faria você dizer que o escritório digital valeu a pena?',
      options: [
        { id: 'always_ready', label: 'Ter perfil, materiais e informações sempre prontos' },
        { id: 'no_lost_contacts', label: 'Não perder contatos, retornos ou propostas' },
        { id: 'own_campaigns', label: 'Conseguir colocar campanhas próprias no ar' },
        { id: 'more_conversations', label: 'Gerar mais conversas com possíveis clientes pelos meus canais' },
        { id: 'faster_closing', label: 'Enviar propostas e fechar mais rápido' },
        { id: 'more_own_shows', label: 'Fechar mais shows gerados pelo próprio projeto' },
        { id: 'save_time', label: 'Economizar tempo na operação' },
        { id: 'all_in_one_view', label: 'Enxergar contatos, propostas, agenda e faturamento em um só lugar' },
        { id: 'none_enough', label: 'Nenhum desses seria suficiente', pinned: true },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q17', chapter: 5, kind: 'single',
      label: 'Considerando o plano e o preço que continuariam em vigor depois de 3 meses, qual destes resultados, sozinho, já seria suficiente para justificar continuar pagando?',
      help: 'Contato qualificado é uma pessoa ou empresa identificada, com necessidade real, que aceita conversar dentro de uma faixa de preço aprovada pelo projeto. Não é show garantido.',
      options: [
        { id: 'organization', label: 'A organização e a economia de tempo já poderiam justificar', pinned: true },
        { id: 'no_lost', label: 'Parar de perder contatos e retornos já poderia justificar', pinned: true },
        { id: 'one_lead', label: 'Gerar pelo menos 1 novo contato qualificado pelos canais do projeto', pinned: true },
        { id: 'two_three_leads', label: 'Gerar de 2 a 3 novos contatos qualificados pelos canais do projeto', pinned: true },
        { id: 'one_proposal', label: 'Enviar pelo menos 1 proposta que eu não enviaria hoje', pinned: true },
        { id: 'one_show', label: 'Fechar pelo menos 1 show a mais com esforço do próprio projeto', pinned: true },
        { id: 'depends_value', label: 'Dependeria do valor do show fechado', pinned: true },
        { id: 'dont_know', label: 'Não sei', pinned: true }] },
    { id: 'q18', chapter: 5, kind: 'single',
      label: 'Considerando apenas o que o próprio projeto conseguiria fazer com essa estrutura para construir e operar sua carteira, ela resolveria um problema relevante na sua rotina?',
      options: [
        { id: 'definitely_yes', label: 'Com certeza sim', pinned: true },
        { id: 'probably_yes', label: 'Provavelmente sim', pinned: true },
        { id: 'maybe', label: 'Talvez', pinned: true },
        { id: 'probably_not', label: 'Provavelmente não', pinned: true },
        { id: 'definitely_not', label: 'Com certeza não', pinned: true }] },
    { id: 'q19', chapter: 5, kind: 'single',
      label: 'Se o projeto fechasse por conta própria um show a mais em um mês, o que provavelmente aconteceria com seus shows em bares e restaurantes?',
      options: [
        { id: 'additional', label: 'Eu faria o evento além dos shows que já faço', pinned: true },
        { id: 'replace_one', label: 'Eu substituiria 1 show de bar ou restaurante', pinned: true },
        { id: 'replace_two_plus', label: 'Eu substituiria 2 ou mais shows de bar ou restaurante', pinned: true },
        { id: 'depends', label: 'Dependeria da data e do cachê', pinned: true },
        { id: 'dont_know', label: 'Não sei', pinned: true }] },
    { id: 'q7', chapter: 5, kind: 'single', shuffle: true,
      label: 'Qual destas partes mais atrapalha o projeto a funcionar como um escritório hoje?',
      options: [
        { id: 'presence', label: 'Ter uma apresentação profissional sempre atualizada' },
        { id: 'discovery', label: 'Fazer pessoas novas encontrarem o projeto' },
        { id: 'campaigns', label: 'Criar e acompanhar campanhas de divulgação' },
        { id: 'follow_up', label: 'Guardar contatos e lembrar de responder ou cobrar retorno' },
        { id: 'pricing', label: 'Definir preço e enviar proposta' },
        { id: 'contracts', label: 'Organizar contrato, sinal e cobrança' },
        { id: 'operations', label: 'Controlar agenda, equipe e produção' },
        { id: 'funnel_visibility', label: 'Saber quantos contatos viraram proposta e show' },
        { id: 'finances', label: 'Acompanhar faturamento, custos e recebimentos' },
        { id: 'retention', label: 'Fazer clientes voltarem ou indicarem o projeto' },
        { id: 'none', label: 'Nenhuma dessas', pinned: true },
        { id: 'other', label: 'Outra', pinned: true }] },
    { id: 'q3', chapter: 5, kind: 'single', optional: true, showIf: hadOwnShow,
      label: 'Qual foi o valor total do cachê desse show, antes de dividir entre integrantes e descontar custos?',
      help: 'Sobre o show mais recente que o próprio projeto conseguiu.',
      options: [
        { id: 'under_800', label: 'Até R$ 799', pinned: true },
        { id: '800_1499', label: 'R$ 800 a R$ 1.499', pinned: true },
        { id: '1500_2999', label: 'R$ 1.500 a R$ 2.999', pinned: true },
        { id: '3000_5999', label: 'R$ 3.000 a R$ 5.999', pinned: true },
        { id: '6000_plus', label: 'R$ 6.000 ou mais', pinned: true },
        { id: 'prefer_not', label: 'Prefiro não responder', pinned: true }] },
    { id: 'q5', chapter: 5, kind: 'single',
      label: 'Em um mês típico dos últimos 3 meses, quanto o projeto gastou com ferramentas, site, anúncio, impulsionamento, material, assessor ou serviços para organizar a carreira e conseguir shows?',
      help: 'Não inclua divisão de cachê entre integrantes nem custos de execução do show.',
      options: [
        { id: 'zero', label: 'R$ 0', pinned: true },
        { id: '1_99', label: 'R$ 1 a R$ 99', pinned: true },
        { id: '100_299', label: 'R$ 100 a R$ 299', pinned: true },
        { id: '300_499', label: 'R$ 300 a R$ 499', pinned: true },
        { id: '500_plus', label: 'R$ 500 ou mais', pinned: true },
        { id: 'dont_know', label: 'Não sei', pinned: true },
        { id: 'prefer_not', label: 'Prefiro não responder', pinned: true }] },
    { id: 'q5b', chapter: 5, kind: 'single',
      label: 'Em uma semana comum, quanto tempo alguém do projeto gasta respondendo clientes, divulgando, fazendo proposta, organizando agenda, contrato ou cobrança?',
      options: [
        { id: 'under_1h', label: 'Menos de 1 hora', pinned: true },
        { id: '1_3h', label: '1 a 3 horas', pinned: true },
        { id: '4_7h', label: '4 a 7 horas', pinned: true },
        { id: '8_14h', label: '8 a 14 horas', pinned: true },
        { id: '15h_plus', label: '15 horas ou mais', pinned: true },
        { id: 'dont_know', label: 'Não sei', pinned: true }] },
    { id: 'q5c', chapter: 5, kind: 'single',
      label: 'Quem cuida da maior parte dessa operação hoje?',
      options: [
        { id: 'owner', label: 'Eu, dono do projeto', pinned: true },
        { id: 'member', label: 'Outro integrante', pinned: true },
        { id: 'shared', label: 'Dividimos entre integrantes', pinned: true },
        { id: 'agent', label: 'Empresário, agente ou escritório', pinned: true },
        { id: 'hired', label: 'Pessoa contratada pelo projeto', pinned: true },
        { id: 'nobody', label: 'Ninguém cuida de forma contínua', pinned: true },
        { id: 'other', label: 'Outro', pinned: true }] },
    { id: 'q9', chapter: 5, kind: 'text', optional: true, maxLen: 400,
      label: 'O que ficou confuso ou parece bom demais para ser verdade?' },
  ];

  var Q8_CORRECT = { estrutura: 'structure_project_operates', premium: 'premium_assisted_then_project_operates' };
  var Q8B_CORRECT = 'fixed_monthly_no_percentage_no_guarantee';
  var Q8_EXPLAIN = {
    estrutura: 'Na verdade: o projeto montaria o próprio escritório digital e continuaria responsável por atrair, negociar e fechar seus trabalhos. A eshows fornece a infraestrutura.',
    premium: 'Na verdade: a eshows ajudaria a implantar a operação e os primeiros ciclos de campanha por um período definido. Depois, o projeto continua operando com a estrutura.',
  };
  var Q8B_EXPLAIN = 'Na verdade: a cobrança seria só a mensalidade fixa. Sem percentual sobre o cachê, sem garantia de shows, e a operação gratuita atual continua como está.';

  var CHAPTERS_META = ['Como funciona hoje', 'O conceito do projeto', 'O preço real', 'Seu próximo passo'];

  var INTERS = {
    toConcept: {
      lines: ['OS TEMPOS MUDARAM.', 'AS FERRAMENTAS TAMBÉM.'],
      subs: [
        'Hoje, um artista com as ferramentas certas faz a diferença a favor da própria carreira. Sem empresário, sem intermediário, sem comissão. Uma estrutura pronta pra você dar o próximo passo.',
        'A seguir, o conceito do projeto. Ele ainda não existe: sua resposta decide como ele deve funcionar.',
      ],
    },
    toOffer: { lines: ['AGORA,', 'O PREÇO.'], sub: 'Este é um dos valores em estudo. Responda pensando na situação real do seu projeto hoje.' },
    toCommit: { lines: ['FALTA POUCO.'], sub: 'Últimas duas telas. O que você escolher aqui é o que vamos considerar.' },
  };

  var CONCEPT = {
    estrutura: [
      'Estamos estudando uma assinatura opcional para o projeto musical montar o próprio escritório digital.',
      'Em um só lugar, o projeto poderia organizar presença profissional, contatos, campanhas, propostas, agenda, contratos, cobrança e números da carreira, usando apenas os módulos realmente disponíveis no lançamento.',
      'A eshows entraria com a estrutura para você fazer isso melhor e mais rápido: organizar os contatos, definir preço, fechar proposta e contrato, acompanhar os números. As decisões, os clientes e o cachê continuariam sendo seus, sem intermediário.',
      'A cobrança seria só a mensalidade fixa: sem percentual sobre o cachê, o que você fechar é seu. E não é uma fila de shows prontos: é a estrutura pra você fechar os seus. Os bares e restaurantes de hoje seguem como estão.'],
    premium: [
      'O Premium teria o mesmo escritório digital, com apoio da eshows para configurar a operação e colocar os primeiros ciclos de campanha em funcionamento.',
      'Os contatos gerados nesses ciclos entrariam no escritório do projeto, que faria o atendimento e a contratação. O projeto participaria da implantação, teria acesso aos processos e dados e assumiria a rotina depois do período assistido.',
      'A ideia é aumentar sua capacidade de gerar e administrar os próprios shows, não terceirizar essa responsabilidade para sempre.',
      'A cobrança seria só a mensalidade fixa: sem percentual sobre o cachê, o que você fechar é seu. Os bares e restaurantes de hoje seguem como estão.'],
  };

  function offerCard(tier, priceCents) {
    var price = priceCents != null
      ? 'R$ ' + Math.round(priceCents / 100).toLocaleString('pt-BR') + ' por mês'
      : '[valor em definição] por mês';
    if (tier === 'estrutura') {
      return { name: 'Plano Estrutura, operação própria', price: price, paragraphs: [
        'Escritório digital do projeto musical com presença profissional, contatos, campanhas, propostas, agenda, contratos, cobrança e números da carreira. O projeto configura seus materiais, canais, contatos, propostas, agenda e acompanhamento e opera tudo por conta própria.',
        'A eshows não recebe percentual do cachê. A primeira mensalidade é cobrada no lançamento, em [data a definir].'] };
    }
    return { name: 'Plano Premium, implantação e aceleração assistidas', price: price, paragraphs: [
      'O mesmo escritório digital, com [duração e entregas aprovadas] de implantação, orientação e ciclos assistidos de campanha.',
      'Os contatos gerados nos ciclos entram na operação do projeto. O projeto participa, atende, recebe processo e dados e assume a rotina depois do período assistido. Não há volume mínimo garantido, e a eshows não se torna responsável permanente por gerar shows.',
      'O período assistido depende de [critérios operacionais publicados] e de capacidade de implantação. Esses critérios não avaliam qualidade artística nem dão prioridade na distribuição dos shows atuais.',
      'A eshows não recebe percentual do cachê. A primeira mensalidade é cobrada no lançamento, em [data a definir].'] };
  }
  var OFFER_COMMON = 'A assinatura pertence ao projeto musical e deve ser aceita pelo dono do projeto. A operação gratuita atual da plataforma continua como está. [Inserir política real de cancelamento, troca de nível e reembolso.]';

  var TOOLS = [
    { num: '01', name: 'Perfil e marca', shot: 'assets/shots/epk.webp', video: 'assets/shots/epk.mp4', phone: true,
      alt: 'EPK da artista Marina Vale: foto ao vivo, release, vídeos e botão de pedir orçamento',
      desc: 'A IA monta uma página profissional do seu projeto: fotos, vídeos, release e repertório. Você manda o link para o contratante e ele vê tudo o que precisa para decidir.' },
    { num: '02', name: 'Clientes', shot: 'assets/shots/crm.webp', video: 'assets/shots/crm.mp4',
      alt: 'Tela de clientes: lista de casas com status de cada negociação e histórico de conversa',
      desc: 'Uma lista organizada de todas as casas e contratantes do projeto. Para cada um: o que foi conversado, o preço cobrado e quando voltar a falar. Nada se perde na conversa do WhatsApp.' },
    { num: '03', name: 'Inteligência', shot: 'assets/shots/ia.webp', video: 'assets/shots/ia.mp4',
      alt: 'Tela de inteligência: preço sugerido por evento, data livre pra oferecer e casas compatíveis',
      desc: 'A IA analisa seu perfil e o mercado da sua região. Sugere o preço por tipo de evento, indica casas que contratam o seu estilo e avisa a melhor hora de oferecer uma data livre.' },
    { num: '04', name: 'Contrato e pagamento', shot: 'assets/shots/contrato.webp', video: 'assets/shots/contrato.mp4',
      alt: 'Contrato digital assinado pelas duas partes, com sinal guardado até o show acontecer',
      desc: 'A proposta aceita vira um contrato digital, assinado no celular. O sinal fica guardado no sistema e só é liberado depois do show. Você não precisa mais cobrar o cliente por mensagem.' },
    { num: '05', name: 'Números', shot: 'assets/shots/numeros.webp', video: 'assets/shots/numeros.mp4',
      alt: 'Painel de números: faturamento do mês, shows tocados, taxa de fechamento e previsão',
      desc: 'Um painel com o faturamento do mês, os shows tocados, quantas propostas viraram contrato e a previsão do próximo mês. Você sabe exatamente quanto o projeto está ganhando.' },
    { num: '06', name: 'Alcance', shot: 'assets/shots/growth.webp', video: 'assets/shots/growth.mp4',
      alt: 'Campanha de e-mail pronta: agenda de outubro enviada pra quem já contratou o projeto',
      desc: 'O sistema escreve e envia campanhas de e-mail para quem já contratou o projeto. Quando sua agenda abre, seus clientes ficam sabendo primeiro.' },
  ];

  // ───────────────────────── estado + fases ─────────────────────────
  var state = { tier: 'estrutura', priceCents: null, isTest: false, answers: {}, maxdiff: [], inWaitlist: false };
  var shuffleCache = {};

  function showFase(id) {
    document.querySelectorAll('.ed-fase').forEach(function (f) { f.classList.remove('on'); });
    document.getElementById('fase-' + id).classList.add('on');
    // snap página-a-página só na intro (proximity: nunca sequestra o scroll)
    var snapOn = id === 'ato1';
    document.documentElement.style.scrollSnapType = snapOn ? 'y proximity' : '';
    document.body.classList.toggle('ed-snap', snapOn);
    window.scrollTo(0, 0);
    flushEvents();
  }

  // ───────────────────────── Ato 1 ─────────────────────────
  function initAto1() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('#fase-ato1 .rv').forEach(function (n) { io.observe(n); });
    track('privacy_notice_seen');
    document.querySelectorAll('.js-comecar').forEach(function (btn) {
      btn.addEventListener('click', function () {
        track('privacy_acknowledged');
        track('survey_started');
        startRunner('core');
      });
    });
  }

  // ───────────────────────── Runner ─────────────────────────
  var runner = null;

  function visibleQuestions(list) {
    return list.filter(function (q) { return !q.showIf || q.showIf(state.answers); });
  }
  function buildCoreScreens() {
    var blocoA = visibleQuestions(CORE.filter(function (q) { return q.chapter === 1; }))
      .map(function (q) { return { type: 'question', q: q }; });
    var find = function (id) { return CORE.filter(function (q) { return q.id === id; })[0]; };
    var screens = blocoA.concat([
      { type: 'inter', key: 'toConcept' },
      { type: 'concept' },
      { type: 'question', q: find('q8') },
      { type: 'question', q: find('q8b') },
      { type: 'inter', key: 'toOffer' },
      { type: 'offer' },
      { type: 'question', q: find('q10') },
      { type: 'inter', key: 'toCommit' },
      { type: 'question', q: find('q20') },
    ]);
    if (state.answers.q20 === 'meeting' || state.answers.q20 === 'updates') screens.push({ type: 'contact' });
    screens.push({ type: 'submitting' });
    return screens;
  }
  function buildCompScreens(withInvite) {
    var screens = withInvite ? [{ type: 'comp_invite' }] : [];
    visibleQuestions(COMP).forEach(function (q) {
      if (q.id === 'q15') {
        screens.push({ type: 'maxdiff', position: 1 });
        screens.push({ type: 'maxdiff', position: 2 });
      }
      screens.push({ type: 'question', q: q });
    });
    return screens;
  }

  function startRunner(module, opts) {
    runner = { module: module, idx: 0, dir: 'fwd' };
    runner.screens = module === 'core' ? buildCoreScreens() : buildCompScreens(!(opts && opts.noInvite));
    showFase('runner');
    renderRunner();
  }
  function rebuildScreens() {
    var cur = runner.screens[runner.idx];
    var hadInvite = runner.screens[0] && runner.screens[0].type === 'comp_invite';
    runner.screens = runner.module === 'core' ? buildCoreScreens() : buildCompScreens(hadInvite);
    // realinhar idx pela identidade da tela atual
    for (var i = 0; i < runner.screens.length; i++) {
      var s = runner.screens[i];
      if (s.type === cur.type &&
          (s.type !== 'question' || s.q.id === cur.q.id) &&
          (s.type !== 'inter' || s.key === cur.key) &&
          (s.type !== 'maxdiff' || s.position === cur.position)) { runner.idx = i; break; }
    }
  }
  function next() {
    rebuildScreens();
    if (runner.idx >= runner.screens.length - 1 && runner.module === 'comp') {
      call('complete', { dismissed: false, event_id: uid() }).catch(function () {});
      showRetrato();
      return;
    }
    runner.dir = 'fwd';
    runner.idx = Math.min(runner.idx + 1, runner.screens.length - 1);
    renderRunner();
  }
  function back() {
    runner.dir = 'back';
    runner.idx = Math.max(runner.idx - 1, 0);
    renderRunner();
  }

  function chapterOf(s) {
    if (s.type === 'question') return s.q.chapter;
    if (s.type === 'inter') return s.key === 'toConcept' ? 2 : s.key === 'toOffer' ? 3 : 4;
    if (s.type === 'concept') return 2;
    if (s.type === 'offer') return 3;
    return runner.module === 'core' ? 4 : 5;
  }

  function renderProgress() {
    // painel lateral (split desktop): parte atual em Bebas + título
    var sidePart = document.getElementById('side-part');
    var sideTitle = document.getElementById('side-title');
    if (sidePart && sideTitle) {
      if (runner.module === 'core') {
        var ch = Math.min(chapterOf(runner.screens[runner.idx]), 4);
        sidePart.innerHTML = 'PARTE <span class="grad">' + ch + '</span>';
        sideTitle.textContent = CHAPTERS_META[ch - 1];
      } else {
        sidePart.innerHTML = '<span class="grad">EXTRA</span>';
        sideTitle.textContent = 'Opcional: o que teria mais valor pra você';
      }
    }
    var box = document.getElementById('runner-progress');
    box.innerHTML = '';
    if (runner.module === 'core') {
      var cur = Math.min(chapterOf(runner.screens[runner.idx]), 4);
      var label = el('div', { class: 'ed-progress__label' }, [
        el('span', { text: 'Parte ' + cur + ' de 4 · ' + CHAPTERS_META[cur - 1] }),
        state.isTest ? el('span', { text: 'teste', style: 'color:var(--amber)' }) : null,
      ]);
      var trackEl = el('div', { class: 'ed-progress__track' });
      for (var n = 1; n <= 4; n++) {
        var chScreens = runner.screens.filter(function (s) { return chapterOf(s) === n; });
        var done = runner.screens.filter(function (s, i) { return chapterOf(s) === n && i < runner.idx; }).length;
        var p = n < cur ? 1 : n > cur ? 0 : chScreens.length ? done / chScreens.length : 0;
        var seg = el('div', { class: 'ed-progress__seg' }, [el('i')]);
        seg.firstChild.style.setProperty('--p', p);
        trackEl.appendChild(seg);
      }
      box.appendChild(label); box.appendChild(trackEl);
    } else {
      var total = runner.screens.length;
      box.appendChild(el('div', { class: 'ed-progress__label' }, [
        el('span', { text: 'Parte extra · opcional' }),
        el('span', { text: Math.min(runner.idx + 1, total) + ' / ' + total }),
      ]));
      var t2 = el('div', { class: 'ed-progress__track' }, [el('div', { class: 'ed-progress__seg' }, [el('i')])]);
      t2.firstChild.firstChild.style.setProperty('--p', total ? (runner.idx + 1) / total : 0);
      box.appendChild(t2);
    }
  }

  function navBar(opts) {
    var nav = document.getElementById('runner-nav');
    nav.innerHTML = '';
    if (opts.back) nav.appendChild(el('button', { class: 'ed-btn ed-btn--quiet', type: 'button', text: '← Voltar', onclick: opts.back }));
    else nav.appendChild(el('span'));
    nav.appendChild(el('span', { class: 'ed-nav__spacer' }));
    if (opts.next && opts.showNext !== false) {
      var b = el('button', { class: 'ed-btn ed-btn--primary', type: 'button', text: (opts.label || 'Continuar') + ' →', onclick: opts.next });
      if (opts.disabled) b.disabled = true;
      nav.appendChild(b);
      nav.__next = b;
    }
  }

  function screenBox(animClass) {
    var host = document.getElementById('runner-screen');
    host.innerHTML = '';
    var box = el('div', { class: 'ed-screen ' + (animClass || (runner.dir === 'fwd' ? 'ed-screen-enter' : 'ed-screen-enter--back')) });
    host.appendChild(box);
    return box;
  }

  function seenTracker(elTarget, name) {
    call; // noop ref
    track(name.replace('_seen', '_served'));
    var fired = false, timer = null;
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      var covered = e.intersectionRect.height >= window.innerHeight * 0.5;
      if ((e.intersectionRatio >= 0.5 || covered) && !fired) {
        timer = setTimeout(function () {
          if (!fired && document.visibilityState === 'visible') { fired = true; track(name); }
        }, 1000);
      } else if (timer) { clearTimeout(timer); timer = null; }
    }, { threshold: [0, 0.25, 0.5] });
    io.observe(elTarget);
  }

  function renderRunner() {
    renderProgress();
    var s = runner.screens[runner.idx];
    var canBack = runner.idx > 0 && s.type !== 'submitting';

    if (s.type === 'question') return renderQuestion(s.q, canBack);
    if (s.type === 'inter') {
      var it = INTERS[s.key];
      var box = screenBox();
      box.className = 'ed-inter ' + (runner.dir === 'fwd' ? 'ed-screen-enter' : 'ed-screen-enter--back');
      var h = el('h2', { class: 'ed-display' });
      it.lines.forEach(function (l) { h.appendChild(el('span', { text: l, style: 'display:block' })); });
      box.appendChild(h);
      (it.subs || [it.sub]).forEach(function (t, i) {
        box.appendChild(el('p', { text: t, style: i ? 'margin-top:0.8rem' : '' }));
      });
      navBar({ back: canBack ? back : null, next: next });
      return;
    }
    if (s.type === 'concept') {
      var box2 = screenBox();
      box2.appendChild(el('p', { class: 'ed-eyebrow', text: 'O que estamos estudando', style: 'margin-bottom:1.2rem' }));
      var card = el('div', { class: 'ed-concept' });
      CONCEPT[state.tier].forEach(function (p) { card.appendChild(el('p', { text: p })); });
      box2.appendChild(card);
      seenTracker(card, 'concept_seen');
      navBar({ back: canBack ? back : null, next: next, label: 'Li, continuar' });
      return;
    }
    if (s.type === 'offer') {
      var box3 = screenBox();
      var offer = offerCard(state.tier, state.priceCents);
      var card3 = el('div', { class: 'ed-offer' });
      if (state.priceCents == null) card3.appendChild(el('span', { class: 'ed-draftflag', text: 'rascunho · preço em definição' }));
      card3.appendChild(el('p', { class: 'ed-offer__name', text: offer.name }));
      card3.appendChild(el('p', { class: 'ed-offer__price', text: offer.price }));
      offer.paragraphs.forEach(function (p) { card3.appendChild(el('p', { text: p })); });
      var terms = el('p', { class: 'ed-offer__common', text: OFFER_COMMON });
      card3.appendChild(terms);
      box3.appendChild(card3);
      seenTracker(card3, 'offer_seen');
      var tFired = false;
      var tio = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !tFired) { tFired = true; track('offer_terms_seen'); tio.disconnect(); }
      }, { threshold: 0.9 });
      tio.observe(terms);
      navBar({ back: canBack ? back : null, next: next });
      return;
    }
    if (s.type === 'contact') return renderContact(canBack);
    if (s.type === 'submitting') return renderSubmitting();
    if (s.type === 'comp_invite') {
      var box4 = screenBox();
      box4.appendChild(el('h2', { class: 'ed-display', text: 'TOPA MAIS 3 MINUTOS?', style: 'font-size:clamp(2.4rem,9vw,4rem);margin-bottom:1rem' }));
      box4.appendChild(el('p', { class: 'ed-body', text: 'São mais algumas perguntas, opcionais, sobre o que teria mais valor pra você. As respostas ajudam a decidir o que construir primeiro.' }));
      var row = el('div', { style: 'display:flex;gap:0.9rem;margin-top:2rem;flex-wrap:wrap' });
      row.appendChild(el('button', { class: 'ed-btn ed-btn--primary', type: 'button', text: 'Continuar →', onclick: next }));
      row.appendChild(el('button', { class: 'ed-btn ed-btn--ghost', type: 'button', text: 'Pular esta parte', onclick: function () {
        call('complete', { dismissed: true, event_id: uid() }).catch(function () {});
        showRetrato();
      } }));
      box4.appendChild(row);
      navBar({});
      return;
    }
    if (s.type === 'maxdiff') return renderMaxdiff(s.position, canBack);
  }

  // ── pergunta (single / multi / text) ──
  function renderQuestion(q, canBack) {
    track('question_seen', { question_id: q.id });
    var box = screenBox();
    var label = typeof q.label === 'function' ? q.label(state.answers) : q.label;
    box.appendChild(el('h2', { class: 'ed-screen__q', text: label }));
    if (q.help) box.appendChild(el('p', { class: 'ed-screen__help', text: q.help }));

    var options = (q.options || []).filter(function (o) { return !o.tier || o.tier === state.tier; });
    if (q.shuffle) {
      if (!shuffleCache[q.id]) {
        var loose = shuffleArr(options.filter(function (o) { return !o.pinned; }));
        shuffleCache[q.id] = loose.concat(options.filter(function (o) { return o.pinned; })).map(function (o) { return o.id; });
      }
      options = shuffleCache[q.id].map(function (id) {
        return options.filter(function (o) { return o.id === id; })[0];
      }).filter(Boolean);
    }
    var renderedOrder = options.map(function (o) { return o.id; });
    var isCheck = q.id === 'q8' || q.id === 'q8b';
    var saved = state.answers[q.id];

    function persist(value) {
      state.answers[q.id] = value;
      call('answer', { question_id: q.id, value: value, event_id: uid(), rendered_order: renderedOrder, client_ts: new Date().toISOString() }).catch(function () {});
      if (q.id === 'q10') track('intent_submitted', { payload: { value: value } });
      if (q.id === 'q20') track('commitment_selected', { payload: { value: value } });
    }

    if (q.kind === 'text') {
      var ta = el('textarea', { class: 'ed-textarea', maxlength: String(q.maxLen || 300), placeholder: 'Escreve do seu jeito' });
      if (typeof saved === 'string' && saved !== SKIP) ta.value = saved;
      var count = el('p', { class: 'ed-charcount', text: (ta.value.length) + '/' + (q.maxLen || 300) });
      ta.addEventListener('input', function () {
        count.textContent = ta.value.length + '/' + (q.maxLen || 300);
        if (navEl.__next) navEl.__next.textContent = (ta.value.trim() ? 'Continuar' : (q.optional ? 'Pular' : 'Continuar')) + ' →';
      });
      box.appendChild(ta); box.appendChild(count);
      var navEl = document.getElementById('runner-nav');
      navBar({ back: canBack ? back : null, label: (typeof saved === 'string' && saved !== SKIP) || !q.optional ? 'Continuar' : 'Pular', next: function () {
        persist(ta.value.trim() === '' ? SKIP : ta.value.trim());
        next();
      } });
      return;
    }

    var opts = el('div', { class: 'ed-opts', role: q.kind === 'single' ? 'radiogroup' : 'group' });
    var explainBox = null, locked = false;

    function refresh() {
      opts.querySelectorAll('.ed-opt').forEach(function (btn) {
        var id = btn.getAttribute('data-id');
        var sel = q.kind === 'single'
          ? state.answers[q.id] === id
          : Array.isArray(state.answers[q.id]) && state.answers[q.id].indexOf(id) !== -1;
        btn.setAttribute('aria-checked', sel ? 'true' : 'false');
      });
    }

    options.forEach(function (o) {
      var btn = el('button', {
        class: 'ed-opt' + (q.kind === 'multi' ? ' ed-opt--multi' : ''),
        type: 'button', role: q.kind === 'single' ? 'radio' : 'checkbox',
        'aria-checked': 'false', 'data-id': o.id,
      }, [el('span', { class: 'ed-opt__dot', 'aria-hidden': 'true' })]);
      btn.appendChild(document.createTextNode(o.label));
      btn.addEventListener('click', function () {
        if (q.kind === 'single') {
          if (locked) return;
          persist(o.id); refresh();
          if (isCheck) {
            var correct = q.id === 'q8' ? Q8_CORRECT[state.tier] === o.id : Q8B_CORRECT === o.id;
            if (!correct) {
              locked = true;
              explainBox = el('div', { class: 'ed-explain' }, [el('p', { text: q.id === 'q8' ? Q8_EXPLAIN[state.tier] : Q8B_EXPLAIN })]);
              box.appendChild(explainBox);
              navBar({ back: null, next: next, label: 'Entendi, continuar' });
              return;
            }
          }
          setTimeout(next, 350);
        } else {
          var cur = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
          var exclusiveIds = options.filter(function (x) { return x.exclusive; }).map(function (x) { return x.id; });
          var nextVal;
          if (o.exclusive) {
            nextVal = cur.indexOf(o.id) !== -1 ? [] : [o.id];
          } else {
            cur = cur.filter(function (id) { return exclusiveIds.indexOf(id) === -1; });
            nextVal = cur.indexOf(o.id) !== -1 ? cur.filter(function (id) { return id !== o.id; }) : cur.concat([o.id]);
          }
          state.answers[q.id] = nextVal;
          refresh();
          if (!q.optional && document.getElementById('runner-nav').__next) {
            document.getElementById('runner-nav').__next.disabled = nextVal.length === 0;
          }
        }
      });
      opts.appendChild(btn);
    });
    box.appendChild(opts);
    refresh();

    if (q.kind === 'multi') {
      navBar({
        back: canBack ? back : null,
        disabled: !q.optional && !(Array.isArray(saved) && saved.length),
        next: function () {
          persist(Array.isArray(state.answers[q.id]) ? state.answers[q.id] : []);
          next();
        },
      });
    } else {
      navBar({ back: canBack ? back : null, showNext: false });
    }
  }

  // ── contato (Q21) — vai pra ed_contacts, nunca pras respostas ──
  function renderContact(canBack) {
    var purpose = state.answers.q20 === 'meeting' ? 'meeting' : 'updates';
    var box = screenBox();
    box.appendChild(el('h2', { class: 'ed-screen__q', text: purpose === 'meeting' ? 'Fechado. Como a gente marca essa conversa?' : 'Fechado. Pra onde mandamos as novidades?' }));
    var grid = el('div', { style: 'display:grid;gap:1rem;margin-top:0.6rem' });
    var inName = el('input', { class: 'ed-input', id: 'ct-name', autocomplete: 'name' });
    var inWa = el('input', { class: 'ed-input', id: 'ct-wa', inputmode: 'tel', autocomplete: 'tel', placeholder: '(11) 9…' });
    grid.appendChild(el('div', { class: 'ed-field' }, [el('label', { for: 'ct-name', text: 'Seu nome' }), inName]));
    grid.appendChild(el('div', { class: 'ed-field' }, [el('label', { for: 'ct-wa', text: 'Seu WhatsApp' }), inWa]));
    function check(labelHtml) {
      var input = el('input', { type: 'checkbox' });
      var lab = el('label', { class: 'ed-check' }, [input, el('span', { html: labelHtml })]);
      grid.appendChild(lab);
      return input;
    }
    var ckPriv = check('Li o <a href="privacidade.html" target="_blank" rel="noreferrer">aviso de privacidade</a> desta pesquisa.');
    var ckWa = check('Quero receber pelo WhatsApp mensagens sobre este piloto.');
    var ckInt = check('Aceito ser convidado para uma entrevista sobre esta pesquisa.');
    var err = el('p', { style: 'color:var(--danger);font-size:0.92rem;display:none' });
    grid.appendChild(err);
    box.appendChild(grid);

    function updateNav() {
      var navEl = document.getElementById('runner-nav');
      if (navEl.__next) navEl.__next.disabled = !ckPriv.checked;
    }
    ckPriv.addEventListener('change', updateNav);
    navBar({
      back: canBack ? back : null,
      disabled: true,
      next: function () {
        var navEl = document.getElementById('runner-nav');
        if (navEl.__next) { navEl.__next.disabled = true; navEl.__next.textContent = 'Salvando… →'; }
        call('contact', {
          name: inName.value.trim() || undefined,
          whatsapp: inWa.value.trim() || undefined,
          privacy_ack: ckPriv.checked,
          whatsapp_opt_in: ckWa.checked,
          interview_opt_in: ckInt.checked,
          purpose: purpose,
          event_id: uid(),
        }).then(next).catch(function (e) {
          err.textContent = e.message || 'Falha ao salvar; tente de novo';
          err.style.display = 'block';
          if (navEl.__next) { navEl.__next.disabled = false; navEl.__next.textContent = 'Continuar →'; }
        });
      },
    });
    updateNav();
  }

  // ── envio transacional do núcleo ──
  function renderSubmitting() {
    var box = screenBox('');
    box.setAttribute('aria-live', 'polite');
    box.appendChild(el('h2', { class: 'ed-screen__q', text: 'Registrando suas respostas…' }));
    navBar({});
    var coreIds = CORE.map(function (q) { return q.id; });
    var payload = Object.keys(state.answers)
      .filter(function (id) { return coreIds.indexOf(id) !== -1; })
      .map(function (id) { return { question_id: id, value: state.answers[id] }; });
    function run() {
      call('submit', { answers: payload, event_id: uid(), client_ts: new Date().toISOString() })
        .then(function () {
          track('core_completed');
          startRunner('comp');
        })
        .catch(function (e) {
          box.innerHTML = '';
          box.appendChild(el('h2', { class: 'ed-screen__q', text: 'Não foi dessa vez.' }));
          box.appendChild(el('p', { class: 'ed-screen__help', text: 'Suas respostas estão guardadas aqui no aparelho; só faltou a conexão. ' + (e.message || '') }));
          box.appendChild(el('button', { class: 'ed-btn ed-btn--primary', type: 'button', text: 'Tentar de novo', onclick: function () { renderSubmitting(); } }));
        });
    }
    run();
  }

  // ── MaxDiff ──
  var mdOrder = {};
  function renderMaxdiff(position, canBack) {
    track('question_seen', { question_id: 'maxdiff_' + position });
    var task = state.maxdiff.filter(function (t) { return t.position === position; })[0];
    if (!task) { next(); return; }
    var already = task.best_item != null && task.worst_item != null;
    var best = already ? task.best_item : null;
    var worst = already ? task.worst_item : null;

    if (!mdOrder[position]) mdOrder[position] = shuffleArr(task.items.map(function (i) { return i.id; }));
    var items = mdOrder[position].map(function (id) {
      return task.items.filter(function (i) { return i.id === id; })[0];
    });

    var box = screenBox();
    box.appendChild(el('p', { class: 'ed-eyebrow', text: 'Grupo ' + position + ' de 2', style: 'margin-bottom:0.8rem' }));
    box.appendChild(el('h2', { class: 'ed-screen__q', text: 'Em cada grupo, toque primeiro no item que faria mais diferença para você assinar. Depois, no que faria menos diferença.' }));
    var stage = el('p', { class: 'ed-md__stage', 'aria-live': 'polite' });
    box.appendChild(stage);
    var opts = el('div', { class: 'ed-opts' });
    box.appendChild(opts);
    var undoRow = el('div', { style: 'margin-top:0.9rem;display:none' });
    var undoBtn = el('button', { class: 'ed-btn ed-btn--quiet', type: 'button', text: 'Desfazer' });
    undoRow.appendChild(undoBtn);
    box.appendChild(undoRow);

    function refresh() {
      stage.textContent = already ? 'Você já respondeu este grupo.'
        : best == null ? '1º toque: o que faria MAIS diferença'
        : worst == null ? '2º toque: o que faria MENOS diferença'
        : 'Pronto. Confere e continua.';
      undoRow.style.display = (!already && best != null) ? 'block' : 'none';
      opts.innerHTML = '';
      items.forEach(function (it) {
        var role = best === it.id ? 'best' : worst === it.id ? 'worst' : null;
        var wrap = el('div', { class: 'ed-md__item' });
        if (role) wrap.setAttribute('data-role', role);
        var btn = el('button', { class: 'ed-opt', type: 'button' }, [el('span', { class: 'ed-opt__dot', 'aria-hidden': 'true' })]);
        btn.appendChild(document.createTextNode(it.label));
        btn.addEventListener('click', function () {
          if (already) return;
          if (best == null) best = it.id;
          else if (worst == null && it.id !== best) worst = it.id;
          refresh(); updateNav();
        });
        wrap.appendChild(btn);
        if (role) wrap.appendChild(el('span', { class: 'ed-md__tag', text: role === 'best' ? 'Mais diferença' : 'Menos diferença' }));
        opts.appendChild(wrap);
      });
    }
    undoBtn.addEventListener('click', function () {
      if (worst != null) worst = null; else best = null;
      refresh(); updateNav();
    });
    function updateNav() {
      var navEl = document.getElementById('runner-nav');
      if (navEl.__next) navEl.__next.disabled = !already && (best == null || worst == null);
    }
    navBar({
      back: canBack ? back : null,
      disabled: !already,
      next: function () {
        if (already) { next(); return; }
        var navEl = document.getElementById('runner-nav');
        if (navEl.__next) { navEl.__next.disabled = true; navEl.__next.textContent = 'Salvando… →'; }
        call('maxdiff', {
          position: position, task_no: task.task_no,
          best_item: best, worst_item: worst,
          rendered_order: mdOrder[position], event_id: uid(),
        }).then(function () {
          task.best_item = best; task.worst_item = worst;
          next();
        }).catch(function () {
          if (navEl.__next) { navEl.__next.disabled = false; navEl.__next.textContent = 'Continuar →'; }
        });
      },
    });
    refresh(); updateNav();
  }

  // ───────────────────────── Retrato ─────────────────────────
  function buildRetrato(a) {
    var lines = [];
    var m1 = {
      chat: 'Hoje, os contatos do seu projeto ficam registrados no WhatsApp.',
      memory: 'Hoje, o próximo passo de cada contato depende da memória de alguém.',
      spreadsheet: 'Hoje, o controle do seu projeto está numa planilha.',
      agenda: 'Hoje, os compromissos do projeto ficam anotados na agenda.',
      crm: 'Seu projeto já registra os contatos num sistema próprio.',
      not_recorded: 'Hoje, o próximo passo dos contatos não fica registrado.',
      other: 'Hoje, cada contato do projeto é registrado num lugar diferente.',
    };
    if (m1[a.q6a]) lines.push(m1[a.q6a]);
    var m2 = {
      none: 'Nos últimos 3 meses, os shows do projeto vieram de propostas prontas, não de venda própria.',
      '1': 'Nos últimos 3 meses, o projeto conseguiu 1 show por conta própria.',
      '2_3': 'Nos últimos 3 meses, o projeto conseguiu de 2 a 3 shows por conta própria.',
      '4_6': 'Nos últimos 3 meses, o projeto conseguiu de 4 a 6 shows por conta própria.',
      '7_10': 'Nos últimos 3 meses, o projeto conseguiu de 7 a 10 shows por conta própria.',
      '11_plus': 'Nos últimos 3 meses, o projeto conseguiu 11 shows ou mais por conta própria.',
    };
    if (m2[a.q1]) lines.push(m2[a.q1]);
    var m3 = {
      responding: 'O contato mais recente ainda está na conversa inicial.',
      confirmed_need: 'O contato mais recente parou na confirmação de data e preço.',
      sent_proposal: 'O contato mais recente parou depois da proposta enviada.',
      negotiating: 'O contato mais recente está em negociação.',
      closed: 'O contato mais recente virou show fechado.',
      client_left: 'No contato mais recente, o cliente escolheu outra opção.',
      lost_track: 'O projeto perdeu o rastro do contato mais recente.',
    };
    if (m3[a.q6]) lines.push(m3[a.q6]);
    if (Array.isArray(a.q5a) && a.q5a.length) {
      if (a.q5a.indexOf('none') !== -1) lines.push('E não existe uma estrutura definida para organizar isso.');
      else lines.push(a.q5a.length === 1
        ? 'Para organizar tudo isso, o projeto usa 1 ferramenta.'
        : 'Para organizar tudo isso, o projeto usa ' + a.q5a.length + ' ferramentas diferentes.');
    }
    if (!lines.length) lines.push('Você contou como o seu projeto trabalha hoje. Obrigado.');
    return lines;
  }
  function showRetrato() {
    var host = document.getElementById('retrato-lines');
    host.innerHTML = '';
    buildRetrato(state.answers).forEach(function (l) { host.appendChild(el('p', { text: l })); });
    showFase('retrato');
  }

  // ───────────────────────── Ato 3 ─────────────────────────
  var ato3Started = false;
  function showAto3() {
    showFase('ato3');
    if (ato3Started) return;
    ato3Started = true;
    renderTools();
    initWaitlist();
    initReveals();
    initFilm();
    track('reveal_film_started');
  }

  function mockMedia(tool, cls) {
    if (tool.video && !reduceMotion) {
      var v = el('video', { class: cls || '', src: tool.video, poster: tool.shot, muted: '', loop: '', autoplay: '', playsinline: '', preload: 'metadata', 'aria-label': tool.alt });
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
      return v;
    }
    return el('img', { class: cls || '', src: tool.shot, alt: tool.alt, loading: 'lazy', decoding: 'async' });
  }

  function renderTools() {
    var host = document.getElementById('ed-tools');
    TOOLS.forEach(function (tool, i) {
      var fig = el('figure', { class: 'ed-tool__shot' + (tool.phone ? ' ed-tool__shot--phone' : '') });
      var zoomBtn = el('button', { class: 'ed-tool__zoom', type: 'button', 'aria-label': 'Ampliar: ' + tool.name, onclick: function () { openLightbox(tool); } });
      zoomBtn.appendChild(mockMedia(tool));
      zoomBtn.appendChild(el('span', {
        class: 'ed-tool__hint', 'aria-hidden': 'true',
        html: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21M8 10.5h5M10.5 8v5" stroke="currentColor" stroke-width="2" fill="none"/></svg>Ampliar',
      }));
      fig.appendChild(zoomBtn);
      var copy = el('div', { class: 'ed-tool__copy' }, [
        el('span', { class: 'ed-tool__num', text: tool.num }),
        el('p', { class: 'ed-tool__name', text: tool.name }),
        el('p', { class: 'ed-tool__desc', text: tool.desc }),
      ]);
      host.appendChild(el('div', { class: 'ed-tool rv' + (i % 2 === 1 ? ' ed-tool--flip' : '') }, [fig, copy]));
    });
  }

  var lbEl = null;
  function openLightbox(tool) {
    track('mockup_zoomed', { payload: { shot: tool.shot } });
    closeLightbox();
    var full = false;
    lbEl = el('div', { class: 'ed-lightbox', role: 'dialog', 'aria-label': tool.alt, onclick: closeLightbox });
    lbEl.appendChild(el('button', { class: 'ed-lightbox__close', type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: closeLightbox }));
    var stage = el('div', { class: 'ed-lightbox__stage' });
    stage.addEventListener('click', function (e) { e.stopPropagation(); });
    var media = mockMedia(tool, tool.phone ? 'is-phone' : '');
    var tip = el('p', { class: 'ed-lightbox__tip', 'aria-hidden': 'true', text: 'Toca na imagem pra ver em tamanho real' });
    media.addEventListener('click', function () {
      full = !full;
      lbEl.classList.toggle('is-full', full);
      tip.textContent = full ? 'Toca pra ajustar à tela' : 'Toca na imagem pra ver em tamanho real';
    });
    stage.appendChild(media);
    lbEl.appendChild(stage);
    lbEl.appendChild(tip);
    document.getElementById('lightbox-slot').appendChild(lbEl);
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', lbKey);
  }
  function lbKey(e) { if (e.key === 'Escape') closeLightbox(); }
  function closeLightbox() {
    if (!lbEl) return;
    lbEl.remove(); lbEl = null;
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', lbKey);
  }

  function initWaitlist() {
    var slot = document.getElementById('waitlist-slot');
    function renderDone() {
      slot.innerHTML = '';
      slot.appendChild(el('div', { class: 'ed-waitlist__done' }, [
        el('span', { class: 'ed-eq', 'aria-hidden': 'true', html: '<i></i><i></i><i></i><i></i><i></i>' }),
        el('span', { text: 'Anotado. Quando o escritório for lançado, você fica sabendo primeiro.' }),
      ]));
    }
    if (state.inWaitlist) { renderDone(); return; }
    var btn = el('button', { class: 'ed-btn ed-btn--primary', type: 'button', text: 'Quero entrar na fila →' });
    btn.addEventListener('click', function () {
      btn.disabled = true; btn.textContent = 'Anotando…';
      call('waitlist', { event_id: uid() }).then(function () {
        state.inWaitlist = true; renderDone();
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Quero entrar na fila →';
      });
    });
    slot.appendChild(btn);
  }

  function initReveals() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('#fase-ato3 .rv').forEach(function (n) { io.observe(n); });
  }

  // ── filme-scroll (controller da LP original, adaptado) ──
  function initFilm() {
    var root = document.getElementById('ato3-root');
    if (!window.gsap || !window.ScrollTrigger || reduceMotion) return; // fallback empilhado
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('ed-film-on');

    var coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var isMobile = function () { return coarse || window.innerWidth <= 860; };
    if (coarse) {
      ScrollTrigger.normalizeScroll({ allowNestedScroll: true });
      ScrollTrigger.config({ ignoreMobileResize: true });
    }

    var video = root.querySelector('.ed-stage__video');
    var section = root.querySelector('.ed-film-section');
    var rail = document.querySelector('.ed-rail');
    var fill = rail.querySelector('.ed-rail__fill');
    var dots = rail.querySelector('.ed-rail__dots');

    var chapters = [].slice.call(root.querySelectorAll('.ed-chapter[data-film]')).map(function (elc) {
      var f = (elc.getAttribute('data-film') || '0,1').split(',').map(Number);
      return { el: elc, filmStart: f[0], filmEnd: f[1], weight: Number(elc.getAttribute('data-weight') || 1), label: elc.getAttribute('data-label') || '' };
    });
    var totalWeight = chapters.reduce(function (s, c) { return s + c.weight; }, 0);
    var acc = 0;
    chapters.forEach(function (c) { c.zoneStart = acc / totalWeight; acc += c.weight; c.zoneEnd = acc / totalWeight; });
    function filmTimeAt(p) {
      var c = chapters.filter(function (x) { return p <= x.zoneEnd; })[0] || chapters[chapters.length - 1];
      var local = (p - c.zoneStart) / (c.zoneEnd - c.zoneStart);
      return c.filmStart + Math.min(Math.max(local, 0), 1) * (c.filmEnd - c.filmStart);
    }

    var store = { progress: 0, listeners: [], set: function (p) { this.progress = p; this.listeners.forEach(function (f) { f(p); }); }, on: function (f) { this.listeners.push(f); } };
    window.__edStore = store;

    var ready = false, primed = false, last = -1;
    if (isMobile()) video.poster = 'assets/film/palco-mobile-poster.webp';
    function load() {
      var src = isMobile() ? video.getAttribute('data-src-mobile') : video.getAttribute('data-src');
      fetch(src).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      }).then(function (blob) {
        video.src = URL.createObjectURL(blob);
        return new Promise(function (ok, err) {
          video.addEventListener('loadedmetadata', ok, { once: true });
          video.addEventListener('error', err, { once: true });
        });
      }).then(function () { ready = true; }).catch(function () { /* poster segura a cena */ });
    }
    function prime() {
      if (primed || !video.src) return;
      primed = true;
      var p = video.play();
      if (p && p.then) p.then(function () { video.pause(); }).catch(function () { primed = false; });
    }
    addEventListener('pointerdown', prime, { once: true, passive: true });
    addEventListener('touchstart', prime, { once: true, passive: true });

    // rampa mix: P&B → cor no clímax (72% → 92% do scroll)
    store.on(function (p) {
      var g = Math.max(0, Math.min(1, 1 - (p - 0.72) / 0.2));
      video.style.filter = 'grayscale(' + g.toFixed(3) + ') contrast(' + (1.04 + 0.08 * g).toFixed(3) + ') brightness(.9)';
      fill.style.transform = 'scaleY(' + p + ')';
    });

    var active = -1;
    function setChapter(i) {
      if (i === active) return;
      if (chapters[active]) chapters[active].el.classList.remove('is-active');
      active = i;
      chapters[i].el.classList.add('is-active');
      dots.querySelectorAll('.ed-rail__dot').forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    }
    var distance = function () { return Math.round(totalWeight * window.innerHeight * (isMobile() ? 1.25 : 1)); };
    var master = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: function () { return '+=' + distance(); },
      pin: root.querySelector('.ed-stage'),
      scrub: 0.4,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      fastScrollEnd: true,
      onUpdate: function (self) {
        store.set(self.progress);
        var i = -1;
        for (var k = 0; k < chapters.length; k++) if (self.progress <= chapters[k].zoneEnd) { i = k; break; }
        setChapter(i === -1 ? chapters.length - 1 : i);
      },
      onToggle: function (self) {
        rail.classList.toggle('show', self.isActive);
        rail.setAttribute('aria-hidden', String(!self.isActive));
        if (self.isActive) rail.removeAttribute('inert'); else rail.setAttribute('inert', '');
      },
    });
    chapters.forEach(function (c, i) {
      var b = el('button', { class: 'ed-rail__dot', type: 'button', 'aria-label': c.label, html: '<i></i>' });
      b.addEventListener('click', function () {
        var y = master.start + (c.zoneStart + 0.05) * (master.end - master.start);
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
      dots.appendChild(b);
    });
    function applyFrame() {
      if (!ready || video.seeking) return;
      var t = filmTimeAt(store.progress) * (video.duration || 0);
      if (Math.abs(t - last) < 1 / 30) return;
      last = t;
      try { video.currentTime = Math.min(t, (video.duration || 0.1) - 0.001); } catch (e) { /* noop */ }
    }
    gsap.ticker.add(applyFrame);
    setChapter(0);
    load();
  }

  // ───────────────────────── boot ─────────────────────────
  function boot() {
    if (!TOKEN) {
      showFase('invalid');
      return;
    }
    call('open').then(function (data) {
      state.tier = data.tier;
      state.priceCents = data.priceCents;
      state.isTest = data.isTest;
      state.answers = data.savedAnswers || {};
      state.maxdiff = data.maxdiff || [];
      state.inWaitlist = data.inWaitlist;

      if (data.instanceState === 'core_completed') {
        startRunner('comp');
      } else if (data.instanceState === 'survey_completed') {
        showRetrato();
      } else if (Object.keys(state.answers).length > 0) {
        startRunner('core');
      } else {
        showFase('ato1');
        initAto1();
      }
    }).catch(function (e) {
      var msg = document.getElementById('invalid-msg');
      if (/expired/.test(e.message)) {
        msg.textContent = 'Este convite expirou. Se você ainda quiser participar, fala com a gente pelo canal onde recebeu o link.';
      } else if (/Failed to fetch|NetworkError/i.test(e.message)) {
        msg.textContent = 'Não conseguimos conectar agora. Confere sua internet e recarrega a página.';
      }
      showFase('invalid');
    });
  }

  // retrato → ato3 / thanks
  document.getElementById('btn-reveal').addEventListener('click', function () {
    track('reveal_opted_in');
    showAto3();
  });
  document.getElementById('btn-skip-reveal').addEventListener('click', function () {
    track('reveal_skipped');
    showFase('thanks');
  });

  boot();
})();
