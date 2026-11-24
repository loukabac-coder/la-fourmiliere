import {CELL,GATE,FIELD,NEST,dist,nestRoute,reveal,excavated,cellKey,canStep,SOURCES,known} from './terrain.js'
import {queueAtPortal} from './portal.js'
import {ROYAL,storageCapacity,storeResource,addTrail} from './colony.js'
import {stats,award,guardIds} from './progression.js'
import {studyLevel} from './journal.js'
export const speedOf = ant=>(ant.role==='scout'?108:ant.role==='soldier'?65:73)*stats(ant).speed
export function moveAnt(state,ant,target,dt,speed=speedOf(ant)) {
  if(ant.view==='colony') {
    const key=Math.round(target.x)+','+Math.round(target.y)
    const layout=state.dug+':'+state.rooms.length
    if(ant.route?.key!==key||ant.route.layout!==layout)ant.route={key,points:nestRoute(state,ant,target),layout}
    if(dist(ant,target)<.01){Object.assign(ant,{x:target.x,y:target.y});return true}
    if(!ant.route.points.length)return false
    const point=ant.route.points[0]
    if(step(ant,point,dt,speed))ant.route.points.shift()
    return dist(ant,target)<.01
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
  const adjacent=[[0,0],[CELL,0],[-CELL,0],[0,CELL],[0,-CELL]]
    .map(([dx,dy])=>({x:tunnel.x+dx,y:tunnel.y+dy}))
    .filter(p=>excavated(state,p)&&nestRoute(state,ant,p).length)
    .sort((a,b)=>dist(a,ant)-dist(b,ant))[0]
  if(!adjacent||!moveAnt(state,ant,adjacent,dt))return
  tunnel.work+=dt*stats(ant).speed*(1+studyLevel(state,'dig')*.15)
  if(tunnel.work>=1.4){tunnel.done=true;state.dug++;ant.earth=(ant.earth||0)+3*stats(ant).yield;award(state,ant,5)}
}
function revealAround(state,ant,radius){
  const discovered=reveal(state,ant,radius)
  if(ant.role!=='scout'||!discovered)return
  const total=(ant.scoutCells??0)+discovered
  ant.scoutCells=total%4
  if(total>=4)award(state,ant,Math.floor(total/4))
}
export function applyManual(state,ant,dt,input) {
  ant.played+=dt

  if(ant.cross&&(input.x||input.y))ant.cross=0
  if(ant.cross) {
    moveAnt(state,ant,queueAtPortal(state,ant),dt)
    return
  }
  const bounds=ant.view==='field'?FIELD:NEST
  if(input.x||input.y) {
    ant.move=null
    const n=Math.hypot(input.x,input.y)
    const target={x:Math.max(8,Math.min(bounds.w-8,ant.x+input.x/n*speedOf(ant)*dt)),y:Math.max(8,Math.min(bounds.h-8,ant.y+input.y/n*speedOf(ant)*dt))}
    if(ant.view==='field'||canStep(state,ant,target))step(ant,target,dt,speedOf(ant))
    ant.route=null
  }else if(ant.move&&moveAnt(state,ant,ant.move,dt)){
    if(ant.move.portal)queueAtPortal(state,ant)
    ant.move=null
  }
  if(ant.view==='field')revealAround(state,ant,ant.role==='scout'?170:85)
}
export function updateAnts(state,dt,input) {
  const missions=new Map()
  for(const order of state.missions||[])for(const id of order.members)missions.set(id,order)
  const guards=guardIds(state)
  const workers=state.ants.filter(a=>a.role==='worker'&&a.id!==state.selected&&!missions.has(a.id))
  const pending=state.tunnels.find(t=>!t.done)
  if(workers.length&&!state.rain){
    const active=state.trails.some(t=>t.strength>.02)
    if(!active)for(const starter of SOURCES.slice(0,2)){
      const source=state.sources.find(p=>p.id===starter.id)
      if(source&&known(state,source)&&!state.trails.some(t=>t.source===source.id)&&
         (workers.length>=2||source.kind===(state.stock.protein<6?'protein':'sugar')))addTrail(state,source)
    }
  }
  const queuedDiggers=[...missions.values()].some(order=>order.type==='dig')
  const diggers=pending&&!queuedDiggers?Math.min(4,Math.max(1,Math.floor(workers.length/3))):0
  const canHarvest=!state.rain||state.portal.level===3
  if(canHarvest)for(const order of state.missions||[]){
    if(order.type!=='harvest'||state.trails.some(t=>t.source===order.target))continue
    const source=state.sources.find(p=>p.id===order.target)
    if(source)addTrail(state,source)
  }
  const trails=canHarvest?state.trails.filter(t=>t.strength>.02):[]
  const jobs=new Map()
  let slot=diggers
  const assignments=trails.map(trail=>({trail,source:state.sources.find(s=>s.id===trail.source),count:0})).filter(j=>j.source)
  const harvestTargets=new Map(assignments.map(job=>[job.source.id,job]))
  const reserved=new Set()
  for(const [id,order] of missions){
    if(order.type!=='harvest')continue
    const job=harvestTargets.get(order.target)
    reserved.add(order.target)
    if(job)jobs.set(id,job)
  }
  const automatic=assignments.filter(job=>!reserved.has(job.source.id))
  for(const j of [...automatic].sort((a,b)=>a.source.load-b.source.load)){
    j.count=Math.min(j.source.load,workers.length-slot)
    slot+=j.count
  }
  for(let extra=0;slot<workers.length&&automatic.length;slot++,extra++)automatic[extra%automatic.length].count++
  slot=diggers
  for(const j of assignments) {
    for(let k=0;k<j.count;k++)jobs.set(workers[slot++].id,j)
  }
  for(const ant of state.ants) {
    if((ant.energy??100)<100)ant.energy=Math.min(100,ant.energy+dt*7*stats(ant).regen*(1+studyLevel(state,'rest')*.2))
    if(ant.id===state.selected){applyManual(state,ant,dt,input);continue}
    if(ant.role==='queen'){ant.cross=0;continue}
    const job=jobs.get(ant.id),order=missions.get(ant.id)
    const exploring=order?.type==='scout'&&ant.surveyed!==order.id&&!state.rain
    if(ant.view==='field') {
      revealAround(state,ant,ant.role==='scout'?170:68)
      if(exploring&&!ant.cargo){
        ant.cross=0
        if(moveAnt(state,ant,order.target,dt)){
          revealAround(state,ant,ant.role==='scout'?210:125)
          ant.surveyed=order.id
          award(state,ant,12)
        }
        continue
      }
      if(!order&&ant.role==='scout'&&ant.explore&&!state.rain){
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
          ant.waypoint=Math.min(ant.waypoint,job.trail.points.length-1)
          if(moveAnt(state,ant,job.trail.points[ant.waypoint-1],dt,ant.cargo.heavy?41:speedOf(ant)))ant.waypoint--
        }else moveAnt(state,ant,queueAtPortal(state,ant),dt)
        continue
      }
      if(ant.job!==job.source.id){ant.job=job.source.id;ant.waypoint=0}
      const next=job.trail.points[ant.waypoint]||job.source
      if(next&&moveAnt(state,ant,next,dt)){ant.waypoint=Math.min(ant.waypoint+1,job.trail.points.length);job.trail.strength=Math.min(1,job.trail.strength+.045)}
      continue
    }
    if(ant.cargo||ant.earth||(!job&&!exploring&&!(ant.role==='scout'&&ant.explore)))ant.cross=0
    if(ant.cargo) {
      const room=state.rooms.find(r=>r.type===ant.cargo.kind)||ROYAL
      if(moveAnt(state,ant,room,dt)) {
        deliverCargo(state,ant)
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
      const guard=guards.indexOf(ant.id)
      const at=guard>=0?{x:GATE.colony.x,y:132+Math.min(4,guard)*12}:state.rooms.find(r=>r.type==='barracks')||ROYAL
      moveAnt(state,ant,at,dt)
    }else if(exploring||(!order&&ant.role==='scout'&&ant.explore&&!state.rain))moveAnt(state,ant,queueAtPortal(state,ant),dt)
    else if(job&&state.stock[job.source.kind]<storageCapacity(state,job.source.kind))moveAnt(state,ant,queueAtPortal(state,ant),dt)
    else if(pending&&(order?.type==='dig'||(!order&&workers.indexOf(ant)<diggers))){if(!pending.done)dig(state,ant,pending,dt)}
    else if(ant.cross)ant.cross=0
  }
  for(const j of assignments) {
    const group=state.ants.filter(a=>a.view==='field'&&a.id!==state.selected&&jobs.get(a.id)===j&&!a.cargo&&a.job===j.source.id&&dist(a,j.source)<15)
    while(group.length>=j.source.load) {
      for(const ant of group.splice(0,j.source.load)){
        ant.cargo={kind:j.source.kind,source:j.source.id,amount:j.source.yield/j.source.load,heavy:j.source.load>1}
        ant.waypoint=j.trail.points.length-1
      }
    }
  }
}
export function deliverCargo(state,ant) {
  const amount=storeResource(state,ant.cargo.kind,ant.cargo.amount*stats(ant).yield*(1+studyLevel(state,'haul')*.1))
  ant.delivered+=amount
  if(amount>0)award(state,ant,ant.cargo.heavy?6:4)
  return amount
}
export function manualDig(state,ant,point) {
  if(ant.view!=='colony'||(ant.energy??100)<18)return false
  const target=point?{x:Math.round(point.x/CELL)*CELL,y:Math.round(point.y/CELL)*CELL}:state.tunnels.find(t=>!t.done&&dist(ant,t)<45)
  if(!target||dist(ant,target)>63||target.x<CELL||target.x>NEST.w-CELL||target.y<120||target.y>NEST.h-CELL)return false
  const adjacent=[[CELL,0],[-CELL,0],[0,CELL],[0,-CELL]].some(([dx,dy])=>excavated(state,{x:target.x+dx,y:target.y+dy}))
  let tunnel=state.tunnels.find(t=>cellKey(t)===cellKey(target))
  if(tunnel?.done||!adjacent||(!tunnel&&excavated(state,target)))return false
  if(!tunnel){tunnel={...target,done:false,work:0};state.tunnels.push(tunnel)}
  ant.energy=(ant.energy??100)-18
  tunnel.work+=.8*(1+studyLevel(state,'dig')*.15)
  if(tunnel.work>=1.4){tunnel.done=true;state.dug++;ant.earth=(ant.earth||0)+3*stats(ant).yield;award(state,ant,5)}
  return true
}