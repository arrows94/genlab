/**
 * Player-facing release notes ("Was ist neu?"). Newest entry first; `id`
 * counts up by one per release. Write for players, not developers: what can
 * I do now that I couldn't before?
 *
 * No spoilers: an item with `feature` is only shown once the player has
 * unlocked that feature (ids from content/progression.ts). Hidden items are
 * only counted ("… und 2 Verbesserungen für Bereiche, die du noch entdeckst").
 *
 * The build also publishes this list as `changelog.json`, so an older
 * version can preview the notes in its update banner.
 */
export interface ChangelogItem {
  text: string;
  feature?: string;
}

export interface ChangelogEntry {
  id: number;
  /** ISO date, shown as "28. September 2026". */
  date: string;
  title: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 21,
    date: '2026-09-30',
    title: 'Unterreiter in Daumenreichweite',
    items: [
      { text: 'Auf dem Handy liegen die Unterreiter jetzt unten direkt über den Bereichen – alles in Daumenreichweite.' },
      { text: 'Behoben: Auf dem Handy ließ sich die Forschung seitlich verschieben, sobald eine Forschung ganz abgeschlossen war.', feature: 'research' },
    ],
  },
  {
    id: 20,
    date: '2026-09-30',
    title: 'Aufgeräumte Reiter und Ritual-Eier zum Selbstöffnen',
    items: [
      { text: 'Die Reiter sind jetzt in Bereiche sortiert: Labor, Zucht, Abenteuer, Fortschritt und Optionen. Darunter wählst du den Unterreiter, z. B. Brutstation oder Genlabor. Auf dem Handy passen die Bereiche ohne Scrollen in die untere Leiste.' },
      { text: 'Reiter, in denen gerade etwas läuft, zeigen eine sich füllende Leiste – etwa Eier in der Brutstation, Erkundungen oder Sequenzierungen. Die Leiste zeigt, was als Nächstes fertig wird – am Computer verrät der Mauszeiger, wie lange es noch dauert. Ein laufender Turm-Lauf schimmert.' },
      { text: 'Behoben: Nach dem Import eines Spielstands oder dem Übernehmen des Cloud-Spielstands ließ sich kein Brutritual starten – der Knopf reagierte nicht.', feature: 'specialBreeding' },
      { text: 'Jeder Bereich merkt sich, wo du zuletzt warst. Zähler an den Bereichen zeigen, wo etwas auf dich wartet – auch bei frisch freigeschalteten Reitern.' },
      { text: 'Ritual-Eier schlüpfen nicht mehr von allein: Ist das Ritual fertig, leuchtet das Ei im Ritualnest und wartet, bis du es mit „✨ Ei öffnen“ aufbrichst – samt großer Enthüllung in der Farbe der Seltenheit. Bis dahin bleibt das Ritualnest belegt; der Zuchtautomat öffnet keine Ritual-Eier.', feature: 'specialBreeding' },
      { text: 'Die Brutstation zeigt fertige Ritual-Eier als Zähler am Reiter an, und die Benachrichtigung meldet „Ritual-Ei bereit“.', feature: 'specialBreeding' },
      { text: 'Tempo-Regler in der Turm-Arena: Kämpfe normal (1×), doppelt so schnell (2×) ansehen oder die Wiedergabe überspringen (⏭). Die Wahl bleibt gespeichert.', feature: 'tower' },
    ],
  },
  {
    id: 19,
    date: '2026-09-30',
    title: 'Kein seitliches Wackeln mehr auf dem Handy',
    items: [
      { text: 'Auf dem iPhone (als Web-App vom Home-Bildschirm) ließ sich die Seite seitlich verschieben, sobald die Ressourcenleiste breiter als der Bildschirm war. Das ist behoben.' },
      { text: '„Was ist neu?“ und andere Fenster lassen sich auch auf kleinen Bildschirmen immer schließen – lange Texte scrollen, der Knopf bleibt sichtbar.' },
      { text: 'Bestenliste und „Letzte Läufe“ im Turm passen jetzt auch auf schmale Bildschirme.', feature: 'tower' },
    ],
  },
  {
    id: 18,
    date: '2026-09-30',
    title: 'Gegnergruppen und Boss-Phasen im Turm',
    items: [
      { text: 'Ab Etage 12 kämpfst du oft gegen zwei oder drei Gegner zugleich. Sie teilen sich die Stärke der Etage, dein Team greift zuerst den schwächsten in der vorderen Reihe an.', feature: 'tower' },
      { text: 'Turm-Gegner und Begleiter setzen jetzt selbst die Technik ihres Elements ein – Brand, Heilung, Schild, Frost und mehr. Bosse verlassen sich weiter auf ihre Eigenheiten.', feature: 'tower' },
      { text: 'Ab Etage 20 bringen Bosse zwei Begleiter mit, die vor ihnen stehen. Ab Etage 30 wechseln Bosse unter 50 % KP in eine zweite Phase mit einer weiteren Eigenheit – die Vorschau verrät vorher, welche.', feature: 'tower' },
      { text: 'Neue Boss-Eigenheit „Flächenangriff“: Jede dritte Aktion trifft die ganze hintere Reihe.', feature: 'tower' },
      { text: 'Die Kampf-Wiedergabe zeigt jetzt auch lange Kämpfe bis zum Ende.', feature: 'tower' },
    ],
  },
  {
    id: 17,
    date: '2026-09-30',
    title: 'Aufgeräumte Brutstation',
    items: [
      { text: 'Das Zuchtbuch gibt es jetzt mit den Hybriden, die Zwei Zuchtlisten nach der ersten Vererbung.', feature: 'hybrids' },
      { text: 'Der Knopf für das letzte Paar sitzt als ↻ in der Mitte zwischen den beiden Eltern.', feature: 'breedRepeat' },
      { text: 'Gefallen dir die zwei Zuchtlisten nicht, stellst du unter Optionen wieder eine gemeinsame Liste ein.', feature: 'breedSplit' },
    ],
  },
  {
    id: 16,
    date: '2026-09-30',
    title: 'Element-Techniken im Turm, Klänge einzeln abschaltbar',
    items: [
      { text: 'Jede Kreatur setzt im Turm bei jeder fünften Aktion die Technik ihres Elements ein – Brand, Heilung, Schild, Betäubung, Frost, Gift und mehr. Zustände siehst du als Symbole über den Kämpfern, die Technik steht am Team-Platz.', feature: 'tower' },
      { text: 'Teams mit zwei Kreaturen desselben Elements bekommen +8 % Angriff, drei verschiedene Elemente +25 % Schaden gegen den Wandler.', feature: 'tower' },
      { text: 'Seltene Allele und Erbanlagen wirken jetzt auch im Kampf: kritische Treffer, Rückschaden, Erstschlag. Neue Erbanlage: Dornenhaut.', feature: 'deepSequencing' },
      { text: 'Der Wochen-Boss kämpft jetzt mit denselben Regeln wie der Turm – Techniken, Reihen und Tempo zählen auch dort.', feature: 'weeklyBoss' },
      { text: 'Unter Optionen → Töne kannst du einzelne Klänge oder ganze Gruppen abschalten und jeden Klang probehören.' },
      { text: 'Neue Forschung „Zuchtbuch“: Die Brutstation merkt sich dein letztes Paar und wählt es mit einem Tipp wieder aus.', feature: 'hybrids' },
      { text: 'Neue Forschung „Zwei Zuchtlisten“: Jedes Elternteil bekommt seine eigene Kandidatenliste mit eigenem Art-Filter.', feature: 'tower' },
      { text: 'Verkaufst oder recycelst du von Hand die letzte Kreatur einer Art, warnt dich das Spiel vorher.', feature: 'breeding' },
    ],
  },
  {
    id: 15,
    date: '2026-09-30',
    title: 'Genlab klingt jetzt überall',
    items: [
      { text: 'Neue Klänge fast überall: Sammeln (bei schnellem Klicken steigt der Ton), Freischaltungen, Erfolge, Fehler und eine Begrüßung nach einer Pause. Unter Optionen gibt es zusätzlich ein leises Klicken für Knöpfe (standardmäßig aus).' },
      { text: 'Gekaufte Forschung klimpert, die letzte Stufe klingt mit einem kleinen Akkord.', feature: 'research' },
      { text: 'Mythische Kreaturen schlüpfen mit einem kleinen Chor, seltenere glitzern mehr.', feature: 'breeding' },
      { text: 'Infusion und Durchbruch haben eigene Klänge.', feature: 'infusion' },
      { text: 'Brutrituale enden mit einem feierlichen Glockenschlag.', feature: 'specialBreeding' },
      { text: 'Neue Dynastie-Stufen werden gekrönt.', feature: 'dynasties' },
      { text: 'Gen-Kapseln rütteln, platzen auf und die Karten klicken beim Umdrehen; die Zerlege-Kammer brummt, solange sie arbeitet.', feature: 'recycler' },
      { text: 'Der Turm-Kampf ist hörbar: Treffer, sehr effektive und resistierte Treffer, Ausweichen, K.O., Boss-Trommel, Etage geschafft, Meilensteine und Relikte.', feature: 'tower' },
      { text: 'Tränke im Markt gluckern beim Trinken.', feature: 'market' },
      { text: 'Erkundungen kehren mit einem Horn zurück, wilde Kreaturen melden sich mit einem Lockruf.', feature: 'expedition' },
      { text: 'Gen-Aufträge werden abgestempelt.', feature: 'contracts' },
      { text: 'Die Tagesbelohnung öffnet sich wie eine Schatzkiste.', feature: 'daily' },
      { text: 'Eine Wochenexpedition, die auf deine Entscheidung wartet, kündigt sich mit einem Spannungsakkord an.', feature: 'voyage' },
      { text: 'Der Wochen-Boss dröhnt bei jedem Angriff, Belohnungsstufen klingen hell.', feature: 'weeklyBoss' },
      { text: 'Eine Vererbung rauscht und endet mit einer Glocke.', feature: 'inheritance' },
      { text: 'Äon, Talente und Großprojekte haben eigene Klänge.', feature: 'aeon' },
      { text: 'Anomalien beginnen verzerrt und enden mit einem Akkord.', feature: 'anomalies' },
      { text: 'Was die Automatik ständig auslöst, hörst du nur im jeweiligen Tab – seltene Ergebnisse überall.' },
      { text: 'Neu unter Optionen: „Hilfe bei festgefahrenen Spielständen“. Ist dein Turm-Rekord höher, als dein Team heute schafft, kannst du ihn senken – Checkpoint und Wochen-Boss passen sich an, Meilenstein-Boni bleiben.', feature: 'tower' },
    ],
  },
  {
    id: 14,
    date: '2026-09-30',
    title: 'Neue Klänge und Musik für Brutstation und Genlabor',
    items: [
      { text: 'Die Hintergrundmusik hat zwei neue Stimmungen: eine Spieluhr in der Brutstation und einen leisen Sequenzer im Genlabor. Beim Tab-Wechsel blendet die Musik jetzt sofort weich über.' },
      { text: 'Neue Klänge in der Brutstation: Ei gelegt, Schlüpfen (seltene Kreaturen und Hybride glitzern), Zwillinge und eine kleine Melodie für neu entdeckte Hybride.', feature: 'breeding' },
      { text: 'Neue Klänge im Genlabor: Sequenzierung fertig, Tiefensequenzierung, neues Allel in der Bibliothek.', feature: 'sequencing' },
      { text: 'Gen-Splicing klingt jetzt nach Schnitt und „Ding“ – oder nach Zischen, wenn es instabil wird.', feature: 'splicing' },
      { text: 'Behoben: Die Schalter „Vorne“/„Hinten“ am Turm-Team zeigten die gewählte Reihe nicht an.', feature: 'tower' },
    ],
  },
  {
    id: 13,
    date: '2026-09-30',
    title: 'Reihen und Rollen im Turm, kompakte Genbibliothek',
    items: [
      { text: 'Turm-Teams stehen jetzt in zwei Reihen: Die vordere Reihe steckt die meisten Treffer ein, die hintere ist geschützt. Umschalten direkt am Team-Platz („Vorne“/„Hinten“).', feature: 'tower' },
      { text: 'Jede Kreatur zeigt ihre Rolle – 🛡️ Tank, ⚔️ Angreifer oder 💨 Flink – als Tipp für die Aufstellung. Verteidigung schützt jetzt spürbar besser.', feature: 'tower' },
      { text: 'Manche Bosse wählen ihre Ziele selbst: Der Wandler jagt das schwächste Teammitglied, die Regeneration greift lieber die hintere Reihe an. Die Vorschau verrät, worauf du dich einstellen musst.', feature: 'tower' },
      { text: 'Kämpfe im Turm laufen jetzt in einheitlichem Tempo ab: Lange Kämpfe dauern sichtbar länger als kurze. Die Tempo-Leisten sind deutlicher, leuchten kurz vor dem Zug und zeigen die Sekunden bis zur nächsten Aktion.', feature: 'tower' },
      { text: 'Gen-Splicing und „Genom ansehen“ sortieren wie die anderen Kreaturenlisten (Gesamtstärke, Seltenheit, Generation, Werte, Name … und ⇅ zum Umkehren) – plus „Top-Allele“ und beim Splicing „Versuche übrig“.', feature: 'sequencing' },
      { text: 'Die Genbibliothek ist kompakter: eine Zeile pro Gen mit kleinen Allel-Punkten, komplette Gene lassen sich ausblenden und die ganze Bibliothek einklappen.', feature: 'sequencing' },
    ],
  },
  {
    id: 12,
    date: '2026-09-29',
    title: 'Neues Kampfsystem im Turm, Hintergrundmusik, Genom-Suche',
    items: [
      { text: 'Neues Kampfsystem mit Aktionsleiste: Jede Kreatur handelt, sobald ihre Leiste voll ist – doppelt so schnelle Kreaturen kommen fast doppelt so oft dran und weichen langsameren Gegnern manchmal aus. Tempo lohnt sich jetzt!', feature: 'tower' },
      { text: 'Die Turm-Arena ist neu gestaltet: Zugfolge, Aktionsleisten unter jedem Kämpfer, Kampfuhr, Treffer-Funken und Anzeigen für „Sehr effektiv!“, „resistiert“, „Ausgewichen!“ und Heilungen. Kandidaten lassen sich nach Tempo sortieren.', feature: 'tower' },
      { text: 'Hintergrundmusik: ruhige, live erzeugte Klänge – im Turm treibender, im Äon schwebend. Einschalten über 🎵 oben oder unter Optionen (mit eigener Lautstärke).' },
      { text: '„Genom ansehen“ im Genlabor: Statt einer langen Liste wählst du Kreaturen jetzt aus einer Galerie mit Suche, Art-Filter, „nur sequenzierte“ und Sortierung (z. B. meiste Top-Allele). Mit ‹ › blätterst du durch die gefilterten Kreaturen, die gewählte bleibt beim Tab-Wechsel erhalten.', feature: 'sequencing' },
      { text: 'Infusion: Die Schnellwahl („bis Seltenheit“, „nur Allel-Spender“) wird gespeichert, und die ausgewählten Artgenossen bleiben erhalten, wenn du die Kreaturdetails schließt und wieder öffnest.', feature: 'infusion' },
    ],
  },
  {
    id: 11,
    date: '2026-09-29',
    title: 'Typvorteil in den Anlagen, neue Genom-Ansicht',
    items: [
      { text: 'Anlagen haben jetzt einen Typvorteil: Kreaturen passender Elemente arbeiten dort 30 % ergiebiger. Die Farm liebt Natur, Wasser, Licht und Luft.', feature: 'farm' },
      { text: 'Die Mine bevorzugt Erde, Metall, Feuer und Kristall. Ein ★ markiert Kreaturen mit Typvorteil, und der Vorschlag beim Zuweisen rechnet ihn mit ein.', feature: 'mine' },
      { text: 'Im Bio-Labor haben Elektro, Gift, Schatten und Eis den Typvorteil.', feature: 'biolab' },
      { text: 'Der Arbeitsplaner verteilt nicht mehr nur nach dem höchsten Wert, sondern nach dem tatsächlichen Ertrag – samt Typvorteil.', feature: 'autoAssign' },
      { text: 'Neue Genom-Ansicht im Genlabor und in den Kreaturdetails: Gene nach Werten, Eigenschaften und Aussehen sortiert, verdeckte Allele sind abgeblendet, dazu reinerbig/mischerbig, die Wirkung jedes Gens und ★ für Top-Allele.', feature: 'sequencing' },
      { text: 'Gen-Splicing überarbeitet: Kreaturen wählst du jetzt aus einer Galerie mit Suche. „Fertige ausblenden“ versteckt Kreaturen ohne Versuche oder mit perfektem Genom. ↑ zeigt Gene, deren bestes Allel schon in deiner Bibliothek liegt.', feature: 'splicing' },
    ],
  },
  {
    id: 10,
    date: '2026-09-29',
    title: 'Eigene Familiennamen, klassische Namen, aktive Spielzeit',
    items: [
      { text: 'Die Statistik zeigt jetzt deine aktive Spielzeit – nur die Zeit, in der du wirklich spielst – dazu Sitzungen, die längste Sitzung und den Schnitt. Unter „Meilensteine“ siehst du, nach wie viel aktiver Zeit du Freischaltungen, Erfolge und Turm-Etagen erreicht hast.' },
      { text: 'Gib einer Kreatur beim Umbenennen einen Nachnamen („Kiko Sonnenschein“) – ihr Nachwuchs erbt diesen Familiennamen. Selbst vergebene Familien gehen vor den automatischen.', feature: 'breeding' },
      { text: 'Unter Optionen → Namen kannst du wieder die klassischen Namen einstellen: Nachwuchs heißt dann wie früher nach einer Mischung aus den Namen beider Eltern („Glussling“). Die Einstellung gilt für deinen Spielstand; vorhandene Namen bleiben.', feature: 'breeding' },
    ],
  },
  {
    id: 9,
    date: '2026-09-29',
    title: 'Ein Spielstand für alle Geräte',
    items: [
      { text: 'Neu: Geräte-Sync in den Optionen. Richte ihn einmal ein, gib den Sync-Code auf deinem Handy, Tablet oder PC ein – und spiele überall mit demselben Stand weiter. Er wird beim Wechsel automatisch abgeglichen und verschlüsselt übertragen, ein Konto brauchst du nicht.' },
      { text: 'Der Export ist jetzt rund zehnmal kürzer – er passt bequem in eine Nachricht. Alte Exporte lassen sich weiterhin einspielen.' },
      { text: 'Neuer „Teilen …“-Knopf in den Optionen: Schick deinen Spielstand direkt per Messenger, Mail oder AirDrop auf ein anderes Gerät.' },
      { text: 'Vor dem Import siehst du beide Spielstände nebeneinander – Spielzeit, Kreaturen, Erfolge und mehr. Ist der Import weniger weit, wirst du gewarnt.' },
    ],
  },
  {
    id: 8,
    date: '2026-09-29',
    title: 'Lustigere Namen, alles zum Recycler, Töne einstellbar',
    items: [
      { text: 'Namen mit mehr Witz: Neue Familien starten mit Rufnamen wie „Wuselbert“ oder „Flauschine“. Ihre Kinder mischen meist die Rufnamen der Eltern („Kiko“ × „Mira“ → „Kira“) – mit Regeln, damit nichts mehr stottert – und bekommen ab und zu einen ganz neuen.', feature: 'breeding' },
      { text: 'Beinamen: Epische und bessere sowie schillernde Kreaturen tragen einen Beinamen nach ihrer größten Stärke, etwa „Blitzpfote“, „Eichenherz“ oder „Glitzerfell“.' },
      { text: 'Recyceln im Labor und in der Detailansicht schickt Kreaturen jetzt in die Zerlege-Kammer des Gen-Recyclers. Dort werden sie nacheinander zerlegt – in nur 15 Sekunden je Kreatur und vor allem, was der Recycling-Automat auswählt. Bis zuletzt kannst du sie mit „↩ Zurückholen“ wieder herausnehmen.', feature: 'recycler' },
      { text: 'Die Forschung „Schnellzerlegung“ gibt es jetzt schon mit dem Gen-Recycler, nicht erst mit dem Recycling-Automaten.', feature: 'recycler' },
      { text: 'Unter Optionen gibt es einen Lautstärke-Regler mit Probeton. Beim Nachholen der Offline-Zeit und in einem Hintergrund-Tab bleibt das Spiel still.' },
    ],
  },
  {
    id: 7,
    date: '2026-09-29',
    title: 'Zuchtautomat und Recycling-Automat arbeiten zusammen',
    items: [
      { text: 'Der Zuchtautomat räumt den Stall nicht mehr selbst auf. Ist der Stall voll, wartet er – Platz schafft der Recycling-Automat mit seiner Zerlege-Kammer. So nehmen sich die beiden nicht mehr gegenseitig die Kreaturen weg.', feature: 'autoBreed' },
      { text: 'Die Zerlege-Kammer wird nicht mehr unterbrochen: Eine Kreatur, die drin ist, wird fertig recycelt – außer du rettest sie als Favorit ★.', feature: 'autoRecycle' },
    ],
  },
  {
    id: 6,
    date: '2026-09-29',
    title: 'Stammbaum-Dynastien, Familiennamen und neue Brutrituale',
    items: [
      { text: 'Große Momente werden gefeiert: Das erste perfekte Genom einer Art erscheint bildschirmfüllend als „OPTIMALE DNS“, die erste schillernde Kreatur einer Art als „SCHILLERND!“ – jeweils mit Fanfare. Die Töne lassen sich unter Optionen ausschalten.' },
      { text: 'Neue Namen: Frisch geschlüpfte Kreaturen bekommen einen Rufnamen und den Familiennamen des stärkeren Elternteils, zum Beispiel „Kiko Funkenstein“. Hat noch keiner eine Familie, gründet der stärkere eine – passend zu seinem Element. Keine seltsamen Silbensalate mehr nach vielen Generationen.', feature: 'breeding' },
      { text: 'Besondere Brut überarbeitet: Rituale laufen im eigenen Ritualnest neben den normalen Nestern und brauchen nur eine Keimprobe – die Eltern bleiben frei.', feature: 'specialBreeding' },
      { text: 'Kürzer und sicherer: Kreuzungsritual 1 Stunde (passt ein Rezept, wird es sicher ein Hybrid), Edelbrut 3 Stunden (mindestens Selten), Meisterbrut 8 Stunden (mindestens Episch).', feature: 'specialBreeding' },
      { text: 'Der Recycling-Automat arbeitet jetzt sichtbar: Er nimmt eine Kreatur nach der anderen in seine Zerlege-Kammer, statt alle auf einmal zu recyceln. Du siehst, wer gerade dran ist, wie lange es noch dauert und wer als Nächstes kommt – und kannst sie mit „★ Retten“ noch behalten.', feature: 'autoRecycle' },
      { text: 'Anfangs braucht die Kammer 3 Minuten je Kreatur. Die neue Forschung „Schnellzerlegung“ (10 Stufen) bringt das auf wenige Sekunden.', feature: 'autoRecycle' },
      { text: 'Neues Äon-Talent „Stammbaum-Dynastien“ (Stufe 2): Es öffnet reine Linien in der Brutstation.', feature: 'aeon' },
      { text: 'Neu: Stammbaum-Dynastien. Paare Kreaturen derselben Art – jede Generation in Folge vertieft die reine Linie und macht das Kind stärker (+1 % Werte je Generation).', feature: 'dynasties' },
      { text: 'Der Rekord jeder Art bleibt für immer. Ab Linien-Tiefe 5, 10, 20, 35 und 50 steigt die Dynastie eine Stufe: mehr Werte für die ganze Art und mehr Produktion. Die Stufen 4 und 5 bringen Äon-Splitter.', feature: 'dynasties' },
      { text: 'Die Brutstation zeigt die Linie des nächsten Kindes und eine Übersicht aller Dynastien. Kandidaten und Kreaturenliste lassen sich nach „Reine Linie“ sortieren, und der Zuchtautomat kann reine Linien gezielt vertiefen.', feature: 'dynasties' },
      { text: 'Genom-Turm: Bosse mit Regeneration heilen jetzt 40 % des Schadens, den sie in der Runde genommen haben – statt 8 % ihrer KP. Sie sind dadurch keine unüberwindbare Wand mehr.', feature: 'tower' },
      { text: 'Die Brutstation am Handy: Die Sortierung der Kandidaten hat eine eigene Zeile und ist wieder lesbar.', feature: 'breeding' },
    ],
  },
  {
    id: 5,
    date: '2026-09-29',
    title: 'Turm-Verlauf und umkehrbare Sortierung',
    items: [
      { text: 'Genom-Turm: Die Bestenliste zeigt nur noch die drei besten Läufe. Darunter siehst du deine letzten zehn Läufe – mit Etage, Startetage, Team und Uhrzeit.', feature: 'tower' },
      { text: 'Neben der Sortierung im Labor sitzt jetzt ein ⇅-Knopf, der die Reihenfolge umdreht: schwächste zuerst, häufigste Seltenheit zuerst, Name von Z bis A …' },
      { text: 'Auch die Kandidaten der Brutstation lassen sich mit ⇅ umgekehrt sortieren.', feature: 'breeding' },
      { text: 'Genom-Turm: Die Kandidaten lassen sich mit ⇅ umgekehrt sortieren.', feature: 'tower' },
    ],
  },
  {
    id: 4,
    date: '2026-09-29',
    title: 'Anomalien mit Stufen',
    items: [
      { text: 'Jede Anomalie hat jetzt die Stufen I–V. Die nächste Stufe öffnet sich, wenn du die vorige meisterst – mit härteren Regeln und größerem Ziel.', feature: 'anomalies' },
      { text: 'Die Ziele der Anomalien wachsen mit deinem Produktionsbonus. So bleiben sie auch nach vielen Neustarts eine Herausforderung. Das Ziel wird beim Start des Laufs festgelegt.', feature: 'anomalies' },
      { text: 'Anomalien lassen sich kombinieren: Wähle für mehrere eine Stufe und starte sie zusammen. Geschafft ist der Lauf, wenn alle Ziele erreicht sind.', feature: 'anomalies' },
      { text: 'Die Belohnung einer Anomalie zählt je gemeisterter Stufe. Ein neuer Rekord in der Gesamtschwierigkeit (Summe der Stufen) bringt dauerhaft mehr Produktion und Erbgut.', feature: 'anomalies' },
      { text: 'Jeder neue Anomalie-Rekord bringt außerdem einen Äon-Splitter je Punkt Gesamtschwierigkeit.', feature: 'aeon' },
      { text: 'Die Äon-Resonanz öffnet sich schon mit den Linsen, der dritten Bauphase des Äon-Observatoriums – nicht erst mit der Sternkarte.', feature: 'megaProjects' },
      { text: 'Genom-Turm: Relikte werden mit jeder Stufe deutlich teurer. Bereits gekaufte Stufen bleiben erhalten.', feature: 'tower' },
      { text: 'Der Gen-Recycler ist neu gestaltet: Jede Kapsel hat ein eigenes Aussehen, die Chancen stehen als Farbbalken daneben, und du siehst, in wie vielen Kapseln die Garantie greift.', feature: 'recycler' },
      { text: 'Kapseln öffnen sich jetzt mit Animation: Die Kapsel rüttelt und leuchtet schon in der Farbe des besten Fundes, platzt auf, und die Kreaturen drehen sich eine nach der anderen um. Ab „Episch“ gibt es ein Banner. Tippen überspringt die Animation.', feature: 'recycler' },
      { text: 'Die Gen-Helix neben dem Sammeln-Knopf springt beim Klicken nicht mehr zurück, sondern dreht sich schneller – je schneller du sammelst, desto mehr leuchtet sie.' },
      { text: 'Das Wochen-Banner verrät jetzt auch die Mutation der nächsten Woche und wann sie beginnt – so kannst du deine Zucht schon darauf ausrichten.', feature: 'weekly' },
      { text: 'Genom-Turm: Der Auto-Neustart beginnt dort, wo du deinen letzten Lauf gestartet hast. Startest du „Ab Etage 1“, geht es nach einer Niederlage auch wieder bei Etage 1 los – praktisch nach einer Vererbung, wenn das Team noch schwach ist.', feature: 'towerAuto' },
    ],
  },
  {
    id: 3,
    date: '2026-09-29',
    title: 'Sicherer Stall',
    items: [
      { text: 'Der Zuchtautomat räumt bei vollem Stall nicht mehr die letzten Kreaturen einer Art weg: Die stärksten jeder Art bleiben stehen – so viele, wie beim Recycling-Automaten unter „Je Art behalten“ eingestellt ist (Standard: 2).', feature: 'autoBreed' },
      { text: 'Der Zuchtautomat zeigt, welche Kreatur beim nächsten vollen Stall als Nächstes gehen würde. Favoriten ★ sind wie immer geschützt.', feature: 'autoBreed' },
      { text: 'Ein Äon bringt mehr Splitter: √(Erbgut / 25) statt √(Erbgut / 50) – etwa 40 % mehr für dasselbe Erbgut.', feature: 'aeon' },
      { text: 'Die Talente der Stufen 4 und 5 im Äon-Talentbaum sind günstiger (6 und 9 statt 8 und 12 Splitter).', feature: 'megaProjects' },
      { text: 'Genom-Turm: Ab Etage 20 haben Bosse eine Eigenheit – Element-Schild, Wandler oder Regeneration. Sie steht vor dem Kampf beim Gegner.', feature: 'tower' },
      { text: 'Genom-Turm: Relikte für Turm-Marken. Du steckst sie in die Plätze deines Turm-Teams, und sie bleiben über jeden Neustart.', feature: 'tower' },
      { text: 'Genom-Turm: Alle 50 Etagen ein Meilenstein – dauerhaft mehr Turm-Schaden und Produktion, beim ersten Mal dazu Äon-Splitter.', feature: 'tower' },
      { text: 'Der Äon-Tab zeigt jetzt dieselbe Übersicht wie die Vererbung: Splitter-Gewinn, was verloren geht und was bleibt, und eine Zeitleiste deiner Äonen samt der Vererbungen dazwischen.', feature: 'aeon' },
    ],
  },
  {
    id: 2,
    date: '2026-09-29',
    title: 'Feinschliff',
    items: [
      { text: 'Jeder Tab hat jetzt oben eine einheitliche Kopfzeile mit den wichtigsten Kennzahlen auf einen Blick.' },
      { text: 'Seltene Kreaturen fallen stärker auf: Ab Episch läuft ein Schimmer über den Kartenrahmen, ab Legendär leuchtet die Karte.' },
      { text: 'Der Labor-Tab heißt jetzt auch oben „Labor“ – so ist er nicht mehr mit dem Genlabor zu verwechseln.', feature: 'sequencing' },
      { text: 'Eine laufende Anomalie zeigt einen Fortschrittsbalken bis zu ihrem Ziel.', feature: 'anomalies' },
    ],
  },
  {
    id: 1,
    date: '2026-09-28',
    title: 'Mehr Übersicht',
    items: [
      { text: 'Die Tagesbelohnung im Labor ist jetzt eine schmale Leiste mit Abholen-Knopf – den Kalender kannst du aufklappen.', feature: 'daily' },
      { text: 'Kreaturen, die gerade auf Erkundung sind, kannst du in der Kreaturenliste ausblenden.', feature: 'expedition' },
      { text: 'Alle Anlagen zeigen gleich viele Arbeitsplätze – Plätze, die du noch ausbauen kannst, sind mit 🔒 markiert.', feature: 'farm' },
      { text: 'Die Großforschung lässt sich einklappen; die laufenden Projekte bleiben sichtbar.', feature: 'grandResearch' },
      { text: 'Brutstation: Die Kandidaten lassen sich nach Stärke, Seltenheit, Generation, Art, Name oder einzelnen Werten sortieren und nach Seltenheit filtern.', feature: 'breeding' },
      { text: 'Beim Losschicken auf Erkundung kannst du arbeitende Kreaturen und Favoriten ausblenden – markiere eine Kreatur mit ★, damit sie zu Hause bleibt.', feature: 'expedition' },
      { text: 'Die Wochenexpedition lässt sich einklappen und steht jetzt unter der Kreaturenauswahl.', feature: 'voyage' },
      { text: 'Infusion: Die Seltenheit ist frei wählbar, dazu gibt es die Schnellauswahl „bis zur nächsten Stufe“, „bis zur Höchststufe“ und „nur Allel-Spender“.', feature: 'infusion' },
    ],
  },
];

/** Release the running build belongs to. */
export const CURRENT_RELEASE = CHANGELOG[0]?.id ?? 0;

export interface VisibleEntry {
  id: number;
  date: string;
  title: string;
  items: string[];
  /** Items about features the player has not discovered yet. */
  hidden: number;
}

/** Entries newer than `sinceId`, with not yet unlocked features left out. */
export function visibleNews(entries: readonly ChangelogEntry[], sinceId: number, unlocked: (feature: string) => boolean): VisibleEntry[] {
  return entries
    .filter((e) => e.id > sinceId)
    .map((e) => {
      const shown = e.items.filter((i) => !i.feature || unlocked(i.feature));
      return { id: e.id, date: e.date, title: e.title, items: shown.map((i) => i.text), hidden: e.items.length - shown.length };
    })
    .filter((e) => e.items.length > 0 || e.hidden > 0);
}

export function formatReleaseDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "2 Verbesserungen für Bereiche, die du noch entdeckst." */
export function hiddenText(n: number): string {
  return n === 1 ? 'Eine Verbesserung für einen Bereich, den du noch entdeckst.' : `${n} Verbesserungen für Bereiche, die du noch entdeckst.`;
}

/** Loose check for the downloaded changelog.json of a newer version. */
export function parseChangelog(data: unknown): ChangelogEntry[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (e): e is ChangelogEntry =>
      !!e && typeof e.id === 'number' && typeof e.date === 'string' && typeof e.title === 'string' && Array.isArray(e.items) &&
      e.items.every((i: unknown) => !!i && typeof (i as ChangelogItem).text === 'string'),
  );
}
