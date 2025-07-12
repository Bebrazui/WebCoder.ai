# ruby_scripts/my_ruby_script.rb
require 'json'

if ARGV.any?
  input_data_json = ARGV[0]
  begin
    input_data = JSON.parse(input_data_json)
    name = input_data['name'] || 'Гость'
    message = "Привет из Ruby, #{name}!"
    output = { status: 'success', message: message, processed_value: input_data['value'].to_i * 3 }
    puts output.to_json
  rescue JSON::ParserError => e
    STDERR.puts({ status: 'error', message: "Ошибка парсинга JSON: #{e.message}" }.to_json)
  rescue => e
    STDERR.puts({ status: 'error', message: "Произошла ошибка: #{e.message}" }.to_json)
  end
else
  STDERR.puts({ status: 'error', message: "Нет входных данных" }.to_json)
end
