# Privacy Policy for YouTube Screenshot Notes

**Effective Date:** April 4, 2026

Thank you for using **YouTube Screenshot Notes** (the "Extension"). This Privacy Policy outlines what information the Extension collects, why it is collected, and how it is used.

### 1. Data Collection and Storage
The Extension is designed to operate locally on your device with maximum privacy. 
- **Screenshots and Notes:** All screenshots taken from YouTube videos, automatically extracted text (OCR), and typed notes are stored locally in your browser's internal storage (`chrome.storage.local`). **This data is never sent to our servers.**
- **User Preferences:** Your UI settings, active subject groups, and configuration preferences are also stored locally on your device.

### 2. External APIs and Data Processing
Depending on the features you explicitly enable and configure, the Extension may connect directly from your browser to the following third-party APIs:

- **AI Summarization (Optional):** If you provide your own API key (e.g., Groq / LLaMA) in the Extension’s settings, your saved screenshot notes and video titles are securely transmitted directly to that third-party AI provider to generate study summaries when you export your notes. We do not store or track your API key on any central database. It lives entirely local to your device.
- **Microsoft OneNote Export (Optional):** If you choose to export your notes to Microsoft OneNote, the extension will ask you to authenticate through Microsoft using standard OAuth2. Once authorized, the Extension communicates directly with the Microsoft Graph API (`https://graph.microsoft.com/v1.0/`) to push your locally saved screenshots and text into your OneNote notebook. 

### 3. How Data is Used
- Captured data is exclusively used to provide you with the study notes and export capability (PDF, OneNote) that the Extension advertises.
- We do not collect analytics, telemetry, IP addresses, or tracking data.
- We do not sell, rent, or share your data with any third parties (other than the user-initiated transfers to Microsoft or AI providers as detailed above).

### 4. Video Content Accessibility
- The Extension requires permission to access `https://www.youtube.com/*` exclusively to capture screenshots of the active video player. It does not monitor other webpages or interfere with your browsing history.

### 5. Your Consent
By using the Extension, you consent to this Privacy Policy.
Since almost all data is stored locally, you hold ultimate control. You can delete all captured data at any time from the Extension's Dashboard ("Clear Data"), or by uninstalling the Extension.

### 6. Changes to this Privacy Policy
We may update this Privacy Policy to reflect changes in our practices or changes to Web Store policies. We encourage you to review this page periodically.

### 7. Contact Us
If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact the developer via the support link on the Chrome Web Store listing.
