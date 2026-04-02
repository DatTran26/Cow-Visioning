"""
=============================================================================
🐮 YOLOv8 CATTLE DETECTION TEST CONSOLE
Hỗ trợ: Images, Video, Camera Realtime
Tùy chỉnh: Confidence Threshold, IOU Threshold
=============================================================================
"""

import os
os.environ.setdefault("TCL_LIBRARY", r"C:\Program Files\Python313\tcl\tcl8.6")
os.environ.setdefault("TK_LIBRARY", r"C:\Program Files\Python313\tcl\tk8.6")

import customtkinter as ctk
import cv2
from PIL import Image, ImageTk
from ultralytics import YOLO
import threading
import os
import numpy as np
from tkinter import filedialog, messagebox
import time
import torch

# Cấu hình màu sắc hiển thị gia súc
COLOR_MAP = {
    0: (0, 255, 0),      # Green
    1: (203, 192, 255),  # Pink
    2: (255, 255, 0),    # Cyan
    3: (42, 42, 165),    # Red
}

class CattleDetectorApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("🐮 Cattle YOLO Detector - RTX 3060 Edition")
        self.geometry("1500x900")
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        # ===== BIẾN ĐIỀU KHIỂN =====
        self.model = None
        self.model_path = ctk.StringVar(value="yolov8n.pt")
        self.cap = None
        self.is_running = False
        self.input_mode = ctk.StringVar(value="camera")
        self.source_path = ctk.StringVar(value="")
        
        # Tham số detection
        self.conf_threshold = ctk.DoubleVar(value=0.50)
        self.iou_threshold = ctk.DoubleVar(value=0.45)
        _default_device = "0" if torch.cuda.is_available() else "cpu"
        self.device = ctk.StringVar(value=_default_device)  # GPU device
        self.max_det = ctk.IntVar(value=300)  # Max detections
        self.show_conf = ctk.BooleanVar(value=True)  # Show confidence
        self.show_boxes = ctk.BooleanVar(value=True)  # Show boxes
        
        # Frame count
        self.frame_count = 0
        self.fps = 0.0
        self.fps_time = 0
        self.frame_skip = 0
        self.target_fps = 30  # Target 30 FPS
        self.frame_delay = 1.0 / self.target_fps  # ~33ms per frame

        self.setup_ui()

    def setup_ui(self):
        """Thiết lập giao diện"""
        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ===== CỘT TRÁI: HIỂN THỊ VIDEO/ẢNH =====
        self.display_frame = ctk.CTkFrame(self, fg_color="black", corner_radius=10)
        self.display_frame.grid(row=0, column=0, padx=15, pady=15, sticky="nsew")
        self.display_frame.grid_columnconfigure(0, weight=1)
        self.display_frame.grid_rowconfigure(0, weight=1)

        self.video_label = ctk.CTkLabel(
            self.display_frame, 
            text="🎬 Chờ input...",
            text_color="grey",
            font=("Roboto", 16)
        )
        self.video_label.grid(row=0, column=0, sticky="nsew")

        # ===== CỘT PHẢI: ĐIỀU KHIỂN =====
        self.control_frame = ctk.CTkScrollableFrame(self, fg_color="#1a1a1a", corner_radius=10)
        self.control_frame.grid(row=0, column=1, padx=15, pady=15, sticky="nsew")
        self.control_frame.grid_columnconfigure(0, weight=1)

        # --- PHẦN 1: CHỌN MODEL ---
        self.add_section_title("📦 MODEL")
        
        # Entry + Browse button
        ctk.CTkLabel(self.control_frame, text="Đường dẫn:").pack(anchor="w", padx=10, pady=(5, 0))
        browse_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        browse_frame.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkEntry(browse_frame, textvariable=self.model_path).pack(side="left", expand=True, padx=(0, 5))
        ctk.CTkButton(
            browse_frame, 
            text="📂 Browse",
            width=70,
            fg_color="#374151",
            command=self.browse_model
        ).pack(side="left")

        # Load button
        ctk.CTkButton(
            self.control_frame,
            text="🚀 Load Model",
            width=200,
            fg_color="#059669",
            hover_color="#10B981",
            font=("Roboto", 11, "bold"),
            command=self.load_model
        ).pack(fill="x", padx=10, pady=8)

        self.model_status = ctk.CTkLabel(self.control_frame, text="⏳ Chưa load model", text_color="orange")
        self.model_status.pack(anchor="w", padx=10, pady=3)

        # --- PHẦN 2: CHỌN INPUT ---
        self.add_section_title("📥 INPUT MODE")

        for mode, label in [("camera", "📷 Camera"), ("image", "🖼️ Ảnh"), ("video", "🎥 Video")]:
            ctk.CTkRadioButton(
                self.control_frame,
                text=label,
                variable=self.input_mode,
                value=mode,
                command=self.on_mode_change
            ).pack(anchor="w", padx=10, pady=3)

        # Browse button cho image/video
        self.browse_button = ctk.CTkButton(
            self.control_frame,
            text="📂 Chọn File",
            fg_color="#374151",
            command=self.browse_source
        )
        self.browse_button.pack(fill="x", padx=10, pady=8)

        self.source_label = ctk.CTkLabel(self.control_frame, text="Chưa chọn", text_color="grey", font=("Roboto", 10))
        self.source_label.pack(anchor="w", padx=10, pady=2)

        # --- PHẦN 3: THAM SỐ DETECTION ---
        self.add_section_title("⚙️ TỐI ƯU HÓA")

        # Confidence Threshold
        ctk.CTkLabel(self.control_frame, text="Confidence Threshold:", font=("Roboto", 11)).pack(anchor="w", padx=10, pady=(8, 2))
        conf_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        conf_frame.pack(fill="x", padx=10, pady=2)
        
        self.conf_slider = ctk.CTkSlider(
            conf_frame,
            from_=0.0,
            to=1.0,
            variable=self.conf_threshold,
            number_of_steps=100,
            command=self.update_params
        )
        self.conf_slider.pack(side="left", expand=True)
        
        self.conf_label = ctk.CTkLabel(conf_frame, text="0.50", width=50, text_color="cyan", font=("Roboto", 11, "bold"))
        self.conf_label.pack(side="left", padx=10)

        # IOU Threshold
        ctk.CTkLabel(self.control_frame, text="IOU Threshold:", font=("Roboto", 11)).pack(anchor="w", padx=10, pady=(10, 2))
        iou_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        iou_frame.pack(fill="x", padx=10, pady=2)
        
        self.iou_slider = ctk.CTkSlider(
            iou_frame,
            from_=0.0,
            to=1.0,
            variable=self.iou_threshold,
            number_of_steps=100,
            command=self.update_params
        )
        self.iou_slider.pack(side="left", expand=True)
        
        self.iou_label = ctk.CTkLabel(iou_frame, text="0.45", width=50, text_color="cyan", font=("Roboto", 11, "bold"))
        self.iou_label.pack(side="left", padx=10)

        # Max Detections
        ctk.CTkLabel(self.control_frame, text="Max Detections:", font=("Roboto", 11)).pack(anchor="w", padx=10, pady=(10, 2))
        max_det_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        max_det_frame.pack(fill="x", padx=10, pady=2)
        
        self.max_det_entry = ctk.CTkEntry(
            max_det_frame,
            textvariable=self.max_det,
            width=100
        )
        self.max_det_entry.pack(side="left", padx=(0, 10))
        ctk.CTkLabel(max_det_frame, text="(1-1000)", text_color="grey", font=("Roboto", 9)).pack(side="left")

        # Device Selection
        ctk.CTkLabel(self.control_frame, text="Device:", font=("Roboto", 11)).pack(anchor="w", padx=10, pady=(10, 2))
        device_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        device_frame.pack(fill="x", padx=10, pady=2)
        
        device_options = ["0", "1", "cpu"] if torch.cuda.is_available() else ["cpu"]
        self.device_menu = ctk.CTkComboBox(
            device_frame,
            values=device_options,
            variable=self.device,
            width=100
        )
        self.device_menu.pack(side="left", padx=(0, 10))
        ctk.CTkLabel(device_frame, text="(GPU/CPU)", text_color="grey", font=("Roboto", 9)).pack(side="left")

        # Visualization Options
        ctk.CTkLabel(self.control_frame, text="Visualization:", font=("Roboto", 11)).pack(anchor="w", padx=10, pady=(10, 2))
        
        self.show_conf_check = ctk.CTkCheckBox(
            self.control_frame,
            text="Show Confidence",
            variable=self.show_conf
        )
        self.show_conf_check.pack(anchor="w", padx=10, pady=2)
        
        self.show_boxes_check = ctk.CTkCheckBox(
            self.control_frame,
            text="Show Bounding Boxes",
            variable=self.show_boxes
        )
        self.show_boxes_check.pack(anchor="w", padx=10, pady=2)

        # --- PHẦN 4: ĐIỀU KHIỂN ---
        self.add_section_title("🎮 ĐIỀU KHIỂN")

        button_frame = ctk.CTkFrame(self.control_frame, fg_color="transparent")
        button_frame.pack(fill="x", padx=10, pady=5)

        self.start_button = ctk.CTkButton(
            button_frame,
            text="▶️  BẮT ĐẦU",
            fg_color="#059669",
            hover_color="#10B981",
            font=("Roboto", 12, "bold"),
            command=self.start_detection
        )
        self.start_button.pack(side="left", expand=True, padx=3)

        self.stop_button = ctk.CTkButton(
            button_frame,
            text="⏹️  DỪNG",
            fg_color="#DC2626",
            hover_color="#EF4444",
            font=("Roboto", 12, "bold"),
            command=self.stop_detection,
            state="disabled"
        )
        self.stop_button.pack(side="left", expand=True, padx=3)

        # --- PHẦN 5: THỐNG KÊ ---
        self.add_section_title("📊 THỐNG KÊ")

        self.stats_label = ctk.CTkLabel(
            self.control_frame,
            text="FPS: --\nDetections: 0\nConfidence: 0%",
            text_color="cyan",
            font=("Roboto", 11),
            justify="left"
        )
        self.stats_label.pack(anchor="w", padx=10, pady=5, fill="x")

    def add_section_title(self, title):
        """Thêm tiêu đề section"""
        ctk.CTkLabel(
            self.control_frame,
            text=title,
            font=("Roboto", 12, "bold"),
            text_color="#10B981"
        ).pack(anchor="w", padx=10, pady=(12, 8))

    def update_params(self, value):
        """Cập nhật hiển thị tham số"""
        self.conf_label.configure(text=f"{self.conf_threshold.get():.2f}")
        self.iou_label.configure(text=f"{self.iou_threshold.get():.2f}")

    def on_mode_change(self):
        """Khi thay đổi mode input"""
        mode = self.input_mode.get()
        if mode == "camera":
            self.browse_button.configure(state="disabled")
            self.source_path.set("")
            self.source_label.configure(text="Camera 0")
        else:
            self.browse_button.configure(state="normal")

    def browse_source(self):
        """Chọn file ảnh hoặc video"""
        mode = self.input_mode.get()
        if mode == "image":
            filetypes = [("Ảnh", "*.jpg *.jpeg *.png *.bmp *.webp")]
        else:  # video
            filetypes = [("Video", "*.mp4 *.avi *.mov *.mkv")]
        
        path = filedialog.askopenfilename(filetypes=filetypes)
        if path:
            self.source_path.set(path)
            self.source_label.configure(text=os.path.basename(path))

    def browse_model(self):
        """Browse để chọn file model .pt"""
        path = filedialog.askopenfilename(
            filetypes=[("YOLO Model", "*.pt"), ("Tất cả", "*.*")],
            title="Chọn file model YOLO"
        )
        if path:
            self.model_path.set(path)
            self.model_status.configure(text=f"📂 {os.path.basename(path)}", text_color="cyan")

    def load_model(self):
        """Tải model YOLO"""
        def load_thread():
            try:
                model_name = self.model_path.get().strip()
                if not model_name:
                    self.model_status.configure(text="❌ Chưa chọn model", text_color="#EF4444")
                    return
                
                self.model_status.configure(text=f"⏳ Đang load {os.path.basename(model_name)}...", text_color="orange")
                self.model = YOLO(model_name)
                self.model_status.configure(text=f"✅ {os.path.basename(model_name)} ready!", text_color="#10B981")
            except Exception as e:
                self.model_status.configure(text=f"❌ Load failed: {str(e)[:30]}", text_color="#EF4444")
                messagebox.showerror("Lỗi", f"❌ Không thể tải model:\n{str(e)}")
        
        threading.Thread(target=load_thread, daemon=True).start()

    def start_detection(self):
        """Bắt đầu detection"""
        # Check model
        if not self.model:
            messagebox.showerror("Lỗi", "❌ Model chưa được tải!\n\nVui lòng:\n1. Chọn model\n2. Bấm 'Load Model'")
            return

        mode = self.input_mode.get()
        
        if mode == "camera":
            source = 0
        elif mode in ["image", "video"]:
            source = self.source_path.get()
            if not source or not os.path.exists(source):
                messagebox.showerror("Lỗi", f"❌ File không tồn tại!\n{source}")
                return
        else:
            messagebox.showerror("Lỗi", "❌ Chế độ input không hợp lệ!")
            return
        
        # Check device validity
        device = self.device.get()
        if device not in ["0", "1", "cpu"]:
            messagebox.showerror("Lỗi", f"❌ Device không hợp lệ: {device}")
            return
        
        self.is_running = True
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        
        # Chạy detection trong thread riêng
        thread = threading.Thread(target=self.run_detection, args=(source, mode), daemon=True)
        thread.start()

    def run_detection(self, source, mode):
        """Chạy detection chính"""
        try:
            if mode == "image":
                self.detect_image(source)
            elif mode == "video":
                self.detect_video(source)
            else:  # camera
                self.detect_camera(source)
        except Exception as e:
            messagebox.showerror("Lỗi", f"❌ {str(e)}")
        finally:
            self.stop_detection()

    def detect_image(self, image_path):
        """Detection trên ảnh"""
        img = cv2.imread(image_path)
        if img is None:
            messagebox.showerror("Lỗi", "❌ Không thể đọc file ảnh!")
            return

        # Inference with tracking
        results = self.model.predict(
            source=img,
            conf=self.conf_threshold.get(),
            iou=self.iou_threshold.get(),
            max_det=self.max_det.get(),
            device=self.device.get(),
            verbose=False,
            tracker="botsort.yaml"  # Enable tracking
        )

        # Vẽ bounding box với tracking ID
        annotated_frame = self.draw_detections(img.copy(), results[0])
        
        # Hiển thị
        self.display_image(annotated_frame, results[0])

    def detect_video(self, video_path):
        """Detection trên video - Optimized 30 FPS"""
        cap = cv2.VideoCapture(video_path)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer for faster processing
        
        self.frame_count = 0
        self.fps_time = time.time()
        frame_start_time = time.time()
        
        while self.is_running and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Resize cho hiển thị nhanh - 640x480 để tối ưu speed
            frame_small = cv2.resize(frame, (640, 480))

            # Inference with tracking
            results = self.model.predict(
                source=frame_small,
                conf=self.conf_threshold.get(),
                iou=self.iou_threshold.get(),
                max_det=self.max_det.get(),
                device=self.device.get(),
                verbose=False,
                tracker="botsort.yaml"  # Enable tracking
            )

            # Vẽ bounding box với tracking ID
            annotated_frame = self.draw_detections(frame_small.copy(), results[0])
            
            # Hiển thị
            self.display_image(annotated_frame, results[0])
            
            self.frame_count += 1
            
            # FPS limiting - target 30fps
            elapsed = time.time() - frame_start_time
            if elapsed < self.frame_delay:
                time.sleep(self.frame_delay - elapsed)
            frame_start_time = time.time()

        cap.release()

    def detect_camera(self, camera_id):
        """Detection từ camera realtime - 30 FPS optimized"""
        cap = cv2.VideoCapture(camera_id)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer

        self.frame_count = 0
        self.fps_time = time.time()
        frame_start_time = time.time()
        
        while self.is_running and cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                messagebox.showerror("Lỗi", "❌ Không thể đọc từ camera!")
                break

            # Inference with tracking
            results = self.model.predict(
                source=frame,
                conf=self.conf_threshold.get(),
                iou=self.iou_threshold.get(),
                max_det=self.max_det.get(),
                device=self.device.get(),
                verbose=False,
                tracker="botsort.yaml"  # Enable tracking
            )

            # Vẽ bounding box với tracking ID
            annotated_frame = self.draw_detections(frame.copy(), results[0])
            
            # Hiển thị
            self.display_image(annotated_frame, results[0])
            
            self.frame_count += 1
            
            # FPS limiting - target 30fps
            elapsed = time.time() - frame_start_time
            if elapsed < self.frame_delay:
                time.sleep(self.frame_delay - elapsed)
            frame_start_time = time.time()

        cap.release()

    def draw_detections(self, frame, results):
        """Vẽ bounding box với tracking ID và tên class 'cow'"""
        if results.boxes is None or len(results.boxes) == 0:
            return frame
        
        annotated = frame.copy()
        
        for box in results.boxes:
            # Lấy tọa độ
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            
            # Lấy tracking ID (nếu có)
            track_id = int(box.id[0]) if box.id is not None else -1
            
            # Lấy tên class - mặc định là 'cow' cho bò
            class_name = self.model.names.get(cls_id, "Unknown")
            if class_name.lower() in ["cow", "bò", "cattle"]:
                label = "cow"
            else:
                label = class_name
            
            # Chọn màu
            color = COLOR_MAP.get(cls_id, (0, 255, 0))
            
            # Vẽ bounding box nếu được bật
            if self.show_boxes.get():
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            
            # Vẽ text với tracking ID nếu confidence được bật
            if self.show_conf.get():
                if track_id >= 0:
                    text = f"{label} ID:{track_id} {conf:.2f}"
                else:
                    text = f"{label} {conf:.2f}"
                
                # Background cho text
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                bg_x1, bg_y1 = x1, y1 - text_size[1] - 8
                bg_x2, bg_y2 = x1 + text_size[0] + 4, y1
                cv2.rectangle(annotated, (bg_x1, bg_y1), (bg_x2, bg_y2), color, -1)
                
                # Vẽ text
                cv2.putText(annotated, text, (x1 + 2, y1 - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return annotated

    def display_image(self, frame, results):
        """Hiển thị frame trên label"""
        # Resize cho hiển thị
        h, w = frame.shape[:2]
        ratio = min(900 / w, 700 / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        frame_display = cv2.resize(frame, (new_w, new_h))
        
        # Convert BGR -> RGB
        frame_rgb = cv2.cvtColor(frame_display, cv2.COLOR_BGR2RGB)
        
        # Convert to PIL Image
        pil_image = Image.fromarray(frame_rgb)
        
        # Convert to PhotoImage
        photo = ImageTk.PhotoImage(image=pil_image)
        
        # Update label
        self.video_label.configure(image=photo, text="")
        self.video_label.image = photo  # Keep reference

        # Update stats
        detection_count = len(results.boxes) if results.boxes is not None else 0
        
        # Tính FPS
        current_time = time.time()
        if self.frame_count > 0:
            self.fps = 1.0 / (current_time - self.fps_time + 0.001)
        self.fps_time = current_time

        # Confidence trung bình
        avg_conf = 0
        if detection_count > 0:
            confs = [float(b.conf[0]) for b in results.boxes]
            avg_conf = sum(confs) / len(confs) * 100

        stats_text = f"FPS: {self.fps:.1f}\nDetections: {detection_count}\nAvg Conf: {avg_conf:.1f}%"
        self.stats_label.configure(text=stats_text)

    def stop_detection(self):
        """Dừng detection"""
        self.is_running = False
        self.start_button.configure(state="normal")
        self.stop_button.configure(state="disabled")
        self.video_label.configure(text="🎬 Chờ input...", image=None)


if __name__ == "__main__":
    app = CattleDetectorApp()
    app.mainloop()