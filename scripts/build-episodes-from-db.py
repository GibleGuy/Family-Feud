#!/usr/bin/env python3
"""Build episode CSVs from exact question text in the Family Feud database."""

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANSWERS = ROOT / "Answers"
OUT = ANSWERS / "Episodes"

DB_FILES = {
    7: "Family Feud Question Database - 7 Answers.csv",
    6: "Family Feud Question Database - 6 Answers.csv",
    5: "Family Feud Question Database - 5 Answers.csv",
    4: "Family Feud Question Database - 4 Answers.csv",
    3: "Family Feud Question Database - 3 Answers.csv",
}

# Round N expects N answers (classic face-off counts)
ROUND_COUNTS = {1: 7, 2: 6, 3: 5, 4: 4, 5: 3}


def normalize(q: str) -> str:
    q = q.strip().lower()
    q = q.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    q = q.replace("\u201c", '"').replace("\u201d", '"')
    q = re.sub(r"\s+", " ", q)
    return q


def load_all():
    """Index every question by normalized text -> {question, answers, n}."""
    index = {}
    for n, filename in DB_FILES.items():
        path = ANSWERS / filename
        with path.open(encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if not row or not str(row[0]).strip():
                    continue
                q = str(row[0]).strip()
                answers = []
                for i in range(1, len(row) - 1, 2):
                    text = str(row[i]).strip() if i < len(row) else ""
                    try:
                        pts = int(row[i + 1]) if i + 1 < len(row) and str(row[i + 1]).strip() else 0
                    except ValueError:
                        pts = 0
                    if text and pts:
                        answers.append({"text": text, "points": pts})
                if len(answers) < 3:
                    continue
                key = normalize(q)
                # Prefer entry whose answer count matches file; keep first if duplicate
                entry = {"question": q, "answers": answers, "n": len(answers), "file_n": n}
                if key not in index or (index[key]["file_n"] != n and n == len(answers)):
                    index[key] = entry
                # Also store under file-specific key for disambiguation
                index[(n, key)] = entry
    return index


def resolve(index, question_substring, prefer_n=None, min_answers=None):
    """Find a question by case-insensitive substring (or exact normalized match)."""
    needle = normalize(question_substring)
    min_n = min_answers or prefer_n or 1

    def ok(entry):
        return len(entry["answers"]) >= min_n

    # Exact + preferred file
    if prefer_n and (prefer_n, needle) in index and ok(index[(prefer_n, needle)]):
        return index[(prefer_n, needle)]
    if needle in index and ok(index[needle]):
        return index[needle]

    matches = []
    for key, entry in index.items():
        if isinstance(key, tuple):
            n, k = key
            if needle not in k or not ok(entry):
                continue
            matches.append(entry)
        elif needle in key and ok(entry):
            matches.append(entry)

    seen = set()
    unique = []
    for m in matches:
        if m["question"] not in seen:
            seen.add(m["question"])
            unique.append(m)

    if not unique:
        raise KeyError(f"No question matching: {question_substring!r} (prefer_n={prefer_n})")

    def sort_key(e):
        prefer_hit = 0 if prefer_n and e["file_n"] == prefer_n else 1
        count_hit = 0 if prefer_n and len(e["answers"]) == prefer_n else 1
        return (prefer_hit, count_hit, abs(len(e["answers"]) - (prefer_n or len(e["answers"]))), len(e["question"]))

    unique.sort(key=sort_key)
    return unique[0]


def trim_answers(entry, n):
    answers = entry["answers"][:n]
    if len(answers) < n:
        raise ValueError(
            f"Need {n} answers for {entry['question']!r}, only have {len(entry['answers'])}"
        )
    return {"question": entry["question"], "answers": answers}


def escape(value):
    s = "" if value is None else str(value)
    if re.search(r'[",\n\r]', s):
        return '"' + s.replace('"', '""') + '"'
    return s


def serialize_episode(name, rounds, fast_money):
    header = (
        "section,slot,question,"
        + ",".join(f"answer_{i},points_{i}" for i in range(1, 9))
    )
    lines = [header]
    lines.append("EPISODE,," + escape(name) + "," + ",".join([""] * 16))

    for slot, item in enumerate(rounds, start=1):
        fields = ["ROUND", str(slot), escape(item["question"])]
        for a in item["answers"]:
            fields.append(escape(a["text"]))
            fields.append(escape(a["points"]))
        while len(fields) < 19:
            fields.append("")
        lines.append(",".join(fields[:19]))

    for slot, item in enumerate(fast_money, start=1):
        fields = ["FM", str(slot), escape(item["question"])]
        for a in item["answers"][:8]:
            fields.append(escape(a["text"]))
            fields.append(escape(a["points"]))
        while len(fields) < 19:
            fields.append("")
        lines.append(",".join(fields[:19]))

    return "\n".join(lines) + "\n"


# Hand-picked from the real CSVs (substring unique enough to resolve).
# rounds: [R1..R5] matching 7/6/5/4/3 answers; fm: five Fast Money prompts.
EPISODES = [
    {
        "file": "01-Family-Life.csv",
        "name": "Family Life",
        "rounds": [
            "Name Something Most Parents Can't Wait Until Their Child Starts Doing On His Own",
            "Name Something Around The House You Might Keep Spare Batteries For",
            "Name something Specific A Married Couple Might Take Turns Doing",
            "Name Something A Baby Spends A Lot Of Time Doing",
            "Why Might A Family Move Into A Bigger House",
        ],
        "fm": [
            "Name Something A Child Might Sleep With",
            "Name Something That Parents Are Always Telling Their kids To Clean",
            "Name Something Kids Love To Eat That Adults Like Too",
            "Name Something A Parent Tries, To Get Their Baby To Sleep",
            "Name Something Chubby That's Cute On A Baby, But Not On An Adult",
        ],
    },
    {
        "file": "02-At-The-Office.csv",
        "name": "At The Office",
        "rounds": [
            "Name A Hygiene Product That You Hope Your Office Mate Uses Every Day",
            "Name A Job Where It Would Be Okay To Yell At Work",
            "Name Something An Employee Sitting In The Cubicle Next To You Might Do",
            "Name A Profession Where You May Receive Lots Of Mail From Strangers",
            "Other Than Illness, Name An Acceptable Excuse For Missing Work",
        ],
        "fm": [
            "Name Something An Office Worker Says They Could Use More Of",
            "Which Quality Do You Think A Boss Looks For First When Hiring A New Employee",
            "Name A Job That A Clumsy Person Would Be Fired From Immediately",
            "Name Something A Telemarketer Probably Hates About Their Job",
            "On A Resume, What Might A Person Claim They Can Do Quickly",
        ],
    },
    {
        "file": "03-Food-And-Kitchen.csv",
        "name": "Food & Kitchen",
        "rounds": [
            "Name Something That Almost Anyone Can Cook",
            "Besides Utensils, Name Something That's Already On The Restaurant Table When You Sit Down",
            "Name Something A Pizza Delivery Person Hates About Their Job",
            "Name A Drink You Get At A Cafe That Most People Can't Make At Home",
            "Name A Kind Of Cookie People Love To Dunk In Milk",
        ],
        "fm": [
            "Name Something You Need To Bake A Cake",
            "Name A Specific Smell From A Diner In The Morning That Makes You Want To Go In",
            "Name a topping you'd put on both a pizza and a taco",
            "Name Something You Do To A Chicken Before You Cook It",
            "Name A Food You Can Cook On A Campfire",
        ],
    },
    {
        "file": "04-Holidays.csv",
        "name": "Holidays",
        "rounds": [
            "Name Something You'd Never Forget To Do On Christmas Day",
            "Besides Thanksgiving, Name A Holiday You Celebrate With A Lot Of Food",
            "Name A Halloween Costume People Wear If They Don't Want To Go All Out",
            "Name A Common Gag Gift At An \"Over The Hill\" Birthday Party",
            "Name A Character Who's Known For Almost Ruining Christmas",
        ],
        "fm": [
            "Name Something About His Job That Santa Claus Might Brag About",
            "Name Something You Use To Decorate Your Face For Halloween",
            "Name Something Your House Is Full Of After Christmas",
            "Name A Halloween Costume You See On Babies, But Rarely See On Their Parents",
            "Name Something No Christmas Party Should Be Without",
        ],
    },
    {
        "file": "05-On-The-Road.csv",
        "name": "On The Road",
        "rounds": [
            "Name Something That Can Stink Up Your Car",
            "Name Something You Do At Home, But Not While Staying In A Hotel",
            "Name Something You'd Hate To Lose At The Airport",
            "Name Something You Hope To Have Your Seat Near While Riding In A Plane",
            "Name Something You Should Probably Book Ahead Of Time If You're Going On Vacation",
        ],
        "fm": [
            "Name Something You Keep In Your Car's Glove Compartment",
            "Name A Place Where Most Americans Go At Least Once For Vacation",
            "Besides Your Plane Ticket, Name Something You Can Spend Money On At An Airport",
            "Why Might You Have To Stop The Car During A Long Ride",
            "Name Something You Expect To See Inside Every Hotel Room",
        ],
    },
    {
        "file": "06-School-Days.csv",
        "name": "School Days",
        "rounds": [
            "Name A School Subject That People Often Become Bad At In Adulthood",
            "Name Something College Roommates Might Argue About",
            "Name A Food Served In An Elementary School Cafeteria",
            "Name Something A College Student Would Write Down On A Calendar",
            "Name A Skill That's More Important For Teens To Learn Today, Than Previously",
        ],
        "fm": [
            "Name Something You'd Find In A School Lost-And-Found Box",
            "Name Something A Kid Might Need To Buy Before Starting A New School Year",
            "Name Something A College Student Might Hide Before His Parents Came To Visit",
            "Name A Reason A Kid Might Get Sent Home From School",
            "Name Something Teens May Be Afraid Of When Moving Away To College",
        ],
    },
    {
        "file": "07-Love-And-Dating.csv",
        "name": "Love & Dating",
        "rounds": [
            "Name Something Specific A Woman Looks At When She First Meets A Man On A Blind Date",
            "Name Something A Married Couple Saves From Their Wedding Day",
            "Name Something Two People On A Date Might Share",
            "We Asked 100 Women: Name A Gift That You'd Always Be Happy To Get From Your Partner",
            "Name A Place Where It Might Be Romantic To Get Stranded With Your Partner",
        ],
        "fm": [
            "Name Something That Both Men And Women Use To Get Ready For A Date",
            "What Are The Most Popular Types Of Flowers Used In A Wedding",
            "Name A Food That People Get Fed In A Romantic Situation",
            "Name An Occasion That A Man Might Propose To His Girlfriend",
            "Who Would A Bride Not Want To Show Up Unannounced At Her Wedding",
        ],
    },
    {
        "file": "08-Sports-And-Games.csv",
        "name": "Sports & Games",
        "rounds": [
            "Name A Sport In Which The Athletes Don't Wear A Lot Of Clothes",
            "Name A Football Bowl Game",
            "Name Something You Might Find In A Tennis Bag",
            "Name A Game Teenagers Play At Parties",
            "Name Something People Bet On",
        ],
        "fm": [
            "Name Something Football Players Wear For Protection",
            "Name Something They Give Away Free To Attract Fans At A Baseball Game",
            "Name Something You Are Embarrassed To Do In Front Of People At The Gym",
            "Name A Game You Played In Gym Class But Doesn't Offer Much Exercise",
            "Name A Professional Football Team That's Named For An Animal",
        ],
    },
    {
        "file": "09-Movies-And-TV.csv",
        "name": "Movies & TV",
        "rounds": [
            "Name A Movie That Wasn't Nearly As Good As The Book",
            "Name A Christmas Show That Is On TV Every Year",
            "Besides \"Family Feud\", Name A Tv Show With \"Family\" In Its Title",
            "Name Something You'd Be Surprised To Find That A Superhero Couldn't Do",
            "Other Than Movie Tickets, Name Something A Crowded Movie Theatre Might Run Out Of",
        ],
        "fm": [
            "Name A Movie Theater Food That Gets Stuck In Your Teeth",
            "Name A Type Of TV Show A Man Might Be Embarrassed To Say He Watches",
            "Name Something That Causes People To Change Seats At The Movies",
            "Name a cartoon character who's always getting hurt",
            "Name Something You See In Horror Movies That Begins With The Letter",
        ],
    },
    {
        "file": "10-Around-The-House.csv",
        "name": "Around The House",
        "rounds": [
            "Name Something You'd Probably Find In A Baby's Bedroom",
            "Name something you might do if you heard a burglar in your house",
            "Name Something Dog Owners Probably Wish Their Dogs Never Did",
            "Name A Piece Of furniture That's Too big To Fit In A VW Bug",
            "Name The Most Used Piece Of Furniture In A House",
        ],
        "fm": [
            "Name Something From The Laundry That's Impossible To Fold Neatly",
            "Unlike Dogs, Name A Type Of Pet That People Don't Count On To Guard Their House",
            "What Might You Ask To Borrow From Someone At The Laundromat",
            "Name A Gift You'd Be Likely To Get As A House Warming Present From Your New Neighbors",
            "Name Something That Expands In The Microwave",
        ],
    },
]


def main():
    index = load_all()
    print(f"Indexed {len([k for k in index if isinstance(k, str)])} unique questions")

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.csv"):
        old.unlink()

    used = set()
    for spec in EPISODES:
        rounds = []
        for i, needle in enumerate(spec["rounds"], start=1):
            need = ROUND_COUNTS[i]
            entry = resolve(index, needle, prefer_n=need, min_answers=need)
            item = trim_answers(entry, need)
            if item["question"] in used:
                print(f"WARNING: duplicate question: {item['question']}")
            used.add(item["question"])
            rounds.append(item)

        fm = []
        for needle in spec["fm"]:
            entry = resolve(index, needle, prefer_n=None)
            # Fast Money: keep up to 8 answers from the survey
            item = {
                "question": entry["question"],
                "answers": entry["answers"][:8],
            }
            if item["question"] in used:
                print(f"WARNING: duplicate FM: {item['question']}")
            used.add(item["question"])
            fm.append(item)

        csv_text = serialize_episode(spec["name"], rounds, fm)
        (OUT / spec["file"]).write_text(csv_text, encoding="utf-8")
        print(f"\n{spec['file']}: {spec['name']}")
        for i, r in enumerate(rounds, 1):
            print(f"  R{i} ({len(r['answers'])}): {r['question'][:75]}")
        for i, q in enumerate(fm, 1):
            print(f"  FM{i} ({len(q['answers'])}): {q['question'][:75]}")

    print(f"\nDone. {len(EPISODES)} episodes, {len(used)} unique DB questions.")


if __name__ == "__main__":
    main()
