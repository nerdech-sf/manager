/* =====================================================================
   管理コンソール(旧admin.htmlの移植)。レール「その他」から開く。
   ダッシュボード / AI改善提案 / メンバー分析 / ユーザー・グループ / 文書 / 監査ログ
   ===================================================================== */

let GROUPS=[];
let ADMIN_TAB='dash';
let ADMIN_HL=null;          // AI改善提案でハイライトするfindingタイトル
let _adminInterval=null;

function ndDelay(i,step=0.055,cap=12){return `animation-delay:${(Math.min(i,cap)*step).toFixed(3)}s`}
function ndDelayFrom(base,i,step=0.055,cap=12){return `animation-delay:${(base+Math.min(i,cap)*step).toFixed(3)}s`}
function fmtWhen(iso){
  if(!iso) return '';
  const d=new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function animateCountUp(el,from,to,duration=800){
  if(!el) return;
  from=Number(from)||0; to=Number(to)||0;
  if(from===to){el.textContent=to;return;}
  const start=performance.now();
  function step(now){
    const p=Math.min((now-start)/duration,1);
    const eased=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*eased);
    if(p<1) requestAnimationFrame(step); else el.textContent=to;
  }
  requestAnimationFrame(step);
}

/* 管理API薄ラッパー: 401/403でログインへ */
async function af(url,opts){
  opts=Object.assign({},opts||{});
  opts.headers=authHeaders(opts.headers||{});
  const res=await apiFetch(url,opts);
  if(res.status===401){
    TOKEN=null; sessionStorage.removeItem('krag_token');
    showLogin();
    throw new Error('auth-required');
  }
  return res;
}

async function showAdmin(tab, highlight){
  VIEW='admin'; setRail('admin');
  if(_adminInterval){ clearInterval(_adminInterval); _adminInterval=null; }
  if(!ME){ showLogin(); return; }
  ADMIN_TAB=tab||ADMIN_TAB||'dash';
  ADMIN_HL=highlight||null;
  SHEET.innerHTML=`
  <div class="view-full view-scroll admin-view">
    <div class="admin-container">
      <div class="admin-head fu-s" style="--d:0s">
        <h1>管理コンソール</h1>
        <span class="admin-org">${esc(ORG_NAME||'')} ／ ${esc(ME.name)}</span>
      </div>
      <nav class="atabs" id="atabs">
        <button data-tab="dash">ダッシュボード</button>
        <button data-tab="insights">AI改善提案</button>
        <button data-tab="members">メンバー分析</button>
        <button data-tab="users">ユーザー・グループ</button>
        <button data-tab="docs">文書</button>
        <button data-tab="log">監査ログ</button>
      </nav>

      <div class="tabpanel" id="tab-dash">
        <div class="ov-row" id="ov-row"></div>
        <div class="panel dash-trend-panel">
          <div class="dash-trend-head">
            <h3>組織全体の質問数推移（直近14日）</h3>
            <div class="mem-trend-legend">
              <span class="lg"><span class="sw" style="background:rgba(74,108,245,.30)"></span>回答済み</span>
              <span class="lg"><span class="sw" style="background:rgba(74,108,245,.55)"></span>資料なし</span>
              <span class="lg"><span class="sw" style="background:var(--danger)"></span>権限ブロック</span>
            </div>
          </div>
          <div class="mem-trend-chart-wrap">
            <div class="mem-trend-axis-top" id="dashTrendMaxLabel"></div>
            <svg class="mem-trend-svg" id="dashTrendSvg" viewBox="0 0 880 220" preserveAspectRatio="none" role="img"></svg>
            <div class="mem-trend-axis-bottom"><span id="dashTrendStartLabel"></span><span id="dashTrendEndLabel"></span></div>
          </div>
          <div class="dash-trend-caption" id="dashTrendCaption"></div>
        </div>
        <div class="dash-grid">
          <div class="dash-panel">
            <h3>よくある質問 TOP8</h3>
            <div class="dh-sub">回数が多いほどFAQ化・研修教材の優先度が高い。</div>
            <div id="topq"></div>
          </div>
          <div class="dash-panel">
            <h3>ナレッジの穴（FAQ化候補）</h3>
            <div class="dh-sub">参照できる資料が無かった質問。多い順＝優先度順。</div>
            <div id="gapq"></div>
          </div>
        </div>
        <div class="dash-grid">
          <div class="dash-panel">
            <h3>資料種別ごとの引用分布</h3>
            <div class="dh-sub">どの領域のナレッジがよく参照されているか。</div>
            <div id="doctypedist"></div>
          </div>
          <div class="dash-panel">
            <h3>よく参照される資料 TOP</h3>
            <div class="dh-sub">引用回数が多いほど組織の依存度が高い主力ナレッジ。</div>
            <div id="topcited"></div>
          </div>
        </div>
      </div>

      <div class="tabpanel" id="tab-insights">
        <div class="panel ins-panel" id="insights-body"></div>
      </div>

      <div class="tabpanel" id="tab-members">
        <h2>定量ダッシュボード</h2>
        <div class="panel mem-trend-panel">
          <div class="mem-trend-head">
            <h3>組織全体の質問数推移（直近14日）</h3>
            <div class="mem-trend-legend">
              <span class="lg"><span class="sw" style="background:rgba(74,108,245,.30)"></span>回答済み</span>
              <span class="lg"><span class="sw" style="background:rgba(74,108,245,.55)"></span>資料なし</span>
              <span class="lg"><span class="sw" style="background:var(--danger)"></span>権限ブロック</span>
            </div>
          </div>
          <div class="mem-trend-chart-wrap">
            <div class="mem-trend-axis-top" id="orgTrendMaxLabel"></div>
            <svg class="mem-trend-svg" id="orgTrendSvg" viewBox="0 0 880 220" preserveAspectRatio="none" role="img"></svg>
            <div class="mem-trend-axis-bottom"><span id="orgTrendStartLabel"></span><span id="orgTrendEndLabel"></span></div>
          </div>
        </div>
        <div class="panel">
          <div class="tablewrap"><table id="members-stats" class="mem-table"><thead><tr>
            <th>氏名・役職</th><th>質問数</th><th>ブロック</th><th>未回答</th><th>よく引用される資料種別</th><th>推移（14日）</th><th>最終利用</th>
          </tr></thead><tbody></tbody></table></div>
        </div>
        <h2>AI定性分析</h2>
        <div class="panel ins-panel" id="members-analysis-body"></div>
      </div>

      <div class="tabpanel" id="tab-users">
        <h2>ユーザー管理（閲覧者と所属グループ）</h2>
        <div class="panel">
          <div class="tablewrap"><table id="users"><thead><tr><th>氏名</th><th>役職</th><th>ログイン名</th><th>ロール</th><th>所属グループ</th><th class="row-actions">操作</th></tr></thead><tbody></tbody></table></div>
          <div class="formbar" id="adduser"></div>
        </div>
        <p class="muted">所属グループを変えると、その人が見える文書（ACL可視性）が即変わります。</p>
        <h2>グループ</h2>
        <div class="panel">
          <div id="grouplist" style="padding:14px 16px"></div>
          <div class="formbar">
            <label>グループID</label><input id="gid" placeholder="g_legal" style="width:130px">
            <label>表示名</label><input id="glabel" placeholder="法務部" style="width:130px">
            <button class="btn primary" id="addgroup">グループ追加</button>
            <span class="err" id="gerr"></span>
          </div>
        </div>
      </div>

      <div class="tabpanel" id="tab-docs">
        <h2>文書（ソース接続・アップロード取込）</h2>
        <div class="panel">
          <div class="tablewrap"><table id="docs"><thead><tr><th>文書名</th><th>ソース</th><th>閲覧権限(ACL)</th><th>チャンク</th><th class="row-actions">操作</th></tr></thead><tbody></tbody></table></div>
          <div class="formbar" id="upload">
            <label>ファイル</label><input type="file" id="up_file" accept=".txt,.md,.markdown,.csv,.pdf,.docx,.xlsx,.log,.json,.html,.htm">
            <label>表示名(任意)</label><input id="up_title" placeholder="ファイル名を使用" style="width:140px">
            <span style="font-size:13px;color:var(--text-2)">閲覧許可:</span><span id="up_groups"></span>
            <button class="btn primary" id="up_btn">アップロードして索引</button>
            <span class="err" id="up_err"></span>
          </div>
        </div>
      </div>

      <div class="tabpanel" id="tab-log">
        <h2>監査ログ（誰が・何を質問し・何を参照したか）</h2>
        <div class="panel">
          <div class="tablewrap"><table id="audit"><thead><tr><th>閲覧者</th><th>質問</th><th>参照した資料</th><th>可視文書</th><th>結果</th></tr></thead><tbody></tbody></table></div>
        </div>
      </div>
      <div class="chart-tip" id="chartTip"></div>
    </div>
  </div>`;

  document.querySelectorAll('#atabs button').forEach(b=>b.onclick=()=>activateAdminTab(b.dataset.tab));
  document.getElementById('up_btn').onclick=uploadDoc;
  document.getElementById('addgroup').onclick=addGroup;
  activateAdminTab(ADMIN_TAB);

  try{ await loadUsers(); }catch(e){ return; }
  await Promise.all([loadAdminDocs(), loadAudit(), loadInsights(), loadMemberStats(), loadMemberAnalysis()]);
  if(ADMIN_HL) applyInsightHighlight(ADMIN_HL);
  _adminInterval=setInterval(()=>{ if(VIEW==='admin'){ loadAudit().catch(()=>{}); } else { clearInterval(_adminInterval); _adminInterval=null; } }, 8000);
}

function activateAdminTab(name){
  ADMIN_TAB=name;
  document.querySelectorAll('#atabs button').forEach(x=>x.classList.toggle('on',x.dataset.tab===name));
  document.querySelectorAll('.admin-view .tabpanel').forEach(p=>p.classList.toggle('on',p.id==='tab-'+name));
}
function applyInsightHighlight(hl){
  activateAdminTab('insights');
  setTimeout(()=>{
    const titles=document.querySelectorAll('#insights-body .ins-title');
    for(const elT of titles){
      if(elT.textContent && elT.textContent.includes(hl)){
        const row=elT.closest('.ins-row');
        if(row){
          row.scrollIntoView({behavior:'smooth',block:'center'});
          row.classList.add('flash');
          setTimeout(()=>row.classList.remove('flash'),1800);
        }
        break;
      }
    }
  },300);
}

/* ---- 文書 ---- */
async function loadAdminDocs(){
  const s=await (await af('/api/admin/status')).json();
  const tb=document.querySelector('#docs tbody');
  if(!tb) return;
  tb.innerHTML=s.documents.map((d,i)=>`
    <tr data-id="${esc(d.id)}" class="nd-fade" style="${ndDelay(i)}">
      <td>${esc(d.title)}</td><td class="src2">${esc(d.source)}</td>
      <td class="acl">${d.acl_label?esc(d.acl_label):'<span class="blk">閲覧者なし</span>'}</td>
      <td>${d.chunks}</td>
      <td class="row-actions"><button class="btn" data-act="edit">権限編集</button> <button class="btn danger" data-act="del">削除</button></td>
    </tr>`).join('');
  document.querySelectorAll('#docs [data-act]').forEach(b=>b.onclick=()=>{
    const tr=b.closest('tr'); const id=tr.dataset.id;
    const d=s.documents.find(x=>x.id===id);
    if(b.dataset.act==='del') return delDoc(id,d.title);
    if(b.dataset.act==='edit') return editDoc(tr,d);
  });
  const up=document.getElementById('up_groups');
  if(up) up.innerHTML=groupChecks('up',[]);
}
function editDoc(tr,d){
  const cell=tr.querySelector('td:nth-child(3)');
  cell.innerHTML=`<div class="editbox">
    <input id="d_title" value="${esc(d.title)}" style="width:200px"><div style="margin-top:8px">${groupChecks('d',d.acl)}</div>
    <div style="margin-top:8px"><button class="btn primary" id="d_save">保存</button> <button class="btn" id="d_cancel">取消</button><span class="err" id="d_err"></span></div>
  </div>`;
  document.getElementById('d_cancel').onclick=loadAdminDocs;
  document.getElementById('d_save').onclick=async()=>{
    const body={title:document.getElementById('d_title').value,acl:checkedGroups('d')};
    const res=await af('/api/admin/documents/'+encodeURIComponent(d.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(res.ok){loadAdminDocs();} else document.getElementById('d_err').textContent=(await res.json()).error||'エラー';
  };
}
async function delDoc(id,title){
  if(!confirm(`文書「${title}」を削除しますか？`)) return;
  const res=await af('/api/admin/documents/'+encodeURIComponent(id),{method:'DELETE'});
  if(res.ok){loadAdminDocs();}
}
async function uploadDoc(){
  const f=document.getElementById('up_file').files[0];
  const err=document.getElementById('up_err');
  if(!f){err.textContent='ファイルを選んでください';return;}
  const fd=new FormData();
  fd.append('file',f);
  fd.append('title',document.getElementById('up_title').value);
  fd.append('acl',checkedGroups('up').join(','));
  const btn=document.getElementById('up_btn'); btn.disabled=true; err.textContent='';
  const res=await af('/api/admin/documents',{method:'POST',body:fd});
  btn.disabled=false;
  if(res.ok){
    document.getElementById('up_file').value='';document.getElementById('up_title').value='';
    toast('文書を索引しました');
    loadAdminDocs();
  } else err.textContent=(await res.json()).error||'アップロード失敗';
}
function groupChecks(prefix,selected){
  return GROUPS.map(g=>`<label class="gchk"><input type="checkbox" data-g="${g.id}" id="${prefix}_${g.id}" ${selected.includes(g.id)?'checked':''}>${esc(g.label)}</label>`).join('');
}
function checkedGroups(prefix){
  return GROUPS.filter(g=>document.getElementById(`${prefix}_${g.id}`)?.checked).map(g=>g.id);
}

/* ---- ユーザー・グループ ---- */
async function loadUsers(){
  const r=await (await af('/api/admin/users')).json();
  GROUPS=r.groups;
  document.querySelector('#users tbody').innerHTML=r.users.map((u,i)=>`
    <tr data-id="${esc(u.id)}" class="nd-fade" style="${ndDelay(i)}">
      <td>${esc(u.name)}</td><td class="src2">${esc(u.title)}</td>
      <td class="src2">${u.username?esc(u.username):'<span class="blk">未設定</span>'}</td>
      <td><span class="badge ${u.role==='admin'?'on':'off'}">${u.role==='admin'?'管理者':'一般'}</span></td>
      <td>${u.group_labels.map(g=>`<span class="tag">${esc(g)}</span>`).join('')||'<span class="muted">なし</span>'}</td>
      <td class="row-actions"><button class="btn" data-act="edit">編集</button> <button class="btn danger" data-act="del">削除</button></td>
    </tr>`).join('');
  document.getElementById('grouplist').innerHTML=
    GROUPS.map(g=>`<span class="tag">${esc(g.label)} <span class="muted">(${esc(g.id)})</span></span>`).join(' ');
  document.getElementById('adduser').innerHTML=`
    <label>氏名</label><input id="nu_name" placeholder="高橋 法子" style="width:104px">
    <label>役職</label><input id="nu_title" placeholder="法務部" style="width:90px">
    <label>ログイン名</label><input id="nu_username" placeholder="takahashi" style="width:104px">
    <label>初期PW</label><input id="nu_password" placeholder="パスワード" style="width:104px">
    <label>ロール</label><select id="nu_role"><option value="member">一般</option><option value="admin">管理者</option></select>
    <span id="nu_groups">${groupChecks('nu',[])}</span>
    <button class="btn primary" id="nu_add">ユーザー追加</button><span class="err" id="nu_err"></span>`;
  document.getElementById('nu_add').onclick=addUser;
  document.querySelectorAll('#users [data-act]').forEach(b=>b.onclick=()=>{
    const tr=b.closest('tr'); const id=tr.dataset.id;
    if(b.dataset.act==='del') return delUser(id);
    if(b.dataset.act==='edit') return editUser(tr,id,r.users.find(x=>x.id===id));
  });
}
function editUser(tr,id,u){
  const cell=tr.querySelector('td:nth-child(5)');
  cell.innerHTML=`<div class="editbox">
    <input id="e_name" value="${esc(u.name)}" placeholder="氏名" style="width:110px">
    <input id="e_title" value="${esc(u.title)}" placeholder="役職" style="width:100px">
    <div style="margin-top:8px">
      <input id="e_username" value="${esc(u.username||'')}" placeholder="ログイン名" style="width:130px">
      <input id="e_password" type="text" value="" placeholder="新パスワード（変更時のみ）" style="width:180px">
      <select id="e_role"><option value="member" ${u.role!=='admin'?'selected':''}>一般</option><option value="admin" ${u.role==='admin'?'selected':''}>管理者</option></select>
    </div>
    <div style="margin-top:8px">${groupChecks('e',u.groups)}</div>
    <div style="margin-top:8px"><button class="btn primary" id="e_save">保存</button> <button class="btn" id="e_cancel">取消</button><span class="err" id="e_err"></span></div>
  </div>`;
  document.getElementById('e_cancel').onclick=loadUsers;
  document.getElementById('e_save').onclick=async()=>{
    const body={name:document.getElementById('e_name').value,title:document.getElementById('e_title').value,
      username:document.getElementById('e_username').value,role:document.getElementById('e_role').value,groups:checkedGroups('e')};
    const pw=document.getElementById('e_password').value;
    if(pw) body.password=pw;
    const res=await af('/api/admin/users/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(res.ok) loadUsers(); else document.getElementById('e_err').textContent=(await res.json()).error||'エラー';
  };
}
async function addUser(){
  const username=document.getElementById('nu_username').value.trim();
  if(!username){ document.getElementById('nu_err').textContent='ログイン名は必須です'; return; }
  const body={name:document.getElementById('nu_name').value,
    title:document.getElementById('nu_title').value,username,
    password:document.getElementById('nu_password').value,role:document.getElementById('nu_role').value,groups:checkedGroups('nu')};
  const res=await af('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(res.ok) loadUsers(); else document.getElementById('nu_err').textContent=(await res.json()).error||'エラー';
}
async function delUser(id){
  if(!confirm(`ユーザー「${id}」を削除しますか？`)) return;
  const res=await af('/api/admin/users/'+encodeURIComponent(id),{method:'DELETE'});
  if(res.ok) loadUsers();
}
async function addGroup(){
  const body={id:document.getElementById('gid').value,label:document.getElementById('glabel').value};
  const res=await af('/api/admin/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(res.ok){document.getElementById('gid').value='';document.getElementById('glabel').value='';loadUsers();}
  else document.getElementById('gerr').textContent=(await res.json()).error||'エラー';
}

/* ---- 監査ログ + ダッシュボード ---- */
let AUDIT_DATA=null;
async function loadAudit(){
  const a=await (await af('/api/admin/audit')).json();
  AUDIT_DATA=a;
  const tb=document.querySelector('#audit tbody');
  if(!tb) return;
  if(!a.log.length){tb.innerHTML='<tr><td colspan="5" class="muted">まだ質問がありません。チャット画面で質問するとここに記録されます。</td></tr>';}
  else{
    tb.innerHTML=a.log.map((l,i)=>{
      const cited=l.blocked?'<span class="muted">なし</span>':(esc((l.cited||[]).join('、'))||'<span class="muted">なし</span>');
      const res=l.blocked?'<span class="blk">権限ブロック</span>':'<span class="okq">回答</span>';
      return `<tr class="nd-fade" style="${ndDelay(i)}"><td>${esc(l.user_name)}</td><td>${esc(l.query)}</td><td class="src2">${cited}</td><td>${l.visible_docs}/${l.total_docs}</td><td>${res}</td></tr>`;
    }).join('');
  }
  renderDashboard(a);
}
let DASH_PREV={total:0,knowledge_gap:0};
function pct(part,total){ return total>0 ? Math.round(part/total*100) : 0; }
function interpretRecentWindow(rw){
  if(!rw || !rw.n) return 'まだ質問が十分に蓄積されていません。';
  const gapPct=pct(rw.gap,rw.n), blkPct=pct(rw.blocked,rw.n), ansPct=pct(rw.answered,rw.n);
  if(rw.gap===0 && rw.blocked===0) return `直近${rw.n}問はすべて資料から回答できています。良好な状態です。`;
  if(rw.gap>0 && gapPct>=blkPct) return `資料不足（${gapPct}%）が最大の要因です。「ナレッジの穴」の優先FAQ化を推奨します。`;
  if(rw.blocked>0) return `権限による遮断が${blkPct}%あります。グループのACL設定を見直すと解決できる可能性があります。`;
  return `回答到達率は${ansPct}%です。`;
}
function distributionInterpretation(dist,total){
  if(!dist.length || !total) return 'まだ引用データがありません。';
  const top=dist[0];
  return `「${top.doc_type}」が引用全体の${pct(top.count,total)}%を占め、最も参照されている領域です。`;
}
function renderDashboard(a){
  const ovRow=document.getElementById('ov-row');
  if(!ovRow) return;
  const s=a.stats||{total:0,answered:0,blocked:0,knowledge_gap:0,recent_window:{n:0,answered:0,blocked:0,gap:0}};
  const rw=s.recent_window||{n:0,answered:0,blocked:0,gap:0};
  const orgDaily=a.org_daily||[];
  const recentSum=orgDaily.reduce((acc,d)=>acc+d.count,0);
  const gapShare=pct(s.knowledge_gap,s.total);
  ovRow.innerHTML=`
    <div class="ov-tile nd-fade" style="${ndDelay(0)}">
      <div class="ov-label">総質問数（全期間）</div>
      <div class="ov-num" id="ov_total">0</div>
      <div class="ov-note">うち直近14日間で${recentSum}件</div>
    </div>
    <div class="ov-tile ov-band nd-fade" style="${ndDelay(1)}">
      <div class="ov-band-title">直近${rw.n||0}問の内訳</div>
      <div class="ov-band-track">
        <div class="ov-band-seg answered" id="ov_seg_ans" style="width:0%"></div>
        <div class="ov-band-seg gapseg" id="ov_seg_gap" style="width:0%"></div>
        <div class="ov-band-seg blockedseg" id="ov_seg_blk" style="width:0%"></div>
      </div>
      <div class="ov-band-legend">
        <span class="lg"><span class="sw" style="background:var(--accent)"></span>回答到達 ${rw.answered}件（${pct(rw.answered,rw.n)}%）</span>
        <span class="lg"><span class="sw" style="background:#f2b01e"></span>資料不足 ${rw.gap}件（${pct(rw.gap,rw.n)}%）</span>
        <span class="lg"><span class="sw" style="background:var(--danger)"></span>権限ブロック ${rw.blocked}件（${pct(rw.blocked,rw.n)}%）</span>
      </div>
      <div class="ov-band-note">${esc(interpretRecentWindow(rw))}</div>
    </div>
    <div class="ov-tile nd-fade${s.knowledge_gap>0?' warn':''}" style="${ndDelay(2)}">
      <div class="ov-label">ナレッジの穴（全期間）</div>
      <div class="ov-num" id="ov_gap">0</div>
      <div class="ov-note">${s.knowledge_gap>0?`全質問の${gapShare}%が資料不足で未回答`:'資料が網羅できています'}</div>
    </div>`;
  animateCountUp(document.getElementById('ov_total'),DASH_PREV.total,s.total);
  animateCountUp(document.getElementById('ov_gap'),DASH_PREV.knowledge_gap,s.knowledge_gap);
  DASH_PREV={total:s.total,knowledge_gap:s.knowledge_gap};
  requestAnimationFrame(()=>{
    const segAns=document.getElementById('ov_seg_ans'), segGap=document.getElementById('ov_seg_gap'), segBlk=document.getElementById('ov_seg_blk');
    if(segAns) segAns.style.width=pct(rw.answered,rw.n)+'%';
    if(segGap) segGap.style.width=pct(rw.gap,rw.n)+'%';
    if(segBlk) segBlk.style.width=pct(rw.blocked,rw.n)+'%';
  });
  renderOrgTrend(orgDaily,{svg:'dashTrendSvg',maxLabel:'dashTrendMaxLabel',startLabel:'dashTrendStartLabel',endLabel:'dashTrendEndLabel',caption:'dashTrendCaption'});

  const topq=document.getElementById('topq');
  const topMax=(a.top_questions&&a.top_questions.length)?Math.max(...a.top_questions.map(q=>q.count)):0;
  topq.innerHTML=(a.top_questions&&a.top_questions.length)
    ? a.top_questions.map((q,i)=>{
        const w=topMax>0?Math.round(q.count/topMax*100):0;
        const op=Math.max(.32,1-i*.09).toFixed(2);
        return `<div class="rank-row nd-fade" style="${ndDelayFrom(.22,i)}">
          <div class="rank-num">${String(i+1).padStart(2,'0')}</div>
          <div class="rank-main">
            <div class="rank-top"><span class="rank-question">${esc(q.question)}</span><span class="rank-count">${q.count}件</span></div>
            <div class="rank-bar-track"><div class="rank-bar-fill" data-w="${w}" style="width:0%;opacity:${op}"></div></div>
            <div class="rank-meta">最後に聞いた人: ${esc(q.last_user||'?')} ・ ${fmtWhen(q.last_asked)}</div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-note">まだ質問がありません。</div>';
  requestAnimationFrame(()=>{
    topq.querySelectorAll('.rank-bar-fill').forEach(elm=>{ elm.style.width=(elm.dataset.w||0)+'%'; });
  });

  const gapBase=.22+Math.min((a.top_questions||[]).length,12)*.055+.12;
  const gapq=document.getElementById('gapq');
  gapq.innerHTML=(a.knowledge_gaps&&a.knowledge_gaps.length)
    ? a.knowledge_gaps.map((q,i)=>`<div class="gap-card nd-fade" style="${ndDelayFrom(gapBase,i)}">
        <div class="gap-badge">FAQ化候補</div>
        <div class="gap-top"><span class="gap-question">${esc(q.question)}</span><span class="gap-count">${q.count}件</span></div>
        <div class="gap-meta">最後に聞いた人: ${esc(q.last_user||'?')} ・ ${fmtWhen(q.last_asked)}</div>
      </div>`).join('')
    : `<div class="gap-empty nd-fade" style="${ndDelayFrom(gapBase,0)}">
        <div class="gap-empty-mark"></div>
        <div class="gap-empty-title">ナレッジの穴はありません</div>
        <div class="gap-empty-sub">資料が網羅できています。</div>
      </div>`;

  const distWrap=document.getElementById('doctypedist');
  const dist=a.doc_type_distribution||[];
  if(!dist.length){
    distWrap.innerHTML='<div class="empty-note">まだ引用データがありません。</div>';
  }else{
    const distTotal=dist.reduce((acc,d)=>acc+d.count,0);
    const distMax=Math.max(...dist.map(d=>d.count));
    distWrap.innerHTML=dist.map((d,i)=>{
      const w=distMax>0?Math.round(d.count/distMax*100):0;
      return `<div class="dist-row nd-fade" style="${ndDelayFrom(gapBase+.12,i)}">
        <div class="dist-label">${esc(d.doc_type)}</div>
        <div class="dist-bar-track"><div class="dist-bar-fill" data-w="${w}" style="width:0%"></div></div>
        <div class="dist-count">${d.count}件・${pct(d.count,distTotal)}%</div>
      </div>`;
    }).join('') + `<div class="dist-note">${esc(distributionInterpretation(dist,distTotal))}</div>`;
    requestAnimationFrame(()=>{
      distWrap.querySelectorAll('.dist-bar-fill').forEach(elm=>{ elm.style.width=(elm.dataset.w||0)+'%'; });
    });
  }

  const citedWrap=document.getElementById('topcited');
  const cited=a.top_cited_docs||[];
  const thin=a.thin_citation_count||0;
  if(!cited.length){
    citedWrap.innerHTML='<div class="empty-note">まだ引用データがありません。</div>';
  }else{
    citedWrap.innerHTML=cited.map((d,i)=>`<div class="cited-row nd-fade" style="${ndDelayFrom(gapBase+.12,i)}">
        <div class="cited-num">${i+1}</div>
        <div class="cited-main"><div class="cited-title">${esc(d.title)}</div><div class="cited-type">${esc(d.doc_type||'')}</div></div>
        <div class="cited-count">${d.count}件</div>
      </div>`).join('')
      + (thin>0
        ? `<div class="cited-note">引用が1件のみだった質問が${thin}件あります。将来の穴の予兆です。</div>`
        : `<div class="cited-note">引用が薄い質問は現在ありません。</div>`);
  }
}

/* ---- AI改善提案 ---- */
let INSIGHTS_RUNNING=false;
async function loadInsights(){
  const r=await (await af('/api/admin/insights')).json();
  renderInsights(r);
}
function renderInsights(r){
  const wrap=document.getElementById('insights-body');
  if(!wrap) return;
  wrap.classList.add('ins-panel');
  const report=r&&r.report;
  if(!report){
    wrap.innerHTML=`<div class="ins-empty">
      <p class="muted">ナレッジDB全体を横断し、構造的な課題・重複・属人化・改善余地をAIが洗い出します。</p>
      <button class="btn primary" id="ins_run">AIで分析する</button>
    </div>`;
    document.getElementById('ins_run').onclick=runInsights;
    return;
  }
  const findings=report.findings||[];
  wrap.innerHTML=`
    <div class="ins-head">
      <div class="ins-summary">${esc(report.summary||'')}</div>
      <div class="ins-meta">
        <span class="muted">生成日時: ${fmtWhen(r.created_at)}</span>
        <button class="btn" id="ins_run">再分析する</button>
      </div>
    </div>
    <div class="ins-list">
      ${findings.map((f,i)=>`
        <div class="ins-row ins-${esc(f.category)} nd-fade" style="${ndDelay(i)}">
          <div class="ins-cat">${esc(INSIGHT_CATEGORY_LABELS[f.category]||f.category||'')}</div>
          <div class="ins-body">
            <div class="ins-title">${esc(f.title)}</div>
            <div class="ins-detail">${esc(f.detail)}</div>
            ${(f.evidence_titles&&f.evidence_titles.length)?`<div class="ins-evidence">${f.evidence_titles.map(t=>`<span class="tag">${esc(stripExt(t))}</span>`).join('')}</div>`:''}
            <div class="ins-suggestion"><span class="ins-suggestion-label">改善アクション</span>${esc(f.suggestion)}</div>
          </div>
        </div>`).join('')||'<div class="empty-note" style="padding:0 32px 24px">指摘事項はありませんでした。</div>'}
    </div>`;
  document.getElementById('ins_run').onclick=runInsights;
}
async function runInsights(){
  if(INSIGHTS_RUNNING) return;
  INSIGHTS_RUNNING=true;
  const btn=document.getElementById('ins_run');
  const prevText=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.innerHTML='分析中<span class="nd-dots"><span></span><span></span><span></span></span>';}
  try{
    const res=await af('/api/admin/insights',{method:'POST'});
    const r=await res.json().catch(()=>null);
    if(res.ok&&r){ renderInsights(r); }
    else{
      toast((r&&r.error)||'分析に失敗しました');
      if(btn){btn.disabled=false;btn.textContent=prevText;}
    }
  }catch(e){
    toast('分析に失敗しました');
    if(btn){btn.disabled=false;btn.textContent=prevText;}
  }
  INSIGHTS_RUNNING=false;
}

/* ---- メンバー分析 ---- */
let MEMBER_STATS_PREV={};
function fmtLastActive(iso){ return iso ? fmtWhen(iso) : '未利用'; }
async function loadMemberStats(){
  const r=await (await af('/api/members/stats')).json();
  renderMemberStats(r.members||[]);
  renderOrgTrend(r.org_daily||[]);
}
function renderMemberStats(members){
  const tbody=document.querySelector('#members-stats tbody');
  if(!tbody) return;
  if(!members.length){
    tbody.innerHTML='<tr><td colspan="7" class="muted">メンバーがいません。</td></tr>';
    return;
  }
  tbody.innerHTML=members.map((m,i)=>`
    <tr class="nd-fade" style="${ndDelay(i)}">
      <td><div style="font-weight:600">${esc(m.name)}</div><div class="muted" style="font-size:12.5px">${esc(m.title)}</div></td>
      <td class="num" id="ms_q_${esc(m.user_id)}">0</td>
      <td class="num" id="ms_b_${esc(m.user_id)}">0</td>
      <td class="num" id="ms_u_${esc(m.user_id)}">0</td>
      <td><div class="mem-doctypes">${(m.top_doc_types||[]).map(t=>`<span class="tag">${esc(t.doc_type)} ${t.count}</span>`).join('')||'<span class="muted">なし</span>'}</div></td>
      <td><div class="spark-wrap"><svg class="spark-svg" id="spark_${esc(m.user_id)}" viewBox="0 0 100 30" preserveAspectRatio="none" role="img"></svg></div></td>
      <td class="src2">${esc(fmtLastActive(m.last_active))}</td>
    </tr>`).join('');
  members.forEach(m=>{
    const prev=MEMBER_STATS_PREV[m.user_id]||{q:0,b:0,u:0};
    animateCountUp(document.getElementById('ms_q_'+m.user_id), prev.q, m.question_count);
    animateCountUp(document.getElementById('ms_b_'+m.user_id), prev.b, m.blocked_count);
    animateCountUp(document.getElementById('ms_u_'+m.user_id), prev.u, m.unanswered_count);
    MEMBER_STATS_PREV[m.user_id]={q:m.question_count,b:m.blocked_count,u:m.unanswered_count};
    const svg=document.getElementById('spark_'+m.user_id);
    if(svg) renderSparkline(svg, m.daily||[], m.name);
  });
}

/* ---- 時系列チャート共通部品(自前SVG) ---- */
function chartTipShow(clientX,clientY,html){
  const t=document.getElementById('chartTip'); if(!t) return;
  t.innerHTML=html;
  t.classList.add('show');
  const tx=Math.max(8, Math.min(clientX+14, window.innerWidth-232));
  const ty=Math.max(8, clientY-40);
  t.style.left=tx+'px'; t.style.top=ty+'px';
}
function chartTipHide(){ const t=document.getElementById('chartTip'); if(t) t.classList.remove('show'); }
function niceAxisMax(maxVal){ return Math.max(4, Math.ceil(Math.max(maxVal,4)/4)*4); }
function fmtShortDate(iso){ const d=new Date(iso+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}`; }
function bandPath(lowerVals, upperVals, xFn, yFn, n){
  let d='';
  for(let i=0;i<n;i++) d+=(i===0?'M':'L')+xFn(i).toFixed(1)+','+yFn(upperVals[i]).toFixed(1)+' ';
  for(let i=n-1;i>=0;i--) d+='L'+xFn(i).toFixed(1)+','+yFn(lowerVals[i]).toFixed(1)+' ';
  return d+'Z';
}
function linePath(vals, xFn, yFn, n){
  let d='';
  for(let i=0;i<n;i++) d+=(i===0?'M':'L')+xFn(i).toFixed(1)+','+yFn(vals[i]).toFixed(1)+' ';
  return d;
}
function animateStroke(path, duration){
  if(!path) return;
  try{
    const len=path.getTotalLength();
    path.style.strokeDasharray=len; path.style.strokeDashoffset=len;
    requestAnimationFrame(()=>{
      path.style.transition=`stroke-dashoffset ${duration||0.8}s ease`;
      path.style.strokeDashoffset=0;
    });
  }catch(e){}
}
const ORG_TREND_DEFAULT_IDS={svg:'orgTrendSvg',maxLabel:'orgTrendMaxLabel',startLabel:'orgTrendStartLabel',endLabel:'orgTrendEndLabel',caption:null};
function renderOrgTrend(orgDaily,ids){
  ids=Object.assign({},ORG_TREND_DEFAULT_IDS,ids||{});
  const svg=document.getElementById(ids.svg);
  if(!svg) return;
  if(!orgDaily || !orgDaily.length){ svg.innerHTML=''; return; }
  const W=880,H=220,padL=8,padR=8,padT=10,padB=10;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const n=orgDaily.length;
  const answered=orgDaily.map(d=>Math.max(0,d.count-d.blocked-d.gap));
  const gap=orgDaily.map(d=>d.gap);
  const blocked=orgDaily.map(d=>d.blocked);
  const cum0=orgDaily.map(()=>0);
  const cum1=answered.slice();
  const cum2=answered.map((v,i)=>v+gap[i]);
  const cum3=answered.map((v,i)=>v+gap[i]+blocked[i]);
  const axisMax=niceAxisMax(Math.max(...cum3,0));
  const x=i=> padL + (n>1 ? i/(n-1)*innerW : innerW/2);
  const y=v=> padT + innerH - (v/axisMax)*innerH;
  const gridYs=[0.25,0.5,0.75].map(f=>padT+innerH*(1-f));
  const gridHtml=gridYs.map(gy=>`<line class="gridline" x1="${padL}" x2="${W-padR}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}"/>`).join('');
  const hoverW=innerW/n;
  const hoverHtml=orgDaily.map((d,i)=>{
    const cx=padL+i*hoverW;
    return `<rect class="hoverrect" data-i="${i}" x="${cx.toFixed(1)}" y="${padT}" width="${hoverW.toFixed(1)}" height="${innerH.toFixed(1)}"/>`;
  }).join('');
  svg.innerHTML=`
    ${gridHtml}
    <path class="band" fill="rgba(74,108,245,.30)" d="${bandPath(cum0,cum1,x,y,n)}"/>
    <path class="band" fill="rgba(74,108,245,.55)" d="${bandPath(cum1,cum2,x,y,n)}"/>
    <path class="band" fill="var(--danger)" fill-opacity="0.45" d="${bandPath(cum2,cum3,x,y,n)}"/>
    <path class="topline" id="${ids.svg}_top" d="${linePath(cum3,x,y,n)}"/>
    ${hoverHtml}`;
  const maxLabelEl=document.getElementById(ids.maxLabel);
  const startLabelEl=document.getElementById(ids.startLabel);
  const endLabelEl=document.getElementById(ids.endLabel);
  if(maxLabelEl) maxLabelEl.textContent=`最大 ${axisMax}件/日`;
  if(startLabelEl) startLabelEl.textContent=fmtShortDate(orgDaily[0].date);
  if(endLabelEl) endLabelEl.textContent=fmtShortDate(orgDaily[n-1].date);
  const topId=ids.svg+'_top';
  requestAnimationFrame(()=>{
    svg.querySelectorAll('.band').forEach(b=>b.classList.add('show'));
    animateStroke(document.getElementById(topId));
  });
  svg.querySelectorAll('.hoverrect').forEach(r=>{
    r.addEventListener('mousemove',ev=>{
      const i=Number(r.dataset.i);
      const d=orgDaily[i];
      chartTipShow(ev.clientX, ev.clientY,
        `<b>${esc(fmtShortDate(d.date))}</b>合計 ${d.count}件（回答済み ${answered[i]} ／ 資料なし ${d.gap} ／ ブロック ${d.blocked}）`);
    });
    r.addEventListener('mouseleave', chartTipHide);
  });
  if(ids.caption){
    const capEl=document.getElementById(ids.caption);
    if(capEl){
      const sum=orgDaily.reduce((a2,d)=>a2+d.count,0);
      if(!sum){
        capEl.textContent='直近14日間はまだ質問がありません。';
      }else{
        let peak=orgDaily[0];
        for(const d of orgDaily) if(d.count>peak.count) peak=d;
        capEl.textContent=`直近14日間の合計は${sum}件。最も質問が多かったのは${fmtShortDate(peak.date)}（${peak.count}件）。`;
      }
    }
  }
}
function renderSparkline(svg, daily, name){
  if(!daily || !daily.length){ svg.innerHTML=''; return; }
  const W=100,H=30,pad=3;
  const n=daily.length;
  const vals=daily.map(d=>d.count);
  const max=Math.max(...vals,1);
  const x=i=> pad + (n>1 ? i/(n-1)*(W-2*pad) : (W-2*pad)/2);
  const y=v=> H-pad - (v/max)*(H-2*pad);
  const d=linePath(vals,x,y,n);
  const lastX=x(n-1), lastY=y(vals[n-1]);
  svg.innerHTML=`<path class="spark-line" id="${svg.id}_line" d="${d}"/><circle class="spark-dot" cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.2"/>`;
  requestAnimationFrame(()=>animateStroke(document.getElementById(svg.id+'_line')));
  svg.addEventListener('mousemove',ev=>{
    const rect=svg.getBoundingClientRect();
    const relX=(ev.clientX-rect.left)/rect.width*W;
    let i=Math.round((relX-pad)/(W-2*pad)*(n-1));
    i=Math.max(0,Math.min(n-1,i));
    const dd=daily[i];
    chartTipShow(ev.clientX, ev.clientY, `<b>${esc(fmtShortDate(dd.date))}</b>${esc(name)}：${dd.count}件（ブロック${dd.blocked}）`);
  });
  svg.addEventListener('mouseleave', chartTipHide);
}

/* ---- メンバーAI定性分析 ---- */
let MEMBER_ANALYSIS_RUNNING=false;
async function loadMemberAnalysis(){
  const r=await (await af('/api/members/analysis')).json();
  renderMemberAnalysis(r);
}
function renderMemberAnalysis(r){
  const wrap=document.getElementById('members-analysis-body');
  if(!wrap) return;
  wrap.classList.add('ins-panel');
  const a=r&&r.analysis;
  const members=(a&&a.members)||[];
  if(!members.length){
    wrap.innerHTML=`<div class="ins-empty">
      <p class="muted">メンバーごとの質問傾向から、役割・関心領域・情報ギャップをAIが推定します。</p>
      <button class="btn primary" id="mem_run">AIで分析する</button>
    </div>`;
    document.getElementById('mem_run').onclick=runMemberAnalysis;
    return;
  }
  wrap.innerHTML=`
    <div class="ins-head">
      <div class="ins-summary">${esc(a.org_note||'')}</div>
      <div class="ins-meta">
        <span class="muted">生成日時: ${fmtWhen(r.created_at)}</span>
        <button class="btn" id="mem_run" style="white-space:nowrap">再分析する</button>
      </div>
    </div>
    <div class="mem-cards">
      ${members.map((m,i)=>`
        <div class="mem-card nd-fade" style="${ndDelay(i)}">
          <div class="mc-name">${esc(m.name||'')}</div>
          <div class="mc-role">${esc(m.inferred_role||'')}</div>
          <div class="mc-summary">${esc(m.summary||'')}</div>
          ${(m.gaps&&m.gaps.length)?`<div class="mc-sec"><span class="mc-sec-label">足りていないもの</span><ul>${m.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>`:''}
          ${(m.risks&&m.risks.length)?`<div class="mc-sec risk"><span class="mc-sec-label">リスク</span><ul>${m.risks.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>`:''}
          ${m.suggestion?`<div class="mc-suggestion"><span class="ins-suggestion-label">管理者への提案</span>${esc(m.suggestion)}</div>`:''}
        </div>`).join('')}
    </div>`;
  document.getElementById('mem_run').onclick=runMemberAnalysis;
}
async function runMemberAnalysis(){
  if(MEMBER_ANALYSIS_RUNNING) return;
  MEMBER_ANALYSIS_RUNNING=true;
  const btn=document.getElementById('mem_run');
  const prevText=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.innerHTML='分析中<span class="nd-dots"><span></span><span></span><span></span></span>';}
  try{
    const res=await af('/api/members/analyze',{method:'POST'});
    const r=await res.json().catch(()=>null);
    if(res.ok&&r){ renderMemberAnalysis(r); }
    else{
      toast((r&&r.error)||'分析に失敗しました');
      if(btn){btn.disabled=false;btn.textContent=prevText;}
    }
  }catch(e){
    toast('分析に失敗しました');
    if(btn){btn.disabled=false;btn.textContent=prevText;}
  }
  MEMBER_ANALYSIS_RUNNING=false;
}
