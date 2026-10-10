/* ============================================================
 * tests.js —— 单元测试用例
 * 覆盖：表单校验 / 信息构造 / 搜索筛选 / 状态变更 / 统计 / 工具函数 / 仓库读写
 * 运行方式：浏览器打开 test/test.html，或命令行执行 node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var T = isNode ? require('./framework.js') : root.TestKit;
  var core = isNode ? require('../js/core.js') : root.LF;

  var describe = T.describe;
  var it = T.it;
  var assert = T.assert;

  var NOW = new Date('2026-09-30T10:00:00+08:00').getTime();

  /** 构造一份合法草稿，各用例只覆盖自己关心的字段 */
  function draft(overrides) {
    var base = {
      type: 'lost',
      title: '白色蓝牙耳机',
      category: 'earphone',
      place: '教学楼',
      date: '2026-09-28',
      desc: '充电盒背面贴了蓝色贴纸',
      contact: '微信 earphone_lost',
      photos: []
    };
    return Object.assign(base, overrides || {});
  }

  function errorsOf(d) {
    return core.validateDraft(d).errors.map(function (e) { return e.field; });
  }

  /* ================= 1. 表单校验 ================= */

  describe('1. 表单校验 validateDraft()', function () {
    it('完整草稿可以通过校验', function () {
      assert.equal(core.validateDraft(draft()).ok, true);
    });

    it('缺少物品名称时给出 title 错误', function () {
      assert.includes(errorsOf(draft({ title: '   ' })), 'title');
    });

    it('物品名称只有 1 个字也要拦下来', function () {
      assert.includes(errorsOf(draft({ title: '伞' })), 'title');
    });

    it('物品名称超过 30 字要拦下来', function () {
      assert.includes(errorsOf(draft({ title: new Array(32).join('伞') })), 'title');
    });

    it('类型不是 lost / found 时报错', function () {
      assert.includes(errorsOf(draft({ type: 'unknown' })), 'type');
    });

    it('类别不在可选范围时报错', function () {
      assert.includes(errorsOf(draft({ category: '飞船' })), 'category');
    });

    it('日期格式不是 YYYY-MM-DD 时报错', function () {
      assert.includes(errorsOf(draft({ date: '2026/09/28' })), 'date');
    });

    it('缺少联系方式时报错', function () {
      assert.includes(errorsOf(draft({ contact: '' })), 'contact');
    });

    it('照片超过 3 张时报错', function () {
      assert.includes(errorsOf(draft({ photos: ['a', 'b', 'c', 'd'] })), 'photos');
    });

    it('详细说明超过 200 字时报错', function () {
      assert.includes(errorsOf(draft({ desc: new Array(202).join('字') })), 'desc');
    });

    it('详细说明是选填的，留空依然可以发布', function () {
      assert.equal(core.validateDraft(draft({ desc: '' })).ok, true);
    });

    it('多个字段同时出错时，错误会被一次性全部返回', function () {
      var fields = errorsOf({ type: 'lost' });
      assert.equal(fields.length >= 4, true, '至少应报出 4 个字段的错误，实际 ' + fields.length);
    });
  });

  /* ================= 2. 构造信息 ================= */

  describe('2. 信息构造 createItem()', function () {
    it('校验通过后生成完整信息，状态默认是进行中', function () {
      var res = core.createItem(draft(), NOW);
      assert.equal(res.ok, true);
      assert.equal(res.item.status, 'active');
      assert.equal(res.item.type, 'lost');
      assert.equal(res.item.createdAt, NOW);
      assert.equal(typeof res.item.id, 'string');
    });

    it('校验不通过时不生成信息，并返回错误列表', function () {
      var res = core.createItem(draft({ title: '' }), NOW);
      assert.equal(res.ok, false);
      assert.equal(res.item, null);
      assert.equal(res.errors.length > 0, true);
    });

    it('物品名称和描述的首尾空格会被去掉', function () {
      var res = core.createItem(draft({ title: '  黑色雨伞  ', desc: '  放在伞架  ' }), NOW);
      assert.equal(res.item.title, '黑色雨伞');
      assert.equal(res.item.desc, '放在伞架');
    });
  });

  /* ================= 3. 搜索与筛选 ================= */

  describe('3. 搜索与筛选 searchItems()', function () {
    var items = [
      { id: 'a', type: 'lost', title: '白色蓝牙耳机', category: 'earphone', place: '教学楼', date: '2026-09-28', desc: '充电盒有蓝色贴纸', status: 'active', createdAt: 300 },
      { id: 'b', type: 'found', title: '校园卡（李思远）', category: 'card', place: '教学楼', date: '2026-09-27', desc: '已交到值班室', status: 'active', createdAt: 200 },
      { id: 'c', type: 'found', title: '黑色长柄雨伞', category: 'umbrella', place: '图书馆', date: '2026-09-26', desc: '伞柄缠了灰色手绳', status: 'done', createdAt: 100 }
    ];

    it('关键词命中物品名称', function () {
      assert.equal(core.searchItems(items, { keyword: '耳机' }).length, 1);
    });

    it('关键词命中描述文字', function () {
      var list = core.searchItems(items, { keyword: '贴纸' });
      assert.equal(list.length, 1);
      assert.equal(list[0].id, 'a');
    });

    it('关键词命中地点', function () {
      assert.equal(core.searchItems(items, { keyword: '图书馆' }).length, 1);
    });

    it('关键词会忽略输入的空格', function () {
      assert.equal(core.searchItems(items, { keyword: '校园 卡' }).length, 1);
    });

    it('搜不到时返回空数组，而不是 null', function () {
      var list = core.searchItems(items, { keyword: '蓝色充电宝' });
      assert.equal(Array.isArray(list), true);
      assert.equal(list.length, 0);
    });

    it('关键词为空时返回全部信息', function () {
      assert.equal(core.searchItems(items, { keyword: '' }).length, 3);
    });

    it('按类型筛选：只要招领', function () {
      assert.equal(core.searchItems(items, { type: 'found' }).length, 2);
    });

    it('按类别筛选：只要校园卡', function () {
      assert.equal(core.searchItems(items, { category: 'card' }).length, 1);
    });

    it('按状态筛选：只要已完成', function () {
      assert.equal(core.searchItems(items, { status: 'done' }).length, 1);
    });

    it('组合筛选：关键词 + 类型 + 状态', function () {
      var list = core.searchItems(items, { keyword: '校园卡', type: 'found', status: 'active' });
      assert.equal(list.length, 1);
      assert.equal(list[0].id, 'b');
    });

    it('默认按发布时间倒序排列', function () {
      var ids = core.searchItems(items, {}).map(function (i) { return i.id; });
      assert.deepEqual(ids, ['a', 'b', 'c']);
    });

    it('sort=old 时按发布时间正序排列', function () {
      var ids = core.searchItems(items, { sort: 'old' }).map(function (i) { return i.id; });
      assert.deepEqual(ids, ['c', 'b', 'a']);
    });
  });

  /* ================= 4. 状态变更 ================= */

  describe('4. 状态变更 setItemStatus()', function () {
    var items = [
      { id: 'a', type: 'lost', status: 'active', createdAt: 1, updatedAt: 1 },
      { id: 'b', type: 'found', status: 'active', createdAt: 2, updatedAt: 2 }
    ];

    it('把信息标记为已完成后，状态变为 done', function () {
      var res = core.setItemStatus(items, 'a', 'done', NOW);
      assert.equal(res.ok, true);
      assert.equal(res.items[0].status, 'done');
      assert.equal(res.items[0].updatedAt, NOW);
    });

    it('标记不存在的 id 时返回 ok=false，数据不变', function () {
      var res = core.setItemStatus(items, 'zzz', 'done', NOW);
      assert.equal(res.ok, false);
      assert.equal(res.items.length, 2);
    });

    it('传入非法状态时直接抛异常', function () {
      assert.throws(function () { core.setItemStatus(items, 'a', '完成啦'); }, '非法状态');
    });

    it('是纯函数：不会修改传进来的原数组', function () {
      core.setItemStatus(items, 'a', 'done', NOW);
      assert.equal(items[0].status, 'active');
    });

    it('标记为已完成后再按「进行中」筛选，该信息不再出现', function () {
      var after = core.setItemStatus(items, 'a', 'done', NOW).items;
      var active = core.searchItems(after, { status: 'active' });
      assert.equal(active.length, 1);
      assert.equal(active[0].id, 'b');
    });
  });

  /* ================= 5. 统计 ================= */

  describe('5. 统计 calcStats()', function () {
    it('分别统计总数、寻物数、招领数、进行中与已完成', function () {
      var s = core.calcStats([
        { type: 'lost', status: 'active' },
        { type: 'found', status: 'active' },
        { type: 'found', status: 'done' }
      ]);
      assert.deepEqual(s, { total: 3, lost: 1, found: 2, active: 2, done: 1 });
    });

    it('空列表返回全 0，不会报错', function () {
      assert.deepEqual(core.calcStats([]), { total: 0, lost: 0, found: 0, active: 0, done: 0 });
    });
  });

  /* ================= 6. 工具函数 ================= */

  describe('6. 工具函数', function () {
    it('timeAgo：1 分钟内显示「刚刚」', function () {
      assert.equal(core.timeAgo(NOW - 30 * 1000, NOW), '刚刚');
    });

    it('timeAgo：1 小时内显示分钟', function () {
      assert.equal(core.timeAgo(NOW - 5 * 60 * 1000, NOW), '5 分钟前');
    });

    it('isExpired：超过 30 天算过期', function () {
      var old = { createdAt: NOW - 31 * 24 * 60 * 60 * 1000 };
      var fresh = { createdAt: NOW - 1 * 24 * 60 * 60 * 1000 };
      assert.equal(core.isExpired(old, NOW), true);
      assert.equal(core.isExpired(fresh, NOW), false);
    });

    it('daysLeft：刚发布的还剩 30 天，过期后为 0', function () {
      assert.equal(core.daysLeft({ createdAt: NOW }, NOW), 30);
      assert.equal(core.daysLeft({ createdAt: NOW - 40 * 24 * 60 * 60 * 1000 }, NOW), 0);
    });

    it('highlight：命中关键词会包上 mark 标签', function () {
      var html = core.highlight('校园卡（李思远）', '校园卡');
      assert.equal(html.indexOf('<mark>校园卡</mark>') === 0, true);
    });

    it('highlight：HTML 特殊字符会被转义，避免 XSS', function () {
      var html = core.highlight('<img src=x onerror=alert(1)>', 'img');
      assert.equal(html.indexOf('<img') === -1, true);
      assert.equal(html.indexOf('&lt;') !== -1, true);
    });

    it('escapeHtml：转义 & < > " \'', function () {
      assert.equal(core.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    });

    it('suggestKeywords：搜不到时给出同义词建议', function () {
      var words = core.suggestKeywords('充电宝', [], 4);
      assert.includes(words, '移动电源');
    });

    it('suggestKeywords：已经能搜到结果时不再给建议', function () {
      var items = [{ id: 'a', type: 'lost', title: '充电宝', category: 'other', place: '教学楼', desc: '', status: 'active', createdAt: 1 }];
      assert.deepEqual(core.suggestKeywords('充电宝', items, 4), []);
    });
  });

  /* ================= 7. 仓库层 ================= */

  describe('7. 数据仓库 createRepo()', function () {
    var createRepo = isNode ? require('../js/repo.js').createRepo : root.LF.createRepo;

    function memoryRepo(seed) {
      return createRepo({ storage: null, seed: seed || [] });
    }

    it('新增一条信息后，总数加 1', function () {
      var repo = memoryRepo();
      var res = repo.add(draft(), NOW);
      assert.equal(res.ok, true);
      assert.equal(repo.size(), 1);
    });

    it('新增时会带上 ownerId，便于在「我的发布」里筛出来', function () {
      var repo = memoryRepo();
      var res = repo.add(draft({ ownerId: 'stu-001' }), NOW);
      assert.equal(res.item.ownerId, 'stu-001');
    });

    it('校验不通过时不会写入仓库', function () {
      var repo = memoryRepo();
      var res = repo.add(draft({ title: '' }), NOW);
      assert.equal(res.ok, false);
      assert.equal(repo.size(), 0);
    });

    it('标记完成后，find() 能读到最新状态', function () {
      var repo = memoryRepo();
      var id = repo.add(draft(), NOW).item.id;
      repo.setStatus(id, 'done', NOW + 1);
      assert.equal(repo.find(id).status, 'done');
    });

    it('删除后 find() 返回 null，总数减 1', function () {
      var repo = memoryRepo();
      var id = repo.add(draft(), NOW).item.id;
      assert.equal(repo.remove(id), true);
      assert.equal(repo.find(id), null);
      assert.equal(repo.size(), 0);
    });

    it('空仓库时拿到的列表是空数组，不是 undefined', function () {
      assert.deepEqual(memoryRepo().all(), []);
    });

    it('reset() 可以用指定数据整体替换', function () {
      var repo = memoryRepo([{ id: 'x' }]);
      repo.reset([{ id: 'y' }, { id: 'z' }]);
      assert.equal(repo.size(), 2);
      assert.equal(repo.find('y').id, 'y');
    });

    it('存储写满或不可用时，仍然能在内存里正常读写（降级不崩）', function () {
      var broken = {
        getItem: function () { throw new Error('storage disabled'); },
        setItem: function () { throw new Error('quota exceeded'); }
      };
      var repo = createRepo({ storage: broken, seed: [] });
      var res = repo.add(draft(), NOW);
      assert.equal(res.ok, true);
      assert.equal(repo.size(), 1);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
