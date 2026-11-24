import {GATE,dist} from './terrain.js'
export const LEVELS = ['Trou','Cratère','Dôme']
export function portalStep(state,dt) {
  const gate=state.portal
  gate.cooldown=Math.max(0,gate.cooldown-dt)
  if(gate.closed||gate.cooldown>0)return
  const first=state.ants.filter(ant=>ant.cross&&dist(ant,GATE[ant.view])<80).sort((a,b)=>a.cross-b.cross)[0]
  if(!first)return
  const from=first.view
  first.view=from==='field'?'colony':'field'
  Object.assign(first,GATE[first.view])
  first.cross=0
  first.move=null
  first.route=null
  if(first.view==='field')first.trips++
  gate.cooldown=1.3/[1,2,3][gate.level-1]
}
export function queueAtPortal(state,ant) {
  ant.cross ||= ++state.queueId
  const others=state.ants.filter(other=>other.view===ant.view&&other.cross&&other.cross<ant.cross).length
  const gate=GATE[ant.view]
  return ant.view==='field'?{x:gate.x-Math.min(70,others*9),y:gate.y}:{x:gate.x,y:gate.y+Math.min(72,others*12)}
}
export function upgradePortal(state) {
  const cost={earth:state.portal.level*18,sugar:state.portal.level*14}
  if(state.portal.level===3||Object.keys(cost).some(key=>state.stock[key]<cost[key])) return false
  for(const key of Object.keys(cost))state.stock[key]-=cost[key]
  state.portal.level++
  return true
}