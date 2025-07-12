<?php
// php_scripts/my_php_script.php

// Disable error reporting for cleaner JSON output
// In a real app, you'd log these errors instead.
error_reporting(0);
ini_set('display_errors', 0);

function send_json_response($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function send_error_response($message, $is_stderr = true) {
    $error = ['status' => 'error', 'message' => $message];
    $jsonError = json_encode($error);
    if ($is_stderr) {
        file_put_contents('php://stderr', $jsonError);
    } else {
        echo $jsonError;
    }
    exit(1);
}

// Check if command line arguments are provided
if ($argc < 2) {
    send_error_response("Нет входных данных");
}

$inputJsonString = $argv[1];
$inputData = json_decode($inputJsonString, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    send_error_response("Ошибка парсинга JSON: " . json_last_error_msg());
}

try {
    $name = isset($inputData['name']) ? $inputData['name'] : 'Гость';
    $value = isset($inputData['value']) ? (int)$inputData['value'] : 0;

    $message = "Привет из PHP, {$name}!";
    $processedValue = $value * 5;

    $output = [
        'status' => 'success',
        'message' => $message,
        'processedValue' => $processedValue
    ];

    send_json_response($output);

} catch (Exception $e) {
    send_error_response("Произошла ошибка: " . $e->getMessage());
}
?>
