<script lang="ts">
  import { collect, collectAmounts } from '@core/actions';
  import { formatNumber } from '@core/format';
  import { content } from '@content/index';
  import { game, view, act } from '../store.svelte';
  import CreatureCard from './CreatureCard.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EvolvePanel from './EvolvePanel.svelte';

  const creatures = $derived.by(() => {
    view.frame;
    return [...game.state.creatures];
  });
  const perClick = $derived.by(() => {
    view.frame;
    return Object.entries(collectAmounts(game));
  });

  let pulse = $state(0);
  function onCollect() {
    if (act(collect(game))) pulse++;
  }
</script>

<section class="panel collect">
  <div>
    <h2>Genlabor</h2>
    <p class="muted">Sammle Nahrung für deine Kreaturen.</p>
  </div>
  <button class="primary big" onclick={onCollect}>
    Sammeln
    <span class="num gain">
      {#each perClick as [res, amount] (res)}+{formatNumber(amount)} {content.resources.get(res).icon} {/each}
    </span>
  </button>
  {#key pulse}<div class="helix"><DnaHelix progress={1} /></div>{/key}
</section>

<section>
  <h2>Kreaturen <span class="muted num">({creatures.length})</span></h2>
  <div class="grid">
    {#each creatures as c (c.id)}
      <CreatureCard creature={c}><EvolvePanel creature={c} /></CreatureCard>
    {/each}
  </div>
</section>

<style>
  section { margin-bottom: 1rem; }
  .collect { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: space-between; }
  .collect p { margin: 0; }
  .big { font-size: 1.15rem; padding: 0.9rem 1.6rem; display: flex; flex-direction: column; align-items: center; min-width: 11rem; }
  .gain { font-size: 0.8rem; opacity: 0.85; }
  .helix { animation: pop 0.3s ease-out; }
  @keyframes pop { from { transform: scale(1.12); filter: brightness(1.6); } to { transform: scale(1); } }
</style>
