-- KRUG 0.10.3 — disable public legacy credentials before server auth is deployed.
-- Owner recovery is performed only through the server API after validating the existing Mini App admin key.

update public.crm_staff_users
set active=false,
    must_change_password=true,
    updated_at=now()
where user_id in ('u1','u2') and must_change_password=true;

delete from public.crm_staff_sessions where user_id in ('u1','u2');
