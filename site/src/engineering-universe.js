/* Original Winnow adaptation of the Vesalius particle-disk composition.
   Seeded geometry, no network assets; the host owns the animation clock. */
window.WinnowUniverse = {
  create() {
    const RATE = 1 / 30, ORBIT_SPEED = .018, TAU = Math.PI * 2;
    let animated = false, lastTime = null, orbit = 0;
    let seed = 29117;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const dust = Array.from({length:4200}, (_, i) => {
      const r = .52 + Math.pow(random(), 1.7) * .73;
      const angle = i % 5 < 2 ? i % 2 * Math.PI + Math.log(r) * 3.8 + (random() - .5) * .5 : random() * TAU;
      return {r, angle, height:(random() + random() - 1) * .027,
        size:.35 + random() ** 4 * 1.1, alpha:.12 + random() ** 2 * .6};
    });
    const stars = Array.from({length:160}, () => ({x:random(),y:random(),size:.35+random()*.65,alpha:.08+random()*.3}));
    const enabled = () => document.body.dataset.engineering === 'universe' && document.body.dataset.palette === 'signal';
    const scenes = [...document.querySelectorAll('.engineering-frame')].map((frame, i) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'universe-canvas';canvas.setAttribute('aria-hidden','true');frame.prepend(canvas);
      return {frame,canvas,ctx:canvas.getContext('2d'),i,w:0,h:0,dpr:1,visible:false};
    });
    function draw(scene) {
      const {ctx,w,h,canvas,i,dpr} = scene;
      if (!ctx || !w || !h || !enabled()) return;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';
      const small = w < 901, count = small ? 1800 : dust.length;
      for (const star of stars) {
        const x=star.x*w,y=star.y*h;
        // Preserve the quiet reading area; stars live mostly in the margins.
        const edge=Math.min(1,Math.abs(star.x-.5)*2+.12);
        ctx.globalAlpha=star.alpha*edge;ctx.fillRect(x,y,star.size,star.size);
      }
      const scale = Math.max(w * .68, 300), cx=w*(i ? .17 : .5), cy=h*(i ? .98 : .97);
      for(let n=0;n<count;n++) {
        const p=dust[n],angle=p.angle+orbit/Math.pow(p.r,1.5)+i*.7;
        const depth=Math.sin(angle)*p.r, perspective=1/(1+depth*.18);
        const x=cx+Math.cos(angle)*p.r*scale*perspective;
        const y=cy+(depth*.30+p.height)*scale*perspective;
        if(x<0||x>w||y<0||y>h)continue;
        const fade=Math.max(0,Math.min(1,(y/h-.38)*2));
        ctx.globalAlpha=p.alpha*fade*(i ? .55 : .85);
        const size=p.size*perspective;ctx.fillRect(x,y,size,size);
      }
      ctx.globalAlpha=1;
    }
    function measure(scene) {
      const box=scene.frame.getBoundingClientRect();
      if(box.width<1||box.height<1)return;
      scene.w=box.width;scene.h=box.height;scene.dpr=Math.min(devicePixelRatio||1,1.5);
      scene.canvas.width=Math.round(scene.w*scene.dpr);scene.canvas.height=Math.round(scene.h*scene.dpr);
      draw(scene);
    }
    const resize=new ResizeObserver(entries=>entries.forEach(entry=>measure(scenes.find(s=>s.frame===entry.target))));
    const visibility=new IntersectionObserver(entries=>entries.forEach(entry=>{
      const scene=scenes.find(s=>s.frame===entry.target);scene.visible=entry.isIntersecting;
      if(scene.visible)draw(scene);
    }));
    scenes.forEach(scene=>{measure(scene);resize.observe(scene.frame);visibility.observe(scene.frame);});
    return {
      configure(value) {animated=value;lastTime=null;scenes.forEach(draw);},
      refresh() {lastTime=null;scenes.forEach(draw);},
      tick(time) {
        if(!animated||document.hidden||!enabled()||!scenes.some(s=>s.visible)){lastTime=null;return;}
        if(lastTime===null){lastTime=time;return;}
        if(time-lastTime<RATE)return;
        orbit+=Math.min(time-lastTime,.06)*ORBIT_SPEED;lastTime=time;
        scenes.forEach(scene=>{if(scene.visible)draw(scene);});
      },
      destroy() {resize.disconnect();visibility.disconnect();scenes.forEach(s=>s.canvas.remove());}
    };
  }
};
