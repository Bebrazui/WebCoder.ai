
use std::env;
use std::io::{self, Write};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct InputData {
    name: String,
    value: i32,
}

#[derive(Serialize)]
struct OutputData {
    status: String,
    message: String,
    processed_value: i32,
}

#[derive(Serialize)]
struct ErrorResponse {
    status: String,
    message: String,
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        let error_resp = ErrorResponse {
            status: "error".to_string(),
            message: "Нет входных данных".to_string(),
        };
        // Using writeln to stderr to print the error
        writeln!(&mut io::stderr(), "{}", serde_json::to_string(&error_resp).unwrap()).unwrap();
        std::process::exit(1);
    }

    let input_json_string = &args[1];
    let input_data: Result<InputData, _> = serde_json::from_str(input_json_string);

    match input_data {
        Ok(data) => {
            let message = format!("Привет из Rust, {}!", data.name);
            let output = OutputData {
                status: "success".to_string(),
                message,
                processed_value: data.value * 10,
            };
            println!("{}", serde_json::to_string(&output).unwrap());
        }
        Err(e) => {
             let error_resp = ErrorResponse {
                status: "error".to_string(),
                message: format!("Ошибка парсинга JSON: {}", e),
            };
            writeln!(&mut io::stderr(), "{}", serde_json::to_string(&error_resp).unwrap()).unwrap();
            std::process::exit(1);
        }
    }
}
