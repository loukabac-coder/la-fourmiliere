import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,ageBrood,lay,planDig,buildRoom,offline,addTrail} from './colony.js'
import {nestRoute,GATE} from './terrain.js'
import {portalStep,queueAtPortal,upgradePortal} from './portal.js'
test('connected excavation, rooms and a fed brood',()=>{
 const s=createState()
 assert.ok(planDig(s,{x:576,y:264},{x:780,y:432})>8)
 for(const t of s.tunnels)t.done=true
 assert.ok(nestRoute(s,GATE.colony,{x:792,y:432}).length>8)
 s.stock.earth=10
 assert.ok(buildRoom(s,'brood',{x:792,y:432}))
 assert.ok(lay(s,'scout'))
 ageBrood(s,9)
 assert.equal(ageBrood(s,15),1)
 assert.equal(s.ants.at(-1).role,'scout')
})
test('closed portal preserves queue and upgrade lets ants cross',()=>{
 const s=createState()
 const [a,b]=s.ants.slice(1)
 Object.assign(a,GATE.colony);Object.assign(b,GATE.colony)
 queueAtPortal(s,a);queueAtPortal(s,b)
 s.portal.closed=true
 portalStep(s,1)
 assert.equal(a.view,'colony')
 s.portal.closed=false;s.stock.earth=99
 assert.ok(upgradePortal(s))
 portalStep(s,1)
 assert.equal(a.view,'field')
 assert.equal(b.view,'colony')
 portalStep(s,1)
 assert.equal(b.view,'field')
})
test('idle time is capped and creates no attacks',()=>{
 const s=createState()
 addTrail(s,s.sources[0]);lay(s,'worker')
 const report=offline(s,999999)
 assert.equal(report.elapsed,28800)
 assert.equal(report.born,1)
 assert.ok(report.sugar>0)
 assert.equal(s.raid,null)
})