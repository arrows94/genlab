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

## Neue Region (Erkundung)

`src/content/missions.ts`: eine Mission mit `requires` (wann sie erscheint) und `species` (wer dort lebt):

```ts
{
  id: 'frostpeak', name: 'Frostgipfel', description: 'Eisige Höhen voller Metalladern.', durationSec: 900, cost: { food: 400 },
  requires: { type: 'upgradeLevel', upgrade: 'cartographer', level: 2 },
  rewards: { gold: [150, 400], catalyst: [0, 1] }, wildChance: 0.45, species: ['frostling', 'ferrox'],
},
```

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

## Weitere Inhaltsarten

| Datei | Inhalt |
|---|---|
| `buildings.ts` | Anlagen: produzierte Ressource, Grundrate, Stat, der den Ertrag erhöht, Plätze |
| `potions.ts` | Tränke: `permanentStat` (mit `statBonus`), `creatureBuff`, `globalBuff`, `timeSkip` |
| `missions.ts` | Erkundungen: Dauer, Kosten, Belohnungsbereiche, Chance auf wilde Kreatur |
| `abilities.ts` | Fähigkeiten mit Stufe und Wirkungsbereich `self` / `job` / `global` |
| `progression.ts` | Freischaltungen (`features`, optional mit `grantsCreature`), Dex-Belohnungen, Erfolge, Prestige-Ebenen |
| `balance.ts` | Alle Tuning-Zahlen: Zeiten, Seltenheits-Gewichte, Stat-Multiplikatoren, Prestige-Formel |

Bedingungen (`Condition`) für Freischaltungen und Erfolge: `always`, `resourceEarned`, `resourceOwned`, `upgradeLevel`, `feature`, `creatureCount`, `statistic`, `dex`, `prestigeCount`, sowie `all` / `any` zum Kombinieren.
