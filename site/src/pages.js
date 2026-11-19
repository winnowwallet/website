(() => {
  const menu=document.querySelector('.site-menu');
  document.addEventListener('click',e=>{if(e.target.closest('a.skip')){const main=document.getElementById('main');main.tabIndex=-1;main.focus({preventScroll:true});}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.open){menu.open=false;menu.querySelector('summary').focus();}});
  document.addEventListener('click',e=>{if(menu?.open&&!menu.contains(e.target))menu.open=false;});
  const here=location.pathname.includes('/blog/')?'blog/index.html':location.pathname.split('/').pop()||'index.html';
  document.querySelectorAll('.menu-panel a').forEach(a=>{if(a.getAttribute('href').replace(/^(\.\.\/)+/,'')===here)a.setAttribute('aria-current','page');});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');observer.unobserve(e.target);}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  const roadmap=document.querySelector('[data-roadmap]');
  if(roadmap){
    const options={path:'A luminous path connects the work. Scroll to follow it, with every milestone available in normal page flow.',chapters:'Large chapter numbers, quiet layouts and deliberately staged type. The clearest editorial direction.',board:'A compact view of the whole picture. Three status cards settle gently into place.'};
    function setOption(name){if(!options[name])name='path';roadmap.dataset.roadmap=name;const description=document.querySelector('.option-description');if(description)description.textContent=options[name];document.querySelectorAll('[data-roadmap-option]').forEach(a=>a.setAttribute('aria-current',String(a.dataset.roadmapOption===name)));schedule();}
    document.querySelectorAll('[data-roadmap-option]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const u=new URL(location);u.searchParams.set('view',a.dataset.roadmapOption);history.pushState({},'',u);setOption(a.dataset.roadmapOption);}));
    addEventListener('popstate',()=>setOption(new URLSearchParams(location.search).get('view')));
    const stage=document.querySelector('.roadmap-stage'),svg=stage.querySelector('svg'),path=stage.querySelector('.draw'),spark=stage.querySelector('circle');let frame=0,geometry='',length=0;
    function measurePath(){
      const {width:w,height:h}=svg.getBoundingClientRect();
      const nodes=[...stage.querySelectorAll('.roadmap-number')].map(el=>({x:el.parentElement.offsetLeft+el.offsetLeft+el.offsetWidth/2,y:el.parentElement.offsetTop+el.offsetTop+el.offsetHeight/2}));
      const layout=getComputedStyle(stage).getPropertyValue('--roadmap-layout').trim();
      const key=`${layout}:${w}:${h}:${JSON.stringify(nodes)}`;
      if(!w||!h||key===geometry)return;
      geometry=key;
      // Use CSS-pixel coordinates so the stroke end and light share one geometry,
      // including narrow mobile layouts. No stretched or non-scaling dash math.
      svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
      let d;
      if(layout==='wide'){
        // Restore the original broad, continuous desktop curve.
        const a=w*.07,b=w*.86;
        d=`M${a} 0 C${a} ${h*.16} ${b} ${h*.18} ${b} ${h*.33} S${a} ${h*.5} ${a} ${h*.66} S${b} ${h*.84} ${b} ${h}`;
      }else{
        // Mobile gets its own narrow rail, following actual wrapped content.
        d=`M${nodes[0].x} ${nodes[0].y}`;
        nodes.slice(1).forEach((b,i)=>{const a=nodes[i],span=b.y-a.y,dir=i%2?-1:1;d+=` C${a.x+4*dir} ${a.y+span*.33} ${b.x-4*dir} ${b.y-span*.33} ${b.x} ${b.y}`;});
      }
      svg.querySelectorAll('path').forEach(el=>el.setAttribute('d',d));
      path.removeAttribute('pathLength');length=path.getTotalLength();
      path.style.strokeDasharray=String(length);
    }
    function paint(){frame=0;if(roadmap.dataset.roadmap!=='path')return;measurePath();if(reduced.matches){path.style.strokeDashoffset=0;spark.style.display='none';return;}const r=stage.getBoundingClientRect();const p=Math.max(0,Math.min(1,(innerHeight*.7-r.top)/(r.height-innerHeight*.25)));path.style.strokeDashoffset=String(length*(1-p));const pt=path.getPointAtLength(length*p);spark.setAttribute('cx',pt.x);spark.setAttribute('cy',pt.y);spark.style.display='';}
    function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
    addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);new ResizeObserver(schedule).observe(stage);reduced.addEventListener('change',schedule);document.fonts?.ready.then(schedule);setOption(new URLSearchParams(location.search).get('view'));
  }
  const output=document.querySelector('.policy-output');
  if(output){const policies={pair:['Both devices are required.','Your phone and hardware each sign, with both keys required for a transfer. Back up each key and choose a separate recovery rule if you want an additional path.',['Your phone|Your hardware']],shared:['Any two members can approve.','You + trustee, you + provider, or trustee + provider. Any of these pairs can approve under the normal rule; the trustee and provider can approve together without your signature.',['You|Trustee','You|Provider','Trustee|Provider']],delay:['A separate path, after the delay.','The recovery keys and threshold are chosen in advance. Time is measured from each coin’s confirmation. Adding this path does not restrict the normal spending rule.',['Chosen recovery keys|Time condition']]};
  document.querySelectorAll('[data-policy]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-policy]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const [h,p,pairs]=policies[b.dataset.policy];output.replaceChildren();const title=document.createElement('h3');title.textContent=h;const copy=document.createElement('p');copy.textContent=p;output.append(title,copy);pairs.forEach(pair=>{const el=document.createElement('div');el.className='approval-pair';pair.split('|').forEach((s,i)=>{if(i){const plus=document.createElement('i');plus.textContent='+';el.append(plus);}el.append(document.createTextNode(s));});output.append(el);});}));}
})();
