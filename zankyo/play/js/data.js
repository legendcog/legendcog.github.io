/* 『十七時の残響』 定義データ（人物・証拠・証言・推理・場所・相関図・時系列） */
"use strict";

const GAME_TITLE = "十七時の残響";
const GAME_VER = "2.55";
/* 絵を直したらここを変える。古い絵がブラウザに残っていても、必ず読みこみ直される */
const IMG_V = "?v=2.55a";

/* 結末。真相解明のほかに5つ。tip は、その結末を見たあとに出す「次への手がかり」 */
const ENDINGS = [
  { id: "true", name: "真相解明", sub: "TRUE END" },
  { id: "framed", name: "濡れ衣", sub: "BAD END", note: "探偵のまねごとをした僕は、いちばん犯人に近い場所に立ってしまった。",
    tip: "確信を失うほどまちがえたり、力ずくで動いたりすると、疑いは自分に返ってくる。" },
  { id: "half", name: "半分の真相", sub: "NORMAL END", note: "犯人は罪を認めた。事件は、解決した――はずだった。",
    tip: "あの告白には、本人が《知らないはず》のことが混じっていた。" },
  { id: "wrong", name: "誤認", sub: "BAD END", note: "僕が名指ししたのは、犯人ではなかった。",
    tip: "17時ごろの居場所について、《嘘》をついたのは誰だった？ 相棒の声に耳を貸そう。" },
  { id: "unknown", name: "迷宮", sub: "ANOTHER END", note: "アリバイは崩した。けれど、犯人には届かなかった。",
    tip: "状況証拠だけでは、人は認めない。その場で《目に見える》決め手を。" },
  { id: "timeout", name: "時間切れ", sub: "BAD END", note: "真相にたどり着く前に、警察が来てしまった。",
    tip: "時間は《移動する》たびに進む。校内図の黄色い点と、相棒の助言で寄り道を減らそう。" },
];
/* 時間：移動1回で1目盛り（1分15秒）。18時40分に始まり、80目盛り（20時20分）までに「みんなを集める」を選ばないと時間切れ */
const CLOCK_LIMIT = 80;
const CLOCK_WARN = [
  [40, "hiyori/think: ミナト、もう19時半。警察が来るまで、あと1時間だよ。移動するたびに時間が過ぎてく……寄り道は、ほどほどにね。"],
  [64, "hiyori/surprise: もう20時！ あと30分しかない。みんなを集めるなら、急がないと！"],
  [74, "hiyori/sad: ミナト、もう限界だよ。あと何回か動いたら、警察が来ちゃう……！"],
];

/* ---------------------------------------------------------------- 人物
   height は身長（cm）。立ち絵の大きさと高さは、これをもとに計算で決める（engine.js の SPR と placeSprite） */
const CHARS = {
  me: { name: "霧島 湊", height: 170, short: "湊", color: "#9fb4ff", noSprite: true },
  n: { name: "", noSprite: true },
  koto: { name: "白瀬 琴音", height: 158, short: "琴音", color: "#c9a7ff", noSprite: true },   // 「もうひとつの十七時」で、語り手になる琴音
  all: { name: "クラスメイトたち", short: "一同", color: "#8d93b5", noSprite: true },
  hiyori: {
    name: "日向 ひより", height: 155, short: "ひより", kana: "ひなた ひより", color: "#ffa23c", role: "新聞部／相棒",
    profile: [
      { text: "2年B組。新聞部のエース（自称）。首からさげたカメラがトレードマーク。湊とは小学校からの腐れ縁で、好奇心だけで生きている。" },
      { c: "ch1", text: "事件当日は16:30からずっと湊と一緒に暗幕運びをしていた。警察が来る前に真相をつかもうと、湊を捜査に引っぱり出す。" },
    ],
  },
  kotone: {
    name: "白瀬 琴音", height: 158, short: "琴音", kana: "しらせ ことね", color: "#c9a7ff", role: "被害者／桜霞祭実行委員", noSprite: false,
    profile: [
      { text: "2年B組。桜霞祭の実行委員で、後夜祭ではピアノ独奏『夕凪のワルツ』を弾く予定だった。誰にでも優しく、嘘がつけない性格。" },
      { c: "ch1", text: "18:10、旧校舎3階の音楽室で倒れているのが見つかった。後頭部を強く打たれている。" },
      { c: "t_uta_recent", text: "最近は何かに悩んでいた。「正しいことって、誰かを傷つけるのかな」と親友にこぼしていた。" },
      { c: "d_motive", text: "クラスの会計に合わない数字があることに気づき、ひとりで領収書の控えを集めていた。" },
      { c: "envelope", text: "カバンの内ポケットに、銀行の封筒を入れていた。中身は42,000円。" },
      { c: "ending", text: "帳簿の穴を、自分の貯金で黙って埋めるつもりだった。誰のせいにもしないために。" },
    ],
  },
  rena: {
    name: "氷室 玲奈", height: 164, short: "玲奈", kana: "ひむろ れな", color: "#5aa9ff", role: "学級委員長／実行委員（会計）",
    profile: [
      { text: "2年B組の学級委員長。成績は学年トップ、書道は段持ち。感情を表に出さず、何事も完璧にこなす。桜霞祭ではクラスの会計も担当。" },
      { c: "t_rena_alibi", text: "17時前後は「2階の図書室で会計資料を調べていた」と証言。17:15に職員室、その後は教室にいた。" },
      { c: "cashbox", text: "会計係だが、現金には触れない。帳簿をつけるだけ。" },
      { c: "d_lie", text: "図書室は16:30に閉まっていた。17時のアリバイは嘘だ。" },
      { c: "t_marika_paint", text: "16時ごろ、美術室で蓄光塗料の缶を倒し、右手と袖を汚している。" },
      { c: "ending", text: "42,000円の穴を隠すために帳簿を書きかえた。けれど、現金を持ち出したのは彼女ではなかった。守ろうとしたのは、自分ではなく先生だった。" },
    ],
  },
  uta: {
    name: "月岡 詩", height: 152, short: "詩", kana: "つきおか うた", color: "#7fe0a8", role: "吹奏楽部（フルート）",
    profile: [
      { text: "2年B組。吹奏楽部のフルート担当。人見知りで声が小さいが、音に関しては誰よりも鋭い《絶対音感》の持ち主。琴音の一番の親友。" },
      { c: "t_uta_piano", text: "17:30、音楽室の真下の楽器庫で『夕凪のワルツ』を聞いた。18:10、琴音を呼びに行って第一発見者になる。" },
      { c: "u_alibi17", text: "16:40〜17:25は旧校舎2階でパート練習。部員5人が一緒だった。" },
      { c: "t_uta_makabe", text: "17:25、楽器庫へ下りる階段で真壁先生とすれちがい、「18時までそっとしておいてあげなさい」と言われた。" },
    ],
  },
  marika: {
    name: "夏目 茉莉花", height: 161, short: "茉莉花", kana: "なつめ まりか", color: "#ff7ab8", role: "演劇部",
    profile: [
      { text: "2年B組。演劇部の看板女優。派手な見た目とは裏腹に、絵がうまくて面倒見がいい。うわさ話が大好物。" },
      { c: "t_marika_piano", text: "17:30ごろ、旧校舎の階段でピアノを聞いた。琴音の姿は見ていない。" },
      { c: "m_alibi17", text: "16:30〜17:20は体育館のステージで演劇部のリハーサル。部員全員が証人。" },
      { c: "rel_marika_taiga", text: "朝倉大河にひそかに想いを寄せている。本人は全力で否定。" },
    ],
  },
  taiga: {
    name: "朝倉 大河", height: 182, short: "大河", kana: "あさくら たいが", color: "#ff5a4d", role: "バスケ部",
    profile: [
      { text: "2年B組。バスケ部のエース。口より先に体が動くタイプで、誤解されやすい。琴音とは中学からの付き合い。" },
      { c: "ch1", text: "事件当日の昼休み、琴音と激しく言い争っていた。17:30以降のアリバイがなく、クラスの疑いを一身に集めている。" },
      { c: "t_taiga_ledger", text: "口論の原因は、琴音が《帳簿》のことで悩んでいるのに何も話してくれなかったこと。" },
      { c: "letter", text: "体育倉庫にこもっていたのは、琴音に渡す謝罪の手紙を書いていたから。字が汚くて何度も書き直していた。" },
    ],
  },
  ren: {
    name: "黒瀬 蓮", height: 172, short: "黒瀬", kana: "くろせ れん", color: "#8f9bff", role: "放送部",
    profile: [
      { text: "2年B組。放送部。いつもヘッドホンを首にかけ、必要最低限しかしゃべらない。機材の扱いは教師より上。" },
      { c: "know_rec", text: "先週、桜霞祭のBGM用に琴音の『夕凪のワルツ』を録音した。" },
      { c: "t_ren_away", text: "16:55〜17:20、放送室を空けていた。鍵はかけていなかった。" },
      { c: "ren_cat", text: "席を外していた理由は、体育館裏の野良猫に餌をやるため。猫の名前は「ミキサー」。" },
    ],
  },
  makabe: {
    name: "真壁 先生", height: 176, short: "真壁先生", kana: "まかべ", color: "#b9c2c9", role: "担任／音楽教師",
    profile: [
      { text: "2年B組の担任で音楽教師。おだやかで生徒からの信頼は厚い。今夜は校内に残った唯一の教師として、生徒たちを預かっている。" },
      { c: "ch1", text: "「現場の物には触れないこと」を条件に、湊たちが状況を記録することを黙認してくれた。" },
      { c: "know_adviser", text: "放送部の顧問でもある。" },
      { c: "cashbox", text: "クラス費の金庫の鍵を預かっている。現金の出し入れは、担任の仕事。" },
      { c: "ending", text: "玲奈の受験費用のために、クラス費から42,000円を借りた。事件のあと、玲奈を守るために17:30の演奏を仕掛けた。" },
    ],
  },
  koga: {
    name: "古賀 源治", height: 167, short: "古賀さん", kana: "こが げんじ", color: "#c9b48a", role: "用務員",
    profile: [
      { text: "この学校に30年勤める用務員。無口で顔はこわいが、鍵と戸締まりのことなら誰よりもくわしい。旧校舎の鍵をすべて腰にさげている。今夜は道がふさがり、帰れなくなった。" },
      { c: "t_koga_window", text: "16:50、台風にそなえて旧校舎の窓を閉めて回った。音楽室の窓も、鍵までかけた。" },
      { c: "t_koga_rena", text: "17:05、本校舎1階の廊下にモップをかけていて、職員室へ駆けこむ玲奈を見た。" },
    ],
  },
};

/* ---------------------------------------------------------------- 証拠品・道具
   stages: 調べが進むと説明が変わる。doc: メモで開いた時に紙として見せる中身 */
const EVID = {
  scene: {
    name: "現場の状況", img: "keylog",
    stages: ["旧校舎3階・音楽室。琴音はグランドピアノの横に倒れていた。後頭部を強く打たれている。発見は18:10、第一発見者は月岡詩。扉に鍵はかかっていなかった。"],
  },
  trophy: {
    name: "優勝トロフィー", img: "trophy",
    stages: [
      "音楽室の棚にあった合唱コンクールの優勝杯。床に転がっていた。台座の角がへこみ、何かを拭き取った跡がある。これが凶器と見てよさそうだ。",
      "凶器のトロフィー。ブラックライトを当てると、持ち手に《蛍光グリーンの指の跡》が浮かび上がる。犯人の手には蓄光塗料が残っていた。",
    ],
  },
  strings: {
    name: "切れたピアノの弦", img: "strings",
    stages: ["音楽室のグランドピアノ。中央の《ラ》の弦が切れて丸まっている。この鍵盤だけ、押しても「コトン」と鳴るだけで音が出ない。"],
  },
  repairmemo: {
    name: "修理依頼のメモ", img: "memo",
    stages: ["職員室の連絡ボードにあったメモ。音楽室のピアノの《ラ》の弦は、今朝の1時間目に切れた。修理は文化祭のあと。"],
    doc: `<div class="paper memo"><div class="p-h">連絡メモ</div><p>音楽室グランドピアノ<br><b>中央のラ（A4）弦切れ</b></p><p>本日 1限・2-B 授業中に発生。<br>調律師手配済み →<b>桜霞祭明け</b>に修理。</p><p class="p-sign">10/10 真壁</p></div>`,
  },
  score: {
    name: "『夕凪のワルツ』の楽譜", img: "score",
    stages: ["ピアノの譜面台にあった琴音の楽譜。余白に今日の日付で「ラが出ない！ 本番は体育館のピアノで」と書きこみがある。琴音自身も弦が切れていることを知っていた。"],
  },
  phone: {
    name: "琴音のスマートフォン", img: "phone",
    stages: ["ピアノの上に置かれていた。ロック画面に未読の通知が並んでいる。いちばん古い未読は17:06の詩からのメッセージ。琴音は「返信が早い」ことで有名だった。"],
    doc: `<div class="phone-doc"><div class="ph-time">18:42</div><div class="ph-date">10月10日 金曜日</div>
      <div class="ph-n"><b>うた</b><span>17:45</span><p>先に教室もどってるね</p></div>
      <div class="ph-n"><b>うた</b><span>17:20</span><p>まだ練習中？</p></div>
      <div class="ph-n"><b>うた</b><span>17:06</span><p>ごめん、パート練のびそう！</p></div>
      <div class="ph-note">すべて未読</div></div>`,
  },
  watch: {
    name: "壊れた腕時計", img: "watch",
    stages: ["ピアノの下の暗がりに落ちていた、琴音の腕時計。ベルトがちぎれ、ガラスが割れている。針は《17時03分》で止まっていた。"],
  },
  planner: {
    name: "琴音の手帳", img: "planner",
    stages: [
      "音楽室に置かれた琴音のカバンに入っていた手帳。今日のページだけが、乱暴に破り取られている。",
      "破られたページの次の紙を鉛筆でこすると、筆圧の跡が浮かび上がった。「17:00 音楽室 委員長と。帳簿のこと、ちゃんと話す」",
    ],
    use: { tool: "pencil", label: "鉛筆でこすってみる", scene: "use_pencil" },
    docStage: 1,
    doc: `<div class="paper rub"><div class="p-h">10 / 10（金）</div><p class="rub-t">17:00　音楽室<br>委員長と。<br>帳簿のこと、<br>ちゃんと話す</p><p class="p-sub">（鉛筆でこすって浮かび上がった筆圧の跡）</p></div>`,
  },
  speaker: {
    name: "音楽室の放送スピーカー", img: "speaker",
    stages: ["音楽室の天井にある校内放送用スピーカー。壁の音量つまみが《最大》になっていた。"],
  },
  timer: {
    name: "プログラムタイマー", img: "timer",
    stages: ["放送室にある、チャイムや校内放送を予約する機械。今日の17:30、《旧校舎3階の音楽室だけ》に向けてUSBの音源を流す予約が入っていた。登録されたのは今日の17:11。予約の登録には《管理コード》が要る。"],
    doc: `<div class="timer-doc"><div class="td-h">PROGRAM TIMER ─ 本日の予約</div>
      <table><tr><th>時刻</th><th>内容</th><th>出力先</th><th>登録</th></tr>
      <tr><td>17:00</td><td>チャイム</td><td>全校</td><td>定例</td></tr>
      <tr class="hot"><td>17:30</td><td>USB再生 TRACK01</td><td>旧校舎3F 音楽室のみ</td><td>本日 17:11</td></tr>
      <tr><td>18:00</td><td>チャイム</td><td>全校</td><td>定例</td></tr>
      <tr><td>19:00</td><td>下校放送</td><td>全校</td><td>定例</td></tr></table>
      <p style="margin-top:14px;font-size:15px;opacity:.75;letter-spacing:.06em">LOCK ： 管理コードで解錠（最終解錠 本日 17:10）</p></div>`,
  },
  usb: {
    name: "録音入りのUSBメモリ", img: "usb",
    stages: ["タイマーに挿さったままだったUSB。タグには「桜霞祭BGM／白瀬ピアノ『夕凪のワルツ』10/3録音 黒瀬」。ふだんは放送室の、鍵のない引き出しに入っている。"],
  },
  fingerprint: {
    name: "タイマーに残った蛍光の指紋", img: "fingerprint",
    stages: ["ブラックライトを当てると、プログラムタイマーの操作ボタンに《蛍光グリーンの指紋》が浮かび上がった。予約を入れた人物の指には、蓄光塗料が付いていた。"],
  },
  paint: {
    name: "蓄光塗料の缶", img: "paint",
    stages: ["美術室にあった蓄光（蛍光）塗料。看板の文字用に《今日の16時》に開けたばかりの新品。ラベルには「油性。水では落ちません。ブラックライトで強く発光」とある。床にこぼした跡が残っている。"],
  },
  notice: {
    name: "図書室の貼り紙", img: "notice",
    stages: ["2階の図書室の扉に貼られていた。今日は桜霞祭の準備のため、《16:30で閉室》して施錠されている。"],
    doc: `<div class="paper notice"><div class="p-h">図書室からのお知らせ</div><p>桜霞祭準備のため、本日は</p><p class="big">16：30 で閉室</p><p>します。閉室後は施錠します。<br>返却はブックポストへ。</p><p class="p-sign">図書委員会・司書</p></div>`,
  },
  keylog: {
    name: "鍵の貸出簿", img: "keylog",
    stages: ["職員室の鍵の貸し出し記録。音楽室の鍵は16:35に琴音が借りている。図書室の鍵は16:30に司書が返却し、その後だれも借りていない。"],
    doc: `<div class="paper log"><div class="p-h">鍵 貸出簿　10/10</div><table>
      <tr><th>部屋</th><th>貸出</th><th>氏名</th><th>返却</th></tr>
      <tr><td>放送室</td><td>15:20</td><td>黒瀬</td><td>―</td></tr>
      <tr><td>体育倉庫</td><td>15:40</td><td>朝倉</td><td>―</td></tr>
      <tr><td>美術室</td><td>15:45</td><td>夏目</td><td>―</td></tr>
      <tr><td>図書室</td><td>8:10</td><td>司書</td><td><b>16:30</b></td></tr>
      <tr><td>音楽室</td><td><b>16:35</b></td><td>白瀬</td><td>―</td></tr></table></div>`,
  },
  receipt: {
    name: "領収書の控え", img: "receipt",
    stages: ["琴音の机の楽譜ファイルに挟まれていた、桜霞祭の買い出しの領収書のコピー。琴音の字で「合計 186,400円。帳簿は 228,400円……？」とメモがある。"],
    doc: `<div class="paper receipt"><div class="p-h">領収書 控え（2-B）</div><p>画材・木材　　　　 68,200<br>暗幕レンタル　　　 54,000<br>衣装・小道具　　　 41,700<br>蓄光塗料ほか　　　 22,500</p><p class="sum">合計　186,400 円</p><p class="hand">帳簿は 228,400円……？<br>差額 42,000円</p></div>`,
  },
  ledger: {
    name: "桜霞祭の会計帳簿", img: "ledger",
    stages: [
      "玲奈が職員室へ提出した、2年B組の会計帳簿。支出の合計は228,400円。ところどころ数字に修正液の跡がある。記入者は会計係の氷室玲奈。",
      "玲奈が提出した会計帳簿。ブラックライトを当てると、表紙に《蛍光グリーンの手の跡》が浮かぶ。手渡したとき、塗料はまだ乾ききっていなかった。机のふちにも、光る筋が移っている。",
    ],
    doc: `<div class="paper ledger"><div class="p-h">桜霞祭 会計帳簿　2年B組</div><table>
      <tr><td>画材・木材</td><td>68,200</td></tr><tr><td>暗幕レンタル</td><td><span class="fix">74,000</span></td></tr>
      <tr><td>衣装・小道具</td><td><span class="fix">63,700</span></td></tr><tr><td>蓄光塗料ほか</td><td>22,500</td></tr>
      <tr class="sum"><td>支出合計</td><td>228,400</td></tr></table><p class="p-sign">会計　氷室 玲奈</p></div>`,
  },
  window: {
    name: "開いていた窓", img: "window",
    stages: ["音楽室の窓。発見のとき、こぶしひとつぶん開いていた。窓の下の床は、吹きこんだ雨で濡れている。外は3階の壁で、足をかけられるものは何もない。"],
  },
  envelope: {
    name: "銀行の封筒", img: "envelope",
    stages: [
      "琴音のカバンの内ポケットにあった、銀行の封筒。封は閉じられているが、お札が透けて見える。一万円札が4枚と、千円札が2枚。――42,000円。",
      "琴音の封筒。中身は42,000円と、きのうの日付の払い戻しの控え、そして一筆箋。琴音は自分の貯金で、帳簿の穴を埋めるつもりだった。",
    ],
    docStage: 1,
    doc: `<div class="paper receipt"><div class="p-h">お払戻し 控え</div><p>10月9日　普通預金<br>シラセ　コトネ 様</p><p class="sum">42,000 円</p><p class="hand">足りないぶんです。<br>帳簿は、本当の数字に<br>直してください。<br>だれのせいでもありません。<br>　　　　　　　　白瀬</p></div>`,
  },
  cashbox: {
    name: "クラス費の金庫", img: "cashbox",
    stages: ["職員室にある、桜霞祭のクラス費を入れる手提げ金庫。鍵は担任の真壁先生が預かり、現金の出し入れも先生がおこなう。会計係は帳簿をつけるだけで、現金には触れない。"],
  },
  catfood: {
    name: "空の猫缶", img: "catfood",
    stages: ["体育館裏、倉庫の軒下にあった猫用の缶詰。中身はまだ乾いていない。今日の夕方、誰かがここで野良猫に餌をやっていた。"],
  },
  letter: {
    name: "大河の手紙", img: "letter",
    stages: ["大河が体育倉庫で書いていた、琴音への謝罪の手紙。「昼は怒鳴って悪かった。話したくなったら聞くから」。くしゃくしゃの書き損じが何枚もあった。"],
  },
  flashlight: {
    name: "懐中電灯", img: "flashlight", tool: true,
    stages: ["廊下の防災ボックスにあった懐中電灯。暗い場所を調べるときに自動で使う。"],
  },
  uvlight: {
    name: "ブラックライト", img: "uvlight", tool: true,
    stages: [
      "科学部の展示『光るひみつ』で使うブラックライト。蛍光塗料を光らせる。……電池が入っていない。",
      "電池を入れたブラックライト。画面右上の《UV》ボタンで、その場を照らせる。",
    ],
    use: { tool: "battery", label: "電池を入れる", scene: "use_battery" },
  },
  battery: {
    name: "単3電池", img: "battery", tool: true,
    stages: ["お化け屋敷用のランタンから借りた単3電池2本。"],
  },
  pencil: {
    name: "デッサン用の鉛筆", img: "pencil", tool: true,
    stages: ["美術室にあった4Bの鉛筆。芯がやわらかく、紙の上をなでるように塗れる。"],
  },
};

/* ---------------------------------------------------------------- 証言 */
const TESTI = {
  t_uta_piano: { who: "uta", name: "17:30のピアノ", text: "17:30ちょうど、真上の音楽室から『夕凪のワルツ』が聞こえた。ミスがひとつもない、完璧な演奏だった。" },
  t_uta_string: { who: "uta", name: "切れた弦", text: "今朝の1時間目、音楽の授業中にピアノの《ラ》の弦が切れた。それ以来、あのピアノのラは鳴らない。" },
  t_marika_piano: { who: "marika", name: "階段で聞いたピアノ", text: "17:30ごろ、旧校舎の階段でピアノの音を聞いた。琴音の姿は見ていない。" },
  t_rena_alibi: { who: "rena", name: "玲奈の17時のアリバイ", text: "17時前後は2階の図書室で、ひとりで去年の会計資料を調べていた。17:15に職員室へ行き、そのあとは教室にいた。" },
  t_makabe_att: { who: "makabe", name: "音楽室の音量つまみ", text: "音楽室の放送スピーカーは、授業のじゃまになるので音量つまみを《いつも切って》ある。" },
  t_makabe_rena: { who: "makabe", name: "帳簿を受け取った時刻", text: "氷室が帳簿を出しに来たのは17:15ごろ。いつもどおり落ち着いていた。" },
  t_makabe_where: { who: "makabe", name: "先生の17時台", text: "17時から18時まで、職員室で提出物を受け付けていた。席を外したのは、悲鳴を聞いたときだけ。" },
  t_ren_usb: { who: "ren", name: "USBのありか", text: "琴音の録音が入ったUSBの場所を知っているのは、放送部員と、実行委員の白瀬・氷室だけ。" },
  t_ren_lock: { who: "ren", name: "タイマーの管理コード", text: "予約の登録には管理コードが要る。知っているのは部長の黒瀬と顧問だけ。ただ、実行委員との打ち合わせのとき、目の前で打ったことはある。" },
  t_uta_makabe: { who: "uta", name: "階段ですれちがった先生", text: "17:25、楽器庫へ下りる途中、旧校舎の階段で真壁先生とすれちがった。「白瀬は集中している。18時までは、そっとしておいてあげなさい」と言われた。" },
  t_koga_window: { who: "koga", name: "16:50の戸締まり", text: "16:50、旧校舎の窓を閉めて回った。音楽室の窓も閉め、ねじ式の鍵までかけた。そのとき琴音はピアノの前に座っていた。" },
  t_koga_rena: { who: "koga", name: "17:05に見た玲奈", text: "17:05ごろ、本校舎1階の廊下で、職員室へ駆けこむ氷室を見た。顔はまっ青で、右手を握りしめていた。" },
  t_ren_away: { who: "ren", name: "空いていた放送室", text: "16:55〜17:20のあいだ、放送室を空けていた。鍵はかけていない。戻ったとき、機材に変わった様子はなかった。" },
  t_taiga_cat: { who: "taiga", name: "17時の目撃", text: "17時のチャイムが鳴ったとき、体育倉庫の窓から、黒瀬が野良猫に餌をやっているのを見た。" },
  t_taiga_ledger: { who: "taiga", name: "昼の口論の理由", text: "琴音は《帳簿》のことで悩んでいた。「委員長に悪いから」と言って、何も話してくれなかった。" },
  t_marika_paint: { who: "marika", name: "こぼれた蓄光塗料", text: "16時ごろ美術室で、委員長が蓄光塗料の缶を倒して右手と袖を汚した。あの塗料に触ったのは委員長だけ。" },
};

/* ---------------------------------------------------------------- 推理（ふたつの手がかりを結ぶ） */
const DEDUCT = {
  d_recording: {
    name: "17:30の演奏は生演奏ではない",
    text: "弦の切れたピアノで「完璧な演奏」はできない。17:30に聞こえた『夕凪のワルツ』は、音楽室のピアノで弾かれたものではない。",
    pairs: [["strings", "t_uta_piano"], ["repairmemo", "t_uta_piano"], ["t_uta_string", "t_uta_piano"], ["score", "t_uta_piano"],
            ["strings", "t_marika_piano"], ["t_uta_string", "t_marika_piano"]],
  },
  d_pa: {
    name: "演奏は放送で流された録音",
    text: "いつも切ってあるはずの音量つまみは最大。タイマーには17:30、音楽室だけに音源を流す予約。あの演奏は、天井のスピーカーから流れた録音だった。",
    pairs: [["speaker", "timer"], ["t_makabe_att", "timer"], ["d_recording", "timer"], ["usb", "speaker"], ["d_recording", "usb"], ["d_recording", "speaker"]],
  },
  d_time: {
    name: "本当の犯行時刻は17:03",
    text: "17:30に琴音が生きていたという前提は崩れた。壊れた腕時計が止まった《17時03分》こそ、本当の犯行時刻。17:30以降のアリバイには、もう意味がない。",
    pairs: [["watch", "d_recording"], ["watch", "d_pa"], ["watch", "timer"], ["watch", "phone"]],
  },
  d_window: {
    name: "窓は、あとから開けられた",
    text: "16:50に古賀さんが閉めて鍵までかけた窓が、発見のときには開いていた。外は3階の壁で、出入りはできない。誰かが内側から開けて、《外から入った者がいる》ように見せようとした。",
    pairs: [["window", "t_koga_window"]],
  },
  d_alibi2: {
    name: "大河と黒瀬は、たがいのアリバイの証人",
    text: "17時のチャイムのとき、黒瀬は体育館裏で猫に餌をやり、大河はそれを倉庫の窓から見ていた。17:03に旧校舎の3階にいることは、どちらにもできない。",
    pairs: [["t_taiga_cat", "t_ren_away"], ["catfood", "t_ren_away"], ["t_taiga_cat", "catfood"]],
  },
  d_lie: {
    name: "玲奈の17時のアリバイは嘘",
    text: "図書室は16:30に閉まり、鍵もかかっていた。「17時前後は図書室にいた」という玲奈の証言は成り立たない。",
    pairs: [["t_rena_alibi", "notice"], ["t_rena_alibi", "keylog"]],
  },
  d_gap: {
    name: "職員室に着いた時刻が合わない",
    text: "古賀さんは17:05に、職員室へ駆けこむ玲奈を見た。真壁先生は「17:15、落ち着いていた」と言う。10分の差と、正反対の様子。どちらかの記憶ちがい……なのだろうか。",
    pairs: [["t_koga_rena", "t_makabe_rena"]],
  },
  d_motive: {
    name: "帳簿は書き換えられている",
    text: "領収書の合計は186,400円。帳簿は228,400円。差額の42,000円が消えている。帳簿をつけていたのは会計係の玲奈で、琴音はそれに気づいていた。",
    pairs: [["ledger", "receipt"], ["ledger", "t_taiga_ledger"], ["ledger", "planner"]],
  },
  d_paint: {
    name: "蛍光の跡は、玲奈につながる",
    text: "タイマーのボタンとトロフィーに残った蛍光の跡。蓄光塗料に素手で触れたのは、16時に缶を倒した玲奈ただひとり。",
    pairs: [["fingerprint", "t_marika_paint"], ["trophy", "t_marika_paint"]],
  },
};
const DEDUCT_ORDER = ["d_recording", "d_pa", "d_time", "d_window", "d_alibi2", "d_lie", "d_gap", "d_motive", "d_paint"];

/* ---------------------------------------------------------------- 謎（推理ボードに出す問い） */
const MYSTERIES = [
  { id: "m1", q: "弦の切れたピアノから、なぜ「完璧な演奏」が聞こえたのか？", show: "strings|t_uta_piano|t_uta_string", solved: "d_recording", tip: "ピアノの状態と、演奏を聞いた人の証言を結ぼう。" },
  { id: "m2", q: "では、あの演奏はどこから聞こえてきたのか？", show: "d_recording", solved: "d_pa", tip: "音楽室で音が出るものは、ピアノのほかに何がある？ それを動かす機械は？" },
  { id: "m3", q: "琴音が襲われた、本当の時刻は？", show: "d_recording", solved: "d_time", tip: "「止まった時間」を示す物と、崩れた前提を結ぼう。" },
  { id: "m4", q: "17時ごろ、大河と黒瀬はどこにいたのか？", show: "d_time", solved: "d_alibi2", tip: "ふたりとも何かを隠している。体育館の裏を調べよう。" },
  { id: "m5", q: "17時のアリバイで、嘘をついているのは誰か？", show: "d_time", solved: "d_lie", tip: "それぞれが「いた」と言った場所を、自分の目で確かめよう。" },
  { id: "m6", q: "タイマーに予約を入れたのは誰か？", show: "d_pa", solved: "d_paint", tip: "見えない痕跡を《光》であぶり出そう。その痕跡を残せるのは誰？" },
  { id: "m7", q: "琴音は、なぜ襲われなければならなかったのか？", show: "t_taiga_ledger|receipt|ledger", solved: "d_motive", tip: "琴音が調べていたものと、提出された記録を見比べよう。" },
  { id: "m8", q: "閉めたはずの窓は、なぜ開いていたのか？", show: "window", solved: "d_window", tip: "戸締まりのことなら、あの人がくわしい。" },
  { id: "m9", q: "玲奈が職員室に着いたのは、何時だったのか？", show: "t_koga_rena|t_makabe_rena", solved: "d_gap", tip: "ふたりの大人の話を、ならべてみよう。" },
];

/* ---------------------------------------------------------------- 場所
   hs: x,y,w,h は背景に対する％。uv:true はブラックライト点灯中だけ出る。c: 出す条件 */
const LOCS = {
  classroom: {
    name: "2年B組の教室", sub: "本校舎 2F", bg: "classroom", map: [250, 250],
    chars: [{ id: "rena", x: 27 }, { id: "marika", x: 77 }],
    hs: [
      { id: "kdesk", label: "琴音の机", x: 49, y: 58, w: 8, h: 12 },
      { id: "lantern", label: "小道具の箱", x: 50, y: 29, w: 8, h: 12 },
      { id: "blackboard", label: "黒板", x: 6, y: 24, w: 8, h: 12 },
      { id: "props", label: "お化け屋敷の小道具", x: 58, y: 21, w: 8, h: 12 },
    ],
  },
  hallway: {
    name: "2階の廊下", sub: "本校舎 2F", bg: "hallway", map: [250, 340],
    chars: [],
    hs: [
      { id: "bousai", label: "防災ボックス", x: 11, y: 46, w: 8, h: 12 },
      { id: "board", label: "掲示板", x: 1, y: 28, w: 8, h: 12 },
      { id: "hwindow", label: "窓の外", x: 89, y: 34, w: 8, h: 12 },
    ],
  },
  library: {
    name: "図書室前", sub: "本校舎 2F", bg: "library", map: [110, 340],
    chars: [],
    hs: [
      { id: "notice", label: "扉の貼り紙", x: 55, y: 30, w: 8, h: 12 },
      { id: "libdoor", label: "図書室の扉", x: 56, y: 58, w: 8, h: 12 },
    ],
  },
  broadcast: {
    name: "放送室", sub: "本校舎 2F", bg: "broadcast", map: [390, 340],
    chars: [{ id: "ren", x: 52 }],
    hs: [
      { id: "ptimer", label: "プログラムタイマー", x: 21, y: 58, w: 8, h: 12 },
      { id: "drawer", label: "機材の引き出し", x: 84, y: 70, w: 8, h: 12 },
      { id: "mixer", label: "ミキサー卓", x: 8, y: 70, w: 8, h: 12 },
      { id: "uvpanel", label: "ボタンの光る跡", x: 21, y: 58, w: 8, h: 12, uv: true },
    ],
  },
  staff: {
    name: "職員室", sub: "本校舎 1F", bg: "staff", map: [250, 430],
    chars: [{ id: "makabe", x: 28 }],
    hs: [
      { id: "sboard", label: "連絡ボード", x: 55, y: 42, w: 8, h: 12 },
      { id: "keybox", label: "鍵の貸出簿", x: 90, y: 44, w: 8, h: 12 },
      { id: "sdesk", label: "真壁先生の机", x: 36, y: 74, w: 8, h: 12 },
      { id: "cashbox", label: "手提げ金庫", x: 73, y: 62, w: 8, h: 12 },
      { id: "uvledger", label: "帳簿の光る跡", x: 36, y: 74, w: 8, h: 12, uv: true, c: "ledger" },
    ],
  },
  science: {
    name: "科学室", sub: "本校舎 3F", bg: "science", map: [180, 160],
    chars: [],
    hs: [
      { id: "exhibit", label: "科学部の展示台", x: 24, y: 56, w: 8, h: 12 },
      { id: "poster", label: "展示ポスター", x: 68, y: 16, w: 8, h: 12 },
      { id: "model", label: "薬品棚", x: 38, y: 39, w: 8, h: 12 },
    ],
  },
  art: {
    name: "美術室", sub: "本校舎 3F", bg: "art", map: [330, 160],
    chars: [],
    hs: [
      { id: "signboard", label: "お化け屋敷の看板", x: 21, y: 44, w: 8, h: 12 },
      { id: "paintcan", label: "塗料の缶", x: 73, y: 62, w: 8, h: 12 },
      { id: "pencils", label: "鉛筆立て", x: 8, y: 56, w: 8, h: 12 },
      { id: "uvfloor", label: "床の光る跡", x: 36, y: 82, w: 8, h: 12, uv: true },
      { id: "uvsink", label: "机のふちの光る跡", x: 53, y: 59, w: 8, h: 12, uv: true },
    ],
  },
  walkway: {
    name: "渡り廊下", sub: "本校舎 ⇔ 旧校舎", bg: "walkway", map: [560, 340],
    chars: [{ id: "koga", x: 30 }],
    hs: [
      { id: "oldwin", label: "旧校舎3階の窓", x: 88, y: 39, w: 8, h: 12 },
      { id: "puddle", label: "吹きこむ雨", x: 46, y: 74, w: 8, h: 12 },
    ],
  },
  gymback: {
    name: "体育館裏", sub: "屋外", bg: "gymback", map: [560, 470],
    chars: [{ id: "taiga", x: 32 }],
    hs: [
      { id: "catcan", label: "軒下の缶", x: 70, y: 75, w: 8, h: 12 },
      { id: "shedwin", label: "体育倉庫の窓", x: 53, y: 60, w: 8, h: 12 },
      { id: "cat", label: "茂みの奥", x: 0, y: 76, w: 8, h: 12 },
    ],
  },
  stairs: {
    name: "旧校舎の階段", sub: "旧校舎 2F", bg: "stairs", map: [790, 340],
    chars: [{ id: "uta", x: 64 }],
    hs: [
      { id: "storage", label: "楽器庫の扉", x: 30, y: 36, w: 8, h: 12 },
      { id: "swindow", label: "踊り場の窓", x: 81, y: 22, w: 8, h: 12 },
      { id: "bandboard", label: "吹奏楽部の掲示", x: 12, y: 22, w: 8, h: 12 },
    ],
  },
  music: {
    name: "音楽室", sub: "旧校舎 3F", bg: "music", map: [790, 210],
    chars: [],
    hs: [
      { id: "body", label: "白い布", x: 64, y: 75, w: 8, h: 12 },
      { id: "piano", label: "ピアノの鍵盤", x: 20, y: 62, w: 8, h: 12 },
      { id: "mscore", label: "譜面台", x: 27, y: 51, w: 8, h: 12 },
      { id: "mphone", label: "ピアノの上のスマホ", x: 48, y: 58, w: 8, h: 12 },
      { id: "under", label: "ピアノの下", x: 38, y: 76, w: 8, h: 12 },
      { id: "mtrophy", label: "床のトロフィー", x: 79, y: 74, w: 8, h: 12 },
      { id: "bag", label: "琴音のカバン", x: 20, y: 77, w: 8, h: 12 },
      { id: "atten", label: "壁の音量つまみ", x: 16, y: 48, w: 8, h: 12 },
      { id: "mspeaker", label: "天井のスピーカー", x: 58, y: 8, w: 8, h: 12 },
      { id: "mwindow", label: "開いた窓", x: 66, y: 38, w: 8, h: 12 },
      { id: "uvtrophy", label: "トロフィーの光る跡", x: 79, y: 74, w: 8, h: 12, uv: true },
    ],
  },
};
const MAP_BLOCKS = [
  { name: "本校舎", x: 40, y: 100, w: 440, h: 390 },
  { name: "屋外", x: 500, y: 280, w: 130, h: 250 },
  { name: "旧校舎", x: 690, y: 140, w: 210, h: 270 },
];
const MAP_LINKS = [["science", "art"], ["classroom", "hallway"], ["library", "hallway"], ["hallway", "broadcast"], ["hallway", "staff"],
  ["art", "classroom"], ["broadcast", "walkway"], ["walkway", "stairs"], ["walkway", "gymback"], ["stairs", "music"]];

/* ---------------------------------------------------------------- 人物相関図 */
const REL_NODES = {
  kotone: [450, 210], uta: [170, 90], taiga: [730, 90], rena: [150, 330], ren: [750, 330],
  marika: [600, 440], makabe: [300, 440], koga: [72, 210], me: [450, 30],
};
const REL_EDGES = [
  { a: "uta", b: "kotone", text: "親友", c: "" },
  { a: "taiga", b: "kotone", text: "昼に口論", c: "", up: [{ c: "t_taiga_ledger", text: "心配していた" }, { c: "letter", text: "謝りたかった" }] },
  { a: "rena", b: "kotone", text: "実行委員の相棒", c: "", up: [{ c: "d_motive", text: "帳簿の秘密を知られた" }] },
  { a: "ren", b: "kotone", text: "？", c: "", up: [{ c: "know_rec", text: "演奏を録音した" }] },
  { a: "marika", b: "kotone", text: "クラスの友人", c: "" },
  { a: "makabe", b: "kotone", text: "担任", c: "", up: [{ c: "s_kotone", text: "相談を受けるはずだった" }] },
  { a: "marika", b: "taiga", text: "片想い", c: "rel_marika_taiga", t: 0.22 },
  { a: "taiga", b: "ren", text: "犬猿の仲", c: "ch1", up: [{ c: "d_alibi2", text: "たがいのアリバイの証人" }] },
  { a: "rena", b: "marika", text: "塗料の件を口止め", c: "t_marika_paint", t: 0.64 },
  { a: "me", b: "kotone", text: "クラスメイト", c: "" },
  { a: "koga", b: "kotone", text: "戸締まりで最後に見た", c: "t_koga_window", t: 0.36 },
  { a: "makabe", b: "rena", text: "担任と委員長", c: "", up: [{ c: "d_gap", text: "話が食いちがう" }, { c: "ending", text: "たがいを、かばった" }] },
];

/* ---------------------------------------------------------------- 時系列（アリバイ表） */
const TL_COLS = ["16:00ごろ", "17:00ごろ", "17:30ごろ", "18:10"];
const TL_ROWS = [
  { id: "kotone", cells: [
    [{ c: "keylog", t: "16:35 音楽室の鍵を借りる" }],
    [{ c: "planner_rubbed", t: "音楽室で玲奈と会う約束" }, { c: "d_time", t: "17:03 襲われる", k: "bad" }],
    [{ c: "ch1", t: "ピアノを弾いていた？", k: "q" }, { c: "d_recording", t: "演奏は録音だった", k: "bad" }],
    [{ c: "ch1", t: "音楽室で発見される", k: "bad" }]] },
  { id: "rena", cells: [
    [{ c: "t_marika_paint", t: "美術室で塗料をこぼす" }],
    [{ c: "t_rena_alibi", t: "図書室で調べもの（ひとり）", k: "q" }, { c: "d_lie", t: "図書室は閉まっていた", k: "bad" }, { c: "t_koga_rena", t: "17:05 職員室へ駆けこむ（古賀）" }, { c: "t_makabe_rena", t: "17:15 帳簿を提出（真壁）" }],
    [{ c: "ch1", t: "教室（全員が証人）", k: "ok" }],
    [{ c: "ch1", t: "教室", k: "ok" }]] },
  { id: "uta", cells: [
    [],
    [{ c: "u_alibi17", t: "パート練習（部員5人）", k: "ok" }],
    [{ c: "t_uta_piano", t: "楽器庫でピアノを聞く" }],
    [{ c: "ch1", t: "琴音を発見" }]] },
  { id: "marika", cells: [
    [{ c: "t_marika_paint", t: "美術室で看板の絵" }],
    [{ c: "m_alibi17", t: "体育館でリハ（部員全員）", k: "ok" }],
    [{ c: "t_marika_piano", t: "旧校舎の階段でピアノを聞く" }],
    [{ c: "ch1", t: "教室", k: "ok" }]] },
  { id: "taiga", cells: [
    [{ c: "keylog", t: "15:40 体育倉庫の鍵を借りる" }],
    [{ c: "t_taiga_cat", t: "体育倉庫。窓から黒瀬を見た", k: "ok" }],
    [{ c: "ch1", t: "体育倉庫（ひとり）", k: "q" }],
    [{ c: "ch1", t: "体育倉庫（ひとり）", k: "q" }]] },
  { id: "ren", cells: [
    [{ c: "keylog", t: "15:20 放送室の鍵を借りる" }],
    [{ c: "t_ren_away", t: "16:55〜17:20 放送室を空ける", k: "q" }, { c: "ren_cat", t: "体育館裏で猫に餌", k: "ok" }],
    [{ c: "ch1", t: "放送室（ひとり）", k: "q" }],
    [{ c: "ch1", t: "放送室（ひとり）", k: "q" }]] },
  { id: "makabe", cells: [
    [],
    [{ c: "t_makabe_where", t: "職員室で提出物の受け付け", k: "q" }],
    [{ c: "t_uta_makabe", t: "17:25 旧校舎の階段（詩が会う）" }],
    [{ c: "ch1", t: "悲鳴を聞いて音楽室へ" }]] },
  { id: "koga", cells: [
    [{ c: "t_koga_window", t: "16:50 旧校舎の窓を閉める" }],
    [{ c: "t_koga_rena", t: "本校舎1階にモップがけ", k: "q" }],
    [],
    []] },
];

/* ---------------------------------------------------------------- 再現（校内図の上で、時刻ごとの居場所を見る）
   RC_SEG：人ごとの [はじめ, おわり, 場所, 出す条件, 種類, 説明]。下に書いたものほど優先。
   種類：ok＝裏づけあり／say＝本人（または一人）の話だけ／q＝疑わしい／lie＝居場所不明／dead／true＝最後に判明した事実 */
const RC_T0 = 16 * 60 + 30, RC_T1 = 18 * 60 + 10;
const RC_BLOCKS = [["本校舎", 8, 8, 302, 292], ["屋外", 324, 108, 110, 224], ["旧校舎", 448, 56, 184, 178]];
const RC_SPOTS = {
  science: [84, 60, "科学室"], art: [232, 60, "美術室"], classroom: [158, 128, "2-B 教室"],
  library: [60, 196, "図書室"], hallway: [159, 196, "2階の廊下"], broadcast: [258, 196, "放送室"], staff: [159, 264, "職員室・1階"],
  walkway: [379, 168, "渡り廊下"], gymback: [379, 236, "体育倉庫・裏"], gym: [379, 304, "体育館"],
  music: [540, 104, "音楽室"], stairs: [540, 196, "旧校舎の階段"],
};
const RC_LINKS = [["science", "art"], ["art", "classroom"], ["classroom", "hallway"], ["library", "hallway"], ["hallway", "broadcast"], ["hallway", "staff"],
  ["broadcast", "walkway"], ["walkway", "stairs"], ["walkway", "gymback"], ["gymback", "gym"], ["stairs", "music"]];
const RC_WHO = [["kotone", "琴"], ["rena", "玲"], ["uta", "詩"], ["marika", "茉"], ["taiga", "大"], ["ren", "黒"], ["makabe", "真"], ["koga", "古"], ["me", "僕"]];
const RC_SEG = {
  kotone: [
    ["16:35", "16:40", "staff", "keylog", "ok", "職員室で、音楽室の鍵を借りた。"],
    ["16:40", "18:11", "music", "ch1", "say", "音楽室でピアノの練習。17:30に演奏が聞こえた。"],
    ["16:45", "16:55", "music", "t_koga_window", "ok", "ピアノの前に座っていた（古賀さんが見ている）。"],
    ["17:00", "18:11", "music", "d_recording&!d_time", "q", "17:30の演奏は、このピアノの音ではなかった。では、いつまで弾いていた？"],
    ["16:58", "17:03", "music", "act2|ending", "true", "玲奈と会う。「一緒に、先生に話そう」"],
    ["17:03", "18:11", "music", "d_time", "dead", "17:03。ここで襲われ、倒れた。"],
  ],
  rena: [
    ["16:30", "17:15", "library", "t_rena_alibi", "say", "図書室でひとり、去年の会計資料を調べていた（本人の話）。"],
    ["16:30", "17:15", null, "d_lie", "lie", "図書室は16:30に閉まっていた。本当は、どこにいた？"],
    ["17:05", "17:08", "staff", "t_koga_rena", "ok", "まっ青な顔で、職員室へ駆けこんだ（古賀さんが見た）。"],
    ["17:15", "17:20", "staff", "t_makabe_rena", "say", "落ち着いた様子で帳簿を出しに来た（真壁先生の話）。"],
    ["17:25", "18:11", "classroom", "ch1", "ok", "教室。クラスのみんなが見ている。"],
    ["16:58", "17:04", "music", "act2|ending", "true", "琴音と会う。17:03、トロフィーを握っていた。"],
    ["17:04", "17:05", "stairs", "act2|ending", "true", "旧校舎を駆けおりる。"],
    ["17:05", "17:12", "staff", "act2|ending", "true", "「先生、私、白瀬さんを」"],
    ["17:12", "17:25", "classroom", "act2|ending", "true", "先生に言われて、教室へ戻る。"],
  ],
  uta: [
    ["16:40", "17:25", "stairs", "u_alibi17", "ok", "旧校舎2階でパート練習。部員5人が一緒だった。"],
    ["17:25", "17:45", "stairs", "t_uta_piano", "say", "楽器庫。17:30、真上の音楽室からピアノが聞こえた。"],
    ["17:45", "18:07", "classroom", "ch1", "ok", "教室に戻っていた。"],
    ["18:07", "18:11", "music", "ch1", "ok", "琴音を呼びに行き、見つけた。"],
  ],
  marika: [
    ["16:30", "17:20", "gym", "m_alibi17", "ok", "体育館のステージでリハーサル。演劇部の全員が証人。"],
    ["17:25", "17:35", "stairs", "t_marika_piano", "say", "旧校舎の階段で、ピアノの音を聞いた。"],
    ["17:40", "18:11", "classroom", "ch1", "ok", "教室。"],
  ],
  taiga: [
    ["16:30", "18:11", "gymback", "ch1", "say", "体育倉庫にひとりでこもっていた（本人の話）。"],
    ["16:55", "17:10", "gymback", "d_alibi2", "ok", "倉庫の窓から黒瀬を見ていた。黒瀬のほうからも、裏づけがとれる。"],
  ],
  ren: [
    ["16:30", "18:11", "broadcast", "ch1", "say", "放送室にひとりでいた（本人の話）。"],
    ["16:55", "17:20", null, "t_ren_away", "lie", "放送室を空けていた。鍵はかけていない。行き先は……。"],
    ["16:55", "17:20", "gymback", "ren_cat", "say", "体育館の裏で、野良猫に餌をやっていた。"],
    ["16:55", "17:10", "gymback", "d_alibi2", "ok", "猫に餌をやっていた。大河が倉庫の窓から見ている。"],
  ],
  makabe: [
    ["17:00", "18:08", "staff", "t_makabe_where", "say", "職員室で提出物を受け付けていた（本人の話）。"],
    ["17:23", "17:27", "stairs", "t_uta_makabe", "ok", "旧校舎の階段で、詩とすれちがった。"],
    ["18:08", "18:11", "music", "ch1", "ok", "悲鳴を聞いて、音楽室へ駆けつけた。"],
    ["17:05", "17:09", "staff", "ending", "true", "玲奈の告白を聞く。「17:30に、必ずみんなの前にいなさい」"],
    ["17:09", "17:13", "broadcast", "ending", "true", "17:11、タイマーに予約を入れる。"],
    ["17:13", "17:16", "walkway", "ending", "true", "旧校舎へ向かう。"],
    ["17:16", "17:23", "music", "ending", "true", "音量を上げ、手帳のページを破り、窓を開けた。"],
    ["17:23", "17:27", "stairs", "ending", "true", "詩に「18時までは、そっとしておいてあげなさい」"],
    ["17:27", "18:08", "staff", "ending", "true", "職員室へ戻る。"],
  ],
  koga: [
    ["16:45", "16:55", "music", "t_koga_window", "say", "旧校舎の窓を閉めて回った。音楽室の窓には、鍵までかけた。"],
    ["17:00", "17:15", "staff", "t_koga_rena", "say", "本校舎1階の廊下に、モップをかけていた。"],
  ],
  me: [
    ["16:30", "17:20", "classroom", "ch1", "ok", "ひよりと一緒に、教室でお化け屋敷の準備。"],
    ["17:20", "17:38", "walkway", "ch1", "ok", "ひよりと暗幕を運んでいた。17:30、ここでピアノを聞いた。"],
    ["17:38", "18:10", "classroom", "ch1", "ok", "教室で暗幕を張っていた。"],
    ["18:10", "18:11", "music", "ch1", "ok", "悲鳴を聞いて、音楽室へ。"],
  ],
};
/* その時刻の出来事：[時刻, 出す条件, 短い名前, 説明] */
const RC_EVENTS = [
  ["17:00", "ch1", "チャイム", "17時のチャイムが鳴る。"],
  ["17:03", "watch", "腕時計", "琴音の腕時計は、この時刻で止まっている。"],
  ["17:06", "phone", "未読", "詩から琴音へメッセージ。読まれないまま残った。"],
  ["17:11", "timer", "予約", "放送室のタイマーに、予約が登録された。"],
  ["17:30", "ch1&!d_recording", "ワルツ", "音楽室から『夕凪のワルツ』が聞こえた。"],
  ["17:30", "d_recording&!d_pa", "ワルツ", "『夕凪のワルツ』が聞こえた。だが、あのピアノの音ではない。"],
  ["17:30", "d_pa", "ワルツ", "音楽室のスピーカーから、録音のワルツが流れた。"],
  ["18:00", "ch1", "チャイム", "18時のチャイムが鳴る。"],
  ["18:10", "ch1", "発見", "詩の悲鳴。音楽室で琴音が見つかる。"],
];
