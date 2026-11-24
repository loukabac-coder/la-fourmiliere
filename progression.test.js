import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,planDig,buildRoom,newAnt} from './colony.js'
import {simulate} from './engine.js'
import {GATE} from './terrain.js'
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