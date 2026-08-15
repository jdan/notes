# Embed documentation

This directory documents the custom interactive embeds supported by the notes site.

| Embed        | Notion source                                                           | Published output                                                        | Documentation                     |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| Hashart      | Ordered HTML and JavaScript code blocks with the caption `preview=true` | Inline canvas application running in the page                           | [Hashart](./hashart.md)           |
| Shader/Stack | A Notion Embed block containing a Shader/Stack embed URL                | Cross-origin WebGL iframe followed by a native **View code** disclosure | [Shader/Stack](./shader-stack.md) |

Both formats assume that the Notion database is trusted. Hashart executes authored JavaScript in the notes page itself; Shader/Stack isolates its compiler and renderer on `shaders.jordanscales.com`.
