import { mount } from 'svelte';
import './ui/styles.css';

const target = document.getElementById('app')!;

// Content is validated on import; show broken content as a readable error page.
import('./ui/App.svelte')
  .then(({ default: App }) => mount(App, { target }))
  .catch((err: Error) => {
    const pre = document.createElement('pre');
    pre.className = 'fatal';
    pre.textContent = `Genlab konnte nicht starten:\n\n${err.message}`;
    target.replaceChildren(pre);
    console.error(err);
  });
