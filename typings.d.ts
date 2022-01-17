declare module "emoji-unicode" {
  declare const emojiFn: (emoji: string) => string;
  export = emojiFn;
}

declare module "notion-for-each-row" {
  import { Client } from "@notionhq/client";
  import { Sort, Page } from "@notionhq/client/build/src/api-types";
  interface Options {
    token: string;
    database: string;
    sorts?: Array<Sort>;
    pageSize?: number;
  }

  declare const notionForEachRowFn: (
    options: Options,
    callback: (page: Page, notionApiClient: Client) => void | Promise<void>
  ) => Promise<void>;

  export = notionForEachRowFn;
}
