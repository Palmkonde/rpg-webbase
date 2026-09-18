## The canonical layout

`grid-engine`'s default character-animation model (`characterIndex`) expects a fixed grid: one row of 3 frames per cardinal direction.

```
                    col 0            col 1            col 2
                 (left foot)       (standing)       (right foot)
              ┌────────────────┬────────────────┬────────────────┐
   row 0      │                │                │                │
   DOWN       │   frame 0      │   frame 1      │   frame 2      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 1      │                │                │                │
   LEFT       │   frame 3      │   frame 4      │   frame 5      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 2      │                │                │                │
   RIGHT      │   frame 6      │   frame 7      │   frame 8      │
              │                │                │                │
              ├────────────────┼────────────────┼────────────────┤
   row 3      │                │                │                │
   UP         │   frame 9      │   frame 10     │   frame 11     │
              │                │                │                │
              └────────────────┴────────────────┴────────────────┘
```
