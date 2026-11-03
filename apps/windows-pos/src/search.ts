// Recherche tolérante : sans accents, mots dans n'importe quel ordre, une faute de frappe permise par mot.
export const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,' ').trim();
function close(a:string,b:string){
 // a et b de même longueur à ±1 : distance de Levenshtein ≤ 1
 if(Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue}
  if(++edits>1)return false;
  if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}
 }
 return edits+(a.length-i)+(b.length-j)<=1;
}
/** Score > 0 si le produit correspond ; plus c'est haut, plus il est pertinent. */
export function matchScore(query:string,fields:(string|null|undefined)[]){
 const q=norm(query);if(!q)return 1;
 const hay=norm(fields.filter(Boolean).join(' '));
 const words=hay.split(' ');
 let score=0;
 for(const t of q.split(' ')){
  if(hay.includes(t)){score+=words.some(w=>w.startsWith(t))?3:2;continue}
  if(t.length>=4&&words.some(w=>close(t,w.slice(0,t.length))||close(t,w))){score+=1;continue}
  return 0;
 }
 return score;
}
