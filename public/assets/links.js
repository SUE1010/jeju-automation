// 관리자 페이지에서 저장한 바로가기 주소와 하단 문구를 불러와 화면에 반영합니다.
(function () {
  function getJSON(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }

  // ── 하단(푸터) 문구 ──
  getJSON('/api/texts').then(function (data) {
    var texts = (data && data.texts) || {};
    document.querySelectorAll('[data-text]').forEach(function (el) {
      var key = el.getAttribute('data-text');
      if (Object.prototype.hasOwnProperty.call(texts, key)) {
        el.textContent = texts[key]; // 빈 값이면 CSS(:empty)로 숨겨집니다
      }
    });
  });

  // ── 바로가기 링크 ──
  var anchors = Array.prototype.slice.call(document.querySelectorAll('a[data-link]'));
  if (!anchors.length) return;

  function showToast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  anchors.forEach(function (a) {
    a.classList.add('is-pending');
    a.setAttribute('aria-disabled', 'true');
    a.removeAttribute('target');
    a.addEventListener('click', function (e) {
      if (a.classList.contains('is-pending')) {
        e.preventDefault();
        showToast('링크를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.');
      }
    });
  });

  getJSON('/api/links').then(function (data) {
    var links = (data && data.links) || {};
    anchors.forEach(function (a) {
      var url = links[a.getAttribute('data-link')];
      if (url && /^https?:\/\//i.test(url)) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.classList.remove('is-pending');
        a.removeAttribute('aria-disabled');
      }
    });
  });
})();
