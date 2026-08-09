#!/usr/bin/env python3
"""Backend API tests for Rams Boutique Vizag - Razorpay Integration"""
import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://vizag-shop-admin.preview.emergentagent.com/api"

# Test counters
tests_passed = 0
tests_failed = 0
failed_tests = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def test(name, condition, error_msg=""):
    global tests_passed, tests_failed, failed_tests
    if condition:
        tests_passed += 1
        log(f"✅ {name}")
        return True
    else:
        tests_failed += 1
        failed_tests.append(f"{name}: {error_msg}")
        log(f"❌ {name}: {error_msg}")
        return False

def signup_user(name, email, phone, password):
    """Helper to signup a new user"""
    resp = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": name,
        "email": email,
        "phone": phone,
        "password": password
    })
    return resp

def login_user(email, password):
    """Helper to login a user"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    return resp

def create_order(token, items, address, payment_method, note="", coupon_code=None):
    """Helper to create an order"""
    payload = {
        "items": items,
        "address": address,
        "payment_method": payment_method,
        "note": note
    }
    if coupon_code:
        payload["coupon_code"] = coupon_code
    
    resp = requests.post(
        f"{BASE_URL}/orders",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    return resp

def get_product_id():
    """Get a product ID for testing"""
    resp = requests.get(f"{BASE_URL}/products")
    if resp.status_code == 200:
        products = resp.json()
        if products:
            return products[0]["id"]
    return None

# ============ TEST SUITE ============

log("=" * 60)
log("RAZORPAY INTEGRATION TESTS")
log("=" * 60)

# Test 1: Config endpoint
log("\n--- Test 1: GET /api/payments/razorpay/config ---")
resp = requests.get(f"{BASE_URL}/payments/razorpay/config")
test(
    "Config endpoint returns 200",
    resp.status_code == 200,
    f"Expected 200, got {resp.status_code}"
)
if resp.status_code == 200:
    data = resp.json()
    test(
        "Config has key_id field",
        "key_id" in data,
        f"Response: {data}"
    )
    test(
        "Config has enabled field",
        "enabled" in data,
        f"Response: {data}"
    )
    test(
        "key_id starts with 'rzp_'",
        data.get("key_id", "").startswith("rzp_"),
        f"key_id: {data.get('key_id')}"
    )
    test(
        "enabled is true",
        data.get("enabled") == True,
        f"enabled: {data.get('enabled')}"
    )
    log(f"Config: {json.dumps(data, indent=2)}")

# Test 2: Create Razorpay order - Happy path
log("\n--- Test 2: Create Razorpay order - Happy path ---")

# Signup a new user
timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
test_email = f"razorpay_test_{timestamp}@test.com"
test_phone = f"9{timestamp[-9:]}"
log(f"Creating test user: {test_email}")

signup_resp = signup_user("Razorpay Test User", test_email, test_phone, "Test@123")
test(
    "User signup successful",
    signup_resp.status_code == 200,
    f"Status: {signup_resp.status_code}, Response: {signup_resp.text}"
)

if signup_resp.status_code == 200:
    user_token = signup_resp.json().get("token")
    test(
        "Signup returns token",
        user_token is not None,
        "No token in signup response"
    )
    
    # Get a product ID
    product_id = get_product_id()
    test(
        "Got product ID for testing",
        product_id is not None,
        "No products available"
    )
    
    if user_token and product_id:
        # Create an order with UPI payment method (inside 5km)
        address = {
            "full_name": "Razorpay Test",
            "phone": test_phone,
            "line1": "Test Address Line 1",
            "line2": "Near Dwaraka Nagar",
            "city": "Visakhapatnam",
            "pincode": "530016",
            "lat": 17.723,
            "lng": 83.301
        }
        
        items = [{"product_id": product_id, "qty": 2}]
        
        order_resp = create_order(user_token, items, address, "UPI", "Test order for Razorpay")
        test(
            "Order creation successful",
            order_resp.status_code == 200,
            f"Status: {order_resp.status_code}, Response: {order_resp.text}"
        )
        
        if order_resp.status_code == 200:
            order_data = order_resp.json()
            internal_order_id = order_data.get("id")
            test(
                "Order has payment_status='pending'",
                order_data.get("payment_status") == "pending",
                f"payment_status: {order_data.get('payment_status')}"
            )
            log(f"Created order: {internal_order_id}, order_no: {order_data.get('order_no')}")
            
            # Now create Razorpay order
            rzp_create_resp = requests.post(
                f"{BASE_URL}/payments/razorpay/create-order",
                json={"order_id": internal_order_id},
                headers={"Authorization": f"Bearer {user_token}"}
            )
            test(
                "Razorpay create-order returns 200",
                rzp_create_resp.status_code == 200,
                f"Status: {rzp_create_resp.status_code}, Response: {rzp_create_resp.text}"
            )
            
            if rzp_create_resp.status_code == 200:
                rzp_data = rzp_create_resp.json()
                test(
                    "Response has key_id",
                    "key_id" in rzp_data,
                    f"Response: {rzp_data}"
                )
                test(
                    "Response has razorpay_order_id",
                    "razorpay_order_id" in rzp_data,
                    f"Response: {rzp_data}"
                )
                test(
                    "razorpay_order_id starts with 'order_'",
                    rzp_data.get("razorpay_order_id", "").startswith("order_"),
                    f"razorpay_order_id: {rzp_data.get('razorpay_order_id')}"
                )
                test(
                    "Response has amount (integer paise)",
                    "amount" in rzp_data and isinstance(rzp_data["amount"], int),
                    f"amount: {rzp_data.get('amount')}, type: {type(rzp_data.get('amount'))}"
                )
                test(
                    "Response has currency='INR'",
                    rzp_data.get("currency") == "INR",
                    f"currency: {rzp_data.get('currency')}"
                )
                test(
                    "Response has order_no",
                    "order_no" in rzp_data,
                    f"Response: {rzp_data}"
                )
                
                # Verify amount is total * 100
                expected_amount = int(round(order_data.get("total", 0) * 100))
                test(
                    "Amount in paise = total * 100",
                    rzp_data.get("amount") == expected_amount,
                    f"Expected {expected_amount}, got {rzp_data.get('amount')}"
                )
                
                log(f"Razorpay order created: {json.dumps(rzp_data, indent=2)}")
                
                # Verify the internal order was updated
                orders_resp = requests.get(
                    f"{BASE_URL}/orders/my",
                    headers={"Authorization": f"Bearer {user_token}"}
                )
                if orders_resp.status_code == 200:
                    orders = orders_resp.json()
                    created_order = next((o for o in orders if o["id"] == internal_order_id), None)
                    if created_order:
                        test(
                            "Internal order has razorpay_order_id",
                            "razorpay_order_id" in created_order,
                            f"Order: {created_order}"
                        )
                        test(
                            "Internal order has razorpay_amount",
                            "razorpay_amount" in created_order,
                            f"Order: {created_order}"
                        )

# Test 3: Create-order access control & validation
log("\n--- Test 3: Create-order access control & validation ---")

# 3a: No auth -> 401
rzp_no_auth = requests.post(
    f"{BASE_URL}/payments/razorpay/create-order",
    json={"order_id": "dummy"}
)
test(
    "Create-order without auth returns 401",
    rzp_no_auth.status_code == 401,
    f"Expected 401, got {rzp_no_auth.status_code}"
)

# 3b: Wrong user -> 403
# Create another user
timestamp2 = datetime.now().strftime("%Y%m%d%H%M%S") + "2"
test_email2 = f"razorpay_test_{timestamp2}@test.com"
test_phone2 = f"9{timestamp2[-9:]}"
signup_resp2 = signup_user("Another User", test_email2, test_phone2, "Test@123")
if signup_resp2.status_code == 200:
    user_token2 = signup_resp2.json().get("token")
    if user_token2 and internal_order_id:
        rzp_wrong_user = requests.post(
            f"{BASE_URL}/payments/razorpay/create-order",
            json={"order_id": internal_order_id},
            headers={"Authorization": f"Bearer {user_token2}"}
        )
        test(
            "Create-order with wrong user returns 403",
            rzp_wrong_user.status_code == 403,
            f"Expected 403, got {rzp_wrong_user.status_code}"
        )

# 3c: Order with COD -> 400
if user_token and product_id:
    cod_order_resp = create_order(user_token, items, address, "COD", "COD order")
    if cod_order_resp.status_code == 200:
        cod_order_id = cod_order_resp.json().get("id")
        rzp_cod = requests.post(
            f"{BASE_URL}/payments/razorpay/create-order",
            json={"order_id": cod_order_id},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        test(
            "Create-order with COD method returns 400",
            rzp_cod.status_code == 400,
            f"Expected 400, got {rzp_cod.status_code}, Response: {rzp_cod.text}"
        )
        test(
            "Error message mentions 'not for online payment'",
            "not for online payment" in rzp_cod.text.lower(),
            f"Response: {rzp_cod.text}"
        )

# 3d: Non-existent order -> 404
rzp_not_found = requests.post(
    f"{BASE_URL}/payments/razorpay/create-order",
    json={"order_id": "nonexistent-order-id"},
    headers={"Authorization": f"Bearer {user_token}"}
)
test(
    "Create-order with non-existent order returns 404",
    rzp_not_found.status_code == 404,
    f"Expected 404, got {rzp_not_found.status_code}"
)

# Test 4: Verify endpoint
log("\n--- Test 4: Verify endpoint ---")

# 4a: Invalid signature -> 400 and payment_status=failed
if user_token and internal_order_id and rzp_data:
    verify_resp = requests.post(
        f"{BASE_URL}/payments/razorpay/verify",
        json={
            "order_id": internal_order_id,
            "razorpay_order_id": rzp_data.get("razorpay_order_id"),
            "razorpay_payment_id": "pay_fakepaymentid123",
            "razorpay_signature": "invalid_signature_12345"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    test(
        "Verify with invalid signature returns 400",
        verify_resp.status_code == 400,
        f"Expected 400, got {verify_resp.status_code}, Response: {verify_resp.text}"
    )
    test(
        "Error message mentions 'signature verification failed'",
        "signature verification failed" in verify_resp.text.lower(),
        f"Response: {verify_resp.text}"
    )
    
    # Check that payment_status is now 'failed'
    orders_resp = requests.get(
        f"{BASE_URL}/orders/my",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    if orders_resp.status_code == 200:
        orders = orders_resp.json()
        failed_order = next((o for o in orders if o["id"] == internal_order_id), None)
        if failed_order:
            test(
                "Order payment_status is 'failed' after invalid signature",
                failed_order.get("payment_status") == "failed",
                f"payment_status: {failed_order.get('payment_status')}"
            )

# 4b: No auth -> 401
verify_no_auth = requests.post(
    f"{BASE_URL}/payments/razorpay/verify",
    json={
        "order_id": "dummy",
        "razorpay_order_id": "order_dummy",
        "razorpay_payment_id": "pay_dummy",
        "razorpay_signature": "dummy"
    }
)
test(
    "Verify without auth returns 401",
    verify_no_auth.status_code == 401,
    f"Expected 401, got {verify_no_auth.status_code}"
)

# 4c: Wrong user -> 403
if user_token2 and internal_order_id and rzp_data:
    verify_wrong_user = requests.post(
        f"{BASE_URL}/payments/razorpay/verify",
        json={
            "order_id": internal_order_id,
            "razorpay_order_id": rzp_data.get("razorpay_order_id"),
            "razorpay_payment_id": "pay_dummy",
            "razorpay_signature": "dummy"
        },
        headers={"Authorization": f"Bearer {user_token2}"}
    )
    test(
        "Verify with wrong user returns 403",
        verify_wrong_user.status_code == 403,
        f"Expected 403, got {verify_wrong_user.status_code}"
    )

# 4d: Non-existent order -> 404
verify_not_found = requests.post(
    f"{BASE_URL}/payments/razorpay/verify",
    json={
        "order_id": "nonexistent-order-id",
        "razorpay_order_id": "order_dummy",
        "razorpay_payment_id": "pay_dummy",
        "razorpay_signature": "dummy"
    },
    headers={"Authorization": f"Bearer {user_token}"}
)
test(
    "Verify with non-existent order returns 404",
    verify_not_found.status_code == 404,
    f"Expected 404, got {verify_not_found.status_code}"
)

# Test 5: Cancel endpoint
log("\n--- Test 5: Cancel endpoint ---")

# Create a new order for cancellation test
if user_token and product_id:
    cancel_order_resp = create_order(user_token, items, address, "UPI", "Order to cancel")
    if cancel_order_resp.status_code == 200:
        cancel_order_id = cancel_order_resp.json().get("id")
        
        # Cancel the order
        cancel_resp = requests.post(
            f"{BASE_URL}/payments/razorpay/cancel",
            json={"order_id": cancel_order_id},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        test(
            "Cancel endpoint returns 200",
            cancel_resp.status_code == 200,
            f"Expected 200, got {cancel_resp.status_code}, Response: {cancel_resp.text}"
        )
        test(
            "Cancel response has ok=true",
            cancel_resp.json().get("ok") == True,
            f"Response: {cancel_resp.json()}"
        )
        
        # Verify payment_status is 'cancelled'
        orders_resp = requests.get(
            f"{BASE_URL}/orders/my",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        if orders_resp.status_code == 200:
            orders = orders_resp.json()
            cancelled_order = next((o for o in orders if o["id"] == cancel_order_id), None)
            if cancelled_order:
                test(
                    "Order payment_status is 'cancelled'",
                    cancelled_order.get("payment_status") == "cancelled",
                    f"payment_status: {cancelled_order.get('payment_status')}"
                )

# 5b: No auth -> 401
cancel_no_auth = requests.post(
    f"{BASE_URL}/payments/razorpay/cancel",
    json={"order_id": "dummy"}
)
test(
    "Cancel without auth returns 401",
    cancel_no_auth.status_code == 401,
    f"Expected 401, got {cancel_no_auth.status_code}"
)

# 5c: Non-existent order -> 404
cancel_not_found = requests.post(
    f"{BASE_URL}/payments/razorpay/cancel",
    json={"order_id": "nonexistent-order-id"},
    headers={"Authorization": f"Bearer {user_token}"}
)
test(
    "Cancel with non-existent order returns 404",
    cancel_not_found.status_code == 404,
    f"Expected 404, got {cancel_not_found.status_code}"
)

# 5d: Wrong user -> 404
if user_token2 and cancel_order_id:
    cancel_wrong_user = requests.post(
        f"{BASE_URL}/payments/razorpay/cancel",
        json={"order_id": cancel_order_id},
        headers={"Authorization": f"Bearer {user_token2}"}
    )
    test(
        "Cancel with wrong user returns 404",
        cancel_wrong_user.status_code == 404,
        f"Expected 404, got {cancel_wrong_user.status_code}"
    )

# Test 6: Regression tests
log("\n--- Test 6: Regression tests ---")

# 6a: GET /api/orders/my still works
if user_token:
    orders_resp = requests.get(
        f"{BASE_URL}/orders/my",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    test(
        "GET /api/orders/my returns 200",
        orders_resp.status_code == 200,
        f"Expected 200, got {orders_resp.status_code}"
    )
    if orders_resp.status_code == 200:
        orders = orders_resp.json()
        test(
            "Orders list is not empty",
            len(orders) > 0,
            f"Expected orders, got empty list"
        )
        # Check that orders have razorpay fields
        if orders:
            sample_order = orders[0]
            test(
                "Orders include payment_status field",
                "payment_status" in sample_order,
                f"Order: {sample_order}"
            )

# 6b: Auth login still works
login_resp = login_user(test_email, "Test@123")
test(
    "Auth login returns 200",
    login_resp.status_code == 200,
    f"Expected 200, got {login_resp.status_code}"
)
test(
    "Login returns token",
    login_resp.json().get("token") is not None if login_resp.status_code == 200 else False,
    "No token in login response"
)

# 6c: Store status still works
store_status_resp = requests.get(f"{BASE_URL}/store-status")
test(
    "GET /api/store-status returns 200",
    store_status_resp.status_code == 200,
    f"Expected 200, got {store_status_resp.status_code}"
)

# ============ SUMMARY ============
log("\n" + "=" * 60)
log("TEST SUMMARY")
log("=" * 60)
log(f"Total tests: {tests_passed + tests_failed}")
log(f"✅ Passed: {tests_passed}")
log(f"❌ Failed: {tests_failed}")

if tests_failed > 0:
    log("\nFailed tests:")
    for failed in failed_tests:
        log(f"  - {failed}")
    sys.exit(1)
else:
    log("\n🎉 All tests passed!")
    sys.exit(0)
