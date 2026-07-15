# Family Feud — Hosting Guide

A practical playbook for running a live show with the **Main Board** (TV / projector) and the **Host Panel** (your laptop).

## Before Guests Arrive

1. Double-click **`Run Game (Windows).bat`** (or start a local server on port **8192**).
2. Open the Main Board at [http://127.0.0.1:8192](http://127.0.0.1:8192).
3. Drag that window to the TV / projector and go fullscreen (**F11**).
4. Click **Open Admin Panel** on the board — keep that window on your laptop.
5. Type family names on the board (left / right side panels).
6. Confirm the Host Panel shows loaded question chips under **Load Questions** (CSVs auto-load from `Answers/`).

> Do **not** open `admin.html` by double-clicking the file. Both windows must be served over `http://` so they can sync.

## Survey Rounds (Main Game)

### Setup each round

1. Click a **Select Round** tab (1–5). This updates the live board round and answer count.
2. Pick a question (or hit **Random**).
3. Click **Load locally** — you can see the answers; the audience cannot yet.
4. When you’re ready, click **Show on Board** — the question appears for everyone.

### During play

| Action | What to do |
|--------|------------|
| Correct answer | Click that answer in the Host Panel grid — it flips on the board and adds to the bank |
| Wrong answer | Click **Strike** (each click adds one X up to 3; after 3, **Steal Miss** shows a single X) |
| Accidental reveal | Use the small **×** on a revealed answer to hide it again |
| End of round | Award the bank to the winning family, then **Next Round** |

### Strikes & bank

- The Host Panel and Main Board both show a **strike tally** (up to 3).
- Points pile up in the **bank**. Multiplier rounds (3–5) show **Will award: N pts**.
- Awarding a family **clears the bank** so you can’t accidentally award twice.
- Award buttons stay disabled while the bank is empty.

### Round cheat sheet

| Round | Answers | Bank multiplier |
|-------|---------|-----------------|
| 1 | 7 | 1× |
| 2 | 6 | 1× |
| 3 | 5 | 2× |
| 4 | 4 | 3× |
| 5 Sudden Death | 3 | 3× |

**Sudden Death (Round 5):** Use **Show Rules on Main Board** if you want the rules overlay before the face-off. First family to get the #1 answer (highest points) typically wins the face-off — run it how your house rules prefer, then award and move on.

## Fast Money

1. Click **Start Fast Money** when the main surveys are done.
2. Follow the numbered steps in the Host Panel:
   1. **Player 1** — 20 seconds; type answers in the rows as they speak
   2. **Hide Player 1** — so Player 2 can’t see their board
   3. **Player 2** — 25 seconds; press **D** (or Duplicate) if they match Player 1
   4. **Reveal & Score** — reveal answers and points on the public board
3. Goal is **200** points. The Host Panel shows a running total and a win badge.
4. **Back to Main Game** exits Fast Money.

Tips:

- Survey answer keys under each question set **points only** — still type what the player said in the answer box.
- The **0** button marks a wrong / zero-point answer.
- **Re-randomize** picks five new private questions (audience never sees the question text).

## Soundboard

Use the Host Panel soundboard for intro, new round, win sting, commercial bumper, and Fast Money closing music. **Stop Playback** cuts everything.

Reveal, strike, and award sounds play automatically from gameplay.

## Emergency / fixes

| Problem | Fix |
|---------|-----|
| Admin and board out of sync | Refresh both windows (board first, then reopen Admin from the board button) |
| Wrong score | Use **Score Override**, then **Update** |
| Need a fresh start | **Reset to Title** (asks for confirmation) |
| Opened via `file://` | Close windows; run the bat file; open via `http://127.0.0.1:8192` |

## Custom questions

Edit the CSV files in `Answers/` (Excel or Google Sheets). Keep the format:

`Question,Answer 1,#1,Answer 2,#2, ...`

For Fast Money, questions come from `Answers/allQuestions.json`.

---

For technical setup details, see [HOW_TO_RUN.md](HOW_TO_RUN.md).
