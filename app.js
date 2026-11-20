let inventory = [];
let headers = [];
let html5QrCode = null;
let currentGroupRows = [];
let collectedList = [];
let currentPicked = null;

window.onload = function () {
  fetchData();
  initCollectedUI();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((err) => console.error("SW registration failed:", err));
  }
  lucide.createIcons();
};

function toggleCamera() {
  const container = document.getElementById("reader-container");
  if (!container.classList.contains("hidden")) stopCamera();
  else startCamera();
}
function startCamera() {
  document.getElementById("reader-container").classList.remove("hidden");
  const btn = document.getElementById("camera-toggle-btn");
  btn.disabled = true; btn.classList.add("opacity-50", "scale-95");
  html5QrCode = new Html5Qrcode("reader");
  const config = { fps: 30, qrbox: { width: 250, height: 120 }, aspectRatio: 1.0, experimentalFeatures: { useBarCodeDetectorIfSupported: true } };
  html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {}).catch(() => stopCamera());
}
function stopCamera() {
  if (html5QrCode) { html5QrCode.stop().then(() => { html5QrCode.clear(); html5QrCode = null; }); }
  document.getElementById("reader-container").classList.add("hidden");
  const btn = document.getElementById("camera-toggle-btn");
  btn.disabled = false; btn.classList.remove("opacity-50", "scale-95");
}
function onScanSuccess(decodedText) {
  const input = document.getElementById("unified-search-input");
  input.value = decodedText; stopCamera(); handleSearch();
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

async function fetchData() {
  const statusText = document.getElementById("status-text");
  const statusDot = document.getElementById("status-dot");
  const statusPill = document.getElementById("status-pill");
  statusText.innerText = "Syncing…";
  statusDot.className = "w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse";
  try {
    const response = await fetch("products.json");
    if (!response.ok) throw new Error("products.json not found");
    const data = await response.json();
    inventory = data;
    headers = Object.keys(data[0] || {});
    statusText.innerText = `Online • ${inventory.length} Items`;
    statusDot.className = "w-2.5 h-2.5 rounded-full bg-green-500";
    statusPill.classList.add("bg-green-50");
    const now = new Date();
    document.getElementById("last-update-time").innerText = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("last-update-container").classList.remove("hidden");
  } catch (err) {
    statusText.innerText = "Connection Error - products.json illa";
    statusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
  }
}

function handleSearch() {
  const term = document.getElementById("unified-search-input").value.trim().toLowerCase();
  const resCon = document.getElementById("result-container");
  const listCon = document.getElementById("list-container");
  const noRes = document.getElementById("no-result");
  resCon.classList.add("hidden"); listCon.classList.add("hidden"); noRes.classList.add("hidden");
  if (!term || inventory.length === 0) return;
  let matchedRows = [];
  if (/^\d+$/.test(term)) {
    matchedRows = inventory.filter((row) => String(row["ItemBarCode"] || "").toLowerCase() === term);
  } else {
    if (term.length < 3) return;
    const tokens = term.split(/\s+/).filter(Boolean);
    matchedRows = inventory.filter((row) => {
      const name = String(row["ItemName"] || "").toLowerCase();
      return tokens.every((t) => name.includes(t));
    });
  }
  if (matchedRows.length === 0) { noRes.classList.remove("hidden"); return; }
  const groups = {};
  matchedRows.forEach((row) => {
    const name = String(row["ItemName"] || "").trim();
    if (!groups[name]) groups[name] = [];
    groups[name].push(row);
  });
  const groupNames = Object.keys(groups);
  if (groupNames.length === 1) {
    const groupRows = completeGroupByName(groupNames[0]);
    currentGroupRows = groupRows;
    renderSingleGroup(groupRows);
    if (/^\d+$/.test(term)) showQtyForCurrent(groupRows);
  } else {
    renderGroupList(groups);
  }
}
function completeGroupByName(itemName) {
  return inventory.filter((row) => String(row["ItemName"] || "").trim() === itemName);
}

function renderSingleGroup(groupRows) {
  const container = document.getElementById("result-container");
  const titleEl = document.getElementById("result-title");
  const subtitleEl = document.getElementById("result-subtitle");
  const detailsEl = document.getElementById("result-details");
  const openPopupBtn = document.getElementById("open-group-popup-btn");
  container.classList.remove("hidden");
  const itemName = groupRows[0]["ItemName"];
  const mainRow = groupRows.find((r) => String(r["CF"]) === "1") || groupRows[0];
  const mainStock = Number(mainRow["LiveStock"] || "0") || 0;
  titleEl.innerText = itemName;
  subtitleEl.innerText = `${groupRows.length} variants • CF-based stock`;
  detailsEl.innerHTML = `
  <div class="py-4 flex justify-between"><span class="text-[10px] font-black text-slate-400 uppercase">Barcode</span><span class="text-xs font-mono text-slate-600">${mainRow["ItemBarCode"]}</span></div>
  <div class="py-4 flex justify-between"><span class="text-[10px] font-black text-slate-400 uppercase">Cost</span><span class="text-xl font-black text-slate-900">${mainRow["CostPrice"]}</span></div>
  <div class="py-4 flex justify-between"><span class="text-[10px] font-black text-slate-400 uppercase">MRP</span><span class="text-xl font-black text-slate-900">${mainRow["MRP"]}</span></div>
  <div class="py-4 flex justify-between"><span class="text-[10px] font-black text-slate-400 uppercase">Main Stock</span><span class="text-base font-bold text-slate-900">${mainStock}</span></div>`;
  openPopupBtn.classList.remove("hidden");
  openPopupBtn.onclick = () => openItemModal(groupRows);
  lucide.createIcons();
}

function renderGroupList(groups) {
  const container = document.getElementById("list-container");
  const listWrap = document.getElementById("match-list");
  container.classList.remove("hidden"); listWrap.innerHTML = "";
  Object.keys(groups).forEach((name) => {
    const rows = completeGroupByName(name);
    const mainRow = rows.find((r) => String(r["CF"]) === "1") || rows[0];
    const div = document.createElement("div");
    div.className = "p-5 flex justify-between items-center hover:bg-slate-50 cursor-pointer";
    div.innerHTML = `<div><p class="font-bold text-slate-900">${name}</p><p class="text-[11px] font-mono text-slate-400">${mainRow["ItemBarCode"]}</p></div><i data-lucide="chevron-right" class="w-5 h-5 text-slate-400"></i>`;
    div.onclick = () => { currentGroupRows = rows; renderSingleGroup(rows); container.classList.add("hidden"); };
    listWrap.appendChild(div);
  });
  lucide.createIcons();
}

function openItemModal(groupRows) {
  const modal = document.getElementById("item-modal");
  const titleEl = document.getElementById("popup-title");
  const subtitleEl = document.getElementById("popup-subtitle");
  const summaryEl = document.getElementById("popup-summary");
  const rowsEl = document.getElementById("popup-rows");
  const itemName = groupRows[0]["ItemName"];
  const mainRow = groupRows.find((r) => String(r["CF"]) === "1") || groupRows[0];
  const mainStock = Number(mainRow["LiveStock"] || "0") || 0;
  titleEl.innerText = itemName;
  subtitleEl.innerText = `${groupRows.length} variants • CF-based stock`;
  summaryEl.innerHTML = `
    <div class="rounded-xl bg-slate-50 px-3 py-2"><div class="text-[10px] uppercase text-slate-400">Main Stock</div><div class="text-sm font-bold">${mainStock}</div></div>
    <div class="rounded-xl bg-slate-50 px-3 py-2"><div class="text-[10px] uppercase text-slate-400">Cost / MRP</div><div class="text-sm font-bold">${mainRow["CostPrice"]} / ${mainRow["MRP"]}</div></div>
    <div class="rounded-xl bg-slate-50 px-3 py-2"><div class="text-[10px] uppercase text-slate-400">Group</div><div class="text-[11px] font-semibold">${mainRow["GroupName"] || "—"}</div></div>`;
  rowsEl.innerHTML = "";
  groupRows.forEach((row) => {
    const cf = Number(row["CF"] || 0); let stock = "-";
    if (cf === 1) stock = mainStock;
    else if (cf > 0) { const d = mainStock / cf; stock = d % 1 === 0 ? d : d.toFixed(2); }
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition whitespace-nowrap";
    tr.innerHTML = `<td class="px-3 py-2">${cf}</td><td class="px-3 py-2 font-mono text-[11px]">${row["ItemBarCode"]}</td><td class="px-3 py-2 text-right">${row["CostPrice"]}</td><td class="px-3 py-2 text-right">${row["MRP"]}</td><td class="px-3 py-2 text-right font-semibold">${stock}</td>`;
    rowsEl.appendChild(tr);
  });
  modal.classList.remove("hidden"); lucide.createIcons();
}
function closeItemModal() { document.getElementById("item-modal").classList.add("hidden"); }

document.getElementById("share-btn").onclick = async () => {
  const card = document.getElementById("popup-card-wrapper");
  if (!card) return;
  try {
    const canvas = await html2canvas(card, { scale: window.devicePixelRatio > 2 ? 1.5 : 2, backgroundColor: null });
    const dataUrl = canvas.toDataURL("image/png");
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "item-details.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: "Item Details", files: [file] }); return; }
      const a = document.createElement("a"); a.href = dataUrl; a.download = "item-details.png"; a.click();
    });
  } catch (err) { alert("Sharing failed."); }
};

function parseCSV(text) {
  const lines = text.split(/\r?\n/); const head = splitCSVLine(lines[0]); const data = [];
  for (let i = 1; i < lines.length; i++) { const line = lines[i].trim(); if (!line) continue; const values = splitCSVLine(line); const obj = {}; head.forEach((h, idx) => { obj[h.trim()] = values[idx] ? values[idx].trim() : ""; }); data.push(obj); }
  return data;
}
function splitCSVLine(line) {
  const parts = []; let current = ""; let insideQuotes = false;
  for (let char of line) { if (char === '"') insideQuotes = !insideQuotes; else if (char === "," && !insideQuotes) { parts.push(current); current = ""; } else current += char; }
  parts.push(current); return parts;
}

let recognition = null;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition(); recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = (event) => { const text = event.results[0][0].transcript; document.getElementById("unified-search-input").value = text; handleSearch(); };
}
document.getElementById("voice-btn").onclick = () => { if (!recognition) { alert("Voice search not supported."); return; } recognition.start(); };

const logoImg = document.getElementById("app-logo");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
function setLogo(isDark) { logoImg.src = isDark ? "icon-512.png" : "icon-192.jpeg"; }
setLogo(darkQuery.matches); darkQuery.addEventListener("change", (e) => setLogo(e.matches));

function initCollectedUI() {
  const input = document.getElementById("unified-search-input");
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } });
  const anchor = document.getElementById("result-container");
  if (!anchor) return;
  const wrap = document.createElement("div");
  wrap.id = "collected-wrap"; wrap.className = "mt-4";
  wrap.innerHTML = `
    <div id="qty-box" class="hidden bg-white rounded-3xl p-4 shadow-sm mb-4">
      <div class="text-xs font-black tracking-widest text-slate-400">QTY - ENTER CHEYYU</div>
      <div id="qty-item-name" class="font-bold mt-1 text-sm"></div>
      <input id="qty-input" type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" placeholder="1" class="w-full mt-2 p-4 text-center text-2xl font-black border-2 border-slate-900 rounded-xl outline-none" />
      <p class="text-[11px] text-slate-400 text-center mt-2">Qty adichu Enter adichal list-il pokum</p>
    </div>
    <div class="bg-white rounded-3xl p-4 shadow-sm">
      <div class="flex justify-between items-center"><h3 class="font-black">Collected List</h3><span id="collected-count" class="bg-slate-900 text-white text-xs px-3 py-1 rounded-full">0 items</span></div>
      <div id="collected-list" class="mt-2"></div>
      <div id="collected-empty" class="text-center text-slate-400 text-sm py-4">Innum item illa. Barcode adichu thudangoo.</div>
      <div id="collected-total" class="text-right font-black mt-2"></div>
      <div class="flex gap-2 mt-3">
        <button id="clear-collected" class="flex-1 py-3 rounded-2xl bg-slate-100 font-bold">Clear</button>
        <button id="finish-download" class="flex-[2] py-3 rounded-2xl bg-green-500 text-white font-black">✅ Finish • Download Excel</button>
      </div>
    </div>`;
  anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
  document.getElementById("qty-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addToCollected(); } });
  document.getElementById("clear-collected").onclick = () => { if (confirm("List clear cheyyano?")) { collectedList = []; renderCollected(); } };
  document.getElementById("finish-download").onclick = downloadCollectedExcel;
}
function showQtyForCurrent(groupRows) {
  const mainRow = groupRows.find((r) => String(r["CF"]) === "1") || groupRows[0];
  currentPicked = mainRow;
  const box = document.getElementById("qty-box");
  if (!box) return;
  document.getElementById("qty-item-name").innerText = mainRow["ItemName"] + " • " + mainRow["ItemBarCode"];
  box.classList.remove("hidden");
  const qi = document.getElementById("qty-input");
  qi.value = ""; qi.focus();
}
function addToCollected() {
  if (!currentPicked) return;
  const qty = parseFloat(document.getElementById("qty-input").value) || 1;
  const ex = collectedList.find((x) => String(x.ItemBarCode) === String(currentPicked.ItemBarCode));
  if (ex) ex.Qty += qty;
  else collectedList.push({ ItemBarCode: currentPicked.ItemBarCode, ItemName: currentPicked.ItemName, CostPrice: currentPicked.CostPrice, MRP: currentPicked.MRP, Qty: qty });
  renderCollected();
  document.getElementById("qty-box").classList.add("hidden");
  document.getElementById("result-container").classList.add("hidden");
  const inp = document.getElementById("unified-search-input");
  inp.value = ""; inp.focus();
  currentPicked = null;
}
function renderCollected() {
  const box = document.getElementById("collected-list");
  const empty = document.getElementById("collected-empty");
  document.getElementById("collected-count").innerText = collectedList.length + " items";
  empty.style.display = collectedList.length ? "none" : "block";
  box.innerHTML = collectedList.map((it, i) => `
    <div class="flex justify-between items-center py-3 border-b border-slate-100">
      <div class="flex-1"><div class="font-bold text-sm">${it.ItemName}</div><div class="text-[11px] text-slate-400">${it.ItemBarCode} • MRP ${it.MRP}</div></div>
      <div class="font-black text-lg px-2">x ${it.Qty}</div>
      <button onclick="removeCollected(${i})" class="w-8 h-8 rounded-full bg-red-100">✕</button>
    </div>`).join("");
  const tot = collectedList.reduce((s, x) => s + x.Qty, 0);
  document.getElementById("collected-total").innerText = collectedList.length ? `Total Qty: ${tot}` : "";
}
function removeCollected(i) { collectedList.splice(i, 1); renderCollected(); }
function downloadCollectedExcel() {
  if (!collectedList.length) { alert("List empty aanu!"); return; }
  const loadXlsx = () => new Promise((res) => {
    if (window.XLSX) return res();
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
    s.onload = res; document.head.appendChild(s);
  });
  loadXlsx().then(() => {
    const data = collectedList.map((it) => ({ Barcode: it.ItemBarCode, ItemName: it.ItemName, Qty: it.Qty, Cost: it.CostPrice, MRP: it.MRP, TotalMRP: (it.Qty * parseFloat(it.MRP || 0)).toFixed(2) }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 45 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock List");
    const d = new Date();
    XLSX.writeFile(wb, `KMART-STOCK-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}_${d.getHours()}${d.getMinutes()}.xlsx`);
  });
}