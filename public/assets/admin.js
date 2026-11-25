(function () {
  var GROUPS = [
    { id: 'group-chatbot', title: '업무용 챗봇', items: [
      { key: 'manneung', title: '만능서무 챗봇 바로가기', where: '만능서무 챗봇 소개 페이지 상단·하단 버튼' },
      { key: 'worksai', title: '웍스AI 바로가기', where: '공식 챗봇 소개 상단·하단 버튼, 팀 챗봇 소개 상단 버튼' }
    ]},
    { id: 'group-automation', title: '업무자동화 · 자세히 보기', items: [
      { key: 'excel', title: '엑셀 파일 수합', where: '메인 › 업무자동화 › 엑셀 파일 수합 카드' },
      { key: 'hwp', title: '한글 파일 수합', where: '메인 › 업무자동화 › 한글 파일 수합 카드' },
      { key: 'odf', title: '개방형 문서 변환', where: '메인 › 업무자동화 › 개방형 문서 변환 카드' },
      { key: 'overtime', title: '공무직 초과근무수당 산정', where: '메인 › 업무자동화 › 공무직 초과근무수당 산정 카드' }
    ]},
    { id: 'group-board', title: '생성형 AI 서비스 게시판', items: [
      { key: 'board', title: '게시판 전체 보기', where: '메인 › 생성형 AI 서비스 게시판 › 게시판 전체 보기 버튼' }
    ]}
  ];

  function readJSON(r) {
    return r.text().then(function (t) {
      var d;
      try { d = JSON.parse(t); } catch (e) { d = { error: '서버 오류가 발생했습니다 (코드 ' + r.status + '). Vercel의 Logs에서 원인을 확인해 주세요.' }; }
      return { ok: r.ok, status: r.status, data: d };
    });
  }

  var $ = function (id) { return document.getElementById(id); };

  function show(view) {
    $('loading').hidden = true;
    $('login-view').hidden = view !== 'login';
    $('admin-view').hidden = view !== 'admin';
    $('logout').hidden = view !== 'admin';
    if (view === 'login') $('admin-pw').focus();
  }

  function formatSize(n) {
    return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // 현재 연결 상태 표시 (file 이 있으면 업로드한 HTML로 연결된 상태)
  function setStatus(card, url, file) {
    var st = card.querySelector('.status');
    var label = card.querySelector('.current-label');
    var cur = card.querySelector('.current-val');
    cur.textContent = '';
    card.querySelector('.mode-note').hidden = !file;
    if (url) {
      st.textContent = file ? '연결됨 · HTML' : '연결됨'; st.className = 'status on';
      cur.classList.remove('muted');
      var a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      if (file) {
        label.textContent = '업로드한 파일';
        a.textContent = file.name;
        cur.appendChild(a);
        var meta = document.createElement('span');
        meta.className = 'muted';
        meta.textContent = ' (' + formatSize(file.size) + ' · ' + formatDate(file.uploadedAt) + ' 업로드)';
        cur.appendChild(meta);
      } else {
        label.textContent = '현재 연결된 주소';
        a.textContent = url;
        cur.appendChild(a);
      }
    } else {
      st.textContent = '미등록'; st.className = 'status off';
      label.textContent = '현재 연결된 주소';
      cur.textContent = '아직 등록된 주소가 없습니다.';
      cur.classList.add('muted');
    }
  }

  function setMode(card, mode) {
    card.querySelector('.link-form').hidden = mode !== 'link';
    card.querySelector('.upload-form').hidden = mode !== 'upload';
    card.querySelectorAll('.mode-switch input').forEach(function (r) { r.checked = r.value === mode; });
  }

  function buildList(links, files) {
    var root = $('groups');
    root.textContent = '';
    var tpl = $('item-tpl');
    GROUPS.forEach(function (g) {
      var h = document.createElement('h2');
      h.className = 'group-title'; h.id = g.id; h.textContent = g.title;
      root.appendChild(h);
      g.items.forEach(function (it) {
        var card = tpl.content.firstElementChild.cloneNode(true);
        var file = files[it.key] || null;
        var inputId = 'url-' + it.key;
        var fileId = 'file-' + it.key;
        card.querySelector('.item-title').textContent = it.title;
        card.querySelector('.item-where').textContent = '표시 위치: ' + it.where;

        // ── 연결 방식 선택 ──
        card.querySelectorAll('.mode-switch input').forEach(function (r) {
          r.name = 'mode-' + it.key;
          r.addEventListener('change', function () { setMode(card, r.value); });
        });
        setMode(card, file ? 'upload' : 'link');
        setStatus(card, links[it.key] || '', file);

        // ── 링크 주소 입력 ──
        var form = card.querySelector('.link-form');
        form.querySelector('.item-label').setAttribute('for', inputId);
        var input = form.querySelector('.item-input');
        input.id = inputId;
        input.value = file ? '' : (links[it.key] || '');
        var msg = form.querySelector('.item-msg');
        var btn = form.querySelector('button');
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = input.value.trim();
          msg.className = 'item-msg';
          if (v && !/^https?:\/\/\S+$/i.test(v)) {
            msg.textContent = 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.';
            msg.classList.add('msg-error');
            return;
          }
          btn.disabled = true; btn.textContent = '저장 중…';
          fetch('/api/links', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: it.key, url: v })
          }).then(function (r) {
            return readJSON(r);
          }).then(function (res) {
            if (res.status === 401) { show('login'); return; }
            if (!res.ok) throw new Error(res.data.error || '저장하지 못했습니다.');
            setStatus(card, res.data.url, null);
            msg.textContent = res.data.url ? '저장되었습니다. 홈페이지 버튼이 새 주소로 연결됩니다.' : '연결을 해제했습니다.';
            msg.classList.add('msg-ok');
          }).catch(function (err) {
            msg.textContent = err.message || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            msg.classList.add('msg-error');
          }).then(function () {
            btn.disabled = false; btn.textContent = '저장';
          });
        });

        // ── HTML 파일 업로드 ──
        var up = card.querySelector('.upload-form');
        up.querySelector('.item-label').setAttribute('for', fileId);
        var fileInput = up.querySelector('.item-file');
        fileInput.id = fileId;
        var upMsg = up.querySelector('.item-msg');
        var upBtn = up.querySelector('button');
        up.addEventListener('submit', function (e) {
          e.preventDefault();
          var f = fileInput.files && fileInput.files[0];
          upMsg.className = 'item-msg';
          function fail(t) { upMsg.textContent = t; upMsg.classList.add('msg-error'); }
          if (!f) return fail('올릴 HTML 파일을 선택해 주세요.');
          if (!/\.html?$/i.test(f.name)) return fail('.html 파일만 올릴 수 있습니다.');
          if (f.size > 4 * 1024 * 1024) return fail('파일이 너무 큽니다. 4MB 이하 파일만 올릴 수 있습니다.');
          upBtn.disabled = true; upBtn.textContent = '업로드 중…';
          fetch('/api/upload?key=' + encodeURIComponent(it.key) + '&name=' + encodeURIComponent(f.name), {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: f
          }).then(function (r) {
            return readJSON(r);
          }).then(function (res) {
            if (res.status === 401) { show('login'); return; }
            if (res.status === 413) throw new Error('파일이 너무 큽니다. 4MB 이하 파일만 올릴 수 있습니다.');
            if (!res.ok) throw new Error(res.data.error || '업로드하지 못했습니다.');
            setStatus(card, res.data.url, res.data.file);
            input.value = '';
            fileInput.value = '';
            upMsg.textContent = '업로드했습니다. 홈페이지 버튼을 누르면 이 파일이 열립니다.';
            upMsg.classList.add('msg-ok');
          }).catch(function (err) {
            fail(err.message || '업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.');
          }).then(function () {
            upBtn.disabled = false; upBtn.textContent = '업로드';
          });
        });

        root.appendChild(card);
      });
    });
  }

  var FOOTER_DEFAULTS = {
    footer_title: '제주시 업무자동화',
    footer_dept: '제주시청 디지털혁신과 디지털운영팀',
    footer_contact: '',
    footer_notice: ''
  };

  function fillFooter(texts) {
    var form = $('footer-form');
    Object.keys(FOOTER_DEFAULTS).forEach(function (k) {
      var has = Object.prototype.hasOwnProperty.call(texts, k);
      form.elements[k].value = has ? texts[k] : FOOTER_DEFAULTS[k];
    });
  }

  function loadFooter() {
    fetch('/api/texts', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) { fillFooter((d && d.texts) || {}); });
  }

  $('footer-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var msg = $('footer-msg');
    var btn = form.querySelector('button[type=submit]');
    var texts = {};
    Object.keys(FOOTER_DEFAULTS).forEach(function (k) { texts[k] = form.elements[k].value.trim(); });
    msg.className = 'item-msg'; msg.textContent = '';
    btn.disabled = true; btn.textContent = '저장 중…';
    fetch('/api/texts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: texts })
    }).then(function (r) {
      return readJSON(r);
    }).then(function (res) {
      if (res.status === 401) { show('login'); return; }
      if (!res.ok) throw new Error(res.data.error || '저장하지 못했습니다.');
      fillFooter(res.data.texts || {});
      msg.textContent = '저장되었습니다. 홈페이지 하단에 바로 반영됩니다.';
      msg.classList.add('msg-ok');
    }).catch(function (err) {
      msg.textContent = err.message || '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      msg.classList.add('msg-error');
    }).then(function () {
      btn.disabled = false; btn.textContent = '하단 문구 저장';
    });
  });

  function loadAdmin() {
    fetch('/api/links', { cache: 'no-store' })
      .then(function (r) { return readJSON(r); })
      .then(function (res) {
        var err = $('store-error');
        if (!res.ok) { err.textContent = res.data.error || '링크를 불러오지 못했습니다.'; err.hidden = false; }
        else err.hidden = true;
        buildList((res.data && res.data.links) || {}, (res.data && res.data.files) || {});
        loadFooter();
        show('admin');
      })
      .catch(function () {
        $('store-error').textContent = '링크를 불러오지 못했습니다.';
        $('store-error').hidden = false;
        buildList({}, {});
        loadFooter();
        show('admin');
      });
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('admin-pw');
    var err = $('login-error');
    var btn = e.target.querySelector('button[type=submit]');
    err.hidden = true;
    if (!pw.value) { err.textContent = '비밀번호를 입력해 주세요.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = '확인 중…';
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw.value })
    }).then(function (r) {
      return readJSON(r);
    }).then(function (res) {
      pw.value = '';
      if (res.ok) { loadAdmin(); return; }
      err.textContent = res.data.error || '로그인하지 못했습니다.';
      err.hidden = false;
      pw.focus();
    }).catch(function () {
      err.textContent = '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      err.hidden = false;
    }).then(function () {
      btn.disabled = false; btn.textContent = '로그인';
    });
  });

  $('logout').addEventListener('click', function () {
    fetch('/api/logout', { method: 'POST' }).then(function () { show('login'); });
  });

  fetch('/api/session', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d.loggedIn) loadAdmin(); else show('login'); })
    .catch(function () { show('login'); });
})();
