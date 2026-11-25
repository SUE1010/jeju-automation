/* 제주시청 챗봇 개선 교육 · 브라우저 문서 변환기
   HWPX / DOCX / PDF / XLSX·XLS·CSV / TXT·MD → AI가 잘 읽는 마크다운(.md)
   모든 처리는 이 브라우저 안에서만 실행되며, 파일은 어떤 서버로도 전송되지 않습니다. */
(function () {
  'use strict';

  const VERSION = '1.3 (2026-11-19)';

  // ───────────────────────────── 공통 유틸
  const esc = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();
  const clean = s => String(s == null ? '' : s).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  const baseName = n => n.replace(/\.[^.]+$/, '');
  const extOf = n => (n.match(/\.([^.]+)$/) || ['', ''])[1].toLowerCase();
  const documentName = filename => baseName(filename).replace(/\s*-\s*복사본$/, '').trim() || '문서';

  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    // BOM
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    try {
      const t = new TextDecoder('utf-8', { fatal: true }).decode(u8);
      return t;
    } catch (e) {
      try { return new TextDecoder('euc-kr').decode(u8); } catch (e2) { return new TextDecoder('utf-8').decode(u8); }
    }
  }

  // 표 → 마크다운(병합 셀 없으면 파이프 표, 있으면 HTML 표)
  function tableToMd(rows, opts) {
    // rows: [[{text, colSpan, rowSpan}]]
    if (!rows.length) return '';
    const merged = rows.some(r => r.some(c => (c.colSpan || 1) > 1 || (c.rowSpan || 1) > 1 || /<table|\n\|/.test(c.text || '')));
    const width = Math.max(...rows.map(r => r.reduce((a, c) => a + (c.colSpan || 1), 0)));
    if (!merged && (opts && opts.forceHtml) !== true) {
      const lines = [];
      rows.forEach((r, i) => {
        const cells = r.map(c => esc(c.text).replace(/\n/g, '<br>') || ' ');
        while (cells.length < width) cells.push(' ');
        lines.push('| ' + cells.join(' | ') + ' |');
        if (i === 0) lines.push('|' + ' --- |'.repeat(width));
      });
      return lines.join('\n');
    }
    // HTML 표 (병합 셀 보존)
    const h = ['<table>'];
    rows.forEach((r, i) => {
      h.push('<tr>' + r.map(c => {
        const tag = i === 0 ? 'th' : 'td';
        const a = [];
        if ((c.colSpan || 1) > 1) a.push(` colspan="${c.colSpan}"`);
        if ((c.rowSpan || 1) > 1) a.push(` rowspan="${c.rowSpan}"`);
        const t = String(c.text || '');
        // 셀 안에 중첩 표(HTML)가 있으면 그대로 두고, 나머지 텍스트만 이스케이프
        const body = /<table>/.test(t)
          ? t.split(/(<table>[\s\S]*?<\/table>)/g).map(seg => /^<table>/.test(seg) ? seg.replace(/\n/g, '') : seg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')).join('')
          : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        return `<${tag}${a.join('')}>${body}</${tag}>`;
      }).join('') + '</tr>');
    });
    h.push('</table>');
    return h.join('\n');
  }

  // ───────────────────────────── HWPX
  async function parseHwpx(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xD0 && u8[1] === 0xCF) throw new Error('파일 이름만 바뀌고 내용은 예전 형식입니다. 한글에서 문서를 열고 [파일 → 다른 이름으로 저장 → 파일 형식: HWPX]로 저장해 다시 넣으세요.');
    let zip; try { zip = await JSZip.loadAsync(buf); } catch (e) { throw new Error('HWPX 파일을 열 수 없습니다(손상되었거나 HWPX 형식이 아님). 한글에서 HWPX로 다시 저장해 보세요.'); }
    const names = Object.keys(zip.files).filter(n => /^Contents\/section\d+\.xml$/i.test(n))
      .sort((a, b) => parseInt(a.match(/(\d+)/)[1]) - parseInt(b.match(/(\d+)/)[1]));
    if (!names.length) throw new Error('문서의 본문을 읽지 못했습니다. 한글에서 문서가 정상으로 열리는지 확인하고 HWPX로 다시 저장해 넣으세요.');
    const out = [];
    for (const n of names) {
      const xml = await zip.file(n).async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('문서 일부를 읽지 못했습니다. 한글에서 HWPX로 다시 저장해 넣으세요. 문제가 계속되면 담당자에게 이 내용을 알려 주세요 (' + n + ')');
      const root = doc.documentElement;
      for (const child of root.childNodes) {
        if (child.nodeType !== 1) continue;
        if (local(child) === 'p') out.push(hwpxPara(child));
      }
    }
    return out.filter(b => b !== null).map(b => b.md).join('\n\n');
  }
  const local = el => el.localName || el.nodeName.split(':').pop();

  function hwpxPara(p, nested) {
    // 문단 안의 run들을 순서대로: 텍스트, 표, 줄바꿈
    const parts = [];
    let text = '';
    const flush = () => { if (text.trim()) parts.push({ t: 'text', v: text.trim() }); text = ''; };
    const walk = el => {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) continue;
        const ln = local(c);
        if (ln === 't') { text += c.textContent; continue; }
        if (ln === 'lineBreak') { text += '\n'; continue; }
        if (ln === 'tab') { text += ' '; continue; }
        if (ln === 'tbl') { flush(); parts.push({ t: 'table', v: hwpxTable(c, nested) }); continue; }
        if (ln === 'secPr' || ln === 'ctrl' || ln === 'linesegarray' || ln === 'pic' || ln === 'container' || ln === 'header' || ln === 'footer' || ln === 'footNote' || ln === 'endNote') {
          if (ln === 'footNote' || ln === 'endNote') { text += ' (각주: ' + clean(c.textContent) + ')'; }
          continue;
        }
        walk(c);
      }
    };
    walk(p);
    flush();
    if (!parts.length) return null;
    return { md: parts.map(x => x.t === 'table' ? x.v : x.v).join('\n\n') };
  }

  function hwpxTable(tbl, nested) {
    const rows = [];
    for (const tr of tbl.childNodes) {
      if (tr.nodeType !== 1 || local(tr) !== 'tr') continue;
      const row = [];
      for (const tc of tr.childNodes) {
        if (tc.nodeType !== 1 || local(tc) !== 'tc') continue;
        let colSpan = 1, rowSpan = 1;
        const paras = [];
        for (const c of tc.childNodes) {
          if (c.nodeType !== 1) continue;
          if (local(c) === 'cellSpan') { colSpan = +c.getAttribute('colSpan') || 1; rowSpan = +c.getAttribute('rowSpan') || 1; }
          if (local(c) === 'subList') {
            for (const p of c.childNodes) {
              if (p.nodeType === 1 && local(p) === 'p') { const r = hwpxPara(p, true); if (r) paras.push(r.md); }
            }
          }
        }
        row.push({ text: paras.join('\n'), colSpan, rowSpan });
      }
      rows.push(row);
    }
    return tableToMd(rows, { forceHtml: !!nested });
  }

  // ───────────────────────────── DOCX (mammoth → HTML → MD)
  async function parseDocx(buf) {
    const r = await mammoth.convertToHtml({ arrayBuffer: buf }, { styleMap: ['p[style-name="Title"] => h1:fresh'] });
    return htmlToMd(r.value);
  }

  function htmlToMd(html) {
    const doc = new DOMParser().parseFromString('<div id="root">' + html + '</div>', 'text/html');
    const root = doc.getElementById('root');
    const blocks = [];
    const inline = el => {
      let s = '';
      for (const c of el.childNodes) {
        if (c.nodeType === 3) s += c.textContent;
        else {
          const t = c.tagName.toLowerCase();
          if (t === 'br') s += '\n';
          else if (t === 'strong' || t === 'b') s += '**' + inline(c) + '**';
          else if (t === 'em' || t === 'i') s += '*' + inline(c) + '*';
          else if (t === 'img') s += '';
          else s += inline(c);
        }
      }
      return s;
    };
    const walk = (el, depth) => {
      for (const c of el.childNodes) {
        if (c.nodeType === 3) { if (c.textContent.trim()) blocks.push(c.textContent.trim()); continue; }
        const t = c.tagName.toLowerCase();
        if (/^h[1-6]$/.test(t)) blocks.push('#'.repeat(+t[1]) + ' ' + clean(inline(c)));
        else if (t === 'p') { const v = clean(inline(c)); if (v) blocks.push(v); }
        else if (t === 'ul' || t === 'ol') blocks.push(listToMd(c, 0));
        else if (t === 'table') blocks.push(tableToMd(htmlTableRows(c)));
        else walk(c, depth + 1);
      }
    };
    const listToMd = (list, depth) => {
      const lines = [];
      let i = 1;
      for (const li of list.children) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        let txt = '';
        const subs = [];
        for (const c of li.childNodes) {
          if (c.nodeType === 1 && (c.tagName.toLowerCase() === 'ul' || c.tagName.toLowerCase() === 'ol')) subs.push(listToMd(c, depth + 1));
          else txt += c.nodeType === 3 ? c.textContent : inline(c);
        }
        lines.push('  '.repeat(depth) + (list.tagName.toLowerCase() === 'ol' ? (i++) + '. ' : '- ') + clean(txt));
        lines.push(...subs);
      }
      return lines.join('\n');
    };
    walk(root, 0);
    return blocks.join('\n\n');
  }

  function htmlTableRows(table) {
    const rows = [];
    for (const tr of table.querySelectorAll('tr')) {
      if (tr.closest('table') !== table) continue;
      const row = [];
      for (const td of tr.children) {
        if (!/^t[dh]$/i.test(td.tagName)) continue;
        row.push({ text: clean(td.innerText || td.textContent), colSpan: +td.getAttribute('colspan') || 1, rowSpan: +td.getAttribute('rowspan') || 1 });
      }
      rows.push(row);
    }
    return rows;
  }

  // ───────────────────────────── PDF (pdf.js 텍스트 레이어)
  async function parsePdf(buf, onProgress, diagnostics) {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const out = [];
    diagnostics.push({level:'notice',page:null,message:'PDF의 표나 그림은 원래 모양과 다르게 변환될 수 있습니다. 숫자와 표의 칸, 표 아래 주의사항을 원래 문서와 비교하세요.'});
    try {
      for (let i=1;i<=pdf.numPages;i++) {
        const page=await pdf.getPage(i),tc=await page.getTextContent();
        const items=tc.items.filter(it=>typeof it.str==='string'&&it.str.trim());
        let imageCount=0;
        try {const op=await page.getOperatorList();const imageOps=['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat'];const ids=imageOps.map(k=>pdfjsLib.OPS[k]).filter(v=>v!==undefined);imageCount=op.fnArray.filter(x=>ids.includes(x)).length;}
        catch(e){diagnostics.push({level:'warning',page:i,message:'이미지 포함 여부를 확인하지 못했습니다. 원본 페이지를 확인하세요.'});}
        out.push('## 원본 PDF '+i+'쪽');
        if(!items.length){
          diagnostics.push({level:'unreadable',page:i,message:'글자를 읽지 못했습니다. 원래 쪽이 빈 쪽인지, 사진이나 그림인지 확인하세요. 사진 속 글자는 이 도구에서 읽지 못하므로 한글·워드 원본 또는 문자 인식 처리한 PDF가 필요합니다.'});
          out.push('[변환 불가: 원본 PDF '+i+'쪽 — 추출 가능한 글자 없음. 원본 확인 또는 OCR 필요]');
          if(onProgress)onProgress(i,pdf.numPages);continue;
        }
        if(imageCount){diagnostics.push({level:'warning',page:i,message:'이미지 요소 '+imageCount+'개가 있습니다. 이미지 안의 표·숫자·문자 및 도해는 변환하지 않았습니다.'});out.push('[이미지 주의: 이 페이지의 이미지 내용은 변환되지 않음]');}
        if(items.reduce((n,it)=>n+it.str.trim().length,0)<30)diagnostics.push({level:'warning',page:i,message:'읽힌 글자가 적습니다. 원래 쪽에 사진으로 된 글이 있는지 확인하세요.'});
        const lines=[];
        for(const it of items){const y=it.transform[5],x=it.transform[4],h=it.height||10;let l=lines.find(l=>Math.abs(l.y-y)<=Math.max(2,h*.35));if(!l){l={y,items:[]};lines.push(l);}l.items.push({x,w:it.width,str:it.str,h});}
        lines.sort((a,b)=>b.y-a.y);
        const rows=lines.map(l=>{l.items.sort((a,b)=>a.x-b.x);let cells=[''],last=null;for(const it of l.items){if(last!==null){const gap=it.x-last;if(gap>Math.max(12,it.h*1.5))cells.push('');else if(gap>it.h*.15)cells[cells.length-1]+=' ';}cells[cells.length-1]+=it.str;last=it.x+it.w;}return cells.map(x=>x.trim());});
        for(let j=0;j<rows.length;){let k=j+1;while(k<rows.length&&rows[j].length>1&&rows[k].length===rows[j].length)k++;
          if(rows[j].length>1&&k-j>=2){out.push('[표 추정: 원본 PDF '+i+'쪽 — 열·병합·각주 확인 필요]');out.push(tableToMd(rows.slice(j,k).map(r=>r.map(text=>({text})))));j=k;}
          else{out.push(rows[j].join('  |  '));j++;}
        }
        // No repeated-line deletion, numeric-line deletion, or guessed sentence joining.
        if(onProgress)onProgress(i,pdf.numPages);
      }
    } finally { await pdf.destroy(); }
    return out.join('\n\n');
  }

  // ───────────────────────────── XLSX / XLS / CSV
  async function parseSheet(buf, name) {
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
    const parts = [];
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      let rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
      rows = rows.map(r => r.map(c => clean(c)));
      // 빈 행/빈 열 정리
      rows = rows.filter(r => r.some(c => c));
      if (!rows.length) continue;
      const w = Math.max(...rows.map(r => r.length));
      const used = [];
      for (let c = 0; c < w; c++) if (rows.some(r => r[c])) used.push(c);
      rows = rows.map(r => used.map(c => r[c] || ''));
      // 병합 셀: 위/왼쪽 값 채우기 (AI가 읽기 쉽게)
      const merges = ws['!merges'] || [];
      parts.push('## ' + (wb.SheetNames.length > 1 ? sn : baseName(name)));
      parts.push(tableToMd(rows.map(r => r.map(t => ({ text: t, colSpan: 1, rowSpan: 1 })))));
      if (merges.length) parts.push('> 참고: 원본 시트에 병합 셀 ' + merges.length + '개가 있어 빈 칸이 생길 수 있습니다. 필요하면 상위 셀 값을 채워 넣으세요.');
    }
    return parts.join('\n\n');
  }

  // ───────────────────────────── 구조화 (제목 위계·노이즈 제거·경로 삽입)
  const RE = {
    pyeon: /^제\s*\d+\s*편\s+\S/,
    jang: /^제\s*\d+\s*장\s+\S/,
    jeol: /^제\s*\d+\s*절\s+\S/,
    gwan: /^제\s*\d+\s*관\s+\S/,
    jo: /^제\s*\d+\s*조(?:의\s*\d+)?(?=\(|\s|$)/,
    roman: /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*[.、]\s*\S/,
    num: /^\d{1,2}\s*[.]\s+\S/,
    ga: /^[가-힣]\s*[.]\s+\S/,
    box: /^[□■◆◇○●▶▷]\s*/,
    hang: /^[①-⑳]/,
    buchik: /^부\s*칙/,
    noise: [/^법제처\s*\d*\s*국가법령정보센터$/, /^-\s*\d+\s*-$/, /^\d+\s*\/\s*\d+$/, /^page\s*\d+$/i, /^\d{1,4}$/]
  };
  function isStructStart(l) {
    return RE.pyeon.test(l) || RE.jang.test(l) || RE.jeol.test(l) || RE.jo.test(l) || RE.roman.test(l) || RE.num.test(l) || RE.ga.test(l) || RE.box.test(l) || RE.hang.test(l) || RE.buchik.test(l) || /^#{1,6}\s/.test(l) || /^[\[【]/.test(l) || /^[-*]\s/.test(l);
  }

  function structure(md, docName, opts) {
    const lines = md.split('\n');
    const out = [];
    const path = { pyeon: '', jang: '', jeol: '', gwan: '', jo: '', h2: '', h3: '' };
    const isLaw = lines.filter(l => RE.jo.test(l.trim())).length >= 5;
    let inTable = false;
    const pathLine = () => {
      const segs = [docName];
      if (isLaw) { for (const k of ['pyeon', 'jang', 'jeol', 'gwan', 'jo']) if (path[k]) segs.push(path[k]); }
      else { if (path.h2) segs.push(path.h2); if (path.h3) segs.push(path.h3); }
      return '[경로] ' + segs.join(' > ');
    };
    const shortTitle = l => l.length <= 60 && !/[.。]$/.test(l);
    for (let raw of lines) {
      let l = raw.replace(/\s+$/, '');
      const t = l.trim();
      if (t.startsWith('<table')) inTable = true;
      if (inTable) { out.push(l); if (t.endsWith('</table>')) inTable = false; continue; }
      if (t.startsWith('|')) { out.push(l); continue; }
      if (!t) { out.push(''); continue; }
      // 본문·숫자·반복 조건을 쪽번호나 머리말로 추정하여 삭제하지 않는다.
      let heading = null, level = 0;
      if (/^#{1,6}\s/.test(t)) { level = t.match(/^#+/)[0].length; heading = t.replace(/^#+\s*/, ''); }
      else if (isLaw) {
        if (RE.pyeon.test(t) && shortTitle(t)) { level = 2; heading = t; path.pyeon = t; path.jang = path.jeol = path.gwan = path.jo = ''; }
        else if (RE.jang.test(t) && shortTitle(t)) { level = 2; heading = t; path.jang = t; path.jeol = path.gwan = path.jo = ''; }
        else if (RE.jeol.test(t) && shortTitle(t)) { level = 3; heading = t; path.jeol = t; path.gwan = path.jo = ''; }
        else if (RE.gwan.test(t) && shortTitle(t)) { level = 3; heading = t; path.gwan = t; path.jo = ''; }
        else if (RE.jo.test(t)) {
          // '제3조(정의) ① …' 처럼 본문이 붙어 있으면 제목만 분리
          const m = t.match(/^(제\s*\d+\s*조(?:의\s*\d+)?(?:\s*\([^)]*\))?)\s*(.*)$/);
          if (m) { level = 4; heading = m[1].replace(/\s+/g, ' '); path.jo = heading; const rest = m[2]; out.push('#### ' + heading); if (opts.path) out.push(pathLine()); if (rest) out.push(rest); continue; }
        }
        else if (RE.buchik.test(t) && shortTitle(t)) { level = 2; heading = t; path.jang = t; path.jeol = path.gwan = path.jo = ''; }
      } else {
        if ((RE.roman.test(t) || RE.pyeon.test(t) || RE.jang.test(t)) && shortTitle(t)) { level = 2; heading = t; path.h2 = t; path.h3 = ''; }
        else if ((RE.num.test(t) || RE.jeol.test(t)) && shortTitle(t) && t.length <= 45) { level = 3; heading = t; path.h3 = t; }
        else if (RE.ga.test(t) && shortTitle(t) && t.length <= 40) { level = 4; heading = t; }
        else if (/^제\s*\d+\s*조(?:의\s*\d+)?\s*\([^)]{1,30}\)\s*$/.test(t)) { level = 4; heading = t; }
      }
      if (heading) {
        out.push('#'.repeat(level) + ' ' + heading.replace(/^#+\s*/, ''));
        if (opts.path && level <= 4) out.push(pathLine());
        continue;
      }
      if (RE.box.test(t)) { out.push('- ' + t.replace(RE.box, '')); continue; }
      out.push(t);
    }
    let body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const head = ['# ' + docName, '', '> 출처 파일: ' + (opts.sourceFile || docName) + ' · 변환일: ' + new Date().toLocaleDateString('sv-SE') + ' · 브라우저 변환기 v' + VERSION, '> 이 문서는 챗봇 지식 파일용으로 자동 변환되었습니다. 표·수치·예외 조항은 원본과 대조하세요.', ''];
    return head.join('\n') + '\n' + body + '\n';
  }

  // ───────────────────────────── 파일 하나 변환
  async function convertFile(file, opts, onProgress) {
    const ext = extOf(file.name);
    const docName = opts.documentName || documentName(file.name);
    const buf = await file.arrayBuffer();
    let md; const diagnostics=[];
    if (ext === 'hwpx') md = await parseHwpx(buf);
    else if (ext === 'docx') md = await parseDocx(buf);
    else if (ext === 'pdf') md = await parsePdf(buf, onProgress, diagnostics);
    else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'xlsm') md = await parseSheet(buf, file.name);
    else if (ext === 'txt' || ext === 'md' || ext === 'markdown') md = decodeText(buf);
    else if (ext === 'hwp') throw new Error('이 한글 파일은 바로 읽을 수 없습니다. 한글에서 문서를 열고 [파일 → 다른 이름으로 저장 → 파일 형식: HWPX]로 저장한 파일을 다시 넣으세요. 이름 끝의 .hwp만 바꾸면 안 됩니다.');
    else if (ext === 'doc') throw new Error('Word에서 문서를 열고 [파일 → 다른 이름으로 저장 → Word 문서(.docx)]로 저장한 파일을 다시 넣으세요.');
    else throw new Error('지원하지 않는 형식입니다: .' + ext);
    if(ext==='hwpx'||ext==='docx'){
      const z=await JSZip.loadAsync(buf);let count=0;
      if(ext==='docx')count=Object.keys(z.files).filter(n=>/^word\/media\//.test(n)&&!z.files[n].dir).length;
      else for(const n of Object.keys(z.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n)))count+=(await z.file(n).async('string')).match(/<(?:\w+:)?(?:pic|container|shape|ole)\b/g)?.length||0;
      if(count)diagnostics.push({level:'warning',page:null,message:'이미지·도형 요소가 '+count+'개 있습니다. 해당 요소의 내용·연결 관계는 변환되지 않을 수 있습니다.'});
    }
    if(['xlsx','xls','xlsm','csv'].includes(ext))diagnostics.push({level:'warning',page:null,message:'엑셀에서 여러 칸을 합친 표는 모양이 달라질 수 있습니다. 빈칸과 숫자가 맞는지 원래 엑셀 파일과 비교하세요.'});
    md = clean(md).replace(/\r/g, '');
    if (!md.replace(/[\s#|>-]/g, '')) throw new Error('문서에서 글자를 읽지 못했습니다. 원래 파일이 정상으로 열리는지 확인하세요. 사진·스캔 문서라면 한글·워드 원본을 요청하세요.');
    const warnings=diagnostics.map(d=>(d.page?'PDF '+d.page+'쪽: ':'')+d.message);
    const structured = structure(md, docName, { ...opts, sourceFile: file.name })+(warnings.length?'\n\n## 변환 주의사항\n\n'+warnings.map(x=>'- '+x).join('\n')+'\n':'');
    return { name: docName, md: structured, ext, diagnostics, warnings };
  }

  // ───────────────────────────── 다운로드 도우미
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  window.JejuConverter = { convertFile, documentName, structure, download, tableToMd, VERSION };
})();
