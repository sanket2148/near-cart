This is one of the hardest parts of building a marketplace. Companies like Zomato, Swiggy, Amazon, and Flipkart all spend significant effort on merchant verification because fake stores can destroy customer trust.

A good approach is to have **multiple levels of verification** rather than relying on just one.

## Level 1: Mobile & Email Verification (Mandatory)

Every merchant should verify:

* Mobile number (OTP)
* Email address (verification link)

This prevents fake accounts but does **not** verify the business.

---

## Level 2: Business Identity Verification

Ask for different documents depending on the merchant type.

For example:

| Business Type | Documents                                                        |
| ------------- | ---------------------------------------------------------------- |
| Restaurant    | FSSAI License, GST (optional for small businesses), Shop License |
| Pharmacy      | Drug License, Pharmacist Registration                            |
| Grocery       | GST or Shop Establishment Certificate                            |
| Retail Shop   | GST or Trade License                                             |
| Salon         | Trade License                                                    |
| Electronics   | GST + Shop License                                               |

For very small businesses without GST, allow alternatives like:

* Shop & Establishment Certificate
* Municipal Trade License
* UDYAM Registration
* Local business registration

---

## Level 3: PAN / Aadhaar Verification

Verify the owner.

Collect:

* PAN
* Aadhaar (or equivalent KYC depending on country)

Match:

```
Business Owner Name
↓

PAN Name
↓

Bank Account Name
```

If everything matches, confidence increases.

---

## Level 4: Bank Verification

The merchant should receive payments.

Verify:

* Bank Account
* IFSC
* Penny Drop verification

Example:

Send ₹1

Check Account Holder Name

Match with KYC

Many payment providers support this.

---

## Level 5: GPS Verification

Merchant installs the app.

Capture:

* GPS coordinates
* Shop photos
* Front entrance
* Interior
* Shop board

Example:

```
Store Name

↓

Take Photo

↓

GPS

↓

Timestamp

↓

Upload
```

This proves the shop physically exists.

---

## Level 6: AI Verification

AI can detect obvious fraud.

Check whether:

* Shop board matches entered name
* GPS matches address
* Images are not copied from the internet
* Same photos aren't reused across multiple registrations
* Metadata and image similarity indicate suspicious uploads

---

## Level 7: Manual Review

Some registrations should go into a review queue.

Examples:

* Blurry documents
* Edited photos
* Name mismatch
* Duplicate GST
* Same phone used for multiple shops
* High-risk categories (pharmacies, jewelry, etc.)

A human approves these cases.

---

## Level 8: Customer Verification (After Launch)

Once customers start ordering:

Track:

* Successful deliveries
* Ratings
* Complaints
* Refund rate
* Cancellation rate

Good merchants gradually gain trust.

---

## Verification Badge Levels

Instead of just "Verified", use tiers.

🟢 **Basic**

* Email
* Phone

🟡 **Verified**

* Documents verified
* Bank verified

🔵 **Premium**

* Physical verification completed
* Good customer ratings
* No major complaints

⭐ **Trusted**

* Long operating history
* High order volume
* Excellent service metrics

Customers immediately understand how much they can trust a merchant.

---

## For Pharmacies

This category should have stricter verification.

Require:

* Drug License
* Pharmacist details
* Prescription compliance where required
* Periodic license validity checks

---

## For Restaurants

Require:

* FSSAI License
* Menu verification
* Kitchen or storefront photos

---

## For Home Businesses

Many small sellers operate from home.

Allow registration with:

* Aadhaar/PAN
* Bank account
* Live GPS
* Selfie with products
* Home-based business declaration

Label these appropriately (for example, "Home Business") so customers know what to expect.

---

## Fraud Detection Rules

Automatically flag merchants if:

* One GST is used by multiple accounts.
* One bank account is linked to many unrelated businesses.
* The same shop photos appear in multiple registrations.
* GPS location changes frequently.
* An unusually high number of refund requests occur.
* Multiple merchants share the same device fingerprint or IP in suspicious patterns.

---

## Recommended End-to-End Flow

```
Register

↓

OTP Verification

↓

Select Business Type

↓

Upload Required Documents

↓

PAN Verification

↓

Bank Verification

↓

GPS + Shop Photos

↓

AI Fraud Checks

↓

Manual Review (if needed)

↓

Merchant Approved

↓

Verification Badge Issued
```

For a multi-category marketplace (restaurants, retail, pharmacies, services, and more), I'd also recommend a **risk-based verification model**. A grocery store and a pharmacy shouldn't go through the exact same process. Low-risk businesses can be approved quickly after automated checks, while regulated or high-risk categories require additional documents and possibly manual review. This keeps onboarding fast for most merchants while maintaining trust and regulatory compliance where it matters most.
