"use strict";
// ===== 小地图初始化 =====
//////////////////////////////////////////////////////////////

const minimapEnemyDots=[];

for(let i=0;i<30;i++){

    const dot=document.createElement('div');

    dot.className='minimapDot';

    dot.style.display='none';

    minimapEnemies.appendChild(dot);

    minimapEnemyDots.push({
        el:dot,
        active:false
    });
}

function worldToMinimap(x,z){

    const mapX=100+x*(100/200);
    const mapY=100-z*(100/200);

    return {x:mapX,y:mapY};
}

for(const r of rooms){

    const corners=[
        {x:r.x-r.w/2,z:r.z-r.d/2},
        {x:r.x+r.w/2,z:r.z-r.d/2},
        {x:r.x+r.w/2,z:r.z+r.d/2},
        {x:r.x-r.w/2,z:r.z+r.d/2}
    ];

    for(let i=0;i<4;i++){

        const a=worldToMinimap(corners[i].x,corners[i].z);
        const b=worldToMinimap(corners[(i+1)%4].x,corners[(i+1)%4].z);

        const dx=b.x-a.x;
        const dy=b.y-a.y;
        const len=Math.sqrt(dx*dx+dy*dy);
        const angle=Math.atan2(dy,dx);

        const line=document.createElement('div');

        line.className='minimapWall';

        line.style.left=`${a.x}px`;
        line.style.top=`${a.y}px`;
        line.style.width=`${len}px`;
        line.style.height='2px';
        line.style.transform=`rotate(${angle}rad)`;

        minimapWalls.appendChild(line);
    }
}
function openShop(){
    document.exitPointerLock();
    shopMenu.classList.remove('hidden');
    paused=true;
    renderShop();
}

function closeShop(){
    shopMenu.classList.add('hidden');
    paused=false;
    if(started && !gameOver){
        lock();
    }
}

const shopWeaponsEl=document.getElementById('shopWeapons');
const shopBuffsEl=document.getElementById('shopBuffs');

function renderShop(){
    shopScore.querySelector('b').textContent=score;
    shopWeaponsEl.innerHTML='';
    shopBuffsEl.innerHTML='';

    // weapon purchase - primary weapons
    for(let pi=0;pi<primaryMap.length;pi++){
        const wi=primaryMap[pi];
        const w=weapons[wi];
        const owned=playerWeapons.ownedPrimaries[pi];
        const equipped=playerWeapons.primarySlots[0]===wi||playerWeapons.primarySlots[1]===wi;
        const btn=document.createElement('button');
        btn.className='shopButton';
        const canAfford=score>=w.price;
        let label=owned?(equipped?'已装备':'装备'):(w.price+' pts');
        if(owned&&equipped)btn.classList.add('disabled');
        btn.innerHTML=`<span>${w.name} ${owned?'(已拥有)':''}<br><small>伤害:${w.baseDamage} 射速:${(1/w.baseFireRate).toFixed(1)}/s 弹匣:${w.baseMag}</small></span><span>${label}</span>`;
        btn.onclick=()=>{
            if(owned){
                if(!equipped){
                    // equip to slot
                    const slot=playerWeapons.primarySlots[0]<0?0:(playerWeapons.primarySlots[1]<0?1:playerWeapons.currentPrimary);
                    playerWeapons.primarySlots[slot]=wi;
                    renderShop();
                }
            }else if(canAfford){
                score-=w.price;
                scoreEl.textContent=score;
                playerWeapons.ownedPrimaries[pi]=true;
                // auto-equip to first empty slot
                if(playerWeapons.primarySlots[0]<0)playerWeapons.primarySlots[0]=wi;
                else if(playerWeapons.primarySlots[1]<0)playerWeapons.primarySlots[1]=wi;
                else playerWeapons.primarySlots[playerWeapons.currentPrimary]=wi;
                w.ammo=w.mag;
                w.reserve=w.mag*3;
                renderShop();
            }
        };
        if(!owned&&!canAfford)btn.classList.add('disabled');
        shopWeaponsEl.appendChild(btn);
    }

    // ammo refill, HP, armor
    const items=[
        {name:'补满弹药',cost:100,action:()=>{
            for(const w of weapons){
                if(isPrimary(weapons.indexOf(w))&&!playerWeapons.ownedPrimaries[primaryMap.indexOf(weapons.indexOf(w))])continue;
                if(w.name==='手雷')w.reserve=Math.max(w.reserve,3);
                else{w.ammo=w.mag;w.reserve=w.mag*3;}
            }
            updateHUD();
        }},
        {name:'+50 HP',cost:80,action:()=>{player.hp=Math.min(100,player.hp+50);hpEl.textContent=player.hp;}},
        {name:'+50 护甲',cost:120,action:()=>{player.armor=Math.min(100,player.armor+50);document.getElementById('armorVal').textContent=player.armor;}}
    ];
    for(const item of items){
        const btn=document.createElement('button');
        btn.className='shopButton';
        const canAfford=score>=item.cost;
        btn.innerHTML=`<span>${item.name}</span><span>${item.cost} pts</span>`;
        if(!canAfford)btn.classList.add('disabled');
        btn.onclick=()=>{if(canAfford){score-=item.cost;scoreEl.textContent=score;item.action();renderShop();}};
        shopWeaponsEl.appendChild(btn);
    }

    // buffs
    for(const def of upgradeDefs){
        const btn=document.createElement('button');
        btn.className='shopButton';
        const current=player.upgrades[def.key]||0;
        const isMax=current>=def.max;
        const canAfford=score>=def.cost;
        btn.innerHTML=`<span>${def.name} Lv.${current}/${def.max}<br><small>${def.desc}</small></span><span>${isMax?'MAX':def.cost+' pts'}</span>`;
        if(isMax||!canAfford)btn.classList.add('disabled');
        btn.onclick=()=>{if(!isMax&&canAfford)buyUpgrade(def.key);};
        shopBuffsEl.appendChild(btn);
    }
}

function buyUpgrade(key){
    const def=upgradeDefs.find(d=>d.key===key);
    if(!def)return;
    if(player.upgrades[key]>=def.max)return;
    if(score<def.cost)return;
    score-=def.cost;
    scoreEl.textContent=score;
    if(!player.upgrades[key])player.upgrades[key]=0;
    player.upgrades[key]++;
    if(key==='mag'){
        for(const w of weapons){w.ammo=w.mag;}
    }
    applyUpgrades();
    updateHUD();
    renderShop();
}

closeShopBtn.onclick=closeShop;
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
weapons[3].reserve++;
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
function updateBreathingLights(time){
    const breath=Math.sin(time*0.5)*0.5+0.5; // 0~1, ~12s cycle
    const intensity=0.55+breath*0.15; // 0.55~0.70
    const emissiveIntensity=0.15+breath*0.05;
    for(const fl of fluorescentLights){
        fl.light.intensity=intensity;
        fl.mesh.material.emissiveIntensity=emissiveIntensity;
    }
}
function updateBarrelsAndFragments(dt){

    for(const b of barrels){

        if(!b.alive)continue;

        if(b.flashTimer>0){

            b.flashTimer -= dt;

            if(b.flashTimer<=0){

                b.body.material.color.set('#cc0000');
            }
        }
    }

    for(const f of explosionFragments){

        if(!f.active)continue;

        f.life -= dt;

        f.velocity.y -= 18 * dt;

        f.mesh.position.x += f.velocity.x * dt;
        f.mesh.position.y += f.velocity.y * dt;
        f.mesh.position.z += f.velocity.z * dt;

        f.mesh.rotation.x += dt * 8;
        f.mesh.rotation.y += dt * 10;

        if(f.mesh.position.y<0.1){

            f.mesh.position.y = 0.1;
            f.velocity.y *= -0.25;
            f.velocity.x *= 0.7;
            f.velocity.z *= 0.7;
        }

        if(f.life<=0){

            f.active = false;
            f.mesh.visible = false;
        }
    }
}
function updateBulletMarks(dt){

// 原来的 bulletMarks 更新
////////////////////////////////////////////////////////////
// 弹痕更新
////////////////////////////////////////////////////////////

for(let i=bulletMarks.length-1;i>=0;i--){

const b=bulletMarks[i];

if(!isFinite(b.life)) continue;

b.life-=dt;

b.mesh.material.opacity=b.life/5;

if(b.life<=0){
scene.remove(b.mesh);
bulletMarks.splice(i,1);
}
}

}

function updateDust(dt, time) {
if (!dustSystems || !dustSystems.length) return;
for (const ds of dustSystems) {
const positions = ds.system.geometry.attributes.position.array;

for (let i = 0; i < ds.count; i++) {
const v = ds.velocities[i];

positions[i*3]   += v.x * dt + Math.sin(time + v.phase) * 0.002;
positions[i*3+1] += v.y * dt + Math.cos(time * 0.7 + v.phase) * 0.001;
positions[i*3+2] += v.z * dt;

if (Math.abs(positions[i*3]) > ds.halfW) positions[i*3] *= -0.9;
if (positions[i*3+1] > 5 || positions[i*3+1] < 0.5) v.y *= -1;
if (Math.abs(positions[i*3+2]) > ds.halfD) positions[i*3+2] *= -0.9;
}

ds.system.geometry.attributes.position.needsUpdate = true;
}
}

function updateSteam(dt) {
if (!steamSystems || !steamSystems.length) return;
for (const ss of steamSystems) {
ss.timer -= dt;

if (ss.timer <= 0) {
if (!ss.emitting) { ss.emitting = true; ss.timer = 999; }
}

const positions = ss.system.geometry.attributes.position.array;

for (let i = 0; i < ss.count; i++) {
if (ss.life[i] > 0) {
positions[i*3+1] += dt * 0.8;
positions[i*3]   += Math.sin(ss.life[i] * 3) * dt * 0.2;
positions[i*3+2] += Math.cos(ss.life[i] * 2) * dt * 0.15;
ss.life[i] -= dt;

if (ss.life[i] <= 0) {
positions[i*3] = 0; positions[i*3+1] = 0; positions[i*3+2] = 0;
}
} else if (ss.emitting && Math.random() < 0.05) {
positions[i*3]   = (Math.random()-0.5) * 0.3;
positions[i*3+1] = 0;
positions[i*3+2] = (Math.random()-0.5) * 0.3;
ss.life[i] = 2.0 + Math.random();
}
}

ss.system.geometry.attributes.position.needsUpdate = true;
}
}

function updateDamageNumbers(dt){

    for(const item of damageNumberPool){

        if(!item.active)continue;

        item.life -= dt;

        const t =
        1 - item.life / item.maxLife;

        const y =
        item.y - t * 40;

        item.el.style.top = `${y}px`;
        item.el.style.opacity = `${Math.max(0,item.life/item.maxLife)}`;

        if(item.life<=0){

            item.active = false;
            item.el.style.display = 'none';
        }
    }
}
function updateLowHpFeedback(dt){

    if(player.hp <= 30){

        lowHpActive = true;

    }else if(player.hp >= 50){

        lowHpActive = false;
    }

    if(lowHpActive){

        const intensity =
        Math.min(1,Math.max(0,1-player.hp/30));

        for(const edge of lowHpEdges){
            edge.style.opacity = intensity;
        }

        heartbeatTimer -= dt;

        if(heartbeatTimer <= 0){

            playHeartbeat();

            heartbeatTimer = 1.2;
        }

        breathTimer += dt;

        const breath =
        Math.sin(breathTimer * Math.PI) * 0.005;

        recoilX += breath;

        hemi.intensity +=
        (0.8 - hemi.intensity) * 2 * dt;

    }else{

        for(const edge of lowHpEdges){
            edge.style.opacity = 0;
        }

        heartbeatTimer = 0;
        breathTimer = 0;

        hemi.intensity +=
        (1.4 - hemi.intensity) * 2 * dt;
    }
}
function updateUI(dt){

// crosshair spread calculation
const w=weapons[currentWeapon];
// fire penalty decay
if(firePenalty>0){
    const elapsed=performance.now()-lastFireTime;
    if(elapsed<300){
        firePenalty=Math.max(0,firePenalty-(w.chRecoil*dt/0.3));
    }else{
        firePenalty=0;
    }
}

// compute target spread
let movePenaltyVal=0;
if(player.sliding||!player.canJump){
    movePenaltyVal=30;
}else if(player.sprinting){
    movePenaltyVal=12;
}else if(Math.abs(player.vel.x)>0.1||Math.abs(player.vel.z)>0.1){
    movePenaltyVal=6;
}
const adsMul=player.ads?0.25:1.0;
const target=Math.min(w.chMax,(w.chBase+movePenaltyVal+firePenalty))*adsMul;

// grenade charge shrink
if(currentWeapon===3&&grenadeState==='charging'){
    const elapsed=(performance.now()-chargeStartTime)/1000;
    crosshairTarget=Math.max(1,target*(1-elapsed/1.5*0.7));
}else{
    crosshairTarget=target;
}

// lerp spread
crosshairSpread+=(crosshairTarget-crosshairSpread)*dt*15;

// apply crosshair line positions
if(currentWeapon===2){
    chTop.style.display='none';chBottom.style.display='none';
    chLeft.style.display='none';chRight.style.display='none';
    const s=crosshairSpread*2+4;
    chCircle.style.width=s+'px';chCircle.style.height=s+'px';
    chCircle.style.border='2px solid '+crosshairConfig.color;
    chCircle.style.left=(-s/2)+'px';chCircle.style.top=(-s/2)+'px';
    chCircle.style.display='block';
    chCenter.style.opacity='0';
}else{
    chTop.style.display='block';chBottom.style.display='block';
    chLeft.style.display='block';chRight.style.display='block';
    chCircle.style.display='none';
    const sp=crosshairSpread;
    chTop.style.top=(-sp-6)+'px';chBottom.style.top=sp+'px';
    chLeft.style.left=(-sp-6)+'px';chRight.style.left=sp+'px';
    chCenter.style.opacity=(player.ads&&sp<5)?'1':'0';
    chCenter.style.background=crosshairConfig.color;
}
chRoot.style.setProperty('--ch-color',crosshairConfig.color);
chRoot.style.setProperty('--ch-outline',crosshairConfig.outlineColor);
chRoot.style.opacity=crosshairConfig.opacity;

// ads dot
adsDot.style.opacity=player.ads?'1':'0';

if(comboTimer>0){

comboTimer-=dt;

if(comboTimer<=0){

combo=0;

comboText.style.opacity=0;

showCenterText('COMBO BREAK','#888',800);
}
}

const min =
Math.floor(surviveTime/60)
.toString()
.padStart(2,'0');

const sec =
Math.floor(surviveTime%60)
.toString()
.padStart(2,'0');

timeText.innerHTML=
`${min}:${sec}`;

staminaBar.style.width =
`${(player.stamina/player.maxStamina)*100}%`;

if(player.stamina <= 0.2){
    staminaBar.style.background = '#ff4444';
}else{
    staminaBar.style.background = '#33ff77';
}

// 商店小地图标记
if(typeof shopLocation!=='undefined'){
    const sPos=worldToMinimap(shopLocation.x,shopLocation.z);
    minimapWalls.querySelectorAll('.shopMarker').forEach(e=>e.remove());
    const sm=document.createElement('div');
    sm.className='shopMarker';
    sm.style.cssText=`position:absolute;left:${sPos.x-6}px;top:${sPos.y-6}px;width:14px;height:14px;background:#ffcc00;border:2px solid #ff8800;border-radius:3px;z-index:5;`;
    minimapWalls.appendChild(sm);
}

// 小地图更新
const pPos = worldToMinimap(camera.position.x, camera.position.z);
minimapPlayer.style.left = `${pPos.x - 7}px`;
minimapPlayer.style.top = `${pPos.y - 7}px`;
minimapPlayer.style.transform = `rotate(${-player.yaw}rad)`;
minimapCone.style.left = `${pPos.x - 22}px`;
minimapCone.style.top = `${pPos.y - 40}px`;
minimapCone.style.transform = `rotate(${-player.yaw}rad)`;

for(const dot of minimapEnemyDots){
    dot.active = false;
    dot.el.style.display = 'none';
}

let dotIdx = 0;

for(const e of enemies){
    if(!e.alive || dotIdx >= 30) continue;

    const dist = Math.sqrt(
        (e.mesh.position.x - camera.position.x)**2 +
        (e.mesh.position.z - camera.position.z)**2
    );

    if(dist > 200) continue;

    const pos = worldToMinimap(e.mesh.position.x, e.mesh.position.z);
    const dot = minimapEnemyDots[dotIdx];

    dot.active = true;
    dot.el.style.display = 'block';
    dot.el.style.left = `${pos.x}px`;
    dot.el.style.top = `${pos.y}px`;

    let size, color;
    if(e.type === 'elite'){
        size = 8;
        color = '#ffaa00';
    }else{
        size = 6;
        color = '#ff3333';
    }

    dot.el.style.width = `${size}px`;
    dot.el.style.height = `${size}px`;
    dot.el.style.background = color;

    dotIdx++;
}

if(boss && boss.alive && !boss.dead && dotIdx < 30){
    const dist = Math.sqrt(
        (boss.mesh.position.x - camera.position.x)**2 +
        (boss.mesh.position.z - camera.position.z)**2
    );

    if(dist <= 200){
        const pos = worldToMinimap(boss.mesh.position.x, boss.mesh.position.z);
        const dot = minimapEnemyDots[dotIdx];

        dot.active = true;
        dot.el.style.display = 'block';
        dot.el.style.left = `${pos.x}px`;
        dot.el.style.top = `${pos.y}px`;
        dot.el.style.width = '12px';
        dot.el.style.height = '12px';
        dot.el.style.background = '#aa00ff';
    }
}

}
