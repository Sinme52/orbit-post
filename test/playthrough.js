// Playthrough test: a naive pilot that only follows the on-screen marker plays every stage
// through real key events and the real update loop (simulated clock, no teleporting).
// Usage: node orbit-post/test/playthrough.js [unlocked stages to start with, default 1]
// Needs Playwright with Chromium. Prints every dock arrival with the fuel left in the tank,
// every lost ship, a per-stage summary, and exits non-zero if the ending is not reached.
const { chromium } = require('playwright');
const START_UNLOCKED = +(process.argv[2] || 1);
const PAGE = 'file://' + require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PAGE);
  await page.evaluate(u => { localStorage.clear(); localStorage.setItem('orbitpost.unlocked', String(u)); }, START_UNLOCKED);
  await page.reload();
  await page.waitForTimeout(300);

  const out = await page.evaluate(() => {
    const O = OrbitPost, G = O.G;
    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const len = a => Math.hypot(...a), norm = a => { const l = len(a) || 1; return a.map(v => v / l); };
    const held = new Set();
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const setKeys = want => {
      for (const c of [...held]) if (!want.has(c)) { key(c, false); held.delete(c); }
      for (const c of want) if (!held.has(c)) { key(c, true); held.add(c); }
    };
    const step = () => O.update(1 / 60);
    const tap = code => { key(code, true); step(); key(code, false); step(); };

    const lines = [], stages = {};
    let t = 0, last = '', fuelBefore = 100, tripStart = 0;
    const st = () => (stages[O.STAGE.n + 1] ??= { name: O.STAGE.name, trips: [], losses: 0 });
    const log = s => lines.push(`[${(t / 60).toFixed(0).padStart(4)}s] ${O.STAGE.n + 1}:${O.STAGE.name.padEnd(6)} ${s}`);
    lines.push('title shows STAGE ' + (G.sel + 1) + ' ' + O.STAGES[G.sel].name);
    tap('Enter');

    while (t < 60 * 60 * 30) {
      t++;
      const state = G.state;
      if (state !== last) {
        if (state === 'docked' && last === 'flight') {
          const trip = { fuelLeft: fuelBefore, secs: (t - tripStart) / 60 };
          st().trips.push(trip);
          log(`docked @${O.STAGE.ports[G.port].name.padEnd(11)} "${G.dockEvent.join(' / ')}"  fuel left ${fuelBefore.toFixed(0)}%  (${trip.secs.toFixed(0)}s)`);
        } else if (state === 'docked') log(`docked @${O.STAGE.ports[G.port].name.padEnd(11)} "${G.dockEvent.join(' / ')}"`);
        if (state === 'lost') { st().losses++; log('LOST: ' + G.lostMsg + `  (fuel ${G.ship.fuel.toFixed(0)}%, hull ${G.ship.hull.toFixed(0)})`); }
        if (state === 'tanker') { st().tankers = (st().tankers || 0) + 1; log('NO FUEL: tanker refuel'); }
        if (state === 'ending') log('ENDING');
        last = state;
      }
      if (state === 'ending') break;
      if (state === 'docked') { setKeys(new Set()); tap('KeyZ'); tripStart = t; continue; }
      if (state !== 'flight') { setKeys(new Set()); step(); continue; }

      const s = G.ship;
      if (G.target !== G.job.to) { tap('ShiftLeft'); continue; }
      fuelBefore = s.fuel;
      // steer at the marker; pick a speed from the distance left on the whole route, not to the next waypoint
      const goal = G.nav, d = norm(sub(goal, s.pos)), x = dot(d, s.r), y = dot(d, s.u), z = dot(d, s.f);
      const routeEnd = G.route[G.route.length - 1];
      let left = len(sub(G.route[0], s.pos));
      for (let i = 1; i < G.route.length; i++) left += len(sub(G.route[i], G.route[i - 1]));
      const vmax = G.navFinal ? 16 : Math.max(20, Math.min(100, left * 0.3));
      const want = new Set();
      if (s.speed > vmax + 3 || (z < 0.3 && s.speed > 30)) want.add('KeyX');
      else {
        if (z < 0.3 && Math.abs(x) < 0.3) want.add('ArrowRight');
        else if (x > 0.015) want.add('ArrowRight'); else if (x < -0.015) want.add('ArrowLeft');
        if (s.speed < vmax - 3 && z > 0.9) want.add('KeyZ');
      }
      if (y > 0.015) want.add('ArrowUp'); else if (y < -0.015) want.add('ArrowDown');
      setKeys(want);
      step();
    }
    setKeys(new Set());
    return { lines, stages, ended: G.state === 'ending' };
  });

  console.log(out.lines.join('\n'));
  console.log('\nstage    trips  fuel left on arrival (min / avg)  losses  tankers');
  for (const [n, s] of Object.entries(out.stages)) {
    const f = s.trips.map(x => x.fuelLeft);
    const min = f.length ? Math.min(...f).toFixed(0) : '-', avg = f.length ? (f.reduce((a, b) => a + b, 0) / f.length).toFixed(0) : '-';
    console.log(`${n} ${s.name.padEnd(7)} ${String(s.trips.length).padStart(5)}  ${(min + '% / ' + avg + '%').padStart(30)}  ${String(s.losses).padStart(6)}  ${String(s.tankers || 0).padStart(7)}`);
  }
  console.log(out.ended ? '\nRESULT: reached the ending' : '\nRESULT: did NOT reach the ending');
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  process.exit(out.ended && !errors.length ? 0 : 1);
})();
