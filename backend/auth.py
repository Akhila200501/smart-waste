import os
import hashlib
import binascii
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from database import db

# JWT Configurations
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "smart_waste_management_super_secret_key_123456")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2 with a secure salt."""
    salt = hashlib.sha256(SECRET_KEY.encode()).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), 
                                salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hashed value."""
    try:
        salt = hashed_password[:64].encode('ascii')
        stored_hash = hashed_password[64:]
        pwdhash = hashlib.pbkdf2_hmac('sha512', plain_password.encode('utf-8'), 
                                    salt, 100000)
        pwdhash = binascii.hexlify(pwdhash).decode('ascii')
        return pwdhash == stored_hash
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Generate a secure JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """FastAPI dependency to extract and verify the current logged-in user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.get_user_by_username(username)
    if user is None:
        raise credentials_exception
    return user
