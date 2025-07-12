
using System;
using System.Text.Json;
using System.Text.Json.Nodes;

public class Program
{
    public static void Main(string[] args)
    {
        if (args.Length > 0)
        {
            string inputJsonString = args[0];
            try
            {
                var inputJson = JsonNode.Parse(inputJsonString);
                string name = inputJson?["name"]?.GetValue<string>() ?? "Гость";
                int value = inputJson?["value"]?.GetValue<int>() ?? 0;

                string message = $"Привет из C#, {name}!";
                
                var outputJson = new JsonObject
                {
                    ["status"] = "success",
                    ["message"] = message,
                    ["processedValue"] = value * 20
                };

                Console.WriteLine(outputJson.ToJsonString());
            }
            catch (JsonException e)
            {
                var errorJson = new JsonObject
                {
                    ["status"] = "error",
                    ["message"] = "Ошибка парсинга JSON: " + e.Message
                };
                Console.Error.WriteLine(errorJson.ToJsonString());
                Environment.Exit(1);
            }
            catch (Exception e)
            {
                 var errorJson = new JsonObject
                {
                    ["status"] = "error",
                    ["message"] = "Произошла ошибка: " + e.Message
                };
                Console.Error.WriteLine(errorJson.ToJsonString());
                Environment.Exit(1);
            }
        }
        else
        {
            var errorJson = new JsonObject
            {
                ["status"] = "error",
                ["message"] = "Не переданы входные данные."
            };
            Console.Error.WriteLine(errorJson.ToJsonString());
            Environment.Exit(1);
        }
    }
}
