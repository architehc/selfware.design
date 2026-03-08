use std::fs;
use std::path::Path;

// Vulnerability 1: Hardcoded API key
const API_KEY: &str = "sk-prod-a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5";

fn authenticate(request_key: &str) -> bool {
    request_key == API_KEY
}

// Vulnerability 2: Path traversal — user input used directly in file path
fn serve_file(base_dir: &str, filename: &str) -> Result<String, String> {
    let path = format!("{}/{}", base_dir, filename);
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

// Vulnerability 3: Unsafe buffer access with no bounds check
fn get_item(data: &mut [u8], index: usize) -> u8 {
    unsafe { *data.get_unchecked_mut(index) }
}

// Vulnerability 4: No input validation on user-provided data
fn process_request(user_input: &str) -> String {
    let parts: Vec<&str> = user_input.split('|').collect();
    let action = parts[0];
    let payload = parts[1]; // panics if fewer than 2 parts

    match action {
        "read" => serve_file("/data", payload).unwrap_or_else(|e| e),
        "auth" => {
            if authenticate(payload) {
                "Authenticated".to_string()
            } else {
                "Denied".to_string()
            }
        }
        _ => "Unknown action".to_string(),
    }
}

fn main() {
    // Simulated requests
    let requests = vec![
        "auth|sk-prod-a8f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5",
        "read|config.json",
        "read|../../etc/passwd",
    ];

    for req in requests {
        println!("Request: {} -> {}", req, process_request(req));
    }
}
