import { buffSystem } from './buffs';
import { processSystem } from './processes';
import { productionSystem } from './production';
import type { System } from './types';
import { unlockSystem } from './unlocks';
import { automationSystem, recyclerSystem } from '../features/automation';
import { towerSystem } from '../features/tower';
import { contractSystem } from '../features/contracts';
import { weeklyBossSystem } from '../features/weeklyBoss';

/** Default system order. Later phases append systems (tower, weekly mutation ...). */
export const DEFAULT_SYSTEMS: System[] = [productionSystem, processSystem, buffSystem, automationSystem, recyclerSystem, towerSystem, contractSystem, weeklyBossSystem, unlockSystem];

export type { System };
