"""Fetch UCI SMS Spam Collection locally; do not commit raw data."""
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile

SOURCE = 'https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip'
DEST = Path(__file__).resolve().parents[1] / 'data' / 'raw'
DEST.mkdir(parents=True, exist_ok=True)
archive = DEST / 'sms_spam_collection.zip'
print(f'Downloading {SOURCE}')
urlretrieve(SOURCE, archive)
with ZipFile(archive) as zipped:
    for member in zipped.infolist():
        # Guard against malicious archive paths.
        target = (DEST / member.filename).resolve()
        if not target.is_relative_to(DEST.resolve()):
            raise ValueError(f'Unsafe archive path: {member.filename}')
    zipped.extractall(DEST)
print(f'Downloaded to {DEST}. Check UCI terms before redistributing.')
