import {GATE,FIELD,NEST,dist,nestRoute,reveal} from './terrain.js'
import {queueAtPortal} from './portal.js'
import {ROYAL,storeResource} from './colony.js'
export const speedOf = ant=>ant.role==='scout'?108:ant.role==='soldier'?65:73
export function moveAnt(state,ant,target,dt,speed=speedOf(ant)) {
  if(ant.view==='colony') {
    const key=Math.round(target.x)+','+Math.round(target.y)
    if(ant.route?.key!==key)ant.route={key,points:nestRoute(state,ant,target).slice(),dug:state.dug}
    if(ant.route.dug!==state.dug&&!ant.route.points.length) {
      ant.route={key,points:nestRoute(state,ant,target).slice(),dug:state.dug}
    }
    if(dist(ant,target)<2)return true
    if(!ant.route.points.length)return false
    const point=ant.route.points[0]
    if(step(ant,point,dt,speed))ant.route.points.shift()
    return dist(ant,target)<2
  }
  return step(ant,target,dt,speed)
}
function step(ant,target,dt,speed) {
  const dx=target.x-ant.x,dy=target.y-ant.y,d=Math.hypot(dx,dy)
  if(!d)return true
  const ratio=Math.min(1,speed*dt/d)
  ant.x+=dx*ratio;ant.y+=dy*ratio;ant.dir=Math.atan2(dy,dx)
  return ratio===1
}
function dig(state,ant,tunnel,dt) {
  const route=nestRoute(state,ant,ant)
  if(!route.length)return
  const adjacent=state.tunnels.filter(t=>t.done&&dist(t,tunnel)<=24).sort((a,b)=>dist(a,ant)-dist(b,ant))[0]
  if(!adjacent||!moveAnt(state,ant,adjacent,dt))return
  tunnel.work+=dt
  if(tunnel.work>=1.4){tunnel.done=true;state.dug++;ant.earth=(ant.earth||0)+3}
}
export function applyManual(state,ant,dt,input) {
  ant.played+=dt
  if(ant.cross) {
    moveAnt(state,ant,queueAtPortal(state,ant),dt)
    return
  }
  const bounds=ant.view==='field'?FIELD:NEST
  if(input.x||input.y) {
    ant.move=null
    const n=Math.hypot(input.x,input.y)
    const target={x:Math.max(8,Math.min(bounds.w-8,ant.x+input.x/n*speedOf(ant)*dt)),y:Math.max(8,Math.min(bounds.h-8,ant.y+input.y/n*speedOf(ant)*dt))}
    if(ant.view==='field'||nestRoute(state,ant,target).length)step(ant,target,dt,speedOf(ant))
  }else if(ant.move&&moveAnt(state,ant,ant.move,dt)){
    if(ant.move.portal)queueAtPortal(state,ant)
    ant.move=null
  }
  if(ant.view==='field')reveal(state,ant,ant.role==='scout'?170:85)
}
export function updateAnts(state,dt,input) {
  const workers=state.ants.filter(a=>a.role==='worker'&&a.id!==state.selected)
  const pending=state.tunnels.find(t=>!t.done)
  const diggers=pending?Math.min(4,Math.max(1,Math.floor(workers.length/3))):0
  const canHarvest=!state.rain||state.portal.level===3
  const trails=canHarvest?state.trails.filter(t=>t.strength>.02):[]
  const jobs=new Map()
  let slot=diggers
  const assignments=trails.map(trail=>({trail,source:state.sources.find(s=>s.id===trail.source),count:0})).filter(j=>j.source)
  for(const j of [...assignments].sort((a,b)=>a.source.load-b.source.load)){
    j.count=Math.min(j.source.load,workers.length-slot)
    slot+=j.count
  }
  for(let extra=0;slot<workers.length&&assignments.length;slot++,extra++)assignments[extra%assignments.length].count++
  slot=diggers
  for(const j of assignments) {
    for(let k=0;k<j.count;k++)jobs.set(workers[slot++].id,j)
  }
  for(const ant of state.ants) {
    if(ant.id===state.selected){applyManual(state,ant,dt,input);continue}
    if(ant.role==='queen')continue
    const job=jobs.get(ant.id)
    if(ant.view==='field') {
      reveal(state,ant,ant.role==='scout'?170:68)
      if(ant.role==='scout'&&ant.explore&&!state.rain){
        const destinations=[{x:1010,y:490},{x:1100,y:920},{x:430,y:970},{x:380,y:492}]
        const index=ant.exploreIndex||0
        if(index<destinations.length){
          if(moveAnt(state,ant,destinations[index],dt))ant.exploreIndex=index+1
          continue
        }
        ant.explore=false;ant.exploreIndex=0
      }
      if(state.rain&&ant.role==='scout'){ant.explore=false;ant.exploreIndex=0}
      if(ant.cargo||!job) {
        if(ant.cargo&&job&&ant.cargo.source===job.source.id&&ant.waypoint>0){
          if(moveAnt(state,ant,job.trail.points[ant.waypoint-1],dt,ant.cargo.heavy?41:speedOf(ant)))ant.waypoint--
        }else moveAnt(state,ant,queueAtPortal(state,ant),dt)
        continue
      }
      if(ant.job!==job.source.id){ant.job=job.source.id;ant.waypoint=0}
      const next=job.trail.points[ant.waypoint]
      if(next&&moveAnt(state,ant,next,dt)){ant.waypoint++;job.trail.strength=Math.min(1,job.trail.strength+.045)}
      continue
    }
    if(ant.cargo) {
      const room=state.rooms.find(r=>r.type===ant.cargo.kind)||ROYAL
      if(moveAnt(state,ant,room,dt)) {
        ant.delivered+=storeResource(state,ant.cargo.kind,ant.cargo.amount)
        ant.cargo=null;ant.waypoint=0
      }
      continue
    }
    if(ant.earth) {
      if(moveAnt(state,ant,GATE.colony,dt)){
        storeResource(state,'earth',ant.earth);ant.earth=0
      }
      continue
    }
    if(ant.role==='soldier') {
      const guard=state.portal.guards.indexOf(ant.id)
      const at=guard>=0?{x:GATE.colony.x,y:132+guard*12}:state.rooms.find(r=>r.type==='barracks')||ROYAL
      moveAnt(state,ant,at,dt)
    }else if(ant.role==='scout'&&ant.explore)moveAnt(state,ant,queueAtPortal(state,ant),dt)
    else if(job)moveAnt(state,ant,queueAtPortal(state,ant),dt)
    else if(pending&&workers.indexOf(ant)<diggers){if(!pending.done)dig(state,ant,pending,dt)}
    else if(ant.cross)ant.cross=0
  }
  for(const j of assignments) {
    const group=state.ants.filter(a=>a.view==='field'&&!a.cargo&&a.job===j.source.id&&dist(a,j.source)<15)
    while(group.length>=j.source.load) {
      for(const ant of group.splice(0,j.source.load)){
        ant.cargo={kind:j.source.kind,source:j.source.id,amount:j.source.yield/j.source.load,heavy:j.source.load>1}
        ant.waypoint=j.trail.points.length-1
      }
    }
  }
}
export function manualDig(state,ant) {
  if(ant.view!=='colony')return false
  const tunnel=state.tunnels.find(t=>!t.done&&dist(ant,t)<45)
  if(!tunnel)return false
  tunnel.work+=.8
  if(tunnel.work>=1.4){tunnel.done=true;state.dug++;ant.earth=(ant.earth||0)+3}
  return true
}