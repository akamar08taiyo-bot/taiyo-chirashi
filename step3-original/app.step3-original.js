const initialItems = [
  {title:'01 廊下・立ち上がり補助',desc:'使用商品：たよレール（置き型・高さ調整式）',product:'たよレール',code:'',units:300,monthly:3000,img:'assets/photo1.jpg',scale:100},
  {title:'02 ベッドサイド',desc:'ベッド周りの立ち上がり、移乗を安全にサポートします。',product:'たよレール／ベッド用',code:'',units:250,monthly:2500,img:'assets/photo2.jpg',scale:100},
  {title:'03 和室・起き上がり',desc:'畳の部屋でも設置しやすい据え置き型の手すりです。',product:'ベストポジションバー',code:'',units:350,monthly:3500,img:'assets/photo3.jpg',scale:100},
  {title:'04 室内ドアの開閉',desc:'扉の開閉や移動時の身体保持をサポートします。',product:'ベストポジションバー＋手すり',code:'',units:400,monthly:4000,img:'assets/photo4.jpg',scale:100},
  {title:'05 キッチン・流し前',desc:'立位保持が必要な家事動作の支えとして設置します。',product:'ベストポジションバー',code:'',units:350,monthly:3500,img:'assets/photo5.jpg',scale:100},
  {title:'06 トイレ・洗面',desc:'便座からの立ち座り、方向転換を安全にサポートします。',product:'ベストポジションバー',code:'',units:400,monthly:4000,img:'assets/photo6.jpg',scale:100},
  {title:'07 廊下のコーナー',desc:'方向転換のある廊下に連続して手すりを配置します。',product:'ベストポジションバー',code:'',units:450,monthly:4500,img:'assets/photo7.jpg',scale:100},
  {title:'08 玄関ホールの上がり框',desc:'上がり框の昇降時に体を支えやすい位置へ設置します。',product:'ベストポジションバー2本立て',code:'',units:500,monthly:5000,img:'assets/photo8.jpg',scale:100},
  {title:'09 屋外アプローチ',desc:'玄関までの移動を安全にするため、動線に合わせて設置します。',product:'たよレールSOTOE',code:'',units:450,monthly:4500,img:'assets/photo9.jpg',scale:100}
];
let items = structuredClone(initialItems);
let visibleCount = 9;
let selectedIndex = 0;
let display = {units:true,burden1:true,burden2:false,burden3:false};
let history = [];
let future = [];
let zoom = 76;
let autosaveTimer;

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const grid = $('#caseGrid');
const itemSelect = $('#itemSelect');

function escapeHtml(str='') {return str.replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function money(n){return Math.round(Number(n)||0).toLocaleString('ja-JP')+'円';}
function itemTitleLabel(item,i){return item.title || `${String(i+1).padStart(2,'0')} 未設定`;}
function snapshot(){history.push(JSON.stringify({items,visibleCount,selectedIndex,display})); if(history.length>30) history.shift(); future=[];}
function restore(payload){({items,visibleCount,selectedIndex,display}=JSON.parse(payload)); syncAll();}
function scheduleSave(){clearTimeout(autosaveTimer); $('#autosaveStatus').textContent='保存中…'; autosaveTimer=setTimeout(()=>{$('#autosaveStatus').textContent='✓ 自動保存済み'; localStorage.setItem('tss-flyer-prototype',JSON.stringify({items,visibleCount,display,title:$('#docTitle').value,subtitle:$('#docSubtitle').value}));},650);}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800);}

function setGridTemplate(){
  const templates={1:['1fr','1fr'],2:['repeat(2,1fr)','1fr'],3:['repeat(3,1fr)','1fr'],4:['repeat(2,1fr)','repeat(2,1fr)'],6:['repeat(3,1fr)','repeat(2,1fr)'],9:['repeat(3,1fr)','repeat(3,1fr)']};
  const [cols,rows]=templates[visibleCount]; grid.style.gridTemplateColumns=cols; grid.style.gridTemplateRows=rows;
}
function renderGrid(){
  setGridTemplate();
  grid.innerHTML='';
  items.slice(0,visibleCount).forEach((item,i)=>{
    const card=document.createElement('article');card.className='case-card'+(i===selectedIndex?' selected':'');card.draggable=true;card.dataset.index=i;
    const burdens=[]; if(display.burden1) burdens.push(`<span>1割負担 <b>${money(item.monthly*.1)}</b></span>`); if(display.burden2) burdens.push(`<span>2割負担 <b>${money(item.monthly*.2)}</b></span>`); if(display.burden3) burdens.push(`<span>3割負担 <b>${money(item.monthly*.3)}</b></span>`);
    card.innerHTML=`<div class="case-photo">${item.img?`<img src="${item.img}" style="--scale:${(item.scale||100)/100}">`:`<div class="photo-empty">写真を追加</div>`}</div><div class="case-copy"><div class="case-title">${escapeHtml(item.title)}</div><div class="case-desc">${escapeHtml(item.desc)}</div>${item.product?`<div class="case-product">商品：${escapeHtml(item.product)}</div>`:''}${display.units?`<div class="unit-line"><span>単位数</span><span><strong>${Number(item.units||0).toLocaleString('ja-JP')}</strong> 単位／月</span></div>`:''}<div class="burden-line">${burdens.join('')}</div></div>`;
    card.addEventListener('click',()=>selectItem(i));
    card.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',String(i)));
    card.addEventListener('dragover',e=>e.preventDefault());
    card.addEventListener('drop',e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isFinite(from)&&from!==i){snapshot();[items[from],items[i]]=[items[i],items[from]];selectedIndex=i;syncAll();scheduleSave();}});
    grid.appendChild(card);
  });
}
function renderSelect(){itemSelect.innerHTML='';items.slice(0,visibleCount).forEach((item,i)=>{const o=document.createElement('option');o.value=i;o.textContent=itemTitleLabel(item,i);itemSelect.append(o)});itemSelect.value=selectedIndex;}
function selectItem(i){selectedIndex=Math.max(0,Math.min(i,visibleCount-1));renderGrid();renderSelect();loadEditor();}
function loadEditor(){const it=items[selectedIndex];$('#itemTitle').value=it.title;$('#itemDescription').value=it.desc;$('#itemProduct').value=it.product;$('#itemCode').value=it.code;$('#itemUnits').value=it.units;$('#monthlyAmount').value=it.monthly;$('#scaleRange').value=it.scale||100;updateCounts();updateCosts();}
function updateCounts(){ $('#titleCount').textContent=$('#itemTitle').value.length; $('#descCount').textContent=$('#itemDescription').value.length; $('#productCount').textContent=$('#itemProduct').value.length; }
function updateCosts(){const m=Number($('#monthlyAmount').value)||0;$('#cost1').textContent=money(m*.1);$('#cost2').textContent=money(m*.2);$('#cost3').textContent=money(m*.3);}
function syncAll(){selectedIndex=Math.min(selectedIndex,visibleCount-1);$$('.layout-grid button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.count)===visibleCount));$$('.switch').forEach(s=>s.classList.toggle('on',display[s.dataset.target]));renderGrid();renderSelect();loadEditor();}
function updateItemFromEditor(){const it=items[selectedIndex];it.title=$('#itemTitle').value;it.desc=$('#itemDescription').value;it.product=$('#itemProduct').value;it.code=$('#itemCode').value;it.units=Number($('#itemUnits').value)||0;it.monthly=Number($('#monthlyAmount').value)||0;updateCounts();updateCosts();renderGrid();renderSelect();scheduleSave();}

$('#docTitle').addEventListener('input',e=>{$('#previewTitle').textContent=e.target.value;scheduleSave()});
$('#docSubtitle').addEventListener('input',e=>{$('#previewSubtitle').textContent=e.target.value;scheduleSave()});
$$('#layoutGrid button').forEach(btn=>btn.addEventListener('click',()=>{snapshot();visibleCount=Number(btn.dataset.count);selectedIndex=Math.min(selectedIndex,visibleCount-1);syncAll();scheduleSave();}));
$$('.switch').forEach(sw=>sw.addEventListener('click',()=>{snapshot();const key=sw.dataset.target;display[key]=!display[key];sw.classList.toggle('on',display[key]);sw.setAttribute('aria-pressed',String(display[key]));renderGrid();scheduleSave();}));
$$('.swatch[data-color]').forEach(sw=>sw.addEventListener('click',()=>{document.documentElement.style.setProperty('--accent',sw.dataset.color);document.documentElement.style.setProperty('--accent-dark',sw.dataset.color);$$('.swatch').forEach(s=>s.classList.remove('active'));sw.classList.add('active');scheduleSave();}));
itemSelect.addEventListener('change',e=>selectItem(Number(e.target.value)));
$('#prevItem').addEventListener('click',()=>selectItem((selectedIndex-1+visibleCount)%visibleCount));
$('#nextItem').addEventListener('click',()=>selectItem((selectedIndex+1)%visibleCount));
['itemTitle','itemDescription','itemProduct','itemCode','itemUnits','monthlyAmount'].forEach(id=>$('#'+id).addEventListener('input',updateItemFromEditor));
$('#photoTab').addEventListener('click',()=>{$('.editor-tabs button:first-child').classList.remove('active');$('#photoTab').classList.add('active');$('#basicEditor').classList.add('hidden');$('#photoEditor').classList.remove('hidden')});
$('.editor-tabs button:first-child').addEventListener('click',()=>{$('#photoTab').classList.remove('active');$('.editor-tabs button:first-child').classList.add('active');$('#photoEditor').classList.add('hidden');$('#basicEditor').classList.remove('hidden')});
$('#scaleRange').addEventListener('input',e=>{items[selectedIndex].scale=Number(e.target.value);renderGrid();scheduleSave()});
$('#centerPhoto').addEventListener('click',()=>{$('#scaleRange').value=100;items[selectedIndex].scale=100;renderGrid();scheduleSave()});
$('#choosePhoto').addEventListener('click',()=>$('#fileInput').click());
$('#fileInput').addEventListener('change',e=>{if(e.target.files[0]) usePhoto(e.target.files[0])});
const drop=$('#dropZone'); ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')}));drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))usePhoto(f)});
function usePhoto(file){snapshot();const reader=new FileReader();reader.onload=()=>{items[selectedIndex].img=reader.result;items[selectedIndex].scale=100;renderGrid();scheduleSave();toast('写真を差し替えました')};reader.readAsDataURL(file)}
$('#aiBtn').addEventListener('click',()=>{const it=items[selectedIndex];const base=(it.desc||it.title).replace(/^使用商品[:：]\s*/,'');const suggestion=`${base}。ご本人の動作と設置場所を確認し、安全に移動・立ち座りができるよう手すりを配置しました。`; if(confirm(`AI文章のプレビュー（表側のみ）\n\n${suggestion}\n\nこの文章を使いますか？`)){snapshot();it.desc=suggestion;loadEditor();renderGrid();scheduleSave();}});
$('#deleteItem').addEventListener('click',()=>{if(confirm('選択中の項目を空にしますか？')){snapshot();items[selectedIndex]={title:`${String(selectedIndex+1).padStart(2,'0')} 未設定`,desc:'',product:'',code:'',units:0,monthly:0,img:'',scale:100};syncAll();scheduleSave();}});
$('#saveBtn').addEventListener('click',()=>{scheduleSave();toast('下書きを保存しました')});
$('#pdfBtn').addEventListener('click',()=>{toast('PDF出力は最終実装で有効化します。現在は印刷プレビューで確認できます。');setTimeout(()=>window.print(),700)});
$('#printBtn').addEventListener('click',()=>window.print());
$('#pngBtn').addEventListener('click',()=>toast('PNG書き出しは裏側実装時に接続します'));
$('#undoBtn').addEventListener('click',()=>{if(!history.length)return toast('戻せる操作がありません');future.push(JSON.stringify({items,visibleCount,selectedIndex,display}));restore(history.pop());scheduleSave()});
$('#redoBtn').addEventListener('click',()=>{if(!future.length)return toast('やり直せる操作がありません');history.push(JSON.stringify({items,visibleCount,selectedIndex,display}));restore(future.pop());scheduleSave()});
$('#resetBtn').addEventListener('click',()=>{if(confirm('初期状態に戻しますか？')){snapshot();items=structuredClone(initialItems);visibleCount=9;selectedIndex=0;display={units:true,burden1:true,burden2:false,burden3:false};$('#docTitle').value='手すり設置 事例集';$('#docSubtitle').value='起き上がり・立ち上がり・移動、日常の動作に合わせて、置き型・突っ張り式を選べます。';$('#previewTitle').textContent=$('#docTitle').value;$('#previewSubtitle').textContent=$('#docSubtitle').value;syncAll();scheduleSave();}});
$('#zoomIn').addEventListener('click',()=>setZoom(Math.min(100,zoom+4)));$('#zoomOut').addEventListener('click',()=>setZoom(Math.max(60,zoom-4)));function setZoom(v){zoom=v;$('#zoomLabel').textContent=v+'%';$('#paper').style.transform=`scale(${v/76})`;}

// Restore last draft only when it matches this prototype schema.
try{const saved=JSON.parse(localStorage.getItem('tss-flyer-prototype'));if(saved?.items?.length===9){items=saved.items;visibleCount=saved.visibleCount||9;display=saved.display||display;if(saved.title){$('#docTitle').value=saved.title;$('#previewTitle').textContent=saved.title}if(saved.subtitle){$('#docSubtitle').value=saved.subtitle;$('#previewSubtitle').textContent=saved.subtitle}}}catch(_){/* ignore */}
syncAll();
