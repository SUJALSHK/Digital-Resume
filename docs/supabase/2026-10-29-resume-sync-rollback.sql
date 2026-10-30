-- Reverts 2026-10-29-resume-sync.sql using the backups it created.
-- Removes rows added since the backup and restores the three updated rows.
-- Run in the Supabase SQL editor as the project owner.

begin;

delete from public.projects where id not in (select id from resume_backup.projects_20261029);
delete from public.skills where id not in (select id from resume_backup.skills_20261029);
delete from public.experience where id not in (select id from resume_backup.experience_20261029);

update public.projects p set
  name = b.name, summary = b.summary, description = b.description, technologies = b.technologies,
  github_url = b.github_url, demo_url = b.demo_url
from resume_backup.projects_20261029 b where p.id = b.id;

update public.skills s set category = b.category
from resume_backup.skills_20261029 b where s.id = b.id;

update public.experience e set responsibilities = b.responsibilities
from resume_backup.experience_20261029 b where e.id = b.id;

commit;

-- Once you no longer need the backup:
--   drop schema resume_backup cascade;
