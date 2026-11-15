# Picture card packs

Each folder holds one SVG per card (`S01` … `S13`, `H…`, `D…`, `C…`, 250×350) and the pack's `back.svg`. They come from
the SVG card kits supplied for the game by its author:

| Folder | Kit | Unlocks at |
| --- | --- | --- |
| `arcade` | Retro Arcade SVG Kit | level 2 |
| `sketch` | Hand Drawn SVG Kit | level 5 |
| `seasons` | Four Seasons SVG Kit | level 10 |
| `clockwork` | Clockmaker SVG Kit | level 15 |
| `deco` | Art Deco Casino SVG Kit | level 20 |

`tools/build-packs.mjs <folder with the unzipped kits>` makes them: the first four kits have every card drawn and
are copied with comments, titles and spacing removed (numbers rounded to two decimals); the Art Deco Casino kit is
put together from its parts (`symbols.svg`) and `layout.json`, as its README and examples describe. The kits have
no Joker: the game draws its own, in the pack's colours.

The Classic back (`img/back-classic.svg`) is the traditional red diamond-lattice back, drawn for the game.
