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

export default [
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
	{
		id: "fe053dd4-76c3-4ed6-8137-24b7e319599c",
		title: "turing",
		filename: "turing.html",
		blocks: [
			{
				id: "0807eb20-aaaa-4f28-8f5e-100000000001",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("A visualization of a 3-symbol, 3-state "),
						richText("Turing machine", {
							link: { url: "https://en.wikipedia.org/wiki/Turing_machine" },
						}),
						richText("."),
					],
				},
				children: [],
			},
			{
				id: "7f61deac-aaaa-4f28-8f5e-100000000002",
				has_children: false,
				type: "code",
				code: {
					caption: [richText("preview=true")],
					language: "javascript",
					text: [
						richText(`const _ = (measurement, dimension) =>
  Math.round((measurement * dimension) / 1320);

const project = (val, valMin, valMax, desiredMin, desiredMax) =>
  ((val - valMin) / (valMax - valMin)) * (desiredMax - desiredMin) + desiredMin;`),
					],
				},
				children: [],
			},
			{
				id: "40fab274-aaaa-4f28-8f5e-100000000003",
				has_children: false,
				type: "code",
				code: {
					caption: [richText("preview=true")],
					language: "html",
					text: [
						richText(`<div class="hashart" id="hashart-ui">
  <input class="bytes" value="Hello, world!" />
  <canvas class="canvas" width="1320" height="990"></canvas>
  <aside></aside>
</div>`),
					],
				},
				children: [],
			},
			{
				id: "c92246df-aaaa-4f28-8f5e-100000000004",
				has_children: false,
				type: "code",
				code: {
					caption: [richText("preview=true")],
					language: "javascript",
					text: [
						richText(`class Turing extends Art {
  constructor() {
    super({ α0: 3, β0: 3, γ0: 3, input: 5 });
    this.filename = "turing.js";
  }

  transition(table, tape, cursorPosition, state) {
    let value = tape[cursorPosition];
    let { write, move, nextState } = table[value][state];
    tape[cursorPosition] = write;
    return [move ? cursorPosition + 1 : cursorPosition - 1, nextState];
  }
}`),
					],
				},
				children: [],
			},
			{
				id: "0fdccf42-8e90-4d2a-8fd3-50409ec190d8",
				has_children: false,
				type: "image",
				image: {
					type: "external",
					external: {
						url: "https://notes.jordanscales.com/0fdccf42-8e90-4d2a-8fd3-50409ec190d8.image.jpeg",
					},
					caption: [],
				},
				children: [],
			},
			{
				id: "details-heading-aaaa-4f28-8f5e-100000000005",
				has_children: false,
				type: "heading_2",
				heading_2: { text: [richText("Details "), richText("🤓")] },
				children: [],
			},
			{
				id: "92acc1ba-aaaa-4f28-8f5e-100000000006",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("The input "),
						richText("turing complete", { annotations: { code: true } }),
						richText(" hashes to the following:"),
					],
				},
				children: [],
			},
			{
				id: "5fe3b8b2-aaaa-4f28-8f5e-100000000007",
				has_children: false,
				type: "code",
				code: {
					caption: [],
					language: "plain text",
					text: [richText("66a77509eaf0d8589812c53dacb80ebb5f98f16dc06b6ae65f3bd67a5a00937e")],
				},
				children: [],
			},
			{
				id: "fb2dde27-aaaa-4f28-8f5e-100000000008",
				has_children: false,
				type: "paragraph",
				paragraph: { text: [richText("We divvy this hash up into several parameters:")] },
				children: [],
			},
			{
				id: "4afe36b2-aaaa-4f28-8f5e-100000000009",
				has_children: false,
				type: "code",
				code: {
					caption: [],
					language: "plain text",
					text: [
						richText(`α0      66a775
β0      09eaf0
γ0      d85898
input   7a5a00937e`),
					],
				},
				children: [],
			},
			{
				id: "5de63846-aaaa-4f28-8f5e-100000000010",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText(
							"Our machine has a head which can read and write values 0, 1, and 2 from an infinite tape. The head itself can be in one of three states ",
						),
						richText("α", { annotations: { bold: true } }),
						richText(", "),
						richText("β", { annotations: { bold: true } }),
						richText(", and "),
						richText("γ", { annotations: { bold: true } }),
						richText("."),
					],
				},
				children: [],
			},
			{
				id: "1cfb618e-aaaa-4f28-8f5e-100000000011",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText("The field "),
						richText("α0", { annotations: { code: true } }),
						richText(" means for state "),
						richText("α", { annotations: { code: true } }),
						richText(" and a value "),
						richText("0", { annotations: { code: true } }),
						richText(" on the tape."),
					],
				},
				children: [],
			},
			{
				id: "p01f0aa5-aaaa-4f28-8f5e-100000000012",
				has_children: true,
				type: "numbered_list",
				children: [
					{
						id: "01f0aa5d-aaaa-4f28-8f5e-100000000013",
						has_children: false,
						type: "numbered_list_item",
						numbered_list_item: {
							text: [
								richText("Write", { annotations: { italic: true } }),
								richText(" a symbol to the tape"),
							],
						},
						children: [],
					},
					{
						id: "a680acd5-aaaa-4f28-8f5e-100000000014",
						has_children: false,
						type: "numbered_list_item",
						numbered_list_item: {
							text: [
								richText("Move", { annotations: { italic: true } }),
								richText(" left or right"),
							],
						},
						children: [],
					},
					{
						id: "24aa1031-aaaa-4f28-8f5e-100000000015",
						has_children: false,
						type: "numbered_list_item",
						numbered_list_item: {
							text: [
								richText("State", { annotations: { italic: true } }),
								richText(" chooses what comes next"),
							],
						},
						children: [],
					},
				],
			},
			{
				id: "14bd9df3-aaaa-4f28-8f5e-100000000016",
				has_children: false,
				type: "paragraph",
				paragraph: {
					text: [
						richText(
							"Then we start writing ✍️. After each step, we draw the tape and the position of the cursor with a little ▼.",
						),
					],
				},
				children: [],
			},
		],
	},
];
