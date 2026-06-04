"""
AssetFlow - Internal IT Asset Lifecycle Management System
Backend API Server
"""

from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta, date
from bson import ObjectId
import os
from dotenv import load_dotenv
load_dotenv()
import bcrypt
import jwt
import uuid
import base64
import smtplib
import secrets
import io
import csv
import time
import calendar
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx

# MongoDB setup
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

# Database configuration - uses MONGODB_URI environment variable
# For local development: mongodb://localhost:27017
# For production: mongodb+srv://user:pass@cluster.mongodb.net/assetflow
MONGODB_URI = os.environ.get("MONGODB_URI", os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB_NAME = os.environ.get("DB_NAME", "assetflow")
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"

# File storage directory
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="AssetFlow API", version="1.0.0")

# CORS - configure based on environment
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
try:
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    fs = AsyncIOMotorGridFSBucket(db)
    print(f"✓ Connected to MongoDB: {DB_NAME}")
except Exception as e:
    print(f"✗ MongoDB connection error: {e}")
    print("Please set MONGODB_URI environment variable")
    db = None
    fs = None

# Security
security = HTTPBearer()

# Collections
users_collection = db["users"]
employees_collection = db["employees"]
asset_types_collection = db["asset_types"]
assets_collection = db["assets"]
transfers_collection = db["transfers"]
settings_collection = db["settings"]
reset_tokens_collection = db["reset_tokens"]
files_collection = db["files"]
subscriptions_collection = db["subscriptions"]
music_tracks_collection = db["music_tracks"]
vehicles_collection = db["vehicles"]
vehicle_files_collection = db["vehicle_files"]

# Scheduler for scheduled tasks
scheduler = AsyncIOScheduler()

MUSIC_MAX_FILE_SIZE = 50 * 1024 * 1024
MUSIC_CONTENT_TYPES = {"audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/x-mp3"}
VEHICLE_MAX_FILE_SIZE = 25 * 1024 * 1024
VEHICLE_HERO_CONTENT_TYPES = {"image/png"}
VEHICLE_ATTACHMENT_CONTENT_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
VEHICLE_FIELD_TYPES = {"text", "textarea", "number", "date", "select", "checkbox", "image"}

def looks_like_mp3(contents: bytes) -> bool:
    if contents.startswith(b"ID3"):
        return True
    if len(contents) >= 2 and contents[0] == 0xFF and (contents[1] & 0xE0) == 0xE0:
        return True
    return False

# ============== PYDANTIC MODELS ==============

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "USER"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class EmployeeCreate(BaseModel):
    employeeId: str
    name: str
    fieldValues: Optional[Dict[str, Any]] = None

class EmployeeUpdate(BaseModel):
    employeeId: Optional[str] = None
    name: Optional[str] = None
    fieldValues: Optional[Dict[str, Any]] = None

class AssetTypeCreate(BaseModel):
    name: str

class AssetTypeUpdate(BaseModel):
    name: Optional[str] = None

class AssetFieldCreate(BaseModel):
    name: str
    fieldType: str = "text"
    required: bool = False
    options: Optional[List[str]] = None

class AssetFieldUpdate(BaseModel):
    name: Optional[str] = None
    fieldType: Optional[str] = None
    required: Optional[bool] = None
    options: Optional[List[str]] = None

class AssetCreate(BaseModel):
    assetTag: Optional[str] = None
    assetTypeId: str
    assignedEmployeeId: Optional[str] = None
    imageUrl: Optional[str] = None
    fieldValues: Optional[Dict[str, Any]] = None

class AssetUpdate(BaseModel):
    assetTag: Optional[str] = None
    assetTypeId: Optional[str] = None
    assignedEmployeeId: Optional[str] = None
    imageUrl: Optional[str] = None
    fieldValues: Optional[Dict[str, Any]] = None

class AssetDisposeRequest(BaseModel):
    reason: Optional[str] = None

class VehicleCreate(BaseModel):
    name: str
    imageFileId: str
    fieldValues: Optional[Dict[str, Any]] = None

class VehicleUpdate(BaseModel):
    name: Optional[str] = None
    imageFileId: Optional[str] = None
    fieldValues: Optional[Dict[str, Any]] = None

class TransferCreate(BaseModel):
    assetIds: List[str]
    fromType: str  # 'employee' | 'inventory'
    fromId: Optional[str] = None
    toType: str  # 'employee' | 'inventory'
    toId: Optional[str] = None
    notes: Optional[str] = None

class ManualTransferCreate(BaseModel):
    assetId: str
    fromType: str
    fromName: str
    toType: str
    toName: str
    date: Optional[str] = None
    notes: Optional[str] = None

class BrandingUpdate(BaseModel):
    appName: Optional[str] = None
    loginTitle: Optional[str] = None
    headerText: Optional[str] = None
    accentColor: Optional[str] = None
    logoFileId: Optional[str] = None
    faviconFileId: Optional[str] = None
    loginBackgroundFileId: Optional[str] = None

class PasswordChange(BaseModel):
    oldPassword: str
    newPassword: str

class PasswordReset(BaseModel):
    newPassword: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str

class SMTPSettings(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    fromEmail: Optional[str] = None
    encryption: Optional[str] = "TLS"

class MondaySettings(BaseModel):
    apiToken: Optional[str] = None
    boardId: Optional[str] = None
    syncEnabled: Optional[bool] = False

class FieldVisibilityConfig(BaseModel):
    fieldId: str
    fieldName: str
    showInList: bool = True
    showInDetail: bool = True
    showInForm: bool = True

class ExportRequest(BaseModel):
    sendEmail: bool = False

class AssetFieldVisibilityUpdate(BaseModel):
    assetTypeId: str
    fields: List[Dict[str, Any]]

class EmployeeFieldVisibilityUpdate(BaseModel):
    fields: List[Dict[str, Any]]

# ============== HELPERS ==============

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

def backup_doc(doc):
    """Serialize for backup - preserves _id as string AND keeps assignedEmployeeId/assetTypeId as strings"""
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if hasattr(v, '__class__') and v.__class__.__name__ == 'ObjectId':
            result[k] = str(v)
        elif hasattr(v, 'isoformat'):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result

def serialize_docs(docs):
    """Convert list of MongoDB documents"""
    return [serialize_doc(doc) for doc in docs]

def active_asset_query(extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Match assets that are still in service.

    Older assets do not have lifecycleStatus yet, so missing status means active.
    """
    active_clause = {"$or": [{"lifecycleStatus": {"$exists": False}}, {"lifecycleStatus": "active"}]}
    if not extra:
        return active_clause
    return {"$and": [active_clause, extra]}

def disposed_asset_query(extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    disposed_clause = {"lifecycleStatus": "disposed"}
    if not extra:
        return disposed_clause
    return {"$and": [disposed_clause, extra]}

def parse_subscription_date(value) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except Exception:
            return None

def add_months_safely(date_value, months: int):
    month_index = date_value.month - 1 + months
    year = date_value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(date_value.day, calendar.monthrange(year, month)[1])
    return date_value.replace(year=year, month=month, day=day)

def add_subscription_cycle(date_value, billing_cycle: str):
    cycle = (billing_cycle or "").strip().lower()
    if cycle == "per month":
        return add_months_safely(date_value, 1)
    if cycle == "per year":
        return add_months_safely(date_value, 12)
    return None

def is_auto_recurring_subscription(sub: Dict[str, Any]) -> bool:
    return (sub.get("autopay") or "").strip().lower() == "auto" and (sub.get("billingCycle") or "").strip().lower() in {"per month", "per year"}

def is_recurring_subscription(sub: Dict[str, Any]) -> bool:
    return (sub.get("billingCycle") or "").strip().lower() in {"per month", "per year"}

async def get_subscription_warning_days() -> int:
    app_settings = await settings_collection.find_one({"type": "app"}) or {}
    raw = app_settings.get("subscriptionWarningDays", app_settings.get("expiryWarningDays", 7))
    try:
        days = int(raw)
    except Exception:
        days = 7
    return max(1, min(days, 7))

def strip_subscription_computed_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    computed_keys = {
        "id", "_id", "renewalStatus", "renewalStatusLabel", "daysUntilRenewal",
        "isAutoRecurring", "needsManualRenewal", "subscriptionWarningDays",
    }
    return {k: v for k, v in data.items() if k not in computed_keys}

async def normalize_subscription_renewal(sub: Dict[str, Any], warning_days: Optional[int] = None) -> Dict[str, Any]:
    """Decorate subscriptions with renewal state and roll auto-pay renewals forward."""
    if not sub:
        return sub

    if warning_days is None:
        warning_days = await get_subscription_warning_days()

    today = datetime.now(timezone.utc).date()
    renewal_date = parse_subscription_date(sub.get("renewalDate"))
    is_auto = is_auto_recurring_subscription(sub)
    is_recurring = is_recurring_subscription(sub)

    sub["isAutoRecurring"] = is_auto
    sub["subscriptionWarningDays"] = warning_days
    sub["daysUntilRenewal"] = (renewal_date - today).days if renewal_date else None
    sub["needsManualRenewal"] = False
    sub["renewalStatus"] = "active"
    sub["renewalStatusLabel"] = "Active"

    if not renewal_date:
        return sub

    if is_auto:
        if renewal_date < today:
            next_date = renewal_date
            for _ in range(240):
                next_cycle = add_subscription_cycle(next_date, sub.get("billingCycle"))
                if not next_cycle:
                    break
                next_date = next_cycle
                if next_date >= today:
                    break

            if next_date >= today and next_date != renewal_date:
                next_date_string = next_date.isoformat()
                now = datetime.now(timezone.utc)
                await subscriptions_collection.update_one(
                    {"_id": sub["_id"]},
                    {
                        "$set": {
                            "renewalDate": next_date_string,
                            "lastAutoRenewedAt": now,
                            "updatedAt": now,
                        }
                    },
                )
                sub["renewalDate"] = next_date_string
                sub["lastAutoRenewedAt"] = now
                sub["updatedAt"] = now
                renewal_date = next_date

        sub["daysUntilRenewal"] = (renewal_date - today).days
        sub["renewalStatus"] = "auto_renewing"
        sub["renewalStatusLabel"] = "Auto-renewing"
        sub["needsManualRenewal"] = False
        return sub

    days_until = (renewal_date - today).days
    sub["daysUntilRenewal"] = days_until
    if days_until < 0:
        sub["renewalStatus"] = "expired"
        sub["renewalStatusLabel"] = "Renewal required" if is_recurring else "Expired"
        sub["needsManualRenewal"] = is_recurring
    elif days_until <= warning_days:
        sub["renewalStatus"] = "expiring_soon"
        sub["renewalStatusLabel"] = "Renewal due soon" if is_recurring else "Expiring soon"
        sub["needsManualRenewal"] = is_recurring
    return sub

async def normalize_subscriptions(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    warning_days = await get_subscription_warning_days()
    return [await normalize_subscription_renewal(doc, warning_days) for doc in docs]

async def get_user_preferences(user_id: str) -> Dict[str, Any]:
    user = await users_collection.find_one({"_id": ObjectId(user_id)}, {"preferences": 1})
    prefs = (user or {}).get("preferences") or {}
    return {
        "theme": prefs.get("theme") if prefs.get("theme") in {"light", "dark"} else None,
        "glassMode": prefs.get("glassMode") if isinstance(prefs.get("glassMode"), bool) else None,
        "accentColor": prefs.get("accentColor") if isinstance(prefs.get("accentColor"), str) else None,
        "musicPlayState": prefs.get("musicPlayState") if prefs.get("musicPlayState") in {"playing", "paused"} else "playing",
    }

def normalize_user_preferences(data: Dict[str, Any]) -> Dict[str, Any]:
    allowed = {}
    if data.get("theme") in {"light", "dark"}:
        allowed["preferences.theme"] = data["theme"]
    if isinstance(data.get("glassMode"), bool):
        allowed["preferences.glassMode"] = data["glassMode"]
    if isinstance(data.get("accentColor"), str):
        color = data["accentColor"].strip()
        if color.startswith("#") and len(color) == 7:
            allowed["preferences.accentColor"] = color
    if data.get("musicPlayState") in {"playing", "paused"}:
        allowed["preferences.musicPlayState"] = data["musicPlayState"]
    return allowed

def serialize_music_track(track):
    """Return music metadata without exposing storage internals."""
    track_id = str(track["_id"])
    return {
        "id": track_id,
        "name": track.get("name") or track.get("filename") or "Untitled track",
        "filename": track.get("filename", ""),
        "contentType": track.get("contentType", "audio/mpeg"),
        "size": track.get("size", 0),
        "createdAt": track.get("createdAt"),
        "updatedAt": track.get("updatedAt"),
        "streamUrl": f"/api/music/{track_id}/stream"
    }

def serialize_vehicle_file(file_doc):
    """Return vehicle file metadata with a browser-loadable URL."""
    file_id = str(file_doc["_id"])
    return {
        "id": file_id,
        "fileId": file_id,
        "filename": file_doc.get("filename", ""),
        "contentType": file_doc.get("contentType", "application/octet-stream"),
        "size": file_doc.get("size", 0),
        "kind": file_doc.get("kind", "field"),
        "url": f"/api/vehicles/files/{file_id}",
        "createdAt": file_doc.get("createdAt"),
        "updatedAt": file_doc.get("updatedAt")
    }

def serialize_vehicle(vehicle):
    """Return a vehicle document in frontend-friendly shape."""
    vehicle_id = str(vehicle["_id"])
    image_file_id = vehicle.get("imageFileId")
    return {
        "id": vehicle_id,
        "name": vehicle.get("name", ""),
        "imageFileId": image_file_id,
        "imageUrl": f"/api/vehicles/files/{image_file_id}" if image_file_id else None,
        "fieldValues": vehicle.get("fieldValues", {}),
        "createdAt": vehicle.get("createdAt"),
        "updatedAt": vehicle.get("updatedAt"),
        "createdBy": vehicle.get("createdBy"),
        "updatedBy": vehicle.get("updatedBy")
    }

async def get_vehicle_fields_doc():
    settings = await settings_collection.find_one({"type": "vehicle_fields"})
    if not settings:
        settings = {
            "type": "vehicle_fields",
            "fields": [],
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await settings_collection.insert_one(settings)
    return settings

def normalize_vehicle_fields(fields):
    normalized = []
    for raw_field in fields or []:
        name = str(raw_field.get("name", "")).strip()
        if not name:
            continue
        field_type = raw_field.get("fieldType", "text")
        if field_type not in VEHICLE_FIELD_TYPES:
            field_type = "text"
        options = raw_field.get("options")
        if field_type == "select":
            options = [str(option).strip() for option in (options or []) if str(option).strip()]
        else:
            options = None
        normalized.append({
            "id": raw_field.get("id") or str(uuid.uuid4()),
            "name": name,
            "fieldType": field_type,
            "required": bool(raw_field.get("required", False)),
            "options": options,
            "showInPreview": bool(raw_field.get("showInPreview", False)),
            "showInDetail": raw_field.get("showInDetail", True) is not False,
            "showInForm": raw_field.get("showInForm", True) is not False,
            "createdAt": raw_field.get("createdAt") or datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        })
    return normalized

async def validate_vehicle_payload(name: Optional[str], image_file_id: Optional[str], field_values: Optional[Dict[str, Any]], partial: bool = False):
    clean_name = str(name or "").strip() if name is not None else None
    if not partial and not clean_name:
        raise HTTPException(status_code=400, detail="Vehicle name is required")
    if clean_name is not None and not clean_name:
        raise HTTPException(status_code=400, detail="Vehicle name is required")

    if not partial and not image_file_id:
        raise HTTPException(status_code=400, detail="Vehicle PNG image is required")
    if image_file_id:
        try:
            file_doc = await vehicle_files_collection.find_one({"_id": ObjectId(image_file_id), "kind": "hero"})
        except Exception:
            file_doc = None
        if not file_doc:
            raise HTTPException(status_code=400, detail="Vehicle image must be an uploaded PNG vehicle file")

    vehicle_fields = (await get_vehicle_fields_doc()).get("fields", [])
    values = field_values or {}
    for field in vehicle_fields:
        field_id = field.get("id")
        if not field_id:
            continue
        value = values.get(field_id)
        if field.get("required") and (value is None or value == "" or value == []):
            raise HTTPException(status_code=400, detail=f"{field.get('name')} is required")
        if value in (None, ""):
            continue
        if field.get("fieldType") == "select":
            options = field.get("options") or []
            if options and value not in options:
                raise HTTPException(status_code=400, detail=f"{field.get('name')} has an invalid option")
        if field.get("fieldType") == "image":
            file_id = value.get("fileId") if isinstance(value, dict) else value
            try:
                attachment = await vehicle_files_collection.find_one({"_id": ObjectId(file_id), "kind": "field"})
            except Exception:
                attachment = None
            if not attachment:
                raise HTTPException(status_code=400, detail=f"{field.get('name')} must be an uploaded vehicle document image")

    return clean_name

async def get_music_settings_doc():
    settings = await settings_collection.find_one({"type": "music"})
    if not settings:
        settings = {
            "type": "music",
            "enabled": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
        await settings_collection.insert_one(settings)
    return settings

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 7 * 24 * 60 * 60  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def format_datetime(dt):
    """Format datetime to 'Feb 16, 2026 – 02:35 PM' format in UAE time (UTC+4)"""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
    from datetime import timedelta, timezone as tz
    uae_tz = tz(timedelta(hours=4))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz.utc)
    dt_uae = dt.astimezone(uae_tz)
    return dt_uae.strftime("%b %d, %Y – %I:%M %p")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(user: dict):
    """Allow SUPER_ADMIN and ADMIN roles"""
    if user["role"] not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin access required")

def require_super_admin(user: dict):
    """Only SUPER_ADMIN role"""
    if user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super admin access required")

def require_write_access(user: dict):
    """Allow SUPER_ADMIN and ADMIN (not USER)"""
    if user["role"] not in ["SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Write access required")

async def send_email(smtp_settings: dict, to_email: str, subject: str, html_content: str, attachment=None, attachment_name=None):
    """Send email using configured SMTP settings"""
    try:
        msg = MIMEMultipart('mixed')
        msg['Subject'] = subject
        msg['From'] = smtp_settings.get('fromEmail')
        msg['To'] = to_email
        
        # Add HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Add attachment if provided
        if attachment and attachment_name:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment)
            encoders.encode_base64(part)
            part.add_header('Content-Disposition', f'attachment; filename="{attachment_name}"')
            msg.attach(part)
        
        if smtp_settings.get('encryption') == 'SSL':
            server = smtplib.SMTP_SSL(smtp_settings['host'], smtp_settings.get('port', 465))
        else:
            server = smtplib.SMTP(smtp_settings['host'], smtp_settings.get('port', 587))
            if smtp_settings.get('encryption') == 'TLS':
                server.starttls()
        
        server.login(smtp_settings['username'], smtp_settings['password'])
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Email send error: {str(e)}")
        return False

# ============== MONDAY.COM FUNCTIONS ==============

async def monday_api_call(api_token: str, query: str, variables: dict = None):
    """Make a Monday.com API call with rate limit handling"""
    import asyncio
    
    url = "https://api.monday.com/v2"
    headers = {
        "Authorization": api_token,
        "Content-Type": "application/json",
        "API-Version": "2024-01"
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    
    max_retries = 3
    for attempt in range(max_retries):
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(url, json=payload, headers=headers, timeout=30.0)
            result = response.json()
            
            # Check for rate limit error
            if "errors" in result:
                error_msg = str(result["errors"])
                if "Complexity budget exhausted" in error_msg or "rate limit" in error_msg.lower():
                    # Extract wait time or default to 10 seconds
                    wait_time = 10
                    if attempt < max_retries - 1:
                        print(f"Rate limited, waiting {wait_time} seconds... (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                        continue
            
            # Add a small delay between calls to stay gentle with Monday rate limits.
            await asyncio.sleep(0.15)
            return result
    
    return result

MONDAY_EMPLOYEE_GROUP_TITLE = "Assets"
MONDAY_EMPLOYEE_NAME_COLUMN = "Employee Name"
MONDAY_ASSET_COUNT_COLUMN = "Number Of Assets"
MONDAY_ROW_PARALLEL_LIMIT = 8
MONDAY_ASSET_TYPE_ORDER = {
    "laptop": 0,
    "mobile": 1,
    "mobile phone": 1,
    "phone": 1,
    "monitor": 2,
    "mouse": 3,
    "keyboard": 4,
    "cpu": 5,
    "processor": 5,
}


def _monday_asset_column_title(asset_type_name: str) -> str:
    title = str(asset_type_name or "Unknown Asset Type").strip() or "Unknown Asset Type"
    core_titles = {"name", MONDAY_EMPLOYEE_NAME_COLUMN, MONDAY_ASSET_COUNT_COLUMN}
    if title.lower() in {t.lower() for t in core_titles}:
        return f"{title} Assets"
    return title


def _build_monday_asset_column_titles(asset_types: list) -> dict:
    titles_by_type_id = {}
    used_titles = {MONDAY_EMPLOYEE_NAME_COLUMN.lower(), MONDAY_ASSET_COUNT_COLUMN.lower(), "name"}

    def sort_key(asset_type):
        name = str(asset_type.get("name", "")).strip().lower()
        return (MONDAY_ASSET_TYPE_ORDER.get(name, 100), str(asset_type.get("createdAt", "")), name)

    for asset_type in sorted(asset_types, key=sort_key):
        type_id = str(asset_type.get("_id", ""))
        base_title = _monday_asset_column_title(asset_type.get("name", "Unknown Asset Type"))
        title = base_title
        suffix = 2
        while title.lower() in used_titles:
            title = f"{base_title} {suffix}"
            suffix += 1
        used_titles.add(title.lower())
        titles_by_type_id[type_id] = title

    return titles_by_type_id


def _monday_asset_model_number(asset: dict, asset_type: Optional[dict]) -> str:
    field_values = asset.get("fieldValues") or {}
    fields = asset_type.get("fields", []) if asset_type else []

    for field in fields:
        if field.get("name") == "Model Number":
            value = field_values.get(field.get("id"))
            if value not in (None, ""):
                return str(value).strip()

    for field in fields:
        if "model" in str(field.get("name", "")).lower():
            value = field_values.get(field.get("id"))
            if value not in (None, ""):
                return str(value).strip()

    return "No model number"


async def _ensure_monday_employee_asset_matrix(api_token: str, board_id: str, asset_types: list):
    import asyncio
    import json as json_lib

    query = f'query {{ boards(ids: {board_id}) {{ groups {{ id title }} columns {{ id title type }} }} }}'
    result = await monday_api_call(api_token, query)
    if "errors" in result:
        return {"success": False, "message": result["errors"][0].get("message", "API error")}

    boards = result.get("data", {}).get("boards", [])
    if not boards:
        return {"success": False, "message": "Board not found or access denied"}

    board_data = boards[0]
    existing_groups = {g["title"]: g["id"] for g in board_data.get("groups", [])}
    existing_columns = {c["title"]: c for c in board_data.get("columns", [])}

    if MONDAY_EMPLOYEE_GROUP_TITLE not in existing_groups:
        group_result = await monday_api_call(
            api_token,
            f'mutation {{ create_group(board_id: {board_id}, group_name: {json_lib.dumps(MONDAY_EMPLOYEE_GROUP_TITLE)}) {{ id }} }}'
        )
        if "errors" in group_result:
            return {"success": False, "message": group_result["errors"][0].get("message", "Failed to create group")}
        group_id = group_result.get("data", {}).get("create_group", {}).get("id")
    else:
        group_id = existing_groups[MONDAY_EMPLOYEE_GROUP_TITLE]

    if group_id:
        await monday_api_call(
            api_token,
            f'mutation {{ update_group(board_id: {board_id}, group_id: {json_lib.dumps(group_id)}, group_attribute: color, new_value: "dark-blue") {{ id }} }}'
        )

    asset_column_titles = _build_monday_asset_column_titles(asset_types)
    asset_titles_in_order = list(asset_column_titles.values())
    desired_columns = [
        (MONDAY_EMPLOYEE_NAME_COLUMN, "text"),
        (MONDAY_ASSET_COUNT_COLUMN, "numbers"),
        *[(title, "text") for title in asset_titles_in_order],
    ]

    existing_asset_titles = [c["title"] for c in board_data.get("columns", []) if c["title"] in set(asset_titles_in_order)]
    if existing_asset_titles and existing_asset_titles != asset_titles_in_order:
        for col in board_data.get("columns", []):
            if col["title"] in set(asset_titles_in_order):
                delete_result = await monday_api_call(
                    api_token,
                    f'mutation {{ delete_column(board_id: {board_id}, column_id: {json_lib.dumps(col["id"])}) {{ id }} }}'
                )
                if "errors" in delete_result:
                    return {
                        "success": False,
                        "message": delete_result["errors"][0].get("message", f"Failed to reorder {col['title']} column")
                    }
                await asyncio.sleep(0.1)

        refresh_existing = await monday_api_call(api_token, query)
        if "errors" in refresh_existing:
            return {"success": False, "message": refresh_existing["errors"][0].get("message", "Failed to refresh columns")}
        board_data = refresh_existing.get("data", {}).get("boards", [{}])[0]
        existing_columns = {c["title"]: c for c in board_data.get("columns", [])}

    created_columns = []
    previous_column_id = next((c.get("id") for c in board_data.get("columns", []) if c.get("id") == "name"), None)
    for title, column_type in desired_columns:
        if title not in existing_columns:
            after_part = f', after_column_id: {json_lib.dumps(previous_column_id)}' if previous_column_id else ""
            create_result = await monday_api_call(
                api_token,
                f'mutation {{ create_column(board_id: {board_id}, title: {json_lib.dumps(title)}, column_type: {column_type}{after_part}) {{ id title type }} }}'
            )
            if "errors" in create_result:
                return {"success": False, "message": create_result["errors"][0].get("message", f"Failed to create {title} column")}
            created_columns.append(title)
            created_column = create_result.get("data", {}).get("create_column", {})
            previous_column_id = created_column.get("id") or previous_column_id
            await asyncio.sleep(0.1)
        else:
            previous_column_id = existing_columns[title].get("id") or previous_column_id

    refresh_result = await monday_api_call(api_token, f'query {{ boards(ids: {board_id}) {{ columns {{ id title type }} }} }}')
    if "errors" in refresh_result:
        return {"success": False, "message": refresh_result["errors"][0].get("message", "Failed to refresh columns")}

    fresh_columns = refresh_result.get("data", {}).get("boards", [{}])[0].get("columns", [])
    columns_by_title = {c["title"]: c["id"] for c in fresh_columns}

    return {
        "success": True,
        "groupId": group_id,
        "columns": columns_by_title,
        "assetColumnTitles": asset_column_titles,
        "createdColumns": created_columns,
    }


async def create_monday_board_structure(monday_settings: dict):
    """Prepare Monday board as an employee-by-asset-type matrix."""
    api_token = monday_settings.get('apiToken')
    board_id = monday_settings.get('boardId')
    
    if not api_token or not board_id:
        return {"success": False, "message": "API token or board ID not configured"}
    
    try:
        asset_types = await asset_types_collection.find({}).to_list(1000)
        structure = await _ensure_monday_employee_asset_matrix(str(api_token), str(board_id).strip(), asset_types)
        if not structure.get("success"):
            return structure

        created = structure.get("createdColumns", [])
        suffix = f" ({len(created)} columns added)" if created else ""
        return {
            "success": True,
            "message": f"Employee asset matrix ready{suffix}",
            "groupId": structure.get("groupId"),
            "createdColumns": created,
        }
    
    except Exception as e:
        return {"success": False, "message": str(e)}

ASSET_TYPE_COLORS = {
    "laptop":   "#0075ff",
    "mobile":   "#00c875",
    "tablet":   "#9cd326",
    "keyboard": "#fdab3d",
    "mouse":    "#e2445c",
    "monitor":  "#a25ddc",
    "gymbol":   "#ff642e",
    "gym":      "#ff642e",
    "default":  "#579bfc",
}

def get_asset_color(type_name: str) -> str:
    return ASSET_TYPE_COLORS.get(type_name.lower(), ASSET_TYPE_COLORS["default"])


async def sync_to_monday(monday_settings: dict):
    """Sync one Monday row per employee, with asset types as model-number columns."""
    import asyncio
    import json as json_lib
    try:
        api_token = monday_settings.get('apiToken')
        board_id = monday_settings.get('boardId')
        if not api_token or not board_id:
            return {"success": False, "message": "Not configured"}

        employees = await employees_collection.find({}).to_list(10000)
        all_asset_types = await asset_types_collection.find({}).to_list(1000)
        asset_types_map = {str(at["_id"]): at for at in all_asset_types}

        structure = await _ensure_monday_employee_asset_matrix(str(api_token), str(board_id).strip(), all_asset_types)
        if not structure.get("success"):
            return structure

        assets_group_id = structure["groupId"]
        columns = structure["columns"]
        asset_column_titles = structure["assetColumnTitles"]
        emp_name_col = columns.get(MONDAY_EMPLOYEE_NAME_COLUMN)
        num_assets_col = columns.get(MONDAY_ASSET_COUNT_COLUMN)
        if not emp_name_col or not num_assets_col:
            return {"success": False, "message": "Monday board is missing required employee columns"}

        asset_column_ids = {
            type_id: columns.get(title)
            for type_id, title in asset_column_titles.items()
            if columns.get(title)
        }

        all_assets = await assets_collection.find(active_asset_query({
            "assignedEmployeeId": {"$exists": True, "$nin": [None, ""]}
        })).to_list(10000)

        assets_by_employee = {}
        for a in all_assets:
            eid = a.get("assignedEmployeeId")
            if eid:
                assets_by_employee.setdefault(eid, []).append(a)

        existing_result = await monday_api_call(api_token,
            f'''query {{
              boards(ids: {board_id}) {{
                groups(ids: [{json_lib.dumps(assets_group_id)}]) {{
                  items_page(limit: 500) {{
                    items {{
                      id name
                      column_values {{ id text }}
                      subitems {{ id }}
                    }}
                  }}
                }}
              }}
            }}''')
        if "errors" in existing_result:
            return {"success": False, "message": existing_result["errors"][0].get("message", "Failed to read Monday items")}

        board_groups = existing_result.get("data", {}).get("boards", [{}])[0].get("groups", [])
        existing_items = board_groups[0].get("items_page", {}).get("items", []) if board_groups else []
        monday_map = {}
        for item in existing_items:
            col_map = {cv["id"]: cv["text"] for cv in item.get("column_values", [])}
            monday_map[item["name"]] = {
                "id": item["id"],
                "col_map": col_map,
                "subitems": item.get("subitems", [])
            }

        def build_employee_column_values(emp, emp_assets):
            grouped_models = {type_id: [] for type_id in asset_column_ids.keys()}
            for asset in emp_assets:
                type_id = str(asset.get("assetTypeId", ""))
                if type_id not in grouped_models:
                    continue
                asset_type = asset_types_map.get(type_id)
                grouped_models[type_id].append(_monday_asset_model_number(asset, asset_type))

            col_values = {
                emp_name_col: emp.get("name", "Unknown"),
                num_assets_col: len(emp_assets),
            }

            for type_id, col_id in asset_column_ids.items():
                models = sorted(grouped_models.get(type_id, []), key=lambda value: value.lower())
                col_values[col_id] = "\n".join(models)

            return col_values

        def monday_row_matches(existing_col_map, expected_values):
            for col_id, expected in expected_values.items():
                existing = existing_col_map.get(col_id, "")
                if str(existing or "") != str(expected or ""):
                    return False
            return True

        async def process_employee(emp):
            try:
                emp_id = str(emp["_id"])
                emp_employee_id = str(emp.get("employeeId") or emp_id)
                emp_assets = assets_by_employee.get(emp_id, [])
                col_values = build_employee_column_values(emp, emp_assets)

                if emp_employee_id in monday_map:
                    monday_item = monday_map[emp_employee_id]
                    subitems_deleted = 0
                    for subitem in monday_item.get("subitems", []):
                        delete_result = await monday_api_call(api_token, f'mutation {{ delete_item(item_id: {subitem["id"]}) {{ id }} }}')
                        if "errors" not in delete_result:
                            subitems_deleted += 1

                    if not monday_row_matches(monday_item["col_map"], col_values):
                        await monday_api_call(api_token, f'''mutation {{
                          change_multiple_column_values(
                            item_id: {monday_item["id"]},
                            board_id: {board_id},
                            column_values: {json_lib.dumps(json_lib.dumps(col_values))}
                          ) {{ id }}
                        }}''')
                        return {"created": 0, "updated": 1, "skipped": 0, "error": None, "subitemsDeleted": subitems_deleted}
                    return {"created": 0, "updated": 0, "skipped": 1, "error": None, "subitemsDeleted": subitems_deleted}

                else:
                    item_result = await monday_api_call(api_token, f'''mutation {{
                      create_item(
                        board_id: {board_id},
                        group_id: {json_lib.dumps(assets_group_id)},
                        item_name: {json_lib.dumps(emp_employee_id)},
                        column_values: {json_lib.dumps(json_lib.dumps(col_values))}
                      ) {{ id }}
                    }}''')
                    if "errors" in item_result:
                        return {"created": 0, "updated": 0, "skipped": 0, "error": f"{emp_employee_id}: {item_result['errors']}", "subitemsDeleted": 0}
                    if not item_result.get("data", {}).get("create_item", {}).get("id"):
                        return {"created": 0, "updated": 0, "skipped": 0, "error": f"{emp_employee_id}: Failed to create", "subitemsDeleted": 0}
                    return {"created": 1, "updated": 0, "skipped": 0, "error": None, "subitemsDeleted": 0}

            except Exception as e:
                import traceback; traceback.print_exc()
                return {"created": 0, "updated": 0, "skipped": 0, "error": f"{emp.get('employeeId', '?')}: {str(e)}", "subitemsDeleted": 0}

        row_semaphore = asyncio.Semaphore(MONDAY_ROW_PARALLEL_LIMIT)

        async def limited_process_employee(emp):
            async with row_semaphore:
                return await process_employee(emp)

        print(f"Syncing {len(employees)} employee rows to Monday asset matrix...")
        employee_results = await asyncio.gather(*(limited_process_employee(emp) for emp in employees))

        created_count = sum(r["created"] for r in employee_results)
        updated_count = sum(r["updated"] for r in employee_results)
        skipped_count = sum(r["skipped"] for r in employee_results)
        subitems_deleted = sum(r["subitemsDeleted"] for r in employee_results)
        errors = [r["error"] for r in employee_results if r.get("error")]
        our_emp_ids = {str(emp.get("employeeId") or str(emp["_id"])) for emp in employees}

        for monday_emp_id, monday_item in monday_map.items():
            if monday_emp_id not in our_emp_ids:
                await monday_api_call(api_token, f'mutation {{ delete_item(item_id: {monday_item["id"]}) {{ id }} }}')
                print(f"Deleted removed employee: {monday_emp_id}")

        await settings_collection.update_one(
            {"type": "monday"},
            {"$set": {"lastSyncAt": datetime.now(timezone.utc)}}
        )
        message = f"Sync complete: {created_count} created, {updated_count} updated, {skipped_count} unchanged"
        if subitems_deleted:
            message += f", {subitems_deleted} legacy subitems removed"
        if errors:
            message += f" ({len(errors)} errors)"
        print(message)
        return {"success": True, "message": message, "errors": errors if errors else None}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}


async def _create_subitem(api_token, parent_item_id, counter, type_name, model, subitem_board_id, subitem_columns, json_lib):
    """Helper to create a subitem and return updated board info"""
    import asyncio
    if not subitem_board_id:
        sub_mut = f'''mutation {{
          create_subitem(parent_item_id: {parent_item_id}, item_name: "{counter}") {{
            id board {{ id columns {{ id title }} }}
          }}
        }}'''
        sub_r = await monday_api_call(api_token, sub_mut)
        if "errors" in sub_r:
            return None, subitem_board_id, subitem_columns
        sub_data = sub_r.get("data", {}).get("create_subitem", {})
        sub_id = sub_data.get("id")
        sub_board = sub_data.get("board", {})
        subitem_board_id = sub_board.get("id")
        raw_cols = {c["title"]: c["id"] for c in sub_board.get("columns", [])}
        if "Assets Type" not in raw_cols and subitem_board_id:
            r = await monday_api_call(api_token, f'mutation {{ create_column(board_id: {subitem_board_id}, title: "Assets Type", column_type: text) {{ id }} }}')
            cid = r.get("data", {}).get("create_column", {}).get("id")
            if cid: raw_cols["Assets Type"] = cid
        if "Model Number" not in raw_cols and subitem_board_id:
            r = await monday_api_call(api_token, f'mutation {{ create_column(board_id: {subitem_board_id}, title: "Model Number", column_type: text) {{ id }} }}')
            cid = r.get("data", {}).get("create_column", {}).get("id")
            if cid: raw_cols["Model Number"] = cid
        if "Asset Color" not in raw_cols and subitem_board_id:
            r = await monday_api_call(api_token, f'mutation {{ create_column(board_id: {subitem_board_id}, title: "Asset Color", column_type: color_picker) {{ id }} }}')
            cid = r.get("data", {}).get("create_column", {}).get("id")
            if cid: raw_cols["Asset Color"] = cid
        await asyncio.sleep(0.2)
        refresh = await monday_api_call(api_token, f'query {{ boards(ids: {subitem_board_id}) {{ columns {{ id title }} }} }}')
        subitem_columns = {c["title"]: c["id"] for c in refresh.get("data", {}).get("boards", [{}])[0].get("columns", [])}
    else:
        sub_mut = f'mutation {{ create_subitem(parent_item_id: {parent_item_id}, item_name: "{counter}") {{ id }} }}'
        sub_r = await monday_api_call(api_token, sub_mut)
        if "errors" in sub_r:
            return None, subitem_board_id, subitem_columns
        sub_id = sub_r.get("data", {}).get("create_subitem", {}).get("id")

    if sub_id and subitem_board_id and subitem_columns:
        sub_col_vals = {}
        if "Assets Type" in subitem_columns:
            sub_col_vals[subitem_columns["Assets Type"]] = type_name
        if "Model Number" in subitem_columns:
            sub_col_vals[subitem_columns["Model Number"]] = model
        if "Asset Color" in subitem_columns:
            sub_col_vals[subitem_columns["Asset Color"]] = {"color": get_asset_color(type_name)}
        if sub_col_vals:
            scv_json = json_lib.dumps(sub_col_vals)
            await monday_api_call(api_token, f'''mutation {{
              change_multiple_column_values(item_id: {sub_id}, board_id: {subitem_board_id}, column_values: {json_lib.dumps(scv_json)}) {{ id }}
            }}''')
    return sub_id, subitem_board_id, subitem_columns

# ============== STARTUP ==============

@app.on_event("startup")
async def startup_event():
    """Initialize database with default data"""
    # Create indexes
    await users_collection.create_index("email", unique=True)
    await employees_collection.create_index("employeeId", unique=True)
    await assets_collection.create_index("assetTag", unique=True)
    await assets_collection.create_index("assignedEmployeeId")
    await assets_collection.create_index("assetTypeId")
    await transfers_collection.create_index("assetId")
    await transfers_collection.create_index("employeeId")
    await employees_collection.create_index("name")
    await asset_types_collection.create_index("name", unique=True)
    await music_tracks_collection.create_index("createdAt")
    await vehicles_collection.create_index("name")
    await vehicles_collection.create_index("createdAt")
    await vehicle_files_collection.create_index("createdAt")
    await vehicle_files_collection.create_index("kind")
    
    # Create default super admin if not exists
    admin = await users_collection.find_one({"email": "admin@local.internal"})
    if not admin:
        await users_collection.insert_one({
            "name": "Super Admin",
            "email": "admin@local.internal",
            "password": hash_password("Admin123!"),
            "role": "SUPER_ADMIN",
            "preferences": {"musicPlayState": "playing"},
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
        print("Created default SUPER_ADMIN: admin@local.internal / Admin123!")
    

    
    # Create default branding settings
    branding = await settings_collection.find_one({"type": "branding"})
    if not branding:
        await settings_collection.insert_one({
            "type": "branding",
            "appName": "AssetFlow",
            "loginTitle": "Welcome to AssetFlow",
            "headerText": "AssetFlow",
            "accentColor": "#4F46E5",
            "logoFileId": None,
            "faviconFileId": None,
            "loginBackgroundFileId": None,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    
    # Create default employee fields if not exists
    emp_fields = await settings_collection.find_one({"type": "employee_fields"})
    if not emp_fields:
        default_emp_fields = [
            {"id": str(uuid.uuid4()), "name": "Email", "fieldType": "email", "required": False, "showInList": True, "showInDetail": True, "showInForm": True},
            {"id": str(uuid.uuid4()), "name": "Department", "fieldType": "text", "required": False, "showInList": True, "showInDetail": True, "showInForm": True},
            {"id": str(uuid.uuid4()), "name": "Position", "fieldType": "text", "required": False, "showInList": True, "showInDetail": True, "showInForm": True},
            {"id": str(uuid.uuid4()), "name": "Phone", "fieldType": "phone", "required": False, "showInList": False, "showInDetail": True, "showInForm": True},
        ]
        await settings_collection.insert_one({
            "type": "employee_fields",
            "fields": default_emp_fields,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    
    # Create default app settings
    app_settings = await settings_collection.find_one({"type": "app"})
    if not app_settings:
        await settings_collection.insert_one({
            "type": "app",
            "dashboardPreviewMax": 5,
            "subscriptionWarningDays": 7,
            "accentColor": "#4F46E5",
            "wallpaperFileId": None,
            "glassMode": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    else:
        app_defaults = {}
        if "glassMode" not in app_settings:
            app_defaults["glassMode"] = False
        if "subscriptionWarningDays" not in app_settings:
            app_defaults["subscriptionWarningDays"] = int(app_settings.get("expiryWarningDays", 7) or 7)
        if app_defaults:
            app_defaults["updatedAt"] = datetime.now(timezone.utc)
            await settings_collection.update_one({"type": "app"}, {"$set": app_defaults})

    # Create default music player settings
    music_settings = await settings_collection.find_one({"type": "music"})
    if not music_settings:
        await settings_collection.insert_one({
            "type": "music",
            "enabled": False,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })

    vehicle_fields = await settings_collection.find_one({"type": "vehicle_fields"})
    if not vehicle_fields:
        await settings_collection.insert_one({
            "type": "vehicle_fields",
            "fields": [],
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        })
    
    # Start scheduler for Monday.com sync
    scheduler.start()
    print("Scheduler started")
    
    print("Database initialized")

# ============== AUTH ENDPOINTS ==============

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/auth/login")
async def login(data: LoginRequest):
    user = await users_collection.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(str(user["_id"]), user["role"])
    preferences = await get_user_preferences(str(user["_id"]))
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "preferences": preferences,
        }
    }

@app.get("/api/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    preferences = await get_user_preferences(user["id"])
    return {"user": {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "preferences": preferences,
    }}

@app.get("/api/users/me/preferences")
async def get_my_preferences(user: dict = Depends(get_current_user)):
    preferences = await get_user_preferences(user["id"])
    app_settings = await settings_collection.find_one({"type": "app"}) or {}
    return {
        **preferences,
        "accentColor": preferences.get("accentColor") or app_settings.get("accentColor", "#4F46E5"),
        "glassMode": preferences.get("glassMode") if preferences.get("glassMode") is not None else bool(app_settings.get("glassMode", False)),
        "globalAccentColor": app_settings.get("accentColor", "#4F46E5"),
        "globalGlassMode": bool(app_settings.get("glassMode", False)),
        "wallpaperFileId": app_settings.get("wallpaperFileId"),
    }

@app.put("/api/users/me/preferences")
async def update_my_preferences(data: dict, user: dict = Depends(get_current_user)):
    update_data = normalize_user_preferences(data)
    if not update_data:
        return await get_my_preferences(user)
    update_data["updatedAt"] = datetime.now(timezone.utc)
    await users_collection.update_one({"_id": ObjectId(user["id"])}, {"$set": update_data})
    return await get_my_preferences(user)

@app.post("/api/auth/change-password")
async def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    db_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(data.oldPassword, db_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await users_collection.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password": hash_password(data.newPassword), "updatedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Password changed successfully"}

@app.post("/api/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Initiate password reset - send reset email"""
    user = await users_collection.find_one({"email": data.email})
    if not user:
        return {"message": "If the email exists, a reset link will be sent"}
    
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await reset_tokens_collection.insert_one({
        "userId": str(user["_id"]),
        "token": reset_token,
        "expiresAt": expires_at,
        "used": False,
        "createdAt": datetime.now(timezone.utc)
    })
    
    smtp_settings_doc = await settings_collection.find_one({"type": "smtp"})
    if smtp_settings_doc and smtp_settings_doc.get('host'):
        branding = await settings_collection.find_one({"type": "branding"})
        app_name = branding.get('appName', 'AssetFlow') if branding else 'AssetFlow'
        
        reset_url = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password for {app_name}.</p>
                <p>Click the link below to reset your password:</p>
                <p><a href="{reset_url}" style="padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
            </body>
        </html>
        """
        
        await send_email(
            smtp_settings_doc,
            data.email,
            f"Password Reset - {app_name}",
            html_content
        )
    
    return {"message": "If the email exists, a reset link will be sent"}

@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset password using token"""
    token_doc = await reset_tokens_collection.find_one({
        "token": data.token,
        "used": False,
        "expiresAt": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    await users_collection.update_one(
        {"_id": ObjectId(token_doc["userId"])},
        {"$set": {"password": hash_password(data.newPassword), "updatedAt": datetime.now(timezone.utc)}}
    )
    
    await reset_tokens_collection.update_one(
        {"_id": token_doc["_id"]},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

# ============== DATABASE STATUS ENDPOINT ==============

@app.get("/api/settings/database-status")
async def get_database_status(user: dict = Depends(get_current_user)):
    """Get real-time database connection status"""
    require_super_admin(user)
    
    start_time = time.time()
    try:
        # Perform a ping to check connection
        await db.command("ping")
        latency_ms = round((time.time() - start_time) * 1000, 2)
        
        # Get database info
        server_info = await client.server_info()
        
        # Mask connection string
        masked_url = MONGODB_URI
        if "@" in MONGODB_URI:
            # Mask password in connection string
            parts = MONGODB_URI.split("@")
            prefix = parts[0].rsplit(":", 1)[0] + ":****@"
            masked_url = prefix + parts[1]
        
        return {
            "status": "connected",
            "databaseType": "MongoDB",
            "version": server_info.get("version", "Unknown"),
            "connectionString": masked_url,
            "databaseName": DB_NAME,
            "latencyMs": latency_ms,
            "error": None
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "disconnected",
            "databaseType": "MongoDB",
            "version": None,
            "connectionString": "****",
            "databaseName": DB_NAME,
            "latencyMs": latency_ms,
            "error": str(e)
        }

@app.post("/api/settings/database-status/test")
async def test_database_connection(user: dict = Depends(get_current_user)):
    """Test database connection manually"""
    require_super_admin(user)
    
    start_time = time.time()
    try:
        await db.command("ping")
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "connected",
            "latencyMs": latency_ms,
            "message": "Database connection successful"
        }
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "disconnected",
            "latencyMs": latency_ms,
            "message": str(e)
        }



# ============== HIKVISION INTEGRATION ==============

async def hikvision_request(host: str, username: str, password: str, method: str, path: str, body: dict = None):
    """Make a Hikvision ISAPI request using HTTP Digest Auth"""
    import httpx
    from httpx import DigestAuth
    host = host.rstrip("/")
    url = f"http://{host}{path}"
    auth = DigestAuth(username, password)
    async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
        if method == "GET":
            response = await client.get(url, auth=auth)
        else:
            response = await client.post(url, json=body, auth=auth)
        response.raise_for_status()
        return response

async def hikvision_sync_employees(hik_settings: dict):
    """Pull employees from Hikvision device and save to MongoDB"""
    import httpx
    from httpx import DigestAuth
    import json as json_lib

    host = hik_settings.get("host")
    username = hik_settings.get("username", "admin")
    password = hik_settings.get("password")

    if not host or not password:
        return {"success": False, "message": "Not configured"}

    created = 0
    skipped = 0
    with_photo = 0
    errors = []

    try:
        # Fetch all employees from device using ISAPI
        search_body = {
            "UserInfoSearchCond": {
                "searchID": "1",
                "searchResultPosition": 0,
                "maxResults": 1000
            }
        }
        auth = DigestAuth(username, password)
        host = host.rstrip("/")
        url = f"http://{host}/ISAPI/AccessControl/UserInfo/Search?format=json"
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            resp = await client.post(url, json=search_body, auth=auth)
            resp.raise_for_status()
            data = resp.json()

        user_list = data.get("UserInfoSearch", {}).get("UserInfo", [])
        if not user_list:
            return {"success": True, "message": "No employees found on device", "created": 0, "skipped": 0, "withPhoto": 0}

        for user in user_list:
            emp_id = str(user.get("employeeNo", "")).strip()
            name = str(user.get("name", "")).strip()
            if not emp_id or not name:
                continue

            # Check if already exists
            existing = await employees_collection.find_one({"employeeId": emp_id})
            if existing:
                skipped += 1
                continue

            # Try to fetch face photo
            photo_file_id = None
            try:
                pic_url = f"http://{host}/ISAPI/AccessControl/face/faceDataRecord/{emp_id}?format=json"
                async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                    pic_resp = await client.get(pic_url, auth=auth)
                    if pic_resp.status_code == 200 and pic_resp.headers.get("content-type", "").startswith("image"):
                        photo_bytes = pic_resp.content
                        file_doc = {
                            "filename": f"face_{emp_id}.jpg",
                            "contentType": "image/jpeg",
                            "size": len(photo_bytes),
                            "data": base64.b64encode(photo_bytes).decode(),
                            "uploadedBy": "hikvision-sync",
                            "createdAt": datetime.now(timezone.utc)
                        }
                        file_result = await files_collection.insert_one(file_doc)
                        photo_file_id = str(file_result.inserted_id)
                        with_photo += 1
            except Exception:
                pass  # Photo optional — don't fail if it errors

            # Create employee
            new_employee = {
                "employeeId": emp_id,
                "name": name,
                "fieldValues": {},
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
                "source": "hikvision",
            }
            if photo_file_id:
                new_employee["photoFileId"] = photo_file_id

            await employees_collection.insert_one(new_employee)
            created += 1

        # Update lastSyncAt
        await settings_collection.update_one(
            {"type": "hikvision"},
            {"$set": {"lastSyncAt": datetime.now(timezone.utc)}},
            upsert=True
        )

        return {
            "success": True,
            "message": f"Sync complete: {created} added, {skipped} already existed",
            "created": created,
            "skipped": skipped,
            "withPhoto": with_photo,
        }

    except Exception as e:
        import traceback; traceback.print_exc()
        return {"success": False, "message": str(e)}


@app.get("/api/settings/hikvision")
async def get_hikvision_settings(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    doc = await settings_collection.find_one({"type": "hikvision"})
    if not doc:
        return {"host": "", "username": "admin", "syncEnabled": False, "hasPassword": False, "lastSyncAt": None}
    return {
        "host": doc.get("host", ""),
        "username": doc.get("username", "admin"),
        "password": "••••••••..." if doc.get("password") else "",
        "syncEnabled": doc.get("syncEnabled", False),
        "hasPassword": bool(doc.get("password")),
        "lastSyncAt": doc.get("lastSyncAt"),
    }


@app.put("/api/settings/hikvision")
async def update_hikvision_settings(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    update = {
        "type": "hikvision",
        "host": data.get("host", ""),
        "username": data.get("username", "admin"),
        "syncEnabled": data.get("syncEnabled", False),
    }
    if data.get("password") and "..." not in data["password"]:
        update["password"] = data["password"]
    await settings_collection.update_one({"type": "hikvision"}, {"$set": update}, upsert=True)
    doc = await settings_collection.find_one({"type": "hikvision"})
    return {
        "host": doc.get("host", ""),
        "username": doc.get("username", "admin"),
        "syncEnabled": doc.get("syncEnabled", False),
        "hasPassword": bool(doc.get("password")),
        "lastSyncAt": doc.get("lastSyncAt"),
    }


@app.post("/api/settings/hikvision/test")
async def test_hikvision_connection(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    import httpx
    from httpx import DigestAuth

    doc = await settings_collection.find_one({"type": "hikvision"})
    if not doc or not doc.get("host") or not doc.get("password"):
        return {"status": "not_configured", "message": "Hikvision not configured"}

    try:
        auth = DigestAuth(doc["username"], doc["password"])
        url = f"http://{doc['host']}/ISAPI/System/deviceInfo"
        async with httpx.AsyncClient(verify=False, timeout=8.0) as client:
            resp = await client.get(url, auth=auth)
            resp.raise_for_status()
            # Parse device name from XML response
            import re
            device_name = "Hikvision Device"
            match = re.search(r"<deviceName>(.*?)</deviceName>", resp.text)
            if match:
                device_name = match.group(1)
            return {"status": "connected", "deviceName": device_name}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/settings/hikvision/sync")
async def trigger_hikvision_sync(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    doc = await settings_collection.find_one({"type": "hikvision"})
    if not doc or not doc.get("host"):
        raise HTTPException(status_code=400, detail="Hikvision not configured")
    result = await hikvision_sync_employees(doc)
    return result

# ============== USERS ENDPOINTS ==============

@app.get("/api/users")
async def get_users(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    users = await users_collection.find({}, {"password": 0}).to_list(1000)
    return serialize_docs(users)

@app.get("/api/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    db_user = await users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_doc(db_user)

@app.post("/api/users")
async def create_user(data: UserCreate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    # Validate role
    if data.role not in ["SUPER_ADMIN", "ADMIN", "USER"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be SUPER_ADMIN, ADMIN, or USER")
    
    existing = await users_collection.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    new_user = {
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "role": data.role,
        "preferences": {"musicPlayState": "playing"},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    result = await users_collection.insert_one(new_user)
    new_user["_id"] = result.inserted_id
    del new_user["password"]
    return serialize_doc(new_user)

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Validate role if provided
    if "role" in update_data and update_data["role"] not in ["SUPER_ADMIN", "ADMIN", "USER"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be SUPER_ADMIN, ADMIN, or USER")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    if "email" in update_data:
        existing = await users_collection.find_one({"email": update_data["email"], "_id": {"$ne": ObjectId(user_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
    
    await users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    updated = await users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    return serialize_doc(updated)

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@app.post("/api/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: PasswordReset, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hash_password(data.newPassword), "updatedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Password reset successfully"}

# ============== EMPLOYEES ENDPOINTS ==============

@app.get("/api/employees")
async def get_employees(user: dict = Depends(get_current_user)):
    employees = await employees_collection.find({}).to_list(1000)
    result = []
    for emp in employees:
        emp_dict = serialize_doc(emp)
        asset_count = await assets_collection.count_documents(active_asset_query({"assignedEmployeeId": emp_dict["id"]}))
        emp_dict["_count"] = {"assets": asset_count}
        result.append(emp_dict)
    return result

@app.get("/api/employees/{employee_id}")
async def get_employee(employee_id: str, user: dict = Depends(get_current_user)):
    employee = await employees_collection.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_doc(employee)

@app.get("/api/employees/{employee_id}/assets")
async def get_employee_assets(employee_id: str, user: dict = Depends(get_current_user)):
    assets = await assets_collection.find(active_asset_query({"assignedEmployeeId": employee_id})).to_list(1000)
    result = []
    for asset in assets:
        asset_dict = serialize_doc(asset)
        if asset.get("assetTypeId"):
            asset_type = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
            asset_dict["assetType"] = serialize_doc(asset_type) if asset_type else None
        result.append(asset_dict)
    return result

@app.post("/api/employees")
async def create_employee(data: EmployeeCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    existing = await employees_collection.find_one({"employeeId": data.employeeId})
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID already exists")
    
    new_employee = {
        **data.dict(),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    result = await employees_collection.insert_one(new_employee)
    new_employee["_id"] = result.inserted_id
    return serialize_doc(new_employee)

@app.put("/api/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    if "employeeId" in update_data:
        existing = await employees_collection.find_one({"employeeId": update_data["employeeId"], "_id": {"$ne": ObjectId(employee_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Employee ID already exists")
    
    await employees_collection.update_one({"_id": ObjectId(employee_id)}, {"$set": update_data})
    updated = await employees_collection.find_one({"_id": ObjectId(employee_id)})
    return serialize_doc(updated)

@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    employee = await employees_collection.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee_name = employee["name"]
    
    await transfers_collection.update_many(
        {"fromId": employee_id},
        {"$set": {"fromName": employee_name, "fromId": None}}
    )
    await transfers_collection.update_many(
        {"toId": employee_id},
        {"$set": {"toName": employee_name, "toId": None}}
    )
    
    await assets_collection.update_many(
        {"assignedEmployeeId": employee_id},
        {"$set": {"assignedEmployeeId": None, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    await employees_collection.delete_one({"_id": ObjectId(employee_id)})
    return {"message": "Employee deleted"}

# ============== EXPORT ENDPOINTS ==============

@app.post("/api/employees/export")
async def export_employees(data: ExportRequest, user: dict = Depends(get_current_user)):
    """Export employees to CSV, optionally send via email"""
    # Get employee fields
    emp_fields_doc = await settings_collection.find_one({"type": "employee_fields"})
    custom_fields = emp_fields_doc.get("fields", []) if emp_fields_doc else []
    
    # Get all employees
    employees = await employees_collection.find({}).to_list(10000)
    
    # Create CSV
    output = io.StringIO()
    headers = ["Employee ID", "Name"]
    headers.extend([f["name"] for f in custom_fields])
    headers.append("Assigned Assets Count")
    
    writer = csv.writer(output)
    writer.writerow(headers)
    
    for emp in employees:
        asset_count = await assets_collection.count_documents({"assignedEmployeeId": str(emp["_id"])})
        row = [emp.get("employeeId", ""), emp.get("name", "")]
        for field in custom_fields:
            row.append(emp.get("fieldValues", {}).get(field["id"], ""))
        row.append(asset_count)
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    if data.sendEmail:
        # Send via email
        smtp_settings = await settings_collection.find_one({"type": "smtp"})
        if not smtp_settings or not smtp_settings.get('host'):
            raise HTTPException(status_code=400, detail="SMTP not configured")
        
        # Get user's email
        db_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        user_email = db_user.get("email")
        
        branding = await settings_collection.find_one({"type": "branding"})
        app_name = branding.get('appName', 'AssetFlow') if branding else 'AssetFlow'
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Employees Export</h2>
                <p>Please find attached the employees export from {app_name}.</p>
                <p>Total employees: {len(employees)}</p>
                <p>Generated on: {format_datetime(datetime.now(timezone.utc))}</p>
            </body>
        </html>
        """
        
        filename = f"employees_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        success = await send_email(
            smtp_settings,
            user_email,
            f"Employees Export - {app_name}",
            html_content,
            csv_content.encode('utf-8'),
            filename
        )
        
        if success:
            return {"message": f"Export sent to {user_email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
    else:
        # Return as download
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=employees_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )

@app.post("/api/assets/export")
async def export_assets(data: ExportRequest, user: dict = Depends(get_current_user)):
    """Export assets to CSV, optionally send via email"""
    # Get all assets
    assets = await assets_collection.find({}).to_list(10000)
    
    # Get all asset types with their fields
    asset_types = await asset_types_collection.find({}).to_list(100)
    type_map = {str(t["_id"]): t for t in asset_types}
    
    # Collect all unique field names across all asset types
    all_field_names = set()
    for at in asset_types:
        for field in at.get("fields", []):
            all_field_names.add(field["name"])
    
    # Create CSV
    output = io.StringIO()
    headers = ["Asset Tag", "Asset Type", "Status", "Assigned To"]
    headers.extend(sorted(all_field_names))
    
    writer = csv.writer(output)
    writer.writerow(headers)
    
    # Bulk fetch all employees for export in one query
    export_emp_ids = list({ObjectId(a["assignedEmployeeId"]) for a in assets if a.get("assignedEmployeeId")})
    export_emps = await employees_collection.find({"_id": {"$in": export_emp_ids}}).to_list(1000)
    export_emp_map = {str(e["_id"]): e for e in export_emps}

    for asset in assets:
        asset_type = type_map.get(asset.get("assetTypeId"), {})
        asset_type_name = asset_type.get("name", "Unknown")

        assigned_to = ""
        if asset.get("assignedEmployeeId"):
            emp = export_emp_map.get(asset["assignedEmployeeId"])
            assigned_to = emp.get("name", "") if emp else ""

        asset_status = "Assigned" if asset.get("assignedEmployeeId") else "In Inventory"
        
        row = [asset.get("assetTag", ""), asset_type_name, asset_status, assigned_to]
        
        # Add all field values
        field_values = asset.get("fieldValues", {})
        for field_name in sorted(all_field_names):
            # Find field id by name
            field_value = ""
            for field in asset_type.get("fields", []):
                if field["name"] == field_name:
                    field_value = field_values.get(field["id"], "")
                    break
            row.append(field_value)
        
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    if data.sendEmail:
        smtp_settings = await settings_collection.find_one({"type": "smtp"})
        if not smtp_settings or not smtp_settings.get('host'):
            raise HTTPException(status_code=400, detail="SMTP not configured")
        
        db_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        user_email = db_user.get("email")
        
        branding = await settings_collection.find_one({"type": "branding"})
        app_name = branding.get('appName', 'AssetFlow') if branding else 'AssetFlow'
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Assets Export</h2>
                <p>Please find attached the assets export from {app_name}.</p>
                <p>Total assets: {len(assets)}</p>
                <p>Generated on: {format_datetime(datetime.now(timezone.utc))}</p>
            </body>
        </html>
        """
        
        filename = f"assets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        success = await send_email(
            smtp_settings,
            user_email,
            f"Assets Export - {app_name}",
            html_content,
            csv_content.encode('utf-8'),
            filename
        )
        
        if success:
            return {"message": f"Export sent to {user_email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
    else:
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=assets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )

@app.post("/api/inventory/export")
async def export_inventory(data: ExportRequest, user: dict = Depends(get_current_user)):
    """Export inventory to CSV, optionally send via email"""
    # Get inventory assets (unassigned)
    assets = await assets_collection.find({
        "$or": [
            {"assignedEmployeeId": None},
            {"assignedEmployeeId": {"$exists": False}},
            {"assignedEmployeeId": ""}
        ]
    }).to_list(10000)
    
    # Get all asset types
    asset_types = await asset_types_collection.find({}).to_list(100)
    type_map = {str(t["_id"]): t for t in asset_types}
    
    all_field_names = set()
    for at in asset_types:
        for field in at.get("fields", []):
            all_field_names.add(field["name"])
    
    output = io.StringIO()
    headers = ["Asset Tag", "Asset Type"]
    headers.extend(sorted(all_field_names))
    
    writer = csv.writer(output)
    writer.writerow(headers)
    
    for asset in assets:
        asset_type = type_map.get(asset.get("assetTypeId"), {})
        asset_type_name = asset_type.get("name", "Unknown")
        
        row = [asset.get("assetTag", ""), asset_type_name]
        
        field_values = asset.get("fieldValues", {})
        for field_name in sorted(all_field_names):
            field_value = ""
            for field in asset_type.get("fields", []):
                if field["name"] == field_name:
                    field_value = field_values.get(field["id"], "")
                    break
            row.append(field_value)
        
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    if data.sendEmail:
        smtp_settings = await settings_collection.find_one({"type": "smtp"})
        if not smtp_settings or not smtp_settings.get('host'):
            raise HTTPException(status_code=400, detail="SMTP not configured")
        
        db_user = await users_collection.find_one({"_id": ObjectId(user["id"])})
        user_email = db_user.get("email")
        
        branding = await settings_collection.find_one({"type": "branding"})
        app_name = branding.get('appName', 'AssetFlow') if branding else 'AssetFlow'
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Inventory Export</h2>
                <p>Please find attached the inventory export from {app_name}.</p>
                <p>Total items in inventory: {len(assets)}</p>
                <p>Generated on: {format_datetime(datetime.now(timezone.utc))}</p>
            </body>
        </html>
        """
        
        filename = f"inventory_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        success = await send_email(
            smtp_settings,
            user_email,
            f"Inventory Export - {app_name}",
            html_content,
            csv_content.encode('utf-8'),
            filename
        )
        
        if success:
            return {"message": f"Export sent to {user_email}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email")
    else:
        return StreamingResponse(
            io.BytesIO(csv_content.encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=inventory_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
        )

# ============== ASSET TYPES ENDPOINTS ==============

@app.get("/api/asset-types")
async def get_asset_types(user: dict = Depends(get_current_user)):
    types = await asset_types_collection.find({}).to_list(100)
    return serialize_docs(types)

@app.get("/api/asset-types/{type_id}")
async def get_asset_type(type_id: str, user: dict = Depends(get_current_user)):
    asset_type = await asset_types_collection.find_one({"_id": ObjectId(type_id)})
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")
    return serialize_doc(asset_type)

@app.post("/api/asset-types")
async def create_asset_type(data: AssetTypeCreate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    existing = await asset_types_collection.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Asset type already exists")
    
    new_type = {
        "name": data.name,
        "fields": [
            {
                "id": str(uuid.uuid4()),
                "name": "Model Number",
                "fieldType": "text",
                "required": False,
                "locked": True,
                "showInList": True,
                "showInDetail": True,
                "showInForm": True,
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
        ],
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    result = await asset_types_collection.insert_one(new_type)
    new_type["_id"] = result.inserted_id
    return serialize_doc(new_type)

@app.put("/api/asset-types/{type_id}")
async def update_asset_type(type_id: str, data: AssetTypeUpdate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    await asset_types_collection.update_one({"_id": ObjectId(type_id)}, {"$set": update_data})
    updated = await asset_types_collection.find_one({"_id": ObjectId(type_id)})
    return serialize_doc(updated)

@app.delete("/api/asset-types/{type_id}")
async def delete_asset_type(type_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    asset_count = await assets_collection.count_documents({"assetTypeId": type_id})
    if asset_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {asset_count} assets use this type")
    
    await asset_types_collection.delete_one({"_id": ObjectId(type_id)})
    return {"message": "Asset type deleted"}

# ============== ASSET FIELDS ENDPOINTS ==============

@app.get("/api/asset-types/{type_id}/fields")
async def get_asset_fields(type_id: str, user: dict = Depends(get_current_user)):
    asset_type = await asset_types_collection.find_one({"_id": ObjectId(type_id)})
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")
    return asset_type.get("fields", [])

@app.post("/api/asset-types/{type_id}/fields")
async def create_asset_field(type_id: str, data: AssetFieldCreate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    field = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "showInList": True,
        "showInDetail": True,
        "showInForm": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await asset_types_collection.update_one(
        {"_id": ObjectId(type_id)},
        {"$push": {"fields": field}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )
    return field

@app.put("/api/asset-types/{type_id}/fields/{field_id}")
async def update_asset_field(type_id: str, field_id: str, data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    asset_type = await asset_types_collection.find_one({"_id": ObjectId(type_id)})
    if not asset_type:
        raise HTTPException(status_code=404, detail="Asset type not found")
    
    fields = asset_type.get("fields", [])
    updated_fields = []
    for field in fields:
        if field["id"] == field_id:
            # Update field with new data
            for key, value in data.items():
                if value is not None:
                    field[key] = value
        updated_fields.append(field)
    
    await asset_types_collection.update_one(
        {"_id": ObjectId(type_id)},
        {"$set": {"fields": updated_fields, "updatedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Field updated"}

@app.delete("/api/asset-types/{type_id}/fields/{field_id}")
async def delete_asset_field(type_id: str, field_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    await asset_types_collection.update_one(
        {"_id": ObjectId(type_id)},
        {"$pull": {"fields": {"id": field_id}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Field deleted"}

# ============== ASSETS ENDPOINTS ==============

@app.get("/api/assets")
async def get_assets(
    inventoryOnly: bool = False,
    disposedOnly: bool = False,
    includeDisposed: bool = False,
    user: dict = Depends(get_current_user)
):
    query = {}
    if disposedOnly:
        query = disposed_asset_query()
    elif not includeDisposed:
        query = active_asset_query()

    if inventoryOnly:
        inventory_clause = {"$or": [{"assignedEmployeeId": None}, {"assignedEmployeeId": {"$exists": False}}, {"assignedEmployeeId": ""}]}
        query = active_asset_query(inventory_clause)

    assets = await assets_collection.find(query).to_list(10000)

    # Collect all unique IDs first
    asset_type_ids = list({ObjectId(a["assetTypeId"]) for a in assets if a.get("assetTypeId")})
    employee_ids = list({ObjectId(a["assignedEmployeeId"]) for a in assets if a.get("assignedEmployeeId")})

    # Fetch all related docs in just 2 bulk queries instead of one per asset
    asset_types_list = await asset_types_collection.find({"_id": {"$in": asset_type_ids}}).to_list(1000)
    employees_list = await employees_collection.find({"_id": {"$in": employee_ids}}).to_list(1000)

    # Build fast lookup maps
    asset_types_map = {str(at["_id"]): serialize_doc(at) for at in asset_types_list}
    employees_map = {str(e["_id"]): serialize_doc(e) for e in employees_list}

    result = []
    for asset in assets:
        asset_dict = serialize_doc(asset)
        asset_dict["assetType"] = asset_types_map.get(asset_dict.get("assetTypeId"))
        asset_dict["assignedEmployee"] = employees_map.get(asset_dict.get("assignedEmployeeId"))
        result.append(asset_dict)

    return result

@app.get("/api/assets/{asset_id}")
async def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset_dict = serialize_doc(asset)
    
    if asset.get("assetTypeId"):
        asset_type = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
        asset_dict["assetType"] = serialize_doc(asset_type) if asset_type else None
    
    if asset.get("assignedEmployeeId"):
        employee = await employees_collection.find_one({"_id": ObjectId(asset["assignedEmployeeId"])})
        asset_dict["assignedEmployee"] = serialize_doc(employee) if employee else None
    
    return asset_dict

@app.post("/api/assets")
async def create_asset(data: AssetCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    # Auto-generate asset tag if not provided
    asset_tag = data.assetTag
    if not asset_tag:
        # Generate prefix from asset type name (first 3 letters uppercase)
        prefix = "ASS"
        if data.assetTypeId:
            at = await asset_types_collection.find_one({"_id": ObjectId(data.assetTypeId)})
            if at:
                name = at.get("name", "ASS").strip().upper()
                clean = ''.join(c for c in name if c.isalpha())
                prefix = clean[:3] if len(clean) >= 3 else clean.ljust(3, 'X')
        # Count existing assets of this type for next number
        type_count = await assets_collection.count_documents({"assetTypeId": data.assetTypeId}) if data.assetTypeId else await assets_collection.count_documents({})
        num = type_count + 1
        asset_tag = f"{prefix}-{num:03d}"
        # Ensure uniqueness
        while await assets_collection.find_one({"assetTag": asset_tag}):
            num += 1
            asset_tag = f"{prefix}-{num:03d}"
    else:
        # Check if provided tag exists
        existing = await assets_collection.find_one({"assetTag": asset_tag})
        if existing:
            raise HTTPException(status_code=400, detail="Asset tag already exists")
    
    new_asset = {
        **data.dict(),
        "assetTag": asset_tag,
        "lifecycleStatus": "active",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    if not new_asset.get("assignedEmployeeId"):
        new_asset["assignedEmployeeId"] = None
    
    result = await assets_collection.insert_one(new_asset)
    new_asset["_id"] = result.inserted_id
    return serialize_doc(new_asset)

@app.put("/api/assets/{asset_id}")
async def update_asset(asset_id: str, data: AssetUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    if "assignedEmployeeId" in data.dict() and not data.assignedEmployeeId:
        update_data["assignedEmployeeId"] = None
    
    if "assetTag" in update_data:
        existing = await assets_collection.find_one({"assetTag": update_data["assetTag"], "_id": {"$ne": ObjectId(asset_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Asset tag already exists")
    
    await assets_collection.update_one({"_id": ObjectId(asset_id)}, {"$set": update_data})
    updated = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    return serialize_doc(updated)

@app.delete("/api/assets/{asset_id}")
async def delete_asset(asset_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    await transfers_collection.delete_many({"assetId": asset_id})
    
    result = await assets_collection.delete_one({"_id": ObjectId(asset_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return {"message": "Asset deleted"}

@app.post("/api/assets/{asset_id}/dispose")
async def dispose_asset(asset_id: str, data: Optional[AssetDisposeRequest] = None, user: dict = Depends(get_current_user)):
    require_admin(user)

    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    now = datetime.now(timezone.utc)
    update_data = {
        "lifecycleStatus": "disposed",
        "assignedEmployeeId": None,
        "disposedAt": now,
        "disposedBy": user["id"],
        "updatedAt": now,
    }
    if data and data.reason:
        update_data["disposalReason"] = data.reason.strip()

    await assets_collection.update_one({"_id": ObjectId(asset_id)}, {"$set": update_data})
    updated = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    return serialize_doc(updated)

@app.post("/api/assets/{asset_id}/restore")
async def restore_asset(asset_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)

    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    await assets_collection.update_one(
        {"_id": ObjectId(asset_id)},
        {
            "$set": {
                "lifecycleStatus": "active",
                "assignedEmployeeId": None,
                "updatedAt": datetime.now(timezone.utc),
            },
            "$unset": {
                "disposedAt": "",
                "disposedBy": "",
                "disposalReason": "",
            }
        }
    )
    updated = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    return serialize_doc(updated)

@app.post("/api/assets/{asset_id}/duplicate")
async def duplicate_asset(asset_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    base_tag = asset["assetTag"]
    counter = 1
    new_tag = f"{base_tag}-{counter}"
    while await assets_collection.find_one({"assetTag": new_tag}):
        counter += 1
        new_tag = f"{base_tag}-{counter}"
    
    new_asset = {
        "assetTag": new_tag,
        "assetTypeId": asset.get("assetTypeId"),
        "assignedEmployeeId": None,
        "lifecycleStatus": "active",
        "imageUrl": asset.get("imageUrl"),
        "fieldValues": asset.get("fieldValues", {}),
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    result = await assets_collection.insert_one(new_asset)
    new_asset["_id"] = result.inserted_id
    return serialize_doc(new_asset)

@app.post("/api/assets/upload-image")
async def upload_image(image: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_admin(user)
    
    contents = await image.read()
    base64_data = base64.b64encode(contents).decode()
    content_type = image.content_type or "image/jpeg"
    data_url = f"data:{content_type};base64,{base64_data}"
    
    return {"url": data_url}

# ============== VEHICLE FLEET ENDPOINTS ==============

@app.get("/api/vehicle-fields")
async def get_public_vehicle_fields(user: dict = Depends(get_current_user)):
    settings = await get_vehicle_fields_doc()
    return settings.get("fields", [])

@app.get("/api/settings/vehicle-fields")
async def get_vehicle_fields_settings(user: dict = Depends(get_current_user)):
    settings = await get_vehicle_fields_doc()
    return settings.get("fields", [])

@app.put("/api/settings/vehicle-fields")
async def update_vehicle_fields_settings(fields: List[dict], user: dict = Depends(get_current_user)):
    require_super_admin(user)
    normalized = normalize_vehicle_fields(fields)
    if sum(1 for field in normalized if field.get("showInPreview")) > 4:
        raise HTTPException(status_code=400, detail="Only 4 vehicle fields can be shown in the selector preview")

    await settings_collection.update_one(
        {"type": "vehicle_fields"},
        {
            "$set": {
                "fields": normalized,
                "updatedAt": datetime.now(timezone.utc)
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    return normalized

@app.post("/api/vehicles/files")
async def upload_vehicle_file(
    kind: str = Form("field"),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    require_admin(user)

    normalized_kind = "hero" if kind == "hero" else "field"
    filename = file.filename or "vehicle-file"
    content_type = (file.content_type or "").lower()
    extension = os.path.splitext(filename.lower())[1]
    contents = await file.read()
    size = len(contents)

    if size <= 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if size > VEHICLE_MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Vehicle files must be 25 MB or smaller")

    if normalized_kind == "hero":
        if content_type not in VEHICLE_HERO_CONTENT_TYPES or extension != ".png":
            raise HTTPException(status_code=400, detail="Vehicle image must be a PNG file")
        clean_content_type = "image/png"
    else:
        extension_allowed = extension in {".png", ".jpg", ".jpeg", ".webp"}
        content_allowed = content_type in VEHICLE_ATTACHMENT_CONTENT_TYPES
        if not extension_allowed or not content_allowed:
            raise HTTPException(status_code=400, detail="Vehicle document images must be PNG, JPG, JPEG, or WebP")
        clean_content_type = "image/jpeg" if content_type == "image/jpg" else content_type

    now = datetime.now(timezone.utc)
    gridfs_file_id = await fs.upload_from_stream(
        filename,
        contents,
        metadata={
            "type": "vehicle_file",
            "kind": normalized_kind,
            "uploadedBy": user["id"],
            "contentType": clean_content_type,
            "createdAt": now
        }
    )

    file_doc = {
        "filename": filename,
        "contentType": clean_content_type,
        "size": size,
        "kind": normalized_kind,
        "gridfsFileId": gridfs_file_id,
        "uploadedBy": user["id"],
        "createdAt": now,
        "updatedAt": now
    }
    result = await vehicle_files_collection.insert_one(file_doc)
    file_doc["_id"] = result.inserted_id
    return serialize_vehicle_file(file_doc)

@app.get("/api/vehicles/files/{file_id}")
async def stream_vehicle_file(file_id: str):
    try:
        object_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Vehicle file not found")

    file_doc = await vehicle_files_collection.find_one({"_id": object_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="Vehicle file not found")

    try:
        grid_out = await fs.open_download_stream(file_doc["gridfsFileId"])
    except Exception:
        raise HTTPException(status_code=404, detail="Vehicle file data not found")

    async def file_iterator():
        while True:
            chunk = await grid_out.readchunk()
            if not chunk:
                break
            yield chunk

    filename = (file_doc.get("filename") or "vehicle-file").replace('"', "")
    return StreamingResponse(
        file_iterator(),
        media_type=file_doc.get("contentType", "application/octet-stream"),
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "public, max-age=86400",
            "Content-Length": str(file_doc.get("size", 0))
        }
    )

@app.get("/api/vehicles")
async def get_vehicles(user: dict = Depends(get_current_user)):
    vehicles = await vehicles_collection.find({}).sort("createdAt", -1).to_list(1000)
    return [serialize_vehicle(vehicle) for vehicle in vehicles]

@app.get("/api/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, user: dict = Depends(get_current_user)):
    try:
        object_id = ObjectId(vehicle_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle = await vehicles_collection.find_one({"_id": object_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return serialize_vehicle(vehicle)

@app.post("/api/vehicles")
async def create_vehicle(data: VehicleCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    clean_name = await validate_vehicle_payload(data.name, data.imageFileId, data.fieldValues)
    now = datetime.now(timezone.utc)
    vehicle_doc = {
        "name": clean_name,
        "imageFileId": data.imageFileId,
        "fieldValues": data.fieldValues or {},
        "createdBy": user["id"],
        "updatedBy": user["id"],
        "createdAt": now,
        "updatedAt": now
    }
    result = await vehicles_collection.insert_one(vehicle_doc)
    vehicle_doc["_id"] = result.inserted_id
    return serialize_vehicle(vehicle_doc)

@app.put("/api/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: VehicleUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    try:
        object_id = ObjectId(vehicle_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    existing = await vehicles_collection.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    clean_name = await validate_vehicle_payload(
        data.name if data.name is not None else existing.get("name"),
        data.imageFileId if data.imageFileId is not None else existing.get("imageFileId"),
        data.fieldValues if data.fieldValues is not None else existing.get("fieldValues", {}),
        partial=True
    )

    update_data = {"updatedAt": datetime.now(timezone.utc), "updatedBy": user["id"]}
    if clean_name is not None:
        update_data["name"] = clean_name
    if data.imageFileId is not None:
        update_data["imageFileId"] = data.imageFileId
    if data.fieldValues is not None:
        update_data["fieldValues"] = data.fieldValues

    await vehicles_collection.update_one({"_id": object_id}, {"$set": update_data})
    updated = await vehicles_collection.find_one({"_id": object_id})
    return serialize_vehicle(updated)

@app.delete("/api/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    try:
        object_id = ObjectId(vehicle_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    result = await vehicles_collection.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}

# ============== FILE UPLOAD ENDPOINTS ==============

@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload a file and store it"""
    require_super_admin(user)
    
    contents = await file.read()
    
    # Store file metadata in database
    file_doc = {
        "filename": file.filename,
        "contentType": file.content_type,
        "size": len(contents),
        "data": base64.b64encode(contents).decode(),
        "uploadedBy": user["id"],
        "createdAt": datetime.now(timezone.utc)
    }
    
    result = await files_collection.insert_one(file_doc)
    
    return {
        "fileId": str(result.inserted_id),
        "filename": file.filename,
        "size": len(contents)
    }

@app.get("/api/files/{file_id}")
async def get_file(file_id: str):
    """Serve a file by ID"""
    try:
        file_doc = await files_collection.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File not found")
        
        contents = base64.b64decode(file_doc["data"])
        
        return StreamingResponse(
            io.BytesIO(contents),
            media_type=file_doc.get("contentType", "application/octet-stream"),
            headers={
                "Content-Disposition": f"inline; filename={file_doc['filename']}",
                "Cache-Control": "public, max-age=86400",
                "ETag": str(file_doc.get("_id", ""))
            }
        )
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")

# ============== APP MUSIC ENDPOINTS ==============

@app.get("/api/music/config")
async def get_public_music_config():
    """Public music player config for login and authenticated app screens."""
    settings = await get_music_settings_doc()
    enabled = bool(settings.get("enabled", False))
    tracks = []

    if enabled:
        docs = await music_tracks_collection.find({}).sort("createdAt", 1).to_list(500)
        tracks = [serialize_music_track(doc) for doc in docs]

    return {
        "enabled": enabled,
        "tracks": tracks,
        "maxFileSize": MUSIC_MAX_FILE_SIZE
    }

@app.get("/api/music/{track_id}/stream")
async def stream_music_track(track_id: str):
    """Stream an enabled music track without auth so it works on the login page."""
    settings = await get_music_settings_doc()
    if not settings.get("enabled", False):
        raise HTTPException(status_code=404, detail="Music player is disabled")

    try:
        object_id = ObjectId(track_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Track not found")

    track = await music_tracks_collection.find_one({"_id": object_id})
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    try:
        grid_out = await fs.open_download_stream(track["gridfsFileId"])
    except Exception:
        raise HTTPException(status_code=404, detail="Track file not found")

    async def file_iterator():
        while True:
            chunk = await grid_out.readchunk()
            if not chunk:
                break
            yield chunk

    filename = (track.get("filename") or "assetflow-music.mp3").replace('"', "")
    return StreamingResponse(
        file_iterator(),
        media_type=track.get("contentType", "audio/mpeg"),
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=3600",
            "Content-Length": str(track.get("size", 0))
        }
    )

@app.get("/api/settings/music")
async def get_music_settings(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    settings = await get_music_settings_doc()
    docs = await music_tracks_collection.find({}).sort("createdAt", 1).to_list(500)
    return {
        "enabled": bool(settings.get("enabled", False)),
        "tracks": [serialize_music_track(doc) for doc in docs],
        "maxFileSize": MUSIC_MAX_FILE_SIZE
    }

@app.put("/api/settings/music")
async def update_music_settings(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    enabled = bool(data.get("enabled", False))
    await settings_collection.update_one(
        {"type": "music"},
        {
            "$set": {
                "enabled": enabled,
                "updatedAt": datetime.now(timezone.utc)
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    return {"enabled": enabled}

@app.post("/api/settings/music/tracks")
async def upload_music_track(
    name: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    require_super_admin(user)

    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Music name is required")

    filename = file.filename or "music.mp3"
    content_type = file.content_type or "audio/mpeg"
    contents = await file.read()
    size = len(contents)
    is_mp3 = filename.lower().endswith(".mp3") and (
        content_type in MUSIC_CONTENT_TYPES or looks_like_mp3(contents)
    )
    if not is_mp3:
        raise HTTPException(status_code=400, detail="Only MP3 files are allowed")
    if content_type not in MUSIC_CONTENT_TYPES:
        content_type = "audio/mpeg"
    if size <= 0:
        raise HTTPException(status_code=400, detail="Music file is empty")
    if size > MUSIC_MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Music file must be 50 MB or smaller")

    now = datetime.now(timezone.utc)
    gridfs_file_id = await fs.upload_from_stream(
        filename,
        contents,
        metadata={
            "type": "app_music",
            "name": clean_name,
            "uploadedBy": user["id"],
            "contentType": content_type,
            "createdAt": now
        }
    )

    track_doc = {
        "name": clean_name,
        "filename": filename,
        "contentType": content_type,
        "size": size,
        "gridfsFileId": gridfs_file_id,
        "uploadedBy": user["id"],
        "createdAt": now,
        "updatedAt": now
    }
    result = await music_tracks_collection.insert_one(track_doc)
    track_doc["_id"] = result.inserted_id

    return serialize_music_track(track_doc)

@app.put("/api/settings/music/tracks/{track_id}")
async def rename_music_track(track_id: str, data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    new_name = str(data.get("name", "")).strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Music name is required")

    try:
        object_id = ObjectId(track_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Track not found")

    result = await music_tracks_collection.update_one(
        {"_id": object_id},
        {"$set": {"name": new_name, "updatedAt": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Track not found")

    track = await music_tracks_collection.find_one({"_id": object_id})
    return serialize_music_track(track)

@app.delete("/api/settings/music/tracks/{track_id}")
async def delete_music_track(track_id: str, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    try:
        object_id = ObjectId(track_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Track not found")

    track = await music_tracks_collection.find_one({"_id": object_id})
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    await music_tracks_collection.delete_one({"_id": object_id})
    try:
        await fs.delete(track["gridfsFileId"])
    except Exception:
        pass

    return {"success": True}

# ============== TRANSFERS ENDPOINTS ==============

@app.get("/api/transfers")
async def get_transfers(user: dict = Depends(get_current_user)):
    transfers = await transfers_collection.find({}).sort("date", -1).to_list(10000)
    result = []
    
    for transfer in transfers:
        transfer_dict = serialize_doc(transfer)
        
        # Format datetime
        if transfer.get("date"):
            transfer_dict["formattedDate"] = format_datetime(transfer["date"])
        
        if transfer.get("assetId"):
            try:
                asset = await assets_collection.find_one({"_id": ObjectId(transfer["assetId"])})
            except:
                asset = None
            if asset:
                asset_dict = serialize_doc(asset)
                asset_type_name = transfer_dict.get("assetTypeName", "")
                model_number = transfer_dict.get("assetModelNumber", "")

                # Enrich with asset type if not already stored
                if asset.get("assetTypeId"):
                    try:
                        at = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
                        if at:
                            asset_dict["assetType"] = serialize_doc(at)
                            if not asset_type_name:
                                asset_type_name = at.get("name", "N/A")
                    except:
                        pass

                # Get model number from fieldValues
                if not model_number:
                    fv = asset.get("fieldValues", {})
                    if fv and asset.get("assetTypeId"):
                        try:
                            at = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
                            if at:
                                for f in at.get("fields", []):
                                    if f.get("name") == "Model Number":
                                        model_number = fv.get(f["id"], "")
                                        break
                        except:
                            pass

                transfer_dict["asset"] = asset_dict
                transfer_dict["assetTypeName"] = asset_type_name or "N/A"
                transfer_dict["assetModelNumber"] = model_number  # no fallback to assetTag
            else:
                transfer_dict["asset"] = None
                if not transfer_dict.get("assetTypeName"):
                    transfer_dict["assetTypeName"] = "Deleted Asset"

        result.append(transfer_dict)

    return result

@app.get("/api/transfers/asset/{asset_id}")
async def get_asset_transfers(asset_id: str, user: dict = Depends(get_current_user)):
    transfers = await transfers_collection.find({"assetId": asset_id}).sort("date", -1).to_list(1000)
    result = []
    for transfer in transfers:
        transfer_dict = serialize_doc(transfer)
        if transfer.get("date"):
            transfer_dict["formattedDate"] = format_datetime(transfer["date"])
        result.append(transfer_dict)
    return result

@app.get("/api/transfers/employee/{employee_id}")
async def get_employee_transfers(employee_id: str, user: dict = Depends(get_current_user)):
    transfers = await transfers_collection.find({
        "$or": [{"fromId": employee_id}, {"toId": employee_id}]
    }).sort("date", -1).to_list(1000)
    result = []
    for transfer in transfers:
        transfer_dict = serialize_doc(transfer)
        if transfer.get("date"):
            transfer_dict["formattedDate"] = format_datetime(transfer["date"])
        result.append(transfer_dict)
    return result

@app.post("/api/transfers")
async def create_transfer(data: TransferCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    from_name = "Inventory"
    if data.fromType == "employee" and data.fromId:
        emp = await employees_collection.find_one({"_id": ObjectId(data.fromId)})
        from_name = emp["name"] if emp else "Unknown Employee"
    
    to_name = "Inventory"
    if data.toType == "employee" and data.toId:
        emp = await employees_collection.find_one({"_id": ObjectId(data.toId)})
        to_name = emp["name"] if emp else "Unknown Employee"
    
    transfers = []
    for asset_id in data.assetIds:
        asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
        if not asset:
            continue
        
        # Get asset type name and model number for denormalized storage
        asset_type_name = "Unknown"
        asset_model = asset.get("assetTag", "")
        if asset.get("assetTypeId"):
            try:
                at = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
                if at:
                    asset_type_name = at.get("name", "Unknown")
            except:
                pass
        # Get model number from fieldValues
        model_number = ""
        fv = asset.get("fieldValues", {})
        if fv and asset.get("assetTypeId"):
            try:
                at = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
                if at:
                    for f in at.get("fields", []):
                        if f.get("name") == "Model Number":
                            model_number = fv.get(f["id"], "")
                            break
            except:
                pass

        transfer = {
            "assetId": asset_id,
            "assetTag": asset.get("assetTag", ""),
            "assetTypeName": asset_type_name,
            "assetModelNumber": model_number,
            "fromType": data.fromType,
            "fromId": data.fromId,
            "fromName": from_name,
            "toType": data.toType,
            "toId": data.toId,
            "toName": to_name,
            "notes": data.notes,
            "date": datetime.now(timezone.utc),
            "createdBy": user["id"]
        }
        result = await transfers_collection.insert_one(transfer)
        transfer["_id"] = result.inserted_id
        transfer["formattedDate"] = format_datetime(transfer["date"])
        transfers.append(serialize_doc(transfer))
        
        new_assignment = data.toId if data.toType == "employee" else None
        await assets_collection.update_one(
            {"_id": ObjectId(asset_id)},
            {"$set": {"assignedEmployeeId": new_assignment, "updatedAt": datetime.now(timezone.utc)}}
        )
    
    return transfers

@app.post("/api/transfers/manual")
async def create_manual_transfer(data: ManualTransferCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    transfer_date = datetime.fromisoformat(data.date) if data.date else datetime.now(timezone.utc)
    
    transfer = {
        "assetId": data.assetId,
        "fromType": data.fromType,
        "fromName": data.fromName,
        "toType": data.toType,
        "toName": data.toName,
        "notes": data.notes,
        "date": transfer_date,
        "createdBy": user["id"],
        "isManual": True
    }
    result = await transfers_collection.insert_one(transfer)
    transfer["_id"] = result.inserted_id
    transfer["formattedDate"] = format_datetime(transfer["date"])
    return serialize_doc(transfer)

# ============== DELETE TRANSFER ENDPOINT ==============

@app.delete("/api/transfers/{transfer_id}")
async def delete_transfer(transfer_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await transfers_collection.delete_one({"_id": ObjectId(transfer_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return {"message": "Transfer deleted"}

# ============== DATETIME SETTINGS ENDPOINTS ==============

@app.get("/api/settings/datetime")
async def get_datetime_settings(user: dict = Depends(get_current_user)):
    doc = await settings_collection.find_one({"type": "datetime"})
    if not doc:
        return {"autoSync": True, "timezone": "UTC", "dateFormat": "MMM DD, YYYY", "timeFormat": "12h"}
    return {
        "autoSync": doc.get("autoSync", True),
        "timezone": doc.get("timezone", "UTC"),
        "dateFormat": doc.get("dateFormat", "MMM DD, YYYY"),
        "timeFormat": doc.get("timeFormat", "12h"),
    }

@app.put("/api/settings/datetime")
async def update_datetime_settings(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    update = {
        "type": "datetime",
        "autoSync": data.get("autoSync", True),
        "timezone": data.get("timezone", "UTC"),
        "dateFormat": data.get("dateFormat", "MMM DD, YYYY"),
        "timeFormat": data.get("timeFormat", "12h"),
        "updatedAt": datetime.now(timezone.utc),
    }
    await settings_collection.update_one({"type": "datetime"}, {"$set": update}, upsert=True)
    return update

# ============== BACKUP & RESTORE ENDPOINTS ==============

import json as _json_module, io as _io_module

@app.post("/api/backup/create")
async def create_backup(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    categories = data.get("categories", [])
    backup = {"version": "1.0", "createdAt": datetime.now(timezone.utc).isoformat(), "data": {}}
    meta = {}

    async def grab(collection, limit=100000):
        docs = await collection.find({}).to_list(limit)
        return [backup_doc(d) for d in docs]

    if "employees" in categories:
        docs = await grab(employees_collection)
        backup["data"]["employees"] = docs
        meta["employees"] = len(docs)

    if "assets" in categories:
        docs = await grab(assets_collection)
        backup["data"]["assets"] = docs
        meta["assets"] = len(docs)

    if "transfers" in categories:
        docs = await grab(transfers_collection)
        backup["data"]["transfers"] = docs
        meta["transfers"] = len(docs)

    if "subscriptions" in categories:
        docs = await grab(subscriptions_collection)
        backup["data"]["subscriptions"] = docs
        meta["subscriptions"] = len(docs)

    if "asset_types" in categories:
        docs = await grab(asset_types_collection, 1000)
        backup["data"]["asset_types"] = docs
        meta["asset_types"] = len(docs)

    if "employee_fields" in categories:
        doc = await settings_collection.find_one({"type": "employee_fields"})
        backup["data"]["employee_fields"] = backup_doc(doc) if doc else {}
        meta["employee_fields"] = 1 if doc else 0

    if "users" in categories:
        docs = await users_collection.find({}, {"password": 0}).to_list(1000)
        backup["data"]["users"] = [backup_doc(d) for d in docs]
        meta["users"] = len(docs)

    if "settings" in categories:
        docs = await grab(settings_collection, 1000)
        backup["data"]["settings"] = docs
        meta["settings"] = len(docs)
        files_docs = await grab(files_collection, 500)
        backup["data"]["files"] = files_docs
        meta["files"] = len(files_docs)

    json_bytes = _json_module.dumps(backup, default=str).encode("utf-8")
    meta_header = _json_module.dumps(meta)

    return StreamingResponse(
        _io_module.BytesIO(json_bytes),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=assetflow_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.assetflow",
            "X-Backup-Meta": meta_header,
            "Access-Control-Expose-Headers": "X-Backup-Meta",
        }
    )

@app.post("/api/backup/restore")
async def restore_backup(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    backup_data = data.get("data", {})
    restored = {}

    async def restore_col(collection, docs_list):
        if not docs_list:
            return 0
        await collection.delete_many({})
        clean = []
        for doc in docs_list:
            d = dict(doc)
            # _id is stored as string in backup
            raw_id = d.pop("_id", None) or d.pop("id", None)
            if raw_id:
                try:
                    d["_id"] = ObjectId(str(raw_id))
                except:
                    pass
            clean.append(d)
        if clean:
            await collection.insert_many(clean)
        return len(clean)

    if "employees" in backup_data:
        restored["employees"] = await restore_col(employees_collection, backup_data["employees"])

    if "assets" in backup_data:
        restored["assets"] = await restore_col(assets_collection, backup_data["assets"])

    if "transfers" in backup_data:
        restored["transfers"] = await restore_col(transfers_collection, backup_data["transfers"])

    if "subscriptions" in backup_data:
        restored["subscriptions"] = await restore_col(subscriptions_collection, backup_data["subscriptions"])

    if "asset_types" in backup_data:
        restored["asset_types"] = await restore_col(asset_types_collection, backup_data["asset_types"])

    if "employee_fields" in backup_data:
        doc = dict(backup_data["employee_fields"])
        if doc:
            doc.pop("_id", None); doc.pop("id", None)
            doc["type"] = "employee_fields"
            await settings_collection.replace_one({"type": "employee_fields"}, doc, upsert=True)
        restored["employee_fields"] = 1

    if "settings" in backup_data:
        count = 0
        for doc in backup_data["settings"]:
            doc = dict(doc)
            doc.pop("_id", None); doc.pop("id", None)
            stype = doc.get("type")
            if stype:
                await settings_collection.replace_one({"type": stype}, doc, upsert=True)
                count += 1
        restored["settings"] = count

    if "files" in backup_data:
        restored["files"] = await restore_col(files_collection, backup_data["files"])

    return {"success": True, "restored": restored}

# ============== DASHBOARD ENDPOINTS ==============

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    total_employees = await employees_collection.count_documents({})
    total_assets = await assets_collection.count_documents(active_asset_query())
    assigned_assets = await assets_collection.count_documents(active_asset_query({
        "assignedEmployeeId": {"$exists": True, "$nin": [None, ""]}
    }))
    inventory_assets = total_assets - assigned_assets
    disposed_assets = await assets_collection.count_documents(disposed_asset_query())
    
    asset_types = await asset_types_collection.find({}).to_list(100)
    assets_by_type = []
    for asset_type in asset_types:
        count = await assets_collection.count_documents(active_asset_query({"assetTypeId": str(asset_type["_id"])}))
        assets_by_type.append({
            "id": str(asset_type["_id"]),
            "name": asset_type["name"],
            "count": count,
            "_count": count
        })
    
    return {
        "totalEmployees": total_employees,
        "totalAssets": total_assets,
        "assignedAssets": assigned_assets,
        "inventoryAssets": inventory_assets,
        "disposedAssets": disposed_assets,
        "assetsByType": assets_by_type
    }

@app.get("/api/dashboard/preview")
async def get_dashboard_preview(type: str, user: dict = Depends(get_current_user)):
    """Get preview data for dashboard hover"""
    app_settings = await settings_collection.find_one({"type": "app"})
    max_items = app_settings.get("dashboardPreviewMax", 5) if app_settings else 5
    
    if type == "employees":
        employees = await employees_collection.find({}).limit(max_items).to_list(max_items)
        return {"items": [{"id": str(e["_id"]), "name": e["name"]} for e in employees]}
    
    elif type == "assets":
        assets = await assets_collection.find(active_asset_query()).limit(max_items).to_list(max_items)
        result = []
        for asset in assets:
            asset_type = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])}) if asset.get("assetTypeId") else None
            result.append({
                "id": str(asset["_id"]),
                "assetTag": asset["assetTag"],
                "type": asset_type["name"] if asset_type else "Unknown"
            })
        return {"items": result}
    
    elif type == "assigned":
        assets = await assets_collection.find(active_asset_query({
            "assignedEmployeeId": {"$exists": True, "$nin": [None, ""]}
        })).limit(max_items).to_list(max_items)
        result = []
        for asset in assets:
            emp = await employees_collection.find_one({"_id": ObjectId(asset["assignedEmployeeId"])}) if asset.get("assignedEmployeeId") else None
            result.append({
                "id": str(asset["_id"]),
                "assetTag": asset["assetTag"],
                "assignedTo": emp["name"] if emp else "Unknown"
            })
        return {"items": result}
    
    elif type == "inventory":
        assets = await assets_collection.find(active_asset_query({
            "$or": [{"assignedEmployeeId": None}, {"assignedEmployeeId": {"$exists": False}}, {"assignedEmployeeId": ""}]
        })).limit(max_items).to_list(max_items)
        return {"items": [{"id": str(a["_id"]), "assetTag": a["assetTag"]} for a in assets]}

    elif type == "disposed":
        assets = await assets_collection.find(disposed_asset_query()).sort("disposedAt", -1).limit(max_items).to_list(max_items)
        return {"items": [{"id": str(a["_id"]), "assetTag": a["assetTag"], "reason": a.get("disposalReason")} for a in assets]}
    
    elif type == "assetsByType":
        asset_types = await asset_types_collection.find({}).to_list(100)
        result = []
        for asset_type in asset_types:
            count = await assets_collection.count_documents(active_asset_query({"assetTypeId": str(asset_type["_id"])}))
            if count > 0:
                result.append({"name": asset_type["name"], "count": count})
        return {"items": result[:max_items]}

    elif type == "employeesByAssets":
        employees = await employees_collection.find({}).to_list(10000)
        result = []
        for emp in employees:
            emp_id = str(emp["_id"])
            count = await assets_collection.count_documents(active_asset_query({"assignedEmployeeId": emp_id}))
            if count > 0:
                result.append({
                    "id": emp_id,
                    "name": emp.get("name", ""),
                    "employeeId": emp.get("employeeId", ""),
                    "assetCount": count
                })
        result.sort(key=lambda x: x["assetCount"], reverse=True)
        return {"items": result[:max_items]}

    return {"items": []}

# ============== SEARCH ENDPOINT ==============

@app.get("/api/search")
async def search(q: str, user: dict = Depends(get_current_user)):
    if len(q) < 2:
        return {"assets": [], "employees": []}
    
    assets = await assets_collection.find(active_asset_query({
        "$or": [
            {"assetTag": {"$regex": q, "$options": "i"}},
            {"$expr": {
                "$gt": [
                    {"$size": {
                        "$filter": {
                            "input": {"$objectToArray": {"$ifNull": ["$fieldValues", {}]}},
                            "cond": {
                                "$regexMatch": {
                                    "input": {"$toString": "$$this.v"},
                                    "regex": q,
                                    "options": "i"
                                }
                            }
                        }
                    }},
                    0
                ]
            }}
        ]
    })).limit(10).to_list(10)
    
    asset_results = []
    for asset in assets:
        asset_dict = serialize_doc(asset)
        if asset.get("assetTypeId"):
            asset_type = await asset_types_collection.find_one({"_id": ObjectId(asset["assetTypeId"])})
            asset_dict["assetType"] = serialize_doc(asset_type) if asset_type else None
        
        if asset.get("assignedEmployeeId"):
            emp = await employees_collection.find_one({"_id": ObjectId(asset["assignedEmployeeId"])})
            if emp:
                asset_dict["assignedEmployee"] = {"id": str(emp["_id"]), "name": emp["name"]}
        
        history_count = await transfers_collection.count_documents({"assetId": asset_dict["id"]})
        asset_dict["assignmentHistoryCount"] = history_count
        
        asset_results.append(asset_dict)
    
    employees = await employees_collection.find({
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"employeeId": {"$regex": q, "$options": "i"}},
            {"$expr": {
                "$gt": [
                    {"$size": {
                        "$filter": {
                            "input": {"$objectToArray": {"$ifNull": ["$fieldValues", {}]}},
                            "cond": {
                                "$regexMatch": {
                                    "input": {"$toString": "$$this.v"},
                                    "regex": q,
                                    "options": "i"
                                }
                            }
                        }
                    }},
                    0
                ]
            }}
        ]
    }).limit(10).to_list(10)
    
    employee_results = []
    for emp in employees:
        emp_dict = serialize_doc(emp)
        asset_count = await assets_collection.count_documents(active_asset_query({"assignedEmployeeId": emp_dict["id"]}))
        emp_dict["assetCount"] = asset_count
        employee_results.append(emp_dict)
    
    return {
        "assets": asset_results,
        "employees": employee_results
    }

# ============== SETTINGS ENDPOINTS ==============

@app.get("/api/settings/branding")
async def get_branding():
    branding = await settings_collection.find_one({"type": "branding"})
    if branding:
        result = {
            "appName": branding.get("appName", "AssetFlow"),
            "loginTitle": branding.get("loginTitle", "Welcome to AssetFlow"),
            "headerText": branding.get("headerText", "AssetFlow"),
            "accentColor": branding.get("accentColor", "#4F46E5"),
            "logoFileId": branding.get("logoFileId"),
            "faviconFileId": branding.get("faviconFileId"),
            "loginBackgroundFileId": branding.get("loginBackgroundFileId"),
        }
        
        # Convert file IDs to URLs
        if branding.get("logoFileId"):
            result["logoUrl"] = f"/api/files/{branding['logoFileId']}"
        else:
            result["logoUrl"] = None
            
        if branding.get("faviconFileId"):
            result["faviconUrl"] = f"/api/files/{branding['faviconFileId']}"
        else:
            result["faviconUrl"] = None
            
        if branding.get("loginBackgroundFileId"):
            result["loginBackgroundUrl"] = f"/api/files/{branding['loginBackgroundFileId']}"
        else:
            result["loginBackgroundUrl"] = None
        
        return result
    
    return {
        "appName": "AssetFlow",
        "loginTitle": "Welcome to AssetFlow",
        "headerText": "AssetFlow",
        "accentColor": "#4F46E5",
        "logoUrl": None,
        "faviconUrl": None,
        "loginBackgroundUrl": None,
        "logoFileId": None,
        "faviconFileId": None,
        "loginBackgroundFileId": None,
    }

@app.put("/api/settings/branding")
async def update_branding(data: BrandingUpdate, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    # Get existing branding first
    existing = await settings_collection.find_one({"type": "branding"})
    
    # Build update - include ALL fields even if None so removals work
    update_data = {}
    data_dict = data.dict()
    
    for k, v in data_dict.items():
        if v is not None:
            update_data[k] = v
        else:
            # Field explicitly set to None means user removed it - delete old file too
            if k in ["logoFileId", "faviconFileId", "loginBackgroundFileId"]:
                old_file_id = existing.get(k) if existing else None
                if old_file_id:
                    try:
                        await files_collection.delete_one({"_id": ObjectId(old_file_id)})
                    except:
                        pass
                update_data[k] = None
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    await settings_collection.update_one(
        {"type": "branding"},
        {"$set": update_data},
        upsert=True
    )
    
    branding = await settings_collection.find_one({"type": "branding"})
    del branding["_id"]
    del branding["type"]
    
    # Build response with URLs
    result = dict(branding)
    result["logoUrl"] = f"/api/files/{branding['logoFileId']}" if branding.get("logoFileId") else None
    result["faviconUrl"] = f"/api/files/{branding['faviconFileId']}" if branding.get("faviconFileId") else None
    result["loginBackgroundUrl"] = f"/api/files/{branding['loginBackgroundFileId']}" if branding.get("loginBackgroundFileId") else None
    return result

@app.get("/api/settings/employee-fields")
async def get_employee_fields(user: dict = Depends(get_current_user)):
    settings = await settings_collection.find_one({"type": "employee_fields"})
    return settings.get("fields", []) if settings else []

@app.put("/api/settings/employee-fields")
async def update_employee_fields(fields: List[dict], user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    await settings_collection.update_one(
        {"type": "employee_fields"},
        {"$set": {"fields": fields, "updatedAt": datetime.now(timezone.utc)}},
        upsert=True
    )
    return fields

@app.get("/api/settings/app")
async def get_app_settings(user: dict = Depends(get_current_user)):
    settings = await settings_collection.find_one({"type": "app"})
    if settings:
        del settings["_id"]
        del settings["type"]
    return settings or {}

@app.put("/api/settings/app")
async def update_app_settings(data: dict, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    if "subscriptionWarningDays" in data:
        try:
            data["subscriptionWarningDays"] = max(1, min(int(data["subscriptionWarningDays"]), 7))
        except Exception:
            data["subscriptionWarningDays"] = 7
    data["updatedAt"] = datetime.now(timezone.utc)
    await settings_collection.update_one(
        {"type": "app"},
        {"$set": data},
        upsert=True
    )
    return data

@app.get("/api/settings/smtp")
async def get_smtp_settings(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    settings = await settings_collection.find_one({"type": "smtp"})
    if settings:
        del settings["_id"]
        del settings["type"]
        if "password" in settings:
            settings["password"] = "***" if settings.get("password") else ""
    return settings or {}

@app.put("/api/settings/smtp")
async def update_smtp_settings(data: SMTPSettings, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    settings_data = {k: v for k, v in data.dict().items() if v is not None}
    settings_data["updatedAt"] = datetime.now(timezone.utc)
    
    if settings_data.get("password") == "***":
        del settings_data["password"]
    
    await settings_collection.update_one(
        {"type": "smtp"},
        {"$set": settings_data},
        upsert=True
    )
    
    result = await settings_collection.find_one({"type": "smtp"})
    if result:
        del result["_id"]
        del result["type"]
        if "password" in result:
            result["password"] = "***"
    return result or {}

@app.post("/api/settings/smtp/test")
async def test_smtp_connection(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    smtp_settings = await settings_collection.find_one({"type": "smtp"})
    if not smtp_settings or not smtp_settings.get('host'):
        return {"status": "not_configured", "message": "SMTP not configured"}
    
    try:
        if smtp_settings.get('encryption') == 'SSL':
            server = smtplib.SMTP_SSL(smtp_settings['host'], smtp_settings.get('port', 465), timeout=10)
        else:
            server = smtplib.SMTP(smtp_settings['host'], smtp_settings.get('port', 587), timeout=10)
            if smtp_settings.get('encryption') == 'TLS':
                server.starttls()
        
        server.login(smtp_settings['username'], smtp_settings['password'])
        server.quit()
        return {"status": "connected", "message": "SMTP connection successful"}
    except Exception as e:
        return {"status": "failed", "message": str(e)}

@app.get("/api/settings/monday")
async def get_monday_settings(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    settings = await settings_collection.find_one({"type": "monday"})
    if settings:
        result = {
            "apiToken": "",
            "boardId": settings.get("boardId", ""),
            "syncEnabled": settings.get("syncEnabled", False),
            "lastSyncAt": settings.get("lastSyncAt"),
            "hasToken": bool(settings.get("apiToken"))
        }
        # Mask token but show it's configured
        if settings.get("apiToken"):
            result["apiToken"] = settings["apiToken"][:12] + "..." + settings["apiToken"][-4:]
        return result
    return {"apiToken": "", "boardId": "", "syncEnabled": False, "hasToken": False}

@app.put("/api/settings/monday")
async def update_monday_settings(data: MondaySettings, user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    settings_data = {}
    
    # Handle API token - only update if it's a new full token (not masked)
    if data.apiToken and "..." not in data.apiToken:
        settings_data["apiToken"] = data.apiToken
    
    if data.boardId is not None:
        settings_data["boardId"] = data.boardId
    
    if data.syncEnabled is not None:
        settings_data["syncEnabled"] = data.syncEnabled
    
    settings_data["updatedAt"] = datetime.now(timezone.utc)
    
    await settings_collection.update_one(
        {"type": "monday"},
        {"$set": settings_data},
        upsert=True
    )
    
    # Return updated settings
    result = await settings_collection.find_one({"type": "monday"})
    response = {
        "apiToken": "",
        "boardId": result.get("boardId", "") if result else "",
        "syncEnabled": result.get("syncEnabled", False) if result else False,
        "lastSyncAt": result.get("lastSyncAt") if result else None,
        "hasToken": bool(result.get("apiToken")) if result else False
    }
    if result and result.get("apiToken"):
        response["apiToken"] = result["apiToken"][:12] + "..." + result["apiToken"][-4:]
    return response

@app.post("/api/settings/monday/test")
async def test_monday_connection(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    monday_settings = await settings_collection.find_one({"type": "monday"})
    if not monday_settings or not monday_settings.get('apiToken'):
        return {"status": "not_configured", "message": "Monday.com not configured"}
    
    if not monday_settings.get('boardId'):
        return {"status": "failed", "message": "Board ID not configured"}
    
    try:
        board_id = monday_settings['boardId']
        query = f'query {{ boards(ids: {board_id}) {{ id name }} }}'
        result = await monday_api_call(monday_settings['apiToken'], query)
        
        if "errors" in result:
            return {"status": "failed", "message": result["errors"][0].get("message", "API error")}
        
        boards = result.get("data", {}).get("boards", [])
        if boards:
            return {
                "status": "connected",
                "message": f"Connected to board: {boards[0].get('name', 'Unknown')}",
                "boardName": boards[0].get('name')
            }
        else:
            return {"status": "failed", "message": "Board not found or access denied"}
    except Exception as e:
        return {"status": "failed", "message": str(e)}

@app.post("/api/settings/monday/create-structure")
async def create_monday_structure(user: dict = Depends(get_current_user)):
    """Create the required groups and columns in Monday.com board"""
    require_super_admin(user)
    
    monday_settings = await settings_collection.find_one({"type": "monday"})
    if not monday_settings or not monday_settings.get('apiToken'):
        raise HTTPException(status_code=400, detail="Monday.com not configured")
    
    result = await create_monday_board_structure(monday_settings)
    return result

@app.post("/api/settings/monday/sync")
async def trigger_monday_sync(user: dict = Depends(get_current_user)):
    require_super_admin(user)
    
    monday_settings = await settings_collection.find_one({"type": "monday"})
    if not monday_settings or not monday_settings.get('apiToken'):
        raise HTTPException(status_code=400, detail="Monday.com not configured")
    
    result = await sync_to_monday(monday_settings)
    return result


# ============== FIELD VISIBILITY ENDPOINTS ==============

@app.get("/api/settings/asset-field-visibility")
async def get_asset_field_visibility(user: dict = Depends(get_current_user)):
    """Get visibility settings for all asset type fields"""
    asset_types = await asset_types_collection.find({}).to_list(100)
    result = []
    for at in asset_types:
        result.append({
            "assetTypeId": str(at["_id"]),
            "assetTypeName": at.get("name", ""),
            "fields": at.get("fields", [])
        })
    return result

@app.put("/api/settings/asset-field-visibility/{type_id}")
async def update_asset_field_visibility(type_id: str, fields: List[dict], user: dict = Depends(get_current_user)):
    """Update visibility settings for a specific asset type's fields"""
    require_super_admin(user)
    
    await asset_types_collection.update_one(
        {"_id": ObjectId(type_id)},
        {"$set": {"fields": fields, "updatedAt": datetime.now(timezone.utc)}}
    )
    return {"message": "Field visibility updated"}

@app.get("/api/settings/employee-field-visibility")
async def get_employee_field_visibility(user: dict = Depends(get_current_user)):
    """Get visibility settings for employee fields"""
    settings = await settings_collection.find_one({"type": "employee_fields"})
    return {"fields": settings.get("fields", []) if settings else []}

@app.put("/api/settings/employee-field-visibility")
async def update_employee_field_visibility(fields: List[dict], user: dict = Depends(get_current_user)):
    """Update visibility settings for employee fields"""
    require_super_admin(user)
    
    await settings_collection.update_one(
        {"type": "employee_fields"},
        {"$set": {"fields": fields, "updatedAt": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"message": "Field visibility updated"}

@app.get("/api/settings/dashboard-fields")
async def get_dashboard_field_settings(user: dict = Depends(get_current_user)):
    """Get dashboard preview item count setting"""
    require_super_admin(user)
    settings = await settings_collection.find_one({"type": "app"})
    return {
        "previewCount": settings.get("previewCount", 5) if settings else 5
    }

@app.put("/api/settings/dashboard-fields")
async def update_dashboard_field_settings(data: dict, user: dict = Depends(get_current_user)):
    """Update dashboard preview item count"""
    require_super_admin(user)
    
    await settings_collection.update_one(
        {"type": "app"},
        {"$set": {"previewCount": data.get("previewCount", 5), "updatedAt": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"message": "Dashboard settings updated"}

# ============== CLEAR DATA ENDPOINTS ==============

@app.get("/api/clear/storage-stats")
async def get_storage_stats(user: dict = Depends(get_current_user)):
    """Get database storage stats and collection counts"""
    require_super_admin(user)
    try:
        stats = await db.command("dbStats")
    except Exception:
        stats = {}
    col_stats = {}
    collections_map = [
        ("employees", employees_collection),
        ("assets", assets_collection),
        ("transfers", transfers_collection),
        ("asset_types", asset_types_collection),
        ("users", users_collection),
        ("files", files_collection),
        ("subscriptions", subscriptions_collection),
    ]
    for name, col in collections_map:
        try:
            pipeline = [{"$collStats": {"storageStats": {}}}]
            cursor = col.aggregate(pipeline)
            result = await cursor.to_list(1)
            if result and result[0].get("storageStats"):
                s = result[0]["storageStats"]
                col_stats[name] = {
                    "count": s.get("count", 0),
                    "size": s.get("size", 0)
                }
            else:
                col_stats[name] = {"count": await col.count_documents({}), "size": 0}
        except Exception:
            col_stats[name] = {"count": await col.count_documents({}), "size": 0}
    return {
        "dataSize": stats.get("dataSize", 0),
        "storageSize": stats.get("storageSize", 0),
        "totalSize": stats.get("totalSize", stats.get("dataSize", 0)),
        "collections": col_stats,
        "objects": stats.get("objects", 0),
    }

@app.delete("/api/clear/employees")
async def clear_employees(user: dict = Depends(get_current_user)):
    """Delete all employees and unassign all assets"""
    require_super_admin(user)
    await employees_collection.delete_many({})
    # Unassign all assets
    await assets_collection.update_many({}, {"$set": {"assignedEmployeeId": None, "assignedEmployeeName": None}})
    return {"message": "All employees cleared. Assets have been unassigned."}

@app.delete("/api/clear/assets")
async def clear_assets(user: dict = Depends(get_current_user)):
    """Delete all assets and their transfer history"""
    require_super_admin(user)
    await assets_collection.delete_many({})
    await transfers_collection.delete_many({})
    return {"message": "All assets and transfer history cleared."}

@app.delete("/api/clear/transfers")
async def clear_transfers(user: dict = Depends(get_current_user)):
    """Delete all transfer history only"""
    require_super_admin(user)
    await transfers_collection.delete_many({})
    return {"message": "All transfer history cleared."}

@app.delete("/api/clear/branding-images")
async def clear_branding_images(user: dict = Depends(get_current_user)):
    """Remove branding images (logo, favicon, login background) + subscription logos"""
    require_super_admin(user)
    await settings_collection.update_one(
        {"type": "branding"},
        {"$unset": {"logoFileId": "", "faviconFileId": "", "loginBackgroundFileId": ""}},
    )
    # Also delete all subscription logo files from files_collection
    subs = await subscriptions_collection.find({"logoFileId": {"$exists": True, "$ne": None}}).to_list(1000)
    logo_ids = [ObjectId(s["logoFileId"]) for s in subs if s.get("logoFileId")]
    if logo_ids:
        await files_collection.delete_many({"_id": {"$in": logo_ids}})
        await subscriptions_collection.update_many({}, {"$unset": {"logoFileId": ""}})
    return {"message": f"Branding images and {len(logo_ids)} subscription logo(s) cleared."}


@app.delete("/api/clear/subscriptions")
async def clear_subscriptions(user: dict = Depends(get_current_user)):
    """Delete all subscriptions and their logo files"""
    require_super_admin(user)
    subs = await subscriptions_collection.find({"logoFileId": {"$exists": True, "$ne": None}}).to_list(1000)
    logo_ids = [ObjectId(s["logoFileId"]) for s in subs if s.get("logoFileId")]
    if logo_ids:
        await files_collection.delete_many({"_id": {"$in": logo_ids}})
    await subscriptions_collection.delete_many({})
    return {"message": f"All subscriptions and {len(logo_ids)} logo file(s) cleared."}

@app.delete("/api/clear/all")
async def clear_all_data(user: dict = Depends(get_current_user)):
    """Wipe all user data: employees, assets, transfers, asset types, subscriptions, branding images"""
    require_super_admin(user)
    await employees_collection.delete_many({})
    await assets_collection.delete_many({})
    await transfers_collection.delete_many({})
    await asset_types_collection.delete_many({})
    await subscriptions_collection.delete_many({})
    await files_collection.delete_many({})
    await settings_collection.update_one(
        {"type": "branding"},
        {"$unset": {"logoFileId": "", "faviconFileId": "", "loginBackgroundFileId": ""}},
    )
    return {"message": "All data cleared successfully."}


# ============== SUBSCRIPTIONS ENDPOINTS ==============

@app.get("/api/subscriptions")
async def get_subscriptions(user: dict = Depends(get_current_user)):
    docs = await subscriptions_collection.find({}).sort("createdAt", -1).to_list(1000)
    normalized = await normalize_subscriptions(docs)
    return serialize_docs(normalized)


# ============== FETCH LOGO / FAVICON FOR SUBSCRIPTIONS ==============

@app.post("/api/subscriptions/fetch-logo")
async def fetch_subscription_logo(data: dict, user: dict = Depends(get_current_user)):
    """Fetch favicon from a URL and store it in files_collection (same as other files)"""
    import httpx, base64
    from urllib.parse import urlparse
    url = data.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not url.startswith("http"):
        url = "https://" + url
    try:
        domain = urlparse(url).hostname
        if not domain:
            raise HTTPException(status_code=400, detail="Invalid URL")
        favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(favicon_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch favicon")
            img_bytes = resp.content
            if len(img_bytes) < 100:
                raise HTTPException(status_code=400, detail="Favicon too small or invalid")
        # Save as base64 in files_collection (same as rest of app)
        file_doc = {
            "filename": f"{domain}-favicon.png",
            "contentType": "image/png",
            "data": base64.b64encode(img_bytes).decode("utf-8"),
            "size": len(img_bytes),
            "uploadedAt": datetime.now(timezone.utc),
        }
        result = await files_collection.insert_one(file_doc)
        return {"fileId": str(result.inserted_id)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch logo: {str(e)}")

@app.get("/api/subscriptions/{sub_id}")
async def get_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    doc = await subscriptions_collection.find_one({"_id": ObjectId(sub_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Subscription not found")
    doc = await normalize_subscription_renewal(doc)
    return serialize_doc(doc)

@app.post("/api/subscriptions")
async def create_subscription(data: dict, user: dict = Depends(get_current_user)):
    if user.get("role") == "USER":
        raise HTTPException(status_code=403, detail="Not allowed")
    data = strip_subscription_computed_fields(data)
    data["createdAt"] = datetime.now(timezone.utc)
    data["updatedAt"] = datetime.now(timezone.utc)
    result = await subscriptions_collection.insert_one(data)
    doc = await subscriptions_collection.find_one({"_id": result.inserted_id})
    doc = await normalize_subscription_renewal(doc)
    return serialize_doc(doc)

@app.put("/api/subscriptions/{sub_id}")
async def update_subscription(sub_id: str, data: dict, user: dict = Depends(get_current_user)):
    if user.get("role") == "USER":
        raise HTTPException(status_code=403, detail="Not allowed")
    data = strip_subscription_computed_fields(data)
    data["updatedAt"] = datetime.now(timezone.utc)
    await subscriptions_collection.update_one({"_id": ObjectId(sub_id)}, {"$set": data})
    doc = await subscriptions_collection.find_one({"_id": ObjectId(sub_id)})
    doc = await normalize_subscription_renewal(doc)
    return serialize_doc(doc)

@app.post("/api/subscriptions/{sub_id}/renew")
async def renew_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    doc = await subscriptions_collection.find_one({"_id": ObjectId(sub_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if is_auto_recurring_subscription(doc):
        normalized = await normalize_subscription_renewal(doc)
        return serialize_doc(normalized)

    renewal_date = parse_subscription_date(doc.get("renewalDate")) or datetime.now(timezone.utc).date()
    if not is_recurring_subscription(doc):
        raise HTTPException(status_code=400, detail="Only monthly or yearly subscriptions can be renewed automatically")

    today = datetime.now(timezone.utc).date()
    next_date = add_subscription_cycle(renewal_date, doc.get("billingCycle"))
    if not next_date:
        raise HTTPException(status_code=400, detail="Unsupported billing cycle")

    for _ in range(240):
        if next_date >= today:
            break
        next_cycle = add_subscription_cycle(next_date, doc.get("billingCycle"))
        if not next_cycle:
            break
        next_date = next_cycle

    now = datetime.now(timezone.utc)
    await subscriptions_collection.update_one(
        {"_id": ObjectId(sub_id)},
        {
            "$set": {
                "renewalDate": next_date.isoformat(),
                "lastRenewedAt": now,
                "renewedBy": user["id"],
                "updatedAt": now,
            }
        }
    )
    updated = await subscriptions_collection.find_one({"_id": ObjectId(sub_id)})
    normalized = await normalize_subscription_renewal(updated)
    return serialize_doc(normalized)

@app.delete("/api/subscriptions/{sub_id}")
async def delete_subscription(sub_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "USER":
        raise HTTPException(status_code=403, detail="Not allowed")
    await subscriptions_collection.delete_one({"_id": ObjectId(sub_id)})
    return {"message": "Deleted"}

# ============== HEALTH CHECK ==============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
