from function import get_resource_path, check_update, author, find_most_similar_save_games, check_real_difficulty, local_time, show_folder, get_time_stamp, new_edit_difficulty, find_and_replace_in_hex, edit_edit_difficulty
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import tkinter as tk
import shutil
import os
import re


VERSION = "2.5.0"

opened = []

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


save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

class Window(tk.Tk):
    def __init__(self):
        super().__init__()

        screenwidth = self.winfo_screenwidth()
        screenheight = self.winfo_screenheight()

        self.title("逃离后室存档工具"+VERSION)
        self.iconbitmap(get_resource_path("Resources/Other/Icons/ETB.ico"))

        size = '%dx%d+%d+%d' % (834, 485, (screenwidth - 834) / 2, (screenheight - 515) / 2)
        self.geometry(size)
        self.resizable(False, False)

        self.background_image = Image.open(get_resource_path("Resources/Other/Images/main.jpg"))
        self.background_photo = ImageTk.PhotoImage(self.background_image)
        self.background_label = tk.Label(self, image=self.background_photo)
        self.background_label.place(x=0, y=0, relwidth=1, relheight=1)

        self.create_main_widgets()
        self.populate_treeview()

        for col in self.treeview["columns"]:
            self.treeview.heading(col, anchor="center")
            self.treeview.column(col, anchor="center")

    def create_main_widgets(self):
        self.new_btn = tk.Button(text="新建", font=("SimHei", 12), command=self.new)
        self.new_btn.place(x=17, y=10, width=100, height=45)

        self.delete_btn = tk.Button(text="删除", font=("SimHei", 12), command=self.delete)
        self.delete_btn.place(x=133, y=10, width=100, height=45)

        self.edit_btn = tk.Button(text="编辑", font=("SimHei", 12), command=self.edit)
        self.edit_btn.place(x=249, y=10, width=100, height=45)

        self.refresh_btn = tk.Button(text="刷新", font=("SimHei", 12), command=self.refresh)
        self.refresh_btn.place(x=365, y=10, width=100, height=45)

        self.show_folder_btn = tk.Button(text="显示文件夹", font=("SimHei", 12), command=show_folder)
        self.show_folder_btn.place(x=481, y=10, width=100, height=45)

        self.more_btn = tk.Button(text="更多", font=("SimHei", 12), command=self.more)
        self.more_btn.place(x=597, y=10, width=100, height=45)

        self.settings_btn = tk.Button(text="设置", font=("SimHei", 12), command=self.settings)
        self.settings_btn.place(x=713, y=10, width=100, height=45)

        self.treeview = ttk.Treeview(show="headings")
        self.treeview.place(x=10, y=80, width=814, height=390)

        self.create_back_btn()
        self.back_btn.place_forget()

        self.treeview["columns"] = ("mode", "name", "difficulty")
        self.treeview.heading("mode", text="存档类型", anchor=tk.CENTER)
        self.treeview.heading("name", text="存档名称", anchor=tk.CENTER)
        self.treeview.heading("difficulty", text="存档难度", anchor=tk.CENTER)
        self.set_column_widths([5/22, 11/22, 5/22])
    
    def hide_all_widgets(self):
        for widget in self.winfo_children():
            if isinstance(widget, tk.Button):
                widget.place_forget()
            if isinstance(widget, ttk.Treeview):
                widget.place_forget()
            if isinstance(widget, tk.Text):
                widget.place_forget()
            if isinstance(widget, tk.Label):
                widget.place_forget()
            if isinstance(widget, tk.Entry):
                widget.place_forget()
            if isinstance(widget, ttk.Combobox):
                widget.place_forget()
            if isinstance(widget, tk.Canvas):
                widget.place_forget()
            self.background_label.place(x=0, y=0, relwidth=1, relheight=1)
    
    def show_main_widgets(self):
        self.new_btn.place(x=17, y=10, width=100, height=45)
        self.delete_btn.place(x=133, y=10, width=100, height=45)
        self.edit_btn.place(x=249, y=10, width=100, height=45)
        self.refresh_btn.place(x=365, y=10, width=100, height=45)
        self.show_folder_btn.place(x=481, y=10, width=100, height=45)
        self.more_btn.place(x=597, y=10, width=100, height=45)
        self.settings_btn.place(x=713, y=10, width=100, height=45)
        self.treeview.place(x=10, y=80, width=814, height=390)

    def set_column_widths(self, widths):
        total_width = 814
        column_widths = [int(total_width * width) for width in widths]
        for i, width in enumerate(column_widths):
            self.treeview.column(i, width=width)
    
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

    def create_settings_widgets(self):
        self.settings_entry = tk.Text(font=("SimHei", 12), wrap=tk.WORD)
        self.settings_entry.place(x=10, y=10, width=500, height=450)

        self.update_button = tk.Button(text="检查更新", width=10, height=2, font=("SimHei", 12), command=check_update)
        self.update_button.place(x=520, y=10, width=170, height=30)

        self.author_btn = tk.Button(text="作者：流浪者糕蛋", width=20, height=1, font=("SimHei", 12), command=author)
        self.author_btn.place(x=520, y=50, width=170, height=30)

        txt_path = get_resource_path("Resources/Other/ann.txt")

        if os.path.exists(txt_path):
            with open(txt_path, "r", encoding="utf-8") as file:
                content = file.read()
                self.settings_entry.delete(1.0, tk.END)
                self.settings_entry.insert(1.0, content)

        self.settings_entry.config(state='disabled')
    
    def show_settings_widgets(self):
        self.settings_entry.place(x=10, y=10, width=500, height=450)
        self.update_button.place(x=520, y=10, width=170, height=30)
        self.author_btn.place(x=520, y=50, width=170, height=30)
    
    def settings(self):
        target_item = "settings"
        if target_item in opened:
            self.hide_all_widgets()
            self.show_settings_widgets()
            self.show_back_btn()
        else:
            self.hide_all_widgets()
            self.create_settings_widgets()
            opened.append(target_item)
            self.show_back_btn()
    
    def create_back_btn(self):
        back_btn_icon = Image.open(get_resource_path("Resources/Other/Icons/back.ico"))
        back_btn_icon.thumbnail((50, 50))
        self.back_btn_photo = ImageTk.PhotoImage(back_btn_icon)

        self.back_btn = tk.Button(image=self.back_btn_photo, command=self.back)
        self.back_btn.place(x=774, y=425, width=50, height=50)
    
    def back(self):
        self.hide_all_widgets()
        self.show_main_widgets()
    
    def show_back_btn(self):
        self.back_btn.place(x=774, y=425, width=50, height=50)
    
    def delete(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要删除的存档！")
            return
        else:
            ds = messagebox.askquestion("提示", "你确定要删除此存档吗？")
            if ds == "yes":
                for item in selected_item:
                    item_values = self.treeview.item(item, "values")
                    mode, name, difficulty = item_values
                    mode = mode.replace("多人模式", "MULTIPLAYER").replace("单人模式", "SINGLEPLAYER")
                
                if mode == "SINGLEPLAYER":
                    most_similar_file = find_most_similar_save_games(mode, name)
                    parts = most_similar_file.split("_")
                    if len(parts) >= 3:
                        difficulty = parts[2].split(".")[0]
                    temp_path = os.path.join(save_games_dir, most_similar_file)
                    file_path = os.path.join(save_games_dir, most_similar_file)
                
                elif mode == "MULTIPLAYER":
                    difficulty = difficulty.replace("普通难度", "Normal").replace("简单难度", "Easy").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")

                    temp_name = f"{mode}_{name}_{difficulty}.sav"
                    temp_path = os.path.join(save_games_dir, temp_name)
                    file_path = os.path.join(save_games_dir, temp_name)

                real_difficulty = check_real_difficulty(file_path)
                real_difficulty = real_difficulty.replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")

                if os.path.exists(temp_path):
                    mode = mode.replace("SINGLEPLAYER", "单人模式").replace("MULTIPLAYER", "多人模式")
                    if mode == "多人模式":
                        difficulty = difficulty.replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
                    question = f"请确认以下信息：\n存档模式：{mode}\n存档名称：{name}\n存档难度：{difficulty}\n实际难度：{real_difficulty}"
                    if mode == "单人模式":
                        time = local_time(difficulty)
                        difficulty = "普通难度"
                        question = f"请确认以下信息：\n存档模式：{mode}\n存档名称：{name}\n存档难度：{difficulty}\n实际难度：{real_difficulty}"
                        if time != "普通难度":
                            question = question + f"\n创建时间：{time}"

                    ask = messagebox.askquestion("提示", question)
                    if ask == "yes":
                        os.remove(temp_path)
                        messagebox.showinfo("提示", "成功删除！")
                        self.refresh()
                    else:
                        return

    def refresh(self):
        self.treeview.delete(*self.treeview.get_children())
        self.populate_treeview()

    def create_new_widgets(self):
        self.name_label = tk.Label(text="请输入存档名称：", font=("SimHei", 12))
        self.name_label.place(x=10, y=10, height=30, width=170)

        self.name_entry = tk.Entry(font=("SimHei", 14))
        self.name_entry.place(x=10, y=40, height=30, width=170)

        self.ending_label = tk.Label(text="请选择结局：", font=("SimHei", 12))
        self.ending_label.place(x=10, y=90, height=30, width=170)

        self.ending_box = ttk.Combobox(values=["主结局", "结局2", "结局3", "结局4", "结局5"], font=("SimHei", 12), state="readonly")
        self.ending_box.place(x=10, y=120, height=30, width=170)
        self.ending_box.set("主结局")

        self.level_label = tk.Label(text="请选择层级：", font=("SimHei", 12))
        self.level_label.place(x=10, y=170, height=30, width=170)
        self.level_box_value = ending1_ch
        self.level_box = ttk.Combobox(values=self.level_box_value, font=("SimHei", 12), state="readonly")
        self.level_box.place(x=10, y=200, height=30, width=170)
        self.level_box.set(self.level_box_value[0])
        self.ending_box.bind("<<ComboboxSelected>>", self.switch_ending)

        self.difficulty_label = tk.Label(text="请选择难度：", font=("SimHei", 12))
        self.difficulty_label.place(x=10, y=250, height=30, width=170)

        self.difficulty_box = ttk.Combobox(values=["简单难度", "普通难度", "困难难度", "噩梦难度"], font=("SimHei", 12), state="disabled")
        self.difficulty_box.place(x=10, y=280, height=30, width=170)
        self.difficulty_box.set("普通难度")

        self.mode_label = tk.Label(text="请选择模式：", font=("SimHei", 12))
        self.mode_label.place(x=10, y=330, height=30, width=170)

        self.mode_box = ttk.Combobox(values=["单人模式", "多人模式"], font=("SimHei", 12), state="readonly")
        self.mode_box.place(x=10, y=360, height=30, width=170)
        self.mode_box.set("单人模式")

        self.mode_box.bind("<<ComboboxSelected>>", self.disable_difficulty)

        self.confirm_new_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.confirm_new) 
        self.confirm_new_btn.place(x=10, y=410, height=50, width=75)

        new_back_btn_icon = Image.open(get_resource_path("Resources/Other/Icons/back.ico"))
        new_back_btn_icon.thumbnail((50, 50))
        self.new_back_btn_photo = ImageTk.PhotoImage(new_back_btn_icon)

        self.new_back_btn = tk.Button(image=self.new_back_btn_photo, command=self.back)
        self.new_back_btn.place(x=105, y=410, width=75, height=50)

        self.white_canvas = tk.Canvas(bg="white", width=814, height=315)

        default_image_path = get_resource_path("Resources/Other/Images/Ending1/0.jpg")
        self.default_image = Image.open(default_image_path) 
        self.default_photo = ImageTk.PhotoImage(self.default_image) #

        self.image_label = tk.Label(image=self.default_photo)
        self.image_label.place(x=200, y=65)

        self.show_image()

        self.level_box.bind("<<ComboboxSelected>>", self.show_image)
    
    def show_image(self, event=None):
        selected_index = self.level_box.get()
        selected_ending_1 = self.ending_box.current()

        if selected_index == "None（请勿选择）":
            image_path = get_resource_path(f"Resources/Other/Images/None.jpg")
        else:
            selected_index = self.level_box.current()
            image_path = get_resource_path(f"Resources/Other/Images/Ending1/{selected_index}.jpg")

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

    def disable_difficulty(self, event):
        selected_mode = self.mode_box.get()
        if selected_mode == "多人模式":
            self.difficulty_box.config(state="readonly")
        elif selected_mode == "单人模式":
            self.difficulty_box.config(state="disabled")
            self.difficulty_box.set("普通难度")

    def switch_ending(self, event):
        selected_ending = self.ending_box.get()
        if selected_ending == "主结局":
            self.level_box_value = ending1_ch
        elif selected_ending == "结局2":
            self.level_box_value = ending2_ch
        elif selected_ending == "结局3":
            self.level_box_value = ending3_ch
        elif selected_ending == "结局4":
            self.level_box_value = ending4_ch
        elif selected_ending == "结局5":
            self.level_box_value = ending5_ch
        self.level_box.config(values=self.level_box_value)
        self.level_box.set(self.level_box_value[0])
        self.show_image()

    def new(self):
        target_item = "new"
        if target_item in opened:
            self.hide_all_widgets()
            self.show_new_widgets()
        else:
            self.hide_all_widgets()
            self.create_new_widgets()
            opened.append(target_item)
    
    def show_new_widgets(self):
        self.name_label.place(x=10, y=10, height=30, width=170)
        self.name_entry.place(x=10, y=40, height=30, width=170)
        self.name_entry.delete(0, "end")

        self.ending_label.place(x=10, y=90, height=30, width=170)
        self.ending_box.place(x=10, y=120, height=30, width=170)
        self.ending_box.set("主结局")

        self.level_label.place(x=10, y=170, height=30, width=170)
        self.level_box.place(x=10, y=200, height=30, width=170)
        self.level_box.set("Level 0教学关卡")

        self.difficulty_label.place(x=10, y=250, height=30, width=170)
        self.difficulty_box.place(x=10, y=280, height=30, width=170)
        self.difficulty_box.set("普通难度")
        self.difficulty_box.config(state="disabled")

        self.mode_label.place(x=10, y=330, height=30, width=170)
        self.mode_box.place(x=10, y=360, height=30, width=170)
        self.mode_box.set("单人模式")

        self.confirm_new_btn.place(x=10, y=410, height=50, width=75)
        self.new_back_btn.place(x=105, y=410, width=75, height=50)

        self.image_label.place(x=200, y=65)

        self.show_image()

    def confirm_new(self):
        global mapped_value, new_filepath, new_filename
        new_name = self.name_entry.get().strip()
        if not new_name:
            messagebox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            messagebox.showerror("错误", "仅限英文字母及数字")
            return
        
        mode = self.mode_box.get()
        mode = mode.replace("多人模式", "MULTIPLAYER").replace("单人模式", "SINGLEPLAYER")
        difficulty = self.difficulty_box.get()
        name = self.name_entry.get()
        level = self.level_box.get()
        ending = self.ending_box.current()

        if level == "None（请勿选择）":
            messagebox.showerror("错误", "请勿选择此选项！")
        else:
            level = str(self.level_box.current())
            ending = "ending"+str(ending+1)+"_mapping"
            ending_a = []

            if ending == "ending1_mapping":
                mapped_value = ending1_mapping[level]
                ending_a = ending1_mapping
            elif ending == "ending2_mapping":
                mapped_value = ending2_mapping[level]
                ending_a = ending2_mapping
            elif ending == "ending3_mapping":
                mapped_value = ending3_mapping[level]
                ending_a = ending3_mapping
            elif ending == "ending4_mapping":
                mapped_value = ending4_mapping[level]
                ending_a = ending4_mapping
            elif ending == "ending5_mapping":
                mapped_value = ending5_mapping[level]
                ending_a = ending5_mapping

            if mode == "SINGLEPLAYER":
                if level in ending_a:
                    global old_filename
                    timestamp = get_time_stamp()
                    old_filename = get_resource_path(f"Resources/SaveGames/E1/{mapped_value}.sav")
                    new_filename = f"SINGLEPLAYER_{name}_{timestamp}.sav"
                    new_filepath = os.path.join(save_games_dir, new_filename)
            elif mode == "MULTIPLAYER":
                if level in ending_a:
                    difficulty = difficulty.replace("普通难度", "Normal").replace("简单难度", "Easy").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")
                    old_filename, new_filepath, file_path, search_hex, replace_hex = new_edit_difficulty(name, mapped_value, difficulty)
            
            try:
                difficulty = difficulty.replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
                shutil.copy(old_filename, new_filepath)
                if mode == "MULTIPLAYER":
                    find_and_replace_in_hex(file_path, search_hex, replace_hex)
                if mode == "SINGLEPLAYER":
                    now = local_time(str(timestamp))
                    messagebox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"单人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"时间戳："+f"{timestamp}"+"\n"+"时间："+f"{now}")
                elif mode == "MULTIPLAYER":
                    if difficulty == "噩梦难度":
                        messagebox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"多人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"存档难度"+f": {difficulty}"+"\n(需要找到显示困难难度的存档)")
                    else:
                        messagebox.showinfo("提示", "成功创建存档！"+"\n"+"存档类型"+": "+"多人模式"+"\n"+"存档名称"+f": {name}"+"\n"+"存档难度"+f": {difficulty}")
            except Exception as e:
                messagebox.showerror("错误", "创建存档错误："+f" {str(e)}")
            
            self.back()
            self.refresh()

    def create_edit_widgets(self):
        self.edit_name_label = tk.Label(text="请输入新的存档名称\n仅限英文字母及数字\n改不了代表名称重复", font=("SimHei", 12))
        self.edit_name_label.place(x=200, y=130, width=200, height=70)

        self.edit_mode_label = tk.Label(text="请选择新的模式", font=("SimHei", 12))
        self.edit_mode_label.place(x=430, y=130, width=200, height=30)

        self.input = tk.Entry(font=("SimHei", 12))
        self.input.place(x=200, y=230, width=200, height=30)

        self.edit_new_mode = ttk.Combobox(values=["多人模式", "单人模式"], font=("SimHei", 12), state="readonly")
        self.edit_new_mode.place(x=430, y=160, width=200, height=30)
        self.edit_new_mode.bind("<<ComboboxSelected>>", self.switch_edit_difficulty)

        self.edit_difficult_label = tk.Label(text="请选择新的难度", font=("SimHei", 12))
        self.edit_difficult_label.place(x=430, y=200, width=200, height=30)

        self.edit_difficult_mode = ttk.Combobox(values=["简单难度", "普通难度", "困难难度", "噩梦难度"], font=("SimHei", 12), state="readonly")
        self.edit_difficult_mode.place(x=430, y=230, width=200, height=30)

        self.confirm_edit_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.edit_save_game)
        self.confirm_edit_btn.place(x=317, y=280, width=200, height=30)

    def show_edit_widgets(self):
        selected_item = self.treeview.selection()[0]
        item_values = self.treeview.item(selected_item, "values")
        mode = item_values[0]
        name = item_values[1]
        difficulty = item_values[2]
        self.show_back_btn()
        self.edit_name_label.place(x=200, y=130, width=200, height=70)
        self.input.place(x=200, y=230, width=200, height=30)
        self.confirm_edit_btn.place(x=317, y=280, width=200, height=30)
        self.edit_mode_label.place(x=430, y=130, width=200, height=30)
        self.edit_new_mode.place(x=430, y=160, width=200, height=30)
        self.edit_difficult_label.place(x=430, y=200, width=200, height=30)
        self.edit_difficult_mode.place(x=430, y=230, width=200, height=30)
        self.edit_new_mode.set(mode)
        self.edit_difficult_mode.set(difficulty)
        self.input.delete(0, tk.END)
        self.input.insert(0, name)
    
    def switch_edit_difficulty(self, event):
        new_mode = self.edit_new_mode.get()
        new_mode = new_mode.replace("单人模式", "SINGLEPLAYER").replace("多人模式", "MULTIPLAYER")
        if new_mode == "SINGLEPLAYER":
            self.edit_difficult_mode.set("普通模式")
            self.edit_difficult_mode.config(state="disabled")
        elif new_mode == "MULTIPLAYER":
            self.edit_difficult_mode.config(state="readonly")
    
    def edit_save_game(self):
        new_name =  self.input.get().strip()
        new_mode = self.edit_new_mode.get()
        new_mode = new_mode.replace("单人模式", "SINGLEPLAYER").replace("多人模式", "MULTIPLAYER")
        new_difficulty = self.edit_difficult_mode.get()
        new_difficulty = new_difficulty.replace("简单难度", "Easy").replace("普通难度", "Normal").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")
        selected_item = self.treeview.selection()[0]
        item_values = self.treeview.item(selected_item, "values")
        old_mode = item_values[0]
        old_mode = old_mode.replace("单人模式", "SINGLEPLAYER").replace("多人模式", "MULTIPLAYER")
        old_name = item_values[1]
        old_difficulty = item_values[2]
        old_difficulty = old_difficulty.replace("简单难度", "Easy").replace("普通难度", "Normal").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")

        if not new_name:
            messagebox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            messagebox.showerror("错误", "仅限英文字母及数字")
            return

        if old_mode == "SINGLEPLAYER":
            most_similar_file = find_most_similar_save_games(old_mode, old_name)
            parts = most_similar_file.split("_")
            old_difficulty = parts[2].split(".")[0]
            old_name = f"{old_mode}_{old_name}_{old_difficulty}.sav"

            if new_mode == "SINGLEPLAYER":
                new_difficulty = old_difficulty
                new_name = f"{new_mode}_{new_name}_{new_difficulty}.sav"
                old_name_path = os.path.join(save_games_dir, old_name)
                new_name_path = os.path.join(save_games_dir, new_name)
            elif new_mode == "MULTIPLAYER":
                file_path = os.path.join(save_games_dir, most_similar_file)
                real_difficulty = check_real_difficulty(file_path)
                search_hex, replace_hex = edit_edit_difficulty(new_difficulty, real_difficulty)
                new_name = f"{new_mode}_{new_name}_{new_difficulty}.sav"
                old_name_path = os.path.join(save_games_dir, old_name)
                
                find_and_replace_in_hex(old_name_path, search_hex, replace_hex)

                new_name_path = os.path.join(save_games_dir, new_name)
        elif old_mode == "MULTIPLAYER":
            old_name = f"{old_mode}_{old_name}_{old_difficulty}.sav"

            if new_mode == "SINGLEPLAYER":
                new_difficulty = get_time_stamp()
                new_name = f"{new_mode}_{new_name}_{new_difficulty}.sav"
                old_name_path = os.path.join(save_games_dir, old_name)
                new_name_path = os.path.join(save_games_dir, new_name)
            elif new_mode == "MULTIPLAYER":
                file_path = os.path.join(save_games_dir, old_name)
                real_difficulty = check_real_difficulty(file_path)
                search_hex, replace_hex = edit_edit_difficulty(new_difficulty, real_difficulty)
                new_name = f"{new_mode}_{new_name}_{new_difficulty}.sav"
                old_name_path = os.path.join(save_games_dir, old_name)

                find_and_replace_in_hex(old_name_path, search_hex, replace_hex)

                new_name_path = os.path.join(save_games_dir, new_name)
        
        if os.path.exists(old_name_path):
            os.rename(old_name_path, new_name_path)
            self.refresh()
            messagebox.showinfo("提示", "存档名称已经修改完成，修改后的名称为："+f"\n{new_name}")
            self.hide_all_widgets()
            self.show_main_widgets()
        else:
            messagebox.showerror("错误", "未成功修改"+f"\n{old_name}")
            self.hide_all_widgets()
            self.show_main_widgets()

    def edit(self):
        target_item = "edit"
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要编辑的存档！")
            return
        if target_item in opened:
            self.hide_all_widgets()
            self.show_edit_widgets()
        else:
            self.create_edit_widgets()
            self.hide_all_widgets()
            self.show_edit_widgets()
            opened.append(target_item)

    def create_more_widgets(self):
        self.hide_btn = tk.Button(text="隐藏", font=("SimHei", 12), command=self.hide) 
        self.hide_btn.place(x=10, y=10, height=44, width=98)

        self.detail_btn = tk.Button(text="详细信息", font=("SimHei", 12), command=self.detail_1) 
        self.detail_btn.place(x=80, y=10, height=44, width=98)
    
    def show_more_widgets(self):
        self.hide_all_widgets()
        self.hide_btn.place(x=10, y=10, height=44, width=98)
        self.back_btn.place(x=774, y=430, width=50, height=50)
        self.back_btn.config(command=self.back)
        self.detail_btn.place(x=120, y=10, height=44, width=98)

    def more(self):
        target_item = "more"
        if target_item in opened:
            self.hide_all_widgets()
            self.show_more_widgets()
        else:
            self.create_more_widgets()
            self.hide_all_widgets()
            self.show_more_widgets()
            opened.append(target_item)
        
    def create_hide_widgets(self):
        self.hide_ok_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.hide_file) 
        self.hide_ok_btn.place(x=10, y=10, height=44, width=98)

    def show_hide_widgets(self):
        self.hide_all_widgets()
        self.treeview.place(x=10, y=80, width=814, height=390)
        self.back_btn.place(x=774, y=10, width=50, height=50)
        self.back_btn.config(command=self.show_more_widgets)
        self.hide_ok_btn.place(x=10, y=10, height=44, width=98)

    def hide_file(self):
        hidden_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames", "HiddenFiles")

        if not os.path.exists(hidden_dir):
            try:
                os.makedirs(hidden_dir)
            except OSError as e:
                messagebox.showerror("错误", "发生错误"+f": {e}")

        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要隐藏的存档！")
            return
        
        for item in selected_item:
            item_values = self.treeview.item(item, "values")
            mode, name, difficulty = item_values
            mode = mode.replace("单人模式", "SINGLEPLAYER").replace("多人模式", "MULTIPLAYER")
            difficulty = difficulty.replace("普通难度", "Normal").replace("简单难度", "Easy").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")

            if mode == "SINGLEPLAYER":
                most_similar_file = find_most_similar_save_games(mode, name)
                temp_path = os.path.join(save_games_dir, most_similar_file)
            elif mode == "MULTIPLAYER":
                temp = f"{mode}_{name}_{difficulty}.sav"
                temp_path = os.path.join(save_games_dir, temp)
            
            try:
                shutil.move(temp_path, hidden_dir)
                messagebox.showinfo("提示", "存档"+f'"{temp}"'+"已隐藏\n请前往存档文件夹下的HiddenFiles文件夹查看")
            except FileNotFoundError:
                messagebox.showerror("错误", "存档"+f'"{temp}"'+"未找到！")
            except PermissionError:
                messagebox.showerror("错误", "无权限！")
            except Exception as e:
                messagebox.showerror("错误", "发生错误"+f": {e}")
            self.refresh()

    def hide(self):
        target_item = "hide"
        if target_item in opened:
            self.hide_all_widgets()
            self.show_hide_widgets()
        else:
            self.create_hide_widgets()
            self.hide_all_widgets()
            self.show_hide_widgets()
            opened.append(target_item)

    def create_detail_1_widgets(self):
        self.detail_ok_btn = tk.Button(text="确定", font=("SimHei", 12), command=self.detail_2) 
        self.detail_ok_btn.place(x=10, y=10, height=44, width=98)

    def show_detail_1_widgets(self):
        self.hide_all_widgets()
        self.treeview.place(x=10, y=80, width=814, height=390)
        self.back_btn.place(x=774, y=10, width=50, height=50)
        self.back_btn.config(command=self.show_more_widgets)
        self.detail_ok_btn.place(x=10, y=10, height=44, width=98)
    
    def create_detail_2_widgets(self):
        detail_text = "a"
        self.detail_label = tk.Label(text=f"{detail_text}", font=("SimHei", 12))
        self.detail_label.place(x=317, y=192, height=100, width=200)
    
    def show_detail_2_widgets(self, text):
        self.hide_all_widgets()
        self.show_back_btn()
        self.back_btn.config(command=self.show_detail_1_widgets)
        self.detail_label.place(x=317, y=192, height=100, width=200)
        detail_text = text
        self.detail_label.config(text=f"{detail_text}")
    
    def detail(self):
        self.show_back_btn()

        selected_item = self.treeview.selection()
        
        for item in selected_item:
            item_values = self.treeview.item(item, "values")
            mode, name, difficulty = item_values
            mode = mode.replace("多人模式", "MULTIPLAYER").replace("单人模式", "SINGLEPLAYER")
            difficulty = difficulty.replace("普通难度", "Normal").replace("简单难度", "Easy").replace("困难难度", "Hard").replace("噩梦难度", "Nightmare")
        
        if mode == "MULTIPLAYER":
            filename = f"{mode}_{name}_{difficulty}.sav"
        elif mode == "SINGLEPLAYER":
            filename = find_most_similar_save_games(mode, name)
        file_path = os.path.join(save_games_dir, filename)
        found_segment = check_real_difficulty(file_path)
        found_segment = found_segment.replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
        mode = mode.replace("MULTIPLAYER", "多人模式").replace("SINGLEPLAYER", "单人模式")
        difficulty = difficulty.replace("Normal", "普通难度").replace("Easy", "简单难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")

        text = f"存档类型：{mode}\n存档名称：{name}\n存档难度：{difficulty}\n实际难度：{found_segment}"
        self.show_detail_2_widgets(text)

    def create_detail_widgets(self):
        self.create_detail_1_widgets()
        self.create_detail_2_widgets()
    
    def detail_1(self):
        target_item = "detail"
        if target_item in opened:
            self.hide_all_widgets()
            self.show_detail_1_widgets()
        else:
            self.create_detail_widgets()
            self.hide_all_widgets()
            self.show_detail_1_widgets()
            opened.append(target_item)

    def detail_2(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要查看详细信息的存档！")
            return
        
        self.hide_all_widgets()
        self.detail()

if __name__ == "__main__":
    app = Window()
    app.mainloop()