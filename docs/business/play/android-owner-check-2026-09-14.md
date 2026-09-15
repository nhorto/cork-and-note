# Android check before closed-test submission

The candidate is Cork & Note **1.0.0 (7)**, package `com.nicholashorton.corkandnote`. Its internal release is available in Console; the closed Alpha release is saved for review but has not been submitted. The actual internal enrollment link and license-tester selection could not be read back in the final session because Safari stopped exposing its page controls.

## Get the Play-installed build

1. Open Google Play Console, select Cork & Note, then **Test and release → Testing → Internal testing → Testers**.
2. Confirm the Google Account used by the Play Store on your Android phone is included in the selected tester list. Save any list change.
3. Copy the web join link shown on that page. Open it on the phone with that same Google Account, join the test, and follow its Google Play installation link.
4. Install or update Cork & Note. Confirm build 7; an older sideloaded build does not complete this check.

## Use test payments for the purchase check

Google says the publishing account is automatically a license tester. For a different phone account, return to the account-level **Settings → License testing**, select or create a list containing that email, and save. Test-track access and license testing are separate. Do not add the entire recruited early-access cohort to license testing: this setup is for the owner’s purchase checks. [Google's setup instructions](https://support.google.com/googleplay/android-developer/answer/6062777).

At Pro checkout, confirm the Google test-purchase notice and select the test payment method that always approves. If neither appears, stop that purchase and check the downloading account and license settings. A test-track participant can otherwise be charged. Restore using the same Google and Cork & Note accounts while the test subscription is still active; test subscriptions expire faster than normal subscriptions. [Google's billing test guide](https://developer.android.com/google/play/billing/test).

## Check and report

- Sign in and reopen the app.
- Add a journal entry and rating; confirm they survive reopening.
- Select a photo, accept AI processing when requested, and try a scan and sommelier question.
- Open the winery map, pan it, and recenter on your location. Report any blank map or crash.
- Complete the Pro test purchase and restore; verify Pro features unlock.

Send the phone model, Android version, app build, and which checks passed or failed. For a failure, include the steps and visible error, without credentials or payment details. The fuller [device worksheet](../device-acceptance-2026-09-13.md) remains the acceptance record.

Once this check is satisfactory, the prepared Google changes can be submitted. After approval, verify the closed-test enrollment path before sending installation invitations. The $75 Meta signup pilot can run separately while this check and Google review proceed; its ads explain that access comes later. The Android 14-day testing period does not begin with internal testing or website signup.
