const searchInput = document.getElementById('search');
const resultsEl = document.getElementById('results');
const statsEl = document.getElementById('stats');
const typeButtons = Array.from(document.querySelectorAll('.type-btn'));

let entries = [];
let selectedType = '单选';

async function load() {
  try {
    const res = await fetch('questions.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    entries = parseEntries(await res.text());
    render();
  } catch (err) {
    resultsEl.innerHTML =
      '<p class="empty">加载题库失败（' + escapeHtml(err.message) + '）<br>' +
      '请用本地服务器打开：在目录下运行 <code>python3 -m http.server</code>，' +
      '然后访问 <code>localhost:8000</code>。</p>';
  }
}

function parseEntries(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  let section = 'question';

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      cur = { question: '', answer: '', type: '' };
      out.push(cur);
      section = 'question';
      cur.question += line.replace(/^###\s+/, '') + '\n';
    } else if (/^\s*\*\*题型\*\*\s*[:：]?\s*(单选|多选|判断)\s*$/.test(line)) {
      // 题型标记行：作为元数据存下来，不显示在题目里
      if (cur) cur.type = line.replace(/^\s*\*\*题型\*\*\s*[:：]?\s*/, '').trim();
    } else if (/^\s*\*\*答案\*\*\s*[:：]?\s*(.*)$/.test(line)) {
      if (!cur) continue;
      section = 'answer';
      const rest = line.replace(/^\s*\*\*答案\*\*\s*[:：]?\s*/, '');
      if (rest.trim()) cur.answer += rest + '\n';
    } else if (/^#+\s*答案\s*[:：]?\s*(.*)$/.test(line)) {
      if (!cur) continue;
      section = 'answer';
      const rest = line.replace(/^#+\s*答案\s*[:：]?\s*/, '');
      if (rest.trim()) cur.answer += rest + '\n';
    } else if (cur) {
      cur[section] += line + '\n';
    }
  }

  return out.filter((e) => e.question.trim() || e.answer.trim());
}

function rawKeywords() {
  return searchInput.value.trim().split(/\s+/).filter(Boolean);
}

function loweredKeywords() {
  return rawKeywords().map((k) => k.toLowerCase());
}

function matches(e, kw) {
  const hay = (e.question + '\n' + e.answer).toLowerCase();
  return kw.every((k) => hay.includes(k));
}

function render() {
  // 先按题型筛出题库
  const pool = entries.filter((e) => e.type === selectedType);

  resultsEl.innerHTML = '';

  if (!pool.length) {
    statsEl.textContent = '「' + selectedType + '」暂无题目';
    resultsEl.innerHTML = '<p class="empty">该题型题库还没有题目。</p>';
    return;
  }

  const kw = loweredKeywords();
  const matched = kw.length ? pool.filter((e) => matches(e, kw)) : pool;

  if (matched.length) {
    statsEl.textContent = '「' + selectedType + '」共 ' + matched.length + ' 题' +
      (kw.length ? '（关键词：' + rawKeywords().join('、') + '）' : '');
  } else {
    statsEl.textContent = kw.length ? '「' + selectedType + '」没有匹配的题目' : '题库为空';
  }

  if (!matched.length) {
    if (kw.length) resultsEl.innerHTML = '<p class="empty">没有找到包含这些关键词的题目。</p>';
    return;
  }

  const regex = kw.length ? buildRegex(kw) : null;
  for (const e of matched) {
    resultsEl.appendChild(buildCard(e, regex));
  }
}

function buildRegex(kw) {
  return new RegExp(kw.map(escapeRegex).join('|'), 'gi');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCard(e, regex) {
  const card = document.createElement('article');
  card.className = 'card';

  const q = document.createElement('div');
  q.className = 'question';
  q.innerHTML = renderQuestion(e.question.trim());
  card.appendChild(q);

  if (e.answer.trim()) {
    const a = document.createElement('div');
    a.className = 'answer';
    a.innerHTML = renderMarkdown(e.answer.trim());
    card.appendChild(a);
  }

  if (regex) highlightText(card, regex);
  return card;
}

function renderMarkdown(md) {
  if (window.marked && typeof marked.parse === 'function') {
    return marked.parse(md);
  }
  return '<p>' + escapeHtml(md) + '</p>';
}

function renderQuestion(md) {
  // 把 "A. xxx" 形式的选项行转成列表项，让每个选项单独占一行
  const asList = md.replace(/^([A-D][.、．]\s*)/gm, '- $1');
  return renderMarkdown(asList);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightText(root, regex) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    const p = walker.currentNode.parentNode;
    if (p && p.tagName && p.tagName.toLowerCase() !== 'mark') {
      nodes.push(walker.currentNode);
    }
  }

  for (const node of nodes) {
    const text = node.textContent;
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;

    regex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      const mark = document.createElement('mark');
      mark.textContent = m[0];
      frag.appendChild(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) regex.lastIndex++;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    node.parentNode.replaceChild(frag, node);
  }
}

function setType(type) {
  selectedType = type;
  typeButtons.forEach((btn) => {
    const isActive = btn.dataset.type === type;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}

function onTypeClick(e) {
  const type = e.currentTarget.dataset.type;
  if (type === selectedType) return; // 已选中，忽略
  setType(type);
  searchInput.value = ''; // 切换题型清空搜索框
  render();
}

typeButtons.forEach((btn) => btn.addEventListener('click', onTypeClick));

// 默认选中「单选」
setType('单选');

searchInput.addEventListener('input', render);
load();
