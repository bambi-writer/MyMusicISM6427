(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const HISTORY_KEY = 'mmi.jobs.v1';
  const CODE_KEY = 'mmi.access';
  const POLL_MS = 8000;
  const MAX_POLL_MS = 15 * 60 * 1000;

  const STATUS = {
    PENDING: { label: 'Queued', cls: 'run', pct: 10 },
    TEXT_SUCCESS: { label: 'Writing…', cls: 'run', pct: 35 },
    FIRST_SUCCESS: { label: 'Almost there', cls: 'run', pct: 70 },
    SUCCESS: { label: 'Ready', cls: 'ok', pct: 100 },
    CREATE_TASK_FAILED: { label: 'Failed', cls: 'fail' },
    GENERATE_AUDIO_FAILED: { label: 'Failed', cls: 'fail' },
    CALLBACK_EXCEPTION: { label: 'Failed', cls: 'fail' },
    SENSITIVE_WORD_ERROR: { label: 'Blocked', cls: 'fail' },
  };
  const isDone = (s) => s === 'SUCCESS' || (STATUS[s] && STATUS[s].cls === 'fail');

  const IDEAS = [
    'Lo-fi hip hop beat for late-night studying, rain sounds',
    'Epic cinematic orchestral piece for a movie trailer',
    'Upbeat 80s synthwave song about driving at midnight',
    'Soulful acoustic ballad about coming home',
    'Energetic K-pop dance track with a catchy hook',
    'Country song about a small-town summer romance',
  ];

  // ---------- storage helpers ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  let jobs = store.get(HISTORY_KEY, []);
  const saveJobs = () => store.set(HISTORY_KEY, jobs.slice(0, 50));

  // ---------- API ----------
  async function api(path, opts = {}) {
    const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}) };
    const code = store.get(CODE_KEY, '');
    if (code) headers['x-access-code'] = code;
    const res = await fetch(`/api/${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = { code: res.status, msg: `Request failed (${res.status})` }; }
    if (res.status === 401) $('#access-card').hidden = false;
    if (data.code !== 200) throw new Error(friendlyError(data));
    return data.data;
  }

  function friendlyError(d) {
    const map = {
      401: 'Not authorized. Check the access code or the server API key.',
      405: 'Rate limit hit — wait a moment and try again.',
      413: 'Your prompt or lyrics are too long.',
      429: 'Out of credits. Top up your SunoAPI.org account.',
      430: 'Too many requests — please slow down.',
      455: 'SunoAPI is under maintenance. Try again later.',
    };
    return map[d.code] || d.msg || 'Something went wrong.';
  }

  async function refreshCredits() {
    try {
      const c = await api('credits');
      $('#credits').textContent = `Credits: ${c}`;
    } catch {
      $('#credits').textContent = 'Credits: —';
    }
  }

  // ---------- form mode ----------
  let mode = 'simple';
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      mode = t.dataset.mode;
      document.querySelectorAll('.tab').forEach((x) => {
        x.classList.toggle('active', x === t);
        x.setAttribute('aria-selected', x === t);
      });
      document.querySelectorAll('.mode').forEach((p) => (p.hidden = p.dataset.panel !== mode));
    })
  );

  const instrumentalEl = $('#instrumental');
  const syncInstrumental = () => {
    const off = instrumentalEl.checked;
    $('#lyrics').disabled = off;
    $('#lyrics-block').style.opacity = off ? 0.4 : 1;
    $('#lyrics').style.opacity = off ? 0.4 : 1;
  };
  instrumentalEl.addEventListener('change', syncInstrumental);

  [['styleWeight', 'styleWeight-out'], ['weird', 'weird-out'], ['variety', 'variety-out']].forEach(([i, o]) => {
    const inp = $('#' + i);
    inp.addEventListener('input', () => ($('#' + o).textContent = inp.value));
  });

  const chips = $('#idea-chips');
  IDEAS.forEach((idea) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = idea;
    b.onclick = () => { $('#prompt').value = idea; $('#prompt').focus(); };
    chips.appendChild(b);
  });

  // ---------- AI lyrics ----------
  $('#ai-lyrics-toggle').onclick = () => { $('#ai-lyrics').hidden = !$('#ai-lyrics').hidden; };
  $('#lyrics-go').onclick = async () => {
    const prompt = $('#lyrics-prompt').value.trim();
    const box = $('#lyrics-options');
    if (!prompt) { box.textContent = 'Tell me what the song is about first.'; return; }
    const btn = $('#lyrics-go');
    btn.disabled = true;
    box.textContent = 'Writing lyrics… (usually 10–30 seconds)';
    try {
      const { taskId } = await api('lyrics', { method: 'POST', body: { prompt } });
      const start = Date.now();
      while (Date.now() - start < 3 * 60 * 1000) {
        await sleep(4000);
        const r = await api(`lyrics-status?taskId=${encodeURIComponent(taskId)}`);
        if (r.status === 'SUCCESS') {
          box.innerHTML = '';
          if (!r.options.length) { box.textContent = 'No lyrics returned. Try another prompt.'; break; }
          r.options.forEach((opt) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lyric-opt';
            const s = document.createElement('strong');
            s.textContent = (opt.title || 'Option') + ' — click to use';
            b.append(s, document.createTextNode(opt.text));
            b.onclick = () => {
              $('#lyrics').value = opt.text;
              if (!$('#title').value && opt.title) $('#title').value = opt.title;
              $('#ai-lyrics').hidden = true;
            };
            box.appendChild(b);
          });
          break;
        }
        if (r.status !== 'PENDING') { box.textContent = r.errorMessage || `Lyrics failed (${r.status}).`; break; }
      }
    } catch (e) {
      box.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- submit ----------
  $('#gen-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#form-error');
    err.textContent = '';
    const instrumental = instrumentalEl.checked;
    const model = $('#model').value;
    let body, label;

    if (mode === 'simple') {
      const prompt = $('#prompt').value.trim();
      const style = $('#simple-style').value.trim();
      if (!prompt && !style) { err.textContent = 'Describe the song you want.'; return; }
      body = { customMode: false, instrumental, model, prompt, style };
      label = prompt || style;
    } else {
      body = {
        customMode: true, instrumental, model,
        title: $('#title').value.trim(),
        style: $('#style').value.trim(),
        lyrics: instrumental ? '' : $('#lyrics').value.trim(),
        negativeTags: $('#negative').value.trim(),
        vocalGender: $('#gender').value,
        styleWeight: $('#styleWeight').value,
        weirdnessConstraint: $('#weird').value,
        variety: $('#variety').value,
        duration: $('#duration').value,
      };
      if (!body.style && !body.lyrics && !body.negativeTags) {
        err.textContent = 'Add a style or some lyrics.';
        return;
      }
      label = body.title || body.style || 'Custom song';
    }

    const btn = $('#submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const { taskId } = await api('generate', { method: 'POST', body });
      const job = {
        taskId, label, model, instrumental, mode,
        createdAt: Date.now(), status: 'PENDING', tracks: [],
      };
      jobs.unshift(job);
      saveJobs();
      render();
      poll(job);
      document.querySelector('.section-head').scrollIntoView({ behavior: 'smooth' });
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate music';
    }
  });

  // ---------- polling ----------
  const polling = new Set();
  async function poll(job) {
    if (polling.has(job.taskId)) return;
    polling.add(job.taskId);
    try {
      while (!isDone(job.status) && Date.now() - job.createdAt < MAX_POLL_MS) {
        try {
          const r = await api(`status?taskId=${encodeURIComponent(job.taskId)}`);
          job.status = r.status;
          job.error = r.errorMessage;
          if (r.tracks.length) job.tracks = r.tracks;
          saveJobs();
          renderJob(job);
        } catch (e) {
          job.lastError = e.message;
        }
        if (!isDone(job.status)) await sleep(POLL_MS);
      }
      if (!isDone(job.status)) {
        job.error = 'Still processing after 15 minutes. Reload later to check again.';
        renderJob(job);
      }
      if (job.status === 'SUCCESS') refreshCredits();
    } finally {
      polling.delete(job.taskId);
    }
  }

  // ---------- rendering ----------
  const nodes = new Map();
  function render() {
    const wrap = $('#jobs');
    $('#empty').hidden = jobs.length > 0;
    const keep = new Set(jobs.map((j) => j.taskId));
    for (const [id, el] of nodes) if (!keep.has(id)) { el.remove(); nodes.delete(id); }
    jobs.forEach((job, i) => {
      let el = nodes.get(job.taskId);
      if (!el) {
        el = $('#job-tpl').content.firstElementChild.cloneNode(true);
        nodes.set(job.taskId, el);
      }
      if (wrap.children[i] !== el) wrap.insertBefore(el, wrap.children[i] || null);
      renderJob(job);
    });
  }

  function renderJob(job) {
    const el = nodes.get(job.taskId);
    if (!el) return;
    const st = STATUS[job.status] || { label: job.status, cls: 'run', pct: 20 };
    el.classList.toggle('done', isDone(job.status));
    el.classList.toggle('running', !isDone(job.status));
    $('.job-title', el).textContent = job.label;
    $('.job-meta', el).textContent =
      `${new Date(job.createdAt).toLocaleString()} · ${job.model}${job.instrumental ? ' · instrumental' : ''}`;
    const badge = $('.badge', el);
    badge.textContent = st.label;
    badge.className = `badge ${st.cls}`;
    $('.bar', el).style.width = `${st.pct || 100}%`;
    $('.job-error', el).textContent = st.cls === 'fail' ? job.error || 'Generation failed.' : job.error || '';

    const tracksEl = $('.tracks', el);
    const sig = JSON.stringify(job.tracks.map((t) => [t.id, t.audioUrl, t.streamUrl, t.imageUrl]));
    if (tracksEl.dataset.sig === sig) return;
    tracksEl.dataset.sig = sig;
    tracksEl.innerHTML = '';
    job.tracks.forEach((t, idx) => tracksEl.appendChild(trackEl(t, idx)));
  }

  function trackEl(t, idx) {
    const d = document.createElement('div');
    d.className = 'track';
    const img = document.createElement('img');
    img.className = 'cover';
    img.alt = '';
    img.loading = 'lazy';
    if (t.imageUrl) img.src = t.imageUrl;
    const body = document.createElement('div');
    body.className = 'track-body';
    const title = document.createElement('div');
    title.className = 'track-title';
    title.textContent = t.title || `Variation ${idx + 1}`;
    const tags = document.createElement('div');
    tags.className = 'track-tags';
    tags.textContent = [t.tags, t.duration ? fmtTime(t.duration) : ''].filter(Boolean).join(' · ');
    body.append(title, tags);

    const src = t.audioUrl || t.streamUrl;
    if (src) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = src;
      body.appendChild(audio);
    } else {
      const p = document.createElement('div');
      p.className = 'track-tags';
      p.textContent = 'Rendering audio…';
      body.appendChild(p);
    }

    const actions = document.createElement('div');
    actions.className = 'track-actions';
    if (t.audioUrl) {
      const a = document.createElement('a');
      a.href = t.audioUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.download = `${(t.title || 'track').replace(/[^\w\- ]+/g, '')}.mp3`;
      a.textContent = '⬇ Download MP3';
      actions.appendChild(a);
    } else if (t.streamUrl) {
      const s = document.createElement('span');
      s.className = 'muted';
      s.textContent = 'Streaming preview · download available when finished';
      actions.appendChild(s);
    }
    if (t.prompt && t.prompt.includes('[')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Lyrics';
      const pre = document.createElement('div');
      pre.className = 'lyrics-view';
      pre.textContent = t.prompt;
      pre.hidden = true;
      b.onclick = () => (pre.hidden = !pre.hidden);
      actions.appendChild(b);
      body.append(actions, pre);
    } else {
      body.appendChild(actions);
    }

    d.append(img, body);
    return d;
  }

  // ---------- misc ----------
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function fmtTime(s) { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  $('#clear-history').onclick = () => {
    if (!jobs.length || !confirm('Clear all tracks from this browser? (Download any you want to keep first.)')) return;
    jobs = [];
    saveJobs();
    render();
  };

  $('#access-code').value = store.get(CODE_KEY, '');
  $('#save-code').onclick = () => {
    store.set(CODE_KEY, $('#access-code').value.trim());
    $('#access-card').hidden = true;
    refreshCredits();
  };

  // ---------- boot ----------
  syncInstrumental();
  render();
  refreshCredits();
  jobs.filter((j) => !isDone(j.status) && Date.now() - j.createdAt < 24 * 3600 * 1000).forEach(poll);
})();
