import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,addTrail,planDig,newAnt} from './colony.js'
import {simulate} from './engine.js'
test('workers find the gateway, follow a trail and deliver food',()=>{
  const s=createState()
  addTrail(s,s.sources[0])
  for(let i=0;i<900;i++)simulate(s,.05)
  assert.ok(s.ants.some(a=>a.delivered>0))
})
test('workers excavate and bring earth back to the gate',()=>{
  const s=createState()
  planDig(s,{x:576,y:264},{x:576,y:528})
  for(let i=0;i<3200;i++)simulate(s,.05)
  assert.ok(s.dug>=8)
  assert.ok(s.stock.earth>=18)
})
test('five ants assemble to move heavy food',()=>{
  const s=createState()
  s.ants.push(newAnt(4,'worker'),newAnt(5,'worker'),newAnt(6,'worker'))
  s.nextId=7; s.stock.sugar=0
  addTrail(s,s.sources[2])
  for(let i=0;i<1100;i++)simulate(s,.05)
  assert.ok(s.ants.reduce((amount,a)=>amount+a.delivered,0)>=45)
})