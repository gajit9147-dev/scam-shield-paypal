# Data sources and safety

## Day 2: UCI SMS Spam Collection (done)

The [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) (v.1, 5,574 messages: 4,827 ham / 747 spam) is downloaded locally with `python scripts/fetch_uci.py` and prepared with `python scripts/prepare_data.py`.

**Citation:** Almeida, T.A., Gomez Hidalgo, J.M., Yamakami, A. Contributions to the Study of SMS Spam Filtering: New Collection and Results. Proceedings of the 2011 ACM Symposium on Document Engineering (DocEng '11).

**License:** the [UCI dataset page](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) states the dataset is licensed under Creative Commons Attribution 4.0 (CC BY 4.0), which allows sharing and adaptation with credit. The readme bundled with the download separately states the corpus is free of charge under the authors' copyright with a no-warranty disclaimer and asks for the citation above. Check both yourself before redistributing; see `data/raw/readme` after fetching for the bundled text.

**What the prepare script does:**
- Normalizes whitespace and drops exact duplicate messages (414 removed, 5,160 kept).
- Writes shuffled 80/10/10 (not stratified) train/validation/test splits to `data/processed/` with a fixed seed (42), so the held-out test set stays frozen and reproducible.
- Full splits (`train.jsonl`, `validation.jsonl`, `test.jsonl`) are gitignored. `data/processed/sample.jsonl` (20 rows) and `data/processed/stats.json` are committed to show the format.

**Labels:** each row keeps the source label `ham` or `spam`. These are English general-spam messages, **not** UPI or Indian payment scam examples, and they are not this project's `scam`/`safe`/`uncertain` labels. General spam is mostly advertising, not credential or money theft. Keep any scores on this data separate from India/UPI evaluation, per `docs/architecture.md`.

**Privacy:** no personal SMS, OTPs, phone numbers, UPI IDs or live links are committed. Raw and full processed data stay local and gitignored.

## Later: India/UPI examples (pending)

Real UPI scam examples are being collected separately with consent. They must be redacted (no personal identifiers or live links), labeled with source and consent, marked synthetic if synthetic, and split by sender/template family before testing.
