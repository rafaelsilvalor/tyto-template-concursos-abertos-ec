# tyto-template-concursos-abertos-ec

`concursos-abertos-ec`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its
own repository: the week's open exams as a carousel of 1080×1350 slides. A cover, area slides
with one or two exams each — an optional crest, the exam's name and its facts — and a sign-off
whose call to comment boxes one word.

**This repository holds the composition only.** The logo and the signature are not here: Tyto
hands them to the template from the brand kit installed on the machine (brand `roxo`), and
without one it draws placeholders (Tyto ADR 0063, ADR 0065). The example briefs are invented
copy, and their crests are neutral stand-ins drawn for this repository.

## Install into Tyto

```
tyto plugin install git+https://github.com/rafaelsilvalor/tyto-template-concursos-abertos-ec.git
```

Tyto clones the default branch and never builds it, so `dist/index.js` is committed on `main`
and every release is a tag of it. To take a change pushed here, run the same command again:
installing a name that is already installed replaces it.

A pack brings templates and no formats. Copy `templates/formats.yaml` into the project that
renders `concursos-abertos-ec`, or merge its `grid` line into the project's own. Then a brief
is:

```
---
template: concursos-abertos-ec
formats: [grid]
---

::lamina {capa}
  Principais concursos abertos com inscrições
  em Novembro

::lamina
  Área Policial
::brasao ./crest-one.png
  Concurso: Exam one
  Banca: Board
  Período de inscrições: até 13/11
  Vagas: 750
  Salário: R$ 6.433,06
  Concurso: Exam two
  Banca: Board
  Vagas: 150

::lamina {contracapa}
  Comente **WORD** e receba o link com todas as vagas abertas.
```

One `::lamina` is one slide.

- **The cover**, `::lamina {capa}`: every line but the last is the title, Black, centred and
  wrapped; the last line is set white on a band as wide as the block's widest line. Empty, it
  draws a default.
- **An area slide**, any unmarked `::lamina`: an optional first line with no `:` is the area's
  title, which grows upwards from where the reference sets it. `Concurso: name` starts an exam,
  and every `Label: value` line under it is one of its facts, the label in the brand's colour
  and the value in grey. **One exam is drawn large and centred; two in rows with a rule
  between them.** A third is not drawn, and the render warns `W_TEMPLATE_OVERFLOW`: split it
  onto a slide of its own.
- **A crest** is `::brasao ./file.png`, written before the exam's `Concurso:` line, and belongs
  to the exam under it. **It is optional**: an exam without one draws its name where the crest
  would sit, centred against its facts. A crest is contained in its box whatever its
  proportions; a PNG with transparency sits on the paper as it is.
- **The sign-off**, `::lamina {contracapa}`: one paragraph, centred; its `**word**` is set in
  Black, white on a box of the brand's colour. Empty, it draws a default.

The house's seal, `selo: ./selo.png` in the frontmatter, is glued to the last slide's foot, and
the signature rises over it.

## What it may reach

| Permission        | Why                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `font:CircularXX` | Titles, names and the sign-off are placed by measuring CircularXX, a licensed face (Tyto ADR 0048). |

**The install asks for it once.** A face installed on the machine crosses to a plugin only
under this permission. Without it the render warns `W_PLUGIN_FONT_WITHHELD` and every block is
placed from an estimate of its lines.

## What a configuration may change

`templates/concursos-abertos-ec/manifest.yaml` declares the colours as `values` (Tyto ADR 0153),
each default the reference art's. A value changes a colour, never which pieces a slide draws:
leaving the crests out is the brief's choice, not a configuration's (Tyto ADR 0151). `engine` is
`>=0.14`, the plugin API this repository is built against.

## Development

`pnpm check` runs Prettier, the type checker, ESLint and the tests; `pnpm build` writes
`dist/index.js`, one ES module with every `@tyto` import inlined, which is committed and which
CI rebuilds and compares.

The template depends on Tyto's published contract, held by GitHub Packages under the owner's
scope (Tyto ADR 0149) and aliased in `package.json`: `@tyto/house-style` draws the logo and the
signature, `@tyto/template-kit` and `@tyto/core` are what the slides are drawn with, and
`@tyto/plugin-api` is what loads them. The committed `.npmrc` names the scope only. GitHub asks
for a token with `read:packages` even for public packages, and it goes in your user-level
`~/.npmrc`:

```sh
gh auth refresh -s read:packages
echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
```

The tests, all without Tyto:

- `src/template.test.ts`: the composition's rules on the scene — what each kind of slide
  holds, each crest over the name of the exam under it, a name centred on its row when there
  is no crest, the default cover and sign-off, the arrow on every slide but the last, and
  everything inside the slide.
- `tests/examples.test.ts`: both example briefs, with crests and without, compiled as Tyto
  compiles them through `@tyto/template-kit/testing` (Tyto ADR 0152), against the HTML in
  `tests/__snapshots__/`.
- `tests/values.test.ts`: each declared value's default pinned to the one the code falls back
  to, and a colour set in a test found in the HTML.
- `tests/faces.test.ts`: the faces the manifest declares are the ones the examples draw.
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through `@tyto/plugin-api/testing`
  (Tyto ADR 0150), drawing `concursos-abertos-ec` across the isolation protocol.

The `contract` workflow runs every day against the newest published contract, past the ranges
`package.json` asks for, so a Tyto release that breaks this template turns it red before
somebody installs it.
