# What Manhunt (2003) actually looks like — notes from a full longplay

Source: "Manhunt | Full Playthrough | Longplay Gameplay Walkthrough | No Commentary" (P.B. Horror Gaming,
YouTube vIuIUCXKRr0), ~50 frames sampled across all 20 scenes. Level layouts: radar maps + map renders on
manhuntgame.fandom.com (tools/radar2plan.py).

## Light and colour
- Night, but **readable**: floors, walls and buildings are always visible. Never a black screen.
- Palette: cold grey-blue in the open, sickly yellow-green in alleys and interiors; orange/yellow sodium
  lamps make pools; deep shadow patches (the hiding spots) are clearly darker than the rest.
- Sky is near-black; fog is light — you can see down a whole street.
- Lamps have soft visible light shafts; hunters carry torches with visible beams.

## HUD (third person)
- Radar: transparent circle bottom-left with a thin dark outline; hunters as coloured dots
  (yellow = unaware, orange/red = hunting), a red pulse from the centre = your noise.
- Bottom-right: a small figure icon showing stance (standing / crouched / running), with two thin vertical
  bars beside it (health green, stamina/visibility).
- Top-right: the item slot — a rounded pill, tinted by class (green melee, red bloody/heavy, blue lure/gun),
  item icon inside, item name above when picked up; guns show "clip / spare" ("6 / 11") under it.
  Several pills stack when you carry several items.
- Escort / boss: a vertical health bar top-right with the name under it ("Tramp", "Piggsy").
- Hints: black box top-left, white text, key words in red; "Press and hold the inventory button to swap
  this item for the Blackjack".

## Executions / pickups
- Lock-on: three small red triangles arranged round the target's head (they tighten and change colour
  with the grey / yellow / red execution levels).
- Items on the ground: a coloured ring with the item's icon floating over it.
- Throwables: a yellow arc ring at the target while aiming.

## Cutscenes and presentation
- Journalist's video diary: camcorder overlay — corner brackets, red REC dot, timecode 00:00:39:04,
  tape icon "57min", battery "35min".
- Story footage: cyan CCTV with rolling scanline bands.
- Cerberus: black riot gear, gas masks with glowing red eyes.

## Scenes seen (time in video)
Born Again 2–15 min (alleys, basketball court, car park, mall) · Doorway into Hell (FOR LEASE sign, ruined
streets) · White Trash (junkyard: yellow crane, Quonset hut, junk piles, tyres) · Fuelled by Hate ·
Grounds for Assault / Strapped for Cash (zoo: wooden shacks, ZOO gate sign, enclosure walls) ·
View of Innocence (neon mall, escalators) · Drunk Driving / Graveyard Shift (cemetery, Tramp escort,
church interior with checker floor, revolver) · Mouth of Madness (asylum grounds) · Doing Time / Kill the
Rabbit / Divided they Fall (prison blocks, cell bars) · Trained to Kill (sniper rifle) · Press Coverage ·
Wrong Side of the Tracks (rain, rails) · Border Patrol · Key Personnel (mansion, Starkweather portrait) ·
Deliverance (Piggsy in the attic).

## Road to Ruin (video 31:00–)
- Starts in green-tinted brick alleys at night (CCTV intro shot), a hunter at the far end; trash bags and a dumpster.
- Plastic-bag execution at 32:18. Hint about holding inventory to swap for the Blackjack.
- 33:12 small yard with a blue dumpster; falls from a height make noise (tutorial hint).
- 33:24–34:40 interior: yellow-green tiled public toilets/showers, white tiled walls smeared with blood,
  metal grille partitions, a corridor of tiles; hunter in a red executioner hood.
- 34:42 stairs up into dark brick; 35:06 out onto night streets: a white box truck, a full moon,
  a parked van with its headlights on, blue-white lamps down narrow alleys, crates/pallets.
- 36:36–38:54 underground service tunnels: rough ochre/brown plaster walls streaked with dark grime,
  bare hanging bulbs making pools of light, barred grilles, concrete stairs; corner-peek tutorial.
- 39:00 CCTV static cut, then outside: brick-throw tutorial among tenements with lit windows.
- 40:00–41:42 inside a gutted building: yellow plaster walls with rust-red damp rising from the floor,
  empty door frames, fire-escape ladders; Hoods in the mint-green jacket and stocking mask.
- 41:48–42:54 back out: blue-white street lamp, dumpsters full of junk, tenement facades, alleys.

## Textures seen (to recreate procedurally, not ripped)
- Plaster: ochre/yellow-green base, big soft dark blotches, rust-red damp band up to ~1 m.
- Tiles (toilets): small cream-yellow tiles, dark grout, blood smears.
- Brick: red-brown, soot-darkened, in blue moonlight looks blue-grey.

## Hunter designs
Full per-model outfit notes for every gang come from the Manhunt wiki's "Apparel" tables
(Hoods, Skinz, Wardogs, Innocentz, Smileys, Cerberus); built in src/hunters.js GANG_SETS + src/gear.js.
Gangs per scene: Hoods 1-3, Skinz 4-5, Wardogs 6-7 + Divided They Fall, Innocentz 8-10,
Smileys 11-13, SWAT Press Coverage / Wrong Side of the Tracks / Trained to Kill, Cerberus Border Patrol / Key Personnel.
- 43:00–46:54 board-walled rooms (yellow-brown planks), rotten mottled walls, a courtyard with a parked
  car, a street of tenements; the library cellar.
- 47:01–48:58 stone-pillared passage, then concrete-and-brick back alleys with chalk scrawl, dumpsters,
  crates; a railed gate at the end. 49:08 Cerberus van cutscene, then White Trash.
- Wiki: Road to Ruin ("der2") reuses the Doorway Into Hell radar map: warehouse -> restroom -> alley ->
  padlocked gate -> long corridor -> street -> library cellar (hung corpses) -> back alley -> gate.

## White Trash (video 49:08–66:20)
- Intro: Ramirez kills a drunk Skin in the junkyard; Cerberus Securicar backs into an alley and dumps Cash.
- Alley of graffiti brick and rusted container walls, fires in drums, wrecked trucks and tyre stacks.
- Maze walls of crushed cars, many under dark camo tarps; concrete slab walls; corrugated fences.
- Middle: a gutted concrete building with windows; yellow crane, yellow taxi and red wrecks, a green
  Quonset hangar, green fuel tanks, a trailer (Skin on the toilet, nailgun), a guard house with the gate switch.
- Objectives (wiki): kill the gate Skin, get a knife to cut the rope gate, nailgun from the trailer,
  switch in the guard house opens the electric gate, exit.

## Story cutscenes to add after the levels (in order)
- Born Again intro (execution chamber), Road to Ruin outro (Cerberus van grabs Cash),
  White Trash intro (Ramirez and the Skinz; Cash dumped from the van) ... keep logging per level.

## Fuelled By Hate (video 66:20–108:13) — the far end of the Dentons City junkyard (not a mall)
- Containers area: rows of open rusted containers (shadows inside), three Skinz, gate opens when they die.
- Yard with a raised wooden guard hut on stilts and stairs; a Skin inside watching porn on TV; punch the
  fuse box to bring him down.
- A crane with no fuel parked across the road to the crusher; gasoline in the Quonset hangar; four more
  Skinz arrive when it's taken; refuel, the crane clears the path, two more rush out.
- Crusher yard: big black scrap mounds, green crate stacks, the green crusher with a conveyor belt and
  stairs (one Skin on top), five around it; then a second crane clears the way to the exit doors.
- Muddy tyre tracks, timber stacks, an orange excavator, fire barrels, chain-link fences, moon.
- Outro (cutscene list): the Cerberus ambush Cash in the street and carry him to the Securicar again.

## Grounds for Assault (video 109:00–135:23) — Carcer City Zoo, the Wardogs
- Intro (cutscene list): Cerberus feed Piggsy in his room; the Securicar drops Cash at the zoo; Ramirez briefs the Wardogs.
- Entrance buildings: rusty animal-house rooms with peeling blue/green paint, steel cage frames, bloodstains;
  a forecourt with elephant statues, a ticket kiosk, trees. Cash starts unarmed: a Wardog's machete cuts the
  rope-tied door.
- The pens: grey rock cliffs and outcrops, huge old trees, statues, stone steps, concrete moats under
  chain-link, a cave with the crowbar (guarded); a padlocked iron gate at the top.
- Past the gate a Wardog sniper (tranquilliser rifle) runs onto a wooden platform; then the brick restaurant
  with a red door and green windows, kiosks with red roofs, vending machines; out the back to a barred gate.
- After the scene (cutscene list): the Journalist's video diary.
- Map lesson: this map's lanes are one cell wide; any solid prop (lamp pole, tree, rock, cave wall) can cut
  the level in two. Check with a fresh flood after dressing.

## Strapped for Cash (video 136:00–163:13) — the other half of the zoo, foggy
- Starts where Grounds for Assault ended. Cash's family are held as bait (four of them) under armed Wardogs;
  if a guard spots Cash near one, that one is shot. Save at least one.
- Foggy night: stone walls, chain-link gorilla enclosures with rock mounds and trees, giraffe statues,
  a tunnel and a hill, a cafeteria with pink walls and patterned carpet (break the window), the geodesic
  monkey dome, the shark's mouth into the aquarium: blue wave-painted walls, an empty pool, the souvenir
  shop with the fire exit. Revolvers and tranquilliser rifles on the Wardogs; scoped sniping.
- The wiki's radar for this scene has the same outline as Grounds for Assault (same zoo, "zoo2").
- Outro (cutscene list): the Cerberus take Cash again; this time he goes quietly.
