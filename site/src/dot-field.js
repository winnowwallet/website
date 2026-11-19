/* Original point-surface study. No Maze assets, extra renderer, or separate clock. */
(() => {
  window.WinnowDotField = {
    create() {
      if (new URLSearchParams(location.search).get('field') !== 'dots') return null;
      const body = document.body;
      body.dataset.field = 'dots';
      const mounts = [document.querySelector('.atmosphere'), document.querySelector('#top .mobile-art')];
      const surfaces = mounts.map((host, index) => {
        const canvas = document.createElement('canvas');
        canvas.className = 'point-surface';
        canvas.setAttribute('aria-hidden', 'true');
        host.prepend(canvas);
        return {canvas, ctx: canvas.getContext('2d'), compact: index === 1, width: 0, height: 0};
      });
      let visible = true, active = false, last = -1, palette = '', presence = 1;
      const colors = {
        cobalt: ['#939db7', '#596a96', '#3e56a1', '#304bc1'],
        forest: ['#9aa9a3', '#617c73', '#3e7465', '#265e4d'],
        ember: ['#b3a398', '#9c7969', '#9d624b', '#9b4c34']
      };
      const observer = new IntersectionObserver(entries => {visible = entries[0].isIntersecting;}, {threshold: 0});
      observer.observe(document.querySelector('.story'));
      const clamp = n => Math.max(0, Math.min(1, n));
      const smooth = n => {const v = clamp(n); return v * v * (3 - 2 * v);};

      // A continuous folded sheet, sampled densely along its surface. Geometry
      // is retained; a slow camera turn reveals the folds without random drift.
      function mesh(compact) {
        const cols = compact ? 126 : 234, rows = compact ? 54 : 98;
        const points = [];
        for (let i = 0; i < cols; i++) {
          const u = i / (cols - 1) * 2 - 1;
          for (let j = 0; j < rows; j++) {
            const v = j / (rows - 1) * 2 - 1;
            const phase = u * 4.1 + v * 1.35;
            const z = Math.sin(phase) * .35 + Math.sin(v * 2.9 - u * .65) * .13;
            const dzdu = Math.cos(phase) * 1.435 - Math.cos(v * 2.9 - u * .65) * .0845;
            const dzdv = Math.cos(phase) * .4725 + Math.cos(v * 2.9 - u * .65) * .377;
            const normal = 1 / Math.hypot(dzdu / 1.38, dzdv / .67, 1);
            const light = clamp((.52 - dzdu * .22 - dzdv * .35) * normal + .3);
            const edge = smooth((1 - Math.abs(u)) / .1) * smooth((1 - Math.abs(v)) / .12);
            if (edge > 0) points.push({x: u * 1.38, y: v * .67, z, light, edge});
          }
        }
        return points;
      }
      surfaces.forEach(surface => {
        surface.points = mesh(surface.compact);
        // Reused drawing buckets avoid thousands of per-frame array objects.
        surface.buckets = Array.from({length: 16}, () => ({xy: new Float32Array(surface.points.length * 2), count: 0}));
      });

      function draw(surface, time, pointer) {
        const {canvas, ctx, compact, points, buckets} = surface;
        if (!ctx) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        if (w !== surface.width || h !== surface.height || dpr !== surface.dpr) {
          canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
          surface.width = w; surface.height = h; surface.dpr = dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        const size = compact ? w * .79 : Math.min(w * .43, h * .79);
        const cx = w * (compact ? .57 : .85), cy = h * (compact ? .43 : .52);
        const px = pointer?.x || 0, py = pointer?.y || 0;
        const ax = .93 + Math.sin(time * .12) * .045 + py * .018;
        const az = -.74 + Math.sin(time * .09) * .028 + px * .012;
        const cosX = Math.cos(ax), sinX = Math.sin(ax), cosZ = Math.cos(az), sinZ = Math.sin(az);
        buckets.forEach(bucket => {bucket.count = 0;});
        for (const point of points) {
          const yy = point.y * cosX - point.z * sinX;
          const zz = point.y * sinX + point.z * cosX;
          const perspective = 1 / (1 - zz * .23);
          const x = cx + (point.x * cosZ - yy * sinZ) * size * perspective + px * 5;
          const y = cy + (point.x * sinZ + yy * cosZ) * size * perspective + py * 4;
          if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
          const quietText = compact ? 1 : smooth((x / w - .43) / .13);
          const quietNav = compact ? 1 : smooth((y - 90) / 150);
          const fade = point.edge * quietText * quietNav;
          if (fade < .025) continue;
          const shade = Math.min(3, Math.floor((point.light * .8 + (zz + .7) * .14) * 4));
          const alpha = Math.min(3, Math.floor(fade * 4));
          const bucket = buckets[shade * 4 + alpha], offset = bucket.count++ * 2;
          bucket.xy[offset] = x; bucket.xy[offset + 1] = y;
        }
        const inks = colors[body.dataset.palette] || colors.cobalt;
        buckets.forEach((bucket, index) => {
          if (!bucket.count) return;
          const shade = Math.floor(index / 4);
          ctx.fillStyle = inks[shade];
          ctx.globalAlpha = (index % 4 + 1) / 4 * (compact ? .62 : .75);
          const radius = (compact ? .48 : .56) + shade * .045;
          ctx.beginPath();
          for (let i = 0; i < bucket.count * 2; i += 2) {
            const x = bucket.xy[i], y = bucket.xy[i + 1];
            ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2);
          }
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
      function refresh() {
        palette = body.dataset.palette; last = -1;
        surfaces.forEach(surface => draw(surface, 5, null));
      }
      const resize = new ResizeObserver(refresh);
      surfaces.forEach(s => resize.observe(s.canvas));
      return {
        configure(animate) {active = animate; refresh();},
        setPresence(value) {
          const next = clamp(value);
          if (next === presence) return;
          const wasHidden = presence === 0;
          presence = next;
          // The shared desktop field leaves with hardware. The mobile field
          // belongs to the hero and naturally leaves with that illustration.
          surfaces[0].canvas.style.opacity = String(presence);
          surfaces[0].canvas.style.visibility = presence > 0 ? 'visible' : 'hidden';
          if (wasHidden && presence > 0) last = -1;
        },
        refresh,
        tick(time, pointer) {
          if (!active || !visible || !presence || document.hidden || time - last < 1/30) return;
          last = time;
          if (palette !== body.dataset.palette) palette = body.dataset.palette;
          draw(surfaces[0], time + 5, pointer);
        }
      };
    }
  };
})();
