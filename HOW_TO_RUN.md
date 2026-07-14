# How to Run — Family Feud Live

Since this game uses the `BroadcastChannel` API to sync data between the Main Board and the Admin Window, and because it automatically parses local CSV files, it is **highly recommended** to run the game through a local web server (instead of just double-clicking `index.html` to open it as a `file:///` path).

## Step 1: Start a Local Server

You can do this using any method you prefer. Two common ways:

### Method A: Python (Recommended, if installed)
1. Open your terminal / command prompt.
2. Navigate to this folder (`Family Feud`).
3. Run the following command:
   ```bash
   python -m http.server 8080
   ```
4. This will start a local server on port 8080.

### Method B: VS Code Live Server
1. Open this folder in Visual Studio Code.
2. Install the **"Live Server"** extension (by Ritwick Dey).
3. Right click on `index.html` and select **"Open with Live Server"**.

## Step 2: Open the Main Board
1. Open your web browser (Chrome, Edge, or Firefox).
2. Go to `http://localhost:8080` (or whatever address your local server gave you).
3. This is the **Main Board**. Drag this browser window to your TV or projector screen, and put it in Fullscreen mode (F11).

## Step 3: Open the Admin Panel
1. Click the **"⚙️ Open Admin Control Panel"** button located in the top-right corner of the Main Board.
2. This will open the Admin Panel in a new tab.
3. Keep this Admin tab on your laptop screen. (The button on the Main Board will automatically hide itself while the Admin panel is open).

## Step 4: Play!
- The game will automatically load the provided CSV files in the `Answers/` folder.
- Select your Round (1 through 4), pick a question from the dropdown, and click **"▶ Load locally"**.
- When you are ready for the audience to see the question, click **"👁 Show on Board"**.
- Click the answers on your Admin panel to reveal them on the big screen!

## Adding Custom Questions
You can add your own questions by editing the `.csv` files inside the `Answers/` folder using Microsoft Excel or Google Sheets. Just make sure the format matches:
`Question,Answer 1,#1,Answer 2,#2` etc.
