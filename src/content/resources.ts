import type { ResourceDef } from '@core/content/types';

export const resources: ResourceDef[] = [
  { id: 'food', name: 'Nahrung', icon: '🍖', color: '#8fd16a' },
  { id: 'gold', name: 'Gold', icon: '🪙', color: '#f2c14e', feature: 'mine' },
  { id: 'essence', name: 'Essenz', icon: '🧪', color: '#b38cff', feature: 'biolab' },
  { id: 'catalyst', name: 'Evolutionskristall', icon: '💎', color: '#ff7ad9', feature: 'evolution', description: 'Treibt Evolutionen an. Aus langen Reisen und fernen Regionen.' },
  { id: 'heritage', name: 'Erbgut', icon: '🧬', color: '#4fd6c8', feature: 'inheritance', description: 'Dauerhafter Produktionsbonus aus der Vererbung.' },
];
