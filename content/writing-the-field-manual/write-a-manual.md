---
title: Write your first manual
description: Duplicate the skeleton, retitle it, write the three timeline pages, and pass the publication gate — your first field manual end to end.
icon: fa-solid fa-list-check
weight: 30
---

You will take the blank skeleton to a publication-gated field manual: duplicate it, retitle it, write the three timeline pages, and pass the gate. Every command below is immediately followed by a verify command or check and its literal expected output — the status gate the site's manuals use. You need a clone of this repo and [Prerequisites](#prerequisites) below.

## Prerequisites

- Hugo Extended ≥ 0.168 — check with:

```sh
hugo version
```

Expected output: a version line at or above `hugo v0.168.0+extended`.

- Go ≥ 1.27 — check with:

```sh
go version
```

Expected output: a version line at or above `go version go1.27`.

- A clone of this repo — check with:

```sh
ls content/field-manual/hello-world/_index.md
```

Expected output:

```sh
content/field-manual/hello-world/_index.md
```

## Procedure

1. Duplicate the blank skeleton into your new section under `content/field-manual/`:

```sh
cp -r content/field-manual/hello-world content/field-manual/my-manual
```

Verify the copy:

```sh
ls content/field-manual/my-manual
```

Expected output:

```sh
_index.md		customize.md		things-that-broke.md
operate.md		set-up.md
```

2. Retitle the section in `content/field-manual/my-manual/_index.md` — set `title` to your manual's name and `description` to one sentence. Verify the front matter parses and the title took:

```sh
head -4 content/field-manual/my-manual/_index.md
```

Expected output: the `---` fence, then your new `title:` and `description:` lines.

3. Write the three timeline pages — `set-up.md`, `operate.md`, `things-that-broke.md` — following the conventions in [Conventions and intent](conventions/): outcome first, status-gate verification on every command, known issues inline. Verify each page has the three sections a procedure needs:

```sh
grep -l "## Verification" content/field-manual/my-manual/*.md
```

Expected output:

```sh
content/field-manual/my-manual/set-up.md
```

4. Run the dev server and check the section serves:

```sh
hugo server
```

In a second terminal, verify the section renders:

```sh
curl -s -o /dev/null -w "%{http_code}" http://localhost:1313/CAI-Field-Manual-prototype/field-manual/my-manual/
```

Expected output:

```sh
200
```

A 404 at the root (`http://localhost:1313/`) is expected — with a path in `baseURL`, the dev server serves under `/CAI-Field-Manual-prototype/`.

5. Stop the dev server, then run the publication gate:

```sh
hugo --cleanDestinationDir --gc --minify --environment production --printPathWarnings
```

Expected output: a build summary ending in a line like `Total in N ms`, with no ERROR lines. The known LibSass WARNING from the pinned theme (v1.4.0) is expected in this direct build output — it is not a failure.

6. Run the warning gate — assert no WARN lines other than the known LibSass one:

```sh
hugo --cleanDestinationDir --gc --minify --environment production --printPathWarnings 2>&1 | grep -i warn | grep -v "css.Sass: libsass"
```

Expected output: no output — no output is clean.

## Verification

The manual is publication-ready when:

- The dev server serves the section at `http://localhost:1313/CAI-Field-Manual-prototype/field-manual/my-manual/` (HTTP 200), and each timeline page renders under it.
- The publication gate completes with no ERROR lines, and the warning gate produces no output.
- Every command in the three timeline pages is followed by a verify step with literal expected output.

## Rollback

- Discard the new section entirely:

```sh
rm -r content/field-manual/my-manual
```

Verify the tree is back to the shipped state:

```sh
ls content/field-manual
```

Expected output: `hello-world` only — no `my-manual`.

- If only some pages changed, restore individual files with `git restore content/field-manual/my-manual/<page>.md` and re-run the publication gate.

When the gate is clean, open a PR to `main`. Merges to `main` deploy automatically via GitHub Actions.
