const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const app = express();
const db = new Database("store.db");
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.error("Set SESSION_SECRET and ADMIN_PASSWORD in .env before starting.");
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 2 * 60 * 60 * 1000 }
}));

db.exec(`
CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  diamonds INTEGER NOT NULL,
  price_paise INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT UNIQUE NOT NULL,
  player_uid TEXT NOT NULL,
  package_id INTEGER NOT NULL,
  package_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  payment_mode TEXT NOT NULL DEFAULT 'Demo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM packages").get().n;
if (!count) {
  const insert = db.prepare("INSERT INTO packages (name, diamonds, price_paise) VALUES (?, ?, ?)");
  [["100 Diamonds",100,8000],["310 Diamonds",310,24000],["520 Diamonds",520,40000],["1060 Diamonds",1060,80000]]
    .forEach(p => insert.run(...p));
}

const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: "Admin login required" });
}
function makeCode() {
  return "GTU-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
}

app.get("/api/packages", (req, res) => {
  res.json(db.prepare("SELECT id,name,diamonds,price_paise FROM packages WHERE active=1 ORDER BY diamonds").all());
});

app.post("/api/orders", (req, res) => {
  const uid = String(req.body.uid || "").trim();
  const packageId = Number(req.body.packageId);
  if (!/^[0-9]{6,15}$/.test(uid)) return res.status(400).json({ error: "Enter a valid Player UID (6–15 digits)." });
  const pkg = db.prepare("SELECT * FROM packages WHERE id=? AND active=1").get(packageId);
  if (!pkg) return res.status(400).json({ error: "Please select an available package." });
  const code = makeCode();
  db.prepare(`INSERT INTO orders (order_code,player_uid,package_id,package_name,amount_paise)
              VALUES (?,?,?,?,?)`).run(code, uid, pkg.id, pkg.name, pkg.price_paise);
  res.status(201).json({
    orderCode: code,
    message: "Demo order created. No payment was taken and no diamonds were delivered."
  });
});

app.post("/api/admin/login", loginLimiter, (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");
  if (username !== adminUser || !bcrypt.compareSync(password, adminHash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.admin = true;
  res.json({ ok: true });
});
app.post("/api/admin/logout", requireAdmin, (req,res) => req.session.destroy(() => res.json({ok:true})));
app.get("/api/admin/orders", requireAdmin, (req,res) => {
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all());
});
app.patch("/api/admin/orders/:id", requireAdmin, (req,res) => {
  const allowed = ["Pending","Reviewing","Completed","Cancelled"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) return res.status(400).json({error:"Invalid status"});
  const result = db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, Number(req.params.id));
  if (!result.changes) return res.status(404).json({error:"Order not found"});
  res.json({ok:true});
});
app.post("/api/admin/packages", requireAdmin, (req,res) => {
  const name = String(req.body.name || "").trim();
  const diamonds = Number(req.body.diamonds);
  const price = Number(req.body.priceRupees);
  if (!name || name.length > 60 || !Number.isInteger(diamonds) || diamonds < 1 ||
      !Number.isFinite(price) || price < 1 || price > 100000) {
    return res.status(400).json({error:"Enter a valid package name, diamond count and price."});
  }
  const info = db.prepare("INSERT INTO packages (name,diamonds,price_paise) VALUES (?,?,?)")
    .run(name, diamonds, Math.round(price * 100));
  res.status(201).json({id:info.lastInsertRowid});
});
app.get("/api/admin/packages", requireAdmin, (req,res) => {
  res.json(db.prepare("SELECT * FROM packages ORDER BY diamonds").all());
});
app.patch("/api/admin/packages/:id", requireAdmin, (req,res) => {
  const active = req.body.active ? 1 : 0;
  const result = db.prepare("UPDATE packages SET active=? WHERE id=?").run(active, Number(req.params.id));
  if (!result.changes) return res.status(404).json({error:"Package not found"});
  res.json({ok:true});
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT, () => console.log(`Store running at http://localhost:${PORT}`));
