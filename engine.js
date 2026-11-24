import {ageBrood,finishRooms,proposeDig,DAY,NIGHT} from './colony.js'
import {updateAnts} from './ants.js'
import {updateEnemies} from './enemies.js'
import {portalStep} from './portal.js'
export function simulate(state,dt,input={x:0,y:0},emit=()=>{}) {
  state.time+=dt
  state.stock.sugar=Math.max(0,state.stock.sugar-state.ants.length*.014*dt)
  const born=ageBrood(state,dt)
  if(state.time>=state.nextRain) {
    state.rain=24
    state.nextRain=state.time+200
    emit('Il pleut. Les pistes s’effacent et les ouvrières rentrent.')
  }
  state.rain=Math.max(0,state.rain-dt)
  for(const trail of state.trails)trail.strength-=dt*(state.rain&&state.portal.level<3?.035:state.time%DAY>NIGHT?.007:.003)
  state.trails=state.trails.filter(t=>t.strength>.02)
  updateAnts(state,dt,input)
  portalStep(state,dt)
  if(finishRooms(state))emit('Une nouvelle salle est prête.',true)
  if(Math.floor((state.time-dt)/4)!==Math.floor(state.time/4))proposeDig(state)
  updateEnemies(state,dt,emit)
  if(born)emit(born===1?'Une nouvelle fourmi est née !':born+' fourmis sont nées !',true)
}