import OpenAI, { toFile } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import query from "../query.json" with { type: "json" };
import fs from "node:fs/promises";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_API_TOKEN: string;
      OPENAI_API_KEY: string;
    }
  }
}

const timeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function saveToFile(messages: string[]) {
  await fs.writeFile(`./data/${query.userId}.txt`, messages.join("\n"));
}

const Response = z.object({
  iq: z.number(),
  ageMin: z.number(),
  ageMax: z.number(),
  personality: z.string(),
  politics: z.string(),
  politicalCompass: z.object({
    x: z.number(),
    y: z.number(),
    socialScale: z.number(),
  }),
});

export type Response = z.infer<typeof Response>;

const prompt = `For the following analysis: please be honest/blunt about everything. Give me a detailed/comprehensive analysis of this person's ideological views and personality based off of their messages from Discord. Output sending a list of political ideas, ideologies, and personality traits. Note that these messages were made in conversation, so they can include a lot of unnecessary data/banter. While writing your analysis, please keep it concise and only write the list in bullet points, no extra messages. Also, estimate their age and their IQ. (IQ, be brutally honest, accurate, and give a number, not a range).
Also, estimate this person's position on the political compass. In the political compass, the x-axis represents the economic scale (left is economically left, right is economically right), and the y-axis represents the social scale (up is closer to authoritarian, down is closer libertarian). Output as a coordinate (x,y). Ranges from -10 to 10 for both axes. Lastly, estimate their position on the progressive-conservative scale (number from -10, very conservative, to 10, very liberal). Be as accurate as possible.`;

async function requestMessages() {
  let pagesFetched = 0;
  let maximumPages = query.pages;

  let userName: string = '';
  let profileUrl: string = '';

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
      messages: {
        content: string, author: {
          global_name: string;
          avatar: string;
        }
      }[][];
      total_results: number;
    } = await response.json();

    if (data?.messages.length === 0) {
      break;
    }

    if (pagesFetched === 0) {
      userName = data.messages[0][0].author.global_name;
      profileUrl = `https://cdn.discordapp.com/avatars/${query.userId}/${data.messages[0][0].author.avatar}`;
    }

    messages.push(
      ...data.messages
        .map((message) => message[0].content)
        .map((content) => content.replace(/<:[a-zA-Z0-9]+:[0-9]+>/g, ""))
        .filter((content) => content.length > 0),
    );

    console.log(`Fetched page ${pagesFetched + 1} of ${maximumPages}`);

    await timeout(query.settings.interval_ms || 500);
    pagesFetched++;
  }


  return { messages, name: userName ?? '', profileUrl: profileUrl ?? '' };
}

async function askAI(messages: string[], userName: string, profileUrl: string) {
  const openai = new OpenAI();

  const file = await openai.files.create({
    file: await toFile(Buffer.from(messages.join('\n')), 'messages.txt'),
    purpose: "assistants",
  });

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "user", content: prompt, attachments: [{
          type: "file",
          file: file.id,
        }]
      },
    ],
    response_format: zodResponseFormat(Response, "event"),
  });

  const event = completion.choices[0].message.parsed;

  fs.writeFile(`./results/${query.userId}.json`, JSON.stringify({
    ...event, user: {
      id: query.userId,
      name: userName,
      profileUrl: profileUrl,
    }
  }, null, 2));
}

const { messages, name, profileUrl } = await requestMessages();

await saveToFile(messages);
console.log(`Data saved to data/${query.userId}.txt`);
await askAI(messages, name, profileUrl);
console.log(`Results saved to results/${query.userId}.json`);