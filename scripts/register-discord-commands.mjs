const appId = process.env.DISCORD_APP_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!appId || !botToken) {
  console.error("DISCORD_APP_ID and DISCORD_BOT_TOKEN are required.");
  process.exit(1);
}

const optionTypes = {
  SUB_COMMAND: 1,
  STRING: 3,
  ATTACHMENT: 11,
};

const commands = [
  {
    name: "kb",
    description: "Ask or update the knowledge base in natural language",
    options: [
      {
        type: optionTypes.STRING,
        name: "request",
        description: "Example: remember that the launch date moved to June",
        required: true,
      },
    ],
  },
  {
    name: "kb-admin",
    description: "Use exact knowledge-base operations",
    options: [
      {
        type: optionTypes.SUB_COMMAND,
        name: "do",
        description: "Describe what you want in natural language",
        options: [
          {
            type: optionTypes.STRING,
            name: "request",
            description: "Example: remember that the launch date moved to June",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "ask",
        description: "Ask the knowledge base a question",
        options: [
          {
            type: optionTypes.STRING,
            name: "question",
            description: "Question to ask",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "ingest",
        description: "Ingest pasted text",
        options: [
          {
            type: optionTypes.STRING,
            name: "text",
            description: "Text to ingest",
            required: true,
          },
          {
            type: optionTypes.STRING,
            name: "title",
            description: "Optional title",
            required: false,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "ingest-file",
        description: "Ingest an uploaded file",
        options: [
          {
            type: optionTypes.ATTACHMENT,
            name: "file",
            description: "TXT, MD, CSV, JSON, DOCX, or PDF",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "pages",
        description: "List wiki pages",
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "page",
        description: "Show a wiki page",
        options: [
          {
            type: optionTypes.STRING,
            name: "file",
            description: "Example: pages/lil-big-run-club.md",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "source",
        description: "Show source text for a wiki source",
        options: [
          {
            type: optionTypes.STRING,
            name: "file",
            description: "Example: sources/original.md",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "save-page",
        description: "Replace a wiki page with Markdown content",
        options: [
          {
            type: optionTypes.STRING,
            name: "file",
            description: "Example: pages/lil-big-run-club.md",
            required: true,
          },
          {
            type: optionTypes.STRING,
            name: "content",
            description: "Full Markdown content",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "delete-page",
        description: "Delete a wiki page",
        options: [
          {
            type: optionTypes.STRING,
            name: "file",
            description: "Example: pages/lil-big-run-club.md",
            required: true,
          },
        ],
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "self-heal",
        description: "Run deterministic self-healing",
      },
      {
        type: optionTypes.SUB_COMMAND,
        name: "deep-repair",
        description: "Run AI deep repair",
      },
    ],
  },
];

const route = guildId
  ? `applications/${appId}/guilds/${guildId}/commands`
  : `applications/${appId}/commands`;
const url = `https://discord.com/api/v10/${route}`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

const body = await res.text();
if (!res.ok) {
  console.error(body);
  process.exit(1);
}

console.log(body);
