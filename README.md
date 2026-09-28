# Genlab

Browser-Idle-Game rund um Kreaturenzucht und Genetik. TypeScript (strict) + Vite + Svelte 5, große Zahlen mit `break_infinity.js`, Tests mit Vitest.

Die vollständige Projektbeschreibung steht in [`genlab-neubau-prompt.md`](genlab-neubau-prompt.md).

## Starten

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Entwicklungsserver (http://localhost:5173)
npm test         # Unit-Tests (Vitest)
npm run check    # Typprüfung (svelte-check / tsc)
npm run build    # Typprüfung + Produktions-Build nach dist/ (inkl. PWA)
npm run desktop:dev    # Desktop-App (Tauri, braucht Rust)
npm run android        # Android-Projekt in Android Studio öffnen
```

Der Build nutzt relative Pfade (`base: './'`) und läuft damit auch per `file://` bzw. in Tauri/Capacitor.

## Als App verpacken

| Ziel | Technik | Befehl lokal | Automatisch (GitHub Actions) |
|---|---|---|---|
| Web-App zum Installieren (PWA) | `vite-plugin-pwa` | `npm run build` → `dist/` hosten | `pages.yml`: bei jedem Push auf `main` nach GitHub Pages |
| Windows, macOS, Linux | [Tauri 2](https://tauri.app) (`src-tauri/`) | `npm run desktop:dev` / `npm run desktop:build` | `desktop.yml`: bei Tag `v*` oder manuell → Entwurfs-Release mit Installern |
| Android | [Capacitor 8](https://capacitorjs.com) (`android/`) | `npm run android` (öffnet Android Studio) | `android.yml`: bei Tag `v*` oder manuell → Debug-APK als Artefakt |
| iOS | Capacitor (`ios/`) | `npm run ios` (öffnet Xcode, nur auf dem Mac) | – (braucht Mac + Apple-Developer-Konto) |

**Benachrichtigungen** (Optionen, standardmäßig aus): Die Handy-Apps planen beim Wechsel in den Hintergrund lokale Benachrichtigungen beim System (Capacitor Local Notifications, ohne Server) – z. B. „Expedition zurück“ oder „Offline-Maximum erreicht“. Im Browser/PWA erscheinen sie nur, solange der Tab im Hintergrund geöffnet bleibt; Tauri hat keine. Planung in `core/notices.ts`, Plattform in `ui/platform/notify.ts`.

**Spielstände:** Browser und Desktop speichern im `localStorage` (bei Tauri dauerhaft im App-Profil). Die Handy-Apps nutzen Capacitor Preferences (Android SharedPreferences, iOS UserDefaults), weil das System den WebView-Speicher löschen kann; ein vorhandener Browser-Spielstand wird beim ersten Start übernommen. Export/Import (Optionen) funktioniert überall – so lässt sich ein Spielstand zwischen Geräten umziehen.

### Einmalige Einrichtung

- **PWA / GitHub Pages:** Repository → *Settings → Pages → Source: GitHub Actions*. Danach ist das Spiel unter `https://arrows94.github.io/genlab/` erreichbar und lässt sich im Browser „installieren“ bzw. „Zum Startbildschirm hinzufügen“. Es läuft danach auch offline; neue Versionen werden per Hinweis angeboten.
- **Desktop lokal bauen:** [Rust](https://rustup.rs) plus Systempakete ([Tauri-Voraussetzungen](https://tauri.app/start/prerequisites/): Windows WebView2 + MSVC Build Tools, macOS Xcode Command Line Tools, Linux `libwebkit2gtk-4.1-dev`). Installer landen in `src-tauri/target/release/bundle/`. Ohne Code-Signing warnen Windows (SmartScreen) und macOS (Gatekeeper) beim ersten Start.
- **Android lokal bauen:** Android Studio + JDK 21. `npm run android`, dann *Build → Build APK(s)*. Für Google Play ein signiertes AAB: Keystore anlegen und als Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` hinterlegen – dann baut `android.yml` zusätzlich ein Release-AAB.
- **iOS:** Mac mit Xcode, `npm run ios`, Signing-Team in Xcode wählen. Für den App Store ist ein Apple-Developer-Konto nötig.
- **Icons ändern:** `resources/icon.png` (1024 × 1024) ersetzen, dann `npx tauri icon resources/icon.png` (Desktop) und `npx @capacitor/assets generate --iconBackgroundColor '#071317' --splashBackgroundColor '#071317' --android --ios` (Handy). Die PWA-Icons liegen in `public/icons/`.
- **Nach Code-Änderungen für die Handy-Apps:** `npm run mobile:sync` kopiert den aktuellen Build in `android/` und `ios/`.

## Spielen

Alles startet mit einer Kreatur und dem „Sammeln“-Knopf. Neue Systeme schalten sich nach und nach frei (Farm → Brutstation → Mine → Erkundung → Bio-Labor → Infusion → Sequenzierung → Gen-Aufträge → Markt → Gen-Recycler → Hybride → Vererbung → Genom-Turm → Anomalien → Äon). Der Spielstand wird automatisch im Browser gespeichert; unter **Optionen** lässt er sich als Text oder Datei sichern und auf einem anderen Gerät wieder einspielen.

## Architektur

```
src/
  core/        reine Spiellogik – kein DOM, keine UI-Imports, vollständig testbar
    content/   Content-Interfaces, Balance-Typ, Validierung
    systems/   Tick-Systeme (Produktion, Prozesse, Buffs, Freischaltungen)
  content/     alle Spielinhalte als Daten + balance.ts
  ui/          Svelte-Komponenten, liest nur State und ruft Aktionen auf
tests/         Vitest-Tests für die Core-Logik
```

| Baustein | Datei | Kurz |
|---|---|---|
| Inhalte + Validierung | `core/content/types.ts`, `core/content/validate.ts` | Jede Inhaltsart hat ein Interface; beim Start werden IDs, Querverweise, Modifier-Ziele und Bedingungen geprüft. Fehler → lesbare Liste, z. B. `species[emberpup].element: unbekannte elements-id "lava"`. |
| Balancing | `content/balance.ts` | Alle Tuning-Zahlen (Tick, Offline-Cap, Wahrscheinlichkeiten, Prestige-Formel …). |
| Modifier-System | `core/modifiers.ts`, `core/providers.ts` | `(Basis + Σadd) × (1 + Σpct) × Πmult` pro Ziel (`production.gold`, `breeding.time` …). Jede Bonusquelle ist ein Provider; neue Boni = neue Daten. |
| Simulation | `core/game.ts` | Feste Zeitschritte (`tickMs`). Offline-Fortschritt nutzt dieselbe `step()`-Funktion mit gröberen Schritten, gedeckelt (12 h + `offline.capHours`). Laufende Prozesse und Buffs folgen darüber hinaus der echten Uhrzeit (`systems/timers.ts`), ohne Produktion und ohne neue Ketten. |
| Zeitprozesse | `core/systems/processes.ts` | Generische Prozesse (Ei, Mission, Sequenzierung …) mit Handler je `kind`. |
| Event-Bus | `core/events.ts`, `core/gameEvents.ts` | Typisierte Events; Statistiken, Erfolge und UI-Toasts hängen sich an. |
| Speichern | `core/save.ts` | Versionierte Spielstände (`saveVersion` + Migrationen), Default-Merge für neue Felder, Export/Import als Text (`GENLAB1:…`), austauschbarer `SaveStorage`. |
| Zufall | `core/rng.ts` | Seedbarer RNG (mulberry32), Zustand im Spielstand → reproduzierbar. |
| Prestige | `core/prestige.ts` | Reset-Umfang ist reine Daten (`PrestigeLayerDef.resets`). |
| Spielsysteme | `core/features/` | Brutstation, Erkundung, Markt, Sequenzierung, Splicing, Zuchtplaner – registrieren ihre Zeitprozesse selbst. |
| Gen-Aufträge | `core/features/contracts.ts`, `content/contracts.ts` | Tägliches Auftragsbrett (Seed aus Spielstand + Tag, kein Server). Vorlagen mit offenen Parametern werden aus Genbibliothek und Dex gewürfelt; erfüllte Aufträge heben die Auftragsstufe. |
| Erbanlagen | `core/features/deepSequencing.ts`, `content/latent.ts` | Verborgene, vererbbare Eigenschaften (etwa jede dritte Kreatur); die Tiefensequenzierung (8 h, Sequenzierer-Platz) deckt sie auf und aktiviert sie. |
| Besondere Brut | `core/features/breeding.ts`, `content/rituals.ts` | Brutrituale (4–24 h) mit höherer Hybrid-Chance, Mindestseltenheit oder mehr Mutation; belegen Nest und Eltern. |
| Wochenexpedition | `core/features/voyage.ts`, `content/voyages.ts` | 7-Tage-Reise mit Team (bis 3), Ereignissen pro Tag und einer Entscheidung bei der Rückkehr. Ziel wechselt wöchentlich und folgt dem Element der Wochen-Mutation. |
| Endgame | `core/features/tower.ts`, `talents.ts`, `anomalies.ts`, `weekly.ts` | Turm als System (läuft offline weiter), Talente/Anomalien/Wochen-Mutation als Modifier-Provider. |
| Genetik | `core/genetics.ts` | Ausprägung (dominant/rezessiv/kodominant), Mendel-Vererbung, Genom-Modifier, sichtbarer Phänotyp. Neue Gene in alten Spielständen werden beim Laden automatisch ergänzt. |

## Balancing prüfen

`tests/progression.test.ts` lässt einen einfachen Bot die erste Spielstunde spielen und prüft, ob die Systeme in der richtigen Reihenfolge freigeschaltet werden und mindestens alle 8 Minuten etwas Neues passiert. Die Zeitleiste lässt sich ausgeben:

```bash
GENLAB_TIMELINE=1 npx vitest run tests/progression.test.ts --silent=false
```

Wie man Inhalte hinzufügt, steht in [`CONTENT.md`](CONTENT.md).

## Stand

- [x] **Phase 1 – Fundament**: Setup, Ordnerstruktur, Content-Interfaces + Validierung, Modifier-System, Tick/Offline, Save/Load/Migration, Event-Bus, Tests, spielbares Grundgerüst (Sammeln, Farm/Mine, Forschung, Dex, Statistik, Vererbung, Export/Import)
- [x] **Phase 2 – Portierung**: Brutstation (Vererbung von Werten, Aussehen, Fähigkeiten, Mutation, mehrere Nester), Erkundung (Camps, Beute, wilde Kreaturen), Bio-Labor, Markt (Kraftfutter, Turbo-Trank, Festmahl, Zeitkristall), Fähigkeiten in Stufen, vollständiger Forschungsbaum inkl. Dex-Freischaltungen, langsamer Start mit schrittweisen Freischaltungen, Tab-Badges
- [x] **Phase 3 – Genetik**: 9 Gen-Loci mit dominanten, rezessiven und kodominanten Allelen, Mendel-Vererbung mit Mutation, verborgene Genome + Sequenzierlabor, Genbibliothek, Gen-Splicing mit Instabilität, Zuchtplaner, DNA-Darstellung
- [x] **Phase 4 – Arten & Hybride**: 12 Basisarten (ein Element je Art), 10 Hybride, 7 seltene Hybride, 4 mythische Endformen; Rezepte mit Bedingungen, Hinweise über Forschung/Erkundung, Evolution mit Evolutionskristallen, Regionen mit eigenen Arten, Dex-Stammbaum
- [x] **Phase 5 – Management & Verwertung**: Filter/Sortierung/Suche, Favoriten, Stall mit Kapazität, Verkauf und Recycling (einzeln/Stapel), Arbeitsplaner und Zuchtautomat, Detailansicht (Bonus-Aufschlüsselung, Genom, Stammbaum), Rekorde, Infusion mit Allel-Übertragung und Durchbruch, Gen-Kapseln mit offenen Chancen und Pity-System
- [x] **Phase 6 – Endgame**: Genom-Turm (Auto-Kampf mit Elementen, Kontrollpunkte, Bestenliste, Turm-Marken), Äon-Prestige mit Talentbaum (Zwillinge, Urgen-Locus, dauerhafte Automatik, größeres Team), Perfektions-Jagd (perfektes Genom, Schillernd, mythische Formen), Anomalien, unendliche Forschung, Wochen-Mutation
- [x] **Phase 7 – Feinschliff**: Balancing-Durchgang (multiplikative Produktions-Forschung, Erbgut-Bonus, Brutkosten, Bot-Tests bis zur Vererbung), Animationen (schwebende Zahlen, Einblenden, Tab-Übergänge, schlüpfende Eier) mit Option „Weniger Animationen“, Mobile-Layout (wischbare Ressourcen- und Tab-Leiste, einklappbare Filter), Export/Import als Text oder Datei, wissenschaftliche Zahlen
