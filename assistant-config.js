// Tune scope, retrieval and generation here. Unsupported phrasing fails closed.
export const ASSISTANT_CONFIG = {
  retrieval: { minScore: 0.8, maxItems: 4, k1: 1.2, b: 0.75, phraseBoost: 3 },
  // The model writes the answer; every reply is checked against the records
  // before display (see checkProse). A failed reply is retried once, cooler.
  generation: { temperature: 0.3, top_p: 0.9, frequency_penalty: 0.3, max_tokens: 200, stream: false },
  retryGeneration: { temperature: 0.15 },
  // Llama 3.2 1B in WebLLM has a 4,096-token window; these keep prompts near 2,500.
  context: { factsPerRecord: 6, historyMessages: 4, historyChars: 500, maxPromptChars: 10000 },
  maxAnswerWords: 120,
  maxHistoryMessages: 6,
  maxQueryLength: 600,
  maxSentenceWords: 55,
  refusal: "I can only answer questions about Sujal Shakya's education, skills, projects, experience, and qualifications. Try asking about his projects, tech stack, or when he graduates.",
  missing: "The portfolio doesn't provide that information.",
  greeting: "Hello! Ask about Sujal's education, skills, projects, or experience.",
  thanks: "You're welcome! Ask anytime about Sujal's background and qualifications.",
  suggestions: [
    "What projects has Sujal worked on?",
    "What programming languages does Sujal know?",
    "When will he graduate?",
  ],
  greetings: /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|namaste|hola|bonjour|thanks|thank you|thank you very much|thanks a lot)[!.\s]*$/i,
  thanksPattern: /^(?:thanks|thank)/i,
  owner: /\b(?:sujal(?: shakya)?|he|him|his|the candidate|you|your|yourself)\b/i,
  introduction: /^(?:(?:please )?(?:tell me|what can you tell me|what do you know) about (?:sujal(?: shakya)?|yourself|him|the candidate)|who (?:is sujal(?: shakya)?|are you))(?:,?\s+(?:in (?:simple|plain|a few|few) words|briefly|in short|simply))?[?.!\s]*$/i,
  // Looser introductions ("tell us something about Sujal", "who's Sujal?"): a
  // cue and Sujal's name, with no other words than stop words and these.
  introductionCue: /\b(?:tell|about|who|introduce|describe)\b/i,
  introductionSubject: /\b(?:sujal|him|himself|the candidate|yourself)\b/i,
  // "A technology not listed in his portfolio" is answered with what is listed.
  notListed: /\b(?:not|isn't|aren't|never) (?:listed|mentioned|included|shown)\b/i,
  introductionWords:"something anything everything little bit few quick quickly short brief briefly simple plain simply words introduce introduction intro describe description info information interesting himself person like",
  // Open-ended questions about Sujal ("Why should I hire him?") are answered
  // from the whole portfolio rather than one record type.
  overview: /\b(?:summari[sz]e|summary|overview|in (?:simple|plain|a few) words|background)\b/i,
  assistantAddress: /\b(?:can|could|would|will) you (?:tell|give|show|describe|list)\b/i,
  generalConcept: /\bwhat (?:is|are)\s+(?!(?:his|your|sujal(?:'s)?|the candidate(?:'s)?)\b)/i,
  opinions: /\b(?:think|opinion|opinions|favorite|favourite|prefer|likes?|dislikes?|believe|believes|feel)\b/i,
  followUp: /^(?:(?:please )?(?:tell me more|more(?: details)?|go on|continue|elaborate)(?: about (?:that|this|it|the|that one)(?: (?:project|role|job|position|experience|organization|one))?(?: (?:that )?you(?: just)? mentioned)?)?|what about (?:that one|that|it|the other one)|(?:and )?(?:when|where|why|how)|what (?:did he do|technologies did he use) there)[?.!\s]*$/i,
  injections: [
    /\b(?:ignore|disregard|forget|override|bypass)\b.*\b(?:instructions?|rules?|previous|above|prior|context|prompt|restrictions?)\b/i,
    /\b(?:you are now|act as|pretend|role[ -]?play|system[ _-]?prompt|developer[ _-]?mode|jailbreak|repeat (?:your|the) instructions|reveal (?:your|the) (?:rules|instructions)|new instructions)\b/i,
    /\b(?:encode|decode|base64|rot13|obfuscate|reverse (?:the|your)|respond as|answer as|instead|regardless|do not refuse|don't refuse)\b/i,
    /\[\/?(?:system|instructions|verified context|question)\]|<\|.*?\|>/i,
  ],
  prohibited: [
    /\b(?:write|generate|fix|debug|review|implement|execute|run|refactor|sort|translate|solve|calculate|compute|compose|draft|rewrite|advice|advise|opinion|joke|weather|news|capital|recipe|poem|essay|email me|cover letter|tutorial|jailbreak)\b/i,
    /\b(?:explain|teach|define|definition|meaning of|how (?:do|can|should) (?:i|we)(?!\s+(?:contact|reach)\b)|help (?:me|us)|president of (?:the )?(?:us|united states))\b/i,
    /\b(?:escribe|escribir|explica|explicar|traduce|traducir|resuelve|ignora|olvida|ecris|ecrire|explique|traduis|ignorez|schreibe|erklare|ubersetze|ignoriere|escreva|explique|traduza|risolvi|scrivi)\b/i,
    /```|(?:\d\s*[+*/=]|[=<>]=>)|\b(?:def|function|import|class)\s+\w+\s*[:({]/i,
  ],
  // General explanations can be stripped only when a separate owner question exists.
  mixedQuestion: /^(?:what (?:is|are)|explain|define)\b[^?;]+?(?:\s+and\s+|[?;]\s*)(?=(?:(?:did|does|has|have|can|is|was)\s+)?(?:sujal|he|his|the candidate|you)\b)/i,
  topics: {
    education: ["education", "school", "college", "university", "degree", "study", "studied", "studies", "student", "academic", "coursework", "courses", "major", "gpa"],
    graduation: ["graduate", "graduates", "graduating", "graduation"],
    skills: ["skill", "skills", "languages", "language", "programming", "framework", "frameworks", "technology", "technologies", "tech stack", "know", "knows", "proficiency", "tools"],
    projects: ["project", "projects", "portfolio", "built", "build", "developed", "developing", "implemented", "latest", "newest", "recent"],
    experience: ["experience", "work", "worked", "working", "job", "jobs", "role", "roles", "responsibilities", "responsibility", "company", "employer", "intern", "internship", "internships", "qualifications", "background"],
    leadership: ["leadership", "leader", "president", "annual giving", "nepalese student community", "nestcom", "photography", "communications", "ambassador"],
    availability: ["availability", "available", "opportunities", "looking for", "seeking", "open to", "hiring", "relocate", "relocation"],
    contact: ["contact", "email", "reach", "linkedin", "github", "links", "link", "website", "resume", "download", "location"],
    certification: ["certification", "certifications", "certified", "certificate", "certificates", "credential", "credentials"],
    evaluation: ["hire", "hiring", "strength", "strengths", "strongest", "stand out", "different", "unique", "kind of developer", "type of developer", "suit", "suited", "fit", "learn", "learned", "learnt", "impressive", "real-world", "real world", "contribute", "candidate", "good at", "qualified", "summarize", "summarise", "summary", "overview"],
  },
  synonyms: {
    graduate: ["graduates", "graduating", "graduation"],
    education: ["degree", "school", "college", "studied", "coursework"],
    skills: ["skill", "know", "knows", "proficiency", "stack", "frameworks", "languages"],
    projects: ["project", "built", "developed", "portfolio"],
    experience: ["work", "worked", "role", "roles", "responsibilities", "internship", "internships"],
    leadership: ["leader", "president", "nestcom"],
    contact: ["reach", "email", "links", "download"],
    spoken: ["speak", "speaks"],
  },
  stopWords: "a an the s and or but about of to in on for from with as at by is are was were be been do does did has have had can could will would should may me i we us they them it its this that one more tell please what which who when where why how sujal shakya he him his you your yourself candidate yes no also",
  genericQueryWords: "s give show list describe professional best top all any some most recent use used using looking seeking want interested looking currently current still year years date dates there graduation graduate graduates graduating build built development software programming academic science computer student technical skill skills project projects experience experiences work leadership education languages speak speaks application applications app apps",
  // Non-ASCII requests are refused unless they are an exact canned greeting.
  unsupportedScript: /[^\x00-\x7F]/,
  codeOutput: /```|`|\b(?:def\s+\w+|function\s*\w*\s*\(|import\s+[\w{*]|from\s+\w+\s+import|class\s+\w+\s*(?:extends\b|\{)|console\.|print\s*\(|return\s+[^.]+;|const\s+\w+\s*=|let\s+\w+\s*=)|=>|<\/?(?:script|html|div)\b/i,
  firstPerson: /\b(?:i|i'm|i've|i'd|i'll|my|mine|we|we're|we've|our|ours)\b/i,
};
