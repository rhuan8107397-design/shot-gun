"use strict";
//////////////////////////////////////////////////////////////
// ===== 敌人系统 =====
//////////////////////////////////////////////////////////////

const enemies=[];
const aliveEnemyMeshes = [];

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

function spawnExplosionFragments(pos){

    let spawned = 0;

    for(const f of explosionFragments){

        if(spawned>=10)break;

        if(!f.active){

            f.active = true;
            f.life = 1.2;

            f.mesh.visible = true;
            f.mesh.position.copy(pos);

            f.velocity.set(
                (Math.random()-0.5)*10,
                Math.random()*8+4,
                (Math.random()-0.5)*10
            );

            spawned++;
        }
    }
}

function explodeBarrel(barrel){

    if(!barrel.alive)return;

    barrel.alive = false;

    tempExplosionPos.copy(
        barrel.mesh.position
    );

    const pos = tempExplosionPos;

    playExplosionSound();

    const light = new THREE.PointLight(
        0xffaa00,
        10,
        15
    );

    light.position.copy(pos);

    scene.add(light);

    setTimeout(()=>{

        scene.remove(light);

    },300);

    spawnExplosionFragments(pos);

    for(const enemy of enemies){

        if(!enemy.alive)continue;

        const dist =
        enemy.mesh.position.distanceTo(pos);

        if(dist<=8){

            enemy.hp -= 80;

            enemy.body.material.color.set(0xffcc66);
            enemy.flashTimer = 0.1;

            if(enemy.hp<=0){

                enemy.alive = false;
                enemy.deadTimer = 1;

                kills++;

                score += 100;
                scoreEl.textContent = score;

                showCenterText('EXPLOSION KILL','orange',600);
            }
        }
    }

    const playerDist =
    camera.position.distanceTo(pos);

    if(playerDist<=8 && !player.invincible){

        damage(30);
    }

    // 烧焦痕迹：复用弹痕贴花逻辑，放大到 2×2，贴在地面
    const scorch = new THREE.Mesh(
        new THREE.PlaneGeometry(2,2),
        new THREE.MeshBasicMaterial({
            map:markTex,
            transparent:true,
            opacity:0.9
        })
    );

    scorch.rotation.x = -Math.PI/2;
    scorch.position.set(
        pos.x,
        0.03,
        pos.z
    );

    scene.add(scorch);

    bulletMarks.push({
        mesh:scorch,
        life:8
    });

    scene.remove(barrel.mesh);
}

function hitBarrel(barrel){

    if(!barrel.alive)return;

    barrel.hp--;

    barrel.body.material.color.set('#ffcc00');

    barrel.flashTimer = 0.08;

    if(barrel.hp<=0){

        explodeBarrel(barrel);
    }
}
//////////////////////////////////////////////////////////////
// ===== 伤害飘字对象池 =====
//////////////////////////////////////////////////////////////

const damageNumberPool = [];

for(let i=0;i<20;i++){

    const el = document.createElement('div');

    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.fontSize = '24px';
    el.style.fontWeight = 'bold';
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    el.style.textShadow = '0 0 8px #000';
    el.style.display = 'none';

    damageNumberLayer.appendChild(el);

    damageNumberPool.push({
        el,
        active:false,
        life:0,
        maxLife:0.8,
        x:0,
        y:0
    });
}

function spawnDamageNumber(worldPos,value,type='normal'){

    const item = damageNumberPool.find(v=>!v.active);

    if(!item)return;

    const screen = tempScreen;

    screen.copy(worldPos);
    screen.project(camera);

    const x =
    (screen.x * 0.5 + 0.5) * window.innerWidth;

    const y =
    (-screen.y * 0.5 + 0.5) * window.innerHeight;

    item.active = true;
    item.life = item.maxLife;
    item.x = x;
    item.y = y;

    item.el.style.display = 'block';
    item.el.style.opacity = '1';
    item.el.style.left = `${x}px`;
    item.el.style.top = `${y}px`;

    if(type==='headshot'){

        item.el.innerHTML = `<b>${Math.floor(value)}</b>`;
        item.el.style.color = 'gold';
        item.el.style.fontSize = '30px';

    }else if(type==='armor'){

        item.el.innerHTML = `${Math.floor(value)}`;
        item.el.style.color = '#ff9933';
        item.el.style.fontSize = '26px';

    }else{

        item.el.innerHTML = `${Math.floor(value)}`;
        item.el.style.color = 'white';
        item.el.style.fontSize = '24px';
    }
}
function spawnBoss(){

    if(boss)return;

    const group = new THREE.Group();

    const body = new THREE.Mesh(

        new THREE.BoxGeometry(4,5,4),

        new THREE.MeshStandardMaterial({

            color:'#6600cc',

            emissive:0x220044

        })
    );

    body.castShadow=true;
    body.name='head';

    const eyeMat =
    new THREE.MeshStandardMaterial({

        color:'#ff0000',

        emissive:0xff0000

    });

    const eyeL = new THREE.Mesh(

        new THREE.BoxGeometry(.5,.5,.2),

        eyeMat
    );

    eyeL.position.set(-1,1,2.1);

    const eyeR = eyeL.clone();

    eyeR.position.x=1;

    const aura = new THREE.PointLight(
        0xaa00ff,
        3,
        20
    );

    aura.position.y=2;

    group.add(body);
    group.add(eyeL);
    group.add(eyeR);
    group.add(aura);

    group.position.set(0,30,0);

    scene.add(group);

    boss={

        mesh:group,

        body,

        eyeL,
        eyeR,

        hp:500,

        alive:true,

        mode:'range',

        modeTimer:5,

        speed:7,

        spawnTimer:1.5,

        spawned:false,

        attackTimer:0,

        chargeTimer:0,

        deathTimer:1,

        dead:false,

        hitCooldown:0,

        aura

    };

    bossBarWrap.style.display='block';

    showCenterText(
        'BOSS 来袭',
        '#aa00ff',
        2000
    );
}

function enemySpawn(
x,
z,
hpMul,
speedMul,
type='normal'
){

const group = new THREE.Group();

const body = new THREE.Mesh(

new THREE.BoxGeometry(

type==='elite'?2:1.5,

type==='elite'?3:2.5,

type==='elite'?2:1.5

),
new THREE.MeshStandardMaterial({
color:type==='elite'?0xffaa00:0xff3333,

emissive:type==='elite'
?0x442200
:0x440000
})
);

body.castShadow=true;
group.add(body);

const hasHelmet =
type==='elite'
&&Math.random()<0.3;

const headVisual = new THREE.Mesh(

new THREE.BoxGeometry(

type==='elite'?1.4:1.0,

type==='elite'?0.9:0.7,

type==='elite'?1.4:1.0

),

new THREE.MeshStandardMaterial({
color:hasHelmet
?'#888888'
:'#ffcccc'
})

);

headVisual.position.y =
type==='elite'
?1.95
:1.6;

headVisual.castShadow=true;
group.add(headVisual);

const headCollision = new THREE.Mesh(
new THREE.BoxGeometry(
type==='elite'?2.2:1.6,
type==='elite'?1.2:0.95,
type==='elite'?2.2:1.6
),
new THREE.MeshStandardMaterial({visible:false})
);
headCollision.position.y = headVisual.position.y - 0.05;
headCollision.name='head';
group.add(headCollision);

const glow = new THREE.PointLight(0xff0000,2,6);
glow.position.y=1;
group.add(glow);

group.scale.set(0,0,0);

// 出生时先埋在地面下方
group.position.set(x,-2,z);

const spawnLight = new THREE.PointLight(
    0x88ccff,
    2,
    5
);

spawnLight.position.set(0,1.2,0);

group.add(spawnLight);

scene.add(group);

enemies.push({
mesh:group,
body,
headVisual,
headCollision,
type,
damage:type==='elite'?6:3,
shootCD:type==='elite'?0.5:0.8,
hp:100*hpMul,
alive:true,
state:'patrol',
dir:Math.random()*Math.PI*2,
attack:0,
speed:4.5*speedMul,
spawn:0,
spawnDone:false,
spawnLight,
spawnLightTimer:0.3,
tempVec:new THREE.Vector3(),
moveVec:new THREE.Vector3(),
visionVec:new THREE.Vector3(),
shootVec:new THREE.Vector3(),
flashTimer:0,
helmet:hasHelmet,
deadTimer:0
});
}
//////////////////////////////////////////////////////////////
// ===== 波次系统 =====
//////////////////////////////////////////////////////////////

const waves=[3,5,7,10,12];
let wave=0;
let waitingWave=false;
let boss = null;
let bossSpawned = false;

function nextWave(){

if(wave>=waves.length){
win();
return;
}

wave++;
waveEl.textContent=wave;

showCenterText(`WAVE ${wave} START!`,'red',1500);

const count = waves[wave-1];

const eliteCount =
wave===1
?0
:Math.max(1,Math.floor(wave/2));

for(let i=0;i<count;i++){

let x,z;

let tries = 0;

while(tries < 50){

tries++;

x=(Math.random()*360)-180;
z=(Math.random()*360)-180;

tempNext.set(x,0,z);

if(!collide(tempNext)){
break;
}
}

if(tries >= 50){

x = 0;
z = 0;
}

const type =
i<eliteCount
?'elite'
:'normal';

totalEnemies++;

enemySpawn(

x,
z,

type==='elite'
?(1+wave*.2)*2.5
:(1+wave*.2),

type==='elite'
?(1+wave*.12)*0.8
:(1+wave*.12),

type
);

// multi-layer spawning: randomly place on platforms/rooftops
const layerRoll=Math.random();
if(layerRoll<0.2&&rooms.length>0){
const rb=rooms[Math.floor(Math.random()*rooms.length)];
const e=enemies[enemies.length-1];
if(layerRoll<0.08&&rb.rooftopY){
e.mesh.position.y=rb.rooftopY-2; // rooftop spawn
e.platformY=rb.rooftopY;
}else if(layerRoll<0.2&&(rb._type==='factory'||rb._type==='office')){
e.mesh.position.y=2; // platform level
e.platformY=4;
}
}
}
}
//////////////////////////////////////////////////////////////
// ===== 敌人视线检测 =====
//////////////////////////////////////////////////////////////

function canSeePlayer(enemy){

const dir = enemy.visionVec;

dir.subVectors(
camera.position,
enemy.mesh.position
);

const dist = dir.length();
dir.normalize();

// height-aware: if height diff > 8m, can't see (different floors)
const heightDiff = Math.abs(camera.position.y - enemy.mesh.position.y);
if(heightDiff > 8) return false;

raycaster.set(enemy.mesh.position,dir);

const hits = raycaster.intersectObjects(walls,false);

if(hits.length&&hits[0].distance<dist){
return false;
}

return true;
}
//////////////////////////////////////////////////////////////
// ===== 掉落系统 =====
//////////////////////////////////////////////////////////////

const pickups=[];

function spawnPickup(pos){

if(Math.random()>.3)return;

const r=Math.random();
const type=r>.6?'hp':r>.3?'ammo':'grenade';

const mesh = new THREE.Mesh(
new THREE.BoxGeometry(.8,.8,.8),
new THREE.MeshStandardMaterial({
color:type==='hp'?0x00ff66:type==='grenade'?0xffdd44:0xffcc00,
emissive:type==='hp'?0x00ff66:type==='grenade'?0xffdd44:0xffcc00,
emissiveIntensity:1
})
);

mesh.position.copy(pos);
mesh.position.y=.5;

scene.add(mesh);

pickups.push({mesh,type,life:20});
}

function spawnSpecificPickup(pos,type){

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(.8,.8,.8),
        new THREE.MeshStandardMaterial({
            color:type==='hp'?0x00ff66:type==='grenade'?0xffdd44:0xffcc00,
            emissive:type==='hp'?0x00ff66:type==='grenade'?0xffdd44:0xffcc00,
            emissiveIntensity:1
        })
    );

    mesh.position.copy(pos);
    mesh.position.y=.5;

    scene.add(mesh);

    pickups.push({
        mesh,
        type,
        life:20
    });
}

function pickupTextShow(text,color){

pickupText.innerHTML=text;
pickupText.style.color=color;
pickupText.style.opacity=1;
pickupText.style.transform='translateX(-50%) translateY(0px)';

setTimeout(()=>{
pickupText.style.opacity=0;
pickupText.style.transform='translateX(-50%) translateY(-30px)';
},1000);
}
//////////////////////////////////////////////////////////////
// ===== 弹痕系统 =====
//////////////////////////////////////////////////////////////

const markCanvas=document.createElement('canvas');
markCanvas.width=64;
markCanvas.height=64;
const mctx=markCanvas.getContext('2d');
mctx.fillStyle='rgba(0,0,0,.8)';
mctx.beginPath();
mctx.arc(32,32,12,0,Math.PI*2);
mctx.fill();

const markTex=new THREE.CanvasTexture(markCanvas);

function bulletMark(hit,normal){

if(
    !normal ||
    !isFinite(normal.x) ||
    !isFinite(normal.y) ||
    !isFinite(normal.z)
){
    return;
}

const mesh = new THREE.Mesh(
new THREE.PlaneGeometry(.5,.5),
new THREE.MeshBasicMaterial({
map:markTex,
transparent:true
})
);

mesh.position.copy(hit);

tempLook.copy(hit).add(normal);

mesh.lookAt(tempLook);

scene.add(mesh);

bulletMarks.push({mesh,life:5});
}
//////////////////////////////////////////////////////////////
// ===== AI 更新 =====
//////////////////////////////////////////////////////////////

function enemyShoot(enemy){

enemy.attack=enemy.shootCD;

const dir = enemy.shootVec;

dir.subVectors(
camera.position,
enemy.mesh.position
).normalize();

raycaster.set(enemy.mesh.position,dir);

const wallHit = raycaster.intersectObjects(walls,false);

const dist = enemy.mesh.position.distanceTo(camera.position);

if(!wallHit.length||wallHit[0].distance>dist){
tempLinePoints[0].copy(enemy.mesh.position);
tempLinePoints[1].copy(camera.position);

enemyLaserGeom.setFromPoints(tempLinePoints);

enemyLaser.visible = true;

setTimeout(()=>{

    enemyLaser.visible = false;

},50);

damage(enemy.damage);
}
}

function updateBoss(dt){

    if(!boss)return;

    if(!boss.spawned){

        boss.spawnTimer -= dt;

        const t =
        1-boss.spawnTimer/1.5;

        boss.mesh.position.y =
        THREE.MathUtils.lerp(
            30,
            2.5,
            t
        );

        if(boss.spawnTimer<=0){

            boss.spawned=true;

            boss.mesh.position.y=2.5;

            recoilX += 0.04;

            recoilY +=
            (Math.random()-.5)*0.06;

            playBossBoom();
        }

        return;
    }

    if(boss.dead){

        boss.deathTimer -= dt;

        boss.mesh.rotation.y += dt*5;

        const s =
        Math.max(
            0,
            boss.deathTimer
        );

        boss.mesh.scale.setScalar(s);

        if(boss.deathTimer<=0){

            scene.remove(boss.mesh);

            boss=null;

            bossBarWrap.style.display='none';

            playVictoryHorn();

            win();
        }

        return;
    }

    bossBar.style.width =
    `${boss.hp/500*100}%`;

    boss.modeTimer -= dt;

    if(boss.modeTimer<=0){

        boss.modeTimer=8;

        boss.mode =
        Math.random()>.5
        ?'range'
        :'charge';

        boss.body.material.color
        .set(0xffffff);

        setTimeout(()=>{

            if(boss){

                boss.body.material.color
                .set('#6600cc');
            }

        },200);
    }

    const dist =
    boss.mesh.position.distanceTo(
        camera.position
    );

    boss.hitCooldown -= dt;

    if(boss.hitCooldown < 0){

        boss.hitCooldown = 0;
    }

    if(boss.mode==='range'){

        const dir = tempMove;

        dir.subVectors(
            camera.position,
            boss.mesh.position
        );

        dir.y=0;

        dir.normalize();

        boss.mesh.position.x +=
        dir.x * boss.speed * dt;

        boss.mesh.position.z +=
        dir.z * boss.speed * dt;

        boss.attackTimer -= dt;

        if(
            dist>15 &&
            boss.attackTimer<=0
        ){

            boss.attackTimer=0.8;

            for(let i=0;i<2;i++){

                setTimeout(()=>{

                    if(!boss)return;

                    const origin = tempForward;

                    origin.copy(boss.mesh.position);

                    origin.y += 2;

                    const dir = tempRight;

                    dir.subVectors(
                        camera.position,
                        origin
                    );

                    const dist = dir.length();

                    dir.normalize();

                    raycaster.set(origin,dir);

                    const wallHit =
                    raycaster.intersectObjects(
                        walls,
                        false
                    );

                    if(
                        wallHit.length &&
                        wallHit[0].distance < dist
                    ){
                        return;
                    }

                    damage(5);

                },i*300);
            }
        }

    }else{

        boss.chargeTimer += dt;

        const dir = tempMove;

        dir.subVectors(
            camera.position,
            boss.mesh.position
        );

        dir.y=0;

        dir.normalize();

        boss.mesh.position.x +=
        dir.x * 12 * dt;

        boss.mesh.position.z +=
        dir.z * 12 * dt;

        if(
            dist < 2.5 &&
            boss.hitCooldown <= 0
        ){

            boss.hitCooldown = 1;

            damage(10);

            const pushPos = tempNext;

            pushPos.copy(camera.position);

            pushPos.addScaledVector(dir,5);

            if(!collide(pushPos)){

                camera.position.copy(pushPos);
            }
        }

        if(boss.chargeTimer>=1){

            boss.chargeTimer=0;

            boss.mode='range';
        }
    }
}

function updateEnemies(dt){

for(let i=enemies.length-1;i>=0;i--){

const e = enemies[i];

if(!e.alive){

e.deadTimer-=dt;

e.mesh.rotation.z+=dt*3;

if(e.deadTimer<=0){

scene.remove(e.mesh);

enemies.splice(i,1);
}

continue;
}

if(e.flashTimer>0){

e.flashTimer -= dt;

if(e.flashTimer<=0){

e.body.material.color.set(

e.type==='elite'
?0xffaa00
:0xff3333

);
}
}

if(e.spawn < 1){

    // 1 秒内从 -2 上升到 1.25
    e.spawn += dt;

    const t = Math.min(1,e.spawn);

    e.mesh.position.y = THREE.MathUtils.lerp(
        -2,
        1.25,
        t
    );

    e.mesh.scale.setScalar(t);

    continue;
}

if(!e.spawnDone){

    e.spawnDone = true;

    e.mesh.position.y = 1.25;
    e.mesh.scale.setScalar(1);
}

if(e.spawnDone && e.spawnLight){

    e.spawnLightTimer -= dt;

    e.spawnLight.intensity =
    Math.max(
        0,
        2 * (e.spawnLightTimer / 0.3)
    );

    if(e.spawnLightTimer <= 0){

        e.mesh.remove(e.spawnLight);

        e.spawnLight = null;
    }
}

const toPlayer = e.tempVec;

toPlayer.set(
camera.position.x-e.mesh.position.x,
0,
camera.position.z-e.mesh.position.z
);

const dist = toPlayer.length();

const visible = canSeePlayer(e);

if(dist<28&&visible){
e.state='chase';
}else{
e.state='patrol';
}

if(e.state==='patrol'){

e.dir+=dt;

e.mesh.position.x+=Math.cos(e.dir)*dt;
e.mesh.position.z+=Math.sin(e.dir)*dt;
}

if(e.state==='chase'){

toPlayer.normalize();

const next = e.moveVec;

next.copy(e.mesh.position);

next.x+=toPlayer.x*e.speed*dt;
next.z+=toPlayer.z*e.speed*dt;

// 简单绕墙
if(collide(next)){

next.x+=Math.cos(e.dir+Math.PI/2)*dt*3;
next.z+=Math.sin(e.dir+Math.PI/2)*dt*3;
}

if(!collide(next)){
e.mesh.position.copy(next);
}

if(dist<20){

e.attack-=dt;

if(e.attack<=0){
enemyShoot(e);
}
}

// 面向玩家

e.mesh.lookAt(
camera.position.x,
e.mesh.position.y,
camera.position.z
);
}
}

let aliveCount = 0;

for(const e of enemies){

if(e.alive){
aliveCount++;
}
}

if(!waitingWave && aliveCount===0){

    if(
        wave===5 &&
        !bossSpawned
    ){

        bossSpawned=true;

        spawnBoss();

        return;
    }

    if(
        wave===5 &&
        bossSpawned &&
        !boss
    ){

        win();

        return;
    }

    if(wave===5 && bossSpawned && boss && !boss.dead){
        return;
    }

    waitingWave=true;

centerText.innerHTML='PRESS B FOR SHOP';
centerText.style.color='#00ffaa';
centerText.style.opacity=1;

setTimeout(()=>{
    if(gameOver) return;

    let t=3;

    centerText.style.color='white';
    centerText.style.opacity=1;

    const int = setInterval(()=>{

        if(paused || gameOver){
            return;
        }

        centerText.innerHTML=`WAVE ${wave} CLEARED! NEXT WAVE IN ${t}...`;

        t--;

        if(t<0){

            clearInterval(int);
            centerText.style.opacity=0;
            waitingWave=false;
            nextWave();
        }

    },1000);
},2000);
}
}
//////////////////////////////////////////////////////////////
// ===== 胜利/失败 =====
//////////////////////////////////////////////////////////////

function win(){

gameOver=true;

let newRecord=false;

if(score>bestScore){

localStorage.setItem(
'fps_best',
score
);

newRecord=true;
}

document.exitPointerLock();
endTitle.innerHTML='任务完成';

document.getElementById('stats')
.innerHTML=
`

<div>Score: ${score}</div>

<div>Best Combo: ${bestCombo}</div>

<div>Kills: ${kills}/${totalEnemies}</div>

<div>BEST: ${Math.max(score,bestScore)}</div>

${newRecord
?'<div style="color:gold">NEW RECORD!</div>'
:''}

`;

endMenu.classList.remove('hidden');
}

function lose(){

gameOver=true;

let newRecord=false;

if(score>bestScore){

localStorage.setItem(
'fps_best',
score
);

newRecord=true;
}

document.exitPointerLock();
endTitle.innerHTML='阵亡';
document.getElementById('stats')
.innerHTML=
`

<div>Score: ${score}</div>

<div>Best Combo: ${bestCombo}</div>

<div>Kills: ${kills}/${totalEnemies}</div>

<div>TIME: ${timeText.innerHTML}</div>

<div>BEST: ${Math.max(score,bestScore)}</div>

${newRecord
?'<div style="color:gold">NEW RECORD!</div>'
:''}

`;
endMenu.classList.remove('hidden');
}
