/* ------------------------------------------------------------------
   Verb Cribbage, two players over a network.

       npm install
       npm start

   Then open http://localhost:2567 in two tabs. One presses Host and
   reads out the four letters; the other types them in.

   The server owns the deck and runs every rule. A client can only ask
   to lay a named card, so neither player can see the other's hand or
   invent a legal move.
   ------------------------------------------------------------------ */
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const R = require("./rules_core.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 2567;

/* The page normally lives in public/, but a GitHub web upload sometimes flattens
   the folder, so look beside server.js too rather than failing with ENOENT. */
const fs = require("fs");
const PAGE = [ path.join(__dirname, "public", "index.html"),
               path.join(__dirname, "index.html") ].find(p => fs.existsSync(p));

if(PAGE) app.use(express.static(path.dirname(PAGE)));
app.get("/", (_q, res) => {
  if(PAGE) return res.sendFile(PAGE);
  res.status(500).type("text/plain").send(
    "index.html is missing.\n\n" +
    "It should sit at public/index.html, next to server.js.\n" +
    "If you uploaded to GitHub through the web page, the public folder was\n" +
    "probably dropped. Add the file again and name it exactly:\n\n" +
    "    public/index.html\n\n" +
    "typing that whole path into the file-name box, which makes the folder.");
});

const TARGET = 61, DEAL = 6, SEATS = 4;

/* ---------------- a table ---------------- */
function freshRoom(code){
  const n = SEATS;
  return { code, sockets:Array(n).fill(null), names:Array(n).fill(""),
           seated:Array(n).fill(false), started:false, over:null,
           hands:Array.from({length:n},()=>[]), draw:[], word:[], owner:[], count:0,
           score:Array(n).fill(0), turn:0, dealer:0, passed:Array(n).fill(false),
           last:null, busy:false, log:[], chat:[] };
}
/* who is actually at the table right now */
const liveSeats = room => room.seated.map((v,i)=>v?i:-1).filter(i=>i>=0);
function nextSeat(room, from){
  const live = liveSeats(room);
  if(live.length < 2) return from;
  let i = live.indexOf(from);
  if(i < 0){ return live.find(s => s > from) !== undefined ? live.find(s => s > from) : live[0]; }
  return live[(i + 1) % live.length];
}
function say(room, t){ room.log.push(t); room.log = room.log.slice(-120); }

function deal(room){
  const d = R.shuffle(R.fullDeck());
  const live = liveSeats(room);
  room.hands = room.hands.map(() => []);
  let k = 0;
  live.forEach(seat => { room.hands[seat] = d.slice(k, k + DEAL); k += DEAL; });
  room.draw = d.slice(k);
  room.word = []; room.owner = []; room.count = 0;
  room.passed = room.passed.map(() => false);
  room.last = null; room.busy = false;
  room.dealer = nextSeat(room, room.dealer);
  room.turn = nextSeat(room, room.dealer);
  say(room, room.names[room.turn] + " leads.");
}
function allHeld(room){
  return room.hands.reduce((a, h) => a.concat(h), []).concat(room.word);
}
function refill(room){
  const seen = {};
  allHeld(room).forEach(c => seen[c.id] = 1);
  room.draw = R.shuffle(R.fullDeck().filter(c => !seen[c.id]));
}
function drawOne(room, p){
  if(!room.draw.length) refill(room);
  if(!room.draw.length) return null;
  const c = room.draw.pop();
  room.hands[p].push(c);
  return c;
}
const playable = (room, p, c) => R.cribFollows(room.word, c) && room.count + R.countOf(c) <= 31;
const anyPlay  = (room, p) => room.hands[p].some(c => playable(room, p, c));

function peg(room, p, n){
  room.score[p] = Math.min(TARGET, room.score[p] + n);
  if(room.score[p] >= TARGET) room.over = p;
}

/* ---------------- a turn ---------------- */
function doLay(room, p, cardId){
  if(room.over !== null || room.busy || room.turn !== p) return;
  const c = room.hands[p].find(x => x.id === cardId);
  if(!c || !playable(room, p, c)) return;
  room.busy = true;

  room.hands[p] = room.hands[p].filter(x => x.id !== cardId);

  /* a joker only borrows its slot; the real card turns it out */
  let swapped = null;
  if(!c.joker){
    const i = room.word.findIndex(x => x.joker && x.asRole === R.roleOf(c));
    if(i >= 0){
      swapped = room.word[i];
      room.count -= R.countOf(swapped);
      room.word.splice(i,1); room.owner.splice(i,1);
      delete swapped.asRole; delete swapped.asCard;
      room.hands[p].push(swapped);
    }
  } else {
    c.asRole = R.jokerRole(room.word);
    c.asCard = R.jokerStandIn(room.word, c.asRole, R.fullDeck().filter(x => !x.joker));
  }

  room.word.push(c); room.owner.push(p);
  room.count += R.countOf(c);
  room.last = p;
  room.passed = [false,false];
  const worth = R.worthOf(c);
  peg(room, p, worth);
  say(room, room.names[p] + " plays " +
      (c.joker ? ("a joker as the " + (c.asRole || "word")) : c.morph) +
      ". " + (worth === 4 ? "Four points." : "Two points.") + " Count " + room.count + "." +
      (swapped ? " Takes the joker back." : ""));
  settle(room, false);
}
function doPass(room, p){
  if(room.over !== null || room.busy || room.turn !== p) return;
  if(anyPlay(room, p)) return;                 // you may only pass when truly stuck
  room.busy = true;
  room.passed[p] = true;
  const got = drawOne(room, p);
  say(room, room.names[p] + " cannot play." + (got ? " Draws a card." : ""));
  settle(room, true);
}

/* strict alternation; the word closes only on two passes in a row, and a
   half-built word is never abandoned while cards remain */
function settle(room, passed){
  room.busy = false;
  if(room.over !== null) return;
  const me = room.turn, other = nextSeat(room, me);
  const live = liveSeats(room);
  const allPassed = live.length > 0 && live.every(s => room.passed[s]);

  if(allPassed){
    const fired = R.cribIsWord(room.word);
    if(!fired && room.word.length){
      const seen = {};
      allHeld(room).forEach(c => seen[c.id] = 1);
      if(room.draw.length || R.fullDeck().some(c => !seen[c.id])){
        live.forEach(s2 => drawOne(room, s2));
        room.passed = room.passed.map(() => false);
        room.turn = other;
        say(room, "No word yet. You each draw and carry on.");
        return;
      }
      say(room, "Nothing left to draw. The word is let go.");
    }
    if(room.last !== null){
      peg(room, room.last, 1);
      say(room, room.names[room.last] + " laid last. One point.");
      if(fired){
        peg(room, room.last, 2);
        say(room, room.names[room.last] + " completed a word. Two more.");
      }
    }
    say(room, "The word ends. Shuffling.");
    deal(room);
    return;
  }
  if(live.every(s2 => !room.hands[s2].length)){ deal(room); return; }
  room.turn = other;
}
/* whoever cannot follow passes on their own, so nobody has to click it */
function nudge(room){
  if(!room || room.over !== null || !room.started) return;
  const p = room.turn;
  if(room.sockets[p] && !anyPlay(room, p)){
    setTimeout(() => {
      if(room.over === null && room.turn === p && !anyPlay(room, p)){
        doPass(room, p);
        push(room);
        nudge(room);
      }
    }, 1000);
  }
}

/* ---------------- what one player may see ---------------- */
function viewFor(room, seat){
  return {
    seat, code: room.code, started: room.started, seats: SEATS,
    names: room.names, seated: room.seated, score: room.score, count: room.count,
    chat: room.chat.slice(-60),
    turn: room.turn, over: room.over, log: room.log.slice(-40),
    target: TARGET,
    /* In the order the slots are actually spoken, not the order they were laid.
       A joker is sorted and shown as the morpheme it borrowed, so it lands in
       its real slot instead of being pushed to the end. */
    word: (() => {
      const pairs = room.word.map((c, i) => ({
        real: (c.joker && c.asCard) ? c.asCard : c, orig: c, by: room.owner[i]
      }));
      const seq = R.ordered(pairs.map(p => p.real));
      return seq.map(rc => {
        const p = pairs.find(x => x.real === rc) || pairs[0];
        return { id: p.orig.id, morph: rc.morph, joker: !!p.orig.joker,
                 asRole: p.orig.asRole || null, slot: rc.slot,
                 red: !!rc.red, pip: rc.pip, by: p.by };
      });
    })(),
    wordText: R.spokenWord(room.word),
    owner: room.owner,
    hand: room.hands[seat],
    /* how many cards everyone is holding, but never which ones */
    cardsHeld: room.hands.map(h => h.length),
    pile: room.draw.length,
    playable: room.hands[seat].filter(c => playable(room, seat, c)).map(c => c.id),
    busy: room.busy
  };
}
function push(room){
  for(let seat = 0; seat < SEATS; seat++){
    const s = room.sockets[seat];
    if(s) s.emit("state", viewFor(room, seat));
  }
}

/* ---------------- rooms ---------------- */
const rooms = new Map();
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";       // no I or O, they read badly aloud
function newCode(){
  let c;
  do { c = Array.from({length:4}, () => LETTERS[(Math.random()*LETTERS.length)|0]).join(""); }
  while(rooms.has(c));
  return c;
}

io.on("connection", socket => {
  let room = null, seat = null;

  socket.on("host", name => {
    room = freshRoom(newCode()); seat = 0;
    room.sockets[0] = socket;
    room.names[0] = String(name || "Host").slice(0,16);
    room.seated[0] = true;
    rooms.set(room.code, room);
    socket.join(room.code);
    socket.emit("hosted", room.code);
    push(room);
  });

  socket.on("join", ({ code, name }) => {
    const r = rooms.get(String(code || "").toUpperCase());
    if(!r) return socket.emit("nope", "No table with that word.");
    const free = r.sockets.findIndex(x => !x);
    if(free < 0) return socket.emit("nope", "That table is full.");
    room = r; seat = free;
    room.sockets[seat] = socket;
    room.names[seat] = String(name || "Player").slice(0,16);
    room.seated[seat] = true;
    socket.join(room.code);
    say(room, room.names[seat] + " sits down.");
    /* the first arrival starts the game; anybody later joins the round in
       progress and is dealt in at the next shuffle */
    if(!room.started){ room.started = true; deal(room); }
    else { room.hands[seat] = room.draw.splice(0, DEAL); }
    push(room);
    nudge(room);
  });

  socket.on("chat", text => {
    if(!room || seat === null) return;
    const t = String(text || "").slice(0, 200).trim();
    if(!t) return;
    room.chat.push({ seat, name: room.names[seat], text: t, at: Date.now() });
    room.chat = room.chat.slice(-120);
    push(room);
  });
  socket.on("emote", name => {
    if(!room || seat === null) return;
    const n = String(name || "").slice(0, 20);
    room.chat.push({ seat, name: room.names[seat], emote: n, at: Date.now() });
    room.chat = room.chat.slice(-120);
    push(room);
  });

  socket.on("lay", id => {
    if(!room) return;
    doLay(room, seat, id);
    push(room);
    nudge(room);
  });

  socket.on("again", () => {
    if(!room || room.over === null) return;
    room.score = [0,0]; room.over = null; room.dealer = 0;
    room.log = [];
    deal(room); push(room); nudge(room);
  });

  socket.on("disconnect", () => {
    if(!room || seat === null) return;
    const who = room.names[seat];
    room.sockets[seat] = null;
    room.seated[seat] = false;
    room.hands[seat] = [];
    room.passed[seat] = false;
    say(room, who + " leaves the table.");
    /* if it was their turn, play moves on rather than stalling */
    if(room.turn === seat) room.turn = nextSeat(room, seat);
    if(!room.sockets.some(Boolean)) { rooms.delete(room.code); return; }
    push(room);
    nudge(room);
  });
});

server.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
  console.log("Open http://localhost:" + PORT + " in two tabs.");
  console.log("One presses Host a table, the other joins with the four letters.");
});
