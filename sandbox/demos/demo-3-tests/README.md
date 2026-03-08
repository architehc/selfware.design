# String Utils — Test Generation Demo

A small Rust library with 3 string utility functions and zero tests. Can selfware generate comprehensive tests with edge case coverage?

## Try this command

```bash
selfware run "generate unit tests for all functions in src/lib.rs, cover edge cases, run cargo test to verify"
```

## Functions

- `reverse(s)` — Reverse a string character-by-character
- `is_palindrome(s)` — Check if a string is a palindrome (case-insensitive, ignores non-alphanumeric)
- `word_count(s)` — Count whitespace-delimited words
