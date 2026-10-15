import { decryptSecret } from './crypto';

type AiShop={
  aiExternalEnabled:boolean;
  aiBaseUrl:string|null;
  aiModel:string|null;
  aiApiKeyEncrypted:string|null;
};

type ClaudeTextBlock={type?:string;text?:string};

function cleanJsonText(input:string){
  const t=input.trim();
  const fenced=t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1]||t).trim();
}

function parseJsonLoose<T=any>(input:string):T|null{
  const t=cleanJsonText(input);
  try{return JSON.parse(t) as T}catch{}
  const start=t.indexOf('{'),end=t.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(t.slice(start,end+1)) as T}catch{}}
  return null;
}

function centralClaude(){
  const key=(process.env.ANTHROPIC_API_KEY||'').trim();
  const enabled=(process.env.FIXI_AI_ENABLED||'true').toLowerCase()!=='false';
  if(!enabled||!key)return null;
  return {
    key,
    model:(process.env.ANTHROPIC_MODEL||'claude-sonnet-5').trim(),
    baseUrl:(process.env.ANTHROPIC_API_URL||'https://api.anthropic.com/v1').replace(/\/$/,'')
  };
}

function shopGeneric(shop:AiShop){
  if(!shop.aiExternalEnabled)return null;
  const key=decryptSecret(shop.aiApiKeyEncrypted);
  if(!key||!shop.aiBaseUrl||!shop.aiModel)return null;
  return {key,model:shop.aiModel,baseUrl:shop.aiBaseUrl.replace(/\/$/,'')};
}

async function claudeMessage(args:{system:string;userContent:any;maxTokens?:number}){
  const c=centralClaude();
  if(!c)return null;
  const r=await fetch(`${c.baseUrl}/messages`,{
    method:'POST',
    headers:{
      'x-api-key':c.key,
      'anthropic-version':'2023-06-01',
      'content-type':'application/json'
    },
    body:JSON.stringify({
      model:c.model,
      max_tokens:args.maxTokens||1200,
      system:args.system,
      messages:[{role:'user',content:args.userContent}]
    }),
    signal:AbortSignal.timeout(45_000)
  });
  const j:any=await r.json().catch(()=>({}));
  if(!r.ok){
    const message=j?.error?.message||`Claude API HTTP ${r.status}`;
    throw Object.assign(new Error(message),{status:502});
  }
  const text=(Array.isArray(j?.content)?j.content:[])
    .filter((x:ClaudeTextBlock)=>x?.type==='text'&&typeof x.text==='string')
    .map((x:ClaudeTextBlock)=>x.text)
    .join('\n')
    .trim();
  return {text,model:c.model,requestId:r.headers.get('request-id')||j?.request_id||null};
}

function imageBlockFromDataUrl(dataUrl:string){
  const m=dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s);
  if(!m)return null;
  return {type:'image',source:{type:'base64',media_type:m[1],data:m[2]}};
}

async function genericChatJson(shop:AiShop,system:string,userContent:any){
  const c=shopGeneric(shop);if(!c)return null;
  const url=c.baseUrl+'/chat/completions';
  const r=await fetch(url,{
    method:'POST',
    headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:c.model,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:userContent}]}),
    signal:AbortSignal.timeout(45_000)
  });
  const j:any=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(j?.error?.message||'IA externe indisponible'),{status:502});
  const txt=j?.choices?.[0]?.message?.content;
  return typeof txt==='string'?parseJsonLoose(txt):null;
}

export function externalAiStatus(shop?:AiShop|null){
  const c=centralClaude();
  const generic=shop?shopGeneric(shop):null;
  return {
    provider:c?'anthropic':generic?'generic':'local',
    configured:!!c||!!generic,
    centralClaudeConfigured:!!c,
    model:c?.model||generic?.model||null
  };
}

export async function testClaudeConnection(){
  const c=centralClaude();
  if(!c)throw Object.assign(new Error('ANTHROPIC_API_KEY non configurée côté serveur'),{status:409});
  const out=await claudeMessage({
    system:'Tu es le test de connexion de Fixi. Réponds uniquement avec le mot OK.',
    userContent:'Réponds OK.',
    maxTokens:24
  });
  return {ok:true,provider:'anthropic',model:c.model,response:out?.text||'OK',requestId:out?.requestId||null};
}

export async function analyzeDeviceImage(shop:AiShop,imageDataUrl:string,context:string){
  const central=centralClaude();
  if(central){
    const img=imageBlockFromDataUrl(imageDataUrl);
    if(!img)throw Object.assign(new Error('Format image non supporté pour Claude'),{status:400});
    const out=await claudeMessage({
      system:'Tu aides un atelier de réparation smartphone/PC. Analyse seulement ce qui est visible. Retourne uniquement un objet JSON avec les clés category, brand, model, color, visibleDamage, confidence, notes. confidence doit être un nombre de 0 à 1. Si le modèle exact est incertain, indique-le clairement et ne l invente pas.',
      userContent:[img,{type:'text',text:context||'Identifier l appareil et les dommages visibles.'}],
      maxTokens:900
    });
    if(!out?.text)return null;
    const parsed=parseJsonLoose(out.text);
    return parsed||{notes:out.text,provider:'anthropic'};
  }
  if(!shop.aiExternalEnabled)return null;
  const cfg=shopGeneric(shop);
  if(!cfg)throw Object.assign(new Error('Configuration IA externe incomplète'),{status:409});
  const result=await genericChatJson(shop,
    'Tu aides un atelier de réparation. Retourne uniquement du JSON avec keys category, brand, model, color, visibleDamage, confidence, notes. Ne prétends pas être certain si la photo est ambiguë.',
    [{type:'text',text:context||'Identifier l appareil et les dommages visibles.'},{type:'image_url',image_url:{url:imageDataUrl}}]
  );
  return result;
}

export async function askExternalBrain(shop:AiShop,question:string,context:Record<string,unknown>){
  const central=centralClaude();
  if(central){
    const out=await claudeMessage({
      system:'Tu es Fixi Brain, assistant professionnel d un atelier de réparation. Réponds en français, de façon concise et actionnable, uniquement à partir des agrégats fournis. Ne devine aucune donnée client. Ne donne jamais l impression d avoir exécuté une action financière. Retourne uniquement JSON avec exactement: title (string), answer (string), recommendations (array de strings).',
      userContent:JSON.stringify({question,aggregates:context}),
      maxTokens:1100
    });
    if(!out?.text)return null;
    return parseJsonLoose(out.text);
  }
  if(!shop.aiExternalEnabled)return null;
  return genericChatJson(shop,
    'Tu es Fixi Brain, assistant d un atelier. Réponds en français, brièvement et seulement à partir des agrégats fournis. Ne devine aucune donnée client. Retourne JSON: title, answer, recommendations (array de strings).',
    JSON.stringify({question,aggregates:context})
  );
}

export async function parseReceptionWithClaude(transcript:string,catalog:Array<{brand:string;model:string;aliases?:string[]}>){
  if(!centralClaude())return null;
  const slim=catalog.slice(0,500);
  const out=await claudeMessage({
    system:'Tu es le Copilot de réception Fixi pour un atelier de réparation. Extrait uniquement les informations explicitement dites. Utilise le catalogue fourni pour normaliser la marque et le modèle si possible. Retourne uniquement JSON avec: clientName, clientPhone, brand, model, reportedIssue, estimatedPrice. Utilise une chaîne vide si inconnu et un nombre ou null pour estimatedPrice. Ne complète jamais une donnée non dite.',
    userContent:JSON.stringify({transcript,catalog:slim}),
    maxTokens:700
  });
  if(!out?.text)return null;
  return parseJsonLoose(out.text);
}
