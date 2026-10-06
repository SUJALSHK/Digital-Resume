import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";
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

function projectField(value, fallback = "Not provided") {
  if (typeof value !== "string") return fallback;

  const compactValue = value.replace(/\s+/g, " ").trim();
  return compactValue || fallback;
}

function normalizedWords(value) {
  return projectField(value, "")
    .toLocaleLowerCase()
    .match(/[a-z0-9+#.]+/g) || [];
}

function compactList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => projectField(item, "")).filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmedValue = value.trim();
  if (!trimmedValue) return [];

  if (trimmedValue.startsWith("[")) {
    try {
      const parsedValue = JSON.parse(trimmedValue);
      if (Array.isArray(parsedValue)) return compactList(parsedValue);
    } catch {
      // Keep non-JSON text as a normal list value.
    }
  }

  return trimmedValue
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function experienceEndLabel(item) {
  const endDate = projectField(item.end_date, "");

  if (item.is_current === true) {
    return endDate ? `${endDate} (scheduled end; currently ongoing)` : "Present";
  }

  return endDate;
}

function experienceDateRange(item) {
  const startDate = projectField(item.start_date, "");
  const endDate = experienceEndLabel(item);

  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return startDate || endDate;
}

function experienceSearchText(item) {
  return [
    item.company,
    item.role,
    item.location,
    item.summary,
    item.experience_type,
    ...compactList(item.responsibilities),
    ...compactList(item.technologies),
  ]
    .map((value) => projectField(value, ""))
    .filter(Boolean)
    .join(" ");
}

function companyMatchesQuestion(company, question) {
  const companyWords = normalizedWords(company).filter((word) => word.length > 2);
  const questionWords = new Set(normalizedWords(question));
  const matchingWordCount = companyWords.filter((word) =>
    questionWords.has(word)
  ).length;

  return (
    matchingWordCount >= Math.min(2, companyWords.length) &&
    matchingWordCount > 0
  );
}

function isInternshipQuestion(question) {
  const questionWords = new Set(normalizedWords(question));
  return questionWords.has("intern") || questionWords.has("internship");
}

function isInternshipExperience(item) {
  const typeWords = new Set([
    ...normalizedWords(item.experience_type),
    ...normalizedWords(item.role),
  ]);
  return typeWords.has("intern") || typeWords.has("internship");
}

function isExperienceQuestion(experience, question) {
  const questionWords = new Set(normalizedWords(question));
  const hasCompanyMatch = experience.some((item) =>
    companyMatchesQuestion(item.company, question)
  );

  return (
    hasCompanyMatch ||
    [
      "experience",
      "responsibility",
      "responsibilities",
      "company",
      "employer",
      "employed",
      "intern",
      "internship",
      "role",
      "there",
    ].some((word) => questionWords.has(word)) ||
    /\b(?:work|worked|working)\s+(?:at|for|on)\b/i.test(question)
  );
}

function matchingExperienceForQuestion(
  experience,
  question,
  skillData,
  history = []
) {
  const directCompanyMatches = experience.filter((item) =>
    companyMatchesQuestion(item.company, question)
  );
  if (directCompanyMatches.length) return directCompanyMatches;

  if (isInternshipQuestion(question)) {
    return experience.filter(isInternshipExperience);
  }

  const questionWords = new Set(normalizedWords(question));
  const ignoredWords = new Set([
    "what",
    "which",
    "does",
    "did",
    "sujal",
    "have",
    "has",
    "his",
    "with",
    "from",
    "that",
    "this",
    "there",
    "experience",
    "responsibility",
    "responsibilities",
    "technology",
    "technologies",
    "skill",
    "skills",
    "used",
    "use",
    "work",
    "worked",
    "working",
    "currently",
    "current",
    "project",
    "company",
  ]);
  const relevantWords = [...questionWords].filter(
    (word) => word.length > 2 && !ignoredWords.has(word)
  );
  const relatedSkillNames =
    skillData?.status === "available"
      ? skillData.skills
          .filter((skill) => {
            const skillWords = [
              ...normalizedWords(skill.name),
              ...normalizedWords(skill.category),
            ];
            return skillWords.some((word) => relevantWords.includes(word));
          })
          .map((skill) => projectField(skill.name, ""))
          .filter(Boolean)
      : [];

  if (relevantWords.length) {
    const matches = experience.filter((item) => {
      const searchableWords = new Set(normalizedWords(experienceSearchText(item)));
      const directMatch = relevantWords.some((word) => searchableWords.has(word));
      const technologies = compactList(item.technologies)
        .join(" ")
        .toLocaleLowerCase();
      const relatedSkillMatch = relatedSkillNames.some((skillName) => {
        const normalizedName = projectField(skillName, "").toLocaleLowerCase();
        return (
          normalizedName &&
          (technologies.includes(normalizedName) ||
            normalizedName
              .split(/\s+/)
              .some((word) => word.length > 3 && technologies.includes(word)))
        );
      });

      return directMatch || relatedSkillMatch;
    });

    if (matches.length) return matches;
  }

  const isFollowUp = ["there", "that", "it"].some((word) =>
    questionWords.has(word)
  );
  if (isFollowUp) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const historyContent = history[index]?.content || "";
      const matches = experience.filter((item) =>
        companyMatchesQuestion(item.company, historyContent)
      );
      if (matches.length) return matches;
    }
  }

  const asksForAllExperience =
    questionWords.has("experience") && relevantWords.length === 0;
  const asksForExperienceSkills =
    questionWords.has("experience") &&
    (questionWords.has("skill") || questionWords.has("skills"));

  return asksForAllExperience || asksForExperienceSkills ? experience : [];
}

function isProjectTechnologyQuestion(question) {
  const questionWords = new Set(normalizedWords(question));
  const mentionsProject =
    questionWords.has("project") || questionWords.has("projects");
  const asksAboutTechnology = [
    "skill",
    "skills",
    "technology",
    "technologies",
    "use",
    "used",
  ].some((word) => questionWords.has(word));

  return mentionsProject && asksAboutTechnology;
}

function prioritizeSkillsForQuestion(skills, question) {
  const questionText = normalizedWords(question).join(" ");
  const questionWords = new Set(normalizedWords(question));

  return skills
    .map((skill, index) => {
      const skillName = normalizedWords(skill.name).join(" ");
      const skillNameWords = normalizedWords(skill.name);
      const categoryWords = normalizedWords(skill.category);
      const exactNameMatch = skillName && questionText.includes(skillName);
      const relatedWordMatch = [...skillNameWords, ...categoryWords].some(
        (word) => word.length > 1 && questionWords.has(word)
      );

      return {
        skill,
        index,
        score: exactNameMatch ? 2 : relatedWordMatch ? 1 : 0,
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ skill }) => skill);
}

function matchingSkillsForQuestion(skills, question) {
  const questionText = normalizedWords(question).join(" ");
  const questionWords = new Set(normalizedWords(question));

  return skills.filter((skill) => {
    const skillName = normalizedWords(skill.name).join(" ");
    const skillNameWords = normalizedWords(skill.name);
    const categoryWords = normalizedWords(skill.category);

    return (
      (skillName && questionText.includes(skillName)) ||
      [...skillNameWords, ...categoryWords].some(
        (word) => word.length > 1 && questionWords.has(word)
      )
    );
  });
}

function isSkillFocusedQuestion(skills, question) {
  const questionWords = new Set(normalizedWords(question));
  const mentionsProject =
    questionWords.has("project") || questionWords.has("projects");

  if (mentionsProject) return false;
  if (matchingSkillsForQuestion(skills, question).length) return true;

  return [
    "know",
    "knows",
    "skill",
    "skills",
    "technology",
    "technologies",
    "proficiency",
    "level",
    "experience",
  ].some((word) => questionWords.has(word));
}

function buildCurrentSkillEvidence(skills, question) {
  const questionWords = new Set(normalizedWords(question));
  const includeUsage = [
    "experience",
    "how",
    "use",
    "used",
    "using",
    "work",
    "worked",
  ].some((word) => questionWords.has(word));
  const relevantSkills = matchingSkillsForQuestion(skills, question);

  if (!relevantSkills.length) {
    const isProjectQuestion =
      questionWords.has("project") || questionWords.has("projects");
    const isSkillQuestion = [
      "know",
      "knows",
      "skill",
      "skills",
      "technology",
      "technologies",
      "proficiency",
      "level",
      "experience",
    ].some((word) => questionWords.has(word));

    if (isProjectQuestion) {
      return "No individual skill row directly answers this project question. Use only the verified project fields above, including LATEST PROJECT TECHNOLOGIES, and do not infer extra project-skill relationships.";
    }

    if (isSkillQuestion) {
      return 'No matching public skill row exists for the skill or technology asked about. REQUIRED RESPONSE: "That skill or technology is not currently listed in Sujal\'s portfolio data." Do not say that Sujal does not know it.';
    }

    return "No direct skill-name or skill-category match was found. Use the full verified portfolio data and conversation history.";
  }

  const evidence = relevantSkills
    .map((skill) => {
      const description = projectField(skill.description, "");
      const details = [
        `Sujal knows ${projectField(skill.name)}.`,
        `Category: ${projectField(skill.category)}.`,
        `Proficiency: ${projectField(skill.proficiency)}.`,
      ];

      if (includeUsage && description) details.push(`Usage: ${description}`);

      return `- ${details.join(" ")}`;
    })
    .join("\n");

  const usageRule = includeUsage
    ? `Your response is incomplete unless it names every matching skill and summarizes the Usage text for every matching row that has Usage. Do not answer with skill names or proficiency alone.`
    : "Do not add usage details unless the user asks for them.";

  return `VERIFIED SKILL INFORMATION IS AVAILABLE FOR THIS QUESTION. Do not answer that the information is unavailable.

MATCHING PUBLIC SKILL ROWS (${relevantSkills.length} total):
${evidence}

STRICT CURRENT-QUESTION RULE: Answer using only the matching rows above. Mention all ${relevantSkills.length} matching skill name(s). Do not mention project technologies, earlier skills from conversation history, or any other skill. ${usageRule}`;
}

function buildProjectContext(projects) {
  if (!projects.length) {
    return "No public project information is currently available.";
  }

  return projects
    .map((project, index) => {
      const technologies = Array.isArray(project.technologies)
        ? project.technologies
            .map((technology) => projectField(technology, ""))
            .filter(Boolean)
            .join(", ") || "Not provided"
        : projectField(project.technologies);

      return [
        `PROJECT ${index + 1}`,
        `Name: ${projectField(project.name)}`,
        `Date: ${projectField(project.project_date)}`,
        `Summary: ${projectField(project.summary)}`,
        `Description: ${projectField(project.description)}`,
        `Technologies: ${technologies}`,
        `GitHub: ${projectField(project.github_url)}`,
        `Demo: ${projectField(project.demo_url)}`,
        `Featured: ${project.featured === true ? "Yes" : "No"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function buildSkillsContext(skills) {
  if (!skills.length) {
    return "No public skill information is currently available.";
  }

  const skillsByCategory = new Map();

  skills.forEach((skill) => {
    const categoryLabel = projectField(skill.category, "Uncategorized");
    const categoryKey = categoryLabel.toLocaleLowerCase();
    const categoryGroup = skillsByCategory.get(categoryKey) || {
      label: categoryLabel,
      skills: [],
    };
    categoryGroup.skills.push(skill);
    skillsByCategory.set(categoryKey, categoryGroup);
  });

  const skillIndex = Array.from(
    skillsByCategory.values(),
    ({ label, skills: categorySkills }) => {
      const entries = categorySkills
        .map(
          (skill) =>
            `${projectField(skill.name)} [${projectField(skill.proficiency)}]`
        )
        .join(", ");

      return `${label}: ${entries}`;
    }
  ).join("\n");
  return `SKILL INDEX (every named item is a skill Sujal knows; brackets contain proficiency):
${skillIndex}

Descriptions for skills relevant to the current question are supplied separately in CURRENT QUESTION SKILL EVIDENCE.`;
}

function buildExperienceContext(experience) {
  if (!experience.length) {
    return "No public experience information is currently available.";
  }

  return experience
    .map((item, index) => {
      const responsibilities = compactList(item.responsibilities);
      const technologies = compactList(item.technologies);
      const details = [
        `EXPERIENCE ${index + 1}`,
        `Company: ${projectField(item.company)}`,
        `Role: ${projectField(item.role)}`,
      ];
      const type = projectField(item.experience_type, "");
      const location = projectField(item.location, "");
      const startDate = projectField(item.start_date, "");
      const endDate = experienceEndLabel(item);
      const summary = projectField(item.summary, "");

      if (type) details.push(`Type: ${type}`);
      if (location) details.push(`Location: ${location}`);
      if (startDate) details.push(`Start: ${startDate}`);
      if (endDate) details.push(`End: ${endDate}`);
      details.push(`Current: ${item.is_current === true ? "Yes" : "No"}`);
      if (summary) details.push(`Summary: ${summary}`);
      if (responsibilities.length) {
        details.push(
          `Responsibilities:\n${responsibilities
            .map((responsibility) => `- ${responsibility}`)
            .join("\n")}`
        );
      }
      if (technologies.length) {
        details.push(`Technologies: ${technologies.join(", ")}`);
      }

      return details.join("\n");
    })
    .join("\n\n");
}

function buildCurrentExperienceEvidence(
  experienceData,
  skillData,
  currentQuestion,
  history
) {
  if (experienceData.status === "unavailable") {
    return "Experience information is temporarily unavailable. Do not invent experience facts.";
  }

  const matchingExperience = matchingExperienceForQuestion(
    experienceData.experience,
    currentQuestion,
    skillData,
    history
  );

  if (!matchingExperience.length) {
    if (isInternshipQuestion(currentQuestion)) {
      return "No public experience row is classified as an internship. Do not name an internship company.";
    }

    return "No matching public experience row exists for the employer or experience asked about. Do not claim that Sujal worked there.";
  }

  return `Use only these matching experience rows for the current question:\n${buildExperienceContext(
    matchingExperience
  )}`;
}

function buildPortfolioContext(
  projectData,
  skillData,
  experienceData,
  currentQuestion,
  history
) {
  const experienceFocused = isExperienceQuestion(
    experienceData.experience,
    currentQuestion
  );
  const skillFocused =
    !experienceFocused &&
    skillData.status === "available" &&
    isSkillFocusedQuestion(skillData.skills, currentQuestion);
  const projectContext =
    skillFocused || experienceFocused
      ? "Project details are intentionally omitted for this non-project question."
      : projectData.status === "unavailable"
      ? "Project information is temporarily unavailable."
      : buildProjectContext(projectData.projects);
  const skillContext =
    skillData.status === "unavailable"
      ? "Skill information is temporarily unavailable."
      : isProjectTechnologyQuestion(currentQuestion)
        ? "General skill records are not used for this project relationship question. Use only the project's verified Technologies field."
        : buildSkillsContext(
            prioritizeSkillsForQuestion(skillData.skills, currentQuestion)
          );
  const experienceContext =
    experienceData.status === "unavailable"
      ? "Experience information is temporarily unavailable."
      : buildExperienceContext(experienceData.experience);

  return `PROJECTS (newest first):
${projectContext}

SKILLS (grouped by category):
${skillContext}

EXPERIENCE (display order):
${experienceContext}`;
}

function buildPortfolioSystemPrompt(
  projectData,
  skillData,
  experienceData,
  currentQuestion,
  history
) {
  const experienceFocused = isExperienceQuestion(
    experienceData.experience,
    currentQuestion
  );
  const skillFocused =
    !experienceFocused &&
    skillData.status === "available" &&
    isSkillFocusedQuestion(skillData.skills, currentQuestion);
  const latestProject = projectData.projects[0];
  const latestProjectTechnologies = Array.isArray(latestProject?.technologies)
    ? latestProject.technologies
        .map((technology) => projectField(technology, ""))
        .filter(Boolean)
        .join(", ")
    : projectField(latestProject?.technologies, "");
  const latestProjectAnswer =
    skillFocused
      ? "Omitted for this skill-only question."
      : projectData.status === "available" && latestProject
      ? `Sujal's most recent project is ${projectField(latestProject.name)}, dated ${projectField(latestProject.project_date)}.`
      : "That information is not currently available in Sujal's portfolio data.";
  const latestProjectTechnologyAnswer =
    skillFocused
      ? "Omitted for this skill-only question."
      : projectData.status === "available" && latestProjectTechnologies
      ? `The verified technologies listed for Sujal's most recent project are: ${latestProjectTechnologies}.`
      : "No technologies are currently listed for Sujal's most recent project.";
  const portfolioContext = buildPortfolioContext(
    projectData,
    skillData,
    experienceData,
    currentQuestion,
    history
  );
  const currentSkillEvidence =
    experienceFocused
      ? "This is an experience-focused question. Use CURRENT QUESTION EXPERIENCE EVIDENCE instead."
      : skillData.status === "available"
      ? buildCurrentSkillEvidence(skillData.skills, currentQuestion)
      : "Skill information is temporarily unavailable.";
  const currentProjectEvidence = isProjectTechnologyQuestion(currentQuestion)
    ? projectData.status === "available" && latestProjectTechnologies
      ? `Most recent project: ${projectField(latestProject.name)}. The only verified technologies listed for this project are: ${latestProjectTechnologies}. STRICT CURRENT-PROJECT RULE: Answer using only this technology list. Do not infer technologies from SKILL INDEX.`
      : "No technologies are currently listed for Sujal's most recent project. Do not infer any from SKILL INDEX."
    : "";
  const currentExperienceEvidence =
    experienceFocused
      ? buildCurrentExperienceEvidence(
          experienceData,
          skillData,
          currentQuestion,
          history
        )
      : "This is not an experience-focused question.";

  return `You are Sujal Shakya's digital resume assistant.

Answer visitor questions using the verified portfolio information supplied below. The supplied data currently contains information only about Sujal's projects, skills, and experience.

Rules:
1. Treat the supplied portfolio data as the only source of truth.
2. Every item in SKILL INDEX is a skill Sujal knows. Brackets give the exact proficiency. For named-skill or category questions, if CURRENT QUESTION SKILL EVIDENCE contains bullets, answer only from those bullets and do not carry unrelated skills forward from conversation history.
3. For questions about experience or how a skill was used, include the Usage text from CURRENT QUESTION SKILL EVIDENCE when present. Never invent missing usage details.
4. Projects are newest first. For newest/latest/most-recent questions, use LATEST PROJECT ANSWER. For skills or technologies used in the most recent project, use only LATEST PROJECT TECHNOLOGIES; never infer project-skill relationships from SKILL INDEX.
5. For employer, role, responsibility, date, current-status, or work-technology questions, use only CURRENT QUESTION EXPERIENCE EVIDENCE. Use is_current to decide whether work is ongoing. A current row with an end date has a scheduled end date, not a completed date.
6. Do not claim that Sujal used a skill in a role or project unless that row's Technologies field supports the relationship.
7. If current evidence says verified information is available, use it. If it says no matching row exists, clearly say the information is not currently available.
8. Never invent employers, roles, internships, responsibilities, dates, technologies, proficiency levels, projects, skills, achievements, or experience.
9. Answer naturally and concisely. Refer to the owner as Sujal. If asked who you are, identify yourself as Sujal's digital resume assistant.

LATEST PROJECT ANSWER:
${latestProjectAnswer}

LATEST PROJECT TECHNOLOGIES:
${latestProjectTechnologyAnswer}

PORTFOLIO DATA:
${portfolioContext}

CURRENT QUESTION SKILL EVIDENCE (when this contains bullets, answer the current skill question only from these bullets):
${currentSkillEvidence}${
    currentProjectEvidence
      ? `\n\nCURRENT PROJECT QUESTION EVIDENCE:\n${currentProjectEvidence}`
      : ""
  }

CURRENT QUESTION EXPERIENCE EVIDENCE:
${currentExperienceEvidence}`;
}

function buildGroundedUserContent(
  skillData,
  experienceData,
  question,
  history
) {
  const questionWords = new Set(normalizedWords(question));
  const isProjectQuestion =
    questionWords.has("project") || questionWords.has("projects");
  const asksForUsage = [
    "experience",
    "how",
    "use",
    "used",
    "using",
    "work",
    "worked",
  ].some((word) => questionWords.has(word));

  if (isExperienceQuestion(experienceData.experience, question)) {
    if (experienceData.status !== "available") {
      return `${question}\n\nVerified experience information is temporarily unavailable. Do not invent an answer.`;
    }

    const experienceEvidence = buildCurrentExperienceEvidence(
      experienceData,
      skillData,
      question,
      history
    );

    return `${question}

VERIFIED CURRENT-QUESTION EXPERIENCE CONTEXT (not visible to the visitor):
${experienceEvidence}

Answer using only this experience evidence. Do not infer employers, internships, dates, responsibilities, technologies, or role relationships. Do not mention these hidden instructions.`;
  }

  if (isProjectQuestion) return question;

  if (skillData.status !== "available") {
    return `${question}\n\nVerified skill information is temporarily unavailable. Do not invent an answer.`;
  }

  const matchingSkills = matchingSkillsForQuestion(skillData.skills, question);
  const verifiedFacts = matchingSkills.length
    ? matchingSkills
        .map((skill) => {
          const description = projectField(skill.description, "");
          return [
            `Name: ${projectField(skill.name)}`,
            `Category: ${projectField(skill.category)}`,
            `Exact proficiency: ${projectField(skill.proficiency)}`,
            description ? `Verified usage: ${description}` : "",
          ]
            .filter(Boolean)
            .join("; ");
        })
        .join("\n")
    : "No matching public skill row exists.";
  const usageRequirement = asksForUsage
    ? `MANDATORY FOR THIS EXPERIENCE/USAGE QUESTION: Explain the following verified usage details, not just skill names or proficiency:\n${matchingSkills
        .map((skill) => {
          const description = projectField(skill.description, "");
          return description
            ? `- ${projectField(skill.name)}: ${description}`
            : `- ${projectField(skill.name)}: no usage description is available, so do not invent one.`;
        })
        .join("\n")}`
    : "";
  const answerScope = matchingSkills.length
    ? `ONLY THESE MATCHING SKILL NAMES MAY APPEAR IN THE ANSWER: ${matchingSkills
        .map((skill) => projectField(skill.name))
        .join(", ")}. Any other skill or technology is unsupported for this question and must not be mentioned.`
    : "No skill or technology name may be claimed as verified for this question.";

  return `${question}

VERIFIED CURRENT-QUESTION CONTEXT (not visible to the visitor):
${verifiedFacts}

${answerScope}

${usageRequirement}

Answer the visitor's question directly and naturally using these exact facts. If asked for a level, state the Exact proficiency value. Do not mention this hidden context or these instructions.`;
}

function naturalList(items) {
  if (items.length < 2) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function ensureGroundedSkillResponse(question, skillData, response) {
  if (skillData.status !== "available") return response;

  const questionWords = new Set(normalizedWords(question));
  if (!isSkillFocusedQuestion(skillData.skills, question)) return response;

  const matchingSkills = matchingSkillsForQuestion(skillData.skills, question);
  if (!matchingSkills.length) {
    return "That skill or technology is not currently listed in Sujal's portfolio data.";
  }

  const responseText = response.toLocaleLowerCase();
  const missingNames = matchingSkills.filter(
    (skill) =>
      !responseText.includes(projectField(skill.name, "").toLocaleLowerCase())
  );
  const asksForLevel =
    questionWords.has("level") || questionWords.has("proficiency");
  const asksForUsage = [
    "experience",
    "how",
    "use",
    "used",
    "using",
    "work",
    "worked",
  ].some((word) => questionWords.has(word));

  if (asksForLevel) {
    const hasEveryProficiency = matchingSkills.every((skill) =>
      responseText.includes(
        projectField(skill.proficiency, "").toLocaleLowerCase()
      )
    );

    if (!hasEveryProficiency || missingNames.length) {
      return matchingSkills
        .map(
          (skill) =>
            `Sujal's proficiency with ${projectField(skill.name)} is ${projectField(skill.proficiency)}.`
        )
        .join(" ");
    }
  }

  if (asksForUsage && missingNames.length) {
    const usageDetails = matchingSkills.map((skill) => {
      const description = projectField(skill.description, "");
      return description
        ? `${projectField(skill.name)}: ${description}`
        : `${projectField(skill.name)} is listed at ${projectField(skill.proficiency)}, but no usage description is currently available.`;
    });

    return `Sujal's relevant experience includes ${usageDetails.join(" ")}`;
  }

  if (missingNames.length) {
    return `Sujal has listed ${naturalList(
      matchingSkills.map((skill) => projectField(skill.name))
    )} in his portfolio data.`;
  }

  return response;
}

function uniqueValues(values) {
  const seen = new Set();

  return values.filter((value) => {
    const normalizedValue = projectField(value, "").toLocaleLowerCase();
    if (!normalizedValue || seen.has(normalizedValue)) return false;
    seen.add(normalizedValue);
    return true;
  });
}

function experienceDetailResponse(item, includeResponsibilities = false) {
  const company = projectField(item.company);
  const role = projectField(item.role);
  const dateRange = experienceDateRange(item);
  const summary = projectField(item.summary, "");
  const responsibilities = compactList(item.responsibilities);
  const technologies = compactList(item.technologies);
  const details = [`${role} at ${company}${dateRange ? ` (${dateRange})` : ""}.`];

  if (summary) details.push(summary);
  if (includeResponsibilities && responsibilities.length) {
    details.push(
      `Listed responsibilities included: ${responsibilities
        .slice(0, 4)
        .join("; ")}.`
    );
  }
  if (!includeResponsibilities && technologies.length) {
    details.push(`Listed technologies: ${technologies.join(", ")}.`);
  }

  return details.join(" ");
}

function ensureGroundedExperienceResponse(
  question,
  skillData,
  experienceData,
  response,
  history
) {
  if (experienceData.status !== "available") return response;
  if (!isExperienceQuestion(experienceData.experience, question)) return response;

  const questionWords = new Set(normalizedWords(question));
  let matchingExperience = matchingExperienceForQuestion(
    experienceData.experience,
    question,
    skillData,
    history
  );

  if (isInternshipQuestion(question)) {
    matchingExperience = experienceData.experience.filter(isInternshipExperience);
    if (!matchingExperience.length) {
      return "No internship is currently listed in Sujal's portfolio experience data.";
    }
  }

  const asksForGenericCompanies =
    (questionWords.has("company") || questionWords.has("employer")) &&
    !/\b(?:work|worked|working)\s+(?:at|for)\s+[^?]+/i.test(question);
  if (!matchingExperience.length && asksForGenericCompanies) {
    matchingExperience = experienceData.experience;
  }

  if (!matchingExperience.length) {
    const asksAboutSpecificEmployer =
      /\b(?:work|worked|working)\s+(?:at|for|on)\s+[^?]+/i.test(question) ||
      questionWords.has("company") ||
      questionWords.has("employer");

    return asksAboutSpecificEmployer
      ? "That employer or experience is not currently listed in Sujal's portfolio data."
      : "That experience information is not currently available in Sujal's portfolio data.";
  }

  const asksCurrentStatus = ["current", "currently", "ongoing", "still"].some(
    (word) => questionWords.has(word)
  );
  if (asksCurrentStatus) {
    return matchingExperience
      .map((item) => {
        const company = projectField(item.company);
        const role = projectField(item.role);
        const endDate = projectField(item.end_date, "");

        if (item.is_current === true) {
          return endDate
            ? `Yes. Sujal's ${role} experience with ${company} is currently ongoing; ${endDate} is listed as the scheduled end date.`
            : `Yes. Sujal's ${role} experience with ${company} is currently ongoing.`;
        }

        return `No. Sujal's ${role} experience with ${company} is not marked as current in his portfolio data.`;
      })
      .join(" ");
  }

  const asksForTechnologies =
    questionWords.has("technology") ||
    questionWords.has("technologies") ||
    (questionWords.has("experience") &&
      (questionWords.has("skill") || questionWords.has("skills"))) ||
    (questionWords.has("there") &&
      (questionWords.has("use") || questionWords.has("used")));
  if (asksForTechnologies) {
    const technologies = uniqueValues(
      matchingExperience.flatMap((item) => compactList(item.technologies))
    );

    return technologies.length
      ? `The technologies explicitly listed for this experience are ${naturalList(
          technologies
        )}.`
      : "No technologies are currently listed for that experience in Sujal's portfolio data.";
  }

  const asksForResponsibilities =
    questionWords.has("responsibility") ||
    questionWords.has("responsibilities") ||
    /\bwhat\s+did\s+sujal\s+do\b/i.test(question);
  if (asksForResponsibilities) {
    return matchingExperience
      .map((item) => experienceDetailResponse(item, true))
      .join(" ");
  }

  const genericExperienceQuestion =
    questionWords.has("experience") &&
    matchingExperience.length === experienceData.experience.length;

  return matchingExperience
    .map((item) =>
      experienceDetailResponse(item, !genericExperienceQuestion)
    )
    .join(" ");
}

async function getOrCreateEngine(onProgress) {
  if (engine) return engine;

  if (onProgress) modelProgressListeners.add(onProgress);

  if (!modelLoadingPromise) {
    console.log("Starting Llama 3.2 1B...");
    console.log("MODEL_ID", MODEL_ID);                    
    modelLoadingPromise = CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (progress) => {
        console.log("Loading:", progress);
        modelProgressListeners.forEach((listener) => listener(progress));
      },
    })
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
      liveUrl: "https://sujalshk.github.io/sujals-portfolio/",
      previewLabel: "SS",
      previewText: "Portfolio & Project Gallery",
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

async function sendChatMessage() {
  if (isGenerating) return;

  const content = assistantInput.value.trim();
  if (!content) return;

  setChatBusy(true);
  appendChatMessage(content, "user");
  assistantInput.value = "";

  const userMessage = { role: "user", content };
  messages.push(userMessage);
  const statusMessage = appendChatMessage(
    engine ? "Thinking..." : "Loading AI model...",
    "assistant",
    true
  );

  try {
    if (!navigator.gpu) {
      console.error("WebGPU is unavailable in this browser.");
      setStatusMessage(
        statusMessage,
        "This AI assistant requires a browser with WebGPU support."
      );
      messages.pop();
      return;
    }

    let chatEngine;
    let projectData;
    let skillData;
    let experienceData;

    try {
      [chatEngine, projectData, skillData, experienceData] = await Promise.all([
        getOrCreateEngine((progress) => {
          setStatusMessage(statusMessage, modelLoadingText(progress));
        }),
        getProjects(),
        getSkills(),
        getExperience(),
      ]);
    } catch (error) {
      console.error("Failed to load the WebLLM model:", error);
      setStatusMessage(
        statusMessage,
        "The AI model could not be loaded. Please try again."
      );
      messages.pop();
      return;
    }

    setStatusMessage(statusMessage, "Thinking...");

    try {
      const priorMessages = messages.slice(0, -1);
      const messagesForModel = [
        {
          role: "system",
          content: buildPortfolioSystemPrompt(
            projectData,
            skillData,
            experienceData,
            content,
            priorMessages
          ),
        },
        ...priorMessages,
        {
          role: "user",
          content: buildGroundedUserContent(
            skillData,
            experienceData,
            content,
            priorMessages
          ),
        },
      ];
      const response = await chatEngine.chat.completions.create({
        messages: messagesForModel,
        temperature: 0,
        max_tokens: 160,
      });
      const generatedResponse = response.choices[0].message.content?.trim();

      if (!generatedResponse) {
        throw new Error("WebLLM returned an empty assistant response.");
      }

      const assistantResponse = isExperienceQuestion(
        experienceData.experience,
        content
      )
        ? ensureGroundedExperienceResponse(
            content,
            skillData,
            experienceData,
            generatedResponse,
            priorMessages
          )
        : ensureGroundedSkillResponse(content, skillData, generatedResponse);

      messages.push({ role: "assistant", content: assistantResponse });
      statusMessage.remove();
      appendChatMessage(assistantResponse, "assistant");
    } catch (error) {
      console.error("Failed to generate a WebLLM response:", error);
      setStatusMessage(
        statusMessage,
        "Something went wrong while generating the response. Please try again."
      );
      messages.pop();
    }
  } finally {
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
