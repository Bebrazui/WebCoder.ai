// java_apps/src/Main.java
import org.json.JSONObject;

public class Main {
    public static void main(String[] args) {
        if (args.length > 0) {
            String inputJsonString = args[0];
            try {
                JSONObject inputJson = new JSONObject(inputJsonString);
                String name = inputJson.optString("name", "Гость");
                int age = inputJson.optInt("age", 0);

                // Теперь это консольное приложение, оно не пытается открыть окно.
                String message = "Привет из Java, " + name + "!";
                
                JSONObject outputJson = new JSONObject();
                outputJson.put("status", "success");
                outputJson.put("message", message);
                outputJson.put("info", "Это пример консольного Java-приложения.");
                outputJson.put("processedAge", age * 2);

                // Выводим результат в стандартный вывод, чтобы IDE могла его поймать.
                System.out.println(outputJson.toString());

            } catch (org.json.JSONException e) {
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Ошибка парсинга JSON: " + e.getMessage());
                System.err.println(errorJson.toString());
                System.exit(1);
            } catch (Exception e) {
                JSONObject errorJson = new JSONObject();
                errorJson.put("status", "error");
                errorJson.put("message", "Произошла ошибка: " + e.getMessage());
                System.err.println(errorJson.toString());
                System.exit(1);
            }
        } else {
             JSONObject errorJson = new JSONObject();
             errorJson.put("status", "error");
             errorJson.put("message", "Не переданы входные данные.");
             System.err.println(errorJson.toString());
             System.exit(1);
        }
    }
}
