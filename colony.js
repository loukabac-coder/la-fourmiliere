import {CELL,GATE,NEST,FIELD,SOURCES,gridLine,cellKey,dist,excavated,reveal,nestRoute} from './terrain.js'
import {BLOOM_ID,studyLevel,updateGarden} from './journal.js'
export const ROYAL={x:576,y:252,radius:66,type:'queen'}
export const NIGHT=165
export const DAY=240
export const HATCH_SECONDS=180
export const LARVA_SECONDS=60
export const LAY_INTERVAL=30
export const ROOM_LIMITS={brood:3,sugar:36,protein:24,barracks:3}
export function newAnt(id,role,at=ROYAL) {
  return {id,role,x:at.x+(id%5-2)*8,y:at.y+(id%3-1)*7,view:'colony',trips:0,delivered:0,played:0,dir:0,hp:3,cross:0}
}
export function createState() {
  const state={ants:[newAnt(0,'queen'),...[1,2,3].map(id=>newAnt(id,'worker'))],rooms:[{...ROYAL}],tunnels:gridLine(GATE.colony,ROYAL).map(p=>({...p,done:true})),dug:0,brood:[],stock:{sugar:30,protein:15,earth:0},portal:{level:1,closed:false,cooldown:0,guards:[]},sources:SOURCES.map(x=>({...x})),trails:[],fog:{},memorial:[],rain:0,time:0,nextRain:210,record:4,nextId:4,queueId:0,tutorial:true,raid:null,raidWon:false,rival:6,spider:{x:1070,y:555},rivalAnts:[],camera:{colony:{x:576,y:265,zoom:1},field:{x:720,y:720,zoom:1}},view:'colony',selected:null}
  state.tunnels.unshift({...GATE.colony,done:true})
  reveal(state,GATE.field,185)
  return state
}
export const nurseries=state=>state.rooms.filter(r=>r.type==='queen'||r.type==='brood')
export const broodCapacity=state=>nurseries(state).length*ROOM_LIMITS.brood
export const layDelay=state=>Math.max(0,(state.nextLayAt??0)-state.time)
export const guardCapacity=state=>state.portal.level+1+state.rooms.filter(r=>r.type==='barracks').length*ROOM_LIMITS.barracks
export function broodLayout(state){
  const rooms=nurseries(state), counts=new Map(rooms.map(r=>[cellKey(r),0]))
  return state.brood.map(egg=>{
    const saved=rooms.find(r=>cellKey(r)===egg.nursery&&counts.get(egg.nursery)<ROOM_LIMITS.brood)
    const room=saved||rooms.find(r=>counts.get(cellKey(r))<ROOM_LIMITS.brood)||rooms[0]
    if(!room)return {egg,room:ROYAL,slot:0}
    const key=cellKey(room),slot=counts.get(key)
    counts.set(key,slot+1)
    return {egg,room,slot}
  })
}
export function layIssue(state){
  if(state.brood.length>=broodCapacity(state))return 'Couvées pleines. Aménage un couvain pour ajouter 3 places.'
  if(layDelay(state)>0)return 'Prochain œuf dans '+Math.ceil(layDelay(state))+' s.'
  if(state.stock.sugar<2)return 'Il faut 2 sucres pour pondre.'
  return ''
}
export function lay(state,role) {
  if(!['worker','soldier','scout'].includes(role)||layIssue(state))return false
  const occupied=new Map()
  for(const {room} of broodLayout(state))occupied.set(cellKey(room),(occupied.get(cellKey(room))||0)+1)
  const room=nurseries(state).find(r=>(occupied.get(cellKey(r))||0)<ROOM_LIMITS.brood)
  state.stock.sugar-=2
  state.nextLayAt=state.time+LAY_INTERVAL
  state.brood.push({role,age:0,fed:false,nursery:cellKey(room)})
  return true
}
export function ageBrood(state,dt) {
  if(!state.brood.length){state.record=Math.max(state.record,state.ants.length);return 0}
  let born=0
  state.brood=broodLayout(state).filter(({egg,room})=>{
    let remaining=dt
    if(!egg.fed&&egg.age<LARVA_SECONDS){
      const advance=Math.min(remaining,LARVA_SECONDS-egg.age)
      egg.age+=advance;remaining-=advance
    }
    if(!egg.fed&&egg.age>=LARVA_SECONDS&&state.stock.protein>=1){
      state.stock.protein--;egg.fed=true
    }
    if(egg.fed)egg.age+=remaining
    if(egg.age+1e-8<HATCH_SECONDS||!egg.fed)return true
    state.ants.push(newAnt(state.nextId++,egg.role,room))
    born++
    return false
  }).map(item=>item.egg)
  state.record=Math.max(state.record,state.ants.length)
  return born
}
export function planDig(state,start,end) {
  if(!excavated(state,start))return 0
  const occupied=new Set(state.tunnels.map(cellKey))
  const first={x:Math.round(start.x/CELL)*CELL,y:Math.round(start.y/CELL)*CELL}
  const route=[first,...gridLine(start,end)].filter(p=>p.x>=CELL&&p.x<=NEST.w-CELL&&p.y>=120&&p.y<=NEST.h-CELL&&!occupied.has(cellKey(p)))
  state.tunnels.push(...route.map(p=>({...p,done:false,work:0})))
  return route.length
}
export function proposeDig(state) {
  if(state.digProposal||state.tunnels.some(t=>!t.done)||!state.ants.some(a=>a.role==='worker'))return
  const starts=[...state.tunnels.filter(t=>t.done)].sort((a,b)=>b.y-a.y)
  for(const start of starts){
    for(const [dx,dy] of [[0,6],[6,0],[-6,0]]){
      const end={x:start.x+dx*CELL,y:start.y+dy*CELL}
      if(end.y>NEST.h-CELL||end.x<CELL||end.x>NEST.w-CELL||
         !gridLine(start,end).some(p=>!excavated(state,p)))continue
      state.digProposal={start:{x:start.x,y:start.y},end}
      return
    }
  }
}
export function finishRooms(state) {
  if(!state.roomProjects?.length)return 0
  const ready=state.roomProjects.filter(room=>nestRoute(state,GATE.colony,room).length)
  state.roomProjects=state.roomProjects.filter(room=>!ready.includes(room))
  state.rooms.push(...ready)
  return ready.length
}
export const roomCost=type=>type==='barracks'?10:6
export const snapRoom=p=>({x:Math.round(p.x/CELL)*CELL,y:Math.round(p.y/CELL)*CELL})
export function roomIssue(state,type,p) {
  const site=snapRoom(p),{x,y}=site
  if(x<2*CELL||x>NEST.w-2*CELL||y<7*CELL||y>NEST.h-2*CELL)return 'Choisis un emplacement à l’intérieur du sous-sol.'
  if([...state.rooms,...(state.roomProjects||[])].some(room=>dist(snapRoom(room),site)<=4*CELL))return 'Laisse plus de 4 blocs entre les centres des salles, salle royale comprise.'
  if(!excavated(state,site)||!nestRoute(state,GATE.colony,site).length)return 'Choisis une case déjà creusée et reliée au nid.'
  const cost=roomCost(type)
  if(state.stock.earth<cost)return 'Il faut '+cost+' terres.'
  return ''
}
export function buildRoom(state,type,p) {
  if(!Object.hasOwn(ROOM_LIMITS,type)||roomIssue(state,type,p))return false
  state.rooms.push({...snapRoom(p),radius:38,type})
  state.stock.earth-=roomCost(type)
  return true
}
export function addTrail(state,source,points=[]) {
  const old=state.trails.find(t=>t.source===source.id)
  const trail={source:source.id,points:[{...GATE.field},...points.filter(p=>p.x>=0&&p.y>=0&&p.x<=FIELD.w&&p.y<=FIELD.h),{x:source.x,y:source.y}],strength:1}
  if(old)Object.assign(old,trail)
  else state.trails.push(trail)
}
export const BASE_STORAGE={sugar:36,protein:18}
export const storageCapacity=(state,kind)=>kind==='earth'?Infinity:BASE_STORAGE[kind]+state.rooms.filter(r=>r.type===kind).length*ROOM_LIMITS[kind]
export function storeResource(state,kind,amount) {
  const capacity=storageCapacity(state,kind)
  const added=Math.max(0,Math.min(amount,capacity-state.stock[kind]))
  state.stock[kind]+=added
  return added
}
export function offline(state,seconds) {
  const elapsed=Math.max(0,Math.min(28800,seconds))
  let sugar=0,born=0,erased=0
  const workers=state.ants.filter(a=>a.role==='worker')
  const taken=new Set((state.missions||[]).flatMap(m=>m.members))
  const free=workers.filter(a=>!taken.has(a.id)).length
  const harvest=new Map()
  const living=new Set(workers.map(a=>a.id))
  for(const order of state.missions||[])if(order.type==='harvest'){
    harvest.set(order.target,(harvest.get(order.target)||0)+order.members.filter(id=>living.has(id)).length)
  }
  if(!elapsed)return {elapsed,sugar,born,erased}
  const faded=new Set(state.trails.filter(t=>workers.length===0&&elapsed*t.strength>80||elapsed>=DAY&&t.strength<.24))
  const active=state.trails.filter(t=>!faded.has(t))
  const automatic=active.filter(t=>!harvest.has(t.source))
  const routes=active.map(t=>{
    const source=state.sources.find(s=>s.id===t.source)
    const trip=t.points.slice(1).reduce((total,p,j)=>total+dist(p,t.points[j]),0)*2/69+5
    const index=automatic.indexOf(t)
    const available=harvest.get(t.source)??(Math.floor(free/automatic.length)+(index<free%automatic.length?1:0))
    return {source,trip,available}
  }).filter(({source,available})=>source&&available>=source.load)
  const steps=Math.ceil(elapsed/10)
  for(let i=0;i<steps;i++) {
    const dt=Math.min(10,elapsed-i*10)
    if(!state.portal.closed)for(const {source,trip,available} of routes){
      const duration=source.id===BLOOM_ID?Math.max(0,Math.min(dt,state.bloomUntil-state.time-i*10)):dt
      const gain=storeResource(state,source.kind,duration/trip*source.yield*available/source.load*(1+studyLevel(state,'haul')*.1))
      if(source.kind==='sugar')sugar+=gain
    }
    state.stock.sugar=Math.max(0,state.stock.sugar-state.ants.length*.014*dt)
    born+=ageBrood(state,dt)
  }
  state.trails=active
  erased=faded.size
  state.time+=elapsed
  state.nextRain=Math.max(state.nextRain,state.time+45)
  state.rain=0
  updateGarden(state,false)
  return {elapsed,sugar:Math.floor(sugar),born,erased}
}