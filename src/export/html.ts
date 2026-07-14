import { ExportBundle } from './collect'
import { renderChartSvg, rowsToChartData } from '../charts/renderChart'

/**
 * Build a single self-contained .html file: embedded board JSON + read-only viewer.
 * `extraScript` lets the live-session layer inject additional behavior (phase 10).
 */
export function buildHtmlExport(bundle: ExportBundle, extraScript = ''): string {
  const json = JSON.stringify(bundle).replace(/<\//g, '<\\/')
  const safeExtra = extraScript.replace(/<\/script/gi, '<\\/script')
  const title = bundle.boards.find((b) => b.id === bundle.rootBoardId)?.title ?? 'Board'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Folium</title>
<style>
:root{
  --bg:#f3eee3;--bg-dot:#d9d0bb;--chrome:#fbf8f0;--border:#e2dac6;--ink:#2c2a23;--soft:#6e6857;--faint:#a49b84;
  --accent:#2f6d5a;--orange:#b4622d;--yellow:#f5e3a3;--shadow:0 1px 2px rgba(74,64,41,.1),0 2px 6px rgba(74,64,41,.08);
  --c-white:#fffdf7;--c-gray:#ede8da;--c-yellow:#f5e3a3;--c-orange:#f2c99a;--c-red:#eeafa2;--c-green:#c8dfc0;--c-blue:#becfdd;--c-purple:#d4c4dd;--c-dark:#3a372e;
}
[data-theme=dark]{--bg:#26231c;--bg-dot:#3d382b;--chrome:#1c1a15;--border:#383327;--ink:#e9e4d6;--soft:#a59d88;--faint:#6f6851;--accent:#5aa88e;--orange:#d08a53;--c-white:#2e2b23;--c-gray:#38342a}
/* Wave 2: per-board canvas backgrounds — mirrors .app-canvas[data-board-bg]
   in src/styles/global.css. data-bg is set on <body> from board.background. */
[data-bg=sage]{--bg:#eef1e8;--bg-dot:#dbe3d1}
[data-bg=sand]{--bg:#f0e6d3;--bg-dot:#ddcfae}
[data-bg=blush]{--bg:#f5e8e2;--bg-dot:#e3cec4}
[data-bg=slate]{--bg:#ecedf0;--bg-dot:#d6d9de}
[data-theme=dark][data-bg=sage]{--bg:#1e2620;--bg-dot:#303c2c}
[data-theme=dark][data-bg=sand]{--bg:#2a2416;--bg-dot:#3f3620}
[data-theme=dark][data-bg=blush]{--bg:#2c2019;--bg-dot:#402d23}
[data-theme=dark][data-bg=slate]{--bg:#22242b;--bg-dot:#363944}
[data-bg=dots] #viewport{background-image:radial-gradient(var(--bg-dot) 1.2px,transparent 1.2px);background-size:24px 24px}
[data-bg=ruled] #viewport{background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 27px,var(--bg-dot) 27px,var(--bg-dot) 28px)}
[data-bg=grid] #viewport{background-image:linear-gradient(to right,var(--bg-dot) 1px,transparent 1px),linear-gradient(to bottom,var(--bg-dot) 1px,transparent 1px);background-size:24px 24px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Karla,-apple-system,'Segoe UI',sans-serif;font-size:14px;color:var(--ink);background:var(--bg)}
header{position:sticky;top:0;background:var(--chrome);border-bottom:1px solid var(--border);padding:10px 18px;z-index:50;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
header .crumbs{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:600;color:var(--soft);flex:1;min-width:0}
header .crumbs a{color:var(--soft);text-decoration:none;padding:3px 5px;border-radius:4px}
header .crumbs a:hover{background:var(--bg);color:var(--ink)}
header .crumbs .cur{color:var(--ink)}
header .badge{font-size:11px;color:var(--faint)}
header .actions{display:flex;gap:8px;align-items:center}
header button{font:inherit;font-size:12.5px;color:var(--soft);background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;cursor:pointer}
header button:hover{color:var(--ink)}
h1.title{font-family:'Fraunces',Georgia,serif;font-size:22px;color:var(--ink);width:100%;text-align:center;padding:8px 0 2px}
#viewport{position:relative;overflow:auto;height:calc(100vh - 92px);cursor:grab}
#viewport.panning{cursor:grabbing}
#viewport.panning *{user-select:none}
#world{position:relative;transform-origin:0 0}
.card{position:absolute;background:var(--c-white);border-radius:4px;box-shadow:var(--shadow);font-size:13.5px;line-height:1.5;cursor:auto}
.card.tp{background:transparent;box-shadow:none}
.note{padding:10px 12px;border-radius:4px;word-break:break-word}
.note h1{font-size:17px;margin:4px 0 8px}.note h2{font-size:15px;margin:4px 0 6px}
.note p{margin:0 0 6px}.note p:last-child{margin-bottom:0}
.note ul,.note ol{padding-left:20px;margin:0 0 6px}
.note mark{background:var(--yellow)}
.note blockquote{border-left:3px solid var(--border);padding-left:10px;color:var(--soft)}
.note .task{list-style:none;padding-left:2px}.note .task li{display:flex;gap:7px}
.bgc-dark{color:#f0efec}
.todo{padding:10px 12px}.todo .tt{font-weight:600;margin-bottom:4px}
.todo .it{display:flex;gap:8px;align-items:center;padding:2px 0}
.todo .done span{text-decoration:line-through;color:var(--soft)}
.linkc .lb{padding:8px 12px 10px}
.linkc .lu{font-size:11px;color:var(--faint);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:none}
.linkc .lt{color:var(--orange);font-weight:600;display:block;text-decoration:none;margin-top:2px}
.linkc .ld{font-size:12.5px;color:var(--soft)}
.linkc img.th{width:100%;display:block;border-radius:4px 4px 0 0}
.linkc .mapsth{display:flex;align-items:center;justify-content:center;height:110px;background:var(--accent-soft,#e0ece4);color:var(--accent);border-radius:4px 4px 0 0}
figure.img{margin:0;background:var(--chrome);border-radius:4px;overflow:hidden;box-shadow:var(--shadow)}
figure.img .wrap{position:relative}
figure.img img{width:100%;display:block}
figure.img figcaption{font-size:12px;color:var(--soft);padding:6px 10px}
.pin{position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50% 50% 50% 4px;background:var(--orange);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.pinpop{position:absolute;z-index:90;width:230px;background:var(--chrome);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 24px rgba(40,40,35,.18);padding:9px 10px;font-size:12.5px}
.pinpop .who{font-weight:600;font-size:12px}.pinpop .when{color:var(--faint);font-size:11px;margin-left:5px}
.pinpop .rep{border-left:2px solid var(--border);padding-left:7px;margin-top:6px}
.filec{background:var(--chrome);border-radius:4px;box-shadow:var(--shadow);overflow:hidden}
.filec .row{display:flex;gap:10px;align-items:center;padding:10px 12px}
.filec .badge{width:38px;height:44px;border-radius:5px;background:var(--accent-soft,#e0ece4);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex:none}
.filec .nm{font-weight:600;font-size:13px}.filec .sz{font-size:11.5px;color:var(--soft)}
.filec a{color:var(--accent)}
.filec video,.filec audio{width:100%;display:block}
.boardc{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 6px;cursor:pointer}
.boardc .tile{width:92px;height:92px;border-radius:20px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;box-shadow:var(--shadow)}
.boardc .bn{font-weight:600;font-size:13px}.boardc .bc{font-size:11px;color:var(--faint)}
.colc{background:rgba(0,0,0,.045);border-radius:8px;padding:8px}
[data-theme=dark] .colc{background:rgba(255,255,255,.05)}
.colc .ch{display:flex;gap:6px;padding:2px 4px 8px;font-weight:600;font-size:13px}
.colc .cnt{color:var(--faint);font-weight:400;font-size:11px}
.colc .stack{display:flex;flex-direction:column;gap:8px}
.colc .stack>div{background:var(--c-white);border-radius:4px;box-shadow:var(--shadow);overflow:hidden;position:relative}
.cmt{background:var(--chrome);border-radius:8px;box-shadow:var(--shadow);padding:10px 12px;font-size:13px}
.cmt .who{font-weight:600;font-size:12.5px}.cmt .when{font-size:11px;color:var(--faint);margin-left:6px}
.cmt .av{display:inline-flex;width:20px;height:20px;border-radius:50%;color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;margin-right:6px;vertical-align:middle}
.cmt .rep{border-left:2px solid var(--border);padding-left:7px;margin-top:7px}
table.tbl{width:100%;border-collapse:collapse;background:var(--chrome);border-radius:4px;overflow:hidden;box-shadow:var(--shadow);font-size:12.5px}
table.tbl td{border:1px solid var(--border);padding:7px 9px}
table.tbl tr:first-child{background:var(--yellow);font-weight:700}
[data-theme=dark] table.tbl tr:first-child{background:#4d451c}
.chartc{padding:8px}
.chartc svg{width:100%;height:auto;display:block}
.swatch{border-radius:4px;overflow:hidden;background:var(--chrome);box-shadow:var(--shadow)}
.swatch .blk{height:88px;position:relative}.swatch .hx{position:absolute;top:10px;left:12px;font-weight:600;font-size:13px}
.swatch .nm{padding:9px 12px;font-size:13px}
.stick{width:100%;height:100%;padding:12px;border-radius:2px;box-shadow:0 2px 8px rgba(40,40,35,.22);display:flex;align-items:center;justify-content:center;text-align:center;font-weight:500;color:#33373b}
.shape{position:relative;width:100%;height:100%}
.shape svg{position:absolute;inset:0;width:100%;height:100%}
.shape .tx{position:absolute;inset:30% 18%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:500;font-size:13px;color:#33373b}
.framec{box-sizing:border-box;width:100%;height:100%;border:1.5px dashed var(--accent);border-radius:6px;background:rgba(47,109,90,.04);padding:6px 10px}
.framec .fh{display:inline-block;font-weight:600;font-size:13px;color:var(--accent)}
.headingc{font-family:'Fraunces',Georgia,serif;font-weight:700;color:var(--ink);width:100%;word-break:break-word}
.headingc.h1{font-size:28px;line-height:1.2}
.headingc.h2{font-size:22px;line-height:1.25}
.headingc.h3{font-size:17px;line-height:1.3}
svg.lines{position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;pointer-events:none}
svg.lines path{stroke:var(--soft);stroke-width:2;fill:none}
svg.lines text{font-size:12px;fill:var(--soft);paint-order:stroke;stroke:var(--bg);stroke-width:4px}
.empty{color:var(--faint);font-size:13px;padding:60px;text-align:center}
#livebar{display:none}
@media print{
  header,#livebar{display:none!important}
  #viewport{height:auto;overflow:visible}
  #world{transform:none!important;height:auto!important;width:auto!important}
  .card{position:static!important;width:auto!important;max-width:520px;margin:0 0 14px;page-break-inside:avoid}
  svg.lines{display:none}
}
</style>
</head>
<body>
<header>
  <div class="crumbs" id="crumbs"></div>
  <div class="actions">
    <span class="badge" id="stamp"></span>
    <button onclick="window.print()">Print / PDF</button>
    <span id="livebar"></span>
  </div>
  <h1 class="title" id="btitle"></h1>
</header>
<div id="viewport"><div id="world"></div></div>
<script id="atlas-data" type="application/json">${json}</script>
<script>
var DATA = JSON.parse(document.getElementById('atlas-data').textContent);
var boards = {}; DATA.boards.forEach(function(b){ boards[b.id] = b; });
var current = DATA.rootBoardId;
var zoom = 1;
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); };
var renderChartSvg = ${renderChartSvg.toString()};
var rowsToChartData = ${rowsToChartData.toString()};
var safeUrl = function(u){ u=String(u==null?'':u).trim(); return (/^(https?:|mailto:|data:image\\/|data:video\\/|data:audio\\/|data:application\\/)/i.test(u)) ? esc(u) : ''; };
function relTime(ts){ var d = Date.now()-ts; if(d<3600000) return Math.max(1,Math.floor(d/60000))+'m ago'; if(d<86400000) return Math.floor(d/3600000)+'h ago'; return new Date(ts).toLocaleDateString(); }
function avatar(name){ var h=0; for(var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))|0; return '<span class="av" style="background:hsl('+(Math.abs(h)%360)+' 55% 55%)">'+esc((name||'?')[0].toUpperCase())+'</span>'; }
function marksWrap(text, marks){
  var t = esc(text);
  (marks||[]).forEach(function(m){
    if(m.type==='bold') t='<b>'+t+'</b>';
    else if(m.type==='italic') t='<i>'+t+'</i>';
    else if(m.type==='underline') t='<u>'+t+'</u>';
    else if(m.type==='strike') t='<s>'+t+'</s>';
    else if(m.type==='code') t='<code>'+t+'</code>';
    else if(m.type==='highlight') t='<mark>'+t+'</mark>';
    else if(m.type==='link') t='<a href="'+safeUrl(m.attrs&&m.attrs.href)+'" target="_blank">'+t+'</a>';
  });
  return t;
}
function renderDoc(node){
  if(!node) return '';
  var kids = (node.content||[]).map(renderDoc).join('');
  switch(node.type){
    case undefined: case 'doc': return kids;
    case 'paragraph': return '<p>'+kids+'</p>';
    case 'heading': return '<h'+Math.min(2,(node.attrs&&node.attrs.level)||1)+'>'+kids+'</h'+Math.min(2,(node.attrs&&node.attrs.level)||1)+'>';
    case 'text': return marksWrap(node.text, node.marks);
    case 'bulletList': return '<ul>'+kids+'</ul>';
    case 'orderedList': return '<ol>'+kids+'</ol>';
    case 'listItem': return '<li>'+kids+'</li>';
    case 'taskList': return '<ul class="task">'+kids+'</ul>';
    case 'taskItem': return '<li>'+((node.attrs&&node.attrs.checked)?'☑':'☐')+' <div>'+kids+'</div></li>';
    case 'blockquote': return '<blockquote>'+kids+'</blockquote>';
    case 'codeBlock': return '<pre><code>'+kids+'</code></pre>';
    case 'hardBreak': return '<br>';
    default: return kids;
  }
}
function blobSrc(c){ return c.blobId ? (DATA.blobs[c.blobId]||'') : (c.url||''); }
function ytId(url){ var m=(url||'').match(/(?:youtube\\.com\\/(?:watch\\?(?:.*&)?v=|shorts\\/|embed\\/)|youtu\\.be\\/)([\\w-]{11})/); return m?m[1]:null; }
function mapsUrl(url){ return /google\\.com\\/maps|maps\\.google\\.com|goo\\.gl\\/maps|maps\\.app\\.goo\\.gl/i.test(url||''); }
function fmtSize(b){ if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function pinsHtml(c, cardId){
  return (c.pins||[]).map(function(p,i){
    return '<button class="pin" data-pin="'+cardId+':'+i+'" style="left:'+(p.fx*100)+'%;top:'+(p.fy*100)+'%">'+(i+1)+'</button>';
  }).join('');
}
function cardBody(card){
  var c = card.content;
  switch(c.kind){
    case 'note': return '<div class="note" style="background:var(--c-'+(c.bg||'white')+')"><div class="'+(c.bg==='dark'?'bgc-dark':'')+'">'+renderDoc(c.doc)+'</div></div>';
    case 'todo': return '<div class="todo">'+(c.title?'<div class="tt">'+esc(c.title)+'</div>':'')+c.items.map(function(it){return '<div class="it'+(it.done?' done':'')+'">'+(it.done?'☑':'☐')+' <span>'+esc(it.text)+'</span></div>';}).join('')+'</div>';
    case 'link': { var y=ytId(c.url); var isMap=!y&&mapsUrl(c.url); var thumb=y?'<a href="'+safeUrl(c.url)+'" target="_blank"><img class="th" src="https://img.youtube.com/vi/'+y+'/hqdefault.jpg"></a>':(isMap?'<a class="th mapsth" href="'+safeUrl(c.url)+'" target="_blank" title="Open in Maps"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="6.5"/><path d="M12 16.5V21"/></svg></a>':''); return '<div class="linkc">'+thumb+'<div class="lb"><a class="lu" href="'+esc(c.url)+'" target="_blank">'+esc(c.url)+'</a><a class="lt" href="'+esc(c.url)+'" target="_blank">'+esc(c.title||c.url)+'</a>'+(c.description?'<div class="ld">'+esc(c.description)+'</div>':'')+'</div></div>'; }
    case 'image': { var src=blobSrc(c); return '<figure class="img"><div class="wrap">'+(src?'<img src="'+safeUrl(src)+'">':'<div class="empty">image missing</div>')+pinsHtml(c, card.id)+'</div>'+(c.caption?'<figcaption>'+esc(c.caption)+'</figcaption>':'')+'</figure>'; }
    case 'file': { var src2=blobSrc(c); var media=''; if(src2&&c.mime.indexOf('video/')===0) media='<video controls src="'+safeUrl(src2)+'"></video>'; if(src2&&c.mime.indexOf('audio/')===0) media='<audio controls src="'+safeUrl(src2)+'"></audio>'; var ext=(c.name.split('.').pop()||'FILE').toUpperCase().slice(0,4); return '<div class="filec">'+media+'<div class="row"><div class="badge">'+esc(ext)+'</div><div><div class="nm">'+esc(c.name)+'</div><div class="sz">'+(src2?'<a download="'+esc(c.name)+'" href="'+safeUrl(src2)+'">Download</a> · ':'')+fmtSize(c.size)+'</div></div></div></div>'; }
    case 'board': { var b=boards[c.boardId]; if(!b) return ''; var n=DATA.cards.filter(function(k){return k.boardId===c.boardId;}).length; return '<div class="boardc" data-board="'+b.id+'"><div class="tile" style="background:'+esc(b.color)+'">▦</div><div class="bn">'+esc(b.title)+'</div><div class="bc">'+n+' cards</div></div>'; }
    case 'column': { var members=DATA.cards.filter(function(k){return k.colId===card.id;}).sort(function(a,b){return a.colIndex-b.colIndex;}); return '<div class="colc"><div class="ch">'+esc(c.title||'Column')+' <span class="cnt">'+members.length+'</span></div><div class="stack">'+members.map(function(m){return '<div>'+cardBody(m)+'</div>';}).join('')+'</div></div>'; }
    case 'comment': return '<div class="cmt">'+avatar(c.author)+'<span class="who">'+esc(c.author)+'</span><span class="when">'+relTime(c.ts)+'</span><div>'+esc(c.text)+'</div>'+(c.replies||[]).map(function(r){return '<div class="rep">'+avatar(r.author)+'<span class="who">'+esc(r.author)+'</span><span class="when">'+relTime(r.ts)+'</span><div>'+esc(r.text)+'</div></div>';}).join('')+'</div>';
    case 'table': return '<table class="tbl">'+c.rows.map(function(r){return '<tr>'+r.map(function(cell){return '<td>'+esc(cell)+'</td>';}).join('')+'</tr>';}).join('')+'</table>';
    case 'chart': { var cd = rowsToChartData(c.rows); return '<div class="chartc">'+renderChartSvg({chart:c.chart,title:c.title,seriesNames:cd.seriesNames,points:cd.points,palette:['#2f6d5a','#b4622d','#c24e3e','#b8912e','#5b7fa6','#7a5f96','#a64d79','#5f7040','#6b5138','#5c6062']})+'</div>'; }
    case 'swatch': return '<div class="swatch"><div class="blk" style="background:'+esc(c.hex)+'"><span class="hx">'+esc(c.hex.toUpperCase())+'</span></div>'+(c.name?'<div class="nm">'+esc(c.name)+'</div>':'')+'</div>';
    case 'sticky': return '<div class="stick" style="background:var(--c-'+(c.color||'yellow')+')">'+esc(c.text)+'</div>';
    case 'shape': { var col='var(--c-'+(c.fill||'blue')+')'; var sh=''; if(c.shape==='ellipse') sh='<ellipse cx="50" cy="50" rx="48" ry="48" fill="'+col+'"/>'; else if(c.shape==='diamond') sh='<polygon points="50,2 98,50 50,98 2,50" fill="'+col+'"/>'; else sh='<rect x="2" y="2" width="96" height="96" rx="6" fill="'+col+'"/>'; return '<div class="shape"><svg viewBox="0 0 100 100" preserveAspectRatio="none">'+sh+'</svg><div class="tx">'+esc(c.text)+'</div></div>'; }
    case 'ink': { var paths=(c.strokes||[]).map(function(s){ var d=''; for(var i=0;i+1<s.points.length;i+=2){ d+=(i===0?'M ':' L ')+s.points[i]+' '+s.points[i+1]; } return '<path d="'+d+'" stroke="'+esc(s.color)+'" stroke-width="'+s.width+'" fill="none" stroke-linecap="round"/>'; }).join(''); return '<svg style="display:block;width:100%;height:100%" viewBox="0 0 '+c.natW+' '+c.natH+'" preserveAspectRatio="none">'+paths+'</svg>'; }
    case 'frame': return '<div class="framec"><div class="fh">'+esc(c.title||'Frame')+'</div></div>';
    case 'heading': return '<div class="headingc h'+c.level+'">'+esc(c.text)+'</div>';
  }
  return '';
}
var TP = {sticky:1,shape:1,ink:1,board:1,swatch:1,comment:1,column:1,image:1,frame:1,heading:1};
function anchor(r, other){
  var cx=r.x+r.w/2, cy=r.y+r.h/2, dx=other.x-cx, dy=other.y-cy;
  if(Math.abs(dx)*r.h > Math.abs(dy)*r.w) return {x: dx>0?r.x+r.w:r.x, y:cy};
  return {x:cx, y: dy>0?r.y+r.h:r.y};
}
function edgeAnchor(r, ax, ay){
  var px=r.x+ax*r.w, py=r.y+ay*r.h, dx=px-(r.x+r.w/2), dy=py-(r.y+r.h/2);
  if(Math.abs(dx)*r.h > Math.abs(dy)*r.w) return {x: dx>0?r.x+r.w:r.x, y:py};
  return {x:px, y: dy>0?r.y+r.h:r.y};
}
function render(){
  var board = boards[current];
  document.getElementById('btitle').textContent = board.title;
  document.body.setAttribute('data-theme', board.theme==='dark'?'dark':'light');
  document.body.setAttribute('data-bg', board.background||'default');
  document.getElementById('stamp').textContent = 'Exported ' + new Date(DATA.exportedAt).toLocaleDateString() + ' · Folium';
  // breadcrumbs within the export
  var trail=[]; var cur=board;
  while(cur){ trail.unshift(cur); cur = cur.parentId ? boards[cur.parentId] : null; }
  document.getElementById('crumbs').innerHTML = trail.map(function(b,i){
    return i===trail.length-1 ? '<span class="cur">'+esc(b.title)+'</span>' : '<a href="#" data-board="'+b.id+'">'+esc(b.title)+'</a>';
  }).join(' <span style="color:var(--faint)">/</span> ');

  var cards = DATA.cards.filter(function(c){ return c.boardId===current && !c.colId; }).sort(function(a,b){return a.z-b.z;});
  var world = document.getElementById('world');
  if(!cards.length){ world.innerHTML = '<div class="empty">This board is empty.</div>'; world.style.width='auto'; world.style.height='auto'; return; }
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  cards.forEach(function(c){ minX=Math.min(minX,c.x); minY=Math.min(minY,c.y); maxX=Math.max(maxX,c.x+c.w); maxY=Math.max(maxY,c.y+(c.h||200)); });
  var pad=50, offX=minX-pad, offY=minY-pad;
  window.__offs = { offX: offX, offY: offY };
  world.innerHTML = '<svg class="lines" id="linesvg"></svg>' + cards.map(function(c){
    // frames always render behind regular cards, mirroring the live app
    var zi = c.type==='frame' ? c.z-1000000 : c.z;
    var style='left:'+(c.x-offX)+'px;top:'+(c.y-offY)+'px;width:'+c.w+'px;'+(c.h?'height:'+c.h+'px;':'')+'z-index:'+zi;
    return '<div class="card'+(TP[c.type]?' tp':'')+'" data-card="'+c.id+'" style="'+style+'">'+cardBody(c)+'</div>';
  }).join('');
  world.style.width=(maxX-minX+2*pad)+'px';
  world.style.height=(maxY-minY+2*pad)+'px';
  // fit-to-width as the initial zoom; ctrl/cmd+wheel adjusts it interactively from here
  var vp=document.getElementById('viewport');
  zoom=Math.min(1, (vp.clientWidth-20)/(maxX-minX+2*pad));
  world.style.transform='scale('+zoom+')';
  world.parentNode.style.height='calc(100vh - 92px)';
  // draw lines after layout (measure real heights)
  requestAnimationFrame(function(){
    var rects={};
    cards.forEach(function(c){ var el=world.querySelector('[data-card="'+c.id+'"]'); if(el) rects[c.id]={x:el.offsetLeft,y:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight}; });
    var svg=document.getElementById('linesvg'); if(!svg) return;
    var lines = DATA.lines.filter(function(l){ return l.boardId===current; });
    // one arrow marker per distinct line color in use, so markers inherit the
    // per-line stroke color (SVG markers don't cascade currentColor from the
    // referencing element, so a shared marker can't just recolor itself)
    var usedColors = {};
    lines.forEach(function(l){ if(l.arrowStart||l.arrowEnd) usedColors[l.color||'DEFAULT']=true; });
    var colorIds = {};
    var defs = '<defs>';
    Object.keys(usedColors).forEach(function(col,i){
      var mid='ah'+i; colorIds[col]=mid;
      var strokeVal = col==='DEFAULT' ? 'var(--soft)' : esc(col);
      defs += '<marker id="'+mid+'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="'+strokeVal+'" stroke-width="1.8"/></marker>';
    });
    defs += '</defs>';
    svg.innerHTML = defs + lines.map(function(l){
      var fromEnd = l.from, toEnd = l.to;
      function pt(end, other){ if(end.cardId){ var r=rects[end.cardId]; if(!r) return null; if(!other) return {x:r.x+r.w/2,y:r.y+r.h/2}; if(end.ax!=null&&end.ay!=null) return edgeAnchor(r,end.ax,end.ay); return anchor(r,other); } return {x:end.x-offX,y:end.y-offY}; }
        var ca=pt(fromEnd,null), cb=pt(toEnd,null); if(!ca||!cb) return '';
        var a=pt(fromEnd,cb), b=pt(toEnd,ca);
        var mx=(a.x+b.x)/2, my=(a.y+b.y)/2, cxp=mx-(b.y-a.y)*l.curve, cyp=my+(b.x-a.x)*l.curve;
        var d='M '+a.x+' '+a.y+' Q '+cxp+' '+cyp+' '+b.x+' '+b.y;
        var lbl = l.label ? '<text x="'+((a.x+2*cxp+b.x)/4)+'" y="'+((a.y+2*cyp+b.y)/4)+'" text-anchor="middle">'+esc(l.label)+'</text>' : '';
        var col = l.color || null;
        var style = 'stroke:'+(col?esc(col):'var(--soft)')+';stroke-width:'+(l.width||2)+(l.dash?';stroke-dasharray:6 6':'')+';';
        var markerId = colorIds[col||'DEFAULT'];
        return '<path d="'+d+'" style="'+style+'"'+(l.arrowEnd?' marker-end="url(#'+markerId+')"':'')+(l.arrowStart?' marker-start="url(#'+markerId+')"':'')+'/>'+lbl;
      }).join('');
  });
}
document.addEventListener('click', function(e){
  var nav = e.target.closest('[data-board]');
  if(nav){ e.preventDefault(); current = nav.getAttribute('data-board'); render(); window.scrollTo(0,0); return; }
  var pin = e.target.closest('[data-pin]');
  var old = document.querySelector('.pinpop'); if(old) old.remove();
  if(pin){
    var parts = pin.getAttribute('data-pin').split(':');
    var card = DATA.cards.filter(function(c){return c.id===parts[0];})[0];
    var p = card.content.pins[Number(parts[1])];
    var pop = document.createElement('div');
    pop.className='pinpop';
    pop.style.left = (parseFloat(pin.style.left)+2)+'%';
    pop.style.top = 'calc('+pin.style.top+' + 16px)';
    pop.innerHTML = '<div>'+avatarPin(p.author)+'<span class="who">'+esc(p.author)+'</span><span class="when">'+relTime(p.ts)+'</span></div><div>'+esc(p.text)+'</div>'+(p.replies||[]).map(function(r){return '<div class="rep"><span class="who">'+esc(r.author)+'</span><span class="when">'+relTime(r.ts)+'</span><div>'+esc(r.text)+'</div></div>';}).join('');
    pin.parentNode.appendChild(pop);
  }
});
function avatarPin(name){ return avatar(name); }
// drag-to-pan, mirroring the app: grab the board and the content follows the
// cursor. Left-drag pans only from empty background (so card text stays
// selectable); middle-drag pans from anywhere.
(function(){
  var vp = document.getElementById('viewport');
  var panG = null;
  vp.addEventListener('pointerdown', function(e){
    var onBackground = e.target === vp || e.target.id === 'world' || e.target.id === 'linesvg';
    if(e.button !== 1 && !(e.button === 0 && onBackground)) return;
    if(e.target.closest && e.target.closest('a, button, [data-pin]')) return;
    e.preventDefault();
    try { vp.setPointerCapture(e.pointerId); } catch(err) {}
    panG = { x: e.clientX, y: e.clientY, sl: vp.scrollLeft, st: vp.scrollTop };
    vp.classList.add('panning');
  });
  vp.addEventListener('pointermove', function(e){
    if(!panG) return;
    vp.scrollLeft = panG.sl - (e.clientX - panG.x);
    vp.scrollTop = panG.st - (e.clientY - panG.y);
  });
  function endPan(e){
    if(!panG) return;
    panG = null;
    vp.classList.remove('panning');
    try { vp.releasePointerCapture(e.pointerId); } catch(err) {}
  }
  vp.addEventListener('pointerup', endPan);
  vp.addEventListener('pointercancel', endPan);
})();
// ctrl/cmd+wheel zooms the board content (around the cursor) instead of the
// browser page; plain wheel keeps native scrolling for panning
document.getElementById('viewport').addEventListener('wheel', function(e){
  if(!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  var vp = document.getElementById('viewport');
  var world = document.getElementById('world');
  var r = vp.getBoundingClientRect();
  var mx = e.clientX - r.left + vp.scrollLeft;
  var my = e.clientY - r.top + vp.scrollTop;
  var worldX = mx / zoom, worldY = my / zoom;
  var factor = Math.exp(-e.deltaY * 0.0015);
  zoom = Math.min(4, Math.max(0.1, zoom * factor));
  world.style.transform = 'scale('+zoom+')';
  vp.scrollLeft = worldX * zoom - (e.clientX - r.left);
  vp.scrollTop = worldY * zoom - (e.clientY - r.top);
}, {passive:false});
render();
${safeExtra}
</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
