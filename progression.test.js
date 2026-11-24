import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,planDig,buildRoom,newAnt} from './colony.js'
import {simulate} from './engine.js'
import {GATE} from './terrain.js'
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