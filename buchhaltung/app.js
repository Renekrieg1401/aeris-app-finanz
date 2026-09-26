/* AERIS Buchhaltung – liest die echten, verschlüsselten Daten der AERIS-Doku-App
   (gleiche PIN, gleicher Speicherort) und kategorisiert sie nach dem realen
   SKR03/04-Kontenrahmen aus docs/quelle/02_Business_Finanzen/AERIS_Buchhaltungs_und_Kontenrahmen_SKR03_SKR04.pdf
   und der bereits in aeris-app-finanz/app.js etablierten Export-Konvention (exportSteuerberaterMonat).
   Diese App SCHREIBT NIEMALS in den AERIS-Doku-Datenbestand — reiner Lesezugriff. */

const APP_VERSION = '2026-09-26-003';
const STORAGE_KEY_ENC = 'ae-finanz-log-v1-enc'; // identisch zu aeris-app-finanz/app.js
const AE_PBKDF2_ITER = 150000; // muss exakt mit aeris-app-finanz/app.js uebereinstimmen

window.dataPageVersion = APP_VERSION;
document.documentElement.setAttribute('data-page-version', APP_VERSION);
document.addEventListener('DOMContentLoaded', function () {
  var gateEl = document.getElementById('ae-bh-version-gate');
  if (gateEl) gateEl.textContent = 'PWA-Version ' + APP_VERSION + ' | Offline-Modus: ja';
  var footerEl = document.getElementById('ae-bh-version-footer');
  if (footerEl) footerEl.textContent = 'PWA v' + APP_VERSION;
});

// ---------- Krypto-Helfer (1:1 identisch zu aeris-app-finanz/app.js, notwendig fuer denselben Ciphertext) ----------
function b642ab(b64) {
  var bin = atob(b64), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}
function aeDeriveKey(pin, saltB64, iterations) {
  var enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (keyMaterial) {
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b642ab(saltB64), iterations: iterations || AE_PBKDF2_ITER, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
  });
}
function aeDecryptJson(key, ivB64, ctB64) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b642ab(ivB64)) }, key, b642ab(ctB64)).then(function (plain) {
    return JSON.parse(new TextDecoder().decode(plain));
  });
}

// ---------- SKR03/04-Kategorisierung (Quelle: AERIS_Buchhaltungs_und_Kontenrahmen_SKR03_SKR04.pdf
// + bestehende exportSteuerberaterMonat()-Konvention in aeris-app-finanz/app.js) ----------
var SKR_KONTEN = {
  pflege:   { skr03: '8100', skr04: '4100', label: 'Erlöse 1:1-Intensivpflege (SGB XI/V)', typ: 'einnahme' },
  beratung: { skr03: '8195', skr04: '4185', label: 'Erlöse Pflegeberatung § 7a SGB XI', typ: 'einnahme' },
  privat:   { skr03: '8190', skr04: '4180', label: 'Erlöse Privatleistungen (Aufnahme/Anamnese)', typ: 'einnahme' },
  fahrt:    { skr03: '4670', skr04: '6670', label: 'Fahrtkosten/Reisekosten (0,30 €/km)', typ: 'ausgabe' },
  unklar:   { skr03: '—', skr04: '—', label: 'Ohne eindeutiges SKR-Konto — manuell prüfen', typ: 'unklar' }
};

function kategorisiereEintrag(entry) {
  if (entry.type === 'fahrt') return 'fahrt';
  if (entry.type === 'privat') return 'privat';
  if (entry.type === 'massnahme') {
    if (entry.cat === 'sgb11' || entry.cat === 'sgb5') return 'pflege';
    if (entry.cat === 'beratung') return 'beratung';
  }
  return 'unklar';
}

// ---------- PIN-Gate (liest, entschlüsselt nur — schreibt nie in STORAGE_KEY_ENC) ----------
function aePinGateStart() {
  var form = document.getElementById('ae-pin-form');
  var hint = document.getElementById('ae-pin-gate-hint');
  if (!form) return;

  if (!window.crypto || !window.crypto.subtle) {
    hint.textContent = 'Verschlüsselung wird von diesem Browser nicht unterstützt. Bitte aktuellen Browser über HTTPS verwenden.';
    return;
  }

  var raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY_ENC); } catch (e) {}
  if (!raw) {
    hint.textContent = 'In AERIS Doku sind noch keine Daten vorhanden — bitte dort zuerst Einträge erfassen.';
    return;
  }
  var parsed;
  try { parsed = JSON.parse(raw); } catch (e) {}
  if (!parsed || !parsed.salt || !parsed.iv || !parsed.ct) {
    hint.textContent = 'Datenformat von AERIS Doku unbekannt/beschädigt — bitte AERIS Doku zuerst normal öffnen.';
    return;
  }

  hint.textContent = 'Bitte dieselbe PIN wie in AERIS Doku eingeben.';

  var input = document.createElement('input');
  input.type = 'password';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]{4,6}';
  input.maxLength = 6;
  input.placeholder = 'PIN (4–6 Ziffern)';
  input.autocomplete = 'off';
  input.className = 'ae-pin-input';
  input.style.cssText = 'width:100%;padding:0.75rem;font-size:1.25rem;text-align:center;background-color:#2D3A4D;border:1px solid #3D4A60;border-radius:0.5rem;color:#FFFFFF;font-weight:bold;letter-spacing:0.3em;';
  form.appendChild(input);

  var note = document.createElement('p');
  note.style.cssText = 'color:#FF6B6B;font-size:0.85rem;margin-top:0.5rem;min-height:1.2em;';
  form.appendChild(note);

  var submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Entsperren';
  submitBtn.style.cssText = 'width:100%;padding:0.75rem;background-color:#2B4570;color:#FFFFFF;border:none;border-radius:0.5rem;font-weight:500;cursor:pointer;margin-top:1rem;';
  form.appendChild(submitBtn);

  input.focus();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pin = input.value.trim();
    if (!/^\d{4,6}$/.test(pin)) { note.textContent = 'Bitte eine PIN aus 4–6 Ziffern eingeben.'; return; }
    submitBtn.disabled = true;
    note.textContent = '';

    aeDeriveKey(pin, parsed.salt, parsed.iterations).then(function (key) {
      return aeDecryptJson(key, parsed.iv, parsed.ct);
    }).then(function (data) {
      aePinGateHide(data && data.entries ? data.entries : []);
    }).catch(function () {
      note.textContent = '❌ Falsche PIN oder Daten nicht lesbar.';
      submitBtn.disabled = false;
      input.value = '';
      input.focus();
    });
  });
}

function aePinGateHide(entries) {
  var pinGate = document.getElementById('ae-pin-gate');
  var appRoot = document.getElementById('ae-app-root');
  if (pinGate) pinGate.classList.add('ae-legal-hidden');
  if (appRoot) appRoot.classList.remove('ae-legal-hidden');
  aeAppInit(entries);
}

function aeAppInit(entries) {
  aeTabSetup();
  aeHeaderLinks();
  renderBuchhaltung(entries || []);
  renderDokumente(entries || []);
}

function aeTabSetup() {
  var tabs = document.querySelectorAll('[role="tab"]');
  var panels = document.querySelectorAll('[role="tabpanel"]');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); t.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      tab.setAttribute('aria-selected', 'true');
      tab.classList.add('active');
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.classList.add('active');
    });
  });
}

function aeHeaderLinks() {
  var docsLink = document.querySelector('a[href="#doku"]');
  if (docsLink) {
    docsLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '../index.html'; // Buchhaltung liegt unter aeris-app-finanz/buchhaltung/, Doku ist eine Ebene hoeher
    });
  }
}

function euro(n) { return '€ ' + n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ---------- Empfänger-Kategorisierung (Dokumente-Tab) ----------
// Grundlage: bestehende exportSteuerberaterMonat()-Logik in aeris-app-finanz/app.js (Steuerberater-Scope)
// + Grundannahmen zu Kasse/Auftraggeber. Unsichere Zuordnungen sind unten explizit gekennzeichnet,
// nicht stillschweigend geraten (AERIS-Grundsatz: keine Spekulation bei rechtlich relevanter Zuordnung).
var EMPFAENGER = {
  sammelordner:  { label: 'Sammelordner (persönliche Ablage)', hinweis: 'Alle Einträge, unabhängig vom Empfänger — für deine eigene Übersicht.' },
  steuerberater: { label: 'Steuerberater', hinweis: 'Alle einnahme- und ausgabenrelevanten Einträge (identisch zum bestehenden Steuerberater-Monatsexport).' },
  wirtschaftspruefer: { label: 'Wirtschaftsprüfer', hinweis: 'Gleiche Belegbasis wie Steuerberater (Jahresabschluss-Prüfung).' },
  kasse:         { label: 'Kasse (Kranken-/Pflegekasse)', hinweis: 'Nur SGB-XI/V-Pflegeleistungen — Grundannahme, bitte bei Bedarf gegenprüfen ob § 7a-Beratung ebenfalls kassenpflichtig gemeldet werden muss.' },
  auftraggeber:  { label: 'Auftraggeber (Klient/Budgetnehmer)', hinweis: 'Alle abrechnungsrelevanten Leistungen (Pflege, Beratung, Privatleistungen).' },
  md:            { label: 'Medizinischer Dienst (MD)', hinweis: 'Noch keine automatische Zuordnung möglich — MD-Prüfungen benötigen Pflegedokumentation/Assessments (andere Datenstruktur), nicht die einfachen Log-Einträge dieser Ansicht. Späterer Ausbauschritt.' }
};

function empfaengerTags(entry, kategorie) {
  var tags = ['sammelordner'];
  if (kategorie === 'pflege' || kategorie === 'beratung' || kategorie === 'privat') {
    tags.push('steuerberater', 'wirtschaftspruefer', 'auftraggeber');
  }
  if (kategorie === 'fahrt') {
    tags.push('steuerberater', 'wirtschaftspruefer');
  }
  if (kategorie === 'pflege') {
    tags.push('kasse');
  }
  return tags;
}

function entryToCsvRow(e, kategorie) {
  var konto = SKR_KONTEN[kategorie];
  return [e.datum || '', e.uhrzeit || '', kategorie, konto.skr03, konto.skr04, e.label || e.art || '', e.km || '', e.betrag || ''].join(';');
}

function exportEmpfaengerCsv(empfaengerKey, items) {
  var rows = ['Datum;Uhrzeit;Kategorie;SKR03;SKR04;Bezeichnung;Km;Betrag'];
  items.forEach(function (it) { rows.push(entryToCsvRow(it.entry, it.kategorie)); });
  var csv = '﻿' + rows.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'AERIS-' + empfaengerKey + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ---------- Übermittlungs-Vorbereitung (analog zum bereits bestehenden TI-Platzhalter-Muster
// in aeris-app-finanz/app.js, aeTiVerordnungAbrufen(): Konfigurationsfelder + ehrlicher Stub,
// der OHNE echte Zugangsdaten explizit NICHTS an ein externes System sendet. Sobald reale
// Zugänge existieren (IK-Nummer + Vertrag bei Kasse, ELSTER-Zertifikat bei Finanzamt, TI/KIM bei
// MD), ist hier die einzige Stelle, die um einen echten fetch()-Aufruf ergänzt werden muss —
// die Konfiguration/Kategorisierung ist bereits fertig. Rein lokale, unverschlüsselte Ablage
// (nur Kontaktdaten/Endpunkte, keine Patienten-/Finanzdaten — die bleiben ausschließlich in
// AERIS Doku verschlüsselt). ----------
var STORAGE_KEY_VERSAND_CONFIG = 'ae-buchhaltung-versand-config';
var VERSAND_FELDER = {
  steuerberater: [{ key: 'email', label: 'E-Mail Steuerbüro' }, { key: 'elsterZertifikat', label: 'ELSTER-Zertifikat (Pfad/Referenz)' }],
  wirtschaftspruefer: [{ key: 'email', label: 'E-Mail Wirtschaftsprüfer' }],
  kasse: [{ key: 'ikNummer', label: 'IK-Nummer Kasse' }, { key: 'portalEndpunkt', label: 'Kassen-Portal-Endpunkt' }],
  auftraggeber: [{ key: 'email', label: 'E-Mail Klient/Budgetnehmer' }],
  md: [{ key: 'endpunkt', label: 'MD-/TI-Endpunkt' }]
};

function ladeVersandConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_VERSAND_CONFIG) || '{}'); } catch (e) { return {}; }
}
function speichereVersandConfig(cfg) {
  localStorage.setItem(STORAGE_KEY_VERSAND_CONFIG, JSON.stringify(cfg));
}
function empfaengerVollKonfiguriert(key, cfg) {
  var felder = VERSAND_FELDER[key];
  if (!felder) return false;
  var werte = cfg[key] || {};
  return felder.every(function (f) { return (werte[f.key] || '').trim() !== ''; });
}
// Absichtlich KEIN fetch() — es existiert noch keine echte Anbindung an Finanzamt/ELSTER,
// Kassen-Portale oder TI/KIM. Sobald ein echter Zugang existiert: hier den realen Sende-Aufruf
// einbauen (Protokoll ist anbieter-/systemabhängig, s. Kommentarblock oben).
function aeVersandVersuchen(empfaengerKey) {
  var cfg = ladeVersandConfig();
  if (!empfaengerVollKonfiguriert(empfaengerKey, cfg)) {
    return { ok: false, meldung: 'Noch nicht konfiguriert — bitte zuerst die Zugangsfelder oben ausfüllen und speichern.' };
  }
  return { ok: false, meldung: 'Zugangsdaten hinterlegt, aber echte Anbindung ist noch nicht implementiert (kein zertifizierter Kassen-/ELSTER-/TI-Zugang vorhanden). Bitte den CSV-Export stattdessen manuell versenden, bis eine echte Schnittstelle existiert.' };
}

function renderDokumente(entries) {
  var container = document.getElementById('ae-bh-dokumente');
  if (!container) return;
  container.innerHTML = '';

  var byEmpfaenger = {};
  Object.keys(EMPFAENGER).forEach(function (k) { byEmpfaenger[k] = []; });

  entries.forEach(function (e) {
    var kategorie = kategorisiereEintrag(e);
    if (kategorie === 'unklar') return; // unklare Eintraege werden hier nicht verteilt, s. Einnahmen-Tab-Warnung
    empfaengerTags(e, kategorie).forEach(function (tag) {
      byEmpfaenger[tag].push({ entry: e, kategorie: kategorie });
    });
  });

  var versandCfg = ladeVersandConfig();

  Object.keys(EMPFAENGER).forEach(function (key) {
    var meta = EMPFAENGER[key];
    var items = byEmpfaenger[key];
    var card = document.createElement('div');
    card.className = 'ae-card mb-3';
    var btnHtml = items.length
      ? '<button class="ae-btn-secondary text-sm" data-empf="' + key + '">Export (' + items.length + ') als CSV</button>'
      : '<span class="text-[#7A8BA3] text-xs">— derzeit keine Einträge —</span>';

    var felder = VERSAND_FELDER[key];
    var configHtml = '';
    if (felder) {
      var werte = versandCfg[key] || {};
      configHtml = '<div class="mt-3 pt-3" style="border-top:1px solid rgba(124,147,184,0.2);">' +
        '<div class="text-[#7A8BA3] text-xs mb-2">Übermittlungs-Zugang (Vorbereitung für später):</div>';
      felder.forEach(function (f) {
        configHtml += '<input type="text" data-versand-feld="' + key + '.' + f.key + '" placeholder="' + f.label + '" value="' + (werte[f.key] || '').replace(/"/g, '&quot;') + '" class="ae-input text-xs mb-1" style="width:100%;">';
      });
      configHtml += '<div class="flex gap-2 mt-2">' +
        '<button class="ae-btn-secondary text-xs" data-versand-save="' + key + '">Speichern</button>' +
        '<button class="ae-btn-secondary text-xs" data-versand-send="' + key + '">Jetzt übermitteln</button>' +
        '</div><div class="text-xs mt-1" data-versand-note="' + key + '" style="color:#E8C39E;"></div></div>';
    }

    card.innerHTML =
      '<div class="font-medium text-white mb-1">' + meta.label + '</div>' +
      '<div class="text-[#7A8BA3] text-xs mb-2">' + meta.hinweis + '</div>' +
      btnHtml + configHtml;
    container.appendChild(card);
  });

  container.querySelectorAll('[data-empf]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      exportEmpfaengerCsv(btn.dataset.empf, byEmpfaenger[btn.dataset.empf]);
    });
  });
  container.querySelectorAll('[data-versand-save]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.versandSave;
      var cfg = ladeVersandConfig();
      cfg[key] = cfg[key] || {};
      container.querySelectorAll('[data-versand-feld^="' + key + '."]').forEach(function (inp) {
        var feldKey = inp.dataset.versandFeld.split('.')[1];
        cfg[key][feldKey] = inp.value.trim();
      });
      speichereVersandConfig(cfg);
      var note = container.querySelector('[data-versand-note="' + key + '"]');
      if (note) note.textContent = '✓ Gespeichert (nur lokal auf diesem Gerät).';
    });
  });
  container.querySelectorAll('[data-versand-send]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.versandSend;
      var res = aeVersandVersuchen(key);
      var note = container.querySelector('[data-versand-note="' + key + '"]');
      if (note) note.textContent = (res.ok ? '✓ ' : '⚠ ') + res.meldung;
    });
  });
}

function renderBuchhaltung(entries) {
  var buckets = { pflege: [], beratung: [], privat: [], fahrt: [], unklar: [] };
  entries.forEach(function (e) { buckets[kategorisiereEintrag(e)].push(e); });

  var summeEinnahmen = 0, summeAusgaben = 0;
  // Fahrt: 0,30 €/km, km-Feld heisst je nach AERIS-Doku-Datenmodell "km"
  buckets.fahrt.forEach(function (e) { summeAusgaben += (parseFloat(e.km) || 0) * 0.30; });
  // Privat: hat einen echten Festbetrag (Aufnahme-/Anamnese-Pauschale), Feld "betrag"
  buckets.privat.forEach(function (e) { summeEinnahmen += (parseFloat(e.betrag) || 0); });
  // Pflege/Beratung: kein Pauschal-Betrag pro Einzeleintrag im Rohdatenmodell (Betrag entsteht erst
  // beim Rechnungslauf in AERIS Doku aus Std. × Satz) — hier daher Anzahl statt Euro-Betrag, transparent gekennzeichnet.
  var pflegeBeratungAnzahl = buckets.pflege.length + buckets.beratung.length;

  var monatLabel = document.getElementById('ae-bh-monatlabel');
  if (monatLabel) monatLabel.textContent = entries.length + ' Einträge insgesamt aus AERIS Doku übernommen';

  var elEin = document.getElementById('ae-bh-summe-einnahmen');
  var elAus = document.getElementById('ae-bh-summe-ausgaben');
  var elNetto = document.getElementById('ae-bh-netto');
  if (elEin) elEin.textContent = euro(summeEinnahmen) + (pflegeBeratungAnzahl ? ' + ' + pflegeBeratungAnzahl + ' Pflege/Beratungs-Einträge (Betrag erst bei Rechnung in AERIS Doku)' : '');
  if (elAus) elAus.textContent = euro(summeAusgaben);
  if (elNetto) elNetto.textContent = euro(summeEinnahmen - summeAusgaben) + ' (Pflege/Beratung noch ohne Betrag, s. Hinweis oben)';

  var hinweis = document.getElementById('ae-bh-manuell-hinweis');
  var hinweisCount = document.getElementById('ae-bh-manuell-count');
  if (hinweis && hinweisCount) {
    if (buckets.unklar.length > 0) {
      hinweis.style.display = '';
      hinweisCount.textContent = buckets.unklar.length;
    } else {
      hinweis.style.display = 'none';
    }
  }

  function renderListe(containerId, kontoKeys, betragFn) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var any = false;
    kontoKeys.forEach(function (key) {
      var items = buckets[key];
      if (!items.length) return;
      any = true;
      var konto = SKR_KONTEN[key];
      var group = document.createElement('div');
      group.style.cssText = 'margin-bottom:1rem;';
      group.innerHTML =
        '<div class="font-medium text-white mb-1">' + konto.label + '</div>' +
        '<div class="text-[#7A8BA3] text-xs mb-2">SKR03: ' + konto.skr03 + ' · SKR04: ' + konto.skr04 + ' · ' + items.length + ' Einträge</div>';
      var list = document.createElement('div');
      list.style.cssText = 'font-size:0.85rem;color:#B8C4D9;';
      items.slice(0, 20).forEach(function (e) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid rgba(124,147,184,0.15);';
        var datum = e.datum || '—';
        var rechts = betragFn ? betragFn(e) : (e.label || e.art || '');
        row.innerHTML = '<span>' + datum + (e.label ? ' — ' + e.label : '') + '</span><span>' + rechts + '</span>';
        list.appendChild(row);
      });
      if (items.length > 20) {
        var mehr = document.createElement('div');
        mehr.style.cssText = 'color:#7A8BA3;font-size:0.8rem;padding-top:4px;';
        mehr.textContent = '… und ' + (items.length - 20) + ' weitere';
        list.appendChild(mehr);
      }
      group.appendChild(list);
      container.appendChild(group);
    });
    if (buckets.unklar.length && kontoKeys.indexOf('pflege') !== -1) {
      // Unklar-Kategorie nur im Einnahmen-Tab als Warnliste zeigen (nicht doppelt in Ausgaben)
      any = true;
      var konto2 = SKR_KONTEN.unklar;
      var group2 = document.createElement('div');
      group2.style.cssText = 'margin-bottom:1rem;border:1px solid #E8C39E;border-radius:0.5rem;padding:0.5rem;';
      group2.innerHTML = '<div class="font-medium" style="color:#E8C39E;">' + konto2.label + '</div><div class="text-[#7A8BA3] text-xs">' + buckets.unklar.length + ' Einträge — Typ: ' + Array.from(new Set(buckets.unklar.map(function(e){return e.type;}))).join(', ') + '</div>';
      container.appendChild(group2);
    }
    if (!any) container.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine passenden Einträge in AERIS Doku gefunden.</p>';
  }

  renderListe('ae-bh-einnahmen-liste', ['pflege', 'beratung', 'privat'], function (e) { return e.ref || ''; });
  renderListe('ae-bh-ausgaben-liste', ['fahrt'], function (e) {
    var km = parseFloat(e.km) || 0;
    return km.toFixed(1) + ' km = ' + euro(km * 0.30);
  });
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function (err) {
    console.warn('Service Worker registration failed:', err);
  });
}

document.addEventListener('DOMContentLoaded', aePinGateStart);

// ---------- Auto-Update-Erkennung (identisches Muster zu aeris-app-finanz/app.js) ----------
function pruefeAufUpdate() {
  if (!navigator.onLine || !location.protocol.startsWith('http')) return;
  fetch(location.href.split('?')[0] + '?v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
    return res.text();
  }).then(function (txt) {
    var m = txt.match(/APP-VERSION:\s*([\w-]+)/);
    if (m && m[1] !== APP_VERSION) {
      var banner = document.getElementById('updateBanner');
      if (banner) banner.style.setProperty('display', 'flex', 'important');
    }
  }).catch(function () {});
}
window.addEventListener('load', function () { pruefeAufUpdate(); setInterval(pruefeAufUpdate, 300000); });
