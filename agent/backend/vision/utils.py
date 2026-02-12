import cv2

def crop_frame(frame, bbox):
    x1, y1, x2, y2 = map(int, bbox)
    return frame[y1:y2, x1:x2]

def resize_frame(frame, size=(128,256)):
    return cv2.resize(frame, size)
