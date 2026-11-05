"use strict";

function loop(){

requestAnimationFrame(loop);

const now=performance.now();
const dt=Math.min((now-prev)/1000,.1);
prev=now;
globalTime+=dt;

if(whiteFlashOpacity>0){
    whiteFlashOpacity-=dt/0.15*0.5;
    if(whiteFlashOpacity<0) whiteFlashOpacity=0;
    for(const edge of flashEdges){
        edge.style.opacity=whiteFlashOpacity;
    }
}

if(!paused&&!gameOver){

started=true;

if(timeScale<1.0){
    timeScale+=(1-timeScale)*dt*4;
    if(timeScale>0.9999) timeScale=1.0;
}

const gameDt=dt*timeScale;

surviveTime+=gameDt;

camera.rotation.order='YXZ';
camera.rotation.y=player.yaw;
adsLerp += (
(player.ads?1:0)
-adsLerp
)*gameDt*10;

camera.fov = THREE.MathUtils.lerp(
75,
45,
adsLerp
);

camera.updateProjectionMatrix();

camera.rotation.x=player.pitch;

camera.rotation.x -= recoilX;
camera.rotation.y += recoilY;

recoilX *= 0.82;
recoilY *= 0.82;

if(!isFinite(camera.rotation.x)) camera.rotation.x = 0;
if(!isFinite(camera.rotation.y)) camera.rotation.y = 0;
if(!isFinite(camera.rotation.z)) camera.rotation.z = 0;


fireCooldown -= dt;

if(fireCooldown<0){
    fireCooldown=0;
}

const w = weapons[currentWeapon];

if(
    mouseDown &&
    w.auto &&
    fireCooldown<=0
){

    shoot();
}

updatePlayer(gameDt);
updateWeapon(gameDt);
updateMeleeHold(gameDt);
updatePickups(gameDt);
updateBarrelsAndFragments(gameDt);
updateBulletMarks(gameDt);
updateDamageNumbers(gameDt);
updateLowHpFeedback(gameDt);
updateUI(gameDt);
updateHitMarker(gameDt);
updateKillFeed(gameDt);
updateEnemies(gameDt);
updateBoss(gameDt);
updateGrenades(gameDt);
updateBreathingLights(globalTime);
updateDust(gameDt, globalTime);
updateSteam(gameDt);
}

try{

    renderer.render(scene,camera);

}catch(err){

    console.error(err);
}
}

loop();
//////////////////////////////////////////////////////////////
// ===== 自适应 =====
//////////////////////////////////////////////////////////////

window.addEventListener('resize',()=>{

camera.aspect=window.innerWidth/window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth,window.innerHeight);
});

document.addEventListener('contextmenu',e=>{
e.preventDefault();
});

