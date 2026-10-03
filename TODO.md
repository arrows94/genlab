# TODO

Hier steht nur Offenes. Was fertig ist, wandert als kurze Zusammenfassung nach `DONE.md` (gleicher Bereich, neueste
Einträge oben) und wird hier gestrichen – `tests/todo.test.ts` prüft das. Einzelheiten, Messreihen und Begründungen
stehen in der Git-Historie (`git log -p TODO.md DONE.md`).

# Code-Durchsicht (Oktober 2026)

Ergebnis einer Durchsicht des ganzen Codes am 2026-10-02 (`svelte-check` ohne Befund, alle Tests grün). Abgearbeitet
wird in der Reihenfolge der Schritte. „(ungeprüft)“ = aus der Durchsicht, vor dem Beheben einzeln bestätigen.

## Schritt 4 – Balancing und Qualität

Spiellogik (ungeprüft):
- [ ] Ohne Quelle: `infusion.transferChance`, `cost.capsule`, `cost.upgrade`,
      Ritual-`rarityBoost` (geplant: Tiefen-Meilensteine des Genom-Kellers, Schritt 5; sonst ein zweites Großprojekt)

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

- [ ] **Tiefenexpedition**: endlose Region, mit jeder Tiefe gefährlicher und lohnender – kein eigenes System, sondern
      mit dem RPG-Dungeon zusammenlegen (Abgrenzung zum Genom-Keller siehe dort)
- [ ] **Dritte Prestige-Stufe** (z. B. „Genesis“) – erst, wenn Äon ausgereizt ist
- [ ] **Endgame-Erfolge und Statistiken** als Langzeitziele (alle 198 Dex-Einträge, Etage 200 …)

## Ideen (noch grob)

Mögliche neue Splitter-Quellen – vor dem Umsetzen Umfang, Freischaltung und Splitter-Ertrag festlegen.

- [ ] **Basebuilding / Worldbuilding / Universebuilding**

# Gen-Aufträge

Ideen aus dem Tester-Feedback (Oktober 2026). Schon umgesetzt: Ruf, Ausrüstung, Veteranen, Leihgaben.

- [ ] Weitere Bedingungen: reine Linie ab Tiefe N, bestimmte Erbanlage (Tiefensequenzierung), schillernd (seltener
      5★-Bonusauftrag), Infusionsstufe ab N
- [ ] Lieferaufträge: Rohstoffe gegen andere Rohstoffe tauschen (z. B. Fragmente gegen Evolutionskristalle) – könnte
      auch den Markt beleben
- [ ] Eilaufträge: laufen nach wenigen Stunden ab, dafür mehr Belohnung
- [ ] Wochenauftrag: ein großer Auftrag pro Woche zum Element der Wochen-Mutation
- [ ] Ruf je Auftraggeber: Stammkunden geben ab N erfüllten Aufträgen eigene Boni oder einen Titel
- [ ] Auftragsketten: mehrstufige Geschichte eines Auftraggebers mit Lore und Abschlussbelohnung
- [ ] Ruf-Schwellen prüfen: Mit dem wachsenden Brett erreicht der Langzeit-Bot Ruf 4 an Tag 11 (vorher nie);
      `balance.contracts.levelThresholds` ggf. anheben

# Zucht: Fähigkeiten stärken

Nestwärter, gezieltere Vererbung und das Fähigkeits-Elixier mit Keimöl sind umgesetzt.

- [ ] Keimöl-Menge beobachten: Ritual 30 %, Auftrag 4★ 1 / 5★ 2, Wochenexpedition selten – Elixier II kostet 2,
      Elixier III 6 Keimöl

# Tester-Feedback (Oktober 2026)

Offene Punkte aus den Kommentaren von Rexodeus; die übrigen sind umgesetzt (PR #51).

- [ ] „Markt“ – beim Tester nachfragen, was gemeint ist
- [ ] Animierte Szenen für die großen Erkundungen (Wolkengrat, Nebelmoor, Wochenexpedition), nach dem Vorbild des
      Großprojekts

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

**Grundidee (festgelegt 2026-10-03): „Gen-Keller“ – die Ebenen verlangen Genetik.** Der Turm misst rohe Kampfkraft,
der Keller misst, wie gut ein Team an seine Umgebung *angezüchtet* ist. Das soll zwei Schwächen des Spiels angehen:
Der Turm belohnt Einfalt (Bot-Stall aus ein, zwei Arten, Mauern sind Element-Spitzen), und Gene, Farbe und latente
Merkmale wirken außerhalb der Produktion kaum.

- **Kampf:** Turm-Engine (`simulateFight`), automatisch und idle-tauglich – kein RPG-Modus mit Steuerung von Hand
- **Begrenzte Versuche** wie beim Wochen-Boss (`attemptsPerDay` / `maxAttempts`, neuer Tag → neue Versuche). Ein
  Versuch = ein Abstieg ab dem letzten Kontrollpunkt, bis das Team fällt; läuft im Hintergrund, Wiedergabe wie in der
  Turm-Arena
- **Erschöpfung:** KP tragen sich über die Ebenen weiter (`FightResult.stats.hpLeft`) – der Turm prüft jede Etage
  einzeln, der Keller die Ausdauer des Teams. Rast-Gewölbe heilen; **Fackellicht** sinkt je Ebene (darunter ein
  Treffer-Malus) und füllt sich in der Rast wieder
- **Umgebungen** je Abschnitt (z. B. alle 10 Ebenen), fest je Ebene wie die Boss-Merkmale, dazu eine wöchentlich
  wechselnde Regel passend zur Wochen-Mutation. Ideen:
  - *Finsternis*: Treffer-Malus; Farb-Allele *Dunkel* / *Albino* werden zu Höhlen-Anpassungen
  - *Überflutet*: Wasser/Eis stärker, Feuer schwächer
  - *Sporennebel*: Gift jede Runde, reinerbige *Unermüdlich* (Aᵉ) sind immun
  - *Schatten-Aura*: Heilung halbiert
  - *Einsturz*: Flächenschaden auf die hintere Reihe
  - *Vielfalts-Siegel*: jede Art nur einmal im Team
- **Gegner:** die „verworfenen Linien“ – misslungene Experimente aus der Frühzeit des Labors. Alle 30 Ebenen der Boss
  **„Schatten deiner Dynastie“**: eine dunkle Kopie der meistgezüchteten Art des Spielers, mit deren Genen
- **Belohnungen:** eigene Währung **Schattenmarken** für **dunkle Relikte** (Vorteil mit Nachteil, z. B. +30 % ANG,
  −10 % KP), die in Turm *und* Keller wirken – hilft gegen den Turm-Stillstand. **Tiefen-Meilensteine** als dauerhafte
  Boni und Quelle für die quellenlosen Werte aus der Code-Durchsicht (`infusion.transferChance`, Ritual-`rarityBoost`,
  `cost.capsule`). Äon-Splitter an Meilensteinen mit Wochen-Deckel wie im RPG. Später **Höhlenformen**: blasse,
  augenlose Varianten bekannter Arten (Dex oder Kosmetik)
- **Freischaltung:** Etage 150 im Turm (dort steht schon der Erfolg „Turmstürmer“; liegt im Äon-Bot an der ersten
  Mauer – mit dem Bot prüfen)
- **Eigenes Team**, eigener Tiefen-Rekord und eigene Kontrollpunkte; eine Kreatur steht nie in Turm und Keller
  zugleich. Rekord, Schattenmarken und dunkle Relikte überstehen jede Vererbung und jedes Äon
- **Atmosphäre – etwas Eigenes, weder Turm noch RPG-Welt:** Der Turm ist das saubere Labor (Violett, Petrol, Himmel),
  die RPG-Welt Fantasy (Pergament, Messing, Glut). Der Keller ist das **verlassene, überwucherte Labor darunter** –
  schaurig und böse, aber nicht blutig:
  - *Farben:* eigene Tokens – Schwarzgrün (`--abyss`), fahles Biolumineszenz-Grün (`--bile`), Rost, Knochenweiß;
    Rot nur für Augen in der Dunkelheit
  - *Lichtkegel:* Die Szene ist schwarz, nur ein flackernder Fackelkreis ist sichtbar – sein Radius folgt dem
    Fackellicht, die Spielregel ist also direkt zu sehen. Ohne Flackern bei `.reduce-motion`
  - *Gegner aus der Dunkelheit:* erst nur leuchtende Augen, die Gestalt zeigt sich beim Angriff
  - *Kulisse:* Gewölbe, tropfendes Wasser, zerbrochene Zuchttanks mit trübem Inhalt, Adern in den Wänden, die im
    Herzschlag pulsieren, Bodennebel, verblichene Laborschilder, Kratzspuren
  - *Umgebungen sichtbar:* Überflutet = steigende Wasserlinie, Sporennebel = grüne Schwebeteilchen, Finsternis =
    kleinerer Lichtkegel, Einsturz = Staub und Risse
  - *Boss „Schatten“:* das SVG der eigenen Art schwarz und verzerrt, mit glühenden Augen
  - *Ebenen* als Schacht nach unten mit Tiefenmesser (−1, −2 …) statt der Etagen-Liste des Turms
- **Musik – eigene Stimmung `cellar`** (live mit Web Audio wie `ui/music.ts`, keine Dateien). Kein Akkordwechsel wie
  bei den anderen Stimmungen, sondern Gruselklang; dafür bekommt `MoodDef` neue Bausteine:
  - *Atmender Drone:* zwei tiefe, leicht verstimmte Töne, die langsam gegeneinander schweben; ab und zu ein Tritonus
  - *Kaputte Spieluhr:* ein Wiegenlied aus der Frühzeit des Labors, verstimmt, stockend, bleibt manchmal stehen
  - *Geräusche im Raum* zu zufälligen Zeiten: Tropfen mit Hall, knarrendes Metall, fernes Klopfen, Flüstern
    (gefiltertes Rauschen)
  - *Mit der Tiefe* mehr Dissonanz; bei wenig Licht oder schwachem Team ein Herzschlag
  - *Boss „Schatten“:* die Melodie der Brutstation, verlangsamt und nach Moll verbogen – das dunkle Spiegelbild
  - `moodFor` wählt `cellar`, solange der Umschalter auf ▼ Keller steht
- **Klänge** (`ui/sound.ts`, je Rezept mit Drossel in `LIMITS` und in `SOUND_GROUPS` zum Probehören): Aufzug-Fahrt
  (Seil, Schleifen, dumpfer Aufprall), Ebene geschafft (dumpfer Gong), Fackel flackert / erlischt, Rast (Feuer
  knistert), neue Umgebung, Boss erscheint (anschwellendes Grollen), Niederlage (absinkender Cluster), neuer Versuch
  bereit
- **Abgrenzung:** Turm = rohe Kraft eines Teams, Dauerkampf. Keller = Anpassung eines Teams, begrenzte Abstiege.
  RPG-Dungeon = ein Held, von Hand. Die „Tiefenexpedition“ wird kein eigenes System, sondern mit dem RPG-Dungeon
  zusammengelegt

### Schritte

- [ ] **Schritt 2 – Grundgerüst Keller** (`features/cellar.ts`): Strecke `cellar` über `features/floors.ts` (eigener
      Würfel-Präfix, eigene `FloorCurve` in `balance.cellar`; Name, Richtung ab und Einheit „Ebene“ als Definition in
      `content/endgame.ts`), `state.cellar` (Team, Reihen, Lauf, Rekord, Versuche
      mit Zeitstempel, Verlauf), Job `{ kind: 'cellar' }` (in `isOccupied`, `pruneCreatureRefs`), Feature `cellar` in
      `progression.ts` (Bedingung `towerFloor` 150), Versuche wie in `weeklyBoss.ts` (neuer Tag → neue
      Versuche, auch offline), Abstieg mit
      Erschöpfung und Rast-Gewölben, Kontrollpunkte, `registerResetSurvivor`/Prestige-`resets` prüfen, Debug-Reset in
      `core/debug.ts`. Noch ohne Umgebungen und eigene Belohnungen (vorläufig Turm-Marken). Tests
      `tests/cellar.test.ts` inkl. Offline-Aufholen und Spielstand laden
- [ ] **Schritt 3 – Umgebungen**: `CellarEnvironmentDef` in `content/endgame.ts` (Bedingung über Allel, reinerbig,
      latentes Merkmal, Element oder Team-Vielfalt → Modifier auf den `Fighter`), Prüfung in `validate.ts`, Fackellicht,
      Wochen-Regel aus der Wochen-Mutation. Abfrage-Helfer in `core/queries.ts` bzw. im Feature: „Welche meiner
      Kreaturen passen zur nächsten Umgebung?“
- [ ] **Schritt 4 – Gegner und Bosse**: verworfene Linien (Namen, Tönung), steilere Kurve als im Turm, Boss „Schatten
      deiner Dynastie“ (meistgezüchtete Art, deren Gene), dunkle Boss-Merkmale zusätzlich zu `bossTraits`
- [ ] **Schritt 5 – Belohnungen**: Ressource Schattenmarken (`resources.ts`), dunkle Relikte (`RelicDef` mit Nachteil,
      Platz-Regel für Turm und Keller festlegen), `cellarMilestoneProvider` mit den Quellen für
      `infusion.transferChance`, Ritual-`rarityBoost` und `cost.capsule` (dann den Punkt in der Code-Durchsicht
      streichen), Äon-Splitter mit Wochen-Deckel
- [ ] **Schritt 6 – Oberfläche**: Umschalter ▲ Turm / ▼ Keller im Turm-Tab (zuletzt gewählter Bereich in
      `viewState`), Keller-Ansicht mit eigenem Schacht statt der Etagen-Liste, Anzeige der Umgebung und welche
      Kreaturen passen, Versuche-Zähler, `tabActivity`, Changelog-Eintrag mit `feature: 'cellar'`. Funktional, noch
      im einfachen Stil. Auch auf Handy-Breite prüfen
- [ ] **Schritt 7 – Atmosphäre: Bild** (siehe oben): eigene Farb-Tokens, Arena mit Lichtkegel nach Fackellicht,
      Gegner aus der Dunkelheit, Kulisse, sichtbare Umgebungen, Boss „Schatten“, Aufzug-Fahrt durch den Boden
      (Licht flackert, Seil ruckt, Ansicht sinkt). `.reduce-motion` = ruhiges Bild ohne Flackern und sofortiger
      Wechsel. Leistung auf dem Handy prüfen (Lichtkegel und Nebel nur mit CSS, keine großen Bilder)
- [ ] **Schritt 8 – Atmosphäre: Klang und Musik** (siehe oben): Stimmung `cellar` mit Drone, Spieluhr, Raum-Geräuschen,
      Tiefe und Herzschlag; Boss-Variante aus der Brutstation-Melodie; Keller-Klänge in `sound.ts`; Klänge nur im
      Keller-Bereich (`setSoundScope`-Muster der RPG-Welt prüfen). Mit echten Ohren gegenhören: schaurig, aber auf
      Dauer nicht nervig
- [ ] **Schritt 9 – Balancing mit dem Äon-Bot**: Bot nutzt den Keller (Team nach Umgebung wählen), messen: Tiefe je
      Tag, Schattenmarken, Wirkung der dunklen Relikte auf den Turm-Stillstand (Ziel höchstens etwa 3 Tage), Splitter
      je Woche. Zahlen in `balance.ts` nachziehen
- [ ] **Schritt 10 – Höhlenformen** (optional, nach Rückmeldungen): blasse Varianten als Fund tief im Keller; braucht
      Änderungen am Kreaturen-SVG – zusammen mit den kosmetischen Mustern der Gen-Aufträge planen

# GenLab RPG

## Sonstiges

- [ ] Dark-Souls-Umbau mit echten Spielern prüfen: Sind die Bosse beim ersten Versuch tödlich genug (der Bot
      pariert und weicht perfekt aus)? Der Kieselkauz braucht im Wurzellabyrinth 17–20 Läufe (doppelter
      Element-Nachteil), der Zephyrix hängt lange in der Sturmspitze – vielleicht einen Hinweis auf den
      Element-Nachteil in der Lobby
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
