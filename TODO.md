# TODO

Hier steht nur Offenes. Was fertig ist, wandert als kurze Zusammenfassung nach `DONE.md` (gleicher Bereich, neueste
Einträge oben) und wird hier gestrichen – `tests/todo.test.ts` prüft das. Einzelheiten, Messreihen und Begründungen
stehen in der Git-Historie (`git log -p TODO.md DONE.md`).

# Code-Durchsicht (Oktober 2026)

Ergebnis einer Durchsicht des ganzen Codes am 2026-10-02 (`svelte-check` ohne Befund, alle Tests grün). Abgearbeitet
wird in der Reihenfolge der Schritte. „(ungeprüft)“ = aus der Durchsicht, vor dem Beheben einzeln bestätigen.

## Schritt 3 – Leistung und Bedienung

- [ ] Schwere Ableitungen von `view.frame` auf `view.slowFrame` (LabTab, BreedingTab, TowerTab, DexTab, Badges in
      `App.svelte`); nur Fortschrittsbalken brauchen den schnellen Takt. Je Karte ein Schnappschuss statt fünf
      Ableitungen, `CreatureSvg` nicht zehnmal pro Sekunde neu zeichnen
- [ ] Gemeinsame `Modal`-Komponente (Fokus beim Öffnen, Fokusfalle, Escape, Fokus zurück) für die neun handgebauten
      Dialoge (`CreatureDetail`, `OfflineModal`, `WhatsNew`, `DexTab`, `RecyclerTab` …)
- [ ] Reduzierte Bewegung: Schimmer schillernder Kreaturen (`<animate>` in `CreatureSvg.svelte:62`) und
      `prefers-reduced-motion` auch für die Dauer (`styles.css:95`)
- [ ] Favoriten-Knopf mit `aria-label` und `aria-pressed` (`CreatureCard.svelte`)
- [ ] Handy-Breite: `ContractsTab` `minmax(270px, …)`, Expeditions-Karte `min-width: 560px`, `.confirm button`
      `min-width: 12rem` im Markt; Tabs ohne Media-Query (Äon, Aufträge, Markt, Vererbung, Optionen, Statistik)
- [ ] Englische Fehlertexte („Failed to fetch“) in Toasts auf Deutsch abbilden (`SettingsTab.svelte:76`,
      `SyncPanel.svelte:36`, `sync.svelte.ts:117`)
- [ ] Zahlen über `core/format.ts`: `toFixed(2)` in `AeonTab.svelte:56`, Prozent ohne `formatPercent` in
      `TowerTab`, `RpgWorld`, `DexTab`; Modifier-Text einmal in core statt dreimal in der Oberfläche

## Schritt 4 – Balancing und Features (erst Richtung festlegen)

Spiellogik (ungeprüft):
- [ ] Zeittrank kostet fest 10 Essenz und spult alle Prozesse unter 1 h vor – Kosten mit der Produktion skalieren
      oder Abklingzeit; Festmahl und Turbo ebenso (`content/potions.ts`, `features/market.ts:45`)
- [ ] Belohnungs-Multiplikator vervielfacht auch Äon-Splitter, Zeitkristalle und Katalysator; Trank-Buffs blähen die
      „Minuten Produktion“ auf (`core/rewards.ts:26`)
- [ ] Evolutionskristalle im Turm nur beim ersten Mal (Rückzug lässt Kristall-Etagen wiederholen,
      `features/tower.ts:961`) – vorher mit dem Äon-Bot messen
- [ ] Reisende überstehen Vererbung und Äon mit allem Fortschritt; `teamBoost` der Reise umgeht die
      Kraftfutter-Grenze (`features/voyage.ts:175`)
- [ ] Spleißen wird risikolos (Instabilität 0,25 − 0,20 − 0,05 = 0) – Untergrenze ~5 % (`features/splicing.ts:39`)
- [ ] Dynastie-Splitter je Art (bis 165) – deckeln oder je Element (`balance.ts` `shardsPerTier`)
- [ ] Ohne Quelle: `slots.ritualNest`, `infusion.transferChance`, `cost.potion`, `cost.capsule`, `cost.upgrade`,
      Ritual-`rarityBoost`, Job-Art `'lab'`

Qualität:
- [ ] Spielregeln aus der Oberfläche nach core: Zahlen im Tooltip `TowerTab.svelte:476`, Wut-Faktor `:530`,
      `newShards` in `AnomaliesTab`, `lineage` in `BreedingTab`, `canSplice` in `SplicingBench` (besser
      `spliceBlocker()` mit Grund), Kampf-Wiedergabe aus `TowerTab` nach `towerReport.ts`
- [ ] Große Dateien teilen: `simulateFight` (314 Zeilen, 40 `!`) in `towerCombat.ts` mit einem Datensatz je Kämpfer,
      `validateContent` als Tabelle, `TowerTab.svelte` und `BreedingTab.svelte` in Teilkomponenten
- [ ] Doppelte Logik: eine `busyReason(c)` statt sieben Kopien (totes `isBusy`), ein `isExpendable` statt zwei, ein
      gemeinsames `fail()` und `spend()` mit der fehlenden Ressource im Text
- [ ] Tests: `evolution.ts`, ungetestete Exporte in `hybrids.ts` / `infusion.ts` / `recycler.ts`, Sync-Entscheidung
      aus `doPull` als reine Funktion testen, Coverage-Report
- [ ] `mergeDefaults` prüft Typen gegen den Standardwert; `viewState` generisch zusammenführen
- [ ] Gestaltung: feste Hex-Farben (~90) durch Tokens ersetzen (Glow, Relikt, Kristall), gemeinsame `<Meter>`- und
      `<CreatureTile>`-Komponenten
- [ ] Kleinigkeiten: README „Brutrituale (4–24 h)“ stimmt nicht (1/3/8 h), Job-Arten in CLAUDE.md unvollständig,
      `JOURNEY_SEC` nach `balance.ts`, tote Exporte (`ZERO`, `getNotation`, `isBusy`, `megaDone`, `recipesForPair`)

# Endgame

- [ ] Gen-Aufträge: kosmetische Muster als Belohnung (braucht neue Muster im Kreaturen-SVG)
- [ ] Weitere Splitter-Quellen bei Bedarf (siehe „Ideen“ und Genom-Keller)
- [ ] Turm-Stillstand im Äon-Bot (jetzt 4–8 Tage) – siehe „Turm: Stillstand abbauen“
- [ ] Test-Bot: klügere Anomalie-Wahl (einzelne Anomalie eine Stufe höher statt immer alle zusammen), damit der
      Äon-Lauf nicht mit zwölfstündigen Fehlversuchen Vererbungen verliert
- [ ] Dynastien-Balancing: Ohne gezielte Zucht erreicht der Bot Tiefe 11 und 9 Stufen (+9 % Produktion) bis Tag 23,
      keine Splitter. Tempo der hohen Stufen und Splitter-Ertrag erst messen, wenn der Bot das Zuchtautomat-Ziel
      „Reine Linie vertiefen“ nutzt
- [ ] Wiederholbare Langzeitziele, wenn Anomalien, Talente und Großprojekt ausgereizt sind (Ideen aus der
      Durchsicht: „Anomalie der Woche“, wöchentliche Zuchtschau, zweites Großprojekt als Senke für Runen und Marken,
      das `slots.ritualNest` und `infusion.transferChance` eine Quelle gibt)

## Später

- [ ] **Tiefenexpedition**: endlose Region, mit jeder Tiefe gefährlicher und lohnender
      (mit dem RPG-Dungeon und dem Genom-Keller abgleichen – nicht drei „immer tiefer“-Systeme)
- [ ] **Dritte Prestige-Stufe** (z. B. „Genesis“) – erst, wenn Äon ausgereizt ist
- [ ] **Endgame-Erfolge und Statistiken** als Langzeitziele (alle 198 Dex-Einträge, Etage 200 …)

## Ideen (noch grob)

Mögliche neue Splitter-Quellen – vor dem Umsetzen Umfang, Freischaltung und Splitter-Ertrag festlegen.

- [ ] **Basebuilding / Worldbuilding / Universebuilding**

# Langzeitmotivation (Idle über Tage und Wochen)

- [ ] Benachrichtigungen auf echtem Android-/iOS-Gerät testen (Statusleisten-Icon, Erlaubnis-Dialog, Zustellung nach
      App-Schließen)

# Sound

- [ ] Alle Klänge einmal mit echten Ohren durchhören (Lautstärke untereinander, nervt etwas auf Dauer?) – bisher nur
      fehlerfrei im Browser abgespielt
- [ ] Falls Tondateien: lizenzfreie Quellen dokumentieren, als `.ogg` klein halten, nicht in den Service-Worker-Precache

# Turm: Stillstand abbauen und Genom-Keller

- [ ] Stillstände sind kürzer, aber nicht weg (Ziel: höchstens etwa 3 Tage). Äon-Bot mit Rückzug und neuem Titan:
      Seed 2024 (28 Tage) 135 an Tag 8–12, 171 an Tag 20–27 (8 Tage); Seed 7 (10 Tage) 149 ab Tag 4 (vorher 143 an
      Tag 10), Seed 99 172 ab Tag 6 (vorher 153). Befund an der Mauer (Bot-Team bei Rekord 172, Rang 58): Etage 173
      braucht Faktor 1,15, Etage 175 (ein Wasser-Gegner gegen ein Erde/Feuer-Team) 1,98, Boss 180 2,21 – die Mauern
      sind jetzt vor allem Element-Spitzen, weil der Bot-Stall fast nur aus einer oder zwei Arten besteht. Möglich:
      Bot-Zucht vielfältiger (näher am echten Spieler), Entschlossenheit höher deckeln, oder „Veteranen“-Talent
- [ ] Auf dem Handy nachmessen, wie lange das Laden nach 12 h mit Dauerkampf (Auto-Neustart) dauert
- [ ] Optional: Äon-Talent „Veteranen“ (+50 % Erfahrung) oder ein Resonanz-Knoten, damit auch das Äon den Turm
      spürbar beschleunigt

## Genom-Keller (Gegenstück zum Turm, ersetzt die Idee „Dunkler Turm“)

Statt eines zweiten Turms geht es nach unten: ein Keller unter dem Genom-Turm, der mit jedem Sieg eine Ebene tiefer
wird. Thematisch das Gegenteil des Turms – dunkel, feucht, Gewölbe statt Himmel.

- [ ] **Begrenzte Versuche** statt Dauerkampf: Muster wie beim Wochen-Boss (`attemptsPerDay` / `maxAttempts`), Zahlen
      in `balance.ts`. Ein Versuch = ein Abstieg ab dem letzten Kontrollpunkt, bis das Team fällt
- [ ] **Schalter mit Animation** zum Wechsel zwischen Turm und Keller: im Turm-Tab ein Umschalter (▲ Turm / ▼ Keller);
      beim Wechsel fährt die Ansicht durch den Boden nach unten bzw. zurück nach oben (Aufzug oder Wendeltreppe),
      `.reduce-motion` = sofortiger Wechsel. Der zuletzt gewählte Bereich bleibt in `viewState`
- [ ] Grundidee festlegen – Vorschläge:
  - Eigener Tiefen-Rekord, eigene Kontrollpunkte, eigenes Team (eine Kreatur steht nie in Turm und Keller zugleich)
  - Härtere Regeln: steilere Gegner-Kurve, Schatten-Aura (Heilung halbiert), mehr Boss-Merkmale,
    oder eine wöchentlich wechselnde Regel
  - Freischaltung: Etage 150 im Turm (neue Zählung) oder erster Äon
  - Belohnung: eigene Währung (z. B. „Schattenmarken“) für dunkle Relikte – und eine weitere Äon-Splitter-Quelle
  - Überschneidung mit der „Tiefenexpedition“ (Endgame → Später) und dem Dungeon im GenLab RPG prüfen – nicht drei
    Systeme bauen, die alle „immer tiefer“ sind. Vorschlag aus der Durchsicht: Keller = endloser RPG-Modus mit
    Heldenstufe je Art; Schattenmarken für dunkle Relikte, die auch im Turm wirken
- [ ] Technik: `features/tower.ts` so verallgemeinern, dass Turm und Keller aus Daten entstehen (Definitionen in
      `content/endgame.ts`, Richtung auf/ab) statt einer Kopie des Turm-Codes
- [ ] Arena im Keller-Stil (Gewölbe, Fackellicht, dunkle Farben, Gegner-Tönung); Ebenen zählen nach unten (−1, −2 …)

# GenLab RPG

- [ ] Idee zum Überlegen: Die Stufe hängt an der **Art** statt an der einzelnen Kreatur – dann übersteht sie jeden
      Neustart, und ein neuer Glutwelpe knüpft an den alten an. Frage: Lohnt sich dann noch ein zweites Monster
      derselben Art, und wird der Dex zum „Helden-Buch“? (Durchsicht: Heute löscht jede Vererbung die Stufe, und
      Rarität, Gene und Infusion wirken im RPG nicht – das RPG ist vom Zucht-Kern abgekoppelt)
- [ ] Gene im RPG wirken lassen (reinerbige Spitzen-Allele, latente Merkmale als Dungeon-Vorteile)
- [ ] Runen-Senke: Nach etwa 1 300 Runen gibt es nichts mehr zu kaufen
- [ ] Weitere Fackel-Quellen (Wochen-Boss, Turm-Meilensteine) – erst nach Rückmeldungen zur Fackel-Menge
- [ ] Im Kristallkern steigt ein Monster sehr schnell (Gegner Stufe 56+ geben viel Erfahrung) – beobachten
- [ ] Übergang von „schafft es nie“ zu „schafft es immer“ ist noch steil – mehr Streuung?
- [ ] Debug-Werkzeuge bei Bedarf erweitern: Turm, Äon/Talente, Anomalien, Zucht

## Weitere Ideen

- [ ] Tages-Dungeon: feste Karte für alle Läufe des Tages, eigene Bestenliste im Spielstand
- [ ] Dungeon-Fundstück: Ei einer Art, die es nur dort gibt (neuer Dex-Eintrag)
- [ ] Gefährten-Ereignis: ein zweites Monster hilft für ein paar Runden
- [ ] „Tiefenexpedition“ (Endgame → Später) mit diesem Dungeon zusammenlegen statt getrennt bauen
