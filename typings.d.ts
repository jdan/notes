declare module "emoji-unicode" {
	const emojiFn: (emoji: string) => string;
	export = emojiFn;
}

declare module "notion-for-each-row" {
	import { Client } from "@notionhq/client";
	import { QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";
	interface Options {
		token: string;
		database: string;
		sorts?: Array<Record<string, unknown>>;
		pageSize?: number;
	}

	const notionForEachRowFn: (
		options: Options,
		callback: (
			page: QueryDatabaseResponse["results"][number],
			notionApiClient: Client,
		) => void | Promise<void>,
	) => Promise<void>;

	export = notionForEachRowFn;
}
