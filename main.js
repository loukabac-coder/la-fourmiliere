import {createState,lay,planDig,buildRoom,roomIssue,addTrail,offline,DAY,NIGHT,storeResource,ROYAL} from './colony.js'
import {GATE,NEST,FIELD,dist,known,ROLE_NAMES,ROOM_NAMES,excavated,nestRoute} from './terrain.js'
import {simulate} from './engine.js'
import {manualDig} from './ants.js'
import {upgradePortal,LEVELS,queueAtPortal} from './portal.js'
import {readSave,writeSave,clearSave,encodeSave,decodeSave} from './save.js'
import {makeRenderer} from './render.js'
const $=id=>document.getElementById(id)
const canvas=$('world'),dialog=$('dialog'),content=$('dialog-content')
let state=null,renderer=null,mode=null,gesture=null,last=0,acc=0,lastSave=0,lastUi=0,noticeTimer
let saved=readSave()
const keys=new Set(),pointers=new Map()
let pinch=0,pinchCenter=null,follow=true,cursor=null
function playLabel(){$('play').textContent=saved?'Continuer':'Jouer'}
playLabel()
function show(message,important=false) {
  $('notice').textContent=message
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',5200)
  if(important)save()
}
function save(){
  if(!state)return
  if(writeSave(state)){lastSave=performance.now();saved=readSave()}
  else $('notice').textContent='Sauvegarde locale indisponible. Exporte ta partie dans Options.'
}
function modal(title,text=''){
  content.replaceChildren()
  const heading=document.createElement('h2');heading.textContent=title;content.append(heading)
  if(text){const p=document.createElement('p');p.textContent=text;content.append(p)}
  if(!dialog.open)dialog.showModal()
}
function button(label,fn) {
  const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;content.append(b);return b
}
function detail(label) {
  const p=document.createElement('p');p.textContent=label;content.append(p)
}
function tutorial(text){if(state.tutorial)show(text)}
function start(record) {
  state=record?.state||createState()
  const report=record&&Date.now()-record.savedAt>30000?offline(state,(Date.now()-record.savedAt)/1000):null
  last=0;acc=0;mode=null;follow=true;cursor=null;keys.clear()
  for(const ant of state.ants){
    ant.route=null
    if(ant.view==='colony'&&!excavated(state,ant)){
      const point=state.tunnels.filter(t=>t.done&&nestRoute(state,GATE.colony,t).length)
        .sort((a,b)=>dist(a,ant)-dist(b,ant))[0]||ROYAL
      Object.assign(ant,{x:point.x,y:point.y,move:null,cross:0})
    }
  }
  $('home').hidden=true;$('game').hidden=false
  renderer??=makeRenderer(canvas,$('minimap'))
  if(dialog.open)dialog.close()
  ui();save()
  if(report) modal('Pendant ton absence',report.sugar+' sucres récoltés · '+report.born+' naissances · '+report.erased+' pistes effacées par la nuit')
  else if(!record&&state.tutorial)guide()
}
function switchView(view,keep=false){
  if(!keep&&state.ants.find(a=>a.id===state.selected)?.view!==view)state.selected=null
  state.view=view;mode=null;cursor=null;ui()
}
function select(ant) {
  if(!ant)return
  const previous=state.ants.find(a=>a.id===state.selected)
  if(previous){previous.move=null;previous.route=null;previous.cross=0}
  keys.clear()
  follow=true
  state.selected=ant.id;ant.move=null;ant.cross=0;ant.route=null
  switchView(ant.view,true)
  tutorial('Indique une destination ou utilise ZQSD et les flèches. Touche le portail pour le traverser.')
}
function queen(){
  select(state.ants.find(a=>a.role==='queen'))
}
function ui(){
  if(!state)return
  const {stock,view,selected}=state
  const actor=state.ants.find(a=>a.id===selected)
  $('resources').textContent='Fourmis '+state.ants.length+'  ·  Sucre '+Math.floor(stock.sugar)+'  ·  Protéines '+Math.floor(stock.protein)+'  ·  Terre '+Math.floor(stock.earth)
  const goal=state.record>=30&&state.raidWon
  const task=goal?'Objectif atteint · Record '+state.record:
    state.raid?'Urgence · '+(state.raid.kind==='rival'?'Raid rival':'Scarabée')+' · Protège le portail':
    state.raidWon?'Raid repoussé · Objectif : 30 fourmis':
    state.record>=30?'30 fourmis · Prépare les défenses':
    'Objectif · '+Math.min(30,state.record)+'/30 fourmis · Fais grandir la colonie'
  $('objective').textContent=task+
    (view==='field'?' · '+(state.rain?'Pluie':state.time%DAY>NIGHT?'Nuit':'Jour'):'')+(actor?' · '+(actor.name||ROLE_NAMES[actor.role]):'')
  $('minimap').setAttribute('aria-label','Centrer la vue sur '+(view==='colony'?'le nid':'le jardin'))
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view))
  $('management').hidden=false;$('manual').hidden=!actor
  $('dig-request').hidden=view!=='colony'||!state.digProposal
  $('lay').disabled=!!actor&&actor.role!=='queen'
  $('energy').hidden=!actor||view!=='colony'
  $('energy').value=actor?.energy??100
  $('actor-status').textContent=actor?'Contrôle · '+ROLE_NAMES[actor.role]:'Vue de gestion'
  for(const id of ['role','lay','dig','room','build'])$(id).hidden=view!=='colony'
  $('trail').hidden=view!=='field'
  $('carry').hidden=!actor||actor.role==='queen'
  $('excavate').hidden=view!=='colony'
  $('action').textContent=actor?.role==='soldier'?'Attaquer':actor?.role==='scout'?'Alerter':view==='colony'?'Creuser / déposer':'Poser une piste'
  for(const id of ['dig','build','trail'])$(id).setAttribute('aria-pressed',String(mode===id))
}
function guide(){
  modal('Guide de la colonie','Ton but : faire grandir la colonie jusqu’à 30 fourmis, puis repousser le raid rival.')
  const steps=[
    ['Élever le couvain','Choisis une ouvrière pour les travaux, une soldate pour la garde ou une éclaireuse pour explorer, puis Pondre. Les larves ont besoin de protéines pour grandir.'],
    ['Creuser et aménager','Active Creuser, puis glisse depuis une galerie vers la terre. Les ouvrières creusent et rapportent la terre. Accepte une demande de creusement ou choisis le tracé. Place une salle à cinq blocs des autres salles. Coût : 6 terres, ou 10 pour une caserne.'],
    ['Récolter au jardin','Les ouvrières récoltent près du portail sans ordre. Touche une ressource visible pour tracer une autre piste. Avec une fourmi incarnée, appuie sur C près des graines pour les récupérer. La pomme demande cinq fourmis.'],
    ['Défendre le portail','Ouvre Portail pour fermer l’entrée et poster des soldates près du passage. Les gardes aident à neutraliser les attaques ; améliore le portail pour renforcer la défense.'],
    ['Explorer et contrôler','Touche une fourmi pour l’incarner. Déplace-la avec ZQSD, WASD ou les flèches ; touche une destination sur la carte. Fais glisser la carte ou défile à deux doigts pour déplacer la caméra. Pince pour zoomer. Appuie sur G pour incarner la reine.']
  ]
  const list=document.createElement('ol')
  for(const [title,text] of steps){
    const item=document.createElement('li'),strong=document.createElement('strong'),description=document.createElement('p')
    strong.textContent=title;description.textContent=text;item.append(strong,description);list.append(item)
  }
  content.append(list)
  button('Reprendre la partie',()=>dialog.close())
}
function options() {
  modal('Options')
  const record=state||saved?.state
  const toggle=button(record?.tutorial===false?'Réactiver le tutoriel':'Désactiver le tutoriel',()=>{
    if(record){record.tutorial=!record.tutorial;if(state)save();else writeSave(record,localStorage,saved.savedAt);options()}
  })
  toggle.disabled=!record
  const box=document.createElement('textarea');box.placeholder='Code de sauvegarde';box.setAttribute('aria-label','Code de sauvegarde');content.append(box)
  button('Exporter ma sauvegarde',async()=>{
    try{if(!record)throw Error();box.value=await encodeSave(record);box.select()}
    catch{box.placeholder='Aucune sauvegarde à exporter'}
  })
  button('Importer une sauvegarde',async()=>{
    try{
      const imported=await decodeSave(box.value)
      if(!confirm('Remplacer la partie actuelle par cette sauvegarde ?'))return
      start(imported)
    }catch{box.value='';box.placeholder='Code invalide'}
  })
  button('Nouvelle partie',()=>{
    if(confirm('Recommencer une nouvelle colonie ?')&&confirm('Effacer la sauvegarde locale et sa copie précédente ?')){
      clearSave();saved=null;start(null)
    }
  })
  if(record?.memorial.length){
    detail('Mémorial')
    for(const a of record.memorial)detail((a.name||ROLE_NAMES[a.role]+' '+a.id)+' · '+a.trips+' expéditions')
  }
}
function portalMenu() {
  const gate=state.portal
  modal('Tableau des départs',LEVELS[gate.level-1]+' · '+(gate.closed?'Fermé':'Ouvert')+' · '+state.ants.filter(a=>a.cross).length+' en attente')
  button(gate.closed?'Ouvrir le portail':'Fermer le portail',()=>{gate.closed=!gate.closed;save();portalMenu()})
  if(gate.level<3)button('Améliorer · '+gate.level*18+' terre, '+gate.level*14+' sucre',()=>{
    if(upgradePortal(state)){save();portalMenu()}else detail('Réserves insuffisantes.')
  })
  const assigned=state.ants.filter(a=>a.role==='soldier'&&a.view==='colony')
  detail('Garde · '+gate.guards.length+'/'+(gate.level+1))
  button('Poster des soldates',()=>{gate.guards=assigned.slice(0,gate.level+1).map(a=>a.id);save();portalMenu()})
  if(gate.guards.length)button('Rappeler la garde',()=>{gate.guards=[];save();portalMenu()})
  const scout=state.ants.find(a=>a.role==='scout'&&a.view==='colony'&&!a.explore)
  if(scout)button('Envoyer une éclaireuse',()=>{scout.explore=true;save();portalMenu()})
  const outside=state.ants.filter(a=>a.view==='field')
  detail(outside.length+' fourmis dehors')
  for(const ant of outside)button((ant.name||ROLE_NAMES[ant.role]+' '+ant.id)+' · '+Math.round(dist(ant,GATE.field))+' cases graphiques du portail'+(ant.cargo?' · '+(ant.cargo.kind==='sugar'?'sucre':'protéines'):''),()=>{dialog.close();select(ant)})
}
function hero() {
  const a=state.ants.find(ant=>ant.id===state.selected)
  if(!a)return
  modal(a.name||ROLE_NAMES[a.role]+' '+a.id)
  detail(a.trips+' expéditions · '+Math.floor(a.delivered)+' ressources rapportées')
  const field=document.createElement('input');field.maxLength=24;field.value=a.name||'';field.placeholder='Nom de la fourmi';field.setAttribute('aria-label','Nom de la fourmi');content.append(field)
  button('Nommer',()=>{a.name=field.value.trim();save();dialog.close()}).disabled=a.played<8
  if(a.played<8)detail('Incarne cette fourmi quelques secondes pour lui donner un nom.')
}
function action(){
  const a=state.ants.find(ant=>ant.id===state.selected)
  if(!a)return
  if(a.role==='soldier'){
    const target=[state.raid,...(state.wildlife||[]).filter(e=>e.hp>0),state.spider].find(e=>e&&a.view==='field'&&dist(a,e)<54)
    if(target===state.raid&&target)target.hp-=5
    else if(target===state.spider)state.spider.lure={x:1070,y:555}
    else if(target){target.hp-=2;if(target.hp<=0) show('Prédateur repoussé.',true)}
    else show('Approche-toi d’un ennemi pour attaquer.')
  }else if(a.role==='scout'){
    show('Zone explorée signalée.')
    if(a.view==='field'&&dist(a,state.spider)<100)state.spider.lure={x:a.x,y:a.y}
  }else if(a.view==='colony'){
    if(a.earth&&dist(a,GATE.colony)<32){storeResource(state,'earth',a.earth);a.earth=0;save()}
    else if(!manualDig(state,a))show('Approche-toi d’une case en chantier.')
  }else{
    const source=state.sources.find(p=>dist(a,p)<70)
    if(source){addTrail(state,source);save();show('Piste posée.')}
    else show('Approche-toi d’une ressource.')
  }
}
function carry(){
  const a=state.ants.find(ant=>ant.id===state.selected)
  if(!a||a.role==='queen')return
  if(a.cargo){
    if(a.view==='colony'){
      const room=state.rooms.find(r=>r.type===a.cargo.kind&&dist(a,r)<r.radius+18)
      if(room||dist(a,ROYAL)<ROYAL.radius)a.delivered+=storeResource(state,a.cargo.kind,a.cargo.amount)
      else{show('Va dans un grenier ou dans la salle royale pour déposer.');return}
    }
    a.cargo=null;save()
  }else if(a.view==='field'){
    const p=state.sources.filter(p=>dist(a,p)<32).sort((first,last)=>dist(a,first)-dist(a,last))[0]
    if(p?.load===1){a.cargo={kind:p.kind,source:p.id,amount:p.yield*2};show(p.name+' récupéré. Appuie sur P pour rentrer.',true)}
    else show(p?'Trace une piste pour réunir cinq fourmis.':'Approche-toi d’une ressource.')
  }
}
function setMode(next,text){mode=mode===next?null:next;ui();if(mode)show(text)}
$('play').onclick=()=>start(saved)
$('help').onclick=guide
$('options').onclick=$('home-options').onclick=options
$('portal').onclick=portalMenu
$('lay').onclick=()=>{if(lay(state,$('role').value))show('Un œuf a été pondu. Les larves consomment une protéine.',true);else show('Il faut 2 sucres et une place pour le couvain.')}
$('dig').onclick=()=>setMode('dig','Glisse depuis une galerie ou une chambre vers la terre à creuser.')
$('build').onclick=()=>setMode('build','Choisis un emplacement à 5 blocs ou plus des autres salles, même dans la terre.')
$('dig-request').onclick=()=>{
  const proposal=state.digProposal
  if(!proposal)return
  modal('Demande de creusement','Les ouvrières proposent une galerie de '+Math.round(dist(proposal.start,proposal.end)/24)+' blocs. Son tracé est marqué sur la carte.')
  button('Autoriser ce tracé',()=>{
    const count=planDig(state,proposal.start,proposal.end)
    state.digProposal=null
    dialog.close();ui()
    show(count?count+' blocs autorisés. Les ouvrières s’en chargent.':'Cette galerie est déjà en chantier.',true)
  })
  button('Choisir un autre tracé',()=>{
    state.digProposal=null
    dialog.close();mode=null;$('dig').click();save()
  })
}
$('trail').onclick=()=>setMode('trail','Glisse du portail jusqu’à une ressource visible.')
$('queen').onclick=queen
$('hero').onclick=hero
$('carry').onclick=carry
$('action').onclick=action
$('random').onclick=()=>{const ants=state.ants.filter(a=>a.role!=='queen');select(ants[Math.floor(Math.random()*ants.length)])}
$('event').onclick=()=>{
  const ants=state.ants.filter(a=>a.role!=='queen')
  const ranked=ants.map(a=>({a,score:(a.view==='field'&&state.raid?Math.max(0,500-dist(a,state.raid)):0)+(a.cargo?.heavy?350:a.cargo?150:0)+(a.explore?120:0)+(a.earth?80:0)+(a.view==='field'?30:0)}))
  ranked.sort((a,b)=>b.score-a.score);select(ranked[0]?.a)
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view))
function zoom(factor){if(state){const c=state.camera[state.view];c.zoom=Math.max(.25,Math.min(4,c.zoom*factor))}}
$('plus').onclick=()=>zoom(1.25)
$('minus').onclick=()=>zoom(.8)
$('minimap').onclick=e=>{
  if(!state)return
  const bounds=state.view==='colony'?NEST:FIELD,rect=e.currentTarget.firstElementChild.getBoundingClientRect()
  const x=e.detail?(e.clientX-rect.left)/rect.width:.5
  const y=e.detail?(e.clientY-rect.top)/rect.height:.5
  follow=false
  Object.assign(state.camera[state.view],{
    x:x*bounds.w,
    y:y*bounds.h
  })
  ui()
}
function pan(dx,dy){
  const camera=state.camera[state.view],bounds=state.view==='colony'?NEST:FIELD
  const ant=state.ants.find(a=>a.id===state.selected)
  if(follow&&ant?.view===state.view){camera.x=ant.x;camera.y=ant.y}
  follow=false
  const scale=renderer.zoomScale()
  camera.x=Math.max(0,Math.min(bounds.w,camera.x+dx/scale))
  camera.y=Math.max(0,Math.min(bounds.h,camera.y+dy/scale))
}
canvas.addEventListener('wheel',e=>{
  if(!state)return
  e.preventDefault()
  const unit=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1
  if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*.012))
  else pan(e.shiftKey&&!e.deltaX?e.deltaY*unit:e.deltaX*unit,e.shiftKey&&!e.deltaX?0:e.deltaY*unit)
},{passive:false})
const pointer=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{
  if(!state)return
  canvas.setPointerCapture(e.pointerId)
  const at=pointer(e);pointers.set(e.pointerId,at)
  if(pointers.size>1){const [a,b]=pointers.values();pinch=dist(a,b);pinchCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture=null;return}
  gesture={at,last:at,start:renderer.world(at.x,at.y),points:[],moved:false,pan:e.button===1||e.button===2}
})
canvas.addEventListener('pointermove',e=>{
  if(state){const at=pointer(e);cursor=renderer.world(at.x,at.y)}
  if(!pointers.has(e.pointerId))return
  const at=pointer(e);pointers.set(e.pointerId,at)
  if(pointers.size>1){
    const [a,b]=pointers.values(),gap=dist(a,b)
    const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2}
    if(pinchCenter)pan(pinchCenter.x-center.x,pinchCenter.y-center.y)
    if(pinch>4&&gap>4)zoom(gap/pinch)
    pinchCenter=center;pinch=gap;return
  }
  if(!gesture)return
  gesture.moved ||= dist(at,gesture.at)>8
  if(gesture.moved){
    if(gesture.pan){pan(gesture.last.x-at.x,gesture.last.y-at.y)}
    else if(mode==='trail'){
      const point=renderer.world(at.x,at.y)
      if(gesture.points.length<90&&dist(gesture.points.at(-1)||gesture.start,point)>12)gesture.points.push(point)
    }else if(!mode){pan(gesture.last.x-at.x,gesture.last.y-at.y)}
  }
  gesture.last=at
})
canvas.addEventListener('contextmenu',e=>e.preventDefault())
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null})
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId)
  if(!gesture)return
  const g=gesture;gesture=null
  if(g.pan)return
  const at=pointer(e),p=renderer.world(at.x,at.y),view=state.view,gate=GATE[view]
  const source=view==='field'&&state.sources.find(s=>known(state,s)&&dist(s,p)<37)
  if(mode==='dig'){
    const count=planDig(state,g.start,p)
    if(count)state.digProposal=null
    show(count?count+' cases ajoutées au chantier.':'Pars d’une chambre ou d’une galerie déjà creusée.',!!count)
    return
  }
  if(mode==='build'){
    const type=$('room').value
    const issue=roomIssue(state,type,p)
    const previous=state.roomProjects?.length||0
    const built=!issue&&buildRoom(state,type,p)
    if(built){mode=null;ui()}
    const queued=(state.roomProjects?.length||0)>previous
    show(built?(queued?'Chantier autorisé. Les ouvrières vont raccorder la salle.':ROOM_NAMES[type]+' aménagé.'):issue||'Impossible de raccorder cet emplacement.',built)
    return
  }
  if(mode==='trail'){
    if(source&&dist(g.start,gate)<70){addTrail(state,source,g.points);show('Piste vers '+source.name.toLowerCase()+'.',true)}
    else show('Trace du portail jusqu’à une ressource visible.')
    return
  }
  if(g.moved)return
  const selected=state.ants.find(a=>a.id===state.selected)
  if(dist(p,gate)<29){
    if(selected)crossPortal()
    else portalMenu()
    return
  }
  const ant=state.ants.filter(a=>a.view===view&&a.id!==state.selected&&dist(a,p)<(a.role==='queen'?28:14)).sort((a,b)=>dist(a,p)-dist(b,p))[0]
  if(ant){select(ant);return}
  if(selected){
    selected.cross=0;selected.move=p;follow=true
    if(view==='field'&&dist(selected,state.spider)<75)state.spider.lure={...p}
  }else if(source){addTrail(state,source);show('Piste vers '+source.name.toLowerCase()+'.',true)}
})
const controls=new Set(['z','q','s','d','w','a','arrowleft','arrowright','arrowup','arrowdown'])
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase()
  if(controls.has(key)&&state&&!dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){
    e.preventDefault();keys.add(key);follow=true
  }
})
function crossPortal(){
  const ant=state.ants.find(a=>a.id===state.selected)
  if(!ant){portalMenu();return}
  const gate=GATE[ant.view]
  ant.move={...gate,portal:true};follow=true
  if(dist(ant,gate)<4)queueAtPortal(state,ant)
  if(state.portal.closed)show('Portail fermé. Ouvre-le depuis le tableau des départs.')
}
function excavate(){
  if(state.view!=='colony')return
  const ant=state.ants.find(a=>a.id===state.selected)
  if(!ant){$('dig').click();return}
  if((ant.energy??100)<18){show('Énergie basse. Attends quelques secondes.');return}
  const point=cursor||{x:ant.x+Math.cos(ant.dir||0)*48,y:ant.y+Math.sin(ant.dir||0)*48}
  if(!manualDig(state,ant,point))show('Vise de la terre près de ta fourmi, au bord d’une galerie.')
}
function chooseRoom(type){
  if(state.view!=='colony')return
  $('room').value=type
  if(mode!=='build')$('build').click()
}
const shortcuts={
  e:()=>state.view==='colony'&&(state.selected===null||state.selected===0)&&$('lay').click(),
  f:excavate,b:()=>state.view==='colony'&&$('build').click(),r:()=>$('random').click(),
  h:()=>$('event').click(),p:crossPortal,o:portalMenu,c:carry,x:action,g:queen,i:hero,
  t:()=>state.view==='field'&&$('trail').click(),v:()=>switchView(state.view==='colony'?'field':'colony'),
  m:()=>{pan(0,0);state.selected=null;mode=null;ui()},
  '1':()=>chooseRoom('brood'),'2':()=>chooseRoom('sugar'),'3':()=>chooseRoom('protein'),'4':()=>chooseRoom('barracks'),
  '+':()=>zoom(1.25),'-':()=>zoom(.8)
}
$('cross').onclick=crossPortal
$('excavate').onclick=excavate
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase()
  if(!state||!Object.hasOwn(shortcuts,key)||dialog.open||e.altKey||e.ctrlKey||e.metaKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return
  e.preventDefault()
  if(!e.repeat||key==='f')shortcuts[key]()
})
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()))
window.addEventListener('blur',()=>keys.clear())
let hiddenAt=0
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();save()}
  else if(state&&hiddenAt){
    const elapsed=(Date.now()-hiddenAt)/1000
    hiddenAt=0
    if(elapsed>30){
      const report=offline(state,elapsed);save()
      modal('Pendant ton absence',report.sugar+' sucres récoltés · '+report.born+' naissances · '+report.erased+' pistes effacées')
    }
  }
})
window.addEventListener('pagehide',save)
const pressed=(...names)=>Number(names.some(name=>keys.has(name)))
function frame(now){
  if(state){
    const dt=last?Math.min(.15,(now-last)/1000):0
    last=now
    if(!document.hidden){
      acc+=dt
      while(acc>=.05){
        simulate(state,.05,{x:pressed('d','arrowright')-pressed('q','a','arrowleft'),y:pressed('s','arrowdown')-pressed('z','w','arrowup')},show)
        acc-=.05
        const actor=state.ants.find(a=>a.id===state.selected)
        if(actor&&actor.view!==state.view){
          Object.assign(state.camera[actor.view],GATE[actor.view])
          switchView(actor.view,true);save()
        }
      }
      renderer.draw(state,now/1000,follow,cursor)
      if(now-lastUi>200){ui();lastUi=now}
      if(now-lastSave>=10000)save()
    }
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)