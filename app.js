/* =====================================================================
   コア: 状態・ヘルパー・認証・レール(サイドバー)ルーティング・チャット画面
   デザインは Frame 2 / Frame 20 のシェル(青背景+白シート)に準拠。
   ===================================================================== */

const SHEET=document.getElementById('sheet');
let TOKEN=sessionStorage.getItem('krag_token')||null;
let ME=null, TEMPLATES=[], AI=false, VIS=0, TOT=0, ORG_NAME='';
let DEMO=false;          // バックエンド未検出ならtrue(内蔵デモデータで動く)
let VIEW='chat';         // chat | manager | structure | analysis | admin
let CHAT_MODE='ai';      // ai | dm

const ICON={
  check:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  lock:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d1453b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  doc:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  spark:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  quote:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h4v4H7zM13 7h4v4h-4z"/></svg>',
};

function esc(s){return (s||'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function initial(name){return (name||'?').trim().charAt(0)}
function authHeaders(extra){return Object.assign(TOKEN?{'Authorization':'Bearer '+TOKEN}:{}, extra||{})}
const trunc=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
const stripExt=s=>(s||'').replace(/(?:\.[A-Za-z0-9]{1,5}){1,3}$/,'');
const el=(t,a)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const k in a)e.setAttribute(k,a[k]);return e;};

/* デモ/実バックエンドを吸収するfetch。DEMOならモックへ */
async function apiFetch(url, opts){
  if(DEMO) return demoApi(url, opts);
  return fetch(url, opts);
}

function countUp(elm, to, duration){
  if(!elm) return;
  to=Number(to)||0; duration=duration||800;
  const start=performance.now();
  const step=now=>{
    const p=Math.min(1,(now-start)/duration);
    elm.textContent=Math.round(to*(1-Math.pow(1-p,3)));
    if(p<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function roleColor(groups){
  const g=groups||[];
  if(g.includes('g_exec'))return '#4a6cf5';
  if(g.includes('g_sales'))return '#e8703a';
  if(g.includes('g_hr'))return '#a24bd8';
  if(g.includes('g_dev'))return '#22a06b';
  return '#5b6270';
}
function dateLabel(iso){const d=new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function monthLabel(iso){const d=new Date(iso);return `${d.getFullYear()}年${d.getMonth()+1}月`}
function fmtSize(b){ if(!b) return '—'; if(b>=1e9)return (b/1e9).toFixed(1)+' GB'; if(b>=1e6)return (b/1e6).toFixed(1)+' MB'; if(b>=1e3)return Math.round(b/1e3)+' KB'; return b+' B'; }

/* トースト */
let _toastTimer=null;
function toast(msg){
  let t=document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

function resetPerUserState(){
  BIZFLOW=null; bizLoaded=false; bizSelected=null; bizHover=null; BIZ_AGG=true;
  ADMIN_INSIGHTS=null; adminInsightsLoaded=false;
  DOCS=[]; MGR_TYPES=null; ALL_TYPES=[];
  SESSIONS=[]; CURRENT_SESSION=null; CHAT_MODE='ai';
}

/* ---------------- 引用元プレビュー(原本モーダル) ---------------- */
const TIER_DEF={
  core:{id:0,label:'コア / 最重要',sub:'上段',desc:'請求書・見積書・契約書・案件情報。'},
  deliverable:{id:1,label:'成果物',sub:'中段',desc:'作成したファイル。デザイン・ソース・納品物。'},
  reference:{id:2,label:'参考 / 履歴',sub:'下段',desc:'やりとり・議事録・参考資料など。'},
};
const TIER_BY_ID=['core','deliverable','reference'];
function tierOf(imp){ return TIER_DEF[imp] ? imp : 'reference'; }
function tierNumOf(d){ return TIER_DEF[tierOf(d.importance)].id; }
function dpImportanceLabel(imp){ return (TIER_DEF[tierOf(imp)]||TIER_DEF.reference).label; }

function openDocPreview(docId){
  docId=(docId||'').toString().trim();
  if(!docId) return;
  const modal=document.getElementById('docPreviewModal');
  modal.innerHTML=`<div class="dp-overlay"></div>
    <div class="dp-box" role="dialog" aria-modal="true" aria-label="資料プレビュー">
      <div class="dp-head"><div><div class="dp-title">読み込み中…</div></div>
        <button class="dp-close" aria-label="閉じる" type="button">${ICON.x}</button></div>
      <div class="dp-body"><div class="dp-loading"><span class="loading"><i></i><i></i><i></i></span></div></div>
    </div>`;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  modal.querySelector('.dp-overlay').onclick=closeDocPreview;
  modal.querySelector('.dp-close').onclick=closeDocPreview;
  fetchDocPreview(docId);
}
async function fetchDocPreview(docId){
  const modal=document.getElementById('docPreviewModal');
  try{
    const r=await apiFetch('/api/documents/'+encodeURIComponent(docId)+'/preview',{headers:authHeaders()});
    if(r.status===401){ closeDocPreview(); toast('セッションが切れました'); return logout(); }
    if(!modal.classList.contains('show')) return;
    if(!r.ok){
      const head=modal.querySelector('.dp-head');
      if(head) head.querySelector('.dp-title').textContent='資料が見つかりません';
      const body=modal.querySelector('.dp-body');
      if(body) body.innerHTML='<div class="dp-error">この資料は表示できません（権限がないか、削除された可能性があります）。</div>';
      return;
    }
    const d=await r.json();
    if(!modal.classList.contains('show')) return;
    modal.querySelector('.dp-head').innerHTML=`
      <div><div class="dp-title">${esc(stripExt(d.title))}</div>
        <div class="dp-meta">
          <span class="mtag">${esc(d.doc_type||'一般')}</span>
          <span class="mtag">${esc(dpImportanceLabel(d.importance))}</span>
          <span class="mtag">${esc(dateLabel(d.updated_at))}</span>
          <span class="mtag">${esc(d.source||'')}</span>
        </div>
      </div>
      <button class="dp-close" aria-label="閉じる" type="button">${ICON.x}</button>`;
    modal.querySelector('.dp-close').onclick=closeDocPreview;
    modal.querySelector('.dp-body').innerHTML=`
      ${d.summary?`<div class="dp-summary">${esc(d.summary)}</div>`:''}
      <div class="dp-content">${esc(d.content||'（本文がありません）')}</div>`;
  }catch(e){
    if(!modal.classList.contains('show')) return;
    const body=modal.querySelector('.dp-body');
    if(body) body.innerHTML='<div class="dp-error">読み込みに失敗しました。</div>';
  }
}
function closeDocPreview(){
  const modal=document.getElementById('docPreviewModal');
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML='';
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    const modal=document.getElementById('docPreviewModal');
    if(modal && modal.classList.contains('show')) closeDocPreview();
  }
});

/* ---------------- レール(サイドバー)ルーティング ---------------- */
function setRail(active){
  document.querySelectorAll('.rail-item').forEach(b=>b.classList.toggle('active', b.dataset.view===active));
}
function bindRail(){
  document.querySelectorAll('.rail-item').forEach(b=>{
    b.onclick=()=>{
      if(!ME){ toast('先にログインしてください'); return; }
      routeTo(b.dataset.view);
    };
  });
  document.getElementById('railAvatar').onclick=toggleUserMenu;
}
function routeTo(view){
  if(view==='chat') return showChat();
  if(view==='manager') return showManager();
  if(view==='structure') return showStructure();
  if(view==='analysis') return showAnalysis();
  if(view==='admin') return showAdmin();
}

/* 下部アバター: ユーザーメニュー(ログアウトはここに集約) */
function toggleUserMenu(){
  let m=document.getElementById('userMenu');
  if(m){ m.remove(); return; }
  if(!ME) return;
  m=document.createElement('div');
  m.id='userMenu';
  m.innerHTML=`
    <div class="um-name">${esc(ME.name)}</div>
    <div class="um-title">${esc(ME.title||'')}${ME.role==='admin'?' ・ 管理者':''}</div>
    <button class="um-logout" id="umLogout">ログアウト</button>`;
  document.body.appendChild(m);
  document.getElementById('umLogout').onclick=()=>{ m.remove(); logout(); };
  setTimeout(()=>{
    const close=e=>{ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('click',close);} };
    document.addEventListener('click',close);
  },0);
}
function renderRailAvatar(){
  const av=document.getElementById('railAvatar');
  if(ME){
    av.innerHTML=`<span class="rav-initial">${esc(initial(ME.name))}</span>`;
    av.title=ME.name+'（クリックでメニュー）';
  }else{
    av.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" style="width:27px;height:27px"><circle cx="12" cy="8.2" r="3.7"/><path d="M4.6 20.4a7.6 7.6 0 0 1 14.8 0z"/></svg>';
    av.title='';
  }
}

/* ---------------- 起動 ---------------- */
async function detectBackend(){
  try{
    const ctl=new AbortController();
    const t=setTimeout(()=>ctl.abort(),1500);
    const r=await fetch('/api/demo-accounts',{signal:ctl.signal});
    clearTimeout(t);
    DEMO=!r.ok;
  }catch(e){ DEMO=true; }
}
async function init(){
  bindRail();
  await detectBackend();
  if(TOKEN){
    try{
      const r=await apiFetch('/api/me',{headers:authHeaders()});
      if(r.ok){
        const d=await r.json();
        ME=d.user;TEMPLATES=d.templates;AI=d.ai_enabled;VIS=d.visible_docs;TOT=d.total_docs;ORG_NAME=d.org_name||'';
        resetPerUserState();
        renderRailAvatar();
        return showChat();
      }
    }catch(e){}
    TOKEN=null;sessionStorage.removeItem('krag_token');
  }
  showLogin();
}

/* ---------------- ログイン ---------------- */
async function showLogin(){
  ME=null; VIEW='login';
  document.querySelector('.app').classList.add('auth'); // レールを隠して独立したログイン画面にする
  setRail(null); renderRailAvatar();
  SHEET.innerHTML=`
  <div class="login">
    <div class="login-left fu-s" style="--d:0s">
      <div class="brand"><span class="bdot"></span><b>社内ナレッジ集約AI</b></div>
      <div class="login-copy">
        <h1 class="login-headline">見ていい人にだけ、<br><em>答える</em>AI。</h1>
        <p class="login-lede">社内資料に、自然文で質問できます。</p>
      </div>
      ${DEMO?'<div class="demo-badge">デモモード（内蔵データで動作中）</div>':''}
    </div>
    <div class="login-right">
      <div class="login-card fu-s" style="--d:.08s">
        <h2>ログイン</h2>
        <div class="field"><label>ログインID</label><input id="u" autocomplete="username" placeholder="例：kido"></div>
        <div class="field"><label>パスワード</label><input id="p" type="password" autocomplete="current-password" placeholder="パスワード"></div>
        <div class="lerr" id="lerr"></div>
        <button class="lbtn" id="lbtn">ログイン ${ICON.arrow}</button>
        <div class="demo-accts">
          <div class="dh">デモ用アカウント（クリックでログイン）</div>
          <div id="demoAccts"></div>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById('lbtn').onclick=login;
  document.getElementById('p').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229)login()});
  document.getElementById('u').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229)document.getElementById('p').focus()});
  try{
    const d=await (await apiFetch('/api/demo-accounts')).json();
    document.getElementById('demoAccts').innerHTML=d.accounts.map(a=>`
      <button class="da" data-u="${esc(a.username)}" data-p="${esc(a.password)}">
        <span class="av" style="background:${roleColor(a.username==='kido'?['g_exec']:a.username==='ninomiya'?['g_sales']:['g_dev'])}">${esc(initial(a.name))}</span>
        <span class="meta"><span class="nm">${esc(a.name)}</span><span class="ti">${esc(a.title)}</span></span>
        <span class="go">${ICON.arrow}</span></button>`).join('');
    document.querySelectorAll('.da').forEach(b=>b.onclick=()=>{
      document.getElementById('u').value=b.dataset.u;document.getElementById('p').value=b.dataset.p;login();});
  }catch(e){}
}
async function login(){
  const u=document.getElementById('u').value.trim(),p=document.getElementById('p').value;
  const err=document.getElementById('lerr'),btn=document.getElementById('lbtn');
  err.textContent='';
  if(!u||!p){err.textContent='ユーザー名とパスワードを入力してください';return;}
  btn.disabled=true;
  try{
    const r=await apiFetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
    const d=await r.json();
    if(!r.ok){err.textContent=d.error||'ログインに失敗しました';btn.disabled=false;return;}
    TOKEN=d.token;sessionStorage.setItem('krag_token',TOKEN);
    const me=await (await apiFetch('/api/me',{headers:authHeaders()})).json();
    ME=me.user;TEMPLATES=me.templates;AI=me.ai_enabled;VIS=me.visible_docs;TOT=me.total_docs;ORG_NAME=me.org_name||'';
    resetPerUserState();
    renderRailAvatar();
    showChat();
  }catch(e){err.textContent='通信エラーが発生しました';btn.disabled=false;}
}
async function logout(){
  try{await apiFetch('/api/logout',{method:'POST',headers:authHeaders()});}catch(e){}
  TOKEN=null;sessionStorage.removeItem('krag_token');
  showLogin();
}

/* =====================================================================
   チャット画面: AIチャット(権限フィルタ付きQ&A) ⇄ DM・グループチャット
   ===================================================================== */
let SESSIONS=[];            // {id,title,html} AIチャットのセッション履歴
let CURRENT_SESSION=null;
let pendingFiles=[];

function showChat(){
  VIEW='chat'; document.querySelector('.app').classList.remove('auth'); setRail('chat');
  SHEET.innerHTML=`
    <aside class="nav" id="navAI">
      <div class="seg">
        <button class="on" data-seg="chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-11.8 7.7L3 21l1.9-5.7A8.4 8.4 0 1 1 21 11.5z"/></svg>Chat</button>
        <button data-seg="cowork"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v4M16 3v4M4 9h16M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/></svg>Cowork</button>
        <button data-seg="code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg>Code</button>
      </div>
      <div class="nav-scroll">
        <a class="nav-link" id="newSession"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>新規セッション</a>
        <a class="nav-link muted" id="lnkArtifact"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6a2 2 0 0 1 2-2h9l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>アーティファクト</a>
        <a class="nav-link muted" id="lnkCustomize"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9-2.8.9-5.5-4-3.9L9.5 8z"/></svg>カスタマイズ</a>
        <div class="nav-sec"><span>最近の項目</span></div>
        <div id="recentList"></div>
      </div>
    </aside>
    <aside class="nav hidden" id="navDM">
      <div class="nav-scroll" style="padding-top:10px">
        <div class="nav-sec" style="padding-top:6px"><span>チャンネル</span><button class="plus" id="addCh">＋</button></div>
        <div id="channelList"></div>
        <div class="nav-sec"><span>グループ</span></div>
        <div id="groupList"></div>
        <div class="nav-sec"><span>ダイレクトメッセージ</span></div>
        <div id="dmList"></div>
      </div>
    </aside>
    <main class="main">
      <div class="main-head" id="mainHead">
        <div class="mode-toggle">
          <button id="btnAI" class="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 8v4l2.5 2.5"/></svg>AIチャット</button>
          <button id="btnDM"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3z"/><path d="M17 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2l0 0-3-2H10"/></svg>DM・グループチャット</button>
        </div>
        <div class="head-title" id="headTitle"></div>
        <div class="head-actions" id="headActions"></div>
      </div>
      <div class="stream" id="aiStream">
        <div class="feed-inner" id="feed"></div>
      </div>
      <div class="stream hidden" id="dmStream"><div class="msgs" id="dmMsgs"></div></div>
      <div class="composer">
        <div class="composer-inner">
          <div class="attach-row hidden" id="attachRow"></div>
          <div class="inputbox">
            <div class="input-top">
              <textarea id="ta" rows="1" placeholder="テキストを入力"></textarea>
              <button class="send-btn" id="sendBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button>
            </div>
            <div class="input-bar">
              <span class="tool-pill" id="autoPill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/></svg>自動</span>
              <button class="tool-ic" id="attachBtn" title="ファイルを追加"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
              <input type="file" id="fileInput" multiple class="hidden">
              <button class="tool-ic" id="micBtn" title="音声入力（準備中）"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/></svg></button>
              <div class="right" id="statusRight"><span>Opus 4.8</span><span>高</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>`;
  bindChat();
  renderChatIntro();
  renderRecents();
  renderChannels();
  renderChatHeader();
}

function bindChat(){
  document.getElementById('btnAI').onclick=()=>setChatMode('ai');
  document.getElementById('btnDM').onclick=()=>setChatMode('dm');
  document.getElementById('newSession').onclick=newSession;
  document.getElementById('lnkArtifact').onclick=()=>toast('アーティファクトは後続フェーズで提供予定です');
  document.getElementById('lnkCustomize').onclick=()=>toast('カスタマイズは後続フェーズで提供予定です');
  document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{
    if(b.dataset.seg!=='chat'){ toast('このデモではChatのみ利用できます'); return; }
    document.querySelectorAll('.seg button').forEach(x=>x.classList.toggle('on',x===b));
  });
  const ta=document.getElementById('ta');
  ta.addEventListener('input',()=>{taGrow();updateSendBtn();});
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();onComposerSend();}
  });
  document.getElementById('sendBtn').onclick=onComposerSend;
  document.getElementById('attachBtn').onclick=()=>document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange=e=>onFilesPicked(e.target.files);
  document.getElementById('micBtn').onclick=()=>toast('音声入力は準備中です');
  const drop=document.querySelector('.composer');
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag');}));
  drop.addEventListener('drop',e=>{ if(e.dataTransfer.files.length) onFilesPicked(e.dataTransfer.files); });
}
function taGrow(){ const ta=document.getElementById('ta'); ta.style.height='auto'; ta.style.height=Math.min(ta.scrollHeight,150)+'px'; }
function updateSendBtn(){
  const ta=document.getElementById('ta');
  const has=ta.value.trim()||pendingFiles.length;
  document.getElementById('sendBtn').classList.toggle('ready',!!has);
}

function setChatMode(m){
  CHAT_MODE=m;
  document.getElementById('btnAI').classList.toggle('on',m==='ai');
  document.getElementById('btnDM').classList.toggle('on',m==='dm');
  document.getElementById('navAI').classList.toggle('hidden',m!=='ai');
  document.getElementById('navDM').classList.toggle('hidden',m==='ai');
  document.getElementById('aiStream').classList.toggle('hidden',m!=='ai');
  document.getElementById('dmStream').classList.toggle('hidden',m==='ai');
  document.getElementById('mainHead').classList.toggle('dm',m==='dm');
  document.getElementById('autoPill').classList.toggle('hidden',m!=='ai');
  document.getElementById('statusRight').classList.toggle('hidden',m!=='ai');
  document.getElementById('attachBtn').title = m==='ai'?'ナレッジDBに資料を追加':'ファイルを添付';
  document.getElementById('ta').placeholder = m==='ai'?'テキストを入力（社内資料に質問）':dmPlaceholder();
  renderChatHeader();
  if(m==='dm') renderDMMsgs();
  updateSendBtn();
}
function renderChatHeader(){
  const ht=document.getElementById('headTitle');
  const ha=document.getElementById('headActions');
  if(CHAT_MODE==='ai'){
    ht.innerHTML = CURRENT_SESSION&&CURRENT_SESSION.title
      ? `<span>${esc(trunc(CURRENT_SESSION.title,30))}</span><span class="head-sub">${DEMO?'デモ':'接続中'} · 権限フィルタ有効</span>`
      : `<span class="head-sub">社内資料に、あなたの権限の範囲で答えます</span>`;
    ha.innerHTML='';
  }else{
    const i=dmTitle(dmCurrent);
    const lead=i.hash?`<span class="hash">#</span>`:(i.dm?dmAvatarHTML(i.dm):'');
    ht.innerHTML=`${lead}<span>${esc(i.name)}</span><span class="head-sub">${esc(i.sub||'')}</span>`;
    ha.innerHTML='';
  }
}

/* ---- AIチャット: セッション管理(最近の項目) ---- */
function newSession(){
  saveCurrentSession();
  CURRENT_SESSION=null;
  renderChatIntro();
  renderRecents();
  renderChatHeader();
  setChatMode('ai');
}
function saveCurrentSession(){
  const feed=document.getElementById('feed');
  if(!feed) return;
  if(CURRENT_SESSION && feed.querySelector('.msg')){
    CURRENT_SESSION.html=feed.innerHTML;
  }
}
function openSession(id){
  saveCurrentSession();
  const s=SESSIONS.find(x=>x.id===id);
  if(!s) return;
  CURRENT_SESSION=s;
  document.getElementById('feed').innerHTML=s.html;
  bindSrcClicks(document.getElementById('feed'));
  renderRecents();
  renderChatHeader();
  const sc=document.getElementById('aiStream'); sc.scrollTop=sc.scrollHeight;
}
function ensureSession(firstQuery){
  if(!CURRENT_SESSION){
    CURRENT_SESSION={id:'s'+Date.now(), title:trunc(firstQuery,26), html:''};
    SESSIONS.unshift(CURRENT_SESSION);
    renderRecents();
    renderChatHeader();
  }
}
function renderRecents(){
  const wrap=document.getElementById('recentList');
  if(!wrap) return;
  wrap.innerHTML = SESSIONS.length
    ? SESSIONS.map(s=>`<div class="recent ${CURRENT_SESSION&&CURRENT_SESSION.id===s.id?'active':''} nodot" data-id="${s.id}"><span class="txt">${esc(s.title)}</span></div>`).join('')
    : '<div class="nav-empty">質問するとここに履歴が残ります</div>';
  wrap.querySelectorAll('.recent').forEach(r=>r.onclick=()=>openSession(r.dataset.id));
}

function renderChatIntro(){
  const feed=document.getElementById('feed');
  feed.innerHTML=`
    <div class="intro fu-s" style="--d:.04s">
      <h2>${esc(ME.name)}さんの権限で、質問できます。</h2>
      <p>回答には引用元がつきます。権限のない資料は回答に一切現れません。</p>
      <div class="tpl" id="tpl"></div>
    </div>`;
  document.getElementById('tpl').innerHTML=TEMPLATES.map((t,i)=>`<button data-i="${i}">${esc(t.label)}</button>`).join('');
  document.querySelectorAll('.tpl button').forEach(b=>b.onclick=()=>ask(TEMPLATES[b.dataset.i].query));
}

/* ---- 回答カード共通 ---- */
function srcHtmlFrom(sources){
  if(!sources||!sources.length) return '';
  return '<div class="src"><div class="h">'+ICON.quote+' 引用元</div>'+sources.map((s,i)=>
    `<div class="item" data-doc-id="${esc(s.doc_id||'')}"><span class="di">${ICON.doc}</span><span class="tt"><span class="t1">[${i+1}] ${esc(stripExt(s.title))}</span><span class="t2">${esc(s.source)}</span></span><span class="acl">閲覧権限: ${esc(s.acl_label)}</span></div>`).join('')+'</div>';
}
function bindSrcClicks(container){
  if(!container) return;
  container.querySelectorAll('.src .item').forEach(it=>{
    const id=it.dataset.docId;
    if(!id) return;
    it.onclick=()=>openDocPreview(id);
  });
}

function onComposerSend(){
  if(CHAT_MODE==='ai'){
    const ta=document.getElementById('ta');
    const q=ta.value.trim();
    if(!q) return;
    ta.value=''; taGrow(); updateSendBtn();
    ask(q);
  }else{
    dmSend();
  }
}

/* ---- 質問(実バックエンド:SSE / デモ:内蔵QAを擬似ストリーミング) ---- */
async function ask(text){
  const q=(text||'').trim();
  if(!q) return;
  ensureSession(q);
  const feed=document.getElementById('feed');
  const intro=feed.querySelector('.intro'); if(intro) intro.remove();
  feed.insertAdjacentHTML('beforeend',`<div class="msg u"><div class="bubble">${esc(q)}</div></div>`);
  const loadId='l'+Date.now();
  feed.insertAdjacentHTML('beforeend',`<div class="msg a" id="${loadId}"><div class="acard"><div class="ahead"><span class="ai">${ICON.spark}</span><span class="lbl">回答を生成中</span></div><div class="body"><span class="loading"><i></i><i></i><i></i></span></div></div></div>`);
  const sc=document.getElementById('aiStream'); sc.scrollTop=sc.scrollHeight;
  const send=document.getElementById('sendBtn'); send.classList.add('busy');

  const finish=()=>{ send.classList.remove('busy'); saveCurrentSession();
    const sc2=document.getElementById('aiStream'); if(sc2) sc2.scrollTop=sc2.scrollHeight; };

  if(DEMO){
    // デモ: 内蔵QAで判定し、1文字ずつ流す
    await new Promise(r=>setTimeout(r,650));
    const res=demoAsk(q, DEMO_USERS.find(u=>u.id===ME.id));
    const elCard=document.getElementById(loadId);
    if(res.blocked){
      elCard.outerHTML=`<div class="msg a">${blockedCardHtml(res)}</div>`;
      finish(); return;
    }
    let shown='';
    const srcHtml=srcHtmlFrom(res.sources);
    const render=(done)=>{
      const c=document.getElementById(loadId);
      if(!c) return;
      c.innerHTML=`<div class="acard"><div class="ahead"><span class="ai">${ICON.spark}</span><span class="lbl">回答</span>${done&&!res.gap?`<span class="pill ok">${ICON.check} 権限OK</span>`:''}</div>`+
        `<div class="body">${esc(shown)}${done?'':'<span class="cursor-blink">▍</span>'}</div>${done?srcHtml:''}</div>`;
      if(done) bindSrcClicks(c);
      const s2=document.getElementById('aiStream'); if(s2) s2.scrollTop=s2.scrollHeight;
    };
    for(let i=0;i<res.answer.length;i+=3){
      shown=res.answer.slice(0,i+3);
      render(false);
      await new Promise(r=>setTimeout(r,18));
    }
    shown=res.answer; render(true);
    finish(); return;
  }

  /* 実バックエンド: SSEストリーミング(旧実装を踏襲) */
  let streamedText='', metaData=null, doneData=null, sawError=false, streamStarted=false;
  const renderStreaming=()=>{
    const elc=document.getElementById(loadId);
    if(!elc) return;
    const srcHtml=(metaData&&!metaData.blocked)?srcHtmlFrom(metaData.sources):'';
    elc.innerHTML=`<div class="acard"><div class="ahead"><span class="ai">${ICON.spark}</span><span class="lbl">回答</span></div>`
      +`<div class="body">${esc(streamedText)}<span class="cursor-blink">▍</span></div>${srcHtml}</div>`;
    bindSrcClicks(elc);
    const sc2=document.getElementById('aiStream'); if(sc2) sc2.scrollTop=sc2.scrollHeight;
  };
  try{
    const STREAM_BASE=location.hostname.endsWith('.web.app')?'https://knowledge-ai-api-135815080966.asia-northeast1.run.app':'';
    const r=await fetch(STREAM_BASE+'/api/ask/stream',{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({query:q})});
    if(r.status===401){toast('セッションが切れました');return logout();}
    if(!r.ok||!r.body) throw new Error('stream-failed');
    const reader=r.body.getReader();
    const decoder=new TextDecoder();
    let buf='';
    while(true){
      const {value,done}=await reader.read();
      if(done) break;
      buf+=decoder.decode(value,{stream:true});
      let idx;
      while((idx=buf.indexOf('\n\n'))>=0){
        const raw=buf.slice(0,idx); buf=buf.slice(idx+2);
        let ev='message',data='';
        raw.split('\n').forEach(line=>{
          if(line.startsWith('event:')) ev=line.slice(6).trim();
          else if(line.startsWith('data:')) data+=line.slice(5).trim();
        });
        if(!data) continue;
        let parsed; try{parsed=JSON.parse(data);}catch(e){continue;}
        if(ev==='meta'){ metaData=parsed; if(!metaData.blocked){streamStarted=true;renderStreaming();} }
        else if(ev==='delta'){ streamedText+=parsed.text||''; streamStarted=true; renderStreaming(); }
        else if(ev==='done'){ doneData=parsed; }
        else if(ev==='error'){ sawError=true; }
      }
    }
    const elc=document.getElementById(loadId);
    if(sawError||!doneData){
      if(elc) elc.querySelector('.body').textContent='エラーが発生しました';
    }else if(doneData.blocked){
      const u=(metaData&&metaData.user)||{name:ME.name,title:ME.title||''};
      const vis=metaData?metaData.visible_docs:VIS, tot=metaData?metaData.total_docs:TOT;
      if(elc) elc.outerHTML=`<div class="msg a">${blockedCardHtml({answer:doneData.answer,user:u,visible_docs:vis,total_docs:tot})}</div>`;
    }else{
      const srcHtml=srcHtmlFrom(doneData.sources);
      const html=`<div class="acard"><div class="ahead"><span class="ai">${ICON.spark}</span><span class="lbl">回答</span><span class="pill ok">${ICON.check} 権限OK</span></div><div class="body">${esc(doneData.answer)}</div>${srcHtml}</div>`;
      if(elc){ elc.outerHTML=`<div class="msg a" id="${loadId}">${html}</div>`; bindSrcClicks(document.getElementById(loadId)); }
    }
  }catch(e){
    const elc=document.getElementById(loadId);
    if(elc){
      if(streamStarted) elc.querySelector('.body').textContent='エラーが発生しました';
      else elc.outerHTML=`<div class="msg a"><div class="acard"><div class="ahead"><span class="ai">${ICON.spark}</span><span class="lbl">回答</span></div><div class="body">エラーが発生しました</div></div></div>`;
    }
  }
  finish();
}
function blockedCardHtml(res){
  const u=res.user||{name:ME.name,title:ME.title||''};
  return `<div class="acard blocked"><div class="blockwrap">
    <div class="bigicon">${ICON.lock}</div>
    <h4>アクセスが遮断されました</h4>
    <p>${esc(res.answer)||'あなたの権限では、この質問に該当する社内資料を参照できません。'}</p>
    <div class="meta"><span class="bmeta">閲覧者：<b>${esc(u.name)}（${esc(u.title)}）</b></span><span class="bmeta">参照可能な資料：<b>${res.visible_docs} / ${res.total_docs} 件</b></span></div>
  </div></div>`;
}

/* ---- 添付(+)ボタン: AIモード=ナレッジDBへ取込 / DMモード=添付 ---- */
async function onFilesPicked(files){
  if(!files||!files.length) return;
  if(CHAT_MODE==='ai'){
    // ナレッジDBへの取込(/ingest)
    toast('ナレッジDBへ取り込み中…');
    for(const f of files){
      const fd=new FormData();
      fd.append('path','web-upload/'+ME.name+'/'+Date.now()+'-'+f.name);
      fd.append('file',f,f.name);
      try{ await apiFetch('/ingest',{method:'POST',headers:authHeaders(),body:fd}); }catch(e){}
    }
    DOCS=[]; MGR_TYPES=null; ALL_TYPES=[]; // マネージャーのキャッシュを無効化
    toast(files.length+'件をナレッジDBに追加しました');
  }else{
    for(const f of files){
      const isImg=f.type.startsWith('image/');
      pendingFiles.push({name:f.name,size:humanSize(f.size),
        kind:(f.name.split('.').pop()||'FILE').toUpperCase().slice(0,4),
        img:isImg,url:URL.createObjectURL(f)});
    }
    renderAttachRow(); updateSendBtn();
  }
  document.getElementById('fileInput').value='';
}
function humanSize(b){
  if(b<1024) return b+' B';
  if(b<1024*1024) return (b/1024).toFixed(0)+' KB';
  return (b/1024/1024).toFixed(1)+' MB';
}
function renderAttachRow(){
  const row=document.getElementById('attachRow');
  row.classList.toggle('hidden',pendingFiles.length===0);
  row.innerHTML=pendingFiles.map((f,i)=>
    `<div class="attach-chip"><span>${f.img?'🖼':'📄'}</span>${esc(f.name)} <span class="asize">${f.size}</span><button class="x" data-i="${i}">✕</button></div>`).join('');
  row.querySelectorAll('.x').forEach(b=>b.onclick=()=>{pendingFiles.splice(Number(b.dataset.i),1);renderAttachRow();updateSendBtn();});
}

/* =====================================================================
   DM・グループチャット(クライアント内デモ: Discord/Teams風)
   ===================================================================== */
const DM_PEOPLE={
  u_kido:{name:'木戸 隆正',initials:'木',color:'#4a6cf5',on:true},
  u_fukuda:{name:'福田 晟樹',initials:'福',color:'#22a06b',on:true},
  u_matsuura:{name:'松浦 正醐',initials:'松',color:'#0a9ea4',on:true},
  u_ninomiya:{name:'二宮 石太郎',initials:'二',color:'#e8703a',on:false},
  bot:{name:'ナレッジBot',initials:'AI',color:'#5b6270',on:true},
};
const DM_CHANNELS=[
  {id:'ch-general',name:'全体連絡',badge:0},
  {id:'ch-dev',name:'開発',badge:2},
  {id:'ch-sales',name:'営業',badge:0},
];
const DM_GROUPS=[{id:'grp-mvp',name:'MVP開発チーム',avatars:['u_kido','u_fukuda','u_matsuura']}];
let dmCurrent='ch-general';
const DM_CONV={
  'ch-general':[
    {u:'u_ninomiya',t:'09:12',text:'おはようございます。今日のMVPレビュー、15時からで大丈夫ですか？'},
    {u:'u_matsuura',t:'09:15',text:'大丈夫です！権限フィルタ（F-05）のデモも用意しておきます。'},
    {u:'u_kido',t:'09:18',text:'要件定義書の最新版を上げておきます。'},
    {u:'u_kido',t:'09:18',file:{name:'要件定義書_社内ナレッジAI_v0.2.docx',size:'38 KB',kind:'DOC'}},
  ],
  'ch-dev':[
    {u:'u_matsuura',t:'昨日 18:40',text:'差分同期（F-04）のプロトタイプできました。起動時に追加/更新/削除を反映します。'},
    {u:'u_fukuda',t:'昨日 18:52',text:'早い！ACLの鮮度はどのくらいで追従します？'},
    {u:'u_matsuura',t:'昨日 18:55',text:'今は定期30秒ポーリング。即時反映はWebhook対応で詰めます。'},
    {u:'bot',t:'昨日 18:56',text:'補足：Google Workspace (Drive) のプッシュ通知チャネルを使うと、変更検知の遅延を数秒に短縮できます。出典: API設計メモ.md'},
  ],
  'ch-sales':[
    {u:'u_ninomiya',t:'10:02',text:'ケアとーカーの提案書ドラフトです。フィードバックください。'},
    {u:'u_ninomiya',t:'10:02',file:{name:'提案書_ケアとーカー.pptx',size:'56 KB',kind:'PPT'}},
  ],
  'grp-mvp':[
    {u:'u_kido',t:'昨日 21:10',text:'【MVP開発チーム】今週の残タスクをここにまとめます。'},
    {u:'u_matsuura',t:'昨日 21:12',text:'・F-04 差分同期（松浦）\n・F-05 権限フィルタ（福田）\n・DM/グループUI（レビュー待ち）'},
  ],
};
function dmDmList(){
  return Object.keys(DM_PEOPLE).filter(id=>id!=='bot'&&id!==ME.id).map(id=>({id:'dm-'+id,u:id,badge:0}));
}
function dmConvOf(id){
  if(!DM_CONV[id]) DM_CONV[id]=[];
  return DM_CONV[id];
}
function dmAvatarHTML(uid){
  const p=DM_PEOPLE[uid]||{name:'?',initials:'?',color:'#5b6270'};
  return `<div class="avatar" style="background:${p.color}">${p.initials}<span class="pres ${p.on?'on':''}"></span></div>`;
}
function dmTitle(id){
  const c=DM_CHANNELS.find(x=>x.id===id); if(c) return {hash:true,name:c.name,sub:'チャンネル'};
  const g=DM_GROUPS.find(x=>x.id===id); if(g) return {hash:false,name:g.name,sub:g.avatars.length+'名のグループ'};
  if(id.startsWith('dm-')){const u=id.slice(3);const p=DM_PEOPLE[u];
    return {hash:false,name:p?p.name:u,sub:p&&p.on?'オンライン':'オフライン',dm:u};}
  return {name:''};
}
function dmPlaceholder(){
  const i=dmTitle(dmCurrent);
  return (i.hash?'#'+i.name:i.name)+' へメッセージ';
}
function renderChannels(){
  const chWrap=document.getElementById('channelList');
  if(!chWrap) return;
  chWrap.innerHTML=DM_CHANNELS.map(c=>
    `<div class="ch ${c.id===dmCurrent?'active':''}" data-id="${c.id}"><span class="hash">#</span><span class="txt">${esc(c.name)}</span>${c.badge?`<span class="badge">${c.badge}</span>`:''}</div>`).join('');
  document.getElementById('groupList').innerHTML=DM_GROUPS.map(g=>{
    const stack=g.avatars.slice(0,3).map(a=>`<span class="gstack" style="background:${DM_PEOPLE[a].color}">${DM_PEOPLE[a].initials}</span>`).join('');
    return `<div class="ch ${g.id===dmCurrent?'active':''}" data-id="${g.id}"><span class="gstack-wrap">${stack}</span><span class="txt">${esc(g.name)}</span></div>`;}).join('');
  document.getElementById('dmList').innerHTML=dmDmList().map(d=>
    `<div class="ch ${d.id===dmCurrent?'active':''}" data-id="${d.id}">${dmAvatarHTML(d.u)}<span class="txt">${esc(DM_PEOPLE[d.u].name)}</span></div>`).join('');
  document.querySelectorAll('#navDM .ch').forEach(c=>c.onclick=()=>openDMChannel(c.dataset.id));
  const add=document.getElementById('addCh');
  if(add) add.onclick=()=>{
    const name=prompt('チャンネル名を入力');
    if(!name) return;
    const id='ch-'+Date.now();
    DM_CHANNELS.push({id,name,badge:0});
    openDMChannel(id);
  };
}
function openDMChannel(id){
  dmCurrent=id;
  const c=DM_CHANNELS.find(x=>x.id===id); if(c) c.badge=0;
  renderChannels(); renderChatHeader(); renderDMMsgs();
  document.getElementById('ta').placeholder=dmPlaceholder();
  document.getElementById('ta').focus();
}
function dmFileColor(kind){
  return {DOC:'#2b7bd6',DOCX:'#2b7bd6',PPT:'#d1622b',PPTX:'#d1622b',PNG:'#22a06b',JPG:'#22a06b',PY:'#3b71c4',PDF:'#d1453b',MD:'#5b6270',XLSX:'#1f9d55'}[kind]||'#6b7280';
}
function dmFileCard(f){
  if(f.img&&f.url) return `<img class="img-att" src="${f.url}" alt="${esc(f.name)}" data-url="${f.url}"/>`;
  const dl=f.url?`<a class="file-dl" href="${f.url}" download="${esc(f.name)}" title="ダウンロード">⭳</a>`:`<button class="file-dl" title="ダウンロード">⭳</button>`;
  return `<div class="file-card"><div class="file-ic" style="background:${dmFileColor(f.kind)}">${esc(f.kind)}</div>
    <div class="file-meta"><div class="file-name">${esc(f.name)}</div><div class="file-size">${esc(f.size)}</div></div>${dl}</div>`;
}
function dmMsgHTML(m){
  const p=DM_PEOPLE[m.u]||{name:m.u,initials:'?',color:'#5b6270'};
  const body=(m.text?`<div class="msg-text">${esc(m.text)}</div>`:'')+(m.file?dmFileCard(m.file):'');
  return `<div class="msg-dm ${m.u===ME.id?'me':''}">${dmAvatarHTML(m.u)}<div class="msg-body">
    <div class="msg-head"><span class="msg-name">${esc(p.name)}</span><span class="msg-time">${esc(m.t)}</span></div>${body}</div></div>`;
}
function renderDMMsgs(){
  const wrap=document.getElementById('dmMsgs');
  if(!wrap) return;
  const list=dmConvOf(dmCurrent);
  const today=new Date();
  wrap.innerHTML=`<div class="day-div">${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日</div>`+
    (list.length?list.map(dmMsgHTML).join(''):'<div class="dm-empty">まだメッセージがありません。最初のメッセージを送ってみましょう。</div>');
  wrap.querySelectorAll('.img-att').forEach(img=>img.onclick=()=>{
    const lb=document.getElementById('lightbox');
    document.getElementById('lightImg').src=img.dataset.url;
    lb.classList.add('show');
  });
  const s=document.getElementById('dmStream');
  requestAnimationFrame(()=>{s.scrollTop=s.scrollHeight;});
}
function dmSend(){
  const ta=document.getElementById('ta');
  const text=ta.value.trim();
  if(!text&&!pendingFiles.length) return;
  const now=new Date();
  const t=`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  const conv=dmConvOf(dmCurrent);
  if(text) conv.push({u:ME.id,t,text});
  for(const f of pendingFiles) conv.push({u:ME.id,t,file:f});
  pendingFiles=[]; renderAttachRow();
  ta.value=''; taGrow(); updateSendBtn(); renderDMMsgs();
  // 相手からの自動返信(デモ)
  let replier='u_kido';
  if(dmCurrent.startsWith('dm-')) replier=dmCurrent.slice(3);
  else { const others=Object.keys(DM_PEOPLE).filter(id=>id!=='bot'&&id!==ME.id); replier=others[Math.floor(Math.random()*others.length)]; }
  const lines=['確認しました！','了解です👍','ありがとうございます、あとで見ます。','いいですね、進めましょう。'];
  setTimeout(()=>{
    const n2=new Date();
    dmConvOf(dmCurrent).push({u:replier,t:`${n2.getHours()}:${String(n2.getMinutes()).padStart(2,'0')}`,text:lines[Math.floor(Math.random()*lines.length)]});
    if(VIEW==='chat'&&CHAT_MODE==='dm') renderDMMsgs();
  },900+Math.random()*700);
}

/* lightbox close */
document.addEventListener('click',e=>{
  const lb=document.getElementById('lightbox');
  if(lb&&lb.classList.contains('show')&&e.target===lb) lb.classList.remove('show');
});
