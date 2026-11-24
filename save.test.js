import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readSave,writeSave,encodeSave,decodeSave,migrate,KEY} from './save.js'
const state={ants:[],rooms:[],tunnels:[],sources:[],trails:[],brood:[],portal:{},stock:{sugar:12,protein:3,earth:0},fog:{}}
test('older eggs keep their relative incubation progress',()=>{
  const eggs=[{age:4.5,fed:false},{age:16.5,fed:true}]
  const previous={version:2,savedAt:1,state:{...state,brood:eggs}}
  const migrated=migrate(previous)
  assert.deepEqual(migrated.state.brood.map(egg=>egg.age),[30,120])
  assert.deepEqual(migrate(migrated).state.brood.map(egg=>egg.age),[30,120])
})
test('reload, backup recovery and compressed export',async()=>{
  const data=new Map()
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)}
  assert.equal(writeSave(state,storage,1),true)
  assert.equal(readSave(storage).state.stock.sugar,12)
  writeSave({...state,stock:{...state.stock,sugar:25}},storage,2)
  data.set(KEY,'corrupt')
  assert.equal(readSave(storage).savedAt,1)
  assert.equal((await decodeSave(await encodeSave(state))).state.stock.sugar,12)
})