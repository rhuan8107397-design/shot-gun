"use strict";
//////////////////////////////////////////////////////////////
// ===== 武器系统 =====
//////////////////////////////////////////////////////////////

const weapons=[
{ // 0: Pistol
name:'手枪',mag:15,baseMag:15,ammo:15,reserve:60,
damage:28,baseDamage:28,
spread:0.005,recoil:0.03,
wave:'square',fireRate:.3,baseFireRate:.3,auto:false,
chBase:4,chRecoil:3,chMax:15,
speedMul:1.0,reloadTime:1.0,adsZoom:0,pellets:1,price:0
},
{ // 1: Melee
name:'近战',mag:999,baseMag:999,ammo:999,reserve:0,
damage:70,baseDamage:70,
spread:0,recoil:0.02,
wave:'sine',fireRate:.6,baseFireRate:.6,auto:false,
chBase:0,chRecoil:0,chMax:0,
speedMul:1.0,reloadTime:0,adsZoom:0,pellets:1,price:0
},
{ // 2: Rifle
name:'步枪',mag:30,baseMag:30,ammo:30,reserve:120,
damage:26,baseDamage:26,
spread:0.01,recoil:0.06,
wave:'sawtooth',fireRate:.1,baseFireRate:.1,auto:true,
chBase:8,chRecoil:4,chMax:25,
speedMul:0.85,reloadTime:2.2,adsZoom:0.35,pellets:1,price:800
},
{ // 3: Shotgun
name:'散弹枪',mag:8,baseMag:8,ammo:8,reserve:40,
damage:15,baseDamage:15,
spread:0.06,recoil:0.12,
wave:'triangle',fireRate:.75,baseFireRate:.75,auto:false,
chBase:20,chRecoil:8,chMax:40,
speedMul:0.8,reloadTime:2.8,adsZoom:0,pellets:6,price:600
},
{ // 4: Sniper
name:'狙击枪',mag:5,baseMag:5,ammo:5,reserve:20,
damage:120,baseDamage:120,
spread:0.001,recoil:0.15,
wave:'sine',fireRate:1.5,baseFireRate:1.5,auto:false,
chBase:2,chRecoil:4,chMax:8,
speedMul:0.7,reloadTime:3.2,adsZoom:0.6,pellets:1,price:1200
},
{ // 5: SMG
name:'冲锋枪',mag:40,baseMag:40,ammo:40,reserve:200,
damage:18,baseDamage:18,
spread:0.025,recoil:0.04,
wave:'square',fireRate:.06,baseFireRate:.06,auto:true,
chBase:12,chRecoil:3,chMax:30,
speedMul:0.9,reloadTime:1.8,adsZoom:0.15,pellets:1,price:1000
},
{ // 6: Grenade
name:'手雷',mag:1,baseMag:1,ammo:1,reserve:3,
damage:100,baseDamage:100,
spread:0,recoil:0.01,
wave:'sine',fireRate:999,baseFireRate:999,auto:false,
chBase:8,chRecoil:0,chMax:8,
speedMul:1.0,reloadTime:0,adsZoom:0,pellets:1,price:0
}
];

// player weapon inventory
const playerWeapons={
ownedPrimaries:[true,false,false,false], // Rifle, Shotgun, Sniper, SMG (Rifle free at start)
primarySlots:[2,-1], // weapon indices in primary slots, -1=empty
currentPrimary:0 // 0 or 1, which slot is active
};
// crosshair color config
const crosshairConfig={color:'#ffffff',outlineColor:'#000000',outlineWidth:1,opacity:1.0,dotColor:'#ffffff',dotOpacity:1.0};
(function(){
    const saved=localStorage.getItem('fps_crosshair');
    if(saved){try{Object.assign(crosshairConfig,JSON.parse(saved));}catch(e){}}
})();
function saveCrosshairConfig(){localStorage.setItem('fps_crosshair',JSON.stringify(crosshairConfig));}

// cached crosshair DOM refs
const chTop=document.querySelector('.ch-top');
const chBottom=document.querySelector('.ch-bottom');
const chLeft=document.querySelector('.ch-left');
const chRight=document.querySelector('.ch-right');
const chCenter=document.querySelector('.ch-center');
const chCircle=document.getElementById('crosshairCircle');
const chRoot=document.getElementById('crosshair');

let crosshairSpread=0;
let crosshairTarget=0;
let firePenalty=0;
let lastFireTime=0;

function applyCrosshairStyle(){
    chRoot.style.setProperty('--ch-color',crosshairConfig.color);
    chRoot.style.setProperty('--ch-outline',crosshairConfig.outlineColor);
    chRoot.style.opacity=crosshairConfig.opacity;
}

function updateCrosshair(){
    applyCrosshairStyle();
}

let currentWeapon=2; // start with rifle (free primary)
const primaryMap=[2,3,4,5]; // Rifle, Shotgun, Sniper, SMG
function isPrimary(wid){return wid>=2&&wid<=5;}
function isDefaultOwned(wid){return wid===0||wid===1||wid===6;}

updateCrosshair();
let reloading=false;
let fireCooldown=0;
let recoilX = 0;
let recoilY = 0;
let adsLerp = 0;

function switchWeapon(id){

if(
    paused ||
    gameOver ||
    player.sliding ||
    player.slideStunTimer > 0
)return;

if(grenadeState==='charging'){
    cancelCharge();
}

if(switchingWeapon)return;
if(currentWeapon===id)return;

// check if player owns this weapon
if(isPrimary(id)&&!playerWeapons.ownedPrimaries[primaryMap.indexOf(id)])return;

switchingWeapon=true;

const oldModel=currentWeaponModel;

let down=0;

const out=setInterval(()=>{

oldModel.position.y-=0.08;

down+=0.08;

if(down>=1){

clearInterval(out);

oldModel.visible=false;

currentWeapon=id;

// melee and grenade: disable ADS
if(id===1||id===6)player.ads=false;

// update primary slot tracking
const pi=primaryMap.indexOf(id);
if(pi>=0){
    if(playerWeapons.primarySlots[0]===id)playerWeapons.currentPrimary=0;
    else if(playerWeapons.primarySlots[1]===id)playerWeapons.currentPrimary=1;
}

updateHUD();
updateCrosshair();

const newModel=weaponModels[id];

currentWeaponModel=newModel;

newModel.visible=true;
newModel.position.y=-1.3;

const inn=setInterval(()=>{

newModel.position.y+=(weaponSwitchTargetY-newModel.position.y)*0.25;

if(Math.abs(newModel.position.y-weaponSwitchTargetY)<0.02){

newModel.position.y=weaponSwitchTargetY;

clearInterval(inn);

switchingWeapon=false;
}

},16);
}

},16);
}

// cycle primary weapons
function cyclePrimary(){
    if(paused||gameOver||player.sliding||player.slideStunTimer>0)return;
    if(switchingWeapon)return;
    // if current weapon is not a primary, switch to last used primary
    if(!isPrimary(currentWeapon)){
        const wid=playerWeapons.primarySlots[playerWeapons.currentPrimary];
        if(wid>=0)switchWeapon(wid);
        return;
    }
    // if we have 2 primaries, swap between them
    if(playerWeapons.primarySlots[0]>=0&&playerWeapons.primarySlots[1]>=0){
        playerWeapons.currentPrimary=playerWeapons.currentPrimary===0?1:0;
        switchWeapon(playerWeapons.primarySlots[playerWeapons.currentPrimary]);
    }
}
// ===== 命中/击杀反馈系统 =====
let hitMarkerTimer = 0;
let hitMarkerType = 'none';
const killXEl = document.getElementById('killX');
const killFeed = document.getElementById('killFeed');
let killFeedItems = [];
let lastKillTime = 0;
let killCombo = 0;

function triggerHitMarker(type) {
  hitMarkerType = type;
  hitMarkerTimer = type === 'body' ? 0.08 : type === 'head' ? 0.12 : 0.15;

  if (type === 'body') {
    [chTop, chBottom, chLeft, chRight].forEach(l => l.classList.add('hit-body'));
    chCenter.classList.add('hit-body');
  } else if (type === 'head') {
    [chTop, chBottom, chLeft, chRight].forEach(l => l.classList.add('hit-head'));
    chCenter.classList.add('hit-head');
  } else if (type === 'kill') {
    [chTop, chBottom, chLeft, chRight].forEach(l => l.style.opacity = '0');
    chCenter.style.opacity = '0';
    killXEl.classList.add('active');
  }
}

function updateHitMarker(dt) {
  if (hitMarkerTimer <= 0) return;
  hitMarkerTimer -= dt;
  if (hitMarkerTimer <= 0) {
    [chTop, chBottom, chLeft, chRight].forEach(l => {
      l.classList.remove('hit-body', 'hit-head');
      l.style.opacity = '1';
    });
    chCenter.classList.remove('hit-body', 'hit-head');
    chCenter.style.background = crosshairConfig.color;
    chCenter.style.opacity = crosshairConfig.opacity;
    killXEl.classList.remove('active');
    hitMarkerType = 'none';
  }
}

function showKillIcon(enemyType) {
  const now = performance.now();
  if (now - lastKillTime < 1000) {
    killCombo++;
    const lastItem = killFeedItems[killFeedItems.length - 1];
    if (lastItem) {
      lastItem.combo = killCombo;
      lastItem.life = 1.5;
      const comboEl = lastItem.el.querySelector('.kf-combo');
      if (comboEl) {
        comboEl.textContent = 'x' + killCombo;
        comboEl.style.animation = 'none';
        comboEl.offsetHeight;
        comboEl.style.animation = 'comboPop 0.2s ease-out';
      }
      return;
    }
  } else {
    killCombo = 1;
  }
  lastKillTime = now;

  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(0,0,0,0.6);border-left:3px solid #ffcc00;border-radius:0 4px 4px 0;font-size:14px;color:white;transform:translateX(100px);opacity:0;transition:all 0.2s ease-out;';

  const typeLabel = enemyType === 'elite' ? 'ELITE' : enemyType === 'boss' ? 'BOSS' : 'KILL';
  const typeColor = enemyType === 'elite' ? '#ffaa00' : enemyType === 'boss' ? '#aa00ff' : '#ffcc00';

  el.innerHTML = '<span style="font-size:18px;">💀</span><span style="color:' + typeColor + ';font-weight:bold;">' + typeLabel + '</span><span class="kf-combo" style="color:#ffcc00;font-weight:bold;margin-left:4px;"></span>';

  killFeed.appendChild(el);

  requestAnimationFrame(function() {
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  });

  killFeedItems.push({ el: el, life: 1.5, combo: 1 });
}

function updateKillFeed(dt) {
  for (var i = killFeedItems.length - 1; i >= 0; i--) {
    var item = killFeedItems[i];
    item.life -= dt;
    if (item.life <= 0) {
      item.el.style.transform = 'translateY(-20px)';
      item.el.style.opacity = '0';
      setTimeout(function(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }, 300, item.el);
      killFeedItems.splice(i, 1);
    }
  }
}

function playKillConfirmSound(enemyType) {
  var ctx = getAudio();
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);

  if (enemyType === 'elite' || enemyType === 'boss') {
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 220;
    gain2.gain.setValueAtTime(0.2, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.3);
  }
}

function updateHUD(){

const w=weapons[currentWeapon];

weaponEl.textContent=w.name;
ammoEl.textContent=w.ammo;
reserveEl.textContent=w.reserve;
}

updateHUD();
//////////////////////////////////////////////////////////////
// ===== 武器模型 =====
//////////////////////////////////////////////////////////////

const weaponGroup = new THREE.Group();

camera.add(weaponGroup);

// 标准化材质系统（全局共享）
const matMetal = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    metalness: 0.85,
    roughness: 0.35
});
const matPolymer = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.0,
    roughness: 0.92
});
const matWood = new THREE.MeshStandardMaterial({
    color: 0x5c3a21,
    metalness: 0.0,
    roughness: 0.75
});
const matGlow = new THREE.MeshBasicMaterial({
    color: 0x00ffcc
});

function createPistol(){
    const g = new THREE.Group();

    // 机匣/下枪身
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.45), matPolymer);
    frame.position.set(0, -0.05, 0.1);
    frame.castShadow = true;
    frame.name = 'hide_in_ads';
    g.add(frame);

    // 握把（后倾15°）
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.18), matPolymer);
    grip.position.set(0, -0.28, 0.15);
    grip.rotation.x = Math.PI * 0.083;
    grip.castShadow = true;
    grip.name = 'hide_in_ads';
    g.add(grip);

    // 滑套
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.55), matMetal);
    slide.position.set(0, 0.02, -0.05);
    slide.castShadow = true;
    slide.name = 'slide';
    slide.userData.adsRole = 'keep_in_ads';
    g.add(slide);

    // 枪管
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), matMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    barrel.name = 'keep_in_ads';
    g.add(barrel);

    // 扳机护圈（半环）
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI), matMetal);
    guard.position.set(0, -0.12, 0.22);
    guard.rotation.y = Math.PI / 2;
    guard.name = 'hide_in_ads';
    g.add(guard);

    // 扳机
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.03), matMetal);
    trigger.position.set(0, -0.12, 0.25);
    trigger.name = 'hide_in_ads';
    g.add(trigger);

    // 弹匣底座
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.16), matMetal);
    magBase.position.set(0, -0.48, 0.15);
    magBase.name = 'hide_in_ads';
    g.add(magBase);

    // 准星
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), matMetal);
    frontSight.position.set(0, 0.12, -0.32);
    frontSight.name = 'keep_in_ads';
    g.add(frontSight);

    // 照门
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), matMetal);
    rearSight.position.set(0, 0.12, 0.15);
    rearSight.name = 'keep_in_ads';
    g.add(rearSight);

    return g;
}

function createRifle(){
    const g = new THREE.Group();

    // 上机匣
    const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.65), matMetal);
    upperReceiver.position.set(0, 0, 0.1);
    upperReceiver.castShadow = true;
    upperReceiver.name = 'keep_in_ads';
    g.add(upperReceiver);

    // 下机匣/握把座
    const lowerReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.40), matPolymer);
    lowerReceiver.position.set(0, -0.22, 0.15);
    lowerReceiver.castShadow = true;
    lowerReceiver.name = 'hide_in_ads';
    g.add(lowerReceiver);

    // 握把（后倾10°）
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), matPolymer);
    grip.position.set(0, -0.42, 0.22);
    grip.rotation.x = Math.PI * 0.055;
    grip.castShadow = true;
    grip.name = 'hide_in_ads';
    g.add(grip);

    // 扳机护圈
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), matMetal);
    guard.position.set(0, -0.22, 0.35);
    guard.rotation.y = Math.PI / 2;
    guard.name = 'hide_in_ads';
    g.add(guard);

    // 弹匣
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.18), matPolymer);
    mag.position.set(0, -0.55, 0.28);
    mag.castShadow = true;
    mag.name = 'mag';
    mag.userData.adsRole = 'hide_in_ads';
    g.add(mag);

    // 弹匣底部圆头
    const magBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), matPolymer);
    magBottom.rotation.x = Math.PI / 2;
    magBottom.position.set(0, -0.78, 0.28);
    magBottom.name = 'hide_in_ads';
    g.add(magBottom);

    // 枪管
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), matMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.55);
    barrel.name = 'keep_in_ads';
    g.add(barrel);

    // 护木
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.55), matPolymer);
    handguard.position.set(0, -0.02, -0.35);
    handguard.castShadow = true;
    handguard.name = 'hide_in_ads';
    g.add(handguard);

    // 枪口装置
    const muzzleDevice = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), matMetal);
    muzzleDevice.rotation.x = Math.PI / 2;
    muzzleDevice.position.set(0, 0.02, -0.92);
    muzzleDevice.name = 'keep_in_ads';
    g.add(muzzleDevice);

    // 枪托（后上倾20°）
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.20, 0.45), matPolymer);
    stock.position.set(0, -0.05, 0.55);
    stock.rotation.x = -Math.PI * 0.11;
    stock.castShadow = true;
    stock.name = 'hide_in_ads';
    g.add(stock);

    // 枪托垫
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.24, 0.06), matPolymer);
    stockPad.position.set(0, -0.02, 0.78);
    stockPad.name = 'hide_in_ads';
    g.add(stockPad);

    // 瞄准镜底座
    const scopeBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.20), matMetal);
    scopeBase.position.set(0, 0.16, 0.05);
    scopeBase.name = 'hide_in_ads';
    g.add(scopeBase);

    // 瞄准镜筒
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 8), matMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.22, 0.05);
    scopeTube.name = 'keep_in_ads';
    g.add(scopeTube);

    // 瞄准镜目镜
    const scopeRear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), matPolymer);
    scopeRear.rotation.x = Math.PI / 2;
    scopeRear.position.set(0, 0.22, 0.20);
    scopeRear.name = 'keep_in_ads';
    g.add(scopeRear);

    // 瞄准镜物镜
    const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), matPolymer);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.22, -0.10);
    scopeFront.name = 'keep_in_ads';
    g.add(scopeFront);

    return g;
}

function createShotgun(){
    const g = new THREE.Group();

    // 机匣
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.30, 0.40), matMetal);
    receiver.position.set(0, 0, 0);
    receiver.castShadow = true;
    receiver.name = 'keep_in_ads';
    g.add(receiver);

    // 双管（左）
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.85, 8), matMetal);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.05, 0.02, -0.55);
    barrelL.name = 'keep_in_ads';
    g.add(barrelL);

    // 双管（右）
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.85, 8), matMetal);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.05, 0.02, -0.55);
    barrelR.name = 'keep_in_ads';
    g.add(barrelR);

    // 泵动护木（木质）
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.35), matWood);
    pump.position.set(0, -0.02, -0.40);
    pump.castShadow = true;
    pump.name = 'pump';
    pump.userData.adsRole = 'hide_in_ads';
    g.add(pump);

    // 枪托（木质，后倾18°）
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.50), matWood);
    stock.position.set(0, -0.02, 0.50);
    stock.rotation.x = -Math.PI * 0.10;
    stock.castShadow = true;
    stock.name = 'hide_in_ads';
    g.add(stock);

    // 枪托垫
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.26, 0.06), matPolymer);
    stockPad.position.set(0, 0, 0.76);
    stockPad.name = 'hide_in_ads';
    g.add(stockPad);

    // 扳机护圈
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16, Math.PI), matMetal);
    guard.position.set(0, -0.15, 0.22);
    guard.rotation.y = Math.PI / 2;
    guard.name = 'hide_in_ads';
    g.add(guard);

    // 照门
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), matMetal);
    rearSight.position.set(0, 0.18, 0.15);
    rearSight.name = 'keep_in_ads';
    g.add(rearSight);

    return g;
}

function createGrenadeVM(){
    const g = new THREE.Group();

    // 弹体
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x335511, metalness: 0.0, roughness: 0.92 })
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);

    // 顶部螺纹
    const topThread = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.03, 12),
        matMetal
    );
    topThread.rotation.x = Math.PI / 2;
    topThread.position.set(0, 0.10, 0);
    g.add(topThread);

    // 拉环
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.04, 0.008, 6, 12),
        matMetal
    );
    ring.position.set(0, 0.14, 0);
    g.add(ring);

    // 安全握片
    const spoon = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.08, 0.02),
        matPolymer
    );
    spoon.position.set(0, 0.03, 0.07);
    g.add(spoon);

    // 破片槽（3条环绕）
    for (let i = -1; i <= 1; i++) {
        const groove = new THREE.Mesh(
            new THREE.TorusGeometry(0.061, 0.003, 4, 16),
            matMetal
        );
        groove.position.set(i * 0.05, 0, 0);
        g.add(groove);
    }

    return g;
}

function createMelee(){
    const g = new THREE.Group();
    // blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.02), matMetal);
    blade.position.set(0, 0.1, -0.15);
    blade.castShadow = true;
    blade.name = 'keep_in_ads';
    g.add(blade);
    // handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), matPolymer);
    handle.position.set(0, -0.15, 0);
    handle.name = 'hide_in_ads';
    g.add(handle);
    // guard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), matMetal);
    guard.position.set(0, -0.04, 0);
    guard.name = 'hide_in_ads';
    g.add(guard);
    return g;
}

function createSniper(){
    const g = new THREE.Group();
    // body/receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.5), matMetal);
    receiver.position.set(0, 0, 0);
    receiver.castShadow = true;
    receiver.name = 'keep_in_ads';
    g.add(receiver);
    // long barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), matMetal);
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(0, 0.02, -0.7);
    barrel.name = 'keep_in_ads';
    g.add(barrel);
    // scope (large)
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), matMetal);
    scopeBody.rotation.x = Math.PI/2;
    scopeBody.position.set(0, 0.18, 0);
    scopeBody.name = 'keep_in_ads';
    g.add(scopeBody);
    // bipod
    const bipodL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), matPolymer);
    bipodL.position.set(-0.06, -0.28, -0.15);
    bipodL.name = 'hide_in_ads';
    g.add(bipodL);
    const bipodR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), matPolymer);
    bipodR.position.set(0.06, -0.28, -0.15);
    bipodR.name = 'hide_in_ads';
    g.add(bipodR);
    // stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.4), matPolymer);
    stock.position.set(0, -0.02, 0.45);
    stock.name = 'hide_in_ads';
    g.add(stock);
    return g;
}

function createSMG(){
    const g = new THREE.Group();
    // compact body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.35), matMetal);
    body.position.set(0, 0, 0);
    body.castShadow = true;
    body.name = 'keep_in_ads';
    g.add(body);
    // short barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), matMetal);
    barrel.rotation.x = Math.PI/2;
    barrel.position.set(0, 0.02, -0.28);
    barrel.name = 'keep_in_ads';
    g.add(barrel);
    // folding stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.25), matPolymer);
    stock.position.set(0, -0.04, 0.3);
    stock.name = 'hide_in_ads';
    g.add(stock);
    // grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), matPolymer);
    grip.position.set(0, -0.2, 0.15);
    grip.name = 'hide_in_ads';
    g.add(grip);
    // long mag
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.12), matPolymer);
    mag.position.set(0, -0.38, 0.1);
    mag.name = 'hide_in_ads';
    g.add(mag);
    return g;
}

const weaponModels = [
    createPistol(),
    createMelee(),
    createRifle(),
    createShotgun(),
    createSniper(),
    createSMG(),
    createGrenadeVM()
];

weaponModels.forEach(v => {
    v.position.set(0.45, -0.35, -0.9);
    v.scale.setScalar(1.15);
    weaponGroup.add(v);
    v.visible = false;
});

weaponModels[2].visible = true; // rifle visible by default

let currentWeaponModel = weaponModels[2];
let switchingWeapon = false;
let weaponSwitchTargetY = -0.35;

scene.add(camera);

//////////////////////////////////////////////////////////////
// ===== 音频 =====
//////////////////////////////////////////////////////////////

let audioCtx = null;

function getAudio(){

    if(!audioCtx){

        audioCtx = new(
            window.AudioContext ||
            window.webkitAudioContext
        )();
    }

    return audioCtx;
}

function sound(type){

const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();

if(type==='pickup'){
osc.type='triangle';
osc.frequency.setValueAtTime(300,audioCtx.currentTime);
osc.frequency.exponentialRampToValueAtTime(900,audioCtx.currentTime+.1);
}
else if(type==='hurt'){
osc.type='sawtooth';
osc.frequency.value=80;
}
else if(type==='kill'){
osc.type='square';
osc.frequency.value=50;
}
else{
const w=weapons[currentWeapon];
osc.type=w.wave;
osc.frequency.value=
currentWeapon===0?320:
currentWeapon===1?150:90;
}

gain.gain.setValueAtTime(.2,audioCtx.currentTime);
gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.15);

osc.connect(gain);
gain.connect(audioCtx.destination);

osc.start();
osc.stop(audioCtx.currentTime+.15);
}

function playExplosionSound(){

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';

    osc.frequency.setValueAtTime(
        80,
        audioCtx.currentTime
    );

    osc.frequency.exponentialRampToValueAtTime(
        30,
        audioCtx.currentTime + 0.5
    );

    gain.gain.setValueAtTime(
        0.4,
        audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.5
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playBossBoom(){

    const osc =
    audioCtx.createOscillator();

    const gain =
    audioCtx.createGain();

    osc.type='square';

    osc.frequency.setValueAtTime(
        60,
        audioCtx.currentTime
    );

    gain.gain.setValueAtTime(
        0.5,
        audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime+0.8
    );

    osc.connect(gain);

    gain.connect(audioCtx.destination);

    osc.start();

    osc.stop(audioCtx.currentTime+0.8);
}

function playVictoryHorn(){

    const osc =
    audioCtx.createOscillator();

    const gain =
    audioCtx.createGain();

    osc.type='square';

    osc.frequency.setValueAtTime(
        440,
        audioCtx.currentTime
    );

    osc.frequency.exponentialRampToValueAtTime(
        880,
        audioCtx.currentTime+0.6
    );

    gain.gain.setValueAtTime(
        0.4,
        audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime+0.6
    );

    osc.connect(gain);

    gain.connect(audioCtx.destination);

    osc.start();

    osc.stop(audioCtx.currentTime+0.6);
}

function playHeartbeat(){

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';

    osc.frequency.setValueAtTime(
        40,
        audioCtx.currentTime
    );

    osc.frequency.exponentialRampToValueAtTime(
        60,
        audioCtx.currentTime + 0.08
    );

    gain.gain.setValueAtTime(
        0.25,
        audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + 0.15
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function showCenterText(text,color='white',duration=600){

centerText.innerHTML=text;
centerText.style.color=color;
centerText.style.opacity=1;

setTimeout(()=>{

centerText.style.opacity=0;

},duration);
}

function playHeadshotSlowmoSound(){

    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();

    osc.type='sine';
    osc.frequency.value=1500;

    gain.gain.setValueAtTime(0.2,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime+0.12);
}

function triggerHeadshotSlowmo(){

    timeScale=0.2;

    recoilX+=0.05;
    recoilY+=(Math.random()-0.5)*0.03;

    whiteFlashOpacity=0.5;

    for(const edge of flashEdges){
        edge.style.opacity=0.5;
    }

    playHeadshotSlowmoSound();
}

function headshotEffect(){

const osc=
audioCtx.createOscillator();

const gain=
audioCtx.createGain();

osc.type='sine';

osc.frequency.value=1200;

gain.gain.value=0.3;

gain.gain.exponentialRampToValueAtTime(

0.001,

audioCtx.currentTime+0.08

);

osc.connect(gain);

gain.connect(audioCtx.destination);

osc.start();

osc.stop(audioCtx.currentTime+0.08);

showCenterText('HEADSHOT','gold',600);
}
//////////////////////////////////////////////////////////////
// ===== 射击 =====
//////////////////////////////////////////////////////////////

let meleeSide=0; // 0=left slash, 1=right slash
let meleeHolding=false;
let meleeHoldTimer=0;

document.addEventListener('mousedown',e=>{
if(e.button===0){

    mouseDown=true;

    if(currentWeapon===6){
        if(grenadeState==='idle'){
            startCharge();
        }
    }else if(currentWeapon===1){
        meleeHolding=true;
        meleeHoldTimer=0;
        meleeSide=meleeSide===0?1:0; // alternate
        meleeDoSlash('light');
    }else{
        shoot();
    }
}
if(e.button===2){
    if(currentWeapon===1){
        // melee heavy attack
        meleeDoSlash('heavy');
    }else if(!player.sprinting && !player.sliding){
        player.ads = !player.ads;
    }
}
});

document.addEventListener('mouseup',e=>{
if(e.button===0){
    mouseDown=false;
    meleeHolding=false;
    if(currentWeapon===6 && grenadeState==='charging'){
        releaseGrenade();
    }
}
});

function meleeDoSlash(type){
    if(fireCooldown>0)return;
    const w=weapons[1];
    const dmg=type==='heavy'?w.damage*2:w.damage;
    const range=type==='heavy'?3.0:2.5;
    const cd=type==='heavy'?1.2:0.5;
    fireCooldown=cd;

    const forward=tempForward;
    camera.getWorldDirection(forward);
    forward.y=0;
    const meleePos=tempV;
    meleePos.copy(camera.position);
    meleePos.addScaledVector(forward,range*0.6);
    meleePos.y-=0.5;

    // sweep side offset
    const sideOffset=type==='heavy'?0:(meleeSide===0?-0.8:0.8);
    const right=tempRight;
    right.set(-forward.z,0,forward.x);
    meleePos.addScaledVector(right,sideOffset);

    for(const enemy of enemies){
        if(!enemy.alive)continue;
        const dist=enemy.mesh.position.distanceTo(meleePos);
        if(dist<range){
            enemy.hp-=dmg;
            spawnDamageNumber(enemy.mesh.position,dmg,type==='heavy'?'headshot':'normal');
            enemy.body.material.color.set(0xffffff);
            enemy.flashTimer=0.06;
            recoilX+=type==='heavy'?0.06:0.03;
            if(enemy.hp<=0&&enemy.alive){
                enemy.alive=false;enemy.deadTimer=1;
                kills++;score+=type==='heavy'?150:100;
                scoreEl.textContent=score;
                spawnPickup(enemy.mesh.position);
                triggerHitMarker('kill');
                showKillIcon(enemy.type);
                playKillConfirmSound(enemy.type);
            }else{
                triggerHitMarker(type==='heavy'?'head':'body');
            }
            sound(type==='heavy'?'kill':'hurt');
            return;
        }
    }
    sound('hurt');
}

function meleeAttack(){
    // called from shoot() when currentWeapon===1 (legacy path)
    meleeDoSlash('light');
    meleeSide=meleeSide===0?1:0;
}

function updateMeleeHold(dt){
    if(!meleeHolding||currentWeapon!==1)return;
    meleeHoldTimer+=dt;
    if(meleeHoldTimer>=0.45&&fireCooldown<=0){
        meleeHoldTimer=0;
        meleeSide=meleeSide===0?1:0;
        meleeDoSlash('light');
    }
}

function shoot(){

if(
    paused ||
    gameOver ||
    reloading ||
    player.sprinting ||
    player.sliding ||
    player.slideStunTimer > 0
)return;

if(currentWeapon===6)return; // grenade uses charge mechanic instead

const w=weapons[currentWeapon];
if(fireCooldown>0)return;

fireCooldown = w.fireRate;

if(currentWeapon!==1 && w.ammo<=0){

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type='triangle';
    osc.frequency.value=800;

    gain.gain.value=0.1;

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime+0.05
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime+0.05);

    return;
}

if(currentWeapon!==1)w.ammo--;
updateHUD();

sound('gun');

recoilX +=
(Math.random()*0.02+0.01)
*
weapons[currentWeapon].recoil
*
(player.ads?4:8);

recoilY +=
(Math.random()-0.5)*0.02;

firePenalty += w.chRecoil;
firePenalty = Math.min(firePenalty, w.chMax);
lastFireTime = performance.now();

muzzle.color.set('#ffaa33');
muzzle.intensity=4;

currentWeaponModel.position.z = -0.5;

// 手枪滑套后坐动画
if (currentWeapon === 0) {
    const slide = currentWeaponModel.getObjectByName('slide');
    if (slide) {
        slide.position.z += 0.08;
        setTimeout(() => { slide.position.z -= 0.08; }, 80);
    }
}
// 步枪弹匣晃动
if (currentWeapon === 1) {
    const mag = currentWeaponModel.getObjectByName('mag');
    if (mag) {
        mag.rotation.z = 0.03;
        setTimeout(() => { mag.rotation.z = 0; }, 100);
    }
}

// use weapon's pellet count
const pellets = w.pellets||1;
// melee attack (short range, no projectiles)
if(currentWeapon===1){
    meleeAttack();
    return;
}

for(let i=0;i<pellets;i++){

const spread = player.ads
? w.spread*0.5
: w.spread;

tempMouse.set(
(Math.random()-.5)*spread,
(Math.random()-.5)*spread
);

const mouse = tempMouse;

raycaster.setFromCamera(mouse,camera);

aliveEnemyMeshes.length = 0;

for(const e of enemies){

if(e.alive){

aliveEnemyMeshes.push(e.mesh);
}
}

const enemyHits = raycaster.intersectObjects(
aliveEnemyMeshes,
true
);

const aliveBarrelMeshes = barrels
.filter(b=>b.alive)
.map(b=>b.mesh);

const barrelHits = raycaster.intersectObjects(
aliveBarrelMeshes,
true
);

let bossHit=[];

if(boss){

bossHit =
raycaster.intersectObject(
boss.mesh,
true
);
}

const wallHits = raycaster.intersectObjects(walls,false);

if(
    barrelHits.length &&
    (!wallHits.length || barrelHits[0].distance < wallHits[0].distance) &&
    (!enemyHits.length || barrelHits[0].distance < enemyHits[0].distance)
){

    const barrelHit = barrelHits[0];

    const barrel = barrels.find(b=>{

        if(!barrelHit.object)return false;

        return (
            b.mesh===barrelHit.object.parent ||
            b.mesh===barrelHit.object
        );
    });

    if(barrel){

        hitBarrel(barrel);
    }

    continue;
}

if(
boss &&
bossHit.length &&
(
!wallHits.length ||
bossHit[0].distance<
wallHits[0].distance
)
){

    const w=
    weapons[currentWeapon];

    let damage=w.damage;

    if(w.name==='散弹枪'){

        damage*=1.2;
    }

    boss.hp -= damage;

    spawnDamageNumber(
        bossHit[0].point,
        damage,
        'headshot'
    );

    recoilX +=
    w.recoil*.4;

    if(boss.hp<=0){

        if(bossHit.length>0 && bossHit[0].object.name==='head'){
            triggerHeadshotSlowmo();
        }

        boss.dead=true;

        recoilX += 0.08;
        recoilY += (Math.random() - 0.5) * 0.05;
        triggerHitMarker('kill');
        showKillIcon('boss');
        playKillConfirmSound('boss');

        score += 1000;

        scoreEl.textContent=score;

        for(let i=0;i<3;i++){

            const hpPos =
            tempNext;

            hpPos.copy(
                boss.mesh.position
            );

            hpPos.x += i*2;

            spawnSpecificPickup(
                hpPos,
                'hp'
            );

            const ammoPos =
            tempForward;

            ammoPos.copy(
                boss.mesh.position
            );

            ammoPos.z += i*2;

            spawnSpecificPickup(
                ammoPos,
                'ammo'
            );
        }
    }

    return;
}

if(enemyHits.length&&(!wallHits.length||enemyHits[0].distance<wallHits[0].distance)){

const hit = enemyHits[0];

const isHeadshot =
hit.object.name==='head';

let hitRoot = enemyHits[0].object;

while(
    hitRoot &&
    !enemies.some(e=>e.mesh===hitRoot)
){
    hitRoot = hitRoot.parent;
}

const enemy = enemies.find(
    e=>e.mesh===hitRoot
);

if(!enemy)continue;

if(enemy){

let damage = w.damage;
let damageNumberType = 'normal';

if(isHeadshot){

    if(enemy.type==='elite' && enemy.helmet){

        enemy.helmet = false;

        enemy.headVisual.material.color.set('#ffcccc');

        damage *= 1.2;

        damageNumberType = 'armor';

    }else{

        damage *= 2.5;

        damageNumberType = 'headshot';

        headshotEffect();
        recoilX += 0.04;
        recoilY += (Math.random() - 0.5) * 0.02;
        triggerHitMarker('head');
    }
} else {
    recoilX += 0.015;
    triggerHitMarker('body');
}

enemy.hp -= damage;

spawnDamageNumber(
    hit.point,
    damage,
    damageNumberType
);

const knock =
0.3 * damage / 10;

const knockDir = enemy.tempVec;

knockDir.subVectors(
enemy.mesh.position,
camera.position
);

knockDir.y=0;

knockDir.normalize();

const knockPos = enemy.moveVec;

knockPos.copy(enemy.mesh.position);

knockPos.x += knockDir.x * knock;
knockPos.z += knockDir.z * knock;

if(!collide(knockPos)){

enemy.mesh.position.copy(knockPos);
}

enemy.body.material.color.set(

enemy.type==='elite'
?0xffcc66
:0xffffff
);

enemy.flashTimer = 0.06;

if(enemy.hp<=0&&enemy.alive){

if(isHeadshot){
    triggerHeadshotSlowmo();
}

enemy.alive=false;
enemy.deadTimer=1;

// 击杀反馈
recoilX += enemy.type==='elite'?0.06:(enemy.type==='boss'?0.08:0.05);
recoilY += (Math.random()-0.5)*(enemy.type==='elite'?0.04:(enemy.type==='boss'?0.05:0.03));
triggerHitMarker('kill');
showKillIcon(enemy.type);
playKillConfirmSound(enemy.type);

kills++;

if(comboTimer>0){

combo++;

}else{

combo=1;
}

comboTimer=3;

bestCombo=Math.max(
bestCombo,
combo
);

comboText.style.opacity=1;

comboText.innerHTML=
`COMBO x${combo}`;

const gainScore = Math.floor(

(

100

+

(isHeadshot?50:0)

)

*

(1+combo*0.2)

);

score+=gainScore;

scoreEl.textContent=score;

sound('kill');

showCenterText('KILL +100','red',500);

if(enemy.type==='elite'){

    spawnSpecificPickup(
        enemy.mesh.position,
        'hp'
    );

    const ammoPos = tempNext;
    ammoPos.copy(enemy.mesh.position);
    ammoPos.x += 1;

    spawnSpecificPickup(
        ammoPos,
        'ammo'
    );

}else{

spawnPickup(enemy.mesh.position);
}
}
}
}
else if(wallHits.length){

if(
    wallHits[0].face &&
    wallHits[0].face.normal
){
    bulletMark(
        wallHits[0].point,
        wallHits[0].face.normal
    );
}
}
}
}

//////////////////////////////////////////////////////////////
// ===== 换弹 =====
//////////////////////////////////////////////////////////////

function reload(){

if(currentWeapon===6||currentWeapon===1)return;

const w=weapons[currentWeapon];

if(reloading)return;
if(w.ammo===w.mag)return;
if(w.reserve<=0)return;

reloading=true;

const reloadTime=(w.reloadTime||1.5)*1000*(1-0.15*player.upgrades.reload);
const soundDelay=reloadTime/1200*350;

[600,500,400].forEach((freq,i)=>{

    setTimeout(()=>{

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type='square';
        osc.frequency.value=freq;

        gain.gain.value=0.08;

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioCtx.currentTime+0.08
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime+0.08);

    },i*soundDelay);

});

setTimeout(()=>{

const need = w.mag-w.ammo;
const give = Math.min(need,w.reserve);

w.ammo+=give;
w.reserve-=give;

reloading=false;
updateHUD();

},reloadTime);
}

//////////////////////////////////////////////////////////////
// ===== 玩家受伤 =====
//////////////////////////////////////////////////////////////

function damage(v){

if(player.invincible)return;

if(player.armor>0){
    const absorbed=Math.min(player.armor,Math.floor(v*0.5));
    player.armor-=absorbed;
    v-=absorbed;
    document.getElementById('armorVal').textContent=player.armor;
}

player.hp-=v;

hpEl.textContent=Math.max(0,Math.floor(player.hp));

const dmg=document.getElementById('damage');
dmg.style.opacity=.35;

sound('hurt');

setTimeout(()=>dmg.style.opacity=0,100);

if(player.hp<=0){
lose();
}
}
function updateWeaponADSVisibility(){
    // ADS时隐藏非必要部件，只保留瞄准相关的顶部轮廓
    const isADS = adsLerp > 0.5;
    currentWeaponModel.traverse(child => {
        if (!child.isMesh) return;
        // 滑套/弹匣/泵动护木等有专属name，通过userData.adsRole标记ADS角色
        const role = (child.name === 'slide' || child.name === 'mag' || child.name === 'pump')
            ? child.userData.adsRole
            : child.name;
        if (role === 'hide_in_ads') {
            child.visible = !isADS;
        } else if (role === 'keep_in_ads') {
            child.visible = true;
        }
    });
}

function updateWeapon(dt){

    // weapon model lerp
    // muzzle flash
    // recoil recover
    // crosshair
    ////////////////////////////////////////////////////////////
    // 武器恢复 + ADS视野优化
    ////////////////////////////////////////////////////////////

    // ADS位置上移+略偏右+缩小，释放准星下方视野
    const targetX = THREE.MathUtils.lerp(0.45, 0.12, adsLerp);
    const targetY = THREE.MathUtils.lerp(-0.35, -0.05, adsLerp);
    const targetZ = THREE.MathUtils.lerp(-0.90, -0.35, adsLerp);
    const targetScale = THREE.MathUtils.lerp(1.15, 0.55, adsLerp);

    currentWeaponModel.position.x +=
    (targetX-currentWeaponModel.position.x)
    *12*dt;

    currentWeaponModel.position.y +=
    (targetY-currentWeaponModel.position.y)
    *12*dt;

    currentWeaponModel.position.z +=
    (targetZ-currentWeaponModel.position.z)
    *12*dt;

    currentWeaponModel.scale.setScalar(
        THREE.MathUtils.lerp(currentWeaponModel.scale.x, targetScale, 12 * dt)
    );

    updateWeaponADSVisibility();

    muzzle.intensity+=(-muzzle.intensity)*18*dt;

    }
function updatePickups(dt){

// 原 pickup 内容
////////////////////////////////////////////////////////////
// 掉落物检测
////////////////////////////////////////////////////////////

for(let i=pickups.length-1;i>=0;i--){

const p=pickups[i];

p.life-=dt;

p.mesh.rotation.y+=dt*2;

if(camera.position.distanceTo(p.mesh.position)<2){

if(p.type==='hp'){
player.hp=Math.min(100,player.hp+25);
hpEl.textContent=player.hp;
pickupTextShow('+25 HP','#00ff88');
}
else if(p.type==='grenade'){
weapons[6].reserve++;
updateHUD();
pickupTextShow('+Grenade','#ffdd44');
}
else{
const w=weapons[currentWeapon];
w.reserve+=w.mag;
updateHUD();
pickupTextShow('+Ammo','#ffcc00');
}

sound('pickup');

scene.remove(p.mesh);
pickups.splice(i,1);
continue;
}

if(p.life<=0){
scene.remove(p.mesh);
pickups.splice(i,1);
}
}

}
//////////////////////////////////////////////////////////////
// ===== Grenade system =====
//////////////////////////////////////////////////////////////

let grenadeState='idle'; // idle | charging | thrown
let chargeStartTime=0;
let chargeSoundOsc=null;
let chargeSoundGain=null;
let chargeFullPlayed=false;

const chargeWrapEl=document.getElementById('grenadeChargeWrap');
const chargeBarEl=document.getElementById('grenadeChargeBar');

const activeGrenades=[];
const grenadeTrailPool=[];
const grenadeLightBalls=[];

const _gnTempDir=new THREE.Vector3();
const _gnTempPos=new THREE.Vector3();

// trail particle pool (20)
for(let i=0;i<20;i++){
    const mesh=new THREE.Mesh(
        new THREE.BoxGeometry(0.05,0.05,0.05),
        new THREE.MeshBasicMaterial({color:'#aaffaa',transparent:true,opacity:0})
    );
    mesh.visible=false;
    scene.add(mesh);
    grenadeTrailPool.push({mesh,active:false,life:0});
}

// explosion light ball pool (5)
for(let i=0;i<5;i++){
    const geo=new THREE.SphereGeometry(0.1,16,16);
    const mat=new THREE.MeshBasicMaterial({color:'#ffaa00',transparent:true,opacity:0,depthWrite:false});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.visible=false;
    scene.add(mesh);
    grenadeLightBalls.push({mesh,mat,geo,active:false,life:0});
}

function createGrenadeMesh(){
    const group=new THREE.Group();
    const bodyMat=new THREE.MeshStandardMaterial({color:'#335511'});
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.5,12),bodyMat);
    group.add(body);
    const ring=new THREE.Mesh(
        new THREE.TorusGeometry(0.12,0.03,8,12),
        new THREE.MeshStandardMaterial({color:'#888888'})
    );
    ring.rotation.x=Math.PI/2;
    ring.position.y=0.18;
    group.add(ring);
    return {group,bodyMat};
}

function startCharge(){
    if(grenadeState!=='idle')return;
    if(weapons[6].ammo<=0){
        // empty click sound
        const osc=audioCtx.createOscillator();
        const gain=audioCtx.createGain();
        osc.type='triangle';
        osc.frequency.value=800;
        gain.gain.value=0.1;
        gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime+0.05);
        return;
    }
    grenadeState='charging';
    chargeStartTime=performance.now();
    chargeFullPlayed=false;
    chargeWrapEl.style.opacity='1';

    // charge tension sound
    chargeSoundOsc=audioCtx.createOscillator();
    chargeSoundGain=audioCtx.createGain();
    chargeSoundOsc.type='sine';
    chargeSoundOsc.frequency.setValueAtTime(200,audioCtx.currentTime);
    chargeSoundOsc.frequency.linearRampToValueAtTime(600,audioCtx.currentTime+1.5);
    chargeSoundGain.gain.setValueAtTime(0.08,audioCtx.currentTime);
    chargeSoundOsc.connect(chargeSoundGain);
    chargeSoundGain.connect(audioCtx.destination);
    chargeSoundOsc.start();
}

function cancelCharge(){
    if(grenadeState!=='charging')return;
    grenadeState='idle';
    chargeWrapEl.style.opacity='0';
    chargeBarEl.style.width='0%';
    chargeBarEl.style.background='#33ff77';
    stopChargeSound();
}

function stopChargeSound(){
    if(chargeSoundOsc){
        try{chargeSoundOsc.stop();}catch(e){}
        chargeSoundOsc.disconnect();
        chargeSoundOsc=null;
    }
    if(chargeSoundGain){
        chargeSoundGain.disconnect();
        chargeSoundGain=null;
    }
}

function releaseGrenade(){
    if(grenadeState!=='charging')return;
    const now=performance.now();
    let chargeDuration=(now-chargeStartTime)/1000;
    if(chargeDuration<0.3)chargeDuration=0.3;
    if(chargeDuration>1.5)chargeDuration=1.5;

    grenadeState='thrown';
    chargeWrapEl.style.opacity='0';
    chargeBarEl.style.width='0%';
    chargeBarEl.style.background='#33ff77';
    stopChargeSound();

    throwGrenade(chargeDuration);
}

function throwGrenade(chargeDuration){
    const w=weapons[6];
    if(w.ammo<=0)return;

    w.ammo--;
    updateHUD();

    // velocity: 10 ~ 24 based on charge
    const speed=10+(chargeDuration-0.3)/1.2*14;

    const {group,bodyMat}=createGrenadeMesh();

    // direction: camera forward, horizontal only, 22deg upward
    _gnTempDir.set(0,0,-1);
    camera.getWorldDirection(_gnTempDir);
    _gnTempDir.y=0;
    _gnTempDir.normalize();
    _gnTempDir.y=Math.tan(22*Math.PI/180)*_gnTempDir.length();
    _gnTempDir.normalize();

    group.position.copy(camera.position);
    group.position.y+=0.3;
    scene.add(group);

    // enforce max 3 active grenades
    if(activeGrenades.length>=3){
        explodeGrenade(activeGrenades[0]);
        activeGrenades.splice(0,1);
    }

    activeGrenades.push({
        mesh:group,
        bodyMat,
        velocity:_gnTempDir.clone().multiplyScalar(speed),
        life:0,
        state:'flying',
        bounceCount:0,
        boomTimer:0
    });

    // auto-reload from reserve after throw
    setTimeout(function(){
        if(w.ammo===0&&w.reserve>0){
            w.ammo++;
            w.reserve--;
            updateHUD();
        }
        grenadeState='idle';
    },300);

    // throw sound
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(400,audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150,audioCtx.currentTime+0.12);
    gain.gain.setValueAtTime(0.15,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime+0.12);
}

function explodeGrenade(g){
    const pos=g.mesh.position.clone();
    scene.remove(g.mesh);

    // explosion sound (extended)
    playExplosionSound();
    const osc=audioCtx.createOscillator();
    const gain=audioCtx.createGain();
    osc.type='sawtooth';
    osc.frequency.value=55;
    gain.gain.setValueAtTime(0.3,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.6);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime+0.6);

    // fragments (20 pieces, orange)
    let spawned=0;
    for(const f of explosionFragments){
        if(spawned>=20)break;
        if(!f.active){
            f.active=true;
            f.life=1.5;
            f.mesh.visible=true;
            f.mesh.position.copy(pos);
            f.mesh.material.color.set('#ff6600');
            f.mesh.material.emissive.set('#331100');
            f.velocity.set((Math.random()-0.5)*12,Math.random()*6+6,(Math.random()-0.5)*12);
            spawned++;
        }
    }

    // light ball
    for(const b of grenadeLightBalls){
        if(!b.active){
            b.active=true;
            b.life=0.25;
            b.mesh.visible=true;
            b.mesh.position.copy(pos);
            b.mesh.scale.setScalar(1);
            b.mat.opacity=0.9;
            break;
        }
    }

    // point light
    const plight=new THREE.PointLight(0xffaa00,12,18);
    plight.position.copy(pos);
    scene.add(plight);
    setTimeout(function(){scene.remove(plight);},400);

    // scorch mark
    const scorch=new THREE.Mesh(
        new THREE.PlaneGeometry(1.5,1.5),
        new THREE.MeshBasicMaterial({map:markTex,transparent:true,opacity:0.95})
    );
    scorch.rotation.x=-Math.PI/2;
    scorch.position.set(pos.x,0.03,pos.z);
    scene.add(scorch);
    bulletMarks.push({mesh:scorch,life:10});

    // screen shake if player within 15
    const pdist2=camera.position.distanceTo(pos);
    if(pdist2<=15){
        recoilX+=0.06;
        recoilY+=(Math.random()-0.5)*0.04;
    }

    // damage enemies
    for(const enemy of enemies){
        if(!enemy.alive)continue;
        const dist=enemy.mesh.position.distanceTo(pos);
        if(dist<=8){
            const dmg=weapons[6].damage*Math.max(0,1-dist/8);
            enemy.hp-=dmg;
            enemy.body.material.color.set(0xffffff);
            enemy.flashTimer=0.1;
            spawnDamageNumber(enemy.mesh.position,dmg,'normal');
            if(enemy.hp<=0&&enemy.alive){
                enemy.alive=false;
                enemy.deadTimer=1;
                kills++;
                score+=100;
                scoreEl.textContent=score;
                spawnPickup(enemy.mesh.position);
            }
        }
    }

    // damage player
    const pdist=camera.position.distanceTo(pos);
    if(pdist<=8&&!player.invincible){
        const pdmg=Math.max(10,Math.floor(50*(1-pdist/8)));
        damage(pdmg);
        _gnTempDir.subVectors(camera.position,pos).normalize();
        _gnTempDir.y=0;
        _gnTempPos.copy(camera.position).addScaledVector(_gnTempDir,3);
        if(!collide(_gnTempPos)){
            camera.position.copy(_gnTempPos);
        }
    }

    // chain reaction: barrels
    for(const b of barrels){
        if(!b.alive)continue;
        if(b.mesh.position.distanceTo(pos)<=8){
            explodeBarrel(b);
        }
    }

    // boss damage
    if(boss&&boss.alive&&!boss.dead){
        const bdist=boss.mesh.position.distanceTo(pos);
        if(bdist<=8){
            const bdmg=weapons[6].damage*Math.max(0,1-bdist/8);
            boss.hp-=bdmg;
            spawnDamageNumber(pos,bdmg,'headshot');
            if(boss.hp<=0){
                boss.dead=true;
                recoilX += 0.08;
                recoilY += (Math.random() - 0.5) * 0.05;
                triggerHitMarker('kill');
                showKillIcon('boss');
                playKillConfirmSound('boss');
                score+=1000;
                scoreEl.textContent=score;
            }
        }
    }
}

function spawnGrenadeTrail(pos){
    for(const p of grenadeTrailPool){
        if(!p.active){
            p.active=true;
            p.life=0.5;
            p.mesh.visible=true;
            p.mesh.position.copy(pos);
            p.mesh.material.opacity=0.8;
            return;
        }
    }
}

function updateGrenades(dt){
    // charge bar update
    if(grenadeState==='charging'){
        const now=performance.now();
        const elapsed=(now-chargeStartTime)/1000;
        const pct=Math.min(100,Math.max(0,elapsed/1.5*100));
        chargeBarEl.style.width=pct+'%';
        if(elapsed>=1.5){
            chargeBarEl.style.background='#ff3333';
            if(!chargeFullPlayed){
                chargeFullPlayed=true;
                // full charge ping
                const osc2=audioCtx.createOscillator();
                const gain2=audioCtx.createGain();
                osc2.type='sine';
                osc2.frequency.value=880;
                gain2.gain.setValueAtTime(0.1,audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.08);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start();
                osc2.stop(audioCtx.currentTime+0.08);
            }
        }
    }

    // update active grenades
    for(let i=activeGrenades.length-1;i>=0;i--){
        const g=activeGrenades[i];

        if(g.state==='flying'||g.state==='bouncing'){
            g.velocity.y-=22*dt;
            g.mesh.position.x+=g.velocity.x*dt;
            g.mesh.position.y+=g.velocity.y*dt;
            g.mesh.position.z+=g.velocity.z*dt;
            g.mesh.rotation.x+=dt*10;
            g.mesh.rotation.z+=dt*8;
            g.life+=dt;

            // trail every ~0.08s
            if(Math.floor(g.life/0.08)!==Math.floor((g.life-dt)/0.08)){
                spawnGrenadeTrail(g.mesh.position.clone());
            }

            // floor bounce
            if(g.mesh.position.y<=0.15){
                g.mesh.position.y=0.15;
                if(g.bounceCount<2){
                    g.velocity.y=Math.abs(g.velocity.y)*0.4;
                    g.velocity.x*=0.6;
                    g.velocity.z*=0.6;
                    g.bounceCount++;
                    g.state='bouncing';
                    // bounce sound (first only)
                    if(g.bounceCount===1){
                        const osc3=audioCtx.createOscillator();
                        const gain3=audioCtx.createGain();
                        osc3.type='square';
                        osc3.frequency.value=250;
                        gain3.gain.setValueAtTime(0.05,audioCtx.currentTime);
                        gain3.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.05);
                        osc3.connect(gain3);
                        gain3.connect(audioCtx.destination);
                        osc3.start();
                        osc3.stop(audioCtx.currentTime+0.05);
                    }
                }else{
                    g.state='armed';
                    g.boomTimer=2.0;
                    g.velocity.set(0,0,0);
                }
            }

            // wall collision
            _gnTempPos.copy(g.mesh.position);
            if(collide(_gnTempPos)){
                g.velocity.x*=-0.5;
                g.velocity.z*=-0.5;
                g.mesh.position.x-=g.velocity.x*dt*2;
                g.mesh.position.z-=g.velocity.z*dt*2;
            }
        }else if(g.state==='armed'){
            g.boomTimer-=dt;
            if(g.boomTimer<=0){
                explodeGrenade(g);
                activeGrenades.splice(i,1);
                continue;
            }
            // blink warning
            if(Math.floor(g.boomTimer*4)%2===0){
                g.bodyMat.emissive.set('#331100');
                g.bodyMat.emissiveIntensity=1;
            }else{
                g.bodyMat.emissiveIntensity=0;
            }
        }
    }

    // update trail particles
    for(const p of grenadeTrailPool){
        if(!p.active)continue;
        p.life-=dt;
        p.mesh.material.opacity=Math.max(0,p.life/0.5*0.8);
        if(p.life<=0){
            p.active=false;
            p.mesh.visible=false;
        }
    }

    // update light balls
    for(const b of grenadeLightBalls){
        if(!b.active)continue;
        b.life-=dt;
        const t=1-b.life/0.25;
        b.mesh.scale.setScalar(1+t*3);
        b.mat.opacity=0.9*(1-t);
        if(b.life<=0){
            b.active=false;
            b.mesh.visible=false;
        }
    }

    // minimap: update grenade dots
    updateMinimapGrenades();
}

function updateMinimapGrenades(){
    // clear previous grenade dots
    const existing=minimapEnemies.querySelectorAll('.minimapGrenadeDot');
    for(const el of existing){el.remove();}

    for(const g of activeGrenades){
        const dist=Math.sqrt(
            (g.mesh.position.x-camera.position.x)**2+
            (g.mesh.position.z-camera.position.z)**2
        );
        if(dist>200)continue;
        const pos=worldToMinimap(g.mesh.position.x,g.mesh.position.z);
        const dot=document.createElement('div');
        dot.className='minimapGrenadeDot';
        dot.style.position='absolute';
        dot.style.left=(pos.x-2)+'px';
        dot.style.top=(pos.y-2)+'px';
        dot.style.width='4px';
        dot.style.height='4px';
        dot.style.borderRadius='50%';
        dot.style.background='#ffffff';
        dot.style.zIndex='3';
        // blink: show only on even half-second
        if(Math.floor(g.life*2)%2===0||g.state==='armed'){
            dot.style.opacity='1';
        }else{
            dot.style.opacity='0.3';
        }
        minimapEnemies.appendChild(dot);
    }
}
