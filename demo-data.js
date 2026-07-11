/* =====================================================================
   デモモード: バックエンド(/api/*)が見つからない時に、この内蔵データで
   全機能を動かすモックAPI。実バックエンドがあればそちらが優先される。
   ===================================================================== */

const DEMO_GROUPS = [
  {id:'g_all',   label:'全社'},
  {id:'g_exec',  label:'経営'},
  {id:'g_sales', label:'営業'},
  {id:'g_dev',   label:'開発'},
  {id:'g_hr',    label:'人事・労務'},
];

const DEMO_USERS = [
  {id:'u_kido',     name:'木戸 隆正',  title:'代表・PM',       username:'kido',     password:'demo', role:'admin',  groups:['g_all','g_exec','g_sales','g_dev','g_hr']},
  {id:'u_fukuda',   name:'福田 晟樹',  title:'開発エンジニア', username:'fukuda',   password:'demo', role:'member', groups:['g_all','g_dev']},
  {id:'u_matsuura', name:'松浦 正醐',  title:'開発エンジニア', username:'matsuura', password:'demo', role:'member', groups:['g_all','g_dev']},
  {id:'u_ninomiya', name:'二宮 石太郎',title:'営業',           username:'ninomiya', password:'demo', role:'member', groups:['g_all','g_sales']},
];

function demoDaysAgo(n, h, m){
  const d = new Date();
  d.setDate(d.getDate()-n);
  d.setHours(h??10, m??0, 0, 0);
  return d.toISOString();
}

let DEMO_DOCS = [
  {id:'d01', title:'就業規則.pdf',                       doc_type:'規程',   importance:'core',        acl:['g_all'],            source:'ローカル取込', chunks:14, size_bytes:482000, updated_at:demoDaysAgo(48),
    summary:'勤務時間・休日・服務規律などの基本規則。', content:'第1章 総則\n本規則は合同会社nerdechの従業員の就業条件を定める。\n勤務時間は9:30〜18:30（休憩1時間）。完全週休二日制（土日祝）。\n時間外勤務は事前申請制とする。'},
  {id:'d02', title:'給与規程.docx',                      doc_type:'規程',   importance:'core',        acl:['g_hr','g_exec'],    source:'Google Drive', chunks:9,  size_bytes:88000,  updated_at:demoDaysAgo(41),
    summary:'給与の締め日・支払日・各種手当の定め。', content:'給与の締め日は毎月末日とし、支払日は翌月25日（休日の場合は前営業日）に指定口座へ振り込む。\n通勤手当は月上限2万円。昇給は年1回（4月）。'},
  {id:'d03', title:'経費精算マニュアル.md',               doc_type:'規程',   importance:'reference',   acl:['g_all'],            source:'ローカル取込', chunks:5,  size_bytes:12000,  updated_at:demoDaysAgo(30),
    summary:'経費精算の申請方法と締切。', content:'経費は発生月の月末までに精算フォームで申請する。領収書の写真添付が必須。\n承認後、翌月の給与と合わせて振り込まれる。交通費はICカード履歴で代用可。'},
  {id:'d04', title:'顧客名簿.xlsx',                      doc_type:'営業',   importance:'core',        acl:['g_sales','g_exec'], source:'Google Drive', chunks:7,  size_bytes:64000,  updated_at:demoDaysAgo(6),
    summary:'取引先の担当者・連絡先一覧。', content:'ケアとーカー（担当:斎藤様）、クロノス（担当:田中様）、千歳開発（担当:佐藤様）ほか計12社の担当者・連絡先・取引状況を管理。'},
  {id:'d05', title:'単価表_2026.xlsx',                   doc_type:'経理',   importance:'core',        acl:['g_exec'],           source:'Google Drive', chunks:4,  size_bytes:31000,  updated_at:demoDaysAgo(20),
    summary:'開発・保守の標準単価表。', content:'受託開発の標準単価: エンジニア 80万円/人月。保守運用: 月額8万円〜。デザイン: 60万円/人月。値引きは代表承認が必要。'},
  {id:'d06', title:'見積書_ケアとーカー.pdf',             doc_type:'経理',   importance:'core',        acl:['g_sales','g_exec'], source:'ローカル取込', chunks:3,  size_bytes:210000, updated_at:demoDaysAgo(12),
    summary:'ケアとーカー案件の見積書。', content:'ケアとーカー様 御見積書\n初期開発費: 180万円（要件定義・設計・実装・テスト一式）\n月額保守: 8万円\n納期: 契約から3ヶ月。'},
  {id:'d07', title:'請求書_クロノス案件.pdf',             doc_type:'経理',   importance:'core',        acl:['g_exec'],           source:'ローカル取込', chunks:2,  size_bytes:150000, updated_at:demoDaysAgo(3),
    summary:'クロノス案件 2026年6月分の請求書。', content:'クロノス様 御請求書（2026年6月分）\nLP制作・保守費用: 24万円（税別）\n振込期限: 2026年7月末日。'},
  {id:'d08', title:'業務委託契約書_雛形.docx',            doc_type:'契約',   importance:'core',        acl:['g_exec','g_sales'], source:'Google Drive', chunks:11, size_bytes:97000,  updated_at:demoDaysAgo(60),
    summary:'受託案件で使う業務委託契約書のテンプレート。', content:'業務委託契約書（雛形）\n第1条（目的）乙は甲に対しソフトウェア開発業務を委託する。\n検収期間は納品後10営業日。知的財産権は検収完了時に甲へ移転。'},
  {id:'d09', title:'提案書_ケアとーカー.pptx',            doc_type:'営業',   importance:'deliverable', acl:['g_sales','g_exec'], source:'ローカル取込', chunks:8,  size_bytes:56000,  updated_at:demoDaysAgo(14),
    summary:'介護事業者向けシフト管理アプリの提案書。', content:'ケアとーカー様向け提案書。介護現場のシフト作成を自動化し、月20時間の管理業務を削減する提案。導入スケジュールと費用対効果を記載。'},
  {id:'d10', title:'要件定義書_社内ナレッジAI_v0.2.docx', doc_type:'開発',   importance:'core',        acl:['g_dev','g_exec'],   source:'ローカル取込', chunks:22, size_bytes:38700,  updated_at:demoDaysAgo(11),
    summary:'社内ナレッジ集約AIプラットフォームのMVP要件定義書。', content:'業務特化エージェント/権限継承RAG/セルフサーブ型。権限の壁: 質問者が閲覧権限を持つ資料のみから回答を生成する。F-01〜F-12の機能要件を定義。'},
  {id:'d11', title:'MVP開発タスク一覧.md',                doc_type:'開発',   importance:'deliverable', acl:['g_dev'],            source:'ローカル取込', chunks:4,  size_bytes:9000,   updated_at:demoDaysAgo(1),
    summary:'MVPの残タスクと担当割り。', content:'MVP残タスク:\n- F-04 差分同期のWebhook対応（松浦）\n- F-05 権限フィルタのテナント境界テスト（福田）\n- F-06 引用元リンクのUI仕上げ（福田）\n- DM/グループチャットUI（木戸レビュー待ち）'},
  {id:'d12', title:'API設計メモ.md',                     doc_type:'開発',   importance:'deliverable', acl:['g_dev'],            source:'ローカル取込', chunks:6,  size_bytes:15000,  updated_at:demoDaysAgo(4),
    summary:'ナレッジAIのAPIエンドポイント設計。', content:'POST /api/ask/stream: SSEで回答をストリーミング。meta→delta→doneの順にイベントを流す。\n全クエリにテナント境界とACLフィルタを強制する。'},
  {id:'d13', title:'議事録_2026-06-30_定例.md',           doc_type:'議事録', importance:'reference',   acl:['g_all'],            source:'ローカル取込', chunks:3,  size_bytes:7000,   updated_at:demoDaysAgo(11),
    summary:'6/30定例。MVPの範囲確定と役割分担。', content:'6/30 定例議事録\n- 要件定義書v0.2を確定\n- 入口は業務特化エージェント1本で行く\n- USB演出はプレゼン専用・非売品として扱う'},
  {id:'d14', title:'議事録_2026-07-07_MVPレビュー.md',    doc_type:'議事録', importance:'reference',   acl:['g_all'],            source:'ローカル取込', chunks:3,  size_bytes:8000,   updated_at:demoDaysAgo(4),
    summary:'7/7 MVPレビュー。権限の壁のデモが好評。', content:'7/7 MVPレビュー議事録\n- 権限フィルタ(F-05)のデモ実施。営業アカウントから経理資料が一切見えないことを確認\n- 次回はDM・グループチャットの統合デモ'},
  {id:'d15', title:'有給休暇申請フロー.md',               doc_type:'規程',   importance:'reference',   acl:['g_all'],            source:'ローカル取込', chunks:2,  size_bytes:4000,   updated_at:demoDaysAgo(25),
    summary:'有給休暇の申請手順。', content:'有給休暇は取得希望日の3営業日前までに申請フォームから申請する。承認者は直属の上長。半休は午前/午後の2区分。'},
  {id:'d16', title:'採用面接メモ_2026.docx',              doc_type:'人事',   importance:'reference',   acl:['g_hr','g_exec'],    source:'Google Drive', chunks:5,  size_bytes:22000,  updated_at:demoDaysAgo(8),
    summary:'2026年度採用の面接評価メモ。', content:'エンジニア採用の面接メモ。候補者3名の評価と所感。二次面接は代表同席で実施予定。'},
  {id:'d17', title:'保守運用手順書.md',                   doc_type:'開発',   importance:'deliverable', acl:['g_dev'],            source:'ローカル取込', chunks:7,  size_bytes:18000,  updated_at:demoDaysAgo(17),
    summary:'納品後の保守・障害対応の手順。', content:'障害発生時はまず影響範囲を特定し、顧客へ一次報告（30分以内）。復旧後に恒久対応と再発防止策をまとめて報告する。'},
  {id:'d18', title:'ヒアリングシート_雛形.docx',          doc_type:'営業',   importance:'deliverable', acl:['g_sales'],          source:'Google Drive', chunks:3,  size_bytes:14000,  updated_at:demoDaysAgo(33),
    summary:'新規案件ヒアリング用の質問テンプレート。', content:'新規案件ヒアリングシート。現状の課題・予算感・希望納期・意思決定者・既存システムの有無を確認する。'},
];

const DEMO_TEMPLATES_COMMON = [
  {label:'給与の締め日は？',        query:'給与の締め日はいつですか？'},
  {label:'有給休暇の申請方法は？',  query:'有給休暇の申請方法を教えてください'},
  {label:'経費精算の締切は？',      query:'経費精算の締切はいつですか？'},
];
const DEMO_TEMPLATES_BY_GROUP = {
  g_sales:[{label:'ケアとーカーの見積金額は？', query:'ケアとーカー案件の見積金額はいくらですか？'}],
  g_dev:  [{label:'MVPの残タスクは？',          query:'MVPの残タスクを教えて'}],
  g_exec: [{label:'開発の標準単価は？',          query:'受託開発の標準単価はいくら？'}],
};

/* 質問→回答のルール(デモ用の簡易RAG)。keysが全て含まれる質問に反応する */
const DEMO_QA = [
  {keys:['給与','締め'],       docIds:['d02'], answer:'給与の締め日は毎月末日です。支払日は翌月25日（休日の場合は前営業日）に指定口座へ振り込まれます。'},
  {keys:['給与'],              docIds:['d02'], answer:'給与規程によると、締め日は毎月末日・支払日は翌月25日です。通勤手当は月上限2万円、昇給は年1回（4月）です。'},
  {keys:['有給'],              docIds:['d15'], answer:'有給休暇は、取得希望日の3営業日前までに申請フォームから申請します。承認者は直属の上長で、半休（午前/午後）も取得できます。'},
  {keys:['経費'],              docIds:['d03'], answer:'経費は発生月の月末までに精算フォームで申請してください。領収書の写真添付が必須です。承認後、翌月の給与と合わせて振り込まれます。'},
  {keys:['見積','ケアとーカー'],docIds:['d06','d09'], answer:'ケアとーカー案件の見積は、初期開発費180万円（要件定義〜テスト一式）＋月額保守8万円です。納期は契約から3ヶ月とされています。'},
  {keys:['単価'],              docIds:['d05'], answer:'受託開発の標準単価はエンジニア80万円/人月、デザイン60万円/人月です。保守運用は月額8万円〜。値引きには代表承認が必要です。'},
  {keys:['残タスク'],          docIds:['d11'], answer:'MVPの残タスクは次の4件です。\n・F-04 差分同期のWebhook対応（松浦）\n・F-05 権限フィルタのテナント境界テスト（福田）\n・F-06 引用元リンクのUI仕上げ（福田）\n・DM/グループチャットUI（木戸レビュー待ち）'},
  {keys:['MVP','タスク'],      docIds:['d11'], answer:'MVPの残タスクは、F-04 差分同期のWebhook対応、F-05 権限フィルタのテスト、F-06 引用元リンクのUI仕上げ、DM/グループチャットUIのレビューです。'},
  {keys:['請求','クロノス'],   docIds:['d07'], answer:'クロノス案件の2026年6月分請求は、LP制作・保守費用24万円（税別）、振込期限は2026年7月末日です。'},
  {keys:['契約','検収'],       docIds:['d08'], answer:'業務委託契約書の雛形では、検収期間は納品後10営業日、知的財産権は検収完了時に発注者へ移転すると定めています。'},
  {keys:['勤務','時間'],       docIds:['d01'], answer:'勤務時間は9:30〜18:30（休憩1時間）です。完全週休二日制（土日祝）で、時間外勤務は事前申請制です。'},
  {keys:['障害'],              docIds:['d17'], answer:'障害発生時は、まず影響範囲を特定し30分以内に顧客へ一次報告します。復旧後に恒久対応と再発防止策をまとめて報告します。'},
  {keys:['顧客','担当'],       docIds:['d04'], answer:'顧客名簿には、ケアとーカー（斎藤様）、クロノス（田中様）、千歳開発（佐藤様）ほか計12社の担当者・連絡先が登録されています。'},
];

/* ---- 業務構造(AI推定の業務フロー) ---- */
const DEMO_STRUCTURE = {
  title:'受託開発の業務フロー',
  stages:[
    {id:'s1', name:'問い合わせ', health:'thin', doc_ids:['d18'], doc_titles:['ヒアリングシート_雛形.docx'],
      description:'新規の相談・引き合いを受け付ける工程。', note:'問い合わせの記録が雛形1件のみ。実際のやりとりの記録が残っていません。'},
    {id:'s2', name:'ヒアリング', health:'ok', doc_ids:['d18','d13'], doc_titles:['ヒアリングシート_雛形.docx','議事録_2026-06-30_定例.md'],
      description:'課題・予算・納期・意思決定者を確認する工程。'},
    {id:'s3', name:'見積', health:'ok', doc_ids:['d05','d06'], doc_titles:['単価表_2026.xlsx','見積書_ケアとーカー.pdf'],
      description:'単価表をもとに見積書を作成・提示する工程。'},
    {id:'s4', name:'契約', health:'thin', doc_ids:['d08'], doc_titles:['業務委託契約書_雛形.docx'],
      description:'契約書を締結する工程。', note:'雛形のみで、締結済み契約書の控えがナレッジに入っていません。'},
    {id:'s5', name:'制作', health:'ok', doc_ids:['d10','d11','d12'], doc_titles:['要件定義書_社内ナレッジAI_v0.2.docx','MVP開発タスク一覧.md','API設計メモ.md'],
      description:'要件定義・設計・実装を行う工程。'},
    {id:'s6', name:'検収', health:'gap', doc_ids:[], doc_titles:[],
      description:'納品物を顧客に確認してもらう工程。', note:'検収記録に該当する資料が見つかりません。検収書のテンプレートと控えの保存を推奨します。'},
    {id:'s7', name:'請求', health:'ok', doc_ids:['d07'], doc_titles:['請求書_クロノス案件.pdf'],
      description:'請求書を発行し入金を確認する工程。'},
    {id:'s8', name:'保守', health:'thin', doc_ids:['d17'], doc_titles:['保守運用手順書.md'],
      description:'納品後の保守・障害対応を行う工程。', note:'手順書はあるが、対応履歴が蓄積されていません。'},
  ],
  flows:[
    {from:'s1',to:'s2'},{from:'s2',to:'s3'},{from:'s3',to:'s4'},{from:'s4',to:'s5'},
    {from:'s5',to:'s6'},{from:'s6',to:'s7'},{from:'s7',to:'s8'},
  ],
};

/* ---- AI改善提案(管理者向け) ---- */
let DEMO_INSIGHTS = {
  created_at: demoDaysAgo(2, 15, 30),
  report:{
    summary:'検収と契約の記録が薄く、経理系ナレッジが経営グループに集中しています。まずは検収書テンプレートの整備と、給与・経費まわりのFAQ化を推奨します。',
    findings:[
      {category:'gap', title:'検収工程の記録が存在しない',
        detail:'業務フロー上の「検収」に対応する資料が1件もありません。トラブル時に検収完了を証明できないリスクがあります。',
        evidence_titles:['業務委託契約書_雛形.docx'], suggestion:'検収書のテンプレートを作成し、案件ごとに控えをナレッジDBへ保存する運用にしましょう。'},
      {category:'bottleneck', title:'経理資料が経営グループに集中',
        detail:'単価表・請求書などの経理系資料の閲覧権限が経営グループのみに設定されており、営業が見積時に単価を確認できず質問が繰り返されています。',
        evidence_titles:['単価表_2026.xlsx','請求書_クロノス案件.pdf'], suggestion:'単価表の閲覧権限に営業グループを追加するか、営業向けの単価早見資料を作成しましょう。'},
      {category:'duplication', title:'議事録の保存先が2系統',
        detail:'議事録がローカル取込とGoogle Driveの両方に散在し始めています。検索精度と更新漏れの原因になります。',
        evidence_titles:['議事録_2026-06-30_定例.md','議事録_2026-07-07_MVPレビュー.md'], suggestion:'議事録の保存先をどちらか1系統に統一し、命名規則（日付_件名）を固定しましょう。'},
      {category:'opportunity', title:'給与・経費の質問はFAQ化で削減できる',
        detail:'給与の締め日・経費精算の締切など、同じ質問が繰り返し聞かれています。',
        evidence_titles:['給与規程.docx','経費精算マニュアル.md'], suggestion:'頻出質問トップ5をまとめた「入社後よくある質問.md」を全社公開で作成しましょう。'},
    ],
  },
};

/* ---- メンバーAI定性分析 ---- */
let DEMO_MEMBER_ANALYSIS = {
  created_at: demoDaysAgo(2, 15, 40),
  analysis:{
    org_note:'質問の中心は労務・経理の基本ルールです。開発メンバーの質問が権限ブロックされる比率が高く、公開範囲の見直し余地があります。',
    members:[
      {user_id:'u_kido', name:'木戸 隆正', inferred_role:'経営・案件管理の中心',
        summary:'見積・請求・契約など案件のお金まわりの質問が中心。全資料にアクセスできるため未回答はほぼありません。',
        gaps:['検収・納品まわりの記録'], risks:['経理系ナレッジの属人化（本人しか把握していない）'],
        suggestion:'経理系資料の要約版を営業と共有すると、確認質問が減ります。'},
      {user_id:'u_fukuda', name:'福田 晟樹', inferred_role:'開発の実装担当',
        summary:'開発タスク・API設計の質問が中心。労務系（給与・経費）の質問で権限ブロックが発生しています。',
        gaps:['開発環境の構築手順書'], risks:['労務情報へアクセスできず総務への口頭確認が発生'],
        suggestion:'給与規程の公開範囲を全社にするか、要点のみのFAQを全社公開しましょう。'},
      {user_id:'u_matsuura', name:'松浦 正醐', inferred_role:'開発（同期・インフラ担当）',
        summary:'差分同期・障害対応の質問が中心。保守運用手順書をよく参照しています。',
        gaps:['過去の障害対応履歴'], risks:[], suggestion:'障害対応のたびに対応記録をナレッジへ残す運用を徹底しましょう。'},
      {user_id:'u_ninomiya', name:'二宮 石太郎', inferred_role:'営業・顧客窓口',
        summary:'見積・提案・顧客情報の質問が中心。単価表へアクセスできず見積作成時にブロックが発生しています。',
        gaps:['営業向けの単価早見資料'], risks:['単価を口頭確認しており誤った金額を提示するリスク'],
        suggestion:'単価表の閲覧権限に営業を追加するか、営業向け単価資料を整備しましょう。'},
    ],
  },
};

/* ---- 監査ログ(シード。ask実行のたびに追記される) ---- */
function demoSeedAudit(){
  const seed=[
    // [daysAgo, hour, userId, query, result('ok'|'blocked'|'gap'), citedDocIds]
    [13,10,'u_fukuda','有給休暇の申請方法を教えてください','ok',['d15']],
    [13,11,'u_ninomiya','ケアとーカーの担当者は誰？','ok',['d04']],
    [12,9, 'u_fukuda','給与の締め日はいつですか？','blocked',[]],
    [12,14,'u_matsuura','障害発生時の一次報告の期限は？','ok',['d17']],
    [11,10,'u_kido','クロノス案件の請求金額は？','ok',['d07']],
    [11,15,'u_ninomiya','受託開発の標準単価はいくら？','blocked',[]],
    [10,9, 'u_fukuda','経費精算の締切はいつですか？','ok',['d03']],
    [10,11,'u_matsuura','差分同期のAPI仕様は？','ok',['d12']],
    [9, 10,'u_ninomiya','ケアとーカー案件の見積金額はいくらですか？','ok',['d06','d09']],
    [9, 16,'u_fukuda','社用PCの購入申請はどうすればいい？','gap',[]],
    [8, 9, 'u_kido','検収期間は納品後何日？','ok',['d08']],
    [8, 13,'u_matsuura','経費精算の締切はいつですか？','ok',['d03']],
    [7, 10,'u_ninomiya','提案書の雛形はどこ？','ok',['d09','d18']],
    [7, 15,'u_fukuda','MVPの残タスクを教えて','ok',['d11']],
    [6, 9, 'u_kido','採用面接の候補者の評価は？','ok',['d16']],
    [6, 11,'u_ninomiya','単価の値引きは誰の承認が必要？','blocked',[]],
    [6, 17,'u_matsuura','リモートワークの規定はある？','gap',[]],
    [5, 10,'u_fukuda','勤務時間は何時から？','ok',['d01']],
    [5, 14,'u_kido','ケアとーカー案件の見積金額はいくらですか？','ok',['d06']],
    [4, 9, 'u_ninomiya','契約書の雛形をください','ok',['d08']],
    [4, 11,'u_fukuda','給与の締め日はいつですか？','blocked',[]],
    [4, 16,'u_matsuura','MVPの残タスクを教えて','ok',['d11']],
    [3, 10,'u_kido','6月の請求はいくら？','ok',['d07']],
    [3, 13,'u_ninomiya','慶弔休暇は何日もらえる？','gap',[]],
    [2, 9, 'u_fukuda','有給休暇の申請方法を教えてください','ok',['d15']],
    [2, 11,'u_matsuura','障害対応の再発防止はどうまとめる？','ok',['d17']],
    [2, 15,'u_ninomiya','ケアとーカーの提案のポイントは？','ok',['d09']],
    [1, 10,'u_kido','MVPレビューの結果は？','ok',['d14']],
    [1, 14,'u_fukuda','経費精算の締切はいつですか？','ok',['d03']],
    [1, 16,'u_ninomiya','給与の締め日はいつですか？','blocked',[]],
  ];
  return seed.map(([days,hour,uid,query,result,cited])=>{
    const u=DEMO_USERS.find(x=>x.id===uid);
    const vis=DEMO_DOCS.filter(d=>d.acl.some(g=>u.groups.includes(g))).length;
    return {
      at: demoDaysAgo(days, hour),
      user_id: uid, user_name: u.name,
      query, blocked: result==='blocked', gap: result==='gap',
      cited: cited.map(id=>{const d=DEMO_DOCS.find(x=>x.id===id); return d?d.title:id;}),
      cited_ids: cited.slice(),
      visible_docs: vis, total_docs: DEMO_DOCS.length,
    };
  });
}
let DEMO_AUDIT = demoSeedAudit();

/* ============== ここからモックAPIルーター ============== */

function demoVisibleDocs(user){
  return DEMO_DOCS.filter(d=>d.acl.some(g=>user.groups.includes(g)));
}
function demoAclLabel(acl){
  return acl.map(id=>{const g=DEMO_GROUPS.find(x=>x.id===id); return g?g.label:id;}).join('・');
}
function demoUserByToken(headers){
  const auth=(headers&&(headers.Authorization||headers.authorization))||'';
  const token=auth.replace(/^Bearer\s+/,'');
  if(!token.startsWith('demo-')) return null;
  return DEMO_USERS.find(u=>u.id===token.slice(5)) || null;
}
function demoTemplates(user){
  let t=DEMO_TEMPLATES_COMMON.slice();
  user.groups.forEach(g=>{ if(DEMO_TEMPLATES_BY_GROUP[g]) t=t.concat(DEMO_TEMPLATES_BY_GROUP[g]); });
  return t.slice(0,5);
}

/* デモの質問応答。回答/権限ブロック/資料なしを判定して監査ログにも記録する */
function demoAsk(query, user){
  const q=(query||'').toLowerCase();
  let hit=null;
  for(const rule of DEMO_QA){
    if(rule.keys.every(k=>q.includes(k.toLowerCase()))){ hit=rule; break; }
  }
  // ルールに当たらなければ、タイトル/要約/本文の部分一致で拾う
  let docs=[];
  if(hit){
    docs=hit.docIds.map(id=>DEMO_DOCS.find(d=>d.id===id)).filter(Boolean);
  }else{
    const tokens=q.split(/[\s、。・？?！!の は を に で と…]+/).filter(t=>t.length>=2);
    docs=DEMO_DOCS.filter(d=>tokens.some(t=>(d.title+d.summary+d.content).toLowerCase().includes(t)));
  }
  const visible=docs.filter(d=>d.acl.some(g=>user.groups.includes(g)));
  const visCount=demoVisibleDocs(user).length;

  let res;
  if(docs.length && !visible.length){
    res={blocked:true, gap:false, answer:'あなたの権限では、この質問に該当する社内資料を参照できません。', sources:[],
      user:{name:user.name,title:user.title}, visible_docs:visCount, total_docs:DEMO_DOCS.length};
  }else if(!docs.length){
    res={blocked:false, gap:true, answer:'該当する社内資料が見つかりませんでした。この質問は「ナレッジの穴」として記録され、管理コンソールのFAQ化候補に表示されます。', sources:[],
      visible_docs:visCount, total_docs:DEMO_DOCS.length};
  }else{
    const answer = hit ? hit.answer
      : `「${visible[0].title.replace(/(?:\.[A-Za-z0-9]{1,5}){1,3}$/,'')}」によると——\n${visible[0].content.split('\n')[0]}`;
    res={blocked:false, gap:false, answer,
      sources:visible.slice(0,3).map(d=>({doc_id:d.id, title:d.title, source:d.source, acl_label:demoAclLabel(d.acl)})),
      visible_docs:visCount, total_docs:DEMO_DOCS.length};
  }
  DEMO_AUDIT.push({
    at:new Date().toISOString(), user_id:user.id, user_name:user.name, query,
    blocked:res.blocked, gap:!!res.gap,
    cited:(res.sources||[]).map(s=>s.title), cited_ids:(res.sources||[]).map(s=>s.doc_id),
    visible_docs:visCount, total_docs:DEMO_DOCS.length,
  });
  return res;
}

/* 監査ログから集計(ダッシュボード・メンバー統計) */
function demoDailySeries(filterFn){
  const days=[];
  for(let i=13;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push({date:key, count:0, blocked:0, gap:0});
  }
  DEMO_AUDIT.filter(filterFn||(()=>true)).forEach(l=>{
    const key=l.at.slice(0,10);
    const day=days.find(x=>x.date===key);
    if(!day) return;
    day.count++;
    if(l.blocked) day.blocked++;
    if(l.gap) day.gap++;
  });
  return days;
}
function demoAuditPayload(){
  const log=DEMO_AUDIT.slice().reverse();
  const total=DEMO_AUDIT.length;
  const blocked=DEMO_AUDIT.filter(l=>l.blocked).length;
  const gap=DEMO_AUDIT.filter(l=>l.gap).length;
  const recent=DEMO_AUDIT.slice(-20);
  const byQ={};
  DEMO_AUDIT.forEach(l=>{
    const k=l.query;
    (byQ[k]=byQ[k]||{question:k,count:0,last_user:'',last_asked:'',gap:l.gap}).count++;
    byQ[k].last_user=l.user_name; byQ[k].last_asked=l.at; byQ[k].gap=byQ[k].gap&&l.gap;
  });
  const allQ=Object.values(byQ);
  const cite={};
  DEMO_AUDIT.forEach(l=>(l.cited_ids||[]).forEach(id=>{cite[id]=(cite[id]||0)+1;}));
  const typeDist={};
  Object.entries(cite).forEach(([id,c])=>{
    const d=DEMO_DOCS.find(x=>x.id===id); if(!d) return;
    typeDist[d.doc_type]=(typeDist[d.doc_type]||0)+c;
  });
  return {
    log,
    stats:{
      total, answered:total-blocked-gap, blocked, knowledge_gap:gap,
      recent_window:{n:recent.length,
        answered:recent.filter(l=>!l.blocked&&!l.gap).length,
        blocked:recent.filter(l=>l.blocked).length,
        gap:recent.filter(l=>l.gap).length},
    },
    org_daily: demoDailySeries(),
    top_questions: allQ.filter(x=>!x.gap).sort((a,b)=>b.count-a.count).slice(0,8),
    knowledge_gaps: allQ.filter(x=>x.gap).sort((a,b)=>b.count-a.count).slice(0,6),
    doc_type_distribution: Object.entries(typeDist).map(([doc_type,count])=>({doc_type,count})).sort((a,b)=>b.count-a.count),
    top_cited_docs: Object.entries(cite).map(([id,count])=>{
      const d=DEMO_DOCS.find(x=>x.id===id);
      return {title:d?d.title:id, doc_type:d?d.doc_type:'', count};
    }).sort((a,b)=>b.count-a.count).slice(0,6),
    thin_citation_count: DEMO_AUDIT.filter(l=>(l.cited_ids||[]).length===1).length,
  };
}
function demoMemberStats(scopeUser){
  // 管理コンソールは全メンバーを表示する。分析ビュー(一般ユーザー個人向け)は
  // 呼び出し側で自分の行だけに絞り込むため、ここでは常に全員分を返してよい。
  const members=DEMO_USERS.map(u=>{
    const mine=DEMO_AUDIT.filter(l=>l.user_id===u.id);
    const types={};
    mine.forEach(l=>(l.cited_ids||[]).forEach(id=>{
      const d=DEMO_DOCS.find(x=>x.id===id); if(!d) return;
      types[d.doc_type]=(types[d.doc_type]||0)+1;
    }));
    return {
      user_id:u.id, name:u.name, title:u.title,
      question_count:mine.length,
      blocked_count:mine.filter(l=>l.blocked).length,
      unanswered_count:mine.filter(l=>l.gap).length,
      top_doc_types:Object.entries(types).map(([doc_type,count])=>({doc_type,count})).sort((a,b)=>b.count-a.count).slice(0,3),
      daily:demoDailySeries(l=>l.user_id===u.id),
      last_active:mine.length?mine[mine.length-1].at:null,
    };
  });
  return {members, org_daily:demoDailySeries()};
}
function demoGraph(user){
  const vis=demoVisibleDocs(user);
  const ids=new Set(vis.map(d=>d.id));
  const REL=[
    ['d05','d06',.9],['d06','d09',.85],['d05','d07',.7],['d06','d07',.6],['d08','d06',.55],
    ['d10','d11',.9],['d10','d12',.8],['d11','d12',.75],['d10','d14',.5],['d12','d17',.6],
    ['d13','d14',.7],['d13','d10',.45],['d18','d09',.65],['d18','d04',.6],['d04','d09',.55],
    ['d02','d03',.5],['d01','d15',.6],['d01','d02',.45],['d16','d01',.4],['d08','d17',.35],
  ];
  const typeCount={};
  vis.forEach(d=>{typeCount[d.doc_type]=(typeCount[d.doc_type]||0)+1;});
  return {
    nodes:vis.map(d=>({id:d.id,title:d.title,doc_type:d.doc_type,importance:d.importance,updated_at:d.updated_at,summary:d.summary})),
    edges:REL.filter(([a,b])=>ids.has(a)&&ids.has(b)).map(([source,target,weight])=>({source,target,weight})),
    types:Object.entries(typeCount).map(([name,count])=>({name,count})),
  };
}

const mkRes=(status,data)=>({ok:status<300, status, json:async()=>data});

let DEMO_STRUCTURE_GENERATED=true; // 最初から生成済みで見せる
let demoDocSeq=100;

async function demoApi(url, opts){
  opts=opts||{};
  const method=(opts.method||'GET').toUpperCase();
  const path=url.split('?')[0];
  const body=(()=>{ try{ return typeof opts.body==='string'?JSON.parse(opts.body):null; }catch(e){ return null; } })();

  // 認証不要
  if(path==='/api/demo-accounts') return mkRes(200,{accounts:DEMO_USERS.map(u=>({username:u.username,password:u.password,name:u.name,title:u.title}))});
  if(path==='/api/login'&&method==='POST'){
    const u=DEMO_USERS.find(x=>x.username===(body&&body.username));
    if(!u||u.password!==(body&&body.password)) return mkRes(401,{error:'ユーザー名またはパスワードが違います'});
    return mkRes(200,{token:'demo-'+u.id});
  }

  const user=demoUserByToken(opts.headers);
  if(!user) return mkRes(401,{error:'auth'});

  if(path==='/api/me') return mkRes(200,{
    user:{id:user.id,name:user.name,title:user.title,role:user.role,groups:user.groups,
      group_labels:user.groups.map(g=>{const gg=DEMO_GROUPS.find(x=>x.id===g);return gg?gg.label:g;})},
    templates:demoTemplates(user), ai_enabled:true,
    visible_docs:demoVisibleDocs(user).length, total_docs:DEMO_DOCS.length,
    org_name:'合同会社nerdech',
  });
  if(path==='/api/logout') return mkRes(200,{});

  if(path==='/documents') return mkRes(200, demoVisibleDocs(user).map(d=>({
    id:d.id,title:d.title,doc_type:d.doc_type,importance:d.importance,updated_at:d.updated_at,summary:d.summary,size_bytes:d.size_bytes})));

  if(path==='/ingest'&&method==='POST'){
    const fd=opts.body;
    const f=fd&&fd.get?fd.get('file'):null;
    const title=f?f.name:('アップロード資料'+(demoDocSeq));
    let content='';
    try{ if(f&&/\.(txt|md|markdown|csv|json|log)$/i.test(f.name)) content=await f.text(); }catch(e){}
    DEMO_DOCS.push({id:'d'+(demoDocSeq++), title, doc_type:'一般', importance:'deliverable',
      acl:user.groups.filter(g=>g!=='g_all').concat(['g_all']).slice(0,1).length?['g_all']:['g_all'],
      source:'Web取込', chunks:Math.max(1,Math.round((content.length||3000)/800)),
      size_bytes:(f&&f.size)||3000, updated_at:new Date().toISOString(),
      summary:'Webからアップロードされた資料。', content:content||'（プレビュー可能な本文がありません）'});
    return mkRes(200,{ok:true});
  }

  if(path==='/api/graph') return mkRes(200, demoGraph(user));

  if(path==='/api/structure') return mkRes(200,{map:DEMO_STRUCTURE_GENERATED?DEMO_STRUCTURE:null});
  if(path==='/api/structure/generate'&&method==='POST'){
    await new Promise(r=>setTimeout(r,1600));
    DEMO_STRUCTURE_GENERATED=true;
    return mkRes(200,{map:DEMO_STRUCTURE});
  }

  if(path==='/api/members/stats') return mkRes(200, demoMemberStats(user));
  if(path==='/api/members/analysis'){
    // 全メンバー分を返す。分析ビュー(個人向け)は呼び出し側で自分の行に絞り込む。
    const a=DEMO_MEMBER_ANALYSIS;
    return mkRes(200,{analysis:{org_note:a.analysis.org_note,members:a.analysis.members},created_at:a.created_at});
  }
  if(path==='/api/members/analyze'&&method==='POST'){
    await new Promise(r=>setTimeout(r,1400));
    DEMO_MEMBER_ANALYSIS.created_at=new Date().toISOString();
    return mkRes(200, {analysis:DEMO_MEMBER_ANALYSIS.analysis, created_at:DEMO_MEMBER_ANALYSIS.created_at});
  }

  const mPrev=path.match(/^\/api\/documents\/([^/]+)\/preview$/);
  if(mPrev){
    const d=DEMO_DOCS.find(x=>x.id===decodeURIComponent(mPrev[1]));
    if(!d) return mkRes(404,{error:'not found'});
    if(!d.acl.some(g=>user.groups.includes(g))) return mkRes(403,{error:'forbidden'});
    return mkRes(200,{title:d.title,doc_type:d.doc_type,importance:d.importance,updated_at:d.updated_at,
      source:d.source,summary:d.summary,content:d.content});
  }

  /* ---- 管理系(このデモでは一般ユーザーも管理コンソールを閲覧・操作できる) ---- */
  if(path==='/api/admin/status') return mkRes(200,{documents:DEMO_DOCS.map(d=>({
    id:d.id,title:d.title,source:d.source,acl:d.acl,acl_label:demoAclLabel(d.acl),chunks:d.chunks}))});

  if(path==='/api/admin/users'&&method==='GET') return mkRes(200,{
    users:DEMO_USERS.map(u=>({id:u.id,name:u.name,title:u.title,username:u.username,role:u.role,groups:u.groups,
      group_labels:u.groups.map(g=>{const gg=DEMO_GROUPS.find(x=>x.id===g);return gg?gg.label:g;})})),
    groups:DEMO_GROUPS.slice()});
  if(path==='/api/admin/users'&&method==='POST'){
    if(!body||!body.username) return mkRes(400,{error:'ログイン名は必須です'});
    if(DEMO_USERS.some(u=>u.username===body.username)) return mkRes(400,{error:'そのログイン名は使われています'});
    DEMO_USERS.push({id:'u_'+body.username,name:body.name||body.username,title:body.title||'',username:body.username,
      password:body.password||'demo',role:body.role||'member',groups:body.groups||['g_all']});
    return mkRes(200,{ok:true});
  }
  const mUser=path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if(mUser){
    const u=DEMO_USERS.find(x=>x.id===decodeURIComponent(mUser[1]));
    if(!u) return mkRes(404,{error:'not found'});
    if(method==='PUT'){
      Object.assign(u,{name:body.name??u.name,title:body.title??u.title,username:body.username??u.username,
        role:body.role??u.role,groups:body.groups??u.groups});
      if(body.password) u.password=body.password;
      return mkRes(200,{ok:true});
    }
    if(method==='DELETE'){
      const i=DEMO_USERS.indexOf(u); DEMO_USERS.splice(i,1);
      return mkRes(200,{ok:true});
    }
  }
  if(path==='/api/admin/groups'&&method==='POST'){
    if(!body||!body.id||!body.label) return mkRes(400,{error:'IDと表示名を入力してください'});
    if(DEMO_GROUPS.some(g=>g.id===body.id)) return mkRes(400,{error:'そのIDは使われています'});
    DEMO_GROUPS.push({id:body.id,label:body.label});
    return mkRes(200,{ok:true});
  }
  if(path==='/api/admin/audit') return mkRes(200, demoAuditPayload());
  if(path==='/api/admin/insights'&&method==='GET') return mkRes(200, DEMO_INSIGHTS);
  if(path==='/api/admin/insights'&&method==='POST'){
    await new Promise(r=>setTimeout(r,1600));
    DEMO_INSIGHTS.created_at=new Date().toISOString();
    return mkRes(200, DEMO_INSIGHTS);
  }
  if(path==='/api/admin/documents'&&method==='POST'){
    const fd=opts.body;
    const f=fd&&fd.get?fd.get('file'):null;
    if(!f) return mkRes(400,{error:'ファイルを選んでください'});
    const title=(fd.get('title')||'').trim()||f.name;
    const acl=((fd.get('acl')||'')+'').split(',').filter(Boolean);
    let content='';
    try{ if(/\.(txt|md|markdown|csv|json|log|html?)$/i.test(f.name)) content=await f.text(); }catch(e){}
    DEMO_DOCS.push({id:'d'+(demoDocSeq++), title, doc_type:'一般', importance:'reference',
      acl:acl.length?acl:['g_all'], source:'管理者アップロード',
      chunks:Math.max(1,Math.round((content.length||3000)/800)), size_bytes:f.size||3000,
      updated_at:new Date().toISOString(), summary:'管理コンソールから取り込まれた資料。',
      content:content||'（プレビュー可能な本文がありません）'});
    return mkRes(200,{ok:true});
  }
  const mDoc=path.match(/^\/api\/admin\/documents\/([^/]+)$/);
  if(mDoc){
    const d=DEMO_DOCS.find(x=>x.id===decodeURIComponent(mDoc[1]));
    if(!d) return mkRes(404,{error:'not found'});
    if(method==='PUT'){ d.title=body.title??d.title; d.acl=body.acl??d.acl; return mkRes(200,{ok:true}); }
    if(method==='DELETE'){ DEMO_DOCS.splice(DEMO_DOCS.indexOf(d),1); return mkRes(200,{ok:true}); }
  }

  return mkRes(404,{error:'not found: '+path});
}
