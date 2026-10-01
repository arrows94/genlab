# TODO

Erledigtes steht je Abschnitt nur noch als kurze Zusammenfassung. Einzelheiten, Messreihen und Begründungen stehen
in der Git-Historie (`git log -p TODO.md`).

# Visuelle Überarbeitung – abgeschlossen

Anlagen als Szenen mit arbeitenden Kreaturen, Forschungsbaum nach Themen (Pips, Abhängigkeiten, „nur bezahlbare“),
Vererbungs-Übersicht mit Zeitleiste (`prestigeLog`, auch im Äon-Tab über `PrestigeOverview.svelte`), Markt-Tresen,
Monster-Dex mit Sammlung und Detailkarte, Sequenzierer und Genbibliothek, einheitliche Kopfzeilen (`.tab-head` /
`.kpis` / `.kpi`), Seltenheit am Kartenrahmen, Anomalien mit Fortschritt (`conditionProgress`).

# Komfort – abgeschlossen

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

## Offen

- [ ] Gen-Aufträge: kosmetische Muster als Belohnung (braucht neue Muster im Kreaturen-SVG)
- [ ] Weitere Splitter-Quellen bei Bedarf (siehe „Ideen“ und Genom-Keller)
- [ ] Turm-Stillstand im Äon-Bot (jetzt 4–8 Tage) – siehe „Turm: Stillstand abbauen“ → Offen
- [ ] Test-Bot: klügere Anomalie-Wahl (einzelne Anomalie eine Stufe höher statt immer alle zusammen), damit der
      Äon-Lauf nicht mit zwölfstündigen Fehlversuchen Vererbungen verliert
- [ ] Dynastien-Balancing: Ohne gezielte Zucht erreicht der Bot Tiefe 11 und 9 Stufen (+9 % Produktion) bis Tag 23,
      keine Splitter. Tempo der hohen Stufen und Splitter-Ertrag erst messen, wenn der Bot das Zuchtautomat-Ziel
      „Reine Linie vertiefen“ nutzt

## Später

- [ ] **Tiefenexpedition**: endlose Region, mit jeder Tiefe gefährlicher und lohnender
      (mit dem RPG-Dungeon und dem Genom-Keller abgleichen – nicht drei „immer tiefer“-Systeme)
- [ ] **Dritte Prestige-Stufe** (z. B. „Genesis“) – erst, wenn Äon ausgereizt ist
- [ ] **Endgame-Erfolge und Statistiken** als Langzeitziele (alle 198 Dex-Einträge, Etage 200 …)

## Ideen (noch grob)

Mögliche neue Splitter-Quellen – vor dem Umsetzen Umfang, Freischaltung und Splitter-Ertrag festlegen.

- [ ] **Basebuilding / Worldbuilding / Universebuilding**
- [x] ~~Isekai mit einem ausgewählten Monster~~ → umgesetzt als „GenLab RPG“

# Langzeitmotivation (Idle über Tage und Wochen)

Erledigt: Zeitskalen gestaffelt statt alles verlängert – lange Projekte nach echter Uhr (Offline-Grenze nur für die
Produktion), Benachrichtigungen (Capacitor, optional PWA), Tagesreise, Wochenexpedition, Besondere Brut,
Tiefensequenzierung, Gen-Tagesaufträge, Treue-Kalender, Zeitkristalle, Großforschung, Sequenzier-Roboter,
Wochen-Boss, Großprojekt Äon-Observatorium. Leitplanken in `tests/guardrails.test.ts` (alles über 1 h braucht eine
Vererbung, lange Projekte sind nie Sperre), Langzeit-Bot in `tests/longrun.ts`.

- [ ] Benachrichtigungen auf echtem Android-/iOS-Gerät testen (Statusleisten-Icon, Erlaubnis-Dialog, Zustellung nach
      App-Schließen)

# Sound

Erledigt: Sound-Modul `ui/sound.ts` (Rezepte in `SOUNDS`, Drosselung, stumm offline und im Hintergrund), Zuordnung in
`ui/soundEvents.ts`, Klänge für alle Bereiche (Zucht, Genetik, Wirtschaft, Erkundung, Turm, Endgame), Optionen mit
Lautstärke und einzeln abschaltbaren Klängen, Hintergrundmusik je Bereich (`ui/music.ts`).

- [ ] Alle Klänge einmal mit echten Ohren durchhören (Lautstärke untereinander, nervt etwas auf Dauer?) – bisher nur
      fehlerfrei im Browser abgespielt
- [ ] Falls Tondateien: lizenzfreie Quellen dokumentieren, als `.ogg` klein halten, nicht in den Service-Worker-Precache

# Kampfsystem – abgeschlossen

Aktionsleiste statt Runden (Tempo zählt, Ausweichen), Wut ab 30 s statt Zeitlimit, skalenfreie Verteidigung
(1 + `defWeight` × VER/ANG), Reihen und Rollen (`roleOf`), Element-Techniken und Zustände, Team-Synergien,
Kampf-Eigenschaften aus der Genetik, mehrere Gegner und Boss-Begleiter, Wochen-Boss auf derselben Kampf-Logik
(der Bot spart seine Angriffe bis vor Vererbung/Äon), Arena mit Wiedergabe-Tempo, Kampfprotokoll und
Niederlagen-Auswertung (`analyzeDefeat`, `tower.lastDefeat`). Kämpfe bleiben deterministisch und offline schnell.

# Turm: Stillstand abbauen, feinere Etagen und Genom-Keller

Erledigt:
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

## Offen

- [ ] Stillstände sind kürzer, aber nicht weg (Ziel: höchstens etwa 3 Tage). Äon-Bot mit Rückzug und neuem Titan:
      Seed 2024 (28 Tage) 135 an Tag 8–12, 171 an Tag 20–27 (8 Tage); Seed 7 (10 Tage) 149 ab Tag 4 (vorher 143 an
      Tag 10), Seed 99 172 ab Tag 6 (vorher 153). Befund an der Mauer (Bot-Team bei Rekord 172, Rang 58): Etage 173
      braucht Faktor 1,15, Etage 175 (ein Wasser-Gegner gegen ein Erde/Feuer-Team) 1,98, Boss 180 2,21 – die Mauern
      sind jetzt vor allem Element-Spitzen, weil der Bot-Stall fast nur aus einer oder zwei Arten besteht. Möglich:
      Bot-Zucht vielfältiger (näher am echten Spieler), Entschlossenheit höher deckeln, oder „Veteranen“-Talent
- [ ] Auf dem Handy nachmessen, wie lange das Laden nach 12 h mit Dauerkampf (Auto-Neustart) dauert
- [ ] Optional: Äon-Talent „Veteranen“ (+50 % Erfahrung) oder ein Resonanz-Knoten, damit auch das Äon den Turm
      spürbar beschleunigt

Verworfen (vorerst): Stärke-Zuwachs nur beim Vererben aus dem Rekord des Laufs – wächst in groben Sprüngen
(1–2 Vererbungen am Tag) und belohnt nicht, dass man an einer Mauer weiterkämpft.

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
    Systeme bauen, die alle „immer tiefer“ sind
- [ ] Technik: `features/tower.ts` so verallgemeinern, dass Turm und Keller aus Daten entstehen (Definitionen in
      `content/endgame.ts`, Richtung auf/ab) statt einer Kopie des Turm-Codes
- [ ] Arena im Keller-Stil (Gewölbe, Fackellicht, dunkle Farben, Gegner-Tönung); Ebenen zählen nach unten (−1, −2 …)

# Brut – abgeschlossen

Ritual-Eier bleiben fertig im Nest liegen, bis der Spieler sie öffnet (`ProcessHandler.waitsForPlayer`,
`openRitualEgg`, Enthüllungs-Animation, Zähler am Reiter); der Zuchtautomat öffnet sie nicht, der Test-Bot schon.

# GenLab RPG (ein Monster, aktiver Dungeon)

Erledigt: Isekai-Umbau (Stufe 1 aus den Grundwerten der Art, Stufe bleibt dem Monster, eigene Welt ohne Labor,
Portal-Animation, dunkles Design, eigene Musik und Kampfmusik), Rundenkampf mit drei Fähigkeiten und Spezialangriff,
Dungeons aus Räumen mit Wegwahl, Ereignissen und Stufen-Verbesserungen, Fackeln 🔥 als Eintritt (Nachfüllen nach
echter Uhr, Tagesbelohnung, Gen-Aufträge, Wochenexpedition), Beute mit Wochen-Deckel, Ausrüstung (wirkt nicht im
Turm), Runen 🪬 und dauerhafte Verbesserungen, Test-Bot `tests/rpgBot.ts`, Debug-Werkzeuge (`?debug=1`).
Freischaltung ab Turm-Etage 20. Leitplanken: freiwillig, deterministisch, alte Spielstände ohne Migration.

Bot-Stand (ohne Ausrüstung und Runen): Glutwelpe schafft alle Dungeons in 45–70 Läufen (Stufe ~50), Zephyrix in
120–165, Magmaulwurf (Hybrid) in 20–47; die Stufe beim Sieg liegt nahe der Boss-Stufe (Glutgrotten 17, Flutgewölbe 24,
Sturmspitze 32, Schattengruft ~42). 60–800 Turm-Marken je Fackel.

## Offen

- [ ] Idee zum Überlegen: Die Stufe hängt an der **Art** statt an der einzelnen Kreatur – dann übersteht sie jeden
      Neustart, und ein neuer Glutwelpe knüpft an den alten an. Frage: Lohnt sich dann noch ein zweites Monster
      derselben Art, und wird der Dex zum „Helden-Buch“?
- [ ] Weitere Fackel-Quellen (Wochen-Boss, Turm-Meilensteine) – erst nach Rückmeldungen zur Fackel-Menge
- [ ] Im Kristallkern steigt ein Monster sehr schnell (Gegner Stufe 56+ geben viel Erfahrung) – beobachten
- [ ] Übergang von „schafft es nie“ zu „schafft es immer“ ist noch steil – mehr Streuung?
- [ ] Debug-Werkzeuge bei Bedarf erweitern: Turm, Äon/Talente, Anomalien, Zucht

## Weitere Ideen

- [ ] Tages-Dungeon: feste Karte für alle Läufe des Tages, eigene Bestenliste im Spielstand
- [ ] Dungeon-Fundstück: Ei einer Art, die es nur dort gibt (neuer Dex-Eintrag)
- [ ] Gefährten-Ereignis: ein zweites Monster hilft für ein paar Runden
- [ ] „Tiefenexpedition“ (Endgame → Später) mit diesem Dungeon zusammenlegen statt getrennt bauen
