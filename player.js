"use strict";
//////////////////////////////////////////////////////////////
// ===== 玩家 =====
//////////////////////////////////////////////////////////////

const player={
height:1.8,
targetHeight:1.8,
hp:100,
armor:0,
speed:11,
baseSpeed:11,
sprintSpeed:18,
slideSpeed:25,
yaw:0,
pitch:0,
ads:false,
sprinting:false,
sliding:false,
slideTimer:0,
slideStunTimer:0,
slideDir:new THREE.Vector3(),
stamina:3,
maxStamina:3,
invincible:false,
vel:new THREE.Vector3(),
canJump:true,
vaulting:false,
vaultTimer:0,
vaultDuration:0.4,
vaultStart:new THREE.Vector3(),
vaultTarget:new THREE.Vector3(),
vaultHeight:0,
upgrades:{damage:0,fireRate:0,mag:0,speed:0,reload:0}
};

// spawn at map center
camera.position.set(0,player.height,0);
//////////////////////////////////////////////////////////////
// ===== 升级系统 =====
//////////////////////////////////////////////////////////////

const upgradeDefs=[
{key:'damage',name:'火力升级',desc:'武器伤害 +10%',cost:200,max:5},
{key:'fireRate',name:'射速升级',desc:'开火速率 +10%',cost:150,max:5},
{key:'mag',name:'扩容弹匣',desc:'弹匣容量 +5',cost:150,max:5},
{key:'speed',name:'轻装上阵',desc:'玩家移速 +8%',cost:150,max:5},
{key:'reload',name:'快速换弹',desc:'换弹时间 -15%',cost:150,max:5}
];

function applyUpgrades(){
    for(let wi=0;wi<weapons.length;wi++){
        const w=weapons[wi];
        w.damage=Math.round(w.baseDamage*(1+0.1*player.upgrades.damage));
        w.fireRate=w.baseFireRate*(1-0.1*(player.upgrades.fireRate||0));
        if(wi!==6&&wi!==1) w.mag=w.baseMag+5*(player.upgrades.mag||0);
    }
    player.baseSpeed=11*(1+0.08*player.upgrades.speed);
}
//////////////////////////////////////////////////////////////
// ===== Pointer Lock =====
//////////////////////////////////////////////////////////////

function lock(){

    getAudio();

    if(audioCtx && audioCtx.state === 'suspended'){
        audioCtx.resume();
    }

    renderer.domElement.requestPointerLock();
}

document.getElementById('startBtn').onclick=lock;
document.getElementById('resumeBtn').onclick=lock;

document.addEventListener('pointerlockchange',()=>{

if(document.pointerLockElement===renderer.domElement){
paused=false;
startMenu.classList.add('hidden');
pauseMenu.classList.add('hidden');
shopMenu.classList.add('hidden');
}else{
if(started&&!gameOver){
    if(shopMenu.classList.contains('hidden')){
        paused=true;
        pauseMenu.classList.remove('hidden');
    }
}
}
});

// crosshair settings
const chSettings=document.getElementById('crosshairSettings');
const chPresets=document.getElementById('chPresets');
const chColorPicker=document.getElementById('chColorPicker');
const chOpacitySlider=document.getElementById('chOpacitySlider');
const chOpacityVal=document.getElementById('chOpacityVal');
const chOutlineCheck=document.getElementById('chOutlineCheck');

const presetColors=['#ffffff','#00ffcc','#33ff77','#ffff00','#ff66cc','#ff8800','#ff4444','#88ccff'];
presetColors.forEach(function(c){
    const div=document.createElement('div');
    div.style.cssText='width:32px;height:32px;border-radius:4px;background:'+c+';cursor:pointer;border:2px solid #333;';
    div.onclick=function(){
        crosshairConfig.color=c;
        chColorPicker.value=c;
        applyCrosshairStyle();
    };
    chPresets.appendChild(div);
});

chColorPicker.addEventListener('input',function(e){
    crosshairConfig.color=e.target.value;
    applyCrosshairStyle();
});

chOpacitySlider.addEventListener('input',function(e){
    crosshairConfig.opacity=parseFloat(e.target.value);
    chOpacityVal.textContent=Math.round(crosshairConfig.opacity*100)+'%';
    applyCrosshairStyle();
});

chOutlineCheck.addEventListener('change',function(e){
    crosshairConfig.outlineColor=e.target.checked?'#000000':'transparent';
    applyCrosshairStyle();
});

document.getElementById('chSaveBtn').onclick=function(){
    saveCrosshairConfig();
};

document.getElementById('chBackBtn').onclick=function(){
    chSettings.classList.add('hidden');
    pauseMenu.classList.remove('hidden');
};

document.getElementById('settingsBtn').onclick=function(){
    pauseMenu.classList.add('hidden');
    chSettings.classList.remove('hidden');
};

//////////////////////////////////////////////////////////////
// ===== 输入 =====
//////////////////////////////////////////////////////////////

const keys={};
let mouseDown=false;

document.addEventListener('keydown',e=>{

keys[e.code]=true;

if(e.code==='Space'&&player.canJump&&!player.vaulting){
if(!player.sliding&&!player.sprinting){
const obs=canVault();
if(obs){
startVault(obs);
return;
}
}
player.vel.y=10;
player.canJump=false;
}

if(e.code==='ShiftLeft' || e.code==='ShiftRight'){

    if(
        player.stamina > 0 &&
        !player.sliding &&
        player.slideStunTimer <= 0
    ){
        player.sprinting = true;
        player.ads = false;
    }
}

if(e.code==='ControlLeft' || e.code==='ControlRight'){

    if(player.sprinting && !player.sliding){

        startSlide();
    }
}

if(e.code==='Digit1') cyclePrimary();
if(e.code==='Digit2') switchWeapon(0); // pistol
if(e.code==='Digit3') switchWeapon(1); // melee
if(e.code==='Digit4') switchWeapon(6); // grenade

if(e.code==='KeyR') reload();

if(e.code==='KeyT'){
    if(!gameOver && started){
        if(shopMenu.classList.contains('hidden')){
            openShop();
        }else{
            closeShop();
        }
    }
}

if(e.code==='Escape'){
    if(!shopMenu.classList.contains('hidden')){
        closeShop();
    }
}
});

document.addEventListener('keyup',e=>{
    if(e.code==='ShiftLeft' || e.code==='ShiftRight'){

    player.sprinting = false;
}
keys[e.code]=false;
});
//////////////////////////////////////////////////////////////
// ===== 鼠标视角 =====
//////////////////////////////////////////////////////////////

document.addEventListener('mousemove',e=>{

if(document.pointerLockElement!==renderer.domElement)return;

player.yaw-=e.movementX*0.002;
player.pitch-=e.movementY*0.002;

player.pitch=Math.max(-Math.PI/2,
Math.min(Math.PI/2,player.pitch));
});
//////////////////////////////////////////////////////////////
// ===== 翻越 =====
//////////////////////////////////////////////////////////////

function canVault(){
if(!player.canJump||player.sliding||player.sprinting||player.vaulting) return null;
// only vault from ground level, not from platforms
if(camera.position.y > player.height + 0.1) return null;
const forward = tempForward;
camera.getWorldDirection(forward);
forward.y = 0;
forward.normalize();
const checkPos = tempV;
checkPos.copy(camera.position);
checkPos.addScaledVector(forward, 1.2);
for(const c of colliders){
if(!c.vaultable) continue;
if(checkPos.x < c.minX || checkPos.x > c.maxX) continue;
if(checkPos.z < c.minZ || checkPos.z > c.maxZ) continue;
const h = c.vaultHeight - c.minY;
if(h >= 0.7 && h <= 1.5) return c;
}
return null;
}

function startVault(obstacle){
player.vaulting = true;
player.vaultTimer = 0;
player.vaultDuration = 0.4;
player.vaultStart.copy(camera.position);
const forward = tempForward;
camera.getWorldDirection(forward);
forward.y = 0;
forward.normalize();
player.vaultTarget.copy(camera.position);
player.vaultTarget.addScaledVector(forward, 2.0);
player.vaultTarget.y = obstacle.vaultHeight + player.height;
player.vaultHeight = obstacle.vaultHeight + 0.6;
player.ads = false;
}

function updateVault(dt){
if(!player.vaulting) return;
player.vaultTimer += dt;
const t = Math.min(1, player.vaultTimer / player.vaultDuration);
const heightT = Math.sin(t * Math.PI);
camera.position.lerpVectors(player.vaultStart, player.vaultTarget, t);
camera.position.y += heightT * player.vaultHeight;
crosshairTarget += 15;
if(t >= 1){
player.vaulting = false;
player.canJump = true;
camera.position.copy(player.vaultTarget);
}
}

//////////////////////////////////////////////////////////////
// ===== 碰撞 =====
//////////////////////////////////////////////////////////////

function collide(pos, height, radius){

height = height || player.height;
radius = radius || 0.5;

if(boss){
    const d = boss.mesh.position.distanceTo(pos);
    if(d<3.5){
        return true;
    }
}

const pMinY = pos.y - height;
const pMaxY = pos.y;
const pMinX = pos.x - radius;
const pMaxX = pos.x + radius;
const pMinZ = pos.z - radius;
const pMaxZ = pos.z + radius;

for(const c of colliders){
if(pMaxX < c.minX || pMinX > c.maxX) continue;
if(pMaxZ < c.minZ || pMinZ > c.maxZ) continue;
if(pMaxY < c.minY || pMinY >= c.maxY) continue;
return true;
}

return false;
}
function playSlideSound(){

    const buffer = audioCtx.createBuffer(1,4096,44100);
    const data = buffer.getChannelData(0);

    for(let i=0;i<data.length;i++){
        data[i]=(Math.random()*2-1)*0.25;
    }

    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    filter.type='highpass';
    filter.frequency.value=800;

    gain.gain.setValueAtTime(0.1,audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime+0.3
    );

    src.buffer=buffer;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    src.start();
    src.stop(audioCtx.currentTime+0.3);
}

function startSlide(){

    player.sliding = true;
    player.ads = false;
    player.sprinting = false;
    player.invincible = true;

    player.slideTimer = 0.35;
    player.slideStunTimer = 0;

    player.targetHeight = 0.9;

    camera.getWorldDirection(player.slideDir);
    player.slideDir.y = 0;
    player.slideDir.normalize();

    playSlideSound();

    recoilX += 0.05;
}
function updatePlayer(dt){

updateVault(dt);
if(player.vaulting) return;

// 原来的：
//FPS移动
//重力
//ADS
//recoil
//脚步
//全部放这里
////////////////////////////////////////////////////////////
// FPS 移动
////////////////////////////////////////////////////////////

const forward = tempForward;

camera.getWorldDirection(forward);

forward.y = 0;
forward.normalize();

const right = tempRight;

right.set(
    -forward.z,
    0,
    forward.x
);

const move = tempMove;

move.set(0,0,0);

if(keys['KeyW']) move.add(forward);
if(keys['KeyS']) move.sub(forward);
if(keys['KeyA']) move.sub(right);
if(keys['KeyD']) move.add(right);

const moving = move.lengthSq() > 0;

if(player.stamina <= 0){
    player.sprinting = false;
}

if(!moving){
    player.sprinting = false;
}

if(player.sprinting && moving && !player.sliding){

    player.stamina -= dt;

    if(player.stamina <= 0){
        player.stamina = 0;
        player.sprinting = false;
    }

}else if(!player.sliding){

    player.stamina += dt * 0.75;

    if(player.stamina > player.maxStamina){
        player.stamina = player.maxStamina;
    }
}

const wSpeedMul = weapons[currentWeapon].speedMul||1;
player.speed = player.sprinting
? player.sprintSpeed * wSpeedMul
: player.baseSpeed * wSpeedMul;

if(moving && !player.sliding && player.slideStunTimer <= 0){

    if(Math.abs(player.vel.y) < 0.01){

        footstepTimer -= dt;

        if(footstepTimer <= 0){

            footstepTimer = 0.35;

            const buffer = audioCtx.createBuffer(
                1,
                2048,
                44100
            );

            const data = buffer.getChannelData(0);

            for(let i=0;i<data.length;i++){
                data[i] = (Math.random()*2-1)*0.2;
            }

            const src = audioCtx.createBufferSource();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();

            filter.type = 'lowpass';
            filter.frequency.value = 300;

            gain.gain.value = 0.08;

            src.buffer = buffer;

            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            src.start();
            src.stop(audioCtx.currentTime + 0.06);
        }
    }

    move.normalize();

    crosshairTarget = Math.max(crosshairTarget, weapons[currentWeapon].chBase + (player.sprinting?12:6));

    const next = tempNext;

    next.copy(camera.position);

    next.x += move.x * player.speed * dt;
    next.z += move.z * player.speed * dt;

    if(!collide(next)){

        camera.position.x = next.x;
        camera.position.z = next.z;
    } else {
        // wall slide: try each axis independently
        tempV.set(next.x, camera.position.y, camera.position.z);
        const canMoveX = !collide(tempV);
        if(canMoveX){
            camera.position.x = next.x;
        }
        tempV.set(camera.position.x, camera.position.y, next.z);
        const canMoveZ = !collide(tempV);
        if(canMoveZ){
            camera.position.z = next.z;
        }
        // corner anti-stuck nudge
        if(!canMoveX && !canMoveZ){
            const nudges = [[0.03,0],[-0.03,0],[0,0.03],[0,-0.03]];
            for(const [nx,nz] of nudges){
                tempV.set(camera.position.x + nx, camera.position.y, camera.position.z + nz);
                if(!collide(tempV)){
                    camera.position.x = tempV.x;
                    camera.position.z = tempV.z;
                    break;
                }
            }
        }
    }

}else{

    crosshairTarget = Math.max(crosshairTarget, weapons[currentWeapon].chBase);
}

if(player.sliding){

    player.slideTimer -= dt;

    const slideNext = tempNext;

    slideNext.copy(camera.position);

    slideNext.x += player.slideDir.x * player.slideSpeed * dt;
    slideNext.z += player.slideDir.z * player.slideSpeed * dt;

    if(!collide(slideNext)){
        camera.position.x = slideNext.x;
        camera.position.z = slideNext.z;
    } else {
        const sX = tempV;
        sX.set(slideNext.x, camera.position.y, camera.position.z);
        if(!collide(sX)){
            camera.position.x = slideNext.x;
        }
        const sZ = tempV;
        sZ.set(camera.position.x, camera.position.y, slideNext.z);
        if(!collide(sZ)){
            camera.position.z = slideNext.z;
        }
    }

    player.pitch += Math.sin(performance.now()*0.04)*0.002;

    if(player.slideTimer <= 0){

        player.sliding = false;
        player.invincible = false;
        player.slideStunTimer = 0.3;
        player.targetHeight = 1.8;
    }
}

if(player.slideStunTimer > 0){

    player.slideStunTimer -= dt;

    crosshairTarget = Math.max(crosshairTarget, weapons[currentWeapon].chBase + 30);

    if(player.slideStunTimer < 0){
        player.slideStunTimer = 0;
    }
}

player.height +=
(player.targetHeight-player.height)*12*dt;

////////////////////////////////////////////////////////////
// 楼梯斜坡
////////////////////////////////////////////////////////////

if(typeof stairs!=='undefined'){
    for(const s of stairs){
        if(camera.position.x < s.minX || camera.position.x > s.maxX) continue;
        if(camera.position.z < s.minZ || camera.position.z > s.maxZ) continue;
        const t = (camera.position.z - s.minZ) / s.depth;
        const groundY = s.startY + t * s.totalH;
        camera.position.y = groundY + player.height;
        player.vel.y = 0;
        player.canJump = true;
        break;
    }
}

////////////////////////////////////////////////////////////
// 重力
////////////////////////////////////////////////////////////

// check if standing on a collider surface BEFORE gravity
const footY = camera.position.y - player.height;
let onColliderSurface = false;
for(const c of colliders){
if(camera.position.x < c.minX-0.5 || camera.position.x > c.maxX+0.5) continue;
if(camera.position.z < c.minZ-0.5 || camera.position.z > c.maxZ+0.5) continue;
if(Math.abs(footY - c.maxY) < 0.05){
onColliderSurface = true;
break;
}
}

if(onColliderSurface && player.vel.y <= 0.01){
// standing on collider — no gravity (only if not jumping up)
player.vel.y = 0;
player.canJump = true;
}else{
// airborne or on ground — apply gravity
const prevFootY = footY;
player.vel.y-=22*dt;
if(camera.position.y>player.height+0.05){
    wasAirborne=true;
}
camera.position.y+=player.vel.y*dt;

const newFootY = camera.position.y - player.height;
let landedY = null;
for(const c of colliders){
if(camera.position.x < c.minX-0.5 || camera.position.x > c.maxX+0.5) continue;
if(camera.position.z < c.minZ-0.5 || camera.position.z > c.maxZ+0.5) continue;
if(newFootY <= c.maxY && prevFootY >= c.maxY && player.vel.y <= 0){
landedY = c.maxY;
break;
}
}

if(landedY !== null){

camera.position.y = landedY + player.height;
player.vel.y = 0;
player.canJump = true;

if(wasAirborne){
    wasAirborne = false;
    const oscL = audioCtx.createOscillator();
    const gainL = audioCtx.createGain();
    oscL.type = 'sine'; oscL.frequency.value = 80;
    gainL.gain.value = 0.1;
    gainL.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.08);
    oscL.connect(gainL); gainL.connect(audioCtx.destination);
    oscL.start(); oscL.stop(audioCtx.currentTime+0.08);
}

}else if(camera.position.y<=player.height){

camera.position.y=player.height;
player.vel.y=0;
player.canJump=true;

if(wasAirborne){

    wasAirborne=false;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type='sine';
    osc.frequency.value=120;

    gain.gain.value=0.15;

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime+0.1
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime+0.1);

    recoilX += 0.02;
}
}

}

}
