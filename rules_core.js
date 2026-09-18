/* ------------------------------------------------------------------
   Verb Cribbage, the rules.

   Everything between the markers below is lifted verbatim from the
   single-player game, so the two can never drift apart. Do not edit it
   by hand: re-run the extractor against the game instead.
   ------------------------------------------------------------------ */
const DECK = require("./deck.json");

/* the deck, as data the extracted code expects */
const MORPH = DECK.suits, ENGLISH = DECK.english, PERSON = DECK.person, VALENCY = DECK.valency;
const PIP = {spades:"\u2660", hearts:"\u2665", clubs:"\u2663", diamonds:"\u2666"};
const RED = {hearts:1, diamonds:1};

/* ---- BEGIN extracted from the game ---- */
const IRREGULAR_ING={ have:"having", go:"going", be:"being" };
function gerund(v){
  if(IRREGULAR_ING[v]) return IRREGULAR_ING[v];
  if(/[^aeiou]e$/.test(v)) return v.slice(0,-1)+"ing";          // make -> making
  if(/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v)) return v+v.slice(-1)+"ing";  // cut -> cutting
  return v+"ing";
}
const COPULA  = {"1sg":"am","2sg":"are","3sg":"is","1pl":"are","2pl":"are","3pl":"are"};
const IRREGULAR_3SG = {have:"has", go:"goes", do:"does"};
function thirdSg(v){
  if(IRREGULAR_3SG[v]) return IRREGULAR_3SG[v];
  if(/(s|sh|ch|x|z|o)$/.test(v)) return v+"es";
  if(/[^aeiou]y$/.test(v))       return v.slice(0,-1)+"ies";
  return v+"s";
}
const ADJECTIVE = new Set(["silly","white"]);
const ZERO = "\u2205";
function pickAlternate(text){
  const alts = text.split("/").map(t=>t.trim());
  if(alts.length < 2) return {form:text, chose:false};
  const first = alts[0] === ZERO ? "" : alts[0];
  return {form:first, chose:true};
}
function wordPiece(card, next){
  const sf = surfaceOf(card, next);
  const alt = pickAlternate(sf.text);
  return {form: alt.form.replace(/-/g,""), elided: sf.elided, chose: alt.chose};
}
function objectSurface(card, cards){
  if(card.morph!=="w(\u00eb)") return card.morph;
  const by={}; cards.forEach(c=>{ const r=roleOf(c); (by[r]=by[r]||[]).push(c); });
  const subj=(by.subject||[])[0];
  const third = subj && personOf(subj)==="3sg";
  return third ? "y(\u00eb)" : card.morph;
}
function objMorph(card, cards){
  return card.role==="object" ? objectSurface(card, cards) : card.morph;
}
const unitMorph = u => u ? (u.fused || u.card.morph) : null;
const FUSION = { "h(ë)|y(ë)": "hiy(ë)" };
const NULL_OBJ="y(ë)";
const nounIsObject = cards => nounRoles(cards).obj.length>0;
const PERSON_LABEL = {"1":"1sg","2":"2sg","3":"3sg","1p":"1pl","2p":"2pl","3p":"3pl"};
const TRANSITIVE = {
  spades   : {2:true,3:true,4:false,5:false,6:false,7:true},
  hearts   : {2:true,3:true,4:true,5:true,6:true,7:true},
  clubs    : {2:false,3:true,4:false,5:true,6:true,7:true},
  diamonds : {2:false,3:false,4:false,5:false,6:false,7:false}
};
function nullObject(cards){
  const by={}; cards.forEach(c=>{ const r=roleOf(c); (by[r]=by[r]||[]).push(c); });
  const stem=(by.stem||[])[0], subj=(by.subject||[])[0];
  const nounCards = by.noun||[];
  if(!stem || !subj) return null;
  if(valencyOf(stem)!==true) return null;      // intransitive: no object at all
  if((by.object||[]).length) return null;      // an overt object is already there
  /* The null object surfaces as y(\u00eb) for a 3rd person subject, singular or plural.
     1pl marks its subject in slot 7 with tr\u02bc(\u00eb), and there it stays silent, the
     same as it does for 1sg and 2sg. */
  const thirdPerson = personOf(subj)==="3sg" && !(by.deictic||[]).length;
  return { covert:true, surfaces: thirdPerson && !nounIsObject(cards) };
}
function writtenSeq(cards){
  const no=nullObject(cards);
  if(!no || !no.surfaces) return ordered(cards);
  const stem=cards.find(c=>roleOf(c)==="stem");
  return ordered(cards.concat([{ id:-1, role:"object", morph:NULL_OBJ, rank:1,
    suit:stem.suit, pip:"", colour:"k", synthetic:true }]));
}
function fuseUnits(seq){
  const out=[];
  for(let i=0;i<seq.length;i++){
    const a=seq[i], b=seq[i+1];
    const key = b ? a.morph+"|"+b.morph : null;
    if(key && FUSION[key]){
      out.push({fused:FUSION[key], parts:[a,b], lead:a});
      i++;
    } else out.push({card:a, lead:a});
  }
  return out;
}
function checkRoles(cards, map){
  const prev=RM; RM=map;
  try { return legalityCore(cards).ok; } finally { RM=prev; }
}
const SUITS={
 spades:{pip:"\u2660",colour:"k",morphemes:
  ["sh\u00ebk","\u02bc\u00e0l","d\u0105y\u02bc","dleyy","tr\u0105\u0300\u02bc","tr\u00f6\u00f6","t\u02bc\u00e4\u0300","ih","\u012f / in","\u00eb / \u2205","\u00e4h","\u00eb / \u2205","h(\u00eb)"]},
 hearts:{pip:"\u2665",colour:"r",morphemes:
  ["\u0142\u00e4\u0302","tseyy","b\u00ebrr","t\u02bc\u00ebr","g\u0105yy","k\u02bc\u00e4nn","tr\u00e4ww","\u00ebk","\u0105\u0308h","oh","\u00e4h","tr\u02bc(\u00eb)","oh"]},
 clubs:{pip:"\u2663",colour:"k",morphemes:
  ["k\u01d2","haa","n\u0105\u0105","tl'it","zreyy","d\u00e8y","chiw","ish","\u012f / in","i / d\u00eb","\u00e4h / \u00e4d\u00eb","tr\u02bc(\u00eb)","h(\u00eb)"]},
 diamonds:{pip:"\u2666",colour:"r",morphemes:
  ["sh(\u00eb)","gayy","dlat","koo","t\u00f2rr","dorr","k\u02bc\u00e4\u0300ww","eyy","\u00e4n / \u0105\u0308","o","\u00e4","tr\u02bc(\u00eb)","h(\u00eb)"]}
};
function altRoles(c){
  const r=defaultRole(c), out=[];
  const shares=(rank,role)=>SUIT_ORDER.some(su=>roleAt(su,rank)===role && morphOf(su,rank)===c.morph);
  if(r==="deictic" || r==="plural"){
    if(shares(10,"subject")) out.push("subject");
  }
  if(r==="subject" && c.rank===10){
    if(shares(12,"deictic")) out.push("deictic");
    if(shares(13,"plural"))  out.push("plural");
  }
  return out;
}
const defaultRole = c => roleAt(c.suit, c.rank);
const SUIT_ORDER=["spades","hearts","clubs","diamonds"];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const CLASSIFIER={spades:"\u2205", hearts:"\u0142", clubs:"d", diamonds:"l"};
const VOWELS = "aeiou";
const ORDER = {noun:200, adverb:100, plural:9, object:8, deictic:7, subject:1, stem:0, negative:-100};
const ROLE = {
  // rank -> role. Aces are suit-dependent, handled in roleOf().
  2:"stem",3:"stem",4:"stem",5:"stem",6:"stem",7:"stem",
  8:"subject",9:"subject",10:"subject",11:"subject",   // all of slot 1
  12:"deictic",                                        // slot 7 — 1st person plural
  13:"plural"                                          // slot 9 — 3rd person plural
};
const ACE = {spades:"adverb", hearts:"adverb", clubs:"negative", diamonds:"object"};
const ROLE_OVERRIDE = { spades:{12:"subject"}, hearts:{13:"subject"} };
const ROLENAME = {noun:"noun", adverb:"adverb", plural:"plural subject", object:"object",
  deictic:"deictic subject", subject:"subject", stem:"stem", negative:"negative"};
const SLOTLABEL = {noun:"noun", adverb:"adv", plural:"9", object:"8", deictic:"7", subject:"1", stem:"0", negative:"neg"};
const OBJ_PERSON = {"sh(\u00eb)":"1sg","n(\u00eb)":"2sg","w(\u00eb)":"3sg",
                   "n\u00ebkwh(\u00eb)":"2pl","ni(h\u00eb)":"1pl","hu(w\u00eb)":"3pl"};
const objPersonOf = c => c.objPerson || OBJ_PERSON[c.morph] || null;
const SINGULAR_ONLY = {"haa":1};
const ADJ_STEM = {"k\u02bc\u00e4\u0300ww":"white"};
const isAdjStem = c => !!ADJ_STEM[c.morph];
function adjectiveOf(cards){
  const stems=cards.filter(c=>roleOf(c)==="stem");
  if(stems.length<2) return null;
  const adj=stems.find(isAdjStem);
  const main=stems.find(c=>!isAdjStem(c));
  if(!adj || !main) return null;
  if(!cards.some(c=>roleOf(c)==="noun")) return null;
  return {adj, main};
}
const INVERTED = {"hu(w\u00eb)":1};
let RM = null;
function resolveRoles(cards){
  const options=cards.map(c=>[defaultRole(c), ...altRoles(c)]);
  let fallback=null;
  const walk=(i, map)=>{
    if(i===cards.length){
      if(!fallback) fallback=Object.assign({},map);
      return checkRoles(cards, map) ? Object.assign({},map) : null;
    }
    for(const r of options[i]){
      map[cards[i].id]=r;
      const got=walk(i+1, map);
      if(got) return got;
    }
    delete map[cards[i].id];
    return null;
  };
  return walk(0, {}) || fallback || {};
}
function withRoles(cards, fn){
  const prev=RM;
  RM=resolveRoles(cards);
  try { return fn(); } finally { RM=prev; }
}
function buildWordCore(cards){
  const units = fuseUnits(writtenSeq(cards));
  const pre=[], stemWord=[], post=[];
  units.forEach((u,i)=>{
    const r = roleOf(u.lead);
    const nm = unitMorph(units[i+1]);
    const src = u.fused ? {morph:u.fused} : {morph:objMorph(u.card, cards), rank:u.card.rank};
    let form = wordPiece(src, nm ? {morph:nm} : null).form;
    form = form.replace(/-/g,"");
    if(r === "noun" || r === "adverb") pre.push(form);
    else if(r === "negative") post.push(form);
    else                      stemWord.push(form);
  });
  return {pre:pre.join(" "), word:stemWord.join(""), post:post.join(" ")};
}
function englishCore(cards){
  const by={};
  cards.forEach(c=>{ const r=roleOf(c); (by[r]=by[r]||[]).push(c); });
  const adjPair=adjectiveOf(cards);
  const stem=adjPair ? adjPair.main : (by.stem||[])[0];
  const subj=(by.subject||[])[0];
  const nounCards = by.noun||[];
  if(!stem || !subj) return "";
  const base=englishOf(stem);
  if(!base) return "";
  const person = personOf(subj) || "3sg";
  /* slots 7 and 9 override the person the slot-1 card carries */
  const pl=(by.deictic||[])[0]||(by.plural||[])[0];
  const p = pl ? (personOf(pl)||person) : person;
  /* a noun in the hand is what the verb is about, so it stands in for the pronoun */
  const plural = (p==="3pl"||p==="1pl"||p==="2pl");
  const third  = (p==="3sg"||p==="3pl");
  const nr = nounRoles(cards);
  const useSubjNouns = nr.subj.length && third;
  /* the colour word sits in front of whatever noun it leans on */
  const adjWord = adjPair ? ADJ_STEM[adjPair.adj.morph] : null;
  const dressed = c => {
    const w=nounForm(c.morph, p==="3pl");
    if(!adjWord) return w;
    return w.replace(/^(the|a|an) /, (m,art)=>art+" "+adjWord+" ")
            .replace(/^(?!(the|a|an) )/, adjWord+" ");
  };
  const subjectPhrase = useSubjNouns
    ? nr.subj.map(dressed).join(" and ")
    : (PRONOUN[p] || p);
  const pron = subjectPhrase;
  /* "the wolf" takes a singular verb even when the Han subject is plural */
  /* two subjects always take a plural verb; one does when the H\u00e4n subject is
     plural and the noun is not a mass noun */
  const agreeAs = useSubjNouns
    ? ((nr.subj.length>1 || (p==="3pl" && nr.subj.some(c=>!nounMass(c.morph)))) ? "3pl" : "3sg")
    : p;
  const negated = !!(by.negative||[]).length;
  const adverb = (by.adverb||[]).map(englishOf).filter(Boolean).join(" ");
  let object = (by.object||[]).map(c=>c.gloss||englishOf(c)).filter(Boolean).join(" ");
  const no = nullObject(cards);
  if(!object && nr.obj.length) object = nr.obj.map(c=>nounObj(c.morph)).join(" and ");
  else if(!object && no) object="it";

  const isCopular = base.startsWith("be ") || ADJECTIVE.has(base);
  const complement = base.startsWith("be ") ? base.slice(3) : base;
  let parts=[pron];
  if(isCopular){
    parts.push(COPULA[agreeAs]||"is");
    if(negated) parts.push("not");
    if(adverb) parts.push(adverb);
    parts.push(complement);
  } else if(negated){
    parts.push(COPULA[agreeAs]||"is", "not");
    if(adverb) parts.push(adverb);
    parts.push(gerund(base));
  } else {
    if(adverb) parts.push(adverb);
    parts.push(agreeAs==="3sg" ? thirdSg(base) : base);
  }
  if(object) parts.push(object);
  const out=parts.join(" ");
  return out.charAt(0).toUpperCase()+out.slice(1);
}
function firstAlternate(m){ return m.split("/")[0].trim(); }
function startsWithVowel(m){
  const t = firstAlternate(m).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return VOWELS.indexOf(t.charAt(0).toLowerCase()) >= 0;
}
function surfaceOf(card, next){
  const m = card.morph;
  const paren = m.match(/^(.*)\(([^)]+)\)(.*)$/);
  if(!paren) return {text:m, elided:false};
  const [, head, vowel, tail] = paren;
  if(!next) return {text:m, elided:false};              // nothing follows yet: citation form
  const vowelNext = startsWithVowel(next.morph);
  if(INVERTED[m])                                      // hu(w\u00eb) works the other way round
    return vowelNext ? {text:head+vowel+tail, elided:false} : {text:head+tail, elided:true};
  if(vowelNext) return {text:head+tail, elided:true};
  return {text:head+vowel+tail, elided:false};
}
function roleAt(suit, rank){
  if(rank===1) return ACE[suit];
  return (ROLE_OVERRIDE[suit]||{})[rank] || ROLE[rank];
}
const roleOf = c => c.role || (RM && RM[c.id]) || defaultRole(c);
const morphOf=(s,r)=>SUITS[s].morphemes[r-1];
const englishOf = c => c.gloss || (ENGLISH[c.suit]||[])[c.rank-1] || null;
const personOf  = c => { if(c.extra) return null; const p=(PERSON[c.suit]||[])[c.rank-1]; return p?PERSON_LABEL[p]||p:null; };
const valencyOf = c => (TRANSITIVE[c.suit]||{})[c.rank];
function isGeneralForm(c){
  return SUIT_ORDER.filter(su=>morphOf(su,c.rank)===c.morph).length>1;
}
function carriesClass(c, role){
  if(role==="stem" || role==="subject") return true;
  if(role==="deictic" || role==="plural") return !isGeneralForm(c);
  return false;
}
function compatible(card, stemSuit){
  return card.suit === stemSuit || card.morph === morphOf(stemSuit, card.rank);
}
function nounRoles(cards){
  const by={}; cards.forEach(c=>{ const r=roleOf(c); (by[r]=by[r]||[]).push(c); });
  const nouns=by.noun||[], stem=(by.stem||[])[0];
  if(!nouns.length) return {subj:[], obj:[]};
  const transitive = stem && valencyOf(stem)===true;
  if(!transitive) return {subj:nouns, obj:[]};
  if((by.object||[]).length) return {subj:nouns, obj:[]};
  if(nouns.length===1) return {subj:[], obj:nouns};
  return {subj:nouns.slice(0,-1), obj:nouns.slice(-1)};
}
function legalityCore(cards){
  if(!cards.length) return {ok:false, why:"Pick cards to build a verb"};
  const by={};
  cards.forEach(c=>{ const r=roleOf(c); (by[r]=by[r]||[]).push(c); });
  const n = r => (by[r]||[]).length;

  /* adverbs are separate words, so any number may stack in front of the verb */
  for(const r of ["subject","object","deictic","plural","negative"])
    if(n(r)>1) return {ok:false, why:`Two ${ROLENAME[r]}s, and only one fits the slot`};
  const adjPair = adjectiveOf(cards);
  if(n("stem")>1 && !(adjPair && n("stem")===2))
    return {ok:false, why:"Two stems, and only one fits the slot"};

  if(!n("stem"))    return {ok:false, why:"A verb needs a stem."};
  if(!n("subject")) return {ok:false, why:"A verb needs a subject."};
  if(n("deictic") && n("plural"))
    return {ok:false, why:"1st and 3rd person plural cannot both mark one verb"};

  const stem=adjPair ? adjPair.main : by.stem[0];
  const subj=by.subject[0];
  for(const c of cards){
    if(c===stem || (adjPair && c===adjPair.adj) || !carriesClass(c, roleOf(c))) continue;
    if(!compatible(c, stem.suit))
      return {ok:false, why:`${CLASSIFIER[c.suit]} ${ROLENAME[roleOf(c)]} cannot take a ${CLASSIFIER[stem.suit]} stem`};
  }

  /* haa is a singular-subject stem. It has a separate plural stem in the language,
     so it will not take slot 7 or slot 9 at all. */
  if(SINGULAR_ONLY[stem.morph] && (n("deictic")||n("plural")))
    return {ok:false, why:`${stem.morph} is singular only, and takes no plural marker`};

  /* Slots 7 and 9 mark plurality on a 3rd person subject. */
  if((n("deictic")||n("plural")) && personOf(subj)!=="3sg")
    return {ok:false, why:"slot 7 and slot 9 only mark a 3rd person subject"};

  /* A noun standing as the subject is fine on any verb. It is only an object noun
     that needs a transitive stem, and that means a second noun, or a noun sitting
     behind an object prefix. */
  const nrV=nounRoles(cards);
  if(nrV.obj.length && valencyOf(stem)===false)
    return {ok:false, why:`${stem.morph} takes no object`};

  /* two nouns would need a conjunction to be joined, and there is none */
  const nr0=nounRoles(cards);
  if(nr0.subj.length>1)
    return {ok:false, why:"A conjunction would be needed to join two nouns"};

  /* an object cannot repeat the person of its own subject */
  if(n("object")){
    const ob=by.object[0];
    const subjPerson = (n("deictic")?"1pl":n("plural")?"3pl":personOf(subj));
    const opx=objPersonOf(ob);
    if(opx && opx===subjPerson && ob.morph!=="w(\u00eb)")
      return {ok:false, why:`${ob.morph} cannot take a ${subjPerson} subject`};
  }

  if(n("object") && valencyOf(stem)===false)
    return {ok:false, why:`${stem.morph} is intransitive \u2014 it takes no object`};

  return {ok:true, why:""};
}
function legality(cards){
  if(!cards.length) return {ok:false, why:"Pick cards to build a verb"};
  return withRoles(cards, ()=>legalityCore(cards));
}
function ordered(cards){
  return cards.slice().sort((a,b)=>{
    const d = ORDER[roleOf(b)] - ORDER[roleOf(a)];
    return d || a.rank-b.rank;
  });
}
function buildWord(cards){ return withRoles(cards, ()=>buildWordCore(cards)); }
const LADDER=["stem","subject","deictic","object","plural"];
const rung = r => LADDER.indexOf(r);
function skippable(role, word){
  if(role==="deictic") return word.some(c=>roleOf(c)==="plural");
  if(role==="plural")  return word.some(c=>roleOf(c)==="deictic");
  return false;
}
function cribFollows(word, card){
  if(card.joker) return jokerRole(word)!==null;
  const r=roleOf(card);
  /* Adverbs are their own words in front of the verb. They fill no slot, any
     number may stack, and laying one never ends your turn. */
  if(r==="adverb") return true;
  if(r==="negative") return !word.some(c=>roleOf(c)==="negative");  // stands outside
  if(rung(r)<0) return false;
  if(word.some(c=>!c.joker && roleOf(c)===r)) return false;
  if(r==="deictic" && word.some(c=>roleOf(c)==="plural"))  return false;
  if(r==="plural"  && word.some(c=>roleOf(c)==="deictic")) return false;

  /* Every slot in the verb is optional, so an empty one between two cards is not
     a gap \u2014 h(\u00eb) and oh sit together happily with slots 8 and 7 unused. All that
     matters is that the slot is free and the word stays a possible verb. */
  /* and it still has to be the same verb. A joker is judged as the morpheme it
     borrowed, so a slot it took earlier is re-checked against whatever is laid
     later: a plural marker stops being legal the moment a 2sg subject arrives. */
  const all=word.concat([card]).map(c=>(c.joker&&c.asCard)?c.asCard:c);
  const stem=all.find(c=>roleOf(c)==="stem");
  for(const c of all){
    if(!carriesClass(c, roleOf(c))) continue;
    if(stem && !compatible(c, stem.suit)) return false;
  }
  const subj=all.find(c=>roleOf(c)==="subject");
  const marked=all.some(c=>roleOf(c)==="deictic"||roleOf(c)==="plural");
  if(stem && all.some(c=>roleOf(c)==="object") && valencyOf(stem)===false) return false;
  if(marked && subj && personOf(subj)!=="3sg") return false;

  /* an object may not repeat the person of its own subject */
  const ob=all.find(c=>roleOf(c)==="object");
  if(ob && subj){
    const op=objPersonOf(ob);
    const sp = marked ? (all.some(c=>roleOf(c)==="deictic") ? "1pl" : "3pl") : personOf(subj);
    if(op && op===sp && ob.morph!=="w(\u00eb)") return false;
  }
  /* and once it is a whole verb it has to pass the same test as the card game */
  if(stem && subj && !legality(all).ok) return false;
  return true;
}
const cribIsWord = w =>
  w.some(c=>cribRole(c)==="stem") && w.some(c=>cribRole(c)==="subject");
const cribRole = c => c.joker ? (c.asRole||null) : roleOf(c);
function jokerRole(word){
  const taken = r => word.some(c=>cribRole(c)===r);
  const order = ["stem","subject"]
    .concat(LADDER.filter(r=>r!=="stem" && r!=="subject"))
    .concat(["negative"]);
  for(const r of order){
    if(taken(r) || skippable(r, word)) continue;
    if(jokerStandIn(word, r)) return r;       // only a slot with a legal filler
  }
  return null;
}
function jokerStandIn(word, role){
  const pool=shuffle(DECK52().filter(c=>roleOf(c)===role));
  for(const c of pool) if(cribFollows(word, c)) return c;
  return null;
}
const cribCount = c => c.joker ? 0 : Math.min(10, c.rank);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const PRONOUN = {"1sg":"I","2sg":"you","3sg":"s/he","1pl":"we","2pl":"you all","3pl":"they"};
function englishSentence(cards){ return withRoles(cards, ()=>englishCore(cards)); }
const nounForm = (morph, plural) => {
  const n=NOUNS.find(x=>x.morph===morph);
  return n ? (plural ? n.many : n.one) : morph;
};
/* ---- END extracted from the game ---- */

/* the few things the game reads off G or the DOM, supplied here instead */
const countOf = c => c.joker ? 0 : Math.min(10, c.rank);
const worthOf = c => (!c.joker && SINGULAR_ONLY[c.morph]) ? 4 : 2;

let _deckCache = null;
function fullDeck(){
  if(!_deckCache){
    _deckCache = [];
    SUIT_ORDER.forEach(su => {
      for(let r = 1; r <= 13; r++)
        _deckCache.push({ id: su + r, suit: su, rank: r, morph: MORPH[su][r-1],
                          slot: SLOTLABEL[roleAt(su, r)], role: roleAt(su, r),
                          pip: PIP[su], red: !!RED[su], label: RANKS[r-1],
                          gloss: ENGLISH[su][r-1] || null });
    });
  }
  const copy = _deckCache.map(c => Object.assign({}, c));
  copy.push({ id:"J1", joker:true, morph:"\u2605", label:"\u2605", pip:"\u2605", slot:null });
  copy.push({ id:"J2", joker:true, morph:"\u2605", label:"\u2605", pip:"\u2605", slot:null });
  return copy;
}
/* the game picks a joker's stand-in from its own deck; here it is the plain 52 */
const DECK52 = () => fullDeck().filter(c => !c.joker);

function spokenWord(cards){
  const w = buildWord(cards.map(c => (c.joker && c.asCard) ? c.asCard : c));
  return [w.pre, w.word, w.post].filter(Boolean).join(" ");
}

module.exports = { DECK, SUIT_ORDER, RANKS, CLASSIFIER, PIP, LADDER, ORDER, SLOTLABEL, ROLENAME,
  roleOf, roleAt, personOf, valencyOf, legality, cribFollows, cribIsWord, cribRole,
  jokerRole, jokerStandIn, ordered, buildWord, spokenWord, surfaceOf, englishSentence,
  countOf, worthOf, shuffle, fullDeck, skippable, SINGULAR_ONLY };
