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
- [ ] Turm-Stillstand im Äon-Bot (8–13 Tage ohne Fortschritt) – wird unter „Turm: Stillstand abbauen“ bearbeitet
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
  Mauer-Test `tests/towerCurve.test.ts` (`GENLAB_CURVE=1`). Äon-Bot: Seed 2024 Etage 198 statt 149

Der Stillstand bleibt trotzdem: Fortschritt gibt es nur am Höhepunkt eines Durchlaufs, nach jeder Vererbung fängt der
Stall von vorn an (Seed 7: 149 ab Tag 4; Seed 2024: 174 an Tag 10–18, 198 ab Tag 19). Dafür ist Schritt 3 da.

## Reste aus Schritt 1 und 2

- [ ] Auf dem Handy nachmessen, wie lange das Laden nach 12 h mit Dauerkampf (Auto-Neustart) dauert
- [ ] Wochen-Boss nachstellen: Der Titan folgt dem jetzt höheren Rekord – ab Woche 2 schafft der Bot nur noch 0–11 %
      (einmal 47 %), vorher meist 100 %. `weeklyBoss.hpMult` (25) oder die Etage des Titans (z. B. Rekord minus einige
      Etagen) mit dem Äon-Bot neu einstellen

## Schritt 3 – Kampferfahrung (Turm-Stärke, die jede Vererbung und jedes Äon übersteht)

Jeder Sieg im Turm bringt Erfahrung, sie gehört dem Spieler (wie Relikte) und macht jedes künftige Turm-Team stärker.
Wer an einer Mauer hängt und mit Auto-Neustart weiterkämpft, kommt dadurch langsam, aber sicher weiter.

- [ ] Erfahrung: 1 je gewonnene Etage, 10 je Boss (Startwerte); auch offline. Sie übersteht Vererbung und Äon
      (`tower.xp` im Spielstand, neue Felder mit Standardwert – keine Migration)
- [ ] Ränge: Rang n → n + 1 kostet 100 × 1,15ⁿ Erfahrung (Startwerte). Je Rang +2 % KP und +2 % Schaden im Turm und
      gegen den Wochen-Boss. Grober Takt im Stillstand (etwa 900 Etagen pro Stunde mit 4 s): Rang ~20 nach einem Tag,
      ~30 nach drei, ~40 nach zwölf – die Kosten wachsen schneller als die Erfahrung, Zucht bleibt der Hauptweg
- [ ] Neues Modifier-Ziel `tower.hp` (in `fighterFor` wie `tower.damage`); die Kampferfahrung als eigener
      `ModifierProvider`
- [ ] Kalibrieren mit dem Äon-Bot (28 Tage): Stillstände zusammen mit Schritt 2 höchstens etwa 3 Tage; an Tag 28 macht
      die Kampferfahrung höchstens etwa ein Drittel der Turm-Stärke aus
- [ ] Anzeige: Rang, Balken bis zum nächsten Rang und aktuelle Wirkung in der Kopfzeile des Turms; in „Warum
      verloren?“ ein Hinweis, dass Weiterkämpfen Erfahrung bringt
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
