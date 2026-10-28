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
const assistantInput = document.querySelector(".assistant-input input");
const assistantSendButton = document.querySelector(".assistant-input button");
const chatWindow = document.querySelector(".chat-window");

const savedTheme = localStorage.getItem("resume-theme");
const preferredTheme = "dark";

root.dataset.theme = savedTheme || preferredTheme;

function toggleTheme() {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = nextTheme;
  localStorage.setItem("resume-theme", nextTheme);
}

function toggleMenu() {
  const isOpen = profileLinks.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function closeMenu() {
  profileLinks.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function renderSkills() {
  const skillGroups = document.querySelector("#skillGroups");

  skillGroups.innerHTML = resumeData.skills
    .map(
      (skillGroup) => `
        <div class="skill-group">
          <h3>${skillGroup.group}</h3>
          <div class="skill-tags">
            ${skillGroup.items.map((item) => `<span class="skill-tag">${item}</span>`).join("")}
          </div>
        </div>
      `
    )
    .join("");
}

function renderExperience() {
  const experienceList = document.querySelector("#experienceList");

  experienceList.innerHTML = resumeData.experience
    .map(
      (job) => `
        <article class="experience-item">
          <span class="item-date">${job.date}</span>
          <div class="experience-body">
            <h3>${job.role}</h3>
            <h4>${job.company}</h4>
            <ul>
              ${job.points.map((point) => `<li>${point}</li>`).join("")}
            </ul>
          </div>
        </article>
      `
    )
    .join("");
}

function createProjectCard(project, projectIndex, isClone = false) {
  const linkTabIndex = isClone ? ' tabindex="-1"' : "";

  return `
    <article
      class="project-item"
      data-project-index="${projectIndex}"
      data-clone="${isClone}"
      role="group"
      aria-roledescription="slide"
      aria-label="${projectIndex + 1} of ${resumeData.projects.length}: ${project.title}"
      aria-hidden="true"
    >
      ${
        project.image
          ? `<div class="project-thumb">
              <img src="${project.image}" alt="${project.imageAlt}" loading="lazy" decoding="async" />
            </div>`
          : `<div class="project-thumb project-thumb-fallback" role="img" aria-label="${project.title} preview">
              <span>${project.previewLabel}</span>
              <strong>${project.previewText}</strong>
            </div>`
      }
      <div class="project-body">
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="project-tags" aria-label="Technologies used">
          ${project.tags.map((tag) => `<span class="project-tag">${tag}</span>`).join("")}
        </div>
        <div class="project-actions">
          ${
            project.liveUrl
              ? `<a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${project.title} live demo in a new tab"${linkTabIndex}>View Project</a>`
              : ""
          }
          ${
            project.githubUrl
              ? `<a href="${project.githubUrl}" target="_blank" rel="noopener noreferrer" aria-label="View ${project.title} source code on GitHub in a new tab"${linkTabIndex}>GitHub</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function initializeProjectCarousel(carousel) {
  const viewport = carousel.querySelector(".project-viewport");
  const track = carousel.querySelector(".project-track");
  const cards = Array.from(track.querySelectorAll(".project-item"));
  const dots = Array.from(carousel.querySelectorAll(".carousel-dot"));
  const previousButton = carousel.querySelector(".carousel-arrow-previous");
  const nextButton = carousel.querySelector(".carousel-arrow-next");
  const status = carousel.querySelector(".carousel-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const projectCount = resumeData.projects.length;
  const originalStartIndex = 2;
  const autoplayDelay = 1000;
  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  let trackIndex = originalStartIndex;
  let currentTranslate = 0;
  let autoplayTimer = null;
  let isAnimating = false;
  let isPointerDown = false;
  let isDragging = false;
  let isHovered = false;
  let isFocusWithin = false;
  let queuedDirection = 0;
  let lastMoveSource = "initial";
  let pointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDelta = 0;
  let suppressClick = false;
  let resizeFrame = null;

  function activeProjectIndex() {
    return Number(cards[trackIndex].dataset.projectIndex);
  }

  function shouldAutoplay() {
    return (
      !reducedMotion.matches &&
      !isHovered &&
      !isFocusWithin &&
      !isPointerDown &&
      !document.hidden
    );
  }

  function stopAutoplay() {
    if (autoplayTimer !== null) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (!shouldAutoplay()) return;

    autoplayTimer = window.setInterval(() => {
      moveBy(1, "auto");
    }, autoplayDelay);
  }

  function setInteractiveState(card, isActive) {
    const isClone = card.dataset.clone === "true";
    const canInteract = isActive && !isClone;

    card.setAttribute("aria-hidden", String(!canInteract));
    card.querySelectorAll("a, button").forEach((control) => {
      control.tabIndex = canInteract ? 0 : -1;
    });
  }

  function updateProjectStates(announce = false) {
    cards.forEach((card, index) => {
      const distance = Math.abs(index - trackIndex);
      const isActive = distance === 0;

      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-adjacent", distance === 1);
      card.classList.toggle("is-before", index < trackIndex);
      card.classList.toggle("is-after", index > trackIndex);
      setInteractiveState(card, isActive);
    });

    const projectIndex = activeProjectIndex();
    dots.forEach((dot, index) => {
      const isCurrent = index === projectIndex;
      dot.classList.toggle("is-active", isCurrent);
      dot.setAttribute("aria-current", isCurrent ? "true" : "false");
    });

    if (announce) {
      status.textContent = `${resumeData.projects[projectIndex].title}, project ${projectIndex + 1} of ${projectCount}`;
    }
  }

  function updateTrackPosition(animate = true) {
    const activeCard = cards[trackIndex];
    const viewportBounds = viewport.getBoundingClientRect();
    const cardBounds = activeCard.getBoundingClientRect();
    const distanceToCenter =
      viewportBounds.left +
      viewportBounds.width / 2 -
      (cardBounds.left + cardBounds.width / 2);
    const centeredOffset = currentTranslate + distanceToCenter;

    carousel.classList.toggle("is-resetting", !animate);
    currentTranslate = centeredOffset;
    track.style.transform = `translate3d(${centeredOffset}px, 0, 0)`;

    if (!animate) {
      track.getBoundingClientRect();
      requestAnimationFrame(() => carousel.classList.remove("is-resetting"));
    }
  }

  function finishTransition() {
    const movedToLeadingClone = trackIndex === originalStartIndex - 1;
    const movedToTrailingClone = trackIndex === originalStartIndex + projectCount;

    isAnimating = false;

    if (movedToLeadingClone) {
      trackIndex = originalStartIndex + projectCount - 1;
      updateProjectStates();
      updateTrackPosition(false);
    } else if (movedToTrailingClone) {
      trackIndex = originalStartIndex;
      updateProjectStates();
      updateTrackPosition(false);
    }

    if (queuedDirection !== 0) {
      const direction = queuedDirection;
      queuedDirection = 0;
      requestAnimationFrame(() => moveBy(direction, "manual"));
      return;
    }

    if (lastMoveSource !== "auto") startAutoplay();
  }

  function moveBy(direction, source = "manual") {
    if (isAnimating || isDragging) {
      if (source !== "auto") queuedDirection = direction;
      return;
    }

    if (source !== "auto") stopAutoplay();

    lastMoveSource = source;
    isAnimating = !reducedMotion.matches;
    trackIndex += direction;
    updateProjectStates(source !== "auto");
    updateTrackPosition(true);

    if (!isAnimating) finishTransition();
  }

  function moveToProject(projectIndex) {
    if (isAnimating || isDragging || projectIndex === activeProjectIndex()) return;

    stopAutoplay();
    lastMoveSource = "manual";
    isAnimating = !reducedMotion.matches;
    trackIndex = originalStartIndex + projectIndex;
    updateProjectStates(true);
    updateTrackPosition(true);

    if (!isAnimating) finishTransition();
  }

  function releasePointer(event) {
    if (!isPointerDown || event.pointerId !== pointerId) return;

    const wasDragging = isDragging;
    const threshold = Math.min(90, viewport.clientWidth * 0.14);
    const direction = Math.abs(dragDelta) >= threshold ? (dragDelta < 0 ? 1 : -1) : 0;

    isPointerDown = false;
    isDragging = false;
    pointerId = null;
    carousel.classList.remove("is-dragging");

    if (wasDragging) {
      suppressClick = true;
      currentTranslate += dragDelta;

      if (direction !== 0) {
        moveBy(direction, "manual");
      } else {
        lastMoveSource = "manual";
        isAnimating = !reducedMotion.matches;
        updateTrackPosition(true);
        if (!isAnimating) finishTransition();
      }

      requestAnimationFrame(() => {
        suppressClick = false;
      });
    } else {
      startAutoplay();
    }
  }

  previousButton.addEventListener("click", () => moveBy(-1), listenerOptions);
  nextButton.addEventListener("click", () => moveBy(1), listenerOptions);

  dots.forEach((dot) => {
    dot.addEventListener(
      "click",
      () => moveToProject(Number(dot.dataset.projectIndex)),
      listenerOptions
    );
  });

  viewport.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      moveBy(event.key === "ArrowRight" ? 1 : -1);
    },
    listenerOptions
  );

  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (isAnimating || event.target.closest("a, button")) return;

      stopAutoplay();
      isPointerDown = true;
      pointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragDelta = 0;
      viewport.setPointerCapture?.(pointerId);
    },
    listenerOptions
  );

  viewport.addEventListener(
    "pointermove",
    (event) => {
      if (!isPointerDown || event.pointerId !== pointerId) return;

      const horizontalDistance = event.clientX - dragStartX;
      const verticalDistance = event.clientY - dragStartY;

      if (!isDragging && Math.abs(verticalDistance) > Math.abs(horizontalDistance)) return;
      if (!isDragging && Math.abs(horizontalDistance) < 6) return;

      isDragging = true;
      dragDelta = horizontalDistance;
      carousel.classList.add("is-dragging");
      track.style.transform = `translate3d(${currentTranslate + dragDelta}px, 0, 0)`;
    },
    listenerOptions
  );

  viewport.addEventListener("pointerup", releasePointer, listenerOptions);
  viewport.addEventListener("pointercancel", releasePointer, listenerOptions);
  viewport.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true, signal: abortController.signal }
  );

  carousel.addEventListener(
    "mouseenter",
    () => {
      isHovered = true;
      stopAutoplay();
    },
    listenerOptions
  );
  carousel.addEventListener(
    "mouseleave",
    () => {
      isHovered = false;
      startAutoplay();
    },
    listenerOptions
  );
  carousel.addEventListener(
    "focusin",
    () => {
      isFocusWithin = true;
      stopAutoplay();
    },
    listenerOptions
  );
  carousel.addEventListener(
    "focusout",
    (event) => {
      if (carousel.contains(event.relatedTarget)) return;
      isFocusWithin = false;
      startAutoplay();
    },
    listenerOptions
  );

  track.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === track && event.propertyName === "transform") {
        finishTransition();
      }
    },
    listenerOptions
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    },
    listenerOptions
  );

  const recalculatePosition = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => updateTrackPosition(false));
  };
  const resizeObserver =
    "ResizeObserver" in window ? new ResizeObserver(recalculatePosition) : null;

  if (resizeObserver) resizeObserver.observe(viewport);
  else window.addEventListener("resize", recalculatePosition, listenerOptions);

  const handleMotionPreference = () => {
    if (reducedMotion.matches) stopAutoplay();
    else startAutoplay();
  };
  reducedMotion.addEventListener?.("change", handleMotionPreference, listenerOptions);

  updateProjectStates();
  updateTrackPosition(false);
  startAutoplay();

  return () => {
    stopAutoplay();
    window.cancelAnimationFrame(resizeFrame);
    resizeObserver?.disconnect();
    abortController.abort();
  };
}

function renderProjects() {
  const projectList = document.querySelector("#projectList");
  const projectCount = resumeData.projects.length;
  const leadingProjects = resumeData.projects.slice(-2);
  const trailingProjects = resumeData.projects.slice(0, 2);
  const carouselProjects = [
    ...leadingProjects.map((project, index) => ({
      project,
      projectIndex: projectCount - leadingProjects.length + index,
      isClone: true,
    })),
    ...resumeData.projects.map((project, projectIndex) => ({
      project,
      projectIndex,
      isClone: false,
    })),
    ...trailingProjects.map((project, projectIndex) => ({
      project,
      projectIndex,
      isClone: true,
    })),
  ];

  projectList.innerHTML = `
    <div class="project-carousel" role="region" aria-roledescription="carousel" aria-label="Selected projects">
      <div
        class="project-viewport"
        tabindex="0"
        aria-label="Project carousel. Use the left and right arrow keys to navigate."
      >
        <div class="project-track" id="projectTrack">
          ${carouselProjects
            .map(({ project, projectIndex, isClone }) =>
              createProjectCard(project, projectIndex, isClone)
            )
            .join("")}
        </div>
      </div>

      <div class="carousel-navigation">
        <button
          class="carousel-arrow carousel-arrow-previous"
          type="button"
          aria-label="Show previous project"
          aria-controls="projectTrack"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>

        <div class="carousel-dots" aria-label="Choose a project">
          ${resumeData.projects
            .map(
              (project, index) => `
                <button
                  class="carousel-dot"
                  type="button"
                  data-project-index="${index}"
                  aria-label="Show ${project.title}"
                ></button>
              `
            )
            .join("")}
        </div>

        <button
          class="carousel-arrow carousel-arrow-next"
          type="button"
          aria-label="Show next project"
          aria-controls="projectTrack"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <p class="carousel-status sr-only" aria-live="polite" aria-atomic="true"></p>
    </div>
  `;

  return initializeProjectCarousel(projectList.querySelector(".project-carousel"));
}

function renderEducation() {
  const educationList = document.querySelector("#educationList");

  educationList.innerHTML = resumeData.education
    .map(
      (item) => `
        <article class="education-entry">
          <span class="item-date">${item.date}</span>
          <h3>${item.school}</h3>
          <h4>${item.program}</h4>
          ${item.summary ? `<p class="education-summary">${item.summary}</p>` : ""}
          ${
            item.technologies
              ? `<div class="education-tech" aria-label="Project technologies">
                  ${item.technologies.map((technology) => `<span>${technology}</span>`).join("")}
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
  const contactGrid = document.querySelector("#contactGrid");

  contactGrid.innerHTML = resumeData.contact
    .map((item) => {
      const content = `
        <span class="contact-icon">${item.icon}</span>
        <span class="contact-copy">
          <span class="contact-label">${item.label}</span>
          <strong>${item.value}</strong>
        </span>
      `;

      if (!item.href) {
        return `<div class="contact-item">${content}</div>`;
      }

      const externalAttributes = item.href.startsWith("http")
        ? 'target="_blank" rel="noopener noreferrer"'
        : "";

      return `<a class="contact-item" href="${item.href}" ${externalAttributes}>${content}</a>`;
    })
    .join("");
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
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  sendChatMessage();
});

renderSkills();
renderExperience();
const cleanupProjectCarousel = renderProjects();
renderEducation();
renderCertifications();
renderContact();
renderSuggestions();
preventPlaceholderLinks();

window.addEventListener("beforeunload", cleanupProjectCarousel, { once: true });
