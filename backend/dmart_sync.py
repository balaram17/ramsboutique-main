"""DMart Ready catalogue import helpers.

Only the public MRP field is used. DMart's selling price is intentionally ignored.
"""
import asyncio
import re
from datetime import datetime, timezone

import httpx

DMART_API = "https://digital.dmart.in/api/v3/plp"
DMART_WEB = "https://www.dmart.in"
DMART_CDN = "https://cdn.dmart.in"
DMART_PINCODE = "530016"

DMART_CATEGORIES = [
    ("aesc--footwear", "Footwear"),
    ("baby-care", "Baby Care"),
    ("banner-categories", "Banner Categories"),
    ("books-204003--1", "Books"),
    ("clothing-and-accessories", "Clothing & Accessories"),
    ("dairy-and-beverages", "Dairy & Beverages"),
    ("electronics-appliances", "Electronics & Appliances"),
    ("events", "Events"),
    ("fruits-and-vegetables", "Fruits & Vegetables"),
    ("gifting-229002--1", "Gifting"),
    ("groceries", "Groceries"),
    ("home-and-bathroom-cleaners", "Home & Bathroom Cleaners"),
    ("home-furnishing-and-decor", "Home Furnishing & Decor"),
    ("home-utility-organisers", "Home Utility & Organisers"),
    ("kitchen-dining", "Kitchen & Dining"),
    ("packaged-foods", "Packaged Foods"),
    ("personal-care-beauty", "Personal Care & Beauty"),
    ("school-supplies", "School Supplies"),
    ("shop-by-room", "Shop By Room"),
    ("specials-seasonal", "Specials & Seasonal"),
    ("sports-and-fitness", "Sports & Fitness"),
    ("trolley-bags-handbags-more", "Trolley Bags, Handbags & More"),
]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def rams_slug(token):
    return "dmart-" + re.sub(r"[^a-z0-9]+", "-", token.lower()).strip("-")


def image_url(sku):
    key = str(sku.get("productImageKey") or "").strip("/")
    code = str(sku.get("imgCode") or "").strip()
    if not key:
        return ""
    # DMart's product cards use productImageKey_imgCode_size.jpg (P = medium).
    return f"{DMART_CDN}/images/products/{key}_{code}_P.jpg" if code else ""


async def fetch_page(client, token, page, size=100):
    response = await client.get(
        f"{DMART_API}/{token}",
        params={"page": page, "buryOOS": "true", "size": size, "channel": "web"},
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data.get("products"), list):
        raise ValueError("DMart response did not contain a products list")
    return data


async def sync_categories(db, tokens, job_id, notify):
    selected = set(tokens)
    known = dict(DMART_CATEGORIES)
    invalid = sorted(selected - set(known))
    if invalid:
        raise ValueError("Unknown DMart categories: " + ", ".join(invalid))

    await db.dmart_sync_jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "running", "started_at": now_iso(), "category_total": len(selected)}},
    )
    # Clean up any own-label rows imported by an older version of the workflow.
    legacy = await db.products.find({"source_market": "dmart"}, {"id": 1, "name": 1}).to_list(50000)
    own_label_ids = [
        item.get("id") for item in legacy
        if str(item.get("name") or "").strip().casefold().startswith("dmart") and item.get("id")
    ]
    if own_label_ids:
        await db.products.update_many(
            {"id": {"$in": own_label_ids}},
            {"$set": {"active": False, "inactive_reason": "dmart_own_label_excluded", "updated_at": now_iso()}},
        )
    total_added = total_updated = total_hidden = total_skus = 0
    errors = []
    headers = {"User-Agent": "RamsBoutique-CatalogSync/1.0", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as client:
        for category_index, token in enumerate(tokens, start=1):
            category_name = known[token]
            seen = set()
            try:
                first = await fetch_page(client, token, 1)
                total_records = int(first.get("totalRecords") or 0)
                pages = max(1, (total_records + 99) // 100)
                page_payloads = [first]
                for page in range(2, pages + 1):
                    page_payloads.append(await fetch_page(client, token, page))
                    await asyncio.sleep(0.08)

                category_slug = rams_slug(token)
                await db.categories.update_one(
                    {"slug": category_slug},
                    {"$setOnInsert": {
                        "id": category_slug, "slug": category_slug, "name": category_name,
                        "icon": "shopping-basket", "order": 100, "active": True,
                    }},
                    upsert=True,
                )

                for payload in page_payloads:
                    for product in payload.get("products", []):
                        category_map = {x.get("level"): x.get("name", "") for x in product.get("categoryMap", [])}
                        for sku in product.get("sKUs", []):
                            sku_id = str(sku.get("skuUniqueID") or "").strip()
                            if not sku_id:
                                continue
                            product_name = str(sku.get("name") or product.get("name") or "").strip()
                            # Rams Boutique must not list DMart's own-label items.
                            if product_name.casefold().startswith("dmart"):
                                continue
                            try:
                                mrp = round(float(sku.get("priceMRP") or 0), 2)
                            except (TypeError, ValueError):
                                mrp = 0
                            if mrp <= 0:
                                errors.append(f"{category_name}: {sku.get('name') or sku_id} has no valid MRP")
                                continue
                            seen.add(sku_id)
                            total_skus += 1
                            source_key = f"dmart:{sku_id}"
                            existing = await db.products.find_one({"source_key": source_key}, {"_id": 1})
                            values = {
                                "source_market": "dmart", "source_key": source_key,
                                "source_product_id": str(product.get("productId") or ""),
                                "source_sku_id": sku_id, "source_category_token": token,
                                "source_pincode": DMART_PINCODE,
                                "name": product_name,
                                "brand": str(product.get("manufacturer") or "DMart").strip(),
                                "category": category_slug, "sub": category_map.get("L2") or category_name,
                                "source_category_l1": category_map.get("L1", ""),
                                "source_category_l2": category_map.get("L2", ""),
                                "source_category_l3": category_map.get("L3", ""),
                                # User requirement: Rams price and MRP both use DMart's priceMRP.
                                "price": mrp, "mrp": mrp,
                                "unit": str(sku.get("variantTextValue") or "piece").strip(),
                                "image": image_url(sku), "desc": "",
                                "stock": int(float(sku.get("maxQuantity") or 100)), "variants": [],
                                "source_url": f"{DMART_WEB}{product.get('targetUrl') or '/'}",
                                "auto_update_price": True, "auto_update_mrp": True,
                                "auto_update_image": True, "active": True,
                                "inactive_reason": None, "source_checked_at": now_iso(),
                                "source_status": "ok", "updated_at": now_iso(),
                            }
                            await db.products.update_one(
                                {"source_key": source_key},
                                {"$set": values, "$setOnInsert": {"id": source_key, "created_at": now_iso()}},
                                upsert=True,
                            )
                            if existing:
                                total_updated += 1
                            else:
                                total_added += 1
                            await asyncio.sleep(0.025)

                hide_result = await db.products.update_many(
                    {"source_market": "dmart", "source_category_token": token,
                     "source_sku_id": {"$nin": list(seen)}, "active": {"$ne": False}},
                    {"$set": {"active": False, "inactive_reason": "missing_from_dmart", "updated_at": now_iso()}},
                )
                total_hidden += hide_result.modified_count
                await db.dmart_categories.update_one(
                    {"token": token},
                    {"$set": {"token": token, "name": category_name, "enabled": True,
                              "total_records": total_records, "last_synced_at": now_iso(), "last_error": None}},
                    upsert=True,
                )
            except Exception as exc:
                message = f"{category_name}: {str(exc)[:300]}"
                errors.append(message)
                await db.dmart_categories.update_one(
                    {"token": token}, {"$set": {"last_error": message, "last_attempt_at": now_iso()}}, upsert=True,
                )
            await db.dmart_sync_jobs.update_one(
                {"id": job_id}, {"$set": {
                    "category_done": category_index, "current_category": category_name,
                    "added": total_added, "updated": total_updated, "hidden": total_hidden,
                    "sku_count": total_skus, "errors": errors[-50:], "updated_at": now_iso(),
                }},
            )

    status = "completed_with_errors" if errors else "completed"
    await db.dmart_sync_jobs.update_one(
        {"id": job_id}, {"$set": {"status": status, "finished_at": now_iso(),
                                    "added": total_added, "updated": total_updated,
                                    "hidden": total_hidden, "sku_count": total_skus,
                                    "errors": errors[-50:]}},
    )
    if errors:
        await notify("DMart catalogue sync errors", f"{len(errors)} error(s) occurred during DMart sync.", details=errors[-50:])
