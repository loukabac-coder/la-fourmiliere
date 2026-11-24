import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,planDig,buildRoom,newAnt} from './colony.js'
import {simulate} from './engine.js'
import {CELL,GATE,canStep,excavated,nestRoute} from './terrain.js'
import {manualDig} from './ants.js'
import {updateWildlife} from './enemies.js'
test('direct excavation spends energy and pauses when exhausted',()=>{
  const s=createState(),a=s.ants[0]
  a.x=624;a.y=252;a.energy=37
  const target={x:648,y:264}
  assert.ok(manualDig(s,a,target))
  assert.ok(manualDig(s,a,target))
  assert.equal(a.energy,1)
  assert.equal(s.dug,1)
  assert.equal(manualDig(s,a,{x:672,y:264}),false)
  s.selected=a.id
  simulate(s,1)
  assert.ok(a.energy>1)
})
test('garden wildlife chases and trails track wandering resources',()=>{
  const s=createState(),a=s.ants[1],source=s.sources[3]
  a.view='field';a.x=1240;a.y=630
  s.trails.push({source:source.id,strength:1,points:[{...GATE.field},{x:source.x,y:source.y}]})
  const original=source.x
  updateWildlife(s,.1,()=>{})
  assert.ok(s.wildlife[0].chasing)
  assert.notEqual(source.x,original)
  assert.equal(s.trails[0].points[1].x,source.x)
})
test('idle workers feed the colony while the queen remains selected',()=>{
  const s=createState(),queen=s.ants[0],home={x:queen.x,y:queen.y}
  s.selected=queen.id
  advance(s,55)
  assert.deepEqual({x:queen.x,y:queen.y},home)
  assert.ok(s.ants.some(a=>a.trips>0&&a.delivered>0))
  assert.ok(s.ants.filter(a=>a.view==='colony').every(a=>excavated(s,a)))
  assert.equal(s.dug,0)
  assert.ok(s.digProposal)
  const {start,end}=s.digProposal
  assert.ok(planDig(s,start,end)>0)
  advance(s,65)
  assert.ok(s.dug>0&&s.stock.earth>0)
})
test('space between rooms is five cells and solid sites wait for excavation',()=>{
  const s=createState()
  s.stock.earth=40
  assert.equal(buildRoom(s,'brood',{x:576+4*CELL,y:252}),false)
  const site={x:576+5*CELL,y:264}
  assert.ok(buildRoom(s,'protein',site))
  assert.equal(s.rooms.length,1)
  assert.equal(s.roomProjects.length,1)
  assert.equal(buildRoom(s,'sugar',{x:site.x+CELL,y:site.y}),false)
  advance(s,70)
  assert.equal(s.roomProjects.length,0)
  assert.ok(s.rooms.some(r=>r.type==='protein'&&r.x===site.x))
})
test('solid cells and diagonal corners block movement',()=>{
  const s=createState()
  s.rooms=[]
  s.tunnels=[{x:240,y:240,done:true},{x:264,y:264,done:true}]
  assert.equal(canStep(s,{x:251,y:251},{x:253,y:253}),false)
  assert.deepEqual(nestRoute(s,{x:264,y:240},{x:264,y:264}),[])
  assert.deepEqual(nestRoute(s,{x:240,y:240},{x:264,y:264}),[])
})
const advance=(s,seconds)=>{for(let i=0;i<seconds*20;i++)simulate(s,.05)}
test('deep chamber construction uses excavated earth',()=>{
  const s=createState()
  s.ants.push(...Array.from({length:16},(_,i)=>newAnt(i+4,'worker')))
  s.nextId=20
  assert.ok(planDig(s,{x:576,y:264},{x:576,y:1008})>25)
  advance(s,340)
  assert.ok(s.tunnels.some(t=>t.y===1008&&t.done))
  assert.ok(buildRoom(s,'protein',{x:576,y:1008}))
})
test('selecting a worker leaves the other ants free and portal transit works',()=>{
  const s=createState(),a=s.ants[1]
  s.selected=a.id
  a.move={...GATE.colony,portal:true}
  advance(s,5)
  assert.equal(a.view,'field')
  assert.equal(a.trips,1)
  a.move={...GATE.field,portal:true}
  advance(s,5)
  assert.equal(a.view,'colony')
})
test('posted soldiers repel the first rival raid',()=>{
  const s=createState()
  s.ants.push(...Array.from({length:26},(_,i)=>newAnt(i+4,i<2?'soldier':'worker')))
  s.portal.guards=[4,5];s.rival=20
  advance(s,30)
  assert.equal(s.raidWon,true)
  assert.equal(s.record,30)
})