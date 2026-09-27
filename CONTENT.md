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
  id: 'armor', name: 'Panzer', category: 'stat',
  alleles: [
    { id: 'P', name: 'Gepanzert', symbol: 'P', dominance: 2, weight: 20, color: '#b0bec5',
      modifiers: [{ target: 'stat.def', op: 'pct', value: 0.25 }] },
    { id: 'p', name: 'Normal', symbol: 'p', dominance: 1, weight: 80, color: '#607d8b', modifiers: [] },
  ],
},
```

Höhere `dominance` setzt sich durch, gleiche `dominance` = kodominant. `weight` bestimmt die Häufigkeit bei wilden Kreaturen.

## Neues Hybrid-Rezept

`src/content/recipes.ts` (die Ergebnis-Art muss in `species.ts` existieren, mit `tier: 'hybrid'` und `wild: false`):

```ts
{
  id: 'magma', parents: ['emberpup', 'pebblit'], result: 'magmole', chance: 0.12,
  requires: { minGeneration: 3, allele: { locus: 'strength', allele: 'K' } },
  hint: 'Heißes Gestein …',
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
