# Inhalte hinzufügen

Alle Inhalte sind Daten in `src/content/`. Die Logik muss dafür nicht angepasst werden. Beim Start prüft `validateContent` alle Einträge. Ein Tippfehler in einer ID, ein unbekanntes Element oder ein ungültiges Modifier-Ziel führt zu einer Fehlerseite mit genauer Angabe, **wo** der Fehler liegt. `npm test` prüft die ausgelieferten Inhalte ebenfalls (`tests/content.test.ts`).

## Modifier – die gemeinsame Sprache aller Boni

```ts
{ target: 'production.gold', op: 'pct', value: 0.25 }  // +25 %
{ target: 'slots.farm',      op: 'add', value: 1 }     // +1 Platz
{ target: 'breeding.time',   op: 'mult', value: 0.9 }  // ×0,9
```

Berechnung je Ziel: `(Basis + Σadd) × (1 + Σpct) × Πmult`. Bei Stufen (Forschung, Dex-Einträge, Erbgut-Punkte) wachsen `add`/`pct` linear, `mult` multipliziert sich.

Gültige Ziel-Wurzeln stehen in `MODIFIER_ROOTS` (`src/core/modifiers.ts`): `production.<res>`, `collect.<res>`, `cost.upgrade[.<id>]`, `slots.<building>`, `breeding.*`, `mission.*`, `process.<kind>.speed`, `rarity.weight.<rarity>`, `stat.<stat>`, `offline.capHours`, `prestige.<layer>.gain` … Eine neue Wurzel wird dort einmal eingetragen.

## Neue Kreatur (Art)

`src/content/species.ts`:

```ts
{
  id: 'frostling', name: 'Frostling', element: 'ice', tier: 'base',
  shape: 'round', hue: 190, wild: true,
  description: 'Hinterlässt kleine Eisblumen.',
  baseStats: { hp: 21, atk: 6, def: 7, spd: 4 },
},
```

- `element` muss in `elements.ts` existieren, `baseStats` braucht jeden Stat aus `stats.ts`.
- `shape` wählt die SVG-Silhouette (`blob`, `drop`, `round`, `wing`), `hue` die Grundfarbe.
- Der Dex zeigt die Art automatisch in allen Seltenheiten an.

### Urzeitwesen

Arten mit `tier: 'primal'` schlüpfen nur aus Urzeit-Eiern (Brutkammer in der Brutstation). Sie brauchen ein `eggWeight` (Gewicht beim Öffnen eines Eis, Arten ohne Dex-Eintrag zählen `balance.primalEggs.undiscoveredWeight`-fach) und `wild: false`; Rezepte und Gen-Kapseln führen nicht zu ihnen. Woher die Eier kommen, steht im Balancing: `primalEggs.contractChance` (je erfülltem Gen-Auftrag) oder ein Eintrag `primalEgg` in `rpg.loot.<raum>.chance`.

## Neues Gen (Locus mit Allelen)

`src/content/genes.ts`:

```ts
{
  id: 'glow', name: 'Leuchten', category: 'visual', description: 'Biolumineszenz. Rezessiv.',
  alleles: [
    { id: 'L', name: 'Normal', symbol: 'L', dominance: 2, weight: 85, color: '#546e7a', modifiers: [] },
    { id: 'l', name: 'Leuchtend', symbol: 'l', dominance: 1, weight: 15, color: '#e6ff5c',
      modifiers: [{ target: 'production.essence', op: 'pct', value: 0.15 }],
      visual: { lightness: 70, saturation: 90 } },
  ],
},
```

- **Ausprägung:** Das Allel mit höherer `dominance` setzt sich durch. Bei gleicher `dominance` und verschiedenen Allelen sind beide kodominant zu je 50 % ausgeprägt (Modifier halbiert). Ein rezessives Merkmal braucht zwei Kopien.
- `weight` bestimmt die Häufigkeit in neuen/wilden Genomen – seltene Allele bekommen kleine Werte.
- `modifiers` wirken auf die Kreatur (Stats, Produktion bei der Arbeit, `breeding.time` als Elternteil …).
- `visual` verändert das Aussehen (`hueShift`, `saturation`, `lightness`, `pattern`, `horn`). Das Aussehen ist immer sichtbar, die Allele erst nach der Sequenzierung.
- Ein neues Gen braucht **keine** Save-Migration: Beim Laden bekommen alle Kreaturen fehlende Loci zufällig gewürfelt.
- Ziele wie „alle Allele katalogisiert“ (`geneLibrary`-Bedingung) werden gegen die tatsächliche Allelzahl validiert.

## Neues Hybrid-Rezept

`src/content/recipes.ts` (die Ergebnis-Art muss in `species.ts` existieren, mit `tier: 'hybrid'`, `'rareHybrid'` oder `'mythic'` und `wild: false`):

```ts
{
  id: 'magma', parents: ['emberpup', 'pebblit'], result: 'magmole', chance: 0.12,
  requires: { minGeneration: 3, allele: { locus: 'strength', allele: 'K' } },
  hint: 'Heißes Gestein …',
},
```

- Die Reihenfolge der Eltern ist egal. `allele` = mindestens ein Elternteil trägt das Allel; `minRarity` gilt für beide Eltern.
- `chance` wird über `breeding.hybridChance`-Modifier verändert (z. B. Forschung „Kreuzungstheorie“).
- Bis zur Entdeckung steht das Rezept im Dex als „???“; der `hint` wird durch Forschung (`grantsHints`) oder lange Erkundungen enthüllt.
- Hybride übernehmen das Stat-Profil ihrer Art (Werte werden relativ zu den Eltern-Arten umgerechnet).
- Ein Test prüft, dass jede Nicht-Basisart über ein Rezept oder eine Evolution erreichbar ist und jeder Elternteil beschaffbar ist.

## Neue Evolution

`src/content/recipes.ts` → `evolutions`:

```ts
{
  id: 'phoenix', from: 'volcanodrake', to: 'phoenix', description: 'Aus der Glut wiedergeboren.',
  requires: { minGeneration: 6, minRarity: 'epic', allele: { locus: 'stamina', allele: 'Ae' }, cost: { catalyst: 8, essence: 500 } },
},
```

Allel-Bedingungen verlangen ein sequenziertes Genom. Die Evolution rechnet die Werte auf das Profil der neuen Art um.

## Neuer Gen-Auftrag

`src/content/contracts.ts`: eine Vorlage für das tägliche Auftragsbrett. Offene Parameter werden pro Angebot gewürfelt – bevorzugt aus Allelen, die schon in der Genbibliothek stehen, und aus Arten, die im Dex entdeckt sind:

```ts
{
  id: 'elementPure', name: 'Reine Linie', client: 'Tierpark Nordheim', level: 2, weight: 2,
  requirements: [{ kind: 'element' }, { kind: 'genotype' }],
  reward: { minutes: 25, resources: { essence: 50 } },
},
```

- Anforderungen: `expresses` (Phänotyp zeigt ein Allel, optional `category`), `genotype` (reinerbig, optional `recessive: true`), `element`, `minTier`, `topLoci` (`count`, `homozygous`), `minRarity`, `minGeneration`. `locus`/`allele`/`element` können fest vorgegeben werden.
- Gewürfelte Allele sind nie das häufigste ihres Locus (kein „Normal“), rezessive haben eine Wirkung.
- `level` (1 …) schaltet sich über erfüllte Aufträge frei (`balance.contracts.levelThresholds`), `requires` ist eine zusätzliche Bedingung.
- Belohnung: `minutes` = so viele Minuten der aktuellen Produktion, `resources` = feste Mengen (erst ab Freischaltung der Ressource), `alleleSamples` = seltenste fehlende Allele für die Genbibliothek. Alles skaliert mit `contracts.reward`-Modifiern.

## Neue Region (Erkundung)

`src/content/missions.ts`: eine Mission mit `requires` (wann sie erscheint) und `species` (wer dort lebt):

```ts
{
  id: 'frostpeak', name: 'Frostgipfel', description: 'Eisige Höhen voller Metalladern.', durationSec: 900, cost: { food: 400 },
  requires: { type: 'upgradeLevel', upgrade: 'cartographer', level: 2 },
  rewards: { gold: [150, 400], catalyst: [0, 1] }, wildChance: 0.45, species: ['frostling', 'ferrox'],
},
```

Eine **Tagesreise** ist eine Region mit langer Dauer und garantiertem Fund: `wildChance: 1` plus `wildMinRarity` (Mindestseltenheit; der Fund findet auch in einem vollen Stall Platz). Ab 12 h Dauer zeigt die Karte sie als „Tagesreise“ und fragt vor dem Losschicken nach. Neue Regionen bekommen in `ExpeditionTab.svelte` (`layout`) einen Platz auf der Karte.

## Großforschung

`src/content/grandResearch.ts`: Projekte für den eigenen Forschungsplatz.

```ts
{ id: 'expeditionNetwork', name: 'Expeditionsnetz', icon: '🏕️', hours: 12, hoursGrowth: 2, maxLevel: 2,
  description: '+1 Camp pro Stufe.', cost: { essence: 500, gold: 30000 }, costGrowth: 4,
  modifiers: [{ target: 'slots.camp', op: 'add', value: 1 }] },
```

- Dauer der Stufe n: `hours × hoursGrowth^(n−1)`, Kosten: `cost × costGrowth^(n−1)`.
- `modifiers` wirken einmal pro erreichter Stufe. Stufen werden nie zurückgesetzt.
- Mehr gleichzeitige Projekte über den Modifier `slots.grandResearch`.

## Großprojekt

`src/content/megaProjects.ts`: Bauwerke über mehrere Tage. Jede Bauphase wird in beliebig vielen Einzahlungen bezahlt, danach läuft die Bauzeit nach echter Uhrzeit.

```ts
{
  id: 'observatory', name: 'Äon-Observatorium', icon: '🔭', description: '…',
  requires: { type: 'feature', feature: 'aeon' },
  stages: [
    { name: 'Fundament', description: '…', cost: { gold: 1e9, towerTokens: 300 }, hours: 12 },
    { name: 'Kuppel', description: 'Öffnet die vierte Stufe im Talentbaum.', cost: { essence: 2e8, catalyst: 100 }, hours: 24 },
  ],
},
```

- Einzahlungen und fertige Bauphasen werden nie zurückgesetzt, ein laufender Bau überdauert Vererbung und Äon.
- Was ein Großprojekt freischaltet, hängt an der Bedingung `{ type: 'megaProject', project: 'observatory', stage: 2 }` – nutzbar überall, wo es Bedingungen gibt (Talente über `unlock`, Resonanz, Features …).
- `MegaProjectPanel.svelte` zeichnet das Äon-Observatorium Bauphase für Bauphase; andere Projekte zeigen ihr `icon`.

## Äon-Resonanz

`src/content/endgame.ts` → `resonances`: endlose Knoten für übrige Äon-Splitter. Sie öffnen sich mit der dritten Bauphase des Äon-Observatoriums (Linsen).

```ts
{ id: 'harvestResonance', name: 'Ernte-Resonanz', icon: '🌾', cost: 3, costGrowth: 1.35, levelPower: 0.7,
  requires: { type: 'megaProject', project: 'observatory', stage: 4 },
  description: '+25 % Nahrung, Gold und Essenz (abnehmend).',
  modifiers: [{ target: 'production.food', op: 'pct', value: 0.25 }] },
```

- Kosten der nächsten Stufe: `cost × costGrowth^Stufe` (aufgerundet), Wirkung: `modifiers × Stufe^levelPower`.

## Erbanlage (verborgene Eigenschaft)

`src/content/latent.ts`: starke Eigenschaften, die etwa jede dritte Kreatur verborgen trägt (`balance.deepSequencing.latentChance`). Sie werden vererbt, auch solange sie verborgen sind, und wirken erst nach einer Tiefensequenzierung.

```ts
{ id: 'goldNose', name: 'Goldnase', weight: 3, scope: 'job', description: '+40 % Gold bei der Arbeit.',
  modifiers: [{ target: 'production.gold', op: 'pct', value: 0.4 }] },
```

- `scope` wie bei Fähigkeiten: `self`, `job` (nur bei der Arbeit) oder `global`.
- `weight` = Häufigkeit unter den Trägern. Vererbung und Neuwurf stehen in `balance.deepSequencing`.
- Erbanlagen nutzen einen eigenen, pro Spielstand und Kreatur festen Zufall – neue Einträge verändern keine anderen Würfe.

## Brutritual (Besondere Brut)

`src/content/rituals.ts`: langsame Brutarten mit sicheren Ergebnissen. Sie laufen im eigenen Ritualnest
(`balance.breeding.ritualNests`, Modifier `slots.ritualNest`) neben den normalen Nestern und nehmen nur eine
Keimprobe der Eltern – die Eltern bleiben frei. Das normale Ei bleibt unverändert.

```ts
{ id: 'noble', name: 'Edelbrut', icon: '💠', hours: 3, description: '…', cost: { essence: 300 },
  requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 }, minRarity: 'rare' },
```

- `hours` ersetzt die normale Brutzeit, `cost` kommt zu den normalen Kosten dazu.
- Wirkungen: `guaranteedHybrid` (passt ein Rezept, wird es sicher ein Hybrid), `hybridMult` (multipliziert jede
  Rezept-Chance), `minRarity` (Mindestseltenheit), `rarityBoost` (Gewicht für Selten und höher, 2 = dreifach), `mutationAdd`.
- Der Zuchtplaner zeigt die Chancen mit dem gewählten Ritual; der Zuchtautomat nutzt nie Rituale.

## Wochenexpedition

`src/content/voyages.ts` enthält drei Listen:

- `voyageDestinations`: Ziele mit `element`, `species` (wer sich anschließen kann) und `rewards` ([min, max] pro Teammitglied). Das Ziel der Woche folgt dem Element der Wochen-Mutation (`element.<id>.production`), sonst wird es per Woche gewürfelt.
- `voyageEvents`: Ereignisse unterwegs (eines pro Tag) mit `effect`: `lootPct`, `resources`, `alleleSamples`, `hint`.
- `voyageDecisions`: die Entscheidung bei der Rückkehr, genau zwei `options` mit `lootFactor` und optional `creature.minRarity`, `resources`, `nextBonus` (Beute der nächsten Reise) oder `teamBoost` (dauerhaft auf alle Werte der Teammitglieder).

Dauer, Teamgröße, Ereigniszahl und Kosten stehen in `balance.voyage`.

## Neues Upgrade / neue Forschung

`src/content/upgrades.ts`:

```ts
{
  id: 'goldenShovels', name: 'Goldene Schaufeln', category: 'research', theme: 'mine',
  description: '+20 % Goldproduktion.',
  requires: { type: 'feature', feature: 'mine' },
  cost: { gold: 300 }, costGrowth: 1.8, maxLevel: 10,
  modifiers: [{ target: 'production.gold', op: 'pct', value: 0.2 }],
},
```

- Kosten pro Stufe: `cost × costGrowth^Stufe` (Rabatte über `cost.upgrade`-Modifier).
- `maxLevel: null` ergibt eine unendliche Forschung.
- `theme` ordnet die Forschung einem Ast des Forschungsbaums zu (`researchThemes` in derselben Datei: Sammeln, Farm, Mine …). Forschungen, deren `requires` ein Feature verlangt, das eine andere Forschung per `unlocksFeatures` freischaltet, hängen im Baum unter dieser Forschung.
- `unlocksFeatures: ['…']` schaltet ab Stufe 1 Systeme frei.

## Endgame-Inhalte

`src/content/endgame.ts`:

```ts
// Äon-Talent: Mechanik statt nur Prozente
{ id: 'twinBirth', name: 'Zwillingsgeburten', tier: 2, cost: 3, requires: ['aeonHarvest'],
  description: '15 % Chance auf Zwillinge.', modifiers: [{ target: 'breeding.twinChance', op: 'add', value: 0.15 }] },

// Anomalie: Regeln + Ziel + dauerhafte Belohnung, Stufen I–V
{ id: 'famine', name: 'Hungersnot', description: 'Halbe Nahrungsproduktion.',
  modifiers: [{ target: 'production.food', op: 'mult', value: 0.5 }],
  perLevel: [{ target: 'production.food', op: 'mult', value: 0.8 }], levelText: '−20 % Nahrung',
  goal: { type: 'resourceEarned', resource: 'food', amount: 150000 }, goalText: '150.000 Nahrung verdienen',
  reward: [{ target: 'production.food', op: 'pct', value: 0.2 }], rewardText: '+20 % Nahrung' },

// Wochen-Mutation: wird per Kalenderwoche ausgewählt
{ id: 'iceAge', name: 'Eiszeit', description: 'Eis-Kreaturen +50 % Ertrag.',
  modifiers: [{ target: 'element.ice.production', op: 'pct', value: 0.5 }] },
```

- Anomalien haben die Stufen I bis `balance.anomalies.maxLevel`; Stufe n+1 lässt sich erst starten, wenn Stufe n gemeistert ist. `perLevel` wirkt je Stufe über I zusätzlich (`mult` wird potenziert), `levelText` beschreibt das für eine Stufe. Zählbare Ziele wachsen je Stufe um `goalGrowth` (aufgerundet). `resourceEarned`-Ziele wachsen zusätzlich mit dem Produktionsmultiplikator der Ressource hoch `progressExponent`; der Wert wird beim Start des Laufs eingefroren (`anomaly.scales`) und das Ziel auf zwei Stellen gerundet. Für `resourceEarned` erzeugt das Spiel den Zieltext selbst, sonst gilt `goalText`. Die Belohnung zählt je gemeisterter Stufe. Mehrere Anomalien lassen sich kombinieren; ein neuer Rekord in der Summe der Stufen bringt `shardsPerRecordPoint` Äon-Splitter je Punkt und `recordModifiers` je Rekordpunkt.
- Talente können `unlocksFeatures` (bleiben über jeden Reset) und `onReset` (Startressourcen) haben. `unlock` ist eine zusätzliche Bedingung (z. B. eine Bauphase des Äon-Observatoriums); bis sie erfüllt ist, zeigt der Talentbaum die ganze Stufe versiegelt.
- Mechanik-Talente nutzen eigene Modifier-Ziele: `breeding.abilityInherit` (Chance je Eltern-Fähigkeit), `breeding.rarityUp` (Chance auf eine Seltenheitsstufe mehr), `mission.hybridChance` (wilde Funde als entdeckte Hybride), `tower.interval` (Sekunden pro Turm-Kampf), `tower.bossAttempts` (Wochen-Boss-Angriffe pro Tag), `slots.grandResearch`.
- Ein Gen-Locus mit `requires: { type: 'talent', talent: '…' }` existiert erst mit dem Talent – vorhandene Kreaturen bekommen ihn automatisch.
- Allele mit `top: true` definieren das „perfekte Genom“ der Perfektions-Jagd.
- Unendliche Forschung: `category: 'infinite'`, `maxLevel: null` und `levelPower` (< 1 = abnehmender Ertrag).
- Turm-Gegner, Belohnungen, Kontrollpunkte und Meilensteine (`milestoneEvery`, `milestoneShards`, `milestoneModifiers`) stehen in `balance.ts` unter `tower`. Jede frühere Etage ist in drei kleine geteilt (`subFloors`): Gegner wachsen je Etage um `enemyGrowth` (∛1,11), Etage 3n hat Gegner, Element und Boss-Eigenheit der früheren Etage n. Die drei kleinen Etagen einer früheren Etage teilen sich deren Element und Gruppengröße, nur die Stärke steigt. Alle `guardEvery` Etagen (außer auf Boss-Etagen) sind die Gegner stärker (`guardHpMult`/`guardAtkMult`, der erste heißt „Wächter“, kein Checkpoint). Turm-Marken je Etage: `tokensPerFloor` × (1 + `tokenGrowthPerFloor` × (Etage − 1)), als ganze Zahlen über die laufende Summe ausgezahlt (`floorTokens`).
- Kämpfe laufen auf einer Aktionsleiste: Jeder Kämpfer handelt alle (mittleres Tempo des Kampfes / eigenes Tempo)^`speedExponent` Sekunden Kampfzeit; es gibt kein Zeitlimit, es zählt nur, wer zuerst fällt; `maxFightSec` ist nur eine Notbremse gegen endlose Kämpfe (danach Patt = Niederlage). Die Boss-Mauer misst `tests/towerCurve.test.ts` (`GENLAB_CURVE=1` für den Bericht). Schnellere Verteidiger weichen mit `evadePerSpeedLead` je 100 % Tempo-Vorsprung aus (höchstens `maxEvade`). Verteidigung zählt nur im Verhältnis zum Angriff des Gegners: Ein Treffer wird durch 1 + `defWeight` × VER/ANG geteilt, dann zieht VER noch bis zu `defRatio` ab. So dauern Kämpfe auf jeder Höhe etwa gleich lang. Gegner treffen mit `frontShare` die vordere Reihe. Alles unter `balance.tower`.
- Element-Techniken (`techniques.ts`): genau eine je Element. Jede Kreatur setzt ihre Technik bei jeder `balance.tower.techniqueEvery`-ten Aktion statt eines normalen Angriffs ein. `target`: `enemy` (Treffer mit `hit` × normalem Schaden), `self`, `weakestAlly` oder `team`; optional `heal` (Anteil der max. KP), `cleanse` (entfernt Brand, Gift, Betäubung, Verlangsamung) und `status` mit `id`, `duration` (s) und `value` – Bedeutung von `value` je Zustand steht an `TechniqueDef` in `core/content/types.ts`.
- Kampf-Eigenschaften sind normale Modifikatoren: `tower.crit` (Chance auf kritische Treffer × `critMult`), `tower.thorns` (Anteil des erlittenen Schadens zurück), `tower.firstStrike` (≥ 1: handelt sofort). Fähigkeiten, Erbanlagen und Allele können sie geben.
- Synergien: zwei oder mehr Teammitglieder eines Elements bekommen +`pairBonus` Angriff, drei verschiedene Elemente +`diversityBonus` Schaden gegen den Wandler.
- Boss-Eigenheiten (`bossTraits`): `kind` ist `shield` (Schaden ohne Element-Vorteil × `value`), `shift` (Elementwechsel jede Sekunde Kampfzeit), `regen` (heilt `value` × den Schaden der letzten Sekunde) oder `sweep` (jede `balance.tower.sweepEvery`-te Aktion trifft die ganze hintere Reihe mit `value` × Schaden, steht niemand hinten, alle); `targeting` (optional) ändert die Zielwahl: `rows` (Standard, vordere Reihe bevorzugt), `back` (hintere Reihe bevorzugt), `weakest` (wenigste KP). Bosse ab `balance.tower.bossTraitFromFloor` bekommen eine davon, fest pro Etage.
- Gegner je Etage kommen aus `enemiesFor` (`features/tower.ts`), fest pro Etage. Ab `groupFromFloor` können normale Etagen 2–3 Gegner bringen, die sich KP und Angriff teilen (Summe × `groupHp`/`groupAtk` je Gruppengröße). Ab `companionsFromFloor` stehen zwei Begleiter (`companionHp`/`companionAtk` × Werte eines normalen Gegners) vorne, der Boss hinten; ab `phaseFromFloor` bekommt der Boss unter `phaseAt` KP eine zweite Eigenheit. Gegner setzen ihre Element-Technik jede `enemyTechniqueEvery`-te Aktion ein (0 = nie). Das Team greift immer den Gegner der vorderen Reihe mit dem kleinsten KP-Anteil an.
- Relikte (`relics`): `cost` in Turm-Marken für Stufe 1, jede Stufe × `costGrowth`; `bonus` pro Stufe auf `hp`, `atk`, `def`, `spd` oder `element` (Element-Vorteil). Sie gehören dem Spieler und wirken auf die Kreatur im Turm-Platz, in dem sie stecken – im Turm und gegen den Wochen-Boss.

## GenLab RPG

`src/content/rpg.ts` – alles für den rundenbasierten Dungeon (Regeln in `core/features/rpg.ts` und `rpgCombat.ts`, Zahlen in `balance.rpg`):

```ts
// Dritte Fähigkeit: genau eine Quelle – aufgedeckte Erbanlage, Fähigkeit oder Rolle (Fallback)
{ id: 'hunt', slot: 'third', name: 'Jagdinstinkt', icon: '🐾', target: 'enemy', hit: 2, cooldown: 4, from: { latent: 'hunter' },
  description: 'Ein gezielter Sprung mit doppeltem Schaden.' },

// Gegnerart: Zugmuster (wird angekündigt), Multiplikatoren auf die Dungeon-Stärke
{ id: 'brawler', name: 'Wilder', kind: 'normal', pattern: ['attack', 'attack', 'charge', 'heavy'], hp: 1, atk: 1, def: 1, spd: 1 },

// Dungeon: Elemente der Gegner, Gegnerstufe im ersten Raum und Anstieg je Raum, Räume bis zum Boss, Beute-Faktor, Vorgänger
{ id: 'emberCaves', name: 'Glutgrotten', icon: '🌋', elements: ['fire'], level: 8, levelsPerRoom: 0.9, rooms: 9, loot: 1.6, requires: 'rootMaze', description: '…' },
```

- `rpgSkills`: genau ein `basic` und ein `special`, dazu `third`-Fähigkeiten – für jede Rolle (`tank`, `attacker`, `fast`) mindestens eine. Außerdem die Abwehr-Züge (`slot: 'defense'` mit `stance` `dodge`, `parry`, `breathe`) und genau ein Heiltrank (`slot: 'item'` mit `heal`). `stamina` überschreibt die Ausdauerkosten des Slots (`balance.rpg.stamina.cost`). Die Element-Technik kommt aus `techniques.ts` und wird umgerechnet (`secondsPerRound` Turm-Sekunden = 1 Runde, Abklingzeit `techniqueCooldown`). Zustände zählen in Runden; `value` wie an `RpgSkillDef` beschrieben.
- `rpgEnemies`: `pattern` aus `attack`, `combo` (zwei Treffer à `comboMult`; Ausweichen entgeht nur dem ersten, eine Parade beiden), `charge` (danach muss `heavy` folgen), `heavy` (× `heavyMult`), `guard` (Schild `guardShare` × KP ab Rundenbeginn), `heal` (`healShare`), `tech` (Element-Technik). Mindestens eine Art je `kind` (`normal`, `elite`, `boss`). Ein Boss mit `dungeon` ist der eigene Boss dieses Dungeons (höchstens einer je Dungeon; `name` ist dann der volle Name), optional mit `species` (Aussehen, Element), `onHit` (Zustand seiner Treffer: `burn`, `poison`, `slow`, `stun`) und `phase2` (neues `pattern`, `atk`/`spd`-Faktor, `text`) unter `balance.rpg.bossPhaseAt` seiner KP.
- Isekai: In der anderen Welt zählt nur die Art und die Stufe dort; Zuchtwerte zählen nicht. Die Grundwerte der Art werden auf den Maßstab der Grundarten skaliert (Tempo zählt dabei halb) und mit `balance.rpg.tierMult` (Hybrid, Mythisch …) verstärkt, je Stufe kommen `statsPerLevel` dazu (Erfahrung `xp`/`xpBase`/`xpGrowth`, `maxLevel`).
- `rpgDungeons`: Gegner der Tiefe d haben die Stufe `level + (d − 1) × levelsPerRoom`. Ihre Art formt sie nur (Profil auf den Maßstab der Grundarten skaliert, ohne Stufen-Bonus), die Stärke kommt aus Stufe × Gegnerart × `balance.rpg.enemyMult`. Erfahrung je Gegner: `xp[Art]` × `xpFoeGrowth`^(Stufe − 1). Nach `rooms` Räumen kommt der Boss; sein Sieg öffnet den Dungeon mit `requires` auf diesen.
- `rpgEvents`: genau zwei Wahlmöglichkeiten; `hp` (Anteil der max. KP, nie tödlich), `loot` (× Beute eines Schatzraums), `secure`; mit `chance` < 1 braucht die Wahl ein `fail`.
- `rpgUpgrades` (Stufenaufstieg, nur für den Lauf): `stats` und/oder `perks` (`specialPower`, `chargePerRound`, `lifesteal`, `crit`, `regen`, `cooldown`), optional `max`. Mindestens drei ohne `max`.
- `rpgGear` (Ausrüstung, gehört dem Spieler): `slot` `weapon`/`armor`/`charm`, Werte eines gewöhnlichen Teils; Seltenheit multipliziert (`gearRarityMult`). Wirkt nur im Dungeon.
- `rpgMeta` (Runen-Wissen, dauerhaft): `cost` × `costGrowth`^Stufe bis `maxLevel`; `effect` je Stufe: `stats`, `torches`, `startCharge`, `restHeal`, `roleSkill`.
- Balancing: `GENLAB_RPG=1 npx vitest run tests/rpgBot.test.ts --silent=false` druckt je Dungeon, wie weit ein Monster der Stufe L kommt, die Beute pro Fackel, und wie viele Läufe ein neues Monster ab Stufe 1 bis zu jedem Dungeon-Sieg braucht.

## Weitere Inhaltsarten

| Datei | Inhalt |
|---|---|
| `buildings.ts` | Anlagen: produzierte Ressource, Grundrate, Stat, der den Ertrag erhöht, `elements` mit Typvorteil (+`balance.production.affinityBonus`), Plätze |
| `potions.ts` | Tränke: `permanentStat` (mit `statBonus`), `creatureBuff`, `globalBuff`, `timeSkip` |
| `missions.ts` | Erkundungen: Dauer, Kosten, Belohnungsbereiche, Chance auf wilde Kreatur |
| `abilities.ts` | Fähigkeiten mit Stufe und Wirkungsbereich `self` / `job` / `global` |
| `capsules.ts` | Gen-Kapseln: Kosten, Seltenheits-Gewichte (werden offen angezeigt), Stufen-Gewichte (Basis/Hybrid/…), optional Elementwahl, Pity-Schwelle |
| `progression.ts` | Freischaltungen (`features`, optional mit `grantsCreature`), Dex-Belohnungen, Erfolge, Prestige-Ebenen |
| `names.ts` | Namen gezüchteter Kreaturen: `givenStart` + `givenEnd` (Bausteine wie „Wusel“ + „bert“) und `given` (klassische Rufnamen), `familySuffix` (Endungen der Familiennamen; Vorsilben je Element als `familyPrefixes` in `elements.ts`), `epithet.<stat>` und `epithet.shiny` (Beinamen). Rufnamen bis `balance.creature.maxGivenLength` Zeichen; Kinder mischen meist die Rufnamen der Eltern (`freshNameChance` = Anteil ganz neuer Namen) |
| `balance.ts` | Alle Tuning-Zahlen: Zeiten, Seltenheits-Gewichte, Stat-Multiplikatoren, Prestige-Formel, Stall, Verkaufswerte, Infusion (EP, Stufen, Durchbruch), Recycler |

Bedingungen (`Condition`) für Freischaltungen und Erfolge: `always`, `resourceEarned`, `resourceOwned`, `upgradeLevel`, `feature`, `creatureCount`, `statistic`, `dex`, `prestigeCount`, sowie `all` / `any` zum Kombinieren.

## „Was ist neu?“ (Änderungshinweise für Spieler)

`src/ui/changelog.ts` – vor jedem Release einen Eintrag **oben** anfügen, `id` um eins erhöhen:

```ts
{
  id: 2, date: '2026-10-05', title: 'Kurzer Titel',
  items: [
    { text: 'Was Spieler jetzt können – ohne Fachbegriffe aus dem Code.' },
    { text: 'Neuerung im Genom-Turm …', feature: 'tower' },
  ],
},
```

- Nach dem Update zeigt das Spiel einmalig ein Fenster mit allen Einträgen, die das Gerät noch nicht kannte (auch in den Apps). Neue Spieler sehen es nicht. In den Optionen lässt es sich jederzeit öffnen.
- **Keine Spoiler:** Einträge mit `feature` erscheinen erst, wenn diese Freischaltung erreicht ist (IDs aus `progression.ts`). Sonst steht dort nur „🔒 1 Verbesserung für einen Bereich, den du noch entdeckst.“ Systeme deshalb nur in Einträgen mit passendem `feature` beim Namen nennen.
- Der Build legt die Liste zusätzlich als `changelog.json` ab. Damit zeigt der Update-Hinweis der **alten** Version schon eine Vorschau (die Datei ist bewusst nicht im Offline-Cache).
