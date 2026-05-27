# Canvas Study MCP

A Model Context Protocol server that gives Claude access to your Canvas LMS course materials — turning it into a study assistant grounded in your actual coursework.

## What it does

- **Browse courses** — see all your enrolled courses
- **Explore modules** — understand how each course is structured
- **Read files** — extract text from PDFs and lecture notes
- **Read pages** — access instructor-written wiki pages and summaries
- **Check assignments** — see what's due and what topics to focus on

## Setup

### 1. Get your Canvas API token

1. Log into Canvas
2. Go to **Account → Settings**
3. Scroll to **Approved Integrations** → click **New Access Token**
4. Give it a name (e.g. "Study Assistant") and generate

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
CANVAS_TOKEN=your_token_here
CANVAS_DOMAIN=https://your-institution.instructure.com
```

### 3. Install and build

```bash
npm install
npm run build
```

### 4. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "canvas-study": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-study-mcp/dist/index.js"],
      "env": {
        "CANVAS_TOKEN": "your_token_here",
        "CANVAS_DOMAIN": "https://your-institution.instructure.com"
      }
    }
  }
}
```

Restart Claude Desktop and you're ready.

## Example prompts

- *"What courses am I enrolled in?"*
- *"Show me the modules for my Biology course"*
- *"Read the Week 3 lecture notes and summarise the key concepts"*
- *"What assignments are due this week in my History course?"*
- *"Quiz me on the content from the lecture slides in Module 2"*

## Supported file types

| Type | Extraction |
|------|------------|
| PDF | ✅ Full text |
| Plain text | ✅ Full text |
| HTML pages | ✅ Full text |
| PPTX / DOCX | ⚠️ Coming soon |

## Roadmap

- [ ] PPTX and DOCX text extraction
- [ ] Discussion post access
- [ ] Announcement fetching
- [ ] Semantic search across all course content
- [ ] OAuth2 for multi-user support
