// K MART - Item Master + Barcode -> List -> Excel | 23000 items
const SHEET_ID = "1ZavPmJyh07AYmTfFzi5JwfUzCsBnKAGjVOEhPMF8oxY";
const GID = "0";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

let PRODUCTS = [];
let LIST = JSON.parse(localStorage.getItem('kmart_list') || '[]');
let html5QrCode = null;
let cameraOn = false;

function setStatus(text, color){
  const t = document.getElementById('status-text');
  const d = document.getElementById('status-dot');
  if(t) t.textContent = text;
  if(d) d.className = `w-2.5 h-2.5 rounded-full animate-pulse ${color || 'bg-emerald-500'}`;
  const lu = document.getElementById('last-update-container');
  const lut = document.getElementById('last-update-time');
  if(lu) lu.classList.remove('hidden');
  if(lu) lu.classList.add('flex');
  if(lut) lut.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function fastParse(text){
  const lines = text.split('\n');
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
  const idx = (n)=> header.findIndex(h=>h.includes(n));
  const iBarcode = idx('barcode'), iName = idx('itemname'), iMRP = idx('mrp'),
        iCost = idx('costprice'), iGroup = idx('groupname'), iStock = idx('livestock'),
        iCF = idx('cf'), iNo = idx('itemno');
  const out = [];
  for(let i=1; i<lines.length; i++){
    const line = lines[i];
    if(!line.trim()) continue;
    const r = line.split(',');
    const name = (r[iName]||'').replace(/"/g,'').trim();
    if(!name) continue;
    out.push({
      barcode: (r[iBarcode]||'').replace(/"/g,'').trim(),
      name: name,
      mrp: parseFloat(r[iMRP])||0,
      cost: parseFloat(r[iCost])||0,
      group: (r[iGroup]||'').replace(/"/g,'').trim(),
      stock: (r[iStock]||'').replace(/"/g,'').trim(),
      cf: (r[iCF]||'').replace(/"/g,'').trim(),
      itemNo: (r[iNo]||'').replace(/"/g,'').trim()
    });
  }
  return out;
}

async function loadProducts(){
  setStatus('Loading 23000 items...', 'bg-orange-500');
  const cached = localStorage.getItem('kmart_cache_v1');
  const cachedTime = localStorage.getItem('kmart_cache_time');
  const isFresh = cached && cachedTime && (Date.now() - Number(cachedTime) < 1000*60*60*6);
  if(isFresh){
    try{
      PRODUCTS = JSON.parse(cached);
      setStatus(`${PRODUCTS.length} items loaded • Ready (Cached)`, 'bg-emerald-500');
      fetchFreshInBackground();
      renderList();
      return;
    }catch(e){}
  }
  await fetchFreshInBackground();
  renderList();
}

async function fetchFreshInBackground(){
  try{
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    PRODUCTS = fastParse(text);
    localStorage.setItem('kmart_cache_v1', JSON.stringify(PRODUCTS));
    localStorage.setItem('kmart_cache_time', String(Date.now()));
    setStatus(`${PRODUCTS.length} items loaded • Ready`, 'bg-emerald-500');
  }catch(e){
    console.error(e);
    if(!PRODUCTS.length) setStatus('Connection Error - Sheet Share nokku', 'bg-red-500');
  }
}

function hideAll(){
  ['result-container','list-container','no-result'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.add('hidden');
  });
}

function showSingle(p){
  hideAll();
  const c=document.getElementById('result-container');
  if(!c) return;
  c.classList.remove('hidden');
  document.getElementById('result-title').textContent = p.name;
  document.getElementById('result-subtitle').textContent = `${p.group} • Barcode: ${p.barcode}`;
  document.getElementById('result-details').innerHTML = `
    <div class="flex justify-between py-3"><span class="text-slate-500 text-sm">MRP</span><b>AED ${p.mrp.toFixed(2)}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-500 text-sm">Cost Price</span><b>AED ${p.cost.toFixed(2)}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-500 text-sm">Live Stock</span><b>${p.stock}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-500 text-sm">CF</span><b>${p.cf || '-'}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-500 text-sm">Barcode</span><b class="font-mono">${p.barcode}</b></div>
    <button onclick="addToList('${p.barcode}')" class="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold mt-4">➕ Add to List - ${p.name}</button>
  `;
  const btn=document.getElementById('open-group-popup-btn');
  if(btn){ btn.onclick = ()=> openGroupPopup(p); btn.classList.remove('hidden'); }
}

function showList(items){
  hideAll();
  const c=document.getElementById('list-container');
  const list=document.getElementById('match-list');
  if(!c||!list) return;
  c.classList.remove('hidden');
  list.innerHTML = items.slice(0,50).map(p=>`
    <div onclick="showSingleByBarcode('${p.barcode}')" class="p-4 flex justify-between items-center cursor-pointer active:bg-slate-50 bg-white">
      <div><div class="font-bold text-slate-900">${p.name}</div><div class="text-xs text-slate-400">${p.barcode} • ${p.group} • Stock: ${p.stock}</div></div>
      <div class="text-right"><div class="font-black text-slate-900">AED ${p.mrp.toFixed(2)}</div><div class="text-[10px] text-slate-400">TAP TO VIEW</div></div>
    </div>`).join('');
}

function showNoResult(){
  hideAll();
  const el=document.getElementById('no-result');
  if(el) el.classList.remove('hidden');
}

function handleSearch(){
  const inp=document.getElementById('unified-search-input');
  if(!inp) return;
  const q=inp.value.trim().toLowerCase();
  if(q.length<2){ hideAll(); return; }
  if(!PRODUCTS.length) return;
  const exact = PRODUCTS.find(p=>p.barcode===q);
  if(exact){ showSingle(exact); return; }
  const filtered = PRODUCTS.filter(p=> p.name.toLowerCase().includes(q) || p.barcode.includes(q));
  if(filtered.length===1) showSingle(filtered[0]);
  else if(filtered.length>1) showList(filtered);
  else showNoResult();
}

function showSingleByBarcode(barcode){
  const p=PRODUCTS.find(x=>x.barcode===barcode);
  if(p) showSingle(p);
}

function openGroupPopup(p){
  const modal=document.getElementById('item-modal');
  if(!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('popup-title').textContent = p.name;
  document.getElementById('popup-subtitle').textContent = p.group;
  document.getElementById('popup-summary').innerHTML = `
    <div class="bg-slate-50 p-2 rounded-xl text-center"><div class="text-slate-400">MRP</div><b>AED ${p.mrp.toFixed(2)}</b></div>
    <div class="bg-slate-50 p-2 rounded-xl text-center"><div class="text-slate-400">Cost</div><b>AED ${p.cost.toFixed(2)}</b></div>
    <div class="bg-slate-50 p-2 rounded-xl text-center"><div class="text-slate-400">Stock</div><b>${p.stock}</b></div>`;
  document.getElementById('popup-rows').innerHTML = `
    <tr><td class="px-3 py-2">${p.cf||'-'}</td><td class="px-3 py-2 font-mono">${p.barcode}</td><td class="px-3 py-2 text-right">${p.cost.toFixed(2)}</td><td class="px-3 py-2 text-right">${p.mrp.toFixed(2)}</td><td class="px-3 py-2 text-right">${p.stock}</td></tr>`;
  const share=document.getElementById('share-btn');
  if(share){
    share.onclick = ()=>{
      const txt = `${p.name}\nBarcode: ${p.barcode}\nMRP: AED ${p.mrp.toFixed(2)}\nStock: ${p.stock}`;
      if(navigator.share) navigator.share({text:txt});
      else { navigator.clipboard.writeText(txt); alert('Copied!'); }
    };
  }
}

function closeItemModal(){
  const m=document.getElementById('item-modal');
  if(m) m.classList.add('hidden');
}

async function toggleCamera(){
  const cont=document.getElementById('reader-container');
  if(cameraOn){ stopCamera(); return; }
  cont.classList.remove('hidden');
  cameraOn=true;
  html5QrCode = new Html5Qrcode("reader");
  try{
    await html5QrCode.start({facingMode:"environment"}, {fps:10, qrbox:{width:250,height:150}},
      (decoded)=>{
        const inp=document.getElementById('unified-search-input');
        if(inp) inp.value=decoded;
        handleSearch();
        stopCamera();
      }, ()=>{});
  }catch(e){ console.error(e); stopCamera(); }
}

async function stopCamera(){
  if(html5QrCode){
    try{ await html5QrCode.stop(); await html5QrCode.clear(); }catch(e){}
    html5QrCode=null;
  }
  cameraOn=false;
  const cont=document.getElementById('reader-container');
  if(cont) cont.classList.add('hidden');
}

// --- LIST / EXCEL ---
function addToList(barcode){
  const p = PRODUCTS.find(x=>x.barcode===barcode);
  if(!p) return;
  const ex = LIST.find(x=>x.barcode===barcode);
  if(ex) ex.qty += 1;
  else LIST.push({barcode:p.barcode, name:p.name, mrp:p.mrp, cost:p.cost, qty:1});
  localStorage.setItem('kmart_list', JSON.stringify(LIST));
  renderList();
  alert('Added: '+p.name);
}

function changeQty(barcode, delta){
  const it = LIST.find(x=>x.barcode===barcode);
  if(!it) return;
  it.qty += delta;
  if(it.qty<=0) LIST = LIST.filter(x=>x.barcode!==barcode);
  localStorage.setItem('kmart_list', JSON.stringify(LIST));
  renderList();
}

function removeItem(barcode){
  LIST = LIST.filter(x=>x.barcode!==barcode);
  localStorage.setItem('kmart_list', JSON.stringify(LIST));
  renderList();
}

function clearList(){
  LIST = []; localStorage.setItem('kmart_list', '[]'); renderList();
}

function renderList(){
  const listDiv = document.getElementById('listItems');
  const listCount = document.getElementById('listCount');
  const totalEl = document.getElementById('totalAmount');
  if(!listDiv) return;
  let total = 0;
  listDiv.innerHTML = LIST.map(it=>{
    const amt = it.mrp*it.qty; total+=amt;
    return `<div class="flex justify-between items-center py-3">
      <div><b class="text-slate-900">${it.name}</b><br><small class="text-slate-500">AED ${it.mrp.toFixed(2)} x ${it.qty} = AED ${amt.toFixed(2)}</small></div>
      <div class="flex gap-1 items-center">
        <button onclick="changeQty('${it.barcode}',-1)" class="w-8 h-8 bg-slate-100 rounded-lg font-bold">-</button>
        <b class="w-6 text-center">${it.qty}</b>
        <button onclick="changeQty('${it.barcode}',1)" class="w-8 h-8 bg-slate-100 rounded-lg font-bold">+</button>
        <button onclick="removeItem('${it.barcode}')" class="w-8 h-8 text-red-500 font-bold">✕</button>
      </div></div>`;
  }).join('') || '<p class="text-center py-4 text-slate-400 text-sm">List empty aanu - Barcode scan cheythu Add cheyyu</p>';
  if(listCount) listCount.textContent = LIST.length + ' items';
  if(totalEl) totalEl.textContent = 'Total: AED ' + total.toFixed(2);
}

function exportExcel(){
  if(!LIST.length){ alert('List empty aanu'); return; }
  let csv = 'Barcode,Item Name,MRP,Qty,Amount\n';
  LIST.forEach(it=>{ csv += `"${it.barcode}","${it.name}",${it.mrp},${it.qty},${(it.mrp*it.qty).toFixed(2)}\n`; });
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kmart-list-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

const voiceBtn=document.getElementById('voice-btn');
if(voiceBtn){
  voiceBtn.addEventListener('click', ()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ alert('Voice not supported'); return; }
    const rec=new SR(); rec.lang='en-US';
    rec.onresult=(e)=>{
      const inp=document.getElementById('unified-search-input');
      if(inp) inp.value=e.results[0][0].transcript;
      handleSearch();
    };
    rec.start();
  });
}

window.handleSearch=handleSearch;
window.toggleCamera=toggleCamera;
window.stopCamera=stopCamera;
window.closeItemModal=closeItemModal;
window.showSingleByBarcode=showSingleByBarcode;
window.openGroupPopup=openGroupPopup;
window.addToList=addToList;
window.changeQty=changeQty;
window.removeItem=removeItem;
window.clearList=clearList;
window.exportExcel=exportExcel;

loadProducts();