"""seed data for Vizag store."""

CATEGORIES = [
    {"slug": "grocery", "name": "Grocery & Staples", "icon": "wheat"},
    {"slug": "dairy", "name": "Dairy & Bakery", "icon": "milk"},
    {"slug": "fruits-vegetables", "name": "Fruits & Vegetables", "icon": "apple"},
    {"slug": "beverages", "name": "Beverages", "icon": "coffee"},
    {"slug": "snacks", "name": "Snacks & Branded Foods", "icon": "cookie"},
    {"slug": "personal-care", "name": "Personal Care", "icon": "sparkles"},
    {"slug": "home-care", "name": "Home Care", "icon": "spray-can"},
    {"slug": "baby-care", "name": "Baby Care", "icon": "baby"},
    {"slug": "kitchen", "name": "Kitchen & Dining", "icon": "utensils"},
    {"slug": "fashion", "name": "Fashion", "icon": "shirt"},
]

PRODUCTS = [
    # Grocery & Staples
    {"name": "Premia Basmati Rice", "brand": "Premia", "category": "grocery", "sub": "Rice", "price": 425, "mrp": 550, "unit": "5 kg", "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "desc": "Premium long-grain basmati rice, aged for aroma."},
    {"name": "Aashirvaad Atta Whole Wheat", "brand": "Aashirvaad", "category": "grocery", "sub": "Atta & Flours", "price": 265, "mrp": 340, "unit": "5 kg", "image": "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400", "desc": "100% whole wheat atta for soft rotis."},
    {"name": "Fortune Sunflower Oil Pouch", "brand": "Fortune", "category": "grocery", "sub": "Edible Oils", "price": 155, "mrp": 180, "unit": "1 L", "image": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400", "desc": "Refined sunflower oil, rich in vitamin E."},
    {"name": "Tata Salt Iodized", "brand": "Tata", "category": "grocery", "sub": "Salt & Sugar", "price": 28, "mrp": 30, "unit": "1 kg", "image": "https://placehold.co/400x400/png?text=Tata+Salt", "desc": "Iodized salt for daily cooking."},
    {"name": "Madhur Pure Sugar", "brand": "Madhur", "category": "grocery", "sub": "Salt & Sugar", "price": 52, "mrp": 55, "unit": "1 kg", "image": "https://placehold.co/400x400/png?text=Madhur+Sugar", "desc": "Pure crystal sugar."},
    {"name": "Tur Dal Premium", "brand": "Premia", "category": "grocery", "sub": "Dals & Pulses", "price": 155, "mrp": 180, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400", "desc": "Cleaned and polished tur dal."},
    {"name": "Moong Dal", "brand": "Premia", "category": "grocery", "sub": "Dals & Pulses", "price": 135, "mrp": 160, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400", "desc": "Split yellow moong dal."},
    {"name": "MDH Garam Masala", "brand": "MDH", "category": "grocery", "sub": "Masalas & Spices", "price": 78, "mrp": 90, "unit": "100 g", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", "desc": "Authentic Indian garam masala blend."},
    {"name": "Everest Turmeric Powder", "brand": "Everest", "category": "grocery", "sub": "Masalas & Spices", "price": 45, "mrp": 55, "unit": "200 g", "image": "https://images.unsplash.com/photo-1615485291234-9d694218aeb0?w=400", "desc": "Pure turmeric haldi powder."},
    {"name": "Saffola Gold Oil", "brand": "Saffola", "category": "grocery", "sub": "Edible Oils", "price": 195, "mrp": 220, "unit": "1 L", "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", "desc": "Blended edible oil for a healthy heart."},

    # Dairy & Bakery
    {"name": "Amul Gold Milk", "brand": "Amul", "category": "dairy", "sub": "Milk", "price": 68, "mrp": 70, "unit": "1 L", "image": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400", "desc": "Full cream toned milk."},
    {"name": "Amul Butter Salted", "brand": "Amul", "category": "dairy", "sub": "Butter & Cheese", "price": 260, "mrp": 275, "unit": "500 g", "image": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400", "desc": "Utterly butterly delicious."},
    {"name": "Britannia Cheese Slices", "brand": "Britannia", "category": "dairy", "sub": "Butter & Cheese", "price": 145, "mrp": 160, "unit": "200 g", "image": "https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=400", "desc": "10 cheese slices, rich & creamy."},
    {"name": "Nestle Curd", "brand": "Nestle", "category": "dairy", "sub": "Curd & Yogurt", "price": 45, "mrp": 50, "unit": "400 g", "image": "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=400", "desc": "Fresh set curd."},
    {"name": "Britannia Brown Bread", "brand": "Britannia", "category": "dairy", "sub": "Bread", "price": 55, "mrp": 60, "unit": "400 g", "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400", "desc": "Whole wheat brown bread."},
    {"name": "Amul Paneer", "brand": "Amul", "category": "dairy", "sub": "Paneer", "price": 95, "mrp": 105, "unit": "200 g", "image": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400", "desc": "Fresh malai paneer."},

    # Fruits & Vegetables
    {"name": "Fresh Banana Robusta", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Fruits", "price": 48, "mrp": 60, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400", "desc": "Sweet farm-fresh bananas."},
    {"name": "Shimla Apple", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Fruits", "price": 189, "mrp": 220, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400", "desc": "Crisp red Shimla apples."},
    {"name": "Alphonso Mango", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Fruits", "price": 350, "mrp": 450, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400", "desc": "King of mangoes from Ratnagiri."},
    {"name": "Onion", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Vegetables", "price": 32, "mrp": 40, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400", "desc": "Farm fresh red onions."},
    {"name": "Tomato Local", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Vegetables", "price": 28, "mrp": 40, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400", "desc": "Ripe red tomatoes."},
    {"name": "Potato", "brand": "Fresh", "category": "fruits-vegetables", "sub": "Vegetables", "price": 34, "mrp": 45, "unit": "1 kg", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400", "desc": "Fresh graded potatoes."},

    # Beverages
    {"name": "Tata Tea Gold", "brand": "Tata", "category": "beverages", "sub": "Tea", "price": 275, "mrp": 320, "unit": "500 g", "image": "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400", "desc": "Rich aroma tea leaves."},
    {"name": "Nescafe Classic Coffee", "brand": "Nescafe", "category": "beverages", "sub": "Coffee", "price": 285, "mrp": 320, "unit": "100 g", "image": "https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=400", "desc": "Instant coffee, rich taste."},
    {"name": "Coca-Cola", "brand": "Coca-Cola", "category": "beverages", "sub": "Soft Drinks", "price": 40, "mrp": 45, "unit": "750 ml", "image": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400", "desc": "Refreshing cola drink."},
    {"name": "Real Mixed Fruit Juice", "brand": "Real", "category": "beverages", "sub": "Juices", "price": 110, "mrp": 130, "unit": "1 L", "image": "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400", "desc": "100% mixed fruit juice."},
    {"name": "Bisleri Water", "brand": "Bisleri", "category": "beverages", "sub": "Water", "price": 20, "mrp": 25, "unit": "1 L", "image": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400", "desc": "Packaged drinking water."},

    # Snacks
    {"name": "Lays Classic Salted", "brand": "Lays", "category": "snacks", "sub": "Chips", "price": 18, "mrp": 20, "unit": "52 g", "image": "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=400", "desc": "Crunchy salted potato chips."},
    {"name": "Kurkure Masala Munch", "brand": "Kurkure", "category": "snacks", "sub": "Namkeen", "price": 18, "mrp": 20, "unit": "82 g", "image": "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400", "desc": "Tedha hai par mera hai."},
    {"name": "Parle-G Biscuits", "brand": "Parle", "category": "snacks", "sub": "Biscuits", "price": 10, "mrp": 10, "unit": "80 g", "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400", "desc": "Original glucose biscuits."},
    {"name": "Oreo Chocolate Cookies", "brand": "Cadbury", "category": "snacks", "sub": "Biscuits", "price": 35, "mrp": 40, "unit": "120 g", "image": "https://images.unsplash.com/photo-1548365328-9f547fb0953b?w=400", "desc": "Chocolate sandwich cookies."},
    {"name": "Haldiram Aloo Bhujia", "brand": "Haldiram", "category": "snacks", "sub": "Namkeen", "price": 78, "mrp": 90, "unit": "400 g", "image": "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=400", "desc": "Traditional crispy bhujia."},
    {"name": "Cadbury Dairy Milk", "brand": "Cadbury", "category": "snacks", "sub": "Chocolates", "price": 45, "mrp": 50, "unit": "55 g", "image": "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=400", "desc": "Silky smooth milk chocolate."},

    # Personal Care
    {"name": "Colgate Strong Teeth", "brand": "Colgate", "category": "personal-care", "sub": "Oral Care", "price": 95, "mrp": 115, "unit": "200 g", "image": "https://images.unsplash.com/photo-1559591935-c6c92c6a6da5?w=400", "desc": "Toothpaste with calcium."},
    {"name": "Dove Beauty Bar", "brand": "Dove", "category": "personal-care", "sub": "Bath & Body", "price": 65, "mrp": 75, "unit": "100 g", "image": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400", "desc": "Moisturizing beauty bar."},
    {"name": "Head & Shoulders Shampoo", "brand": "H&S", "category": "personal-care", "sub": "Hair Care", "price": 220, "mrp": 260, "unit": "340 ml", "image": "https://images.unsplash.com/photo-1626015449399-1b6b8e21f2c1?w=400", "desc": "Anti-dandruff shampoo."},
    {"name": "Nivea Body Lotion", "brand": "Nivea", "category": "personal-care", "sub": "Bath & Body", "price": 285, "mrp": 325, "unit": "400 ml", "image": "https://images.unsplash.com/photo-1585652757141-8837d1a9ef9c?w=400", "desc": "Nourishing body milk."},
    {"name": "Gillette Guard Razor", "brand": "Gillette", "category": "personal-care", "sub": "Shaving", "price": 55, "mrp": 65, "unit": "1 pc", "image": "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=400", "desc": "Safe & smooth shaving."},

    # Home Care
    {"name": "Surf Excel Matic Liquid", "brand": "Surf Excel", "category": "home-care", "sub": "Detergents", "price": 425, "mrp": 500, "unit": "2 L", "image": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400", "desc": "Front load liquid detergent."},
    {"name": "Vim Dishwash Bar", "brand": "Vim", "category": "home-care", "sub": "Dishwash", "price": 30, "mrp": 35, "unit": "300 g", "image": "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400", "desc": "Removes tough grease."},
    {"name": "Harpic Toilet Cleaner", "brand": "Harpic", "category": "home-care", "sub": "Cleaners", "price": 145, "mrp": 175, "unit": "1 L", "image": "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400", "desc": "Kills 99.9% germs."},
    {"name": "Lizol Floor Cleaner", "brand": "Lizol", "category": "home-care", "sub": "Cleaners", "price": 185, "mrp": 210, "unit": "975 ml", "image": "https://images.unsplash.com/photo-1583947581924-860bda6a26df?w=400", "desc": "Disinfectant floor cleaner."},
    {"name": "Good Knight Refill", "brand": "Good Knight", "category": "home-care", "sub": "Repellents", "price": 78, "mrp": 90, "unit": "45 ml", "image": "https://images.unsplash.com/photo-1631156295715-df20654a9b04?w=400", "desc": "Mosquito repellent refill."},

    # Baby Care
    {"name": "Pampers Baby Diapers M", "brand": "Pampers", "category": "baby-care", "sub": "Diapers", "price": 599, "mrp": 750, "unit": "50 pcs", "image": "https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400", "desc": "12-hour dry protection."},
    {"name": "Johnson's Baby Powder", "brand": "Johnson's", "category": "baby-care", "sub": "Baby Care", "price": 175, "mrp": 200, "unit": "400 g", "image": "https://images.unsplash.com/photo-1591379248469-3f9a5b3fa3e2?w=400", "desc": "Gentle baby powder."},
    {"name": "Cerelac Wheat Apple", "brand": "Nestle", "category": "baby-care", "sub": "Baby Food", "price": 265, "mrp": 295, "unit": "300 g", "image": "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400", "desc": "Baby cereal 6+ months."},

    # Kitchen & Dining
    {"name": "Prestige Non-Stick Tawa", "brand": "Prestige", "category": "kitchen", "sub": "Cookware", "price": 649, "mrp": 895, "unit": "26 cm", "image": "https://images.unsplash.com/photo-1584990347449-a5d9d6c5d4b7?w=400", "desc": "Non-stick roti tawa."},
    {"name": "Milton Thermosteel Flask", "brand": "Milton", "category": "kitchen", "sub": "Bottles & Flasks", "price": 799, "mrp": 1099, "unit": "1 L", "image": "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=400", "desc": "24hr hot/cold flask."},
    {"name": "Cello Lunch Box Set", "brand": "Cello", "category": "kitchen", "sub": "Lunch Boxes", "price": 349, "mrp": 499, "unit": "3 pcs", "image": "https://images.unsplash.com/photo-1584736286279-4d4e3d4a4c40?w=400", "desc": "Airtight lunch containers."},

    # Fashion
    {"name": "Men's Cotton T-Shirt", "brand": "Rams", "category": "fashion", "sub": "Men", "price": 249, "mrp": 499, "unit": "1 pc", "image": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", "desc": "100% cotton round neck."},
    {"name": "Women's Kurti", "brand": "Rams", "category": "fashion", "sub": "Women", "price": 449, "mrp": 899, "unit": "1 pc", "image": "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400", "desc": "Printed cotton kurti."},
    {"name": "Kids' Casual Shirt", "brand": "Rams", "category": "fashion", "sub": "Kids", "price": 299, "mrp": 599, "unit": "1 pc", "image": "https://images.unsplash.com/photo-1519278409-1f56fdda7fe5?w=400", "desc": "Comfortable kids shirt."},
]

BANNERS = [
    {"title": "Fresh Groceries at Best Prices", "subtitle": "Home delivery in Visakhapatnam within 60 mins", "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400", "cta": "Shop Now", "link": "/c/grocery"},
    {"title": "Farm-Fresh Fruits & Vegetables", "subtitle": "Handpicked daily, delivered fresh", "image": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1400", "cta": "Order Now", "link": "/c/fruits-vegetables"},
    {"title": "Daily Essentials, Everyday Low Prices", "subtitle": "Rams Boutique quality, home comfort", "image": "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1400", "cta": "Explore", "link": "/c/dairy"},
]
