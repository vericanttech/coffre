# TrouveDoc – Cost estimate (power users)

Rough monthly cost for **power users** on Firebase (Blaze) + Vertex AI. Prices are USD and can vary by region.

---

## Power user profile

| Metric | Assumption |
|--------|------------|
| Documents per month | **150** (mix of photos + PDFs) |
| Share of images (Vision OCR) | **70%** → 105 images/month |
| Share of PDFs (pdf-parse, no Vision) | **30%** → 45 PDFs/month |
| Avg prompt size (redacted OCR) | **~3,000 characters** |
| Avg Gemini response | **~500 characters** |
| Avg file size stored | **0.5 MB** per document |

---

## Cost per document (pipeline)

| Service | What we use | Unit cost (approx) | Per doc |
|---------|-------------|--------------------|--------|
| **Vertex AI (Gemini 1.5 Flash)** | Text in/out (characters) | Input: $0.00001875/1k chars, Output: $0.000075/1k chars | ~$0.0001 |
| **Cloud Vision** | Document Text Detection (images only) | 1,000 free/month, then $1.50/1,000 images | $0.0015 (if past free tier) |
| **Cloud Functions** | 1 call per doc (`processVaultDocument`) | 2M invocations free, then $0.40/1M | ~$0 (within free tier) |
| **Firestore** | 1 create + 1 update per doc | 20k writes/day free, then $0.09/100k | ~$0 (within free tier) |
| **Cloud Storage** | Original file + thumb (optional) | ~$0.02/GB/month | ~$0.00001 |

**Rough total per document:** **~$0.0002** (dominated by Vertex AI at this volume; Vision matters once past 1,000 images/month).

---

## Monthly cost by number of power users

Assuming **150 docs/user/month** (105 images, 45 PDFs per user).

| Power users | Docs/month | Images (Vision) | Vertex AI (approx) | Vision (approx) | Functions | Firestore | Storage | **Total (approx)** |
|-------------|------------|------------------|---------------------|-----------------|-----------|-----------|---------|---------------------|
| 1 | 150 | 105 | &lt;$0.01 | $0 (under 1k) | $0 | $0 | &lt;$0.01 | **&lt;$1** |
| 10 | 1,500 | 1,050 | ~$0.15 | $0.08* | $0 | $0 | ~$0.15 | **~$0.50** |
| 50 | 7,500 | 5,250 | ~$0.75 | ~$6.40 | $0 | ~$0.01 | ~$0.75 | **~$8** |
| 100 | 15,000 | 10,500 | ~$1.50 | ~$14.25 | ~$0.01 | ~$0.03 | ~$1.50 | **~$17** |
| 500 | 75,000 | 52,500 | ~$7.50 | ~$77 | ~$0.03 | ~$0.14 | ~$7.50 | **~$92** |
| 1,000 | 150,000 | 105,000 | ~$15 | ~$156 | ~$0.06 | ~$0.27 | ~$15 | **~$186** |

\* First 1,000 images/month free; then $1.50/1,000.

- **Vertex AI:** scales linearly with docs; very low per doc for 1.5 Flash.
- **Vision:** main cost once &gt;1k images/month; tier drops after 5M images ($0.60/1,000).
- **Functions / Firestore / Storage:** stay small until very high doc counts.

---

## Heavier power users (300 docs/month)

| Power users | Docs/month | Images | **Total (approx)** |
|-------------|------------|--------|---------------------|
| 10 | 3,000 | 2,100 | ~$3 |
| 50 | 15,000 | 10,500 | ~$25 |
| 100 | 30,000 | 21,000 | ~$50 |

---

## Summary

- **Single power user (150 docs/month):** well under **$1/month** (mostly free tier).
- **Tens of power users:** **~$1–10/month**; Vision starts to show once total images &gt; 1,000/month.
- **Hundreds of power users:** **~$50–200/month**; Vision dominates; Vertex AI and the rest stay relatively low.

**Main levers:**  
1. **Cloud Vision** – largest cost at scale; consider Document AI or caching if you reprocess the same files.  
2. **Vertex AI** – cheap per doc with 1.5 Flash; switching to 2.0 Flash would change the numbers but stay manageable.  
3. Firestore, Functions, Storage are minor at these power-user levels.

For exact numbers and your region, use [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator) and [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).
