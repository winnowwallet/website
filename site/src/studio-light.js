/* Shares the existing scroll/render clock. No canvas, network assets or extra ticker. */
window.WinnowStudioLight = {
  create() {
    if (document.body.dataset.field !== 'studio') return null;
    document.body.dataset.field = 'studio';
    let gs = window.gsap;
    const make = () => {
      const light = document.createElement('div');
      light.className = 'studio-light';
      light.setAttribute('aria-hidden', 'true');
      light.innerHTML = '<i class="studio-bloom"></i><i class="studio-shadow"></i><i class="studio-pearl"></i><i class="studio-reflection"></i>';
      return light;
    };
    const light = make(), mobile = make();
    document.querySelector('.visual-group').prepend(light);
    document.querySelector('#top .mobile-art').prepend(mobile);
    const phone = document.querySelector('.phone-position > .phone');
    let entrance = null, hasEntered = false, active = false, presence = 1;
    let lastPointerX = 0, lastPointerY = 0;
    return {
      configure(animated) {
        gs=window.gsap;
        active = animated;
        entrance?.revert(); entrance = null;
        lastPointerX = lastPointerY = 0;
        gs?.set(light.querySelector('.studio-reflection'), {x:0, y:0});
        if (!animated || !gs) return;
        // One arrival, not a repeated flourish at every chapter or breakpoint.
        if (!hasEntered && scrollY < innerHeight * .5) {
          hasEntered = true;
          entrance = gs.timeline()
            .fromTo(light.querySelector('.studio-pearl'), {scale:.93, y:28, opacity:0}, {scale:1, y:0, opacity:1, duration:1.65, ease:'power3.out'}, .05)
            .fromTo(light.querySelector('.studio-bloom'), {opacity:0}, {opacity:1, duration:1.8, ease:'sine.out'}, .1)
            .fromTo(light.querySelector('.studio-shadow'), {opacity:0, scaleX:.85}, {opacity:1, scaleX:1, duration:1.45, ease:'power2.out'}, .25)
            .fromTo(phone, {y:34, rotationY:7, rotationZ:2}, {y:0, rotationY:0, rotationZ:0, duration:1.6, ease:'power3.out'}, .15);
        }
      },
      setPresence(value) {
        presence = value;
        light.style.opacity = value.toFixed(4);
        light.style.visibility = value > .001 ? 'visible' : 'hidden';
      },
      pose(pose, column, height, phoneHeight) {
        if (!active || !gs) return;
        // The pearl stays behind the product. As hardware joins, the light
        // opens toward it; both objects remain on the same visual stage.
        const pair = pose.pair;
        gs.set(light, {
          width:phoneHeight * (.86 + pair * .12),
          xPercent:-50, yPercent:-50,
          x:pose.x * column * .45 + column * (.08 + pair * .035),
          y:pose.y * height * .3 + height * .065,
          scale:1, force3D:true
        });
      },
      tick(pointer) {
        if (!active || presence < .001 || !gs) return;
        if (Math.abs(pointer.x-lastPointerX) < .001 && Math.abs(pointer.y-lastPointerY) < .001) return;
        lastPointerX=pointer.x; lastPointerY=pointer.y;
        // A small change in reflection, never a light that chases the cursor.
        gs.set(light.querySelector('.studio-reflection'), {x:pointer.x*7, y:pointer.y*5});
      }
    };
  }
};
