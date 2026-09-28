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

`src/content/rituals.ts`: langsame Brutarten mit besseren Chancen. Das normale Ei bleibt unverändert.

```ts
{ id: 'noble', name: 'Edelbrut', icon: '💠', hours: 8, description: '…', cost: { essence: 300 },
  requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 }, minRarity: 'uncommon', rarityBoost: 2 },
```

- `hours` ersetzt die normale Brutzeit, `cost` kommt zu den normalen Kosten dazu.
- Wirkungen: `hybridMult` (multipliziert jede Rezept-Chance), `minRarity` (Mindestseltenheit), `rarityBoost` (Gewicht für Selten und höher, 2 = dreifach), `mutationAdd`.
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
  id: 'goldenShovels', name: 'Goldene Schaufeln', category: 'research',
  description: '+20 % Goldproduktion.',
  requires: { type: 'feature', feature: 'mine' },
  cost: { gold: 300 }, costGrowth: 1.8, maxLevel: 10,
  modifiers: [{ target: 'production.gold', op: 'pct', value: 0.2 }],
},
```

- Kosten pro Stufe: `cost × costGrowth^Stufe` (Rabatte über `cost.upgrade`-Modifier).
- `maxLevel: null` ergibt eine unendliche Forschung.
- `unlocksFeatures: ['…']` schaltet ab Stufe 1 Systeme frei.

## Endgame-Inhalte

`src/content/endgame.ts`:

```ts
// Äon-Talent: Mechanik statt nur Prozente
{ id: 'twinBirth', name: 'Zwillingsgeburten', tier: 2, cost: 3, requires: ['aeonHarvest'],
  description: '15 % Chance auf Zwillinge.', modifiers: [{ target: 'breeding.twinChance', op: 'add', value: 0.15 }] },

// Anomalie: Regeln + Ziel + dauerhafte Belohnung
{ id: 'famine', name: 'Hungersnot', description: 'Halbe Nahrungsproduktion.',
  modifiers: [{ target: 'production.food', op: 'mult', value: 0.5 }],
  goal: { type: 'resourceEarned', resource: 'food', amount: 150000 }, goalText: '150.000 Nahrung verdienen',
  reward: [{ target: 'production.food', op: 'pct', value: 0.2 }], rewardText: '+20 % Nahrung' },

// Wochen-Mutation: wird per Kalenderwoche ausgewählt
{ id: 'iceAge', name: 'Eiszeit', description: 'Eis-Kreaturen +50 % Ertrag.',
  modifiers: [{ target: 'element.ice.production', op: 'pct', value: 0.5 }] },
```

- Talente können `unlocksFeatures` (bleiben über jeden Reset) und `onReset` (Startressourcen) haben.
- Ein Gen-Locus mit `requires: { type: 'talent', talent: '…' }` existiert erst mit dem Talent – vorhandene Kreaturen bekommen ihn automatisch.
- Allele mit `top: true` definieren das „perfekte Genom“ der Perfektions-Jagd.
- Unendliche Forschung: `category: 'infinite'`, `maxLevel: null` und `levelPower` (< 1 = abnehmender Ertrag).
- Turm-Gegner, Belohnungen und Kontrollpunkte stehen in `balance.ts` unter `tower`.

## Weitere Inhaltsarten

| Datei | Inhalt |
|---|---|
| `buildings.ts` | Anlagen: produzierte Ressource, Grundrate, Stat, der den Ertrag erhöht, Plätze |
| `potions.ts` | Tränke: `permanentStat` (mit `statBonus`), `creatureBuff`, `globalBuff`, `timeSkip` |
| `missions.ts` | Erkundungen: Dauer, Kosten, Belohnungsbereiche, Chance auf wilde Kreatur |
| `abilities.ts` | Fähigkeiten mit Stufe und Wirkungsbereich `self` / `job` / `global` |
| `capsules.ts` | Gen-Kapseln: Kosten, Seltenheits-Gewichte (werden offen angezeigt), Stufen-Gewichte (Basis/Hybrid/…), optional Elementwahl, Pity-Schwelle |
| `progression.ts` | Freischaltungen (`features`, optional mit `grantsCreature`), Dex-Belohnungen, Erfolge, Prestige-Ebenen |
| `balance.ts` | Alle Tuning-Zahlen: Zeiten, Seltenheits-Gewichte, Stat-Multiplikatoren, Prestige-Formel, Stall, Verkaufswerte, Infusion (EP, Stufen, Durchbruch), Recycler |

Bedingungen (`Condition`) für Freischaltungen und Erfolge: `always`, `resourceEarned`, `resourceOwned`, `upgradeLevel`, `feature`, `creatureCount`, `statistic`, `dex`, `prestigeCount`, sowie `all` / `any` zum Kombinieren.
