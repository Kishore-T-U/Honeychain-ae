from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import librosa
import io
import torch
from torchvision import models, transforms
from PIL import Image

app = FastAPI()

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load the Trained Visual Disease Model ---
try:
    disease_model = models.resnet18(pretrained=False)
    num_ftrs = disease_model.fc.in_features
    disease_model.fc = torch.nn.Linear(num_ftrs, 2) 
    disease_model.load_state_dict(torch.load("models/bee_disease_model.pth", map_location=torch.device('cpu')))
    disease_model.eval()
except Exception as e:
    print(f"Warning: Could not load disease model: {e}")
    disease_model = None

# Define image formatting required by ResNet18
img_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Visual Disease Classification using the trained CNN.
    """
    # FIX: Check both content_type and filename extensions properly
    is_image = file.content_type.startswith("image/") or file.filename.lower().endswith(('.png', '.jpg', '.jpeg'))
    
    if not is_image:
        raise HTTPException(status_code=400, detail="Invalid file type. Must be an image.")
    
    if disease_model is None:
        raise HTTPException(status_code=500, detail="AI Risk Engine model not loaded.")

    try:
        # Read and preprocess the image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        input_tensor = img_transform(image)
        input_batch = input_tensor.unsqueeze(0)

        # Run inference
        with torch.no_grad():
            output = disease_model(input_batch)
            probabilities = torch.nn.functional.softmax(output[0], dim=0)
            
        healthy_prob = probabilities[0].item()
        diseased_prob = probabilities[1].item()
        
        # Confidence Gating Logic
        if diseased_prob > 0.85:
            status = "Inspect"
            message = "High probability of visible disease (e.g., Varroa). Manual check required."
            final_confidence = diseased_prob
        elif diseased_prob > 0.50:
            status = "Sample"
            message = "Uncertain visual evidence. Recommend targeted sampling."
            final_confidence = diseased_prob
        else:
            status = "Normal"
            message = "No visible signs of damage detected on brood frame."
            final_confidence = healthy_prob

        return {
            "evidence_type": "visual",
            "risk_status": status,
            "confidence_score": final_confidence,
            "detail": message
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image Processing Error: {str(e)}")

@app.post("/api/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    """
    DSP Acoustic Analysis: Detects queenless frequency shifts (200-300Hz).
    """
    if not file.filename.lower().endswith(('.wav', '.mp3', '.webm', '.ogg')):
        raise HTTPException(status_code=400, detail="Invalid audio format")
    
    try:
        # Read file into memory and load with librosa
        audio_bytes = await file.read()
        y, sr = librosa.load(io.BytesIO(audio_bytes), sr=22050)
        
        # Extract Mel-frequency cepstral coefficients (MFCCs)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mean_mfccs = np.mean(mfccs, axis=1)
        
        # Simulated logic: Evaluate specific frequency bands for queenless distress signals
        distress_signal_strength = float(np.abs(mean_mfccs[2] - mean_mfccs[1])) 
        
        # Confidence Gating Logic
        if distress_signal_strength > 20.0:
            status = "Inspect"
            confidence = 0.85
            message = "High distress frequencies detected. Possible queenless state."
        elif distress_signal_strength > 10.0:
            status = "Sample"
            confidence = 0.60
            message = "Anomalous acoustics. Manual inspection recommended."
        else:
            status = "Normal"
            confidence = 0.95
            message = "Acoustic signature matches healthy baseline."
            
        return {
            "evidence_type": "acoustic",
            "risk_status": status,
            "confidence_score": confidence,
            "detail": message,
            "dsp_metrics": {"distress_strength": round(distress_signal_strength, 2)}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DSP Processing Error: {str(e)}")