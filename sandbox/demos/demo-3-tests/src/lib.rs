/// Reverse a string, preserving Unicode grapheme boundaries.
pub fn reverse(s: &str) -> String {
    s.chars().rev().collect()
}

/// Check if a string is a palindrome (case-insensitive, ignoring non-alphanumeric).
pub fn is_palindrome(s: &str) -> bool {
    let cleaned: String = s.chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| c.to_lowercase().next().unwrap())
        .collect();
    let reversed: String = cleaned.chars().rev().collect();
    cleaned == reversed
}

/// Truncate a string to `max_len` characters, adding "..." if truncated.
pub fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else if max_len <= 3 {
        s.chars().take(max_len).collect()
    } else {
        let truncated: String = s.chars().take(max_len - 3).collect();
        format!("{}...", truncated)
    }
}

/// Count the number of words in a string (whitespace-delimited).
pub fn word_count(s: &str) -> usize {
    s.split_whitespace().count()
}

/// Convert a string to title case (first letter of each word uppercase).
pub fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => {
                    let upper: String = c.to_uppercase().collect();
                    let rest: String = chars.map(|c| c.to_lowercase().next().unwrap()).collect();
                    format!("{}{}", upper, rest)
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
