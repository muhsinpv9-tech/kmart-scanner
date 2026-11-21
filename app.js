// WELLMART - Item Master | Cursor Focus + Enter Flow + Letter Only Red
const SHEET_ID = "1ZavPmJyh07AYmTfFzi5JwfUzCsBnKAGjVOEhPMF8oxY";
const GID = "0";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

let PRODUCTS = [];
let LIST = JSON.parse(localStorage.getItem('kmart_list') || '[]');
let MANUAL_ITEMS = JSON.parse(localStorage.getItem('kmart_manual') || '[]');
let html5QrCode = null;
let cameraOn = false;

function focusSearch(){
  setTimeout(()=>{
    const inp = document.getElementById('unified-search-input');
    if(inp){ inp.focus(); inp.select(); }
  }, 80);
}

function setStatus(text, color){
  const t = document.getElementById('status-text');
  const d = document.getElementById('status-dot');
  if(t) t.textContent = text;
  if(d) d.className = `w-2.5 h-2.5 rounded-full animate-pulse ${color || 'bg-emerald-500'}`;
  const lu = document.getElementById('last-update-container');
  const lut = document.getElementById('last-update-time');
  if(lu){ lu.classList.remove('hidden'); lu.classList.add('flex'); }
  if(lut) lut.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function parseCSVLine(line){
  const out=[]; let cur='', inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){ if(inQ && line[i+1]==='"'){ cur+='"'; i++; } else inQ=!inQ; }
    else if(c===',' && !inQ){ out.push(cur); cur=''; }
    else cur+=c;
  }
  out.push(cur); return out;
}

function fastParse(text){
  const lines = text.split('\n');
  const header = parseCSVLine(lines[0]).map(h=>h.trim().toLowerCase().replace(/"/g,''));
  const idx = (n)=> header.findIndex(h=>h.includes(n));
  const iBarcode = idx('barcode'), iName = idx('itemname'), iMRP = idx('mrp'),
        iCost = idx('costprice'), iGroup = idx('groupname'), iStock = idx('livestock'),
        iCF = idx('cf'), iNo = idx('itemno');
  const out = [];
  for(let i=1; i<lines.length; i++){
    const line = lines[i];
    if(!line.trim()) continue;
    const r = parseCSVLine(line);
    const name = (r[iName]||'').replace(/"/g,'').trim();
    if(!name) continue;
    out.push({
      barcode: (r[iBarcode]||'').replace(/"/g,'').trim(),
      name: name, mrp: parseFloat(r[iMRP])||0, cost: parseFloat(r[iCost])||0,
      group: (r[iGroup]||'').replace(/"/g,'').trim(),
      stock: (r[iStock]||'').replace(/"/g,'').trim(),
      cf: (r[iCF]||'').replace(/"/g,'').trim(),
      itemNo: (r[iNo]||'').replace(/"/g,'').trim(),
      isManual: false
    });
  }
  return out;
}

async function loadProducts(){
  setStatus('Loading items...', 'bg-orange-500');
  renderList();
  const cached = localStorage.getItem('kmart_cache_v2');
  const cachedTime = localStorage.getItem('kmart_cache_time');
  const isFresh = cached && cachedTime && (Date.now() - Number(cachedTime) < 1000*60*60*6);
  if(isFresh){
    try{
      PRODUCTS = JSON.parse(cached);
      MANUAL_ITEMS.forEach(m=>{ if(!PRODUCTS.find(p=>p.barcode===m.barcode)) PRODUCTS.push(m); });
      setStatus(`${PRODUCTS.length} items loaded • Ready (Cached)`, 'bg-emerald-500');
      fetchFreshInBackground();
      return;
    }catch(e){}
  }
  await fetchFreshInBackground();
}

async function fetchFreshInBackground(){
  try{
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    PRODUCTS = fastParse(text);
    MANUAL_ITEMS.forEach(m=>{ if(!PRODUCTS.find(p=>p.barcode===m.barcode)) PRODUCTS.push(m); });
    try{
      const onlySheet = PRODUCTS.filter(p=>!p.isManual);
      localStorage.setItem('kmart_cache_v2', JSON.stringify(onlySheet));
      localStorage.setItem('kmart_cache_time', String(Date.now()));
    }catch(e){}
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
    <div class="flex justify-between py-3"><span class="text-slate-400 text-sm">MRP</span><b>AED ${p.mrp.toFixed(2)}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-400 text-sm">Cost Price</span><b>AED ${p.cost.toFixed(2)}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-400 text-sm">Live Stock</span><b>${p.stock}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-400 text-sm">CF</span><b>${p.cf || '-'}</b></div>
    <div class="flex justify-between py-3"><span class="text-slate-400 text-sm">Barcode</span><b class="font-mono">${p.barcode}</b></div>
    <button onclick="addToListFromSearch('${p.barcode}')" class="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold mt-4">➕ Add to List</button>`;
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
    <div onclick="addToListFromSearch('${p.barcode}')" class="p-4 flex justify-between items-center cursor-pointer active:bg-emerald-900/30 bg-slate-800">
      <div><div class="font-bold text-white">${p.name} ${p.isManual?'<span class="text-[10px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-full ml-1">ADDED</span>':''}</div><div class="text-xs text-slate-400">${p.barcode} • ${p.group} • Stock: ${p.stock}</div></div>
      <div class="text-right shrink-0 ml-2"><div class="font-black text-white">AED ${p.mrp.toFixed(2)}</div><div class="text-[10px] text-emerald-400 font-bold">+ ADD →</div></div>
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
  if(q.length<3){ hideAll(); return; }
  if(!PRODUCTS.length) return;
  const isBarcode = /^\d+$/.test(q);
  const exact = PRODUCTS.find(p=>p.barcode===q);
  if(exact && (isBarcode || q.length>=10)){ addToListFromSearch(exact.barcode); return; }
  const norm = (s)=> (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
  const words = norm(q).split(' ').filter(w=>w.length>0);
  let filtered = PRODUCTS.filter(p=>{
    const hayWords = norm(p.name + ' ' + p.group).split(' ');
    return words.every(w => hayWords.some(hw => hw.startsWith(w) || hw.includes(w)));
  });
  if(filtered.length===0){
    filtered = PRODUCTS.filter(p=>{
      const hayWords = norm(p.name + ' ' + p.group).split(' ');
      return words.some(w => hayWords.some(hw => hw.startsWith(w)));
    });
  }
  if(filtered.length>=1) showList(filtered);
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
    <div class="bg-slate-700 p-2 rounded-xl text-center"><div class="text-slate-400 text-xs">MRP</div><b>AED ${p.mrp.toFixed(2)}</b></div>
    <div class="bg-slate-700 p-2 rounded-xl text-center"><div class="text-slate-400 text-xs">Cost</div><b>AED ${p.cost.toFixed(2)}</b></div>
    <div class="bg-slate-700 p-2 rounded-xl text-center"><div class="text-slate-400 text-xs">Stock</div><b>${p.stock}</b></div>`;
  document.getElementById('popup-rows').innerHTML = `
    <tr><td class="px-3 py-2">${p.cf||'-'}</td><td class="px-3 py-2 font-mono">${p.barcode}</td><td class="px-3 py-2 text-right">${p.cost.toFixed(2)}</td><td class="px-3 py-2 text-right">${p.mrp.toFixed(2)}</td><td class="px-3 py-2 text-right">${p.stock}</td></tr>`;
  const share=document.getElementById('share-btn');
  if(share){
    share.onclick = ()=>{
      const txt = `${p.name}\nBarcode: ${p.barcode}\nMRP: AED ${p.mrp.toFixed(2)}\nCost: AED ${p.cost.toFixed(2)}\nStock: ${p.stock}\nCF: ${p.cf}`;
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

// --- MANUAL: Enter Flow + Number Only ---
function manualEnter(e, nextId){
  if(e.key !== 'Enter') return;
  e.preventDefault();
  if(nextId === 'ADD'){ addManualItem(); return; }
  const el = document.getElementById(nextId);
  if(el) el.focus();
}

function onlyNumber(el, allowDecimal, allowMinus){
  let v = el.value;
  if(allowDecimal){
    v = v.replace(/[^0-9.]/g,'');
    const parts = v.split('.');
    if(parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  } else if(allowMinus){
    // Stock: - um number um mathram, Letter pokilla
    const isNeg = v.startsWith('-');
    v = v.replace(/[^0-9]/g,'');
    if(isNeg) v = '-' + v;
  } else {
    v = v.replace(/[^0-9]/g,'');
  }
  el.value = v;
}

function openManualPopup(){
  const m=document.getElementById('manual-modal');
  if(m) m.classList.remove('hidden');
  const searchVal = document.getElementById('unified-search-input')?.value?.trim() || '';
  if(searchVal){
    if(/^\d+$/.test(searchVal)) document.getElementById('m-barcode').value = searchVal;
    else document.getElementById('m-name').value = searchVal;
  }
  setTimeout(()=> document.getElementById('m-barcode')?.focus(), 100);
}

function closeManualPopup(){
  const m=document.getElementById('manual-modal');
  if(m) m.classList.add('hidden');
  const err=document.getElementById('m-error');
  if(err) err.classList.add('hidden');
  focusSearch();
}

function addManualItem(){
  const barcode = document.getElementById('m-barcode').value.trim();
  const name = document.getElementById('m-name').value.trim();
  const mrp = parseFloat(document.getElementById('m-mrp').value) || 0;
  const cost = parseFloat(document.getElementById('m-cost').value) || 0;
  const cf = document.getElementById('m-cf').value.trim();
  const stock = document.getElementById('m-stock').value.trim();
  const err = document.getElementById('m-error');
  if(barcode.length < 3){
    err.textContent = 'Barcode minimum 3 number venam';
    err.classList.remove('hidden');
    document.getElementById('m-barcode').focus(); return;
  }
  if(name.length < 3){
    err.textContent = 'Name minimum 3 letter venam';
    err.classList.remove('hidden');
    document.getElementById('m-name').focus(); return;
  }
  err.classList.add('hidden');
  const manual = { barcode, name, mrp, cost, group:'MANUAL ADDED', stock: stock || '', cf: cf || '', itemNo:'', isManual:true };
  if(!PRODUCTS.find(p=>p.barcode===barcode)) PRODUCTS.push(manual);
  else { const idx = PRODUCTS.findIndex(p=>p.barcode===barcode); PRODUCTS[idx]=manual; }
  if(!MANUAL_ITEMS.find(p=>p.barcode===barcode)) MANUAL_ITEMS.push(manual);
  localStorage.setItem('kmart_manual', JSON.stringify(MANUAL_ITEMS));
  const ex = LIST.find(x=>x.barcode===barcode);
  if(ex) ex.qty += 1;
  else LIST.push({ barcode, name, mrp, cost, stock: stock||'', cf: cf||'', qty:1, isManual:true });
  localStorage.setItem('kmart_list', JSON.stringify(LIST));
  renderList();
  ['m-barcode','m-name','m-mrp','m-cost','m-cf','m-stock'].forEach(id=>{ document.getElementById(id).value=''; });
  closeManualPopup();
  const inp = document.getElementById('unified-search-input');
  if(inp) inp.value='';
  hideAll();
  showToast('Added: ' + name + ' (Manual)');
  focusSearch();
}

function addToList(barcode){
  const p = PRODUCTS.find(x=>x.barcode===barcode);
  if(!p) return;
  const ex = LIST.find(x=>x.barcode===barcode);
  if(ex) ex.qty += 1;
  else LIST.push({ barcode: p.barcode, name: p.name, mrp: p.mrp, cost: p.cost, stock: p.stock, cf: p.cf, qty: 1, isManual: !!p.isManual });
  localStorage.setItem('kmart_list', JSON.stringify(LIST));
  renderList();
  showToast('Added: ' + p.name);
}

function addToListFromSearch(barcode){
  addToList(barcode);
  const inp = document.getElementById('unified-search-input');
  if(inp) inp.value = '';
  hideAll();
  focusSearch();
}

function showToast(msg){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl z-[100] font-bold text-sm max-w-[90%] text-center';
    document.body.appendChild(t);
  }
  t.textContent = '✓ ' + msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.display='none'; }, 1500);
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
    const costNum = Number(it.cost||0);
    const stockNum = parseFloat(it.stock);
    const isCostHigh = costNum > 0 && it.mrp > 0 && costNum > it.mrp;
    const isStockNeg = !isNaN(stockNum) && stockNum < 0;
    const nameCls = it.isManual ? 'text-red-400 font-black' : 'text-white';
    const mrpCls = isCostHigh ? 'text-red-400 font-black' : 'text-white';
    const costCls = isCostHigh ? 'text-red-400 font-black' : 'text-slate-400';
    const stockCls = isStockNeg ? 'text-red-400 font-black' : 'text-slate-400';
    return `<div class="flex justify-between items-center py-3">
      <div class="pr-2"><b class="${nameCls}">${it.name}</b> ${it.isManual?'<span class="text-[10px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded-full font-black">ADDED</span>':''}<br>
      <small class="${mrpCls}">MRP ${it.mrp.toFixed(2)}</small> <small class="${costCls}">| Cost ${costNum.toFixed(2)} ${isCostHigh?'⚠':''}</small> <small class="${stockCls}">| Stock ${it.stock||'-'} ${isStockNeg?'⚠':''}</small> <small class="text-slate-400">| CF ${it.cf||'-'}</small></div>
      <div class="flex gap-1 items-center shrink-0">
        <button onclick="changeQty('${it.barcode}',-1)" class="w-8 h-8 bg-slate-700 rounded-lg font-bold">-</button>
        <b class="w-6 text-center">${it.qty}</b>
        <button onclick="changeQty('${it.barcode}',1)" class="w-8 h-8 bg-slate-700 rounded-lg font-bold">+</button>
        <button onclick="removeItem('${it.barcode}')" class="w-8 h-8 text-red-500 font-bold">✕</button>
      </div></div>`;
  }).join('') || '<p class="text-center py-4 text-slate-400 text-sm">List empty aanu - Search / Scan / + cheythu Add cheyyu</p>';
  if(listCount) listCount.textContent = LIST.length + ' items';
  if(totalEl) totalEl.textContent = 'Total: AED ' + total.toFixed(2);
}

function exportExcel(){
  if(!LIST.length){ alert('List empty aanu'); return; }
  const data = [['Barcode','Item Name','Qty','MRP','Cost Price','Stock','CF','Type']];
  LIST.forEach(it=>{
    const p = PRODUCTS.find(x=>x.barcode===it.barcode);
    const stock = it.stock || (p ? p.stock : '');
    const cf = it.cf || (p ? p.cf : '');
    const cost = it.cost || (p ? p.cost : 0);
    const type = it.isManual ? 'ADDED - NOT IN DATABASE' : '';
    data.push([String(it.barcode), it.name, it.qty, it.mrp, cost, stock, cf, type]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  const range = XLSX.utils.decode_range(ws['!ref']);
  for(let r=1; r<=range.e.r; r++){
    const cellRef = XLSX.utils.encode_cell({r:r, c:0});
    if(ws[cellRef]){ ws[cellRef].t = 's'; ws[cellRef].z = '@'; }
    const it = LIST[r-1];
    if(it && it.isManual){
      for(let c=0; c<=7; c++){
        const ref = XLSX.utils.encode_cell({r:r, c:c});
        if(!ws[ref]) continue;
        ws[ref].s = { font:{ color:{ rgb:"FFDC2626" }, bold:true } };
      }
    }
    if(it && Number(it.cost||0) > 0 && Number(it.mrp||0) > 0 && Number(it.cost) > Number(it.mrp)){
      [3,4].forEach(c=>{
        const ref = XLSX.utils.encode_cell({r:r, c:c});
        if(ws[ref]) ws[ref].s = { font:{ color:{ rgb:"FFDC2626" }, bold:true } };
      });
    }
    const stockNum = parseFloat(it?.stock);
    if(!isNaN(stockNum) && stockNum < 0){
      const ref = XLSX.utils.encode_cell({r:r, c:5});
      if(ws[ref]) ws[ref].s = { font:{ color:{ rgb:"FFDC2626" }, bold:true } };
    }
  }
  ws['!cols'] = [{wch:18},{wch:35},{wch:8},{wch:12},{wch:12},{wch:12},{wch:10},{wch:24}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Wellmart List");
  XLSX.writeFile(wb, 'wellmart-list-' + new Date().toISOString().slice(0,10) + '.xlsx');
}

window.handleSearch=handleSearch;
window.toggleCamera=toggleCamera;
window.stopCamera=stopCamera;
window.closeItemModal=closeItemModal;
window.showSingleByBarcode=showSingleByBarcode;
window.openGroupPopup=openGroupPopup;
window.addToList=addToList;
window.addToListFromSearch=addToListFromSearch;
window.changeQty=changeQty;
window.removeItem=removeItem;
window.clearList=clearList;
window.exportExcel=exportExcel;
window.openManualPopup=openManualPopup;
window.closeManualPopup=closeManualPopup;
window.addManualItem=addManualItem;
window.manualEnter=manualEnter;
window.onlyNumber=onlyNumber;
window.focusSearch=focusSearch;

loadProducts();