import torch
import torch.nn as nn
import torchvision.models as models
import cv2

class ReIDModel(nn.Module):
    def __init__(self, embedding_dim=128):
        super().__init__()
        base = models.mobilenet_v3_small(pretrained=True)
        self.backbone = nn.Sequential(*list(base.children())[:-1])
        self.fc = nn.Linear(576, embedding_dim)

    def forward(self, x):
        x = self.backbone(x).squeeze()
        x = self.fc(x)
        return nn.functional.normalize(x)

def compute_embedding(frame, bbox, model):
    x1, y1, x2, y2 = map(int, bbox)
    crop = frame[y1:y2, x1:x2]
    crop = cv2.resize(crop, (128,256))
    tensor = torch.tensor(crop).permute(2,0,1).unsqueeze(0).float() / 255.0
    with torch.no_grad():
        embedding = model(tensor)
    return embedding
