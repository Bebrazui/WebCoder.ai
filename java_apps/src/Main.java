// java_apps/src/Main.java
import java.util.Scanner;
import org.json.JSONObject; // Вам понадобится библиотека org.json

public class Main {
    public static void main(String[] args) {
        if (args.length > 0) {
            String inputJsonString = args[0];
            try {
                JSONObject inputJson = new JSONObject(inputJsonString);
                String name = inputJson.optString("name", "Гость");
                int age = inputJson.optInt("age", 0);

                String message = "Привет из Java, " + name + "! Тебе " + age + " лет.";
                JSONObject outputJson = new JSONObject();
                outputJson.put("status", "success");
                outputJson.put("message", message);
                outputJson.put("processedAge", age * 2);

                System.out.println(outputJson.toString());

            } catch (org.json.JSONException e) {
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Ошибка парсинга JSON: " + e.getMessage());
                System.err.println(errorJson.toString());
            } catch (Exception e) {
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Произошла ошибка: " + e.getMessage());
                System.err.println(errorJson.toString());
            }
        } else {
            JSONObject errorJson = new JSONObject();
            errorJson.put("status", "error");
            errorJson.put("message", "Не переданы входные данные.");
            System.err.println(errorJson.toString());
        }
    }
}
