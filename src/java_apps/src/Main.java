// java_apps/src/Main.java
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    public static void main(String[] args) {
        if (args.length > 0) {
            String inputJsonString = args[0];
            try {
                JSONObject inputJson = new JSONObject(inputJsonString);
                String mode = inputJson.optString("mode", "default");

                if ("disassemble".equals(mode)) {
                    handleDisassemble(inputJson);
                } else {
                    handleDefault(inputJson);
                }

            } catch (Exception e) {
                sendError("Unhandled exception: " + e.getMessage());
                e.printStackTrace();
            }
        } else {
            sendError("No input data provided.");
        }
    }

    private static void handleDefault(JSONObject inputJson) {
        String name = inputJson.optString("name", "Гость");
        int age = inputJson.optInt("age", 0);

        String message = "Привет из Java, " + name + "!";
        
        JSONObject outputJson = new JSONObject();
        outputJson.put("status", "success");
        outputJson.put("message", message);
        outputJson.put("info", "Это пример консольного Java-приложения.");
        outputJson.put("processedAge", age * 2);

        System.out.println(outputJson.toString());
    }

    private static void handleDisassemble(JSONObject inputJson) throws Exception {
        String classPath = inputJson.getString("classPath");
        String className = inputJson.getString("className");
        String workingDir = inputJson.getString("workingDir");

        List<String> command = new ArrayList<>();
        command.add("javap");
        command.add("-c");
        command.add("-classpath");
        command.add(classPath);
        command.add(className);

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(new File(workingDir));
        Process process = pb.start();

        String result = new BufferedReader(new InputStreamReader(process.getInputStream()))
            .lines().collect(Collectors.joining("\n"));
        
        String error = new BufferedReader(new InputStreamReader(process.getErrorStream()))
            .lines().collect(Collectors.joining("\n"));

        int exitCode = process.waitFor();

        if (exitCode != 0) {
            sendError(error.isEmpty() ? "javap exited with code " + exitCode : error);
            return;
        }
        
        JSONObject outputJson = new JSONObject();
        outputJson.put("status", "success");
        outputJson.put("disassembledCode", result);
        System.out.println(outputJson.toString());
    }

    private static void sendError(String message) {
        JSONObject errorJson = new JSONObject();
        errorJson.put("status", "error");
        errorJson.put("message", message);
        System.err.println(errorJson.toString());
        System.exit(1);
    }
}
