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
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch('/api' + path, opts).then(function (r) {
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

  var gate, form, userWrap, userInput, pin, confirm, confirmWrap, tenantWrap, tenantInput, displayInput, note, submit, hint, title;
  var subUmschalter, subBtn;
  var subMode = 'login'; // 'login' | 'setup' | 'pflicht' (Pflicht-PIN-Änderung nach Admin-Vergabe/Reset)
  var DEK_BYTES = null; // im Speicher gehalten für Admin-Folgeaktionen (neue Mitarbeiter anlegen)
  var pflichtKontext = null; // { data, dek, meta } -- während der Pflicht-Änderung zwischengehalten

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
      tenantWrap.classList.add('ae-hidden'); tenantInput.required = false; displayInput.required = false;
      submit.textContent = 'Neue PIN festlegen';
      subUmschalter.classList.add('ae-hidden');
      clearNote();
      return;
    }
    if (subMode === 'login') {
      title.textContent = 'Team-Login';
      hint.textContent = 'Bitte Benutzernamen und persönliche PIN eingeben.';
      confirmWrap.classList.add('ae-hidden'); confirm.required = false;
      tenantWrap.classList.add('ae-hidden'); tenantInput.required = false; displayInput.required = false;
      submit.textContent = 'Anmelden';
      subBtn.textContent = 'Noch kein Team? Jetzt als erstes Mitglied (Admin) einrichten →';
      var last = localStorage.getItem('aeris_last_username');
      if (last && !userInput.value) userInput.value = last;
    } else {
      title.textContent = 'Neues Team einrichten';
      hint.textContent = 'Legt einen neuen Mandanten (Unternehmen) mit Ihnen als erstem Admin-Konto an.';
      confirmWrap.classList.remove('ae-hidden'); confirm.required = true;
      tenantWrap.classList.remove('ae-hidden'); tenantInput.required = true; displayInput.required = true;
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
            return api('/blob', { headers: { Authorization: 'Bearer ' + res.token } }).catch(function () { return null; }).then(function (blobRes) {
              var fertig = function (data) {
                var meta = { token: res.token, user: res.user, tenantId: res.tenantId, tenantName: res.tenantName };
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
                C.aeDecryptJson(dek, blobRes.iv, blobRes.ct).then(fertig).catch(function () {
                  submit.disabled = false;
                  showNote('Datenstand konnte nicht entschlüsselt werden (PIN war korrekt, Daten evtl. beschädigt).');
                });
              } else {
                fertig(window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {});
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
              var daten = (cached.iv && cached.ct) ? C.aeDecryptJson(dek, cached.iv, cached.ct) : Promise.resolve(window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {});
              return daten.then(function (data) {
                // Bewusst kein Token hier (s. app.js AeOffline-Kommentar) -- der schreibgeschützte
                // Modus ruft nie eine Bearer-geschützte Route auf, ein None-Token ist hier korrekt.
                window.AeSession.setUnlocked(data, dek, { token: null, user: cached.user, tenantId: cached.tenantId, tenantName: cached.tenantName }, { readOnly: true, cachedAt: cached.cachedAt });
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

    // subMode === 'setup'
    var pConfirm = confirm.value.trim();
    if (p !== pConfirm) { showNote('Die beiden PIN-Eingaben stimmen nicht überein.'); submit.disabled = false; return; }
    var tenantName = tenantInput.value.trim(), displayName = displayInput.value.trim();
    if (!tenantName || !displayName) { showNote('Bitte Unternehmensname und Anzeigename ausfüllen.'); submit.disabled = false; return; }
    var dekBytes = randomDek();
    wrapDek(dekBytes, p).then(function (wrapped) {
      return api('/setup', {
        method: 'POST',
        body: JSON.stringify({ tenantName: tenantName, username: username, password: p, displayName: displayName, wrappedDek: wrapped })
      }).then(function () {
        return api('/login', { method: 'POST', body: JSON.stringify({ username: username, password: p }) });
      }).then(function (res) {
        DEK_BYTES = dekBytes;
        return importRawAesKey(dekBytes).then(function (dek) {
          localStorage.setItem('aeris_last_username', username);
          if (window.AeOffline) window.AeOffline.speichereAnmeldedaten(username, wrapped, res.tenantId, res.tenantName, res.user);
          pin.value = ''; confirm.value = ''; userInput.value = ''; tenantInput.value = ''; displayInput.value = '';
          window.AeSession.setUnlocked(window.aeDefaultDataForServer ? window.aeDefaultDataForServer() : {}, dek,
            { token: res.token, user: res.user, tenantId: res.tenantId, tenantName: res.tenantName });
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
    tenantWrap = $('ae-tenant-field-wrap'); tenantInput = $('ae-tenant-input'); displayInput = $('ae-displayname-input');
    note = $('ae-pin-note'); submit = $('ae-pin-submit'); hint = $('ae-pin-gate-hint'); title = $('ae-pin-gate-title');
    subUmschalter = $('ae-server-sub-umschalter'); subBtn = $('ae-server-sub-btn');
    var modusBtn = $('ae-login-modus-btn'), modusWrap = $('ae-login-modus-umschalter');
    if (!gate || !form || !modusBtn) return;

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
    bootTeamCard();
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
      card.classList.toggle('ae-hidden', !meta || meta.role !== 'admin');
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
    function ladeListe() {
      var meta = window.AeSession.currentUser();
      if (!meta) return;
      api('/users', { headers: { Authorization: 'Bearer ' + window.AeSession.token() } }).then(function (users) {
        liste.innerHTML = users.map(function (u) {
          var istIch = u.id === meta.id;
          return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:.75rem;flex-wrap:wrap;">' +
            '<div><strong>' + escapeHtml(u.displayName) + '</strong>' + (istIch ? ' (Sie)' : '') +
            ' <span style="color:#9CADC9;">· @' + escapeHtml(u.username) + ' · ' + (u.role === 'admin' ? 'Admin' : 'MA') +
            (u.telefon ? ' · ' + escapeHtml(u.telefon) : '') + (u.active ? '' : ' · deaktiviert') + '</span></div>' +
            '<div style="display:flex;gap:.5rem;">' +
            (istIch ? '' : '<button type="button" class="ae-btn-secondary" data-team-toggle="' + u.id + '" data-active="' + (u.active ? '1' : '0') + '" style="padding:.4rem .8rem;font-size:.8rem;">' + (u.active ? 'Deaktivieren' : 'Aktivieren') + '</button>') +
            '<button type="button" class="ae-btn-secondary" data-team-pinreset="' + u.id + '" style="padding:.4rem .8rem;font-size:.8rem;">PIN zurücksetzen</button>' +
            '</div></div>' +
            '<div class="ae-hidden mt-2" data-pinreset-form="' + u.id + '" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">' +
            '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Neue PIN (genau 6 Ziffern)" class="ae-input" style="width:auto;" data-pinreset-input>' +
            '<button type="button" class="ae-btn-primary" data-pinreset-go="' + u.id + '" style="padding:.4rem .8rem;font-size:.8rem;">Setzen</button>' +
            '</div></div>';
        }).join('') || '<p class="text-[#9CADC9] text-sm">Noch keine weiteren Mitglieder.</p>';
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
      card.classList.toggle('ae-hidden', meta.role !== 'admin');
      teamForm.classList.toggle('ae-hidden', meta.role !== 'admin');
      tenantLabel.textContent = window.AeSession.tenantName ? window.AeSession.tenantName() : 'Ihr Unternehmen';
      ladeListe();
    });

    teamForm.addEventListener('submit', function (e) {
      e.preventDefault();
      note.textContent = '';
      if (!DEK_BYTES) { note.textContent = 'Datenschlüssel nicht im Speicher — bitte einmal ab-/anmelden und erneut versuchen.'; return; }
      var username = $('ae-team-user').value.trim(), displayName = $('ae-team-name').value.trim();
      var p = $('ae-team-pin').value.trim(), telefon = $('ae-team-tel').value.trim(), rolle = $('ae-team-rolle').value;
      if (!/^\d{6}$/.test(p)) { note.textContent = 'Start-PIN muss genau 6 Ziffern haben.'; return; }
      wrapDek(DEK_BYTES, p).then(function (wrapped) {
        return api('/users', {
          method: 'POST', headers: { Authorization: 'Bearer ' + window.AeSession.token() },
          body: JSON.stringify({ username: username, password: p, displayName: displayName, telefon: telefon, role: rolle, wrappedDek: wrapped })
        });
      }).then(function () {
        teamForm.reset();
        note.textContent = 'Angelegt — bitte Benutzername „' + username + '" und Start-PIN persönlich/sicher an die Person weitergeben (kein automatischer Versand).';
        ladeListe();
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
      adminBereich.classList.toggle('ae-hidden', meta.role !== 'admin');
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
            (n.userTelefon ? '<br><a href="tel:' + escapeHtml(n.userTelefon) + '" style="color:#B87333;">' + escapeHtml(n.userTelefon) + '</a>' : '') +
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
            return '<div class="py-1">' + escapeHtml(u.displayName) + (u.telefon ? ' — <a href="tel:' + escapeHtml(u.telefon) + '" style="color:#B87333;">' + escapeHtml(u.telefon) + '</a>' : ' (kein Telefon hinterlegt)') + '</div>';
          }).join('') + '</div>';
      } else {
        liste.innerHTML = bereitschaft.map(function (e) {
          return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);"><strong>' + escapeHtml(e.userName) + '</strong>' +
            (e.userTelefon ? ' — <a href="tel:' + escapeHtml(e.userTelefon) + '" style="color:#B87333;">' + escapeHtml(e.userTelefon) + '</a>' : ' (kein Telefon hinterlegt)') + '</div>';
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
      var darfBearbeiten = !meta || meta.role === 'admin';
      form.classList.toggle('ae-hidden', !darfBearbeiten);
      liste.innerHTML = docs.length ? docs.map(function (d) {
        return '<div class="ae-card p-3 mb-2" style="background:rgba(255,255,255,.04);">' +
          '<div class="flex justify-between items-start gap-2"><strong>' + escapeHtml(d.titel) + '</strong>' +
          (darfBearbeiten ? '<button type="button" data-doc-del="' + d.id + '" style="background:none;border:none;color:#E88C7D;cursor:pointer;font-size:.85rem;">Löschen</button>' : '') +
          '</div>' + (d.inhalt ? '<p class="text-[#9CADC9] text-sm mt-1" style="white-space:pre-wrap;">' + escapeHtml(d.inhalt) + '</p>' : '') +
          (d.dateiDataUrl ? '<a href="' + d.dateiDataUrl + '" download="' + escapeHtml(d.dateiName || 'dokument.pdf') + '" style="color:#B87333;font-size:.85rem;display:inline-block;margin-top:.4rem;">📄 ' + escapeHtml(d.dateiName || 'PDF') + ' öffnen/herunterladen</a>' : '') +
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
