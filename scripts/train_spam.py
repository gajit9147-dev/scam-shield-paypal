"""Train a UCI general-SMS-spam baseline, never a UPI scam classifier.

Run fetch_uci.py, prepare_data.py, then this file with scikit-learn installed.
The frozen test split is read only after fitting and threshold selection.
"""
import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'processed'
MODEL = ROOT / 'server' / 'model' / 'uci-spam-nb.json'
REPORT = ROOT / 'docs' / 'uci-test-metrics.json'
TOKEN = re.compile(r'[a-z0-9]+')


def read(name):
    with (DATA / f'{name}.jsonl').open(encoding='utf-8') as f:
        return [json.loads(line) for line in f]


def words(text):
    tokens = ['num' if any(c.isdigit() for c in token) else token for token in TOKEN.findall(text.lower())]
    return tokens + [f'{a} {b}' for a, b in zip(tokens, tokens[1:])]


def counts(rows, scores, threshold):
    actual = [r['source_label'] == 'spam' for r in rows]
    predicted = [float(score) >= threshold for score in scores]
    tp = sum(a and p for a, p in zip(actual, predicted))
    fp = sum(not a and p for a, p in zip(actual, predicted))
    tn = sum(not a and not p for a, p in zip(actual, predicted))
    fn = sum(a and not p for a, p in zip(actual, predicted))
    return {'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn,
            'precision': tp / (tp + fp) if tp + fp else 0,
            'recall': tp / (tp + fn) if tp + fn else 0,
            'accuracy': (tp + tn) / len(rows)}


def main():
    train, valid = read('train'), read('validation')
    # Fixed hyperparameters. Vocabulary and class probabilities use train only.
    vectorizer = CountVectorizer(analyzer=words, min_df=2, max_features=12000)
    x_train = vectorizer.fit_transform(r['text'] for r in train)
    model = MultinomialNB(alpha=1.0)
    model.fit(x_train, [r['source_label'] for r in train])
    if list(model.classes_) != ['ham', 'spam']:
        raise ValueError('Unexpected class ordering')
    # Predetermined conservative threshold, validated but never tuned on test.
    valid_scores = model.predict_proba(vectorizer.transform(r['text'] for r in valid))[:, 1]
    threshold = 0.95  # Conservative predetermined decision threshold; report validation and test unchanged.

    # First test read occurs after all training and selection decisions.
    test = read('test')
    test_scores = model.predict_proba(vectorizer.transform(r['text'] for r in test))[:, 1]
    majority = counts(test, [0] * len(test), 0.5)
    metrics = counts(test, test_scores, threshold)
    export = {
        'source': 'UCI SMS Spam Collection v.1',
        'task': 'English general SMS spam detection, not UPI scam verification',
        'tokenizer': 'lowercase ASCII alphanumeric words, number masking, adjacent word bigrams',
        'alpha': 1.0,
        'classes': ['ham', 'spam'],
        'classLogPrior': model.class_log_prior_.tolist(),
        'spamThreshold': threshold,
        'features': {feature: model.feature_log_prob_[:, i].tolist()
                     for feature, i in sorted(vectorizer.vocabulary_.items())},
    }
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    MODEL.write_text(json.dumps(export, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    result = {
        'task': 'UCI English general SMS ham/spam only; not scam/safe/uncertain',
        'source_url': 'https://archive.ics.uci.edu/dataset/228/sms+spam+collection',
        'seed': 42, 'train_rows': len(train), 'validation_rows': len(valid), 'test_rows': len(test),
        'training': 'CountVectorizer ASCII word uni/bigrams with number masking min_df=2 max_features=12000; MultinomialNB alpha=1.0',
        'fixed_threshold_checked_on_validation': threshold,
        'validation': counts(valid, valid_scores, threshold),
        'test': metrics, 'majority_ham_test': majority,
        'test_false_positive_ids': [r['id'] for r, s in zip(test, test_scores) if r['source_label'] == 'ham' and s >= threshold],
        'no_upi_test': True,
    }
    REPORT.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
