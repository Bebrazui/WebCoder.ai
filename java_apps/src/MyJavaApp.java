// java_apps/src/MyJavaApp.java
import java.util.Scanner;
import org.json.JSONObject; // Вам понадобится библиотека org.json

public class MyJavaApp {
    public static void main(String[] args) {
        // Проверяем, есть ли аргументы командной строки
        if (args.length > 0) {
            String inputJsonString = args[0];
            try {
                // Парсим входные данные как JSON
                JSONObject inputJson = new JSONObject(inputJsonString);
                String name = inputJson.optString("name", "Гость");
                int age = inputJson.optInt("age", 0);

                // Обрабатываем данные
                String message = "Привет, " + name + "! Тебе " + age + " лет.";
                JSONObject outputJson = new JSONObject();
                outputJson.put("status", "success");
                outputJson.put("message", message);
                outputJson.put("processedAge", age * 2);

                // Выводим результат в консоль (stdout) в формате JSON
                System.out.println(outputJson.toString());

            } catch (org.json.JSONException e) {
                // Если входные данные не являются валидным JSON
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Ошибка парсинга JSON: " + e.getMessage());
                System.err.println(errorJson.toString()); // Ошибки лучше в stderr
            } catch (Exception e) {
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Произошла ошибка: " + e.getMessage());
                System.err.println(errorJson.toString());
            }
        } else {
            // Если аргументов нет
            JSONObject errorJson = new JSONObject();
            errorJson.put("status", "error");
            errorJson.put("message", "Не переданы входные данные.");
            System.err.println(errorJson.toString());
        }
    }
}
