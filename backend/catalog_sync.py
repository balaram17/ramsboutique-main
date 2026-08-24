"""Safe schema.org based catalogue reference checks."""
import json, re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import httpx

def utcnow(): return datetime.now(timezone.utc)
def safe_url(value):
    p=urlparse(value or ""); h=(p.hostname or "").lower()
    return p.scheme in {"http","https"} and h not in {"localhost","127.0.0.1","0.0.0.0","::1"} and not h.endswith((".local",".internal"))
def walk(v):
    if isinstance(v,dict):
        yield v
        for x in v.values(): yield from walk(x)
    elif isinstance(v,list):
        for x in v: yield from walk(x)
def money(v):
    m=re.search(r"\d+(?:\.\d+)?",str(v).replace(",", "")) if v is not None else None
    n=float(m.group()) if m else None
    return round(n,2) if n and n < 1_000_000 else None
async def inspect_source(url):
    if not safe_url(url): raise ValueError("Only public http/https source URLs are allowed")
    async with httpx.AsyncClient(timeout=15,follow_redirects=True,headers={"User-Agent":"RamsBoutique-CatalogCheck/1.0"}) as c:
        r=await c.get(url); r.raise_for_status()
        if len(r.content)>2_000_000: raise ValueError("Source page is too large")
    nodes=[]
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',r.text,re.I|re.S):
        try: nodes.extend(walk(json.loads(raw.strip())))
        except Exception: pass
    product=next((x for x in nodes if str(x.get("@type","")).lower()=="product"),{})
    offer=product.get("offers") or {}; offer=(offer[0] if offer else {}) if isinstance(offer,list) else offer
    price=money(offer.get("price") if isinstance(offer,dict) else None)
    mrp=money(product.get("highPrice") or (offer.get("highPrice") if isinstance(offer,dict) else None)) or price
    image=product.get("image"); image=(image[0] if image else None) if isinstance(image,list) else image
    image=(image.get("url") or image.get("contentUrl")) if isinstance(image,dict) else image
    if not image:
        m=re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',r.text,re.I); image=m.group(1) if m else None
    image=urljoin(url,str(image)) if image else None
    return {"price":price,"mrp":mrp,"image":image if safe_url(image) else None,"checked_at":utcnow()}
def proposed_update(doc,result):
    out={"source_checked_at":result["checked_at"],"source_status":"ok"}
    if result.get("price") is not None:
        out["reference_price"]=result["price"]
        if doc.get("auto_update_price"): out["price"]=result["price"]
    if result.get("mrp") is not None:
        out["reference_mrp"]=result["mrp"]
        if doc.get("auto_update_mrp"): out["mrp"]=max(result["mrp"],result.get("price") or 0)
    if result.get("image") and (doc.get("auto_update_image",True) or not doc.get("image")): out["image"]=result["image"]
    return out
