# Why a draft average is not a review

A clear draft can still contain an unsupported promise. Evals separates required checks from preferences so a high score cannot conceal a failed requirement. The visitor makes each judgment; the tool organizes the evidence and explains the resulting comparison.

## The review contract

- Source notes and two drafts are kept as raw text. Numbered nonempty passages provide citation targets without changing the original text.
- A saved required judgment identifies a check, draft, source passage, draft passage, reason and the document/criterion versions it reviewed.
- Editing material makes dependent judgments and preference ratings outdated. Restoring identical wording does not revive an old review. A fresh review is deliberate.
- Saved reasons retain their original check labels and cited text. Old references do not silently point at replacement text.
- Saving another judgment for the same current check marks the earlier one Superseded. Only the latest current judgment controls eligibility; UI, JSON and CSV identify the active record consistently. A never-reviewed required check remains Unreviewed, rather than being described as an edited review.
- Preference definitions share a revision. Editing a preference makes all saved preference ratings outdated and requires deliberate re-rating; this conservative rule avoids comparing mixed definitions.
- Both candidates need complete current required reviews before a recommendation. A sole eligible candidate is compared with a currently failed candidate; an unreviewed candidate is not treated as a failure.
- Preference scores compare drafts that meet the required checks. Finite 0–5 scores and positive bounded weights are validated; an eligible tie remains a tie.
- JSON preserves the exact review record. Formula-safe CSV summarizes the same current validity, provenance, ratings and decision. Neither export executes pasted formulas.
- Reset clears entered material and reviews. Refresh clears the tab's memory. No model, account, network submission or persistent data store is involved.

## Implementation map

`src/lib/evidence-review.ts` owns review state transitions, validity, decisions and exports. `src/lib/tools.ts` supplies the shared weighted-average and CSV escaping helpers. `src/components/tools/Evals.tsx` presents documents, judgments and citation navigation. Scoped evidence-review styles keep the tool usable on small screens.

The standalone source shell is distinct from the full [live Jugaad site](https://jugaad.best/tools/evals/). Source synchronization copies these reviewed modules, rather than exposing private repository history or unrelated websites.

## Verification boundary

Run `npm run qa` in this checkout. The regression tests are the inspectable proof for recommendation gates, stale versions, invalid input and exported evidence. The full Jugaad host additionally checks the built browser workflow and its content security policy.
