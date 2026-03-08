use std::fmt; // Bug: unused import

/// Convert Fahrenheit to Celsius
pub fn fahrenheit_to_celsius(f: f64) -> f64 {
    // Bug: wrong formula — should be (f - 32.0) * 5.0 / 9.0
    (f - 32.0) * 9.0 / 5.0
}

/// Calculate the average of a slice of temperatures
pub fn average_temperature(temps: &[f64]) -> f64 {
    // Bug: off-by-one — divides by len+1 instead of len
    let sum: f64 = temps.iter().sum();
    sum / (temps.len() + 1) as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_boiling_point() {
        let result = fahrenheit_to_celsius(212.0);
        assert!((result - 100.0).abs() < 0.01, "212°F should be 100°C, got {}", result);
    }

    #[test]
    fn test_freezing_point() {
        let result = fahrenheit_to_celsius(32.0);
        assert!((result - 0.0).abs() < 0.01, "32°F should be 0°C, got {}", result);
    }

    #[test]
    fn test_average() {
        let temps = vec![70.0, 80.0, 90.0];
        let avg = average_temperature(&temps);
        assert!((avg - 80.0).abs() < 0.01, "Average should be 80.0, got {}", avg);
    }
}
