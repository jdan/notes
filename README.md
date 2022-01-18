## cards

Turn a [Notion](https://notion.so) database into a deck of cards. @jdan uses this to power [cards.jordanscales.com](https://cards.jordanscales.com).

<img width="1381" alt="a desktop with notion open on the left and a rendered notion page using this library on the right" src="https://user-images.githubusercontent.com/287268/144431224-ac4673ba-e432-47d7-94c5-c82ecbadb986.png">

### usage

As a heads up, this barely works at all. It may not handle HTML escaping correctly. Do not run on untrusted input.

1. [Create a new Notion integration](https://developers.notion.com/docs/getting-started#step-1-create-an-integration)
1. Create a new database and note it's ID from the address bar

   - `https://www.notion.so/[username]/[your database ID, copy this!]?v=[ignore this]`
   - Add a column called "Filename" to set the output filename for a card. This is required for an `index.html`.

1. [Share that database with your new integration](https://developers.notion.com/docs/getting-started#step-2-share-a-database-with-your-integration)
1. Run the script

```sh
git clone https://github.com/jdan/cards.git
npm i
NOTION_SECRET=[your token here] NOTION_DATABASE_ID=[your id here] TWITTER_HANDLE=yourHandle  node index.js
npx serve build   # build/ contains everything you need
# localhost:5000 now shows your cards
```

### config

Configuration is provided via environment variables, a [`.env` file, or a config file in the `.env` format](https://github.com/motdotla/dotenv#what-rules-does-the-parsing-engine-follow). To specify a config file, set the `CONFIG=path/to/your/file.env` env var. Here's an example:

```shell
# recipes.env
TWITTER_HANDLE=jitl
OG_IMAGE=https://jake.tl/images/jake-pleasant.jpg
BASE_URL=/recipes
NOTION_SECRET=secret_XXXXXXX
NOTION_DATABASE_ID=a3aa29a6b2f242d1b4cf86fb578a5eea
```

Then to use the config, run:

```shell
CONFIG=./recipes.env node index.js
```

Take a look at the top 100 lines or so of index.js to see what env vars are available.

### developing

If you're working on improving this software, consider using `npm run watch`,
which will re-build your site whenever any of this source code changes.

```shell
CONFIG=./recipes.env npm run watch
```
