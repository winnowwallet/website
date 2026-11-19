(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const body = document.body, chapters = $$('.chapter'), stagePhone = $('.phone-position'), stack = $('.screen-stack');
  const {templates,sources,nativeCaptures} = window.WINNOW_SCREENS;
  if(nativeCaptures){body.dataset.nativeScreens='true';$('.phone').dataset.nativeCapture='true';$('.phone').setAttribute('aria-label','Winnow wallet');}
  function screenInto(phone,name){const el=document.createElement('div');el.className='app-screen active';el.dataset.screen=name;el.innerHTML=templates[name];el.style.opacity='1';el.style.visibility='visible';phone.querySelector('.screen-stack').replaceChildren(el);}
  function prepareStage(){if(stack.children.length)return;Object.entries(templates).forEach(([name,html])=>{const el=document.createElement('div');el.className='app-screen';el.dataset.screen=name;el.innerHTML=html;stack.appendChild(el);});window.WinnowAccent.apply(stack,body.dataset.palette);}
  // The mobile casing stays flat. Build only the screen that is approaching view.
  const frame = $('.phone').cloneNode(true);
  const labels = Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.title]));
  function mobileArt(ch){
    const art=ch.querySelector('.mobile-art');
    if(art.querySelector('.phone'))return;
    const phone=frame.cloneNode(true),name=ch.dataset.screen;
    phone.setAttribute('aria-label',`Winnow: ${labels[name]}`);
    screenInto(phone,name);
    art.appendChild(phone);art.dataset.ready='true';
    if(nativeCaptures)art.dataset.nativePreview='true';
  }
  mobileArt(chapters[0]);
  const artObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){mobileArt(e.target.closest('.chapter'));artObserver.unobserve(e.target);}
  }),{rootMargin:'300px 0px'}):null;
  chapters.slice(1).forEach(ch=>{if(artObserver)artObserver.observe(ch.querySelector('.mobile-art'));else mobileArt(ch);});
  chapters.forEach(ch=>{const f=document.createElement('div');f.className='chapter-frame';while(ch.firstChild)f.appendChild(ch.firstChild);ch.appendChild(f);});
  // An expanded explanation owns its inner scroll; normal chapter scrolling
  // resumes as soon as it is closed.
  chapters.forEach(ch=>ch.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{
    const chapterFrame=ch.querySelector('.chapter-frame');
    chapterFrame.toggleAttribute('data-lenis-prevent',!!ch.querySelector('details[open]'));
    if(!ch.querySelector('details[open]'))chapterFrame.scrollTop=0;
  })));
  const params=new URLSearchParams(location.search), modes=['anchored','type','orbit'];
  body.dataset.review='off';
  let mode=modes.includes(params.get('motion'))?params.get('motion'):'orbit';
  const palettePicker=$('#palette-picker');body.dataset.palette=['cobalt','forest','ember','signal','orange'].includes(params.get('palette'))?params.get('palette'):'signal';if(palettePicker)palettePicker.value=body.dataset.palette;
  body.dataset.field=['studio','dots','oval'].includes(params.get('field'))?params.get('field'):'studio';
  body.dataset.engineering=['universe','champagne','copper','petrol'].includes(params.get('engineering'))?params.get('engineering'):'universe';
  body.dataset.horizon=['arc','none','fade'].includes(params.get('horizon'))?params.get('horizon'):'none';
  let hardware3D=null,hardwareLoading=false,hardwareWanted=false,hardwarePose=null,hardwareClock=0,lastHardwareTime=-1;
  let hardwareAttempts=0,hardwareRetry=null,hardwareLastAttempt=-Infinity;
  const hardwareRetryDelays=[2000,5000];
  async function bootHardware(){
    if(hardware3D||hardwareLoading||hardwareRetry||hardwareAttempts>=3||!hardwareWanted||!running||document.hidden)return;
    hardwareLoading=true;hardwareAttempts++;hardwareLastAttempt=performance.now();
    body.dataset.hardwareState='loading';
    try{
      hardware3D=await window.WinnowHardware.create($('.hardware-scene'));
      body.classList.add('has-webgl');body.dataset.hardwareState='ready';lastY=-1;render();
    }catch(e){
      body.dataset.hardwareState='fallback';
      // A stopped preview server or interrupted download must not poison this tab.
      // Retry twice, then wait for a return to the tab or network connection.
      if(hardwareAttempts<3)hardwareRetry=setTimeout(()=>{hardwareRetry=null;bootHardware();},hardwareRetryDelays[hardwareAttempts-1]);
      else console.warn('Hardware rendering unavailable; static silhouette retained.');
    }finally{hardwareLoading=false;}
  }
  function resumeHardware(){
    if(document.hidden||hardware3D||hardwareLoading||performance.now()-hardwareLastAttempt<10000)return;
    clearTimeout(hardwareRetry);hardwareRetry=null;hardwareAttempts=0;bootHardware();
  }
  let dark=params.get('theme')!=='light', paused=params.get('reduce')==='1';
  let current=-1, lenis=null, running=false, lastY=-1, lastHeight=-1, lastWidth=-1;
  let scenePoints=null,lastWheelAt=-Infinity;
  let entranceBeats=[];
  const pointer={x:0,y:0,targetX:0,targetY:0},finePointer=matchMedia('(hover: hover) and (pointer: fine)');
  function invalidateLayout(){scenePoints=null;lastY=-1;entranceBeats.forEach(beat=>beat.top=null);}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), desktop=matchMedia('(min-width: 901px)');
  let gs=window.gsap;
  let dotField=null;
  const studioLight=window.WinnowStudioLight?.create();
  let universe=null;
  body.dataset.motion=mode;body.dataset.phoneTheme=dark?'dark':'light';
  window.WinnowAccent.apply(document,body.dataset.palette);
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=(value,start=0,end=1)=>{const t=clamp((value-start)/(end-start));return t*t*t*(t*(t*6-15)+10);};
  // Build once per responsive/motion configuration. Direction changes only play
  // or reverse these timelines, so interrupted entrances retain their position.
  function setupEntrances(animated){
    entranceBeats.forEach(beat=>beat.timeline.revert());entranceBeats=[];
    // Paused fromTo timelines can retain their immediate-render values on resize.
    // Clear every animation-owned style, including children, before either layout.
    const targets=$$('.chapter-copy, .chapter-copy > *, .proof-line > span, .engineering-benefit, .signer-module, .signing-bridge, .signing-bridge i, .engineering-context, .engineering-aura, .engineering-horizon, .engineering-top, .evidence article');
    gs?.killTweensOf(targets);
    targets.forEach(el=>['opacity','visibility','filter','transform','translate','rotate','scale','--rule'].forEach(prop=>el.style.removeProperty(prop)));
    if(!animated)return;
    const add=(element,timeline)=>entranceBeats.push({element,timeline,entered:false,top:null});
    chapters.forEach(ch=>{
      const copy=ch.querySelector('.chapter-copy'), find=s=>copy.querySelectorAll(s);
      const timeline=gs.timeline({paused:true});
      if(find('.eyebrow').length)timeline.fromTo(find('.eyebrow'),{opacity:0,y:8},{opacity:1,y:0,duration:.5,ease:'power2.out'},0);
      timeline
        .fromTo(find('h1,h2'),{opacity:0,y:26,filter:'blur(5px)'},{opacity:1,y:0,filter:'blur(0px)',duration:.95,ease:'power3.out'},.08)
        .fromTo(find('.intro'),{opacity:0,y:12},{opacity:1,y:0,duration:.7,ease:'power3.out'},.3)
        .fromTo(find('.supporting,.chapter-note,.recovery-clock-note,details,.technical-link,.cta,.scroll-link'),{opacity:0,y:8},{opacity:1,y:0,duration:.65,stagger:.06,ease:'power3.out'},.4);
      add(ch,timeline);
      if(ch.id==='top'){timeline.progress(1);entranceBeats[entranceBeats.length-1].entered=true;}
    });
    const reveal=$('#engineering'), within=s=>reveal.querySelectorAll(s);
    add(reveal,gs.timeline({paused:true})
      .fromTo(within('.proof-line > span'),{yPercent:108,opacity:.1,filter:'blur(5px)'},{yPercent:0,opacity:1,filter:'blur(0px)',duration:1,stagger:.14,ease:'power3.out'},0)
      .fromTo(within('.engineering-benefit'),{opacity:0,y:14},{opacity:1,y:0,duration:.75,ease:'power3.out'},.3)
      .fromTo(within('.hardware-module'),{opacity:0,x:-55,y:22,rotation:-3},{opacity:1,x:0,y:0,rotation:0,duration:1,ease:'back.out(1.15)'},.43)
      .fromTo(within('.winnow-module'),{opacity:0,x:55,y:22,rotation:3},{opacity:1,x:0,y:0,rotation:0,duration:1,ease:'back.out(1.15)'},.55)
      .fromTo(within('.signing-bridge'),{opacity:0},{opacity:1,duration:.55},.7)
      .fromTo(within('.signing-bridge i'),{scaleX:0},{scaleX:1,duration:.7,ease:'power3.out'},.7)
      .fromTo(within('.engineering-context'),{opacity:0,y:6},{opacity:1,y:0,duration:.6},.85)
      .fromTo(within('.engineering-aura'),{opacity:.2,scale:1.1},{opacity:1,scale:1,duration:1.7,ease:'sine.out'},0)
      .fromTo(within('.engineering-horizon'),{opacity:0,scaleX:.7,y:35},{opacity:1,scaleX:1,y:0,duration:1.45,ease:'power3.out'},.15));
    const evidence=$('#engineering-evidence'), proof=s=>evidence.querySelectorAll(s);
    add(evidence,gs.timeline({paused:true})
      .fromTo(proof('.engineering-top'),{opacity:0,y:26},{opacity:1,y:0,duration:.95,ease:'power3.out'},0)
      .fromTo(proof('.evidence article'),{opacity:0,y:18,'--rule':0},{opacity:1,y:0,'--rule':1,duration:.85,stagger:.14,ease:'power3.out'},.24));
  }
  function entranceMotion(){
    entranceBeats.forEach(beat=>{
      const top=(beat.top??=beat.element.getBoundingClientRect().top+scrollY)-scrollY;
      if(top<innerHeight*.5&&!beat.entered){beat.entered=true;beat.timeline.play();}
      else if(top>innerHeight*.85&&beat.entered){beat.entered=false;beat.timeline.reverse();}
    });
  }
  function controls(){
    $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    const themeButton=$('#theme-toggle');if(themeButton){themeButton.setAttribute('aria-pressed',String(dark));themeButton.textContent=dark?'Light phone':'Dark phone';}
    $$('#motion-toggle, #site-motion-toggle').forEach(button=>{
      button.setAttribute('aria-pressed',String(paused||reduced.matches));
      button.textContent=reduced.matches?'Reduced motion':paused?'Resume motion':'Pause motion';
      button.disabled=reduced.matches;
    });
  }
  function updateUrl(){const u=new URL(location.href);u.searchParams.set('motion',mode);u.searchParams.set('theme',dark?'dark':'light');u.searchParams.set('palette',body.dataset.palette);if(paused)u.searchParams.set('reduce','1');else u.searchParams.delete('reduce');history.replaceState(null,'',u);}
  // Composed resting beats, with a longer reveal for the hardware collection.
  // Coordinates are fractions of the visual column / viewport, so resized layouts keep their balance.
  const poses=[
    {x:0,y:-.01,s:1,rx:5,ry:-24,rz:-6,hx:.26,hy:.03,hr:22,ha:0,ta:0,tx:.23,ts:1.14,pa:0,ma:0,fa:0,pair:0,ra:0},
    {x:.01,y:0,s:1,rx:0,ry:0,rz:0,hx:.26,hy:.03,hr:22,ha:0,ta:0,tx:.23,ts:1.14,pa:0,ma:0,fa:0,pair:0,ra:0},
    {x:.05,y:-.01,s:.97,rx:3,ry:18,rz:4,hx:.26,hy:.03,hr:22,ha:0,ta:0,tx:.23,ts:1.14,pa:0,ma:0,fa:0,pair:0,ra:0},
    {x:.02,y:-.01,s:.98,rx:2,ry:-10,rz:-3,hx:.26,hy:.03,hr:22,ha:0,ta:0,tx:.23,ts:1.14,pa:0,ma:0,fa:0,pair:0,ra:0},
    {x:-.14,y:-.04,s:.94,rx:5,ry:-23,rz:-6,hx:.29,hy:.015,hr:16,ha:1,ta:0,tx:.23,ts:1.14,pa:0,ma:0,fa:0,pair:1,ra:0},
    {x:-.25,y:-.015,s:.76,rx:3,ry:-13,rz:-4,hx:-.075,hy:.13,hr:8,ha:1,ta:1,tx:.24,ts:1.08,pa:0,ma:0,fa:1,pair:0,ra:0},
    {x:-.25,y:-.015,s:.76,rx:3,ry:-13,rz:-4,hx:-.075,hy:.13,hr:8,ha:1,ta:1,tx:.24,ts:1,pa:1,ma:1,fa:0,pair:0,ra:0},
    {x:-.30,y:-.035,s:.62,rx:0,ry:-8,rz:-2,hx:.08,hy:.55,hr:70,ha:0,ta:0,tx:0,ts:1,pa:0,ma:0,fa:0,pair:0,ra:1}
  ].map((pose,index)=>({...pose,ty:index===6?-.10:0,py:.18,ps:1,hc:index===5||index===6?0:.78,oa:index===5||index===6?1:0}));
  function show(index){
    if(index===current)return;current=index;
    const name=chapters[index].dataset.screen;
    body.dataset.beat=chapters[index].id;
    $('#scene-number').textContent=String(index+1).padStart(2,'0');if($('#chapter-picker'))$('#chapter-picker').value=chapters[index].id;
    const caption=$('.scene-caption');
  }
  function centers(){return scenePoints||=(chapters.map(ch=>ch.id==='hardware'&&mode==='orbit'?ch.offsetTop+ch.offsetHeight-innerHeight:ch.offsetTop+ch.offsetHeight/2-innerHeight/2));}
  function readScene(){const points=centers();return points.reduce((best,v,i)=>Math.abs(scrollY-v)<Math.abs(scrollY-points[best])?i:best,0);}
  function render(){
    if(!running)return;
    const y=scrollY,h=innerHeight,w=innerWidth;
    if(y===lastY&&h===lastHeight&&w===lastWidth)return;
    lastY=y;lastHeight=h;lastWidth=w;
    const points=centers();let from=0;while(from<points.length-1&&y>points[from+1])from++;
    const to=Math.min(from+1,points.length-1),distance=points[to]-points[from];
    const raw=distance?clamp((y-points[from])/distance):0;
    // Leave open space for the trustee, shared approvals and recovery. The
    // fade follows scroll in both directions and adds no extra reading hold.
    const fieldPresence=from<4?1:from===4?1-smooth(raw,.06,.46):0;
    dotField?.setPresence(fieldPresence);studioLight?.setPresence(fieldPresence);
    const spatial=mode==='orbit',hardwareEntrance=spatial&&from===3;
    const hardwareStart=chapters[4].offsetTop,hardwareEnd=chapters[4].offsetTop+chapters[4].offsetHeight-h;
    const gallery=hardwareEntrance?clamp((y-hardwareStart)/(hardwareEnd-hardwareStart)):null;
    const phase=clamp((raw-.26)/.48),mix=hardwareEntrance?smooth(y,hardwareStart-h*.65,hardwareStart+h*.08):smooth(phase);
    const index=hardwareEntrance?(y>=hardwareStart-h*.15?4:3):(raw>.5?to:from);show(index);
    const at=i=>mode==='anchored'&&i<5?{...poses[i],x:0,y:0,s:1}:poses[i];
    const a=at(from),b=at(to),pose={};Object.keys(poses[0]).forEach(k=>pose[k]=a[k]+(b[k]-a[k])*mix);
    // One compact orbit changes silhouette on two edge-on turns. The entire
    // composition eases back together, keeping one shared millimetre scale.
    if(hardwareEntrance){
      const framing=mix*(1-smooth(gallery,.76,1));
      for(const [key,value] of Object.entries({x:0,y:-.025,s:.84,rx:3,ry:-14,rz:-4}))pose[key]+=(value-pose[key])*framing;
    }
    // Hold the cover open through the move, then close cleanly as the trustee arrives.
    if(from===4)pose.hc=.78*(1-smooth(phase,.38,.66));
    // Keep each real screen readable for most of the device transition.
    const screenMix=clamp((mix-.38)/.24);
    const weights={},fromScreen=chapters[from].dataset.screen,toScreen=chapters[to].dataset.screen;if(fromScreen===toScreen)weights[fromScreen]=1;else{weights[fromScreen]=1-clamp(screenMix*2);weights[toScreen]=clamp((screenMix-.5)*2);}
    stack.querySelectorAll('.app-screen').forEach(s=>{const alpha=weights[s.dataset.screen]||0;gs.set(s,{autoAlpha:alpha,y:(1-alpha)*5});});
    chapters.forEach(ch=>{const copy=ch.querySelector('.chapter-copy'),r=ch.querySelector('.chapter-frame').getBoundingClientRect(),d=(r.top+r.height*.5-h*.5)/h,fade=clamp((Math.abs(d)-.12)/.65);gs.set(copy,{opacity:1-fade*.85,filter:mode==='type'?`blur(${fade*3}px)`:'none',y:0});});
    const progress=clamp(y/Math.max(1,points[points.length-1])),column=$('.visual-group').offsetWidth;
    gs.set(stagePhone,{xPercent:-50,yPercent:-50,x:pose.x*column,y:pose.y*h,scale:pose.s,rotationX:spatial?pose.rx:0,rotationY:spatial?pose.ry:0,rotation:spatial?pose.rz:0,force3D:true});
    hardwareWanted=to>=4&&from<7;
    if(hardwareWanted)bootHardware();
    const phoneHeight=stagePhone.querySelector('.phone').offsetHeight*pose.s;
    studioLight?.pose(pose,column,h,phoneHeight);
    hardwarePose={...pose,phoneHeight,pointerX:pointer.x,pointerY:pointer.y,gallery,animate:spatial};
    const mm=window.WinnowHardware.dimensions,unit=phoneHeight/mm.phone.height;
    gs.set('.hardware-fallback',{xPercent:-50,yPercent:-50,x:pose.hx*column,y:pose.hy*h,width:mm.ledger.width*unit,height:mm.ledger.height*unit,scale:1,rotation:pose.hr,autoAlpha:hardwarePose.ha});
    gs.set('.hardware-fallback i',{rotation:-pose.hc*180/Math.PI});
    hardware3D?.draw(hardwarePose,hardwareClock);
    lastHardwareTime=hardwareClock;
    gs.set('.trustee-figure',{xPercent:-50,yPercent:-50,x:pose.tx*column,y:pose.ty*h,scale:pose.ts,autoAlpha:pose.ta});
    gs.set('.provider-figure',{xPercent:-50,yPercent:-50,x:column*.24,y:pose.py*h,scale:pose.ps,autoAlpha:pose.pa});
    gs.set('.owner-signature',{xPercent:-50,x:pose.x*column+30*pose.oa,autoAlpha:pose.oa});
    gs.set('.custody-floor',{autoAlpha:pose.oa});
    gs.set('.stage-recovery',{autoAlpha:pose.ra});gs.set('.members',{autoAlpha:pose.ma});gs.set('.pair-note',{autoAlpha:pose.pair});
    gs.set('.orbit-ring',{xPercent:-50,yPercent:-50,rotation:-25+progress*45,scaleX:1,scaleY:.6,opacity:spatial?.6*(1-pose.oa):0});
    gs.set('.field-one',{xPercent:-18*progress,yPercent:-10+15*progress,scale:1+.15*progress});
    gs.set('.field-two',{xPercent:-28*progress,yPercent:-20*progress,scale:1+.15*progress});
    gs.set('.field-three',{xPercent:10*progress,yPercent:25*progress});
    entranceMotion();
  }
  const tick=time=>{if(document.hidden)return;hardwareClock=time;if(lenis)lenis.raf(time*1000);
    const follow=1-Math.exp(-Math.min(gs.ticker.deltaRatio()/60,.05)*8);
    pointer.x+=(pointer.targetX-pointer.x)*follow;pointer.y+=(pointer.targetY-pointer.y)*follow;
    if(hardwarePose){hardwarePose.pointerX=pointer.x;hardwarePose.pointerY=pointer.y;}
    render();
    // Gentle 24-second turns share the scroll clock. Idle 3D is capped at 30 fps.
    dotField?.tick(time,pointer);studioLight?.tick(pointer);universe?.tick(time);
    if(hardware3D&&hardwarePose?.animate&&hardwarePose.ha>.01&&time-lastHardwareTime>=1/30-.001){hardware3D.draw(hardwarePose,time);lastHardwareTime=time;}
  };
  function configure(){
    gs=window.gsap;
    invalidateLayout();
    pointer.x=pointer.y=pointer.targetX=pointer.targetY=0;
    if(running){gs.ticker.remove(tick);lenis?.destroy();lenis=null;running=false;}
    const staticMode=paused||reduced.matches||!desktop.matches||innerHeight<680||window.WinnowMotion.constrained()||!gs||!window.Lenis;
    if(!staticMode){prepareStage();window.WinnowDevice.enhance($('.phone-position > .phone'));dotField??=window.WinnowDotField?.create();universe??=window.WinnowUniverse?.create();}
    if(staticMode&&desktop.matches)chapters.forEach(mobileArt);
    body.classList.toggle('is-static',staticMode);
    // Repaint the chapter label with the new layout, even if its index is unchanged.
    current=-1;
    dotField?.configure(desktop.matches&&!staticMode);
    studioLight?.configure(desktop.matches&&!staticMode);
    universe?.configure(desktop.matches&&!staticMode);
    setupEntrances(desktop.matches&&!staticMode);
    if(staticMode||!desktop.matches)gs?.set('.chapter-copy',{clearProps:'opacity,filter,transform'});
    if(desktop.matches&&!staticMode){
      running=true;lenis=new window.Lenis({duration:1.05,smoothWheel:true,syncTouch:false});
      lastY=-1;lastHeight=-1;lastWidth=-1;gs.ticker.lagSmoothing(0);gs.ticker.add(tick);gs.ticker.wake();render();
    }else{if(gs){gs.killTweensOf('.app-screen,.hardware,.members,.pair-note');gs.ticker.sleep();}show(readScene());}
    controls();
    if(!gs&&!paused&&!reduced.matches&&desktop.matches&&innerHeight>=680)window.WinnowMotion.load().then(ok=>{if(ok)configure();});
  }
  function chapterTarget(el){const offset=running?(el.id==='hardware'&&mode==='orbit'?0:(el.offsetHeight-innerHeight)/2):-80;return el===chapters[0]?0:el.getBoundingClientRect().top+scrollY+offset;}
  function jump(el){const target=chapterTarget(el);if(lenis)lenis.scrollTo(target,{immediate:true});else window.scrollTo({top:target,behavior:'instant'});lastY=-1;render();if(!running)show(chapters.indexOf(el));}
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{const old=chapters[Math.max(0,current)];mode=b.dataset.mode;body.dataset.motion=mode;invalidateLayout();controls();updateUrl();jump(old);}));
  $('#chapter-picker')?.addEventListener('change',e=>jump(document.getElementById(e.target.value)));
  palettePicker?.addEventListener('change',()=>{body.dataset.palette=palettePicker.value;window.WinnowAccent.apply(document,body.dataset.palette);dotField?.refresh();updateUrl();});
  // Use the same breakpoint decision for width and height. A live drag can cross
  // both in one frame; rebuild the animation state only once after layout settles.
  let viewportMode=desktop.matches&&innerHeight>=680,resizeFrame=0;
  function resizeLayout(){
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      const nextMode=desktop.matches&&innerHeight>=680;
      if(nextMode!==viewportMode){
        viewportMode=nextMode;
        chapters.forEach(ch=>{ch.querySelector('.chapter-frame').scrollTop=0;});
        configure();
      }else{invalidateLayout();lenis?.resize();render();}
    });
  }
  window.addEventListener('resize',resizeLayout);
  window.addEventListener('pointermove',e=>{
    if(!running||mode!=='orbit'||!finePointer.matches||e.pointerType!=='mouse')return;
    const r=$('.visual-group').getBoundingClientRect();
    const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
    pointer.targetX=inside?clamp((e.clientX-r.left)/r.width)*2-1:0;
    pointer.targetY=inside?clamp((e.clientY-r.top)/r.height)*2-1:0;
  },{passive:true});
  const releasePointer=()=>{pointer.targetX=pointer.targetY=0;};
  document.addEventListener('pointerleave',releasePointer);window.addEventListener('blur',releasePointer);
  window.addEventListener('online',resumeHardware);window.addEventListener('focus',resumeHardware);
  document.addEventListener('visibilitychange',resumeHardware);
  window.addEventListener('wheel',()=>{lastWheelAt=performance.now();},{passive:true});
  document.fonts.ready.then(()=>{invalidateLayout();render();});
  $('#theme-toggle')?.addEventListener('click',()=>{dark=!dark;body.dataset.phoneTheme=dark?'dark':'light';controls();updateUrl();});
  $('#motion-toggle')?.addEventListener('click',()=>{const old=chapters[Math.max(0,current)];paused=!paused;configure();updateUrl();jump(old);});
  $('#site-motion-toggle').addEventListener('click',()=>{
    const bottom=document.documentElement.scrollHeight-innerHeight-scrollY;
    paused=!paused;configure();updateUrl();
    const top=Math.max(0,document.documentElement.scrollHeight-innerHeight-bottom);
    if(lenis)lenis.scrollTo(top,{immediate:true});else window.scrollTo({top,behavior:'instant'});
  });
  document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const target=document.getElementById(a.getAttribute('href').slice(1));if(!target)return;e.preventDefault();const top=target.classList.contains('chapter')?chapterTarget(target):target.getBoundingClientRect().top+scrollY+(target.classList.contains('engineering')?(running?(target.offsetHeight-innerHeight)/2:0):-80);if(lenis)lenis.scrollTo(top,{duration:1.1});else target.scrollIntoView({behavior:'auto'});history.replaceState(null,'',a.getAttribute('href'));});
  window.addEventListener('scroll',()=>{if(!running)show(readScene());},{passive:true});
  reduced.addEventListener('change',configure);desktop.addEventListener('change',resizeLayout);
  navigator.connection?.addEventListener('change',configure);
  window.addEventListener('pagehide',()=>{clearTimeout(hardwareRetry);hardwareRetry=null;if(running)gs.ticker.remove(tick);lenis?.destroy();});
  window.addEventListener('pageshow',e=>{if(e.persisted){configure();resumeHardware();}});
  show(0);configure();
  // Resolve deep links after native fragment scrolling and font layout have finished.
  const initialHash=location.hash;
  const loaded=new Promise(resolve=>document.readyState==='complete'?resolve():window.addEventListener('load',resolve,{once:true}));
  // Desktop enhancement changes chapter heights; resolve anchors after it settles.
  const initialMotion=initialHash&&!paused&&!reduced.matches&&desktop.matches&&innerHeight>=680?window.WinnowMotion.load():Promise.resolve(false);
  Promise.all([loaded,document.fonts.ready,initialMotion]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    invalidateLayout();
    if(!initialHash||Number.isFinite(lastWheelAt))return;
    const target=document.getElementById(initialHash.slice(1));
    if(target?.classList.contains('chapter'))jump(target);
    else if(target){const top=target.getBoundingClientRect().top+scrollY;if(lenis){lenis.resize();lenis.scrollTo(top,{immediate:true});}else window.scrollTo({top,behavior:'instant'});render();}
  })));
})();
