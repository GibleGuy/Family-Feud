# How to Run — Family Feud Live

This game syncs the Main Board and Host Panel with the `BroadcastChannel` API and loads local CSV / JSON question files. Run it through a **local web server** (not by double-clicking HTML files as `file://`).

## Quick start (Windows)

1. Double-click **`Run Game (Windows).bat`**.
2. Open [http://127.0.0.1:8192](http://127.0.0.1:8192) in Chrome, Edge, or Firefox.
3. Put the Main Board on your TV / projector (fullscreen with **F11**).
4. Click **Open Admin Panel** on the board and keep that window on your laptop.

## Other ways to start a server

### Python

```bash
python -m http.server 8192
```

Then open [http://127.0.0.1:8192](http://127.0.0.1:8192).

### VS Code Live Server

1. Install the **Live Server** extension.
2. Right-click `index.html` → **Open with Live Server**.
3. Prefer port **8192** if you configure it, so paths match the bat file docs.

## Hosting the show

See **[HOSTING_GUIDE.md](HOSTING_GUIDE.md)** for the full host playbook: survey rounds, strikes, awarding points, Sudden Death, and Fast Money.

## Adding custom questions

Edit the `.csv` files inside `Answers/` with Excel or Google Sheets. Format:

`Question,Answer 1,#1,Answer 2,#2` …

Fast Money uses `Answers/allQuestions.json`.

## Custom Episodes

Use the **Custom Episode Builder** on the Host Panel (`admin.html`) to create a full show (5 survey rounds + Fast Money), download it as CSV, upload later, and print host cue cards.

Episode CSV format (one episode per file):

```text
section,slot,question,answer_1,points_1,...,answer_8,points_8
EPISODE,,Episode Name,,,,,,,,,,,,,,
ROUND,1,...,up to 8 answer pairs (blank slots skipped)
...
FM,5,...,up to 8 answer pairs
```

The builder always shows 8 answer slots per question; leave extras blank. Sample episodes live in `Answers/Episodes/`. On first load they appear in the Active Episode dropdown.
