// WarLike PR Watch - read-only dashboard, no browser-side GitHub token.
const el=id=>document.getElementById(id);
const state={snapshots:[],source:'Aucune donnée'};
const validLink=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='github.com'&&/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(u.pathname)?u.href:null}catch{return null}};
const priority=p=>['P0','P1','P2','P3'].includes(p.level)?p.level:(p.conflict||p.failed?'P0':'P3');
function suggestion(p){
 if(p.conflict)return 'Résoudre les conflits avec main, puis exécuter à nouveau la CI.';
 if(p.failed)return 'Examiner les logs du job échoué, corriger et relancer les contrôles.';
 if(p.pending)return 'Attendre la fin de la CI avant toute fusion.';
 if(p.draft)return 'Finaliser les critères, tester et demander une revue.';
 if((p.ageDays||0)>=7)return 'Vérifier si la PR est toujours utile ou remplacée par une PR plus récente.';
 return 'Effectuer une revue et valider le comportement avant fusion.';
}
function add(data,source){
 if(!data||!Array.isArray(data.results)||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('Rapport invalide : generatedAt et results requis.');
 for(const p of data.results){
  if(!Number.isInteger(p.number)||typeof p.repo!=='string'||!validLink(p.url))throw Error('Entrée PR invalide.');
 }
 const i=state.snapshots.findIndex(s=>s.generatedAt===data.generatedAt);
 if(i>=0)state.snapshots[i]=data;else state.snapshots.push(data);
 state.snapshots.sort((a,b)=>a.generatedAt.localeCompare(b.generatedAt));
 state.snapshots=state.snapshots.slice(-30);
 state.source=source;
 const select=el('pr-repo'),before=select.value;
 const repos=[...new Set(current().map(p=>p.repo))].sort();
 select.replaceChildren(new Option('Tous les dépôts',''),...repos.map(r=>new Option(r,r)));
 select.value=repos.includes(before)?before:'';
 draw();
}
const current=()=>state.snapshots.at(-1)?.results||[];
function draw(){
 const rows=current(),search=el('pr-search').value.trim().toLocaleLowerCase('fr'),repo=el('pr-repo').value,lev=el('pr-priority').value;
 el('pr-total').textContent=rows.length;
 el('pr-p0').textContent=rows.filter(p=>priority(p)==='P0').length;
 el('pr-old').textContent=rows.filter(p=>priority(p)==='P1').length;
 el('pr-source').textContent=state.source;
 el('pr-date').textContent=state.snapshots.length?new Date(state.snapshots.at(-1).generatedAt).toLocaleString('fr-FR'):'Non disponible';
 const body=el('pr-body');body.replaceChildren();
 for(const p of rows.filter(p=>(!repo||p.repo===repo)&&(!lev||priority(p)===lev)&&(!search||[p.repo,p.title,p.number].join(' ').toLocaleLowerCase('fr').includes(search)))){
  const tr=document.createElement('tr'),cell=document.createElement('td'),link=document.createElement('a');
  link.href=validLink(p.url);link.textContent=p.repo+' #'+p.number;link.target='_blank';link.rel='noopener noreferrer';
  cell.append(link,document.createElement('br'),document.createTextNode(String(p.title||'').slice(0,280)));tr.append(cell);
  for(const value of [priority(p),(p.reasons||[]).join(' · ')||(p.warning?'Contrôles incomplets':'Aucun signalement'),suggestion(p)]){
   const td=document.createElement('td');td.textContent=String(value);tr.append(td);
  }
  body.append(tr);
 }
 el('pr-empty').hidden=!!body.children.length;
 const history=el('pr-history');history.replaceChildren();
 for(const s of [...state.snapshots].reverse()){
  const item=document.createElement('li');
  item.textContent=new Date(s.generatedAt).toLocaleString('fr-FR')+' : '+s.results.length+' PR dont '+s.results.filter(p=>priority(p)==='P0').length+' critiques';
  history.append(item);
 }
 el('pr-errors').textContent=(state.snapshots.at(-1)?.errors||[]).slice(0,8).join(' ; ');
}
el('pr-file').addEventListener('change',async event=>{
 try{for(const file of [...event.target.files].slice(0,30)){if(file.size>5242880)throw Error('Fichier > 5 Mio');add(JSON.parse(await file.text()),'Rapport JSON importé');}el('pr-message').textContent='Rapport chargé en mémoire (session actuelle).'}
 catch(error){el('pr-message').textContent=error.message}
 event.target.value='';
});
el('pr-refresh').addEventListener('click',async()=>{
 try{
  const res=await fetch('/api/control/github/prs',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!res.ok)throw Error('API privée indisponible : HTTP '+res.status);
  add(await res.json(),'WarLike Server');el('pr-message').textContent='Données récupérées.';
 }catch(error){el('pr-message').textContent=error.message+'. Importez le rapport JSON depuis GitHub Actions.'}
});
for(const id of ['pr-search','pr-repo','pr-priority'])el(id).addEventListener(id==='pr-search'?'input':'change',draw);
draw();
