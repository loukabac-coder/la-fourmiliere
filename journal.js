export const BLOOM_ID=8
const bloomSites=[{x:665,y:568},{x:858,y:648},{x:760,y:890}]
export const STUDIES={
  dig:{name:'Outils de creusement',detail:'+15 % de vitesse de creusement par niveau'},
  haul:{name:'Techniques de transport',detail:'+10 % de rendement par niveau'},
  rest:{name:'Repos collectif',detail:'+20 % de récupération d’énergie par niveau'}
}
export const MILESTONES=[
  {id:'delivery',label:'Premiers trajets',detail:'Rapporter 10 ressources au nid.',reward:4,progress:s=>s.ants.reduce((sum,a)=>sum+a.delivered,0),goal:10},
  {id:'tunnel',label:'Sous les racines',detail:'Creuser 6 blocs.',reward:4,progress:s=>s.dug,goal:6},
  {id:'room',label:'Place pour grandir',detail:'Construire une salle.',reward:5,progress:s=>s.rooms.filter(r=>r.type!=='queen').length,goal:1},
  {id:'brood',label:'Une nouvelle génération',detail:'Faire naître 3 fourmis.',reward:6,progress:s=>Math.max(0,s.nextId-4),goal:3},
  {id:'scout',label:'Trésors du jardin',detail:'Découvrir 2 trouvailles.',reward:6,progress:s=>s.finds?.length||0,goal:2},
  {id:'raid',label:'Tenir le portail',detail:'Repousser le premier raid rival.',reward:8,progress:s=>Number(s.raidWon),goal:1}
]
export const studyLevel=(s,id)=>s.studies?.[id]||0
export const studyCost=(s,id)=>6+studyLevel(s,id)*6
export function buyStudy(s,id){
  if(!Object.hasOwn(STUDIES,id)||studyLevel(s,id)>=3||(s.amber||0)<studyCost(s,id))return false
  s.amber-=studyCost(s,id)
  s.studies??={}
  s.studies[id]=studyLevel(s,id)+1
  return true
}
export function markMilestones(s,emit=()=>{}){
  s.earnedMilestones??=[]
  for(const item of MILESTONES){
    if(!s.earnedMilestones.includes(item.id)&&item.progress(s)>=item.goal){
      s.earnedMilestones.push(item.id)
      emit('Carnet · '+item.label+' terminé.')
    }
  }
}
export function claimMilestone(s,id){
  markMilestones(s)
  const item=MILESTONES.find(item=>item.id===id)
  s.claimedMilestones??=[]
  if(!item||!s.earnedMilestones.includes(id)||s.claimedMilestones.includes(id))return false
  s.claimedMilestones.push(id)
  s.amber=(s.amber||0)+item.reward
  return true
}
export function updateGarden(s,afterRain,emit=()=>{}){
  if(s.bloomUntil&&s.time>=s.bloomUntil){
    s.sources=s.sources.filter(p=>p.id!==BLOOM_ID)
    s.trails=s.trails.filter(t=>t.source!==BLOOM_ID)
    if(s.missions)s.missions=s.missions.filter(m=>m.type!=='harvest'||m.target!==BLOOM_ID)
    s.bloomUntil=0
  }
  if(!afterRain||s.bloomUntil)return
  const location=bloomSites[Math.floor(s.time/150)%bloomSites.length]
  const source={...location,id:BLOOM_ID,name:'Nectar de pluie',load:1,kind:'sugar',yield:17}
  s.sources.push(source)
  s.bloomUntil=s.time+62
  emit('La pluie s’arrête. Du nectar est disponible pendant une minute.',true)
}
export const unclaimedCount=s=>(s.earnedMilestones||[]).filter(id=>!s.claimedMilestones?.includes(id)).length