# 🛡️ Bank Payment Verifier (PayGuard)

A Node.js web application that automatically verifies customer **bank payment receipts**. A customer uploads a screenshot of their payment receipt and selects their order. The system then reads the receipt with OCR, checks it for duplicates, compares the amount and reference number with the order, and cross-checks them against the bank SMS alerts received by the business.

[![Watch Demo Video](https://img.shields.io/badge/▶️_Watch_Demo-Google_Drive-blue?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1ewq-EJ4y9ydokKN_QJJII3D_bKeSNDHp/view?usp=drive_link)
---


## ✨ Features

- 📤 **Receipt upload**: customers upload a payment screenshot or photo (JPG/PNG).
- 🔍 **OCR text extraction**: reads receipt text using [Tesseract.js](https://github.com/naptha/tesseract.js), with no external API or key needed.
- 🔁 **Duplicate detection**: computes an MD5 hash of each image so the same receipt can't be reused for another order.
- 💰 **Amount verification**: extracts the paid amount from the receipt and compares it to the order total.
- 🔢 **Reference number cross-check**: matches the transaction reference on the receipt with incoming bank SMS records.
- 📩 **Bank SMS matching**: links receipts with the bank alerts received by the business.
- 📊 **Admin dashboard**: view all processed submissions and their verification decisions.
- 🗄️ **Zero-setup database**: uses a single-file SQLite database that is created and seeded automatically.

---

## ⚙️ How It Works

```
Customer                    Server (Express)                         Database (SQLite)
   │                              │                                          │
   │  1. Select order + upload    │                                          │
   │     receipt image ─────────► │                                          │
   │                              │  2. Save image (multer)                  │
   │                              │  3. Compute MD5 hash ──────────────────► │ duplicate?
   │                              │  4. OCR the image (Tesseract.js)         │
   │                              │  5. Parse amount + reference             │
   │                              │  6. Compare with order ────────────────► │ orders
   │                              │  7. Cross-check with bank SMS ─────────► │ bank_sms
   │                              │  8. Save decision ─────────────────────► │ submissions
   │  ◄──── Verification result ──│                                          │
```

**Verification steps in detail**

1. **Duplicate check:** an MD5 hash of the uploaded image is compared with previous submissions. If it already exists, the receipt is rejected.
2. **OCR extraction:** Tesseract.js converts the receipt image to text.
3. **Parsing:** the amount and the transaction reference are extracted from the OCR text.
4. **Order validation:** the extracted amount is compared with the selected order's expected amount.
5. **SMS cross-check:** the reference number is looked up in the stored bank SMS alerts.
6. **Decision:** the result is stored in the `submissions` table and returned to the user.

---

## 🧰 Tech Stack

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Runtime      | [Node.js](https://nodejs.org/)                                   |
| Web server   | [Express 5](https://expressjs.com/)                              |
| File uploads | [Multer](https://github.com/expressjs/multer)                    |
| OCR          | [Tesseract.js](https://github.com/naptha/tesseract.js)           |
| Database     | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) / [sqlite3](https://github.com/TryGhost/node-sqlite3) |
| Hashing      | Node.js built-in `crypto` (MD5)                                  |
| Email        | [Nodemailer](https://nodemailer.com/) <!-- CHECK: describe how email is used, or remove --> |
| Frontend     | HTML / CSS / JavaScript served from `public/`                    |

---

## 📁 Project Structure

```
Bank_Payment_Verifier/
├── public/                # Frontend files (HTML, CSS, JS) served to the browser
├── uploads/               # Uploaded receipt images (auto-created by multer)
├── database.js            # Initializes SQLite, creates tables, seeds sample data
├── server.js              # Express server + API endpoints (port 3000)
├── verifier.js            # Core logic: hashing, OCR, amount/reference verification
├── test_verifier.js       # Script to test the verification logic
├── package.json           # Project metadata and dependencies
├── package-lock.json      # Locked dependency versions
├── payguard.db            # SQLite database file (generated at runtime)
├── what_I_did_for_my_recap.txt  # Personal development notes
└── README.md              # You are here
```

### File responsibilities

| File            | Purpose |
| --------------- | ------- |
| `server.js`     | Starts the web server on port **3000**, serves the `public/` folder, and exposes the API endpoints. |
| `verifier.js`   | Duplicate detection (MD5), OCR extraction, amount and reference verification, and matching with bank SMS alerts. |
| `database.js`   | Creates the SQLite database and the 3 tables, preloads sample data if empty, and exports one shared DB connection used by both `server.js` and `verifier.js`. |
| `test_verifier.js` | Standalone script to exercise the verifier without the UI. |

---

## ✅ Prerequisites

Make sure you have the following installed:

- **Node.js** v18 or higher (v20 LTS recommended). Check with:
```bash
  node -v
```
- **npm** (comes with Node.js). Check with:
```bash
  npm -v
```
- **Git**, to clone the repository.
- **Build tools** (only if the native SQLite modules fail to install):
  - **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload) and Python
  - **macOS:** `xcode-select --install`
  - **Linux:** `sudo apt install build-essential python3`
- An **internet connection** on first run. Tesseract.js downloads its language data (`eng.traineddata`) the first time it runs.

---

## 📥 Installation

**1. Clone the repository**

```bash
git clone https://github.com/Jegathayini/Bank_Payment_Verifier.git
cd Bank_Payment_Verifier
```

**2. Install dependencies**

```bash
npm install
```

This installs Express, Multer, SQLite (`sqlite3` and `better-sqlite3`), Tesseract.js, Nodemailer and the other dependencies listed in `package.json`.

**3. (Optional) Create the uploads folder**

If the app complains that `uploads/` is missing:

```bash
mkdir uploads
```

---

## ▶️ Running the App

Start the server:

```bash
node server.js
```

You should see a message similar to:

```
Server running on http://localhost:3000
```

Open your browser and go to:

👉 **http://localhost:3000**

> 💡 **Tip:** for automatic restarts during development, use `npx nodemon server.js`.

On the first run, the app will:
- create the SQLite database file (`payguard.db`),
- create the required tables,
- insert sample orders and a sample bank SMS so you can try it immediately.

---

## 📖 How to Use

### For customers (submitting a payment)

1. Open **http://localhost:3000**.
2. **Select your pending order** from the dropdown.
3. **Upload your payment receipt**, a clear screenshot or photo of the bank transfer confirmation (JPG/PNG).
4. Click **Verify** / **Submit**.
5. Wait a few seconds while the receipt is scanned.
6. View the result: **verified**, **rejected**, or **needs review**, with the reason.

### For the business owner / admin

- Open the **submissions** section of the dashboard to see all processed payments with their extracted amount, image hash, OCR text and decision.
- View the **bank SMS** list to see the bank alerts the system has received.
- View **pending orders** awaiting payment.

### Tips for best OCR results

- Use a **clear, well-lit, uncropped** screenshot.
- Prefer **screenshots** over photos of a screen.
- Make sure the **amount** and **reference number** are fully visible.
- Avoid blurry, rotated or heavily compressed images.

---

## 🔌 API Reference

Base URL: `http://localhost:3000`

### `POST /api/verify`

Upload a receipt image and verify it against an order.

- **Content-Type:** `multipart/form-data`

| Field     | Type   | Required | Description                          |
| --------- | ------ | -------- | ------------------------------------ |
| `receipt` | File   | ✅       | Receipt image (JPG/PNG) <!-- CHECK: confirm field name in server.js --> |
| `orderId` | Number | ✅       | ID of the order being paid <!-- CHECK: confirm field name --> |

**Example (cURL):**

```bash
curl -X POST http://localhost:3000/api/verify \
  -F "receipt=@/path/to/receipt.png" \
  -F "orderId=1"
```

**Example response:** <!-- CHECK: adjust to your real response shape -->

```json
{
  "success": true,
  "decision": "VERIFIED",
  "extractedAmount": 5000,
  "reference": "TXN123456",
  "message": "Payment verified successfully."
}
```

---

### `GET /api/orders`

Returns pending orders (used to fill the dropdown).

```bash
curl http://localhost:3000/api/orders
```

---

### `GET /api/submissions`

Returns all processed payment submissions for the admin dashboard.

```bash
curl http://localhost:3000/api/submissions
```

---

### `GET /api/bank-sms`

Returns all received bank SMS records.

```bash
curl http://localhost:3000/api/bank-sms
```

---

## 🗄️ Database Schema

The app uses **SQLite** (single file: `payguard.db`) with three tables. <!-- CHECK: column names below are illustrative; match them to database.js -->

### `orders`
Stores order details.

| Column   | Type    | Description             |
| -------- | ------- | ----------------------- |
| `id`     | INTEGER | Primary key             |
| `customer` | TEXT  | Customer name           |
| `amount` | REAL    | Expected payment amount |
| `status` | TEXT    | e.g. `pending`, `paid`  |

### `bank_sms`
Stores bank alerts received by the business.

| Column      | Type    | Description                     |
| ----------- | ------- | ------------------------------- |
| `id`        | INTEGER | Primary key                     |
| `message`   | TEXT    | Raw SMS text                    |
| `amount`    | REAL    | Amount in the alert             |
| `reference` | TEXT    | Bank transaction reference      |

### `submissions`
Stores every uploaded receipt and its result.

| Column        | Type    | Description                          |
| ------------- | ------- | ------------------------------------ |
| `id`          | INTEGER | Primary key                          |
| `order_id`    | INTEGER | Related order                        |
| `image_path`  | TEXT    | Location of the uploaded image       |
| `image_hash`  | TEXT    | MD5 hash used for duplicate checks   |
| `ocr_text`    | TEXT    | Raw text extracted by OCR            |
| `parsed_amount` | REAL  | Amount parsed from the receipt       |
| `decision`    | TEXT    | Final verification decision          |

---

## 🧪 Sample Test Data

When the database is empty, `database.js` automatically inserts **sample orders** and a **sample bank SMS notification**. You can immediately:

1. Open the app,
2. Pick a sample order,
3. Upload a receipt image that shows the matching amount and reference,
4. See the verification result.

To **reset** the sample data, stop the server and delete the database files:

```bash
# macOS / Linux
rm payguard.db payguard.db-shm payguard.db-wal

# Windows (PowerShell)
Remove-Item payguard.db, payguard.db-shm, payguard.db-wal
```

Then restart the server. The database is recreated and reseeded.

---

## 🧾 Testing

Run the verifier test script:

```bash
node test_verifier.js
```

This exercises the verification logic (hashing, OCR, amount/reference matching) directly, without the web interface. <!-- CHECK: describe what test_verifier.js actually does, and which sample image it uses -->

---

## 🔧 Configuration

| Setting        | Default | Where to change            |
| -------------- | ------- | -------------------------- |
| Server port    | `3000`  | `server.js`                |
| Upload folder  | `uploads/` | `server.js` (multer config) |
| Database file  | `payguard.db` | `database.js`         |

To use a different port, edit the port value in `server.js`, or (if the code reads `process.env.PORT`) run:

```bash
# macOS / Linux
PORT=5000 node server.js

# Windows (PowerShell)
$env:PORT=5000; node server.js
```

### Email (Nodemailer)
<!-- CHECK: if email notifications are implemented, document the SMTP settings here, for example: -->
```
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
```
> Never commit real credentials. Store them in a `.env` file and add it to `.gitignore`.

---

## 🩺 Troubleshooting

| Problem | Solution |
| ------- | -------- |
| `npm install` fails on `better-sqlite3` or `sqlite3` | Install build tools (see [Prerequisites](#-prerequisites)) and use a supported Node.js LTS version. |
| `Error: Cannot find module 'express'` | Run `npm install` in the project folder. |
| `EADDRINUSE: address already in use :::3000` | Another program is using port 3000. Stop it or change the port. |
| OCR is slow on the first request | Tesseract.js downloads language data the first time. Later requests are faster. |
| OCR reads the wrong amount | Upload a sharper, higher-resolution screenshot with the amount clearly visible. |
| Receipt rejected as duplicate | This image was already submitted. Each receipt can only be used once. |
| Upload fails | Check that the `uploads/` folder exists and is writable. |
| `SQLITE_BUSY` / database locked | Only run one server instance at a time. |
| Blank page at `localhost:3000` | Confirm the `public/` folder contains `index.html`. |

---

## 🔒 Security Notes

- This project is intended for **learning and demonstration**. Review and harden it before using it in production.
- Add **authentication** to admin endpoints (`/api/submissions`, `/api/bank-sms`).
- Restrict uploads to **image types only** and set a **maximum file size** in Multer.
- MD5 is fine for duplicate detection but is **not** suitable for security purposes; use SHA-256 if you need stronger guarantees.
- OCR results can be manipulated by edited or fake screenshots. Always **confirm with real bank alerts or the bank's API** for high-value payments.
- Do **not** commit `.env` files, real customer data or real bank details.
- Consider adding `payguard.db*` and `uploads/` to `.gitignore` so private data is not pushed.

---

## 🚧 Limitations & Future Improvements

**Current limitations**

- OCR accuracy depends on image quality and receipt layout.
- Receipt formats differ between banks, so parsing rules may need adjusting for each bank.
- Bank SMS data is stored locally (sample or manually added), not received live from a bank.

**Ideas for future work**

- [ ] Live SMS / webhook / bank API integration
- [ ] Support for multiple bank receipt formats
- [ ] Image preprocessing (grayscale, thresholding) to improve OCR
- [ ] Admin login and role-based access
- [ ] Manual approve/reject for "needs review" cases
- [ ] Email notifications to customers and admins
- [ ] Docker support
- [ ] Automated tests with a test framework

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---


## 👩‍💻 Author

**Jegathayini**
GitHub: [@Jegathayini](https://github.com/Jegathayini)
