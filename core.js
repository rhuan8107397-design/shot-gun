"use strict";
//////////////////////////////////////////////////////////////
// ===== 基础初始化 =====
//////////////////////////////////////////////////////////////

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8a8a94,40,260);

// procedural skybox — industrial dusk
const skyGeo=new THREE.SphereGeometry(200,64,64);
const skyMat=new THREE.ShaderMaterial({
    uniforms:{
        uTopColor:{value:new THREE.Color(0x3a4a5a)},
        uHorizonColor:{value:new THREE.Color(0xafa090)},
        uBottomColor:{value:new THREE.Color(0x7a7064)},
        uOffset:{value:0.08},
        uExponent:{value:0.7}
    },
    vertexShader:`varying vec3 vWorldPosition;void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorldPosition=wp.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 uTopColor;uniform vec3 uHorizonColor;uniform vec3 uBottomColor;uniform float uOffset;uniform float uExponent;varying vec3 vWorldPosition;void main(){float h=normalize(vWorldPosition).y;float t=max(0.0,min(1.0,(h+uOffset)/(1.0+uOffset*2.0)));t=pow(t,uExponent);vec3 col=mix(uBottomColor,uHorizonColor,t);col=mix(col,uTopColor,smoothstep(0.5,0.8,t));gl_FragColor=vec4(col,1.0);}`,
    side:THREE.BackSide,depthWrite:false
});
const skyDome=new THREE.Mesh(skyGeo,skyMat);
skyDome.renderOrder=-1;
scene.add(skyDome);

const camera = new THREE.PerspectiveCamera(
75,
window.innerWidth/window.innerHeight,
0.1,
500
);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
//////////////////////////////////////////////////////////////
// ===== UI =====
//////////////////////////////////////////////////////////////

const hpEl = document.getElementById('hp');
const ammoEl = document.getElementById('ammo');
const reserveEl = document.getElementById('reserve');
const weaponEl = document.getElementById('weapon');
const scoreEl = document.getElementById('scoreText');
const comboText = document.getElementById('comboText');
const timeText = document.getElementById('timeText');
const staminaBar = document.getElementById('staminaBar');
const bossBarWrap = document.getElementById('bossBarWrap');
const bossBar = document.getElementById('bossBar');
let surviveTime=0;
let score = 0;

let combo = 0;
let comboTimer = 0;
let bestCombo = 0;

let timeScale = 1.0;
let whiteFlashOpacity = 0;

let kills = 0;
let totalEnemies = 0;

const bestScore = Number(
localStorage.getItem('fps_best') || 0
);
const waveEl = document.getElementById('wave');
const crosshair = document.getElementById('crosshair');
const adsDot = document.getElementById('adsDot');
const centerText = document.getElementById('centerText');
const pickupText = document.getElementById('pickupText');
const damageNumberLayer = document.getElementById('damageNumberLayer');
const lowHpEdges = [
    document.getElementById('lowHpTop'),
    document.getElementById('lowHpBottom'),
    document.getElementById('lowHpLeft'),
    document.getElementById('lowHpRight')
];

const flashEdges = [
    document.getElementById('flashTop'),
    document.getElementById('flashBottom'),
    document.getElementById('flashLeft'),
    document.getElementById('flashRight')
];

const minimap = document.getElementById('minimap');
const minimapPlayer = document.getElementById('minimapPlayer');
const minimapWalls = document.getElementById('minimapWalls');
const minimapEnemies = document.getElementById('minimapEnemies');

//////////////////////////////////////////////////////////////
// ===== 菜单 =====
//////////////////////////////////////////////////////////////

const startMenu = document.getElementById('startMenu');
const pauseMenu = document.getElementById('pauseMenu');
const endMenu = document.getElementById('endMenu');
const shopMenu = document.getElementById('shopMenu');
const shopScore = document.getElementById('shopScore');
const shopButtons = document.getElementById('shopButtons');
const closeShopBtn = document.getElementById('closeShopBtn');
const endTitle = document.getElementById('endTitle');

let paused=true;
let gameOver=false;
let started=false;
let lowHpActive = false;
let heartbeatTimer = 0;
let breathTimer = 0;
//////////////////////////////////////////////////////////////
// ===== 灯光 =====
//////////////////////////////////////////////////////////////

const hemi = new THREE.HemisphereLight(0xbcc8d4,0x6a5e54,1.0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffeedd,0.8);
dir.position.set(60,50,30);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.left=-80;
dir.shadow.camera.right=80;
dir.shadow.camera.top=80;
dir.shadow.camera.bottom=-80;
dir.shadow.camera.far=200;
scene.add(dir);
//////////////////////////////////////////////////////////////
// ===== 地板 =====
//////////////////////////////////////////////////////////////

// procedural asphalt ground texture
const groundCanvas=document.createElement('canvas');
groundCanvas.width=512;groundCanvas.height=512;
const gctx=groundCanvas.getContext('2d');
gctx.fillStyle='#3a3e44';gctx.fillRect(0,0,512,512);
for(let i=0;i<8000;i++){
    const v=30+Math.random()*35;
    gctx.fillStyle=`rgb(${v},${v},${v})`;
    gctx.fillRect(Math.random()*512,Math.random()*512,2+Math.random()*3,2+Math.random()*3);
}
// subtle grid lines
gctx.strokeStyle='rgba(255,255,255,0.03)';
gctx.lineWidth=1;
for(let x=0;x<512;x+=64){gctx.beginPath();gctx.moveTo(x,0);gctx.lineTo(x,512);gctx.stroke();}
for(let y=0;y<512;y+=64){gctx.beginPath();gctx.moveTo(0,y);gctx.lineTo(512,y);gctx.stroke();}
const groundTex=new THREE.CanvasTexture(groundCanvas);
groundTex.wrapS=THREE.RepeatWrapping;groundTex.wrapT=THREE.RepeatWrapping;
groundTex.repeat.set(20,20);

const floor = new THREE.Mesh(
new THREE.PlaneGeometry(400,400),
new THREE.MeshStandardMaterial({
map:groundTex,color:0x999999,roughness:0.9,metalness:0.05
})
);

floor.rotation.x=-Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);
//////////////////////////////////////////////////////////////
// ===== 程序化地图生成 =====
//////////////////////////////////////////////////////////////

const walls=[];
const colliders=[];
const stairs=[];
const rooms=[];
const barrels = [];
const explosionFragments = [];
const bulletMarks=[];
const fluorescentLights = [];

// shared materials
const matWall=new THREE.MeshStandardMaterial({color:'#6b7280',roughness:0.9,metalness:0.0});
const matWallCorridor=new THREE.MeshStandardMaterial({color:'#6a7585',roughness:0.9,metalness:0.0});
const matCrate=new THREE.MeshStandardMaterial({color:'#4a5568',roughness:0.85,metalness:0.0});
const matStripe=new THREE.MeshStandardMaterial({color:'#ccbbaa',roughness:0.9,metalness:0.0});
const matHalfWall=new THREE.MeshStandardMaterial({color:'#7f8c8d',roughness:0.9,metalness:0.0});
const matDesk=new THREE.MeshStandardMaterial({color:'#554433',roughness:0.85,metalness:0.0});
const matPlatform=new THREE.MeshStandardMaterial({color:'#4a5568',roughness:0.9,metalness:0.0,side:THREE.DoubleSide});
const matCeiling=new THREE.MeshStandardMaterial({color:'#505560',roughness:1.0,metalness:0.0,side:THREE.DoubleSide});
const matPillar=new THREE.MeshStandardMaterial({color:'#555a60',roughness:0.9,metalness:0.0});
// building-specific materials
const matFactoryWall=new THREE.MeshStandardMaterial({color:'#6b6b70',roughness:0.85,metalness:0.15});
const matOfficeWall=new THREE.MeshStandardMaterial({color:'#8a8580',roughness:0.8,metalness:0.05});
const matWarehouseWall=new THREE.MeshStandardMaterial({color:'#5a5d5a',roughness:0.9,metalness:0.2});
const matRoofVent=new THREE.MeshStandardMaterial({color:'#555558',roughness:0.8,metalness:0.6});
const matConcrete=new THREE.MeshStandardMaterial({color:'#6e6c68',roughness:0.95,metalness:0.0});
const matCurb=new THREE.MeshStandardMaterial({color:'#555a60',roughness:0.9,metalness:0.0});

function addCollider(mesh, type, heightOverride){
    const hw = mesh.geometry.parameters.width / 2;
    const hh = heightOverride !== null ? heightOverride / 2 : (mesh.geometry.parameters.height || 0) / 2;
    const hd = mesh.geometry.parameters.depth / 2;
    const topY = mesh.position.y + hh;
    colliders.push({
        minX: mesh.position.x - hw,
        maxX: mesh.position.x + hw,
        minY: mesh.position.y - hh,
        maxY: topY,
        minZ: mesh.position.z - hd,
        maxZ: mesh.position.z + hd,
        vaultable: type === 'halfwall' || type === 'desk',
        vaultHeight: topY
    });
}

function createWall(x,z,w,h,d,mat){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat||matWall);
    mesh.position.set(x,h/2,z);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
    walls.push(mesh);
    addCollider(mesh, 'wall');
}

function createWallCorridor(x,z,w,h,d){
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),matWallCorridor);
    mesh.position.set(x,h/2,z);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
    walls.push(mesh);
    addCollider(mesh, 'wall');
}

function createBarrel(x,z){
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(1,1,3,16),
        new THREE.MeshStandardMaterial({color:'#cc0000',emissive:0x330000})
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'barrel';
    const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(1.03,1.03,0.18,16),
        new THREE.MeshStandardMaterial({color:'#ffcc00',emissive:0x332200})
    );
    stripe.position.y = 0.8;
    group.add(body); group.add(stripe);
    group.position.set(x,1.5,z);
    scene.add(group);
    // AABB collider approximating cylinder (r=1, h=3)
    const barrelCollider = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 2),
        new THREE.MeshBasicMaterial({visible:false})
    );
    barrelCollider.position.set(x, 1.5, z);
    scene.add(barrelCollider);
    addCollider(barrelCollider, 'barrel');
    barrels.push({mesh:group,body,hp:3,alive:true,flashTimer:0,collider:barrelCollider});
}

function createCrate(x,z,w,d,h){
    if(!h)h=2.5;
    const crate=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),matCrate);
    body.position.y=h/2;
    body.castShadow=true; body.receiveShadow=true;
    crate.add(body);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(w+0.05,0.12,d+0.05),matStripe);
    stripe.position.y=h+0.02;
    crate.add(stripe);
    crate.position.set(x,0,z);
    scene.add(crate);
    walls.push(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({visible:false})));
    walls[walls.length-1].position.set(x,h/2,z);
    addCollider(walls[walls.length-1], 'crate');
    // AO contact shadow
    const aoGeo2=new THREE.PlaneGeometry(w*1.05,d*1.05);
    const aoMat2=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.25});
    const aoPlane2=new THREE.Mesh(aoGeo2,aoMat2);
    aoPlane2.rotation.x=-Math.PI/2;
    aoPlane2.position.set(x,0.03,z);
    scene.add(aoPlane2);
}

function createHalfWall(x,z,w,d){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,1.2,d),matHalfWall);
    mesh.position.set(x,0.6,z);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    walls.push(mesh);
    addCollider(mesh, 'halfwall');
}

function createDesk(x,z){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.7,0.8),matDesk);
    mesh.position.set(x,0.35,z);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    walls.push(mesh);
    addCollider(mesh, 'desk');
    // AO
    const aoGeo3=new THREE.PlaneGeometry(1.3,0.9);
    const aoMat3=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.25});
    const aoPlane3=new THREE.Mesh(aoGeo3,aoMat3);
    aoPlane3.rotation.x=-Math.PI/2;
    aoPlane3.position.set(x,0.03,z);
    scene.add(aoPlane3);
}

function createFluorescentTube(x,y,z){
    // tube mesh (StandardMaterial + weak emissive, not BasicMaterial)
    const tubeGeo=new THREE.BoxGeometry(0.15,0.08,1.8);
    const tubeMat=new THREE.MeshStandardMaterial({
        color:0xddddcc,emissive:0x222211,emissiveIntensity:0.2,roughness:1.0
    });
    const tube=new THREE.Mesh(tubeGeo,tubeMat);
    tube.position.set(x,y,z);
    scene.add(tube);

    // point light (warm neutral white, ~4500K)
    const fluoLight=new THREE.PointLight(0xeeeedd,0.6,18,2);
    fluoLight.position.set(x,y-0.4,z);
    scene.add(fluoLight);

    fluorescentLights.push({mesh:tube,light:fluoLight});

    // AO contact shadow plane
    const aoGeo=new THREE.PlaneGeometry(2,4);
    const aoMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.2});
    const aoPlane=new THREE.Mesh(aoGeo,aoMat);
    aoPlane.rotation.x=-Math.PI/2;
    aoPlane.position.set(x,0.03,z);
    scene.add(aoPlane);

    return tube;
}

function createEmergencyLight(x,y,z){
    const emGeo=new THREE.BoxGeometry(0.08,0.08,0.08);
    const emMat=new THREE.MeshStandardMaterial({
        color:0xffaa77,emissive:0x331100,emissiveIntensity:0.3,roughness:1.0
    });
    const emMesh=new THREE.Mesh(emGeo,emMat);
    emMesh.position.set(x,y,z);
    scene.add(emMesh);
    const emLight=new THREE.PointLight(0xffaa77,0.15,3);
    emLight.position.set(x,y,z);
    scene.add(emLight);
}

function createPillar(x,z,w,h,d){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),matPillar);
    mesh.position.set(x,h/2,z);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    walls.push(mesh);
    addCollider(mesh, 'wall');
    const aoGeo4=new THREE.PlaneGeometry(w*1.1,d*1.1);
    const aoMat4=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.25});
    const aoPlane4=new THREE.Mesh(aoGeo4,aoMat4);
    aoPlane4.rotation.x=-Math.PI/2;
    aoPlane4.position.set(x,0.03,z);
    scene.add(aoPlane4);
}

function createCurb(x,z,len,dir){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(dir==='x'?len:0.3,0.15,dir==='z'?len:0.3),matCurb);
    mesh.position.set(x,0.075,z);
    mesh.receiveShadow=true;
    scene.add(mesh);
}

function createCeiling(x,z,w,d,y){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),matCeiling);
    mesh.rotation.x=-Math.PI/2;
    mesh.position.set(x,y||6,z);
    mesh.receiveShadow=true;
    scene.add(mesh);
}

function createPlatform(x,z,w,d,h){
    if(!h)h=1.5;
    const group=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(w,0.3,d),matPlatform);
    body.position.y=h;
    body.castShadow=true; body.receiveShadow=true;
    group.add(body);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(w+0.05,0.05,d+0.05),matStripe);
    stripe.position.y=h+0.15;
    group.add(stripe);
    group.position.set(x,0,z);
    scene.add(group);
    const collider=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({visible:false}));
    collider.position.set(x,h/2,z);
    scene.add(collider);
    walls.push(collider);
    addCollider(collider, 'platform', h);
}

function createRamp(x,z,w,dir,topH){
    if(!topH)topH=1.5;
    const len=topH/Math.tan(15*Math.PI/180);
    const geo=new THREE.BoxGeometry(w,0.2,len);
    const mesh=new THREE.Mesh(geo,matPlatform);
    mesh.position.set(x,topH/2,z);
    mesh.rotation.x=dir==='z'?-15*Math.PI/180:0;
    mesh.rotation.z=dir==='x'?15*Math.PI/180:0;
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    const collider=new THREE.Mesh(new THREE.BoxGeometry(w,topH,len),new THREE.MeshBasicMaterial({visible:false}));
    collider.position.set(x,topH/2,z);
    scene.add(collider);
    walls.push(collider);
    addCollider(collider, 'ramp', topH);
}

function createCrateStack(x,z){
    for(let i=0;i<3;i++){
        const crate=new THREE.Group();
        const body=new THREE.Mesh(new THREE.BoxGeometry(2,2.5,3),matCrate);
        body.position.y=1.25+i*2.5;
        body.castShadow=true; body.receiveShadow=true;
        crate.add(body);
        const stripe=new THREE.Mesh(new THREE.BoxGeometry(2.05,0.12,3.05),matStripe);
        stripe.position.y=2.5+i*2.5+0.02;
        crate.add(stripe);
        crate.position.set(x,0,z);
        scene.add(crate);
    }
    const collider=new THREE.Mesh(new THREE.BoxGeometry(2,7.5,3),new THREE.MeshBasicMaterial({visible:false}));
    collider.position.set(x,3.75,z);
    scene.add(collider);
    walls.push(collider);
    addCollider(collider, 'wall');
}

function createEnvDecal(type, x, z, rotation = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (type === 'oil') {
        ctx.fillStyle = 'rgba(2,2,5,0.75)';
        ctx.beginPath();
        ctx.ellipse(64, 64, 40 + Math.random()*20, 30 + Math.random()*15, rotation, 0, Math.PI*2);
        ctx.fill();
        // extra smaller blob for organic look
        ctx.beginPath();
        ctx.ellipse(64 + (Math.random()-0.5)*30, 64 + (Math.random()-0.5)*25, 15 + Math.random()*10, 10 + Math.random()*8, rotation + Math.random(), 0, Math.PI*2);
        ctx.fill();
    } else if (type === 'crack') {
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, 64);
        for (let i = 1; i < 10; i++) {
            ctx.lineTo(10 + i*13, 64 + (Math.random()-0.5)*25);
        }
        ctx.stroke();
        // secondary branch crack
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(40 + Math.random()*30, 50 + Math.random()*20);
        for (let i = 1; i < 5; i++) {
            ctx.lineTo(40 + i*12 + Math.random()*10, 50 + i*8 + (Math.random()-0.5)*20);
        }
        ctx.stroke();
    } else if (type === 'plate') {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, 128, 128);
        // bolt holes
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(16, 16, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(112, 16, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, 112, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(112, 112, 5, 0, Math.PI*2); ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    const w = type === 'oil' ? 3.5 : (type === 'crack' ? 2.5 : 0.8);
    const h = type === 'oil' ? 3 : (type === 'crack' ? 1.5 : 0.8);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotation;
    mesh.position.set(x, 0.02, z);
    mesh.renderOrder = 1;
    scene.add(mesh);
    bulletMarks.push({ mesh, life: Infinity });
}

function aabbOverlap(a,b){
    return Math.abs(a.x-b.x)<(a.w+b.w)/2 && Math.abs(a.z-b.z)<(a.d+b.d)/2;
}

//////////////////////////////////////////////////////////////
// ===== 建筑辅助函数 =====
//////////////////////////////////////////////////////////////

// helper: create a wall with a gap (for doorways)
// creates up to 2 wall segments around the gap
function createWallWithGaps(x,z,w,h,d,gaps,mat){
    // gaps: array of [localStart, localEnd] along the wall's long axis
    // For X-axis wall (d=0.8, thin), gap positions are in X
    // For Z-axis wall (w=0.8, thin), gap positions are in Z
    const wallMat=mat||matWall;
    const isX=w>d+0.5; // wall along X axis
    const length=isX?w:d;
    const sorted=[...gaps].sort((a,b)=>a[0]-b[0]);
    let cursor=isX?(x-w/2):(z-d/2); // start of wall
    for(const [gs,ge] of sorted){
        const segLen=gs-cursor;
        if(segLen>0.8){
            const segX=isX?cursor+segLen/2:x;
            const segZ=isX?z:cursor+segLen/2;
            const segW=isX?segLen:w;
            const segD=isX?d:segLen;
            const mesh=new THREE.Mesh(new THREE.BoxGeometry(segW,h,segD),wallMat);
            mesh.position.set(segX,h/2,segZ);
            mesh.castShadow=true; mesh.receiveShadow=true;
            scene.add(mesh); walls.push(mesh); addCollider(mesh,'wall');
        }
        cursor=ge;
    }
    const endPos=isX?(x+w/2):(z+d/2);
    const segLen=endPos-cursor;
    if(segLen>0.8){
        const segX=isX?cursor+segLen/2:x;
        const segZ=isX?z:cursor+segLen/2;
        const segW=isX?segLen:w;
        const segD=isX?d:segLen;
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(segW,h,segD),wallMat);
        mesh.position.set(segX,h/2,segZ);
        mesh.castShadow=true; mesh.receiveShadow=true;
        scene.add(mesh); walls.push(mesh); addCollider(mesh,'wall');
    }
}

// rooftop railing: 4 sides with posts, all vaultable
function createRailing(x,z,w,d,railingH,buildingH){
    const railMat=new THREE.MeshStandardMaterial({color:0x555555,metalness:0.8,roughness:0.7});
    const th=0.08;
    const railY=buildingH+railingH/2;
    // horizontal rails (4 sides)
    const sides=[
        [x,z-d/2,w,th],[x,z+d/2,w,th],
        [x-w/2,z,th,d],[x+w/2,z,th,d]
    ];
    for(const [sx,sz,sw,sd] of sides){
        const rail=new THREE.Mesh(new THREE.BoxGeometry(sw,th,sd),railMat);
        rail.position.set(sx,buildingH+railingH,sz);
        scene.add(rail); addCollider(rail,'halfwall',th);
    }
    // posts every 2m
    for(let i=0;i<=w;i+=2){
        const p1=new THREE.Mesh(new THREE.BoxGeometry(0.1,railingH,0.1),railMat);
        p1.position.set(x-w/2+i,railY,z-d/2); scene.add(p1); addCollider(p1,'wall',railingH);
        const p2=new THREE.Mesh(new THREE.BoxGeometry(0.1,railingH,0.1),railMat);
        p2.position.set(x-w/2+i,railY,z+d/2); scene.add(p2); addCollider(p2,'wall',railingH);
    }
    for(let i=0;i<=d;i+=2){
        const p1=new THREE.Mesh(new THREE.BoxGeometry(0.1,railingH,0.1),railMat);
        p1.position.set(x-w/2,railY,z-d/2+i); scene.add(p1); addCollider(p1,'wall',railingH);
        const p2=new THREE.Mesh(new THREE.BoxGeometry(0.1,railingH,0.1),railMat);
        p2.position.set(x+w/2,railY,z-d/2+i); scene.add(p2); addCollider(p2,'wall',railingH);
    }
}

// staircase for offices
function createStaircase(x,z,width,totalH,depth,startY){
    if(!startY)startY=0;
    const steps=12, stepH=totalH/steps, stepD=depth/steps;
    const stepMat=new THREE.MeshStandardMaterial({color:0x5a5a5a,roughness:0.9});
    for(let i=0;i<steps;i++){
        const step=new THREE.Mesh(new THREE.BoxGeometry(width,stepH,stepD),stepMat);
        step.position.set(x,startY+i*stepH+stepH/2,z-i*stepD);
        step.castShadow=true; step.receiveShadow=true;
        scene.add(step);
    }
    // store stair slope data for player movement
    stairs.push({
        minX:x-width/2, maxX:x+width/2,
        minZ:z-depth, maxZ:z,
        startY:startY, totalH:totalH,
        startZ:z, depth:depth
    });
}

// steel platform inside factories
function createSteelPlatform(x,z,w,d,floorY){
    const platMat=new THREE.MeshStandardMaterial({color:0x4a5568,metalness:0.3,roughness:0.7});
    const plat=new THREE.Mesh(new THREE.BoxGeometry(w,0.2,d),platMat);
    plat.position.set(x,floorY,z);
    plat.castShadow=true; plat.receiveShadow=true;
    scene.add(plat);
    const invCol=new THREE.Mesh(new THREE.BoxGeometry(w,0.2,d),new THREE.MeshBasicMaterial({visible:false}));
    invCol.position.set(x,floorY,z);
    scene.add(invCol); walls.push(invCol); addCollider(invCol,'platform',0.2);
    // support legs at 4 corners
    for(let i=-1;i<=1;i+=2){
        for(let j=-1;j<=1;j+=2){
            const leg=new THREE.Mesh(new THREE.BoxGeometry(0.15,floorY,0.15),matPlatform);
            leg.position.set(x+i*w/2,floorY/2,z+j*d/2);
            scene.add(leg); addCollider(leg,'wall',floorY);
        }
    }
}

// warehouse shelving unit
function createShelvingUnit(x,z,w,h,d){
    const shelfMat=new THREE.MeshStandardMaterial({color:0x5a4a3a,roughness:0.9});
    const layers=4;
    for(let i=0;i<layers;i++){
        const shelf=new THREE.Mesh(new THREE.BoxGeometry(w,0.1,d),shelfMat);
        shelf.position.set(x,(i+1)*(h/layers),z);
        shelf.castShadow=true; shelf.receiveShadow=true;
        scene.add(shelf);
    }
    // 4 vertical posts
    for(let i=-1;i<=1;i+=2){
        for(let j=-1;j<=1;j+=2){
            const post=new THREE.Mesh(new THREE.BoxGeometry(0.1,h,0.1),shelfMat);
            post.position.set(x+i*w/2,h/2,z+j*d/2);
            scene.add(post); addCollider(post,'wall',h);
        }
    }
}

// outdoor cover objects (containers, tire stacks)
function createOutdoorCover(x,z){
    // shipping container
    const contMat=new THREE.MeshStandardMaterial({color:0x3d4f3d,roughness:0.9});
    const container=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.8,6),contMat);
    container.position.set(x,1.4,z);
    container.castShadow=true; container.receiveShadow=true;
    scene.add(container); addCollider(container,'wall',2.8);
    // barrel cluster nearby
    for(let i=0;i<3;i++){
        createBarrel(x+3+Math.random()*2,z+(i-1)*1.5);
    }
}

//////////////////////////////////////////////////////////////
// ===== 建筑类型 =====
//////////////////////////////////////////////////////////////

function createFactory(bx,bz,w,d){
    const h=12+Math.floor(Math.random()*4);
    const hw=w/2,hd=d/2;
    const gap=8; // door width
    // North wall (z=-hd): gap at center
    createWallWithGaps(bx,bz-hd,w,h,0.8,[[bx-hw+gap, bx-hw+2*gap]],matFactoryWall);
    // South wall (z=hd): full
    createWall(bx,bz+hd,w,h,0.8,matFactoryWall);
    // West wall (x=-hw): gap at center
    createWallWithGaps(bx-hw,bz,0.8,h,d,[[bz-hd+gap, bz-hd+2*gap]],matFactoryWall);
    // East wall (x=hw): gap at center
    createWallWithGaps(bx+hw,bz,0.8,h,d,[[bz-hd+gap, bz-hd+2*gap]],matFactoryWall);
    // ceiling
    createCeiling(bx,bz,w,d,h);
    // internal steel platforms
    createSteelPlatform(bx-3,bz-hd*0.3,w*0.5,d*0.35,4);
    createSteelPlatform(bx+3,bz+hd*0.3,w*0.45,d*0.35,8);
    // rooftop railing
    createRailing(bx,bz,w,d,1.2,h);
    // rooftop cover: AC units, vents
    for(let i=0;i<3;i++){
        const ac=new THREE.Mesh(new THREE.BoxGeometry(3,2+Math.random(),2),matRoofVent);
        ac.position.set(bx-hw*0.4+i*hw*0.4,h+1,bz+hd*0.2);
        ac.castShadow=true; scene.add(ac); addCollider(ac,'wall',4);
    }
    // internal machines (cover)
    for(let i=0;i<4;i++){
        const mx=bx+(Math.random()-0.5)*w*0.7;
        const mz=bz+(Math.random()-0.5)*d*0.7;
        const machine=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*2,2.5,3+Math.random()*2),matCrate);
        machine.position.set(mx,1.25,mz);
        machine.castShadow=true; machine.receiveShadow=true;
        scene.add(machine); addCollider(machine,'wall',2.5);
    }
    // fluorescent lights
    for(let lx=-hw+5;lx<hw;lx+=10){
        for(let lz=-hd+5;lz<hd;lz+=10){
            createFluorescentTube(bx+lx,h-0.8,bz+lz);
        }
    }
    rooms.push({x:bx,z:bz,w:w,d:d,_type:'factory',_h:h,rooftopY:h});
}

function createOffice(bx,bz,w,d){
    const h=8+Math.floor(Math.random()*3);
    const hw=w/2,hd=d/2;
    const gap=3; // main door
    // North: full wall (back of building)
    createWall(bx,bz-hd,w,h,0.8,matOfficeWall);
    // South: main entrance (gap at center)
    createWallWithGaps(bx,bz+hd,w,h,0.8,[[bx-gap,bx+gap]],matOfficeWall);
    // West: side door
    createWallWithGaps(bx-hw,bz,0.8,h,d,[[bz+hd*0.3,bz+hd*0.3+3]],matOfficeWall);
    // East: full
    createWall(bx+hw,bz,0.8,h,d,matOfficeWall);
    // ceiling
    createCeiling(bx,bz,w,d,h);
    // 2nd floor (at y=4)
    const floor2=new THREE.Mesh(new THREE.PlaneGeometry(w-1,d-1),matCeiling);
    floor2.rotation.x=-Math.PI/2;
    floor2.position.set(bx,h/2,bz);
    floor2.receiveShadow=true;
    scene.add(floor2);
    const f2c=new THREE.Mesh(new THREE.BoxGeometry(w-1,0.05,d-1),new THREE.MeshBasicMaterial({visible:false}));
    f2c.position.set(bx,h/2,bz);
    scene.add(f2c); walls.push(f2c); addCollider(f2c,'platform',0.05);
    // staircase (ground to 2nd floor)
    createStaircase(bx+hw-2,bz+hd-1,1.5,h/2,6);
    // staircase (2nd floor to rooftop)
    createStaircase(bx-hw+2,bz-hd+7,1.5,h/2,6,h/2);
    // interior halfwalls for rooms
    for(let i=0;i<2;i++){
        createHalfWall(bx+(i*2-1)*hw*0.5,bz,0.4,d*0.6);
    }
    // desks
    for(let i=0;i<3;i++){
        createDesk(bx-hw*0.3+i*hw*0.3,bz-hd*0.2);
    }
    // rooftop: low parapet wall (1m, vaultable)
    createRailing(bx,bz,w,d,1,h);
    // rooftop: water tank
    const tankMat=new THREE.MeshStandardMaterial({color:0x8899aa,metalness:0.6,roughness:0.5});
    const tank=new THREE.Mesh(new THREE.BoxGeometry(3,3,3),tankMat);
    tank.position.set(bx+hw*0.3,h+1.5,bz-hd*0.3);
    tank.castShadow=true; scene.add(tank); addCollider(tank,'wall',3);
    // rooftop: antenna
    const antMat=new THREE.MeshStandardMaterial({color:0x666666,metalness:0.9,roughness:0.3});
    const antPole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,5,8),antMat);
    antPole.position.set(bx-hw*0.3,h+2.5,bz+hd*0.3);
    scene.add(antPole); addCollider(antPole,'wall',5);
    // lights
    for(let lx=-hw+3;lx<hw;lx+=8){
        createFluorescentTube(bx+lx,h-0.8,bz);
    }
    rooms.push({x:bx,z:bz,w:w,d:d,_type:'office',_h:h,rooftopY:h});
}

function createWarehouse(bx,bz,w,d){
    const h=6+Math.floor(Math.random()*3);
    const hw=w/2,hd=d/2;
    const gap=6;
    // North: full
    createWall(bx,bz-hd,w,h,0.8,matWarehouseWall);
    // South: loading dock gap
    createWallWithGaps(bx,bz+hd,w,h,0.8,[[bx-gap,bx+gap]],matWarehouseWall);
    // West: entrance
    createWallWithGaps(bx-hw,bz,0.8,h,d,[[bz-hd*0.3,bz-hd*0.3+5]],matWarehouseWall);
    // East: full
    createWall(bx+hw,bz,0.8,h,d,matWarehouseWall);
    // ceiling with beams
    createCeiling(bx,bz,w,d,h);
    // ceiling beams
    for(let i=-1;i<=1;i+=2){
        const beam=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,d*0.9),matCrate);
        beam.position.set(bx+i*hw*0.33,h-0.05,bz);
        scene.add(beam);
    }
    // shelving units (4-6 rows)
    const shelfCount=4+Math.floor(Math.random()*3);
    for(let i=0;i<shelfCount;i++){
        const sx=bx-hw*0.7+(i+1)*w*0.7/shelfCount;
        createShelvingUnit(sx,bz,1.5,4,8);
    }
    // loading dock (south side)
    const dockX=bx, dockZ=bz+hd+2;
    createPlatform(dockX,dockZ,6,3,1.2);
    createRamp(dockX,dockZ-3,6,'z',1.2);
    // lights
    for(let lx=-hw+5;lx<hw;lx+=10){
        createFluorescentTube(bx+lx,h-0.8,bz);
    }
    rooms.push({x:bx,z:bz,w:w,d:d,_type:'warehouse',_h:h});
}

function createSkybridge(x1,z1,x2,z2,bridgeY){
    const dx=x2-x1, dz=z2-z1;
    const length=Math.sqrt(dx*dx+dz*dz);
    const midX=(x1+x2)/2, midZ=(z1+z2)/2;
    const angle=Math.atan2(dz,dx);
    const width=3;
    // bridge deck
    const deckMat=new THREE.MeshStandardMaterial({color:0x4a5058,metalness:0.4,roughness:0.7});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(width,0.15,length),deckMat);
    deck.position.set(midX,bridgeY,midZ);
    deck.rotation.y=angle;
    deck.castShadow=true; deck.receiveShadow=true;
    scene.add(deck);
    const dCol=new THREE.Mesh(new THREE.BoxGeometry(width,0.15,length),new THREE.MeshBasicMaterial({visible:false}));
    dCol.position.set(midX,bridgeY,midZ);
    dCol.rotation.y=angle;
    scene.add(dCol); walls.push(dCol); addCollider(dCol,'platform',0.15);
    // side rails
    const railMat=new THREE.MeshStandardMaterial({color:0x555555,metalness:0.8,roughness:0.7});
    for(let s=-1;s<=1;s+=2){
        const railX=midX+Math.cos(angle+Math.PI/2)*width/2*s;
        const railZ=midZ+Math.sin(angle+Math.PI/2)*width/2*s;
        const rail=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,length),railMat);
        rail.position.set(railX,bridgeY+0.5,railZ);
        rail.rotation.y=angle;
        scene.add(rail); addCollider(rail,'halfwall',0.08);
        // posts
        for(let p=0;p<length;p+=3){
            const t=p/length-0.5;
            const px=midX+Math.cos(angle)*t*length+Math.cos(angle+Math.PI/2)*width/2*s;
            const pz=midZ+Math.sin(angle)*t*length+Math.sin(angle+Math.PI/2)*width/2*s;
            const post=new THREE.Mesh(new THREE.BoxGeometry(0.08,1,0.08),railMat);
            post.position.set(px,bridgeY+0.25,pz);
            scene.add(post); addCollider(post,'wall',1);
        }
    }
    // support column in middle
    const colMat=new THREE.MeshStandardMaterial({color:0x444444,metalness:0.5,roughness:0.8});
    const col=new THREE.Mesh(new THREE.BoxGeometry(0.5,bridgeY,0.5),colMat);
    col.position.set(midX,bridgeY/2,midZ);
    scene.add(col); addCollider(col,'wall',bridgeY);
}

//////////////////////////////////////////////////////////////
// ===== 城市街区布局 =====
//////////////////////////////////////////////////////////////

function generateCityBlock(){
    const B=[
        // NW: factory + warehouse
        {t:'factory',x:-100,z:-100,rot:0},
        {t:'warehouse',x:-40,z:-120,rot:1},
        // NE: office + warehouse
        {t:'office',x:100,z:-100,rot:0},
        {t:'warehouse',x:60,z:-50,rot:0},
        // SW: factory + office
        {t:'factory',x:-100,z:100,rot:0},
        {t:'office',x:-50,z:60,rot:1},
        // SE: warehouse + office
        {t:'warehouse',x:80,z:100,rot:1},
        {t:'office',x:140,z:60,rot:0}
    ];
    const built=[];
    for(const b of B){
        let w,d;
        if(b.t==='factory'){w=30;d=50;}
        else if(b.t==='office'){w=20;d=30;}
        else{w=25;d=40;}
        if(b.rot){const tmp=w;w=d;d=tmp;} // swap for 90° rotation
        if(b.t==='factory')createFactory(b.x,b.z,w,d);
        else if(b.t==='office')createOffice(b.x,b.z,w,d);
        else createWarehouse(b.x,b.z,w,d);
        built.push({x:b.x,z:b.z,w,d,t:b.t});
    }
    // skybridges
    createSkybridge(built[0].x,built[0].z+25,built[1].x,built[1].z-20,8);
    createSkybridge(built[2].x+10,built[2].z-15,built[3].x-12,built[3].z-20,6);
    createSkybridge(built[4].x,built[4].z+25,built[6].x-12,built[6].z,10);
    // outdoor cover at corners
    createOutdoorCover(-150,-150);
    createOutdoorCover(150,-150);
    createOutdoorCover(-150,150);
    createOutdoorCover(150,150);
    // barrels scattered around
    for(let i=0;i<12;i++){
        const bx=(Math.random()-0.5)*300;
        const bz=(Math.random()-0.5)*300;
        createBarrel(bx,bz);
    }
    // env decals
    for(let i=0;i<8;i++){
        createEnvDecal('oil',(Math.random()-0.5)*300,(Math.random()-0.5)*300);
    }
    for(let i=0;i<6;i++){
        createEnvDecal('crack',(Math.random()-0.5)*300,(Math.random()-0.5)*300,Math.random()*Math.PI);
    }
}

generateCityBlock();

//////////////////////////////////////////////////////////////
// ===== 商店标记 =====
//////////////////////////////////////////////////////////////

const shopLocation={x:0,z:0}; // center of map

// visual shop marker (glowing beacon)
const shopMarkerGeo=new THREE.CylinderGeometry(1.5,1.5,0.5,8);
const shopMarkerMat=new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0xff8800,emissiveIntensity:0.8});
const shopMarker=new THREE.Mesh(shopMarkerGeo,shopMarkerMat);
shopMarker.position.set(shopLocation.x,0.25,shopLocation.z);
shopMarker.castShadow=true;
scene.add(shopMarker);

// shop pillar (tall visible marker)
const pillarGeo=new THREE.CylinderGeometry(0.3,0.4,8,8);
const pillarMat=new THREE.MeshStandardMaterial({color:0xffcc00,emissive:0x442200,emissiveIntensity:0.5});
const pillar=new THREE.Mesh(pillarGeo,pillarMat);
pillar.position.set(shopLocation.x,4,shopLocation.z);
scene.add(pillar);

// rotating beacon light
const shopLight=new THREE.PointLight(0xffcc00,3,40);
shopLight.position.set(shopLocation.x,8,shopLocation.z);
scene.add(shopLight);

//////////////////////////////////////////////////////////////
// ===== 飘尘粒子系统 =====
//////////////////////////////////////////////////////////////

const dustCount = 150;
const dustSystems = [];

// create dust in open areas between buildings (4-6 systems)
for (let di = 0; di < 5; di++) {
    const dx = (di < 4) ? (di % 2 === 0 ? -80 : 80) : 0;
    const dz = (di < 4) ? (di < 2 ? -80 : 80) : 0;
    const dustW = 80, dustD = 80;

    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVels = [];

    for (let i = 0; i < dustCount; i++) {
        dustPositions[i*3]   = (Math.random()-0.5) * dustW;
        dustPositions[i*3+1] = Math.random() * 6 + 1;
        dustPositions[i*3+2] = (Math.random()-0.5) * dustD;
        dustVels.push({
            x: (Math.random()-0.5) * 0.1,
            y: (Math.random()-0.5) * 0.05,
            z: (Math.random()-0.5) * 0.1,
            phase: Math.random() * Math.PI * 2
        });
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const dustMat = new THREE.PointsMaterial({
        color: 0xe8e0d5,
        size: 0.15,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
    });

    const dustSys = new THREE.Points(dustGeo, dustMat);
    dustSys.position.set(dx, 0, dz);
    scene.add(dustSys);

    dustSystems.push({
        system: dustSys,
        velocities: dustVels,
        count: dustCount,
        halfW: dustW * 0.4,
        halfD: dustD * 0.45,
        maxY: 6
    });
}

// Keep backward compat refs (first system)
const dustSystem = dustSystems.length > 0 ? dustSystems[0].system : null;
const dustVelocities = dustSystems.length > 0 ? dustSystems[0].velocities : [];

//////////////////////////////////////////////////////////////
// ===== 排气蒸汽系统 =====
//////////////////////////////////////////////////////////////

const steamSystems = [];

// create steam vents near factory buildings
const factoryBuildings = rooms.filter(r => r._type === 'factory');
for (let si = 0; si < Math.min(3, factoryBuildings.length); si++) {
    const fb = factoryBuildings[si];
    const ventX = fb.x + (Math.random() - 0.5) * fb.w * 0.7;
    const ventZ = fb.z + (Math.random() - 0.5) * fb.d * 0.7;

    const steamCount = 20;
    const steamGeo = new THREE.BufferGeometry();
    const steamPositions = new Float32Array(steamCount * 3);
    const steamLife = new Float32Array(steamCount);

    for (let i = 0; i < steamCount; i++) {
        steamPositions[i*3] = 0; steamPositions[i*3+1] = 0; steamPositions[i*3+2] = 0;
        steamLife[i] = -1;
    }

    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3));

    const steamMat = new THREE.PointsMaterial({
        color: 0xd0d0d8,
        size: 0.35,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
    });

    const steamSystem = new THREE.Points(steamGeo, steamMat);
    steamSystem.position.set(ventX, 0.5, ventZ);
    scene.add(steamSystem);

    steamSystems.push({
        system: steamSystem,
        life: steamLife,
        count: steamCount,
        timer: 0,
        emitting: false
    });
}

console.log('[SCENE] buildings:', rooms.length, 'dust systems:', dustSystems.length, 'steam systems:', steamSystems.length);

//////////////////////////////////////////////////////////////
// ===== 地图边界墙 =====
//////////////////////////////////////////////////////////////

function createBoundaryWall(x,y,z,w,h,d){
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w,h,d),
        new THREE.MeshBasicMaterial({visible:false})
    );
    wall.position.set(x,y,z);
    scene.add(wall);
    walls.push(wall);
    addCollider(wall, 'boundary');
}

// left
createBoundaryWall(-200,10,0,4,20,400);
// right
createBoundaryWall(200,10,0,1,20,400);
// front
createBoundaryWall(0,10,-200,400,20,1);
// back
createBoundaryWall(0,10,200,400,20,1);
//////////////////////////////////////////////////////////////
// ===== 枪口火焰 =====
//////////////////////////////////////////////////////////////

const muzzle = new THREE.PointLight(0xffaa33,0,8);
camera.add(muzzle);
muzzle.position.set(0,0,-1);
//////////////////////////////////////////////////////////////
// ===== 爆炸碎片对象池 =====
//////////////////////////////////////////////////////////////

for(let i=0;i<40;i++){

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.25,0.25,0.25),
        new THREE.MeshStandardMaterial({
            color:0x552200,
            emissive:0x221100
        })
    );

    mesh.visible = false;

    scene.add(mesh);

    explosionFragments.push({
        mesh,
        active:false,
        velocity:new THREE.Vector3(),
        life:0
    });
}

const raycaster = new THREE.Raycaster();
const enemyLaserGeom =
new THREE.BufferGeometry();

const enemyLaser =
new THREE.Line(

    enemyLaserGeom,

    new THREE.LineBasicMaterial({
        color:0xff0000
    })
);

//////////////////////////////////////////////////////////////
// ===== 主循环 =====
//////////////////////////////////////////////////////////////

let footstepTimer = 0;
let wasAirborne = false;

const tempForward = new THREE.Vector3();
const tempRight = new THREE.Vector3();
const tempV = new THREE.Vector3();
const tempMove = new THREE.Vector3();
const tempNext = new THREE.Vector3();
const tempMouse = new THREE.Vector2();
const tempLook = new THREE.Vector3();
const tempScreen = new THREE.Vector3();
const tempExplosionPos = new THREE.Vector3();
const tempLinePoints = [
    new THREE.Vector3(),
    new THREE.Vector3()
];

enemyLaser.visible = false;

scene.add(enemyLaser);

let globalTime=0;
let prev=performance.now();
