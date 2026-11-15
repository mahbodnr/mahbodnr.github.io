# Picture card packs

Each folder holds one SVG per card (`S01` … `S13`, `H…`, `D…`, `C…`, 250×350) and the pack's `back.svg`. They come from
the SVG card kits supplied for the game by its author:

| Folder | Kit | Unlocks at |
| --- | --- | --- |
| `seasons` | Four Seasons SVG Kit | level 2 |
| `jungle` | Hand Drawn SVG Kit, recoloured (see below) | level 5 |
| `clockwork` | Clockmaker SVG Kit | level 10 |
| `oneline` | One Line SVG Kit | level 15 |
| `deco` | Art Deco Casino SVG Kit | level 20 |
| `arcade` | Retro Arcade SVG Kit | level 25 |

`tools/build-packs.mjs <folder with the unzipped kits>` makes them: the first four kits have every card drawn and
are copied with comments, titles and spacing removed (numbers rounded to two decimals); the Art Deco Casino kit is
put together from its parts (`symbols.svg`) and `layout.json`, as its README and examples describe. The kits have
no Joker; each pack's `J.svg` (both Jokers) comes from the Six Jokers SVG Kit, one per deck.

**Jungle** is the Hand Drawn kit with its suits recoloured to the game's four colours, so they tell apart at a glance:
in the kit's `layout.json`, the suits' `suitInk`, `wash` and `courtPaper` (spades `#22262e`, hearts `#c22a2f`, clubs
`#1f7a3a`, diamonds `#e0620f`) and the ace sketches' wash and hatching, then the kit's own `build_deck.py`; the kit
folder is then named `jungle-svg` for `tools/build-packs.mjs`.

The Classic back (`img/back-classic.svg`) is the traditional red diamond-lattice back, drawn for the game.
