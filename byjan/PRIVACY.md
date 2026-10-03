# Byjan privacy

Byjan records shared expenses, splits and the fact that a UPI payment was started. The UPI app (GPay, PhonePe, Paytm or any other) asks for the PIN. Byjan never sees, stores or transmits a UPI PIN.

Receipt photos, voice clips and shared screenshots are uploaded only so they can be read into an amount, a name and a date. Bank SMS is read on the Android device only when `EXPO_PUBLIC_SMS=1`, and the raw message is not sent to Byjan's servers. iOS cannot read SMS.

Camera, microphone, photos and Face ID are used only for the action you just tapped: scanning a bill, saying an expense, attaching a file, or unlocking the app.
