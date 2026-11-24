export const CELL = 24
export const NEST = {w:1152,h:2400}
export const FIELD = {w:1440,h:1440}
export const GATE = {colony:{x:576,y:108},field:{x:720,y:720}}
export const ROOM_NAMES = {queen:'Salle royale',brood:'Couvain',sugar:'Grenier à sucre',protein:'Garde-manger',barracks:'Caserne'}
export const ROLE_NAMES = {queen:'Reine',worker:'Ouvrière',soldier:'Soldate',scout:'Éclaireuse'}
export const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y)
export const cellKey = p=>Math.round(p.x/CELL)+','+Math.round(p.y/CELL)
export function gridLine(a,b) {
  let x=Math.round(a.x/CELL), y=Math.round(a.y/CELL)
  const endX=Math.round(b.x/CELL),endY=Math.round(b.y/CELL),result=[]
  while(x!==endX||y!==endY) {
    if (x!==endX && (y===endY||Math.abs(endX-x)>=Math.abs(endY-y))) x+=Math.sign(endX-x)
    else y+=Math.sign(endY-y)
    result.push({x:x*CELL,y:y*CELL})
  }
  return result
}
export function excavated(state,p) {
  return state.tunnels.some(t=>cellKey(t)===cellKey(p)&&t.done) || state.rooms.some(r=>dist(r,p)<r.radius)
}
const paths = new WeakMap()
export function nestRoute(state,start,end) {
  const signature=state.tunnels.length+':'+state.dug+':'+state.rooms.length
  let cached=paths.get(state)
  if(cached?.signature!==signature) {
    const cells=new Set(state.tunnels.filter(t=>t.done).map(cellKey))
    for(const room of state.rooms) {
      const radius=Math.ceil(room.radius/CELL)
      const cx=Math.round(room.x/CELL),cy=Math.round(room.y/CELL)
      for(let dx=-radius;dx<=radius;dx++) for(let dy=-radius;dy<=radius;dy++){
        const x=cx+dx,y=cy+dy
        if(dist(room,{x:x*CELL,y:y*CELL})<room.radius)cells.add(x+','+y)
      }
    }
    cached={signature,cells,routes:new Map()}
    paths.set(state,cached)
  }
  const startKey=cellKey(start),endKey=cellKey(end),key=startKey+'>'+endKey
  if(!cached.routes.has(key)) {
    const queue=[startKey],parents=new Map([[startKey,null]])
    for(let i=0;i<queue.length&&!parents.has(endKey);i++){
      const from=queue[i], [x,y]=from.split(',').map(Number)
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const next=(x+dx)+','+(y+dy)
        if(cached.cells.has(next)&&!parents.has(next)){parents.set(next,from);queue.push(next)}
      }
    }
    const result=[]
    if(parents.has(endKey)) {
      for(let step=endKey;step!==startKey;step=parents.get(step)){
        const [x,y]=step.split(',').map(Number)
        result.unshift({x:x*CELL,y:y*CELL})
      }

    }
    if(cached.routes.size>2000)cached.routes.clear()
    cached.routes.set(key,parents.has(endKey)?result:null)
  }
  const cachedRoute=cached.routes.get(key)
  return cachedRoute?[...cachedRoute,end]:[]
}
export function reveal(state,ant,radius) {
  const spacing=48
  for(let y=Math.floor((ant.y-radius)/spacing);y<=Math.floor((ant.y+radius)/spacing);y++)
    for(let x=Math.floor((ant.x-radius)/spacing);x<=Math.floor((ant.x+radius)/spacing);x++)
      if(x>=0&&y>=0&&x<30&&y<30&&dist(ant,{x:x*spacing+24,y:y*spacing+24})<radius+24)state.fog[x+','+y]=true
}
export const known = (state,p)=>!!state.fog[Math.floor(p.x/48)+','+Math.floor(p.y/48)]
export const SOURCES = [
  {id:1,x:575,y:660,kind:'sugar',name:'Miettes',load:1,yield:5},
  {id:2,x:845,y:790,kind:'protein',name:'Graines',load:1,yield:4},
  {id:3,x:1010,y:490,kind:'sugar',name:'Morceau de pomme',load:5,yield:45},
  {id:4,x:380,y:492,kind:'sugar',name:'Pucerons',load:1,yield:9},
  {id:5,x:1050,y:1000,kind:'protein',name:'Coléoptère',load:1,yield:9}
]