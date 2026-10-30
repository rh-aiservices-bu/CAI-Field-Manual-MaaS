/**
 * Chat assistant for the /chat/ page: discuss the manual with a browser-side
 * OpenAI-compatible endpoint the reader names.
 *
 * Two roles, picked by location:
 *   A. Any page without the widget mount: forward the current path onto the
 *      header's Chat link as `?src=…`, so /chat/ knows where the reader came
 *      from.
 *   B. /chat/ itself: unhide the #td-chat mount and run the widget.
 *
 * Storage: localStorage `td-chat:url|key|model` (config only), sessionStorage
 * `td-chat:models` (model-id list, 5-minute TTL, successes only). The key is
 * masked in the UI and sent only to the endpoint the reader typed.
 * Conversation history is memory-only; a reload clears it.
 *
 * Guards matter: oink runs hooks/body-end.html on every HTML output including
 * print bundles, so nothing here may touch the DOM when the mount is absent.
 */
(function () {
  'use strict';

  var LS_URL = 'td-chat:url';
  var LS_KEY = 'td-chat:key';
  var LS_MODEL = 'td-chat:model';
  var SS_MODELS = 'td-chat:models';
  var MODELS_TTL = 5 * 60 * 1000;
  var CONTEXT_CAP = 30000;
  var TRUNCATED_NOTE = '\n\n[document truncated]';
  var MASK = '••••••••';
  var PREVIEW_LEN = 6;

  var SYSTEM_PREFIX = 'You are a helpful assistant. Answer strictly from the documentation below; '
    + 'say so when something isn\'t covered.\n\nDocumentation:\n\n';
  var SYSTEM_NO_DOC = 'You are a helpful assistant. The documentation failed to load in this '
    + 'browser, so you have no document context; say plainly when you cannot answer.';

  /* ---------- storage ---------- */

  function storageAvailable() {
    try {
      localStorage.setItem('__td-chat-probe__', '1');
      localStorage.removeItem('__td-chat-probe__');
      return true;
    } catch (e) {
      return false;
    }
  }

  function lsGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function lsSet(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (e) { /* storage blocked; the banner already said so */ }
  }

  function ssGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function ssSet(key, value) {
    try {
      if (value == null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (e) { /* the cache is optional */ }
  }

  /* ---------- text helpers ---------- */

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function previewKey(value) {
    if (value.length > PREVIEW_LEN) {
      // JWT-shaped tokens start with the constant base64 header 'eyJ'; showing
      // it leaks nothing, while a longer prefix of an opaque key might.
      var prefix = value.slice(0, PREVIEW_LEN);
      return (value.charAt(0) === 'e' && value.charAt(1) === 'y' && value.charAt(2) === 'J'
        ? 'eyJ…'
        : prefix) + MASK;
    }
    return MASK;
  }

  // Escape first, then a 4-rule transform: code, bold, http(s) links, newlines.
  // No raw HTML, no images, no autolinks.
  function safeMarkdown(text) {
    var s = escapeHtml(text);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function normalizeEndpoint(endpoint) {
    // OpenAI-compatible base URLs carry a path segment (e.g. /v1). Bare hosts
    // get /v1 appended; anything with a path is kept as typed.
    var trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
    if (!trimmed) return trimmed;
    return trimmed.indexOf('/', trimmed.indexOf('//') + 2) === -1 ? trimmed + '/v1' : trimmed;
  }

  function modelsUrl(base) {
    return base.replace(/\/+$/, '') + '/models';
  }

  function chatUrl(base) {
    return base.replace(/\/+$/, '') + '/chat/completions';
  }

  function normalizeModelId(model) {
    if (typeof model !== 'string' || model.indexOf('/') === -1) return model;
    return model.slice(model.lastIndexOf('/') + 1);
  }

  function extractModels(payload) {
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.models)) return payload.models;
    return [];
  }

  // The reader's endpoint is usually on loopback (Ollama, LM Studio) or a LAN
  // box, while this site is served from a public origin. Chrome gates that
  // public-to-private direction behind Local Network Access; when it does, it
  // rejects the preflight before reading any CORS header, so the failure looks
  // exactly like a missing Access-Control-Allow-Origin. Observed both ways:
  // headless Chrome (permission state "denied") fails the preflight with
  // ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS, a headed Chrome (state
  // "prompt") completed the same request. https-ness plays no part — an https
  // page on localhost reaches localhost. Access-Control-Allow-Private-Network
  // is not a substitute for the permission.
  function isLocalHostname(host) {
    var name = String(host || '').toLowerCase();
    if (!name) return false;
    return name === 'localhost' || name === '[::1]' || name === '::1'
      || /^127\./.test(name)
      || /^10\./.test(name)
      || /^192\.168\./.test(name)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(name)
      || /\.local$/.test(name);
  }

  function hostnameOf(target) {
    try {
      return new URL(String(target)).hostname;
    } catch (error) {
      return '';
    }
  }

  // True when this page is on a public origin and the endpoint is private:
  // exactly the direction Local Network Access governs.
  function isLocalNetworkTarget(target) {
    return isLocalHostname(hostnameOf(target)) && !isLocalHostname(location.hostname);
  }

  function formatFetchError(error, target) {
    if (error instanceof TypeError) {
      if (target && isLocalNetworkTarget(target)) {
        return 'Failed to fetch — this page is on a public origin and the endpoint is on a local '
          + 'or private address. Chrome can require Local Network Access permission for that; allow '
          + 'it when prompted, or open this site locally so the request stays local. If it was '
          + 'allowed (or blocked outright), the endpoint must also send '
          + 'Access-Control-Allow-Origin for this origin plus Access-Control-Allow-Headers '
          + 'authorization, content-type.';
      }
      return 'Failed to fetch — network or CORS blocked (the endpoint must send '
        + 'Access-Control-Allow-Origin for this origin plus Access-Control-Allow-Headers '
        + 'authorization, content-type; curl from a terminal still works)';
    }
    return error && error.message ? error.message : String(error);
  }

  function humanizeSegment(pathname) {
    var parts = String(pathname || '').split('/').filter(Boolean);
    var last = parts.length ? parts[parts.length - 1] : '';
    last = last.replace(/[-_]+/g, ' ');
    return last ? last.charAt(0).toUpperCase() + last.slice(1) : 'this page';
  }

  function titleFromMarkdown(text, fallback) {
    var match = /^#\s+(.+)$/m.exec(String(text || ''));
    return match ? match[1].trim() : fallback;
  }

  /* ---------- model list ---------- */

  function readModelCache(base) {
    var raw = ssGet(SS_MODELS);
    if (!raw) return null;
    var entry;
    try { entry = JSON.parse(raw); } catch (e) { return null; }
    if (!entry || entry.endpoint !== base) return null;
    if (typeof entry.at !== 'number' || Date.now() - entry.at > MODELS_TTL) return null;
    if (!Array.isArray(entry.models)) return null;
    return entry.models;
  }

  function writeModelCache(base, models) {
    ssSet(SS_MODELS, JSON.stringify({ endpoint: base, at: Date.now(), models: models }));
  }

  // A typo'd or firewalled host drops the SYN and never rejects, which used to
  // leave the model select and status parked on "Saved." forever — the
  // commonest field failure showing no diagnostic at all. AbortSignal.timeout
  // bounds it and turns the hang into a message.
  var MODEL_LIST_TIMEOUT_MS = 10000;

  function listModels(base, key, done) {
    var cached = readModelCache(base);
    if (cached) {
      done({ ok: true, models: cached });
      return;
    }
    var url = modelsUrl(base);
    var options = { headers: { Authorization: 'Bearer ' + key } };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      options.signal = AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS);
    }
    fetch(url, options)
      .then(function (response) {
        return response.text().then(function (text) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ' ' + response.statusText
              + (text ? ' — ' + text.slice(0, 200) : ''));
          }
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error('Non-JSON response: ' + text.slice(0, 200));
          }
        });
      })
      .then(function (payload) {
        var ids = extractModels(payload)
          .map(function (model) { return model && (model.id || model.name); })
          .filter(Boolean);
        if (!ids.length) {
          done({ ok: false, reason: 'no models returned by ' + url });
          return;
        }
        // Failed fetches are never cached; only a successful list is.
        writeModelCache(base, ids);
        done({ ok: true, models: ids });
      })
      .catch(function (error) {
        if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
          done({
            ok: false,
            reason: 'no response from ' + url + ' within '
              + Math.round(MODEL_LIST_TIMEOUT_MS / 1000)
              + 's — host unreachable or firewalled, or Local Network Access was not allowed'
          });
          return;
        }
        done({ ok: false, reason: formatFetchError(error, url) });
      });
  }

  /* ---------- role A: forward the source path onto the Chat link ---------- */

  function isChatPath(pathname) {
    return /\/chat\/?$/.test(pathname || '');
  }

  function installSrcForwarding() {
    // Capture phase so the href is rewritten before the browser follows it.
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var target = event.target;
      var link = target && target.closest ? target.closest('a[href]') : null;
      if (!link) return;
      var url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch (e) { return; }
      if (url.origin !== location.origin) return;
      if (!isChatPath(url.pathname)) return;
      if (url.searchParams.has('src')) return;
      if (isChatPath(location.pathname)) return;
      url.searchParams.set('src', location.pathname);
      link.setAttribute('href', url.pathname + url.search + url.hash);
    }, true);
  }

  /* ---------- role B: the widget ---------- */

  function mountChat(root) {
    root.hidden = false;

    var state = {
      url: normalizeEndpoint(lsGet(LS_URL)),
      key: lsGet(LS_KEY),
      model: lsGet(LS_MODEL),
      contextLabel: '',
      contextNote: '',
      contextText: '',
      history: [],
      controller: null
    };

    root.innerHTML = ''
      + '<div class="td-chat-config">'
      + '  <label for="td-chat-url">Model URL</label>'
      + '  <input id="td-chat-url" type="url" autocomplete="off" spellcheck="false" '
      + 'placeholder="https://api.example.com/v1">'
      + '  <label for="td-chat-key">API Key</label>'
      + '  <input id="td-chat-key" type="password" autocomplete="new-password" spellcheck="false">'
      + '  <label for="td-chat-model">Model</label>'
      + '  <select id="td-chat-model"><option value="" selected disabled>— set a URL and key —</option></select>'
      + '  <div class="td-chat-config-actions">'
      + '    <button type="button" class="td-chat-save">Save</button>'
      + '    <button type="button" class="td-chat-retry secondary" hidden>Retry model list</button>'
      + '  </div>'
      + '  <p class="td-chat-config-hint">Saved in this browser only — messages go straight to the '
      + 'endpoint above, never to this site.</p>'
      + '  <p class="td-chat-status" role="status" aria-live="polite"></p>'
      + '</div>'
      + '<p class="td-chat-context"></p>'
      + '<ol class="td-chat-transcript" aria-live="polite"></ol>'
      + '<div class="td-chat-input">'
      + '  <textarea id="td-chat-prompt" rows="3" placeholder="Ask about this manual…"></textarea>'
      + '  <div class="td-chat-input-actions">'
      + '    <button type="button" class="td-chat-send">Send</button>'
      + '    <button type="button" class="td-chat-stop secondary" disabled>Stop</button>'
      + '  </div>'
      + '</div>';

    var urlInput = root.querySelector('#td-chat-url');
    var keyInput = root.querySelector('#td-chat-key');
    var modelSelect = root.querySelector('#td-chat-model');
    var saveButton = root.querySelector('.td-chat-save');
    var retryButton = root.querySelector('.td-chat-retry');
    var statusEl = root.querySelector('.td-chat-status');
    var contextEl = root.querySelector('.td-chat-context');
    var transcriptEl = root.querySelector('.td-chat-transcript');
    var promptEl = root.querySelector('#td-chat-prompt');
    var sendButton = root.querySelector('.td-chat-send');
    var stopButton = root.querySelector('.td-chat-stop');

    if (!storageAvailable()) {
      var banner = document.createElement('div');
      banner.className = 'td-chat-warning';
      banner.setAttribute('role', 'alert');
      banner.innerHTML = 'Saving is unavailable in this browser — settings will not persist. '
        + '<button type="button" class="secondary" aria-label="Dismiss">Dismiss</button>';
      root.insertBefore(banner, root.firstChild);
      banner.querySelector('button').addEventListener('click', function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      });
    }

    function setStatus(text, isError) {
      statusEl.textContent = text || '';
      if (isError) statusEl.setAttribute('data-state', 'error');
      else statusEl.removeAttribute('data-state');
    }

    function renderContext() {
      contextEl.textContent = state.contextLabel
        ? 'Discussing: ' + state.contextLabel + ' · ' + state.contextNote
        : '';
    }

    function paintConfig() {
      urlInput.value = state.url;
      keyInput.value = '';
      keyInput.placeholder = state.key
        ? previewKey(state.key) + ' (saved — type to replace)'
        : 'paste your API key';
    }

    /* ---------- models ---------- */

    function populateModels(models) {
      modelSelect.innerHTML = '';
      var placeholder = new Option('— select a model —', '', true, true);
      placeholder.disabled = true;
      modelSelect.appendChild(placeholder);
      models.forEach(function (id) {
        // value = full id (a gateway needs its namespace in the request),
        // label = short name.
        modelSelect.appendChild(new Option(normalizeModelId(id), id, false, false));
      });
      if (!state.model) return;
      for (var i = 0; i < modelSelect.options.length; i++) {
        if (modelSelect.options[i].value === state.model) {
          modelSelect.selectedIndex = i;
          return;
        }
      }
    }

    function refreshModels() {
      retryButton.hidden = true;
      if (!state.url || !state.key) {
        modelSelect.innerHTML = '';
        var option = new Option('— set a URL and key —', '', true, true);
        option.disabled = true;
        modelSelect.appendChild(option);
        return;
      }
      listModels(state.url, state.key, function (result) {
        if (!result.ok) {
          // The reason is the diagnostic: CORS, 401, typo — show it verbatim.
          modelSelect.innerHTML = '';
          var failed = new Option('Model list unavailable', '', true, true);
          failed.disabled = true;
          modelSelect.appendChild(failed);
          retryButton.hidden = false;
          setStatus('Model list unavailable — ' + result.reason, true);
          return;
        }
        populateModels(result.models);
        setStatus('');
      });
    }

    /* ---------- documentation context ---------- */

    function applyContext(text, label) {
      var trimmed = String(text || '').trim();
      var truncated = trimmed.length > CONTEXT_CAP;
      state.contextText = truncated ? trimmed.slice(0, CONTEXT_CAP) + TRUNCATED_NOTE : trimmed;
      state.contextLabel = label;
      state.contextNote = trimmed.length + ' characters'
        + (truncated ? ' — truncated to ' + CONTEXT_CAP : '');
      renderContext();
    }

    function contextFailed(label, error) {
      state.contextText = '';
      state.contextLabel = label;
      state.contextNote = 'documentation failed to load';
      renderContext();
      setStatus('Documentation failed to load: ' + formatFetchError(error), true);
    }

    function loadContext() {
      var raw = new URLSearchParams(location.search).get('src');

      if (!raw) {
        // Direct visit: the whole-manual bundle, injected by body-end.html.
        var bundleUrl = window.__TD_CHAT__ && window.__TD_CHAT__.llmsFull;
        if (!bundleUrl) {
          contextFailed('the whole manual', new Error('no bundle configured'));
          return;
        }
        state.contextLabel = 'the whole manual';
        renderContext();
        fetch(bundleUrl)
          .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
            return response.text();
          })
          .then(function (text) { applyContext(text, 'the whole manual'); })
          .catch(function (error) { contextFailed('the whole manual', error); });
        return;
      }

      // From a page: Hugo publishes the per-page markdown at <dir>/index.md;
      // a source path without a trailing slash carries <path>.md instead.
      var pagePath = raw;
      try { pagePath = decodeURIComponent(raw); } catch (e) { /* keep raw */ }
      var source = pagePath + (/\/$/.test(pagePath) ? 'index.md' : '.md');
      var label = humanizeSegment(pagePath);
      state.contextLabel = label;
      renderContext();

      fetch(source)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
          return response.text();
        })
        .then(function (text) {
          // The page's own H1 is the real title; the URL segment is the guess.
          applyContext(text, titleFromMarkdown(text, label));
        })
        .catch(function (error) { contextFailed(label, error); });
    }

    /* ---------- transcript ---------- */

    function addMessage(role) {
      var item = document.createElement('li');
      item.className = 'td-chat-msg td-chat-msg--' + role;
      var roleEl = document.createElement('span');
      roleEl.className = 'td-chat-msg-role';
      roleEl.textContent = role === 'user' ? 'You' : 'Assistant';
      var body = document.createElement('div');
      body.className = 'td-chat-msg-body';
      item.appendChild(roleEl);
      item.appendChild(body);
      transcriptEl.appendChild(item);
      return body;
    }

    function systemPrompt() {
      return state.contextText ? SYSTEM_PREFIX + state.contextText : SYSTEM_NO_DOC;
    }

    function setBusy(busy) {
      sendButton.disabled = busy;
      stopButton.disabled = !busy;
      saveButton.disabled = busy;
    }

    function sendMessage() {
      if (state.controller) return; // one request in flight at a time
      var text = promptEl.value.trim();
      if (!text) {
        setStatus('Type a question first.', true);
        return;
      }
      if (!state.url || !state.key) {
        setStatus('Set the model URL and API key first, then Save.', true);
        return;
      }
      if (!modelSelect.value) {
        setStatus('Pick a model from the list first.', true);
        return;
      }
      state.model = modelSelect.value;
      promptEl.value = '';
      var userBody = addMessage('user');
      userBody.textContent = text;
      var assistantBody = addMessage('assistant');
      assistantBody.textContent = '';
      stream(text, assistantBody);
    }

    function stream(userText, body) {
      // History carries the raw text; the system prompt is rebuilt per request
      // so a context fetch that finishes late still reaches the model.
      state.history.push({ role: 'user', content: userText });
      var messages = [{ role: 'system', content: systemPrompt() }].concat(state.history);
      var controller = new AbortController();
      state.controller = controller;
      var answer = '';
      var pending = false;

      function flush() {
        pending = false;
        body.innerHTML = safeMarkdown(answer);
      }

      setBusy(true);
      setStatus('Streaming…');

      fetch(chatUrl(state.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.key },
        signal: controller.signal,
        body: JSON.stringify({
          model: state.model,
          stream: true,
          stream_options: { include_usage: true },
          messages: messages
        })
      })
        .then(function (response) {
          if (!response.ok) {
            return response.text().then(function (text) {
              throw new Error('HTTP ' + response.status + ' ' + response.statusText
                + (text ? ' — ' + text.slice(0, 200) : ''));
            });
          }
          return readSse(response, function (delta) {
            answer += delta;
            // rAF batching: at most one re-render per frame.
            if (!pending) {
              pending = true;
              requestAnimationFrame(flush);
            }
          });
        })
        .then(function () {
          flush();
          if (answer) state.history.push({ role: 'assistant', content: answer });
          setStatus('');
        })
        .catch(function (error) {
          flush();
          if (error && error.name === 'AbortError') {
            // The partial answer stays on screen and stays in history.
            if (answer) state.history.push({ role: 'assistant', content: answer });
            setStatus('Stopped.');
            return;
          }
          setStatus('Request failed: ' + formatFetchError(error, chatUrl(state.url)), true);
        })
        .then(function () {
          state.controller = null;
          setBusy(false);
          promptEl.focus();
        });
    }

    function readSse(response, onDelta) {
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      var sawDone = false;


      function processEvent(eventText) {
        eventText.split('\n').forEach(function (line) {
          if (line.slice(0, 5) !== 'data:') return;
          var payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            sawDone = true;
            return;
          }
          var chunk;
          try { chunk = JSON.parse(payload); } catch (e) { return; }
          var delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && delta.content) onDelta(delta.content);
        });
      }

      function readChunk() {
        if (sawDone) return Promise.resolve();
        return reader.read().then(function (result) {
          if (result.done) return;
          buffer += decoder.decode(result.value, { stream: true });
          var parts = buffer.split('\n\n');
          buffer = parts.pop();
          parts.forEach(processEvent);
          return readChunk();
        });
      }

      return readChunk().then(function () {
        buffer += decoder.decode();
        if (buffer) processEvent(buffer);
      });
    }

    stopButton.addEventListener('click', function () {
      if (state.controller) state.controller.abort();
    });

    saveButton.addEventListener('click', function () {
      var url = normalizeEndpoint(urlInput.value);
      if (!url) {
        setStatus('Enter the model endpoint URL first.', true);
        return;
      }
      var typedKey = keyInput.value.trim();
      state.url = url;
      state.key = typedKey || state.key;
      lsSet(LS_URL, state.url);
      lsSet(LS_KEY, state.key);
      paintConfig();
      setStatus(state.key ? 'Saved.' : 'Enter an API key to list models.', !state.key);
      refreshModels();
    });

    retryButton.addEventListener('click', refreshModels);

    modelSelect.addEventListener('change', function () {
      state.model = modelSelect.value;
      lsSet(LS_MODEL, state.model);
    });

    promptEl.addEventListener('keydown', function (event) {
      // Enter sends; Shift+Enter keeps the newline.
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

    sendButton.addEventListener('click', sendMessage);

    paintConfig();
    refreshModels();
    loadContext();
  }

  /* ---------- boot ---------- */

  function boot() {
    // Print bundles render the same page body, so they carry the mount too;
    // the widget has no business running there (the print view is a document,
    // not a live page).
    if (document.body && document.body.classList.contains('td-print-view')) return;
    var root = document.getElementById('td-chat');
    if (root) mountChat(root);
    else installSrcForwarding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
