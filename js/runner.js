/* Motor de perguntas: uma folha por vez, salva a cada resposta, volta sem perder. */
(function (root) {
  var ED = root.ED, Q = ED.questions, F = ED.flow, A = ED.api;
  var folha, revealEl, current = null, history = [], temp = {};
  var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RING = '<svg class="ring" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M6,21 C3,7 38,2 60,4 C90,7 98,14 96,23 C93,34 60,38 38,37 C14,36 6,32 6,21"/></svg>';
  var TAPES = '<span class="tape tape--tl" aria-hidden="true"></span><span class="tape tape--tr" aria-hidden="true"></span>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function answers() { return ED.state.answers; }
  function q() { return Q.byId[current]; }

  var pending = [];
  function commit(id, value) {
    answers()[id] = value;
    var p = A.call('answer', { question_id: id, value: value, event_id: A.uid(), client_ts: new Date().toISOString() }).catch(function () {});
    pending.push(p);
    p.then(function () { pending = pending.filter(function (x) { return x !== p; }); });
  }
  /* Antes de trocar de fase, espera as respostas em voo confirmarem (teto de 1,5 s): recarregar logo depois não perde nada. */
  function settle(ms) {
    return Promise.race([Promise.all(pending.slice()), new Promise(function (res) { setTimeout(res, ms); })]);
  }

  function optsHtml(name, opts, multi, selected, disabled) {
    return '<ul class="opts' + (multi ? ' opts--multi' : '') + '" role="' + (multi ? 'group' : 'radiogroup') + '" data-name="' + esc(name) + '" data-multi="' + (multi ? '1' : '0') + '">' +
      opts.map(function (o) {
        var sel = multi ? (selected || []).indexOf(o.id) >= 0 : selected === o.id;
        var dis = disabled && disabled.indexOf(o.id) >= 0;
        return '<li role="' + (multi ? 'checkbox' : 'radio') + '" tabindex="0" data-value="' + esc(o.id) + '" aria-checked="' + (sel ? 'true' : 'false') + '"' + (dis ? ' aria-disabled="true"' : '') + '>' + esc(o.label) + (sel && !multi ? RING : '') + '</li>';
      }).join('') + '</ul>';
  }

  function navHtml(qd, count, right) {
    return '<div class="nav">' +
      (history.length ? '<button type="button" class="link-btn" data-act="back">← Voltar</button>' : '<span></span>') +
      '<span class="nav__count num">' + count.index + ' de ' + count.total + '</span>' +
      right + '</div>';
  }

  function render(qd) {
    var a = answers(), count = F.progress(qd.id, a), html = TAPES;
    html += '<p class="q" id="q-label">' + esc(qd.label) + '</p>';
    if (qd.help) html += '<p class="help">' + esc(qd.help) + '</p>';
    var right = '<span class="nav__auto">avança sozinho</span>';
    var cont = '<button type="button" class="cta cta--ghost" data-act="next">Continuar</button>';

    if (qd.kind === 'text') {
      var v = a[qd.id] || '';
      html += qd.single
        ? '<input class="input" id="f-text" type="text" maxlength="' + qd.maxlength + '" value="' + esc(v) + '" autocomplete="off" aria-labelledby="q-label">'
        : '<textarea class="input" id="f-text" maxlength="' + qd.maxlength + '" placeholder="' + esc(qd.placeholder || '') + '" aria-labelledby="q-label">' + esc(v) + '</textarea>';
      right = (qd.optional ? '<button type="button" class="link-btn" data-act="skip">Pular</button>' : '') + cont;
      html += navHtml(qd, count, right);
    } else if (qd.kind === 'single' || qd.kind === 'gate' || qd.kind === 'likert5') {
      html += optsHtml(qd.id, qd.options, false, a[qd.id]);
      if (qd.followup) {
        var show = qd.followup.when.indexOf(a[qd.id]) >= 0;
        html += '<div id="f-follow" class="dual" style="margin-top:1.2rem"' + (show ? '' : ' hidden') + '><div><p class="dual__label">' + esc(qd.followup.label) + '</p>' + optsHtml(qd.followup.id, qd.followup.options, false, a[qd.followup.id]) + '</div></div>';
      }
      if (qd.note) {
        html += '<div class="field" style="margin-top:1rem"><textarea class="input" id="f-note" maxlength="' + qd.note.maxlength + '" placeholder="' + esc(qd.note.placeholder) + '" aria-label="Por quê">' + esc(a[qd.note.id] || '') + '</textarea></div>';
      }
      html += navHtml(qd, count, qd.noAuto ? cont : right);
    } else if (qd.kind === 'multi') {
      html += optsHtml(qd.id, qd.options, true, a[qd.id] || []);
      html += navHtml(qd, count, cont);
    } else if (qd.kind === 'dual') {
      html += '<div class="dual">' + qd.fields.map(function (f) {
        return '<div><p class="dual__label">' + esc(f.label) + '</p>' + optsHtml(f.id, f.options, false, a[f.id]) + '</div>';
      }).join('') + '</div>';
      html += navHtml(qd, count, right);
    } else if (qd.kind === 'number2') {
      html += '<div class="dual">' + qd.fields.map(function (f) {
        var val = a[f.id] != null ? a[f.id] : '';
        return '<div class="field"><label for="f-' + f.id + '">' + esc(f.label) + '</label><div class="money"><input class="input input--money num" id="f-' + f.id + '" data-field="' + f.id + '" type="number" inputmode="decimal" min="0" step="1" placeholder="0" value="' + esc(val) + '"></div></div>';
      }).join('') + '</div>';
      html += navHtml(qd, count, '<button type="button" class="link-btn" data-act="skip">' + esc(qd.skipLabel) + '</button>' + cont);
    }
    return html;
  }

  function paint(id, fromBack) {
    current = id; temp = {};
    var qd = Q.byId[id];
    folha.hidden = false; revealEl.hidden = true;
    folha.innerHTML = render(qd);
    folha.className = 'sheet ' + (history.length % 2 ? 'sheet--r' : '');
    updateCta();
    var stage = qd.part === 1 ? 'parte1' : 'parte2';
    ED.phases.setSetlist(stage);
    if (!fromBack) A.track('question_shown', {}, id);
    folha.setAttribute('tabindex', '-1');
    folha.focus({ preventScroll: true });
    var txt = folha.querySelector('input.input, textarea.input');
    if (txt && !root.matchMedia('(max-width:860px)').matches) txt.focus({ preventScroll: true });
    root.scrollTo({ top: 0, behavior: 'instant' });
  }

  function go(id, fromBack) {
    if (document.startViewTransition && !reduced && !folha.hidden) {
      document.startViewTransition(function () { paint(id, fromBack); });
    } else {
      paint(id, fromBack);
    }
  }

  function start(id) {
    folha = document.getElementById('folha');
    revealEl = document.getElementById('reveal');
    history = [];
    ED.phases.show('parte');
    paint(id);
  }

  function valid(qd) {
    var a = answers();
    if (qd.kind === 'text') { var t = (folha.querySelector('#f-text') || {}).value || ''; return qd.optional || t.trim().length > 0; }
    if (qd.kind === 'multi') return (temp[qd.id] || a[qd.id] || []).length > 0;
    if (qd.kind === 'number2') return qd.fields.some(function (f) { var el = folha.querySelector('#f-' + f.id); return el && el.value !== '' && Number(el.value) >= 0; });
    if (qd.note) return (temp[qd.id] || a[qd.id]) != null;
    return true;
  }

  function updateCta() {
    var btn = folha.querySelector('[data-act="next"]');
    if (btn) btn.disabled = !valid(q());
  }

  function selectRadio(li) {
    var group = li.parentNode, name = group.getAttribute('data-name');
    group.querySelectorAll('li').forEach(function (n) { n.setAttribute('aria-checked', 'false'); var r = n.querySelector('.ring'); if (r) r.remove(); });
    li.setAttribute('aria-checked', 'true');
    li.insertAdjacentHTML('beforeend', RING);
    temp[name] = li.getAttribute('data-value');
    var qd = q();
    if (name === qd.id) commit(qd.id, temp[name]);
    else if (qd.followup && name === qd.followup.id) commit(name, temp[name]);
    else if (qd.fields) commit(name, temp[name]);
    if (qd.followup && name === qd.id) {
      var need = qd.followup.when.indexOf(temp[name]) >= 0, fw = folha.querySelector('#f-follow');
      fw.hidden = !need;
      if (need) { var fsel = fw.querySelector('[aria-checked="true"]'); if (!fsel) return; }
    }
    if (qd.kind === 'dual' && !qd.fields.every(function (f) { return (temp[f.id] || answers()[f.id]) != null; })) return;
    if (qd.noAuto) { updateCta(); return; }
    setTimeout(function () { if (current === qd.id) advance(qd); }, reduced ? 0 : 450);
  }

  function toggleCheck(li) {
    var qd = q(), group = li.parentNode, cur = (temp[qd.id] || answers()[qd.id] || []).slice();
    var v = li.getAttribute('data-value'), on = li.getAttribute('aria-checked') === 'true';
    if (li.getAttribute('aria-disabled') === 'true') return;
    if (on) cur = cur.filter(function (x) { return x !== v; });
    else {
      if (qd.exclusive && v === qd.exclusive) cur = [v];
      else { cur = cur.filter(function (x) { return x !== qd.exclusive; }); cur.push(v); }
    }
    temp[qd.id] = cur;
    group.querySelectorAll('li').forEach(function (n) {
      var val = n.getAttribute('data-value'), sel = cur.indexOf(val) >= 0;
      n.setAttribute('aria-checked', sel ? 'true' : 'false');
      var dis = !sel && ((qd.max && cur.length >= qd.max) || (qd.exclusive && cur.indexOf(qd.exclusive) >= 0));
      if (dis) n.setAttribute('aria-disabled', 'true'); else n.removeAttribute('aria-disabled');
    });
    commit(qd.id, cur);
    updateCta();
  }

  function advance(qd) {
    var a = answers();
    if (qd.kind === 'text') { var t = folha.querySelector('#f-text').value.trim(); if (!qd.optional && !t) return; commit(qd.id, t); }
    if (qd.kind === 'number2') {
      var any = false;
      qd.fields.forEach(function (f) { var el = folha.querySelector('#f-' + f.id); if (el && el.value !== '') { commit(f.id, Number(el.value)); any = true; } });
      commit(qd.id, any ? 'answered' : 'skip');
    }
    if (qd.note) { var nt = (folha.querySelector('#f-note') || {}).value || ''; if (nt.trim()) commit(qd.note.id, nt.trim()); }
    if (qd.kind === 'multi' && !(a[qd.id] || []).length) return;
    var n = F.next(qd.id, a);
    history.push(qd.id);
    if (typeof n === 'string') go(n); else settle(1500).then(function () { ED.phases.toPhase(n, qd); });
  }

  function skip(qd) {
    if (qd.kind === 'number2') { commit(qd.id, 'skip'); }
    else if (qd.kind === 'text') { commit(qd.id, ''); }
    var n = F.next(qd.id, answers());
    history.push(qd.id);
    if (typeof n === 'string') go(n); else settle(1500).then(function () { ED.phases.toPhase(n, qd); });
  }

  function back() {
    if (!history.length) return;
    var id = history.pop();
    A.track('back', {}, id);
    go(id, true);
  }

  function onClick(e) {
    var li = e.target.closest('li[role="radio"], li[role="checkbox"]');
    if (li && folha.contains(li)) { if (li.getAttribute('role') === 'radio') selectRadio(li); else toggleCheck(li); return; }
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'back') back();
    if (act === 'next') advance(q());
    if (act === 'skip') skip(q());
  }
  function onKey(e) {
    var li = e.target.closest && e.target.closest('li[role="radio"], li[role="checkbox"]');
    if (li) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); li.click(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (li.nextElementSibling || li.parentNode.firstElementChild).focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (li.previousElementSibling || li.parentNode.lastElementChild).focus(); }
    }
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input.input') && q().kind === 'text') { e.preventDefault(); advance(q()); }
  }
  function onInput() { updateCta(); }

  function renderReveal() {
    folha.hidden = true; revealEl.hidden = false;
    ED.phases.setSetlist('parte2');
    A.track('price_revealed');
    revealEl.innerHTML =
      '<div style="max-width:1080px;margin:0 auto;display:grid;gap:1.6rem">' +
      '<h2 class="ph ph--sect" id="reveal-title">Agora, o preço.</h2>' +
      '<div class="plans">' +
        '<article class="plan plan--solo"><span class="tape tape--tl tape--dark" aria-hidden="true"></span>' +
          '<h3 class="plan__name">Solo</h3>' +
          '<div class="plan__price"><span class="stamp">R$ 59,90<small>por mês</small></span></div>' +
          '<p class="body">As seis ferramentas, você no comando. Mensalidade fixa, sem percentual do cachê, sem show garantido.</p>' +
        '</article>' +
        '<article class="plan plan--assist"><span class="tape tape--tl" aria-hidden="true"></span><span class="tape tape--tr" aria-hidden="true"></span>' +
          '<h3 class="plan__name">Assistido</h3><p class="plan__slots">30 vagas na primeira turma</p>' +
          '<div class="plan__price"><span class="stamp" style="animation-delay:.12s">R$ 299<small>por mês</small></span></div>' +
          '<p class="body"><span class="hl">Não é mensalidade de software.</span> É um fundo de campanha que a eshows gere pra você, mirando shows de ticket maior. Um corporativo de R$ 3 mil paga dez meses.</p>' +
          '<p class="fine" style="margin-top:.8rem">Quem atende, negocia e fecha é você. A eshows não fica com parte do cachê.</p>' +
        '</article>' +
      '</div>' +
      '<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap"><button type="button" class="cta" id="reveal-next">Continuar</button><span class="fine">Cinco perguntas e o bis.</span></div>' +
      '</div>';
    root.scrollTo({ top: 0, behavior: 'instant' });
    var h = revealEl.querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    revealEl.querySelector('#reveal-next').addEventListener('click', function () {
      history.push('__reveal');
      revealEl.hidden = true; folha.hidden = false;
      paint('p2_int_solo');
    });
  }

  function init() {
    folha = document.getElementById('folha');
    revealEl = document.getElementById('reveal');
    folha.addEventListener('click', onClick);
    folha.addEventListener('keydown', onKey);
    folha.addEventListener('input', onInput);
  }

  ED.runner = { init: init, start: start, go: go, renderReveal: renderReveal, back: back };
})(window);
