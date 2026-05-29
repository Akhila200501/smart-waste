import os
import shutil
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from database import db
from auth import hash_password, verify_password, create_access_token, get_current_user
from classifier import classify_waste
from chatbot import query_rag_chatbot
from analytics import calculate_user_analytics

# Initialize FastAPI App
app = FastAPI(
    title="AI-Powered Smart Waste Management API",
    description="Backend API supporting waste classification, JWT auth, circular analytics, and RAG chatbot",
    version="1.0.0"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to React URL e.g. ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads folder exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount uploads folder as static files so frontend can fetch images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# --- Pydantic Schemas ---
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ChatQuery(BaseModel):
    message: str


# --- API Routes ---

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the AI-Powered Smart Waste Management System API!",
        "database_type": db.db_type
    }

# --- Auth Endpoints ---

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister):
    # Check if user already exists
    if db.get_user_by_username(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    if db.get_user_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    pwd_hash = hash_password(user_data.password)
    user = db.create_user(user_data.username, user_data.email, pwd_hash)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )
        
    return {"message": "Registration successful!", "user": {"username": user["username"], "email": user["email"]}}

@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = db.get_user_by_username(user_data.username)
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "created_at": current_user["created_at"]
    }


# --- Waste Classification Endpoints ---

@app.post("/api/waste/classify")
async def classify(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only image uploads are supported."
        )
        
    # Save the file to local uploads directory
    file_name = f"user_{current_user['id']}_{int(os.path.getmtime(UPLOAD_DIR))}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded image: {e}"
        )
        
    # Run through the TensorFlow/PIL classification pipeline
    try:
        classification_result = classify_waste(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI waste classification failed: {e}"
        )
        
    # Calculate carbon saved
    # In classifier.py: each category has 'carbon_saved_per_kg'. 
    # Let's assume a default weight of 0.25 kg (250 grams) per uploaded item to make emissions realistic!
    item_weight_kg = 0.25
    carbon_saved = classification_result["carbon_saved_per_kg"] * item_weight_kg
    
    # Store in database
    relative_image_path = f"/uploads/{file_name}"
    
    try:
        record = db.create_waste_record(
            user_id=current_user["id"],
            category=classification_result["category"],
            confidence=classification_result["confidence"],
            image_path=relative_image_path,
            recycling_instructions=classification_result["instructions"],
            carbon_saved=carbon_saved
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log waste record: {e}"
        )
        
    return {
        "record_id": record["id"],
        "category": record["category"],
        "display_name": classification_result["display_name"],
        "confidence": record["confidence"],
        "image_url": relative_image_path,
        "carbon_saved": round(carbon_saved, 3),
        "recycling_rate": classification_result["recycling_rate"],
        "instructions": classification_result["instructions"],
        "sdg_impact": classification_result["sdg_impact"]
    }

@app.get("/api/waste/records")
async def get_records(current_user: dict = Depends(get_current_user)):
    try:
        return db.get_user_waste_records(current_user["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve waste logs: {e}"
        )


# --- Chatbot Endpoints ---

@app.post("/api/chat")
async def chat(
    query_data: ChatQuery,
    current_user: dict = Depends(get_current_user)
):
    try:
        response = query_rag_chatbot(current_user["id"], query_data.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chatbot failed to process request: {e}"
        )

@app.get("/api/chat/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    try:
        return db.get_chat_history(current_user["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve chat history: {e}"
        )


# --- Dashboard / Analytics Endpoints ---

@app.get("/api/dashboard/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    try:
        return calculate_user_analytics(current_user["id"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate analytics: {e}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
