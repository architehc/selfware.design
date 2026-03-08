use std::env;
use std::fs;
use std::process;

#[derive(Debug, PartialEq)]
pub struct SearchResult {
    pub line_number: usize,
    pub line: String,
}

/// Search for `query` in `contents`, returning matching lines.
/// See README.md for the full specification.
pub fn search(query: &str, contents: &str, case_insensitive: bool) -> Vec<SearchResult> {
    todo!("Implement search — see README.md for the spec")
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 3 {
        eprintln!("Usage: mini-grep <query> <filename> [--ignore-case]");
        process::exit(1);
    }

    let query = &args[1];
    let filename = &args[2];
    let case_insensitive = args.get(3).map_or(false, |a| a == "--ignore-case");

    let contents = fs::read_to_string(filename).unwrap_or_else(|err| {
        eprintln!("Error reading '{}': {}", filename, err);
        process::exit(1);
    });

    let results = search(query, &contents, case_insensitive);

    if results.is_empty() {
        println!("No matches found.");
    } else {
        for result in &results {
            println!("{}:{}", result.line_number, result.line);
        }
        println!("\n{} match(es) found.", results.len());
    }
}
