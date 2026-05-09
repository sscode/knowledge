# Knowledge Base Schema

## Structure

- `wiki/sources/` — Raw immutable source documents. Never modify after creation.
- `wiki/pages/` — LLM-generated wiki pages. One file per entity or concept.
- `wiki/index.md` — Catalog of all pages with one-line summaries. Read this first.
- `wiki/log.md` — Append-only chronological record of all operations.

## Conventions

- File names: kebab-case, e.g. `series-a-funding.md`, `john-smith.md`
- Cross-references: Use wikilinks `[[page-name]]` to link between pages
- Each page starts with `# Title` followed by a one-line summary
- Dates use ISO 8601: YYYY-MM-DD
- Every page must have sections: Summary, Details, Related (with wikilinks), Sources (citing raw source files)

## Page Types

- **Person**: Team members, contacts, investors. Fields: role, contact info, key relationships
- **Company**: Companies we interact with. Fields: relationship, key contacts, status
- **Decision**: Important decisions made. Fields: date, context, outcome, rationale
- **Process**: How we do things. Fields: steps, owners, tools used
- **Project**: Active projects/initiatives. Fields: status, owner, timeline, dependencies
- **Concept**: Domain knowledge, terminology. Fields: definition, context, related concepts
- **Meeting**: Meeting notes. Fields: date, attendees, decisions, action items

## Ingest Operation

When processing a new source:

1. Read this schema file for conventions
2. Read the source file from `wiki/sources/`
3. Read `wiki/index.md` to understand existing pages
4. Identify all entities, concepts, decisions, and facts in the source
5. For each entity/concept: check if a page exists in `wiki/pages/`. If yes, update it with new information. If no, create a new page following the conventions above.
6. Add `[[wikilinks]]` between related pages
7. Update `wiki/index.md` with entries for any new pages (format: `- [Page Title](pages/filename.md) — one-line summary`)
8. Append an entry to `wiki/log.md`: `- **YYYY-MM-DD** | ingest | Summary of what was extracted and which pages were created/updated`

Do NOT modify source files. Do NOT modify this schema file.

## Query Operation

When answering a question:

1. Read `wiki/index.md` to identify relevant pages
2. Use Grep to search `wiki/pages/` for relevant keywords
3. Read the most relevant pages
4. Synthesize a clear answer based ONLY on wiki content
5. Cite sources using `[[page-name]]` wikilinks
6. If the wiki lacks sufficient information, say so explicitly. Never fabricate.

## Lint Operation

When auditing the wiki:

1. Read this schema file for conventions
2. Read `wiki/index.md`
3. Read all files in `wiki/pages/`
4. Check for and fix:
   - Contradictions between pages (same fact stated differently)
   - Orphan pages (no wikilinks pointing to them from other pages)
   - Broken wikilinks (references to pages that don't exist)
   - index.md entries with no matching file
   - Files in `wiki/pages/` with no index.md entry
   - Pages missing required sections (Summary, Details, Related, Sources)
5. Fix all issues found by editing the affected files
6. Append a lint report to `wiki/log.md`: `- **YYYY-MM-DD** | lint | Issues found: [count]. Fixed: [count]. Needs human review: [list]`
