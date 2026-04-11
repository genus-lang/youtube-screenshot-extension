const fs = require('fs');
const path = require('path');

const NOTEUI_JS = path.join(__dirname, 'src/content/noteUI.js');
const BACKGROUND_JS = path.join(__dirname, 'src/background/background.js');
const STORAGE_JS = path.join(__dirname, 'src/storage/storage.js');
const ONENOTE_EXPORT_JS = path.join(__dirname, 'src/export/onenoteExport.js');
const MANIFEST_JSON = path.join(__dirname, 'manifest.json');

// --- 1. manifest.json ---
// Ask for microphone permissions if needed (Optional for standard HTML5 getUserMedia in content scripts, but safe to add audioCapture just in case, though getUserMedia normally just prompts the user).
// We'll leave manifest alone unless needed, regular getUserMedia handles this.

// --- 2. noteUI.js Update ---
let noteUI = fs.readFileSync(NOTEUI_JS, 'utf8');

// Add the UI button
const ocrBtnHtml = `<button id="yt-modal-ocr" class="yt-ocr-btn" title="Extract text from screenshot using OCR">`;
const recordBtnHtml = `
          <button id="yt-modal-record" class="yt-ocr-btn" title="Record Audio Note" style="margin-right: 8px; border-color: #f43f5e; color: #f43f5e;">
            <span class="yt-ocr-icon" id="yt-record-icon">🎙️</span>
            <span id="yt-record-text">Record Audio</span>
          </button>
          ` + ocrBtnHtml;
noteUI = noteUI.replace(ocrBtnHtml, recordBtnHtml);

// Adding audio player container below textarea
const textareaHtml = `</textarea>`;
const audioContainerHtml = `</textarea>
        <!-- Audio Preview -->
        <div id="yt-modal-audio-container" class="yt-modal-hidden" style="margin-top: 8px; display: flex; align-items: center; gap: 8px; background: rgba(244, 63, 94, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(244, 63, 94, 0.2);">
          <span style="font-size: 16px;">🎵</span>
          <audio id="yt-modal-audio-player" controls height="30" style="height: 30px; flex: 1; min-width: 100px;"></audio>
          <button id="yt-modal-audio-delete" title="Discard Audio" style="background: none; border: none; color: #f43f5e; cursor: pointer; font-size: 16px;">✕</button>
        </div>`;
noteUI = noteUI.replace(textareaHtml, audioContainerHtml);

// Inject logic into showNoteUI
const showNoteUiStart = "const ocrBtn   = overlay.querySelector('#yt-modal-ocr');";
const showNoteUiReplacement = `const ocrBtn   = overlay.querySelector('#yt-modal-ocr');
  const recordBtn = overlay.querySelector('#yt-modal-record');
  const audioContainer = overlay.querySelector('#yt-modal-audio-container');
  const audioPlayer = overlay.querySelector('#yt-modal-audio-player');
  const audioDelete = overlay.querySelector('#yt-modal-audio-delete');
  const recordIcon = overlay.querySelector('#yt-record-icon');
  const recordText = overlay.querySelector('#yt-record-text');

  let mediaRecorder = null;
  let audioChunks = [];
  let currentAudioBase64 = null;`;
noteUI = noteUI.replace(showNoteUiStart, showNoteUiReplacement);

// Reset Audio on Show
const resetLogicStart = "toast.classList.add('yt-modal-hidden');";
const resetLogicReplacement = `toast.classList.add('yt-modal-hidden');
  audioContainer.classList.add('yt-modal-hidden');
  currentAudioBase64 = null;
  if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  recordBtn.style.background = '';
  recordBtn.style.color = '#f43f5e';
  recordText.textContent = 'Record Audio';
  recordIcon.textContent = '🎙️';`;
noteUI = noteUI.replace(resetLogicStart, resetLogicReplacement);

// Clone Record button to remove old listeners
const cloneBtnStart = "const freshOcr = ocrBtn.cloneNode(true);";
const cloneBtnReplacement = `const freshOcr = ocrBtn.cloneNode(true);
  const freshRecord = recordBtn.cloneNode(true);
  recordBtn.parentNode.replaceChild(freshRecord, recordBtn);
  const freshAudioDelete = audioDelete.cloneNode(true);
  audioDelete.parentNode.replaceChild(freshAudioDelete, audioDelete);`;
noteUI = noteUI.replace(cloneBtnStart, cloneBtnReplacement);

// Update doSave handler
const doSaveStart = `action: 'SAVE_SCREENSHOT',
        payload: { videoId, videoTitle, frameData, timestamp, noteText, subject }`;
const doSaveReplacement = `action: 'SAVE_SCREENSHOT',
        payload: { videoId, videoTitle, frameData, timestamp, noteText, subject, audioData: currentAudioBase64 }`;
noteUI = noteUI.replace(doSaveStart, doSaveReplacement);


// Add Recording Handlers
const ocrHandlerStart = "// --- OCR Extract Text button ---";
const recordingLogic = `
  // --- Audio Recording button ---
  freshRecord.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop recording
      mediaRecorder.stop();
      freshRecord.style.background = '';
      freshRecord.style.color = '#f43f5e';
      overlay.querySelector('#yt-record-text').textContent = 'Record Audio';
      overlay.querySelector('#yt-record-icon').textContent = '🎙️';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        overlay.querySelector('#yt-modal-audio-player').src = url;
        overlay.querySelector('#yt-modal-audio-container').classList.remove('yt-modal-hidden');
        
        // Convert to Base64 to save locally (since blob URLs are temporary)
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = function() {
          currentAudioBase64 = reader.result;
        };

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      freshRecord.style.background = 'rgba(244, 63, 94, 0.2)';
      overlay.querySelector('#yt-record-text').textContent = 'Recording... (Click to stop)';
      overlay.querySelector('#yt-record-icon').textContent = '🔴';
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Could not access microphone! Please allow microphone permissions on this page.');
    }
  });

  freshAudioDelete.addEventListener('click', () => {
    overlay.querySelector('#yt-modal-audio-container').classList.add('yt-modal-hidden');
    overlay.querySelector('#yt-modal-audio-player').src = '';
    currentAudioBase64 = null;
  });

  `;
noteUI = noteUI.replace(ocrHandlerStart, recordingLogic + ocrHandlerStart);
fs.writeFileSync(NOTEUI_JS, noteUI, 'utf8');

// --- 3. onenoteExport.js Update ---
// OneNote supports attachments using the <object> tag.
let onenote = fs.readFileSync(ONENOTE_EXPORT_JS, 'utf8');

// Inside the screenshot loop, attach the audio if it exists.
let onenoteImgHtml = `html += \`
          <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#f9f9ff;padding:6px 12px;font-size:12px;color:#6d28d9;font-weight:600;">
              \${esc(snap.time || '0:00')}
            </div>
            <img src="name:\${imgId}" alt="Screenshot at \${esc(snap.time || '0:00')}"
              style="display:block;width:100%;max-width:700px;" />
            \${snapNote
              ? \`<div style="padding:12px 14px;background:#faf8ff;border-top:1px solid #e5e7eb;">
                   <span style="font-weight:bold;color:#4c1d95;">Note: </span>  
                   <span style="color:#1e1b4b;">\${snapNote}</span>
                 </div>\`
              : ''}
          </div>
        \`;`;

let onenoteReplacement = `
        const audioId = \`audio\${imageCounter++}\`;
        const hasAudio = !!snap.audioData;

        html += \`
          <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:#f9f9ff;padding:6px 12px;font-size:12px;color:#6d28d9;font-weight:600;">
              \${esc(snap.time || '0:00')}
            </div>
            <img src="name:\${imgId}" alt="Screenshot at \${esc(snap.time || '0:00')}"
              style="display:block;width:100%;max-width:700px;" />
            \${hasAudio ? \`
               <div style="padding:12px 14px;background:#fff5f7;border-top:1px solid #ffe4e6; display:flex; align-items:center; gap:8px;">
                 <span style="font-size:16px;">🎙️</span>
                 <strong style="color:#be123c;">Audio Note Attached</strong>
                 <br/><object data-attachment="AudioNote.webm" data="name:\${audioId}" type="audio/webm" style="display:block;margin-top:4px;" />
               </div>
            \` : ''}
            \${snapNote
              ? \`<div style="padding:12px 14px;background:#faf8ff;border-top:1px solid #e5e7eb;">
                   <span style="font-weight:bold;color:#4c1d95;">Note: </span>  
                   <span style="color:#1e1b4b;">\${snapNote}</span>
                 </div>\`
              : ''}
          </div>
        \`;`;
onenote = onenote.replace(onenoteImgHtml, onenoteReplacement);

const onenoteFetchImage = `imagePromises.push(
          fetch(snap.image).then(r => r.blob()).then(blob => {
            formData.append(imgId, blob, \`\${imgId}.jpg\`);
          })
        );
      }`;
const onenoteFetchReplacement = `imagePromises.push(
          fetch(snap.image).then(r => r.blob()).then(blob => {
            formData.append(imgId, blob, \`\${imgId}.jpg\`);
          })
        );

        if (hasAudio) {
           imagePromises.push(
             fetch(snap.audioData).then(r => r.blob()).then(blob => {
               formData.append(audioId, blob, 'AudioNote.webm');
             })
           );
        }
      }`;

onenote = onenote.replace(onenoteFetchImage, onenoteFetchReplacement);
fs.writeFileSync(ONENOTE_EXPORT_JS, onenote, 'utf8');

console.log("Audio logic fully injected and OneNote export patched.");
