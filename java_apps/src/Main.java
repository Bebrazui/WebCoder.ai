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

                // Вместо создания окна, выводим сообщение.
                // Это позволит коду успешно выполняться в серверной среде.
                String message = "Программа успешно запущена для пользователя " + name + "!";
                
                JSONObject outputJson = new JSONObject();
                outputJson.put("status", "success");
                outputJson.put("message", message);
                outputJson.put("info", "Графический интерфейс (MyFrame) не был запущен, так как среда не поддерживает GUI.");
                outputJson.put("processedAge", age * 2);

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
             // Этот код можно использовать для проверки отдельных частей логики, не связанных с GUI.
            JSONObject outputJson = new JSONObject();
            outputJson.put("status", "success");
            outputJson.put("message", "Программа запущена без аргументов. GUI не создается.");
            System.out.println(outputJson.toString());
        }
    }
}
