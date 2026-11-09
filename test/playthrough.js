// Playthrough test: a naive pilot that only follows the on-screen marker plays every stage
// through real key events and the real update loop (simulated clock, no teleporting).
// Usage: node orbit-post/test/playthrough.js [unlocked stages to start with, default 1]
// Needs Playwright with Chromium. Prints each dock, loss and stage clear, then the final state.
const { chromium } = require('playwright');
const START_UNLOCKED = +(process.argv[2] || 1);
const PAGE = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const logs = [];
  p.on('pageerror', e => logs.push('ERR ' + e.message));
  await p.goto(PAGE);
  await p.evaluate(u => { localStorage.clear(); localStorage.setItem('orbitpost.unlocked', String(u)); }, START_UNLOCKED);
  await p.reload(); await p.waitForTimeout(300);
  const result = await p.evaluate(() => {
    const O = OrbitPost, G = O.G;
    const held = new Set();
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    const setKeys = want => {
      for (const c of [...held]) if (!want.has(c)) { key(c, false); held.delete(c); }
      for (const c of want) if (!held.has(c)) { key(c, true); held.add(c); }
    };
    const tap = code => { key(code, true); O.update(1 / 60); key(code, false); O.update(1 / 60); };
    const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
    const mul = (a, s) => a.map(v => v * s), dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const len = a => Math.hypot(...a), norm = a => mul(a, 1 / (len(a) || 1));
    const events = [];
    const log = e => events.push(`[${(frame / 60).toFixed(0)}s] ${O.STAGE.n + 1}:${O.STAGE.name} ${e}`);
    let frame = 0, phase = 'cruise', lastState = '', dumped = false; const trace = [];
    events.push('title shows STAGE ' + (G.sel + 1) + ' ' + O.STAGES[G.sel].name);
    tap('Enter');
    const dangers = () => {
      const S = O.STAGE, out = [];
      for (const bd of S.bodies) if (bd.big) out.push([bd.pos, bd.cr + (bd.fatal ? 700 : 250)]);
      if (S.heat) out.push([S.heat.c, S.heat.r0 + 60]);
      return out.sort((p1, p2) => p2[1] - p1[1]);
    };
    function plan(pos, goal) {
      for (const [c, R] of dangers()) {
        const d = sub(goal, pos), L = len(d), t = Math.max(0, Math.min(1, dot(sub(c, pos), d) / (L * L)));
        if (len(sub(add(pos, mul(d, t)), c)) >= R) continue;
        const u = norm(sub(pos, c)), v = norm(sub(goal, c));
        let tg = sub(v, mul(u, dot(u, v))); if (len(tg) < 1e-3) tg = [-u[2], 0, u[0]]; tg = norm(tg);
        const total = Math.acos(Math.max(-1, Math.min(1, dot(u, v)))), n = Math.max(1, Math.ceil(total / 0.6)), rad = R * 1.3;
        const pts = [];
        for (let i = 1; i < n; i++) { const k = total * i / n; pts.push(add(c, mul(add(mul(u, Math.cos(k)), mul(tg, Math.sin(k))), rad))); }
        pts.push(add(c, mul(v, Math.max(rad, len(sub(goal, c))))));
        return [...pts, goal];
      }
      return [goal];
    }
    let route = [];
    function waypoint(pos, goal) {
      for (const [c, R] of dangers()) {
        const d = sub(goal, pos), L = len(d), t = Math.max(0, Math.min(1, dot(sub(c, pos), d) / (L * L)));
        const closest = add(pos, mul(d, t));
        if (len(sub(closest, c)) < R && len(sub(goal, c)) > R * 0.9) {
          const u = norm(sub(pos, c)), v = norm(sub(goal, c));
          let tg = sub(v, mul(u, dot(u, v)));
          if (len(tg) < 1e-3) tg = [-u[2], 0, u[0]];
          tg = norm(tg);
          const k = 0.7;  // ~40 degrees around the obstacle per step
          return add(c, mul(add(mul(u, Math.cos(k)), mul(tg, Math.sin(k))), Math.max(R * 1.3, len(sub(pos, c)))));
        }
      }
      return goal;
    }
    while (frame < 60 * 60 * 25) {
      frame++;
      const st = G.state;
      if (st !== lastState) { if (st === 'docked' || st === 'lost' || st === 'warp' || st === 'ending') log(st + (st === 'docked' ? ' @' + O.STAGE.ports[G.port].name + ' "' + G.dockEvent.join(' / ') + '" jobs=' + G.stageDone + '/3' : st === 'lost' ? ' ' + G.lostMsg : '')); lastState = st; }
      if (st === 'docked') {
        setKeys(new Set());
        if (G.cleared) { log('cleared, pressing A'); tap('KeyZ'); continue; }
        phase = 'cruise'; tap('KeyZ'); route = null; continue;
      }
      if (st === 'warp' || st === 'lost') { setKeys(new Set()); O.update(1 / 60); continue; }
      if (st === 'ending') break;
      if (st !== 'flight') { O.update(1 / 60); continue; }
      const s = G.ship, P = O.STAGE.ports[G.job.to], o = P.obj;
      if (G.target !== G.job.to) { tap('ShiftLeft'); continue; }
      const goal = G.nav; phase = G.navFinal ? 'final' : 'cruise';
      const d = norm(sub(goal, s.pos)), x = dot(d, s.r), y = dot(d, s.u), z = dot(d, s.f);
      const dist = len(sub(goal, s.pos));
      const vmax = phase === 'final' ? 16 : Math.max(20, Math.min(100, dist * 0.35));
      const want = new Set();
      const brake = s.speed > vmax + 3 || (z < 0.3 && s.speed > 30);
      if (brake) want.add('KeyX');
      else {
        if (z < 0.3 && Math.abs(x) < 0.3) want.add('ArrowRight');
        else if (x > 0.015) want.add('ArrowRight'); else if (x < -0.015) want.add('ArrowLeft');
        if (s.speed < vmax - 3 && z > 0.9) want.add('KeyZ');
      }
      if (y > 0.015) want.add('ArrowUp'); else if (y < -0.015) want.add('ArrowDown');
      setKeys(want);
      const h0 = s.hull;
      O.update(1 / 60);
      if (s.hull < h0 - 0.5) {
        const near = O.STAGE.bodies.map(bd => [bd, len(sub(bd.pos, s.pos)) - bd.cr]).sort((p1, p2) => p1[1] - p2[1])[0];
        trace.push(`t=${(frame/60).toFixed(2)} hull ${h0.toFixed(1)}->${s.hull.toFixed(1)} msg=${G.msg} heat=${G.heat.toFixed(2)} spd=${s.speed.toFixed(0)} sunDist=${len(s.pos).toFixed(0)} nearestBodyGap=${near[1].toFixed(0)}${near[0].big ? '(big)' : ''} route=${G.route ? G.route.length : '-'}`);
        if (trace.length > 25) trace.shift();
      }
      if (G.state === 'lost' && !dumped) { dumped = true; events.push(...trace.map(x => '    ' + x)); }
      if (frame % 36000 === 0 && events.length < 80) log(`${phase} to=${P.name} goalDist=${dist.toFixed(0)} sunDist=${len(s.pos).toFixed(0)} spd=${s.speed.toFixed(0)} hull=${s.hull.toFixed(0)} fuel=${s.fuel.toFixed(0)} x=${x.toFixed(2)} y=${y.toFixed(2)} z=${z.toFixed(2)} keys=${[...want].join('+')}`);
    }
    setKeys(new Set());
    events.push('final state: ' + G.state + '  stage=' + (O.STAGE.n + 1) + ':' + O.STAGE.name + '  title-sel=' + (G.sel + 1) + '  unlocked=' + G.unlocked);
    return events;
  });
  console.log(result.join('\n'));
  console.log('errors', JSON.stringify(logs));
  await b.close();
})();
