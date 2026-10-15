import { readFile } from 'fs/promises';import path from 'path';import { bad } from '@/lib/http';
export const runtime='nodejs';
const mime:Record<string,string>={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.webm':'video/webm'};
export async function GET(_:Request,{params}:{params:Promise<{file:string}>}){try{const{file}=await params;if(!/^[a-zA-Z0-9._-]+$/.test(file))return bad('Fichier invalide',400);const ext=path.extname(file).toLowerCase();const b=await readFile(path.join(process.cwd(),'data','platform-media',file));return new Response(b,{headers:{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'public, max-age=86400'}})}catch(e:any){return bad('Média introuvable',404)}}
