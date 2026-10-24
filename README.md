# Bogan-o Party

A party board game in the style of Mario Party and Pummel Party, set in real Aussie towns. The board plays on the TV or laptop in the browser (three.js). Everyone joins by scanning a QR code, and their phone becomes their remote. Players are inflatable blow-up dolls wearing their own face.

It uses the same phone connection as Marble Mayhem and Joe Master Universe: it runs on GitHub Pages for free (phones connect peer-to-peer), or from your own computer on your Wi-Fi with no internet.

## Play it

**Online (GitHub Pages):** push this folder to a repository, then **Settings → Pages → Deploy from a branch → `main` / root**. Open the site on the TV and scan the QR. Anyone can also open `…/play.html` and type the 4-letter game code.

**Offline (your Wi-Fi):** needs [Node.js](https://nodejs.org) 18+, nothing to install.
- Windows: double-click `start.bat`
- Anywhere: `npm start`

Open **http://localhost:3000** on the TV and scan the QR with phones on the same Wi-Fi. Phone tilt controls need a secure link: the server makes one with `openssl` if it's installed (port 3443, phones tap through a one-time warning), otherwise use the online version for tilt games.

## How a game works

1. **Lobby.** Phones join, type a name, pick a doll (Bloke, Sheila, Smooth or Both) and take up to four selfies: neutral, happy, sad and angry. Missing moods fall back to the neutral photo, then to a cartoon face. On the TV, pick the map, how many items win (default 5), an optional round limit, and CPU players.
2. **Turns.** Each player can use one power-up, then rolls (d10). At a fork the phone asks which way. Blue spaces give 3 coins, red take 3, green are map events, yellow are shops.
3. **The item.** Each map has its own item (Broken Hill: a Lump of Lead; Adelaide: a Crazy Horse ticket). Walk past it with 20 coins to buy it. Each time it's bought it moves to the space **furthest from every player**, unless the players are all spread out, in which case it goes **furthest from the leader**.
4. **Minigame** after every round. Coins for 1st/2nd/3rd/4th: 10/6/3/1.
5. **First to the target wins.** The podium shows the winner's happy face and everyone else's sad one.

Faces double as emotes: while waiting, tap 😐 😁 😢 😡 on your phone to pull that face on the TV (not during minigames).

**Health.** Everyone has 100 HP. Hit 0 and you're KO'd: drop half your coins and go back to the start at full health.

### Power-ups (bought in the shop, used before rolling, max 3)

| Power-up | Price | What it does |
|---|---|---|
| 🪙 Coin Flip | 5 | Pick someone who hasn't rolled. They call heads or tails and flip on their phone. Right: they steal your turn. Wrong: you roll two dice. Picking someone who already rolled wastes it. |
| 🍬 Sugar Bomb | 8 | A bag of sugar with a 15 s fuse. Roll it along the board or straight at a player, or pop it early. Everyone within 2 spaces gets **Sugar Rush!**: +2 on their dice and −10% HP each round for 3 rounds. |
| ✨ Teleport | 10 | Rock paper scissors, best of 3, on both phones. The winner decides whether you swap places. |
| 🌀 Vacuum | 12 | Point it down any road out of your space. Everyone in the cone loses 1–8 coins to you, with a 1 in 4 chance you also take one of their power-ups. |
| ✝️ Holy Hand Grenade | 15 | Lob it up to 8 spaces. One, two… three! 50/35/20 damage by distance, and a knock-back for anyone close. It can hit you too. |

### Minigames

| Minigame | Controls |
|---|---|
| ✈️ Plane Instructor | Hold the phone like a steering wheel and tilt to bank your arms like the instructor. Score while you're in line. Past halfway, your doll takes off. One minute. (Slider fallback if a phone has no tilt.) |
| ⛩️ Chad's Japanese Adventure | Running through the torii tunnels in Kyoto. JUMP the cats, DUCK under the low gates. Every one cleared scores; hit one and you go flying. 45 seconds. |
| 🍪 The Great Biscuit Heist | Myles is asleep on the couch with the Scotch Fingers in front of him. Tap SNEAK to creep up, grab one and sneak it back to the front door for a point, then go again. When he snorts and stirs, stop: if he rolls over and sees you move, OI! Back to the door, biscuit lost. |
| 🍔 Burger Boys | Order tickets on the rail. Tap the ingredients in order, bottom bun up. One wrong tap and the burger hits the floor. Bigger burgers score more. |
| 🔮 Marble Mayhem | The MarbleDrinks race on a fresh short track. You're a glass marble with your doll's head inside. BOOST three times; roll through a vape for a power, then USE POWER. |
| 🤼 Joe Master Universe | The Joe Master wrestling game: everyone in the ring as NAME MASTER. Thumbstick to move, STRIKE, GRAB (grab again to slam, grab a downed Master to pin), RUN, BLOCK. Mash to escape. Last one standing. With under 4 players, the Original JOE MASTER joins as a CPU. |
| 🏎️ Toy Cars | Orange track through a giant house. Your car drives flat out; tilt to steer. Three laps. |
| 🛹 Ripstick Rider | Down a suburban street on ripsticks. Keep swaying your phone side to side to ride (lean more one way to drift that way). Cracks, potholes, pets and oncoming cars knock you off; fall behind and the magpie swoops you. PUSH shoves whoever's next to you; a foam sword pickup shoves much harder. Last one riding wins, survivors tie at 1:30. |
| 🐑 Alan's Farm | Twenty sheep and a pen each on the edge of the paddock. Thumbstick to run; sheep move away from you, so herd them in. YELL (every 10 s) scatters sheep near you; HAY (picked up off the ground) makes nearby sheep follow you for 5 s. Most sheep in your pen at the end wins. |
| 🏋️ The (Back) Yard | Backyard gym, Guitar Hero style: the same coloured notes come down the mat for everyone. Tap the matching colour as each one crosses the line to do a rep. Every 5 in a row raises your multiplier (up to x6); a miss resets it. |
| ✂️ Just a Trim | A hedge each and a pole trimmer. You walk along by yourself; slide your thumb up and down the phone to set the blade height. Trim the top into the shape on the sign (Opera House, Uluru, a roo...). Closest match wins. |
| ✈️ Dubai High Flyer | Stunt planes round the Burj Khalifa. Stick to turn, climb and dive; hold FIRE. Gold rings are a point and 10% health; shooting someone down takes one of their points. ? crates give a power-up (balloon mines, flak strike on the leader, boost, tow rope, autopilot, shield; better odds when you're behind). Red crosses are health. |
| ⛏️ Mine Your Own Business | Jackhammer down to the lump of lead. Digs by itself; stick to go sideways, mash HAMMER to dig faster. Rock stops you, dinosaur bones slow you, holes and caves are free drops. Opals give dynamite, a diamond bit, turbo or a rockfall under everyone else; gas pockets blow you back up. First to the lead wins, the rest place by depth. |
| 🍺 Perfect Pour | One schooner, one pour. Slide up to open the tap, back down to shut it, and that's your go. Wide open is all froth, too gentle is flat. Judged after it settles: beer to the rim with a finger of head scores 100. |

## Adding content

Everything is plain JavaScript modules with no build step. Each kind of content is one file plus one line in a list.

- **Map:** copy `js/content/maps/broken-hill.js`, change the id, name, item, colours, board layout, landmarks and events, and add it to `js/content/maps/index.js`. The board is a loop of control points plus branches that leave and rejoin the loop; spaces are spread along them automatically. A landmark can name a real model with `glb: 'assets/models/thing.glb'` and it's loaded instead of the built-in placeholder.
- **Power-up:** copy `js/content/powerups/coin-flip.js`, write its `use(game, player)`, and add it to `js/content/powerups/index.js`. The game object gives you `ask`, `pickPlayer`, `aim` (move a target around the board), `aimDirection`, `banner`, `coins`, `damage`, `addEffect`, `knockBack`, `teleport` and `view` effects. Lasting effects (like Sugar Rush) live in `effects.js`.
- **Minigame:** copy `js/content/minigames/plane-instructor.js` and add it to `js/content/minigames/index.js`. It builds its own scene, takes phone input (`pad` decides the controls: `tilt` (optionally with buttons under it), `buttons` (optionally coloured), `stick` for a thumbstick plus held buttons, or `slider` for a tall up-and-down slider) and returns scores. The runner handles the title card, ready-up, countdown, timer and results.

## Project layout

```
index.html, js/host/      TV screen: lobby, board, HUD, game engine, minigame runner
play.html, js/phone/      phone remote (shows whatever the TV sends, sends taps back)
js/board.js               board graph, distances, item spawn rule (no three.js, unit tested)
js/net.js, js/qr.js       phone connections and QR (from Marble Mayhem)
js/content/               maps, power-ups, minigames
server/                   optional local Wi-Fi server (from Marble Mayhem)
tests/                    node --test (npm test)
```

## Testing

`npm test` runs the board and item-placement tests. For a quick look without phones, open `/?bots=4&autostart` to watch CPU players play. Add `&fast` to speed things up, `&items=1` for a short game, `&nominigames` to skip minigames, or `&minigame=plane-instructor` to always play one (ids: plane-instructor, chads-japanese-adventure, great-biscuit-heist, burger-boys, marble-mayhem, joe-master, toy-cars, ripstick-rider, alans-farm, back-yard, just-a-trim, dubai-high-flyer, mine-your-own-business, perfect-pour), or `&give=sugar-bomb,vacuum` to hand everyone power-ups at the start.
