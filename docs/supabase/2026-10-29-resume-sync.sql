-- Resume sync: SUJAL_SHAKYA_RESUME.pdf (October 2026) -> public Supabase tables.
--
-- NOT YET APPLIED. Run in the Supabase SQL editor as the project owner.
-- Rollback: 2026-10-29-resume-sync-rollback.sql
--
-- What this does
--   * Backs up projects, skills and experience into the resume_backup schema,
--     which the Data API does not expose.
--   * Updates 3 existing rows (projects.id 1, skills.id 2, experience.id 1).
--   * Inserts missing projects, skills and experience rows. Every insert is
--     guarded by a name match, so running the script twice adds nothing.
--   * Deletes nothing and changes no schema, RLS policy or grant.
--
-- Assumptions (checked against the current public rows): ids have defaults;
-- technologies and responsibilities are text[]; dates are date columns.
-- Preflight, if you want to confirm the column types first:
--   select table_name, column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name in ('projects', 'skills', 'experience')
--   order by table_name, ordinal_position;
--
-- The resume gives months, not days, so month-only dates use the 1st.

begin;

create schema if not exists resume_backup;
revoke all on schema resume_backup from anon, authenticated;
create table if not exists resume_backup.projects_20261029 as table public.projects;
create table if not exists resume_backup.skills_20261029 as table public.skills;
create table if not exists resume_backup.experience_20261029 as table public.experience;

-- Projects -------------------------------------------------------------------

update public.projects set
  name = 'AI-Powered Digital Resume & Personal Portfolio',
  summary = 'A responsive AI-powered portfolio with a browser-based assistant that answers questions about Sujal''s skills, education, experience, projects, and qualifications.',
  description = 'A responsive AI-powered portfolio with a browser-based assistant that uses WebLLM and WebGPU to run Llama 3.2 1B in the visitor''s browser and answer questions about Sujal''s technical skills, education, experience, projects, and qualifications. Supabase provides dynamic data retrieval for context-aware responses; the code is version-controlled on GitHub and deployed on Vercel.',
  technologies = array['HTML', 'CSS', 'JavaScript', 'WebLLM', 'WebGPU', 'Llama 3.2 1B', 'Supabase', 'Vercel'],
  github_url = 'https://github.com/SUJALSHK/Digital-Resume',
  demo_url = 'https://resume.sujalshakya.com/'
where id = 1;

insert into public.projects (name, summary, description, technologies, project_date, github_url, demo_url, featured, is_public)
select v.name, v.summary, v.description, v.technologies, v.project_date, v.github_url, v.demo_url, v.featured, true
from (values
  ('Reflection Journal Web Application',
   'A responsive web application that organizes academic reflections by class and topic.',
   'A personal project that organizes academic reflections by class and topic. Sujal implemented creating, editing, and managing reflection entries, persisted them in browser local storage without a backend database, and built a mobile-friendly interface prepared for deployment through Vercel.',
   array['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'React Router', 'Local Storage'],
   date '2026-11-01', null::text, 'https://reflection-flax.vercel.app/classes', true),
  ('Ghost Student Prevention System',
   'A hackathon student engagement monitoring system that identifies students at risk of disengagement.',
   'A hackathon project that analyzes CSV datasets to identify students at risk of disengagement. Sujal collaborated on the system and integrated Google''s Gemini API for AI-powered engagement analysis, with automated email notifications to support early intervention.',
   array['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Gemini API', 'CSV Processing', 'Nodemailer'],
   date '2025-08-01', null, null, false),
  ('Developer Portfolio',
   'A responsive portfolio that gives recruiters one accessible place to explore Sujal''s background, projects, and resume.',
   'Sujal built the project gallery, keyboard-friendly carousel, optimized image loading, SEO metadata, validation scripts, and automated GitHub Pages deployment.',
   array['HTML5', 'CSS3', 'JavaScript', 'GitHub Actions'],
   null::date, 'https://github.com/SUJALSHK/sujals-portfolio', 'https://sujalshakya.com/', false),
  ('Amazon Storefront Clone',
   'A frontend recreation of Amazon''s storefront with reusable navigation, search, hero, product-grid, and footer sections.',
   'Sujal implemented the page structure, Flexbox-based layout, product cards, hover states, and Font Awesome icon integration.',
   array['HTML5', 'CSS3', 'Flexbox', 'Font Awesome'],
   null, 'https://github.com/SUJALSHK/amazon-clone-sujal', 'https://sujalshk.github.io/amazon-clone-sujal/', false),
  ('Rock Paper Scissors',
   'An interactive browser game that turns a classic matchup into an event-driven JavaScript experience.',
   'Sujal implemented randomized computer moves, conditional winner evaluation, score state, DOM updates, and immediate visual feedback for each round.',
   array['HTML5', 'CSS3', 'JavaScript', 'DOM APIs'],
   null, 'https://github.com/SUJALSHK/ROCK_PAPER_SCISSOR-', 'https://sujalshk.github.io/ROCK_PAPER_SCISSOR-/', false),
  ('Cybersecurity Python Toolkit',
   'A learning-focused collection of command-line security utilities for exploring practical security fundamentals.',
   'Sujal built substitution-cipher encryption and decryption, SHA-256 credential verification, password generation, and a TCP port scanner with input validation and socket timeouts.',
   array['Python', 'Sockets', 'SHA-256', 'CLI Tools'],
   null, 'https://github.com/SUJALSHK/CyberSecutity', null, false)
) as v(name, summary, description, technologies, project_date, github_url, demo_url, featured)
where not exists (select 1 from public.projects p where lower(p.name) = lower(v.name));

-- Skills ---------------------------------------------------------------------

update public.skills set category = 'Programming Language' where id = 2 and category = 'Programming language';

insert into public.skills (name, category, display_order, is_public)
select v.name, v.category, v.display_order, true
from (values
  ('C++', 'Programming Language', 4), ('Java', 'Programming Language', 5), ('Swift', 'Programming Language', 6),
  ('HTML', 'Programming Language', 7), ('CSS', 'Programming Language', 8), ('Bash', 'Programming Language', 9),
  ('Angular', 'Frontend', 12), ('Tailwind CSS', 'Frontend', 13),
  ('.NET', 'Backend', 31),
  ('Supabase', 'Database', 41), ('Database Management', 'Database', 42),
  ('VS Code', 'Tools', 51), ('Cursor', 'Tools', 52), ('Postman', 'Tools', 53), ('Docker', 'Tools', 54),
  ('JUnit', 'Testing', 71),
  ('Google Cloud Platform', 'Cloud', 80),
  ('Object-Oriented Programming', 'Core Competency', 90), ('Data Structures & Algorithms', 'Core Competency', 91),
  ('Software Testing', 'Core Competency', 92), ('Debugging', 'Core Competency', 93), ('Full-Stack Development', 'Core Competency', 94),
  ('English (Advanced)', 'Spoken Language', 100), ('Nepali (Native)', 'Spoken Language', 101),
  ('Hindi (Advanced)', 'Spoken Language', 102), ('Korean (Beginner)', 'Spoken Language', 103)
) as v(name, category, display_order)
where not exists (select 1 from public.skills s where lower(s.name) = lower(v.name));

-- Experience -----------------------------------------------------------------

-- Keep the ten existing, more detailed responsibilities; add the resume's
-- measurable results in front of them.
update public.experience set responsibilities = array[
  'Expanded automated testing from 101 to 275 tests across 26 test suites, increasing branch coverage from 40.80% to 79.48% and exceeding the 70% target',
  'Identified and documented 8 reproducible software defects, including security, authentication, and mobile functionality issues',
  'Collaborated with the development team to identify technical issues and prepare the application for real-world deployment'
] || responsibilities
where id = 1 and not (responsibilities @> array['Expanded automated testing from 101 to 275 tests across 26 test suites, increasing branch coverage from 40.80% to 79.48% and exceeding the 70% target']);

insert into public.experience (company, role, location, start_date, end_date, is_current, summary, responsibilities, technologies, experience_type, display_order, is_public)
select v.company, v.role, 'Mankato, Minnesota', v.start_date, v.end_date, v.is_current, v.summary, v.responsibilities, v.technologies, v.experience_type, v.display_order, true
from (values
  ('Minnesota State University, Mankato', 'Annual Giving Engagement Manager', date '2023-09-01', date '2028-05-01', true,
   'Manages student engagement ambassadors who connect with alumni and support university fundraising initiatives.',
   array[
     'Manage student engagement ambassadors responsible for connecting with alumni and supporting university fundraising initiatives',
     'Supervised 25 student ambassadors overall and 12 callers per shift, monitoring 1,000+ alumni calls and improving outreach performance',
     'Trained 30+ new ambassadors, improving call and donor engagement rates',
     'Develop leadership, communication, and problem-solving skills through team supervision and alumni relationship management'
   ], array[]::text[], null::text, 2),
  ('Nepalese Student Community (NeStCom)', 'President', date '2025-08-01', date '2026-08-01', false,
   'Led a recognized student organization at Minnesota State University, Mankato.',
   array[
     'Led a recognized student organization representing 200+ student members, promoting cultural diversity, student engagement, and community',
     'Coordinated and supported 3+ cultural and community events, strengthening student participation and cultural awareness',
     'Collaborated with university departments, student organizations, and executive board members to organize events and manage logistics'
   ], array[]::text[], 'Leadership', 3)
) as v(company, role, start_date, end_date, is_current, summary, responsibilities, technologies, experience_type, display_order)
where not exists (select 1 from public.experience e where lower(e.company) = lower(v.company) and lower(e.role) = lower(v.role));

-- Verification: expect 7 projects, 37 skills, 3 experience rows, all public.
select 'projects' as table_name, count(*) as total, count(*) filter (where is_public) as public_rows from public.projects
union all select 'skills', count(*), count(*) filter (where is_public) from public.skills
union all select 'experience', count(*), count(*) filter (where is_public) from public.experience;

commit;
