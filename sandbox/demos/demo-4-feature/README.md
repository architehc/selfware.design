# Mini-Grep — Build a Feature Demo

A small Rust CLI that searches for a pattern in text. The `search` function is stubbed with `todo!()` — can selfware implement it?

## Try this command

```bash
selfware run "implement the search function based on the README spec, add tests, verify"
```

## Specification

The `search(query, contents, case_insensitive)` function should:

1. Search through `contents` line by line
2. Return a `Vec<SearchResult>` where each result contains:
   - `line_number` (1-based)
   - `line` (the full text of the matching line)
3. When `case_insensitive` is `true`, match regardless of case
4. When `case_insensitive` is `false`, match exactly
5. Handle empty query by returning no results
6. Handle empty contents by returning no results

## Example

```
Input:  query="rust", contents="I love Rust\nIt is fast\nRust is great"
Output: [SearchResult { line_number: 1, line: "I love Rust" },
         SearchResult { line_number: 3, line: "Rust is great" }]
         (with case_insensitive=true)
```
