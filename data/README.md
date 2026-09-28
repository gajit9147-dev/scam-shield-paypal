# Data sources and safety

Day 1 contains no SMS examples. On Day 2, download the [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) from the original source and record its citation and license/terms before redistributing any data. It is English general spam, **not** a benchmark of UPI or Indian payment scams. Keep its scores separate from India/UPI evaluation.

To fetch a local copy, run `python scripts/fetch_uci.py` from the repository root. The script downloads a ZIP from UCI and extracts it to `data/raw/` (ignored by Git). Check the source terms yourself before publishing any derivative dataset. Never commit raw personal messages, OTPs, phone numbers, UPI IDs or live links.

For a later India-relevant dataset, use only consented or publicly shareable messages; redact identifiers and links, record source and label, and split by sender/template family before testing. Synthetic examples must be labeled synthetic.
