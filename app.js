/* Simple Inventory — Buy & Sell with price typed each time. Works offline. */
(function () {
  'use strict';
  var KEY = 'simple_inventory_v1';
  var state = load();
  var tab = 'items', query = '';

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.items)) {
        s.history = s.history || []; s.spent = num(s.spent); s.earned = num(s.earned);
        return s;
      }
    } catch (e) { /* ignore */ }
    return { items: [], history: [], spent: 0, earned: 0 };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save (storage blocked or full)'); }
  }
  var $ = function (s) { return document.querySelector(s); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function money(n) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(m) {
    var t = $('#toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function find(id) { return state.items.filter(function (i) { return i.id === id; })[0]; }
  function status(i) { return i.qty <= 0 ? 'out' : (i.alert > 0 && i.qty <= i.alert ? 'low' : 'ok'); }

  function log(i, type, change, price, note) {
    var total = (type === 'buy' || type === 'sell') ? Math.abs(change) * price : 0;
    state.history.unshift({ name: i.name, type: type, change: change, price: price, total: total, balance: i.qty, note: note || '', date: new Date().toISOString() });
    state.history = state.history.slice(0, 500);
  }

  /* Buy = stock goes up, Sell = stock goes down. Price is typed each time. */
  function trade(id, type, qty, price) {
    var i = find(id); if (!i) return 'Item not found';
    if (!(qty > 0)) return 'Enter how many';
    if (type === 'sell' && qty > i.qty) return 'Not enough stock. You only have ' + i.qty;
    i.qty = type === 'buy' ? i.qty + qty : i.qty - qty;
    if (price > 0) { if (type === 'buy') i.lastBuy = price; else i.lastSell = price; }
    if (type === 'buy') state.spent += qty * price; else state.earned += qty * price;
    log(i, type, type === 'buy' ? qty : -qty, price);
    save();
    return null;
  }
  function fixQty(id, newQty) {
    var i = find(id); if (!i || newQty === i.qty) return;
    var diff = newQty - i.qty; i.qty = newQty;
    log(i, 'fix', diff, 0, 'Corrected stock'); save();
  }

  /* ---------- drawing ---------- */
  function render() {
    var low = 0;
    state.items.forEach(function (i) { if (status(i) !== 'ok') low++; });
    $('#summary').innerHTML =
      '<div><b>' + state.items.length + '</b><small>Items</small></div>' +
      '<div class="' + (low ? 'alert' : '') + '"><b>' + low + '</b><small>Need restock</small></div>' +
      '<div><b>' + money(state.spent) + '</b><small>Spent (buy)</small></div>' +
      '<div><b>' + money(state.earned) + '</b><small>Earned (sell)</small></div>';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
    $('.bar').style.display = tab === 'items' ? 'flex' : 'none';
    $('#list').innerHTML = tab === 'items' ? itemsHtml() : historyHtml();
  }

  function itemsHtml() {
    if (!state.items.length) return '<div class="empty">No items yet.<br><br><button class="btn primary" data-act="add">＋ Add your first item</button></div>';
    var q = query.toLowerCase();
    var list = state.items.filter(function (i) { return !q || i.name.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!list.length) return '<div class="empty">Nothing found.</div>';
    return list.map(function (i) {
      var s = status(i);
      return '<div class="item ' + (s === 'ok' ? '' : s) + '" data-id="' + i.id + '">' +
        '<div class="info"><b>' + esc(i.name) + (s === 'low' ? '<span class="tag low">Low</span>' : s === 'out' ? '<span class="tag out">Out</span>' : '') + '</b>' +
        '<small>In stock: <strong>' + i.qty + '</strong></small></div>' +
        '<div class="acts"><button class="btn buy" data-act="buy">Buy</button>' +
        '<button class="btn sell" data-act="sell">Sell</button>' +
        '<button class="edit" data-act="edit" aria-label="Edit">✏️</button></div></div>';
    }).join('');
  }

  function historyHtml() {
    if (!state.history.length) return '<div class="empty">No buying or selling yet.</div>';
    return state.history.slice(0, 150).map(function (h) {
      var d = new Date(h.date), label, cls;
      if (h.type === 'buy') { label = 'Bought'; cls = 'plus'; }
      else if (h.type === 'sell') { label = 'Sold'; cls = 'minus'; }
      else { label = 'Corrected'; cls = h.change > 0 ? 'plus' : 'minus'; }
      var detail = (h.type === 'buy' || h.type === 'sell')
        ? Math.abs(h.change) + ' × ' + money(h.price) + ' = <b>' + money(h.total) + '</b>' : (h.note || '');
      return '<div class="hrow"><span><b>' + esc(h.name) + '</b><br><small>' + d.toLocaleDateString() + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</small></span>' +
        '<span style="text-align:right"><span class="' + cls + '">' + label + ' ' + (h.change > 0 ? '+' : '') + h.change + '</span><br><small>' + detail + '</small></span></div>';
    }).join('');
  }

  /* ---------- forms ---------- */
  function openTrade(id, type) {
    var i = find(id), buying = type === 'buy';
    var last = buying ? i.lastBuy : i.lastSell;
    $('#modalRoot').innerHTML = '<div class="modal-bg"><form class="modal"><h2>' + (buying ? '🛒 Buy' : '💰 Sell') + ': ' + esc(i.name) + '</h2>' +
      '<p class="hint">In stock now: <b>' + i.qty + '</b></p>' +
      '<label>How many?</label><input name="qty" type="number" min="0" step="any" value="1" required>' +
      '<label>Price each (type today\'s price)</label><input name="price" type="number" min="0" step="any" placeholder="e.g. 100" value="' + (last ? esc(last) : '') + '">' +
      '<div class="total" id="total"></div>' +
      '<div class="foot"><div class="right"><button type="button" class="btn" data-act="close">Cancel</button>' +
      '<button class="btn ' + (buying ? 'buy-solid' : 'sell-solid') + '">' + (buying ? 'Save purchase' : 'Save sale') + '</button></div></div></form></div>';
    var f = $('#modalRoot form');
    var upd = function () { $('#total').textContent = 'Total: ' + money(num(f.elements.qty.value) * num(f.elements.price.value)); };
    f.elements.qty.addEventListener('input', upd); f.elements.price.addEventListener('input', upd); upd();
    (last ? f.elements.qty : f.elements.price).focus();
    f.elements.qty.select && f.elements.qty.select();
    f.onsubmit = function (e) {
      e.preventDefault();
      var err = trade(id, type, num(f.elements.qty.value), num(f.elements.price.value));
      if (err) { toast(err); return; }
      closeModal(); toast(buying ? 'Purchase saved' : 'Sale saved'); render();
    };
  }

  function openForm(id) {
    var i = id ? find(id) : { name: '', qty: 0, alert: 5 };
    $('#modalRoot').innerHTML = '<div class="modal-bg"><form class="modal" data-id="' + (id || '') + '"><h2>' + (id ? 'Edit item' : 'Add item') + '</h2>' +
      '<label>Item name</label><input name="name" required value="' + esc(i.name) + '">' +
      '<label>' + (id ? 'Quantity in stock (fix a mistake)' : 'Quantity you have now') + '</label><input name="qty" type="number" min="0" step="any" value="' + esc(i.qty) + '">' +
      '<label>Warn me when stock is at or below</label><input name="alert" type="number" min="0" step="any" value="' + esc(i.alert) + '">' +
      '<div class="foot">' + (id ? '<button type="button" class="btn red" data-act="delete">Delete</button>' : '') +
      '<div class="right"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">Save</button></div></div></form></div>';
    var f = $('#modalRoot form'); f.elements.name.focus();
    f.onsubmit = function (e) {
      e.preventDefault();
      var name = f.elements.name.value.trim(); if (!name) return;
      var qty = Math.max(0, num(f.elements.qty.value)), alertLvl = num(f.elements.alert.value);
      if (id) { i.name = name; i.alert = alertLvl; fixQty(id, qty); save(); }
      else { state.items.push({ id: uid(), name: name, qty: qty, alert: alertLvl }); save(); }
      closeModal(); toast('Saved'); render();
    };
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  /* ---------- files ---------- */
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function cell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(v) && isNaN(Number(v))) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csv(rows) { return rows.map(function (r) { return r.map(cell).join(','); }).join('\r\n'); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function menuAction(act) {
    $('#dropdown').classList.remove('open');
    if (act === 'export') {
      download('items-' + today() + '.csv', csv([['Item', 'In stock', 'Warn level']].concat(state.items.map(function (i) { return [i.name, i.qty, i.alert]; }))), 'text/csv');
    } else if (act === 'exporth') {
      download('buy-sell-history-' + today() + '.csv', csv([['Date', 'Item', 'Type', 'Quantity', 'Price each', 'Total', 'Stock after']].concat(
        state.history.map(function (h) { return [h.date, h.name, h.type === 'buy' ? 'Buy' : h.type === 'sell' ? 'Sell' : 'Correction', Math.abs(h.change), h.price, h.total, h.balance]; }))), 'text/csv');
    } else if (act === 'backup') {
      download('inventory-backup-' + today() + '.json', JSON.stringify(state), 'application/json'); toast('Backup saved');
    } else if (act === 'restore') {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = function () {
        var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result);
            if (!Array.isArray(d.items)) throw 0;
            if (!confirm('Replace your current data with this backup?')) return;
            state = { items: d.items, history: d.history || [], spent: num(d.spent), earned: num(d.earned) }; save(); render(); toast('Backup restored');
          } catch (e) { toast('That is not a valid backup file'); }
        };
        if (inp.files[0]) r.readAsText(inp.files[0]);
      };
      inp.click();
    } else if (act === 'clear') {
      if (confirm('Delete ALL items and history? This cannot be undone.')) {
        state = { items: [], history: [], spent: 0, earned: 0 }; save(); render(); toast('Everything deleted');
      }
    }
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-tab]');
    if (!e.target.closest('.menu')) $('#dropdown').classList.remove('open');
    if (e.target.classList.contains('modal-bg')) { closeModal(); return; }
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
    var act = t.dataset.act, row = t.closest('.item'), id = row && row.dataset.id;
    if (act === 'add') openForm();
    else if (act === 'edit') openForm(id);
    else if (act === 'buy' || act === 'sell') openTrade(id, act);
    else if (act === 'close') closeModal();
    else if (act === 'delete') {
      var fid = $('#modalRoot form').dataset.id, it = find(fid);
      if (it && confirm('Delete "' + it.name + '"?')) {
        state.items = state.items.filter(function (x) { return x.id !== fid; }); save();
        closeModal(); render(); toast('Deleted');
      }
    }
    else if (['export', 'exporth', 'backup', 'restore', 'clear'].indexOf(act) >= 0) menuAction(act);
  });
  $('#addBtn').addEventListener('click', function () { openForm(); });
  $('#menuBtn').addEventListener('click', function (e) { e.stopPropagation(); $('#dropdown').classList.toggle('open'); });
  $('#search').addEventListener('input', function (e) { query = e.target.value; $('#list').innerHTML = itemsHtml(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  }
  render();
})();
