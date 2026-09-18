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

const TARGET = 61, DEAL = 6;

/* ---------------- a table ---------------- */
function freshRoom(code){
  return { code, sockets:[null,null], names:["",""], started:false, over:null,
           hands:[[],[]], draw:[], word:[], owner:[], count:0,
           score:[0,0], turn:0, dealer:0, passed:[false,false], last:null,
           busy:false, log:[] };
}
function say(room, t){ room.log.push(t); room.log = room.log.slice(-120); }

function deal(room){
  const d = R.shuffle(R.fullDeck());
  room.hands = [d.slice(0, DEAL), d.slice(DEAL, DEAL*2)];
  room.draw  = d.slice(DEAL*2);
  room.word = []; room.owner = []; room.count = 0;
  room.passed = [false,false]; room.last = null; room.busy = false;
  room.dealer = 1 - room.dealer;
  room.turn = 1 - room.dealer;
  say(room, room.names[room.turn] + " leads.");
}
function refill(room){
  const seen = {};
  room.hands[0].concat(room.hands[1], room.word).forEach(c => seen[c.id] = 1);
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
  const me = room.turn, other = 1 - me;

  if(room.passed[0] && room.passed[1]){
    const fired = R.cribIsWord(room.word);
    if(!fired && room.word.length){
      const seen = {};
      room.hands[0].concat(room.hands[1], room.word).forEach(c => seen[c.id] = 1);
      if(room.draw.length || R.fullDeck().some(c => !seen[c.id])){
        drawOne(room, 0); drawOne(room, 1);
        room.passed = [false,false];
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
  if(!room.hands[0].length && !room.hands[1].length){ deal(room); return; }
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
  const them = 1 - seat;
  return {
    seat, code: room.code, started: room.started,
    names: room.names, score: room.score, count: room.count,
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
    theirCards: room.hands[them].length,
    pile: room.draw.length,
    playable: room.hands[seat].filter(c => playable(room, seat, c)).map(c => c.id),
    busy: room.busy
  };
}
function push(room){
  [0,1].forEach(seat => {
    const s = room.sockets[seat];
    if(s) s.emit("state", viewFor(room, seat));
  });
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
    room.names[1] = "\u2026";
    rooms.set(room.code, room);
    socket.join(room.code);
    socket.emit("hosted", room.code);
    push(room);
  });

  socket.on("join", ({ code, name }) => {
    const r = rooms.get(String(code || "").toUpperCase());
    if(!r)           return socket.emit("nope", "No table with that word.");
    if(r.sockets[1]) return socket.emit("nope", "That table is full.");
    room = r; seat = 1;
    room.sockets[1] = socket;
    room.names[1] = String(name || "Guest").slice(0,16);
    socket.join(room.code);
    room.started = true;
    deal(room);
    push(room);
    nudge(room);
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
    if(!room) return;
    room.sockets[seat] = null;
    const other = room.sockets[1 - seat];
    if(other) other.emit("gone", room.names[seat] + " left the table.");
    if(!room.sockets[0] && !room.sockets[1]) rooms.delete(room.code);
  });
});

server.listen(PORT, () => {
  console.log("Server is running on port " + PORT);
  console.log("Open http://localhost:" + PORT + " in two tabs.");
  console.log("One presses Host a table, the other joins with the four letters.");
});
