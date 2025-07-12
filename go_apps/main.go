// go_apps/main.go
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type InputData struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}

type OutputData struct {
	Status       string `json:"status"`
	Message      string `json:"message"`
	ProcessedVal int    `json:"processedValue"`
}

type ErrorResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func main() {
	if len(os.Args) < 2 {
		errorResp := ErrorResponse{Status: "error", Message: "Нет входных данных"}
		json.NewEncoder(os.Stderr).Encode(errorResp)
		os.Exit(1)
	}

	inputJsonString := os.Args[1]
	var inputData InputData
	err := json.Unmarshal([]byte(inputJsonString), &inputData)
	if err != nil {
		errorResp := ErrorResponse{Status: "error", Message: "Ошибка парсинга JSON: " + err.Error()}
		json.NewEncoder(os.Stderr).Encode(errorResp)
		os.Exit(1)
	}

	message := fmt.Sprintf("Привет из Go, %s!", inputData.Name)
	output := OutputData{
		Status:       "success",
		Message:      message,
		ProcessedVal: inputData.Value * 4,
	}

	json.NewEncoder(os.Stdout).Encode(output)
}
