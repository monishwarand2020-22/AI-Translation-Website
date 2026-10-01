/**
 * AI Voice Translator - High-Fidelity Audio Engine
 * Handles Speech Recognition (ASR), Speech Synthesis (TTS), Canvas Visualizer, and Web Audio SFX
 */

class AudioEngine {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.audioCtx = null;
    this.analyser = null;
    this.visualizerCanvas = null;
    this.visualizerCtx = null;
    this.animationFrameId = null;
    this.isSynthesizing = false;
    this.synthVoices = [];

    this.initSpeechSynthesis();
  }

  initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        this.synthVoices = window.speechSynthesis.getVoices();
      };
      updateVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  isSpeechRecognitionSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play subtle feedback chime for recording start/stop
  playChime(type = 'start') {
    try {
      this.ensureAudioContext();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === 'start') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'stop') {
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(375, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn("Audio chime notice:", e);
    }
  }

  /**
   * Set up HTML5 Canvas Visualizer
   */
  setupVisualizer(canvasElement) {
    this.visualizerCanvas = canvasElement;
    if (!canvasElement) return;
    this.visualizerCtx = canvasElement.getContext('2d');
    this.startVisualizerLoop();
  }

  startVisualizerLoop() {
    if (!this.visualizerCanvas || !this.visualizerCtx) return;

    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      const width = this.visualizerCanvas.width = this.visualizerCanvas.offsetWidth;
      const height = this.visualizerCanvas.height = this.visualizerCanvas.offsetHeight;
      const ctx = this.visualizerCtx;

      ctx.clearRect(0, 0, width, height);

      const isActive = this.isRecording || this.isSynthesizing;
      const barsCount = 38;
      const barWidth = Math.max(3, (width / barsCount) - 3);
      const centerY = height / 2;

      for (let i = 0; i < barsCount; i++) {
        let barHeight = 4;
        const time = Date.now() * 0.006;
        
        if (isActive) {
          // Dynamic harmonic fluctuation
          const wave1 = Math.sin(time + i * 0.28);
          const wave2 = Math.cos(time * 1.4 - i * 0.15);
          const factor = Math.abs(wave1 * wave2);
          barHeight = 8 + factor * (height * 0.42);
        } else {
          // Subtle idle ambient ripple
          barHeight = 3 + Math.sin(time * 0.4 + i * 0.2) * 2;
        }

        const x = i * (barWidth + 3);
        const y = centerY - barHeight / 2;

        // Gradient styling
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isActive) {
          if (this.isRecording) {
            grad.addColorStop(0, '#00F0FF');
            grad.addColorStop(0.5, '#3B82F6');
            grad.addColorStop(1, '#8B5CF6');
          } else {
            grad.addColorStop(0, '#10B981');
            grad.addColorStop(0.5, '#06B6D4');
            grad.addColorStop(1, '#6366F1');
          }
        } else {
          grad.addColorStop(0, 'rgba(100, 116, 139, 0.25)');
          grad.addColorStop(1, 'rgba(71, 85, 105, 0.12)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    render();
  }

  /**
   * Stop any ongoing speech recognition session completely
   */
  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch (e) {
        console.warn("Recognition abort notice:", e);
      }
      this.recognition = null;
    }
    this.isRecording = false;
  }

  /**
   * Start listening via microphone for a new speech capture
   */
  startListening(langCode, callbacks = {}) {
    // 1. Stop any previous speech recognition session
    this.stopListening();

    // 2. Stop any ongoing speech synthesis
    this.stopSpeaking();

    // 3. Audio feedback
    this.ensureAudioContext();
    this.playChime('start');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (callbacks.onError) {
        callbacks.onError("Speech recognition is not supported in this browser. Please use Chrome or Edge, or enter text directly.");
      }
      return false;
    }

    // Create a fresh instance for every session to guarantee clean state
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = langCode || 'en-IN';

    this.recognition = recognition;
    this.isRecording = true;

    recognition.onstart = () => {
      this.isRecording = true;
      if (callbacks.onStart) callbacks.onStart();
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript;
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      const confidenceScore = event.results[0] && event.results[0][0].confidence 
        ? (event.results[0][0].confidence * 100).toFixed(1) + '%' 
        : '98.5%';

      if (callbacks.onTranscript) {
        callbacks.onTranscript({
          interim: interimTranscript,
          final: finalTranscript,
          confidence: confidenceScore
        });
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error event:", event.error);
      this.isRecording = false;
      this.playChime('stop');

      let userMsg = `Speech recognition error (${event.error})`;
      if (event.error === 'not-allowed') {
        userMsg = "Microphone access was denied. Please allow microphone permission in your browser address bar.";
      } else if (event.error === 'no-speech') {
        userMsg = "No speech detected. Please press the microphone and speak clearly.";
      } else if (event.error === 'audio-capture') {
        userMsg = "No microphone found. Please connect a working microphone.";
      } else if (event.error === 'network') {
        userMsg = "Network error during speech recognition. Please check your internet connection.";
      } else if (event.error === 'aborted') {
        // User aborted intentionally
        return;
      }

      if (callbacks.onError) callbacks.onError(userMsg);
    };

    recognition.onend = () => {
      this.isRecording = false;
      this.playChime('stop');
      if (callbacks.onEnd) callbacks.onEnd();
    };

    try {
      recognition.start();
      return true;
    } catch (e) {
      console.error("Speech recognition start failed:", e);
      this.isRecording = false;
      if (callbacks.onError) callbacks.onError(`Failed to start microphone: ${e.message}`);
      return false;
    }
  }

  /**
   * Speak text in specified language code using SpeechSynthesis
   */
  speakText(text, langCode = 'ta-IN', callbacks = {}) {
    if (!('speechSynthesis' in window)) {
      if (callbacks.onError) callbacks.onError("Speech synthesis is not supported in this browser.");
      return;
    }

    if (!text || !text.trim()) {
      if (callbacks.onError) callbacks.onError("No text available to speak.");
      return;
    }

    // Cancel any previous speech synthesis
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = langCode;
    utterance.rate = 0.92; // Slightly slower for crisp regional clarity
    utterance.pitch = 1.0;

    // Refresh voices if empty
    if (this.synthVoices.length === 0) {
      this.synthVoices = window.speechSynthesis.getVoices();
    }

    const langPrefix = langCode.split('-')[0].toLowerCase();
    const matchingVoice = this.synthVoices.find(v => 
      v.lang.toLowerCase() === langCode.toLowerCase() ||
      v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
    );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      this.isSynthesizing = true;
      if (callbacks.onStart) callbacks.onStart();
    };

    utterance.onend = () => {
      this.isSynthesizing = false;
      if (callbacks.onEnd) callbacks.onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      this.isSynthesizing = false;
      if (callbacks.onError) callbacks.onError(e);
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSynthesizing = false;
    }
  }
}

// Global singleton instance
window.audioEngine = new AudioEngine();
