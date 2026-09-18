# Verb Cribbage, two players over a network

Two people, one deck of Hän morphemes, one browser each. The server owns the
deck and runs every rule, so neither player can see the other's hand or make an
illegal move.

The rules here are lifted straight out of the single-player game, so the two can
never drift apart. Checked against it over 19,000 random positions with zero
disagreements.

---

## What you need

Node.js. Get the **LTS** build from <https://nodejs.org> and run the installer.
Nothing else.

## The files

Unzip the folder anywhere. It should look exactly like this:

    verb-cribbage/
      server.js        the game server
      rules_core.js    the rules
      deck.json        the 52 morphemes
      package.json     the list of what to install
      README.md        this file
      public/
        index.html     the game page players open

`index.html` should sit inside the `public` folder. If it ends up loose beside
`server.js` the server will still find it, so either layout works.

## Playing on your own machine

1. Open the folder in a terminal.

   On Windows: open the `verb-cribbage` folder, hold **Shift**, right-click
   empty space inside it, choose **Open PowerShell window here** (or **Open in
   Terminal**).

2. Install what it needs. Once only:

       npm install

   If PowerShell refuses with *"running scripts is disabled on this system"*,
   use this instead, which sidesteps it without changing any Windows settings:

       npm.cmd install

3. Start it:

       npm start

   You should see `Server is running on port 2567`.

4. Open <http://localhost:2567> in a browser tab. Press **Create room** and note
   the four letters.

5. Open a second tab at the same address, type the four letters, press
   **Join room**.

The game starts as soon as the second player sits down. Leave the terminal
running; closing it ends the server. Press **Ctrl+C** in the terminal to stop.

## Playing with someone else

The server has to run somewhere you can both reach.

1. Put this whole folder in a GitHub repository. Everything listed above,
   including the `public` folder. Do **not** upload `node_modules` if you have
   one; it is just downloaded packages and it is large.

   **Watch the `public` folder.** Dragging files onto GitHub's web page often
   drops it, and you get `ENOENT ... public/index.html` when Render starts. Two
   ways to avoid it:

   - Drag the **whole `verb-cribbage` folder** onto the upload page rather than
     the files inside it, then move the contents up a level if GitHub nests
     them. The repository root must hold `server.js`, not a folder containing it.
   - Or press **Add file → Create new file** and type the name as
     `public/index.html` — typing the slash makes the folder — then paste the
     contents of `index.html` in and commit.

   If it happens anyway, open `http://your-address.onrender.com` and the page
   will tell you exactly what is missing.
2. Go to <https://render.com> and sign in with GitHub.
3. **New** → **Web Service**.
4. Pick your repository.
5. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
6. **Create Web Service**, then wait for it to say *Live*.
7. Render gives you an address like `https://verb-cribbage.onrender.com`. Send
   it to the other player. You both open it, one creates a room and reads out
   the four letters, the other joins.

**No code to edit.** The page connects back to whatever host served it, so local
and Render both work untouched.

A free Render service sleeps when idle. The first person to open it after a
quiet spell waits about thirty seconds while it wakes up.

## Putting it on itch.io

Only worth doing if you want the game listed there. The server still has to run
on Render.

1. Deploy to Render first and copy the address.
2. In `public/index.html`, near the top of the script, find:

       const SERVER = "";

   Put your Render address in the quotes:

       const SERVER = "https://verb-cribbage.onrender.com";

3. Zip `index.html` **on its own**. Open the zip and check `index.html` is right
   there at the top, not inside a folder. If it is in a folder, itch will not
   find it.
4. On itch, new project, **Kind of project: HTML**, upload the zip, tick
   **This file will be played in the browser**.

Two things that catch people out:

- The address must be `https://`, not `http://`. itch serves over HTTPS and the
  browser will block a plain connection from an HTTPS page.
- Render's free tier sleeps, as above.

## Undoing any of this

Nothing here touches your system settings. To remove it all:

- **The folder:** delete it. That includes `node_modules`, which is the only
  thing `npm install` created, and it lives inside the folder.
- **Node.js**, if you no longer want it: Windows **Settings → Apps → Installed
  apps**, find Node.js, **Uninstall**. On a Mac it came from the installer and
  can be left; it does no harm.
- **npm's cache**, which sits outside the folder and is harmless but takes a
  little disk:

      npm cache clean --force

- **PowerShell:** if you only ever used `npm.cmd` you changed nothing. If you
  did run `Set-ExecutionPolicy` at some point and want it back to the default:

      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Undefined

- **Render:** open the service, **Settings**, scroll to the bottom, **Delete
  Web Service**.
- **GitHub:** repository **Settings**, bottom of the page, **Delete this
  repository**.

## The rules

One card per turn, then it is the other player's turn.
Lay into any open slot, in a conjugation that agrees.
Adverbs use no slot, so any number of them may stack.
Two points a card. Four for `haa`, which is singular only and takes no plural
marker.
One more point for the last card played before a word closes.
Nothing in hand that fits? You pass and draw on your own, no clicking needed.
Two jokers are wild. A joker stands in for whatever the word lacks, and returns
to your hand when somebody lays the real card for that slot.
When you both pass, a finished word fires for two more points and the deck is
shuffled. An unfinished word is never abandoned while cards remain to draw.
First to 61 takes it.
