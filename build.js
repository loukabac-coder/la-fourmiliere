import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises'
const files=['index.html','style.css','favicon.svg','fourmiliere.png','main.js','render.js','engine.js','progression.js','terrain.js','colony.js','ants.js','enemies.js','portal.js','save.js']
await mkdir('dist',{recursive:true})
await Promise.all(files.map(file=>copyFile(file,'dist/'+file)))
const [owner,repository]=process.env.GITHUB_REPOSITORY?.split('/')||[]
if(owner&&repository) {
  const project=repository.toLowerCase()!==`${owner.toLowerCase()}.github.io`
  const base='https://'+owner+'.github.io'+(project?'/'+repository:'')
  const html=await readFile('dist/index.html','utf8')
  await writeFile('dist/index.html',html.replace('content="fourmiliere.png"','content="'+base+'/fourmiliere.png"'))
}