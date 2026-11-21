
(function(){
"use strict";
var FORMATS=["STATIC","VIDEO","CAROUSEL","DYNAMIC"];
var STAGES=["AWARE","CLARIFY","EDUCATE","VALUE","TRUST","ACT"];
var CTAS=["Learn more","Book now","Sign up","Get quote","Contact us","Get offer","Apply now","Shop now","Send message","Call now","Get directions","Subscribe","Download"];
var DESTS=["Instant Form","Website","Instant Form + Website"];
function normDest(d){return d==="On Platform"||!d?"Instant Form":d;}
var DEFAULT_STRATS=["Tayla","Jess","Danny","Ed","Matt"];
function strats(){return (S.team&&S.team.strategists&&S.team.strategists.length)?S.team.strategists:DEFAULT_STRATS;}
function stratOpts(cur){var l=strats().slice();if(cur&&l.indexOf(cur)<0)l.push(cur);return '<option value=""'+(!cur?" selected":"")+'>Unassigned</option>'+l.map(function(o){return '<option value="'+esc(o)+'"'+(cur===o?" selected":"")+'>'+esc(o)+(strats().indexOf(o)<0?" (no longer on the team)":"")+'</option>';}).join("");}
var RATIOS=[["1:1","1:1 · Facebook and Instagram feed"],["9:16","9:16 · Stories and Reels"]];
var TEAM_ST={draft:"Draft · not sent",awaiting:"With client",changes:"Changes requested",approved:"Approved · ready to launch",live:"Live",archived:"Archived"};
var CLIENT_ST={awaiting:"Waiting on you",changes:"Being updated",approved:"Approved",live:"Approved · Live"};

var GDA=window.GDA||{};
var S={team:null,newStrat:"",clients:{},ads:{},loadedC:false,loadedA:false,noDb:false,me:null,profiles:{},
  mode:"team",page:"dash",clientId:null,monthKey:null,adId:null,strat:"All",group:"all",
  tab:"copy",placement:"fb",pIdx:0,hIdx:0,expanded:false,composer:null,draft:"",asClient:null,
  nc:null,flash:"",cpage:"ads",odraft:"",reqChanges:null,batch:{},kind:"meta",folderId:null,showArch:{},newFolder:null,gComb:0,splat:"",fileIdx:0,pin:null,pdraft:"",pinFocus:null,bd:{cname:"",chex:"",fname:"",fuse:""}};
var db=null,assets=null,user=null,downloads=null,dirty=false;

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
function clone(o){return JSON.parse(JSON.stringify(o));}
function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function now(){return new Date().toISOString();}
function L(t){return {text:t||"",state:"none",comments:[]};}
function titleCase(t){return String(t||"").replace(/[^A-Za-z0-9&' ]+/g," ").split(" ").filter(Boolean).map(function(w){return w[0].toUpperCase()+w.slice(1);}).join(" ");}
function hasText(l){return !!String((l&&l.text)||"").trim();}
function hasCreative(l){return !!(l&&(l.assetId||String(l.text||"").trim()));}
function clientLines(a){var x=linesOfKind(a);if(x)return x.filter(function(l){return hasText(l)||(l&&l.assetId);});return a.primaries.filter(hasText).concat(a.headlines.filter(hasText),hasText(a.description)?[a.description]:[],[a.ctaLine],a.creatives.filter(hasCreative));}
function plainFormat(t){return {STATIC:"Image ad",VIDEO:"Video ad",CAROUSEL:"Carousel ad",DYNAMIC:"Dynamic ad"}[t]||"Ad";}
function nameOf(a){return "["+a.type+"] "+(a.stage||"STAGE")+"_"+(titleCase(a.title)||"Descriptor");}
function blob(id){if(!id)return "";if(String(id).indexOf("db:")===0){var m=S.media&&S.media[id];if(m)return m;loadMedia(id);return "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";}return "/api/media/"+id;}
var mediaLoading={};
function loadMedia(id){if(mediaLoading[id]||!db)return;mediaLoading[id]=1;var mid=id.slice(3);
  db.doc("media/"+mid).get().then(function(sn){if(!sn.exists)return;var d=sn.data(),n=d.parts||1;if(n===1){S.media=S.media||{};S.media[id]=d.data;schedule();return;}
    var jobs=[];for(var i=1;i<n;i++)jobs.push(db.doc("media/"+mid+"~"+i).get());
    return Promise.all(jobs).then(function(rs){S.media=S.media||{};S.media[id]=d.data+rs.map(function(r){return r.exists?r.data().data:"";}).join("");schedule();});}).catch(function(){mediaLoading[id]=0;});}
/* Image uploads that work for everyone: shrink in the browser and keep in the shared database. */
function dbImage(f){return new Promise(function(res,rej){
  if(!/^image\//.test(f.type||"")||/svg/.test(f.type)){rej({code:"unsupported_type"});return;}
  if(!db){rej({code:"no_db"});return;}
  var url=URL.createObjectURL(f),im=new Image();
  im.onload=function(){try{var w=im.naturalWidth,h=im.naturalHeight,png=/png/.test(f.type)&&w*h<1200*1200,data="",max=1400,q=0.85;
      for(var tries=0;tries<6;tries++){var sc=Math.min(1,max/w,(max*6)/h),cv=document.createElement("canvas");cv.width=Math.round(w*sc);cv.height=Math.round(h*sc);var cx=cv.getContext("2d");if(!png){cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);}cx.drawImage(im,0,0,cv.width,cv.height);
        data=png?cv.toDataURL("image/png"):cv.toDataURL("image/jpeg",q);if(data.length<1400000)break;png=false;max=Math.round(max*0.8);q=Math.max(0.6,q-0.07);}
      URL.revokeObjectURL(url);var mid=uid("m");
      var CH=200000,parts=[];for(var o=0;o<data.length;o+=CH)parts.push(data.slice(o,o+CH));
      var writes=[db.doc("media/"+mid).set({data:parts[0],parts:parts.length,type:png?"image/png":"image/jpeg",name:f.name,w:w,h:h,at:now()})];
      for(var pi=1;pi<parts.length;pi++)writes.push(db.doc("media/"+mid+"~"+pi).set({data:parts[pi]}));
      Promise.all(writes).then(function(){S.media=S.media||{};S.media["db:"+mid]=data;res({id:"db:"+mid,contentType:png?"image/png":"image/jpeg"});},function(e){console.warn("media save",e);rej({code:"save_failed",message:(e&&(e.code||e.message))||""});});
    }catch(e){rej(e);}};
  im.onerror=function(){URL.revokeObjectURL(url);rej({code:"unsupported_type"});};im.src=url;});}
function wrapAssets(real){return {upload:function(f,o){if(!real)return Promise.reject({code:"no_assets"});return Promise.race([real.upload(f,o),new Promise(function(_,rj){setTimeout(function(){rj({code:"timeout"});},180000);})]);}};}
function monthLabel(k){if(!k)return "";var p=k.split("-");return new Date(+p[0],+p[1]-1,1).toLocaleDateString("en-AU",{month:"long",year:"numeric"});}
function nextMonthKey(k){var d=k?new Date(+k.split("-")[0],+k.split("-")[1],1):new Date(new Date().getFullYear(),new Date().getMonth()+1,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function shortDate(iso){if(!iso)return "";try{return new Date(iso).toLocaleDateString("en-AU",{day:"numeric",month:"short"});}catch(e){return "";}}
function daysSince(iso){if(!iso)return 0;return Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/86400000));}
/* Working days since a date: Monday to Friday, not counting the day it was sent. */
function workDays(iso){if(!iso)return 0;var d=new Date(iso);d.setHours(0,0,0,0);var t=new Date();t.setHours(0,0,0,0);var n=0,guard=0;d.setDate(d.getDate()+1);while(d<=t&&guard++<4000){var w=d.getDay();if(w!==0&&w!==6)n++;d.setDate(d.getDate()+1);}return n;}
function initials(n){return String(n||"?").split(" ").filter(Boolean).slice(0,3).map(function(w){return w[0].toUpperCase();}).join("");}
function toast(msg){var t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(function(){t.hidden=true;},3200);}
function fail(e){console.warn(e);toast((e&&e.message)?"Couldn't save: "+e.message:"Couldn't save that change. Check your connection and try again.");}

/* ---------- data ---------- */
function clientList(){return Object.keys(S.clients).map(function(k){return S.clients[k];}).sort(function(a,b){return a.name.localeCompare(b.name);});}
function adsFor(cid,mk){return Object.keys(S.ads).map(function(k){return S.ads[k];}).filter(function(a){return a.clientId===cid&&(a.kind||"meta")==="meta"&&(!mk||a.monthKey===mk);}).sort(function(a,b){return (a.group||"").localeCompare(b.group||"")||(a.order||0)-(b.order||0)||(a.createdAt||"").localeCompare(b.createdAt||"");});}
function monthsFor(c){var set={};(c.months||[]).forEach(function(m){set[m]=1;});adsFor(c.id).forEach(function(a){set[a.monthKey]=1;});return Object.keys(set).sort().reverse();}
function latestMonth(c){return monthsFor(c)[0]||null;}
function copyLines(a){return a.primaries.concat(a.headlines,[a.description,a.ctaLine]);}
function allLines(a){var x=linesOfKind(a);return x||copyLines(a).concat(a.creatives);}
function openComments(a){var n=0;allLines(a).forEach(function(l){(l.comments||[]).forEach(function(c){if(!c.resolved&&c.role==="client")n++;});});(a.overall||[]).forEach(function(c){if(!c.resolved&&c.role==="client")n++;});return n;}
function lineHasIssue(l){return l.state==="reword"||(l.comments||[]).some(function(c){return !c.resolved&&c.role==="client";});}
function stripId(o){var c=clone(o);delete c.id;return c;}
var ixQueue=Promise.resolve();
function touchIndex(kind,id,entry){known[kind][id]=entry.u;var patch={};patch[kind]={};patch[kind][id]=entry;
  ixQueue=ixQueue.then(function(){return db.doc("index/main").update(patch);}).catch(function(){var p2={clients:{},ads:{}};p2[kind][id]=entry;return db.doc("index/main").set(p2).catch(fail);});}
function saveAd(a){a.updatedAt=now();S.ads[a.id]=a;render();if(!db)return;var id=a.id,u=a.updatedAt,c=a.clientId;db.doc("ads/"+id).set(stripId(a)).then(function(){touchIndex("ads",id,{c:c,u:u});}).catch(fail);}
function saveClient(c){c.updatedAt=now();S.clients[c.id]=c;render();if(!db)return;var id=c.id,u=c.updatedAt;db.doc("clients/"+id).set(stripId(c)).then(function(){touchIndex("clients",id,{u:u});}).catch(fail);}
function curAd(){return S.ads[S.adId]||null;}
function getLine(a,kind,i){if(kind==="p")return a.primaries[i];if(kind==="h")return a.headlines[i];if(kind==="dsc")return a.description;if(kind==="cta")return a.ctaLine;if(kind==="c")return a.creatives[i];if(kind==="d")return a.descriptions[i];if(kind==="kw")return a.keywords;if(kind==="mt")return a.metaTitle;if(kind==="md")return a.metaDesc;if(kind==="pa")return a.paras[i];if(kind==="cap")return a.caption;if(kind==="fc"){if(!a.firstComment)a.firstComment=L("");return a.firstComment;}if(kind==="fi")return a.featured;if(kind==="gt"){if(!a.gbpText)a.gbpText=L("");return a.gbpText;}return null;}
function editAd(fn){var a=curAd();if(!a)return;var n=clone(a);fn(n);saveAd(n);}

/* ---------- people ---------- */
var pendingIds={};
function personName(c){
  if(c.by&&S.profiles[c.by]&&S.profiles[c.by].name)return S.profiles[c.by].name;
  if(c.by&&!S.profiles[c.by])pendingIds[c.by]=1;
  return c.name||(c.role==="client"?"Client":"Gordon Digital");
}
function fetchProfiles(){var ids=Object.keys(pendingIds);if(!ids.length||!user)return;pendingIds={};
  user.profiles(ids).then(function(r){ids.forEach(function(id){S.profiles[id]=r[id]||{name:""};});render();}).catch(function(){});}

/* ---------- render ---------- */
function editing(){var el=document.activeElement;return el&&el.closest&&el.closest("main,nav")&&((/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&el.type!=="file"&&el.type!=="checkbox")||el.isContentEditable);}
function schedule(){if(editing()){dirty=true;return;}render();}
document.addEventListener("focusout",function(){setTimeout(function(){if(dirty&&!editing()){dirty=false;render();}},180);});

function render(){
  var main=document.getElementById("main"),nav=document.getElementById("nav");
  document.getElementById("mode-team").setAttribute("aria-pressed",S.mode==="team");
  document.getElementById("mode-client").setAttribute("aria-pressed",S.mode==="client");
  var sel=document.getElementById("as-client");
  var cl=clientList();
  sel.hidden=S.mode!=="client"||!cl.length||!!GDA.client;
  sel.innerHTML=cl.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===S.asClient?" selected":"")+'>'+esc(c.name)+'</option>';}).join("");
  var meName=(S.me&&S.me.name)||"You";
  document.getElementById("who").innerHTML='<span class="nm">'+esc(S.mode==="client"&&!GDA.client?"Testing as the client":meName)+'</span><span class="av-me" title="'+esc(meName)+'">'+esc(initials(meName))+'</span>';
  if(S.noDb){main.innerHTML='<div class="empty"><h2>Open this page on claude.ai to use it</h2><p class="muted" style="margin-top:8px">The shared approvals database only runs in the published artifact.</p></div>';nav.innerHTML="";return;}
  if(!S.loadedC||!S.loadedA){return;}
  var vk=[S.mode,S.page,S.cpage,S.kind,S.monthKey,S.folderId,S.adId].join("|");var y=main.querySelector(".work.wide,.cw-main,.col-main,.page");var keep=y&&vk===render._vk?y.scrollTop:0;render._vk=vk;
  if(S.mode==="client"){nav.innerHTML=clientNav();main.innerHTML=clientPage();}
  else{nav.innerHTML=teamNav();main.innerHTML=teamPage();}
  var y2=main.querySelector(".work.wide,.cw-main,.col-main,.page");if(y2&&keep)y2.scrollTop=keep;
  fetchProfiles();
}

/* ---------- shared bits ---------- */
function statusPill(st,team){var map=team?TEAM_ST:CLIENT_ST;return '<span class="pill st-'+st+'">'+esc(map[st]||st)+'</span>';}
function logoHtml(c,cls){cls=cls||"";return c&&c.logoId?'<img class="logo '+cls+'" src="'+esc(blob(c.logoId))+'" alt="">':'<span class="logo '+cls+'">'+esc(initials(c?c.name:"?"))+'</span>';}
function commentHtml(c,kind,i,ci,team){
  var cls="cmt"+(c.resolved?" done":(c.role==="team"?" team":""));
  var tag=c.resolved?"Resolved by "+esc(c.resolvedByName||"Gordon Digital"):(c.role==="team"?"Gordon Digital reply":"");
  var res=team&&!c.resolved&&c.role==="client"?'<button type="button" class="btn sm" data-act="resolve" data-k="'+kind+'" data-i="'+i+'" data-ci="'+ci+'">Mark resolved</button>':"";
  return '<div class="'+cls+'"><div class="by">'+esc(personName(c))+' · '+(c.role==="client"?"Client":"Gordon Digital")+'<span>'+esc(shortDate(c.at))+'</span></div><p>'+esc(c.text)+'</p>'+((tag||res)?'<div class="row" style="justify-content:space-between"><span class="tiny muted">'+tag+'</span>'+res+'</div>':"")+'</div>';
}
function composer(key,kind,i,label,btn){
  if(S.composer!==key)return "";
  return '<div style="display:flex;flex-direction:column;gap:8px"><label class="f" for="cmp-'+key+'">'+esc(label)+'<textarea class="in" id="cmp-'+key+'" rows="3" data-draft="1">'+esc(S.draft)+'</textarea></label><div class="row" style="justify-content:flex-end"><button type="button" class="btn sm" data-act="cancelCompose">Cancel</button><button type="button" class="btn sm accent" data-act="sendComment" data-k="'+kind+'" data-i="'+i+'">'+esc(btn)+'</button></div></div>';
}

/* ---------- preview ---------- */
var AR={"4:5":"4/5","1:1":"1/1","9:16":"9/16","1.91:1":"1.91/1"};
var PLACEMENTS=[["fb","Facebook feed"],["ig","Instagram feed"],["story","Stories"],["reel","Reels"]];
var ICON_HEART='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
var ICON_CHAT='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18l1.5-3.5A7.5 7.5 0 1 1 9 18.5z"/></svg>';
var ICON_SEND='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>';
function isVertical(){return S.placement==="story"||S.placement==="reel";}
function pickMedia(a){var want=isVertical()?"9:16":"1:1";return a.creatives.filter(function(c){return c.assetId&&c.ratio===want;})[0]||null;}
function mediaHtml(m,a,vertical){
  var st=vertical?"padding:0;object-fit:cover":"padding:0;aspect-ratio:1/1;object-fit:cover";
  if(m){return m.isVideo?'<video class="media" style="'+st+'" src="'+esc(blob(m.assetId))+'" muted autoplay loop playsinline></video>':'<img class="media" style="'+st+'" src="'+esc(blob(m.assetId))+'" alt="Ad creative">';}
  return '<div class="media" style="'+(vertical?"":"aspect-ratio:1/1")+'">No '+(vertical?"9:16":"1:1")+' file uploaded yet\n'+(vertical?"Stories and Reels use a 9:16 file":"Facebook and Instagram feeds use a 1:1 file")+'</div>';
}
/* Cut the text where the platform does: a character limit and a line limit, whichever comes first. */
function platformCut(t,chars,lines){t=String(t||"");var ls=t.split("\n"),out=[],used=0,stopped=false;
  for(var i=0;i<ls.length;i++){if(out.length>=lines){stopped=true;break;}var l=ls[i];
    if(used+l.length>chars){var room=Math.max(0,chars-used);var c=l.slice(0,room);var sp=c.lastIndexOf(" ");out.push(sp>20?c.slice(0,sp):c);stopped=true;break;}
    out.push(l);used+=l.length;}
  while(out.length&&!out[out.length-1].trim())out.pop();
  var txt=out.join("\n");return {text:txt,cut:stopped||txt.trim().length<t.trim().length};}
function cut(t,n){if(t.length<=n)return t;var c=t.slice(0,n);return c.slice(0,c.lastIndexOf(" "))+"...";}
function firstFilled(arr,i){i=Math.min(i,arr.length-1);if(hasText(arr[i]))return i;for(var k=0;k<arr.length;k++)if(hasText(arr[k]))return k;return Math.max(0,i);}
function previewHtml(a,c){
  var pI=firstFilled(a.primaries,S.pIdx),hI=firstFilled(a.headlines,S.hIdx);
  var full=a.primaries[pI].text,hlText=a.headlines[hI].text;
  var av=c&&c.logoId?'<img class="av" src="'+esc(blob(c.logoId))+'" alt="">':'<span class="av">'+esc(initials(c.name))+'</span>';
  var avSm=av.replace('class="av"','class="av" style="width:28px;height:28px"');
  var domain=esc(String(c.website||"").replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/$/,""));
  var handle=esc(c.ig||c.name);
  var pick=function(label,arr,idx,act){var n=0;return '<div class="vpick"><span>'+label+'</span>'+arr.map(function(l,i){if(!hasText(l))return "";n++;var num=S.mode==="client"?n:i+1;return '<button type="button" class="'+(l.state==="reword"?"rw":"")+'" aria-pressed="'+(i===idx)+'" aria-label="'+label+' '+num+'" data-act="'+act+'" data-i="'+i+'">'+num+'</button>';}).join("")+'</div>';};
  var out='<label class="vpick plc" for="pv-placement"><span>Placement</span><select class="in" id="pv-placement" data-placement="1">'+PLACEMENTS.map(function(p){return '<option value="'+p[0]+'"'+(S.placement===p[0]?" selected":"")+'>'+p[1]+'</option>';}).join("")+'</select></label>';
  
  var fbT=platformCut(full,125,3),igT=platformCut(full,125,2),stT=platformCut(full.replace(/\n+/g," "),90,2),rlT=platformCut(full.replace(/\n+/g," "),72,1);
  var more=function(x,word){return esc(x.text)+(x.cut?'<span class="moretxt">... '+word+'</span>':"");};
  var cards=a.type==="CAROUSEL"?a.creatives:null;
  var cardStrip=function(){return '<div class="car" aria-label="Carousel cards, scroll sideways">'+cards.map(function(cd,ci){
      var src=cd.assetId?(cd.isVideo?'<video class="media" style="padding:0;aspect-ratio:1/1;object-fit:cover" src="'+esc(blob(cd.assetId))+'" muted autoplay loop playsinline></video>':'<img class="media" style="padding:0;aspect-ratio:1/1;object-fit:cover" src="'+esc(blob(cd.assetId))+'" alt="Card '+(ci+1)+'">'):'<div class="media" style="aspect-ratio:1/1">Card '+(ci+1)+'\n(no file yet)</div>';
      return '<div class="card-c">'+src+'<div class="ft"><div style="min-width:0"><div class="hl one">'+esc(cd.cardHeadline||hlText)+'</div><div class="ds">Card '+(ci+1)+' of '+cards.length+'</div></div><span class="cta">'+esc(a.cta)+'</span></div></div>';}).join("")+'</div>';};
  if(cards&&!isVertical()){
    var ig=S.placement==="ig";
    out+='<div class="fb"><div class="hd">'+av+'<div><div class="nm">'+(ig?handle:esc(c.name))+'</div><div class="sp">Sponsored</div></div></div>'+(ig?"":'<div class="bd">'+more(fbT,"See more")+'</div>')+cardStrip()+(ig?'<div class="bd" style="padding-top:10px"><b>'+handle+'</b> '+more(igT,"more")+'</div>':"")+'</div><p class="small muted" style="width:380px;max-width:100%">Scroll sideways to see all '+cards.length+' cards.</p>';
  }else if(S.placement==="fb"){
    out+='<div class="fb"><div class="hd">'+av+'<div><div class="nm">'+esc(c.name)+'</div><div class="sp">Sponsored</div></div></div><div class="bd">'+more(fbT,"See more")+'</div>'+mediaHtml(pickMedia(a),a,false)+'<div class="ft"><div style="min-width:0"><div class="dm one">'+domain+'</div><div class="hl one">'+esc(hlText)+'</div><div class="ds one">'+esc(a.description.text)+'</div></div><span class="cta">'+esc(a.cta)+'</span></div></div>';
  }else if(S.placement==="ig"){
    out+='<div class="fb ig"><div class="hd">'+av+'<div><div class="nm">'+handle+'</div><div class="sp">Sponsored</div></div></div>'+mediaHtml(pickMedia(a),a,false)+'<div class="igcta"><span>'+esc(a.cta)+'</span><span aria-hidden="true">›</span></div><div class="bd" style="padding-top:10px"><b>'+handle+'</b> '+more(igT,"more")+'</div></div>';
  }else if(S.placement==="story"){
    var sm=cards?(cards.filter(function(x){return x.assetId;})[0]||null):pickMedia(a);
    var smHtml=mediaHtml(sm,a,true);if(cards&&sm)smHtml=smHtml.replace("object-fit:cover","object-fit:contain;background:#000");
    out+='<div class="story">'+smHtml+'<div class="sh">'+avSm+esc(c.name)+' <span style="font-weight:400">Sponsored</span></div><div class="sb"><span>'+more(stT,"more")+'</span><span class="c">'+esc(a.cta)+'</span></div></div>';
    if(cards)out+='<p class="small" style="width:380px;max-width:100%">Carousel cards are 1:1, so Stories shows them one at a time with bars. Upload a 9:16 version if you want a full screen Stories ad.</p>';
  }else{
    var rm=cards?null:pickMedia(a);
    out+='<div class="story reel">'+mediaHtml(rm,a,true)+'<div class="rside" aria-hidden="true">'+ICON_HEART+ICON_CHAT+ICON_SEND+'</div><div class="rb"><div class="row" style="gap:8px">'+avSm+'<b>'+handle+'</b><span style="font-size:12px;opacity:.85">Sponsored</span></div><div>'+more(rlT,"more")+'</div><div class="rcta">'+esc(a.cta)+' <span aria-hidden="true">›</span></div></div></div>';
    if(cards)out+='<p class="small" style="width:380px;max-width:100%">Carousels don\'t run in Reels, so this placement is skipped for this ad.</p>';
  }
  var where=S.placement==="fb"?"Facebook":(S.placement==="ig"?"Instagram":(S.placement==="story"?"Stories":"Reels"));
  var vnum=function(arr,i){return S.mode==="client"?arr.slice(0,i+1).filter(hasText).length:i+1;};
  if(S.mode!=="client")out+='<div class="pv-opts">'+pick("Primary text",a.primaries,pI,"pv-p")+pick("Headline",a.headlines,hI,"pv-h")+'</div>';
  out+='<p class="small muted" style="width:380px;max-width:100%">Text is cut where '+where+' cuts it. Showing primary text '+vnum(a.primaries,pI)+' with headline '+vnum(a.headlines,hI)+'. '+(S.mode==="client"?"Press Preview on any primary text or headline on the right to see it here.":"Every option is listed in full on the right.")+'</p>';
  return out;
}

/* ---------- client view ---------- */
var ICON_CHECK='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function newClientComments(a){var since=a.sentAt||"",n=0,chk=function(c){if(c&&c.role==="client"&&!c.resolved&&(c.at||"")>=since)n++;};(a.overall||[]).forEach(chk);(allLines(a)||[]).forEach(function(l){(l&&l.comments||[]).forEach(chk);});return n;}
function decisionBtns(a){var n=newClientComments(a);
  return '<div class="ac-btns"><button type="button" class="ac-ok" data-act="cardApprove" data-v="'+a.id+'">'+ICON_CHECK+'Approve</button>'+(n?'<button type="button" class="ac-sub" data-act="submitChanges" data-v="'+a.id+'">Submit changes · '+n+'</button>':'<button type="button" class="ac-rw" data-act="cardChanges" data-v="'+a.id+'">Request changes</button>')+'</div>'+(n?'<span class="tiny muted">'+n+' comment'+(n>1?"s":"")+' ready to send. Submit when you\'ve finished.</span>':'');}
function adCard(x,cur){
  var foot;
  if(x.status==="awaiting")foot='<div class="ac-ask"><span class="eyebrow">Approval requested</span>'+decisionBtns(x)+'</div>';
  else if(x.status==="approved"||x.status==="live")foot='<div class="ac-done">'+ICON_CHECK+(x.status==="live"?"Approved · Live":"Approved"+(x.approvedAt?" "+esc(shortDate(x.approvedAt)):""))+'</div>';
  else foot='<div>'+statusPill(x.status,false)+'</div>';
  return '<div class="item'+(cur?" cur":"")+'" data-act="pickAd" data-v="'+x.id+'" aria-current="'+cur+'"><button type="button" class="ac-t" data-act="pickAd" data-v="'+x.id+'"><span class="t">'+esc(x.title)+'</span><span class="small muted">'+esc(itemSub(x))+'</span></button>'+foot+'</div>';
}
function clientNav(){
  var c=S.clients[S.asClient];if(!c)return "";
  var multi=clientList().length>1;var h='<label class="brand-sw"'+(multi?' for="brand-pick"':'')+'>'+logoHtml(c)+'<span style="min-width:0;flex:1"><span class="tiny muted">Brand</span><b>'+esc(c.name)+'</b></span>'+(multi?'<select id="brand-pick" data-brandpick="1" aria-label="Choose brand" class="sw-sel">'+clientList().map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===c.id?' selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select><svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>':'')+'</label>';
  var w=allItems(c.id).filter(function(x){return x.status==="awaiting";}).length;
  h+='<button type="button" class="nav-btn" data-act="cpage" data-v="overview" aria-current="'+(S.cpage==="overview")+'"><span class="ic">'+navIc("overview")+'<span>Overview</span></span>'+(w?'<span class="pill st-awaiting">'+w+'</span>':'')+'</button>';
  h+='<button type="button" class="nav-btn" data-act="cpage" data-v="assets" aria-current="'+(S.cpage==="assets")+'"><span class="ic">'+navIc("brand")+'<span>Brand assets</span></span></button>';
  return h+navFolders(c,false);
}
function clientPage(){
  var c=S.clients[S.asClient];if(!c)return '<div class="empty">Add a client in the Gordon Digital portal first.</div>';
  if(S.cpage==="assets")return brandPage();
  if(S.cpage==="overview")return overviewPage();
  if(S.kind&&S.kind!=="meta")return clientKindPage();
  if(!S.monthKey||monthsFor(c).indexOf(S.monthKey)<0)S.monthKey=(folderList(c,"meta").filter(function(f){return !f.archived;})[0]||{}).id||latestMonth(c);
  var ads=adsFor(c.id,S.monthKey).filter(function(a){return seen(a);});
  var head='<div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / Meta Ads</span><h1>'+esc(monthLabel(S.monthKey))+'</h1><span class="muted">'+ads.length+' ads to review</span></div>';
  var nA=ads.filter(function(a){return a.status==="approved"||a.status==="live";}).length,nC=ads.filter(function(a){return a.status==="changes";}).length,nW=ads.filter(function(a){return a.status==="awaiting";}).length;
  if(ads.length)head+='<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="small"><b>'+nA+' approved</b> · '+nC+' being updated · '+nW+' waiting on you</span><div class="bar" style="width:280px;display:flex"><i style="width:'+(nA/ads.length*100)+'%"></i><i style="width:'+(nC/ads.length*100)+'%;background:#8eb5dc"></i></div></div>';
  head+='</div>';
  if(!ads.length)return head+'<div class="card empty">Nothing to review this month yet. Gordon Digital will let you know when ads are ready.</div>';
  var a=S.ads[S.adId];if(!a||a.clientId!==c.id||a.monthKey!==S.monthKey||!seen(a)){a=ads[0];S.adId=a.id;}
  var groups={};ads.forEach(function(x){(groups[x.group]=groups[x.group]||[]).push(x);});
  var list=Object.keys(groups).map(function(g){return '<div class="eyebrow" style="margin-top:6px">'+esc(g)+'</div>'+groups[g].map(function(x){return adCard(x,x.id===a.id);}).join("");}).join("");
  return head+'<div class="work"><section class="col-list" aria-label="Ads">'+list+'</section><section class="col-prev" aria-label="Preview">'+previewHtml(a,c)+'</section><section class="col-main" aria-label="Review">'+clientPanel(a)+'</section></div>';
}
function commentsBox(a,locked){
  var req=S.reqChanges===a.id&&!locked;
  var me=(S.me&&S.me.name)||"You";
  var list=(a.overall||[]).map(function(cm,ci){return commentHtml(cm,"o",0,ci,false);}).join("");
  var rw=clientLines(a).filter(function(l){return l.state==="reword";}).length;
  var h='<div class="card cbox'+(req?" req":"")+'"><span class="eyebrow">'+(req?"Request changes":"Comments")+'</span>';
  if(req)h+='<p class="small">Tell us what to change. '+(rw?"Your "+rw+" comment"+(rw>1?"s":"")+" on specific lines below will be sent too.":"You can also comment on specific lines below.")+'</p>';
  else h+=list||'<p class="small muted">No comments yet. Anything you add here goes to the Gordon Digital team.</p>';
  if(!locked||!req){
    h+='<div class="c-in"><span class="c-av" aria-hidden="true">'+esc(initials(me))+'</span><textarea class="in" id="c-odraft" rows="'+(req?3:1)+'" data-odraft="1" placeholder="'+(req?"What would you like changed?":"Add a comment for Gordon Digital")+'" aria-label="'+(req?"What would you like changed?":"Add a comment")+'">'+esc(S.odraft||"")+'</textarea></div>';
    h+='<div class="c-bar">'+(req?'<button type="button" class="btn sm" data-act="cancelReq">Cancel</button><button type="button" class="btn sm dark" id="c-post" data-act="postOverall" data-v="changes"'+(String(S.odraft||"").trim()||rw?"":" disabled")+'>Send changes to Gordon Digital</button>':'<button type="button" class="btn sm dark" id="c-post" data-act="postOverall"'+(String(S.odraft||"").trim()?"":" disabled")+'>Post</button>')+'</div>';
  }
  return h+'</div>';
}
function clientLine(a,kind,i,l,label,limit,locked,previewable,shown){
  var key=kind+i,n=l.text.length,count="";
  if(limit==="meta")count=n+" characters"+(n>125?" · cut at 125 in feed":"");else if(limit)count=n+"/"+limit;
  var media="";if(kind==="c"&&l.assetId)media=l.isVideo?'<video src="'+esc(blob(l.assetId))+'" controls style="width:100%;max-height:360px;border-radius:12px;background:#000"></video>':'<img src="'+esc(blob(l.assetId))+'" alt="'+esc(label)+'" style="width:100%;max-height:360px;object-fit:contain;border-radius:12px;background:var(--surface-2)">';
  var text=kind==="c"?((l.cardHeadline?"Card headline: "+l.cardHeadline+"\n":"")+l.fileName+(l.text?"\n"+l.text:"")):(kind==="cta"?a.cta+"\n"+a.url:l.text);
  var acts=locked||S.composer===key?"":'<button type="button" class="btn sm" data-act="compose" data-v="'+key+'">Comment</button>';
  if(previewable)acts+='<button type="button" class="btn sm" style="margin-left:auto;align-self:flex-end;border-color:transparent;background:var(--surface-2)" data-act="'+(kind==="p"?"pv-p":"pv-h")+'" data-i="'+i+'">'+(shown?"In preview":"Preview")+'</button>';
  return '<div class="panel'+(shown?" hl":"")+'"><div class="lbl"><span>'+esc(label)+'</span></div>'+media+'<div class="txt">'+esc(text)+'</div><div class="row">'+acts+'</div>'+(l.comments||[]).map(function(cm,ci){return commentHtml(cm,kind,i,ci,false);}).join("")+composer(key,kind,i,"Your comment on "+label.toLowerCase(),"Add comment")+'</div>';
}
function clientPanel(a){
  var locked=a.status==="approved"||a.status==="live";
  var lines=clientLines(a),ok=lines.filter(function(l){return l.state==="ok";}).length,rw=lines.filter(function(l){return l.state==="reword";}).length,none=lines.length-ok-rw;
  var pI=firstFilled(a.primaries,S.pIdx),hI=firstFilled(a.headlines,S.hIdx);
  var h='<div class="card"><div class="lbl" style="align-items:flex-start"><h2>'+esc(a.title)+'</h2>'+statusPill(a.status,false)+'</div><span class="small muted">'+esc(plainFormat(a.type))+' · '+esc(a.note||("Version "+a.version))+'</span>';
  if(locked)h+='<div class="lock"><span class="small">'+(a.approvedAt?"Approved "+esc(shortDate(a.approvedAt))+". ":"")+(a.status==="live"?"Live in Meta.":"Gordon Digital has been notified and will switch it on.")+'</span></div>';
  else if(a.status==="awaiting")h+=decisionBtns(a);
  h+='</div>';
  h+=commentsBox(a,locked);
  var cN=clientLines(a).filter(function(l){return a.creatives.indexOf(l)<0;}).filter(lineHasIssue).length,crN=a.creatives.filter(hasCreative).filter(lineHasIssue).length;
  h+='<div class="chips" role="group" aria-label="Feedback on"><button type="button" data-act="tab" data-v="copy" aria-pressed="'+(S.tab==="copy")+'">Copy · '+cN+'</button><button type="button" data-act="tab" data-v="creative" aria-pressed="'+(S.tab==="creative")+'">Creative · '+crN+'</button></div>';
  var sec=function(t,note,body){return '<div style="display:flex;flex-direction:column;gap:10px"><div style="padding:0 4px"><h3>'+t+'</h3><span class="small muted">'+note+'</span></div>'+body+'</div>';};
  if(S.tab==="copy"){
    var list=function(arr,kind,word,limit,shownI){var n=0;return arr.map(function(l,i){if(!hasText(l))return "";n++;return clientLine(a,kind,i,l,word+(arr.filter(hasText).length>1?" "+n:""),limit,locked,true,i===shownI);}).join("");};
    var nP=a.primaries.filter(hasText).length,nH=a.headlines.filter(hasText).length;
    if(nP)h+=sec("Primary text",(nP>1?"All "+nP+" options in full. Meta rotates them and shows":"In full. Meta shows")+" the first 125 characters before See more.",list(a.primaries,"p","Primary text","meta",pI));
    if(nH)h+=sec(nH>1?"Headlines":"Headline","Meta recommends 40 characters or fewer.",list(a.headlines,"h","Headline",40,hI));
    if(hasText(a.description))h+=sec("Description","The line under the headline. Shows in some placements.",clientLine(a,"dsc",0,a.description,"Description",30,locked));
    h+=sec("Button and landing page","What people tap and where it takes them.",clientLine(a,"cta",0,a.ctaLine,"Call to action",null,locked));
  }else{
    var nC=a.creatives.filter(hasCreative).length,cn=0;h+=sec("Creative","Comment on each file. One approval covers the copy and creative together.",nC?a.creatives.map(function(l,i){if(!hasCreative(l))return "";cn++;return clientLine(a,"c",i,l,nC>1?"Card "+cn:"Creative",null,locked);}).join(""):'<p class="small muted" style="padding:0 4px">Creative files are on their way.</p>');
  }
  return h;
}


/* ---------- brand assets ---------- */
var GFONTS=["Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Raleway","Nunito","Nunito Sans","Work Sans","Public Sans","DM Sans","Manrope","Plus Jakarta Sans","Outfit","Figtree","Sora","Urbanist","Lexend","Archivo","Barlow","Barlow Condensed","Rubik","Karla","Mulish","Source Sans 3","IBM Plex Sans","Noto Sans","PT Sans","Oswald","Bebas Neue","Anton","Archivo Black","League Spartan","Josefin Sans","Quicksand","Cabin","Hind","Titillium Web","Space Grotesk","Syne","Red Hat Display","Libre Franklin","Fira Sans","Exo 2","Kanit","Playfair Display","Merriweather","Lora","Libre Baskerville","Cormorant Garamond","EB Garamond","DM Serif Display","Crimson Text","PT Serif","Source Serif 4","Noto Serif","Bitter","Zilla Slab","Roboto Slab","Abril Fatface","Cinzel","Prata","Marcellus","Italiana","Tenor Sans","Dancing Script","Great Vibes","Pacifico","Caveat"];
var loadedFonts={};
function fontFamily(f){return f.source==="upload"?"gdup-"+(f.assetId||f.name):f.name;}
function loadFont(f){var key=fontFamily(f);if(!f||loadedFonts[key])return;loadedFonts[key]=1;
  if(f.source==="upload"&&f.assetId){var st=document.createElement("style");st.textContent="@font-face{font-family:'"+key.replace(/'/g,"")+"';src:url('"+blob(f.assetId)+"');font-display:swap}";document.head.appendChild(st);}
  else{var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(f.name).replace(/%20/g,"+")+":wght@400;700&display=swap";document.head.appendChild(l);}}
function normHex(v){v=String(v||"").trim().replace(/^#/,"");if(/^[0-9a-f]{3}$/i.test(v))v=v.split("").map(function(c){return c+c;}).join("");return /^[0-9a-f]{6}$/i.test(v)?"#"+v.toUpperCase():"";}
var BRAND_SECTIONS=[["logos","Logos","Every version of the logo. PNG or SVG with a transparent background works best.","image/*,.svg,.eps,.ai,.pdf"],["images","Photography and video","Approved project photos, renders and footage we can use in ads.","image/*,video/*"],["files","Brand guidelines and other files","Style guides, templates and anything else we should follow.","*/*"]];
function brandOf(c){var b=(c&&c.brand)||{};return {logos:b.logos||[],images:b.images||[],files:b.files||[],colours:b.colours||[],fonts:b.fonts||[],notes:b.notes||""};}
function brandClient(){return S.mode==="client"?S.clients[S.asClient]:S.clients[S.clientId];}
function editBrand(fn){var c=brandClient();if(!c)return;var n=clone(c);var b=brandOf(n);fn(b);n.brand=b;saveClient(n);}
function assetTile(sec,it,i){
  var src=blob(it.assetId),isImg=/^image\//.test(it.type||"")||/\.(png|jpe?g|gif|webp|svg)$/i.test(it.name||"");
  var vis=it.isVideo?'<video src="'+esc(src)+'" muted loop playsinline preload="metadata"></video>':(isImg?'<img src="'+esc(src)+'" alt="'+esc(it.name)+'" loading="lazy">':'<span class="ext">'+esc(String(it.name||"").split(".").pop().toUpperCase().slice(0,4)||"FILE")+'</span>');
  return '<div class="asset'+(sec==="logos"?" logo-t":"")+'"><div class="vis">'+vis+'</div><div class="meta"><span class="nm" title="'+esc(it.name)+'">'+esc(it.name)+'</span><span class="row" style="gap:4px;flex-wrap:nowrap"><button type="button" class="btn sm" data-act="dlAsset" data-id="'+esc(it.assetId)+'" data-name="'+esc(it.name)+'">Download</button><button type="button" class="btn sm icon" data-act="brandDel" data-s="'+sec+'" data-i="'+i+'" aria-label="Remove '+esc(it.name)+'">✕</button></span></div></div>';
}
function brandPage(){
  var c=brandClient();if(!c)return '<div class="empty">Choose a client first.</div>';
  var b=brandOf(c),client=S.mode==="client";
  var h='<div class="page"><div class="head"><div class="row" style="gap:14px">'+logoHtml(c,"lg")+'<div class="l"><span class="eyebrow">'+esc(c.name)+' / Brand assets</span><h1>'+esc(c.name)+' brand</h1><span class="muted small">'+(client?"Everything Gordon Digital uses to build your ads. Add anything new here and we'll use it from the next round.":"Shared with the client. They can add files here too.")+'</span></div></div></div>';
  h+='<div class="bgrid">';
  h+='<div class="card"><div class="lbl"><h2>Colours</h2><span class="tiny muted">Click a swatch to copy the code</span></div><div class="swatches">'+(b.colours.length?b.colours.map(function(cl,i){return '<div class="sw"><button type="button" class="chip-c" style="background:'+esc(cl.hex)+'" data-act="copyHex" data-v="'+esc(cl.hex)+'" aria-label="Copy '+esc(cl.hex)+'"></button><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span><b class="small">'+esc(cl.name||"Colour")+'</b><br><span class="tiny muted num">'+esc(cl.hex.toUpperCase())+'</span></span><button type="button" class="btn sm icon" data-act="brandDel" data-s="colours" data-i="'+i+'" aria-label="Remove '+esc(cl.name||cl.hex)+'">✕</button></div></div>';}).join(""):'<p class="small muted">No colours added yet.</p>')+'</div>'+
    '<div class="addrow"><span class="hexsw" id="hex-sw" style="background:'+esc(normHex(S.bd.chex)||"transparent")+'"></span><span class="hexin"><span aria-hidden="true">#</span><input class="in" id="bd-chex" data-bd="chex" placeholder="001D21" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex code" value="'+esc(String(S.bd.chex||"").replace(/^#/,""))+'"></span><input class="in" id="bd-cname" data-bd="cname" placeholder="Name, e.g. Primary navy" value="'+esc(S.bd.cname)+'"><button type="button" class="btn" data-act="addColour">Add colour</button></div></div>';
  b.fonts.forEach(loadFont);
  h+='<div class="card"><div class="lbl"><h2>Fonts</h2>'+(assets?'<span class="btn sm filebtn">Upload font file<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" data-upload="font" aria-label="Upload a font file"></span>':'')+'</div>'+(b.fonts.length?b.fonts.map(function(f,i){return '<div class="font-row"><div style="min-width:0"><div class="fs" style="font-family:\''+esc(fontFamily(f))+'\',var(--body)">'+esc(f.name)+'</div><span class="tiny muted">'+esc((f.use?f.use+" · ":"")+(f.source==="upload"?"Uploaded file"+(f.fileName?" ("+f.fileName+")":""):"Google Fonts"))+'</span></div><span class="row" style="gap:4px;flex-wrap:nowrap">'+(f.source==="upload"&&f.assetId?'<button type="button" class="btn sm" data-act="dlAsset" data-id="'+esc(f.assetId)+'" data-name="'+esc(f.fileName||f.name)+'">Download</button>':'<a class="btn sm" href="https://fonts.google.com/specimen/'+esc(String(f.name).replace(/ /g,"+"))+'" target="_blank" rel="noopener">View</a>')+'<button type="button" class="btn sm icon" data-act="brandDel" data-s="fonts" data-i="'+i+'" aria-label="Remove '+esc(f.name)+'">✕</button></span></div>';}).join(""):'<p class="small muted">No fonts added yet.</p>')+
    '<div class="addrow"><input class="in" id="bd-fname" data-bd="fname" list="gfonts" placeholder="Search Google Fonts" autocomplete="off" value="'+esc(S.bd.fname)+'"><datalist id="gfonts">'+GFONTS.map(function(n){return '<option value="'+n+'">';}).join("")+'</datalist><input class="in" id="bd-fuse" data-bd="fuse" placeholder="Used for, e.g. Headings" value="'+esc(S.bd.fuse)+'"><button type="button" class="btn" data-act="addFont">Add font</button></div><span class="tiny muted">Pick from Google Fonts, or upload the font file if it\'s a paid or custom font. Type in "Used for" first to label an upload.</span></div>';
  h+='</div>';
  BRAND_SECTIONS.forEach(function(s){var list=b[s[0]];
    h+='<div class="card"><div class="lbl"><div><h2>'+s[1]+'</h2><span class="small muted" style="font-weight:400">'+s[2]+'</span></div>'+(assets?'<span class="btn filebtn">Upload<input type="file" multiple accept="'+s[3]+'" data-upload="brand:'+s[0]+'" aria-label="Upload '+s[1].toLowerCase()+'"></span>':'')+'</div>'+
      (list.length?'<div class="assets'+(s[0]==="files"?" files":"")+'">'+list.map(function(it,i){return assetTile(s[0],it,i);}).join("")+'</div>':'<div class="drop-e">Nothing here yet.'+(assets?" Use Upload to add files.":"")+'</div>')+'</div>';});
  h+='<div class="card"><label class="f" for="bd-notes"><span style="font-size:15px;font-weight:600;color:var(--ink)">Brand notes</span><span class="h">Tone of voice, words to use or avoid, logo rules. Anything we should know.</span><textarea class="in" rows="4" id="bd-notes" data-bnotes="1">'+esc(b.notes)+'</textarea></label></div>';
  if(!assets)h+='<p class="small muted">Uploading needs edit access to this test page. In the full build every client can upload.</p>';
  return h+'</div>';
}

/* ---------- approval types, folders and archive ---------- */
var KINDS=[
  {k:"meta",name:"Meta Ads",unit:"ad",units:"ads",folder:"Month",live:"Live in Meta",add:"Add a month"},
  {k:"search",name:"Google Search",unit:"ad",units:"ads",folder:"Campaign",live:"Live in Google Ads",add:"Add campaign",ph:"Campaign name, e.g. Knockdown Rebuild"},
  {k:"landing",name:"Landing pages",unit:"page",units:"pages",folder:"Purpose",live:"Published",add:"Add landing page",ph:"Purpose, e.g. House and Land Packages"},
  {k:"webpage",name:"Website pages",unit:"page",units:"pages",folder:"Purpose",live:"Published",add:"Add website project",ph:"Purpose, e.g. Display Homes page"},
  {k:"seo",name:"Content",unit:"item",units:"items",addItem:"Add content",folder:"Month or quarter",live:"Published",add:"Add month or quarter",ph:"e.g. January 2027 or Q1 2027"},
  {k:"social",name:"Organic social",unit:"post",units:"posts",folder:"Month or quarter",live:"Posted",add:"Add month or quarter",ph:"e.g. January 2027 or Q1 2027"}
];
var GBP="Google Business post";
var GBP_TYPES=["Update","Offer","Event"];
var GBP_CTAS=["None","Learn more","Book","Call now","Order online","Buy","Sign up","Get offer"];
function isGbp(a){return kindOf(a)==="seo"&&a.contentType===GBP;}
var SOCIAL_PLATFORMS=["Facebook","Instagram","Pinterest"];
function K(k){for(var i=0;i<KINDS.length;i++)if(KINDS[i].k===k)return KINDS[i];return KINDS[0];}
function kindOf(x){return (x&&x.kind)||"meta";}
function rawFolders(c,k){return ((c&&c.folders)||{})[k]||[];}
function enabledKinds(c){var p=(c&&c.platforms)||{};return KINDS.filter(function(x){if(x.k==="meta")return p.meta!==false||monthsFor(c).length;return p[x.k]||rawFolders(c,x.k).length;});}
function folderList(c,k){
  if(k==="meta"){var ar=c.archivedMonths||[];return monthsFor(c).map(function(m){return {id:m,name:monthLabel(m),archived:ar.indexOf(m)>=0};});}
  return rawFolders(c,k).slice().sort(function(a,b){return (b.createdAt||"").localeCompare(a.createdAt||"");});
}
function folderName(c,k,fid){if(k==="meta")return monthLabel(fid);var f=rawFolders(c,k).filter(function(x){return x.id===fid;})[0];return f?f.name:"";}
function itemsIn(cid,k,fid){
  if(k==="meta")return adsFor(cid,fid).sort(function(a,b){return (a.status==="archived")-(b.status==="archived");});
  return Object.keys(S.ads).map(function(id){return S.ads[id];}).filter(function(a){return a.clientId===cid&&a.kind===k&&a.folderId===fid;}).sort(function(a,b){return (a.order||0)-(b.order||0)||(a.createdAt||"").localeCompare(b.createdAt||"");});
}
function allItems(cid){return Object.keys(S.ads).map(function(id){return S.ads[id];}).filter(function(a){return a.clientId===cid;});}
function curFolder(){return S.kind==="meta"?S.monthKey:S.folderId;}
function seen(x){return x.status!=="draft"&&x.status!=="archived";}
function isDone(x){return x.status==="approved"||x.status==="live";}
function itemSub(x){
  var k=kindOf(x);
  if(k==="meta")return plainFormat(x.type)+" · Version "+x.version;
  if(k==="search")return "Search ad · Version "+x.version;
  if(k==="seo"&&isGbp(x))return "Google Business "+(x.gbpType||"Update").toLowerCase()+" · Version "+x.version;
  if(k==="seo")return (x.contentType||"Article")+(x.keyword?" · "+x.keyword:"")+" · Version "+x.version;
  if(k==="social")return (x.postDate?postWhen(x)+" · ":"")+((x.platforms||[]).join(", ")||"Post");
  return (k==="landing"?"Landing page":"Website page")+" · Version "+x.version;
}
function niceTime(t){if(!t)return "";var p=t.split(":"),h=+p[0],m=p[1]||"00";return (h%12||12)+":"+m+" "+(h<12?"am":"pm");}
function postWhen(x){return x.postDate?niceDate(x.postDate)+(x.postTime?" · "+niceTime(x.postTime):""):"";}
function niceDate(d){if(!d)return "";try{var p=d.split("-");return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});}catch(e){return d;}}
function domainOf(u){return String(u||"").replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];}

/* lines that carry feedback, per kind */
function linesOfKind(a){
  var k=kindOf(a);
  if(k==="search")return (a.headlines||[]).concat(a.descriptions||[],[a.keywords||L("")]);
  if(k==="seo"&&isGbp(a))return (a.featured&&a.featured.assetId?[a.featured]:[]).concat([a.gbpText||L("")]);
  if(k==="seo")return (a.featured&&a.featured.assetId?[a.featured]:[]).concat([a.metaTitle||L(""),a.metaDesc||L("")],a.paras||[]);
  if(k==="social")return [a.caption||L(""),a.firstComment||L("")].concat(a.creatives||[]);
  if(k==="landing"||k==="webpage")return a.creatives||[];
  return null;
}

/* SEO body to paragraphs, keeping comments where the text is unchanged */
function rebuildParas(old,body){return rebuildParasArr(old,String(body||"").split(/\n\s*\n/).map(function(t){return t.trim();}).filter(Boolean));}
function rebuildParasArr(old,texts){
  var pool=(old||[]).slice(),used={};
  return texts.map(function(t,i){
    for(var j=0;j<pool.length;j++){if(!used[j]&&pool[j].text===t){used[j]=1;return pool[j];}}
    if(pool[i]&&!used[i]){used[i]=1;var keep=clone(pool[i]);keep.text=t;return keep;}
    return L(t);
  });
}
function paraHtml(t){
  if(/^\s*</.test(t))return '<div class="rich">'+cleanHtml(t)+'</div>';
  var m=/^(#{1,3})\s+(.*)$/.exec(t);
  if(m)return '<'+(m[1].length===1?"h2":"h3")+' class="dh">'+esc(m[2])+'</'+(m[1].length===1?"h2":"h3")+'>';
  if(/^[-*]\s/m.test(t)&&t.split("\n").every(function(x){return /^[-*]\s/.test(x.trim());}))return '<ul>'+t.split("\n").map(function(x){return '<li>'+esc(x.replace(/^\s*[-*]\s+/,""))+'</li>';}).join("")+'</ul>';
  return '<p>'+esc(t).replace(/\n/g,"<br>")+'</p>';
}
function wordCount(t){return (String(t||"").match(/\S+/g)||[]).length;}

/* ---------- previews for the new kinds ---------- */
function googlePreview(a,c){
  var hs=(a.headlines||[]).filter(hasText).map(function(l){return l.text;}),ds=(a.descriptions||[]).filter(hasText).map(function(l){return l.text;});
  var n=Math.max(1,hs.length),off=(S.gComb||0)%n;
  var pickH=[];for(var i=0;i<Math.min(3,hs.length);i++)pickH.push(hs[(off+i)%hs.length]);
  var pickD=[];for(var j=0;j<Math.min(2,ds.length);j++)pickD.push(ds[(off+j)%ds.length]);
  var dom=domainOf(a.url||c.website)||"yourwebsite.com.au";
  var path=[a.path1,a.path2].filter(Boolean).map(esc).join(" › ");
  var fav=c&&c.logoId?'<img src="'+esc(blob(c.logoId))+'" alt="">':esc(initials(c.name).slice(0,1));
  var out='<div class="gad"><div class="g-sp">Sponsored</div><div class="g-site"><span class="g-fav">'+fav+'</span><span><span class="g-nm">'+esc(c.name)+'</span><span class="g-url">'+esc(dom)+(path?' › '+path:'')+'</span></span></div><div class="g-h">'+(pickH.length?pickH.map(esc).join(' <span class="g-bar">|</span> '):'Headlines go here')+'</div><div class="g-d">'+(pickD.length?esc(pickD.join(" ")):'Descriptions go here')+'</div></div>';
  out+='<div class="row" style="width:380px;max-width:100%;justify-content:space-between"><span class="small muted">Google mixes the headlines and descriptions. This is one combination.</span>'+(hs.length>3||ds.length>2?'<button type="button" class="btn sm" data-act="gShuffle">Show another</button>':'')+'</div>';
  return out;
}
function fcHtml(a,name,ig){var t=a.firstComment&&a.firstComment.text;if(!t||!t.trim())return "";return '<div class="fc'+(ig?" ig":"")+'"><b>'+name+'</b> '+esc(platformCut(t,ig?125:160,2).text)+(t.length>(ig?125:160)?'<span class="moretxt">... more</span>':'')+'<div class="fc-l">First comment</div></div>';}
function socialPreview(a,c){
  var plats=(a.platforms||[]).filter(function(x){return SOCIAL_PLATFORMS.indexOf(x)>=0;});if(!plats.length)plats=["Facebook"];
  if(plats.indexOf(S.splat)<0)S.splat=plats[0];
  var p=S.splat,full=(a.caption&&a.caption.text)||"";
  var av=c&&c.logoId?'<img class="av" src="'+esc(blob(c.logoId))+'" alt="">':'<span class="av">'+esc(initials(c.name))+'</span>';
  var handle=esc(c.ig||c.name),files=(a.creatives||[]).filter(function(x){return x.assetId;});
  /* show each file at its own shape, within what Facebook and Instagram allow (1.91:1 wide to 4:5 tall) */
  var arOf=function(f){if(!f||!f.w||!f.h)return null;var r=f.w/f.h;return Math.max(0.8,Math.min(1.91,r));};
  var media=function(sq){if(!files.length)return '<div class="media" style="aspect-ratio:'+(sq?"1/1":"4/5")+'">No image or video yet</div>';
    var base=arOf(files[0])||(sq?1:0.8);
    var one=function(f,ar){var st='padding:0;aspect-ratio:'+ar+';object-fit:cover';return f.isVideo?'<video class="media" style="'+st+'" src="'+esc(blob(f.assetId))+'" muted autoplay loop playsinline></video>':'<img class="media" style="'+st+'" src="'+esc(blob(f.assetId))+'" alt="Post image">';};
    if(files.length===1)return one(files[0],base);
    return '<div class="car" style="padding:0 0 8px">'+files.map(function(f){return '<div class="card-c" style="flex-basis:300px;border:0;border-radius:0">'+one(f,base)+'</div>';}).join("")+'</div>';};
  var more=function(x,w){return esc(x.text)+(x.cut?'<span class="moretxt">... '+w+'</span>':"");};
  var when=a.postDate?postWhen(a):"Scheduled";
  var out='<label class="vpick plc" for="pv-splat"><span>Platform</span><select class="in" id="pv-splat" data-splatview="1">'+plats.map(function(x){return '<option'+(x===p?" selected":"")+'>'+x+'</option>';}).join("")+'</select></label>';
  if(p==="Instagram")out+='<div class="fb ig"><div class="hd">'+av+'<div><div class="nm">'+handle+'</div></div></div>'+media(false)+'<div class="bd" style="padding-top:10px"><b>'+handle+'</b> '+more(platformCut(full,125,2),"more")+'</div>'+fcHtml(a,handle,true)+'<div class="bd sp" style="padding-top:0">'+esc(when)+'</div></div>';
  else if(p==="Pinterest"){var pf=files[0];var pt=String(full).split("\n").filter(function(x){return x.trim();});out+='<div class="pin-card">'+(pf?(pf.isVideo?'<video src="'+esc(blob(pf.assetId))+'" muted autoplay loop playsinline></video>':'<img src="'+esc(blob(pf.assetId))+'" alt="Pin image">'):'<div class="media" style="aspect-ratio:2/3">No image yet</div>')+'<div class="pc-b"><b>'+esc(a.title||"")+'</b><p>'+esc(platformCut((pt.slice(0).join(" ")),100,2).text)+(full.length>100?"...":"")+'</p><div class="row" style="gap:8px">'+av.replace('class="av"','class="av" style="width:28px;height:28px"')+'<span class="small">'+esc(c.name)+'</span></div></div></div>';}
  else if(p==="TikTok"){var f0=files[0];out+='<div class="story reel">'+(f0?(f0.isVideo?'<video class="media" style="padding:0;object-fit:cover" src="'+esc(blob(f0.assetId))+'" muted autoplay loop playsinline></video>':'<img class="media" style="padding:0;object-fit:cover" src="'+esc(blob(f0.assetId))+'" alt="">'):'<div class="media">No 9:16 video yet</div>')+'<div class="rside" aria-hidden="true">'+ICON_HEART+ICON_CHAT+ICON_SEND+'</div><div class="rb"><b>@'+handle+'</b><div>'+more(platformCut(full.replace(/\n+/g," "),80,2),"more")+'</div></div></div>';}
  else out+='<div class="fb"><div class="hd">'+av+'<div><div class="nm">'+esc(c.name)+'</div><div class="sp">'+esc(when)+'</div></div></div><div class="bd">'+more(platformCut(full,p==="LinkedIn"?210:125,3),p==="LinkedIn"?"see more":"See more")+'</div>'+media(true)+fcHtml(a,esc(c.name),false)+'</div>';
  out+='<p class="small muted" style="width:380px;max-width:100%">'+(p==="Pinterest"?"Pins show the post name as the title and a short description.":"Caption is cut where "+esc(p)+" cuts it.")+' '+(p==="Pinterest"?"":" The full caption is on the right.")+'</p>';
  return out;
}
function designViewer(a,interactive){
  var files=a.creatives||[];if(!files.length)return '<div class="card empty">No designs uploaded yet.</div>';
  var i=Math.min(S.fileIdx||0,files.length-1),f=files[i];
  var tabs=files.length>1?'<div class="chips" role="group" aria-label="Designs">'+files.map(function(x,j){return '<button type="button" data-act="fileTab" data-i="'+j+'" aria-pressed="'+(j===i)+'">'+esc(x.label||("Design "+(j+1)))+((x.comments||[]).length?' · '+x.comments.length:'')+'</button>';}).join("")+'</div>':'';
  var isPdf=/pdf/i.test(f.type||"")||/\.pdf$/i.test(f.fileName||"");
  var body;
  if(!f.assetId)body='<div class="card empty">No file yet.</div>';
  else if(isPdf)body='<div class="card" style="align-items:flex-start"><b>'+esc(f.fileName)+'</b><span class="small muted">PDF designs open outside the portal. Upload PNG or JPG versions to comment on the design directly.</span><button type="button" class="btn" data-act="dlAsset" data-id="'+esc(f.assetId)+'" data-name="'+esc(f.fileName)+'">Download PDF</button></div>';
  else{
    var n=0;var pins=(f.comments||[]).map(function(cm,ci){if(cm.x==null)return "";n++;return '<button type="button" class="pin'+(cm.resolved?" done":"")+(cm.role==="team"?" team":"")+'" style="left:'+cm.x+'%;top:'+cm.y+'%" data-act="pinFocus" data-ci="'+ci+'" title="'+esc(cm.text)+'" aria-label="Comment '+n+'">'+n+'</button>';}).join("");
    var draft=S.pin&&S.pin.i===i?'<span class="pin new" style="left:'+S.pin.x+'%;top:'+S.pin.y+'%">+</span>':'';
    var mob=/mobile|phone/i.test(f.label||"")||(f.w&&f.w<=900);body='<div class="pin-outer"><div class="pin-wrap'+(interactive?" live":"")+(mob?" mob":"")+'" data-file="'+i+'"'+(f.w?' style="max-width:'+(mob?Math.min(f.w,414):f.w)+'px"':'')+'><img class="pin-img" src="'+esc(blob(f.assetId))+'" alt="'+esc(f.label||"Design")+'">'+pins+draft+'</div></div>';
  }
  var tip=interactive?'<p class="small muted">Click anywhere on the design to leave a comment on that spot.</p>':'';
  return tabs+(a.url?'<a class="btn sm" href="'+esc(/^https?:/.test(a.url)?a.url:"https://"+a.url)+'" target="_blank" rel="noopener" style="align-self:flex-start">Open live preview ↗</a>':'')+tip+body;
}

/* ---------- client screens for the new kinds ---------- */
function clientKindPage(){
  var c=S.clients[S.asClient],k=S.kind,kk=K(k);
  var fl=folderList(c,k).filter(function(f){return itemsIn(c.id,k,f.id).some(function(x){return seen(x);});});
  if(!S.folderId||!fl.some(function(f){return f.id===S.folderId;}))S.folderId=(fl.filter(function(f){return !f.archived;})[0]||fl[0]||{}).id||null;
  if(!S.folderId)return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / '+esc(kk.name)+'</span><h1>Nothing to review yet</h1><span class="muted">Gordon Digital will let you know when there\'s something here.</span></div></div></div>';
  var items=itemsIn(c.id,k,S.folderId).filter(function(x){return seen(x);});
  var nA=items.filter(isDone).length,nC=items.filter(function(x){return x.status==="changes";}).length,nW=items.filter(function(x){return x.status==="awaiting";}).length;
  var head='<div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / '+esc(kk.name)+'</span><h1>'+esc(folderName(c,k,S.folderId))+'</h1><span class="muted">'+items.length+' '+(items.length===1?kk.unit:kk.units)+' to review</span></div>'+(items.length?'<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="small"><b>'+nA+' approved</b> · '+nC+' being updated · '+nW+' waiting on you</span><div class="bar" style="width:280px;display:flex"><i style="width:'+(nA/items.length*100)+'%"></i><i style="width:'+(nC/items.length*100)+'%;background:#8eb5dc"></i></div></div>':'')+'</div>';
  var a=S.ads[S.adId];if(!a||a.clientId!==c.id||a.kind!==k||a.folderId!==S.folderId||!seen(a)){a=items[0];S.adId=a.id;S.fileIdx=0;S.pin=null;}
  if(k==="social")items.sort(function(x,y){return ((x.postDate||"9")+(x.postTime||"")).localeCompare((y.postDate||"9")+(y.postTime||""));});
  var list=items.map(function(x){return adCard(x,x.id===a.id);}).join("");
  var locked=isDone(a);
  if(k==="landing"||k==="webpage")return head+'<div class="work wide"><section class="col-list" aria-label="Pages">'+list+'</section><div class="wide-body"><section class="col-view" aria-label="Design">'+designViewer(a,!locked)+'</section><section class="col-side" aria-label="Review">'+kindPanelTop(a,locked)+pinPanel(a,locked)+'</section></div></div>';
  if(k==="seo")return head+'<div class="work cwork"><section class="col-list" aria-label="Content">'+list+'</section><div class="cw-main"><div class="wide-body"><section class="col-view" aria-label="Content">'+seoDoc(a,locked)+'</section><section class="col-side" aria-label="Review">'+kindPanelTop(a,locked)+'</section></div></div></div>';
  var prev=k==="search"?googlePreview(a,c):socialPreview(a,c);
  return head+'<div class="work"><section class="col-list" aria-label="Items">'+list+'</section><section class="col-prev" aria-label="Preview">'+prev+'</section><section class="col-main" aria-label="Review">'+kindPanelTop(a,locked)+kindLines(a,locked)+'</section></div>';
}
function kindPanelTop(a,locked){
  var h='<div class="card"><div class="lbl" style="align-items:flex-start"><h2>'+esc(a.title)+'</h2>'+statusPill(a.status,false)+'</div><span class="small muted">'+esc(kindOf(a)==="social"?itemSub(a)+(a.note?" · "+a.note:""):(a.note||itemSub(a)))+'</span>'+(a.brief?'<p class="small">'+esc(a.brief)+'</p>':'');
  if(locked)h+='<div class="lock"><span class="small">'+(a.approvedAt?"Approved "+esc(shortDate(a.approvedAt))+". ":"")+(a.status==="live"?esc(K(kindOf(a)).live)+".":"Gordon Digital has been notified.")+'</span></div>';
  else if(a.status==="awaiting")h+=decisionBtns(a);
  return h+'</div>'+commentsBox(a,locked);
}
function kindLines(a,locked){
  var k=kindOf(a),h="",sec=function(t,note,body){return body?'<div style="display:flex;flex-direction:column;gap:10px"><div style="padding:0 4px"><h3>'+t+'</h3>'+(note?'<span class="small muted">'+note+'</span>':'')+'</div>'+body+'</div>':"";};
  var lst=function(arr,code,word){var f=arr.filter(hasText),n=0;return arr.map(function(l,i){if(!hasText(l))return "";n++;return clientLine(a,code,i,l,word+(f.length>1?" "+n:""),null,locked,false,false);}).join("");};
  if(k==="search"){
    h+=sec("Headlines","Google shows up to 3 at a time and tests the mix.",lst(a.headlines||[],"h","Headline"));
    h+=sec("Descriptions","Google shows up to 2 at a time.",lst(a.descriptions||[],"d","Description"));
    if(hasText(a.keywords))h+=sec("Keywords","The searches this ad will show for.",clientLine(a,"kw",0,a.keywords,"Keywords",null,locked,false,false));
    if(a.url)h+='<div class="panel"><div class="lbl"><span>Landing page</span></div><div class="txt">'+esc(a.url)+'</div></div>';
  }else if(k==="social"){
    if(hasText(a.caption))h+=sec("Caption","",clientLine(a,"cap",0,a.caption,"Caption",null,locked,false,false));
    if(hasText(a.firstComment))h+=sec("First comment","Posted straight after the post goes live.",clientLine(a,"fc",0,a.firstComment,"First comment",null,locked,false,false));
    var fs=(a.creatives||[]).filter(hasCreative),cn=0;
    if(fs.length)h+=sec(fs.length>1?"Images and video":"Image or video","",(a.creatives||[]).map(function(l,i){if(!hasCreative(l))return "";cn++;return clientLine(a,"c",i,l,fs.length>1?"Slide "+cn:"Creative",null,locked,false,false);}).join(""));
  }
  return h;
}
function pinPanel(a,locked){
  var files=a.creatives||[],i=Math.min(S.fileIdx||0,Math.max(0,files.length-1)),f=files[i];
  var h='<div class="card"><span class="eyebrow">Comments on the design</span>';
  if(S.pin&&S.pin.i===i&&!locked)h+='<div class="c-in"><span class="pin sm">+</span><textarea class="in" id="pin-draft" rows="3" data-pdraft="1" placeholder="What would you like changed here?">'+esc(S.pdraft||"")+'</textarea></div><div class="c-bar"><button type="button" class="btn sm" data-act="cancelPin">Cancel</button><button type="button" class="btn sm dark" data-act="postPin">Post</button></div>';
  var n=0,list=f?(f.comments||[]).map(function(cm,ci){var num=cm.x!=null?++n:null;return '<div class="pinrow'+(S.pinFocus===ci?" on":"")+'" id="pc-'+ci+'">'+(num?'<span class="pin sm'+(cm.resolved?" done":"")+'">'+num+'</span>':'')+'<div style="flex:1;min-width:0">'+commentHtml(cm,"c",i,ci,S.mode==="team")+'</div></div>';}).join(""):"";
  h+=list||(S.pin?'':'<p class="small muted">'+(locked?"No comments.":"No comments yet. Click the design to add one.")+'</p>');
  return h+'</div>';
}

function featuredBox(a,editable,label,help){
  var fe=a.featured&&a.featured.assetId?a.featured:null;
  if(fe)return '<div class="panel'+(lineHasIssue(fe)?" warn":"")+'"><img class="feat" src="'+esc(blob(fe.assetId))+'" alt="'+esc(fe.alt||"")+'"><div class="row" style="justify-content:space-between;align-items:flex-end"><span class="tiny muted">'+esc(fe.fileName||"")+(fe.w?" · "+fe.w+" × "+fe.h:"")+'</span>'+(editable?'<span class="row" style="gap:6px">'+(assets?'<span class="btn sm filebtn">Replace<input type="file" accept="image/*" data-upload="feature" aria-label="Replace image"></span>':'')+'<button type="button" class="btn sm" data-act="removeFeatured">Remove</button></span>':'')+'</div>'+(fe.comments||[]).map(function(cm,ci){return commentHtml(cm,"fi",0,ci,true);}).join("")+'</div>';
  return editable?(assets?'<div class="drop"><div><h3>'+esc(label)+'</h3><p class="small muted">'+esc(help)+'</p></div><span class="btn accent filebtn">Choose image<input type="file" accept="image/*" data-upload="feature" aria-label="'+esc(label)+'"></span></div>':'<p class="notice">You need edit access to this page to upload files.</p>'):'<p class="small muted">No image.</p>';
}
function gbpEditor(a,c,editable,inp,ownerSel,sec,overall){
  var t=a.gbpType||"Update";
  var sel=function(key,label,opts,cur){return '<label class="f" for="ad-'+key+'">'+label+'<select class="in" id="ad-'+key+'" data-adf="'+key+'"'+(editable?"":" disabled")+'>'+opts.map(function(o){return '<option'+(cur===o?" selected":"")+'>'+o+'</option>';}).join("")+'</select></label>';};
  var h='<div class="card"><span class="eyebrow">Content setup</span><div class="grid2"><label class="f" for="ad-contentType">Type<select class="in" id="ad-contentType" data-adf="contentType"'+(editable?"":" disabled")+'>'+["Article","Page",GBP].map(function(o){return '<option'+(a.contentType===o?" selected":"")+'>'+o+'</option>';}).join("")+'</select></label>'+inp("title","Post name","Internal, e.g. Display home open day")+'</div><div class="grid2">'+sel("gbpType","Post type",GBP_TYPES,t)+ownerSel+'</div>';
  if(t!=="Update")h+='<div class="grid2">'+inp("gbpTitle",t==="Offer"?"Offer title":"Event title",null,null,58)+'<div class="grid2" style="gap:10px">'+inp("gbpStart","Start date",null,"date")+inp("gbpEnd","End date",null,"date")+'</div></div>';
  if(t==="Offer")h+='<div class="grid2">'+inp("gbpCode","Coupon code","Optional")+inp("gbpTerms","Terms and conditions","Optional")+'</div>';
  h+='<div class="grid2">'+sel("gbpCta","Button",GBP_CTAS,a.gbpCta||"Learn more")+((a.gbpCta||"Learn more")==="None"||(a.gbpCta==="Call now")?'':inp("url","Button link","Where the button goes"))+'</div></div>'+overall;
  h+=sec("Post text","Up to 1,500 characters. Google shows roughly the first 3 lines before More.",teamField(a,"gt",0,a.gbpText||L(""),"Post text",1500,editable,true));
  h+=sec("Post image","",featuredBox(a,editable,"Upload post image","JPG or PNG, at least 720 × 540. Square or 4:3 crops best on Google."));
  return h;
}
function gbpDoc(a,locked){
  var c=S.clients[a.clientId],t=a.gbpType||"Update",txt=(a.gbpText&&a.gbpText.text)||"",cut3=platformCut(txt,250,4);
  var av=c&&c.logoId?'<img src="'+esc(blob(c.logoId))+'" alt="">':esc(initials(c.name));
  var fe=a.featured&&a.featured.assetId?a.featured:null;
  var dates=(a.gbpStart||a.gbpEnd)?niceDate(a.gbpStart)+(a.gbpEnd?" to "+niceDate(a.gbpEnd):""):"";
  var cta=a.gbpCta||"Learn more";
  var h='<div class="gbp"><div class="gbp-hd"><span class="gbp-av">'+av+'</span><span><b>'+esc(c.name)+'</b><span class="gbp-sub">'+(t==="Update"?"Just now":esc(t))+'</span></span></div>'+(fe?'<img class="gbp-img" src="'+esc(blob(fe.assetId))+'" alt="'+esc(fe.alt||"Post image")+'">':'<div class="media" style="aspect-ratio:4/3">No image yet</div>')+'<div class="gbp-b">'+(t!=="Update"&&a.gbpTitle?'<b class="gbp-tt">'+esc(a.gbpTitle)+'</b>':'')+(dates?'<span class="gbp-dt">'+esc(dates)+'</span>':'')+'<p>'+esc(cut3.text)+(cut3.cut?'<span class="moretxt">... More</span>':'')+'</p>'+(t==="Offer"&&a.gbpCode?'<div class="gbp-code"><span class="tiny">Show this code at the store</span><b>'+esc(a.gbpCode)+'</b></div>':'')+(cta!=="None"?'<span class="gbp-btn">'+esc(cta)+'</span>':'')+'</div></div>';
  h+='<p class="small muted" style="max-width:420px">How it can look on Google Search and Maps. Text is cut where Google cuts it.</p>';
  if(hasText(a.gbpText))h+=clientLine(a,"gt",0,a.gbpText,"Post text",null,locked,false,false);
  if(t==="Offer"&&a.gbpTerms)h+='<div class="panel"><div class="lbl"><span>Terms and conditions</span></div><div class="txt">'+esc(a.gbpTerms)+'</div></div>';
  if(fe)h+='<div class="panel"><div class="lbl"><span>Post image</span></div><div class="row">'+(locked||S.composer==="fi0"?"":'<button type="button" class="btn sm" data-act="compose" data-v="fi0">Comment on image</button>')+'</div>'+(fe.comments||[]).map(function(cm,ci){return commentHtml(cm,"fi",0,ci,S.mode==="team");}).join("")+composer("fi0","fi",0,"Your comment on the image","Add comment")+'</div>';
  if(a.url&&cta!=="None"&&cta!=="Call now")h+='<div class="panel"><div class="lbl"><span>Button link</span></div><div class="txt">'+esc(a.url)+'</div></div>';
  return '<div class="gbp-wrap">'+h+'</div>';
}
function seoDoc(a,locked){
  if(isGbp(a))return gbpDoc(a,locked);
  var h='<article class="doc"><span class="eyebrow">'+esc(a.contentType||"Article")+(a.keyword?' · Target keyword: '+esc(a.keyword):'')+'</span><h1 class="dt">'+esc(a.title)+'</h1>';
  if(a.slug)h+='<span class="small muted">'+esc(a.slug)+'</span>';
  var fe=a.featured&&a.featured.assetId?a.featured:null;
  if(fe)h+='<figure class="featw"><img class="feat" src="'+esc(blob(fe.assetId))+'" alt="'+esc(fe.alt||"Featured image")+'"><figcaption class="row" style="justify-content:space-between"><span class="tiny muted">Featured image</span>'+(locked||S.composer==="fi0"?"":'<button type="button" class="btn sm" data-act="compose" data-v="fi0">Comment on image</button>')+'</figcaption>'+(fe.comments||[]).map(function(cm,ci){return commentHtml(cm,"fi",0,ci,S.mode==="team");}).join("")+composer("fi0","fi",0,"Your comment on the featured image","Add comment")+'</figure>';
  if(hasText(a.metaTitle)||hasText(a.metaDesc)){
    h+='<div class="serp"><span class="tiny muted">How it may look in Google</span><div class="g-h" style="font-size:18px">'+esc((a.metaTitle&&a.metaTitle.text)||a.title)+'</div><div class="g-d">'+esc((a.metaDesc&&a.metaDesc.text)||"")+'</div><div class="row" style="gap:6px">'+(locked||S.composer==="mt0"?"":'<button type="button" class="btn sm" data-act="compose" data-v="mt0">Comment on title</button>')+(locked||S.composer==="md0"?"":'<button type="button" class="btn sm" data-act="compose" data-v="md0">Comment on description</button>')+'</div>'+
      (a.metaTitle&&a.metaTitle.comments||[]).map(function(cm,ci){return commentHtml(cm,"mt",0,ci,S.mode==="team");}).join("")+(a.metaDesc&&a.metaDesc.comments||[]).map(function(cm,ci){return commentHtml(cm,"md",0,ci,S.mode==="team");}).join("")+composer("mt0","mt",0,"Your comment on the page title","Add comment")+composer("md0","md",0,"Your comment on the description","Add comment")+'</div>';
  }
  var paras=a.paras||[];
  h+='<div class="dbody">'+(paras.length?paras.map(function(p,i){var key="pa"+i,has=(p.comments||[]).length;
    return '<div class="para'+(has?" has":"")+'">'+paraHtml(p.text)+(locked||S.composer===key?'':'<button type="button" class="btn sm pc" data-act="compose" data-v="'+key+'">Comment</button>')+((p.comments||[]).length?'<div class="pcm">'+p.comments.map(function(cm,ci){return commentHtml(cm,"pa",i,ci,S.mode==="team");}).join("")+'</div>':'')+composer(key,"pa",i,"Your comment on this paragraph","Add comment")+'</div>';}).join(""):'<p class="muted">No content yet.</p>')+'</div>';
  h+='<span class="tiny muted">'+wordCount(a.body)+' words</span></article>';
  return h;
}


/* ---------- rich text for content ---------- */
var RTE_BLOCK={P:"p",DIV:"p",H1:"h2",H2:"h2",H3:"h3",H4:"h3",H5:"h3",H6:"h3",UL:"ul",OL:"ol",BLOCKQUOTE:"blockquote",LI:"li"};
function cleanHtml(html){
  var tpl=document.createElement("template");tpl.innerHTML=String(html||"");
  var out=document.createElement("div");
  var walk=function(node,parent){
    Array.prototype.forEach.call(node.childNodes,function(n){
      if(n.nodeType===3){parent.appendChild(document.createTextNode(n.nodeValue));return;}
      if(n.nodeType!==1)return;
      var t=n.tagName,st=(n.getAttribute("style")||"").toLowerCase(),el=null;
      if(t==="SCRIPT"||t==="STYLE"||t==="META"||t==="TITLE")return;
      if(RTE_BLOCK[t])el=document.createElement(RTE_BLOCK[t]);
      else if(t==="STRONG"||(t==="B"&&!/font-weight:\s*(normal|400)/.test(st))||/font-weight:\s*(bold|[6-9]00)/.test(st))el=document.createElement("strong");
      else if(t==="EM"||t==="I"||/font-style:\s*italic/.test(st))el=document.createElement("em");
      else if(t==="A"){var h=n.getAttribute("href")||"";if(/^(https?:|mailto:|tel:|\/)/i.test(h)){el=document.createElement("a");el.setAttribute("href",h);el.setAttribute("target","_blank");el.setAttribute("rel","noopener");}}
      else if(t==="BR"){parent.appendChild(document.createElement("br"));return;}
      if(el){walk(n,el);parent.appendChild(el);}else walk(n,parent);
    });
  };
  walk(tpl.content,out);
  /* wrap loose inline content at the top level in paragraphs, drop empty blocks */
  var fin=document.createElement("div"),buf=null;
  Array.prototype.slice.call(out.childNodes).forEach(function(n){
    var isBlock=n.nodeType===1&&/^(P|H2|H3|UL|OL|BLOCKQUOTE)$/.test(n.tagName);
    if(isBlock){buf=null;if(n.textContent.trim())fin.appendChild(n);return;}
    if(n.nodeType===1&&n.tagName==="LI"){var ul=document.createElement("ul");ul.appendChild(n);fin.appendChild(ul);buf=null;return;}
    if(n.nodeType===1&&n.tagName==="BR"){buf=null;return;}
    if(!buf){buf=document.createElement("p");fin.appendChild(buf);}buf.appendChild(n);
  });
  Array.prototype.slice.call(fin.childNodes).forEach(function(n){if(!n.textContent.trim())fin.removeChild(n);});
  return fin.innerHTML;
}
function htmlBlocks(html){var d=document.createElement("div");d.innerHTML=cleanHtml(html);return Array.prototype.map.call(d.children,function(n){return n.outerHTML;});}
function htmlText(html){var d=document.createElement("div");d.innerHTML=String(html||"").replace(/<\/(li|p|h2|h3|blockquote)>|<br\s*\/?>/gi,"$& ");return (d.textContent||"").replace(/\s+/g," ").trim();}
function inlineMd(s){return esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|\W)_(.+?)_(?=\W|$)/g,"$1<em>$2</em>");}
function mdToHtml(md){return String(md||"").split(/\n\s*\n/).map(function(t){t=t.trim();if(!t)return "";
  var m=/^(#{1,3})\s+(.*)$/.exec(t);if(m)return (m[1].length===1?"<h2>":"<h3>")+inlineMd(m[2])+(m[1].length===1?"</h2>":"</h3>");
  var ls=t.split("\n");if(ls.every(function(x){return /^\s*[-*]\s/.test(x);}))return "<ul>"+ls.map(function(x){return "<li>"+inlineMd(x.replace(/^\s*[-*]\s+/,""))+"</li>";}).join("")+"</ul>";
  if(ls.every(function(x){return /^\s*\d+[.)]\s/.test(x);}))return "<ol>"+ls.map(function(x){return "<li>"+inlineMd(x.replace(/^\s*\d+[.)]\s+/,""))+"</li>";}).join("")+"</ol>";
  return "<p>"+ls.map(inlineMd).join("<br>")+"</p>";}).join("");}
function bodyHtmlOf(a){return a.bodyHtml!=null?a.bodyHtml:mdToHtml(a.body);}
var RTE_TOOLS=[["p","Text","Normal text"],["h2","H2","Heading"],["h3","H3","Subheading"],["|"],["bold","<b>B</b>","Bold"],["italic","<i>I</i>","Italic"],["|"],["ul","• List","Bullet list"],["ol","1. List","Numbered list"],["quote","“ ”","Quote"],["|"],["link","Link","Add a link"],["unlink","Unlink","Remove link"],["clear","Clear","Clear formatting"]];
function rteHtml(a,editable){
  var bar=editable?'<div class="rte-bar" role="toolbar" aria-label="Formatting">'+RTE_TOOLS.map(function(t){return t[0]==="|"?'<span class="rte-sep"></span>':'<button type="button" class="rte-b" data-rte="'+t[0]+'" title="'+t[2]+'" aria-label="'+t[2]+'">'+t[1]+'</button>';}).join("")+'<span class="rte-link" hidden><input class="in" id="rte-url" placeholder="https://" aria-label="Link address"><button type="button" class="btn sm dark" data-rte="applyLink">Add</button><button type="button" class="btn sm" data-rte="cancelLink">Cancel</button></span></div>':'';
  return '<div class="rte">'+bar+'<div class="rte-ed'+(editable?"":" ro")+'" id="ad-rte"'+(editable?' contenteditable="true" role="textbox" aria-multiline="true" aria-label="Content" data-rtebody="1"':'')+'>'+cleanHtml(bodyHtmlOf(a))+'</div></div>';
}
var rteRange=null;
function rteSave(el){var html=cleanHtml(el.innerHTML),blocks=htmlBlocks(html);
  var a=curAd();if(!a||(a.bodyHtml||"")===html)return;
  editAd(function(x){x.bodyHtml=html;x.body=blocks.map(htmlText).join("\n\n");x.paras=rebuildParasArr(x.paras,blocks);});}
document.addEventListener("mousedown",function(e){var b=e.target.closest("[data-rte]");if(!b||b.tagName==="INPUT")return;var cmd=b.dataset.rte;
  if(cmd==="applyLink"||cmd==="cancelLink")return;
  e.preventDefault();var ed=document.getElementById("ad-rte");if(!ed)return;if(document.activeElement!==ed&&!ed.contains(document.activeElement))ed.focus();
  var ex=function(c,v){try{document.execCommand(c,false,v);}catch(er){}};
  if(cmd==="p")ex("formatBlock","<p>");else if(cmd==="h2")ex("formatBlock","<h2>");else if(cmd==="h3")ex("formatBlock","<h3>");
  else if(cmd==="bold")ex("bold");else if(cmd==="italic")ex("italic");
  else if(cmd==="ul")ex("insertUnorderedList");else if(cmd==="ol")ex("insertOrderedList");
  else if(cmd==="quote")ex("formatBlock","<blockquote>");
  else if(cmd==="unlink")ex("unlink");
  else if(cmd==="clear"){ex("removeFormat");ex("formatBlock","<p>");}
  else if(cmd==="link"){var sel=window.getSelection();if(!sel.rangeCount||sel.isCollapsed){toast("Select the words to link first.");return;}rteRange=sel.getRangeAt(0).cloneRange();var box=b.parentNode.querySelector(".rte-link");box.hidden=false;var inp=box.querySelector("input");inp.value="";setTimeout(function(){inp.focus();},0);}
});
document.addEventListener("click",function(e){var b=e.target.closest("[data-rte=applyLink],[data-rte=cancelLink]");if(!b)return;e.preventDefault();e.stopPropagation();
  var box=b.closest(".rte-link"),ed=document.getElementById("ad-rte");
  if(b.dataset.rte==="applyLink"){var u=box.querySelector("input").value.trim();if(u&&!/^(https?:|mailto:|tel:|\/)/i.test(u))u="https://"+u;
    if(u&&rteRange&&ed){ed.focus();var s=window.getSelection();s.removeAllRanges();s.addRange(rteRange);try{document.execCommand("createLink",false,u);}catch(er){}}}
  box.hidden=true;rteRange=null;},true);
document.addEventListener("keydown",function(e){if(e.target.id==="rte-url"&&e.key==="Enter"){e.preventDefault();var ap=e.target.parentNode.querySelector("[data-rte=applyLink]");if(ap)ap.click();}});
document.addEventListener("paste",function(e){var ed=e.target.closest&&e.target.closest("[data-rtebody]");if(!ed)return;var cd=e.clipboardData;if(!cd)return;var h=cd.getData("text/html"),t=cd.getData("text/plain");e.preventDefault();
  var html=h?cleanHtml(h):mdToHtml(t);try{document.execCommand("insertHTML",false,html);}catch(er){}});
document.addEventListener("focusout",function(e){var ed=e.target.closest&&e.target.closest("[data-rtebody]");if(!ed)return;var to=e.relatedTarget;if(to&&to.closest&&to.closest(".rte"))return;rteSave(ed);},true);

/* ---------- client overview ---------- */
function overviewPage(){
  var c=S.clients[S.asClient];if(!c)return "";
  var items=allItems(c.id).filter(function(x){return seen(x);});
  var waiting=items.filter(function(x){return x.status==="awaiting";}).sort(function(a,b){return (a.sentAt||"").localeCompare(b.sentAt||"");});
  var first=String(c.approverName||"").split(" ")[0];
  var h='<div class="page"><div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / Overview</span><h1>'+(first?"Hi "+esc(first):"Welcome")+'</h1><span class="muted">Everything Gordon Digital has sent you to review, in one place.</span></div></div>';
  var nx=waiting[0];
  h+='<div class="card ov-next">'+(waiting.length?'<div class="row" style="justify-content:space-between;gap:16px"><div><h2>'+waiting.length+' '+(waiting.length===1?"item needs":"items need")+' your approval</h2><span class="small muted">Oldest first: '+esc(nx.title)+' · '+esc(K(kindOf(nx)).name)+' · sent '+esc(shortDate(nx.sentAt))+'</span></div><button type="button" class="btn dark" data-act="goItem" data-v="'+nx.id+'">Start reviewing</button></div>':'<h2>You\'re all caught up</h2><span class="small muted">Nothing is waiting on you right now.</span>')+'</div>';
  h+=progressBoard(c,items);
  var ev=[];items.forEach(function(x){
    if(x.sentAt)ev.push({at:x.sentAt,t:"Gordon Digital sent "+x.title+" for review",x:x});
    if(x.approvedAt)ev.push({at:x.approvedAt,t:"Approved: "+x.title,x:x});
    var push=function(cm){if(cm&&cm.at)ev.push({at:cm.at,t:personName(cm)+(cm.role==="team"?" (Gordon Digital)":"")+" commented on "+x.title,x:x});};
    (x.overall||[]).forEach(push);(linesOfKind(x)||allLines(x)).forEach(function(l){(l&&l.comments||[]).forEach(push);});});
  ev.sort(function(a,b){return b.at.localeCompare(a.at);});
  var sn=c.strategist,pr=person(sn),em=pr.email||c.gdEmail,ph=pr.phone||c.gdPhone;
  var team='<div class="card"><h2>Your team</h2><div class="ov-team">'+personAv(sn||"GD","lg2")+'<div><b>'+esc(sn||"Gordon Digital")+'</b><div class="small muted">'+esc(pr.title||"Your strategist")+' at Gordon Digital</div>'+(em||ph?'<div class="small" style="display:flex;flex-direction:column;gap:2px;margin-top:6px">'+(em?'<a href="mailto:'+esc(em)+'" style="color:inherit">'+esc(em)+'</a>':'')+(ph?'<a href="tel:'+esc(String(ph).replace(/\s+/g,""))+'" style="color:inherit">'+esc(ph)+'</a>':'')+'</div>':'')+'</div></div>'+(c.approverName?'<div class="ov-team" style="border-top:1px solid var(--line);padding-top:12px"><span class="logo" style="border-radius:999px">'+esc(initials(c.approverName))+'</span><div><b class="small">'+esc(c.approverName)+'</b><div class="tiny muted">Approver at '+esc(c.name)+'</div></div></div>':'')+'</div>';
  h+='<div class="grid2"><div class="card"><h2>Recent activity</h2>'+(ev.length?'<div class="ov-list">'+ev.slice(0,10).map(function(e){return '<div class="ov-ev"><span class="tiny muted num" style="width:58px;flex-shrink:0">'+esc(shortDate(e.at))+'</span><span class="small">'+esc(e.t)+'</span></div>';}).join("")+'</div>':'<p class="small muted">Nothing yet.</p>')+'</div>'+team+'</div>';
  return h+'</div>';
}
var KTAG={meta:["Meta","#e8edff","#2b3f8c"],search:["Google Search","#fff1d6","#7a4b00"],landing:["Landing page","#e5f4ea","#1a6b3c"],webpage:["Website","#eceff2","#33424d"],seo:["Content","#f2e9fb","#5b2a86"],social:["Social","#ffe8ef","#8a1f45"]};
function kindTag(x){var k=kindOf(x),t=KTAG[k]||KTAG.meta,label=t[0];if(k==="seo")label=x.contentType===GBP?"Google Business":(x.contentType||"Content");return '<span class="ktag" style="background:'+t[1]+';color:'+t[2]+'">'+esc(label)+'</span>';}
var BOARD_COLS=[["awaiting","Waiting on you","Needs your approval"],["changes","Being updated","Gordon Digital is making your changes"],["approved","Approved","Signed off, getting ready"],["live","Live","Running or published"]];
function progressBoard(c,items){
  var live=items.filter(function(x){var fid=kindOf(x)==="meta"?x.monthKey:x.folderId;return !folderArchived(c,kindOf(x),fid);});
  var kinds=KINDS.filter(function(kk){return live.some(function(x){return kindOf(x)===kk.k;});});
  if(!live.length)return "";
  var f=S.ovFilter&&kinds.some(function(kk){return kk.k===S.ovFilter;})?S.ovFilter:"all";
  var shown=f==="all"?live:live.filter(function(x){return kindOf(x)===f;});
  var h='<div class="lbl" style="align-items:flex-end"><h2>Progress</h2>'+(kinds.length>1?'<div class="chips" role="group" aria-label="Filter by type"><button type="button" data-act="ovFilter" data-v="all" aria-pressed="'+(f==="all")+'">All</button>'+kinds.map(function(kk){return '<button type="button" data-act="ovFilter" data-v="'+kk.k+'" aria-pressed="'+(f===kk.k)+'">'+esc(KTAG[kk.k][0])+'</button>';}).join("")+'</div>':'')+'</div>';
  h+='<div class="board">'+BOARD_COLS.map(function(col){
    var its=shown.filter(function(x){return x.status===col[0];}).sort(function(a,b){var ka=col[0]==="awaiting"?(a.sentAt||""):(b.approvedAt||b.updatedAt||""),kb=col[0]==="awaiting"?(b.sentAt||""):(a.approvedAt||a.updatedAt||"");return ka.localeCompare(kb);});
    var cap=12,more=its.length-cap;
    return '<section class="bcol bc-'+col[0]+'" aria-label="'+col[1]+'"><div class="bhead"><span class="bdot"></span><b>'+col[1]+'</b><span class="bcount">'+its.length+'</span></div><span class="tiny muted">'+col[2]+'</span><div class="bcards">'+(its.length?its.slice(0,cap).map(function(x){var fid=kindOf(x)==="meta"?x.monthKey:x.folderId;
      return '<button type="button" class="bcard" data-act="goItem" data-v="'+x.id+'">'+kindTag(x)+'<b class="small">'+esc(x.title)+'</b><span class="tiny muted">'+esc(folderName(c,kindOf(x),fid))+(col[0]==="awaiting"&&x.sentAt?' · sent '+esc(shortDate(x.sentAt)):(x.approvedAt?' · approved '+esc(shortDate(x.approvedAt)):''))+'</span></button>';}).join("")+(more>0?'<span class="tiny muted" style="padding:4px 2px">And '+more+' more</span>':''):'<span class="bempty">Nothing here</span>')+'</div></section>';}).join("")+'</div>';
  return h;
}
function folderArchived(c,k,fid){if(k==="meta")return (c.archivedMonths||[]).indexOf(fid)>=0;var f=rawFolders(c,k).filter(function(x){return x.id===fid;})[0];return !!(f&&f.archived);}

/* ---------- nav sections ---------- */
function navFolders(c,team){
  var h="";
  enabledKinds(c).forEach(function(kk){
    var fl=folderList(c,kk.k);
    if(!team)fl=fl.filter(function(f){return kk.k==="meta"||itemsIn(c.id,kk.k,f.id).some(function(x){return seen(x);});});
    if(!team&&!fl.length)return;
    var live=fl.filter(function(f){return !f.archived;}),arch=fl.filter(function(f){return f.archived;});
    h+='<div class="nav-label">'+esc(kk.name)+'</div>';
    var row=function(f){var its=itemsIn(c.id,kk.k,f.id),cur=(team?S.page==="work":S.cpage==="ads")&&S.kind===kk.k&&curFolder()===f.id;
      var badge;
      if(team){var ch=its.filter(function(x){return x.status==="changes";}).length;badge=ch?'<span class="pill st-changes">'+ch+'</span>':'';}
      else{var sent=its.filter(function(x){return seen(x);}),w=sent.filter(function(x){return x.status==="awaiting";}).length;badge=w?'<span class="pill st-awaiting" title="'+w+' to review">'+w+'</span>':(sent.length&&sent.every(isDone)?'<span class="pill">Done</span>':(!sent.length?'<span class="pill">Nothing yet</span>':''));}
      var nm=kk.k==="meta"?(team?monthLabel(f.id):monthLabel(f.id).replace(/^(\w{3})\w*/,"$1")):f.name;
      return '<button type="button" class="nav-btn nav-sub'+(f.archived?" arch":"")+'" data-act="'+(team?"tfolder":"cfolder")+'" data-k="'+kk.k+'" data-v="'+esc(f.id)+'" aria-current="'+cur+'"><span class="ic">'+navIc("month")+'<span>'+esc(nm)+'</span></span>'+badge+'</button>';};
    h+=live.map(row).join("");
    if(team&&S.newFolder&&S.newFolder.k===kk.k)h+='<div class="nf"><input class="in" id="nf-name" data-nf="1" value="'+esc(S.newFolder.name)+'" placeholder="'+esc(kk.ph||"Name")+'" aria-label="'+esc(kk.folder)+' name">'+((kk.k==="social"||kk.k==="seo")?'<div class="row" style="gap:4px"><button type="button" class="btn sm" data-act="nfSuggest" data-v="month">Next month</button><button type="button" class="btn sm" data-act="nfSuggest" data-v="quarter">Next quarter</button></div>':'')+'<div class="row" style="gap:4px"><button type="button" class="btn sm" data-act="nfCancel">Cancel</button><button type="button" class="btn sm dark" data-act="nfSave">Add</button></div></div>';
    else if(team)h+='<button type="button" class="nav-btn nav-sub" data-act="addFolder" data-k="'+kk.k+'"><span class="ic">'+navIc("addClient")+'<span class="muted">'+esc(kk.add)+'</span></span></button>';
    if(arch.length){var open=S.showArch[kk.k];h+='<button type="button" class="nav-btn nav-sub" data-act="toggleArch" data-k="'+kk.k+'"><span class="ic">'+navIc("archive")+'<span class="muted">'+(team?"Archived":"Past")+' ('+arch.length+')</span></span><span class="tiny muted">'+(open?"Hide":"Show")+'</span></button>';if(open)h+=arch.map(row).join("");}
  });
  return h;
}

/* ---------- team screens for the new kinds ---------- */
function kindWorkPage(){
  var c=S.clients[S.clientId],k=S.kind,kk=K(k);
  var fl=folderList(c,k);
  if(!S.folderId||!fl.some(function(f){return f.id===S.folderId;}))S.folderId=(fl.filter(function(f){return !f.archived;})[0]||{}).id||null;
  if(!S.folderId)return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / '+esc(kk.name)+'</span><h1>No '+esc(kk.folder.toLowerCase())+' folders yet</h1><span class="muted">Use '+esc(kk.add)+' in the sidebar to create the first one.</span></div><button type="button" class="btn go" data-act="addFolder" data-k="'+k+'">'+esc(kk.add)+'</button></div></div>';
  var items=itemsIn(c.id,k,S.folderId),arch=folderArchived(c,k,S.folderId);
  var a=S.ads[S.adId];if(!a||a.clientId!==c.id||a.kind!==k||a.folderId!==S.folderId){a=items[0]||null;S.adId=a?a.id:null;S.fileIdx=0;}
  var h='<div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / '+esc(kk.name)+(arch?' · Archived':'')+'</span><h1>'+esc(folderName(c,k,S.folderId))+'</h1></div><div class="row">'+archBtn(c,k,S.folderId,items)+(items.length?'':'<button type="button" class="btn" data-act="removeFolder">Remove</button>')+'<button type="button" class="btn" data-act="addItem">'+esc(kk.addItem||("Add "+kk.unit))+'</button><button type="button" class="btn dark" data-act="asClient" data-v="'+c.id+'">Preview as client</button></div></div>';
  h+=folderArchNotice(c,k,S.folderId,items);
  Object.keys(S.batch).forEach(function(id){var x=S.ads[id];if(!x||!canSend(x)||x.clientId!==c.id||x.kind!==k||x.folderId!==S.folderId)delete S.batch[id];});
  var ready=items.filter(canSend),nb=Object.keys(S.batch).length;
  var bar=ready.length?'<div class="bbar"><div class="lbl"><span class="eyebrow">Send to client</span><button type="button" class="btn sm" data-act="batchAll">'+(nb===ready.length?"Clear":"Select all "+ready.length)+'</button></div><span class="small muted">'+(nb?nb+" of "+ready.length+" ready selected.":"Tick what to send together. The client gets one notification per batch.")+'</span><button type="button" class="btn go" data-act="sendBatch"'+(nb?"":" disabled")+'>'+(nb?"Send "+nb+" "+(nb>1?kk.units:kk.unit)+" to client":"Select "+kk.units+" to send")+'</button></div>':"";
  var list=bar+(items.map(function(x){var oc=openComments(x),cs=canSend(x);return '<div class="item tm'+(a&&x.id===a.id?" cur":"")+(x.status==="archived"?" arch-i":"")+'" data-act="pickAd" data-v="'+x.id+'" aria-current="'+(a&&x.id===a.id)+'">'+(cs?'<label class="bsel" title="Include in batch"><input type="checkbox" data-batch="'+x.id+'"'+(S.batch[x.id]?" checked":"")+' aria-label="Include '+esc(x.title)+' in batch"></label>':'')+'<div class="tm-b"><div class="lbl"><span class="t">'+esc(x.title||"Untitled")+'</span><span class="tiny muted" style="font-weight:400">v'+x.version+' · '+esc(x.owner||"Unassigned")+'</span></div><span class="tiny muted">'+esc(itemSub(x))+'</span><div class="row">'+statusPill(x.status,true)+(oc?'<span class="tiny"><b>'+oc+' open comment'+(oc>1?"s":"")+'</b></span>':"")+'</div></div></div>';}).join("")||'<p class="small muted">Nothing here yet. Use '+esc(kk.addItem||("Add "+kk.unit))+' to create the first one.</p>');
  return h+'<div class="work"><section class="col-list" aria-label="Items">'+list+'</section><section class="col-main" aria-label="Editor">'+(a?kindEditor(a,c):'<div class="card empty">Use '+esc(kk.addItem||("Add "+kk.unit))+' to get started.</div>')+'</section></div>';
}
function folderArchNotice(c,k,fid,items){if(S.confirmFolderArch!==fid)return "";var open=items.filter(function(x){return !isDone(x)&&x.status!=="archived";}).length;return '<div class="notice row" style="justify-content:space-between" role="alert"><span>'+open+' '+(open>1?K(k).units+" aren't":K(k).unit+" isn't")+' approved. Archive '+esc(folderName(c,k,fid))+' anyway? Nothing is deleted and you can unarchive it.</span><span class="row"><button type="button" class="btn sm" data-act="cancelFolderArch">Keep it</button><button type="button" class="btn sm dark" data-act="archiveFolder" data-force="1">Archive anyway</button></span></div>';}
function archBtn(c,k,fid,items){
  if(folderArchived(c,k,fid))return '<button type="button" class="btn" data-act="unarchiveFolder">Unarchive</button>';
  return items.length?'<button type="button" class="btn" data-act="archiveFolder">Archive</button>':'';
}
function kindEditor(a,c){
  var k=kindOf(a),kk=K(k),editable=canSend(a),oc=openComments(a),inB=!!S.batch[a.id],next=a.status==="draft"?a.version:a.version+1;
  var notes={draft:"Not visible to the client yet.",awaiting:"With the client since "+shortDate(a.sentAt)+". Editing is locked until you pull it back.",changes:"The client asked for changes. Edit, resolve each comment, then send the new version.",approved:"Approved by the client.",live:kk.live+". This version is locked for the record."};
  var acts=editable?'<button type="button" class="btn'+(inB?" go":"")+'" data-act="toggleBatch" data-v="'+a.id+'" aria-pressed="'+inB+'">'+(inB?"✓ In this batch":"Add v"+next+" to batch")+'</button>'+(a.status==="draft"?'<button type="button" class="btn" data-act="deleteDraft">Delete draft</button>':''):
    (a.status==="awaiting"?'<button type="button" class="btn" data-act="pullBack">Pull back to edit</button><button type="button" class="btn dark" data-act="remind">'+(a.reminded?"Reminder sent":"Send reminder")+'</button>':(a.status==="approved"?'<button type="button" class="btn dark" data-act="markLive">Mark as '+esc(kk.live.toLowerCase())+'</button>':""));
  acts+=itemArchBtn(a);
  var h='<div class="card"><div class="lbl" style="align-items:flex-start"><h2>'+esc(a.title||"Untitled")+'</h2>'+statusPill(a.status,true)+'</div><div class="row" style="justify-content:space-between;align-items:center"><p class="small" style="flex:1;min-width:220px">'+esc(notes[a.status]||"Archived. Hidden from the client and kept for the record.")+'</p><div class="row">'+acts+'</div></div>'+itemArchNotice(a)+(S.confirmDelete===a.id?'<div class="notice row" style="justify-content:space-between">Delete this draft for good?<span class="row"><button type="button" class="btn sm" data-act="cancelDelete">Keep it</button><button type="button" class="btn sm dark" data-act="confirmDelete">Delete</button></span></div>':"")+(editable&&oc?'<p class="notice">'+oc+' client comment'+(oc>1?"s are":" is")+' still open. Resolve them before you send the new version.</p>':"")+'</div>';
  var inp=function(key,label,help,type,limit){var v=a[key]||"";return '<label class="f" for="ad-'+key+'">'+label+'<input class="in" '+(type?'type="'+type+'" ':'')+'id="ad-'+key+'" data-adf="'+key+'" value="'+esc(v)+'"'+(limit?' maxlength="'+limit+'"':'')+(editable?"":" disabled")+'>'+(help?'<span class="h">'+help+'</span>':'')+'</label>';};
  var ownerSel='<label class="f" for="ad-owner">Owner<select class="in" id="ad-owner" data-adf="owner">'+stratOpts(a.owner)+'</select></label>';
  var sec=function(t,note,body){return '<div style="display:flex;flex-direction:column;gap:10px"><div style="padding:0 4px"><h3>'+t+'</h3>'+(note?'<span class="small muted">'+note+'</span>':'')+'</div>'+body+'</div>';};
  var overall=a.status!=="draft"?'<div class="card"><span class="eyebrow">Overall client feedback</span>'+((a.overall||[]).length?a.overall.map(function(cm,ci){return commentHtml(cm,"o",0,ci,true);}).join(""):'<p class="small muted">No overall comments.</p>')+(S.composer==="o0"?composer("o0","o",0,"Reply to the client","Send reply"):'<button type="button" class="btn sm" style="align-self:flex-start" data-act="compose" data-v="o0">Reply to the client</button>')+'</div>':'';
  var uploader=function(label,help,accept){return editable?(assets?'<div class="drop"><div><h3>'+label+'</h3><p class="small muted">'+help+'</p></div><span class="btn accent filebtn">Choose files<input type="file" accept="'+accept+'" multiple data-upload="kfile" aria-label="'+esc(label)+'"></span></div>':'<p class="notice">You need edit access to this page to upload files.</p>'):'';};
  var fileRows=function(word,withLabel){return (a.creatives||[]).map(function(f,i){
      var thumb=f.assetId?(f.isVideo?'<video class="thumb" src="'+esc(blob(f.assetId))+'" muted controls></video>':(/pdf/i.test(f.type||f.fileName||"")?'<div class="thumb">PDF</div>':'<img class="thumb" style="object-fit:cover" src="'+esc(blob(f.assetId))+'" alt="">')):'<div class="thumb">No file</div>';
      return '<div class="panel'+(lineHasIssue(f)?" warn":"")+'"><div class="row" style="align-items:flex-start;gap:14px">'+thumb+'<div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px"><b class="small" style="word-break:break-all">'+esc(f.fileName||"")+'</b>'+(withLabel?'<label class="f" for="fl-'+i+'">'+word+' label<input class="in" id="fl-'+i+'" data-clabel="'+i+'" value="'+esc(f.label||"")+'" placeholder="e.g. Desktop, Mobile, Hero section"'+(editable?"":" disabled")+'></label>':'')+(editable?'<button type="button" class="btn sm" style="align-self:flex-start" data-act="removeCreative" data-i="'+i+'">Remove</button>':'')+'</div></div>'+(f.comments||[]).map(function(cm,ci){return commentHtml(cm,"c",i,ci,true);}).join("")+'</div>';}).join("");};
  if(k==="search"){
    h+='<div class="card"><span class="eyebrow">Ad setup</span><div class="grid2">'+inp("title","Ad name","Internal name for this ad.")+ownerSel+'</div>'+inp("url","Final URL","Where the ad sends people.")+'<div class="grid2">'+inp("path1","Display path 1","Up to 15 characters.",null,15)+inp("path2","Display path 2","Up to 15 characters.",null,15)+'</div></div>'+overall;
    h+=sec("Headlines","Up to 15, 30 characters each. Google shows up to 3 at a time.",(a.headlines||[]).map(function(l,i){return teamField(a,"h",i,l,"Headline "+(i+1),30,editable,false);}).join(""));
    h+=sec("Descriptions","Up to 4, 90 characters each.",(a.descriptions||[]).map(function(l,i){return teamField(a,"d",i,l,"Description "+(i+1),90,editable,true);}).join(""));
    h+=sec("Keywords","One per line. Shown to the client so they know what the ad targets.",teamField(a,"kw",0,a.keywords||L(""),"Keywords",null,editable,true));
  }else if(k==="landing"||k==="webpage"){
    h+='<div class="card"><span class="eyebrow">Page setup</span><div class="grid2">'+inp("title","Page name","e.g. House and Land Packages, desktop")+ownerSel+'</div>'+inp("url","Live or staging link","Optional. The client can open it from the review screen.")+'<label class="f" for="ad-brief">Note for the client<textarea class="in" rows="2" id="ad-brief" data-adf="brief"'+(editable?"":" disabled")+'>'+esc(a.brief||"")+'</textarea><span class="h">What this page is for and what to look at.</span></label></div>'+overall;
    h+=uploader("Upload designs","PNG or JPG full page designs work best. The client clicks on the design to leave comments. PDFs can be downloaded but not commented on.","image/*,application/pdf");
    if((a.creatives||[]).length){h+='<div class="card"><span class="eyebrow">Design'+(a.status!=="draft"?" and client comments":"")+'</span>'+designViewer(a,false)+'</div>';h+=sec("Design files","",fileRows("Design",true));}
  }else if(k==="seo"&&isGbp(a)){
    h+=gbpEditor(a,c,editable,inp,ownerSel,sec,overall);
  }else if(k==="seo"){
    h+='<div class="card"><span class="eyebrow">Content setup</span><div class="grid2"><label class="f" for="ad-contentType">Type<select class="in" id="ad-contentType" data-adf="contentType"'+(editable?"":" disabled")+'>'+["Article","Page",GBP].map(function(o){return '<option'+((a.contentType||"Article")===o?" selected":"")+'>'+o+'</option>';}).join("")+'</select></label>'+inp("title","Title")+'</div><div class="grid2">'+inp("keyword","Target keyword")+inp("slug","URL","e.g. /blog/knockdown-rebuild-costs")+'</div>'+ownerSel+'</div>'+overall;
    var fe=a.featured&&a.featured.assetId?a.featured:null;
    h+=sec("Featured image",fe?"":"Optional. The main image shown at the top of the "+(a.contentType==="Page"?"page":"article")+" and when it's shared.",fe?'<div class="panel'+(lineHasIssue(fe)?" warn":"")+'"><img class="feat" src="'+esc(blob(fe.assetId))+'" alt="'+esc(fe.alt||"")+'"><div class="row" style="justify-content:space-between;align-items:flex-end"><span class="tiny muted">'+esc(fe.fileName||"")+(fe.w?" · "+fe.w+" × "+fe.h:"")+'</span>'+(editable?'<span class="row" style="gap:6px">'+(assets?'<span class="btn sm filebtn">Replace<input type="file" accept="image/*" data-upload="feature" aria-label="Replace featured image"></span>':'')+'<button type="button" class="btn sm" data-act="removeFeatured">Remove</button></span>':'')+'</div><label class="f" for="fe-alt">Alt text<input class="in" id="fe-alt" data-falt="1" value="'+esc(fe.alt||"")+'" placeholder="Describe the image for search engines and screen readers"'+(editable?"":" disabled")+'></label>'+(fe.comments||[]).map(function(cm,ci){return commentHtml(cm,"fi",0,ci,true);}).join("")+'</div>':(editable?(assets?'<div class="drop"><div><h3>Upload featured image</h3><p class="small muted">JPG or PNG. 1200 × 630 works well for blogs and social sharing.</p></div><span class="btn accent filebtn">Choose image<input type="file" accept="image/*" data-upload="feature" aria-label="Upload featured image"></span></div>':'<p class="notice">You need edit access to this page to upload files.</p>'):'<p class="small muted">No featured image.</p>'));
    h+=sec("Search result","How the page shows in Google.",teamField(a,"mt",0,a.metaTitle||L(""),"Page title",60,editable,false)+teamField(a,"md",0,a.metaDesc||L(""),"Meta description",155,editable,true));
    h+=sec(a.contentType==="Page"?"Page copy":"Article","Use the bar to add headings, lists, bold and links. Pasting from Google Docs or Word keeps the formatting. "+wordCount(a.body)+" words.",rteHtml(a,editable));
    var pc=(a.paras||[]).map(function(p,i){return (p.comments||[]).length?'<div class="panel"><span class="small muted">'+esc(cut(htmlText(p.text)||p.text,140))+'</span>'+p.comments.map(function(cm,ci){return commentHtml(cm,"pa",i,ci,true);}).join("")+'</div>':'';}).join("");
    if(pc)h+=sec("Client comments on paragraphs","",pc);
  }else if(k==="social"){
    var pl=a.platforms||[];
    h+='<div class="card"><span class="eyebrow">Post setup</span><div class="grid2">'+inp("title","Post name","Internal name, e.g. Display home open day")+'<div class="grid2" style="gap:10px">'+inp("postDate","Post date",null,"date")+inp("postTime","Post time",null,"time")+'</div></div><span class="f">Platforms</span><div class="row" style="gap:14px">'+SOCIAL_PLATFORMS.map(function(p){return '<label class="check"><input type="checkbox" data-splat="'+p+'"'+(pl.indexOf(p)>=0?" checked":"")+(editable?"":" disabled")+'>'+p+'</label>';}).join("")+'</div>'+ownerSel+'</div>'+overall;
    h+=sec("Caption","",teamField(a,"cap",0,a.caption||L(""),"Caption",2200,editable,true));
    h+=sec("First comment","Posted as the first comment straight after the post goes live. Use it for hashtags and calls to action.",teamField(a,"fc",0,a.firstComment||L(""),"First comment",2200,editable,true));
    h+=uploader("Upload images or video","Select up to 20 files at once for a carousel, in order. 4:5 or 1:1 for Facebook and Instagram, 2:3 for Pinterest.","image/*,video/*");
    if((a.creatives||[]).length)h+=sec("Images and video","",fileRows("Slide",false));
  }
  h+='<div class="card" style="background:var(--surface-2)"><label class="f" for="ad-internal">Internal notes · never shown to the client<textarea class="in" rows="2" id="ad-internal" data-adf="internal" placeholder="Brief, direction, anything the team needs to know">'+esc(a.internal||"")+'</textarea></label></div>';
  return h;
}
function newItem(c,k,fid,order){
  var base={id:uid("it"),clientId:c.id,kind:k,folderId:fid,order:order,version:1,status:"draft",owner:c.strategist||"",internal:"",overall:[],note:"",sentAt:null,approvedAt:null,approvedBy:null,reminded:false,createdAt:now(),creatives:[]};
  var blank=function(n){var r=[];for(var i=0;i<n;i++)r.push(L(""));return r;};
  if(k==="search")return Object.assign(base,{title:"New search ad",url:c.landing||"",path1:"",path2:"",headlines:blank(15),descriptions:blank(4),keywords:L("")});
  if(k==="landing")return Object.assign(base,{title:"New landing page",url:"",brief:""});
  if(k==="webpage")return Object.assign(base,{title:"New page",url:"",brief:""});
  if(k==="seo")return Object.assign(base,{title:"Untitled",contentType:"Article",keyword:"",slug:"",metaTitle:L(""),metaDesc:L(""),body:"",paras:[]});
  return Object.assign(base,{title:"New post",postDate:"",platforms:["Facebook","Instagram"],caption:L("")});
}
function nextPeriodName(c,mode,k){
  var d=new Date();var names=rawFolders(c,k||"social").map(function(f){return f.name;});
  if(mode==="quarter"){for(var i=1;i<=8;i++){var q=new Date(d.getFullYear(),d.getMonth()+3*i,1);var nm="Q"+(Math.floor(q.getMonth()/3)+1)+" "+q.getFullYear();if(names.indexOf(nm)<0)return nm;}}
  for(var j=1;j<=24;j++){var m=new Date(d.getFullYear(),d.getMonth()+j,1);var n2=m.toLocaleDateString("en-AU",{month:"long",year:"numeric"});if(names.indexOf(n2)<0)return n2;}
  return "";
}

/* ---------- team nav + pages ---------- */
var NAV_IC={"overview":'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',"archive":'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>',"k-meta":'<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',"k-search":'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',"k-landing":'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h8M8 16h5"/>',"k-webpage":'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',"k-seo":'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',"k-social":'<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',"dash":'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',"clients":'<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',"addClient":'<path d="M12 5v14M5 12h14"/>',"team":'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',"month":'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',"brand":'<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.7-.7 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.5 5.5 0 0 0 22 11c0-5-4.5-9-10-9z"/>',"settings":'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'};
function navIc(k){return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(NAV_IC[k]||'')+'</svg>';}
function teamNav(){
  var item=function(label,page){return '<button type="button" class="nav-btn" data-act="page" data-v="'+page+'" aria-current="'+(S.page===page)+'"><span class="ic">'+navIc(page)+'<span>'+label+'</span></span></button>';};
  var h=item("Dashboard","dash")+item("Approvals","clients")+item("Team","team");
  h+='<div class="nav-label">Clients</div>';
  clientList().forEach(function(cl){
    var open=cl.id===S.clientId&&(S.page==="work"||S.page==="settings"||S.page==="brand");
    var s=clientSummary(cl);
    h+='<button type="button" class="nav-btn nav-cl" data-act="openClient" data-v="'+cl.id+'" aria-current="false"><span class="ic">'+logoHtml(cl,"sm")+'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap'+(open?';font-weight:600':'')+'">'+esc(cl.name)+'</span></span>'+(s.ch||s.dr?'<span class="tiny muted num">'+(s.ch+s.dr)+'</span>':"")+'</button>';
    if(open){
      h+=navFolders(cl,true);
      h+='<button type="button" class="nav-btn nav-sub" data-act="page" data-v="brand" aria-current="'+(S.page==="brand")+'"><span class="ic">'+navIc("brand")+'<span>Brand assets</span></span></button>';
      h+='<button type="button" class="nav-btn nav-sub" data-act="page" data-v="settings" aria-current="'+(S.page==="settings")+'"><span class="ic">'+navIc("settings")+'<span>Client settings</span></span></button>';
    }
  });
  h+='<button type="button" class="nav-btn" data-act="page" data-v="addClient" aria-current="'+(S.page==="addClient")+'" style="margin-top:2px"><span class="ic">'+navIc("addClient")+'<span class="muted">Add client</span></span></button>';
  return h;
}
function teamPage(){
  if(S.page==="dash")return dashPage();
  if(S.page==="clients")return clientsPage();
  if(S.page==="addClient")return addClientPage();
  if(S.page==="settings")return settingsPage();
  if(S.page==="brand")return brandPage();
  if(S.page==="team")return teamSettingsPage();
  return S.kind&&S.kind!=="meta"?kindWorkPage():workPage();
}
function teamItems(c){return allItems(c.id).filter(function(x){if(x.status==="archived")return false;var fid=kindOf(x)==="meta"?x.monthKey:x.folderId;return !folderArchived(c,kindOf(x),fid);});}
function clientSummary(c){
  var its=teamItems(c),cnt=function(s){return its.filter(function(a){return a.status===s;}).length;};
  var ch=cnt("changes"),dr=cnt("draft"),aw=cnt("awaiting"),ap=cnt("approved"),lv=cnt("live");
  var wait=(ch||dr)?"Gordon Digital":(aw?"Client":(ap?"Gordon Digital":"Nobody"));
  var oldest=its.filter(function(a){return a.status==="awaiting";}).map(function(a){return workDays(a.sentAt);}).sort(function(x,y){return y-x;})[0]||0;
  var pl=function(n,w){return n+" "+w+(n>1?"s":"");};
  var next=ch?"Make changes on "+pl(ch,"item"):(dr?"Send "+pl(dr,"draft")+" to client":(ap?"Put "+pl(ap,"approved item")+" live":(aw?"Chase approval":(its.length?"Plan what's next":"Add the first work"))));
  var types=KINDS.filter(function(kk){return its.some(function(x){return kindOf(x)===kk.k;});}).map(function(kk){return kk.k;});
  return {items:its,total:its.length,ch:ch,dr:dr,aw:aw,ap:ap,lv:lv,done:ap+lv,sent:its.length-dr,wait:wait,days:aw?oldest:0,next:next,overdue:aw&&oldest>(c.reminderDays||3),types:types};
}
function kTagK(k){var t=KTAG[k]||KTAG.meta;return '<span class="ktag" style="background:'+t[1]+';color:'+t[2]+'">'+esc(t[0])+'</span>';}
var TEAM_COLS=[["draft","Drafts","Not sent yet"],["awaiting","With client","Waiting on approval"],["changes","Changes requested","Over to the team"],["approved","Approved","Ready to go live"],["live","Live","Last 30 days"]];
function teamBoard(rows){
  var f=S.dashKind||"all",st=S.dashStrat||"All";
  var all=[];rows.forEach(function(r){r.s.items.forEach(function(x){all.push({c:r.c,x:x});});});
  var kinds=KINDS.filter(function(kk){return all.some(function(e){return kindOf(e.x)===kk.k;});});
  var shown=all.filter(function(e){return (f==="all"||kindOf(e.x)===f)&&(st==="All"||(st==="Unassigned"?!e.c.strategist:e.c.strategist===st));});
  var h='<div class="lbl" style="align-items:flex-end;flex-wrap:wrap;gap:10px"><h2>Pipeline</h2><div class="row" style="gap:8px"><label class="sr" for="dash-strat">Strategist</label><select class="in" id="dash-strat" data-dashstrat="1" style="width:auto;padding:5px 10px;font-size:13px">'+["All"].concat(strats(),["Unassigned"]).map(function(n){return '<option'+(n===st?" selected":"")+'>'+esc(n)+'</option>';}).join("")+'</select>'+(kinds.length>1?'<div class="chips" role="group" aria-label="Filter by type"><button type="button" data-act="dashKind" data-v="all" aria-pressed="'+(f==="all")+'">All</button>'+kinds.map(function(kk){return '<button type="button" data-act="dashKind" data-v="'+kk.k+'" aria-pressed="'+(f===kk.k)+'">'+esc(KTAG[kk.k][0])+'</button>';}).join("")+'</div>':'')+'</div></div>';
  var cut30=new Date(Date.now()-30*86400000).toISOString();
  h+='<div class="board b5">'+TEAM_COLS.map(function(col){
    var its=shown.filter(function(e){return e.x.status===col[0]&&(col[0]!=="live"||(e.x.updatedAt||"")>=cut30);});
    its.sort(function(a,b){if(col[0]==="awaiting")return (a.x.sentAt||"").localeCompare(b.x.sentAt||"");return (b.x.updatedAt||"").localeCompare(a.x.updatedAt||"");});
    var cap=15,more=its.length-cap;
    return '<section class="bcol bc-'+col[0]+'" aria-label="'+col[1]+'"><div class="bhead"><span class="bdot"></span><b>'+col[1]+'</b><span class="bcount">'+its.length+'</span></div><span class="tiny muted">'+col[2]+'</span><div class="bcards">'+(its.length?its.slice(0,cap).map(function(e){var x=e.x,fid=kindOf(x)==="meta"?x.monthKey:x.folderId,d=workDays(x.sentAt),od=x.status==="awaiting"&&d>(e.c.reminderDays||3);
      return '<button type="button" class="bcard'+(od?" od":"")+'" data-act="openAd" data-c="'+e.c.id+'" data-v="'+x.id+'"><span class="row" style="gap:6px;justify-content:space-between;flex-wrap:nowrap">'+kindTag(x)+(od?'<span class="odtag">'+d+' working days</span>':'')+'</span><b class="small">'+esc(x.title||"Untitled")+'</b><span class="tiny muted">'+esc(e.c.name)+' · '+esc(folderName(e.c,kindOf(x),fid))+'</span><span class="tiny muted">'+esc(x.owner||e.c.strategist||"Unassigned")+(x.status==="awaiting"&&x.sentAt?' · sent '+(d===0?"today":d+" working day"+(d>1?"s":"")+" ago"):'')+'</span></button>';}).join("")+(more>0?'<span class="tiny muted" style="padding:4px 2px">And '+more+' more</span>':''):'<span class="bempty">Nothing here</span>')+'</div></section>';}).join("")+'</div>';
  return h;
}
function dashPage(){
  var cl=clientList(),rows=cl.map(function(c){return {c:c,s:clientSummary(c)};});
  var sum=function(k){return rows.reduce(function(n,r){return n+r.s[k];},0);};
  var overdue=rows.reduce(function(n,r){return n+r.s.items.filter(function(x){return x.status==="awaiting"&&workDays(x.sentAt)>(r.c.reminderDays||3);}).length;},0);
  var h='<div class="page"><div class="head"><div class="l"><span class="eyebrow">Management dashboard</span><h1>Every client. Every strategist. One status.</h1><span class="muted">Across Meta, Google Search, landing pages, website, content and social.</span></div><button type="button" class="btn go" data-act="page" data-v="addClient">Add client</button></div>';
  h+='<div class="grid4 g5"><div class="stat a"><b class="num">'+sum("aw")+'</b><span>With clients for approval</span></div><div class="stat d"><b class="num">'+overdue+'</b><span>Overdue approvals</span></div><div class="stat s"><b class="num">'+sum("ch")+'</b><span>Changes to make</span></div><div class="stat"><b class="num">'+sum("ap")+'</b><span>Approved, ready to go live</span></div><div class="stat x"><b class="num">'+sum("dr")+'</b><span>Drafts not sent</span></div></div>';
  h+=teamBoard(rows);
  var wl=strats().slice();if(rows.some(function(r){return !r.c.strategist||strats().indexOf(r.c.strategist)<0;}))wl.push("Unassigned");
  h+='<h2>Strategist workload</h2><div class="wl">'+wl.map(function(n){var mine=rows.filter(function(r){return n==="Unassigned"?(!r.c.strategist||strats().indexOf(r.c.strategist)<0):r.c.strategist===n;});
    var act=mine.reduce(function(k,r){return k+r.s.ch+r.s.dr+r.s.ap;},0),wc=mine.reduce(function(k,r){return k+r.s.aw;},0),od=mine.reduce(function(k,r){return k+r.s.items.filter(function(x){return x.status==="awaiting"&&workDays(x.sentAt)>(r.c.reminderDays||3);}).length;},0);
    return '<button type="button" class="card wl-c" data-act="strat" data-v="'+esc(n)+'"><div class="row" style="gap:10px">'+personAv(n)+'<div style="flex:1;min-width:0"><b>'+esc(n)+'</b><div class="tiny muted">'+mine.length+' client'+(mine.length===1?"":"s")+'</div></div></div><div class="wl-n"><div><b class="num">'+act+'</b><span>To action</span></div><div><b class="num">'+wc+'</b><span>With clients</span></div><div'+(od?' class="warn"':'')+'><b class="num">'+od+'</b><span>Overdue</span></div></div></button>';}).join("")+'</div>';
  h+='<div class="card"><div class="lbl"><h2>Clients</h2><span class="small muted" style="font-weight:400">'+cl.length+' active</span></div><div class="tbl-wrap"><table><thead><tr><th>Client</th><th>Strategist</th><th>Approval types</th><th class="num" style="text-align:right">With client</th><th class="num" style="text-align:right">To action</th><th class="num" style="text-align:right">Oldest wait (working days)</th><th>Next step</th></tr></thead><tbody>';
  h+=rows.map(function(r){var s=r.s,c=r.c;return '<tr><td><button type="button" class="link row" style="gap:8px;flex-wrap:nowrap" data-act="openClient" data-v="'+c.id+'">'+logoHtml(c,"sm")+esc(c.name)+'</button></td><td>'+esc(c.strategist||"Unassigned")+'</td><td><span class="row" style="gap:4px">'+(s.types.length?s.types.map(kTagK).join(""):'<span class="tiny muted">Nothing yet</span>')+'</span></td><td class="num" style="text-align:right">'+(s.aw||"·")+'</td><td class="num" style="text-align:right">'+((s.ch+s.dr+s.ap)||"·")+'</td><td class="num" style="text-align:right'+(s.overdue?';color:var(--warn);font-weight:600':'')+'">'+(s.aw?s.days:"·")+'</td><td>'+esc(s.next)+'</td></tr>';}).join("")||'<tr><td colspan="7" class="muted">No clients yet. Add your first client to get started.</td></tr>';
  return h+'</tbody></table></div></div></div>';
}
function clientsPage(){
  var cl=clientList().filter(function(c){return S.strat==="All"||(S.strat==="Unassigned"?(!c.strategist||strats().indexOf(c.strategist)<0):c.strategist===S.strat);});
  var h='<div class="page"><div class="head"><div class="l"><span class="eyebrow">Approvals</span><h1>'+(S.strat==="All"?"All clients":(S.strat==="Unassigned"?"Unassigned clients":esc(S.strat)+"'s clients"))+'</h1><span class="muted">What needs doing across every approval type.</span></div><div class="row"><button type="button" class="btn go" data-act="page" data-v="addClient">Add client</button></div></div>';
  h+='<div class="chips" role="group" aria-label="Strategist">'+["All"].concat(strats(),["Unassigned"]).map(function(n){return '<button type="button" data-act="strat" data-v="'+esc(n)+'" aria-pressed="'+(S.strat===n)+'">'+esc(n)+'</button>';}).join("")+'</div>';
  if(S.flash)h+='<p class="notice" role="status">'+esc(S.flash)+'</p>';
  var groups=[["changes","Changes to make","The client has sent feedback"],["draft","Drafts to send","Finish and add to a batch"],["approved","Approved, ready to go live","Build or publish, then mark live"],["awaiting","Waiting on the client","Chase anything overdue"]];
  var todo=[];cl.forEach(function(c){teamItems(c).forEach(function(x){todo.push({c:c,x:x});});});
  h+='<div class="todo">'+groups.map(function(g){var its=todo.filter(function(e){return e.x.status===g[0];});if(g[0]==="awaiting")its=its.filter(function(e){return workDays(e.x.sentAt)>(e.c.reminderDays||3);});
      its.sort(function(a,b){return (a.x.sentAt||a.x.updatedAt||"").localeCompare(b.x.sentAt||b.x.updatedAt||"");});
      return '<div class="card td-c bc-'+g[0]+'"><div class="bhead"><span class="bdot"></span><b>'+(g[0]==="awaiting"?"Overdue with client":g[1])+'</b><span class="bcount">'+its.length+'</span></div><span class="tiny muted">'+g[2]+'</span>'+(its.length?'<div class="td-list">'+its.slice(0,6).map(function(e){var fid=kindOf(e.x)==="meta"?e.x.monthKey:e.x.folderId;return '<button type="button" class="td-row" data-act="openAd" data-c="'+e.c.id+'" data-v="'+e.x.id+'">'+kindTag(e.x)+'<span class="td-t"><b class="small">'+esc(e.x.title||"Untitled")+'</b><span class="tiny muted">'+esc(e.c.name)+' · '+esc(folderName(e.c,kindOf(e.x),fid))+'</span></span></button>';}).join("")+(its.length>6?'<span class="tiny muted">And '+(its.length-6)+' more</span>':'')+'</div>':'<span class="bempty">All clear</span>')+'</div>';}).join("")+'</div>';
  h+='<h2>Clients</h2><div class="cards3">'+(cl.map(function(c){var s=clientSummary(c);
    return '<div class="card cl-c"><div class="row" style="gap:12px;flex-wrap:nowrap">'+logoHtml(c)+'<div style="min-width:0;flex:1"><b>'+esc(c.name)+'</b><div class="small muted">'+esc(c.strategist||"Unassigned")+'</div></div><span class="pill '+(s.wait==="Client"?"st-awaiting":(s.wait==="Nobody"?"st-live":"st-changes"))+'">'+(s.wait==="Gordon Digital"?"On us":(s.wait==="Client"?"On client":(s.total?"All done":"Nothing yet")))+'</span></div><span class="row" style="gap:4px">'+(s.types.length?s.types.map(kTagK).join(""):'<span class="tiny muted">No work yet</span>')+'</span><div class="cl-n"><div><b class="num">'+s.aw+'</b><span>With client</span></div><div><b class="num">'+s.ch+'</b><span>Changes</span></div><div><b class="num">'+s.dr+'</b><span>Drafts</span></div><div><b class="num">'+s.ap+'</b><span>Approved</span></div></div><div class="row" style="flex-wrap:nowrap"><button type="button" class="btn dark" style="flex:1" data-act="openClient" data-v="'+c.id+'">Open</button><button type="button" class="btn" data-act="openSettings" data-v="'+c.id+'">Settings</button></div></div>';}).join("")||'<div class="card muted">No clients for this strategist yet.</div>')+'</div></div>';
  return h;
}
function addClientPage(){
  if(!S.nc)S.nc={name:"",strategist:(S.strat==="All"||S.strat==="Unassigned")?(strats()[0]||""):S.strat,website:"",ig:"",approverName:"",approverEmail:"",meta:true,search:false};
  var nc=S.nc,f=function(k,label,help){return '<label class="f" for="nc-'+k+'">'+label+'<input class="in" id="nc-'+k+'" data-nc="'+k+'" value="'+esc(nc[k])+'"><span class="h">'+help+'</span></label>';};
  return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">Approvals portal / Add client</span><h1>Set up a new client</h1><p class="muted">This creates their folder. Logo, ad accounts and branding can be added in Client settings afterwards.</p></div></div><div class="grid2" style="max-width:1040px"><div class="card">'+
   f("name","Client name","As it should appear in the portal and on Facebook.")+f("website","Website","Used for the display link in previews.")+f("ig","Instagram handle","Without the @.")+f("approverName","Main approver name","The person who signs off ads.")+f("approverEmail","Approver email","They get the portal invite and reminders.")+
   '</div><div style="display:flex;flex-direction:column;gap:16px"><div class="card"><label class="f" for="nc-strategist">Strategist<select class="in" id="nc-strategist" data-nc="strategist">'+stratOpts(nc.strategist)+'</select></label><span class="f" style="font-weight:700;font-size:13px">Platforms</span><label class="check"><input type="checkbox" id="nc-meta" data-ncc="meta"'+(nc.meta?" checked":"")+'>Meta Ads · reviewed monthly</label>'+KINDS.slice(1).map(function(kk){return '<label class="check"><input type="checkbox" id="nc-'+kk.k+'" data-ncc="'+kk.k+'"'+(nc[kk.k]?" checked":"")+'>'+esc(kk.name)+' · by '+esc(kk.folder.toLowerCase())+'</label>';}).join("")+'</div><button type="button" class="btn go big" data-act="createClient">Create client</button><button type="button" class="btn big" data-act="page" data-v="clients">Cancel</button><p class="small muted" id="nc-hint">'+(nc.name.trim()?"":"Add a client name to create the folder.")+'</p></div></div></div>';
}
function settingsPage(){
  var c=S.clients[S.clientId];if(!c)return '<div class="empty">Choose a client first.</div>';
  var f=function(k,label,help){return '<label class="f" for="cs-'+k+'">'+label+'<input class="in" id="cs-'+k+'" data-cf="'+k+'" value="'+esc(c[k]||"")+'">'+(help?'<span class="h">'+help+'</span>':"")+'</label>';};
  var slug=String(c.website||c.name).replace(/^https?:\/\//,"").replace(/^www\./,"").split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g,"");
  return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / Client settings</span><h1>Branding, accounts and approvers</h1></div><button type="button" class="btn dark" data-act="asClient" data-v="'+c.id+'">Preview as client</button></div><div class="grid2">'+
   '<div class="card"><h2>Branding in ad previews</h2><div class="row" style="gap:16px">'+logoHtml(c,"lg")+'<div style="display:flex;flex-direction:column;gap:6px">'+(assets?'<span class="btn filebtn">Upload page logo<input type="file" accept="image/*" id="logo-up" data-upload="logo" aria-label="Upload page logo"></span>':'<span class="small muted">You need edit access to this page to upload files.</span>')+'<span class="small muted">Square PNG or JPG. Shows as the Facebook and Instagram profile image in every preview.</span></div></div>'+
   f("name","Facebook page name","Shown on every ad preview.")+f("ig","Instagram handle","Without the @.")+f("website","Website","Shown as the display link under the image.")+f("landing","Default landing page","Used for new ads. Each ad can change it.")+'</div>'+
   '<div style="display:flex;flex-direction:column;gap:16px"><div class="card"><h2>Ad defaults and accounts</h2><label class="f" for="cs-defaultCta">Default call to action<select class="in" id="cs-defaultCta" data-cf="defaultCta">'+CTAS.map(function(o){return '<option'+(c.defaultCta===o?" selected":"")+'>'+o+'</option>';}).join("")+'</select></label>'+f("metaAccount","Meta ad account")+f("googleId","Google Ads customer ID")+'<label class="f" for="cs-strategist">Strategist<select class="in" id="cs-strategist" data-cf="strategist">'+stratOpts(c.strategist)+'</select></label></div>'+
   '<div class="card"><h2>Client approver</h2>'+f("approverName","Name")+f("approverEmail","Email","Gets the portal invite and reminders.")+'<label class="f" for="cs-reminderDays">Overdue after this many working days<input class="in num" type="number" min="1" max="14" id="cs-reminderDays" data-cf="reminderDays" value="'+esc(c.reminderDays||3)+'"></label></div>'+
   '<div class="card"><h2>Approval types</h2><span class="small muted">Turn on what this client approves with us. Each type gets its own folders.</span>'+KINDS.map(function(kk){var on=kk.k==="meta"?((c.platforms||{}).meta!==false):!!(c.platforms||{})[kk.k];return '<label class="check"><input type="checkbox" data-plat="'+kk.k+'"'+(on?" checked":"")+'>'+esc(kk.name)+' <span class="small muted">· folders by '+esc(kk.folder.toLowerCase())+'</span></label>';}).join("")+'</div>'+
   '<div class="card"><h2>Gordon Digital contact</h2><span class="small muted">Shown on the client\'s overview page.</span>'+f("gdEmail","Email")+f("gdPhone","Phone")+'</div>'+
   '<div class="card"><h2>Client portal link</h2><div class="name-box"><span class="mono" id="portal-link">approvals.gordondigital.com.au/'+esc(slug)+'</span></div><span class="small muted">The address clients will use in the full build. In this test version, use Client view at the top.</span></div></div></div></div>';
}
function teamSettingsPage(){
  var list=strats(),cl=clientList();
  var rows=list.map(function(n,i){var cnt=cl.filter(function(c){return c.strategist===n;}).length,pr=person(n);
    if(S.editStrat===n){var dr=S.spDraft||{};
      return '<div class="sp-edit"><div class="row" style="gap:14px;align-items:flex-start;flex-wrap:nowrap"><div class="sp-photo">'+(dr.photoId?'<img src="'+esc(blob(dr.photoId))+'" alt="">':'<span>'+esc(initials(dr.name||n))+'</span>')+(assets?'<span class="btn sm filebtn">'+(dr.photoId?"Change":"Add photo")+'<input type="file" accept="image/*" data-upload="sphoto" aria-label="Upload photo"></span>':'')+'</div><div class="grid2" style="flex:1">'+
        '<label class="f" for="sp-name">Name<input class="in" id="sp-name" data-spd="name" value="'+esc(dr.name)+'"></label><label class="f" for="sp-title">Role<input class="in" id="sp-title" data-spd="title" value="'+esc(dr.title)+'" placeholder="e.g. Paid Media Strategist"></label>'+
        '<label class="f" for="sp-email">Email<input class="in" type="email" id="sp-email" data-spd="email" value="'+esc(dr.email)+'"></label><label class="f" for="sp-phone">Phone<input class="in" id="sp-phone" data-spd="phone" value="'+esc(dr.phone)+'"></label></div></div>'+
        '<div class="row" style="justify-content:flex-end"><button type="button" class="btn sm" data-act="cancelStratEdit">Cancel</button><button type="button" class="btn sm dark" data-act="saveStrat">Save</button></div><span class="tiny muted">Clients see the photo, name, role, email and phone on their overview page. Changing the name updates every client and item they own.</span></div>';}
    return '<div class="sp-row">'+personAv(n)+'<div style="flex:1;min-width:0"><b>'+esc(n)+'</b>'+(pr.title?' <span class="small muted">· '+esc(pr.title)+'</span>':'')+'<div class="tiny muted">'+[pr.email,pr.phone].filter(Boolean).map(esc).join(" · ")+(pr.email||pr.phone?" · ":"")+cnt+' client'+(cnt===1?"":"s")+'</div></div><button type="button" class="btn sm" data-act="editStrat" data-v="'+esc(n)+'">Edit</button><button type="button" class="btn sm" data-act="removeStrat" data-i="'+i+'">Remove</button></div>';}).join("");
  var un=cl.filter(function(c){return !c.strategist||list.indexOf(c.strategist)<0;});
  return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">Gordon Digital portal / Team</span><h1>Strategists</h1><p class="muted">Everyone here can be assigned clients and work. Clients see their strategist\'s details on their overview page.</p></div></div><div class="grid2" style="max-width:1100px"><div class="card"><h2>Current strategists</h2>'+rows+'<div class="row" style="padding-top:12px;border-top:1px solid var(--line)"><label class="f" for="new-strat" style="flex:1;min-width:180px">Add a strategist<input class="in" id="new-strat" data-newstrat="1" value="'+esc(S.newStrat)+'" placeholder="First name"></label><button type="button" class="btn go" style="align-self:flex-end" data-act="addStrat">Add</button></div></div><div class="card"><h2>Clients without a strategist</h2>'+(un.length?un.map(function(c){return '<div class="row" style="justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)"><b>'+esc(c.name)+'</b><button type="button" class="btn sm dark" data-act="openSettings" data-v="'+c.id+'">Assign</button></div>';}).join(""):'<p class="small muted">Every client has a strategist.</p>')+'</div></div></div>';
}
function people(){return (S.team&&S.team.people)||{};}
function person(n){return people()[n]||{};}
function saveTeam(list,ppl){var pp=ppl||people();S.team={strategists:list,people:pp};render();if(db)db.doc("settings/team").set({strategists:list,people:pp,updatedAt:now()}).catch(fail);}
function personAv(n,cls){var pr=person(n);return pr.photoId?'<img class="logo '+(cls||"")+'" style="border-radius:999px" src="'+esc(blob(pr.photoId))+'" alt="">':'<span class="logo '+(cls||"")+'" style="border-radius:999px">'+esc(initials(n||"GD"))+'</span>';}
function workPage(){
  var c=S.clients[S.clientId];if(!c){S.page="clients";return clientsPage();}
  if(!S.monthKey||monthsFor(c).indexOf(S.monthKey)<0)S.monthKey=(folderList(c,"meta").filter(function(f){return !f.archived;})[0]||{}).id||latestMonth(c);
  if(!S.monthKey)return '<div class="page"><div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / Meta Ads</span><h1>No months yet</h1></div><button type="button" class="btn go" data-act="addMonth">Add the first month</button></div></div>';
  var ads=adsFor(c.id,S.monthKey);
  var a=S.ads[S.adId];if(!a||a.clientId!==c.id||a.monthKey!==S.monthKey){a=ads[0]||null;S.adId=a?a.id:null;}
  var h='<div class="head"><div class="l"><span class="eyebrow">'+esc(c.name)+' / Meta Ads'+(folderArchived(c,"meta",S.monthKey)?' · Archived':'')+'</span><h1>'+esc(monthLabel(S.monthKey))+'</h1></div><div class="row">'+archBtn(c,"meta",S.monthKey,ads)+'<button type="button" class="btn" data-act="removeMonth">Remove month</button><button type="button" class="btn" data-act="addAd">Add ad</button><button type="button" class="btn" data-act="copyLink">Copy client link</button><button type="button" class="btn dark" data-act="asClient" data-v="'+c.id+'">Preview as client</button></div></div>';
  h+=folderArchNotice(c,"meta",S.monthKey,ads);
  if(S.confirmMonth===S.monthKey){var dn=ads.length;h+='<div class="notice row" style="justify-content:space-between" role="alert"><span>Remove '+esc(monthLabel(S.monthKey))+'?'+(dn?' This also deletes the '+dn+' draft ad'+(dn>1?"s":"")+' in it.':' It has no ads.')+'</span><span class="row"><button type="button" class="btn sm" data-act="cancelMonth">Keep it</button><button type="button" class="btn sm dark" data-act="confirmMonth">Remove month</button></span></div>';}
  var groups={};ads.forEach(function(x){(groups[x.group||"Ads"]=groups[x.group||"Ads"]||[]).push(x);});
  var ready=ads.filter(canSend);Object.keys(S.batch).forEach(function(id){if(!S.ads[id]||!canSend(S.ads[id])||S.ads[id].clientId!==c.id||S.ads[id].monthKey!==S.monthKey)delete S.batch[id];});
  var nb=Object.keys(S.batch).length;
  var bar=ready.length?'<div class="bbar"><div class="lbl"><span class="eyebrow">Send to client</span><button type="button" class="btn sm" data-act="batchAll">'+(nb===ready.length?"Clear":"Select all "+ready.length)+'</button></div><span class="small muted">'+(nb?nb+" of "+ready.length+" ready ad"+(ready.length>1?"s":"")+" selected.":"Tick the ads to send together. The client gets one notification per batch.")+'</span><button type="button" class="btn go" data-act="sendBatch"'+(nb?"":" disabled")+'>'+(nb?"Send "+nb+" ad"+(nb>1?"s":"")+" to client":"Select ads to send")+'</button></div>':"";
  var list=bar+Object.keys(groups).map(function(g){return '<div class="eyebrow" style="margin-top:6px">'+esc(g)+'</div>'+groups[g].map(function(x){var oc=openComments(x),cs=canSend(x);return '<div class="item tm'+(a&&x.id===a.id?" cur":"")+(x.status==="archived"?" arch-i":"")+'" data-act="pickAd" data-v="'+x.id+'" aria-current="'+(a&&x.id===a.id)+'">'+(cs?'<label class="bsel" title="Include in batch"><input type="checkbox" data-batch="'+x.id+'"'+(S.batch[x.id]?" checked":"")+' aria-label="Include '+esc(x.title||"this ad")+' in batch"></label>':'')+'<div class="tm-b"><div class="lbl"><span class="t">'+esc(x.title||"Untitled ad")+'</span><span class="tiny muted" style="font-weight:400">v'+x.version+' · '+esc(x.owner||"Unassigned")+'</span></div><span class="tiny muted mono" style="font-size:11px">'+esc(nameOf(x))+'</span><div class="row">'+statusPill(x.status,true)+(oc?'<span class="tiny"><b>'+oc+' open comment'+(oc>1?"s":"")+'</b></span>':"")+'</div></div></div>';}).join("");}).join("")||'<p class="small muted">No ads this month yet. Use Add ad to create the first one.</p>';
  return h+'<div class="work"><section class="col-list" aria-label="Ads">'+list+'</section><section class="col-main" aria-label="Editor">'+(a?editor(a,c):'<div class="card empty">Add an ad to start building this month.</div>')+'</section></div>';
}
function itemArchBtn(a){if(a.status==="archived")return '<button type="button" class="btn" data-act="restoreItem">Restore</button>';if(isDone(a)||a.status==="draft")return "";return '<button type="button" class="btn" data-act="archiveItem">Archive</button>';}
function itemArchNotice(a){return S.confirmItemArch===a.id?'<div class="notice row" style="justify-content:space-between" role="alert"><span>Archive this '+esc(K(kindOf(a)).unit)+'? It disappears from the client\'s view and stays here for the record. You can restore it.</span><span class="row"><button type="button" class="btn sm" data-act="cancelItemArch">Keep it</button><button type="button" class="btn sm dark" data-act="confirmItemArch">Archive</button></span></div>':"";}
function canSend(x){return x.status==="draft"||x.status==="changes";}
function editor(a,c){
  var editable=a.status==="draft"||a.status==="changes",oc=openComments(a);
  var next=a.status==="draft"?a.version:a.version+1;
  var notes={draft:"Not visible to the client yet.",awaiting:"With the client since "+shortDate(a.sentAt)+". Editing is locked until you pull it back.",changes:"The client asked for changes. Edit, resolve each comment, then send the new version.",approved:"Approved by the client. Build it in Ads Manager, then mark it live.",live:"Live in Meta. This version is locked for the record."};
  var inB=!!S.batch[a.id];
  var acts=editable?'<button type="button" class="btn'+(inB?" go":"")+'" data-act="toggleBatch" data-v="'+a.id+'" aria-pressed="'+inB+'">'+(inB?"✓ In this batch":"Add v"+next+" to batch")+'</button>'+(a.status==="draft"?'<button type="button" class="btn" data-act="deleteDraft">Delete draft</button>':''):
    (a.status==="awaiting"?'<button type="button" class="btn" data-act="pullBack">Pull back to edit</button><button type="button" class="btn dark" data-act="remind">'+(a.reminded?"Reminder sent":"Send reminder")+'</button>':(a.status==="approved"?'<button type="button" class="btn dark" data-act="markLive">Mark live in Meta</button>':""));
  acts+=itemArchBtn(a);
  var h='<div class="card"><div class="lbl" style="align-items:flex-start"><h2>'+esc(a.title||"Untitled ad")+'</h2>'+statusPill(a.status,true)+'</div><div class="row" style="justify-content:space-between;align-items:center"><p class="small" style="flex:1;min-width:220px">'+esc(notes[a.status]||"Archived. Hidden from the client and kept for the record.")+'</p><div class="row">'+acts+'</div></div>'+itemArchNotice(a)+(S.confirmDelete===a.id?'<div class="notice row" style="justify-content:space-between">Delete this draft for good?<span class="row"><button type="button" class="btn sm" data-act="cancelDelete">Keep it</button><button type="button" class="btn sm dark" data-act="confirmDelete">Delete</button></span></div>':"")+(editable&&oc?'<p class="notice">'+oc+' client comment'+(oc>1?"s are":" is")+' still open. Resolve them before you send the new version.</p>':"")+'</div>';
  var sel=function(k,label,opts){var cur=k==="dest"?normDest(a.dest):(a[k]||"");return '<label class="f" for="ad-'+k+'">'+label+'<select class="in" id="ad-'+k+'" data-adf="'+k+'"'+(editable?"":" disabled")+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(cur===o[0]?" selected":"")+'>'+esc(o[1])+'</option>';}).join("")+'</select></label>';};
  h+='<div class="card"><span class="eyebrow">Ad setup and naming</span><div class="grid4">'+sel("type","Format",FORMATS.map(function(x){return [x,x[0]+x.slice(1).toLowerCase()];}))+sel("stage","Stage",[["","Choose a stage"]].concat(STAGES.map(function(x){return [x,x];})))+
    '<label class="f" for="ad-group">Campaign<input class="in" id="ad-group" data-adf="group" value="'+esc(a.group||"")+'"'+(editable?"":" disabled")+'></label>'+sel("dest","Destination (not in name)",DESTS.map(function(x){return [x,x];}))+'</div>'+
    '<label class="f" for="ad-title">Descriptor<input class="in" id="ad-title" data-adf="title" value="'+esc(a.title||"")+'"'+(editable?"":" disabled")+'><span class="h">Plain description of the creative. Written in Title Case in the ad name.</span></label>'+
    '<div class="name-box"><span class="tiny muted">Ad name in Meta</span><span class="mono" id="ad-name">'+esc(nameOf(a))+'</span><span class="tiny muted">[FORMAT] STAGE_Descriptor</span>'+(a.stage?"":'<span class="warn-t">Stage is required. Choose one to complete the ad name.</span>')+'</div>'+
    '<label class="f" for="ad-owner">Owner<select class="in" id="ad-owner" data-adf="owner">'+stratOpts(a.owner)+'</select></label></div>';
  if(a.status!=="draft")h+='<div class="card"><span class="eyebrow">Overall client feedback</span>'+((a.overall||[]).length?a.overall.map(function(cm,ci){return commentHtml(cm,"o",0,ci,true);}).join(""):'<p class="small muted">No overall comments.</p>')+(S.composer==="o0"?composer("o0","o",0,"Reply to the client","Send reply"):'<button type="button" class="btn sm" style="align-self:flex-start" data-act="compose" data-v="o0">Reply to the client</button>')+'</div>';
  h+='<div class="card" style="background:var(--surface-2)"><label class="f" for="ad-internal">Internal notes · never shown to the client<textarea class="in" rows="2" id="ad-internal" data-adf="internal" placeholder="Brief, messaging direction, anything the team needs to know">'+esc(a.internal||"")+'</textarea></label></div>';
  var cN=copyLines(a).filter(lineHasIssue).length,crN=a.creatives.filter(lineHasIssue).length;
  h+='<div class="chips" role="group" aria-label="Section"><button type="button" data-act="tab" data-v="copy" aria-pressed="'+(S.tab==="copy")+'">Copy · '+cN+'</button><button type="button" data-act="tab" data-v="creative" aria-pressed="'+(S.tab==="creative")+'">Creative · '+crN+'</button></div>';
  var sec=function(t,note,body){return '<div style="display:flex;flex-direction:column;gap:10px"><div style="padding:0 4px"><h3>'+t+'</h3><span class="small muted">'+note+'</span></div>'+body+'</div>';};
  if(S.tab==="copy"){
    h+=sec("Primary text","Up to 5 options. The client sees every option in full.",a.primaries.map(function(l,i){return teamField(a,"p",i,l,"Primary text "+(i+1),"meta",editable,true);}).join(""));
    h+=sec("Headlines","Keep to 40 characters or fewer.",a.headlines.map(function(l,i){return teamField(a,"h",i,l,"Headline "+(i+1),40,editable,false);}).join(""));
    h+=sec("Description","One line under the headline. Keep to about 30 characters.",teamField(a,"dsc",0,a.description,"Description",30,editable,false));
    h+=sec("Button and landing page","Choose the Meta call to action button and where it goes.",teamField(a,"cta",0,a.ctaLine,"Call to action",null,editable,false));
  }else{
    if(editable)h+=assets?'<div class="drop"><div><h3>'+(a.type==="CAROUSEL"?"Upload carousel cards":"Upload creative")+'</h3><p class="small muted">'+(a.type==="CAROUSEL"?"Select up to 10 files at once, in card order. 1:1 works best for carousel cards. Each file becomes a card.":"JPG, PNG or MP4 up to 20 MB each. Select several at once, for example a 4:5 for feed and a 9:16 for Stories and Reels.")+'</p></div><span class="btn accent filebtn">'+(a.type==="CAROUSEL"?"Choose card files":"Choose files")+'<input type="file" accept="image/*,video/*" multiple id="creative-up" data-upload="creative" aria-label="Upload creative"></span></div>':'<p class="notice">You need edit access to this page to upload creative.</p>';
    h+=sec("Creative files",editable?"Set the ratio so each file shows in the right placement.":"Pull the ad back to change creative.",a.creatives.map(function(l,i){return teamField(a,"c",i,l,a.creatives.length>1?"Card "+(i+1):"Creative",null,editable,true);}).join(""));
  }
  return h;
}
function teamField(a,kind,i,l,label,limit,editable,area){
  var key=kind+i,n=l.text.length,count="",over=false;
  if(limit==="meta")count=n+" characters";else if(limit){count=n+"/"+limit;over=n>limit;}
  var stLabel=l.state==="ok"?"Looks good":(l.state==="reword"?"Needs change":"Not reviewed");
  var body="";
  if(kind==="cta"){
    body='<div class="grid2" style="grid-template-columns:200px minmax(0,1fr);gap:10px"><label class="f" for="ad-cta">Button<select class="in" id="ad-cta" data-adf="cta"'+(editable?"":" disabled")+'>'+CTAS.map(function(o){return '<option'+(a.cta===o?" selected":"")+'>'+o+'</option>';}).join("")+'</select></label><label class="f" for="ad-url">Landing page<input class="in" id="ad-url" data-adf="url" value="'+esc(a.url||"")+'"'+(editable?"":" disabled")+'></label></div>';
  }else if(kind==="c"){
    body='<div class="row" style="align-items:flex-start;gap:14px">'+(l.assetId?(l.isVideo?'<video class="thumb" style="aspect-ratio:'+(AR[l.ratio]||"4/5")+';height:auto" src="'+esc(blob(l.assetId))+'" muted controls></video>':'<img class="thumb" style="aspect-ratio:'+(AR[l.ratio]||"4/5")+';height:auto" src="'+esc(blob(l.assetId))+'" alt="'+esc(label)+'">'):'<div class="thumb">No file yet</div>')+'<div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px"><b class="small" style="word-break:break-all">'+esc(l.fileName)+'</b>'+(l.w&&l.h&&Math.abs(l.w/l.h-(l.ratio==="9:16"?0.5625:1))>0.03?'<span class="warn-t">This file is '+l.w+' × '+l.h+', not '+esc(l.ratio)+'. Meta will crop it. Export it at '+(l.ratio==="9:16"?"1080 × 1920":"1080 × 1080")+'.</span>':(l.w?'<span class="tiny muted">'+l.w+' × '+l.h+'</span>':""))+'<label class="f" for="ratio-'+i+'">Placement ratio<select class="in" id="ratio-'+i+'" data-ratio="'+i+'"'+(editable?"":" disabled")+'>'+(RATIOS.some(function(r){return r[0]===l.ratio;})?"":'<option value="'+esc(l.ratio)+'" selected>'+esc(l.ratio)+' · not used, choose 1:1 or 9:16</option>')+RATIOS.map(function(r){return '<option value="'+r[0]+'"'+(l.ratio===r[0]?" selected":"")+'>'+r[1]+'</option>';}).join("")+'</select></label>'+(a.type==="CAROUSEL"?'<label class="f" for="card-'+i+'">Card headline<input class="in" id="card-'+i+'" data-card="'+i+'" value="'+esc(l.cardHeadline||"")+'"'+(editable?"":" disabled")+'><span class="h">Shows under this card. Leave blank to use the ad headline.</span></label>':"")+'<label class="f" for="f-'+key+'">Notes for the client<textarea class="in" rows="2" id="f-'+key+'" data-line="'+kind+':'+i+'"'+(editable?"":" disabled")+'>'+esc(l.text)+'</textarea></label>'+(editable?'<button type="button" class="btn sm" style="align-self:flex-start" data-act="removeCreative" data-i="'+i+'">Remove</button>':"")+'</div></div>';
  }else if(editable){
    body=area?'<textarea class="in" rows="4" id="f-'+key+'" data-line="'+kind+':'+i+'" aria-label="'+esc(label)+'">'+esc(l.text)+'</textarea>':'<input class="in" id="f-'+key+'" data-line="'+kind+':'+i+'" value="'+esc(l.text)+'" aria-label="'+esc(label)+'">';
  }else body='<div class="txt">'+esc(l.text)+'</div>';
  var sent=a.status!=="draft";
  return '<div class="panel'+(lineHasIssue(l)?" warn":"")+'"><div class="lbl"><span>'+esc(label)+'</span><span class="row" style="gap:10px">'+(sent&&l.state!=="none"?'<span class="pill '+(l.state==="ok"?"ok":"rw")+'">Client: '+stLabel+'</span>':'')+'<span class="num" id="cnt-'+key+'" style="font-weight:400;color:'+(over?"var(--warn)":"var(--muted)")+'" data-limit="'+(limit||"")+'">'+count+'</span></span></div>'+body+
    (l.comments||[]).map(function(cm,ci){return commentHtml(cm,kind,i,ci,true);}).join("")+(!sent?"":(S.composer===key?composer(key,kind,i,"Reply on "+label.toLowerCase(),"Send reply"):((l.comments||[]).length?'<button type="button" class="btn sm" style="align-self:flex-start" data-act="compose" data-v="'+key+'">Reply to client</button>':"")))+'</div>';
}

/* ---------- actions ---------- */
function commentObj(text){return {id:uid("c"),by:(S.me&&S.me.id)||null,name:(S.me&&S.me.name)||"",role:S.mode==="client"?"client":"team",text:text,at:now(),resolved:false,resolvedByName:null};}
var ACT={
  mode:function(d){if(GDA.client)return;S.mode=d.v;S.composer=null;S.tab="copy";S.pin=null;if(d.v==="client"){if(!S.asClient||!S.clients[S.asClient])S.asClient=S.clientId||(clientList()[0]||{}).id;S.monthKey=null;S.folderId=null;S.cpage="overview";}render();},
  page:function(d){S.page=d.v;S.flash="";S.composer=null;if(d.v==="addClient")S.nc=null;render();},
  strat:function(d){S.strat=d.v;S.page="clients";S.flash="";render();},
  openClient:function(d){S.clientId=d.v;S.page="work";var ek=enabledKinds(S.clients[d.v]);S.kind=(ek[0]||{k:"meta"}).k;S.monthKey=null;S.folderId=null;S.adId=null;S.composer=null;render();},
  openSettings:function(d){S.clientId=d.v;S.page="settings";render();},
  openAd:function(d){S.clientId=d.c;S.page="work";var a=S.ads[d.v];S.kind=kindOf(a);if(S.kind==="meta")S.monthKey=a?a.monthKey:null;else S.folderId=a?a.folderId:null;S.adId=d.v;S.tab="copy";S.fileIdx=0;render();},
  dashKind:function(d){S.dashKind=d.v;render();},
  asClient:function(d){S.mode="client";S.pin=null;S.cpage=S.page==="work"?"ads":"overview";S.asClient=d.v;S.monthKey=S.page==="work"?S.monthKey:null;S.composer=null;render();},
  tmonth:function(d){S.page="work";S.kind="meta";S.monthKey=d.v;S.adId=null;S.composer=null;render();},
  cmonth:function(d){S.cpage="ads";S.kind="meta";S.monthKey=d.v;S.adId=null;S.composer=null;render();},
  addMonth:function(){var c=clone(S.clients[S.clientId]);var ms=monthsFor(c);var k=nextMonthKey(ms[0]);c.months=(c.months||[]).concat([k]);S.monthKey=k;S.page="work";saveClient(c);toast(monthLabel(k)+" added");},
  pickAd:function(d){if(S.adId!==d.v){S.reqChanges=null;S.fileIdx=0;S.pin=null;S.pinFocus=null;}S.adId=d.v;S.pIdx=0;S.hIdx=0;S.expanded=false;S.composer=null;S.confirmDelete=null;render();},
  addAd:function(){var c=S.clients[S.clientId];var id=uid("ad");var blank=function(n){var r=[];for(var i=0;i<n;i++)r.push(L(""));return r;};
    var a={id:id,clientId:c.id,monthKey:S.monthKey,order:adsFor(c.id,S.monthKey).length,group:"Campaign",type:"STATIC",stage:"",dest:"Instant Form",title:"New Ad",version:1,status:"draft",owner:c.strategist||"",cta:c.defaultCta||"Learn more",url:c.landing||"",internal:"",reminded:false,
      primaries:blank(5),headlines:blank(5),description:L(""),ctaLine:L(""),creatives:[{text:"",state:"none",comments:[],assetId:null,isVideo:false,fileName:"No file uploaded yet",ratio:"4:5"}],overall:[],note:"",sentAt:null,approvedBy:null,approvedAt:null,createdAt:now()};
    S.adId=id;S.tab="copy";saveAd(a);toast("Draft ad added");},
  tab:function(d){S.tab=d.v;S.composer=null;render();},
  toggleBatch:function(d){if(S.batch[d.v])delete S.batch[d.v];else S.batch[d.v]=1;render();},
  batchAll:function(){var c=S.clients[S.clientId];var ready=itemsIn(c.id,S.kind||"meta",curFolder()).filter(canSend);var all=ready.every(function(x){return S.batch[x.id];});S.batch={};if(!all)ready.forEach(function(x){S.batch[x.id]=1;});render();},
  sendBatch:function(){var c=S.clients[S.clientId];var ids=Object.keys(S.batch).filter(function(id){return S.ads[id]&&canSend(S.ads[id]);});if(!ids.length){toast("Select at least one ad.");return;}
    var noStage=ids.filter(function(id){return kindOf(S.ads[id])==="meta"&&!S.ads[id].stage;});if(noStage.length){toast(noStage.length+" ad"+(noStage.length>1?"s need":" needs")+" a stage before sending: "+noStage.map(function(id){return S.ads[id].title||"Untitled";}).join(", "));S.adId=noStage[0];render();return;}
    var bid=uid("b"),t=now();
    ids.forEach(function(id){var n=clone(S.ads[id]);if(n.status==="changes")n.version++;n.status="awaiting";n.sentAt=t;n.batchId=bid;n.reminded=false;n.note="Version "+n.version+". Ready for your review.";allLines(n).forEach(function(l){if(l.state==="reword")l.state="none";});saveAd(n);});
    var c2=clone(c);c2.batches=(c2.batches||[]).concat([{id:bid,at:t,kind:S.kind||"meta",folder:curFolder(),adIds:ids,by:(S.me&&S.me.name)||""}]);saveClient(c2);
    S.batch={};var kk=K(S.kind||"meta");toast(ids.length+" "+(ids.length>1?kk.units:kk.unit)+" sent to "+c.name+" as one batch");},
  cardApprove:function(d){S.adId=d.v;S.reqChanges=null;editAd(function(a){a.status="approved";a.approvedBy=(S.me&&S.me.id)||null;a.approvedAt=now();a.note="Version "+a.version+". Approved "+shortDate(a.approvedAt)+".";});toast("Ad approved. Gordon Digital has been notified.");},
  cardChanges:function(d){if(S.adId!==d.v){S.pIdx=0;S.hIdx=0;S.composer=null;}S.adId=d.v;S.reqChanges=d.v;render();var t=document.getElementById("c-odraft");if(t){t.focus();t.scrollIntoView({block:"center",behavior:"smooth"});}},
  submitChanges:function(d){S.adId=d.v;S.reqChanges=null;var n=newClientComments(S.ads[d.v]);editAd(function(a){a.status="changes";a.changesAt=now();a.note="Version "+a.version+". You sent "+n+" change"+(n>1?"s":"")+" on "+shortDate(now())+". Gordon Digital is updating it.";});toast("Changes sent to Gordon Digital");},
  cancelReq:function(){S.reqChanges=null;render();},
  postOverall:function(d){var t=String(S.odraft||"").trim();var changes=d.v==="changes";var a0=curAd();if(!a0)return;
    if(!t&&!changes){toast("Write a comment first.");return;}
    var cm=t?commentObj(t):null;S.odraft="";S.reqChanges=null;
    editAd(function(a){if(cm)a.overall=(a.overall||[]).concat([cm]);if(changes){a.status="changes";a.note="Version "+a.version+". You asked for changes on "+shortDate(now())+". Gordon Digital is updating it.";}});
    toast(changes?"Changes sent to Gordon Digital":"Comment posted");},
  tfolder:function(d){S.page="work";S.kind=d.k;if(d.k==="meta")S.monthKey=d.v;else S.folderId=d.v;S.adId=null;S.composer=null;S.fileIdx=0;render();},
  cfolder:function(d){S.cpage="ads";S.kind=d.k;if(d.k==="meta")S.monthKey=d.v;else S.folderId=d.v;S.adId=null;S.composer=null;S.fileIdx=0;S.pin=null;S.reqChanges=null;render();},
  goItem:function(d){var x=S.ads[d.v];if(!x)return;S.cpage="ads";S.kind=kindOf(x);if(S.kind==="meta")S.monthKey=x.monthKey;else S.folderId=x.folderId;S.adId=x.id;S.fileIdx=0;S.pin=null;render();},
  ovFilter:function(d){S.ovFilter=d.v;render();},
  goKind:function(d){var c=S.clients[S.asClient];var f=folderList(c,d.k).filter(function(f){return !f.archived&&itemsIn(c.id,d.k,f.id).some(function(x){return seen(x);});})[0];S.cpage="ads";S.kind=d.k;if(d.k==="meta")S.monthKey=f?f.id:null;else S.folderId=f?f.id:null;S.adId=null;render();},
  addFolder:function(d){var c=S.clients[S.clientId];if(d.k==="meta"){S.kind="meta";ACT.addMonth();return;}
    S.newFolder={k:d.k,name:(d.k==="social"||d.k==="seo")?nextPeriodName(c,"month",d.k):""};render();var t=document.getElementById("nf-name");if(t){t.focus();t.select();}},
  nfSuggest:function(d){S.newFolder.name=nextPeriodName(S.clients[S.clientId],d.v,S.newFolder.k);render();},
  nfCancel:function(){S.newFolder=null;render();},
  nfSave:function(){var nf=S.newFolder,nm=String(nf&&nf.name||"").trim();if(!nm){toast("Give it a name first.");return;}var c2=clone(S.clients[S.clientId]);c2.folders=c2.folders||{};var f={id:uid("f"),name:nm,archived:false,createdAt:now()};c2.folders[nf.k]=(c2.folders[nf.k]||[]).concat([f]);
    if(!c2.platforms)c2.platforms={};c2.platforms[nf.k]=true;S.newFolder=null;S.page="work";S.kind=nf.k;S.folderId=f.id;S.adId=null;saveClient(c2);toast(nm+" added");},
  toggleArch:function(d){S.showArch[d.k]=!S.showArch[d.k];render();},
  archiveFolder:function(d){var c=S.clients[S.clientId],k=S.kind||"meta",fid=curFolder();var open=itemsIn(c.id,k,fid).filter(function(x){return !isDone(x)&&x.status!=="archived";});
    if(open.length&&!(d&&d.force)){S.confirmFolderArch=fid;render();return;}
    S.confirmFolderArch=null;var c2=clone(c);if(k==="meta"){c2.archivedMonths=(c2.archivedMonths||[]).concat([fid]);}else{c2.folders[k].forEach(function(f){if(f.id===fid)f.archived=true;});}
    var nm=folderName(c,k,fid);if(k==="meta")S.monthKey=null;else S.folderId=null;S.adId=null;saveClient(c2);toast(nm+" archived. Find it under Archived in the sidebar.");},
  cancelFolderArch:function(){S.confirmFolderArch=null;render();},
  archiveItem:function(){S.confirmItemArch=S.adId;render();},
  cancelItemArch:function(){S.confirmItemArch=null;render();},
  confirmItemArch:function(){S.confirmItemArch=null;editAd(function(a){a.archivedFrom=a.status;a.status="archived";a.archivedAt=now();});toast("Archived. The client can't see it any more.");},
  restoreItem:function(){editAd(function(a){a.status=a.archivedFrom&&a.archivedFrom!=="archived"?a.archivedFrom:"draft";if(a.status==="awaiting")a.status="changes";delete a.archivedFrom;delete a.archivedAt;});toast("Restored. Check it, then send it in the next batch.");},
  unarchiveFolder:function(){var c=S.clients[S.clientId],k=S.kind||"meta",fid=curFolder();var c2=clone(c);if(k==="meta")c2.archivedMonths=(c2.archivedMonths||[]).filter(function(m){return m!==fid;});else c2.folders[k].forEach(function(f){if(f.id===fid)f.archived=false;});saveClient(c2);toast(folderName(c,k,fid)+" is back in the list");},
  removeFolder:function(){var c=S.clients[S.clientId],k=S.kind;if(itemsIn(c.id,k,S.folderId).length)return;var c2=clone(c);var nm=folderName(c,k,S.folderId);c2.folders[k]=c2.folders[k].filter(function(f){return f.id!==S.folderId;});S.folderId=null;saveClient(c2);toast(nm+" removed");},
  addItem:function(){var c=S.clients[S.clientId];var a=newItem(c,S.kind,S.folderId,itemsIn(c.id,S.kind,S.folderId).length);S.adId=a.id;S.fileIdx=0;saveAd(a);toast(K(S.kind).unit[0].toUpperCase()+K(S.kind).unit.slice(1)+" added");},
  removeFeatured:function(){editAd(function(a){delete a.featured;});toast("Featured image removed");},
  gShuffle:function(){S.gComb=(S.gComb||0)+1;render();},
  fileTab:function(d){S.fileIdx=+d.i;S.pin=null;S.pinFocus=null;render();},
  pinFocus:function(d){S.pinFocus=+d.ci;render();var el=document.getElementById("pc-"+d.ci);if(el)el.scrollIntoView({block:"center",behavior:"smooth"});},
  cancelPin:function(){S.pin=null;S.pdraft="";render();},
  postPin:function(){var t=String(S.pdraft||"").trim();if(!t){toast("Write a comment first.");return;}var pin=S.pin;if(!pin)return;var cm=commentObj(t);cm.x=pin.x;cm.y=pin.y;S.pin=null;S.pdraft="";editAd(function(a){var f=a.creatives[pin.i];f.comments=(f.comments||[]).concat([cm]);if(cm.role==="client"&&f.state==="none")f.state="reword";});toast("Comment added");},
  cpage:function(d){S.cpage=d.v;S.composer=null;render();},
  addColour:function(){var hex=normHex(S.bd.chex);if(!hex){toast("Enter a hex code, e.g. 001D21.");return;}var nm=(S.bd.cname||"").trim();editBrand(function(b){b.colours.push({name:nm,hex:hex});});S.bd.cname="";S.bd.chex="";toast(hex+" added");},
  addFont:function(){var nm=(S.bd.fname||"").trim();if(!nm){toast("Choose a Google font first.");return;}var match=GFONTS.filter(function(g){return g.toLowerCase()===nm.toLowerCase();})[0];var use=(S.bd.fuse||"").trim();editBrand(function(b){b.fonts.push({name:match||nm,use:use,source:"google"});});S.bd.fname="";S.bd.fuse="";toast((match||nm)+" added");},
  dlAsset:function(d){if(!downloads){toast("Downloads aren't available in this view.");return;}
    fetch(blob(d.id)).then(function(r){if(!r.ok)throw new Error("fetch");return r.blob();}).then(function(bl){return downloads.save({filename:d.name,data:bl});})
      .then(function(){toast("Saved");},function(er){var c=er&&er.code;if(c==="declined")return;toast(c==="rejected_extension"?"That file type can't be downloaded here. Ask Gordon Digital for a copy.":(c==="rate_limited"?"One download at a time. Try again in a moment.":"Couldn't download that file."));});},
  brandDel:function(d){editBrand(function(b){b[d.s].splice(+d.i,1);});toast("Removed");},
  copyHex:function(d){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(d.v).then(function(){toast(d.v.toUpperCase()+" copied");},function(){toast(d.v.toUpperCase());});}else toast(d.v.toUpperCase());},
  placement:function(d){S.placement=d.v;render();},
  "pv-p":function(d){S.pIdx=+d.i;render();},
  "pv-h":function(d){S.hIdx=+d.i;render();},
  more:function(){S.expanded=!S.expanded;render();},
  mark:function(d){editAd(function(a){var l=getLine(a,d.k,+d.i);l.state=l.state===d.v?"none":d.v;});},
  compose:function(d){S.composer=d.v;S.draft="";render();var t=document.getElementById("cmp-"+d.v);if(t)t.focus();},
  cancelCompose:function(){S.composer=null;S.draft="";render();},
  sendComment:function(d){var t=(S.draft||"").trim();if(!t){toast("Write a comment first.");return;}var cm=commentObj(t);S.composer=null;S.draft="";
    editAd(function(a){if(d.k==="o"){a.overall=(a.overall||[]).concat([cm]);}else{var l=getLine(a,d.k,+d.i);l.comments=(l.comments||[]).concat([cm]);if(cm.role==="client"&&l.state==="none")l.state="reword";}});
    S.composer=null;S.draft="";},
  resolve:function(d){var who=(S.me&&S.me.name)||"Gordon Digital";editAd(function(a){var list=d.k==="o"?a.overall:getLine(a,d.k,+d.i).comments;var c=list[+d.ci];c.resolved=true;c.resolvedByName=who;});},
  approve:function(){editAd(function(a){a.status="approved";a.approvedBy=(S.me&&S.me.id)||null;a.approvedAt=now();a.note="Version "+a.version+". Approved "+shortDate(a.approvedAt)+".";});toast("Ad approved. Gordon Digital has been notified.");},
  sendChanges:function(){editAd(function(a){a.status="changes";a.note="Version "+a.version+". You asked for changes on "+shortDate(now())+". Gordon Digital is updating it.";});toast("Changes sent to Gordon Digital");},
  sendToClient:function(){var a=curAd();if(!a)return;if(!a.stage){toast("Choose a stage before sending.");return;}
    editAd(function(n){if(n.status==="changes")n.version++;n.status="awaiting";n.sentAt=now();n.reminded=false;n.note="Version "+n.version+". Ready for your review.";allLines(n).forEach(function(l){if(l.state==="reword")l.state="none";});});toast("Sent to the client");},
  pullBack:function(){editAd(function(a){a.status="changes";});},
  remind:function(){var a=curAd();if(!a)return;if(!GDA.remind){toast("Reminders aren't available here.");return;}toast("Sending reminder…");GDA.remind(a.id).then(function(r){toast(r&&r.sentTo?"Reminder sent to "+r.sentTo:"Reminder sent");},function(e){toast((e&&e.message)||"Couldn't send the reminder");});},
  markLive:function(){editAd(function(a){a.status="live";a.note="Version "+a.version+". "+K(kindOf(a)).live+".";});toast("Marked as "+K(kindOf(curAd())).live.toLowerCase());},
  deleteDraft:function(){S.confirmDelete=S.adId;render();},
  cancelDelete:function(){S.confirmDelete=null;render();},
  confirmDelete:function(){var id=S.confirmDelete;S.confirmDelete=null;delete S.ads[id];S.adId=null;render();if(db)db.doc("ads/"+id).delete().then(function(){touchIndex("ads",id,{deleted:true,u:now()});}).catch(fail);toast("Draft deleted");},
  removeCreative:function(d){editAd(function(a){a.creatives.splice(+d.i,1);if(!a.creatives.length)a.creatives.push({text:"",state:"none",comments:[],assetId:null,isVideo:false,fileName:"No file uploaded yet",ratio:"4:5"});});},
  copyLink:function(){var c=S.clients[S.clientId];if(!c)return;if(!GDA.reviewLink){toast("Review links aren't available here.");return;}
    GDA.reviewLink(c.id).then(function(url){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url).then(function(){toast("Client link copied");},function(){toast(url);});}else toast(url);},function(e){toast((e&&e.message)||"Couldn't make a link");});},
  editStrat:function(d){var pr=person(d.v);S.editStrat=d.v;S.spDraft={name:d.v,title:pr.title||"",email:pr.email||"",phone:pr.phone||"",photoId:pr.photoId||null};render();},
  cancelStratEdit:function(){S.editStrat=null;S.spDraft=null;render();},
  saveStrat:function(){var old=S.editStrat,dr=S.spDraft||{},nm=String(dr.name||"").trim();if(!nm){toast("Name can't be empty.");return;}
    var list=strats().slice();if(nm!==old&&list.some(function(x){return x.toLowerCase()===nm.toLowerCase();})){toast(nm+" is already on the team.");return;}
    var pp=clone(people());delete pp[old];pp[nm]={title:String(dr.title||"").trim(),email:String(dr.email||"").trim(),phone:String(dr.phone||"").trim(),photoId:dr.photoId||null};
    list=list.map(function(x){return x===old?nm:x;});
    if(nm!==old){clientList().forEach(function(c){if(c.strategist===old){var c2=clone(c);c2.strategist=nm;saveClient(c2);}});Object.keys(S.ads).forEach(function(id){var a=S.ads[id];if(a.owner===old){var a2=clone(a);a2.owner=nm;saveAd(a2);}});if(S.strat===old)S.strat=nm;}
    S.editStrat=null;S.spDraft=null;saveTeam(list,pp);toast("Saved");},
  addStrat:function(){var n=(S.newStrat||"").trim();if(!n){toast("Type a name first.");return;}var l=strats().slice();if(l.some(function(x){return x.toLowerCase()===n.toLowerCase();})){toast(n+" is already on the team.");return;}l.push(n);S.newStrat="";saveTeam(l);toast(n+" added");},
  removeStrat:function(d){var l=strats().slice();var n=l.splice(+d.i,1)[0];var pp0=clone(people());delete pp0[n];S.team=S.team||{};S.team.people=pp0;if(S.strat===n)S.strat="All";saveTeam(l);toast(n+" removed. Their clients are now unassigned.");},
  removeMonth:function(){var c=S.clients[S.clientId],mk=S.monthKey;if(!c||!mk)return;var sent=adsFor(c.id,mk).filter(function(a){return a.status!=="draft";}).length;
    if(sent){toast(monthLabel(mk)+" has "+sent+" ad"+(sent>1?"s":"")+" the client has already seen, so it stays for the record.");return;}S.confirmMonth=mk;render();},
  cancelMonth:function(){S.confirmMonth=null;render();},
  confirmMonth:function(){var c=clone(S.clients[S.clientId]),mk=S.confirmMonth;S.confirmMonth=null;if(!c||!mk)return;
    adsFor(c.id,mk).forEach(function(a){delete S.ads[a.id];if(db)db.doc("ads/"+a.id).delete().then((function(id){return function(){touchIndex("ads",id,{deleted:true,u:now()});};})(a.id)).catch(fail);});
    c.months=(c.months||[]).filter(function(m){return m!==mk;});S.monthKey=null;S.adId=null;saveClient(c);toast(monthLabel(mk)+" removed");},
  createClient:function(){var nc=S.nc;if(!nc||!nc.name.trim()){toast("Add a client name first.");return;}
    var id=uid("cl");var mk=nextMonthKey(null);
    var c={id:id,name:nc.name.trim(),strategist:nc.strategist,website:nc.website.trim(),ig:nc.ig.trim().replace(/^@/,""),logoId:null,defaultCta:"Learn more",landing:nc.website?("https://"+nc.website.replace(/^https?:\/\//,"")):"",metaAccount:"",googleId:"",approverName:nc.approverName.trim(),approverEmail:nc.approverEmail.trim(),platforms:{meta:!!nc.meta,search:!!nc.search,landing:!!nc.landing,webpage:!!nc.webpage,seo:!!nc.seo,social:!!nc.social},months:nc.meta?[mk]:[],reminderDays:3,createdAt:now()};
    S.strat=nc.strategist;S.page="clients";S.flash=c.name+" added with "+monthLabel(mk)+" ready to build. Open approvals to add the first ads.";S.nc=null;saveClient(c);}
};
document.addEventListener("click",function(e){if(e.target.closest("label.bsel"))return;var pw=e.target.closest(".pin-wrap.live");if(pw&&!e.target.closest(".pin")){var im=pw.querySelector("img");var r=im.getBoundingClientRect();var x=Math.round((e.clientX-r.left)/r.width*1000)/10,y=Math.round((e.clientY-r.top)/r.height*1000)/10;if(x<0||y<0||x>100||y>100)return;S.pin={i:+pw.dataset.file,x:x,y:y};S.pdraft="";S.pinFocus=null;render();var pt=document.getElementById("pin-draft");if(pt)pt.focus();return;}var b=e.target.closest("[data-act]");if(!b)return;var fn=ACT[b.dataset.act];if(fn){e.preventDefault();fn(b.dataset,b);}});

document.addEventListener("input",function(e){var t=e.target;
  if(t.dataset.draft){S.draft=t.value;return;}
  if(t.dataset.spd){if(S.spDraft)S.spDraft[t.dataset.spd]=t.value;return;}
  if(t.dataset.nf){if(S.newFolder)S.newFolder.name=t.value;return;}
  if(t.dataset.pdraft){S.pdraft=t.value;return;}
  if(t.dataset.odraft){S.odraft=t.value;var pb=document.getElementById("c-post");if(pb&&pb.dataset.v!=="changes")pb.disabled=!t.value.trim();else if(pb&&t.value.trim())pb.disabled=false;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,200)+"px";return;}
  if(t.dataset.bd){S.bd[t.dataset.bd]=t.value;if(t.dataset.bd==="chex"){var sw=document.getElementById("hex-sw");if(sw)sw.style.background=normHex(t.value)||"transparent";}return;}
  if(t.dataset.newstrat){S.newStrat=t.value;return;}
  if(t.dataset.nc){S.nc[t.dataset.nc]=t.value;var hint=document.getElementById("nc-hint");if(hint)hint.textContent=S.nc.name.trim()?"":"Add a client name to create the folder.";return;}
  if(t.dataset.line){var p=t.dataset.line.split(":"),cnt=document.getElementById("cnt-"+p[0]+p[1]);if(cnt){var lim=+cnt.dataset.limit;cnt.textContent=lim?t.value.length+"/"+lim:t.value.length+" characters";cnt.style.color=lim&&t.value.length>lim?"var(--warn)":"var(--muted)";}return;}
  if(t.dataset.adf==="title"||t.dataset.adf==="stage"||t.dataset.adf==="type"){var a=curAd();if(a){var tmp=clone(a);tmp[t.dataset.adf]=t.value;var nm=document.getElementById("ad-name");if(nm)nm.textContent=nameOf(tmp);}}
});
document.addEventListener("change",function(e){var t=e.target;
  if(t.dataset.placement){S.placement=t.value;render();return;}
  if(t.dataset.dashstrat){S.dashStrat=t.value;render();return;}
  if(t.dataset.splatview){S.splat=t.value;render();return;}
  if(t.dataset.splat){var pn=t.dataset.splat,on=t.checked;editAd(function(a){var l=(a.platforms||[]).filter(function(x){return x!==pn;});if(on)l.push(pn);a.platforms=SOCIAL_PLATFORMS.filter(function(x){return l.indexOf(x)>=0;});});return;}
  if(t.dataset.falt){var av=t.value;editAd(function(a){if(a.featured)a.featured.alt=av;});return;}
  if(t.dataset.clabel){var li=+t.dataset.clabel,lv=t.value;editAd(function(a){a.creatives[li].label=lv;});return;}
  if(t.dataset.seobody){var bv=t.value;editAd(function(a){a.body=bv;a.paras=rebuildParas(a.paras,bv);});return;}
  if(t.dataset.plat){var pk=t.dataset.plat,pc=t.checked;var cp=clone(S.clients[S.clientId]);cp.platforms=cp.platforms||{};cp.platforms[pk]=pc;saveClient(cp);return;}
  if(t.dataset.batch){if(t.checked)S.batch[t.dataset.batch]=1;else delete S.batch[t.dataset.batch];render();return;}
  if(t.dataset.bd){S.bd[t.dataset.bd]=t.value;return;}
  if(t.dataset.brandpick){S.asClient=t.value;S.cpage="overview";S.monthKey=null;S.adId=null;render();return;}
  if(t.id==="as-client"){S.asClient=t.value;S.cpage="overview";S.folderId=null;S.monthKey=null;S.adId=null;render();return;}
  if(t.dataset.nc){S.nc[t.dataset.nc]=t.value;return;}
  if(t.dataset.ncc){S.nc[t.dataset.ncc]=t.checked;return;}
  if(t.dataset.line){var p=t.dataset.line.split(":");editAd(function(a){getLine(a,p[0],+p[1]).text=t.value;});return;}
  if(t.dataset.adf){var k=t.dataset.adf,v=t.value;editAd(function(a){a[k]=v;if(k==="contentType"&&v===GBP&&!a.gbpText){a.gbpText=L("");a.gbpType=a.gbpType||"Update";a.gbpCta=a.gbpCta||"Learn more";}});return;}
  if(t.dataset.card){var ci=+t.dataset.card,cv=t.value;editAd(function(a){a.creatives[ci].cardHeadline=cv;});return;}
  if(t.dataset.ratio){var i=+t.dataset.ratio,v2=t.value;editAd(function(a){a.creatives[i].ratio=v2;});return;}
  if(t.dataset.bnotes){var nv=t.value;editBrand(function(b){b.notes=nv;});return;}
  if(t.dataset.cf){var c=clone(S.clients[S.clientId]);c[t.dataset.cf]=t.dataset.cf==="reminderDays"?Math.max(1,parseInt(t.value,10)||3):(t.dataset.cf==="ig"?t.value.replace(/^@/,""):t.value);saveClient(c);return;}
  if(t.dataset.upload){var files=Array.prototype.slice.call(t.files||[]);if(!files.length||!assets)return;var kind=t.dataset.upload;t.value="";
    if(kind==="font"){var ff=files[0];toast("Uploading "+ff.name+"…");assets.upload(ff).then(function(r){var base=ff.name.replace(/\.[^.]+$/,"").replace(/[-_]+/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").trim();var use=(S.bd.fuse||"").trim();editBrand(function(b){b.fonts.push({name:base,use:use,source:"upload",assetId:r.id,fileName:ff.name});});S.bd.fuse="";toast(base+" added");},uploadErr);return;}
    if(kind.indexOf("brand:")===0){var sec=kind.slice(6),bn=0,bt=files.length;
      files.reduce(function(chain,f){return chain.then(function(){toast("Uploading "+(++bn)+" of "+bt+": "+f.name+"…");return assets.upload(f).then(function(r){var vid=(r.contentType||f.type||"").indexOf("video")===0;editBrand(function(b){b[sec].push({assetId:r.id,name:f.name,type:r.contentType||f.type||"",isVideo:vid,at:now(),by:(S.me&&S.me.name)||""});});},uploadErr);});},Promise.resolve()).then(function(){toast(bt>1?bt+" files added":files[0].name+" added");});return;}
    if(kind==="sphoto"){var sf=files[0];toast("Uploading "+sf.name+"…");assets.upload(sf,{team:true}).then(function(r){if(S.spDraft)S.spDraft.photoId=r.id;render();toast("Photo added. Press Save to keep it.");},uploadErr);return;}
    if(kind==="feature"){var fz=files[0];toast("Uploading "+fz.name+"…");Promise.all([assets.upload(fz),measure(fz)]).then(function(res){var r=res[0],dm=res[1];editAd(function(a){var old=a.featured||{};a.featured={text:"",state:"none",comments:[],assetId:r.id,fileName:fz.name,type:r.contentType||fz.type||"",w:dm?dm.w:null,h:dm?dm.h:null,alt:old.alt||""};});toast("Image added");},uploadErr);return;}
    if(kind==="kfile"){var ka=curAd();if(ka&&kindOf(ka)==="social"){var kh=(ka.creatives||[]).length;if(kh+files.length>20){toast("Carousels take up to 20 slides. Only the first "+Math.max(0,20-kh)+" will be added.");files=files.slice(0,Math.max(0,20-kh));if(!files.length)return;}}var kn=0,kt=files.length;
      files.reduce(function(chain,f){return chain.then(function(){toast("Uploading "+(++kn)+" of "+kt+": "+f.name+"…");return Promise.all([assets.upload(f),measure(f)]).then(function(res){var r=res[0],dm=res[1];var vid=(r.contentType||f.type||"").indexOf("video")===0;
        editAd(function(a){a.creatives=(a.creatives||[]).concat([{text:"",state:"none",comments:[],assetId:r.id,isVideo:vid,type:r.contentType||f.type||"",fileName:f.name,label:"",w:dm?dm.w:null,h:dm?dm.h:null}]);});},uploadErr);});},Promise.resolve()).then(function(){toast(kt>1?kt+" files uploaded":files[0].name+" uploaded");});return;}
    if(kind==="logo"){var f0=files[0];toast("Uploading "+f0.name+"…");assets.upload(f0).then(function(r){var c2=clone(S.clients[S.clientId]);c2.logoId=r.id;saveClient(c2);toast("Logo updated");},uploadErr);return;}
    var ad0=curAd();if(ad0&&ad0.type==="CAROUSEL"){var have=ad0.creatives.filter(function(c){return c.assetId;}).length;if(have+files.length>10){toast("Carousels take up to 10 cards. Only the first "+Math.max(0,10-have)+" will be added.");files=files.slice(0,Math.max(0,10-have));}}
    var n=0,total=files.length;
    files.reduce(function(chain,f){return chain.then(function(){toast("Uploading "+(++n)+" of "+total+": "+f.name+"…");
      return Promise.all([assets.upload(f),measure(f)]).then(function(res){var r=res[0],dims=res[1];var vid=(r.contentType||f.type||"").indexOf("video")===0;
        editAd(function(a){var item={assetId:r.id,isVideo:vid,fileName:f.name,ratio:a.type==="CAROUSEL"?"1:1":(dims?closestRatio(dims.w,dims.h):"1:1"),w:dims?dims.w:null,h:dims?dims.h:null};var slot=-1;for(var i=0;i<a.creatives.length;i++){if(!a.creatives[i].assetId){slot=i;break;}}
          if(slot>=0){Object.assign(a.creatives[slot],item);a.creatives[slot].state="none";}else a.creatives.push(Object.assign({text:"",state:"none",comments:[],cardHeadline:""},item));});
      },uploadErr);});},Promise.resolve()).then(function(){toast(total>1?total+" files uploaded":files[0].name+" uploaded");});
  }
});

/* ---------- boot ---------- */
var perms=null,loadTries=0;
function uploadErr(err){if(err&&err.code==="video_needs_edit"){toast("Videos need edit access to this page. Images work for everyone.");return;}console.warn("upload failed",err);toast(err&&err.code==="too_large"?"That file is over 20 MB. Export a smaller version and try again.":(err&&err.code==="unsupported_type"?"That file type isn't supported. Use JPG, PNG or MP4.":"Upload failed"+(err&&(err.code||err.message)?" ("+(err.code||err.message)+")":"")+". Try again, and tell Claude the code in brackets if it keeps happening."));}
function closestRatio(w,h){var r=w/h,best="1:1",d=9;[["1:1",1],["9:16",0.5625]].forEach(function(x){var dd=Math.abs(Math.log(r/x[1]));if(dd<d){d=dd;best=x[0];}});return best;}
function measure(f){return new Promise(function(res){var url;try{url=URL.createObjectURL(f);}catch(e){res(null);return;}
  var done=function(w,h){try{URL.revokeObjectURL(url);}catch(e){}res(w&&h?{w:w,h:h}:null);};
  if((f.type||"").indexOf("video")===0){var v=document.createElement("video");v.preload="metadata";v.onloadedmetadata=function(){done(v.videoWidth,v.videoHeight);};v.onerror=function(){done();};v.src=url;}
  else{var i=new Image();i.onload=function(){done(i.naturalWidth,i.naturalHeight);};i.onerror=function(){done();};i.src=url;}
  setTimeout(function(){done();},8000);});}
function showLoadError(e){var m=document.getElementById("main");if(!m)return;
  var detail=esc((e&&(e.code?e.code+": ":"")+(e.message||""))||"Unknown error");
  m.innerHTML='<div class="empty"><h2>The approvals data didn\'t load</h2><p class="muted" style="margin-top:8px">'+detail+'</p><p class="small muted" id="perm-state" style="margin-top:8px"></p><p class="small muted" id="probe"></p><div class="row" style="justify-content:center;margin-top:16px"><button type="button" class="btn go" data-act="retryLoad">Allow access and try again</button></div></div>';
  if(db){var t0=Date.now();var done=false;var pr=document.getElementById("perm-state");try{db.doc("index/main").get().then(function(s){done=true;var el=document.getElementById("probe");if(el)el.textContent="Single read: "+(s.exists?"ok":"empty")+" in "+(Date.now()-t0)+"ms";},function(er){done=true;var el=document.getElementById("probe");if(el)el.textContent="Single read failed: "+(er&&(er.code||er.message));});}catch(er){}
    setTimeout(function(){var el=document.getElementById("probe");if(el&&!done)el.textContent="Single read: no answer after 8s";},8000);}
  if(perms)perms.state().then(function(st){var el=document.getElementById("perm-state");if(el)el.textContent="Page permissions: "+Object.keys(st).map(function(k){return k+" "+st[k];}).join(", ");}).catch(function(){});
}
var known={clients:{},ads:{}},unsubs=[],pollT=null,lastIx="";
function applyIndex(ix){
  ix=ix||{};var key=JSON.stringify(ix);if(key===lastIx&&S.loadedA)return;lastIx=key;
  var jobs=[];
  ["clients","ads"].forEach(function(kind){var map=ix[kind]||{};Object.keys(map).forEach(function(id){var e=map[id]||{};
    if(e.deleted){if(S[kind][id]){delete S[kind][id];}known[kind][id]=e.u;return;}
    if(known[kind][id]===e.u&&S[kind][id])return;known[kind][id]=e.u;
    jobs.push(db.doc(kind+"/"+id).get().then(function(snap){if(snap.exists){var v=clone(snap.data());v.id=id;S[kind][id]=v;}}));});});
  Promise.all(jobs).then(function(){S.loadedA=true;S.loadedC=true;
    if(!S.clientId||!S.clients[S.clientId]){var f=clientList()[0];S.clientId=f?f.id:null;}if(GDA.client){S.asClient=GDA.client;S.clientId=GDA.client;}else if(!S.asClient||!S.clients[S.asClient])S.asClient=S.clientId;schedule();},function(err){showLoadError(err);});
}
function readIndex(){return db.doc("index/main").get().then(function(snap){applyIndex(snap.exists?snap.data():{});});}
function readTeam(){return db.doc("settings/team").get().then(function(snap){S.team=snap.exists?clone(snap.data()):null;schedule();}).catch(function(){});}
function load(){
  if(!db)return;loadTries++;var tryNo=loadTries;
  unsubs.forEach(function(u){try{u();}catch(e){}});unsubs=[];clearInterval(pollT);
  readIndex().catch(function(err){showLoadError(err);});readTeam();
  try{unsubs.push(db.doc("index/main").onSnapshot(function(snap){applyIndex(snap.exists?snap.data():{});},function(err){console.warn("live index",err);}));}catch(err){}
  try{unsubs.push(db.doc("settings/team").onSnapshot(function(snap){S.team=snap.exists?clone(snap.data()):null;schedule();},function(){}));}catch(err){}
  pollT=setInterval(function(){if(!document.hidden){readIndex().catch(function(){});readTeam();}},15000);
  setTimeout(function(){if(tryNo===loadTries&&!S.loadedA)showLoadError({message:"The database hasn't answered yet. Try again in a moment."});},12000);
}
ACT.retryLoad=function(){var m=document.getElementById("main");m.innerHTML='<div class="empty">Loading approvals…</div>';
  var go=function(){load();};if(perms&&perms.request)perms.request(["db","assets","user"]).then(go,go);else go();};
function boot(){
  GDA.currentClient=function(){return S.mode==="client"?S.asClient:S.clientId;};
  if(GDA.client){S.mode="client";S.asClient=GDA.client;S.clientId=GDA.client;S.cpage="overview";document.body.classList.add("gda-client");}
  if(!window.claude||!window.claude.use){S.noDb=true;render();return;}
  window.claude.use("permissions").then(function(p){perms=p;}).catch(function(){});
  window.claude.use("db").then(function(d){db=d;if(!d){S.noDb=true;render();return;}load();},function(e){showLoadError(e);});
  assets=wrapAssets(null);window.claude.use("assets").then(function(a){assets=wrapAssets(a);schedule();},function(){});
  window.claude.use("downloads").then(function(x){downloads=x;}).catch(function(){});
  window.claude.use("user").then(function(u){user=u;if(u)u.me().then(function(m){S.me=m;schedule();});});
  setTimeout(function(){if(!db&&!S.noDb){S.noDb=true;render();}},11000);
}
GDA.reload=function(){lastIx="";known={clients:{},ads:{}};readIndex().catch(function(){});};GDA.toast=toast;
render();boot();
})();
