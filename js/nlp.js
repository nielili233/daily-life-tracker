/**
 * NLP Batch Parser — 自然语言批量录入
 * 今日安排: parseSchedule(text) → [{time, title}]
 * 收支记录: parseFinance(text) → [{type, amount, category, note}]
 */
window.NLP = (function() {

  /* ── 收支关键词 ── */
  var INCOME_KW = ['工资', '薪水', '奖金', '报销', '退款', '红包', '利息', '分红', '稿费', '兼职', '中奖', '收到', '转入', '收入', '回款', '到账', '返现'];
  var CAT_KW = {
    '饮食':   ['早餐', '午餐', '晚餐', '早饭', '午饭', '晚饭', '吃饭', '外卖', '饭', '餐', '火锅', '烧烤', '奶茶', '饮料', '水果', '零食', '小吃', '快餐', '便当', '盒饭', '蛋糕', '面包'],
    '交通':   ['打车', '出租', '滴滴', '地铁', '公交', '高铁', '火车', '飞机', '机票', '油费', '加油', '停车', '过路费', '骑车', '共享单车', '顺风车'],
    '健康':   ['医院', '药', '看病', '挂号', '体检', '健身', '运动'],
    '护肤':   ['护肤', '面膜', '化妆品', '洗面奶', '防晒', '水乳', '精华'],
    '宠物':   ['猫粮', '狗粮', '猫砂', '宠物', '猫', '狗', '疫苗', '驱虫'],
    '娱乐':   ['电影', '游戏', 'KTV', '唱歌', '旅游', '门票', '演出', '剧本杀', '密室'],
    '社交':   ['聚餐', '请客', '礼物', '份子钱', '随礼', '人情'],
    '学习':   ['课程', '书', '教材', '学费', '培训', '考试', '报名'],
    '服饰':   ['衣服', '裤子', '鞋', '包', '帽子', '围巾', '袜子', '内衣'],
    '房租':   ['房租', '水电', '燃气', '物业', '宽带', '网费'],
    '工作':   ['办公', '打印', '文具', '快递'],
    '生活用品': ['纸巾', '洗衣液', '洗发水', '牙膏', '牙刷', '垃圾袋', '收纳', '清洁']
  };

  /* ── 通用工具 ── */
  function _detectCategory(text) {
    for (var cat in CAT_KW) {
      for (var i = 0; i < CAT_KW[cat].length; i++) {
        if (text.indexOf(CAT_KW[cat][i]) >= 0) return cat;
      }
    }
    return '其他';
  }

  function _isIncome(text) {
    for (var i = 0; i < INCOME_KW.length; i++) {
      if (text.indexOf(INCOME_KW[i]) >= 0) return true;
    }
    return false;
  }

  /* ══════════ 今日安排解析 ══════════ */
  var TIME_KW = {
    '凌晨': '凌晨', '早': '早上', '早上': '早上', '上午': '上午',
    '中午': '中午', '下午': '下午', '傍晚': '傍晚',
    '晚': '晚上', '晚上': '晚上', '夜里': '夜里', '睡前': '睡前'
  };

  function parseSchedule(text) {
    if (!text || !text.trim()) return [];
    var raw = text.replace(/[,，;；\n\r]+/g, '。').replace(/。+/g, '。').replace(/^[。]+|[。]+$/g, '');
    if (!raw) return [];
    var parts = raw.split('。');
    var results = [];

    parts.forEach(function(part) {
      part = part.trim();
      if (!part) return;

      // 检测时间段前缀
      var time = '';
      for (var kw in TIME_KW) {
        if (part.indexOf(kw) === 0) {
          time = TIME_KW[kw];
          part = part.slice(kw.length).trim();
          // 去掉"要"、"得"、"去"、"做"等连接词
          part = part.replace(/^[要得去做]/, '').trim();
          break;
        }
      }

      // 去掉句首的"还要"、"还得"、"需要"、"然后"、"再"等
      part = part.replace(/^(还要|还得|需要|然后|再去|再去|再|去|要|做)/, '').trim();

      if (part) {
        results.push({ time: time, title: part });
      }
    });

    return results;
  }

  /* ══════════ 收支记录解析 ══════════ */
  function parseFinance(text) {
    if (!text || !text.trim()) return [];
    var today = Store.today();
    var results = [];

    // 尝试用 金额模式 拆分
    // 匹配: "XX花了NN" 或 "XX NN元" 或 "XX ¥NN" 或 "XX $NN"
    var amountRe = /(.+?)(?:花了?|花掉|付了?|支付了?|收了?|收到|进账|转入)?\s*[¥￥$]?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)?(?=[，,。；;、\s]|$)/g;
    var match;
    var lastIdx = 0;

    while ((match = amountRe.exec(text)) !== null) {
      var desc = match[1].trim();
      var amount = parseFloat(match[2]);

      // 清理描述开头的连接词
      desc = desc.replace(/^[，,。；;、\s]+/, '').trim();
      desc = desc.replace(/^(还有|另外|以及|然后|接着|又|还|也|又)/, '').trim();

      if (desc && amount > 0) {
        var isInc = _isIncome(desc);
        results.push({
          type: isInc ? 'income' : 'expense',
          amount: amount,
          category: isInc ? '其他' : _detectCategory(desc),
          date: today,
          paymentMethod: '支付宝',
          note: desc
        });
      }
      lastIdx = amountRe.lastIndex;
    }

    // 如果正则没匹配到任何东西，尝试按逗号/句号拆分，每段提取金额
    if (results.length === 0) {
      var segments = text.replace(/[,，;；\n\r]+/g, '。').replace(/。+/g, '。').replace(/^[。]+|[。]+$/g, '').split('。');
      segments.forEach(function(seg) {
        seg = seg.trim();
        if (!seg) return;
        var m = seg.match(/[¥￥$]?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块|块钱)?/);
        if (m) {
          var desc = seg.replace(/[¥￥$]?\s*\d+(?:\.\d{1,2})?\s*(?:元|块|块钱)?/, '').trim();
          desc = desc.replace(/^[，,。；;、\s]+|[，,。；;、\s]+$/g, '');
          if (desc) {
            var isInc = _isIncome(desc);
            results.push({
              type: isInc ? 'income' : 'expense',
              amount: parseFloat(m[1]),
              category: isInc ? '其他' : _detectCategory(desc),
              date: today,
              paymentMethod: '支付宝',
              note: desc
            });
          }
        }
      });
    }

    return results;
  }

  return { parseSchedule: parseSchedule, parseFinance: parseFinance };
})();
