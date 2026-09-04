from dmart_sync import (
    build_parent_from_sku_rows,
    clean_parent_name,
    group_csv_rows,
    parent_source_key,
    sku_row_from_csv,
    sku_row_from_dmart,
    unit_sort_key,
)


def _parent(skus, name="Sunrich Refined Sunflower Oil", product_id="14144"):
    return build_parent_from_sku_rows(
        product_id=product_id,
        parent_name=name,
        brand="Sunrich",
        token="groceries",
        category_name="Groceries",
        category_slug="dmart-groceries",
        category_map={"L1": "Grocery", "L2": "Edible Oils", "L3": ""},
        source_url="https://www.dmart.in/pdp/14144",
        sku_rows=skus,
    )


def test_clean_parent_name_strips_pack_size():
    assert clean_parent_name("Sunrich Refined Sunflower Oil : 800 g") == "Sunrich Refined Sunflower Oil"
    assert clean_parent_name("Fortune Sunlite Refined Sunflower Oil : 4.35 kg") == "Fortune Sunlite Refined Sunflower Oil"
    assert clean_parent_name("Aashirvaad Atta") == "Aashirvaad Atta"


def test_two_pack_sizes_become_one_product_with_variants():
    parent = _parent([
        sku_row_from_dmart({
            "skuUniqueID": "11108", "name": "Sunrich Refined Sunflower Oil : 800 g",
            "variantTextValue": "800 g", "priceMRP": "198.00", "maxQuantity": 20,
            "defaultVariant": "Y", "productImageKey": "oil800", "imgCode": "3",
        }),
        sku_row_from_dmart({
            "skuUniqueID": "11109", "name": "Sunrich Refined Sunflower Oil : 4 kg",
            "variantTextValue": "4 kg", "priceMRP": "1051.00", "maxQuantity": 3,
            "defaultVariant": "N", "productImageKey": "oil4kg", "imgCode": "4",
        }),
    ])
    assert parent["source_key"] == parent_source_key("14144")
    assert parent["source_kind"] == "parent"
    assert parent["name"] == "Sunrich Refined Sunflower Oil"
    assert [v["unit"] for v in parent["variants"]] == ["800 g", "4 kg"]
    assert parent["unit"] == "800 g"
    assert parent["price"] == 198.0
    assert parent["source_sku_ids"] == ["11108", "11109"]
    assert parent["variants"][0]["default"] is True
    assert parent["variants"][1]["price"] == 1051.0
    assert "oil800" in parent["image"]


def test_own_label_skus_are_excluded():
    parent = _parent(
        [sku_row_from_dmart({
            "skuUniqueID": "11345", "name": "DMart Premia Sugar : 1 kg",
            "variantTextValue": "1 kg", "priceMRP": "100", "maxQuantity": 6,
            "defaultVariant": "Y",
        })],
        name="DMart Premia Sugar",
        product_id="15112",
    )
    assert parent is None


def test_csv_rows_group_by_product_id():
    prepared = [
        ("groceries", "11108", "Sunrich Refined Sunflower Oil : 800 g", 198.0, {
            "product_id": "14144", "brand": "Sunrich", "unit": "800 g",
            "image_url": "https://cdn.dmart.in/a.jpg", "source_url": "https://www.dmart.in/pdp/14144",
            "category_l1": "Grocery", "category_l2": "Oils", "category_l3": "",
            "name": "Sunrich Refined Sunflower Oil : 800 g",
        }),
        ("groceries", "11109", "Sunrich Refined Sunflower Oil : 4 kg", 1051.0, {
            "product_id": "14144", "brand": "Sunrich", "unit": "4 kg",
            "image_url": "https://cdn.dmart.in/b.jpg", "source_url": "https://www.dmart.in/pdp/14144",
            "category_l1": "Grocery", "category_l2": "Oils", "category_l3": "",
            "name": "Sunrich Refined Sunflower Oil : 4 kg",
        }),
        ("groceries", "682001", "Wada Kolam Sorted Rice : 10 kg", 1000.0, {
            "product_id": "1864521", "brand": "Wada Kolam", "unit": "10 kg",
            "image_url": "https://cdn.dmart.in/c.jpg", "source_url": "https://www.dmart.in/pdp/1864521",
            "category_l1": "Grocery", "category_l2": "Rice", "category_l3": "",
            "name": "Wada Kolam Sorted Rice : 10 kg",
        }),
    ]
    parents = group_csv_rows(prepared, {"groceries": "Groceries"})
    by_id = {item["source_product_id"]: item for item in parents}
    assert set(by_id) == {"14144", "1864521"}
    assert len(by_id["14144"]["variants"]) == 2
    assert by_id["14144"]["name"] == "Sunrich Refined Sunflower Oil"
    assert len(by_id["1864521"]["variants"]) == 1


def test_unit_sort_puts_smaller_pack_first():
    assert unit_sort_key("800 g") < unit_sort_key("4 kg")
    assert unit_sort_key("1 kg") < unit_sort_key("5 kg")


def test_sku_row_from_csv_keeps_uploaded_image():
    row = sku_row_from_csv({"unit": "1 kg", "image_url": "https://cdn.example/x.jpg"}, "99", "Atta : 1 kg", 55)
    assert row["image"] == "https://cdn.example/x.jpg"
    assert row["sku_id"] == "99"
