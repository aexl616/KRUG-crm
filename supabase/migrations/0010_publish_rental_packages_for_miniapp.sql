-- Rental day/night packages are public booking options, but the Mini App
-- renders them only inside the rental flow rather than as top-level services.
update public.services
set public_visible = true
where public_category = 'rental_package'
  and id in ('rental-day','rental-night');
