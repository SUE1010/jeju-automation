// 같은 사이트 안의 도구 화면 높이에 맞춰 iframe 높이를 자동으로 조절합니다.
(function () {
  var frame = document.getElementById('tool-frame');
  if (!frame) return;
  function fit() {
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.body) return;
      var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      if (h > 0) frame.style.height = (h + 24) + 'px';
    } catch (e) { /* 다른 사이트 주소면 자동 조절하지 않습니다 */ }
  }
  frame.addEventListener('load', function () {
    fit();
    try {
      var RO = frame.contentWindow.ResizeObserver;
      if (RO) new RO(fit).observe(frame.contentDocument.body);
    } catch (e) {}
    setInterval(fit, 1500);
  });
})();
