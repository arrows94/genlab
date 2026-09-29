<script lang="ts">
  import { activeLoci, alleleBases, genomeReport, scaledValue } from '@core/genetics';
  import { describeModifier } from '@core/queries';
  import type { Genome } from '@core/state';
  import { game, view } from '../store.svelte';

  /**
   * Detailed genome view: loci grouped by category, each as a base pair of
   * two allele capsules. Masked (recessive) alleles are dimmed, the expressed
   * trait and its effect are spelled out, top alleles carry a star. Unknown
   * genomes show grey capsules.
   */
  let { genome, known }: { genome: Genome; known: boolean } = $props();

  const CATEGORIES: { id: string; name: string; icon: string }[] = [
    { id: 'stat', name: 'Werte', icon: '💪' },
    { id: 'trait', name: 'Eigenschaften', icon: '✨' },
    { id: 'visual', name: 'Aussehen', icon: '🎨' },
  ];
  const ZYGOSITY = { homozygous: 'reinerbig', heterozygous: 'mischerbig', codominant: 'kodominant' } as const;

  const data = $derived.by(() => {
    view.slowFrame;
    const report = known ? genomeReport(game, genome) : [];
    const rows = report.map((r) => ({
      ...r,
      effects: r.expression.flatMap((e) => e.allele.modifiers.map((m) => describeModifier(game, { ...m, value: scaledValue(m, e.share) }))),
      bases: alleleBases(r.alleles[0]?.id ?? '?', 3) + alleleBases(r.alleles[1]?.id ?? '?', 3),
    }));
    const loci = activeLoci(game);
    const withTop = rows.filter((r) => r.top);
    return {
      groups: CATEGORIES.map((c) => ({ ...c, rows: rows.filter((r) => r.locus.category === c.id), unknown: known ? [] : loci.filter((l) => l.category === c.id) }))
        .filter((g) => g.rows.length > 0 || g.unknown.length > 0),
      perfect: withTop.filter((r) => r.perfect).length,
      topTotal: withTop.length,
      carriesTop: withTop.filter((r) => !r.perfect && r.alleles.some((a) => a?.top)).length,
      pure: rows.filter((r) => r.zygosity === 'homozygous').length,
      total: rows.length,
    };
  });
</script>

<div class="genome" class:unknown={!known}>
  {#if known}
    <div class="summary">
      <span class="chip gold" class:full={data.perfect === data.topTotal} title="Loci reinerbig mit ihrem besten Allel">
        ✦ <b class="num">{data.perfect}/{data.topTotal}</b> Top-Allele reinerbig
      </span>
      {#if data.carriesTop > 0}<span class="chip violet" title="Trägt das beste Allel einmal – Zucht oder Splicing kann es verdoppeln">◐ <b class="num">{data.carriesTop}</b> mischerbig mit Top-Allel</span>{/if}
      <span class="chip" title="Beide Allele gleich"><b class="num">{data.pure}/{data.total}</b> reinerbig</span>
      {#if data.perfect === data.topTotal && data.topTotal > 0}<span class="chip perfect">🌟 Perfektes Genom</span>{/if}
    </div>
  {/if}

  {#each data.groups as g (g.id)}
    <h4><span>{g.icon}</span> {g.name}</h4>
    <div class="loci">
      {#each g.rows as r (r.locus.id)}
        <div class="locus" class:perfect={r.perfect} title="{r.locus.description}{'\n'}{r.bases}">
          <div class="lhead">
            <span class="lname">{r.locus.name}</span>
            {#if r.perfect}<span class="star" title="Reinerbig mit dem besten Allel">★</span>{/if}
            <span class="zyg {r.zygosity}">{ZYGOSITY[r.zygosity]}</span>
          </div>
          <div class="pair">
            {#each [0, 1] as const as s (s)}
              {@const a = r.alleles[s]}
              <span class="allele" class:masked={!r.expressed[s]} class:top={a?.top} style="--c: {a?.color ?? '#555'}" title="{a?.name ?? '?'}{a?.top ? ' · bestes Allel' : ''}{r.expressed[s] ? '' : ' · verdeckt (wird aber vererbt)'}">
                <span class="sym">{a?.symbol ?? '?'}</span>
                <span class="aname">{a?.name ?? '?'}</span>
              </span>
              {#if s === 0}<span class="bond" aria-hidden="true"></span>{/if}
            {/each}
          </div>
          <div class="pheno">
            <b>{r.expression.map((e) => e.allele.name).join(' / ')}</b>
            <span class="eff">{r.effects.length ? r.effects.join(' · ') : r.locus.category === 'visual' ? 'nur Aussehen' : 'keine Wirkung'}</span>
          </div>
        </div>
      {/each}
      {#each g.unknown as l (l.id)}
        <div class="locus" title={l.description}>
          <div class="lhead"><span class="lname">{l.name}</span></div>
          <div class="pair">
            <span class="allele blank"><span class="sym">?</span></span><span class="bond" aria-hidden="true"></span><span class="allele blank"><span class="sym">?</span></span>
          </div>
          <div class="pheno"><span class="eff">unbekannt</span></div>
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .genome { display: grid; gap: 0.4rem; }
  .summary { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.55rem; border-radius: 99px; font-size: 0.78rem; background: var(--bg-2); border: 1px solid var(--line); }
  .chip.gold { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
  .chip.gold.full, .chip.perfect { color: var(--gold); border-color: var(--gold); box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 30%, transparent); }
  .chip.violet { border-color: color-mix(in srgb, var(--violet) 50%, var(--line)); }

  h4 { margin: 0.35rem 0 0; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; display: flex; gap: 0.35rem; align-items: center; }
  h4 span { font-size: 0.9rem; }
  .loci { display: grid; gap: 0.4rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); }

  .locus {
    position: relative; display: grid; gap: 0.35rem; padding: 0.45rem 0.55rem; border-radius: 10px;
    background: linear-gradient(160deg, var(--panel-2), var(--bg-2)); border: 1px solid var(--line);
  }
  .locus.perfect { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); box-shadow: inset 0 0 14px color-mix(in srgb, var(--gold) 10%, transparent); }
  .lhead { display: flex; align-items: center; gap: 0.35rem; }
  .lname { font-weight: 600; font-size: 0.85rem; }
  .star { color: var(--gold); text-shadow: 0 0 6px color-mix(in srgb, var(--gold) 70%, transparent); }
  .zyg { margin-left: auto; font-size: 0.66rem; padding: 0.05rem 0.4rem; border-radius: 99px; color: var(--muted); border: 1px solid var(--line); }
  .zyg.homozygous { color: var(--teal); border-color: color-mix(in srgb, var(--teal) 45%, var(--line)); }
  .zyg.codominant { color: var(--violet); border-color: color-mix(in srgb, var(--violet) 45%, var(--line)); }

  .pair { display: flex; align-items: center; }
  .bond { flex: 0 0 14px; height: 3px; background: repeating-linear-gradient(90deg, var(--line) 0 3px, transparent 3px 5px); }
  .allele {
    flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.45rem 0.15rem 0.2rem; border-radius: 999px;
    background: color-mix(in srgb, var(--c) 22%, var(--bg-2)); border: 1.5px solid color-mix(in srgb, var(--c) 70%, transparent);
  }
  .allele .sym {
    flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%; display: grid; place-items: center; font-family: var(--mono); font-weight: 700; font-size: 0.78rem;
    color: #fff; text-shadow: 0 1px 2px #000a; background: color-mix(in srgb, var(--c) 70%, #0006);
  }
  .aname { font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .allele.top { box-shadow: 0 0 8px color-mix(in srgb, var(--c) 55%, transparent); }
  .allele.masked { opacity: 0.45; border-style: dashed; filter: saturate(0.5); }
  .allele.blank { --c: #56707a; opacity: 0.6; border-style: dashed; justify-content: center; }

  .pheno { display: grid; gap: 0.05rem; font-size: 0.78rem; }
  .pheno b { color: var(--text); }
  .eff { color: var(--muted); font-size: 0.72rem; }
  .unknown .locus { opacity: 0.8; }
</style>
