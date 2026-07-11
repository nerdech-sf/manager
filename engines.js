/* =====================================================================
   マネージャー(3Dケーキ/つながりグラフ)・業務構造(AI業務フロー)・分析
   — 旧index.htmlの描画エンジンを移植(Frame 2/20シェル内に描画する)。
   ===================================================================== */

/* ---------------- マネージャー(ナレッジの見取り図) ---------------- */
let DOCS=[];
let MGR_AGG=false;
let MGR_TIERS=new Set(['core','deliverable','reference']);
let ALL_TYPES=[];
let MGR_TYPES=null;
const TYPE_PALETTE=['#4a6cf5','#e8703a','#f2b01e','#22a06b','#0a9ea4','#a24bd8','#e5484d','#ec4899','#5b8def','#8a90a0'];
const TYPE_COLOR_CACHE={};
function typeColor(t){
  if(!TYPE_COLOR_CACHE[t]){
    const keys=Object.keys(TYPE_COLOR_CACHE);
    TYPE_COLOR_CACHE[t]=TYPE_PALETTE[keys.length % TYPE_PALETTE.length];
  }
  return TYPE_COLOR_CACHE[t];
}

async function loadDocs(){
  const r=await apiFetch('/documents',{headers:authHeaders()});
  DOCS = r.ok ? await r.json() : [];
  DOCS.sort((a,b)=> new Date(b.updated_at) - new Date(a.updated_at));
  const types=new Set(DOCS.map(d=>d.doc_type||'一般'));
  types.forEach(t=>{ if(!ALL_TYPES.includes(t)) ALL_TYPES.push(t); });
  if(MGR_TYPES===null) MGR_TYPES=new Set(ALL_TYPES);
  else types.forEach(t=>MGR_TYPES.add(t));
}
function visibleDocs(){
  return DOCS.filter(d=>MGR_TIERS.has(tierOf(d.importance)) && MGR_TYPES.has(d.doc_type||'一般'));
}

/* === data cake 3D投影エンジン === */
const APEX={x:300,y:650};
const RHO0=100, RHO1=520;
const THETA0=0, THETA1=90;
const SX=1.10, DEPTH_X=0, DEPTH_Y=0.50;
const SLAB_T=66;
const LAYER_H=Math.ceil(RHO1*DEPTH_Y+SLAB_T)+24;
const LAYER_SCALE=[1.0,0.80,0.62];
const layerFactor=pos=>0.72+0.28*LAYER_SCALE[pos];
let azimuth=0;
const AZ_MIN=-1.5, AZ_MAX=1.5;
function proj(rho, thetaDeg, pos){
  const ca=Math.cos(azimuth), sa=Math.sin(azimuth);
  const r=rho*LAYER_SCALE[pos];
  const a=thetaDeg*Math.PI/180;
  const fx=r*Math.sin(a), fy=r*Math.cos(a);
  const gx=fx*ca-fy*sa, gy=fx*sa+fy*ca;
  const br=RHO1*LAYER_SCALE[pos], ba=Math.PI/4;
  const bfx=br*Math.sin(ba), bfy=br*Math.cos(ba);
  const bgx=bfx*ca-bfy*sa, bgy=bfx*sa+bfy*ca;
  const offX=-(bgx*SX+bgy*DEPTH_X);
  const x=APEX.x+gx*SX+gy*DEPTH_X+offX;
  const y=APEX.y-gy*DEPTH_Y-pos*LAYER_H;
  return [x,y];
}
function sampleArc(rho,t0,t1,pos,n){const out=[];for(let i=0;i<=n;i++)out.push(proj(rho,t0+(t1-t0)*i/n,pos));return out;}
const ptsToPath=(pts,close)=>'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')+(close?' Z':'');

let NODES={};
const nodeR=nd=>13*layerFactor(nd.pos);

function computeGraph(){
  const docs=visibleDocs();
  const times=docs.map(d=>+new Date(d.updated_at));
  const tMax=times.length?Math.max(...times):0, tMin=times.length?Math.min(...times):0, tRange=(tMax-tMin)||1;
  NODES={};
  const lo=THETA0+8, hi=THETA1-8;
  [0,1,2].forEach(tier=>{
    const fs=docs.filter(d=>tierNumOf(d)===tier);
    const m=fs.length;
    fs.forEach((d,k)=>{
      const theta = m>1 ? lo+(k/(m-1))*(hi-lo) : (lo+hi)/2;
      const pos=2-tier;
      const age=(tMax-(+new Date(d.updated_at)))/tRange;
      const rho=RHO0+age*(RHO1-RHO0)+(k%2?7:-7);
      const [x,y]=proj(rho,theta,pos);
      NODES[d.id]={doc:d, tier, pos, theta, rho, x, y};
    });
  });
}

let VB={x:0,y:0,s:900};
function buildGraph(){
  const svgEl=document.getElementById('cake');
  if(!svgEl) return;
  svgEl.innerHTML='';
  const g=el('g',{}); svgEl.appendChild(g);
  const slabTopFill=['#ffffff','#fbfcfe','#f6f9fc'];
  const slabSideFill=['#dde4ec','#dde4ec','#dde4ec'];
  for(let pos=0;pos<3;pos++){
    const far=sampleArc(RHO1,THETA0,THETA1,pos,30);
    const near=sampleArc(RHO0,THETA1,THETA0,pos,16);
    const top=far.concat(near);
    const frontLine=[proj(RHO1,THETA1,pos)].concat(sampleArc(RHO0,THETA1,THETA0,pos,16)).concat([proj(RHO1,THETA0,pos)]);
    const frontDown=frontLine.map(p=>[p[0],p[1]+SLAB_T]).reverse();
    const gs=el('g',{});
    gs.appendChild(el('path',{d:ptsToPath(frontLine.concat(frontDown),true), fill:slabSideFill[pos], stroke:'#c3ccd8','stroke-width':'1.4','stroke-linejoin':'round'}));
    gs.appendChild(el('path',{d:ptsToPath(top,true), fill:slabTopFill[pos], stroke:'#c3ccd8','stroke-width':'1.4','stroke-linejoin':'round'}));
    g.appendChild(gs);
    const [lx,ly]=proj(RHO1,THETA0,pos);
    const t=TIER_DEF[TIER_BY_ID[2-pos]];
    const t1=el('text',{x:lx-14,y:ly-2,'text-anchor':'end','font-size':'16','font-weight':'700',fill:'#2a3340'}); t1.textContent=t.label;
    const t2=el('text',{x:lx-14,y:ly+15,'text-anchor':'end','font-size':'11','font-weight':'500',fill:'#9aa4b1'}); t2.textContent=t.sub;
    g.appendChild(t1); g.appendChild(t2);
  }
  const [ax,ay]=proj(0,0,0);
  const [ox,oy]=proj(RHO1,45,0);
  const an1=el('text',{x:ax+8,y:ay+SLAB_T+24,'text-anchor':'start','font-size':'12.5','font-weight':'500',fill:'#b2bac6'}); an1.textContent='新しい（中心）';
  const an2=el('text',{x:ox+10,y:oy-8,'text-anchor':'start','font-size':'12.5','font-weight':'500',fill:'#b2bac6'}); an2.textContent='古い（外周）';
  g.appendChild(an1); g.appendChild(an2);

  if(MGR_AGG){
    buildClusters(g);
    g.appendChild(el('g',{id:'cakeFx'}));
  } else {
    const gN=el('g',{id:'cakeNodes'});
    Object.values(NODES).sort((m,n)=>(m.pos-n.pos)||(n.rho-m.rho)).forEach(nd=>{
      const col=typeColor(nd.doc.doc_type||'一般');
      const c=el('circle',{cx:nd.x,cy:nd.y,r:nodeR(nd),fill:col,stroke:'#ffffff','stroke-width':'2.4',tabindex:'0',role:'button'});
      c.style.cursor='pointer';
      c.dataset.id=nd.doc.id;
      c.setAttribute('aria-label',`${nd.doc.title}｜${nd.doc.doc_type||'一般'}｜${TIER_DEF[tierOf(nd.doc.importance)].label}`);
      const ttl=el('title',{}); ttl.textContent=`${nd.doc.title} — ${nd.doc.doc_type||'一般'} / ${TIER_DEF[tierOf(nd.doc.importance)].label}`; c.appendChild(ttl);
      const enter=()=>{ if(!cakeSelected){ cakeHover=nd.doc.id; cakeRender(); } };
      const leave=()=>{ if(!cakeSelected){ cakeHover=null; cakeRender(); } hideTip(); };
      c.addEventListener('mouseenter', ev=>{ enter(); showTipEvent(ev,nd); });
      c.addEventListener('mousemove', ev=>moveTip(ev));
      c.addEventListener('mouseleave', leave);
      c.addEventListener('focus', ()=>{ enter(); showTipNode(nd); });
      c.addEventListener('blur', leave);
      const toggle=()=>{ cakeSelected = cakeSelected===nd.doc.id?null:nd.doc.id; cakeRender(); };
      c.addEventListener('click', ev=>{ ev.stopPropagation(); toggle(); });
      c.addEventListener('keydown', ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); toggle(); } });
      gN.appendChild(c);
    });
    g.appendChild(gN);
    g.appendChild(el('g',{id:'cakeFx'}));
  }
  fitViewBox();
}
function fitViewBox(){
  const svgEl=document.getElementById('cake');
  const bb=svgEl.getBBox(); const pad=30;
  let x=bb.x-pad,y=bb.y-pad,w=bb.width+2*pad,h=bb.height+2*pad;
  const s=Math.max(w,h);
  x-=(s-w)/2; y-=(s-h)/2;
  svgEl.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${s.toFixed(1)} ${s.toFixed(1)}`);
  VB={x,y,s};
}
function buildClusters(g){
  const groups={};
  Object.values(NODES).forEach(nd=>{
    const key=nd.tier+'|'+(nd.doc.doc_type||'一般');
    (groups[key]=groups[key]||{tier:nd.tier,kind:nd.doc.doc_type||'一般',nodes:[]}).nodes.push(nd);
  });
  const byTier={0:[],1:[],2:[]};
  Object.values(groups).forEach(grp=>byTier[grp.tier].push(grp));
  const gC=el('g',{});
  [0,1,2].forEach(tier=>{
    const arr=byTier[tier];
    const m=arr.length, lo=THETA0+12, hi=THETA1-12, pos=2-tier;
    arr.forEach((grp,i)=>{
      const theta=m>1?lo+(i/(m-1))*(hi-lo):(lo+hi)/2;
      const rho=grp.nodes.reduce((s,n)=>s+n.rho,0)/grp.nodes.length;
      const [x,y]=proj(rho,theta,pos);
      const cnt=grp.nodes.length;
      const r=Math.max(13,Math.min(46,10+Math.sqrt(cnt)*7))*layerFactor(pos);
      const c=el('circle',{cx:x,cy:y,r:r,fill:typeColor(grp.kind),stroke:'#fff','stroke-width':'2.5'});
      c.style.cursor='pointer';
      c.addEventListener('mouseenter',ev=>tipCluster(ev,grp,cnt));
      c.addEventListener('mousemove',ev=>moveTip(ev));
      c.addEventListener('mouseleave',hideTip);
      gC.appendChild(c);
      const t=el('text',{x:x,y:y,'text-anchor':'middle','dominant-baseline':'central',fill:'#fff','font-weight':'700'});
      t.setAttribute('font-size', cnt>=100?13:15); t.textContent=cnt;
      gC.appendChild(t);
    });
  });
  g.appendChild(gC);
}
function tipCluster(ev,grp,cnt){
  document.getElementById('cakeTip').innerHTML=`<b>${esc(grp.kind)} × ${esc(TIER_DEF[TIER_BY_ID[grp.tier]].label)}</b><span>${cnt}件</span>`;
  document.getElementById('cakeTip').classList.add('show'); moveTip(ev);
}

let cakeSelected=null, cakeHover=null, _lastCakeSel=null;
function cakeRender(){
  if(cakeSelected && !NODES[cakeSelected]) cakeSelected=null;
  if(cakeHover && !NODES[cakeHover]) cakeHover=null;
  const active=cakeSelected||cakeHover;
  document.querySelectorAll('#cakeNodes circle').forEach(c=>{
    const nd=NODES[c.dataset.id]; if(!nd) return;
    const baseR=nodeR(nd);
    if(active){
      if(String(c.dataset.id)===String(active)){ c.setAttribute('r',baseR+4); c.setAttribute('fill-opacity',1); c.setAttribute('stroke-width','3'); }
      else { c.setAttribute('r',baseR); c.setAttribute('fill-opacity',0.15); c.setAttribute('stroke-width','2.4'); }
    } else { c.setAttribute('r',baseR); c.setAttribute('fill-opacity',1); c.setAttribute('stroke-width','2.4'); }
  });
  const fx=document.getElementById('cakeFx');
  if(fx){
    fx.innerHTML='';
    if(active && NODES[active]){
      const nd=NODES[active];
      fx.appendChild(el('circle',{cx:nd.x,cy:nd.y,r:nodeR(nd)+9,fill:'none',stroke:'#4a6cf5','stroke-width':'2.5'}));
      const t=el('text',{x:nd.x,y:nd.y-nodeR(nd)-9,'text-anchor':'middle','font-weight':'600',fill:'#20232b',stroke:'#fff','stroke-width':'3.4','paint-order':'stroke'});
      t.setAttribute('font-size','14');
      t.textContent=trunc(stripExt(nd.doc.title),18);
      fx.appendChild(t);
    }
  }
  document.querySelectorAll('.tl-item').forEach(r=>r.classList.toggle('hl', String(r.dataset.id)===String(active)));
  if(cakeSelected && cakeSelected!==_lastCakeSel){
    const r=document.querySelector(`.tl-item[data-id="${cakeSelected}"]`);
    if(r) r.scrollIntoView({behavior:'smooth',block:'center'});
  }
  _lastCakeSel=cakeSelected;
  renderCakeInspector();
}
function renderCakeInspector(){
  const ins=document.getElementById('cakeInsp');
  if(!ins) return;
  const active=cakeSelected;
  if(!active || !NODES[active]){ ins.classList.remove('show'); return; }
  const nd=NODES[active], d=nd.doc, tier=TIER_DEF[tierOf(d.importance)], col=typeColor(d.doc_type||'一般');
  ins.innerHTML=`
    <button class="insp-close" aria-label="閉じる">×</button>
    <div class="insp-head">
      <div class="insp-icon" style="background:${col}">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      </div>
      <div style="min-width:0">
        <div class="insp-name">${esc(stripExt(d.title))}</div>
        <div class="insp-crumb"><span class="d" style="background:${col}"></span>${esc(d.doc_type||'一般')} <i>·</i> ${esc(tier.label)}／${esc(tier.sub)}</div>
      </div>
    </div>
    <div class="insp-meta">
      <span class="mtag">${esc(d.doc_type||'一般')}</span>
      <span class="mtag">${esc(dateLabel(d.updated_at))}</span>
      <span class="mtag">${esc(fmtSize(d.size_bytes))}</span>
    </div>
    ${d.summary?`<p class="insp-sec">要約</p><p style="font-size:13.5px;color:#5b6270;line-height:1.7">${esc(d.summary)}</p>`:''}
    <button class="biz-preview-btn" style="margin-top:12px" data-id="${esc(d.id)}">${ICON.doc} 原本を見る</button>`;
  ins.querySelector('.insp-close').addEventListener('click',()=>{ cakeSelected=null; cakeHover=null; hideTip(); cakeRender(); });
  ins.querySelector('.biz-preview-btn').addEventListener('click',()=>openDocPreview(d.id));
  ins.classList.add('show');
}
function tipFill(nd){ document.getElementById('cakeTip').innerHTML=`<b>${esc(stripExt(nd.doc.title))}</b><span>${esc(nd.doc.doc_type||'一般')} · ${esc(TIER_DEF[tierOf(nd.doc.importance)].label)} · ${esc(dateLabel(nd.doc.updated_at))}</span>`; }
function clampTip(x,y){ x=Math.max(8,Math.min(x, innerWidth-244)); y=Math.max(8,Math.min(y, innerHeight-58)); return [x,y]; }
function showTipEvent(ev,nd){ tipFill(nd); document.getElementById('cakeTip').classList.add('show'); moveTip(ev); }
function showTipNode(nd){
  tipFill(nd); const t=document.getElementById('cakeTip'); t.classList.add('show');
  const svgEl=document.getElementById('cake'); const r=svgEl.getBoundingClientRect();
  const [x,y]=clampTip(r.left+(nd.x-VB.x)/VB.s*r.width+16, r.top+(nd.y-VB.y)/VB.s*r.height+16);
  t.style.left=x+'px'; t.style.top=y+'px';
}
function moveTip(ev){ const [x,y]=clampTip(ev.clientX+16, ev.clientY+16); const t=document.getElementById('cakeTip'); t.style.left=x+'px'; t.style.top=y+'px'; }
function hideTip(){ const t=document.getElementById('cakeTip'); if(t) t.classList.remove('show'); }

let _cakeRotRaf=false;
function scheduleCakeRotate(){
  if(_cakeRotRaf) return; _cakeRotRaf=true;
  requestAnimationFrame(()=>{ _cakeRotRaf=false; computeGraph(); buildGraph(); cakeRender(); });
}
function renderCake(){ computeGraph(); buildGraph(); cakeRender(); }

function renderMgrFilters(){
  const tiers=[['core','上段','コア / 最重要'],['deliverable','中段','成果物'],['reference','下段','参考 / 履歴']];
  document.getElementById('fTier').innerHTML = tiers.map(([k,label,sub])=>{
    const count=DOCS.filter(d=>tierOf(d.importance)===k).length;
    return `<label class="flt"><input type="checkbox" data-tier="${k}" ${MGR_TIERS.has(k)?'checked':''}>
      <span style="flex:1"><span class="flabel">${label}</span><div class="fsub">${sub}</div></span><span class="fcount">${count}</span></label>`;
  }).join('');
  const types=[...ALL_TYPES].sort();
  document.getElementById('fType').innerHTML = types.map(t=>{
    const count=DOCS.filter(d=>(d.doc_type||'一般')===t).length;
    return `<label class="flt"><input type="checkbox" data-type="${esc(t)}" ${MGR_TYPES.has(t)?'checked':''}>
      <span class="fdot" style="background:${typeColor(t)}"></span>
      <span class="flabel" style="flex:1">${esc(t)}</span><span class="fcount">${count}</span></label>`;
  }).join('');
  document.querySelectorAll('#fTier input').forEach(cb=>cb.onchange=()=>{
    if(cb.checked) MGR_TIERS.add(cb.dataset.tier); else MGR_TIERS.delete(cb.dataset.tier);
    renderCake();renderTimeline();
  });
  document.querySelectorAll('#fType input').forEach(cb=>cb.onchange=()=>{
    if(cb.checked) MGR_TYPES.add(cb.dataset.type); else MGR_TYPES.delete(cb.dataset.type);
    renderCake();renderTimeline();
  });
}
function renderTimeline(){
  const docs=visibleDocs();
  document.getElementById('tcount').textContent=`新しい順・${docs.length}件`;
  let html='',lastMonth='';
  docs.forEach(d=>{
    const m=monthLabel(d.updated_at);
    if(m!==lastMonth){html+=`<div class="tl-month">${m}</div>`;lastMonth=m;}
    const t=TIER_DEF[tierOf(d.importance)];
    html+=`<div class="tl-item" data-id="${d.id}">
      <span class="tdot" style="background:${typeColor(d.doc_type||'一般')}"></span>
      <div class="tinfo">
        <div class="ttitle">${esc(stripExt(d.title))}</div>
        <div class="tmeta">${esc(d.doc_type||'一般')} ・ ${dateLabel(d.updated_at)}</div>
        <div class="tl-summary">${esc(d.summary||'')}</div>
      </div>
      <span class="ttier">${t.label}</span>
    </div>`;
  });
  document.getElementById('tlist').innerHTML = html || '<div style="font-size:13.5px;color:var(--text-3)">表示できる資料がありません</div>';
  document.querySelectorAll('.tl-item').forEach(rowEl=>rowEl.onclick=()=>{
    const id=rowEl.dataset.id;
    cakeSelected = String(cakeSelected)===id ? null : id;
    cakeHover=null; hideTip();
    cakeRender();
  });
}

let MGR_VIEW='cake';

function mgrCakeAsideHtml(){
  return `
    <div class="mgr-toggle mgr-agg-toggle">
      <button data-agg="0" class="${MGR_AGG?'':'active'}">個別</button>
      <button data-agg="1" class="${MGR_AGG?'active':''}">集約</button>
    </div>
    <h3>段 / 重要度</h3>
    <div id="fTier"></div>
    <h3 style="margin-top:20px">色 / 種類</h3>
    <div id="fType"></div>`;
}
function mgrCakeMainHtml(){
  return `
    <div class="cakehead">
      <div><span class="ttl">ナレッジの見取り図</span><span class="cap">段=重要度・色=種類・奥行き=時系列</span></div>
      <button class="addfile-btn" id="addfile">＋ ファイル追加</button>
      <input type="file" id="mgrFileInput" multiple style="display:none">
    </div>
    <div class="cakebox" id="cakebox">
      <svg viewBox="0 0 900 900" class="cakesvg" id="cake" role="img" aria-label="3D データケーキ"></svg>
    </div>
    <div class="cake-hint">マウスホイールで回転・ダブルクリックで正面に戻る</div>`;
}
function mgrCakeRightHtml(){
  return `<h3>タイムライン</h3><div class="tcount" id="tcount"></div><div id="tlist"></div>`;
}
function mgrGraphAsideHtml(){
  return `
    <p class="struct-desc">ファイル同士の意味的な繋がりから、ナレッジの構造を俯瞰する。</p>
    <h3>種類 / 色</h3>
    <div id="structLegend"></div>`;
}
function mgrGraphMainHtml(){
  return `<div class="mgr-graph-embed" id="mgrGraphMain">
    <svg class="struct-svg" id="structSvg" viewBox="0 0 ${GRAPH_W} ${GRAPH_H}" role="img" aria-label="ファイルのつながりグラフ"></svg>
    <div class="struct-hint">ホイールで拡大縮小・ドラッグで移動・ダブルクリックでリセット</div>
  </div>`;
}
function mgrGraphRightHtml(){
  return `<div id="structDetail"><h3>詳細</h3><div class="struct-detail-empty">読み込み中…</div></div>`;
}

async function showManager(){
  VIEW='manager'; setRail('manager');
  if(!DOCS.length && MGR_TYPES===null) await loadDocs();
  else if(!DOCS.length) await loadDocs();
  if(MGR_VIEW==='graph') await loadGraph();
  const isGraph = MGR_VIEW==='graph';
  SHEET.innerHTML = `
  <div class="view-full mgr-wrap">
    <div class="mgr-aside fu-s" style="--d:0s">
      <div class="mgr-toggle mgr-view-toggle">
        <button data-view="cake" class="${isGraph?'':'active'}">ケーキ</button>
        <button data-view="graph" class="${isGraph?'active':''}">つながり</button>
      </div>
      ${isGraph ? mgrGraphAsideHtml() : mgrCakeAsideHtml()}
    </div>
    <div class="mgr-main fu-s ${isGraph?'is-graph':''}" style="--d:.06s">${isGraph ? mgrGraphMainHtml() : mgrCakeMainHtml()}</div>
    <div class="mgr-timeline fu-s" style="--d:.12s">${isGraph ? mgrGraphRightHtml() : mgrCakeRightHtml()}</div>
  </div>
  ${isGraph ? `<div class="struct-tooltip" id="structTip"></div>` : `<div class="cake-tip" id="cakeTip"></div><aside class="cake-insp" id="cakeInsp"></aside>`}`;
  document.querySelectorAll('.mgr-view-toggle button').forEach(b=>b.onclick=()=>{
    if(MGR_VIEW===b.dataset.view) return;
    MGR_VIEW=b.dataset.view;
    showManager();
  });

  if(isGraph){
    gSelected=null; gHover=null; gDragging=null;
    if(!GRAPH.nodes || !GRAPH.nodes.length){
      document.getElementById('mgrGraphMain').innerHTML = `<div class="struct-empty-state"><div class="big">文書がまだありません</div><div style="font-size:13.5px">ファイルを追加すると、ここに意味的な繋がりが表示されます。</div></div>`;
      document.getElementById('structLegend').innerHTML = '<div style="font-size:13px;color:var(--text-3)">データがありません</div>';
      return;
    }
    renderStructLegend();
    initGraphLayout();
    buildStructureSvg();
    renderStructDetail();
    runSim();
    return;
  }

  renderMgrFilters();
  renderCake();
  renderTimeline();
  document.getElementById('addfile').onclick=()=>document.getElementById('mgrFileInput').click();
  document.getElementById('mgrFileInput').onchange=async(e)=>{
    const files=[...e.target.files];
    if(!files.length) return;
    const btn=document.getElementById('addfile');
    if(btn) btn.disabled=true;
    for(const f of files){
      if(btn) btn.textContent=`アップロード中… ${f.name}`;
      const fd=new FormData();
      fd.append('path','web-upload/'+ME.name+'/'+Date.now()+'-'+f.name);
      fd.append('file',f,f.name);
      try{await apiFetch('/ingest',{method:'POST',headers:authHeaders(),body:fd});}catch(err){}
    }
    await loadDocs();
    showManager();
  };
  document.querySelectorAll('.mgr-agg-toggle button').forEach(b=>b.onclick=()=>{
    MGR_AGG=b.dataset.agg==='1';
    document.querySelectorAll('.mgr-agg-toggle button').forEach(x=>x.classList.toggle('active',x===b));
    renderCake();
  });
  const cakeSvgEl=document.getElementById('cake');
  cakeSvgEl.addEventListener('wheel', e=>{
    e.preventDefault();
    azimuth=Math.max(AZ_MIN, Math.min(AZ_MAX, azimuth+(e.deltaY>0?1:-1)*0.05));
    hideTip(); scheduleCakeRotate();
  }, {passive:false});
  cakeSvgEl.addEventListener('dblclick', ()=>{ azimuth=0; scheduleCakeRotate(); });
  cakeSvgEl.addEventListener('click', e=>{ if(!e.target.closest('circle')){ cakeSelected=null; hideTip(); cakeRender(); } });
}

/* ---------------- つながりグラフ(force-directed) ---------------- */
let GRAPH=null;
let GNODES={};
let GEDGES=[];
let gSelected=null, gHover=null, gDragging=null;
let gSimRaf=null, gSimIter=0;
const GRAPH_W=760, GRAPH_H=760, GRAPH_SIM_MAX=200;

async function loadGraph(){
  try{
    const r=await apiFetch('/api/graph',{headers:authHeaders()});
    GRAPH = r.ok ? await r.json() : {nodes:[],edges:[],types:[]};
  }catch(e){ GRAPH={nodes:[],edges:[],types:[]}; }
  if(!GRAPH || !Array.isArray(GRAPH.nodes)) GRAPH={nodes:[],edges:[],types:[]};
}
function graphDegree(id){
  let n=0;
  (GRAPH.edges||[]).forEach(e=>{ if(String(e.source)===String(id)||String(e.target)===String(id)) n++; });
  return n;
}
function nodeRadius(nd){ return 5 + Math.min(9, Math.sqrt((nd.degree||0)+1)*2.5); }
function initGraphLayout(){
  const nodes=GRAPH.nodes||[];
  const cx=GRAPH_W/2, cy=GRAPH_H/2, rad=Math.min(GRAPH_W,GRAPH_H)*0.32;
  GNODES={};
  nodes.forEach((n,i)=>{
    const ang=(i/Math.max(1,nodes.length))*Math.PI*2;
    GNODES[n.id]={...n,
      x:cx+Math.cos(ang)*rad+(Math.random()-0.5)*24,
      y:cy+Math.sin(ang)*rad+(Math.random()-0.5)*24,
      vx:0, vy:0, degree:graphDegree(n.id)};
  });
  GEDGES=(GRAPH.edges||[]).filter(e=>GNODES[e.source]&&GNODES[e.target]);
}
function connectedIds(id){
  const set=new Set([String(id)]);
  GEDGES.forEach(e=>{
    if(String(e.source)===String(id)) set.add(String(e.target));
    if(String(e.target)===String(id)) set.add(String(e.source));
  });
  return set;
}
function simStep(){
  const ids=Object.keys(GNODES);
  const cx=GRAPH_W/2, cy=GRAPH_H/2;
  ids.forEach(id=>{
    const a=GNODES[id];
    let fx=(cx-a.x)*0.006, fy=(cy-a.y)*0.006;
    for(const id2 of ids){
      if(id2===id) continue;
      const b=GNODES[id2];
      let dx=a.x-b.x, dy=a.y-b.y;
      let d2=dx*dx+dy*dy; if(d2<1) d2=1;
      const d=Math.sqrt(d2);
      const rep=2600/d2;
      fx+=(dx/d)*rep; fy+=(dy/d)*rep;
    }
    a._fx=fx; a._fy=fy;
  });
  GEDGES.forEach(e=>{
    const a=GNODES[e.source], b=GNODES[e.target];
    if(!a||!b) return;
    let dx=b.x-a.x, dy=b.y-a.y;
    let d=Math.sqrt(dx*dx+dy*dy)||0.01;
    const rest=88;
    const k=0.02*(0.3+(e.weight||0.5));
    const force=(d-rest)*k;
    const ux=dx/d, uy=dy/d;
    a._fx+=ux*force; a._fy+=uy*force;
    b._fx-=ux*force; b._fy-=uy*force;
  });
  ids.forEach(id=>{
    if(gDragging===id) return;
    const nd=GNODES[id];
    nd.vx=(nd.vx+nd._fx)*0.82;
    nd.vy=(nd.vy+nd._fy)*0.82;
    nd.x+=nd.vx; nd.y+=nd.vy;
    const r=nodeRadius(nd);
    nd.x=Math.max(r,Math.min(GRAPH_W-r,nd.x));
    nd.y=Math.max(r,Math.min(GRAPH_H-r,nd.y));
  });
}
function fitStructViewBox(){ structView.fit(GNODES, nodeRadius, 16, 16); }
function runSim(){
  if(gSimRaf) cancelAnimationFrame(gSimRaf);
  gSimIter=0;
  const tick=()=>{
    for(let k=0;k<3;k++) simStep();
    gSimIter+=3;
    updateGraphPositions();
    if(gSimIter<GRAPH_SIM_MAX){ gSimRaf=requestAnimationFrame(tick); } else { gSimRaf=null; fitStructViewBox(); }
  };
  gSimRaf=requestAnimationFrame(tick);
}
function svgPoint(svg, clientX, clientY){
  const pt=svg.createSVGPoint(); pt.x=clientX; pt.y=clientY;
  const ctm=svg.getScreenCTM();
  if(!ctm) return [clientX, clientY];
  const p=pt.matrixTransform(ctm.inverse());
  return [p.x, p.y];
}
function createGraphView(svgId, defaultW, defaultH){
  return {
    svgId,
    vb:{x:0,y:0,w:defaultW,h:defaultH},
    fitVB:{x:0,y:0,w:defaultW,h:defaultH},
    apply(){
      const svg=document.getElementById(this.svgId);
      if(svg) svg.setAttribute('viewBox', `${this.vb.x.toFixed(1)} ${this.vb.y.toFixed(1)} ${this.vb.w.toFixed(1)} ${this.vb.h.toFixed(1)}`);
    },
    fit(nodes, radiusFn, padTop, padBottom){
      const ids=Object.keys(nodes);
      if(!ids.length) return;
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      ids.forEach(id=>{
        const nd=nodes[id], r=radiusFn(nd);
        minX=Math.min(minX,nd.x-r); maxX=Math.max(maxX,nd.x+r);
        minY=Math.min(minY,nd.y-r-(padTop??16)); maxY=Math.max(maxY,nd.y+r+(padBottom??16));
      });
      const pad=50;
      const w=Math.max(maxX-minX,200)+pad*2, h=Math.max(maxY-minY,160)+pad*2;
      const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
      this.fitVB={x:cx-w/2, y:cy-h/2, w, h};
      this.vb={...this.fitVB};
      this.apply();
    },
    bindInteractions(nodeSelector){
      const svg=document.getElementById(this.svgId);
      if(!svg || svg.dataset.panZoomBound) return;
      svg.dataset.panZoomBound='1';
      const self=this;
      svg.addEventListener('wheel', e=>{
        e.preventDefault();
        const factor = e.deltaY>0 ? 1.1 : 0.9;
        const [mx,my]=svgPoint(svg, e.clientX, e.clientY);
        const minW=self.fitVB.w/4, maxW=self.fitVB.w/0.3;
        const newW=Math.max(minW, Math.min(maxW, self.vb.w*factor));
        const scale=newW/self.vb.w;
        const newH=self.vb.h*scale;
        self.vb={x:mx-(mx-self.vb.x)*scale, y:my-(my-self.vb.y)*scale, w:newW, h:newH};
        self.apply();
      }, {passive:false});
      svg.addEventListener('pointerdown', e=>{
        if(e.target.closest(nodeSelector)) return;
        e.preventDefault();
        svg.classList.add('panning');
        const startClientX=e.clientX, startClientY=e.clientY;
        const startVB={...self.vb};
        const rect=svg.getBoundingClientRect();
        const move=ev=>{
          const dx=ev.clientX-startClientX, dy=ev.clientY-startClientY;
          const sx=startVB.w/rect.width, sy=startVB.h/rect.height;
          self.vb={x:startVB.x-dx*sx, y:startVB.y-dy*sy, w:startVB.w, h:startVB.h};
          self.apply();
        };
        const up=()=>{
          svg.classList.remove('panning');
          window.removeEventListener('pointermove',move);
          window.removeEventListener('pointerup',up);
        };
        window.addEventListener('pointermove',move);
        window.addEventListener('pointerup',up);
      });
      svg.addEventListener('dblclick', ()=>{ self.vb={...self.fitVB}; self.apply(); });
    }
  };
}
const structView=createGraphView('structSvg', GRAPH_W, GRAPH_H);
function startNodeDrag(ev, nd){
  ev.preventDefault(); ev.stopPropagation();
  const svg=document.getElementById('structSvg');
  gDragging=String(nd.id);
  const move=e=>{
    const [x,y]=svgPoint(svg, e.clientX, e.clientY);
    const r=nodeRadius(nd);
    nd.x=Math.max(r,Math.min(GRAPH_W-r,x));
    nd.y=Math.max(r,Math.min(GRAPH_H-r,y));
    nd.vx=0; nd.vy=0;
    updateGraphPositions();
  };
  const up=()=>{
    gDragging=null;
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    gSimIter=Math.max(0, GRAPH_SIM_MAX-50);
    runSim();
  };
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);
}
function buildStructureSvg(){
  const svg=document.getElementById('structSvg');
  if(!svg) return;
  svg.innerHTML='';
  svg.setAttribute('viewBox', `0 0 ${GRAPH_W} ${GRAPH_H}`);
  const gEdges=el('g',{id:'gEdges'});
  const gNodes=el('g',{id:'gNodes'});
  GEDGES.forEach(e=>{
    const a=GNODES[e.source], b=GNODES[e.target];
    if(!a||!b) return;
    const w=e.weight||0.4;
    const line=el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
      stroke:'#5b6270','stroke-width':'1','stroke-opacity':(0.14+w*0.55).toFixed(2)});
    line.dataset.s=e.source; line.dataset.t=e.target;
    gEdges.appendChild(line);
  });
  Object.values(GNODES).forEach((nd,i)=>{
    const grp=el('g',{class:'struct-node',tabindex:'0',role:'button'});
    grp.dataset.id=nd.id;
    const col=typeColor(nd.doc_type||'一般');
    const r=nodeRadius(nd);
    const c=el('circle',{cx:nd.x,cy:nd.y,r:0,fill:col,'fill-opacity':1,stroke:'#ffffff','stroke-width':'1.6'});
    c.style.transitionDelay=Math.min(i*0.02,0.3)+'s';
    const ttl=el('title',{}); ttl.textContent=`${nd.title} — ${nd.doc_type||'一般'}`; c.appendChild(ttl);
    const label=trunc(stripExt(nd.title||''),10);
    const t=el('text',{x:nd.x,y:nd.y+r+15,'text-anchor':'middle','font-size':'8.5'});
    t.textContent=label;
    grp.appendChild(c); grp.appendChild(t);
    const enter=ev=>{ gHover=String(nd.id); showStructTip(ev,nd); highlightGraph(); };
    const leave=()=>{ gHover=null; hideStructTip(); highlightGraph(); };
    grp.addEventListener('mouseenter',enter);
    grp.addEventListener('mousemove',ev=>moveStructTip(ev));
    grp.addEventListener('mouseleave',leave);
    grp.addEventListener('focus',()=>{ gHover=String(nd.id); highlightGraph(); });
    grp.addEventListener('blur',leave);
    const toggle=()=>{ gSelected = gSelected===String(nd.id)?null:String(nd.id); renderStructDetail(); highlightGraph(); };
    grp.addEventListener('click',ev=>{ ev.stopPropagation(); toggle(); });
    grp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); toggle(); } });
    grp.addEventListener('pointerdown',ev=>startNodeDrag(ev,nd));
    gNodes.appendChild(grp);
    requestAnimationFrame(()=>c.setAttribute('r', r));
  });
  svg.appendChild(gEdges); svg.appendChild(gNodes);
  svg.addEventListener('click', e=>{ if(!e.target.closest('.struct-node')){ gSelected=null; renderStructDetail(); highlightGraph(); } });
  structView.bindInteractions('.struct-node');
}
function updateGraphPositions(){
  document.querySelectorAll('#gNodes .struct-node').forEach(grp=>{
    const nd=GNODES[grp.dataset.id]; if(!nd) return;
    const c=grp.querySelector('circle'), t=grp.querySelector('text');
    c.setAttribute('cx',nd.x); c.setAttribute('cy',nd.y);
    t.setAttribute('x',nd.x); t.setAttribute('y',nd.y+nodeRadius(nd)+15);
  });
  document.querySelectorAll('#gEdges line').forEach(line=>{
    const a=GNODES[line.dataset.s], b=GNODES[line.dataset.t];
    if(!a||!b) return;
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
  });
}
function highlightGraph(){
  const active=gSelected||gHover;
  const conn = active ? connectedIds(active) : null;
  document.querySelectorAll('#gNodes .struct-node').forEach(grp=>{
    const id=String(grp.dataset.id);
    const c=grp.querySelector('circle');
    const base=nodeRadius(GNODES[id]||{degree:0});
    if(active){
      const on=conn.has(id);
      c.setAttribute('r', id===active? base+2 : base);
      c.setAttribute('fill-opacity', on?1:0.15);
      c.setAttribute('stroke-width', id===active?'3':'2');
    } else {
      c.setAttribute('r', base);
      c.setAttribute('fill-opacity','1');
      c.setAttribute('stroke-width','2');
    }
  });
  document.querySelectorAll('#gEdges line').forEach(line=>{
    if(active){
      const on = line.dataset.s===active || line.dataset.t===active;
      line.style.opacity = on? '1' : '0.1';
    } else {
      line.style.opacity='';
    }
  });
}
function showStructTip(ev,nd){
  const tip=document.getElementById('structTip'); if(!tip) return;
  tip.innerHTML=`<b>${esc(stripExt(nd.title))}</b><span>${esc(nd.doc_type||'一般')}</span>${nd.summary?`<span>${esc(trunc(nd.summary,64))}</span>`:''}`;
  tip.classList.add('show');
  moveStructTip(ev);
}
function moveStructTip(ev){
  const tip=document.getElementById('structTip'); if(!tip) return;
  const x=Math.max(8,Math.min(ev.clientX+16, innerWidth-256));
  const y=Math.max(8,Math.min(ev.clientY+16, innerHeight-70));
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function hideStructTip(){ const t=document.getElementById('structTip'); if(t) t.classList.remove('show'); }
function renderStructLegend(){
  const wrap=document.getElementById('structLegend'); if(!wrap) return;
  let types=(GRAPH.types&&GRAPH.types.length) ? GRAPH.types : null;
  if(!types){
    const m={};
    (GRAPH.nodes||[]).forEach(n=>{ const t=n.doc_type||'一般'; m[t]=(m[t]||0)+1; });
    types=Object.entries(m).map(([name,count])=>({name,count}));
  }
  wrap.innerHTML = types.map(t=>`<div class="struct-legend-item">
    <span class="dot" style="background:${typeColor(t.name)}"></span>
    <span class="name">${esc(t.name)}</span><span class="count">${t.count}件</span></div>`).join('');
}
function renderStructDetail(){
  const panel=document.getElementById('structDetail'); if(!panel) return;
  if(!gSelected || !GNODES[gSelected]){
    panel.innerHTML=`<h3>詳細</h3><div class="struct-detail-empty">ノードをクリックすると、タイトル・種別・重要度・要約と、繋がっている文書の一覧が表示されます。</div>`;
    return;
  }
  const nd=GNODES[gSelected];
  const linked=GEDGES.filter(e=>String(e.source)===gSelected||String(e.target)===gSelected)
    .map(e=>{ const otherId=String(e.source)===gSelected?e.target:e.source; return {other:GNODES[otherId], weight:e.weight}; })
    .filter(x=>x.other)
    .sort((a,b)=>(b.weight||0)-(a.weight||0));
  panel.innerHTML=`
    <h3>詳細</h3>
    <div class="struct-detail-title">${esc(stripExt(nd.title))}</div>
    <div class="struct-detail-meta">
      <span class="mtag">${esc(nd.doc_type||'一般')}</span>
      <span class="mtag">${esc(TIER_DEF[tierOf(nd.importance)].label)}</span>
      <span class="mtag">${esc(dateLabel(nd.updated_at))}</span>
    </div>
    ${nd.summary?`<div class="struct-detail-summary">${esc(nd.summary)}</div>`:''}
    <div class="struct-detail-links">
      <h4>繋がっている文書（${linked.length}）</h4>
      ${linked.length? linked.map(l=>`<div class="struct-link-item" data-id="${esc(l.other.id)}">
          <span class="dot" style="background:${typeColor(l.other.doc_type||'一般')}"></span>
          <span>${esc(trunc(stripExt(l.other.title||''),20))}</span>
          <span class="w">${Math.round((l.weight||0)*100)}%</span>
        </div>`).join('') : '<div style="font-size:13px;color:var(--text-3)">繋がりのある文書はありません</div>'}
    </div>
    <button class="biz-preview-btn" data-id="${esc(nd.id)}">${ICON.doc} 原本を見る</button>`;
  panel.querySelectorAll('.struct-link-item').forEach(row=>row.onclick=()=>{
    gSelected=row.dataset.id; renderStructDetail(); highlightGraph();
  });
  panel.querySelector('.biz-preview-btn').onclick=()=>openDocPreview(nd.id);
}

/* ---------------- 業務構造(AI推定の業務フロー / Obsidianグラフ風) ---------------- */
let BIZFLOW=null;
let bizLoaded=false;
let bizSelected=null;
let bizHover=null;
let BIZ_AGG=true;
let BNODES={};
let BEDGES=[];
let bizSimRaf=null, bizSimIter=0;
const BIZ_W=1000, BIZ_H=600, BIZ_SIM_MAX=200;
const bizView=createGraphView('bizSvg', BIZ_W, BIZ_H);

let ADMIN_INSIGHTS=null, adminInsightsLoaded=false;
const INSIGHT_CATEGORY_LABELS={gap:'ナレッジの穴',duplication:'重複・二重管理',risk:'リスク',bottleneck:'属人化・ボトルネック',opportunity:'改善機会'};
async function loadAdminInsightsIfNeeded(){
  if(!ME || ME.role!=='admin' || adminInsightsLoaded) return;
  adminInsightsLoaded=true;
  try{
    const r=await apiFetch('/api/admin/insights',{headers:authHeaders()});
    if(r.ok){ const d=await r.json(); ADMIN_INSIGHTS=d.report||null; }
  }catch(e){}
}
function bizRelatedFindings(s){
  if(!ADMIN_INSIGHTS || !Array.isArray(ADMIN_INSIGHTS.findings)) return [];
  const docTitles=new Set(s.doc_titles||[]);
  const out=[];
  for(const f of ADMIN_INSIGHTS.findings){
    const overlap=(f.evidence_titles||[]).some(t=>docTitles.has(t));
    const gapMatch=(s.health==='gap'||s.health==='thin') && f.category==='gap';
    if(overlap||gapMatch){ out.push(f); if(out.length>=3) break; }
  }
  return out;
}
function bizInsightsSectionHtml(s){
  if(!ME || ME.role!=='admin' || !ADMIN_INSIGHTS) return '';
  const findings=bizRelatedFindings(s);
  return `<div class="struct-detail-links" style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
    <h4>関連する改善提案</h4>
    ${findings.length? findings.map(f=>`<div class="struct-link-item biz-insight-item" data-title="${esc(f.title)}">
        <span class="dot" style="background:var(--accent)"></span><span>${esc(f.title)}</span>
        <span class="w">${esc(INSIGHT_CATEGORY_LABELS[f.category]||f.category||'')}</span>
      </div>`).join('') : '<div style="font-size:13px;color:var(--text-3)">関連する改善提案は見つかりませんでした</div>'}
  </div>`;
}

async function loadBizFlow(){
  try{
    const r=await apiFetch('/api/structure',{headers:authHeaders()});
    const d = r.ok ? await r.json() : {map:null};
    BIZFLOW = d.map || null;
  }catch(e){ BIZFLOW=null; }
  bizLoaded=true;
}
function bizHealthLabel(h){ return h==='gap' ? '資料不足' : (h==='thin' ? '資料が薄い' : '資料十分'); }

function buildBizGraphData(map, agg){
  const stages=map.stages||[];
  const nodes={}, edges=[];
  const n=stages.length;
  const marginX=BIZ_W*0.12, cy=BIZ_H/2;
  stages.forEach((s,i)=>{
    const tx = n>1 ? marginX+(i/(n-1))*(BIZ_W-2*marginX) : BIZ_W/2;
    nodes[s.id] = {id:s.id, type:'stage', stage:s, order:i, targetX:tx,
      x: tx+(Math.random()-0.5)*20, y: cy+(Math.random()-0.5)*50, vx:0, vy:0};
  });
  (map.flows||[]).forEach(f=>{
    if(nodes[f.from] && nodes[f.to]) edges.push({source:f.from, target:f.to, kind:'flow'});
  });
  if(!agg){
    stages.forEach(s=>{
      (s.doc_ids||[]).forEach((docId,di)=>{
        const title=(s.doc_titles||[])[di] || docId;
        const did=`d_${s.id}_${docId}_${di}`;
        const parent=nodes[s.id];
        const ang=Math.random()*Math.PI*2, rad=30+Math.random()*16;
        nodes[did] = {id:did, type:'doc', title, parentId:s.id, docId,
          x: parent.x+Math.cos(ang)*rad, y: parent.y+Math.sin(ang)*rad, vx:0, vy:0};
        edges.push({source:s.id, target:did, kind:'doc'});
      });
    });
  }
  return {nodes, edges};
}
function bizSimStep(){
  const ids=Object.keys(BNODES);
  ids.forEach(id=>{
    const a=BNODES[id];
    let fx=0, fy=0;
    if(a.type==='stage'){
      fx += (a.targetX-a.x)*0.02;
      fy += (BIZ_H/2-a.y)*0.015;
    } else {
      const p=BNODES[a.parentId];
      if(p){ fx += (p.x-a.x)*0.0025; fy += (p.y-a.y)*0.0025; }
    }
    for(const id2 of ids){
      if(id2===id) continue;
      const b=BNODES[id2];
      let dx=a.x-b.x, dy=a.y-b.y;
      let d2=dx*dx+dy*dy; if(d2<1) d2=1;
      const d=Math.sqrt(d2);
      const rep = (a.type==='stage'&&b.type==='stage') ? 5400/d2 : 950/d2;
      fx+=(dx/d)*rep; fy+=(dy/d)*rep;
    }
    a._fx=fx; a._fy=fy;
  });
  BEDGES.forEach(e=>{
    const a=BNODES[e.source], b=BNODES[e.target];
    if(!a||!b) return;
    let dx=b.x-a.x, dy=b.y-a.y;
    let d=Math.sqrt(dx*dx+dy*dy)||0.01;
    const rest = e.kind==='flow' ? 210 : 42;
    const k = e.kind==='flow' ? 0.018 : 0.09;
    const force=(d-rest)*k;
    const ux=dx/d, uy=dy/d;
    a._fx+=ux*force; a._fy+=uy*force;
    b._fx-=ux*force; b._fy-=uy*force;
  });
  ids.forEach(id=>{
    const nd=BNODES[id];
    nd.vx=(nd.vx+nd._fx)*0.80;
    nd.vy=(nd.vy+nd._fy)*0.80;
    nd.x+=nd.vx; nd.y+=nd.vy;
  });
}
function bizRunSim(){
  if(bizSimRaf) cancelAnimationFrame(bizSimRaf);
  bizSimIter=0;
  const tick=()=>{
    for(let k=0;k<3;k++) bizSimStep();
    bizSimIter+=3;
    updateBizPositions();
    if(bizSimIter<BIZ_SIM_MAX){ bizSimRaf=requestAnimationFrame(tick); }
    else { bizSimRaf=null; bizView.fit(BNODES, nd=>nd.type==='stage'?34:14, 22, 16); }
  };
  bizSimRaf=requestAnimationFrame(tick);
}
function bizNodeRadius(nd){
  if(nd.type==='doc') return (bizHover===nd.id||bizSelected===nd.id) ? 7 : 5;
  return (bizHover===nd.id||bizSelected===nd.id) ? 27 : 22;
}
function bizConnectedIds(id){
  const set=new Set([id]);
  BEDGES.forEach(e=>{
    if(e.source===id) set.add(e.target);
    if(e.target===id) set.add(e.source);
  });
  return set;
}
function bizTipContent(nd){
  if(nd.type==='doc'){
    const p=BNODES[nd.parentId];
    return `<b>${esc(stripExt(nd.title||''))}</b><span>紐づく工程：${p?esc(p.stage.name):''}</span>`;
  }
  const s=nd.stage;
  return `<b>${esc(s.name)}</b><span>資料 ${s.doc_ids.length}件 ・ ${esc(bizHealthLabel(s.health))}</span>`;
}
function bizShowTip(ev,nd){
  const tip=document.getElementById('bizTip'); if(!tip) return;
  tip.innerHTML=bizTipContent(nd);
  tip.classList.add('show');
  bizMoveTip(ev);
}
function bizMoveTip(ev){
  const tip=document.getElementById('bizTip'); if(!tip) return;
  const x=Math.max(8,Math.min(ev.clientX+16, innerWidth-256));
  const y=Math.max(8,Math.min(ev.clientY+16, innerHeight-70));
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function bizHideTip(){ const t=document.getElementById('bizTip'); if(t) t.classList.remove('show'); }
function bizNodeMounted(g, nd){
  const enter=ev=>{ bizHover=nd.id; bizShowTip(ev,nd); bizHighlight(); };
  const leave=()=>{ bizHover=null; bizHideTip(); bizHighlight(); };
  g.addEventListener('mouseenter',enter);
  g.addEventListener('mousemove',ev=>bizMoveTip(ev));
  g.addEventListener('mouseleave',leave);
  g.addEventListener('focus',()=>{ bizHover=nd.id; bizHighlight(); });
  g.addEventListener('blur',leave);
  const toggle=()=>{ bizSelected = bizSelected===nd.id ? null : nd.id; renderBizDetail(); bizHighlight(); };
  g.addEventListener('click',ev=>{ ev.stopPropagation(); toggle(); });
  g.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); toggle(); } });
}
function buildBizSvg(){
  const svg=document.getElementById('bizSvg');
  if(!svg) return;
  svg.innerHTML='';
  svg.setAttribute('viewBox', `0 0 ${BIZ_W} ${BIZ_H}`);
  const defs=el('defs',{});
  const filter=el('filter',{id:'bizGlow',x:'-150%',y:'-150%',width:'400%',height:'400%'});
  filter.appendChild(el('feGaussianBlur',{'in':'SourceGraphic','stdDeviation':'4'}));
  defs.appendChild(filter);
  svg.appendChild(defs);

  const gEdges=el('g',{id:'bEdges'});
  const gNodes=el('g',{id:'bNodes'});

  BEDGES.forEach(e=>{
    const a=BNODES[e.source], b=BNODES[e.target];
    if(!a||!b) return;
    const isFlow=e.kind==='flow';
    const line=el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,
      stroke: isFlow ? 'rgba(235,240,255,.42)' : 'rgba(235,240,255,.16)',
      'stroke-width': isFlow ? '1.8' : '1'});
    line.dataset.s=e.source; line.dataset.t=e.target;
    gEdges.appendChild(line);
  });

  Object.values(BNODES).filter(n=>n.type==='doc').forEach(nd=>{
    const g=el('g',{class:'biz-node',tabindex:'0',role:'button','aria-label':`資料：${nd.title}`});
    g.dataset.id=nd.id;
    g.appendChild(el('circle',{class:'biz-glow',cx:nd.x,cy:nd.y,r:11,fill:'#e8edff','fill-opacity':0.12,filter:'url(#bizGlow)'}));
    g.appendChild(el('circle',{class:'biz-core',cx:nd.x,cy:nd.y,r:bizNodeRadius(nd),fill:'#8f9bc9','fill-opacity':0.85,stroke:'#10142b','stroke-width':'1'}));
    bizNodeMounted(g,nd);
    gNodes.appendChild(g);
  });

  Object.values(BNODES).filter(n=>n.type==='stage').forEach(nd=>{
    const s=nd.stage, issue=s.health!=='ok';
    const r=bizNodeRadius(nd);
    const ys=bizLabelYs(r, issue);
    const g=el('g',{class:'biz-node',tabindex:'0',role:'button','aria-label':`工程：${s.name}`});
    g.dataset.id=nd.id;
    g.appendChild(el('circle',{class:'biz-glow',cx:nd.x,cy:nd.y,r:r+10,fill:'#e8edff','fill-opacity':issue?0.08:0.16,filter:'url(#bizGlow)'}));
    if(issue){
      const ringColor = s.health==='gap' ? 'rgba(255,140,130,.9)' : 'rgba(235,240,255,.4)';
      g.appendChild(el('circle',{class:'biz-ring',cx:nd.x,cy:nd.y,r:r+9,fill:'none',stroke:ringColor,'stroke-width':'1.6','stroke-dasharray':'5 4'}));
    }
    g.appendChild(el('circle',{class:'biz-core',cx:nd.x,cy:nd.y,r:r,fill:'#f2f5ff','fill-opacity':issue?0.55:1,stroke:'#10142b','stroke-width':'1.5'}));
    const label=el('text',{class:'biz-label',x:nd.x,y:nd.y+ys.name});
    label.textContent=trunc(s.name,16);
    g.appendChild(label);
    if(BIZ_AGG){
      const count=el('text',{class:'biz-doc-count-label',x:nd.x,y:nd.y+ys.count});
      count.textContent=`資料 ${s.doc_ids.length}件`;
      g.appendChild(count);
    }
    if(issue){
      const flag=el('text',{class:'biz-issue-label '+s.health,x:nd.x,y:nd.y+ys.flag});
      flag.textContent=bizHealthLabel(s.health);
      g.appendChild(flag);
    }
    bizNodeMounted(g,nd);
    gNodes.appendChild(g);
  });

  svg.appendChild(gEdges); svg.appendChild(gNodes);
  svg.addEventListener('click', e=>{ if(!e.target.closest('.biz-node')){ bizSelected=null; renderBizDetail(); bizHighlight(); } });
}
function bizLabelYs(r, issue){
  const name=r+18;
  const count=BIZ_AGG ? r+35 : null;
  const flag=issue ? (BIZ_AGG ? r+51 : r+34) : null;
  return {name, count, flag};
}
function updateBizPositions(){
  document.querySelectorAll('#bNodes .biz-node').forEach(g=>{
    const nd=BNODES[g.dataset.id]; if(!nd) return;
    g.querySelectorAll('circle').forEach(c=>{ c.setAttribute('cx',nd.x); c.setAttribute('cy',nd.y); });
    if(nd.type==='stage'){
      const r=bizNodeRadius(nd);
      const issue=nd.stage.health!=='ok';
      const ys=bizLabelYs(r, issue);
      const label=g.querySelector('.biz-label'); if(label){ label.setAttribute('x',nd.x); label.setAttribute('y',nd.y+ys.name); }
      const count=g.querySelector('.biz-doc-count-label'); if(count){ count.setAttribute('x',nd.x); count.setAttribute('y',nd.y+ys.count); }
      const flag=g.querySelector('.biz-issue-label'); if(flag){ flag.setAttribute('x',nd.x); flag.setAttribute('y',nd.y+ys.flag); }
    }
  });
  document.querySelectorAll('#bEdges line').forEach(line=>{
    const a=BNODES[line.dataset.s], b=BNODES[line.dataset.t];
    if(!a||!b) return;
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
  });
}
function bizHighlight(){
  const active=bizSelected||bizHover;
  const conn = active ? bizConnectedIds(active) : null;
  document.querySelectorAll('#bNodes .biz-node').forEach(g=>{
    const id=g.dataset.id, nd=BNODES[id]; if(!nd) return;
    const core=g.querySelector('.biz-core'), glow=g.querySelector('.biz-glow');
    const r=bizNodeRadius(nd);
    if(core) core.setAttribute('r', r);
    if(glow){
      glow.setAttribute('r', nd.type==='stage' ? r+10 : r+6);
      const base = nd.type==='stage' ? (nd.stage.health!=='ok'?0.08:0.16) : 0.12;
      glow.setAttribute('fill-opacity', id===active ? 0.4 : base);
    }
    g.style.opacity = (!active || conn.has(id)) ? '1' : '0.25';
  });
  document.querySelectorAll('#bEdges line').forEach(line=>{
    if(active){
      const on=line.dataset.s===active || line.dataset.t===active;
      line.style.opacity = on? '1' : '0.08';
    } else line.style.opacity='';
  });
}
function renderBizDetail(){
  const panel=document.getElementById('bizDetail');
  if(!panel) return;
  if(!bizSelected){
    panel.innerHTML = `<h3>詳細</h3><div class="struct-detail-empty">工程・資料のノードをクリックすると、詳細とAIが判定した資料充足度の理由が表示されます。</div>`;
    return;
  }
  const nd=BNODES[bizSelected];
  if(!nd){ panel.innerHTML = `<h3>詳細</h3><div class="struct-detail-empty">ノードが見つかりません。</div>`; return; }
  if(nd.type==='doc'){
    const parent=BNODES[nd.parentId];
    panel.innerHTML = `
      <h3>詳細</h3>
      <div class="struct-detail-title">${esc(stripExt(nd.title||''))}</div>
      <div class="struct-detail-meta"><span class="mtag">資料</span></div>
      <div class="struct-detail-links">
        <h4>紐づく工程</h4>
        <div class="struct-link-item" data-id="${esc(nd.parentId)}">
          <span class="dot" style="background:var(--accent)"></span><span>${parent?esc(parent.stage.name):esc(nd.parentId)}</span>
        </div>
      </div>
      <button class="biz-preview-btn" type="button">${ICON.doc} 原本を見る</button>`;
    const link=panel.querySelector('.struct-link-item');
    if(link) link.onclick=()=>{ bizSelected=nd.parentId; renderBizDetail(); bizHighlight(); };
    const prevBtn=panel.querySelector('.biz-preview-btn');
    if(prevBtn) prevBtn.onclick=()=>openDocPreview(nd.docId);
    return;
  }
  const s=nd.stage;
  const mtagCls = s.health==='ok' ? 'mtag' : `mtag mtag-${s.health}`;
  panel.innerHTML = `
    <h3>詳細</h3>
    <div class="struct-detail-title">${esc(s.name)}</div>
    <div class="struct-detail-meta">
      <span class="mtag">資料 ${s.doc_ids.length}件</span>
      <span class="${mtagCls}">${bizHealthLabel(s.health)}</span>
    </div>
    ${s.description?`<div class="struct-detail-summary">${esc(s.description)}</div>`:''}
    ${s.note?`<div class="biz-note ${s.health}">${esc(s.note)}</div>`:''}
    <div class="struct-detail-links">
      <h4>紐づく資料（${(s.doc_titles||[]).length}）</h4>
      ${(s.doc_titles||[]).length? s.doc_titles.map((t,idx)=>`<div class="struct-link-item" data-doc-id="${esc((s.doc_ids||[])[idx]||'')}">
          <span class="dot" style="background:var(--accent)"></span><span>${esc(stripExt(t||''))}</span>
        </div>`).join('') : '<div style="font-size:13px;color:var(--text-3)">紐づく資料はありません</div>'}
    </div>
    ${bizInsightsSectionHtml(s)}`;
  panel.querySelectorAll('.struct-detail-links .struct-link-item[data-doc-id]').forEach(row=>{
    const docId=row.dataset.docId;
    if(!docId) return;
    row.onclick=()=>openDocPreview(docId);
  });
  panel.querySelectorAll('.biz-insight-item').forEach(row=>{
    row.onclick=()=>showAdmin('insights', row.dataset.title||'');
  });
}
function renderBizLoading(){
  const wrap=document.getElementById('bizWrap');
  if(!wrap) return;
  wrap.innerHTML = `<div class="biz-loading">
    <span class="loading"><i></i><i></i><i></i></span>
    <p>業務フローを解析しています…（資料の量により10〜30秒ほどかかります）</p>
  </div>`;
}
function renderBizEmpty(){
  const wrap=document.getElementById('bizWrap');
  wrap.innerHTML = `<div class="biz-empty fu-s" style="--d:0s"><div class="biz-empty-inner">
    <h2>業務フローを可視化する</h2>
    <p>取り込まれた資料から、AIが実際の業務の流れを推定します。資料が薄い・存在しない工程は「資料不足」として表示されます。</p>
    <button class="biz-gen-btn" id="bizGenBtn">${ICON.spark} AIで業務フローを生成する</button>
  </div></div>`;
  document.getElementById('bizGenBtn').onclick=generateBizFlow;
}
function bizRebuildGraph(){
  const built=buildBizGraphData(BIZFLOW, BIZ_AGG);
  BNODES=built.nodes; BEDGES=built.edges;
  buildBizSvg();
  bizView.bindInteractions('.biz-node');
  renderBizDetail();
  bizRunSim();
}
function bizSetAggMode(agg){
  if(BIZ_AGG===agg) return;
  BIZ_AGG=agg;
  bizSelected=null; bizHover=null;
  const wrap=document.getElementById('bizCanvasWrap');
  if(wrap) wrap.classList.add('fading');
  setTimeout(()=>{
    bizRebuildGraph();
    if(wrap) wrap.classList.remove('fading');
  }, 180);
}
function renderBizFlow(){
  const wrap=document.getElementById('bizWrap');
  if(!wrap) return;
  if(!BIZFLOW || !BIZFLOW.stages || !BIZFLOW.stages.length){ renderBizEmpty(); return; }
  const map=BIZFLOW;
  wrap.innerHTML = `<div class="biz-page">
    <div class="biz-main">
      <div class="biz-head">
        <div class="biz-head-title"><div class="biz-title">${esc(map.title)}</div><div class="biz-sub">AIが資料から推定した業務フロー</div></div>
        <div class="biz-head-actions">
          <div class="mgr-toggle biz-agg-toggle">
            <button data-agg="1" class="${BIZ_AGG?'active':''}">集約</button>
            <button data-agg="0" class="${BIZ_AGG?'':'active'}">個別</button>
          </div>
          <button class="biz-regen-btn" id="bizRegenBtn">再生成</button>
        </div>
      </div>
      <div class="biz-canvas-wrap" id="bizCanvasWrap">
        <svg class="biz-canvas" id="bizSvg" viewBox="0 0 ${BIZ_W} ${BIZ_H}" role="img" aria-label="業務フローグラフ"></svg>
        <div class="biz-hint">ホイールで拡大縮小・ドラッグで移動・ダブルクリックでリセット</div>
      </div>
    </div>
    <div class="biz-detail fu-s" style="--d:.1s" id="bizDetail"></div>
  </div>
  <div class="struct-tooltip" id="bizTip"></div>`;
  document.getElementById('bizRegenBtn').onclick=generateBizFlow;
  document.querySelectorAll('.biz-agg-toggle button').forEach(b=>b.onclick=()=>{
    bizSetAggMode(b.dataset.agg==='1');
    document.querySelectorAll('.biz-agg-toggle button').forEach(x=>x.classList.toggle('active', x===b));
  });
  bizSelected=null; bizHover=null;
  bizRebuildGraph();
}
async function generateBizFlow(){
  renderBizLoading();
  try{
    const r=await apiFetch('/api/structure/generate',{method:'POST',headers:authHeaders()});
    if(r.status===401){ toast('セッションが切れました'); return logout(); }
    const d=await r.json();
    BIZFLOW = d.map || null;
  }catch(e){ BIZFLOW=null; }
  renderBizFlow();
}
async function showStructure(){
  VIEW='structure'; setRail('structure');
  SHEET.innerHTML = `<div class="view-full" id="bizWrap"></div>`;
  renderBizLoading();
  if(!bizLoaded) await loadBizFlow();
  await loadAdminInsightsIfNeeded();
  renderBizFlow();
}

/* ---------------- 分析(自分の質問傾向) ---------------- */
async function showAnalysis(){
  VIEW='analysis'; setRail('analysis');
  SHEET.innerHTML = `<div class="view-full view-scroll"><div class="analysis-wrap" id="analysisWrap"><span class="loading"><i></i><i></i><i></i></span></div></div>`;
  let stats=null, analysis=null;
  try{
    const sr=await apiFetch('/api/members/stats',{headers:authHeaders()});
    if(sr.status===401){ toast('セッションが切れました'); return logout(); }
    if(sr.ok){ const sd=await sr.json(); stats=(sd.members&&sd.members.find(m=>m.user_id===ME.id))||(sd.members&&sd.members[0])||null; }
  }catch(e){}
  try{
    const ar=await apiFetch('/api/members/analysis',{headers:authHeaders()});
    if(ar.ok){ const ad=await ar.json(); const ms=(ad.analysis&&ad.analysis.members)||[]; analysis=ms.find(m=>m.user_id===ME.id)||ms[0]||null; }
  }catch(e){}
  renderAnalysis(stats, analysis);
}
function renderAnalysis(stats, analysis){
  const wrap=document.getElementById('analysisWrap');
  if(!wrap) return;
  const s=stats||{question_count:0,blocked_count:0,unanswered_count:0,top_doc_types:[]};
  wrap.innerHTML = `
    <div class="analysis-head fu-s" style="--d:0s">
      <h2>${esc(ME.name)}さんの分析</h2>
      <p>あなたの質問傾向の集計です。他のメンバーのデータは表示されません。</p>
    </div>
    <div class="analysis-stats fu-s" style="--d:.06s">
      <div class="analysis-stat"><div class="k">質問数</div><div class="v" id="an_q">0</div></div>
      <div class="analysis-stat"><div class="k">権限ブロック</div><div class="v" id="an_b">0</div></div>
      <div class="analysis-stat"><div class="k">未回答（資料未該当）</div><div class="v" id="an_u">0</div></div>
    </div>
    <div class="analysis-doctypes fu-s" style="--d:.1s">${(s.top_doc_types&&s.top_doc_types.length)?s.top_doc_types.map(t=>`<span class="tag">${esc(t.doc_type)} ${t.count}</span>`).join(''):'<span class="tag">よく聞くテーマはまだありません</span>'}</div>
    <div class="analysis-section-label fu-s" style="--d:.12s">AI定性分析</div>
    ${analysis ? `
    <div class="analysis-card fu-s" style="--d:.16s">
      <div class="ac-role">${esc(analysis.inferred_role||'')}</div>
      <div class="ac-summary">${esc(analysis.summary||'')}</div>
      ${(analysis.gaps&&analysis.gaps.length)?`<div class="ac-sec"><span class="ac-sec-label">足りていないもの</span><ul>${analysis.gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>`:''}
      ${(analysis.risks&&analysis.risks.length)?`<div class="ac-sec risk"><span class="ac-sec-label">リスク</span><ul>${analysis.risks.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>`:''}
      ${analysis.suggestion?`<div class="ac-suggestion">${esc(analysis.suggestion)}</div>`:''}
    </div>` : `<div class="analysis-empty fu-s" style="--d:.16s">管理者がまだ分析を実行していません。</div>`}
  `;
  countUp(document.getElementById('an_q'), s.question_count);
  countUp(document.getElementById('an_b'), s.blocked_count);
  countUp(document.getElementById('an_u'), s.unanswered_count);
}
