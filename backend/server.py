"""BTA FreshMart Vizag Clone - FastAPI backend."""
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
    get_current_user, get_current_admin, verify_entra_token,
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

app = FastAPI(title="BTA FreshMart Vizag API")
api = APIRouter(prefix="/api")
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.ramsboutique.com",
    "https://ramsboutique.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Store location: Dwaraka Nagar, Visakhapatnam
STORE_LAT = 17.7231
STORE_LNG = 83.3012
DELIVERY_RADIUS_KM = 5.0

BLACKSMS_API_KEY = os.environ.get("BLACKSMS_API_KEY", "").strip()
ENTRA_WORKFORCE_TENANT_ID = os.environ.get("ENTRA_WORKFORCE_TENANT_ID", "").strip()
ENTRA_WORKFORCE_CLIENT_ID = os.environ.get("ENTRA_WORKFORCE_CLIENT_ID", "").strip()
ENTRA_EXTERNAL_TENANT_ID = os.environ.get("ENTRA_EXTERNAL_TENANT_ID", "").strip()
ENTRA_EXTERNAL_CLIENT_ID = os.environ.get("ENTRA_EXTERNAL_CLIENT_ID", "").strip()

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

class EntraTokenIn(BaseModel):
    token: str = Field(..., min_length=100)

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
    use_wallet: bool = True


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
        "pill": "BTA FreshMart Vizag",
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
        "footer": "By continuing you agree to BTA FreshMart Terms of Service and Privacy Policy.",
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
        "copyright": "© 2026 BTA FreshMart. All rights reserved.",
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
_vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
_vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "").strip()
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

    # Seed an administrator only when a deployment explicitly provides a
    # password. Existing administrator records are left untouched.
    default_admin_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@ramsboutique.com").strip()
    default_admin_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "")
    if default_admin_password and not await db.users.find_one({"email": default_admin_email}):
        await db.users.delete_many({"role": "admin"})
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": default_admin_email,
            "phone": "9999999999",
            "password": hash_password(default_admin_password),
            "role": "admin",
            "created_at": now_iso(),
        })
        logging.info("Seeded configured default administrator")

    # Sample delivery agents
    if await db.agents.count_documents({}) == 0:
        for name, phone in [("Ravi Kumar", "9000000001"), ("Suresh N", "9000000002"), ("Anil B", "9000000003")]:
            await db.agents.insert_one({"id": str(uuid.uuid4()), "name": name, "phone": phone, "active": True})

    # Site content (singleton)
    if not await db.site_content.find_one({"id": "site"}):
        await db.site_content.insert_one({"id": "site", **DEFAULT_SITE_CONTENT, "updated_at": now_iso()})
        logging.info("Seeded default site content")

    # Migrate persisted customer-facing branding without overwriting unrelated
    # content that an administrator may have customized.
    rebrand_migration = "bta_freshmart_rebrand_v1"
    if not await db.app_migrations.find_one({"id": rebrand_migration}):
        replacements = (
            ("hero.pill", "Rams Boutique Vizag", "BTA FreshMart Vizag"),
            (
                "login.footer",
                "By continuing you agree to Rams Boutique Terms of Service and Privacy Policy.",
                "By continuing you agree to BTA FreshMart Terms of Service and Privacy Policy.",
            ),
            (
                "footer.copyright",
                "© 2026 Rams Boutique. All rights reserved.",
                "© 2026 BTA FreshMart. All rights reserved.",
            ),
            (
                "footer.copyright",
                "© 2025 Rams Boutique. All rights reserved.",
                "© 2026 BTA FreshMart. All rights reserved.",
            ),
        )
        for field, old_value, new_value in replacements:
            await db.site_content.update_one(
                {"id": "site", field: old_value},
                {"$set": {field: new_value, "updated_at": now_iso()}},
            )
        await db.banners.update_many(
            {"subtitle": "Rams Boutique quality, home comfort"},
            {"$set": {"subtitle": "BTA FreshMart quality, home comfort"}},
        )
        await db.app_migrations.insert_one({
            "id": rebrand_migration,
            "applied_at": now_iso(),
        })
        logging.info("Migrated persisted branding to BTA FreshMart")


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


def _entra_email(claims: dict) -> str:
    emails = claims.get("emails") or []
    return (claims.get("email") or claims.get("preferred_username") or (emails[0] if emails else "")).strip().lower()


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user.get("name", "Customer"),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "role": user.get("role", "user"),
    }


@api.post("/auth/entra/customer")
async def entra_customer_login(data: EntraTokenIn):
    claims = verify_entra_token(
        data.token, ENTRA_EXTERNAL_TENANT_ID, ENTRA_EXTERNAL_CLIENT_ID, external=True
    )
    subject = claims["sub"]
    email = _entra_email(claims)
    if not email:
        raise HTTPException(400, "Microsoft did not return a verified email address")
    user = await db.users.find_one({"entra_external_id": subject, "role": "user"})
    if not user:
        existing = await db.users.find_one({"email": email, "role": "user"})
        if existing:
            raise HTTPException(
                409,
                "This email already belongs to an account. Sign in with your existing method and link Microsoft from Profile.",
            )
        user = {
            "id": str(uuid.uuid4()),
            "name": claims.get("name") or email.split("@", 1)[0],
            "email": email,
            "phone": "",
            "entra_external_id": subject,
            "email_verified": True,
            "auth_methods": ["entra_email_otp"],
            "role": "user",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    token = create_token(user["id"], "user")
    return {"token": token, "user": _public_user(user), "profile_incomplete": not bool(user.get("phone"))}


@api.post("/auth/entra/link-customer")
async def link_entra_customer(data: EntraTokenIn, current=Depends(get_current_user)):
    if current["role"] != "user":
        raise HTTPException(403, "Customer account required")
    claims = verify_entra_token(
        data.token, ENTRA_EXTERNAL_TENANT_ID, ENTRA_EXTERNAL_CLIENT_ID, external=True
    )
    email = _entra_email(claims)
    user = await db.users.find_one({"id": current["user_id"], "role": "user"})
    if not user:
        raise HTTPException(404, "User not found")
    if email != user.get("email", "").strip().lower():
        raise HTTPException(409, "Microsoft email must match the signed-in account email")
    duplicate = await db.users.find_one({"entra_external_id": claims["sub"], "id": {"$ne": user["id"]}})
    if duplicate:
        raise HTTPException(409, "This Microsoft identity is already linked")
    methods = list(dict.fromkeys([*(user.get("auth_methods") or []), "entra_email_otp"]))
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"entra_external_id": claims["sub"], "email_verified": True, "auth_methods": methods}},
    )
    return {"status": "linked", "email": email}


@api.post("/auth/entra/staff")
async def entra_staff_login(data: EntraTokenIn):
    claims = verify_entra_token(data.token, ENTRA_WORKFORCE_TENANT_ID, ENTRA_WORKFORCE_CLIENT_ID)
    app_roles = {str(role).lower() for role in claims.get("roles", [])}
    role = "admin" if "admin" in app_roles else "agent" if "agent" in app_roles else None
    if not role:
        raise HTTPException(403, "Your Microsoft account is not assigned the Admin or Agent application role")
    email = _entra_email(claims)
    name = claims.get("name") or email or "Staff member"
    if role == "admin":
        user = await db.users.find_one({"entra_workforce_id": claims["sub"], "role": "admin"})
        if not user and email:
            # Link the Entra identity to an existing local admin instead of
            # attempting to create a duplicate record for the same email.
            user = await db.users.find_one({"email": email, "role": "admin"})
            if user:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"entra_workforce_id": claims["sub"]}},
                )
                user["entra_workforce_id"] = claims["sub"]
        if not user:
            user = {
                "id": str(uuid.uuid4()), "name": name, "email": email, "phone": "",
                "role": "admin", "entra_workforce_id": claims["sub"], "created_at": now_iso(),
            }
            await db.users.insert_one(user)
        local_token = create_token(user["id"], "admin")
        return {"token": local_token, "user": _public_user(user), "role": "admin"}
    staff = await db.agents.find_one({"entra_workforce_id": claims["sub"]})
    if not staff and email:
        staff = await db.agents.find_one({"email": email})
        if staff:
            await db.agents.update_one(
                {"id": staff["id"]},
                {"$set": {"entra_workforce_id": claims["sub"]}},
            )
            staff["entra_workforce_id"] = claims["sub"]
    if not staff:
        staff = {
            "id": str(uuid.uuid4()), "name": name, "email": email, "phone": "",
            "role": "agent", "active": True, "entra_workforce_id": claims["sub"], "created_at": now_iso(),
        }
        await db.agents.insert_one(staff)
    local_token = create_token(staff["id"], "agent")
    return {"token": local_token, "agent_id": staff["id"], "name": staff["name"], "role": "agent"}

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
    wallet_paise = int(user.get("wallet_balance_paise", 0))
    return {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": user["role"],
            "wallet_balance_paise": wallet_paise, "wallet_balance_rupees": wallet_paise / 100}


@api.get("/wallet")
async def my_wallet(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["user_id"]})
    if not user: raise HTTPException(404, "User not found")
    balance = int(user.get("wallet_balance_paise", 0))
    transactions = await db.wallet_transactions.find({"user_id": current["user_id"]}).to_list(100)
    transactions.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return {"balance_paise": balance, "balance_rupees": balance / 100,
            "transactions": [clean(item) for item in transactions[:50]]}


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
                "store": "BTA FreshMart Vizag",
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
            f"BTA FreshMart • Payment received",
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
