import os
import sqlite3
import json
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Database")

# Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = "smart_waste_db"
USE_MONGODB = False # Can be toggled, but will auto-fallback on connection failure

# Try importing pymongo
try:
    from pymongo import MongoClient
    from pymongo.errors import ConnectionFailure
    pymongo_available = True
except ImportError:
    pymongo_available = False
    logger.info("pymongo not installed, using SQLite fallback.")

class DatabaseManager:
    def __init__(self):
        self.db_type = "sqlite"
        self.mongo_client = None
        self.mongo_db = None
        self.sqlite_db_path = "waste_management.db"
        
        # Try to initialize MongoDB if requested and available
        if pymongo_available:
            try:
                # Set a short timeout so it doesn't hang the server startup
                self.mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
                # Force a connection check
                self.mongo_client.server_info()
                self.mongo_db = self.mongo_client[DB_NAME]
                self.db_type = "mongodb"
                logger.info("Successfully connected to MongoDB!")
            except Exception as e:
                logger.warning(f"Failed to connect to MongoDB: {e}. Falling back to SQLite.")
                self.db_type = "sqlite"
        
        if self.db_type == "sqlite":
            self._init_sqlite()

    def _init_sqlite(self):
        """Initialize SQLite tables if they do not exist."""
        conn = sqlite3.connect(self.sqlite_db_path)
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        # Create waste records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS waste_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                confidence REAL NOT NULL,
                image_path TEXT,
                recycling_instructions TEXT NOT NULL,
                carbon_saved REAL NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        # Create chat history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("SQLite database initialized successfully.")

    # --- User operations ---
    def create_user(self, username, email, password_hash):
        if self.db_type == "mongodb":
            user = {
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "created_at": datetime.utcnow().isoformat()
            }
            try:
                result = self.mongo_db.users.insert_one(user)
                user["id"] = str(result.inserted_id)
                return user
            except Exception as e:
                logger.error(f"MongoDB create_user error: {e}")
                return None
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            cursor = conn.cursor()
            try:
                created_at = datetime.utcnow().isoformat()
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (username, email, password_hash, created_at)
                )
                conn.commit()
                user_id = cursor.lastrowid
                return {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "created_at": created_at
                }
            except sqlite3.IntegrityError as e:
                logger.warning(f"User integrity constraint failed: {e}")
                return None
            finally:
                conn.close()

    def get_user_by_username(self, username):
        if self.db_type == "mongodb":
            user = self.mongo_db.users.find_one({"username": username})
            if user:
                user["id"] = str(user["_id"])
                return user
            return None
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(row)
            return None

    def get_user_by_email(self, email):
        if self.db_type == "mongodb":
            user = self.mongo_db.users.find_one({"email": email})
            if user:
                user["id"] = str(user["_id"])
                return user
            return None
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            conn.close()
            if row:
                return dict(row)
            return None

    # --- Waste Record operations ---
    def create_waste_record(self, user_id, category, confidence, image_path, recycling_instructions, carbon_saved):
        created_at = datetime.utcnow().isoformat()
        if self.db_type == "mongodb":
            record = {
                "user_id": str(user_id),
                "category": category,
                "confidence": float(confidence),
                "image_path": image_path,
                "recycling_instructions": recycling_instructions,
                "carbon_saved": float(carbon_saved),
                "created_at": created_at
            }
            result = self.mongo_db.waste_records.insert_one(record)
            record["id"] = str(result.inserted_id)
            return record
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO waste_records 
                   (user_id, category, confidence, image_path, recycling_instructions, carbon_saved, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (user_id, category, confidence, image_path, json.dumps(recycling_instructions) if isinstance(recycling_instructions, (dict, list)) else recycling_instructions, carbon_saved, created_at)
            )
            conn.commit()
            record_id = cursor.lastrowid
            conn.close()
            return {
                "id": record_id,
                "user_id": user_id,
                "category": category,
                "confidence": confidence,
                "image_path": image_path,
                "recycling_instructions": recycling_instructions,
                "carbon_saved": carbon_saved,
                "created_at": created_at
            }

    def get_user_waste_records(self, user_id):
        if self.db_type == "mongodb":
            records = list(self.mongo_db.waste_records.find({"user_id": str(user_id)}).sort("created_at", -1))
            for r in records:
                r["id"] = str(r["_id"])
            return records
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM waste_records WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
            rows = cursor.fetchall()
            conn.close()
            
            records = []
            for row in rows:
                r = dict(row)
                # Try parsing JSON instructions
                try:
                    r["recycling_instructions"] = json.loads(r["recycling_instructions"])
                except Exception:
                    pass
                records.append(r)
            return records

    # --- Chat History operations ---
    def log_chat_message(self, user_id, message, response):
        timestamp = datetime.utcnow().isoformat()
        if self.db_type == "mongodb":
            chat = {
                "user_id": str(user_id),
                "message": message,
                "response": response,
                "timestamp": timestamp
            }
            self.mongo_db.chat_history.insert_one(chat)
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO chat_history (user_id, message, response, timestamp) VALUES (?, ?, ?, ?)",
                (user_id, message, response, timestamp)
            )
            conn.commit()
            conn.close()

    def get_chat_history(self, user_id, limit=20):
        if self.db_type == "mongodb":
            chats = list(self.mongo_db.chat_history.find({"user_id": str(user_id)}).sort("timestamp", -1).limit(limit))
            for c in chats:
                c["id"] = str(c["_id"])
            return chats[::-1] # return in chronological order
        else:
            conn = sqlite3.connect(self.sqlite_db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM chat_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?", (user_id, limit))
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows][::-1]

# Global database instance
db = DatabaseManager()
