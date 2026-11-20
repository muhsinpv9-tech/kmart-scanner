// KMART - Barcode -> Qty -> List -> Excel
// New Sheet: item master

const SHEET_ID = "1ZavPmJyh07AYmTfFzi5JwfUzCsBnKAGjVOEhPMF8oxY";
const GID = "0";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;

let PRODUCTS = [];
let LIST = JSON.parse(localStorage.getItem('kmart_list') || '[]');

const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const listDiv = document.getElementById('listItems');
const listCount = document.getElementById('listCount');
const totalEl = document.getElementById('totalAmount');

function parseCSV(text){
  const rows=[]; let row=[], cur='', inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c=='"' && inQ && n=='"'){cur+='"'; i++; continue;}
    if(c=='"'){inQ=!inQ; continue;}
    if(c==',' && !inQ){row.push(cur); cur=''; continue;}
    if((c=='\n'||c=='\r') && !inQ){
      if(c=='\r' && n=='\n') i++;
      row.push(cur); rows.push(row); row=[]; cur=''; continue;
    }
    cur+=c;
  }
  if(cur!==''||row.length) {row.push(cur); rows.push(row);}
  return rows;
}

async function loadProducts(){
  if(resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;">Loading items...</p>';
  try{
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const rows = parseCSV(text);
    const header = rows[0].map(h=>h.trim().toLowerCase());
    const idx = (name)=> header.findIndex(h=>h.includes(name));
    const iBarcode = idx('barcode');
    const iName = idx('itemname');
    const iMRP = idx('mrp');
    const iCost = idx('costprice');
    const iGroup = idx('groupname');
    const iStock = idx('livestock');

    PRODUCTS = rows.slice(1).filter(r=>r[iName]).map(r=>({
      barcode: (r[iBarcode]||'').trim(),
      name: (r[iName]||'').trim(),
      mrp: parseFloat(r[iMRP])||0,
      cost: parseFloat(r[iCost])||0,
      group: (r[iGroup]||'').trim(),
      stock: (r[iStock]||'').trim()
    }));
    console.log('Loaded', PRODUCTS.length);
    renderList();
    if(resultsDiv) resultsDiv.innerHTML = `<p style="text-align:center;padding:20px;color:#666;">${PRODUCTS.length} items loaded. Barcode scan cheyyu / Search cheyyu.</p>`;
  }catch(e){
    console.error(e);
    if(resultsDiv) resultsDiv.innerHTML = '<p style="text-align:center;padding:20px;color:red;">Connection Error - Sheet Share "Anyone with link" aakkiyittundo ennu nokku.</p>';
  }
}

function renderResults(items){
  if(!resultsDiv) return;
  if(!items.length){ resultsDiv.innerHTML='<p style="text-align:center;padding:20px;">Item kittiyilla</p>'; return; }
  resultsDiv.innerHTML = items.slice(0,50).map((p,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #eee;">
      <div><b>${p.name}</b><br><small>${p.barcode} • ${p.group} • Stock: ${p.stock} • ₹${p.mrp}</small></div>
      <button onclick="addToList('${p.barcode}')" style="background:#1a7a1a;color:#fff;border:none;padding:8px 14px;border-radius:8px;">+ Add</button>
    </div>`).join('');
}

function addToList(barcode){
  const p = PRODUCTS.find(x=>x.barcode===barcode);
  if(!p) return;
  const ex = LIST.find(x=>x.barcode===barcode);
  if(ex) ex.qty += 1;
  else LIST.push({barcode:p.barcode, name:p.name, mrp:p.mrp, cost:p.cost, qty:1});
  saveList(); renderList();
  if(searchInput) searchInput.value='';
  if(resultsDiv) resultsDiv.innerHTML='<p style="text-align:center;padding:10px;color:green;">Added: '+p.name+'</p>';
}

function changeQty(barcode, delta){
  const it = LIST.find(x=>x.barcode===barcode);
  if(!it) return;
  it.qty += delta;
  if(it.qty<=0) LIST = LIST.filter(x=>x.barcode!==barcode);
  saveList(); renderList();
}

function removeItem(barcode){
  LIST = LIST.filter(x=>x.barcode!==barcode);
  saveList(); renderList();
}

function saveList(){ localStorage.setItem('kmart_list', JSON.stringify(LIST)); }

function renderList(){
  if(!listDiv) return;
  let total=0;
  listDiv.innerHTML = LIST.map(it=>{
    const amt = it.mrp*it.qty; total+=amt;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;">
      <div><b>${it.name}</b><br><small>₹${it.mrp} x ${it.qty} = ₹${amt.toFixed(2)}</small></div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button onclick="changeQty('${it.barcode}',-1)" style="padding:6px 10px;">-</button>
        <b>${it.qty}</b>
        <button onclick="changeQty('${it.barcode}',1)" style="padding:6px 10px;">+</button>
        <button onclick="removeItem('${it.barcode}')" style="padding:6px 10px;color:red;">✕</button>
      </div></div>`;
  }).join('') || '<p style="text-align:center;padding:20px;">List empty aanu</p>';
  if(listCount) listCount.textContent = LIST.length + ' items';
  if(totalEl) totalEl.textContent = 'Total: ₹' + total.toFixed(2);
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

if(searchInput){
  searchInput.addEventListener('input', e=>{
    const q = e.target.value.trim().toLowerCase();
    if(q.length<2){ return; }
    // Barcode aanel exact match
    const exact = PRODUCTS.find(p=>p.barcode===q);
    if(exact){ addToList(exact.barcode); return; }
    const filtered = PRODUCTS.filter(p=> p.name.toLowerCase().includes(q) || p.barcode.includes(q));
    renderResults(filtered);
  });
  searchInput.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      const q = e.target.value.trim();
      const exact = PRODUCTS.find(p=>p.barcode===q);
      if(exact) addToList(exact.barcode);
    }
  });
}

const exportBtn = document.getElementById('exportBtn');
if(exportBtn) exportBtn.addEventListener('click', exportExcel);

window.addToList = addToList;
window.changeQty = changeQty;
window.removeItem = removeItem;
window.exportExcel = exportExcel;

loadProducts();