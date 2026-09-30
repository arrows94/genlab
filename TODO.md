# TODO – visuelle Überarbeitung

Bereits erledigt: Gen-Splicing (Werkbank), Infusion (Kammer), Genom-Turm, Erkundung (Weltkarte),
Brutstation (Nester & Paarungsaltar), mitscrollende Ressourcenleiste, Anlagen, Forschung, Vererbung, Markt, Monster-Dex, Genlabor,
einheitliche Kopfzeilen, Äon-Tab. Die visuelle Überarbeitung ist damit abgeschlossen.

## Höchste Wirkung

- [x] **Anlagen (Farm, Mine, Bio-Labor)**
  - [x] Jede Anlage als kleine Szene (wachsende Felder, Mineneingang mit Loren, Labor mit blubbernden Kolben);
        ohne Arbeiter steht die Szene ausgegraut still
  - [x] Zugewiesene Kreaturen sichtbar „bei der Arbeit“ (hüpfen, hacken, schweben)
  - [x] Plätze als Sockel (wie beim Turm-Team) mit Arbeitswert und Anteil am Ertrag
  - [x] Produktion pro Sekunde als Anzeige, aufsteigende Ertragszahlen; Kopfzeile mit Kennzahlen
  - [x] Zuweisen per Kreaturen-Kachel statt Menü, sortiert nach zusätzlichem Ertrag, mit Hinweis, welcher Wert ihn steigert
- [x] **Forschung**
  - [x] Forschungsbaum nach Themen (Sammeln, Farm, Mine, Bio-Labor, Brut, Erkundung, Genetik, Verwaltung,
        Automatik, Turm) mit Themen-Filter
  - [x] Abhängigkeiten zwischen Forschungen sichtbar machen (Baumlinien; der nächste Schritt erscheint gesperrt
        mit „benötigt: …“ und Fortschritt, z. B. „40 Eier ausgebrütet (23/40)“)
  - [x] Stufen als Pips statt „Stufe 0 / 10“ (ab 13 Stufen als Balken), aktuelle Wirkung (z. B. „×12,8“)
  - [x] Bezahlbare Forschungen hervorheben (Rahmen, Zähler pro Thema, Filter „nur bezahlbare“,
        Wartezeit bis bezahlbar aus der aktuellen Produktion)
  - [x] Eigener Bereich für die unendliche Forschung
- [x] **Vererbung (Prestige)**
  - [x] Übersicht: was verloren geht und was bleibt (aus den Reset-Daten der Ebene abgeleitet)
  - [x] Gewinn als große Zahl, mit Fortschritt bis zum nächsten Erbgut-Punkt
  - [x] Vorschau des Produktionsbonus vorher/nachher
  - [x] Zeitleiste der bisherigen Durchläufe (neu im Spielstand: `prestigeLog`, Äonen als Trenner;
        ältere Durchläufe vor der Aufzeichnung werden nur gezählt)
  - [x] Animation beim Vererben
  - [x] Dieselbe Übersicht und Zeitleiste auch im Äon-Tab (gemeinsame Komponente `PrestigeOverview.svelte`,
        Zeitleiste aus `prestigeTimeline`: Äonen mit Laufzeit und Zahl der Vererbungen dazwischen)

## Auch lohnend

- [x] **Markt**
  - [x] Ladentresen mit Tränken als Flaschen-Grafik (Form je Trankart, Farbe als `color` in `potions.ts`)
  - [x] Zielkreatur per Kachel statt Menü wählen (Turbo: Arbeiter mit Ertrag zuerst; Kraftfutter:
        Wertewahl mit bisherigen Stärkungen als Pips)
  - [x] Aktive Effekte (Festmahl, Turbo-Trank) als Timer mit Restzeit
- [x] **Monster-Dex**
  - [x] Entdeckte Arten mit Bild, unbekannte als Silhouette (neue Ansicht „Sammlung“, Punkte je Seltenheit)
  - [x] Fortschrittsring pro Kategorie (Gesamt, Basisarten, Hybride, Seltene Hybride, Mythische Endformen)
  - [x] Detailkarte beim Klick (Beschreibung, Grundwerte, Seltenheiten, Herkunft: Hybrid-Rezept, Evolution
        oder Region – noch nicht erschlossene Regionen bleiben „unbekannt“); aus allen drei Ansichten erreichbar
- [x] **Genlabor**
  - [x] Sequenzierer als Maschine, die die DNA Stück für Stück entschlüsselt (Scan-Kammer, Bildschirm mit
        Loci-Liste; die Allele selbst erscheinen erst am Ende; Tiefensequenzierung violett; Ziel per Kachel)
  - [x] Genbibliothek mit Sammelfortschritt pro Gen (gruppiert nach Werte/Eigenschaften/Aussehen, seltene Allele ★)

## Kleinigkeiten quer durchs Spiel

- [x] Einheitliche Tab-Kopfzeilen mit Kennzahlen-Kacheln (wie bei Turm und Brutstation) – gemeinsame Stile
      `.tab-head` / `.kpis` / `.kpi` in `styles.css`, jetzt in allen Tabs (neu: Labor, Erkundung, Anomalien,
      Recycler, Statistik, Optionen); der Labor-Tab heißt nicht mehr „Genlabor“
- [x] „Sammeln“-Knopf: aufsteigende +1 🍖 beim Klick (war schon umgesetzt, im Browser geprüft)
- [x] Kreaturenkarten: Seltenheit stärker am Rahmen zeigen (Schimmer ab Episch, Glühen ab Legendär,
      Gewöhnlich/Ungewöhnlich gedämpft, ab Selten farbiger Kopf)
- [x] Anomalien- und Äon-Tab ansehen – Äon-Tab ist mit den Großprojekten überarbeitet; Anomalien zeigen
      jetzt den Fortschritt zum Ziel (`conditionProgress` in `core/conditions.ts`)

# TODO – Komfort

- [x] Zuchtbuch (Forschung ab den Hybriden, `breedRepeat`): Knopf ↻ zwischen den Eltern (`breedByHand` merkt sich das
      Paar in `state.lastPair`, der Zuchtautomat überschreibt es nicht)
- [x] Zwei Zuchtlisten (Forschung nach der ersten Vererbung, `breedSplit`): eine Kandidatenliste je Elternteil mit
      eigenem Art-Filter; unter Optionen → Darstellung wieder auf eine Liste umstellbar (`prefs.breedingSplit`)
- [x] Warnung beim Verkaufen und Recyceln von Hand, wenn eine Art dadurch aus dem Stall verschwindet
      (`speciesLostWith`). Ein fester Schutz im Recycling-Automaten wurde wieder verworfen – „je Art behalten“ regelt das
      („keine“ darf auch die letzte nehmen)

# TODO – Endgame

Vorhanden: Vererbung + Äon (9 Talente), endloser Genom-Turm, 3 unendliche Forschungen,
4 Anomalien, 12 Wochen-Mutationen, Perfektions-Jagd im Dex, Urgen.
Schwächen: vieles ist irgendwann „fertig“, und die Genetik spielt am Ende kaum noch eine Rolle.

## Priorität

- [x] **Gen-Aufträge** (Favorit, zuerst umsetzen)
  - [x] Wechselnde Aufträge, z. B. „Wasser-Hybrid mit Genotyp K/K und T/T“, „3 dominante Top-Allele“
  - [x] Nutzen Zuchtplaner, Sequenzieren und Splicing gezielt
  - [x] Belohnungen: Äon-Splitter, seltene Allele (Genproben)
  - [ ] Belohnung: kosmetische Muster (braucht neue Muster im Kreaturen-SVG)
  - [x] Schwierigere Aufträge schalten sich nach und nach frei (Auftragspool statt fester Inhalte)
  - [x] Balancing mit dem Test-Bot: Wie schnell steigt die Auftragsstufe, passen die Belohnungen?
- [x] **Äon-Talentbaum ausbauen** (läuft nach wenigen Äonen leer)
  - [x] 2–3 weitere Stufen mit spielverändernden Talenten – Stufe 4 und 5, versiegelt bis zur Kuppel bzw.
        Sternkarte des Äon-Observatoriums: Starke Blutlinie (Fähigkeiten sicher vererbt), Wilde Kreuzungen
        (Erkundungen bringen entdeckte Hybride), Sturmlauf (Turm-Kämpfe halb so lang), Aufstrebende Brut
        (15 % Chance auf eine Seltenheitsstufe mehr), Gelehrtenkreis (+1 Großforschungsplatz), Titanenjäger
        (+1 Wochen-Boss-Angriff pro Tag). „Turm startet ab dem halben Rekord“ entfällt – die Kontrollpunkte
        alle 10 Etagen starten schon näher am Rekord.
  - [x] Unendliche „Resonanz“-Knoten mit abnehmendem Ertrag (Ernte, Erbgut, Gene, Kampf; Wirkung Stufe^0,7)
  - [x] Splitter-Tempo mit dem Test-Bot über mehrere Äonen prüfen (`GENLAB_AEON=1`, 28 Tage): Äon ab Tag 2
        freigeschaltet, Äonen an Tag 5/11/16/24, Talentstufen 1–3 nach 4 Äonen voll (9 Talente), Observatorium
        fertig an Tag 25 – aber Stufe 4 (ab Tag 11 offen) und Stufe 5 sind am Ende noch nicht bezahlbar, Resonanz 0
  - [x] Stufe 4/5 günstiger (6/9 statt 8/12 Splitter). Zweiter 28-Tage-Lauf: noch ohne sichtbare Wirkung – nach
        Stufe 1–3 bleiben an Tag 28 wieder 2 Splitter; die Senkung greift erst ab dem 5. Äon (um Tag 30)
  - [x] Splitter-Einkommen und Observatorium angleichen: Äon-Formel √(Erbgut / 25) statt / 50, dazu Splitter aus
        Turm-Meilensteinen (alle 50 Etagen). Dritter 28-Tage-Lauf (ohne Meilensteine, der Bot erreicht Etage ~40):
        5 statt 4 Äonen (Tag 4/10/16/21/27), 11 statt 9 Talente – Stufe 4 ab Tag 17 offen, 2 von 3 bis Tag 28
        gekauft; Observatorium an Tag 28 bei 3/4 (vorher fertig an Tag 25). Splitter und Observatorium laufen
        jetzt etwa im Gleichschritt; Stufe 5 und Resonanz folgen nach Tag 28
  - [x] Vierter 28-Tage-Lauf mit Relikten und Anomalien (und behobenem Bot-Fehler: nach einem Neustart blieb die
        einzige Kreatur auf der Farm): 7 statt 5 Äonen (Tag 4/8/13/16/20/25/28), 71 Splitter aus Äonen, 20 aus
        Anomalien, 2 vom Wochen-Boss. Talente an Tag 16 bei 12 und danach Stillstand, weil Stufe 5 und Resonanz auf
        das Observatorium warten (an Tag 20 bei 3/4, danach Stillstand) – an Tag 28 liegen 50 Splitter ungenutzt
  - [x] Splitter-Einkommen lag über den Ausgaben. Anomalie-Ziele ×10 je Stufe, Rekord-Bonus halbiert, Resonanz schon
        ab Bauphase 3. Fünfter 28-Tage-Lauf: 6 Äonen (Tag 4/8/13/18/23/27), 57 Splitter aus Äonen, 20 aus Anomalien;
        Talente 12, Resonanz 8 Stufen ab Tag 21, an Tag 28 keine Splitter mehr übrig; Observatorium 3/4 ab Tag 20
  - [ ] Weitere Splitter-Quellen bei Bedarf: die Ideen unter „Ideen (noch grob)“
- [x] **Turm-Mechaniken vertiefen**
  - [x] Bosse mit Eigenheiten ab Etage 20 (Element-Schild, Wandler, Regeneration; `bossTraits` in `content/endgame.ts`)
  - [x] Relikte für Turm-Marken (dauerhafte Verwendung für Marken) – sie gehören dem Spieler und stecken in den
        Plätzen des Turm-Teams statt an einer Kreatur, damit sie jede Vererbung überstehen (`relics`)
  - [x] Meilensteine alle 50 Etagen mit dauerhaftem Bonus (+15 % Turm-Schaden, +10 % Produktion) und einmalig
        3 Äon-Splitter – eine weitere Splitter-Quelle
  - [x] Test-Bot: Relikte kaufen und ausrüsten, damit der Äon-Lauf die neuen Turm-Systeme mit misst
  - [x] Relikte waren viel zu billig (alle 50 Stufen an Tag 3). Jetzt ×2,2 je Stufe statt ×1,6: alle Stufen an Tag 21
  - [x] Der Turm blieb im Bot-Lauf bei Etage 39 stehen (Boss auf Etage 40); im sechsten Lauf bei Etage 49 ab Tag 15
        (Boss auf Etage 50, gleichzeitig der erste Meilenstein). Befund: Der Regenerations-Boss heilte 8 % seiner KP
        pro Runde und verlangte ein 6-mal so starkes Team wie Etage 39 (mehr als Etage 49). Jetzt heilt er 40 % des
        Schadens der Runde (×2,3 wie Schild und Wandler). Etage 50 ist ein Element-Schild – der Test-Bot wählt sein
        Team vor einem Boss jetzt nach Element-Vorteil, wie ein Spieler mit „Vorteil vs. …“
  - [ ] Siebter 28-Tage-Lauf (Regeneration neu, Bot mit Element-Wahl): Turm 39 von Tag 6 bis 14, dann 51 ab Tag 15
        bis Tag 28 – Etage 50 fällt jetzt, Etage 40 hält trotzdem (das Team wäre auch ohne Heilung zu schwach).
        Die Team-Stärke wächst nur in Sprüngen (letzte Relikt-Stufen, Talente), der Turm um ×1,11 je Etage – dazwischen
        acht bis dreizehn Tage Stillstand. Ansehen: eine Turm-Stärke, die mit jeder Vererbung oder jedem Äon wächst?
- [x] **Anomalien mit Stufen und Kombinationen**
  - [x] Schwierigkeitsstufen I–V pro Anomalie: Stufe n+1 öffnet sich, wenn Stufe n gemeistert ist. Jede weitere
        Stufe verschärft die Regel (`perLevel`) und vergrößert das Ziel ×4 (`balance.anomalies.goalGrowth`)
  - [x] Mehrere Anomalien gleichzeitig aktivierbar – der Lauf ist geschafft, wenn alle Ziele erreicht sind
  - [x] Belohnung wächst mit der Gesamtschwierigkeit: Die Belohnung jeder Anomalie zählt je gemeisterter Stufe.
        Ein neuer Rekord in der Gesamtschwierigkeit (Summe der Stufen, max. 20) bringt 1 Äon-Splitter je Punkt
        und dauerhaft +2,5 % Produktion und +1,5 % Erbgut je Rekordpunkt – eine weitere Splitter-Quelle
  - [x] Test-Bot: Anomalie-Läufe in den Äon-Lauf aufnehmen, um Splitter-Ertrag und Rekord-Bonus zu prüfen
        (nach jeder Vererbung: alle gemeisterten auf bester Stufe, eine davon eine Stufe höher)
  - [x] Anomalien waren zu leicht: Rekord 20 (alle vier auf Stufe V gleichzeitig) an Tag 11, mit Ziel ×10 je Stufe
        immer noch an Tag 17 – die Ziele „in diesem Lauf verdienen“ wuchsen langsamer als die Produktion. Jetzt
        wachsen sie mit dem Produktionsbonus (beim Start eingefroren) und ×4 je Stufe. Sechster 28-Tage-Lauf:
        Rekord 4 an Tag 4, 8 an Tag 9, 11 an Tag 14, danach bis Tag 28 kein weiterer – 11 Splitter aus Anomalien.
        5 Äonen (Tag 5/10/15/19/24), 49 Vererbungen (vorher 70: fehlgeschlagene Anomalie-Läufe kosten den Bot Zeit)
  - [ ] Test-Bot: klügere Anomalie-Wahl (einzelne Anomalie eine Stufe höher statt immer alle zusammen), damit der
        Äon-Lauf nicht mit zwölfstündigen Fehlversuchen Vererbungen verliert
- [x] **Stammbaum-Dynastien**: wachsender Bonus für reine Linien über viele Generationen
  - [x] Reine Linie = beide Eltern und das Kind dieselbe Art; Tiefe = kürzere Elternlinie + 1 (`lineage` an der
        Kreatur, +1 % Werte je Tiefe, höchstens +50 %; beginnt nach jedem Neustart von vorn)
  - [x] Dauerhafter Rekord je Art (`dynasties`, übersteht Vererbung und Äon): Stufen ab Tiefe 5/10/20/35/50 geben
        der Art +5 % Werte je Stufe und allen +1 % Produktion je Stufe; Stufe 4 und 5 bringen 2 bzw. 3 Äon-Splitter
  - [x] Brutstation: Linie des nächsten Kindes, Dynastie-Übersicht, Sortierung „Reine Linie“, Zuchtautomat-Ziel
        „Reine Linie vertiefen“; Freischaltung über das Äon-Talent „Stammbaum-Dynastien“ (Stufe 2, 3 Splitter, nach „Zeitlose Ernte“);
        Linien und Rekorde zählen erst ab dann
  - [ ] Balancing mit dem Test-Bot: Ohne gezielte Zucht erreicht der Bot Tiefe 11 und 9 Stufen (+9 % Produktion)
        bis Tag 23, keine Splitter. Tempo der hohen Stufen und Splitter-Ertrag erst messen, wenn der Bot das
        Zuchtautomat-Ziel „Reine Linie vertiefen“ nutzt

## Später

- [ ] **Tiefenexpedition**: endlose Region, mit jeder Tiefe gefährlicher und lohnender
- [ ] **Dritte Prestige-Stufe** (z. B. „Genesis“) – erst, wenn Äon ausgereizt ist
- [ ] **Endgame-Erfolge und Statistiken** als Langzeitziele (alle 198 Dex-Einträge, Etage 200 …)
- [x] Balancing der neuen Systeme mit dem Test-Bot über mehrere Äonen prüfen (siehe Äon-Talentbaum)

## Ideen (noch grob)

Mögliche neue Splitter-Quellen (siehe „Splitter-Einkommen und Observatorium angleichen“). Beide Ideen sind noch
nicht ausgearbeitet – vor dem Umsetzen Umfang, Freischaltung und Splitter-Ertrag festlegen.

- [ ] **Basebuilding / Worldbuilding / Universebuilding**
- [ ] **Isekai mit einem ausgewählten Monster**: RPG-Gefühl – stärkere Monster kosten neue Ressourcen oder
      starten wieder auf Stufe 1

# TODO – Langzeitmotivation (Idle über Tage und Wochen)

Heute: Brüten 20 s (+15 %/Generation), Sequenzieren 60 s, Expeditionen 1 min–1 h, Turm 8 s/Etage,
Forschung sofort, Offline-Fortschritt max. 12 h. Das Spiel ist eher auf aktives Spielen ausgelegt.
Grundidee: **Zeitskalen staffeln statt alles verlängern** – für jede Zeitspanne gibt es parallel etwas zu tun.

| Zeitspanne | Inhalt | Zweck |
|---|---|---|
| Sekunden–Minuten | Sammeln, normales Brüten, Turm-Etagen (bleibt so) | Sitzung fühlt sich lebendig an |
| Stunden | Expeditionen, Sequenzieren, Forschung mit Laufzeit | 2–3× am Tag reinschauen |
| Ein Tag | Besondere Brut, Tagesreise, Tagesaufträge | Vorfreude auf morgen |
| Eine Woche | Wochenexpedition, Wochen-Boss, Wochen-Mutation | ein großes Ziel pro Woche |
| Wochen–Monate | Äon, Großprojekte, Dex vervollständigen | Grund dabeizubleiben |

## Schritt 1 – Technische Grundlage (zuerst)

- [x] Lange Projekte laufen nach echter Uhrzeit, unabhängig von der Offline-Grenze
      (die Grenze gilt nur noch für die laufende Produktion von Nahrung/Gold)
- [x] Benachrichtigungen in der Handy-App (Capacitor Local Notifications, ohne Server),
      z. B. „Deine Expedition ist zurück!“; optional Browser-Benachrichtigungen in der PWA
  - [ ] Auf echtem Android-/iOS-Gerät testen (Statusleisten-Icon, Erlaubnis-Dialog, Zustellung nach App-Schließen)

## Schritt 2 – Lange Projekte neben den kurzen (nicht statt der kurzen)

- [x] **Tagesreise** (12–24 h) mit garantiert seltenen Funden
      (Nebelmoor 12 h ab Selten nach der 1. Vererbung, Wolkengrat 24 h ab Episch nach der 2.)
- [x] **Wochenexpedition** (7 Tage) mit Ereignissen unterwegs und einer Entscheidung bei der Rückkehr
      (z. B. „verletztes Wildtier mitnehmen oder Beute behalten?“) – Team bis 3, belegt ein Camp, ab der 2. Vererbung
- [x] **Besondere Brut** (4–24 h): gezielte Hybrid-/Seltenheitsbrut mit besseren Chancen; normales Ei bleibt kurz
      (Kreuzungsritual 4 h, Edelbrut 8 h, Meisterbrut 24 h)
- [x] **Tiefensequenzierung** (8 h): deckt verborgene Eigenschaften oder das Urgen auf
      (Erbanlagen: verborgen, vererbbar, erst nach Aufdeckung wirksam; mit „Urgene“ kann ein Urgen-Allel erwachen)
- [x] Lange Projekte belegen knappe Plätze (Brutplatz, Camp) → echte Abwägungen
      (Reisen belegen Camp und Kreaturen, Brutrituale Nest und Eltern)
      („beste Kreatur eine Woche wegschicken oder im Turm einsetzen?“)

## Schritt 3 – Beschäftigung „in der Zwischenzeit“

- [x] Gen-Aufträge (siehe Endgame) als Tagesaufträge: 3 kleine Aufträge pro Tag
- [x] Tagesbelohnung fürs Einchecken – ohne Strafe bei einer Pause
      (Treue-Kalender mit 7 Stufen, rückt pro Abholung vor statt pro Kalendertag)
- [x] Zeitkristalle im Spiel verdienbar (Aufträge, Turm), um lange Projekte gelegentlich abzukürzen
      (Aufträge ab Stufe 3, Tagesbelohnung Tag 7, Turm-Rekord alle 25 Etagen; −4 h pro Kristall.
      Der Markt-Trank heißt jetzt Zeittrank und wirkt nur noch auf Vorgänge unter 1 h)

## Schritt 4 – Große Ziele

- [x] **Großforschung**: eigener Forschungsplatz mit Laufzeiten von Stunden bis Tagen für große Boni
      (Sofort-Forschungen bleiben) – 7 Projekte, Stufen bleiben über Vererbung und Äon
- [x] Forschung „Sequenzier-Roboter“: sequenziert automatisch die stärksten unbekannten Genome
- [x] **Wochen-Boss im Turm**: riesige KP, Schaden sammelt sich über die Woche, Belohnung nach Gesamtschaden
      (ab Turm-Etage 10; 3 Angriffe pro Tag, bis zu 6 sammelbar; Belohnungen bei 10/25/50/75/100 %)
- [x] Wochen-Mutation, Wochen-Boss und Wochenexpedition thematisch verbinden
      (Wochenexpedition und Wochen-Boss teilen das Element der Wochen-Mutation)
- [x] **Großprojekte**: z. B. „Äon-Observatorium bauen“ – über Tage Ressourcen einzahlen, schaltet ein neues System frei
      (4 Bauphasen mit 12–48 h Bauzeit; Einzahlungen bleiben über jeden Neustart, auch kurz vor einem Äon;
      öffnet Talentstufe 4 und 5 und die Äon-Resonanz. Kosten nach den Beständen des 14-Tage-Bots bemessen)

## Leitplanken

- [x] Der Anfang bleibt schnell: lange Laufzeiten erst nach und nach (z. B. ab der ersten Vererbung)
      (`tests/guardrails.test.ts`: alles über 1 h braucht eine Vererbung; die „Große Reise“ mit genau 1 h ist freiwillig)
- [x] Lange Projekte sind Bonus, nie Sperre für Grundfunktionen (`tests/guardrails.test.ts`)
- [x] Test-Bot erweitern, damit er mehrere Tage Spielzeit durchspielt und das Tempo prüfbar ist
      (`tests/longrun.ts`; Funde: Reisende überstehen jetzt Vererbungen, eine Tagesreise pro Region gleichzeitig)

# TODO – Sound

Stand: Alle Klänge werden live mit Web Audio erzeugt (`ui/sound.ts`, Rezepte in `SOUNDS`), keine Tondateien.
Welches Ereignis welchen Klang spielt, steht in `ui/soundEvents.ts`; Klänge, die zu einer Animation gehören
(Kapseln, Turm-Wiedergabe, Zerlege-Kammer, Relikte, Offline-Begrüßung), spielen ihre Komponenten.
Ziel: Jede wichtige Aktion hört sich an, ohne zu nerven.

## Schritt 1 – Technische Grundlage

- [x] `ui/fanfare.ts` zu einem kleinen Sound-Modul ausgebaut (`ui/sound.ts`): benannte Klänge (`play('perfect')`,
      Rezepte in `SOUNDS`, optional mit Variante wie Tonhöhe oder Seltenheit), Synth-Bausteine Ton, Gleitton und
      Rauschen, Lautstärke über `prefs.volume`
- [x] Drosselung: je Klang ein Mindestabstand (`LIMITS`, sonst 80 ms), höchstens 4 Klänge in 250 ms
- [x] Stumm während des Offline-Nachholens (`silently()` in `store.advance`) und solange der Tab im Hintergrund ist
- [x] Automatik-Aktionen: Alltägliches, das die Automatik ständig auslöst (Ei gelegt, normales Schlüpfen,
      Sequenzierung, neues Allel, Erkundung zurück, Turm-Lauf beendet), klingt nur im eigenen Tab; seltene
      Ergebnisse überall; Verkaufen/Recyceln des Automaten (`auto`) bleibt still
- [x] Optionen: Schalter „Töne“, Lautstärke mit Probeton, „leises Klicken bei Knöpfen“; Musik mit eigenem Schalter
- [x] Reduzierte Bewegung ≠ stumm – bleibt getrennt

## Schritt 2 – Grundgefühl (häufige, kurze Klänge)

- [x] „Sammeln“-Knopf: weiches „Plopp“, Tonhöhe leicht zufällig, bei schnellem Klicken aufsteigend
- [x] Knöpfe/Tabs: sehr leises Klicken (Option, standardmäßig aus)
- [x] Toasts: „Info“ neutral, „Selten“ glitzernd, Fehler kurzes dumpfes „Bonk“ – nur wenn das Ereignis keinen
      eigenen Klang hat (`playedRecently`), sonst gewinnt der eigene
- [x] Forschung gekauft: Münzklimpern + kurzer Ton, letzte Stufe erreicht: kleiner Akkord
- [x] Freischaltung eines neuen Bereichs: kurzes „Tadaa“ (zwei Töne aufwärts)

## Schritt 3 – Zucht und Genetik

- [x] Ei gelegt: weiches Rascheln im Nest (nur im Brutstation-Tab)
- [x] Ei schlüpft: Knacken + Glöckchen; ab Selten und bei Hybriden glitzernd, je Seltenheit mehr Glitzer, Mythisch
      mit kleinem Chor
- [x] Hybrid entdeckt (neu im Dex): eigener „Entdeckung“-Klang
- [x] Zwillinge: doppeltes Knacken
- [x] Sequenzierung fertig: Computer-Piepen (im Genlabor); Tiefensequenzierung: tieferes Summen + Aufdeck-Ton;
      neues Allel in der Bibliothek: kurzes Piepen (im Genlabor)
- [x] Splicing: Erfolg „Schnipp + Ding“, instabil „Zischen“
- [x] Infusion: Aufsaugen, Stufe hoch, Durchbruch (kurze Fanfare)
- [x] Dynastie-Stufe erreicht: kleine Krönungs-Fanfare
- [x] Brutritual fertig: feierlicher Glockenschlag (`eggHatched` trägt dafür jetzt `ritual`)

## Schritt 4 – Wirtschaft, Erkundung, Endgame

- [x] Recycler: Zerlege-Kammer brummt leise, solange sie arbeitet und zu sehen ist; fertig „Plopp + Klimpern“
- [x] Kapseln: Rütteln, Aufplatzen (ab Episch mit Glitzer, Mythisch mit Akkord), leise Klicks beim Umdrehen
- [x] Markt: Münzen und Glucksen beim Trank
- [x] Erkundung zurück: Horn (im Erkundungs-Tab); wilde Kreatur gefunden: Lockruf; Wochenexpedition wartet auf
      die Entscheidung: Spannungsakkord
- [x] Gen-Auftrag abgegeben: Stempel + Münzen; Tagesbelohnung: Kiste öffnet sich
- [x] Turm: Treffer, sehr effektiv (heller), resistiert (dumpf), Ausweichen (Wusch), K.O., Etage geschafft,
      Boss-Etage (tiefe Trommel), Lauf beendet (im Turm-Tab), Meilenstein (Fanfare), Relikt gekauft
- [x] Wochen-Boss: Angriff, Belohnungsstufe erreicht
- [x] Vererbung: Rauschen + Glocke; Äon: tiefer, langer Klang; Talent und Resonanz; Großprojekt-Bauphase fertig
- [x] Anomalie gestartet (verzerrter Ton) / gemeistert; Erfolg freigeschaltet (kurzes Jingle); Offline-Rückkehr
      (Begrüßung)
- [ ] Alle Klänge einmal mit echten Ohren durchhören (Lautstärke untereinander, nervt etwas auf Dauer?) –
      bisher nur fehlerfrei im Browser abgespielt

- [x] Einzelne Klänge und ganze Gruppen abschaltbar (Optionen → Töne → „Einzelne Klänge“, mit Probe je Klang)

## Schritt 5 – Musik (optional, später)

- [x] Ruhige Hintergrundmusik, live mit Web Audio erzeugt (`ui/music.ts`: Pad, Bass, Zupfer, Hall), standardmäßig
      aus; Schalter 🎵 in der Kopfzeile und unter Optionen mit eigener Lautstärke; still im Hintergrund-Tab
- [x] Variante je Bereich (Labor ruhig, Brutstation Spieluhr, Genlabor Sequenzer, Turm treibend in Moll, Äon
      schwebend lydisch); beim Tab-Wechsel klingen die Akkorde in 1,2 s aus und die neue Stimmung setzt sofort ein
- [ ] Falls Tondateien: lizenzfreie Quellen dokumentieren, als `.ogg` klein halten, nicht in den Service-Worker-Precache

# TODO – Kampfsystem überarbeiten

Stand: Jede Kreatur schlägt einmal pro Runde zu, Tempo bestimmt nur die Reihenfolge in der Runde, der Gegner trifft
ein zufälliges Teammitglied, höchstens 40 Runden. Messung (gemischtes Team, 200 Kämpfe je Wert): **+50 % Tempo ändert
die Siegquote gar nicht** (Etage 25: 35,5 % → 35,5 %), +50 % Verteidigung wenig (→ 53 %), +50 % KP oder Angriff fast
alles (→ 99–100 %). Dazu kommen die Stillstands-Phasen des Test-Bots im Turm (siehe Endgame: 8–13 Tage ohne Fortschritt).
Ziel: Jeder Wert und jede Team-Entscheidung zählt, Kämpfe sehen lebendiger aus, Genetik und Fähigkeiten wirken mit.

## Schritt 1 – Zeitleiste statt Runden (Tempo wird wichtig)

- [x] Aktionsleiste (ATB): Jeder Kämpfer handelt alle (mittleres Tempo / eigenes Tempo)^0,8 Sekunden Kampfzeit –
      relativ zum Kampf, damit es auf jeder Etage gleich wirkt (`actionIntervals` in `features/tower.ts`)
- [x] Zeitlimit statt 40 Runden: 40 s Kampfzeit; Wandler wechselt und Regeneration heilt jetzt jede Sekunde
- [x] Tempo zusätzlich: Ausweich-Chance 15 % je 100 % Tempo-Vorsprung, höchstens 25 %
- [x] Mess-Test (Etage 25, gemischtes Team, 200 Kämpfe, Basis 63 %): +10 % KP 94 %, ANG 88 %, VER 84 %, TMP 71 %;
      ab +25 % bringen alle vier Werte 94–100 %. Test: „speed wins fights“ in `tests/towerMechanics.test.ts`
- [x] Äon-Bot (12 Tage) vorher/nachher: Turm-Rekord Tag 8 42 → 36, ab Tag 9 43 → 39 (Boss auf Etage 40 hält).
      Der Bot wählt sein Team jetzt mit Tempo (Kampfwert, siehe Schritt 4) – neu gemessen in Schritt 4
- [x] Wochen-Boss (`weeklyBoss.ts`) läuft auf der Aktionsleiste (mit Schritt 3)

## Schritt 2 – Verteidigung und Rollen

- [x] Verteidigung stärker: nach `defScale / (defScale + VER)` blockt VER noch bis zu 40 % mehr, je nach VER im
      Verhältnis zum Angriff des Gegners (`defRatio`, skalenfrei). Mess-Test (Basis 41 %): +10 % KP 67 %, ANG 76 %,
      VER 57,5 %, TMP 86,5 %; +25 %: VER 70 %, die anderen 99–100 %. Ein fester Abzug je Punkt und eine Mindest-
      Schadensquote wurden verworfen: Sie wachsen nicht mit den Etagen mit (im Äon-Bot Turm 58 statt 28 an Tag 5).
      Äon-Bot 12 Tage mit der jetzigen Formel: Turm 15/17 an Tag 1–5 (vorher 18/28), 37 an Tag 8 (vorher 36),
      ab Tag 9 wie vorher 39; Wochen-Boss, Äonen und Splitter ähnlich
- [x] `defScale` bleibt fest (50): Weit oben ist `defScale / (defScale + VER)` ≈ 50 / VER, VER wirkt dort also wie
      zusätzliche KP (doppelte VER = halber Schaden) und der skalenfreie `defRatio`-Teil kommt obendrauf. Ein
      skalenfreier Umbau würde die ganze Turm-Kurve verschieben, ohne dass Verteidigung dadurch wichtiger würde
      (mit Schritt 4 geprüft)
- [x] Reihen: Vorne und Hinten (`tower.back`), Gegner treffen zu 75 % die vordere Reihe, wenn beide besetzt sind;
      Umschalten am Team-Platz, in der Arena steht die hintere Reihe weiter weg
- [x] Rollen aus den Werten abgeleitet (`roleOf`, verglichen mit dem Profil der Turm-Gegner): Tank 🛡️, Angreifer ⚔️,
      Flink 💨 – als Hinweis an Team-Plätzen und Kandidaten
- [x] Zielwahl je Boss-Eigenheit (`targeting` in `bossTraits`): Wandler jagt den Schwächsten, Regeneration greift
      bevorzugt die hintere Reihe an; die Vorschau nennt die Zielwahl des Gegners
- [x] Test-Bot stellt Reihen und Rollen auf: echte Tanks vorne, der Rest hinten; ohne Tank bleiben alle vorne. Die
      stabilere Hälfte ohne Tank nach vorne zu stellen, kostete Etagen (Äon-Bot, Schritt 4 aus: Turm 19 19 19 29
      statt 20 25 29 36) – ohne echten Tank verteilen sich Treffer vorne gleichmäßiger
- [x] „Trifft alle Hinteren“: Boss-Eigenheit Flächenangriff (`sweep`, jede 3. Aktion 60 % auf die hintere Reihe)

## Schritt 3 – Elemente und Fähigkeiten im Kampf

- [x] Element-Techniken (`content/techniques.ts`, jede 5. Aktion): Brand, Quellwasser (Heilung), Steinwall (Schild),
      Windhauch (Ausweichen), Schock (Betäubung), Blütenregen (Team-Regeneration), Frost (Verlangsamen),
      Hinterhalt (220 %), Läuterung (Reinigen + Heilung), Panzerung, Giftbiss, Prisma (Rückstrahlung).
      Ursprüngliche Idee: Jede Kreatur hat nach n Aktionen eine Spezialaktion ihres Elements, z. B.
      Feuer Brand (Schaden über Zeit), Wasser Heilung fürs Team, Erde Schild, Luft Ausweichen, Elektro Betäubung,
      Natur Regeneration, Eis Verlangsamen (senkt Tempo des Ziels), Schatten kritischer Treffer, Licht Reinigen,
      Metall Panzer, Gift Vergiftung, Kristall Rückstrahlung
- [x] Zustände mit Symbolen in der Arena: Brand, Gift, Betäubt, Verlangsamt, Schild, Ausweichen, Regeneration,
      Panzer, Rückstrahlung; ticken jede Sekunde Kampfzeit
- [x] Kampf-Eigenschaften als Modifikatoren (`tower.crit`, `tower.thorns`, `tower.firstStrike`): „Flink“ handelt
      sofort. Eine neue Fähigkeit „Stachelig“ wurde verworfen – jede neue Fähigkeit verschiebt die Würfe beim Brüten und
      damit den Test-Bot (erste Vererbung 108 statt ≤ 100 min)
- [x] Team-Synergien: zwei gleiche Elemente +8 % Angriff, drei verschiedene Elemente +25 % Schaden gegen den Wandler
- [x] Balancing mit dem Äon-Bot (6 Tage, Turm-Rekord je Tag): erste Fassung (jede 4. Aktion, Paar +10 %) 19 26 27 39
      39 49 – zu stark, vor allem Techniken und Synergien zusammen (einzeln abgeschaltet: 29 bzw. 29 an Tag 6).
      Abgeschwächt (jede 5. Aktion, Paar +8 %, Brand 25 %, Gift 18 %, Hinterhalt 180 %): 18 18 18 26 26 26; alles aus
      16 16 16 17 28 28, `main` 15 15 15 17 17 28. Einzelkampf-Messung: Techniken sparen auf Etage 25 3–9 % Stärke,
      reine Unterstützungs-Teams auf Etage 45 kosten bis zu 19 % – Unterstützung lohnt sich noch zu wenig
- [x] Genetik: Titanenkraft (Kᵗ) +10 % kritische Treffer, Blitzschnell (Tᵇ) Erstschlag, Diamanthaut (Pᵈ) 10 %
      Rückschaden; Erbanlagen Jägerinstinkt (+15 % kritisch) und neu Dornenhaut (30 % Rückschaden)

## Schritt 4 – Gegner und Turm

- [x] Mehrere Gegner pro Etage (`enemiesFor`): ab Etage 12 oft 2–3 Gegner, die sich KP und Angriff der Etage teilen
      (Summe ×1,1/×1,2 KP bei 2/3 Gegnern); das Team greift den Gegner vorne mit dem kleinsten KP-Anteil an
- [x] Boss-Etagen ab 20 mit zwei Begleitern vorne (35 % KP, 40 % ANG eines normalen Gegners), ab 30 Phasen: unter
      50 % KP erwacht eine zweite Eigenheit (Vorschau zeigt sie)
- [x] Gegner-Techniken je Element (`enemyTechniqueEvery`: jede 7. Aktion), damit Element-Wahl auch bei normalen
      Etagen zählt. Bosse (auch der Wochen-Boss) setzen keine Technik ein: Mit Technik brauchte Boss-Etage 40
      rund 25 % mehr Team-Stärke als vorher, ohne ist sie für gemischte Teams wie vorher
- [x] Wiedergabe: bis 400 Ereignisse je Kampf (vorher 90 – lange Gruppenkämpfe froren in der Wiedergabe ein)
- [x] Turm-Kurve geprüft (Läufe ab Etage 1, feste Teams, 40 Läufe je Stärke, Median): Normale Etagen wie `main`,
      Teams aus einem Element auf Etage 26–32 bis zu 2–3 Etagen tiefer (etwa 10 % Stärke). Die Kurve ×1,11 je Etage
      bleibt. Der Äon-Bot streut je Seed stark, weil jede Änderung am Kampf die Würfe des ganzen Spiels verschiebt.
      Turm-Rekord Tag 1–5: Seed 7 19 26 35 39 39 (`main` 18 19 29 39 39), Seed 99 17 25 29 36 37 (`main` 18 26 32 42
      42). Äon-Bot 12 Tage (Seed 2024): 19 29 35 35 39, dann 39 bis Tag 12 (`main` 19 25 32 35 36, ab Tag 9 44)
- [ ] Äon-Bot 12 Tage: Wochen-Boss ab Woche 2 nur 15–76 % (`main` jede Woche 100 %), Turm bleibt bei 39 (`main` 44).
      Prüfen, ob es an der neuen Teamwahl liegt (Kampfwert statt Summe der Werte; der Bot nimmt das Turm-Team auch für
      den Wochen-Boss) oder an der Streuung – eigenes Team für den Wochen-Boss (Schaden in 20 s zählt) ausprobieren
- [x] Test-Bot wählt sein Team nach Kampfwert (KP × (1 + VER/ANG des Gegners) × ANG × (TMP-Verhältnis)^0,8 × Element)
      gegen den nächsten Boss – oder gegen die Etage, an der die letzten Läufe endeten
- [x] Wochen-Boss nutzt dieselbe Kampf-Logik (`simulateFight` mit eigenem Zeitlimit `weeklyBoss.fightSec`, zählt
      `dealt`; die Boss-Eigenheit seiner Etage gilt dort nicht)

## Schritt 5 – Darstellung

- [x] Arena: Aktionsleisten unter den Kämpfern, Zugfolge, Kampfuhr mit Zeitlimit-Balken, Zahlen nach Art
      (sehr effektiv, resistiert, ausgewichen, Heilung, Elementwechsel), Treffer-Funken, Boden in Perspektive
- [x] Technik-Namen einblenden, Zustands-Symbole, kritische Treffer, Brand/Gift-Schaden, Rückschaden, Schild
- [x] Wiedergabe mit fester Zeitskala (0,7 s je Sekunde Kampfzeit; nur Kämpfe, die länger als die Pause bis zur
      nächsten Etage wären, laufen schneller), Tempo-Leisten mit Sekunden bis zum nächsten Zug
- [ ] Kampfprotokoll lesbarer (Icons statt Textzeilen), Tempo-Regler für die Wiedergabe (1×/2×/überspringen)
- [ ] Nach einer Niederlage: kurze Auswertung („Gegner war zu schnell“, „Element-Schild – Vorteil fehlt“) mit Tipp

## Leitplanken

- [x] Kämpfe bleiben deterministisch (Spiel-RNG im Spielstand) und offline schnell berechenbar – Simulation ohne Grafik
- [x] Alte Spielstände: Aufstellung (Reihen) hat einen Standard (alle vorne), nichts muss neu eingestellt werden
- [x] Umstieg mit dem Test-Bot absichern (`GENLAB_AEON=1`): Turm-Fortschritt vorher/nachher vergleichen (je Schritt)
