import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createState,addTrail,offline} from './colony.js'
import {simulate} from './engine.js'
import {BLOOM_ID,buyStudy,claimMilestone,studyLevel,unclaimedCount} from './journal.js'
test('milestones reward once and studies debit amber only on valid purchases',()=>{
 const s=createState()
 s.dug=6
 assert.equal(claimMilestone(s,'tunnel'),true)
 assert.equal(claimMilestone(s,'tunnel'),false)
 assert.equal(unclaimedCount(s),0)
 assert.equal(buyStudy(s,'dig'),false)
 s.amber=40
 assert.ok(buyStudy(s,'dig'))
 assert.ok(buyStudy(s,'dig'))
 assert.ok(buyStudy(s,'dig'))
 assert.equal(studyLevel(s,'dig'),3)
 assert.equal(s.amber,4)
 assert.equal(buyStudy(s,'dig'),false)
})
test('rain creates a single temporary nectar source and expiration releases crews',()=>{
 const s=createState()
 s.rain=.02
 simulate(s,.05)
 const source=s.sources.find(p=>p.id===BLOOM_ID)
 assert.ok(source)
 addTrail(s,source)
 s.missions=[{id:1,type:'harvest',target:BLOOM_ID,members:[1]}]
 s.time=s.bloomUntil
 simulate(s,.05)
 assert.ok(!s.sources.some(p=>p.id===BLOOM_ID))
 assert.ok(!s.trails.some(t=>t.source===BLOOM_ID))
 assert.equal(s.missions.length,0)
})
test('offline harvest respects dedicated crews and temporary resources',()=>{
 const s=createState()
 s.rain=.02
 simulate(s,.05)
 addTrail(s,s.sources.find(p=>p.id===BLOOM_ID))
 s.stock.sugar=0
 s.missions=[{id:1,type:'harvest',target:BLOOM_ID,members:[1]}]
 const report=offline(s,240)
 assert.ok(report.sugar>0&&report.sugar<65)
 assert.equal(s.missions.length,0)
})