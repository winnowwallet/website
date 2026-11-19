/* Progressive enhancement: readable HTML first; optional desktop motion later. */
window.WinnowMotion = (() => {
  let pending=null,failed=false;
  const constrained=()=>{const c=navigator.connection;return !!(c?.saveData||/^(slow-2g|2g|3g)$/.test(c?.effectiveType||'')||(c?.downlink>0&&c.downlink<1.5)||(navigator.deviceMemory&&navigator.deviceMemory<=2));};
  const eligible=()=>matchMedia('(min-width:901px) and (min-height:680px) and (prefers-reduced-motion:no-preference)').matches&&!constrained();
  const script=src=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.async=true;el.onload=resolve;el.onerror=()=>{el.remove();reject(new Error('Optional motion unavailable'));};document.head.append(el);});
  return {constrained,load(){
    if(!eligible()||failed)return Promise.resolve(false);
    if(window.gsap&&window.Lenis)return Promise.resolve(true);
    if(pending)return pending;
    pending=new Promise(resolve=>{
      const start=()=>{if(!eligible()){pending=null;resolve(false);return;}
        Promise.all([script('assets/vendor/gsap-3.12.5.min.js'),script('assets/vendor/lenis-1.1.20.min.js')])
          .then(()=>resolve(true)).catch(()=>{failed=true;resolve(false);});};
      if('requestIdleCallback' in window)requestIdleCallback(start,{timeout:1600});else setTimeout(start,0);
    });return pending;
  }};
})();
