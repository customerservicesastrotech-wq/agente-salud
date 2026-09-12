// ===== Datos y utilidades =====
const PSS_ITEMS = [
  { text: "Te sentiste alterado/a por algo que pasó sin avisar", inverted: false },
  { text: "Sentiste que no podías controlar lo importante de tu vida", inverted: false },
  { text: 'Te sentiste nervioso/a o "estresado/a"', inverted: false },
  { text: "Te sentiste seguro/a de tu capacidad para manejar tus problemas", inverted: true },
  { text: "Sentiste que las cosas te estaban saliendo a tu manera", inverted: true },
  { text: "No pudiste con todo lo que tenías que hacer", inverted: false },
  { text: "Pudiste controlar las irritaciones de tu vida diaria", inverted: true },
  { text: "Sentiste que tenías todo bajo control", inverted: true },
  { text: "Te enfadaste por cosas que estaban fuera de tu control", inverted: false },
  { text: "Sentiste que las dificultades se acumulaban tanto que no podías con ellas", inverted: false },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calcSleepScore(horas, calidad, despertares) {
  if (!horas || !calidad) return null;
  const horasComp = Math.max(0, 5 - Math.abs(Number(horas) - 7.5));
  const calidadComp = (Number(calidad) - 1) * 1.25;
  const penal = Math.min(Number(despertares) || 0, 3) * 0.5;
  return Math.round(Math.max(0, Math.min(10, horasComp + calidadComp - penal)) * 10) / 10;
}

function calcPSS(respuestas) {
  return respuestas.reduce((sum, val, i) => {
    const item = PSS_ITEMS[i];
    const v = Number(val) || 0;
    return sum + (item.inverted ? 4 - v : v);
  }, 0);
}

// ===== Estado =====
let entries = [];
let pss10 = [];
let form = { calidad: null, contexto: "casa", estres: 0 };
let pssAnswers = Array(10).fill(2);

function loadState() {
  try {
    entries = JSON.parse(localStorage.getItem("healthEntries") || "[]");
  } catch (e) {
    entries = [];
  }
  try {
    pss10 = JSON.parse(localStorage.getItem("pss10Entries") || "[]");
  } catch (e) {
    pss10 = [];
  }
}

function saveEntries() {
  try {
    localStorage.setItem("healthEntries", JSON.stringify(entries));
  } catch (e) {
    flashSave("No se pudo guardar. Revisa el espacio de tu teléfono.");
  }
}

function savePss() {
  try {
    localStorage.setItem("pss10Entries", JSON.stringify(pss10));
  } catch (e) {
    flashSave("No se pudo guardar la evaluación semanal.");
  }
}

function flashSave(msg) {
  const el = document.getElementById("saveMsg");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 2500);
}

// ===== Tabs =====
function switchTab(tab) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
  document.getElementById("panel-" + tab).classList.add("active");
  document.querySelector('.tabbtn[data-tab="' + tab + '"]').classList.add("active");
  if (tab === "tendencias") renderCharts();
  if (tab === "resumen") renderResumen();
  if (tab === "exportar") renderExport();
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}
function closeModalBg(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ===== Check-in form =====
function buildChips() {
  const calidadWrap = document.getElementById("calidadChips");
  calidadWrap.innerHTML = "";
  [1, 2, 3, 4, 5].forEach((n) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.textContent = n;
    b.onclick = () => {
      form.calidad = n;
      document.querySelectorAll("#calidadChips .chip").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
    };
    calidadWrap.appendChild(b);
  });

  const ctxWrap = document.getElementById("contextoChips");
  ctxWrap.innerHTML = "";
  ["casa", "trabajo", "social", "viaje"].forEach((c) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === "casa" ? " active" : "");
    b.type = "button";
    b.textContent = c;
    b.onclick = () => {
      form.contexto = c;
      document.querySelectorAll("#contextoChips .chip").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    };
    ctxWrap.appendChild(b);
  });

  document.getElementById("f_estres").addEventListener("input", (e) => {
    form.estres = e.target.value;
    document.getElementById("estresVal").textContent = e.target.value + " / 10";
  });
}

function resetForm() {
  document.getElementById("f_date").value = todayISO();
  document.getElementById("f_peso").value = "";
  document.getElementById("f_horas").value = "";
  document.getElementById("f_despertares").value = "";
  document.getElementById("f_comida").value = "";
  document.getElementById("f_evento").value = "";
  document.getElementById("f_estres").value = 0;
  document.getElementById("estresVal").textContent = "0 / 10";
  form.calidad = null;
  form.contexto = "casa";
  form.estres = 0;
  document.querySelectorAll("#calidadChips .chip").forEach((c) => c.classList.remove("active"));
  document.querySelectorAll("#contextoChips .chip").forEach((c, i) => c.classList.toggle("active", i === 0));
}

function submitCheckin() {
  const date = document.getElementById("f_date").value || todayISO();
  const peso_kg = document.getElementById("f_peso").value;
  const horas_dormidas = document.getElementById("f_horas").value;
  const despertares = document.getElementById("f_despertares").value;
  const comida_notas = document.getElementById("f_comida").value;
  const evento_notas = document.getElementById("f_evento").value;

  const sueno_score = calcSleepScore(horas_dormidas, form.calidad, despertares);

  const entry = {
    date,
    peso_kg: peso_kg ? Number(peso_kg) : null,
    horas_dormidas: horas_dormidas ? Number(horas_dormidas) : null,
    despertares: despertares ? Number(despertares) : null,
    calidad_sueno: form.calidad,
    estres_diario: Number(form.estres) || null,
    comida_contexto: form.contexto,
    comida_notas,
    evento_notas,
    sueno_score,
    exportado: false,
  };

  entries = entries.filter((e) => e.date !== entry.date);
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries();
  flashSave("Check-in guardado.");
  resetForm();
  renderFlags();
}

// ===== PSS-10 modal =====
function openPss() {
  pssAnswers = Array(10).fill(2);
  const wrap = document.getElementById("pssItems");
  wrap.innerHTML = "";
  PSS_ITEMS.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "sliderrow";
    const label = document.createElement("div");
    label.style.fontSize = "13.5px";
    label.textContent = item.text;
    const chips = document.createElement("div");
    chips.className = "chiprow";
    [0, 1, 2, 3, 4].forEach((v) => {
      const b = document.createElement("button");
      b.className = "chip" + (v === 2 ? " active" : "");
      b.type = "button";
      b.style.padding = "5px 11px";
      b.textContent = v;
      b.onclick = () => {
        pssAnswers[i] = v;
        chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
      };
      chips.appendChild(b);
    });
    row.appendChild(label);
    row.appendChild(chips);
    wrap.appendChild(row);
  });
  openModal("pssModal");
}

function submitPss() {
  const score = calcPSS(pssAnswers);
  pss10.push({ date: todayISO(), score, exportado: false });
  savePss();
  closeModal("pssModal");
  flashSave("Evaluación semanal guardada.");
  renderFlags();
}

// ===== Flags (detección de patrones) =====
function renderFlags() {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out = [];

  const lastTwo = sorted.slice(-2).filter((e) => e.sueno_score != null && e.sueno_score < 5);
  if (lastTwo.length >= 2) {
    out.push("Dos o más noches seguidas con puntaje de sueño bajo. Puede valer la pena adelantar la hora de acostarte esta noche.");
  }
  const lastThreeStress = sorted.slice(-3).filter((e) => e.estres_diario != null && e.estres_diario >= 7);
  if (lastThreeStress.length >= 2) {
    out.push("Estrés alto en varios de los últimos días. Prueba una pausa de respiración de 3 minutos hoy.");
  }
  const lastPss = pss10[pss10.length - 1];
  if (lastPss && lastPss.score > 20) {
    out.push("Tu última evaluación semanal salió en " + lastPss.score + "/40 (estrés percibido alto). Si persiste, vale la pena hablarlo con un profesional.");
  }

  const area = document.getElementById("flagsArea");
  area.innerHTML = "";
  out.forEach((f) => {
    const d = document.createElement("div");
    d.className = "flagbanner";
    d.textContent = f;
    area.appendChild(d);
  });
}

// ===== Charts =====
let chartInstances = {};
function renderCharts() {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const empty = document.getElementById("tendenciasEmpty");
  const wrap = document.getElementById("tendenciasCharts");
  if (sorted.length === 0) {
    empty.style.display = "block";
    wrap.style.display = "none";
    return;
  }
  empty.style.display = "none";
  wrap.style.display = "block";

  const labels = sorted.map((e) => e.date.slice(5));
  const draw = (id, key, color) => {
    const ctx = document.getElementById(id).getContext("2d");
    if (chartInstances[id]) chartInstances[id].destroy();
    chartInstances[id] = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: sorted.map((e) => e[key]),
            borderColor: color,
            backgroundColor: color,
            spanGaps: true,
            tension: 0.3,
            pointRadius: 3,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 11 }, color: "#8A8575" }, grid: { display: false } },
          y: { ticks: { font: { size: 11 }, color: "#8A8575" }, grid: { color: "#E3DFD1" } },
        },
      },
    });
  };
  draw("chartPeso", "peso_kg", "#2F5D50");
  draw("chartSueno", "sueno_score", "#5B7F52");
  draw("chartEstres", "estres_diario", "#C98A3B");
}

// ===== Resumen (cálculo local, sin IA) =====
function avg(arr) {
  const vals = arr.filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function renderResumen() {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const area = document.getElementById("resumenArea");
  area.innerHTML = "";
  if (!sorted.length) {
    area.innerHTML = '<div class="hint">Todavía no hay datos suficientes.</div>';
    return;
  }
  const items = [
    ["Peso promedio (últimos 7 check-ins)", avg(last7.map((e) => e.peso_kg))],
    ["Puntaje de sueño promedio", avg(last7.map((e) => e.sueno_score))],
    ["Estrés diario promedio", avg(last7.map((e) => e.estres_diario))],
  ];
  items.forEach(([label, val]) => {
    const row = document.createElement("div");
    row.className = "summaryitem";
    row.innerHTML = "<span>" + label + "</span><span>" + (val == null ? "—" : val) + "</span>";
    area.appendChild(row);
  });
  if (pss10.length) {
    const row = document.createElement("div");
    row.className = "summaryitem";
    row.innerHTML = "<span>Última evaluación semanal de estrés</span><span>" + pss10[pss10.length - 1].score + "/40</span>";
    area.appendChild(row);
  }
}

// ===== Exportar =====
function pendientes() {
  return entries.filter((e) => !e.exportado);
}

function buildExportText() {
  const pend = pendientes();
  const pssPend = pss10.filter((p) => !p.exportado);
  if (!pend.length && !pssPend.length) return "";

  const peso = pend.filter((e) => e.peso_kg != null);
  const sueno = pend.filter((e) => e.horas_dormidas != null);
  const estres = pend.filter((e) => e.estres_diario != null);
  const comidas = pend.filter((e) => e.comida_notas);
  const eventos = pend.filter((e) => e.evento_notas);

  let out = "";
  if (peso.length) {
    out += "=== PESO ===\nfecha,peso_kg,nota\n";
    out += peso.map((e) => e.date + "," + e.peso_kg + ",").join("\n") + "\n\n";
  }
  if (sueno.length) {
    out += "=== SUEÑO ===\nfecha,horas_dormidas,despertares,calidad_1_5,puntaje_sueno_0_10\n";
    out += sueno.map((e) => [e.date, e.horas_dormidas, e.despertares ?? "", e.calidad_sueno ?? "", e.sueno_score ?? ""].join(",")).join("\n") + "\n\n";
  }
  if (estres.length) {
    out += "=== ESTRÉS DIARIO ===\nfecha,puntaje_0_10\n";
    out += estres.map((e) => e.date + "," + e.estres_diario).join("\n") + "\n\n";
  }
  if (pssPend.length) {
    out += "=== ESTRÉS SEMANAL (PSS-10) ===\nfecha,puntaje_0_40\n";
    out += pssPend.map((p) => p.date + "," + p.score).join("\n") + "\n\n";
  }
  if (comidas.length) {
    out += "=== COMIDAS ===\n";
    out += comidas.map((e) => "### " + e.date + "\n- Comida (" + e.comida_contexto + "): " + e.comida_notas).join("\n") + "\n\n";
  }
  if (eventos.length) {
    out += "=== EVENTOS ===\n";
    out += eventos.map((e) => "### " + e.date + "\n- Evento: " + e.evento_notas).join("\n") + "\n\n";
  }
  return out.trim();
}

function renderExport() {
  const text = buildExportText();
  const empty = document.getElementById("exportEmpty");
  const box = document.getElementById("exportText");
  const hint = document.getElementById("exportHint");
  const btn = document.getElementById("exportBtn");
  if (!text) {
    empty.style.display = "block";
    box.style.display = "none";
    hint.style.display = "none";
    btn.style.display = "none";
    return;
  }
  empty.style.display = "none";
  box.style.display = "block";
  hint.style.display = "block";
  btn.style.display = "block";
  box.value = text;
}

function marcarExportado() {
  entries = entries.map((e) => (pendientes().includes(e) ? { ...e, exportado: true } : e));
  saveEntries();
  pss10 = pss10.map((p) => ({ ...p, exportado: true }));
  savePss();
  renderExport();
  flashSave("Marcado como exportado.");
}

// ===== Init =====
function init() {
  document.getElementById("todayLabel").textContent = todayISO();
  loadState();
  buildChips();
  resetForm();
  renderFlags();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
