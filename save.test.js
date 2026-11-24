import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readSave,writeSave,encodeSave,decodeSave,KEY} from './save.js'
const state={ants:[],rooms:[],tunnels:[],sources:[],trails:[],brood:[],portal:{},stock:{sugar:12,protein:3,earth:0},fog:{}}
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