import { buffSystem } from './buffs';
import { processSystem } from './processes';
import { productionSystem } from './production';
import type { System } from './types';
import { unlockSystem } from './unlocks';
import { automationSystem } from '../features/automation';
import { towerSystem } from '../features/tower';
import { contractSystem } from '../features/contracts';

/** Default system order. Later phases append systems (tower, weekly mutation ...). */
export const DEFAULT_SYSTEMS: System[] = [productionSystem, processSystem, buffSystem, automationSystem, towerSystem, contractSystem, unlockSystem];

export type { System };
