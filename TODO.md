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
- [x] Reiter in Bereiche gruppiert (Labor, Zucht, Abenteuer, Fortschritt, Optionen; `GROUPS` in `App.svelte`):
      Unterreiter als zweite Zeile, auf dem Handy fünf feste Knöpfe unten ohne Scrollen. Ein Bereich mit nur einem
      Reiter zeigt diesen direkt (frühes Spiel wie vorher), jeder Bereich merkt sich den letzten Reiter
      (`viewState.nav`), Zähler werden am Bereich summiert, neu freigeschaltete Reiter bekommen einen Zähler
- [x] Reiter zeigen laufende Arbeit als sich füllende Leiste (`core/tabActivity.ts`): der Vorgang, der als Nächstes
      fertig wird; ein Turm-Lauf schimmert endlos. Fertige Ritual-Eier zählen als Neuigkeit (Zähler), nicht als Arbeit
- [x] Fehler behoben: Nach Import oder übernommenem Cloud-Spielstand war der ganze Spielstand ein Svelte-Proxy
      (`$state` im Import-Dialog und in `sync.conflict`) – `structuredClone` der Keimprobe warf, das Brutritual
      startete ohne Meldung nicht. Jetzt `$state.raw`
- [x] Handy: Unterreiter unten direkt über den Bereichen (`.tabbar` als Dock, Höhe als `--dock-h` für Seitenabstand,
      Toasts und die Anomalien-Leiste)
- [x] Fehler behoben: Abgeschlossene Forschungen trugen die Klasse `.maxed` mit `white-space: nowrap` (gemeint war nur
      „✓ Erforscht“) – die Beschreibung brach nicht um und verbreiterte die Seite. Zusätzlich schneidet `main` zu
      breite Inhalte ab (`overflow-x: clip`), statt die Seite zu verbreitern

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
        acht bis dreizehn Tage Stillstand. Geplant unter „TODO – Turm: Stillstand abbauen“ (Boss-Mauer, Kampferfahrung)
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
      → ausgearbeitet unter „TODO – GenLab RPG“

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
- [x] Äon-Bot 12 Tage: Wochen-Boss ab Woche 2 nur 15–76 % (`main` jede Woche 100 %), Turm bleibt bei 39 (`main` 44).
      Befund (Seed 2024, jeder Angriff mit festen Seeds nachgerechnet): Die Teamwahl war es nicht – Turm-Team, stärkste
      nach Kampfkraft, alte Auswahl und ein gezielt auf den Titan gewähltes Team lagen je Angriff innerhalb von
      ±0,3 Prozentpunkten; ohne Titan-Technik ebenso. Der Titan wird zu Wochenbeginn aus dem Rekord gebaut (Woche 2:
      Etage 39) und bleibt die Woche über gleich stark, der Bot griff aber bei jedem Einchecken an – auch direkt nach
      einer Vererbung mit frisch zurückgesetztem Stall (0 % je Angriff); nur kurz vor dem Äon brachte ein Angriff 5 %.
      Jetzt spart der Bot seine Angriffe und setzt sie direkt vor Vererbung und Äon ein (sonst nur, was die nächste
      Tagesfüllung verfallen ließe). Gleich mit behoben: Der Titan übernahm auf einer Boss-Etage als Rekord deren
      ×2,2 KP und ×1,3 ANG (Rekord 40 schwerer als 41) und setzte die Technik des Etagen-Elements statt keiner ein.
      Äon-Bot 12 Tage vorher/nachher: Woche 2 26 % → 99 %, Turm ab Tag 8 39 → 48 (Relikte aus den Boss-Belohnungen),
      Äonen gleich (2). Für Spieler: Tipp im Panel, ungenutzte Angriffe im Bestätigungsdialog der Vererbung
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
- [x] Tempo-Regler für die Wiedergabe (1×/2×/überspringen) in der Kopfzeile der Arena, gemerkt in `viewState.tower`
- [x] Kampfprotokoll lesbarer (Icons statt Textzeilen): aus den Wiedergabe-Ereignissen (`fightProtocol` in
      `features/towerReport.ts`), Namen in Elementfarbe, Rand nach gut/schlecht fürs Team, Filter „Nur Wichtiges“
- [x] Nach einer Niederlage: kurze Auswertung mit Tipp (`analyzeDefeat`): Die Simulation zählt je Kämpfer Schaden,
      Heilung, Treffer mit Vor-/Nachteil, Ausweicher und Ausfallzeit (`FightStats`, ohne zusätzliche Würfe). Gründe:
      Zeit abgelaufen, knapp, deutlich zu schwach, Element-Schild, Heilung der Gegner, Element-Nachteil, Wandler,
      Tempo, früh gefallenes Teammitglied – die drei stärksten werden gezeigt. Die letzte Niederlage bleibt im
      Spielstand (`tower.lastDefeat`), bis ein späterer Lauf an ihrer Etage vorbeikommt

## Leitplanken

- [x] Kämpfe bleiben deterministisch (Spiel-RNG im Spielstand) und offline schnell berechenbar – Simulation ohne Grafik
- [x] Alte Spielstände: Aufstellung (Reihen) hat einen Standard (alle vorne), nichts muss neu eingestellt werden
- [x] Umstieg mit dem Test-Bot absichern (`GENLAB_AEON=1`): Turm-Fortschritt vorher/nachher vergleichen (je Schritt)

# TODO – Turm: Stillstand abbauen, feinere Etagen und Genom-Keller

Befund (Äon-Bot, 28 Tage): acht bis dreizehn Tage ohne Turm-Fortschritt, die Team-Stärke wächst nur in Sprüngen
(letzte Relikt-Stufen, Talente). Messung der Boss-Mauer (festes Team aus vier Elementen, Faktor auf KP/ANG/VER für
50 % Siegchance, je 30 Kämpfe): Etage 35 0,28 · 38 0,43 · 39 0,83 · **40 (Regeneration) 2,19** · 41 0,91 · 45 1,76 ·
49 5,19 · **50 (Element-Schild, ohne Vorteil) 25,7** · 51 11,2. Ein Boss verlangt also das 2,6- bis 5-Fache der Werte der
Etage davor – so viel wie 9 bis 15 normale Etagen (je Etage ×1,11 KP und ×1,11 ANG, also ×1,23 „Stärke“).

Drei Schritte, in dieser Reihenfolge – jeder für sich mit dem Äon-Bot (28 Tage, Seed 2024) vorher/nachher gemessen:

1. **Etagen ×3** zuerst: eine reine Umzählung mit klarer Prüfung (neu ÷ 3 ≈ alt). Danach werden Schritt 2 und 3
   gleich in der endgültigen Zählung kalibriert statt zweimal
2. **Boss-Mauer abflachen**: die Ursache der langen Stillstände
3. **Kampferfahrung**: dauerhafte Turm-Stärke, die auch im Stillstand wächst und jede Vererbung und jedes Äon übersteht

## Schritt 1 – Etagen ×3 (heute Etage 10 = künftig Etage 30), Kampfpause 4 s

Aus jeder Etage werden drei kleinere, die neue Etage 3n ist genau so stark wie heute Etage n. Der Aufstieg fühlt sich
flüssiger an; die Mauern selbst ändert erst Schritt 2.

- [x] Gegner-Wachstum je Etage 1,11^(1/3) ≈ 1,0354 statt 1,11 (`tower.enemyGrowth`), mit Versatz in `enemyFor`
      (Exponent `floor − subFloors`), damit Etage 3n genau der alten Etage n entspricht – die Etagen 1 und 2 werden
      minimal leichter als die heutige Etage 1. Etage 3n würfelt mit dem Schlüssel der alten Etage n: gleiche Gegner,
      Elemente, Boss-Eigenheiten und Gruppen wie vorher (die bekannten Bosse bleiben an ihrer umgerechneten Stelle)
- [x] Alle Etagen-Schwellen ×3: `bossEvery` 30, `checkpointEvery` 30, `catalystEvery` 30, `bossTraitFromFloor` 60,
      `companionsFromFloor` 60, `phaseFromFloor` 90, `groupFromFloor` 36, `alleleEvery` 75, `milestoneEvery` 150,
      `weeklyBoss.minFloor` 30, `timeCrystals.towerEvery` 75, `activity.towerMilestones` ×3
- [x] Inhalte: Freischaltung Wochen-Boss Etage 10 → 30, Äon 15 → 45; Erfolge „Etage 10/50/100“ → 30/150/300
      (Namen, Beschreibungen, Boni bleiben)
- [x] Kampfpause `fightIntervalSec` 8 → 4 s: in alten Etagen gerechnet 1,5-mal so langsam wie heute, dafür bleibt die
      Arena-Wiedergabe verfolgbar (ein Durchschnittskampf von 9 s Kampfzeit läuft etwa doppelt so schnell statt 3,4-mal
      bei 2,7 s). Talent „Sturmlauf“ halbiert weiter (2 s, Untergrenze 1 s bleibt)
- [x] Turm-Marken: gleich viele pro Stunde wie heute – je neue Etage die Hälfte der Marken der entsprechenden alten
      Etage. Weil Marken abgerundet werden (0,67 pro Etage ergäbe 0), wird die Differenz einer Summenformel ausgezahlt:
      ganze Zahlen, über mehrere Etagen genau die gewünschte Menge
- [x] Spielstand-Migration (`SAVE_VERSION` 9 → 10): ×3 für `tower.best`, `bestEver`, `run.floor`, Bestenliste,
      letzte Läufe, `lastResult.floor`, `lastDefeat.floor`, `weeklyBoss.floor`, Statistik `record.towerFloor`;
      Startetage eines Laufs s → 3·(s − 1) + 1; Zeitmarken `tower:10` … umbenennen. Die KP des Wochen-Titans bleiben
      durch die exakte Abbildung gleich; Checkpoint, Meilenstein-Boni und Zeitkristall-Rekorde folgen aus dem Rekord
- [x] Offline-Last: gemessen 0,16 ms je Kampf (Desktop); 12 h offline mit Dauerkampf 0,9 s heute, etwa 1,8 s mit 4 s.
      Jetzt behält nur der letzte Kampf eines großen Zeitschritts seine Wiedergabe-Daten (`simulateFight` mit
      `replay: false`) – ein Kampf ohne sie ist 35–45 % schneller, das gleicht die doppelte Kampfzahl fast aus
- [ ] Auf dem Handy nachmessen, wie lange das Laden nach 12 h mit Dauerkampf (Auto-Neustart) dauert
- [x] Turm-Spalte: Hinweis „nächster Boss in N Etagen“ (die Spalte zeigt nur ±4 Etagen, bis zum Boss sind es bis zu 30)
- [x] Texte mit Etagenzahlen (auch `CONTENT.md`, `README.md`): die meisten lesen die Zahlen aus `balance`; fest eingetragen sind Erfolge und
      Freischaltungen. Alte Versionshinweise bleiben als Geschichte stehen
- [x] Tests und Test-Bots auf die neue Zählung; Äon-Bot vorher/nachher (neu ÷ 3 ≈ alt, wegen 4 s etwas später erreicht).
      Erster 28-Tage-Lauf (Seed 2024): Turm zur Mitte 4–9 alte Etagen zurück, am Ende 46,3 statt 49 – Wand-Messung:
      Jede Zwischenetage würfelte eigenes Element und eigene Gruppengröße (dreimal so viele ungünstige Etagen), und ein
      Wächter allein war weit oben eine Spitze (Etage 140: Faktor 5,76 statt ~2,8; Einzelgegner schlagen bis zuletzt voll
      zu). Jetzt teilen die drei kleinen Etagen einer früheren Etage deren Element und Gruppengröße, Wächter behalten die
      Aufstellung ihrer Etage. Zweiter Lauf (Seed 2024, 28 Tage), neu ÷ 3 gegen alt: Tag 4 17 / 36, Tag 9 48 / 48,
      Tag 10–28 49,7 / 48–49; Äonen 6 / 5, Talente 13 / 14, Observatorium 3/4 / 4/4. Die langsamen ersten vier Tage sind
      Streuung: 10 Tage mit Seed 7 (Tag 2 26 / 19, Tag 10 39,7 / 39) und Seed 99 (Tag 4 36,3 / 39, Tag 10 39,7 / 39).
      Der Stillstand bleibt wie vorher (Seed 7 und 99: 119 bzw. 39 ab Tag 4) – dafür sind Schritt 2 und 3 da
- [x] Versionshinweis: Der Rekord springt auf das Dreifache – nichts geht verloren, jede alte Etage ist jetzt drei
      kleinere

## Schritt 2 – Boss-Mauer abflachen

Ziel: Ein Boss kostet so viel wie etwa **3–4 normale Etagen** (in alter Zählung; Faktor ≈ 1,35–1,5 auf die Werte der
Etage davor) statt 9–15. Der Element-Schild bleibt ein Rätsel („Vorteil nötig“): mit Vorteil wie ein normaler Boss,
ohne Vorteil deutlich schwerer (Ziel ≈ 8 Etagen statt 15+).

- [x] Mauer-Messung als dauerhafter Test (`tests/towerCurve.test.ts`, Helfer `tests/towerCurve.ts`): benötigter Faktor
      auf KP/ANG/VER fester Teams (gemischt, einfarbig mit und ohne Vorteil) je Boss-Etage gegenüber den Etagen davor;
      `GENLAB_CURVE=1` gibt den Bericht aus. Vorher: gemischt Ø 9,9 frühere Etagen (5,7–13,4), Schild ohne Vorteil 19–20
- [x] Befund 1 – Zeitlimit: weit oben endeten Kämpfe an der Grenze der Team-Stärke am 40-s-Limit, ein Boss mit ×2,2 KP
      verlangte das 2,2-Fache der Werte (~7,5 Etagen) schon ohne Eigenheit, der ganze Turm wurde ab ~Etage 100 doppelt
      so steil (×1,23 je frühere Etage statt ×1,11). Ein mitwachsendes Limit (`fightLimitSec`) half in der Messung, im
      Äon-Bot kaum – verworfen
- [x] Befund 2 – Verteidigung: mit dem festen `defScale` (50) wurden Kämpfe weit oben immer länger (Etage 123: 116 s,
      ab 150: 300 s). Jetzt skalenfrei: ein Treffer wird durch 1 + `defWeight` (0,5) × VER/ANG geteilt – Kämpfe dauern
      auf jeder Höhe 20–40 s, die Kurve bleibt ×1,11 je frühere Etage, der frühe Turm fast gleich (Etage 33: 0,0255
      statt 0,0237). Das widerruft die Entscheidung „`defScale` bleibt fest“ (Kampfsystem Schritt 2)
- [x] Befund 3 – ohne Zeitlimit gewinnen Heiler-Teams jeden Boss (Schild und Regeneration verlängern nur). Deshalb
      **Wut statt Zeitlimit**: ab 30 s Kampfzeit jede Sekunde +10 % Gegner-Schaden (`enrageAfterSec`, `enrageGrowth`),
      300 s nur als Notbremse (Patt). Der Wochen-Boss hat keine Wut
- [x] Boss-Werte: KP ×1,3 (vorher 2,2), ANG ×1,05 (1,3), Begleiter 0,2/0,2 (0,35/0,4), Regeneration 25 % (40),
      Flächenangriff 40 % (60), Element-Schild ¼ – jetzt auch gegen Brand und Gift ohne Vorteil. Ergebnis gemischt
      Ø 3,7 frühere Etagen (höchstens 4,3); Schild mit Vorteil 2,4–3,8, ohne 5,4–7,0
- [x] Boss-Eigenheiten behalten ihren Charakter – nur ihre Stärke wurde angepasst
- [x] Äon-Bot: Turm deutlich höher – Seed 2024 (28 Tage) 198 statt 149, Seed 7 und 99 (10 Tage) 149–155 statt 119.
      Diagnose mit dem echten Bot-Team (Seed 7, Tag 4): Etage 149 braucht Faktor 0,87, Boss 150 1,22 → ×1,4 ≈ 3,2 frühere
      Etagen, im Ziel. Der Stillstand bleibt trotzdem (Seed 7: 149 ab Tag 4; Seed 2024: 174 an Tag 10–18, 198 ab Tag
      19): Fortschritt gibt es nur am Höhepunkt eines Durchlaufs, nach jeder Vererbung fängt der Stall von vorn an
      (Tag 5–8 braucht das Team Faktor 3,5–4,5). Genau dafür ist Schritt 3 da
- [ ] Wochen-Boss nachstellen: Der Titan folgt dem jetzt höheren Rekord – ab Woche 2 schafft der Bot nur noch 0–11 %
      (einmal 47 %), vorher meist 100 %. `weeklyBoss.hpMult` (25) oder die Etage des Titans (z. B. Rekord minus einige
      Etagen) mit dem Äon-Bot neu einstellen
- [x] Wächter alle 10 Etagen (vorgezogen in Schritt 1): ein Gegner allein mit ×1,12 KP und ×1,1 ANG – etwa eine
      frühere Etage stärker –, kein Checkpoint, keine Eigenheit; 🛡️ in der Turm-Spalte, Hinweis in der Vorschau

## Schritt 3 – Kampferfahrung (Turm-Stärke, die jede Vererbung und jedes Äon übersteht)

Der Stall fängt nach jeder Vererbung von vorn an, der Turm-Rekord nicht. Die Kampferfahrung gleicht das aus: Jeder Sieg
im Turm bringt Erfahrung, sie gehört dem Spieler (wie Relikte) und macht jedes künftige Turm-Team stärker. Wer an einer
Mauer hängt und mit Auto-Neustart weiterkämpft, kommt dadurch langsam, aber sicher weiter.

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
- [ ] Verworfen (vorerst): Stärke-Zuwachs nur beim Vererben aus dem Rekord des Laufs – wächst in groben Sprüngen
      (1–2 Vererbungen am Tag) und belohnt nicht, dass man an einer Mauer weiterkämpft

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
    (siehe Endgame → „Weitere Splitter-Quellen“)
  - Überschneidung mit der „Tiefenexpedition“ (Endgame → Später) und dem Dungeon im GenLab RPG prüfen – nicht drei
    Systeme bauen, die alle „immer tiefer“ sind
- [ ] Technik: `features/tower.ts` so verallgemeinern, dass Turm und Keller aus Daten entstehen (Definitionen in
      `content/endgame.ts`, Richtung auf/ab) statt einer Kopie des Turm-Codes
- [ ] Arena im Keller-Stil (Gewölbe, Fackellicht, dunkle Farben, Gegner-Tönung); Ebenen zählen nach unten (−1, −2 …)

# TODO – Brut

- [x] **Brutritual muss selbst geöffnet werden**: Ritual-Eier schlüpfen nicht mehr von allein, sondern bleiben
      fertig im Ritualnest liegen, bis der Spieler sie antippt
  - [x] Core: `ProcessHandler.waitsForPlayer` – ein fertiger Vorgang bleibt stehen (`isWaiting`), auch in der
        Offline-Zeit über dem Deckel; Aktion `openRitualEgg` schließt ihn ab und gibt die Schlüpflinge zurück
  - [x] Das Ritualnest bleibt belegt, bis das Ei geöffnet ist (kein neues Ritual davor)
  - [x] Enthüllung beim Öffnen: Ei wackelt, bricht auf, Karte mit Strahlen in der Farbe der Seltenheit;
        mit reduzierter Bewegung sofort
  - [x] Hinweis: Zähler am Reiter Brutstation (`readyRitualEggs`), Benachrichtigung „Ritual-Ei bereit ✨“ statt
        „Ei geschlüpft“
  - [x] Der Zuchtautomat öffnet Ritual-Eier nicht – das bleibt der Moment des Spielers
  - [x] Test-Bot (`tests/longrun.ts`) öffnet fertige Ritual-Eier selbst; Changelog-Eintrag

# TODO – GenLab RPG (ein Monster, aktiver Dungeon)

Ein einzelnes Monster zieht allein in einen Dungeon oder auf Erkundung. Anders als der Rest des Spiels wird hier
aktiv und rundenbasiert gespielt: drei Fähigkeiten und eine stärkere Fähigkeit. Isekai: Das Monster wird in eine
andere Welt gezogen, fängt dort bei Stufe 1 an und wird nur dort stärker; während des Laufs ist vom Labor nichts zu
sehen. Die Belohnungen (Zeitkristalle, wertvolle Gegenstände, Ausrüstung) kommen mit zurück.
Löst die grobe Idee „Isekai mit einem ausgewählten Monster“ (Endgame → Ideen) ab.

## Vor dem Start klären

- [x] Freischaltung: ab Turm-Etage 20 (nach dem Bot schafft ein Turm-Monster dann das Wurzellabyrinth; liegt
      zwischen Turm und Wochen-Boss). `towerFloor` zählt auch den Rekord aller Zeiten – nach einem Äon ist das RPG
      sofort wieder da
- [x] Stufen: ~~Mischform (Variante C)~~ → **Isekai** (umgebaut nach Rückmeldung): In der anderen Welt beginnt jedes
      Monster bei Stufe 1 mit den Grundwerten seiner Art – Seltenheit, Genom, Infusion und Tränke zählen dort nicht.
      Die Stufe bleibt dem Monster (die Erfahrung liegt in `rpg.ranks`), je Stufe +12 % der Grundwerte. Die Wahl aus
      3 Verbesserungen (bei jedem Aufstieg und nach Elite-Kämpfen) gilt nur für den Lauf. Die Art bestimmt Werte,
      Element und Technik; eine aufgedeckte Erbanlage oder Fähigkeit weiter die dritte Fähigkeit.
  - [x] Die Stufe hängt an der Kreatur und geht mit ihr verloren (Verkauf, Recycling, Vererbung)
  - [ ] Idee zum Überlegen: Die Stufe hängt an der **Art** statt an der einzelnen Kreatur – dann übersteht sie jeden
        Neustart, und ein neuer Glutwelpe knüpft an den alten an. Frage: Lohnt sich dann noch ein zweites Monster
        derselben Art, und wird der Dex zum „Helden-Buch“?
- [x] Gilt die Ausrüstung auch im Turm? Festgelegt: nein – sie wirkt nur im Dungeon, die Turm-Kurve bleibt unberührt

## Isekai-Umbau (die andere Welt)

- [x] Schritt 1: Stufe-1-Werte aus der Art, dauerhafte Stufe je Monster (`rpgLevel`), Verbesserungen nur im Lauf
- [ ] Schritt 2: eigene Gegner-Skala nach Dungeon-Stufe statt Turm-Etage, Bot auf Stufe-L-Helden, neu abstimmen
- [ ] Schritt 3: Während eines Laufs zeigt die App nur die andere Welt (keine Reiter, keine Ressourcenleiste, Meldungen
      still ins Nachrichten-Center), kleines Menü mit Ton und „Aufgeben“
- [ ] Schritt 4: Portal-Animation – das Monster wird in einen Strudel gesogen; Rückweg nach dem Lauf; reduzierte
      Bewegung: Überblendung
- [ ] Schritt 5: eigenes Design der anderen Welt – dunkle Fantasy, Pergament und Fackellicht, Raumpfad statt
      Knopfliste, neue Kampfszene
- [ ] Schritt 6: eigene Musikstimmung und Portal-Klang
- [ ] Schritt 7: Versionshinweis, Doku, PR

## Schritt 1 – Grundlage und Spam-Schutz

- [x] Neues Modul `core/features/rpg.ts`: Lauf-Zustand im Spielstand (Monster, Raum, KP, Stufe, Beute) – deterministisch
      mit dem Spiel-RNG, übersteht Neuladen, pausiert offline
- [x] Monster auswählen: Es ist während des Laufs beschäftigt (eigener Job), `canConsume` schützt es
- [ ] **Eintritts-Ressource gegen Spammen**, Vorschlag „Fackeln“ 🔥: 1 neue alle 6 h, höchstens 3 gespeichert
      (Muster wie `weeklyBoss.attemptsPerDay` / `maxAttempts`); weitere aus Gen-Aufträgen, Wochen-Boss und
      Turm-Meilensteinen; Zahlen in `balance.ts`
  - [x] Ressource `torches`, Nachfüllen nach echter Uhr (`balance.rpg`), Vorrat beim Freischalten voll
  - [x] Tagesbelohnung: +1 Fackel, am letzten Kalendertag +2 (`balance.rpg.dailyTorches`), auch über den Vorrat hinaus
  - [ ] Weitere Quellen (Gen-Aufträge, Wochen-Boss, Turm-Meilensteine) – erst nach Rückmeldungen zur Fackel-Menge
- [x] Zusätzlich: Beute ist erst beim Verlassen oder an Rastpunkten gesichert; wer stirbt, behält nur einen Teil
      (`balance.rpg.defeatKeep`; eine Vererbung beendet den Lauf wie ein Verlassen)
- [x] Wertvollste Beute (Zeitkristalle, Äon-Splitter) mit Wochen-Deckel, damit das Idle-Spiel nicht davon abhängt

## Schritt 2 – Rundenkampf

- [x] Ablauf: Spieler wählt eine Fähigkeit, dann handelt der Gegner; Tempo (TMP) bestimmt, wer zuerst zieht
- [x] Drei Fähigkeiten aus dem Monster abgeleitet: Grundangriff, Element-Technik (wie im Turm, `content/techniques.ts`),
      eine dritte aus Fähigkeiten oder Erbanlagen (Schutz, Heilung, Gift …); mit Abklingzeit in Runden
      (`content/rpg.ts`, `features/rpgCombat.ts`: aufgedeckte Erbanlage vor Fähigkeit vor Rolle)
- [x] Eine stärkere Fähigkeit (Spezialangriff), lädt sich über Treffer und Runden auf
- [x] Werte aus den Zuchtwerten (KP, ANG, VER, TMP), Element-Vorteil wie im Turm – gute Zucht zahlt sich aus
- [x] Gegner zeigen ihren nächsten Zug an (Angriff, Aufladen, Schild), damit jede Wahl zählt
- [x] Kampf-Logik ohne DOM, testbar in Node; Inhalte (Gegner, Fähigkeiten) als Daten mit Prüfung in `validate.ts`

## Schritt 3 – Dungeon und Roguelite

- [x] Dungeon aus Räumen: Kampf, Elite, Schatz, Rast (heilen, Beute sichern), Ereignis, Boss am Ende;
      nach jedem Raum Wahl aus 2–3 Wegen
  - [x] Kampf, Elite, Schatz, Rast, Boss; Wegwahl nach `balance.rpg.roomWeights`
  - [x] Ereignisse (`rpgEvents`: kurze Szene, zwei Entscheidungen, riskante mit Fehlschlag)
- [x] Erfahrung aus Kämpfen; bei jedem Stufenaufstieg Wahl aus 3 Verbesserungen (Werte, stärkere Fähigkeit,
      passiver Effekt) – so wird jeder Lauf anders
      (`rpgUpgrades`: Werte, Fokus/Kraftspeicher für den Spezialangriff, Lebensraub, Kritisch, Zweite Luft, Drill)
- [x] Mehrere Dungeons mit Element-Thema, nacheinander freigeschaltet; Tiefe = Schwierigkeit und Belohnung
      (`rpgDungeons`: Stärke auf der Turm-Skala je Raum, Beute-Faktor; Sieg über den Boss öffnet den nächsten)
- [x] Niederlage beendet den Lauf, gesicherte Beute bleibt

## Schritt 4 – Belohnungen und Ausrüstung

- [x] Beute: Zeitkristalle, Katalysator, Genproben mit seltenen Allelen, Turm-Marken, selten Äon-Splitter
- [x] Ausrüstung (Waffe, Panzer, Talisman) mit Seltenheiten; gehört dem Spieler (wie Relikte), übersteht Vererbung
      und Äon, kann jedem Monster angelegt werden
      (`rpgGear`; getragene Funde gehen bei einer Niederlage verloren, Bosse lassen immer ein Teil fallen)
- [x] Dauerhafter Fortschritt zwischen Läufen aus einer eigenen RPG-Währung (z. B. Startbonus, vierte Fähigkeit,
      mehr Fackeln)
      (Runen 🪬 aus Elite, Boss und zerlegter Ausrüstung; `rpgMeta`: Werte, Vorladen, Rast, Fackelhalter, Vielseitig)
- [x] Balancing mit einem Test-Bot (einfache Strategie: stärkster verfügbarer Zug): Beute pro Fackel,
      Einfluss auf Idle-Wirtschaft und Äon-Splitter
      (`tests/rpgBot.ts`, Tabelle mit `GENLAB_RPG=1 npx vitest run tests/rpgBot.test.ts --silent=false`; der Held ist
      ein Mitglied eines gemischten Turm-Teams, das Etage F gerade hält. Stand: Wurzellabyrinth ab F20–30,
      Glutgrotten ~F60, Flutgewölbe ~F100–120, Sturmspitze ~F120–150, Schattengruft ~F160–180, Kristallkern ~F200+
      – ohne Rang, Ausrüstung und Runen-Wissen. 60–800 Turm-Marken je Fackel; Zeitkristalle und Äon-Splitter
      begrenzt der Wochen-Deckel)
  - [ ] Übergang von „schafft es nie“ zu „schafft es immer“ ist noch steil (etwa ×1,5 Stärke) – mehr Streuung?

## Schritt 5 – Darstellung

- [x] Eigener Bildschirm „GenLab RPG“ (auf dem Handy Vollbild), Raumkarte, Fähigkeitsknöpfe unten in Daumenreichweite
      (Reiter „GenLab RPG“ unter Abenteuer, als Vorschau unter Optionen einschaltbar; Fähigkeiten klebend unten)
- [x] Kämpfer, Zustände und Zahlen wie in der Turm-Arena wiederverwenden; `.reduce-motion` beachten
      (Kreaturbilder, Zustands-Symbole, KP-Balken, Wackeln und schwebende Schadenszahlen je Runde)
- [x] Sound-Hooks gleich mit anlegen (siehe „TODO – Sound“)
      (Ereignisse `rpgRound`, `rpgRunEnded`, `rpgLevelUp` → Turm-Klänge in `ui/soundEvents.ts`)

## Weitere Ideen

- [ ] Tages-Dungeon: feste Karte für alle Läufe des Tages, eigene Bestenliste im Spielstand
- [ ] Dungeon-Fundstück: Ei einer Art, die es nur dort gibt (neuer Dex-Eintrag)
- [ ] Gefährten-Ereignis: ein zweites Monster hilft für ein paar Runden
- [ ] „Tiefenexpedition“ (Endgame → Später) mit diesem Dungeon zusammenlegen statt getrennt bauen

## Leitplanken

- [x] Das Idle-Spiel bleibt Hauptsache: RPG ist freiwillig, seine Belohnungen beschleunigen nur
      (Wochen-Deckel für Zeitkristalle und Äon-Splitter, Ausrüstung wirkt nicht im Turm)
- [x] Deterministisch und im Spielstand; Zahlen in `balance.ts`, Inhalte in `content/`, Regeln in `core`
- [x] Alte Spielstände: neue Felder mit Standardwerten, keine Migration nötig
