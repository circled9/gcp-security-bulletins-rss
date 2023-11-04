import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { Hono } from "https://deno.land/x/hono/mod.ts";
import { parse, stringify } from "https://deno.land/x/xml@2.1.3/mod.ts";

const URL =
  "https://cloud.google.com/feeds/google-cloud-security-bulletins.xml" as const;

type Leaf = number | string | null;

type Node = {
  [key: string]: Leaf;
} | Leaf;

type Feed = {
  xml?: Node;
  feed: {
    id: string;
    title: string;
    link: Node;
    author: Node;
    updated: string;
    entry: FeedItem[];
  };
};

type FeedItem = {
  id: string;
  title: string;
  updated: string;
  content: {
    "@type": "html";
    "#text": string;
  };
};

async function getFeed() {
  const res = await fetch(URL);
  return res.text();
}

function parseFeed(feed: string): Feed {
  return parse(feed) as Feed;
}

function getUpdateUpdated(updated: string): (feedItem: FeedItem) => string {
  let updatedAt = updated;

  return (feedItem: FeedItem) => {
    const { updated, content, ...rest } = feedItem;
    const html = "<html><body>" + content["#text"] + "</body></html>";

    const domParser = new DOMParser();
    const doc = domParser.parseFromString(html, "text/html");
    const text = doc?.querySelector("p")?.textContent;
    if (!text) {
      return updatedAt;
    }
    const publishedAt = text.replace("Published: ", "");
    const date = new Date(publishedAt);
    if (date.toString() !== "Invalid Date") {
      updatedAt = date.toISOString().replace("Z", "000+00:00");
    }
    return updatedAt;
  };
}

function reformat(feed: Feed): Feed {
  const { entry, updated, ...rest } = feed.feed;
  const updateUpdated = getUpdateUpdated(updated);
  return {
    feed: {
      ...rest,
      updated,
      entry: entry.map((feedItem) => {
        return {
          ...feedItem,
          content: {
            ...feedItem.content,
            "#text": "<![CDATA[" + feedItem.content["#text"] + "]]>",
          },
          updated: updateUpdated(feedItem),
        };
      }),
    },
  };
}

async function main() {
  const feed = await getFeed();
  const parsed = parseFeed(feed);
  const reformated = reformat(parsed);

  // HACK: stringifyするとdoctypeがおかしくなるので自前でdoctypeを付与する
  const doctype = '<?xml version="1.0" encoding="UTF-8"?>';
  return doctype + stringify(reformated);
}

const app = new Hono();

app.notFound((c) => c.json({ message: "Not Found", ok: false }, 404));

app.get("/feeds/google-cloud-security-bulletins.xml", async (c) => {
  const feed = await main();
  c.header("Content-Type", "text/xml");
  return c.body(feed);
});

Deno.serve(app.fetch);
