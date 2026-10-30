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

  var ASSISTANT_NAME = 'CAIssistant';

  var SYSTEM_PREFIX = 'You are ' + ASSISTANT_NAME + ', the assistant for this field manual. '
    + 'Answer strictly from the documentation below; say so when something isn\'t covered.\n\n'
    + 'Documentation:\n\n';
  var SYSTEM_NO_DOC = 'You are ' + ASSISTANT_NAME + ', the assistant for this field manual. The '
    + 'documentation failed to load in this browser, so you have no document context; say plainly '
    + 'when you cannot answer.';

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

  // Escape first, then a tiered transform. Both block constructs — fenced
  // code and lists — are lifted out as opaque placeholders before the inline
  // and newline rules run. That ordering is the whole correctness argument:
  // inline rules would rewrite markdown *inside* a fence, and the newline
  // rule would inject <br> between a <ul> and its own <li> elements.
  // Still no raw HTML, no images, no autolinks.
  function inlineMarkdown(s) {
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  // Consecutive "- ", "* " or "1. " lines become one list. Item text goes
  // through the inline rules, so bold, code, and links survive in an item.
  // Returns the replacement string plus the list markup it consumed.
  function extractLists(lines, blocks) {
    var out = [];
    var run = null;
    var items = [];
    function close() {
      if (!run) return;
      blocks.push('<' + run + '>' + items.join('') + '</' + run + '>');
      out.push('\u0000' + (blocks.length - 1) + '\u0000');
      run = null;
      items = [];
    }
    lines.forEach(function (line) {
      var bullet = /^\s*[-*]\s+(.+)$/.exec(line);
      var numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
      var ordered = !bullet && !!numbered;
      var body = bullet ? bullet[1] : numbered ? numbered[1] : null;
      if (!body) {
        close();
        out.push(line);
        return;
      }
      var kind = ordered ? 'ol' : 'ul';
      if (run !== kind) {
        close();
        run = kind;
      }
      items.push('<li>' + inlineMarkdown(body) + '</li>');
    });
    close();
    return out.join('\n');
  }

  // Shared placeholder pool: fences first, then lists. Both are restored in
  // one pass at the end, so a list inside a fence is impossible by
  // construction (the fence text is already a placeholder when lists scan).
  function restoreBlocks(s, blocks) {
    return s.replace(/\u0000(\d+)\u0000/g, function (match, index) {
      return blocks[Number(index)];
    });
  }

  function safeMarkdown(text) {
    var s = escapeHtml(text);
    var blocks = [];
    s = s.replace(/```([\w+-]*)\n([\s\S]*?)```/g, function (match, lang, code) {
      blocks.push('<pre class="td-chat-pre"><code'
        + (lang ? ' class="language-' + lang + '"' : '') + '>'
        + code.replace(/\n+$/, '') + '</code></pre>');
      return '\u0000' + (blocks.length - 1) + '\u0000';
    });
    s = extractLists(s.split('\n'), blocks);
    s = s.replace(/^#{2,4}\s+(.+)$/gm, '<strong>$1</strong>');
    s = inlineMarkdown(s);
    s = s.replace(/\n/g, '<br>');
    return restoreBlocks(s, blocks);
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
      + '<div class="td-chat-notices" role="status" aria-live="polite"></div>'
      + '<p class="td-chat-context"></p>'
      + '<ol class="td-chat-transcript" role="log"></ol>'
      + '<p class="td-chat-empty">Ask a question and the answer appears here, grounded in this '
      + 'manual.</p>'
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
    var noticesEl = root.querySelector('.td-chat-notices');
    var emptyEl = root.querySelector('.td-chat-empty');
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

    // One message. Returns handles, not a DOM body: the assistant turn needs
    // the reasoning disclosure and the meta line, the user turn needs neither.
    function addMessage(role) {
      var item = document.createElement('li');
      item.className = 'td-chat-msg td-chat-msg--' + role;

      var roleEl = document.createElement('span');
      roleEl.className = 'td-chat-msg-role';
      roleEl.textContent = role === 'user' ? 'You' : ASSISTANT_NAME;

      var head = document.createElement('div');
      head.className = 'td-chat-msg-head';
      head.appendChild(roleEl);
      item.appendChild(head);

      var handle = { item: item, head: head, body: null, reasoning: null, summary: null };

      if (role === 'assistant') {
        // <details> is the whole feature: keyboard-operable, no JS toggle to
        // keep in sync with state, and it survives re-render of the body.
        // Hidden until a reasoning delta arrives: most gateways never send
        // one, and a permanent "Thinking…" row on those would be a lie.
        var details = document.createElement('details');
        details.className = 'td-chat-reasoning';
        details.hidden = true;
        var summary = document.createElement('summary');
        summary.className = 'td-chat-reasoning-summary';
        summary.textContent = 'Thinking…';
        var thought = document.createElement('div');
        thought.className = 'td-chat-reasoning-body';
        details.appendChild(summary);
        details.appendChild(thought);
        item.insertBefore(details, null);
        handle.reasoning = details;
        handle.reasoningBody = thought;
        handle.summary = summary;
      }

      var body = document.createElement('div');
      body.className = 'td-chat-msg-body';
      item.appendChild(body);
      handle.body = body;

      transcriptEl.appendChild(item);
      if (emptyEl) emptyEl.hidden = true;
      return handle;
    }

    function removeMessage(handle) {
      if (handle && handle.item.parentNode) handle.item.parentNode.removeChild(handle.item);
      if (transcriptEl.children.length === 0 && emptyEl) emptyEl.hidden = false;
    }

    function systemPrompt() {
      return state.contextText ? SYSTEM_PREFIX + state.contextText : SYSTEM_NO_DOC;
    }

    function setBusy(busy) {
      sendButton.disabled = busy;
      stopButton.disabled = !busy;
      saveButton.disabled = busy;
      // role="log" is an implicit polite live region, so without this every
      // rAF flush would be announced and a screen reader would read the
      // answer over and over as it streams. aria-busy suppresses that until
      // the turn settles, then the finished message is announced once.
      transcriptEl.setAttribute('aria-busy', busy ? 'true' : 'false');
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
      var userMessage = addMessage('user');
      userMessage.body.textContent = text;
      stream(text, addMessage('assistant'));
    }

    function stream(userText, message) {
      // History carries the raw user/assistant content only: reasoning is a
      // display artifact, and endpoints that reject the field would 400 on an
      // echo, while the ones that accept it bill the whole chain again.
      //
      // The turn is committed on success, not on send: pushing here meant a
      // failed turn left a user message with no reply behind it, so the next
      // request carried a dangling question the transcript never showed.
      var messages = [{ role: 'system', content: systemPrompt() }]
        .concat(state.history)
        .concat([{ role: 'user', content: userText }]);
      var controller = new AbortController();
      state.controller = controller;
      var answer = '';
      var thought = '';
      var pending = false;
      var reasoningPending = false;
      var startedAt = Date.now();
      var firstTokenAt = 0;

      function flush() {
        pending = false;
        message.body.innerHTML = safeMarkdown(answer);
      }

      function flushReasoning() {
        reasoningPending = false;
        message.reasoningBody.textContent = thought;
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
            if (!firstTokenAt) firstTokenAt = Date.now();
            answer += delta;
            // rAF batching: at most one re-render per frame.
            if (!pending) {
              pending = true;
              requestAnimationFrame(flush);
            }
          }, function (delta) {
            if (!thought) {
              // First reasoning delta: the panel becomes real, and opens so
              // the reader sees the model is working before the answer lands.
              message.reasoning.hidden = false;
              message.reasoning.open = true;
            }
            thought += delta;
            if (!reasoningPending) {
              reasoningPending = true;
              requestAnimationFrame(flushReasoning);
            }
          });
        })
        .then(function () {
          flush();
          finish();
          setStatus('');
        })
        .catch(function (error) {
          // A mid-stream drop must not wipe what already arrived: keep the
          // partial answer and commit it. A turn that streamed nothing keeps
          // the reader's question on screen (so it can be retried) but stays
          // out of history, since the model never answered it.
          if (answer) finish();
          else removeMessage(message);
          if (error && error.name === 'AbortError') {
            setStatus('Stopped.');
            return;
          }
          setStatus('');
          noticesEl.insertAdjacentHTML('beforeend',
            '<div class="td-chat-notice" data-tone="error">'
              + escapeHtml('Request failed: ' + formatFetchError(error, chatUrl(state.url)))
              + '</div>');
        })
        .then(function () {
          state.controller = null;
          setBusy(false);
          promptEl.focus();
        });

      function finish() {
        if (!answer) {
          // Stop pressed before the first token, or an empty completion.
          removeMessage(message);
          return;
        }
        state.history.push({ role: 'user', content: userText });
        state.history.push({ role: 'assistant', content: answer });
        summarizeReasoning(message, thought, startedAt, firstTokenAt);
      }
    }

    // Collapsed label: the reader sees what the panel is worth at a glance —
    // how long it thought, and how many tokens it spent thinking.
    function summarizeReasoning(message, thought, startedAt, firstTokenAt) {
      var details = message.reasoning;
      if (!thought || !details) {
        if (details && details.parentNode) details.parentNode.removeChild(details);
        return;
      }
      var seconds = ((firstTokenAt || Date.now()) - startedAt) / 1000;
      var timing = seconds >= 0.1 ? 'Thought for ' + seconds.toFixed(1) + ' s' : 'Thought briefly';
      message.summary.textContent = timing + ' · ' + thought.length + ' characters';
      // Collapse the reasoning panel only; the answer body is the point.
      details.open = false;
    }

    // Reasoning arrives on a different delta field per backend:
    //   reasoning_content — DeepSeek, vLLM, QwQ, most distills
    //   reasoning         — OpenRouter (string)
    //   reasoning_details — OpenRouter (array of {type, text} segments)
    // The array form must join every segment: [0].text alone truncates a
    // multi-segment reasoning block to its first piece.
    function reasoningDelta(delta) {
      if (typeof delta.reasoning_content === 'string') return delta.reasoning_content;
      if (typeof delta.reasoning === 'string') return delta.reasoning;
      if (Array.isArray(delta.reasoning_details)) {
        return delta.reasoning_details.map(function (part) {
          return part && typeof part.text === 'string' ? part.text : '';
        }).join('');
      }
      return '';
    }

    function readSse(response, onDelta, onReasoning) {
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
          if (!delta) return;
          var thought = reasoningDelta(delta);
          if (thought) onReasoning(thought);
          if (delta.content) onDelta(delta.content);
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
