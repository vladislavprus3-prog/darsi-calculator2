/* DARSI Online Calculator — static, no backend */

const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? "—" : `$${Math.round(n)}`;
/* ---------- Copart auction fee ---------- */
const COPART_BASE_TIERS = [
  [0, 49.99, 25.00],
  [50.00, 99.99, 45.00],
  [100.00, 199.99, 80.00],
  [200.00, 299.99, 130.00],
  [300.00, 349.99, 137.50],
  [350.00, 399.99, 145.00],
  [400.00, 449.99, 175.00],
  [450.00, 499.99, 185.00],
  [500.00, 549.99, 205.00],
  [550.00, 599.99, 210.00],
  [600.00, 699.99, 240.00],
  [700.00, 799.99, 270.00],
  [800.00, 899.99, 295.00],
  [900.00, 999.99, 320.00],
  [1000.00, 1199.99, 375.00],
  [1200.00, 1299.99, 395.00],
  [1300.00, 1399.99, 410.00],
  [1400.00, 1499.99, 430.00],
  [1500.00, 1599.99, 445.00],
  [1600.00, 1699.99, 465.00],
  [1700.00, 1799.99, 485.00],
  [1800.00, 1999.99, 510.00],
  [2000.00, 2399.99, 535.00],
  [2400.00, 2499.99, 570.00],
  [2500.00, 2999.99, 610.00],
  [3000.00, 3499.99, 655.00],
  [3500.00, 3999.99, 705.00],
  [4000.00, 4499.99, 725.00],
  [4500.00, 4999.99, 750.00],
  [5000.00, 5499.99, 775.00],
  [5500.00, 5999.99, 800.00],
  [6000.00, 6499.99, 825.00],
  [6500.00, 6999.99, 845.00],
  [7000.00, 7499.99, 880.00],
  [7500.00, 7999.99, 900.00],
  [8000.00, 8499.99, 925.00],
  [8500.00, 8999.99, 945.00],
  [9000.00, 9999.99, 945.00],
  [10000.00, 10499.99, 1000.00],
  [10500.00, 10999.99, 1000.00],
  [11000.00, 11499.99, 1000.00],
  [11500.00, 11999.99, 1000.00],
  [12000.00, 12499.99, 1000.00],
  [12500.00, 14999.99, 1000.00],
  ["pct", 15000.00, 0.075]
];
const COPART_BID_TIERS = [
  [0, 100.00, 0.00],
  [100.00, 500.00, 40.00],
  [500.00, 1000.00, 55.00],
  [1000.00, 1500.00, 75.00],
  [1500.00, 2000.00, 85.00],
  [2000.00, 4000.00, 100.00],
  [4000.00, 6000.00, 110.00],
  [6000.00, 8000.00, 125.00],
  [8000.00, Infinity, 140.00],
];
const COPART_PROCESSING_FEE = 95.00;

function isCopartAuction(name){ return String(name||"").toLowerCase().includes("copart"); }

function tierLookup(price, tiers){
  for(const t of tiers){
    const [min,max,val]=t;
    if(price >= min && price <= max) return val;
  }
  return null;
}
function copartAuctionFee(price){
  if(!Number.isFinite(price) || price < 0) return null;
  let base=null;
  for(const t of COPART_BASE_TIERS){
    if(t[0]==="pct"){
      if(price >= t[1]) base = price * t[2];
    }else{
      const [min,max,val]=t;
      if(price >= min && price <= max){ base=val; break; }
    }
  }
  if(base===null) return null;
  const bid=tierLookup(price, COPART_BID_TIERS);
  if(bid===null) return null;
  return base + COPART_PROCESSING_FEE + bid;
}

/* ---------- Ukraine customs (approximate) ---------- */
// NOTE: constants are easy to adjust.
const EUR_TO_USD = 1.08; // hidden rate
const EXCISE_BASE_EUR_PER_1000CC = { gas: 50, diesel: 75 }; // typical base rates (EUR)
const EXCISE_EUR_PER_KWH = 1; // electric (EUR/kWh) if applicable

function calcCustomsPayment(pricePlusFee){
  const base = (typeof pricePlusFee === "number") ? pricePlusFee : null;
  if(base === null) return null;

  const fuel = el("fuel").value;
  const year = Number(el("year").value);
  const engine = Number(el("engineValue").value);
  const nowYear = (new Date()).getFullYear();
  const age = (Number.isFinite(year) && year>1900) ? Math.max(0, nowYear - year) : null;

  // Duty: 10% for ICE, 0% for electric (adjustable)
  const dutyRate = (fuel === "electric") ? 0.0 : 0.10;
  const duty = base * dutyRate;

  // Excise
  let exciseUsd = null;
  if(fuel === "electric"){
    if(Number.isFinite(engine) && engine>=0){
      exciseUsd = (engine * EXCISE_EUR_PER_KWH) * EUR_TO_USD;
    }
  }else{
    if(Number.isFinite(engine) && engine>0 && age !== null){
      const baseRate = EXCISE_BASE_EUR_PER_1000CC[fuel] || EXCISE_BASE_EUR_PER_1000CC.gas;
      const exciseEur = baseRate * (engine/1000) * age;
      exciseUsd = exciseEur * EUR_TO_USD;
    }
  }

  if(exciseUsd === null) return null;

  // VAT 20% on (base + duty + excise)
  const vat = 0.20 * (base + duty + exciseUsd);

  return duty + exciseUsd + vat;
}

const fmt2 = (n) => (n === null || n === undefined || Number.isNaN(n)) ? "—" : `$${(Math.round(n*100)/100).toFixed(2)}`;
const el = (id) => document.getElementById(id);

let DB = null;
let eurusd = null; // EUR -> USD (auto, hidden)

/* ---------- helpers ---------- */
function unique(arr){
  return Array.from(new Set(arr));
}

function getStatesForAuction(auction){
  return unique(DB.records.filter(r => r.auction===auction).map(r => r.state)).sort();
}

function getLocationsForAuctionState(auction, state){
  return DB.records
    .filter(r => r.auction===auction && (state ? r.state===state : true))
    .map(r => ({ value: r.location, label: `${r.location} (${r.state})`, state: r.state }))
    .sort((a,b)=>a.label.localeCompare(b.label));
}

function setOptions(select, options){
  select.innerHTML = "";
  for(const v of options){
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
}

/* ECB reference rates via Frankfurter (no key) */
async function fetchEurUsd(){
  const url = "https://api.frankfurter.dev/latest?from=EUR&to=USD";
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  const rate = json && json.rates && json.rates.USD;
  return (typeof rate === "number") ? rate : null;
}

/* ---------- data filtering ---------- */
function getFilteredRecords(){
  const auction = el("auction").value;
  const ak = String(auction).toLowerCase();
  return DB.records.filter(r =>
    String(r.auction).toLowerCase() === ak
  );
}


function rebuildLocationList(){
  const recs = getFilteredRecords();
  const labels = unique(recs.map(r => `${r.location} (${r.state})`)).sort((a,b)=>a.localeCompare(b));
  const sel = el("locationSelect");
  setOptions(sel, labels);
}

/* ---------- matching ---------- */
function parseLocationLabel(s){
  const m = String(s).trim().match(/^(.*)\s\(([A-Z]{2})\)$/);
  if(!m) return null;
  return { location: m[1].trim(), state: m[2].trim() };
}

function pickRecord(){
  const auction = el("auction").value;
  const ak = String(auction).toLowerCase();
  const label = el("locationSelect").value.trim();
  if(!auction || !label) return null;

  const parsed = parseLocationLabel(label);
  if(!parsed) return null;

  return DB.records.find(r =>
    String(r.auction).toLowerCase() === ak &&
    r.location === parsed.location &&
    r.state === parsed.state
  ) || null;
}

/* ---------- UI ---------- */
function resetPositions(){
  el("posAuction").textContent = "—";  el("posLocation").textContent = "—";
  el("posType").textContent = "—";
  el("posPrice").textContent = "—";
  el("posAuctionFee").textContent = "—";
  el("posLand").textContent = "—";
  el("posSea").textContent = "—";
  el("posKlaipeda").textContent = "—";
  el("posKlaipedaKyiv").textContent = "—";
  el("posCustomsPay").textContent = "—";
  el("posGrandTotal").textContent = "—";
  const feeRow = document.getElementById("rowAuctionFee");
  if(feeRow) feeRow.classList.add("hidden");
}

function render(){
  const rec = pickRecord();

  if(!rec){
    el("details").textContent = "Выбери аукцион и локацию из списка.";
    el("landTable").innerHTML = "";
    el("bestPort").textContent = "—";
    el("bestLand").textContent = "—";
    el("seaPerCar").textContent = "—";
    el("klaipedaUsd").textContent = "—";
    resetPositions();
    return;
  }

  el("details").textContent = `${rec.auctionLocation} • ${rec.city}, ${rec.state} ${rec.zip ?? ""}`.trim();

  // land table + best port
  const tbody = el("landTable");
  tbody.innerHTML = "";
  let best = { port: null, price: Infinity };

  for(const p of DB.ports){
    const price = rec.ports[p];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p}</td><td>${fmt(price)}</td>`;
    tbody.appendChild(tr);

    if(typeof price === "number" && price < best.price){
      best = { port: p, price };
    }
  }

  const bestPort = (best.port && best.price !== Infinity) ? best.port : null;
  const bestLand = (best.port && best.price !== Infinity) ? best.price : null;

  el("bestPort").textContent = bestPort ?? "—";
  el("bestLand").textContent = fmt(bestLand);

  // sea per car: Sedan -> "4", SUV -> "3" (already per 1 car)
  const vehicleType = el("vehicleType").value;
  const carsKey = (vehicleType === "SUV") ? "3" : "4";
  const seaRates = DB.seaRates[carsKey];
  const seaPerCar = (bestPort && seaRates) ? seaRates[bestPort] : null;
  el("seaPerCar").textContent = fmt(seaPerCar);

  // klaipeda expedition: 350 EUR -> USD (hidden rate)
  const rate = (typeof eurusd === "number" && eurusd > 0) ? eurusd : null;
  const klaipedaUsd = (rate ? (350 * rate) : null);
  el("klaipedaUsd").textContent = fmt2(klaipedaUsd);

  const total = (typeof bestLand === "number" && typeof seaPerCar === "number" && typeof klaipedaUsd === "number")
    ? (bestLand + seaPerCar + klaipedaUsd)
    : null;

  // positions table (single source of truth)
el("posAuction").textContent = rec.auction;
el("posLocation").textContent = rec.location;
el("posType").textContent = vehicleType;

const price = Number(el("priceUsd").value);
const priceOk = Number.isFinite(price) ? price : null;
el("posPrice").textContent = fmt2(priceOk);

let auctionFee = null;
const feeRow = document.getElementById("rowAuctionFee");
if(isCopartAuction(rec.auction) && priceOk !== null){
  auctionFee = copartAuctionFee(priceOk);
  if(feeRow) feeRow.classList.remove("hidden");
}else{
  if(feeRow) feeRow.classList.add("hidden");
}
el("posAuctionFee").textContent = fmt2(auctionFee);

el("posLand").textContent = fmt2(bestLand);
el("posSea").textContent = fmt2(seaPerCar);
el("posKlaipeda").textContent = fmt2(klaipedaUsd);
const klaipedaKyiv = 750;
el("posKlaipedaKyiv").textContent = fmt2(klaipedaKyiv);

const logisticsTotal = (typeof bestLand === "number" && typeof seaPerCar === "number" && typeof klaipedaUsd === "number")
  ? (bestLand + seaPerCar + klaipedaUsd + klaipedaKyiv)
  : null;

const baseForCustoms = (typeof priceOk === "number")
  ? (priceOk + (typeof auctionFee === "number" ? auctionFee : 0))
  : null;

const customsPay = calcCustomsPayment(baseForCustoms);
el("posCustomsPay").textContent = fmt2(customsPay);

const grand = (typeof priceOk === "number" &&
               (auctionFee === null || typeof auctionFee === "number") &&
               typeof logisticsTotal === "number" &&
               typeof customsPay === "number")
  ? (priceOk + (auctionFee || 0) + logisticsTotal + customsPay)
  : null;

el("posGrandTotal").textContent = fmt2(grand);
}

/* ---------- init ---------- */
async function init(){
  // load data
  const res = await fetch("data.json");
  DB = await res.json();

  // EUR->USD (hidden) + fallback
  try {
    const r = await fetchEurUsd();
    eurusd = r ?? 1.1794;
  } catch (e) {
    eurusd = 1.1794;
  }

  // populate auction select
setOptions(el("auction"), DB.auctions);
el("auction").value = DB.auctions[0] || "";

// state + locations for selected auction
rebuildLocationList();

// choose first location
const locSel = el("locationSelect");
if(locSel.options.length > 0) locSel.selectedIndex = 0;

// listeners

  el("auction").addEventListener("change", () => {
    rebuildLocationList();
    const ls = el("locationSelect");
    if(ls.options.length > 0) ls.selectedIndex = 0;
    render();
  });

const stateSel = document.getElementById("stateSelect");
if(stateSel){
  stateSel.addEventListener("change", () => {
    rebuildLocationList();
    const ls = el("locationSelect");
    if(ls.options.length > 0) ls.selectedIndex = 0;
    render();
  });
}

// purchase & customs inputs
const updateEngineLabel = () => {
  const fuel = el("fuel").value;
  el("engineLabel").textContent = (fuel === "electric") ? "Емкость аккумулятора (кВт·ч)" : "Объём двигателя (см³)";
  el("engineValue").placeholder = (fuel === "electric") ? "Например: 75" : "Например: 1998";
};
updateEngineLabel();
el("fuel").addEventListener("change", () => { updateEngineLabel(); render(); });
["priceUsd","year","engineValue"].forEach(id => {
  const e = el(id);
  if(e) e.addEventListener("input", () => render());
});


  el("locationSelect").addEventListener("change", () => render());
  el("vehicleType").addEventListener("change", () => render());

  render();
}

init();
