/* Original reference-based meshes and procedural materials. No manufacturer assets. */
window.WinnowHardware = (() => {
  let loading;
  // Millimetres, matching the existing 70.6 / 146.6 iPhone 15 Pro casing.
  // Published size references are recorded in custody-16/device-dimensions.json.
  const dimensions={phone:{width:70.6,height:146.6,depth:8.25},ledger:{width:18.6,height:72,depth:11.7},shield:{width:40,height:65.9,depth:8},hex:{width:60,height:66,depth:13.6}};
  function load(){
    if(window.THREE)return Promise.resolve(window.THREE);
    return loading ||= new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const finish=error=>{
        clearTimeout(timeout);script.onload=script.onerror=null;
        if(error){script.remove();reject(error);}else resolve(window.THREE);
      };
      const timeout=setTimeout(()=>finish(new Error('Hardware library timed out.')),12000);
      script.src='assets/vendor/three-0.160.1.min.js';
      script.onload=()=>finish(window.THREE?null:new Error('Hardware library unavailable.'));
      script.onerror=()=>finish(new Error('Hardware library could not load.'));
      document.head.appendChild(script);
    }).catch(error=>{loading=null;throw error;});
  }
  function models(T){
    // A repeatable micrograin, generated once. The long grain follows the cover.
    const grainCanvas=document.createElement('canvas');grainCanvas.width=256;grainCanvas.height=128;
    const ctx=grainCanvas.getContext('2d'),pixels=ctx.createImageData(256,128);let seed=27;
    const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<128;y++){const line=214+noise()*8;for(let x=0;x<256;x++){const v=line+noise()*3,i=(y*256+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}}
    ctx.putImageData(pixels,0,0);const grain=new T.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(.08,.09);
    const materials={
      body:new T.MeshPhysicalMaterial({color:0x171c20,metalness:.28,roughness:.31,clearcoat:.3,clearcoatRoughness:.25,envMapIntensity:.35}),
      metal:new T.MeshPhysicalMaterial({color:0xe2e5e8,metalness:1,roughness:.30,roughnessMap:grain,envMapIntensity:.85}),
      edge:new T.MeshStandardMaterial({color:0x7f8b95,metalness:.95,roughness:.19}),
      polish:new T.MeshStandardMaterial({color:0xd5dce2,metalness:1,roughness:.12}),
      glass:new T.MeshPhysicalMaterial({color:0x060c10,metalness:.15,roughness:.09,clearcoat:1,clearcoatRoughness:.055,envMapIntensity:.16}),
      seam:new T.MeshStandardMaterial({color:0x05090c,roughness:.66}),
      sensor:new T.MeshStandardMaterial({color:0x252b31,metalness:.45,roughness:.38})
    };
    function outline(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
    // Smooth the shared bevel vertices without introducing a separate hairline mesh.
    // Angle weighting keeps triangulated flat faces flat and curved rims continuous.
    function smoothBevel(geo){
      const p=geo.attributes.position,n=geo.attributes.normal,sums=new Map(),keys=[];
      const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3();
      for(let i=0;i<p.count;i++)keys[i]=`${Math.round(p.getX(i)*1e4)},${Math.round(p.getY(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`;
      for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
        const k=i+j;a.fromBufferAttribute(p,k);b.fromBufferAttribute(p,i+(j+1)%3);c.fromBufferAttribute(p,i+(j+2)%3);
        u.subVectors(b,a).normalize();v.subVectors(c,a).normalize();const weight=Math.acos(Math.max(-1,Math.min(1,u.dot(v))));
        const sum=sums.get(keys[k])||new T.Vector3();sum.x+=n.getX(k)*weight;sum.y+=n.getY(k)*weight;sum.z+=n.getZ(k)*weight;sums.set(keys[k],sum);
      }
      for(const sum of sums.values())sum.normalize();
      for(let i=0;i<p.count;i++){const sum=sums.get(keys[i]);n.setXYZ(i,sum.x,sum.y,sum.z);}n.needsUpdate=true;
    }
    function plate(shape,depth,bevel,material){const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:8,steps:1,curveSegments:18});geo.translate(0,0,-depth/2);smoothBevel(geo);const mesh=new T.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;return mesh;}
    function rounded(w,h,d,r,material){return plate(outline(w,h,r),d,Math.min(.25,d*.2),material);}
    function cyl(r,h,mat){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,48),mat);m.rotation.x=Math.PI/2;m.castShadow=m.receiveShadow=true;return m;}
    function ring(r,t,mat){const m=new T.Mesh(new T.TorusGeometry(r,t,8,64),mat);m.castShadow=m.receiveShadow=true;return m;}
    function part(parent,mesh,x,y,z){mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
    const ledger=new T.Group();ledger.name='Unbranded pivot-cover hardware study';
    const chassis=rounded(8.6,40,3.2,1.4,materials.body);ledger.add(chassis);
    part(ledger,rounded(8.45,39.7,.12,1.4,materials.seam),0,0,-.6);
    part(ledger,rounded(6.65,15.6,.15,.5,materials.seam),0,2,1.84);
    part(ledger,rounded(6.2,15,.14,.35,materials.glass),0,2,1.97);
    part(ledger,cyl(1.65,.25,materials.body),0,15,1.95);
    part(ledger,ring(1.71,.07,materials.edge),0,15,1.96);
    const hinge=new T.Group();hinge.position.set(0,-16,0);hinge.name='Pivoting metal cover';
    const face=rounded(9.2,39,.6,2,materials.metal);face.position.set(0,15.2,2.25);hinge.add(face);
    const back=face.clone();back.position.z=-2.25;hinge.add(back);
    // Seat the bridge under the two cover faces instead of intersecting their rims.
    const edge=rounded(.55,34,3.6,.2,materials.metal);edge.position.set(-4.4,15.2,0);hinge.add(edge);
    const pin=cyl(2.05,5.8,materials.metal);pin.position.set(0,0,0);hinge.add(pin);
    const inset=cyl(1.74,.12,materials.edge);inset.position.z=2.96;hinge.add(inset);
    const cap=cyl(1.65,.15,materials.metal);cap.position.z=3.05;hinge.add(cap);
    part(hinge,ring(1.84,.065,materials.polish),0,0,3.08);
    // The actual rounded bevel catches the light; no overlapping decorative strip.
    hinge.rotation.z=.82;ledger.add(hinge);
    // Small recessed connector at the end; black geometry, no label.
    const port=rounded(4.8,1.5,.1,.7,materials.seam);port.rotation.x=Math.PI/2;port.position.set(0,-20.23,0);ledger.add(port);
    const tongue=rounded(3.7,.35,.12,.12,materials.edge);tongue.rotation.x=Math.PI/2;tongue.position.set(0,-20.3,0);ledger.add(tongue);
    ledger.hinge=hinge;
    const shield=new T.Group();shield.name='Unbranded touchscreen hardware candidate';
    const shape=new T.Shape();shape.moveTo(-7.5,15);shape.quadraticCurveTo(-9,15,-9,13);shape.lineTo(-9,0);shape.quadraticCurveTo(-8,-7,-2,-15);shape.quadraticCurveTo(0,-16,2,-15);shape.quadraticCurveTo(8,-7,9,0);shape.lineTo(9,13);shape.quadraticCurveTo(9,15,7.5,15);shape.closePath();
    shield.add(plate(shape,4,.65,materials.body));
    const belt=plate(shape,.18,.12,materials.edge);belt.scale.set(1.025,1.015,1);belt.position.z=-.55;shield.add(belt);
    const faceShield=plate(shape,.18,.14,materials.body);faceShield.scale.set(.96,.98,1);faceShield.position.z=2.65;shield.add(faceShield);
    part(shield,rounded(15.5,19,.12,1.7,materials.seam),0,4,2.9);
    part(shield,rounded(14.7,18.2,.14,1.55,materials.glass),0,4,3.04);
    part(shield,rounded(.55,4.4,1.4,.22,materials.edge),9.47,6,-.25);
    part(shield,rounded(5,1,.2,.45,materials.seam),0,-12,2.88);
    part(shield,rounded(4.2,.25,.25,.12,materials.edge),0,-12,3.02);
    const hex=new T.Group();hex.name='Unbranded hexagonal hardware candidate';
    const hs=new T.Shape();for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3,x=12*Math.cos(a),y=12*Math.sin(a);i?hs.lineTo(x,y):hs.moveTo(x,y);}hs.closePath();hex.add(plate(hs,3.6,.8,materials.body));
    const hexBelt=plate(hs,.15,.16,materials.edge);hexBelt.scale.setScalar(1.035);hexBelt.position.z=-.65;hex.add(hexBelt);
    const hexFace=plate(hs,.16,.25,materials.body);hexFace.scale.set(.96,.96,1);hexFace.position.z=2.57;hex.add(hexFace);
    part(hex,cyl(3.3,.12,materials.seam),0,0,2.88);
    part(hex,cyl(2.9,.12,materials.sensor),0,0,2.96);
    part(hex,ring(3.12,.09,materials.edge),0,0,2.99);
    part(hex,rounded(1.1,.25,.12,.1,materials.polish),0,6.8,2.93);
    const hexPort=rounded(4.4,1.25,.1,.5,materials.seam);hexPort.rotation.x=Math.PI/2;hexPort.position.set(0,-10.95,0);hex.add(hexPort);
    // Calibrate closed geometry once; every scene then uses one pixels/mm scale.
    // A calibration group preserves the part hierarchy and the movable cover.
    for(const [name,model] of Object.entries({ledger,shield,hex})){
      if(model.hinge)model.hinge.rotation.z=0;
      model.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),d=dimensions[name];
      const factor=new T.Vector3(d.width/size.x,d.height/size.y,d.depth/size.z);
      // The inner hierarchy preserves local axes of cylindrical parts and ports.
      const calibrated=new T.Group();calibrated.name='Millimetre calibration';
      while(model.children.length)calibrated.add(model.children[0]);
      calibrated.scale.copy(factor);calibrated.position.copy(center).multiply(factor).negate();model.add(calibrated);
      model.userData.dimensionsMm=d;
      const copies=new Map();
      model.traverse(o=>{if(!o.isMesh)return;const original=o.material;if(!copies.has(original)){const copy=original.clone();copies.set(original,copy);materials[name+'_'+copies.size]=copy;}o.material=copies.get(original);});
      if(model.hinge)model.hinge.rotation.z=.82;
    }
    return {ledger,shield,hex,materials,textures:[grain]};
  }
  async function create(host){
    const T=await load();
    const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
    host.appendChild(renderer.domElement);
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-300,300,400,-400,.1,3000);camera.position.z=1000;
    // One small generated studio environment; no network texture or full-screen effects.
    const room=new T.Scene();room.background=new T.Color(.11,.13,.16);
    for(const [x,y,z,w,h,power] of [[-140,80,210,125,360,2.5],[180,40,150,45,300,1.8],[0,200,90,280,60,2.5],[-80,-120,-100,120,160,.7]]){const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(power,power,power),side:T.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,0,0);room.add(p);}
    const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(room,0,.1,1000);scene.environment=env.texture;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    scene.add(new T.HemisphereLight(0xe8efff,0x353e4a,1.15));const key=new T.DirectionalLight(0xfff9f0,3.5);key.position.set(-220,360,650);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-700,right:700,top:700,bottom:-700,near:1,far:1800});key.shadow.bias=-.0003;key.shadow.normalBias=.6;key.shadow.radius=6;key.shadow.blurSamples=8;scene.add(key);
    const rim=new T.DirectionalLight(0xc8dbff,2.8);rim.position.set(200,80,-150);scene.add(rim);
    const fill=new T.DirectionalLight(0xffffff,.65);fill.position.set(60,-180,350);scene.add(fill);
    const m=models(T);scene.add(m.ledger,m.shield,m.hex);
    const shadowMaterial=new T.ShadowMaterial({color:0x17273d,opacity:.095,depthWrite:false});
    const shadowPlane=new T.Mesh(new T.PlaneGeometry(2000,2000),shadowMaterial);shadowPlane.position.z=-45;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
    // Wide penumbras ground the forms without an expensive screen-space blur pass.
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d'),gradient=sc.createRadialGradient(64,64,4,64,64,62);gradient.addColorStop(0,'rgba(20,35,56,.23)');gradient.addColorStop(.45,'rgba(20,35,56,.12)');gradient.addColorStop(1,'rgba(20,35,56,0)');sc.fillStyle=gradient;sc.fillRect(0,0,128,128);const softTexture=new T.CanvasTexture(shadowCanvas);
    const softShadows=['ledger','shield','hex'].map(()=>{const mesh=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:softTexture,transparent:true,depthWrite:false}));mesh.position.z=-64;scene.add(mesh);return mesh;});
    let width=0,height=0,lost=false,sizeDirty=true;
    const resizeObserver=new ResizeObserver(()=>{sizeDirty=true;});resizeObserver.observe(host);
    function size(){if(!sizeDirty)return width>0&&height>0;sizeDirty=false;const r=host.getBoundingClientRect();if(r.width<=0||r.height<=0){width=height=0;return false;}if(r.width===width&&r.height===height)return true;width=r.width;height=r.height;renderer.setSize(width,height,false);camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();return true;}
    function shadows(){['ledger','shield','hex'].forEach((name,i)=>{const model=m[name],soft=softShadows[i],k=model.scale.x,d=dimensions[name];soft.visible=model.visible;soft.material.opacity=model.userData.revealOpacity??1;soft.position.set(model.position.x+24,model.position.y-32,-64);soft.scale.set(d.width*2*k,d.height*1.45*k,1);soft.rotation.z=model.rotation.z;});}
    function draw(p,time=0){if(lost||!host.isConnected||!size())return;const alpha=p.ha??1;host.style.opacity=String(alpha);host.style.visibility=alpha<.01?'hidden':'visible';if(alpha<.01)return;
      const drift=p.animate?Math.sin(time*Math.PI/12):0;
      const unit=(p.phoneHeight||height*.72)/dimensions.phone.height,mx=p.pointerX||0,my=p.pointerY||0;
      m.ledger.visible=true;m.ledger.position.set((p.hx||0)*width,-(p.hy||0)*height+height*.02,30);m.ledger.scale.setScalar(unit);m.ledger.rotation.set(.13+drift*.035+my*.065,-.38+drift*.12+mx*.10,-(p.hr||0)*Math.PI/180+drift*.025);m.ledger.hinge.rotation.z=p.hc??.78;
      m.shield.visible=m.hex.visible=false;
      host.style.zIndex='4';
      if(typeof p.gallery==='number'){
        const q=p.gallery;
        const ease=(value,start,end)=>{const t=Math.max(0,Math.min(1,(value-start)/(end-start)));return t*t*t*(t*(t*6-15)+10);};
        // One object travels around the phone. Change the detailed mesh only
        // when its face is edge-on, keeping an opaque, continuous silhouette.
        const turn=ease(q,.015,.88),angle=turn*Math.PI*2.5;
        const model=q<.31?m.hex:q<.64?m.shield:m.ledger;
        const seam=Math.min(Math.abs(q-.31),Math.abs(q-.64));
        const edge=1-ease(seam,0,.055),settle=ease(q,.78,1);
        const orbitX=(p.x+.32*Math.sin(angle))*width;
        const orbitY=(.02-p.y+.16*Math.cos(angle))*height;
        const finalX=p.hx*width,finalY=-p.hy*height+height*.02;
        [m.shield,m.hex,m.ledger].forEach(o=>{o.visible=o===model;});
        model.position.set(orbitX+(finalX-orbitX)*settle,orbitY+(finalY-orbitY)*settle,30);
        model.scale.setScalar(unit);
        const facing=-.38+.10*Math.sin(angle)+mx*.10;
        const orbitRX=.13+my*.065+.05*Math.cos(angle),orbitRY=facing+(-Math.PI/2-facing)*edge;
        model.rotation.set(orbitRX+(.13+drift*.035+my*.065-orbitRX)*settle,orbitRY+(-.38+drift*.12+mx*.10-orbitRY)*settle,(-.10+.10*Math.sin(angle))*(1-settle)+(-(p.hr||0)*Math.PI/180+drift*.025)*settle);
        m.ledger.hinge.rotation.z=(p.hc??.78)*ease(q,.82,.99);
        // The back half is genuinely occluded by the CSS phone, rather than
        // becoming translucent over its screen. Layer changes occur at the sides.
        host.style.zIndex=Math.cos(angle)>0&&settle<.5?'2':'4';
      }
      shadows();
      renderer.render(scene,camera);
    }
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;document.body.classList.remove('has-webgl');host.style.visibility='hidden';});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;document.body.classList.add('has-webgl');window.dispatchEvent(new Event('resize'));});
    function inspect(name,rotation=0,cover=.82){sizeDirty=true;if(lost||!host.isConnected||!size())return;['ledger','shield','hex'].forEach(k=>{const o=m[k],d=dimensions[k];o.visible=k===name;o.position.set(0,0,20);o.scale.setScalar(Math.min(width*.60/(k==='ledger'?d.height:d.width),height*.68/d.height));o.rotation.set(.15,rotation,-.12);});m.ledger.hinge.rotation.z=cover;shadows();host.style.opacity='1';host.style.visibility='visible';renderer.render(scene,camera);}
    function exportGLB(name){
      const root=m[name].clone(true);root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(.001);root.updateMatrixWorld(true);
      const parts=[],views=[],accessors=[],meshes=[],nodes=[],mats=[],matMap=new Map();let offset=0;
      const add=(array,type,componentType,target)=>{const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),padded=new Uint8Array(Math.ceil(bytes.length/4)*4);padded.set(bytes);const view=views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target})-1;parts.push(padded);offset+=padded.length;const size=type==='VEC3'?3:type==='VEC2'?2:1;const a={bufferView:view,componentType,count:array.length/size,type};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++) {a.min[i%3]=Math.min(a.min[i%3],array[i]);a.max[i%3]=Math.max(a.max[i%3],array[i]);}}return accessors.push(a)-1;};
      root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,mat=o.material;let mi=matMap.get(mat);if(mi===undefined){mi=mats.length;matMap.set(mat,mi);mats.push({pbrMetallicRoughness:{baseColorFactor:[mat.color.r,mat.color.g,mat.color.b,1],metallicFactor:mat.metalness,roughnessFactor:mat.roughness},doubleSided:false});}const attributes={};for(const [key,semantic] of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']])if(g.attributes[key])attributes[semantic]=add(g.attributes[key].array,key==='uv'?'VEC2':'VEC3',5126,34962);const primitive={attributes,material:mi};if(g.index)primitive.indices=add(g.index.array,'SCALAR',g.index.array instanceof Uint32Array?5125:5123,34963);const mesh=meshes.push({primitives:[primitive]})-1;nodes.push({mesh,matrix:o.matrixWorld.toArray()});});
      const doc={asset:{version:'2.0',generator:'Winnow local reference study'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:mats,accessors,bufferViews:views,buffers:[{byteLength:offset}]};const raw=new TextEncoder().encode(JSON.stringify(doc)),json=new Uint8Array(Math.ceil(raw.length/4)*4);json.fill(32);json.set(raw);const bin=new Uint8Array(offset);let n=0;for(const a of parts){bin.set(a,n);n+=a.length;}const result=new ArrayBuffer(12+8+json.length+8+bin.length),v=new DataView(result);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,result.byteLength,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(result,20,json.length).set(json);v.setUint32(20+json.length,bin.length,true);v.setUint32(24+json.length,0x004e4942,true);new Uint8Array(result,28+json.length).set(bin);return result;
    }
    return {draw,inspect,exportGLB,models:m,renderer,scene,camera,dispose(){resizeObserver.disconnect();scene.traverse(o=>o.geometry?.dispose());Object.values(m.materials).forEach(x=>x.dispose());m.textures.forEach(x=>x.dispose());softShadows.forEach(x=>x.material.dispose());shadowMaterial.dispose();softTexture.dispose();key.shadow.dispose();env.dispose();renderer.dispose();renderer.domElement.remove();},exportJSON(name){return JSON.stringify(m[name].toJSON(),(k,v)=>k==='userData'?{}:v);}};
  }
  return {create,load,models,dimensions};
})();
