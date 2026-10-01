/**
 * AI Voice Translator - Multi-language Metadata & Real Translation Pipeline
 * Connects directly to real translation services (Zero hardcoded or fake translations)
 */

const LANGUAGES_DATA = {
  "en-IN": {
    code: "en-IN",
    langKey: "en",
    name: "English",
    native: "English",
    badge: "Global Lingua Franca • 150M+ in India",
    sampleGreeting: "Hello! How can I assist you today?",
    accentColor: "#3B82F6",
    latency: "148ms",
    dialects: ["Indian Standard English", "Global Standard", "Metro Colloquial"]
  },
  "ta-IN": {
    code: "ta-IN",
    langKey: "ta",
    name: "Tamil",
    native: "தமிழ்",
    badge: "Dravidian • 85M+ Speakers",
    sampleGreeting: "வணக்கம்! நீங்கள் எப்படி இருக்கிறீர்கள்?",
    accentColor: "#F59E0B",
    latency: "192ms",
    dialects: ["Madurai", "Chennai (Madras)", "Coimbatore (Kongu)", "Tirunelveli", "Jaffna"]
  },
  "hi-IN": {
    code: "hi-IN",
    langKey: "hi",
    name: "Hindi",
    native: "हिन्दी",
    badge: "Indo-Aryan • 600M+ Speakers",
    sampleGreeting: "नमस्ते! आज मैं आपकी क्या सहायता कर सकता हूँ?",
    accentColor: "#EF4444",
    latency: "174ms",
    dialects: ["Khariboli (Standard)", "Awadhi", "Braj", "Hinglish"]
  },
  "te-IN": {
    code: "te-IN",
    langKey: "te",
    name: "Telugu",
    native: "తెలుగు",
    badge: "Dravidian • 96M+ Speakers",
    sampleGreeting: "నమస్కారం! మీరు ఎలా ఉన్నారు?",
    accentColor: "#10B981",
    latency: "198ms",
    dialects: ["Coastal Andhra", "Rayalaseema", "Telangana", "Uttarandhra"]
  },
  "ml-IN": {
    code: "ml-IN",
    langKey: "ml",
    name: "Malayalam",
    native: "മലയാളം",
    badge: "Dravidian • 38M+ Speakers",
    sampleGreeting: "നമസ്കാരം! നിങ്ങൾക്ക് സുഖമാണോ?",
    accentColor: "#8B5CF6",
    latency: "214ms",
    dialects: ["Central Travancore", "Malabar", "Kochi", "Wayanad"]
  },
  "kn-IN": {
    code: "kn-IN",
    langKey: "kn",
    name: "Kannada",
    native: "ಕನ್ನಡ",
    badge: "Dravidian • 50M+ Speakers",
    sampleGreeting: "ನಮಸ್ಕಾರ! ನೀವು ಹೇಗಿದ್ದೀರಿ?",
    accentColor: "#EC4899",
    latency: "205ms",
    dialects: ["Old Mysore", "North Karnataka", "Mangaluru (Coastal)"]
  },
  "mr-IN": {
    code: "mr-IN",
    langKey: "mr",
    name: "Marathi",
    native: "मराठी",
    badge: "Indo-Aryan • 83M+ Speakers",
    sampleGreeting: "नमस्कार! आपण कसे आहात?",
    accentColor: "#F97316",
    latency: "189ms",
    dialects: ["Puneri (Standard)", "Nagpuri", "Konkani-influenced"]
  },
  "bn-IN": {
    code: "bn-IN",
    langKey: "bn",
    name: "Bengali",
    native: "বাংলা",
    badge: "Indo-Aryan • 100M+ in India",
    sampleGreeting: "নমস্কার! আপনি কেমন আছেন?",
    accentColor: "#06B6D4",
    latency: "195ms",
    dialects: ["Rarhi (Kolkata Standard)", "Varendra", "Manbhumi"]
  }
};

/**
 * Suggested conversation starter prompts for quick testing.
 * Note: These are input suggestions only. All translations are dynamically generated in real time.
 */
const SAMPLE_PROMPT_PILLS = [
  { label: "Java Programming", prompt: "What is Java programming and where is it useful?" },
  { label: "Greeting", prompt: "Good morning, how are you?" },
  { label: "Daily Routine", prompt: "I am going to college today." },
  { label: "Railway Directions", prompt: "Where is the nearest railway station?" },
  { label: "Explain AI", prompt: "Can you explain artificial intelligence?" }
];

/**
 * Interactive Conversational Scenarios
 * Dynamic dialogue prompts (Translations are executed live via real translation pipeline)
 */
const INTERACTIVE_SCENARIOS = [
  {
    id: "doctor-patient",
    title: "Healthcare: Doctor & Patient",
    speakerA: { lang: "en-IN", role: "Doctor (Consultation)" },
    speakerB: { lang: "ta-IN", role: "Patient (Tamil)" },
    prompts: [
      { from: "A", text: "Hello, since when have you been having fever and headache?" },
      { from: "B", text: "வணக்கம் டாக்டர், எனக்கு மூன்று நாட்களாக கடுமையான காய்ச்சல் உள்ளது." },
      { from: "A", text: "Do not worry, please rest and take these medicines twice daily after meals." },
      { from: "B", text: "நன்றி டாக்டர், உணவு சாப்பிட்ட பிறகு இந்த மாத்திரைகளை எடுக்க வேண்டுமா?" }
    ]
  },
  {
    id: "travel-auto",
    title: "Travel: Directions & Transport",
    speakerA: { lang: "en-IN", role: "Traveler" },
    speakerB: { lang: "ta-IN", role: "Local Guide / Driver" },
    prompts: [
      { from: "A", text: "Excuse me, how can I reach the central railway station from here?" },
      { from: "B", text: "நீங்கள் மெட்ரோ நீல வழித்தடத்தை எடுக்கலாம், பதினைந்து நிமிடங்கள் ஆகும்." },
      { from: "A", text: "Can I pay for the ticket using online UPI?" }
    ]
  },
  {
    id: "tech-interview",
    title: "Tech: Software Engineering",
    speakerA: { lang: "en-IN", role: "Engineering Lead" },
    speakerB: { lang: "ta-IN", role: "Developer" },
    prompts: [
      { from: "A", text: "What is Java programming and where is it useful?" },
      { from: "B", text: "ஜாவா என்பது பாதுகாப்பான மற்றும் பரவலாக பயன்படுத்தப்படும் கணினி நிரலாக்க மொழியாகும்." },
      { from: "A", text: "Can you explain artificial intelligence?" }
    ]
  }
];

/**
 * REAL TRANSLATION PIPELINE
 * Queries the real translation engine with zero hardcoded mappings or demo responses.
 */
async function realTranslate(text, sourceLangCode, targetLangCode) {
  if (!text || !text.trim()) {
    throw new Error("No speech or text provided to translate.");
  }

  const cleanText = text.trim();
  const sl = (sourceLangCode || 'en').split('-')[0].toLowerCase();
  const tl = (targetLangCode || 'ta').split('-')[0].toLowerCase();

  // If source and target are identical
  if (sl === tl) {
    return {
      translatedText: cleanText,
      sourceLang: sl,
      targetLang: tl,
      latencyMs: 15
    };
  }

  const startTime = Date.now();
  let translatedText = '';

  // Pipeline 1: Check if served from local/production server with /api/translate endpoint
  try {
    const serverUrl = `/api/translate?text=${encodeURIComponent(cleanText)}&source=${sl}&target=${tl}`;
    const sRes = await fetch(serverUrl, { signal: AbortSignal.timeout(7000) });
    if (sRes.ok) {
      const data = await sRes.json();
      if (data && data.translatedText) {
        translatedText = data.translatedText;
      }
    }
  } catch (sErr) {
    // Server endpoint not reachable or timed out, fallback to direct browser fetch
  }

  // Pipeline 2: Direct Google Translate endpoint with CORS support
  if (!translatedText) {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(cleanText)}`;
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(7000) });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData) && Array.isArray(gData[0])) {
          translatedText = gData[0].map(item => item[0]).join('');
        }
      }
    } catch (gErr) {
      console.warn("Direct Google translation attempt failed:", gErr);
    }
  }

  // Pipeline 3: Direct MyMemory API fallback
  if (!translatedText) {
    try {
      const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${sl}|${tl}`;
      const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(7000) });
      if (mmRes.ok) {
        const mmData = await mmRes.json();
        if (mmData && mmData.responseData && mmData.responseData.translatedText) {
          translatedText = mmData.responseData.translatedText;
        }
      }
    } catch (mmErr) {
      console.warn("MyMemory translation fallback failed:", mmErr);
    }
  }

  // If translation failed completely, throw REAL error (NO fake translation!)
  if (!translatedText || !translatedText.trim()) {
    throw new Error("Translation failed: Unable to reach translation services. Please check your internet connection.");
  }

  const latencyMs = Date.now() - startTime;
  return {
    translatedText: translatedText.trim(),
    sourceLang: sl,
    targetLang: tl,
    latencyMs: latencyMs
  };
}

// Export to window
window.LANGUAGES_DATA = LANGUAGES_DATA;
window.SAMPLE_PROMPT_PILLS = SAMPLE_PROMPT_PILLS;
window.INTERACTIVE_SCENARIOS = INTERACTIVE_SCENARIOS;
window.realTranslate = realTranslate;
