import query from "../query.json" with { type: "json" };
import fs from "node:fs/promises";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_API_TOKEN: string;
    }
  }
}

const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function requestMessages() {
  let pagesFetched = 0;
  let maximumPages = query.pages;
  const messages: string[] = [];

  while (pagesFetched < maximumPages) {
    const response = await fetch(
      `https://discord.com/api/v9/guilds/${query.serverId}/messages/search?author_id=${query.userId}&offset=${25 * pagesFetched}` +
        (query.channelId ? `&channel_id=${query.channelId}` : ""),
      {
        headers: {
          accept: "*/*",
          authorization: process.env.DISCORD_API_TOKEN,
        },
        body: null,
        method: "GET",
      },
    );
    const data: {
      messages: { content: string }[];
      total_results: number;
    } = await response.json();

    if (data?.messages.length === 0) {
      break;
    }

    messages.push(
      ...data.messages
        .map((message) => message[0].content)
        .map((content) => content.replace(/<:[a-zA-Z0-9]+:[0-9]+>/g, ""))
        .filter((content) => content.length > 0),
    );

    console.log(`Fetched page ${pagesFetched + 1} of ${maximumPages}`);

    await timeout(500);
    pagesFetched++;
  }

  return messages;
}

function saveToFile(messages: string[]) {
  fs.writeFile(`./data/${query.userId}.txt`, messages.join("\n"));
}

const messages = await requestMessages();

console.log(messages);
saveToFile(messages);
