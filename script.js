import { initializeChatUI } from "./chat-ui.js";
import { initializeProjectCarousel } from "./project-carousel.js";
import { IN_SCOPE, buildKnowledgeItems, prepareTurn, answerTurn, recordTurn } from "./assistant-policy.js";
import { renderAnswerCard } from "./answer-card.js";

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const SUPABASE_URL = "https://pzdienjoskoxzwsxvvst.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KDfyIuGUj_o4yVoC6K-8hA_R1g29rYE";

const hasSupabaseConfiguration =
  SUPABASE_URL !== "PASTE_MY_PROJECT_URL_HERE" &&
  SUPABASE_PUBLISHABLE_KEY !== "PASTE_MY_PUBLISHABLE_KEY_HERE";
let supabaseClientPromise = null;

// The client loads on the first data request so the CDN download never delays
// rendering the resume.
function getSupabase() {
  if (!hasSupabaseConfiguration) return Promise.resolve(null);
  supabaseClientPromise ??= import("https://esm.run/@supabase/supabase-js@2")
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY))
    .catch((error) => {
      supabaseClientPromise = null;
      throw error;
    });
  return supabaseClientPromise;
}

let engine = null;
let modelLoadingPromise = null;
let isGenerating = false;
let cachedProjects = null;
let projectFetchPromise = null;
let projectDataStatus = "unloaded";
let cachedSkills = null;
let skillsFetchPromise = null;
let skillDataStatus = "unloaded";
let cachedExperience = null;
let experienceFetchPromise = null;
let experienceDataStatus = "unloaded";

const messages = [];
const modelProgressListeners = new Set();

async function fetchPublicProjects() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase project fetch skipped because the Project URL or publishable key is missing."
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_public", true)
    .order("project_date", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function getProjects() {
  if (cachedProjects !== null) {
    console.log("Using cached project data");
    return { projects: cachedProjects, status: projectDataStatus };
  }

  if (!projectFetchPromise) {
    projectFetchPromise = fetchPublicProjects()
      .then((projects) => {
        cachedProjects = projects;
        projectDataStatus = "available";
        console.log(`Supabase projects loaded: ${projects.length}`);
        return { projects, status: projectDataStatus };
      })
      .catch((error) => {
        console.error("Supabase project fetch failed:", error);
        cachedProjects = [];
        projectDataStatus = "unavailable";
        return { projects: cachedProjects, status: projectDataStatus };
      })
      .finally(() => {
        projectFetchPromise = null;
      });
  }

  return projectFetchPromise;
}

async function fetchPublicSkills() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase skill fetch skipped because the Project URL or publishable key is missing."
    );
  }

  const { data, error } = await supabase
    .from("skills")
    .select("name, category, proficiency, description, display_order")
    .eq("is_public", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function getSkills() {
  if (cachedSkills !== null) {
    console.log("Using cached skill data");
    return { skills: cachedSkills, status: skillDataStatus };
  }

  if (!skillsFetchPromise) {
    skillsFetchPromise = fetchPublicSkills()
      .then((skills) => {
        cachedSkills = skills;
        skillDataStatus = "available";
        console.log(`Supabase skills loaded: ${skills.length}`);
        return { skills, status: skillDataStatus };
      })
      .catch((error) => {
        console.error("Supabase skill fetch failed:", error);
        cachedSkills = [];
        skillDataStatus = "unavailable";
        return { skills: cachedSkills, status: skillDataStatus };
      })
      .finally(() => {
        skillsFetchPromise = null;
      });
  }

  return skillsFetchPromise;
}

async function fetchPublicExperience() {
  const supabase = await getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase experience fetch skipped because the Project URL or publishable key is missing."
    );
  }

  const { data, error } = await supabase
    .from("experience")
    .select(
      "company, role, location, start_date, end_date, is_current, summary, responsibilities, technologies, experience_type, display_order"
    )
    .eq("is_public", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function getExperience() {
  if (cachedExperience !== null) {
    console.log("Using cached experience data");
    return {
      experience: cachedExperience,
      status: experienceDataStatus,
    };
  }

  if (!experienceFetchPromise) {
    experienceFetchPromise = fetchPublicExperience()
      .then((experience) => {
        cachedExperience = experience;
        experienceDataStatus = "available";
        console.log(`Supabase experience loaded: ${experience.length}`);
        return { experience, status: experienceDataStatus };
      })
      .catch((error) => {
        console.error("Supabase experience fetch failed:", error);
        cachedExperience = [];
        experienceDataStatus = "unavailable";
        return {
          experience: cachedExperience,
          status: experienceDataStatus,
        };
      })
      .finally(() => {
        experienceFetchPromise = null;
      });
  }

  return experienceFetchPromise;
}

async function getOrCreateEngine(onProgress) {
  if (engine) return engine;

  if (onProgress) modelProgressListeners.add(onProgress);

  if (!modelLoadingPromise) {
    console.log("Starting Llama 3.2 1B...");
    console.log("MODEL_ID", MODEL_ID);
    modelLoadingPromise = import("https://esm.run/@mlc-ai/web-llm")
      .then(({ CreateMLCEngine }) => CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (progress) => {
          console.log("Loading:", progress);
          modelProgressListeners.forEach((listener) => listener(progress));
        },
      }))
      .then((createdEngine) => {
        engine = createdEngine;
        console.log("Model loaded!");
        return engine;
      })
      .catch((error) => {
        modelLoadingPromise = null;
        throw error;
      });
  }

  try {
    return await modelLoadingPromise;
  } finally {
    if (onProgress) modelProgressListeners.delete(onProgress);
  }
}

const resumeData = {
  // Source of truth: SUJAL_SHAKYA_RESUME.pdf (October 2026). Skills and projects
  // that only appear on the website are kept until they are confirmed outdated.
  skills: [
    {
      group: "Programming Languages",
      items: ["C++", "Python", "Java", "Swift", "JavaScript", "TypeScript", "SQL", "Bash"],
    },
    {
      group: "Frontend & Mobile",
      items: ["React", "Next.js", "Angular", "React Native", "Expo", "Tailwind CSS", "HTML", "CSS"],
    },
    {
      group: "Backend & Databases",
      items: [
        "Django",
        "Django REST Framework",
        ".NET",
        "REST APIs",
        "JWT Authentication",
        "PostgreSQL",
        "Supabase",
        "Database Management",
      ],
    },
    {
      group: "Testing",
      items: ["JUnit", "Pytest", "Playwright", "Postman", "API Testing", "Integration Testing"],
    },
    {
      group: "Cloud, DevOps & Tools",
      items: [
        "Git & GitHub",
        "Docker",
        "GitHub Actions",
        "CI/CD",
        "Linux",
        "AWS",
        "Google Cloud Platform",
        "VS Code",
        "Cursor",
      ],
    },
    {
      group: "AI Engineering",
      items: ["LLM APIs", "Gemini API", "AI-Assisted Development", "RAG Fundamentals"],
    },
    {
      group: "Core Competencies",
      items: [
        "Object-Oriented Programming",
        "Data Structures & Algorithms",
        "Software Testing",
        "Debugging",
        "Full-Stack Development",
      ],
    },
    {
      group: "Spoken Languages",
      items: ["English (Advanced)", "Nepali (Native)", "Hindi (Advanced)", "Korean (Beginner)"],
    },
  ],
  experience: [
    {
      role: "Mobile Application Tester",
      company: "M Eaton Trucking LLC",
      context: "University Client Project",
      location: "Mankato, MN",
      date: "Aug 2026 – Dec 2026",
      technologies: ["Expo React Native", "Django REST APIs", "PostgreSQL"],
      points: [
        "Tested and troubleshot an Expo React Native mobile application integrated with Django REST APIs and PostgreSQL, including authentication issues.",
        "Expanded automated testing from 101 to 275 tests across 26 test suites, increasing branch coverage from 40.80% to 79.48% and exceeding the 70% target.",
        "Identified and documented 8 reproducible software defects, including security, authentication, and mobile functionality issues.",
        "Collaborated with the development team to identify technical issues and prepare the application for real-world deployment.",
      ],
    },
    {
      role: "Annual Giving Engagement Manager",
      company: "Minnesota State University, Mankato",
      location: "Mankato, MN",
      date: "Sept 2023 – May 2028",
      points: [
        "Manage student engagement ambassadors responsible for connecting with alumni and supporting university fundraising initiatives.",
        "Supervised 25 student ambassadors overall and 12 callers per shift, monitoring 1,000+ alumni calls and improving outreach performance.",
        "Trained 30+ new ambassadors, improving call and donor engagement rates.",
        "Develop leadership, communication, and problem-solving skills through team supervision and alumni relationship management.",
      ],
    },
  ],
  leadership: [
    {
      role: "President",
      organization: "Nepalese Student Community (NeStCom)",
      context: "Minnesota State University, Mankato · Recognized Student Organization",
      date: "Aug 2025 – Aug 2026",
      points: [
        "Led a recognized student organization representing 200+ student members, promoting cultural diversity, student engagement, and community.",
        "Coordinated and supported 3+ cultural and community events, strengthening student participation and cultural awareness.",
        "Collaborated with university departments, student organizations, and executive board members to organize events and manage logistics.",
      ],
    },
  ],
  projects: [
    {
      title: "Reflection Journal Web Application",
      context: "Personal project",
      date: "Nov 2026",
      description:
        "A responsive web application that organizes academic reflections by class and topic. I implemented creating, editing, and managing reflection entries, persisted them in browser local storage without a backend database, and built a mobile-friendly interface prepared for deployment through Vercel.",
      tags: ["React", "TypeScript", "Vite", "Tailwind CSS", "React Router", "Local Storage"],
      liveUrl: "https://reflection-flax.vercel.app/classes",
      image: "assets/images/projects/reflection-journal-card.webp",
      imageAlt: "Reflection Journal home screen with a weekly streak, reflection totals, and today's tasks",
    },
    {
      title: "AI-Powered Digital Resume & Personal Portfolio",
      context: "Personal project",
      date: "Sept 2026 – Oct 2026",
      description:
        "A responsive AI-powered portfolio with a browser-based assistant that uses WebLLM and WebGPU to answer questions about my technical skills, education, experience, projects, and qualifications. I integrated Supabase for dynamic data retrieval and context-aware responses, used GitHub for version control, and deployed it on Vercel.",
      tags: ["HTML", "CSS", "JavaScript", "WebLLM", "WebGPU", "Llama 3.2", "Supabase", "Vercel"],
      githubUrl: "https://github.com/SUJALSHK/Digital-Resume",
      liveUrl: "https://resume.sujalshakya.com/",
      image: "assets/images/projects/digital-resume-card.webp",
      imageAlt: "Sujal Shakya's digital resume with the Ask about Sujal assistant beside it",
    },
    {
      title: "Ghost Student Prevention System",
      context: "Hackathon project",
      date: "Aug 2025",
      description:
        "A student engagement monitoring system that analyzes CSV datasets to identify students at risk of disengagement. I collaborated on the system and integrated Google's Gemini API for AI-powered engagement analysis, with automated email notifications to support early intervention.",
      tags: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Gemini API", "CSV Processing", "Nodemailer"],
    },
    {
      title: "Developer Portfolio",
      description:
        "A responsive portfolio that gives recruiters one accessible place to explore my background, projects, and resume. I built the project gallery, keyboard-friendly carousel, optimized image loading, SEO metadata, validation scripts, and automated GitHub Pages deployment.",
      tags: ["HTML5", "CSS3", "JavaScript", "GitHub Actions"],
      githubUrl: "https://github.com/SUJALSHK/sujals-portfolio",
      liveUrl: "https://sujalshakya.com/",
      image: "assets/images/projects/developer-portfolio.webp",
      imageAlt: "Sujal Shakya's developer portfolio homepage",
    },
    {
      title: "Amazon Storefront Clone",
      description:
        "A frontend recreation of Amazon's storefront that translates a familiar e-commerce layout into reusable navigation, search, hero, product-grid, and footer sections. I implemented the page structure, Flexbox-based layout, product cards, hover states, and Font Awesome icon integration.",
      tags: ["HTML5", "CSS3", "Flexbox", "Font Awesome"],
      githubUrl: "https://github.com/SUJALSHK/amazon-clone-sujal",
      liveUrl: "https://sujalshk.github.io/amazon-clone-sujal/",
      image: "assets/images/projects/amazon-clone-card.webp",
      imageAlt: "Amazon storefront clone showing navigation, a product hero, and category cards",
    },
    {
      title: "Rock Paper Scissors",
      description:
        "An interactive browser game that turns a classic matchup into an event-driven JavaScript experience. I implemented randomized computer moves, conditional winner evaluation, score state, DOM updates, and immediate visual feedback for each round.",
      tags: ["HTML5", "CSS3", "JavaScript", "DOM APIs"],
      githubUrl: "https://github.com/SUJALSHK/ROCK_PAPER_SCISSOR-",
      liveUrl: "https://sujalshk.github.io/ROCK_PAPER_SCISSOR-/",
      image: "assets/images/projects/rock-paper-scissors.webp",
      imageAlt: "Rock Paper Scissors game interface with three choices and a score board",
    },
    {
      title: "Cybersecurity Python Toolkit",
      description:
        "A learning-focused collection of command-line security utilities for exploring practical security fundamentals. I built substitution-cipher encryption and decryption, SHA-256 credential verification, password generation, and a TCP port scanner with input validation and socket timeouts.",
      tags: ["Python", "Sockets", "SHA-256", "CLI Tools"],
      githubUrl: "https://github.com/SUJALSHK/CyberSecutity",
      image: "assets/images/projects/cybersecurity-repository-card.webp",
      imageAlt: "GitHub repository preview for the Cybersecurity Python Toolkit",
    },
  ],
  education: [
    {
      school: "Minnesota State University, Mankato",
      program: "Bachelor of Science in Computer Science",
      date: "2024 - Present",
      expectedGraduation: "May 2028",
      details: [
        {
          label: "Academic Focus",
          text: "Software Engineering, Full-Stack Development, Mobile Development, Databases, Artificial Intelligence",
        },
        {
          label: "Relevant Coursework",
          text: "Data Structures & Algorithms, Operating Systems, Discrete Mathematics, Linear Algebra, Software Engineering, Computer Systems",
        },
      ],
    },
  ],
  certifications: [],
  contact: [
    {
      label: "Email",
      value: "sujal.shakya@mnsu.edu",
      icon: "@",
      href: "mailto:sujal.shakya@mnsu.edu",
    },
    {
      label: "LinkedIn",
      value: "linkedin.com/in/sujal-shakya-77764a2ba",
      icon: "in",
      href: "https://www.linkedin.com/in/sujal-shakya-77764a2ba/",
    },
    {
      label: "GitHub",
      value: "github.com/SUJALSHK",
      icon: "GH",
      href: "https://github.com/SUJALSHK",
    },
    {
      label: "Phone",
      value: "(612) 463-5841",
      icon: "PH",
      href: "tel:+16124635841",
    },
    {
      label: "Location",
      value: "Mankato, Minnesota",
      icon: "LC",
      href: "",
    },
  ],
  suggestions: [
    "Tell me about Sujal",
    "What are his skills?",
    "Show me his best projects",
    "What experience does he have?",
  ],
};

const root = document.documentElement;
const themeToggle = document.querySelector(".theme-toggle");
const menuToggle = document.querySelector(".menu-toggle");
const profileLinks = document.querySelector("#profileLinks");
const assistantInput = document.querySelector(".assistant-input textarea");
const assistantSendButton = document.querySelector(".assistant-input button");
const chatWindow = document.querySelector(".chat-window");

const chatUI = initializeChatUI();

function toggleTheme() {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} theme`);
  try { localStorage.setItem("resume-theme", nextTheme); } catch { /* Private browsing can disable storage. */ }
}
themeToggle.setAttribute("aria-label", `Switch to ${root.dataset.theme === "dark" ? "light" : "dark"} theme`);

function toggleMenu() {
  const isOpen = profileLinks.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function closeMenu() {
  profileLinks.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

const externalIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>';

function renderSkills() {
  document.querySelector("#skillGroups").innerHTML = resumeData.skills.map((group) => `
    <div class="skill-group">
      <dt>${group.group}</dt>
      <dd><ul class="chip-list clean-list">${group.items.map((item) => `<li class="chip">${item}</li>`).join("")}</ul></dd>
    </div>
  `).join("");
}

// Shared by experience and leadership: role, dates, organization line and points.
function roleCard({ title, date, organization, details, points, technologies }) {
  return `
    <li class="experience-item">
      <div class="item-heading"><h3>${title}</h3><span class="item-date">${date}</span></div>
      <p class="item-org">${organization}</p>
      ${details ? `<p class="item-context">${details}</p>` : ""}
      <ul class="experience-points">${points.map((point) => `<li>${point}</li>`).join("")}</ul>
      ${technologies?.length ? `<ul class="chip-list chip-list-small clean-list item-tech" aria-label="Technologies">${technologies.map((tech) => `<li class="chip">${tech}</li>`).join("")}</ul>` : ""}
    </li>
  `;
}

function renderExperience() {
  document.querySelector("#experienceList").innerHTML = resumeData.experience.map((job) => roleCard({
    title: job.role,
    date: job.date,
    organization: job.company,
    details: [job.context, job.location].filter(Boolean).join(" · "),
    points: job.points,
    technologies: job.technologies,
  })).join("");
}

function renderLeadership() {
  document.querySelector("#leadershipList").innerHTML = resumeData.leadership.map((role) => roleCard({
    title: role.role,
    date: role.date,
    organization: role.organization,
    details: role.context,
    points: role.points,
  })).join("");
}

function renderProjects() {
  document.querySelector("#projectList").innerHTML = resumeData.projects.map((project) => `
    <div class="project-card">
      <div class="project-media${project.image ? "" : " project-media-empty"}">
        ${project.image
          ? `<img src="${project.image}" alt="${project.imageAlt}" loading="lazy" decoding="async" width="640" height="400" />`
          : `<span class="project-monogram" aria-hidden="true">${project.title.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span>`}
      </div>
      <div class="project-body">
        ${project.date ? `<p class="project-meta">${[project.context, project.date].filter(Boolean).join(" · ")}</p>` : ""}
        <h3>${project.title}</h3>
        <p class="project-description">${project.description.split(/(?<=\.)\s/)[0]}</p>
        <ul class="chip-list chip-list-small clean-list" aria-label="Technologies">${project.tags.map((tag) => `<li class="chip">${tag}</li>`).join("")}</ul>
        <div class="project-actions">
          ${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" aria-label="Live site for ${project.title}, opens in a new tab">Live site ${externalIcon}</a>` : ""}
          ${project.githubUrl ? `<a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" aria-label="Source for ${project.title}, opens in a new tab">Source ${externalIcon}</a>` : ""}
        </div>
      </div>
    </div>
  `).join("");
}

function renderEducation() {
  document.querySelector("#educationList").innerHTML = resumeData.education.map((item) => `
    <article class="education-entry">
      <div class="education-heading">
        <div>
          <h3>${item.program}</h3>
          <p class="item-org">${item.school}</p>
        </div>
        <span class="item-date">${item.expectedGraduation ? `Expected graduation: ${item.expectedGraduation}` : item.date}</span>
      </div>
      ${item.summary ? `<p class="education-summary">${item.summary}</p>` : ""}
      ${item.technologies ? `<ul class="chip-list chip-list-small clean-list" aria-label="Project technologies">${item.technologies.map((tech) => `<li class="chip">${tech}</li>`).join("")}</ul>` : ""}
      <dl class="education-details">
        ${item.details.map((detail) => `<div><dt>${detail.label}</dt><dd>${detail.text}</dd></div>`).join("")}
      </dl>
    </article>
  `).join("");
}

function renderCertifications() {
  const certificationSection = document.querySelector("#certifications");
  const certificationList = document.querySelector("#certificationList");

  if (!certificationSection || !certificationList) return;

  certificationSection.hidden = resumeData.certifications.length === 0;

  certificationList.innerHTML = resumeData.certifications
    .map(
      (item) => `
        <article class="certification-entry">
          <span class="item-date">${item.date}</span>
          <h3>${item.title}</h3>
          <h4>${item.issuer}</h4>
          <p>Credential detail placeholder.</p>
          <a href="#" data-placeholder-link>Credential Link</a>
        </article>
      `
    )
    .join("");
}

function renderContact() {
  document.querySelector("#contactGrid").innerHTML = resumeData.contact.map((item) => `
    <div class="contact-item"><dt>${item.label}</dt><dd>${item.href
      ? `<a href="${item.href}" ${item.href.startsWith("http") ? 'target="_blank" rel="noopener noreferrer"' : ""}>${item.value}</a>`
      : item.value}</dd></div>
  `).join("");
}

function renderSuggestions() {
  const suggestionList = document.querySelector("#suggestionList");

  suggestionList.innerHTML = resumeData.suggestions
    .map((question) => `<button type="button">${question}</button>`)
    .join("");

  suggestionList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      assistantInput.value = button.textContent;
      assistantInput.focus();
    });
  });
}

function scrollChatToLatest() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendChatMessage(content, role, isStatus = false) {
  if (role === "user") chatUI.beginMessage();
  const message = document.createElement("div");
  message.className = `chat-message ${role === "user" ? "user-message" : "assistant-message"}`;
  message.textContent = content;

  if (isStatus) {
    message.classList.add("status-message");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
  }

  chatWindow.appendChild(message);
  scrollChatToLatest();
  return message;
}

function setStatusMessage(statusMessage, content) {
  statusMessage.textContent = content;
  scrollChatToLatest();
}

function setChatBusy(isBusy) {
  isGenerating = isBusy;
  assistantSendButton.disabled = isBusy;
  assistantInput.setAttribute("aria-busy", String(isBusy));
}

function modelLoadingText(progress) {
  chatUI.setProgress(progress);
  const percentage = Math.round(Number(progress?.progress) * 100);
  return Number.isFinite(percentage)
    ? `Loading AI model... ${Math.min(100, Math.max(0, percentage))}%`
    : "Loading AI model...";
}

function currentKnowledge(projectData, skillData, experienceData) {
  return buildKnowledgeItems({
    projects: projectData?.projects || cachedProjects || [],
    skills: skillData?.skills || cachedSkills || [],
    experience: experienceData?.experience || cachedExperience || [],
    resume: resumeData,
    status: {
      projects: projectData?.status || (projectDataStatus === "available" ? "available" : "unavailable"),
      skills: skillData?.status || (skillDataStatus === "available" ? "available" : "unavailable"),
      experience: experienceData?.status || (experienceDataStatus === "available" ? "available" : "unavailable"),
    },
  });
}

function askFollowUp(question) {
  if (isGenerating) return;
  assistantInput.value = question;
  sendChatMessage();
}

// Source links scroll the page to the section; on phones the sheet closes first.
function showSource(href) {
  chatUI.closeSheet();
  document.querySelector(href)?.scrollIntoView({ block: "start" });
}

function appendAnswer(answer) {
  chatWindow.appendChild(renderAnswerCard(answer.card, { onFollowUp: askFollowUp, onSource: showSource }));
  scrollChatToLatest();
}

async function sendChatMessage() {
  if (isGenerating) return;
  const content = assistantInput.value.trim();
  if (!content) return;

  setChatBusy(true);
  appendChatMessage(content, "user");
  assistantInput.value = "";
  let statusMessage;

  try {
    let knowledgeItems = currentKnowledge();
    let turn = prepareTurn(content, messages, knowledgeItems);
    if (turn.scope === IN_SCOPE) {
      statusMessage = appendChatMessage("Checking Sujal's resume...", "assistant", true);
      const [projectData, skillData, experienceData] = await Promise.all([
        getProjects(), getSkills(), getExperience(),
      ]);
      chatUI.showDataStatus([projectData.status, skillData.status, experienceData.status]);
      knowledgeItems = currentKnowledge(projectData, skillData, experienceData);
      turn = prepareTurn(content, messages, knowledgeItems);
    }

    // The gate runs before model import, loading, or inference. The model only
    // selects record ids; the answer card is composed from the records.
    const assistantResponse = await answerTurn(turn, messages, knowledgeItems, async () => {
      if (!navigator.gpu) throw new Error("WebGPU unavailable; using resume records.");
      setStatusMessage(statusMessage, engine ? "Thinking..." : "Loading AI model...");
      const chatEngine = await getOrCreateEngine((progress) => {
        setStatusMessage(statusMessage, modelLoadingText(progress));
      });
      setStatusMessage(statusMessage, "Thinking...");
      return chatEngine;
    });

    statusMessage?.remove();
    appendAnswer(assistantResponse);
    recordTurn(messages, turn, assistantResponse.text);
  } finally {
    statusMessage?.remove();
    chatUI.finish(Boolean(engine));
    setChatBusy(false);
    assistantInput.focus();
  }
}

// Highlights the navigation link for the section currently in the reading zone.
function observeSections() {
  const links = new Map([...document.querySelectorAll(".section-links a")]
    .map((link) => [link.hash.slice(1), link]));
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link, id) => {
        if (id === entry.target.id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px" });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

function preventPlaceholderLinks() {
  document.querySelectorAll("[data-placeholder-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
  });
}

themeToggle.addEventListener("click", toggleTheme);
menuToggle.addEventListener("click", toggleMenu);
profileLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});
assistantSendButton.addEventListener("click", sendChatMessage);
assistantInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  sendChatMessage();
});

renderSkills();
renderExperience();
renderLeadership();
renderProjects();
initializeProjectCarousel();
renderEducation();
renderCertifications();
renderContact();
renderSuggestions();
preventPlaceholderLinks();
observeSections();

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && profileLinks.classList.contains("is-open")) {
    closeMenu();
    menuToggle.focus();
  }
});
