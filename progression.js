import {FIELD,GATE,dist,known,SOURCES} from './terrain.js'
import {addTrail,guardCapacity} from './colony.js'
export const MISSIONS={harvest:'Récolte',dig:'Creusement',guard:'Garde',scout:'Exploration'}
export const FINDS=[
  {id:'bark',x:259,y:805,name:'Écorce creuse',amber:4},
  {id:'dew',x:640,y:320,name:'Goutte dorée',amber:5},
  {id:'stone',x:1110,y:1130,name:'Caillou ambré',amber:6}
]
export function checkFinds(state,emit){
  state.finds??=[]
  for(const find of FINDS){
    if(state.finds.includes(find.id))continue
    const ant=state.ants.find(a=>a.view==='field'&&dist(a,find)<24)
    if(!ant)continue
    state.finds.push(find.id)
    state.amber=(state.amber??0)+find.amber
    award(state,ant,10)
    emit(find.name+' découverte · +'+find.amber+' ambres !',true)
  }
}
export function stats(ant){
  const xp=ant.xp??0, level=1+Math.floor(Math.sqrt(xp/20))
  const bonus=Math.min(level-1,12)
  return {xp,level,next:level*level*20,speed:1+bonus*.04,yield:1+bonus*.06,regen:1+bonus*.08}
}
export function award(state,ant,amount){
  const before=stats(ant).level
  ant.xp=(ant.xp??0)+amount
  const gained=stats(ant).level-before
  if(gained)state.amber=(state.amber??0)+gained*3
}
export function restoreProgression(state){
  state.missions??=[]
  state.amber??=0
  state.nextMission??=Math.max(0,...state.missions.map(m=>m.id))+1
  for(const source of SOURCES)if(!state.sources.some(p=>p.id===source.id))state.sources.push({...source})
}
export function availableAnts(state,type){
  const taken=new Set((state.missions||[]).flatMap(m=>m.members))
  const free=state.ants.filter(a=>a.role!=='queen'&&!taken.has(a.id)&&
    (type==='guard'?a.role==='soldier':type==='scout'?a.role==='scout'||a.role==='worker':a.role==='worker'))
    .sort((a,b)=>type==='scout'?Number(b.role==='scout')-Number(a.role==='scout'):0)
  if(type!=='guard')return free
  const posted=new Set(guardIds(state))
  const alreadyPosted=free.filter(a=>posted.has(a.id))
  return [...alreadyPosted,...free.filter(a=>!posted.has(a.id)).slice(0,Math.max(0,guardCapacity(state)-posted.size))]
}
export function assignMission(state,type,count,target){
  restoreProgression(state)
  if(!Object.hasOwn(MISSIONS,type)||!Number.isInteger(count)||count<1)return null
  const ready=availableAnts(state,type)
  if(count>ready.length)return null
  if(type==='harvest'){
    const source=state.sources.find(p=>p.id===target)
    if(!source||!known(state,source)||count<source.load)return null
    if(!state.trails.some(t=>t.source===target))addTrail(state,source)
  }else if(type==='scout'&&(!Number.isFinite(target?.x)||!Number.isFinite(target?.y)||target.x<0||target.y<0||target.x>FIELD.w||target.y>FIELD.h))return null
  const mission={id:state.nextMission++,type,target,members:ready.slice(0,count).map(a=>a.id)}
  state.missions.push(mission)
  return mission
}
export function guardIds(state){
  const guards=new Set(state.portal.guards)
  for(const mission of state.missions||[])if(mission.type==='guard')for(const id of mission.members)guards.add(id)
  return [...guards].slice(0,guardCapacity(state))
}
export function activeGuards(state){
  const guards=new Set(guardIds(state))
  return state.ants.filter(a=>a.role==='soldier'&&guards.has(a.id)&&a.view==='colony'&&dist(a,GATE.colony)<75)
}
export function finishMissions(state,emit){
  if(!state.missions?.length)return
  const ants=new Map(state.ants.map(a=>[a.id,a]))
  state.missions=state.missions.filter(m=>{
    m.members=m.members.filter(id=>ants.has(id))
    if(!m.members.length)return false
    if(m.type!=='scout'||!m.members.every(id=>ants.get(id).surveyed===m.id&&ants.get(id).view==='colony'))return true
    state.amber=(state.amber??0)+2
    emit('Expédition terminée. +2 ambres, le secteur reste découvert.',true)
    return false
  })
}