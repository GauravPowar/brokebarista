var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-ksHAZP/functionsWorker-0.6093867954465723.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
var json = /* @__PURE__ */ __name2((data, status = 200) => Response.json(data, { status, headers: { "Access-Control-Allow-Origin": "*" } }), "json");
function normalizeCategory(cat) {
  const c = (cat || "").toLowerCase().trim();
  if (c === "beans" || c === "coffee" || c === "online") return "beans";
  if (c === "gears" || c === "gear" || c === "equipment") return "gears";
  if (c === "accessories" || c === "accessory" || c === "offline") return "accessories";
  return c;
}
__name(normalizeCategory, "normalizeCategory");
__name2(normalizeCategory, "normalizeCategory");
function makeOrderId() {
  return "LOCAL-" + Date.now();
}
__name(makeOrderId, "makeOrderId");
__name2(makeOrderId, "makeOrderId");
function getRoute(request) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/$/, "");
  if (p.endsWith("/journal")) return "journal";
  if (p.endsWith("/shelf")) return "shelf";
  const qr = url.searchParams.get("route");
  if (qr === "journal") return "journal";
  if (qr === "shelf") return "shelf";
  return "logs";
}
__name(getRoute, "getRoute");
__name2(getRoute, "getRoute");
async function onRequestGet({ request, env }) {
  try {
    const db = env.DB;
    const migrations = [
      // Tables that may not exist if app predates them
      `CREATE TABLE IF NOT EXISTS shelf_meta (
        log_id         TEXT    PRIMARY KEY,
        roast_date     TEXT,
        delivered_date TEXT,
        opened_date    TEXT,
        finished_date  TEXT,
        is_finished    INTEGER DEFAULT 0,
        rest_days      INTEGER,
        gram_entries   TEXT,
        updated_at     TEXT    DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS journal (
        id         TEXT    PRIMARY KEY,
        date       TEXT    NOT NULL,
        brewer     TEXT,
        bean_id    TEXT,
        bean_label TEXT,
        dose       REAL    DEFAULT 0,
        yield      REAL    DEFAULT 0,
        time       REAL    DEFAULT 0,
        temp       REAL    DEFAULT 0,
        grinder    TEXT,
        grind      TEXT,
        notes      TEXT,
        rating     INTEGER DEFAULT 0,
        tastes     TEXT,
        created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
      )`,
      // Columns that may not exist in older logs tables
      "ALTER TABLE logs ADD COLUMN roast_level TEXT",
      "ALTER TABLE logs ADD COLUMN process TEXT",
      "ALTER TABLE journal ADD COLUMN grinder TEXT",
      "ALTER TABLE shelf_meta ADD COLUMN rest_days INTEGER",
      "ALTER TABLE journal ADD COLUMN is_milk_based INTEGER DEFAULT 0"
    ];
    for (const m of migrations) {
      try {
        await db.prepare(m).run();
      } catch (_) {
      }
    }
    const route = getRoute(request);
    if (route === "journal") {
      const { results } = await db.prepare(
        "SELECT * FROM journal ORDER BY date DESC"
      ).all();
      return json({ journal: results || [] });
    }
    if (route === "shelf") {
      const { results } = await db.prepare(
        "SELECT * FROM shelf_meta"
      ).all();
      return json({ shelf: results || [] });
    }
    const [ordersResult, logsResult] = await Promise.all([
      db.prepare("SELECT * FROM orders ORDER BY date DESC").all(),
      db.prepare("SELECT * FROM logs ORDER BY date DESC").all()
    ]);
    const orders = ordersResult.results || [];
    const logs = logsResult.results || [];
    const orderMap = {};
    const itemCounts = {};
    orders.forEach((o) => {
      orderMap[o.order_id] = o;
    });
    logs.forEach((l) => {
      const o = orderMap[l.order_id];
      if (o && o.is_combo) itemCounts[l.order_id] = (itemCounts[l.order_id] || 0) + 1;
    });
    const enrichedLogs = logs.map((l) => {
      const o = orderMap[l.order_id];
      if (o && o.is_combo && o.combo_price > 0) {
        return { ...l, price: o.combo_price / (itemCounts[l.order_id] || 1), is_combo_item: 1 };
      }
      return { ...l, is_combo_item: 0 };
    });
    return json({ logs: enrichedLogs, orders });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost({ request, env }) {
  try {
    const db = env.DB;
    const body = await request.json();
    const migrations = [
      // Tables that may not exist if app predates them
      `CREATE TABLE IF NOT EXISTS shelf_meta (
        log_id         TEXT    PRIMARY KEY,
        roast_date     TEXT,
        delivered_date TEXT,
        opened_date    TEXT,
        finished_date  TEXT,
        is_finished    INTEGER DEFAULT 0,
        gram_entries   TEXT,
        updated_at     TEXT    DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS journal (
        id         TEXT    PRIMARY KEY,
        date       TEXT    NOT NULL,
        brewer     TEXT,
        bean_id    TEXT,
        bean_label TEXT,
        dose       REAL    DEFAULT 0,
        yield      REAL    DEFAULT 0,
        time       REAL    DEFAULT 0,
        temp       REAL    DEFAULT 0,
        grinder    TEXT,
        grind      TEXT,
        notes      TEXT,
        rating     INTEGER DEFAULT 0,
        tastes     TEXT,
        created_at TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT    DEFAULT CURRENT_TIMESTAMP
      )`,
      // Columns that may not exist in older logs tables
      "ALTER TABLE logs ADD COLUMN roast_level TEXT",
      "ALTER TABLE logs ADD COLUMN process TEXT",
      "ALTER TABLE journal ADD COLUMN grinder TEXT",
      "ALTER TABLE shelf_meta ADD COLUMN rest_days INTEGER",
      "ALTER TABLE journal ADD COLUMN is_milk_based INTEGER DEFAULT 0"
    ];
    for (const m of migrations) {
      try {
        await db.prepare(m).run();
      } catch (_) {
      }
    }
    const route = getRoute(request);
    if (route === "journal") {
      const j = body;
      await db.prepare(
        `INSERT OR REPLACE INTO journal
         (id, date, brewer, grinder, bean_id, bean_label, dose, yield, time, temp, grind, notes, rating, tastes, is_milk_based, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`
      ).bind(
        String(j.id),
        j.date || "",
        j.brewer || "",
        j.grinder || "",
        j.beanId || "",
        j.beanLabel || "",
        j.dose || 0,
        j.yield || 0,
        j.time || 0,
        j.temp || 0,
        j.grind || "",
        j.notes || "",
        j.rating || 0,
        JSON.stringify(j.tastes || []),
        j.is_milk_based ? 1 : 0
      ).run();
      return json({ ok: true });
    }
    if (route === "shelf") {
      const s = body;
      await db.prepare(
        `INSERT OR REPLACE INTO shelf_meta
         (log_id, roast_date, delivered_date, opened_date, finished_date, is_finished, rest_days, gram_entries, updated_at)
         VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`
      ).bind(
        String(s.log_id),
        s.roastDate || "",
        s.deliveredDate || "",
        s.openedDate || "",
        s.finishedDate || "",
        s.isFinished ? 1 : 0,
        s.restDays != null ? s.restDays : null,
        JSON.stringify(s.gramEntries || [])
      ).run();
      return json({ ok: true });
    }
    if (body.order && body.items) {
      const o = body.order;
      const order_id = (o.order_id || o.id || "").toString().trim() || makeOrderId();
      const is_combo = body.items.length > 1 || o.is_combo ? 1 : 0;
      let combo_price = parseFloat(o.combo_price || o.price || 0);
      if (!combo_price && is_combo)
        combo_price = body.items.reduce((s, i) => s + parseFloat(i.price || 0), 0);
      await db.prepare(
        `INSERT OR IGNORE INTO orders (order_id, date, vendor, is_combo, combo_price, notes)
         VALUES (?,?,?,?,?,?)`
      ).bind(
        order_id,
        o.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        o.vendor || "",
        is_combo,
        combo_price,
        o.notes || ""
      ).run();
      for (const item of body.items) {
        await db.prepare(
          `INSERT INTO logs
           (order_id, date, category, vendor, name, price, notes, roaster, size, coffee_type, brew_equip, qty, roast_level, process)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          order_id,
          o.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
          normalizeCategory(item.category),
          item.vendor || o.vendor || "",
          item.name || "",
          parseFloat(item.price || 0),
          item.notes || "",
          item.roaster || "",
          item.size || "",
          item.coffee_type || item.coffeeType || "",
          Array.isArray(item.brew_equip) ? item.brew_equip.join(",") : item.brew_equip || item.brewEquip || "",
          parseInt(item.qty || 1),
          item.roast_level || item.roastLevel || null,
          item.process || null
        ).run();
      }
      return json({ ok: true });
    }
    const { action } = body;
    if (action === "addOrder") {
      const { order_id, date, vendor, is_combo, combo_price, notes } = body;
      await db.prepare(
        "INSERT OR IGNORE INTO orders (order_id, date, vendor, is_combo, combo_price, notes) VALUES (?,?,?,?,?,?)"
      ).bind(order_id, date, vendor, is_combo ? 1 : 0, combo_price || 0, notes || "").run();
      return json({ ok: true });
    }
    if (action === "addLog") {
      const {
        order_id,
        date,
        category,
        vendor,
        name,
        price,
        notes,
        roaster,
        size,
        coffee_type,
        brew_equip,
        qty,
        roast_level,
        process
      } = body;
      await db.prepare(
        `INSERT INTO logs (order_id,date,category,vendor,name,price,notes,roaster,size,coffee_type,brew_equip,qty,roast_level,process)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        order_id,
        date,
        normalizeCategory(category),
        vendor,
        name,
        price || 0,
        notes || "",
        roaster || "",
        size || "",
        coffee_type || "",
        brew_equip || "",
        qty || 1,
        roast_level || null,
        process || null
      ).run();
      return json({ ok: true });
    }
    if (action === "deleteLog") {
      const { id } = body;
      await db.prepare("DELETE FROM logs WHERE id = ?").bind(id).run();
      await db.prepare(
        "DELETE FROM orders WHERE order_id NOT IN (SELECT DISTINCT order_id FROM logs)"
      ).run();
      return json({ ok: true });
    }
    if (action === "updateLog") {
      const {
        id,
        date,
        category,
        vendor,
        name,
        price,
        notes,
        roaster,
        size,
        coffee_type,
        brew_equip,
        qty,
        roast_level,
        process
      } = body;
      await db.prepare(
        `UPDATE logs SET date=?,category=?,vendor=?,name=?,price=?,notes=?,roaster=?,size=?,
         coffee_type=?,brew_equip=?,qty=?,roast_level=?,process=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(
        date,
        normalizeCategory(category),
        vendor,
        name,
        price || 0,
        notes || "",
        roaster || "",
        size || "",
        coffee_type || "",
        brew_equip || "",
        qty || 1,
        roast_level || null,
        process || null,
        id
      ).run();
      return json({ ok: true });
    }
    if (action === "updateOrder") {
      const { order_id, date, vendor, is_combo, combo_price, notes } = body;
      await db.prepare(
        "UPDATE orders SET date=?,vendor=?,is_combo=?,combo_price=?,notes=? WHERE order_id=?"
      ).bind(date, vendor, is_combo ? 1 : 0, combo_price || 0, notes || "", order_id).run();
      return json({ ok: true });
    }
    if (action === "deleteJournal") {
      await db.prepare("DELETE FROM journal WHERE id=?").bind(String(body.id)).run();
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestPut({ request, env }) {
  try {
    const db = env.DB;
    const body = await request.json();
    const route = getRoute(request);
    if (route === "journal") {
      const j = body;
      await db.prepare(
        `UPDATE journal SET date=?,brewer=?,grinder=?,bean_id=?,bean_label=?,dose=?,yield=?,time=?,temp=?,
         grind=?,notes=?,rating=?,tastes=?,is_milk_based=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(
        j.date || "",
        j.brewer || "",
        j.grinder || "",
        j.beanId || "",
        j.beanLabel || "",
        j.dose || 0,
        j.yield || 0,
        j.time || 0,
        j.temp || 0,
        j.grind || "",
        j.notes || "",
        j.rating || 0,
        JSON.stringify(j.tastes || []),
        j.is_milk_based ? 1 : 0,
        String(j.id)
      ).run();
      return json({ ok: true });
    }
    if (route === "shelf") {
      const s = body;
      await db.prepare(
        `INSERT OR REPLACE INTO shelf_meta
         (log_id, roast_date, delivered_date, opened_date, finished_date, is_finished, rest_days, gram_entries, updated_at)
         VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`
      ).bind(
        String(s.log_id),
        s.roastDate || "",
        s.deliveredDate || "",
        s.openedDate || "",
        s.finishedDate || "",
        s.isFinished ? 1 : 0,
        s.restDays != null ? s.restDays : null,
        JSON.stringify(s.gramEntries || [])
      ).run();
      return json({ ok: true });
    }
    if (body.id) {
      await db.prepare(
        `UPDATE logs SET date=?,category=?,vendor=?,name=?,price=?,notes=?,roaster=?,size=?,
         coffee_type=?,brew_equip=?,qty=?,roast_level=?,process=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).bind(
        body.date,
        normalizeCategory(body.category),
        body.vendor || "",
        body.name || "",
        parseFloat(body.price || 0),
        body.notes || "",
        body.roaster || "",
        body.size || "",
        body.coffee_type || body.coffeeType || "",
        Array.isArray(body.brew_equip) ? body.brew_equip.join(",") : body.brew_equip || body.brewEquip || "",
        parseInt(body.qty || 1),
        body.roast_level || body.roastLevel || null,
        body.process || null,
        body.id
      ).run();
      if (body.order_id) {
        await db.prepare("UPDATE orders SET date=?,vendor=? WHERE order_id=?").bind(body.date, body.vendor || "", body.order_id).run();
      }
      return json({ ok: true });
    }
    if (body.order && body.items) {
      const o = body.order;
      const items = body.items;
      const order_id = (o.order_id || o.id || "").toString().trim();
      const is_combo = items.length > 1 || o.is_combo ? 1 : 0;
      let combo_price = parseFloat(o.combo_price || o.price || 0);
      if (!combo_price && is_combo)
        combo_price = items.reduce((s, i) => s + parseFloat(i.price || 0), 0);
      await db.prepare(
        "UPDATE orders SET date=?,vendor=?,is_combo=?,combo_price=?,notes=? WHERE order_id=?"
      ).bind(o.date, o.vendor || "", is_combo, combo_price, o.notes || "", order_id).run();
      await db.prepare("DELETE FROM logs WHERE order_id=?").bind(order_id).run();
      for (const item of items) {
        await db.prepare(
          `INSERT INTO logs
           (order_id,date,category,vendor,name,price,notes,roaster,size,coffee_type,brew_equip,qty,roast_level,process)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(
          order_id,
          o.date,
          normalizeCategory(item.category),
          item.vendor || o.vendor || "",
          item.name || "",
          parseFloat(item.price || 0),
          item.notes || "",
          item.roaster || "",
          item.size || "",
          item.coffee_type || item.coffeeType || "",
          Array.isArray(item.brew_equip) ? item.brew_equip.join(",") : item.brew_equip || item.brewEquip || "",
          parseInt(item.qty || 1),
          item.roast_level || item.roastLevel || null,
          item.process || null
        ).run();
      }
      return json({ ok: true });
    }
    return json({ error: "Invalid PUT body" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
__name(onRequestPut, "onRequestPut");
__name2(onRequestPut, "onRequestPut");
async function onRequestDelete({ request, env }) {
  try {
    const db = env.DB;
    const body = await request.json();
    const route = getRoute(request);
    if (route === "journal") {
      await db.prepare("DELETE FROM journal WHERE id=?").bind(String(body.id)).run();
      return json({ ok: true });
    }
    if (route === "shelf") {
      await db.prepare("DELETE FROM shelf_meta WHERE log_id=?").bind(String(body.log_id)).run();
      return json({ ok: true });
    }
    const { id, order_id } = body;
    if (id) await db.prepare("DELETE FROM logs WHERE id=?").bind(id).run();
    if (order_id) {
      await db.prepare("DELETE FROM logs WHERE order_id=?").bind(order_id).run();
      await db.prepare("DELETE FROM orders WHERE order_id=?").bind(order_id).run();
    }
    await db.prepare(
      "DELETE FROM orders WHERE order_id NOT IN (SELECT DISTINCT order_id FROM logs)"
    ).run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}
__name(onRequestOptions, "onRequestOptions");
__name2(onRequestOptions, "onRequestOptions");
var routes = [
  {
    routePath: "/api/logs",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/logs",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/logs",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/logs",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/logs",
    mountPath: "/api",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// C:/Users/powar/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// C:/Users/powar/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-F1xZl9/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// C:/Users/powar/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-F1xZl9/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.6093867954465723.js.map
