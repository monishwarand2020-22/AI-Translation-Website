/**
 * AI Voice Translator - Main Application Controller
 * Connects Speech Recognition, Real-Time Translation Pipeline, and Speech Synthesis
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sourceLangSelect = document.getElementById('source-lang');
  const targetLangSelect = document.getElementById('target-lang');
  const swapLangsBtn = document.getElementById('swap-langs-btn');
  
  const micBtn = document.getElementById('mic-btn');
  const micStatusText = document.getElementById('mic-status-text');
  
  const voiceInputText = document.getElementById('voice-input-text');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const translateActionBtn = document.getElementById('translate-action-btn');
  
  const translatedTextDisplay = document.getElementById('translated-text-display');
  const phoneticTextDisplay = document.getElementById('phonetic-text-display');
  const playVoiceBtn = document.getElementById('play-voice-btn');
  const copyTranslationBtn = document.getElementById('copy-translation-btn');
  const replyBackBtn = document.getElementById('reply-back-btn');
  
  const visualizerCanvas = document.getElementById('audio-visualizer-canvas');
  const liveLatencyBadge = document.getElementById('live-latency-badge');
  const liveConfidenceBadge = document.getElementById('live-confidence-badge');
  const processingPulse = document.getElementById('processing-pulse');
  
  const conversationHistoryContainer = document.getElementById('conversation-history');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const scenarioSelector = document.getElementById('scenario-selector');
  const samplePillsContainer = document.getElementById('sample-pills-container');

  // Application State - Default: English -> Tamil
  const state = {
    sourceLang: 'en-IN',
    targetLang: 'ta-IN',
    inputText: '',
    translatedText: '',
    phoneticText: '',
    isRecording: false,
    isTranslating: false,
    isPlaying: false,
    hasSpokenFinalTranscript: false,
    history: []
  };

  // Initialize Canvas Visualizer
  if (window.audioEngine && visualizerCanvas) {
    window.audioEngine.setupVisualizer(visualizerCanvas);
  }

  // Populate Language Selectors (English -> Tamil default)
  function populateLanguageSelects() {
    const langs = Object.values(window.LANGUAGES_DATA);
    
    sourceLangSelect.innerHTML = '';
    targetLangSelect.innerHTML = '';

    langs.forEach(lang => {
      const optA = document.createElement('option');
      optA.value = lang.code;
      optA.textContent = `${lang.native} (${lang.name})`;
      if (lang.code === state.sourceLang) optA.selected = true;
      sourceLangSelect.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = lang.code;
      optB.textContent = `${lang.native} (${lang.name})`;
      if (lang.code === state.targetLang) optB.selected = true;
      targetLangSelect.appendChild(optB);
    });
  }

  // Render Sample Quick-Action Test Pills
  function renderSamplePills() {
    if (!samplePillsContainer) return;
    samplePillsContainer.innerHTML = '';

    const testPhrases = window.SAMPLE_PROMPT_PILLS || [
      { label: "Java Programming", prompt: "What is Java programming and where is it useful?" },
      { label: "Greeting", prompt: "Good morning, how are you?" },
      { label: "Daily Routine", prompt: "I am going to college today." },
      { label: "Railway Directions", prompt: "Where is the nearest railway station?" },
      { label: "Explain AI", prompt: "Can you explain artificial intelligence?" }
    ];

    testPhrases.forEach((item) => {
      const pill = document.createElement('button');
      pill.className = "text-xs px-3.5 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition flex items-center gap-1.5 shadow-sm active:scale-95";
      pill.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> <span class="font-medium">${item.label}:</span> <span class="text-slate-400">"${item.prompt}"</span>`;
      
      pill.addEventListener('click', () => {
        // Clear previous state completely
        clearCurrentState();
        voiceInputText.value = item.prompt;
        state.inputText = item.prompt;
        executeRealTranslation(item.prompt, true);
      });

      samplePillsContainer.appendChild(pill);
    });
  }

  // Populate Scenario Dropdown
  function populateScenarios() {
    if (!scenarioSelector) return;
    scenarioSelector.innerHTML = '<option value="">Choose Interactive Scenario...</option>';

    const scenarios = window.INTERACTIVE_SCENARIOS || [];
    scenarios.forEach(scen => {
      const opt = document.createElement('option');
      opt.value = scen.id;
      opt.textContent = scen.title;
      scenarioSelector.appendChild(opt);
    });

    scenarioSelector.addEventListener('change', (e) => {
      const scenId = e.target.value;
      if (!scenId) return;
      loadScenario(scenId);
    });
  }

  // Load a scenario and run real translation on first prompt
  function loadScenario(scenId) {
    const scen = (window.INTERACTIVE_SCENARIOS || []).find(s => s.id === scenId);
    if (!scen) return;

    // Set languages
    state.sourceLang = scen.speakerA.lang;
    state.targetLang = scen.speakerB.lang;
    sourceLangSelect.value = state.sourceLang;
    targetLangSelect.value = state.targetLang;

    clearCurrentState();

    if (scen.prompts && scen.prompts.length > 0) {
      const firstPrompt = scen.prompts[0].text;
      voiceInputText.value = firstPrompt;
      state.inputText = firstPrompt;
      executeRealTranslation(firstPrompt, true);
    }

    showToast(`Loaded scenario: ${scen.title}`);
  }

  // Clear previous input, translations, and statuses
  function clearCurrentState() {
    state.inputText = '';
    state.translatedText = '';
    state.phoneticText = '';
    state.hasSpokenFinalTranscript = false;

    voiceInputText.value = '';
    translatedTextDisplay.className = "text-lg sm:text-xl font-medium text-slate-400 min-h-[90px] leading-relaxed select-all";
    translatedTextDisplay.textContent = 'Awaiting voice or text input...';
    
    if (phoneticTextDisplay) {
      phoneticTextDisplay.textContent = '';
      phoneticTextDisplay.classList.add('hidden');
    }
  }

  // Core Real-Time Translation Function
  async function executeRealTranslation(inputText, shouldAutoPlayVoice = false) {
    const textToTranslate = (inputText || voiceInputText.value).trim();
    if (!textToTranslate) {
      translatedTextDisplay.className = "text-lg sm:text-xl font-medium text-slate-400 min-h-[90px] leading-relaxed select-all";
      translatedTextDisplay.textContent = 'Awaiting voice or text input...';
      return;
    }

    // Stop ongoing speech synthesis
    if (window.audioEngine) {
      window.audioEngine.stopSpeaking();
    }
    setPlayState(false);

    // Show Loading / Processing State
    state.isTranslating = true;
    if (processingPulse) processingPulse.classList.remove('hidden');
    
    const targetMeta = window.LANGUAGES_DATA[state.targetLang] || { name: 'Tamil', native: 'தமிழ்' };
    translatedTextDisplay.className = "text-lg sm:text-xl font-medium text-cyan-300 min-h-[90px] leading-relaxed select-all flex items-center";
    translatedTextDisplay.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="fa-solid fa-circle-notch fa-spin text-cyan-400 text-xl"></i>
        <span>Translating into ${targetMeta.name} (${targetMeta.native})...</span>
      </div>
    `;

    try {
      // Call the REAL translation pipeline (no hardcoded mappings, no fake fallback)
      const result = await window.realTranslate(textToTranslate, state.sourceLang, state.targetLang);

      state.isTranslating = false;
      if (processingPulse) processingPulse.classList.add('hidden');

      if (!result || !result.translatedText) {
        throw new Error("Translation service returned empty response.");
      }

      state.translatedText = result.translatedText;

      // Display the REAL translated result
      translatedTextDisplay.className = "text-lg sm:text-xl font-bold text-white min-h-[90px] leading-relaxed select-all";
      translatedTextDisplay.textContent = result.translatedText;

      // Update telemetry badges
      if (liveLatencyBadge) {
        liveLatencyBadge.textContent = `${result.latencyMs || 180}ms latency`;
      }
      if (liveConfidenceBadge) {
        liveConfidenceBadge.textContent = `Real-Time Neural Engine`;
      }

      // Add to Conversation History transcript
      const srcMeta = window.LANGUAGES_DATA[state.sourceLang] || { name: 'English', native: 'English' };
      addHistoryItem({
        id: Date.now(),
        speakerName: `${srcMeta.name} Speaker`,
        speakerLang: state.sourceLang,
        targetLang: state.targetLang,
        sourceText: textToTranslate,
        translatedText: result.translatedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      // Auto-play translated voice in Tamil/target language if requested
      if (shouldAutoPlayVoice) {
        speakTranslatedText(result.translatedText, state.targetLang);
      }

    } catch (err) {
      state.isTranslating = false;
      if (processingPulse) processingPulse.classList.add('hidden');

      console.error("Real translation error:", err);
      translatedTextDisplay.className = "text-base font-medium text-rose-400 min-h-[90px] leading-relaxed select-all flex items-center";
      translatedTextDisplay.innerHTML = `
        <div class="flex items-start gap-2.5">
          <i class="fa-solid fa-triangle-exclamation text-rose-400 text-lg mt-0.5"></i>
          <div>
            <div class="font-bold text-rose-300">Translation Service Notice</div>
            <div class="text-xs text-rose-400/90 mt-0.5">${err.message || 'Unable to translate text. Please check network connection.'}</div>
          </div>
        </div>
      `;
    }
  }

  // Text-To-Speech Output Function
  function speakTranslatedText(text, langCode) {
    if (!text || text === 'Awaiting voice or text input...') return;

    setPlayState(true);
    window.audioEngine.speakText(text, langCode, {
      onStart: () => setPlayState(true),
      onEnd: () => setPlayState(false),
      onError: (err) => {
        setPlayState(false);
        console.warn("TTS Notice:", err);
      }
    });
  }

  // Microphone Button Handler (Capture new audio, clear previous session & input)
  micBtn.addEventListener('click', () => {
    if (state.isRecording) {
      // User clicked to stop recording
      window.audioEngine.stopListening();
      setRecordingState(false);
    } else {
      // 1. Stop any ongoing speech or synthesis
      window.audioEngine.stopListening();
      window.audioEngine.stopSpeaking();
      setPlayState(false);

      // 2. Clear previous input and previous translation
      clearCurrentState();

      // 3. Update UI to recording state
      setRecordingState(true);
      micStatusText.textContent = "Listening to speech... Speak now";
      translatedTextDisplay.innerHTML = `
        <div class="flex items-center gap-2 text-indigo-400">
          <span class="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
          <span>Listening to your voice... Speak clearly.</span>
        </div>
      `;

      state.hasSpokenFinalTranscript = false;

      // 4. Start speech recognition in currently selected source language
      const success = window.audioEngine.startListening(state.sourceLang, {
        onStart: () => {
          setRecordingState(true);
        },
        onTranscript: (res) => {
          const spokenText = res.final || res.interim;
          if (spokenText) {
            voiceInputText.value = spokenText;
            state.inputText = spokenText;
          }

          // When final speech result is identified
          if (res.final && res.final.trim()) {
            state.hasSpokenFinalTranscript = true;
            window.audioEngine.stopListening();
            setRecordingState(false);
            
            // Translate the exact spoken speech into target language and play Tamil voice
            executeRealTranslation(res.final.trim(), true);
          }
        },
        onError: (errorMessage) => {
          setRecordingState(false);
          micStatusText.textContent = "Click to speak";

          // Requirement 14: If Speech-to-Text fails, show actual error instead of fake translation!
          translatedTextDisplay.className = "text-base font-medium text-rose-400 min-h-[90px] leading-relaxed select-all flex items-center";
          translatedTextDisplay.innerHTML = `
            <div class="flex items-start gap-2.5">
              <i class="fa-solid fa-circle-exclamation text-rose-400 text-lg mt-0.5"></i>
              <div>
                <div class="font-bold text-rose-300">Microphone / Speech Recognition Notice</div>
                <div class="text-xs text-rose-400/90 mt-0.5">${errorMessage}</div>
              </div>
            </div>
          `;
        },
        onEnd: () => {
          setRecordingState(false);
          micStatusText.textContent = "Click to speak";

          // If speech finished and we have captured text that hasn't been translated yet
          const text = voiceInputText.value.trim();
          if (text && !state.hasSpokenFinalTranscript && !state.isTranslating) {
            state.hasSpokenFinalTranscript = true;
            executeRealTranslation(text, true);
          }
        }
      });

      if (!success) {
        setRecordingState(false);
        micStatusText.textContent = "Click to speak";
      }
    }
  });

  function setRecordingState(isRec) {
    state.isRecording = isRec;
    if (isRec) {
      micBtn.classList.add('recording');
      micStatusText.textContent = "Listening... (Click to stop)";
    } else {
      micBtn.classList.remove('recording');
      micStatusText.textContent = "Click to speak";
    }
  }

  // Play Translated Voice Button
  playVoiceBtn.addEventListener('click', () => {
    if (!state.translatedText || state.translatedText === 'Awaiting voice or text input...') {
      showToast("Please speak or enter text to translate first.");
      return;
    }

    if (state.isPlaying) {
      window.audioEngine.stopSpeaking();
      setPlayState(false);
      return;
    }

    speakTranslatedText(state.translatedText, state.targetLang);
  });

  function setPlayState(playing) {
    state.isPlaying = playing;
    const playIcon = playVoiceBtn.querySelector('.play-icon');
    const playText = playVoiceBtn.querySelector('.play-text');
    
    if (playing) {
      playVoiceBtn.classList.add('ring-2', 'ring-cyan-400');
      if (playIcon) playIcon.className = 'fas fa-stop play-icon text-cyan-400';
      if (playText) playText.textContent = 'Stop Voice';
    } else {
      playVoiceBtn.classList.remove('ring-2', 'ring-cyan-400');
      if (playIcon) playIcon.className = 'fas fa-volume-high play-icon text-cyan-400';
      if (playText) playText.textContent = 'Play Translated Voice';
    }
  }

  // Swap Languages Button (Two-Way Conversational Shift)
  swapLangsBtn.addEventListener('click', () => {
    const tempLang = state.sourceLang;
    state.sourceLang = state.targetLang;
    state.targetLang = tempLang;

    sourceLangSelect.value = state.sourceLang;
    targetLangSelect.value = state.targetLang;

    // Swap texts if valid
    const currentInput = voiceInputText.value.trim();
    const currentTranslated = (state.translatedText && state.translatedText !== 'Awaiting voice or text input...') 
      ? state.translatedText 
      : '';

    clearCurrentState();

    if (currentTranslated) {
      voiceInputText.value = currentTranslated;
      state.inputText = currentTranslated;
      executeRealTranslation(currentTranslated, false);
    }

    const srcMeta = window.LANGUAGES_DATA[state.sourceLang];
    const tgtMeta = window.LANGUAGES_DATA[state.targetLang];
    showToast(`Direction updated: ${srcMeta.name} ➔ ${tgtMeta.name}`);
  });

  // Reply as Speaker B (Flips direction to reply back)
  if (replyBackBtn) {
    replyBackBtn.addEventListener('click', () => {
      swapLangsBtn.click();
      voiceInputText.focus();
    });
  }

  // Language Selectors Change Handlers
  sourceLangSelect.addEventListener('change', (e) => {
    state.sourceLang = e.target.value;
    const text = voiceInputText.value.trim();
    if (text) {
      executeRealTranslation(text, false);
    }
  });

  targetLangSelect.addEventListener('change', (e) => {
    state.targetLang = e.target.value;
    const text = voiceInputText.value.trim();
    if (text) {
      executeRealTranslation(text, false);
    }
  });

  // Manual Input & Buttons
  voiceInputText.addEventListener('input', () => {
    state.inputText = voiceInputText.value;
  });

  // Allow pressing Enter in textarea with Ctrl/Cmd or standard translate button
  voiceInputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeRealTranslation(voiceInputText.value, true);
    }
  });

  translateActionBtn.addEventListener('click', () => {
    executeRealTranslation(voiceInputText.value, true);
  });

  clearInputBtn.addEventListener('click', () => {
    clearCurrentState();
    voiceInputText.focus();
  });

  copyTranslationBtn.addEventListener('click', () => {
    if (state.translatedText && state.translatedText !== 'Awaiting voice or text input...') {
      navigator.clipboard.writeText(state.translatedText).then(() => {
        showToast("Translated text copied to clipboard!");
      }).catch(() => {
        showToast("Copied text!");
      });
    }
  });

  // Conversation History Management
  function addHistoryItem(item) {
    state.history.unshift(item);
    if (state.history.length > 25) state.history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (!conversationHistoryContainer) return;

    if (state.history.length === 0) {
      conversationHistoryContainer.innerHTML = `
        <div class="text-center py-10 text-slate-500 text-sm">
          <i class="fas fa-comments text-2xl mb-2 block opacity-40"></i>
          No conversation turns yet. Click the microphone or choose a test prompt above to start!
        </div>
      `;
      return;
    }

    conversationHistoryContainer.innerHTML = '';
    state.history.forEach((turn, idx) => {
      const srcMeta = window.LANGUAGES_DATA[turn.speakerLang] || { name: 'English', native: 'English' };
      const tgtMeta = window.LANGUAGES_DATA[turn.targetLang] || { name: 'Tamil', native: 'தமிழ்' };
      const isA = idx % 2 === 0;

      const bubble = document.createElement('div');
      bubble.className = `p-4 rounded-xl mb-3 border border-white/5 transition hover:border-white/10 ${isA ? 'chat-bubble-a' : 'chat-bubble-b'}`;

      bubble.innerHTML = `
        <div class="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isA ? 'bg-indigo-400' : 'bg-cyan-400'}"></span>
            <span class="font-semibold text-xs text-white">${turn.speakerName}</span>
            <span class="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">${srcMeta.native} ➔ ${tgtMeta.native}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-500">${turn.timestamp}</span>
            <button class="history-play-btn text-xs text-slate-400 hover:text-cyan-300 p-1 transition" title="Listen to translation">
              <i class="fas fa-volume-up"></i>
            </button>
          </div>
        </div>
        <div class="text-sm text-slate-300 mb-1">
          <span class="text-slate-500 text-xs mr-1">Spoke:</span> "${turn.sourceText}"
        </div>
        <div class="text-sm font-medium text-cyan-200">
          <span class="text-slate-500 text-xs mr-1">Translated:</span> "${turn.translatedText}"
        </div>
      `;

      // History replay button
      const playBtn = bubble.querySelector('.history-play-btn');
      playBtn.addEventListener('click', () => {
        window.audioEngine.speakText(turn.translatedText, turn.targetLang);
      });

      conversationHistoryContainer.appendChild(bubble);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      state.history = [];
      renderHistory();
      showToast("Conversation transcript cleared.");
    });
  }

  // Populate Supported Languages Showcase Cards
  function populateSupportedLanguagesGrid() {
    const grid = document.getElementById('languages-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.values(window.LANGUAGES_DATA).forEach(lang => {
      const card = document.createElement('div');
      card.className = "glass-card glass-card-interactive p-5 rounded-2xl relative overflow-hidden group";
      
      card.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">${lang.code}</div>
            <h4 class="text-xl font-bold text-white group-hover:text-cyan-300 transition">${lang.native}</h4>
            <div class="text-sm text-slate-400 font-medium">${lang.name}</div>
          </div>
          <button class="preview-lang-voice-btn w-9 h-9 rounded-full bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700/60 flex items-center justify-center transition shadow-sm" title="Preview native greeting voice">
            <i class="fas fa-play text-xs"></i>
          </button>
        </div>

        <div class="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 mb-3">
          <div class="font-medium text-slate-300 mb-1">"${lang.sampleGreeting}"</div>
          <div class="font-mono text-[11px] text-slate-500">Live Synthesis Supported</div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
          <span class="flex items-center gap-1.5"><i class="fas fa-gauge text-cyan-400"></i> ${lang.latency}</span>
          <span class="flex items-center gap-1.5"><i class="fas fa-check-double text-emerald-400"></i> Real-time</span>
        </div>
      `;

      const previewBtn = card.querySelector('.preview-lang-voice-btn');
      previewBtn.addEventListener('click', () => {
        window.audioEngine.speakText(lang.sampleGreeting, lang.code);
        showToast(`Playing sample voice: ${lang.name} (${lang.native})`);
      });

      grid.appendChild(card);
    });
  }

  // Toast notification helper
  function showToast(message) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    }, 3200);
  }

  // Initialize UI
  populateLanguageSelects();
  populateScenarios();
  renderSamplePills();
  populateSupportedLanguagesGrid();
  renderHistory();
});
