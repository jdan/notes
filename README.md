## cards

Turn a [Notion](https://notion.so) database into a deck of cards.

![image](https://user-images.githubusercontent.com/287268/133845880-4bf28439-b387-4bab-b370-ff1d5fc4b852.png)

### usage

As a heads up, this barely works at all.

- [Create a new Notion integration](https://developers.notion.com/docs/getting-started#step-1-create-an-integration)
- Create a new database and note it's ID from the address bar
  - `https://www.notion.so/[username]/[your database ID, copy this!]?v=[ignore this]`
- [Share that database with your new integration](https://developers.notion.com/docs/getting-started#step-2-share-a-database-with-your-integration)
- Run the script

```sh
git clone https://github.com/jdan/cards.git
npm i
NOTION_SECRET=[your token here] NOTION_DATABASE_ID=[your id here] node index.js
npx serve build   # build/ contains everything you need
# localhost:5000 now shows your cards
```
