CREATE OR REPLACE FUNCTION reserve_placement(
  p_brand_name text,
  p_website_url text,
  p_creative_fit text,
  p_x integer,
  p_y integer,
  p_width_cells integer,
  p_height_cells integer,
  p_requester_hash text,
  p_reservation_expires_at timestamptz
)
RETURNS SETOF placements
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_pixels constant integer := 504000;
  v_tier_size constant integer := 100000;
  v_pixels_sold integer;
  v_tier_index integer;
  v_max_tier integer;
  v_price_per_pixel integer;
  v_amount_cents integer;
  v_remaining integer;
  v_sold integer;
  v_next_threshold integer;
  v_chunk integer;
BEGIN
  IF now() >= timestamptz '2026-09-10 08:00:00+00' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'auction_closed';
  END IF;

  IF (
    SELECT count(*)
    FROM placements
    WHERE requester_hash = p_requester_hash
      AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'rate_limited';
  END IF;

  UPDATE placements
  SET status = 'expired'
  WHERE status = 'reserved'
    AND reservation_expires_at <= now();

  SELECT COALESCE(SUM(pixel_count), 0)::integer
  INTO v_pixels_sold
  FROM placements
  WHERE status = 'paid';

  v_max_tier := GREATEST(0, CEIL(v_total_pixels::numeric / v_tier_size::numeric)::integer - 1);
  v_remaining := p_width_cells * p_height_cells * 100;
  v_sold := v_pixels_sold;
  v_amount_cents := 0;

  WHILE v_remaining > 0 LOOP
    v_tier_index := LEAST(GREATEST(v_sold / v_tier_size, 0), v_max_tier);
    v_price_per_pixel := 25 * POWER(2, v_tier_index)::integer;
    v_next_threshold := LEAST((v_tier_index + 1) * v_tier_size, v_total_pixels);
    v_chunk := LEAST(v_remaining, GREATEST(v_next_threshold - v_sold, 0));

    IF v_chunk <= 0 THEN
      EXIT;
    END IF;

    v_amount_cents := v_amount_cents + (v_chunk * v_price_per_pixel);
    v_remaining := v_remaining - v_chunk;
    v_sold := v_sold + v_chunk;
  END LOOP;

  RETURN QUERY
  INSERT INTO placements (
    brand_name,
    website_url,
    creative_fit,
    x,
    y,
    width_cells,
    height_cells,
    amount_cents,
    requester_hash,
    reservation_expires_at
  )
  VALUES (
    btrim(p_brand_name),
    p_website_url,
    p_creative_fit,
    p_x,
    p_y,
    p_width_cells,
    p_height_cells,
    v_amount_cents,
    p_requester_hash,
    p_reservation_expires_at
  )
  RETURNING placements.*;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23P01', MESSAGE = 'placement_overlap';
END;
$$;
