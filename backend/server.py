"""DMart Vizag Clone - FastAPI backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import uuid
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

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Rams Boutique Vizag API")
api = APIRouter(prefix="/api")

# Store location: Dwaraka Nagar, Visakhapatnam
STORE_LAT = 17.7231
STORE_LNG = 83.3012
DELIVERY_RADIUS_KM = 5.0

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


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class OtpVerifyIn(BaseModel):
    phone: str
    otp: str


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
    qty: int


class CheckoutIn(BaseModel):
    items: List[CartItem]
    address: Address
    payment_method: str  # "COD" | "UPI" | "CARD"
    note: Optional[str] = ""
    coupon_code: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str  # placed, packed, out_for_delivery, delivered, cancelled
    agent_id: Optional[str] = None


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
        "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",
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
        "phone": "1800-123-4567",
        "email": "support@ramsboutique.com",
        "facebook": "https://facebook.com/ramsboutique",
        "instagram": "https://instagram.com/ramsboutique",
        "twitter": "https://twitter.com/ramsboutique",
        "youtube": "https://youtube.com/ramsboutique",
        "copyright": "© 2025 Rams Boutique. All rights reserved.",
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
_vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "")
_vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "")
_vapid_claim = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:support@ramsboutique.com")


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
        # cleanup expired subscription
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
        # backfill order for existing categories that don't have one
        async for doc in db.categories.find({"order": {"$exists": False}}):
            await db.categories.update_one({"_id": doc["_id"]}, {"$set": {"order": 999}})

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

    if await db.banners.count_documents({}) == 0:
        for b in BANNERS:
            await db.banners.insert_one({"id": str(uuid.uuid4()), **b})

    # Default admin
    if not await db.users.find_one({"email": "admin@ramsboutique.com"}):
        # remove any old admin
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


@api.post("/auth/admin-login")
async def admin_login(data: LoginIn):
    user = await db.users.find_one({"email": data.email, "role": "admin"})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid admin credentials")
    token = create_token(user["id"], "admin")
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": "admin"}}


@api.post("/auth/verify-otp")
async def verify_otp(data: OtpVerifyIn):
    # Mock OTP: any 4-digit code works, e.g. 1234
    if len(data.otp) != 4 or not data.otp.isdigit():
        raise HTTPException(400, "Invalid OTP format")
    user = await db.users.find_one({"phone": data.phone})
    if not user:
        # auto-create phone user
        user = {
            "id": str(uuid.uuid4()),
            "name": f"User {data.phone[-4:]}",
            "email": f"user{data.phone}@dmartvizag.local",
            "phone": data.phone,
            "password": hash_password(str(uuid.uuid4())),
            "role": "user",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": user["role"]}}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["user_id"]})
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"], "role": user["role"]}


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
    doc = {"id": slug, "slug": slug, "name": c.name, "icon": c.icon, "order": max_order}
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

    amount_paise = int(round(order["total"] * 100))
    try:
        rzp_order = _rzp.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": order["order_no"][:40],
            "payment_capture": 1,
            "notes": {
                "internal_order_id": order["id"],
                "user_id": current["user_id"],
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
    """Marks a Razorpay attempt as cancelled (user closed the modal / payment failed)."""
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
        # fallback to defaults if not seeded
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
    limit: int = 100,
):
    query: dict = {}
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


# ============ ORDERS (User) ============
@api.post("/orders")
async def create_order(data: CheckoutIn, current=Depends(get_current_user)):
    # store hours check
    hours = await get_store_hours()
    open_now, msg = is_store_open(hours)
    if not open_now:
        raise HTTPException(400, msg)

    # validate delivery radius
    dist = haversine_km(STORE_LAT, STORE_LNG, data.address.lat, data.address.lng)
    if dist > DELIVERY_RADIUS_KM:
        raise HTTPException(400, f"Address is {round(dist,2)} km away. We deliver within {DELIVERY_RADIUS_KM} km.")

    # calculate total
    items_full = []
    subtotal = 0.0
    for it in data.items:
        p = await db.products.find_one({"id": it.product_id})
        if not p:
            raise HTTPException(400, f"Invalid product {it.product_id}")
        line = {
            "product_id": p["id"],
            "name": p["name"],
            "image": p["image"],
            "price": p["price"],
            "mrp": p["mrp"],
            "unit": p["unit"],
            "qty": it.qty,
            "total": p["price"] * it.qty,
        }
        subtotal += line["total"]
        items_full.append(line)

    delivery_fee = 0 if subtotal >= 499 else 40

    # Coupon
    discount = 0.0
    coupon_doc = None
    try:
        discount, coupon_doc = await resolve_coupon(data.coupon_code, subtotal)
    except HTTPException as e:
        raise e

    total = subtotal + delivery_fee - discount
    if total < 0:
        total = 0

    order = {
        "id": str(uuid.uuid4()),
        "order_no": f"RB{datetime.now().strftime('%y%m%d')}{str(uuid.uuid4())[:6].upper()}",
        "user_id": current["user_id"],
        "items": items_full,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "discount": round(discount, 2),
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "total": round(total, 2),
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
    try:
        await push_to_user(
            current["user_id"],
            f"Rams Boutique • Order confirmed",
            f"Order {order['order_no']} placed. Total ₹{int(order['total'])}. We'll notify you as it moves.",
            url="/orders",
        )
    except Exception as e:
        logging.warning(f"push on order create failed: {e}")
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


# ============ ADMIN ============
@api.get("/admin/stats")
async def admin_stats(_=Depends(get_current_admin)):
    total_orders = await db.orders.count_documents({})
    placed = await db.orders.count_documents({"status": "placed"})
    delivered = await db.orders.count_documents({"status": "delivered"})
    total_products = await db.products.count_documents({})
    total_users = await db.users.count_documents({"role": "user"})
    total_agents = await db.agents.count_documents({})

    # revenue
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
    # Fire push notification to customer
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


@api.patch("/admin/products/{pid}")
async def admin_update_product(pid: str, p: ProductIn, _=Depends(get_current_admin)):
    res = await db.products.update_one({"id": pid}, {"$set": p.dict()})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    doc = await db.products.find_one({"id": pid})
    return clean(doc)


@api.delete("/admin/products/{pid}")
async def admin_delete_product(pid: str, _=Depends(get_current_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


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


# ============ HEALTH ============
@api.get("/")
async def root():
    return {"message": "Rams Boutique Vizag API", "store": "Dwaraka Nagar", "radius_km": DELIVERY_RADIUS_KM}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await seed_db()


@app.on_event("shutdown")
async def shutdown():
    client.close()
