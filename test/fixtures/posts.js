// @ts-nocheck

const annotations = {
	bold: false,
	italic: false,
	strikethrough: false,
	underline: false,
	code: false,
	color: "default",
};

const richText = (content, overrides = {}) => ({
	type: "text",
	text: { content, link: overrides.link || null },
	annotations: { ...annotations, ...(overrides.annotations || {}) },
	plain_text: content,
	href: overrides.link ? overrides.link.url : null,
});

module.exports = [
	{
		id: "491f4275-7089-4fbc-b636-d0ec2539c743",
		title: "Janet",
		filename: "491f4275.html",
		blocks: [
			{
				id: "p-fa74a031-5ba1-4d10-a0d6-78a4f2a345bd",
				has_children: true,
				type: "numbered_list",
				children: [
					{
						id: "fa74a031-5ba1-4d10-a0d6-78a4f2a345bd",
						has_children: false,
						type: "numbered_list_item",
						numbered_list_item: {
							text: [
								{
									type: "mention",
									mention: {
										type: "page",
										page: { id: "cd2cb8c2-dcc6-4da4-bb02-5fa71513b780" },
									},
									annotations,
									plain_text: "Untitled",
									href: "https://app.notion.com/p/cd2cb8c2dcc64da4bb025fa71513b780",
								},
								richText(" "),
							],
						},
						children: [],
					},
				],
			},
		],
	},
	{
		id: "48ff7a09-5584-4b3d-b087-59d1deac9a12",
		title: "Stack-based programming",
		filename: "48ff7a09.html",
		blocks: [
			{
				id: "cfa22652-51bb-4407-8f33-b98cc4ccfc07",
				has_children: false,
				type: "code",
				code: {
					caption: [],
					language: "scheme",
					text: [richText("> '(hello world)\n; (hello world)")],
				},
				children: [],
			},
			{
				id: "4edf6692-358c-4609-97bc-6d2ad88e5311",
				has_children: false,
				type: "paragraph",
				paragraph: { text: [] },
				children: [],
			},
		],
	},
	{
		id: "24458412-0b71-4147-9002-7a7cfa7b8878",
		title: "Maths",
		filename: "24458412.html",
		blocks: [
			{
				id: "eeb88d51-f535-4fd9-9575-8781cfd22724",
				has_children: false,
				type: "equation",
				equation: { expression: "E = mc^2" },
				children: [],
			},
			{
				id: "17cc1ccd-b253-4272-8a03-027175848d11",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("Do inline equations such as "),
						{
							type: "equation",
							equation: { expression: "E = mc^2" },
							annotations,
							plain_text: "E = mc^2",
							href: null,
						},
						richText(" work?"),
					],
				},
				children: [],
			},
		],
	},
	{
		id: "ea2751c8-cf9b-4384-b97a-b2c9613d3338",
		title: "Backlinks",
		filename: "ea2751c8.html",
		blocks: [
			{
				id: "51995750-11b9-4115-b416-b3f3723ebabf",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("A "),
						richText("backlink", {
							link: { url: "https://en.wikipedia.org/wiki/Backlink" },
							annotations: { bold: true },
						}),
						richText(
							" is a reference to a page which links to the page the reader is currently on.",
						),
					],
				},
				children: [],
			},
			{
				id: "37389272-485d-4031-88c2-0c9571a1905e",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("Backlinks are cleverly exposed in the "),
						richText("What links here", {
							link: {
								url: "https://en.wikipedia.org/wiki/Special:WhatLinksHere/Backlink",
							},
						}),
						richText(" tool in MediaWiki."),
					],
				},
				children: [],
			},
		],
	},
	{
		id: "2d0ce94a-93b4-4fcf-a199-36a763996387",
		title: "Headings",
		filename: "2d0ce94a.html",
		blocks: [
			{
				id: "45dd4205-84fd-407c-b63b-939cede018e6",
				has_children: false,
				type: "heading_1",
				heading_1: { text: [richText("1")] },
				children: [],
			},
			{
				id: "adb3bae7-8af4-4f0f-b29a-2464f56aa08f",
				has_children: false,
				type: "heading_2",
				heading_2: { text: [richText("2")] },
				children: [],
			},
			{
				id: "ffc50575-c224-4042-ab50-1bf66e3df362",
				has_children: false,
				type: "heading_3",
				heading_3: { text: [richText("3")] },
				children: [],
			},
		],
	},
];
