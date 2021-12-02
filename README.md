## cards

Turn a [Notion](https://notion.so) database into a deck of cards. I use this to power [cards.jordanscales.com](https://cards.jordanscales.com).

<img width="1381" alt="a desktop with notion open on the left and a rendered notion page using this library on the right" src="https://user-images.githubusercontent.com/287268/144431224-ac4673ba-e432-47d7-94c5-c82ecbadb986.png">

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
