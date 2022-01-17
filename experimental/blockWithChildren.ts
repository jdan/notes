/**
 * This file contains experimental types for dynamic block group generation.
 * This approach is very slow to typecheck.
 */

import { Block } from "@notionhq/client/build/src/api-types";

type WithChildren<Parent, Child> = Omit<Parent, "children"> & {
  children: Child[];
};

type RecursiveChildren<Branch, Leaf = never> = Branch & {
  children: Array<Leaf | RecursiveChildren<Branch, Leaf>>;
};

type Branch = { type: "branch" };
type Leaf = { type: "leaf" };

type Tree = RecursiveChildren<Branch, Leaf>;
declare const tree: Tree;
for (const child of tree.children) {
  if (child.type === "leaf") {
    console.log("leaf");
    continue;
  }

  child.type;
  for (const child2 of child.children) {
    child2.type;
  }
}

interface BlockGroup<
  ChildBlock extends { type: string; children: any[] },
  BlockType extends ChildBlock["type"],
  GroupType extends string
> {
  id: string;
  type: GroupType;
  has_children: true;
  children: Array<
    WithChildren<
      Extract<ChildBlock, { type: BlockType }>,
      GroupedBy<ChildBlock, BlockType, GroupType>
    >
  >;
}

type GroupedBy<
  ChildBlock extends { type: string; children: any[] },
  BlockType extends ChildBlock["type"],
  GroupType extends string
> =
  | RecursiveChildren<ChildBlock, BlockGroup<ChildBlock, BlockType, GroupType>>
  | BlockGroup<ChildBlock, BlockType, GroupType>;

type MyBlock = GroupedBy<
  RecursiveChildren<Block, never>,
  "numbered_list_item",
  "BANANA"
>;

type YourBlock = GroupedBy<MyBlock, "bulleted_list_item", "bulleted_list">;

declare const x: MyBlock;

if (x.type === "BANANA") {
  x.type;
  x.children;
  const c = x.children[0];
  c.type;
  c.children;
}

declare const getDeterministicUUID: () => string;
/**
 * Group adjacent runs of `blocks` that have `type` into a new synthetic block
 * with type `result_type`.
 */
function groupAdjacent<
  ChildBlock extends {
    type: string;
    children: ChildBlock[];
    id: string;
    has_children: boolean;
  },
  BlockType extends ChildBlock["type"],
  GroupType extends string
>(
  blocks: ChildBlock[],
  type: BlockType,
  result_type: GroupType
): Array<GroupedBy<ChildBlock, BlockType, GroupType>> {
  let result: Array<GroupedBy<ChildBlock, BlockType, GroupType>> = [];
  let currentList: Array<Extract<ChildBlock, { type: BlockType }>> = [];
  const blocksToUpdate = blocks as Array<
    RecursiveChildren<ChildBlock, BlockGroup<ChildBlock, BlockType, GroupType>>
  >;

  blocks.forEach((block, i) => {
    if (block.has_children) {
      const blockToUpdate = blocksToUpdate[i];
      blockToUpdate.children;
      blocksToUpdate[i].children = groupAdjacent(
        block.children,
        type,
        result_type
      );
    }

    if (block.type === type) {
      // This kind of generic type constraint is impossible to express in TS
      // since there's no way to declare that { type: XXXX } is a discriminated
      // union (it could always be declared as `string`).
      currentList.push(block as Extract<ChildBlock, { type: BlockType }>);
    } else {
      if (currentList.length) {
        const group: BlockGroup<BlockType, GroupType, ChildBlock> = {
          id: getDeterministicUUID(),
          has_children: true,
          type: result_type,
          children: currentList,
        };
        result.push(group);
        currentList = [];
      }

      result.push(block);
    }
  });

  if (currentList.length) {
    result.push({
      id: getDeterministicUUID(),
      has_children: true,
      type: result_type,
      children: currentList,
    });
  }

  return result;
}

interface SimpleBlockGroup<
  BlockType extends Block["type"],
  GroupType extends string
> {
  id: string;
  type: GroupType;
  has_children: true;
  children: Array<WithChildren<Extract<Block, { type: BlockType }>, CardBlock>>;
}

type CardBlockGroups =
  | SimpleBlockGroup<"numbered_list_item", "numbered_list">
  | SimpleBlockGroup<"bulleted_list_item", "bulleted_list">;

type BaseCardBlock = RecursiveChildren<Block, CardBlockGroups>;
type CardBlock = BaseCardBlock | CardBlockGroups;
