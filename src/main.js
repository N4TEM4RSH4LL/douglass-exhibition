import './style.css';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const icons={home:'<path d="M3 10 12 3l9 7M6 9v12h12V9M10 21v-8h4v8M2 23h20"/>',sound:'<path d="M11 5 6 9H3v6h3l5 4ZM15 9q4 3 0 6M18 6q7 6 0 12"/>',mute:'<path d="M11 5 6 9H3v6h3l5 4ZM16 9l6 6m0-6-6 6"/>',quality:'<path d="m12 3 9 5v8l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v8M7 5.8 17 11"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',previous:'<path d="m14 6-6 6 6 6"/>',next:'<path d="m10 6 6 6-6 6"/>',tour:'<path d="m8 4 12 8-12 8Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',walk:'<circle cx="13" cy="4" r="2"/><path d="m11 8 4 1 3 5M11 8l-3 5-4 1m8-5-1 7-4 6m4-6 5 2 2 4"/>',overview:'<path d="m12 3 10 6-10 6L2 9ZM3 13l9 6 9-6M3 17l9 6 9-6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',door:'<path d="M4 21V3h13v18M8 21V7l7-2v16M11 13v2M2 21h20"/>',arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;
for(const k of ['home','quality','fullscreen','previous','next','tour','walk','overview'])$('#'+k).innerHTML=svg(k);
$('#sound').innerHTML=svg('mute');$('#close-artifact').innerHTML=svg('close');$('.entry-icon').innerHTML=svg('door');$('.entry-arrow').innerHTML=svg('arrow');
const roman=['','I','II','III','IV','V'];
for(let i=1;i<=5;i++){const b=document.createElement('button');b.textContent=roman[i];b.dataset.room=i;b.setAttribute('aria-label',`Enter exhibition room ${i}`);b.title=`Room ${roman[i]}`;$('#room-buttons').append(b);}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch=matchMedia('(pointer: coarse)').matches;
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){$('#loading').remove();$('#error').hidden=false;throw error;}
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,touch?1.3:1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.outputColorSpace=THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#b6c3b7');scene.fog=new THREE.FogExp2('#b7bca3',.002);
const camera=new THREE.PerspectiveCamera(innerWidth<700?65:51,innerWidth/innerHeight,.08,420);camera.position.set(26,12,47);
const target=new THREE.Vector3(0,2,-2);camera.lookAt(target);
const sky=new Sky();sky.scale.setScalar(450);scene.add(sky);const su=sky.material.uniforms;su.turbidity.value=3.2;su.rayleigh.value=2.5;su.mieCoefficient.value=.006;su.mieDirectionalG.value=.84;
const sunVector=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(74),THREE.MathUtils.degToRad(120));su.sunPosition.value.copy(sunVector);
const hemi=new THREE.HemisphereLight('#c3dacd','#5c5037',1.55);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffdfaa',2.8);sun.position.set(-36,27,19);sun.target.position.set(0,0,-4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-44;sun.shadow.camera.right=44;sun.shadow.camera.top=44;sun.shadow.camera.bottom=-44;sun.shadow.camera.near=1;sun.shadow.camera.far=120;sun.shadow.bias=-.00035;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
const ambient=new THREE.AmbientLight('#b9cfc1',.3);scene.add(ambient);
const envScene=new THREE.Scene();envScene.add(sky.clone());const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.06,.1,500).texture;scene.environmentIntensity=.3;pmrem.dispose();
const world=createWorld(scene);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.19,.65,2.2);composer.addPass(bloom);composer.addPass(new OutputPass());
let lowQuality=touch,room=0,walking=false,overview=false,touring=false,tourTime=0,transition=null,time=0,drag=null,dragged=false,orbitYaw=0,orbitPitch=0,focus=null;
let interior=false,insideLight=0,frameTimes=[],lastPerformance=performance.now(),autoQuality=false;
const views={
 0:{p:[26,12,47],t:[0,2,-2]},
 1:{p:[-3.15,2.3,6.7],t:[-7,1.85,6.2]},
 2:{p:[3.05,2.5,6.8],t:[7.3,1.65,6.4]},
 3:{p:[3.15,2.4,-3.6],t:[7.1,2.03,-5.1]},
 4:{p:[-3.15,2.4,-3.6],t:[-7.1,1.9,-5.5]},
 5:{p:[0,2.5,-12.2],t:[0,2.1,-17.1]},
 overview:{p:[27,35,34],t:[0,.6,-4]}
};
const vec=a=>new THREE.Vector3(...a);
const yawPitch=new THREE.Euler(0,0,0,'YXZ');
function setCamera(pos,look){camera.position.copy(pos);camera.lookAt(look);target.copy(look);}
function fly(points,duration=3.5,onDone=null){
 const start={p:camera.position.clone(),t:target.clone()};const list=[start,...points.map(v=>({p:vec(v.p),t:vec(v.t)}))];transition={points:list,duration:reduced?.02:duration,elapsed:0,started:performance.now(),onDone};orbitYaw=orbitPitch=0;
}
function stopTour(){touring=false;$('#tour').setAttribute('aria-pressed','false');$('#tour').setAttribute('aria-label','Start guided tour');$('#tour').innerHTML=svg('tour');}
function closeArtifact(){if($('#artifact-panel').open)$('#artifact-panel').close();if(focus){focus=null;fly([views[room]],1.2);}}
function updateUI(){
 $('#entry').hidden=room!==0||overview;$('#arrival span').textContent=roman[room]||'';
 $$('#room-buttons button').forEach(b=>{const active=Number(b.dataset.room)===room;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'step':'false');});
 $$('#plan rect').forEach(r=>r.classList.toggle('active',Number(r.dataset.room)===room));
 document.body.classList.toggle('walking',walking);$('#walk').setAttribute('aria-pressed',String(walking));$('#overview').setAttribute('aria-pressed',String(overview));
 $('#artifact-panel').open&&$('#artifact-panel').close();focus=null;
}
function navigate(next,{auto=false}={}){
 if(!auto)stopTour();if(document.pointerLockElement)document.exitPointerLock();walking=false;overview=false;
 const before=room;room=Math.min(5,Math.max(0,next));updateUI();
 const points=[];
 if(room===0){world.roof.visible=true;if(before>0)points.push({p:[0,2.13,before===5?-12:before<3?6.5:-3.6],t:[0,2,14]});points.push({p:[0,2.1,18.8],t:[0,2,9]},views[0]);fly(points,4.5);return;}
 world.roof.visible=true;renderer.shadowMap.needsUpdate=true;
 if(before===0){points.push({p:[0,2.4,24],t:[0,2.2,9]},{p:[0,2.15,12],t:[0,2.2,0]});}
 else{const hallwayZ=before===5?-12:before<3?6.5:-3.6;points.push({p:[0,2.13,hallwayZ],t:[0,2,-8]});}
 if(room===5)points.push({p:[0,2.13,-9],t:[0,2,-17]});else{const hz=room<3?6.5:-3.6;points.push({p:[0,2.13,hz],t:[room===1||room===4?-7:7,2,hz]});}
 points.push(views[room]);fly(points,before===0?6:3.2);
}
function openArtifact(h){if(transition||walking||overview)return;stopTour();focus=h;const outward=camera.position.clone().sub(h.position);outward.y=0;outward.normalize();const pos=h.position.clone().addScaledVector(outward,h.type==='analysis'?2.7:2.6);pos.y=Math.max(1.95,h.position.y+.3);const look=h.position.clone();look.x+=.45;fly([{p:pos.toArray(),t:look.toArray()}],1.3);$('.blank-number').textContent=roman[room];$('#artifact-panel').show();}
const hotspotElements=world.hotspots.map(h=>{const b=document.createElement('button');b.className='hotspot';b.hidden=true;b.dataset.slot=h.id;b.setAttribute('aria-label',`Inspect ${h.type==='analysis'?'blank analysis panel':'symbolic exhibit'} ${h.id}`);b.title=h.type==='analysis'?'Analysis space':'Inspect exhibit';b.addEventListener('click',()=>openArtifact(h));$('#hotspots').append(b);return {h,b};});
$('#enter').onclick=()=>navigate(1);$('#home').onclick=()=>navigate(0);$('#next').onclick=()=>navigate(room===5?0:room+1);$('#previous').onclick=()=>navigate(Math.max(0,room-1));
$$('#room-buttons button').forEach(b=>b.onclick=()=>navigate(Number(b.dataset.room)));
$$('#plan rect').forEach(b=>b.onclick=()=>navigate(Number(b.dataset.room)));
$('#close-artifact').onclick=closeArtifact;
$('#tour').onclick=()=>{if(touring){stopTour();return;}touring=true;tourTime=0;$('#tour').setAttribute('aria-pressed','true');$('#tour').setAttribute('aria-label','Pause guided tour');$('#tour').innerHTML=svg('pause');if(room===0||room===5)navigate(1,{auto:true});};
$('#overview').onclick=()=>{stopTour();walking=false;overview=!overview;world.roof.visible=!overview;renderer.shadowMap.needsUpdate=true;updateUI();fly([overview?views.overview:views[room]],2.5);};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
function quality(){renderer.setPixelRatio(Math.min(devicePixelRatio,lowQuality?1:1.65));composer.setPixelRatio(renderer.getPixelRatio());bloom.enabled=!lowQuality;sun.shadow.mapSize.set(lowQuality?1024:2048,lowQuality?1024:2048);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}renderer.shadowMap.needsUpdate=true;$('#quality').setAttribute('aria-pressed',String(lowQuality));$('#quality').setAttribute('aria-label',lowQuality?'Switch to high quality':'Switch to performance mode');}
$('#quality').onclick=()=>{lowQuality=!lowQuality;autoQuality=true;quality();};quality();
function walk(){stopTour();closeArtifact();overview=false;world.roof.visible=true;walking=!walking;transition=null;if(walking){if(room===0)setCamera(vec([0,2.1,22]),vec([0,2.1,12]));else camera.position.y=2.08;target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3));yawPitch.setFromQuaternion(camera.quaternion);if(!touch){renderer.domElement.requestPointerLock?.()?.catch?.(()=>{});}}else if(document.pointerLockElement)document.exitPointerLock();updateUI();}
$('#walk').onclick=walk;
const keys=new Set();
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.code);if(e.code==='Escape'){if(focus)closeArtifact();if(walking){walking=false;updateUI();}if(document.body.classList.contains('ui-hidden'))document.body.classList.remove('ui-hidden');}if(e.code==='KeyH'&&!e.repeat)document.body.classList.toggle('ui-hidden');if(e.code==='KeyF'&&!e.repeat)$('#fullscreen').click();if(e.code==='Space'&&!e.repeat)$('#tour').click();if(/Digit[1-5]/.test(e.code))navigate(Number(e.code.slice(-1)));});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
renderer.domElement.addEventListener('pointerdown',e=>{if(transition)return;drag={x:e.clientX,y:e.clientY};dragged=false;renderer.domElement.setPointerCapture(e.pointerId);});
function lookMove(dx,dy){if(walking){yawPitch.y-=dx*.0028;yawPitch.x=THREE.MathUtils.clamp(yawPitch.x-dy*.0028,-1.25,1.25);camera.quaternion.setFromEuler(yawPitch);target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(4));}else{orbitYaw-=dx*.003;orbitPitch=THREE.MathUtils.clamp(orbitPitch+dy*.003,-.45,.65);}}
window.addEventListener('pointermove',e=>{if(transition)return;if(document.pointerLockElement===renderer.domElement){lookMove(e.movementX,e.movementY);return;}if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)dragged=true;lookMove(dx,dy);drag={x:e.clientX,y:e.clientY};});
window.addEventListener('pointerup',()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();if(walking||transition)return;camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.018,33,70);camera.updateProjectionMatrix();},{passive:false});
const joy={x:0,y:0};let joyActive=false;const joystick=$('#joystick'),knob=$('#joystick div');
function updateJoy(e){const r=joystick.getBoundingClientRect();let x=(e.clientX-r.x-r.width/2)/35,y=(e.clientY-r.y-r.height/2)/35;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joy.x=x;joy.y=y;knob.style.transform=`translate(${x*30}px,${y*30}px)`;}
joystick.addEventListener('pointerdown',e=>{joyActive=true;joystick.setPointerCapture(e.pointerId);updateJoy(e);});joystick.addEventListener('pointermove',e=>{if(joyActive)updateJoy(e);});for(const event of ['pointerup','pointercancel'])joystick.addEventListener(event,()=>{joyActive=false;joy.x=joy.y=0;knob.style.transform='';});
function canMove(x,z){if(Math.abs(x)>105||z>108||z<-72)return false;return !world.colliders.some(c=>x>c.x1&&x<c.x2&&z>c.z1&&z<c.z2);}
// Opt-in procedural ambience, with no network audio, voices or autoplay.
let audioCtx,audioGain,soundOn=false;
async function toggleSound(){
 if(!audioCtx){audioCtx=new AudioContext();audioGain=audioCtx.createGain();audioGain.gain.value=0;audioGain.connect(audioCtx.destination);const length=audioCtx.sampleRate*5;const buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate);const data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=(last+(Math.random()*2-1)*.025)/1.025;data[i]=last*3;}const source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=630;source.connect(filter);filter.connect(audioGain);source.start();for(const freq of [123.47,185,246.94]){const oscillator=audioCtx.createOscillator();const gain=audioCtx.createGain();oscillator.type='sine';oscillator.frequency.value=freq;gain.gain.value=.008;oscillator.connect(gain);gain.connect(audioGain);oscillator.start();}}
 await audioCtx.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn?.3:0,audioCtx.currentTime,1);$('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound').setAttribute('aria-label',soundOn?'Mute ambient sound':'Enable ambient sound');$('#sound').innerHTML=svg(soundOn?'sound':'mute');
}
$('#sound').onclick=()=>toggleSound().catch(()=>{});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();audioCtx?.suspend();}else if(soundOn)audioCtx?.resume();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?65:51;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#error').hidden=false;});
const clock=new THREE.Timer();let frames=0;
function animate(){
 requestAnimationFrame(animate);if(document.hidden){clock.update();return;}clock.update();const dt=Math.min(clock.getDelta(),.055);time+=dt;frames++;
 if(transition){const tr=transition;tr.elapsed=(performance.now()-tr.started)/1000;const total=Math.min(1,tr.elapsed/tr.duration);const segTotal=total*(tr.points.length-1);const index=Math.min(tr.points.length-2,Math.floor(segTotal));let t=segTotal-index;t=t*t*(3-2*t);const a=tr.points[index],b=tr.points[index+1];setCamera(new THREE.Vector3().lerpVectors(a.p,b.p,t),new THREE.Vector3().lerpVectors(a.t,b.t,t));if(total===1){transition=null;tr.onDone?.();}}
 else if(walking){const speed=(keys.has('ShiftLeft')?5.5:3.2)*dt;const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))-joy.y;const s=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+joy.x;const dir=new THREE.Vector3(-Math.sin(yawPitch.y),0,-Math.cos(yawPitch.y));const right=new THREE.Vector3(Math.cos(yawPitch.y),0,-Math.sin(yawPitch.y));const delta=dir.multiplyScalar(f).addScaledVector(right,s);if(delta.lengthSq()>1)delta.normalize();delta.multiplyScalar(speed);const nx=camera.position.x+delta.x,nz=camera.position.z+delta.z;if(canMove(nx,camera.position.z))camera.position.x=nx;if(canMove(camera.position.x,nz))camera.position.z=nz;camera.position.y=2.08+(!reduced&&delta.lengthSq()>0?Math.sin(time*9)*.018:0);target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3));const x=camera.position.x,z=camera.position.z;let rr=room;if(z>14||Math.abs(x)>11.3||z<-21)rr=0;else if(z<-11)rr=5;else if(x<-2)rr=z>1?1:4;else if(x>2)rr=z>1?2:3;if(rr!==room){room=rr;updateUI();}}
 else if(!focus){const v=overview?views.overview:views[room];const base=vec(v.p),look=vec(v.t);let offset=base.sub(look);const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=orbitYaw+(!reduced&&room===0&&!overview?Math.sin(time*.065)*.09:0);spherical.phi=THREE.MathUtils.clamp(spherical.phi+orbitPitch,.2,1.85);offset.setFromSpherical(spherical);if(room>0&&!overview){const p=vec(v.p);const direction=vec(v.t).sub(p);direction.applyAxisAngle(new THREE.Vector3(0,1,0),orbitYaw);direction.y+=orbitPitch*4;setCamera(p,p.clone().add(direction));}else setCamera(look.clone().add(offset),look);if(touring){tourTime+=dt;if(!reduced)orbitYaw=Math.sin(tourTime*.13)*.11;if(tourTime>13){tourTime=0;if(room===5){stopTour();}else navigate(room+1,{auto:true});}}}
 interior=camera.position.z<13.5&&camera.position.z>-21.5&&Math.abs(camera.position.x)<11.4&&camera.position.y<4.9;
 insideLight=THREE.MathUtils.lerp(insideLight,interior?1:0,1-Math.exp(-dt*3));renderer.toneMappingExposure=.98+insideLight*.08;hemi.intensity=1.25-insideLight*.7;scene.fog.density=.002-insideLight*.0015;
 if(!reduced){world.windMaterials.forEach(s=>s.uniforms.uTime.value=time);world.water.position.y=-.09+Math.sin(time*.5)*.018;world.dust.rotation.y=Math.sin(time*.075)*.011;world.flames.forEach((f,i)=>f.scale.y=.8+Math.sin(time*7+i*2)*.22);world.firelight.intensity=6+Math.sin(time*10)*.7;}
 const projected=new THREE.Vector3();hotspotElements.forEach(({h,b})=>{if(h.room!==room||transition||walking||overview||focus){b.hidden=true;return;}projected.copy(h.position).project(camera);const visible=projected.z<1&&projected.z>0&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.85;b.hidden=!visible;if(visible){b.style.left=`${(projected.x*.5+.5)*innerWidth}px`;b.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;}});
 $('#plan-position').setAttribute('cx',String(THREE.MathUtils.clamp((camera.position.x+11)/22*100+6,6,106)));$('#plan-position').setAttribute('cy',String(THREE.MathUtils.clamp((camera.position.z+21)/34*136+6,6,151)));
 composer.render();
 if(frames===3)$('#loading').classList.add('done');if(frames===45)renderer.shadowMap.autoUpdate=false;
 // A sustained low frame rate lowers resolution once; users can always override it.
 if(!autoQuality&&!lowQuality&&frames>120){frameTimes.push(dt);if(frameTimes.length>90)frameTimes.shift();if(frameTimes.length===90&&frameTimes.reduce((a,b)=>a+b,0)/90>.037){lowQuality=true;autoQuality=true;quality();}}
 if(performance.now()-lastPerformance>2000){$('#world').dataset.room=String(room);$('#world').dataset.mode=walking?'walk':overview?'overview':'guided';$('#world').dataset.ready='true';lastPerformance=performance.now();}
}
updateUI();animate();
