import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {extname, resolve, sep} from 'node:path'
const root = import.meta.dirname
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}
createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname))
    const file = path === root ? resolve(root,'index.html') : path
    if (!file.startsWith(root + sep) || !types[extname(file)]) throw Error()
    const body = await readFile(file)
    res.writeHead(200,{'Content-Type':types[extname(file)]})
    res.end(body)
  } catch {
    if (!res.headersSent) res.writeHead(404)
    res.end()
  }
}).listen(4173,'127.0.0.1',()=>console.log('http://localhost:4173'))