use std::collections::HashMap;
use std::io;

mod lib;
use lib::{fahrenheit_to_celsius, average_temperature};

fn main() {
    let mut readings: HashMap<String, Vec<f64>> = HashMap::new();

    readings.insert("Monday".to_string(), vec![72.0, 75.5, 68.3]);
    readings.insert("Tuesday".to_string(), vec![80.1, 82.0, 79.5]);
    readings.insert("Wednesday".to_string(), vec![65.0, 70.2, 63.8]);

    println!("=== Weekly Weather Report ===\n");

    for (day, temps) in &readings {
        let avg = average_temperature(&temps);
        let celsius = fahrenheit_to_celsius(avg);
        // Bug: off-by-one in day formatting (prints index wrong)
        println!("{}: avg {:.1}°F ({:.1}°C)", day, avg, celsius);
    }

    println!("\nColdest day: {}", find_coldest_day(&readings));
}

// Bug: this function panics on empty input instead of handling it
fn find_coldest_day(readings: &HashMap<String, Vec<f64>>) -> String {
    let mut coldest_day = String::new();
    let mut coldest_temp = f64::MAX;

    for (day, temps) in readings {
        let avg = average_temperature(temps);
        if avg < coldest_temp {
            coldest_temp = avg;
            coldest_day = day.clone();
        }
    }

    coldest_day
}
