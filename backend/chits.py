"""Monthly Grocery Saving Scheme (Chit) module for BTA FreshMart.

MongoDB collections: chit_plans, chit_plan_items, chit_subscriptions,
chit_payments, chit_delivery_slots. Monetary values are stored in paise.
"""
import hashlib
import hmac
import io
import csv
import asyncio
import logging
import os
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Literal, Optional

import httpx
import razorpay
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from openpyxl import Workbook
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth_utils import get_current_admin, get_current_user
from catalog_sync import inspect_source, proposed_update

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chits", tags=["Grocery Chit"])
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
IST = timezone(timedelta(hours=5, minutes=30))
MONTHLY_PAISE = 50_000
DEFAULT_PACKING_PAISE = 5_000
ALLOWED_DURATIONS = (1, 3, 6, 12)

DEFAULT_VOUCHER_REWARDS = [
    {"id": "cash_500", "name": "₹500 Reward", "type": "cash", "amount_paise": 50_000, "active": True},
    {"id": "rice_5kg", "name": "5 KG Rice Bag", "type": "grocery", "item_name": "Rice Bag", "qty": 5, "unit": "kg", "active": True},
    {"id": "oil_3l", "name": "3 L Oil", "type": "grocery", "item_name": "Refined Oil", "qty": 3, "unit": "L", "active": True},
]

rzp = None
if os.getenv("RAZORPAY_KEY_ID") and os.getenv("RAZORPAY_KEY_SECRET"):
    rzp = razorpay.Client(auth=(os.environ["RAZORPAY_KEY_ID"], os.environ["RAZORPAY_KEY_SECRET"]))


MASTER_ITEMS = [
    (1, "Ajwain", "వాము", "100", "g"), (2, "Kumkum", "కుంకుమ", "50", "g"),
    (3, "Dry chilli packet", "ఎండు మిర్చి ప్యాకెట్", "1", "packet"),
    (4, "Detergent bar", "డిటర్జెంట్ బార్", "1", "bar"),
    (5, "Refined oil", "రిఫైండ్ ఆయిల్", "15", "L"), (6, "Sugar", "పంచదార", "5", "kg"),
    (7, "Wheat flour", "గోధుమ పిండి", "5", "kg"), (8, "Wheat rava", "గోధుమ రవ్వ", "5", "kg"),
    (9, "Jaggery", "బెల్లం", "2", "kg"), (10, "Tamarind", "చింతపండు", "2", "kg"),
    (11, "Urad dal", "మినప పప్పు", "2", "kg"), (12, "Chana dal", "శనగ పప్పు", "2", "kg"),
    (13, "Toor dal", "కందిపప్పు", "2", "kg"), (14, "Moong dal", "పెసర పప్పు", "1", "kg"),
    (15, "Cowpeas", "బొబ్బర్లు", "1", "kg"), (16, "Groundnuts", "వేరుశెనగలు", "1", "kg"),
    (17, "Vermicelli", "సేమియా", "1", "kg"), (18, "Wheat sooji", "గోధుమ సూజి", "1", "kg"),
    (19, "Maida", "మైదా పిండి", "1", "kg"), (20, "Basmati rice", "బాస్మతి రైస్", "1", "kg"),
    (21, "Salt", "ఉప్పు", "1", "packet"), (22, "Dishwash powder", "గిన్నెల పొడి", "1", "packet"),
    (23, "Rice", "బియ్యం", "12", "kg"), (24, "Bombay rava", "బొంబాయి రవ్వ", "0.5", "kg"),
    (25, "Poppy seeds", "గసగసాలు", "0.25", "kg"), (26, "Pepper", "మిరియాలు", "0.25", "kg"),
    (27, "Tea powder", "టీ పొడి", "0.25", "kg"), (28, "Chilli powder", "కారం", "200", "g"),
    (29, "Turmeric", "పసుపు", "100", "g"), (30, "Toothpaste", "టూత్‌పేస్ట్", "100", "g"),
    (31, "Washing soap", "సబ్బు", "100", "g"), (32, "Bath soap", "స్నానపు సబ్బు", "100", "g"),
    (33, "Cinnamon", "దాల్చిన చెక్క", "50", "g"), (34, "Cloves", "లవంగాలు", "50", "g"),
    (35, "Cardamom", "యాలకులు", "10", "g"), (36, "Detergent soap", "డిటర్జెంట్ సబ్బులు", "3", "piece"),
    (37, "Rin soap", "రిన్ సబ్బులు", "6", "piece"), (38, "EXO bar", "ఎక్సో బార్", "6", "piece"),
    (39, "Gulab jamun mix", "గులాబ్ జామున్", "1", "packet"),
    (40, "Almonds", "బాదం", "1", "packet"),
]


def now(): return datetime.now(timezone.utc)
def public(doc):
    if not doc: return doc
    out = dict(doc); out.pop("_id", None)
    for k, v in list(out.items()):
        if isinstance(v, datetime): out[k] = v.isoformat()
    return out


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12 and digits.startswith("91"): digits = digits[2:]
    if len(digits) != 10: raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


def next_tenth(source: Optional[datetime] = None):
    local = (source or now()).astimezone(IST)
    year, month = local.year, local.month
    if local.day >= 10:
        month += 1
        if month == 13: year, month = year + 1, 1
    return datetime(year, month, 10, 9, 0, tzinfo=IST).astimezone(timezone.utc)


def calculated_qty(full_qty, duration):
    return float((Decimal(str(full_qty)) * Decimal(duration) / Decimal(12)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


class CalculateIn(BaseModel): duration: Literal[1, 3, 6, 12]
class SubscribeIn(BaseModel):
    duration: Literal[1, 3, 6, 12]
    name: str = Field(min_length=2, max_length=100)
    phone: str
    address: str = Field(min_length=8, max_length=500)
    city: str = "Visakhapatnam"
    terms_accepted: bool
    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v): return normalize_phone(v)

class CheckoutVerifyIn(BaseModel):
    subscription_id: str
    razorpay_payment_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_subscription_id: Optional[str] = None
    razorpay_signature: str

class MockPaymentIn(BaseModel):
    subscription_id: str

class AdminDecisionIn(BaseModel):
    reason: str = Field(default="", max_length=500)

class CustomerCancelIn(BaseModel):
    reason: str = Field(default="Cancelled by customer", max_length=500)

class ChitSettingsIn(BaseModel):
    packing_charge_rupees: float = Field(ge=1, le=10_000)
    delivery_charge_rupees: float = Field(ge=0, le=10_000)

class ChitPlanPriceIn(BaseModel):
    monthly_amount_rupees: float = Field(ge=1, le=100_000)

class SlotIn(BaseModel):
    subscription_id: str
    delivery_date: str
    time_slot: str

class SlotConfirmIn(SlotIn):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class ItemIn(BaseModel):
    name: str
    name_te: str = ""
    full_qty: float = Field(gt=0)
    unit: str
    sort_order: int = Field(ge=1, le=40)
    image: str = ""
    mrp: float = Field(default=0, ge=0)
    source_url: str = ""
    auto_update_mrp: bool = False
    auto_update_image: bool = True
    included_durations: List[Literal[1, 3, 6, 12]] = Field(default_factory=lambda: [1, 3, 6, 12])

    @field_validator("included_durations")
    @classmethod
    def durations_ok(cls, values):
        values = sorted(set(values))
        return values

class ChitItemsCsvIn(BaseModel):
    csv_text: str = Field(min_length=1, max_length=2_000_000)

class VoucherRewardIn(BaseModel):
    id: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=100)
    type: Literal["cash", "grocery"]
    amount_paise: int = Field(default=0, ge=0, le=1_000_000)
    item_name: str = Field(default="", max_length=100)
    qty: float = Field(default=0, ge=0, le=1000)
    unit: str = Field(default="", max_length=20)
    active: bool = True

class VoucherRewardsIn(BaseModel):
    rewards: List[VoucherRewardIn] = Field(min_length=1, max_length=20)

class VoucherAssignIn(BaseModel):
    reward_id: str

class VoucherCashChoiceIn(BaseModel):
    choice: Literal["wallet", "razorpay_refund"]

class VoucherRefundDecisionIn(BaseModel):
    approve: bool
    reason: str = Field(default="", max_length=500)

class ChitRefreshIn(BaseModel):
    apply: bool = False


async def seed_chit_data():
    await db.chit_plans.create_index("id", unique=True)
    await db.chit_plans.create_index("duration")

    await db.chit_plan_items.create_index("id", unique=True)
    await db.chit_plan_items.create_index("sort_order")

    await db.chit_subscriptions.create_index("id", unique=True)
    await db.chit_subscriptions.create_index("card_no", unique=True)
    await db.chit_subscriptions.create_index([("created_at", -1)])

    await db.chit_payments.create_index(
        "razorpay_payment_id",
        unique=True
    )
    await db.chit_payments.create_index("payment_no")

    await db.chit_settings.update_one({"id": "chit_settings"}, {"$setOnInsert": {
        "id": "chit_settings", "packing_charge_paise": DEFAULT_PACKING_PAISE,
        "delivery_charge_paise": 4_000, "created_at": now()
    }}, upsert=True)
    await db.chit_settings.update_one(
        {"id": "chit_settings", "delivery_charge_paise": {"$exists": False}},
        {"$set": {"delivery_charge_paise": 4_000}},
    )
    await db.chit_settings.update_one(
        {"id": "chit_settings", "voucher_rewards": {"$exists": False}},
        {"$set": {"voucher_rewards": DEFAULT_VOUCHER_REWARDS}},
    )
    if await db.chit_plan_items.count_documents({}) == 0:
        await db.chit_plan_items.insert_many([{
            "id": str(uuid.uuid4()), "sort_order": n, "name": en, "name_te": te,
            "full_qty": float(qty), "unit": unit, "active": True, "created_at": now()
        } for n, en, te, qty, unit in MASTER_ITEMS])
    await db.chit_plan_items.update_many(
        {"included_durations": {"$exists": False}},
        {"$set": {"included_durations": list(ALLOWED_DURATIONS)}},
    )
    for duration, title in ((1, "Trial"), (3, "Quarterly"), (6, "Half Yearly"), (12, "Yearly / Full Kit")):
        await db.chit_plans.update_one({"duration": duration}, {"$setOnInsert": {
            "id": str(uuid.uuid4()), "duration": duration, "title": title,
            "monthly_amount_paise": MONTHLY_PAISE, "total_paise": MONTHLY_PAISE * duration,
            "active": True, "created_at": now()
        }}, upsert=True)
    # Upgrade approved, unpaid records created by earlier module versions so
    # customers receive the new post-approval Pay button.
    await db.chit_subscriptions.update_many({
        "approval_status": "approved", "paid_count": 0,
        "status": {"$in": ["active", "pending_payment"]},
        "razorpay_order_id": {"$exists": False}, "razorpay_subscription_id": {"$exists": False},
    }, {"$set": {"status": "approved_awaiting_payment", "payment_setup_status": "not_created", "next_due_date": None}})
    # Freeze the current entitlement for legacy subscriptions once. Future
    # master-list imports must not alter an already accepted customer kit.
    legacy = await db.chit_subscriptions.find({"kit_snapshot": {"$exists": False}}).to_list(5000)
    for subscription in legacy:
        duration = int(subscription.get("chosen_duration") or 0)
        if duration in ALLOWED_DURATIONS:
            await db.chit_subscriptions.update_one(
                {"id": subscription["id"], "kit_snapshot": {"$exists": False}},
                {"$set": {"kit_snapshot": await kit_for(duration), "kit_snapshot_created_at": now()}},
            )


async def kit_for(duration: int):
    items = await db.chit_plan_items.find({"active": True}).sort("sort_order", 1).to_list(100)
    included = [x for x in items if duration in x.get("included_durations", ALLOWED_DURATIONS)]
    return [{**public(x), "final_qty": calculated_qty(x["full_qty"], duration)} for x in included]


async def packing_charge_paise():
    settings = await db.chit_settings.find_one({"id": "chit_settings"})
    return int((settings or {}).get("packing_charge_paise", DEFAULT_PACKING_PAISE))


async def delivery_charge_paise():
    settings = await db.chit_settings.find_one({"id": "chit_settings"})
    return int((settings or {}).get("delivery_charge_paise", 4_000))


async def active_plan(duration: int):
    plan = await db.chit_plans.find_one({"duration": duration, "active": True})
    if not plan:
        raise HTTPException(404, "Chit plan is not available")
    return plan


def subscription_amount_paise(sub):
    """Use the price accepted when the customer subscribed; preserve legacy records."""
    return int(sub.get("monthly_amount_paise", MONTHLY_PAISE))


@router.get("/plans")
async def plans():
    docs = await db.chit_plans.find({"active": True}).sort("duration", 1).to_list(10)
    return [public(x) for x in docs]


@router.get("/settings")
async def public_settings():
    charge_paise = await packing_charge_paise()
    delivery_paise = await delivery_charge_paise()
    return {"packing_charge_paise": charge_paise, "packing_charge_rupees": charge_paise / 100,
            "delivery_charge_paise": delivery_paise, "delivery_charge_rupees": delivery_paise / 100}

@router.post("/calculate-kit")
async def calculate(payload: CalculateIn):
    plan = await active_plan(payload.duration)
    monthly_paise = int(plan.get("monthly_amount_paise", MONTHLY_PAISE))
    kit_snapshot = await kit_for(payload.duration)
    return {"duration": payload.duration, "monthly_amount": monthly_paise / 100,
            "monthly_amount_paise": monthly_paise,
            "total_payable": monthly_paise * payload.duration / 100,
            "formula": "full_qty / 12 × duration", "items": kit_snapshot}


async def new_card_no():
    while True:
        number = f"RBS{random.randint(1000, 9999)}"
        if not await db.chit_subscriptions.find_one({"card_no": number}): return number


@router.post("/subscribe")
async def subscribe(payload: SubscribeIn, current=Depends(get_current_user)):
    if not payload.terms_accepted: raise HTTPException(400, "Terms must be accepted")
    user = await db.users.find_one({"id": current["user_id"]})
    if not user: raise HTTPException(404, "User not found")
    active = await db.chit_subscriptions.find_one({"user_id": current["user_id"], "status": {"$nin": ["cancelled", "denied", "denied_no_refund", "delivered"]}})
    if active: raise HTTPException(409, "You already have an active chit subscription")
    plan = await active_plan(payload.duration)
    monthly_paise = int(plan.get("monthly_amount_paise", MONTHLY_PAISE))
    kit_snapshot = await kit_for(payload.duration)
    sid, card = str(uuid.uuid4()), await new_card_no()
    doc = {"id": sid, "card_no": card, "user_id": current["user_id"], "name": payload.name,
           "phone": payload.phone, "address": payload.address, "city": payload.city,
           "chosen_duration": payload.duration, "plan_id": plan["id"], "paid_count": 0,
           "monthly_amount_paise": monthly_paise,
           "kit_snapshot": kit_snapshot,
           "total_paise": monthly_paise * payload.duration, "next_due_date": None,
           "status": "pending_admin_approval", "approval_status": "pending",
           "payment_setup_status": "not_created", "terms_accepted_at": now(), "created_at": now()}
    await db.chit_subscriptions.insert_one(doc)
    return {"subscription": public(doc), "message": "Application submitted for admin approval. No payment has been created or collected."}


@router.post("/start-payment")
async def start_payment(payload: MockPaymentIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub: raise HTTPException(404, "Subscription application not found")
    if sub.get("approval_status") != "approved" or sub.get("status") != "approved_awaiting_payment":
        raise HTTPException(409, "Admin approval is required before payment")
    if sub.get("razorpay_order_id") or sub.get("razorpay_subscription_id"):
        raise HTTPException(409, "Payment setup already exists; refresh your chit card")
    monthly_paise = subscription_amount_paise(sub)
    checkout = {"key": os.getenv("RAZORPAY_KEY_ID", ""), "amount": monthly_paise, "currency": "INR"}
    gateway = {}
    if rzp:
        if sub["chosen_duration"] == 1:
            entity = rzp.order.create({"amount": monthly_paise, "currency": "INR", "receipt": sub["id"][:32], "notes": {"subscription_id": sub["id"]}})
            checkout.update({"type": "order", "order_id": entity["id"]})
            gateway = {"razorpay_order_id": entity["id"]}
        else:
            plan = rzp.plan.create({"period": "monthly", "interval": 1, "item": {
                "name": f"BTA FreshMart {sub['chosen_duration']}-Month Grocery Chit",
                "amount": monthly_paise, "currency": "INR"}, "notes": {"duration": str(sub["chosen_duration"])}})
            # Immediate start makes Checkout collect the first configured term after approval.
            entity = rzp.subscription.create({"plan_id": plan["id"], "total_count": sub["chosen_duration"],
                                              "customer_notify": 1, "notes": {
                                                  "internal_subscription_id": sub["id"], "card_no": sub["card_no"]}})
            checkout.update({"type": "subscription", "subscription_id": entity["id"]})
            gateway = {"razorpay_plan_id": plan["id"], "razorpay_subscription_id": entity["id"]}
    elif os.getenv("ALLOW_MOCK_PAYMENTS", "false").lower() == "true":
        checkout.update({"type": "mock"})
    else:
        raise HTTPException(503, "Razorpay is not configured")
    await db.chit_subscriptions.update_one({"id": sub["id"], "status": "approved_awaiting_payment"}, {
        "$set": {**gateway, "payment_setup_status": "created", "updated_at": now()}})
    return {"checkout": checkout, "subscription_id": sub["id"]}


async def record_payment(sub, payment_id, amount, status="paid", event_id=None):
    if payment_id and await db.chit_payments.find_one({"razorpay_payment_id": payment_id}): return False
    payment = {"id": str(uuid.uuid4()), "subscription_id": sub["id"], "payment_no": sub["paid_count"] + 1,
               "amount_paise": int(amount), "status": status, "paid_at": now(),
               "razorpay_payment_id": payment_id, "event_id": event_id}
    try:
        await db.chit_payments.insert_one(payment)
    except DuplicateKeyError:
        return False
    new_count = sub["paid_count"] + (1 if status == "paid" else 0)
    if sub.get("approval_status") != "approved":
        new_status = "pending_admin_approval"
    else:
        new_status = "ready_for_delivery" if new_count >= sub["chosen_duration"] else "active"
    await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {
        "paid_count": new_count, "status": new_status,
        "next_due_date": None if new_status == "ready_for_delivery" else next_tenth(), "updated_at": now()}})
    if sub.get("chosen_duration") == 12 and new_count >= 12:
        if sub.get("voucher"):
            await db.chit_subscriptions.update_one(
                {"id": sub["id"], "voucher.state": "assigned"},
                {"$set": {"voucher.state": "available_to_scratch", "voucher.available_at": now(), "updated_at": now()}},
            )
        else:
            await db.admin_notifications.insert_one({
                "id": str(uuid.uuid4()), "title": "12-month voucher assignment required",
                "message": f"{sub['card_no']} completed the final payment without an assigned scratch voucher.",
                "level": "warning", "details": [], "read": False, "created_at": now(),
            })
    if new_status != "pending_admin_approval":
        await send_whatsapp(sub["phone"], "payment_success" if new_status != "ready_for_delivery" else "ready", sub)
    return True


@router.post("/verify-checkout")
async def verify_checkout(payload: CheckoutVerifyIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub: raise HTTPException(404, "Subscription not found")
    if sub.get("approval_status") != "approved": raise HTTPException(409, "Admin approval is required before payment")
    if not rzp: raise HTTPException(503, "Razorpay is not configured")
    values = {"razorpay_payment_id": payload.razorpay_payment_id, "razorpay_signature": payload.razorpay_signature}
    if payload.razorpay_order_id: values["razorpay_order_id"] = payload.razorpay_order_id
    elif payload.razorpay_subscription_id: values["razorpay_subscription_id"] = payload.razorpay_subscription_id
    else: raise HTTPException(400, "Missing Razorpay order/subscription id")
    try:
        if payload.razorpay_order_id: rzp.utility.verify_payment_signature(values)
        else: rzp.utility.verify_subscription_payment_signature(values)
    except Exception: raise HTTPException(400, "Invalid Razorpay signature")
    # Payment is created only after approval and starts immediately, so the
    # Checkout payment is the first configured term. Webhook retries are deduplicated.
    await record_payment(sub, payload.razorpay_payment_id, subscription_amount_paise(sub))
    if payload.razorpay_subscription_id:
        await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {
            "mandate_status": "authenticated", "updated_at": now()}})
    return {"ok": True}


@router.post("/mock-payment")
async def mock_payment(payload: MockPaymentIn, current=Depends(get_current_user)):
    """Local-only first instalment simulator; impossible unless explicitly enabled."""
    if os.getenv("ALLOW_MOCK_PAYMENTS", "false").lower() != "true":
        raise HTTPException(404, "Not found")
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub: raise HTTPException(404, "Subscription not found")
    if sub.get("approval_status") != "approved" or sub.get("status") != "approved_awaiting_payment":
        raise HTTPException(409, "Admin approval is required before payment")
    await record_payment(sub, f"mock_{uuid.uuid4().hex}", subscription_amount_paise(sub))
    return {"ok": True}


@router.post("/webhook")
async def webhook(request: Request, x_razorpay_signature: str = Header(default="")):
    body = await request.body(); secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret: raise HTTPException(503, "Webhook secret is not configured")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature): raise HTTPException(400, "Invalid webhook signature")
    event = await request.json(); event_name = event.get("event", "")
    if event_name == "subscription.charged":
        entity = event["payload"]["subscription"]["entity"]
        payment = event["payload"]["payment"]["entity"]
        sub = await db.chit_subscriptions.find_one({"razorpay_subscription_id": entity["id"]})
        if sub: await record_payment(sub, payment["id"], payment.get("amount", subscription_amount_paise(sub)), event_id=event.get("id"))
    elif event_name in ("subscription.pending", "subscription.failed", "subscription.payment_failed", "subscription.halted", "subscription.cancelled"):
        entity = event["payload"]["subscription"]["entity"]
        sub = await db.chit_subscriptions.find_one({"razorpay_subscription_id": entity["id"]})
        if sub:
            await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {"status": "due", "updated_at": now()}})
            await send_whatsapp(sub["phone"], "due", sub)
    return {"ok": True}


async def my_chit_payload(user_id: str):
    sub = await db.chit_subscriptions.find_one({"user_id": user_id}, sort=[("created_at", -1)])
    if not sub: raise HTTPException(404, "No chit subscription found")
    payments = await db.chit_payments.find({"subscription_id": sub["id"]}).sort("payment_no", 1).to_list(20)
    slot = await db.chit_delivery_slots.find_one({"subscription_id": sub["id"]})
    charge_paise = await packing_charge_paise()
    return {"subscription": public(sub), "payments": [public(x) for x in payments],
            "kit": sub.get("kit_snapshot") or await kit_for(sub["chosen_duration"]), "slot": public(slot),
            "packing_charge_paise": charge_paise, "packing_charge_rupees": charge_paise / 100}


@router.get("/my")
async def my_chit(current=Depends(get_current_user)):
    """Return the signed-in customer's latest chit; phone is not an identifier."""
    return await my_chit_payload(current["user_id"])


@router.get("/my/{phone}")
async def my_chit_legacy(phone: str, current=Depends(get_current_user)):
    """Backward-compatible route. Ownership still comes exclusively from JWT."""
    try:
        normalize_phone(phone)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return await my_chit_payload(current["user_id"])


@router.post("/voucher/scratch")
async def scratch_voucher(current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"user_id": current["user_id"]}, sort=[("created_at", -1)])
    if not sub or sub.get("chosen_duration") != 12:
        raise HTTPException(404, "A scratch voucher is available only for 12-month subscriptions")
    if sub.get("paid_count", 0) < 12:
        raise HTTPException(409, "Complete the final instalment to unlock your scratch voucher")
    voucher = sub.get("voucher") or {}
    if voucher.get("state") != "available_to_scratch":
        if not voucher: raise HTTPException(409, "Admin has not assigned your voucher yet")
        raise HTTPException(409, "This voucher has already been scratched or processed")
    reward = voucher.get("reward_snapshot") or {}
    revealed_at = now()
    if reward.get("type") == "grocery":
        bonus = {"id": f"voucher-{sub['id']}", "name": reward.get("item_name") or reward.get("name"),
                 "name_te": "", "final_qty": float(reward.get("qty") or 0), "unit": reward.get("unit") or "piece",
                 "price": 0, "mrp": 0, "voucher_bonus": True}
        updated = await db.chit_subscriptions.find_one_and_update(
            {"id": sub["id"], "voucher.state": "available_to_scratch"},
            {"$set": {"voucher.state": "fulfilled", "voucher.revealed_at": revealed_at,
                      "voucher.fulfilled_at": revealed_at, "updated_at": revealed_at},
             "$push": {"kit_snapshot": bonus}},
            return_document=ReturnDocument.AFTER,
        )
    else:
        updated = await db.chit_subscriptions.find_one_and_update(
            {"id": sub["id"], "voucher.state": "available_to_scratch"},
            {"$set": {"voucher.state": "cash_choice_required", "voucher.revealed_at": revealed_at, "updated_at": revealed_at}},
            return_document=ReturnDocument.AFTER,
        )
    if not updated: raise HTTPException(409, "Voucher state changed; refresh your chit card")
    return {"ok": True, "voucher": public(updated).get("voucher"),
            "message": "Voucher revealed once and permanently recorded"}


@router.post("/voucher/cash-choice")
async def voucher_cash_choice(payload: VoucherCashChoiceIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"user_id": current["user_id"]}, sort=[("created_at", -1)])
    if not sub or sub.get("voucher", {}).get("state") != "cash_choice_required":
        raise HTTPException(409, "Cash reward is not awaiting your choice")
    reward = sub["voucher"].get("reward_snapshot") or {}
    amount = int(reward.get("amount_paise") or 0)
    if reward.get("type") != "cash" or amount <= 0: raise HTTPException(409, "Assigned voucher is not a cash reward")
    if payload.choice == "wallet":
        credit_id = f"chit-voucher:{sub['id']}"
        await db.users.update_one(
            {"id": current["user_id"], "wallet_credit_ids": {"$ne": credit_id}},
            {"$inc": {"wallet_balance_paise": amount}, "$push": {"wallet_credit_ids": credit_id},
             "$set": {"wallet_updated_at": now()}},
        )
        await db.wallet_transactions.update_one(
            {"id": credit_id}, {"$setOnInsert": {"id": credit_id, "user_id": current["user_id"],
             "type": "credit", "amount_paise": amount, "source": "12_month_chit_voucher",
             "subscription_id": sub["id"], "created_at": now()}}, upsert=True,
        )
        await db.chit_subscriptions.update_one(
            {"id": sub["id"], "voucher.state": "cash_choice_required"},
            {"$set": {"voucher.state": "fulfilled", "voucher.cash_choice": "wallet",
                      "voucher.fulfilled_at": now(), "updated_at": now()}},
        )
        return {"ok": True, "choice": "wallet", "amount_paise": amount,
                "message": f"₹{amount / 100:g} added to your BTA FreshMart wallet"}
    await db.chit_subscriptions.update_one(
        {"id": sub["id"], "voucher.state": "cash_choice_required"},
        {"$set": {"voucher.state": "refund_pending_admin", "voucher.cash_choice": "razorpay_refund",
                  "voucher.refund_requested_at": now(), "updated_at": now()}},
    )
    await db.admin_notifications.insert_one({
        "id": str(uuid.uuid4()), "title": "Scratch-voucher refund approval required",
        "message": f"{sub['card_no']} requested a ₹{amount / 100:g} Razorpay refund.",
        "level": "warning", "details": [], "read": False, "created_at": now(),
    })
    return {"ok": True, "choice": "razorpay_refund",
            "message": "Razorpay refund request submitted for Admin approval"}


@router.post("/book-slot")
async def create_slot_payment(payload: SlotIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub or sub["status"] != "ready_for_delivery": raise HTTPException(409, "Complete all instalments before booking delivery")
    if sub.get("chosen_duration") == 12:
        voucher_state = (sub.get("voucher") or {}).get("state")
        if voucher_state in (None, "assigned", "available_to_scratch", "cash_choice_required"):
            raise HTTPException(409, "Reveal and process your 12-month scratch voucher before booking delivery")
    delivery = datetime.fromisoformat(payload.delivery_date).date()
    if delivery < datetime.now(IST).date(): raise HTTPException(400, "Choose a future delivery date")
    charge_paise = await packing_charge_paise()
    if not rzp and os.getenv("ALLOW_MOCK_PAYMENTS", "false").lower() == "true":
        await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {
            "packing_charge_quote_paise": charge_paise, "packing_charge_quoted_at": now()}})
        return {"type": "mock", "amount": charge_paise}
    if not rzp: raise HTTPException(503, "Razorpay is not configured")
    order = rzp.order.create({"amount": charge_paise, "currency": "INR", "receipt": f"pack-{sub['card_no']}", "notes": {"subscription_id": sub["id"], "purpose": "packing"}})
    await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {
        "packing_charge_quote_paise": charge_paise, "packing_charge_quoted_at": now(),
        "packing_razorpay_order_id": order["id"]}})
    return {"type": "razorpay", "key": os.getenv("RAZORPAY_KEY_ID"), "amount": charge_paise, "order_id": order["id"]}


@router.post("/cancel")
async def cancel_my_chit(payload: CustomerCancelIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"user_id": current["user_id"]}, sort=[("created_at", -1)])
    if not sub: raise HTTPException(404, "No chit subscription found")
    if sub.get("paid_count", 0) == 0:
        raise HTTPException(409, "Cancellation requests become available after the first payment")
    if sub.get("paid_count", 0) >= sub.get("chosen_duration", 1):
        raise HTTPException(409, "All terms are paid; proceed to delivery-slot booking")
    if sub.get("status") in ("cancellation_requested", "cancelled", "denied", "delivered", "delivery_booked"):
        raise HTTPException(409, "This chit can no longer be cancelled")
    await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {
        "status_before_cancellation_request": sub.get("status"), "status": "cancellation_requested",
        "cancellation_requested_at": now(), "cancellation_requested_by": current["user_id"],
        "cancellation_reason": payload.reason.strip() or "Cancelled by customer", "updated_at": now()}})
    return {"ok": True, "status": "cancellation_requested", "message": "Cancellation request submitted for admin approval. Previous payments will not be refunded."}


async def finalize_delivery_slot(sub, payload, payment_id: str, payment_method: str):
    if await db.chit_delivery_slots.find_one({"subscription_id": sub["id"]}): raise HTTPException(409, "Delivery slot already booked")
    charge_paise = int(sub.get("packing_charge_quote_paise") or await packing_charge_paise())
    charge_rupees = charge_paise / 100
    kit = sub.get("kit_snapshot") or await kit_for(sub["chosen_duration"]); order_id = str(uuid.uuid4())
    slot = {"id": str(uuid.uuid4()), "subscription_id": sub["id"], "delivery_date": payload.delivery_date,
            "time_slot": payload.time_slot, "packing_charge_paise": charge_paise,
            "razorpay_payment_id": payment_id, "order_id": order_id, "booked_at": now()}
    order = {"id": order_id, "order_no": f"CHIT-{sub['card_no']}", "user_id": sub["user_id"], "items": kit,
             "address": {"full_name": sub["name"], "phone": sub["phone"], "line1": sub["address"], "city": sub["city"]},
             "subtotal": 0, "packing_charge": charge_rupees, "total": charge_rupees, "payment_method": payment_method,
             "payment_status": "paid", "status": "confirmed",
             "order_type": "chit_delivery", "delivery_slot": {"date": payload.delivery_date, "time": payload.time_slot}, "created_at": now()}
    await db.chit_delivery_slots.insert_one(slot); await db.orders.insert_one(order)
    await db.chit_subscriptions.update_one({"id": sub["id"]}, {"$set": {"status": "delivery_booked", "delivery_order_id": order_id, "updated_at": now()}})
    return {"ok": True, "order_id": order_id}


@router.post("/book-slot/confirm")
async def confirm_slot(payload: SlotConfirmIn, current=Depends(get_current_user)):
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub or sub["status"] != "ready_for_delivery": raise HTTPException(409, "Subscription is not ready")
    if sub.get("packing_razorpay_order_id") != payload.razorpay_order_id:
        raise HTTPException(400, "Packing-charge order does not match the latest slot quote")
    try: rzp.utility.verify_payment_signature(payload.model_dump(include={"razorpay_order_id", "razorpay_payment_id", "razorpay_signature"}))
    except Exception: raise HTTPException(400, "Invalid packing payment signature")
    return await finalize_delivery_slot(sub, payload, payload.razorpay_payment_id, "RAZORPAY")


@router.post("/book-slot/mock-confirm")
async def confirm_mock_slot(payload: SlotIn, current=Depends(get_current_user)):
    if os.getenv("ALLOW_MOCK_PAYMENTS", "false").lower() != "true": raise HTTPException(404, "Not found")
    sub = await db.chit_subscriptions.find_one({"id": payload.subscription_id, "user_id": current["user_id"]})
    if not sub or sub["status"] != "ready_for_delivery": raise HTTPException(409, "Subscription is not ready")
    return await finalize_delivery_slot(sub, payload, f"mock_pack_{uuid.uuid4().hex}", "MOCK")


@router.get("/admin/subscriptions")
async def admin_list(status: Optional[str] = None, search: str = "", _=Depends(get_current_admin)):
    query = {}
    if status == "due_today":
        local_now = datetime.now(IST)
        start = datetime(local_now.year, local_now.month, local_now.day, tzinfo=IST).astimezone(timezone.utc)
        query["next_due_date"] = {"$gte": start, "$lt": start + timedelta(days=1)}
        query["status"] = {"$in": ["active", "authenticated", "due"]}
    elif status:
        query["status"] = status
    if search: query["$or"] = [{"card_no": {"$regex": re.escape(search), "$options": "i"}}, {"phone": {"$regex": re.escape(search)}}]
    return [public(x) for x in await db.chit_subscriptions.find(query).sort("created_at", -1).to_list(500)]

@router.get("/admin/items")
async def admin_items(_=Depends(get_current_admin)):
    return [public(x) for x in await db.chit_plan_items.find({}).sort("sort_order", 1).to_list(40)]


@router.get("/admin/items/export.csv")
async def admin_export_items_csv(_=Depends(get_current_admin)):
    items = await db.chit_plan_items.find({}).sort("sort_order", 1).to_list(40)
    columns = ["item_id", "sort_order", "name", "name_te", "full_qty", "unit", "image_url", "mrp",
               "source_url", "active", "include_1m", "include_3m", "include_6m", "include_12m",
               "auto_update_mrp", "auto_update_image"]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for item in items:
        durations = item.get("included_durations", ALLOWED_DURATIONS)
        writer.writerow({
            "item_id": item.get("id", ""), "sort_order": item.get("sort_order", ""),
            "name": item.get("name", ""), "name_te": item.get("name_te", ""),
            "full_qty": item.get("full_qty", ""), "unit": item.get("unit", ""),
            "image_url": item.get("image", ""), "mrp": item.get("mrp", 0),
            "source_url": item.get("source_url", ""), "active": str(item.get("active", True)).lower(),
            "include_1m": str(1 in durations).lower(), "include_3m": str(3 in durations).lower(),
            "include_6m": str(6 in durations).lower(), "include_12m": str(12 in durations).lower(),
            "auto_update_mrp": str(item.get("auto_update_mrp", False)).lower(),
            "auto_update_image": str(item.get("auto_update_image", True)).lower(),
        })
    data = ("\ufeff" + output.getvalue()).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(data), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=chit-master-40-items.csv"},
    )


@router.post("/admin/items/import-csv")
async def admin_import_items_csv(payload: ChitItemsCsvIn, admin=Depends(get_current_admin)):
    required = {"item_id", "sort_order", "name", "name_te", "full_qty", "unit", "image_url", "mrp",
                "source_url", "active", "include_1m", "include_3m", "include_6m", "include_12m",
                "auto_update_mrp", "auto_update_image"}
    truthy, falsy = {"true", "1", "yes", "active", "include"}, {"false", "0", "no", "inactive", "exclude"}
    def boolean(value, column):
        text = str(value or "").strip().lower()
        if text in truthy: return True
        if text in falsy: return False
        raise ValueError(f"{column} must be true or false")

    try:
        reader = csv.DictReader(payload.csv_text.lstrip("\ufeff").splitlines())
        missing = sorted(required - set(reader.fieldnames or []))
        if missing: raise ValueError("Missing CSV columns: " + ", ".join(missing))
        rows = list(reader)
    except Exception as exc:
        raise HTTPException(400, str(exc))
    if len(rows) != 40:
        raise HTTPException(400, f"The master CSV must contain exactly 40 item rows; received {len(rows)}")

    existing_count = await db.chit_plan_items.count_documents({})
    if existing_count != 40:
        raise HTTPException(409, f"Database master list must contain exactly 40 items; found {existing_count}")
    existing = await db.chit_plan_items.find({}).to_list(40)
    existing_ids = {str(item.get("id")) for item in existing}
    prepared, errors, seen_ids, seen_orders = [], [], set(), set()
    for line_no, row in enumerate(rows, start=2):
        try:
            item_id = str(row.get("item_id") or "").strip()
            if item_id not in existing_ids: raise ValueError("item_id does not match the current master list")
            if item_id in seen_ids: raise ValueError("duplicate item_id")
            seen_ids.add(item_id)
            sort_order = int(row.get("sort_order") or 0)
            if sort_order < 1 or sort_order > 40 or sort_order in seen_orders:
                raise ValueError("sort_order must be unique from 1 through 40")
            seen_orders.add(sort_order)
            name, unit = str(row.get("name") or "").strip(), str(row.get("unit") or "").strip()
            if not name or not unit: raise ValueError("name and unit are required")
            full_qty, mrp = float(row.get("full_qty") or 0), float(row.get("mrp") or 0)
            if full_qty <= 0 or mrp < 0: raise ValueError("full_qty must be positive and MRP cannot be negative")
            durations = [duration for duration in ALLOWED_DURATIONS if boolean(row.get(f"include_{duration}m"), f"include_{duration}m")]
            values = {
                "sort_order": sort_order, "name": name, "name_te": str(row.get("name_te") or "").strip(),
                "full_qty": full_qty, "unit": unit, "image": str(row.get("image_url") or "").strip(),
                "mrp": mrp, "source_url": str(row.get("source_url") or "").strip(),
                "active": boolean(row.get("active"), "active"), "included_durations": durations,
                "auto_update_mrp": boolean(row.get("auto_update_mrp"), "auto_update_mrp"),
                "auto_update_image": boolean(row.get("auto_update_image"), "auto_update_image"),
                "updated_at": now(), "updated_by": admin["user_id"],
            }
            prepared.append((item_id, values))
        except Exception as exc:
            errors.append(f"Row {line_no}: {exc}")
    if seen_ids != existing_ids:
        errors.append("CSV item IDs must match all 40 current master items exactly")
    if errors:
        await db.admin_notifications.insert_one({
            "id": str(uuid.uuid4()), "title": "Chit master CSV validation failed",
            "message": f"{len(errors)} CSV validation error(s). No master items were changed.",
            "level": "error", "details": errors[:50], "read": False, "created_at": now(),
        })
        raise HTTPException(400, {"message": "Master-kit CSV validation failed", "errors": errors[:50]})

    async def cosmos_write(item_id, values):
        for attempt in range(1, 8):
            try:
                return await db.chit_plan_items.update_one({"id": item_id}, {"$set": values})
            except Exception as exc:
                throttled = getattr(exc, "code", None) == 16500 or "16500" in str(exc)
                if not throttled or attempt == 7: raise
                await asyncio.sleep(attempt * 0.35)

    updated, failed, operation_errors = 0, 0, []
    for item_id, values in prepared:
        try:
            result = await cosmos_write(item_id, values)
            updated += result.modified_count
            await asyncio.sleep(0.05)
        except Exception as exc:
            failed += 1
            operation_errors.append(f"{values['name']}: {str(exc)[:250]}")
    if operation_errors:
        await db.admin_notifications.insert_one({
            "id": str(uuid.uuid4()), "title": "Chit master CSV import errors",
            "message": f"{failed} of 40 master items could not be updated.", "level": "error",
            "details": operation_errors[:50], "read": False, "created_at": now(),
        })
    return {"ok": failed == 0, "validated": 40, "updated": updated, "failed": failed,
            "errors": operation_errors[:50],
            "message": "Master kit and plan exclusions processed. Existing subscription snapshots are unchanged."}


@router.get("/admin/settings")
async def admin_get_settings(_=Depends(get_current_admin)):
    charge_paise = await packing_charge_paise()
    delivery_paise = await delivery_charge_paise()
    return {"packing_charge_paise": charge_paise, "packing_charge_rupees": charge_paise / 100,
            "delivery_charge_paise": delivery_paise, "delivery_charge_rupees": delivery_paise / 100}


@router.put("/admin/settings")
async def admin_update_settings(payload: ChitSettingsIn, admin=Depends(get_current_admin)):
    charge_paise = int(Decimal(str(payload.packing_charge_rupees)) * 100)
    delivery_paise = int(Decimal(str(payload.delivery_charge_rupees)) * 100)
    await db.chit_settings.update_one({"id": "chit_settings"}, {"$set": {
        "packing_charge_paise": charge_paise, "delivery_charge_paise": delivery_paise,
        "updated_at": now(), "updated_by": admin["user_id"]
    }}, upsert=True)
    return {"ok": True, "packing_charge_paise": charge_paise, "packing_charge_rupees": charge_paise / 100,
            "delivery_charge_paise": delivery_paise, "delivery_charge_rupees": delivery_paise / 100}


@router.get("/admin/plans")
async def admin_plans(_=Depends(get_current_admin)):
    docs = await db.chit_plans.find({}).sort("duration", 1).to_list(10)
    return [public(x) for x in docs]


@router.get("/admin/voucher-rewards")
async def admin_voucher_rewards(_=Depends(get_current_admin)):
    settings = await db.chit_settings.find_one({"id": "chit_settings"})
    return {"rewards": (settings or {}).get("voucher_rewards", DEFAULT_VOUCHER_REWARDS)}


@router.put("/admin/voucher-rewards")
async def admin_update_voucher_rewards(payload: VoucherRewardsIn, admin=Depends(get_current_admin)):
    rewards = [reward.model_dump() for reward in payload.rewards]
    ids = [reward["id"] for reward in rewards]
    if len(ids) != len(set(ids)): raise HTTPException(400, "Voucher reward IDs must be unique")
    for reward in rewards:
        if reward["type"] == "cash" and reward["amount_paise"] <= 0:
            raise HTTPException(400, f"{reward['name']}: cash amount must be positive")
        if reward["type"] == "grocery" and (reward["qty"] <= 0 or not reward["item_name"] or not reward["unit"]):
            raise HTTPException(400, f"{reward['name']}: grocery item, quantity and unit are required")
    await db.chit_settings.update_one(
        {"id": "chit_settings"}, {"$set": {"voucher_rewards": rewards, "voucher_rewards_updated_at": now(),
                                               "voucher_rewards_updated_by": admin["user_id"]}}, upsert=True,
    )
    return {"ok": True, "rewards": rewards,
            "message": "Reward catalogue updated. Existing voucher assignments are unchanged."}


@router.put("/admin/{subscription_id}/voucher-assignment")
async def admin_assign_voucher(subscription_id: str, payload: VoucherAssignIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Subscription not found")
    if sub.get("chosen_duration") != 12: raise HTTPException(409, "Scratch vouchers apply only to 12-month subscriptions")
    current_state = (sub.get("voucher") or {}).get("state")
    if current_state and current_state not in ("assigned", "available_to_scratch"):
        raise HTTPException(409, "A revealed or processed voucher cannot be reassigned")
    settings = await db.chit_settings.find_one({"id": "chit_settings"})
    reward = next((item for item in (settings or {}).get("voucher_rewards", DEFAULT_VOUCHER_REWARDS)
                   if item.get("id") == payload.reward_id and item.get("active", True)), None)
    if not reward: raise HTTPException(404, "Active voucher reward not found")
    state = "available_to_scratch" if sub.get("paid_count", 0) >= 12 else "assigned"
    voucher = {"reward_id": reward["id"], "reward_snapshot": reward, "state": state,
               "assigned_at": now(), "assigned_by": admin["user_id"]}
    if state == "available_to_scratch": voucher["available_at"] = now()
    await db.chit_subscriptions.update_one({"id": subscription_id}, {"$set": {"voucher": voucher, "updated_at": now()}})
    return {"ok": True, "voucher": public(voucher),
            "message": f"{reward['name']} preassigned to {sub['card_no']}"}


@router.post("/admin/{subscription_id}/voucher-refund-decision")
async def admin_voucher_refund_decision(subscription_id: str, payload: VoucherRefundDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub or sub.get("voucher", {}).get("state") != "refund_pending_admin":
        raise HTTPException(409, "No voucher refund is awaiting approval")
    if not payload.approve:
        await db.chit_subscriptions.update_one(
            {"id": subscription_id, "voucher.state": "refund_pending_admin"},
            {"$set": {"voucher.state": "cash_choice_required", "voucher.refund_rejected_at": now(),
                      "voucher.refund_rejected_by": admin["user_id"], "voucher.refund_rejection_reason": payload.reason,
                      "updated_at": now()}},
        )
        return {"ok": True, "message": "Refund request rejected; customer can select wallet credit"}
    if not rzp: raise HTTPException(503, "Razorpay is not configured")
    reward_amount = int(sub["voucher"].get("reward_snapshot", {}).get("amount_paise") or 0)
    payment = await db.chit_payments.find_one(
        {"subscription_id": subscription_id, "status": "paid"}, sort=[("payment_no", -1)]
    )
    if not payment or not payment.get("razorpay_payment_id"):
        raise HTTPException(409, "Final Razorpay payment record is unavailable")
    if int(payment.get("amount_paise") or 0) < reward_amount:
        raise HTTPException(409, "Final payment is below the voucher amount; reject this request so the customer can choose wallet credit")
    locked = await db.chit_subscriptions.update_one(
        {"id": subscription_id, "voucher.state": "refund_pending_admin"},
        {"$set": {"voucher.state": "refund_processing", "voucher.refund_approved_at": now(),
                  "voucher.refund_approved_by": admin["user_id"], "updated_at": now()}},
    )
    if not locked.modified_count: raise HTTPException(409, "Refund is already being processed")
    try:
        refund = rzp.payment.refund(payment["razorpay_payment_id"], {
            "amount": reward_amount, "notes": {"subscription_id": subscription_id, "purpose": "12_month_scratch_voucher"}
        })
    except Exception as exc:
        await db.chit_subscriptions.update_one(
            {"id": subscription_id, "voucher.state": "refund_processing"},
            {"$set": {"voucher.state": "refund_pending_admin", "voucher.refund_error": str(exc)[:500], "updated_at": now()}},
        )
        raise HTTPException(502, f"Razorpay refund failed: {exc}")
    await db.chit_subscriptions.update_one(
        {"id": subscription_id, "voucher.state": "refund_processing"},
        {"$set": {"voucher.state": "fulfilled", "voucher.fulfilled_at": now(),
                  "voucher.razorpay_refund_id": refund.get("id"), "voucher.refund_error": None, "updated_at": now()}},
    )
    return {"ok": True, "message": f"₹{reward_amount / 100:g} Razorpay refund submitted successfully", "refund_id": refund.get("id")}


@router.put("/admin/plans/{duration}/price")
async def admin_update_plan_price(
    duration: int,
    payload: ChitPlanPriceIn,
    admin=Depends(get_current_admin),
):
    if duration not in ALLOWED_DURATIONS:
        raise HTTPException(404, "Chit plan not found")
    monthly_paise = int(
        (Decimal(str(payload.monthly_amount_rupees)) * 100).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
    result = await db.chit_plans.update_one(
        {"duration": duration},
        {"$set": {
            "monthly_amount_paise": monthly_paise,
            "total_paise": monthly_paise * duration,
            "updated_at": now(),
            "updated_by": admin["user_id"],
        }},
    )
    if not result.matched_count:
        raise HTTPException(404, "Chit plan not found")
    return {
        "ok": True,
        "duration": duration,
        "monthly_amount_paise": monthly_paise,
        "monthly_amount_rupees": monthly_paise / 100,
        "total_paise": monthly_paise * duration,
        "total_rupees": monthly_paise * duration / 100,
        "message": "Plan price updated for new subscriptions only",
    }

@router.post("/admin/items")
async def admin_add_item(item: ItemIn, _=Depends(get_current_admin)):
    if await db.chit_plan_items.count_documents({}) >= 40: raise HTTPException(409, "Master kit already has 40 items")
    doc = {"id": str(uuid.uuid4()), **item.model_dump(), "active": True, "created_at": now()}
    await db.chit_plan_items.insert_one(doc); return public(doc)

@router.put("/admin/items/{item_id}")
async def admin_edit_item(item_id: str, item: ItemIn, _=Depends(get_current_admin)):
    result = await db.chit_plan_items.update_one({"id": item_id}, {"$set": {**item.model_dump(), "updated_at": now()}})
    if not result.matched_count: raise HTTPException(404, "Item not found")
    return {"ok": True}

@router.post("/admin/items/refresh")
async def admin_refresh_items(payload: ChitRefreshIn, _=Depends(get_current_admin)):
    docs=await db.chit_plan_items.find({"source_url":{"$nin":[None,""]}}).to_list(100); results=[]
    for item in docs:
        try:
            checked=await inspect_source(item["source_url"]); changes=proposed_update(item,checked)
            if payload.apply: await db.chit_plan_items.update_one({"id":item["id"]},{"$set":changes})
            results.append({"id":item["id"],"name":item["name"],"status":"ready","changes":changes})
        except Exception as e: results.append({"id":item["id"],"name":item["name"],"status":"error","error":str(e)[:300]})
    return {"applied":payload.apply,"checked":len(results),"ready":sum(x["status"]=="ready" for x in results),"results":results}

@router.post("/admin/{subscription_id}/remind")
async def admin_remind(subscription_id: str, _=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Subscription not found")
    return {"sent": await send_whatsapp(sub["phone"], "due", sub)}


async def cancel_gateway_subscription(sub):
    gateway_id = sub.get("razorpay_subscription_id")
    if gateway_id and rzp:
        try:
            gateway = rzp.subscription.fetch(gateway_id)
            if gateway.get("status") in ("cancelled", "completed", "expired"):
                return
            rzp.subscription.cancel(gateway_id, {"cancel_at_cycle_end": 0})
        except Exception as exc:
            # Razorpay also rejects cancellation when it is already cancelled/completed.
            log.warning("Razorpay subscription cancellation failed for %s: %s", gateway_id, exc)
            raise HTTPException(502, "Unable to cancel the Razorpay subscription")


@router.post("/admin/{subscription_id}/approve")
async def admin_approve(subscription_id: str, decision: AdminDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Subscription application not found")
    can_reapprove_fully_paid = (
        sub.get("status") == "refund_failed"
        and sub.get("paid_count", 0) >= sub.get("chosen_duration", 1)
    )
    if can_reapprove_fully_paid and await db.chit_payments.count_documents({"subscription_id": subscription_id, "status": "refunded"}):
        raise HTTPException(409, "This chit has an already-refunded instalment and cannot be re-approved for delivery")
    if sub.get("approval_status") != "pending" or (
        sub.get("status") != "pending_admin_approval" and not can_reapprove_fully_paid
    ):
        raise HTTPException(409, "Only a paid/authenticated pending application can be approved")
    if sub.get("paid_count", 0) == 0:
        approved_status = "approved_awaiting_payment"
    elif sub["paid_count"] >= sub["chosen_duration"]:
        approved_status = "ready_for_delivery"
    else:
        approved_status = "active"
    await db.chit_subscriptions.update_one({"id": subscription_id, "approval_status": "pending"}, {"$set": {
        "approval_status": "approved", "status": approved_status,
        "approved_at": now(), "approved_by": admin["user_id"], "admin_note": decision.reason,
        "next_due_date": None if approved_status in ("approved_awaiting_payment", "ready_for_delivery") else sub.get("next_due_date") or next_tenth(),
        "refund_error": None, "refund_ids": [], "updated_at": now()}})
    fresh = {**sub, "status": approved_status}
    await send_whatsapp(sub["phone"], "ready" if approved_status == "ready_for_delivery" else "approved", fresh)
    return {"ok": True, "status": approved_status}


@router.post("/admin/{subscription_id}/deny")
async def admin_deny(subscription_id: str, decision: AdminDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Subscription application not found")
    if sub.get("approval_status") != "pending": raise HTTPException(409, "Application has already been decided")
    await cancel_gateway_subscription(sub)
    fully_paid = sub.get("paid_count", 0) >= sub.get("chosen_duration", 1)
    if fully_paid:
        # Business rule: once the final instalment is paid, denial never initiates a refund.
        await db.chit_subscriptions.update_one({"id": subscription_id}, {"$set": {
            "approval_status": "denied", "status": "denied_no_refund", "denied_at": now(),
            "denied_by": admin["user_id"], "admin_note": decision.reason,
            "next_due_date": None, "refund_error": None, "refund_ids": [],
            "refund_policy": "not_applicable_fully_paid", "updated_at": now()}})
        return {"ok": True, "status": "denied_no_refund", "refund_count": 0,
                "message": "Fully paid chit denied without refund, as required by the completed-plan policy."}
    payments = await db.chit_payments.find({"subscription_id": subscription_id, "status": "paid"}).to_list(20)
    already_refunded = await db.chit_payments.find({"subscription_id": subscription_id, "status": "refunded"}).to_list(20)
    refunds = [p["refund_id"] for p in already_refunded if p.get("refund_id")]
    for payment in payments:
        payment_id = payment.get("razorpay_payment_id") or ""
        try:
            is_local_payment = not payment_id.startswith("pay_")
            if os.getenv("ALLOW_MOCK_PAYMENTS", "false").lower() == "true" and is_local_payment:
                refund_id = f"mock_refund_{uuid.uuid4().hex}"
            elif payment_id.startswith("pay_") and rzp:
                gateway_payment = rzp.payment.fetch(payment_id)
                if gateway_payment.get("status") != "captured":
                    raise RuntimeError(f"Payment is {gateway_payment.get('status')}, not captured; Razorpay cannot refund it yet")
                refund = rzp.payment.refund(payment_id, {"amount": payment["amount_paise"], "notes": {"reason": "Chit application denied", "card_no": sub["card_no"]}})
                refund_id = refund["id"]
            else:
                raise RuntimeError("Payment has no valid Razorpay payment ID and mock payments are disabled")
            await db.chit_payments.update_one({"id": payment["id"]}, {"$set": {"status": "refunded", "refund_id": refund_id, "refunded_at": now()}})
            refunds.append(refund_id)
        except Exception as exc:
            await db.chit_subscriptions.update_one({"id": subscription_id}, {"$set": {"status": "refund_failed", "refund_error": str(exc), "next_due_date": None, "updated_at": now()}})
            raise HTTPException(502, "Razorpay refund failed. Application was not marked denied; review it manually.")
    await db.chit_subscriptions.update_one({"id": subscription_id}, {"$set": {
        "approval_status": "denied", "status": "denied", "denied_at": now(),
        "denied_by": admin["user_id"], "admin_note": decision.reason,
        "next_due_date": None, "refund_ids": refunds, "refund_error": None, "updated_at": now()}})
    return {"ok": True, "status": "denied", "refund_count": len(refunds)}


@router.post("/admin/{subscription_id}/cancel")
async def admin_cancel(subscription_id: str, decision: AdminDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Subscription not found")
    if sub.get("status") in ("cancelled", "denied", "delivered"):
        raise HTTPException(409, "Subscription is already closed")
    await cancel_gateway_subscription(sub)
    await db.chit_subscriptions.update_one({"id": subscription_id}, {"$set": {
        "status": "cancelled", "cancelled_at": now(), "cancelled_by": admin["user_id"],
        "cancellation_reason": decision.reason, "next_due_date": None, "updated_at": now()}})
    return {"ok": True, "status": "cancelled", "message": "Future automatic debits have been stopped. Existing payments were not automatically refunded."}


@router.post("/admin/{subscription_id}/approve-cancellation")
async def admin_approve_customer_cancellation(subscription_id: str, decision: AdminDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Chit cancellation request not found")
    if sub.get("status") != "cancellation_requested": raise HTTPException(409, "No pending customer cancellation request")
    await cancel_gateway_subscription(sub)
    # Permanent deletion is intentionally limited to this exact subscription and its children.
    await db.chit_payments.delete_many({"subscription_id": subscription_id})
    await db.chit_delivery_slots.delete_many({"subscription_id": subscription_id})
    if sub.get("delivery_order_id"):
        await db.orders.delete_one({"id": sub["delivery_order_id"], "order_type": "chit_delivery"})
    result = await db.chit_subscriptions.delete_one({"id": subscription_id, "status": "cancellation_requested"})
    if not result.deleted_count: raise HTTPException(409, "Cancellation request changed; refresh the page")
    return {"ok": True, "deleted": True, "message": "Customer cancellation approved. The chit and associated payment records were permanently deleted; previous payments were not refunded."}


@router.post("/admin/{subscription_id}/reject-cancellation")
async def admin_reject_customer_cancellation(subscription_id: str, decision: AdminDecisionIn, admin=Depends(get_current_admin)):
    sub = await db.chit_subscriptions.find_one({"id": subscription_id})
    if not sub: raise HTTPException(404, "Chit cancellation request not found")
    if sub.get("status") != "cancellation_requested": raise HTTPException(409, "No pending customer cancellation request")
    restore_status = sub.get("status_before_cancellation_request") or "active"
    await db.chit_subscriptions.update_one({"id": subscription_id, "status": "cancellation_requested"}, {
        "$set": {"status": restore_status, "cancellation_rejected_at": now(),
                 "cancellation_rejected_by": admin["user_id"], "cancellation_admin_note": decision.reason,
                 "updated_at": now()},
        "$unset": {"status_before_cancellation_request": "", "cancellation_requested_at": "", "cancellation_requested_by": ""},
    })
    return {"ok": True, "status": restore_status, "message": "Customer cancellation request rejected; the chit remains active."}

@router.get("/admin/export.xlsx")
async def admin_export(_=Depends(get_current_admin)):
    rows = await db.chit_subscriptions.find({}).sort("created_at", -1).to_list(5000)
    wb = Workbook(); ws = wb.active; ws.title = "Chit subscriptions"
    ws.append(["Card No", "Name", "Phone", "Duration", "Paid", "Next due", "Approval", "Status", "Address"])
    for x in rows: ws.append([x["card_no"], x["name"], x["phone"], x["chosen_duration"], x["paid_count"], str(x.get("next_due_date") or ""), x.get("approval_status", "legacy"), x["status"], x["address"]])
    output = io.BytesIO(); wb.save(output); output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=chit-subscriptions.xlsx"})


async def send_whatsapp(phone, template, sub):
    token, phone_id = os.getenv("WHATSAPP_ACCESS_TOKEN"), os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_id: log.info("WhatsApp skipped: not configured"); return False
    template_names = {"due": os.getenv("WA_TEMPLATE_DUE", "chit_payment_reminder"), "payment_success": os.getenv("WA_TEMPLATE_PAID", "chit_payment_success"), "ready": os.getenv("WA_TEMPLATE_READY", "chit_ready_for_delivery"), "approved": os.getenv("WA_TEMPLATE_APPROVED", "chit_application_approved")}
    payload = {"messaging_product": "whatsapp", "to": f"91{normalize_phone(phone)}", "type": "template", "template": {"name": template_names[template], "language": {"code": "en"}, "components": [{"type": "body", "parameters": [{"type": "text", "text": sub["name"]}, {"type": "text", "text": sub["card_no"]}]}]}}
    async with httpx.AsyncClient(timeout=15) as http:
        response = await http.post(f"https://graph.facebook.com/v21.0/{phone_id}/messages", headers={"Authorization": f"Bearer {token}"}, json=payload)
        if response.is_error: log.error("WhatsApp error %s", response.text); return False
    return True


async def daily_due_check():
    local = datetime.now(IST); today_end = now() + timedelta(days=1)
    await db.chit_subscriptions.update_many({"status": "active", "next_due_date": {"$lt": now()}}, {"$set": {"status": "due", "updated_at": now()}})
    if local.day in (8, 10, 11):
        cursor = db.chit_subscriptions.find({"status": {"$in": ["active", "due"]}, "paid_count": {"$lt": 12}})
        async for sub in cursor: await send_whatsapp(sub["phone"], "due", sub)

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
def start_chit_scheduler():
    if not scheduler.running:
        scheduler.add_job(daily_due_check, "cron", hour=9, minute=0, id="chit-due-check", replace_existing=True)
        scheduler.start()
def stop_chit_scheduler():
    if scheduler.running: scheduler.shutdown(wait=False)
