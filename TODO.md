# TODO – visuelle Überarbeitung

Bereits erledigt: Gen-Splicing (Werkbank), Infusion (Kammer), Genom-Turm, Erkundung (Weltkarte),
Brutstation (Nester & Paarungsaltar), mitscrollende Ressourcenleiste, Anlagen, Forschung, Vererbung, Markt, Monster-Dex, Genlabor.

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
  - [ ] Dieselbe Übersicht und Zeitleiste auch im Äon-Tab

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
  - [ ] Splitter und Observatorium angleichen: Das Observatorium öffnet Stufe 4/5 deutlich früher, als die Splitter
        reichen (Tag 28: 2 Splitter übrig, Stufe 4 kostet je 8). Vorschlag: Stufe 4/5 günstiger (z. B. 6/9) oder
        mehr Splitter pro Äon
- [ ] **Turm-Mechaniken vertiefen**
  - [ ] Bosse mit Eigenheiten (Element-Schild, Elementwechsel pro Runde, Heilung)
  - [ ] Relikte: Ausrüstung pro Kreatur für Turm-Marken (dauerhafte Verwendung für Marken)
  - [ ] Meilensteine alle 50 Etagen mit dauerhaftem Bonus
- [ ] **Anomalien mit Stufen und Kombinationen**
  - [ ] Schwierigkeitsstufen I–V pro Anomalie
  - [ ] Mehrere Anomalien gleichzeitig aktivierbar
  - [ ] Belohnung wächst mit der Gesamtschwierigkeit
- [ ] **Stammbaum-Dynastien**: wachsender Bonus für reine Linien über viele Generationen

## Später

- [ ] **Tiefenexpedition**: endlose Region, mit jeder Tiefe gefährlicher und lohnender
- [ ] **Dritte Prestige-Stufe** (z. B. „Genesis“) – erst, wenn Äon ausgereizt ist
- [ ] **Endgame-Erfolge und Statistiken** als Langzeitziele (alle 198 Dex-Einträge, Etage 200 …)
- [x] Balancing der neuen Systeme mit dem Test-Bot über mehrere Äonen prüfen (siehe Äon-Talentbaum)

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
