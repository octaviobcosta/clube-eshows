/* Boot: token da URL ou do navegador (ou cria um, modo público), abre a instância no servidor, restaura e entrega pra fase certa. */
(function () {
  var ED = window.ED, P = ED.phases, A = ED.api, F = ED.flow;
  ED.state = { answers: {}, exit: null, submitted: false, displayName: '' };
  ED.runner.init();


  /* Intro otimista: o conteúdo estático pinta já (LCP no título) enquanto o convite abre. */
  ED.state.opening = true; ED.state.startRequested = false; ED.state.started = false;
  P.intro();

  function route(r) {
    var a = ED.state.answers;
    if (r.instanceState === 'core_completed') ED.state.submitted = true; /* núcleo enviado, mas o bis ou a saída ainda estão abertos */
    if (r.instanceState === 'survey_completed') {
      ED.state.submitted = true;
      if (r.inWaitlist) { P.bis(); document.getElementById('bis-form').hidden = true; document.getElementById('bis-done').hidden = false; }
      else P.saidaDone();
      return;
    }
    var rp = F.resumePoint(a);
    var fresh = !Object.keys(a).length;
    if (fresh) { if (ED.state.startRequested) P.startPart1(); return; }
    if (rp.phase === 'parte') { ED.runner.start(rp.id); return; }
    if (rp.phase === 'conceito') { P.conceito(); return; }
    if (rp.phase === 'bis') { ED.state.exit = rp.exit || null; if (rp.exit) P.saida(rp.exit); else P.bis(); }
  }

  var src = new URLSearchParams(location.search).get('src') || 'publico';
  var ready = A.TOKEN ? Promise.resolve() : A.start(src);
  ready.then(function () { return A.call('open', { event_id: A.uid() }); }).then(function (r) {
    ED.state.answers = r.savedAnswers || {};
    ED.state.displayName = r.displayName || '';
    ED.state.opening = false;
    A.track('questionnaire_v3', { version: 3, viewport: window.innerWidth + 'x' + window.innerHeight });
    route(r);
  }).catch(function (e) {
    ED.state.opening = false;
    var msg = null;
    if (e && (e.status === 403 || e.status === 401)) { A.setToken(''); msg = 'Esta sessão expirou. Recarrega a página pra começar de novo.'; }
    if (e && e.status === 404) msg = 'Este link não é válido. Confere se ele veio completo na mensagem.';
    if (!e || !e.status || e.status >= 500) msg = 'Não deu pra abrir agora. Confere a conexão e recarrega a página.';
    P.show('invalid', msg);
  });
})();
