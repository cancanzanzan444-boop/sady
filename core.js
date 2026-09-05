/* SPEED SHOP — طبقة بيانات مشتركة بين كل صفحات الموقع
   تُستخدم في كل صفحة عبر: <script src="core.js"></script>
   كل البيانات هنا حقيقية ومحفوظة في متصفح الزائر (localStorage) — لا توجد بيانات تجريبية. */
(function (global) {
  "use strict";

  var LS = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  var K = {
    products: 'speedShopProducts',
    categories: 'speedShopCategories',
    offers: 'speedShopOffers',
    contact: 'speedShopContact',
    orders: 'speedShopOrders',
    user: 'speedShopUser',
    cart: 'speedShopCart',
    wishlist: 'speedShopWishlist',
    saved: 'speedShopSavedForLater'
  };

  /* ---------- تطبيع النص العربي لأجل بحث دقيق (يتجاهل التشكيل واختلاف الحروف المتشابهة) ---------- */
  function normalizeArabic(s) {
    if (!s) return '';
    return s.toString()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* ---------- المنتجات (يضيفها المسؤول من admin.html، وتظهر لكل الزوار على هذا المتصفح) ---------- */
  function getProducts() { return LS.get(K.products, []); }
  function saveProducts(list) { return LS.set(K.products, list); }
  function getProductById(id) {
    id = String(id);
    var list = getProducts();
    for (var i = 0; i < list.length; i++) { if (String(list[i].id) === id) return list[i]; }
    return null;
  }
  function getCategories() { return LS.get(K.categories, []); }
  function getOffers() { return LS.get(K.offers, []); }
  function getContact() { return LS.get(K.contact, { phone: '', whatsapp: '', email: '', hours: '', address: '' }); }

  /* ---------- البحث: يبحث داخل المنتجات التي أضافها المسؤول فعليًا، بأقرب تطابق للكلمة ---------- */
  function searchProducts(query) {
    var q = normalizeArabic(query);
    if (!q) return [];
    var terms = q.split(' ').filter(Boolean);
    var list = getProducts();
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var hay = normalizeArabic([p.name, p.category, p.desc].filter(Boolean).join(' '));
      var score = 0;
      if (hay.indexOf(q) !== -1) score += 10;
      for (var t = 0; t < terms.length; t++) {
        if (terms[t] && hay.indexOf(terms[t]) !== -1) score += 2;
      }
      if (score > 0) scored.push({ p: p, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.p; });
  }

  /* ---------- المستخدم/الحساب ---------- */
  function getUser() { return LS.get(K.user, null); }
  function isLoggedIn() { return !!getUser(); }
  function registerUser(user) {
    // user: {name, phone, city, address}
    var record = {
      name: (user.name || '').trim(),
      phone: (user.phone || '').trim(),
      city: (user.city || 'غزة').trim(),
      address: (user.address || '').trim(),
      createdAt: new Date().toISOString()
    };
    LS.set(K.user, record);
    return record;
  }
  function updateUser(patch) {
    var u = getUser() || {};
    var merged = Object.assign({}, u, patch);
    LS.set(K.user, merged);
    return merged;
  }
  function logoutUser() { LS.remove(K.user); }

  /* ---------- السلة والمفضلة (خاصة بهذا المتصفح) ---------- */
  function getCart() { return LS.get(K.cart, []); }
  function setCart(items) { LS.set(K.cart, items); updateBadges(); }
  function addToCart(productId, qty) {
    qty = qty || 1;
    var cart = getCart();
    var found = null;
    for (var i = 0; i < cart.length; i++) { if (String(cart[i].id) === String(productId)) { found = cart[i]; break; } }
    if (found) { found.qty += qty; } else { cart.push({ id: productId, qty: qty }); }
    setCart(cart);
    return cart;
  }
  function removeFromCart(productId) {
    var cart = getCart().filter(function (c) { return String(c.id) !== String(productId); });
    setCart(cart);
    return cart;
  }
  function cartCount() {
    return getCart().reduce(function (n, c) { return n + (c.qty || 1); }, 0);
  }

  function getWishlist() { return LS.get(K.wishlist, []); }
  function setWishlist(ids) { LS.set(K.wishlist, ids); updateBadges(); }
  function toggleWishlist(productId) {
    var w = getWishlist();
    var idx = w.indexOf(productId);
    if (idx === -1) { w.push(productId); } else { w.splice(idx, 1); }
    setWishlist(w);
    return w.indexOf(productId) !== -1;
  }
  function isWishlisted(productId) {
    return getWishlist().map(String).indexOf(String(productId)) !== -1;
  }

  /* ---------- محفوظ لوقت لاحق (نقل من السلة) ---------- */
  function getSaved() { return LS.get(K.saved, []); }
  function setSaved(ids) { LS.set(K.saved, ids); }
  function moveCartItemToSaved(productId) {
    var cart = getCart().filter(function (c) { return String(c.id) !== String(productId); });
    setCart(cart);
    var saved = getSaved();
    if (saved.map(String).indexOf(String(productId)) === -1) saved.push(productId);
    setSaved(saved);
  }
  function restoreSavedItem(productId) {
    var saved = getSaved().filter(function (id) { return String(id) !== String(productId); });
    setSaved(saved);
    addToCart(productId, 1);
  }

  /* ---------- الطلبات (يُنشئها checkout.html، يراها المسؤول في admin.html، ويراها صاحبها في my-orders.html) ---------- */
  function getAllOrders() { return LS.get(K.orders, []); }
  function saveAllOrders(list) { LS.set(K.orders, list); }
  function createOrder(order) {
    var list = getAllOrders();
    var id = 1000 + list.length + 1;
    var record = Object.assign({
      id: id,
      status: 'new',
      date: new Date().toISOString()
    }, order);
    list.push(record);
    saveAllOrders(list);
    setCart([]);
    return record;
  }
  function getMyOrders() {
    var u = getUser();
    if (!u || !u.phone) return [];
    return getAllOrders().filter(function (o) { return o.phone === u.phone; });
  }

  /* ---------- شارات السلة/المفضلة في الهيدر والتنقل السفلي ---------- */
  function updateBadges() {
    var cartN = cartCount();
    var wishN = getWishlist().length;
    document.querySelectorAll('[data-cart-badge]').forEach(function (el) {
      el.textContent = cartN;
      el.style.display = cartN > 0 ? '' : 'none';
    });
    document.querySelectorAll('[data-wish-badge]').forEach(function (el) {
      el.textContent = wishN;
      el.style.display = wishN > 0 ? '' : 'none';
    });
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- ضغط صور المنتجات قبل حفظها (المتصفح يخزّن محليًا فقط، فنقلّل حجم الصورة) ---------- */
  function fileToCompressedDataURL(file, opts) {
    opts = opts || {};
    var maxSize = opts.maxSize || 800;
    var quality = opts.quality || 0.75;
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('لم يتم اختيار أي ملف')); return; }

      var type = (file.type || '').toLowerCase();
      var name = (file.name || '').toLowerCase();
      var looksLikeImage = type.indexOf('image/') === 0 ||
        (!type && /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(name));

      if (!looksLikeImage) {
        reject(new Error('الملف المختار ليس صورة مدعومة'));
        return;
      }
      if (type.indexOf('heic') !== -1 || type.indexOf('heif') !== -1 || /\.heic$|\.heif$/i.test(name)) {
        reject(new Error('صيغة HEIC غير مدعومة في المتصفح — يرجى اختيار صورة بصيغة JPG أو PNG'));
        return;
      }

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('تعذّرت قراءة ملف الصورة من الجهاز')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('تعذّر فتح هذه الصورة في المتصفح، جرّب صورة JPG أو PNG')); };
        img.onload = function () {
          try {
            var w = img.width, h = img.height;
            if (!w || !h) { reject(new Error('تعذّرت قراءة أبعاد الصورة')); return; }
            if (w > h && w > maxSize) { h = Math.round(h * (maxSize / w)); w = maxSize; }
            else if (h > maxSize) { w = Math.round(w * (maxSize / h)); h = maxSize; }
            var canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (e) {
            reject(new Error('تعذّرت معالجة الصورة: ' + e.message));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  document.addEventListener('DOMContentLoaded', updateBadges);

  global.SS = {
    LS: LS, K: K,
    normalizeArabic: normalizeArabic, escapeHTML: escapeHTML, fileToCompressedDataURL: fileToCompressedDataURL,
    getProducts: getProducts, saveProducts: saveProducts, getProductById: getProductById,
    getCategories: getCategories, getOffers: getOffers, getContact: getContact,
    searchProducts: searchProducts,
    getUser: getUser, isLoggedIn: isLoggedIn, registerUser: registerUser, updateUser: updateUser, logoutUser: logoutUser,
    getCart: getCart, setCart: setCart, addToCart: addToCart, removeFromCart: removeFromCart, cartCount: cartCount,
    getWishlist: getWishlist, setWishlist: setWishlist, toggleWishlist: toggleWishlist, isWishlisted: isWishlisted,
    getSaved: getSaved, setSaved: setSaved, moveCartItemToSaved: moveCartItemToSaved, restoreSavedItem: restoreSavedItem,
    getAllOrders: getAllOrders, saveAllOrders: saveAllOrders, createOrder: createOrder, getMyOrders: getMyOrders,
    updateBadges: updateBadges
  };
})(window);
