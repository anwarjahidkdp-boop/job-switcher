-- Product renamed to JobPao.
update public.plans set name = replace(name, 'Job Switcher', 'JobPao') where name like 'Job Switcher%';
