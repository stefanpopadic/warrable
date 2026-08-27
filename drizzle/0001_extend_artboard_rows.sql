ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_y_bounds;
ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_height_bounds;

ALTER TABLE placements
  ADD CONSTRAINT placements_y_bounds CHECK (y >= 0 AND y < 84);

ALTER TABLE placements
  ADD CONSTRAINT placements_height_bounds CHECK (height_cells >= 1 AND y + height_cells <= 84);
