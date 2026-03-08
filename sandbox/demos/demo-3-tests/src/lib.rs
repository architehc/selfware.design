/// Reverse a string character-by-character.
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

/// Count the number of words in a string (whitespace-delimited).
pub fn word_count(s: &str) -> usize {
    s.split_whitespace().count()
}
