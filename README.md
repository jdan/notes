## cards

Turn a [Notion](https://notion.so) database into a deck of cards. @jdan uses this to power [notes.jordanscales.com](https://notes.jordanscales.com).

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
NOTION_SECRET=[your token here] NOTION_DATABASE_ID=[your id here] TWITTER_HANDLE=yourHandle npm run build
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
CONFIG=./recipes.env npm run build
```

Take a look at the top 100 lines or so of index.ts to see what env vars are available.

### notes deployment

`notes.jordanscales.com` runs this app as a Docker container on the Hetzner server behind the existing `kamal-proxy`. It serves generated posts from a persistent directory and exposes a protected webhook that triggers a rebuild from Notion.

Runtime state on Hetzner:

```shell
/opt/notes/.env     # NOTION_* config and WEBHOOK_SECRET
/opt/notes/site     # generated static site
/opt/notes/data     # sqlite cache
```

The Notion button should request:

```text
https://notes.jordanscales.com/webhook/notion?secret=<WEBHOOK_SECRET>
```

The server also accepts the secret in an `x-webhook-secret` header. Unauthenticated webhook calls return `401`.

Useful checks:

```shell
curl https://notes.jordanscales.com/healthz
ssh hetzner 'docker logs --tail 100 notes'
ssh hetzner 'docker exec kamal-proxy kamal-proxy list'
```

To deploy source changes to the running `notes` service:

```shell
npm run deploy:notes
```

The deploy script syncs source to `/opt/notes`, preserves remote `.env`, rebuilds the Docker image, restarts the `notes` container, and re-registers the route with `kamal-proxy`. It intentionally does not use the nested `build/` git repo.
