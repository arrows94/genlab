import { buffSystem } from './buffs';
import { processSystem } from './processes';
import { productionSystem } from './production';
import type { System } from './types';
import { unlockSystem } from './unlocks';
import { automationSystem, recyclerSystem } from '../features/automation';
import { towerSystem } from '../features/tower';
import { contractSystem } from '../features/contracts';
import { weeklyBossSystem } from '../features/weeklyBoss';
import { rpgSystem } from '../features/rpg';
import { weeklySystem } from '../features/weekly';
import { collectSystem } from '../features/collect';

/** Default system order. Later phases append systems (tower, weekly mutation ...). */
export const DEFAULT_SYSTEMS: System[] = [weeklySystem, productionSystem, collectSystem, processSystem, buffSystem, automationSystem, recyclerSystem, towerSystem, contractSystem, weeklyBossSystem, rpgSystem, unlockSystem];

export type { System };
