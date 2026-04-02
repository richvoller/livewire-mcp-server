# Livewire MCP Server -- Your Private SEO Data Server for Claude

> Give Claude direct access to your Google Search Console, Google Analytics, PageSpeed Insights, rank tracking, and (optionally) SEMrush or Ahrefs data -- all running privately on your own computer.

Built by [Livewire](https://livewire.marketing) for SEO professionals, agency owners, and freelancers who want to have real conversations with their data inside Claude. No coding experience required -- just follow the steps below.
A more in depth tutorial and video walkthrough is available at: https://livewire.marketing/blog/mcp-server-seo-analysis


---

## What Does This Do?

This software runs a small private server on your computer that Claude can talk to. When you ask Claude a question like *"What are my top 10 pages in Search Console this month?"*, Claude calls your server, your server fetches the data from Google (or SEMrush, Ahrefs, SERPRobot, etc.), and hands it back to Claude so it can give you a proper answer.

Nothing leaves your machine except the normal API calls to Google and your other SEO tools. Your API keys stay on your computer.

### Tools Included

| Tool | Source | Status |
|------|--------|--------|
| **Google Search Console** | Clicks, impressions, CTR, position by page and query | Core (always on) |
| **Google Analytics 4** | Sessions, users, bounce rate, conversions, daily trends | Core (always on) |
| **PageSpeed Insights** | Core Web Vitals, Lighthouse scores (mobile and desktop) | Core (always on) |
| **Rank Tracker** | Keyword positions from SERPRobot (or your own provider) | Core (always on) |
| **SEMrush** | Domain analytics, organic keywords, backlink overview | Optional -- add your API key to activate |
| **Ahrefs** | Domain rating, backlinks, organic keyword estimates | Optional -- add your API key to activate |

---

## What You Will Need

Before you start, make sure you have these things ready:

1. **A computer** (Mac or Windows)
2. **Claude Desktop app** -- download from [claude.ai/download](https://claude.ai/download)
3. **A text editor** -- we recommend [VS Code](https://code.visualstudio.com/) (free) but any editor works
4. **Node.js v18 or later** -- this runs the server. Download from [nodejs.org](https://nodejs.org/) (choose the LTS version)
5. **A Google Cloud account** -- free to create at [console.cloud.google.com](https://console.cloud.google.com/)
6. **Access to Google Search Console and GA4** for the website(s) you want to query

Optional:
- A **SEMrush** subscription with API access
- An **Ahrefs** subscription with API access
- A **SERPRobot** account (free API access for existing projects)

---

## Step-by-Step Setup

### Step 1 -- Install Node.js

Node.js is what runs the server. You only need to install it once.

1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS** version (the big green button)
3. Run the installer and accept all the defaults
4. To check it worked, open your terminal and type:

```bash
node --version
```

You should see something like `v18.x.x` or higher. If you see an error, restart your terminal and try again.

> **What is a terminal?**
> - **Mac:** Open the app called "Terminal" (search for it in Spotlight with Cmd + Space)
> - **Windows:** Open "Command Prompt" or "PowerShell" (search for it in the Start menu)

---

### Step 2 -- Download This Project

**Option A -- Download as a ZIP (easiest)**

1. Download this repository as a ZIP file
2. Unzip it to a folder you can find easily, for example:
   - **Mac:** `/Users/yourname/livewire-mcp-server`
   - **Windows:** `C:\Users\yourname\livewire-mcp-server`

**Option B -- Clone with Git (if you have Git installed)**

```bash
git clone <your-repo-url> livewire-mcp-server
```

---

### Step 3 -- Install Dependencies

Open your terminal and navigate to the project folder, then run:

```bash
cd /Users/yourname/livewire-mcp-server
npm install
```

> Replace `/Users/yourname/livewire-mcp-server` with the actual path to where you put the folder.

This downloads the small number of packages the server needs. You should see a `node_modules` folder appear -- that means it worked.

---

### Step 4 -- Create Your Google Cloud Project and API Credentials

This is the longest step, but you only do it once. These credentials are used by Google Search Console, GA4, and PageSpeed Insights.

#### 4a -- Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Sign in with the Google account that has access to your Search Console and GA4
3. Click the project dropdown at the top of the page (it may say "Select a project")
4. Click **New Project**
5. Name it something like `Livewire MCP Server`
6. Click **Create**
7. Make sure your new project is selected in the dropdown

#### 4b -- Enable the APIs

You need to turn on three APIs inside your Google Cloud project:

1. Go to **APIs and Services > Library** (use the left-hand menu or search bar)
2. Search for and enable each of these (click on each one, then click **Enable**):
   - **Google Search Console API**
   - **Google Analytics Data API** (this is the GA4 one -- make sure it says "Data API", not "Analytics API")
   - **PageSpeed Insights API**

#### 4c -- Create OAuth 2.0 Credentials (for Search Console and GA4)

1. Go to **APIs and Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Choose **External** (or Internal if you have a Google Workspace)
   - Fill in the app name (e.g., `Livewire MCP`) and your email
   - You can skip optional fields -- just click through until it is saved
   - Add your own email as a **test user**
4. Go back to **Credentials > + Create Credentials > OAuth client ID**
5. Application type: **Web application**
6. Name: `Livewire MCP`
7. Under **Authorised redirect URIs**, add: `https://developers.google.com/oauthplayground`
8. Click **Create**
9. A popup will show your **Client ID** and **Client Secret** -- copy these somewhere safe (you will need them shortly)

#### 4d -- Generate a Refresh Token

Google uses OAuth tokens that expire every hour. A *refresh token* lets the server automatically get a new one without you logging in each time.

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground/)
2. Click the **gear icon** in the top right
3. Check **"Use your own OAuth credentials"**
4. Paste in your **Client ID** and **Client Secret** from the previous step
5. Close the settings panel
6. In the left sidebar, find and select these scopes (tick the boxes):
   - `https://www.googleapis.com/auth/webmasters.readonly` (Search Console)
   - `https://www.googleapis.com/auth/analytics.readonly` (GA4)
7. Click **Authorize APIs**
8. Sign in with your Google account and grant permission
9. Click **Exchange authorization code for tokens**
10. Copy the **Refresh Token** from the response -- this is the long string you need

> **Important:** Keep your Client ID, Client Secret, and Refresh Token private. Never share them publicly or commit them to Git.

#### 4e -- Create a PageSpeed Insights API Key

1. Go back to [console.cloud.google.com](https://console.cloud.google.com/) (make sure your project is selected)
2. Go to **APIs and Services > Credentials**
3. Click **+ Create Credentials > API Key**
4. Copy the API key that appears
5. (Optional but recommended) Click **Restrict Key**, then under **API restrictions**, select **PageSpeed Insights API** only -- this limits what the key can do if it ever leaks

---

### Step 5 -- Find Your GA4 Property ID

1. Go to [analytics.google.com](https://analytics.google.com/)
2. Click the **gear icon** (Admin) in the bottom left
3. In the **Property** column, click **Property Settings**
4. Your **Property ID** is the number shown at the top (e.g., `123456789`)

---

### Step 6 -- Create Your .env File

The `.env` file is where all your API keys live. It is a plain text file -- nothing fancy.

1. Open the project folder in VS Code (or your text editor)
2. Find the file called `.env.example`
3. Make a copy of it and rename the copy to `.env`

   **From the terminal:**
   ```bash
   cp .env.example .env
   ```

   **Or in VS Code:** Right-click `.env.example`, select Copy, then paste and rename to `.env`

4. Open your new `.env` file and replace the placeholder values with your real credentials:

```env
# CORE -- fill all of these in
GSC_CLIENT_ID=your_actual_client_id_here
GSC_CLIENT_SECRET=your_actual_client_secret_here
GSC_REFRESH_TOKEN=your_actual_refresh_token_here
GA4_PROPERTY_ID=your_actual_property_id_here
PAGESPEED_API_KEY=your_actual_pagespeed_api_key_here

# RANK TRACKER -- fill in your SERPRobot API key (leave the URL as-is)
RANK_TRACKER_API_KEY=your_serprobot_api_key_here
RANK_TRACKER_API_BASE_URL=https://www.serprobot.com/api

# OPTIONAL -- remove the # at the start of the line to activate
# SEMRUSH_API_KEY=your_semrush_api_key_here
# AHREFS_API_KEY=your_ahrefs_api_key_here
```

> **Activating SEMrush or Ahrefs:** Simply remove the `#` at the start of the line and replace the placeholder with your real API key. The server detects these automatically -- no other changes needed.

Save the file.

---

### Step 7 -- Connect to Claude Desktop

Claude Desktop needs to know where your server is. You do this by editing a small configuration file.

#### Find the Claude config file

- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

> **Mac tip:** The `Library` folder is hidden by default. In Finder, click **Go** in the menu bar, hold the **Option** key, and you will see "Library" appear. Navigate to `Application Support > Claude`.

> **Windows tip:** Press `Win + R`, type `%APPDATA%\Claude` and press Enter to go straight there.

If the file does not exist yet, create it.

#### Edit the config file

Open `claude_desktop_config.json` in VS Code (or any text editor) and set its contents to:

```json
{
  "mcpServers": {
    "livewire-seo": {
      "command": "node",
      "args": [
        "/FULL/PATH/TO/livewire-mcp-server/src/server.js"
      ]
    }
  }
}
```

**Replace `/FULL/PATH/TO/livewire-mcp-server/src/server.js`** with the real path to the `server.js` file on your computer. For example:

- **Mac:** `"/Users/sarah/livewire-mcp-server/src/server.js"`
- **Windows:** `"C:\\Users\\sarah\\livewire-mcp-server\\src\\server.js"`

> **Windows users:** Use double backslashes (`\\`) in the path, or use forward slashes (`/`) instead.

> **How to find the full path:** In VS Code, right-click the file `src/server.js` in the sidebar and select **Copy Path**. Paste that into the config.

Save the file.

---

### Step 8 -- Restart Claude Desktop and Test

1. **Fully quit** Claude Desktop (do not just close the window -- right-click the dock/taskbar icon and quit)
2. Reopen Claude Desktop
3. Look for a small **hammer icon** in the chat input area -- this means Claude has found your tools
4. Click the hammer icon to see the list of available SEO tools

Try these example prompts:

- *"What are my top 10 pages in Google Search Console for the last 30 days for sc-domain:example.com?"*
- *"Run a PageSpeed test on https://example.com for mobile"*
- *"Show me my GA4 traffic data for property 123456789 for the past 7 days"*
- *"Get my keyword rankings from SERPRobot project 12345"*

If you activated SEMrush or Ahrefs, also try:

- *"Get the SEMrush organic keywords report for example.com"*
- *"What is the Ahrefs domain rating for example.com?"*

---

## Project Structure

```
livewire-mcp-server/
├── package.json               # Dependencies and scripts
├── .env.example               # Template -- copy this to .env
├── .env                       # YOUR credentials (never share this file)
├── .gitignore                 # Keeps .env out of version control
├── claude_desktop_config.json # Sample Claude Desktop config
├── README.md                  # You are here
└── src/
    ├── server.js              # Core MCP server (entry point)
    ├── tools/
    │   ├── index.js           # Tool registry (loads core + optional tools)
    │   ├── gsc.js             # Google Search Console connector
    │   ├── ga4.js             # Google Analytics 4 connector
    │   ├── pagespeed.js       # PageSpeed Insights connector
    │   ├── ranktracker.js     # Rank Tracker -- pre-configured for SERPRobot
    │   ├── semrush.js         # SEMrush connector (optional)
    │   └── ahrefs.js          # Ahrefs connector (optional)
    └── utils/
        └── rateLimiter.js     # Rate limiting to protect API quotas
```

---

## Activating Optional Tools (SEMrush and Ahrefs)

SEMrush and Ahrefs are **disabled by default**. The server checks your `.env` file at startup -- if it finds an API key for either service, it automatically enables that tool. No code changes required.

### To activate SEMrush

1. Open your `.env` file
2. Find the line `# SEMRUSH_API_KEY=your_semrush_api_key_here`
3. Remove the `#` at the start so it reads: `SEMRUSH_API_KEY=your_actual_key`
4. Replace `your_actual_key` with your real SEMrush API key
5. Save the file and restart Claude Desktop

### To activate Ahrefs

1. Open your `.env` file
2. Find the line `# AHREFS_API_KEY=your_ahrefs_api_key_here`
3. Remove the `#` at the start so it reads: `AHREFS_API_KEY=your_actual_key`
4. Replace `your_actual_key` with your real Ahrefs API key (Bearer token)
5. Save the file and restart Claude Desktop

> **Where to get your API keys:**
> - **SEMrush:** Log into SEMrush, go to [semrush.com/api/](https://www.semrush.com/api/), your API key is shown on the page (requires a paid plan with API access)
> - **Ahrefs:** Log into Ahrefs, go to [ahrefs.com/api](https://ahrefs.com/api), create or copy your API token

---

## Rank Tracker Setup

### Using SERPRobot (Default -- Free API Access)

The rank tracker is pre-configured for [SERPRobot](https://www.serprobot.com/). SERPRobot lets you check keyword rankings and their API is free to pull data from projects you have already set up.

1. Create a free account at [serprobot.com](https://www.serprobot.com/)
2. Set up a project with your domain and keywords
3. Find your API key in your SERPRobot account settings
4. Add it to your `.env` file:

```env
RANK_TRACKER_API_KEY=your_serprobot_api_key_here
RANK_TRACKER_API_BASE_URL=[https://www.serprobot.com/api](https://api.serprobot.com/v1/api.php)
```

5. Restart Claude Desktop

### Swapping Your Rank Tracker

If you use a different rank tracking tool (e.g., AccuRanker, Wincher, SERPWatcher, Nightwatch, or any other provider), you can adapt the `src/tools/ranktracker.js` file to work with their API instead.

**You do not need to be a developer to do this.** Here is exactly what to do:

1. Find your rank tracker provider's **API documentation** (usually on their website under "API" or "Developers")
2. Open the file `src/tools/ranktracker.js` in VS Code
3. Select **all** the text in the file and copy it
4. Open [ChatGPT](https://chat.openai.com/) (or any AI assistant) and paste in the following prompt:

```
I have this Node.js file that connects to a rank tracking API.
It is currently configured for SERPRobot. I want to change it
to work with [YOUR PROVIDER NAME] instead.

Here is their API documentation:
[PASTE THE RELEVANT API DOCS OR A LINK]

Here is my current file:
[PASTE THE CONTENTS OF ranktracker.js]

Please rewrite the file to work with [YOUR PROVIDER NAME] while
keeping the same overall structure (toolDefinition and handler
exports). Keep all the comments in the same style.
```

5. Copy the rewritten code from ChatGPT
6. Paste it back into `src/tools/ranktracker.js` in VS Code (replacing everything)
7. Update the `RANK_TRACKER_API_KEY` and `RANK_TRACKER_API_BASE_URL` values in your `.env` file to match your provider
8. Save both files and restart Claude Desktop

> **Testing your changes:** You can test the server manually by running `node src/server.js` in your terminal. If there are errors in your code, they will be printed here -- you can paste those error messages back into ChatGPT to get help fixing them.

---

## Adding Your Own Custom Tools

Want Claude to access another data source? You can add new tools by creating a new file. Here is the process:

1. Duplicate one of the existing tool files (e.g., copy `src/tools/pagespeed.js` and rename it to `src/tools/myTool.js`)
2. Edit the `toolDefinition` object to describe your new tool (name, description, inputs)
3. Edit the `handler` function to call your API
4. Open `src/tools/index.js` and add your new tool to the list (follow the pattern you see for the existing tools)
5. Restart Claude Desktop

If you are not comfortable writing code, use the same ChatGPT approach described in the rank tracker section -- paste an existing tool file plus your API's documentation and ask ChatGPT to create the new tool for you.

---

## Rate Limiting

The server includes a built-in rate limiter to prevent accidental API overuse (which could cost you money on paid APIs). You can configure it in your `.env` file:

```env
RATE_LIMIT_MAX_REQUESTS=30    # Max requests per 60-second window
RATE_LIMIT_WINDOW_MS=60000    # Window duration in milliseconds (60000 = 60 seconds)
```

If Claude tells you *"Rate limit exceeded"*, just wait a minute and try again, or increase the `RATE_LIMIT_MAX_REQUESTS` number.

---

## Troubleshooting

### Tools not showing in Claude (no hammer icon)

- Make sure the path in `claude_desktop_config.json` is the **full absolute path** to `src/server.js` -- not a relative path
- Double-check you saved the config file
- **Fully quit** Claude Desktop and reopen it (just closing the window is not enough)
- On Windows, make sure you used `\\` or `/` in the path, not single `\`

### "Credentials not configured" error

- Open your `.env` file and make sure the placeholder values have been replaced with your real credentials
- Make sure the file is named exactly `.env` (not `.env.txt` or `.env.example`)
- The `.env` file must be in the root of the project folder (same level as `package.json`)

### Google API errors (401 or 403)

- Your refresh token may have expired -- go back to the [OAuth Playground](https://developers.google.com/oauthplayground/) and generate a new one
- Make sure all three Google APIs are **enabled** in your Google Cloud project
- Check that your Google account has access to the Search Console property and GA4 property you are querying

### Rate limit errors

- Wait 60 seconds and try again
- Or increase `RATE_LIMIT_MAX_REQUESTS` in your `.env` file

### Server not starting or general errors

Run the server manually in your terminal to see what is wrong:

```bash
node /Users/yourname/livewire-mcp-server/src/server.js
```

The error messages will tell you what is missing or broken. Common issues:

- **"Cannot find module"** -- you forgot to run `npm install` in Step 3
- **"ENOENT .env"** -- the `.env` file does not exist -- go back to Step 6

### Still stuck?

Copy the error message and paste it into ChatGPT or Claude with the question *"I am getting this error when running my Node.js MCP server -- what does it mean and how do I fix it?"* -- nine times out of ten, you will get a clear answer.

---

## Updating the Server

If we release an update to the Livewire MCP Server:

1. Download or pull the latest version
2. Run `npm install` again (in case dependencies have changed)
3. Check if `.env.example` has any new variables -- if so, add them to your `.env` file
4. Restart Claude Desktop

Your `.env` file will not be overwritten because it is listed in `.gitignore`.

---

## Security Notes

- Your `.env` file contains sensitive API keys -- **never share it** and never commit it to Git
- The `.gitignore` file is already set up to exclude `.env` from version control
- All data flows directly between your computer and the APIs (Google, SEMrush, etc.) -- nothing passes through any third-party server
- The server only runs locally on your machine -- it is not accessible from the internet

---

## License

MIT
