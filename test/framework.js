/* ============================================================
 * framework.js —— 极简单元测试框架（约 90 行）
 * 目标：不依赖任何第三方库，浏览器和 Node 里都能直接跑
 * 用法与 Mocha 保持一致：describe(分组) / it(用例) / assert(断言)
 * ============================================================ */
(function (root) {
  'use strict';

  var suites = [];
  var stack = [];

  function describe(name, fn) {
    var suite = { name: name, cases: [] };
    suites.push(suite);
    stack.push(suite);
    fn();
    stack.pop();
  }

  function it(name, fn) {
    if (!stack.length) throw new Error('it() 必须写在 describe() 里面');
    stack[stack.length - 1].cases.push({ name: name, fn: fn });
  }

  function fail(message) {
    throw new Error(message || '断言失败');
  }

  var assert = {
    ok: function (value, message) {
      if (!value) fail((message || '期望为真') + '，实际是 ' + JSON.stringify(value));
    },
    equal: function (actual, expected, message) {
      if (actual !== expected) {
        fail((message || '两个值不相等') + '：期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
      }
    },
    deepEqual: function (actual, expected, message) {
      var a = JSON.stringify(actual);
      var b = JSON.stringify(expected);
      if (a !== b) fail((message || '两个对象不相等') + '：期望 ' + b + '，实际 ' + a);
    },
    includes: function (list, item, message) {
      if (!list || list.indexOf(item) === -1) {
        fail((message || '列表中没有找到目标项') + '：' + JSON.stringify(item) + ' in ' + JSON.stringify(list));
      }
    },
    /** 断言 fn 会抛出异常，可传入期望的错误信息片段 */
    throws: function (fn, contains, message) {
      var thrown = null;
      try { fn(); } catch (e) { thrown = e; }
      if (!thrown) fail(message || '期望抛出异常，但函数正常返回了');
      if (contains && String(thrown.message).indexOf(contains) === -1) {
        fail((message || '异常信息不符合预期') + '：' + thrown.message);
      }
    }
  };

  /** 依次执行所有用例，返回汇总结果 */
  function run() {
    var results = [];
    var passed = 0;
    var failed = 0;

    suites.forEach(function (suite) {
      suite.cases.forEach(function (item) {
        var record = { suite: suite.name, name: item.name, ok: true, error: null };
        try {
          item.fn();
        } catch (e) {
          record.ok = false;
          record.error = e && e.message ? e.message : String(e);
        }
        if (record.ok) passed += 1; else failed += 1;
        results.push(record);
      });
    });

    return {
      total: passed + failed,
      passed: passed,
      failed: failed,
      results: results
    };
  }

  function clear() { suites = []; stack = []; }

  /** 浏览器：把结果渲染到指定容器 */
  function render(summary, el) {
    if (!el) return;
    var html = [];
    var lastSuite = null;
    summary.results.forEach(function (r) {
      if (r.suite !== lastSuite) {
        html.push('<h3>' + r.suite + '</h3>');
        lastSuite = r.suite;
      }
      html.push('<p class="' + (r.ok ? 'pass' : 'fail') + '">' +
        (r.ok ? '✔' : '✘') + ' ' + r.name +
        (r.ok ? '' : '<br><span>' + r.error + '</span>') + '</p>');
    });
    el.innerHTML =
      '<div class="summary ' + (summary.failed ? 'bad' : 'good') + '">' +
        '共 ' + summary.total + ' 个用例：通过 ' + summary.passed + ' 个，失败 ' + summary.failed + ' 个' +
      '</div>' + html.join('');
  }

  var api = { describe: describe, it: it, assert: assert, run: run, clear: clear, render: render };

  root.TestKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
