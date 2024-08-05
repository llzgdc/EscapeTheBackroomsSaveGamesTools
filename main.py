import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import os
import sys
import webbrowser
import re
import shutil
from datetime import datetime
import pytz
import Levenshtein

#版本号
VERSION = "V2.1.1"

#返回文件绝对路径
def get_resource_path(relative_path):
    # 返回资源文件的绝对路径，适用于打包和未打包的情况。
    try:
        # PyInstaller创建的临时文件夹，用于单文件打包
        base_path = sys._MEIPASS
    except AttributeError:
        # 如果不是通过PyInstaller打包，使用当前文件的目录作为基路径
        base_path = os.path.dirname(os.path.abspath(__file__))

    # 构建并返回资源文件的绝对路径
    return os.path.join(base_path, relative_path)

#主线层级映射
zx_mapping = {
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


class ESGP_Saves_Tools:
    def bilibili(self):
        webbrowser.open_new("https://space.bilibili.com/2019959464")

    def check_update(self):
        webbrowser.open_new("https://docs.qq.com/doc/DTHNKSEx1d3lFemlC")

    def playgame(self):
        webbrowser.open("steam://rungameid/1943950")

    def get_command(self, text):
            commands = {
                "新建": self.create_file,
                "删除": self.delete_file,
                "编辑": self.edit_file,
                "隐藏": self.hide_file,
                "刷新": self.refresh_files,
                "显示文件夹": self.show_archive_folder,
                "设置": self.open_settings,
            }
            return commands.get(text, None)

    def hide_file(self):
        hiddendir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames", "HiddenFiles")
        if not os.path.exists(hiddendir):
            try:
                os.makedirs(hiddendir)
            except OSError as e:
                pass
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要隐藏的存档！")
            return
        for item in selected_item:
            item_values = self.treeview.item(item, "values")
            dtype, dname, ddiff = item_values
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

            if dtype == "单人模式":
                dtype = "SINGLEPLAYER_"
                dsname = f"{dtype}{dname}"
                # 获取目录下所有文件名
                file_names = os.listdir(save_games_dir)

                # 初始化最小编辑距离和最相似文件
                min_distance = float('inf')
                most_similar_file = None

                # 遍历文件名列表
                for file_name in file_names:
                    # 检查文件名是否以"SINGLEPLAYER_"开头
                    if file_name.startswith(dsname):
                        # 计算编辑距离
                        distance = Levenshtein.distance(dsname, file_name)
                        # 更新最小编辑距离和最相似文件名
                        if distance < min_distance:
                            min_distance = distance
                            most_similar_file = file_name
                dsname_path = os.path.join(save_games_dir, most_similar_file)
            elif dtype == "多人模式":
                dtype = "MULTIPLAYER_"
                if ddiff == "普通难度":
                    ddiff = "_Normal"
                elif ddiff == "简单难度":
                    ddiff = "_Easy"
                elif ddiff == "困难难度":
                    ddiff = "_Hard"
                elif ddiff == "噩梦难度":
                    ddiff = "_Nightmare"

                dsname = f"{dtype}{dname}{ddiff}.sav"
                dsname_path = os.path.join(save_games_dir, dsname)
            try:
                shutil.move(dsname_path, hiddendir)
                messagebox.showinfo("提示", f"存档{dsname}已隐藏\n请前往存档文件夹下的HiddenFiles文件夹查看")
            except FileNotFoundError:
                messagebox.showerror("提示", f"存档{dsname}未找到")
            except PermissionError:
                messagebox.showerror("提示", f"无权限")
            except Exception as e:
                messagebox.showerror("提示", f"发生错误：{e}")
            self.refresh_files()

    def populate_treeview(self):
        # 读取存档文件夹中的所有文件
        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        if not os.path.exists(save_games_dir):
            return

        # 获取所有存档文件名
        old_saves = os.listdir(save_games_dir)

        # 处理存档文件名
        valid_saves = []
        for file_name in old_saves:
            if file_name.startswith("MULTIPLAYER_") or file_name.startswith("SINGLEPLAYER_"):
                valid_saves.append(file_name)

        # 插入数据到Treeview
        for i, file_name in enumerate(valid_saves, start=1):
            type_, name, difficulty = self.parse_file_name(file_name)
            if type_ and name and difficulty:  # 确保所有数据都存在
                self.treeview.insert("", "end", text=str(i), values=(type_, name, difficulty))

    def parse_file_name(self, file_name):
        parts = file_name.split("_")
        if len(parts) >= 3:  # 确保至少有三部分
            type_ = parts[0].replace("MULTIPLAYER", "多人模式").replace("SINGLEPLAYER", "单人模式")
            name = parts[1]
            difficulty = parts[2].split(".")[0].replace("NORMAL", "普通难度").replace("Normal", "普通难度").replace("EASY", "简单难度").replace("Easy", "简单难度").replace("HARD", "困难难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
            if file_name.startswith("SINGLEPLAYER_"):
                    difficulty = "普通难度"
            return type_, name, difficulty
        return None, None, None
        
    def refresh_files(self):
        # 清空 Treeview 中的所有数据
        self.treeview.delete(*self.treeview.get_children())
        # 重新填充 Treeview
        self.populate_treeview()

    def show_archive_folder(self):
        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        if os.path.exists(save_games_dir):
            os.startfile(save_games_dir)

    def back_button_clicked(self):
        # 切换回主界面
        self.hide_settings_ui()
        self.hide_edit_ui()
        self.hide_create_file_widgets
        self.show_main_ui()

        # 重置按钮状态
        for button in self.buttons:
            button.config(state="normal")

    def create_settings_ui(self):
        # 创建输入框
        self.settings_entry = tk.Text(self.master, font=("SimHei", 12), wrap=tk.WORD)
        self.settings_entry.place(x=10, y=10, width=500, height=400)

        # 创建“检查更新”按钮
        self.update_button = tk.Button(self.master, text="检查更新", width=10, height=2, font=("SimHei", 12), command=self.check_update)
        self.update_button.place(x=520, y=10, width=100, height=30)

        # 创建图标按钮
        back_icon_image = Image.open(get_resource_path("Others/back.ico"))
        back_icon_image.thumbnail((50, 50))  # 调整图标大小
        self.back_icon_photo = ImageTk.PhotoImage(back_icon_image)

        self.back_button = tk.Button(self.master, image=self.back_icon_photo, command=self.back_button_clicked)
        self.back_button.place(x=700, y=350, width=50, height=50)

        self.bilibili1 = tk.Button(self.master, text="作者：流浪者糕蛋", width=20, height=1, font=("SimHei", 12), command=self.bilibili)
        self.bilibili1.pack(pady=20)
        self.bilibili1.place(x=520, y=50)

        #self.label.bind("<Button-1>", self.bilibili)

        # 隐藏设置界面控件
        self.hide_settings_ui()

    def show_settings_ui(self):
        self.settings_entry.place(x=10, y=10, width=500, height=400)
        self.update_button.place(x=520, y=10, width=100, height=30)
        self.back_button.place(x=700, y=350, width=50, height=50)
        self.bilibili1.place(x=520, y=50)

        # 读取并显示 a.txt 内容
        a_txt_path = get_resource_path("Others/a.txt")
        if os.path.exists(a_txt_path):
            with open(a_txt_path, "r", encoding="utf-8") as file:
                content = file.read()
                self.settings_entry.delete(1.0, tk.END)  # 清空输入框内容
                self.settings_entry.insert(1.0, content)  # 插入文件内容

        self.settings_entry.config(state='disabled')  # 设置输入框为禁用
        
    def open_settings(self):
        self.hide_main_ui()
        self.show_settings_ui()

    def hide_settings_ui(self):
        self.settings_entry.place_forget()
        self.update_button.place_forget()
        self.back_button.place_forget()
        self.bilibili1.place_forget()
        
    def create_edit_ui(self):
        # 创建标签
        self.edit_label = tk.Label(self.master, text="请输入新的存档名称\n(仅限英文字母与数字)\n改不了名代表重复了", font=("SimHei", 12))
        self.edit_label.place(x=300, y=130, anchor="center")

        # 创建输入框
        self.edit_entry = tk.Entry(self.master, font=("SimHei", 12))
        self.edit_entry.place(x=200, y=200, width=400, height=30)

        # 创建确定按钮
        self.edit_confirm_button = tk.Button(self.master, text="确定", width=10, height=2, font=("SimHei", 12), command=self.confirm_edit)
        self.edit_confirm_button.place(x=360, y=250, width=100, height=30)

        # 创建图标按钮
        back_icon_image = Image.open(get_resource_path("Others/back.ico"))
        back_icon_image.thumbnail((50, 50))  # 调整图标大小
        self.back_icon_photo = ImageTk.PhotoImage(back_icon_image)

        self.back_button = tk.Button(self.master, image=self.back_icon_photo, command=self.back_button_clicked)
        self.back_button.place(x=700, y=350, width=50, height=50)
        
        # 隐藏编辑界面控件
        self.hide_edit_ui()

    def edit_file(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要编辑的存档！")
            return
        self.hide_main_ui()
        self.show_edit_ui()

    def confirm_edit(self):
        new_name = self.edit_entry.get().strip()
        if not new_name:
            messagebox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            messagebox.showerror("错误", "存档名称只能包含英文字母或数字！")
            return

        selected_item = self.treeview.selection()[0]
        item_values = self.treeview.item(selected_item, "values")
        dtype = item_values[0]
        dname = item_values[1]
        ddiff = item_values[2]

        if dtype == "单人模式":
                dtype = "SINGLEPLAYER_"
                dsname = f"{dtype}{dname}"
                save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
                # 获取目录下所有文件名
                file_names = os.listdir(save_games_dir)

                # 初始化最小编辑距离和最相似文件
                min_distance = float('inf')
                most_similar_file = None

                # 遍历文件名列表
                for file_name in file_names:
                    # 检查文件名是否以"SINGLEPLAYER_"开头
                    if file_name.startswith(dsname):
                        # 计算编辑距离
                        distance = Levenshtein.distance(dsname, file_name)
                        # 更新最小编辑距离和最相似文件名
                        if distance < min_distance:
                            min_distance = distance
                            most_similar_file = file_name
                parts = most_similar_file.split("_")
                ddiff = parts[2].split(".")[0].replace("NORMAL", "普通难度").replace("Normal", "普通难度").replace("EASY", "简单难度").replace("Easy", "简单难度").replace("HARD", "困难难度").replace("Hard", "困难难度").replace("Nightmare", "噩梦难度")
                old_dsname = f"{dtype}{dname}_{ddiff}.sav"
                new_dsname = f"{dtype}{new_name}_{ddiff}.sav"
                save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
                old_dsname_path = os.path.join(save_games_dir, old_dsname)
                new_dsname_path = os.path.join(save_games_dir, new_dsname)

                if os.path.exists(old_dsname_path):
                    os.rename(old_dsname_path, new_dsname_path)
                    # 清空 Treeview 中的所有数据
                    self.treeview.delete(*self.treeview.get_children())
                    # 重新填充 Treeview
                    self.populate_treeview()
                    messagebox.showinfo("提示", f"存档名称已经修改完成，修改后的名称为 {new_name}")
                else:
                    messagebox.showerror("错误", f"未成功修改 {old_dsname}")


        elif dtype == "多人模式":
            dtype = "MULTIPLAYER_"

            if ddiff == "普通难度":
                ddiff = "_Normal"
            elif ddiff == "简单难度":
                ddiff = "_Easy"
            elif ddiff == "困难难度":
                ddiff = "_Hard"
            elif ddiff == "噩梦难度":
                ddiff == "_Nightmare"

            old_dsname = f"{dtype}{dname}{ddiff}.sav"
            new_dsname = f"{dtype}{new_name}{ddiff}.sav"
            save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
            old_dsname_path = os.path.join(save_games_dir, old_dsname)
            new_dsname_path = os.path.join(save_games_dir, new_dsname)

            if os.path.exists(old_dsname_path):
                os.rename(old_dsname_path, new_dsname_path)
                # 清空 Treeview 中的所有数据
                self.treeview.delete(*self.treeview.get_children())
                # 重新填充 Treeview
                self.populate_treeview()
                messagebox.showinfo("提示", f"存档名称已经修改完成，修改后的名称为 {new_name}")
            else:
                messagebox.showerror("错误", f"未成功修改 {old_dsname}")

        self.hide_edit_ui()
        self.show_main_ui()

    def show_edit_ui(self):
        self.edit_label.place(x=300, y=150)
        self.edit_entry.place(x=200, y=200, width=400, height=30)
        self.edit_confirm_button.place(x=360, y=250, width=100, height=30)
        self.back_button.place(x=700, y=350, width=50, height=50)

    def hide_edit_ui(self):
        self.edit_label.place_forget()
        self.edit_entry.place_forget()
        self.edit_confirm_button.place_forget()
        self.back_button.place_forget()
        
    def show_main_ui(self):
        for button in self.buttons:
            button.place(x=button.winfo_x(), y=button.winfo_y())
        self.treeview.place(x=15, y=70, width=740, height=340)

    def hide_main_ui(self):
        for button in self.buttons:
            button.place_forget()
        self.treeview.place_forget()
        
    def set_column_widths(self, widths):
        total_width = 740
        column_widths = [int(total_width * width) for width in widths]
        for i, width in enumerate(column_widths):
            self.treeview.column(i, width=width)
        
    def create_file(self):
        self.hide_main_ui()

        # 创建新建界面的控件
        # 创建标签
        self.label_name = tk.Label(self.master, text="请输入存档名称：", font=("SimHei", 12))
        self.label_name.place(x=10, y=10)

        # 创建输入框
        self.entry_name = tk.Entry(self.master, font=("SimHei", 12))
        self.entry_name.place(x=10, y=40, width=150)

        # 创建标签
        self.label_route = tk.Label(self.master, text=
        "请选择线路剧情：", font=("SimHei", 12))
        self.label_route.place(x=10, y=80)
        # 创建下拉框1
        self.combo_route = ttk.Combobox(self.master, values=["主线", "结局2", "结局3", "结局4", "结局5"], font=("SimHei", 12), state="readonly")
        self.combo_route.current(0)  # 锁定选项为"主线"
        self.combo_route.place(x=10, y=110, width=150)

        # 创建标签
        self.label_level = tk.Label(self.master, text="请选择层级：", font=("SimHei", 12))
        self.label_level.place(x=10, y=150)
        # 创建下拉框2
        self.combo_level = ttk.Combobox(self.master, values=[
            "Level 0教学关卡", "Level 1宜居地带(1)", "Level 1宜居地带(2)", "Level 1宜居地带(3)", "Level 1宜居地带(4)", "The Hub枢纽", 
            "Level 2废弃公共带(1)", "Level 3发电站", "Level 4废弃办公室", "Level 5恐怖旅馆(1)", "Level 5恐怖旅馆(2)", "Level 5恐怖旅馆(3)", "Level 2废弃公共带(2)", "Level Fun享乐层", 
            "Level 37崇高", "Level !", "The End终末", "Level 922……无尽的结局", "Level 94动画(1)", "Level 94动画(2)", "Level 6熄灯", 
            "Level 7深海恐惧症", "Level 8岩洞系统", "Level 0.11腐烂的前厅", "Level 9郊区(1)", "Level 9郊区(2)", "Level 10丰裕", "Level 3999真正的结局", 
            "Level 0.2重塑的混乱", "Level 6.1零食室", "Level !-!灵魂终末", "Level 188百叶庭", "Level 37.2暗池(1)", "Level 37.2暗池(2)","Level 37.2暗池(3)", "Level 37.2暗池(4)", "Level FUN+(1)",  "Level FUN+(2)", "Level FUN+(3)", "Level FUN+(4)", "Level FUN+(5)","Level 52学校大厅", 
            "Level 55.1隧道"
            ], font=("SimHei", 12), state="readonly")
        self.combo_level.current(0)
        self.combo_level.place(x=10, y=180, width=150)

        # 创建单选框
        self.difficulty_var = tk.StringVar()
        self.difficulty_var.set("普通难度")

        self.radio_simple = tk.Radiobutton(self.master, text="简单难度", variable=self.difficulty_var, value="简单难度", font=("SimHei", 12))
        self.radio_simple.place(x=10, y=220)
        self.radio_normal = tk.Radiobutton(self.master, text="普通难度", variable=self.difficulty_var, value="普通难度", font=("SimHei", 12))
        self.radio_normal.place(x=10, y=250)
        self.radio_hard = tk.Radiobutton(self.master, text="困难难度", variable=self.difficulty_var, value="困难难度", font=("SimHei", 12))
        self.radio_hard.place(x=10, y=280)

        # 创建“单人模式”和“多人模式”单选框
        self.mode_var = tk.StringVar()
        self.mode_var.set("单人模式")

        self.radio_single = tk.Radiobutton(self.master, text="单人模式", variable=self.mode_var, value="单人模式", font=("SimHei", 12))
        self.radio_single.place(x=10, y=310)
        self.radio_multi = tk.Radiobutton(self.master, text="多人模式", variable=self.mode_var, value="多人模式", font=("SimHei", 12))
        self.radio_multi.place(x=10, y=340)

        # 创建确定按钮
        self.confirm_button = tk.Button(self.master, text="确定", width=10, height=2, font=("SimHei", 12), command=self.confirm_create_file)
        self.confirm_button.place(x=10, y=380)


        # 创建返回按钮
        self.back_button = tk.Button(self.master, text="返回", width=10, height=2, font=("SimHei", 12), command=self.return_to_main)
        self.back_button.place(x=120, y=380)

        # 创建纯白色方形
        self.white_canvas = tk.Canvas(self.master, bg="white", width=580, height=410)
        #self.white_canvas.place(x=183, y=10)

        # 绑定下拉框事件，显示对应图片
        # 加载默认图片
        default_image_path = get_resource_path("Others/0.jpg")
        self.default_image = Image.open(default_image_path) 
        self.default_photo = ImageTk.PhotoImage(self.default_image) #
        

        # 创建显示图片的标签
        self.image_label = tk.Label(self.master, image=self.default_photo)
        self.image_label.place(x=183, y=30)

        self.show_image()

        self.combo_level.bind("<<ComboboxSelected>>", self.show_image)

    def show_image(self, event=None):
        selected_index = self.combo_level.current()
        image_path = get_resource_path(f"Others/{selected_index}.jpg")
        self.show_image_on_canvas(image_path)

    def show_image_on_canvas(self, image_path):
        # 清空画布
        self.white_canvas.delete("all")
        
        # 加载并缩放图片
        image = Image.open(image_path)
        image.thumbnail((560, 390))  # 缩放图片以适应画布
        self.image_on_canvas = ImageTk.PhotoImage(image)

        # 计算图片在画布上的位置使其居中显示
        canvas_width = 580
        canvas_height = 410
        image_width = image.width
        image_height = image.height

        x_offset = (canvas_width - image_width) // 2
        y_offset = (canvas_height - image_height) // 2


        self.white_canvas.create_image(x_offset, y_offset, anchor="nw", image=self.image_on_canvas)

        # 更新图片标签的配置
        self.image_label.configure(image=self.image_on_canvas)

    def hide_create_file_widgets(self):
        # 隐藏除主界面以外所有的控件（屎山）
        self.label_name.place_forget()
        self.entry_name.place_forget()
        self.label_route.place_forget()
        self.combo_route.place_forget()
        self.label_level.place_forget()
        self.combo_level.place_forget()
        self.radio_simple.place_forget()
        self.radio_normal.place_forget()
        self.radio_hard.place_forget()
        self.radio_single.place_forget()
        self.radio_multi.place_forget()
        self.confirm_button.place_forget()
        self.back_button.place_forget()
        self.white_canvas.place_forget()
        self.image_label.place_forget()
        self.settings_entry.place_forget()
        self.update_button.place_forget()
        self.back_button.place_forget()
        self.edit_label.place_forget()
        self.edit_entry.place_forget()
        self.edit_confirm_button.place_forget()
        self.back_button.place_forget()
        self.bilibili1.place_forget()
        
    def return_to_main(self):
        # 隐藏新建界面的控件
        self.hide_create_file_widgets()

        #显示主界面的控件
        self.show_main_ui()
        
    def confirm_create_file(self):
        new_name = self.entry_name.get().strip()
        if not new_name:
            messagebox.showinfo("提示", "存档名称不能为空！")
            return

        if not re.match("^[A-Za-z0-9]+$", new_name):
            messagebox.showerror("错误", "存档名称只能包含英文字母或数字！")
            return

        save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")
        mode = self.mode_var.get()
        difficulty = self.difficulty_var.get()
        level = self.combo_level.current()
        level = str(level)
        name = self.entry_name.get()
        if mode == "单人模式":
            if level in zx_mapping:
                # 获取当前时间的 datetime 对象
                now = datetime.now()
                # 获取当前时区
                local_timezone = pytz.timezone('Africa/Abidjan') # 实测游戏识别时区为Africa/Abidjan
                now_local = local_timezone.localize(now)
                # 转换为 UTC 时间
                now_utc = now_local.astimezone(pytz.utc)
                # 获取时间戳
                timestamp = int(now_utc.timestamp())
                # 获取映射值
                mapped_value = zx_mapping[level]
                old_filename = get_resource_path(f"Saves/SINGLEPLAYER/{mapped_value}.sav")
                new_filename = f"SINGLEPLAYER_{name}_{timestamp}.sav"
                new_filepath = os.path.join(save_games_dir, new_filename)

        elif mode == "多人模式":
            if level in zx_mapping:
                mapped_value = zx_mapping[level]
                if difficulty == "简单难度":
                    old_filename = get_resource_path(f"Saves/MULTIPLAYER/EASY/MULTIPLAYER_{mapped_value}_Easy.sav")
                    new_filename = f"MULTIPLAYER_{name}_Easy.sav"

                elif difficulty == "普通难度":
                    old_filename = get_resource_path(f"Saves/SINGLEPLAYER/{mapped_value}.sav")
                    new_filename = f"MULTIPLAYER_{name}_Normal.sav"

                elif difficulty == "困难难度":
                    old_filename = get_resource_path(f"Saves/MULTIPLAYER/HARD/MULTIPLAYER_{mapped_value}_Hard.sav")
                    new_filename = f"MULTIPLAYER_{name}_Hard.sav"

                new_filepath = os.path.join(save_games_dir, new_filename)

        try:
            # 复制存档模板文件到目标目录并重命名
            shutil.copy(old_filename, new_filepath)
            if mode == "单人模式":
                messagebox.showinfo("提示", f"成功创建存档！\n存档类型：单人模式\n存档名称：{name}\n时间戳：{timestamp}\n当前时间：{now}")
            elif mode == "多人模式":
                messagebox.showinfo("提示", f"成功创建存档！\n存档类型：多人模式\n存档名称：{name}\n存档难度：{difficulty}")
        except Exception as e:
            messagebox.showerror("错误", f"创建存档失败：{str(e)}")

        # 清空输入框内容
        self.entry_name.delete(0, tk.END)

        # 返回主界面
        self.return_to_main()

        # 清空 Treeview 中的所有数据
        self.treeview.delete(*self.treeview.get_children())
        # 重新填充 Treeview
        self.populate_treeview()

    def delete_file(self):
        selected_item = self.treeview.selection()
        if not selected_item:
            messagebox.showinfo("提示", "请选择要删除的存档！")
            return
        else:
            ds = messagebox.askquestion("提示", "你确定要删除此存档吗？")
            if ds == "yes":
                for item in selected_item:
                    item_values = self.treeview.item(item, "values")
                    dtype, dname, ddiff = item_values
                    save_games_dir = os.path.join(os.getenv('LOCALAPPDATA'), "EscapeTheBackrooms", "Saved", "SaveGames")

                    if dtype == "单人模式":
                        dtype = "SINGLEPLAYER_"
                        dsname = f"{dtype}{dname}"
                        # 获取目录下所有文件名
                        file_names = os.listdir(save_games_dir)

                        # 初始化最小编辑距离和最相似文件
                        min_distance = float('inf')
                        most_similar_file = None

                        # 遍历文件名列表
                        for file_name in file_names:
                            # 检查文件名是否以"SINGLEPLAYER_"开头
                            if file_name.startswith(dsname):
                                # 计算编辑距离
                                distance = Levenshtein.distance(dsname, file_name)
                                # 更新最小编辑距离和最相似文件名
                                if distance < min_distance:
                                    min_distance = distance
                                    most_similar_file = file_name
                        dsname_path = os.path.join(save_games_dir, most_similar_file)
                    elif dtype == "多人模式":
                        dtype = "MULTIPLAYER_"
                        if ddiff == "普通难度":
                                ddiff = "_Normal"
                        elif ddiff == "简单难度":
                            ddiff = "_Easy"
                        elif ddiff == "困难难度":
                            ddiff = "_Hard"
                        elif ddiff == "噩梦难度":
                            ddiff = "_Nightmare"

                        dsname = f"{dtype}{dname}{ddiff}.sav"
                        dsname_path = os.path.join(save_games_dir, dsname)

                    if os.path.exists(dsname_path):
                        if dtype == "MULTIPLAYER_":
                            true = messagebox.askquestion("提示", f"请检查文件名是否正确：\n{dsname}\n如果不正确，请自行删除")
                            if true == "yes":
                                os.remove(dsname_path)
                                messagebox.showinfo("提示", f"成功删除 {dsname}")
                            else:
                                return
                        elif dtype == "SINGLEPLAYER_":
                            parts = most_similar_file.split("_")
                            if len(parts) >= 3:  # 确保至少有三部分
                                difficulty = parts[2].split(".")[0]
                            timestamp = int(difficulty)
                            utc_dt = datetime.fromtimestamp(timestamp)
                            local_dt = utc_dt.replace(tzinfo=pytz.utc).astimezone(pytz.timezone('Etc/GMT+8'))
                            formatted_local_dt = local_dt.strftime('%Y-%m-%d %H:%M:%S')
                            true = messagebox.askquestion("提示", f"请检查文件名是否正确：\n{most_similar_file}\n创建时间:  {formatted_local_dt}\n如果不正确，请自行删除\n算法不一定准确！")
                            if true == "yes":
                                os.remove(dsname_path)
                                messagebox.showinfo("提示", f"成功删除 {most_similar_file}")
                            else:
                                return
                        # 清空 Treeview 中的所有数据
                        self.treeview.delete(*self.treeview.get_children())
                        # 重新填充 Treeview
                        self.populate_treeview()
                        dname, dtype, ddiff, dsname = "", "", "", ""
                    else:
                        messagebox.showerror("错误", f"未成功删除 {dsname}")
                        dname, dtype, ddiff, dsname = "", "", "", ""

    def __init__(self, master):
        self.master = master # 主窗口
        self.master.title("逃离后室存档工具" + str(VERSION)) # 窗口标题
        self.master.geometry("768x432")
        self.master.resizable(False, False) # 禁止窗口大小调整

        # 设置窗口图标
        icon_path = get_resource_path("Others/a.ico")
        self.master.iconbitmap(icon_path)

        # 加载背景图片
        background_image_path = get_resource_path("Others/main.jpg")
        self.background_image = Image.open(background_image_path)
        self.background_photo = ImageTk.PhotoImage(self.background_image)

        # 创建背景标签放置背景图片
        self.background_label = tk.Label(self.master, image=self.background_photo)
        self.background_label.place(x=0, y=0, relwidth=1, relheight=1)

        # 创建按钮
        self.buttons = []
        button_texts = ["新建", "删除", "编辑", "隐藏", "刷新", "显示文件夹", "设置"]
        button_x = 10
        button_y = 10
        for text in button_texts:
            button = tk.Button(self.master, text=text, width=10, height=2, font=("SimHei", 12), command=self.get_command(text))
            button.place(x=button_x, y=button_y)
            self.buttons.append(button)
            button_x += 100  # 按钮间距
        
        # 加载图标按钮图片并保持引用
        icon_image = Image.open(icon_path)
        icon_image.thumbnail((50, 50))  # 调整图标大小
        self.icon_photo = ImageTk.PhotoImage(icon_image)

        # 创建图标按钮
        self.icon_button = tk.Button(self.master, image=self.icon_photo, command=self.playgame)
        self.icon_button.place(x=button_x, y=button_y, width=50, height=50)  # 设置按钮大小
        self.buttons.append(self.icon_button)

        # 创建Treeview
        self.treeview = ttk.Treeview(self.master, show="headings")
        self.treeview.place(x=15, y=button_y + 70, width=740, height=340)

        # 设置Treeview列的宽度和表头
        self.treeview["columns"] = ("存档类型", "存档名称", "存档难度")
        self.treeview.heading("存档类型", text="存档类型", anchor=tk.CENTER)
        self.treeview.heading("存档名称", text="存档名称", anchor=tk.CENTER)
        self.treeview.heading("存档难度", text="存档难度", anchor=tk.CENTER)
        self.set_column_widths([5/22, 12/22, 5/22])

        # 填充Treeview
        self.populate_treeview()

        for col in self.treeview["columns"]:
            self.treeview.heading(col, text=col, anchor="center")
            self.treeview.column(col, width=120, anchor="center")

        # 创建设置、编辑界面控件
        self.create_settings_ui()
        self.create_edit_ui()

if __name__ == "__main__":
    root = tk.Tk()
    app = ESGP_Saves_Tools(root)
    root.mainloop()