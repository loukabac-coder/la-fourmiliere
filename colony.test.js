import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,ageBrood,lay,planDig,buildRoom,offline,addTrail,broodCapacity,HATCH_SECONDS,LAY_INTERVAL,storageCapacity,storeResource,guardCapacity} from './colony.js'
import {nestRoute,GATE} from './terrain.js'
import {portalStep,queueAtPortal,upgradePortal,requestCrossing} from './portal.js'
test('connected excavation, rooms and a fed brood',()=>{
 const s=createState()
 assert.ok(planDig(s,{x:576,y:264},{x:780,y:432})>8)
 for(const t of s.tunnels)t.done=true
 assert.ok(nestRoute(s,GATE.colony,{x:792,y:432}).length>8)
 s.stock.earth=10
 assert.ok(buildRoom(s,'brood',{x:792,y:432}))
 assert.ok(lay(s,'scout'))
 assert.equal(ageBrood(s,HATCH_SECONDS-1),0)
 assert.equal(ageBrood(s,1),1)
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
test('brood is limited by rooms, cooldown and feeding',()=>{
 const s=createState()
 assert.equal(broodCapacity(s),3)
 assert.ok(lay(s,'worker'))
 assert.equal(lay(s,'worker'),false)
 for(let i=0;i<2;i++){s.time+=LAY_INTERVAL;assert.ok(lay(s,'worker'))}
 s.time+=LAY_INTERVAL
 assert.equal(lay(s,'soldier'),false)
 s.rooms.push({x:720,y:264,radius:38,type:'brood'})
 assert.equal(broodCapacity(s),6)
 assert.ok(lay(s,'soldier'))
 s.stock.protein=0
 assert.equal(ageBrood(s,HATCH_SECONDS*2),0)
 s.stock.protein=4
 assert.equal(ageBrood(s,119),0)
 assert.equal(ageBrood(s,1),4)
})
test('storage and guard limits increase only with the right rooms',()=>{
 const s=createState()
 assert.equal(storageCapacity(s,'sugar'),36)
 assert.equal(storageCapacity(s,'protein'),18)
 assert.equal(storeResource(s,'protein',10),3)
 assert.equal(storeResource(s,'protein',10),0)
 s.rooms.push({type:'protein'},{type:'barracks'})
 assert.equal(storageCapacity(s,'protein'),42)
 assert.equal(storageCapacity(s,'sugar'),36)
 assert.equal(storeResource(s,'protein',50),24)
 assert.equal(guardCapacity(s),5)
})
test('manual crossing only queues a nearby ant and clears its old route',()=>{
 const s=createState(),a=s.ants[0]
 a.move={x:480,y:250}
 assert.equal(requestCrossing(s,a),false)
 assert.ok(a.move)
 Object.assign(a,GATE.colony)
 s.portal.closed=true
 assert.equal(requestCrossing(s,a),false)
 s.portal.closed=false
 assert.ok(requestCrossing(s,a))
 assert.equal(a.move,null)
 portalStep(s,1)
 assert.equal(a.view,'field')
 assert.equal(a.cross,0)
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