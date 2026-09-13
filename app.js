"use strict";

const APP_SCHEMA_VERSION = "3.0";
const EXTRACTOR_VERSION = "local-es-3.0";
const ANALYSIS_VERSION = "daily-context-1.0";
const DB_NAME = "miDiaBitacora";
const DB_VERSION = 1;
const DAY_STORE = "days";
const SETTINGS_STORE = "settings";
const PHASE_ORDER = ["morning", "afternoon", "night"];
const PHASE_LABELS = { morning: "Mañana", afternoon: "Tarde", night: "Noche" };
const PHASE_ICONS = { morning: "☀️", afternoon: "◒", night: "☾" };
const PERIOD_LABELS = { previous_night:"Noche anterior", previous_day:"Día anterior", morning:"Mañana", afternoon:"Tarde", night:"Noche", all_day:"Todo el día", habitual:"Hábito", unspecified:"Sin precisar" };
const $ = (id) => document.getElementById(id);

const PHASES = {
  morning: {
    eyebrow: "Registro de la mañana",
    title: "Desde que despertaste hasta ahora",
    mainTitle: "Cuéntame cómo comenzó tu día.",
    description: "Las referencias al sueño corresponden a la noche anterior; la hora de captura queda guardada por separado.",
    cues: [
      ["sleep","🌙","Sueño","horas, calidad, despertares",/dorm|sueñ|sueno|despert|acost|levant/i],
      ["waking","🌅","Despertar","cómo amaneciste",/amanec|despert|levant|descansad/i],
      ["energy","⚡","Energía","cansancio o vitalidad",/energ|cans|fatig|agot/i],
      ["mood","🙂","Ánimo","emociones al empezar",/ánim|animo|feliz|triste|tranquil|ansios|irrit/i],
      ["body","🫶","Cuerpo","dolor, molestias, señales",/dolor|molest|síntom|sintom|cuerpo|náuse|nause|fiebre/i],
      ["breakfast","🥣","Desayuno y bebidas","comida, agua, café",/desayun|com[ií]|tom[eé]|beb[ií]|agua|caf[eé]|t[eé]/i]
    ],
    extras: [
      ["medicine","💊","Medicinas","dosis y hora si aplica",/medic|pastill|tableta|cápsul|capsul|suplement/i],
      ["context","📍","Contexto","lugar, personas, planes",/trabaj|estudi|casa|famil|reuni|viaj|clima/i]
    ]
  },
  afternoon: {
    eyebrow: "Registro de la tarde",
    title: "Desde tu registro de la mañana hasta ahora",
    mainTitle: "Cuéntame cómo siguió tu día.",
    description: "No necesitas repetir la mañana. Esta fase se suma a lo que ya guardaste.",
    cues: [
      ["food","🍲","Comidas y snacks","qué, cuánto y contexto",/almor|com[ií]|merend|snack|alimento|postre/i],
      ["drink","💧","Agua y bebidas","tipo y cantidad",/agua|beb[ií]|tom[eé]|vaso|botella|litro|mililitro/i],
      ["movement","🚶","Movimiento","tipo, tiempo, intensidad",/camin|corr|entren|ejerc|yoga|bicic|nad|pasos/i],
      ["stress","🫧","Estrés","situación y respuesta",/estr[eé]s|tensi[oó]n|presi[oó]n|abrum|preocup/i],
      ["energy","🔋","Energía y ánimo","cambios durante la tarde",/energ|ánim|animo|cans|fatig|feliz|triste|tranquil/i],
      ["people","👥","Personas y entorno","trabajo, estudio, compañía",/trabaj|estudi|reuni|famil|amig|solo|sola|casa|oficina/i]
    ],
    extras: [
      ["symptoms","🩹","Síntomas","inicio, intensidad, duración",/dolor|molest|síntom|sintom|mare|náuse|nause|fiebre/i],
      ["substances","☕","Medicinas y sustancias","café, alcohol, nicotina",/medic|pastill|suplement|caf[eé]|alcohol|cerveza|vino|nicotin|cigarr/i]
    ]
  },
  night: {
    eyebrow: "Registro de la noche",
    title: "Desde tu registro de la tarde hasta cerrar el día",
    mainTitle: "Cuéntame cómo terminó tu día.",
    description: "Aquí registras la noche y la preparación para dormir; el sueño que viene se contará mañana.",
    cues: [
      ["dinner","🍽️","Cena y bebidas","qué, cuánto y hora",/cen[ée]|com[ií]|agua|beb[ií]|tom[eé]|snack/i],
      ["rest","🛋️","Actividad o descanso","movimiento, pausas, sedentarismo",/camin|corr|entren|ejerc|descans|sentad|acost/i],
      ["recovery","🌿","Estrés y recuperación","qué ayudó o dificultó",/estr[eé]s|tensi[oó]n|relaj|respir|pausa|recuper/i],
      ["mood","💛","Ánimo y energía","cómo cerraste el día",/ánim|animo|energ|cans|fatig|feliz|triste|tranquil|ansios/i],
      ["symptoms","🩹","Síntomas","cambios o molestias",/dolor|molest|síntom|sintom|mare|náuse|nause|fiebre/i],
      ["balance","✨","Balance","eventos, logros, dificultades",/logr|dif[ií]cil|mejor|peor|destac|agradec|balance|pas[oó]/i]
    ],
    extras: [
      ["medicine","💊","Medicinas y sustancias","dosis, hora, efecto",/medic|pastill|suplement|alcohol|caf[eé]|nicotin/i],
      ["bedtime","🛏️","Prepararte para dormir","rutina y hora prevista",/dormir|acost|pantalla|rutina|alarma/i]
    ]
  }
};

const state = {
  db:null, days:[], day:null, activeDate:null, activePhase:"morning", profile:{ name:"", age:"", goal:"" },
  externalConsent:false, aiConfigured:false, transcriptionModel:"", analysisModel:"", pendingMetrics:[],
  pendingEvents:[], mediaRecorder:null, mediaStream:null, audioChunks:[], recognition:null, recording:false,
  recordingMode:null, currentInputSource:"text", recognitionBase:"", recognitionFinal:"", timerId:null, timerStarted:0,
  draftTimer:null, toastTimer:null, savingPhase:false, finalizing:false, confirmationResolve:null, startingMediaRecorder:false
};

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2,"0"), String(now.getDate()).padStart(2,"0")].join("-");
}

function timezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function shiftDate(date,days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return [value.getFullYear(),String(value.getMonth()+1).padStart(2,"0"),String(value.getDate()).padStart(2,"0")].join("-");
}

function deepClone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(date, short = false) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", short ? { day:"2-digit", month:"short" } : { weekday:"long", day:"numeric", month:"long", year:"numeric" }).format(parsed);
}

function formatTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", { hour:"numeric", minute:"2-digit" }).format(new Date(iso));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

function stripAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clampText(value, max = 30000) {
  return String(value ?? "").replace(/\u0000/g, "").slice(0, max);
}

function toast(message) {
  clearTimeout(state.toastTimer);
  $("toast").textContent = message;
  $("toast").classList.add("show");
  state.toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

function showConfirm(title, message, acceptText = "Continuar") {
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  $("confirmAccept").textContent = acceptText;
  $("confirmDialog").showModal();
  return new Promise((resolve) => { state.confirmationResolve = resolve; });
}

function resolveConfirm(value) {
  if ($("confirmDialog").open) $("confirmDialog").close();
  const resolve = state.confirmationResolve;
  state.confirmationResolve = null;
  if (resolve) resolve(value);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DAY_STORE)) db.createObjectStore(DAY_STORE, { keyPath:"date" });
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath:"key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local"));
    request.onblocked = () => reject(new Error("El almacenamiento está bloqueado por otra pestaña"));
  });
}

function dbRequest(storeName, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request; let result;
    try { request = operation(store); } catch (error) { reject(error); return; }
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error || new Error("No se pudo completar el guardado"));
    transaction.onerror = () => reject(transaction.error || new Error("Falló una operación de almacenamiento"));
  });
}

const getAllDays = () => dbRequest(DAY_STORE, "readonly", (store) => store.getAll());
const getDay = (date) => dbRequest(DAY_STORE, "readonly", (store) => store.get(date));
const putDay = (day) => dbRequest(DAY_STORE, "readwrite", (store) => store.put(day));
const deleteDayFromDb = (date) => dbRequest(DAY_STORE, "readwrite", (store) => store.delete(date));
const getSetting = (key) => dbRequest(SETTINGS_STORE, "readonly", (store) => store.get(key));
const putSetting = (key, value) => dbRequest(SETTINGS_STORE, "readwrite", (store) => store.put({ key, value }));

function blankPhase() {
  return { status:"empty", rawTranscript:"", correctedTranscript:"", draftTranscript:"", capturedAt:null, savedAt:null, source:"text", metrics:[], events:[], cueCoverage:[], revision:0, revisions:[] };
}

function createDay(date) {
  return { schemaVersion:APP_SCHEMA_VERSION, date, timezone:timezone(), status:"draft", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), revision:0, phases:{ morning:blankPhase(), afternoon:blankPhase(), night:blankPhase() }, finalization:null, previousFinalizations:[] };
}

function normalizeDay(day) {
  const normalized = { ...createDay(day?.date || localToday()), ...(day || {}) };
  normalized.phases = normalized.phases || {};
  PHASE_ORDER.forEach((phase) => { normalized.phases[phase] = { ...blankPhase(), ...(normalized.phases[phase] || {}) }; });
  normalized.previousFinalizations = Array.isArray(normalized.previousFinalizations) ? normalized.previousFinalizations : [];
  return normalized;
}

async function persistCurrentDay(message = "Borrador guardado") {
  if (!state.day) return;
  state.day.updatedAt = new Date().toISOString();
  state.day.timezone = state.day.timezone || timezone();
  try {
    await putDay(state.day);
    const index = state.days.findIndex((item) => item.date === state.day.date);
    if (index >= 0) state.days[index] = deepClone(state.day); else state.days.push(deepClone(state.day));
    $("autosaveState").textContent = message;
  } catch (error) {
    $("autosaveState").textContent = "No se pudo guardar";
    toast("No pude guardar localmente. Copia tu texto antes de cerrar.");
    throw error;
  }
}

async function migrateLegacyData() {
  const already = await getSetting("legacyMigrationV3");
  if (already?.value) return;
  const raw = localStorage.getItem("wellbeingEntriesV2") || localStorage.getItem("healthEntries");
  let legacy = [];
  try { legacy = JSON.parse(raw || "[]"); } catch (_) { legacy = []; }
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      if (!item?.date || await getDay(item.date)) continue;
      const day = createDay(item.date);
      const phaseText = { morning:item.morning || (item.horas_dormidas ? `Dormí ${item.horas_dormidas} horas.` : ""), afternoon:item.afternoon || item.comida_notas || "", night:item.night || item.evento_notas || "" };
      PHASE_ORDER.forEach((phase) => {
        if (!phaseText[phase]) return;
        day.phases[phase] = { ...blankPhase(), status:"saved", rawTranscript:phaseText[phase], correctedTranscript:phaseText[phase], capturedAt:item.createdAt || new Date(`${item.date}T12:00:00`).toISOString(), savedAt:item.createdAt || new Date().toISOString(), source:"legacy", revision:1 };
      });
      day.status = "draft";
      await putDay(day);
    }
  }
  const legacyProfile = localStorage.getItem("wellbeingProfileV2");
  if (legacyProfile) {
    try { const parsed = JSON.parse(legacyProfile); if (parsed) await putSetting("profile", parsed); } catch (_) { /* dato antiguo inválido */ }
  }
  await putSetting("legacyMigrationV3", true);
}

async function loadSettings() {
  const profileSetting = await getSetting("profile");
  const consentSetting = await getSetting("externalConsent");
  state.profile = { ...state.profile, ...(profileSetting?.value || {}) };
  state.externalConsent = Boolean(consentSetting?.value);
  $("profileName").value = state.profile.name || "";
  $("profileAge").value = state.profile.age || "";
  $("profileGoal").value = state.profile.goal || "";
  $("externalConsent").checked = state.externalConsent;
}

async function detectBackend() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch("/api/config", { cache:"no-store", signal:controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error("backend unavailable");
    const config = await response.json();
    state.aiConfigured = Boolean(config.aiConfigured);
    state.transcriptionModel = config.transcriptionModel || "";
    state.analysisModel = config.analysisModel || "";
  } catch (_) {
    state.aiConfigured = false;
  }
  const chip = $("engineStatus");
  chip.classList.toggle("online", state.aiConfigured);
  chip.querySelector("span:last-child").textContent = state.aiConfigured ? "Análisis avanzado listo" : "Modo local";
}

function switchTab(tab) {
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${tab}`));
  document.querySelectorAll(".navbtn[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "historial") renderHistory();
  if (tab === "tendencias") requestAnimationFrame(renderCharts);
  if (tab === "perfil") updateStorageEstimate();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function setRecordingUI(active, message, error = false) {
  state.recording = active;
  $("micBtn").classList.toggle("listening", active);
  $("micBtn").setAttribute("aria-pressed", String(active));
  $("micBtn").setAttribute("aria-label", active ? "Detener grabación" : "Empezar grabación");
  $("recTitle").textContent = active ? "Te estoy escuchando…" : "Toca el micrófono y narra";
  $("recStatus").classList.toggle("error", error);
  $("recStatus").innerHTML = message || (active ? '<span class="timer" id="recordTimer">00:00</span> Habla con calma; no importa el orden.' : "También puedes escribir. No hace falta seguir el orden de las pistas.");
}

function updateTimer() {
  const target = $("recordTimer");
  if (!target) return;
  const seconds = Math.floor((Date.now() - state.timerStarted) / 1000);
  target.textContent = `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;
  const recognition = new SpeechRecognition();
  recognition.lang = "es-CO";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    // Reconstruimos siempre la cadena final desde cero para evitar duplicados
    // cuando el navegador reenvía resultados ya definitivos en onresult.
    let finalText = "";
    let interim = "";
    for (let index = 0; index < event.results.length; index += 1) {
      const text = event.results[index][0].transcript.trim();
      if (!text) continue;
      if (event.results[index].isFinal) finalText += `${finalText ? " " : ""}${text}`;
      else interim += `${interim ? " " : ""}${text}`;
    }
    state.recognitionFinal = finalText;
    $("transcript").value = [state.recognitionBase, finalText, interim].filter(Boolean).join(" ").trim();
    state.currentInputSource = "voice";
    updateCueCoverage();
  };
  recognition.onerror = (event) => {
    const messages = { "not-allowed":"No se concedió permiso para usar el micrófono.", "audio-capture":"No se encontró un micrófono.", network:"El dictado no tiene conexión.", "no-speech":"No escuché voz. Puedes intentarlo otra vez." };
    stopTimer();
    setRecordingUI(false, messages[event.error] || "El dictado se interrumpió. Tu texto sigue aquí.", true);
  };
  recognition.onend = () => {
    stopTimer();
    $("transcript").value = [state.recognitionBase, state.recognitionFinal].filter(Boolean).join(" ").trim();
    setRecordingUI(false);
    queueDraftSave();
  };
  state.recognition = recognition;
}

async function startMediaRecording() {
  if (state.startingMediaRecorder) return;
  state.startingMediaRecorder = true;
  try {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true }, video:false });
    const preferred = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find((type) => window.MediaRecorder?.isTypeSupported?.(type));
    state.audioChunks = [];
    state.mediaRecorder = preferred ? new MediaRecorder(state.mediaStream, { mimeType:preferred }) : new MediaRecorder(state.mediaStream);
    state.mediaRecorder.ondataavailable = (event) => { if (event.data?.size) state.audioChunks.push(event.data); };
    state.mediaRecorder.onerror = () => { stopMediaTracks(); setRecordingUI(false,"La grabación se interrumpió. Puedes continuar por escrito.",true); };
    state.mediaRecorder.onstop = transcribeRecordedAudio;
    state.mediaRecorder.start(1000);
    state.recordingMode = "media";
    state.timerStarted = Date.now();
    setRecordingUI(true);
    state.timerId = setInterval(updateTimer, 500);
  } catch (error) {
    stopMediaTracks();
    setRecordingUI(false, error?.name === "NotAllowedError" ? "No se concedió permiso para usar el micrófono." : "No pude iniciar el micrófono. Puedes escribir tu relato.", true);
  } finally {
    state.startingMediaRecorder = false;
  }
}

function stopMediaTracks() {
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
}

async function transcribeRecordedAudio() {
  stopTimer();
  stopMediaTracks();
  const type = state.mediaRecorder?.mimeType || state.audioChunks[0]?.type || "audio/webm";
  const blob = new Blob(state.audioChunks, { type });
  state.audioChunks = [];
  state.mediaRecorder = null;
  state.recording = false;
  if (blob.size < 800) { setRecordingUI(false,"La grabación quedó vacía. Inténtalo otra vez o escribe.",true); return; }
  setRecordingUI(false,"Transcribiendo tu relato…");
  $("micBtn").disabled = true;
  try {
    const response = await fetch("/api/transcribe", { method:"POST", headers:{ "Content-Type":type, "X-Audio-Filename":`registro-${state.activePhase}.webm`, "X-Language":"es" }, body:blob, cache:"no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "No se pudo transcribir");
    const prior = $("transcript").value.trim();
    $("transcript").value = [prior, payload.text].filter(Boolean).join(prior ? "\n" : "").trim();
    state.currentInputSource = "voice";
    updateCueCoverage();
    queueDraftSave();
    setRecordingUI(false,"Transcripción lista. Revísala antes de guardar.");
  } catch (_) {
    setRecordingUI(false,"No pude transcribir el audio. No se guardó la grabación; puedes intentarlo o escribir.",true);
  } finally {
    $("micBtn").disabled = false;
  }
}

async function toggleVoice() {
  if (state.recording) {
    if (state.recordingMode === "media" && state.mediaRecorder?.state !== "inactive") state.mediaRecorder.stop();
    else if (state.recordingMode === "speech") state.recognition?.stop();
    return;
  }
  if (!state.externalConsent) { toast("Activa la autorización temporal antes de usar la voz"); $("externalConsent").focus(); return; }
  if (state.aiConfigured && window.MediaRecorder && navigator.mediaDevices?.getUserMedia) { await startMediaRecording(); return; }
  if (state.recognition) {
    state.recordingMode = "speech";
    state.recognitionBase = $("transcript").value.trim();
    state.recognitionFinal = "";
    try {
      state.recognition.start();
      state.timerStarted = Date.now();
      setRecordingUI(true);
      state.timerId = setInterval(updateTimer, 500);
    } catch (_) { setRecordingUI(false,"Espera un momento antes de activar de nuevo el micrófono.",true); }
    return;
  }
  setRecordingUI(false,"Este navegador no ofrece dictado compatible. Puedes escribir normalmente.",true);
}

const SMALL_NUMBERS = Object.freeze({ cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29 });
const TENS = Object.freeze({ treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90 });
const NUMBER_SOURCE = "(?:\\d+(?:[.,]\\d+)?|(?:cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintid[oó]s|veintitr[eé]s|veinticuatro|veinticinco|veintis[eé]is|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos)(?:\\s+y\\s+(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?)";

function parseSpanishNumber(raw) {
  if (raw == null) return null;
  const numeric = String(raw).match(/[-+]?\d+(?:[.,]\d+)?/);
  if (numeric) return Number(numeric[0].replace(",","."));
  const tokens = stripAccents(raw).replace(/\by\b/g," ").trim().split(/\s+/);
  let total = 0; let found = false;
  tokens.forEach((token) => {
    if (Object.hasOwn(SMALL_NUMBERS,token)) { total += SMALL_NUMBERS[token]; found = true; }
    else if (Object.hasOwn(TENS,token)) { total += TENS[token]; found = true; }
    else if (token === "cien" || token === "ciento") { total += 100; found = true; }
    else if (token === "doscientos") { total += 200; found = true; }
  });
  return found ? total : null;
}

function sentenceAt(text, index) {
  let start = Math.max(text.lastIndexOf(".",index - 1), text.lastIndexOf("!",index - 1), text.lastIndexOf("?",index - 1), text.lastIndexOf("\n",index - 1)) + 1;
  const ends = [text.indexOf(".",index),text.indexOf("!",index),text.indexOf("?",index),text.indexOf("\n",index)].filter((value) => value >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  while (start < end && /\s/.test(text[start])) start += 1;
  return { text:text.slice(start,end).trim(), start, end };
}

function isNegatedOrUnrealized(sentence, evidence) {
  const normalized = stripAccents(sentence);
  const target = stripAccents(evidence);
  const index = normalized.indexOf(target);
  const before = normalized.slice(Math.max(0,index - 55),index);
  const negations = [...before.matchAll(/\b(no|nunca|tampoco|sin)\b/g)];
  const lastNegation = negations.at(-1);
  if (lastNegation) {
    const scope = before.slice(lastNegation.index);
    if (scope.length <= 45 && !/\b(y|pero|aunque|sin embargo)\b/.test(scope)) return true;
  }
  if (/\b(queria|pensaba|planeaba|iba a|intente)\b/.test(normalized) && /\b(?:pero\s+)?no\b/.test(normalized)) return true;
  return false;
}

function detectEventPeriod(text, fallback) {
  const value = stripAccents(text);
  if (/\b(anoche|noche anterior|ayer por la noche)\b/.test(value)) return "previous_night";
  if (/\bayer\b/.test(value)) return "previous_day";
  if (/\b(esta manana|por la manana|en la manana|al despertar)\b/.test(value)) return "morning";
  if (/\b(esta tarde|por la tarde|en la tarde|al mediodia)\b/.test(value)) return "afternoon";
  if (/\b(esta noche|por la noche|en la noche)\b/.test(value)) return "night";
  if (/\b(normalmente|por lo general|habitualmente|suelo)\b/.test(value)) return "habitual";
  if (fallback === "morning" && /\b(dormi|he dormido|me desperte|despertares?)\b/.test(value)) return "previous_night";
  return fallback;
}

const METRIC_SPECS = [
  { key:"weight", category:"body", name:"Peso", unit:"kg", min:20, max:400, patterns:[`\\b(?:peso|pes[eé]|marc[oó] la b[aá]scula|estoy pesando)(?:\\s+(?:de|en|aproximadamente|unos?))*\\s+(${NUMBER_SOURCE})\\s*(?:kg|kilos?|kilogramos?)\\b`] },
  { key:"sleep", category:"sleep", name:"Sueño reportado", unit:"h", min:0, max:24, patterns:[`\\b(?:dorm[ií]|he dormido|dormido)(?:\\s+(?:unas?|aproximadamente|cerca de))*\\s+(${NUMBER_SOURCE})\\s*(?:horas?|h)\\b`] },
  { key:"awakenings", category:"sleep", name:"Despertares", unit:"veces", min:0, max:50, patterns:[`\\b(?:me despert[eé]|tuve)\\s+(${NUMBER_SOURCE})\\s+(?:veces|despertares?)\\b`,`\\b(${NUMBER_SOURCE})\\s+despertares?\\b`] },
  { key:"water_l", category:"hydration", name:"Agua o bebida", unit:"L", min:0, max:20, patterns:[`\\b(?:tom[eé]|beb[ií]|consum[ií])(?:[^.!?\\n]{0,35}?)?(${NUMBER_SOURCE})\\s*(?:litros?|lts?|l)\\b`,`\\b(${NUMBER_SOURCE})\\s*(?:litros?|lts?|l)\\s+(?:de\\s+)?(?:agua|bebida)\\b`] },
  { key:"water_ml", category:"hydration", name:"Agua o bebida", unit:"ml", min:0, max:20000, patterns:[`\\b(?:tom[eé]|beb[ií]|consum[ií])(?:[^.!?\\n]{0,35}?)?(${NUMBER_SOURCE})\\s*(?:mililitros?|ml)\\b`,`\\b(${NUMBER_SOURCE})\\s*(?:mililitros?|ml)\\s+(?:de\\s+)?(?:agua|bebida)\\b`] },
  { key:"container_count", category:"hydration", name:"Recipientes bebidos", unit:"unidad", min:0, max:100, patterns:[`\\b(?:tom[eé]|beb[ií]|consum[ií])(?:\\s+(?:unos?|aproximadamente))*\\s+(${NUMBER_SOURCE})\\s+(vasos?|botellas?|tazas?)\\b`], unitGroup:2 },
  { key:"activity_minutes", category:"activity", name:"Actividad física", unit:"min", min:0, max:1440, patterns:[`\\b(?:camin[eé]|corr[ií]|trot[eé]|entren[eé]|hice ejercicio|practiqu[eé]|nad[eé]|mont[eé](?: en)? bicicleta|yoga)(?:[^.!?\\n]{0,50}?)?(${NUMBER_SOURCE})\\s*(?:minutos?|min)\\b`] },
  { key:"activity_distance", category:"activity", name:"Distancia de actividad", unit:"km", min:0, max:1000, patterns:[`\\b(?:camin[eé]|corr[ií]|trot[eé]|nad[eé]|recorr[ií])(?:[^.!?\\n]{0,40}?)?(${NUMBER_SOURCE})\\s*(?:kil[oó]metros?|km)\\b`] },
  { key:"steps", category:"activity", name:"Pasos", unit:"pasos", min:0, max:200000, patterns:[`\\b(?:hice|di|camin[eé]|registr[eé])(?:[^.!?\\n]{0,20}?)?(${NUMBER_SOURCE})\\s+pasos\\b`,`\\b(${NUMBER_SOURCE})\\s+pasos\\b`] },
  { key:"stress_10", category:"state", name:"Estrés", unit:"/10", min:0, max:10, patterns:[`\\b(?:estr[eé]s|tensi[oó]n)(?:\\s+(?:estuvo|fue|nivel|en|de))*\\s+(${NUMBER_SOURCE})\\s*(?:de|sobre|/)\\s*10\\b`] },
  { key:"mood_10", category:"state", name:"Ánimo", unit:"/10", min:0, max:10, patterns:[`\\b(?:[aá]nimo|estado de [aá]nimo)(?:\\s+(?:estuvo|fue|nivel|en|de))*\\s+(${NUMBER_SOURCE})\\s*(?:de|sobre|/)\\s*10\\b`] },
  { key:"energy_10", category:"state", name:"Energía", unit:"/10", min:0, max:10, patterns:[`\\b(?:energ[ií]a)(?:\\s+(?:estuvo|fue|nivel|en|de))*\\s+(${NUMBER_SOURCE})\\s*(?:de|sobre|/)\\s*10\\b`] },
  { key:"symptom_10", category:"symptom", name:"Intensidad de síntoma", unit:"/10", min:0, max:10, patterns:[`\\b(?:dolor|molestia|s[ií]ntoma)(?:[^.!?\\n]{0,35}?)?(${NUMBER_SOURCE})\\s*(?:de|sobre|/)\\s*10\\b`] },
  { key:"medicine_mg", category:"medication", name:"Dosis mencionada", unit:"mg", min:0, max:100000, patterns:[`\\b(?:tom[eé]|medicamento|pastilla|tableta|c[aá]psula)(?:[^.!?\\n]{0,45}?)?(${NUMBER_SOURCE})\\s*(?:miligramos?|mg)\\b`] }
];

function metricFromMatch(text, phase, spec, match) {
  const sentence = sentenceAt(text, match.index);
  if (isNegatedOrUnrealized(sentence.text, match[0])) return null;
  const value = parseSpanishNumber(match[1]);
  if (!Number.isFinite(value) || value < spec.min || value > spec.max) return null;
  let unit = spec.unit;
  if (spec.unitGroup && match[spec.unitGroup]) unit = stripAccents(match[spec.unitGroup]).replace(/s$/i,"");
  const evidenceStart = sentence.start;
  const evidence = sentence.text;
  const eventPeriod = detectEventPeriod(sentence.text,phase);
  const numericMentions = sentence.text.match(new RegExp(NUMBER_SOURCE,"giu")) || [];
  const conflicting = /\b(?:o\s+(?:quiz[aá]|tal vez)?|entre)\b/i.test(sentence.text) && numericMentions.length > 1;
  return {
    id:`${phase}-${spec.key}-${uuid()}`, key:spec.key, category:spec.category, name:spec.name,
    originalValue:match[1], value, unit, originalUnit:match[spec.unitGroup || 0] || unit,
    capturePhase:phase, eventPeriod, eventDate:eventPeriod === "previous_day" ? shiftDate(state.activeDate || localToday(),-1) : state.activeDate,
    evidenceStart, evidenceEnd:evidenceStart + evidence.length, sourceField:"correctedTranscript",
    provenance:"reported", status:conflicting ? "conflict" : "candidate", extractorVersion:EXTRACTOR_VERSION,
    createdAt:new Date().toISOString()
  };
}

function extractMetrics(text, phase) {
  const results = [];
  const dedupe = new Set();
  METRIC_SPECS.forEach((spec) => spec.patterns.forEach((source) => {
    const regex = new RegExp(source,"giu");
    for (const match of text.matchAll(regex)) {
      const metric = metricFromMatch(text,phase,spec,match);
      if (!metric) continue;
      const signature = `${metric.key}|${metric.value}|${stripAccents(metric.evidence)}`;
      if (!dedupe.has(signature)) { dedupe.add(signature); results.push(metric); }
    }
  }));
  return results;
}

const EVENT_RULES = [
  ["sleep",/dorm|sueñ|sueno|despert|acost|levant/i],
  ["food",/desayun|almor|cen[ée]|com[ií]|merend|snack|alimento|postre|huevo|arroz|pollo|fruta|verdura/i],
  ["drink",/agua|beb[ií]|tom[eé]|caf[eé]|t[eé]|jugo|refresco|vaso|botella/i],
  ["activity",/camin|corr|trot|entren|ejerc|yoga|bicic|nad|pasos|sentad/i],
  ["state",/estr[eé]s|tensi[oó]n|[aá]nimo|energ|cans|fatig|feliz|triste|tranquil|ansios|irrit/i],
  ["symptom",/dolor|molest|s[ií]ntom|mare|n[aá]use|fiebre|tos|migra/i],
  ["medication",/medic|pastill|tableta|c[aá]psul|suplement|vitamina/i],
  ["substance",/alcohol|cerveza|vino|licor|nicotin|cigarr|cafe[ií]na/i],
  ["context",/trabaj|estudi|reuni|famil|amig|pareja|casa|oficina|viaj|clima|tr[aá]fico/i]
];

function splitSentences(text) {
  const rows = [];
  const regex = /[^.!?\n]+[.!?]?/g;
  for (const match of text.matchAll(regex)) {
    const value = match[0].trim();
    if (value) rows.push({ text:value, start:match.index + match[0].indexOf(value), end:match.index + match[0].indexOf(value) + value.length });
  }
  return rows;
}

function extractEvents(text, phase) {
  const events = [];
  splitSentences(text).forEach((sentence) => {
    EVENT_RULES.forEach(([type,pattern]) => {
      if (!pattern.test(sentence.text)) return;
      events.push({ id:`${phase}-event-${type}-${uuid()}`, type, description:sentence.text, evidence:sentence.text, evidenceStart:sentence.start, evidenceEnd:sentence.end, capturePhase:phase, eventPeriod:detectEventPeriod(sentence.text,phase), status:"confirmed", extractorVersion:EXTRACTOR_VERSION });
    });
  });
  return events;
}

function updateCueCoverage() {
  const text = $("transcript").value;
  const config = PHASES[state.activePhase];
  [...config.cues,...config.extras].forEach(([id,,,,pattern]) => {
    const element = document.querySelector(`[data-cue="${id}"]`);
    if (element) element.classList.toggle("covered", pattern.test(text));
  });
}

function coverageFor(text, phase) {
  return [...PHASES[phase].cues,...PHASES[phase].extras].filter((cue) => cue[4].test(text)).map((cue) => cue[0]);
}

function renderCues() {
  const config = PHASES[state.activePhase];
  const cueHtml = ([id,emoji,label,hint]) => `<div class="cue" data-cue="${id}"><span class="cue-emoji">${emoji}</span><span><strong>${escapeHTML(label)}</strong><small>${escapeHTML(hint)}</small></span><span class="cue-state" aria-label="Mencionado">✓</span></div>`;
  $("coreCues").innerHTML = config.cues.map(cueHtml).join("");
  $("extraCues").innerHTML = config.extras.map(cueHtml).join("");
  $("extraCues").classList.remove("visible");
  $("moreCuesBtn").setAttribute("aria-expanded","false");
  $("moreCuesBtn").textContent = "+ Más ideas para recordar";
  updateCueCoverage();
}

function chooseNextPhase(day) {
  return PHASE_ORDER.find((phase) => !["saved","skipped"].includes(day.phases[phase].status)) || "night";
}

async function loadDate(date, preferredPhase = null) {
  if (state.recording) {
    toast("Detén la grabación antes de cambiar de fecha");
    $("entryDate").value = state.activeDate || localToday();
    return;
  }
  clearTimeout(state.draftTimer);
  if (state.day && state.activeDate && state.activeDate !== date) {
    const previousPhase = state.day.phases[state.activePhase];
    previousPhase.draftTranscript = clampText($("transcript").value);
    if (previousPhase.status === "empty" && previousPhase.draftTranscript.trim()) previousPhase.status = "draft";
    await persistCurrentDay("Borrador guardado");
  }
  state.activeDate = date;
  state.day = normalizeDay(await getDay(date) || createDay(date));
  state.activePhase = preferredPhase || chooseNextPhase(state.day);
  $("entryDate").value = date;
  loadActivePhase();
}

function loadActivePhase() {
  const phase = state.day.phases[state.activePhase];
  const config = PHASES[state.activePhase];
  $("mainTitle").textContent = config.mainTitle;
  $("phaseEyebrow").textContent = config.eyebrow;
  $("phaseTitle").textContent = config.title;
  $("phaseDescription").textContent = config.description;
  $("phaseSaveStatus").textContent = phase.status === "saved" ? `Guardado ${formatTime(phase.savedAt)}` : phase.status === "skipped" ? "No registrado" : "Aún no guardado";
  const text = phase.draftTranscript || phase.correctedTranscript || "";
  $("transcript").value = text;
  state.currentInputSource = phase.source || "text";
  $("restoreBtn").hidden = !phase.correctedTranscript || text === phase.correctedTranscript;
  $("reviewArea").classList.remove("visible");
  $("optionalPass").classList.remove("visible");
  state.pendingMetrics = [];
  state.pendingEvents = [];
  renderCues();
  updateProgress();
  setRecordingUI(false);
  $("savePhaseBtn").textContent = `Guardar ${PHASE_LABELS[state.activePhase].toLowerCase()}`;
}

function updateProgress() {
  const activeRecord = state.day.phases[state.activePhase];
  $("phaseSaveStatus").textContent = activeRecord.status === "saved" ? `Guardado ${formatTime(activeRecord.savedAt)}` : activeRecord.status === "skipped" ? "No registrado" : activeRecord.status === "draft" ? "Borrador local" : "Aún no guardado";
  document.querySelectorAll(".phase-step").forEach((button) => {
    const phase = button.dataset.phase;
    const record = state.day.phases[phase];
    const done = ["saved","skipped"].includes(record.status);
    button.classList.toggle("active", phase === state.activePhase);
    button.classList.toggle("done", done);
    button.setAttribute("aria-selected", String(phase === state.activePhase));
    button.querySelector(".phase-state").textContent = record.status === "saved" ? `Guardado ${formatTime(record.savedAt)}` : record.status === "skipped" ? "No registrado" : record.draftTranscript ? "Borrador" : "Pendiente";
  });
  const resolved = PHASE_ORDER.filter((phase) => ["saved","skipped"].includes(state.day.phases[phase].status));
  const complete = resolved.length === 3;
  const finalized = state.day.status === "finalized" && state.day.finalization;
  $("dayStateBadge").textContent = finalized ? `Consolidado · versión ${state.day.finalization.version}` : `${resolved.length} de 3 fases`;
  $("savedPhasesArea").hidden = resolved.length === 0;
  $("savedPhases").innerHTML = resolved.map((phase) => {
    const record = state.day.phases[phase];
    const excerpt = record.status === "skipped" ? "Esta fase fue marcada como no registrada." : record.correctedTranscript;
    return `<div class="saved-phase"><span class="phase-icon">${PHASE_ICONS[phase]}</span><div><strong>${PHASE_LABELS[phase]}</strong><p>${escapeHTML(excerpt || "Sin relato")}</p></div><small>${record.status === "saved" ? `GUARDADO ${formatTime(record.savedAt)}` : "NO REGISTRADO"}</small></div>`;
  }).join("");
  $("finalizeBtn").disabled = !complete || state.finalizing;
  if (finalized) {
    $("finalizeTitle").textContent = "Este día ya está consolidado";
    $("finalizeMessage").textContent = "Puedes revisar el análisis y descargar sus archivos. Si editas una fase, se conservará la versión anterior y tendrás que consolidar de nuevo.";
    $("finalizeBtn").textContent = "Volver a consolidar";
    renderFinalResult(state.day);
  } else if (complete) {
    const incomplete = resolved.some((phase) => state.day.phases[phase].status === "skipped");
    $("finalizeTitle").textContent = incomplete ? "El día está listo, con fases ausentes" : "Las tres fases están listas";
    $("finalizeMessage").textContent = incomplete ? "Puedes consolidar. El informe marcará claramente qué momentos no se registraron." : "Ahora sí: une el relato, verifica las métricas y genera el contexto completo del día.";
    $("finalizeBtn").textContent = "Consolidar mi día";
    $("finalResult").classList.remove("visible");
  } else {
    $("finalizeTitle").textContent = "Tu día se está construyendo";
    $("finalizeMessage").textContent = "Guarda mañana, tarde y noche. Al cerrar la última fase podrás unir los hechos, métricas y contexto sin volver a narrarlos.";
    $("finalizeBtn").textContent = "Consolidar mi día";
    $("finalResult").classList.remove("visible");
  }
}

function queueDraftSave() {
  clearTimeout(state.draftTimer);
  $("autosaveState").textContent = "Guardando borrador…";
  state.draftTimer = setTimeout(async () => {
    state.day.phases[state.activePhase].draftTranscript = clampText($("transcript").value);
    if (state.day.phases[state.activePhase].status === "empty" && $("transcript").value.trim()) state.day.phases[state.activePhase].status = "draft";
    try { await persistCurrentDay("Borrador guardado"); updateProgress(); } catch (_) { /* avisado por persistCurrentDay */ }
  }, 500);
}

async function switchPhase(phase) {
  if (phase === state.activePhase) return;
  clearTimeout(state.draftTimer);
  state.day.phases[state.activePhase].draftTranscript = clampText($("transcript").value);
  if (state.day.phases[state.activePhase].status === "empty" && $("transcript").value.trim()) state.day.phases[state.activePhase].status = "draft";
  await persistCurrentDay("Borrador guardado");
  state.activePhase = phase;
  loadActivePhase();
  window.scrollTo({ top:0, behavior:"smooth" });
}

function prepareReview() {
  const text = $("transcript").value.trim();
  if (!text) { toast("Primero narra o escribe algo de esta fase"); $("transcript").focus(); return; }
  if (state.recording) toggleVoice();
  const saved = state.day.phases[state.activePhase];
  $("correctedTranscript").value = text;
  state.pendingMetrics = extractMetrics(text,state.activePhase).map((metric) => {
    const prior = saved.metrics.find((item) => item.key === metric.key && item.value === metric.value && item.evidence === metric.evidence);
    return prior ? { ...metric, id:prior.id, status:prior.status, provenance:prior.provenance } : metric;
  });
  state.pendingEvents = extractEvents(text,state.activePhase);
  renderMetricReview();
  $("reviewArea").classList.add("visible");
  $("optionalPass").classList.add("visible");
  setTimeout(() => $("reviewArea").scrollIntoView({ behavior:"smooth", block:"start" }),60);
}

function renderMetricReview() {
  const active = state.pendingMetrics.filter((metric) => metric.status !== "rejected").length;
  $("reviewCount").textContent = `${active} ${active === 1 ? "métrica" : "métricas"}`;
  $("confirmAllBtn").hidden = active === 0;
  if (!state.pendingMetrics.length) {
    $("metricList").innerHTML = '<div class="empty-inline">No encontré cifras explícitas. El relato se guardará completo y los campos numéricos quedarán como “no informado”.</div>';
    return;
  }
  $("metricList").innerHTML = state.pendingMetrics.map((metric) => `<div class="metric-row ${metric.status}" data-metric-id="${metric.id}"><div class="metric-name"><strong>${escapeHTML(metric.name)}</strong><small>${escapeHTML(PERIOD_LABELS[metric.eventPeriod] || metric.eventPeriod)} · ${metric.status === "confirmed" || metric.status === "corrected" ? "confirmado" : metric.status === "rejected" ? "descartado" : metric.status === "conflict" ? "posible contradicción" : "por revisar"}</small></div><input class="metric-value" inputmode="decimal" aria-label="Valor de ${escapeHTML(metric.name)}" value="${escapeHTML(String(metric.value).replace(".",","))}" ${metric.status === "rejected" ? "disabled" : ""}><input class="metric-unit" aria-label="Unidad de ${escapeHTML(metric.name)}" value="${escapeHTML(metric.unit)}" ${metric.status === "rejected" ? "disabled" : ""}><div class="evidence">${escapeHTML(metric.evidence)}</div><div class="metric-controls"><button class="mini-btn confirm" type="button" data-action="confirm" title="Confirmar" aria-label="Confirmar ${escapeHTML(metric.name)}">✓</button><button class="mini-btn reject" type="button" data-action="reject" title="Descartar" aria-label="Descartar ${escapeHTML(metric.name)}">×</button></div></div>`).join("");
}

function evidenceSupports(metric, text) {
  const evidence = String(metric.evidence || "");
  if (!evidence || !text.includes(evidence)) return false;
  const numeric = evidence.match(/(?<![\d:])[-+]?\d+(?:[.,]\d+)?(?![\d:])/g) || [];
  if (numeric.some((token) => Math.abs(Number(token.replace(",",".")) - Number(metric.value)) < 1e-9)) return true;
  if (!Number.isInteger(Number(metric.value))) return false;
  const value = Number(metric.value);
  const forms = Object.entries(SMALL_NUMBERS).filter(([,number]) => number === value).map(([word]) => word);
  Object.entries(TENS).forEach(([tenWord,tenValue]) => {
    if (value === tenValue) forms.push(tenWord);
    const unit = value - tenValue;
    if (unit > 0 && unit < 10) Object.entries(SMALL_NUMBERS).filter(([,number]) => number === unit).forEach(([word]) => forms.push(`${tenWord} y ${word}`));
  });
  if (value === 100) forms.push("cien","ciento");
  const normalized = stripAccents(evidence);
  return forms.some((form) => new RegExp(`(?:^|\\s)${form.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:$|\\s|[.,;:])`,"u").test(normalized));
}

function reanchorMetric(metric) {
  const text = $("correctedTranscript").value;
  const candidates = extractMetrics(text,state.activePhase);
  const exact = candidates.find((item) => item.key === metric.key && Number(item.value) === Number(metric.value));
  if (!exact) return false;
  if (stripAccents(metric.unit).trim() !== stripAccents(exact.unit).trim()) return false;
  Object.assign(metric,{ evidence:exact.evidence, evidenceStart:exact.evidenceStart, evidenceEnd:exact.evidenceEnd, sourceField:"correctedTranscript" });
  return evidenceSupports(metric,text);
}

function invalidateMetricsAfterTranscriptEdit() {
  let changed = false;
  state.pendingMetrics.forEach((metric) => {
    if (["confirmed","corrected"].includes(metric.status)) { metric.status = "candidate"; changed = true; }
  });
  if (changed) renderMetricReview();
}

function handleMetricClick(event) {
  const button = event.target.closest("[data-action]");
  const row = event.target.closest("[data-metric-id]");
  if (!button || !row) return;
  const metric = state.pendingMetrics.find((item) => item.id === row.dataset.metricId);
  if (!metric) return;
  if (button.dataset.action === "reject") {
    metric.status = "rejected";
    metric.rejectionReason = "Descartada por el usuario";
    renderMetricReview();
    return;
  }
  if (metric.status === "conflict") { toast("Corrige la contradicción en el texto y vuelve a revisar antes de confirmar"); return; }
  if (!reanchorMetric(metric)) { toast("La cifra debe aparecer en la transcripción corregida con su contexto"); return; }
  metric.status = metric.provenance === "corrected" ? "corrected" : "confirmed";
  metric.confirmedAt = new Date().toISOString();
  renderMetricReview();
}

function handleMetricInput(event) {
  const row = event.target.closest("[data-metric-id]");
  if (!row) return;
  const metric = state.pendingMetrics.find((item) => item.id === row.dataset.metricId);
  if (!metric) return;
  if (event.target.classList.contains("metric-value")) {
    const value = Number(event.target.value.replace(",","."));
    if (Number.isFinite(value)) metric.value = value;
  }
  if (event.target.classList.contains("metric-unit")) metric.unit = event.target.value.trim();
  metric.provenance = "corrected";
  metric.status = "candidate";
}

function confirmAllMetrics() {
  let confirmed = 0;
  state.pendingMetrics.forEach((metric) => {
    if (["rejected","conflict"].includes(metric.status)) return;
    if (reanchorMetric(metric)) { metric.status = metric.provenance === "corrected" ? "corrected" : "confirmed"; metric.confirmedAt = new Date().toISOString(); confirmed += 1; }
  });
  renderMetricReview();
  toast(confirmed ? `${confirmed} métricas confirmadas` : "No había métricas válidas para confirmar");
}

function invalidateFinalizationIfNeeded(day) {
  if (!day.finalization) return;
  day.previousFinalizations = [...(day.previousFinalizations || []),day.finalization].slice(-10);
  day.finalization = null;
  day.status = "draft";
}

async function savePhase() {
  if (state.savingPhase) return;
  const corrected = $("correctedTranscript").value.trim();
  if (!corrected) { toast("La transcripción corregida no puede quedar vacía"); return; }
  state.pendingMetrics.forEach((metric) => {
    if (["confirmed","corrected"].includes(metric.status) && !evidenceSupports(metric,corrected)) metric.status = "candidate";
  });
  const unresolved = state.pendingMetrics.filter((metric) => metric.status === "candidate");
  if (unresolved.length) { renderMetricReview(); toast(`Confirma o descarta ${unresolved.length === 1 ? "la cifra pendiente" : `las ${unresolved.length} cifras pendientes`}`); return; }
  state.savingPhase = true;
  const beforeSave = deepClone(state.day);
  clearTimeout(state.draftTimer);
  $("savePhaseBtn").disabled = true;
  const phase = state.day.phases[state.activePhase];
  const previous = phase.status === "saved" ? { revision:phase.revision, rawTranscript:phase.rawTranscript, correctedTranscript:phase.correctedTranscript, metrics:phase.metrics, events:phase.events, savedAt:phase.savedAt } : null;
  const now = new Date().toISOString();
  const rawInput = $("transcript").value.trim();
  invalidateFinalizationIfNeeded(state.day);
  phase.status = "saved";
  phase.rawTranscript = phase.rawTranscript || rawInput;
  phase.correctedTranscript = corrected;
  phase.draftTranscript = corrected;
  phase.capturedAt = phase.capturedAt || now;
  phase.savedAt = now;
  phase.source = state.currentInputSource;
  phase.metrics = deepClone(state.pendingMetrics);
  phase.events = extractEvents(corrected,state.activePhase);
  phase.cueCoverage = coverageFor(corrected,state.activePhase);
  phase.revision = Number(phase.revision || 0) + 1;
  if (previous) phase.revisions = [...(phase.revisions || []),previous].slice(-10);
  state.day.revision = Number(state.day.revision || 0) + 1;
  try {
    await persistCurrentDay("Fase guardada");
    $("reviewArea").classList.remove("visible");
    $("optionalPass").classList.remove("visible");
    updateProgress();
    const next = PHASE_ORDER.find((item,index) => index > PHASE_ORDER.indexOf(state.activePhase) && !["saved","skipped"].includes(state.day.phases[item].status));
    toast(`${PHASE_LABELS[state.activePhase]} guardada en este dispositivo`);
    if (next) setTimeout(() => switchPhase(next),450);
  } catch (_) {
    state.day = beforeSave;
    updateProgress();
    toast("La fase no pudo guardarse; conserva una copia del texto");
  } finally {
    state.savingPhase = false;
    $("savePhaseBtn").disabled = false;
  }
}

async function skipCurrentPhase() {
  const accepted = await showConfirm("Marcar fase no registrada",`Se conservará como ausente y el informe final indicará que no hubo registro de ${PHASE_LABELS[state.activePhase].toLowerCase()}.`,"Marcar como ausente");
  if (!accepted) return;
  invalidateFinalizationIfNeeded(state.day);
  const phase = state.day.phases[state.activePhase];
  const now = new Date().toISOString();
  phase.status = "skipped";
  phase.draftTranscript = "";
  phase.rawTranscript = "";
  phase.correctedTranscript = "";
  phase.metrics = [];
  phase.events = [];
  phase.cueCoverage = [];
  phase.capturedAt = now;
  phase.savedAt = now;
  phase.revision = Number(phase.revision || 0) + 1;
  await persistCurrentDay("Fase marcada como ausente");
  $("reviewArea").classList.remove("visible");
  updateProgress();
  const next = chooseNextPhase(state.day);
  if (next !== state.activePhase) setTimeout(() => switchPhase(next),350);
}

function confirmedMetrics(day) {
  return PHASE_ORDER.flatMap((phase) => day.phases[phase].metrics || []).filter((metric) => ["confirmed","corrected"].includes(metric.status) && Number.isFinite(Number(metric.value)));
}

function currentDayMetrics(day) {
  return confirmedMetrics(day).filter((metric) => !["previous_day","habitual"].includes(metric.eventPeriod));
}

function allEvents(day) {
  return PHASE_ORDER.flatMap((phase) => day.phases[phase].events || []).filter((event) => event.status !== "rejected");
}

function buildLocalAnalysis(day) {
  const metrics = currentDayMetrics(day);
  const events = allEvents(day);
  const saved = PHASE_ORDER.filter((phase) => day.phases[phase].status === "saved");
  const skipped = PHASE_ORDER.filter((phase) => day.phases[phase].status === "skipped");
  const facts = [];
  saved.forEach((phase) => {
    const sentences = splitSentences(day.phases[phase].correctedTranscript).slice(0,8);
    sentences.forEach((sentence,index) => facts.push({ id:`fact-${phase}-${index + 1}`, period:detectEventPeriod(sentence.text,phase), statement:sentence.text, evidence:sentence.text }));
  });
  const calculations = [];
  const aggregatable = [
    { keys:["water_l"], name:"Volumen reportado en litros", unit:"L" },
    { keys:["water_ml"], name:"Volumen reportado en mililitros", unit:"ml" },
    { keys:["activity_minutes"], name:"Minutos de actividad reportados", unit:"min" },
    { keys:["activity_distance"], name:"Distancia de actividad reportada", unit:"km" }
  ];
  aggregatable.forEach((group) => {
    const source = metrics.filter((metric) => group.keys.includes(metric.key) && metric.unit === group.unit);
    const unique = source.filter((metric,index,array) => array.findIndex((other) => stripAccents(other.evidence) === stripAccents(metric.evidence) && other.value === metric.value) === index);
    if (unique.length > 1) calculations.push({ id:`calc-${group.keys[0]}`, name:group.name, value:Math.round(unique.reduce((sum,item) => sum + Number(item.value),0) * 1000) / 1000, unit:group.unit, operation:"sum", formula:`suma(${unique.map((item) => item.id).join(", ")})`, sourceMetricIds:unique.map((item) => item.id) });
  });
  const patterns = [];
  const stress = metrics.filter((metric) => metric.key === "stress_10");
  if (stress.length > 1) patterns.push({ id:"pattern-stress", statement:`El estrés reportado cambió dentro del día entre ${Math.min(...stress.map((item) => item.value))}/10 y ${Math.max(...stress.map((item) => item.value))}/10.`, sourceFactIds:[], sourceMetricIds:stress.map((item) => item.id), scope:"within_day" });
  const energy = metrics.filter((metric) => metric.key === "energy_10");
  if (energy.length > 1) patterns.push({ id:"pattern-energy", statement:`La energía reportada varió entre ${Math.min(...energy.map((item) => item.value))}/10 y ${Math.max(...energy.map((item) => item.value))}/10.`, sourceFactIds:[], sourceMetricIds:energy.map((item) => item.id), scope:"within_day" });
  const activityEvents = events.filter((event) => event.type === "activity");
  const stateEvents = events.filter((event) => event.type === "state");
  if (activityEvents.length && stateEvents.length) patterns.push({ id:"pattern-activity-state", statement:"En el relato aparecen tanto actividad o movimiento como cambios de ánimo, energía o estrés; coinciden en el mismo día, sin que esto demuestre una causa.", sourceFactIds:[], sourceMetricIds:metrics.filter((item) => ["activity_minutes","stress_10","mood_10","energy_10"].includes(item.key)).map((item) => item.id), scope:"within_day" });
  const hypotheses = [];
  if (patterns.length) hypotheses.push({ id:"hypothesis-followup", statement:"Podría ser útil observar durante varios días si estas coincidencias se repiten antes de interpretarlas como un patrón personal.", sourceFactIds:[], sourceMetricIds:patterns.flatMap((item) => item.sourceMetricIds), needsConfirmation:true });
  const conflicts = PHASE_ORDER.flatMap((phase) => day.phases[phase].metrics || []).filter((metric) => metric.status === "conflict").map((metric) => ({ description:`Hay valores alternativos para ${metric.name}; no se usaron en cálculos ni resúmenes.`, evidence:[metric.evidence] }));
  const missing = [];
  skipped.forEach((phase) => missing.push(`No hubo registro de ${PHASE_LABELS[phase].toLowerCase()}.`));
  PHASE_ORDER.forEach((phase) => {
    if (day.phases[phase].status !== "saved") return;
    const notCovered = PHASES[phase].cues.filter((cue) => !day.phases[phase].cueCoverage.includes(cue[0])).map((cue) => cue[2]);
    if (notCovered.length) missing.push(`${PHASE_LABELS[phase]}: no se mencionó ${notCovered.join(", ").toLowerCase()}. Esto significa “no informado”, no ausencia del hecho.`);
  });
  const summary = skipped.length ? `Se consolidó un día incompleto con ${saved.length} ${saved.length === 1 ? "fase narrada" : "fases narradas"} y ${metrics.length} ${metrics.length === 1 ? "métrica confirmada" : "métricas confirmadas"}.` : `Se integraron las tres fases del día con ${metrics.length} ${metrics.length === 1 ? "métrica confirmada" : "métricas confirmadas"}, manteniendo separados hechos e interpretaciones.`;
  return {
    schemaVersion:"1.0", summary,
    timeline:saved.map((phase) => ({ period:phase, overview:day.phases[phase].correctedTranscript })),
    reportedFacts:facts, calculatedMetrics:calculations, observedPatterns:patterns, hypotheses,
    conflicts, missingInformation:missing,
    safetyNote:"Análisis orientativo de bienestar; no constituye un diagnóstico médico."
  };
}

function sanitizeDayForAnalysis(day) {
  return {
    schemaVersion:"1.0", date:day.date, timezone:day.timezone,
    phases:Object.fromEntries(PHASE_ORDER.map((phase) => {
      const item = day.phases[phase];
      const metrics = (item.metrics || []).map((metric) => ["previous_day","habitual"].includes(metric.eventPeriod) ? { ...metric, status:"candidate" } : metric);
      return [phase,{ status:item.status, capturedAt:item.capturedAt, source:item.source, rawTranscript:item.rawTranscript, correctedTranscript:item.correctedTranscript, metrics, events:item.events }];
    }))
  };
}

function analysisLooksSafe(analysis, day) {
  if (!analysis || typeof analysis !== "object" || !String(analysis.summary || "").trim()) return false;
  const corpus = PHASE_ORDER.flatMap((phase) => [day.phases[phase].rawTranscript,day.phases[phase].correctedTranscript]).filter(Boolean).map(stripAccents);
  return (analysis.reportedFacts || []).every((fact) => fact.evidence && corpus.some((text) => text.includes(stripAccents(fact.evidence))));
}

async function requestAdvancedAnalysis(day) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),45000);
  try {
    const response = await fetch("/api/analyze",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ day:sanitizeDayForAnalysis(day) }), cache:"no-store", signal:controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "El análisis avanzado no respondió");
    if (!analysisLooksSafe(payload.analysis,day)) throw new Error("El análisis no pasó la verificación de evidencia");
    return { analysis:payload.analysis, engine:"advanced", model:payload.model || state.analysisModel || "configurado" };
  } finally { clearTimeout(timer); }
}

async function finalizeDay() {
  if (state.finalizing) return;
  const resolved = PHASE_ORDER.every((phase) => ["saved","skipped"].includes(state.day.phases[phase].status));
  if (!resolved) { toast("Primero guarda o marca como ausentes las tres fases"); return; }
  const incomplete = PHASE_ORDER.some((phase) => state.day.phases[phase].status === "skipped");
  if (incomplete) {
    const accepted = await showConfirm("Consolidar un día incompleto","El informe señalará claramente las fases no registradas y no inventará ningún dato.","Consolidar igualmente");
    if (!accepted) return;
  }
  state.finalizing = true;
  const beforeFinalization = deepClone(state.day);
  $("finalizeBtn").disabled = true;
  $("finalizeBtn").textContent = "Analizando…";
  try {
    let result = { analysis:buildLocalAnalysis(state.day), engine:"local", model:"reglas verificables" };
    if (state.aiConfigured && state.externalConsent) {
      try { result = await requestAdvancedAnalysis(state.day); }
      catch (_) { toast("El análisis avanzado no estuvo disponible; usé el modo local seguro"); }
    }
    const previousVersion = Math.max(0,...(state.day.previousFinalizations || []).map((item) => Number(item.version || 0)),Number(state.day.finalization?.version || 0));
    if (state.day.finalization) state.day.previousFinalizations = [...(state.day.previousFinalizations || []),deepClone(state.day.finalization)].slice(-10);
    state.day.finalization = { version:previousVersion + 1, createdAt:new Date().toISOString(), analysisVersion:ANALYSIS_VERSION, engine:result.engine, model:result.model, complete:!incomplete, phaseRevisions:Object.fromEntries(PHASE_ORDER.map((phase) => [phase,state.day.phases[phase].revision])), analysis:result.analysis };
    state.day.status = "finalized";
    state.day.revision = Number(state.day.revision || 0) + 1;
    await persistCurrentDay("Día consolidado");
    toast("Día consolidado. Los archivos finales ya están listos.");
    setTimeout(() => $("finalResult").scrollIntoView({ behavior:"smooth", block:"start" }),80);
  } catch (_) {
    state.day = beforeFinalization;
    toast("No fue posible guardar la consolidación. Tus tres fases siguen intactas.");
  } finally {
    state.finalizing = false;
    updateProgress();
  }
}

function listItems(items, mapper, empty = "Sin elementos para mostrar.") {
  if (!items?.length) return `<p class="hint">${escapeHTML(empty)}</p>`;
  return `<ul>${items.map((item) => `<li>${mapper(item)}</li>`).join("")}</ul>`;
}

function renderFinalResult(day) {
  const finalization = day.finalization;
  if (!finalization?.analysis) { $("finalResult").classList.remove("visible"); return; }
  const analysis = finalization.analysis;
  $("analysisTitle").textContent = `Contexto del ${formatDate(day.date)}`;
  $("analysisSummary").textContent = analysis.summary;
  $("analysisEngine").textContent = finalization.engine === "advanced" ? "Análisis avanzado verificado" : "Análisis local verificable";
  const sections = [
    ["Cronología",analysis.timeline,(item) => `<strong>${escapeHTML(PHASE_LABELS[item.period] || item.period)}:</strong> ${escapeHTML(item.overview)}`],
    ["Hechos declarados",analysis.reportedFacts,(item) => `${escapeHTML(item.statement)} <span class="analysis-tag">declarado</span>`],
    ["Cálculos reproducibles",analysis.calculatedMetrics,(item) => `${escapeHTML(item.name)}: <strong>${escapeHTML(item.value)} ${escapeHTML(item.unit)}</strong> · ${escapeHTML(item.formula)} <span class="analysis-tag">calculado</span>`],
    ["Patrones observados",analysis.observedPatterns,(item) => `${escapeHTML(item.statement)} <span class="analysis-tag">observación</span>`],
    ["Hipótesis por confirmar",analysis.hypotheses,(item) => `${escapeHTML(item.statement)} <span class="analysis-tag">no causal</span>`],
    ["Contradicciones",analysis.conflicts,(item) => `${escapeHTML(item.description)}${item.evidence?.length ? ` · ${escapeHTML(item.evidence.join(" / "))}` : ""}`],
    ["No informado o ambiguo",analysis.missingInformation,(item) => escapeHTML(item)]
  ];
  $("analysisSections").innerHTML = sections.map(([title,items,mapper]) => `<section class="analysis-section"><h3>${title}</h3>${listItems(items,mapper)}</section>`).join("");
  $("finalResult").classList.add("visible");
}

function finalizedDays(selection = null) {
  const days = state.days.filter((day) => day.status === "finalized" && day.finalization).sort((a,b) => a.date.localeCompare(b.date));
  return selection ? days.filter((day) => selection.includes(day.date)) : days;
}

function metricPills(day) {
  return currentDayMetrics(day).slice(0,12).map((metric) => `<span class="pill">${escapeHTML(metric.name)}: ${escapeHTML(metric.value)} ${escapeHTML(metric.unit)}</span>`).join("");
}

function renderHistory() {
  const days = [...state.days].sort((a,b) => b.date.localeCompare(a.date));
  $("historyEmpty").hidden = days.length > 0;
  $("entriesList").innerHTML = days.map((day,index) => {
    const finalization = day.finalization;
    const phases = PHASE_ORDER.map((phase) => {
      const record = day.phases[phase];
      const text = record.status === "skipped" ? "No registrado" : record.correctedTranscript || record.draftTranscript || "Sin información";
      return `<div class="entry-block"><strong>${PHASE_ICONS[phase]} ${PHASE_LABELS[phase]}</strong><p>${escapeHTML(text)}</p></div>`;
    }).join("");
    const resolved = PHASE_ORDER.filter((phase) => ["saved","skipped"].includes(day.phases[phase].status)).length;
    const meta = finalization ? `Versión ${finalization.version} · ${finalization.complete ? "día completo" : "día incompleto"} · ${currentDayMetrics(day).length} métricas confirmadas` : `En progreso · ${resolved} de 3 fases resueltas`;
    const analysis = finalization ? `<div class="entry-analysis"><strong>Resumen analítico</strong><br>${escapeHTML(finalization.analysis.summary)}</div>` : '<div class="entry-analysis"><strong>Aún no consolidado</strong><br>Hay información en progreso, pero todavía no existe un contexto ni un Excel final.</div>';
    const download = finalization ? `<button class="linkbtn" type="button" data-export-day="${day.date}">Descargar archivos</button>` : "";
    return `<details class="card entry" ${index === 0 ? "open" : ""}><summary><div><div class="entry-date">${escapeHTML(formatDate(day.date))}</div><div class="entry-meta">${escapeHTML(meta)}</div></div><span class="entry-arrow">⌄</span></summary><div class="entry-body"><div class="entry-grid">${phases}</div><div class="metric-pills">${metricPills(day)}</div>${analysis}<div class="entry-foot"><div><button class="linkbtn" type="button" data-open-day="${day.date}">Abrir este día</button> ${download}</div><button class="textbtn" type="button" data-delete-day="${day.date}">Eliminar este día</button></div></div></details>`;
  }).join("");
}

async function openHistoryDay(date) {
  const saved = state.days.find((day) => day.date === date);
  await loadDate(date,saved?.finalization ? "night" : null);
  switchTab("registrar");
  renderFinalResult(state.day);
}

async function deleteHistoryDay(date) {
  const accepted = await showConfirm("Eliminar el día",`Se eliminará permanentemente el registro del ${formatDate(date)} y todas sus versiones locales.`,"Eliminar");
  if (!accepted) return;
  await deleteDayFromDb(date);
  state.days = state.days.filter((day) => day.date !== date);
  if (state.activeDate === date) { state.day = null; state.activeDate = null; await loadDate(localToday()); }
  renderHistory();
  toast("El día fue eliminado del dispositivo");
}

function buildContextText(days) {
  const lines = ["MI DÍA · BITÁCORA PERSONAL DE BIENESTAR","==========================================",`Generada: ${new Date().toLocaleString("es-CO")}`,`Versión del esquema: ${APP_SCHEMA_VERSION}`,""];
  if (state.profile.name || state.profile.age || state.profile.goal) lines.push("PERFIL OPCIONAL",`Nombre: ${state.profile.name || "No indicado"}`,`Edad: ${state.profile.age || "No indicada"}`,`Área de observación: ${state.profile.goal || "Bienestar general"}`,"");
  days.forEach((day) => {
    const finalization = day.finalization;
    const analysis = finalization.analysis;
    lines.push(`# ${formatDate(day.date).toUpperCase()}`,`Fecha: ${day.date}`,`Zona horaria: ${day.timezone}`,`Estado: ${finalization.complete ? "Completo" : "Incompleto"}`,`Versión final: ${finalization.version}`,`Consolidado: ${new Date(finalization.createdAt).toLocaleString("es-CO")}`,"");
    lines.push("1. RELATOS ORIGINALES");
    PHASE_ORDER.forEach((phase) => lines.push(`\n${PHASE_LABELS[phase].toUpperCase()} (${day.phases[phase].status})`,day.phases[phase].rawTranscript || "No registrado"));
    lines.push("","2. TRANSCRIPCIONES CORREGIDAS");
    PHASE_ORDER.forEach((phase) => lines.push(`\n${PHASE_LABELS[phase].toUpperCase()}`,day.phases[phase].correctedTranscript || "No registrado"));
    lines.push("","3. RESUMEN ANALÍTICO",analysis.summary || "Sin resumen","");
    lines.push("4. HECHOS DECLARADOS");
    (analysis.reportedFacts || []).forEach((item) => lines.push(`- [${PERIOD_LABELS[item.period] || item.period}] ${item.statement} | Evidencia: “${item.evidence}”`));
    if (!(analysis.reportedFacts || []).length) lines.push("- Sin hechos estructurados.");
    lines.push("","5. MÉTRICAS CONFIRMADAS");
    const metrics = currentDayMetrics(day);
    metrics.forEach((item) => lines.push(`- ${item.name}: ${item.value} ${item.unit} | ${PERIOD_LABELS[item.eventPeriod] || item.eventPeriod} | Evidencia: “${item.evidence}” | Procedencia: ${item.provenance}`));
    if (!metrics.length) lines.push("- Sin métricas confirmadas.");
    lines.push("","6. CÁLCULOS REPRODUCIBLES");
    (analysis.calculatedMetrics || []).forEach((item) => lines.push(`- ${item.name}: ${item.value} ${item.unit} | Fórmula: ${item.formula}`));
    if (!(analysis.calculatedMetrics || []).length) lines.push("- Sin cálculos disponibles.");
    lines.push("","7. PATRONES OBSERVADOS");
    (analysis.observedPatterns || []).forEach((item) => lines.push(`- ${item.statement}`));
    if (!(analysis.observedPatterns || []).length) lines.push("- No se establecieron patrones con este día.");
    lines.push("","8. HIPÓTESIS POR CONFIRMAR");
    (analysis.hypotheses || []).forEach((item) => lines.push(`- ${item.statement}`));
    if (!(analysis.hypotheses || []).length) lines.push("- Sin hipótesis.");
    lines.push("","9. CONTRADICCIONES");
    (analysis.conflicts || []).forEach((item) => lines.push(`- ${item.description}`));
    if (!(analysis.conflicts || []).length) lines.push("- No se detectaron contradicciones explícitas.");
    lines.push("","10. NO INFORMADO O AMBIGUO");
    (analysis.missingInformation || []).forEach((item) => lines.push(`- ${item}`));
    if (!(analysis.missingInformation || []).length) lines.push("- Sin observaciones adicionales.");
    lines.push("",`AVISO: ${analysis.safetyNote || "Este documento no constituye un diagnóstico médico."}`,"","------------------------------------------------------------","");
  });
  return lines.join("\r\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^a-zA-Z0-9._-]/g,"-");
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1200);
}

function requireFinalized(days) {
  if (!days.length) { toast("Consolida al menos un día antes de exportar"); return false; }
  return true;
}

function exportText(days, suffix) {
  if (!requireFinalized(days)) return;
  downloadBlob(new Blob(["\ufeff",buildContextText(days)],{ type:"text/plain;charset=utf-8" }),`contexto-mi-dia-${suffix}.txt`);
  toast("Contexto preparado en formato TXT");
}

function spreadsheetSafe(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function xmlEscape(value) {
  return spreadsheetSafe(value).replace(/[<>&'"\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,(char) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[char] || ""));
}

function colName(index) {
  let name = "";
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26)) name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function splitCellText(value) {
  const text = String(value ?? "");
  if (text.length <= 32000) return text;
  return `${text.slice(0,31920)}\n[Texto truncado en esta celda; consulte la hoja Contexto_fases o el respaldo JSON.]`;
}

function sheetXml(rows, widths) {
  const data = rows.map((row,rowIndex) => `<row r="${rowIndex + 1}">${row.map((value,columnIndex) => {
    const ref = `${colName(columnIndex)}${rowIndex + 1}`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${rowIndex === 0 ? ' s="1"' : ""}><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${rowIndex === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(splitCellText(value))}</t></is></c>`;
  }).join("")}</row>`).join("");
  const cols = widths.map((width,index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const last = colName(Math.max(0,rows[0].length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${data}</sheetData><autoFilter ref="A1:${last}${rows.length}"/></worksheet>`;
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) crcTable = Array.from({ length:256 },(_,number) => { let value = number; for (let bit=0;bit<8;bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1); return value >>> 0; });
  let crc = 0xffffffff;
  bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view,offset,value) { view.setUint16(offset,value,true); }
function write32(view,offset,value) { view.setUint32(offset,value >>> 0,true); }
function concatBytes(parts) { const result = new Uint8Array(parts.reduce((sum,part) => sum + part.length,0)); let offset = 0; parts.forEach((part) => { result.set(part,offset); offset += part.length; }); return result; }

function zipFiles(files) {
  const encoder = new TextEncoder(); const locals = []; const centrals = []; let offset = 0; const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds()/2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth()+1) << 5) | now.getDate();
  Object.entries(files).forEach(([path,content]) => {
    const name = encoder.encode(path); const bytes = typeof content === "string" ? encoder.encode(content) : content; const crc = crc32(bytes);
    const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
    write32(lv,0,0x04034b50); write16(lv,4,20); write16(lv,6,0); write16(lv,8,0); write16(lv,10,dosTime); write16(lv,12,dosDate); write32(lv,14,crc); write32(lv,18,bytes.length); write32(lv,22,bytes.length); write16(lv,26,name.length); write16(lv,28,0); local.set(name,30); locals.push(local,bytes);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    write32(cv,0,0x02014b50); write16(cv,4,20); write16(cv,6,20); write16(cv,8,0); write16(cv,10,0); write16(cv,12,dosTime); write16(cv,14,dosDate); write32(cv,16,crc); write32(cv,20,bytes.length); write32(cv,24,bytes.length); write16(cv,28,name.length); write16(cv,30,0); write16(cv,32,0); write16(cv,34,0); write16(cv,36,0); write32(cv,38,0); write32(cv,42,offset); central.set(name,46); centrals.push(central); offset += local.length + bytes.length;
  });
  const centralSize = centrals.reduce((sum,part) => sum + part.length,0); const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  write32(ev,0,0x06054b50); write16(ev,4,0); write16(ev,6,0); write16(ev,8,centrals.length); write16(ev,10,centrals.length); write32(ev,12,centralSize); write32(ev,16,offset); write16(ev,20,0);
  return concatBytes([...locals,...centrals,end]);
}

function buildWorkbookSheets(days) {
  const summary = [["Fecha","Nombre","Edad","Área de observación","Zona horaria","Estado","Versión final","Mañana","Tarde","Noche","Métricas confirmadas","Motor de análisis","Consolidado"]];
  const phaseRows = [["Fecha","Fase","Estado","Capturado","Guardado","Fuente","Relato original","Transcripción corregida","Pistas mencionadas","Revisión"]];
  const metricRows = [["Fecha del registro","Fecha del evento","ID","Categoría","Métrica","Valor original","Valor confirmado","Unidad","Fase de captura","Periodo del evento","Evidencia exacta","Campo fuente","Procedencia","Estado","Versión extractor"]];
  const sleepRows = [["Fecha","Fase captura","Periodo evento","Métrica","Valor","Unidad","Evidencia","Estado"]];
  const foodRows = [["Fecha","Fase captura","Periodo evento","Tipo","Descripción declarada","Evidencia"]];
  const activityRows = [["Fecha","Fase captura","Periodo evento","Tipo","Descripción o métrica","Valor","Unidad","Evidencia"]];
  const stateRows = [["Fecha","Fase captura","Periodo evento","Tipo","Descripción o métrica","Valor","Unidad","Evidencia"]];
  const medicineRows = [["Fecha","Fase captura","Periodo evento","Tipo","Descripción o métrica","Valor","Unidad","Evidencia"]];
  const analysisRows = [["Fecha","Capa","ID","Periodo","Descripción","Valor","Unidad","Evidencia o fórmula","Referencias"]];
  const traceRows = [["Fecha","Objeto","ID","Fase captura","Periodo evento","Inicio evidencia","Fin evidencia","Procedencia","Estado","Versión","Evidencia"]];
  days.forEach((day) => {
    const finalization = day.finalization;
    summary.push([day.date,state.profile.name || "",state.profile.age === "" ? "" : Number(state.profile.age),state.profile.goal || "Bienestar general",day.timezone,finalization.complete ? "Completo" : "Incompleto",finalization.version,...PHASE_ORDER.map((phase) => day.phases[phase].status),currentDayMetrics(day).length,finalization.engine,finalization.createdAt]);
    PHASE_ORDER.forEach((phase) => {
      const record = day.phases[phase];
      phaseRows.push([day.date,PHASE_LABELS[phase],record.status,record.capturedAt || "",record.savedAt || "",record.source || "",record.rawTranscript || "",record.correctedTranscript || "",(record.cueCoverage || []).join(", "),record.revision || 0]);
      (record.metrics || []).forEach((metric) => {
        traceRows.push([day.date,"Métrica",metric.id,metric.capturePhase,metric.eventPeriod,metric.evidenceStart ?? "",metric.evidenceEnd ?? "",metric.provenance,metric.status,metric.extractorVersion,metric.evidence]);
        if (!["confirmed","corrected"].includes(metric.status)) return;
        metricRows.push([day.date,metric.eventDate || day.date,metric.id,metric.category,metric.name,metric.originalValue ?? "",Number.isFinite(Number(metric.value)) ? Number(metric.value) : "",metric.unit,PHASE_LABELS[metric.capturePhase] || metric.capturePhase,PERIOD_LABELS[metric.eventPeriod] || metric.eventPeriod,metric.evidence,metric.sourceField,metric.provenance,metric.status,metric.extractorVersion]);
        const common = [day.date,PHASE_LABELS[metric.capturePhase] || metric.capturePhase,PERIOD_LABELS[metric.eventPeriod] || metric.eventPeriod];
        if (metric.category === "sleep") sleepRows.push([...common,metric.name,Number(metric.value),metric.unit,metric.evidence,metric.status]);
        if (metric.category === "activity") activityRows.push([...common,"Métrica",metric.name,Number(metric.value),metric.unit,metric.evidence]);
        if (["state","symptom"].includes(metric.category)) stateRows.push([...common,metric.category,metric.name,Number(metric.value),metric.unit,metric.evidence]);
        if (metric.category === "medication") medicineRows.push([...common,"Métrica",metric.name,Number(metric.value),metric.unit,metric.evidence]);
      });
      (record.events || []).forEach((event) => {
        traceRows.push([day.date,"Evento",event.id,event.capturePhase,event.eventPeriod,event.evidenceStart ?? "",event.evidenceEnd ?? "","reported",event.status,event.extractorVersion,event.evidence]);
        const common = [day.date,PHASE_LABELS[event.capturePhase] || event.capturePhase,PERIOD_LABELS[event.eventPeriod] || event.eventPeriod];
        if (["food","drink"].includes(event.type)) foodRows.push([...common,event.type,event.description,event.evidence]);
        if (event.type === "activity") activityRows.push([...common,"Evento",event.description,"","",event.evidence]);
        if (["state","symptom"].includes(event.type)) stateRows.push([...common,event.type,event.description,"","",event.evidence]);
        if (["medication","substance"].includes(event.type)) medicineRows.push([...common,event.type,event.description,"","",event.evidence]);
      });
    });
    const analysis = finalization.analysis;
    (analysis.reportedFacts || []).forEach((item) => analysisRows.push([day.date,"Hecho declarado",item.id,item.period,item.statement,"","",item.evidence,""]));
    (analysis.calculatedMetrics || []).forEach((item) => analysisRows.push([day.date,"Cálculo",item.id,"all_day",item.name,item.value,item.unit,item.formula,(item.sourceMetricIds || []).join(", ")]));
    (analysis.observedPatterns || []).forEach((item) => analysisRows.push([day.date,"Patrón observado",item.id,"all_day",item.statement,"","","",[...(item.sourceFactIds || []),...(item.sourceMetricIds || [])].join(", ")]));
    (analysis.hypotheses || []).forEach((item) => analysisRows.push([day.date,"Hipótesis por confirmar",item.id,"all_day",item.statement,"","","",[...(item.sourceFactIds || []),...(item.sourceMetricIds || [])].join(", ")]));
    (analysis.conflicts || []).forEach((item,index) => analysisRows.push([day.date,"Contradicción",`conflict-${index + 1}`,"unspecified",item.description,"","",(item.evidence || []).join(" / "),""]));
    (analysis.missingInformation || []).forEach((item,index) => analysisRows.push([day.date,"No informado",`missing-${index + 1}`,"unspecified",item,"","","",""]));
  });
  const dictionary = [
    ["Campo o concepto","Definición","Regla de uso"],
    ["Estado empty/draft/saved/skipped","Estado de cada fase","Skipped significa no registrado; nunca equivale a cero"],
    ["Fase de captura","Momento en que la persona habló","Puede diferir del periodo real del evento"],
    ["Periodo del evento","Momento al que se refiere el dato","El sueño narrado por la mañana puede pertenecer a la noche anterior"],
    ["Valor original","Número tal como fue detectado","Se conserva para trazabilidad"],
    ["Valor confirmado","Número revisado por la persona","Solo confirmed/corrected alimenta resúmenes"],
    ["Procedencia reported","Dato dicho por la persona","Debe tener evidencia textual exacta"],
    ["Procedencia corrected","Dato ajustado manualmente","La corrección debe aparecer en la transcripción corregida"],
    ["Procedencia calculated","Operación reproducible","Incluye fórmula e identificadores fuente"],
    ["Candidate","Pendiente de confirmar","No se trata como hecho ni entra en resúmenes"],
    ["Rejected","Descartado por la persona","Solo aparece en trazabilidad"],
    ["Conflict","Valores incompatibles","No se promedian automáticamente"],
    ["No informado","No existe un dato respaldado","Se exporta vacío, nunca como 0"],
    ["Hecho declarado","Resumen respaldado por una cita literal","No añade información nueva"],
    ["Patrón observado","Coincidencia o cambio descriptivo","No implica causalidad"],
    ["Hipótesis por confirmar","Posibilidad para observar en el futuro","No es diagnóstico ni conclusión"],
    ["Límite clínico","La app es una bitácora de bienestar","No diagnostica, prescribe ni puntúa instrumentos clínicos"]
  ];
  return [
    { name:"Resumen_diario",rows:summary,widths:[13,20,8,23,23,13,13,12,12,12,18,22,22] },
    { name:"Contexto_fases",rows:phaseRows,widths:[13,12,12,22,22,12,70,70,34,10] },
    { name:"Metricas_confirmadas",rows:metricRows,widths:[16,16,30,16,24,15,16,10,16,18,58,18,14,12,20] },
    { name:"Sueno",rows:sleepRows,widths:[13,16,18,23,12,10,58,12] },
    { name:"Alimentos_bebidas",rows:foodRows,widths:[13,16,18,12,65,65] },
    { name:"Actividad",rows:activityRows,widths:[13,16,18,12,55,12,10,58] },
    { name:"Estados_sintomas",rows:stateRows,widths:[13,16,18,14,55,12,10,58] },
    { name:"Medicinas_sustancias",rows:medicineRows,widths:[13,16,18,14,55,12,10,58] },
    { name:"Analisis",rows:analysisRows,widths:[13,23,28,16,75,12,10,65,45] },
    { name:"Trazabilidad",rows:traceRows,widths:[13,12,31,15,16,13,13,15,12,20,70] },
    { name:"Diccionario",rows:dictionary,widths:[28,55,70] }
  ];
}

function buildXlsx(days) {
  const sheets = buildWorkbookSheets(days);
  const overrides = sheets.map((_,index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const workbookSheets = sheets.map((sheet,index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = sheets.map((_,index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const files = {
    "[Content_Types].xml":`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels":`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml":`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml":`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F6658"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs></styleSheet>`
  };
  sheets.forEach((sheet,index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet.rows,sheet.widths); });
  return zipFiles(files);
}

function exportExcel(days,suffix) {
  if (!requireFinalized(days)) return;
  const bytes = buildXlsx(days);
  downloadBlob(new Blob([bytes],{ type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),`bitacora-mi-dia-${suffix}.xlsx`);
  toast("Excel preparado con 11 hojas y trazabilidad");
}

function exportDayFiles(date) {
  const days = finalizedDays([date]);
  if (!requireFinalized(days)) return;
  const encoder = new TextEncoder();
  const bundle = zipFiles({ [`contexto-mi-dia-${date}.txt`]:encoder.encode(`\ufeff${buildContextText(days)}`), [`bitacora-mi-dia-${date}.xlsx`]:buildXlsx(days) });
  downloadBlob(new Blob([bundle],{ type:"application/zip" }),`mi-dia-${date}.zip`);
  toast("Paquete preparado con contexto y Excel");
}

async function saveProfile() {
  const ageRaw = $("profileAge").value;
  const age = ageRaw === "" ? "" : Number(ageRaw);
  if (age !== "" && (!Number.isInteger(age) || age < 1 || age > 120)) { toast("Revisa la edad ingresada"); return; }
  state.profile = { name:$("profileName").value.trim(), age, goal:$("profileGoal").value };
  await putSetting("profile",state.profile);
  updateWelcome();
  toast("Perfil guardado localmente");
}

function updateWelcome() {
  $("welcomeLead").textContent = state.profile.name ? `${state.profile.name}, no tienes que responder preguntas. Mira las pistas, habla como te salga y revisa únicamente los datos concretos.` : "No tienes que responder preguntas. Mira las pistas, habla como te salga y revisa únicamente los datos concretos.";
}

function exportBackup() {
  const backup = { schemaVersion:APP_SCHEMA_VERSION, exportedAt:new Date().toISOString(), profile:state.profile, days:state.days };
  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{ type:"application/json;charset=utf-8" }),`respaldo-mi-dia-${localToday()}.json`);
  toast("Respaldo JSON preparado");
}

async function persistStorage() {
  if (!navigator.storage?.persist) { toast("Este navegador no permite solicitar almacenamiento persistente"); return; }
  const granted = await navigator.storage.persist();
  toast(granted ? "El navegador protegerá mejor estos datos" : "El navegador mantendrá su política normal de almacenamiento");
  updateStorageEstimate();
}

async function updateStorageEstimate() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    if (!estimate) throw new Error("unavailable");
    const used = estimate.usage < 1048576 ? `${Math.round(estimate.usage / 1024)} KB` : `${(estimate.usage / 1048576).toFixed(1)} MB`;
    $("storageTitle").textContent = persisted ? "Almacenamiento protegido" : "Almacenamiento local estándar";
    $("storageDetail").textContent = `${used} utilizados por este sitio. Conserva un respaldo periódico.`;
  } catch (_) { $("storageDetail").textContent = "No fue posible calcular el uso. Conserva un respaldo periódico."; }
}

function chartPoints(key, unit = null) {
  return finalizedDays().flatMap((day) => confirmedMetrics(day).filter((metric) => metric.key === key && !["habitual"].includes(metric.eventPeriod) && (!unit || metric.unit === unit)).map((metric) => ({ date:metric.eventDate || day.date, value:Number(metric.value) }))).sort((a,b) => a.date.localeCompare(b.date)).slice(-14);
}

function drawChart(id,points,color,fixedRange = null) {
  const canvas = $(id); const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(300,Math.floor(rect.width * dpr)); canvas.height = 190 * dpr;
  const context = canvas.getContext("2d"); context.scale(dpr,dpr);
  const width = canvas.width / dpr; const height = 190; const pad = { left:40,right:16,top:15,bottom:28 };
  context.clearRect(0,0,width,height); context.font = "11px system-ui"; context.fillStyle = "#73817c";
  if (!points.length) { context.textAlign = "center"; context.fillText("Sin datos confirmados",width/2,height/2); return; }
  const values = points.map((point) => point.value); let min = fixedRange ? fixedRange[0] : Math.min(...values); let max = fixedRange ? fixedRange[1] : Math.max(...values);
  if (min === max) { min -= 1; max += 1; } else if (!fixedRange) { const extra = (max-min)*.15; min -= extra; max += extra; }
  const chartWidth = width-pad.left-pad.right; const chartHeight = height-pad.top-pad.bottom;
  context.strokeStyle = "#e1e6e1"; context.lineWidth = 1; context.textAlign = "right"; context.textBaseline = "middle";
  for (let index=0;index<4;index += 1) { const y = pad.top + chartHeight*index/3; context.beginPath(); context.moveTo(pad.left,y); context.lineTo(width-pad.right,y); context.stroke(); context.fillText((max-(max-min)*index/3).toFixed(id === "weightChart" ? 1 : 0),pad.left-7,y); }
  const xAt = (index) => points.length === 1 ? pad.left+chartWidth/2 : pad.left+chartWidth*index/(points.length-1);
  const yAt = (value) => pad.top+(max-value)/(max-min)*chartHeight;
  context.strokeStyle = color; context.lineWidth = 2.5; context.lineJoin = "round"; context.beginPath(); points.forEach((point,index) => index ? context.lineTo(xAt(index),yAt(point.value)) : context.moveTo(xAt(index),yAt(point.value))); context.stroke();
  points.forEach((point,index) => { context.fillStyle="#fffdfa";context.strokeStyle=color;context.lineWidth=2;context.beginPath();context.arc(xAt(index),yAt(point.value),3.5,0,Math.PI*2);context.fill();context.stroke(); });
  context.fillStyle="#73817c";context.textBaseline="alphabetic";context.textAlign="left";context.fillText(formatDate(points[0].date,true),pad.left,height-7);context.textAlign="right";context.fillText(formatDate(points.at(-1).date,true),width-pad.right,height-7);
}

function renderCharts() {
  const weight = chartPoints("weight","kg"); const sleep = chartPoints("sleep","h"); const stress = chartPoints("stress_10","/10");
  const available = weight.length || sleep.length || stress.length;
  $("chartsEmpty").hidden = Boolean(available); $("chartsArea").hidden = !available;
  if (!available) return;
  drawChart("weightChart",weight,"#2f6658"); drawChart("sleepChart",sleep,"#6991a3"); drawChart("stressChart",stress,"#d18055",[0,10]);
}

async function clearDraft() {
  if (!$("transcript").value.trim()) return;
  const accepted = await showConfirm("Limpiar el borrador","Se borrará el texto no guardado de esta fase. Si ya existía una versión guardada, podrás restaurarla.","Limpiar");
  if (!accepted) return;
  $("transcript").value = "";
  state.day.phases[state.activePhase].draftTranscript = "";
  if (state.day.phases[state.activePhase].status === "draft") state.day.phases[state.activePhase].status = "empty";
  $("reviewArea").classList.remove("visible");
  updateCueCoverage();
  await persistCurrentDay("Borrador limpio");
  updateProgress();
}

function restoreSavedPhase() {
  const phase = state.day.phases[state.activePhase];
  $("transcript").value = phase.correctedTranscript || "";
  phase.draftTranscript = phase.correctedTranscript || "";
  $("restoreBtn").hidden = true;
  updateCueCoverage();
  queueDraftSave();
}

function bindEvents() {
  document.querySelectorAll(".navbtn[data-tab]").forEach((button) => button.addEventListener("click",() => switchTab(button.dataset.tab)));
  document.querySelectorAll(".phase-step").forEach((button) => button.addEventListener("click",() => switchPhase(button.dataset.phase)));
  $("entryDate").addEventListener("change",() => loadDate($("entryDate").value || localToday()));
  $("moreCuesBtn").addEventListener("click",() => { const visible = $("extraCues").classList.toggle("visible"); $("moreCuesBtn").setAttribute("aria-expanded",String(visible)); $("moreCuesBtn").textContent = visible ? "− Ocultar ideas adicionales" : "+ Más ideas para recordar"; });
  $("transcript").addEventListener("input",() => { state.currentInputSource = state.currentInputSource === "voice" ? "voice+text" : "text"; updateCueCoverage(); queueDraftSave(); $("reviewArea").classList.remove("visible"); $("optionalPass").classList.remove("visible"); $("restoreBtn").hidden = !state.day.phases[state.activePhase].correctedTranscript || $("transcript").value === state.day.phases[state.activePhase].correctedTranscript; });
  $("correctedTranscript").addEventListener("input",invalidateMetricsAfterTranscriptEdit);
  $("externalConsent").addEventListener("change",async () => { state.externalConsent = $("externalConsent").checked; await putSetting("externalConsent",state.externalConsent); });
  $("micBtn").addEventListener("click",toggleVoice);
  $("reviewBtn").addEventListener("click",prepareReview);
  $("clearBtn").addEventListener("click",clearDraft);
  $("restoreBtn").addEventListener("click",restoreSavedPhase);
  $("metricList").addEventListener("click",handleMetricClick);
  $("metricList").addEventListener("input",handleMetricInput);
  $("confirmAllBtn").addEventListener("click",confirmAllMetrics);
  $("savePhaseBtn").addEventListener("click",savePhase);
  $("skipPhaseBtn").addEventListener("click",skipCurrentPhase);
  $("finalizeBtn").addEventListener("click",finalizeDay);
  $("exportCurrentTextBtn").addEventListener("click",() => exportText(finalizedDays([state.activeDate]),state.activeDate));
  $("exportCurrentExcelBtn").addEventListener("click",() => exportExcel(finalizedDays([state.activeDate]),state.activeDate));
  $("exportContextBtn").addEventListener("click",() => exportText(finalizedDays(),`historico-${localToday()}`));
  $("exportExcelBtn").addEventListener("click",() => exportExcel(finalizedDays(),`historico-${localToday()}`));
  $("entriesList").addEventListener("click",(event) => { const open = event.target.closest("[data-open-day]"); const download = event.target.closest("[data-export-day]"); const remove = event.target.closest("[data-delete-day]"); if (open) openHistoryDay(open.dataset.openDay); if (download) exportDayFiles(download.dataset.exportDay); if (remove) deleteHistoryDay(remove.dataset.deleteDay); });
  $("saveProfileBtn").addEventListener("click",saveProfile);
  $("exportBackupBtn").addEventListener("click",exportBackup);
  $("persistStorageBtn").addEventListener("click",persistStorage);
  $("infoBtn").addEventListener("click",() => $("infoDialog").showModal());
  $("closeInfoBtn").addEventListener("click",() => $("infoDialog").close());
  $("infoDialog").addEventListener("click",(event) => { if (event.target === $("infoDialog")) $("infoDialog").close(); });
  $("confirmCancel").addEventListener("click",() => resolveConfirm(false));
  $("confirmAccept").addEventListener("click",() => resolveConfirm(true));
  $("confirmDialog").addEventListener("cancel",(event) => { event.preventDefault(); resolveConfirm(false); });
  let resizeTimer; window.addEventListener("resize",() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if ($("panel-tendencias").classList.contains("active")) renderCharts(); },150); });
}

async function init() {
  $("todayLabel").textContent = new Intl.DateTimeFormat("es-CO",{ weekday:"long",day:"numeric",month:"long" }).format(new Date());
  bindEvents();
  setupSpeechRecognition();
  try {
    state.db = await openDatabase();
    await migrateLegacyData();
    await loadSettings();
    state.days = (await getAllDays()).map(normalizeDay);
    await loadDate(localToday());
    updateWelcome();
    renderHistory();
    detectBackend();
    updateStorageEstimate();
  } catch (error) {
    setRecordingUI(false,"No pude abrir el almacenamiento local. Mantén una copia del texto antes de cerrar.",true);
    toast("El almacenamiento local no está disponible en este navegador");
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}

document.addEventListener("DOMContentLoaded",init);