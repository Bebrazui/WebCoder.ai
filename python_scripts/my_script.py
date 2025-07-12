import sys
import json

def process_data(input_data):
    # Пример обработки данных
    processed_value = input_data.get("value", 0) * 2
    return {"processedResult": processed_value, "message": "Привет от Python!"}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            # Парсим JSON-строку, переданную как аргумент
            input_data = json.loads(sys.argv[1])
            result = process_data(input_data)
            print(json.dumps(result))
        except json.JSONDecodeError:
            print(json.dumps({"error": "Неверный JSON-ввод"}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    else:
        print(json.dumps({"error": "Нет входных данных"}))

    sys.stdout.flush() # Очень важно для немедленной отправки данных
