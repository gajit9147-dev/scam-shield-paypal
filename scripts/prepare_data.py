"""Prepare the UCI SMS Spam Collection for later model work.

Reads data/raw/SMSSpamCollection (run scripts/fetch_uci.py first),
cleans and normalizes the text, deduplicates, and writes shuffled
train/validation/test splits to data/processed/.

Full splits are gitignored. A small sample and dataset statistics are
written for committing, so others can see the format without the raw
data being in the repo.

Source: https://archive.ics.uci.edu/dataset/228/sms+spam+collection
Citation: Almeida, T.A., Gomez Hidalgo, J.M., Yamakami, A.
Contributions to the Study of SMS Spam Filtering: New Collection and
Results. ACM DocEng 2011.

Important: these are English general-spam messages, NOT UPI or Indian
payment scam examples. Keep evaluation on this data separate from any
India/UPI evaluation. The ham/spam labels here are the source dataset's
own labels, not this project's scam/safe/uncertain labels.
"""
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data' / 'raw' / 'SMSSpamCollection'
OUT = ROOT / 'data' / 'processed'
SEED = 42
TRAIN_FRAC, VAL_FRAC = 0.8, 0.1  # remaining 0.1 is the frozen test set

WHITESPACE = re.compile(r'\s+')


def normalize(text):
    # Trim and collapse internal whitespace; keep original casing and words.
    return WHITESPACE.sub(' ', text).strip()


def main():
    if not RAW.exists():
        raise SystemExit('Missing data/raw/SMSSpamCollection. Run: python scripts/fetch_uci.py')

    seen = set()
    rows = []
    skipped_dupes = 0
    with RAW.open(encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            label, sep, text = line.partition('\t')
            if not sep or label not in ('ham', 'spam'):
                continue
            text = normalize(text)
            if not text:
                continue
            key = hashlib.sha1(f'{label}|{text}'.encode('utf-8')).hexdigest()
            if key in seen:
                skipped_dupes += 1
                continue
            seen.add(key)
            rows.append({'id': key[:12], 'text': text, 'source_label': label})

    random.Random(SEED).shuffle(rows)  # Existing Day 2 split; not stratified. Keep test frozen.

    n = len(rows)
    n_train = int(n * TRAIN_FRAC)
    n_val = int(n * VAL_FRAC)
    splits = {
        'train': rows[:n_train],
        'validation': rows[n_train:n_train + n_val],
        'test': rows[n_train + n_val:],
    }

    OUT.mkdir(parents=True, exist_ok=True)
    for name, split_rows in splits.items():
        with (OUT / f'{name}.jsonl').open('w', encoding='utf-8') as f:
            for row in split_rows:
                f.write(json.dumps(row, ensure_ascii=False) + '\n')

    stats = {
        'source': 'UCI SMS Spam Collection v.1',
        'source_url': 'https://archive.ics.uci.edu/dataset/228/sms+spam+collection',
        'citation': ('Almeida, T.A., Gomez Hidalgo, J.M., Yamakami, A. '
                     'Contributions to the Study of SMS Spam Filtering: '
                     'New Collection and Results. ACM DocEng 2011.'),
        'seed': SEED,
        'input_rows': sum(len(v) for v in splits.values()) + skipped_dupes,
        'duplicates_removed': skipped_dupes,
        'total_rows': n,
        'splits': {
            name: {
                'rows': len(split_rows),
                'labels': dict(Counter(r['source_label'] for r in split_rows)),
            }
            for name, split_rows in splits.items()
        },
    }
    with (OUT / 'stats.json').open('w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    with (OUT / 'sample.jsonl').open('w', encoding='utf-8') as f:
        for row in rows[:20]:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')

    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
