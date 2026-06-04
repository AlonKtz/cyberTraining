/* ============================================================================
   CyberTraining — Signature neon orb (particle sphere)
   initOrb(container)
   A dense spherical cloud of glowing green-yellow specks with a bright bloom
   at its core. Slowly rotates; eases/tilts toward the cursor (magnetic pull);
   the whole cloud breathes and drifts in a slow figure-eight when idle.
   Freezes (single static frame) under prefers-reduced-motion. Decorative.
   ========================================================================== */
(function () {
  function initOrb(container) {
    container.classList.add('ct-orb-root');
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = '<canvas class="ct-orb-canvas"></canvas>';
    const canvas = container.querySelector('.ct-orb-canvas');
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let R = 0;

    // ── Build particle sphere (denser toward the centre when projected) ──
    const N = 2200;
    const pts = [];
    for (let i = 0; i < N; i++) {
      // random direction on unit sphere
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dir = [s * Math.cos(theta), s * Math.sin(theta), u];
      // radius: bias toward centre (pow > 1 pulls inward) for a bright core
      const rad = Math.pow(Math.random(), 0.62);
      // colour: greens through yellow-greens, a few warm-yellow embers
      const t = Math.random();
      let col;
      if (t < 0.62) col = [Math.round(120 + t * 90), 255, Math.round(90 + t * 60)];      // neon green
      else if (t < 0.9) col = [210, 255, 120];                                            // yellow-green
      else col = [255, 245, 160];                                                         // warm ember
      pts.push({
        x: dir[0] * rad, y: dir[1] * rad, z: dir[2] * rad,
        r: 0.5 + Math.random() * 1.2,
        col,
        tw: Math.random() * Math.PI * 2,           // twinkle phase
        tws: 0.6 + Math.random() * 1.8,            // twinkle speed
      });
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * 0.30;
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(container);

    // ── State ──
    let rotX = -0.25, rotY = 0;     // current rotation
    let velY = 0.006;               // idle spin — calm
    let targetTiltX = -0.18, targetTiltY = 0;
    let curTiltX = -0.18, curTiltY = 0;
    let driftX = 0, driftY = 0;             // current (eased) offset
    let targetDriftX = 0, targetDriftY = 0; // where the cloud wants to be
    let hovering = false;
    let pulse = 1;
    const persp = 2.6;
    let t0 = performance.now();

    container.addEventListener('pointermove', (e) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      targetTiltY = nx * 0.42;
      targetTiltX = -0.18 + ny * 0.34;
      // gentle travel — stay compact around the header
      targetDriftX = nx * W * 0.10;
      targetDriftY = ny * H * 0.10;
      hovering = true;
      pulse = 1.10;
    });
    container.addEventListener('pointerleave', () => { hovering = false; });

    function project(p) {
      // apply rotation Y then X
      const cy = Math.cos(rotY + curTiltY), sy = Math.sin(rotY + curTiltY);
      const cx = Math.cos(rotX + curTiltX), sx = Math.sin(rotX + curTiltX);
      let x = p.x * cy - p.z * sy;
      let z = p.x * sy + p.z * cy;
      let y = p.y * cx - z * sx;
      z = p.y * sx + z * cx;
      const scale = persp / (persp - z);
      return { sx: x * R * scale, sy: y * R * scale, z, scale };
    }

    function drawBloom(cx, cyy, t) {
      const br = R * (0.42 + 0.05 * Math.sin(t * 1.6)) * pulse;
      const g = ctx.createRadialGradient(cx, cyy, 0, cx, cyy, br);
      g.addColorStop(0, 'rgba(245,255,210,0.95)');
      g.addColorStop(0.12, 'rgba(180,255,140,0.6)');
      g.addColorStop(0.4, 'rgba(60,230,120,0.18)');
      g.addColorStop(1, 'rgba(40,200,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cyy, br, 0, Math.PI * 2); ctx.fill();
    }

    function frame(now) {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      // ease tilt + idle figure-eight + spin + pulse decay
      if (!hovering) {
        targetTiltY = Math.sin(t * 0.7) * 0.18;
        targetTiltX = -0.18 + Math.sin(t * 1.1) * 0.10;
        targetDriftX = Math.sin(t * 0.7) * W * 0.06;
        targetDriftY = Math.sin(t * 1.4) * H * 0.05;
      }
      // slow easing → calm, smooth response (no instant snapping)
      curTiltX += (targetTiltX - curTiltX) * 0.04;
      curTiltY += (targetTiltY - curTiltY) * 0.04;
      driftX += (targetDriftX - driftX) * 0.04;
      driftY += (targetDriftY - driftY) * 0.04;
      rotY += velY;
      pulse += (1 - pulse) * 0.05;

      const cx = W / 2 + driftX, cyy = H / 2 + driftY;

      drawBloom(cx, cyy, t);

      // depth sort not needed with additive blend; draw all
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const pr = project(p);
        const depth = (pr.z + 1) / 2;                 // 0 back .. 1 front
        const tw = 0.6 + 0.4 * Math.sin(t * p.tws + p.tw);
        const a = (0.18 + depth * 0.82) * tw;
        const size = p.r * pr.scale * (0.7 + depth * 0.9);
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${p.col[0]},${p.col[1]},${p.col[2]})`;
        ctx.beginPath();
        ctx.arc(cx + pr.sx, cyy + pr.sy, Math.max(0.3, size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (!reduce) requestAnimationFrame(frame);
    }

    if (reduce) { rotY = 0.3; frame(performance.now()); }
    else requestAnimationFrame(frame);
  }
  window.initOrb = initOrb;
})();
