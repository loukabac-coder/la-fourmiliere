import {spawn} from 'node:child_process'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const profile=await mkdtemp(join(tmpdir(),'fourmiliere-edge-'))
const edge=spawn(process.argv[2],['--headless=new','--disable-gpu','--remote-debugging-port=9418','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true})
const server=spawn(process.execPath,['serve.js'],{stdio:'ignore',windowsHide:true})
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let socket
try{
  let page
  for(let i=0;i<60&&!page;i++){
    await wait(200)
    try{page=(await (await fetch('http://127.0.0.1:9418/json/list')).json()).find(p=>p.type==='page')}catch{}
  }
  assert.ok(page,'Page Edge disponible')
  assert.equal((await fetch('http://localhost:4173')).status,200)
  socket=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  let id=0
  const pending=new Map(),errors=[]
  socket.addEventListener('message',e=>{const packet=JSON.parse(e.data);if(packet.id)pending.get(packet.id)?.(packet);if(packet.method==='Runtime.exceptionThrown')errors.push(packet.params.exceptionDetails)})
  const call=(method,params={})=>new Promise(resolve=>{const current=++id;pending.set(current,resolve);socket.send(JSON.stringify({id:current,method,params}))})
  const evaluate=async expression=>{
    const response=await call('Runtime.evaluate',{expression,returnByValue:true})
    assert.equal(response.result.exceptionDetails,undefined,JSON.stringify(response.result.exceptionDetails))
    return response.result.result.value
  }
  await call('Runtime.enable')
  await call('Page.enable')
  await call('Page.navigate',{url:'http://localhost:4173'})
  await wait(1300)
  assert.equal(await evaluate('document.title'),'La Fourmilière — Jeu de colonie de fourmis')
  await evaluate("document.querySelector('#play').click();document.querySelector('#lay').click()")
  await wait(500)
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('la-fourmiliere')).state.brood.length"),1)
  await evaluate("document.querySelector('[data-view=field]').click()")
  await wait(400)
  assert.equal(await evaluate("document.querySelector('[data-view=field]').getAttribute('aria-pressed')"),'true')
  await evaluate("document.querySelector('#random').click()")
  assert.equal(await evaluate("document.querySelector('#manual').hidden"),false)
  await call('Page.reload')
  await wait(1000)
  assert.equal(await evaluate("document.querySelector('#play').textContent"),'Continuer')
  await evaluate("document.querySelector('#play').click()")
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true})
  await wait(400)
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth && document.querySelector('canvas').clientHeight > 250"),true)
  await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true})
  await wait(350)
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth && document.querySelector('canvas').clientHeight > 100"),true)
  assert.deepEqual(errors,[])
  console.log('Edge : accueil, ponte, changement de vue, incarnation, rechargement, formats mobiles.')
}finally{
  socket?.close()
  edge.kill();server.kill()
  await wait(450)
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:200}).catch(()=>{})
}