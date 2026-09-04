#!/usr/bin/env node
// 查重脚本：检测 questions.md 里完全重复的题目。
// 用法：node check.js [文件名]，默认检查 questions.md。
// 退出码：0 = 无重复，1 = 有重复。

const fs = require('fs');

const file = process.argv[2] || 'questions.md';

function parse(text) {
  const lines = text.split('\n');
  const out = [];
  let cur = null;
  let section = 'question';

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (/^###\s+/.test(line)) {
      cur = { question: '', answer: '', line: lineNo };
      out.push(cur);
      section = 'question';
      cur.question += line.replace(/^###\s+/, '') + '\n';
    } else if (/^\s*\*\*答案\*\*\s*[:：]?\s*(.*)$/.test(line)) {
      if (!cur) return;
      section = 'answer';
      const rest = line.replace(/^\s*\*\*答案\*\*\s*[:：]?\s*/, '');
      if (rest.trim()) cur.answer += rest + '\n';
    } else if (/^#+\s*答案\s*[:：]?\s*(.*)$/.test(line)) {
      if (!cur) return;
      section = 'answer';
      const rest = line.replace(/^#+\s*答案\s*[:：]?\s*/, '');
      if (rest.trim()) cur.answer += rest + '\n';
    } else if (cur) {
      cur[section] += line + '\n';
    }
  });

  return out.filter((e) => e.question.trim() || e.answer.trim());
}

// 归一化：小写 + 去掉空白 + 去掉标点，用于判断「完全一样」。
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[，。！？、：；“”‘’（）《》【】…—·,\.!\?;:()'"`~\-_]/g, '');
}

const text = fs.readFileSync(file, 'utf8');
const entries = parse(text);

const groups = new Map();
for (const e of entries) {
  const key = normalize(e.question);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(e);
}

const dups = [...groups.values()].filter((g) => g.length > 1);

if (dups.length === 0) {
  console.log('✅ 无重复：共 ' + entries.length + ' 题。');
  process.exit(0);
}

console.log('⚠️ 发现 ' + dups.length + ' 组重复题：\n');
dups.forEach((g, i) => {
  console.log('[' + (i + 1) + '] ' + g[0].question.trim());
  g.forEach((e) => {
    console.log('    第 ' + e.line + ' 行：' + e.question.trim().replace(/\n/g, ' '));
  });
  console.log('');
});
process.exit(1);
