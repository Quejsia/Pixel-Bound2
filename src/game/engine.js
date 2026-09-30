// Core simulation with an expanded world and camera-follow viewport.
export const VIRTUAL_W = 320
export const VIRTUAL_H = 180
export const WORLD_W = VIRTUAL_W * 3
export const WORLD_H = VIRTUAL_H * 3

const ARENA_PAD = 10
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by) }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function makeObstacles() {
  const obstacles = []
  const centerX = WORLD_W / 2
  const centerY = WORLD_H / 2
  const clearRadius = 90
  let attempts = 0
  while (obstacles.length < 16 && attempts < 200) {
    attempts++
    const w = 16 + Math.random() * 14
    const h = 14 + Math.random() * 14
    const x = 20 + Math.random() * (WORLD_W - 40 - w)
    const y = 20 + Math.random() * (WORLD_H - 40 - h)
    if (dist(x + w / 2, y + h / 2, centerX, centerY) < clearRadius) continue
    obstacles.push({ x, y, w, h })
  }
  return obstacles
}
function resolveCircleRectCollision(entity, rect) {
  const closestX = clamp(entity.x, rect.x, rect.x + rect.w)
  const closestY = clamp(entity.y, rect.y, rect.y + rect.h)
  const dx = entity.x - closestX
  const dy = entity.y - closestY
  const distSq = dx * dx + dy * dy
  const r = entity.radius
  if (distSq < r * r) {
    const d = Math.sqrt(distSq) || 0.001
    const push = r - d
    entity.x += (dx / d) * push
    entity.y += (dy / d) * push
  }
}
function circleIntersectsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w)
  const closestY = clamp(y, rect.y, rect.y + rect.h)
  const dx = x - closestX
  const dy = y - closestY
  return dx * dx + dy * dy < radius * radius
}

class Bullet {
  constructor(x, y, vx, vy, damage, fromPlayer = true) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.damage = damage
    this.radius = 1.5; this.life = 1.2; this.fromPlayer = fromPlayer; this.dead = false
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt
    if (this.life <= 0 || this.x < 0 || this.x > WORLD_W || this.y < 0 || this.y > WORLD_H) this.dead = true
  }
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic']
const RARITY_WEIGHTS = [0.65, 0.23, 0.1, 0.02]
const RARITY_MULT = { common: 1, uncommon: 2, rare: 4, epic: 8 }
const SLOT_INFO = {
  armor: { statType: 'defense', baseValue: 0.05, names: ['Rusty Plate', 'Leather Vest', 'Scale Guard'] },
  trinket: { statType: 'maxHp', baseValue: 10, names: ['Cracked Gem', 'Bone Charm', 'Old Coin Pouch'] },
  charm: { statType: 'attack', baseValue: 0.08, names: ['Beast Fang', 'Ether Shard', 'Sharp Talon'] },
}
const SLOTS = Object.keys(SLOT_INFO)
function rollRarity() {
  const r = Math.random(); let acc = 0
  for (let i = 0; i < RARITIES.length; i++) { acc += RARITY_WEIGHTS[i]; if (r <= acc) return RARITIES[i] }
  return RARITIES[0]
}
function makeItem(rarity, slot) {
  const info = SLOT_INFO[slot]
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: info.names[Math.floor(Math.random() * info.names.length)], rarity, slot, statType: info.statType, statValue: Math.round(info.baseValue * RARITY_MULT[rarity] * 100) / 100 }
}
function forgeCost(rarity) { const idx = RARITIES.indexOf(rarity); return 20 * (idx + 1) * (idx + 1) }
const SHOP_PRICES = { common: 30, uncommon: 80, rare: 200, epic: 450 }
const SHOP_RARITY_WEIGHTS = [0.1, 0.45, 0.35, 0.1]
const SHOP_REFRESH_SECONDS = 180
function rollShopRarity() {
  const r = Math.random(); let acc = 0
  for (let i = 0; i < RARITIES.length; i++) { acc += SHOP_RARITY_WEIGHTS[i]; if (r <= acc) return RARITIES[i] }
  return RARITIES[1]
}
function makeShopItem() { const rarity = rollShopRarity(); const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)]; const item = makeItem(rarity, slot); item.price = SHOP_PRICES[rarity]; return item }
const SKILLS = {
  nova: { name: 'Nova Blast', manaCost: 25, cooldown: 4, unlockLevel: 1, radius: 34 },
  heal: { name: 'Heal Burst', manaCost: 40, cooldown: 8, unlockLevel: 3 },
}
class Pickup {
  constructor(x, y, kind, value) { this.x = x; this.y = y; this.kind = kind; this.value = value; this.radius = kind === 'item' ? 3 : 2; this.dead = false; this.bornAt = performance.now() }
  update(dt, player, magnetRadius) {
    const d = dist(this.x, this.y, player.x, player.y)
    if (d < magnetRadius) { const speed = 140; const nx = (player.x - this.x) / Math.max(d, 0.001); const ny = (player.y - this.y) / Math.max(d, 0.001); this.x += nx * speed * dt; this.y += ny * speed * dt }
    if (d < player.radius + this.radius + 1) this.dead = true
  }
}
class Slime {
  constructor(x, y, wave) { this.type='slime'; this.x=x; this.y=y; this.radius=6; this.maxHp=12+wave*4; this.hp=this.maxHp; this.speed=22+Math.min(wave*2.2,40); this.contactDamage=10+Math.floor(wave/3); this.hitFlash=0; this.squish=0; this.contactCooldown=0; this.dead=false }
  update(dt, player) { const d=dist(this.x,this.y,player.x,player.y); if(d>0.001){const nx=(player.x-this.x)/d,ny=(player.y-this.y)/d;this.x+=nx*this.speed*dt;this.y+=ny*this.speed*dt} if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCooldown>0)this.contactCooldown-=dt;this.squish=Math.sin(performance.now()/150+this.x)*0.15 }
}
class Goblin {
  constructor(x,y,wave){this.type='goblin';this.x=x;this.y=y;this.radius=5;this.maxHp=8+wave*2;this.hp=this.maxHp;this.speed=34+Math.min(wave*2.5,55);this.contactDamage=8+Math.floor(wave/4);this.hitFlash=0;this.contactCooldown=0;this.facing=1;this.bob=0;this.dead=false}
  update(dt,player){const d=dist(this.x,this.y,player.x,player.y);if(d>0.001){const nx=(player.x-this.x)/d,ny=(player.y-this.y)/d;this.x+=nx*this.speed*dt;this.y+=ny*this.speed*dt;this.facing=nx>=0?1:-1}if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCooldown>0)this.contactCooldown-=dt;this.bob=Math.sin(performance.now()/90+this.x)*1.2}
}
class Skeleton {
  constructor(x,y,wave){this.type='skeleton';this.x=x;this.y=y;this.radius=6.5;this.maxHp=26+wave*6;this.hp=this.maxHp;this.speed=16+Math.min(wave*1.2,22);this.contactDamage=14+Math.floor(wave/3);this.hitFlash=0;this.contactCooldown=0;this.facing=1;this.bob=0;this.dead=false}
  update(dt,player){const d=dist(this.x,this.y,player.x,player.y);if(d>0.001){const nx=(player.x-this.x)/d,ny=(player.y-this.y)/d;this.x+=nx*this.speed*dt;this.y+=ny*this.speed*dt;this.facing=nx>=0?1:-1}if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCooldown>0)this.contactCooldown-=dt;this.bob=Math.sin(performance.now()/200+this.x)*0.8}
}
class Archer {
  constructor(x,y,wave){this.type='archer';this.x=x;this.y=y;this.radius=5;this.maxHp=10+wave*2;this.hp=this.maxHp;this.speed=26+Math.min(wave*1.5,20);this.contactDamage=6;this.idealRange=65;this.hitFlash=0;this.contactCooldown=0;this.shootCooldown=1+Math.random();this.shootInterval=Math.max(1.8-wave*0.06,0.9);this.facing=1;this.dead=false}
  update(dt,player,spawnEnemyBullet){const d=dist(this.x,this.y,player.x,player.y)||0.001;const nx=(player.x-this.x)/d,ny=(player.y-this.y)/d;this.facing=nx>=0?1:-1;if(d<this.idealRange-12){this.x-=nx*this.speed*dt;this.y-=ny*this.speed*dt}else if(d>this.idealRange+12){this.x+=nx*this.speed*dt;this.y+=ny*this.speed*dt}if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCooldown>0)this.contactCooldown-=dt;this.shootCooldown-=dt;if(this.shootCooldown<=0&&d<140){this.shootCooldown=this.shootInterval;const a=new Bullet(this.x,this.y,nx*95,ny*95,this.contactDamage,false);a.life=2;spawnEnemyBullet(a)}}
}
class Boss {
  constructor(x,y,wave){this.type='boss';this.x=x;this.y=y;this.radius=13;this.maxHp=420+wave*80;this.hp=this.maxHp;this.speed=17+wave*0.5;this.contactDamage=22+Math.floor(wave*1.5);this.hitFlash=0;this.contactCooldown=0;this.facing=1;this.bob=0;this.dead=false;this.state='chase';this.stateTimer=1.2;this.telegraphType='charge';this.attackCooldown=2.5;this.chargeTimer=0;this.chargeVx=0;this.chargeVy=0;this.summonTimer=4}
  update(dt,player,spawnEnemyBullet,spawnMinion){if(this.hitFlash>0)this.hitFlash-=dt;if(this.contactCooldown>0)this.contactCooldown-=dt;this.bob=Math.sin(performance.now()/160+this.x)*1.4;const d=dist(this.x,this.y,player.x,player.y)||0.001;const nx=(player.x-this.x)/d,ny=(player.y-this.y)/d;this.facing=nx>=0?1:-1;this.summonTimer-=dt;if(this.summonTimer<=0&&spawnMinion){this.summonTimer=5.5;for(let i=0;i<2;i++){const a=(i/2)*Math.PI*2;spawnMinion(new Slime(this.x+Math.cos(a)*12,this.y+Math.sin(a)*12,Math.max(1,Math.floor(player.level))))}}if(this.state==='chase'){this.stateTimer-=dt;this.attackCooldown-=dt;if(d>20){this.x+=nx*this.speed*dt;this.y+=ny*this.speed*dt}if(this.attackCooldown<=0){this.state='telegraph';this.telegraphType=Math.random()<0.5?'charge':'burst';this.stateTimer=0.8}}else if(this.state==='telegraph'){this.stateTimer-=dt;if(this.stateTimer<=0){if(this.telegraphType==='charge'){this.chargeVx=nx*105;this.chargeVy=ny*105;this.chargeTimer=0.6;this.state='charge'}else{for(let i=0;i<10;i++){const a=(Math.PI*2*i)/10;spawnEnemyBullet(new Bullet(this.x,this.y,Math.cos(a)*75,Math.sin(a)*75,10+Math.floor(player.level/2),false)).life=1.7}this.attackCooldown=2.8;this.state='chase';this.stateTimer=0.3}}}else if(this.state==='charge'){this.chargeTimer-=dt;this.x+=this.chargeVx*dt;this.y+=this.chargeVy*dt;if(this.chargeTimer<=0){this.attackCooldown=3;this.state='chase';this.stateTimer=0.2}}}
}

export class GameEngine {
  constructor({onHud,onGameOver,onLevelUp}={}){
    this.onHud=onHud;this.onGameOver=onGameOver;this.onLevelUp=onLevelUp
    this.player={x:WORLD_W/2,y:WORLD_H/2,radius:6,baseSpeed:55,speed:55,baseMaxHp:100,maxHp:100,hp:100,level:1,xp:0,xpToNext:30,gold:0,baseAttackMultiplier:1,attackMultiplier:1,defense:0,equipment:{armor:null,trinket:null,charm:null},facing:{x:1,y:0},weapon:'pistol',shootCooldown:0,shootInterval:0.28,dodgeCooldown:0,dodgeDuration:0,invulnerable:0,hitFlash:0,maxMana:100,mana:100,manaRegenRate:6,skillCooldowns:{nova:0,heal:0}}
    this.bullets=[];this.enemyBullets=[];this.enemies=[];this.particles=[];this.pickups=[];this.inventory=[];this.magnetRadius=28;this.obstacles=makeObstacles();this.shop={stock:[makeShopItem(),makeShopItem()],timer:SHOP_REFRESH_SECONDS};this.wave=1;this.enemiesToSpawn=0;this.spawnTimer=0;this.waveClearDelay=0;this.score=0;this.moveVec={x:0,y:0};this.aimVec={x:1,y:0};this.autoAim=true;this.shootHeld=false;this.dodgeRequested=false;this.running=false;this.gameOver=false;this._lastT=0;this._raf=null;this.pendingLevelUp=false;this.pendingLevelUps=0;this.levelUpChoices=null;this.isBossWave=false;this.camera={x:0,y:0};this._startWave()
  }
  _startWave(){if(this.wave%5===0){this.isBossWave=true;this.enemiesToSpawn=0;this.spawnTimer=0;this.waveClearDelay=0;const spot=this._edgeSpawnPoint();this._pushEnemy(new Boss(spot.x,spot.y,this.wave))}else{this.isBossWave=false;this.enemiesToSpawn=4+this.wave*3;this.spawnTimer=0;this.waveClearDelay=0}}
  setMove(x,y){this.moveVec.x=x;this.moveVec.y=y}
  setAim(x,y){this.aimVec.x=x;this.aimVec.y=y}
  setAutoAim(v){this.autoAim=v}
  setShootHeld(v){this.shootHeld=v}
  setWeapon(w){this.player.weapon=w;this.player.shootInterval=w==='shotgun'?0.62:w==='rifle'?0.12:w==='bow'?0.42:w==='staff'?0.55:0.28;this.player.shootCooldown=0}
  requestDodge(){this.dodgeRequested=true}
  setScreenShakeEnabled(v){this.__phase1ScreenShakeEnabled=Boolean(v)}
  start(){if(this.running||this.gameOver)return;this.running=true;this._lastT=performance.now();const loop=(t)=>{if(!this.running)return;const dt=Math.min((t-this._lastT)/1000,0.05);this._lastT=t;this._update(dt);this._raf=requestAnimationFrame(loop)};this._raf=requestAnimationFrame(loop)}
  stop(){this.running=false;if(this._raf)cancelAnimationFrame(this._raf);this._raf=null}
  _edgeSpawnPoint(){const pad=12;const left=this.camera.x-pad,right=this.camera.x+VIRTUAL_W+pad,top=this.camera.y-pad,bottom=this.camera.y+VIRTUAL_H+pad;let x,y;const side=Math.floor(Math.random()*4);if(side===0){x=left;y=top+Math.random()*(bottom-top)}else if(side===1){x=right;y=top+Math.random()*(bottom-top)}else if(side===2){x=left+Math.random()*(right-left);y=top}else{x=left+Math.random()*(right-left);y=bottom}return{x:clamp(x,4,WORLD_W-4),y:clamp(y,4,WORLD_H-4)}}
  _pushEnemy(e){this.enemies.push(e)}
  _spawnEnemy(){const spot=this._edgeSpawnPoint();const roll=Math.random();let enemy;if(this.wave<3)enemy=roll<0.7?new Slime(spot.x,spot.y,this.wave):new Goblin(spot.x,spot.y,this.wave);else if(this.wave<5)enemy=roll<0.5?new Slime(spot.x,spot.y,this.wave):roll<0.82?new Goblin(spot.x,spot.y,this.wave):new Skeleton(spot.x,spot.y,this.wave);else enemy=roll<0.35?new Slime(spot.x,spot.y,this.wave):roll<0.58?new Goblin(spot.x,spot.y,this.wave):roll<0.8?new Skeleton(spot.x,spot.y,this.wave):new Archer(spot.x,spot.y,this.wave);this._pushEnemy(enemy)}
  _fireBullet(){const p=this.player;let target=null;if(this.autoAim){let best=Infinity;for(const e of this.enemies){if(e.dead)continue;const d=dist(p.x,p.y,e.x,e.y);if(d<best){best=d;target=e}}if(target){const d=dist(p.x,p.y,target.x,target.y)||1;this.aimVec.x=(target.x-p.x)/d;this.aimVec.y=(target.y-p.y)/d}}const dx=this.autoAim?this.aimVec.x:p.facing.x,dy=this.autoAim?this.aimVec.y:p.facing.y;const weapon=p.weapon;if(weapon==='shotgun'){const count=5,spread=0.45,speed=175;const base=Math.atan2(dy,dx);for(let i=0;i<count;i++){const t=count===1?0:i/(count-1)-0.5;const a=base+t*spread;this.bullets.push(new Bullet(p.x,p.y,Math.cos(a)*speed,Math.sin(a)*speed,5*p.attackMultiplier))}}else if(weapon==='staff'){const speed=150;this.bullets.push(new Bullet(p.x,p.y,dx*speed,dy*speed,12*p.attackMultiplier))}else{const speed=210;this.bullets.push(new Bullet(p.x,p.y,dx*speed,dy*speed,weapon==='rifle'?7:weapon==='bow'?11:9))}}
  useSkill(key){const p=this.player;const def=SKILLS[key];if(!def||p.level<def.unlockLevel||p.skillCooldowns[key]>0||p.mana<def.manaCost)return{ok:false,reason:'unavailable'};p.mana-=def.manaCost;p.skillCooldowns[key]=def.cooldown/(p.skillCooldownMultiplier||1);if(key==='nova'){this._novaFx={x:p.x,y:p.y,radius:def.radius,maxLife:0.35,life:0.35};for(const e of this.enemies){if(!e.dead&&dist(p.x,p.y,e.x,e.y)<def.radius){e.hp-=28*p.attackMultiplier;e.hitFlash=0.15;if(e.hp<=0){e.dead=true;this.score+=e.type==='boss'?250:10;this._spawnHitParticles(e.x,e.y);this._dropLoot(e.x,e.y,e.type)}}}}else if(key==='heal'){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*0.45)}return{ok:true}}
  _update(dt){if(this.gameOver)return;const p=this.player;const mvLen=Math.hypot(this.moveVec.x,this.moveVec.y);let mx=0,my=0;if(mvLen>0.05){mx=this.moveVec.x/Math.max(mvLen,1);my=this.moveVec.y/Math.max(mvLen,1);if(mvLen<=1){mx=this.moveVec.x;my=this.moveVec.y}if(this.autoAim){p.facing.x=mx||p.facing.x;p.facing.y=my||p.facing.y}}if(!this.autoAim){const aimLen=Math.hypot(this.aimVec.x,this.aimVec.y);if(aimLen>0.2){p.facing.x=this.aimVec.x/aimLen;p.facing.y=this.aimVec.y/aimLen}}let speed=p.speed;if(p.dodgeDuration>0){speed=p.speed*2.6;p.dodgeDuration-=dt}if(this.dodgeRequested&&p.dodgeCooldown<=0){p.dodgeDuration=0.18;p.invulnerable=0.4;p.dodgeCooldown=1.1;this.__dodgeSound=true}this.dodgeRequested=false;if(p.dodgeCooldown>0)p.dodgeCooldown-=dt;if(p.invulnerable>0)p.invulnerable-=dt;if(p.hitFlash>0)p.hitFlash-=dt;p.x=clamp(p.x+mx*speed*dt,ARENA_PAD,WORLD_W-ARENA_PAD);p.y=clamp(p.y+my*speed*dt,ARENA_PAD,WORLD_H-ARENA_PAD);for(const obs of this.obstacles)resolveCircleRectCollision(p,obs);this.camera.x=clamp(p.x-VIRTUAL_W/2,0,Math.max(0,WORLD_W-VIRTUAL_W));this.camera.y=clamp(p.y-VIRTUAL_H/2,0,Math.max(0,WORLD_H-VIRTUAL_H));if(p.shootCooldown>0)p.shootCooldown-=dt;const wantsToShoot=this.autoAim?true:this.shootHeld;if(wantsToShoot&&p.shootCooldown<=0){this._fireBullet();p.shootCooldown=p.shootInterval/(p.fireRateMultiplier||1);this.__shootSound=true}for(const b of this.bullets){b.update(dt);if(!b.dead)for(const obs of this.obstacles)if(circleIntersectsRect(b.x,b.y,b.radius,obs)){b.dead=true;break}}this.bullets=this.bullets.filter(b=>!b.dead);for(const b of this.enemyBullets){b.update(dt);if(!b.dead)for(const obs of this.obstacles)if(circleIntersectsRect(b.x,b.y,b.radius,obs)){b.dead=true;break}}for(const b of this.enemyBullets){if(b.dead)continue;if(dist(b.x,b.y,p.x,p.y)<b.radius+p.radius){if(p.invulnerable<=0){p.hp-=b.damage*(1-p.defense);p.hitFlash=0.2;if(p.hp<=0){p.hp=0;this._triggerGameOver()}}b.dead=true}}this.enemyBullets=this.enemyBullets.filter(b=>!b.dead);const spawnEnemyBullet=b=>this.enemyBullets.push(b);const spawnMinion=e=>this._pushEnemy(e);for(const e of this.enemies){e.update(dt,p,spawnEnemyBullet,spawnMinion);for(const obs of this.obstacles)resolveCircleRectCollision(e,obs)}for(const b of this.bullets){if(b.dead)continue;for(const e of this.enemies){if(e.dead)continue;if(dist(b.x,b.y,e.x,e.y)<b.radius+e.radius){e.hp-=b.damage;e.hitFlash=0.12;b.dead=true;if(e.hp<=0){e.dead=true;this.score+=e.type==='boss'?250:10;this._spawnHitParticles(e.x,e.y);this._dropLoot(e.x,e.y,e.type)}break}}}this.bullets=this.bullets.filter(b=>!b.dead);for(const e of this.enemies){if(e.dead||e.contactCooldown>0)continue;if(dist(e.x,e.y,p.x,p.y)<e.radius+p.radius&&p.invulnerable<=0){p.hp-=e.contactDamage*(1-p.defense);p.hitFlash=0.2;e.contactCooldown=0.6;if(p.hp<=0){p.hp=0;this._triggerGameOver()}}}this.enemies=this.enemies.filter(e=>!e.dead);for(const pk of this.pickups){pk.update(dt,p,this.magnetRadius);if(pk.dead)this._collectPickup(pk)}this.pickups=this.pickups.filter(pk=>!pk.dead);for(const pt of this.particles){pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.life-=dt}this.particles=this.particles.filter(pt=>pt.life>0);if(this.enemiesToSpawn>0){this.spawnTimer-=dt;if(this.spawnTimer<=0){this._spawnEnemy();this.enemiesToSpawn--;this.spawnTimer=Math.max(0.55-this.wave*0.03,0.18)}}else if(this.enemies.length===0){this.waveClearDelay+=dt;if(this.waveClearDelay>1.5){this.wave++;this._startWave()}}this.shop.timer-=dt;if(this.shop.timer<=0){this.shop.stock=[makeShopItem(),makeShopItem()];this.shop.timer=SHOP_REFRESH_SECONDS}p.mana=Math.min(p.mana+p.manaRegenRate*dt,p.maxMana);for(const key of Object.keys(p.skillCooldowns))if(p.skillCooldowns[key]>0)p.skillCooldowns[key]-=dt;if(this._novaFx){this._novaFx.life-=dt;if(this._novaFx.life<=0)this._novaFx=null}}
  _dropLoot(x,y,enemyType){if(enemyType==='boss'){this.pickups.push(new Pickup(x,y,'xp',40));this.pickups.push(new Pickup(x+3,y,'gold',20+Math.floor(Math.random()*15)));for(let i=0;i<2;i++){if(i===0||Math.random()<0.5){const rarity=rollRarity(),slot=SLOTS[Math.floor(Math.random()*SLOTS.length)],angle=i*Math.PI;this.pickups.push(new Pickup(x+Math.cos(angle)*4,y+Math.sin(angle)*4,'item',makeItem(rarity,slot)))}}return}const xpAmount=enemyType==='goblin'?4:3;this.pickups.push(new Pickup(x,y,'xp',xpAmount));if(Math.random()<0.5)this.pickups.push(new Pickup(x+2,y,'gold',1+Math.floor(Math.random()*3)));if(Math.random()<0.15){const rarity=rollRarity(),slot=SLOTS[Math.floor(Math.random()*SLOTS.length)];this.pickups.push(new Pickup(x-2,y,'item',makeItem(rarity,slot)))}}
  _collectPickup(pk){if(pk.kind==='xp')this._gainXp(pk.value);else if(pk.kind==='gold')this.player.gold+=pk.value;else if(pk.kind==='item')this.inventory.push(pk.value)}
  _gainXp(amount){const p=this.player;p.xp+=amount;while(p.xp>=p.xpToNext){p.xp-=p.xpToNext;p.level++;p.xpToNext=Math.round(p.xpToNext*1.35);this.pendingLevelUps++}if(!this.pendingLevelUp&&this.pendingLevelUps>0)this._offerLevelUpChoice()}
  _offerLevelUpChoice(){this.pendingLevelUp=true;this.pendingLevelUps=Math.max(0,this.pendingLevelUps-1);this.levelUpChoices=pickRandomPerks(3);this.stop();if(this.onLevelUp)this.onLevelUp(this.levelUpChoices)}
  chooseLevelUpPerk(perkId){const perk=this.levelUpChoices&&this.levelUpChoices.find(pk=>pk.id===perkId);if(!perk)return{ok:false,reason:'invalid-choice'};perk.apply(this);this.pendingLevelUp=false;this.levelUpChoices=null;if(this.pendingLevelUps>0)this._offerLevelUpChoice();else this.start();return{ok:true}}
  _recalcStats(){const p=this.player;let maxHp=p.baseMaxHp,attack=p.baseAttackMultiplier,defense=p.baseDefense||0,speed=p.baseSpeed;for(const slot of SLOTS){const item=p.equipment[slot];if(!item)continue;if(item.statType==='maxHp')maxHp+=item.statValue;if(item.statType==='attack')attack+=item.statValue;if(item.statType==='defense')defense+=item.statValue;if(item.statType==='speed')speed+=item.statValue}p.maxHp=maxHp;p.attackMultiplier=attack;p.defense=Math.min(defense,0.75);p.speed=speed;if(p.hp>p.maxHp)p.hp=p.maxHp}
  equipItem(itemId){const p=this.player,idx=this.inventory.findIndex(i=>i.id===itemId);if(idx===-1)return;const item=this.inventory[idx],slot=item.slot,current=p.equipment[slot];this.inventory.splice(idx,1);if(current)this.inventory.push(current);p.equipment[slot]=item;this._recalcStats()}
  unequipItem(slot){const p=this.player,item=p.equipment[slot];if(!item)return;p.equipment[slot]=null;this.inventory.push(item);this._recalcStats()}
  forgeItem(itemId){const p=this.player;let item=this.inventory.find(i=>i.id===itemId),equippedSlot=null;if(!item)for(const slot of SLOTS)if(p.equipment[slot]?.id===itemId){item=p.equipment[slot];equippedSlot=slot;break}if(!item)return{ok:false,reason:'not-found'};const idx=RARITIES.indexOf(item.rarity);if(idx>=RARITIES.length-1)return{ok:false,reason:'max-rarity'};const cost=forgeCost(item.rarity);if(p.gold<cost)return{ok:false,reason:'not-enough-gold',cost};p.gold-=cost;item.rarity=RARITIES[idx+1];item.statValue=Math.round(SLOT_INFO[item.slot].baseValue*RARITY_MULT[item.rarity]*100)/100;if(equippedSlot)this._recalcStats();return{ok:true,cost,newRarity:item.rarity}}
  buyShopItem(slotIndex){const p=this.player,item=this.shop.stock[slotIndex];if(!item)return{ok:false,reason:'not-found'};if(p.gold<item.price)return{ok:false,reason:'not-enough-gold',cost:item.price};p.gold-=item.price;const {price,...itemForInventory}=item;this.inventory.push(itemForInventory);this.shop.stock[slotIndex]=null;return{ok:true,item:itemForInventory}}
  _spawnHitParticles(x,y){for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2,s=20+Math.random()*30;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.3,maxLife:0.3})}}
  _triggerGameOver(){this.gameOver=true;this.stop();if(this.onGameOver)this.onGameOver({score:this.score,wave:this.wave})}
}
