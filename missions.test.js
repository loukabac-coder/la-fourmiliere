import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,newAnt,planDig} from './colony.js'
import {simulate} from './engine.js'
import {GATE,known} from './terrain.js'
import {assignMission,availableAnts,award,stats,checkFinds,FINDS} from './progression.js'
const run=(s,seconds)=>{for(let n=0;n<seconds*20;n++)simulate(s,.05)}
test('specified groups work simultaneously and gain individual experience',()=>{
  const s=createState(),source=s.sources[1]
  s.stock.protein=0
  assert.equal(assignMission(s,'harvest',0,source.id),null)
  assert.equal(assignMission(s,'harvest',1,7),null)
  const forage=assignMission(s,'harvest',2,source.id)
  const dig=assignMission(s,'dig',1)
  assert.equal(availableAnts(s,'dig').length,0)
  assert.ok(!dig.members.some(id=>forage.members.includes(id)))
  run(s,5)
  assert.equal(s.dug,0)
  planDig(s,{x:576,y:264},{x:576,y:432})
  run(s,100)
  assert.ok(s.ants.find(a=>dig.members.includes(a.id)).xp>=5)
  for(const a of s.ants.filter(a=>forage.members.includes(a.id))){
    assert.ok(a.delivered>0)
    assert.ok(a.xp>0)
  }
})
test('exploration reveals the target and releases the group when it returns',()=>{
  const s=createState()
  s.ants.push(newAnt(8,'scout'))
  const target={x:820,y:410}
  assert.equal(known(s,target),false)
  const order=assignMission(s,'scout',1,target)
  assert.deepEqual(order.members,[8])
  run(s,40)
  assert.ok(known(s,target))
  assert.ok(!s.missions.some(m=>m.id===order.id))
  assert.equal(s.ants.find(a=>a.id===8).view,'colony')
  assert.ok(s.amber>=2)
})
test('levels improve individual stats and discoveries reward only once',()=>{
  const s=createState(),a=s.ants[1]
  award(s,a,20)
  assert.equal(stats(a).level,2)
  assert.ok(stats(a).speed>1&&stats(a).yield>1&&stats(a).regen>1)
  assert.equal(s.amber,3)
  Object.assign(a,FINDS[0],{id:1,view:'field'})
  checkFinds(s,()=>{})
  checkFinds(s,()=>{})
  assert.equal(s.amber,7)
  assert.deepEqual(s.finds,[FINDS[0].id])
})