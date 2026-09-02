/* Orquestração das fases: intro, conceito, bis, saída, bumpers e movimento. */
(function (root) {
  var ED = root.ED, A = ED.api, Q = ED.questions;
  var conn = navigator.connection || {};
  var reduced = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ED.env = {
    reduced: reduced,
    saveData: !!conn.saveData,
    lowEnd: (navigator.hardwareConcurrency || 4) <= 4 && /(^|-)(2g|3g)$/.test(conn.effectiveType || ''),
    mobile: root.matchMedia('(max-width:860px)').matches
  };
  var FASES = ['loading', 'invalid', 'intro', 'parte', 'conceito', 'bis', 'saida'];
  var STAGE = { intro: 1, parte1: 2, conceito: 3, parte2: 4, bis: 5 };
  var LABEL = { parte1: '2 · como funciona hoje', conceito: '3 · a ideia', parte2: '4 · o preço', bis: '5 · próximo passo' };
  var TITLE = { parte1: 'Como funciona hoje', conceito: 'O que a eshows está construindo', parte2: 'O preço, e o que você acha', bis: 'Seu próximo passo' };
  var showcaseReady = false, bisReady = false, saidaReady = false;

  function el(id) { return document.getElementById(id); }

  function show(name, msg) {
    FASES.forEach(function (f) {
      var s = el('fase-' + f), on = f === name;
      s.hidden = !on;
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
    if (name === 'invalid' && msg) el('invalid-msg').textContent = msg;
    root.scrollTo({ top: 0, behavior: 'instant' });
    if (name !== 'parte') {
      var h = el('fase-' + name).querySelector('h1, h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  function setSetlist(stage) {
    var n = STAGE[stage];
    document.querySelectorAll('#side-setl li').forEach(function (li, i) { li.classList.toggle('is-done', i + 1 < n); li.classList.toggle('is-now', i + 1 === n); });
    document.querySelectorAll('#mtop i').forEach(function (seg, i) { seg.classList.toggle('is-done', i + 1 < n); seg.classList.toggle('is-now', i + 1 === n); });
    el('mtop-label').textContent = LABEL[stage] || '';
  }

  function bumper(stage) {
    return new Promise(function (resolve) {
      if (reduced) return resolve();
      var b = document.createElement('div');
      b.className = 'bumper on-floor'; b.setAttribute('role', 'status');
      b.innerHTML = '<div class="sheet"><span class="tape tape--tl" aria-hidden="true"></span><span class="tape tape--tr" aria-hidden="true"></span>' +
        '<p class="ph ph--sheet">' + TITLE[stage] + '</p><p class="pk num" style="margin-top:.9rem">' + STAGE[stage] + ' de 5</p></div>';
      document.body.appendChild(b);
      setTimeout(function () { b.style.transition = 'opacity .25s'; b.style.opacity = '0'; setTimeout(function () { b.remove(); resolve(); }, 260); }, 1000);
    });
  }

  /* ── Fase 1 ─────────────────────────────────────────────────────────── */
  function intro() {
    show('intro');
    var d = new Date(); el('intro-date').textContent = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    if (!reduced) {
      var sheet = el('intro-sheet');
      sheet.classList.add('anim-drop');
      sheet.querySelectorAll('.tape').forEach(function (t, i) { t.classList.add('anim-fade', i ? 'd4' : 'd3'); });
      var title = el('intro-title');
      if (root.gsap && root.SplitText) {
        root.gsap.registerPlugin(root.SplitText);
        var split = root.SplitText.create(title, { type: 'lines', linesClass: 'ln' });
        root.gsap.from(split.lines, { y: 26, opacity: 0, fontStretch: '100%', duration: .9, ease: 'expo.out', stagger: .07, delay: .1 });
        root.gsap.from('#fase-intro .intro__text .body, #fase-intro .intro__promises', { y: 12, opacity: 0, duration: .7, ease: 'expo.out', stagger: .08, delay: .5 });
      } else {
        title.classList.add('anim-rise');
      }
    }
    el('start').addEventListener('click', function () {
      if (ED.state.started) return;
      A.track('intro_start');
      if (ED.state.opening) { ED.state.startRequested = true; el('start').textContent = 'Abrindo o convite…'; el('start').disabled = true; return; }
      startPart1();
    });
  }
  function startPart1() {
    if (ED.state.started) return; ED.state.started = true;
    el('start').disabled = false; el('start').textContent = 'Começar';
    bumper('parte1').then(function () { ED.runner.start('p1_nome'); });
  }

  /* ── Fase 3 ─────────────────────────────────────────────────────────── */
  function shotSrc(key, ext) {
    var phone = key === 'epk' || ED.env.mobile;
    return 'assets/shots/' + key + (phone && key !== 'epk' ? '-m' : '') + '.' + ext;
  }
  function phoneSrc(key, ext) { return 'assets/shots/' + key + (key === 'epk' ? '' : '-m') + '.' + ext; }
  function setShot(key) {
    var mock = el('mock'), video = el('mock-video');
    var phone = key === 'epk' || ED.env.mobile;
    mock.classList.toggle('mock--phone', phone);
    video.poster = shotSrc(key, 'webp');
    video.setAttribute('data-key', key);
    if (ED.env.saveData || ED.env.lowEnd) { video.removeAttribute('src'); video.load(); return; }
    var src = shotSrc(key, 'mp4');
    if (video.getAttribute('src') !== src) { video.src = src; video.load(); }
    var p = video.play(); if (p && p.catch) p.catch(function () {});
  }
  function whenGsap(ms) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function tick() {
        if (root.gsap && root.ScrollTrigger) return res(true);
        if (Date.now() - t0 > ms) return res(false);
        setTimeout(tick, 60);
      })();
    });
  }

  /* comum às duas versões: planos, FAQ, botão de continuar, lightbox, promessa */
  var commonReady = false;
  function initCommon() {
    if (commonReady) return; commonReady = true;
    var plans = el('plans');
    plans.querySelectorAll('.plan').forEach(function (p) {
      var key = p.getAttribute('data-plan');
      p.addEventListener('pointerenter', function () { plans.setAttribute('data-focus', key); });
      p.addEventListener('focusin', function () { plans.setAttribute('data-focus', key); });
      p.addEventListener('click', function () { plans.setAttribute('data-focus', plans.getAttribute('data-focus') === key ? '' : key); A.track('plan_focus', { plan: key }); });
    });
    plans.addEventListener('pointerleave', function () { plans.removeAttribute('data-focus'); });
    plans.addEventListener('focusout', function (e) { if (!plans.contains(e.relatedTarget)) plans.removeAttribute('data-focus'); });
    el('to-parte2').addEventListener('click', function () {
      A.track('to_parte2');
      var v = el('tour-video'); if (v) v.pause();
      var mv = el('mock-video'); if (mv) mv.pause();
      bumper('parte2').then(function () { ED.runner.start('p2_sentido'); });
    });
    if ('IntersectionObserver' in root) {
      var pledge = el('rev-pledge');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { pledge.classList.add('is-on'); A.track('pledge_seen'); io.disconnect(); } });
      }, { threshold: .55 });
      io.observe(pledge);
    } else { el('rev-pledge').classList.add('is-on'); }
  }

  /* versão com GSAP: capítulos animados e telefone fixo */
  function initReveal() {
    var g = root.gsap, ST = root.ScrollTrigger;
    g.registerPlugin(ST);
    document.documentElement.classList.add('has-gsap');
    var lights = el('rev-lights');
    /* fromTo com estado final explícito: from() com scrollTrigger gravava o estado inicial como final em alguns alvos */
    function rise(targets, from, to, st, extra) {
      var vars = Object.assign({ duration: .8, ease: 'expo.out' }, extra || {}, to);
      if (st) vars.scrollTrigger = st;
      return g.fromTo(targets, from, vars);
    }
    var once = function (trigger, start) { return { trigger: trigger, start: start || 'top 65%', once: true }; };
    if (!reduced) {
      g.set(lights, { opacity: .82 });
      g.to(lights, { opacity: 0, duration: 1.4, ease: 'power2.out', delay: .15 });
      var title = el('conceito-title');
      if (root.SplitText) {
        g.registerPlugin(root.SplitText);
        var sp = root.SplitText.create(title, { type: 'lines', linesClass: 'ln' });
        rise(sp.lines, { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1 }, null, { duration: 1, stagger: .1, delay: .3 });
      } else { rise(title, { y: 24, opacity: 0 }, { y: 0, opacity: 1 }, null, { duration: .9, delay: .3 }); }
      rise('#rev-open .rev__lede', { y: 14, opacity: 0 }, { y: 0, opacity: 1 }, null, { delay: .9 });
      rise('#rev-open .rev__hint', { opacity: 0 }, { opacity: 1 }, null, { duration: .6, delay: 1.4 });

      rise('#rev-caminho .ph--sect', { y: 24, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-caminho', 'top 70%'));
      g.fromTo('.card--a', { x: -70, rotation: -9, opacity: 0 }, { x: 0, rotation: -1.4, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#rev-caminho', start: 'top 75%', end: 'top 25%', scrub: .6 } });
      g.fromTo('.card--b', { x: 70, rotation: 8, opacity: 0 }, { x: 0, rotation: 1.1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#rev-caminho', start: 'top 70%', end: 'top 20%', scrub: .6 } });

      rise('#rev-terceira .st1', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-terceira'));
      rise('#rev-terceira .st2', { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1 }, once('#rev-terceira'), { duration: .45, delay: .45 });
      rise('#rev-terceira .st3', { y: 14, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-terceira'), { duration: .7, delay: .8 });

      rise('#rev-tour .tour__head > *', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-tour', 'top 70%'), { stagger: .1 });
      rise('#rev-jeito .ph--sect', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-jeito', 'top 70%'));
      rise('#rev-jeito .lines li', { x: -24, opacity: 0 }, { x: 0, opacity: 1 }, once('#rev-jeito', 'top 60%'), { duration: .6, stagger: .16 });
      rise('#rev-pledge .ph--sect', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-pledge', 'top 70%'));
      rise('#plans .plan', { y: 48, opacity: 0, rotation: function (i) { return i ? 4 : -4; } }, { y: 0, opacity: 1, rotation: function (i) { return i ? .7 : -.8; } }, once('#rev-planos'), { duration: .75, stagger: .14 });
      rise('#rev-planos .plan__list li', { x: -10, opacity: 0 }, { x: 0, opacity: 1 }, once('#rev-planos'), { duration: .4, stagger: .04, delay: .4 });
      rise('#rev-faq details', { y: 16, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-faq', 'top 75%'), { duration: .5, stagger: .06 });
      rise('#rev-faq .rev__cta', { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, once('#rev-faq .rev__cta', 'top 85%'), { duration: .7 });
    }
    /* telefone fixo: o palco fica no lugar (sticky no CSS) e cada passo troca a tela */
    var steps = Array.prototype.slice.call(document.querySelectorAll('.tour__step'));
    var video = el('tour-video'), phone = document.querySelector('.tour__phone'), counter = el('tour-counter'), current = null;
    function activate(step) {
      var key = step.getAttribute('data-shot');
      if (key === current) return; current = key;
      steps.forEach(function (st) { st.classList.toggle('is-on', st === step); });
      counter.textContent = 'CH ' + (steps.indexOf(step) + 1) + ' / 6';
      phone.classList.add('is-swapping');
      setTimeout(function () {
        video.poster = phoneSrc(key, 'webp');
        if (!(ED.env.saveData || ED.env.lowEnd)) { video.src = phoneSrc(key, 'mp4'); video.load(); var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
        phone.classList.remove('is-swapping');
      }, reduced ? 0 : 180);
      A.track('tour_step', { key: key });
    }
    /* passo ativo = o mais próximo da linha de leitura (55 % da tela); funciona em rolagem contínua e em saltos */
    function pick() {
      var line = root.innerHeight * 0.55, best = steps[0], bd = Infinity;
      steps.forEach(function (s) { var r = s.getBoundingClientRect(); var d = Math.abs((r.top + r.bottom) / 2 - line); if (d < bd) { bd = d; best = s; } });
      activate(best);
    }
    ST.create({ trigger: '#tour', start: 'top bottom', end: 'bottom top', onUpdate: pick, onEnter: pick, onEnterBack: pick, onRefresh: pick });
    ST.create({ trigger: '#tour', start: 'top 80%', once: true, onEnter: function () { A.track('showcase_seen'); } });
    setTimeout(function () { ST.refresh(); }, 400);
  }

  /* fallback sem GSAP: carrossel no celular, lista + janela no desktop */
  function buildCarousel(items) {
    var track = el('carousel'); if (!track || track.childElementCount) return;
    track.hidden = false;
    items.forEach(function (li) {
      var key = li.getAttribute('data-shot'), t = li.querySelector('.t').textContent, d = li.querySelector('.d').textContent, ch = li.querySelector('.ch').textContent;
      var slide = document.createElement('article'); slide.className = 'slide';
      slide.innerHTML = '<figure class="mock mock--phone" style="margin:0"><video muted loop playsinline preload="none" poster="' + shotSrc(key, 'webp') + '" data-key="' + key + '" aria-label="Tela: ' + t + '"></video></figure>' +
        '<div><span class="ch">' + ch + '</span><p class="t">' + t + '</p><p class="d">' + d + '</p></div>';
      track.appendChild(slide);
    });
    var hint = document.createElement('p'); hint.className = 'carousel__hint'; hint.textContent = 'Arrasta pro lado pra ver as seis'; track.insertAdjacentElement('afterend', hint);
    if ('IntersectionObserver' in root && !(ED.env.saveData || ED.env.lowEnd)) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target.querySelector('video');
          if (en.isIntersecting && en.intersectionRatio >= .6) {
            if (!v.getAttribute('src')) { v.src = shotSrc(v.getAttribute('data-key'), 'mp4'); v.load(); }
            var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
            A.track('slide_seen', { key: v.getAttribute('data-key') });
          } else { v.pause(); }
        });
      }, { root: track, threshold: [.6] });
      track.querySelectorAll('.slide').forEach(function (sl) { io.observe(sl); });
    }
  }
  function initShowcase() {
    if (showcaseReady) return; showcaseReady = true;
    document.documentElement.classList.add('no-gsap');
    var items = Array.prototype.slice.call(document.querySelectorAll('#inlist li'));
    if (ED.env.mobile) { buildCarousel(items); return; }
    var lockUntil = 0;
    function activate(li) {
      items.forEach(function (n) { n.classList.toggle('is-on', n === li); });
      setShot(li.getAttribute('data-shot'));
    }
    items.forEach(function (li) { li.addEventListener('click', function () { lockUntil = Date.now() + 900; activate(li); li.scrollIntoView({ block: 'center', behavior: reduced ? 'instant' : 'smooth' }); }); });
    if ('IntersectionObserver' in root) {
      var io = new IntersectionObserver(function (entries) {
        if (Date.now() < lockUntil) return;
        var best = null;
        entries.forEach(function (en) { if (en.isIntersecting && en.intersectionRatio >= .6 && (!best || en.intersectionRatio > best.intersectionRatio)) best = en; });
        if (best) activate(best.target);
      }, { threshold: [.6, .9], rootMargin: '-30% 0px -30% 0px' });
      items.forEach(function (li) { io.observe(li); });
    }
    setShot(items[0].getAttribute('data-shot'));
    var dlg = el('lightbox'), dv = el('lightbox-video');
    el('zoom').addEventListener('click', function () {
      var key = el('mock-video').getAttribute('data-key') || 'epk';
      dlg.querySelector('.mock').classList.toggle('mock--phone', key === 'epk');
      dv.poster = shotSrc(key, 'webp'); dv.src = shotSrc(key, 'mp4'); dv.load();
      dlg.showModal(); var p = dv.play(); if (p && p.catch) p.catch(function () {});
      A.track('lightbox_open', { key: key });
    });
    el('lightbox-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { dv.pause(); dv.removeAttribute('src'); dv.load(); });
  }
  var revealReady = false;
  function conceito() {
    show('conceito');
    setSetlist('conceito');
    initCommon();
    A.track('concept_seen');
    if (revealReady) return; revealReady = true;
    whenGsap(1800).then(function (ok) { if (ok) initReveal(); else initShowcase(); });
  }

  /* ── envio do núcleo ────────────────────────────────────────────────── */
  function submitCore() {
    if (ED.state.submitted) return Promise.resolve();
    var a = ED.state.answers, arr = Object.keys(a).filter(function (k) { return a[k] !== undefined; }).map(function (k) { return { question_id: k, value: a[k] }; });
    if (!arr.length) return Promise.resolve();
    return A.call('submit', { answers: arr.slice(0, 40), event_id: A.uid(), client_ts: new Date().toISOString() })
      .then(function () { ED.state.submitted = true; })
      .catch(function () {});
  }
  function complete() { return A.call('complete', { event_id: A.uid() }).catch(function () {}); }

  function toPhase(n, fromQ) {
    if (n.phase === 'conceito') { A.track('gate_a_yes'); conceito(); return; }
    if (n.phase === 'reveal') { ED.runner.renderReveal(); return; }
    if (n.phase === 'bis') {
      ED.state.exit = n.exit || null;
      if (n.exit) A.track(n.exit === 'gate_c' ? 'gate_c_none' : n.exit + '_no', {}, fromQ && fromQ.id);
      submitCore();
      if (n.exit) saida(n.exit); else bis();
    }
  }

  /* ── Fase 5 · Bis ───────────────────────────────────────────────────── */
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function bis() {
    show('bis'); setSetlist('bis');
    if (bisReady) return; bisReady = true;
    var name = el('c-name'), wa = el('c-wa'), err = el('c-err'), form = el('contact-form'), group = el('c-purpose');
    if (ED.state.answers.p1_nome) name.value = ED.state.answers.p1_nome;
    group.addEventListener('click', function (e) {
      var li = e.target.closest('li[role="radio"]'); if (!li) return;
      group.querySelectorAll('li').forEach(function (n) { n.setAttribute('aria-checked', 'false'); var r = n.querySelector('.ring'); if (r) r.remove(); });
      li.setAttribute('aria-checked', 'true');
      ED.runner.drawRing(li, true);
    });
    group.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && e.target.matches('li')) { e.preventDefault(); e.target.click(); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var purpose = (group.querySelector('[aria-checked="true"]') || {}).getAttribute ? group.querySelector('[aria-checked="true"]').getAttribute('data-value') : 'meeting';
      if (!name.value.trim()) { err.textContent = 'Falta o nome do projeto.'; err.hidden = false; name.focus(); return; }
      if (digits(wa.value).length < 10) { err.textContent = 'Confere o WhatsApp: precisa do DDD e do número.'; err.hidden = false; wa.focus(); return; }
      if (!el('c-privacy').checked) { err.textContent = 'Falta marcar que leu o aviso de privacidade.'; err.hidden = false; el('c-privacy').focus(); return; }
      var btn = el('c-send'); btn.disabled = true; btn.textContent = 'Enviando…';
      submitCore().then(function () {
        return A.call('contact', { name: name.value.trim(), whatsapp: digits(wa.value), purpose: purpose, privacy_ack: true, whatsapp_opt_in: true, interview_opt_in: purpose === 'meeting', event_id: A.uid() });
      }).then(function () { return A.call('waitlist', { event_id: A.uid() }); })
        .then(function () { return complete(); })
        .then(function () {
          el('bis-form').hidden = true; el('bis-done').hidden = false;
          el('bis-done-msg').textContent = purpose === 'meeting'
            ? 'A gente te chama pelo WhatsApp pra marcar a conversa. Obrigado por fazer parte dessa construção.'
            : 'Quando o escritório for lançado, você fica sabendo primeiro, pelo WhatsApp. Obrigado por fazer parte dessa construção.';
          document.querySelectorAll('#side-setl li, #intro-sheet .setl li').forEach(function (li) { li.classList.remove('is-now'); li.classList.add('is-done'); });
          el('bis-done').querySelector('h2').focus();
        })
        .catch(function () { btn.disabled = false; btn.textContent = 'Entrar na lista'; err.textContent = 'Não foi. Tenta de novo em alguns segundos.'; err.hidden = false; });
    });
  }

  /* ── Saída pelos portões ────────────────────────────────────────────── */
  var EXIT_Q = { gate_a: 'Se quiser, conta em uma frase: por que hoje isso não faz sentido pra você?', gate_b: 'Se quiser, conta em uma frase: o que não encaixou?', gate_c: 'Se quiser, conta em uma frase: o que faria você mudar de ideia?' };
  function saida(exit) {
    show('saida'); setSetlist('bis');
    el('saida-q').textContent = EXIT_Q[exit] || EXIT_Q.gate_a;
    if (saidaReady) return; saidaReady = true;
    el('saida-send').addEventListener('click', function () {
      var t = el('saida-text').value.trim(), btn = el('saida-send'); btn.disabled = true;
      var p = Promise.resolve();
      if (t) p = A.call('answer', { question_id: Q.EXIT_QUESTION[ED.state.exit] || 'p1_porque_nao', value: t, event_id: A.uid(), client_ts: new Date().toISOString() }).catch(function () {});
      p.then(submitCore).then(complete).then(function () {
        el('saida-form').hidden = true; el('saida-done').hidden = false; el('saida-done').querySelector('h2').focus();
      });
    });
  }
  function saidaDone() {
    show('saida'); setSetlist('bis');
    el('saida-form').hidden = true; el('saida-done').hidden = false;
  }

  ED.phases = { show: show, setSetlist: setSetlist, bumper: bumper, intro: intro, startPart1: startPart1, conceito: conceito, toPhase: toPhase, bis: bis, saida: saida, saidaDone: saidaDone, submitCore: submitCore };
})(window);
