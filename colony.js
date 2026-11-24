import {CELL,GATE,NEST,FIELD,SOURCES,gridLine,cellKey,dist,excavated,reveal,nestRoute} from './terrain.js'
export const ROYAL={x:576,y:252,radius:66,type:'queen'}
export const NIGHT=165
export const DAY=240
export function newAnt(id,role,at=ROYAL) {
  return {id,role,x:at.x+(id%5-2)*8,y:at.y+(id%3-1)*7,view:'colony',trips:0,delivered:0,played:0,dir:0,hp:3,cross:0}
}
export function createState() {
  const state={ants:[newAnt(0,'queen'),...[1,2,3].map(id=>newAnt(id,'worker'))],rooms:[{...ROYAL}],tunnels:gridLine(GATE.colony,ROYAL).map(p=>({...p,done:true})),dug:0,brood:[],stock:{sugar:30,protein:15,earth:0},portal:{level:1,closed:false,cooldown:0,guards:[]},sources:SOURCES.map(x=>({...x})),trails:[],fog:{},memorial:[],rain:0,time:0,nextRain:210,record:4,nextId:4,queueId:0,tutorial:true,raid:null,raidWon:false,rival:6,spider:{x:1070,y:555},rivalAnts:[],camera:{colony:{x:576,y:265,zoom:1},field:{x:720,y:720,zoom:1}},view:'colony',selected:null}
  state.tunnels.unshift({...GATE.colony,done:true})
  reveal(state,GATE.field,185)
  return state
}
export function lay(state,role) {
  if(state.stock.sugar<2||state.brood.length>=6+state.rooms.filter(r=>r.type==='brood').length*10)return false
  state.stock.sugar-=2
  state.brood.push({role,age:0,fed:false})
  return true
}
export function ageBrood(state,dt) {
  let born=0
  for(const egg of state.brood) {
    if(egg.age>=9&&!egg.fed&&state.stock.protein>=1){state.stock.protein--;egg.fed=true}
    if(egg.age<9||egg.fed)egg.age+=dt
  }
  state.brood=state.brood.filter(egg=>{
    if(egg.age<24||!egg.fed)return true
    const at=state.rooms.find(r=>r.type==='brood')||ROYAL
    state.ants.push(newAnt(state.nextId++,egg.role,at))
    born++
    return false
  })
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
export function roomIssue(state,type,p) {
  const x=Math.round(p.x/CELL)*CELL,y=Math.round(p.y/CELL)*CELL
  if(x<2*CELL||x>NEST.w-2*CELL||y<7*CELL||y>NEST.h-2*CELL)return 'Choisis un emplacement à l’intérieur du sous-sol.'
  if([...state.rooms,...(state.roomProjects||[])].some(room=>dist(room,{x,y})<5*CELL))return 'Laisse au moins 5 blocs entre les centres des salles.'
  const cost=type==='barracks'?10:6
  if(state.stock.earth<cost)return 'Il faut '+cost+' terres.'
  return ''
}
export function buildRoom(state,type,p) {
  const site={x:Math.round(p.x/CELL)*CELL,y:Math.round(p.y/CELL)*CELL,radius:38,type}
  const cost=type==='barracks'?10:6
  if(!['brood','sugar','protein','barracks'].includes(type)||roomIssue(state,type,p))return false
  if(nestRoute(state,GATE.colony,site).length)state.rooms.push(site)
  else{
    const start=state.tunnels.filter(t=>t.done&&nestRoute(state,GATE.colony,t).length)
      .sort((a,b)=>dist(a,site)-dist(b,site))[0]
    if(!start)return false
    planDig(state,start,site)
    state.roomProjects??=[]
    state.roomProjects.push(site)
  }
  state.stock.earth-=cost
  return true
}
export function addTrail(state,source,points=[]) {
  const old=state.trails.find(t=>t.source===source.id)
  const trail={source:source.id,points:[{...GATE.field},...points.filter(p=>p.x>=0&&p.y>=0&&p.x<=FIELD.w&&p.y<=FIELD.h),{x:source.x,y:source.y}],strength:1}
  if(old)Object.assign(old,trail)
  else state.trails.push(trail)
}
export function storeResource(state,kind,amount) {
  const capacity=kind==='earth'?Infinity:60+state.rooms.filter(r=>r.type===kind).length*65
  const added=Math.max(0,Math.min(amount,capacity-state.stock[kind]))
  state.stock[kind]+=added
  return added
}
export function offline(state,seconds) {
  const elapsed=Math.max(0,Math.min(28800,seconds))
  let sugar=0,born=0,erased=0
  const workers=state.ants.filter(a=>a.role==='worker').length
  if(!elapsed)return {elapsed,sugar,born,erased}
  const faded=new Set(state.trails.filter(t=>workers===0&&elapsed*t.strength>80||elapsed>=DAY&&t.strength<.24))
  const active=state.trails.filter(t=>!faded.has(t))
  const steps=Math.ceil(elapsed/10)
  for(let i=0;i<steps;i++) {
    const dt=Math.min(10,elapsed-i*10)
    active.forEach((t,index)=>{
      const available=Math.floor(workers/active.length)+(index<workers%active.length?1:0)
      const source=state.sources.find(s=>s.id===t.source)
      if(!source||available<source.load||state.portal.closed)return
      const trip=t.points.slice(1).reduce((total,p,j)=>total+dist(p,t.points[j]),0)*2/69+5
      const gain=storeResource(state,source.kind,dt/trip*source.yield*available/source.load)
      if(source.kind==='sugar')sugar+=gain
    })
    state.stock.sugar=Math.max(0,state.stock.sugar-state.ants.length*.014*dt)
    born+=ageBrood(state,dt)
  }
  state.trails=active
  erased=faded.size
  state.time+=elapsed
  state.nextRain=Math.max(state.nextRain,state.time+45)
  state.rain=0
  return {elapsed,sugar:Math.floor(sugar),born,erased}
}