import {mkdir,copyFile} from 'node:fs/promises'
const files=['index.html','style.css','favicon.svg','fourmiliere.png','main.js','render.js','engine.js','terrain.js','colony.js','ants.js','enemies.js','portal.js','save.js']
await mkdir('dist',{recursive:true})
await Promise.all(files.map(file=>copyFile(file,'dist/'+file)))