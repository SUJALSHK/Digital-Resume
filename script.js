import { initializeChatUI } from "./chat-ui.js";
import { ASSISTANT_CONFIG } from "./assistant-config.js";
import { IN_SCOPE, OUT_OF_SCOPE, buildKnowledgeItems, prepareTurn, answerTurn, recordTurn } from "./assistant-policy.js";
import { createClient } from "https://esm.run/@supabase/supabase-js@2";

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const SUPABASE_URL = "https://pzdienjoskoxzwsxvvst.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KDfyIuGUj_o4yVoC6K-8hA_R1g29rYE";

const hasSupabaseConfiguration =
  SUPABASE_URL !== "PASTE_MY_PROJECT_URL_HERE" &&
  SUPABASE_PUBLISHABLE_KEY !== "PASTE_MY_PUBLISHABLE_KEY_HERE";
const supabase = hasSupabaseConfiguration
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

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
  if (!supabase) {
    throw new Error(
      "Supabase project fetch skipped because the Project URL or publishable key is missing."
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_public", true)
    .order("project_date", { ascending: false });

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
  skills: [
    {
      group: "Programming Languages",
      items: ["Python", "TypeScript", "JavaScript", "SQL", "C++"],
    },
    {
      group: "Frontend & Mobile",
      items: ["React", "Next.js", "React Native", "Tailwind CSS", "HTML/CSS"],
    },
    {
      group: "Backend & Data",
      items: [
        "Django",
        "Django REST Framework",
        "REST APIs",
        "PostgreSQL",
        "Database Design",
        "JWT Authentication",
      ],
    },
    {
      group: "Testing & Debugging",
      items: [
        "Pytest",
        "Playwright",
        "Postman",
        "API Testing",
        "Integration Testing",
        "Debugging",
      ],
    },
    {
      group: "DevOps & Cloud",
      items: ["Git & GitHub", "Docker", "GitHub Actions", "CI/CD", "Linux", "AWS"],
    },
    {
      group: "AI Engineering",
      items: ["LLM APIs", "Gemini API", "AI-Assisted Development", "RAG Fundamentals"],
    },
  ],
  experience: [
    {
      role: "Mobile Testing & Deployment",
      company: "M eathon Trucking Company",
      date: "2026",
      points: [
        "Tested mobile application features across different devices and screen sizes to identify usability, layout, and functionality issues.",
        "Documented defects, verified fixes, and supported deployment activities to help deliver stable mobile releases.",
      ],
    },
    {
      role: "Engagement Ambassador",
      company: "Minnesota State University, Mankato Alumni Foundation",
      date: "2023 - 2026",
      points: [
        "Built relationships with alumni and supporters through thoughtful outreach and engaging conversations.",
        "Represented the Alumni Foundation while sharing university updates and encouraging continued involvement with the campus community.",
      ],
    },
  ],
  projects: [
    {
      title: "Developer Portfolio",
      description:
        "A responsive portfolio that gives recruiters one accessible place to explore my background, projects, and resume. I built the project gallery, keyboard-friendly carousel, optimized image loading, SEO metadata, validation scripts, and automated GitHub Pages deployment.",
      tags: ["HTML5", "CSS3", "JavaScript", "GitHub Actions"],
      githubUrl: "https://github.com/SUJALSHK/sujals-portfolio",
      liveUrl: "https://sujalshakya.com/",
      image: "DeveloperPortfolio.png",
      imageAlt: "Sujal Shakya's developer portfolio homepage",
    },
    {
      title: "Amazon Storefront Clone",
      description:
        "A frontend recreation of Amazon's storefront that translates a familiar e-commerce layout into reusable navigation, search, hero, product-grid, and footer sections. I implemented the page structure, Flexbox-based layout, product cards, hover states, and Font Awesome icon integration.",
      tags: ["HTML5", "CSS3", "Flexbox", "Font Awesome"],
      githubUrl: "https://github.com/SUJALSHK/amazon-clone-sujal",
      liveUrl: "https://sujalshk.github.io/amazon-clone-sujal/",
      image: "assets/images/projects/amazon-clone.webp",
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
      image: "assets/images/projects/cybersecurity-repository.webp",
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
        {
          label: "Leadership",
          text: "President — Nepalese Student Community (NeStCom)",
        },
      ],
    },
    {
      school: "Upper-Division Software Engineering Project",
      program: "M Eaton Trucking LLC",
      date: "2026 - Present",
      summary: "Working on a production-oriented mobile application.",
      technologies: ["React Native", "Django REST Framework", "PostgreSQL"],
      details: [
        {
          label: "Focus Areas",
          text: "REST API integration, authentication, software testing, debugging, database interaction, mobile permissions, and deployment workflows",
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
      label: "Location",
      value: "Minnesota, United States",
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

function renderSkills() {
  document.querySelector("#skillGroups").innerHTML = resumeData.skills.map((group) => `
    <div class="skill-group"><dt>${group.group}</dt><dd>${group.items.join(", ")}</dd></div>
  `).join("");
}

function renderExperience() {
  document.querySelector("#experienceList").innerHTML = resumeData.experience.map((job) => `
    <li class="experience-item">
      <span class="item-date">${job.date}</span>
      <div class="experience-body">
        <h3>${job.role}</h3><h4>${job.company}</h4>
        <ul>${job.points.map((point) => `<li>${point}</li>`).join("")}</ul>
      </div>
    </li>
  `).join("");
}

function renderProjects() {
  document.querySelector("#projectList").innerHTML = resumeData.projects.map((project) => `
    <li class="project-item">
      <div class="project-heading">
        <h3>${project.title}</h3>
        <div class="project-actions">
          ${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${project.title} live">Live</a>` : ""}
          ${project.githubUrl ? `<a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${project.title} source">Source</a>` : ""}
        </div>
      </div>
      <p class="project-description">${project.description.split(/(?<=\.)\s/)[0]}</p>
      <p class="project-technologies">${project.tags.join(" · ")}</p>
    </li>
  `).join("");
}

function renderEducation() {
  const educationList = document.querySelector("#educationList");

  educationList.innerHTML = resumeData.education
    .map(
      (item) => `
        <article class="education-entry">
          <h3>${item.program}</h3>
          <h4>${item.school}</h4>
          <span class="item-date">${item.expectedGraduation ? `Expected graduation: ${item.expectedGraduation}` : item.date}</span>
          ${item.summary ? `<p class="education-summary">${item.summary}</p>` : ""}
          ${
            item.technologies
              ? `<div class="education-tech" aria-label="Project technologies">
                  ${item.technologies.join(" · ")}
                </div>`
              : ""
          }
          <div class="education-details">
            ${item.details
              .map(
                (detail) => `
                  <p><strong>${detail.label}:</strong> ${detail.text}</p>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
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

function appendRefusalSuggestions() {
  const suggestions = document.createElement("div");
  suggestions.className = "suggestion-list refusal-suggestions";
  suggestions.setAttribute("aria-label", "Questions about Sujal");
  ASSISTANT_CONFIG.suggestions.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = question;
    button.addEventListener("click", () => {
      if (isGenerating) return;
      assistantInput.value = question;
      sendChatMessage();
    });
    suggestions.appendChild(button);
  });
  chatWindow.appendChild(suggestions);
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

    // The gate runs before model import, loading, or inference. Output is fully
    // buffered and validated; no untrusted model tokens reach the DOM.
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
    appendChatMessage(assistantResponse, "assistant");
    recordTurn(messages, turn, assistantResponse);
    if (turn.scope === OUT_OF_SCOPE || assistantResponse === ASSISTANT_CONFIG.refusal) {
      appendRefusalSuggestions();
    }
  } finally {
    statusMessage?.remove();
    chatUI.finish(Boolean(engine));
    setChatBusy(false);
    assistantInput.focus();
  }
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
renderProjects();
renderEducation();
renderCertifications();
renderContact();
renderSuggestions();
preventPlaceholderLinks();

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && profileLinks.classList.contains("is-open")) {
    closeMenu();
    menuToggle.focus();
  }
});
