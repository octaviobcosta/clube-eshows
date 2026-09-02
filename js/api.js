/* Cliente da Edge Function ed-api. Autoridade = token do convite (?t=). */
(function (root) {
  var API = 'https://osahwimcceppufdcaovv.supabase.co/functions/v1/ed-api';
  var TOKEN = new URLSearchParams(location.search).get('t') || '';
  var queue = [], timer = null;

  function uid() {
    return (root.crypto && root.crypto.randomUUID) ? root.crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function call(action, payload) {
    var body = Object.assign({ action: action, token: TOKEN }, payload || {});
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = {};
          try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { error: t }; }
          if (!r.ok) { var err = new Error(j.error || r.statusText || 'Falha'); err.status = r.status; err.body = j; throw err; }
          return j;
        });
      });
  }

  function flush() {
    if (!queue.length) return;
    var batch = queue.splice(0, 40);
    var body = JSON.stringify({ action: 'events', token: TOKEN, events: batch });
    /* fetch keepalive em vez de sendBeacon: o beacon manda credenciais e a função não responde Allow-Credentials */
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'omit' }).catch(function () {});
  }

  function track(name, payload, questionId) {
    queue.push({ event_id: uid(), name: name, payload: payload || {}, question_id: questionId || null, client_ts: new Date().toISOString() });
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }

  root.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  root.ED = root.ED || {};
  root.ED.api = { API: API, TOKEN: TOKEN, uid: uid, call: call, track: track, flush: flush };
})(window);
