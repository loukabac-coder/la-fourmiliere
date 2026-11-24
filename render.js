import {CELL,GATE,NEST,FIELD,ROOM_NAMES,known,dist} from './terrain.js'
import {DAY,NIGHT} from './colony.js'
import {rivalGate} from './enemies.js'
import {FINDS} from './progression.js'
const colors={sugar:'#fac243',protein:'#da6340',brood:'#fff1c5',queen:'#f8a42f',barracks:'#d26d42'}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h)}
function oval(c,x,y,rx,ry,color) {
  c.fillStyle=color;c.beginPath();c.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);c.fill()
}
function line(c,points,width,color,dash=[]) {
  if(points.length<2)return
  c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.lineJoin='round';c.lineCap='round'
  c.beginPath();c.moveTo(points[0].x,points[0].y)
  for(const p of points.slice(1))c.lineTo(p.x,p.y)
  c.stroke();c.setLineDash([])
}
function random(seed){return ()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296}
function landscape(kind) {
  const dims=kind==='colony'?NEST:FIELD
  const surface=document.createElement('canvas');surface.width=dims.w;surface.height=dims.h
  const c=surface.getContext('2d'),r=random(kind==='colony'?71:94)
  if(kind==='colony') {
    const gradient=c.createLinearGradient(0,75,0,NEST.h)
    for(const [at,color] of [[0,'#52251a'],[.23,'#392019'],[.65,'#231b22'],[1,'#152331']])gradient.addColorStop(at,color)
    rect(c,0,0,dims.w,dims.h,gradient)
    for(let i=0;i<14000;i++) {
      const x=r()*dims.w,y=89+r()*(dims.h-89),size=3+Math.floor(r()*9)
      rect(c,x,y,size,size,r()<.36?'#ffffff0d':'#140d1d32')
    }
    rect(c,0,0,dims.w,85,'#123c38')
    for(let i=0;i<230;i++){
      const x=r()*dims.w,h=7+Math.floor(r()*56)
      rect(c,x,88-h,4+r()*9,h,['#264c39','#416838','#768b36','#a1a340'][i%4])
    }
    rect(c,0,82,dims.w,9,'#94a947');rect(c,0,91,dims.w,7,'#607333')
  }else {
    rect(c,0,0,dims.w,dims.h,'#344a27')
    for(let i=0;i<11500;i++){
      const x=r()*dims.w,y=r()*dims.h
      rect(c,x,y,3+r()*12,2+r()*7,['#415531','#2c4025','#536234','#384e2a'][i%4])
    }
    for(let i=0;i<300;i++){
      const x=r()*dims.w,y=r()*dims.h
      if(Math.hypot(x-720,y-720)<68)continue
      if(i%11===0){oval(c,x,y,25,12,'#354f59');oval(c,x,y-1,19,7,'#537b76')}
      else if(i%7===0){oval(c,x,y,11,7,'#6d7061');rect(c,x-4,y-6,7,3,'#94917a')}
      else{rect(c,x,y,3,10,'#75843c');rect(c,x+4,y-3,3,12,'#556e31')}
    }
    for(const [x,y,rx,ry] of [[491,588,58,23],[912,761,72,33],[765,1008,87,39],[1031,326,90,38]]){
      oval(c,x+6,y+8,rx+10,ry+8,'#263e32')
      oval(c,x,y,rx,ry,'#3e6970')
      oval(c,x-4,y-4,rx*.82,ry*.71,'#527f81')
      rect(c,x-rx*.45,y-ry*.25,rx*.7,3,'#769699')
    }
    for(const [x,y] of [[485,800],[850,572],[960,917],[620,530],[407,448],[1062,709]]){
      oval(c,x+4,y+6,35,17,'#283b22')
      oval(c,x,y,30,14,'#6e7d3d')
      oval(c,x-6,y-3,25,10,'#84934a')
      rect(c,x-25,y-1,47,2,'#a7ac5a')
    }
    for(const radius of [215,520]){c.strokeStyle='#bfba6f39';c.lineWidth=3;c.setLineDash([5,12]);c.beginPath();c.arc(720,720,radius,0,7);c.stroke();c.setLineDash([])}
  }
  return surface
}
function sprite(role,enemy=false) {
  const c=document.createElement('canvas');c.width=32;c.height=24
  const ctx=c.getContext('2d')
  for(const y of [5,9,15,19]){
    rect(ctx,8,y,13,2,'#542718')
    rect(ctx,12,y<12?y-2:y+2,3,3,'#a75322')
  }
  const dark=enemy?'#60252b':role==='scout'?'#826323':'#813819'
  const bright=enemy?'#e36955':role==='scout'?'#ffe36a':role==='soldier'?'#f77c30':'#ffad39'
  for(const [x,y,w,h] of [[2,7,12,11],[13,9,8,7],[21,7,8,10]]) {
    rect(ctx,x,y+2,w,h-3,dark);rect(ctx,x+2,y,w-3,h,bright)
    rect(ctx,x+2,y+h-3,w-3,3,dark);rect(ctx,x+3,y+2,3,2,'#ffe3a1')
  }
  rect(ctx,26,9,2,2,'#1d1514');rect(ctx,26,5,2,3,bright);rect(ctx,28,3,3,2,bright)
  return c
}
export function makeRenderer(canvas) {
  const c=canvas.getContext('2d',{alpha:false})
  const background={colony:landscape('colony'),field:landscape('field')}
  const art=Object.fromEntries(['queen','worker','soldier','scout','enemy'].map(role=>[role,sprite(role,role==='enemy')]))
  let dpr=1,w=1,h=1,scale=1,cam={x:0,y:0},lastView,fade=0
  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1)
    w=canvas.clientWidth||1;h=canvas.clientHeight||1
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)
  }
  new ResizeObserver(resize).observe(canvas)
  const world=(x,y)=>({x:(x-w/2)/scale+cam.x,y:(y-h/2)/scale+cam.y})
  const drawAnt=(ant,selected,time)=> {
    const size=ant.role==='queen'?68:ant.role==='enemy'?24:22
    c.save();c.translate(Math.round(ant.x),Math.round(ant.y))
    if(selected){c.strokeStyle='#ffe47b';c.lineWidth=2;c.beginPath();c.arc(0,0,size*.62,0,7);c.stroke()}
    c.rotate(ant.dir||0)
    c.drawImage(art[ant.role]||art.worker,-size/2,-size*.375+Math.round(Math.sin(time*15+ant.id)),size,size*.75)
    if(ant.cargo)rect(c,size*.37,-5,8,8,colors[ant.cargo.kind])
    if(ant.earth)rect(c,size*.37,-4,7,7,'#b87148')
    c.restore()
  }
  function draw(s,frameTime,follow=true,cursor=null) {
    const selected=s.ants.find(a=>a.id===s.selected),camera=s.camera[s.view]
    const bounds=s.view==='colony'?NEST:FIELD

    const base=s.view==='colony'?Math.min(w/850,h/410):Math.min(w/600,h/540)
    const desiredScale=Math.max(.22,base*camera.zoom*(selected?1.44:1))
    if(lastView!==s.view){lastView=s.view;fade=1;cam={x:camera.x,y:camera.y};scale=desiredScale}
    const target=follow&&selected?.view===s.view?selected:camera
    cam.x+=(target.x-cam.x)*.15;cam.y+=(target.y-cam.y)*.15
    scale+=(desiredScale-scale)*.15
    fade=Math.max(0,fade-.065)
    c.setTransform(dpr,0,0,dpr,0,0);rect(c,0,0,w,h,s.view==='colony'?'#201719':'#141d16')
    c.translate(w/2-cam.x*scale,h/2-cam.y*scale);c.scale(scale,scale);c.imageSmoothingEnabled=false
    const backdrop=background[s.view]
    const left=Math.floor((cam.x-w/2/scale)/bounds.w),right=Math.floor((cam.x+w/2/scale)/bounds.w)
    const top=Math.floor((cam.y-h/2/scale)/bounds.h),bottom=Math.floor((cam.y+h/2/scale)/bounds.h)
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){
      if(s.view==='colony'&&y!==0)continue
      c.save()
      c.translate((x+(x%2!==0?1:0))*bounds.w,(y+(y%2!==0?1:0))*bounds.h)
      c.scale(x%2!==0?-1:1,y%2!==0?-1:1)
      c.drawImage(backdrop,0,0)
      c.restore()
    }
    if(s.view==='colony'){
      if(top<0)rect(c,left*bounds.w,top*bounds.h,(right-left+1)*bounds.w,-top*bounds.h,'#123c38')
      if(bottom>0)for(let x=left;x<=right;x++)c.drawImage(backdrop,0,bounds.h-224,bounds.w,224,x*bounds.w,bounds.h,bounds.w,bottom*bounds.h)
    }
    const center=GATE[s.view]
    const depth=Math.max(0,Math.round((cam.y-90)/24))
    if(s.view==='colony'){
      const dug=s.tunnels.filter(t=>t.done)
      for(const [size,color] of [[21,'#9b421f'],[15,'#d27437'],[11,'#5b2c1b']]){
        for(const p of dug)rect(c,p.x-size,p.y-size,size*2,size*2,color)
      }
      for(const t of s.tunnels.filter(t=>!t.done))rect(c,t.x-7,t.y-7,14,14,'#ffc77346')
      if(s.digProposal)line(c,[s.digProposal.start,s.digProposal.end],3,'#91dfc7bb',[4,7])
      for(const room of s.roomProjects||[]){c.strokeStyle='#9ce3d0';c.setLineDash([5,5]);c.strokeRect(room.x-26,room.y-22,52,44);c.setLineDash([])}
      for(const room of s.rooms){
        oval(c,room.x,room.y,room.radius+5,room.radius*.75+5,'#a9532a')
        oval(c,room.x,room.y,room.radius,room.radius*.75,'#d28243')
        oval(c,room.x,room.y-3,room.radius-5,room.radius*.75-6,'#63301d')
        if(scale>.38){c.fillStyle='#ffdc9e';c.font='bold 12px monospace';c.textAlign='center';c.fillText(ROOM_NAMES[room.type],room.x,room.y+room.radius*.72)}
        if(['sugar','protein'].includes(room.type))for(let i=0;i<Math.min(10,s.stock[room.type]/4);i++)rect(c,room.x-21+i%5*9,room.y+9-Math.floor(i/5)*8,7,7,colors[room.type])
        if(room.type==='barracks')for(let i=-2;i<=2;i++){rect(c,room.x+i*9,room.y-15,2,24,'#f7ac55');rect(c,room.x+i*9-1,room.y-17,4,4,'#ffe3ac')}
      }
      const brood=s.rooms.filter(r=>r.type==='brood')
      s.brood.forEach((egg,i)=>{
        const room=brood.length?brood[i%brood.length]:s.rooms[0]
        const j=Math.floor(i/(brood.length||1))
        oval(c,room.x-22+(j%6)*9,room.y+14-Math.floor(j/6)*8,4,egg.age>=9?2:5,'#fff1c5')
      })
    }else{
      for(const trail of s.trails)line(c,trail.points,4,'rgba(216,240,107,'+Math.max(0,trail.strength)+')',[2,8])
      for(const source of s.sources)if(known(s,source)){
        oval(c,source.x,source.y+6,source.load>1?29:17,11,'#283324')
        for(let i=0;i<5;i++)rect(c,source.x-12+i%3*9,source.y-5+Math.floor(i/3)*9,8,8,colors[source.kind])
        if(scale>.5){c.font='bold 13px monospace';c.textAlign='center';c.fillStyle='#fff0b8';c.fillText(source.name,source.x,source.y-19)}
      }
      for(const find of FINDS)if(!s.finds?.includes(find.id)&&known(s,find)){
        const pulse=2+Math.round((1+Math.sin(frameTime*4))*3)
        oval(c,find.x,find.y,12+pulse,10+pulse,'#edb94325')
        rect(c,find.x-4,find.y-5,8,10,'#efa742')
        rect(c,find.x-2,find.y-8,4,16,'#ffcf6c')
        rect(c,find.x-2,find.y-4,3,3,'#fff1ad')
      }
      if(known(s,rivalGate))oval(c,rivalGate.x,rivalGate.y,20,14,'#8c4c49')
      for(const a of s.rivalAnts)if(known(s,a))drawAnt({...a,role:'enemy'},false,frameTime)
      if(known(s,s.spider)){
        for(let i=-2;i<=2;i++)line(c,[{x:s.spider.x-15,y:s.spider.y+i*5-9},s.spider,{x:s.spider.x+17,y:s.spider.y+i*5+9}],3,'#201914')
        oval(c,s.spider.x,s.spider.y,12,9,'#252019')
      }
      if(s.raid&&known(s,s.raid)){oval(c,s.raid.x,s.raid.y,16,11,'#45262a');rect(c,s.raid.x-16,s.raid.y-20,Math.max(0,s.raid.hp),3,'#ff654b')}
    }
    if(s.view==='field'){
      oval(c,center.x+4,center.y+9,55,39,'#263d28')
      oval(c,center.x,center.y,49,33,'#7d512d')
      oval(c,center.x,center.y-3,42,27,'#a27942')
      for(let i=0;i<15;i++){
        const angle=i*Math.PI*2/15
        const x=center.x+Math.cos(angle)*46,y=center.y+Math.sin(angle)*30
        rect(c,x-4,y-4,8,7,i%3?'#737767':'#a1a17d')
        rect(c,x-3,y-4,5,2,'#bbb28b')
      }
      if(s.portal.level===3){oval(c,center.x,center.y-11,32,16,'#637047');oval(c,center.x,center.y-13,27,10,'#8e9a5c')}
      for(const animal of s.wildlife||[])if(animal.hp>0&&known(s,animal)){
        const wing=Math.sin(frameTime*32)*4
        const wasp=animal.kind==='guêpe'
        if(wasp){oval(c,animal.x-5,animal.y-8+wing,10,4,'#d9efe6bb');oval(c,animal.x+4,animal.y+8-wing,9,4,'#d9efe6bb')}
        oval(c,animal.x,animal.y,wasp?13:15,wasp?6:10,wasp?'#f1bd47':'#44334a')
        for(let i=-1;i<=1;i++)rect(c,animal.x+i*6-2,animal.y-4,3,8,wasp?'#45302c':'#8a6271')
        if(animal.chasing)rect(c,animal.x-2,animal.y-20,4,9,'#ff6853')
      }
    }
    oval(c,center.x,center.y,15+s.portal.level*4,11,'#b47735')
    oval(c,center.x,center.y,12+s.portal.level*3,7,s.portal.closed?'#957a55':'#1d1915')
    if(s.portal.closed)line(c,[{x:center.x-10,y:center.y+4},{x:center.x+10,y:center.y-4}],3,'#e89e62')
    if(selected?.view===s.view){
      if(selected.move){
        const target=selected.move
        const route=selected.route?.points?.length?selected.route.points:[target]
        line(c,[selected,...route],2,'#ffe39b99',[3,5])
        c.strokeStyle='#ffe39b';c.lineWidth=2;c.strokeRect(target.x-5,target.y-5,10,10)
      }
      if(cursor&&s.view==='colony'&&dist(selected,cursor)<63){
        const x=Math.round(cursor.x/CELL)*CELL,y=Math.round(cursor.y/CELL)*CELL
        c.strokeStyle='#fbd17880';c.lineWidth=1;c.strokeRect(x-CELL/2,y-CELL/2,CELL,CELL)
      }
    }
    for(const ant of s.ants)if(ant.view===s.view)drawAnt(ant,ant===selected,frameTime)
    if(selected?.view===s.view&&s.view==='field'){
      for(const source of s.sources)if(known(s,source))oval(c,source.x,source.y,43,35,'#ffcf3228')
      for(const trail of s.trails)line(c,trail.points,21,'#adff6d24')
      if(known(s,s.spider))oval(c,s.spider.x,s.spider.y,53,44,'#ff432b39')
    }
    if(s.view==='field'){
      for(let y=0;y<30;y++)for(let x=0;x<30;x++)if(!s.fog[x+','+y])rect(c,x*48,y*48,48,48,'#151e18')
      if(s.time%DAY>NIGHT)rect(c,0,0,FIELD.w,FIELD.h,'#10204c55')
      if(s.rain)for(let i=0;i<35;i++){
        const x=(i*131+frameTime*115)%FIELD.w,y=(i*317+frameTime*440)%FIELD.h
        line(c,[{x,y},{x:x-10,y:y+22}],2,'#9bc5d68b')
      }
    }
    if(s.view==='field'){
      for(const order of s.missions||[])if(order.type==='scout'){
        const p=order.target
        c.strokeStyle='#93e6cd';c.lineWidth=2
        c.strokeRect(p.x-8,p.y-8,16,16)
        line(c,[{x:p.x-14,y:p.y},{x:p.x+14,y:p.y}],1,'#93e6cd')
        line(c,[{x:p.x,y:p.y-14},{x:p.x,y:p.y+14}],1,'#93e6cd')
      }
    }
    c.setTransform(dpr,0,0,dpr,0,0)
    if(s.view==='colony'){
      rect(c,8,8,116,23,'#112927df');c.font='bold 11px monospace';c.fillStyle='#ffd898';c.textAlign='left';c.fillText('Profondeur '+depth,15,23)
    }
    if(fade)rect(c,0,0,w,h,'rgba(10,18,16,'+(fade*.75)+')')

  }
  return {draw,world,zoomScale:()=>scale}
}