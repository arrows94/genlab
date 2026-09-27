# Projekt: „Genlab“ – Idle-Kreaturenzucht mit Genetik (Neubau)

## Rolle & Ziel
Du bist ein erfahrener Game-Developer mit Fokus auf Idle-/Incremental-Games und sauberer, erweiterbarer Architektur. Baue das Browser-Idle-Game „Genlab“ komplett neu. Es existiert bereits ein Prototyp (eine einzelne HTML-Datei); alle Features daraus sollen übernommen, aber sauber neu strukturiert und deutlich erweitert werden.

Oberste Priorität ist **Erweiterbarkeit**: Neue Kreaturen, Fähigkeiten, Gene, Gebäude, Tränke, Missionen und Endgame-Systeme müssen sich später hinzufügen lassen, **ohne bestehenden Code umzuschreiben** – idealerweise nur durch neue Einträge in Daten-Dateien.

Sprache im Spiel: **Deutsch**. Code, Variablennamen und Kommentare: Englisch.

---

## Tech-Stack
- **TypeScript** (strict mode) + **Vite**
- UI: **Svelte** (oder React, falls du begründet besser findest) – das Spiel ist UI-lastig (Listen, Karten, Menüs), dafür ist Web-Technik besser geeignet als eine klassische Game-Engine
- Grafik: Kreaturen prozedural als **SVG** (wie im Prototyp); optional **PixiJS** nur für animierte Szenen (z. B. Brut-Animation), aber nicht als Pflicht
- Große Zahlen: **break_infinity.js** (oder vergleichbar), da Idle-Zahlen schnell sehr groß werden
- Tests: **Vitest** für die Spiellogik
- Speichern: localStorage/IndexedDB + **Export/Import als Text-String** (Backup)
- Später optional als Desktop-/Mobile-App verpackbar (Tauri/Capacitor) – Architektur darf dem nicht im Weg stehen

---

## Architektur-Vorgaben (wichtig)
1. **Strikte Trennung von Logik und UI**
   - `src/core/` – reine Spiellogik, kein DOM, keine UI-Imports, vollständig testbar
   - `src/ui/` – nur Darstellung, liest den State und löst Aktionen aus
   - `src/content/` – alle Spielinhalte als **Daten** (TS- oder JSON-Dateien)
2. **Datengetriebene Inhalte**: Arten, Gene, Fähigkeiten, Hybrid-Rezepte, Gebäude, Upgrades, Tränke, Missionen, Seltenheiten, Dex-Belohnungen, Balancing-Werte. Jede Inhaltsart hat ein TypeScript-Interface und wird beim Start validiert (fehlerhafte Einträge → verständliche Fehlermeldung).
3. **Balancing zentral** in einer Datei `src/content/balance.ts` (Kostenkurven, Zeiten, Wahrscheinlichkeiten), damit ich ohne Logik-Änderungen feintunen kann.
4. **Modifier-System**: Alle Boni (Forschung, Dex, Tränke, Prestige, Fähigkeiten, Gene) laufen über ein einheitliches System aus Modifikatoren (`add`, `mult`, Ziel z. B. `production.gold`, `breeding.time`). Neue Boni = neuer Datensatz, keine Sonderlogik.
5. **Tick-basierte Simulation** mit fester Zeitschrittlogik; Offline-Fortschritt nutzt dieselbe Logik (mit Obergrenze, z. B. 12 h, per Upgrade erweiterbar).
6. **Event-Bus** für Spielereignisse (Kreatur geschlüpft, Dex-Eintrag neu, Stufe freigeschaltet …) – UI-Toasts, Achievements und Statistiken hängen sich daran, statt fest verdrahtet zu sein.
7. **Versionierte Spielstände mit Migrationen** (`saveVersion` + Migrationsfunktionen je Version).
8. **Deterministischer Zufall** (seedbarer RNG), damit Tests reproduzierbar sind.
9. Unit-Tests mindestens für: Vererbung/Genetik, Seltenheits-Würfe, Kostenberechnung, Offline-Fortschritt, Save-Migration, Prestige-Reset.
10. Eine kurze `CONTENT.md`, die erklärt, wie man neue Kreaturen/Gene/Rezepte/Upgrades hinzufügt – mit je einem Beispiel.

---

## Bestehende Features (alle übernehmen)
- **Kreaturen** mit Art, Typ/Element, Generation, Statuswerten (HP, ATK, DEF, SPD), prozeduralem Aussehen (Farbton, Muster, Augen, Horn – vererbbar), umbenennbar
- **Fähigkeiten** in Stufen (Gewöhnlich → Legendär) mit Produktions-, Status- und Spezialeffekten (Mutationschance, Brutzeit)
- **Brutstation**: zwei freie Kreaturen → Ei mit Brutzeit → Nachwuchs erbt Stats (gemittelt + Mutation), Fähigkeiten (aus Elternpool + Mutation), Aussehen; Kosten in Gold/Nahrung; mehrere Nester per Ausbau; Fortschrittsanzeige als DNA-Helix
- **Anlagen / Idle-Jobs**: Farm (Nahrung), Mine (Gold), Bio-Labor (Essenz, freischaltbar), begrenzte Plätze, ausbaubar
- **Erkundung**: Kreatur auf Missionen (kurz/mittel/lang) schicken, kostet Nahrung, bringt Ressourcen, Chance auf wilde Kreatur; mehrere Camps per Ausbau
- **Kreatur-Seltenheit** (unabhängig von Fähigkeiten), echte Drop-Chance bei Geburt/Fund: Gewöhnlich, Ungewöhnlich, Selten, Episch, Legendär, Mythisch – mit Stat-Multiplikator und eigenem Kartenrahmen
- **Monster-Dex**: Raster Art × Seltenheit; erste Entdeckung einer Stufe gibt dauerhafte Boni bzw. schaltet Forschung frei
- **Forschung**: Inkubator, Genlabor, Nest-/Job-/Camp-Ausbauten, Auto-Sammler, Kartograf, Ahnenlabor, Legendäres Erbgut, Ur-Gen-Kammer (die letzten beiden über Dex freigeschaltet)
- **Markt / Tränke**: Kraftfutter (dauerhaft +% auf einen Stat, pro Kreatur steigende Kosten), Turbo-Trank (eine Kreatur, temporär), Festmahl (global, temporär), Zeitkristall (verkürzt laufende Vorgänge)
- **Vererbung (Prestige)**: Gold + Nahrung gegen Erbgut-Punkte (dauerhaft +% Produktion); Reset von Kreaturen/Ressourcen/Vorgängen, Forschung/Dex/Essenz bleiben
- Automatisches Speichern, Offline-Fortschritt, Toast-Benachrichtigungen, Tab-Badges wenn etwas fertig ist

---

## Neue / erweiterte Features

### 1. Genetik & DNA-Sequenzierung (Kernsystem)
- Jede Kreatur hat ein **Genom** aus mehreren **Gen-Loci** (z. B. Kraft, Ausdauer, Tempo, Panzer, Ertrag, Fruchtbarkeit, Farbe, Muster, Element-Affinität). Jeder Locus hat **zwei Allele** (dominant/rezessiv, ggf. kodominant).
- Vererbung: Jedes Elternteil gibt pro Locus zufällig ein Allel weiter (Mendel), plus Mutationschance.
- **Verborgene Gene**: Neue/wilde Kreaturen haben ein unbekanntes Genom. Im **Sequenzierlabor** kann man es gegen Essenz + Zeit entschlüsseln. Erst sequenzierte Kreaturen zeigen ihre Allele – das ist die Grundlage für geplantes Züchten.
- **Genbibliothek**: einmal sequenzierte Allele werden katalogisiert (eigene Sammelaufgabe).
- Spätere Stufe: **Gen-Splicing** – gezielt ein Allel übertragen/ersetzen (teuer, begrenzte Versuche, Chance auf Instabilität).
- **Zuchtplaner**: vor dem Brüten zeigt eine Vorschau die Wahrscheinlichkeiten für Allele, Hybrid-Arten und Seltenheit (nur für sequenzierte Eltern genau, sonst „unbekannt“).
- Die Genom-Darstellung als stilisierte DNA-Sequenz (Basenpaare/Farbbalken) – visuelles Markenzeichen des Spiels.

### 2. Größerer Kreaturen-Pool & Hybride
- **12–16 Basisarten** über mehrere Elemente (Feuer, Wasser, Erde, Luft, Elektro, Natur + z. B. Eis, Schatten, Licht, Metall, Gift, Kristall).
- **Hybrid-Arten** entstehen durch Rezepte: Art A × Art B (optional mit Bedingungen, z. B. bestimmtes Allel, Mindest-Generation, Seltenheit) → neue Art. Rezepte sind reine Daten.
- **Evolution**: Kreaturen können sich bei Erfüllung von Bedingungen (Generation, Gene, Items) weiterentwickeln.
- Mehrstufige Stammbäume (Basis → Hybrid → seltene Hybride → Mythische Endformen).
- Neue Rezepte sind zunächst unbekannt und werden im Dex als „???“ angezeigt; Hinweise gibt es über Forschung oder Erkundung.
- Dex erweitert: Arten × Seltenheit, plus Hybrid-Stammbaum-Ansicht.

### 3. Besseres Management
- Kreaturenliste mit **Sortieren/Filtern** (Art, Element, Seltenheit, Generation, Stat, Job, Gen-Allel), Suchfeld
- **Favoriten sperren** (schützt vor Verkauf/Reset-Aktionen)
- **Freilassen/Verkaufen** einzeln und im Stapel (bringt Ressourcen) – begrenzter **Stall-Platz**, ausbaubar
- **Auto-Zuweisung** von Jobs nach bester Eignung (freischaltbar)
- **Auto-Brüten** (später freischaltbar): Regeln wie „züchte immer die zwei besten Kreaturen für Stat X“
- Detailansicht je Kreatur: Genom, Stammbaum (Eltern/Großeltern), Boni-Aufschlüsselung
- Statistik-Seite (Gesamt-Geschlüpfte, Rekorde, Spielzeit)

### 4. Infusion & Gen-Kapseln (Verwertung überzähliger Kreaturen)
Zwei Wege, überzählige Kreaturen sinnvoll zu verbrauchen, statt sie nur zu verkaufen. Gesperrte Favoriten und Kreaturen, die gerade arbeiten, brüten oder unterwegs sind, dürfen nie verbraucht werden.

**Infusion (gezielt verstärken)**
- Eine Zielkreatur nimmt beliebig viele **Kreaturen derselben Art** auf. Die „Opfer“ verschwinden.
- Jede Infusion gibt **Infusions-EP**. Die Menge hängt von Seltenheit und Generation des Opfers ab: Seltenere Opfer geben deutlich mehr.
- Infusions-Stufen (z. B. +1 bis +10, im UI als „+3“ neben dem Namen) geben pro Stufe einen Stat-Bonus in Prozent. Stufen kosten exponentiell mehr EP, damit die Obergrenze ein Langzeitziel bleibt.
- **Allel-Übertragung**: Bei jeder Infusion gibt es eine kleine Chance, dass ein besseres Allel des Opfers auf das Ziel übergeht. Das funktioniert nur mit sequenzierten Kreaturen und verbindet die Infusion mit dem Genetik-System.
- **Durchbruch**: Bei Maximalstufe kann eine Kreatur mit einer Kreatur derselben Art **und derselben Seltenheit** plus einem seltenen Material die Seltenheit um eine Stufe erhöhen (nicht über Legendär hinaus; Mythisch bleibt nur durch Zucht/Glück erreichbar). Das ist teuer und ein klares Endgame-Ziel.
- Vorschau vor dem Bestätigen: gewonnene EP, neue Stufe, Chance auf Allel-Übertragung.
- Stapel-Infusion: „alle Gewöhnlichen dieser Art infundieren“, mit Bestätigung.

**Gen-Kapseln (Zufalls-Belohnung)**
- Überzählige Kreaturen beliebiger Art werden im **Gen-Recycler** in **Gen-Fragmente** zerlegt (seltenere Kreaturen geben mehr).
- Mit Fragmenten öffnet man **Gen-Kapseln**, die eine zufällige Kreatur enthalten. Es gibt mehrere Kapsel-Stufen (z. B. Standard, Element-Kapsel mit festem Element, Premium), die unterschiedlich teuer sind und andere Chancen haben.
- **Chancen offen anzeigen**: Jede Kapsel zeigt die genauen Wahrscheinlichkeiten für jede Seltenheit.
- **Pity-System**: Nach X Kapseln ohne mindestens „Episch“ ist die nächste garantiert Episch. Der Zähler ist sichtbar.
- Kapseln können auch Arten enthalten, die man noch nicht besitzt, sogar Hybride, deren Rezept man noch nicht kennt. So gibt es einen zweiten Weg in den Dex neben der Zucht.
- Öffnungs-Animation kurz halten und überspringbar machen; Stapel-Öffnen (z. B. ×10) mit Ergebnisübersicht.
- **Nur Spielwährung**: keine Echtgeld-Käufe und keine Werbung – das Spiel bleibt ein reines Einzelspieler-Spiel.

Balancing-Hinweis: Infusion soll sich für gezielt gezüchtete Top-Kreaturen lohnen, Kapseln für Sammler. Kapseln dürfen die Zucht nicht ersetzen: Mythische Kreaturen sind aus Kapseln deutlich seltener als aus gezielter Zucht mit Ahnenlabor.

### 5. Typischer langsamer Idle-Start (Progression)
- Start mit **einer** Kreatur und manuellem Sammeln (Klicken) – Automatisierung kommt schrittweise
- Systeme werden nacheinander freigeschaltet: Sammeln → Farm → Brutstation → Mine → Erkundung → Bio-Labor → Infusion → Sequenzierung → Markt → Gen-Recycler/Kapseln → Hybride → Prestige → Endgame
- Jede Freischaltung mit kurzem Hinweistext (kein langes Tutorial)
- Kostenkurven exponentiell, aber so balanciert, dass die ersten 30–60 Minuten regelmäßig etwas Neues passiert
- Meilenstein-/Achievement-System mit kleinen Dauerboni

### 6. Endgame (siehe Abschnitt unten)

---

## Endgame-Systeme
Umsetzen in späteren Phasen, Architektur aber von Anfang an darauf auslegen:
1. **Genom-Turm (Auto-Kampf, endlos)**: Team aus 3–5 Kreaturen kämpft automatisch Etage für Etage; Gegner skalieren endlos, Elemente-Stärken/-Schwächen zählen. Belohnungen: seltene Allele, Evolutions-Items, Turm-Währung. Rangliste der eigenen Bestwerte.
2. **Zweite Prestige-Ebene „Äon“**: Setzt auch Forschung zurück, gibt eine neue Währung für einen eigenen Talentbaum (neue Mechaniken statt nur Prozente, z. B. mehr Gen-Loci, Zwillingsgeburten, dauerhaftes Auto-Brüten).
3. **Perfektions-Jagd**: „Perfektes Genom“ (alle Loci mit Top-Allelen), seltene **Farbmutationen** („Schillernd“, sehr niedrige Chance), mythische Endformen – als Sammelziele im Dex.
4. **Anomalie-Herausforderungen**: Durchläufe mit Einschränkungen (z. B. keine Tränke, halbe Brutzeit aber doppelte Kosten); Abschluss gibt dauerhafte Boni.
5. **Unendliche Forschung**: einige Forschungen ohne Maximalstufe mit abnehmendem Ertrag, als dauerhafter Ressourcen-Sink.
6. **Wöchentliche Mutation**: datumsbasierter Seed ändert eine Regel pro Woche (z. B. „Eis-Kreaturen +50% Ertrag“) – offline berechenbar, kein Server nötig.

---

## Vorgehen in Phasen
Arbeite in dieser Reihenfolge und stoppe nach jeder Phase mit einer kurzen Zusammenfassung, bevor du weitermachst:

1. **Fundament**: Projekt-Setup, Ordnerstruktur, Content-Interfaces + Validierung, Modifier-System, Tick/Offline, Save/Load/Migration, Event-Bus, Tests
2. **Portierung**: alle bestehenden Features auf neuer Architektur, inkl. langsamer Start/Freischaltungen
3. **Genetik**: Genom, Mendel-Vererbung, Sequenzierlabor, Genbibliothek, Zuchtplaner
4. **Arten & Hybride**: erweiterter Kreaturen-Pool, Rezepte, Evolution, erweiterter Dex
5. **Management & Verwertung**: Filter/Sortierung, Stall, Verkauf, Auto-Zuweisung, Detailansicht, Statistiken, Infusion (inkl. Durchbruch), Gen-Recycler & Gen-Kapseln mit Pity-System
6. **Endgame**: Genom-Turm, Äon-Prestige, Perfektions-Jagd, Anomalien, unendliche Forschung, Wochen-Mutation
7. **Feinschliff**: Balancing-Durchgang, Animationen, Mobile-Layout, Export/Import

---

## Design
- Dunkles, modernes „Genlabor“-Design (Petrol/Türkis + Violett als Akzente, Gold für Seltenes), gut lesbare Zahlen in Monospace
- Seltenheiten klar farbcodiert, Mythisch mit Glow-Animation
- Muss am Handy (Hochformat) genauso bedienbar sein wie am Desktop
- Zahlenformatierung: deutsch (1.234,5), große Zahlen mit Kürzeln (Tsd., Mio., Mrd. …, später wissenschaftlich)

## Qualitätsanforderungen
- Keine Logik in UI-Komponenten
- Keine „magischen Zahlen“ im Code – alles in `balance.ts` oder Content-Dateien
- Tests laufen grün vor jedem Phasenabschluss
- README mit Start-Anleitung (`npm install`, `npm run dev`, `npm test`, `npm run build`)
