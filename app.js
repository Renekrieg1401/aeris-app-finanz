  (function () {
    // ---------- Immer oben starten ----------
    function forceTop() {
      var prevBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = prevBehavior;
    }
    forceTop();
    window.addEventListener('load', forceTop);
    window.addEventListener('pageshow', forceTop);

    // ---------- Scroll-to-Top ----------
    var scrollTopBtn = document.getElementById('ae-scrolltop');
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) { scrollTopBtn.classList.add('ae-scrolltop--visible'); }
      else { scrollTopBtn.classList.remove('ae-scrolltop--visible'); }
    });
    scrollTopBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    // ---------- Offcanvas-Sidebar ----------
    var menuToggle = document.getElementById('ae-menu-toggle');
    var sidebar = document.getElementById('ae-sidebar');
    var sidebarBackdrop = document.getElementById('ae-sidebar-backdrop');
    var sidebarClose = document.getElementById('ae-sidebar-close');
    var sidebarOpen = false;
    function openSidebar() {
      sidebar.classList.add('ae-sidebar--open');
      sidebarBackdrop.classList.add('ae-sidebar-backdrop--visible');
      sidebar.setAttribute('aria-hidden', 'false');
      menuToggle.setAttribute('aria-expanded', 'true');
      sidebarOpen = true;
      var firstLink = sidebar.querySelector('a, button');
      if (firstLink) firstLink.focus();
    }
    function closeSidebar() {
      if (!sidebarOpen) return;
      sidebar.classList.remove('ae-sidebar--open');
      sidebarBackdrop.classList.remove('ae-sidebar-backdrop--visible');
      sidebar.setAttribute('aria-hidden', 'true');
      menuToggle.setAttribute('aria-expanded', 'false');
      sidebarOpen = false;
      menuToggle.focus();
    }
    menuToggle.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeSidebar); });
    document.addEventListener('keydown', function (e) {
      if (!sidebarOpen) return;
      if (e.key === 'Escape') { closeSidebar(); return; }
      if (e.key === 'Tab') {
        var focusable = getFocusable(sidebar);
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // ---------- Bereichs-Navigation ----------
    var AE_VIEWS = ['heute', 'verlauf', 'sis', 'auswertungen', 'einstellungen'];
    function showView(id) {
      if (AE_VIEWS.indexOf(id) === -1) return;
      AE_VIEWS.forEach(function (v) {
        var sec = document.getElementById(v);
        if (!sec) return;
        if (v === id) sec.classList.remove('ae-view--hidden'); else sec.classList.add('ae-view--hidden');
      });
      document.querySelectorAll('[data-ae-navlink]').forEach(function (a) {
        var target = a.getAttribute('href').replace('#', '');
        if (target === id) { a.classList.add('ae-navlink--active'); a.setAttribute('aria-current', 'page'); }
        else { a.classList.remove('ae-navlink--active'); a.removeAttribute('aria-current'); }
      });
      var activeSec = document.getElementById(id);
      var heading = activeSec && activeSec.querySelector('h1, h2');
      if (heading) { if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      forceTop();
      if (id === 'verlauf') { renderVerlaufCalendar(); }
      if (id === 'auswertungen') { var active = document.querySelector('[data-aw-tab][aria-selected="true"]'); showAwTab(active ? active.dataset.awTab : 'leistungsnachweis'); }
      // Heute-Tab bei jedem Reaktivieren frisch rendern -- Assessment-Werte koennen zwischenzeitlich
      // ueber Verlauf->Tagesdetail (gleiche Datenquelle AE.tage[todayIso()].assessment) geaendert worden sein.
      if (id === 'heute') { renderHeute(); }
      if (id === 'sis') { renderSis(); }
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (AE_VIEWS.indexOf(id) === -1) return;
      e.preventDefault();
      showView(id);
    });

    // ---------- Legal-Overlays ----------
    var legalBackdrop = document.getElementById('ae-legal-backdrop');
    var activeLegal = null;
    var legalTrigger = null;
    function getFocusable(container) {
      return Array.prototype.slice.call(
        container.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')
      );
    }
    function openLegal(target, trigger) {
      legalTrigger = trigger || document.activeElement;
      target.classList.remove('ae-legal-hidden');
      legalBackdrop.classList.add('ae-legal-backdrop--visible');
      document.body.style.overflow = 'hidden';
      activeLegal = target;
      var closeBtn = target.querySelector('.ae-legal-close');
      if (closeBtn) closeBtn.focus();
    }
    function closeLegal() {
      if (!activeLegal) return;
      activeLegal.classList.add('ae-legal-hidden');
      legalBackdrop.classList.remove('ae-legal-backdrop--visible');
      document.body.style.overflow = '';
      activeLegal = null;
      if (legalTrigger && typeof legalTrigger.focus === 'function') legalTrigger.focus();
      legalTrigger = null;
    }
    document.querySelectorAll('.ae-legal-section').forEach(function (section) {
      section.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeLegal(); });
    });
    document.querySelectorAll('.ae-legal-close').forEach(function (btn) { btn.addEventListener('click', closeLegal); });
    document.addEventListener('keydown', function (e) {
      if (!activeLegal) return;
      if (e.key === 'Escape') { closeLegal(); return; }
      if (e.key === 'Tab') {
        var focusable = getFocusable(activeLegal);
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.querySelectorAll('[data-legal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.dataset.legal);
        if (target) openLegal(target, btn);
      });
    });

    // ---------- Gemeinsame Helfer ----------
    function showInlineNote(el) {
      if (!el) return;
      el.classList.add('ae-inline-note--visible');
      window.clearTimeout(el._ae_hideTimer);
      el._ae_hideTimer = window.setTimeout(function () { el.classList.remove('ae-inline-note--visible'); }, 4000);
    }
    function formatEuro(n) { return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
    function timeToMinutes(hhmm) {
      if (!hhmm) return null;
      var parts = hhmm.split(':');
      if (parts.length !== 2) return null;
      var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    }
    function escapeHtml(s) {
      return (s || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function isoDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
    function todayIso() { var d = new Date(); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); }
    function nowHm() { var d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
    function uid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

    // ---------- Datenschicht (localStorage, schema-versioniert) ----------
    var STORAGE_KEY = 'ae-finanz-log-v1';
    function defaultData() {
      return {
        schema: 1,
        settings: { satzPflege: 105, pauschaleAufnahme: 165, iban: '', bic: '', kassenname: '', steuernr: '', finanzamt: 'Finanzamt Marburg-Biedenkopf', pfks: ['RK'], ti: { ik: '', smcbStatus: 'nicht_beantragt', anbieter: '', endpunkt: '' } },
        entries: [],
        tage: {},
        monate: {},
        sis: null
      };
    }
    // ---------- Fix 5 (security-privacy-Audit): PIN-Zugriffssperre + AES-GCM-Verschluesselung ----------
    // STORAGE_KEY bleibt als Konstante fuer den ALTEN, unverschluesselten Klartextspeicher erhalten
    // (ausschliesslich fuer die Migrations-Erkennung/den Einmal-Umzug gebraucht, s. aeDetectGateMode()).
    // STORAGE_KEY_ENC ist der neue, verschluesselte Speicherort -- {v, salt, iterations, iv, ct}, alles
    // ausser dem eigentlichen Klientendatenblob (ct) unverschluesselt, da Salt/IV nicht geheim sein muessen.
    var STORAGE_KEY_ENC = 'ae-finanz-log-v1-enc';
    var AE_PBKDF2_ITER = 150000;
    var AE_CRYPTO_KEY = null; // erst nach erfolgreicher PIN-Eingabe gesetzt, s. aePinGateStart()
    var AE_SALT_B64 = null;
    var aePersistQueue = Promise.resolve(); // serialisiert nebenlaeufige persist()-Aufrufe, verhindert Race Conditions beim Verschluesseln/Schreiben

    function ab2b64(buf) {
      var bytes = new Uint8Array(buf), bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }
    function b642ab(b64) {
      var bin = atob(b64), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr.buffer;
    }
    function aeRandomSaltB64() { var s = new Uint8Array(16); crypto.getRandomValues(s); return ab2b64(s.buffer); }
    function aeDeriveKey(pin, saltB64, iterations) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (keyMaterial) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b642ab(saltB64), iterations: iterations || AE_PBKDF2_ITER, hash: 'SHA-256' },
          keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
      });
    }
    function aeEncryptJson(key, obj) {
      var iv = new Uint8Array(12); crypto.getRandomValues(iv);
      var data = new TextEncoder().encode(JSON.stringify(obj));
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, data).then(function (ciphertext) {
        return { iv: ab2b64(iv.buffer), ct: ab2b64(ciphertext) };
      });
    }
    function aeDecryptJson(key, ivB64, ctB64) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b642ab(ivB64)) }, key, b642ab(ctB64)).then(function (plain) {
        return JSON.parse(new TextDecoder().decode(plain));
      });
    }
    // Migrations-Sicherheitsnetz: wird sowohl auf den Platzhalter-Start-AE als auch nach jedem
    // erfolgreichen Entschluesseln/Migrieren angewendet, damit aeltere Datenstaende (z.B. ohne
    // settings.ti) nicht crashen -- identische Logik zur bisherigen Einzel-Migration, nur zentralisiert.
    function aeApplyMigrations(data) {
      if (!data.settings) data.settings = defaultData().settings;
      if (!data.settings.ti) data.settings.ti = { ik: '', smcbStatus: 'nicht_beantragt', anbieter: '', endpunkt: '' };
      if (data.schema === undefined) data.schema = 1;
      if (!data.entries) data.entries = [];
      if (!data.tage) data.tage = {};
      if (!data.monate) data.monate = {};
      return data;
    }
    // AE startet als leerer Platzhalter -- die eigentlichen (ver-/entschluesselten) Klientendaten werden
    // erst nach erfolgreicher PIN-Eingabe in aePinGateStart() eingesetzt. Bis dahin blockiert das
    // PIN-Gate (#ae-pin-gate, hoechster z-index, blickdicht) jede Sicht auf den Rest der App -- der
    // Platzhalter sorgt nur dafuer, dass die uebrige (synchron ausgefuehrte) Initialisierung weiter unten
    // nicht gegen "undefined" laeuft.
    var AE = aeApplyMigrations(defaultData());
    function persist() {
      if (!AE_CRYPTO_KEY || !AE_SALT_B64) return; // vor Entsperrung wird nichts geschrieben -- das Gate verhindert ohnehin jede Dateneingabe
      aePersistQueue = aePersistQueue.then(function () {
        return aeEncryptJson(AE_CRYPTO_KEY, AE);
      }).then(function (enc) {
        var blob = JSON.stringify({ v: 1, salt: AE_SALT_B64, iterations: AE_PBKDF2_ITER, iv: enc.iv, ct: enc.ct });
        try {
          localStorage.setItem(STORAGE_KEY_ENC, blob);
          document.dispatchEvent(new CustomEvent('aeris:gespeichert'));
        } catch (e) {
          alert('Speichern fehlgeschlagen — der Gerätespeicher ist vermutlich voll. Bitte sofort Speicherplatz freigeben oder Daten exportieren, sonst gehen neue Einträge verloren.');
        }
        updateStorageIndicator();
      }).catch(function (err) {
        console.error('persist(): Verschluesselung fehlgeschlagen', err);
        alert('Speichern fehlgeschlagen (Verschlüsselungsfehler). Bitte App neu laden; falls das wiederholt auftritt, zeitnah Daten exportieren.');
      });
    }
    // ---------- Fix 5: Gate-Modus-Erkennung -- entscheidet, ob entsperrt, neu eingerichtet oder
    // migriert werden muss. Spiegelbildlich zur alten loadData()-Gueltigkeitspruefung (schema === 1).
    function aeDetectGateMode() {
      try {
        var rawEnc = localStorage.getItem(STORAGE_KEY_ENC);
        if (rawEnc) {
          var parsedEnc = JSON.parse(rawEnc);
          if (parsedEnc && parsedEnc.salt && parsedEnc.iv && parsedEnc.ct) return 'unlock';
        }
      } catch (e) {}
      try {
        var rawLegacy = localStorage.getItem(STORAGE_KEY);
        if (rawLegacy) {
          var parsedLegacy = JSON.parse(rawLegacy);
          if (parsedLegacy && parsedLegacy.schema === 1) return 'migrate';
        }
      } catch (e) {}
      return 'setup';
    }
    // ---------- Fix 5: PIN-Gate-Steuerung ----------
    // Wird einmalig ganz am Ende der Initialisierung (s. aeRunInit()/Fussende) aufgerufen. Deckt drei
    // Faelle ab: 'unlock' (bestehender verschluesselter Bestand), 'migrate' (bestehender UNverschluesselter
    // Altbestand -- PIN wird neu festgelegt, Altdaten werden verschluesselt uebernommen, NICHT verworfen),
    // 'setup' (komplette Erstinstallation). Zusaetzlich: erneute Sperre bei visibilitychange/pageshow
    // (analog zum bestehenden Auto-Reload-Mechanismus in index.html), damit ein Wiederoeffnen der App
    // immer erneut eine PIN-Bestaetigung verlangt.
    function aePinGateStart() {
      var gate = document.getElementById('ae-pin-gate');
      var form = document.getElementById('ae-pin-form');
      var input = document.getElementById('ae-pin-input');
      var confirmWrap = document.getElementById('ae-pin-confirm-wrap');
      var confirmInput = document.getElementById('ae-pin-confirm');
      var note = document.getElementById('ae-pin-note');
      var hint = document.getElementById('ae-pin-gate-hint');
      var submitBtn = document.getElementById('ae-pin-submit');
      var header = document.getElementById('ae-header');
      var main = document.getElementById('main-content');
      if (!gate || !form) return;

      if (!window.crypto || !window.crypto.subtle) {
        if (hint) hint.textContent = 'Verschlüsselung wird von diesem Browser/Kontext nicht unterstützt (crypto.subtle fehlt). Bitte einen aktuellen Browser über HTTPS verwenden.';
        if (submitBtn) submitBtn.disabled = true;
        return;
      }

      var mode = aeDetectGateMode();

      function setInert(locked) {
        [header, main].forEach(function (el) {
          if (!el) return;
          if (locked) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
          else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
        });
      }
      function showNote(msg) { note.textContent = msg; note.classList.add('ae-inline-note--visible'); }
      function clearNote() { note.textContent = ''; note.classList.remove('ae-inline-note--visible'); }
      function configureUiForMode() {
        if (mode === 'unlock' || mode === 'relock') {
          confirmWrap.classList.add('ae-hidden');
          confirmInput.required = false;
          hint.textContent = mode === 'relock'
            ? 'App wurde beim Verlassen automatisch gesperrt. Bitte PIN erneut eingeben.'
            : 'Bitte PIN eingeben, um die gespeicherten Daten zu entschlüsseln.';
          submitBtn.textContent = 'Entsperren';
        } else if (mode === 'migrate') {
          confirmWrap.classList.remove('ae-hidden');
          confirmInput.required = true;
          hint.textContent = 'Sicherheits-Update: Bitte jetzt eine PIN festlegen. Ihre bereits vorhandenen Daten werden danach verschlüsselt übernommen, nicht gelöscht.';
          submitBtn.textContent = 'PIN festlegen & Daten verschlüsseln';
        } else {
          confirmWrap.classList.remove('ae-hidden');
          confirmInput.required = true;
          hint.textContent = 'Erststart: Bitte legen Sie eine PIN (4–6 Ziffern) zum Schutz der Gesundheitsdaten fest.';
          submitBtn.textContent = 'PIN festlegen';
        }
      }
      setInert(true);
      configureUiForMode();

      function finishUnlock() {
        mode = 'relock'; // ab jetzt gilt bei jeder erneuten Anzeige des Gates nur noch der Entsperren-Modus
        setInert(false);
        gate.classList.add('ae-legal-hidden');
        // iOS-Safari-Zoom-Fix: Nach PIN-Eingabe blieb der Viewport manchmal auf dem Zoom-Level des
        // fokussierten PIN-Feldes stehen, auch nachdem das Feld ausgeblendet wurde (bekannter WebKit-
        // Bug bei verstecktem/entferntem Fokus-Element). Feld explizit defokussieren + kurz die
        // viewport-Meta-Tag-Skalierung erzwingen, um den Zoom sicher zurückzusetzen.
        if (input) input.blur();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        var vp = document.querySelector('meta[name="viewport"]');
        if (vp) {
          var original = vp.getAttribute('content');
          vp.setAttribute('content', original + ', maximum-scale=1');
          setTimeout(function () { vp.setAttribute('content', original); }, 50);
        }
        window.scrollTo(0, 0);
        aeApplyMigrations(AE);
        aeRunInit();
        updateStorageIndicator();
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearNote();
        var pin = input.value.trim();
        if (!/^\d{4,6}$/.test(pin)) { showNote('Bitte eine PIN aus 4–6 Ziffern eingeben.'); return; }
        submitBtn.disabled = true;

        if (mode === 'unlock' || mode === 'relock') {
          var raw = localStorage.getItem(STORAGE_KEY_ENC);
          var parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) {}
          if (!parsed || !parsed.salt || !parsed.iv || !parsed.ct) {
            showNote('Gespeicherte Daten sind beschädigt oder nicht lesbar.');
            submitBtn.disabled = false;
            return;
          }
          aeDeriveKey(pin, parsed.salt, parsed.iterations).then(function (key) {
            return aeDecryptJson(key, parsed.iv, parsed.ct).then(function (data) {
              if (mode === 'unlock') { AE = data; AE_CRYPTO_KEY = key; AE_SALT_B64 = parsed.salt; }
              // Bei 'relock' bleibt die im Speicher gehaltene, bereits entschluesselte Sitzung
              // massgeblich -- die erneute PIN-Eingabe dient hier nur der Wiederzugriffs-Bestaetigung,
              // ein Neu-Laden waere unnoetig und koennte theoretisch einen noch nicht abgeschlossenen
              // persist()-Schreibvorgang ueberholen.
              input.value = '';
              finishUnlock();
            });
          }).catch(function () {
            showNote('Falsche PIN — die Daten können damit nicht entschlüsselt werden. Es gibt kein Master-Passwort und keinen Reset ohne Datenverlust.');
            submitBtn.disabled = false;
          });
          return;
        }

        // mode === 'setup' || 'migrate'
        var pinConfirm = confirmInput.value.trim();
        if (pin !== pinConfirm) { showNote('Die beiden PIN-Eingaben stimmen nicht überein.'); submitBtn.disabled = false; return; }
        var neuesSalt = aeRandomSaltB64();
        var quelldaten = aeApplyMigrations(defaultData());
        if (mode === 'migrate') {
          // Harte Absicherung: wenn im Migrations-Modus die Altdaten beim erneuten Lesen NICHT
          // uebernommen werden koennen, wird NICHT stillschweigend mit einem leeren Datensatz
          // "migriert" (das wuerde dem Nutzer eine erfolgreiche Migration vortaeuschen, waehrend die
          // echten Altdaten unangetastet -- aber unsichtbar -- in STORAGE_KEY liegen blieben).
          // Stattdessen wird der gesamte Vorgang abgebrochen, bevor irgendetwas geschrieben wird.
          var migrationGelesen = false;
          try {
            var rawLegacy = localStorage.getItem(STORAGE_KEY);
            var parsedLegacy = JSON.parse(rawLegacy);
            if (parsedLegacy && parsedLegacy.schema === 1) { quelldaten = aeApplyMigrations(parsedLegacy); migrationGelesen = true; }
          } catch (e) {}
          if (!migrationGelesen) {
            showNote('Die vorhandenen Altdaten konnten nicht gelesen werden — Migration abgebrochen, es wurde nichts verändert. Bitte erneut versuchen.');
            submitBtn.disabled = false;
            return;
          }
        }
        aeDeriveKey(pin, neuesSalt, AE_PBKDF2_ITER).then(function (key) {
          return aeEncryptJson(key, quelldaten).then(function (enc) {
            // Verifikation VOR dem Entfernen der alten Klartextkopie (Datenverlust-Schutz): erst
            // schreiben, dann testweise zurueck-entschluesseln und mit dem Original vergleichen --
            // erst wenn das gelingt, wird die alte Klartextkopie entfernt bzw. ueberhaupt etwas ersetzt.
            return aeDecryptJson(key, enc.iv, enc.ct).then(function (probe) {
              if (JSON.stringify(probe) !== JSON.stringify(quelldaten)) throw new Error('Verifikation der Verschluesselung fehlgeschlagen');
              var blob = JSON.stringify({ v: 1, salt: neuesSalt, iterations: AE_PBKDF2_ITER, iv: enc.iv, ct: enc.ct });
              localStorage.setItem(STORAGE_KEY_ENC, blob);
              if (mode === 'migrate') localStorage.removeItem(STORAGE_KEY);
              AE = quelldaten; AE_CRYPTO_KEY = key; AE_SALT_B64 = neuesSalt;
              input.value = ''; confirmInput.value = '';
              finishUnlock();
            });
          });
        }).catch(function (err) {
          console.error('PIN-Ersteinrichtung/Migration fehlgeschlagen', err);
          showNote('Verschlüsselung fehlgeschlagen. Ihre bisherigen Daten wurden NICHT verändert — bitte erneut versuchen.');
          submitBtn.disabled = false;
        });
      });

      // Erneute Sperre bei jedem Verlassen der App (Tab-Wechsel, Home-Bildschirm-PWA in den
      // Hintergrund) -- Inhalte sind erst nach erneuter PIN-Eingabe wieder sichtbar. Die bereits
      // entschluesselten Daten bleiben im Arbeitsspeicher erhalten (kein erneutes Entschluesseln
      // noetig), nur die Sichtbarkeit/Bedienbarkeit wird gesperrt.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'hidden') return;
        if (!AE_CRYPTO_KEY) return; // noch gar nicht entsperrt -- das Gate steht ohnehin schon
        mode = 'relock';
        input.value = ''; clearNote();
        configureUiForMode();
        submitBtn.disabled = false;
        gate.classList.remove('ae-legal-hidden');
        setInert(true);
      });
    }
    // ---------- Speicherstand-Indikator (Fix 3, testing-qa-Audit): navigator.storage.estimate() ist
    // Standard-Browser-API, aber nicht ueberall verfuegbar (z.B. aeltere Safari-Versionen) -- Fallback-Text
    // statt Crash, wenn die API fehlt oder das Promise ablehnt.
    function updateStorageIndicator() {
      var bar = document.getElementById('ae-storage-bar');
      var pct = document.getElementById('ae-storage-pct');
      var note = document.getElementById('ae-storage-note');
      if (!bar || !pct || !note) return;
      if (!navigator.storage || !navigator.storage.estimate) {
        pct.textContent = '—';
        note.textContent = 'Speicherstand kann in diesem Browser nicht ermittelt werden.';
        return;
      }
      navigator.storage.estimate().then(function (est) {
        var usage = est.usage || 0, quota = est.quota || 0;
        if (!quota) { note.textContent = 'Speicherstand kann nicht ermittelt werden.'; return; }
        var ratio = usage / quota;
        var percent = Math.round(ratio * 100);
        bar.style.width = Math.min(100, percent) + '%';
        pct.textContent = percent + ' %';
        if (ratio > 0.8) {
          bar.style.background = '#D9534F';
          note.textContent = 'Speicher fast voll (' + percent + ' %) — bitte zeitnah Daten exportieren/sichern und Speicherplatz freigeben, sonst drohen Datenverluste.';
        } else if (ratio > 0.6) {
          bar.style.background = '#E0A93E';
          note.textContent = 'Speicherauslastung ' + percent + ' % — im Blick behalten.';
        } else {
          bar.style.background = '#3FA86B';
          note.textContent = 'Speicherauslastung ' + percent + ' % — unkritisch.';
        }
      }).catch(function () { note.textContent = 'Speicherstand kann nicht ermittelt werden.'; });
    }
    // ---------- Schicht-Assessment: Default-Datenmodell (7 Fachabschnitte, AERIS-Originaldokument) ----------
    function defaultAssessment() {
      return {
        beatmung: {
          modus: '', soll: { fio2: '', peep: '', vt: '', freq: '', ppeak: '' }, ist: { fio2: '', peep: '', vt: '', freq: '', ppeak: '' },
          // verlauf: fortlaufende Kurve (Auftrag René 2026-09-19) -- ein {zeit, fio2, peep, vt, freq, ppeak}-
          // Snapshot je Beatmung/Respiratormanagement-Erfassung, statt Einzelwert-Ueberschreibung.
          verlauf: [],
          weaning: { intervall: '', toleranz: '', abbruchGrund: '' },
          // cuffdruckVerlauf: analoge fortlaufende Kurve je Cuffdruckkontrolle-Erfassung.
          trachea: { groesse: '', cuffdruck: '', cuffdruckVerlauf: [], feuchteNase: false, sprechventil: false },
          geraete: { akku: false, backup: false, beutel: false }
        },
        vitalwerte: { t1: {}, t2: {}, t3: {} },
        sekret: {
          absaugEndo: '', absaugEndoTouched: false, absaugOral: '', menge: '', farbe: '', konsistenz: '',
          coughAssistAnzahl: '', coughAssistEinstellung: '', inhalation: { nacl: false, sekretolytikum: false, bronchodilatator: false }
        },
        schmerz: {
          instrument: 'cpot', cpot: [0, 0, 0, 0], bps: [1, 1, 1], schmerzfrei: '', lokalisierung: '', ausloeser: '',
          analgetikaGabe: false, analgetikaText: '', analgetikaTextTouched: false,
          bewusstsein: '', rass: '0', pupillen: '', camicu: [false, false, false, false],
          // rassVerlauf: Abschnitt 15 (Agitationsprotokoll, Auftrag René 2026-09-20) -- fortlaufende Kurve des
          // RASS-Scores selbst, analog dem bestehenden Schmerz-verlauf-Muster (kein neues Instrument).
          rassVerlauf: []
        },
        haut: {
          wechsellagerung: '', mikrolagerungAnzahl: 0, mikrolagerungTouched: false,
          stoma: '', kompresseGewechselt: false, kompresseTouched: false,
          pegZustand: '', pegMobilisiert: '', verbandwechsel: false, verbandwechselTouched: false, wundheilung: ''
        },
        medikation: {
          sondenPlanGemaess: '', sondenAbweichung: '', sondennahrungBezeichnung: '', sondennahrungMenge: '',
          einfuhr: { oral: '', sonde: '', infusion: '' }, ausfuhr: { urin: '', stuhl: '', sekret: '' },
          urinCharakter: '', stuhlCharakter: '',
          // Bilanzkontrolle (Abschnitt 6, Modul 3, Auftrag René 2026-09-20) -- ergaenzt einfuhr/ausfuhr, ersetzt nichts.
          zielbilanz: '', gewichtsverlauf: '', oedemHinweis: ''
        },
        besonderes: {
          arztkontakt: '', anordnung: '',
          krisen: { kanueleDislo: false, kanueleGrund: '', sekretbolus: false, sekretbolusGrund: '', notarzt: false, notarztGrund: '' },
          hinweise: '', hinweiseTouched: false
        },
        // ---------- Neue Assessment-Module (Auftrag René 2026-09-20, Abschnitte 8–15) ----------
        positionierung: {
          uhrzeit: '', position: '',
          areale: { sakrum: '', ferse: '', trochanter: '', skapula: '', hinterkopf: '' },
          technik: '', naechstesIntervall: ''
        },
        ernaehrung: {
          bmiUnter205: false, gewichtsverlust3mte: false, reduzierteZufuhr: false, schwerErkrankt: false,
          beeintraechtigung: '0', schwereErkrankung: '0', alterszuschlag: false
        },
        wunde: {
          laenge: '', breite: '', tiefe: '', fistelgang: '', wundgrund: '', wundrand: '',
          exsudatMenge: '', exsudatFarbe: '', exsudatKonsistenz: '', exsudatGeruch: false,
          umgebungshaut: '', infektion: { calor: false, rubor: false, tumor: false, dolor: false, functioLaesa: false }
        },
        sturz: { zweiPersonenStandard: '', leitungssicherung: '', lifterWartung: '', lifterMangelText: '', bettgitter: '' },
        dekubitus: { sensorik: '4', feuchtigkeit: '4', aktivitaet: '4', mobilitaet: '4', ernaehrungBraden: '4', reibung: '3' },
        medikamentenplan: {
          med1: { wirkstoff: '', handelsname: '', staerke: '', form: '', dosis: { morgens: '', mittags: '', abends: '', nachts: '' }, grund: '', hinweise: '' },
          med2: { wirkstoff: '', handelsname: '', staerke: '', form: '', dosis: { morgens: '', mittags: '', abends: '', nachts: '' }, grund: '', hinweise: '' },
          bedarf: { wirkstoff: '', handelsname: '', maxDosis24h: '', mindestabstand: '' }
        },
        insulin: {
          spritz1: { uhrzeit: '', typ: '', dosis: '', sondenkostZeit: '' },
          spritz2: { uhrzeit: '', typ: '', dosis: '', sondenkostZeit: '' },
          korrektur: {
            0: { von: '', bis: '', einheiten: '' }, 1: { von: '', bis: '', einheiten: '' },
            2: { von: '', bis: '', einheiten: '' }, 3: { von: '', bis: '', einheiten: '' }
          },
          gabe: { uhrzeit: '', bzVor: '', bzNach: '', dosis: '', sondenkostStatus: '', hypoSymptome: '' }
        },
        agitation: { ausloeser: '' }
      };
    }
    function getDeep(obj, path) {
      var parts = path.split('.'); var cur = obj;
      for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
      return cur;
    }
    function setDeep(obj, path, value) {
      var parts = path.split('.'); var cur = obj;
      for (var i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] == null) cur[parts[i]] = {}; cur = cur[parts[i]]; }
      cur[parts[parts.length - 1]] = value;
    }
    function getTag(iso) {
      if (!AE.tage[iso]) AE.tage[iso] = {
        von: '', bis: '', pfk: '', gzDone: false, gzPfk2: '', versiegelt: false,
        gzPfkAbgebend: '', gzAbgebendeSig: '', gzAbgebendeZeit: '', gzUebernehmendeSig: '', gzUebernehmendeZeit: '',
        assessment: defaultAssessment()
      };
      // Lazy-Migration: bereits bestehende Tage (vor Einfuehrung des Assessments/der Doppel-Signatur) erhalten
      // die neuen Felder nachtraeglich, ohne bestehende Daten zu ueberschreiben (kein Schema-Bump noetig).
      var tag = AE.tage[iso];
      if (!tag.assessment) tag.assessment = defaultAssessment();
      // Lazy-Migration Kurvenprotokoll (Auftrag René 2026-09-19): Bestandstage vor Einfuehrung der
      // fortlaufenden Beatmungs-/Cuffdruck-Kurve erhalten die neuen Arrays nachtraeglich, ohne
      // bestehende Werte zu ueberschreiben -- verhindert Crashes bei .push()/.filter() auf undefined.
      if (!tag.assessment.beatmung.verlauf) tag.assessment.beatmung.verlauf = [];
      if (!tag.assessment.beatmung.trachea.cuffdruckVerlauf) tag.assessment.beatmung.trachea.cuffdruckVerlauf = [];
      // Lazy-Migration neue Assessment-Module (Auftrag René 2026-09-20, Abschnitte 8–15): Bestandstage
      // erhalten die neuen Namensraeume/Arrays nachtraeglich, ohne bestehende Werte zu ueberschreiben.
      if (!tag.assessment.schmerz.rassVerlauf) tag.assessment.schmerz.rassVerlauf = [];
      if (!tag.assessment.positionierung) tag.assessment.positionierung = defaultAssessment().positionierung;
      if (!tag.assessment.ernaehrung) tag.assessment.ernaehrung = defaultAssessment().ernaehrung;
      if (!tag.assessment.wunde) tag.assessment.wunde = defaultAssessment().wunde;
      if (!tag.assessment.sturz) tag.assessment.sturz = defaultAssessment().sturz;
      if (!tag.assessment.dekubitus) tag.assessment.dekubitus = defaultAssessment().dekubitus;
      if (!tag.assessment.medikamentenplan) tag.assessment.medikamentenplan = defaultAssessment().medikamentenplan;
      if (!tag.assessment.insulin) tag.assessment.insulin = defaultAssessment().insulin;
      if (!tag.assessment.agitation) tag.assessment.agitation = defaultAssessment().agitation;
      if (tag.assessment.medikation.zielbilanz === undefined) tag.assessment.medikation.zielbilanz = '';
      if (tag.assessment.medikation.gewichtsverlauf === undefined) tag.assessment.medikation.gewichtsverlauf = '';
      if (tag.assessment.medikation.oedemHinweis === undefined) tag.assessment.medikation.oedemHinweis = '';
      if (tag.gzPfkAbgebend === undefined) tag.gzPfkAbgebend = '';
      if (tag.gzAbgebendeSig === undefined) tag.gzAbgebendeSig = '';
      if (tag.gzAbgebendeZeit === undefined) tag.gzAbgebendeZeit = '';
      if (tag.gzUebernehmendeSig === undefined) tag.gzUebernehmendeSig = '';
      if (tag.gzUebernehmendeZeit === undefined) tag.gzUebernehmendeZeit = '';
      // Lazy-Cleanup (Fix 4, security-privacy-Audit): gzSig/gzZeit waren eine nie gelesene, rein
      // redundante Drittkopie der Unterschrift (Dublette von gzUebernehmendeSig) und wurden bis
      // 2026-09-20 bei jedem Gegenzeichnen mitgespeichert. Bereits vorhandene Altkopien werden beim
      // naechsten Zugriff auf den jeweiligen Tag entfernt -- die massgebliche Unterschrift bleibt in
      // gzUebernehmendeSig unveraendert erhalten, es geht keine Information verloren.
      if (tag.gzSig !== undefined) delete tag.gzSig;
      if (tag.gzZeit !== undefined) delete tag.gzZeit;
      return tag;
    }
    function getMonat(ym) {
      if (!AE.monate[ym]) AE.monate[ym] = { freigegeben: false, name: '', sig: '', zeit: '' };
      return AE.monate[ym];
    }
    var qcErgaenztVon = null;

    // ---------- Maßnahmenkatalog (fachlich/rechtlich geprüft) ----------
    var AE_KATALOG = [
      { grp: 'SGB V — Behandlungspflege', cat: 'sgb5', items: [
        { l: 'Beatmung/Respiratormanagement', ref: 'AWMF S3-LL Invasive Beatmung, Reg.-Nr. 001-021', k: false },
        { l: 'Absaugen (endotracheal/oral)', ref: 'Hygieneplan/5-Momente WHO-KRINKO', k: false },
        { l: 'Tracheostomapflege', ref: 'AWMF S3-LL/DIGAB', k: false },
        { l: 'Kanülenwechsel', ref: 'AWMF S3-LL/DIGAB', k: true },
        { l: 'Cuffdruckkontrolle', ref: 'AWMF S3-LL/DIGAB', k: false },
        { l: 'Vitalzeichen-Monitoring', ref: 'gemäß ärztlicher Verordnung', k: false },
        { l: 'Schmerzmanagement', ref: 'DNQP Schmerzmanagement 2020, Instrument CPOT/BPS', k: false },
        { l: 'Wund-/Stomaversorgung', ref: 'DNQP Chronische Wunden, 2. Akt. 2025', k: false },
        { l: 'PEG/Magensonde legen oder wechseln', ref: 'QPR-HKP/AKI Kriterium 7.25', k: true },
        { l: 'PEG-Wundversorgung/Verbandwechsel/Fixierungskontrolle', ref: 'HKP-Richtlinie Leistungsverzeichnis Nr. 27', k: false },
        { l: 'Medikamentengabe (auch über Sonde)', ref: 'HKP-Richtlinie Nr. 2/26', k: false, ko: 'Hochrisiko-Medikament (Freitext-Kennzeichnung erforderlich)' },
        { l: 'Mundpflege/VAP-Prophylaxe', ref: 'DNQP Mundgesundheit 2023', k: false },
        { l: 'Notfallmaßnahme/Reanimation', ref: 'Detailschema wird gesondert dokumentiert', k: true },
        { l: 'Ernährungsscreening (NRS-2002)', ref: 'NRS-2002, Kondrup et al. 2003 — Cutoff ≥ 3 = Ernährungsrisiko', k: false },
        { l: 'Wunddokumentation (TIME-Prinzip)', ref: 'TIME-Prinzip, Schultz et al. 2003', k: false },
        { l: 'Medikamentenplan/Bedarfsmedikation (BMP + AMTS)', ref: '§ 31a SGB V (BMP) + AMTS-Erweiterung', k: false },
        { l: 'Insulingabe (Spritzplan/Korrekturschema)', ref: 'AMTS Hochrisiko-Medikament Insulin', k: false, ko: 'Hochrisiko-Medikament (Freitext-Kennzeichnung erforderlich)' },
        { l: 'Agitationsmanagement (RASS-Verlaufsdokumentation)', ref: 'RASS-Ausbau — kein neues Instrument (PAS/NDB fachlich falsch bei diesem Klientel)', k: false }
      ] },
      { grp: 'SGB XI — Grundpflege', cat: 'sgb11', items: [
        { l: 'Körperpflege/Hautpflege', ref: '', k: false },
        { l: 'Lagerung/Mikrolagerung', ref: 'DNQP Dekubitusprophylaxe 2. Akt. 2017 — individuell risikoadaptiertes Intervall gemäß Pflegeplanung, keine starre Zeitvorgabe', k: false },
        { l: 'Sondenkost/-nahrung verabreichen (Gabe, Lagekontrolle vor Gabe, Spülen danach)', ref: 'HKP-RL Nr. 3', k: false },
        { l: 'Mobilisation/Transfer ohne Hilfsmittel', ref: 'DNQP Sturzprophylaxe 2. Akt. 2022', k: false },
        { l: 'Lifter-Transfer', ref: 'DNQP Sturzprophylaxe 2. Akt. 2022', k: true },
        { l: 'Positionierungsprotokoll (individualisierter Lagerungsplan)', ref: 'DNQP Dekubitusprophylaxe 2. Akt. 2017 — risikoadaptiertes Intervall, keine starre Zeitvorgabe', k: false },
        { l: 'Sturzrisiko-Checkliste (multifaktoriell)', ref: 'DNQP Sturzprophylaxe 2. Akt. 2022 — kein Score-Instrument bei Immobilität', k: false },
        { l: 'Dekubitusrisiko-Screening (Braden-Skala)', ref: 'Braden-Skala', k: false }
      ] },
      { grp: 'Beratung (§7a/§45 SGB XI)', cat: 'beratung', items: [
        { l: 'Pflegeberatung § 7a SGB XI', ref: '', k: false },
        { l: 'Schulung § 45 SGB XI', ref: '', k: false }
      ] }
    ];
    function catLabel(cat) { return cat === 'sgb11' ? 'SGB XI' : cat === 'sgb5' ? 'SGB V' : 'Beratung'; }
    function buildKatalogSelect(sel) {
      AE_KATALOG.forEach(function (grp) {
        var og = document.createElement('optgroup'); og.label = grp.grp;
        grp.items.forEach(function (it) {
          var opt = document.createElement('option');
          opt.value = it.l; opt.textContent = it.l;
          opt.dataset.cat = grp.cat; opt.dataset.kritisch = it.k ? 'true' : 'false'; opt.dataset.ref = it.ref || '';
          if (it.ko) opt.dataset.ko = it.ko;
          og.appendChild(opt);
        });
        sel.appendChild(og);
      });
    }

    // ---------- PFK-Selects ----------
    function refreshPfkSelects() {
      ['heute-pfk', 'qc-m-pfk', 'qc-p-pfk', 'verlauf-day-pfk', 'sis-pfk'].forEach(function (id) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var current = sel.value;
        sel.innerHTML = '';
        AE.settings.pfks.forEach(function (pfk) { var o = document.createElement('option'); o.value = pfk; o.textContent = pfk; sel.appendChild(o); });
        if (AE.settings.pfks.indexOf(current) !== -1) sel.value = current;
      });
    }

    // ---------- Quick-Capture: Typ-Tabs ----------
    function selectTypeTab(type, opts) {
      ['massnahme', 'fahrt', 'privat'].forEach(function (t) {
        var panel = document.getElementById('qc-' + t);
        if (panel) panel.classList.toggle('ae-hidden', t !== type);
        var btn = document.querySelector('[data-type-tab="' + t + '"]');
        if (btn) btn.setAttribute('aria-pressed', t === type ? 'true' : 'false');
      });
      // a11y-Fix 2026-09-18: Fokus-Versatz beim Typ-Tab-Wechsel auf das erste Feld des neu
      // sichtbaren Formulars — nur bei explizitem Nutzer-Klick, nicht bei Initialisierung.
      if (opts && opts.focusPanel) {
        var activePanel = document.getElementById('qc-' + type);
        var firstField = activePanel && activePanel.querySelector('input, select, textarea');
        if (firstField) firstField.focus({ preventScroll: true });
      }
    }
    document.querySelectorAll('[data-type-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { selectTypeTab(btn.dataset.typeTab, { focusPanel: true }); });
    });

    // ---------- Quick-Capture: Pflegemaßnahme ----------
    var qcMKatalog = document.getElementById('qc-m-katalog');
    var qcMBadge = document.getElementById('qc-m-badge');
    var qcMRef = document.getElementById('qc-m-ref');
    var qcMPfk2Wrap = document.getElementById('qc-m-pfk2-wrap');
    var qcMPfk2 = document.getElementById('qc-m-pfk2');
    var qcMKoWrap = document.getElementById('qc-m-ko-wrap');
    var qcMKoCheck = document.getElementById('qc-m-ko-check');
    var qcMKoLabel = document.getElementById('qc-m-ko-label');
    var qcMKatalogTriggerLabel = document.getElementById('qc-m-katalog-trigger-label');
    buildKatalogSelect(qcMKatalog);
    function updateQcMassnahme() {
      var opt = qcMKatalog.selectedOptions[0];
      if (!opt) return;
      if (qcMKatalogTriggerLabel) qcMKatalogTriggerLabel.textContent = opt.value || 'Maßnahme wählen …';
      var cat = opt.dataset.cat;
      qcMBadge.className = 'ae-badge-cat ae-badge-cat--' + cat;
      qcMBadge.textContent = catLabel(cat);
      qcMRef.textContent = opt.dataset.ref || '';
      qcMRef.classList.toggle('ae-hidden', !opt.dataset.ref);
      var kritischFest = opt.dataset.kritisch === 'true';
      var ko = opt.dataset.ko;
      qcMKoWrap.classList.toggle('ae-hidden', !ko);
      if (ko) { qcMKoLabel.textContent = ko; } else { qcMKoCheck.checked = false; }
      var kritischEffektiv = kritischFest || !!(ko && qcMKoCheck.checked);
      qcMPfk2Wrap.classList.toggle('ae-hidden', !kritischEffektiv);
      qcMPfk2.required = kritischEffektiv;
      if (!kritischEffektiv) qcMPfk2.value = '';
    }
    qcMKatalog.addEventListener('change', updateQcMassnahme);
    qcMKoCheck.addEventListener('change', updateQcMassnahme);

    // ---------- Zweistufiger Overlay-Flow: Maßnahme wählen (Schritt 1) → Assessment (Schritt 2) ----------
    // (René-Direktive 2026-09-19, Korrektur des vorherigen einstufigen Auto-Open-Verhaltens.)
    // Schritt 1 (ae-massnahme-overlay) öffnet beim Tippen auf den "Pflegemaßnahme"-Tab und ersetzt das
    // vorherige Inline-Dropdown im Formular. Nach Auswahl schaltet die Sequenz um: ist die Maßnahme in
    // AE_ASSESS_MAPPING hinterlegt, wird Schritt 1 aus- und Schritt 2 (ae-assess-overlay, zeigt NUR den
    // zugehörigen Fachabschnitt aus #heute-assessment) eingeblendet -- nicht beide gleichzeitig sichtbar.
    // Ohne Mapping (Mundpflege/VAP, Körperpflege/Hautpflege, Pflegeberatung §7a, Schulung §45) schließt
    // Schritt 1 direkt und die normale Erfassung (PFK/Besonderheiten, bereits im Formular) läuft weiter.
    var AE_ASSESS_MAPPING = {
      'Beatmung/Respiratormanagement': { abschnitt: 1, focus: null },
      'Tracheostomapflege': { abschnitt: 5, focus: null },
      'Kanülenwechsel': { abschnitt: 5, focus: null },
      'Cuffdruckkontrolle': { abschnitt: 5, focus: null },
      'Vitalzeichen-Monitoring': { abschnitt: 2, focus: null },
      'Absaugen (endotracheal/oral)': { abschnitt: 3, focus: null },
      'Schmerzmanagement': { abschnitt: 4, focus: null },
      'Wund-/Stomaversorgung': { abschnitt: 5, focus: null },
      'PEG/Magensonde legen oder wechseln': { abschnitt: 6, focus: null },
      'PEG-Wundversorgung/Verbandwechsel/Fixierungskontrolle': { abschnitt: 6, focus: null },
      'Medikamentengabe (auch über Sonde)': { abschnitt: 6, focus: null },
      'Notfallmaßnahme/Reanimation': { abschnitt: 7, focus: 'heute-krisen-box' },
      'Lagerung/Mikrolagerung': { abschnitt: 5, focus: null },
      'Sondenkost/-nahrung verabreichen (Gabe, Lagekontrolle vor Gabe, Spülen danach)': { abschnitt: 6, focus: null },
      'Mobilisation/Transfer ohne Hilfsmittel': { abschnitt: 5, focus: null },
      'Lifter-Transfer': { abschnitt: 5, focus: null },
      // Neue Assessment-Module (Auftrag René 2026-09-20, Abschnitte 8–15)
      'Positionierungsprotokoll (individualisierter Lagerungsplan)': { abschnitt: 8, focus: null },
      'Ernährungsscreening (NRS-2002)': { abschnitt: 9, focus: null },
      'Wunddokumentation (TIME-Prinzip)': { abschnitt: 10, focus: null },
      'Sturzrisiko-Checkliste (multifaktoriell)': { abschnitt: 11, focus: null },
      'Dekubitusrisiko-Screening (Braden-Skala)': { abschnitt: 12, focus: null },
      'Medikamentenplan/Bedarfsmedikation (BMP + AMTS)': { abschnitt: 13, focus: null },
      'Insulingabe (Spritzplan/Korrekturschema)': { abschnitt: 14, focus: null },
      'Agitationsmanagement (RASS-Verlaufsdokumentation)': { abschnitt: 15, focus: null }
    };
    var assessOverlay = document.getElementById('ae-assess-overlay');
    var assessOverlayBackdrop = document.getElementById('ae-assess-overlay-backdrop');
    var assessOverlayTitle = document.getElementById('ae-assess-overlay-title');
    var assessOverlayClose = document.getElementById('ae-assess-overlay-close');
    var assessOverlaySubmit = document.getElementById('ae-assess-overlay-submit');
    var assessOverlayReturnFocus = null;
    function openAssessOverlay(abschnittIndex, focusId) {
      var sections = Array.prototype.slice.call(document.querySelectorAll('#heute-assessment > .ae-assess-section'));
      sections.forEach(function (sec, i) {
        var visible = (i + 1) === abschnittIndex;
        sec.classList.toggle('ae-hidden', !visible);
        if (visible) sec.open = true;
      });
      var active = sections[abschnittIndex - 1];
      var summaryEl = active ? active.querySelector('summary') : null;
      assessOverlayTitle.textContent = summaryEl ? summaryEl.textContent : 'Assessment';
      assessOverlayReturnFocus = document.activeElement;
      assessOverlay.classList.remove('ae-legal-hidden');
      assessOverlayBackdrop.classList.add('ae-legal-backdrop--visible');
      document.body.style.overflow = 'hidden';
      window.requestAnimationFrame(function () {
        var focusTarget = focusId ? document.getElementById(focusId) : null;
        var focusable = focusTarget ? (focusTarget.matches('input, select, textarea, button') ? focusTarget : focusTarget.querySelector('input, select, textarea, button')) : null;
        if (focusTarget && focusTarget.scrollIntoView) focusTarget.scrollIntoView({ block: 'center' });
        (focusable || assessOverlayClose).focus();
      });
    }
    function closeAssessOverlay() {
      if (!assessOverlay || assessOverlay.classList.contains('ae-legal-hidden')) return;
      assessOverlay.classList.add('ae-legal-hidden');
      assessOverlayBackdrop.classList.remove('ae-legal-backdrop--visible');
      document.body.style.overflow = '';
      if (assessOverlayReturnFocus && document.body.contains(assessOverlayReturnFocus)) assessOverlayReturnFocus.focus();
      assessOverlayReturnFocus = null;
    }
    assessOverlayClose.addEventListener('click', closeAssessOverlay);
    assessOverlay.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeAssessOverlay(); });
    assessOverlaySubmit.addEventListener('click', function () {
      // Werte sind ueber Auto-Save (handleHeuteAssessInput -> persist() bei jeder Eingabe) bereits
      // gespeichert; "Übertragen" bestaetigt den Abschluss explizit und schliesst das Overlay.
      persist();
      closeAssessOverlay();
    });

    // ---------- Schritt 1: Maßnahmen-Auswahl-Overlay ----------
    var massnahmeOverlay = document.getElementById('ae-massnahme-overlay');
    var massnahmeOverlayBackdrop = document.getElementById('ae-massnahme-overlay-backdrop');
    var massnahmeOverlayClose = document.getElementById('ae-massnahme-overlay-close');
    var massnahmeOverlayList = document.getElementById('ae-massnahme-overlay-list');
    var massnahmeOverlayReturnFocus = null;
    function buildMassnahmeOverlayList() {
      massnahmeOverlayList.innerHTML = '';
      AE_KATALOG.forEach(function (grp) {
        var h = document.createElement('h5');
        h.className = 'text-xs font-bold text-[#9CADC9] uppercase tracking-wide mb-2 mt-4';
        h.textContent = grp.grp;
        massnahmeOverlayList.appendChild(h);
        grp.items.forEach(function (it) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ae-btn-secondary w-full text-left mb-2';
          btn.style.minHeight = '44px';
          btn.textContent = it.l;
          btn.addEventListener('click', function () { selectMassnahmeFromOverlay(it.l); });
          massnahmeOverlayList.appendChild(btn);
        });
      });
    }
    buildMassnahmeOverlayList();
    function openMassnahmeOverlay() {
      massnahmeOverlayReturnFocus = document.activeElement;
      massnahmeOverlay.classList.remove('ae-legal-hidden');
      massnahmeOverlayBackdrop.classList.add('ae-legal-backdrop--visible');
      document.body.style.overflow = 'hidden';
      window.requestAnimationFrame(function () {
        var firstBtn = massnahmeOverlayList.querySelector('button');
        (firstBtn || massnahmeOverlayClose).focus();
      });
    }
    function closeMassnahmeOverlay(opts) {
      if (!massnahmeOverlay || massnahmeOverlay.classList.contains('ae-legal-hidden')) return;
      massnahmeOverlay.classList.add('ae-legal-hidden');
      massnahmeOverlayBackdrop.classList.remove('ae-legal-backdrop--visible');
      if (!(opts && opts.keepScrollLock)) document.body.style.overflow = '';
      if (!(opts && opts.skipReturnFocus) && massnahmeOverlayReturnFocus && document.body.contains(massnahmeOverlayReturnFocus)) massnahmeOverlayReturnFocus.focus();
      massnahmeOverlayReturnFocus = null;
    }
    // Uebergabe der gewaehlten Maßnahme aus Schritt 1 an Formular + ggf. Schritt 2 (Umschalten, nicht
    // gleichzeitig sichtbar): mit Mapping wird Schritt 1 ausgeblendet und sofort Schritt 2 eingeblendet
    // (Fokus wandert in Schritt 2, kein Zwischen-Fokus auf das Formular); ohne Mapping schliesst Schritt 1
    // direkt und der Fokus geht auf das PFK-Feld der ohnehin vorhandenen Erfassung weiter.
    function selectMassnahmeFromOverlay(label) {
      qcMKatalog.value = label;
      updateQcMassnahme();
      var mapping = AE_ASSESS_MAPPING[label];
      if (mapping) {
        closeMassnahmeOverlay({ keepScrollLock: true, skipReturnFocus: true });
        openAssessOverlay(mapping.abschnitt, mapping.focus);
        assessOverlayReturnFocus = document.getElementById('qc-m-pfk') || assessOverlayReturnFocus;
      } else {
        closeMassnahmeOverlay({ skipReturnFocus: true });
        var pfkField = document.getElementById('qc-m-pfk');
        if (pfkField) pfkField.focus();
      }
    }
    document.getElementById('qc-m-katalog-trigger').addEventListener('click', openMassnahmeOverlay);
    massnahmeOverlayClose.addEventListener('click', function () { closeMassnahmeOverlay(); });
    massnahmeOverlay.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeMassnahmeOverlay(); });
    document.querySelectorAll('[data-type-tab]').forEach(function (btn) {
      if (btn.dataset.typeTab === 'massnahme') btn.addEventListener('click', openMassnahmeOverlay);
    });

    // Gemeinsamer Fokus-Falle-/ESC-Handler fuer beide Schritte (immer nur einer sichtbar, s.o.).
    document.addEventListener('keydown', function (e) {
      var activeOverlay = [massnahmeOverlay, assessOverlay].filter(function (ov) { return ov && !ov.classList.contains('ae-legal-hidden'); })[0];
      if (!activeOverlay) return;
      if (e.key === 'Escape') {
        if (activeOverlay === massnahmeOverlay) closeMassnahmeOverlay(); else closeAssessOverlay();
        return;
      }
      if (e.key === 'Tab') {
        var focusable = getFocusable(activeOverlay);
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    document.getElementById('qc-massnahme').addEventListener('submit', function (e) {
      e.preventDefault();
      var opt = qcMKatalog.selectedOptions[0];
      var cat = opt.dataset.cat;
      var kritischFest = opt.dataset.kritisch === 'true';
      var ko = opt.dataset.ko;
      var hochrisiko = !!(ko && qcMKoCheck.checked);
      var kritisch = kritischFest || hochrisiko;
      if (kritisch && !qcMPfk2.value.trim()) { qcMPfk2.focus(); return; }
      var entry = {
        id: uid(), type: 'massnahme', datum: todayIso(), uhrzeit: nowHm(),
        pfk: document.getElementById('qc-m-pfk').value, label: opt.value, cat: cat, ref: opt.dataset.ref || '',
        kritisch: kritisch, hochrisiko: hochrisiko, pfk2: kritisch ? qcMPfk2.value.trim() : '',
        besonderheiten: document.getElementById('qc-m-besonderheiten').value.trim(),
        ergaenztVon: qcErgaenztVon, createdAt: Date.now()
      };
      AE.entries.push(entry);
      // Fortlaufende Kurve statt Einzelschnappschuss (Auftrag René 2026-09-19): jede erneute Erfassung
      // von Beatmung/Respiratormanagement bzw. Cuffdruckkontrolle haengt einen Snapshot an, statt den
      // vorherigen Wert zu ueberschreiben -- Muster identisch zu a.schmerz.verlauf.push() (s. dort).
      var vTag = getTag(entry.datum); var va = vTag.assessment;
      if (entry.label === 'Beatmung/Respiratormanagement') {
        if (!va.beatmung.verlauf) va.beatmung.verlauf = [];
        va.beatmung.verlauf.push({
          zeit: entry.uhrzeit, fio2: va.beatmung.ist.fio2, peep: va.beatmung.ist.peep,
          vt: va.beatmung.ist.vt, freq: va.beatmung.ist.freq, ppeak: va.beatmung.ist.ppeak
        });
        if (va.beatmung.verlauf.length > 20) va.beatmung.verlauf.shift();
      } else if (entry.label === 'Cuffdruckkontrolle') {
        if (!va.beatmung.trachea.cuffdruckVerlauf) va.beatmung.trachea.cuffdruckVerlauf = [];
        va.beatmung.trachea.cuffdruckVerlauf.push({ zeit: entry.uhrzeit, wert: va.beatmung.trachea.cuffdruck });
        if (va.beatmung.trachea.cuffdruckVerlauf.length > 20) va.beatmung.trachea.cuffdruckVerlauf.shift();
      }
      persist(); qcErgaenztVon = null;
      document.getElementById('qc-erg-hinweis').style.display = 'none';
      this.reset(); updateQcMassnahme();
      renderHeute(); renderVerlaufIfOpen();
      showInlineNote(document.getElementById('qc-massnahme-note'));
    });

    // ---------- Quick-Capture: Fahrt ----------
    function updateQcFahrtBadge() {
      var sparte = document.getElementById('qc-f-sparte').value;
      var badge = document.getElementById('qc-f-badge');
      badge.className = 'ae-badge-cat ' + (sparte === 'beratung' ? 'ae-badge-cat--beratung' : 'ae-badge-cat--pflege-kombi');
      badge.textContent = sparte === 'beratung' ? 'Säule 2 — Beratung' : 'Säule 1 — Pflege';
    }
    document.getElementById('qc-f-sparte').addEventListener('change', updateQcFahrtBadge);
    document.getElementById('qc-fahrt').addEventListener('submit', function (e) {
      e.preventDefault();
      var entry = {
        id: uid(), type: 'fahrt', datum: todayIso(), uhrzeit: nowHm(),
        von: document.getElementById('qc-f-von').value.trim(), nach: document.getElementById('qc-f-nach').value.trim(),
        km: document.getElementById('qc-f-km').value, zweck: document.getElementById('qc-f-zweck').value.trim(),
        sparte: document.getElementById('qc-f-sparte').value, ergaenztVon: qcErgaenztVon, createdAt: Date.now()
      };
      AE.entries.push(entry); persist(); qcErgaenztVon = null;
      document.getElementById('qc-erg-hinweis').style.display = 'none';
      this.reset(); updateQcFahrtBadge();
      renderHeute(); renderVerlaufIfOpen();
      showInlineNote(document.getElementById('qc-fahrt-note'));
    });

    // ---------- Quick-Capture: Privatleistung (nur Aufnahme/Anamnese-Pauschale — Festbetrag, kein Naeherungswert) ----------
    function resetSigTrigger(btn) {
      if (!btn) return;
      btn.innerHTML = '<span class="ae-sig-trigger-placeholder">Zum Unterschreiben tippen (optional)</span>';
      btn.classList.remove('ae-sig-trigger--filled');
      var ariaBase = btn.dataset.signatureAriaLabel || '';
      btn.setAttribute('aria-label', ariaBase + ', zum Unterschreiben tippen, optional');
    }
    document.getElementById('qc-privat').addEventListener('submit', function (e) {
      e.preventDefault();
      var entry = {
        id: uid(), type: 'privat', datum: todayIso(), uhrzeit: nowHm(), art: 'aufnahme',
        pfk: document.getElementById('qc-p-pfk').value, betrag: document.getElementById('qc-p-pauschale').value,
        signatur: document.getElementById('qc-p-sig-value').value || '', ergaenztVon: qcErgaenztVon, createdAt: Date.now()
      };
      AE.entries.push(entry); persist(); qcErgaenztVon = null;
      document.getElementById('qc-erg-hinweis').style.display = 'none';
      document.getElementById('qc-p-pauschale').value = AE.settings.pauschaleAufnahme;
      document.getElementById('qc-p-sig-value').value = '';
      resetSigTrigger(document.getElementById('qc-p-sig-trigger'));
      var qcPTypedInput = document.querySelector('.ae-sig-type-input[data-signature-typed-for="qc-p-consent"]');
      if (qcPTypedInput) qcPTypedInput.value = '';
      renderHeute(); renderVerlaufIfOpen();
      showInlineNote(document.getElementById('qc-privat-note'));
    });

    // ---------- Listen-Rendering (drei getrennte Typen, nie gemischt) ----------
    function entriesFor(iso, type) {
      return AE.entries.filter(function (e) { return e.datum === iso && e.type === type; })
        .sort(function (a, b) { return a.uhrzeit.localeCompare(b.uhrzeit) || a.createdAt - b.createdAt; });
    }
    function renderMassnahmeList(container, iso, readonly) {
      if (!container) return;
      var list = entriesFor(iso, 'massnahme');
      container.innerHTML = '';
      if (!list.length) { container.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine Pflegemaßnahmen erfasst.</p>'; return; }
      list.forEach(function (en) {
        var row = document.createElement('div'); row.className = 'ae-list-row';
        row.innerHTML =
          '<div class="flex items-start justify-between gap-3 flex-wrap">' +
            '<div>' +
              '<div class="flex items-center gap-2 flex-wrap mb-1">' +
                '<span class="ae-badge-cat ae-badge-cat--' + en.cat + '">' + catLabel(en.cat) + '</span>' +
                (en.kritisch ? '<span class="ae-badge-cat ae-badge-cat--kritisch">Vier-Augen</span>' : '') +
                (en.ergaenztVon ? '<span class="text-[#9CADC9] text-xs">Ergänzung</span>' : '') +
              '</div>' +
              '<p class="text-white text-sm font-semibold">' + en.uhrzeit + ' Uhr — ' + escapeHtml(en.label) + '</p>' +
              '<p class="text-[#9CADC9] text-xs">PFK: ' + escapeHtml(en.pfk) + (en.pfk2 ? ' · 2. PFK: ' + escapeHtml(en.pfk2) : '') + (en.ref ? ' · ' + escapeHtml(en.ref) : '') + '</p>' +
              (en.besonderheiten ? '<p class="text-[#C0C0C0] text-xs mt-1">' + escapeHtml(en.besonderheiten) + '</p>' : '') +
            '</div>' +
            '<button type="button" class="text-[#9CADC9] hover:text-white underline text-xs" style="min-height:44px;" data-erg="' + en.id + '" data-erg-type="massnahme">Ergänzen</button>' +
          '</div>';
        container.appendChild(row);
      });
    }
    function renderFahrtList(container, iso, readonly) {
      if (!container) return;
      var list = entriesFor(iso, 'fahrt');
      container.innerHTML = '';
      if (!list.length) { container.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine Fahrten erfasst.</p>'; return; }
      list.forEach(function (en) {
        var row = document.createElement('div'); row.className = 'ae-list-row';
        var sparteBadgeClass = en.sparte === 'beratung' ? 'ae-badge-cat--beratung' : 'ae-badge-cat--pflege-kombi';
        var sparteLabel = en.sparte === 'beratung' ? 'Säule 2 — Beratung' : 'Säule 1 — Pflege';
        row.innerHTML =
          '<div class="flex items-start justify-between gap-3 flex-wrap">' +
            '<div>' +
              '<div class="flex items-center gap-2 flex-wrap mb-1"><span class="ae-badge-cat ' + sparteBadgeClass + '">' + sparteLabel + '</span>' +
                (en.ergaenztVon ? '<span class="text-[#9CADC9] text-xs">Ergänzung</span>' : '') + '</div>' +
              '<p class="text-white text-sm font-semibold">' + en.uhrzeit + ' Uhr — ' + escapeHtml(en.von) + ' → ' + escapeHtml(en.nach) + '</p>' +
              '<p class="text-[#9CADC9] text-xs">' + (parseFloat(en.km) || 0).toFixed(1) + ' km' + (en.zweck ? ' · ' + escapeHtml(en.zweck) : '') + '</p>' +
            '</div>' +
            '<div class="flex items-center gap-1">' +
              '<button type="button" class="text-[#9CADC9] hover:text-white underline text-xs" style="min-height:44px;" data-erg="' + en.id + '" data-erg-type="fahrt">Ergänzen</button>' +
              (readonly ?
                '<span class="text-[#6E7B8F] text-xs" title="Tag ist versiegelt — Fahrt kann nicht mehr gelöscht werden.">🔒</span>' :
                '<button type="button" class="ae-fahrt-delete-btn" style="min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;color:#9CADC9;background:transparent;border:none;cursor:pointer;" ' +
                  'data-del-fahrt="' + en.id + '" aria-label="Fahrt vom ' + en.uhrzeit + ' Uhr (' + escapeHtml(en.von) + ' → ' + escapeHtml(en.nach) + ') löschen">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<polyline points="3 6 5 6 21 6"></polyline>' +
                    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
                    '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
                    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
                  '</svg>' +
                '</button>') +
            '</div>' +
          '</div>';
        container.appendChild(row);
      });
    }
    function renderPrivatList(container, iso, readonly) {
      if (!container) return;
      var list = entriesFor(iso, 'privat');
      container.innerHTML = '';
      if (!list.length) { container.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine Privatleistungen erfasst.</p>'; return; }
      list.forEach(function (en) {
        var row = document.createElement('div'); row.className = 'ae-list-row';
        row.innerHTML =
          '<div class="flex items-start justify-between gap-3 flex-wrap">' +
            '<div>' +
              '<div class="flex items-center gap-2 flex-wrap mb-1"><span class="ae-badge-cat ae-badge-cat--privat">Privatleistung</span>' +
                (en.ergaenztVon ? '<span class="text-[#9CADC9] text-xs">Ergänzung</span>' : '') + '</div>' +
              '<p class="text-white text-sm font-semibold">' + en.uhrzeit + ' Uhr — Aufnahme/Anamnese · ' + formatEuro(parseFloat(en.betrag) || 0) + '</p>' +
              '<p class="text-[#9CADC9] text-xs">PFK: ' + escapeHtml(en.pfk) + (en.signatur ? ' · Zustimmung Klient erfasst' : '') + '</p>' +
            '</div>' +
            '<button type="button" class="text-[#9CADC9] hover:text-white underline text-xs" style="min-height:44px;" data-erg="' + en.id + '" data-erg-type="privat">Ergänzen</button>' +
          '</div>';
        container.appendChild(row);
      });
    }

    // ---------- Ergänzen: neuer verknüpfter Eintrag, Original bleibt (§ 630f BGB) ----------
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-erg]');
      if (!btn) return;
      var id = btn.dataset.erg, type = btn.dataset.ergType;
      var orig = AE.entries.filter(function (x) { return x.id === id; })[0];
      if (!orig) return;
      qcErgaenztVon = id;
      showView('heute');
      selectTypeTab(type);
      if (type === 'massnahme') {
        qcMKatalog.value = orig.label; updateQcMassnahme();
        document.getElementById('qc-m-pfk').value = orig.pfk;
      } else if (type === 'fahrt') {
        document.getElementById('qc-f-von').value = orig.von;
        document.getElementById('qc-f-nach').value = orig.nach;
        document.getElementById('qc-f-sparte').value = orig.sparte; updateQcFahrtBadge();
      } else if (type === 'privat') {
        document.getElementById('qc-p-pfk').value = orig.pfk;
      }
      var hint = document.getElementById('qc-erg-hinweis');
      hint.textContent = 'Ergänzung zu Eintrag ' + orig.uhrzeit + ' Uhr — Original bleibt unverändert (§ 630f BGB).';
      hint.style.display = 'block';
      document.getElementById('quick-capture').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // ---------- Fahrt löschen: nur Fahrten, kein Audit-Trail-Zwang (kein Pflegenachweis, kein § 630f BGB) ----------
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del-fahrt]');
      if (!btn) return;
      var id = btn.dataset.delFahrt;
      var idx = AE.entries.findIndex(function (x) { return x.id === id; });
      if (idx === -1) return;
      var en = AE.entries[idx];
      var tag = AE.tage[en.datum];
      if (tag && tag.versiegelt) return; // Tag bereits versiegelt — Löschsperre (Defense-in-Depth, Button ist dann ohnehin ausgeblendet)
      if (!confirm('Fahrt wirklich löschen?')) return;
      AE.entries.splice(idx, 1);
      persist();
      renderHeute(); renderVerlaufIfOpen();
    });

    // ---------- Heute: Kopfzeile + Listen ----------
    function statusPillClass(tag) { return tag.versiegelt ? 'ae-status-pill--versiegelt' : tag.gzDone ? 'ae-status-pill--gz' : 'ae-status-pill--offen'; }
    function statusPillLabel(tag) { return tag.versiegelt ? 'Versiegelt' : tag.gzDone ? 'Gegengezeichnet' : 'Offen'; }
    function renderHeute() {
      var iso = todayIso();
      var tag = getTag(iso);
      var pfkSel = document.getElementById('heute-pfk');
      if (tag.pfk && AE.settings.pfks.indexOf(tag.pfk) !== -1) pfkSel.value = tag.pfk;
      var pill = document.getElementById('heute-status-pill');
      pill.textContent = statusPillLabel(tag);
      pill.className = 'ae-status-pill ' + statusPillClass(tag);
      // Von/Bis-Schichtzeit — dieselbe AE.tage[iso]-Quelle wie das Verlauf-Tagesdetail (single source of truth).
      var heuteVonEl = document.getElementById('heute-von'), heuteBisEl = document.getElementById('heute-bis');
      heuteVonEl.value = tag.von; heuteBisEl.value = tag.bis;
      heuteVonEl.disabled = tag.versiegelt; heuteBisEl.disabled = tag.versiegelt;
      document.getElementById('heute-schichtzeit-hinweis').classList.toggle('ae-hidden', !!(tag.von && tag.bis));
      var m = entriesFor(iso, 'massnahme'), f = entriesFor(iso, 'fahrt'), p = entriesFor(iso, 'privat');
      document.getElementById('heute-kpi-massnahmen').textContent = m.length;
      var km = f.reduce(function (s, en) { return s + (parseFloat(en.km) || 0); }, 0);
      document.getElementById('heute-kpi-km').textContent = km.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km';
      var privatSumme = p.reduce(function (s, en) { return s + (parseFloat(en.betrag) || 0); }, 0);
      document.getElementById('heute-kpi-privat').textContent = formatEuro(privatSumme);
      renderMassnahmeList(document.getElementById('heute-list-massnahme'), iso, tag.versiegelt);
      renderFahrtList(document.getElementById('heute-list-fahrt'), iso, tag.versiegelt);
      renderPrivatList(document.getElementById('heute-list-privat'), iso, tag.versiegelt);
      // Schicht-Assessment (heute) -- dieselbe Render-/Update-Funktion wie im Verlauf-Tagesdetail,
      // nur mit scope='heute' auf das heute-assessment-Panel statt verlauf-assessment gerichtet.
      renderAssessmentForm(iso, 'heute');
      document.dispatchEvent(new CustomEvent('aeris:heute-gerendert'));
    }
    document.getElementById('heute-pfk').addEventListener('change', function () { getTag(todayIso()).pfk = this.value; persist(); });
    ['heute-von', 'heute-bis'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        var tag = getTag(todayIso());
        if (tag.versiegelt) return;
        tag.von = document.getElementById('heute-von').value;
        tag.bis = document.getElementById('heute-bis').value;
        persist();
        renderHeute(); renderVerlaufIfOpen();
      });
    });

    // ---------- Verlauf: Monatskalender ----------
    var vCalYear, vCalMonth, vSelectedDate = null;
    (function () { var d = new Date(); vCalYear = d.getFullYear(); vCalMonth = d.getMonth(); })();
    var V_MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    function monthKey() { return vCalYear + '-' + pad2(vCalMonth + 1); }
    function renderVerlaufCalendar() {
      var grid = document.getElementById('verlauf-cal-grid');
      if (!grid) return;
      grid.innerHTML = '';
      var firstDow = new Date(vCalYear, vCalMonth, 1).getDay();
      var leading = firstDow === 0 ? 6 : firstDow - 1;
      var daysInMonth = new Date(vCalYear, vCalMonth + 1, 0).getDate();
      for (var i = 0; i < leading; i++) { var em = document.createElement('span'); em.className = 'ae-cal-day ae-cal-day--empty'; em.setAttribute('aria-hidden', 'true'); grid.appendChild(em); }
      for (var d = 1; d <= daysInMonth; d++) {
        var iso = isoDate(vCalYear, vCalMonth, d);
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ae-cal-day'; btn.textContent = d; btn.dataset.date = iso;
        var mE = entriesFor(iso, 'massnahme'), fE = entriesFor(iso, 'fahrt'), pE = entriesFor(iso, 'privat');
        var hasAny = mE.length || fE.length || pE.length;
        if (hasAny) btn.classList.add('ae-cal-day--has-entry');
        if (pE.length) btn.classList.add('ae-cal-day--privat');
        if (iso === vSelectedDate) btn.classList.add('ae-cal-day--selected');
        var cats = {};
        mE.forEach(function (en) { cats[en.cat] = true; });
        if (fE.length) cats.fahrt = true;
        var dotKeys = Object.keys(cats);
        if (dotKeys.length) {
          var dots = document.createElement('span'); dots.className = 'ae-cal-dots'; dots.setAttribute('aria-hidden', 'true');
          ['sgb11', 'sgb5', 'beratung', 'fahrt'].forEach(function (k) { if (cats[k]) { var s = document.createElement('span'); s.className = 'ae-cal-dot--' + k; dots.appendChild(s); } });
          btn.appendChild(dots);
        }
        // a11y-Fix 2026-09-18: aria-label um die am Tag tatsaechlich erfassten Kategorien erweitern
        // (Screenreader-Nutzer sehen sonst nur den Status, nicht die Punkte/Raute-Symbole).
        if (pE.length) cats.privat = true;
        var CAL_CAT_LABELS = { sgb11: 'SGB XI', sgb5: 'SGB V', beratung: 'Beratung', fahrt: 'Fahrt', privat: 'Privatleistung' };
        var catNames = ['sgb11', 'sgb5', 'beratung', 'fahrt', 'privat'].filter(function (k) { return cats[k]; }).map(function (k) { return CAL_CAT_LABELS[k]; });
        var catsText = catNames.length ? ', erfasst: ' + catNames.join(', ') : '';
        var tagRec = AE.tage[iso];
        var statusLabel = tagRec && tagRec.versiegelt ? 'versiegelt' : tagRec && tagRec.gzDone ? 'gegengezeichnet' : hasAny ? 'offen' : 'kein Eintrag';
        btn.setAttribute('aria-label', d + '. ' + V_MONTH_NAMES[vCalMonth] + ' ' + vCalYear + ' — ' + statusLabel + catsText);
        grid.appendChild(btn);
      }
      document.getElementById('verlauf-cal-label').textContent = V_MONTH_NAMES[vCalMonth] + ' ' + vCalYear;
      updateMonatFreigabeStatus();
    }
    document.getElementById('verlauf-cal-prev').addEventListener('click', function () {
      vCalMonth--; if (vCalMonth < 0) { vCalMonth = 11; vCalYear--; }
      vSelectedDate = null; document.getElementById('verlauf-day-panel').classList.add('ae-hidden'); renderVerlaufCalendar();
    });
    document.getElementById('verlauf-cal-next').addEventListener('click', function () {
      vCalMonth++; if (vCalMonth > 11) { vCalMonth = 0; vCalYear++; }
      vSelectedDate = null; document.getElementById('verlauf-day-panel').classList.add('ae-hidden'); renderVerlaufCalendar();
    });
    document.getElementById('verlauf-cal-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.ae-cal-day');
      if (!btn || btn.classList.contains('ae-cal-day--empty')) return;
      openVerlaufDay(btn.dataset.date);
    });

    // ---------- Verlauf: Tagesdetail-Panel ----------
    function updateVerlaufDayStatus() {
      if (!vSelectedDate) return;
      var tag = getTag(vSelectedDate);
      var pill = document.getElementById('verlauf-day-status-pill');
      pill.textContent = statusPillLabel(tag);
      pill.className = 'ae-status-pill ' + statusPillClass(tag);
      // Fix (product-acceptance 2026-09-18): Gegenzeichnung ohne erfasste Schichtzeit fuehrt zu
      // stillem Datenverlust (0,00 Std./0,00 EUR im Leistungsnachweis trotz dokumentierter Massnahmen).
      // Blockade nur wenn am Tag tatsaechlich Massnahmen/Fahrten erfasst wurden -- ein leerer Tag ist normal.
      var hatMassnahmenOderFahrten = entriesFor(vSelectedDate, 'massnahme').length > 0 || entriesFor(vSelectedDate, 'fahrt').length > 0;
      var fehltSchichtzeit = hatMassnahmenOderFahrten && (!tag.von || !tag.bis);
      document.getElementById('verlauf-btn-gegenzeichnen').disabled = tag.versiegelt || fehltSchichtzeit;
      document.getElementById('verlauf-gegenzeichnen-hinweis').classList.toggle('ae-hidden', tag.versiegelt || !fehltSchichtzeit);
      document.getElementById('verlauf-btn-versiegeln').disabled = tag.versiegelt || !tag.gzDone;
      // Kuerzel/Signatur-Vorschau des Abschluss-Abschnitts: eigene Renderfunktion (s. renderGegenzeichnenAbschnitt).
      renderGegenzeichnenAbschnitt(vSelectedDate);
      // Fix 2 (testing-qa): versiegelte Tage sind fuer Dienstbeginn/-ende/PFK gesperrt,
      // diese Werte fliessen direkt in Leistungsnachweis-Stunden und Rechnungsbetrag ein.
      document.getElementById('verlauf-day-von').disabled = tag.versiegelt;
      document.getElementById('verlauf-day-bis').disabled = tag.versiegelt;
      document.getElementById('verlauf-day-pfk').disabled = tag.versiegelt;
      var versiegelnHinweis = document.getElementById('verlauf-versiegeln-hinweis');
      versiegelnHinweis.textContent = tag.versiegelt ? 'Tag ist bereits versiegelt.'
        : !tag.gzDone ? 'Erst nach Schicht-Gegenzeichnung möglich.' : 'Bereit zum Versiegeln.';
    }
    function openVerlaufDay(iso) {
      vSelectedDate = iso;
      var tag = getTag(iso);
      document.getElementById('verlauf-day-title').textContent = new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      document.getElementById('verlauf-day-von').value = tag.von;
      document.getElementById('verlauf-day-bis').value = tag.bis;
      var pfkSel = document.getElementById('verlauf-day-pfk');
      if (tag.pfk && AE.settings.pfks.indexOf(tag.pfk) !== -1) pfkSel.value = tag.pfk; else if (AE.settings.pfks.length) pfkSel.value = AE.settings.pfks[0];
      updateVerlaufDayStatus();
      renderMassnahmeList(document.getElementById('verlauf-day-list-massnahme'), iso, tag.versiegelt);
      renderFahrtList(document.getElementById('verlauf-day-list-fahrt'), iso, tag.versiegelt);
      renderPrivatList(document.getElementById('verlauf-day-list-privat'), iso, tag.versiegelt);
      renderAssessmentForm(iso, 'verlauf');
      document.getElementById('verlauf-day-panel').classList.remove('ae-hidden');
      renderVerlaufCalendar();
      document.getElementById('verlauf-day-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // Schreibgeschuetzte Status-Schnittstelle fuer die Oberflaechen-Ebene (aeris-ui.js): liefert nur
    // Zaehlwerte/Statusflags, keine Gesundheitsdaten, und veraendert AE nicht (kein getTag()-Anlegen).
    window.AERIS_DOKU = {
      heuteIso: function () { return todayIso(); },
      tagStatus: function (iso) {
        var t = AE.tage[iso] || {};
        var f = entriesFor(iso, 'fahrt');
        return {
          von: t.von || '', bis: t.bis || '', gzDone: !!t.gzDone, versiegelt: !!t.versiegelt,
          massnahmen: entriesFor(iso, 'massnahme').length, fahrten: f.length, privat: entriesFor(iso, 'privat').length,
          km: f.reduce(function (s, en) { return s + (parseFloat(en.km) || 0); }, 0)
        };
      },
      offeneTage: function (ym) {
        var tage = {};
        AE.entries.forEach(function (en) { if (en.datum && en.datum.indexOf(ym) === 0) tage[en.datum] = true; });
        Object.keys(AE.tage).forEach(function (iso) { if (iso.indexOf(ym) === 0 && (AE.tage[iso].von || AE.tage[iso].bis)) tage[iso] = true; });
        return Object.keys(tage).filter(function (iso) { return !(AE.tage[iso] && AE.tage[iso].versiegelt); }).sort();
      },
      tagOeffnen: function (iso) { showView('verlauf'); openVerlaufDay(iso); }
    };
    function renderVerlaufIfOpen() { if (vSelectedDate) openVerlaufDay(vSelectedDate); else if (document.getElementById('verlauf-cal-grid')) renderVerlaufCalendar(); }

    // ================= Schicht-Assessment (Abschnitte 1-7) =================
    // ---------- Wiederverwendbare Mini-Kurve (reines Vanilla-SVG, kein Chart-Framework) ----------
    // series: Array aus { v: Zahl|null, label?: String }. opts: { width, height, color, min, max, refValue }.
    // aria-hidden — Tabellen/Zahlenfelder bleiben die zugaengliche Primaerquelle (s. CLAUDE.md-Auftrag).
    function aeMiniChart(series, opts) {
      opts = opts || {};
      var vals = series.map(function (p) { return p && typeof p.v === 'number' && !isNaN(p.v) ? p.v : null; });
      var validCount = vals.filter(function (v) { return v !== null; }).length;
      if (validCount < 2) return '';
      var w = opts.width || 200, h = opts.height || 56;
      // padLeft groesser als die uebrigen Seiten: Platz fuer Y-Achsen-Skalenwerte (Auftrag René, Raster+Skala).
      var padTop = 9, padBottom = 9, padRight = 8, padLeft = opts.padLeft || 28;
      var present = vals.filter(function (v) { return v !== null; });
      var min = opts.min !== undefined ? opts.min : Math.min.apply(null, present);
      var max = opts.max !== undefined ? opts.max : Math.max.apply(null, present);
      if (opts.refValue !== undefined) { min = Math.min(min, opts.refValue); max = Math.max(max, opts.refValue); }
      if (min === max) { min -= 1; max += 1; }
      var n = series.length;
      var stepX = n > 1 ? (w - padLeft - padRight) / (n - 1) : 0;
      function scaleY(v) { return h - padBottom - ((v - min) / (max - min)) * (h - padTop - padBottom); }
      // Skalenwert-Formatierung: 1 Nachkommastelle nur wenn nach Rundung auf .1 tatsaechlich ein
      // Dezimalanteil bleibt (z.B. Temp 36.5) -- ganzzahlige Werte (SpO2/HF) bleiben ohne Nachkommastelle.
      function fmtScale(v) {
        var r = Math.round(v * 10) / 10;
        return (Math.abs(r - Math.round(r)) < 0.05) ? String(Math.round(r)) : r.toFixed(1);
      }
      var color = opts.color || '#E8C39E';
      var coordPairs = vals.map(function (v, i) { return v === null ? null : [padLeft + i * stepX, scaleY(v)]; });
      var pointsStr = coordPairs.filter(Boolean).map(function (c) { return c[0].toFixed(1) + ',' + c[1].toFixed(1); }).join(' ');
      var dots = coordPairs.filter(Boolean).map(function (c) { return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="2.6" fill="' + color + '" />'; }).join('');
      // Raster: 3 gleichmaessig verteilte Gridlines (Max/Mitte/Min) inkl. Skalenwert-Beschriftung links.
      // Farbe deutlich blasser als refLine/Datenlinie, damit die Kurve dominant bleibt. Klassen erlauben
      // gezielte Druck-Kontrast-Korrektur (s. #ae-protokoll-print-Regeln), inline-Farbe ist der App-Default.
      var mid = (min + max) / 2;
      var gridSvg = [max, mid, min].map(function (gv) {
        var gy = scaleY(gv).toFixed(1);
        return '<line class="ae-chart-grid" x1="' + padLeft + '" y1="' + gy + '" x2="' + (w - padRight) + '" y2="' + gy + '" stroke="#7C93B84A" stroke-width="0.75" />' +
          '<text class="ae-chart-grid-label" x="' + (padLeft - 4) + '" y="' + gy + '" text-anchor="end" dominant-baseline="middle" font-size="7" fill="#7C93B8">' + fmtScale(gv) + '</text>';
      }).join('');
      var refLine = '';
      if (opts.refValue !== undefined) {
        var ry = scaleY(opts.refValue).toFixed(1);
        refLine = '<line x1="' + padLeft + '" y1="' + ry + '" x2="' + (w - padRight) + '" y2="' + ry + '" stroke="#7E3041" stroke-width="1" stroke-dasharray="3,3" />';
      }
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
        gridSvg + refLine + '<polyline points="' + pointsStr + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />' + dots + '</svg>';
    }
    function renderChartInto(containerId, label, series, opts) {
      var el = document.getElementById(containerId);
      if (!el) return;
      var svg = aeMiniChart(series, opts);
      if (!svg) { el.classList.add('ae-hidden'); el.innerHTML = ''; return; }
      el.classList.remove('ae-hidden');
      el.innerHTML = '<span class="ae-assess-chart-label">' + escapeHtml(label) + '</span>' + svg;
    }

    // ---------- Messzeitpunkte (Tag 08/12/16 Uhr, Nacht 20/00/04 Uhr) aus Dienstbeginn abgeleitet ----------
    var VITAL_METRICS = [
      { key: 'spo2', label: 'SpO2 %' }, { key: 'hf', label: 'HF (BPM)' }, { key: 'rr', label: 'RR (mmHg)' }, { key: 'temp', label: 'Temp (°C)' }
    ];
    function vitalZeitpunkte(tag) {
      var vMin = timeToMinutes(tag.von);
      var nacht = vMin === null ? false : !(vMin >= 300 && vMin < 1020); // 05:00-17:00 = Tagschicht, sonst Nacht
      return nacht ? ['20:00', '00:00', '04:00'] : ['08:00', '12:00', '16:00'];
    }
    // ---------- Vitalwerte-Kurve separat aktualisierbar: wird sowohl beim vollen Formular-Rebuild
    // (renderVitalTable) als auch bei JEDER Einzel-Eingabe (updateAssessComputed) aufgerufen, damit
    // die Kurve live mitzieht statt nur beim vollstaendigen Re-Render (Bugfix 2026-09-19). ----------
    function updateVitalChart(iso, scope) {
      var tag = getTag(iso); var a = tag.assessment;
      var chartHtml = '';
      VITAL_METRICS.forEach(function (m) {
        var series = ['t1', 't2', 't3'].map(function (tk) { var v = a.vitalwerte[tk][m.key]; return { v: v === '' || v === undefined || v === null ? null : parseFloat(v) }; });
        var svg = aeMiniChart(series, { color: '#7C93B8' });
        if (svg) chartHtml += '<div class="mb-2"><span class="ae-assess-chart-label">' + m.label + '</span>' + svg + '</div>';
      });
      var chartWrap = document.getElementById(scope + '-assess-chart-vital');
      if (chartWrap) { if (chartHtml) { chartWrap.classList.remove('ae-hidden'); chartWrap.innerHTML = chartHtml; } else { chartWrap.classList.add('ae-hidden'); chartWrap.innerHTML = ''; } }
    }
    // scope: 'verlauf' (Tagesdetail im Kalender) oder 'heute' (Schnellerfassung) -- dieselbe Funktion
    // rendert in zwei DOM-Ziele mit identischem Suffix-Schema scope + '-vital-tbody' usw.
    function renderVitalTable(iso, scope) {
      scope = scope || 'verlauf';
      var tag = getTag(iso); var a = tag.assessment;
      var zeiten = vitalZeitpunkte(tag);
      [scope + '-vital-t1-label', scope + '-vital-t2-label', scope + '-vital-t3-label'].forEach(function (id, i) {
        var el = document.getElementById(id); if (el) el.textContent = zeiten[i] + ' Uhr';
      });
      var tbody = document.getElementById(scope + '-vital-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      VITAL_METRICS.forEach(function (m) {
        var tr = document.createElement('tr');
        var tds = ['<th scope="row" class="text-white">' + m.label + '</th>'];
        ['t1', 't2', 't3'].forEach(function (tk) {
          var val = a.vitalwerte[tk][m.key];
          tds.push('<td><input type="number" step="any" class="ae-input" data-af="vitalwerte.' + tk + '.' + m.key + '" aria-label="' + m.label + ' ' + zeiten[tk === 't1' ? 0 : tk === 't2' ? 1 : 2] + ' Uhr" value="' + (val === undefined || val === null ? '' : val) + '"></td>');
        });
        tr.innerHTML = tds.join('');
        tbody.appendChild(tr);
      });
      updateVitalChart(iso, scope);
    }

    // ---------- Auto-Ableitungen aus dem Massnahmen-Log (ueberschreibbar, per *Touched-Flag gemerkt) ----------
    var AE_TOUCHED_MAP = {
      'sekret.absaugEndo': 'sekret.absaugEndoTouched',
      'haut.mikrolagerungAnzahl': 'haut.mikrolagerungTouched',
      'haut.kompresseGewechselt': 'haut.kompresseTouched',
      'haut.verbandwechsel': 'haut.verbandwechselTouched',
      'besonderes.hinweise': 'besonderes.hinweiseTouched'
    };
    function applyAutoAbleitungen(iso) {
      var tag = getTag(iso); var a = tag.assessment;
      var m = entriesFor(iso, 'massnahme');
      function countLabel(labels) { return m.filter(function (en) { return labels.indexOf(en.label) !== -1; }).length; }
      if (!a.sekret.absaugEndoTouched) a.sekret.absaugEndo = countLabel(['Absaugen (endotracheal/oral)']);
      if (!a.haut.mikrolagerungTouched) a.haut.mikrolagerungAnzahl = countLabel(['Lagerung/Mikrolagerung', 'Lifter-Transfer']);
      if (!a.haut.kompresseTouched) a.haut.kompresseGewechselt = countLabel(['Tracheostomapflege']) > 0;
      if (!a.haut.verbandwechselTouched) a.haut.verbandwechsel = countLabel(['Wund-/Stomaversorgung']) > 0;
      if (!a.besonderes.hinweiseTouched) {
        var texte = m.filter(function (en) { return en.besonderheiten; }).map(function (en) { return en.besonderheiten; });
        a.besonderes.hinweise = texte.join('; ');
      }
    }

    // ---------- Live berechnete Werte: Scores, CAM-ICU, Bilanz, bedingt eingeblendete Felder ----------
    // scope: 'verlauf' oder 'heute' -- s. renderVitalTable() fuer das Namensschema.
    function updateAssessComputed(iso, scope) {
      scope = scope || 'verlauf';
      var tag = getTag(iso); var a = tag.assessment;
      // Bugfix 2026-09-19: Vitalwerte-Kurve bei JEDER Eingabe live aktualisieren, nicht nur beim
      // vollstaendigen Formular-Rebuild (renderVitalTable) — updateAssessComputed wird bei jedem
      // Input-/Change-Event ueber den [data-af]-Handler aufgerufen (s. makeAssessInputHandler).
      updateVitalChart(iso, scope);
      // Schmerz-Instrument-Umschaltung
      var isCpot = a.schmerz.instrument !== 'bps';
      var cpotWrap = document.getElementById(scope + '-cpot-wrap'), bpsWrap = document.getElementById(scope + '-bps-wrap');
      if (cpotWrap) cpotWrap.classList.toggle('ae-hidden', !isCpot);
      if (bpsWrap) bpsWrap.classList.toggle('ae-hidden', isCpot);
      var cpotSum = (a.schmerz.cpot || []).reduce(function (s, v) { return s + (parseFloat(v) || 0); }, 0);
      var bpsSum = (a.schmerz.bps || []).reduce(function (s, v) { return s + (parseFloat(v) || 0); }, 0);
      var cpotEl = document.getElementById(scope + '-cpot-summe');
      if (cpotEl) { cpotEl.textContent = cpotSum + ' / 8'; cpotEl.className = 'ae-assess-score' + (cpotSum > 2 ? ' ae-assess-score--alert' : ''); }
      var bpsEl = document.getElementById(scope + '-bps-summe');
      if (bpsEl) { bpsEl.textContent = bpsSum + ' / 12'; bpsEl.className = 'ae-assess-score' + (bpsSum > 5 ? ' ae-assess-score--alert' : ''); }
      // Schmerz-Verlauf (falls mehrfach am Tag erfasst) — nur neuer Punkt bei tatsaechlicher Werteaenderung.
      var aktuellerScore = isCpot ? cpotSum : bpsSum;
      if (!a.schmerz.verlauf) a.schmerz.verlauf = [];
      var letzter = a.schmerz.verlauf.length ? a.schmerz.verlauf[a.schmerz.verlauf.length - 1] : null;
      if (!letzter || letzter.wert !== aktuellerScore || letzter.instrument !== a.schmerz.instrument) {
        a.schmerz.verlauf.push({ zeit: nowHm(), wert: aktuellerScore, instrument: a.schmerz.instrument });
        if (a.schmerz.verlauf.length > 12) a.schmerz.verlauf.shift();
      }
      var schmerzSeries = a.schmerz.verlauf.filter(function (p) { return p.instrument === a.schmerz.instrument; }).map(function (p) { return { v: p.wert }; });
      renderChartInto(scope + '-assess-chart-schmerz', (isCpot ? 'CPOT' : 'BPS') + '-Verlauf', schmerzSeries, { color: '#E8C39E', refValue: isCpot ? 2 : undefined });
      // RASS-Hinweistext an Extremwerten
      var rassHint = document.getElementById(scope + '-rass-hinweis');
      if (rassHint) {
        var rassVal = parseInt(a.schmerz.rass, 10);
        rassHint.textContent = rassVal === -5 ? 'Extremwert: nicht erweckbar auf Stimme oder körperlichen Reiz.'
          : rassVal === 4 ? 'Extremwert: offen aggressiv, unmittelbare Gefahr für Personal.' : '';
      }
      // CAM-ICU-Algorithmus: (1 UND 2) UND (3 ODER 4) — Screening, keine Diagnose.
      var c = a.schmerz.camicu || [false, false, false, false];
      var camicuPositiv = !!(c[0] && c[1] && (c[2] || c[3]));
      var camicuEl = document.getElementById(scope + '-camicu-ergebnis');
      if (camicuEl) { camicuEl.textContent = camicuPositiv ? 'Delir-Screening positiv (kein Diagnoseinstrument)' : 'negativ'; camicuEl.className = 'ae-assess-score' + (camicuPositiv ? ' ae-assess-score--alert' : ''); }
      // Bedingt eingeblendete Freitextfelder (Vier-Augen-Reveal-Muster)
      toggleWrap(scope + '-weaning-abbruch-wrap', a.beatmung.weaning.toleranz === 'abbruch');
      toggleWrap(scope + '-analgetika-wrap', !!a.schmerz.analgetikaGabe);
      toggleWrap(scope + '-sondenabweichung-wrap', a.medikation.sondenPlanGemaess === 'abweichung');
      toggleWrap(scope + '-krise-kanuele-wrap', !!a.besonderes.krisen.kanueleDislo);
      toggleWrap(scope + '-krise-sekretbolus-wrap', !!a.besonderes.krisen.sekretbolus);
      toggleWrap(scope + '-krise-notarzt-wrap', !!a.besonderes.krisen.notarzt);
      // Krisenbox: auffaellige Warnfarbe nur wenn mindestens ein Krisen-Feld angekreuzt ist.
      var hatKrise = !!(a.besonderes.krisen.kanueleDislo || a.besonderes.krisen.sekretbolus || a.besonderes.krisen.notarzt);
      var krisenBox = document.getElementById(scope + '-krisen-box');
      if (krisenBox) krisenBox.classList.toggle('ae-krisen-box--alert', hatKrise);
      var krisenBadge = document.getElementById(scope + '-krisen-badge');
      if (krisenBadge) krisenBadge.classList.toggle('ae-hidden', !hatKrise);
      // Flüssigkeitsbilanz: reine Zahl, kein Diagnose-Framing.
      var ef = (parseFloat(a.medikation.einfuhr.oral) || 0) + (parseFloat(a.medikation.einfuhr.sonde) || 0) + (parseFloat(a.medikation.einfuhr.infusion) || 0);
      var af = (parseFloat(a.medikation.ausfuhr.urin) || 0) + (parseFloat(a.medikation.ausfuhr.stuhl) || 0) + (parseFloat(a.medikation.ausfuhr.sekret) || 0);
      var bilanz = ef - af;
      setText(scope + '-einfuhr-summe', ef + ' ml'); setText(scope + '-ausfuhr-summe', af + ' ml'); setText(scope + '-bilanz-summe', bilanz + ' ml');
      renderChartInto(scope + '-assess-chart-bilanz', 'Einfuhr/Ausfuhr/Bilanz (ml)', [{ v: ef }, { v: af }, { v: bilanz }], { color: '#889DBE' });
      // Beatmung Soll/Ist je Parameter (zwei vergleichbare Punkte je Kurve)
      var beatmungHtml = '';
      [{ k: 'fio2', l: 'FiO2 %' }, { k: 'peep', l: 'PEEP mbar' }, { k: 'vt', l: 'Vt ml' }, { k: 'freq', l: 'Freq/min' }, { k: 'ppeak', l: 'Ppeak mbar' }].forEach(function (p) {
        var sollV = a.beatmung.soll[p.k], istV = a.beatmung.ist[p.k];
        var svg = aeMiniChart([{ v: sollV === '' || sollV === undefined ? null : parseFloat(sollV) }, { v: istV === '' || istV === undefined ? null : parseFloat(istV) }], { color: '#B87333' });
        if (svg) beatmungHtml += '<div class="mb-2"><span class="ae-assess-chart-label">' + p.l + ' — Soll → Ist</span>' + svg + '</div>';
      });
      var beatmungWrap = document.getElementById(scope + '-assess-chart-beatmung');
      if (beatmungWrap) { if (beatmungHtml) { beatmungWrap.classList.remove('ae-hidden'); beatmungWrap.innerHTML = beatmungHtml; } else { beatmungWrap.classList.add('ae-hidden'); beatmungWrap.innerHTML = ''; } }

      // ---------- Neue Assessment-Module (Auftrag René 2026-09-20, Abschnitte 8–15) ----------
      // Abschnitt 9 — Ernährungsscreening NRS-2002: Hauptscreening nur bei mind. 1x Ja im Vorscreening,
      // Summe = Beeinträchtigung + Schwere Erkrankung + Alterszuschlag, Cutoff >= 3.
      var nrsVor = !!(a.ernaehrung.bmiUnter205 || a.ernaehrung.gewichtsverlust3mte || a.ernaehrung.reduzierteZufuhr || a.ernaehrung.schwerErkrankt);
      toggleWrap(scope + '-nrs-haupt-wrap', nrsVor);
      var nrsSumme = nrsVor ? (parseInt(a.ernaehrung.beeintraechtigung, 10) || 0) + (parseInt(a.ernaehrung.schwereErkrankung, 10) || 0) + (a.ernaehrung.alterszuschlag ? 1 : 0) : 0;
      var nrsEl = document.getElementById(scope + '-nrs-summe');
      if (nrsEl) { nrsEl.textContent = nrsSumme + ' / 7'; nrsEl.className = 'ae-assess-score' + (nrsSumme >= 3 ? ' ae-assess-score--alert' : ''); }

      // Abschnitt 12 — Dekubitusrisiko Braden-Skala: Summe 6-23, Cutoff-Stufen gemäß DNQP.
      var bradenSumme = (parseInt(a.dekubitus.sensorik, 10) || 0) + (parseInt(a.dekubitus.feuchtigkeit, 10) || 0) + (parseInt(a.dekubitus.aktivitaet, 10) || 0) +
        (parseInt(a.dekubitus.mobilitaet, 10) || 0) + (parseInt(a.dekubitus.ernaehrungBraden, 10) || 0) + (parseInt(a.dekubitus.reibung, 10) || 0);
      var bradenEl = document.getElementById(scope + '-braden-summe');
      if (bradenEl) { bradenEl.textContent = bradenSumme + ' / 23'; bradenEl.className = 'ae-assess-score' + (bradenSumme <= 14 ? ' ae-assess-score--alert' : ''); }
      var bradenStufe = bradenSumme < 9 ? 'sehr hohes Risiko' : bradenSumme <= 12 ? 'hohes Risiko' : bradenSumme <= 14 ? 'mittleres Risiko' : bradenSumme <= 18 ? 'geringes Risiko' : 'kein Risiko';
      setText(scope + '-braden-hinweis', 'Risikostufe: ' + bradenStufe + '.');

      // Abschnitt 8 — Positionierungsprotokoll: Intervall-Empfehlung abgeleitet vom Braden-Wert (Abschnitt 12),
      // kein starres Zeitintervall (DNQP-Prinzip) -- reiner Hinweistext, das editierbare Feld bleibt maßgeblich.
      setText(scope + '-positionierung-intervall-hinweis', 'Orientierung anhand Braden-Score (Abschnitt 12): ' + bradenStufe + ' — individuelles Intervall im Feld oben festlegen, keine starre Vorgabe.');

      // Abschnitt 11 — Sturzrisiko: Freitext nur bei "Mangel" am Lifter einblenden.
      toggleWrap(scope + '-lifter-mangel-wrap', a.sturz.lifterWartung === 'mangel');

      // Abschnitt 15 — Agitationsprotokoll: RASS-Verlaufsdokumentation (eigene Kurve für den Score selbst,
      // gleiche Push-Logik wie beim Schmerz-Verlauf), Auslöser-Freitext nur bei RASS > 0, CAM-ICU-Verweis (Abschnitt 4).
      if (!a.schmerz.rassVerlauf) a.schmerz.rassVerlauf = [];
      var rassNow = parseInt(a.schmerz.rass, 10);
      var rassLetzter = a.schmerz.rassVerlauf.length ? a.schmerz.rassVerlauf[a.schmerz.rassVerlauf.length - 1] : null;
      if (!isNaN(rassNow) && (!rassLetzter || rassLetzter.wert !== rassNow)) {
        a.schmerz.rassVerlauf.push({ zeit: nowHm(), wert: rassNow });
        if (a.schmerz.rassVerlauf.length > 12) a.schmerz.rassVerlauf.shift();
      }
      setText(scope + '-agitation-rass-aktuell', isNaN(rassNow) ? '—' : String(rassNow));
      renderChartInto(scope + '-assess-chart-rass', 'RASS-Verlauf', a.schmerz.rassVerlauf.map(function (p) { return { v: p.wert }; }), { color: '#889DBE' });
      toggleWrap(scope + '-agitation-ausloeser-wrap', !isNaN(rassNow) && rassNow > 0);
      var camicuHinweisEl = document.getElementById(scope + '-agitation-camicu-hinweis');
      if (camicuHinweisEl) camicuHinweisEl.textContent = 'CAM-ICU-Delir-Screening (Abschnitt 4): ' + (camicuPositiv ? 'positiv (kein Diagnoseinstrument)' : 'negativ') + '.';
    }
    function toggleWrap(id, visible) { var el = document.getElementById(id); if (el) el.classList.toggle('ae-hidden', !visible); }
    function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
    // CPOT/BPS-Zahlenfelder haben kein <select> wie RASS und koennen per Zahleneingabe/Spinner
    // ausserhalb des gueltigen Bereichs landen -- Wert beim Verlassen des Feldes (change) hart clampen,
    // bevor updateAssessComputed() die Summe berechnet.
    function clampNumberInput(el, min, max) {
      if (el.value === '') return;
      var v = parseFloat(el.value);
      if (isNaN(v)) return;
      var clamped = Math.max(min, Math.min(max, v));
      if (clamped !== v) el.value = clamped;
    }
    // ---------- Fix 6 (testing-qa-Audit): Plausibilitaetspruefung kritischer Zahlenfelder ----------
    // Medikamentendosierungen, Insulin-Dosis/BZ-Werte, Cuffdruck: min="0" im HTML verhindert das
    // Speichern nicht wirklich (Browser-Validierung laesst sich umgehen/ist beim programmatischen
    // Setzen wirkungslos). Keine harte Blockade -- echte Extremwerte koennen in seltenen Faellen real
    // vorkommen -- aber eine bewusste Rueckfrage bei Ausreissern statt stillschweigender Uebernahme.
    var AE_PLAUSI_REGELN = [
      { re: /^beatmung\.trachea\.cuffdruck$/, label: 'Cuffdruck', unit: 'mmHg', max: 100 },
      { re: /^medikamentenplan\.med[12]\.dosis\./, label: 'Medikamentendosis', unit: '', max: null },
      { re: /^insulin\.(spritz1|spritz2|gabe)\.dosis$/, label: 'Insulin-Dosis', unit: 'E.', max: 200 },
      { re: /^insulin\.korrektur\.\d+\.einheiten$/, label: 'Insulin-Korrekturdosis', unit: 'E.', max: 200 },
      { re: /^insulin\.gabe\.bz(Vor|Nach)$/, label: 'Blutzuckerwert', unit: 'mg/dl', max: 600 },
      { re: /^insulin\.korrektur\.\d+\.(von|bis)$/, label: 'Blutzucker-Korrekturgrenze', unit: 'mg/dl', max: 600 }
    ];
    function pruefeZahlenPlausibilitaet(path, el) {
      if (el.value === '') return;
      var num = parseFloat(el.value);
      if (isNaN(num)) return;
      var regel = null;
      for (var i = 0; i < AE_PLAUSI_REGELN.length; i++) { if (AE_PLAUSI_REGELN[i].re.test(path)) { regel = AE_PLAUSI_REGELN[i]; break; } }
      if (!regel) return;
      var auffaellig = num < 0 || (regel.max != null && num > regel.max);
      if (!auffaellig) return;
      var hinweis = 'Ungewöhnlich ' + (num < 0 ? 'negativer' : 'hoher') + ' Wert (' + num + (regel.unit ? ' ' + regel.unit : '') + ') bei „' + regel.label + '“ — wirklich speichern?';
      // Bei "Abbrechen": Feld leeren statt einen unbestaetigten Ausreisser zu speichern (kein Hard-Block,
      // aber auch kein stillschweigendes Uebernehmen).
      if (!window.confirm(hinweis)) { el.value = ''; }
    }

    // ---------- Formular befuellen (beim Oeffnen eines Tages ODER beim Rendern von Heute) ----------
    // scope: 'verlauf' (Tagesdetail-Panel im Kalender, beliebiger Tag) oder 'heute' (Schnellerfassung,
    // fest an todayIso() gebunden) -- beide Aufrufe teilen sich dieselbe Datenquelle AE.tage[iso].assessment,
    // es entstehen keine zwei getrennten Datensaetze.
    function renderAssessmentForm(iso, scope) {
      scope = scope || 'verlauf';
      var tag = getTag(iso); var a = tag.assessment;
      applyAutoAbleitungen(iso);
      var panel = document.getElementById(scope + '-assessment');
      if (!panel) return;
      panel.querySelectorAll('[data-af]').forEach(function (el) {
        var path = el.dataset.af;
        var val = getDeep(a, path);
        if (el.type === 'checkbox') { el.checked = !!val; }
        else { el.value = val === undefined || val === null ? '' : val; }
        el.disabled = !!tag.versiegelt;
      });
      renderVitalTable(iso, scope);
      // Vitalwerte-Zellen entstehen erst nach renderVitalTable() im DOM — Disabled-Status hier nachziehen.
      panel.querySelectorAll('[data-af^="vitalwerte."]').forEach(function (el) { el.disabled = !!tag.versiegelt; });
      updateAssessComputed(iso, scope);
    }

    // ---------- Delegierter Change-/Input-Handler fuer alle [data-af]-Felder ----------
    // Faktory statt einer fest an vSelectedDate gebundenen Funktion, damit dieselbe Logik sowohl fuer
    // das Verlauf-Tagesdetail (beliebiger Tag) als auch fuer die Heute-Schnellerfassung (immer todayIso())
    // wiederverwendet werden kann -- isoGetter liefert je Aufrufkontext das passende Datum.
    function makeAssessInputHandler(scope, isoGetter) {
      return function (e) {
        var el = e.target.closest('[data-af]');
        var iso = isoGetter();
        if (!el || !iso) return;
        var tag = getTag(iso);
        if (tag.versiegelt) return;
        var path = el.dataset.af;
        if (e.type === 'change' && el.type === 'number') {
          if (el.classList.contains('verlauf-af-cpot')) clampNumberInput(el, 0, 2);
          else if (el.classList.contains('verlauf-af-bps')) clampNumberInput(el, 1, 4);
          else pruefeZahlenPlausibilitaet(path, el);
        }
        var value = el.type === 'checkbox' ? el.checked : el.value;
        setDeep(tag.assessment, path, value);
        var touchedPath = AE_TOUCHED_MAP[path];
        if (touchedPath) setDeep(tag.assessment, touchedPath, true);
        persist();
        updateAssessComputed(iso, scope);
      };
    }
    var handleAssessInput = makeAssessInputHandler('verlauf', function () { return vSelectedDate; });
    document.getElementById('verlauf-day-panel').addEventListener('input', handleAssessInput);
    document.getElementById('verlauf-day-panel').addEventListener('change', handleAssessInput);
    var handleHeuteAssessInput = makeAssessInputHandler('heute', todayIso);
    document.getElementById('heute-assessment').addEventListener('input', handleHeuteAssessInput);
    document.getElementById('heute-assessment').addEventListener('change', handleHeuteAssessInput);
    ['verlauf-day-von', 'verlauf-day-bis', 'verlauf-day-pfk'].forEach(function (id) {
      var el = document.getElementById(id);
      el.addEventListener('change', function () {
        if (!vSelectedDate) return;
        var tag = getTag(vSelectedDate);
        // Fix 2 (testing-qa): Verteidigung in der Tiefe — auch falls disabled umgangen wird,
        // duerfen versiegelte Tage nicht mehr ueberschrieben werden.
        if (tag.versiegelt) return;
        tag.von = document.getElementById('verlauf-day-von').value;
        tag.bis = document.getElementById('verlauf-day-bis').value;
        tag.pfk = document.getElementById('verlauf-day-pfk').value;
        persist();
        if (vSelectedDate === todayIso()) renderHeute();
        updateVerlaufDayStatus();
      });
    });

    // ---------- Verlauf: Schicht gegenzeichnen / Tag versiegeln / Monat freigeben ----------
    // ---------- Abschluss-Abschnitt: Kuerzel/Signatur-Vorschau je Tag rendern ----------
    function formatDateTimeIso(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('de-DE'); }
    function renderSigTriggerFilled(triggerId, dataUrl) {
      var btn = document.getElementById(triggerId);
      if (!btn) return;
      if (dataUrl && dataUrl.indexOf('TYPED:') === 0) {
        btn.innerHTML = '<span class="ae-sig-trigger-typed">Elektronisch unterschrieben: ' + escapeHtml(dataUrl.slice(6)) + '</span>';
        btn.classList.add('ae-sig-trigger--filled');
      } else if (dataUrl) {
        btn.innerHTML = '<img src="' + dataUrl + '" alt="Unterschrift" class="ae-sig-trigger-img">';
        btn.classList.add('ae-sig-trigger--filled');
      } else {
        btn.innerHTML = '<span class="ae-sig-trigger-placeholder">Zum Unterschreiben tippen</span>';
        btn.classList.remove('ae-sig-trigger--filled');
      }
    }
    function renderGegenzeichnenAbschnitt(iso) {
      var tag = getTag(iso);
      var pfkAb = document.getElementById('verlauf-gz-pfk-ab'), pfkUeb = document.getElementById('verlauf-gz-pfk2');
      pfkAb.value = tag.gzPfkAbgebend || tag.pfk || ''; pfkUeb.value = tag.gzPfk2 || '';
      pfkAb.disabled = tag.versiegelt; pfkUeb.disabled = tag.versiegelt;
      document.getElementById('verlauf-gz-ab-sig').value = tag.gzAbgebendeSig || '';
      document.getElementById('verlauf-gz-ab-zeit').value = tag.gzAbgebendeZeit || '';
      document.getElementById('verlauf-gz-uebernehmend-sig').value = tag.gzUebernehmendeSig || '';
      document.getElementById('verlauf-gz-uebernehmend-zeit').value = tag.gzUebernehmendeZeit || '';
      renderSigTriggerFilled('verlauf-sig-ab-trigger', tag.gzAbgebendeSig);
      renderSigTriggerFilled('verlauf-sig-uebernehmend-trigger', tag.gzUebernehmendeSig);
      document.getElementById('verlauf-gz-ab-zeit-anzeige').textContent = tag.gzAbgebendeZeit ? 'Unterschrieben: ' + formatDateTimeIso(tag.gzAbgebendeZeit) : '';
      document.getElementById('verlauf-gz-uebernehmend-zeit-anzeige').textContent = tag.gzUebernehmendeZeit ? 'Unterschrieben: ' + formatDateTimeIso(tag.gzUebernehmendeZeit) : '';
      document.getElementById('verlauf-sig-ab-trigger').disabled = tag.versiegelt;
      document.getElementById('verlauf-sig-uebernehmend-trigger').disabled = tag.versiegelt;
    }
    // Signatur sofort beim Zeichnen persistieren (nicht erst beim Klick auf "Schicht gegenzeichnen"),
    // damit ein Tagwechsel und Zurueckkehren die bereits geleistete Unterschrift nicht verwirft.
    document.getElementById('verlauf-day-panel').addEventListener('ae-signed', function (e) {
      if (!vSelectedDate) return;
      var tag = getTag(vSelectedDate);
      if (e.target.id === 'verlauf-sig-ab-trigger') {
        tag.gzAbgebendeSig = document.getElementById('verlauf-gz-ab-sig').value;
        tag.gzAbgebendeZeit = document.getElementById('verlauf-gz-ab-zeit').value;
      } else if (e.target.id === 'verlauf-sig-uebernehmend-trigger') {
        tag.gzUebernehmendeSig = document.getElementById('verlauf-gz-uebernehmend-sig').value;
        tag.gzUebernehmendeZeit = document.getElementById('verlauf-gz-uebernehmend-zeit').value;
      } else { return; }
      persist();
      renderGegenzeichnenAbschnitt(vSelectedDate);
    });
    ['verlauf-gz-pfk-ab', 'verlauf-gz-pfk2'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        if (!vSelectedDate) return;
        var tag = getTag(vSelectedDate);
        if (tag.versiegelt) return;
        if (id === 'verlauf-gz-pfk-ab') tag.gzPfkAbgebend = this.value.trim(); else tag.gzPfk2 = this.value.trim();
        persist();
      });
    });
    document.getElementById('verlauf-btn-gegenzeichnen').addEventListener('click', function () {
      if (!vSelectedDate) return;
      var tagCheck = getTag(vSelectedDate);
      var gzNote = document.getElementById('verlauf-gz-note');
      // Tiefenschutz (analog Fix 2 bei Von/Bis-Feldern): auch falls disabled umgangen wird,
      // darf ohne erfasste Schichtzeit bei vorhandenen Massnahmen/Fahrten nicht gegengezeichnet werden.
      var hatEintraege = entriesFor(vSelectedDate, 'massnahme').length > 0 || entriesFor(vSelectedDate, 'fahrt').length > 0;
      if (hatEintraege && (!tagCheck.von || !tagCheck.bis)) {
        gzNote.textContent = 'Bitte zuerst Dienstbeginn/-ende erfassen, bevor die Schicht gegengezeichnet werden kann.';
        document.getElementById('verlauf-day-von').focus();
        showInlineNote(gzNote);
        return;
      }
      var pfkAb = document.getElementById('verlauf-gz-pfk-ab').value.trim();
      var pfkUeb = document.getElementById('verlauf-gz-pfk2').value.trim();
      if (!pfkAb) { gzNote.textContent = 'Bitte Kürzel abgebende PFK eintragen.'; document.getElementById('verlauf-gz-pfk-ab').focus(); showInlineNote(gzNote); return; }
      if (!pfkUeb) { gzNote.textContent = 'Bitte Kürzel übernehmende PFK eintragen.'; document.getElementById('verlauf-gz-pfk2').focus(); showInlineNote(gzNote); return; }
      if (!tagCheck.gzAbgebendeSig) { gzNote.textContent = 'Bitte zuerst die abgebende PFK unterschreiben lassen.'; showInlineNote(gzNote); return; }
      if (!tagCheck.gzUebernehmendeSig) { gzNote.textContent = 'Bitte zuerst die übernehmende PFK unterschreiben lassen.'; showInlineNote(gzNote); return; }
      tagCheck.gzPfkAbgebend = pfkAb; tagCheck.gzPfk2 = pfkUeb;
      tagCheck.gzDone = true;
      persist();
      updateVerlaufDayStatus();
      renderGegenzeichnenAbschnitt(vSelectedDate);
      renderVerlaufCalendar();
    });
    document.getElementById('verlauf-btn-versiegeln').addEventListener('click', function () {
      if (!vSelectedDate) return;
      var tag = getTag(vSelectedDate);
      if (!tag.gzDone) return;
      tag.versiegelt = true; persist();
      updateVerlaufDayStatus(); renderVerlaufCalendar();
      renderMassnahmeList(document.getElementById('verlauf-day-list-massnahme'), vSelectedDate, true);
      renderFahrtList(document.getElementById('verlauf-day-list-fahrt'), vSelectedDate, true);
      renderPrivatList(document.getElementById('verlauf-day-list-privat'), vSelectedDate, true);
      renderAssessmentForm(vSelectedDate, 'verlauf');
    });
    // ---------- Drucken/Export: Standalone-PWA-Fallback (Bugfix 2026-09-19) ----------
    // Ursache "Drucken reagiert nicht" auf dem iPhone: die App laeuft als installierte Home-Bildschirm-PWA
    // (manifest.json display:"standalone"). iOS/WebKit unterdrueckt window.print() dort vollstaendig, weil
    // im Standalone-Kontext keine Browser-Chrome existiert, die das native Druck-/Teilen-Sheet anzeigen
    // koennte (bekannte WebKit-Einschraenkung, kein JS-Fehler/keine kaputte Selektor-Referenz im Code —
    // die Klick-Handler selbst waren unveraendert korrekt verdrahtet). Fallback: druckfertigen Inhalt als
    // eigenstaendiges HTML-Dokument per Blob-URL in einem neuen Tab oeffnen — dort besteht ein normaler
    // Safari-Kontext, in dem window.print() zuverlaessig funktioniert.
    function aeIsStandaloneApp() {
      return window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    }
    // Tailwind-Utility-Ersatz-CSS (#ae-tw-utils, s. Zeile 20) wird zur Laufzeit aus dem DOM gelesen statt
    // als zweite Kopie im JS-String gepflegt zu werden (Bugfix 2026-09-19: Fragment-Dokument enthielt bisher
    // keine .ae-card/.ae-badge-cat--*/Tailwind-Klassen wie text-white, py-2 etc. — Karten/Badges/Typografie
    // fielen im echten iPhone-Standalone-Druckpfad komplett weg). Kuenftige Utility-Aenderungen wirken damit
    // automatisch auch im Fragment-Pfad mit, ohne zweite Pflegestelle.
    function aeGetTwUtilsCss() {
      var el = document.getElementById('ae-tw-utils');
      if (el) return el.textContent;
      // Seit 2026-09-20 (CSS-Auslagerung nach app.css fuer HTTP-Caching) gibt es kein
      // #ae-tw-utils-DOM-Element mehr — CSS stattdessen synchron aus dem bereits
      // geladenen externen Stylesheet per CSSOM rekonstruieren (kein async/fetch noetig,
      // damit window.open() im selben Klick-Handler-Takt bleibt, s. iOS-Popup-Blocker).
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        try {
          if (sheet.href && sheet.href.indexOf('app.css') !== -1 && sheet.cssRules) {
            var css = '';
            for (var j = 0; j < sheet.cssRules.length; j++) css += sheet.cssRules[j].cssText;
            return css;
          }
        } catch (e) {}
      }
      return '';
    }
    var AE_PRINT_FRAGMENT_CSS = 'body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;background:#fff;color:#000;padding:1.5rem;max-width:900px;margin:0 auto;}' +
      'h1{font-size:1.4rem;font-weight:800;margin:0 0 1rem;}h2{font-size:1.05rem;font-weight:700;margin:1rem 0 .4rem;}h3{font-size:.95rem;font-weight:700;margin:.8rem 0 .3rem;}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:.6rem;font-size:.85rem;}th,td{border:1px solid #999;padding:.3rem .5rem;text-align:left;}' +
      '.ae-protokoll-meta{font-size:.8rem;color:#333;margin-bottom:1rem;}.ae-protokoll-krisenbox--alert{border:2px solid #E88C7D;background:rgba(232,140,125,0.10);border-radius:6px;padding:.5rem;}' +
      '.ae-protokoll-krisenbox-titel{margin:0 0 .35rem;font-weight:700;color:#B33A2A;font-size:.85rem;}' +
      '.ae-protokoll-auffaellig{background:rgba(232,140,125,.15);}.ae-protokoll-auffaellig th,.ae-protokoll-auffaellig td,td.ae-protokoll-auffaellig,th.ae-protokoll-auffaellig{color:#000;}' +
      '.ae-protokoll-chart{margin:0 0 .5rem;page-break-inside:avoid;}.ae-protokoll-chart-label{display:block;font-size:.78rem;font-weight:600;color:#333;margin-bottom:.15rem;}.ae-protokoll-chart svg{display:block;width:100%;max-width:320px;}' +
      '.ae-re-briefkopf{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding-bottom:.7rem;margin-bottom:.9rem;border-bottom:2px solid #B87333;}' +
      '.ae-re-briefkopf-logo{display:flex;align-items:center;gap:.5rem;}.ae-re-wortmarke{color:#6B4423;font-weight:800;font-size:1.05rem;}' +
      '.ae-re-absender{font-size:.72rem;line-height:1.45;text-align:right;color:#333;}.ae-re-absender-name{display:block;color:#000;font-size:.8rem;margin-bottom:.15rem;}' +
      '.ae-re-tabelle thead th{border-bottom:2px solid #17273F;}.ae-re-tabelle tfoot td{border-top:2px solid #B87333;font-weight:700;}' +
      '.ae-re-doc+.ae-re-doc{page-break-before:always;}' +
      // Im isolierten Blob-Dokument (aeOpenPrintFragment) gibt es kein Bildschirm/Druck-Gegensatz --
      // ALLES darin ist bereits "der Druck". Briefkopf hier daher immer sichtbar, unabhaengig vom
      // eingebetteten app.css-Basisrule (.ae-briefkopf-print-only{display:none}), s. aeGetTwUtilsCss().
      '.ae-briefkopf-print-only{display:flex !important;}';
    // Kurvenprotokoll-Zusatz-CSS (Auftrag René 2026-09-19): NUR als extraCss-Parameter an
    // aeOpenPrintFragment() uebergeben -- wirkt ausschliesslich im isolierten Blob-Dokument dieses
    // einen Drucks, niemals auf das Haupt-Uebergabeprotokoll (bleibt Hochformat) oder die Rechnung.
    // @page{size:landscape} waere als globale Regel im Hauptdokument riskant (wuerde ALLE Drucke aus
    // dieser App-Instanz betreffen) -- im eigenen Blob-Dokument ist es dagegen sicher scope-rein.
    var AE_KURVEN_PRINT_CSS = '@page{size:landscape;margin:12mm;}' +
      'body{max-width:1400px;}' +
      '.ae-protokoll-chart svg{max-width:' + 760 + 'px;}';
    function aeOpenPrintFragment(titel, fragmentHtml, extraCss) {
      var doc = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
        escapeHtml(titel) + '</title><style>' + aeGetTwUtilsCss() + AE_PRINT_FRAGMENT_CSS + (extraCss || '') + '</style></head><body>' + fragmentHtml + '</body></html>';
      var blob = new Blob([doc], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var win = window.open(url, '_blank');
      if (win) {
        var aeTriggerPrint = function () {
          // Doppeltes rAF + kurzer Timeout: iOS Safari feuert 'load' bei Blob-URL-Tabs
          // nicht zuverlässig NACH vollständigem Rendering — dieser Puffer verhindert
          // die native "Seite nicht vollständig geladen"-Warnung und das Ausbleiben
          // des AirPrint-Dialogs (Race Condition zwischen load-Event und Layout/Paint).
          win.requestAnimationFrame(function () {
            win.requestAnimationFrame(function () {
              window.setTimeout(function () {
                try { win.print(); } catch (err) {
                  console.error('aeOpenPrintFragment: win.print() fehlgeschlagen', err);
                  alert('Drucken konnte nicht automatisch gestartet werden. Bitte im geöffneten Tab manuell über das Teilen-Menü drucken.');
                }
              }, 350);
            });
          });
        };
        // Bugfix 2026-09-19 (iPad-Real-Device-Test): Bei Blob-URLs kann 'load' bereits VOR dem
        // Anhaengen dieses Listeners gefeuert haben (quasi-synchrones Laden) - dann feuert
        // aeTriggerPrint nie und der AirPrint-Dialog bleibt aus. readyState direkt pruefen statt
        // blind auf ein moeglicherweise bereits verpasstes load-Event zu warten. Kein Cross-Origin-
        // Problem, da Blob-URL desselben Dokument-Origins.
        try {
          if (win.document && win.document.readyState === 'complete') {
            aeTriggerPrint();
          } else {
            win.addEventListener('load', aeTriggerPrint);
          }
        } catch (err) {
          win.addEventListener('load', aeTriggerPrint);
        }
      } else {
        alert('Popup wurde blockiert. Bitte Popup-Blocker für diese Seite deaktivieren und erneut versuchen.');
      }
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    }
    // Im normalen Browser-Tab bleibt window.print() (mit @media print) unveraendert der Weg; nur im
    // Standalone-Fall wird getFragment() (liefert druckfertiges HTML) fuer den Blob-Tab-Fallback genutzt.
    function aePrintOrExport(titel, getFragment) {
      if (aeIsStandaloneApp()) { aeOpenPrintFragment(titel, getFragment()); return; }
      window.print();
    }
    // Klont ein Tab-Panel und entfernt darin alle .ae-no-print-Elemente (z.B. den Drucken-Button selbst) —
    // liefert dasselbe Ergebnis wie das @media print-Ausblenden im normalen Browser-Pfad.
    function aePrintableClone(panelId) {
      var panel = document.getElementById(panelId);
      if (!panel) return '';
      var clone = panel.cloneNode(true);
      clone.querySelectorAll('.ae-no-print').forEach(function (el) { el.remove(); });
      // Zugeklappte <details> (z.B. Pflegemaßnahmen-Listen) muessen im Druck/Export IMMER aufgeklappt
      // erscheinen, unabhaengig vom Bildschirm-Zustand — sonst fehlen Inhalte im gedruckten Dokument.
      clone.querySelectorAll('details').forEach(function (d) { d.open = true; });
      return clone.innerHTML;
    }

    // ---------- AERIS-Briefkopf (Auftrag René 2026-09-19): Logo/Wortmarke/Absender identisch zur
    // Rechnung (s. #aw-rechnung .ae-re-briefkopf), fuer jedes Druckdokument mit eigener Gradient-ID,
    // um SVG-ID-Kollisionen bei mehreren gleichzeitig offenen Dokumenten zu vermeiden. ----------
    function aeBriefkopfHtml(gradId) {
      return '<div class="ae-re-briefkopf">' +
        '<div class="ae-re-briefkopf-logo">' +
          '<svg width="40" height="40" viewBox="0 0 100 100" role="img" aria-label="AERIS-Logo" class="ae-logo" style="animation:none;">' +
            '<defs><linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
              '<stop offset="0%" stop-color="#6B4423"/><stop offset="16%" stop-color="#B87333"/>' +
              '<stop offset="34%" stop-color="#6B4423"/><stop offset="50%" stop-color="#E8C39E"/>' +
              '<stop offset="64%" stop-color="#B87333"/><stop offset="82%" stop-color="#6B4423"/>' +
              '<stop offset="100%" stop-color="#E8C39E"/></linearGradient></defs>' +
            '<circle cx="51.8" cy="51.8" r="40" fill="none" stroke="#D9D9D9" stroke-opacity="0.45" stroke-width="12"/>' +
            '<circle cx="50" cy="50" r="40" fill="none" stroke="url(#' + gradId + ')" stroke-width="12"/>' +
            '<circle cx="50" cy="50" r="45" fill="none" stroke="#FFFFFF" stroke-width="2.2"/>' +
            '<circle cx="50" cy="50" r="35" fill="none" stroke="#FFFFFF" stroke-width="2.2"/>' +
            '<path d="M 10 50 A 40 40 0 0 1 50 10" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="6.6" stroke-linecap="round"/>' +
            '<path d="M 90 50 A 40 40 0 0 1 50 90" fill="none" stroke="#D9D9D9" stroke-opacity="0.5" stroke-width="6.6" stroke-linecap="round"/>' +
            '<path d="M 20 63 C 26 63, 28 37, 35 37 C 40 37, 42 63, 48 63 C 54 63, 56 37, 63 37 C 68 37, 70 63, 80 63" fill="none" stroke="url(#' + gradId + ')" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '<span class="ae-michroma ae-metallic ae-re-wortmarke text-lg md:text-xl" style="font-weight:800;">AERIS</span>' +
        '</div>' +
        '<div class="ae-re-absender">' +
          '<strong class="ae-re-absender-name">Einzelunternehmen AERIS</strong>' +
          'Inhaber René Krieg<br>Hohenfelsstraße 34<br>35232 Dautphetal' +
        '</div>' +
      '</div>';
    }
    // ---------- Beatmungs-/Cuffdruck-Kurven: fortlaufende Kurve je Parameter aus a.beatmung.verlauf
    // (Auftrag René 2026-09-19), fuer das separate Kurvenprotokoll. Soll-Wert (aktueller Stand) als
    // horizontale Referenzlinie -- analog zur CPOT-Referenzlinie. Defensiv gegen alte Tage ohne Array. ----------
    function buildBeatmungParamChartsHtml(a, width) {
      var params = [
        { k: 'fio2', l: 'FiO2 %' }, { k: 'peep', l: 'PEEP mbar' }, { k: 'vt', l: 'Vt ml' },
        { k: 'freq', l: 'Freq/min' }, { k: 'ppeak', l: 'Ppeak mbar' }
      ];
      var verlauf = a.beatmung.verlauf || [];
      var html = '';
      params.forEach(function (p) {
        var series = verlauf.map(function (pt) { var v = pt[p.k]; return { v: (v === '' || v === undefined || v === null) ? null : parseFloat(v) }; });
        var sollV = a.beatmung.soll[p.k];
        var sollN = parseFloat(sollV);
        var opts = { color: '#B87333', width: width || 720, height: 120 };
        if (sollV !== '' && sollV !== undefined && sollV !== null && !isNaN(sollN)) opts.refValue = sollN;
        var svg = aeMiniChart(series, opts);
        if (svg) html += '<div class="ae-protokoll-chart"><span class="ae-protokoll-chart-label">' + p.l + ' — Verlauf (Ist je Erfassung), gestrichelt: aktueller Soll-Wert</span>' + svg + '</div>';
      });
      return html;
    }

    // ---------- Übergabeprotokoll: druckbare Zusammenfassung aus Kopfdaten + Abschnitten 1-8 ----------
    function schichtartLabel(tag) {
      var vMin = timeToMinutes(tag.von);
      if (vMin === null) return '—';
      return (vMin >= 300 && vMin < 1020) ? 'Tagschicht' : 'Nachtschicht';
    }
    function jaNein(v) { return v ? 'Ja' : 'Nein'; }
    // warn (optional, 3. Parameter): markiert die Zeile als fachliche Auffaelligkeit (Auftrag René,
    // pflege-assessment-Agent freigegeben) -- setzt CSS-Klasse .ae-protokoll-auffaellig auf <tr> UND
    // stellt der Wertdarstellung "⚠ " voran (WCAG: Farbe allein darf keine Information tragen).
    function protokollRow(label, value, warn) {
      var disp = (value === '' || value === undefined || value === null) ? '—' : escapeHtml(String(value));
      if (warn) disp = '⚠ ' + disp;
      return '<tr' + (warn ? ' class="ae-protokoll-auffaellig"' : '') + '><th scope="row">' + escapeHtml(label) + '</th><td>' + disp + '</td></tr>';
    }
    function buildUebergabeprotokoll(iso) {
      var tag = getTag(iso); var a = tag.assessment;
      var monat = getMonat(iso.slice(0, 7));
      var html = aeBriefkopfHtml('aeRingProtokoll') + '<h1 class="ae-michroma" style="font-size:1.5rem; font-weight:800;">AERIS — Schicht-Übergabeprotokoll</h1>';
      var kurvenHinweis = '<p style="font-size:.8rem;color:#555555;">Kurvenverläufe: siehe separates Kurvenprotokoll (Querformat).</p>';
      html += '<div class="ae-protokoll-meta"><table><tbody>' +
        protokollRow('Klient', monat.name) +
        protokollRow('Datum', new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })) +
        protokollRow('Schichtart', schichtartLabel(tag)) +
        protokollRow('Dienstzeit', (tag.von || '—') + ' – ' + (tag.bis || '—')) +
        protokollRow('PFK (Schicht)', tag.pfk) +
        protokollRow('Status', statusPillLabel(tag)) +
      '</tbody></table></div>';

      var cuffN = parseFloat(a.beatmung.trachea.cuffdruck);
      var cuffWarn = a.beatmung.trachea.cuffdruck !== '' && a.beatmung.trachea.cuffdruck !== undefined && a.beatmung.trachea.cuffdruck !== null && !isNaN(cuffN) && (cuffN < 20 || cuffN > 25);
      html += '<h2>1 · Beatmungs- &amp; Respiratormanagement</h2><table><tbody>' +
        protokollRow('Beatmungsmodus', a.beatmung.modus) +
        protokollRow('Soll (FiO2 % / PEEP mbar / Vt ml / Freq/min / Ppeak mbar)', [a.beatmung.soll.fio2, a.beatmung.soll.peep, a.beatmung.soll.vt, a.beatmung.soll.freq, a.beatmung.soll.ppeak].map(function (v) { return v || '—'; }).join(' / ')) +
        protokollRow('Ist (FiO2 % / PEEP mbar / Vt ml / Freq/min / Ppeak mbar)', [a.beatmung.ist.fio2, a.beatmung.ist.peep, a.beatmung.ist.vt, a.beatmung.ist.freq, a.beatmung.ist.ppeak].map(function (v) { return v || '—'; }).join(' / ')) +
        protokollRow('Weaning-Intervall (min)', a.beatmung.weaning.intervall) +
        protokollRow('Spontantoleranz', a.beatmung.weaning.toleranz === 'abbruch' ? 'Abbruch — ' + (a.beatmung.weaning.abbruchGrund || '') : a.beatmung.weaning.toleranz) +
        protokollRow('Tracheostoma Größe/Typ', a.beatmung.trachea.groesse) +
        protokollRow('Cuffdruck mmHg (Soll 20–25)', a.beatmung.trachea.cuffdruck, cuffWarn) +
        protokollRow('Feuchte Nase / Sprechventil', jaNein(a.beatmung.trachea.feuchteNase) + ' / ' + jaNein(a.beatmung.trachea.sprechventil)) +
        protokollRow('Geräte-Check (Akku/Backup/Beutel)', jaNein(a.beatmung.geraete.akku) + ' / ' + jaNein(a.beatmung.geraete.backup) + ' / ' + jaNein(a.beatmung.geraete.beutel)) +
      '</tbody></table>';

      // Kurve: ausgelagert ins separate Kurvenprotokoll (Querformat, Auftrag René 2026-09-19) — hier nur
      // noch Hinweistext, reine Tabellenwerte (Soll/Ist als Text) bleiben oben im Hauptprotokoll erhalten.
      html += kurvenHinweis;

      html += '<h2>2 · Vitalwerte-Verlauf</h2>';
      var zeiten = vitalZeitpunkte(tag);
      html += '<table><thead><tr><th>Parameter</th><th>' + zeiten[0] + ' Uhr</th><th>' + zeiten[1] + ' Uhr</th><th>' + zeiten[2] + ' Uhr</th></tr></thead><tbody>';
      // SpO2 < 90 pro Messzeitpunkt einzeln markieren (Auftrag René, pflege-assessment freigegeben) --
      // HF/RR/Temp bleiben laut Fachpruefung ohne Schwellenwert unveraendert.
      VITAL_METRICS.forEach(function (m) {
        html += '<tr><th scope="row">' + m.label + '</th>';
        ['t1', 't2', 't3'].forEach(function (tk) {
          var v = a.vitalwerte[tk][m.key];
          var vN = parseFloat(v);
          var vWarn = m.key === 'spo2' && v !== '' && v !== undefined && v !== null && !isNaN(vN) && vN < 90;
          html += '<td' + (vWarn ? ' class="ae-protokoll-auffaellig"' : '') + '>' + (vWarn ? '⚠ ' : '') + (v || '—') + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';

      // Kurve: ausgelagert ins separate Kurvenprotokoll (Querformat, Auftrag René 2026-09-19).
      html += kurvenHinweis;

      html += '<h2>3 · Sekret-/Absaugmanagement</h2><table><tbody>' +
        protokollRow('Absaughäufigkeit endotracheal', a.sekret.absaugEndo) +
        protokollRow('Absaughäufigkeit oral/nasal', a.sekret.absaugOral) +
        protokollRow('Menge/Farbe/Konsistenz', [a.sekret.menge, a.sekret.farbe, a.sekret.konsistenz].filter(Boolean).join(' / ')) +
        protokollRow('CoughAssist (Anzahl/Einstellung)', (a.sekret.coughAssistAnzahl || '—') + ' / ' + (a.sekret.coughAssistEinstellung || '—')) +
        protokollRow('Inhalation', [a.sekret.inhalation.nacl ? 'NaCl 0,9 %' : null, a.sekret.inhalation.sekretolytikum ? 'Sekretolytikum' : null, a.sekret.inhalation.bronchodilatator ? 'Bronchodilatator' : null].filter(Boolean).join(', ')) +
      '</tbody></table>';

      html += '<h2>Pflegemaßnahmen des Tages</h2>';
      var massnahmenListe = entriesFor(iso, 'massnahme');
      if (massnahmenListe.length) {
        html += '<table><thead><tr><th>Uhrzeit</th><th>Maßnahme</th><th>SGB-Kategorie</th><th>PFK</th><th>Besonderheiten</th></tr></thead><tbody>';
        massnahmenListe.forEach(function (en) {
          // en.kritisch ist reine Vier-Augen-Verfahrenskategorie, KEINE Auffaelligkeit -- bewusst nicht
          // in Warnfarbe markiert (Auftrag René 2026-09-19).
          var enWarn = !!(en.besonderheiten && String(en.besonderheiten).trim().length > 0);
          html += '<tr' + (enWarn ? ' class="ae-protokoll-auffaellig"' : '') + '><td>' + escapeHtml(en.uhrzeit) + ' Uhr</td><td>' + escapeHtml(en.label) + '</td><td>' + catLabel(en.cat) + '</td><td>' +
            escapeHtml(en.pfk || '—') + (en.pfk2 ? ' / ' + escapeHtml(en.pfk2) : '') + '</td><td>' + (enWarn ? '⚠ ' + escapeHtml(en.besonderheiten) : '—') + '</td></tr>';
        });
        html += '</tbody></table>';
      } else {
        html += '<p style="font-size:.85rem;color:#333333;">Keine Pflegemaßnahmen erfasst.</p>';
      }

      var cpotSumme = (a.schmerz.cpot || []).reduce(function (s, v) { return s + (parseFloat(v) || 0); }, 0);
      var bpsSumme = (a.schmerz.bps || []).reduce(function (s, v) { return s + (parseFloat(v) || 0); }, 0);
      var camc = a.schmerz.camicu || [];
      var camPositiv = !!(camc[0] && camc[1] && (camc[2] || camc[3]));
      var schmerzSummeWarn = a.schmerz.instrument === 'bps' ? bpsSumme >= 6 : cpotSumme > 2;
      var rassN = parseFloat(a.schmerz.rass);
      var rassWarn = a.schmerz.rass !== '' && a.schmerz.rass !== undefined && a.schmerz.rass !== null && !isNaN(rassN) && (rassN <= -3 || rassN >= 2);
      html += '<h2>4 · Schmerztherapie &amp; Neurologie/Vigilanz</h2><table><tbody>' +
        protokollRow('Instrument', a.schmerz.instrument === 'bps' ? 'BPS' : 'CPOT') +
        protokollRow(a.schmerz.instrument === 'bps' ? 'BPS-Summe (3–12)' : 'CPOT-Summe (0–8, Cut-off >2)', a.schmerz.instrument === 'bps' ? bpsSumme + ' / 12' : cpotSumme + ' / 8', schmerzSummeWarn) +
        protokollRow('Schmerzfreiheit', a.schmerz.schmerzfrei, a.schmerz.schmerzfrei === 'nein') +
        protokollRow('Lokalisierung', a.schmerz.lokalisierung) +
        protokollRow('Auslöser', a.schmerz.ausloeser) +
        protokollRow('Analgetika-Gabe', jaNein(a.schmerz.analgetikaGabe) + (a.schmerz.analgetikaGabe && a.schmerz.analgetikaText ? ' — ' + a.schmerz.analgetikaText : '')) +
        protokollRow('Bewusstsein', a.schmerz.bewusstsein) +
        protokollRow('RASS-Score', a.schmerz.rass, rassWarn) +
        protokollRow('Pupillen', a.schmerz.pupillen) +
        protokollRow('CAM-ICU-Screening (kein Diagnoseinstrument)', camPositiv ? 'positiv' : 'negativ', camPositiv) +
      '</tbody></table>';

      // Kurve: ausgelagert ins separate Kurvenprotokoll (Querformat, Auftrag René 2026-09-19).
      html += kurvenHinweis;

      var stomaWarn = ['geroetet', 'sezernierend', 'granulation'].indexOf(a.haut.stoma) !== -1;
      var pegWarn = ['geroetet', 'leckage', 'granulation'].indexOf(a.haut.pegZustand) !== -1;
      html += '<h2>5 · Haut-/Wundstatus</h2><table><tbody>' +
        protokollRow('135°-Wechsellagerung', a.haut.wechsellagerung, a.haut.wechsellagerung === 'nein') +
        protokollRow('Mikrolagerung/Lifter-Anzahl', a.haut.mikrolagerungAnzahl) +
        protokollRow('Tracheostoma-Zustand', a.haut.stoma, stomaWarn) +
        protokollRow('Kompresse gewechselt', jaNein(a.haut.kompresseGewechselt)) +
        protokollRow('PEG/PEJ-Zustand', a.haut.pegZustand, pegWarn) +
        protokollRow('PEG mobilisiert/gespült', a.haut.pegMobilisiert) +
        protokollRow('Verbandwechsel durchgeführt', jaNein(a.haut.verbandwechsel)) +
        protokollRow('Wundheilungsverlauf', a.haut.wundheilung, a.haut.wundheilung === 'verschlechtert') +
      '</tbody></table>';

      var ef = (parseFloat(a.medikation.einfuhr.oral) || 0) + (parseFloat(a.medikation.einfuhr.sonde) || 0) + (parseFloat(a.medikation.einfuhr.infusion) || 0);
      var af = (parseFloat(a.medikation.ausfuhr.urin) || 0) + (parseFloat(a.medikation.ausfuhr.stuhl) || 0) + (parseFloat(a.medikation.ausfuhr.sekret) || 0);
      var sondenAbweichungWarn = a.medikation.sondenPlanGemaess === 'abweichung';
      var urinWarn = ['truebe', 'blutig'].indexOf(a.medikation.urinCharakter) !== -1;
      var stuhlWarn = a.medikation.stuhlCharakter === 'waessrig';
      html += '<h2>6 · Medikation/Sondenpflege/Flüssigkeitsbilanz</h2><table><tbody>' +
        protokollRow('Sondenmedikation gemäß Plan', sondenAbweichungWarn ? 'Abweichung — ' + (a.medikation.sondenAbweichung || '') : a.medikation.sondenPlanGemaess, sondenAbweichungWarn) +
        protokollRow('Sondennahrung', (a.medikation.sondennahrungBezeichnung || '—') + ' · ' + (a.medikation.sondennahrungMenge || '—') + ' ml') +
        protokollRow('Einfuhr gesamt', ef + ' ml') +
        protokollRow('Ausfuhr gesamt', af + ' ml') +
        protokollRow('Bilanz', (ef - af) + ' ml') +
        protokollRow('Urin-/Stuhl-Charakter', (a.medikation.urinCharakter || '—') + ' / ' + (a.medikation.stuhlCharakter || '—'), urinWarn || stuhlWarn) +
      '</tbody></table>';

      // Kurve: ausgelagert ins separate Kurvenprotokoll (Querformat, Auftrag René 2026-09-19).
      html += kurvenHinweis;

      html += '<h2>7 · Besondere Vorkommnisse/Ärztliche Anordnungen/Notfälle</h2><table><tbody>' +
        protokollRow('Arztkontakt', a.besonderes.arztkontakt) +
        protokollRow('Ärztliche Anordnung', a.besonderes.anordnung) +
      '</tbody></table>';

      var hatKriseProtokoll = !!(a.besonderes.krisen.kanueleDislo || a.besonderes.krisen.sekretbolus || a.besonderes.krisen.notarzt);
      html += '<div class="ae-protokoll-krisenbox' + (hatKriseProtokoll ? ' ae-protokoll-krisenbox--alert' : '') + '">';
      if (hatKriseProtokoll) html += '<p class="ae-protokoll-krisenbox-titel">⚠ Kritisches Ereignis — Krisen/Notfälle</p>';
      html += '<table><tbody>' +
        protokollRow('Kanülen-Dislokation', a.besonderes.krisen.kanueleDislo ? 'Ja — ' + (a.besonderes.krisen.kanueleGrund || '') : 'Nein') +
        protokollRow('Sekretbolus/Notfall-Absaugung', a.besonderes.krisen.sekretbolus ? 'Ja — ' + (a.besonderes.krisen.sekretbolusGrund || '') : 'Nein') +
        protokollRow('Notarzt/Hospitalisierung', a.besonderes.krisen.notarzt ? 'Ja — ' + (a.besonderes.krisen.notarztGrund || '') : 'Nein') +
      '</tbody></table></div>';

      html += '<table><tbody>' +
        protokollRow('Besondere Hinweise', a.besonderes.hinweise) +
      '</tbody></table>';

      html += '<h2>8 · Übergabebestätigung</h2><table><tbody>' +
        protokollRow('Abgebende PFK (Kürzel)', tag.gzPfkAbgebend) +
        protokollRow('Abgebende PFK — unterschrieben am', tag.gzAbgebendeZeit ? formatDateTimeIso(tag.gzAbgebendeZeit) : '') +
        protokollRow('Übernehmende PFK (Kürzel)', tag.gzPfk2) +
        protokollRow('Übernehmende PFK — unterschrieben am', tag.gzUebernehmendeZeit ? formatDateTimeIso(tag.gzUebernehmendeZeit) : '') +
        protokollRow('Status', statusPillLabel(tag)) +
      '</tbody></table>';

      html += '<p style="margin-top:1.5rem;font-size:.75rem;color:#555555;">Automatisch erzeugt aus AERIS Dokumentation am ' + new Date().toLocaleString('de-DE') + '. Rechtsgrundlage lückenloser Dokumentation: § 630f BGB.</p>';
      return html;
    }

    // ---------- Kurvenprotokoll: eigenes Querformat-Dokument, fasst NUR die fortlaufenden Kurven
    // zusammen (Auftrag René 2026-09-19) -- Beatmung/Cuffdruck (fortlaufend), Vitalwerte (t1/t2/t3),
    // Schmerz-Verlauf, Bilanz. Reine Zahlen-/Tabellenwerte bleiben im Haupt-Übergabeprotokoll. ----------
    function buildKurvenprotokoll(iso) {
      var tag = getTag(iso); var a = tag.assessment;
      var monat = getMonat(iso.slice(0, 7));
      var CHART_W = 720, CHART_H = 120;
      var html = aeBriefkopfHtml('aeRingKurven') + '<h1 class="ae-michroma" style="font-size:1.5rem; font-weight:800;">AERIS — Kurvenprotokoll</h1>';
      html += '<div class="ae-protokoll-meta"><table><tbody>' +
        protokollRow('Klient', monat.name) +
        protokollRow('Datum', new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })) +
        protokollRow('Schichtart', schichtartLabel(tag)) +
        protokollRow('Dienstzeit', (tag.von || '—') + ' – ' + (tag.bis || '—')) +
        protokollRow('PFK (Schicht)', tag.pfk) +
      '</tbody></table></div>';

      html += '<h2>Beatmung — fortlaufende Kurve je Erfassung von „Beatmung/Respiratormanagement"</h2>';
      var beatmungCharts = buildBeatmungParamChartsHtml(a, CHART_W);
      html += beatmungCharts || '<p style="font-size:.85rem;color:#333333;">Noch keine 2 Erfassungen — Verlaufskurve benötigt mindestens 2 Messzeitpunkte.</p>';

      html += '<h2>Cuffdruck — fortlaufende Kurve (Referenzlinie 22,5 mmHg, Sollbereich 20–25)</h2>';
      var cuffVerlauf = a.beatmung.trachea.cuffdruckVerlauf || [];
      var cuffSeries = cuffVerlauf.map(function (pt) { var v = pt.wert; return { v: (v === '' || v === undefined || v === null) ? null : parseFloat(v) }; });
      var cuffSvg = aeMiniChart(cuffSeries, { color: '#B87333', width: CHART_W, height: CHART_H, refValue: 22.5 });
      html += cuffSvg ? '<div class="ae-protokoll-chart">' + cuffSvg + '</div>' : '<p style="font-size:.85rem;color:#333333;">Noch keine 2 Erfassungen — Verlaufskurve benötigt mindestens 2 Messzeitpunkte.</p>';

      html += '<h2>Vitalwerte-Verlauf</h2>';
      var vitalChartHtml = '';
      VITAL_METRICS.forEach(function (m) {
        var series = ['t1', 't2', 't3'].map(function (tk) { var v = a.vitalwerte[tk][m.key]; return { v: (v === '' || v === undefined || v === null) ? null : parseFloat(v) }; });
        var svg = aeMiniChart(series, { color: '#7C93B8', width: CHART_W, height: CHART_H });
        if (svg) vitalChartHtml += '<div class="ae-protokoll-chart"><span class="ae-protokoll-chart-label">' + m.label + '</span>' + svg + '</div>';
      });
      html += vitalChartHtml || '<p style="font-size:.85rem;color:#333333;">Keine Vitalwerte erfasst.</p>';

      var isCpotK = a.schmerz.instrument !== 'bps';
      html += '<h2>' + (isCpotK ? 'CPOT' : 'BPS') + '-Verlauf (Schmerz/Vigilanz)</h2>';
      var schmerzSeriesK = (a.schmerz.verlauf || []).filter(function (p) { return p.instrument === a.schmerz.instrument; }).map(function (p) { return { v: p.wert }; });
      var schmerzSvgK = aeMiniChart(schmerzSeriesK, { color: '#E8C39E', width: CHART_W, height: CHART_H, refValue: isCpotK ? 2 : undefined });
      html += schmerzSvgK ? '<div class="ae-protokoll-chart">' + schmerzSvgK + '</div>' : '<p style="font-size:.85rem;color:#333333;">Noch keine 2 Erfassungen — Verlaufskurve benötigt mindestens 2 Messzeitpunkte.</p>';

      var efK = (parseFloat(a.medikation.einfuhr.oral) || 0) + (parseFloat(a.medikation.einfuhr.sonde) || 0) + (parseFloat(a.medikation.einfuhr.infusion) || 0);
      var afK = (parseFloat(a.medikation.ausfuhr.urin) || 0) + (parseFloat(a.medikation.ausfuhr.stuhl) || 0) + (parseFloat(a.medikation.ausfuhr.sekret) || 0);
      html += '<h2>Flüssigkeitsbilanz — Einfuhr/Ausfuhr/Bilanz (ml, Tagessumme)</h2>';
      var bilanzSvgK = aeMiniChart([{ v: efK }, { v: afK }, { v: efK - afK }], { color: '#889DBE', width: CHART_W, height: CHART_H });
      html += bilanzSvgK ? '<div class="ae-protokoll-chart">' + bilanzSvgK + '</div>' : '<p style="font-size:.85rem;color:#333333;">Keine Einfuhr-/Ausfuhrwerte erfasst.</p>';

      html += '<p style="margin-top:1.5rem;font-size:.75rem;color:#555555;">Automatisch erzeugt aus AERIS Dokumentation am ' + new Date().toLocaleString('de-DE') + '. Ergänzt das Schicht-Übergabeprotokoll (§ 630f BGB).</p>';
      return html;
    }

    var verlaufBtnProtokoll = document.getElementById('verlauf-btn-protokoll');
    if (verlaufBtnProtokoll) verlaufBtnProtokoll.addEventListener('click', function () {
      if (!vSelectedDate) return;
      var protokollHtml = buildUebergabeprotokoll(vSelectedDate);
      // Standalone-PWA-Fallback (Bugfix 2026-09-19, s. aeIsStandaloneApp()-Kommentar): dort bringt der
      // bisherige Weg (Off-Screen-Panel + window.print()) keinen Effekt, da iOS window.print() im
      // Home-Bildschirm-Kontext unterdrueckt. Im normalen Browser-Tab bleibt der bewaehrte Weg unveraendert.
      if (aeIsStandaloneApp()) { aeOpenPrintFragment('AERIS — Übergabeprotokoll', protokollHtml); return; }
      var target = document.getElementById('ae-protokoll-print');
      target.innerHTML = protokollHtml;
      target.removeAttribute('aria-hidden');
      document.body.classList.add('ae-print-protokoll');
      window.print();
    });
    window.addEventListener('afterprint', function () {
      document.body.classList.remove('ae-print-protokoll');
      var target = document.getElementById('ae-protokoll-print');
      target.setAttribute('aria-hidden', 'true'); target.innerHTML = '';
    });

    var verlaufBtnKurven = document.getElementById('verlauf-btn-kurven');
    if (verlaufBtnKurven) verlaufBtnKurven.addEventListener('click', function () {
      if (!vSelectedDate) return;
      var kurvenHtml = buildKurvenprotokoll(vSelectedDate);
      // Bugfix 2026-09-19 (Real-Device-Test iPad/Safari): die anfaengliche Named-Page-CSS-Loesung
      // (@page ae-kurven-seite + page:-Property auf body.ae-print-kurven, s. Git-Historie) wird von
      // iOS Safari NICHT respektiert -- Druckvorschau blieb Hochformat trotz gesetzter Regel (schwache
      // WebKit-Unterstuetzung fuer CSS Paged Media "page"-Property). Einzige zuverlaessige Loesung:
      // IMMER den isolierten Blob-Tab-Pfad nutzen (wie im Standalone-Fall) -- dort gilt ein simples,
      // unscoped "@page{size:landscape}" NUR fuer dieses eine Dokument und wird von Safari beachtet,
      // ohne das Haupt-Uebergabeprotokoll/die Rechnung zu beeinflussen (separates Blob-Dokument).
      aeOpenPrintFragment('AERIS — Kurvenprotokoll', kurvenHtml, AE_KURVEN_PRINT_CSS);
    });

    function datesInMonthWithEntries() {
      var ym = monthKey(); var set = {};
      AE.entries.forEach(function (en) { if (en.datum.indexOf(ym) === 0) set[en.datum] = true; });
      return Object.keys(set);
    }
    function updateMonatFreigabeStatus() {
      var dates = datesInMonthWithEntries();
      var allSealed = dates.length > 0 && dates.every(function (iso) { return AE.tage[iso] && AE.tage[iso].versiegelt; });
      var monat = getMonat(monthKey());
      var btn = document.getElementById('verlauf-btn-monat-freigeben');
      btn.disabled = monat.freigegeben || !allSealed;
      var statusEl = document.getElementById('verlauf-monat-status');
      statusEl.textContent = monat.freigegeben ? 'Freigegeben am ' + new Date(monat.zeit).toLocaleDateString('de-DE') + ' — ' + escapeHtml(monat.name)
        : allSealed ? 'Bereit zur Freigabe' : 'Noch nicht alle Tage versiegelt';
    }
    document.getElementById('verlauf-btn-monat-freigeben').addEventListener('click', function () {
      var nameInput = document.getElementById('verlauf-monat-klientname');
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      var ymAtOpen = monthKey();
      openSig('Monatsfreigabe ' + ymAtOpen + ' — Klient/Budgetnehmer', function (dataUrl) {
        var monat = getMonat(ymAtOpen);
        monat.freigegeben = true; monat.name = name; monat.sig = dataUrl; monat.zeit = new Date().toISOString();
        persist(); updateMonatFreigabeStatus();
      });
    });

    // ---------- DNQP-Expertenstandards (Auftrag René 2026-09-20, pflege-diagnostik-Vorbefund) ----------
    // Nur die Dekubitusprophylaxe-URL wurde als geprüfte dnqp.de-Primärquelle mitgegeben; für die übrigen
    // 6 Standards wird bewusst nur auf die dnqp.de-Startseite verlinkt statt eine ungeprüfte Deep-Link-URL
    // zu erfinden (GLOBAL_SOURCE_OF_TRUTH_MANDATE).
    var AE_DNQP = [
      { n: 'Dekubitusprophylaxe in der Pflege', sub: 'Entwicklung 2000 · 2. Aktualisierung 2017', url: 'https://www.dnqp.de/fileadmin/HSOS/Homepages/DNQP/Dateien/Expertenstandards/Dekubitusprophylaxe/Dekubitus_2Akt_Auszug.pdf', ebenen: [
        { typ: 's', txt: 'Die Pflegefachkraft verfügt über aktuelles Wissen zur individualisierten, risikoadaptierten Bewegungsförderungs- und Lagerungsplanung bei kompletter Immobilität (z. B. Tetraplegie) — keine starre Pauschal-Intervallregel „alle 2–3 Std.".' },
        { typ: 'p', txt: 'Die individuelle Bewegungs-/Lagerungsplanung wird gemeinsam mit dem Klienten erstellt und die Haut in individuell festgelegten Abständen inspiziert; Anpassung bei Zustandsänderung.' },
        { typ: 'e', txt: 'Die Haut ist frei von druckbedingten Schädigungen; ein aktueller, individuell angepasster Bewegungs-/Lagerungsplan liegt vor.' }
      ] },
      { n: 'Pflege von Menschen mit chronischen Wunden', sub: '2. Aktualisierung 2025', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen zum phasengerechten Wundassessment nach TIME-Prinzip (Tissue/Infection/Moisture/Edge) bei Stomawunden (PEG, Tracheostoma) als potenzielle chronische Wundsituation.' },
        { typ: 'p', txt: 'Wundassessment und -dokumentation erfolgen phasengerecht nach TIME-Prinzip bei jedem Verbandwechsel, der Wundheilungsverlauf wird engmaschig beobachtet.' },
        { typ: 'e', txt: 'Der Wundheilungsverlauf der Stomawunde ist dokumentiert plausibel bzw. Komplikationen werden frühzeitig erkannt und eskaliert.' }
      ] },
      { n: 'Schmerzmanagement in der Pflege', sub: 'Aktualisierung 2020', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen zu validierten Schmerzassessment-Instrumenten für nicht-demente, kommunikationseingeschränkte/beatmete Klienten (CPOT, BPS) — BESD ist hier fachlich nicht einschlägig.' },
        { typ: 'p', txt: 'Schmerzeinschätzung erfolgt systematisch vor und nach belastenden Maßnahmen (Absaugen, Lagerung, Verbandwechsel) mittels CPOT/BPS.' },
        { typ: 'e', txt: 'Ein tolerables Schmerzniveau ist erreicht und dokumentiert, oder eine Eskalation (ärztliche Anordnung/Notarzt) ist eingeleitet.' }
      ] },
      { n: 'Sturzprophylaxe in der Pflege', sub: '2. Aktualisierung 2022', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen, dass standardisierte Sturzrisikoskalen bei diesem Klientel laut DNQP keine verlässliche Vorhersagekraft besitzen — stattdessen multifaktorielle Einschätzung statt Scoring.' },
        { typ: 'p', txt: 'Multifaktorielle Einschätzung von Transfer-/Lifter-Sicherheit (2-Personen-Standard) und Leitungssicherung (Beatmungs-/Absaugschläuche) statt Sturzskala.' },
        { typ: 'e', txt: 'Keine sturz-/transferbedingten Ereignisse; Transfer-/Lifter-Sicherheit ist dokumentiert gewährleistet.' }
      ] },
      { n: 'Förderung der Mundgesundheit in der Pflege', sub: '2023', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen zu evidenzbasierter Mundpflege als VAP-Prophylaxe (Ventilator-assoziierte Pneumonie) bei invasiver Beatmung.' },
        { typ: 'p', txt: 'Regelmäßige, standardisierte Mundpflege wird gemäß individuellem Plan durchgeführt und dokumentiert.' },
        { typ: 'e', txt: 'Die Mundschleimhaut ist intakt, keine klinischen Hinweise auf VAP-relevante orale Keimbesiedelung.' }
      ] },
      { n: 'Kontinenzförderung in der Pflege', sub: 'Aktualisierung 2024', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen zum Ausscheidungsmanagement bei neurogener Blase/Darm infolge Querschnittlähmung — hier Katheter-/Bilanzierungsmanagement statt klassischer Kontinenzförderung.' },
        { typ: 'p', txt: 'Ein- und Ausfuhr werden bilanziert, Katheter- und Ausscheidungsmanagement erfolgen nach individuellem Plan.' },
        { typ: 'e', txt: 'Ausscheidung ist komplikationsfrei dokumentiert (keine unbehandelten Harnwegsinfekte/Obstipation).' }
      ] },
      { n: 'Erhaltung und Förderung der Hautintegrität', sub: '2024', url: 'https://www.dnqp.de', ebenen: [
        { typ: 's', txt: 'Wissen zu Mazerationsschutz und Hautschutzmaßnahmen im Bereich Tracheostoma/PEG-Stoma.' },
        { typ: 'p', txt: 'Hautschutzmaßnahmen (z. B. Hautschutzplatten, festgelegte Wechselintervalle) werden konsequent angewendet und dokumentiert.' },
        { typ: 'e', txt: 'Die peristomale Haut ist reizlos, keine Mazeration.' }
      ] }
    ];
    function ebeneLabel(typ) { return typ === 's' ? 'Struktur' : (typ === 'p' ? 'Prozess' : 'Ergebnis'); }
    function renderDnqpList() {
      var host = document.getElementById('ae-dnqp-list');
      if (!host) return;
      host.innerHTML = AE_DNQP.map(function (std) {
        var ebenenHtml = std.ebenen.map(function (eb) {
          return '<div class="ae-dnqp-ebene ae-dnqp-ebene--' + eb.typ + '"><div class="ae-dnqp-ebene-lbl">' + ebeneLabel(eb.typ) + '</div><div class="ae-dnqp-ebene-txt">' + escapeHtml(eb.txt) + '</div></div>';
        }).join('');
        return '<div class="ae-dnqp-standard"><div class="ae-dnqp-head" role="button" tabindex="0" aria-expanded="false">' +
          '<div><div class="ae-dnqp-head-title">' + escapeHtml(std.n) + '</div><div class="ae-dnqp-head-sub">' + escapeHtml(std.sub) + '</div></div>' +
          '<span class="ae-dnqp-chevron" aria-hidden="true">▾</span></div>' +
          '<div class="ae-dnqp-body">' + ebenenHtml + '<a class="ae-dnqp-link" href="' + std.url + '" target="_blank" rel="noopener">Quelle: dnqp.de →</a></div></div>';
      }).join('');
      host.querySelectorAll('.ae-dnqp-head').forEach(function (head) {
        function toggle() {
          var card = head.closest('.ae-dnqp-standard');
          var open = card.classList.toggle('ae-dnqp-standard--open');
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        head.addEventListener('click', toggle);
        head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
    }
    renderDnqpList();

    // ---------- SIS -- Strukturierte Informationssammlung + individueller Maßnahmeplan (Auftrag René 2026-09-20) ----------
    function defaultSisTf() {
      return {
        tf1: { orientierung: '', sprache: '', sehen: '', hoeren: '', kommunikationsweg: '' },
        tf2: { eigenbewegung: '', transfer: '', stehenGehen: '', lifterSicherheit: '' },
        tf3: { beatmungsparameter: '', absaugbedarf: '', schmerzsituation: '', therapieaengste: '', medikamentenmanagement: '', notfallrisiken: '' },
        tf4: { koerperpflege: '', ernaehrung: '', ausscheidung: '', ankleiden: '' },
        tf5: { angehoerige: '', tagesstruktur: '', teilhabe: '', diskretion: '' },
        tf6: { barrierefreiheit: '', medizintechnik: '', notfallausstattung: '', hauswirtschaft: '' }
      };
    }
    function getSis() {
      if (!AE.sis) AE.sis = { entwurf: defaultSisTf(), historie: [], massnahmen: [] };
      if (!AE.sis.entwurf) AE.sis.entwurf = defaultSisTf();
      if (!AE.sis.historie) AE.sis.historie = [];
      if (!AE.sis.massnahmen) AE.sis.massnahmen = [];
      return AE.sis;
    }
    var SIS_TF_LABELS = { tf1: '1 · Kognition und Kommunikation', tf2: '2 · Mobilität und Beweglichkeit', tf3: '3 · Krankheitsbezogene Anforderungen und Belastungen', tf4: '4 · Selbstversorgung', tf5: '5 · Leben in sozialen Beziehungen', tf6: '6 · Haushaltsführung' };
    var SIS_TF_ORDER = ['tf1', 'tf2', 'tf3', 'tf4', 'tf5', 'tf6'];

    function bindSisForm() {
      var sis = getSis();
      document.querySelectorAll('#sis-tf-form [data-sis]').forEach(function (el) {
        var val = getDeep(sis.entwurf, el.dataset.sis);
        el.value = val === undefined || val === null ? '' : val;
      });
    }
    function handleSisFormInput(e) {
      var el = e.target.closest('[data-sis]');
      if (!el) return;
      setDeep(getSis().entwurf, el.dataset.sis, el.value);
      persist();
    }
    document.getElementById('sis-tf-form').addEventListener('input', handleSisFormInput);
    document.getElementById('sis-tf-form').addEventListener('change', handleSisFormInput);

    function renderSisHistorie() {
      var sis = getSis();
      var host = document.getElementById('sis-historie-list');
      if (!sis.historie.length) { host.innerHTML = '<p class="text-[#9CADC9] text-xs">Noch keine Version gesichert.</p>'; return; }
      host.innerHTML = sis.historie.map(function (h, i) {
        return '<div class="ae-sis-histentry"><span class="ae-sis-histentry-meta">' + (i === 0 ? 'Aktuelle Version' : 'Vorherige Version') + '</span> — ' +
          escapeHtml(new Date(h.zeit).toLocaleString('de-DE')) + ' · ' + escapeHtml(h.pfk || '—') + '</div>';
      }).join('');
    }
    document.getElementById('sis-btn-version').addEventListener('click', function () {
      var sis = getSis();
      sis.historie.unshift({ id: uid(), zeit: new Date().toISOString(), pfk: document.getElementById('sis-pfk').value, tf: JSON.parse(JSON.stringify(sis.entwurf)) });
      persist();
      renderSisHistorie();
    });

    function mpBlockHtml(m) {
      return '<div class="ae-card p-4 mb-3 ae-mp-block" data-mp-id="' + m.id + '">' +
        '<label class="block text-xs font-semibold mb-2">Ressource/Problem<textarea class="ae-textarea" data-mp-field="ressourceProblem" placeholder="Freitext">' + escapeHtml(m.ressourceProblem || '') + '</textarea></label>' +
        '<label class="block text-xs font-semibold mb-2">Pflegediagnose<textarea class="ae-textarea" data-mp-field="pflegediagnose" placeholder="z. B. &quot;Beeinträchtigte körperliche Mobilität i. Z. m. Tetraplegie, gekennzeichnet durch...&quot;">' + escapeHtml(m.pflegediagnose || '') + '</textarea></label>' +
        '<label class="block text-xs font-semibold mb-2">Ziel<textarea class="ae-textarea" data-mp-field="ziel" placeholder="Konkret, evaluierbar">' + escapeHtml(m.ziel || '') + '</textarea></label>' +
        '<label class="block text-xs font-semibold mb-2">Konkrete Maßnahme (mit Frequenz-Angabe)<textarea class="ae-textarea" data-mp-field="massnahme" placeholder="Freitext">' + escapeHtml(m.massnahme || '') + '</textarea></label>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '<label class="block text-xs font-semibold">Evaluationsdatum/-intervall<input type="date" class="ae-input" data-mp-field="evalDatum" value="' + escapeHtml(m.evalDatum || '') + '"></label>' +
        '<label class="block text-xs font-semibold">Leitlinien-/DNQP-Referenz<input type="text" class="ae-input" list="sis-mp-referenz-optionen" data-mp-field="referenz" value="' + escapeHtml(m.referenz || '') + '"></label>' +
        '</div></div>';
    }
    function mpFieldHandler(e) {
      var el = e.target.closest('[data-mp-field]');
      if (!el) return;
      var block = el.closest('.ae-mp-block');
      var sis = getSis();
      var entry = sis.massnahmen.filter(function (m) { return m.id === block.dataset.mpId; })[0];
      if (!entry) return;
      entry[el.dataset.mpField] = el.value;
      persist();
    }
    function renderMp() {
      var sis = getSis();
      var host = document.getElementById('sis-mp-list');
      host.innerHTML = SIS_TF_ORDER.map(function (tf) {
        var entries = sis.massnahmen.filter(function (m) { return m.tf === tf; });
        var blocksHtml = entries.map(mpBlockHtml).join('') || '<p class="text-[#9CADC9] text-xs mb-2">Noch keine Maßnahme erfasst.</p>';
        return '<h3 class="font-bold text-sm text-white mt-5 mb-2">' + SIS_TF_LABELS[tf] + '</h3>' + blocksHtml +
          '<button type="button" class="ae-btn-secondary ae-no-print" style="padding:.5rem 1rem;" data-mp-add="' + tf + '">+ Neue Maßnahme</button>';
      }).join('');
      host.querySelectorAll('[data-mp-add]').forEach(function (btn) { btn.addEventListener('click', function () { addMpEntry(btn.dataset.mpAdd); }); });
      host.querySelectorAll('[data-mp-field]').forEach(function (el) { el.addEventListener('input', mpFieldHandler); el.addEventListener('change', mpFieldHandler); });
    }
    function addMpEntry(tf) {
      getSis().massnahmen.push({ id: uid(), tf: tf, ressourceProblem: '', pflegediagnose: '', ziel: '', massnahme: '', evalDatum: '', referenz: '' });
      persist();
      renderMp();
    }
    function buildMassnahmeplanHtml() {
      var sis = getSis();
      var html = aeBriefkopfHtml('aeRingMp') + '<h1 class="ae-michroma" style="font-size:1.5rem; font-weight:800;">AERIS — Individueller Maßnahmeplan</h1>';
      SIS_TF_ORDER.forEach(function (tf) {
        var entries = sis.massnahmen.filter(function (m) { return m.tf === tf; });
        if (!entries.length) return;
        html += '<h2>' + SIS_TF_LABELS[tf] + '</h2>';
        entries.forEach(function (m) {
          html += '<table><tbody>' +
            protokollRow('Ressource/Problem', m.ressourceProblem) + protokollRow('Pflegediagnose', m.pflegediagnose) +
            protokollRow('Ziel', m.ziel) + protokollRow('Maßnahme', m.massnahme) +
            protokollRow('Evaluationsdatum/-intervall', m.evalDatum) + protokollRow('Leitlinien-/DNQP-Referenz', m.referenz) +
            '</tbody></table>';
        });
      });
      html += '<p style="margin-top:1.5rem;font-size:.75rem;color:#555555;">Automatisch erzeugt aus AERIS Dokumentation am ' + new Date().toLocaleString('de-DE') + '.</p>';
      return html;
    }
    document.getElementById('sis-mp-print').addEventListener('click', function () { aePrintOrExport('AERIS — Maßnahmeplan', buildMassnahmeplanHtml); });

    function showSisTab(tab) {
      document.getElementById('sis-tf-panel').classList.toggle('ae-hidden', tab !== 'tf');
      document.getElementById('sis-mp-panel').classList.toggle('ae-hidden', tab !== 'mp');
      document.querySelectorAll('[data-sis-tab]').forEach(function (btn) { btn.setAttribute('aria-selected', btn.dataset.sisTab === tab ? 'true' : 'false'); });
      if (tab === 'mp') renderMp();
    }
    document.querySelectorAll('[data-sis-tab]').forEach(function (btn) { btn.addEventListener('click', function () { showSisTab(btn.dataset.sisTab); }); });
    function renderSis() {
      refreshPfkSelects();
      bindSisForm();
      renderSisHistorie();
      var activeTab = document.querySelector('[data-sis-tab][aria-selected="true"]');
      showSisTab(activeTab ? activeTab.dataset.sisTab : 'tf');
    }

    // ---------- Auswertungen: Tabs ----------
    function showAwTab(tab, opts) {
      ['leistungsnachweis', 'rechnung', 'steuerberater', 'mdpruefung'].forEach(function (t) {
        var panel = document.getElementById('aw-' + t);
        if (panel) panel.classList.toggle('ae-hidden', t !== tab);
        var btn = document.querySelector('[data-aw-tab="' + t + '"]');
        if (btn) btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      if (tab === 'leistungsnachweis') renderLeistungsnachweis();
      if (tab === 'rechnung') renderRechnung();
      if (tab === 'steuerberater') renderSteuerberater();
      if (tab === 'mdpruefung') renderMdPruefung();
      // a11y-Fix 2026-09-18: Fokus-Versatz auf Panel-Ueberschrift beim Tab-Wechsel
      // (gleiches Muster wie showView) — nur bei explizitem Nutzer-Klick auf einen Tab-Button.
      if (opts && opts.focusPanel) {
        var activePanel = document.getElementById('aw-' + tab);
        var heading = activePanel && activePanel.querySelector('h1, h2, h3');
        if (heading) { if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      }
    }
    document.querySelectorAll('[data-aw-tab]').forEach(function (btn) { btn.addEventListener('click', function () { showAwTab(btn.dataset.awTab, { focusPanel: true }); }); });
    // Uebergabemappe-Checkliste B: Sprung-Links zu Rechnung/Leistungsnachweis-Tab (2026-09-18)
    document.querySelectorAll('[data-aw-tab-jump]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.dataset.awTabJump;
        showAwTab(tab, { focusPanel: true });
        var tabBtn = document.querySelector('[data-aw-tab="' + tab + '"]');
        if (tabBtn) tabBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    document.getElementById('aw-monat').addEventListener('change', function () {
      var active = document.querySelector('[data-aw-tab][aria-selected="true"]');
      showAwTab(active ? active.dataset.awTab : 'leistungsnachweis');
    });
    document.getElementById('aw-ln-print').addEventListener('click', function () {
      aePrintOrExport('AERIS — Leistungsnachweis', function () { return aePrintableClone('aw-leistungsnachweis'); });
    });
    document.getElementById('aw-md-print').addEventListener('click', function () {
      aePrintOrExport('AERIS — MD-Prüfung', function () { return aePrintableClone('aw-mdpruefung'); });
    });
    // Rechnung-Tab: neuer Drucken-Button (Bugfix 2026-09-19 — fehlte komplett), deckt Budget-Rechnung
    // UND Privatrechnung ab (beide Karten liegen im selben Panel #aw-rechnung).
    var awRePrintBtn = document.getElementById('aw-re-print');
    if (awRePrintBtn) awRePrintBtn.addEventListener('click', function () {
      aePrintOrExport('AERIS — Rechnung', function () { return aePrintableClone('aw-rechnung'); });
    });

    function awMonatDates() {
      var ym = document.getElementById('aw-monat').value;
      return Object.keys(AE.tage).filter(function (iso) { return iso.indexOf(ym) === 0; }).sort();
    }
    function shiftStunden(tag) {
      var s = timeToMinutes(tag.von), e = timeToMinutes(tag.bis);
      if (s === null || e === null) return 0;
      var min = e - s; if (min <= 0) min += 1440;
      return min / 60;
    }

    // ---------- Zuschlagsberechnung (testing-qa Fix 3): Nacht/Samstag/Sonntag/Feiertag/Weihnachten ----------
    // Feiertage Hessen (Sitz AERIS: Dautphetal) — Gauss'sche Osterformel fuer die beweglichen Feiertage,
    // damit die Liste nicht jaehrlich per Hand gepflegt werden muss.
    function easterSunday(year) {
      var a = year % 19, b = Math.floor(year / 100), c = year % 100;
      var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
      var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
      var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
      var m = Math.floor((a + 11 * h + 22 * l) / 451);
      var month = Math.floor((h + l - 7 * m + 114) / 31);
      var day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    }
    function addDaysIso(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); }
    function hessenFeiertage(year) {
      var ostern = easterSunday(year);
      return [
        isoDate(year, 0, 1),        // Neujahr
        addDaysIso(ostern, -2),     // Karfreitag
        addDaysIso(ostern, 1),      // Ostermontag
        isoDate(year, 4, 1),        // Tag der Arbeit
        addDaysIso(ostern, 39),     // Christi Himmelfahrt
        addDaysIso(ostern, 50),     // Pfingstmontag
        addDaysIso(ostern, 60),     // Fronleichnam (Hessen)
        isoDate(year, 9, 3),        // Tag der Deutschen Einheit
        isoDate(year, 11, 25),      // 1. Weihnachtsfeiertag
        isoDate(year, 11, 26)       // 2. Weihnachtsfeiertag
      ];
    }
    // 24./25./26.12. laufen separat als "Weihnachten"-Bucket (eigener Zuschlagssatz), nicht als Feiertag.
    function tagZuschlagTyp(iso, feiertageSet) {
      var mmdd = iso.slice(5);
      if (mmdd === '12-24' || mmdd === '12-25' || mmdd === '12-26') return 'weihnachten';
      if (feiertageSet[iso]) return 'feiertag';
      var wd = new Date(iso + 'T00:00:00').getDay();
      if (wd === 0) return 'sonntag';
      if (wd === 6) return 'samstag';
      return null;
    }
    // Wochentag-/Feiertag-Zuschlag ANTEILIG je Kalendertag: bei Schichten mit Mitternachtsueberschreitung
    // (bis < von) werden die Stunden vor Mitternacht dem Start-Tag und die Stunden nach Mitternacht dem
    // Folge-Tag zugeordnet — jeweils mit dessen eigenem Zuschlagstyp (gleiches Fenster-Splitting-Prinzip
    // wie nachtMinutenForTag, nur auf Tages- statt Nachtfenster-Grenzen angewendet).
    function tagZuschlagStunden(tag, iso, feiertageSet) {
      var result = {};
      var s = timeToMinutes(tag.von), e = timeToMinutes(tag.bis);
      if (s === null || e === null) return result;
      var dur = e - s; if (dur <= 0) dur += 1440;
      var vorMitternacht = Math.min(dur, 1440 - s);
      var nachMitternacht = dur - vorMitternacht;
      if (vorMitternacht > 0) {
        var typ1 = tagZuschlagTyp(iso, feiertageSet);
        if (typ1) result[typ1] = (result[typ1] || 0) + vorMitternacht / 60;
      }
      if (nachMitternacht > 0) {
        var nextIso = isoPlusDays(iso, 1);
        var typ2 = tagZuschlagTyp(nextIso, feiertageSet);
        if (typ2) result[typ2] = (result[typ2] || 0) + nachMitternacht / 60;
      }
      return result;
    }
    function isoPlusDays(iso, n) {
      var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
      return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
    }
    // Nachtstunden (19:00–06:00) innerhalb einer Schicht, unabhaengig vom Wochentag-Zuschlag (additiv).
    function nachtMinutenForTag(tag) {
      var s = timeToMinutes(tag.von), e = timeToMinutes(tag.bis);
      if (s === null || e === null) return 0;
      var dur = e - s; if (dur <= 0) dur += 1440;
      var absStart = s, absEnd = s + dur, total = 0;
      var kBase = Math.floor(absStart / 1440) - 1;
      for (var k = kBase; k <= kBase + 3; k++) {
        var winStart = 19 * 60 + 1440 * k, winEnd = 30 * 60 + 1440 * k;
        var ovStart = Math.max(absStart, winStart), ovEnd = Math.min(absEnd, winEnd);
        if (ovEnd > ovStart) total += (ovEnd - ovStart);
      }
      return total;
    }

    // ---------- Leistungsnachweis ----------
    function renderLeistungsnachweis() {
      var ym = document.getElementById('aw-monat').value;
      if (!ym) return;
      var tbody = document.getElementById('aw-ln-tbody'); tbody.innerHTML = '';
      var dates = awMonatDates();
      var totalStd = 0;
      dates.forEach(function (iso) {
        var tag = AE.tage[iso];
        var m = entriesFor(iso, 'massnahme');
        if (!m.length && !tag.von && !tag.bis) return;
        var seen = {}; var catsArr = [];
        m.forEach(function (en) { if (!seen[en.cat]) { seen[en.cat] = true; catsArr.push(catLabel(en.cat)); } });
        var std = shiftStunden(tag); totalStd += std;
        var status = statusPillLabel(tag);

        // Erbrachte Maßnahme(n) des Tages als eigene Tabellenspalte (Korrektur 2026-09-19, René-Direktive):
        // dedupliziert (mehrfach erfasste gleiche Maßnahme am Tag nur einmal), mehrere unterschiedliche
        // Maßnahmen kommagetrennt in derselben Zelle. Nur der Maßnahmen-Name, keine Assessment-Parameter/
        // Zeitbezug/PFK-Details — die bleiben unveraendert im Uebergabeprotokoll (buildUebergabeprotokoll()).
        var massnahmenArr = [];
        m.forEach(function (en) { if (massnahmenArr.indexOf(en.label) === -1) massnahmenArr.push(en.label); });

        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-2 pr-3">' + iso + '</td><td class="py-2 pr-3">' + (tag.von || '—') + '–' + (tag.bis || '—') + '</td>' +
          '<td class="py-2 pr-3">' + escapeHtml(catsArr.join(', ') || '—') + '</td>' +
          '<td class="py-2 pr-3">' + escapeHtml(massnahmenArr.join(', ') || '—') + '</td>' +
          '<td class="py-2 pr-3">' + std.toFixed(2) + ' Std.</td>' +
          '<td class="py-2 pr-3">' + escapeHtml(tag.pfk || '—') + '</td><td class="py-2">' + status + '</td>';
        tbody.appendChild(tr);
      });
      document.getElementById('aw-ln-summe').textContent = totalStd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Std.';
    }

    // ---------- Rechnung: Budget (§ 37c SGB V) + Privatrechnung (nur Aufnahme/Anamnese) ----------
    // Einzige Quelle der Zuschlagskoeffizienten — von renderRechnung() UND berechneBudgetZahlenFuer()
    // referenziert, damit Rechnung und Steuerberater-Export nie stillschweigend auseinanderlaufen.
    var ZUSCHLAG_KOEFFIZIENTEN = { nacht: 0.19, samstag: 0.08, sonntag: 0.50, feiertag: 1.25, weihnachten: 1.35 };
    // ---------- Rechnungsnummer: fortlaufend, persistent, nie doppelt vergeben (§ 14 Abs. 4 UStG) ----------
    // Schema RE-<Jahr>-PFLEGE-<lfd.> (Budget-/Kassenrechnung) bzw. RE-<Jahr>-BERATUNG-<lfd.> (Privatrechnung).
    // Je Monat (ym) + Rechnungsart wird die Nummer EINMALIG vergeben und danach nur noch aus AE.rechnungsnummern
    // gelesen — ein erneutes Rendern (Tab-Wechsel, Reload) darf NICHT erneut zaehlen, sonst waeren Nummern
    // weder fortlaufend noch stabil.
    function getOrAssignRechnungsnr(art, ym) {
      if (!AE.rechnungsnummern) AE.rechnungsnummern = { budget: {}, privat: {} };
      if (!AE.rechnungsnummern.budget) AE.rechnungsnummern.budget = {};
      if (!AE.rechnungsnummern.privat) AE.rechnungsnummern.privat = {};
      if (AE.rechnungsnummern[art][ym]) return AE.rechnungsnummern[art][ym];
      if (!AE.settings.rechnungsnrZaehler) AE.settings.rechnungsnrZaehler = { budget: 0, privat: 0 };
      AE.settings.rechnungsnrZaehler[art] = (AE.settings.rechnungsnrZaehler[art] || 0) + 1;
      var jahr = ym.slice(0, 4);
      var segment = art === 'privat' ? 'BERATUNG' : 'PFLEGE';
      var nr = 'RE-' + jahr + '-' + segment + '-' + AE.settings.rechnungsnrZaehler[art];
      AE.rechnungsnummern[art][ym] = nr;
      persist();
      return nr;
    }
    function monatLangText(ym) {
      var y = ym.slice(0, 4), m = parseInt(ym.slice(5, 7), 10) - 1;
      return (V_MONTH_NAMES[m] || '') + ' ' + y;
    }
    function renderRechnung() {
      var ym = document.getElementById('aw-monat').value;
      if (!ym) return;
      var heuteDatum = new Date().toLocaleDateString('de-DE');
      var empfaenger = AE.settings.kassenname && AE.settings.kassenname.trim() ? AE.settings.kassenname.trim() : '[Kassenname in Einstellungen hinterlegen]';
      var zeitraumText = 'Leistungszeitraum: ' + monatLangText(ym);
      document.getElementById('aw-re-nr').textContent = getOrAssignRechnungsnr('budget', ym);
      document.getElementById('aw-re-datum').textContent = heuteDatum;
      document.getElementById('aw-re-empfaenger').textContent = empfaenger;
      document.getElementById('aw-re-zeitraum').textContent = zeitraumText;
      document.getElementById('aw-re-privat-nr').textContent = getOrAssignRechnungsnr('privat', ym);
      document.getElementById('aw-re-privat-datum').textContent = heuteDatum;
      document.getElementById('aw-re-privat-empfaenger').textContent = empfaenger;
      document.getElementById('aw-re-privat-zeitraum').textContent = zeitraumText;
      var dates = awMonatDates();
      var std = 0, nachtStd = 0;
      var zuschlagStd = { samstag: 0, sonntag: 0, feiertag: 0, weihnachten: 0 };
      var feiertageSet = {};
      var jahr = parseInt(ym.slice(0, 4), 10);
      hessenFeiertage(jahr).forEach(function (f) { feiertageSet[f] = true; });
      hessenFeiertage(jahr + 1).forEach(function (f) { feiertageSet[f] = true; }); // fuer Schichten 31.12.->1.1.
      dates.forEach(function (iso) {
        var tag = AE.tage[iso];
        var h = shiftStunden(tag);
        std += h;
        nachtStd += nachtMinutenForTag(tag) / 60;
        var anteile = tagZuschlagStunden(tag, iso, feiertageSet);
        Object.keys(anteile).forEach(function (typ) { zuschlagStd[typ] = (zuschlagStd[typ] || 0) + anteile[typ]; });
      });
      var satz = AE.settings.satzPflege;
      var basisBetrag = std * satz;
      var zNacht = nachtStd * satz * ZUSCHLAG_KOEFFIZIENTEN.nacht;
      var zSamstag = zuschlagStd.samstag * satz * ZUSCHLAG_KOEFFIZIENTEN.samstag;
      var zSonntag = zuschlagStd.sonntag * satz * ZUSCHLAG_KOEFFIZIENTEN.sonntag;
      var zFeiertag = zuschlagStd.feiertag * satz * ZUSCHLAG_KOEFFIZIENTEN.feiertag;
      var zWeihnachten = zuschlagStd.weihnachten * satz * ZUSCHLAG_KOEFFIZIENTEN.weihnachten;
      var summe = basisBetrag + zNacht + zSamstag + zSonntag + zFeiertag + zWeihnachten;
      document.getElementById('aw-re-budget-std').textContent = std.toFixed(2) + ' Std.';
      document.getElementById('aw-re-budget-satz').textContent = formatEuro(satz);
      document.getElementById('aw-re-budget-basis').textContent = formatEuro(basisBetrag);
      document.getElementById('aw-re-zuschlag-nacht').textContent = formatEuro(zNacht);
      document.getElementById('aw-re-zuschlag-samstag').textContent = formatEuro(zSamstag);
      document.getElementById('aw-re-zuschlag-sonntag').textContent = formatEuro(zSonntag);
      document.getElementById('aw-re-zuschlag-feiertag').textContent = formatEuro(zFeiertag);
      document.getElementById('aw-re-zuschlag-weihnachten').textContent = formatEuro(zWeihnachten);
      document.getElementById('aw-re-budget-summe').textContent = formatEuro(summe);
      // Std.-Spalte der Tabelle (rein darstellend — dieselben bereits oben berechneten Werte) sowie
      // Ein-/Ausblenden der Zuschlagszeilen, falls der jeweilige Betrag 0 ist.
      document.getElementById('aw-re-zuschlag-nacht-std').textContent = nachtStd.toFixed(2) + ' Std.';
      document.getElementById('aw-re-zuschlag-samstag-std').textContent = zuschlagStd.samstag.toFixed(2) + ' Std.';
      document.getElementById('aw-re-zuschlag-sonntag-std').textContent = zuschlagStd.sonntag.toFixed(2) + ' Std.';
      document.getElementById('aw-re-zuschlag-feiertag-std').textContent = zuschlagStd.feiertag.toFixed(2) + ' Std.';
      document.getElementById('aw-re-zuschlag-weihnachten-std').textContent = zuschlagStd.weihnachten.toFixed(2) + ' Std.';
      document.getElementById('aw-re-tr-nacht').style.display = zNacht > 0 ? '' : 'none';
      document.getElementById('aw-re-tr-samstag').style.display = zSamstag > 0 ? '' : 'none';
      document.getElementById('aw-re-tr-sonntag').style.display = zSonntag > 0 ? '' : 'none';
      document.getElementById('aw-re-tr-feiertag').style.display = zFeiertag > 0 ? '' : 'none';
      document.getElementById('aw-re-tr-weihnachten').style.display = zWeihnachten > 0 ? '' : 'none';
      var privEntries = AE.entries.filter(function (en) { return en.type === 'privat' && en.datum.indexOf(ym) === 0; });
      var aufnahmeSumme = privEntries.reduce(function (s, en) { return s + (parseFloat(en.betrag) || 0); }, 0);
      document.getElementById('aw-re-privat-anzahl').textContent = privEntries.length + (privEntries.length === 1 ? ' Pauschale' : ' Pauschalen');
      document.getElementById('aw-re-privat-aufnahme').textContent = formatEuro(aufnahmeSumme);
      document.getElementById('aw-re-privat-gesamt').textContent = formatEuro(aufnahmeSumme);
    }

    // ---------- Steuerberater: Übergabemappe-Status + Fahrtenbuch-Reisekosten ----------
    function renderSteuerberater() {
      var ym = document.getElementById('aw-monat').value;
      if (!ym) return;
      var trips = AE.entries.filter(function (en) { return en.type === 'fahrt' && en.datum.indexOf(ym) === 0; })
        .sort(function (a, b) { return a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit); });
      var tbody = document.getElementById('aw-stb-fahrt-tbody'); tbody.innerHTML = '';
      var totalKm = 0;
      trips.forEach(function (t) {
        totalKm += parseFloat(t.km) || 0;
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-2 pr-3">' + t.datum + '</td><td class="py-2 pr-3">' + escapeHtml(t.von) + ' → ' + escapeHtml(t.nach) + '</td>' +
          '<td class="py-2 pr-3">' + escapeHtml(t.zweck || '—') + '</td><td class="py-2">' + (parseFloat(t.km) || 0).toFixed(1) + ' km</td>';
        tbody.appendChild(tr);
      });
      document.getElementById('aw-stb-fahrt-summe-km').textContent = totalKm.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km';
      document.getElementById('aw-stb-fahrt-summe-eur').textContent = formatEuro(totalKm * 0.30);
    }

    // ---------- Steuerberater: Export & Teilen (CSV, Web Share API mit Download-Fallback) ----------
    function monatDatesFor(ym) {
      return Object.keys(AE.tage).filter(function (iso) { return iso.indexOf(ym) === 0; }).sort();
    }
    // Spiegelt die Betragsformel aus renderRechnung() fuer einen frei waehlbaren Monat (ym) statt
    // des aktuell im DOM selektierten — bewusst eigenstaendig, um renderRechnung() nicht anzufassen.
    function berechneBudgetZahlenFuer(ym) {
      var dates = monatDatesFor(ym);
      var std = 0, nachtStd = 0;
      var zuschlagStd = { samstag: 0, sonntag: 0, feiertag: 0, weihnachten: 0 };
      var feiertageSet = {};
      var jahr = parseInt(ym.slice(0, 4), 10);
      hessenFeiertage(jahr).forEach(function (f) { feiertageSet[f] = true; });
      hessenFeiertage(jahr + 1).forEach(function (f) { feiertageSet[f] = true; });
      dates.forEach(function (iso) {
        var tag = AE.tage[iso];
        std += shiftStunden(tag);
        nachtStd += nachtMinutenForTag(tag) / 60;
        var anteile = tagZuschlagStunden(tag, iso, feiertageSet);
        Object.keys(anteile).forEach(function (typ) { zuschlagStd[typ] = (zuschlagStd[typ] || 0) + anteile[typ]; });
      });
      var satz = AE.settings.satzPflege;
      var basisBetrag = std * satz;
      var zuschlaegeSumme = nachtStd * satz * ZUSCHLAG_KOEFFIZIENTEN.nacht + zuschlagStd.samstag * satz * ZUSCHLAG_KOEFFIZIENTEN.samstag +
        zuschlagStd.sonntag * satz * ZUSCHLAG_KOEFFIZIENTEN.sonntag + zuschlagStd.feiertag * satz * ZUSCHLAG_KOEFFIZIENTEN.feiertag +
        zuschlagStd.weihnachten * satz * ZUSCHLAG_KOEFFIZIENTEN.weihnachten;
      var privEntries = AE.entries.filter(function (en) { return en.type === 'privat' && en.datum.indexOf(ym) === 0; });
      var aufnahmeSumme = privEntries.reduce(function (s, en) { return s + (parseFloat(en.betrag) || 0); }, 0);
      return { std: std, satz: satz, basisBetrag: basisBetrag, zuschlaegeSumme: zuschlaegeSumme, aufnahmeSumme: aufnahmeSumme };
    }
    function fahrtenFuerExport(ym) {
      return AE.entries.filter(function (en) { return en.type === 'fahrt' && en.datum.indexOf(ym) === 0; })
        .sort(function (a, b) { return a.datum.localeCompare(b.datum) || a.uhrzeit.localeCompare(b.uhrzeit); });
    }
    // Liest den aktuell im DOM sichtbaren Ankreuz-Status der Uebergabemappe-Checkliste (A-D) aus — bewusst
    // ungespeichert/fluechtig wie die Checkboxen selbst, daher nur zum Zeitpunkt des Exports gueltig.
    function uebergabeChecklistStatus() {
      var kategorien = [];
      document.querySelectorAll('#aw-uebergabe-checkliste > .ae-card').forEach(function (card) {
        var heading = card.querySelector('h3');
        var titel = heading ? heading.textContent.trim() : '';
        var items = [];
        var checkedCount = 0;
        card.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
          var label = box.closest('label');
          var span = label ? label.querySelector('span') : null;
          var checked = !!box.checked;
          if (checked) checkedCount++;
          items.push({ text: span ? span.textContent.trim() : '', checked: checked });
        });
        kategorien.push({ titel: titel, items: items, checkedCount: checkedCount, total: items.length });
      });
      return kategorien;
    }
    function csvEscape(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
    function buildSteuerberaterCsv(ym) {
      var z = berechneBudgetZahlenFuer(ym);
      var trips = fahrtenFuerExport(ym);
      var totalKm = trips.reduce(function (s, t) { return s + (parseFloat(t.km) || 0); }, 0);
      var fahrtBetrag = totalKm * 0.30;
      var checklisten = uebergabeChecklistStatus();
      var rows = [];
      function row() { rows.push(Array.prototype.slice.call(arguments).map(csvEscape).join(';')); }
      row('AERIS Dokumentation — Export für Steuerberater');
      row('Einzelunternehmen AERIS, Inhaber René Krieg, Hohenfelsstraße 34, 35232 Dautphetal');
      row('Monat', ym);
      row('Erzeugt am', new Date().toLocaleString('de-DE'));
      row('');
      row('SKR-Kontenmatrix — Positionen des Monats');
      row('Kategorie', 'Konto SKR03', 'Konto SKR04', 'Bezeichnung', 'Betrag (EUR)');
      row('Pflegeerlöse Basis', '8100', '4100', 'Pflegestunden Budget (§ 37c SGB V), ' + z.std.toFixed(2) + ' Std. × ' + z.satz.toFixed(2) + ' €', z.basisBetrag.toFixed(2));
      row('Zuschläge Pflege', '8115', '4115', 'Nacht/Samstag/Sonntag/Feiertag/Weihnachten gesamt', z.zuschlaegeSumme.toFixed(2));
      row('Privatleistungen', '8190', '4180', 'Aufnahme-/Anamnese-Pauschale', z.aufnahmeSumme.toFixed(2));
      row('Fahrtkosten/Reisekosten', '4670', '6670', totalKm.toFixed(1) + ' km × 0,30 €/km (Betriebsausgabe)', fahrtBetrag.toFixed(2));
      row('');
      row('Fahrtenbuch — Einzelfahrten (ordnungsgemäßes Fahrtenbuch gem. BFH-Urteil VI R 33/10)');
      row('Datum', 'Uhrzeit', 'Von', 'Nach', 'Zweck', 'Sparte', 'Km', 'Betrag (EUR)');
      trips.forEach(function (t) {
        var km = parseFloat(t.km) || 0;
        var sparteLabel = t.sparte === 'beratung' ? 'Säule 2 — Beratung' : 'Säule 1 — Pflege';
        row(t.datum, t.uhrzeit || '—', t.von || '—', t.nach || '—', t.zweck || '—', sparteLabel, km.toFixed(1) + ' km', (km * 0.30).toFixed(2));
      });
      if (!trips.length) row('— keine Fahrten im Monat erfasst —');
      row('Gesamt', '', '', '', '', '', totalKm.toFixed(1) + ' km', fahrtBetrag.toFixed(2));
      row('');
      row('Übergabemappe — Checklisten-Status');
      row('Kategorie', 'Position', 'Status');
      checklisten.forEach(function (kat) {
        kat.items.forEach(function (item) { row(kat.titel, item.text, item.checked ? 'abgehakt' : 'offen'); });
        row(kat.titel + ' — Zusammenfassung', kat.checkedCount + ' von ' + kat.total + ' abgehakt',
          (kat.total > 0 && kat.checkedCount === kat.total) ? 'vollständig' : 'unvollständig');
      });
      row('');
      row('Hinweis: Enthält Fahrtdaten mit Zielortangaben zur GoBD-/BFH-konformen Nachweisführung (§ 9 EStG). Weitergabe an Steuerberater/Finanzamt ist zulässig (§ 57 StBerG, § 30 AO Verschwiegenheitspflicht) — nicht für Weitergabe an Dritte ohne Verschwiegenheitspflicht bestimmt.');
      return '﻿' + rows.join('\r\n');
    }
    function exportSteuerberaterMonat() {
      var note = document.getElementById('aw-stb-export-note');
      var ym = document.getElementById('aw-monat').value;
      if (!ym) { if (note) { note.textContent = 'Bitte zuerst einen Monat wählen.'; showInlineNote(note); } return; }
      var csv = buildSteuerberaterCsv(ym);
      var filename = 'AERIS-Steuerberater-' + ym + '.csv';
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      function fallbackDownload() {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        if (note) { note.textContent = 'Export heruntergeladen: ' + filename; showInlineNote(note); }
      }
      var file = null;
      try { file = new File([blob], filename, { type: 'text/csv' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'AERIS Steuerberater-Export ' + ym, text: 'Steuerberater-Unterlagen AERIS für ' + ym })
          .then(function () { if (note) { note.textContent = 'Export geteilt.'; showInlineNote(note); } })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return;
            fallbackDownload();
          });
      } else {
        fallbackDownload();
      }
    }
    var awStbExportBtn = document.getElementById('aw-stb-export-btn');
    if (awStbExportBtn) awStbExportBtn.addEventListener('click', exportSteuerberaterMonat);

    // ---------- MD-Pruefung (QPR-HKP/AKI): reine Ausgabe auf bereits erfassten Daten ----------
    function renderMdPruefung() {
      var ym = document.getElementById('aw-monat').value;
      if (!ym) return;
      var dates = awMonatDates();
      var tbody = document.getElementById('aw-md-tage-tbody'); tbody.innerHTML = '';
      var offenCount = 0, versiegeltCount = 0;
      dates.forEach(function (iso) {
        var tag = AE.tage[iso];
        var m = entriesFor(iso, 'massnahme');
        if (!m.length && !tag.von && !tag.bis) return;
        if (tag.versiegelt) versiegeltCount++; else offenCount++;
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="py-2 pr-3">' + iso + '</td><td class="py-2 pr-3">' + m.length + '</td>' +
          '<td class="py-2"><span class="ae-status-pill ' + statusPillClass(tag) + '">' + statusPillLabel(tag) + '</span></td>';
        tbody.appendChild(tr);
      });
      var gesamt = document.getElementById('aw-md-gesamtstatus');
      if (offenCount === 0 && versiegeltCount > 0) { gesamt.textContent = 'Prüfbereit — alle ' + versiegeltCount + ' Tage mit Einträgen sind versiegelt.'; gesamt.style.color = '#D09B69'; }
      else if (versiegeltCount === 0 && offenCount === 0) { gesamt.textContent = 'Keine Einträge in diesem Monat.'; gesamt.style.color = '#9CADC9'; }
      else { gesamt.textContent = 'Noch nicht prüfbereit — ' + offenCount + ' von ' + (offenCount + versiegeltCount) + ' Tagen sind noch nicht versiegelt.'; gesamt.style.color = '#E8C39E'; }

      var refMap = {};
      dates.forEach(function (iso) {
        entriesFor(iso, 'massnahme').forEach(function (en) { if (en.ref) refMap[en.ref] = (refMap[en.ref] || 0) + 1; });
      });
      var refWrap = document.getElementById('aw-md-referenzen');
      var refKeys = Object.keys(refMap);
      if (!refKeys.length) { refWrap.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine Pflegemaßnahmen mit hinterlegter Referenz in diesem Monat.</p>'; }
      else {
        refWrap.innerHTML = '';
        refKeys.sort().forEach(function (ref) {
          var row = document.createElement('div'); row.className = 'ae-list-row flex items-center justify-between gap-4';
          row.innerHTML = '<span class="text-[#E0E0E0] text-sm">' + escapeHtml(ref) + '</span><span class="text-white text-sm font-semibold whitespace-nowrap">' + refMap[ref] + '×</span>';
          refWrap.appendChild(row);
        });
      }

      var kritischWrap = document.getElementById('aw-md-kritisch');
      var kritischListe = [];
      dates.forEach(function (iso) { entriesFor(iso, 'massnahme').forEach(function (en) { if (en.kritisch) kritischListe.push(en); }); });
      if (!kritischListe.length) { kritischWrap.innerHTML = '<p class="text-[#9CADC9] text-sm">Keine Vier-Augen-dokumentierten Maßnahmen in diesem Monat.</p>'; }
      else {
        kritischWrap.innerHTML = '';
        kritischListe.forEach(function (en) {
          var row = document.createElement('div'); row.className = 'ae-list-row';
          // Vier-Augen-Badge (gleiches Muster wie Verlauf-Liste, s. Zeile ~996) -- hier bisher gefehlt,
          // obwohl dieses Panel ausschliesslich Vier-Augen-Eintraege listet (Auftrag René 2026-09-20:
          // klare hervorgehobene Sichtbarkeit von Wichtigkeiten, bestehendes Muster weiterverwenden).
          row.innerHTML = '<span class="ae-badge-cat ae-badge-cat--kritisch mb-1">Vier-Augen</span>' +
            '<p class="text-white text-sm font-semibold">' + en.datum + ' · ' + en.uhrzeit + ' Uhr — ' + escapeHtml(en.label) + '</p>' +
            '<p class="text-[#9CADC9] text-xs">PFK: ' + escapeHtml(en.pfk) + ' · 2. PFK: ' + escapeHtml(en.pfk2 || '—') + (en.ref ? ' · ' + escapeHtml(en.ref) : '') + '</p>';
          kritischWrap.appendChild(row);
        });
      }
    }

    // ---------- Übergabemappe: Bestätigungs-Formular ----------
    var uebergabeCheck = document.getElementById('ae-uebergabe-check');
    var uebergabeStatus = document.getElementById('ae-uebergabe-status');
    uebergabeCheck.addEventListener('change', function () { uebergabeStatus.textContent = uebergabeCheck.checked ? 'Ja' : 'Ausstehend'; });
    document.getElementById('ae-uebergabe-form').addEventListener('submit', function (e) {
      e.preventDefault();
      showInlineNote(document.getElementById('ae-uebergabe-note'));
    });

    // ---------- Einstellungen ----------
    function renderEinstellungen() {
      document.getElementById('set-satz-pflege').value = AE.settings.satzPflege;
      document.getElementById('set-pauschale-aufnahme').value = AE.settings.pauschaleAufnahme;
      document.getElementById('set-iban').value = AE.settings.iban;
      document.getElementById('set-bic').value = AE.settings.bic;
      document.getElementById('set-kassenname').value = AE.settings.kassenname;
      document.getElementById('set-steuernr').value = AE.settings.steuernr;
      document.getElementById('set-finanzamt').value = AE.settings.finanzamt;
      document.getElementById('set-ti-ik').value = AE.settings.ti.ik;
      document.getElementById('set-ti-smcb').value = AE.settings.ti.smcbStatus;
      document.getElementById('set-ti-anbieter').value = AE.settings.ti.anbieter;
      document.getElementById('set-ti-endpunkt').value = AE.settings.ti.endpunkt;
      renderPfkList();
    }
    document.getElementById('einstellungen-form').addEventListener('submit', function (e) {
      e.preventDefault();
      AE.settings.satzPflege = parseFloat(document.getElementById('set-satz-pflege').value) || 105;
      AE.settings.pauschaleAufnahme = parseFloat(document.getElementById('set-pauschale-aufnahme').value) || 165;
      AE.settings.iban = document.getElementById('set-iban').value.trim();
      AE.settings.bic = document.getElementById('set-bic').value.trim();
      AE.settings.kassenname = document.getElementById('set-kassenname').value.trim();
      AE.settings.steuernr = document.getElementById('set-steuernr').value.trim();
      AE.settings.finanzamt = document.getElementById('set-finanzamt').value.trim();
      persist();
      document.getElementById('qc-p-pauschale').value = AE.settings.pauschaleAufnahme;
      showInlineNote(document.getElementById('set-note'));
    });
    // ---------- TI (Telematikinfrastruktur) -- reine Vorbereitungs-/Platzhalterstruktur, keine echte Anbindung. ----------
    document.getElementById('ae-ti-form').addEventListener('submit', function (e) {
      e.preventDefault();
      AE.settings.ti.ik = document.getElementById('set-ti-ik').value.trim();
      AE.settings.ti.smcbStatus = document.getElementById('set-ti-smcb').value;
      AE.settings.ti.anbieter = document.getElementById('set-ti-anbieter').value.trim();
      AE.settings.ti.endpunkt = document.getElementById('set-ti-endpunkt').value.trim();
      persist();
      showInlineNote(document.getElementById('set-ti-note'));
    });
    // Stub/Ansatzpunkt fuer eine kuenftige echte TI-Anbindung (Verordnungsabruf nach § 360 SGB V).
    // Wird aktuell NIRGENDS automatisch aufgerufen -- nur ueber den (visuell ausgegrauten) Button
    // "Verordnungen abrufen (TI)" erreichbar, und selbst dort wird NICHTS Echtes versucht.
    //
    // Was hier spaeter tatsaechlich einzubauen ist, sobald eine echte Anbindung existiert
    // (IK-Nummer + SMC-B-Karte + TI-Zugangsdienst-Vertrag sind dann bereits ausserhalb der App
    // eingerichtet, s. AE.settings.ti):
    //   1. Authentifizierung gegen den TI-Zugangsdienst des gewaehlten Anbieters
    //      (AE.settings.ti.anbieter) -- Verfahren/Protokoll ist anbieterabhaengig, i.d.R. ueber
    //      einen zertifizierten TI-Konnektor bzw. dessen Cloud-Pendant (TI-Gateway/VPN-Zugangsdienst).
    //   2. Verordnungsabruf ueber die vom gematik-Rahmenwerk vorgegebene FHIR-basierte
    //      Schnittstelle (E-Verordnung/eRP-Fachdienst bzw. das fuer § 360 SGB V zustaendige
    //      Fachmodul), Endpunkt s. AE.settings.ti.endpunkt.
    //   3. Fehlerbehandlung/Timeouts/Retry gegen den echten TI-Dienst, Mapping der FHIR-Ressourcen
    //      auf das AE-Datenmodell (entries/tage), Prüfung der SMC-B-Signatur.
    // Bis dahin bleibt dies ein reiner Platzhalter ohne Netzwerkaufruf.
    function aeTiVerordnungAbrufen() {
      if (!AE.settings.ti.endpunkt) {
        return { ok: false, meldung: 'TI nicht konfiguriert, keine Verbindung möglich.' };
      }
      // Absichtlich KEIN fetch() -- es existiert serverseitig keine echte TI-Anbindung.
      return { ok: false, meldung: 'TI-Vorbereitung vorhanden, aber keine echte Anbindung implementiert. Eine reale Verbindung erfordert IK-Nummer, SMC-B-Karte und einen zertifizierten TI-Zugangsdienst-Vertrag (s. Kommentar oben).' };
    }
    document.getElementById('ae-ti-abruf-btn').addEventListener('click', function () {
      var res = aeTiVerordnungAbrufen();
      var note = document.getElementById('ae-ti-abruf-note');
      note.textContent = res.meldung;
      showInlineNote(note);
    });
    function renderPfkList() {
      var wrap = document.getElementById('set-pfk-list'); wrap.innerHTML = '';
      AE.settings.pfks.forEach(function (pfk, idx) {
        var chip = document.createElement('span');
        chip.className = 'ae-badge-cat ae-badge-cat--beratung inline-flex items-center gap-2';
        chip.innerHTML = escapeHtml(pfk) + ' <button type="button" aria-label="' + escapeHtml(pfk) + ' entfernen" data-pfk-remove="' + idx + '" style="min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;">×</button>';
        wrap.appendChild(chip);
      });
    }
    document.getElementById('set-pfk-add-btn').addEventListener('click', function () {
      var input = document.getElementById('set-pfk-add-input');
      var val = input.value.trim();
      if (!val) return;
      AE.settings.pfks.push(val); input.value = ''; persist(); renderPfkList(); refreshPfkSelects();
    });
    document.getElementById('set-pfk-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pfk-remove]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.pfkRemove, 10);
      if (AE.settings.pfks.length <= 1) return;
      AE.settings.pfks.splice(idx, 1); persist(); renderPfkList(); refreshPfkSelects();
    });

    // ---------- Unterschrift-Overlay: eine wiederverwendbare Komponente fuer alle Signaturfelder ----------
    var sigOverlay = document.getElementById('ae-sig-overlay');
    var sigBackdrop = document.getElementById('ae-sig-backdrop');
    var sigTitle = document.getElementById('ae-sig-overlay-title');
    var sigCanvas = document.getElementById('ae-sig-canvas');
    var sigCtx = sigCanvas ? sigCanvas.getContext('2d') : null;
    var sigNote = document.getElementById('ae-sig-note');
    var sigClearBtn = document.getElementById('ae-sig-clear');
    var sigAddBtn = document.getElementById('ae-sig-add');
    var sigCancelBtn = document.getElementById('ae-sig-cancel');
    var sigDrawing = false;
    var sigHasContent = false;
    var sigCallback = null;

    function sigSetupCanvas() {
      if (!sigCanvas || !sigCtx) return;
      var rect = sigCanvas.getBoundingClientRect();
      // Fix 4 (security-privacy-Audit): Backing-Store-Aufloesung auf max. 2x gedeckelt statt volle
      // Geraete-DPR (z.B. 3x auf aktuellen iPhones) -- fuer eine Stift-Unterschrift voellig ausreichend,
      // reduziert aber die gespeicherte Pixelzahl und damit den Speicherbedarf spuerbar (bei DPR 3 z.B.
      // um ca. 55%), ohne dass die Unterschrift sichtbar unscharf wird.
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      sigCanvas.width = Math.max(1, Math.round(rect.width * dpr));
      sigCanvas.height = Math.max(1, Math.round(rect.height * dpr));
      sigCtx.setTransform(1, 0, 0, 1, 0, 0);
      sigCtx.scale(dpr, dpr);
      sigCtx.fillStyle = '#FFFFFF';
      sigCtx.fillRect(0, 0, rect.width, rect.height);
      sigCtx.strokeStyle = '#1A2536'; sigCtx.lineWidth = 2.5; sigCtx.lineCap = 'round'; sigCtx.lineJoin = 'round';
      sigHasContent = false;
    }
    function sigClear() {
      if (!sigCanvas || !sigCtx) return;
      var rect = sigCanvas.getBoundingClientRect();
      sigCtx.fillStyle = '#FFFFFF'; sigCtx.fillRect(0, 0, rect.width, rect.height);
      sigHasContent = false;
      if (sigNote) sigNote.classList.remove('ae-inline-note--visible');
    }
    function sigPos(e) { var rect = sigCanvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
    function sigStart(e) {
      if (!sigCtx) return;
      sigDrawing = true; sigHasContent = true;
      var p = sigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y);
      if (sigCanvas.setPointerCapture) { try { sigCanvas.setPointerCapture(e.pointerId); } catch (err) {} }
      e.preventDefault();
    }
    function sigMove(e) { if (!sigDrawing || !sigCtx) return; var p = sigPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); e.preventDefault(); }
    function sigStop() { sigDrawing = false; }
    sigCanvas.addEventListener('pointerdown', sigStart);
    sigCanvas.addEventListener('pointermove', sigMove);
    window.addEventListener('pointerup', sigStop);
    window.addEventListener('pointercancel', sigStop);

    function openSig(label, callback) {
      sigCallback = callback;
      sigTitle.textContent = 'Unterschrift — ' + label;
      if (sigNote) sigNote.classList.remove('ae-inline-note--visible');
      sigOverlay.classList.remove('ae-legal-hidden');
      sigBackdrop.classList.add('ae-legal-backdrop--visible');
      document.body.style.overflow = 'hidden';
      window.requestAnimationFrame(sigSetupCanvas);
      sigCancelBtn.focus();
    }
    function closeSig() {
      if (sigOverlay.classList.contains('ae-legal-hidden')) return;
      sigOverlay.classList.add('ae-legal-hidden');
      sigBackdrop.classList.remove('ae-legal-backdrop--visible');
      document.body.style.overflow = '';
      sigCallback = null;
    }
    sigCancelBtn.addEventListener('click', closeSig);
    sigOverlay.addEventListener('click', function (e) { if (e.target === e.currentTarget) closeSig(); });
    sigClearBtn.addEventListener('click', sigClear);
    sigAddBtn.addEventListener('click', function () {
      if (!sigHasContent) { showInlineNote(sigNote); return; }
      // Fix 4 (security-privacy-Audit): JPEG statt PNG fuer den Export -- die Unterschrift ist eine
      // einfarbige Strichzeichnung auf weissem Hintergrund (kein Transparenzbedarf), PNG ist dafuer
      // verlustfrei aber unnoetig gross. Qualitaet 0.85 haelt die Linie sichtbar scharf und reduziert
      // die Dateigroesse zusammen mit der DPR-Deckelung oben deutlich.
      var dataUrl = sigCanvas.toDataURL('image/jpeg', 0.85);
      var cb = sigCallback;
      closeSig();
      if (cb) cb(dataUrl);
    });
    document.addEventListener('keydown', function (e) {
      if (!sigOverlay || sigOverlay.classList.contains('ae-legal-hidden')) return;
      if (e.key === 'Escape') { closeSig(); return; }
      if (e.key === 'Tab') {
        var focusable = getFocusable(sigOverlay);
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // ---------- Signatur-Trigger (Privatleistung-Zustimmung, Übergabemappe x2): Klick öffnet openSig, Ergebnis wird ins Trigger-Feld geschwenkt ----------
    document.querySelectorAll('[data-signature-target], [data-signature-label]').forEach(function (btn) {
      if (!btn.hasAttribute('data-signature-label')) return;
      btn.addEventListener('click', function () {
        openSig(btn.dataset.signatureLabel || '', function (dataUrl) {
          btn.innerHTML = '<img src="' + dataUrl + '" alt="Unterschrift" class="ae-sig-trigger-img">';
          btn.classList.add('ae-sig-trigger--filled');
          var storeId = btn.dataset.signatureInput;
          var storeEl = storeId ? document.getElementById(storeId) : null;
          if (storeEl) storeEl.value = dataUrl;
          // Optionaler Zeitstempel je Signatur (z. B. getrennte Zeiten abgebende/uebernehmende PFK bei
          // Schicht gegenzeichnen) — additiv, nur aktiv wenn data-signature-timestamp-input gesetzt ist.
          var tsId = btn.dataset.signatureTimestampInput;
          var tsEl = tsId ? document.getElementById(tsId) : null;
          if (tsEl) { tsEl.value = new Date().toISOString(); btn.dispatchEvent(new Event('ae-signed', { bubbles: true })); }
          var ariaBase = btn.dataset.signatureAriaLabel || '';
          btn.setAttribute('aria-label', ariaBase + ', unterschrieben, zum Ändern tippen');
          var targetName = btn.dataset.signatureTarget;
          var typedInput = targetName ? document.querySelector('.ae-sig-type-input[data-signature-typed-for="' + targetName + '"]') : null;
          if (typedInput) typedInput.value = '';
        });
      });
    });
    // ---------- Getippter Name als Alternative zur gezeichneten Unterschrift ----------
    document.querySelectorAll('.ae-sig-type-input').forEach(function (input) {
      input.addEventListener('input', function () {
        var targetName = input.dataset.signatureTypedFor;
        var trigger = targetName ? document.querySelector('[data-signature-target="' + targetName + '"]') : null;
        if (!trigger) return;
        var storeId = trigger.dataset.signatureInput;
        var storeEl = storeId ? document.getElementById(storeId) : null;
        var ariaBase = trigger.dataset.signatureAriaLabel || '';
        var name = input.value.trim();
        if (name) {
          trigger.innerHTML = '';
          var span = document.createElement('span');
          span.className = 'ae-sig-trigger-typed';
          span.textContent = 'Elektronisch unterschrieben: ' + name;
          trigger.appendChild(span);
          trigger.classList.add('ae-sig-trigger--filled');
          trigger.setAttribute('aria-label', ariaBase + ', unterschrieben, zum Ändern tippen');
          if (storeEl) storeEl.value = 'TYPED:' + name;
        } else if (storeEl && storeEl.value.indexOf('TYPED:') === 0) {
          trigger.innerHTML = '<span class="ae-sig-trigger-placeholder">Zum Unterschreiben tippen</span>';
          trigger.classList.remove('ae-sig-trigger--filled');
          trigger.setAttribute('aria-label', ariaBase + ', zum Unterschreiben tippen');
          storeEl.value = '';
        }
      });
    });

    // ---------- Initialisierung ----------
    // Als Funktion extrahiert (Fix 5): laeuft einmal sofort gegen den leeren Platzhalter-AE (waehrend
    // das PIN-Gate ohnehin blickdicht alles verdeckt) und danach erneut mit den echten, entschluesselten
    // Daten, sobald aePinGateStart() eine erfolgreiche PIN-Eingabe gemeldet hat (s. finishUnlock() dort).
    function aeRunInit() {
      refreshPfkSelects();
      document.getElementById('qc-p-pauschale').value = AE.settings.pauschaleAufnahme;
      updateQcMassnahme();
      updateQcFahrtBadge();
      selectTypeTab('massnahme');
      renderHeute();
      renderVerlaufCalendar();
      renderEinstellungen();
      document.getElementById('aw-monat').value = todayIso().slice(0, 7);
      showView('heute');
      updateStorageIndicator();
    }
    aeRunInit();
    aePinGateStart();

    // ---------- Auto-Update-Erkennung (identisches Muster zu Arbeits-Zeitnachweis) ----------
    // Grund: Der Service-Worker-Cache aktualisiert sich auf diesem Gerät nicht zuverlaessig
    // automatisch (bestaetigter Befund 2026-09-26) -- daher zusaetzlich ein expliziter,
    // sichtbarer "Jetzt aktualisieren"-Hinweis, der die Seite hart neu laedt. localStorage
    // (die eigentlichen Klientendaten) bleibt davon unberuehrt, location.reload loescht nichts.
    var AKTUELLE_VERSION = '2026-10-02-002';
    function pruefeAufUpdate() {
      if (!navigator.onLine || !location.protocol.startsWith('http')) return;
      fetch(location.href.split('?')[0] + '?v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
        return res.text();
      }).then(function (txt) {
        var m = txt.match(/APP-VERSION:\s*([\w-]+)/);
        if (m && m[1] !== AKTUELLE_VERSION) {
          var banner = document.getElementById('updateBanner');
          if (banner) banner.style.setProperty('display', 'flex', 'important');
        }
      }).catch(function () {});
    }
    window.addEventListener('load', function () { pruefeAufUpdate(); setInterval(pruefeAufUpdate, 300000); });
  })();
