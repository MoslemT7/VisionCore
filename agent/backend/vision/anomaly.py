import torch
import torch.nn as nn

class ConvAutoEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(3,16,3,stride=2,padding=1), nn.ReLU(),
            nn.Conv2d(16,32,3,stride=2,padding=1), nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(32,16,3,stride=2,padding=1,output_padding=1), nn.ReLU(),
            nn.ConvTranspose2d(16,3,3,stride=2,padding=1,output_padding=1), nn.Sigmoid()
        )
    def forward(self,x):
        return self.decoder(self.encoder(x))

def anomaly_score(frame_tensor, model):
    with torch.no_grad():
        recon = model(frame_tensor)
        score = ((recon - frame_tensor)**2).mean().item()
    return score
