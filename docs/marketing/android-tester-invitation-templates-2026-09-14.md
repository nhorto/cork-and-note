# Android early-access messages

Prepared only; nothing has been sent. Replace the bracketed enrollment link with the actual available Alpha test URL. Confirm the participant requested Android testing and add their Google Play account email to the authorized tester list before sending.

## Prepare the recipient list

Run `node scripts/export-early-access.mjs --android-invitations` in the authenticated workspace. It writes a private CSV to Downloads containing only Android testing requests with the 14-day commitment and status `requested`. It excludes launch notifications, withdrawn users and requests already marked invited, installed or active. The export does not add Play access or send messages. The September 14 check returned zero candidates.

Before sending, recheck the current request status and confirm the email is the participant's Google Play account. Add eligible accounts to the Alpha tester list. After an authorized invitation is actually sent, mark that request `invited` in Supabase's `early_access_requests` table and record its date in the private tester roster. Mark opt-outs `withdrawn`; do not invite them again. Website signup, an invitation and a Google Play opt-in are separate events. Use the private roster for actual opt-in dates and feedback.

## Invitation

Subject: Your Cork & Note Android early access

Thanks for helping shape Cork & Note! Your Android testing access is ready.

1. Open [VERIFIED CLOSED-TEST JOIN LINK] while signed into Google with the email you used for your testing request.
2. Join the test, then follow the Google Play link to install Cork & Note.
3. Open the app and create your Cork & Note account. This app account is separate from joining the Google Play test.

Please stay opted in for at least 14 continuous days and try the app on several days. Start with a wine you already know: add a note or rating, try the cellar and map, and tell us what feels useful or confusing. There is no need to buy or drink wine to participate.

Your journal is free, with the normal free-tier limits. Pro is optional. Joining the test does not require a purchase or payment card. Google Play will show the price and terms if you choose to subscribe.

Send feedback through Profile → Feedback or reply to cork_and_note@yahoo.com. For bugs, include your phone model, Android version and app build. Please don't send passwords or payment details.

If you previously joined our internal test, opt out of that test before joining this closed test. If Google says the app is unavailable, check that the selected Google Account matches your invitation and let us know.

## Day 7 check-in

Subject: How is Cork & Note working for you?

Thanks for testing Cork & Note. What has been most useful so far? Has anything broken, been confusing, or taken too many taps? A short reply is enough. Please keep your Google Play test enrollment active through the full 14 days, even if you've already sent feedback.

## Day 14 feedback

Subject: Your Cork & Note testing feedback

Thanks for spending two weeks with Cork & Note. What would make you keep using it? What should we fix first? If you've had an issue, please include your phone model, Android version and app build. Testing can continue while we work through feedback and Google review; reaching day 14 does not automatically mean a public launch.

## If enrollment is not ready

Subject: We have your Cork & Note early-access request

Thanks for requesting Android early access. We've saved your request. We'll send installation instructions when your access is ready; there is nothing to install or pay for yet.
