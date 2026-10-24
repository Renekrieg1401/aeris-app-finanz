/* =====================================================================================
   AERIS Buch — eigener Server-Login (René-Direktive 2026-10-24, software-architect-Konzept
   "eigener, unabhaengiger Login, kein Teilen des Doku-Tokens")
   -------------------------------------------------------------------------------------
   Schmal, bewusst OHNE Tenant-Setup-Flow (Tenants werden immer ueber AERIS Doku angelegt, s.
   ../aeris-server.js). Nur: POST /api/login (gleicher Vertrag wie Doku) -- bei Erfolg wird die
   Tenant-DEK ueber die bereits vorhandenen deriveKey/unwrapDek/importDek-Funktionen (app.js,
   als window.AeFinCrypto exportiert) entschluesselt, danach /api/blob-fin (eigenes Buch-Blob)
   und /api/blob (Doku-Blob, NUR lesend) geladen und an window.AeFinSession.setUnlocked()
   uebergeben. /api/blob-fin ist server-seitig admin-only (s. server/server.js requireAdmin) --
   MA-Accounts bekommen ein gueltiges Token, aber einen klaren Fehler statt Zugriff.

   Liest NUR lesend die nicht-sensitiven localStorage-Keys 'aeris_login_modus'/'aeris_last_username'
   (von ../app.js/../aeris-server.js gesetzt) fuer UX-Komfort -- NIE Token/DEK daraus.
   ===================================================================================== */
(function () {
  'use strict';
  var C = window.AeFinCrypto;

  function $(id) { return document.getElementById(id); }
  function note(id, msg) { var el = $(id); if (el) el.textContent = msg; }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch((window.AE_API_BASE || '') + '/api' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) {
          var err = new Error(body.error || ('Server-Fehler ' + r.status));
          err.status = r.status; err.mustChangePassword = !!body.mustChangePassword;
          throw err;
        }
        return body;
      });
    });
  }

  // Liefert { iv, ct } oder null (kein Datenstand, 404) -- andere Fehler (403 Admin-only/Pflicht-
  // Wechsel, Netzwerkfehler) werden weitergereicht, damit der Aufrufer sie klar anzeigen kann.
  function ladeFinBlob(token) {
    return api('/blob-fin', { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      return { iv: r.iv, ct: r.ct };
    }, function (err) { if (err.status === 404) return null; throw err; });
  }
  // Doku-Blob ist fuer jede Rolle lesbar (kein requireAdmin, s. server.js) -- Fehler hier sind
  // unkritisch (fehlender/nicht lesbarer Doku-Bestand), AERIS Buch bleibt mit leeren Doku-Werten
  // nutzbar, identisch zum bisherigen Lokal-Modus-Verhalten bei "keine Doku-Daten vorhanden".
  function ladeDokuBlobServer(token) {
    return api('/blob', { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      return { iv: r.iv, ct: r.ct };
    }, function () { return null; });
  }
  function adminOnlyError() { var e = new Error('Kein Zugriff auf AERIS Buch — nur für Admin-Accounts.'); e.adminOnly = true; return e; }

  function onSubmit(e) {
    e.preventDefault();
    var submit = $('fin-server-submit'), userInput = $('fin-server-user'), pinInput = $('fin-server-pin');
    note('fin-server-note', '');
    var username = userInput.value.trim(), pin = pinInput.value.trim();
    if (!username) return note('fin-server-note', 'Bitte einen Benutzernamen eingeben.');
    if (!/^\d{4,6}$/.test(pin)) return note('fin-server-note', 'Bitte eine PIN aus 4–6 Ziffern eingeben.');
    submit.disabled = true;
    note('fin-server-note', 'Anmeldung läuft …');
    var loginRes, dek;
    api('/login', { method: 'POST', body: JSON.stringify({ username: username, password: pin }) }).then(function (res) {
      loginRes = res;
      // Client-seitiger Rollen-Check ZUERST (bevor ueberhaupt versucht wird, den Datenschluessel zu
      // entsperren) -- vermeidet unnoetige Roundtrips und eine irrefuehrende Teil-Fehlermeldung,
      // server.js requireAdmin auf /api/blob-fin bleibt die eigentliche, massgebliche Durchsetzung.
      if (res.user.role !== 'admin') throw adminOnlyError();
      return C.deriveKey(pin, res.wrappedDek.salt, C.PBKDF2_ITER).then(function (wrapKey) {
        return C.unwrapDek(wrapKey, res.wrappedDek);
      });
    }).then(function (dekB64) {
      return C.importDek(dekB64);
    }).then(function (importierterDek) {
      dek = importierterDek;
      return ladeFinBlob(loginRes.token);
    }).then(function (finBlob) {
      return finBlob ? C.decryptJson(dek, finBlob.iv, finBlob.ct) : null;
    }).then(function (finData) {
      return ladeDokuBlobServer(loginRes.token).then(function (dokuBlob) {
        return dokuBlob ? C.decryptJson(dek, dokuBlob.iv, dokuBlob.ct) : null;
      }).then(function (dokuData) {
        userInput.value = ''; pinInput.value = '';
        window.AeFinSession.setUnlocked({ doku: dokuData, fin: finData }, dek,
          { token: loginRes.token, user: loginRes.user, tenantId: loginRes.tenantId, tenantName: loginRes.tenantName });
      });
    }).catch(function (err) {
      submit.disabled = false;
      if (err && err.mustChangePassword) {
        note('fin-server-note', 'Die PIN wurde neu vergeben/zurückgesetzt — bitte zuerst in AERIS Doku anmelden und eine eigene PIN festlegen, danach hier erneut versuchen.');
      } else if (err && err.adminOnly) {
        note('fin-server-note', 'Kein Zugriff auf AERIS Buch — nur für Admin-Accounts.');
      } else if (err && err.status === 403) {
        note('fin-server-note', 'Kein Zugriff auf AERIS Buch — nur für Admin-Accounts.');
      } else {
        note('fin-server-note', 'Anmeldung fehlgeschlagen — ' + ((err && err.message) || 'unbekannter Fehler') + '.');
      }
    });
  }

  function boot() {
    var umschalter = $('fin-server-umschalter'), toggleBtn = $('fin-server-toggle-btn');
    var form = $('fin-server-form'), backBtn = $('fin-server-back');
    var pinForm = $('pin-form'), stbSubtabs = $('stb-subtabs');
    var gateTitle = $('gate-title'), gateHint = $('gate-hint');
    if (!umschalter || !form || !toggleBtn || !backBtn) return;
    // Sichtbar nur, wenn dieses Geraet laut AERIS Doku im Team-/Server-Modus laeuft (von ../app.js/
    // ../aeris-server.js gesetzt) -- im reinen Lokal-Modus (Mehrheit der Installationen) bleibt der
    // Gate-Ablauf exakt wie bisher, dieser gesamte Block greift dort nie ein.
    if (localStorage.getItem('aeris_login_modus') !== 'server') return;
    umschalter.classList.remove('hidden');

    var gemerkterTitel = null, gemerkterHint = null;
    var letztBenutzer = localStorage.getItem('aeris_last_username');
    if (letztBenutzer) $('fin-server-user').value = letztBenutzer;

    toggleBtn.addEventListener('click', function () {
      gemerkterTitel = gateTitle.textContent; gemerkterHint = gateHint.textContent;
      pinForm.classList.add('hidden');
      if (stbSubtabs) stbSubtabs.classList.add('hidden');
      umschalter.classList.add('hidden');
      form.classList.remove('hidden');
      gateTitle.textContent = 'Team-/Server-Login (AERIS Buch)';
      gateHint.textContent = 'Bitte Benutzernamen und persönliche PIN eingeben — nur Admin-Accounts haben Zugriff.';
      note('fin-server-note', '');
      $('fin-server-user').focus();
    });
    backBtn.addEventListener('click', function () {
      form.classList.add('hidden');
      pinForm.classList.remove('hidden');
      umschalter.classList.remove('hidden');
      if (gemerkterTitel !== null) gateTitle.textContent = gemerkterTitel;
      if (gemerkterHint !== null) gateHint.textContent = gemerkterHint;
      note('fin-server-note', '');
      var pinField = $('pin-input'); if (pinField) pinField.focus();
    });
    form.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
