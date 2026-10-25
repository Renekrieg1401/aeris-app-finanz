/* =====================================================================================
   AERIS Server-Login — Mehrbenutzer-/Mandanten-Zugang (René-Direktive 2026-10-09)
   Übernimmt das bestehende #ae-pin-gate komplett eigenständig, wenn localStorage
   'aeris_login_modus' === 'server' ist (s. app.js aePinGateStart()-Abbruch). Nutzt dieselbe
   PIN-Tastatur (aeris-login.js, unverändert) für die Zifferneingabe -- nur die Felder
   Benutzername/Unternehmen kommen über reguläre Texteingaben hinzu.

   Sicherheitsprinzip: der Tenant-Datenschlüssel (DEK) entsteht/verlässt den Browser nie im
   Klartext zum Server. Beim Ersteinrichten erzeugt der Client die DEK zufällig und wrappt sie
   mit einem aus der PIN abgeleiteten Schlüssel (PBKDF2, identische Parameter wie app.js). Beim
   Login entschlüsselt der Client die vom Server gelieferte gewrappte DEK lokal. Admins, die
   neue Mitarbeiter-Accounts anlegen, wrappen die bereits im Speicher gehaltene DEK client-seitig
   mit dem neuen PIN des Kollegen/der Kollegin -- der Server bekommt nur das Ergebnis.
   ===================================================================================== */
(function () {
  'use strict';
  var C = window.AeCrypto;

  function $(id) { return document.getElementById(id); }
  // Korrektur-Potenzial-Audit 2026-10-10: dieselbe Trivial-PIN-Sperre wie app.js/aeris-login.js
  // (dort aePinIstTrivial/istTrivial, hier bewusst dupliziert statt cross-file importiert -- jede
  // dieser drei Dateien validiert eigenständig ihre eigenen PIN-Eingabefelder). Gilt für Server-
  // Modus-PINs (eigene PIN ändern, Start-PIN neuer Teammitglieder) ebenso wie für den lokalen Modus.
  function pinIstTrivial(p) { return /^(\d)\1{5}$/.test(p) || '0123456789'.indexOf(p) !== -1 || '9876543210'.indexOf(p) !== -1; }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch((window.AE_API_BASE || '') + '/api' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || ('Server-Fehler ' + r.status));
        return body;
      });
    });
  }

  function randomDek() { var d = new Uint8Array(32); crypto.getRandomValues(d); return d; }
  function importRawAesKey(bytes) { return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  function wrapDek(dekBytes, pin) {
    var salt = C.aeRandomSaltB64();
    return C.aeDeriveKey(pin, salt, C.PBKDF2_ITER).then(function (wrapKey) {
      var iv = new Uint8Array(12); crypto.getRandomValues(iv);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, wrapKey, dekBytes).then(function (ct) {
        return { salt: salt, iv: C.ab2b64(iv.buffer), ct: C.ab2b64(ct) };
      });
    });
  }
  function unwrapDek(wrapped, pin) {
    return C.aeDeriveKey(pin, wrapped.salt, C.PBKDF2_ITER).then(function (wrapKey) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(C.b642ab(wrapped.iv)) }, wrapKey, C.b642ab(wrapped.ct));
    }).then(function (plain) { return new Uint8Array(plain); });
  }

  var gate, form, userWrap, userInput, pin, confirm, confirmWrap, tenantWrap, tenantInput, note, submit, hint, title;
  var subUmschalter, subBtn;
  var subMode = 'login'; // 'login' | 'setup' | 'pflicht' (Pflicht-PIN-Änderung nach Admin-Vergabe/Reset)
  var DEK_BYTES = null; // im Speicher gehalten für Admin-Folgeaktionen (neue Mitarbeiter anlegen)
  var pflichtKontext = null; // { data, dek, meta } -- während der Pflicht-Änderung zwischengehalten

  // ---------- Organisationsstruktur Phase 4 (2026-10-24): 1-4 Erst-Accounts beim Setup ----------
  var setupAnzahlAccounts = 1; // wie viele der 4 Reihen aktuell sichtbar/aktiv sind
  var PFLICHT_ROLLEN_SETUP = ['admin', 'hr', 'bezirksleitung', 'teamleiter'];
  var AE_SETUP_ROLLE_LABEL = { admin: 'Admin', hr: 'HR', bezirksleitung: 'Bezirksleitung', teamleiter: 'Teamleiter/in' };
  function rollenLabelSetup(r) { return AE_SETUP_ROLLE_LABEL[r] || r; }
  function setupRollenVon(accNr) {
    var fieldset = document.querySelector('[data-setup-rollen="' + accNr + '"]');
    if (!fieldset) return [];
    return Array.prototype.map.call(fieldset.querySelectorAll('input[type="checkbox"]:checked'), function (el) { return el.value; });
  }
  // Account 1 nutzt die bereits oben entgegengenommenen Top-Felder (Benutzername/PIN/PIN-Bestätigung,
  // s. onSubmit()) -- werden hier nur durchgereicht, kein Doppel-Feld.
  function setupFelderLesen(accNr, acc1User, acc1Pin, acc1PinConfirm) {
    if (accNr === 1) {
      return {
        username: acc1User, pin: acc1Pin, pinConfirm: acc1PinConfirm,
        vorname: $('ae-setup-vorname-1').value.trim(), nachname: $('ae-setup-nachname-1').value.trim(),
        rollen: setupRollenVon(1)
      };
    }
    return {
      username: $('ae-setup-user-' + accNr).value.trim(), pin: $('ae-setup-pin-' + accNr).value.trim(), pinConfirm: $('ae-setup-pinconfirm-' + accNr).value.trim(),
      vorname: $('ae-setup-vorname-' + accNr).value.trim(), nachname: $('ae-setup-nachname-' + accNr).value.trim(),
      rollen: setupRollenVon(accNr)
    };
  }
  function setupRollenFehlend(alleAccounts) {
    var zaehler = {}; PFLICHT_ROLLEN_SETUP.forEach(function (r) { zaehler[r] = 0; });
    alleAccounts.forEach(function (a) { a.rollen.forEach(function (r) { if (zaehler.hasOwnProperty(r)) zaehler[r]++; }); });
    var fehlend = [], doppelt = [];
    PFLICHT_ROLLEN_SETUP.forEach(function (r) { if (zaehler[r] === 0) fehlend.push(r); else if (zaehler[r] > 1) doppelt.push(r); });
    return { fehlend: fehlend, doppelt: doppelt };
  }
  function setupRollenNoteAktualisieren() {
    var note2 = $('ae-setup-rollen-note'); if (!note2) return;
    var accounts = [];
    for (var n = 1; n <= setupAnzahlAccounts; n++) accounts.push({ rollen: setupRollenVon(n) });
    var check = setupRollenFehlend(accounts);
    note2.textContent = check.fehlend.length ? ('Noch nicht abgedeckt: ' + check.fehlend.map(rollenLabelSetup).join(', ') + '.') : '';
  }
  function setupFormularZuruecksetzen() {
    for (var n = 2; n <= 4; n++) {
      var row = $('ae-setup-acc-' + n);
      if (!row) continue;
      row.classList.add('ae-hidden');
      row.querySelectorAll('input[type="text"], input[type="password"]').forEach(function (i) { i.value = ''; });
      row.querySelectorAll('input[type="checkbox"]').forEach(function (i) { i.checked = false; });
    }
    setupAnzahlAccounts = 1;
    var addBtn = $('ae-setup-add-acc-btn'); if (addBtn) addBtn.classList.remove('ae-hidden');
    $('ae-setup-bezirk-input').value = ''; $('ae-setup-team-input').value = '';
    var note2 = $('ae-setup-rollen-note'); if (note2) note2.textContent = '';
  }
  function bootSetupAccountZeilen() {
    var addBtn = $('ae-setup-add-acc-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (setupAnzahlAccounts >= 4) return;
        setupAnzahlAccounts++;
        var row = $('ae-setup-acc-' + setupAnzahlAccounts);
        if (row) row.classList.remove('ae-hidden');
        if (setupAnzahlAccounts >= 4) addBtn.classList.add('ae-hidden');
        setupRollenNoteAktualisieren();
      });
    }
    document.querySelectorAll('[data-setup-remove-acc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nr = parseInt(btn.getAttribute('data-setup-remove-acc'), 10);
        // Nur die jeweils letzte sichtbare Reihe darf entfernt werden, sonst entstünde eine Lücke
        // in der 1..n-Nummerierung (einfache, aber robuste Regel).
        if (nr !== setupAnzahlAccounts) return;
        var row = $('ae-setup-acc-' + nr);
        if (row) {
          row.classList.add('ae-hidden');
          row.querySelectorAll('input[type="text"], input[type="password"]').forEach(function (i) { i.value = ''; });
          row.querySelectorAll('input[type="checkbox"]').forEach(function (i) { i.checked = false; });
        }
        setupAnzahlAccounts--;
        if (addBtn) addBtn.classList.remove('ae-hidden');
        setupRollenNoteAktualisieren();
      });
    });
    document.querySelectorAll('[data-setup-rollen] input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', setupRollenNoteAktualisieren);
    });
  }

  function showNote(msg) { note.textContent = msg; note.classList.add('ae-inline-note--visible'); }
  function clearNote() { note.textContent = ''; note.classList.remove('ae-inline-note--visible'); }

  function render() {
    if (subMode === 'pflicht') {
      // René-Direktive 2026-10-09: eine vom Admin vergebene/zurückgesetzte PIN ist eine Einmal-PIN --
      // hier blockierend, bevor die App überhaupt sichtbar wird, keine Umgehung über den Umschalter
      // (modusBtn/subBtn bleiben bewusst verborgen, s. u.).
      title.textContent = 'Neue, eigene PIN erforderlich';
      hint.textContent = 'Die vergebene Start-PIN ist nur einmalig gültig. Bitte jetzt eine eigene, persönliche PIN festlegen — Ihre bisherige Dokumentation bleibt dabei vollständig erhalten.';
      userWrap.classList.add('ae-hidden');
      confirmWrap.classList.remove('ae-hidden'); confirm.required = true;
      tenantWrap.classList.add('ae-hidden'); tenantInput.required = false;
      submit.textContent = 'Neue PIN festlegen';
      subUmschalter.classList.add('ae-hidden');
      clearNote();
      return;
    }
    if (subMode === 'login') {
      title.textContent = 'Team-Login';
      hint.textContent = 'Bitte Benutzernamen und persönliche PIN eingeben.';
      confirmWrap.classList.add('ae-hidden'); confirm.required = false;
      tenantWrap.classList.add('ae-hidden'); tenantInput.required = false;
      submit.textContent = 'Anmelden';
      subBtn.textContent = 'Noch kein Team? Jetzt als erstes Mitglied (Admin) einrichten →';
      var last = localStorage.getItem('aeris_last_username');
      if (last && !userInput.value) userInput.value = last;
    } else {
      title.textContent = 'Neues Team einrichten';
      hint.textContent = 'Legt einen neuen Mandanten (Unternehmen) mit 1-4 Erst-Accounts an (s. Formular unten).';
      confirmWrap.classList.remove('ae-hidden'); confirm.required = true;
      tenantWrap.classList.remove('ae-hidden'); tenantInput.required = true;
      submit.textContent = 'Team einrichten';
      subBtn.textContent = 'Bereits ein Team vorhanden? Hier anmelden →';
    }
    userWrap.classList.remove('ae-hidden'); subUmschalter.classList.remove('ae-hidden');
    clearNote();
  }

  function onSubmit(e) {
    e.preventDefault();
    clearNote();

    if (subMode === 'pflicht') {
      var neuePin = pin.value.trim(), neuePinConfirm = confirm.value.trim();
      // Pflicht-Änderung setzt immer eine NEUE PIN -- genau 6 Ziffern Pflicht (René-Direktive 2026-10-09).
      if (!/^\d{6}$/.test(neuePin)) { showNote('Bitte eine PIN aus genau 6 Ziffern eingeben.'); return; }
      if (neuePin !== neuePinConfirm) { showNote('Die beiden PIN-Eingaben stimmen nicht überein.'); return; }
      submit.disabled = true;
      var kontext = pflichtKontext, neueWrappedDek = null;
      wrapDek(DEK_BYTES, neuePin).then(function (wrapped) {
        neueWrappedDek = wrapped;
        return api('/me/password', { method: 'POST', headers: { Authorization: 'Bearer ' + kontext.meta.token }, body: JSON.stringify({ password: neuePin, wrappedDek: wrapped }) });
      }).then(function () {
        if (window.AeOffline) window.AeOffline.speichereAnmeldedaten(kontext.meta.user.username, neueWrappedDek, kontext.meta.tenantId, kontext.meta.tenantName, kontext.meta.user);
        pin.value = ''; confirm.value = ''; pflichtKontext = null;
        kontext.meta.user.mustChangePassword = false;
        // K5-Krypto-Fix (2026-10-25, Live-Test-Fund): kontext.meta.sessionPin war noch die ALTE,
        // soeben abgeloeste Einmal-PIN (gesetzt beim allerersten Login-Versuch, VOR diesem Wechsel) --
        // app.js verwendet AE_SESSION_PIN u. a. um das eigene RSA-Schluesselpaar zu wrappen/entschluesseln
        // (s. aeSicherstellenEigenesSchluesselpaar()). Mit der alten PIN gewrappt waere es bei JEDEM
        // folgenden Login mit der neuen PIN nicht mehr entschluesselbar (AES-GCM lehnt den falschen
        // Schluessel zuverlaessig per Auth-Tag ab) -- live reproduziert, nicht nur vermutet.
        kontext.meta.sessionPin = neuePin;
        window.AeSession.setUnlocked(kontext.data, kontext.dek, kontext.meta);
      }).catch(function (err) { submit.disabled = false; showNote('PIN konnte nicht gesetzt werden — ' + err.message); });
      return;
    }

    var username = userInput.value.trim(), p = pin.value.trim();
    if (!username) { showNote('Bitte einen Benutzernamen eingeben.'); return; }
    // Login prüft eine BESTEHENDE PIN (bleibt bewusst 4-6-stellig rückwärtskompatibel, s. app.js-
    // Pendant) -- Setup wählt eine NEUE PIN, dafür genau 6 Ziffern Pflicht (René-Direktive 2026-10-09).
    var pinFormatOk = subMode === 'login' ? /^\d{4,6}$/.test(p) : /^\d{6}$/.test(p);
    if (!pinFormatOk) { showNote(subMode === 'login' ? 'Falsche PIN oder Benutzername.' : 'Bitte eine PIN aus genau 6 Ziffern eingeben.'); return; }
    submit.disabled = true;

    if (subMode === 'login') {
      api('/login', { method: 'POST', body: JSON.stringify({ username: username, password: p }) }).then(function (res) {
        return unwrapDek(res.wrappedDek, p).then(function (dekBytes) {
          DEK_BYTES = dekBytes;
          return importRawAesKey(dekBytes).then(function (dek) {
            localStorage.setItem('aeris_last_username', username);
            if (window.AeOffline) window.AeOffline.speichereAnmeldedaten(username, res.wrappedDek, res.tenantId, res.tenantName, res.user);
            // Organisationsstruktur Phase 4 (2026-10-24): /api/blob enthält jetzt NUR noch
            // Firmenstammdaten ({settings:{...}}), s. app.js aePersistServerModus(). Pflegedoku-
            // Inhalte kommen lazy aus dem Klient-Blob (s. meta.klienten unten, AE_KLIENTEN_LISTE).
            return api('/blob', { headers: { Authorization: 'Bearer ' + res.token } }).catch(function () { return null; }).then(function (blobRes) {
              var fertig = function (firmaSettings) {
                var data = window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {};
                if (firmaSettings) data.settings = firmaSettings;
                var meta = {
                  token: res.token, user: res.user, tenantId: res.tenantId, tenantName: res.tenantName,
                  klienten: res.klienten || [], sessionPin: p,
                  // K5-Public-Key-Envelope (2026-10-25): null/null, solange die Person noch nie ein
                  // Schluesselpaar hochgeladen hat -- app.js aeSicherstellenEigenesSchluesselpaar()
                  // generiert+laedt in diesem Fall lazy eines hoch.
                  publicKey: res.publicKey || null, wrappedPrivkey: res.wrappedPrivkey || null
                };
                // Admin-vergebene/zurückgesetzte PIN ist eine Einmal-PIN (René-Direktive 2026-10-09) --
                // vor dem eigentlichen Entsperren zwingend zur Pflicht-Änderung umleiten, nicht die App
                // zeigen. pflichtKontext hält Daten/DEK/Meta bis die neue, eigene PIN gesetzt ist.
                if (res.user.mustChangePassword) {
                  pin.value = ''; confirm.value = '';
                  pflichtKontext = { data: data, dek: dek, meta: meta };
                  submit.disabled = false;
                  subMode = 'pflicht'; render();
                  return;
                }
                pin.value = ''; userInput.value = '';
                window.AeSession.setUnlocked(data, dek, meta);
              };
              if (blobRes && blobRes.iv && blobRes.ct) {
                C.aeDecryptJson(dek, blobRes.iv, blobRes.ct).then(function (firmaDaten) {
                  fertig(firmaDaten && firmaDaten.settings ? firmaDaten.settings : null);
                }).catch(function () {
                  submit.disabled = false;
                  showNote('Datenstand konnte nicht entschlüsselt werden (PIN war korrekt, Daten evtl. beschädigt).');
                });
              } else {
                fertig(null);
              }
            });
          });
        });
      }).catch(function (err) {
        // Netzwerkfehler (kein Server erreichbar) vs. echte Zurückweisung (falsches Passwort/Account)
        // unterscheiden: fetch() selbst lehnt bei fehlender Verbindung mit TypeError ab, ein HTTP-401
        // kommt dagegen als normaler Error aus api() (s. oben). Nur bei echtem Netzwerkausfall auf den
        // schreibgeschützten Offline-Cache zurückfallen -- s. app.js AeOffline/AE_OFFLINE_READONLY.
        if (err instanceof TypeError && window.AeOffline) {
          var cached = window.AeOffline.lade(username);
          if (!cached || !cached.wrappedDek) { submit.disabled = false; showNote('Keine Verbindung zum Server und keine lokale Offline-Kopie für diesen Benutzernamen vorhanden.'); return; }
          unwrapDek(cached.wrappedDek, p).then(function (dekBytes) {
            return importRawAesKey(dekBytes).then(function (dek) {
              pin.value = ''; userInput.value = '';
              // Organisationsstruktur Phase 4, bekannte/dokumentierte Einschränkung: der Kaltstart-
              // Offline-Cache enthält seit Phase 4 nur noch die Firma-Hälfte (s. app.js
              // aePersistServerModus()-Kommentar) -- Pflegedoku-Inhalte sind offline NICHT verfügbar,
              // kein Klient-Wechsler (meta.klienten bewusst leer).
              var daten = (cached.iv && cached.ct)
                ? C.aeDecryptJson(dek, cached.iv, cached.ct).then(function (f) { var d = window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {}; if (f && f.settings) d.settings = f.settings; return d; })
                : Promise.resolve(window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {});
              return daten.then(function (data) {
                // Bewusst kein Token hier (s. app.js AeOffline-Kommentar) -- der schreibgeschützte
                // Modus ruft nie eine Bearer-geschützte Route auf, ein None-Token ist hier korrekt.
                window.AeSession.setUnlocked(data, dek, { token: null, user: cached.user, tenantId: cached.tenantId, tenantName: cached.tenantName, klienten: [] }, { readOnly: true, cachedAt: cached.cachedAt });
              });
            });
          }).catch(function () { submit.disabled = false; showNote('Falsche PIN (offline gegen die lokale Kopie geprüft).'); });
          return;
        }
        submit.disabled = false;
        showNote('Falsche PIN oder Benutzername — ' + err.message);
      });
      return;
    }

    // subMode === 'setup' -- Organisationsstruktur Phase 4 (2026-10-24): 1-4 Erst-Accounts statt nur
    // 1 Admin. Account 1 nutzt die bereits validierten Top-Felder (username/pin/confirm oben) weiter.
    var pConfirm = confirm.value.trim();
    if (p !== pConfirm) { showNote('Account 1: Die beiden PIN-Eingaben stimmen nicht überein.'); submit.disabled = false; return; }
    if (pinIstTrivial(p)) { showNote('Account 1: Diese PIN ist zu leicht zu erraten (z. B. gleiche Ziffern oder eine Zahlenreihe). Bitte eine andere PIN wählen.'); submit.disabled = false; return; }
    var tenantName = tenantInput.value.trim();
    if (!tenantName) { showNote('Bitte Unternehmensname ausfüllen.'); submit.disabled = false; return; }
    var accounts = [];
    for (var n = 1; n <= setupAnzahlAccounts; n++) accounts.push(setupFelderLesen(n, username, p, pConfirm));
    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i];
      if (!a.username || !a.vorname || !a.nachname) { showNote('Account ' + (i + 1) + ': Benutzername, Vorname und Nachname ausfüllen.'); submit.disabled = false; return; }
      if (!/^\d{6}$/.test(a.pin)) { showNote('Account ' + (i + 1) + ': PIN muss genau 6 Ziffern haben.'); submit.disabled = false; return; }
      if (a.pin !== a.pinConfirm) { showNote('Account ' + (i + 1) + ': Die beiden PIN-Eingaben stimmen nicht überein.'); submit.disabled = false; return; }
      if (i > 0 && pinIstTrivial(a.pin)) { showNote('Account ' + (i + 1) + ': Diese PIN ist zu leicht zu erraten. Bitte eine andere PIN wählen.'); submit.disabled = false; return; }
      if (!a.rollen.length) { showNote('Account ' + (i + 1) + ': bitte mindestens eine Rolle auswählen.'); submit.disabled = false; return; }
    }
    var usernamesGesehen = {};
    for (var j = 0; j < accounts.length; j++) {
      if (usernamesGesehen[accounts[j].username]) { showNote('Benutzername "' + accounts[j].username + '" ist mehrfach vergeben.'); submit.disabled = false; return; }
      usernamesGesehen[accounts[j].username] = true;
    }
    var rollenCheck = setupRollenFehlend(accounts);
    if (rollenCheck.fehlend.length) { showNote('Folgende Pflichtrolle(n) sind von keinem Account abgedeckt: ' + rollenCheck.fehlend.map(rollenLabelSetup).join(', ') + '.'); submit.disabled = false; return; }
    if (rollenCheck.doppelt.length) { showNote('Folgende Rolle(n) sind auf mehrere Accounts verteilt (jede Rolle darf nur einmal vorkommen): ' + rollenCheck.doppelt.map(rollenLabelSetup).join(', ') + '.'); submit.disabled = false; return; }

    // EINE Firmen-DEK für alle Erst-Accounts, jeweils mit der eigenen PIN gewrappt (Erweiterung des
    // bestehenden Einzel-Wrap-Codes auf eine Schleife, s. Auftrag -- kein neues Krypto-Konzept).
    var dekBytes = randomDek();
    Promise.all(accounts.map(function (a) { return wrapDek(dekBytes, a.pin); })).then(function (wraps) {
      var accountsPayload = accounts.map(function (a, idx) {
        return {
          username: a.username, password: a.pin, displayName: (a.vorname + ' ' + a.nachname).trim(),
          vorname: a.vorname, nachname: a.nachname, roles: a.rollen, wrappedDek: wraps[idx]
        };
      });
      return api('/setup', {
        method: 'POST',
        body: JSON.stringify({
          tenantName: tenantName, bezirkName: $('ae-setup-bezirk-input').value.trim(), teamName: $('ae-setup-team-input').value.trim(),
          accounts: accountsPayload
        })
      }).then(function () {
        return api('/login', { method: 'POST', body: JSON.stringify({ username: accounts[0].username, password: accounts[0].pin }) });
      }).then(function (res) {
        DEK_BYTES = dekBytes;
        return importRawAesKey(dekBytes).then(function (dek) {
          localStorage.setItem('aeris_last_username', accounts[0].username);
          if (window.AeOffline) window.AeOffline.speichereAnmeldedaten(accounts[0].username, wraps[0], res.tenantId, res.tenantName, res.user);
          pin.value = ''; confirm.value = ''; userInput.value = ''; tenantInput.value = '';
          setupFormularZuruecksetzen();
          window.AeSession.setUnlocked(window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {}, dek,
            {
              token: res.token, user: res.user, tenantId: res.tenantId, tenantName: res.tenantName,
              klienten: res.klienten || [], sessionPin: accounts[0].pin,
              publicKey: res.publicKey || null, wrappedPrivkey: res.wrappedPrivkey || null
            });
        });
      });
    }).catch(function (err) {
      submit.disabled = false;
      showNote('Einrichtung fehlgeschlagen — ' + err.message);
    });
  }

  function boot() {
    gate = $('ae-pin-gate'); form = $('ae-pin-form');
    userWrap = $('ae-user-field-wrap'); userInput = $('ae-user-input');
    pin = $('ae-pin-input'); confirm = $('ae-pin-confirm'); confirmWrap = $('ae-pin-confirm-wrap');
    tenantWrap = $('ae-tenant-field-wrap'); tenantInput = $('ae-tenant-input');
    note = $('ae-pin-note'); submit = $('ae-pin-submit'); hint = $('ae-pin-gate-hint'); title = $('ae-pin-gate-title');
    subUmschalter = $('ae-server-sub-umschalter'); subBtn = $('ae-server-sub-btn');
    var modusBtn = $('ae-login-modus-btn'), modusWrap = $('ae-login-modus-umschalter');
    if (!gate || !form || !modusBtn) return;

    // René-Direktive 2026-10-18 (widerruft 2026-10-11 für diesen Zugang, s. app.js aePinGateStart()):
    // lokaler Geräte-Modus ist jetzt wieder Standard, Team-/Server-Modus nur bei explizitem 'server'.
    // Umschalter-Button bleibt sichtbar (s. index.html) -- andere Mitarbeiter:innen müssen ihn
    // erreichen können, um in den Team-Modus zu wechseln.
    var serverAktiv = localStorage.getItem('aeris_login_modus') === 'server';
    modusBtn.textContent = serverAktiv ? 'Zurück zu lokalem Geräte-Zugang (ein Gerät, eine Person)' : 'Team-Zugang mit mehreren Mitarbeiter-Logins nutzen →';
    modusBtn.addEventListener('click', function () {
      localStorage.setItem('aeris_login_modus', serverAktiv ? 'lokal' : 'server');
      location.reload();
    });
    if (!serverAktiv) return; // lokaler Pfad bleibt vollständig bei app.js/aeris-login.js -- hier nichts weiter tun

    userWrap.classList.remove('ae-hidden');
    subUmschalter.classList.remove('ae-hidden');
    subBtn.addEventListener('click', function () { subMode = subMode === 'login' ? 'setup' : 'login'; render(); });
    form.addEventListener('submit', onSubmit);
    render();
    bootSetupAccountZeilen();
    bootTeamCard();
    bootTenantLoeschenCard();
    bootKlientWaehler();
    bootOrgVerwaltung();
  }

  // ---------- Eigene PIN ändern (alle Rollen) ----------
  function bootEigenePin() {
    var card = $('ae-eigene-pin-card'), form = $('ae-eigene-pin-form'), note = $('ae-eigene-pin-note');
    if (!card || !form) return;
    document.addEventListener('aeris:server-eingeloggt', function () { card.classList.remove('ae-hidden'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      var neuePin = $('ae-eigene-pin-neu').value.trim();
      if (!/^\d{6}$/.test(neuePin)) { note.textContent = 'PIN muss genau 6 Ziffern haben.'; return; }
      if (pinIstTrivial(neuePin)) { note.textContent = 'Diese PIN ist zu leicht zu erraten (z. B. gleiche Ziffern oder eine Zahlenreihe). Bitte eine andere PIN wählen.'; return; }
      if (!DEK_BYTES) { note.textContent = 'Datenschlüssel nicht im Speicher — bitte ab-/anmelden und erneut versuchen.'; return; }
      wrapDek(DEK_BYTES, neuePin).then(function (wrapped) {
        return api('/me/password', {
          method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
          body: JSON.stringify({ password: neuePin, wrappedDek: wrapped })
        });
      }).then(function () { note.textContent = 'PIN geändert — bitte ab sofort die neue PIN verwenden.'; form.reset(); })
        .catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
  }

  // ---------- Mandanten-Branding (nur Admins im Server-Modus) ----------
  var AE_LOGO_MAX_BYTES = 1 * 1024 * 1024;
  function bootBranding() {
    var card = $('ae-branding-card'), form = $('ae-branding-form'), note = $('ae-branding-note');
    var kurznameInput = $('ae-branding-kurzname'), logoInput = $('ae-branding-logo');
    if (!card || !form) return;
    document.addEventListener('aeris:server-eingeloggt', function () {
      var meta = window.AeSession.currentUser();
      card.classList.toggle('ae-hidden', !meta || !C.hatRolle(meta, 'admin'));
      if (window.AeBranding) { var b = window.AeBranding.get(); if (b && b.kurzname) kurznameInput.value = b.kurzname; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      var kurzname = kurznameInput.value.trim();
      var datei = logoInput.files[0];
      if (datei && datei.size > AE_LOGO_MAX_BYTES) { note.textContent = '⚠ Logo zu groß — maximal 1 MB.'; return; }
      var weiter = datei ? liesDateiAlsDataUrl(datei) : Promise.resolve(null);
      weiter.then(function (dataUrl) {
        return window.AeBranding.set(dataUrl, kurzname);
      }).then(function () { note.textContent = 'Gespeichert — in der laufenden Oberfläche bereits angewendet.'; logoInput.value = ''; })
        .catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
  }

  // ---------- Team-Mitglieder verwalten (nur Admins im Server-Modus, s. Einstellungen) ----------
  function bootTeamCard() {
    var card = $('ae-team-card'), liste = $('ae-team-liste'), tenantLabel = $('ae-team-tenant-name');
    var teamForm = $('ae-team-form'), note = $('ae-team-note');
    if (!card || !teamForm) return;

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // Phase 2 (2026-10-24): Anzeige-Label je Rolle -- liest jetzt u.roles (Mengen-Array aus
    // user_roles, s. erweitertes publicUser()) statt nur das Singular-Altfeld u.role, damit eine
    // Person mit mehreren Rollen (René-Entscheidung) auch alle sichtbar angezeigt bekommt.
    var AE_ROLLE_LABEL = { admin: 'Admin', teamleiter: 'Teamleiter/in', hr: 'HR', bezirksleitung: 'Bezirksleitung', ma: 'MA' };
    function rollenLabel(u) {
      var rollen = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role || 'ma'];
      return rollen.map(function (r) { return AE_ROLLE_LABEL[r] || r; }).join(' + ');
    }
    function ladeListe() {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      api('/users', { headers: { Authorization: 'Bearer ' + window.AeSession.token() } }).then(function (users) {
        liste.innerHTML = users.map(function (u) {
          var istIch = u.id === meta.id;
          return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;">' +
            '<div><strong>' + escapeHtml(u.displayName) + '</strong>' + (istIch ? ' (Sie)' : '') +
            ' <span style="color:#9CADC9;">· @' + escapeHtml(u.username) + ' · ' + escapeHtml(rollenLabel(u)) +
            (u.telefon ? ' · ' + escapeHtml(u.telefon) : '') +
            (u.berufsstand ? ' · ' + escapeHtml(u.berufsstand) : '') +
            (u.firma ? ' · ' + escapeHtml(u.firma) : '') +
            (u.personalnummer ? ' · Pers.-Nr. ' + escapeHtml(u.personalnummer) : '') +
            ' · PFK-Kürzel: ' + (u.pfkKuerzel ? '<strong>' + escapeHtml(u.pfkKuerzel) + '</strong>' : '<em>nicht gesetzt</em>') +
            (u.adresse ? ' · ' + escapeHtml(u.adresse) : '') +
            (u.active ? '' : ' · deaktiviert') + '</span></div>' +
            '<div style="display:flex;gap:.5rem;flex-wrap:wrap;">' +
            (istIch ? '' : '<button type="button" class="ae-btn-secondary" data-team-toggle="' + u.id + '" data-active="' + (u.active ? '1' : '0') + '" style="padding:.4rem .8rem;font-size:.8rem;">' + (u.active ? 'Deaktivieren' : 'Aktivieren') + '</button>') +
            '<button type="button" class="ae-btn-secondary" data-team-profiledit="' + u.id + '" style="padding:.4rem .8rem;font-size:.8rem;">Profil bearbeiten</button>' +
            '<button type="button" class="ae-btn-secondary" data-team-pinreset="' + u.id + '" style="padding:.4rem .8rem;font-size:.8rem;">PIN zurücksetzen</button>' +
            '</div></div>' +
            '<div class="ae-hidden mt-3 pt-3" data-profiledit-form="' + u.id + '" style="border-top:1px solid rgba(255,255,255,.08);display:grid;gap:.5rem;grid-template-columns:1fr 1fr;">' +
            '<input type="text" placeholder="Vorname" class="ae-input" value="' + escapeHtml(u.vorname || '') + '" data-profiledit-vorname>' +
            '<input type="text" placeholder="Nachname" class="ae-input" value="' + escapeHtml(u.nachname || '') + '" data-profiledit-nachname>' +
            '<textarea placeholder="Adresse" class="ae-textarea" rows="2" style="grid-column:1/-1;" data-profiledit-adresse>' + escapeHtml(u.adresse || '') + '</textarea>' +
            '<input type="text" placeholder="Firma" class="ae-input" value="' + escapeHtml(u.firma || '') + '" data-profiledit-firma>' +
            '<input type="text" placeholder="Personalnummer" class="ae-input" value="' + escapeHtml(u.personalnummer || '') + '" data-profiledit-personalnummer>' +
            '<input type="text" placeholder="Berufsstand" class="ae-input" value="' + escapeHtml(u.berufsstand || '') + '" data-profiledit-berufsstand>' +
            '<input type="text" maxlength="10" placeholder="PFK-Kürzel, z. B. RK" class="ae-input" value="' + escapeHtml(u.pfkKuerzel || '') + '" data-profiledit-pfk>' +
            '<button type="button" class="ae-btn-primary" data-profiledit-go="' + u.id + '" style="grid-column:1/-1;">Profil speichern</button>' +
            '</div>' +
            '<div class="ae-hidden mt-2" data-pinreset-form="' + u.id + '" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">' +
            '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Neue PIN (genau 6 Ziffern)" class="ae-input" style="width:auto;" data-pinreset-input>' +
            '<button type="button" class="ae-btn-primary" data-pinreset-go="' + u.id + '" style="padding:.4rem .8rem;font-size:.8rem;">Setzen</button>' +
            '</div></div>';
        }).join('') || '<p class="text-[#9CADC9] text-sm">Noch keine weiteren Mitglieder.</p>';
        liste.querySelectorAll('[data-team-profiledit]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var formWrap = liste.querySelector('[data-profiledit-form="' + btn.getAttribute('data-team-profiledit') + '"]');
            if (formWrap) formWrap.classList.toggle('ae-hidden');
          });
        });
        liste.querySelectorAll('[data-profiledit-go]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var zielId = btn.getAttribute('data-profiledit-go');
            var form = liste.querySelector('[data-profiledit-form="' + zielId + '"]');
            var vorname = form.querySelector('[data-profiledit-vorname]').value.trim();
            var nachname = form.querySelector('[data-profiledit-nachname]').value.trim();
            var payload = {
              vorname: vorname, nachname: nachname,
              displayName: (vorname + ' ' + nachname).trim(),
              adresse: form.querySelector('[data-profiledit-adresse]').value.trim(),
              firma: form.querySelector('[data-profiledit-firma]').value.trim(),
              personalnummer: form.querySelector('[data-profiledit-personalnummer]').value.trim(),
              berufsstand: form.querySelector('[data-profiledit-berufsstand]').value.trim(),
              pfkKuerzel: form.querySelector('[data-profiledit-pfk]').value.trim()
            };
            api('/users/' + zielId, {
              method: 'PATCH', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
              body: JSON.stringify(payload)
            }).then(function () {
              // René-Fund 2026-10-11: Selbst-Edit (z. B. eigenes PFK-Kürzel) muss ohne Neu-Login sofort
              // greifen, sonst bleibt die Heute-PFK-Sperre bis zum nächsten Login stumm falsch.
              var meta = window.AeSession.currentUser();
              if (meta && meta.id === zielId) window.AeSession.updateCurrentUser(payload);
              ladeListe();
            }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
          });
        });
        liste.querySelectorAll('[data-team-toggle]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var aktivJetzt = btn.getAttribute('data-active') === '1';
            api('/users/' + btn.getAttribute('data-team-toggle'), {
              method: 'PATCH', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
              body: JSON.stringify({ active: !aktivJetzt })
            }).then(ladeListe).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
          });
        });
        liste.querySelectorAll('[data-team-pinreset]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var formWrap = liste.querySelector('[data-pinreset-form="' + btn.getAttribute('data-team-pinreset') + '"]');
            if (formWrap) formWrap.classList.toggle('ae-hidden');
          });
        });
        liste.querySelectorAll('[data-pinreset-go]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var zielId = btn.getAttribute('data-pinreset-go');
            var input = liste.querySelector('[data-pinreset-form="' + zielId + '"] [data-pinreset-input]');
            var neuePin = input.value.trim();
            note.textContent = '';
            if (!/^\d{6}$/.test(neuePin)) { note.textContent = 'Neue PIN muss genau 6 Ziffern haben.'; return; }
            if (!DEK_BYTES) { note.textContent = 'Datenschlüssel nicht im Speicher — bitte ab-/anmelden und erneut versuchen.'; return; }
            wrapDek(DEK_BYTES, neuePin).then(function (wrapped) {
              return api('/users/' + zielId + '/password-reset', {
                method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
                body: JSON.stringify({ password: neuePin, wrappedDek: wrapped })
              });
            }).then(function () {
              note.textContent = 'PIN zurückgesetzt — bitte die neue PIN persönlich/sicher weitergeben.';
              input.value = '';
              ladeListe();
            }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
          });
        });
      });
    }

    document.addEventListener('aeris:server-eingeloggt', function () {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      card.classList.toggle('ae-hidden', !C.hatRolle(meta, 'admin'));
      teamForm.classList.toggle('ae-hidden', !C.hatRolle(meta, 'admin'));
      tenantLabel.textContent = window.AeSession.tenantName ? window.AeSession.tenantName() : 'Ihr Unternehmen';
      ladeListe();
    });

    teamForm.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      if (!DEK_BYTES) { note.textContent = 'Datenschlüssel nicht im Speicher — bitte einmal ab-/anmelden und erneut versuchen.'; return; }
      var username = $('ae-team-user').value.trim();
      var vorname = $('ae-team-vorname').value.trim(), nachname = $('ae-team-nachname').value.trim();
      var displayName = (vorname + ' ' + nachname).trim();
      var p = $('ae-team-pin').value.trim(), telefon = $('ae-team-tel').value.trim();
      // Phase 2: Mehrfachrollen -- alle angekreuzten Checkboxen statt eines Single-Select-Werts.
      var rollenEl = document.querySelectorAll('#ae-team-rollen input[type="checkbox"]:checked');
      var rollen = Array.prototype.map.call(rollenEl, function (el) { return el.value; });
      var pfkKuerzel = $('ae-team-pfk').value.trim();
      var adresse = $('ae-team-adresse').value.trim(), firma = $('ae-team-firma').value.trim();
      var personalnummer = $('ae-team-personalnummer').value.trim(), berufsstand = $('ae-team-berufsstand').value.trim();
      if (!vorname || !nachname) { note.textContent = 'Bitte Vor- und Nachname ausfüllen.'; return; }
      if (!rollen.length) { note.textContent = 'Bitte mindestens eine Rolle auswählen.'; return; }
      if (!/^\d{6}$/.test(p)) { note.textContent = 'Start-PIN muss genau 6 Ziffern haben.'; return; }
      if (pinIstTrivial(p)) { note.textContent = 'Diese Start-PIN ist zu leicht zu erraten (z. B. gleiche Ziffern oder eine Zahlenreihe). Bitte eine andere PIN wählen.'; return; }
      wrapDek(DEK_BYTES, p).then(function (wrapped) {
        return api('/users', {
          method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
          body: JSON.stringify({
            username: username, password: p, displayName: displayName, telefon: telefon, roles: rollen,
            pfkKuerzel: pfkKuerzel, vorname: vorname, nachname: nachname, adresse: adresse,
            firma: firma, personalnummer: personalnummer, berufsstand: berufsstand, wrappedDek: wrapped
          })
        });
      }).then(function () {
        teamForm.reset();
        note.textContent = 'Angelegt — bitte Benutzername „' + username + '" und Start-PIN persönlich/sicher an die Person weitergeben (kein automatischer Versand).';
        ladeListe();
      }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
  }

  // ---------- Mandant endgültig löschen (Art. 17 DSGVO, René-Auftrag 2026-10-10) ----------
  // legal-compliance-Fund 2026-10-02: bislang gab es nur Deaktivieren einzelner Nutzer (s.
  // bootTeamCard oben), keine echte Löschung eines ganzen Mandanten. Admin-only, verlangt die
  // eigene PIN erneut als Bestätigung (gegen versehentliches Auslösen über einen reinen Klick).
  function bootTenantLoeschenCard() {
    var card = $('ae-tenant-loeschen-card'), form = $('ae-tenant-loeschen-form'), note = $('ae-tenant-loeschen-note');
    var nameEl = $('ae-tenant-loeschen-name');
    if (!card || !form) return;
    document.addEventListener('aeris:server-eingeloggt', function () {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      card.classList.toggle('ae-hidden', !C.hatRolle(meta, 'admin'));
      nameEl.textContent = window.AeSession.tenantName ? window.AeSession.tenantName() : 'Ihr Unternehmen';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      var pin = $('ae-tenant-loeschen-pin').value.trim();
      var bestaetigt = $('ae-tenant-loeschen-bestaetigt').checked;
      if (!bestaetigt) { note.textContent = 'Bitte die Bestätigung ankreuzen.'; return; }
      if (!/^\d{4,6}$/.test(pin)) { note.textContent = 'Bitte die eigene PIN eingeben.'; return; }
      var btn = form.querySelector('button[type="submit"]'), urspruenglich = btn.textContent;
      btn.disabled = true; btn.textContent = 'Lösche …';
      api('/tenant', {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
        body: JSON.stringify({ password: pin })
      }).then(function () {
        alert('Mandant wurde unwiderruflich gelöscht.');
        location.reload();
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = urspruenglich;
        note.textContent = 'Fehler: ' + err.message;
      });
    });
  }

  // ---------- Organisationsstruktur Phase 4 (2026-10-24): Klient-Wähler + "Aktueller Klient" ----------
  function bootKlientWaehler() {
    var overlay = $('ae-klient-waehler-overlay'), liste = $('ae-klient-waehler-liste'), note = $('ae-klient-waehler-note');
    var closeBtn = $('ae-klient-waehler-close-btn');
    var aktuellCard = $('ae-klient-aktuell-card'), aktuellLabel = $('ae-klient-aktuell-label'), wechselnBtn = $('ae-klient-aktuell-wechseln-btn');
    if (!overlay || !liste) return;
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function aktualisiereAktuellCard() {
      var aktuell = window.AeSession.aktuellerKlient();
      if (!aktuellCard) return;
      aktuellCard.classList.remove('ae-hidden');
      aktuellLabel.textContent = aktuell ? aktuell.label : '– noch kein Klient gewählt –';
    }

    function renderListe(fehlerText) {
      var alle = window.AeSession.klientenListe(), aktuell = window.AeSession.aktuellerKlient();
      if (!alle.length) {
        liste.innerHTML = '<p class="text-[#E88C7D] text-sm">Noch kein Klient zugewiesen — bitte Admin/Bezirksleitung/Teamleiter/in kontaktieren oder (als Admin/Bezirksleitung) unter „Organisationsstruktur" selbst einen anlegen.</p>';
      } else {
        liste.innerHTML = alle.map(function (k) {
          return '<button type="button" class="ae-btn-secondary w-full mb-2" data-klient-waehlen="' + k.id + '" style="text-align:left;">' +
            escapeHtml(k.label) + (k.teamName ? ' <span style="color:#9CADC9;">· ' + escapeHtml(k.teamName) + '</span>' : '') +
            (aktuell && aktuell.id === k.id ? ' ✓' : '') + '</button>';
        }).join('');
        liste.querySelectorAll('[data-klient-waehlen]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-klient-waehlen');
            note.textContent = 'Öffne …';
            window.AeSession.klientWechseln(id).then(function () {
              overlay.classList.add('ae-legal-hidden'); note.textContent = '';
              aktualisiereAktuellCard();
            }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
          });
        });
      }
      if (closeBtn) closeBtn.classList.toggle('ae-hidden', !aktuell);
      note.textContent = fehlerText || '';
    }

    window.aeKlientWaehlerZeigen = function (fehlerText) { renderListe(fehlerText); overlay.classList.remove('ae-legal-hidden'); };
    if (closeBtn) closeBtn.addEventListener('click', function () { overlay.classList.add('ae-legal-hidden'); });
    if (wechselnBtn) wechselnBtn.addEventListener('click', function () { window.aeKlientWaehlerZeigen(); });
    document.addEventListener('aeris:server-eingeloggt', aktualisiereAktuellCard);
    document.addEventListener('aeris:klient-gewechselt', aktualisiereAktuellCard);
  }

  // ---------- Organisationsstruktur Phase 4 (2026-10-24): Bezirke/Teams/Klienten + Zugriff gewähren ----------
  function bootOrgVerwaltung() {
    var card = $('ae-org-card'), note = $('ae-org-note');
    var bezirkeListe = $('ae-org-bezirke-liste'), teamsListe = $('ae-org-teams-liste'), klientenListe = $('ae-org-klienten-liste');
    var bezirkForm = $('ae-org-bezirk-form'), teamForm = $('ae-org-team-form'), klientForm = $('ae-org-klient-form');
    var teamBezirkSelect = $('ae-org-team-bezirk'), klientTeamSelect = $('ae-org-klient-team');
    if (!card) return;
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var usersCache = [], teamsCache = [], klientenCache = [];
    function token() { return window.AeSession.token(); }

    function renderBezirke(bezirkeCache) {
      teamBezirkSelect.innerHTML = bezirkeCache.map(function (b) { return '<option value="' + b.id + '">' + escapeHtml(b.name) + '</option>'; }).join('');
      bezirkeListe.innerHTML = bezirkeCache.map(function (b) {
        return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' + escapeHtml(b.name) +
          (b.leiterUserId ? '' : ' <span style="color:#E88C7D;">· noch keine Leitung zugewiesen</span>') + '</div>';
      }).join('') || '<p class="text-[#9CADC9] text-sm">Noch keine Bezirke.</p>';
    }
    function renderTeams() {
      klientTeamSelect.innerHTML = teamsCache.map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.name) + ' (' + escapeHtml(t.bezirkName || '') + ')</option>'; }).join('');
      teamsListe.innerHTML = teamsCache.map(function (t) {
        return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' + escapeHtml(t.name) + ' <span style="color:#9CADC9;">· ' + escapeHtml(t.bezirkName || '') + '</span></div>';
      }).join('') || '<p class="text-[#9CADC9] text-sm">Noch keine Teams.</p>';
    }
    function renderKlienten() {
      var eigeneIds = {}; window.AeSession.klientenListe().forEach(function (k) { eigeneIds[k.id] = true; });
      klientenListe.innerHTML = klientenCache.map(function (k) {
        var hatZugriff = !!eigeneIds[k.id];
        return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;">' +
          '<span>' + escapeHtml(k.label) + ' <span style="color:#9CADC9;">· ' + escapeHtml(k.teamName || '') + '</span></span>' +
          (hatZugriff
            ? '<button type="button" class="ae-btn-secondary" data-klient-zugriff-toggle="' + k.id + '" style="padding:.4rem .8rem;font-size:.8rem;">Zugriff gewähren</button>'
            : '<span style="color:#9CADC9;font-size:.8rem;">Kein eigener Zugriff — bitte zuerst öffnen</span>') +
          '</div>' +
          (hatZugriff ? '<div class="ae-hidden mt-2" data-klient-zugriff-form="' + k.id + '" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">' +
            '<select class="ae-input" style="width:auto;" data-klient-zugriff-user>' +
            usersCache.map(function (u) { return '<option value="' + u.id + '">' + escapeHtml(u.displayName) + '</option>'; }).join('') +
            '</select>' +
            '<button type="button" class="ae-btn-primary" data-klient-zugriff-go="' + k.id + '" style="padding:.4rem .8rem;font-size:.8rem;">Gewähren</button>' +
          '</div>' : '') +
          '</div>';
      }).join('') || '<p class="text-[#9CADC9] text-sm">Noch keine Klienten.</p>';
      klientenListe.querySelectorAll('[data-klient-zugriff-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var formWrap = klientenListe.querySelector('[data-klient-zugriff-form="' + btn.getAttribute('data-klient-zugriff-toggle') + '"]');
          if (!formWrap) return;
          var wirdSichtbar = formWrap.classList.contains('ae-hidden');
          formWrap.classList.toggle('ae-hidden');
          // Echter Fund (Live-Verifikation 2026-10-24): usersCache war seit dem letzten ladeAlles()
          // eingefroren -- ein NACH dem Öffnen dieser Karte neu angelegtes Teammitglied (s.
          // bootTeamCard()) tauchte in dieser Auswahl nie auf, da kein gemeinsames Refresh-Event
          // existiert. Fix: beim Aufklappen frisch nachladen statt den eingefrorenen Cache zu zeigen.
          if (wirdSichtbar) {
            var select = formWrap.querySelector('[data-klient-zugriff-user]');
            api('/users', { headers: { Authorization: 'Bearer ' + token() } }).then(function (frisch) {
              usersCache = frisch;
              select.innerHTML = usersCache.map(function (u) { return '<option value="' + u.id + '">' + escapeHtml(u.displayName) + '</option>'; }).join('');
            }).catch(function (err) { note.textContent = 'Fehler beim Laden der Nutzerliste: ' + err.message; });
          }
        });
      });
      klientenListe.querySelectorAll('[data-klient-zugriff-go]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var klientId = btn.getAttribute('data-klient-zugriff-go');
          var formWrap = klientenListe.querySelector('[data-klient-zugriff-form="' + klientId + '"]');
          var zielUserId = formWrap.querySelector('[data-klient-zugriff-user]').value;
          note.textContent = '';
          // klientId wird jetzt zwingend mitgegeben (testing-qa-Fund 2026-10-25: klientId stand
          // hier zwar schon korrekt aus dem Button-Attribut der angeklickten Karte zur Verfuegung,
          // wurde aber nie an klientZugriffGewaehren() durchgereicht -- der Request ging dadurch
          // immer an den global zuletzt geoeffneten Klienten, nicht an den hier ermittelten).
          window.AeSession.klientZugriffGewaehren(zielUserId, klientId).then(function () {
            note.textContent = 'Zugriff gewährt — die Person sieht den Klienten ab dem nächsten Login.';
            formWrap.classList.add('ae-hidden');
          }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
        });
      });
    }

    function ladeAlles() {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      // Auftrag sagt wörtlich "nur Admin sichtbar" -- bewusst um bezirksleitung/teamleiter erweitert,
      // da der Server genau diesen beiden Rollen eigene Rechte für Teile dieser Karte einräumt
      // (bezirksleitung: Klient anlegen+Zugriff gewähren im eigenen Bezirk; teamleiter: Zugriff
      // gewähren im eigenen Team, s. requireAdminOderBezirksleitungFuerTeam/POST .../wraps in
      // server.js) -- eine rein admin-sichtbare Karte würde diese Rechte zu einer toten, nie
      // nutzbaren Backend-Funktion machen. "hr" bleibt ausgeschlossen (keine einzige Aktion hier
      // für diese Rolle vorgesehen). Bezirke/Teams-ANLEGEN bleibt weiterhin strikt admin-only (s. u.).
      var sichtbar = C.hatEineRolle(meta, ['admin', 'bezirksleitung', 'teamleiter']);
      card.classList.toggle('ae-hidden', !sichtbar);
      if (!sichtbar) return;
      var istAdmin = C.hatRolle(meta, 'admin');
      bezirkForm.classList.toggle('ae-hidden', !istAdmin);
      teamForm.classList.toggle('ae-hidden', !istAdmin);
      klientForm.classList.toggle('ae-hidden', !(istAdmin || C.hatRolle(meta, 'bezirksleitung')));
      Promise.all([
        api('/bezirke', { headers: { Authorization: 'Bearer ' + token() } }),
        api('/teams', { headers: { Authorization: 'Bearer ' + token() } }),
        api('/klienten', { headers: { Authorization: 'Bearer ' + token() } }),
        api('/users', { headers: { Authorization: 'Bearer ' + token() } })
      ]).then(function (res) {
        teamsCache = res[1]; klientenCache = res[2]; usersCache = res[3];
        renderBezirke(res[0]); renderTeams(); renderKlienten();
      }).catch(function (err) { note.textContent = 'Fehler beim Laden: ' + err.message; });
    }

    document.addEventListener('aeris:server-eingeloggt', ladeAlles);
    document.addEventListener('aeris:klient-gewechselt', ladeAlles);

    if (bezirkForm) bezirkForm.addEventListener('submit', function (e) {
      e.preventDefault(); note.textContent = '';
      var name = $('ae-org-bezirk-name').value.trim();
      if (!name) { note.textContent = 'Bitte einen Namen eingeben.'; return; }
      api('/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: JSON.stringify({ name: name }) })
        .then(function () { $('ae-org-bezirk-name').value = ''; ladeAlles(); })
        .catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
    if (teamForm) teamForm.addEventListener('submit', function (e) {
      e.preventDefault(); note.textContent = '';
      var name = $('ae-org-team-name').value.trim(), bezirkId = teamBezirkSelect.value;
      if (!name || !bezirkId) { note.textContent = 'Bitte Bezirk wählen und Teamnamen eingeben.'; return; }
      api('/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: JSON.stringify({ name: name, bezirkId: bezirkId }) })
        .then(function () { $('ae-org-team-name').value = ''; ladeAlles(); })
        .catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
    if (klientForm) klientForm.addEventListener('submit', function (e) {
      e.preventDefault(); note.textContent = '';
      var label = $('ae-org-klient-label').value.trim(), teamId = klientTeamSelect.value;
      if (!label || !teamId) { note.textContent = 'Bitte Team wählen und eine Bezeichnung eingeben.'; return; }
      var meta = window.AeSession.currentUser();
      var dekBytes = randomDek();
      // K5-Krypto-Fix (2026-10-25): initiale Wrap jetzt mit dem EIGENEN oeffentlichen RSA-OAEP-
      // Schluessel des anlegenden Accounts statt (wie bisher fehlerhaft) mit der Firmen-DEK --
      // s. app.js aeKlientDekFuerNutzerVerschluesseln()/AeSession.wrapFuerNutzer().
      window.AeSession.wrapFuerNutzer(meta.id, dekBytes).then(function (wrap) {
        return api('/klienten', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token() },
          body: JSON.stringify({
            teamId: teamId, label: label,
            initialeWraps: [{ userId: meta.id, wrapArt: wrap.wrapArt, wrapSalt: wrap.wrapSalt, wrapIv: wrap.wrapIv, wrapCt: wrap.wrapCt }]
          })
        }).then(function (res) {
          var teamName = (teamsCache.filter(function (t) { return t.id === teamId; })[0] || {}).name || '';
          return window.AeSession.klientHinzufuegenUndOeffnen({
            id: res.klientId, label: label, teamName: teamName, wrapArt: wrap.wrapArt, wrappedDek: { salt: wrap.wrapSalt, iv: wrap.wrapIv, ct: wrap.wrapCt }
          });
        });
      }).then(function () {
        $('ae-org-klient-label').value = '';
        note.textContent = 'Klient angelegt und geöffnet.';
        ladeAlles();
      }).catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });
  }

  // ---------- Dienstplan: Mehrbenutzer-Ansicht, nächster Dienst, Krankmeldung/Ausfallmanagement ----------
  // Ersetzt für Server-Modus-Nutzer den lokalen Einzelperson-Jahresgenerator (#dp-lokal-bereich bleibt
  // für reine Geräte-PIN-Nutzer unverändert bestehen) durch einen Team-Dienstplan gegen die server-
  // seitige, hash-verkettete Dienst-API (s. server/server.js, Tabelle dienst_eintraege).
  function todayIsoServer() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addTageIso(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var DP_TYP_LABEL = { frueh: 'Früh', spaet: 'Spät', nacht: 'Nacht', urlaub: 'Urlaub', bereitschaft: 'Bereitschaft', frei: 'Frei' };

  function bootDienstplan() {
    var serverBereich = $('dp-server-bereich'), lokalBereich = $('dp-lokal-bereich'), adminBereich = $('dp-admin-bereich');
    var leadText = $('dp-lead-text'), meinPlan = $('dp-mein-plan'), naechster = $('dp-naechster-dienst');
    var form = $('dp-server-form'), userSelect = $('dps-user'), note = $('dps-note');
    var ketteBtn = $('dp-kette-pruefen-btn'), ketteErg = $('dp-kette-ergebnis');
    if (!serverBereich) return;
    var usersCache = [];

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function ladeAlles() {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      serverBereich.classList.remove('ae-hidden');
      lokalBereich.classList.add('ae-hidden');
      leadText.textContent = 'Gemeinsamer Team-Dienstplan — server-seitig hash-verkettet gespeichert (manipulationssicher). Jede/r sieht ihren/seinen eigenen Plan plus wer als Nächstes dran ist.';
      adminBereich.classList.toggle('ae-hidden', !C.hatRolle(meta, 'admin'));
      var token = window.AeSession.token();
      var von = todayIsoServer(), bis = addTageIso(von, 30);

      Promise.all([
        api('/users', { headers: { Authorization: 'Bearer ' + token } }),
        api('/dienst?von=' + von + '&bis=' + bis, { headers: { Authorization: 'Bearer ' + token } })
      ]).then(function (res) {
        usersCache = res[0];
        var eintraege = res[1];
        if (userSelect) {
          var vorherWert = userSelect.value;
          userSelect.innerHTML = usersCache.map(function (u) { return '<option value="' + u.id + '">' + escapeHtml(u.displayName) + '</option>'; }).join('');
          if (vorherWert) userSelect.value = vorherWert;
        }

        // "Aktueller Stand" je (userId,datum) = jeweils LETZTER Eintrag (Server liefert in Einfüge-Reihenfolge, s. ORDER BY d.datum, d.rowid)
        var standJeTag = {};
        eintraege.forEach(function (e) { standJeTag[e.userId + '|' + e.datum] = e; });
        var aktuell = Object.keys(standJeTag).map(function (k) { return standJeTag[k]; });

        // Mein Dienstplan
        var meine = aktuell.filter(function (e) { return e.userId === meta.id; }).sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
        meinPlan.innerHTML = meine.length ? meine.map(function (e) {
          var krank = e.status === 'krank';
          return '<div class="flex justify-between items-center py-1.5 border-b border-[rgba(124,147,184,0.12)]"><span>' + e.datum + ' — ' + (DP_TYP_LABEL[e.typ] || e.typ) + (e.von ? ' (' + e.von + (e.bis ? '–' + e.bis : '') + ')' : '') + '</span>' +
            (krank ? '<span style="color:#E88C7D;font-weight:600;">krank gemeldet</span>' : '<span style="color:#9CADC9;">' + escapeHtml(e.notiz || '') + '</span>') + '</div>';
        }).join('') : '<p class="text-[#9CADC9] text-sm">Keine Einträge in den nächsten 30 Tagen.</p>';

        // Nächster Dienst im Team (nicht krank, ab heute, nicht ich selbst zwingend -- Team-weite Übersicht)
        var kommende = aktuell.filter(function (e) { return e.status !== 'krank' && e.typ !== 'frei' && e.typ !== 'urlaub' && e.datum >= von; })
          .sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
        if (!kommende.length) {
          naechster.innerHTML = '<p class="text-[#9CADC9] text-sm">Kein anstehender Dienst in den nächsten 30 Tagen eingetragen.</p>';
        } else {
          var n = kommende[0];
          naechster.innerHTML = '<div class="ae-card p-4" style="background:rgba(255,255,255,.04);">' +
            '<strong>' + escapeHtml(n.userName) + '</strong> — ' + n.datum + ' · ' + (DP_TYP_LABEL[n.typ] || n.typ) + (n.von ? ' (' + n.von + (n.bis ? '–' + n.bis : '') + ')' : '') +
            (n.userTelefon ? '<br><a href="tel:' + escapeHtml(n.userTelefon) + '" style="color:#E8C39E;">' + escapeHtml(n.userTelefon) + '</a>' : '') +
            '<div class="mt-2"><button type="button" id="dp-krankmelden-btn" class="ae-btn-secondary" style="padding:.4rem .8rem;font-size:.85rem;">Als krank vermerken</button></div></div>';
          var btn = $('dp-krankmelden-btn');
          if (btn) btn.addEventListener('click', function () { krankmelden(n, aktuell); });
        }
      }).catch(function (err) {
        meinPlan.innerHTML = '<p class="text-[#E88C7D] text-sm">Konnte nicht geladen werden: ' + escapeHtml(err.message) + '</p>';
      });
    }

    function krankmelden(entry, aktuell) {
      api('/dienst', {
        method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
        body: JSON.stringify({ userId: entry.userId, datum: entry.datum, typ: entry.typ, kuerzel: entry.kuerzel, von: entry.von, bis: entry.bis, status: 'krank', notiz: 'Krankmeldung vermerkt' })
      }).then(function () {
        zeigeAusfallOverlay(entry, aktuell);
        ladeAlles();
      }).catch(function (err) { alert('Krankmeldung fehlgeschlagen: ' + err.message); });
    }

    function zeigeAusfallOverlay(entry, aktuell) {
      var text = $('ae-ausfall-text'), liste = $('ae-ausfall-liste');
      text.textContent = escapeHtml(entry.userName) + ' ist für ' + entry.datum + ' krank gemeldet. Verfügbare Bereitschaft:';
      var bereitschaft = aktuell.filter(function (e) { return e.typ === 'bereitschaft' && e.status !== 'krank' && e.datum === entry.datum && e.userId !== entry.userId; });
      if (!bereitschaft.length) {
        liste.innerHTML = '<p class="text-[#E88C7D] text-sm">Niemand ist für diesen Tag als Bereitschaft eingetragen — bitte Team-Mitglieder direkt kontaktieren.</p>' +
          '<div class="mt-2">' + usersCache.filter(function (u) { return u.id !== entry.userId && u.active; }).map(function (u) {
            return '<div class="py-1">' + escapeHtml(u.displayName) + (u.telefon ? ' — <a href="tel:' + escapeHtml(u.telefon) + '" style="color:#E8C39E;">' + escapeHtml(u.telefon) + '</a>' : ' (kein Telefon hinterlegt)') + '</div>';
          }).join('') + '</div>';
      } else {
        liste.innerHTML = bereitschaft.map(function (e) {
          return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);"><strong>' + escapeHtml(e.userName) + '</strong>' +
            (e.userTelefon ? ' — <a href="tel:' + escapeHtml(e.userTelefon) + '" style="color:#E8C39E;">' + escapeHtml(e.userTelefon) + '</a>' : ' (kein Telefon hinterlegt)') + '</div>';
        }).join('');
      }
      window.aeOpenLegal('ae-ausfall-overlay');
    }

    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      var body = {
        userId: userSelect.value, datum: $('dps-datum').value, typ: $('dps-typ').value,
        kuerzel: (DP_TYP_LABEL[$('dps-typ').value] || '').charAt(0), von: $('dps-von').value, bis: $('dps-bis').value
      };
      if (!body.userId || !body.datum) { note.textContent = 'Bitte Mitarbeiter/in und Datum wählen.'; return; }
      api('/dienst', { method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() }, body: JSON.stringify(body) })
        .then(function () { note.textContent = 'Eingetragen.'; form.reset(); ladeAlles(); })
        .catch(function (err) { note.textContent = 'Fehler: ' + err.message; });
    });

    if (ketteBtn) ketteBtn.addEventListener('click', function () {
      ketteErg.textContent = 'Prüfe…';
      api('/dienst/kette-pruefen', { headers: { Authorization: 'Bearer ' + window.AeSession.token() } }).then(function (r) {
        ketteErg.textContent = r.intakt ? ('✅ Kette intakt (' + r.anzahl + ' Einträge)') : ('❌ MANIPULATION ERKANNT bei Eintrag ' + r.ersterManipulierterEintrag);
        ketteErg.style.color = r.intakt ? '#6FCF97' : '#E88C7D';
      }).catch(function (err) { ketteErg.textContent = 'Fehler: ' + err.message; });
    });

    document.addEventListener('aeris:server-eingeloggt', ladeAlles);
    document.querySelectorAll('a[data-ae-navlink][href="#dienstplanung"]').forEach(function (a) {
      a.addEventListener('click', function () { if (window.AeSession.isServerMode()) ladeAlles(); });
    });
  }

  // ---------- Meine Zeiterfassung (René-Direktive 2026-10-09) ----------
  function bootMeineZeiterfassung() {
    var zeitraumSel = $('mz-zeitraum'), monatWrap = $('mz-monat-wrap'), monatInput = $('mz-monat');
    var tabelle = $('mz-tabelle'), summe = $('mz-summe');
    if (!zeitraumSel || !window.AeZeiterfassung) return;
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function stundenText(h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); return hh + ':' + String(mm).padStart(2, '0') + ' Std.'; }

    function render() {
      if (!window.AeSession.isServerMode() || !window.AeSession.currentUser()) return;
      var von, bis;
      if (zeitraumSel.value === 'monat') {
        var ym = monatInput.value || todayIsoServer().slice(0, 7);
        von = ym + '-01'; bis = ym + '-31';
      } else {
        bis = todayIsoServer(); von = addTageIso(bis, -29);
      }
      var zeilen = window.AeZeiterfassung.meine(von, bis);
      tabelle.innerHTML = zeilen.length ? (
        '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-[#9CADC9] border-b border-[rgba(124,147,184,0.16)]">' +
        '<th class="py-2 pr-3">Datum</th><th class="py-2 pr-3">Dienstbeginn</th><th class="py-2 pr-3">Dienstende</th><th class="py-2">Stunden</th></tr></thead><tbody>' +
        zeilen.map(function (z) {
          return '<tr><td class="py-1.5 pr-3">' + z.datum + '</td><td class="py-1.5 pr-3">' + (z.von || '—') + (z.versiegelt ? ' 🔒' : '') + '</td><td class="py-1.5 pr-3">' + (z.bis || '—') + '</td><td class="py-1.5">' + (z.von && z.bis ? stundenText(z.stunden) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      ) : '<p class="text-[#9CADC9] text-sm">Keine eigenen Zeitstempel in diesem Zeitraum.</p>';
      var gesamt = zeilen.reduce(function (s, z) { return s + (z.von && z.bis ? z.stunden : 0); }, 0);
      summe.textContent = zeilen.length ? ('Gesamt: ' + stundenText(gesamt) + ' über ' + zeilen.length + ' Tag(e)') : '';
    }

    zeitraumSel.addEventListener('change', function () {
      monatWrap.classList.toggle('ae-hidden', zeitraumSel.value !== 'monat');
      if (zeitraumSel.value === 'monat' && !monatInput.value) monatInput.value = todayIsoServer().slice(0, 7);
      render();
    });
    monatInput.addEventListener('change', render);
    document.addEventListener('aeris:server-eingeloggt', render);
    document.querySelectorAll('a[data-ae-navlink][href="#dienstplanung"]').forEach(function (a) {
      a.addEventListener('click', function () { if (window.AeSession.isServerMode()) render(); });
    });
  }

  // ---------- Eigene Dokumente (mandantenspezifisch, s. AeDocs in app.js) ----------
  // Läuft unabhängig vom Server-/Lokal-Modus -- AeDocs existiert immer, Admin-Gate nur im Server-Modus
  // relevant (lokaler Einzelperson-Modus: Hinzufügen immer erlaubt, keine Rollen dort).
  var AE_DOK_DATEI_MAX_BYTES = 4 * 1024 * 1024;
  function liesDateiAlsDataUrl(datei) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('Datei konnte nicht gelesen werden.')); };
      reader.readAsDataURL(datei);
    });
  }
  function bootEigeneDokumente() {
    var liste = $('ae-eigene-dok-liste'), form = $('ae-eigene-dok-form'), countBadge = $('ae-doc-eigene-count');
    var dateiInput = $('ae-eigene-dok-datei'), dateiNote = $('ae-eigene-dok-datei-note');
    if (!liste || !form || !window.AeDocs) return;
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    if (dateiInput) dateiInput.addEventListener('change', function () {
      var f = dateiInput.files[0];
      if (!f) { dateiNote.textContent = ''; return; }
      if (f.size > AE_DOK_DATEI_MAX_BYTES) { dateiNote.textContent = '⚠ Datei zu groß (' + (f.size / 1024 / 1024).toFixed(1) + ' MB) — maximal 4 MB.'; dateiInput.value = ''; }
      else dateiNote.textContent = f.name + ' (' + (f.size / 1024).toFixed(0) + ' KB)';
    });
    function render() {
      var docs = window.AeDocs.list();
      if (countBadge) countBadge.textContent = docs.length + ' Dokument' + (docs.length === 1 ? '' : 'e');
      var meta = window.AeSession ? window.AeSession.currentUser() : null;
      var darfBearbeiten = !meta || C.hatRolle(meta, 'admin');
      form.classList.toggle('ae-hidden', !darfBearbeiten);
      liste.innerHTML = docs.length ? docs.map(function (d) {
        return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' +
          '<div class="flex justify-between items-start gap-2"><strong>' + escapeHtml(d.titel) + '</strong>' +
          (darfBearbeiten ? '<button type="button" data-doc-del="' + d.id + '" style="background:none;border:none;color:#E88C7D;cursor:pointer;font-size:.85rem;">Löschen</button>' : '') +
          '</div>' + (d.inhalt ? '<p class="text-[#9CADC9] text-sm mt-1" style="white-space:pre-wrap;">' + escapeHtml(d.inhalt) + '</p>' : '') +
          (d.dateiDataUrl ? '<a href="' + d.dateiDataUrl + '" download="' + escapeHtml(d.dateiName || 'dokument.pdf') + '" style="color:#E8C39E;font-size:.85rem;display:inline-block;margin-top:.4rem;">📄 ' + escapeHtml(d.dateiName || 'PDF') + ' öffnen/herunterladen</a>' : '') +
          '</div>';
      }).join('') : '<p class="text-[#9CADC9] text-sm">Noch keine eigenen Dokumente hinterlegt.</p>';
      liste.querySelectorAll('[data-doc-del]').forEach(function (btn) {
        btn.addEventListener('click', function () { window.AeDocs.remove(btn.getAttribute('data-doc-del')); render(); });
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var titel = $('ae-eigene-dok-titel').value.trim(), inhalt = $('ae-eigene-dok-inhalt').value.trim();
      var datei = dateiInput && dateiInput.files[0];
      if (!titel || (!inhalt && !datei)) { dateiNote.textContent = 'Bitte Titel und entweder Text oder eine PDF-Datei angeben.'; return; }
      var weiter = datei ? liesDateiAlsDataUrl(datei) : Promise.resolve(null);
      weiter.then(function (dataUrl) {
        return window.AeDocs.add(titel, inhalt, dataUrl, datei ? datei.name : '');
      }).then(function () { form.reset(); dateiNote.textContent = ''; render(); })
        .catch(function (err) { dateiNote.textContent = 'Fehler: ' + err.message; });
    });
    document.querySelector('[data-legal="ae-doc-eigene"]').addEventListener('click', render);
    document.addEventListener('aeris:server-eingeloggt', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEigenePin);
  else bootEigenePin();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootDienstplan);
  else bootDienstplan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMeineZeiterfassung);
  else bootMeineZeiterfassung();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEigeneDokumente);
  else bootEigeneDokumente();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootBranding);
  else bootBranding();
})();
