from datetime import datetime
import webbrowser
import Levenshtein
import binascii
import pytz
import sys
import os


save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

segments = {
    'Easy': '2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7230',
    'Hard': '2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7231',
    'Nightmare': '2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7232',
    'Normal': '2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43',
        }
def get_resource_path(relative_path):
    # 尝试获取PyInstaller创建的临时目录，用于确定是否在打包后的可执行文件环境中运行
    try:
        base_path = sys._MEIPASS
    # 如果获取不到临时目录，即在普通Python脚本环境中运行，则获取当前脚本的目录路径
    except AttributeError:
        base_path = os.path.dirname(os.path.abspath(__file__))

    # 拼接基目录路径和相对路径，得到资源文件的绝对路径，并返回
    return os.path.join(base_path, relative_path)

def check_update():
        webbrowser.open_new("https://docs.qq.com/doc/DTHNKSEx1d3lFemlC")

def author():
        webbrowser.open_new("https://space.bilibili.com/2019959464")

def find_most_similar_save_games(mode, name):
    temp_name = f"{mode}_{name}"
    file_names = os.listdir(save_games_dir)

    min_distance = float('inf')
    most_similar_file = None

    for file_name in file_names:
        if file_name.startswith(temp_name):
            distance = Levenshtein.distance(temp_name, file_name)
            if distance < min_distance:
                min_distance = distance
                most_similar_file = file_name

    return most_similar_file

def check_real_difficulty(file_path):
    with open(file_path, 'rb') as file:
        content = file.read()
        for segment_id, hex_pattern in segments.items():
            pattern_bytes = binascii.unhexlify(hex_pattern)
            if pattern_bytes in content:
                return segment_id
    return None

def local_time(difficulty):
    if difficulty.isdigit():
        timestamp = int(difficulty)
        utc_dt = datetime.fromtimestamp(timestamp)
        local_dt = utc_dt.replace(tzinfo=pytz.utc).astimezone(pytz.timezone('Etc/GMT+8'))
        formatted_local_dt = local_dt.strftime('%Y-%m-%d %H:%M:%S')
        return formatted_local_dt
    else:
         return "普通难度"

def show_folder():
     if os.path.exists(save_games_dir):
        os.startfile(save_games_dir)

def get_time_stamp():
    # 获取当前时间的 datetime 对象
    now = datetime.now()
    # 获取当前时区
    local_timezone = pytz.timezone('Africa/Abidjan')
    now_local = local_timezone.localize(now)
    # 转换为 UTC 时间
    now_utc = now_local.astimezone(pytz.utc)
    # 获取时间戳
    timestamp = int(now_utc.timestamp())
    return timestamp

def find_and_replace_in_hex(file_path, search_hex, replace_hex):
    # 打开文件并读取原始数据
    with open(file_path, 'rb') as file:
        binary_data = file.read()

    # 转换为十六进制字符串
    hex_data = binascii.hexlify(binary_data).decode('ascii')

    # 将查找和替换的十六进制字符串转换为小写，确保大小写不敏感
    search_hex = search_hex.lower()
    replace_hex = replace_hex.lower()

    # 替换十六进制数据中的指定内容
    modified_hex_data = hex_data.replace(search_hex, replace_hex)

    # 将修改后的十六进制数据转换回二进制数据
    modified_binary_data = binascii.unhexlify(modified_hex_data.encode('ascii'))

    # 保存修改后的内容到原文件
    with open(file_path, 'wb') as file:
        file.write(modified_binary_data)
def new_edit_difficulty(name, mapped_value, difficulty):
    global new_filename
    if difficulty == "Easy":
        old_filename = get_resource_path(f"Resources/SaveGames/E1/{mapped_value}.sav")
        new_filename = f"MULTIPLAYER_{name}_Easy.sav"
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7230"

    elif difficulty == "Normal":
        old_filename = get_resource_path(f"Resources/SaveGames/E1/{mapped_value}.sav")
        new_filename = f"MULTIPLAYER_{name}_Normal.sav"
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43"

    elif difficulty == "Hard":
        old_filename = get_resource_path(f"Resources/SaveGames/E1/{mapped_value}.sav")
        new_filename = f"MULTIPLAYER_{name}_Hard.sav"
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7231"

    elif difficulty == "Nightmare":
        old_filename = get_resource_path(f"Resources/SaveGames/E1/{mapped_value}.sav")
        new_filename = f"MULTIPLAYER_{name}_Hard.sav"
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7232"

    new_filepath = os.path.join(save_games_dir, new_filename)
    file_path = os.path.join(save_games_dir, new_filename)
    search_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43"

    return old_filename, new_filepath, file_path, search_hex, replace_hex

def edit_edit_difficulty(new_difficulty, real_difficulty):
    if new_difficulty == "Easy":
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7230"
    elif new_difficulty == "Normal":
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43"
    elif new_difficulty == "Hard":
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7231"
    elif new_difficulty == "Nightmare":
        replace_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7232"
                
    if real_difficulty == "Easy":
        search_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7230"
    elif real_difficulty == "Normal":
        search_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43"
    elif real_difficulty == "Hard":
        search_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7231"
    elif real_difficulty == "Nightmare":
        search_hex = "2F47616D652F5361766553797374656D2F42505F4E65775F5361766547616D652E42505F4E65775F5361766547616D655F43000B000000446966666963756C7479000D0000004279746550726F70657274790021000000000000000D000000455F446966666963756C747900001D000000455F446966666963756C74793A3A4E6577456E756D657261746F7232"
                
    return search_hex, replace_hex