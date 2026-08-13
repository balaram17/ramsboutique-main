import os
import razorpay
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

router = APIRouter( prefix="/api/payments/razorpay", tags=["payments"] )

client = razorpay.Client(auth=( os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET") ))

@router.post("/create-order")
async def create_order(payload: dict):
    try:
        order_id = payload.get("order_id")

        if not order_id:
            raise HTTPException(status_code=400, detail="order_id is required")

        # Temporary test amount
        amount = 10000  # ₹100 in paise

        razorpay_order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1,
            "receipt": order_id,
        })

        return {
            "key_id": os.getenv("RAZORPAY_KEY_ID"),
            "amount": amount,
            "currency": "INR",
            "order_no": order_id,
            "razorpay_order_id": razorpay_order["id"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify")
async def verify_payment(payload: dict):
    return {"success": True}


@router.post("/cancel")
async def cancel_payment(payload: dict):
    return {"success": True}