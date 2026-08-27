"""Ramsboutique Vizag Clone - FastAPI backend."""
from email.mime import application
from fastapi import FastAPI, APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import csv
import io
import json
import hashlib
import random
import logging
import math
import re
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any
from datetime import datetime, timezone, timedelta

from auth_utils import (
    hash_password, verify_password, create_token,
    get_current_user, get_current_admin,
)
from seed_data import CATEGORIES, PRODUCTS, BANNERS
import razorpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
from chits import router as chits_router, seed_chit_data, start_chit_scheduler, stop_chit_scheduler
from catalog_sync import inspect_source, proposed_update
from dmart_sync import DMART_CATEGORIES, DMART_PINCODE, sync_categories

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Rams Boutique Vizag API")
api = APIRouter(prefix="/api")
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.ramsboutique.com",
    "https://ramsboutique.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Store location: Dwaraka Nagar, Visakhapatnam
STORE_LAT = 17.7231
STORE_LNG = 83.3012
DELIVERY_RADIUS_KM = 5.0

BLACKSMS_API_KEY = os.environ.get("BLACKSMS_API_KEY", "7704d6856e9ca0885ef6b1cb7df3cbb4")

# Razorpay
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
_rzp = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        _rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as e:
        logging.warning(f"Razorpay init failed: {e}")


# ============ MODELS ============
class SignupIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class LoginAgentIn(BaseModel):
    phone: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdateIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\d{10}$")

class OtpPhoneIn(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")

class OtpCodeVerifyIn(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=4, max_length=4)

class LocationCheckIn(BaseModel):
    lat: float
    lng: float


class Address(BaseModel):
    full_name: str
    phone: str
    line1: str
    line2: Optional[str] = ""
    city: str = "Visakhapatnam"
    pincode: str
    lat: float
    lng: float


class CartItem(BaseModel):
    product_id: str
    qty: float = Field(gt=0)
    unit: Optional[str] = None 
    price: Optional[float] = None
    mrp: Optional[float] = None

class CheckoutIn(BaseModel):
    items: List[CartItem]
    address: Address
    payment_method: str  # "COD" | "UPI" | "CARD"
    note: Optional[str] = ""
    coupon_code: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: Optional[str] = None 
    agent_id: Optional[str] = None


# 1. Schema validation model for individual product variants
class VariantItem(BaseModel):
    unit: str
    price: float
    mrp: float
    stock: int = 100


# 2. Embedded the variants array into your product input schema
class ProductIn(BaseModel):
    name: str
    brand: str
    category: str
    sub: str
    price: float
    mrp: float
    unit: str
    image: str
    desc: str
    stock: int = 100
    variants: Optional[List[VariantItem]] = []
    source_url: Optional[str] = ""
    auto_update_price: bool = False
    auto_update_mrp: bool = False
    auto_update_image: bool = True

class CatalogRefreshIn(BaseModel):
    apply: bool = False

class CatalogCsvSyncIn(BaseModel):
    csv_text: str = Field(min_length=1, max_length=5_000_000)

class DmartCategorySelectionIn(BaseModel):
    tokens: List[str]

class DmartSyncIn(BaseModel):
    tokens: Optional[List[str]] = None

class DmartCsvImportIn(BaseModel):
    csv_text: str = Field(min_length=1, max_length=25_000_000)

class ProductVisibilityIn(BaseModel):
    active: bool


class AgentIn(BaseModel):
    name: str
    phone: str
    active: bool = True


class CategoryIn(BaseModel):
    slug: str
    name: str
    icon: str = "cookie"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None


class CategoryReorderIn(BaseModel):
    slugs: List[str]


class CouponIn(BaseModel):
    code: str
    discount_type: str  # "flat" | "percent"
    value: float
    min_order: float = 0
    max_discount: float = 0  # 0 = no cap (only for percent)
    active: bool = True
    expires_at: Optional[str] = None  # ISO string; None = never


class CouponValidateIn(BaseModel):
    code: str
    subtotal: float


class RazorpayCreateIn(BaseModel):
    order_id: str  # our internal order id


class RazorpayVerifyIn(BaseModel):
    order_id: str  # our internal order id
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class SiteContentIn(BaseModel):
    top_strip: Optional[str] = None
    hero: Optional[dict] = None
    login: Optional[dict] = None
    footer: Optional[dict] = None
    store_hours: Optional[dict] = None


class PushSubscribeIn(BaseModel):
    endpoint: str
    keys: dict  # { p256dh, auth }


DEFAULT_STORE_HOURS = {
    "enabled": True,
    "timezone_offset_minutes": 330,  # IST = UTC+5:30
    "open": "07:00",   # 24h HH:MM
    "close": "22:00",
    "closed_days": [],  # 0=Mon .. 6=Sun
    "closed_message": "We are closed right now. Delivery hours: 7:00 AM – 10:00 PM.",
}


DEFAULT_SITE_CONTENT = {
    "top_strip": "Free delivery on orders above ₹499 • Serving Visakhapatnam within 5 km of Dwaraka Nagar",
    "hero": {
        "pill": "Rams Boutique Vizag",
        "title": "Everyday Low Prices, delivered to your doorstep",
        "subtitle": "Groceries, staples, dairy, personal care and more – fresh in Visakhapatnam within 60 minutes.",
        "cta1_text": "Shop Groceries",
        "cta1_link": "/c/grocery",
        "cta2_text": "Fresh Produce",
        "cta2_link": "/c/fruits-vegetables",
        "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80"
        },
    "login": {
        "welcome": "Welcome",
        "subheading": "Login or sign up to continue",
        "footer": "By continuing you agree to Rams Boutique Terms of Service and Privacy Policy.",
    },
    "footer": {
        "description": "Everyday low prices delivered fresh across Visakhapatnam within 5 km of our Dwaraka Nagar store.",
        "tagline": "Authentic. Aromatic. Indulgent.",
        "address": "Dwaraka Nagar, Visakhapatnam, AP 530016",
        "phone": "807-476-3983",
        "email": "info@ramsboutique.com",
        "facebook": "https://facebook.com/ramsboutique",
        "instagram": "https://instagram.com/ramsboutique",
        "twitter": "https://twitter.com/ramsboutique",
        "youtube": "https://youtube.com/ramsboutique",
        "copyright": "© 2026 Rams Boutique. All rights reserved.",
    },
    "store_hours": DEFAULT_STORE_HOURS,
}


# ============ HELPERS ============
def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_store_hours():
    doc = await db.site_content.find_one({"id": "site"})
    if not doc or not doc.get("store_hours"):
        return DEFAULT_STORE_HOURS
    return {**DEFAULT_STORE_HOURS, **doc["store_hours"]}


def is_store_open(hours: dict):
    if not hours.get("enabled", True):
        return True, ""
    offset = hours.get("timezone_offset_minutes", 330)
    local_now = datetime.now(timezone.utc) + timedelta(minutes=offset)
    weekday = local_now.weekday()  # 0=Mon .. 6=Sun
    if weekday in (hours.get("closed_days") or []):
        return False, hours.get("closed_message", "Store is closed today.")
    try:
        oh, om = [int(x) for x in hours.get("open", "07:00").split(":")]
        ch, cm = [int(x) for x in hours.get("close", "22:00").split(":")]
    except (ValueError, AttributeError):
        return True, ""
    cur_mins = local_now.hour * 60 + local_now.minute
    open_mins = oh * 60 + om
    close_mins = ch * 60 + cm
    if open_mins <= cur_mins < close_mins:
        return True, ""
    return False, hours.get("closed_message", "Store is closed right now.")


# ============ Push notifications helper ============
_vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "kI7cIn9-gA_eGAgT4Wf8PyPfCaW1qscTf7cxxaOEtKM")
_vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "BL3tGDHxqhsxGqhgQJC7EcdWyC5GG0GqdcOGMwbZCQB-4XEp6KXD8D7uRMqSYZILjCtYpNRnndaYdVgC1Bw_-mQ")
_vapid_claim = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:info@ramsboutique.com")


async def send_web_push(subscription: dict, title: str, body: str, url: str = "/"):
    """Send a Web Push notification. Best-effort — swallows errors."""
    if not _vapid_private:
        return
    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": subscription["keys"],
            },
            data=_json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=_vapid_private,
            vapid_claims={"sub": _vapid_claim},
        )
    except Exception as e:
        logging.warning(f"Push failed: {e}")
        try:
            if "410" in str(e) or "404" in str(e):
                await db.push_subs.delete_one({"endpoint": subscription["endpoint"]})
        except Exception:
            pass


async def push_to_user(user_id: str, title: str, body: str, url: str = "/"):
    subs = await db.push_subs.find({"user_id": user_id}).to_list(20)
    for s in subs:
        await send_web_push(s, title, body, url)


# ============ Coupon helper ============
async def resolve_coupon(code: str, subtotal: float):
    """Return (discount, coupon_doc) or (0, None). Raises HTTPException if invalid code provided."""
    if not code:
        return 0.0, None
    c = await db.coupons.find_one({"code": code.upper().strip()})
    if not c:
        raise HTTPException(400, "Invalid coupon code")
    if not c.get("active", True):
        raise HTTPException(400, "This coupon is no longer active")
    exp = c.get("expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(400, "This coupon has expired")
        except ValueError:
            pass
    if subtotal < (c.get("min_order") or 0):
        raise HTTPException(400, f"Add items worth ₹{int(c['min_order'])} to use this coupon")
    if c["discount_type"] == "flat":
        disc = min(c["value"], subtotal)
    else:  # percent
        disc = subtotal * (c["value"] / 100.0)
        if c.get("max_discount"):
            disc = min(disc, c["max_discount"])
    return round(disc, 2), c


# ============ SEED ============
async def seed_db():
    if await db.categories.count_documents({}) == 0:
        for idx, c in enumerate(CATEGORIES):
            await db.categories.insert_one({"id": c["slug"], "order": idx, **c})
        logging.info("Seeded categories")
    else:
        async for doc in db.categories.find({"order": {"$exists": False}}):
            await db.categories.update_one({"_id": doc["_id"]}, {"$set": {"order": 999}})

    # One-time initial menu choice requested by the store administrator.
    # The migration marker prevents later Azure restarts from hiding a category
    # again after the administrator has restored it.
    category_visibility_migration = "hide_personal_home_baby_categories_v1"
    if not await db.app_migrations.find_one({"id": category_visibility_migration}):
        await db.categories.update_many(
            {"slug": {"$in": ["personal-care", "home-care", "baby-care"]}},
            {"$set": {"active": False, "updated_at": now_iso()}},
        )
        await db.app_migrations.insert_one({
            "id": category_visibility_migration,
            "applied_at": now_iso(),
        })
        logging.info("Initially hid Personal Care, Home Care and Baby Care menu categories")

    if await db.products.count_documents({}) == 0:
        for p in PRODUCTS:
            doc = {
                "id": str(uuid.uuid4()),
                **p,
                "stock": 100,
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
        logging.info(f"Seeded {len(PRODUCTS)} products")

    # Import the public Seethammadhara catalogue without overwriting products
    # that an administrator has already edited.  source_key makes the import
    # idempotent, including rows where the source site exposes no product UUID.
    market_csv = ROOT_DIR / "seethammadhara_products.csv"
    # The bundled CSV is only an initial bootstrap. Once a DRB catalogue exists,
    # Admin CSV Sync is authoritative; Azure restarts must not recreate rows
    # that an administrator has removed from a later CSV.
    if market_csv.exists() and await db.products.count_documents({"source_market": "seethammadhara"}) == 0:
        category_map = {
            "groceries": ("grocery", "Grocery & Staples", "wheat"),
            "fruits": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
            "vegetables": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
            "leafy green": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
            "flowers": ("flowers", "Flowers", "sparkles"),
        }
        imported = 0
        with market_csv.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                source_category = (row.get("category") or "Groceries").strip()
                category, category_name, category_icon = category_map.get(
                    source_category.lower(), ("grocery", "Grocery & Staples", "wheat")
                )
                await db.categories.update_one(
                    {"id": category},
                    {"$setOnInsert": {
                        "id": category, "slug": category, "name": category_name,
                        "icon": category_icon, "order": 50,
                    }},
                    upsert=True,
                )

                raw_key = (row.get("product_id") or "").strip()
                if not raw_key:
                    raw_key = hashlib.sha256(
                        ((row.get("source_url") or "") + "|" + (row.get("image_url") or "")).encode("utf-8")
                    ).hexdigest()
                price = max(float(row.get("price") or 0), 0)
                mrp = max(float(row.get("mrp") or price), price)
                doc = {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"seethammadhara:{raw_key}")),
                    "source_key": raw_key,
                    "source_product_id": (row.get("product_id") or "").strip(),
                    "source_market": "seethammadhara",
                    "name": (row.get("name") or "").strip(),
                    "name_te": (row.get("name_telugu") or "").strip(),
                    "name_hi": (row.get("name_hindi") or "").strip(),
                    "brand": "Digi Rythu Bazaar",
                    "category": category,
                    "sub": source_category,
                    "price": price,
                    "mrp": mrp,
                    "unit": (row.get("unit") or "piece").strip(),
                    "image": (row.get("image_url") or "").strip(),
                    "desc": (row.get("description") or "").strip(),
                    "stock": 100,
                    "variants": [],
                    "source_url": (row.get("source_url") or "").strip(),
                    "auto_update_price": True,
                    "auto_update_mrp": True,
                    "auto_update_image": True,
                    "active": str(row.get("active") or "true").strip().lower() not in {"false", "0", "no", "hidden", "inactive"},
                    "created_at": now_iso(),
                }
                await db.products.update_one(
                    {"source_market": "seethammadhara", "source_key": raw_key},
                    {"$setOnInsert": doc},
                    upsert=True,
                )
                imported += 1
        logging.info("Ensured %s Seethammadhara products are available", imported)

    if await db.banners.count_documents({}) == 0:
        for b in BANNERS:
            await db.banners.insert_one({"id": str(uuid.uuid4()), **b})

    # Default admin
    if not await db.users.find_one({"email": "admin@ramsboutique.com"}):
        await db.users.delete_many({"role": "admin"})
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@ramsboutique.com",
            "phone": "9999999999",
            "password": hash_password("admin123"),
            "role": "admin",
            "created_at": now_iso(),
        })
        logging.info("Seeded default admin: admin@ramsboutique.com / admin123")

    # Sample delivery agents
    if await db.agents.count_documents({}) == 0:
        for name, phone in [("Ravi Kumar", "9000000001"), ("Suresh N", "9000000002"), ("Anil B", "9000000003")]:
            await db.agents.insert_one({"id": str(uuid.uuid4()), "name": name, "phone": phone, "active": True})

    # Site content (singleton)
    if not await db.site_content.find_one({"id": "site"}):
        await db.site_content.insert_one({"id": "site", **DEFAULT_SITE_CONTENT, "updated_at": now_iso()})
        logging.info("Seeded default site content")


# ============ AUTH ============
@api.post("/auth/signup")
async def signup(data: SignupIn):
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "password": hash_password(data.password),
        "role": "user",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], "user")
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": "user"}}


@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": user["role"]}}

@api.post("/auth/agent")
async def agent(data: LoginAgentIn):
    phone = data.phone.strip()
    user = await db.agents.find_one({
        "phone": phone,
        "active": True
    })
    if not user:
        raise HTTPException(401, "Mobile number not found in Agent collection.")
    token = create_token(user["id"], "agent")
    return {
        "token": token,
        "agent_id": user["id"],
        "name": user["name"],
        "phone": user["phone"],
        "role": "agent"
    }

@api.get("/debug/agents")
async def debug_agents():
    docs = await db.agents.find().to_list(100)
    return [clean(d) for d in docs]

@api.post("/auth/admin-login")
async def admin_login(data: LoginIn):
    user = await db.users.find_one({"email": data.email, "role": "admin"})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid admin credentials")
    token = create_token(user["id"], "admin")
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": "admin"}}

@api.post("/auth/send-otp")
async def send_low_cost_non_dlt_sms(data: OtpPhoneIn):
    try:
        mobile_number = data.phone.strip()[-10:]
        user_record = await db.users.find_one({"phone": mobile_number, "role": "user"})
        if not user_record:
            raise HTTPException(404, "The Mobile number is not registered. Kindly, Signup")
        generated_code = f"{random.randint(1000, 9999)}"
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=5)
        await db.user_otps.update_one(
            {"phone": mobile_number},
            {
                "$set": {
                    "otp_code": generated_code,
                    "expires_at": expiry_time,
                    "is_verified": False
                }
            },
            upsert=True
        )
        clean_api_key = BLACKSMS_API_KEY.replace("Bearer ", "").strip()
        blacksms_endpoint = "https://blacksms.in/sms"
        gateway_payload = {
            "api_key": clean_api_key,
            "numbers": mobile_number,
            "variables_values": generated_code,
            "sender_id": "520",
            "route": "1"
        }
        headers = {
            "Authorization": clean_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(blacksms_endpoint, json=gateway_payload, headers=headers)
            print(f"\n" + "═"*50)
            print(f"📡 [BLACKSMS LIVE GATEWAY RESPONSE]")
            print(f"Status Code: {response.status_code}")
            print(f"Raw Body: {response.text}")
            print("═"*50 + "\n")
            if response.status_code != 200:
                raise ValueError(f"Gateway HTTP Error {response.status_code}: {response.text[:100]}")
            try:
                response_data = response.json()
            except Exception:
                raise ValueError(f"Server returned plain text instead of JSON: {response.text[:100]}")
            if response_data.get("status") == "error" or response_data.get("status") == "failed":
                raise ValueError(response_data.get("message", "API parameters or balance rejected."))
        return {"status": "Success", "message": "OTP successfully triggered live via non-DLT channels."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live Gateway Error: {str(e)}")    

@api.post("/auth/verify-otp")
async def verify_otp_and_login(data: OtpCodeVerifyIn):
    mobile = data.phone.strip()
    user_otp = data.otp.strip()
    otp_record = await db.user_otps.find_one({"phone": mobile})
    if not otp_record:
        raise HTTPException(404, "No active session authentication record found for this number.")
    current_time = datetime.now(timezone.utc)
    record_expiry = otp_record["expires_at"].replace(tzinfo=timezone.utc)
    if current_time > record_expiry:
        raise HTTPException(410, "The verification code has expired. Please send a new one.")
    if otp_record["otp_code"] != user_otp:
        raise HTTPException(401, "Invalid code entered. Please double check.")
    await db.user_otps.delete_one({"phone": mobile})
    user = await db.users.find_one({"phone": mobile, "role": "user"})
    if not user:
        raise HTTPException(404, "The Mobile number is not registered. Kindly, Signup")
    token = create_token(user["id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "phone": user["phone"],
            "role": user["role"],
            "name": user.get("name", f"Customer {user['phone'][-4:]}"),
            "email": user.get("email", f"user_{user['phone']}@ramsboutique.com")
        }
    }

@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": user["role"]}


@api.patch("/auth/me")
async def update_my_profile(data: ProfileUpdateIn, current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["user_id"]})
    if not user: raise HTTPException(404, "User not found")
    email = str(data.email).strip().lower()
    phone = data.phone.strip()
    duplicate = await db.users.find_one({"id": {"$ne": current["user_id"]}, "$or": [{"email": email}, {"phone": phone}]})
    if duplicate:
        if duplicate.get("email") == email: raise HTTPException(409, "Email address is already registered")
        raise HTTPException(409, "Mobile number is already registered")
    await db.users.update_one({"id": current["user_id"]}, {"$set": {
        "name": data.name.strip(), "email": email, "phone": phone, "updated_at": now_iso()}})
    updated = await db.users.find_one({"id": current["user_id"]})
    return {"id": updated["id"], "name": updated["name"], "email": updated["email"], "phone": updated["phone"], "role": updated["role"]}


# ============ LOCATION ============
@api.post("/location/check")
async def check_location(data: LocationCheckIn):
    dist = haversine_km(STORE_LAT, STORE_LNG, data.lat, data.lng)
    return {
        "deliverable": dist <= DELIVERY_RADIUS_KM,
        "distance_km": round(dist, 2),
        "radius_km": DELIVERY_RADIUS_KM,
        "store": {"lat": STORE_LAT, "lng": STORE_LNG, "name": "DMart Dwaraka Nagar, Visakhapatnam"},
    }


# ============ STORE STATUS ============
@api.get("/store-status")
async def store_status():
    hours = await get_store_hours()
    open_now, msg = is_store_open(hours)
    return {"open": open_now, "message": msg, "hours": hours}


# ============ PUSH NOTIFICATIONS ============
@api.get("/push/public-key")
async def push_public_key():
    return {"public_key": _vapid_public}


@api.post("/push/subscribe")
async def push_subscribe(sub: PushSubscribeIn, current=Depends(get_current_user)):
    doc = {
        "endpoint": sub.endpoint,
        "keys": sub.keys,
        "user_id": current["user_id"],
        "created_at": now_iso(),
    }
    await db.push_subs.update_one({"endpoint": sub.endpoint}, {"$set": doc}, upsert=True)
    return {"ok": True}


@api.post("/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscribeIn, current=Depends(get_current_user)):
    await db.push_subs.delete_one({"endpoint": sub.endpoint, "user_id": current["user_id"]})
    return {"ok": True}


# ============ CATEGORIES ============
@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({"active": {"$ne": False}}).to_list(200)
    docs.sort(key=lambda d: (d.get("order", 1000), d.get("name", "")))
    return [clean(d) for d in docs]

@api.get("/admin/categories")
async def admin_list_categories(_=Depends(get_current_admin)):
    docs = await db.categories.find().to_list(200)
    docs.sort(key=lambda d: (d.get("order", 1000), d.get("name", "")))
    return [clean(d) for d in docs]


@api.post("/admin/categories")
async def admin_create_category(c: CategoryIn, _=Depends(get_current_admin)):
    slug = c.slug.strip().lower().replace(" ", "-")
    if not slug:
        raise HTTPException(400, "Slug is required")
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(400, "Slug already exists")
    max_order = await db.categories.count_documents({})
    doc = {"id": slug, "slug": slug, "name": c.name, "icon": c.icon, "order": max_order, "active": True}
    await db.categories.insert_one(doc)
    return clean(doc)


@api.patch("/admin/categories/reorder")
async def admin_reorder_categories(data: CategoryReorderIn, _=Depends(get_current_admin)):
    for idx, slug in enumerate(data.slugs):
        await db.categories.update_one({"slug": slug}, {"$set": {"order": idx}})
    return {"ok": True}


@api.patch("/admin/categories/{slug}")
async def admin_update_category(slug: str, c: CategoryUpdate, _=Depends(get_current_admin)):
    upd = {k: v for k, v in c.dict(exclude_unset=True).items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await db.categories.update_one({"slug": slug}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    doc = await db.categories.find_one({"slug": slug})
    return clean(doc)


@api.delete("/admin/categories/{slug}")
async def admin_delete_category(slug: str, _=Depends(get_current_admin)):
    prod_count = await db.products.count_documents({"category": slug})
    if prod_count > 0:
        raise HTTPException(400, f"Cannot delete: {prod_count} product(s) are in this category. Move them first.")
    res = await db.categories.delete_one({"slug": slug})
    if res.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    return {"ok": True}

@api.patch("/admin/categories/{slug}/visibility")
async def admin_category_visibility(slug: str, payload: ProductVisibilityIn, _=Depends(get_current_admin)):
    result = await db.categories.update_one(
        {"slug": slug},
        {"$set": {"active": payload.active, "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Category not found")
    return clean(await db.categories.find_one({"slug": slug}))


# ============ COUPONS ============
@api.post("/coupons/validate")
async def validate_coupon(data: CouponValidateIn):
    disc, c = await resolve_coupon(data.code, data.subtotal)
    return {
        "valid": True,
        "code": c["code"],
        "discount": disc,
        "discount_type": c["discount_type"],
        "value": c["value"],
    }


@api.get("/admin/coupons")
async def admin_list_coupons(_=Depends(get_current_admin)):
    docs = await db.coupons.find().sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


@api.post("/admin/coupons")
async def admin_create_coupon(c: CouponIn, _=Depends(get_current_admin)):
    code = c.code.upper().strip()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "Coupon code already exists")
    if c.discount_type not in ("flat", "percent"):
        raise HTTPException(400, "discount_type must be 'flat' or 'percent'")
    doc = {"id": str(uuid.uuid4()), **c.dict(), "code": code, "created_at": now_iso()}
    await db.coupons.insert_one(doc)
    return clean(doc)


@api.patch("/admin/coupons/{cid}")
async def admin_update_coupon(cid: str, c: CouponIn, _=Depends(get_current_admin)):
    upd = c.dict()
    upd["code"] = upd["code"].upper().strip()
    res = await db.coupons.update_one({"id": cid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.coupons.find_one({"id": cid})
    return clean(doc)


@api.delete("/admin/coupons/{cid}")
async def admin_delete_coupon(cid: str, _=Depends(get_current_admin)):
    await db.coupons.delete_one({"id": cid})
    return {"ok": True}


# ============ RAZORPAY PAYMENTS ============
@api.get("/payments/razorpay/config")
async def rzp_config():
    return {"key_id": RAZORPAY_KEY_ID, "enabled": _rzp is not None}


@api.post("/payments/razorpay/create-order")
async def rzp_create_order(data: RazorpayCreateIn, current=Depends(get_current_user)):
    if not _rzp:
        raise HTTPException(500, "Razorpay is not configured")
    order = await db.orders.find_one({"id": data.order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != current["user_id"]:
        raise HTTPException(403, "Forbidden")
    if order["payment_method"] not in ("UPI", "CARD"):
        raise HTTPException(400, "This order is not for online payment")
    if order.get("payment_status") == "paid":
        raise HTTPException(400, "Order already paid")
    amount_paise = int(round(float(order["total"]) * 100))
    try:
        rzp_order = _rzp.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["order_no"][:40],
            "payment_capture": 1,
            "notes": {
                "internal_order_id": order["id"],
                "user_id": current["user_id"],
                "total_charged": str(order["total"]),
                "store": "Rams Boutique Vizag",
            },
        })
    except Exception as e:
        logging.exception("Razorpay order.create failed")
        raise HTTPException(500, f"Razorpay error: {e}")
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {"razorpay_order_id": rzp_order["id"], "razorpay_amount": amount_paise}},
    )
    return {
        "key_id": RAZORPAY_KEY_ID,
        "razorpay_order_id": rzp_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "order_no": order["order_no"],
    }


@api.post("/payments/razorpay/verify")
async def rzp_verify(data: RazorpayVerifyIn, current=Depends(get_current_user)):
    if not _rzp:
        raise HTTPException(500, "Razorpay is not configured")
    order = await db.orders.find_one({"id": data.order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["user_id"] != current["user_id"]:
        raise HTTPException(403, "Forbidden")
    try:
        _rzp.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature,
        })
    except Exception as e:
        logging.warning(f"Razorpay signature verification failed: {e}")
        await db.orders.update_one({"id": data.order_id}, {"$set": {"payment_status": "failed"}})
        raise HTTPException(400, "Payment signature verification failed")
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": data.razorpay_payment_id,
            "paid_at": now_iso(),
        }},
    )
    doc = await db.orders.find_one({"id": data.order_id})
    try:
        await push_to_user(
            current["user_id"],
            f"Rams Boutique • Payment received",
            f"Payment of ₹{int(doc['total'])} confirmed for order {doc['order_no']}.",
            url="/orders",
        )
    except Exception:
        pass
    return clean(doc)


@api.post("/payments/razorpay/cancel")
async def rzp_cancel(data: RazorpayCreateIn, current=Depends(get_current_user)):
    order = await db.orders.find_one({"id": data.order_id})
    if not order or order["user_id"] != current["user_id"]:
        raise HTTPException(404, "Order not found")
    await db.orders.update_one(
        {"id": data.order_id},
        {"$set": {"payment_status": "cancelled"}},
    )
    return {"ok": True}


# ============ BANNERS ============
@api.get("/banners")
async def list_banners():
    docs = await db.banners.find().to_list(20)
    return [clean(d) for d in docs]


# ============ SITE CONTENT ============
@api.get("/site-content")
async def get_site_content():
    doc = await db.site_content.find_one({"id": "site"})
    if not doc:
        return DEFAULT_SITE_CONTENT
    return clean(doc)


@api.put("/admin/site-content")
async def update_site_content(data: SiteContentIn, _=Depends(get_current_admin)):
    update = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    update["updated_at"] = now_iso()
    await db.site_content.update_one({"id": "site"}, {"$set": update}, upsert=True)
    doc = await db.site_content.find_one({"id": "site"})
    return clean(doc)


# ============ PRODUCTS ============
@api.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(default=500, ge=1, le=1000),
):
    query: dict = {"active": {"$ne": False}}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query).limit(limit).to_list(limit)
    return [clean(d) for d in docs]


@api.get("/products/{pid}")
async def get_product(pid: str):
    doc = await db.products.find_one({"id": pid})
    if not doc:
        raise HTTPException(404, "Product not found")
    return clean(doc)

# ============ DYNAMIC VARIANT-AWARE ORDER ROUTE ============
@api.post("/orders")
async def create_order(data: CheckoutIn, current=Depends(get_current_user)):
    hours = await get_store_hours()
    open_now, msg = is_store_open(hours)
    if not open_now: raise HTTPException(400, msg)

    dist = haversine_km(STORE_LAT, STORE_LNG, data.address.lat, data.address.lng)
    if dist > DELIVERY_RADIUS_KM: raise HTTPException(400, "Too far away")

    items_full = []
    subtotal = 0.0
    
    for it in data.items:
        p = await db.products.find_one({"id": it.product_id})
        if not p: raise HTTPException(400, f"Invalid product {it.product_id}")
        
        # 1. Start with the catalog base parameters as default values
        target_price = p["price"]
        target_mrp = p["mrp"]
        target_unit = p["unit"]
        match = None
        
        # 2. 👇 CRITICAL UPDATE: If a variant unit name is provided, search the product's internal nested variants list
        if it.unit and "variants" in p and p["variants"]:
            # Find the specific variant dictionary option where the unit matches (e.g., '1kg', '500g')
            match = next((v for v in p["variants"] if v.get("unit") == it.unit), None)
            if match:
                target_price = match.get("price", target_price)
                target_mrp = match.get("mrp", target_mrp)
                target_unit = match.get("unit", target_unit)
        
        qty = round(float(it.qty), 2)
        is_kg = bool(re.fullmatch(r"(?:1\s*)?kg", str(target_unit).strip(), re.I))
        if is_kg:
            if abs((qty * 4) - round(qty * 4)) > 1e-9:
                raise HTTPException(400, f"{p['name']} must be ordered in 0.25 kg steps")
        elif not qty.is_integer():
            raise HTTPException(400, f"{p['name']} must be ordered in whole units")

        line = {
            "product_id": p["id"],
            "name": p["name"],
            "image": p["image"],
            "price": float(target_price),
            "mrp": float(target_mrp),
            "unit": str(target_unit),
            "qty": qty,
            "total": round(float(target_price * qty), 2),
        }
        subtotal += line["total"]
        items_full.append(line)

    settings = await db.chit_settings.find_one({"id": "chit_settings"})
    configured_delivery_fee = int((settings or {}).get("delivery_charge_paise", 4_000)) / 100
    delivery_fee = 0 if subtotal >= 499 else configured_delivery_fee
    discount, coupon_doc = await resolve_coupon(data.coupon_code, subtotal)
    total = max(0, subtotal + delivery_fee - discount)

    order = {
        "id": str(uuid.uuid4()),
        "order_no": f"RB{datetime.now().strftime('%y%m%d')}{str(uuid.uuid4())[:6].upper()}",
        "user_id": current["user_id"],
        "items": items_full,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "discount": round(discount, 2),
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "total": round(total, 2), # 👈 This is the absolute field Razorpay reads!
        "address": data.address.dict(),
        "note": (data.note or "").strip()[:500],
        "payment_method": data.payment_method,
        "payment_status": "pending",
        "status": "placed",
        "agent_id": None,
        "created_at": now_iso(),
        "distance_km": round(dist, 2),
    }
    await db.orders.insert_one(order)
    return clean(order)


@api.get("/orders/my")
async def my_orders(current=Depends(get_current_user)):
    docs = await db.orders.find({"user_id": current["user_id"]}).sort("created_at", -1).to_list(200)
    return [clean(d) for d in docs]


@api.get("/orders/{oid}")
async def get_order(oid: str, current=Depends(get_current_user)):
    doc = await db.orders.find_one({"id": oid})
    if not doc:
        raise HTTPException(404, "Order not found")
    if current["role"] != "admin" and doc["user_id"] != current["user_id"]:
        raise HTTPException(403, "Forbidden")
    return clean(doc)


@api.post("/orders/{oid}/cancel")
async def cancel_my_unpaid_order(oid: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"id": oid, "user_id": current["user_id"]})
    if not order: raise HTTPException(404, "Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(409, "Paid orders cannot be self-cancelled. Please contact customer support.")
    if order.get("status") != "placed":
        raise HTTPException(409, f"Order cannot be cancelled after it is {order.get('status', 'processed')}")
    result = await db.orders.delete_one(
        {"id": oid, "user_id": current["user_id"], "status": "placed", "payment_status": {"$ne": "paid"}},
    )
    if not result.deleted_count: raise HTTPException(409, "Order status changed; refresh and try again")
    return {"ok": True, "deleted": True, "order_id": oid}


# ============ ADMIN ============
@api.get("/admin/stats")
async def admin_stats(_=Depends(get_current_admin)):
    total_orders = await db.orders.count_documents({})
    placed = await db.orders.count_documents({"status": "placed"})
    delivered = await db.orders.count_documents({"status": "delivered"})
    total_products = await db.products.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    total_agents = await db.agents.count_documents({})
    pipeline = [{"$match": {"status": {"$ne": "cancelled"}}}, {"$group": {"_id": None, "sum": {"$sum": "$total"}}}]
    agg = await db.orders.aggregate(pipeline).to_list(1)
    revenue = agg[0]["sum"] if agg else 0
    return {
        "total_orders": total_orders,
        "pending_orders": placed,
        "delivered_orders": delivered,
        "revenue": round(revenue, 2),
        "total_products": total_products,
        "total_users": total_users,
        "total_agents": total_agents,
    }


@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, _=Depends(get_current_admin)):
    q = {}
    if status:
        q["status"] = status
    docs = await db.orders.find(q).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


@api.patch("/admin/orders/{oid}")
async def admin_update_order(oid: str, data: OrderStatusUpdate, _=Depends(get_current_admin)):
    update = {"status": data.status}
    if data.agent_id is not None:
        update["agent_id"] = data.agent_id
    res = await db.orders.update_one({"id": oid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Order not found")
    doc = await db.orders.find_one({"id": oid})
    try:
        status_msg = {
            "placed": "Your order has been placed.",
            "packed": "Your order is packed and ready.",
            "out_for_delivery": "Your order is out for delivery!",
            "delivered": "Your order has been delivered. Enjoy!",
            "cancelled": "Your order was cancelled.",
        }.get(data.status, f"Order status updated to {data.status}")
        await push_to_user(
            doc["user_id"],
            f"Rams Boutique • Order {doc['order_no']}",
            status_msg,
            url=f"/orders",
        )
    except Exception as e:
        logging.warning(f"push_to_user failed: {e}")
    return clean(doc)


@api.post("/admin/products")
async def admin_create_product(p: ProductIn, _=Depends(get_current_admin)):
    doc = {"id": str(uuid.uuid4()), **p.dict(), "created_at": now_iso()}
    await db.products.insert_one(doc)
    return clean(doc)

@api.get("/admin/products")
async def admin_list_products(limit: int = Query(default=1000, ge=1, le=2000), _=Depends(get_current_admin)):
    docs = await db.products.find().limit(limit).to_list(limit)
    return [clean(doc) for doc in docs]


@api.patch("/admin/products/{pid}")
async def admin_update_product(pid: str, p: ProductIn, _=Depends(get_current_admin)):
    res = await db.products.update_one({"id": pid}, {"$set": p.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"id": pid})
    return clean(doc)


@api.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, _=Depends(get_current_admin)):
    product = await db.products.find_one({"id": pid})
    if not product:
        raise HTTPException(404, "Not found")
    if product.get("source_market") == "seethammadhara":
        await db.products.update_one(
            {"id": pid},
            {"$set": {"active": False, "inactive_reason": "admin_deleted", "updated_at": now_iso()}},
        )
    else:
        await db.products.delete_one({"id": pid})
    return {"ok": True}

@api.patch("/admin/products/{pid}/visibility")
async def admin_product_visibility(pid: str, payload: ProductVisibilityIn, _=Depends(get_current_admin)):
    result = await db.products.update_one(
        {"id": pid},
        {"$set": {
            "active": payload.active,
            "inactive_reason": None if payload.active else "admin_hidden",
            "updated_at": now_iso(),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Not found")
    return clean(await db.products.find_one({"id": pid}))

async def create_admin_notification(title: str, message: str, level: str = "error", details=None):
    doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "message": message,
        "level": level,
        "details": details or [],
        "read": False,
        "created_at": now_iso(),
    }
    await db.admin_notifications.insert_one(doc)

@api.get("/admin/notifications")
async def admin_notifications(_=Depends(get_current_admin)):
    docs = await db.admin_notifications.find().to_list(100)
    docs.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return [clean(doc) for doc in docs[:50]]

@api.post("/admin/notifications/read-all")
async def admin_notifications_read_all(_=Depends(get_current_admin)):
    await db.admin_notifications.update_many({"read": {"$ne": True}}, {"$set": {"read": True}})
    return {"ok": True}


# ============ DMART CATALOGUE ============
@api.get("/admin/dmart/categories")
async def admin_dmart_categories(_=Depends(get_current_admin)):
    saved = await db.dmart_categories.find().to_list(100)
    by_token = {item.get("token"): item for item in saved}
    result = []
    for token, name in DMART_CATEGORIES:
        current = by_token.get(token, {})
        category_products = await db.products.find(
            {"source_market": "dmart", "source_category_token": token}, {"name": 1}
        ).to_list(5000)
        product_count = sum(
            1 for product in category_products
            if not str(product.get("name") or "").strip().casefold().startswith("dmart")
        )
        result.append({
            "token": token, "name": name, "enabled": bool(current.get("enabled", False)),
            "product_count": product_count, "total_records": current.get("total_records", 0),
            "last_synced_at": current.get("last_synced_at"), "last_error": current.get("last_error"),
        })
    return {"pincode": DMART_PINCODE, "categories": result}


@api.put("/admin/dmart/categories")
async def admin_save_dmart_categories(payload: DmartCategorySelectionIn, _=Depends(get_current_admin)):
    known = {token for token, _name in DMART_CATEGORIES}
    selected = set(payload.tokens)
    invalid = sorted(selected - known)
    if invalid:
        raise HTTPException(400, "Unknown DMart categories: " + ", ".join(invalid))
    hidden = restored = 0
    for token, name in DMART_CATEGORIES:
        enabled = token in selected
        await db.dmart_categories.update_one(
            {"token": token},
            {"$set": {"token": token, "name": name, "enabled": enabled, "updated_at": now_iso()}},
            upsert=True,
        )
        if enabled:
            result = await db.products.update_many(
                {"source_market": "dmart", "source_category_token": token,
                 "inactive_reason": "category_disabled"},
                {"$set": {"active": True, "inactive_reason": None, "updated_at": now_iso()}},
            )
            restored += result.modified_count
        else:
            result = await db.products.update_many(
                {"source_market": "dmart", "source_category_token": token, "active": {"$ne": False}},
                {"$set": {"active": False, "inactive_reason": "category_disabled", "updated_at": now_iso()}},
            )
            hidden += result.modified_count
    return {"selected": len(selected), "hidden": hidden, "restored": restored}


@api.get("/admin/dmart/export-script.js")
async def admin_dmart_export_script(tokens: str = "", _=Depends(get_current_admin)):
    known = {token for token, _name in DMART_CATEGORIES}
    requested = [token.strip() for token in tokens.split(",") if token.strip()]
    selected = list(dict.fromkeys(requested))
    if not selected:
        configured = await db.dmart_categories.find({"enabled": True}).to_list(100)
        selected = [item["token"] for item in configured]
    if not selected:
        raise HTTPException(400, "Select and save at least one DMart category first")
    if set(selected) - known:
        raise HTTPException(400, "One or more selected DMart categories are invalid")
    selected_json = json.dumps(selected)
    script = f'''/* Rams Boutique DMart CSV exporter.
Run this entire file in the browser Console while signed into https://www.dmart.in/.
It reads only the selected public catalogue categories and downloads a CSV. */
(async () => {{
  const categories = {selected_json};
  const apiBase = "https://digital.dmart.in/api/v3/plp";
  const rows = [];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const csvCell = value => `"${{String(value ?? "").replaceAll('"', '""')}}"`;
  try {{
    for (const token of categories) {{
      console.log(`Reading DMart category: ${{token}}`);
      let page = 1;
      let pageCount = 1;
      do {{
        const url = `${{apiBase}}/${{encodeURIComponent(token)}}?page=${{page}}&buryOOS=true&size=100&channel=web`;
        // DMart's catalogue API returns CORS-readable public data only when
        // browser credentials are omitted. Including cookies causes the browser
        // to reject an otherwise successful 200 response.
        const response = await fetch(url, {{ credentials: "omit", headers: {{ Accept: "application/json" }} }});
        if (!response.ok) throw new Error(`${{token}} page ${{page}}: HTTP ${{response.status}}`);
        const data = await response.json();
        pageCount = Math.max(1, Math.ceil(Number(data.totalRecords || 0) / 100));
        for (const product of data.products || []) {{
          const levels = Object.fromEntries((product.categoryMap || []).map(item => [item.level, item.name || ""]));
          for (const sku of product.sKUs || []) {{
            const name = String(sku.name || product.name || "").trim();
            if (!name || name.toLowerCase().startsWith("dmart")) continue;
            const mrp = Number(sku.priceMRP || 0);
            if (!(mrp > 0)) continue;
            const key = String(sku.imageKey || sku.productImageKey || "").replace(/^\\/+|\\/+$/g, "");
            rows.push({{
              category_token: token, category_l1: levels.L1 || "", category_l2: levels.L2 || "",
              category_l3: levels.L3 || "", product_id: product.productId || "",
              sku_id: sku.skuUniqueID || "", name, brand: product.manufacturer || "DMart",
              unit: sku.variantTextValue || "piece", mrp: mrp.toFixed(2),
              image_url: key ? `https://cdn.dmart.in/images/products/${{key}}_5_P.jpg` : "",
              source_url: `https://www.dmart.in${{product.targetUrl || "/"}}`, active: "true"
            }});
          }}
        }}
        console.log(`${{token}}: page ${{page}} of ${{pageCount}}`);
        page += 1;
        await sleep(150);
      }} while (page <= pageCount);
    }}
    const headers = ["category_token","category_l1","category_l2","category_l3","product_id","sku_id","name","brand","unit","mrp","image_url","source_url","active"];
    const csv = [headers.map(csvCell).join(","), ...rows.map(row => headers.map(key => csvCell(row[key])).join(","))].join("\\r\\n");
    const blob = new Blob(["\\uFEFF" + csv], {{ type: "text/csv;charset=utf-8" }});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "dmart-selected-products.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    console.log(`Downloaded ${{rows.length}} non-DMart-own-label products.`);
    alert(`DMart export complete: ${{rows.length}} products. Upload dmart-selected-products.csv in Rams Boutique Admin.`);
  }} catch (error) {{
    console.error("DMart export failed", error);
    alert(`DMart export failed: ${{error.message}}. Refresh DMart Ready, confirm your delivery location, and try again.`);
  }}
}})();
'''
    return Response(
        content=script, media_type="application/javascript; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=dmart-browser-export.js"},
    )


@api.post("/admin/dmart/import-csv")
async def admin_import_dmart_csv(payload: DmartCsvImportIn, _=Depends(get_current_admin)):
    required = {"category_token", "product_id", "sku_id", "name", "brand", "unit", "mrp", "image_url", "source_url", "active"}
    known = dict(DMART_CATEGORIES)
    try:
        reader = csv.DictReader(payload.csv_text.lstrip("\ufeff").splitlines())
        missing = sorted(required - set(reader.fieldnames or []))
        if missing:
            raise ValueError("Missing CSV columns: " + ", ".join(missing))
        rows = list(reader)
    except Exception as exc:
        await create_admin_notification("DMart CSV import failed", str(exc))
        raise HTTPException(400, str(exc))
    if not rows:
        raise HTTPException(400, "The DMart CSV contains no products")

    enabled_docs = await db.dmart_categories.find({"enabled": True}).to_list(100)
    enabled = {item.get("token") for item in enabled_docs}
    prepared, errors, seen_by_category = [], [], {}
    for line_no, row in enumerate(rows, start=2):
        try:
            token = (row.get("category_token") or "").strip()
            if token not in known:
                raise ValueError(f"unknown category token '{token}'")
            if token not in enabled:
                raise ValueError(f"category '{token}' is not enabled in Admin")
            sku_id = (row.get("sku_id") or "").strip()
            name = (row.get("name") or "").strip()
            if not sku_id or not name:
                raise ValueError("SKU ID and name are required")
            if name.casefold().startswith("dmart"):
                continue
            mrp = round(float(row.get("mrp") or 0), 2)
            if mrp <= 0:
                raise ValueError("MRP must be greater than zero")
            prepared.append((token, sku_id, name, mrp, row))
            seen_by_category.setdefault(token, set()).add(sku_id)
        except Exception as exc:
            errors.append(f"Row {line_no}: {exc}")
    if errors:
        await create_admin_notification("DMart CSV validation failed", f"{len(errors)} row(s) need correction. No products were changed.", details=errors[:50])
        raise HTTPException(400, {"message": "DMart CSV validation failed", "errors": errors[:50]})

    added = updated = hidden = 0
    operation_errors = []
    for token, sku_id, name, mrp, row in prepared:
        try:
            category_slug = "dmart-" + re.sub(r"[^a-z0-9]+", "-", token.lower()).strip("-")
            await db.categories.update_one(
                {"slug": category_slug},
                {"$setOnInsert": {"id": category_slug, "slug": category_slug, "name": known[token], "icon": "shopping-basket", "order": 100, "active": True}},
                upsert=True,
            )
            source_key = f"dmart:{sku_id}"
            existing = await db.products.find_one({"source_key": source_key}, {"_id": 1})
            values = {
                "source_market": "dmart", "source_key": source_key,
                "source_product_id": (row.get("product_id") or "").strip(), "source_sku_id": sku_id,
                "source_category_token": token, "source_pincode": DMART_PINCODE,
                "source_category_l1": (row.get("category_l1") or "").strip(),
                "source_category_l2": (row.get("category_l2") or "").strip(),
                "source_category_l3": (row.get("category_l3") or "").strip(),
                "name": name, "brand": (row.get("brand") or "DMart").strip(),
                "category": category_slug, "sub": (row.get("category_l2") or known[token]).strip(),
                "price": mrp, "mrp": mrp, "unit": (row.get("unit") or "piece").strip(),
                "image": (row.get("image_url") or "").strip(), "desc": "", "stock": 100, "variants": [],
                "source_url": (row.get("source_url") or "").strip(), "auto_update_price": True,
                "auto_update_mrp": True, "auto_update_image": True, "active": True,
                "inactive_reason": None, "source_checked_at": now_iso(), "source_status": "ok", "updated_at": now_iso(),
            }
            await db.products.update_one(
                {"source_key": source_key},
                {"$set": values, "$setOnInsert": {"id": source_key, "created_at": now_iso()}}, upsert=True,
            )
            if existing: updated += 1
            else: added += 1
        except Exception as exc:
            operation_errors.append(f"{name}: {str(exc)[:250]}")

    for token, seen in seen_by_category.items():
        result = await db.products.update_many(
            {"source_market": "dmart", "source_category_token": token,
             "source_sku_id": {"$nin": list(seen)}, "active": {"$ne": False}},
            {"$set": {"active": False, "inactive_reason": "missing_from_dmart_csv", "updated_at": now_iso()}},
        )
        hidden += result.modified_count
        await db.dmart_categories.update_one(
            {"token": token}, {"$set": {"last_synced_at": now_iso(), "last_error": None, "total_records": len(seen)}},
        )
    if operation_errors:
        await create_admin_notification("DMart CSV import errors", f"{len(operation_errors)} product(s) could not be imported.", details=operation_errors[:50])
    return {"added": added, "updated": updated, "hidden": hidden, "failed": len(operation_errors), "errors": operation_errors[:50]}


async def run_dmart_job(job_id, tokens):
    try:
        await sync_categories(db, tokens, job_id, create_admin_notification)
    except Exception as exc:
        message = str(exc)[:500]
        await db.dmart_sync_jobs.update_one(
            {"id": job_id}, {"$set": {"status": "failed", "finished_at": now_iso(), "errors": [message]}},
        )
        await create_admin_notification("DMart catalogue sync failed", message)


@api.post("/admin/dmart/sync")
async def admin_start_dmart_sync(payload: DmartSyncIn, _=Depends(get_current_admin)):
    if payload.tokens is None:
        configured = await db.dmart_categories.find({"enabled": True}).to_list(100)
        tokens = [item["token"] for item in configured]
    else:
        tokens = payload.tokens
    known = {token for token, _name in DMART_CATEGORIES}
    tokens = list(dict.fromkeys(tokens))
    if not tokens:
        raise HTTPException(400, "Select and save at least one DMart category first")
    if set(tokens) - known:
        raise HTTPException(400, "One or more selected DMart categories are invalid")
    running = await db.dmart_sync_jobs.find_one({"status": {"$in": ["queued", "running"]}})
    if running:
        return {"job_id": running["id"], "status": running["status"], "already_running": True}
    job_id = str(uuid.uuid4())
    await db.dmart_sync_jobs.insert_one({
        "id": job_id, "status": "queued", "tokens": tokens, "category_done": 0,
        "category_total": len(tokens), "added": 0, "updated": 0, "hidden": 0,
        "sku_count": 0, "errors": [], "created_at": now_iso(),
    })
    asyncio.create_task(run_dmart_job(job_id, tokens))
    return {"job_id": job_id, "status": "queued", "already_running": False}


@api.get("/admin/dmart/sync/{job_id}")
async def admin_dmart_sync_status(job_id: str, _=Depends(get_current_admin)):
    job = await db.dmart_sync_jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(404, "DMart sync job not found")
    return clean(job)


@api.get("/admin/dmart/export.csv")
async def admin_export_dmart_csv(_=Depends(get_current_admin)):
    docs = await db.products.find({"source_market": "dmart"}).to_list(50000)
    docs = [doc for doc in docs if not str(doc.get("name") or "").strip().casefold().startswith("dmart")]
    docs.sort(key=lambda item: (item.get("source_category_l1", ""), item.get("name", "")))
    columns = [
        "source_category_token", "source_category_l1", "source_category_l2", "source_category_l3",
        "source_product_id", "source_sku_id", "name", "brand", "unit", "mrp", "price",
        "image_url", "source_url", "active", "inactive_reason", "source_pincode", "last_synced_at",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for doc in docs:
        writer.writerow({
            "source_category_token": doc.get("source_category_token", ""),
            "source_category_l1": doc.get("source_category_l1", ""),
            "source_category_l2": doc.get("source_category_l2", ""),
            "source_category_l3": doc.get("source_category_l3", ""),
            "source_product_id": doc.get("source_product_id", ""),
            "source_sku_id": doc.get("source_sku_id", ""),
            "name": doc.get("name", ""), "brand": doc.get("brand", ""), "unit": doc.get("unit", ""),
            "mrp": doc.get("mrp", 0), "price": doc.get("mrp", 0),
            "image_url": doc.get("image", ""), "source_url": doc.get("source_url", ""),
            "active": doc.get("active", True), "inactive_reason": doc.get("inactive_reason") or "",
            "source_pincode": doc.get("source_pincode", DMART_PINCODE),
            "last_synced_at": doc.get("source_checked_at", ""),
        })
    return Response(
        content="\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=dmart-live-products.csv"},
    )

@api.post("/admin/catalog/sync-csv")
async def admin_sync_catalog_csv(payload: CatalogCsvSyncIn, _=Depends(get_current_admin)):
    required = {"product_id", "name", "category", "unit", "price", "mrp", "image_url", "source_url", "active"}
    try:
        reader = csv.DictReader(payload.csv_text.lstrip("\ufeff").splitlines())
        headers = set(reader.fieldnames or [])
        missing = sorted(required - headers)
        if missing:
            raise ValueError("Missing CSV columns: " + ", ".join(missing))
        rows = list(reader)
    except Exception as exc:
        await create_admin_notification("CSV sync failed", str(exc))
        raise HTTPException(400, str(exc))

    category_map = {
        "groceries": ("grocery", "Grocery & Staples", "wheat"),
        "fruits": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
        "vegetables": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
        "leafy green": ("fruits-vegetables", "Fruits & Vegetables", "apple"),
        "flowers": ("flowers", "Flowers", "sparkles"),
    }
    prepared, validation_errors, seen = [], [], set()
    for line_no, row in enumerate(rows, start=2):
        try:
            name = (row.get("name") or "").strip()
            if not name:
                raise ValueError("product name is blank")
            raw_key = (row.get("product_id") or "").strip()
            if not raw_key:
                raw_key = hashlib.sha256(
                    ((row.get("source_url") or "") + "|" + (row.get("image_url") or "")).encode("utf-8")
                ).hexdigest()
            if raw_key in seen:
                raise ValueError("duplicate product_id/source key")
            seen.add(raw_key)
            price = float(row.get("price") or 0)
            mrp = float(row.get("mrp") or price)
            if price < 0 or mrp < price:
                raise ValueError("price must be non-negative and MRP cannot be below price")
            active_text = str(row.get("active") or "").strip().lower()
            if active_text not in {"true", "false", "1", "0", "yes", "no", "active", "inactive", "visible", "hidden"}:
                raise ValueError("active must be true or false")
            row_active = active_text in {"true", "1", "yes", "active", "visible"}
            source_category = (row.get("category") or "Groceries").strip()
            category, category_name, category_icon = category_map.get(
                source_category.lower(), ("grocery", "Grocery & Staples", "wheat")
            )
            prepared.append((raw_key, row, name, price, mrp, row_active, source_category, category, category_name, category_icon))
        except Exception as exc:
            validation_errors.append(f"Row {line_no}: {exc}")

    if validation_errors:
        await create_admin_notification(
            "CSV sync validation failed",
            f"{len(validation_errors)} row(s) must be corrected. No products were changed.",
            details=validation_errors[:50],
        )
        raise HTTPException(400, {"message": "CSV validation failed", "errors": validation_errors[:50]})

    existing_docs = await db.products.find({"source_market": "seethammadhara"}).to_list(1000)
    existing_by_key = {doc.get("source_key"): doc for doc in existing_docs}
    added = updated = hidden = restored = failed = 0
    operation_errors = []
    for raw_key, row, name, price, mrp, row_active, source_category, category, category_name, category_icon in prepared:
        try:
            await db.categories.update_one(
                {"id": category},
                {"$setOnInsert": {"id": category, "slug": category, "name": category_name, "icon": category_icon, "order": 50}},
                upsert=True,
            )
            values = {
                "source_key": raw_key,
                "source_product_id": (row.get("product_id") or "").strip(),
                "source_market": "seethammadhara",
                "name": name,
                "name_te": (row.get("name_telugu") or "").strip(),
                "name_hi": (row.get("name_hindi") or "").strip(),
                "brand": "DRB",
                "category": category,
                "sub": source_category,
                "price": price,
                "mrp": mrp,
                "unit": (row.get("unit") or "piece").strip(),
                "image": (row.get("image_url") or "").strip(),
                "desc": (row.get("description") or "").strip(),
                "source_url": (row.get("source_url") or "").strip(),
                "auto_update_price": True,
                "auto_update_mrp": True,
                "auto_update_image": True,
                "active": row_active,
                "inactive_reason": None if row_active else "hidden_by_csv",
                "updated_at": now_iso(),
            }
            await db.products.update_one(
                {"source_market": "seethammadhara", "source_key": raw_key},
                {"$set": values, "$setOnInsert": {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"seethammadhara:{raw_key}")), "stock": 100, "variants": [], "created_at": now_iso()}},
                upsert=True,
            )
            if raw_key in existing_by_key:
                updated += 1
                was_active = existing_by_key[raw_key].get("active", True)
                if was_active and not row_active:
                    hidden += 1
                elif not was_active and row_active:
                    restored += 1
            else:
                added += 1
        except Exception as exc:
            failed += 1
            operation_errors.append(f"{name}: {str(exc)[:200]}")

    if operation_errors:
        await create_admin_notification(
            "CSV sync completed with errors",
            f"Added {added}, updated {updated}, hidden {hidden}, restored {restored}, failed {failed}.",
            details=operation_errors[:50],
        )
    return {"added": added, "updated": updated, "hidden": hidden, "restored": restored, "failed": failed, "errors": operation_errors[:50]}

@api.post("/admin/catalog/refresh")
async def admin_refresh_catalog(payload: CatalogRefreshIn, _=Depends(get_current_admin)):
    docs=await db.products.find({"source_url":{"$nin":[None,""]}}).to_list(1000); results=[]
    for p in docs:
        try:
            checked=await inspect_source(p["source_url"])
            refresh_doc = p
            if p.get("source_market") == "seethammadhara" or p.get("brand") in {"DRB", "Digi Rythu Bazar", "Digi Rythu Bazaar"}:
                refresh_doc = {**p, "auto_update_price": True, "auto_update_mrp": True, "auto_update_image": True}
            changes=proposed_update(refresh_doc,checked)
            if payload.apply:
                await db.products.update_one({"id":p["id"]},{"$set":changes,"$push":{"price_history":{"at":checked["checked_at"],"old_price":p.get("price"),"old_mrp":p.get("mrp"),"new_price":changes.get("price"),"new_mrp":changes.get("mrp"),"source_url":p["source_url"]}}})
            results.append({"id":p["id"],"name":p["name"],"status":"ready","changes":changes})
        except Exception as e: results.append({"id":p["id"],"name":p["name"],"status":"error","error":str(e)[:300]})
    errors = [f"{x['name']}: {x.get('error', 'Unknown error')}" for x in results if x["status"] == "error"]
    if errors:
        await create_admin_notification(
            "Digi catalogue refresh errors",
            f"{len(errors)} of {len(results)} products could not be refreshed.",
            details=errors[:50],
        )
    return {"applied":payload.apply,"checked":len(results),"ready":sum(x["status"]=="ready" for x in results),"results":results}


@api.get("/admin/agents")
async def admin_agents(_=Depends(get_current_admin)):
    docs = await db.agents.find().to_list(200)
    return [clean(d) for d in docs]


@api.post("/admin/agents")
async def admin_create_agent(a: AgentIn, _=Depends(get_current_admin)):
    doc = {"id": str(uuid.uuid4()), **a.dict(), "created_at": now_iso()}
    await db.agents.insert_one(doc)
    return clean(doc)


@api.patch("/admin/agents/{aid}")
async def admin_update_agent(aid: str, a: AgentIn, _=Depends(get_current_admin)):
    res = await db.agents.update_one({"id": aid}, {"$set": a.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.agents.find_one({"id": aid})
    return clean(doc)


@api.delete("/admin/agents/{aid}")
async def admin_delete_agent(aid: str, _=Depends(get_current_admin)):
    await db.agents.delete_one({"id": aid})
    return {"ok": True}


@api.get("/admin/users")
async def admin_users(_=Depends(get_current_admin)):
    docs = await db.users.find({"role": "user"}).to_list(500)
    return [{"id": d["id"], "name": d["name"], "email": d["email"], "phone": d["phone"], "created_at": d.get("created_at")} for d in docs]

# ============ AGENT DASHBOARD APIs ============

from auth_utils import get_current_user


@api.get("/agent/me")
async def agent_me(current=Depends(get_current_user)):
    if current["role"] != "agent":
        raise HTTPException(403, "Agent access required")
    agent = await db.agents.find_one({"id": current["user_id"]})
    if not agent:
        raise HTTPException(404, "Agent not found")
    return clean(agent)


@api.patch("/agent/me")
async def update_agent_me(data: AgentIn, current=Depends(get_current_user)):
    if current["role"] != "agent":
        raise HTTPException(403, "Agent access required")
    await db.agents.update_one(
        {"id": current["user_id"]},
        {"$set": data.dict()}
    )
    agent = await db.agents.find_one({"id": current["user_id"]})
    return clean(agent)


@api.get("/agent/orders")
async def agent_orders(current=Depends(get_current_user)):
    if current["role"] != "agent":
        raise HTTPException(403, "Agent access required")
    docs = await db.orders.find({
        "agent_id": current["user_id"]
    }).sort("created_at", -1).to_list(200)
    return [clean(d) for d in docs]


@api.patch("/agent/orders/{oid}")
async def agent_update_order(
    oid: str,
    data: OrderStatusUpdate,
    current=Depends(get_current_user)
):
    if current["role"] != "agent":
        raise HTTPException(403, "Agent access required")
    order = await db.orders.find_one({
        "id": oid,
        "agent_id": current["user_id"]
    })
    if not order:
        raise HTTPException(404, "Assigned order not found")
    allowed_status = ["packed", "out_for_delivery", "delivered"]
    if data.status not in allowed_status:
        raise HTTPException(400, "Invalid status for agent")
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"status": data.status}}
    )
    updated = await db.orders.find_one({"id": oid})
    return clean(updated)


@api.get("/orders/{order_id}")
async def get_order_by_id(order_id: str):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"order_no": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return clean(order)


@api.get("/")
async def root():
    return {"message": "Rams Boutique Vizag API", "store": "Dwaraka Nagar", "radius_km": DELIVERY_RADIUS_KM}

app.include_router(api)
app.include_router(chits_router)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await seed_db()
    await seed_chit_data()
    start_chit_scheduler()


@app.on_event("shutdown")
async def shutdown():
    stop_chit_scheduler()
    client.close()
