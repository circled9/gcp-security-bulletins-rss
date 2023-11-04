import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

const URL =
  "https://cloud.google.com/feeds/google-cloud-security-bulletins.xml" as const;

type Leaf = number | string | null;

type Node = {
  [key: string]: Leaf;
} | Leaf;

type Feed = {
  xml: Node;
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
    xml: feed.xml,
    feed: {
      ...rest,
      updated,
      entry: entry.map((feedItem) => {
        return {
          ...feedItem,
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
  console.log(reformated);
}

if (import.meta.main) {
  main();
}
