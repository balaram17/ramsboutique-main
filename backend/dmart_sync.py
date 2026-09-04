"""DMart Ready catalogue import helpers.

Only the public MRP field is used. DMart's selling price is intentionally ignored.

DMart returns one parent product with multiple SKUs (pack sizes). Those SKUs are
stored as variants on a single Rams Boutique product instead of separate listings.
"""
import asyncio
import re
from collections import defaultdict
from datetime import datetime, timezone

import httpx

DMART_API = "https://digital.dmart.in/api/v3/plp"
DMART_WEB = "https://www.dmart.in"
DMART_CDN = "https://cdn.dmart.in"
DMART_PINCODE = "530016"
PARENT_KEY_PREFIX = "dmart:p:"
LEGACY_MERGED_REASON = "merged_into_parent_variants"

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

_UNIT_SUFFIX = re.compile(
    r"\s*[:\-–]\s*[\d.]+\s*(kg|kgs|g|gm|gms|l|ltr|lt|ml|pcs?|pieces?)\s*$",
    re.I,
)
_UNIT_AMOUNT = re.compile(r"([\d.]+)\s*(kg|kgs|g|gm|gms|l|ltr|lt|ml|pcs?|pieces?)?", re.I)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def rams_slug(token):
    return "dmart-" + re.sub(r"[^a-z0-9]+", "-", token.lower()).strip("-")


def parent_source_key(product_id):
    return f"{PARENT_KEY_PREFIX}{product_id}"


def is_parent_key(source_key):
    return str(source_key or "").startswith(PARENT_KEY_PREFIX)


def is_own_label(name):
    return str(name or "").strip().casefold().startswith("dmart")


def parse_mrp(value):
    try:
        mrp = round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0
    return mrp if mrp > 0 else 0.0


def clean_parent_name(name):
    text = str(name or "").strip()
    cleaned = _UNIT_SUFFIX.sub("", text).strip(" :-–")
    return cleaned or text


def image_url(sku):
    key = str(sku.get("productImageKey") or "").strip("/")
    code = str(sku.get("imgCode") or "").strip()
    if not key:
        return ""
    # DMart's product cards use productImageKey_imgCode_size.jpg (P = medium).
    return f"{DMART_CDN}/images/products/{key}_{code}_P.jpg" if code else ""


def is_default_sku(sku):
    flag = str(sku.get("defaultVariant") if isinstance(sku, dict) else "").strip().upper()
    if isinstance(sku, dict) and sku.get("default") is True:
        return True
    return flag in {"Y", "TRUE", "1"}


def unit_sort_key(unit):
    text = str(unit or "").strip().lower()
    match = _UNIT_AMOUNT.search(text.replace(" ", "")) or _UNIT_AMOUNT.search(text)
    if not match:
        return (99, 0.0, text)
    amount = float(match.group(1))
    suffix = (match.group(2) or "").lower()
    millilitres = amount
    if suffix in {"kg", "kgs", "l", "ltr", "lt"}:
        millilitres = amount * 1000
    elif suffix in {"g", "gm", "gms", "ml"}:
        millilitres = amount
    elif suffix in {"pc", "pcs", "piece", "pieces"}:
        millilitres = amount
    return (0, millilitres, text)


def unique_variant_units(variants):
    seen = set()
    out = []
    for variant in variants:
        unit = str(variant.get("unit") or "piece").strip() or "piece"
        if unit in seen:
            sku_id = str(variant.get("sku_id") or "").strip()
            unit = f"{unit} ({sku_id})" if sku_id else f"{unit} ({len(seen) + 1})"
        seen.add(unit)
        out.append({**variant, "unit": unit})
    return out


def sku_row_from_dmart(sku):
    sku_id = str(sku.get("skuUniqueID") or "").strip()
    name = str(sku.get("name") or "").strip()
    return {
        "sku_id": sku_id,
        "name": name,
        "unit": str(sku.get("variantTextValue") or "piece").strip() or "piece",
        "mrp": parse_mrp(sku.get("priceMRP")),
        "image": image_url(sku),
        "stock": int(float(sku.get("maxQuantity") or 100)),
        "default": is_default_sku(sku),
    }


def sku_row_from_csv(row, sku_id, name, mrp):
    return {
        "sku_id": sku_id,
        "name": name,
        "unit": str(row.get("unit") or "piece").strip() or "piece",
        "mrp": mrp,
        "image": str(row.get("image_url") or "").strip(),
        "stock": 100,
        "default": False,
    }


def sku_row_from_existing(doc):
    variants = doc.get("variants") or []
    if variants:
        rows = []
        for variant in variants:
            sku_id = str(variant.get("sku_id") or doc.get("source_sku_id") or "").strip()
            rows.append({
                "sku_id": sku_id,
                "name": doc.get("name") or "",
                "unit": str(variant.get("unit") or doc.get("unit") or "piece").strip() or "piece",
                "mrp": parse_mrp(variant.get("mrp") or variant.get("price") or doc.get("mrp")),
                "image": str(variant.get("image") or doc.get("image") or "").strip(),
                "stock": int(float(variant.get("stock") or doc.get("stock") or 100)),
                "default": bool(variant.get("default")),
            })
        return rows
    return [{
        "sku_id": str(doc.get("source_sku_id") or "").strip(),
        "name": doc.get("name") or "",
        "unit": str(doc.get("unit") or "piece").strip() or "piece",
        "mrp": parse_mrp(doc.get("mrp") or doc.get("price")),
        "image": str(doc.get("image") or "").strip(),
        "stock": int(float(doc.get("stock") or 100)),
        "default": True,
    }]


def build_parent_from_sku_rows(
    *,
    product_id,
    parent_name,
    brand,
    token,
    category_name,
    category_slug,
    category_map,
    source_url,
    sku_rows,
):
    product_id = str(product_id or "").strip()
    if not product_id:
        return None
    variants = []
    for row in sku_rows:
        sku_id = str(row.get("sku_id") or "").strip()
        name = str(row.get("name") or parent_name or "").strip()
        if not sku_id:
            continue
        if is_own_label(name) or is_own_label(parent_name):
            continue
        mrp = parse_mrp(row.get("mrp"))
        if mrp <= 0:
            continue
        variants.append({
            "unit": str(row.get("unit") or "piece").strip() or "piece",
            "price": mrp,
            "mrp": mrp,
            "stock": int(float(row.get("stock") or 100)),
            "image": str(row.get("image") or "").strip(),
            "sku_id": sku_id,
            "default": bool(row.get("default")),
        })
    if not variants:
        return None

    variants = unique_variant_units(variants)
    variants.sort(key=lambda item: unit_sort_key(item["unit"]))
    default = next((item for item in variants if item.get("default")), variants[0])
    for item in variants:
        item["default"] = item is default

    display_name = clean_parent_name(parent_name) or clean_parent_name(sku_rows[0].get("name"))
    sku_ids = [item["sku_id"] for item in variants]
    return {
        "source_market": "dmart",
        "source_kind": "parent",
        "source_key": parent_source_key(product_id),
        "source_product_id": product_id,
        "source_sku_id": default["sku_id"],
        "source_sku_ids": sku_ids,
        "source_category_token": token,
        "source_pincode": DMART_PINCODE,
        "source_category_l1": (category_map or {}).get("L1", ""),
        "source_category_l2": (category_map or {}).get("L2", ""),
        "source_category_l3": (category_map or {}).get("L3", ""),
        "name": display_name,
        "brand": str(brand or "DMart").strip() or "DMart",
        "category": category_slug,
        "sub": (category_map or {}).get("L2") or category_name,
        "price": default["price"],
        "mrp": default["mrp"],
        "unit": default["unit"],
        "image": default["image"] or next((item["image"] for item in variants if item.get("image")), ""),
        "desc": "",
        "stock": default["stock"],
        "variants": variants,
        "source_url": source_url or "",
        "auto_update_price": True,
        "auto_update_mrp": True,
        "auto_update_image": True,
        "active": True,
        "inactive_reason": None,
        "source_checked_at": now_iso(),
        "source_status": "ok",
        "updated_at": now_iso(),
    }


def group_csv_rows(prepared_rows, known_categories):
    """Group CSV SKU rows by (category token, DMart product id)."""
    groups = {}
    for token, sku_id, name, mrp, row in prepared_rows:
        product_id = str(row.get("product_id") or "").strip() or sku_id
        bucket = groups.setdefault((token, product_id), {"meta": row, "rows": []})
        bucket["rows"].append(sku_row_from_csv(row, sku_id, name, mrp))
    parents = []
    for (token, product_id), bucket in groups.items():
        row = bucket["meta"]
        sku_rows = bucket["rows"]
        parent = build_parent_from_sku_rows(
            product_id=product_id,
            parent_name=str(row.get("name") or sku_rows[0]["name"]),
            brand=str(row.get("brand") or "DMart"),
            token=token,
            category_name=known_categories.get(token, token),
            category_slug=rams_slug(token),
            category_map={
                "L1": str(row.get("category_l1") or "").strip(),
                "L2": str(row.get("category_l2") or "").strip(),
                "L3": str(row.get("category_l3") or "").strip(),
            },
            source_url=str(row.get("source_url") or "").strip(),
            sku_rows=sku_rows,
        )
        if parent:
            parents.append(parent)
    return parents


async def hide_legacy_sku_products(db, token=None):
    query = {
        "source_market": "dmart",
        "source_kind": {"$ne": "parent"},
        "active": {"$ne": False},
    }
    if token:
        query["source_category_token"] = token
    result = await db.products.update_many(
        query,
        {"$set": {
            "active": False,
            "inactive_reason": LEGACY_MERGED_REASON,
            "updated_at": now_iso(),
        }},
    )
    return result.modified_count


async def delete_all_dmart_products(db):
    """Permanently remove every DMart-sourced product. Other catalogues are left untouched."""
    deleted = 0
    while True:
        docs = await db.products.find({"source_market": "dmart"}, {"id": 1}).to_list(500)
        ids = [doc.get("id") for doc in docs if doc.get("id")]
        if not ids:
            leftover = await db.products.delete_many({"source_market": "dmart"})
            deleted += leftover.deleted_count
            break
        result = await db.products.delete_many({"id": {"$in": ids}})
        deleted += result.deleted_count
        if result.deleted_count == 0:
            break
        await asyncio.sleep(0.05)
    return deleted


async def collapse_existing_sku_products(db):
    """Merge already-imported per-SKU DMart rows into parent products with variants."""
    legacy = await db.products.find({
        "source_market": "dmart",
        "source_kind": {"$ne": "parent"},
    }).to_list(50000)
    groups = defaultdict(list)
    skipped = 0
    for doc in legacy:
        product_id = str(doc.get("source_product_id") or "").strip()
        if not product_id:
            skipped += 1
            continue
        groups[product_id].append(doc)

    added = updated = hidden = 0
    for product_id, docs in groups.items():
        sku_rows = []
        for doc in docs:
            sku_rows.extend(sku_row_from_existing(doc))
        sample = docs[0]
        parent = build_parent_from_sku_rows(
            product_id=product_id,
            parent_name=sample.get("name") or "",
            brand=sample.get("brand") or "DMart",
            token=sample.get("source_category_token") or "",
            category_name=sample.get("sub") or "",
            category_slug=sample.get("category") or rams_slug(sample.get("source_category_token") or "groceries"),
            category_map={
                "L1": sample.get("source_category_l1") or "",
                "L2": sample.get("source_category_l2") or "",
                "L3": sample.get("source_category_l3") or "",
            },
            source_url=sample.get("source_url") or "",
            sku_rows=sku_rows,
        )
        if not parent:
            continue
        source_key = parent["source_key"]
        existing = await db.products.find_one({"source_key": source_key}, {"_id": 1})
        await db.products.update_one(
            {"source_key": source_key},
            {"$set": parent, "$setOnInsert": {"id": source_key, "created_at": now_iso()}},
            upsert=True,
        )
        if existing:
            updated += 1
        else:
            added += 1
        hide_ids = [doc.get("id") for doc in docs if doc.get("id") and doc.get("id") != source_key]
        if hide_ids:
            result = await db.products.update_many(
                {"id": {"$in": hide_ids}},
                {"$set": {
                    "active": False,
                    "inactive_reason": LEGACY_MERGED_REASON,
                    "updated_at": now_iso(),
                }},
            )
            hidden += result.modified_count
        await asyncio.sleep(0.02)
    leftover = await hide_legacy_sku_products(db)
    hidden += leftover
    return {"added": added, "updated": updated, "hidden": hidden, "skipped": skipped, "groups": len(groups)}


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
    headers = {"User-Agent": "BTAFreshMart-CatalogSync/1.0", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers=headers) as client:
        for category_index, token in enumerate(tokens, start=1):
            category_name = known[token]
            seen_product_ids = set()
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
                        product_id = str(product.get("productId") or "").strip()
                        parent_name = str(product.get("name") or "").strip()
                        if not product_id:
                            continue
                        if is_own_label(parent_name):
                            continue
                        category_map = {x.get("level"): x.get("name", "") for x in product.get("categoryMap", [])}
                        sku_rows = []
                        for sku in product.get("sKUs", []):
                            row = sku_row_from_dmart(sku)
                            if not row["sku_id"]:
                                continue
                            if is_own_label(row["name"]):
                                continue
                            if row["mrp"] <= 0:
                                errors.append(f"{category_name}: {row['name'] or row['sku_id']} has no valid MRP")
                                continue
                            sku_rows.append(row)
                        values = build_parent_from_sku_rows(
                            product_id=product_id,
                            parent_name=parent_name,
                            brand=str(product.get("manufacturer") or "DMart").strip(),
                            token=token,
                            category_name=category_name,
                            category_slug=category_slug,
                            category_map=category_map,
                            source_url=f"{DMART_WEB}{product.get('targetUrl') or '/'}",
                            sku_rows=sku_rows,
                        )
                        if not values:
                            continue
                        seen_product_ids.add(product_id)
                        total_skus += len(values.get("source_sku_ids") or [])
                        source_key = values["source_key"]
                        existing = await db.products.find_one({"source_key": source_key}, {"_id": 1})
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
                     "source_kind": "parent",
                     "source_product_id": {"$nin": list(seen_product_ids)},
                     "active": {"$ne": False}},
                    {"$set": {"active": False, "inactive_reason": "missing_from_dmart", "updated_at": now_iso()}},
                )
                total_hidden += hide_result.modified_count
                total_hidden += await hide_legacy_sku_products(db, token)
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
