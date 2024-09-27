from tkinter import ttk, messagebox as msgbox
from PIL import Image, ImageTk
from datetime import datetime
import tkinter as tk
import webbrowser
import Levenshtein
import shutil
import pytz
import sys
import os
import re

VERSION = "V2.3.0"

ending1_ch = [
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "The Hub枢纽", 
            "Level 2废弃公共带(1)", "Level 3发电站", "Level 4废弃办公室", "Level 5恐怖旅馆(1)", "Level 5恐怖旅馆(2)", "Level 5恐怖旅馆(3)", "Level 2废弃公共带(2)", "Level Fun享乐层", 
            "Level 37崇高", "Level !", "The End终末", "Level 922……无尽的结局", "Level 94动画(1)", "Level 94动画(2)", "Level 6熄灯", 
            "Level 7深海恐惧症", "Level 8岩洞系统", "Level 0.11腐烂的前厅", "Level 9郊区(1)", "Level 9郊区(2)", "Level 10丰裕", "Level 3999真正的结局", 
            "Level 0.2重塑的混乱", "Level 6.1零食室", "Level !-!灵魂终末", "Level 188百叶庭", "Level 37.2暗池(1)", "Level 37.2暗池(2)","Level 37.2暗池(3)", "Level 37.2暗池(4)", "Level FUN+(1)",  "Level FUN+(2)", "Level FUN+(3)", "Level FUN+(4)", "Level FUN+(5)","Level 52学校大厅", 
            "Level 55.1隧道"
        ]

ending2_ch = [
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "The Hub枢纽", 
            "Level 2废弃公共带(1)", "Level 3发电站", "Level 4废弃办公室", "Level 5恐怖旅馆(1)", "Level 5恐怖旅馆(2)", "Level 5恐怖旅馆(3)", "Level 2废弃公共带(2)", "Level Fun享乐层", 
            "Level 37崇高", "Level !", "The End终末", "Level 922……无尽的结局", "Level 94动画(1)", "Level 94动画(2)", "Level 6熄灯", 
            "None（请勿选择）"
        ]

ending3_ch = [
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "The Hub枢纽", 
            "Level 2废弃公共带(1)", "Level 3发电站", "Level 4废弃办公室", "Level 5恐怖旅馆(1)", "Level 5恐怖旅馆(2)", "Level 5恐怖旅馆(3)", "Level 2废弃公共带(2)", "Level Fun享乐层", 
            "Level 37崇高", "Level !", "The End终末", "Level 922……无尽的结局", "Level 94动画(1)", "Level 94动画(2)", "Level 6熄灯", 
            "Level 7深海恐惧症", "Level 8岩洞系统", "Level 0.11腐烂的前厅", "Level 9郊区(1)", "Level 9郊区(2)", "Level 10丰裕", "Level 3999真正的结局", 
            "Level 0.2重塑的混乱", "Level 6.1零食室", "Level !-!灵魂终末", "Level 188百叶庭", "None（请勿选择）"
        ]

ending4_ch = [
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "None（请勿选择）"
        ]

ending5_ch = [
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "The Hub枢纽", 
            "Level 2废弃公共带(1)", "Level 3发电站", "Level 4废弃办公室", "Level 5恐怖旅馆(1)", "Level 5恐怖旅馆(2)", "Level 5恐怖旅馆(3)", "Level 2废弃公共带(2)", "Level Fun享乐层", 
            "Level 37崇高", "Level !", "The End终末", "None（请勿选择）", "None（请勿选择）", "None（请勿选择）"
        ]

ending1_mapping = {
            "0" : "level0",
            "1" : "TopFloor",
            "2" : "MiddleFloor",
            "3" : "GarageLevel2",
            "4" : "BottomFloor",
            "5" : "thehub",
            "6" : "Pipes1",
            "7" : "ElectricalStation",
            "8" : "office",
            "9" : "hotel",
            "10" : "Floor3",
            "11" : "BoilerRoom",
            "12" : "Pipes2",
            "13" : "levelfun",
            "14" : "Poolrooms",
            "15" : "levelrun",
            "16" : "theend",
            "17" : "level922",
            "18" : "level94",
            "19" : "AnimatedKingdom",
            "20" : "lightsOut",
            "21" : "OceanMap",
            "22" : "CaveLevel",
            "23" : "level05",
            "24" : "Level9",
            "25" : "AbandonedBase",
            "26" : "Level10",
            "27" : "level3999",
            "28" : "level07",
            "29" : "Snackrooms",
            "30" : "LevelDash",
            "31" : "Level188Expanded",
            "32" : "PoolroomsExpanded",
            "33" : "WaterParkLevel01",
            "34" : "WaterParkLevel02",
            "35" : "WaterParkLevel03",
            "36" : "LevelFunExpanded",
            "37" : "Zone1",
            "38" : "Zone2",
            "39" : "Zone3",
            "40" : "Zone4",
            "41" : "level52",
            "42" : "TunnelLevel"
        }
ending2_mapping = {
            "0" : "level0",
            "1" : "TopFloor",
            "2" : "MiddleFloor",
            "3" : "GarageLevel2",
            "4" : "BottomFloor",
            "5" : "thehub",
            "6" : "Pipes1",
            "7" : "ElectricalStation",
            "8" : "office",
            "9" : "hotel",
            "10" : "Floor3",
            "11" : "BoilerRoom",
            "12" : "Pipes2",
            "13" : "levelfun",
            "14" : "Poolrooms",
            "15" : "levelrun",
            "16" : "theend",
            "17" : "level922",
            "18" : "level94",
            "19" : "AnimatedKingdom",
            "20" : "lightsOut",
        }
ending3_mapping = {
            "0" : "level0",
            "1" : "TopFloor",
            "2" : "MiddleFloor",
            "3" : "GarageLevel2",
            "4" : "BottomFloor",
            "5" : "thehub",
            "6" : "Pipes1",
            "7" : "ElectricalStation",
            "8" : "office",
            "9" : "hotel",
            "10" : "Floor3",
            "11" : "BoilerRoom",
            "12" : "Pipes2",
            "13" : "levelfun",
            "14" : "Poolrooms",
            "15" : "levelrun",
            "16" : "theend",
            "17" : "level922",
            "18" : "level94",
            "19" : "AnimatedKingdom",
            "20" : "lightsOut",
            "21" : "OceanMap",
            "22" : "CaveLevel",
            "23" : "level05",
            "24" : "Level9",
            "25" : "AbandonedBase",
            "26" : "Level10",
            "27" : "level3999",
            "28" : "level07",
            "29" : "Snackrooms",
            "30" : "LevelDash",
            "31" : "Level188Expanded",
        }
ending4_mapping = {
            "0" : "level0",
            "1" : "TopFloor",
            "2" : "MiddleFloor",
            "3" : "GarageLevel2",
            "4" : "BottomFloor",
        }
ending5_mapping = {
            "0" : "level0",
            "1" : "TopFloor",
            "2" : "MiddleFloor",
            "3" : "GarageLevel2",
            "4" : "BottomFloor",
            "5" : "thehub",
            "6" : "Pipes1",
            "7" : "ElectricalStation",
            "8" : "office",
            "9" : "hotel",
            "10" : "Floor3",
            "11" : "BoilerRoom",
            "12" : "Pipes2",
            "13" : "levelfun",
            "14" : "Poolrooms",
            "15" : "levelrun",
            "16" : "theend",
        }

# 获取资源路径 - get resource path
def get_resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.dirname(os.path.abspath(__file__))

    return os.path.join(base_path, relative_path)

class Window(tk.Tk):
    def __init__(self):
        super().__init__()
        screenwidth = self.winfo_screenwidth()
        screenheight = self.winfo_screenheight()

        # 设置窗口标题 - set window title
        self.title("逃离后室存档工具"+VERSION)
        # 设置窗口图标 - set window icon
        self.iconbitmap(get_resource_path("Others/icons/ETB.ico"))

        # 设置窗口大小 - set window size
        size = '%dx%d+%d+%d' % (834, 485, (screenwidth - 834) / 2, (screenheight - 515) / 2)#834x485
        self.geometry(size)
        self.resizable(False, False)

        # 设置背景图 - set background
        self.background_image = Image.open(get_resource_path("Others/images/main.jpg"))
        self.background_photo = ImageTk.PhotoImage(self.background_image)
        self.background_label = tk.Label(self, image=self.background_photo)
        self.background_label.place(x=0, y=0, relwidth=1, relheight=1)

        self.create_all_widgets()
        self.show_main_widgets()

    # 创建主界面控件 - create main widgets
    def create_main_widgets(self):
        # 创建按钮 - create buttons
        self.buttons = []
        button_texts = ["新建", "删除", "编辑", "隐藏", "刷新", "显示文件夹", "设置"]
        button_x = 10
        button_y = 10
        for text in button_texts:
            button = tk.Button(text=text, width=11, height=2, font=("SimHei", 12), command=self.get_command(text))
            button.place(x=button_x, y=button_y)
            self.buttons.append(button)
            button_x += 110
        # 创建图标按钮 - create icon button
        icon_image = Image.open(get_resource_path("Others/icons/ETB.ico"))
        icon_image.thumbnail((50, 50))
        self.icon_photo = ImageTk.PhotoImage(icon_image)

        self.icon_button = tk.Button(image=self.icon_photo, command=self.play)
        self.icon_button.place(x=button_x, y=button_y, width=50, height=50)
        self.buttons.append(self.icon_button)

        # 创建Treeview - create Treeview
        self.treeview = ttk.Treeview(show="headings")
        self.treeview.place(x=10, y=button_y + 0, width=814, height=390)

        # 设置Treeview列的宽度和表头 - sets the width of the Treeview column and the header
        self.treeview["columns"] = ("mode", "name", "difficulty")
        self.treeview.heading("mode", text="存档类型", anchor=tk.CENTER)
        self.treeview.heading("name", text="存档名称", anchor=tk.CENTER)
        self.treeview.heading("difficulty", text="存档难度", anchor=tk.CENTER)
        self.set_column_widths([5/22, 11/22, 5/22])

        self.populate_treeview()

        # 保持文字在正中间 - keep the text centered
        for col in self.treeview["columns"]:
            self.treeview.heading(col, anchor="center")
            self.treeview.column(col, anchor="center")
    
    # 开始游戏 - play "Escape The Backrooms"
    def play(self):
        webbrowser.open("steam://rungameid/1943950")
    
    def check_update(self):
        webbrowser.open_new("https://docs.qq.com/doc/DTHNKSEx1d3lFemlC")
    
    def author(self):
        webbrowser.open_new("https://space.bilibili.com/2019959464")

    # 设置每列宽度 - set column widths
    def set_column_widths(self, widths):
        total_width = 814
        column_widths = [int(total_width * width) for width in widths]
        for i, width in enumerate(column_widths):
            self.treeview.column(i, width=width)
    
    #填充Treeview - populate treeview
    def populate_treeview(self):
        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        if not os.path.exists(save_games_dir):
            return

        old_saves = os.listdir(save_games_dir)

        valid_saves = []
        for file_name in old_saves:
            if file_name.startswith("MULTIPLAYER_") or file_name.startswith("SINGLEPLAYER_"):
                valid_saves.append(file_name)

        for i, file_name in enumerate(valid_saves, start=1):
            mode, name, difficulty = self.parse_file_name(file_name)
            if mode and name and difficulty:
                self.treeview.insert("", "end", text=str(i), values=(mode, name, difficulty))
    
    # 解析文件名 - parse file name
    def parse_file_name(self, file_name):
        parts = file_name.split("_")
        if len(parts) >= 3:
            mode = parts[0].replace("MULTIPLAYER", "多人模式").replace("SINGLEPLAYER", "单人模式")
            name = parts[1]
            difficulty = parts[2].split(".")[0].replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
            if file_name.startswith("SINGLEPLAYER_"):
                    difficulty = "普通难度"
            return mode, name, difficulty
        return None, None, None

    # 获取指令 - get command
    def get_command(self, text):
        commands = {
            "新建": self.new,
            "删除": self.delete,
            "编辑": self.edit,
            "隐藏": self.hide,
            "刷新": self.refresh,
            "显示文件夹": self.show_folder,
            "设置": self.settings,
        }
        return commands.get(text, None)
    
    def new(self):
        self.hide_all_widgets()
        self.name_label.place(x=10, y=10, height=30, width=170)
        self.name_entry.place(x=10, y=40, height=30, width=170)
        self.name_entry.delete(0, "end")

        self.ending_label.place(x=10, y=90, height=30, width=170)
        self.endingbox.place(x=10, y=120, height=30, width=170)
        self.endingbox.set("主结局")

        self.level_label.place(x=10, y=170, height=30, width=170)
        self.levelbox.place(x=10, y=200, height=30, width=170)
        self.levelbox.set("Level 0教学关卡")

        self.difficulty_label.place(x=10, y=250, height=30, width=170)
        self.difficultybox.place(x=10, y=280, height=30, width=170)
        self.difficultybox.set("普通难度")

        self.mode_label.place(x=10, y=330, height=30, width=170)
        self.modebox.place(x=10, y=360, height=30, width=170)
        self.modebox.set("单人模式")

        self.new_btn.place(x=10, y=410, height=50, width=75)
        self.new_back_btn.place(x=105, y=410, width=75, height=50)

        self.white_canvas.place(x=200, y=65, width=100, height=100)
        self.image_label.place(x=200, y=65)
        self.show_image()

    def create_new_widgets(self):
        self.name_label = tk.Label(text="请输入新的存档名称：", font=("SimHei", 12))
        self.name_label.place(x=10, y=10, height=40, width=170)

        self.name_entry = tk.Entry(font=("SimHei", 14))
        self.name_entry.place(x=10, y=50, height=30, width=170)

        self.ending_label = tk.Label(text="请选择结局：", font=("SimHei", 12))
        self.ending_label.place(x=10, y=100, height=40, width=170)

        self.endingbox = ttk.Combobox(values=["主结局", "结局2", "结局3", "结局4", "结局5"], font=("SimHei", 12), state="readonly")
        self.endingbox.place(x=10, y=140, height=30, width=170)
        self.endingbox.set("主结局")

        self.level_label = tk.Label(text="请选择层级：", font=("SimHei", 12))
        self.level_label.place(x=10, y=190, height=40, width=170)
        self.levelboxvalue = ending1_ch
        self.levelbox = ttk.Combobox(values=self.levelboxvalue, font=("SimHei", 12), state="readonly")
        self.levelbox.place(x=10, y=230, height=30, width=170)
        self.levelbox.set(self.levelboxvalue[0])
        self.endingbox.bind("<<ComboboxSelected>>", self.switch_ending)

        self.difficulty_label = tk.Label(text="请选择难度：", font=("SimHei", 12))
        self.difficulty_label.place(x=10, y=280, height=40, width=170)

        self.difficultybox = ttk.Combobox(values=["简单难度", "普通难度", "困难难度", "噩梦难度"], font=("SimHei", 12), state="disabled")
        self.difficultybox.place(x=10, y=320, height=30, width=170)
        self.difficultybox.set("普通难度")

        self.mode_label = tk.Label(text="请选择模式：", font=("SimHei", 12))
        self.mode_label.place(x=10, y=370, height=40, width=170)

        self.modebox = ttk.Combobox(values=["单人模式", "多人模式"], font=("SimHei", 12), state="readonly")
        self.modebox.place(x=10, y=410, height=30, width=170)
        self.modebox.set("单人模式")

        self.modebox.bind("<<ComboboxSelected>>", self.disable_difficulty)

        self.new_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.confirm_new) 
        self.new_btn.place(x=10, y=460, height=50, width=75)

        new_back_btn_icon = Image.open(get_resource_path("Others/icons/back.ico"))
        new_back_btn_icon.thumbnail((50, 50))
        self.new_back_btn_photo = ImageTk.PhotoImage(new_back_btn_icon)

        self.new_back_btn = tk.Button(image=self.new_back_btn_photo, command=self.back)
        self.new_back_btn.place(x=105, y=460, width=75, height=50)

        # 创建纯白色方形
        self.white_canvas = tk.Canvas(bg="white", width=814, height=315)

        # 加载默认图片
        default_image_path = get_resource_path("Others/images/0.jpg")
        self.default_image = Image.open(default_image_path) 
        self.default_photo = ImageTk.PhotoImage(self.default_image) #

        # 创建显示图片的标签
        self.image_label = tk.Label(image=self.default_photo)
        self.image_label.place(x=200, y=82)

        self.show_image()

        self.levelbox.bind("<<ComboboxSelected>>", self.show_image)

    def switch_ending(self, event):
        selected_ending = self.endingbox.get()
        if selected_ending == "主结局":
            self.levelboxvalue = ending1_ch
        elif selected_ending == "结局2":
            self.levelboxvalue = ending2_ch
        elif selected_ending == "结局3":
            self.levelboxvalue = ending3_ch
        elif selected_ending == "结局4":
            self.levelboxvalue = ending4_ch
        elif selected_ending == "结局5":
            self.levelboxvalue = ending5_ch
        self.levelbox.config(values=self.levelboxvalue)
        self.levelbox.set(self.levelboxvalue[0])
        self.show_image()
        
    def disable_difficulty(self, event):
        selected_mode = self.modebox.get()
        if selected_mode == "多人模式":
            self.difficultybox.config(state="readonly")
        elif selected_mode == "单人模式":
            self.difficultybox.config(state="disabled")
            self.difficultybox.set("普通难度")

    def show_image(self, event=None):
        selected_index = self.levelbox.current()
        selected_ending_1 = self.endingbox.current()
        if selected_ending_1 == 0:
            image_path = get_resource_path(f"Others/images/{selected_index}.jpg")
        elif selected_ending_1 == 1:
            if selected_index > 20:
                image_path = get_resource_path(f"Others/images/None.jpg")
            elif selected_index <= 20:
                image_path = get_resource_path(f"Others/images/{selected_index}.jpg")
        elif selected_ending_1 == 2:
            if selected_index > 31:
                image_path = get_resource_path(f"Others/images/None.jpg")
            elif selected_index <= 31:
                image_path = get_resource_path(f"Others/images/{selected_index}.jpg")
        elif selected_ending_1 == 3:
            if selected_index > 4:
                image_path = get_resource_path(f"Others/images/None.jpg")
            elif selected_index <= 4:
                image_path = get_resource_path(f"Others/images/{selected_index}.jpg")
        elif selected_ending_1 == 4:
            if selected_index > 16:
                image_path = get_resource_path(f"Others/images/None.jpg")
            elif selected_index <= 16:
                image_path = get_resource_path(f"Others/images/{selected_index}.jpg")
        self.show_image_on_canvas(image_path)

    def show_image_on_canvas(self, image_path):
        # 清空画布
        self.white_canvas.delete("all")
        
        # 加载并缩放图片
        image = Image.open(image_path)
        image.thumbnail((680, 350))  # 缩放图片以适应画布
        self.image_on_canvas = ImageTk.PhotoImage(image)

        # 计算图片在画布上的位置使其居中显示
        canvas_width = 680
        canvas_height = 350
        image_width = image.width
        image_height = image.height

        x_offset = (canvas_width - image_width) / 2
        y_offset = (canvas_height - image_height) / 2


        self.white_canvas.create_image(x_offset, y_offset, anchor="nw", image=self.image_on_canvas)

        # 更新图片标签的配置
        self.image_label.configure(image=self.image_on_canvas)

    def confirm_new(self):
        new_name = self.name_entry.get().strip()
        if not new_name:
            msgbox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            msgbox.showerror("错误", "仅限英文字母及数字")
            return
        
        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        mode = self.modebox.get()
        difficulty = self.difficultybox.get()
        level = self.levelbox.current()
        ending = self.endingbox.current()
        if ending == 0:
            level = str(level)
        elif ending == 1:
            if level > 20:
                msgbox.showerror("错误", "请勿选择此选项！")
                return
            elif level <= 20:
                level = str(level)
        elif ending == 2:
            if level > 31:
                msgbox.showerror("错误", "请勿选择此选项！")
                return
            elif level <= 31:
                level = str(level)
        elif ending == 3:
            if level > 4:
                msgbox.showerror("错误", "请勿选择此选项！")
                return
            elif level <= 4:
                level = str(level)
        elif ending == 4:
            if level > 16:
                msgbox.showerror("错误", "请勿选择此选项！")
                return
            elif level <= 16:
                level = str(level)

        name = self.name_entry.get()
        if mode == "单人模式":
            if level in ending1_mapping:
                # 获取当前时间的 datetime 对象
                now = datetime.now()
                # 获取当前时区
                local_timezone = pytz.timezone('Africa/Abidjan')
                now_local = local_timezone.localize(now)
                # 转换为 UTC 时间
                now_utc = now_local.astimezone(pytz.utc)
                # 获取时间戳
                timestamp = int(now_utc.timestamp())
                # 获取映射值
                mapped_value = ending1_mapping[level]
                old_filename = get_resource_path(f"Saves/SINGLEPLAYER/{mapped_value}.sav")
                new_filename = f"SINGLEPLAYER_{name}_{timestamp}.sav"
                new_filepath = os.path.join(save_games_dir, new_filename)

        elif mode == "多人模式":
            if level in ending1_mapping:
                mapped_value = ending1_mapping[level]
                if difficulty == "简单难度":
                    old_filename = get_resource_path(f"Saves/MULTIPLAYER/EASY/MULTIPLAYER_{mapped_value}_Easy.sav")
                    new_filename = f"MULTIPLAYER_{name}_Easy.sav"

                elif difficulty == "普通难度":
                    old_filename = get_resource_path(f"Saves/SINGLEPLAYER/{mapped_value}.sav")
                    new_filename = f"MULTIPLAYER_{name}_Normal.sav"

                elif difficulty == "困难难度":
                    old_filename = get_resource_path(f"Saves/MULTIPLAYER/HARD/MULTIPLAYER_{mapped_value}_Hard.sav")
                    new_filename = f"MULTIPLAYER_{name}_Hard.sav"

                elif difficulty == "噩梦难度":
                    old_filename = get_resource_path(f"Saves/MULTIPLAYER/Nightmare/MULTIPLAYER_{mapped_value}_Nightmare.sav")
                    new_filename = f"MULTIPLAYER_{name}_Hard.sav"

                new_filepath = os.path.join(save_games_dir, new_filename)

        try:
            # 复制存档模板文件到目标目录并重命名
            shutil.copy(old_filename, new_filepath)
            if mode == "单人模式":
                msgbox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"单人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"时间戳："+f"{timestamp}"+"\n"+"时间："+f"{now}")
            elif mode == "多人模式":
                if difficulty == "噩梦难度":
                    msgbox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"多人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"存档难度"+f": {difficulty}"+"(需要找到显示困难难度的存档)")
                else:
                    msgbox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"多人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"存档难度"+f": {difficulty}")
        except Exception as e:
            msgbox.showerror("错误", "创建存档错误："+f" {str(e)}")

        # 清空输入框内容
        self.name_entry.delete(0, tk.END)

        self.back()
        self.refresh()

    #删除存档 - delete save games
    def delete(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            msgbox.showinfo("提示", "请选择要删除的存档！")
            return
        else:
            ds = msgbox.askquestion("提示", "你确定要删除此存档吗？")
            if ds == "yes":
                for item in selected_item:
                    item_values = self.treeview.item(item, "values")
                    mode, name, difficulty = item_values
                    save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

                    if mode == "单人模式":
                        mode = "SINGLEPLAYER_"
                        temp = f"{mode}{name}"
                        # 获取目录下所有文件名 - Gets all file names in the directory
                        file_names = os.listdir(save_games_dir)

                        # 初始化最小编辑距离和最相似文件 - Initializes the minimum edit distance and most similar files
                        min_distance = float('inf')
                        most_similar_file = None

                        # 遍历文件名列表 - Iterate through the list of file names
                        for file_name in file_names:
                            # 检查文件名是否以"SINGLEPLAYER_"开头 - Check that the file name begins with "SINGLEPLAYER"
                            if file_name.startswith(temp):
                                # 计算编辑距离 - Calculated edit distance
                                distance = Levenshtein.distance(temp, file_name)
                                # 更新最小编辑距离和最相似文件名 - Updates the minimum edit distance and most similar file names
                                if distance < min_distance:
                                    min_distance = distance
                                    most_similar_file = file_name
                        temp_path = os.path.join(save_games_dir, most_similar_file)
                    elif mode == "多人模式":
                        mode = "MULTIPLAYER_"
                        if difficulty == "普通难度":
                                difficulty = "_Normal"
                        elif difficulty == "简单难度":
                            difficulty = "_Easy"
                        elif difficulty == "困难难度":
                            difficulty = "_Hard"
                        elif difficulty == "噩梦难度":
                            difficulty = "_Nightmare"

                        temp = f"{mode}{name}{difficulty}.sav"
                        temp_path = os.path.join(save_games_dir, temp)

                    if os.path.exists(temp_path):
                        if mode == "MULTIPLAYER_":
                            true = msgbox.askquestion("提示", "请检查文件名是否正确："+f"\n{temp}\n"+"如果不正确，请自行删除")
                            if true == "yes":
                                os.remove(temp_path)
                                msgbox.showinfo("提示", "成功删除"+f"\n{temp}")
                            else:
                                return
                        elif mode == "SINGLEPLAYER_":
                            parts = most_similar_file.split("_")
                            if len(parts) >= 3:
                                difficulty = parts[2].split(".")[0]
                            timestamp = int(difficulty)
                            utc_dt = datetime.fromtimestamp(timestamp)
                            local_dt = utc_dt.replace(tzinfo=pytz.utc).astimezone(pytz.timezone('Etc/GMT+8'))
                            formatted_local_dt = local_dt.strftime('%Y-%m-%d %H:%M:%S')
                            true = msgbox.askquestion("提示", "请检查文件名是否正确："+f"\n{most_similar_file}\n"+"创建时间："+"\n"+"如果不正确，请自行删除")
                            if true == "yes":
                                os.remove(temp_path)
                                msgbox.showinfo("提示", "成功删除"+f"\n{most_similar_file}")
                            else:
                                return

                        self.refresh()
                        name, mode, difficulty, temp = "", "", "", ""
                    else:
                        msgbox.showerror("错误", "未成功删除"+f"\n{temp}")
                        name, mode, difficulty, temp = "", "", "", ""

    def edit(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            msgbox.showinfo("提示", "请选择要编辑的存档！")
            return
        
        self.hide_all_widgets()
        self.create_edit_widgets()

    # 隐藏存档 - hide save games
    def hide(self):
        hidden_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames", "HiddenFiles")

        # 创建隐藏存档文件夹 - create hidden save games folder
        if not os.path.exists(hidden_dir):
            try:
                os.makedirs(hidden_dir)
            except OSError as e:
                msgbox.showerror("错误", "发生错误"+f": {e}")

        # 获取被选中的存档 - get selected save games
        selected_item = self.treeview.selection()
        if not selected_item:
            msgbox.showinfo("提示", "请选择要隐藏的存档！")
            return
        
        # 移动存档到隐藏存档文件夹 - move save games to hidden folder
        for item in selected_item:
            item_values = self.treeview.item(item, "values")
            mode, name, difficulty = item_values
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

            # 在存档路径中查找找最相似的存档 - search the "save_games_dir" to find the most similar save game
            if mode == "单人模式":
                mode = "SINGLEPLAYER_"
                temp = f"{mode}{name}"
                # 获取目录下所有文件名 - get all file names in the "save_games_dir"
                file_names = os.listdir(save_games_dir)

                # 初始化最小编辑距离和最相似文件 - initialize the minimum edit distance and the most similar file
                min_distance = float('inf')
                most_similar_file = None

                # 遍历文件名列表 - find the most similar save game
                for file_name in file_names:
                    # 检查文件名是否以"SINGLEPLAYER_"开头 - check if the file name starts with "SINGLEPLAYER_"
                    if file_name.startswith(temp):
                        # 计算编辑距离 - calculate edit distance
                        distance = Levenshtein.distance(temp, file_name)
                        # 更新最小编辑距离和最相似文件名 - update the minimum edit distance and the most similar file name
                        if distance < min_distance:
                            min_distance = distance
                            most_similar_file = file_name
                temp_path = os.path.join(save_games_dir, most_similar_file)
            elif mode == "多人模式":
                mode = "MULTIPLAYER_"
                if difficulty == "普通难度":
                    difficulty = "_Normal"
                elif difficulty == "简单难度":
                    difficulty = "_Easy"
                elif difficulty == "困难难度":
                    difficulty = "_Hard"
                elif difficulty == "噩梦难度":
                    difficulty = "_Nightmare"

                temp = f"{mode}{name}{difficulty}.sav"
                temp_path = os.path.join(save_games_dir, temp)
            try:
                shutil.move(temp_path, hidden_dir)
                msgbox.showinfo("提示", "存档"+f'"{temp}"'+"已隐藏\n请前往存档文件夹下的HiddenFiles文件夹查看")
            except FileNotFoundError:
                msgbox.showerror("错误", "存档"+f'"{temp}"'+"未找到！")
            except PermissionError:
                msgbox.showerror("错误", "无权限！")
            except Exception as e:
                msgbox.showerror("错误", "发生错误"+f": {e}")
            self.refresh()
    
    # 刷新Treeview - refresh Treeview
    def refresh(self):
        # 清空Treeview中的所有数据 - delete all data in Treeview
        self.treeview.delete(*self.treeview.get_children())
        # 重新填充Treeview  - populate Treeview again
        self.populate_treeview()

    # 显示文件夹 - show folder
    def show_folder(self):
        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        if os.path.exists(save_games_dir):
            os.startfile(save_games_dir)

    def settings(self):
        self.hide_all_widgets()
        self.show_settings_widgets()

    def create_settings_widgets(self):
        # 创建输入框
        self.settings_entry = tk.Text(font=("SimHei", 12), wrap=tk.WORD)
        self.settings_entry.place(x=10, y=10, width=500, height=450)

        # 创建“检查更新”按钮
        self.update_button = tk.Button(text="检查更新", width=10, height=2, font=("SimHei", 12), command=self.check_update)
        self.update_button.place(x=520, y=10, width=170, height=30)

        self.author_btn = tk.Button(text="作者：流浪者糕蛋", width=20, height=1, font=("SimHei", 12), command=self.author)
        self.author_btn.pack(pady=20)
        self.author_btn.place(x=520, y=50)
    
    def show_settings_widgets(self):
        self.settings_entry.place(x=10, y=10, width=500, height=465)
        self.update_button.place(x=520, y=10, width=170, height=30)
        self.show_back_btn()
        self.author_btn.place(x=520, y=50)

        a_txt_path = get_resource_path("Others/zh_cn.txt")

        if os.path.exists(a_txt_path):
            with open(a_txt_path, "r", encoding="utf-8") as file:
                content = file.read()
                self.settings_entry.delete(1.0, tk.END)  # 清空输入框内容
                self.settings_entry.insert(1.0, content)  # 插入文件内容

        self.settings_entry.config(state='disabled')  # 设置输入框为禁用

    def create_edit_widgets(self):
        back_btn_icon = Image.open(get_resource_path("Others/icons/back.ico"))
        back_btn_icon.thumbnail((50, 50))
        self.back_btn_photo = ImageTk.PhotoImage(back_btn_icon)

        self.back_btn = tk.Button(image=self.back_btn_photo, command=self.back)
        self.back_btn.place(x=774, y=425, width=50, height=50)

        self.edit_label = tk.Label(text="请输入新的存档名称\n仅限英文字母及数字\n改不了代表名称重复", font=("SimHei", 12))
        self.edit_label.place(x=317, y=130, width=200, height=70)

        self.input = tk.Entry(font=("SimHei", 12))
        self.input.place(x=317, y=230, width=200, height=30)

        self.edit_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.edit_save_game)
        self.edit_btn.place(x=317, y=280, width=200, height=30)

    def show_edit_widgets(self):
        self.back_btn.place(x=774, y=435, width=50, height=50)
        self.edit_label.place(x=317, y=130, width=200, height=70)
        self.input.place(x=317, y=230, width=200, height=30)
        self.edit_btn.place(x=317, y=280, width=200, height=30)
    
    def edit_save_game(self):
        new_name = self.input.get().strip()
        if not new_name:
            msgbox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            msgbox.showerror("错误", "仅限英文字母及数字")
            return
        
        selected_item = self.treeview.selection()[0]
        item_values = self.treeview.item(selected_item, "values")
        mode = item_values[0]
        name = item_values[1]
        difficulty = item_values[2]

        if mode == "单人模式":
            mode = "SINGLEPLAYER_"
            temp = f"{mode}{name}"
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
            # 获取目录下所有文件名
            file_names = os.listdir(save_games_dir)

            # 初始化最小编辑距离和最相似文件
            min_distance = float('inf')
            most_similar_file = None

            # 遍历文件名列表
            for file_name in file_names:
                # 检查文件名是否以"SINGLEPLAYER_"开头
                if file_name.startswith(temp):
                    # 计算编辑距离
                    distance = Levenshtein.distance(temp, file_name)
                    # 更新最小编辑距离和最相似文件名
                    if distance < min_distance:
                        min_distance = distance
                        most_similar_file = file_name
            parts = most_similar_file.split("_")
            difficulty = parts[2].split(".")[0]
            old_name = f"{mode}{name}_{difficulty}.sav"
            new_name = f"{mode}{new_name}_{difficulty}.sav"
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
            old_name_path = os.path.join(save_games_dir, old_name)
            new_name_path = os.path.join(save_games_dir, new_name)

        elif mode == "多人模式":
            mode = "MULTIPLAYER_"

            if difficulty == "普通难度":
                difficulty = "_Normal"
            elif difficulty == "简单难度":
                difficulty = "_Easy"
            elif difficulty == "困难难度":
                difficulty = "_Hard"
            elif difficulty == "噩梦难度":
                difficulty == "_Nightmare"

            old_name = f"{mode}{name}{difficulty}.sav"
            new_name = f"{mode}{new_name}{difficulty}.sav"
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
            old_name_path = os.path.join(save_games_dir, old_name)
            new_name_path = os.path.join(save_games_dir, new_name)
        

        if os.path.exists(old_name_path):
            os.rename(old_name_path, new_name_path)
            os.rename(old_name_path, new_name_path)
            self.refresh()
            msgbox.showinfo("提示", "存档名称已经修改完成，修改后的名称为："+f"\n{new_name}")
            self.hide_all_widgets()
            self.show_main_widgets()
        else:
            msgbox.showerror("错误", "未成功修改"+f"\n{old_name}")
            self.hide_all_widgets()
            self.show_main_widgets()

    def back(self):
        self.hide_all_widgets()
        self.show_main_widgets()

    def show_main_widgets(self):
        times = 0
        for button in self.buttons:
            button.place(x=10 + 98 * times + 10 * times, y=10)
            times += 1
        self.treeview.place(x=10, y=80, width=814, height=390)

    def show_back_btn(self):
        self.back_btn.place(x=774, y=430, width=50, height=50)

    # 隐藏所有控件 - hide all widgets
    def hide_all_widgets(self):
        for button in self.buttons:
            button.place_forget()
        self.treeview.place_forget()
        self.back_btn.place_forget()
        self.edit_label.place_forget()
        self.input.place_forget()
        self.edit_btn.place_forget()
        self.settings_entry.place_forget()
        self.update_button.place_forget()
        self.author_btn.place_forget()
        self.name_label.place_forget()
        self.name_entry.place_forget()
        self.ending_label.place_forget()
        self.endingbox.place_forget()
        self.difficulty_label.place_forget()
        self.difficultybox.place_forget()
        self.level_label.place_forget()
        self.levelbox.place_forget()
        self.mode_label.place_forget()
        self.modebox.place_forget()
        self.new_btn.place_forget()
        self.new_back_btn.place_forget()
        self.white_canvas.place_forget()
        self.image_label.place_forget()
    
    def create_all_widgets(self):   
        self.create_main_widgets()
        self.create_edit_widgets()
        self.create_settings_widgets()
        self.create_new_widgets()
        self.hide_all_widgets()


if __name__ == "__main__":
    app = Window()
    app.mainloop()