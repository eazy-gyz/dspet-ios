/* ============================================================
 * DS桌宠 · 网页版 / 安卓悬浮窗版
 *
 *   - 106 个动作全部进随机池（扭蛋袋洗牌，不重复）
 *   - 物理：重力 1400 / 反弹 0.78 / 地面摩擦 2.5 / 甩动 1.0
 *   - 碎碎念气泡（纯文字，热梗池）
 *   - 设置：大小 / 动作频率 / 说话频率 / 贴边躲藏（安卓端）
 *   - 透明方案：WebGL 把亮度映射成 alpha
 *
 * 坐标单位：一律 CSS px。安卓端由 PetService 负责和物理像素换算。
 * ============================================================ */

(function () {
  'use strict';

  var NATIVE = (typeof window.AndroidPet !== 'undefined');

  // 诊断日志总开关（出问题时改成 true 再打包，日志会写到
  // /sdcard/Android/data/com.mengmeng.dshpet/files/pet.log）
  var DEBUG = false;

  var W = 462;
  var H = Math.round(462 * 9 / 16);
  var SCR_W = window.innerWidth;
  var SCR_H = window.innerHeight;

  var PHYSICS = {
    gravity: 1400,
    restitution: 0.78,
    groundFriction: 2.5,
    ceilingBounce: true,
    throwPower: 1.0,
  };

  // 角色在画幅里的实际占位（实测 640x360 帧：中间 1/3 宽、下方 80% 高）
  var CX0 = 0.333, CX1 = 0.667;
  var CY_TOP = 0.10, CY_BOT = 0.94;

  var BOUNDS = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  var SET = { actMul: 1, talkMul: 1, edgeHide: true, rate: 1 };

  // 交互后多久才允许「贴边躲起来」
  var EDGE_IDLE_MS = 20000;

  // ---------- 中文名 → 打包文件名（106 个）----------
  var NAME_MAP = {
    '被落叶淹没':'a001','被鼠标拖拽悬空反馈':'a002','被吓一跳':'a003','变鸽子':'a004',
    '插茱萸赏菊':'a005','拆礼物':'a006','超大伸懒腰':'a007','晨间刷牙':'a008',
    '吃Token':'a009','吃白饭':'a010','吃冰淇淋融化':'a011','吃大闸蟹':'a012',
    '吃饺子':'a013','吃腊八粥':'a014','吃年糕':'a015','吃青团':'a016',
    '吃汤圆':'a017','吃糖葫芦':'a018','吃晚餐':'a019','吃午餐':'a020',
    '吃西瓜':'a021','吃早餐':'a022','吃长寿面':'a023','吃重阳糕':'a024',
    '吃粽子':'a025','抽陀螺':'a026','穿针乞巧':'a027','吹笛子':'a028',
    '吹气球':'a029','打瞌睡被惊醒':'a030','大口吃零食':'a031','待机呼吸休闲':'a032',
    '荡秋千':'a033','点击回应-傲娇生气':'a034','点击回应-害羞惊讶':'a035',
    '点击回应-开心跃动':'a036','点击回应-挠痒咯咯笑':'a037','点击回应-元气挥手':'a038',
    '东张西望':'a039','动物环绕':'a040','堆雪人':'a041','放风筝':'a042',
    '放河灯':'a043','放孔明灯':'a044','放烟花':'a045','工作状态-垂头叹气冒汗':'a046',
    '工作状态-忙碌点按':'a047','工作状态-清点归档':'a048','工作状态-雀跃庆祝':'a049',
    '工作状态-思考冒泡':'a050','工作状态-原地踱步张望':'a051','哈欠连天':'a052',
    '蝴蝶蜜蜂环绕头顶开花':'a053','鲸鱼吐泡泡特效':'a054','可爱宅舞':'a055','蓝鲸现世':'a056',
    '撸猫':'a057','萌化小幽灵':'a058','女仆屈膝礼仪':'a059','螃蟹走路':'a060',
    '凭空生花':'a061','扑克魔术':'a062','骑木马':'a063','轻快记录':'a064',
    '轻快摇摆舞':'a065','三球抛接':'a066','深度思考碎碎念':'a067','是啊，吃什么':'a068',
    '收红包':'a069','涮火锅':'a070','碎碎念-擦桌碎碎念':'a071','碎碎念-对屏碎碎念':'a072',
    '碎碎念-发呆碎碎念':'a073','讨糖南瓜灯':'a074','踢毽子':'a075','偷吃零食被抓住':'a076',
    '玩水枪':'a077','玩游戏气急败坏':'a078','舞狮头':'a079','下五子棋':'a080',
    '小幅度原地360度旋转展示':'a081','小提琴演奏':'a082','写代码':'a083','写福字':'a084',
    '摇扇纳凉':'a085','用鲸鱼尾巴拍打地面':'a086','优雅女仆舞':'a087','悠闲哼歌':'a088',
    '余额-袋空如洗':'a089','余额-分文不剩':'a090','余额-金袋叮当':'a091',
    '余额-钱袋满溢':'a092','余额-钱袋如常':'a093','余额-数金皱眉':'a094',
    '原地蹲下玩玩具汽车':'a095','原地漂浮踏步':'a096','原地敲击桌面互动':'a097',
    '原地跳跃抓碎头顶物品':'a098','原地小憩沉眠':'a099','原地重力下蹲压缩':'a100',
    '原地专心玩魔方':'a101','原地左转奔跑':'a102','照镜子':'a103','整体换装试色':'a104',
    '中秋赏月吃月饼':'a105','装点圣诞树':'a106'
  };

  var ALL_NAMES = Object.keys(NAME_MAP);

  // 这几个是「特定状态专用」，剩下的全部进随机动作池
  var SPECIAL = [
    '待机呼吸休闲', '东张西望', '被鼠标拖拽悬空反馈',
    '点击回应-开心跃动', '点击回应-害羞惊讶', '点击回应-傲娇生气',
    '点击回应-挠痒咯咯笑', '点击回应-元气挥手',
    '螃蟹走路', '原地漂浮踏步', '原地左转奔跑',
  ];

  // ★ 106 个里除了 11 个状态专用，其余 95 个全部可随机播放
  var RANDOM_ACTIONS = ALL_NAMES.filter(function (n) {
    return SPECIAL.indexOf(n) < 0;
  });

  var ANIM = {
    idle: ['待机呼吸休闲'],
    turn: ['东张西望'],
    drag: ['被鼠标拖拽悬空反馈'],
    clicks: [
      '点击回应-开心跃动', '点击回应-害羞惊讶', '点击回应-傲娇生气',
      '点击回应-挠痒咯咯笑', '点击回应-元气挥手',
    ],
    moves: [
      { name: '螃蟹走路',     minDist: 60,  maxDist: 240 },
      { name: '原地漂浮踏步', minDist: 40,  maxDist: 120 },
      { name: '原地左转奔跑', minDist: 120, maxDist: 320 },
    ],
    actions: RANDOM_ACTIONS,
    noFlip: ['写代码','写福字','是啊，吃什么','深度思考碎碎念',
             '碎碎念-擦桌碎碎念','碎碎念-对屏碎碎念','碎碎念-发呆碎碎念'],
    whisper: ['碎碎念-擦桌碎碎念','碎碎念-对屏碎碎念','碎碎念-发呆碎碎念'],
  };

  // ---------- 扭蛋袋：洗牌后一个个取，保证 95 个都能轮到 ----------
  var actionBag = [];

  function nextAction() {
    if (actionBag.length === 0) {
      actionBag = ANIM.actions.slice();
      for (var i = actionBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = actionBag[i]; actionBag[i] = actionBag[j]; actionBag[j] = tmp;
      }
    }
    return actionBag.pop();
  }

  // ---------- 碎碎念文案池（热梗 + 撒娇）----------
  var WHISPERS = [
    '尊嘟假嘟？',
    '泰裤辣！',
    '蚌埠住了…',
    '纯纯的栓Q',
    '绝绝子！',
    '哥哥你是我的神！',
    '我emo了…',
    '哥哥是个小显眼包',
    '找搭子吗？我当你的桌搭子',
    '主打一个松弛感',
    '哥哥今天city不city呀',
    '我的偷感很重哦',
    '一身班味的哥哥回来啦',
    '确诊为一只小懒虫',
    '那咋了那咋了',
    '包的包的',
    '我勒个豆！',
    '破防了…',
    '哥哥CPU烧了吧',
    '我真的会谢',
    '这波上大分！',
    '遥遥领先～',
    '格局打开哥哥',
    '今天搞钱了吗',
    '摸鱼时间到！',
    '别卷了别卷了',
    '我要躺平了',
    '打工牛马辛苦了',
    '早八人早八魂',
    '脆皮梦梦需要抱抱',
    '我的精神状态良好（真的）',
    '建议严查哥哥的作息',
    '不明觉厉',
    '细思极恐…',
    '我的DNA动了！',
    '爷青回～',
    '一整个大无语',
    '夺笋啊',
    '哈基米哈基米',
    '在小小的花园里挖呀挖',
    '科目三跳起来',
    '因为他善',
    '拿捏了～',
    '奥利给！',
    '我麻了',
    '大冤种就是我',
    '小丑竟是我自己',
    '原地社死',
    '真香！',
    '退退退！',
    '小趴菜一枚',
    '硬控我三秒',
    '素质不详，遇强则强',
    '禁止蕉绿！',
    '去码头整点薯条吗',
    '浅浅地想你一下',
    '一整个爱住了',
    '救命，好可爱',
    '笑死，根本笑不死',
    '家人们谁懂啊',
    '无语子',
    '爱心光波 biu～',
    '给你整个大活',
    '六亲不认的步伐',
    '淡淡综合症发作中',
    '搞点抽象的',
    '你人还怪好嘞',
    '我直接一个好家伙',
    '啊对对对',
    '汗流浃背了吧哥哥',
    '急了急了',
    '你小子',
    '我劝你善良',
    '有被冒犯到',
    '大可不必',
    '我谢谢你啊',
    '离谱他妈给离谱开门',
    '眼睛学会了手没学会',
    '我不理解但我大受震撼',
    '精神状态遥遥领先',
    '摸鱼被抓包了',
    '已老实，求放过',
    '这个班是一天也上不下去了',
    '周一综合症晚期',
    '工资到账了吗哥哥',
    '余额不足，需要投喂',
    '卡里有钱，心里不慌',
    '人在工位，心在旷野',
    '想下班想疯了',
    '这个需求做不了（小声）',
    '需求又改了？',
    '这行代码我看不懂',
    '又报错了，不关我事',
    '编译过了！撒花',
    '我这就去改（并没有）',
    '已读，不回',
    '假装很忙中',
    '在思考人生',
    '发呆也是正经事',
    '今天也要开开心心的哦～',
    '哥哥在忙什么呢？',
    '人家在这儿陪着你呢',
    '唔…有点想吃东西了',
    '要不要休息一下呀？',
    '我刚刚打了个小盹',
    '哥哥记得多喝水呀',
    '我在这里看着你哦',
    '有点无聊…陪我玩会儿？',
    '刚才是不是又熬夜了？',
    '嘿嘿，被我发现了吧',
    '要加油哦，我看好你！',
    '偷偷看你一眼～',
    '我是不是变胖了…',
    '哼，都不理我',
    '有点困了…哈欠～',
    '哥哥最棒了！',
    '眼睛累了就看看我呀',
    '肩膀酸不酸，给你捶捶',
    '有我在呢，不怕',
    '头发要紧，早点睡嘛',
    '想吃火锅了…',
    '想喝奶茶，三分糖',
    '干饭人干饭魂',
    '我先睡为敬',
    '五分钟后叫我…',
    '伸个懒腰～',
    '今天也超级喜欢哥哥！',
  ];

  // ---------- DOM ----------
  var petEl   = document.getElementById('pet');
  var petBody = document.getElementById('petBody');
  var video   = document.getElementById('petVideo');
  var bubble  = document.getElementById('bubble');
  var bubbleText = document.getElementById('bubbleText');
  var dState = document.getElementById('dState');
  var dAnim  = document.getElementById('dAnim');
  var dFps   = document.getElementById('dFps');

  function toast(msg) {
    if (!NATIVE) return;
    try { window.AndroidPet.toast(String(msg)); } catch (e) {}
  }

  function jlog(msg) {
    if (!NATIVE) return;
    try { window.AndroidPet.log(String(msg)); } catch (e) {}
  }

  window.onerror = function (msg, src, line) {
    toast('JS错误: ' + msg + ' @' + line);
    return false;
  };

  // ============================================================
  // WebGL 去黑渲染器
  // ============================================================
  var canvas, gl, program, texture, glReady = false;

  function initGL() {
    canvas = document.createElement('canvas');
    canvas.className = 'pet-canvas';
    canvas.width = 640;
    canvas.height = 360;
    petBody.insertBefore(canvas, petBody.firstChild);

    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true })
      || canvas.getContext('experimental-webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) return false;

    var vs = [
      'attribute vec2 p;',
      'varying vec2 uv;',
      'void main(){',
      '  uv = vec2((p.x+1.0)*0.5, 1.0-(p.y+1.0)*0.5);',
      '  gl_Position = vec4(p, 0.0, 1.0);',
      '}'
    ].join('\n');

    var fs = [
      'precision mediump float;',
      'varying vec2 uv;',
      'uniform sampler2D tex;',
      'uniform float uMode;',            // 0 = 抠图   1 = 原生 alpha 直通
      'float mx(vec3 c){ return max(c.r, max(c.g, c.b)); }',
      'void main(){',
      '  vec4 t = texture2D(tex, uv);',
      // ---- 去绿边（两条渲染路径共用）----
      // 实测全部 106 个动作里「高饱和的真绿像素」= 0 个：她线稿和轮廓上
      // 那圈橄榄绿全是溢色。所以直接把 G 夹到 R/B 的最大值就能一次归零，
      // 而且不会误伤真实颜色（中性／暖色／冷色像素原样不动）。
      '  vec3 c = t.rgb;',
      '  c.g = min(c.g, max(c.r, c.b));',
      // ---- 原生 alpha 直通 ----
      // ★ 这里必须输出 t.rgb 本身、不能再乘 t.a ！
      //   原片是「纯黑底 + 无 alpha」渲染出来的，轮廓上那些半透明的像素
      //   其 RGB 已经是「和黑底混合过」的值，也就是已经预乘过了。
      //   再乘一次 alpha 会变成 alpha²，轮廓外圈就会糊上一条暗边
      //   —— 看起来就是「硬边 / 锯齿 / 脏描边」。
      //   canvas 是 premultipliedAlpha，直接给 rgb 就是正确合成。
      '  if (uMode > 0.5) {',
      '    gl_FragColor = vec4(c, t.a);',
      '    return;',
      '  }',
      // ---- WebGL 抠图（兜底）----
      // 9 点平均：视频压缩在角色边缘会留下块状，只取中心点的亮度会出锯齿
      '  vec2 p = vec2(1.0/640.0, 1.0/360.0);',
      '  float m = mx(texture2D(tex, uv + vec2(-p.x,-p.y)).rgb)',
      '          + mx(texture2D(tex, uv + vec2( 0.0,-p.y)).rgb)',
      '          + mx(texture2D(tex, uv + vec2( p.x,-p.y)).rgb)',
      '          + mx(texture2D(tex, uv + vec2(-p.x, 0.0)).rgb)',
      '          + mx(c)',
      '          + mx(texture2D(tex, uv + vec2( p.x, 0.0)).rgb)',
      '          + mx(texture2D(tex, uv + vec2(-p.x,  p.y)).rgb)',
      '          + mx(texture2D(tex, uv + vec2( 0.0,  p.y)).rgb)',
      '          + mx(texture2D(tex, uv + vec2( p.x,  p.y)).rgb);',
      '  m /= 9.0;',
      '  float a = smoothstep(0.03, 0.22, m);',
      '  gl_FragColor = vec4(c * a, a);',
      '}'
    ].join('\n');

    function mk(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    program = gl.createProgram();
    gl.attachShader(program, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    uModeLoc = gl.getUniformLocation(program, 'uMode');
    return true;
  }

  var uModeLoc = null;
  /** true = 用「原生 alpha 直通」着色器（不做抠图） */
  var usePassthrough = false;

  function drawGL() {
    if (!glReady || video.readyState < 2) return;
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      if (uModeLoc) gl.uniform1f(uModeLoc, usePassthrough ? 1.0 : 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch (e) {}
  }

  // 画布缓冲区跟随视频原始分辨率，避免无谓的高分辨率绘制
  function syncCanvasSize() {
    if (!canvas) return;
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    try { video.playbackRate = SET.rate; } catch (e) {}
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
      if (gl) gl.viewport(0, 0, vw, vh);
    }
  }

  // ---------- 状态 ----------
  var S = {
    mode: 'idle',
    x: 0, y: 0,
    vx: 0, vy: 0,
    facing: 1,
    current: '',
    moveTarget: null,
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    lastPointer: [],
    nextThink: 0,
    nextWhisper: 0,
    nextEdgeTry: 0,
    lastUserAt: 0,
    scale: 1,
    bubbleTimer: 0,
    spin: 0,          // ★ v1.1 摇一摇：当前滚动角度（度）
    spinV: 0,         //   角速度（度/秒）
  };

  var rand  = function (a, b) { return a + Math.random() * (b - a); };
  var pick  = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var now   = function () { return performance.now(); };

  // ★ iOS 适配：Safari / WKWebView 不支持带 alpha 通道的 VP9(WebM)。
  //   两种素材都能跑：
  //     .mov  HEVC-alpha（系统原生透明）—— 最佳，任意背景都能用
  //     .mp4  H.264 黑底 + CSS screen 混合去黑 —— 兜底，桌面底色要偏暗
  //   想对比效果可以用 ?ext=mov / ?ext=mp4 / ?ext=webm 强制指定。
  var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var FORCE_EXT = (location.search.match(/[?&]ext=(webm|mov|mp4)/) || [])[1];
  var EXT = FORCE_EXT ? '.' + FORCE_EXT : (IS_IOS ? '.mov' : '.webm');
  var BLACK_BG = (EXT !== '.mov');          // 黑底素材：靠 mix-blend-mode:screen 去黑
  if (BLACK_BG) {
    try { document.documentElement.classList.add('dark-desk'); } catch (e) {}
  }

  function assetUrl(name) {
    var file = NAME_MAP[name] || name;
    return (NATIVE ? '' : 'assets/') + file + EXT;
  }

  // ---------- 活动范围 ----------
  function readBounds() {
    if (NATIVE) {
      try {
        var p = String(window.AndroidPet.getBounds()).split(',');
        if (p.length === 4) {
          BOUNDS.minX = parseFloat(p[0]);
          BOUNDS.maxX = parseFloat(p[1]);
          BOUNDS.minY = parseFloat(p[2]);
          BOUNDS.maxY = parseFloat(p[3]);
          return;
        }
      } catch (e) {}
    }
    var w = W * S.scale, h = H * S.scale;
    BOUNDS.minX = Math.round(-w * CX0);
    BOUNDS.maxX = Math.round(SCR_W - w * CX1);
    BOUNDS.minY = Math.round(-h * CY_TOP);
    BOUNDS.maxY = Math.round(SCR_H - h * CY_BOT);
  }

  // ---------- ★ iOS / 网页：碎碎念语音 ----------
  //   iOS 规定「必须先有一次用户操作」才允许出声，
  //   所以第一次摸到她（见下面的 kick）时把音频解锁，之后才能自动念。
  var VOICE_ON = !/[?&]voice=0/.test(location.search);
  var audioOK = false;
  var voiceAudio = null;

  function playVoiceWeb(idx) {
    if (!VOICE_ON || !audioOK) return;
    try {
      if (voiceAudio) { voiceAudio.pause(); voiceAudio = null; }
      var n = ('00' + idx).slice(-3);            // 1 → 001
      var a = new Audio('assets/v' + n + '.mp3');
      a.volume = 1;
      var p = a.play();
      if (p && p.catch) p.catch(function () {});
      voiceAudio = a;
    } catch (e) {}
  }

  function unlockAudio() {
    if (audioOK || !VOICE_ON) return;
    audioOK = true;
    // 用一段极短的静音把音频通道"点亮"，之后自动播放才不会被拦
    try {
      var a = new Audio('assets/v001.mp3');
      a.volume = 0;
      var p = a.play();
      if (p && p.then) {
        p.then(function () { try { a.pause(); } catch (e) {} })
         .catch(function () {});
      }
    } catch (e) {}
  }


  function scheduleThink() {
    var mul = SET.actMul > 0.05 ? SET.actMul : 0.05;
    S.nextThink = now() + rand(2500, 7000) / mul;
  }

  function scheduleWhisper() {
    if (SET.talkMul <= 0.02) { S.nextWhisper = Infinity; return; }
    S.nextWhisper = now() + rand(60000, 150000) / SET.talkMul;
  }

  // 动作频率顺便管播放速度：动画几乎都是整 10 秒，
  // 光缩短间隔没多大用，快放/慢放才真的能改节奏。
  function applyRate() {
    var r = Math.pow(SET.actMul, 0.5);
    SET.rate = Math.max(0.7, Math.min(1.6, r));
    try { video.playbackRate = SET.rate; } catch (e) {}
  }

  function readSettings() {
    if (NATIVE) {
      try {
        var p = String(window.AndroidPet.getSettings()).split(',');
        SET.actMul = parseFloat(p[0]);
        SET.talkMul = parseFloat(p[1]);
        SET.edgeHide = p[2] === '1';
        if (isNaN(SET.actMul) || SET.actMul <= 0) SET.actMul = 1;
        if (isNaN(SET.talkMul)) SET.talkMul = 1;
      } catch (e) {}
    }
    scheduleThink();
    scheduleWhisper();
    applyRate();
  }

  // ---------- 视频控制 ----------
  var endHandler = null;

  function playAnim(name, opts) {
    opts = opts || {};
    if (S.current === name && !opts.force) {
      if (opts.onEnd !== undefined) endHandler = opts.onEnd;
      return;
    }
    S.current = name;

    // ★ 原生 App：画中画开着的话，让小窗里的她也跟着换动作
    if (pipActive) pipSend({ cmd: 'play', anim: (NAME_MAP[name] || name) });

    if (endHandler) { video.removeEventListener('ended', endHandler); endHandler = null; }

    video.loop = !!opts.loop;
    video.src = assetUrl(name);
    applyRate();

    var onEnd = function () { if (opts.onEnd) opts.onEnd(); };
    endHandler = onEnd;
    video.addEventListener('ended', onEnd, { once: true });

    if (DEBUG) jlog('play ' + name + ' loop=' + !!opts.loop);

    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function applyFacing() {
    var noflip = ANIM.noFlip.indexOf(S.current) >= 0;
    petEl.classList.toggle('flip', !noflip && S.facing === -1);
  }

  // ============================================================
  // 碎碎念气泡（纯文字）
  //   安卓端：先把窗口头顶「长高」再显示，说完再缩回去
  //   —— 平时窗口 = 宠物本体大小，所以点击范围也只有本体
  // ============================================================
  var bubbleToken = 0;
  var bubbleSpaceOn = false;

  /** 向原生要一块头顶空间，返回是否够用 */
  function askSpace(need) {
    if (!NATIVE) return true;
    var granted = need;
    try { granted = window.AndroidPet.setBubbleSpace(need) | 0; } catch (e) {}
    return granted >= need - 10;
  }

  /** 气泡字号跟随桌宠大小（宠物画幅 306css 宽时 = 15px） */
  function applyBubbleScale() {
    if (!bubble) return;
    var base = NATIVE ? W : W * S.scale;
    var px = Math.max(11, Math.min(30, Math.round(base * 0.049 * 10) / 10));
    bubble.style.fontSize = px + 'px';
  }

  /**
   * 云朵需要伸出头顶多少像素。
   * 直接量「云朵轮廓（含鼓包和尾巴）最高点」到「宠物画幅顶边」的距离，
   * 比累加 padding 靠谱 —— 鼓包是绝对定位的，不占布局高度。
   */
  function bubbleNeed() {
    var top = bubble.getBoundingClientRect().top;
    var puffs = bubble.querySelectorAll('.p');
    for (var i = 0; i < puffs.length; i++) {
      var r = puffs[i].getBoundingClientRect();
      if (r.height > 0 && r.top < top) top = r.top;
    }
    var frameTop = petBody.getBoundingClientRect().top;
    // +18：预留显示时向上平移的几个像素 + 顶部留一点余量
    return Math.max(12, Math.ceil(frameTop - top) + 18);
  }

  function showBubble(text, kind, holdMs, voiceIdx) {
    if (!bubble) return;

    // 换配色（微信绿 / 短信蓝 / 来电红…）
    bubble.className = 'bubble' + (kind ? ' k-' + kind : ' k-chat');
    bubbleText.textContent = text || '';

    var need = bubbleNeed();                 // 此刻还没显示，但布局已经算好
    if (!askSpace(need)) {
      if (DEBUG) jlog('气泡放弃：头顶没空间');
      pumpBubble();                          // 跳过这条，试下一条
      return;
    }

    if (DEBUG) {
      jlog('气泡 need=' + need + ' 高度=' + bubble.offsetHeight
           + ' 宽=' + bubble.offsetWidth + ' 类型=' + kind
           + ' 文字=' + (text || '').slice(0, 14));
    }

    bubbleToken++;
    bubbleSpaceOn = true;
    bubble.classList.add('show');
    S.bubbleTimer = now() + (holdMs || 4500);

    // ★ v1.1：碎碎念的语音跟着气泡一起出来。
    //   音频是离线预合成的（assets/vNNN.mp3，晓伊音色），而且特意挂在
    //   showBubble 上而不是 whisper 上 —— 这样连着来几条、排队的泡泡
    //   也不会出现「声音先出来、气泡后出来」的错位。
    if (voiceIdx && NATIVE) {
      try { window.AndroidPet.speak(voiceIdx); } catch (e) {}
    } else if (voiceIdx) {
      playVoiceWeb(voiceIdx);          // ★ iOS/网页：直接放 assets/vNNN.mp3
    }
  }

  function hideBubble() {
    if (!bubble) return;
    bubble.classList.remove('show');
    S.bubbleTimer = 0;
    if (!NATIVE || !bubbleSpaceOn) { setTimeout(pumpBubble, 450); return; }
    bubbleSpaceOn = false;
    var my = ++bubbleToken;
    setTimeout(function () {
      if (my !== bubbleToken) return;   // 期间又冒了新泡泡
      try { window.AndroidPet.setBubbleSpace(0); } catch (e) {}
      setTimeout(pumpBubble, 260);      // 窗口缩回去之后再弹下一条
    }, 380);
  }

  // ---------- 气泡队列（通知可能连着来）----------
  var bubbleQueue = [];

  function enqueueBubble(text, kind, holdMs, voiceIdx) {
    if (!bubble || !text) return;
    bubbleQueue.push({ text: text, kind: kind || 'chat', hold: holdMs || 5000,
                       voice: voiceIdx || 0 });
    while (bubbleQueue.length > 4) bubbleQueue.shift();   // 最多排 4 条
    pumpBubble();
  }

  function pumpBubble() {
    if (!bubble || !bubbleText) return;
    if (bubble.classList.contains('show')) return;
    if (bubbleSpaceOn) return;
    if (bubbleQueue.length === 0) return;
    var item = bubbleQueue.shift();
    showBubble(item.text, item.kind, item.hold, item.voice);
  }

  function whisper() {
    if (S.mode !== 'idle' && S.mode !== 'action') return;
    // ★ v1.1：传下标而不是字符串，原生才知道该播哪条语音（v001.mp3 起）
    var wi = Math.floor(Math.random() * WHISPERS.length);
    enqueueBubble(WHISPERS[wi], 'chat', 4500, wi + 1);
    scheduleWhisper();

    if (Math.random() < 0.55) {
      S.mode = 'action';
      playAnim(pick(ANIM.whisper), { onEnd: function () { goIdle(); } });
      applyFacing();
    }
  }

  // ---------- 原生来的事件：通知 / 对话 / 思考 ----------
  if (NATIVE) {
    /** 通知气泡：__petNotify(内容, 来源App, 类型, 能不能点) */
    window.__petNotify = function (text, app, kind, clickable) {
      // 躲起来的时候有消息，先把她叫出来
      if (S.mode === 'hidden') {
        S.mode = 'idle';
        try { window.AndroidPet.wake(); } catch (e) {}
      }
      var k = kind || 'app';
      var ICON = { call: '📞', wechat: '💬', qq: '🐧', sms: '✉️', work: '📌', app: '🔔' };
      var body = text || '';
      if (k !== 'chat') {
        body = (ICON[k] || ICON.app) + ' ' + (app ? app + ' · ' : '') + body;
      }
      // 对话回答比较长，多留一会儿给她看完
      enqueueBubble(body, k, k === 'call' ? 9000 : (k === 'chat' ? 9000 : 6500));

      // 让她看一眼 / 被吓一跳，别傻站着
      if (S.mode === 'idle' || S.mode === 'thrown') {
        S.mode = 'action';
        var a = (k === 'call') ? '被吓一跳' : '点击回应-害羞惊讶';
        playAnim(a, { onEnd: function () { goIdle(); } });
        applyFacing();
      }
    };

    /** 双击戳她一下：随机播个动作 */
    window.__petPoke = function () {
      if (S.mode === 'drag' || S.mode === 'hidden') return;
      S.mode = 'action';
      playAnim(nextAction(), { onEnd: function () { goIdle(); } });
      applyFacing();
    };

    /** 原生点了气泡，先收起来 */
    window.__bubbleDismiss = function () {
      bubbleQueue.length = 0;
      hideBubble();
    };

    /**
     * ★ v1.1 摇一摇：原生检测到甩动 → 把她扔出去，并在屏幕里滚起来。
     * 横向速度随机取正负（保证一定撞得到左右两边），再向上抛一下让她离地，
     * 然后就交给上面那段 thrown 物理自己弹。
     */
    window.__nativeShake = function () {
      if (S.mode === 'drag') return;      // 手上拿着呢，别抢
      S.lastUserAt = now();
      S.mode = 'thrown';
      S.vx = (Math.random() < 0.5 ? -1 : 1) * rand(520, 1150);
      S.vy = -rand(750, 1350);
      S.spin = 0;
      S.spinV = (S.vx > 0 ? 1 : -1) * rand(430, 900);   // 滚动角速度
      S.facing = S.vx > 0 ? 1 : -1;
      lastT = now();                      // 免得这一帧 dt 太大把她瞬移出去
      playAnim(pick(ANIM.drag), { loop: true, force: true });
      applyFacing();
    };
  }

  // ---------- 渲染位置 ----------
  var lastNativeX = -99999, lastNativeY = -99999;

  function render() {
    if (NATIVE) {
      if (S.mode === 'drag' || S.mode === 'hidden') return;
      var nx = Math.round(S.x), ny = Math.round(S.y);
      if (nx !== lastNativeX || ny !== lastNativeY) {
        lastNativeX = nx; lastNativeY = ny;
        try { window.AndroidPet.moveTo(nx, ny); } catch (e) {}
      }
      return;
    }
    petEl.style.width  = W + 'px';
    petEl.style.height = H + 'px';
    petEl.style.transform =
      'translate3d(' + S.x + 'px,' + S.y + 'px,0) scale(' + S.scale + ')';
  }

  // ---------- 状态机 ----------
  /** ★ v1.1：滚动效果 —— 只给「视频那一层」(.pet-body) 加旋转，
   *  头顶的气泡保持正立。scale(0.98) 是为了旋转之后画幅仍塞得进
   *  悬浮窗：45° 时最紧，算下来 0.986 就够，所以取 0.98 留点余量。 */
  function applySpin() {
    if (!petBody) return;
    if (!S.spin) { petBody.style.transform = ''; return; }
    petBody.style.transform =
      'rotate(' + S.spin.toFixed(1) + 'deg) scale(0.98)';
  }

  function goIdle() {
    S.mode = 'idle';
    S.spin = 0; S.spinV = 0;     // 停下来就不转了
    applySpin();
    scheduleThink();
    playAnim(pick(ANIM.idle), { loop: true, force: true });
    applyFacing();
  }

  function think() {
    if (S.mode !== 'idle') return;
    var r = Math.random();

    if (r < 0.12) {
      S.mode = 'turn';
      playAnim(pick(ANIM.turn), { onEnd: function () { S.facing = -S.facing; goIdle(); } });
      applyFacing();
    } else if (r < 0.32) {
      var m = pick(ANIM.moves);
      var dist = rand(m.minDist, m.maxDist);
      var dir = Math.random() < 0.5 ? -1 : 1;
      S.mode = 'move';
      S.facing = dir;
      S.moveTarget = { dx: dist * dir };
      playAnim(m.name, { onEnd: function () { S.moveTarget = null; goIdle(); } });
      applyFacing();
    } else if (r < 0.95) {
      // ★ 95 个随机动作，扭蛋袋保证都能轮到
      S.mode = 'action';
      playAnim(nextAction(), { onEnd: function () { goIdle(); } });
      applyFacing();
    } else {
      var mul = SET.actMul > 0.05 ? SET.actMul : 0.05;
      S.nextThink = now() + rand(2000, 5000) / mul;
    }
  }

  // ---------- 安卓原生桥接 ----------
  function refreshFromNative() {
    if (!NATIVE) { readBounds(); return; }
    try {
      var nw = window.AndroidPet.getWidth();
      var nh = window.AndroidPet.getHeight();
      var sw = window.AndroidPet.getScreenWidth();
      var sh = window.AndroidPet.getScreenHeight();
      if (nw > 0) W = nw;
      if (nh > 0) H = nh;
      if (sw > 0) SCR_W = sw;
      if (sh > 0) SCR_H = sh;
      S.x = window.AndroidPet.getX();
      S.y = window.AndroidPet.getY();
    } catch (e) {}
    lastNativeX = Math.round(S.x);
    lastNativeY = Math.round(S.y);
    if (petBody) petBody.style.height = H + 'px';
    readBounds();
    readSettings();
    applyBubbleScale();
  }

  if (NATIVE) {
    window.__nativeApplySettings = function () {
      refreshFromNative();
      S.nextEdgeTry = now() + EDGE_IDLE_MS;
      S.lastUserAt = now();
    };

    window.__nativeScreenChanged = function () {
      refreshFromNative();
      if (S.mode === 'hidden') { S.mode = 'idle'; goIdle(); }
    };

    window.__nativeDragStart = function () {
      S.dragging = true;
      S.mode = 'drag';
      S.vx = 0; S.vy = 0;
      S.lastUserAt = now();
      hideBubble();
      playAnim(pick(ANIM.drag), { loop: true, force: true });
    };

    window.__nativeTap = function () {
      S.dragging = false;
      S.mode = 'action';
      S.lastUserAt = now();
      playAnim(pick(ANIM.clicks), { onEnd: function () { goIdle(); } });
      applyFacing();
    };

    window.__nativeDragEnd = function (vx, vy) {
      S.dragging = false;
      S.lastUserAt = now();
      try {
        S.x = window.AndroidPet.getX();
        S.y = window.AndroidPet.getY();
      } catch (e) {}
      lastNativeX = Math.round(S.x);
      lastNativeY = Math.round(S.y);

      S.mode = 'thrown';
      if (Math.hypot(vx, vy) > 150) {
        S.vx = vx;
        S.vy = vy;
        if (Math.abs(vx) > 60) { S.facing = vx > 0 ? 1 : -1; applyFacing(); }
      } else {
        S.vx = 0;
        S.vy = 0;
      }
      lastT = now();
    };

    // 已经藏到屏幕边上了，安静一会儿
    window.__nativeHidden = function () {
      S.mode = 'hidden';
      S.vx = 0; S.vy = 0;
      hideBubble();
    };

    // 被叫醒（点她 / 拖她 / 原生超时自己出来 / 有通知）
    window.__nativeWake = function () {
      try {
        S.x = window.AndroidPet.getX();
        S.y = window.AndroidPet.getY();
      } catch (e) {}
      lastNativeX = Math.round(S.x);
      lastNativeY = Math.round(S.y);
      S.lastUserAt = now();
      S.nextEdgeTry = now() + EDGE_IDLE_MS;
      scheduleWhisper();
      // 只有在「躲着」的状态才切回待机；
      // 如果已经被通知叫起来在播动画了，别把它冲掉
      if (S.mode === 'hidden') {
        S.mode = 'idle';
        goIdle();
      }
    };
  }

  // ---------- ★ 原生 App：画中画悬浮 ----------
  //   只有被原生外壳（WKSchemeHandler: pip）包起来时才存在这个桥。
  //   网页版 / Safari 里不会有按钮。
  var PIP = (window.webkit && window.webkit.messageHandlers
             && window.webkit.messageHandlers.pip) || null;
  var pipActive = false;
  var pipBtn = document.getElementById('pipBtn');

  function pipSend(obj) {
    if (!PIP) return;
    try { PIP.postMessage(obj); } catch (e) {}
  }

  /** 原生告诉我们画中画的状态：starting / active / stopped / failed / unsupported */
  window.__pipState = function (state, detail) {
    pipActive = (state === 'active');
    if (!pipBtn) return;
    if (state === 'active')           pipBtn.textContent = '🪟 已浮起';
    else if (state === 'starting')    pipBtn.textContent = '🪟 启动中…' + (detail ? ' ' + detail : '');
    else if (state === 'failed')      pipBtn.textContent = '🪟 起不来：' + (detail || '未知原因');
    else if (state === 'unsupported') pipBtn.textContent = '🪟 本机不支持';
    else                              pipBtn.textContent = '🪟 浮到桌面';
    if (state === 'failed')           pipBtn.style.maxWidth = '78vw';
  };

  if (PIP && pipBtn) {
    pipBtn.style.display = 'block';
    pipBtn.addEventListener('click', function () {
      if (pipActive) { pipSend({ cmd: 'stop' }); return; }
      pipSend({ cmd: 'start', anim: NAME_MAP[S.current] || 'a032' });
    });
  }

  // ---------- 主循环 ----------
  var lastT = now();
  var fpsAcc = 0, fpsCnt = 0, fpsShown = 0;
  var lastBeat = 0;

  /** 真正的一帧；外面包 try/catch，保证出错也不会让循环断掉 */
  function step() {
    var t = now();
    var dt = (t - lastT) / 1000;
    lastT = t;
    if (dt > 0.1) dt = 0.1;

    if (glReady && !petEl.classList.contains('no-blend')) drawGL();

    fpsAcc += dt; fpsCnt++;
    if (fpsAcc >= 0.5) { fpsShown = Math.round(fpsCnt / fpsAcc); fpsAcc = 0; fpsCnt = 0; }

    if (S.bubbleTimer && t > S.bubbleTimer) hideBubble();

    // 藏起来了：彻底待机，位置交给原生，等被叫醒
    if (S.mode === 'hidden') { updateDebug(); return; }

    if (S.mode === 'drag') { render(); updateDebug(); return; }

    if (S.mode === 'thrown') {
      S.vy += PHYSICS.gravity * dt;
      S.x += S.vx * dt;
      S.y += S.vy * dt;

      // ★ v1.1 摇一摇：一边飞一边滚
      if (S.spinV) {
        S.spin += S.spinV * dt;
        applySpin();
      }

      var grounded = false;

      if (S.x < BOUNDS.minX) {
        S.x = BOUNDS.minX; S.vx = -S.vx * PHYSICS.restitution;
        if (Math.abs(S.vx) > 80) { S.facing = 1; applyFacing(); }
      } else if (S.x > BOUNDS.maxX) {
        S.x = BOUNDS.maxX; S.vx = -S.vx * PHYSICS.restitution;
        if (Math.abs(S.vx) > 80) { S.facing = -1; applyFacing(); }
      }
      if (PHYSICS.ceilingBounce && S.y < BOUNDS.minY) {
        S.y = BOUNDS.minY; S.vy = -S.vy * PHYSICS.restitution;
      }
      if (S.y >= BOUNDS.maxY) {
        S.y = BOUNDS.maxY;
        grounded = true;
        S.vy = -S.vy * PHYSICS.restitution;
        S.vx -= S.vx * PHYSICS.groundFriction * dt;
        S.vx *= 0.995;
        if (Math.abs(S.vy) < 80) S.vy = 0;
        if (Math.abs(S.vx) < 25) S.vx = 0;
        // 落地摩擦也会让她转得越来越慢
        S.spinV -= S.spinV * 1.6 * dt;
        if (Math.abs(S.spinV) < 20) S.spinV = 0;
      }

      render();

      if (grounded && S.vy === 0 && S.vx === 0) goIdle();

      updateDebug(); return;
    }

    if (S.mode === 'move' && S.moveTarget) {
      var moveStep = S.moveTarget.dx * dt / 2.2;
      S.x = clamp(S.x + moveStep, BOUNDS.minX, BOUNDS.maxX);
      if (Math.abs(moveStep) > 0.01) S.moveTarget.dx -= moveStep;
      else S.moveTarget = null;
    }

    if (S.mode === 'idle') {
      if (t >= S.nextThink) think();
      if (t >= S.nextWhisper) whisper();

      // 贴着屏幕边、而且哥哥好久没理她了，才躲起来
      if (NATIVE && SET.edgeHide && t >= S.nextEdgeTry
          && (t - S.lastUserAt) > EDGE_IDLE_MS
          && !(bubble && bubble.classList.contains('show'))) {
        S.nextEdgeTry = t + 4000;
        try { window.AndroidPet.tryEdgeHide(); } catch (e) {}
      }
    }

    render();

    if (DEBUG && t - lastBeat > 8000) {
      lastBeat = t;
      jlog('心跳 mode=' + S.mode + ' anim=' + S.current
         + ' pos=' + Math.round(S.x) + ',' + Math.round(S.y)
         + ' 下次说话=' + (isFinite(S.nextWhisper)
              ? Math.round((S.nextWhisper - t) / 1000) + 's' : '关'));
    }

    updateDebug();
  }

  function loop() {
    try {
      step();
    } catch (e) {
      toast('主循环异常: ' + e.message);
    }
    requestAnimationFrame(loop);
  }

  var lastDebug = 0;
  function updateDebug() {
    var t = now();
    if (t - lastDebug < 200) return;
    lastDebug = t;
    if (dState) dState.textContent = S.mode;
    if (dAnim)  dAnim.textContent  = S.current || '-';
    if (dFps)   dFps.textContent   = fpsShown;
  }

  // ---------- 网页端交互（安卓端走原生）----------
  function pointerPos(e) {
    var p = e.touches ? e.touches[0] : e;
    return { x: p.clientX, y: p.clientY };
  }

  function onDown(e) {
    if (NATIVE) return;
    var p = pointerPos(e);
    S.dragging = true;
    S.mode = 'drag';
    S.vx = 0; S.vy = 0;
    S.dragOffset = { x: p.x - S.x, y: p.y - S.y };
    S.lastPointer = [{ x: p.x, y: p.y, t: now() }];
    S.dragStart = now();
    S.dragMoved = false;
    hideBubble();
    playAnim(pick(ANIM.drag), { loop: true, force: true });
    if (e.preventDefault) e.preventDefault();
  }

  function onMove(e) {
    if (NATIVE || !S.dragging) return;
    var p = pointerPos(e);
    S.x = p.x - S.dragOffset.x;
    S.y = p.y - S.dragOffset.y;

    S.lastPointer.push({ x: p.x, y: p.y, t: now() });
    if (S.lastPointer.length > 6) S.lastPointer.shift();
    if (Math.hypot(p.x - S.lastPointer[0].x, p.y - S.lastPointer[0].y) > 6) S.dragMoved = true;

    render();
    if (e.preventDefault) e.preventDefault();
  }

  function onUp(e) {
    if (NATIVE || !S.dragging) return;
    S.dragging = false;

    var pts = S.lastPointer;
    var vx = 0, vy = 0;
    if (pts.length >= 2) {
      var a = pts[0], b = pts[pts.length - 1];
      var dt = Math.max(0.016, (b.t - a.t) / 1000);
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
    }

    var isClick = !S.dragMoved && (now() - S.dragStart) < 350;

    if (isClick) {
      S.mode = 'action';
      playAnim(pick(ANIM.clicks), { onEnd: function () { goIdle(); } });
    } else {
      S.mode = 'thrown';
      if (Math.hypot(vx, vy) > 120) {
        S.vx = vx * PHYSICS.throwPower;
        S.vy = vy * PHYSICS.throwPower;
        if (Math.abs(vx) > 60) { S.facing = vx > 0 ? 1 : -1; applyFacing(); }
      } else {
        S.vx = 0; S.vy = 0;
      }
    }
    if (e.preventDefault) e.preventDefault();
  }

  if (!NATIVE) {
    petEl.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp, { passive: false });
    document.addEventListener('touchcancel', onUp, { passive: false });

    // ★ 保险：万一系统把自动播放拦掉了，第一次触摸就手动把她唤醒；
    //   顺便把音频解锁（iOS 规定必须先有一次用户操作才允许出声）。
    var kick = function () {
      try { if (video.paused) video.play().catch(function () {}); } catch (e) {}
      unlockAudio();
      document.removeEventListener('touchstart', kick);
      document.removeEventListener('mousedown', kick);
    };
    document.addEventListener('touchstart', kick, { passive: true });
    document.addEventListener('mousedown', kick, { passive: true });
  }

  // 面板按钮
  var btnToggle = document.getElementById('btnToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', function () {
      var d = document.getElementById('debug');
      d.classList.toggle('hidden');
      this.textContent = d.classList.contains('hidden') ? '显示面板' : '隐藏面板';
    });
  }

  var SCALES = [1, 0.75, 0.5, 0.35];
  var scaleIdx = 0;
  var btnSmall = document.getElementById('btnSmall');
  if (btnSmall) {
    btnSmall.addEventListener('click', function () {
      scaleIdx = (scaleIdx + 1) % SCALES.length;
      S.scale = SCALES[scaleIdx];
      this.textContent = '缩放：' + Math.round(S.scale * 100) + '%';
      readBounds();
      render();
    });
  }

  var blendOn = true;
  var btnBlend = document.getElementById('btnBlend');
  if (btnBlend) {
    btnBlend.textContent = '透明模式：开';
    btnBlend.addEventListener('click', function () {
      blendOn = !blendOn;
      petEl.classList.toggle('no-blend', !blendOn);
      this.textContent = '透明模式：' + (blendOn ? '开' : '关');
    });
  }

  window.addEventListener('resize', function () {
    if (!NATIVE) {
      SCR_W = window.innerWidth; SCR_H = window.innerHeight;
      readBounds();
      S.x = clamp(S.x, BOUNDS.minX, BOUNDS.maxX);
      S.y = clamp(S.y, BOUNDS.minY, BOUNDS.maxY);
      render();
    }
  });

  // ============================================================
  // 渲染方式选择 —— 高兼容性的关键
  //
  // 视频是 VP9 + 原生 alpha（yuva420p），而它的「色彩平面」就是原始的带黑底画面。
  // 所以同一套文件天然支持两条路：
  //   · 浏览器支持 WebM alpha  -> 直接显示视频，连抠图都不用（任何机型都不会有描边）
  //   · 不支持               -> 读出来就是黑底原片，退回 WebGL 实时抠图
  // ============================================================

  /** 这台机器到底支不支持 WebM 原生 alpha（判定结果） */
  var nativeAlpha = false;

  /** 把「实际走了哪条路」回报给原生，自检清单会显示 */
  function reportRender(m) {
    if (NATIVE) { try { window.AndroidPet.reportRender(m); } catch (e) {} }
    if (DEBUG) jlog('渲染方式: ' + m);
  }

  /** 把左上角一小块画到 canvas 上，看 alpha 是不是真的透明 */
  function detectNativeAlpha() {
    try {
      var cv = document.createElement('canvas');
      cv.width = 24; cv.height = 24;
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 24, 24);
      // 取【原始】左上角 24x24（那一块一定是背景，不会画出角色）
      ctx.drawImage(video, 0, 0, 24, 24, 0, 0, 24, 24);
      var d = ctx.getImageData(0, 0, 24, 24).data;
      var sum = 0, n = 0;
      for (var i = 3; i < d.length; i += 4) { sum += d[i]; n++; }
      return n > 0 && (sum / n) < 60;      // 平均 alpha 很低 = 原生 alpha 生效
    } catch (e) {
      return false;
    }
  }

  video.addEventListener('loadedmetadata', syncCanvasSize);
  video.addEventListener('loadeddata', syncCanvasSize);
  video.addEventListener('error', function () {
    if (DEBUG) jlog('视频出错 code=' + (video.error ? video.error.code : '?'));
  });

  // ---------- 启动 ----------
  function boot() {
    if (NATIVE) {
      var dbg = document.getElementById('debug');
      if (dbg) dbg.style.display = 'none';
      var hint = document.querySelector('.hint');
      if (hint) hint.style.display = 'none';
      var desk = document.querySelector('.desktop');
      if (desk) desk.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';

      petEl.style.width = '100%';
      petEl.style.height = '100%';

      refreshFromNative();
    } else {
      var sw2 = window.innerWidth;
      if (IS_IOS) {
        // ★ iOS：手机屏窄，按屏宽比例给一个"占满一屏宽度"的大小，
        //   角色本体约占屏宽 1/3，看起来刚刚好。
        S.scale = clamp(sw2 / W, 0.5, 1.1);
        if (btnSmall) btnSmall.textContent = '缩放：' + Math.round(S.scale * 100) + '%';
      } else if (sw2 < W + 80) {
        S.scale = Math.max(0.35, (sw2 * 0.55) / W);
        if (btnSmall) btnSmall.textContent = '缩放：' + Math.round(S.scale * 100) + '%';
      }
      readBounds();
      S.x = clamp(window.innerWidth - W * S.scale - 20, BOUNDS.minX, BOUNDS.maxX);
      S.y = 80;
    }

    render();
    goIdle();                    // 这一步会开始加载第一个动画
    applyBubbleScale();

    S.lastUserAt = now();
    S.nextEdgeTry = now() + EDGE_IDLE_MS;
    // 启动后 10~20 秒先碎碎念一句，方便确认功能正常
    S.nextWhisper = now() + rand(10000, 20000);

    // ★ 主循环不在这里起：要等第一个动画解码出来、判定完渲染方式再起
    waitAndDetect(0);
  }

  var loopStarted = false;

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    lastT = now();
    requestAnimationFrame(loop);
    if (NATIVE) {
      toast('大肥鱼就绪 · ' + ALL_NAMES.length + ' 个动作 / ' + WHISPERS.length + ' 句碎碎念');
    }
  }

  /** 等第一帧真的能画了，再判断这台机器支持哪条渲染路径 */
  function waitAndDetect(tries) {
    if (loopStarted) return;

    // ★ iOS：Safari 只有 HEVC-alpha 的 .mov 能原生透明，直接用 .native 直出
    //   （不要过 canvas —— 过一道反而可能丢 alpha）。
    //   黑底素材（mp4/webm）走下面默认的 mix-blend-mode:screen 去黑路径。
    if (IS_IOS) {
      if (EXT === '.mov') {
        petEl.classList.add('native');
        petEl.classList.remove('gl');
        video.style.position = 'static';
        video.style.pointerEvents = 'none';
      }
      if (DEBUG) jlog('iOS 路径：' + EXT + (EXT === '.mov' ? '（原生透明）' : '（黑底+screen 去黑）'));
      startLoop();
      return;
    }

    if (video.videoWidth > 0 && video.readyState >= 2) {
      // 设置页可以强制指定渲染方式（自动 / 原生 alpha / WebGL）
      var force = 0;
      if (NATIVE) { try { force = window.AndroidPet.getRenderMode() | 0; } catch (e) {} }

      if (force === 1) nativeAlpha = true;
      else if (force === 2) nativeAlpha = false;
      else nativeAlpha = detectNativeAlpha();

      if (nativeAlpha) {
        // ★ 原生 alpha 也走 canvas！
        // 原因：<video> 元素是由合成器按 CSS 分辨率光栅化后再放大的，
        // 缩放滤镜糙，斜边会出现台阶（实测过渡带只有 2~3px，
        // 而源视频的 alpha 过渡是 5.7px）。canvas 是按屏幕物理分辨率
        // 光栅化的，缩放由浏览器做正确的双线性插值，边缘更干净。
        glReady = initGL();
        if (glReady) {
          usePassthrough = true;              // 直通，不做抠图
          petEl.classList.add('gl');          // 隐藏 video，显示 canvas
          video.style.position = 'absolute';
          video.style.left = '0';
          video.style.top = '0';
          video.style.pointerEvents = 'none';
          reportRender('原生 alpha' + (force === 1 ? '（强制）' : ''));
        } else {
          // WebGL 都不可用，只能直接显示带 alpha 的视频
          petEl.classList.add('native');
          video.style.position = 'static';
          video.style.opacity = '1';
          video.style.pointerEvents = 'none';
          reportRender('原生 alpha（直出）');
        }
      } else {
        // 不支持原生 alpha：读出来就是黑底原片，交给 WebGL 抠
        glReady = initGL();
        if (glReady) {
          usePassthrough = false;
          petEl.classList.add('gl');
          video.style.position = 'absolute';
          video.style.left = '0';
          video.style.top = '0';
          video.style.pointerEvents = 'none';
        }
        reportRender('WebGL 抠图' + (force === 2 ? '（强制）' : '') + (glReady ? '' : '（失败）'));
      }
      startLoop();
      return;
    }

    // 兜底：5 秒还没画面也不能一直黑着
    if (tries > 50) {
      glReady = initGL();
      if (glReady) {
        petEl.classList.add('gl');
        video.style.position = 'absolute';
        video.style.left = '0';
        video.style.top = '0';
        video.style.pointerEvents = 'none';
      }
      if (DEBUG) jlog('渲染方式: 超时兜底 WebGL (gl=' + glReady + ')');
      startLoop();
      return;
    }
    setTimeout(function () { waitAndDetect(tries + 1); }, 100);
  }

  // ★ 入口：boot() 里会 goIdle()（开始加载第一个动画），
  //   随后 waitAndDetect 轮询等第一帧解码出来，再决定用哪条渲染路径并启动主循环。
  boot();

})();
