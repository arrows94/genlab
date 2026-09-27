# Genlab

Browser-Idle-Game rund um Kreaturenzucht und Genetik. TypeScript (strict) + Vite + Svelte 5, große Zahlen mit `break_infinity.js`, Tests mit Vitest.

Die vollständige Projektbeschreibung steht in [`genlab-neubau-prompt.md`](genlab-neubau-prompt.md).

## Starten

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Entwicklungsserver (http://localhost:5173)
npm test         # Unit-Tests (Vitest)
npm run check    # Typprüfung (svelte-check / tsc)
npm run build    # Typprüfung + Produktions-Build nach dist/
```

Der Build nutzt relative Pfade (`base: './'`) und läuft damit auch per `file://` bzw. in Tauri/Capacitor.

## Architektur

```
src/
  core/        reine Spiellogik – kein DOM, keine UI-Imports, vollständig testbar
    content/   Content-Interfaces, Balance-Typ, Validierung
    systems/   Tick-Systeme (Produktion, Prozesse, Buffs, Freischaltungen)
  content/     alle Spielinhalte als Daten + balance.ts
  ui/          Svelte-Komponenten, liest nur State und ruft Aktionen auf
tests/         Vitest-Tests für die Core-Logik
```

| Baustein | Datei | Kurz |
|---|---|---|
| Inhalte + Validierung | `core/content/types.ts`, `core/content/validate.ts` | Jede Inhaltsart hat ein Interface; beim Start werden IDs, Querverweise, Modifier-Ziele und Bedingungen geprüft. Fehler → lesbare Liste, z. B. `species[emberpup].element: unbekannte elements-id "lava"`. |
| Balancing | `content/balance.ts` | Alle Tuning-Zahlen (Tick, Offline-Cap, Wahrscheinlichkeiten, Prestige-Formel …). |
| Modifier-System | `core/modifiers.ts`, `core/providers.ts` | `(Basis + Σadd) × (1 + Σpct) × Πmult` pro Ziel (`production.gold`, `breeding.time` …). Jede Bonusquelle ist ein Provider; neue Boni = neue Daten. |
| Simulation | `core/game.ts` | Feste Zeitschritte (`tickMs`). Offline-Fortschritt nutzt dieselbe `step()`-Funktion mit gröberen Schritten, gedeckelt (12 h + `offline.capHours`). |
| Zeitprozesse | `core/systems/processes.ts` | Generische Prozesse (Ei, Mission, Sequenzierung …) mit Handler je `kind`. |
| Event-Bus | `core/events.ts`, `core/gameEvents.ts` | Typisierte Events; Statistiken, Erfolge und UI-Toasts hängen sich an. |
| Speichern | `core/save.ts` | Versionierte Spielstände (`saveVersion` + Migrationen), Default-Merge für neue Felder, Export/Import als Text (`GENLAB1:…`), austauschbarer `SaveStorage`. |
| Zufall | `core/rng.ts` | Seedbarer RNG (mulberry32), Zustand im Spielstand → reproduzierbar. |
| Prestige | `core/prestige.ts` | Reset-Umfang ist reine Daten (`PrestigeLayerDef.resets`). |
| Spielsysteme | `core/features/` | Brutstation, Erkundung, Markt – registrieren ihre Zeitprozesse selbst. |

## Balancing prüfen

`tests/progression.test.ts` lässt einen einfachen Bot die erste Spielstunde spielen und prüft, ob die Systeme in der richtigen Reihenfolge freigeschaltet werden und mindestens alle 8 Minuten etwas Neues passiert. Die Zeitleiste lässt sich ausgeben:

```bash
GENLAB_TIMELINE=1 npx vitest run tests/progression.test.ts --silent=false
```

Wie man Inhalte hinzufügt, steht in [`CONTENT.md`](CONTENT.md).

## Stand

- [x] **Phase 1 – Fundament**: Setup, Ordnerstruktur, Content-Interfaces + Validierung, Modifier-System, Tick/Offline, Save/Load/Migration, Event-Bus, Tests, spielbares Grundgerüst (Sammeln, Farm/Mine, Forschung, Dex, Statistik, Vererbung, Export/Import)
- [x] **Phase 2 – Portierung**: Brutstation (Vererbung von Werten, Aussehen, Fähigkeiten, Mutation, mehrere Nester), Erkundung (Camps, Beute, wilde Kreaturen), Bio-Labor, Markt (Kraftfutter, Turbo-Trank, Festmahl, Zeitkristall), Fähigkeiten in Stufen, vollständiger Forschungsbaum inkl. Dex-Freischaltungen, langsamer Start mit schrittweisen Freischaltungen, Tab-Badges
- [ ] Phase 3 – Genetik
- [ ] Phase 4 – Arten & Hybride
- [ ] Phase 5 – Management & Verwertung
- [ ] Phase 6 – Endgame
- [ ] Phase 7 – Feinschliff
