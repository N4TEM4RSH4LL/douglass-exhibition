import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

let seed=4128;
export const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const PI=Math.PI;
export function createWorld(scene){
 const exterior=new THREE.Group(),house=new THREE.Group(),roof=new THREE.Group(),exhibits=new THREE.Group();
 scene.add(exterior,house,roof,exhibits);
 const colliders=[],hotspots=[],flames=[],windMaterials=[];
 const mat=(c,r=.8,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
 function texture(kind,base){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
  for(let i=0;i<14000;i++){const v=random();ctx.fillStyle=`rgba(${v>.5?'255,242,211':'15,10,5'},${random()*.075})`;let x=random()*512,y=random()*512;ctx.fillRect(x,y,kind==='wood'?random()*2+1:random()*3+1,kind==='wood'?random()*100+3:random()*3+1);}
  if(kind==='wood'){for(let i=0;i<75;i++){ctx.strokeStyle=`rgba(20,12,5,${random()*.15})`;ctx.lineWidth=random()*1.2;ctx.beginPath();const x=random()*512;ctx.moveTo(x,0);ctx.bezierCurveTo(x+random()*35,180,x-random()*30,320,x+random()*12,512);ctx.stroke();}}
  if(kind==='brick'){for(let y=0;y<512;y+=42){ctx.fillStyle='#b3a183';ctx.fillRect(0,y,512,3);for(let x= (y/42%2)*60;x<512;x+=120){ctx.fillRect(x,y,3,42);ctx.fillStyle=`rgba(35,21,13,${random()*.25})`;ctx.fillRect(x+3,y+3,117,39);ctx.fillStyle='#b3a183';}}}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;
 }
 const loader=new THREE.TextureLoader();
 function loadTexture(name,color=true,repeat=1){const t=loader.load(import.meta.env.BASE_URL+'textures/'+name+'.jpg');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;}
 const woodMap=loadTexture('wood-color'),woodNormal=loadTexture('wood-normal',false),plasterMap=loadTexture('plaster-color'),brickMap=texture('brick','#735348');
 const wood=new THREE.MeshStandardMaterial({map:woodMap,normalMap:woodNormal,normalScale:new THREE.Vector2(.45,.45),roughness:.78});
 const darkwood=new THREE.MeshStandardMaterial({map:woodMap,normalMap:woodNormal,color:'#645640',roughness:.7});
 const trim=mat('#bdb7a0'),pale=mat('#d0c8ad'),black=mat('#18211c'),iron=mat('#302c26',.45,.78),brass=mat('#a88749',.32,.75),paper=mat('#ac9874',.95),stone=mat('#777569');
 const plaster=new THREE.MeshStandardMaterial({map:plasterMap,normalMap:loadTexture('plaster-normal',false),roughness:.95});
 const brick=new THREE.MeshStandardMaterial({map:brickMap,roughness:.9});
 const glass=new THREE.MeshPhysicalMaterial({color:'#d6ebdc',transparent:true,opacity:.1,roughness:.06,metalness:.15,depthWrite:false,side:THREE.DoubleSide});
 const glow=new THREE.MeshBasicMaterial({color:'#ffd28a',toneMapped:false});
 function box(w,h,d,x,y,z,m=wood,parent=house,collision=false){const geometry=new THREE.BoxGeometry(w,h,d);if(m===wood||m===darkwood){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++){const face=Math.floor(i/4);const sw=face<2?d:w,sh=face<2?h:face<4?d:h;uv.setXY(i,uv.getX(i)*sw/2.8,uv.getY(i)*sh/2.8);}}const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(collision)colliders.push({x1:x-w/2-.24,x2:x+w/2+.24,z1:z-d/2-.24,z2:z+d/2+.24});return o;}
 function cyl(rt,rb,h,x,y,z,m=wood,parent=house,n=16){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function sphere(r,x,y,z,m,parent=house,detail=1){const o=new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail),m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
 function beam(a,b,r,m=wood,parent=house){const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b);const o=cyl(r,r,v1.distanceTo(v2),0,0,0,m,parent,8);o.position.copy(v1).add(v2).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v2.sub(v1).normalize());return o;}
 function line(points,m=brass,r=.018,parent=exhibits){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*8),r,6,false),m);parent.add(mesh);return mesh;}
 const grassMat=new THREE.MeshStandardMaterial({map:loadTexture('grass-color',true,80),normalMap:loadTexture('grass-normal',false,80),color:'#929b79',roughness:1}),dirt=new THREE.MeshStandardMaterial({map:loadTexture('earth-color',true,12),color:'#c0ac85',roughness:1}),fieldMat=mat('#63563a'),leafMaterials=['#344831','#465637','#56623a','#62683b','#768044'].map(c=>mat(c));
 // The landscape is a deliberately interpretive Eastern Shore setting, not a surveyed reconstruction.
 box(480,.4,480,0,-.3,0,grassMat,exterior);
 box(7,.055,78,0,-.03,51,dirt,exterior);
 box(33,.058,11,0,-.02,19,dirt,exterior);
 box(24,.06,34,-30,-.015,5,dirt,exterior);
 box(46,.045,88,48,-.015,7,fieldMat,exterior);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(400,140,30,20),new THREE.MeshStandardMaterial({color:'#719084',roughness:.21,metalness:.48}));water.rotation.x=-PI/2;water.position.set(0,-.08,-116);exterior.add(water);
 // Hundreds of reeds and stalks share one draw call each.
 function vegetation(count,kind){
  const geo=kind==='grain'?mergeGeometries([new THREE.ConeGeometry(.055,.24,5).translate(0,.35,0),new THREE.CylinderGeometry(.011,.014,.62,3)]):new THREE.PlaneGeometry(.07,.44,1,3);if(kind!=='grain'){const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)*(1-(p.getY(i)+.22)/.46));}
  const material=mat(kind==='grain'?'#b3a36a':'#738052');material.side=THREE.DoubleSide;
  material.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};windMaterials.push(shader);shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n float windPhase = instanceMatrix[3].x * 0.19 + instanceMatrix[3].z * 0.14;\n transformed.x += sin(uTime * 1.4 + windPhase) * 0.09 * (position.y + 0.4);');};
  const inst=new THREE.InstancedMesh(geo,material,count);const dummy=new THREE.Object3D();let placed=0;
  while(placed<count){let x,z;if(kind==='grain'){x=28+random()*40;z=-35+random()*84;}else{x=(random()-.5)*185;z=(random()-.5)*170;if((Math.abs(x)<14&&z>-24&&z<20)||(Math.abs(x)<5&&z>10)||(x>24&&x<73&&z>-40&&z<54)|| (x<-17&&x>-42&&z>-15&&z<30))continue;}
   dummy.position.set(x,kind==='grain'?.41+random()*.13:.19,z);dummy.rotation.set(0,random()*PI,kind==='grain'?(random()-.5)*.2:0);dummy.scale.setScalar(.65+random()*.8);dummy.updateMatrix();inst.setMatrixAt(placed++,dummy.matrix);
  }inst.receiveShadow=true;exterior.add(inst);
 }
 vegetation(34000,'grass');vegetation(6200,'grain');
 for(let x=28;x<70;x+=2.1)box(.13,.022,89,x,.02,7,mat('#8a7b4f'),exterior);
 // Tobacco leaves provide a second distinct agricultural texture near the field edge.
 const leafGeo=new THREE.SphereGeometry(1,6,4),tobacco=new THREE.InstancedMesh(leafGeo,mat('#586640'),700);const td=new THREE.Object3D();let ti=0;
 for(let x=17;x<26;x+=1.3)for(let z=-26;z<27;z+=2.2){for(let j=0;j<4;j++){td.position.set(x+Math.cos(j*PI/2)*.23,.35+j*.13,z+Math.sin(j*PI/2)*.23);td.scale.set(.48,.055,.19);td.rotation.set(.2,j*PI/2,.3);td.updateMatrix();if(ti<700)tobacco.setMatrixAt(ti++,td.matrix);}}
 tobacco.count=ti;exterior.add(tobacco);
 const foliage=[];
 const bark=mat('#4f4737');
 function tree(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);exterior.add(g);beam([0,0,0],[.15,7.4,0],.31,bark,g);for(let j=0;j<11;j++){const a=j*2.4,rr=1.4+random()*2.3,yy=5.1+random()*3;beam([.07,3.7,0],[Math.cos(a)*rr,yy,Math.sin(a)*rr],.085,bark,g);const cx=Math.cos(a)*rr,cz=Math.sin(a)*rr;for(let k=0;k<100;k++){const theta=random()*PI*2,v=random()*2-1,r=Math.pow(random(),.333)*2.45;foliage.push({x:x+(cx+Math.sqrt(1-v*v)*Math.cos(theta)*r)*s,y:(yy+.6+v*r*.78)*s,z:z+(cz+Math.sqrt(1-v*v)*Math.sin(theta)*r)*s,s:s*(.34+random()*.48)});}}}
 for(let i=0;i<46;i++){let a=random()*PI*2,r=49+random()*50;tree(Math.cos(a)*r,Math.sin(a)*r-3,.75+random()*.7);}
 tree(-18,24,1.5);tree(30,23,1.25);tree(-18,-31,1.7);tree(22,-32,1.4);tree(-47,4,1.15);
 const leafCanvas=document.createElement('canvas');leafCanvas.width=64;leafCanvas.height=64;const lc=leafCanvas.getContext('2d');
 lc.fillStyle='#e0e1b6';lc.beginPath();lc.moveTo(32,3);lc.bezierCurveTo(60,18,60,44,32,62);lc.bezierCurveTo(4,44,4,18,32,3);lc.fill();lc.strokeStyle='#697145';lc.lineWidth=1;lc.beginPath();lc.moveTo(32,5);lc.lineTo(32,59);lc.stroke();
 const leafTex=new THREE.CanvasTexture(leafCanvas);leafTex.colorSpace=THREE.SRGBColorSpace;
 const foliageMat=new THREE.MeshStandardMaterial({map:leafTex,color:'#6c793e',side:THREE.DoubleSide,alphaTest:.5,roughness:.85});
 foliageMat.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};windMaterials.push(shader);shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uTime * 1.3 + instanceMatrix[3].x * .3 + instanceMatrix[3].z * .2) * .11;');};
 const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1.4),foliageMat,foliage.length);const ld=new THREE.Object3D();const leafColor=new THREE.Color();
 foliage.forEach((f,i)=>{ld.position.set(f.x,f.y,f.z);ld.rotation.set(random()*PI,random()*PI*2,random()*PI);ld.scale.setScalar(f.s);ld.updateMatrix();leaves.setMatrixAt(i,ld.matrix);leafColor.setHSL(.2+random()*.04,.24+random()*.15,.32+random()*.24);leaves.setColorAt(i,leafColor);});leaves.castShadow=true;leaves.receiveShadow=true;exterior.add(leaves);
 function fence(x1,z1,x2,z2){const n=Math.ceil(Math.hypot(x2-x1,z2-z1)/3.3);for(let i=0;i<=n;i++){let t=i/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;box(.17,1.2,.17,x,.6,z,darkwood,exterior);if(i<n){let nx=x1+(x2-x1)*(i+1)/n,nz=z1+(z2-z1)*(i+1)/n;beam([x,.5,z],[nx,.5,nz],.063,darkwood,exterior);beam([x,.99,z],[nx,.99,nz],.063,darkwood,exterior);}}}
 fence(15,25,76,25);fence(16,-35,16,20);fence(-48,28,-6,28);fence(6,76,55,76);fence(-55,76,-6,76);
 function pitchedRoof(x,z,w,d,y,m,parent){const rise=w*.22,slant=Math.sqrt(w*w/4+rise*rise);for(const side of [-1,1]){const ro=box(slant+.4,.2,d+.7,x+side*w/4,y+rise/2,z,m,parent);ro.rotation.z=-side*Math.atan2(rise,w/2);}return rise;}
 const roofMat=new THREE.MeshStandardMaterial({map:loadTexture('roof-color',true,4),normalMap:loadTexture('roof-normal',false,4),color:'#767b72',roughness:.94});
 function cabin(x,z,w=6,d=7){const g=new THREE.Group();g.position.set(x,0,z);exterior.add(g);box(w,.35,d,0,.14,0,stone,g);box(w,2.8,d,0,1.7,0,darkwood,g);for(let y=.4;y<3.2;y+=.22){box(w+.03,.035,d+.03,0,y,0,wood,g);}box(1.2,2.15,.04,0,1.4,d/2+.025,black,g);box(1,1,.045,-w*.31,2,d/2+.05,pale,g);box(.045,1,.07,-w*.31,2,d/2+.09,wood,g);box(1,.045,.07,-w*.31,2,d/2+.1,wood,g);pitchedRoof(0,0,w,d,3.15,roofMat,g);box(.8,2,.8,w*.3,3.5,-1.8,brick,g);}
 cabin(-29,3);cabin(-31,-9,6,8);cabin(-32,18,8,11);
 function barrel(x,z){const g=new THREE.Group();g.position.set(x,.02,z);exterior.add(g);cyl(.35,.32,.98,0,.49,0,wood,g,16);for(const y of [.13,.5,.86]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.35,.027,6,24),iron);ring.rotation.x=PI/2;ring.position.y=y;g.add(ring);}cyl(.31,.31,.025,0,.99,0,darkwood,g,16);}
 barrel(-25,7);barrel(-25,8);barrel(-11.8,-17);
 for(let i=0;i<16;i++){const log=cyl(.095,.12,1.4,-24.5+(i%4)*.23,.22+Math.floor(i/4)*.17,-9.4,wood,exterior,7);log.rotation.x=PI/2;}
 const cart=new THREE.Group();cart.position.set(-23,.03,18);cart.rotation.y=.3;exterior.add(cart);box(2.2,.16,3.4,0,.8,0,wood,cart);for(const side of [-1,1]){for(let y=1;y<1.55;y+=.2)box(.08,.16,3.4,side*1.08,y,0,darkwood,cart);for(const z of [-1.2,1.2]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.65,.065,8,24),iron);wheel.rotation.y=PI/2;wheel.position.set(side*1.24,.65,z);cart.add(wheel);for(let i=0;i<8;i++)beam([side*1.24,.65,z],[side*1.24,.65+Math.sin(i*PI/4)*.61,z+Math.cos(i*PI/4)*.61],.027,wood,cart);}}beam([-.7,.7,1.6],[-.7,.45,4.4],.055,wood,cart);beam([.7,.7,1.6],[.7,.45,4.4],.055,wood,cart);
 // Main house: low brick foundation, clapboard exterior, full open doorway and five rooms.
 box(22.5,.45,34.5,0,.04,-4,brick);box(22,.13,34,0,.31,-4,wood);
 for(let z=-20.8;z<13;z+=.43){for(let x=-10.85;x<11;x+=3.63){const b=box(3.6,.045,.4,x+1.72,.397,z,wood);if(random()>.6)b.material=darkwood;}}
 box(22.4,.5,4.2,0,.04,15.1,brick);box(22.6,.13,4.3,0,.37,15.1,wood);
 for(let i=0;i<3;i++)box(4.4,.16*(3-i),.58,0,.08*(3-i),17.45+i*.57,stone);
 const wallColors=['#3f4137','#546763','#555d4d','#514c48','#7a7b63'];
 const roomMats=wallColors.map(c=>new THREE.MeshStandardMaterial({color:c,map:plasterMap,roughness:1}));
 function wall(w,d,x,z,m=plaster){box(w,4.4,d,x,2.57,z,m,house,true);box(w+.02,.13,d+.03,x,.61,z,darkwood);box(w+.04,.12,d+.05,x,4.65,z,darkwood);}
 function frontSegment(x,w){wall(w,.35,x,13);}
 for(const side of [-1,1]){
  for(const xx of [4.1,8]){const x=side*xx;box(2.3,1.12,.35,x,.96,13,plaster);box(2.3,1.18,.35,x,4.16,13,plaster);box(2.15,2.12,.035,x,2.55,13,glass);for(const yy of [1.46,2.55,3.67])box(2.5,.07,.48,x,yy,13,trim);for(const dx of [-1.18,0,1.18])box(.075,2.3,.5,x+dx,2.55,13,trim);for(const dx of [-1.5,1.5])box(.46,2.4,.09,x+dx,2.55,13.25,darkwood);}
  frontSegment(side*2.4,1.2);frontSegment(side*6.05,1.6);frontSegment(side*10.075,1.85);
 }box(3.6,.95,.35,0,4.29,13,plaster);wall(22,.35,0,-21);
 function windowSide(side,z){const x=side*11;wall(.35,1.45,x,z-2.12);wall(.35,1.45,x,z+2.12);box(.35,1.15,2.8,x,.97,z,plaster);box(.35,1.15,2.8,x,4.17,z,plaster);box(.06,2.05,2.62,x,2.58,z,glass);for(const yy of [1.49,2.55,3.66])box(.52,.065,2.91,x,yy,z,trim);for(const zz of [z-1.4,z,z+1.4])box(.51,2.24,.07,x,2.57,zz,trim);for(const zz of [z-1.9,z+1.9]){box(.17,2.5,.71,x+side*.28,2.55,zz,darkwood);for(let y=1.4;y<3.8;y+=.17)box(.19,.04,.71,x+side*.34,y,zz,wood);}}
 for(const side of [-1,1]){for(const z of [10,4,-2,-8,-14,-18])windowSide(side,z);}
 // Glazed windows still form a physical boundary for free walking.
 for(const side of [-1,1])colliders.push({x1:side*11-.4,x2:side*11+.4,z1:-21.3,z2:13.3});
 colliders.push({x1:-11.3,x2:-1.95,z1:12.6,z2:13.4},{x1:1.95,x2:11.3,z1:12.6,z2:13.4});
 // Fill the small seams between the window bays and at the corners.
 for(const side of [-1,1]){wall(.4,.5,side*11,12.85);wall(.4,.5,side*11,-20.8);}
 for(const x of [-2,2]){wall(.23,5.1,x,10.45,roomMats[x<0?0:1]);wall(.23,7.3,x,1.45,roomMats[x<0?0:1]);wall(.23,6,x,-8.0,roomMats[x<0?3:2]);for(const z of [6.5,-3.6]){box(.3,.87,2.65,x,4.28,z,darkwood);for(const dz of [-1.4,1.4])box(.37,3.4,.13,x,2.11,z+dz,darkwood);}}
 for(const x of [-6.5,6.5])wall(9,.23,x,1,roomMats[x<0?3:2]);wall(9,.24,-6.5,-11,roomMats[4]);wall(9,.24,6.5,-11,roomMats[4]);box(4,.87,.24,0,4.27,-11,darkwood);
 // Wainscoting, timber beams and individual joists.
 for(const side of [-1,1]){box(.12,.8,33.5,side*10.77,.88,-4,darkwood);for(let z=-20;z<13;z+=1.05)box(.16,.88,.055,side*10.68,.9,z,wood);}
 for(let z=-20;z<=13;z+=3.3){box(22,.22,.21,0,4.61,z,darkwood);for(const x of [-6.6,0,6.6])box(.2,.18,33.8,x,4.61,-4,darkwood);}
 box(22.3,.16,34.4,0,4.85,-4,darkwood,roof);pitchedRoof(0,-4,23,35,4.96,roofMat,roof);
 for(let z=-21.5;z<14;z+=.7){for(const side of [-1,1]){const seam=box(12.2,.025,.035,side*5.75,7.49,z,mat('#373d37'),roof);seam.rotation.z=-side*Math.atan(.44);}}
 // Gable end triangles close the roof in the exterior view.
 for(const z of [-21.5,13.5]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-11.6,4.86,z,11.6,4.86,z,0,10.02,z],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));geo.computeVertexNormals();const g=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#beb9a2',side:THREE.DoubleSide}));roof.add(g);}
 for(const x of [-7.7,7.7]){box(1.2,5.35,1.55,x,7.62,-7,brick,roof);box(1.5,.22,1.8,x,10.3,-7,stone,roof);}
 const atticWindow=new THREE.Mesh(new THREE.CircleGeometry(.74,40),black);atticWindow.position.set(0,7.2,13.54);roof.add(atticWindow);
 const atticRing=new THREE.Mesh(new THREE.TorusGeometry(.77,.055,8,48),trim);atticRing.position.set(0,7.2,13.57);roof.add(atticRing);box(.055,1.43,.08,0,7.2,13.6,trim,roof);box(1.43,.055,.08,0,7.2,13.6,trim,roof);
 for(let yy=4.95;yy<9.8;yy+=.19){const width=(10.02-yy)/5.06*23;box(width,.023,.025,0,yy,13.53,trim,roof);}
 // Full-length porch and its hand-built balustrade.
 for(const x of [-10,-6,6,10]){box(.2,3.3,.22,x,2.12,16.6,trim);box(.4,.16,.43,x,.56,16.6,trim);box(.36,.13,.38,x,3.66,16.6,trim);}
 const pr=box(23,.16,5,0,4.0,15.25,roofMat);pr.rotation.x=.13;
 for(const side of [-1,1]){box(8.4,.1,.13,side*6.2,1.48,16.72,darkwood);box(8.4,.08,.13,side*6.2,.63,16.72,darkwood);for(let x=2.1;x<10.5;x+=.4)box(.065,.86,.065,side*x,1.02,16.72,trim);}
 for(const side of [-1,1]){const door=box(1.7,3.3,.13,side*1.82,2.04,12.55,darkwood);door.rotation.y=side*.55;for(const y of [1.25,2.8]){const panel=box(1.2,1.1,.05,side*1.86,y,12.69,wood);panel.rotation.y=side*.55;}}
 // Runner: a thin continuous brass line makes the connected exhibition legible without text.
 box(.028,.009,27.7,0,.436,2,brass,exhibits);
 for(const z of [6.5,-3.6,-11]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.33,.018,6,40),brass);ring.rotation.x=PI/2;ring.position.set(0,.448,z);exhibits.add(ring);}
 // Recessed fireplace and furnishings in the final room.
 box(3.8,3.2,.42,0,2.0,-20.55,brick);box(2.2,1.9,.47,0,1.36,-20.3,black);box(4.2,.22,.72,0,3.58,-20.25,darkwood);box(3.1,.15,1.3,0,.5,-20,stone);
 for(let j=0;j<5;j++){const log=cyl(.15,.15,1.5,0,.7,-20,wood,house);log.rotation.z=PI/2;log.rotation.y=j*.5;}
 for(let j=0;j<5;j++){const f=new THREE.Mesh(new THREE.ConeGeometry(.13+random()*.08,.5+random()*.3,5),new THREE.MeshBasicMaterial({color:j%2?'#fba454':'#e0c177',transparent:true,opacity:.55}));f.position.set((random()-.5)*1.2,.96,-19.93);house.add(f);flames.push(f);}
 const firelight=new THREE.PointLight('#ffae5d',6,7,1.6);firelight.position.set(0,1,-19.1);scene.add(firelight);
 function lantern(x,y,z,parent=house){box(.3,.07,.3,x,y-.22,z,iron,parent);box(.32,.055,.32,x,y+.28,z,iron,parent);for(const dx of [-.13,.13])for(const dz of [-.13,.13])box(.025,.5,.025,x+dx,y,z+dz,iron,parent);cyl(.047,.06,.2,x,y-.07,z,paper,parent);sphere(.065,x,y+.07,z,glow,parent);}
 lantern(-2.7,2.3,13.35);lantern(2.7,2.3,13.35);
 for(const z of [9,-1,-10]){beam([0,4.6,z],[0,3.8,z],.014,iron);lantern(0,3.55,z);const light=new THREE.PointLight('#ffd49b',7,9,1.6);light.position.set(0,3.25,z);scene.add(light);}
 // Shared exhibit construction. Content stays deliberately empty; every blank panel has its own slot.
 function hotspot(id,room,x,y,z,type='object'){hotspots.push({id,room,position:new THREE.Vector3(x,y,z),type});}
 function panel(x,y,z,w,h,ry=0,room=0,id='panel',color=paper){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;exhibits.add(g);box(w+.14,h+.14,.095,0,0,0,darkwood,g);box(w,h,.025,0,0,.062,color,g);for(const xx of [-w/2,w/2])box(.025,h+.035,.035,xx,0,.08,brass,g);for(const yy of [-h/2,h/2])box(w+.025,.025,.035,0,yy,.08,brass,g);if(room)hotspot(id,room,x+Math.sin(ry)*.1,y,z+Math.cos(ry)*.1,'analysis');return g;}
 function plinth(x,z,w=1.3,h=1.2,d=1.3){box(w,h,d,x,.44+h/2,z,black,exhibits,true);box(w+.06,.065,d+.06,x,.44+h,z,brass,exhibits);return .51+h;}
 function caseBox(x,z,w,h,d,top){box(w,h,d,x,top+h/2,z,glass,exhibits);for(const xx of [-w/2,w/2])for(const zz of [-d/2,d/2])box(.018,h,.018,x+xx,top+h/2,z+zz,brass,exhibits);for(const side of [-1,1]){box(.025,.025,d+.025,x+side*w/2,top+h,z,brass,exhibits);box(w+.025,.025,.025,x,top+h,z+side*d/2,brass,exhibits);}}
 function chain(x,y,z,n=8,scale=1,parent=exhibits){for(let i=0;i<n;i++){const link=new THREE.Mesh(new THREE.TorusGeometry(.115*scale,.032*scale,7,16),iron);link.position.set(x+i*.17*scale,y+.012*Math.sin(i),z);link.rotation.x=i%2?PI/2:.25;parent.add(link);}}
 function book(x,y,z,s=1,open=false,parent=exhibits){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);parent.add(g);if(open){for(const side of [-1,1]){const p=box(.59,.085,.76,side*.28,0,0,paper,g);p.rotation.z=side*.12;const c=box(.61,.045,.79,side*.28,-.07,0,darkwood,g);c.rotation.z=side*.12;}box(.06,.07,.8,0,-.018,0,brass,g);}else{box(.66,.11,.88,0,.05,0,paper,g);box(.71,.035,.92,0,.125,0,darkwood,g);box(.71,.035,.92,0,-.024,0,darkwood,g);box(.04,.16,.92,-.345,.05,0,darkwood,g);}return g;}
 function compass(x,y,z,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);exhibits.add(g);cyl(.24,.26,.09,0,0,0,brass,g,32);cyl(.205,.205,.013,0,.05,0,paper,g,32);for(let j=0;j<8;j++){const a=j*PI/4;beam([Math.sin(a)*.16,.065,Math.cos(a)*.16],[Math.sin(a)*.19,.065,Math.cos(a)*.19],.007,iron,g);}const needle=new THREE.Mesh(new THREE.ConeGeometry(.028,.3,3),iron);needle.position.y=.08;needle.rotation.x=PI/2;g.add(needle);}
 function quill(x,y,z,s=1){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);exhibits.add(g);beam([0,0,0],[.42,.94,0],.012,brass,g);const shape=new THREE.Shape();shape.moveTo(.08,.18);shape.bezierCurveTo(-.13,.72,.22,1.26,.49,1.4);shape.bezierCurveTo(.65,1.05,.62,.56,.08,.18);const f=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:'#e5ddbe',side:THREE.DoubleSide,roughness:.9}));g.add(f);for(let j=1;j<9;j++)beam([.1+j*.032,.23+j*.10,.008],[.01+j*.029,.4+j*.09,.008],.004,brass,g);}
 function bench(x,z,rot=0){const g=new THREE.Group();g.position.set(x,.43,z);g.rotation.y=rot;exhibits.add(g);box(2.5,.12,.62,0,.47,0,wood,g);for(const xx of [-.95,.95])box(.1,.47,.46,xx,.22,0,iron,g);}
 function roomLight(x,z,color){const light=new THREE.SpotLight(color,105,15,.65,.7,1.65);light.position.set(x,4.35,z+1.3);light.target.position.set(x,1,z);light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.bias=-.0004;scene.add(light,light.target);cyl(.12,.16,.24,x,4.35,z+1.3,black,exhibits);const fill=new THREE.PointLight(color,10,12,1.8);fill.position.set(x,3,z);scene.add(fill);}
 // I — central empty identity space, four control spokes and a broken chain.
 const r1=[-6.5,7];box(8.3,.018,9.8,-6.5,.43,6.8,mat('#35362f'),exhibits);
 const top1=plinth(-6.5,6.4,1.65,1.08,1.65);caseBox(-6.5,6.4,1.56,.78,1.56,top1);chain(-7.03,top1+.1,6.48,5);chain(-6.08,top1+.1,6.3,3);
 const cuff=new THREE.Mesh(new THREE.TorusGeometry(.21,.048,10,27,PI*1.7),iron);cuff.rotation.x=PI/2;cuff.position.set(-6.55,top1+.15,6.22);exhibits.add(cuff);hotspot('r1-symbol',1,-6.5,2.05,6.4);
 const spokeLocations=[[-9.3,8.7],[-9.3,3.9],[-3.6,8.7],[-3.6,3.9]];
 spokeLocations.forEach(([x,z],i)=>{line([[-6.5,.462,6.4],[x,.462,6.4],[x,.462,z]],brass,.012);const h=plinth(x,z,1.3,.8,.55);const p=panel(x,1.85,z,1.08,1.05,0,1,`r1-control-${i+1}`);p.rotation.x=-.15;});
 panel(-10.6,2.57,6.6,2.5,1.5,PI/2,1,'r1-turning-point');panel(-6.5,2.7,1.19,3.4,1.65,0,1,'r1-resistance');bench(-6.7,11.35);roomLight(-6.5,6.5,'#f5c88a');
 // II — five physical stages connected by a winding brass route.
 box(8.3,.018,9.8,6.5,.43,6.8,mat('#455553'),exhibits);
 const journey=[[3.6,9.4],[6.15,9.15],[8.9,7],[6.6,4.5],[3.8,3.6]];
 line(journey.map(([x,z])=>[x,.467,z]),brass,.026);
 journey.forEach(([x,z],i)=>{const h=plinth(x,z,1.03,.85+i*.08,.88);caseBox(x,z,.99,.56,.84,h);if(i===0){book(x,h+.06,z,.64);}else if(i===1){compass(x,h+.12,z,.85);}else if(i===2){box(.62,.025,.43,x,h+.04,z,paper,exhibits);box(.48,.022,.34,x+.09,h+.07,z-.02,paper,exhibits);}else if(i===3){const boat=new THREE.Mesh(new THREE.SphereGeometry(.4,12,6,0,PI*2,0,PI/2),wood);boat.rotation.x=PI;boat.scale.set(1,.45,.48);boat.position.set(x,h+.19,z);exhibits.add(boat);beam([x,h+.18,z],[x,h+.56,z],.012,brass,exhibits);}else{const key=new THREE.Mesh(new THREE.TorusGeometry(.09,.022,8,16),brass);key.rotation.x=PI/2;key.position.set(x-.12,h+.1,z);exhibits.add(key);beam([x-.03,h+.1,z],[x+.25,h+.1,z],.025,brass,exhibits);box(.055,.025,.13,x+.22,h+.1,z+.04,brass,exhibits);}hotspot(`r2-stage-${i+1}`,2,x,h+.64,z);});
 panel(10.57,2.55,6.4,3.3,1.55,-PI/2,2,'r2-internal-freedom');panel(6.4,2.55,1.2,3.4,1.6,0,2,'r2-connection');roomLight(6.4,6.3,'#d8e9dd');
 // III — opposing triptychs and a split lectern. Six empty evidence panels, three pairs.
 box(8.3,.018,11.5,6.5,.43,-5,mat('#484737'),exhibits);
 for(let i=0;i<3;i++){const z=-8.6+i*3.25;panel(10.57,2.6,z,2.25,2.2,-PI/2,3,`r3-claim-${i+1}`,pale);panel(2.23,2.6,z,2.25,2.2,PI/2,3,`r3-action-${i+1}`,mat('#625f4f'));line([[2.45,.46,z],[10.25,.46,z]],brass,.012);}
 const rt=plinth(6.5,-5.3,2.2,1.06,1.25);book(6.08,rt+.16,-5.25,.8,true);chain(6.5,rt+.1,-5.2,7,.8);hotspot('r3-contradiction',3,6.5,2.18,-5.3);panel(6.6,2.5,-10.78,3.6,1.5,0,3,'r3-analysis');roomLight(6.5,-5.2,'#efce92');bench(6.5,-.3);
 // IV — a six-part archive with linked vitrines and blank portrait / interpretation panels.
 box(8.3,.018,11.5,-6.5,.43,-5,mat('#4b4846'),exhibits);
 for(let i=0;i<6;i++){const side=i<3?-1:1,j=i%3,x=side<0?-9.1:-3.9,z=-8.5+j*3.2,h=plinth(x,z,1.35,1.0,1.05);caseBox(x,z,1.3,.68,1,h);const rotation=side<0?PI/2:-PI/2;panel(side<0?-10.58:-2.25,2.88,z,2,1.45,rotation,4,`r4-stage-${i+1}`);if(i===0){box(.4,.32,.4,x,h+.16,z,wood,exhibits);}else if(i===1){const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.03,8,24),brass);ring.position.set(x,h+.26,z);exhibits.add(ring);}else if(i===2){book(x,h+.08,z,.65,true);}else if(i===3){chain(x-.38,h+.13,z,3);chain(x+.21,h+.13,z-.14,2);}else if(i===4){compass(x,h+.09,z,.8);}else{cyl(.09,.12,.18,x,h+.09,z,iron,exhibits);quill(x,h+.17,z,.43);}hotspot(`r4-artifact-${i+1}`,4,x,h+.77,z);}
 line([[-9.1,.468,-8.5],[-9.1,.468,-2.1],[-6.5,.468,-1.35],[-3.9,.468,-2.1],[-3.9,.468,-8.5]],brass,.02);
 panel(-6.5,2.65,-10.77,3.5,1.55,0,4,'r4-representation');roomLight(-6.5,-5.2,'#e1d5c7');
 // V — the author reclaims the desk. Eight blank quotation leaves encircle the room.
 box(20.8,.018,8.8,0,.43,-16.2,mat('#77785f'),exhibits);
 box(3.8,.16,1.65,0,1.6,-16.4,wood,exhibits,true);for(const x of [-1.6,1.6])for(const z of [-17,-15.85]){box(.13,1.1,.13,x,1,z,darkwood,exhibits);box(.26,.1,.26,x,.48,z,darkwood,exhibits);}
 box(3.1,.34,.52,0,1.37,-15.86,darkwood,exhibits);for(const x of [-.8,.8])sphere(.045,x,1.37,-15.57,brass,exhibits);
 book(-.45,1.77,-16.3,1.22,true);book(1.2,1.78,-16.6,.6);book(1.21,1.94,-16.58,.6);cyl(.12,.16,.23,.65,1.83,-16.2,iron,exhibits);quill(.65,1.95,-16.2,.7);box(.65,.018,.84,.25,1.7,-15.98,paper,exhibits);hotspot('r5-authors-desk',5,0,2.3,-16.35);
 const chair=new THREE.Group();chair.position.set(0,.45,-17.65);exhibits.add(chair);box(.85,.12,.7,0,.63,0,darkwood,chair);for(const x of [-.34,.34])for(const z of [-.24,.24])box(.075,.6,.075,x,.3,z,wood,chair);box(.87,.8,.1,0,1.08,-.28,darkwood,chair);for(let x=-.3;x<=.31;x+=.15)box(.045,.78,.06,x,1.1,-.35,wood,chair);
 for(const side of [-1,1])for(let i=0;i<4;i++){const z=-13.3-i*1.85;panel(side*10.55,2.6,z,1.28,1.9,-side*PI/2,5,`r5-quotation-${side<0?i+1:i+5}`);}
 panel(-5.6,2.7,-20.72,4.6,1.9,0,5,'r5-curator-statement');panel(5.6,2.7,-20.72,4.6,1.9,0,5,'r5-synthesis');
 bench(-5,-14.4);bench(5,-14.4);roomLight(0,-16,'#ffe1ac');
 // Blank suspended leaves: an architectural sculpture for the unwritten exhibition.
 for(let i=0;i<13;i++){const a=i*.48,x=Math.sin(a)*2.9,y=3.2+Math.cos(i*.55)*.5,z=-16.7+Math.cos(a)*1.25;const sheet=box(.46,.012,.67,x,y,z,paper,exhibits);sheet.rotation.set(.15+random()*.3,random()*.6,.1+random()*.3);beam([x,y+.06,z],[x,4.5,z],.003,brass,exhibits);}
 // A modest jetty connects the agricultural landscape to the water.
 for(let z=-70;z>-89;z-=.45)box(2.7,.12,.42,-6,.4,z,wood,exterior);for(const z of [-70,-77,-85])for(const x of [-7.5,-4.5])cyl(.12,.15,1.6,x,.22,z,darkwood,exterior);
 // Fine atmospheric dust, visible in raking window light.
 const positions=new Float32Array(700*3);for(let i=0;i<700;i++){positions[i*3]=(random()-.5)*21;positions[i*3+1]=.7+random()*3.7;positions[i*3+2]=-20+random()*33;}
 const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#f4d8a6',size:.023,transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(dust);
 // Merge static opaque meshes by material to keep the entire scene light enough for a browser.
 function mergeStatic(group){group.updateMatrixWorld(true);const batches=new Map();const remove=[];group.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.transparent||flames.includes(o))return;const key=o.material.uuid;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(!batches.has(key))batches.set(key,{material:o.material,geometries:[]});batches.get(key).geometries.push(geo);remove.push(o);});remove.forEach(o=>o.removeFromParent());for(const {material,geometries} of batches.values()){try{const geom=mergeGeometries(geometries,false);if(geom){const merged=new THREE.Mesh(geom,material);merged.castShadow=true;merged.receiveShadow=true;group.add(merged);}}finally{geometries.forEach(g=>g.dispose());}}}
 mergeStatic(exterior);mergeStatic(house);mergeStatic(roof);mergeStatic(exhibits);
 return {exterior,house,roof,exhibits,colliders,hotspots,water,dust,flames,firelight,windMaterials};
}
