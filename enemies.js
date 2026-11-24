import {GATE,dist} from './terrain.js'
import {DAY,NIGHT} from './colony.js'
const rivalGate={x:1115,y:885}
function approach(actor,target,amount) {
  const d=dist(actor,target)
  if(d>0){const r=Math.min(amount/d,1);actor.x+=(target.x-actor.x)*r;actor.y+=(target.y-actor.y)*r}
}
function kill(state,ant) {
  state.ants=state.ants.filter(a=>a.id!==ant.id)
  state.portal.guards=state.portal.guards.filter(id=>id!==ant.id)
  if(state.selected===ant.id)state.selected=null
  if(ant.name||ant.played>15)state.memorial.push({...ant})
}
export function updateEnemies(s,dt,emit) {
  const night=s.time%DAY>NIGHT
  const trail=s.trails.find(t=>t.points.some(p=>dist(p,GATE.field)>230))
  const target=s.spider.lure||((night&&trail)?trail.points.at(-1):{x:1070,y:555})
  approach(s.spider,target,dt*(night?36:20))
  if(s.spider.lure&&dist(s.spider,target)<5)s.spider.lure=null
  s.spider.cooldown=Math.max(0,(s.spider.cooldown||0)-dt)
  if(!s.spider.cooldown) {
    const a=s.ants.find(a=>a.view==='field'&&dist(a,s.spider)<22)
    if(a){a.hp--;s.spider.cooldown=2.4;if(a.hp<=0){kill(s,a);emit('Une fourmi a été attrapée par l’araignée.',true)}}
  }
  s.rivalAnts??=[]
  if(!s.rivalAnts.length)s.rivalAnts=Array.from({length:5},(_,i)=>({x:rivalGate.x,y:rivalGate.y,i}))
  for(const ant of s.rivalAnts){
    const source=s.sources[4-ant.i%2]
    const end=ant.carry?rivalGate:source
    approach(ant,end,dt*(38+ant.i*2))
    if(dist(ant,end)<3){if(ant.carry)s.rival+=.35;ant.carry=!ant.carry}
  }
  const raidReady=!s.raidWon&&s.ants.length>=12&&s.rival>=13
  const beetleReady=s.time>110&&s.time>=(s.nextBeetle??110)
  if(!s.raid&&(raidReady||beetleReady)) {
    const kind=raidReady?'rival':'beetle'
    s.raid={kind,x:rivalGate.x,y:rivalGate.y,hp:kind==='rival'?25:16,pressure:0}
    s.nextBeetle=s.time+180
    emit(kind==='rival'?'Raid rival ! Poste des soldates au portail.':'Un scarabée approche du portail.',true)
  }
  const raid=s.raid
  if(!raid)return
  approach(raid,GATE.field,dt*35)
  if(dist(raid,GATE.field)>28)return
  const guards=s.portal.guards.filter(id=>s.ants.some(a=>a.id===id&&a.view==='colony'&&dist(a,GATE.colony)<75)).length
  raid.hp-=dt*(guards*3+(s.portal.closed?s.portal.level*1.3:0))
  if(raid.hp<=0) {
    if(raid.kind==='rival')s.raidWon=true
    s.raid=null
    emit('L’entrée a tenu. Attaque repoussée !',true)
  }else if(!s.portal.closed||s.portal.level===1) {
    raid.pressure+=dt/(1+guards)
    if(raid.pressure>14) {
      s.stock.sugar*=.75
      s.stock.protein*=.8
      raid.pressure=0
      s.raid=null
      s.rival=7
      emit('Les intrus ont pillé une partie des réserves.',true)
    }
  }
}
export {rivalGate}