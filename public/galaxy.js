// The shared galaxy: p5 draws the world; HTML handles readable statements.
let galaxyView = false;
let galaxyTransition = 0;
let galaxyTexture = null;
let galaxyPoints = [];
let galaxyGroups = [];
let sharedStars = [];
let ownStarId = null;
let sharedAvailable = false;
let selectedGalaxyStar = null;
let sampleMode = false;
let galaxyRefreshTimer;
const supportReferenceText = 'Across 26 U.S. states in 2022, 24.1% of adults said their social and emotional support needs were met sometimes, rarely, or never.';

function supportReferencePosition() {
  return { x: width * 0.9, y: width < 700 ? 138 : height * 0.2 };
}
function overSupportReference() {
  const star = supportReferencePosition();
  return dist(mouseX, mouseY, star.x, star.y) < 25;
}
function openSupportReference() {
  if (soundEnabled) playBowlTone(50);
  document.getElementById('support-dialog').showModal();
}
function drawSupportReference() {
  const star = supportReferencePosition();
  const active = !galaxyTransition && overSupportReference();
  // An outlined blue star distinguishes published research from people's voices.
  stroke(151, 210, 224, active ? 235 : 170);
  strokeWeight(1);
  fill(116, 179, 204, active ? 130 : 55);
  drawDataStar(star.x, star.y, 24);
  if (!active) return;
  const cardWidth = min(320, width - 32);
  const cardX = constrain(star.x - cardWidth - 28, 16, width - cardWidth - 16);
  const cardY = star.y + 32;
  drawingContext.save();
  drawingContext.shadowColor = 'rgba(10, 5, 22, 0.9)';
  drawingContext.shadowBlur = 12;
  noStroke();textStyle(NORMAL);textFont('Arial');textAlign(LEFT, TOP);
  fill(169, 217, 231, 230);textSize(12);
  text('EMOTIONAL SUPPORT', cardX, cardY);
  fill(255, 235, 222, 245);textSize(14);textLeading(21);
  text(supportReferenceText, cardX, cardY + 24, cardWidth, 125);
  fill(197, 193, 214, 210);textSize(12);
  text('CDC BRFSS · 2022 · tap for source', cardX, cardY + 150);
  drawingContext.restore();
}
const feelingTone = { lonely: 30, numb: 23, anxious: 45, grieving: 20, hopeful: 69, connected: 82, 'something else': 52 };
const sampleStars = [
  ['Mira','New York','United States','30–39','lonely','I can be surrounded by people and still feel unseen.'],
  ['Jules','New York','United States','40–49','hopeful','I am learning to ask for what I need.'],
  ['Lin','Shanghai','China','18–29','anxious','I am building a new life in a language I am still learning.'],
  ['Ren','Shanghai','China','30–39','connected','A small kindness from a stranger stayed with me all week.'],
  ['Ada','Berlin','Germany','40–49','grieving','I miss someone I cannot call anymore.'],
  ['Sol','Berlin','Germany','30–39','numb','I want to feel present in my own life again.'],
  ['Noor','Chicago','United States','30–39','hopeful','Some days beginning again is enough.'],
  ['Kai','Chicago','United States','18–29','lonely','I wish making friends felt less like an audition.']
].map((s,i)=>({id:'sample-'+i, alias:s[0],city:s[1],country:s[2],age:s[3],feeling:s[4],truth:s[5],replies:[],resonances:0,sample:true}));

function visitorIdentity(){
  let token=localStorage.getItem('opia-visitor-token');
  if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('opia-visitor-token',token);}
  return token;
}
async function galaxyApi(path, options = {}) {
  const response = await fetch((window.OPIA_API_BASE || '').replace(/\/$/,'') + '/api/' + path, { ...options, headers: {'Content-Type':'application/json','X-Opia-Token':visitorIdentity(),...options.headers} });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Shared storage is not connected. Set your backend URL in config.js, or run this project with npm start.');
  const body = await response.json();
  if (!response.ok) throw Error(body.error || 'Could not save. Please try again.');
  return body;
}

async function refreshGalaxy() {
  const data = await galaxyApi('stars');
  sharedAvailable = true;
  ownStarId = data.ownStarId;
  sharedStars = data.stars;
  sampleMode = sharedStars.length === 0;
  positionGalaxyStars();
  document.getElementById('return-galaxy').hidden = !ownStarId || galaxyView;
  updateGalaxyStatus();
}

function updateGalaxyStatus() {
  const text = sampleMode
    ? 'Sample galaxy · these example voices are fictional. Your star will start the shared sky.'
    : `${sharedStars.length} ${sharedStars.length===1?'voice':'voices'} in the galaxy · click or tap a star`;
  document.getElementById('galaxy-status').textContent = sharedAvailable ? text : sharedStars.length ? 'Connection interrupted · showing the last loaded stars' : 'Preview only · fictional example stars · shared storage is not connected';
}

function initializeGalaxy() {
  document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.getElementById('back-atlas').onclick = ()=>leaveGalaxy();
  document.getElementById('group-by').onchange = positionGalaxyStars;
  document.getElementById('explore-galaxy').onclick = ()=>startGalaxyTransition();
  document.getElementById('return-galaxy').onclick = ()=>startGalaxyTransition();
  document.getElementById('my-star').onclick = ()=>{
    const mine = galaxyPoints.find(s=>s.id===ownStarId);
    if (mine) openGalaxyStar(mine);
    else { leaveGalaxy(); document.getElementById('entry-drawer').open=true; }
  };
  document.getElementById('browse-stars').onclick = ()=>{
    const list=document.getElementById('star-list'); list.replaceChildren();
    galaxyPoints.forEach(star=>{
      const b=document.createElement('button'); b.textContent=`${star.alias} · ${star.city} · ${star.feeling}`;
      b.onclick=()=>{ document.getElementById('star-list-dialog').close(); openGalaxyStar(star); }; list.append(b);
    });
    const reference=document.createElement('button');
    reference.textContent='Emotional support · CDC reference';
    reference.onclick=()=>{document.getElementById('star-list-dialog').close();openSupportReference();};
    list.append(reference);
    document.getElementById('star-list-dialog').showModal();
  };
  document.getElementById('reply-form').onsubmit = leaveGalaxyReply;
  document.getElementById('resonate-button').onclick = resonateWithStar;
  document.getElementById('delete-star').onclick = removeOwnStar;
  refreshGalaxy().catch(()=>{sampleMode=true;positionGalaxyStars();updateGalaxyStatus();});
  galaxyRefreshTimer=setInterval(()=>{if(galaxyView) refreshGalaxy().catch(()=>{sharedAvailable=false;updateGalaxyStatus();});},60000);
}

async function enterGalaxyFromForm() {
  const message=document.getElementById('entry-message');
  const button=document.getElementById('enter-button');
  const read=id=>document.getElementById(id).value.trim();
  const truth=read('truth-input'); const city=read('city-input'); const country=read('country-input');
  if(!truth || !city || !country){message.textContent='Add a city, country, and one true sentence first.'; return;}
  button.disabled=true; message.textContent='Giving your words a place in the sky…';
  try {
    const data=await galaxyApi('stars',{method:'POST',body:JSON.stringify({
      alias:read('alias-input')||'A fellow star',city,country,age:read('decade-select'),feeling:read('feeling-select'),truth,
      connectivity:Number(read('connection-slider')),
      demographics:{age:read('age-select'),identity:read('identity-select'),race:read('race-select'),income:read('income-select'),place:read('location-select')}
    })});
    ownStarId=data.star.id; await refreshGalaxy();
    document.getElementById('entry-drawer').open=false;
    button.textContent='Update my star';message.textContent='Your star is saved.';
    startGalaxyTransition();
  } catch(error){message.textContent=error.message;}
  finally{button.disabled=false;}
}

function startGalaxyTransition() {
  galaxyTransition=millis(); galaxyTexture=null;positionGalaxyStars();
  if(soundEnabled){[35,50,69].forEach((tone,i)=>setTimeout(()=>playBowlTone(tone),i*320));}
  document.getElementById('entry-drawer').open=false;
  document.body.classList.add('in-galaxy');
  document.querySelector('.eyebrow').textContent='Atlas of Connection';
  document.title='OPIA — Atlas of Connection';
  windowResized();
  document.getElementById('galaxy-controls').hidden=false;
  document.getElementById('return-galaxy').hidden=true;
  updateGalaxyStatus();
}

function leaveGalaxy() {
  galaxyView=false;galaxyTransition=0;document.body.classList.remove('in-galaxy');
  document.querySelector('.eyebrow').textContent='Atlas of Loneliness';
  document.title='OPIA — Atlas of Loneliness';
  windowResized();
  document.getElementById('galaxy-controls').hidden=true;
  document.getElementById('return-galaxy').hidden=!ownStarId;
}

function stableNumber(str) {let h=0;for(const c of str) h=(h*31+c.charCodeAt(0))>>>0;return h;}
function groupName(star) {
  const mode=document.getElementById('group-by').value;
  return mode==='city'?`${star.city.trim()}, ${star.country.trim()}`:mode==='age'?star.age:star.feeling;
}
// Normalize case and spacing so “New York” and “new york” share a cluster.
// Different spellings such as NYC/New York still need the same wording.
function groupKey(star) {
  return groupName(star).trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
function positionGalaxyStars() {
  if(typeof width==='undefined') return;
  const source=sampleMode?sampleStars:sharedStars;
  const names=[...new Map(source.map(star=>[groupKey(star),groupName(star)])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const columns=width<700?2:Math.max(2,Math.ceil(Math.sqrt(names.length)));
  const rows=Math.max(1,Math.ceil(names.length/columns));
  // These are constellation clusters, not longitude/latitude on a world map.
  galaxyGroups=names.map(([key,name],i)=>({key,name,x:width*((i%columns+0.5)/columns),y:150+(height-330)*(Math.floor(i/columns)+0.5)/rows}));
  galaxyPoints=source.map(star=>{
    const center=galaxyGroups.find(g=>g.key===groupKey(star));
    const peers=source.filter(s=>groupKey(s)===center.key).sort((a,b)=>a.id.localeCompare(b.id));
    const index=peers.findIndex(s=>s.id===star.id); const angle=index*2.39996+stableNumber(center.key)%60;
    const radius=peers.length===1?0:Math.sqrt(index+1)*25;
    return {...star,x:constrain(center.x+cos(angle)*radius,30,width-30),y:constrain(center.y+sin(angle)*radius,150,height-150)};
  });
}

function makeGalaxyTexture() {
  // A cached p5 nebula: overlapping transparent clouds and scattered dust.
  // Replace this with loadImage() + image() when a licensed space photograph is selected.
  const g=createGraphics(Math.min(width,1400),Math.min(height,1100));g.background(17,8,31);g.noStroke();
  const colors=[[205,68,121],[186,94,40],[110,49,157],[39,112,151]];
  for(let i=0;i<850;i++){
    const t=i/849;const angle=t*TWO_PI*1.4;const r=t*g.width*.56;
    const x=g.width*.5+cos(angle)*r;const y=g.height*.5+sin(angle)*r*.42;
    const c=colors[i%colors.length];g.fill(...c,4);g.ellipse(x+random(-85,85),y+random(-70,70),random(90,320),random(70,210));
  }
  for(let i=0;i<1800;i++){const x=random(g.width),y=random(g.height);g.fill(255,205,175,random(12,130));g.circle(x,y,random(.4,1.8));}
  return g;
}

function drawGalaxy() {
  if(!galaxyTexture) galaxyTexture=makeGalaxyTexture();
  image(galaxyTexture,0,0,width,height);
  // Brighter background pinpoints, with occasional small cross-shaped glints.
  for(const star of backgroundStars){
    const twinkle=reducedMotion?0.75:0.65+0.35*sin(frameCount*.018+star.phase);
    const alpha=215*twinkle;
    if(star.glint){
      stroke(244,222,204,alpha*.6);strokeWeight(.7);
      const ray=star.size*2;
      line(star.x-ray,star.y,star.x+ray,star.y);line(star.x,star.y-ray,star.x,star.y+ray);
    }
    noStroke();fill(255,231,214,alpha);circle(star.x,star.y,star.size*1.05);
  }
  const transitioning=galaxyTransition!==0;
  for(const group of galaxyGroups){fill(246,208,185,125);textFont('Georgia');textSize(width<700?14:18);textAlign(CENTER,CENTER);text(group.name,group.x,group.y-75);}
  const hovering=galaxyPoints.find(s=>dist(mouseX,mouseY,s.x,s.y)<24);
  for(const star of galaxyPoints){
    const active=hovering?.id===star.id||selectedGalaxyStar?.id===star.id;
    const mine=star.id===ownStarId;const palette=star.feeling==='connected'||star.feeling==='hopeful'?[244,198,140]:[242,137,174];
    const size=(mine?18:13)*(reducedMotion?1:1+sin(frameCount*.02+stableNumber(star.id))*.05);
    noStroke();fill(...palette,active?30:14);drawDataStar(star.x,star.y,size*3.2);
    fill(...palette,active?255:205);drawDataStar(star.x,star.y,size);
    if(mine||active){fill(255,229,213,225);textSize(14);textAlign(CENTER,TOP);text(mine?'You':star.alias,star.x,star.y+17);}
  }
  if(hovering&&!transitioning){
    const peers=galaxyPoints.filter(s=>groupKey(s)===groupKey(hovering)&&s.id!==hovering.id).slice(0,3);
    noFill();stroke(246,187,168,75);strokeWeight(1);
    peers.forEach(s=>bezier(hovering.x,hovering.y,hovering.x+25,hovering.y-30,s.x-25,s.y-30,s.x,s.y));
  }
  drawSupportReference();
  if(transitioning){
    const progress=constrain((millis()-galaxyTransition)/1400,0,1);
    if(!reducedMotion){push();translate(width/2,height/2);rotate(progress*2.7);noFill();
      for(let i=0;i<40;i++){stroke(255,210,174,(1-progress)*125);strokeWeight(1);const r=(i+1)*20*(1+progress*2);arc(0,0,r,r*.6,i*.28,i*.28+1.4);}pop();}
    noStroke();fill(3,10,31,(1-progress)*200);rect(0,0,width,height);
    if(progress>=1){galaxyTransition=0;galaxyView=true;}
  }
}

function openGalaxyStar(star) {
  selectedGalaxyStar=star;
  document.getElementById('star-name').textContent=star.alias;
  document.getElementById('star-context').textContent=`${star.city}, ${star.country} · ${star.age} · ${star.feeling}${star.sample?' · fictional example':''}`;
  document.getElementById('star-truth').textContent=star.truth;
  document.getElementById('reply-input').value='';document.getElementById('reply-status').textContent='';
  document.getElementById('delete-star').hidden=star.id!==ownStarId;
  document.getElementById('reply-form').hidden=star.sample;
  document.getElementById('resonate-button').disabled=star.sample || !ownStarId;
  renderStarReplies(star);
  if(!star.sample&&!ownStarId){
    const status=document.getElementById('reply-status');
    const note=document.createElement('em');note.textContent='No account needed.';
    status.replaceChildren(document.createTextNode('Create your star first to leave a response. '),note);
  }
  if(soundEnabled)playBowlTone(feelingTone[star.feeling]??52);
  document.getElementById('star-dialog').showModal();
}
function renderStarReplies(star){
  document.getElementById('resonate-button').textContent=`This resonates · ${star.resonances||0}`;
  const list=document.getElementById('reply-list');list.replaceChildren();
  for(const reply of star.replies||[]){const p=document.createElement('p');p.textContent=`${reply.alias}: ${reply.text}`;list.append(p);}
}
async function leaveGalaxyReply(event){
  event.preventDefault();const status=document.getElementById('reply-status');const button=event.target.querySelector('button');
  if(!ownStarId){status.textContent='Create your star first to reply.';return;}
  button.disabled=true;
  try{const result=await galaxyApi(`stars/${selectedGalaxyStar.id}/replies`,{method:'POST',body:JSON.stringify({text:document.getElementById('reply-input').value})});
    selectedGalaxyStar=result.star;renderStarReplies(result.star);document.getElementById('reply-input').value='';status.textContent='Your reply is saved.';if(soundEnabled)playBowlTone(65);
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
}
async function resonateWithStar(){
  try{const result=await galaxyApi(`stars/${selectedGalaxyStar.id}/resonate`,{method:'POST',body:'{}'});selectedGalaxyStar=result.star;renderStarReplies(result.star);if(soundEnabled)playBowlTone(70);}
  catch(e){document.getElementById('reply-status').textContent=e.message;}
}
async function removeOwnStar(){
  try{await galaxyApi(`stars/${ownStarId}`,{method:'DELETE'});document.getElementById('star-dialog').close();selectedGalaxyStar=null;await refreshGalaxy();}
  catch(e){document.getElementById('reply-status').textContent=e.message;}
}
