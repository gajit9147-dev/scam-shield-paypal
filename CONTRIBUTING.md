# Contributing to ScamShield

Thanks for wanting to help. This project is small, and first-time contributors are welcome. You do not need to be an expert.

## Easy ways to start

- Look for issues labelled [good first issue](https://github.com/gajit9147-dev/scam-shield-paypal/labels/good%20first%20issue). They are small and have clear steps.
- Fix a typo or unclear sentence in the README.
- Try the project, and open an issue if something confuses you or breaks.

## Set up on your computer

1. Fork the repo on GitHub, then clone your fork:

```
git clone https://github.com/<your-username>/scam-shield-paypal.git
cd scam-shield-paypal
```

Copy `.env.example` to `.env`, add your own Gemini key and PayPal sandbox keys (never commit them), then:

```
npm run install:all
npm run dev
```

## Making a change

1. Create a branch with a short name, for example `fix-readme-typo`.
2. Keep the change small and focused on one thing.
3. Run `npm test` and make sure it passes.
4. Commit with a plain, simple sentence that says what you did, for example "Fix broken link in the README".
5. Push your branch and open a pull request. Say what you changed and why. Add a screenshot if you changed how something looks.

## Please do not

- Commit API keys, tokens or passwords. Use environment variables and an example env file.
- Mix unrelated changes in one pull request.

## Questions

Open an issue and ask. No question is too basic.

By contributing, you agree your work is shared under the MIT License in this repo.
