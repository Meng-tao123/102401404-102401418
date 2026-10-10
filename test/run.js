#!/usr/bin/env node
/* ============================================================
 * run.js —— 命令行运行单元测试
 * 用法：node test/run.js      （不需要安装任何依赖）
 * ============================================================ */
'use strict';

var TestKit = require('./framework.js');

require('./tests.js');          // 注册所有用例

var summary = TestKit.run();

console.log('');
console.log('校园失物招领 · 单元测试');
console.log('----------------------------------------');

var lastSuite = null;
summary.results.forEach(function (r) {
  if (r.suite !== lastSuite) {
    console.log('\n' + r.suite);
    lastSuite = r.suite;
  }
  console.log('  ' + (r.ok ? '\u2714' : '\u2718') + ' ' + r.name);
  if (!r.ok) console.log('      → ' + r.error);
});

console.log('\n----------------------------------------');
console.log('共 ' + summary.total + ' 个用例：通过 ' + summary.passed + ' 个，失败 ' + summary.failed + ' 个');

process.exit(summary.failed > 0 ? 1 : 0);
