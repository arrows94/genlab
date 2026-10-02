# Erledigt

Was aus `TODO.md` fertig ist, steht hier als kurze Zusammenfassung – je Bereich, neueste Einträge oben. Einzelheiten,
Messreihen und Begründungen stehen in der Git-Historie (`git log -p TODO.md DONE.md`).

# Code-Durchsicht (Oktober 2026)

## 2026-10-02 – Schritt 4: Inhaltsprüfung aufgeteilt

- `validateContent` (615 → 141 Zeilen in `validate.ts`): Tabelle `CONTENT_VALIDATORS` mit 43 Prüfern
  (`validators.ts`, `rpgValidators.ts`) über einen gemeinsamen Prüf-Kontext (`checks.ts`); `as unknown as ContentDB`
  weg, ein begründetes `as ContentDB` bleibt
- Verhalten gleich geprüft: Referenz-Lauf über 57 883 kaputte und echte Inhaltsfälle (alle 81 Fehlerstellen, 100 %
  Zweige der alten Datei) – gleiche Meldungen, gleiche Reihenfolge, gleiche Abstürze, gleiche ContentDB

## 2026-10-02 – Schritt 4: Turm-Kampf aufgeteilt

- Kampf-Engine aus `tower.ts` (1 077 → 559 Zeilen) nach `core/features/towerCombat.ts`: ein Datensatz je Kämpfer
  (`Combatant`) statt paralleler Listen, `simulateFight` von 314 auf 61 Zeilen, Teilschritte als eigene Funktionen,
  `!` von 63 auf 4. `tower.ts` exportiert alles weiter, kein Aufrufer musste sich ändern
- Verhalten byte-gleich geprüft (Referenz-Lauf vorher/nachher: 420 Kämpfe in drei Balance-Varianten, Etagen 1–160,
  Bosse, Wächter, Techniken, Wut, Wochen-Boss und echte Turm-Läufe, inklusive RNG-Endstand)

## 2026-10-02 – Schritt 4: Oberfläche aufgeräumt

- Brutstation geteilt (709 → 537 Zeilen): `BreedingAutomat`, `NestCard`, `RitualReveal` (die Enthüllung ist jetzt
  ein richtiger Dialog mit `use:dialog`). Die Kandidatenliste war schon ein gemeinsames Snippet
- Turm-Tab: Etagen-Säule (`TowerFloors`) und Bestenliste (`TowerBoard`) als eigene Komponenten
- Farben: 82 feste Hex-Werte in Styles durch Tokens ersetzt (`color-mix` für Transparenz), neue Tokens `--relic`
  und `--crystal`; Werte in SVG-Attributen bleiben
- `use:meter` (`ui/meter.ts`): 20 Fortschrittsbalken melden sich als `progressbar` mit Wert, ohne Optikänderung

## 2026-10-02 – Schritt 4: Tests und Coverage

- Sync: Entscheidung beim Herunterladen als reine Funktion `decidePull` (`ui/platform/sync.ts`) mit Tests für alle
  Fälle (behalten, wiederherstellen, übernehmen, Konflikt, verlorene Antwort beim Schließen)
- Neue Testdateien `evolutionHybrids.test.ts` (11) und `infusionRecycler.test.ts` (13): alle bisher ungetesteten
  Exporte von `evolution.ts`, `hybrids.ts`, `infusion.ts`, `recycler.ts`; keine Fehler gefunden
- `npm run coverage` (`@vitest/coverage-v8`, nur core, content und Sync-Server): 92 % Anweisungen, 80 % Zweige,
  94 % Funktionen, 96 % Zeilen

## 2026-10-02 – Schritt 4: Qualität (zweiter Teil)

- Modifier-Text: `formatModifier` und `CHANCE_TARGET` in `core/format.ts`, genutzt von `describeModifier`,
  Kreaturen-Details, Forschung und Äon
- Spielregeln aus der Oberfläche nach core: `enrageFactor`, `floorsToBoss`, `nextMilestoneFloor` (Turm),
  Meilenstein-Tooltip aus `balance.tower.milestoneModifiers`, `recordShards` (Anomalien), `lineageDepth` in der
  Brutstation, `spliceBlocker` (Spleiß-Knopf zeigt den Grund als Tooltip)
- Kampf-Wiedergabe als reine Funktionen in `core/features/towerReplay.ts` (`timedEvents`, `finalState`,
  `fightSeconds`, `advanceReplay`, `gauge`, `upcomingActions`) mit Tests; im Browser geprüft

## 2026-10-02 – Schritt 4: Qualität (erster Teil)

- Doppelte Logik: `isOccupied(c)` (`core/creatures.ts`) statt sieben Kopien von „beschäftigt“ (totes `isBusy` weg),
  `isExpendable` in `features/stable.ts` für Recycling-Automat und Infusion
- `spend(ctx, cost)` / `missingText` (`core/resources.ts`): „Nicht genug Essenz – es fehlen 40.“ statt „Nicht genug
  Ressourcen.“ in Zucht, Sequenzierung, Spleißen, Markt, Kapseln, Expedition, Reise, Großforschung, Infusion,
  Forschung und im Zuchtautomaten. Ein gemeinsames `fail()` für alle 216 Fehler-Literale bringt nichts Sichtbares
  und blieb weg
- `mergeDefaults` prüft geladene Werte gegen den Typ des Standardwerts (Zahl, Text, Wahrheitswert, Liste, Decimal)
- Kleinigkeiten: README „Brutrituale (1–8 h)“, Job-Arten in CLAUDE.md, Job-Art `'lab'` entfernt,
  `JOURNEY_SEC` → `balance.missions.journeyHours`, tote Exporte (`ZERO`, `getNotation`, `isBusy`, `megaDone`,
  `recipesForPair`) entfernt

## 2026-10-02 – Schritt 4: Balancing

- Zeittrank: kostet 20 min Essenz-Produktion (mindestens den Grundpreis), jeder weitere Trank innerhalb einer Stunde
  das Doppelte (`balance.market.timeSkip*`, `state.timeSkips`, `recentTimeSkips`)
- Belohnungsboni (`contracts.reward`, `daily.reward`) vervielfachen Äon-Splitter, Zeitkristalle und
  Evolutionskristalle nicht mehr (`balance.rewards.unscaled`)
- Turm: Evolutionskristalle nur für eine neue höchste Etage (`floor > towerBestEver`); vorher zahlte der Rückzug beim
  Auto-Neustart dieselben Kristall-Etagen immer wieder
- Reisende überstehen Vererbung und Äon weiter, beginnen aber neu: Infusion, Trank-Boni, Linie und Heldenstufe weg.
  Der Unterricht der Wochenexpedition hält die Kraftfutter-Grenze ein (`maxStatBoost`)
- Spleißen: Instabilität nie unter 5 % (`splicing.minInstability`)
- Dynastien zahlen zusammen höchstens 25 Äon-Splitter (`dynasty.maxShards`, `dynastyShardsEarned`)
- Äon-Bot über 14 Tage (Seed wie im Test) vorher/nachher: Äonen, Talente, Observatorium, Relikte und Rang Tag für
  Tag gleich; nur Tag 14 weicht durch den Zufall ab (Turm 195 statt 198)

## 2026-10-02 – Schritt 3: Leistung und Bedienung

- Rechenlast: Listen, Kosten und Filter rechnen im langsamen Takt (`view.slowFrame`) statt alle 100 ms – Labor
  (Liste und Karten), Brutstation (nur Ei-Fortschritt schnell, `nests`), Turm (nur Countdown schnell, `timing`), Dex,
  Reiter-Zähler in `App.svelte`, `DnaSequence`, `EvolvePanel`. Aktionen aktualisieren sofort (`refresh` erhöht beide)
- Dialoge: gemeinsame Aktion `use:dialog` (`ui/dialog.ts`) – Fokus hinein, Fokusfalle, Escape, Fokus zurück – in
  allen neun Dialogen; Schließen nur bei Klick auf den Hintergrund. Im Browser geprüft (Playwright)
- Reduzierte Bewegung: Der Schimmer schillernder Kreaturen (SVG-`<animate>`) entfällt bei `prefs.reduceMotion`.
  Die CSS-Regel für `prefers-reduced-motion` bleibt, wie sie ist: `loadPrefs` übernimmt die Systemeinstellung beim
  ersten Start ohnehin als Option
- Favoriten-Knopf mit `aria-label` und `aria-pressed`
- Handy-Breite: `ContractsTab` und Markt-Knopf mit `min(100%, …)`; alle Tabs mit voll freigeschaltetem Spielstand bei
  320 px geprüft – kein Überlauf; Vererbung: Bonuszeilen bekamen große Zahlen abgeschnitten, Beschriftung steht jetzt
  darüber. Die Expeditions-Karte scrollt absichtlich in ihrem Rahmen
- Fehlermeldungen: `ui/errors.ts` (`errorText`) übersetzt Browser-Fehler („Failed to fetch“, `NotAllowedError` …)
  für Toasts, Sync und Laden/Speichern
- Zahlen: `formatNumber`/`formatPercent` statt `toFixed` und `Math.round(x * 100) %` in Äon, Dex, Turm, RPG

## 2026-10-02 – Schritt 2: Sync-Server und CI abgesichert

- Sync-Server: Rate-Limits je IP über Workers-Bindings (`LIMITER` 60/min, `CREATE_LIMITER` 5 neue Spielstände/min,
  sonst `429`), Body wird nur bis 512 KB + 1 KB gelesen (`readLimited`, unabhängig von `Content-Length`), Gerätename
  ohne Steuerzeichen, `savedAt` höchstens einen Tag in der Zukunft, `history` aus D1 abgesichert gelesen, optionale
  `ALLOWED_ORIGINS` für CORS (Standard weiter `*`). Konfiguration mit `wrangler deploy --dry-run` geprüft
- CI: `pages.yml`, `android.yml`, `desktop.yml` und `sync-server.yml` führen vor Build bzw. Deploy `npm test` aus;
  `wrangler` fest auf 4.146.0

## 2026-10-02 – Schritt 1: weitere Fehler (bestätigt und behoben)

- Recycling-Automat schont das Paar des Zuchtautomaten auch bei vollem Stall (`planAutoBreed(ctx, { ignoreRoom })`)
- Offline-Nachholen: Die Uhr (`lastTickAt`) läuft während der Schritte vom Beginn bis zum Ende der Abwesenheit mit
  (über die gedeckelte Spanne verteilt) – Wochen-Mutation, Entschlossenheit, Tage und Wochen wechseln zur richtigen
  Zeit; `simulateOffline` lässt die Uhr wie bisher. Neues `weeklySystem` macht den Modifier-Cache beim Wochenwechsel
  ungültig
- `breakthrough` lehnt die Ziel-Kreatur als eigenen Partner ab
- `resetLayer` leert `earned` erst am Ende: RPG-Beute und Talent-Startvorräte zählen nicht als Einkommen des neuen Laufs
- Scheitert das Recyceln einer vom Spieler geschickten Kreatur, meldet das Ereignis `recycleFailed` den Grund (Toast)

## 2026-10-02 – Schritt 1: bestätigte Fehler

- Sequenzier-Roboter nimmt keine Kreaturen mehr, die auf dem Weg in den Gen-Recycler sind (`autoSequenceOnce`)
- Wochen-Boss: Jeder verpasste Tag bringt seine Angriffe (bis zur Obergrenze), nicht nur der letzte
- Wochen-Boss-Exploit geschlossen: „Turm-Rekord senken“ baut den Titan nie unter den Etagen der letzten Turm-Läufe
  (`titanFloor` aus `tower.history`), auch nicht zum Wochenwechsel
- Zwillingsgeburten: Ein Hybrid-Zwilling bekommt das Werteprofil seiner Art (`reprofileStats`) und zählt für die
  Dynastie (`recordLineage`)
- Recycler: Eine kürzere Dauer (Forschung während eine Kreatur in der Kammer liegt) gibt keine Gratis-Zeit mehr
- `removeCreature` und `repairReferences` räumen über dasselbe `pruneCreatureRefs` auf (auch `tower.back`, `rpg.run`)
- Kreaturen-Karte liest Favorit, Job, Recycler-Status, Name, Linie und Fähigkeiten im Takt neu (`live` in
  `CreatureCard.svelte`). Die vermutete „veraltete Karte“ bestand im Browser nicht (die alte Karte wechselte den
  Stern ebenfalls sofort) – die Änderung macht die Abhängigkeit nur ausdrücklich

# Visuelle Überarbeitung

Anlagen als Szenen mit arbeitenden Kreaturen, Forschungsbaum nach Themen (Pips, Abhängigkeiten, „nur bezahlbare“),
Vererbungs-Übersicht mit Zeitleiste (`prestigeLog`, auch im Äon-Tab über `PrestigeOverview.svelte`), Markt-Tresen,
Monster-Dex mit Sammlung und Detailkarte, Sequenzierer und Genbibliothek, einheitliche Kopfzeilen (`.tab-head` /
`.kpis` / `.kpi`), Seltenheit am Kartenrahmen, Anomalien mit Fortschritt (`conditionProgress`).

# Komfort

Zuchtbuch ↻ (`state.lastPair`), zwei Zuchtlisten (`prefs.breedingSplit`), Warnung, wenn eine Art aus dem Stall
verschwindet (`speciesLostWith`; kein fester Schutz im Recycling-Automaten – „je Art behalten“ regelt das), Reiter in
Bereichen (`GROUPS`, `viewState.nav`), Fortschrittsleiste am Reiter (`core/tabActivity.ts`), Handy-Dock (`--dock-h`).
Fehler behoben: Spielstand als Svelte-Proxy (jetzt `$state.raw`), `.maxed` verbreiterte die Seite.

# Endgame

Vorhanden: Vererbung + Äon mit Talentbaum (5 Stufen + Resonanz), endloser Genom-Turm mit Relikten und Meilensteinen,
3 unendliche Forschungen, Anomalien mit Stufen I–V, 12 Wochen-Mutationen, Perfektions-Jagd im Dex, Urgen,
Gen-Aufträge, Stammbaum-Dynastien.

Erledigt: Gen-Aufträge (Auftragspool mit Stufen, Äon-Splitter und Genproben), Talentstufe 4/5 und Resonanz
(Stufe^0,7), Splitter-Tempo über fünf 28-Tage-Läufe abgestimmt (zuletzt 6 Äonen, 12 Talente, Resonanz 8, an Tag 28
nichts übrig), Boss-Eigenheiten, Relikte (×2,2 je Stufe), Turm-Meilensteine, Anomalien mit Stufen, Kombinationen und
Rekord-Bonus (Ziele wachsen mit dem Produktionsbonus), Dynastien (`lineage`, `dynasties`, Äon-Talent).

Idee „Isekai mit einem ausgewählten Monster“ → umgesetzt als „GenLab RPG“.

# Langzeitmotivation (Idle über Tage und Wochen)

Zeitskalen gestaffelt statt alles verlängert – lange Projekte nach echter Uhr (Offline-Grenze nur für die
Produktion), Benachrichtigungen (Capacitor, optional PWA), Tagesreise, Wochenexpedition, Besondere Brut,
Tiefensequenzierung, Gen-Tagesaufträge, Treue-Kalender, Zeitkristalle, Großforschung, Sequenzier-Roboter,
Wochen-Boss, Großprojekt Äon-Observatorium. Leitplanken in `tests/guardrails.test.ts` (alles über 1 h braucht eine
Vererbung, lange Projekte sind nie Sperre), Langzeit-Bot in `tests/longrun.ts`.

# Sound

Sound-Modul `ui/sound.ts` (Rezepte in `SOUNDS`, Drosselung, stumm offline und im Hintergrund), Zuordnung in
`ui/soundEvents.ts`, Klänge für alle Bereiche (Zucht, Genetik, Wirtschaft, Erkundung, Turm, Endgame), Optionen mit
Lautstärke und einzeln abschaltbaren Klängen, Hintergrundmusik je Bereich (`ui/music.ts`).

# Kampfsystem

Aktionsleiste statt Runden (Tempo zählt, Ausweichen), Wut ab 30 s statt Zeitlimit, skalenfreie Verteidigung
(1 + `defWeight` × VER/ANG), Reihen und Rollen (`roleOf`), Element-Techniken und Zustände, Team-Synergien,
Kampf-Eigenschaften aus der Genetik, mehrere Gegner und Boss-Begleiter, Wochen-Boss auf derselben Kampf-Logik
(der Bot spart seine Angriffe bis vor Vererbung/Äon), Arena mit Wiedergabe-Tempo, Kampfprotokoll und
Niederlagen-Auswertung (`analyzeDefeat`, `tower.lastDefeat`). Kämpfe bleiben deterministisch und offline schnell.

# Turm: Stillstand abbauen, feinere Etagen

- **Schritt 1 – Etagen ×3** (Etage 3n = alte Etage n, Kampfpause 4 s, Migration `SAVE_VERSION` 9 → 10, Wächter
  alle 10 Etagen, drei kleine Etagen teilen Element und Gruppengröße, Offline-Kämpfe ohne Wiedergabe-Daten)
- **Schritt 2 – Boss-Mauer abflachen**: Boss kostet jetzt Ø 3,7 frühere Etagen statt 9,9 (Schild ohne Vorteil 5,4–7,0),
  Mauer-Test `tests/towerCurve.test.ts` (`GENLAB_CURVE=1`)
- **Schritt 3 – Kampferfahrung** 🎖 (`tower.xp`, je Etage proportional zur Höhe, Boss ×10; Rang n → n + 1 kostet
  100 × (1 + 9n), je Rang +2 % KP und Schaden, Modifier-Ziel `tower.hp`, `towerVeteranProvider`) und
  **Entschlossenheit** 💪 (+15 % je Tag ohne neuen Rekord, höchstens +60 %), Anzeige in der Kopfzeile und in
  „Warum verloren?“
- **Rückzug beim Auto-Neustart** (`tower.retreat`, `restartCheckpoint`): Verliert ein Lauf gleich die erste Etage,
  beginnt der nächste Auto-Neustart einen Checkpoint tiefer; eine geschaffte Checkpoint-Etage holt ihn wieder hoch,
  ein Start von Hand versucht den echten Checkpoint. Befund vorher (Äon-Bot, Seed 2024): Nach jeder Vererbung verlor
  das Team am Checkpoint sofort – an Stillstands-Tagen bis zu 17 000 Läufe ohne einen Sieg und ohne Erfahrung,
  Rang 34 an Tag 28. Nachher: jeden Tag 13 000–40 000 gewonnene Etagen, Rang 61 an Tag 28
- **Wochen-Titan nachgestellt**: ANG ×0,5 statt ×1,5, KP ×15 statt ×25. Vorher warf er ein Team in 7–8 s um, der
  Schaden je Angriff fiel zwischen Titan-Etage 120 und 175 auf ein 85stel (gleiches Team); mit ×0,5 hält ein Team
  nahe am Rekord fast die ganzen 30 s durch, der Abfall ist halb so steil. Äon-Bot je Woche ab Woche 2:
  Seed 2024 100 / 100 / 81 % (vorher 100 / 51 / 5 %), Seed 7 92 % (74 %), Seed 99 100 % (36 %)

Verworfen (vorerst): Stärke-Zuwachs nur beim Vererben aus dem Rekord des Laufs – wächst in groben Sprüngen
(1–2 Vererbungen am Tag) und belohnt nicht, dass man an einer Mauer weiterkämpft.

# Brut

Ritual-Eier bleiben fertig im Nest liegen, bis der Spieler sie öffnet (`ProcessHandler.waitsForPlayer`,
`openRitualEgg`, Enthüllungs-Animation, Zähler am Reiter); der Zuchtautomat öffnet sie nicht, der Test-Bot schon.

# GenLab RPG

Isekai-Umbau (Stufe 1 aus den Grundwerten der Art, Stufe bleibt dem Monster, eigene Welt ohne Labor,
Portal-Animation, dunkles Design, eigene Musik und Kampfmusik), Rundenkampf mit drei Fähigkeiten und Spezialangriff,
sichtbares Kampfende (Sieg-Zusammenfassung bis „Weiter“, Niederlage mit Verlusten; `run.aftermath`, `lastResult.fight`),
Dungeons aus Räumen mit Wegwahl, Ereignissen und Stufen-Verbesserungen, Fackeln 🔥 als Eintritt (Nachfüllen nach
echter Uhr, Tagesbelohnung, Gen-Aufträge, Wochenexpedition), Beute mit Wochen-Deckel, Ausrüstung (wirkt nicht im
Turm), Runen 🪬 und dauerhafte Verbesserungen, Test-Bot `tests/rpgBot.ts`, Debug-Werkzeuge (`?debug=1`).
Freischaltung ab Turm-Etage 20. Leitplanken: freiwillig, deterministisch, alte Spielstände ohne Migration.

Bot-Stand (ohne Ausrüstung und Runen): Glutwelpe schafft alle Dungeons in 45–70 Läufen (Stufe ~50), Zephyrix in
120–165, Magmaulwurf (Hybrid) in 20–47; die Stufe beim Sieg liegt nahe der Boss-Stufe (Glutgrotten 17, Flutgewölbe 24,
Sturmspitze 32, Schattengruft ~42). 60–800 Turm-Marken je Fackel.
