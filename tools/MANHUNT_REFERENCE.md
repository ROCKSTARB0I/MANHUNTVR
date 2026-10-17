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
