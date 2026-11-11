# How to write a `concursos-abertos-ec` brief

`concursos-abertos-ec` is the month's main open exams as a 1080×1350 carousel: a **cover** (a
title and, on a band, the month), **area slides** (one area each, such as "Área Policial" or
"Tribunais", with **one or two exams**: an optional crest, `Concurso / name` and its facts) and a
**sign-off** with a "comment a word" call. An arrow is drawn on every slide but the last; the
logo and the signature come from the brand kit.

**Do not confuse it with `concursos-abertos`**, which draws one exam per slide on a card, with no
crest and no areas. Recognise this one by exams **grouped by area**, by facts such as `Período
de inscrições`, `Data da prova` and `Salário`, and by the bodies' crests. When unsure between
the two, ask which piece it is.

## Slots

| Slot     | Where                        | Rule                                                                                                                       |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `lamina` | directive, repeated          | 1 to 20 slides; see Normalisation.                                                                                         |
| `brasao` | directive **inside a slide** | Optional image, several: `::brasao ./file.png` on the line **before** the `Concurso:` of the exam it belongs to.           |
| `selo`   | frontmatter                  | Optional, 1080×140, at the foot of the **last** slide (the sign-off); the signature moves up. Only when the person has it. |

Format: `formats: [grid]` only; there is no story.

## Normalisation

1. **`::lamina {capa}`**, first: every line but the last is the title (heavy, centred, wraps by
   itself); **the last line goes on the band**:
   ```
   ::lamina {capa}
     Principais concursos abertos com inscrições
     em Novembro
   ```
   Use the month the copy names. Empty, the template draws a generic default.
2. **One `::lamina` per area** (or per continuation of one):
   - 1st line, optional: **the area's name**, with no `:` (`Área Policial`). On a slide that
     continues the previous area, leave it out.
   - For each exam: `::brasao ./file.png` (optional) on the line above, then `Concurso: Name`
     and one **fact** `Label: value` per line, in the copy's order: `Banca:`,
     `Período de inscrições:`, `Data da prova:`, `Vagas:`, `Salário:` (or `Salário inicial:`).
     The label is drawn in the accent, the value in grey.
   - `::brasao` is **not indented** (it starts at column 0, like `::lamina`); the text lines
     after it stay indented by two spaces.
   - No crest in the copy: **do not invent one**. Write the exam without `::brasao`; the name
     moves up into the crest's place. If the person wants crests, the files are theirs: ask
     for the paths.
3. **`::lamina {contracapa}`**, last: one paragraph whose `**word**` is drawn in a box (only
   one). Use the call and the word the copy or the person gives; empty, the template draws its
   default.
   ```
   ::lamina {contracapa}
     Comente **PALAVRA** e receba o link com todas as vagas abertas.
   ```

## How to split into slides

- **At most two exams per slide.** A third is not drawn and Tyto warns `W_TEMPLATE_OVERFLOW`. One
  exam alone is drawn large and centred; two, in rows with a rule between them.
- Follow the copy's grouping by area; an area with 3 exams becomes 2 + 1 (the second slide
  without the area's name). An area with one exam stays alone on its slide.
- **How much fits** (measured in Tyto, one-line facts): **7 facts** per exam with two on the
  slide (8 passes by 20 px); **11 facts** with one exam alone (12 passes by 12 px). A long fact
  that wraps counts as two. Do not drop facts on your own: say so and ask.
- With the cover and the sign-off, 18 area slides fit (the limit is 20 slides).

## Example

Copy (invented):

```
Principais concursos abertos — setembro
Área Fiscal
Órgão Alfa: Banca Beta, inscrições até 13/09, prova 06/12, 120 vagas, R$ 6.433,06 a R$ 9.495,67
Tribunal Gama: Banca Delta, inscrições 03/08 a 11/09, prova 06/12, 30 + 30 CR, R$ 5.318,63
Agência Épsilon: Banca Beta, até 13/09, prova 06/12, 75 vagas, R$ 4.100,00
(brasões: alfa.png, gama.png, epsilon.png)
Comente VAGAS para receber a lista completa.
```

Brief:

```brief
---
template: concursos-abertos-ec
formats: [grid]
---
::lamina {capa}
  Principais concursos abertos com inscrições
  em Setembro

::lamina
  Área Fiscal
::brasao ./alfa.png
  Concurso: Órgão Alfa
  Banca: Banca Beta
  Período de inscrições: até 13/09
  Data da prova: 06/12
  Vagas: 120
  Salário: R$ 6.433,06 a R$ 9.495,67
::brasao ./gama.png
  Concurso: Tribunal Gama
  Banca: Banca Delta
  Período de inscrições: 03/08 a 11/09
  Data da prova: 06/12
  Vagas: 30 + 30 CR
  Salário: R$ 5.318,63

::lamina
::brasao ./epsilon.png
  Concurso: Agência Épsilon
  Banca: Banca Beta
  Período de inscrições: até 13/09
  Data da prova: 06/12
  Vagas: 75
  Salário: R$ 4.100,00

::lamina {contracapa}
  Comente **VAGAS** para receber a lista completa.
```

## Known traps

- A `::brasao` after a `Concurso:` belongs to the **next** exam, not the one above (only the
  slide's last crest, with no exam after it, goes to the last exam without a crest).
- A `::brasao` path that does not exist is an error (`E_ASSET_NOT_FOUND`): the brief cannot
  check until the file is there. Never point at a crest the person did not give.
- A long exam name wraps in the narrow column (230 px) on the left; that is expected.
- A slide **without** an area's name centres its exams on the slide. A long area name (three
  lines) starts at the same height and pushes the exams down; do not abbreviate it for that.
